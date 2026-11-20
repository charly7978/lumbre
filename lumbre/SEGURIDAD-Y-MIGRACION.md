# Correcciones de seguridad y envíos (20-11-2026)

Esta rama contiene correcciones de seguridad y de canales de venta para **Lucian**, que vive en `lumbre/`.
La versión histórica `/server.mjs` (Lumbre raíz) permanece por compatibilidad con archivos `/data/` locales.
**No borrar, mezclar ni sobrescribir** las carpetas `data/` y `lumbre/data/` sin respaldo y una migración verificada.

## Qué cambia

- El panel desde LAN, Cloudflare y ngrok exige autenticación para todas las rutas `/api/*`.
- `Host: localhost` no basta para saltarse el control si hay indicios de proxy o la conexión no es loopback.
- Se eliminó el transporte de la clave por `?access=...`; el navegador solicita la clave y el servidor fija una cookie HttpOnly / SameSite=Strict (Secure en HTTPS).
- Los eventos POST de WhatsApp se rechazan a menos que lleven una firma Meta HMAC-SHA256 válida, calculada sobre los bytes **originales**.
- Resend exige consentimiento explícito documentado por dirección de correo; una dirección pública/verificada NO equivale a consentimiento.
- Resend incorpora `idempotency-key` persistente por conversación y borrador; el mismo borrador conserva su Message-ID al reintentarse.
- El piloto automático únicamente encola mensajes para contactos con consentimiento documentado (incluso si utiliza otros proveedores).
- Los iniciadores `.cmd` de Lucian no dependen de carpetas personales ni cierran todos los procesos de Node.
- GitHub Actions quedó configurado para ejecutar la batería en Node 20 y 22. La ejecución remota **no está verificada**: los jobs GitHub aparecen sin runner asignado ni pasos ejecutados. La batería sí pasó localmente en Node 22. Ninguna prueba debe contactar destinatarios reales.

## Configuración necesaria

En la PC que ejecuta Lucian:

1. Para uso local, iniciar `lumbre/INICIAR-LUCIAN.cmd` o `INICIAR-LUCIAN.cmd` desde la raíz.
2. Para LAN, usar `lumbre/INICIAR-LUCIAN-COMPARTIR.cmd`; la clave se muestra en la consola del servidor. No reenviar puertos del router a Internet: en LAN el transporte es HTTP y no cifra la clave.
3. Para un túnel temporal, disponer de `cloudflared` oficial en el PATH o en `lumbre/cloudflared.exe` y ejecutar `ABRIR-LUCIAN-DESDE-CUALQUIER-LUGAR.cmd`. Compartir **solo** la URL HTTPS. Ingresar la clave **mostrada en la consola LUCIAN-SERVIDOR** en el cuadro del navegador. El script habilita `LUCIAN_REQUIRE_AUTH=1` y se detiene si el puerto 4321 está ocupado.
4. Para un túnel con dominio propio, escribir el dominio en `lumbre/DOMINIO.txt`, configurar el túnel Cloudflare `lucian` y ejecutar `lumbre/INICIAR-LUCIAN-FIJO.cmd`. El script establece `LUCIAN_PUBLIC_HOST` y `LUCIAN_REQUIRE_AUTH=1`.
5. Para recibir WhatsApp Cloud API, definir las variables de entorno `META_APP_SECRET` y `META_VERIFY_TOKEN` con los valores reales de la aplicación Meta. El App Secret es distinto del access token de WhatsApp. No publicar ninguno en Git.
6. Opcional: establecer `LUCIAN_ACCESS_TOKEN` con una clave aleatoria de **al menos 20 caracteres** si se quiere mantener el mismo acceso tras reiniciar. Si no se establece, se genera una clave nueva y se muestra en la consola.
7. Antes de enviar por Resend, editar el contacto y registrar una evidencia verificable del consentimiento previo. El sistema no debe marcar automáticamente contactos prospectados como consentidos.

### Resend y prospección

La política vigente de Resend prohíbe la prospección fría no solicitada y las listas obtenidas por scraping. Ver: https://resend.com/legal/acceptable-use .
**No se debe convertir un contacto público o prospectado en 'opted_in' salvo que realmente haya concedido permiso explícito.**
Para contactos sin permiso se pueden preparar borradores para revisión y utilizar otros canales de comunicación de forma compatible con sus normas y legislación aplicable. No se autoriza el envío masivo a personas no consentidas.

## Pruebas

En Windows se puede hacer doble clic en **`PROBAR-LUCIAN.cmd`** desde la raíz o desde `lumbre/`. Deja la ventana abierta y muestra el resultado. No envía correos ni activa campañas.

Desde `lumbre/`:

```powershell
npm run check
npm run test:security
npm test
```

La prueba de seguridad simula el túnel mediante encabezados HTTP y firma mensajes Meta localmente. No crea túneles ni envía correos reales. La integración HTTPS/Meta/Resend requiere comprobación separada usando las credenciales y el dominio legítimos.

## Estado de las comprobaciones

- Copia local del código de GitHub verificada mediante hashes de archivo: `server.mjs`, `lib/email.mjs`, `lib/outbox.mjs`, `lib/security.mjs`, `public/app.js`, `package.json` y pruebas.
- `npm run test:security` y `npm test` terminan con resultado correcto en Node.js 22 local. Estas comprobaciones utilizan servicios simulados; no constituyen una prueba de ventas ni entregabilidad real.
- GitHub Actions devuelve fallos sin runner asignado (`runner_id=0`, `steps=[]`). Es necesario solucionar la disponibilidad/permisos/facturación de runners desde GitHub antes de exigir CI verde para la fusión.
- Se retiraron de la raíz workflows de plantilla de Webpack y Terraform sin configuración en este repositorio; se conserva exclusivamente el workflow pertinente de tests.

## Pendientes fuera de esta primera intervención

- Migración respaldada y validada de datos de Lumbre raíz hacia Lucian; no se ha realizado.
- Conciliación de la bandeja de salida ante cortes de energía y respuestas ambiguas de proveedores; la idempotencia evita reenvíos idénticos en el período admitido por Resend, pero no reemplaza el seguimiento transaccional.
- Integración real de pedidos, pagos confirmados, stock/capacidad productiva, facturación y logística; no se considera implementada.
- Revisión final de seguridad del túnel, cookies, CSP, proveedores y retención de datos en un entorno real.

La aplicación debe probarse antes de fusionar este PR y ponerse en producción. No usar `main` como entorno de pruebas.
