# ESTUDIO ”” ¿Va a funcionar Lucian con todo el catálogo cargado?

Fecha: 2026-11-19. Alcance: el flujo de automatización de ventas de Lucian y su
capacidad real para mover un catálogo completo de productos («todos los
artículos») asistido por agentes, con el dueño fabricando y los agentes haciendo
el resto: prospección, verificación, redacción, seguimiento y envío.

Este estudio se apoya exclusivamente en mediciones sobre los datos reales de
`data/` (productos, misiones, hilos, borradores, mensajes), en el código actual
y en las fuentes citadas al final. No se inventaron cifras. Donde un número no
está medido, se dice explícitamente.

---

## 1. Respuesta corta (veredicto)

**Sí, el motor aguanta un catálogo completo ”” pero "vender de manera masiva" no
es lo que va a pasar solo por cargar artículos.** Lucian ya hace bien la mitad
difícil y verificable: encontrar compradores reales, comprobar que existen,
escribir mensajes 1:1 correctos y no mentir en los informes. Lo que decide si
habrá ventas masivas está fuera del pipeline: (1) la reputación de tu dominio y
el envío automático, (2) tu decisión sobre 54 borradores que hoy esperan
aprobación, y (3) el cuello de botella humano para cerrar.

En números: 13 misiones reales han producido 108 prospectos verificados, 65
emails públicos, 18 hilos creados y 9 mensajes enviados. **Ventas cerradas: 0.**
No es un fallo del sistema ni una prueba de que funcione: la muestra de envíos
es demasiado pequeña (~9) para concluir nada sobre conversión. Lo que sí está
probado es que el sistema no inventa compradores, no repite contactos de forma
indestructible y no envía a quien no quiere.

Para "todos los artículos" hay que distinguir dos afirmaciones:

| Afirmación | ¿Soportada? | Condición |
|---|---|---|
| El catálogo completo puede entrar por CSV y generar una misión en cola por producto | **Sí, ya implementado y probado** | Productos en estado `listo` con precio/materiales |
| Las misiones pueden correr 20 seguidas sin saturar la IA ni la búsqueda | **Sí, con límites** | ~93k tokens y ~16”“23 créditos Tavily por misión; 2 misiones concurrentes |
| 100+ correos fríos saldrán en ráfaga el mismo día | **No, y es lo correcto** | Warmup 10→30/día, tope `dailyLimit`, 1 envío cada 5 min en piloto |
| Los agentes van a cerrar ventas solos | **No** | Hoy solo 2 hilos en `respondio` y 0 cierres; el cierre es humano |
| La bandeja se vaciará sola | **No si no aprobás los 54 borradores pendientes** | `listo`=34, `revisar`=20: ninguno sale sin decisión tuya (salvo piloto opt-in) |

La honestidad que importa: **Lucian es un equipo de ventas que redacta,
prospecta y hace seguimiento; no un cerrador automático.** Con la configuración
actual (email `manual`, sin dominio propio, warmup activo) el límite de
velocidad lo ponés vos.

---

## 2. Qué hace realmente el flujo hoy

Pipeline por misión (8”“13 pasos): brief → investigación de mercado →
prospección → enriquecimiento → aduanas/logística → precios → outreach (secuencia
y mensajes 1:1) → síntesis. En misiones completas además: contenido,
compliance (guarda dura), red team (advertencia fuerte, ya no bloqueo eterno),
revisión, learning y scoring.

Puntos clave del diseño verificado en código y datos:

- **Verificación antes de crear hilos**: el sitio debe existir y mencionar la
  tienda, o la fuente debe mencionarla. Genéricos, agregadores, fabricantes y
  cadenas se descartan con motivo. Los emails solo se aceptan si están
  publicados en el sitio (o con Hunter habilitado).
- **Dedupe de contactos** entre misiones: enfriamiento configurable
  (`mission.contactCooldownDays`, 90 días por defecto). Quedan fuera siempre:
  hilos activos, ya cerrados/perdidos, pidió baja, o con borrador pendiente.
  Motivos medidos de descarte histórico: 55 email + 32 empresa + 1 dominio
  = **88 de 108 prospectos** descartados antes del cambio (pre-catálogo).
- **Guardas de envío**: lista de supresión central (email/empresa/dominio, solo
  dominios explícitos; Gmail/Outlook nunca se bloquean por dominio), footer
  con baja y dirección física en cada correo, y en el piloto automático:
  etapas que vetan el envío (`respondio`, `interesado`, `negociando`,
  `ganado`, `perdido`) y espaciado global de 5 minutos entre envíos.
