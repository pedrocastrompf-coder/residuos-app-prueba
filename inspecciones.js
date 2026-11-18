/* Inspecciones de medio ambiente (SGA.R.G.002 Vs 06) · formulario ágil: todo conforme por defecto, puntos de segregación,
   17 criterios en 5 bloques, no conformidades que pasan a Hallazgos, borrador sin señal.
   Se carga después de hallazgos-img.js y usa: $, esc, uuid, toast, postJ, can, SES, CFG, TAB, showView. El servidor valida y calcula. */
(function(){
"use strict";

const COLS = [["noaprov","No aprovechable"],["organico","Orgánico"],["papel","Papel y cartón"],["plastico","Plástico"],["vidrio","Vidrio"],["metal","Metal"],["peligroso","Peligrosos"],["mermas","Mermas"],["rotulacion","Rotulación"],["delimitacion","Delimitación"]];
const RESP = [["C","Conforme"],["NC","No conforme"],["NA","N/A"]];
const BLOQUES = [
  ["Contenedores y segregación",[1,2,3,4,5]], ["Acopio y peligrosos",[6,7,8]], ["Derrames y efluentes",[9,10,11]],
  ["Emisiones y recursos",[12,13,14]], ["Proceso y personal",[15,16,17]]
];
const CRIT = {
  1:"Segregación, rotulación y delimitación conformes en todos los puntos (se calcula de la Sección A)",
  2:"Contenedores en buen estado, con bolsa y letrero de colores NTP 900.058",
  3:"Sin sobrellenado ni residuos fuera del contenedor; punto limpio y ordenado",
  4:"Envolturas laminadas / metalizadas segregadas según instructivo",
  5:"Mermas y subproductos separados, identificados y con destino registrado",
  6:"Acopio temporal en condiciones (techo, piso, señalización, contención)",
  7:"Residuos peligrosos y RAEE en recipiente cerrado y rotulado",
  8:"Químicos almacenados según FDS, con bandeja antiderrame y rótulo",
  9:"Kit antiderrames completo y accesible",
  10:"Trampas de grasa operativas",
  11:"Efluentes de lavado CIP neutralizados antes de descargar",
  12:"Sin humo, olores, polvo ni fugas de refrigerante anormales",
  13:"Sin fugas de agua, vapor, aire o gas; equipos apagados si no se usan",
  14:"Flujómetros operativos",
  15:"Residuos en zona de proceso sin riesgo de plagas ni contaminación cruzada",
  16:"Personal conoce aspectos ambientales, colores y respuesta a derrames",
  17:"Otro"
};
const MAX_PUNTOS = 8, MAX_FOTOS = 3, BORR = "insp_borrador_v1";
const ERR = {
  area_invalida:"El área elegida no existe o está inactiva.", responsable_invalido:"Escriba el nombre del responsable del área (mínimo 3 letras).",
  cargo_invalido:"El cargo es demasiado largo.", puntos_invalidos:"Revise los puntos de segregación: cada punto necesita nombre y todas sus casillas.",
  criterios_invalidos:"Faltan criterios por revisar.", nc_invalida:"Una no conformidad no está completa (observación y foto).",
  id_invalido:"La inspección no es válida. Vuelva a empezar.", permiso:"No tiene permiso para esta acción.", clave:"El servidor no reconoce esta acción. Avise al administrador: falta actualizar el script."
};
const S = {vista:"lista", lista:null, t:0, cargando:false, areas:null, F:null, enviando:false, err:"", sel:null};

const st = document.createElement("style");
st.textContent = `
.in-top{display:flex;gap:8px;margin:8px 0}
.in-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;margin:10px 0}
.in-card h3{margin:0 0 6px;font-size:15px;color:var(--brown)}
.in-card .s{font-size:12.5px;color:var(--gray);margin:0 0 8px}
.in-sg{display:inline-flex;border:1.5px solid var(--taupe);border-radius:10px;overflow:hidden}
.in-sg button{border:0;background:#fff;color:var(--brown);padding:7px 10px;font-weight:bold;font-size:13px;min-width:44px}
.in-sg button.on.C{background:var(--ok);color:#fff} .in-sg button.on.NC{background:var(--red);color:#fff} .in-sg button.on.NA{background:#8a8077;color:#fff}
.in-pt{border:1px solid var(--line);border-radius:12px;padding:10px;margin:8px 0;background:#faf7f3}
.in-pt .c{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:5px 0;font-size:13.5px}
.in-crit{border-top:1px solid var(--line);padding:8px 0}
.in-crit .t{font-size:14px;margin-bottom:6px}.in-crit .n{font-weight:bold;color:var(--brown)}
.in-nc{background:var(--red-bg);border-radius:10px;padding:8px;margin-top:6px}
.in-nc textarea{width:100%;min-height:60px}
.in-ok{display:flex;gap:8px;align-items:center;font-weight:bold;color:var(--brown);margin:10px 0 2px}
.in-res{border-left:6px solid var(--taupe);border-radius:12px;background:#fff;padding:12px;margin:10px 0;border:1px solid var(--line);border-left-width:6px}
.in-res.sat{border-left-color:var(--ok)} .in-res.ace{border-left-color:var(--orange)} .in-res.nos{border-left-color:var(--red)}
.in-res b{font-size:22px;color:var(--brown)}
.in-row{display:block;width:100%;text-align:left;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:6px 0;font:inherit;color:inherit}
.in-row .l1{display:flex;justify-content:space-between;gap:8px;align-items:center}
`;
document.head.appendChild(st);

const box = () => document.getElementById("insp-body");
const fecha = s => s ? String(s).slice(8,10) + "/" + String(s).slice(5,7) + "/" + String(s).slice(0,4) : "";
const hoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };
const hora = () => { const d = new Date(); return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); };
const CORTES = {sat:90, ace:70};   // PROVISIONAL: igual que el servidor (Inspecciones.gs); confirmar con Medio Ambiente
const claseCal = c => c === "Satisfactorio" ? "sat" : c === "Aceptable con acciones" ? "ace" : c ? "nos" : "";

