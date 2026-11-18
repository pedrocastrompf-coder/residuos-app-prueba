/**
 * Inspecciones ambientales de área (SGA.R.G.002 Vs 06) · módulo del backend (Google Apps Script)
 * Pega este archivo como un archivo NUEVO («Inspecciones») en Extensiones > Apps Script, junto a Code.gs y Hallazgos.gs.
 * Usa de Hallazgos.gs: hzValidarReporte_, hzCrear_, hzBuscar_, hzEscribir_, hzHoja_, hzAreasTodas_, hzAhora_, hzU_.
 * Usa de Code.gs: hoja_, bitacora_, SEDE.
 */

// ===================== 1. REGLAS =====================
const INSP_COLS = ["id","sede","creado","fecha","hora","area","inspectorUsuario","inspectorNombre","respNombre","respCargo","puntos","criterios","pctConf","calificacion","hallazgos","inspectorCargo","firmaInsp","firmaResp"];
const INSP_LIV = 16;   // columnas que lee el historial (las firmas, que pesan, quedan fuera)
const INSP_MAX_FIRMA = 30000;   // caracteres máximos de una firma (celda de Sheets: 50 000)
const INSP_CORTES = {satisfactorio:90, aceptable:70};   // PROVISIONAL: porcentajes de corte por confirmar con Medio Ambiente
const INSP_TIPOS_CELDA = ["noaprov","organico","papel","plastico","vidrio","metal","peligroso","mermas","rotulacion","delimitacion"];
const INSP_RES = ["C","NC","NA"];
const INSP_MAX_PUNTOS = 8;
// n → [texto del criterio (formato Vs 06), tipo de hallazgo que se crea si es NC]
const INSP_CRIT = {
  1:["Segregación, rotulación y delimitación conformes en todos los puntos (ver Sección A)","Segregación de residuos"],
  2:["Contenedores en buen estado, con bolsa y letrero de colores NTP 900.058","Almacenamiento y acopio"],
  3:["Sin sobrellenado ni residuos fuera del contenedor; punto limpio y ordenado","Almacenamiento y acopio"],
  4:["Envolturas laminadas / metalizadas segregadas según instructivo","Segregación de residuos"],
  5:["Mermas y subproductos separados, identificados y con destino registrado","Segregación de residuos"],
  6:["Acopio temporal en condiciones (techo, piso, señalización, contención)","Almacenamiento y acopio"],
  7:["Residuos peligrosos y RAEE en recipiente cerrado y rotulado","Almacenamiento y acopio"],
  8:["Químicos almacenados según FDS, con bandeja antiderrame y rótulo","Almacenamiento y acopio"],
  9:["Kit antiderrames completo y accesible","Derrames y fugas"],
  10:["Trampas de grasa operativas","Efluentes y desagües"],
  11:["Efluentes de lavado CIP neutralizados antes de descargar","Efluentes y desagües"],
  12:["Sin humo, olores, polvo ni fugas de refrigerante anormales","Otro"],
  13:["Sin fugas de agua, vapor, aire o gas; equipos apagados si no se usan","Uso de agua y energía"],
  14:["Flujómetros operativos","Uso de agua y energía"],
  15:["Residuos en zona de proceso sin riesgo de plagas ni contaminación cruzada","Orden y limpieza"],
  16:["Personal conoce aspectos ambientales, colores y respuesta a derrames","Otro"],
  17:["Otro","Otro"]
};

function inspTxt_(v){ return String(v == null ? "" : v).trim().replace(/\s+/g, " "); }

// % de conformidad = C / (C + NC) sobre los criterios (NA no cuenta). Devuelve "" si no hay criterios aplicables.
function inspPorcentaje_(crit){
  let c = 0, nc = 0;
  crit.forEach(x => { if (x.r === "C") c++; else if (x.r === "NC") nc++; });
  return (c + nc) ? Math.round(1000 * c / (c + nc)) / 10 : "";
}
function inspCalificacion_(pct){
  if (pct === "") return "";
  return pct >= INSP_CORTES.satisfactorio ? "Satisfactorio" : pct >= INSP_CORTES.aceptable ? "Aceptable con acciones" : "No satisfactorio";
}

