/* Inspecciones de medio ambiente (SGA.R.G.002 Vs 06) · formulario ágil: todo conforme por defecto, puntos de segregación,
   17 criterios en 5 bloques, no conformidades que pasan a Hallazgos, borrador sin señal.
   Se carga después de hallazgos-img.js y usa: $, esc, uuid, toast, postJ, can, SES, CFG, TAB, showView. El servidor valida y calcula. */
(function(){
"use strict";

const COLS = [["noaprov","No aprovechable"],["organico","Orgánico"],["papel","Papel y cartón"],["plastico","Plástico"],["vidrio","Vidrio"],["metal","Metal"],["peligroso","Peligrosos"],["mermas","Mermas"],["rotulacion","Rotulación"],["delimitacion","Delimitación"]];
const RESP = [["C","Conforme"],["NC","No conforme"],["NA","N/A"]];
const BLOQUES = [
  ["Residuos sólidos y acopio",[1,2,3,4,5,6]], ["Peligrosos y químicos",[7,8,9]], ["Efluentes y emisiones",[10,11,12]],
  ["Energía, agua e inocuidad",[13,14,15]], ["Toma de conciencia",[16,17]]
];
const FORMATO = Object.assign({codigo:"SGA.R.G.002", version:"06", aprobacion:""}, CFG.FORMATO_INSPECCION || {});
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
  cargo_invalido:"El cargo es demasiado largo.", firmas_invalidas:"Faltan las firmas o no son válidas. Vuelva a firmar.", puntos_invalidos:"Revise los puntos de segregación: cada punto necesita nombre y todas sus casillas.",
  criterios_invalidos:"Faltan criterios por revisar.", nc_invalida:"Una no conformidad no está completa (observación y foto).",
  id_invalido:"La inspección no es válida. Vuelva a empezar.", permiso:"No tiene permiso para esta acción.", clave:"El servidor no reconoce esta acción. Avise al administrador: falta actualizar el script."
};
const S = {falta:"", vista:"lista", lista:null, t:0, cargando:false, areas:null, F:null, enviando:false, err:"", sel:null};

const st = document.createElement("style");
st.textContent = `
.in-top{display:flex;gap:8px;margin:8px 0}
.in-g{display:grid;grid-template-columns:1fr 1fr 2fr;gap:10px;margin-top:2px}
.in-ro{border:1px solid var(--line);background:#faf7f3;border-radius:10px;padding:11px 12px;font-size:15px;color:var(--brown)}
@media(max-width:560px){.in-g{grid-template-columns:1fr 1fr}.in-g-w{grid-column:1/-1}}
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
.in-card .in{width:100%;box-sizing:border-box}
.in-fp{border:1.5px dashed var(--taupe);border-radius:10px;background:#fff;touch-action:none;width:100%;height:130px;display:block}
.in-fb{display:flex;justify-content:space-between;align-items:center;margin:4px 0 12px;font-size:12.5px;color:var(--gray)}
.insp-printarea{display:none}.insp-pdfw{position:absolute;left:-99999px;top:0;width:1122px;background:#fff}
@media print{.insp-printarea{display:block}.insp-printarea .fi{zoom:.86}body>*:not(.insp-printarea){display:none!important}@page{size:A4 landscape;margin:8mm}}
.in-row{display:block;width:100%;text-align:left;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:6px 0;font:inherit;color:inherit}
.in-row .l1{display:flex;justify-content:space-between;gap:8px;align-items:center}
`;
document.head.appendChild(st);

const box = () => document.getElementById("insp-body");
const fecha = s => s ? String(s).slice(8,10) + "/" + String(s).slice(5,7) + "/" + String(s).slice(0,4) : "";
const hoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };
const hora = () => { const d = new Date(); return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); };
const CORTES = {sat:90, ace:70};   // PROVISIONAL: igual que el servidor (Inspecciones.gs); confirmar con Medio Ambiente
const masDias = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.getFullYear() + "-" + String(x.getMonth()+1).padStart(2,"0") + "-" + String(x.getDate()).padStart(2,"0"); };
const claseCal = c => c === "Satisfactorio" ? "sat" : c === "Aceptable con acciones" ? "ace" : c ? "nos" : "";

