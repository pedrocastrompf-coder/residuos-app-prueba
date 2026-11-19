/* Importar un formato desde Word (.docx) o Excel (.xlsx) para armar la estructura base (lista de verificación).
   El archivo se lee en el teléfono o la PC: no se envía a ningún servidor. Lo que se reconoce queda como borrador para afinarlo en el editor.
   Reconoce: código, título y versión del encabezado; tabla de puntos (columnas cortas bajo un encabezado con «punto»);
   criterios (filas bajo un encabezado con «criterio», o con columnas C / NC); grupos (filas de un solo texto en mayúsculas); títulos de firmas.
   window.IMPORTAR.leer(file) → Promise<{codigo, titulo, version, def, resumen:[...], avisos:[...]}> */
(function(root){
"use strict";

const NS = (el, tag) => Array.from(el.getElementsByTagNameNS("*", tag));
const limpia = s => String(s == null ? "" : s).replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
const mayus = s => { const l = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, ""); return l.length >= 3 && l === l.toUpperCase(); };
// «INSPECCIÓN AMBIENTAL» → «Inspección ambiental» (solo si venía todo en mayúsculas; respeta códigos y siglas cortas como NTP, FDS)
function oracion(s){
  s = limpia(s).replace(/\n/g, " ");
  if(!mayus(s)) return s;
  const r = s.toLowerCase().replace(/\b(ntp|fds|epp|raee|iperc|sst|sga|iso|msds|pcb|glp|n°|ph)\b/g, m => m.toUpperCase())
    .replace(/\(([a-záéíóúñ]{2,8})\)/g, (m, x) => "(" + x.toUpperCase() + ")");   // siglas entre paréntesis
  return r.charAt(0).toUpperCase() + r.slice(1);
}
const recorta = (s, n) => s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
const sinNumero = s => s.replace(/^\s*(\d{1,2}(\.\d{1,2})?|[a-z])\s*[.)\-–:]+\s*/i, "");

