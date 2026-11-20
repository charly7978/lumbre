# Lumbre — plan de remediación real (2026-11-19)

Plan corregido y optimizado. La auditoría de las 04:00 quedó superada: gran parte
de las Fases 1, 2 y 5 ya está implementada. Este plan (a) marca lo verificado,
(b) cubre solo lo que falta y (c) deja todo en un estado defendible.

Decisiones tomadas:
- Plan corregido, no repetir lo ya hecho.
- Compradores del directorio: **revisión obligatoria** por defecto
  (`mission.reviewDirectory = true`, apagable).
- Costo aterrizado: **componentes + cálculo en código**; si falta un componente,
  se muestra como `no_verificado`, no se inventa.
- Telegram: **agente conversacional con memoria**, que entrega soluciones y
  ejecuta acciones; las externas/irreversibles requieren una confirmación de una
  palabra.
- Resolver todos los pendientes en orden de dependencia.
- Precio FOB, certificación CE/UL y material de venta quedan como decisión del
  dueño (fuera del software), con criterios concretos al final.

---

## 0. Evidencia: lo que ya está hecho (no tocar, solo verificar)

| Tema | Estado | Evidencia |
|---|---|---|
| Búsqueda con Tavily | Hecho | `data/settings.json` → `search.provider = "tavily"` |
| Clave de búsqueda por entorno | Hecho | `resolveSearchApiKey` usa `LUMBRE_SEARCH_KEY` (`lib/search.mjs:61-64`) |
| Fallback de Tavily | Hecho | `lib/search.mjs:474-485` (SearXNG → DuckDuckGo) |
| Correo manual | Hecho | `data/settings.json` → `email.provider = "manual"` |
| `.eml`, Resend, webhook | Hecho | `lib/email.mjs:269-342`, `server.mjs:1503-1547` |
| `verifyWebsite` parcheado | Hecho | `lib/hunter.mjs:128-197`: dominio fuera de identidad, exige iluminación, detecta cierre |
| `tools/verify-directory.mjs` + `npm run verify:directory` | Hecho | `package.json:17`, `tools/verify-directory.mjs` |
| `safeFetchText` anti-SSRF | Hecho | `lib/util.mjs:311-406`: DNS + IPs privadas + redirecciones acotadas |
| `extractJson` y bloques `<think>` | Hecho | `lib/util.mjs:100-106` |
| Validación de header `Host` | Hecho | `server.mjs:1050-1061` |
| Backup sin claves (API) | Hecho | `server.mjs:872-898`, `SECRET_PATHS` |
| Debounce de `missions.json` | Hecho | `lib/agents.mjs:51-54`, `lib/store.mjs:289-309` |
| DELETE sin doble escritura | Hecho | `server.mjs:1170, 1222, 1331, 1573, 1623, 1646` (un solo `await store.set`) |
| Competidores sin datos | Hecho | `lib/agents.mjs:273-282` descarta los “sin dato” totales |
| Telegram unidireccional | Falta | `lib/notify.mjs:104-139`: comandos + `askTeam` sin historial; no hay acciones |
| `maxTokens` 8192 + reintentos 413/429 | Hecho | `lib/ai.mjs:107-118, 299-381, 383-517` |

No encontrado: `data/settings.json.broken-*`, ~40 `tmp-*.mjs`, clave de DeepSeek
en el código actual. Sí hay 3 temporales en `tools/` (Fase 3.4).

---

## Fase 0 — Seguridad (hoy, bloqueante)

### 0.1 Rotar claves
- Groq: https://console.groq.com/keys → revocar la actual y crear una nueva.
- Tavily: https://app.tavily.com → revocar y crear.
- Telegram: `@BotFather` → `/revoke` → token nuevo.
- DeepSeek: si existe una clave en algún commit anterior, revocarla también.
- Resend: crear la clave recién cuando se configure el dominio (Fase 5); nunca
  pegarla en el chat, en el plan ni en un commit.

### 0.2 Sacar `data/` del working tree
```powershell
Add-Content .gitignore "`ndata/`n*.tmp`n"
git add .gitignore
if (git ls-files data/ | Select-Object -First 1) { git rm -r --cached data }
git commit -m "chore: no versionar data/ (claves y datos locales)"
```
Antes del commit, revisar `git status`: debe contener solo `.gitignore` y las
bajas de `data/`; si hay cambios ajenos staged, separarlos primero. Si
`.gitignore` ya tenía `data/`, saltear el `Add-Content`; si no hay cambios
staged, saltear el commit.
`git rm --cached` no borra los archivos locales. Si `git ls-files data/` no
devuelve nada, `data/` no estaba versionado: saltar el `git rm`.
Revisar `data/backups/` y borrar copias viejas si contienen claves; `data/`
queda ignorado.

### 0.3 Limpiar el historial (solo si `data/` estuvo versionado)
Comprobar:
```powershell
git ls-files data/
git log --all --oneline -- data/
git log --all -p -- data/settings.json | Select-String -Pattern 'gsk_|tvly-|bot[0-9]{8,}:'
```
Si aparece cualquier resultado, verificar visibilidad
(`gh repo view charly7978/lumbre --json visibility`) y, si es público, reescribir
el historial (8 commits, remote `https://github.com/charly7978/lumbre.git`).
Antes de clonar el mirror, subir el commit de 0.2 (`git push`) para que el
`.gitignore` viaje en la historia reescrita:
```powershell
if (Test-Path "$env:TEMP\lumbre-mirror") { Remove-Item -Recurse -Force "$env:TEMP\lumbre-mirror" }
git clone --mirror https://github.com/charly7978/lumbre.git "$env:TEMP\lumbre-mirror"
cd "$env:TEMP\lumbre-mirror"
pip install git-filter-repo
git filter-repo --path data --invert-paths --force
git remote add origin https://github.com/charly7978/lumbre.git
git push --force --all
git push --force --tags
```
Después del force-push, sincronizar el clone original:
`git fetch origin; git reset --hard origin/main` (o volver a clonar).
Atención: `reset --hard` descarta cambios locales sin commitear; si el clone
tiene cambios, commitearlos o hacer la reescritura desde un clone nuevo.
Alternativa: BFG (`java -jar bfg.jar --delete-folders data`).
Avisar: reescribe hashes; quien tenga un clone debe volver a clonar; los PRs
abiertos se rompen. Si `data/` nunca estuvo versionado, omitir 0.3 y documentarlo.

