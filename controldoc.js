/* Control documentario · lista maestra, versiones, control de cambios y editor de formatos por bloques.
   Una versión pasa de Borrador a Vigente al aprobarse; la anterior queda Obsoleta (no se borra).
   Al aprobar, se guarda en Drive el PDF en blanco de la nueva versión (el servidor conserva solo la vigente y la anterior).
   Usa: esc, toast, postJ, can, SES, TAB y window.INSP_FORMATO (de inspecciones.js) para armar el PDF. */
(function(){
"use strict";

const TIPOS_HZ = ["Segregación de residuos","Almacenamiento y acopio","Derrames y fugas","Efluentes y desagües","Orden y limpieza","Uso de agua y energía","Otro"];
const COLORES = [["","Sin color"],["#1f1f1f","Negro"],["#8b5a2b","Marrón"],["#1f5fbf","Azul"],["#ffffff","Blanco"],["#2e8b3d","Verde"],["#f2c200","Amarillo"],["#d32f2f","Rojo"],["#8a8077","Gris"],["#e07b1f","Naranja"]];
const ERR = {
  accion:"El servidor todavía no tiene el módulo de Control documentario. Pegue Code.gs, ControlDoc.gs e Inspecciones.gs en el script y publique una nueva versión.", codigo_invalido:"El código debe tener de 3 a 30 caracteres: letras, números, punto o guion (por ejemplo SGA.R.G.010).", codigo_existe:"Ya existe un documento con ese código.",
  titulo_invalido:"Escriba el título (3 a 80 caracteres).", tipo_invalido:"Elija el tipo de documento.", responsable_invalido:"Escriba el responsable (3 a 60 caracteres).",
  pdf_requerido:"Adjunte el PDF del documento.",
  motivo_invalido:"Escriba el motivo del cambio (mínimo 5 letras).", estado_invalido:"Esta versión ya no es un borrador. Actualice la pantalla.",
  no_existe:"El documento o la versión ya no existe. Actualice la pantalla.", permiso:"No tiene permiso para esta acción.", pdf_invalido:"El PDF no es válido o pesa demasiado.",
  planta_bloqueada:"Esta planta apunta a una hoja distinta de la copia de prueba. Revise la pestaña Plantas.",
  clave:"El servidor no reconoce esta acción. Falta pegar ControlDoc.gs (y Code.gs) y publicar una nueva versión del script."
};
const S = {vista:"lista", docs:null, err:"", sel:null, det:null, E:null, ocupado:false, verCambios:10,
  N:{codigo:"", titulo:"", tipo:"Formato", responsable:"Medio Ambiente"}, P:null};     // N = nuevo documento; P = subir PDF de una versión
const MAX_PDF = 8 * 1024 * 1024;
const EDK = "doc_edicion:";

const st = document.createElement("style");
st.textContent = `
.dc-row{display:block;width:100%;text-align:left;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px;margin:8px 0;font:inherit;color:inherit}
.dc-row .l1{display:flex;justify-content:space-between;align-items:center;gap:8px}.dc-row .m{font-size:12.5px;color:var(--gray);margin-top:3px}
.dc-b{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700;background:#f1ebe4;color:var(--brown)}
.dc-b.vig{background:#e8f3ea;color:var(--ok)}.dc-b.bor{background:#fff3e0;color:#b25e00}.dc-b.obs{background:#eee;color:#777}
.dc-li{border-top:1px solid var(--line);padding:9px 0;font-size:13.5px}.dc-li:first-of-type{border-top:0}
.dc-li .m{font-size:12.5px;color:var(--gray);margin-top:2px}
.dc-ed .in{width:100%;box-sizing:border-box}
.dc-it{border:1px solid var(--line);border-radius:12px;padding:10px;margin:8px 0;background:#faf7f3}
.dc-it textarea{min-height:52px}
.dc-tools{display:flex;gap:6px;justify-content:flex-end;margin-top:6px}
.dc-tools button{border:1px solid var(--line);background:#fff;border-radius:8px;min-width:36px;height:32px;font-weight:700;color:var(--brown)}
.dc-tools button:disabled{opacity:.35}
.dc-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dc-col{display:grid;grid-template-columns:1fr 120px;gap:8px;align-items:center}
.dc-chk{display:flex;gap:8px;align-items:center;font-size:14px;margin:8px 0}
.dc-chk input{width:18px;height:18px}
.dc-op{display:flex;gap:8px;margin:6px 0}.dc-op label{flex:1;border:1.5px solid var(--line);border-radius:10px;padding:10px;text-align:center;font-weight:600;font-size:14px;cursor:pointer}
.dc-op input{display:none}
.dc-ed label.btn{display:inline-flex;align-items:center;justify-content:center;margin:0;cursor:pointer}
.dc-imp{background:#f6efe8;border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:8px 0;font-size:13.5px}.dc-imp .m{font-size:12.5px;color:var(--gray);margin-top:3px}.dc-op label.on{border-color:var(--brown);background:#f6efe8;color:var(--brown)}
`;
document.head.appendChild(st);

const box = () => document.getElementById("doc-body");
const F = () => window.INSP_FORMATO;
const fecha = s => s ? String(s).slice(8,10) + "/" + String(s).slice(5,7) + "/" + String(s).slice(0,4) : "";
const fh = s => s ? fecha(s) + " " + String(s).slice(11,16) : "";
const copia = o => JSON.parse(JSON.stringify(o));
const msg = j => (j && (j.error === "def_invalida" && j.campo ? "Revise: " + j.campo + "." : ERR[j.error])) || "No se pudo completar. Intente de nuevo.";

const cargaJS = src => new Promise((ok, no) => { if(window.__jsD && window.__jsD[src]) return ok(); const e = document.createElement("script"); e.src = src; e.onload = () => { (window.__jsD = window.__jsD || {})[src] = 1; ok(); }; e.onerror = () => no(new Error("No se pudo cargar el lector de archivos. Revise su señal.")); document.head.appendChild(e); });
// lee un Word o Excel en el equipo (no se envía a ningún servidor) y devuelve la estructura reconocida
async function importa(file){
  await cargaJS("lib/jszip.min.js"); await cargaJS("importar.js");
  if(file.size > 15 * 1048576) throw new Error("El archivo pesa más de 15 MB.");
  return window.IMPORTAR.leer(file);
}
const resumenImp = (r, nombre) => `<div class="dc-imp"><b>📄 ${esc(nombre)}</b><div>Se reconoció: ${esc(r.resumen.join(" · "))}${r.version ? " · versión " + esc(r.version) + " en el archivo" : ""}.</div>${r.avisos.map(a => `<div class="m">• ${esc(a)}</div>`).join("")}<div class="m">Es una base: revise y afine todo en el editor antes de aprobar.</div></div>`;

/* ---------- datos ---------- */
async function cargaDocs(){
  try{ const j = await postJ({action:"docs_listar"}); if(j && j.ok){ S.docs = j.documentos; S.err = ""; } else if(!(j && (j.error === "sesion" || j.error === "cambiar_clave"))) S.err = msg(j); }
  catch(e){ S.err = "Sin señal. Intente de nuevo."; }
  if(S.vista === "lista") repinta();
}
async function cargaDetalle(codigo){
  S.det = null; repinta();
  try{ const j = await postJ({action:"doc_detalle", codigo:codigo}); if(j && j.ok){ S.det = j; S.err = ""; } else S.err = msg(j); }
  catch(e){ S.err = "Sin señal. Intente de nuevo."; }
  if(S.vista === "detalle") repinta();
}
async function version(versionId){
  const j = await postJ({action:"doc_version", versionId:versionId});
  if(!(j && j.ok)) throw new Error(msg(j));
  return j.version;
}

/* ---------- pantallas ---------- */
function drawDoc(){ if(!box()) return; repinta(); if(S.vista === "lista") cargaDocs(); }
function repinta(){
  if(!box() || TAB !== "doc") return;
  if(S.vista === "editor") return pintaEditor();
  if(S.vista === "nuevo") return pintaNuevo();
  if(S.vista === "subir") return pintaSubir();
  if(S.vista === "detalle") return pintaDetalle();
  pintaLista();
}
function pintaLista(){
  const L = S.docs;
  box().innerHTML = (S.err ? `<div class="err">${esc(S.err)}</div>` : "") +
    (can("doc_editar") ? `<div class="in-top"><button class="btn" style="flex:1" data-dc="nuevo">＋ Nuevo documento</button></div>` : "") +
    `<div class="in-card"><h3>Lista maestra</h3><p class="s">Documentos controlados del sistema de gestión ambiental. Toque uno para ver sus versiones, editarlo o aprobarlo.</p></div>` +
    (L === null ? `<div class="card muted">Cargando…</div>` : !L.length ? `<div class="card muted">No hay documentos.</div>` : L.map(d =>
      `<button class="dc-row" data-dc-ver="${esc(d.codigo)}"><div class="l1"><b>${esc(d.codigo)}</b>${d.version ? `<span class="dc-b vig">Versión ${esc(d.version)}</span>` : `<span class="dc-b obs">Sin versión vigente</span>`}</div>
        <div>${esc(d.titulo)}</div><div class="m">${esc(d.tipo)} · ${d.fechaAprobacion ? "aprobada el " + fecha(d.fechaAprobacion) : "sin fecha de aprobación"}${d.borrador ? ` · <span class="dc-b bor">Borrador ${esc(d.borrador.version)} en curso</span>` : ""}</div></button>`).join(""));
}
const badge = e => `<span class="dc-b ${e === "Vigente" ? "vig" : e === "Borrador" ? "bor" : "obs"}">${esc(e)}</span>`;
function pintaDetalle(){
  const D = S.det;
  if(!D){ box().innerHTML = `<div class="in-top"><button class="btn sec sm" data-dc="lista">← Documentos</button></div>` + (S.err ? `<div class="err">${esc(S.err)}</div>` : `<div class="card muted">Cargando…</div>`); return; }
  const d = D.documento, br = D.versiones.filter(v => v.estado === "Borrador")[0], vig = D.versiones.filter(v => v.estado === "Vigente")[0];
  const cam = D.cambios.slice(0, S.verCambios), esF = d.tipo === "Formato";
  box().innerHTML = `<div class="in-top"><button class="btn sec sm" data-dc="lista">← Documentos</button></div>` +
    (S.err ? `<div class="err">${esc(S.err)}</div>` : "") +
    `<div class="in-card"><h3>${esc(d.codigo)} · ${esc(d.titulo)}</h3>
      <div class="hz-kv"><span>Tipo</span><span>${esc(d.tipo)}</span><span>Versión vigente</span><span>${vig ? esc(d.version) + (d.fechaAprobacion ? " · aprobada el " + fecha(d.fechaAprobacion) : "") : "Ninguna todavía"}</span><span>Responsable</span><span>${esc(d.responsable)}</span></div>
      ${vig ? `<div class="in-top"><button class="btn sec" style="flex:1" data-dc="${esF ? "pdf-vig" : "ver-pdf"}" data-v="${esc(vig.versionId)}">PDF de la versión vigente</button></div>` : ""}</div>` +
    (br ? `<div class="in-card"><h3>Borrador · versión ${esc(br.version)}</h3><p class="s">Editado por ${esc(br.editorNombre)} el ${fh(br.actualizado)}.<br>Motivo: ${esc(br.motivo)}</p>
      <div class="in-top">${can("doc_editar") ? `<button class="btn sec" style="flex:1" data-dc="${esF ? "editar" : "subir"}" data-v="${esc(br.versionId)}">${esF ? "Editar" : "Cambiar PDF o motivo"}</button>` : ""}<button class="btn sec" style="flex:1" data-dc="${esF ? "previa" : "ver-pdf"}" data-v="${esc(br.versionId)}">${esF ? "Vista previa" : "Ver PDF"}</button></div>
      <div class="in-top">${can("doc_aprobar") ? `<button class="btn" style="flex:2" data-dc="aprobar" data-v="${esc(br.versionId)}" ${S.ocupado ? "disabled" : ""}>${S.ocupado ? "Aprobando…" : "Aprobar versión " + esc(br.version)}</button>` : ""}${can("doc_editar") ? `<button class="btn sec" style="flex:1" data-dc="descartar" data-v="${esc(br.versionId)}">Descartar</button>` : ""}</div></div>`
      : can("doc_editar") ? `<div class="in-top"><button class="btn" style="flex:1" data-dc="${esF ? "editar" : "subir"}" data-v="">${esF ? "Editar formato (nueva versión)" : vig ? "Nueva versión (subir PDF)" : "Subir el PDF de la primera versión"}</button></div>` : "") +
    `<div class="in-card"><h3>Versiones</h3>${D.versiones.map(v => `<div class="dc-li"><div class="l1" style="display:flex;justify-content:space-between;gap:8px"><b>Versión ${esc(v.version)}</b>${badge(v.estado)}</div>
      <div class="m">${v.aprobado ? "Aprobada por " + esc(v.aprobadorNombre) + " el " + fecha(v.fechaAprobacion) : v.estado === "Borrador" ? "En edición por " + esc(v.editorNombre) : "Carga inicial"}${v.tienePdf ? ` · <a href="#" data-dc="ver-pdf" data-v="${esc(v.versionId)}">PDF en Drive</a>` : ""}</div>
      ${v.motivo ? `<div class="m">${esc(v.motivo)}</div>` : ""}</div>`).join("")}</div>` +
    `<div class="in-card"><h3>Control de cambios</h3>${cam.map(c => `<div class="dc-li"><b>${esc(c.accion)}</b> · versión ${esc(c.version)}<div class="m">${fh(c.fecha)} · ${esc(c.nombre)}</div>${c.motivo ? `<div class="m">Motivo: ${esc(c.motivo)}</div>` : ""}${c.detalle ? `<div class="m">${esc(c.detalle)}</div>` : ""}</div>`).join("")}
      ${D.cambios.length > S.verCambios ? `<button class="btn sec sm" data-dc="mas">Ver más</button>` : ""}</div>`;
}

/* ---------- nuevo documento ---------- */
function pintaNuevo(){
  const N = S.N;
  box().innerHTML = `<div class="dc-ed"><div class="in-top"><button class="btn sec sm" data-dc="lista">← Documentos</button></div>
    <div class="in-card"><h3>Nuevo documento</h3>
      <label class="f">Tipo</label><div class="dc-op">${["Formato","Procedimiento","Instructivo"].map(t => `<label class="${N.tipo === t ? "on" : ""}"><input type="radio" name="dc-tipo" data-dc="tipo" data-t="${t}">${t}</label>`).join("")}</div>
      <p class="s">${N.tipo === "Formato" ? "Un formato se arma en el editor y, al aprobarlo, se puede llenar en Inspecciones." : "Cada versión se sube como PDF (hecho en Word u otro programa)."}</p>
      ${N.tipo === "Formato" ? `<label class="f">Partir de un archivo (opcional)</label>
      ${N.imp ? resumenImp(N.imp, N.impNombre) + `<div class="in-top"><label class="btn sec sm">Cambiar archivo<input type="file" accept=".docx,.xlsx" data-dc-imp="nuevo" hidden></label><button type="button" class="btn sec sm" data-dc="imp-quita">Quitar</button></div>`
        : `<label class="btn sec" style="display:block;text-align:center">${S.leyendo ? "Leyendo el archivo…" : "📄 Importar desde Word o Excel"}<input type="file" accept=".docx,.xlsx" data-dc-imp="nuevo" hidden></label><p class="s">Se reconocen el código, el título, la versión, los criterios y la tabla de puntos. El archivo no se sube a ningún servidor.</p>`}` : ""}
      <label class="f">Código</label><input class="in" data-dc-n="codigo" maxlength="30" autocomplete="off" placeholder="Por ejemplo SGA.R.G.010" value="${esc(N.codigo)}">
      <label class="f">Título</label><input class="in" data-dc-n="titulo" maxlength="80" autocomplete="off" value="${esc(N.titulo)}">
      <label class="f">Responsable</label><input class="in" data-dc-n="responsable" maxlength="60" autocomplete="off" value="${esc(N.responsable)}"></div>
    <div class="err" id="dc-err">${esc(S.err)}</div>
    <div class="in-top"><button class="btn" style="flex:1" data-dc="crear" ${S.ocupado ? "disabled" : ""}>${S.ocupado ? "Creando…" : "Crear documento"}</button></div></div>`;
}
async function crear(){
  if(S.ocupado) return;
  const N = S.N, T = (x, a, b) => { x = String(x || "").trim(); return x.length >= a && x.length <= b; };
  S.err = !/^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/.test(N.codigo.trim()) ? ERR.codigo_invalido : !T(N.titulo, 3, 80) ? ERR.titulo_invalido : !T(N.responsable, 3, 60) ? ERR.responsable_invalido : "";
  if(S.err) return pintaNuevo();
  S.ocupado = true; pintaNuevo();
  try{
    const imp = N.tipo === "Formato" ? N.imp : null;
    const j = await postJ({action:"doc_crear", codigo:N.codigo.trim(), titulo:N.titulo.trim(), tipo:N.tipo, responsable:N.responsable.trim(), versionBase:imp && imp.version || ""}, 60000);
    S.ocupado = false;
    if(!(j && j.ok)){ S.err = msg(j); return pintaNuevo(); }
    toast("Documento " + j.codigo + " creado");
    if(imp && j.versionId){                                 // la estructura importada pasa al borrador
      imp.def.titulo = N.titulo.trim().slice(0, 80);
      const k = await postJ({action:"doc_borrador_guardar", codigo:j.codigo, definicion:imp.def, motivo:"Importado de " + N.impNombre + (imp.version ? " (versión " + imp.version + " en papel)" : "") + "."}, 60000);
      if(!(k && k.ok)) toast("El documento se creó, pero la estructura importada no se guardó: " + msg(k));
    }
    S.N = {codigo:"", titulo:"", tipo:"Formato", responsable:"Medio Ambiente"}; S.sel = j.codigo; S.vista = "detalle"; S.err = ""; window.scrollTo(0, 0);
    await cargaDetalle(j.codigo);
    if(j.versionId && S.det) abreEditor(j.versionId);       // un formato nuevo se abre directo en el editor
    else if(S.det){ S.P = {motivo:"Primera versión.", pdf:null, nombre:""}; S.vista = "subir"; repinta(); }
  }catch(e){ S.ocupado = false; S.err = "Sin señal. Intente de nuevo."; pintaNuevo(); }
}

/* ---------- subir el PDF de una versión (procedimientos e instructivos) ---------- */
function pintaSubir(){
  const D = S.det, P = S.P, br = D.versiones.filter(v => v.estado === "Borrador")[0];
  box().innerHTML = `<div class="dc-ed"><div class="in-top"><button class="btn sec sm" data-dc="volver">← Cancelar</button></div>
    <div class="in-card"><h3>${esc(D.documento.codigo)} · ${br ? "borrador versión " + esc(br.version) : "nueva versión"}</h3><p class="s">${esc(D.documento.titulo)}</p>
      <label class="f">PDF del documento</label>
      <label class="btn sec" style="display:block;text-align:center">${P.nombre ? "📄 " + esc(P.nombre) + " · cambiar" : br ? "Cambiar el PDF (opcional)" : "Elegir el PDF"}<input type="file" accept="application/pdf,.pdf" data-dc-pdf="1" hidden></label>
      <p class="s">Máximo 8 MB.${br && !P.nombre ? " Si no elige otro, se mantiene el PDF ya subido." : ""}</p>
      <label class="f">Motivo del cambio</label><textarea class="in" data-dc-m="1" maxlength="500" placeholder="¿Qué se cambia y por qué? (queda en el control de cambios)">${esc(P.motivo)}</textarea></div>
    <div class="err" id="dc-err">${esc(S.err)}</div>
    <div class="in-top"><button class="btn" style="flex:1" data-dc="subir-guardar" ${S.ocupado ? "disabled" : ""}>${S.ocupado ? "Guardando…" : "Guardar borrador"}</button></div></div>`;
}
async function subirGuardar(){
  const D = S.det, P = S.P, br = D.versiones.filter(v => v.estado === "Borrador")[0]; if(S.ocupado) return;
  S.err = !P.pdf && !br ? ERR.pdf_requerido : String(P.motivo || "").trim().length < 5 ? ERR.motivo_invalido : "";
  if(S.err) return pintaSubir();
  S.ocupado = true; pintaSubir();
  try{
    const j = await postJ(Object.assign({action:"doc_borrador_guardar", codigo:D.documento.codigo, motivo:P.motivo.trim()}, P.pdf ? {pdf:P.pdf} : {}), 180000);
    S.ocupado = false;
    if(!(j && j.ok)){ S.err = msg(j); return pintaSubir(); }
    toast("Borrador " + j.version + " guardado"); S.P = null; S.vista = "detalle"; S.err = ""; window.scrollTo(0, 0); cargaDetalle(D.documento.codigo);
  }catch(e){ S.ocupado = false; S.err = "Sin señal o el PDF es muy pesado para su conexión. Intente de nuevo."; pintaSubir(); }
}
async function verPdf(versionId, btn){
  await conBoton(btn, "Abriendo…", async () => {
    const j = await postJ({action:"doc_pdf", versionId:versionId}, 90000);
    if(!(j && j.ok)) throw new Error("No se encontró el PDF de esta versión.");
    const b = await (await fetch(j.dataUrl)).blob(); muestra(new File([b], j.nombre, {type:"application/pdf"}));
  });
}

/* ---------- editor de formato ---------- */
// S.E = {codigo, base:{versionId, version} | null, def, motivo}
function guardaLocal(){ try{ if(S.E) localStorage.setItem(EDK + S.E.codigo, JSON.stringify(S.E)); }catch(e){} }
function leeLocal(codigo){ try{ const t = localStorage.getItem(EDK + codigo); return t ? JSON.parse(t) : null; }catch(e){ return null; } }
function borraLocal(codigo){ try{ localStorage.removeItem(EDK + codigo); }catch(e){} }
async function abreEditor(versionId){
  const D = S.det, d = D.documento, local = leeLocal(d.codigo), br = D.versiones.filter(v => v.estado === "Borrador")[0];
  if(local && confirm("Hay cambios sin guardar de una edición anterior en este equipo. ¿Recuperarlos?")){ S.E = local; S.vista = "editor"; S.err = ""; return repinta(); }
  borraLocal(d.codigo);
  if(!versionId && !d.versionId){                           // formato sin versión vigente ni borrador: se parte de la plantilla mínima
    S.E = {codigo:d.codigo, borrador:null, motivo:"Primera versión.", def:{titulo:d.titulo, puntos:null, criterios:{grupos:[{nombre:"Criterios de verificación", items:[{t:"Escriba aquí el primer criterio", h:"Otro", auto:""}]}]},
      resultado:{modo:"porcentaje", cortes:{sat:90, ace:70}}, firmas:{insp:"Responsable de la inspección", resp:"Responsable del área inspeccionada"}}};
    S.vista = "editor"; S.err = ""; window.scrollTo(0, 0); return repinta();
  }
  try{
    const v = await version(versionId || d.versionId);      // el borrador, o la vigente como punto de partida
    S.E = {codigo:d.codigo, borrador:br ? br.version : null, def:copia(v.definicion), motivo:versionId ? v.motivo || "" : ""};
    S.vista = "editor"; S.err = ""; window.scrollTo(0, 0); repinta();
  }catch(e){ S.err = e.message || "Sin señal. Intente de nuevo."; repinta(); }
}
const tools = (accion, i, n, extra) => `<div class="dc-tools"><button type="button" data-dc="${accion}-sube" data-i="${i}" ${i === 0 ? "disabled" : ""} title="Subir">↑</button><button type="button" data-dc="${accion}-baja" data-i="${i}" ${i === n - 1 ? "disabled" : ""} title="Bajar">↓</button><button type="button" data-dc="${accion}-quita" data-i="${i}" title="Quitar">✕</button>${extra || ""}</div>`;
function pintaEditor(){
  const E = S.E; if(!E) return;
  const d = E.def, P = d.puntos, R = d.resultado;
  let n = 0;
  box().innerHTML = `<div class="dc-ed"><div class="in-top" style="justify-content:space-between"><button class="btn sec sm" data-dc="cancelar">← Cancelar</button><label class="btn sec sm">${S.leyendo ? "Leyendo…" : "📄 Importar de Word o Excel"}<input type="file" accept=".docx,.xlsx" data-dc-imp="editor" hidden></label></div>
    ${E.impNombre ? resumenImp(E.imp, E.impNombre) : ""}
    <div class="in-card"><h3>Encabezado</h3><p class="s">${esc(E.codigo)} · ${E.borrador ? "borrador versión " + esc(E.borrador) : "nueva versión (se numera al guardar)"}</p>
      <label class="f">Título del formato</label><input class="in" data-dc-f="titulo" maxlength="80" value="${esc(d.titulo)}"></div>
    <div class="in-card"><h3>Tabla de puntos</h3><p class="s">Filas que agrega quien llena el formato (por ejemplo, puntos de segregación), con columnas C / NC / N/A.</p>
      <label class="dc-chk"><input type="checkbox" data-dc="puntos-usa" ${P ? "checked" : ""}> Usar tabla de puntos</label>
      ${P ? `<label class="f">Título de la tabla</label><input class="in" data-dc-f="p.titulo" maxlength="60" value="${esc(P.titulo)}">
      <div class="dc-2"><div><label class="f">Nota (opcional)</label><input class="in" data-dc-f="p.nota" maxlength="150" value="${esc(P.nota || "")}"></div><div><label class="f">Máximo de puntos</label><input class="in" type="number" min="1" max="12" data-dc-f="p.max" value="${esc(P.max)}"></div></div>
      <label class="f">Columnas</label>
      ${P.columnas.map((c, i) => `<div class="dc-it"><div class="dc-col"><input class="in" data-dc-f="col.${i}.t" maxlength="30" value="${esc(c.t)}" placeholder="Nombre de la columna">
        <select class="in" data-dc-f="col.${i}.color">${COLORES.map(([v, t]) => `<option value="${v}" ${(c.color || "").toLowerCase() === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>${tools("col", i, P.columnas.length)}</div>`).join("")}
      ${P.columnas.length < 14 ? `<button type="button" class="btn sec sm" data-dc="col-agrega">＋ Agregar columna</button>` : ""}
      <label class="f">Criterio que se calcula con esta tabla</label><select class="in" data-dc-auto="1"><option value="">Ninguno (todos se marcan a mano)</option>${(() => { let k = 0; return d.criterios.grupos.map((g, gi) => g.items.map((it, ii) => { k++; return `<option value="${gi}.${ii}" ${it.auto === "puntos" ? "selected" : ""}>${k}. ${esc((it.t || "(sin texto)").slice(0, 60))}</option>`; }).join("")).join(""); })()}</select>
      <p class="s">Ese criterio será «no conforme» si algún punto tiene NC, y conforme si todos están conformes.</p>` : ""}</div>
    <div class="in-card"><h3>Criterios de inspección</h3><p class="s">Se numeran solos en el orden en que aparecen. El tipo de hallazgo es el que se crea si el criterio es «no conforme».</p>
      ${d.criterios.grupos.map((g, gi) => `<div class="dc-it" style="background:#fff">
        <label class="f">Grupo</label><input class="in" data-dc-f="g.${gi}.nombre" maxlength="50" value="${esc(g.nombre)}">${tools("grp", gi, d.criterios.grupos.length)}
        ${g.items.map((it, ii) => { n++; return `<div class="dc-it"><label class="f">Criterio ${n}</label><textarea class="in" data-dc-f="it.${gi}.${ii}.t" maxlength="200">${esc(it.t)}</textarea>
          ${it.auto === "puntos" && P ? `<p class="s" style="margin:4px 0">Se calcula con la tabla de puntos.</p>` : ""}
          <label class="f" style="margin-top:6px">Tipo de hallazgo si es «no conforme»</label><select class="in" data-dc-f="it.${gi}.${ii}.h">${TIPOS_HZ.map(t => `<option ${it.h === t ? "selected" : ""}>${t}</option>`).join("")}</select>
          ${tools("it", ii, g.items.length, "").replace(/data-i="/g, `data-g="${gi}" data-i="`)}</div>`; }).join("")}
        ${g.items.length < 20 ? `<button type="button" class="btn sec sm" data-dc="it-agrega" data-g="${gi}">＋ Agregar criterio</button>` : ""}</div>`).join("")}
      ${d.criterios.grupos.length < 8 ? `<button type="button" class="btn sec sm" data-dc="grp-agrega">＋ Agregar grupo</button>` : ""}</div>
    <div class="in-card"><h3>Resultado</h3>
      <div class="dc-op"><label class="${R.modo !== "texto" ? "on" : ""}"><input type="radio" name="dc-res" data-dc="res-pct">% de cumplimiento</label><label class="${R.modo === "texto" ? "on" : ""}"><input type="radio" name="dc-res" data-dc="res-txt">Texto</label></div>
      ${R.modo === "texto" ? `<label class="f">Título del campo</label><input class="in" data-dc-f="r.titulo" maxlength="60" value="${esc(R.titulo || "")}"><p class="s">El inspector escribe los resultados de la inspección.</p>`
        : `<div class="dc-2"><div><label class="f">Satisfactorio desde (%)</label><input class="in" type="number" min="1" max="100" data-dc-f="r.sat" value="${esc(R.cortes.sat)}"></div><div><label class="f">Aceptable desde (%)</label><input class="in" type="number" min="1" max="99" data-dc-f="r.ace" value="${esc(R.cortes.ace)}"></div></div><p class="s">Por debajo del aceptable: no satisfactorio. Los N/A no cuentan.</p>`}</div>
    <div class="in-card"><h3>Firmas</h3>
      <label class="f">Firma 1 (quien inspecciona)</label><input class="in" data-dc-f="f.insp" maxlength="60" value="${esc(d.firmas.insp)}">
      <label class="f">Firma 2 (responsable del área)</label><input class="in" data-dc-f="f.resp" maxlength="60" value="${esc(d.firmas.resp)}"></div>
    <div class="in-card"><h3>Motivo del cambio</h3><textarea class="in" data-dc-f="motivo" maxlength="500" placeholder="¿Qué se cambia y por qué? (queda en el control de cambios)">${esc(E.motivo)}</textarea></div>
    <div class="err" id="dc-err">${esc(S.err)}</div>
    <div class="in-foot"><div class="in-nav"><button class="btn sec" data-dc="previa-ed">Vista previa</button><button class="btn" data-dc="guardar" ${S.ocupado ? "disabled" : ""}>${S.ocupado ? "Guardando…" : "Guardar borrador"}</button></div></div></div>`;
}
// escribe en la definición el valor de un campo del editor (sin volver a pintar: el cursor no se mueve)
function campo(path, v){
  const E = S.E, d = E.def, p = path.split(".");
  if(p[0] === "titulo") d.titulo = v;
  else if(p[0] === "motivo") E.motivo = v;
  else if(p[0] === "p"){ if(p[1] === "max") d.puntos.max = Number(v); else d.puntos[p[1]] = v; }
  else if(p[0] === "col") d.puntos.columnas[+p[1]][p[2]] = v;
  else if(p[0] === "g") d.criterios.grupos[+p[1]].nombre = v;
  else if(p[0] === "it") d.criterios.grupos[+p[1]].items[+p[2]][p[3]] = v;
  else if(p[0] === "r"){ if(p[1] === "titulo") d.resultado.titulo = v; else d.resultado.cortes[p[1]] = Number(v); }
  else if(p[0] === "f") d.firmas[p[1]] = v;
  guardaLocal();
}
const mueve = (L, i, k) => { const j = i + k; if(j < 0 || j >= L.length) return; const x = L[i]; L[i] = L[j]; L[j] = x; };
const claveNueva = () => "c" + Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 36).toString(36);
function validaEd(E){
  const d = E.def, T = (s, a, b) => { s = String(s || "").trim(); return s.length >= a && s.length <= b; };
  if(!T(d.titulo, 3, 80)) return "Escriba el título del formato (3 a 80 caracteres).";
  if(d.puntos){
    if(!T(d.puntos.titulo, 3, 60)) return "Escriba el título de la tabla de puntos.";
    if(!(d.puntos.max >= 1 && d.puntos.max <= 12)) return "El máximo de puntos debe estar entre 1 y 12.";
    if(!d.puntos.columnas.length) return "La tabla de puntos necesita al menos una columna.";
    if(d.puntos.columnas.some(c => !T(c.t, 2, 30))) return "Cada columna necesita un nombre (2 a 30 caracteres).";
  }
  if(!d.criterios.grupos.length) return "Agregue al menos un grupo de criterios.";
  for(const g of d.criterios.grupos){
    if(!T(g.nombre, 3, 50)) return "Cada grupo necesita un nombre (3 a 50 caracteres).";
    if(!g.items.length) return "El grupo «" + g.nombre + "» no tiene criterios.";
    if(g.items.some(i => !T(i.t, 3, 200))) return "Hay un criterio sin texto en el grupo «" + g.nombre + "».";
  }
  const R = d.resultado;
  if(R.modo === "texto"){ if(!T(R.titulo, 3, 60)) return "Escriba el título del campo de resultado."; }
  else if(!(R.cortes.sat > 0 && R.cortes.sat <= 100 && R.cortes.ace > 0 && R.cortes.ace < R.cortes.sat)) return "El porcentaje aceptable debe ser menor que el satisfactorio (máximo 100).";
  if(!T(d.firmas.insp, 3, 60) || !T(d.firmas.resp, 3, 60)) return "Escriba los títulos de las dos firmas.";
  if(String(E.motivo || "").trim().length < 5) return "Escriba el motivo del cambio (mínimo 5 letras).";
  return "";
}
async function guardar(){
  const E = S.E; if(!E || S.ocupado) return;
  S.err = validaEd(E); if(S.err) return pintaEditor(), document.getElementById("dc-err").scrollIntoView({block:"center"});
  S.ocupado = true; pintaEditor();
  try{
    const j = await postJ({action:"doc_borrador_guardar", codigo:E.codigo, definicion:E.def, motivo:E.motivo.trim()}, 60000);
    S.ocupado = false;
    if(j && j.ok){ borraLocal(E.codigo); toast("Borrador " + j.version + " guardado"); S.E = null; S.vista = "detalle"; S.err = ""; window.scrollTo(0, 0); return cargaDetalle(E.codigo); }
    S.err = msg(j);
  }catch(e){ S.ocupado = false; S.err = "Sin señal. Sus cambios siguen en este equipo: intente de nuevo."; }
  pintaEditor();
}

/* ---------- PDF en blanco, aprobación ---------- */
const fmtDe = (D, v, def) => ({codigo:D.documento.codigo, version:v.estado === "Borrador" ? v.version + " (borrador)" : v.version, fechaAprobacion:v.fechaAprobacion || "", def:def});
async function pdfBlanco(fmt){ return F().pdf(F().html({}, null, fmt), F().nombre(fmt.codigo + " v" + fmt.version.replace(/ \(borrador\)/, " borrador") + " (en blanco)")); }
function muestra(file){
  const u = URL.createObjectURL(file), w = window.open(u, "_blank");
  if(!w) F().descarga(file);                                // si el navegador bloquea la pestaña nueva, se descarga
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}
async function conBoton(btn, txt, fn){
  const t0 = btn.textContent; btn.disabled = true; btn.textContent = txt;
  try{ await fn(); }catch(e){ toast(e && e.message && e.message.length > 6 ? e.message : "No se pudo completar. Revise su señal."); }
  btn.disabled = false; btn.textContent = t0;
}
async function aprobar(versionId){
  const D = S.det, v = D.versiones.filter(x => x.versionId === versionId)[0]; if(!v) return;
  const vig = D.versiones.filter(x => x.estado === "Vigente")[0];
  if(!confirm("¿Aprobar la versión " + v.version + "? Pasará a ser la vigente" + (vig ? " y la versión " + vig.version + " quedará obsoleta" : "") + ". Las inspecciones nuevas usarán esta versión.")) return;
  S.ocupado = true; pintaDetalle();
  try{
    const j = await postJ({action:"doc_aprobar", versionId:versionId}, 60000);
    S.ocupado = false;
    if(!(j && j.ok)){ S.err = msg(j); return pintaDetalle(); }
    toast("Versión " + j.version + " aprobada");
    // PDF en blanco de la nueva vigente → Drive (si falla, la aprobación ya quedó; se puede reintentar desde «PDF de la versión vigente»)
    try{
      const vv = await version(j.versionId), file = await pdfBlanco(fmtDe(D, vv, vv.definicion));
      const dataUrl = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
      const k = await postJ({action:"doc_pdf_guardar", versionId:j.versionId, pdf:dataUrl}, 120000);
      if(k && k.ok) toast("PDF de la versión " + j.version + " guardado en Drive"); else S.err = "La versión quedó aprobada, pero el PDF no se guardó en Drive: " + msg(k);
    }catch(e){ S.err = "La versión quedó aprobada, pero el PDF no se guardó en Drive. Revise su señal y use «PDF de la versión vigente»."; }
  }catch(e){ S.ocupado = false; S.err = "Sin señal. La versión no se aprobó: intente de nuevo."; }
  cargaDetalle(D.documento.codigo);
}
async function pdfVigente(versionId, btn){
  const D = S.det, v = D.versiones.filter(x => x.versionId === versionId)[0]; if(!v) return;
  await conBoton(btn, "Preparando…", async () => {
    // se arma siempre al momento con el diseño actual (logo, encabezado); la copia de Drive es solo respaldo
    const vv = await version(versionId), file = await pdfBlanco(fmtDe(D, vv, vv.definicion));
    muestra(file);
    if(can("doc_aprobar") && !v.tienePdf){                  // la vigente aún no tiene su PDF en Drive (por ejemplo, la carga inicial): se guarda ahora
      const dataUrl = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
      const k = await postJ({action:"doc_pdf_guardar", versionId:versionId, pdf:dataUrl}, 120000);
      if(k && k.ok){ toast("PDF guardado en Drive"); cargaDetalle(D.documento.codigo); }
    }
  });
}

/* ---------- eventos ---------- */
document.addEventListener("click", async ev => {
  if(TAB !== "doc" || !box()) return;
  const t = ev.target;
  const vd = t.closest("[data-dc-ver]"); if(vd){ S.sel = vd.dataset.dcVer; S.vista = "detalle"; S.err = ""; S.verCambios = 10; window.scrollTo(0, 0); return cargaDetalle(S.sel); }
  const k = t.closest("[data-dc]"); if(!k) return;
  const a = k.dataset.dc, i = +k.dataset.i, g = +k.dataset.g, E = S.E;
  if(a === "lista"){ S.vista = "lista"; S.det = null; S.err = ""; repinta(); return cargaDocs(); }
  if(a === "nuevo"){ S.vista = "nuevo"; S.err = ""; window.scrollTo(0, 0); return repinta(); }
  if(a === "tipo"){ S.N.tipo = k.dataset.t; return pintaNuevo(); }
  if(a === "crear") return crear();
  if(a === "imp-quita"){ S.N.imp = null; S.N.impNombre = ""; return pintaNuevo(); }
  if(a === "subir"){ S.P = {motivo:"", pdf:null, nombre:""}; const br = S.det.versiones.filter(v => v.estado === "Borrador")[0]; if(br) S.P.motivo = br.motivo; S.vista = "subir"; S.err = ""; window.scrollTo(0, 0); return repinta(); }
  if(a === "volver"){ S.P = null; S.vista = "detalle"; S.err = ""; return repinta(); }
  if(a === "subir-guardar") return subirGuardar();
  if(a === "ver-pdf"){ ev.preventDefault(); return verPdf(k.dataset.v, k); }
  if(a === "mas"){ S.verCambios += 20; return pintaDetalle(); }
  if(a === "editar") return abreEditor(k.dataset.v);
  if(a === "previa") return conBoton(k, "Preparando…", async () => { const v = await version(k.dataset.v); muestra(await pdfBlanco(fmtDe(S.det, v, v.definicion))); });
  if(a === "aprobar") return aprobar(k.dataset.v);
  if(a === "pdf-vig") return pdfVigente(k.dataset.v, k);
  if(a === "descartar"){
    if(!confirm("¿Descartar el borrador? Se pierden sus cambios (queda anotado en el control de cambios).")) return;
    const j = await postJ({action:"doc_borrador_descartar", versionId:k.dataset.v}); if(!(j && j.ok)) S.err = msg(j); else toast("Borrador descartado");
    return cargaDetalle(S.det.documento.codigo);
  }
  if(!E) return;
  const d = E.def;
  if(a === "cancelar"){ if(!confirm("¿Salir del editor? Los cambios no guardados se pierden.")) return; borraLocal(E.codigo); S.E = null; S.vista = "detalle"; S.err = ""; return repinta(); }
  if(a === "guardar") return guardar();
  if(a === "previa-ed") return conBoton(k, "Preparando…", async () => muestra(await pdfBlanco({codigo:E.codigo, version:(E.borrador || "nueva") + " (borrador)", fechaAprobacion:"", def:d})));
  if(a === "puntos-usa"){
    if(d.puntos){ if(!confirm("¿Quitar la tabla de puntos? El criterio que se calculaba con ella pasará a marcarse a mano.")){ k.checked = true; return; }
      d.puntos = null; d.criterios.grupos.forEach(x => x.items.forEach(it => it.auto = "")); }
    else d.puntos = {titulo:"Puntos", nota:"C = Conforme | NC = No conforme | NA = No aplica", max:8, columnas:[{k:claveNueva(), t:"Columna 1", color:""}]};
  }
  else if(a === "col-agrega") d.puntos.columnas.push({k:claveNueva(), t:"", color:""});
  else if(a === "col-sube") mueve(d.puntos.columnas, i, -1);
  else if(a === "col-baja") mueve(d.puntos.columnas, i, 1);
  else if(a === "col-quita"){ if(d.puntos.columnas.length < 2) return toast("La tabla necesita al menos una columna."); d.puntos.columnas.splice(i, 1); }
  else if(a === "grp-agrega") d.criterios.grupos.push({nombre:"", items:[{t:"", h:"Otro", auto:""}]});
  else if(a === "grp-sube") mueve(d.criterios.grupos, i, -1);
  else if(a === "grp-baja") mueve(d.criterios.grupos, i, 1);
  else if(a === "grp-quita"){ if(d.criterios.grupos.length < 2) return toast("El formato necesita al menos un grupo."); if(!confirm("¿Quitar el grupo «" + (d.criterios.grupos[i].nombre || "sin nombre") + "» con sus criterios?")) return; d.criterios.grupos.splice(i, 1); }
  else if(a === "it-agrega") d.criterios.grupos[g].items.push({t:"", h:"Otro", auto:""});
  else if(a === "it-sube") mueve(d.criterios.grupos[g].items, i, -1);
  else if(a === "it-baja") mueve(d.criterios.grupos[g].items, i, 1);
  else if(a === "it-quita"){ if(d.criterios.grupos[g].items.length < 2) return toast("Cada grupo necesita al menos un criterio (o quite el grupo)."); d.criterios.grupos[g].items.splice(i, 1); }
  else if(a === "res-pct"){ if(d.resultado.modo === "texto") d.resultado = {modo:"porcentaje", cortes:{sat:90, ace:70}}; }
  else if(a === "res-txt"){ if(d.resultado.modo !== "texto") d.resultado = {modo:"texto", titulo:"Resultados de la inspección"}; }
  else return;
  S.err = ""; guardaLocal(); pintaEditor();
});
document.addEventListener("input", ev => {
  if(TAB !== "doc" || !ev.target.dataset) return;
  const t = ev.target;
  if(S.E && t.dataset.dcF) return campo(t.dataset.dcF, t.value);
  if(t.dataset.dcN === "codigo"){ const p = t.selectionStart; t.value = t.value.toUpperCase(); t.setSelectionRange(p, p); }
  if(t.dataset.dcN) S.N[t.dataset.dcN] = t.value;
  if(t.dataset.dcM && S.P) S.P.motivo = t.value;
});
document.addEventListener("change", async ev => {
  if(TAB !== "doc" || !ev.target.dataset) return;
  if(ev.target.dataset.dcImp){                                // Word o Excel para armar la estructura
    const f = ev.target.files && ev.target.files[0], donde = ev.target.dataset.dcImp; ev.target.value = ""; if(!f) return;
    S.leyendo = true; S.err = ""; repinta();
    try{
      const r = await importa(f);
      if(donde === "nuevo"){
        S.N.imp = r; S.N.impNombre = f.name;
        if(!S.N.codigo && r.codigo) S.N.codigo = r.codigo.toUpperCase();
        if(!S.N.titulo && r.titulo) S.N.titulo = r.titulo;
      } else if(S.E){
        if(!confirm("¿Reemplazar el contenido del formato con lo reconocido en «" + f.name + "»? Puede cancelar el editor sin guardar si no le convence.")){ S.leyendo = false; return repinta(); }
        r.def.titulo = S.E.def.titulo;                        // el título del documento no cambia
        S.E.def = r.def; S.E.imp = r; S.E.impNombre = f.name;
        if(!String(S.E.motivo || "").trim() || /^Primera versión\.?$/.test(S.E.motivo)) S.E.motivo = "Importado de " + f.name + ".";
        guardaLocal();
      }
    }catch(e){ S.err = e && e.message && e.message.length > 6 ? e.message : "No se pudo leer el archivo. Verifique que sea .docx o .xlsx."; }
    S.leyendo = false; return repinta();
  }
  if(ev.target.dataset.dcPdf && S.P){                         // PDF elegido para la versión
    const f = ev.target.files && ev.target.files[0]; if(!f) return;
    if(f.type && f.type !== "application/pdf"){ S.err = "El archivo debe ser PDF."; return pintaSubir(); }
    if(f.size > MAX_PDF){ S.err = "El PDF pesa " + (f.size / 1048576).toFixed(1) + " MB; el máximo es 8 MB."; return pintaSubir(); }
    S.P.pdf = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
    S.P.nombre = f.name; S.err = ""; return pintaSubir();
  }
  if(!S.E) return;
  if(ev.target.dataset.dcF) return campo(ev.target.dataset.dcF, ev.target.value);
  if(ev.target.dataset.dcAuto){                             // criterio calculado con la tabla de puntos (uno o ninguno)
    const v = ev.target.value, G = S.E.def.criterios.grupos; G.forEach(x => x.items.forEach(it => it.auto = ""));
    if(v){ const [gi, ii] = v.split(".").map(Number); G[gi].items[ii].auto = "puntos"; }
    guardaLocal(); pintaEditor();
  }
});

window.drawDoc = drawDoc;
window.DOCUI = {S};
})();