- **Seguimientos deterministas**: día 4 y día 10, texto sin precio
  (un precio viejo en un seguimiento es peor que no enviarlo), máximo 2,
  parada ante respuesta, baja o etapa activa.
- **Postventa determinista**: día 3 / día 30 / día 90 tras marcar ganado, sin
  precio, apaga el seguimiento frío. Solo para hilos ganados con email válido
  y no suprimidos.

---

## 3. Evidencia medida (datos reales en `data/`)

Productos: 1 («SIRI Velador (base alta)», estado `listo`). Misiones reales: **13**
(12 `done`, 1 `done_with_warnings`). Sin misiones demo en los datos.

| Indicador | Medido |
|---|---|
| Tokens totales (todas las misiones) | 1.206.067 |
| Tokens por misión (media / máx) | 92.774 / 125.221 |
| Llamadas a IA totales (~media/misión) | 129 (~10) |
| Duración de pasos por misión (media) | ~0,7”“2,6 min |
| Tiempo de pared 1.ª misión / 2.ª / resto | 251 min / 165 min / ~1 min |
| Prospectos verificados | 108 |
| Emails públicos encontrados | 65 |
| Hilos creados | 18 (62 hilos totales en bandeja) |
| Descartes pre-corrección | 88 (de 108 prospectos) |
| Borradores generados | 64 → 34 `listo`, 20 `revisar`, 3 `enviado`, 7 `descartado` |
| Mensajes salientes / entrantes | 9 / 6 |
| Tasa de respuesta observada | 2 hilos `respondio` + 4 `interesado` (de ~9 envíos) |
| **Ventas cerradas** | **0** |
| Cuota Tavily (observada en la sesión previa) | ~301 de 1000 créditos usados; ~699 restantes; ~16”“23 créditos/misión |

Detalle de tiempos: las dos primeras misiones tardaron 251 y 165 minutos de
pared con solo ~3 y ~2,6 minutos de pasos: el tiempo se lo llevó la espera del
proveedor (rate limits / pausas), no el pipeline. Las misiones posteriores
duraron ~1 minuto cuando el dedupe las bloqueó temprano o no hubo reintentos.
Conclusión operativa: **el pipeline no es el cuello de botella; el cupo de IA y
la decisión humana sí.**

Errores observados: 1 paso con error (`content` en una misión) y un aviso de
red team ”” ambos ya gestionados por el flujo (avisos, no caídas).

---

## 4. Modelo de capacidad para el catálogo completo (20 productos)

Supuesto explícito: catálogo de ~20 artículos en estado `listo` (si «todos los
artículos» significa otra cosa, ver §9). Escenario con la configuración actual
(`rapida`, `maxProspects: 12`, mercados España/México/EE. UU., rotación de
mercados en la campaña, `LUCIAN_MAX_MISSIONS=2`):

| Recurso | Estimado | Cálculo |
|---|---|---|
| Misiones en cola | 20 | 1 por producto (campaña `POST /api/campaigns`, estrategia `rotate`) |
| Cómputo total | ~30”“60 min de pasos | ~1”“3 min/misión × 20 ÷ 2 concurrentes |
| Pared realista | horas | Con reintentos 429/413 de Groq y pausas de equipo; las primeras misiones midieron 28”“252 min por corte de proveedor, no por cómputo |
| Tokens IA | ≈ 1,8”“2,5 M | 20 × ~93k (medido) + reintentos |
| Créditos Tavily | ≈ 320”“460 | 20 × ~16”“23 (medido). **Entra en los ~699 observados, pero justo**; si el mes está avanzado, recargá o sumá un segundo proveedor |
| Envíos fríos necesarios | ~100 (5/producto × 20) | 34 `listo` ya esperan de una sola misión; al escalar el patrón se reproduce |
| Tiempo mínimo de envío | **≥ 5”“10 días hábiles** | Warmup semana 1 = 10/día; semana 2 = 20/día; semana 3 = 30/día; tope `dailyLimit` = 20/día. El piloto además espacia 1 envío cada 5 min |
| Decisión humana | **54 borradores pendientes hoy** | 34 `listo` + 20 `revisar`. Nada sale sin tu decisión (salvo que actives el piloto) |
| Pool de compradores | Finito por mercado | El dedupe de 90 días evita repintar la bandeja, no crea compradores nuevos: para 20 productos con la misma categoría, los mercados rotan entre España/México/EE. UU.; si se agota un mercado, hay que ampliarlo (no inflar `maxProspects` sin límite) |