### 0.4 Cargar las claves nuevas
- Opción recomendada: Ajustes de Lumbre (local), que reescribe
  `data/settings.json` con los valores nuevos.
- Variables de entorno soportadas: `LUMBRE_AI_KEY`, `LUMBRE_AI_MODEL`,
  `LUMBRE_AI_PROVIDER`, `LUMBRE_AI_BASE_URL`, `LUMBRE_SEARCH_KEY`,
  `LUMBRE_WEBHOOK_TOKEN`.
- No hay variable para Telegram, Hunter ni Resend: se cargan por Ajustes.
- Si usás variables, la UI puede mostrar el campo vacío o enmascarado; la
  variable manda.
- Probar el modelo en Ajustes → IA. Si `qwen/qwen3.8-27b` da 404, pasar a
  `llama-3.3-70b-versatile` (ya está en el preset de Groq).
- Si el log muestra 413/429 recurrentes: bajar `ai.maxTokens` a 4096 y usar
  profundidad `rapida` para las primeras misiones. El código ya espera 20/46 s
  y achica el presupuesto (`lib/ai.mjs:364-369, 429-447`).

### 0.5 Criterio de aceptación
- `git check-ignore -v data/settings.json` muestra la regla.
- `git ls-files data/` vacío.
- `git log --all --oneline -- data/` vacío (o, si el repo es privado y no se
  reescribió, el historial conserva `data/` y está documentado).
- Pruebas de IA, Búsqueda y Telegram en Ajustes dan OK.
- El log de una misión dice `vía tavily`.
- Ningún `gsk_`, `tvly-` ni token de bot en el historial.

---

## Fase 1 — Compradores reales (código + datos)

### 1.1 Extraer un evaluador puro de identidad
En `lib/hunter.mjs`, mover la lógica de `verifyWebsite` (líneas 142-196) a:
```js
export function evaluateSiteIdentity({ title = '', sample = '' } = {}, name = '') { ... }
```
Debe devolver `{ ok, status, title, reason }` sin hacer red. El evaluador cubre
`cerrado | sin_coincidencia | fuente_secundaria | verificado`; `sin_sitio` y
`no_responde` los sigue resolviendo `verifyWebsite` antes/después de
`inspectSite`. `verifyWebsite` agrega `url: site.pages[0] || ''`. Esto permite
tests adversariales sin red y elimina el fetch real a `example.com` de
`tools/test-flow.mjs:284-289`.

### 1.2 Tests adversariales obligatorios
Crear `tools/test-verify.mjs`, sumarlo a `npm test` (después de `test:flow`) y
agregarlo a `npm run check`:
```json
"check": "... && node --check tools/test-verify.mjs",
"test:verify": "node tools/test-verify.mjs",
"test": "npm run check && npm run test:search && npm run test:core && npm run test:guards && npm run test:flow && npm run test:verify && npm run test:api"
```
Casos:
- Dominio que contiene el nombre pero el contenido es de otro rubro → `ok:false`.
- Dominio estacionado (“Domain is for sale”, sin iluminación) → `ok:false`.
- Homónimo de otro rubro (p. ej. “Interlight” logística) → `ok:false`.
- Sitio real con el nombre en el título y contenido de iluminación → `ok:true`.
- Nombre genérico sin palabra distintiva: solo pasa si el nombre completo está
  en el título y hay iluminación.
- Sitio de iluminación que no menciona el nombre → `ok:false`.

La exclusión del dominio es estructural: `evaluateSiteIdentity` no recibe
`domain`; `verifyWebsite` solo le pasa `title` y `sample`.

Eliminar el test de red `verifyWebsite('https://example.com', 'Example')` de
`tools/test-flow.mjs:284-289` y su import si queda sin uso.