function inspValidar_(b){
  b = b || {};
  if (!hzIdValido_(b.id) || String(b.id).length > 50) return {ok:false, error:"id_invalido"};
  const area = inspTxt_(b.area); if (!area || area.length > 40) return {ok:false, error:"area_invalida"};
  const respNombre = inspTxt_(b.respNombre), respCargo = inspTxt_(b.respCargo);
  if (respNombre.length < 3 || respNombre.length > 60) return {ok:false, error:"responsable_invalido"};
  if (respCargo.length > 40) return {ok:false, error:"cargo_invalido"};
  const inspCargo = inspTxt_(b.inspectorCargo); if (inspCargo.length > 40) return {ok:false, error:"cargo_invalido"};
  const okFirma = f => typeof f === "string" && /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(f) && f.length <= INSP_MAX_FIRMA;
  if (!okFirma(b.firmaInsp) || !okFirma(b.firmaResp)) return {ok:false, error:"firmas_invalidas"};
  const P = Array.isArray(b.puntos) ? b.puntos : [];
  if (P.length > INSP_MAX_PUNTOS) return {ok:false, error:"puntos_invalidos"};
  const puntos = [];
  for (let i = 0; i < P.length; i++){
    const p = P[i] || {}, nombre = inspTxt_(p.nombre);
    if (!nombre || nombre.length > 40) return {ok:false, error:"puntos_invalidos"};
    const c = {};
    for (let k = 0; k < INSP_TIPOS_CELDA.length; k++){
      const t = INSP_TIPOS_CELDA[k], v = p.c && p.c[t];
      if (INSP_RES.indexOf(v) < 0) return {ok:false, error:"puntos_invalidos"};
      c[t] = v;
    }
    const obs = inspTxt_(p.obs); if (obs.length > 200) return {ok:false, error:"puntos_invalidos"};
    puntos.push({nombre:nombre, c:c, obs:obs});
  }
  const C = Array.isArray(b.criterios) ? b.criterios : [], crit = [], hallazgos = [];
  if (C.length !== 17) return {ok:false, error:"criterios_invalidos"};
  for (let n = 1; n <= 17; n++){
    const x = C.filter(y => y && Number(y.n) === n)[0];
    if (!x || INSP_RES.indexOf(x.r) < 0) return {ok:false, error:"criterios_invalidos"};
    const obs = inspTxt_(x.obs);
    if (x.r !== "NC"){ crit.push({n:n, r:x.r, obs:obs.slice(0, 300)}); continue; }
    // toda no conformidad exige acción correctiva, responsable y plazo (la inspección no se termina ni se imprime sin ellos)
    const accion = inspTxt_(x.accion), resp = inspTxt_(x.responsable), plazo = String(x.plazo || "");
    if (obs.length < 5) return {ok:false, error:"nc_invalida", criterio:n, detalle:"descripcion_invalida"};
    if (accion.length < 5 || accion.length > 300) return {ok:false, error:"nc_invalida", criterio:n, detalle:"accion_invalida"};
    if (resp.length < 3 || resp.length > 60) return {ok:false, error:"nc_invalida", criterio:n, detalle:"responsable_invalido"};
    const dp = hzDia_(plazo), dh = hzDia_(hzHoy_());
    if (isNaN(dp) || dp < dh || dp - dh > 365) return {ok:false, error:"nc_invalida", criterio:n, detalle:"plazo_invalido"};
    const desc = ("Criterio " + n + ": " + INSP_CRIT[n][0] + " — " + obs.slice(0, 200) + " | Acción: " + accion.slice(0, 120) + " | Resp.: " + resp + " | Plazo: " + plazo.split("-").reverse().join("/")).slice(0, 500);
    const rep = hzValidarReporte_({id:String(b.id) + "-c" + n, area:area, descripcion:desc, tipo:INSP_CRIT[n][1], riesgo:"Medio", fotos:x.fotos});
    if (!rep.ok) return {ok:false, error:"nc_invalida", criterio:n, detalle:rep.error};
    crit.push({n:n, r:"NC", obs:obs.slice(0, 300), accion:accion, responsable:resp, plazo:plazo});
    hallazgos.push(rep.v);
  }
  return {ok:true, v:{id:String(b.id), area:area, respNombre:respNombre, respCargo:respCargo, inspCargo:inspCargo, firmaInsp:b.firmaInsp, firmaResp:b.firmaResp, puntos:puntos, crit:crit, hallazgos:hallazgos}};
}

// ===================== 2. PERSISTENCIA =====================
function inspHoja_(){ return hoja_("Inspecciones", INSP_COLS, INSP_COLS); }

