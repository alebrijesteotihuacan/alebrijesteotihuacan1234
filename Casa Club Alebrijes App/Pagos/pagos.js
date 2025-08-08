/* Pagos Page */
document.addEventListener("DOMContentLoaded", () => {
  // ---- DOM ----
  const desdeInput = document.getElementById("filtroDesde");
  const hastaInput = document.getElementById("filtroHasta");
  const btnAplicar = document.getElementById("btnAplicar");
  const btnLimpiar = document.getElementById("btnLimpiar");

  const kpiTotalEl = document.getElementById("kpiTotalRecaudado");
  const kpiNumEl   = document.getElementById("kpiNumPagos");
  const kpiPromEl  = document.getElementById("kpiPromedio");

  const tablaBody  = document.getElementById("pagosTablaBody");
  const chartCtx   = document.getElementById("pagosChart").getContext("2d");

  let chartRef = null;
  let rangeInitialized = false; // para auto‑setear fechas sólo 1 vez

  // Render inicial
  renderAll();

  // Eventos
  btnAplicar.addEventListener("click", renderAll);
  btnLimpiar.addEventListener("click", () => {
    desdeInput.value = "";
    hastaInput.value = "";
    rangeInitialized = false; // re‑auto detect
    renderAll();
  });

  // (Opcional) aplicar automáticamente al cambiar fecha
  desdeInput.addEventListener("change", renderAll);
  hastaInput.addEventListener("change", renderAll);

  /* ---------------------------------
     Render principal
  --------------------------------- */
  function renderAll() {
    // Lee datos frescos SIEMPRE (para reflejar nuevos pagos sin recargar)
    const jugadores = getJugadoresLS();
    const pagosAll  = getAllPagosNormalized(); // ya ordenados asc

    // Inicializar rango si inputs están vacíos y hay pagos
    if (!rangeInitialized && pagosAll.length) {
      const minMax = getMinMaxFechas(pagosAll);
      if (!desdeInput.value) desdeInput.value = minMax.min;
      if (!hastaInput.value) hastaInput.value = minMax.max;
      rangeInitialized = true;
    }

    const d1 = parseDate(desdeInput.value);
    const d2 = parseDate(hastaInput.value);
    const pagosFiltrados = filterByDateRange(pagosAll, d1, d2);

    // KPIs
    const total = pagosFiltrados.reduce((s,p)=>s+p.monto,0);
    const num   = pagosFiltrados.length;
    const prom  = num ? total/num : 0;
    kpiTotalEl.textContent = formatCurrency(total);
    kpiNumEl.textContent   = num.toString();
    kpiPromEl.textContent  = formatCurrency(prom);

    // Tabla
    renderTablaPagos(pagosFiltrados, jugadores, tablaBody);

    // Chart
    const {labels, acumulados} = buildAcumuladosDataset(pagosFiltrados);
    if (chartRef) chartRef.destroy();
    chartRef = new Chart(chartCtx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Pagos acumulados",
          data: acumulados,
          fill: false,
          borderColor: "#f26522",
          backgroundColor: "#f26522",
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            ticks: { autoSkip: true, maxTicksLimit: 10 }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: v => Number(v).toLocaleString("es-MX")
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => " " + formatCurrency(ctx.parsed.y)
            }
          },
          legend: { display: false }
        }
      }
    });
  }
}); // DOMContentLoaded


/* =========================================================
   DATA ACCESS
========================================================= */
function getJugadoresLS() {
  return JSON.parse(localStorage.getItem("jugadores")) || [];
}