### 1.3 Corregir el directorio semilla
1. `npm run verify:directory`.
2. Confirmar y corregir:
   - **Años Luz**: hoy `https://www.anosluz.com` (`lib/directory.mjs:30`).
     Verificado por búsqueda web el 19-nov-2026: el sitio oficial es
     `https://anosluziluminacion.com/es/` (“Años Luz Iluminación”, showrooms en
     Madrid, catálogo de iluminación). Reemplazar el dominio y dejar
     `verified_at` con la fecha de la corrida.
   - **Interlight**: hoy `https://www.interlight.cl` (`lib/directory.mjs:160`).
     Verificado: `https://interlight.cl/` responde “Interlight Iluminación
     Chile”, con showroom en Vitacura y `contacto@interlight.cl`. El dominio es
     correcto; normalizar a `https://interlight.cl` (sin `www`) y actualizar
     `verified_at`.
3. Revisar las 16 entradas con `verify:directory`; reemplazar o eliminar las
   que fallen. Un sitio que no responde no se borra a ciegas: se marca
   `verified_at` con la fecha y se reemplaza por una alternativa real; si no
   hay alternativa, se elimina del directorio.
4. Actualizar el comentario de cabecera de `lib/directory.mjs` (hoy dice
   “verificadas el 2026-11-19”) para que sea coherente con las fechas reales.

### 1.4 Revisión obligatoria para el directorio
- `lib/store.mjs`: agregar `mission.reviewDirectory: true` a `DEFAULT_SETTINGS`
  y validar boolean en `saveSettings`.
- `lib/agents.mjs`: `draftPlanForBuyer` recibe `reviewDirectory` desde
  `syncThreads` (que ya tiene `settings`). Después de la rama de
  `conocimiento` (líneas 1209-1213), agregar:
```js
} else if (buyer.origen === 'directorio' && reviewDirectory) {
  status = 'revisar';
  reviewKind = 'directorio';
  reviewNote = 'Comprador del directorio semilla: confirmá que sea una tienda '
    + 'multimarca y que compre a un maker antes de enviarlo.';
}
```
- UI: `public/app.js:3517` (junto a `autoCreateThreads`) agregar el checkbox
  `name="reviewDirectory"`; parsearlo en `public/app.js:3815-3816` con
  `reviewDirectory: check('reviewDirectory')`. `draft.reviewNote` ya se
  muestra en `public/app.js:2174`; no hace falta un mapa nuevo de `reviewKind`.
- Migración única al arrancar: `markDirectoryThreadsForReview(store)` en
  `lib/agents.mjs`, llamado desde `server.mjs` después de
  `sanitizeLegacyThreads`, solo si `settings.mission.reviewDirectory !== false`.
  Marca los hilos con
  `thread.verification?.origen === 'directorio'` y borradores `listo` como
  `revisar` (`reviewKind:'directorio'`, `lockedReview:true`, nota). Saltea hilos
  demo (`thread.demo === true`). No toca `enviado` ni `bloqueado`. Debe ser
  idempotente (bandera `thread.directoryReviewMigrated`). Desactivar la config
  no revierte los borradores ya marcados: el dueño los aprueba o edita.
  En `data/threads.json` hay 12 hilos con `origen:'directorio'`: la migración
  los va a pasar a revisión; el dueño debe aprobarlos de nuevo.
- Tests: comprador `origen:'directorio'` → `revisar`/`directorio`;
  `reviewDirectory:false` → `listo` si el resto de guardas pasan; la migración
  no toca hilos ya revisados.

### 1.5 Filtro de encaje
- `Barcelona LED` (`lib/directory.mjs:106-114`) y `Luminaire` (166-174) ya están
  en `prioridad: 'baja'`. Mantener; opcional agregar `encaje:'bajo'` y ordenar
  los candidatos por prioridad antes de aplicar `maxProspects`.
- Recomendación: dejar Luminaire (showroom de lujo, improbable) y Barcelona LED
  (retail LED) al final; no gastan envíos tempranos.

### 1.6 Búsqueda: fallback y profundidad configurable
- Hoy solo Tavily tiene fallback (`lib/search.mjs:474-485`); Brave y Serper
  devuelven `[]` si fallan.
- Extraer un helper `fallbackSearch(settings, query, limit, strict, attempts)`
  que reutilice SearXNG + DuckDuckGo, y llamarlo desde el `catch` de Tavily,
  Brave y Serper. Devolver `engine: '<proveedor> (fallback)'` y los errores.
- Usar el fallback también cuando falta la clave del proveedor seleccionado
  (hoy Tavily/Brave/Serper retornan error temprano).
- Agregar `search.prospectingDepth` (default `advanced`, valores
  `basic|advanced`) y usarlo en `lib/agents.mjs:216` en vez del literal
  `'advanced'`. Exponerlo en Ajustes → Búsqueda (`public/app.js:3379`) y
  parsearlo en `public/app.js:3756`; validar en `store.saveSettings`.
  Investigación y aduanas siguen en `basic`.
- Criterio: ninguna misión queda ciega por cuota, caída o falta de clave de un
  proveedor pago; el dueño puede bajar a `basic` si Tavily consume mucho.

### 1.7 Revisión humana de los primeros 20
- Abrir 5-10 compradores verificados a mano y confirmar sitio + email.
- Registrar hallazgos en Aprendizajes.
- Criterio: 10/10 correctos en la muestra; si falla uno, corregir el evaluador o
  el directorio antes de escalar.

---

## Fase 2 — Dato vs. hipótesis (aduanas, precios, competidores)

