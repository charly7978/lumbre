# Empeza aqui

No ejecutes mas scripts. Las tablas ya estan creadas en tu base de Airtable. Solo quedan tres pasos: importar la configuracion, cargar un producto y subir los escenarios a Make.

La guia detallada esta en `PLAN-B-SIN-TERMINAL.md`.

## 1. Importar configuracion

1. Abri Airtable y entra a la base **Untitled Base** que tiene las tablas Productos, Leads, Outbox, etc.
2. Abri la tabla **Config**.
3. Click en **+** o **Add or import** > **CSV file**.
4. Subi `config.csv`. Verifica que `Clave` y `Valor` esten mapeados.
5. Import.

Despues edita en Config: `marca`, `web`, `email_remitente`, `firma`, `direccion_fisica` y `propuesta_valor`.

## 2. Cargar un producto

1. Abri la tabla **Productos**.
2. Importa `producto-ejemplo.csv` de la misma forma.
3. Edita el registro con tu producto real: nombre, precio, descripcion, medidas, link de fotos.
4. Adjunta fotos en **Fotos**.
5. Cambia `Estado` a **Activo**.

## 3. Importar en Make

En Make: **Scenarios > + Create a new scenario**. En el editor, tres puntos (**...**) > **Import blueprint**.

Crea un escenario nuevo para cada archivo:

1. `LISTO-01-motor-comercial.blueprint.json`
2. `LISTO-02-envio-aprobado.blueprint.json`
3. `LISTO-03-bandeja-respuestas.blueprint.json`
4. `LISTO-04-marketing-contenido.blueprint.json`

Selecciona tu conexion de Airtable en los modulos de Airtable. La base y las tablas ya estan configuradas.

## 4. Probar

1. Ejecuta el 01 con **Run once**. Deberia crear borradores en `Outbox`.
2. Aprueba uno cambiando `Estado` a **Aprobado**.
3. Ejecuta el 02. Deberia enviarlo.
4. Responde el correo y ejecuta el 03. Deberia crear una fila en `Conversaciones`.
5. Ejecuta el 04. Deberia crear piezas en `Contenido`.

## 5. Activar

- 01 Motor Comercial: diario 08:00.
- 02 Envio Aprobado: cada 6 horas.
- 03 Bandeja de Respuestas: cada 15 minutos.
- 04 Marketing: lunes 09:00.

No vuelvas a ejecutar `CONFIGURAR.cmd` ni `airtable_setup.mjs`. Ya no son necesarios.
