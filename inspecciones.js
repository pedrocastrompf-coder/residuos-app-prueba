/* Inspecciones de medio ambiente (formato SGA.R.G.002) · formulario por pasos guiado por la versión del formato
   aprobada en Control documentario: puntos, criterios, resultado y firmas vienen de la definición (no del código).
   Cada inspección guarda su versión; el historial y el PDF usan esa misma versión. Borrador sin señal.
   Se carga después de hallazgos-img.js y usa: $, esc, uuid, toast, postJ, can, SES, CFG, TAB, showView. El servidor valida y calcula. */
(function(){
"use strict";

const RESP = [["C","Conforme"],["NC","No conforme"],["NA","N/A"]];
const DOC = "SGA.R.G.002", MAX_FOTOS = 3, BORR = "insp_borrador_v3", FMT_K = "insp_fmt:";
const ERR = {
  area_invalida:"El área elegida no existe o está inactiva.", responsable_invalido:"Escriba el nombre del responsable del área (mínimo 3 letras).",
  cargo_invalido:"El cargo es demasiado largo.", firmas_invalidas:"Faltan las firmas o no son válidas. Vuelva a firmar.", puntos_invalidos:"Revise los puntos: cada punto necesita nombre y todas sus casillas.",
  planta_bloqueada:"Esta planta apunta a una hoja distinta de la copia de prueba. Revise la pestaña Plantas.",
  criterios_invalidos:"Los criterios no coinciden con la versión del formato. Descarte este borrador y empiece una inspección nueva.",
  formato_invalido:"La versión del formato de este borrador no está aprobada. Descarte el borrador y empiece una inspección nueva.",
  resultado_invalido:"Escriba los resultados de la inspección (mínimo 10 letras).", nc_invalida:"Una no conformidad no está completa (observación y foto).",
  id_invalido:"La inspección no es válida. Vuelva a empezar.", permiso:"No tiene permiso para esta acción.",
  clave:"El servidor no reconoce esta acción. Falta actualizar el script (Code.gs, ControlDoc.gs e Inspecciones.gs) y publicar una nueva versión."
};
const S = {falta:"", vista:"lista", lista:null, t:0, cargando:false, areas:null, F:null, enviando:false, err:"", sel:null, paso:0, fin:false,
  fmt:null, fmtErr:"", defs:{}, q:{txt:"", cal:"", desde:"", hasta:""}};

const st = document.createElement("style");
st.textContent = `
.in-top{display:flex;gap:8px;margin:8px 0}
.in-g{display:grid;grid-template-columns:1fr 1fr 2fr;gap:10px;margin-top:2px}
.in-ro{border:1px solid var(--line);background:#faf7f3;border-radius:10px;padding:11px 12px;font-size:15px;color:var(--brown)}
@media(max-width:560px){.in-g{grid-template-columns:1fr 1fr}.in-g-w{grid-column:1/-1}}
.in-ok{background:#e8f3ea;color:var(--ok);border-radius:12px;padding:11px 12px;font-weight:700;margin:8px 0}
.in-foot{position:sticky;bottom:0;z-index:15;background:#fff;border-top:1px solid var(--line);border-radius:14px 14px 0 0;margin-top:14px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));box-shadow:0 -4px 14px rgba(60,40,20,.08)}
.in-prog{font-size:13px;color:var(--gray);font-weight:600}
.in-bar{height:5px;background:var(--line);border-radius:3px;margin-top:5px;overflow:hidden}
.in-bar i{display:block;height:100%;background:var(--brown);border-radius:3px}
.in-nav{display:flex;gap:8px;margin:10px 0 0;justify-content:space-between}
.in-nav .btn,.in-nav span{flex:1}
.in-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;margin:10px 0}
.in-card h3{margin:0 0 6px;font-size:15px;color:var(--brown)}
.in-card .s{font-size:12.5px;color:var(--gray);margin:0 0 8px}
.in-sg{display:inline-flex;border:1.5px solid var(--taupe);border-radius:10px;overflow:hidden}
.in-sg button{border:0;background:#fff;color:var(--brown);padding:7px 10px;font-weight:bold;font-size:13px;min-width:44px}
.in-sg button.on.C{background:var(--ok);color:#fff} .in-sg button.on.NC{background:var(--red);color:#fff} .in-sg button.on.NA{background:#8a8077;color:#fff}
.in-pt{border:1px solid var(--line);border-radius:12px;padding:10px;margin:8px 0;background:#faf7f3}
.in-lb{display:flex;align-items:center;gap:8px}
.in-dot{width:13px;height:13px;border-radius:50%;border:1px solid #b9ada0;flex:none}
.in-pt .c{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:5px 0;font-size:13.5px}
.in-crit{border-top:1px solid var(--line);padding:8px 0}
.in-crit .t{font-size:14px;margin-bottom:6px}.in-crit .n{font-weight:bold;color:var(--brown)}
.in-nc{background:var(--red-bg);border-radius:10px;padding:8px;margin-top:6px}
.in-nc textarea{width:100%;min-height:60px}
.in-res{border-left:6px solid var(--taupe);border-radius:12px;background:#fff;padding:12px;margin:10px 0;border:1px solid var(--line);border-left-width:6px}
.in-res.sat{border-left-color:var(--ok)} .in-res.ace{border-left-color:var(--orange)} .in-res.nos{border-left-color:var(--red)}
.in-res b{font-size:22px;color:var(--brown)}
.in-card .in{width:100%;box-sizing:border-box}
.in-fp{border:1.5px dashed var(--taupe);border-radius:10px;background:#fff;touch-action:none;width:100%;height:130px;display:block}
.in-fb{display:flex;justify-content:space-between;align-items:center;margin:4px 0 12px;font-size:12.5px;color:var(--gray)}
.insp-printarea{display:none}.insp-pdfw{position:absolute;left:-99999px;top:0;width:1122px;background:#fff}
@media print{.insp-printarea{display:block}.insp-printarea .fi{zoom:.86}body>*:not(.insp-printarea){display:none!important}@page{size:A4 landscape;margin:8mm}}
.in-row{display:block;width:100%;text-align:left;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:6px 0;font:inherit;color:inherit}
.in-row .l1{display:flex;justify-content:space-between;gap:8px;align-items:center}
.in-q{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin:6px 0}.in-q .in{width:100%;box-sizing:border-box}
@media(max-width:560px){.in-q{grid-template-columns:1fr}}
.in-q2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 6px}.in-q2 label{font-size:12px;color:var(--gray)}
.in-txt{white-space:pre-wrap;font-size:14px}
`;
document.head.appendChild(st);

const box = () => document.getElementById("insp-body");
const fecha = s => s ? String(s).slice(8,10) + "/" + String(s).slice(5,7) + "/" + String(s).slice(0,4) : "";
const hoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };
const hora = () => { const d = new Date(); return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); };
const masDias = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.getFullYear() + "-" + String(x.getMonth()+1).padStart(2,"0") + "-" + String(x.getDate()).padStart(2,"0"); };
const claseCal = c => c === "Satisfactorio" ? "sat" : c === "Aceptable con acciones" ? "ace" : c ? "nos" : "";
const LET = "ABCDEFGH";