### 2.1 Aduanas
- `normalizeArtifact('customs')` ya marca `fuente_verificada` y
  `estado_fuente` (`lib/agents.mjs:289-326`). Exportar `normalizeArtifact`
  para tests unitarios.
- `buildIntel` (`server.mjs:214-248`) debe arrastrar `fuente_verificada` y
  `estado_fuente` por país. Al fusionar varias misiones: elegir la fuente
  verificada más reciente; si no hay ninguna, la más reciente sin verificar.
  `fuente_verificada` y `estado_fuente` corresponden a la URL mostrada.
- UI:
  - `public/app.js:1731`: mostrar siempre el badge; si no hay fuente o no está
    verificada → “Hipótesis del modelo”.
  - `marketCountryCard` (`public/app.js:3059-3074`): agregar el mismo badge y
    mostrar el link solo si `fuente_verificada`.
- Prompt (`lib/prompts.mjs:373`): cambiar “usá conocimiento general y marcá
  verificar” por “dejá `fuente` vacío, escribí en `notas` que es una hipótesis
  y no inventes URLs”.
- Test: país con URL fuera de los resultados → `estado_fuente:'no_verificado'`;
  país con URL en resultados → `'confirmado'`.

### 2.2 Precios y costo aterrizado
- Esquema (`lib/prompts.mjs:393`):
```json
"landed_cost": [{"pais":"","flete":0,"seguro":0,"aranceles":0,"otros":0,"supuestos":""}]
```
- `normalizeArtifact('pricing')` (`lib/agents.mjs:327-379`):
  - Si hay componentes, calcular
    `costo_puesto_destino = costo_base + flete + seguro + aranceles + otros`.
  - Si no hay componentes, usar el artifact legacy: si `costo_puesto_destino`
    existe, conservarlo; si solo hay `costo`, calcular `costo_base + costo`
    (el código anterior trataba `costo` como el extra del país, no como el
    total). Marcar `estado:'no_verificado'`.
  - Devolver `componentes`, `costo_base`, `costo_puesto_destino`, `estado`
    (`'calculado' | 'no_verificado'`) y `supuestos`.
  - Mantener compatibilidad con misiones viejas
    (`costo` / `costo_puesto_destino`).
- UI (`public/app.js:1754`): el badge “Calculado en código” solo si
  `estado === 'calculado'`; si no, “Hipótesis del modelo”. Si `estado` no existe
  (misión vieja), usar `calculo_automatico` como respaldo y no romper.
- Tests: suma de componentes; falta de componentes → `no_verificado`;
  artifact legacy sigue mostrándose.

### 2.3 Competidores
- Ya se descartan los que tienen todo “sin dato”. Mantener.
- Agregar `estado_fuente` por competidor y usar el badge existente
  (`public/app.js:1719`).
- No inventar competidores: si no hay `fuente` ni dato real, se descarta.

### 2.4 Etiquetado general
- “Confirmado en fuente” / “Hipótesis del modelo” en: tendencias, competidores,
  países de aduanas y costo aterrizado.
- La recomendación de precios se etiqueta “Recomendación del modelo”; es una
  decisión, no un dato verificable.
- Criterio: ningún número de arancel/impuesto aparece sin badge de fuente.

---

## Fase 3 — Robustez técnica

### 3.1 WhatsApp: `verifyToken` persistente
`lib/store.mjs:234-238` genera un token aleatorio cuando es `lumbre` o vacío,
pero solo lo deja en memoria: no se escribe a disco. En cada reinicio cambia y
el webhook de Meta deja de validar.
- Fix: si se reemplazó, `await this.write('settings', merged)` antes de
  `this.ready = true`, envuelto en `try/catch`: si la escritura falla, loguear
  y continuar con el token en memoria para no bloquear el arranque.
- Test: init con `verifyToken:'lumbre'` → archivo con token no trivial;
  re-init con el mismo `dataDir` → mismo token; `GET /api/webhooks/whatsapp`
  con ese token devuelve el challenge.

### 3.2 Backup sin claves en la UI
- `public/app.js:3565`: agregar un segundo enlace
  `href="/api/backup?safe=1"` con “Descargar copia sin claves”.
- Test API: usar `readZip` de `lib/zip.mjs` para abrir el ZIP de
  `?safe=1`, parsear `lumbre-data.json` y comprobar que `settings.ai.apiKey`,
  `settings.search.apiKey`, `settings.notify.telegram.token`,
  `settings.notify.whatsapp.token`, `settings.email.resendKey` están vacíos y
  que `telegramSessions` no viaja (objeto vacío).

### 3.3 CI
Crear `.github/workflows/test.yml`:
```yaml
name: test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm test
```
No hay dependencias que instalar. `test:api` levanta el server en 4399 con
`LUMBRE_DATA_DIR` temporal. `npm test` debe ser hermético (sin red) después de
la Fase 1.2.

### 3.4 Limpieza del repo
- Borrar `tools/tmp-patch.ps1`, `tools/tmp-patch2.ps1`, `tools/fix-text.mjs`
  (verificar que `package.json` no los referencia; hoy no).
- `.gitignore`: `data/`, `*.tmp`.
- No borrar `.kilo/plans/` (el plan debe quedar versionado).

