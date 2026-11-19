# Control documentario (etapas 1 y 2): cómo pegarlo (solo en el script de PRUEBA)

Orden: primero el script, después la app. No toques el script de la app real.

## 1. Script de prueba (Apps Script de la hoja «APPlicativo MA»)
1. **Código.gs**: borra todo y pega el `Code.gs` nuevo. Guarda (Ctrl+S).
2. **Inspecciones.gs**: borra todo y pega el `Inspecciones.gs` nuevo. Guarda.
3. **ControlDoc.gs (archivo nuevo)**: botón «+» > «Secuencia de comandos» > nombre `ControlDoc`. Borra lo que trae y pega `ControlDoc.gs`. Guarda.
4. Implementar > Administrar implementaciones > lápiz > Versión: **Nueva versión** > Implementar.
   - Si Google pide permisos nuevos, los aceptas tú (el módulo guarda en tu Drive el PDF en blanco de cada versión aprobada, en la carpeta «Control documentario»).

## 2. App de prueba
Ábrela dos veces (o Ctrl+Shift+R). En el menú aparece **Control documentario**.

## 3. Primer uso
1. Control documentario > SGA.R.G.002: verás la **versión 06 vigente** (17 criterios, el formato en papel) y la **versión 07 en borrador** (9 criterios, sin sección F).
2. Revisa la 07 con «Vista previa» y toca **Aprobar versión 07**. Desde ese momento las inspecciones nuevas usan la 07.
3. Inspecciones > Nueva inspección: comprueba que salen los 9 criterios.

## Qué se afecta
- Las pestañas **Documentos, Versiones y ControlCambios** se crean solas en la hoja de prueba.
- La pestaña **Inspecciones** recibe dos columnas nuevas al final (versionId, resultadoTexto).
- Inspecciones de prueba guardadas antes de este cambio no tienen versión: se muestran con la versión vigente y pueden verse con textos que no les corresponden. Bórralas.
- Un borrador de inspección guardado en el teléfono antes de este cambio se descarta.
- Si solo actualizas la app y no el script, la app avisa «El servidor todavía no tiene el módulo…» y no deja empezar inspecciones. No se pierde nada.
- Seguro de prueba (`SOLO_ESTA_HOJA = true` en Code.gs) sigue activo.

## Etapa 2 (crear documentos)
Se pegan los mismos tres archivos (Code.gs, ControlDoc.gs, Inspecciones.gs) y se publica una Nueva versión.
- **Nuevo documento** en Control documentario: código, título, tipo y responsable.
- **Formato**: nace con su borrador 01 (plantilla mínima), se edita, se aprueba y aparece para llenarse en Inspecciones (se elige el formato).
- **Procedimiento / Instructivo**: cada versión se sube como PDF (máximo 8 MB), con motivo; al aprobar queda vigente. En Drive quedan solo la vigente y la anterior.
- La pestaña Inspecciones suma una columna «codigo» al final (las filas antiguas se toman como SGA.R.G.002).
- Si solo se actualiza la app, la app avisa que falta el script y no deja empezar inspecciones; no se pierde nada.
