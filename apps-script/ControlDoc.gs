/**
 * Control documentario · módulo del backend (Google Apps Script)
 * Pega este archivo como un archivo NUEVO («ControlDoc») en Extensiones > Apps Script, junto a Code.gs, Hallazgos.gs e Inspecciones.gs.
 * Usa de Code.gs: hoja_, bitacora_. Usa de Hallazgos.gs: hzTxt_, hzAhora_, hzHoy_, hzDataUrl_, hzSub_, hzU_, HZ_TIPOS.
 *
 * Un documento (por ejemplo SGA.R.G.002) tiene versiones: Borrador → Vigente → Obsoleta.
 * El formato de cada versión es una «definición» (JSON) que la app usa para armar el formulario y el PDF.
 * Los registros llenados (cada inspección) NO se guardan como archivo: solo como datos.
 * En Drive solo se guarda el PDF en blanco de la versión vigente y de la anterior.
 */

// ===================== 1. REGLAS =====================
const DOC_COLS = ["codigo","titulo","tipo","version","versionId","fechaAprobacion","responsable","creado","eliminado"];
const VER_COLS = ["versionId","codigo","version","estado","definicion","editor","editorNombre","creado","actualizado","aprobador","aprobadorNombre","aprobado","fechaAprobacion","motivo","pdf"];
const CC_COLS  = ["fecha","codigo","version","accion","usuario","nombre","motivo","detalle"];
const DOC_TIPOS = ["Formato","Procedimiento","Instructivo"];
const DOC_RAIZ = "Control documentario";
const DOC_INSPECCION = "SGA.R.G.002";
const DOC_MAX_DEF = 45000;   // caracteres de una definición (celda de Sheets: 50 000)
const DOC_MAX_PDF = 8 * 1024 * 1024;   // PDF de un procedimiento o instructivo (bytes)
// Formato = se llena en la app (su contenido es una «definición»). Procedimiento e Instructivo = cada versión es un PDF subido.
function docEsFormato_(tipo){ return tipo === "Formato"; }
function docPdfData_(s){
  const m = /^data:application\/pdf;base64,([A-Za-z0-9+\/]+={0,2})$/.exec(String(s || "")); if (!m) return null;
  const b64 = m[1], bytes = Math.floor(b64.length * 3 / 4) - ((b64.match(/=+$/) || [""])[0].length);
  return bytes >= 1 && bytes <= DOC_MAX_PDF ? {b64:b64, bytes:bytes} : null;
}
// plantilla mínima de un formato nuevo (se completa en el editor)
function docPlantilla_(titulo){
  return {titulo:titulo, puntos:null, criterios:{grupos:[{nombre:"Criterios de verificación", items:[{t:"Escriba aquí el primer criterio", h:"Otro", auto:""}]}]},
    resultado:{modo:"porcentaje", cortes:{sat:90, ace:70}}, firmas:{insp:"Responsable de la inspección", resp:"Responsable del área inspeccionada"}};
}