### 3.5 Log de misiones
- Hoy `persist` usa debounce de 400 ms (`lib/agents.mjs:51-54`) y es
  fire-and-forget. Agregar `persistLog` con debounce de 1500 ms para
  `logMission`, también fire-and-forget (no `await` del debounce); dejar
  `persist` para cambios de estado de paso.
- Medir el tamaño de `data/missions.json` y el número de escrituras. Si supera
  ~1 MB, mover `mission.log` a `data/logs/<missionId>.jsonl` y dejar en
  `missions.json` solo los últimos ~20 entradas (fase 3b, opcional).
- Agregar `Store.flush()` que espere los `pendingWrites` y llamarlo en los
  handlers de `SIGINT`/`SIGTERM` de `server.mjs`; hoy el cierre puede perder
  las últimas escrituras debounced.

### 3.6 Verificado sin cambios
- Host header, DELETE con una sola escritura, anti-SSRF y `<think>` ya están.
- `prompts.mjs` y `notify.mjs` revisados: sin secretos ni blockers; el único
  hallazgo es el `verifyToken` de WhatsApp (3.1).

---

## Fase 4 — Agente conversacional por Telegram

Hoy Telegram es unidireccional: `Notifier.handleOwnerText` responde comandos y
pasa el texto suelto a `askTeam` sin historial (`lib/notify.mjs:104-139`,
`server.mjs:279-285`). Cada mensaje es una consulta aislada: no hay memoria ni
acciones. Esta fase lo convierte en una conversación continua que resuelve y
ejecuta con confirmación.

### 4.1 Memoria de conversación
- Nueva colección `telegramSessions` en `lib/store.mjs` (`{}`), forma:
  `{ [chatId]: { history: [{role,text,at}], pending: null|{...}, updatedAt } }`.
- `history`: últimos 12 turnos, texto <=2000 chars; `pending`: acción a
  confirmar.
- Los avisos enviados por `notify` a Telegram se guardan en el historial
  (`role:'assistant'`, `proactive:true`), para que el agente recuerde qué le
  mandó.
- Persistir con `store.setDebounced('telegramSessions', ..., 300)`; el
  `Store.flush()` de la Fase 3.5 cubre el cierre.
- Excluir `telegramSessions` del backup seguro (Fase 3.2): es historial privado,
  no un secreto, pero no debe viajar en la “copia sin claves”.
- Comandos: `/start` (bienvenida + ejemplos), `/ayuda` actualizado con
  ejemplos ("¿cómo venimos?", "prepará una respuesta para Avanluce", "mandá el
  mail", "lanzá una misión para España"), `/reiniciar` (borra historial y
  pendiente), `/estado`, `/misiones`, `/resumen`, `/pausar`, `/activar` (se
  mantienen).
- `pollTelegram` pasa el `chatId` a `handleOwnerText(text, 'telegram', chatId)`;
  la sesión se indexa por ese `chatId`.
- Al cambiar el token de Telegram (Fase 0.1), resetear `meta.telegramOffset` a
  0; si no, el bot nuevo puede saltarse mensajes.
- `handleOwnerText` agrega `{role:'user', text, at}` antes de consultar y
  `{role:'assistant', text: reply, at}` después (la respuesta visible, sin el
  bloque JSON de acción); recorta a 12; `/reiniciar` vacía.

### 4.2 Prompt conversacional
- Usar un prompt específico de Telegram (`telegramPrompt` o
  `askPrompt(..., { channel: 'telegram' })`); el prompt web `/api/ask` no
  incluye el bloque de acciones ni el historial.
- `askPrompt(agentId, question, context, { history = [] })` agrega
  `CONVERSACIÓN RECIENTE` con los últimos turnos; `askTeam({..., history})` lo
  pasa. El callback `ask` de `server.mjs` cambia a
  `(question, channel, history)` y reenvía `history` a `askTeam`;
  `handleOwnerText` pasa `session.history` como tercer argumento. El `/api/ask`
  de la web queda sin historial (no cambia).
- Reglas del prompt de Telegram:
  - "Sos el agente personal del dueño por Telegram. Mantené el hilo; usá el
    historial para 'eso', 'el anterior', 'más corto'."
  - "Si falta un dato, decí exactamente cuál y el paso concreto para conseguirlo."
  - "No empieces con 'no puedo'. Si una acción no existe, decí directamente qué
    sí podés hacer y ejecutá esa parte."
  - "Si la acción es externa/irreversible, devolvé un bloque JSON de acción; el
    sistema pide confirmación."
  - "No inventes datos; marcá 'supuesto'. Si usaste `buscar`, citá las URLs de
    las fuentes."
  - "Acciones que podés proponer: `buscar`, `crear_borrador`, `actualizar_hilo`,
    `guardar_aprendizaje`, `agendar_seguimiento`, `enviar_borrador`,
    `lanzar_mision`, `actualizar_producto`. Si el usuario pide otra cosa,
    ofrecé la más cercana de esta lista y ejecutá la parte posible."
  - "Incluí el bloque `accion` solo si el usuario pide hacer algo; en ese caso
    poné `requiere_accion: true`."
  - "Español rioplatense, texto plano, <=600 palabras; si es una solución larga,
    pasos numerados y la acción concreta al final."
  - "Tono: cercano y directo, como un socio; sin 'estimado', sin relleno, sin
    repetir la pregunta."
