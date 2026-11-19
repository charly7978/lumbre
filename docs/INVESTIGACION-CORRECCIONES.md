# Investigación y decisiones — correcciones del flujo de Lumbre

Fecha: 2026-11-18. Objetivo: que el flujo cumpla lo que promete en los puntos
donde la revisión encontró fallas: opt-out, borradores, reintento, contactos
sin email y estados honestos.

## Hallazgos

### 1. Detección de bajas (opt-out)

- **Tema**: detectar “BAJA / no me escribas más” sin falsos positivos.
- **Fuente**: detector de opt-out de `nexo-rs-extension-marketing` (documentación de la crate, consultada 2026-11-18), https://docs.rs/nexo-rs-extension-marketing/0.28.0/nexo_marketing/unsubscribe/
- **Hallazgo**: usa un conjunto de palabras conservador a propósito porque el costo de un falso positivo es descartar un lead real; al detectar, pierde el lead y rechaza borradores pendientes.
- **Implicación**: no alcanza con buscar “baja” en cualquier parte. Hay que exigir intención y no destruir el borrador: la supresión se aplica al enviar y se puede revertir.
- **Confianza**: Alta.

- **Fuente**: Suped, “What keywords can I use to filter reply messages for unsubscribe requests?” (actualizado 2026-11-05), https://www.suped.com/knowledge/email-deliverability/compliance/what-keywords-can-i-use-to-filter-reply-messages-for-unsubscribe-requests
- **Hallazgo**: responder para darse de baja es solo un mecanismo humano de respaldo; el estándar para volumen es `List-Unsubscribe` (RFC 8058). La supresión debe ser central y respetarse en todos los sistemas; objetivo operativo 48 h.
- **Implicación**: Lumbre es 1:1 y de bajo volumen, así que conserva el pie “respondé BAJA” como respaldo humano, pero debe procesarlo con cuidado y mantener una lista de supresión central.
- **Confianza**: Alta.

### 2. Texto citado en respuestas

- **Fuente**: RFC 3676 (format=flowed), https://datatracker.ietf.org/doc/html/rfc3676
- **Hallazgo**: el texto citado se marca con `>` y profundidad de cita.
- **Implicación**: hay que descartar líneas `>` antes de detectar intención.
- **Confianza**: Alta.

- **Fuente**: `crisp-oss/email-reply-parser` (Node, v2.3.9), https://github.com/crisp-oss/email-reply-parser ; `email_reply_parser` (Rust), https://docs.rs/email_reply_parser/latest/email_reply_parser/ ; `trimail` (npm), https://www.npmjs.com/package/trimail
- **Hallazgo**: los parsers de respuestas separan cuerpo nuevo, firmas y cadena citada; reconocen “On … wrote:”, “El … escribió:”, “-----Original Message-----” y bloques `>`.
- **Implicación**: se implementó un limpiador sin dependencias con esos separadores. El pie propio (“Si preferís no recibir más mensajes, respondé BAJA…”) se elimina antes de analizar.
- **Confianza**: Alta.

### 3. Conservar la supresión y su alcance

- **Fuente**: FTC, CAN-SPAM final rule (2008), https://www.federalregister.gov/documents/2008/05/21/E8-11394/definitions-and-implementation-under-the-can-spam-act
- **Hallazgo**: la baja debe procesarse dentro de 10 días hábiles y no tiene límite de duración; el mecanismo debe seguir funcionando al menos 30 días.
- **Implicación**: la lista de no contactar no se borra automáticamente y se consulta en cada envío.
- **Confianza**: Alta.

- **Fuente**: ICO, guía de marketing directo, https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/
- **Hallazgo**: una lista de supresión no se considera marketing directo; el derecho a oponerse es absoluto y hay que dejar de usar los datos para marketing.
- **Implicación**: guardar email/empresa con motivo es correcto y necesario. Quitar una supresión es una decisión explícita del dueño, no automática.
- **Confianza**: Alta.

### 4. Normalización y dominios compartidos

- **Fuente**: `memql` digest.go (normalización de direcciones), https://github.com/znasllc-io/memql/blob/main/component/campaigns/digest.go
- **Hallazgo**: normaliza solo espacios y mayúsculas; advierte que bajar el local part es sobre-normalización, pero es la dirección segura en la práctica.
- **Implicación**: Lumbre usa `trim + lowercase`, sin quitar `+tags` ni puntos.
- **Confianza**: Media-Alta.

