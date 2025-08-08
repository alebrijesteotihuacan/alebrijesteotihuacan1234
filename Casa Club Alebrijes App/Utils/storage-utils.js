/* =========================================================
   STORAGE UTILS - Funciones compartidas
========================================================= */

/* ----------------- LocalStorage: Jugadores ----------------- */
export function loadJugadoresLS() {
  return JSON.parse(localStorage.getItem("jugadores")) || [];
}
export function saveJugadoresLS(arr) {
  localStorage.setItem("jugadores", JSON.stringify(arr));
}

/* ----------------- LocalStorage: Bajas ----------------- */
export function loadBajasLS() {
  return JSON.parse(localStorage.getItem("bajas")) || [];
}
export function saveBajasLS(arr) {
  localStorage.setItem("bajas", JSON.stringify(arr));
}

/* ----------------- Mover Jugador a Bajas ----------------- */
export function moverJugadorABajas(jugadorId, fechaBajaStr = todayISO()) {
  const jugadores = loadJugadoresLS();
  const idx = jugadores.findIndex(j => j.id === jugadorId);
  if (idx === -1) return false;
  const jugador = jugadores[idx];
  jugador.baja_fecha = fechaBajaStr;

  // quitar de activos
  jugadores.splice(idx, 1);
  saveJugadoresLS(jugadores);

  // agregar a bajas
  const bajas = loadBajasLS();
  bajas.push(jugador);
  saveBajasLS(bajas);
  return true;
}

/* ----------------- PAGOS ----------------- */
export function loadPagosJugador(jugadorId) {
  return JSON.parse(localStorage.getItem(`pagos_${jugadorId}`)) || [];
}
export function savePagosJugador(jugadorId, pagos) {
  localStorage.setItem(`pagos_${jugadorId}`, JSON.stringify(pagos));
}
export function deletePagosJugador(jugadorId) {
  localStorage.removeItem(`pagos_${jugadorId}`);
}

/* ----------------- Utils Generales ----------------- */
export function genId() {
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function fullJugadorName(j) {
  return [j.nombres, j.apellido_paterno, j.apellido_materno]
    .filter(Boolean)
    .join(" ")
    .trim() || "Jugador";
}

export function escapeHtml(str = "") {
  return str.toString().replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[s]));
}

export function sanitize(str = "") {
  return str.toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function ensureIds(arr) {
  let changed = false;
  arr = arr.map(j => {
    if (!j.id) { j.id = genId(); changed = true; }
    return j;
  });
  return arr;
}

export function buildCategoryList(arr) {
  const set = new Set();
  arr.forEach(j => { if (j.categoria) set.add(j.categoria); });
  return Array.from(set).sort();
}

export function llenarFiltroCategorias(selectEl, cats) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Todas las categorías";
  selectEl.appendChild(optAll);
  cats.forEach(c => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    selectEl.appendChild(o);
  });
}