- `maxTokens` del agente Telegram: 1800; agregar `maxTokens` opcional a
  `askTeam` (default 1300) y pasar 1800 desde Telegram. `temperature` 0.5.
- Contexto: reutilizar `askContext` (marca, productos, misiones, hilos,
  aprendizajes). No incluir claves ni tokens.
- Si el mensaje menciona una empresa/contacto, resolver el `threadId` por nombre
  en `store.get('threads')` y agregar sus últimos 6 mensajes y el borrador
  actual al contexto; así puede responder "¿qué hago con Avanluce?" o "respondé
  a X" sin pedir que el dueño repita datos.

### 4.3 Capa de acciones (sin excusas)
- Nuevo `lib/telegram-actions.mjs`:
  - `parseAction(text)`: usa `extractJson` para encontrar el bloque JSON, valida
    `tipo` contra `ACTION_SPECS`, devuelve `{ action, cleanText }`; `cleanText`
    es la respuesta sin el bloque JSON (si queda vacía, usar `resumen`).
  - `describeAction(action)`: resumen en texto plano para la confirmación.
  - `executeAction({ action, store, actions, chatId, search = searchWebDetailed })`:
    ejecuta y devuelve `{ ok, message }`; `search` es inyectable para tests.
- Esquema que el modelo debe devolver cuando el usuario pide una acción:
```json
{"accion":{"tipo":"crear_borrador","args":{...},"resumen":"...","requiere_accion":true}}
```
- La app solo procesa `accion` si `requiere_accion === true`; si no, ignora el
  bloque y usa el texto. Si el JSON no se puede parsear, no ejecuta y responde
  con la alternativa concreta.
- `confirmar` lo decide la app, no el modelo:
  - **Automáticas (reversibles o de solo lectura)**: `buscar`, `crear_borrador`
    (status `revisar`), `actualizar_hilo` (etapa/notes/nextStep),
    `guardar_aprendizaje`, `agendar_seguimiento`.
  - **Con confirmación (externas/irreversibles)**: `enviar_borrador`,
    `lanzar_mision`, `actualizar_producto` (precio/costo).
- Allowlist y validación:
  - `buscar`: `query` (<=300), `limit?` (<=8); llama a
    `searchWebDetailed(settings, query, { count: limit, strict: false })` y
    devuelve `results` (título/URL/snippet), `engine` y `errors`; no inventa ni
    fetchdea páginas. Si no hay resultados, informar el error concreto y cómo
    resolverlo (proveedor/clave).
  - `crear_borrador`: `threadId`, `subject`, `body` (<=5000), `channel` (`email`).
    Crea borrador `status:'revisar'`, `source:'telegram'`, `channel:'email'`,
    `language:'es'`, `guardVersion:2`; nunca lo envía.
  - `actualizar_hilo`: `threadId`, `stage?`, `nextStep?`, `notes?`; valida etapa.
  - `guardar_aprendizaje`: `insight`, `tag?`, `confidence?`, `evidence?`, `apply?`.
  - `agendar_seguimiento`: `threadId`, `at`, `note?`.
  - `enviar_borrador`: `threadId`, `draftId`; si no se indica canal, usar
    `settings.email.provider` (`resend`/`webhook`/`manual`). Llama al handler
    existente `sendThreadMessage(threadId, { draftId, channel, confirm: true })`.
    Si el proveedor es `manual`, marca enviado y deja el `.eml`; si es
    Resend/webhook, lo manda. Si el borrador está en `revisar`, la confirmación
    lo aprueba (`status:'listo'`, `approvedAt`, `approvedBy:'telegram'`, borrar
    `lockedReview`) y envía; si está `bloqueado`, no envía y explica el bloqueo.
  - `lanzar_mision`: `productId`, `markets?`, `depth?`, `name?`; llama a
    `createMission` existente. Valida producto y mercados.
  - `actualizar_producto`: `productId`, `price?`, `cost?`, `status?`; valida
    `price >= 0` y `status` permitido.
  - Tipo desconocido: responder "No reconozco esa acción; puedo A, B, C" con el
    menú real, no "no puedo".
- Inyección desde `server.mjs`: cambiar el constructor a
  `constructor({ store, ask, actions = {} })` con `this.actions = actions`, y
  crear `new Notifier({ store, ask, actions: { createMission, sendThreadMessage } })`.
  Las funciones ya existen (declaración de función, hoisting); no duplicar lógica.
- Flujo de confirmación:
  - Acción automática: ejecutar ya; responder "Listo: <resultado>."
  - Si el mensaje del dueño termina en "?" o es una consulta, no auto-ejecutar
    acciones que mutan datos: proponer la acción y esperar "sí"/"confirmar".
    `buscar` es de solo lectura y puede ejecutarse siempre.
  - Acción confirmable: guardar `session.pending`, quitar el JSON del texto y
    agregar "Si lo confirmás, escribí 'confirmar'; para cancelar, 'cancelar'."
  - "confirmar"/"sí"/"dale" ejecuta; "cancelar"/"no" limpia. Si llega un pedido
    nuevo antes de confirmar, reemplazar el pendiente y avisar. Si llega
    "confirmar" sin `pending`, responder "No hay nada pendiente; decime qué
    querés hacer".
  - Errores: "La ejecución de X falló por Y; ya tengo la alternativa Z." Nunca
    una respuesta que solo diga "no puedo". Si el error es transitorio, mantener
    `pending` y ofrecer "reintentar"; si es de datos, limpiar y pedir el dato.