// Valida y normaliza una definición de formato. Devuelve {ok, def} o {ok:false, error, campo}.
function docValidarDef_(d){
  d = d || {};
  const T = (v, a, b) => { const s = hzTxt_(v); return s.length >= a && s.length <= b ? s : null; };
  const out = {};
  out.titulo = T(d.titulo, 3, 80); if (out.titulo === null) return {ok:false, error:"def_invalida", campo:"Título del formato (3 a 80 caracteres)"};
  // tabla de puntos (filas agregables): opcional
  if (d.puntos){
    const p = d.puntos, cols = Array.isArray(p.columnas) ? p.columnas : [], ks = {};
    const titulo = T(p.titulo, 3, 60); if (titulo === null) return {ok:false, error:"def_invalida", campo:"Título de la tabla de puntos"};
    const max = Math.floor(Number(p.max)); if (!(max >= 1 && max <= 12)) return {ok:false, error:"def_invalida", campo:"Máximo de puntos (1 a 12)"};
    if (cols.length < 1 || cols.length > 14) return {ok:false, error:"def_invalida", campo:"Columnas de la tabla de puntos (1 a 14)"};
    const C = [];
    for (let i = 0; i < cols.length; i++){
      const c = cols[i] || {}, k = String(c.k || ""), t = T(c.t, 2, 30), color = String(c.color || "");
      if (!/^[a-z0-9]{2,16}$/.test(k) || ks[k]) return {ok:false, error:"def_invalida", campo:"Columna " + (i + 1) + " de la tabla de puntos (clave)"};
      if (t === null) return {ok:false, error:"def_invalida", campo:"Nombre de la columna " + (i + 1) + " de la tabla de puntos (2 a 30 caracteres)"};
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return {ok:false, error:"def_invalida", campo:"Color de la columna «" + t + "»"};
      ks[k] = 1; C.push({k:k, t:t, color:color});
    }
    out.puntos = {titulo:titulo, nota:hzTxt_(p.nota).slice(0, 150), max:max, columnas:C};
  } else out.puntos = null;
  // datos generales configurables (opcional; sin ellos se usa el campo Área de siempre). Fecha, hora e inspector los pone la app.
  if (Array.isArray(d.datos)){
    if (d.datos.length > 12) return {ok:false, error:"def_invalida", campo:"Datos generales (máximo 12 campos)"};
    const ks = {}, D = []; let areas = 0;
    for (let i = 0; i < d.datos.length; i++){
      const c = d.datos[i] || {}, k = String(c.k || ""), t = T(c.t, 2, 40), tipo = String(c.tipo || "");
      if (!/^[a-z0-9]{2,16}$/.test(k) || ks[k]) return {ok:false, error:"def_invalida", campo:"Campo " + (i + 1) + " de los datos generales (clave)"};
      if (t === null) return {ok:false, error:"def_invalida", campo:"Nombre del campo " + (i + 1) + " de los datos generales (2 a 40 caracteres)"};
      if (DOC_TIPOS_DATO.indexOf(tipo) < 0) return {ok:false, error:"def_invalida", campo:"Tipo del campo «" + t + "»"};
      const op = tipo === "lista" ? docOpciones_(c.opciones) : [];
      if (tipo === "lista" && op.length < 2) return {ok:false, error:"def_invalida", campo:"Opciones de la lista «" + t + "» (al menos 2)"};
      if (tipo === "area") areas++;
      ks[k] = 1; D.push({k:k, t:t, tipo:tipo, opciones:op, req:c.req !== false});
    }
    if (areas > 1) return {ok:false, error:"def_invalida", campo:"Solo un campo puede ser de tipo Área"};
    out.datos = D;
  } else out.datos = null;
  // tabla de registro (filas que agrega quien llena: asistentes, equipos, mediciones…), con firma por fila si se quiere
  if (d.registro){
    const r = d.registro, cols = Array.isArray(r.columnas) ? r.columnas : [], ks = {}, C = [];
    const titulo = T(r.titulo, 3, 60); if (titulo === null) return {ok:false, error:"def_invalida", campo:"Título de la tabla de registro"};
    const max = Math.floor(Number(r.max)); if (!(max >= 1 && max <= 60)) return {ok:false, error:"def_invalida", campo:"Máximo de filas de la tabla de registro (1 a 60)"};
    if (cols.length < 1 || cols.length > 10) return {ok:false, error:"def_invalida", campo:"Columnas de la tabla de registro (1 a 10)"};
    for (let i = 0; i < cols.length; i++){
      const c = cols[i] || {}, k = String(c.k || ""), t = T(c.t, 2, 30), tipo = String(c.tipo || "");
      if (!/^[a-z0-9]{2,16}$/.test(k) || ks[k]) return {ok:false, error:"def_invalida", campo:"Columna " + (i + 1) + " de la tabla de registro (clave)"};
      if (t === null) return {ok:false, error:"def_invalida", campo:"Nombre de la columna " + (i + 1) + " de la tabla de registro (2 a 30 caracteres)"};
      if (DOC_TIPOS_COL.indexOf(tipo) < 0) return {ok:false, error:"def_invalida", campo:"Tipo de la columna «" + t + "»"};
      const op = tipo === "lista" ? docOpciones_(c.opciones) : [];
      if (tipo === "lista" && op.length < 2) return {ok:false, error:"def_invalida", campo:"Opciones de la columna «" + t + "» (al menos 2)"};
      ks[k] = 1; C.push({k:k, t:t, tipo:tipo, opciones:op, req:c.req !== false});
    }
    if (C.filter(c => c.tipo === "firma").length > 1) return {ok:false, error:"def_invalida", campo:"Solo una columna de firma en la tabla de registro"};
    out.registro = {titulo:titulo, nota:hzTxt_(r.nota).slice(0, 150), max:max, columnas:C};
  } else out.registro = null;
  // criterios en grupos; se numeran 1..N en el orden en que aparecen. Pueden no existir si el formato es solo un registro.
  const G = d.criterios && Array.isArray(d.criterios.grupos) ? d.criterios.grupos : [];
  if (G.length > 8) return {ok:false, error:"def_invalida", campo:"Grupos de criterios (máximo 8)"};
  if (!G.length && !out.registro) return {ok:false, error:"def_invalida", campo:"El formato necesita criterios o una tabla de registro"};
  let n = 0, autos = 0; const grupos = [];
  for (let g = 0; g < G.length; g++){
    const nombre = T(G[g] && G[g].nombre, 3, 50); if (nombre === null) return {ok:false, error:"def_invalida", campo:"Nombre del grupo " + (g + 1) + " (3 a 50 caracteres)"};
    const I = Array.isArray(G[g].items) ? G[g].items : [];
    if (I.length < 1 || I.length > 20) return {ok:false, error:"def_invalida", campo:"Criterios del grupo «" + nombre + "» (1 a 20)"};
    const items = [];
    for (let i = 0; i < I.length; i++){
      const it = I[i] || {}, t = T(it.t, 3, 200);
      if (t === null) return {ok:false, error:"def_invalida", campo:"Texto de un criterio del grupo «" + nombre + "» (3 a 200 caracteres)"};
      const h = HZ_TIPOS.indexOf(it.h) >= 0 ? it.h : "Otro";
      const auto = it.auto === "puntos" && out.puntos ? "puntos" : "";
      if (auto) autos++;
      items.push({n:++n, t:t, h:h, auto:auto});
    }
    grupos.push({nombre:nombre, items:items});
  }
  if (n > 40) return {ok:false, error:"def_invalida", campo:"Total de criterios (máximo 40)"};
  if (autos > 1) return {ok:false, error:"def_invalida", campo:"Solo un criterio puede calcularse desde la tabla de puntos"};
  out.criterios = {grupos:grupos};
  // resultado: porcentaje de cumplimiento, texto o ninguno
  const R = d.resultado || {};
  if (R.modo === "ninguno" || (!grupos.length && R.modo !== "texto")) out.resultado = {modo:"ninguno"};
  else if (R.modo === "texto"){
    const titulo = T(R.titulo, 3, 60); if (titulo === null) return {ok:false, error:"def_invalida", campo:"Título del resultado"};
    out.resultado = {modo:"texto", titulo:titulo};
  } else {
    const sat = Number(R.cortes && R.cortes.sat), ace = Number(R.cortes && R.cortes.ace);
    if (!(sat > 0 && sat <= 100 && ace > 0 && ace < sat)) return {ok:false, error:"def_invalida", campo:"Cortes del resultado (aceptable menor que satisfactorio, hasta 100 %)"};
    out.resultado = {modo:"porcentaje", cortes:{sat:sat, ace:ace}};
  }
  // firmas: quien llena el formato y, si el título no está vacío, una segunda persona
  const F = d.firmas || {};
  const fi = T(F.insp, 3, 60), fr = hzTxt_(F.resp) ? T(F.resp, 3, 60) : "";
  if (fi === null || fr === null) return {ok:false, error:"def_invalida", campo:"Títulos de las firmas (3 a 60 caracteres)"};
  out.firmas = {insp:fi, resp:fr};
  if (JSON.stringify(out).length > DOC_MAX_DEF) return {ok:false, error:"def_invalida", campo:"El formato es demasiado grande"};
  return {ok:true, def:out};
}

