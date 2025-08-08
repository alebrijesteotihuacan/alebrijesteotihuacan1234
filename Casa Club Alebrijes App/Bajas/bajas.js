document.addEventListener("DOMContentLoaded", () => {
  /* ---------- DOM ---------- */
  const gridEl        = document.getElementById("bajasGrid");
  const countEl       = document.getElementById("bajasCount");
  const buscadorEl    = document.getElementById("buscadorBajas");
  const filtroCatEl   = document.getElementById("filtroCategoriaBajas");

  // Delete modal
  const delModal      = document.getElementById("bajaDeleteModal");
  const delInput      = document.getElementById("bajaDelConfirmInput");
  const delBtn        = document.getElementById("bajaDelConfirmBtn");

  let bajas = ensureIds(loadBajasLS());         // jugadores dados de baja
  let jugadoresActivos = ensureIds(loadJugadoresLS()); // activos (para restaurar)
  const CATS = buildCategoryList(bajas);        // categorías dinámicas

  // Render filtro
  llenarFiltroCategorias(filtroCatEl, CATS);

  // Primera carga
  renderBajas(bajas, gridEl, countEl);

  /* ---------- Eventos búsqueda / filtro ---------- */
  buscadorEl.addEventListener("input", aplicarFiltros);
  filtroCatEl.addEventListener("change", aplicarFiltros);

  function aplicarFiltros() {
    const texto = sanitize(buscadorEl.value);
    const selCat = filtroCatEl.value;
    const list = bajas.filter(j => {
      const full = fullJugadorName(j);
      const matchNombre = sanitize(full).includes(texto);
      const matchCat = !selCat || j.categoria === selCat;
      return matchNombre && matchCat;
    });
    renderBajas(list, gridEl, countEl, bajas.length);
  }

  /* ---------- Delegación: acciones en tarjetas ---------- */
  gridEl.addEventListener("click", (e) => {
    const card = e.target.closest(".baja-card");
    if (!card) return;
    const id = card.dataset.id;

    if (e.target.classList.contains("btn-restaurar")) {
      restaurarJugador(id);
    } else if (e.target.classList.contains("btn-eliminar")) {
      abrirDeleteModal(id);
    }
  });

  /* ---------- Modal eliminar definitivo ---------- */
  let pendingDeleteId = null;

  function abrirDeleteModal(jugadorId) {
    pendingDeleteId = jugadorId;
    delInput.value = "";
    delBtn.disabled = true;
    delModal.classList.add("show");
    delModal.setAttribute("aria-hidden", "false");
    delInput.focus();
  }

  function cerrarDeleteModal() {
    delModal.classList.remove("show");
    delModal.setAttribute("aria-hidden", "true");
    pendingDeleteId = null;
  }

  // Habilitar botón cuando se escribe BORRAR
  delInput.addEventListener("input", () => {
    delBtn.disabled = (delInput.value.trim().toUpperCase() !== "BORRAR");
  });

  // Confirm
  delBtn.addEventListener("click", () => {
    if (pendingDeleteId && delInput.value.trim().toUpperCase() === "BORRAR") {
      eliminarDefinitivo(pendingDeleteId);
      cerrarDeleteModal();
    }
  });

  // Cerrar por backdrop / cancelar / X
  delModal.addEventListener("click", (e) => {
    if (
      e.target.dataset.close === "true" ||
      e.target.classList.contains("baja-del-backdrop") ||
      e.target.classList.contains("baja-del-close")
    ) {
      cerrarDeleteModal();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && delModal.classList.contains("show")) {
      cerrarDeleteModal();
    }
  });

  /* ---------- Restaurar ---------- */
  function restaurarJugador(id) {
    const idx = bajas.findIndex(j => j.id === id);
    if (idx === -1) return;
    const jugador = bajas[idx];

    // quitar de bajas
    bajas.splice(idx, 1);
    saveBajasLS(bajas);

    // quitar duplicado en activos si existiera
    jugadoresActivos = loadJugadoresLS().filter(j => j.id !== id);
    jugadoresActivos.push(jugador);
    saveJugadoresLS(jugadoresActivos);

    // refrescar UI
    aplicarFiltros();
    alert("Jugador restaurado ✅");
  }

  /* ---------- Eliminación definitiva ---------- */
  function eliminarDefinitivo(id) {
    const idx = bajas.findIndex(j => j.id === id);
    if (idx === -1) return;
    const jugador = bajas[idx];

    // Quitar de bajas
    bajas.splice(idx, 1);
    saveBajasLS(bajas);

    // Borrar pagos globales legacy
    const legacy = JSON.parse(localStorage.getItem("pagos") || "[]");
    const legacyFiltered = legacy.filter(p => p.jugador_id !== id);
    localStorage.setItem("pagos", JSON.stringify(legacyFiltered));

    // Borrar pagos por jugador
    localStorage.removeItem(`pagos_${id}`);

    // (Archivero y demás datos quedan destruidos al remover registro en bajas)
    // Por seguridad, podemos nuke un key archivero_<id> si existiera en el futuro:
    // localStorage.removeItem(`archivero_${id}`);

    // UI
    aplicarFiltros();
    alert(`Jugador eliminado definitivamente: ${fullJugadorName(jugador)}.`);
  }
});