/* ---------- formato (definición de la versión) ---------- */
const items = def => { const L = []; def.criterios.grupos.forEach(g => g.items.forEach(i => L.push(i))); return L; };
const colsDe = def => def.puntos ? def.puntos.columnas : [];
const nAuto = def => { const i = items(def).filter(x => x.auto === "puntos")[0]; return i ? i.n : 0; };
const lsGet = k => { try{ const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; }catch(e){ return null; } };
const lsSet = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
// versión vigente: se pide al servidor y se guarda en el teléfono para trabajar sin señal
async function cargaFmt(){
  try{
    const j = await postJ({action:"doc_vigente", codigo:DOC});
    if(j && j.ok){ const f = {codigo:j.codigo, version:j.version, versionId:j.versionId, fechaAprobacion:j.fechaAprobacion, def:j.definicion};
      S.fmt = f; S.fmtErr = ""; S.defs[f.versionId] = f; lsSet(FMT_K + "vigente", f); lsSet(FMT_K + f.versionId, f); }
    else if(j && !(j.error === "sesion" || j.error === "cambiar_clave")) S.fmtErr = ERR[j.error] || "No se pudo cargar el formato vigente.";
  }catch(e){ if(!S.fmt) S.fmtErr = "Sin señal: no se pudo cargar el formato vigente."; }
  if(!S.fmt){ const c = lsGet(FMT_K + "vigente"); if(c){ S.fmt = c; S.defs[c.versionId] = c; } }
  if(TAB === "insp" && S.vista === "lista") pintaLista();
}
// versión con que se hizo una inspección (para verla y reimprimirla igual)
async function fmtDe(versionId){
  if(!versionId) return S.fmt;                              // inspecciones de prueba antiguas, sin versión: se muestran con la vigente
  if(S.defs[versionId]) return S.defs[versionId];
  const c = lsGet(FMT_K + versionId); if(c) return (S.defs[versionId] = c);
  const j = await postJ({action:"doc_version", versionId:versionId});
  if(!(j && j.ok)) throw new Error("formato");
  const v = j.version, f = {codigo:v.codigo, version:v.version, versionId:v.versionId, fechaAprobacion:v.fechaAprobacion, def:v.definicion};
  lsSet(FMT_K + versionId, f); return (S.defs[versionId] = f);
}

/* ---------- cálculo local (solo vista previa; el servidor recalcula) ---------- */
function critAuto(F, def){
  let hay = false, nc = false, falta = false;
  F.puntos.forEach(p => colsDe(def).forEach(c => { const v = p.c[c.k]; if(v === "NC") nc = true; if(v === "C") hay = true; if(!v) falta = true; }));
  if(!nc && falta) return "";
  return nc ? "NC" : hay ? "C" : "NA";
}
function resultadoCrit(F, n){ const def = F.fmt.def; return n === nAuto(def) ? critAuto(F, def) : (F.crit[n] || {}).r || ""; }
function porcentaje(F){
  let c = 0, nc = 0;
  items(F.fmt.def).forEach(it => { const r = resultadoCrit(F, it.n); if(r === "C") c++; else if(r === "NC") nc++; });
  return (c + nc) ? Math.round(1000 * c / (c + nc)) / 10 : null;
}
const calif = (p, cortes) => p === null ? "" : p >= cortes.sat ? "Satisfactorio" : p >= cortes.ace ? "Aceptable con acciones" : "No satisfactorio";
function pasos(def){ return [["datos","Datos de la inspección"]].concat(def.puntos ? [["puntos", def.puntos.titulo]] : [], [["criterios","Criterios"], ["resultado","Resultado"], ["firmas","Firmas"]]); }

/* ---------- estado y borrador ---------- */
function nuevoPunto(def, i){ const c = {}; colsDe(def).forEach(x => c[x.k] = ""); return {nombre:"Punto " + i, c:c, obs:""}; }   // nada viene marcado: se marca punto por punto
function nuevoForm(fmt){
  const crit = {}; items(fmt.def).forEach(it => crit[it.n] = {r:"", obs:"", fotos:[], accion:"", resp:"", plazo:""});
  return {id:"insp-" + uuid(), fmt:fmt, area:"", puntos:fmt.def.puntos ? [nuevoPunto(fmt.def, 1)] : [], crit:crit, respNombre:"", respCargo:"", resultadoTexto:"",
    inspCargo:(function(){ try{ return localStorage.getItem("insp_cargo:" + (SES && SES.usuario)) || "Medio Ambiente"; }catch(e){ return "Medio Ambiente"; } })(), firmaInsp:"", firmaResp:"", t0:hoy() + " " + hora()};
}
function guardaBorrador(){ try{ if(S.F) localStorage.setItem(BORR + ":" + (SES && SES.usuario), JSON.stringify(S.F)); }catch(e){} }   // las fotos pueden pesar: si no cabe, no pasa nada
function leeBorrador(){
  try{
    const t = localStorage.getItem(BORR + ":" + (SES && SES.usuario)); if(!t) return null;
    const b = JSON.parse(t); if(!b || !b.fmt || !b.fmt.def) return null;   // el borrador guarda su versión del formato
    ["respNombre","respCargo","resultadoTexto","firmaInsp","firmaResp"].forEach(k => { if(b[k] == null) b[k] = ""; });
    return b;
  }catch(e){ return null; }
}
function borraBorrador(){ try{ localStorage.removeItem(BORR + ":" + (SES && SES.usuario)); }catch(e){} }

/* ---------- datos ---------- */
async function carga(){
  if(S.cargando) return; S.cargando = true;
  try{ const j = await postJ({action:"inspecciones_listar"}); if(j && j.ok){ S.lista = j.inspecciones; S.t = Date.now(); S.err = ""; } else if(!(j && (j.error === "sesion" || j.error === "cambiar_clave"))) S.err = ERR[j && j.error] || "No se pudo cargar el historial."; }
  catch(e){ S.err = "Sin señal. Se muestra el último historial cargado."; }
  finally{ S.cargando = false; repinta(); }
}
async function cargaAreas(){
  try{ const j = await postJ({action:"areas_listar"}); if(j && j.ok){ S.areas = j.areas.filter(a => a.activo !== false && a.activo !== "No"); if(S.vista === "form") pintaForm(); } }catch(e){}
}