const DOC_TIPOS_DATO = ["texto","numero","fecha","hora","lista","area"];
const DOC_TIPOS_COL = ["texto","numero","fecha","hora","lista","sino","firma"];
function docOpciones_(v){
  const L = (Array.isArray(v) ? v : String(v || "").split(/[,;\n]/)).map(x => hzTxt_(x)).filter(x => x && x.length <= 40);
  return L.filter((x, i) => L.indexOf(x) === i).slice(0, 20);
}

// Resumen automático de qué cambió entre dos definiciones (para el control de cambios)
function docResumenCambios_(a, b){
  if (!a) return "Primera versión.";
  if (!b.criterios || !a.criterios) return "Nuevo PDF del documento.";   // procedimientos e instructivos
  const R = [];
  if (a.titulo !== b.titulo) R.push("Título: «" + a.titulo + "» → «" + b.titulo + "»");
  const txt = d => { const L = []; d.criterios.grupos.forEach(g => g.items.forEach(i => L.push(i.t))); return L; };
  const ta = txt(a), tb = txt(b);
  const quit = ta.filter(t => tb.indexOf(t) < 0), agr = tb.filter(t => ta.indexOf(t) < 0);
  if (ta.length !== tb.length) R.push("Criterios: " + ta.length + " → " + tb.length);
  if (quit.length) R.push("Criterios retirados o modificados: " + quit.length);
  if (agr.length) R.push("Criterios nuevos o modificados: " + agr.length);
  const ga = a.criterios.grupos.map(g => g.nombre).join(" | "), gb = b.criterios.grupos.map(g => g.nombre).join(" | ");
  if (ga !== gb) R.push("Grupos: " + gb);
  const tip = d => { const L = []; d.criterios.grupos.forEach(g => g.items.forEach(i => L.push(i.t + "→" + i.h))); return L.join("|"); };
  if (!agr.length && !quit.length && tip(a) !== tip(b)) R.push("Tipo de hallazgo de algún criterio");
  const pa = a.puntos, pb = b.puntos;
  if (!!pa !== !!pb) R.push(pb ? "Se agrega la tabla de puntos" : "Se quita la tabla de puntos");
  else if (pa && pb){
    if (pa.titulo !== pb.titulo || pa.nota !== pb.nota) R.push("Título o nota de la tabla de puntos");
    if (pa.max !== pb.max) R.push("Máximo de puntos: " + pa.max + " → " + pb.max);
    const ca = pa.columnas.map(c => c.t + c.color).join("|"), cb = pb.columnas.map(c => c.t + c.color).join("|");
    if (ca !== cb) R.push("Columnas de la tabla de puntos: " + pb.columnas.map(c => c.t).join(", "));
  }
  const ra = a.resultado, rb = b.resultado;
  if (ra.modo !== rb.modo) R.push("Resultado: " + ({texto:"texto", porcentaje:"porcentaje", ninguno:"sin resultado"})[rb.modo]);
  else if (rb.modo === "porcentaje" && (ra.cortes.sat !== rb.cortes.sat || ra.cortes.ace !== rb.cortes.ace)) R.push("Cortes: " + ra.cortes.sat + "/" + ra.cortes.ace + " → " + rb.cortes.sat + "/" + rb.cortes.ace);
  else if (rb.modo === "texto" && ra.titulo !== rb.titulo) R.push("Título del resultado");
  if (a.firmas.insp !== b.firmas.insp || a.firmas.resp !== b.firmas.resp) R.push(b.firmas.resp ? "Títulos de las firmas" : "Una sola firma");
  const J = x => JSON.stringify(x || null);
  if (J(a.datos) !== J(b.datos)) R.push(b.datos ? "Datos generales: " + b.datos.map(c => c.t).join(", ") : "Datos generales: los de siempre");
  if (J(a.registro) !== J(b.registro)) R.push(b.registro ? "Tabla de registro: " + b.registro.columnas.map(c => c.t).join(", ") : "Se quita la tabla de registro");
  return (R.length ? R.join(" · ") : "Sin cambios de contenido.").slice(0, 900);
}

