/**
 * Inspecciones ambientales de área (formato SGA.R.G.002) · módulo del backend (Google Apps Script)
 * Pega este archivo como un archivo «Inspecciones» en Extensiones > Apps Script, junto a Code.gs, Hallazgos.gs y ControlDoc.gs.
 * El formato (puntos, criterios, resultado y firmas) NO está en este código: se lee de la versión aprobada en Control documentario.
 * Cada inspección guarda la versión del formato con que se hizo (versionId), para verse y reimprimirse siempre igual.
 * Usa de Hallazgos.gs: hzValidarReporte_, hzCrear_, hzBuscar_, hzEscribir_, hzHoja_, hzAreasTodas_, hzAhora_, hzHoy_, hzDia_, hzU_.
 * Usa de ControlDoc.gs: docDefAprobada_, docVigenteDe_, DOC_INSPECCION. Usa de Code.gs: hoja_, bitacora_, SEDE.
 */

// ===================== 1. REGLAS =====================
const INSP_COLS = ["id","sede","creado","fecha","hora","area","inspectorUsuario","inspectorNombre","respNombre","respCargo","puntos","criterios","pctConf","calificacion","hallazgos","inspectorCargo","firmaInsp","firmaResp","versionId","resultadoTexto","codigo","datos","registro"];
const INSP_LIV = 16;   // columnas que lee el historial antes de las firmas (que pesan); versionId y resultadoTexto se leen aparte
const INSP_MAX_FIRMA = 30000;   // caracteres máximos de una firma (celda de Sheets: 50 000)
const INSP_RES = ["C","NC","NA"];

function inspTxt_(v){ return String(v == null ? "" : v).trim().replace(/\s+/g, " "); }
function inspItems_(def){ const L = []; def.criterios.grupos.forEach(g => g.items.forEach(i => L.push(i))); return L; }

// % de conformidad = C / (C + NC) sobre los criterios (NA no cuenta). Devuelve "" si no hay criterios aplicables.
function inspPorcentaje_(crit){
  let c = 0, nc = 0;
  crit.forEach(x => { if (x.r === "C") c++; else if (x.r === "NC") nc++; });
  return (c + nc) ? Math.round(1000 * c / (c + nc)) / 10 : "";
}
function inspCalificacion_(pct, cortes){
  if (pct === "") return "";
  return pct >= cortes.sat ? "Satisfactorio" : pct >= cortes.ace ? "Aceptable con acciones" : "No satisfactorio";
}