/* ---------- lectura: el archivo se convierte en filas [{c:columna, t:texto}] ---------- */
const colNum = ref => { const m = /^([A-Z]+)/.exec(ref); let n = 0; for(const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const rowNum = ref => parseInt(/(\d+)$/.exec(ref)[1], 10);
async function filasXlsx(zip, P){
  const xml = async p => { const f = zip.file(p); return f ? new P().parseFromString(await f.async("string"), "application/xml") : null; };
  const wb = await xml("xl/workbook.xml"), rels = await xml("xl/_rels/workbook.xml.rels");
  const hojas = NS(wb, "sheet").filter(h => h.getAttribute("state") !== "hidden");
  if(!hojas.length) throw new Error("El Excel no tiene hojas visibles.");
  const rid = hojas[0].getAttribute("r:id") || hojas[0].getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const rel = NS(rels, "Relationship").filter(r => r.getAttribute("Id") === rid)[0];
  let ruta = rel ? rel.getAttribute("Target") : "worksheets/sheet1.xml"; ruta = ruta.replace(/^\/?xl\//, "").replace(/^\//, "");
  const ss = await xml("xl/sharedStrings.xml"), S = ss ? NS(ss, "si").map(si => NS(si, "t").map(t => t.textContent).join("")) : [];
  const hoja = await xml("xl/" + ruta); if(!hoja) throw new Error("No se pudo leer la hoja del Excel.");
  const F = {};
  NS(hoja, "c").forEach(c => {
    const r = c.getAttribute("r"), t = c.getAttribute("t"), v = NS(c, "v")[0];
    let tx = "";
    if(t === "s" && v) tx = S[+v.textContent] || "";
    else if(t === "inlineStr") tx = NS(c, "t").map(x => x.textContent).join("");
    else if(t === "e") tx = "";                                // errores (#VALUE!, logos con fórmula)
    else if(v) tx = v.textContent;
    tx = limpia(tx); if(!tx) return;
    (F[rowNum(r)] = F[rowNum(r)] || []).push({c:colNum(r), t:tx});
  });
  return {hoja:hojas[0].getAttribute("name"), filas:Object.keys(F).map(Number).sort((a, b) => a - b).map(k => F[k].sort((a, b) => a.c - b.c))};
}
async function filasDocx(zip, P){
  const f = zip.file("word/document.xml"); if(!f) throw new Error("El Word no tiene contenido legible.");
  const doc = new P().parseFromString(await f.async("string"), "application/xml");
  const body = NS(doc, "body")[0], filas = [];
  const texto = el => NS(el, "p").map(p => NS(p, "t").map(t => t.textContent).join("")).join("\n");
  const local = el => el.localName || String(el.nodeName).replace(/^.*:/, "");
  const hijos = el => Array.from(el.childNodes).filter(n => n.nodeType === 1);
  (function recorre(el){
    hijos(el).forEach(n => {
      const ln = local(n);
      if(ln === "p"){ const t = limpia(NS(n, "t").map(x => x.textContent).join("")); if(t) filas.push([{c:0, t:t}]); }
      else if(ln === "tbl"){
        hijos(n).filter(x => local(x) === "tr").forEach(tr => {
          let c = 0; const fila = [];
          hijos(tr).filter(x => local(x) === "tc").forEach(tc => {
            const pr = hijos(tc).filter(x => local(x) === "tcPr")[0], gs = pr && NS(pr, "gridSpan")[0], vm = pr && NS(pr, "vMerge")[0];
            const span = gs ? parseInt(gs.getAttribute("w:val") || gs.getAttribute("val") || "1", 10) : 1;
            const cont = vm && !(vm.getAttribute("w:val") || vm.getAttribute("val"));   // celda que continúa una combinada vertical
            const t = cont ? "" : limpia(texto(tc));
            if(t) fila.push({c:c, t:t});
            c += span;
          });
          if(fila.length) filas.push(fila);
        });
        filas.push([]);                                        // separa tablas
      }
      else if(ln === "sdt" || ln === "sdtContent") recorre(n);
    });
  })(body);
  return {hoja:"", filas:filas};
}

/* ---------- análisis: de filas a formato ---------- */
const RE_CODIGO = /\b[A-Z]{2,6}(?:[.\-][A-Z0-9]{1,6}){2,4}\b/;
const RE_ETIQ = /^(c[oó]digo|versi[oó]n|fecha|p[aá]gina|revisi[oó]n|aprobad|elaborad|revisad|planta|[aá]rea|proceso|hora|responsable|lugar|sede)\b/i;
const CORTAS = /^(c|nc|na|n\/a|n\.a\.?|si|sí|no|cumple|no cumple|conforme|no conforme|x|cant\.?|cantidad|buena|mala|bueno|malo|ok|n°|nº|no\.|item|ítem|#)$/i;
const RE_CRIT = /criterio|requisito|aspecto|verificaci[oó]n|a verificar|a evaluar|a inspeccionar|pregunta|[ií]tems?\b|descripci[oó]n|actividad a|condici[oó]n/i;
// columnas de respuesta: C / NC, SI / NO o CUMPLE / NO CUMPLE (todas se registran en la app como C / NC / NA)
const RESP_SI = /^(c|s[ií]|cumple|conforme|ok)$/i, RESP_NO = /^(nc|no|no cumple|no conforme)$/i;
const esResp = f => f.some(x => RESP_SI.test(x.t)) && f.some(x => RESP_NO.test(x.t));
const RE_FIN = /^(responsable|firma|nombres?( y apellidos)?|cargo|observaci[oó]n(es)?( generales| adicionales)?\s*:|observaciones generales|conclusi|comentarios|leyenda|custodia|elaborado|revisado|aprobado|v[°º]\s*b)/i;
const RE_PUNTO = /punto|contenedor|estaci[oó]n/i;
const COLORES = [[/no\s*aprovech/i, "#1f1f1f"], [/org[aá]nic/i, "#8b5a2b"], [/papel|cart[oó]n/i, "#1f5fbf"], [/pl[aá]stic/i, "#ffffff"], [/vidrio/i, "#2e8b3d"], [/metal/i, "#f2c200"], [/peligros/i, "#d32f2f"]];
const TIPO_HZ = [[/envase|contenci[oó]n|bandeja/i, "Almacenamiento y acopio"], [/^orden|orden y limpieza|limpieza de/i, "Orden y limpieza"], [/derram|kit|fuga de (aceite|qu[ií]mic)/i, "Derrames y fugas"], [/peligros|qu[ií]mic|fds|hoja de seguridad|insumo/i, "Almacenamiento y acopio"],
  [/segrega|c[oó]digo de colores|bolsa|rotul|merma|envoltur/i, "Segregación de residuos"], [/contenedor|acopio|almac|capacidad|sobrellen/i, "Almacenamiento y acopio"],
  [/efluente|desag[uü]e|trampa|vertimiento|\bcip\b/i, "Efluentes y desagües"], [/agua|energ[ií]a|vapor|aire comprimido|flujo|luz|equipos? apagad/i, "Uso de agua y energía"],
  [/orden|limpieza|plaga/i, "Orden y limpieza"]];
const tipoHz = t => { for(const [r, h] of TIPO_HZ) if(r.test(t)) return h; return "Otro"; };

function analizar(filas){
  const avisos = [], todas = [].concat(...filas);
  // encabezado: código, versión, título
  let codigo = "", version = "", titulo = "";
  for(let i = 0; i < todas.length && !codigo; i++){ const m = RE_CODIGO.exec(todas[i].t); if(m && !/@|https?:/.test(todas[i].t)) codigo = m[0]; }
  filas.slice(0, 15).forEach(f => f.forEach((x, k) => {
    if(!version && /^versi[oó]n\b/i.test(x.t)){
      const m = /(\d{1,3})\s*$/.exec(x.t) || (f[k + 1] && /^\s*(\d{1,3})(\.0+)?\s*$/.exec(f[k + 1].t));
      if(m) version = ("0" + parseInt(m[1], 10)).slice(-2);
    }
  }));
  const candT = [].concat(...filas.slice(0, 12).map((f, i) => f.map(x => Object.assign({i:i}, x)))).filter(x => x.t.length >= 8 && x.t.length <= 90 && !RE_ETIQ.test(x.t) && !/:\s*$/.test(x.t) && !RE_CODIGO.test(x.t) && !/^\d/.test(x.t));
  candT.sort((a, b) => ((a.i > 3) - (b.i > 3)) || (mayus(b.t) - mayus(a.t)) || (b.t.length - a.t.length));   // primero el bloque del encabezado
  if(candT.length) titulo = oracion(candT[0].t);

  // encabezado de criterios: celda con «criterio…», o fila con C y NC
  let iCrit = -1, cCrit = -1;
  for(let i = 0; i < filas.length && iCrit < 0; i++){
    const f = filas[i], h = f.filter(x => RE_CRIT.test(x.t) && x.t.length <= 160)[0];
    const cnc = esResp(f);
    if(h && (cnc || /criterio|requisito|aspecto|a verificar|a evaluar/i.test(h.t))){ iCrit = i; cCrit = h.c; }
    else if(cnc && i > 0 && f.filter(x => !CORTAS.test(x.t)).length >= 1 && !filas.slice(i + 1, i + 3).some(g => g.every(x => CORTAS.test(x.t) || /^\d+$/.test(x.t)))){ iCrit = i; cCrit = (f.filter(x => !CORTAS.test(x.t))[0] || {c:0}).c; }
  }

  // tabla de puntos: encabezado con «punto» antes de los criterios; columnas = textos cortos de esa fila y las 2 siguientes
  let puntos = null;
  const lim = iCrit >= 0 ? iCrit : filas.length;
  for(let i = 0; i < lim && !puntos; i++){
    if(!filas[i].some(x => RE_PUNTO.test(x.t) && x.t.length <= 60)) continue;
    const cel = [].concat(...filas.slice(i, Math.min(i + 3, lim))).filter(x => x.t.length >= 3 && x.t.length <= 30 && !CORTAS.test(x.t) && !RE_PUNTO.test(x.t) && !/observ/i.test(x.t) && !/^\d+$/.test(x.t));
    const vistos = {}, cols = [];
    cel.sort((a, b) => a.c - b.c).forEach(x => { const t = oracion(x.t), k = t.toLowerCase(); if(!vistos[k]){ vistos[k] = 1; cols.push(t); } });
    if(cols.length >= 2){
      puntos = {titulo:"Puntos de verificación", nota:"C = Conforme | NC = No conforme | NA = No aplica", max:8,
        columnas:cols.slice(0, 14).map((t, j) => { const col = COLORES.filter(([r]) => r.test(t))[0]; return {k:"c" + (j + 1) + Math.random().toString(36).slice(2, 6), t:t.slice(0, 30), color:col ? col[1] : ""}; })};
      const tp = filas[i].concat(filas[i + 1] || []).filter(x => /segregaci|residuo/i.test(x.t))[0];
      if(tp) puntos.titulo = recorta(oracion(tp.t.replace(/seg[uú]n.*$/i, "").trim() || tp.t), 60);
      const ntp = todas.filter(x => /ntp\s*\d/i.test(x.t))[0]; if(ntp){ const m = /NTP\s*[\d.:]+/i.exec(ntp.t); if(m) puntos.nota = m[0].toUpperCase() + " · " + puntos.nota; }
      if(cols.length > 14) avisos.push("La tabla de puntos tenía más de 14 columnas: se tomaron las 14 primeras.");
    }
  }

  // criterios y grupos
  const grupos = []; let g = null, n = 0;
  const filasCrit = iCrit >= 0 ? filas.slice(iCrit + 1) : [];
  for(const f of filasCrit){
    if(!f.length){ if(n) break; else continue; }             // fin de la tabla (Word)
    const txt = f.filter(x => !CORTAS.test(x.t) && !/^\d+([.,]\d+)?$/.test(x.t) && x.t.length >= 2);
    if(!txt.length) continue;
    const princ = txt.filter(x => cCrit < 0 || x.c >= cCrit - 1).sort((a, b) => b.t.length - a.t.length)[0] || txt[0];
    const t0 = sinNumero(princ.t.replace(/\n/g, " "));
    if(RE_FIN.test(t0) || /^[A-H][.)]\s/.test(princ.t)) { if(n) break; else continue; }
    if(/^\*/.test(t0)) continue;                               // notas al pie («*Según reglamento…»)
    const numerado = /^\s*\d/.test(princ.t) || f.some(x => x.c < princ.c && /^\d{1,3}$/.test(x.t));
    if(/^otros?\s*(\(.*\))?\s*:?\s*$/i.test(t0) && (numerado || /:\s*$/.test(t0))) continue;     // fila «Otro:» se omite
    const esGrupo = txt.length === 1 && mayus(t0) && t0.length <= 90 && !numerado && !/[.:;]$/.test(t0);
    if(esGrupo){ g = {nombre:recorta(oracion(t0.replace(/\*+$/, "").trim()), 50), items:[]}; grupos.push(g); continue; }
    if(t0.length < 3) continue;
    if(!g){ g = {nombre:"Criterios de inspección", items:[]}; grupos.push(g); }
    const t = recorta(oracion(t0.replace(/\s*\*+$/, "")), 200);
    if(t0.length > 200) avisos.push("El criterio «" + t.slice(0, 40) + "…» era muy largo y se recortó.");
    g.items.push({t:t, h:tipoHz(t0), auto:""}); n++;
  }
  const G = grupos.filter(x => x.items.length).slice(0, 8);
  if(!G.length){ avisos.push("No se encontraron criterios: se dejó uno de ejemplo para completar en el editor."); G.push({nombre:"Criterios de inspección", items:[{t:"Escriba aquí el primer criterio", h:"Otro", auto:""}]}); }
  G.forEach(x => { if(x.items.length > 20){ avisos.push("El grupo «" + x.nombre + "» tenía más de 20 criterios: se tomaron los 20 primeros."); x.items = x.items.slice(0, 20); } });

  // firmas: dos celdas «responsable…» en una misma fila (que no sea la de custodia)
  let firmas = {insp:"Responsable de la inspección", resp:"Responsable del área inspeccionada"};
  for(const f of filas){
    const r = f.filter(x => /^responsable|^inspector|^v[°º]\s*b/i.test(x.t) && !/custodia/i.test(x.t));
    if(r.length >= 2){ firmas = {insp:recorta(oracion(r[0].t.split("\n")[0]), 60), resp:recorta(oracion(r[1].t.split("\n")[0]), 60)}; break; }
  }
  if(firmas.insp === "Responsable de la inspección" && firmas.resp === "Responsable del área inspeccionada"){
    const et = todas.filter(x => /^responsable\b.{3,60}:\s*$/i.test(x.t) && !/custodia/i.test(x.t)).map(x => recorta(oracion(x.t.replace(/:\s*$/, "")), 60));
    if(et.length >= 2) firmas = {insp:et[0], resp:et[1]};
  }
  // datos generales que la app todavía no tiene como campos propios
  const fijos = /^(planta|[aá]rea( inspeccionada)?|fecha|hora|responsable\b)/i;
  const extra = filas.slice(0, iCrit >= 0 ? iCrit : 12).map(f => f.filter(x => /:\s*$/.test(x.t) && x.t.length <= 50 && !RE_ETIQ.test(x.t.replace(/^(planta|[aá]rea|hora|responsable)\b.*/i, "c[oó]digo")) && !fijos.test(x.t)).map(x => x.t.replace(/:\s*$/, ""))).reduce((a, b) => a.concat(b), [])
    .filter(t => !/^(c[oó]digo|versi[oó]n|fecha de aprobaci[oó]n)$/i.test(t));
  if(extra.length) avisos.push("Datos generales del archivo que aún no se pueden agregar como campos: " + extra.join(", ") + ". Llegan en el paso 2 (campos configurables).");
  if(iCrit >= 0 && filas[iCrit].some(x => /^s[ií]$/i.test(x.t))) avisos.push("Las respuestas SI / NO / NA del archivo se registran en la app como C / NC / NA.");
  // resultado
  const resultado = todas.some(x => /%\s*de\s*(conformidad|cumplimiento)|calificaci[oó]n/i.test(x.t)) || iCrit >= 0
    ? {modo:"porcentaje", cortes:{sat:90, ace:70}} : {modo:"texto", titulo:"Resultados de la inspección"};
  if(todas.some(x => /custodia/i.test(x.t))) avisos.push("Se omitió la sección de custodia del registro: en la app no se firma.");

  titulo = titulo || "Formato importado";
  const def = {titulo:recorta(titulo, 80), puntos:puntos, criterios:{grupos:G}, resultado:resultado, firmas:firmas};
  const nCrit = G.reduce((s, x) => s + x.items.length, 0);
  const resumen = [nCrit + " criterio(s) en " + G.length + " grupo(s)"];
  if(puntos) resumen.push("tabla de puntos con " + puntos.columnas.length + " columnas");
  resumen.push("resultado: " + (resultado.modo === "texto" ? "texto" : "% de cumplimiento"));
  return {codigo:codigo, titulo:def.titulo, version:version, def:def, resumen:resumen, avisos:avisos};
}

async function leer(file, JSZipImpl, DOMParserImpl){
  const Z = JSZipImpl || root.JSZip, P = DOMParserImpl || root.DOMParser;
  const nombre = String(file.name || "").toLowerCase();
  if(/\.(xls|doc)$/.test(nombre)) throw new Error("Ese archivo es de una versión antigua de Office. Ábralo y guárdelo como .xlsx o .docx.");
  if(!/\.(xlsx|docx)$/.test(nombre)) throw new Error("Elija un archivo de Word (.docx) o Excel (.xlsx).");
  const zip = await Z.loadAsync(file.arrayBuffer ? await file.arrayBuffer() : file.data);
  const L = /\.xlsx$/.test(nombre) ? await filasXlsx(zip, P) : await filasDocx(zip, P);
  return analizar(L.filas);
}

const api = {leer:leer, analizar:analizar, oracion:oracion};
if(typeof module !== "undefined") module.exports = api; else root.IMPORTAR = api;
})(typeof window !== "undefined" ? window : globalThis);