function docSigVersion_(L){
  let m = 0; L.forEach(v => { const x = parseInt(v.version, 10); if (x > m) m = x; });
  return ("0" + (m + 1)).slice(-2);
}

// ===================== 2. PERSISTENCIA =====================
function docHoja_(){ return hoja_("Documentos", DOC_COLS, DOC_COLS); }
function verHoja_(){ return hoja_("Versiones", VER_COLS, VER_COLS); }
function ccHoja_(){ return hoja_("ControlCambios", CC_COLS, CC_COLS); }

// Sheets puede convertir "06" en 6 y "2026-11-19" en fecha: al leer se devuelve siempre el texto original
function docCelda_(c, v){
  if (v == null) return "";
  if (v instanceof Date) return Utilities.formatDate(v, "America/Lima", c === "fechaAprobacion" ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm:ss");
  if (c === "version" && typeof v === "number") return ("0" + v).slice(-2);
  return String(v);
}
function docFilas_(sh, cols){
  const n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, cols.length).getValues().map((r, i) => {
    const o = {_fila:i + 2}; cols.forEach((c, j) => o[c] = docCelda_(c, r[j])); return o;
  });
}
function docEscribir_(sh, cols, o){ sh.getRange(o._fila, 1, 1, cols.length).setValues([cols.map(c => o[c] == null ? "" : o[c])]); }
function docCambio_(codigo, version, accion, u, motivo, detalle){
  ccHoja_().appendRow([hzAhora_(), codigo, version, accion, u.usuario, u.nombre, String(motivo || "").slice(0, 500), String(detalle || "").slice(0, 900)]);
}
function docMeta_(v){
  return {versionId:v.versionId, codigo:v.codigo, version:v.version, estado:v.estado, editorNombre:v.editorNombre, creado:v.creado, actualizado:v.actualizado,
    aprobadorNombre:v.aprobadorNombre, aprobado:v.aprobado, fechaAprobacion:v.fechaAprobacion, motivo:v.motivo, tienePdf:!!v.pdf};
}

// La primera vez: crea el documento del formato de inspección con su versión 06 (vigente) y la 07 (borrador por aprobar)
// yaBloqueado: la petición ya tiene el candado del script (acciones que escriben); las lecturas no lo tienen y lo piden aquí
function docSembrar_(yaBloqueado){
  const sh = docHoja_(); if (sh.getLastRow() >= 2) return;
  if (yaBloqueado) return docSembrarAhora_(sh);
  // solo la primera vez: con candado, para que dos pedidos simultáneos (lecturas sin candado) no carguen el documento dos veces
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
  try{ if (sh.getLastRow() < 2) docSembrarAhora_(sh); } finally { lock.releaseLock(); }
}
function docSembrarAhora_(sh){
  const sis = {usuario:"sistema", nombre:"Carga inicial"}, ahora = hzAhora_();
  const v06 = docValidarDef_(DOC_DEF_06).def, v07 = docValidarDef_(DOC_DEF_07).def;
  const id06 = "v-" + Utilities.getUuid().slice(0, 8), id07 = "v-" + Utilities.getUuid().slice(0, 8);
  sh.appendRow([DOC_INSPECCION, "Inspección ambiental de área de trabajo", "Formato", "06", id06, "", "Medio Ambiente", ahora, ""]);
  verHoja_().appendRow([id06, DOC_INSPECCION, "06", "Vigente", JSON.stringify(v06), sis.usuario, sis.nombre, ahora, ahora, "", "", "", "", "Formato vigente en papel (carga inicial).", ""]);
  verHoja_().appendRow([id07, DOC_INSPECCION, "07", "Borrador", JSON.stringify(v07), sis.usuario, sis.nombre, ahora, ahora, "", "", "", "",
    "Se reduce a 9 criterios (se retiran efluentes, toma de conciencia y «Otro», y se unifican criterios redundantes). Se elimina la sección F (custodia del registro) porque no se firma desde la app.", ""]);
  docCambio_(DOC_INSPECCION, "06", "Carga inicial", sis, "Formato vigente en papel.", "Versión 06 cargada como vigente.");
  docCambio_(DOC_INSPECCION, "07", "Borrador creado", sis, "Propuesta de reducción de criterios.", docResumenCambios_(v06, v07));
}

function docVersionPorId_(id){ return docFilas_(verHoja_(), VER_COLS).filter(v => v.versionId === String(id))[0] || null; }
// definición de una versión (para inspecciones); null si no existe o es un borrador
function docDefAprobada_(id){
  const v = docVersionPorId_(id); if (!v || (v.estado !== "Vigente" && v.estado !== "Obsoleta")) return null;   // nunca un borrador ni uno descartado
  try{ return {def:JSON.parse(v.definicion), version:v.version, codigo:v.codigo, versionId:v.versionId}; }catch(e){ return null; }
}
function docVigenteDe_(codigo){
  const d = docFilas_(docHoja_(), DOC_COLS).filter(x => x.codigo === codigo)[0]; if (!d) return null;
  const v = docVersionPorId_(d.versionId); if (!v) return null;
  return {codigo:d.codigo, titulo:d.titulo, version:v.version, versionId:v.versionId, fechaAprobacion:v.fechaAprobacion, def:JSON.parse(v.definicion)};
}