/* ---------- cálculo local (solo vista previa; el servidor recalcula) ---------- */
function crit1(F){
  let hay = false, nc = false;
  F.puntos.forEach(p => COLS.forEach(([k]) => { if(p.c[k] === "NC") nc = true; if(p.c[k] === "C") hay = true; }));
  return nc ? "NC" : hay ? "C" : "NA";
}
function resultadoCrit(F, n){ return n === 1 ? crit1(F) : F.crit[n].r; }
function porcentaje(F){
  let c = 0, nc = 0;
  for(let n = 1; n <= 17; n++){ const r = resultadoCrit(F, n); if(r === "C") c++; else if(r === "NC") nc++; }
  return (c + nc) ? Math.round(1000 * c / (c + nc)) / 10 : null;
}
const calif = p => p === null ? "" : p >= CORTES.sat ? "Satisfactorio" : p >= CORTES.ace ? "Aceptable con acciones" : "No satisfactorio";

/* ---------- estado y borrador ---------- */
function nuevoPunto(i){ const c = {}; COLS.forEach(([k]) => c[k] = k === "mermas" || k === "peligroso" || k === "vidrio" || k === "metal" ? "NA" : "C"); return {nombre:"Punto " + i, c:c, obs:""}; }
function nuevoForm(){
  const crit = {}; for(let n = 1; n <= 17; n++) crit[n] = {r:n === 17 ? "NA" : "C", obs:"", fotos:[]};
  return {id:"insp-" + uuid(), area:"", puntos:[nuevoPunto(1)], crit:crit, bloques:{}, respNombre:"", respCargo:"", t0:hoy() + " " + hora()};
}
function guardaBorrador(){ try{ if(S.F) localStorage.setItem(BORR + ":" + (SES && SES.usuario), JSON.stringify(S.F)); }catch(e){} }   // las fotos pueden pesar: si no cabe, no pasa nada
function leeBorrador(){ try{ const t = localStorage.getItem(BORR + ":" + (SES && SES.usuario)); return t ? JSON.parse(t) : null; }catch(e){ return null; } }
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
  if(S.areas === null) cargaAreas();
}
function repinta(){
  if(!box() || TAB !== "insp") return;
  if(S.vista === "form") return pintaForm();
  if(S.vista === "detalle") return pintaDetalle();
  pintaLista();
}
function pintaLista(){
  const L = S.lista || [], b = leeBorrador();
  box().innerHTML =
    `<div class="in-top"><button class="btn" data-in="nueva">＋ Nueva inspección</button></div>` +
    (b ? `<div class="in-card"><h3>Inspección sin terminar</h3><p class="s">${esc(b.area || "Sin área")} · iniciada ${esc(b.t0 || "")}</p><div class="in-top"><button class="btn sm" data-in="seguir">Continuar</button><button class="btn sec sm" data-in="descartar">Descartar</button></div></div>` : "") +
    (S.err ? `<div class="err">${esc(S.err)}</div>` : "") +
    (S.lista === null ? `<div class="card muted">Cargando…</div>` : L.length ? L.map(i =>
      `<button class="in-row" data-in-ver="${esc(i.id)}"><div class="l1"><b>${esc(i.area)}</b><span class="hz-b ${claseCal(i.calificacion) === "sat" ? "cer" : claseCal(i.calificacion) === "ace" ? "abi" : "venc"}">${esc(i.pct === "" ? "s/d" : i.pct + " %")}</span></div><div class="m" style="font-size:12.5px;color:var(--gray)">${fecha(i.fecha)} ${esc(i.hora)} · ${esc(i.inspectorNombre)} · ${esc(i.calificacion)} · ${(i.hallazgos || []).length} hallazgo(s)</div></button>`).join("")
      : `<div class="card muted">Todavía no hay inspecciones. Toque «Nueva inspección» para registrar la primera.</div>`);
}
function pintaDetalle(){
  const i = (S.lista || []).find(x => x.id === S.sel); if(!i){ S.vista = "lista"; return pintaLista(); }
  box().innerHTML = `<div class="in-top"><button class="btn sec sm" data-in="lista">← Historial</button></div>` +
    `<div class="in-res ${claseCal(i.calificacion)}"><div>${esc(i.area)} · ${fecha(i.fecha)} ${esc(i.hora)}</div><b>${esc(i.pct === "" ? "s/d" : i.pct + " %")}</b> ${esc(i.calificacion)}</div>` +
    `<div class="hz-kv"><span>Inspector</span><span>${esc(i.inspectorNombre)}</span><span>Responsable</span><span>${esc(i.respNombre)}${i.respCargo ? " · " + esc(i.respCargo) : ""}</span><span>Hallazgos</span><span>${(i.hallazgos || []).length ? esc(i.hallazgos.join(", ")) : "Ninguno"}</span></div>` +
    `<div class="in-card"><h3>Criterios</h3>${(i.criterios || []).map(c => `<div class="in-crit"><span class="n">${c.n}.</span> ${esc(CRIT[c.n])} — <b>${esc(c.r)}</b>${c.obs ? `<div class="s">${esc(c.obs)}</div>` : ""}</div>`).join("")}</div>`;
}
const sgCell = (i, k, val) => `<span class="in-sg">${RESP.map(([v]) => `<button type="button" data-in-c="${i}|${k}" data-v="${v}" class="${v}${val === v ? " on" : ""}">${v === "NA" ? "N/A" : v}</button>`).join("")}</span>`;