function inspGuardar_(b, u){
  u = hzU_(u);
  const val = inspValidar_(b); if (!val.ok) return val;
  const v = val.v, sh = inspHoja_();
  const ya = sh.getDataRange().getValues().slice(1).filter(r => String(r[0]) === v.id)[0];
  if (ya) return {ok:true, id:v.id, repetido:true};                               // reintento por mala señal: no duplica
  const ar = hzAreasTodas_().filter(a => a.nombre === v.area)[0];
  if (!ar || !ar.activo) return {ok:false, error:"area_invalida"};
  const ahora = hzAhora_(), ids = [];
  v.hallazgos.forEach(h => {                                                       // cada NC pasa a la lista única de hallazgos
    const r = hzCrear_({id:h.id, area:h.area, descripcion:h.descripcion, tipo:h.tipo, riesgo:h.riesgo, fotos:h.fotos}, u);
    if (r && r.ok){
      const fila = hzBuscar_(hzHoja_(), h.id);
      if (fila){ fila.origen = "inspección " + v.id; hzEscribir_(hzHoja_(), fila); }
      ids.push(h.id);
    }
  });
  const pct = inspPorcentaje_(v.crit), cal = inspCalificacion_(pct);
  sh.appendRow([v.id, SEDE, ahora, ahora.slice(0,10), ahora.slice(11,16), v.area, u.usuario, u.nombre, v.respNombre, v.respCargo,
    JSON.stringify(v.puntos), JSON.stringify(v.crit), pct, cal, JSON.stringify(ids), v.inspCargo, v.firmaInsp, v.firmaResp]);
  bitacora_(u, "Inspección registrada", v.id + " · " + v.area + " · " + (pct === "" ? "s/d" : pct + "%") + " · " + ids.length + " hallazgo(s)");
  return {ok:true, id:v.id, pct:pct, calificacion:cal, hallazgos:ids};
}

function inspListar_(u){
  u = hzU_(u);
  const todas = u.rol === "Inspector" || u.rol === "Administrador";
  const F = sh => { const n = sh.getLastRow(); return n < 2 ? [] : sh.getRange(2, 1, n - 1, INSP_LIV).getValues(); };
  const L = F(inspHoja_()).filter(r => String(r[1]) === SEDE && (todas || String(r[6]) === u.usuario)).map(r => {
    const o = {}; INSP_COLS.slice(0, INSP_LIV).forEach((c, j) => o[c] = String(r[j] == null ? "" : r[j])); return o;
  }).reverse().slice(0, 100);
  const out = L.map(o => ({id:o.id, creado:o.creado, fecha:o.fecha, hora:o.hora, area:o.area, inspectorNombre:o.inspectorNombre,
    respNombre:o.respNombre, respCargo:o.respCargo, inspectorCargo:o.inspectorCargo, puntos:JSON.parse(o.puntos || "[]"), criterios:JSON.parse(o.criterios || "[]"),
    pct:o.pctConf, calificacion:o.calificacion, hallazgos:JSON.parse(o.hallazgos || "[]")}));
  return {ok:true, inspecciones:out};
}

// Las firmas se piden solo al imprimir o compartir el PDF (el PDF no se guarda: la app lo arma al momento)
function inspFirmas_(b, u){
  u = hzU_(u);
  const sh = inspHoja_(), n = sh.getLastRow(); if (n < 2) return {ok:false, error:"no_existe"};
  const V = sh.getRange(2, 1, n - 1, INSP_COLS.length).getValues();
  const r = V.filter(x => String(x[0]) === String(b.id) && String(x[1]) === SEDE)[0];
  if (!r) return {ok:false, error:"no_existe"};
  if (!(u.rol === "Inspector" || u.rol === "Administrador" || String(r[6]) === u.usuario)) return {ok:false, error:"permiso"};
  return {ok:true, firmaInsp:String(r[INSP_COLS.indexOf("firmaInsp")] || ""), firmaResp:String(r[INSP_COLS.indexOf("firmaResp")] || "")};
}

