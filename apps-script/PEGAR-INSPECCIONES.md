# Inspecciones: qué pegar en el Apps Script de PRUEBA (3 pasos)

Solo en el script de la copia «APPlicativo MA». No toques el real.

## 1. Archivo nuevo
En Apps Script: **+ > Script**, nómbralo `Inspecciones`, borra lo que traiga y pega TODO el contenido de `Inspecciones.gs`.

## 2. En Code.gs, tres cambios pequeños
a) En `PERMISOS`, después de `areas_admin:["Inspector","Administrador"]` agrega una coma y esta línea (estará en «en desarrollo» solo para Administrador, igual que Hallazgos):

    , inspeccion_registrar:["Administrador"]

b) En `SIN_TURNO` agrega `"inspecciones_listar"` al final de la lista:

    const SIN_TURNO = ["usuarios_listar","actividad_listar","plantas","hallazgos_listar","hallazgo_foto","areas_listar","inspecciones_listar"];

c) En `doPost`, debajo de la línea `if (A === "hallazgos_listar") return json_(hzListar_(u));` pega:

    if (A === "inspeccion_guardar") return puede_(u.rol,"inspeccion_registrar") ? json_(inspGuardar_(b, u)) : no;
    if (A === "inspecciones_listar") return puede_(u.rol,"inspeccion_registrar") ? json_(inspListar_(u)) : no;

## 3. Guardar y publicar
Guardar (Ctrl+S) > Implementar > Administrar implementaciones > lápiz > Versión: **Nueva versión** > Implementar.

## Prueba rápida (opcional)
En el editor, elige la función `pruebaInspecciones` y pulsa Ejecutar. Debe registrar «Guardar: {ok:true…}» y luego «Repetir: {…repetido:true}». Necesitas tener al menos un área creada.