- "Sin excusas" en la práctica:
  - "Buscá tiendas que vendan lámparas en Madrid" → `buscar` automático con
    título/URL/snippet; el agente resume y cita fuentes.
  - "Llamá al comprador" → "Te dejo el mensaje de WhatsApp y el teléfono del
    contacto listos para copiar; ¿lo preparo?" (acción `crear_borrador` o texto).
  - "Mandá el mail" → "Preparo el borrador y te lo dejo para aprobar; cuando
    quieras lo mando. ¿Lo preparo?" (acción `crear_borrador` auto).
  - "Lanzá la misión" → propuesta + confirmación; después `lanzar_mision`.
  - "Subí el precio" → propuesta + confirmación; después `actualizar_producto`.

### 4.4 Transporte Telegram
- `sendTelegramText(settings, text, { chatId })`: divide en chunks de <=3500
  caracteres por párrafo, envía secuencial con ~1.1s entre mensajes; evita el
  truncamiento de 4000 de `sendTelegram` (que queda para avisos).
- `handleOwnerText` no debe truncar a 3800: devolver el texto completo y dejar
  que `sendTelegramText` divida. `pollTelegram` envía la respuesta con
  `sendTelegramText`, no con `sendTelegram`.
- `sendChatAction('typing')` antes de la consulta; si la IA tarda >6s, enviar
  "Estoy en eso..." y actualizar al responder.
- `pollTelegram` procesa cada update en una cola serial
  (`this.queue = this.queue.then(...)`) y confirma `offset` antes de procesar
  (ya lo hace); así un mensaje largo no pierde los siguientes.
- Solo el `chatId` configurado recibe flujo conversacional; otros chats se
  ignoran (comportamiento actual).
- Mensajes no-texto (voz/foto): responder una vez "Puedo trabajar con texto;
  escribime el pedido y lo resuelvo" y no reintentar.
- Errores de IA: reintentar una vez; si falla, responder con el estado
  determinístico (`/estado`) + el paso exacto para arreglar Ajustes → IA; nunca
  solo "no pude".

### 4.5 Seguridad y privacidad
- Historial solo del `chatId` dueño; no incluir claves/tokens en el contexto.
- Filtrar/redactar del historial cualquier texto que coincida con patrones de
  claves (`gsk_`, `tvly-`, `bot<digits>:`); no guardar el secreto.
- Acciones validadas contra allowlist; args con longitud/tipos acotados; un
  mensaje no ejecuta más de una acción.
- `enviar_borrador` reutiliza `sendThreadMessage`: respeta `suppressions`,
  `assertCanSend`, estado del borrador y `confirm`.
- `lanzar_mision` reutiliza `createMission`: respeta producto archivado, IA
  lista, modo demo/real.
- Registrar en `activity` la acción y el objetivo (no el texto completo).
- Excluir `telegramSessions` del backup seguro.

### 4.6 Tests y aceptación
- `tools/test-telegram.mjs` (sumar a `npm test` y `check`):
  - `parseAction` JSON embebido/fenced, tipo desconocido, args faltantes.
  - `buscar` devuelve resultados con fuentes; `query` vacía y `limit` capado.
  - `executeAction` auto vs confirm; `enviar_borrador` llama al handler con
    `confirm:true`; `lanzar_mision` llama a `createMission`; tipo desconocido.
  - `askPrompt` incluye historial y reglas; `askTeam` pasa history.
  - `Notifier.handleOwnerText` con `ask` falso: automática ejecuta; confirmable
    guarda pending; "confirmar" ejecuta; "cancelar" limpia; `/reiniciar`.
  - Error de IA: la respuesta incluye alternativa/estado, no solo el error.
  - "Llamá al comprador": ofrece `crear_borrador`/texto, no "no puedo".
  - Solo `chatId` dueño; otros chats ignorados.
- Aceptación:
  - Una charla de 5+ turnos mantiene el hilo ("lo anterior", "más corto").
  - Pide una solución → la entrega (texto, pasos o acción); si falta un dato,
    dice cuál y cómo conseguirlo.
  - Acción reversible → ejecutada; acción externa → confirmación de una palabra
    y resultado.
  - Ninguna acción externa sin confirmación; ninguna respuesta que solo diga
    “no puedo”.
  - `npm test` verde; Telegram responde sin cortar mensajes largos.

### 4.7 Apertura proactiva (opcional)
- Los avisos existentes (`notify`) pueden cerrar con una pregunta y una acción
  sugerida; el usuario responde y el agente la ejecuta.
- Reutilizar los eventos `mission_done`, `hot_reply` y `digest`; no crear
  notificaciones nuevas.
- Ejemplo: "Terminó España: 12 compradores, 3 calientes. ¿Preparo los mensajes
  para los 3?" → "sí" → `crear_borrador` automático.

---