- **Decisión propia**: un email bloquea esa dirección, no todo el dominio. Bloquear el dominio requiere una acción explícita. Los dominios compartidos (Gmail, Outlook) nunca se usan para bloquear por dominio. Evita bloquear empresas enteras por error.

### 5. Reintentos idempotentes y reconciliación

- **Fuente**: Stripe, “Idempotent requests”, https://docs.stripe.com/api/idempotent_requests
- **Hallazgo**: un reintento debe poder repetirse sin duplicar el efecto; se usa una clave estable y se devuelve el mismo resultado.
- **Implicación**: la sincronización de hilos se keyed por `missionId` + email/empresa. `reconcileThreads` es idempotente: actualiza los borradores existentes, no crea duplicados y puede llamarse desde reintento o desde “Revalidar borradores”.
- **Confianza**: Alta.

- **Decisión propia**: si un borrador ya aprobado cambia de contenido, vuelve a “Por aprobar”. Es la única forma de que la aprobación siga significando algo.

### 6. RFC 8058 (una-click unsubscribe)

- **Fuente**: RFC 8058, https://datatracker.ietf.org/doc/html/rfc8058
- **Hallazgo**: define `List-Unsubscribe` + `List-Unsubscribe-Post` con POST HTTPS y DKIM que cubra ambos encabezados; aplica a listas y requisitos de remitentes masivos (Gmail/Yahoo).
- **Decisión**: Lumbre hace contacto 1:1 de bajo volumen y no implementa los encabezados de una-click ahora. Mantiene el pie de baja, la detección de respuestas y la supresión central. Si el volumen crece, el siguiente paso es agregar los encabezados al envío por Resend/webhook y un endpoint de baja con token.

## Diseño aplicado

1. **Opt-out seguro**: limpiar citas y pie propio; exigir frases de intención; nunca borrar el borrador, solo marcar la conversación y suprimir; reversión desde Ajustes que devuelve borradores a revisión.
2. **Mensajes 1:1**: sin fallback al mensaje de otra tienda; si no hay mensaje, el hilo queda para escribirlo a mano.
3. **Revisión real**: se fusiona revisión post red team, se aplican correcciones literales de cumplimiento y se distingue `revisionApplied` por provenance del cuerpo.
4. **Reconciliación**: reintentar o “Revalidar borradores” actualiza los borradores existentes; una aprobación vieja se invalida si el contenido cambió.
5. **Migración v2**: los borradores históricos sin guardas se marcan para revisión si falta la revisión de la misión o si comparten cuerpo con otro hilo de la misma misión. Es idempotente.
6. **Contactos sin email**: el envío manual se permite sin dirección (formulario/LinkedIn); Resend/webhook y `.eml` siguen exigiendo email.
7. **Aislamiento demo/real**: hilos y supresiones demo no bloquean misiones reales; aprendizajes demo no entran en misiones reales.
8. **Webhook**: token con comparación de tiempo constante; sin token solo loopback y sin cabeceras de proxy/túnel.

## Verificación

- `npm test` incluye sintaxis, búsqueda, core, 80 guardas, flujo y API temporal.
- Prueba end-to-end de misión demo: 7 hilos, 7 cuerpos únicos, correcciones aplicadas, sin seguimientos prematuros.
- Pruebas de API: falso opt-out por cita, baja real + bloqueo + reversión, envío manual sin email, aprobación, reconciliación, supresión por email/dominio/empresa y webhook con cabecera de proxy.

---

# Ronda 2 — ventas reales y cero mentiras (2026-11-19)

Objetivo: que una misión real produzca compradores comprobables y mensajes
enviables, y que la app nunca presente datos inventados como resultados.

## Hallazgos (evidencia local, reproducible)

### 1. La búsqueda sin clave devolvía 0 resultados en silencio

- **Medición**: las misiones reales `mis_6db79905b862`, `mis_683b205a3a45`,
  `mis_9a29d34e94c8` y `mis_31c5b02ed803` registraron **0 resultados en todas
  las consultas**. El log decía “Fuente: … → 0 resultados” y la misión seguía
  como si hubiera investigado.