function pintaForm(){
  const F = S.F; if(!F) return;
  const areas = S.areas || [];
  const p = porcentaje(F), cal = calif(p);
  const secA = `<div class="in-card"><h3>A. Datos de la inspección</h3>
    <label>Área</label><select id="in-area"><option value="">Elija el área…</option>${areas.map(a => `<option ${a.nombre === F.area ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}</select>
    ${areas.length ? "" : `<p class="s">Cargando áreas…</p>`}
    <p class="s">Fecha y hora: ${esc(F.t0)} · Inspector: ${esc(SES ? SES.nombre : "")}</p></div>`;
  const secB = `<div class="in-card"><h3>B. Puntos de segregación</h3><p class="s">Un punto es un grupo de contenedores. Marque C (conforme), NC o N/A. Todo viene conforme: toque solo lo que no esté bien.</p>` +
    F.puntos.map((pt, i) => `<div class="in-pt"><div style="display:flex;gap:6px"><input data-in-pn="${i}" value="${esc(pt.nombre)}" maxlength="40" style="flex:1"><button type="button" class="btn sec sm" data-in-pq="${i}">Quitar</button></div>` +
      COLS.map(([k, t]) => `<div class="c"><span>${t}</span>${sgCell(i, k, pt.c[k])}</div>`).join("") + `</div>`).join("") +
    (F.puntos.length < MAX_PUNTOS ? `<button type="button" class="btn sec sm" data-in="punto">＋ Agregar punto</button>` : "") + `</div>`;
  const secC = `<div class="in-card"><h3>C. Criterios</h3>` + BLOQUES.map(([nom, ns], bi) =>
    `<p class="s" style="margin-top:10px"><b>${esc(nom)}</b></p>` + ns.map(n => {
      const c = F.crit[n], r = resultadoCrit(F, n), auto = n === 1;
      return `<div class="in-crit"><div class="t"><span class="n">${n}.</span> ${esc(CRIT[n])}</div>` +
        (auto ? `<span class="hz-b ${r === "C" ? "cer" : r === "NC" ? "venc" : "abi"}">${r === "NA" ? "N/A" : r} (automático)</span>` : `<span class="in-sg">${RESP.map(([k]) => `<button type="button" data-in-r="${n}|${k}" class="${k}${c.r === k ? " on" : ""}">${k === "NA" ? "N/A" : k}</button>`).join("")}</span>`) +
        (r === "NC" ? `<div class="in-nc"><textarea data-in-o="${n}" maxlength="300" placeholder="¿Qué se observó? (mínimo 5 letras)">${esc(c.obs)}</textarea>
          <div class="hz-thumbs">${c.fotos.map((f, fi) => `<div class="hz-thumb"><img src="${f}" alt=""><button type="button" data-in-fq="${n}|${fi}">✕</button></div>`).join("")}</div>
          ${c.fotos.length < MAX_FOTOS ? `<label class="btn sec sm" style="display:inline-block">📷 Foto con la marca<input type="file" accept="image/*" capture="environment" data-in-f="${n}" hidden></label>` : ""}</div>` : "") + `</div>`;
    }).join("") + `<label class="in-ok"><input type="checkbox" data-in-b="${bi}" ${F.bloques[bi] ? "checked" : ""}> Revisé este bloque</label>`).join("") + `</div>`;
  const secD = `<div class="in-card"><h3>Resultado y responsable</h3>
    <div class="in-res ${claseCal(cal)}"><b>${p === null ? "s/d" : p + " %"}</b> ${esc(cal || "Sin criterios aplicables")}<div class="s">Conformidad = conformes ÷ (conformes + no conformes). Los N/A no cuentan. Cortes provisionales: ≥ ${CORTES.sat} % satisfactorio, ${CORTES.ace}–${CORTES.sat - 0.1} % aceptable con acciones, menor a ${CORTES.ace} % no satisfactorio.</div></div>
    <label>Responsable del área (nombre)</label><input id="in-rn" maxlength="60" value="${esc(F.respNombre)}">
    <label>Cargo</label><input id="in-rc" maxlength="40" value="${esc(F.respCargo)}">
    <div class="err" id="in-err">${esc(S.err)}</div>
    <div class="in-top"><button class="btn" data-in="enviar" ${S.enviando ? "disabled" : ""}>${S.enviando ? "Enviando…" : "Guardar inspección"}</button><button class="btn sec" data-in="salir">Guardar borrador y salir</button></div></div>`;
  box().innerHTML = secA + secB + secC + secD;
}
function leeCampos(){
  const F = S.F; if(!F) return;
  const g = id => document.getElementById(id);
  if(g("in-area")) F.area = g("in-area").value;
  if(g("in-rn")) F.respNombre = g("in-rn").value;
  if(g("in-rc")) F.respCargo = g("in-rc").value;
  box().querySelectorAll("[data-in-pn]").forEach(e => { F.puntos[+e.dataset.inPn].nombre = e.value; });
  box().querySelectorAll("[data-in-o]").forEach(e => { F.crit[+e.dataset.inO].obs = e.value; });
}
function validaLocal(F){
  if(!F.area) return "Elija el área.";
  if(F.puntos.some(p => !p.nombre.trim())) return "Cada punto de segregación necesita un nombre.";
  for(let bi = 0; bi < BLOQUES.length; bi++) if(!F.bloques[bi]) return "Marque «Revisé este bloque» en: " + BLOQUES[bi][0] + ".";
  for(let n = 1; n <= 17; n++){
    if(resultadoCrit(F, n) !== "NC") continue;
    const c = F.crit[n];
    if(c.obs.trim().length < 5) return "Criterio " + n + ": describa lo observado (mínimo 5 letras).";
    if(!c.fotos.length) return "Criterio " + n + ": agregue una foto con la observación marcada.";
  }
  if(F.respNombre.trim().length < 3) return "Escriba el nombre del responsable del área.";
  return "";
}
async function enviar(){
  const F = S.F; if(!F || S.enviando) return; leeCampos();
  S.err = validaLocal(F); if(S.err) return pintaForm();
  if(!navigator.onLine){ S.err = "Sin señal. Su inspección está guardada como borrador: toque Guardar cuando tenga señal."; guardaBorrador(); return pintaForm(); }
  S.enviando = true; pintaForm();
  const criterios = []; for(let n = 1; n <= 17; n++){ const r = resultadoCrit(F, n), c = F.crit[n]; criterios.push(r === "NC" ? {n:n, r:r, obs:c.obs.trim(), fotos:c.fotos} : {n:n, r:r}); }
  try{
    const j = await postJ({action:"inspeccion_guardar", id:F.id, area:F.area, respNombre:F.respNombre.trim(), respCargo:F.respCargo.trim(),
      puntos:F.puntos.map(p => ({nombre:p.nombre.trim(), c:p.c, obs:p.obs || ""})), criterios:criterios}, 120000);
    S.enviando = false;
    if(j && j.ok){ borraBorrador(); S.F = null; S.vista = "lista"; S.lista = null; S.err = ""; toast("Inspección guardada" + (j.hallazgos && j.hallazgos.length ? " · " + j.hallazgos.length + " hallazgo(s) creados" : "")); pintaLista(); carga(); return; }
    S.err = (j && (j.error === "sesion" || j.error === "cambiar_clave")) ? "Su sesión venció. Ingrese de nuevo: lo escrito se conserva." : (j && j.error === "nc_invalida" && j.criterio ? "Criterio " + j.criterio + ": revise observación y foto." : ERR[j && j.error] || "No se pudo guardar. Intente de nuevo.");
  }catch(e){ S.enviando = false; S.err = "Sin señal o respuesta lenta. Su inspección sigue como borrador: intente de nuevo."; }
  guardaBorrador(); pintaForm();
}

/* ---------- eventos ---------- */
document.addEventListener("click", async ev => {
  if(!document.getElementById("v-insp") || document.getElementById("v-insp").classList.contains("hidden")) return;
  const t = ev.target, F = S.F;
  const ver = t.closest("[data-in-ver]"); if(ver){ S.sel = ver.dataset.inVer; S.vista = "detalle"; repinta(); return; }
  const cb = t.closest("[data-in-c]");
  if(cb && F){ leeCampos(); const [i, k] = cb.dataset.inC.split("|"); F.puntos[+i].c[k] = cb.dataset.v; guardaBorrador(); pintaForm(); return; }
  const rb = t.closest("[data-in-r]"); if(rb && F){ leeCampos(); const [n, k] = rb.dataset.inR.split("|"); F.crit[+n].r = k; guardaBorrador(); pintaForm(); return; }
  const pq = t.closest("[data-in-pq]"); if(pq && F){ leeCampos(); F.puntos.splice(+pq.dataset.inPq, 1); guardaBorrador(); pintaForm(); return; }
  const fq = t.closest("[data-in-fq]"); if(fq && F){ leeCampos(); const [n, i] = fq.dataset.inFq.split("|"); F.crit[+n].fotos.splice(+i, 1); pintaForm(); return; }
  const k = t.closest("[data-in]"); if(!k) return; const a = k.dataset.in;
  if(a === "nueva"){ S.F = nuevoForm(); S.vista = "form"; S.err = ""; guardaBorrador(); pintaForm(); if(S.areas === null) cargaAreas(); }
  else if(a === "seguir"){ S.F = leeBorrador(); S.vista = "form"; S.err = ""; pintaForm(); if(S.areas === null) cargaAreas(); }
  else if(a === "descartar"){ if(confirm("¿Descartar la inspección sin terminar?")){ borraBorrador(); pintaLista(); } }
  else if(a === "lista"){ S.vista = "lista"; repinta(); }
  else if(a === "punto" && F){ leeCampos(); F.puntos.push(nuevoPunto(F.puntos.length + 1)); guardaBorrador(); pintaForm(); }
  else if(a === "salir" && F){ leeCampos(); guardaBorrador(); S.F = null; S.vista = "lista"; pintaLista(); }
  else if(a === "enviar") enviar();
});
document.addEventListener("change", async ev => {
  const t = ev.target, F = S.F; if(!F || TAB !== "insp") return;
  if(t.id === "in-area"){ F.area = t.value; guardaBorrador(); return; }
  if(t.dataset.inB !== undefined){ F.bloques[+t.dataset.inB] = t.checked; guardaBorrador(); return; }
  if(t.dataset.inF !== undefined){
    const n = +t.dataset.inF, file = t.files && t.files[0]; if(!file || F.crit[n].fotos.length >= MAX_FOTOS) return;
    leeCampos();
    try{ const c = await comprimirFoto(file); const m = await marcarFoto(c.dataUrl); if(m) F.crit[n].fotos.push(m); }catch(x){ toast("No se pudo leer la foto. Intente de nuevo."); }
    guardaBorrador(); pintaForm(); return;
  }
});
document.addEventListener("input", ev => { if(S.F && TAB === "insp" && ev.target.closest("#insp-body")){ leeCampos(); } });

window.drawInsp = drawInsp;
window.INSPUI = {S, calif, porcentaje, crit1};
})();