Lectura: **el sistema escala en generación (misiones, borradores,
seguimientos) casi linealmente y barato; escala en envío solo tan rápido como
tu reputación lo permita.** Para un catálogo nuevo, «masivo» significa semanas
siendo consistente y relevante, no un día de correos.

---

## 5. Lo que no va a funcionar (límites honestos)

Ni devastador ni superficial: estos son los límites reales, no apocalípticos.

1. **Cero ventas hasta hoy.** Con ~9 envíos no hay significancia estadística.
   Lo que está probado es la producción de pipeline verificado, no el cierre.
2. **Envío automático desactivado.** `email.provider: manual`, sin Resend
   (`resendKey` vacía) ni webhook ni SMTP; el warmup no corre en envíos
   manuales. Para que salgan solos: dominio con SPF/DKIM/DMARC + Resend (o
   webhook propio) + activar `email.autopilot: true`. Sin eso, "masivo" pasa
   por tu bandeja de aprobación.
3. **54 borradores sin decisión.** Es el cuello de botella operativo número 1.
   El piloto lo resuelve solo para los `listo` de Resend/webhook; los de
   canal formulario/LinkedIn y los `revisar` siempre son humanos.
4. **Reputación de dominio.** Un dominio joven que envía 100 fríos rápido cae
   en spam. El footer de baja + dirección física y el warmup son necesarios
   pero no suficientes; hacen falta DNS limpios y consistencia.
5. **Pool finito + dedupe.** El cooldown de 90 días evita molestias repetidas,
   pero con 13 misiones del mismo producto ya se descartaron 88 de 108
   prospectos. Con 20 productos, **cada misión nueva debe prospectar de verdad**
   (mercado y categoría distintos), no re-buscar "tiendas de lámparas Madrid".
   La caché de 24 h ahorra créditos en consultas idénticas, no genera demanda.
6. **Verificación ≠ intención de compra.** Que la tienda exista y publique su
   email no significa que compre multimarca. Por eso los compradores quedan
   **Por aprobar**: la confirmación de que es una tienda multimarca real es
   tuya, con una mirada de 10 segundos por hilo.
7. **La caché de búsqueda es persistente pero envejece**: se guarda en
   `<datos>/search-cache.json` y sobrevive reinicios (ahorra Tavily entre
   sesiones), pero caduca por TTL (24 h por defecto, máx. 168 h) y sigue sin
   medir cuota en vivo. Si en una semana hacés 20 misiones profundas, la
   cuota de Tavily se consume igual en las consultas distintas; la caché solo
   evita repetir.
8. **Groq 429/413.** Ya mitigado (reintentos con backoff, presupuesto
   creciente, espera de 20 s). Si el TPM de tu organización es bajo, mantené
   `LUCIAN_MAX_MISSIONS=2`; subir a 3”“4 solo con margen de cuota.
9. **Sin tracking de apertura/clic ni atribución.** Hoy no sabés qué emails
   abrieron ni qué misión cerró. Para "todo el catálogo" hace falta aunque sea
   UTM o un campo `origen` por campaña, o no podrás medir qué producto vende.
   Está en el backlog sugerido, no implementado.
10. **Una instancia de Lucian.** Si levantás dos servidores, el puerto
    autoincrementa y ambos escriben en los mismos datos. La limpieza de
    misiones huérfanas evita el daño grave, pero la operación correcta es
    una sola instancia.

Nada de esto es un defecto de producto: es la frontera entre un motor de
prospección y un departamento de ventas. Cruzarla es trabajo de configuración y
de cierre humano, no de más IA.

---

## 6. Mejoras aplicadas en esta ronda (verificadas)

Además de lo ya hecho en las rondas anteriores (ver
`docs/INVESTIGACION-CORRECCIONES.md`: búsqueda honesta, verificación de
compradores, robustez del JSON de IA, dedupe permanente→enfriamiento, guarda de
etapa en cola, espaciado global, reanudación de misiones `queued` al arrancar,
caché de proveedores pagos, campaña de catálogo con rotación de mercados,
importador CSV, piloto automático opt-in, seguimientos día 4/10, footer de
cumplimiento), esta ronda cerró los huecos que faltaban para el escenario de
catálogo completo:

1. **Guardia de etapa en el envío automático** (`BLOCKED_STAGES` en
   `lib/outbox.mjs`): `enqueueDraft` rechaza encolar borradores hacia
   `respondio`, `interesado`, `negociando`, `ganado` y `perdido`; y
   `processQueue` cancela el elemento si la etapa cambió después de encolar.
   Probado: 7 comprobaciones en `tools/test-scale.mjs` §7.
2. **Espaciado global entre envíos**: el piloto envía 1 por tick y además
   exige `autopilotSpacingMin` (por defecto 5 min) desde el último envío
   registrado en `meta.lastOutboxSendAt`, incluso tras reinicios.
   Probado: `tools/test-scale.mjs` §8.
3. **Misiones `queued` sobreviven al reinicio**: `releaseInterruptedMissions`
   solo libera `running` (nunca una misión que no empezó) y el arranque
   retoma automáticamente las `queued` en orden de creación
   (`resumeQueuedMissions` en `server.mjs`). Probado: `tools/test-flow.mjs`.
4. **Seguimientos coherentes con el piloto**: usan `canAutopilot()` (canal y
   etapa correctos) en vez del flag crudo; sin piloto quedan `revisar`.
5. **Cobertura de tests de escala**: `npm run test:scale` pasa de 25 a **37
   comprobaciones**; suite completa `npm test` → **EXIT=0** (búsqueda 26,
   núcleo, guardas 82, flujo 69, escala 37, API completo).
6. **Cobertura de importación CSV y campaña** en `tools/test-api.mjs`:
   importación con precio en coma decimal, dedupe por código, y
   `POST /api/campaigns` con rotación de mercados.
7. **`missionSummary` incluye `campaignId`/`campaignName`** para poder medir
   qué producto de la campaña trajo respuestas.
8. **Postventa (fidelización) realmente conectada**: al pasar un hilo a
   `ganado` (por el Analista, por Ajustes → Bandeja o por Telegram) arranca el
   reloj `postSaleAt`. El outbox prepara los toques día 3 (agradecimiento),
   día 30 (feedback + reseña/referido) y día 90 (reorden/novedades); sin
   piloto quedan «Por aprobar». El envío desde un hilo ganado ya NO agenda
   un seguimiento frío. Probado: 15 comprobaciones nuevas en
   `tools/test-scale.mjs` §10.
9. **Caché de búsqueda persistente**: `<datos>/search-cache.json` (500
   entradas, TTL ≤ 168 h, borrable con `clearSearchCache()`); sobrevive
   reinicios y ahorra créditos Tavily entre sesiones. Verificado en dos
   procesos consecutivos (segunda sesión: 0 llamadas de red).
10. **«Listo para funcionar» al arrancar**: consola con IA, datos, búsqueda,
    correo (manual/Resend/webhook + piloto), warmup/límite, Telegram,
    postventa, seguimientos, borradores esperando tu decisión, conversaciones
    abiertas y misiones retomadas. Sin secretos: solo booleanos y conteos.

Estado de la suite al cierre: `npm test` en verde (verificado 2026-11-19)
(búsqueda 26, guardas 82, flujo 69, escala 51, API completo).

---

## 7. Receta operativa para cargar todo el catálogo y vender

En orden, sin saltear pasos:

1. **Catálogo**: importá por CSV (Productos → «Importar CSV») con columnas
   `nombre,codigo,precio,costo,moneda,estado,materiales`; dejá `estado=listo`
   solo en lo fabricable hoy. Subí fotos.
2. **Correo**: dominio propio con SPF/DKIM/DMARC (no `gmail.com`); Resend con
   clave en Ajustes → Correo; mantené warmup y `dailyLimit: 20`. Verificá una
   dirección de prueba antes de cualquier envío masivo.
3. **Decidí el modo**: piloto OFF (aprobás cada borrador en la Bandeja) o
   piloto ON (solo para Resend/webhook; espaciamiento y warmup siguen
   imponiéndose). Para la mayoría de los catálogos nuevos: piloto OFF las
   primeras 2 semanas.
4. **Vaciar el backlog actual**: aprobá o corregí los 54 borradores de la
   bandeja primero; no mezcles decisiones viejas con la campaña nueva.
5. **Lanzar la campaña**: «Campaña de catálogo» → estrategia **Rotar**
   (recomendada) para no golpear a los mismos compradores con todo el
   catálogo el mismo día; mercados España/México/EE. UU. (o los que vendas);
   profundidad `rapida`.