/* ---------- pantallas ---------- */
function drawInsp(){
  if(!box()) return; repinta();
  if(S.vista === "lista" && !S.cargando && (S.lista === null || Date.now() - S.t > 15000)) carga();
  cargaAreas(); cargaFmt();
}
function repinta(){
  if(!box() || TAB !== "insp") return;
  if(S.vista === "form") return pintaForm();
  if(S.vista === "detalle") return pintaDetalle();
  pintaLista();
}
const resumen = i => i.resultadoTexto ? "Resultado en texto" : (i.pct === "" ? "s/d" : i.pct + " %");
function filtradas(){
  const q = S.q, t = q.txt.trim().toLowerCase();
  return (S.lista || []).filter(i => (!t || (i.area + " " + i.inspectorNombre + " " + i.respNombre).toLowerCase().indexOf(t) >= 0)
    && (!q.cal || i.calificacion === q.cal) && (!q.desde || i.fecha >= q.desde) && (!q.hasta || i.fecha <= q.hasta));
}
function htmlLista(){
  if(S.lista === null) return `<div class="card muted">Cargando…</div>`;
  if(!S.lista.length) return `<div class="card muted">Todavía no hay inspecciones. Toque «Nueva inspección» para registrar la primera.</div>`;
  const L = filtradas();
  return L.length ? L.map(i =>
    `<button class="in-row" data-in-ver="${esc(i.id)}"><div class="l1"><b>${esc(i.area)}</b><span class="hz-b ${i.resultadoTexto ? "abi" : claseCal(i.calificacion) === "sat" ? "cer" : claseCal(i.calificacion) === "ace" ? "abi" : "venc"}">${esc(resumen(i))}</span></div><div class="m" style="font-size:12.5px;color:var(--gray)">${fecha(i.fecha)} ${esc(i.hora)} · ${esc(i.inspectorNombre)}${i.calificacion ? " · " + esc(i.calificacion) : ""} · ${(i.hallazgos || []).length} hallazgo(s)</div></button>`).join("")
    : `<div class="card muted">Ninguna inspección coincide con la búsqueda.</div>`;
}
function pintaLista(){
  const b = leeBorrador(), q = S.q;
  box().innerHTML =
    `<div class="in-top"><button class="btn" data-in="nueva" ${S.fmt ? "" : "disabled"}>＋ Nueva inspección</button></div>` +
    (S.fmt ? "" : `<div class="${S.fmtErr ? "err" : "card muted"}">${esc(S.fmtErr || "Cargando el formato vigente…")}</div>`) +
    (b ? `<div class="in-card"><h3>Inspección sin terminar</h3><p class="s">${esc(b.area || "Sin área")} · iniciada ${esc(b.t0 || "")} · formato versión ${esc(b.fmt.version)}</p><div class="in-top"><button class="btn sm" data-in="seguir">Continuar</button><button class="btn sec sm" data-in="descartar">Descartar</button></div></div>` : "") +
    (S.err ? `<div class="err">${esc(S.err)}</div>` : "") +
    `<div class="in-card"><h3>Buscar inspecciones</h3>
      <div class="in-q"><input class="in" id="in-q-txt" placeholder="Área, inspector o responsable" value="${esc(q.txt)}" autocomplete="off">
        <select class="in" id="in-q-cal"><option value="">Toda calificación</option>${["Satisfactorio","Aceptable con acciones","No satisfactorio"].map(c => `<option ${q.cal === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div class="in-q2"><label>Desde<input class="in" type="date" id="in-q-desde" value="${esc(q.desde)}"></label><label>Hasta<input class="in" type="date" id="in-q-hasta" value="${esc(q.hasta)}"></label></div></div>` +
    `<div id="in-lst">${htmlLista()}</div>`;
}
function pintaDetalle(){
  const i = (S.lista || []).find(x => x.id === S.sel); if(!i){ S.vista = "lista"; return pintaLista(); }
  const f = i.versionId ? S.defs[i.versionId] : S.fmt;
  if(!f){ box().innerHTML = `<div class="card muted">Cargando…</div>`; fmtDe(i.versionId).then(() => { if(S.vista === "detalle" && S.sel === i.id) pintaDetalle(); }).catch(() => { box().innerHTML = `<div class="in-top"><button class="btn sec sm" data-in="lista">← Historial</button></div><div class="err">No se pudo cargar la versión del formato de esta inspección. Revise su señal.</div>`; }); return; }
  const crit = {}; (i.criterios || []).forEach(c => crit[c.n] = c);
  box().innerHTML = `<div class="in-top"><button class="btn sec sm" data-in="lista">← Historial</button></div>${S.fin ? `<div class="in-ok">✔ Inspección terminada y registrada</div>` : ""}<div class="in-top"><button class="btn" style="flex:1" data-in="descargar">Descargar PDF</button><button class="btn sec" style="flex:1" data-in="pdf">Compartir</button></div><div class="in-top"><button class="btn sec" style="flex:1" data-in="imprimir">Imprimir</button></div>` +
    `<div class="in-res ${i.resultadoTexto ? "" : claseCal(i.calificacion)}"><div>${esc(i.area)} · ${fecha(i.fecha)} ${esc(i.hora)}</div>${i.resultadoTexto ? `<div class="in-txt">${esc(i.resultadoTexto)}</div>` : `<b>${esc(i.pct === "" ? "s/d" : i.pct + " %")}</b> ${esc(i.calificacion)}`}</div>` +
    `<div class="hz-kv"><span>Formato</span><span>${esc(f.codigo)} · versión ${esc(f.version)}</span><span>Inspector</span><span>${esc(i.inspectorNombre)}</span><span>Responsable</span><span>${esc(i.respNombre)}${i.respCargo ? " · " + esc(i.respCargo) : ""}</span><span>Hallazgos</span><span>${(i.hallazgos || []).length ? esc(i.hallazgos.join(", ")) : "Ninguno"}</span></div>` +
    `<div class="in-card"><h3>Criterios</h3>${items(f.def).map(it => { const c = crit[it.n] || {r:""}; return `<div class="in-crit"><span class="n">${it.n}.</span> ${esc(it.t)} — <b>${esc(c.r === "NA" ? "N/A" : c.r)}</b>${c.obs ? `<div class="s">${esc(c.obs)}</div>` : ""}${c.accion ? `<div class="s">Acción: ${esc(c.accion)} · Responsable: ${esc(c.responsable || "")} · Plazo: ${esc(fecha(c.plazo))}</div>` : ""}</div>`; }).join("")}</div>`;
}
const sgCell = (i, k, val) => `<span class="in-sg">${RESP.map(([v]) => `<button type="button" data-in-c="${i}|${k}" data-v="${v}" class="${v}${val === v ? " on" : ""}">${v === "NA" ? "N/A" : v}</button>`).join("")}</span>`;

function pintaForm(){
  const F = S.F; if(!F) return;
  const def = F.fmt.def, areas = S.areas || [], P = pasos(def), paso = Math.min(Math.max(S.paso || 0, 0), P.length - 1), id = P[paso][0];
  const tit = `${LET[paso]}. ${esc(P[paso][1])}`;
  let sec = "";
  if(id === "datos") sec = `<div class="in-card"><h3>${tit}</h3>
    <label class="f" for="in-area">Área</label><select id="in-area" class="in"><option value="">Elija el área…</option>${areas.map(a => `<option ${a.nombre === F.area ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}</select>
    ${areas.length ? "" : `<p class="s">Cargando áreas…</p>`}
    <div class="in-g"><div><label class="f">Fecha</label><div class="in-ro">${esc(fecha(F.t0.slice(0,10)))}</div></div><div><label class="f">Hora</label><div class="in-ro">${esc(F.t0.slice(11,16))}</div></div><div class="in-g-w"><label class="f">Inspector</label><div class="in-ro">${esc(SES ? SES.nombre : "")}</div></div></div></div>`;
  else if(id === "puntos") sec = `<div class="in-card"><h3>${tit}</h3><p class="s">Un punto es un grupo de contenedores. Marque cada casilla: C (conforme), NC (no conforme) o N/A (no aplica).</p>` +
    F.puntos.map((pt, i) => `<div class="in-pt"><div style="display:flex;gap:6px"><input class="in" data-in-pn="${i}" value="${esc(pt.nombre)}" maxlength="40" style="flex:1;width:auto;min-width:0"><button type="button" class="btn sec sm" data-in-pq="${i}">Quitar</button></div>` +
      colsDe(def).map(c => `<div class="c"><span class="in-lb"><i class="in-dot" ${c.color ? `style="background:${esc(c.color)}"` : `style="visibility:hidden"`}></i>${esc(c.t)}</span>${sgCell(i, c.k, pt.c[c.k])}</div>`).join("") + `</div>`).join("") +
    (F.puntos.length < def.puntos.max ? `<button type="button" class="btn sec sm" data-in="punto">＋ Agregar punto</button>` : "") + `</div>`;
  else if(id === "criterios") sec = `<div class="in-card"><h3>${tit}</h3>` + def.criterios.grupos.map(g =>
    `<p class="s" style="margin-top:10px"><b>${esc(g.nombre)}</b></p>` + g.items.map(it => {
      const n = it.n, c = F.crit[n], r = resultadoCrit(F, n), auto = it.auto === "puntos";
      return `<div class="in-crit"><div class="t"><span class="n">${n}.</span> ${esc(it.t)}</div>` +
        (auto ? `<span class="hz-b ${r === "C" ? "cer" : r === "NC" ? "venc" : "abi"}">${r === "" ? "Pendiente: se calcula con la tabla de puntos" : (r === "NA" ? "N/A" : r) + " (automático)"}</span>` : `<span class="in-sg">${RESP.map(([k]) => `<button type="button" data-in-r="${n}|${k}" class="${k}${c.r === k ? " on" : ""}">${k === "NA" ? "N/A" : k}</button>`).join("")}</span>`) +
        (r === "NC" ? `<div class="in-nc"><label class="f">Observación</label><textarea class="in" data-in-o="${n}" maxlength="300" placeholder="¿Qué se observó? (mínimo 5 letras)">${esc(c.obs)}</textarea>
          <label class="f">Fotos con la observación marcada</label>
          <div class="hz-thumbs">${c.fotos.map((f, fi) => `<div class="hz-thumb"><img src="${f}" alt=""><button type="button" data-in-fq="${n}|${fi}">✕</button></div>`).join("")}</div>
          ${c.fotos.length < MAX_FOTOS ? `<label class="btn sec sm" style="display:inline-block">📷 Foto con la marca<input type="file" accept="image/*" capture="environment" data-in-f="${n}" hidden></label>` : ""}
          <label class="f">Acción correctiva</label><textarea class="in" data-in-a="${n}" maxlength="300" placeholder="¿Qué se hará para corregirlo? (mínimo 5 letras)">${esc(c.accion || "")}</textarea>
          <label class="f">Responsable de la acción</label><input class="in" data-in-rs="${n}" maxlength="60" autocomplete="off" placeholder="Nombre y apellidos" value="${esc(c.resp || "")}">
          <label class="f">Plazo</label><input class="in" type="date" data-in-pz="${n}" min="${hoy()}" max="${masDias(hoy(), 365)}" value="${esc(c.plazo || "")}"></div>` : "") + `</div>`;
    }).join("")).join("") + `</div>`;
  else if(id === "resultado"){
    if(def.resultado.modo === "texto") sec = `<div class="in-card"><h3>${tit}</h3><label class="f" for="in-rt">${esc(def.resultado.titulo)}</label>
      <textarea id="in-rt" class="in" maxlength="1500" style="min-height:140px" placeholder="Escriba los resultados de la inspección (mínimo 10 letras)">${esc(F.resultadoTexto)}</textarea></div>`;
    else { const p = porcentaje(F), cal = calif(p, def.resultado.cortes), K = def.resultado.cortes;
      sec = `<div class="in-card"><h3>${tit}</h3>
      <div class="in-res ${claseCal(cal)}"><b>${p === null ? "s/d" : p + " %"}</b> ${esc(cal || "Sin criterios aplicables")}<div class="s">Conformidad = conformes ÷ (conformes + no conformes). Los N/A no cuentan. Cortes: ≥ ${K.sat} % satisfactorio, ${K.ace}–${(K.sat - 0.1).toFixed(1)} % aceptable con acciones, menor a ${K.ace} % no satisfactorio.</div></div></div>`; }
  }
  else sec = `<div class="in-card"><h3>${tit}</h3>
    <div class="in-pt"><p class="s" style="margin:0 0 4px"><b>${esc(def.firmas.insp)}</b></p>
      <label class="f">Nombres y apellidos</label><div style="font-size:15px;padding:2px 0">${esc(SES ? SES.nombre : "")}</div>
      <label class="f" for="in-ic">Cargo</label><input id="in-ic" class="in" autocomplete="off" maxlength="40" value="${esc(F.inspCargo)}">
      <label class="f">Firma</label>
      <canvas class="in-fp" data-in-fc="insp"></canvas><div class="in-fb"><span>Firme con el dedo</span><button type="button" class="btn sec sm" data-in-fl="insp">Borrar firma</button></div></div>
    <div class="in-pt"><p class="s" style="margin:0 0 4px"><b>${esc(def.firmas.resp)}</b></p>
      <label class="f" for="in-rn">Nombres y apellidos</label><input id="in-rn" class="in" autocomplete="off" maxlength="60" placeholder="Jefe, líder o encargado" value="${esc(F.respNombre)}">
      <label class="f" for="in-rc">Cargo</label><input id="in-rc" class="in" autocomplete="off" maxlength="40" value="${esc(F.respCargo)}">
      <label class="f">Firma</label>
      <canvas class="in-fp" data-in-fc="resp"></canvas><div class="in-fb"><span>El responsable firma aquí</span><button type="button" class="btn sec sm" data-in-fl="resp">Borrar firma</button></div></div>
  </div>`;
  const ult = paso === P.length - 1, pct = Math.round(100 * (paso + 1) / P.length);
  const prog = `<div class="in-prog"><span>Paso ${paso + 1} de ${P.length} · ${esc(P[paso][1])}</span><div class="in-bar"><i style="width:${pct}%"></i></div></div>`;
  const nav = `<div class="err" id="in-err">${esc(S.err)}</div><div class="in-top"><button class="btn sec" style="flex:1" data-in="salir">Guardar borrador y salir</button></div>
    <div class="in-foot">${prog}<div class="in-nav">${paso > 0 ? `<button class="btn sec" data-in="atras">← Atrás</button>` : `<span></span>`}${!ult ? `<button class="btn" data-in="siguiente">Siguiente →</button>` : `<button class="btn" data-in="enviar" ${S.enviando ? "disabled" : ""}>${S.enviando ? "Terminando…" : "Terminar inspección"}</button>`}</div></div>`;
  box().innerHTML = sec + nav;
  if(id === "firmas") iniciaFirmas();
}
function leeCampos(){
  const F = S.F; if(!F) return;
  const g = id => document.getElementById(id);
  if(g("in-area")) F.area = g("in-area").value;
  if(g("in-rn")) F.respNombre = g("in-rn").value;
  if(g("in-rc")) F.respCargo = g("in-rc").value;
  if(g("in-ic")) F.inspCargo = g("in-ic").value;
  if(g("in-rt")) F.resultadoTexto = g("in-rt").value;
  box().querySelectorAll("[data-in-pn]").forEach(e => { F.puntos[+e.dataset.inPn].nombre = e.value; });
  box().querySelectorAll("[data-in-o]").forEach(e => { F.crit[+e.dataset.inO].obs = e.value; });
  box().querySelectorAll("[data-in-a]").forEach(e => { F.crit[+e.dataset.inA].accion = e.value; });
  box().querySelectorAll("[data-in-rs]").forEach(e => { F.crit[+e.dataset.inRs].resp = e.value; });
  box().querySelectorAll("[data-in-pz]").forEach(e => { F.crit[+e.dataset.inPz].plazo = e.value; });
}
// en qué paso está lo que falta (según el mensaje de validación)
const pasoDe = m => /^Elija el área/.test(m) ? "datos" : /^(Cada punto|Punto «)/.test(m) ? "puntos" : /^Criterio/.test(m) ? "criterios" : /^Escriba los resultados/.test(m) ? "resultado" : "firmas";
const idxPaso = (F, id) => Math.max(0, pasos(F.fmt.def).map(p => p[0]).indexOf(id));
function irA(sel){
  const el = sel && box().querySelector(sel);
  if(el){ el.scrollIntoView({block:"center", behavior:"smooth"}); const c = el.closest(".c, .in-crit"); if(c){ c.style.outline = "2px solid var(--red)"; c.style.borderRadius = "8px"; } }
}
function validaLocal(F){
  const def = F.fmt.def;
  if(!F.area) return "Elija el área.";
  if(F.puntos.some(p => !p.nombre.trim())) return "Cada punto necesita un nombre.";
  for(let i = 0; i < F.puntos.length; i++){
    const f = colsDe(def).filter(c => !F.puntos[i].c[c.k])[0];
    if(f){ S.falta = `[data-in-c="${i}|${f.k}"]`; return "Punto «" + F.puntos[i].nombre + "»: falta marcar " + f.t + ". Marque C, NC o N/A en cada casilla."; }
  }
  const L = items(def);
  for(const it of L) if(it.auto !== "puntos" && !F.crit[it.n].r){ S.falta = `[data-in-r^="${it.n}|"]`; return "Criterio " + it.n + ": falta marcar C, NC o N/A."; }
  for(const it of L){
    const n = it.n; if(resultadoCrit(F, n) !== "NC") continue;
    const c = F.crit[n];
    if(c.obs.trim().length < 5){ S.falta = `[data-in-o="${n}"]`; return "Criterio " + n + ": describa lo observado (mínimo 5 letras)."; }
    if((c.accion || "").trim().length < 5){ S.falta = `[data-in-a="${n}"]`; return "Criterio " + n + ": escriba la acción correctiva (mínimo 5 letras)."; }
    if((c.resp || "").trim().length < 3){ S.falta = `[data-in-rs="${n}"]`; return "Criterio " + n + ": escriba el responsable de la acción."; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(c.plazo || "") || c.plazo < hoy() || c.plazo > masDias(hoy(), 365)){ S.falta = `[data-in-pz="${n}"]`; return "Criterio " + n + ": elija un plazo desde hoy y hasta 365 días."; }
    if(!c.fotos.length) return "Criterio " + n + ": agregue una foto con la observación marcada.";
  }
  if(def.resultado.modo === "texto" && (F.resultadoTexto || "").trim().length < 10){ S.falta = "#in-rt"; return "Escriba los resultados de la inspección (mínimo 10 letras)."; }
  if(F.respNombre.trim().length < 3) return "Escriba el nombre del responsable del área.";
  if(!F.firmaInsp) return "Falta la firma del inspector.";
  if(!F.firmaResp) return "Falta la firma del responsable del área.";
  return "";
}
async function enviar(){
  const F = S.F; if(!F || S.enviando) return; leeCampos();
  S.falta = ""; S.err = validaLocal(F);
  if(S.err){ S.paso = idxPaso(F, pasoDe(S.err)); pintaForm(); irA(S.falta); return; }
  if(!navigator.onLine){ S.err = "Sin señal. Su inspección está guardada como borrador: toque Terminar inspección cuando tenga señal."; guardaBorrador(); return pintaForm(); }
  S.enviando = true; pintaForm();
  const criterios = items(F.fmt.def).map(it => { const n = it.n, r = resultadoCrit(F, n), c = F.crit[n]; return r === "NC" ? {n:n, r:r, obs:c.obs.trim(), accion:c.accion.trim(), responsable:c.resp.trim(), plazo:c.plazo, fotos:c.fotos} : {n:n, r:r}; });
  try{
    const j = await postJ({action:"inspeccion_guardar", id:F.id, versionId:F.fmt.versionId, area:F.area, respNombre:F.respNombre.trim(), respCargo:F.respCargo.trim(), inspectorCargo:F.inspCargo.trim(), firmaInsp:F.firmaInsp, firmaResp:F.firmaResp,
      puntos:F.puntos.map(p => ({nombre:p.nombre.trim(), c:p.c, obs:p.obs || ""})), criterios:criterios, resultadoTexto:(F.resultadoTexto || "").trim()}, 120000);
    S.enviando = false;
    if(j && j.ok){ try{ localStorage.setItem("insp_cargo:" + (SES && SES.usuario), F.inspCargo.trim()); }catch(e){} borraBorrador(); const idNueva = F.id; S.defs[F.fmt.versionId] = F.fmt; S.F = null; S.vista = "lista"; S.lista = null; S.err = ""; toast("Inspección terminada" + (j.hallazgos && j.hallazgos.length ? " · " + j.hallazgos.length + " hallazgo(s) creados" : "")); pintaLista(); await carga();
      if((S.lista || []).some(x => x.id === idNueva)){ S.sel = idNueva; S.vista = "detalle"; S.fin = true; repinta(); window.scrollTo(0, 0); }
      return; }
    S.err = (j && (j.error === "sesion" || j.error === "cambiar_clave")) ? "Su sesión venció. Ingrese de nuevo: lo escrito se conserva." : (j && j.error === "nc_invalida" && j.criterio ? "Criterio " + j.criterio + ": revise observación, foto, acción, responsable y plazo." : ERR[j && j.error] || "No se pudo guardar. Intente de nuevo.");
  }catch(e){ S.enviando = false; S.err = "Sin señal o respuesta lenta. Su inspección sigue como borrador: intente de nuevo."; }
  if(/^Criterio/.test(S.err)) S.paso = idxPaso(F, "criterios");
  guardaBorrador(); pintaForm();
}

/* ---------- firma en pantalla ---------- */
function iniciaFirmas(){
  box().querySelectorAll("canvas[data-in-fc]").forEach(cv => {
    const k = cv.dataset.inFc, w = cv.clientWidth || 320, h = cv.clientHeight || 130, r = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * r; cv.height = h * r;
    const x = cv.getContext("2d"); x.scale(r, r); x.lineWidth = 2.2; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = "#111";
    const guardada = k === "insp" ? S.F.firmaInsp : S.F.firmaResp;
    if(guardada){ const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, w, h); im.src = guardada; }
    let dib = false, ult = null;
    const pos = e => { const b = cv.getBoundingClientRect(); return {x:e.clientX - b.left, y:e.clientY - b.top}; };
    cv.onpointerdown = e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); dib = true; ult = pos(e); x.beginPath(); x.moveTo(ult.x, ult.y); x.lineTo(ult.x + .1, ult.y + .1); x.stroke(); };
    cv.onpointermove = e => { if(!dib) return; e.preventDefault(); const p = pos(e); x.beginPath(); x.moveTo(ult.x, ult.y); x.lineTo(p.x, p.y); x.stroke(); ult = p; };
    const fin = () => { if(!dib) return; dib = false; guardaFirma(k, cv); };
    cv.onpointerup = fin; cv.onpointercancel = fin;
  });
}
function guardaFirma(k, cv){
  // se reduce a 400 px de ancho y en PNG: pesa pocos KB y cabe en una celda de la hoja
  const c2 = document.createElement("canvas"), w = 400, h = Math.round(400 * cv.height / cv.width); c2.width = w; c2.height = h;
  const x = c2.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(cv, 0, 0, w, h);
  const url = c2.toDataURL("image/png");
  if(k === "insp") S.F.firmaInsp = url; else S.F.firmaResp = url;
  guardaBorrador();
}

