# Auditoría comercial Lumbre — 19 noviembre 2026

Esta mejora mantiene intacto el carácter **local-first** y el envío con aprobación humana.

## Qué cambia

- Ficha de producto: capacidad semanal, plazo de fabricación y cantidad mínima. Puntaje orientativo de preparación (8 controles, dos críticos) y advertencias al lanzar misiones; no se inventan capacidades.
- Seguimiento del consentimiento con fuente registrada y fecha. El canal Resend se limita a destinatarios cuyo consentimiento se documentó. Un correo público no implica consentimiento.
- Envíos por Resend usan una clave estable de idempotencia. Un candado en memoria previene envíos simultáneos del mismo borrador dentro del proceso. Ante corte ambiguo, verificar el panel del proveedor antes de reintentar: su idempotencia tiene ventana limitada.
- WhatsApp: se exige firma HMAC SHA-256 sobre los bytes exactos del POST. Configurar la variable `LUMBRE_META_APP_SECRET` con el secreto de la aplicación Meta; sin ella el webhook retorna 503. No colocarla en un repositorio.

## Lo que NO está automatizado

No hay checkout, cobro, factura, reservas de stock, órdenes de producción ni integración con Shopify o Mercado Pago. No se probaron envíos externos con cuentas reales. La prospección web depende de disponibilidad de buscadores, API y verificación. No se debe interpretar un borrador generado como venta.

## Antes de iniciar campañas reales

1. Completar datos del producto y confirmar capacidad de producción.
2. Verificar manualmente compradores, precios, aranceles, certificaciones y tiempos de envío.
3. Configurar IA y buscador confiable; ensayar una misión real a escala reducida.
4. Iniciar captación de consentimientos por web, redes y formularios; registrar su origen en el contacto.
5. Configurar dominio autenticado, dirección de respuesta y webhook de recepción.
6. Registrar métricas de oportunidades, cotizaciones, ventas confirmadas, margen y tiempos de entrega.

Referencias: https://resend.com/legal/acceptable-use y https://resend.com/changelog/idempotency-keys; https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/
