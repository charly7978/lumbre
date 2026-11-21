# Director Comercial IA — implementación inicial (21/11/2026)

## Qué hace
Desde **Productos → Estrategia IA** o **Ventas → Director comercial IA**, seleccionar una lámpara, un mercado concreto y un segmento. Al confirmar, Lucian realiza dos búsquedas, entrega hasta ocho fuentes verificadas y solicita a la IA un informe con:

- Diagnóstico, propuesta evaluable y perfil del comprador.
- Hipótesis y piezas para Instagram, TikTok, Pinterest, catálogo propio y negocios B2B.
- Acciones priorizadas con métricas y guion de video vertical.
- Borrador de correo B2B **sin enviar**, alertas y datos técnicos pendientes.
- ID y URL de las fuentes encontradas. Las referencias inventadas por el modelo se descartan.

El resultado no se publica, no modifica productos, no crea misiones ni registra ventas.

## Control automático de borradores nuevos
Las misiones reales creadas tras instalar esta rama activan `commercialQualityReview`. Un borrador que admita no tener propuesta, que solo pida permiso para enseñar una ficha o que presente afirmaciones ambientales no verificadas queda marcado `revisar` antes de cualquier aprobación. El auditor no reemplaza la revisión humana ni verifica consentimiento de contacto. Para conservarlo, usar «Copiar informe completo». Las búsquedas y el modelo pueden consumir créditos y requieren configuración operativa.

## Condiciones de comercialización

1. Sin ficha pública, fotografías, medidas, precios o materiales completos, la propuesta es preliminar y se indica que debe revisarse.
2. La información de la IA es una hipótesis hasta contrastarla: que exista un competidor o tienda en resultados no demuestra demanda ni ventas.
3. Una dirección de contacto hallada en la web **no es consentimiento**. Las campañas de correo requieren base legal y respetar la política del proveedor. Los correos fríos por Resend no deben automatizarse.
4. El PLA de origen vegetal no habilita afirmaciones de "ecológico", "biodegradable" o "compostable" sin pruebas.
5. No se asume que un diseño es original, licenciado o apto para exportación sin documentación.
6. El precio del catálogo es referencial; verificar el margen y las condiciones reales de venta antes de publicar.

## Plataformas y conexión pendiente

- **Instagram:** publicar exige cuenta profesional y permisos de publicación en Meta. Los videos requieren URL pública y flujo de creación/publicación de contenedor. Documentación: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- **TikTok:** la Content Posting API requiere autorización y auditoría para publicaciones públicas; clientes sin auditar quedan restringidos a publicaciones privadas. https://developers.tiktok.com/docs/en/content-posting-api-get-started
- **Google Merchant Center:** disponibilidad, precio y fichas públicas deben coincidir con los datos enviados. https://support.google.com/merchants/answer/6324448
- **WhatsApp Business:** los mensajes salientes fuera de la ventana de atención requieren plantillas aprobadas y la autorización pertinente. https://whatsappbusiness.com/products/business-platform-features/

No se simula que existan estas conexiones. Esta etapa investiga y genera planes; la publicación, estadísticas de campañas, cobros y facturación son trabajos posteriores.

## Verificación técnica
```bash
cd lumbre
npm run check
npm run test:commercial
npm run test:commercial-quality
npm run test:commercial-http
npm test
```

## Despliegue prudente

Esta rama deriva de `fix/lumbre-seguridad-envios-20261120` y no reemplaza los paquetes V5–V9 que puedan estar instalados localmente. **No copiar archivos completos al Lucian que contiene 33 lámparas sin comprobar primero sus versiones y hacer respaldo.** La rama principal no se modifica automáticamente.

### Cómo medir si sirve para vender
- Número de fichas públicas evaluables.
- Consultas cualificadas por canal y por lámpara.
- Propuestas entregadas, cotizaciones aceptadas y pedidos efectivamente cobrados.
- Margen neto real por canal, una vez conectados los datos de costos y pagos.