// ===================== 3. ACCIONES =====================
function docListar_(u){
  docSembrar_();
  const V = docFilas_(verHoja_(), VER_COLS);
  return {ok:true, documentos:docFilas_(docHoja_(), DOC_COLS).filter(d => !d.eliminado).map(d => {
    const b = V.filter(v => v.codigo === d.codigo && v.estado === "Borrador")[0];
    return {codigo:d.codigo, titulo:d.titulo, tipo:d.tipo, version:d.version, versionId:d.versionId, fechaAprobacion:d.fechaAprobacion, responsable:d.responsable,
      borrador:b ? {versionId:b.versionId, version:b.version} : null};
  })};
}

function docDetalle_(b, u){
  docSembrar_();
  const codigo = String(b.codigo || "");
  const d = docFilas_(docHoja_(), DOC_COLS).filter(x => x.codigo === codigo)[0]; if (!d) return {ok:false, error:"no_existe"};
  const versiones = docFilas_(verHoja_(), VER_COLS).filter(v => v.codigo === codigo).map(docMeta_).reverse();
  const cambios = docFilas_(ccHoja_(), CC_COLS).filter(c => c.codigo === codigo).reverse().slice(0, 200)
    .map(c => ({fecha:c.fecha, version:c.version, accion:c.accion, nombre:c.nombre, motivo:c.motivo, detalle:c.detalle}));
  return {ok:true, documento:{codigo:d.codigo, titulo:d.titulo, tipo:d.tipo, version:d.version, versionId:d.versionId, fechaAprobacion:d.fechaAprobacion, responsable:d.responsable}, versiones:versiones, cambios:cambios};
}

function docVersion_(b, u){
  const v = docVersionPorId_(b.versionId); if (!v) return {ok:false, error:"no_existe"};
  const d = docFilas_(docHoja_(), DOC_COLS).filter(x => x.codigo === v.codigo)[0];
  return {ok:true, version:Object.assign(docMeta_(v), {titulo:d ? d.titulo : "", definicion:JSON.parse(v.definicion)})};
}

// Formatos con versión vigente, para elegir cuál llenar (con su definición)
function docFormatosVigentes_(u){
  docSembrar_();
  const V = docFilas_(verHoja_(), VER_COLS);
  const L = docFilas_(docHoja_(), DOC_COLS).filter(d => !d.eliminado && docEsFormato_(d.tipo) && d.versionId).map(d => {
    const v = V.filter(x => x.versionId === d.versionId)[0]; if (!v) return null;
    let def = null; try{ def = JSON.parse(v.definicion); }catch(e){}
    return def && def.criterios ? {codigo:d.codigo, titulo:d.titulo, version:v.version, versionId:v.versionId, fechaAprobacion:v.fechaAprobacion, definicion:def} : null;
  }).filter(x => x);
  return {ok:true, formatos:L};
}

// Crea un documento nuevo. Un formato nace con su borrador 01 (plantilla mínima); un procedimiento o instructivo, sin versiones hasta subir su PDF.
function docCrear_(b, u){
  u = hzU_(u); docSembrar_(true);   // doc_crear corre con el candado del script (no está en SIN_TURNO)
  const codigo = hzTxt_(b.codigo).toUpperCase(), titulo = hzTxt_(b.titulo), tipo = String(b.tipo || ""), resp = hzTxt_(b.responsable);
  if (!/^[A-Z0-9][A-Z0-9._-]{2,29}$/.test(codigo)) return {ok:false, error:"codigo_invalido"};
  if (titulo.length < 3 || titulo.length > 80) return {ok:false, error:"titulo_invalido"};
  if (DOC_TIPOS.indexOf(tipo) < 0) return {ok:false, error:"tipo_invalido"};
  if (resp.length < 3 || resp.length > 60) return {ok:false, error:"responsable_invalido"};
  // si el formato viene de un archivo con versión (p. ej. 05 en papel), la primera versión en la app continúa la numeración (06)
  const base = parseInt(b.versionBase, 10), primera = base >= 1 && base <= 98 ? ("0" + (base + 1)).slice(-2) : "01";
  {
    if (docFilas_(docHoja_(), DOC_COLS).some(d => !d.eliminado && d.codigo.toUpperCase() === codigo)) return {ok:false, error:"codigo_existe"};
    const ahora = hzAhora_();
    docHoja_().appendRow([codigo, titulo, tipo, "", "", "", resp, ahora, ""]);
    docCambio_(codigo, "", "Documento creado", u, "", tipo + " · " + titulo + " · responsable: " + resp);
    let versionId = "";
    if (docEsFormato_(tipo)){
      versionId = "v-" + Utilities.getUuid().slice(0, 8);
      verHoja_().appendRow([versionId, codigo, primera, "Borrador", JSON.stringify(docPlantilla_(titulo)), u.usuario, u.nombre, ahora, ahora, "", "", "", "", "Creación del documento.", ""]);
      docCambio_(codigo, primera, "Borrador creado", u, "Creación del documento.", "Plantilla inicial." + (primera !== "01" ? " Continúa la versión " + ("0" + base).slice(-2) + " del documento en papel." : ""));
    }
    bitacora_(u, "Documento creado", codigo + " · " + tipo);
    return {ok:true, codigo:codigo, versionId:versionId};
  }
}

function docVigente_(b, u){
  docSembrar_();
  const x = docVigenteDe_(String(b.codigo || DOC_INSPECCION)); if (!x) return {ok:false, error:"no_existe"};
  return {ok:true, codigo:x.codigo, titulo:x.titulo, version:x.version, versionId:x.versionId, fechaAprobacion:x.fechaAprobacion, definicion:x.def};
}

