/* ============================================================
   IMAP mínimo sobre TLS para Gmail (imap.gmail.com:993).
   Lee correos nuevos de INBOX sin dependencias externas.
   Marca los mensajes como leídos (\Seen) para no traerlos dos veces.
   ============================================================ */
import tls from 'node:tls';

const CRLF = '\r\n';

/**
 * Lee correos nuevos de Gmail por IMAP.
 * @param {object} opts { user, appPassword, sinceUid, limit }
 * @returns {Promise<Array<{uid, from, to, subject, text, html, messageId, inReplyTo, references, date}>>}
 */
export async function fetchNewEmails(opts = {}) {
  const user = String(opts.user || '').trim();
  const pass = String(opts.appPassword || '').trim();
  if (!user || !pass) throw new Error('Faltan credenciales de Gmail para leer correos.');

  const host = 'imap.gmail.com';
  const port = 993;
  const sinceUid = Number(opts.sinceUid) || 0;
  const limit = Math.max(1, Math.min(50, Number(opts.limit) || 20));

  return await new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host });
    let buffer = '';
    let tag = 0;
    let loggedIn = false;
    let finished = false;
    const pending = new Map(); // tag -> {resolve,reject,accum}
    const results = [];

    const nextTag = () => `A${++tag}`;

    const done = (err, value) => {
      if (finished) return;
      finished = true;
      try { socket.end(); } catch { /* noop */ }
      if (err) reject(err); else resolve(value || []);
    };

    socket.setEncoding('utf8');
    socket.setTimeout(30000, () => done(new Error('IMAP Gmail: timeout.')));
    socket.on('error', (err) => done(new Error(`IMAP Gmail: ${err.message}`)));

    function sendCommand(cmd) {
      return new Promise((res, rej) => {
        const t = nextTag();
        pending.set(t, { resolve: res, reject: rej, accum: [] });
        socket.write(`${t} ${cmd}${CRLF}`);
      });
    }

    socket.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf(CRLF)) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + CRLF.length);
        handleLine(line);
      }
    });

    function handleLine(line) {
      // Respuestas tagged: A1 OK ... / A1 NO ... / A1 BAD ...
      const tm = line.match(/^(A\d+)\s+(OK|NO|BAD)\s+(.*)$/);
      if (tm && pending.has(tm[1])) {
        const p = pending.get(tm[1]);
        pending.delete(tm[1]);
        const status = tm[2];
        const text = tm[3] || '';
        if (status !== 'OK') p.reject(new Error(`IMAP ${tm[1]} ${status}: ${text}`));
        else p.resolve({ text, lines: p.accum });
        return;
      }
      // Líneas untagged (* ...) y continuaciones (+ ...) se ignoran salvo
      // que las estemos acumulando para un comando (FETCH).
      for (const [, p] of pending) {
        p.accum.push(line);
      }
    }

    socket.once('connect', async () => {
      try {
        // El greeting del servidor ya pasó; StartTLS no hace falta (993 es TLS implícito).
        await sendCommand(`LOGIN ${user} ${pass}`);
        loggedIn = true;

        await sendCommand('SELECT INBOX');

        // Buscar UIDs mayores al último procesado
        const searchCmd = sinceUid > 0
          ? `UID SEARCH UID ${sinceUid + 1}:*`
          : 'UID SEARCH ALL';
        const searchRes = await sendCommand(searchCmd);
        const uids = String(searchRes.text || '')
          .split(/\s+/)
          .map((s) => parseInt(s, 10))
          .filter((n) => Number.isFinite(n) && n > sinceUid)
          .sort((a, b) => a - b)
          .slice(0, limit);

        if (!uids.length) { done(null, []); return; }

        // Traer cabeceras + cuerpo de cada mensaje
        for (const uid of uids) {
          try {
            const fetchRes = await sendCommand(`UID FETCH ${uid} (BODY.PEEK[])`);
            const raw = reconstructMessage(fetchRes.lines);
            if (raw) {
              const parsed = parseRawEmail(raw);
              if (parsed) results.push({ uid, ...parsed });
            }
            // Marcar como leído para no volver a traerlo
            await sendCommand(`UID STORE ${uid} +FLAGS (\\Seen)`).catch(() => {});
          } catch {
            // Si un mensaje falla, seguimos con los demás.
          }
        }
        done(null, results);
      } catch (err) {
        done(err);
      }
    });
  });
}

function reconstructMessage(lines) {
  // IMAP devuelve: * N FETCH (BODY[] {1234}\r\n<mensaje>\r\n)\r\n
  const raw = lines.join(CRLF);
  const m = raw.match(/BODY(?:\[\])?\s*\{(\d+)\}/i);
  if (!m) return null;
  const size = parseInt(m[1], 10);
  const start = raw.indexOf('}', m.index) + 1;
  // Después de } viene CRLF, luego el mensaje de 'size' bytes
  let pos = start;
  if (raw[pos] === '\r' && raw[pos + 1] === '\n') pos += 2;
  return raw.slice(pos, pos + size);
}

function decodeHeader(value) {
  const s = String(value || '');
  const encoded = s.match(/=\?UTF-8\?B\?([^?]+)\?=/i);
  if (encoded) {
    try { return Buffer.from(encoded[1], 'base64').toString('utf8'); } catch { return s; }
  }
  return s.replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_, q) => {
    try { return decodeURIComponent(q.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, '%$1')); } catch { return q; }
  });
}

function headerValue(headers, name) {
  const line = headers.find((h) => h.toLowerCase().startsWith(name.toLowerCase() + ':'));
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
}

function parseRawEmail(raw) {
  const sepIdx = raw.indexOf(CRLF + CRLF);
  if (sepIdx === -1) return null;
  const headerBlock = raw.slice(0, sepIdx);
  let body = raw.slice(sepIdx + 4);
  const headers = headerBlock.split(CRLF);
  const from = decodeHeader(headerValue(headers, 'From'));
  const to = decodeHeader(headerValue(headers, 'To'));
  const subject = decodeHeader(headerValue(headers, 'Subject'));
  const messageId = headerValue(headers, 'Message-ID').replace(/^<|>$/g, '');
  const inReplyTo = headerValue(headers, 'In-Reply-To').replace(/^<|>$/g, '');
  const references = headerValue(headers, 'References').match(/<[^>]+>/g) || [];

  // Decodificar cuerpo (base64 o quoted-printable)
  const cte = headerValue(headers, 'Content-Transfer-Encoding').toLowerCase();
  if (cte === 'base64') {
    try { body = Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8'); } catch { /* noop */ }
  } else if (cte === 'quoted-printable') {
    body = body.replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/=\r?\n/g, '');
  }

  if (!from || (!body && !subject)) return null;
  return {
    from, to, subject,
    text: body.trim(),
    html: '',
    messageId,
    inReplyTo,
    references,
    date: headerValue(headers, 'Date'),
  };
}