/* ---------- cálculo local (solo vista previa; el servidor recalcula) ---------- */
function crit1(F){
  let hay = false, nc = false, falta = false;
  F.puntos.forEach(p => COLS.forEach(([k]) => { if(p.c[k] === "NC") nc = true; if(p.c[k] === "C") hay = true; if(!p.c[k]) falta = true; }));
  if(!nc && falta) return "";
  return nc ? "NC" : hay ? "C" : (F.puntos.length ? "NA" : "NA");
}
function resultadoCrit(F, n){ return n === 1 ? crit1(F) : F.crit[n].r; }
function porcentaje(F){
  let c = 0, nc = 0;
  for(let n = 1; n <= 17; n++){ const r = resultadoCrit(F, n); if(r === "C") c++; else if(r === "NC") nc++; }
  return (c + nc) ? Math.round(1000 * c / (c + nc)) / 10 : null;
}
const calif = p => p === null ? "" : p >= CORTES.sat ? "Satisfactorio" : p >= CORTES.ace ? "Aceptable con acciones" : "No satisfactorio";

/* ---------- estado y borrador ---------- */
function nuevoPunto(i){ const c = {}; COLS.forEach(([k]) => c[k] = ""); return {nombre:"Punto " + i, c:c, obs:""}; }   // nada viene marcado: el inspector marca punto por punto
function nuevoForm(){
  const crit = {}; for(let n = 1; n <= 17; n++) crit[n] = {r:"", obs:"", fotos:[], accion:"", resp:"", plazo:""};
  return {id:"insp-" + uuid(), area:"", puntos:[nuevoPunto(1)], crit:crit, bloques:{}, respNombre:"", respCargo:"", inspCargo:(function(){ try{ return localStorage.getItem("insp_cargo:" + (SES && SES.usuario)) || "Medio Ambiente"; }catch(e){ return "Medio Ambiente"; } })(), firmaInsp:"", firmaResp:"", t0:hoy() + " " + hora()};
}
function guardaBorrador(){ try{ if(S.F) localStorage.setItem(BORR + ":" + (SES && SES.usuario), JSON.stringify(S.F)); }catch(e){} }   // las fotos pueden pesar: si no cabe, no pasa nada
function leeBorrador(){
  try{
    const t = localStorage.getItem(BORR + ":" + (SES && SES.usuario)); if(!t) return null;
    const b = JSON.parse(t), base = nuevoForm();   // un borrador de una versión anterior puede no traer campos nuevos
    Object.keys(base).forEach(k => { if(b[k] === undefined || b[k] === null) b[k] = base[k]; });
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
  cargaAreas();
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
  box().innerHTML = `<div class="in-top"><button class="btn sec sm" data-in="lista">← Historial</button></div><div class="in-top"><button class="btn" data-in="pdf">Compartir PDF</button><button class="btn sec" data-in="imprimir">Imprimir</button></div>` +
    `<div class="in-res ${claseCal(i.calificacion)}"><div>${esc(i.area)} · ${fecha(i.fecha)} ${esc(i.hora)}</div><b>${esc(i.pct === "" ? "s/d" : i.pct + " %")}</b> ${esc(i.calificacion)}</div>` +
    `<div class="hz-kv"><span>Inspector</span><span>${esc(i.inspectorNombre)}</span><span>Responsable</span><span>${esc(i.respNombre)}${i.respCargo ? " · " + esc(i.respCargo) : ""}</span><span>Hallazgos</span><span>${(i.hallazgos || []).length ? esc(i.hallazgos.join(", ")) : "Ninguno"}</span></div>` +
    `<div class="in-card"><h3>Criterios</h3>${(i.criterios || []).map(c => `<div class="in-crit"><span class="n">${c.n}.</span> ${esc(CRIT[c.n])} — <b>${esc(c.r)}</b>${c.obs ? `<div class="s">${esc(c.obs)}</div>` : ""}${c.accion ? `<div class="s">Acción: ${esc(c.accion)} · Responsable: ${esc(c.responsable || "")} · Plazo: ${esc(fecha(c.plazo))}</div>` : ""}</div>`).join("")}</div>`;
}
const sgCell = (i, k, val) => `<span class="in-sg">${RESP.map(([v]) => `<button type="button" data-in-c="${i}|${k}" data-v="${v}" class="${v}${val === v ? " on" : ""}">${v === "NA" ? "N/A" : v}</button>`).join("")}</span>`;

function pintaForm(){
  const F = S.F; if(!F) return;
  const areas = S.areas || [];
  const p = porcentaje(F), cal = calif(p);
  const secA = `<div class="in-card"><h3>A. Datos de la inspección</h3>
    <label class="f" for="in-area">Área</label><select id="in-area" class="in"><option value="">Elija el área…</option>${areas.map(a => `<option ${a.nombre === F.area ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}</select>
    ${areas.length ? "" : `<p class="s">Cargando áreas…</p>`}
    <div class="in-g"><div><label class="f">Fecha</label><div class="in-ro">${esc(fecha(F.t0.slice(0,10)))}</div></div><div><label class="f">Hora</label><div class="in-ro">${esc(F.t0.slice(11,16))}</div></div><div class="in-g-w"><label class="f">Inspector</label><div class="in-ro">${esc(SES ? SES.nombre : "")}</div></div></div></div>`;
  const secB = `<div class="in-card"><h3>B. Puntos de segregación</h3><p class="s">Un punto es un grupo de contenedores. Marque cada casilla: C (conforme), NC (no conforme) o N/A (no aplica).</p>` +
    F.puntos.map((pt, i) => `<div class="in-pt"><div style="display:flex;gap:6px"><input class="in" data-in-pn="${i}" value="${esc(pt.nombre)}" maxlength="40" style="flex:1;width:auto;min-width:0"><button type="button" class="btn sec sm" data-in-pq="${i}">Quitar</button></div>` +
      COLS.map(([k, t]) => `<div class="c"><span>${t}</span>${sgCell(i, k, pt.c[k])}</div>`).join("") + `</div>`).join("") +
    (F.puntos.length < MAX_PUNTOS ? `<button type="button" class="btn sec sm" data-in="punto">＋ Agregar punto</button>` : "") + `</div>`;
  const secC = `<div class="in-card"><h3>C. Criterios</h3>` + BLOQUES.map(([nom, ns], bi) =>
    `<p class="s" style="margin-top:10px"><b>${esc(nom)}</b></p>` + ns.map(n => {
      const c = F.crit[n], r = resultadoCrit(F, n), auto = n === 1;
      return `<div class="in-crit"><div class="t"><span class="n">${n}.</span> ${esc(CRIT[n])}</div>` +
        (auto ? `<span class="hz-b ${r === "C" ? "cer" : r === "NC" ? "venc" : "abi"}">${r === "" ? "Pendiente: se calcula con la sección B" : (r === "NA" ? "N/A" : r) + " (automático)"}</span>` : `<span class="in-sg">${RESP.map(([k]) => `<button type="button" data-in-r="${n}|${k}" class="${k}${c.r === k ? " on" : ""}">${k === "NA" ? "N/A" : k}</button>`).join("")}</span>`) +
        (r === "NC" ? `<div class="in-nc"><label class="f">Observación</label><textarea class="in" data-in-o="${n}" maxlength="300" placeholder="¿Qué se observó? (mínimo 5 letras)">${esc(c.obs)}</textarea>
          <label class="f">Fotos con la observación marcada</label>
          <div class="hz-thumbs">${c.fotos.map((f, fi) => `<div class="hz-thumb"><img src="${f}" alt=""><button type="button" data-in-fq="${n}|${fi}">✕</button></div>`).join("")}</div>
          ${c.fotos.length < MAX_FOTOS ? `<label class="btn sec sm" style="display:inline-block">📷 Foto con la marca<input type="file" accept="image/*" capture="environment" data-in-f="${n}" hidden></label>` : ""}
          <label class="f">Acción correctiva</label><textarea class="in" data-in-a="${n}" maxlength="300" placeholder="¿Qué se hará para corregirlo? (mínimo 5 letras)">${esc(c.accion || "")}</textarea>
          <label class="f">Responsable de la acción</label><input class="in" data-in-rs="${n}" maxlength="60" autocomplete="off" placeholder="Nombre y apellidos" value="${esc(c.resp || "")}">
          <label class="f">Plazo</label><input class="in" type="date" data-in-pz="${n}" min="${hoy()}" max="${masDias(hoy(), 365)}" value="${esc(c.plazo || "")}"></div>` : "") + `</div>`;
    }).join("") ).join("") + `</div>`;
  const secD = `<div class="in-card"><h3>D. Resultado</h3>
    <div class="in-res ${claseCal(cal)}"><b>${p === null ? "s/d" : p + " %"}</b> ${esc(cal || "Sin criterios aplicables")}<div class="s">Conformidad = conformes ÷ (conformes + no conformes). Los N/A no cuentan. Cortes provisionales: ≥ ${CORTES.sat} % satisfactorio, ${CORTES.ace}–${CORTES.sat - 0.1} % aceptable con acciones, menor a ${CORTES.ace} % no satisfactorio.</div></div></div>
  <div class="in-card"><h3>E. Firmas</h3>
    <div class="in-pt"><p class="s" style="margin:0 0 4px"><b>Responsable de Medio Ambiente (inspector)</b></p>
      <label class="f">Nombres y apellidos</label><div style="font-size:15px;padding:2px 0">${esc(SES ? SES.nombre : "")}</div>
      <label class="f" for="in-ic">Cargo</label><input id="in-ic" class="in" autocomplete="off" maxlength="40" value="${esc(F.inspCargo)}">
      <label class="f">Firma</label>
      <canvas class="in-fp" data-in-fc="insp"></canvas><div class="in-fb"><span>Firme con el dedo</span><button type="button" class="btn sec sm" data-in-fl="insp">Borrar firma</button></div></div>
    <div class="in-pt"><p class="s" style="margin:0 0 4px"><b>Responsable del área inspeccionada</b></p>
      <label class="f" for="in-rn">Nombres y apellidos</label><input id="in-rn" class="in" autocomplete="off" maxlength="60" placeholder="Jefe, líder o encargado" value="${esc(F.respNombre)}">
      <label class="f" for="in-rc">Cargo</label><input id="in-rc" class="in" autocomplete="off" maxlength="40" value="${esc(F.respCargo)}">
      <label class="f">Firma</label>
      <canvas class="in-fp" data-in-fc="resp"></canvas><div class="in-fb"><span>El responsable firma aquí</span><button type="button" class="btn sec sm" data-in-fl="resp">Borrar firma</button></div></div>
    <div class="err" id="in-err">${esc(S.err)}</div>
    <div class="in-top"><button class="btn" data-in="enviar" ${S.enviando ? "disabled" : ""}>${S.enviando ? "Enviando…" : "Guardar inspección"}</button><button class="btn sec" data-in="salir">Guardar borrador y salir</button></div></div>`;
  box().innerHTML = secA + secB + secC + secD;
  iniciaFirmas();
}
function leeCampos(){
  const F = S.F; if(!F) return;
  const g = id => document.getElementById(id);
  if(g("in-area")) F.area = g("in-area").value;
  if(g("in-rn")) F.respNombre = g("in-rn").value;
  if(g("in-rc")) F.respCargo = g("in-rc").value;
  if(g("in-ic")) F.inspCargo = g("in-ic").value;
  box().querySelectorAll("[data-in-pn]").forEach(e => { F.puntos[+e.dataset.inPn].nombre = e.value; });
  box().querySelectorAll("[data-in-o]").forEach(e => { F.crit[+e.dataset.inO].obs = e.value; });
  box().querySelectorAll("[data-in-a]").forEach(e => { F.crit[+e.dataset.inA].accion = e.value; });
  box().querySelectorAll("[data-in-rs]").forEach(e => { F.crit[+e.dataset.inRs].resp = e.value; });
  box().querySelectorAll("[data-in-pz]").forEach(e => { F.crit[+e.dataset.inPz].plazo = e.value; });
}
function validaLocal(F){
  if(!F.area) return "Elija el área.";
  if(F.puntos.some(p => !p.nombre.trim())) return "Cada punto de segregación necesita un nombre.";
  for(let i = 0; i < F.puntos.length; i++){
    const f = COLS.filter(([k]) => !F.puntos[i].c[k])[0];
    if(f){ S.falta = `[data-in-c="${i}|${f[0]}"]`; return "Punto de segregación «" + F.puntos[i].nombre + "»: falta marcar " + f[1] + ". Marque C, NC o N/A en cada casilla."; }
  }
  for(let n = 2; n <= 17; n++) if(!F.crit[n].r){ S.falta = `[data-in-r^="${n}|"]`; return "Criterio " + n + ": falta marcar C, NC o N/A."; }
  for(let n = 1; n <= 17; n++){
    if(resultadoCrit(F, n) !== "NC") continue;
    const c = F.crit[n];
    if(c.obs.trim().length < 5){ S.falta = `[data-in-o="${n}"]`; return "Criterio " + n + ": describa lo observado (mínimo 5 letras)."; }
    if((c.accion || "").trim().length < 5){ S.falta = `[data-in-a="${n}"]`; return "Criterio " + n + ": escriba la acción correctiva (mínimo 5 letras)."; }
    if((c.resp || "").trim().length < 3){ S.falta = `[data-in-rs="${n}"]`; return "Criterio " + n + ": escriba el responsable de la acción."; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(c.plazo || "") || c.plazo < hoy() || c.plazo > masDias(hoy(), 365)){ S.falta = `[data-in-pz="${n}"]`; return "Criterio " + n + ": elija un plazo desde hoy y hasta 365 días."; }
    if(!c.fotos.length) return "Criterio " + n + ": agregue una foto con la observación marcada.";
  }
  if(F.respNombre.trim().length < 3) return "Escriba el nombre del responsable del área.";
  if(!F.firmaInsp) return "Falta la firma del inspector.";
  if(!F.firmaResp) return "Falta la firma del responsable del área.";
  return "";
}
async function enviar(){
  const F = S.F; if(!F || S.enviando) return; leeCampos();
  S.falta = ""; S.err = validaLocal(F);
  if(S.err){
    pintaForm();
    const el = S.falta && box().querySelector(S.falta);
    if(el){ el.scrollIntoView({block:"center", behavior:"smooth"}); const c = el.closest(".c, .in-crit"); if(c){ c.style.outline = "2px solid var(--red)"; c.style.borderRadius = "8px"; } }
    return;
  }
  if(!navigator.onLine){ S.err = "Sin señal. Su inspección está guardada como borrador: toque Guardar cuando tenga señal."; guardaBorrador(); return pintaForm(); }
  S.enviando = true; pintaForm();
  const criterios = []; for(let n = 1; n <= 17; n++){ const r = resultadoCrit(F, n), c = F.crit[n]; criterios.push(r === "NC" ? {n:n, r:r, obs:c.obs.trim(), accion:c.accion.trim(), responsable:c.resp.trim(), plazo:c.plazo, fotos:c.fotos} : {n:n, r:r}); }
  try{
    const j = await postJ({action:"inspeccion_guardar", id:F.id, area:F.area, respNombre:F.respNombre.trim(), respCargo:F.respCargo.trim(), inspectorCargo:F.inspCargo.trim(), firmaInsp:F.firmaInsp, firmaResp:F.firmaResp,
      puntos:F.puntos.map(p => ({nombre:p.nombre.trim(), c:p.c, obs:p.obs || ""})), criterios:criterios}, 120000);
    S.enviando = false;
    if(j && j.ok){ try{ localStorage.setItem("insp_cargo:" + (SES && SES.usuario), F.inspCargo.trim()); }catch(e){} borraBorrador(); S.F = null; S.vista = "lista"; S.lista = null; S.err = ""; toast("Inspección guardada" + (j.hallazgos && j.hallazgos.length ? " · " + j.hallazgos.length + " hallazgo(s) creados" : "")); pintaLista(); carga(); return; }
    S.err = (j && (j.error === "sesion" || j.error === "cambiar_clave")) ? "Su sesión venció. Ingrese de nuevo: lo escrito se conserva." : (j && j.error === "nc_invalida" && j.criterio ? "Criterio " + j.criterio + ": revise observación y foto." : ERR[j && j.error] || "No se pudo guardar. Intente de nuevo.");
  }catch(e){ S.enviando = false; S.err = "Sin señal o respuesta lenta. Su inspección sigue como borrador: intente de nuevo."; }
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

/* ---------- PDF / impresión: se arma al momento con lo guardado; no se guarda en el servidor ---------- */
const NOMB_COL = {noaprov:"NO APROV.", organico:"ORGÁNICO", papel:"PAPEL CARTÓN", plastico:"PLÁSTICO", vidrio:"VIDRIO", metal:"METAL", peligroso:"PELIGROSO", mermas:"MERMAS", rotulacion:"ROTULACIÓN", delimitacion:"DELIMITACIÓN"};
const CSS_PDF = `<style>
.fi{font:10.5px/1.2 Arial,Helvetica,sans-serif;color:#000;padding:8px;background:#fff}
.fi table{border-collapse:collapse;width:100%}.fi td,.fi th{border:1px solid #000;padding:2px 5px;vertical-align:middle}.fi{page-break-after:always}.fi:last-child{page-break-after:auto}
.fi th{background:#EFE1D4;font-weight:bold;text-align:center;font-size:10px}
.fi .t{font-size:15px;font-weight:bold;text-align:center}.fi .c{text-align:center}.fi .g{background:#f4ece3;font-weight:bold}
.fi .s{font-weight:bold;margin:6px 0 2px;font-size:11px}.fi .nc{background:#fde3df;font-weight:bold}
.fi .fm{height:60px;text-align:center}.fi .fm img{max-height:56px;max-width:100%}
</style>`;
const celda = (v, cls) => `<td class="c ${cls || ""}${v === "NC" ? " nc" : ""}">${esc(v || "")}</td>`;
function htmlFormato(i, f){
  const crit = {}; (i.criterios || []).forEach(c => crit[c.n] = c);
  const pts = (i.puntos || []).slice(); while(pts.length < 3) pts.push(null);
  const filasB = pts.map((p, k) => p ? `<tr><td class="c">${k + 1}</td><td>${esc(p.nombre)}</td>${COLS.map(([c]) => celda(p.c[c])).join("")}<td>${esc(p.obs || "")}</td></tr>` : `<tr><td class="c">${k + 1}</td><td></td>${COLS.map(() => "<td></td>").join("")}<td></td></tr>`).join("");
  const filasC = BLOQUES.map(([nom, ns]) => `<tr><td class="g" colspan="7">${esc(nom.toUpperCase())}</td></tr>` + ns.map(n => {
    const c = crit[n] || {r:"", obs:""};
    return `<tr><td class="c">${n}</td><td>${esc(CRIT[n])}</td>${celda(c.r)}<td>${esc(c.obs || "")}</td><td>${esc(c.accion || "")}</td><td>${esc(c.responsable || "")}</td><td class="c">${c.plazo ? esc(fecha(c.plazo)) : ""}</td></tr>`;
  }).join("")).join("");
  const cal = i.pct === "" || i.pct == null ? "—" : esc(i.pct) + " %";
  return CSS_PDF + `<div class="fi">
  <table><tr><td rowspan="3" style="width:90px" class="c"><b>${esc(CFG.PLANTA || "")}</b></td><td rowspan="3" class="t">INSPECCIÓN AMBIENTAL DE ÁREA DE TRABAJO</td><td>Código: <b>${esc(FORMATO.codigo)}</b></td></tr>
  <tr><td>Versión: <b>${esc(FORMATO.version)}</b></td></tr><tr><td>Fecha de aprobación: ${esc(FORMATO.aprobacion || "")}</td></tr></table>
  <div class="s">A. DATOS GENERALES</div>
  <table><tr><td><b>PLANTA:</b> ${esc(CFG.PLANTA || "")}</td><td><b>FECHA:</b> ${esc(fecha(i.fecha))}</td></tr><tr><td><b>ÁREA INSPECCIONADA:</b> ${esc(i.area)}</td><td><b>HORA:</b> ${esc(i.hora)}</td></tr></table>
  <div class="s">B. SEGREGACIÓN DE RESIDUOS POR PUNTO (NTP 900.058:2019) <span style="font-weight:normal">· C = Conforme | NC = No conforme | NA = No aplica</span></div>
  <table><tr><th>N°</th><th>PUNTO DE SEGREGACIÓN</th>${COLS.map(([c]) => `<th>${NOMB_COL[c]}</th>`).join("")}<th>OBSERVACIONES</th></tr>${filasB}</table>
  <div class="s">C. CRITERIOS DE INSPECCIÓN Y PLAN DE ACCIÓN</div>
  <table><tr><th>N°</th><th>CRITERIO</th><th>RESULTADO</th><th>OBSERVACIÓN / HALLAZGO</th><th>ACCIÓN CORRECTIVA</th><th>RESPONSABLE</th><th>PLAZO</th></tr>${filasC}</table>
  <div class="s">D. RESULTADO</div>
  <table><tr><td><b>% DE CONFORMIDAD:</b> ${cal}</td><td><b>CALIFICACIÓN:</b> ${esc(i.calificacion || "—")}</td></tr></table>
  <div class="s">E. FIRMAS</div>
  <table><tr><th>RESPONSABLE DE MEDIO AMBIENTE</th><th>RESPONSABLE DEL ÁREA INSPECCIONADA</th></tr>
  <tr><td>Nombres y apellidos: ${esc(i.inspectorNombre)}</td><td>Nombres y apellidos: ${esc(i.respNombre)}</td></tr>
  <tr><td>Cargo: ${esc(i.inspectorCargo || "")}</td><td>Cargo: ${esc(i.respCargo || "")}</td></tr>
  <tr><td class="fm">Firma: ${f && f.firmaInsp ? `<img src="${f.firmaInsp}" alt="">` : ""}</td><td class="fm">Firma: ${f && f.firmaResp ? `<img src="${f.firmaResp}" alt="">` : ""}</td></tr></table>
  <div class="s">F. RESPONSABLE DE LA CUSTODIA DEL REGISTRO</div>
  <table><tr><td>Nombres y apellidos:</td><td class="fm" rowspan="2">Firma:</td></tr><tr><td>Cargo:</td></tr></table></div>`;
}
const cargaJS2 = src => new Promise((ok, no) => { if(window.__jsI && window.__jsI[src]) return ok(); const e = document.createElement("script"); e.src = src; e.onload = () => { (window.__jsI = window.__jsI || {})[src] = 1; ok(); }; e.onerror = () => no(new Error("lib")); document.head.appendChild(e); });
const nombreArchivo = i => ("SGA.R.G.002 " + i.area + " " + fecha(i.fecha).replace(/\//g, "-") + " " + (CFG.PLANTA || "")).replace(/[\\/:*?"<>|]/g, "-");
async function firmasDe(i){
  if(S.firmas && S.firmas[i.id]) return S.firmas[i.id];
  const j = await postJ({action:"inspeccion_firmas", id:i.id});
  if(!(j && j.ok)) throw new Error("firmas");
  (S.firmas = S.firmas || {})[i.id] = {firmaInsp:j.firmaInsp, firmaResp:j.firmaResp};
  return S.firmas[i.id];
}
async function pdfInspeccion(i){
  const f = await firmasDe(i);
  await cargaJS2("lib/html2canvas.min.js"); await cargaJS2("lib/jspdf.umd.min.js");
  const w = document.createElement("div"); w.className = "insp-pdfw"; w.innerHTML = htmlFormato(i, f); document.body.appendChild(w);
  try{
    await Promise.all([...w.querySelectorAll("img")].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    const pdf = new window.jspdf.jsPDF({unit:"mm", format:"a4", orientation:"landscape"});
    const M = 8, W = 297 - 2 * M, Hp = 210 - 2 * M, hojas = [...w.querySelectorAll(".fi")];
    for(let k = 0; k < hojas.length; k++){
      const cv = await html2canvas(hojas[k], {scale:2, backgroundColor:"#fff", useCORS:true, logging:false});
      const r = Math.min(W / cv.width, Hp / cv.height);      // cada bloque entra completo en una hoja A4 horizontal
      if(k) pdf.addPage();
      pdf.addImage(cv.toDataURL("image/jpeg", .92), "JPEG", M, M, cv.width * r, cv.height * r);
    }
    return new File([pdf.output("blob")], nombreArchivo(i) + ".pdf", {type:"application/pdf"});
  } finally { w.remove(); }
}
async function compartirInsp(i, btn){
  const t0 = btn.textContent; btn.disabled = true; btn.textContent = "Preparando PDF…";
  try{
    const file = await pdfInspeccion(i);
    if(navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({files:[file], title:file.name, text:"Inspección ambiental " + i.area + " · " + fecha(i.fecha)}); }catch(e){}
    } else {
      const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("El PDF se guardó en Descargas.");
    }
  }catch(e){ toast("No se pudo crear el PDF. Revise su señal e intente de nuevo."); }
  btn.disabled = false; btn.textContent = t0;
}
async function imprimirInsp(i, btn){
  const t0 = btn.textContent; btn.disabled = true; btn.textContent = "Preparando…";
  try{
    const f = await firmasDe(i);
    const p = document.createElement("div"); p.className = "insp-printarea"; p.innerHTML = htmlFormato(i, f); document.body.appendChild(p);
    const tit = document.title; document.title = nombreArchivo(i);   // el navegador propone este nombre al guardar como PDF
    const fin = () => { p.remove(); document.title = tit; window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin); window.print(); setTimeout(fin, 60000);
  }catch(e){ toast("No se pudo preparar la impresión. Revise su señal e intente de nuevo."); }
  btn.disabled = false; btn.textContent = t0;
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
  const fl = t.closest("[data-in-fl]"); if(fl && F){ if(fl.dataset.inFl === "insp") F.firmaInsp = ""; else F.firmaResp = ""; guardaBorrador(); pintaForm(); return; }
  const k = t.closest("[data-in]"); if(!k) return; const a = k.dataset.in;
  if(a === "pdf" || a === "imprimir"){ const i = (S.lista || []).find(x => x.id === S.sel); if(i) (a === "pdf" ? compartirInsp : imprimirInsp)(i, k); return; }
  if(a === "nueva"){ S.F = nuevoForm(); S.vista = "form"; S.err = ""; guardaBorrador(); pintaForm(); cargaAreas(); }
  else if(a === "seguir"){ S.F = leeBorrador(); S.vista = "form"; S.err = ""; pintaForm(); cargaAreas(); }
  else if(a === "descartar"){ if(confirm("¿Descartar la inspección sin terminar?")){ borraBorrador(); pintaLista(); } }
  else if(a === "lista"){ S.vista = "lista"; repinta(); }
  else if(a === "punto" && F){ leeCampos(); F.puntos.push(nuevoPunto(F.puntos.length + 1)); guardaBorrador(); pintaForm(); }
  else if(a === "salir" && F){ leeCampos(); guardaBorrador(); S.F = null; S.vista = "lista"; pintaLista(); }
  else if(a === "enviar") enviar();
});
document.addEventListener("change", async ev => {
  const t = ev.target, F = S.F; if(!F || TAB !== "insp") return;
  if(t.id === "in-area"){ F.area = t.value; guardaBorrador(); return; }
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