// Crea o actualiza el borrador del documento (uno por documento)
function docBorradorGuardar_(b, u){
  u = hzU_(u); docSembrar_(true);
  const codigo = String(b.codigo || "");
  const d = docFilas_(docHoja_(), DOC_COLS).filter(x => x.codigo === codigo)[0]; if (!d) return {ok:false, error:"no_existe"};
  const motivo = hzTxt_(b.motivo); if (motivo.length < 5 || motivo.length > 500) return {ok:false, error:"motivo_invalido"};
  const esF = docEsFormato_(d.tipo);
  let val;
  if (esF){ val = docValidarDef_(b.definicion); if (!val.ok) return val; }
  else val = {def:{titulo:d.titulo}};
  const pdf = esF ? null : (b.pdf ? docPdfData_(b.pdf) : null);
  if (!esF && b.pdf && !pdf) return {ok:false, error:"pdf_invalido"};
  const sh = verHoja_(), V = docFilas_(sh, VER_COLS).filter(v => v.codigo === codigo), ahora = hzAhora_();
  let br = V.filter(v => v.estado === "Borrador")[0];
  if (!esF && !pdf && !(br && br.pdf)) return {ok:false, error:"pdf_requerido"};
  const version = br ? br.version : docSigVersion_(V);
  let pdfId = br ? br.pdf : "";
  if (pdf){                                                   // el PDF del borrador va a Drive; reemplaza al anterior del mismo borrador
    const carpeta = hzSub_(hzSub_(DriveApp.getRootFolder(), DOC_RAIZ), codigo);
    const f = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(pdf.b64), "application/pdf", codigo + " v" + version + " (borrador).pdf"));
    if (pdfId){ try{ DriveApp.getFileById(pdfId).setTrashed(true); }catch(e){} }
    pdfId = f.getId();
  }
  if (br){
    br.definicion = JSON.stringify(val.def); br.motivo = motivo; br.actualizado = ahora; br.editor = u.usuario; br.editorNombre = u.nombre; br.pdf = pdfId;
    docEscribir_(sh, VER_COLS, br);
  } else {
    br = {versionId:"v-" + Utilities.getUuid().slice(0, 8), codigo:codigo, version:version, estado:"Borrador", definicion:JSON.stringify(val.def),
      editor:u.usuario, editorNombre:u.nombre, creado:ahora, actualizado:ahora, aprobador:"", aprobadorNombre:"", aprobado:"", fechaAprobacion:"", motivo:motivo, pdf:pdfId};
    sh.appendRow(VER_COLS.map(c => br[c]));
  }
  const vig = docVersionPorId_(d.versionId);
  docCambio_(codigo, br.version, "Borrador guardado", u, motivo, docResumenCambios_(vig ? JSON.parse(vig.definicion) : null, val.def));
  bitacora_(u, "Documento: borrador guardado", codigo + " v" + br.version);
  return {ok:true, versionId:br.versionId, version:br.version};
}

function docBorradorDescartar_(b, u){
  u = hzU_(u);
  const sh = verHoja_(), v = docFilas_(sh, VER_COLS).filter(x => x.versionId === String(b.versionId))[0];
  if (!v) return {ok:false, error:"no_existe"};
  if (v.estado !== "Borrador") return {ok:false, error:"estado_invalido"};
  if (v.pdf){ try{ DriveApp.getFileById(v.pdf).setTrashed(true); }catch(e){} }
  sh.deleteRow(v._fila);
  docCambio_(v.codigo, v.version, "Borrador descartado", u, "", "");
  bitacora_(u, "Documento: borrador descartado", v.codigo + " v" + v.version);
  return {ok:true};
}

// Aprueba el borrador: pasa a Vigente; la vigente anterior queda Obsoleta (no se borra)
function docAprobar_(b, u){
  u = hzU_(u);
  const sh = verHoja_(), V = docFilas_(sh, VER_COLS), v = V.filter(x => x.versionId === String(b.versionId))[0];
  if (!v) return {ok:false, error:"no_existe"};
  if (v.estado !== "Borrador") return {ok:false, error:"estado_invalido"};
  const dsh = docHoja_(), d = docFilas_(dsh, DOC_COLS).filter(x => x.codigo === v.codigo)[0]; if (!d) return {ok:false, error:"no_existe"};
  if (!docEsFormato_(d.tipo) && !v.pdf) return {ok:false, error:"pdf_requerido"};
  const ahora = hzAhora_(), hoy = hzHoy_();
  const ant = V.filter(x => x.versionId === d.versionId)[0];
  if (ant){ ant.estado = "Obsoleta"; ant.actualizado = ahora; docEscribir_(sh, VER_COLS, ant); }
  v.estado = "Vigente"; v.aprobador = u.usuario; v.aprobadorNombre = u.nombre; v.aprobado = ahora; v.fechaAprobacion = hoy; v.actualizado = ahora;
  docEscribir_(sh, VER_COLS, v);
  d.version = v.version; d.versionId = v.versionId; d.fechaAprobacion = hoy; docEscribir_(dsh, DOC_COLS, d);
  if (!docEsFormato_(d.tipo)){                                // el PDF subido pasa a ser el de la versión vigente
    try{ DriveApp.getFileById(v.pdf).setName(v.codigo + " v" + v.version + ".pdf"); }catch(e){}
    docPodar_(v.codigo);
  }
  docCambio_(v.codigo, v.version, "Aprobada (vigente)", u, v.motivo,
    docResumenCambios_(ant ? JSON.parse(ant.definicion) : null, JSON.parse(v.definicion)) + (ant ? " · La versión " + ant.version + " queda obsoleta." : ""));
  bitacora_(u, "Documento aprobado", v.codigo + " v" + v.version);
  return {ok:true, versionId:v.versionId, version:v.version, fechaAprobacion:hoy};
}

