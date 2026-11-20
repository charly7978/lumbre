# Diagnóstico honesto del flujo anterior (Airtable + Make)

## Qué era

El sistema anterior es un conjunto de 4 escenarios de Make (`01` a `04`, versiones `LISTO-*`)
que leen y escriben en una base de Airtable (`appkk3JHBiWrBn4UF`) usando conexiones de Make
hardcodeadas (`12349170`, `12349301`, `12349376`, `12349388`, `12349438`).

## Problemas concretos

1. **Dependencia total de servicios pagos/externos.** Requiere cuenta de Airtable, Make y sus conexiones. Sin ellas no funciona nada.
2. **IDs hardcodeados.** Los blueprints apuntan a una base y a conexiones de otra cuenta. Para usarlos hay que reemplazarlos manualmente en JSON.
3. **Modelos de IA cuestionables.** Las listas incluyen nombres como `gpt-6.1-sol`, `claude-fable-5`, etc. que no son modelos reales verificables. No hay validación.
4. **Sin orquestación autónoma.** Make ejecuta módulos sueltos; no hay un equipo de agentes que se contradiga, revise y corrija. El "motor comercial" es un prompt suelto.
5. **Sin WhatsApp real.** Solo Telegram con chat id hardcodeado (`5144879357`).
6. **Sin aduanas, sin pricing real, sin enriquecimiento.** No calcula aranceles, márgenes, ni busca emails de compradores.
7. **Sin modo standalone.** `config.csv` tiene `COMPLETAR` en campos críticos (marca, web, email, firma, propuesta de valor, dirección postal obligatoria para CAN-SPAM).
8. **Envío no controlado.** Depende de que el usuario cambie un estado en Airtable y ejecute Make a mano.
9. **Sin feedback continuo ni aprendizaje.** No hay memoria de lo que funcionó.

## Conclusión

Los blueprints son un **borrador útil de prompts y estructura**, pero no son un producto usable tal cual.
Por eso se construyó **Lucian** (`lucian/`): mismo objetivo, sin dependencias externas, con datos locales,
equipo de agentes real, revisión humana obligatoria y modo demo completo.

El sistema anterior se **conserva intacto** por si querés seguir usándolo, pero Lucian no lo requiere.