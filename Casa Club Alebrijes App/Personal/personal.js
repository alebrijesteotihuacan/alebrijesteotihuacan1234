// personal.js
document.addEventListener('DOMContentLoaded', () => {
  // DOM refs
  const contenedor     = document.getElementById('personalGrid');
  const buscador       = document.getElementById('buscadorPersonal');
  const filtroCargo    = document.getElementById('filtroCargo');
  const countEl        = document.getElementById('personalCount');

  // Detail modal
  const modal          = document.getElementById('personalModal');
  const backdrop       = modal.querySelector('.jugador-modal-backdrop');
  const closeBtn       = modal.querySelector('.jugador-modal-close');
  const modalFoto      = document.getElementById('personalModalFoto');
  const modalTitulo    = document.getElementById('personalModalTitulo');
  const modalDatos     = document.getElementById('personalModalDatos');
  const modalArch      = document.getElementById('personalModalArchivero');
  const diasBadge      = document.getElementById('diasPersonalClub');
  const btnDarBaja     = document.getElementById('btnDarBajaPersonal');

  // Payment form inside detail modal
  const formPago       = document.getElementById('formRegistrarPagoPersonal');
  const pagoIdField    = document.getElementById('pagoPersonalId');
  const pagoFechaField = document.getElementById('pagoFechaPersonal');
  const pagosLista     = document.getElementById('personalPagosLista');

  // Tabs
  const tabBtns        = modal.querySelectorAll('.tab-btn');
  const tabContents    = modal.querySelectorAll('.jugador-tab-content');

  // New-person modal
  const btnAlta        = document.getElementById('btnAbrirAltaPersonal');
  const modalAlta      = document.getElementById('modalAltaPersonal');
  const btnCerrarAlta  = document.getElementById('cerrarAltaPersonal');
  const formAlta       = document.getElementById('formAltaPersonal');

  // Concepto custom input
  let conceptoSelect, conceptoInput;

  // Load array
  let personal = JSON.parse(localStorage.getItem('personal')) || [];

  // Ensure IDs
  if (personal.some(p=>!p.id)) {
    personal = personal.map(p => ({ ...p, id: p.id||genId() }));
    localStorage.setItem('personal', JSON.stringify(personal));
  }

  // Initial render + filter options
  renderPersonal(personal);
  populateFiltro();

  // Search & filter events
  buscador.addEventListener('input', applyFilters);
  filtroCargo.addEventListener('change', applyFilters);

  function applyFilters() {
    const term = buscador.value.trim().toLowerCase();
    const cat  = filtroCargo.value;
    const filtered = personal.filter(p => {
      const name = getFullName(p).toLowerCase();
      const matchName = name.includes(term);
      const matchCat  = !cat || p.cargo === cat;
      return matchName && matchCat;
    });
    renderPersonal(filtered, personal.length);
  }

  // Card click
  contenedor.addEventListener('click', e => {
    const card = e.target.closest('.jugador-card');
    if (!card) return;
    const id = card.dataset.id;
    const p  = personal.find(x=>x.id===id);
    if (p) openDetail(p);
  });

  // Open detail modal
  function openDetail(p) {
    const full = getFullName(p);
    modalFoto.src = p.imagen || 'https://via.placeholder.com/140';
    modalFoto.alt = full;
    modalTitulo.textContent = full;
    diasBadge.textContent = '';

    modalDatos.innerHTML = '';
    const campos = [
      { label: "Fecha de Registro", value: p.fechaRegistro },
      { label: "Apellido Paterno", value: p.apellidoPaterno || p.apellido_paterno },
      { label: "Apellido Materno", value: p.apellidoMaterno || p.apellido_materno },
      { label: "Nombres", value: p.nombres },
      { label: "Lugar de Nacimiento", value: p.lugarNacimiento || p.lugar_nacimiento },
      { label: "Fecha de Nacimiento", value: p.fechaNacimiento || p.fecha_nacimiento },
      { label: "Edad al ingresar", value: (p.edadAnos || 0) + " años " + (p.edadMeses || 0) + " meses" },
      { label: "Dirección", value: p.direccion },
      { label: "Fecha de Pago", value: p.fechaPago },
      { label: "Sueldo", value: p.sueldo ? formatCurrency(p.sueldo) : '' },
      { label: "Cargo", value: p.cargo }
    ];

    campos.forEach(c => {
      if (c.value) {
        const div = document.createElement('div');
        div.innerHTML = `<strong>${c.label}:</strong> ${escapeHtml(c.value)}`;
        modalDatos.appendChild(div);
      }
    });

    renderArchivero(p);
    pagoIdField.value    = p.id;
    pagoFechaField.value = todayISO();
    renderPayments(p.id);

    btnDarBaja.onclick = () => darDeBaja(p.id);
    setTab('datos');

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  // Close detail modal
  function closeDetail() {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }
  backdrop.addEventListener('click', closeDetail);
  closeBtn.addEventListener('click', closeDetail);
  document.addEventListener('keydown', e => e.key==='Escape' && closeDetail());

  // Dar de baja
  function darDeBaja(id) {
    const p = personal.find(x=>x.id===id);
    if (!p || !confirm(`¿Dar de baja a ${getFullName(p)}?`)) return;
    personal = personal.filter(x=>x.id!==id);
    localStorage.setItem('personal', JSON.stringify(personal));
    const bajas = JSON.parse(localStorage.getItem('bajasPersonal'))||[];
    bajas.push(p);
    localStorage.setItem('bajasPersonal', JSON.stringify(bajas));
    renderPersonal(personal);
    closeDetail();
  }

  // Tabs
  tabBtns.forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  function setTab(tab) {
    tabBtns.forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
    tabContents.forEach(c=>c.classList.toggle('active', c.id===`tab-${tab}`));
  }

  // Initialize payment form
  if (formPago) {
    conceptoSelect = formPago.querySelector("select[name='concepto']");
    conceptoInput  = document.createElement('input');
    conceptoInput.type = 'text';
    conceptoInput.placeholder = 'Especificar concepto...';
    conceptoInput.className = 'pago-concepto-custom';
    conceptoInput.style.display = 'none';
    conceptoSelect.after(conceptoInput);
    conceptoSelect.addEventListener('change', () => {
      conceptoInput.style.display = conceptoSelect.value==='Otro'?'block':'none';
    });

    formPago.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(formPago);
      let concepto = fd.get('concepto');
      if (concepto==='Otro' && conceptoInput.value) concepto = conceptoInput.value;
      const monto = parseFloat(fd.get('monto'))||0;
      const fecha= fd.get('fecha')||todayISO();
      if (!concepto|| monto<=0) return alert('Completa campos de pago');
      const key = `pagosPersonal_${pagoIdField.value}`;
      const pagos = JSON.parse(localStorage.getItem(key))||[];
      pagos.push({ fecha, concepto, monto });
      localStorage.setItem(key, JSON.stringify(pagos));
      formPago.reset();
      pagoFechaField.value = todayISO();
      renderPayments(pagoIdField.value);
    });
  }

  // Render helpers
  function renderPayments(id) {
    const key = `pagosPersonal_${id}`;
    const pagos = JSON.parse(localStorage.getItem(key))||[];
    pagosLista.innerHTML = '';
    if (!pagos.length) {
      pagosLista.innerHTML = '<tr><td colspan="3" class="no-pagos">No hay pagos registrados.</td></tr>';
      return;
    }
    pagos.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    pagos.forEach(p=> {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(p.fecha)}</td>
                      <td>${escapeHtml(p.concepto)}</td>
                      <td>${formatCurrency(p.monto)}</td>`;
      pagosLista.appendChild(tr);
    });
  }

  function renderArchivero(p) {
    modalArch.innerHTML = '';
    const files = normalizeArchivero(p.archivero);
    if (!files.length) {
      modalArch.innerHTML = '<p>No hay archivos cargados.</p>';
      return;
    }
    files.forEach(f => {
      const row = document.createElement('div');
      row.className = 'archivero-item';
      const span = document.createElement('span');
      span.textContent = f.name;
      const btnV = document.createElement('button');
      btnV.textContent = 'Ver'; btnV.onclick = ()=>window.open(f.url,'_blank');
      const btnD = document.createElement('a');
      btnD.textContent = 'Descargar'; btnD.href = f.url; btnD.download = f.name;
      row.append(span, btnV, btnD);
      modalArch.appendChild(row);
    });
  }

  function renderPersonal(list, total=list.length) {
    contenedor.innerHTML = '';
    if (!list.length) {
      contenedor.innerHTML = '<p>No hay personal registrado.</p>';
    } else {
      list.forEach(p => {
        const card = document.createElement('div');
        card.className = 'jugador-card';
        card.dataset.id = p.id;
        card.dataset.cargo = p.cargo || "";
        card.innerHTML = `
          <img src="${p.imagen||'https://via.placeholder.com/96'}" alt="${escapeHtml(getFullName(p))}">
          <h4>${escapeHtml(getFullName(p))}</h4>
          <p>${escapeHtml(p.cargo||'')}</p>
        `;
        contenedor.appendChild(card);
      });
    }
    countEl.textContent = `Mostrando ${list.length} de ${total}.`;
  }

  function populateFiltro() {
    const cargos = [...new Set(personal.map(p=>p.cargo))].filter(Boolean);
    filtroCargo.innerHTML = '<option value="">Todos los cargos</option>'
      + cargos.map(c=>`<option value="${c}">${c}</option>`).join('');
  }

  // -------------------
  // Abrir/Cerrar modal de alta
  // -------------------
  btnAlta.addEventListener('click', () => {
    modalAlta.classList.add('visible');
    document.body.style.overflow = 'hidden';
  });

  btnCerrarAlta.addEventListener('click', () => {
    modalAlta.classList.remove('visible');
    document.body.style.overflow = '';
  });

  // Guardado de nuevo personal
  formAlta.addEventListener('submit', e => {
    e.preventDefault();
    // Captura todos los datos del formulario, para que no falte ninguno
    const fd = new FormData(formAlta);
    let nuevo = {};
    fd.forEach((value,key) => {
      if (key !== 'foto') nuevo[key] = value;
    });

    const file = formAlta.foto.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        nuevo.imagen = reader.result;
        savePersonal(nuevo);
      };
      reader.readAsDataURL(file);
    } else {
      nuevo.imagen = '';
      savePersonal(nuevo);
    }
  });

  function savePersonal(nuevo) {
    let arr = JSON.parse(localStorage.getItem('personal'))||[];
    nuevo.id = genId();
    arr.push(nuevo);
    localStorage.setItem('personal', JSON.stringify(arr));
    personal = arr;
    modalAlta.classList.remove('visible');
    formAlta.reset();
    document.body.style.overflow = '';
    renderPersonal(personal);
    populateFiltro();
  }
});

// Helpers globales
function getFullName(p) {
  return [p.nombres, p.apellidoPaterno||p.apellido_paterno, p.apellidoMaterno||p.apellido_materno]
    .filter(Boolean).join(' ');
}
function normalizeArchivero(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.url) return [raw];
  if (typeof raw === 'string') return [{ name: raw.split('/').pop(), url: raw }];
  return [];
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatCurrency(n) {
  return '$'+Number(n).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function genId() {
  return 'id_'+Math.random().toString(36).substr(2,9);
}