## Fase 5 — Envío real (owner, fuera del código)

1. Comprar un dominio secundario (no el principal).
2. Configurar SPF, DKIM y DMARC; activar Resend con remitente en ese dominio.
3. Calentamiento de 14 días; Lumbre ya limita 10/día la primera semana
   (`lib/email.mjs:391-406`).
4. Webhook entrante: URL pública (Cloudflare Tunnel/ngrok) + token en Ajustes
   → Correo o `LUMBRE_WEBHOOK_TOKEN`.
5. Mientras tanto: `manual` + `.eml`, que ya funcionan.
- Criterio: correo de prueba en bandeja de entrada (no spam) en Gmail y Outlook.

---

## Fase 6 — Prueba de fuego

1. Lanzar misión de España con Tavily y el parche de verificación.
2. Abrir 5 compradores verificados a mano; confirmar sitio y email.
3. Enviar 3-5 mensajes reales (manual o Resend); registrar resultados en
   Aprendizajes.
4. Probar el agente de Telegram: estado, solución para un lead, borrador y
   envío con confirmación; verificar que mantiene el hilo.
5. Corregir lo que falle; recién después abrir México y EE.UU.
- Criterio: cero compradores fantasma en la muestra, cero rebotes y al menos
  una respuesta humana.

---

## Fuera del software (decisión del dueño)

- **Precio**: definir FOB o puesto en destino. Con flete ~USD 45 sobre un
  producto de USD 35, la exportación unitaria no cierra. La misión recomienda
  USD 89 FOB Buenos Aires / USD 65 interiorismo; usar ese número como base.
- **Certificación**: UE suele exigir marcado CE; EE.UU. UL o equivalente.
  Confirmar con despachante/laboratorio antes de escalar. Es la barrera real.
- **Material de venta**: fotos reales, ficha técnica PDF y packaging de
  exportación. Las 40 piezas siguen en “idea”.

---

## Orden de ejecución y dependencias

1. **Fase 0** (bloqueante; sin esto no se sigue).
2. **Fase 1 y Fase 2** en paralelo (código + datos del directorio).
3. **Fase 3** (robustez y CI).
4. **Fase 4** (agente de Telegram) cuando 1-3 estén verdes.
5. **Fase 5** (envío real) en paralelo desde el día 1 (el dominio tiene lead time).
6. **Fase 6** (prueba de fuego) cuando 1-5 estén verdes.
7. **Fuera del software**: decisión comercial en paralelo.

---

## Riesgos y mitigaciones

- Rotar claves corta misiones en curso: cancelar/lanzar después de rotar.
- `git filter-repo` reescribe hashes: hacer mirror de respaldo y avisar.
- Sitios del directorio cambian o cierran: `verify:directory` en cada corrida;
  el evaluador ya marca cierres.
- Cambio de esquema `pricing`: mantener compatibilidad con artifacts viejos.
- Créditos de Tavily: `search_depth` avanzado solo en prospección; agregar
  `search.prospectingDepth` configurable (default `advanced`).
- Modelo `qwen/qwen3.8-27b`: probar; si Groq no lo lista, usar
  `llama-3.3-70b-versatile` (ya está en el preset).
- Tests con red: eliminar el fetch real de `test-flow` con el evaluador puro.
- Telegram: latencia/coste de la IA → typing + reintento + fallback determinístico;
  acciones externas → allowlist + confirmación; historial privado → no backups
  seguros ni contexto con claves; rate limit → chunks de <=3500 chars.

---

## Validación (ejecutar en este orden)

1. `npm test` → todas las suites verdes, incluidas `test:verify` y
   `test:telegram`.
2. `npm run verify:directory` → 16 entradas OK o reemplazadas; Años Luz e
   Interlight con el dominio correcto.
3. `git check-ignore -v data/settings.json` → regla `data/`;
   `git ls-files data/` vacío; `git log --all --oneline -- data/` vacío.
4. Ajustes → Probar IA, Búsqueda y Telegram → OK.
5. Lanzar una misión real de España: log con `vía tavily`, sin `0 resultados`
   silenciosos, sin loops 413/429; compradores del directorio en “Por aprobar”.
6. Abrir 5 compradores a mano; enviar 3-5 mensajes; registrar en Aprendizajes.
7. Telegram: `/start`, `/ayuda`, `/reiniciar`; charla de 5+ turnos; pedir una
   solución; pedir una búsqueda y verificar que cita fuentes; acción
   automática; acción externa con “confirmar”; “llamá al comprador” debe
   ofrecer alternativa, no “no puedo”.

---

## Criterios de aceptación globales

- `npm test` verde en CI.
- `npm run verify:directory` → todas las entradas OK o reemplazadas.
- Sin claves en working tree ni en historial.
- Misión real: 0 compradores fantasma, 0 rebotes, ≥1 respuesta humana.
- Todo arancel/impuesto con badge “Confirmado en fuente” o “Hipótesis”.
- Borradores del directorio en “Por aprobar” por defecto.
- Token de WhatsApp estable entre reinicios.
- Copia sin claves descargable desde la UI.
- Telegram: charla fluida con memoria, soluciones concretas y acciones
  confirmadas; ninguna acción externa sin “confirmar” y ninguna respuesta que
  solo diga “no puedo”.