/* ---------- PDF / impresión: se arma al momento con los datos guardados y la versión del formato; no se guarda en el servidor ---------- */
const CSS_PDF = `<style>
.fi{font:10.5px/1.2 Arial,Helvetica,sans-serif;color:#000;padding:8px;background:#fff}
.fi table{border-collapse:collapse;width:100%}.fi td,.fi th{border:1px solid #000;padding:2px 5px;vertical-align:middle}.fi{page-break-after:always}.fi:last-child{page-break-after:auto}
.fi th{background:#EFE1D4;font-weight:bold;text-align:center;font-size:10px}
.fi .t{font-size:15px;font-weight:bold;text-align:center}.fi .c{text-align:center}.fi .g{background:#f4ece3;font-weight:bold}
.fi .s{font-weight:bold;margin:6px 0 2px;font-size:11px}.fi .nc{background:#fde3df;font-weight:bold}
.fi .fm{height:60px;text-align:center}.fi .fm img{max-height:56px;max-width:100%}
.fi .sw{display:inline-block;width:8px;height:8px;border:1px solid #777;margin-right:3px;vertical-align:middle}
.fi .tx{white-space:pre-wrap;min-height:40px}
</style>`;
const celda = (v, cls) => `<td class="c ${cls || ""}${v === "NC" ? " nc" : ""}">${esc(v || "")}</td>`;
// i = inspección (o vacía para el formato en blanco), f = firmas, fmt = versión del formato
function htmlFormato(i, f, fmt){
  const def = fmt.def, crit = {}; (i.criterios || []).forEach(c => crit[c.n] = c);
  let L = 0; const sec = (t, extra) => `<div class="s">${LET[L++]}. ${esc(t.toUpperCase())}${extra ? ` <span style="font-weight:normal">${extra}</span>` : ""}</div>`;
  let h = CSS_PDF + `<div class="fi">
  <table><tr><td rowspan="3" style="width:90px" class="c"><b>${esc(CFG.PLANTA || "")}</b></td><td rowspan="3" class="t">${esc(def.titulo.toUpperCase())}</td><td>Código: <b>${esc(fmt.codigo)}</b></td></tr>
  <tr><td>Versión: <b>${esc(fmt.version)}</b></td></tr><tr><td>Fecha de aprobación: ${esc(fecha(fmt.fechaAprobacion))}</td></tr></table>
  ${sec("Datos generales")}
  <table><tr><td><b>PLANTA:</b> ${esc(CFG.PLANTA || "")}</td><td><b>FECHA:</b> ${esc(fecha(i.fecha))}</td></tr><tr><td><b>ÁREA INSPECCIONADA:</b> ${esc(i.area || "")}</td><td><b>HORA:</b> ${esc(i.hora || "")}</td></tr></table>`;
  if(def.puntos){
    const C = def.puntos.columnas, pts = (i.puntos || []).slice(); while(pts.length < 3) pts.push(null);
    h += sec(def.puntos.titulo, def.puntos.nota ? "· " + esc(def.puntos.nota) : "") +
      `<table><tr><th>N°</th><th>PUNTO</th>${C.map(c => `<th>${c.color ? `<span class="sw" style="background:${esc(c.color)}"></span>` : ""}${esc(c.t.toUpperCase())}</th>`).join("")}<th>OBSERVACIONES</th></tr>` +
      pts.map((p, k) => p ? `<tr><td class="c">${k + 1}</td><td>${esc(p.nombre)}</td>${C.map(c => celda(p.c[c.k])).join("")}<td>${esc(p.obs || "")}</td></tr>` : `<tr><td class="c">${k + 1}</td><td></td>${C.map(() => "<td></td>").join("")}<td></td></tr>`).join("") + `</table>`;
  }
  h += sec("Criterios de inspección y plan de acción") +
    `<table><tr><th>N°</th><th>CRITERIO</th><th>RESULTADO</th><th>OBSERVACIÓN / HALLAZGO</th><th>ACCIÓN CORRECTIVA</th><th>RESPONSABLE</th><th>PLAZO</th></tr>` +
    def.criterios.grupos.map(g => `<tr><td class="g" colspan="7">${esc(g.nombre.toUpperCase())}</td></tr>` + g.items.map(it => {
      const c = crit[it.n] || {r:"", obs:""};
      return `<tr><td class="c">${it.n}</td><td>${esc(it.t)}</td>${celda(c.r)}<td>${esc(c.obs || "")}</td><td>${esc(c.accion || "")}</td><td>${esc(c.responsable || "")}</td><td class="c">${c.plazo ? esc(fecha(c.plazo)) : ""}</td></tr>`;
    }).join("")).join("") + `</table>`;
  h += sec("Resultado") + (def.resultado.modo === "texto"
    ? `<table><tr><td><b>${esc(def.resultado.titulo.toUpperCase())}:</b><div class="tx">${esc(i.resultadoTexto || "")}</div></td></tr></table>`
    : `<table><tr><td><b>% DE CONFORMIDAD:</b> ${i.pct === "" || i.pct == null ? "—" : esc(i.pct) + " %"}</td><td><b>CALIFICACIÓN:</b> ${esc(i.calificacion || "—")}</td></tr></table>`);
  h += sec("Firmas") + `<table><tr><th>${esc(def.firmas.insp.toUpperCase())}</th><th>${esc(def.firmas.resp.toUpperCase())}</th></tr>
  <tr><td>Nombres y apellidos: ${esc(i.inspectorNombre || "")}</td><td>Nombres y apellidos: ${esc(i.respNombre || "")}</td></tr>
  <tr><td>Cargo: ${esc(i.inspectorCargo || "")}</td><td>Cargo: ${esc(i.respCargo || "")}</td></tr>
  <tr><td class="fm">Firma: ${f && f.firmaInsp ? `<img src="${f.firmaInsp}" alt="">` : ""}</td><td class="fm">Firma: ${f && f.firmaResp ? `<img src="${f.firmaResp}" alt="">` : ""}</td></tr></table></div>`;
  return h;
}
const cargaJS2 = src => new Promise((ok, no) => { if(window.__jsI && window.__jsI[src]) return ok(); const e = document.createElement("script"); e.src = src; e.onload = () => { (window.__jsI = window.__jsI || {})[src] = 1; ok(); }; e.onerror = () => no(new Error("lib")); document.head.appendChild(e); });
const limpiaNombre = t => t.replace(/[\\/:*?"<>|]/g, "-");
const nombreArchivo = (i, fmt) => limpiaNombre(fmt.codigo + " " + i.area + " " + fecha(i.fecha).replace(/\//g, "-") + " " + (CFG.PLANTA || ""));
async function firmasDe(i){
  if(S.firmas && S.firmas[i.id]) return S.firmas[i.id];
  const j = await postJ({action:"inspeccion_firmas", id:i.id});
  if(!(j && j.ok)) throw new Error("firmas");
  (S.firmas = S.firmas || {})[i.id] = {firmaInsp:j.firmaInsp, firmaResp:j.firmaResp};
  return S.firmas[i.id];
}
// HTML del formato → PDF A4 horizontal (cada bloque entra completo en una hoja)
async function pdfDesdeHtml(html, nombre){
  await cargaJS2("lib/html2canvas.min.js"); await cargaJS2("lib/jspdf.umd.min.js");
  const w = document.createElement("div"); w.className = "insp-pdfw"; w.innerHTML = html; document.body.appendChild(w);
  try{
    await Promise.all([...w.querySelectorAll("img")].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    const pdf = new window.jspdf.jsPDF({unit:"mm", format:"a4", orientation:"landscape"});
    const M = 8, W = 297 - 2 * M, Hp = 210 - 2 * M, hojas = [...w.querySelectorAll(".fi")];
    for(let k = 0; k < hojas.length; k++){
      const cv = await html2canvas(hojas[k], {scale:2, backgroundColor:"#fff", useCORS:true, logging:false});
      const r = Math.min(W / cv.width, Hp / cv.height);
      if(k) pdf.addPage();
      pdf.addImage(cv.toDataURL("image/jpeg", .92), "JPEG", M, M, cv.width * r, cv.height * r);
    }
    return new File([pdf.output("blob")], nombre + ".pdf", {type:"application/pdf"});
  } finally { w.remove(); }
}
async function pdfInspeccion(i){ const f = await firmasDe(i), fmt = await fmtDe(i.versionId); return pdfDesdeHtml(htmlFormato(i, f, fmt), nombreArchivo(i, fmt)); }
function descargaArchivo(file){
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function compartirInsp(i, btn, soloDescargar){
  const t0 = btn.textContent; btn.disabled = true; btn.textContent = "Preparando PDF…";
  try{
    const file = await pdfInspeccion(i);
    if(!soloDescargar && navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({files:[file], title:file.name, text:"Inspección ambiental " + i.area + " · " + fecha(i.fecha)}); }catch(e){}
    } else { descargaArchivo(file); toast("El PDF se guardó en Descargas."); }
  }catch(e){ toast("No se pudo crear el PDF. Revise su señal e intente de nuevo."); }
  btn.disabled = false; btn.textContent = t0;
}
async function imprimirInsp(i, btn){
  const t0 = btn.textContent; btn.disabled = true; btn.textContent = "Preparando…";
  try{
    const f = await firmasDe(i), fmt = await fmtDe(i.versionId);
    const p = document.createElement("div"); p.className = "insp-printarea"; p.innerHTML = htmlFormato(i, f, fmt); document.body.appendChild(p);
    const tit = document.title; document.title = nombreArchivo(i, fmt);   // el navegador propone este nombre al guardar como PDF
    const fin = () => { p.remove(); document.title = tit; window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin); window.print(); setTimeout(fin, 60000);
  }catch(e){ toast("No se pudo preparar la impresión. Revise su señal e intente de nuevo."); }
  btn.disabled = false; btn.textContent = t0;
}

/* ---------- eventos ---------- */
document.addEventListener("click", async ev => {
  if(!document.getElementById("v-insp") || document.getElementById("v-insp").classList.contains("hidden")) return;
  const t = ev.target, F = S.F;
  const ver = t.closest("[data-in-ver]"); if(ver){ S.sel = ver.dataset.inVer; S.fin = false; S.vista = "detalle"; repinta(); return; }
  const cb = t.closest("[data-in-c]");
  if(cb && F){ leeCampos(); const [i, k] = cb.dataset.inC.split("|"); F.puntos[+i].c[k] = cb.dataset.v; guardaBorrador(); pintaForm(); return; }
  const rb = t.closest("[data-in-r]"); if(rb && F){ leeCampos(); const [n, k] = rb.dataset.inR.split("|"); F.crit[+n].r = k; guardaBorrador(); pintaForm(); return; }
  const pq = t.closest("[data-in-pq]"); if(pq && F){ leeCampos(); F.puntos.splice(+pq.dataset.inPq, 1); guardaBorrador(); pintaForm(); return; }
  const fq = t.closest("[data-in-fq]"); if(fq && F){ leeCampos(); const [n, i] = fq.dataset.inFq.split("|"); F.crit[+n].fotos.splice(+i, 1); pintaForm(); return; }
  const fl = t.closest("[data-in-fl]"); if(fl && F){ if(fl.dataset.inFl === "insp") F.firmaInsp = ""; else F.firmaResp = ""; guardaBorrador(); pintaForm(); return; }
  const k = t.closest("[data-in]"); if(!k) return; const a = k.dataset.in;
  if(a === "pdf" || a === "descargar" || a === "imprimir"){ const i = (S.lista || []).find(x => x.id === S.sel); if(i){ if(a === "imprimir") imprimirInsp(i, k); else compartirInsp(i, k, a === "descargar"); } return; }
  if(a === "nueva"){ if(!S.fmt) return; S.F = nuevoForm(S.fmt); S.paso = 0; S.vista = "form"; S.err = ""; guardaBorrador(); pintaForm(); cargaAreas(); }
  else if(a === "seguir"){ const b = leeBorrador(); if(!b) return pintaLista(); S.F = b; S.paso = 0; S.vista = "form"; S.err = ""; pintaForm(); cargaAreas(); }
  else if(a === "descartar"){ if(confirm("¿Descartar la inspección sin terminar?")){ borraBorrador(); pintaLista(); } }
  else if(a === "lista"){ S.fin = false; S.vista = "lista"; repinta(); }
  else if(a === "punto" && F){ leeCampos(); F.puntos.push(nuevoPunto(F.fmt.def, F.puntos.length + 1)); guardaBorrador(); pintaForm(); }
  else if(a === "salir" && F){ leeCampos(); guardaBorrador(); S.F = null; S.vista = "lista"; pintaLista(); }
  else if(a === "siguiente" && F){
    leeCampos(); S.falta = ""; const e = validaLocal(F);
    if(e && idxPaso(F, pasoDe(e)) <= S.paso){ S.err = e; guardaBorrador(); pintaForm(); irA(S.falta); }
    else { S.err = ""; S.paso = Math.min(S.paso + 1, pasos(F.fmt.def).length - 1); guardaBorrador(); pintaForm(); window.scrollTo(0, 0); }
  }
  else if(a === "atras" && F){ leeCampos(); S.err = ""; S.paso = Math.max(S.paso - 1, 0); guardaBorrador(); pintaForm(); window.scrollTo(0, 0); }
  else if(a === "enviar") enviar();
});
function filtroDesdeCampos(){
  const g = id => document.getElementById(id);
  if(!g("in-q-txt")) return;
  S.q = {txt:g("in-q-txt").value, cal:g("in-q-cal").value, desde:g("in-q-desde").value, hasta:g("in-q-hasta").value};
  const l = document.getElementById("in-lst"); if(l) l.innerHTML = htmlLista();     // solo la lista: el cursor sigue en el buscador
}
document.addEventListener("change", async ev => {
  if(TAB !== "insp") return;
  const t = ev.target, F = S.F;
  if(t.id && t.id.indexOf("in-q-") === 0) return filtroDesdeCampos();
  if(!F) return;
  if(t.id === "in-area"){ F.area = t.value; S.err = ""; const e = document.getElementById("in-err"); if(e) e.textContent = ""; guardaBorrador(); return; }
  if(t.dataset.inF !== undefined){
    const n = +t.dataset.inF, file = t.files && t.files[0]; if(!file || F.crit[n].fotos.length >= MAX_FOTOS) return;
    leeCampos();
    try{ const c = await comprimirFoto(file); const m = await marcarFoto(c.dataUrl); if(m) F.crit[n].fotos.push(m); }catch(x){ toast("No se pudo leer la foto. Intente de nuevo."); }
    guardaBorrador(); pintaForm(); return;
  }
});
document.addEventListener("input", ev => {
  if(TAB !== "insp") return;
  if(ev.target.id === "in-q-txt") return filtroDesdeCampos();
  if(S.F && ev.target.closest("#insp-body")){ leeCampos(); }
});

window.drawInsp = drawInsp;
// el módulo Control documentario reutiliza el mismo armado del formato para el PDF en blanco
window.INSP_FORMATO = {html:htmlFormato, pdf:pdfDesdeHtml, descarga:descargaArchivo, nombre:limpiaNombre, items:items, fecha:fecha};
window.INSPUI = {S, calif, porcentaje};
})();