function inspValidar_(b){
  b = b || {};
  if (!hzIdValido_(b.id) || String(b.id).length > 50) return {ok:false, error:"id_invalido"};
  const fv = docDefAprobada_(b.versionId); if (!fv || !fv.def.criterios) return {ok:false, error:"formato_invalido"};
  const def = fv.def;
  // datos generales: los configurados en el formato, o el campo Área de siempre
  const dv = inspDatos_(def, b); if (!dv.ok) return dv;
  const area = dv.area;                                       // "" si el formato no tiene campo Área (entonces las NC no crean hallazgos)
  const conArea = !def.datos || def.datos.some(c => c.tipo === "area");
  const dosFirmas = !!def.firmas.resp;
  const respNombre = dosFirmas ? inspTxt_(b.respNombre) : "", respCargo = dosFirmas ? inspTxt_(b.respCargo) : "";
  if (dosFirmas && (respNombre.length < 3 || respNombre.length > 60)) return {ok:false, error:"responsable_invalido"};
  if (respCargo.length > 40) return {ok:false, error:"cargo_invalido"};
  const inspCargo = inspTxt_(b.inspectorCargo); if (inspCargo.length > 40) return {ok:false, error:"cargo_invalido"};
  if (!inspFirmaOk_(b.firmaInsp) || (dosFirmas && !inspFirmaOk_(b.firmaResp))) return {ok:false, error:"firmas_invalidas"};
  // tabla de registro (si el formato la tiene)
  const rv = inspRegistro_(def, b.registro); if (!rv.ok) return rv;
  // tabla de puntos (si el formato la tiene)
  const P = Array.isArray(b.puntos) ? b.puntos : [], puntos = [];
  const cols = def.puntos ? def.puntos.columnas.map(c => c.k) : [];
  if (!def.puntos && P.length) return {ok:false, error:"puntos_invalidos"};
  if (def.puntos && P.length > def.puntos.max) return {ok:false, error:"puntos_invalidos"};
  for (let i = 0; i < P.length; i++){
    const p = P[i] || {}, nombre = inspTxt_(p.nombre);
    if (!nombre || nombre.length > 40) return {ok:false, error:"puntos_invalidos"};
    const c = {};
    for (let k = 0; k < cols.length; k++){
      const v = p.c && p.c[cols[k]];
      if (INSP_RES.indexOf(v) < 0) return {ok:false, error:"puntos_invalidos"};
      c[cols[k]] = v;
    }
    const obs = inspTxt_(p.obs); if (obs.length > 200) return {ok:false, error:"puntos_invalidos"};
    puntos.push({nombre:nombre, c:c, obs:obs});
  }
  // criterios
  const items = inspItems_(def), C = Array.isArray(b.criterios) ? b.criterios : [], crit = [], hallazgos = [];
  if (C.length !== items.length) return {ok:false, error:"criterios_invalidos"};
  for (let k = 0; k < items.length; k++){
    const it = items[k], n = it.n, x = C.filter(y => y && Number(y.n) === n)[0];
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
    const desc = ("Criterio " + n + ": " + it.t + " — " + obs.slice(0, 200) + " | Acción: " + accion.slice(0, 120) + " | Resp.: " + resp + " | Plazo: " + plazo.split("-").reverse().join("/")).slice(0, 500);
    crit.push({n:n, r:"NC", obs:obs.slice(0, 300), accion:accion, responsable:resp, plazo:plazo});
    if (!conArea) continue;                                   // sin campo Área: la NC queda en el registro, sin hallazgo
    const rep = hzValidarReporte_({id:String(b.id) + "-c" + n, area:area, descripcion:desc, tipo:it.h, riesgo:"Medio", fotos:x.fotos});
    if (!rep.ok) return {ok:false, error:"nc_invalida", criterio:n, detalle:rep.error};
    hallazgos.push(rep.v);
  }
  // resultado: porcentaje (se calcula aquí) o texto escrito por el inspector
  let resultadoTexto = "";
  if (def.resultado.modo === "texto"){
    resultadoTexto = String(b.resultadoTexto == null ? "" : b.resultadoTexto).trim();
    if (resultadoTexto.length < 10 || resultadoTexto.length > 1500) return {ok:false, error:"resultado_invalido"};
  }
  return {ok:true, v:{id:String(b.id), versionId:fv.versionId, codigo:fv.codigo, def:def, area:area, titulo:dv.titulo, datos:dv.datos, conArea:conArea,
    registro:rv.filas, firmasFila:rv.firmas, respNombre:respNombre, respCargo:respCargo, inspCargo:inspCargo,
    firmaInsp:b.firmaInsp, firmaResp:b.firmaResp, puntos:puntos, crit:crit, hallazgos:hallazgos, resultadoTexto:resultadoTexto}};
}