- **Causa**: `html.duckduckgo.com` y `lite.duckduckgo.com` responden **HTTP 202**
  con una verificación anti-bots (`anomaly.js`, “Unfortunately, bots use
  DuckDuckGo too”); el parser no encontraba resultados y devolvía `[]`, sin
  error. Bing devolvía resultados degradados/no relacionados desde esta red;
  Google devolvía una página de “problemas para acceder” sin resultados.
- **Fuente de la solución**: SearXNG documenta su API HTML y sus instancias
  públicas (https://docs.searxng.org/, https://searx.space/). Se verificó que
  las instancias públicas devuelven resultados reales (p. ej. Ideas Luz,
  Avanluce, Insolit BCN, Lámparas Barcelona) pero limitan consultas por IP.
- **Decisión**: búsqueda sin clave = rotación de instancias SearXNG (lista fija
  verificada + directorio de searx.space cacheado 6 h), caché de consultas,
  y DuckDuckGo solo como último recurso. Si un motor bloquea o no hay
  resultados, el error se registra y la misión lo muestra. Para uso serio se
  recomienda Tavily/Brave/Serper o una instancia propia (`search.searxUrl`).

### 2. El JSON de IA se truncaba por límite de tokens

- **Medición**: con `maxTokens: 3200`, una llamada real a DeepSeek para el
  paso red team devolvió **exactamente 3200 tokens de salida** y un objeto
  cortado a mitad de string (“…lo report…”). El paso fallaba con “El modelo no
  devolvió JSON válido después de varios intentos”. En las misiones reales
  fallaron `redteam` y `compliance`.
- **Fuente**: la API de chat de DeepSeek acepta `max_tokens` y devuelve
  `finish_reason: length` cuando corta (https://api-docs.deepseek.com/api/create-chat-completion);
  el mismo campo existe en OpenAI (https://platform.openai.com/docs/api-reference/chat/object).
- **Decisión**: el límite por defecto sube a 8192; `chat()` devuelve
  `finishReason`; `generateJson()` detecta `length`/`max_tokens` y reintenta
  con presupuesto creciente (hasta 16000) y una instrucción de brevedad, en
  vez de reintentar con el mismo límite. La UI explica cómo subirlo.

### 3. La app creaba conversaciones con compradores inventados

- **Medición**: la misión real `mis_0e02b63a3658` creó **6 hilos** con nombres
  “Tienda de diseño independiente (ejemplo genérico, sin nombre verificable)”,
  “Hotel boutique (ejemplo genérico…)”, etc., sin web ni email. La misión
  `mis_fd976e97ac32` creó un hilo para `idealo.es`, un comparador de precios.
- **Causa**: el prompt pedía nombres reales, pero nada en el código impedía
  que un nombre genérico terminara en la bandeja. El modelo rellenó la lista y
  el flujo lo aceptó.
- **Fuente**: la literatura sobre alucinaciones en LLM recomienda verificación
  externa para afirmaciones verificables (Ji et al., “Survey of Hallucination
  in Natural Language Generation”, https://arxiv.org/abs/2202.03629).
- **Decisión**: verificación obligatoria antes de crear hilos: el sitio debe
  existir y mencionar la tienda, o la fuente citada debe mencionarla. Se
  descartan genéricos, agregadores, fabricantes/cadenas (lista explícita) y
  sitios cerrados. Los emails solo se aceptan si están publicados en el sitio.
  Las misiones sin compradores verificados terminan con aviso y lo dicen.

### 4. Los hilos históricos seguían “vendibles”

- **Decisión**: migración `sanitizeLegacyThreads`: marca **Sin verificar** los
  hilos reales sin email ni sitio; los que eran nombres genéricos pasan a
  `perdido` y sus borradores a `descartado`. No se borra nada y es idempotente.

### 5. La prospección llegaba al final de la cuota de búsqueda

- **Causa**: investigación + aduanas consumían las instancias antes de
  “Compradores concretos”, el paso que decide si hay ventas.
- **Decisión**: la prospección pasa a ser el paso 3 del pipeline (después de
  investigación), con más intentos de búsqueda; aduanas y precios usan menos
  consultas. Además, si la búsqueda falla, entra un **directorio semilla** de
  tiendas reales de los mercados elegidos (verificado el 2026-11-19: Ideas Luz,
  Años Luz, Avanluce, Insolit BCN, Lámparas Barcelona, La Maison Barcelona,
  Mar de Cava, Pilight, MINIM, Barcelona LED, Iluminación Agüero, GA
  Iluminación, Scultura Luminosa, Diez Company, Interlight y Luminaire).
  El directorio no trae emails: también se verifica en vivo y el email se
  descubre en el sitio.

## Diseño aplicado (ronda 2)

1. **Búsqueda honesta**: `searchWebDetailed` devuelve resultados + motor +
   errores; filtro de relevancia contra la consulta; bloqueo anti-bots
   detectado y reportado; caché y rotación de instancias.
2. **Verificación de compradores**: `verifyProspectArtifact` (sitio + nombre +
   fuente + descartes con motivo) y `verifyWebsite`/`inspectSite` cacheados.
3. **Contactos**: solo emails publicados o Hunter habilitado; los del modelo
   se descartan si no están publicados.
4. **Cierre honesto**: aviso `no-prospects`/`no-threads`, `stats.prospects`
   solo verificados, actividad y notificación dicen “0 compradores: no hay a
   quién venderle todavía”.
5. **IA robusta**: `maxTokens` 8192 por defecto, escalado hasta 16000 al
   detectar corte, 4 intentos en pasos largos.
6. **UI honesta**: badge “Sin compradores”, aviso de descartes con motivos,
   badges “Sin verificar” en la bandeja y estado de verificación del sitio.

## Verificación (ronda 2)

- `npm run test:search`: 22 comprobaciones (parser SearXNG, desafío DDG,
  filtro de relevancia, emails de ejemplo, errores honestos).
- `npm run test:flow`: 61 comprobaciones (genéricos, agregadores, fabricantes,
  directorio, migración de hilos, avisos de sin compradores, red team
  "detener", aprobación explícita y trazabilidad).
- `npm run test:guards`: 80 comprobaciones (guardas originales intactas).
- `npm run test:api`: API completa con misión demo y flujos de envío.
- Prueba real end-to-end con DeepSeek + verificación de sitios: se documenta
  en la respuesta final con los resultados obtenidos.

## Corrección posterior a la primera prueba real

La primera misión real con la búsqueda y el directorio arreglados verificó
**12 compradores reales con sitio activo y 10 emails públicos** (Pilight Shop,
Lámparas Barcelona, La Maison Barcelona, Barcelona LED, Button Lighting Store,
Ideas Luz, Años Luz, Avanluce, Insolit BCN, Mar de Cava, MINIM, Scultura
Luminosa), creó 12 hilos y escribió 12 mensajes 1:1. Pero el red team leyó el
contexto truncado y afirmó “cero compradores verificados con nombre”; su
veredicto `detener` bloqueó los 12 borradores aunque la misión decía `done`.

Decisiones:
1. **Lista compacta de compradores verificados** en los prompts de outreach,
   cumplimiento, red team y plan final (`verifiedBuyersBlock`). Con la lista
   completa, el red team pasó de `detener` a `ajustar` y dejó de afirmar que no
   había compradores (prueba repetida con el mismo contexto: 10,6 s, 11.974
   tokens).
2. **`detener` del red team es una advertencia fuerte, no un bloqueo eterno**:
   los borradores quedan **Por aprobar** con el motivo; el dueño puede corregir
   o asumir el riesgo y aprobar. Un rechazo de cumplimiento sigue siendo
   bloqueo duro.
3. **La aprobación es explícita y estable**: se guarda `approvedReviewKind`;
   revalidar respeta la aprobación mientras el texto y la advertencia no
   cambien. Editar el texto de un borrador aprobado lo devuelve a revisión.
4. **Cierre honesto**: un `detener` del red team, un rechazo de cumplimiento o
   cero compradores agregan un aviso y la misión pasa a **con avisos**; ya no
   puede quedar `done` con todo bloqueado.
5. **Reintentar** una misión sin compradores vuelve a prospectar y reconstruye
   los pasos dependientes, para que un arreglo de búsqueda no obligue a crear
   una misión nueva.

## Límites conocidos

- Las instancias públicas de SearXNG limitan consultas y pueden fallar; el
  camino estable es una clave de Tavily/Brave/Serper o una instancia propia.
- El directorio semilla es finito y hay que revisarlo cada tanto; cada
  entrada se verifica en vivo y se descarta si el sitio no responde.
- La verificación de una tienda comprueba existencia y nombre, no su política
  de compras. Por eso los compradores propuestos por conocimiento del modelo
  quedan **Por aprobar** hasta que el dueño confirme que es una tienda
  multimarca.