// Guarda en Drive el PDF en blanco de la versión vigente; conserva solo el de la vigente y el de la anterior
function docPdfGuardar_(b, u){
  u = hzU_(u);
  const sh = verHoja_(), V = docFilas_(sh, VER_COLS), v = V.filter(x => x.versionId === String(b.versionId))[0];
  if (!v) return {ok:false, error:"no_existe"};
  if (v.estado !== "Vigente") return {ok:false, error:"estado_invalido"};
  const d = docFilas_(docHoja_(), DOC_COLS).filter(x => x.codigo === v.codigo)[0];
  if (!d || !docEsFormato_(d.tipo)) return {ok:false, error:"estado_invalido"};   // los PDF de procedimientos se suben, no se generan
  const p = docPdfData_(b.pdf); if (!p) return {ok:false, error:"pdf_invalido"};
  const carpeta = hzSub_(hzSub_(DriveApp.getRootFolder(), DOC_RAIZ), v.codigo);
  const f = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(p.b64), "application/pdf", v.codigo + " v" + v.version + ".pdf"));
  if (v.pdf){ try{ DriveApp.getFileById(v.pdf).setTrashed(true); }catch(e){} }
  v.pdf = f.getId(); docEscribir_(sh, VER_COLS, v);
  docPodar_(v.codigo);
  docCambio_(v.codigo, v.version, "PDF guardado en Drive", u, "", DOC_RAIZ + "/" + v.codigo);
  return {ok:true};
}

// Elimina un documento de la lista maestra y de los formatos para llenar. Sus versiones se conservan (renombradas)
// para que los registros ya llenados se sigan viendo y reimprimiendo; el código queda libre. Los PDF de Drive van a la papelera.
function docEliminar_(b, u){
  u = hzU_(u);
  const codigo = String(b.codigo || ""), motivo = hzTxt_(b.motivo);
  if (motivo.length < 5 || motivo.length > 500) return {ok:false, error:"motivo_invalido"};
  const dsh = docHoja_(), d = docFilas_(dsh, DOC_COLS).filter(x => x.codigo === codigo && !x.eliminado)[0];
  if (!d) return {ok:false, error:"no_existe"};
  const vsh = verHoja_(), V = docFilas_(vsh, VER_COLS).filter(v => v.codigo === codigo), ids = V.map(v => v.versionId);
  // registros ya llenados con alguna versión del documento (solo para informar)
  let registros = 0;
  try{
    const ish = inspHoja_(), n = ish.getLastRow(), jV = INSP_COLS.indexOf("versionId");
    if (n >= 2) ish.getRange(2, jV + 1, n - 1, 1).getValues().forEach(r => { if (ids.indexOf(String(r[0])) >= 0) registros++; });
  }catch(e){}
  const marca = codigo + "#eliminado-" + Utilities.formatDate(new Date(), "America/Lima", "yyyyMMddHHmmss"), ahora = hzAhora_();
  V.forEach(v => {
    if (v.pdf){ try{ DriveApp.getFileById(v.pdf).setTrashed(true); }catch(e){} v.pdf = ""; }
    if (v.estado === "Borrador") v.estado = "Descartada";
    v.codigo = marca; docEscribir_(vsh, VER_COLS, v);
  });
  d.codigo = marca; d.eliminado = ahora; docEscribir_(dsh, DOC_COLS, d);
  docCambio_(codigo, d.version, "Documento eliminado", u, motivo, (V.length ? V.length + " versión(es) conservadas para el historial" : "Sin versiones") + (registros ? " · " + registros + " registro(s) llenados se siguen pudiendo ver y reimprimir" : ""));
  bitacora_(u, "Documento eliminado", codigo + " · " + motivo);
  return {ok:true, registros:registros};
}

// En Drive se conservan solo el PDF de la vigente y el de la anterior (la obsoleta aprobada más reciente); las demás versiones conservan sus datos
function docPodar_(codigo){
  const sh = verHoja_(), V = docFilas_(sh, VER_COLS);
  const obs = V.filter(x => x.codigo === codigo && x.estado === "Obsoleta").sort((a, c) => a.aprobado < c.aprobado ? 1 : -1);
  obs.slice(1).forEach(x => { if (x.pdf){ try{ DriveApp.getFileById(x.pdf).setTrashed(true); }catch(e){} x.pdf = ""; docEscribir_(sh, VER_COLS, x); } });
}

function docPdf_(b, u){
  const v = docVersionPorId_(b.versionId); if (!v || !v.pdf) return {ok:false, error:"no_existe"};
  const f = DriveApp.getFileById(v.pdf);
  return {ok:true, nombre:f.getName(), dataUrl:"data:application/pdf;base64," + Utilities.base64Encode(f.getBlob().getBytes())};
}