const inspFirmaOk_ = f => typeof f === "string" && /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(f) && f.length <= INSP_MAX_FIRMA;
// valor de un campo según su tipo; devuelve {ok, v} ("" si vacío)
function inspValor_(c, x){
  const t = String(x == null ? "" : x).trim();
  if (!t) return {ok:true, v:""};
  if (c.tipo === "numero"){ const n = Number(t.replace(",", ".")); return isFinite(n) && t.length <= 20 ? {ok:true, v:String(n)} : {ok:false}; }
  if (c.tipo === "fecha") return isNaN(hzDia_(t)) ? {ok:false} : {ok:true, v:t};
  if (c.tipo === "hora") return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? {ok:true, v:t} : {ok:false};
  if (c.tipo === "lista") return c.opciones.indexOf(t) >= 0 ? {ok:true, v:t} : {ok:false};
  if (c.tipo === "sino") return t === "Sí" || t === "No" ? {ok:true, v:t} : {ok:false};
  const v = inspTxt_(t); return v.length <= 200 ? {ok:true, v:v} : {ok:false};
}
function inspDatos_(def, b){
  if (!def.datos){                                            // formato con el campo Área de siempre
    const area = inspTxt_(b.area); if (!area || area.length > 40) return {ok:false, error:"area_invalida"};
    return {ok:true, area:area, titulo:area, datos:null};
  }
  const D = b.datos || {}, out = {}; let area = "", titulo = "";
  for (const c of def.datos){
    const r = c.tipo === "area" ? {ok:true, v:inspTxt_(D[c.k]).slice(0, 40)} : inspValor_(c, D[c.k]);
    if (!r.ok) return {ok:false, error:"dato_invalido", campo:c.t};
    if (c.req && !r.v) return {ok:false, error:"dato_requerido", campo:c.t};
    out[c.k] = r.v;
    if (c.tipo === "area") area = r.v;
    if (!titulo && r.v && (c.tipo === "texto" || c.tipo === "lista")) titulo = r.v;
  }
  return {ok:true, area:area, titulo:(area || titulo || def.titulo).slice(0, 60), datos:out};
}
// filas de la tabla de registro; las firmas se separan (van a la pestaña RegistroFirmas: no caben en una celda)
function inspRegistro_(def, R){
  if (!def.registro) return {ok:true, filas:[], firmas:[]};
  R = Array.isArray(R) ? R : [];
  if (!R.length) return {ok:false, error:"registro_vacio"};
  if (R.length > def.registro.max) return {ok:false, error:"registro_invalido"};
  const filas = [], firmas = [];
  for (let i = 0; i < R.length; i++){
    const f = R[i] || {}, o = {};
    for (const c of def.registro.columnas){
      if (c.tipo === "firma"){
        const fx = f[c.k];
        if (fx){ if (!inspFirmaOk_(fx)) return {ok:false, error:"registro_invalido", fila:i + 1, campo:c.t}; firmas.push({fila:i, firma:fx}); o[c.k] = "1"; }
        else if (c.req) return {ok:false, error:"registro_requerido", fila:i + 1, campo:c.t};
        else o[c.k] = "";
        continue;
      }
      const r = inspValor_(c, f[c.k]);
      if (!r.ok) return {ok:false, error:"registro_invalido", fila:i + 1, campo:c.t};
      if (c.req && !r.v) return {ok:false, error:"registro_requerido", fila:i + 1, campo:c.t};
      o[c.k] = r.v;
    }
    filas.push(o);
  }
  return {ok:true, filas:filas, firmas:firmas};
}

// ===================== 2. PERSISTENCIA =====================
function inspFirmasFilaHoja_(){ return hoja_("RegistroFirmas", ["id","fila","firma"], ["id"]); }
function inspHoja_(){ return hoja_("Inspecciones", INSP_COLS, INSP_COLS); }

function inspGuardar_(b, u){
  u = hzU_(u);
  const val = inspValidar_(b); if (!val.ok) return val;
  const v = val.v, sh = inspHoja_();
  const ya = sh.getDataRange().getValues().slice(1).filter(r => String(r[0]) === v.id)[0];
  if (ya) return {ok:true, id:v.id, repetido:true};                               // reintento por mala señal: no duplica
  if (v.conArea){
    const ar = hzAreasTodas_().filter(a => a.nombre === v.area)[0];
    if (!ar || !ar.activo) return {ok:false, error:"area_invalida"};
  }
  const ahora = hzAhora_(), ids = [];
  v.hallazgos.forEach(h => {                                                       // cada NC pasa a la lista única de hallazgos
    const r = hzCrear_({id:h.id, area:h.area, descripcion:h.descripcion, tipo:h.tipo, riesgo:h.riesgo, fotos:h.fotos}, u);
    if (r && r.ok){
      const fila = hzBuscar_(hzHoja_(), h.id);
      if (fila){ fila.origen = "inspección " + v.id; hzEscribir_(hzHoja_(), fila); }
      ids.push(h.id);
    }
  });
  const porPct = v.def.resultado.modo === "porcentaje";
  const pct = porPct ? inspPorcentaje_(v.crit) : "", cal = porPct ? inspCalificacion_(pct, v.def.resultado.cortes) : "";
  if (v.firmasFila.length){ const fs = inspFirmasFilaHoja_(); v.firmasFila.forEach(f => fs.appendRow([v.id, f.fila, f.firma])); }
  sh.appendRow([v.id, SEDE, ahora, ahora.slice(0,10), ahora.slice(11,16), v.titulo, u.usuario, u.nombre, v.respNombre, v.respCargo,
    JSON.stringify(v.puntos), JSON.stringify(v.crit), pct, cal, JSON.stringify(ids), v.inspCargo, v.firmaInsp, v.firmaResp || "", v.versionId, v.resultadoTexto, v.codigo,
    v.datos ? JSON.stringify(v.datos) : "", v.registro.length ? JSON.stringify(v.registro) : ""]);
  bitacora_(u, "Inspección registrada", v.id + " · " + v.titulo + " · " + (porPct ? (pct === "" ? "s/d" : pct + "%") : "resultado en texto") + " · " + ids.length + " hallazgo(s)");
  return {ok:true, id:v.id, pct:pct, calificacion:cal, hallazgos:ids};
}