6. **Mientras corre**: no abras múltiples instancias; dejá que la cola haga lo
   suyo. Revisá avisos (descartes con motivo, red team, sin compradores) ”” son
   información, no errores.
7. **Cierre**: cuando lleguen respuestas (etapa `interesado`/`respondio`),
   **la conversación es tuya**: ningún automático toca ese hilo. Cotizá,
   negociá, cerrá.
8. **Seguimientos**: con `email.followUps: true`, Lucian propone día 4 y día 10
   sin precio; aprobá o dejalos correr según tu modo.
9. **Medición mínima**: registrá por campaña qué pasó (respuesta / cotización /
   venta / baja). Si en 3 semanas no hay respuestas, el problema es
   entregabilidad o relevancia de la oferta, no el pipeline.
10. **Iteración**: ampliá mercados o profundizá (`profunda`) solo donde haya
    señales. El límite real es el tamaño de tu mercado atendido, no la IA.

Checklist de «listo para catálogo»: dominio con DNS ✔, Resend verificado ✔,
warmup día ✔, backlog de 54 borradores decidido ✔, ≥1 producto en `listo` ✔,
campaña rotada lanzada ✔, y un bloque en tu agenda para responder
`interesado`/`respondio` el mismo día.

---

## 8. Qué medir a partir de ahora (para saber si "funciona")

| Métrica | Objetivo de alerta | Dónde |
|---|---|---|
| % borradores aprobados sin edición | > 60 % | Bandeja → `listo` vs `revisar` |
| Tasa de respuesta (salientes → `respondio`+`interesado`) | > 5 % sano; < 2 % = revisar oferta/entrega | Hilos |
| Entregas fallidas / rebotes | ~0 | Resend/webhook logs |
| Bajas (respuestas BAJA) | < 1 % | Supresiones |
| Cotizaciones / ventas por campaña | > 0; sin esto no hay evidencia de venta | Anotación manual / `missionSummary` |
| Créditos Tavily/mes | < 80 % de la cuota | Cuenta Tavily |
| Hilos `perdido` con motivo "no sinergia" | informativo | Bandeja |

La métrica decisiva sigue siendo **ventas cerradas por producto de la
campaña**. Hasta tenerla, cualquier afirmación más fuerte sería de marketing,
no de evidencia.

---

## 9. Límite de alcance de este estudio

«Todos los artículos» se interpretó como **el catálogo completo de productos**
(la unidad que Lucian vende y lo que el flujo automatiza: misiones por
producto, campaña de catálogo, importación CSV). Si te referías a «artículos de
contenido» (posts, guiones, fichas), el alcance y las conclusiones cambian y
hay que rehacer el modelo; decime y lo ajusto.

Datos no verificados en vivo durante este estudio (se citan como observados en
sesiones previas, no como comprobación actual): cuota Tavily (~301/1000 usados),
respuesta de Gemini/Groq en vivo. Ninguna cifra de ventas fue estimada: son 0
medidos.

---

## 10. Fuentes

- RFC 8058 (List-Unsubscribe / one-click), https://datatracker.ietf.org/doc/html/rfc8058
- RFC 3676 (format=flowed; texto citado), https://datatracker.ietf.org/doc/html/rfc3676
- FTC, CAN-SPAM final rule (2008), https://www.federalregister.gov/documents/2008/05/21/E8-11394/definitions-and-implementation-under-the-can-spam-act
- ICO, Direct marketing guidance, https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/
- Suped, filtro de keywords de baja, https://www.suped.com/knowledge/email-deliverability/compliance/what-keywords-can-i-use-to-filter-reply-messages-for-unsubscribe-requests
- Ji et al., Survey of Hallucination in NLG, https://arxiv.org/abs/2202.03629
- SearXNG docs, https://docs.searxng.org/ · searx.space, https://searx.space/
- Stripe, idempotent requests, https://docs.stripe.com/api/idempotent_requests
- deepseek-chat API (finish_reason), https://api-docs.deepseek.com/api/create-chat-completion
- Estado anterior y rondas 1”“3: `docs/INVESTIGACION-CORRECCIONES.md` (misma base de fuentes)
- Mediciones: `data/products.json`, `data/missions.json`, `data/threads.json`,
  `data/outbox.json` (datos locales de Lucian; sin claves ni tokens citados)