/* =========================================================
   FUNCIONES DE DATOS LOCALSTORAGE
========================================================= */
function loadJugadoresLS() {
  return JSON.parse(localStorage.getItem("jugadores")) || [];
}
function saveJugadoresLS(arr) {
  localStorage.setItem("jugadores", JSON.stringify(arr));
}
function loadBajasLS() {
  return JSON.parse(localStorage.getItem("bajas")) || [];
}
function saveBajasLS(arr) {
  localStorage.setItem("bajas", JSON.stringify(arr));
}

/* Mover jugador a bajas (puedes llamar desde Jugadores) */
function moverJugadorABajas(jugadorId, fechaBajaStr = todayISO()) {
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

/* =========================================================
   RENDER BAJAS
========================================================= */
function renderBajas(lista, contenedor, countEl, total = null) {
  if (!contenedor) return;
  contenedor.innerHTML = "";

  if (!lista.length) {
    contenedor.innerHTML = `<p class="bajas-empty">No hay jugadores en la papelera.</p>`;
  } else {
    lista.forEach(j => {
      const fullName = fullJugadorName(j);
      const foto     = j.imagen || "https://via.placeholder.com/96";
      const fecha    = j.baja_fecha || "—";
      const card = document.createElement("div");
      card.className = "baja-card";
      card.dataset.id = j.id;
      card.innerHTML = `
        <img src="${foto}" alt="${escapeHtml(fullName)}">
        <h4>${escapeHtml(fullName)}</h4>
        <div class="baja-fecha">Baja: ${escapeHtml(fecha)}</div>
        <div class="baja-card-actions">
          <button type="button" class="btn-restaurar">Restaurar</button>
          <button type="button" class="btn-eliminar">Eliminar</button>
        </div>
      `;
      contenedor.appendChild(card);
    });
  }

  if (countEl) {
    const totalPlayers = total ?? lista.length;
    countEl.textContent = `Mostrando ${lista.length} de ${totalPlayers} en papelera.`;
  }
}

/* =========================================================
   UTILIDADES
========================================================= */
function buildCategoryList(arr) {
  const set = new Set();
  arr.forEach(j => { if (j.categoria) set.add(j.categoria); });
  return Array.from(set).sort();
}
function llenarFiltroCategorias(selectEl, cats) {
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
function fullJugadorName(j) {
  return [j.nombres, j.apellido_paterno, j.apellido_materno].filter(Boolean).join(" ").trim() || "Jugador";
}
function ensureIds(arr) {
  let changed = false;
  arr = arr.map(j => {
    if (!j.id) { j.id = genId(); changed = true; }
    return j;
  });
  if (changed) {
    // El llamador decide guardar; aquí no guardamos porque no sabemos si viene de jugadores o bajas.
  }
  return arr;
}
function sanitize(str="") {
  return str.toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
function genId() {
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function escapeHtml(str="") {
  return str.toString().replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