function inspListar_(u){
  u = hzU_(u);
  const todas = u.rol === "Inspector" || u.rol === "Administrador";
  // se leen las columnas del historial y, aparte, versionId y resultadoTexto (las firmas, que pesan, no se leen)
  const sh = inspHoja_(), n = sh.getLastRow(), jV = INSP_COLS.indexOf("versionId");
  const A = n < 2 ? [] : sh.getRange(2, 1, n - 1, INSP_LIV).getValues(), B = n < 2 ? [] : sh.getRange(2, jV + 1, n - 1, 5).getValues();
  const L = A.map((r, i) => {
    const o = {}; INSP_COLS.slice(0, INSP_LIV).forEach((c, j) => o[c] = String(r[j] == null ? "" : r[j]));
    o.versionId = String(B[i][0] == null ? "" : B[i][0]); o.resultadoTexto = String(B[i][1] == null ? "" : B[i][1]); o.codigo = String(B[i][2] || "") || DOC_INSPECCION; o.datos = String(B[i][3] || ""); o.registro = String(B[i][4] || ""); return o;
  }).filter(o => o.sede === SEDE && (todas || o.inspectorUsuario === u.usuario)).reverse().slice(0, 300);
  const out = L.map(o => ({id:o.id, creado:o.creado, fecha:o.fecha, hora:o.hora, area:o.area, inspectorNombre:o.inspectorNombre,
    respNombre:o.respNombre, respCargo:o.respCargo, inspectorCargo:o.inspectorCargo, puntos:JSON.parse(o.puntos || "[]"), criterios:JSON.parse(o.criterios || "[]"),
    pct:o.pctConf, calificacion:o.calificacion, hallazgos:JSON.parse(o.hallazgos || "[]"), versionId:o.versionId, resultadoTexto:o.resultadoTexto, codigo:o.codigo,
    datos:o.datos ? JSON.parse(o.datos) : null, registro:o.registro ? JSON.parse(o.registro) : []}));
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
  const fs = inspFirmasFilaHoja_(), m = fs.getLastRow(), filas = {};
  if (m >= 2) fs.getRange(2, 1, m - 1, 3).getValues().forEach(x => { if (String(x[0]) === String(b.id)) filas[Number(x[1])] = String(x[2]); });
  return {ok:true, firmaInsp:String(r[INSP_COLS.indexOf("firmaInsp")] || ""), firmaResp:String(r[INSP_COLS.indexOf("firmaResp")] || ""), filas:filas};
}

// Prueba para el editor: guarda una inspección con 1 NC (con la versión vigente del formato) y una imagen JPEG de 1×1 píxel
function pruebaInspecciones(){
  const u = {usuario:"prueba", nombre:"Prueba", rol:"Administrador"};
  const px = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  const FIRMA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const ar = hzAreasTodas_().filter(a => a.activo)[0]; if (!ar){ Logger.log("Cree primero un área en la pestaña Áreas."); return; }
  docSembrar_();
  const vig = docVigenteDe_(DOC_INSPECCION), def = vig.def, items = inspItems_(def);
  const crit = items.map((it, k) => k === 1 ? {n:it.n, r:"NC", obs:"Observación de prueba", accion:"Acción de prueba", responsable:"Responsable de prueba", plazo:hzHoy_(), fotos:[px]} : {n:it.n, r:"C"});
  const c = {}; (def.puntos ? def.puntos.columnas : []).forEach(x => c[x.k] = "C");
  const puntos = def.puntos ? [{nombre:"Punto 1", c:c, obs:""}] : [];
  const id = "prueba-insp-" + Utilities.formatDate(new Date(), "America/Lima", "yyyyMMddHHmmss");
  const datos = {id:id, versionId:vig.versionId, area:ar.nombre, respNombre:"Responsable de prueba", respCargo:"Jefe", firmaInsp:FIRMA, firmaResp:FIRMA, puntos:puntos, criterios:crit,
    resultadoTexto:def.resultado.modo === "texto" ? "Resultado de prueba escrito por el inspector." : ""};
  Logger.log("Formato: %s v%s · Guardar: %s", DOC_INSPECCION, vig.version, JSON.stringify(inspGuardar_(datos, u)));
  Logger.log("Repetir (debe decir repetido): %s", JSON.stringify(inspGuardar_(datos, u)));
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

if (typeof module !== "undefined") module.exports = {inspPorcentaje_, inspCalificacion_};
