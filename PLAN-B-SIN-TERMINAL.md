# Plan B: sin terminal, sin tokens, sin scripts

Las 8 tablas ya estan creadas en tu base `appkk3JHBiWrBn4UF`. No hace falta ejecutar nada mas en la computadora. Solo quedan tres cosas: importar la configuracion, cargar un producto y subir los escenarios a Make.

## 1. Importar la configuracion en Airtable

1. Abri Airtable y entra a la base **Untitled Base** que tiene las tablas Productos, Leads, Outbox, etc.
2. Abri la tabla **Config**.
3. Arriba o abajo de la tabla, busca el boton **+** o **Add or import**.
4. Elegi **CSV file** y subi el archivo `config.csv` de esta carpeta.
5. Airtable muestra las columnas. Verifica que `Clave` vaya a **Clave** y `Valor` a **Valor**.
6. Click en **Import**.

Si Airtable te ofrece crear una tabla nueva, elegi importar dentro de la tabla **Config** existente. Si no te deja, avisame y lo hacemos de otra forma.

## 2. Editar la configuracion

En la tabla **Config**, cambia los valores que dicen "COMPLETAR":

- `marca`: nombre de tu marca.
- `web`: tu web o Instagram.
- `email_remitente`: el email desde el que vas a enviar.
- `firma`: tu nombre, cargo, telefono y web.
- `direccion_fisica`: tu direccion postal (obligatoria para CAN-SPAM).
- `propuesta_valor`: que hace unica a tu lampara.

No toques las otras filas: son los limites y las reglas de los agentes.

## 3. Cargar un producto

1. Abri la tabla **Productos**.
2. Importa `producto-ejemplo.csv` de la misma forma que el CSV anterior.
3. Abri el registro creado. Editalo con tu primer producto real:
   - Nombre, SKU, descripcion corta y larga.
   - Precio, moneda, material, medidas, colores, plazo y capacidad.
   - `Link_ficha`: la URL de la pagina o publicacion con las fotos.
   - Adjunta las fotos en el campo **Fotos**.
4. Cambia `Estado` de **Borrador** a **Activo**.

El agente solo lee productos con Estado = Activo. Si no hay ninguno, no va a crear borradores.

## 4. Importar los escenarios en Make

En Make: **Scenarios > + Create a new scenario**. En el editor, tres puntos (**...**) > **Import blueprint**.

Crea un escenario nuevo para cada archivo, en este orden:

1. `LISTO-01-motor-comercial.blueprint.json`
2. `LISTO-02-envio-aprobado.blueprint.json`
3. `LISTO-03-bandeja-respuestas.blueprint.json`
4. `LISTO-04-marketing-contenido.blueprint.json`

En cada uno, selecciona tu conexion de Airtable en los modulos de Airtable. La base y las tablas ya vienen configuradas con los IDs reales.

## 5. Probar

1. Ejecuta el 01 con **Run once**. Deberia crear hasta 3 borradores en `Outbox`.
2. Abri `Outbox`, revisa un borrador y cambia `Estado` a **Aprobado**.
3. Ejecuta el 02 con **Run once**. Deberia enviar el correo y avisarte por Telegram.
4. Responde ese correo desde otra casilla y ejecuta el 03. Deberia crear una fila en `Conversaciones`.
5. Ejecuta el 04. Deberia crear piezas en `Contenido`.

## 6. Activar

- 01 Motor Comercial: diario 08:00.
- 02 Envio Aprobado: cada 6 horas.
- 03 Bandeja de Respuestas: cada 15 minutos.
- 04 Marketing: lunes 09:00.

## Importante

No vuelvas a ejecutar `CONFIGURAR.cmd` ni `airtable_setup.mjs`. Ya no son necesarios: las tablas existen y los blueprints ya tienen los IDs reales. Si algo falla, el problema esta en la importacion de Make o en la conexion de Airtable, no en la base.