// Prueba para el editor: guarda una inspección con 1 NC y una imagen JPEG de 1×1 píxel
function pruebaInspecciones(){
  const u = {usuario:"prueba", nombre:"Prueba", rol:"Administrador"};
  const px = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  const FIRMA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const ar = hzAreasTodas_().filter(a => a.activo)[0]; if (!ar){ Logger.log("Cree primero un área en la pestaña Áreas."); return; }
  const crit = []; for (let n = 1; n <= 17; n++) crit.push(n === 3 ? {n:n, r:"NC", obs:"Contenedor rebosado de prueba", accion:"Retirar y limpiar el punto", responsable:"Responsable de prueba", plazo:hzHoy_(), fotos:[px]} : {n:n, r:"C"});
  const punto = {nombre:"Punto 1", c:{noaprov:"C", organico:"C", papel:"NA", plastico:"C", vidrio:"NA", metal:"NA", peligroso:"NA", mermas:"NA", rotulacion:"C", delimitacion:"C"}, obs:""};
  const id = "prueba-insp-" + Utilities.formatDate(new Date(), "America/Lima", "yyyyMMddHHmmss");
  Logger.log("Guardar: %s", JSON.stringify(inspGuardar_({id:id, area:ar.nombre, respNombre:"Responsable de prueba", respCargo:"Jefe", firmaInsp:FIRMA, firmaResp:FIRMA, puntos:[punto], criterios:crit}, u)));
  Logger.log("Repetir: %s", JSON.stringify(inspGuardar_({id:id, area:ar.nombre, respNombre:"Responsable de prueba", respCargo:"Jefe", firmaInsp:FIRMA, firmaResp:FIRMA, puntos:[punto], criterios:crit}, u)));
}

// ===================== 3. CARGA INICIAL DE ÁREAS =====================
// Ejecútala UNA vez desde el editor (elige «cargarAreasIniciales» y pulsa Ejecutar). No duplica ni modifica las áreas que ya existan.
// Lista del Programa anual de inspecciones ambientales 2026 (SGA.PR.G.008). Tipo: Producción = líneas; Servicio = almacenes y apoyo; Común = comedor, oficinas y exteriores. «ejecutora» = puede recibir acciones correctivas (cámbialo en la pestaña Áreas si hace falta).
const AREAS_INICIALES = [
  ["Cobertura L1, L3","Producción"],["Cobertura L2, L4","Producción"],["Empaque 1","Producción"],["Moldeo convencional","Producción"],
  ["Moldeo 11, 12","Producción"],["Moldeo 13, 16","Producción"],["Bombonería","Producción"],["Gotas","Producción"],["Grageados","Producción"],
  ["Empaque 2 - Cocoa","Producción"],["Mezclas instantáneas","Producción"],["Miniconos","Producción"],["Bañados","Producción"],
  ["Wafer","Producción"],["Galletas","Producción"],["Molino","Producción"],["Conos","Producción"],["Stick","Producción"],
  ["Barras cereales","Producción"],["Ecco","Producción"],["Molino de azúcar","Producción"],
  ["Saneamiento","Servicio",true],["Calidad","Servicio"],["Aplicaciones y desarrollo","Servicio"],
  ["Almacén - Productos terminados","Servicio"],["Almacén - Repuestos","Servicio"],["Almacén - Embalaje","Servicio"],
  ["Almacén - Materia prima","Servicio"],["Almacén - Dosimetría","Servicio"],["Sensorial","Servicio"],
  ["Mantenimiento","Servicio",true],["Transporte","Servicio"],["Proyectos","Servicio",true],["Tópico","Servicio"],
  ["Comedor","Común"],["Oficinas administrativas","Común"],["Azotea de planta","Común"],["Zona Miami y exteriores","Común"]
];
function cargarAreasIniciales(){
  const u = {usuario:"carga-inicial", nombre:"Carga inicial", rol:"Administrador", areas:[]};
  const ya = {}; hzAreasTodas_().forEach(a => ya[a.nombre.toLowerCase()] = 1);
  let nuevas = 0, omitidas = 0;
  AREAS_INICIALES.forEach(a => {
    if (ya[a[0].toLowerCase()]){ omitidas++; return; }
    const r = hzAreaGuardar_({nombre:a[0], tipo:a[1], ejecutora:a[2] === true, activo:true}, u);
    if (r && r.ok) nuevas++; else Logger.log("No se pudo crear %s: %s", a[0], JSON.stringify(r));
  });
  Logger.log("Áreas creadas: %s · ya existían (no se tocaron): %s · total en la lista: %s", nuevas, omitidas, AREAS_INICIALES.length);
}

if (typeof module !== "undefined") module.exports = {inspPorcentaje_, inspCalificacion_, INSP_CORTES};
