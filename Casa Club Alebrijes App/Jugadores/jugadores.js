document.addEventListener("DOMContentLoaded", () => {
  /* -----------------------------
     DOM refs
  ----------------------------- */
  const contenedor      = document.getElementById("jugadoresGrid");
  const buscador        = document.getElementById("buscadorJugadores");
  const filtroCat       = document.getElementById("filtroCategoria");
  const countEl         = document.getElementById("jugadoresCount");

  // Modal
  const modal           = document.getElementById("jugadorModal");
  const modalFoto       = document.getElementById("jugadorModalFoto");
  const modalTitulo     = document.getElementById("jugadorModalTitulo");
  const modalDatos      = document.getElementById("jugadorModalDatos");
  const modalArchivero  = document.getElementById("jugadorModalArchivero");
  const modalDias       = document.getElementById("diasEnClub");

  // Pagos
  const formPago        = document.getElementById("formRegistrarPago");
  const pagoJugadorId   = document.getElementById("pagoJugadorId");
  const pagoFecha       = document.getElementById("pagoFecha");
  const pagosLista      = document.getElementById("jugadorPagosLista");

  // Tabs
  const tabBtns         = document.querySelectorAll(".tab-btn");
  const tabContents     = document.querySelectorAll(".jugador-tab-content");

  const btnDarBaja      = document.getElementById("btnDarBaja"); // <-- botón de baja

  let conceptoSelect    = null;  // Select dinámico
  let conceptoCustomInp = null;  // Input para "Otro"

  /* -----------------------------
     Configuración
  ----------------------------- */
  const CONCEPTOS_PAGO = ["Registro", "Mensualidad", "Uniformes", "Otro"];

  const CATS = [
    "Sub-14",
    "Sub-16",
    "Sub-18",
    "TDP Alebrijes",
    "Soles Teotihuacán"
  ];

  /* -----------------------------
     Cargar jugadores de localStorage
  ----------------------------- */
  let jugadores = JSON.parse(localStorage.getItem("jugadores")) || [];

  // Asegurar IDs
  let addedIds = false;
  jugadores = jugadores.map(j => {
    if (!j.id) {
      j.id = genId();
      addedIds = true;
    }
    return j;
  });

  // Normalizar categoría vieja
  let changedCat = false;
  jugadores = jugadores.map(j => {
    if (j.categoria === "Milenarios Teotihuacán") {
      j.categoria = "Soles Teotihuacán";
      changedCat = true;
    }
    return j;
  });

  if (addedIds || changedCat) {
    localStorage.setItem("jugadores", JSON.stringify(jugadores));
  }

  /* -----------------------------
     Inicializar filtros + render
  ----------------------------- */
  llenarFiltroCategorias(filtroCat, CATS);
  renderJugadores(jugadores, contenedor, countEl);

  /* -----------------------------
     Eventos de búsqueda / filtro
  ----------------------------- */
  buscador.addEventListener("input", aplicarFiltros);
  filtroCat.addEventListener("change", aplicarFiltros);

  function aplicarFiltros() {
    const texto = sanitize(buscador.value);
    const catSel = filtroCat.value;
    const filtrados = jugadores.filter(j => {
      const full = `${j.nombres || ""} ${j.apellido_paterno || ""} ${j.apellido_materno || ""}`;
      const matchNombre = sanitize(full).includes(texto);
      const matchCat    = !catSel || j.categoria === catSel;
      return matchNombre && matchCat;
    });
    renderJugadores(filtrados, contenedor, countEl, jugadores.length);
  }

  /* -----------------------------
     Click en tarjeta -> abrir modal
  ----------------------------- */
  contenedor.addEventListener("click", (e) => {
    const card = e.target.closest(".jugador-card");
    if (!card) return;
    const id = card.dataset.id;
    const jugador = jugadores.find(j => j.id === id);
    if (jugador) openJugadorModal(jugador);
  });

  /* -----------------------------
     Abrir modal Jugador
  ----------------------------- */
  function openJugadorModal(j) {
    const fullName = fullJugadorName(j);
    modalFoto.src   = j.imagen || "https://via.placeholder.com/140";
    modalFoto.alt   = fullName;
    modalTitulo.textContent = fullName || "Sin nombre";

    // Días en club
    modalDias.textContent = calcDiasEnClub(j.fecha_registro) + " días";

    // Rellenar Datos
    modalDatos.innerHTML = "";
    const fields = mapJugadorFields(j);
    fields.forEach(({label, value}) => {
      if (value === undefined || value === null || value === "") return;
      const div = document.createElement("div");
      div.className = "jugador-modal-dato";
      div.innerHTML = `<strong>${label}:</strong> ${escapeHtml(String(value))}`;
      modalDatos.appendChild(div);
    });

    // Archivero
    renderArchivero(j, fullName);

    // Pagos
    pagoJugadorId.value = j.id;
    pagoFecha.value = todayISO();
    renderPagos(j.id);

    // Botón de Dar Baja
    if (btnDarBaja) {
      btnDarBaja.onclick = () => darDeBajaJugador(j.id);
    }

    // Tab inicial: datos
    setActiveTab("datos");

    showModal();
  }

  /* -----------------------------
     Función de Dar de Baja
  ----------------------------- */
  function darDeBajaJugador(jugadorId) {
    const jugador = jugadores.find(j => j.id === jugadorId);
    if (!jugador) return;

    const confirmar = confirm(`¿Estás seguro de dar de baja a ${fullJugadorName(jugador)}?`);
    if (!confirmar) return;

    // Sacar del array principal
    jugadores = jugadores.filter(j => j.id !== jugadorId);
    localStorage.setItem("jugadores", JSON.stringify(jugadores));

    // Agregar a bajas
    let bajas = JSON.parse(localStorage.getItem("bajas")) || [];
    bajas.push(jugador);
    localStorage.setItem("bajas", JSON.stringify(bajas));

    alert(`${fullJugadorName(jugador)} ha sido movido a la sección de Bajas.`);

    // Refrescar listado
    renderJugadores(jugadores, contenedor, countEl);

    // Cerrar modal
    closeModal();
  }

  /* -----------------------------
     Archivero (preview + descarga)
  ----------------------------- */
  function renderArchivero(jugador, fullName) {
    modalArchivero.innerHTML = "";
    const archivos = normalizeArchivero(jugador.archivero);
    if (!archivos.length) {
      modalArchivero.innerHTML = "<p>No hay archivos cargados.</p>";
      return;
    }
    const list = document.createElement("div");
    list.className = "archivero-list";

    archivos.forEach((file, idx) => {
      const row = document.createElement("div");
      row.className = "archivero-item";

      const label = document.createElement("span");
      label.textContent = file.name || `Archivo ${idx+1}`;

      const btnVer = document.createElement("button");
      btnVer.type = "button";
      btnVer.textContent = "Ver";
      btnVer.className = "archivero-btn ver";
      btnVer.addEventListener("click", () => window.open(file.url, "_blank", "noopener"));

      const btnDesc = document.createElement("a");
      btnDesc.textContent = "Descargar";
      btnDesc.className = "archivero-btn descargar";
      btnDesc.href = file.url;
      btnDesc.download = (slugify(fullName || "jugador") + "_" + (file.name || "archivo")).replace(/\s+/g,"_");

      row.appendChild(label);
      row.appendChild(btnVer);
      row.appendChild(btnDesc);
      list.appendChild(row);
    });

    modalArchivero.appendChild(list);
  }

  /* -----------------------------
     Mostrar y cerrar modal
  ----------------------------- */
  function showModal() {
    modal.classList.add("show");
    modal.classList.remove("closing");
    requestAnimationFrame(() => modal.classList.add("open-anim"));
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector(".jugador-modal-close").focus();
  }

  function closeModal() {
    modal.classList.add("closing");
    modal.classList.remove("open-anim");
    modal.setAttribute("aria-hidden", "true");
    setTimeout(() => modal.classList.remove("show", "closing"), 300);
  }

  modal.addEventListener("click", (e) => {
    if (e.target.dataset.close === "true" || e.target.closest("[data-close='true']")) {
      closeModal();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      closeModal();
    }
  });

  /* -----------------------------
     Tabs
  ----------------------------- */
  tabBtns.forEach(btn => btn.addEventListener("click", () => setActiveTab(btn.dataset.tab)));

  function setActiveTab(tabName) {
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
    tabContents.forEach(c => c.classList.toggle("active", c.id === `tab-${tabName}`));
  }

  /* -----------------------------
     Campo Concepto (select + Otro)
  ----------------------------- */
  if (formPago) {
    const conceptoField = formPago.querySelector("select[name='concepto']");
    if (conceptoField) {
      conceptoSelect = conceptoField;
      conceptoCustomInp = document.createElement("input");
      conceptoCustomInp.type = "text";
      conceptoCustomInp.placeholder = "Especificar concepto...";
      conceptoCustomInp.className = "pago-concepto-custom";
      conceptoCustomInp.style.display = "none";
      conceptoField.parentNode.appendChild(conceptoCustomInp);

      conceptoSelect.addEventListener("change", () => {
        conceptoCustomInp.style.display = (conceptoSelect.value === "Otro") ? "" : "none";
        if (conceptoSelect.value !== "Otro") conceptoCustomInp.value = "";
      });
    }
  }

  /* -----------------------------
     Registrar pago
  ----------------------------- */
  if (formPago) {
    formPago.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(formPago);
      const jugadorId = pagoJugadorId.value;
      const concepto = (fd.get("concepto") === "Otro" && conceptoCustomInp?.value)
        ? conceptoCustomInp.value.trim()
        : fd.get("concepto");
      const monto = parseFloat(fd.get("monto") || "0");
      const fecha = fd.get("fecha") || todayISO();

      if (!concepto || monto <= 0) {
        alert("Completa todos los campos de pago correctamente.");
        return;
      }

      // Guardar en LocalStorage
      let pagos = JSON.parse(localStorage.getItem(`pagos_${jugadorId}`)) || [];
      pagos.push({ fecha, concepto, monto });
      localStorage.setItem(`pagos_${jugadorId}`, JSON.stringify(pagos));

      formPago.reset();
      pagoJugadorId.value = jugadorId;
      pagoFecha.value = todayISO();
      renderPagos(jugadorId);
      alert("Pago registrado con éxito ✅");
    });
  }

  function renderPagos(jugadorId) {
    let pagos = JSON.parse(localStorage.getItem(`pagos_${jugadorId}`)) || [];
    pagosLista.innerHTML = "";

    if (pagos.length === 0) {
      pagosLista.innerHTML = `<tr><td colspan="3" class="no-pagos">No hay pagos registrados.</td></tr>`;
      return;
    }

    pagos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    pagos.forEach((pago) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(pago.fecha)}</td>
        <td>${escapeHtml(pago.concepto)}</td>
        <td>${formatCurrency(pago.monto)}</td>
      `;
      pagosLista.appendChild(row);
    });
  }
}); // DOMContentLoaded

/* =========================================================
   Helpers globales
========================================================= */
// (Todos tus helpers: fullJugadorName, sanitize, renderJugadores, etc.)

/* =========================================================
   Helpers globales
========================================================= */
function fullJugadorName(j) {
  return [j.nombres, j.apellido_paterno, j.apellido_materno]
    .filter(Boolean)
    .join(" ");
}

function normalizeArchivero(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(normalizeSingleFile).filter(Boolean);
  if (typeof raw === "object" && raw.url) return [normalizeSingleFile(raw)];
  if (typeof raw === "string")
    return [normalizeSingleFile({ name: guessFileNameFromUrl(raw), url: raw })];
  return [];
}

function normalizeSingleFile(obj) {
  if (!obj) return null;
  let url = obj.url || obj.data || obj.src || obj;
  if (!url || typeof url !== "string") return null;
  let name = obj.name || guessFileNameFromUrl(url) || "archivo";
  return { name, url };
}

function guessFileNameFromUrl(u) {
  if (!u) return "";
  if (u.startsWith("data:")) {
    const m = u.match(/^data:([^;]+)/);
    const ext = mimeToExt(m ? m[1] : "");
    return `archivo.${ext || "dat"}`;
  }
  try {
    const parts = u.split("/");
    return parts[parts.length - 1] || "archivo";
  } catch {
    return "archivo";
  }
}

function mimeToExt(mime) {
  if (!mime) return "";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("image/jpeg")) return "jpg";
  if (mime.includes("image/png")) return "png";
  if (mime.includes("image/")) return "img";
  return "";
}

function genId() {
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function sanitize(str = "") {
  return str
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function llenarFiltroCategorias(selectEl, cats) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Todas las categorías";
  selectEl.appendChild(optAll);
  cats.forEach((c) => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    selectEl.appendChild(o);
  });
}

function renderJugadores(lista, contenedor, countEl, total = null) {
  if (!contenedor) return;
  contenedor.innerHTML = "";
  if (lista.length === 0) {
    contenedor.innerHTML = "<p>No hay jugadores que coincidan.</p>";
  } else {
    lista.forEach((jugador) => {
      const fullName = fullJugadorName(jugador);
      const card = document.createElement("div");
      card.className = "jugador-card";
      card.dataset.id = jugador.id;
      card.innerHTML = `
        <img src="${jugador.imagen || "https://via.placeholder.com/96"}" alt="${escapeHtml(fullName)}">
        <h4>${escapeHtml(fullName)}</h4>
      `;
      contenedor.appendChild(card);
    });
  }
  if (countEl) {
    const totalPlayers = total ?? lista.length;
    countEl.textContent = `Mostrando ${lista.length} de ${totalPlayers}.`;
  }
}

function mapJugadorFields(j) {
  return [
    { label: "Fecha de registro", value: j.fecha_registro },
    { label: "Apellido Paterno", value: j.apellido_paterno },
    { label: "Apellido Materno", value: j.apellido_materno },
    { label: "Nombres", value: j.nombres },
    { label: "Lugar de nacimiento", value: j.lugar_nacimiento },
    { label: "Fecha de nacimiento", value: j.fecha_nacimiento },
    { label: "Edad (años)", value: j.edad_anios },
    { label: "Edad (meses)", value: j.edad_meses },
    { label: "Dirección de origen", value: j.direccion_origen },
    { label: "Dirección Tutor", value: j.direccion_tutor },
    { label: "Posición", value: j.posicion },
    { label: "Lesiones", value: j.lesiones },
    { label: "Tipo de sangre", value: j.sangre },
    { label: "Certificado / Seguro", value: j.certificado },
    { label: "Celular", value: j.celular_jugador },
    { label: "Alergias", value: j.alergias },
    { label: "Enfermedad crónica", value: j.cronica },
    { label: "Última fecha de pago", value: j.fecha_pago },
    { label: "Categoría", value: j.categoria },
    { label: "Tutor Ap. Paterno", value: j.papa_apellido_paterno },
    { label: "Tutor Ap. Materno", value: j.papa_apellido_materno },
    { label: "Tutor Nombre(s)", value: j.papa_nombres },
    { label: "Tutor Dirección", value: j.papa_direccion },
    { label: "Tutor Tel. Casa", value: j.papa_tel_casa },
    { label: "Tutor Tel. Celular", value: j.papa_tel_cel },
  ];
}

function calcDiasEnClub(fechaStr) {
  if (!fechaStr) return "—";
  const f = new Date(fechaStr);
  if (isNaN(f)) return "—";
  return Math.max(0, Math.floor((new Date() - f) / 86400000));
}

function formatCurrency(num) {
  if (isNaN(num)) return "$0.00";
  return (
    "$" +
    Number(num).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function slugify(str = "") {
  return (
    str
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "archivo"
  );
}

function escapeHtml(str = "") {
  return str
    .toString()
    .replace(/[&<>"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}