/* Devuelve arreglo normalizado de pagos:
   [{jugador_id, fecha:'YYYY-MM-DD', monto:Number, concepto:String}]
   Recolecta:
   - Array global legacy en localStorage.pagos
   - Pagos por jugador en claves pagos_<id>
*/
function getAllPagosNormalized() {
  const out = [];

  // Global legacy
  const legacy = JSON.parse(localStorage.getItem("pagos") || "[]");
  if (Array.isArray(legacy)) {
    legacy.forEach(p => {
      out.push({
        jugador_id: p.jugador_id || null,
        fecha: normalizeFecha(p.fecha) || guessFechaFromCreated(p.creado),
        monto: num(p.monto),
        concepto: p.concepto || "Pago"
      });
    });
  }

  // Por jugador
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith("pagos_")) continue;
    const jugadorId = key.slice(6);
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(arr)) continue;
    arr.forEach(p => {
      out.push({
        jugador_id: jugadorId,
        fecha: normalizeFecha(p.fecha) || guessFechaFromCreated(p.creado),
        monto: num(p.monto),
        concepto: p.concepto || "Pago"
      });
    });
  }

  // Filtrar pagos sin fecha válida
  const filtered = out.filter(p => !!parseDate(p.fecha));
  // Orden asc para cálculo acumulado
  filtered.sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  return filtered;
}


/* =========================================================
   RENDER TABLA
========================================================= */
function renderTablaPagos(pagos, jugadores, tbody) {
  tbody.innerHTML = "";
  if (!pagos.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="no-pagos">No hay pagos.</td></tr>`;
    return;
  }

  // index jugadores
  const jmap = {};
  jugadores.forEach(j => { jmap[j.id] = j; });

  // más recientes arriba
  pagos.slice().sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).forEach(p => {
    const j = jmap[p.jugador_id];
    const nombre = j ? fullJugadorNameShort(j) : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.fecha)}</td>
      <td>${escapeHtml(nombre)}</td>
      <td>${escapeHtml(p.concepto)}</td>
      <td>${formatCurrency(p.monto)}</td>
    `;
    tbody.appendChild(tr);
  });
}


/* =========================================================
   DATASET ACUMULADO PARA GRÁFICA
========================================================= */
function buildAcumuladosDataset(pagos) {
  if (!pagos.length) return {labels: [], acumulados: []};

  // Agrupar por fecha (ya normalizada YYYY-MM-DD)
  const map = Object.create(null);
  pagos.forEach(p => {
    map[p.fecha] = (map[p.fecha] || 0) + p.monto;
  });

  const fechas = Object.keys(map).sort((a,b)=>new Date(a)-new Date(b));
  const labels = [];
  const acumulados = [];
  let running = 0;
  fechas.forEach(f => {
    running += map[f];
    labels.push(f);
    acumulados.push(running);
  });
  return {labels, acumulados};
}


/* =========================================================
   UTILIDADES
========================================================= */
function fullJugadorNameShort(j) {
  return [j.nombres, j.apellido_paterno].filter(Boolean).join(" ").trim() || "Jugador";
}
function normalizeFecha(f) {
  if (!f) return null;
  // si viene con tiempo
  if (/^\d{4}-\d{2}-\d{2}/.test(f)) return f.slice(0,10);
  const d = new Date(f);
  return isNaN(d) ? null : toISODate(d);
}
function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function toISODate(d) {
  return d.toISOString().slice(0,10);
}
function filterByDateRange(arr, d1, d2) {
  if (!d1 && !d2) return arr.slice();
  return arr.filter(p => {
    const dp = parseDate(p.fecha);
    if (!dp) return false;
    if (d1 && dp < d1) return false;
    if (d2 && dp > d2) return false;
    return true;
  });
}
function getMinMaxFechas(pagos) {
  let min = null, max = null;
  pagos.forEach(p => {
    const d = parseDate(p.fecha);
    if (!d) return;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  });
  return {
    min: min ? toISODate(min) : "",
    max: max ? toISODate(max) : ""
  };
}
function num(n) {
  const x = parseFloat(n);
  return isNaN(x) ? 0 : x;
}
function guessFechaFromCreated(created) {
  if (!created) return null;
  const d = new Date(created);
  return isNaN(d) ? null : toISODate(d);
}
function formatCurrency(v) {
  return "$" + Number(v || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function escapeHtml(str="") {
  return str.toString().replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}