// ===================== 4. FORMATO INICIAL (SGA.R.G.002) =====================
const DOC_PUNTOS_INSPECCION = {titulo:"Segregación de residuos por punto", nota:"NTP 900.058:2019 · C = Conforme | NC = No conforme | NA = No aplica", max:8, columnas:[
  {k:"noaprov", t:"No aprovechable", color:"#1f1f1f"}, {k:"organico", t:"Orgánico", color:"#8b5a2b"}, {k:"papel", t:"Papel y cartón", color:"#1f5fbf"},
  {k:"plastico", t:"Plástico", color:"#ffffff"}, {k:"vidrio", t:"Vidrio", color:"#2e8b3d"}, {k:"metal", t:"Metal", color:"#f2c200"},
  {k:"peligroso", t:"Peligrosos", color:"#d32f2f"}, {k:"mermas", t:"Mermas", color:""}, {k:"rotulacion", t:"Rotulación", color:""}, {k:"delimitacion", t:"Delimitación", color:""}]};
const DOC_FIRMAS_INSPECCION = {insp:"Responsable de Medio Ambiente (inspector)", resp:"Responsable del área inspeccionada"};
const DOC_DEF_06 = {titulo:"Inspección ambiental de área de trabajo", puntos:DOC_PUNTOS_INSPECCION, criterios:{grupos:[
  {nombre:"Residuos sólidos y acopio", items:[
    {t:"Segregación, rotulación y delimitación conformes en todos los puntos (se calcula de la tabla de puntos)", h:"Segregación de residuos", auto:"puntos"},
    {t:"Contenedores en buen estado, con bolsa y letrero de colores NTP 900.058", h:"Almacenamiento y acopio"},
    {t:"Sin sobrellenado ni residuos fuera del contenedor; punto limpio y ordenado", h:"Almacenamiento y acopio"},
    {t:"Envolturas laminadas / metalizadas segregadas según instructivo", h:"Segregación de residuos"},
    {t:"Mermas y subproductos separados, identificados y con destino registrado", h:"Segregación de residuos"},
    {t:"Acopio temporal en condiciones (techo, piso, señalización, contención)", h:"Almacenamiento y acopio"}]},
  {nombre:"Peligrosos y químicos", items:[
    {t:"Residuos peligrosos y RAEE en recipiente cerrado y rotulado", h:"Almacenamiento y acopio"},
    {t:"Químicos almacenados según FDS, con bandeja antiderrame y rótulo", h:"Almacenamiento y acopio"},
    {t:"Kit antiderrames completo y accesible", h:"Derrames y fugas"}]},
  {nombre:"Efluentes y emisiones", items:[
    {t:"Trampas de grasa operativas", h:"Efluentes y desagües"},
    {t:"Efluentes de lavado CIP neutralizados antes de descargar", h:"Efluentes y desagües"},
    {t:"Sin humo, olores, polvo ni fugas de refrigerante anormales", h:"Otro"}]},
  {nombre:"Energía, agua e inocuidad", items:[
    {t:"Sin fugas de agua, vapor, aire o gas; equipos apagados si no se usan", h:"Uso de agua y energía"},
    {t:"Flujómetros operativos", h:"Uso de agua y energía"},
    {t:"Residuos en zona de proceso sin riesgo de plagas ni contaminación cruzada", h:"Orden y limpieza"}]},
  {nombre:"Toma de conciencia", items:[
    {t:"Personal conoce aspectos ambientales, colores y respuesta a derrames", h:"Otro"},
    {t:"Otro", h:"Otro"}]}]},
  resultado:{modo:"porcentaje", cortes:{sat:90, ace:70}}, firmas:DOC_FIRMAS_INSPECCION};
const DOC_DEF_07 = {titulo:"Inspección ambiental de área de trabajo", puntos:DOC_PUNTOS_INSPECCION, criterios:{grupos:[
  {nombre:"Residuos sólidos y acopio", items:[
    {t:"Segregación, rotulación y delimitación conformes en todos los puntos (se calcula de la tabla de puntos)", h:"Segregación de residuos", auto:"puntos"},
    {t:"Contenedores en buen estado y con bolsa", h:"Almacenamiento y acopio"},
    {t:"Sin sobrellenado ni residuos fuera del contenedor; zona limpia, sin riesgo de plagas ni contaminación cruzada", h:"Orden y limpieza"},
    {t:"Mermas, subproductos y envolturas laminadas segregados, con destino registrado", h:"Segregación de residuos"},
    {t:"Acopio temporal en condiciones (techo, piso, señalización, contención)", h:"Almacenamiento y acopio"}]},
  {nombre:"Peligrosos y químicos", items:[
    {t:"Residuos peligrosos y RAEE en recipiente cerrado y rotulado", h:"Almacenamiento y acopio"},
    {t:"Químicos con FDS y bandeja antiderrame; kit antiderrames completo y accesible", h:"Almacenamiento y acopio"}]},
  {nombre:"Emisiones, agua y energía", items:[
    {t:"Sin humo, olores, polvo ni fugas de refrigerante anormales", h:"Otro"},
    {t:"Sin fugas de agua, vapor, aire o gas; equipos apagados si no se usan; flujómetros operativos", h:"Uso de agua y energía"}]}]},
  resultado:{modo:"porcentaje", cortes:{sat:90, ace:70}}, firmas:DOC_FIRMAS_INSPECCION};

if (typeof module !== "undefined") module.exports = {docOpciones_, docPdfData_, docPlantilla_, docValidarDef_, docResumenCambios_, docSigVersion_, DOC_DEF_06, DOC_DEF_07};
