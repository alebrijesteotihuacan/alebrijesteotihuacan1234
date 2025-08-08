// inventario.js - versión corregida (compresión de imagen + manejo de QuotaExceeded)
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    try {
      // DOM refs (pueden ser null — comprobamos antes de usarlos)
      const grid = document.getElementById('inventarioGrid');
      const buscador = document.getElementById('buscadorInventario');
      const countEl = document.getElementById('inventarioCount');

      const modalAlta = document.getElementById('modalAltaInventario');
      const formAlta = document.getElementById('formAltaInventario');
      const cerrarAltaBtn = document.getElementById('cerrarAltaInventario');

      const tieneCostoField = document.getElementById('tieneCostoField');
      const montoWrap = document.getElementById('montoWrap');
      const montoField = document.getElementById('montoField');

      const modalDetail = document.getElementById('inventarioModal');
      const modalBackdrop = modalDetail ? modalDetail.querySelector('.jugador-modal-backdrop') : null;
      const modalCloseBtn = modalDetail ? modalDetail.querySelector('.jugador-modal-close') : null;
      const modalFoto = document.getElementById('inventarioModalFoto');
      const modalTitulo = document.getElementById('inventarioModalTitulo');
      const modalDatos = document.getElementById('inventarioModalDatos');
      const btnDarBaja = document.getElementById('btnDarBajaInventario');

      // LocalStorage key
      const STORAGE_KEY = 'inventario';

      // Data
      let inventario = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

      // Helper utilities
      const genId = () => 'id_' + Math.random().toString(36).substring(2, 9);
      const todayISO = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      };
      const escapeHtml = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
      const formatCurrency = n => (n===null||n===undefined)?'':'$'+Number(n).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
      const truncate = (s,n) => s.length>n ? s.slice(0,n-1)+'…' : s;

      // ---------- NUEVAS FUNCIONES: compresión y detección de Quota ----------
      function isQuotaExceeded(e) {
        if (!e) return false;
        return e && (e.code === 22 || e.code === 1014 || e.name === 'QuotaExceededError' || /quota/i.test(e.message));
      }

      /**
       * Comprime un DataURL de imagen reduciendo tamaño y calidad.
       * dataUrl -> callback(compressedDataUrl) on success, onError on failure.
       */
      function compressDataUrl(dataUrl, maxW = 1024, maxH = 1024, quality = 0.75, callback, onError) {
        try {
          const img = new Image();
          img.onload = () => {
            try {
              const w = img.width;
              const h = img.height;
              const ratio = Math.min(1, maxW / w, maxH / h);
              const cw = Math.max(1, Math.round(w * ratio));
              const ch = Math.max(1, Math.round(h * ratio));
              const canvas = document.createElement('canvas');
              canvas.width = cw;
              canvas.height = ch;
              const ctx = canvas.getContext('2d');
              // draw image to canvas scaled
              ctx.drawImage(img, 0, 0, cw, ch);
              // convert to JPEG to reduce size; JPEG ignores transparency but suele reducir mucho el peso
              const compressed = canvas.toDataURL('image/jpeg', quality);
              callback(compressed);
            } catch (errDraw) {
              console.warn('compressDataUrl: error durante el procesamiento de canvas', errDraw);
              onError && onError(errDraw);
            }
          };
          img.onerror = (err) => {
            console.warn('compressDataUrl: error cargando la imagen', err);
            onError && onError(err);
          };
          img.src = dataUrl;
        } catch (err) {
          console.warn('compressDataUrl: excepción', err);
          onError && onError(err);
        }
      }

      // --- UI actions (delegated) ---
      function openAltaModal() {
        if (!modalAlta) return console.warn('modalAlta no encontrado');
        if (formAlta) formAlta.reset();
        if (montoWrap) { montoWrap.style.display = 'none'; montoField && (montoField.required = false); }
        modalAlta.classList.add('visible');
        modalAlta.setAttribute('aria-hidden','false');
        document.body.style.overflow = 'hidden';
      }
      function closeAltaModal() {
        if (!modalAlta) return;
        modalAlta.classList.remove('visible');
        modalAlta.setAttribute('aria-hidden','true');
        document.body.style.overflow = '';
      }

      function openDetail(item) {
        if (!modalDetail) return console.warn('modalDetail no encontrado');
        modalFoto && (modalFoto.src = item.foto || 'https://via.placeholder.com/140');
        modalFoto && (modalFoto.alt = escapeHtml(item.nombre));
        modalTitulo && (modalTitulo.textContent = item.nombre || 'Ítem');
        if (modalDatos) {
          modalDatos.innerHTML = '';
          addFieldToModal('Cantidad', item.cantidad);
          addFieldToModal('Información', item.informacion);
          if (item.tieneCosto) addFieldToModal('Costo', formatCurrency(item.monto));
          addFieldToModal('Fecha agregado', item.creado);
        }
        if (btnDarBaja) btnDarBaja.onclick = () => darDeBaja(item.id);
        modalDetail.classList.add('show');
        modalDetail.setAttribute('aria-hidden','false');
      }
      function closeDetail() {
        if (!modalDetail) return;
        modalDetail.classList.remove('show');
        modalDetail.setAttribute('aria-hidden','true');
        // cleanup handlers (not strictly necessary)
        if (btnDarBaja) btnDarBaja.onclick = null;
      }
      function addFieldToModal(label, value) {
        if (!modalDatos) return;
        if (value === undefined || value === null || String(value).trim() === '') return;
        const div = document.createElement('div');
        div.innerHTML = `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}`;
        modalDatos.appendChild(div);
      }

      function darDeBaja(id) {
        const item = inventario.find(x=>x.id===id);
        if (!item) return;
        if (!confirm(`¿Dar de baja al ítem "${item.nombre}"?`)) return;
        inventario = inventario.filter(x=>x.id!==id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
        // guardar en bajas
        const bajas = JSON.parse(localStorage.getItem('bajasInventario')||'[]');
        bajas.push(item);
        localStorage.setItem('bajasInventario', JSON.stringify(bajas));
        renderInventario(applySearchFilter());
        closeDetail();
      }

      // --- Rendering ---
      let _lastFilteredCount = 0;
      function renderInventario(list) {
        if (!grid) return;
        grid.innerHTML = '';
        if (!list || !list.length) {
          grid.innerHTML = '<p>No hay ítems en el inventario.</p>';
          _lastFilteredCount = 0;
          updateCount();
          return;
        }
        list.forEach(item => {
          const card = document.createElement('div');
          card.className = 'jugador-card';
          card.dataset.id = item.id;
          const costoLine = item.tieneCosto ? `<p class="card-costo">${formatCurrency(item.monto)}</p>` : '';
          card.innerHTML = `
            <img src="${item.foto || 'https://via.placeholder.com/96'}" alt="${escapeHtml(item.nombre)}" />
            <h4>${escapeHtml(item.nombre)} — ${escapeHtml(String(item.cantidad))}</h4>
            <p class="card-info">${escapeHtml(truncate(String(item.informacion||''), 80))}</p>
            ${costoLine}
          `;
          grid.appendChild(card);
        });
        _lastFilteredCount = list.length;
        updateCount();
      }
      function updateCount() {
        if (!countEl) return;
        countEl.textContent = `Mostrando ${_lastFilteredCount} de ${inventario.length}.`;
      }

      // --- Search ---
      function applySearchFilter() {
        const term = (buscador && buscador.value) ? buscador.value.trim().toLowerCase() : '';
        const filtered = inventario.filter(it => {
          const name = (it.nombre||'').toLowerCase();
          const info = (it.informacion||'').toLowerCase();
          return !term || name.includes(term) || info.includes(term);
        });
        return filtered;
      }

      // --- Persist / Add item (modificada para manejo de QuotaExceeded) ---
      /**
       * Intenta guardar item en localStorage
       * Devuelve:
       *  - true : guardado con imagen (o sin imagen si no existía)
       *  - 'saved_without_image' : guardado pero sin la imagen (se tuvo que eliminar)
       *  - false : no se pudo guardar (storage lleno)
       */
      function saveNuevo(item) {
        inventario.push(item);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
          renderInventario(applySearchFilter());
          return true;
        } catch (err) {
          console.warn('saveNuevo: setItem ha fallado', err);
          if (isQuotaExceeded(err)) {
            // intentar guardar sin la imagen (si existe)
            try {
              inventario[inventario.length - 1].foto = '';
              localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
              renderInventario(applySearchFilter());
              return 'saved_without_image';
            } catch (err2) {
              console.error('saveNuevo: aún falla tras quitar la imagen', err2);
              // revertir el push
              inventario.pop();
              return false;
            }
          } else {
            console.error('saveNuevo: error no relacionado con cuota', err);
            inventario.pop();
            return false;
          }
        }
      }

      // --- Events: delegated click handling to be robust ---
      document.addEventListener('click', (e) => {
        // abrir modal alta
        if (e.target.closest && e.target.closest('#btnAbrirAltaInventario')) {
          openAltaModal();
          return;
        }
        // cerrar modal alta (botón X)
        if (e.target.closest && e.target.closest('#cerrarAltaInventario')) {
          closeAltaModal();
          return;
        }
        // cerrar detalle al hacer click en backdrop o botón close
        if (e.target.closest && e.target.closest('.jugador-modal-backdrop')) {
          closeDetail();
          return;
        }
        if (e.target.closest && e.target.closest('.jugador-modal-close')) {
          closeDetail();
          return;
        }
      });

      // cerrar con ESC
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { closeAltaModal(); closeDetail(); }
      });

      // attach change for tieneCosto (if present)
      if (tieneCostoField) {
        tieneCostoField.addEventListener('change', () => {
          if (tieneCostoField.value === 'si') {
            if (montoWrap) montoWrap.style.display = '';
            if (montoField) montoField.required = true;
          } else {
            if (montoWrap) montoWrap.style.display = 'none';
            if (montoField) { montoField.required = false; montoField.value = ''; }
          }
        });
      }

      // form submit
      if (formAlta) {
        formAlta.addEventListener('submit', (ev) => {
          ev.preventDefault();
          try {
            const fd = new FormData(formAlta);
            const nombre = (fd.get('nombre')||'').trim();
            const cantidad = parseInt(fd.get('cantidad')||'0',10);
            const informacion = (fd.get('informacion')||'').trim();
            const tieneCosto = fd.get('tieneCosto') === 'si';
            const monto = tieneCosto ? parseFloat(fd.get('monto')||0) : null;

            if (!nombre) return alert('El nombre es obligatorio.');
            if (isNaN(cantidad) || cantidad < 0) return alert('Cantidad inválida.');
            if (tieneCosto && (isNaN(monto) || monto < 0)) return alert('Monto inválido.');

            const file = formAlta.foto && formAlta.foto.files && formAlta.foto.files[0];

            // crearYGuardar ahora espera el DataURL final (posiblemente comprimido)
            const crearYGuardar = (fotoData) => {
              const nuevo = {
                id: genId(),
                nombre,
                cantidad,
                informacion,
                tieneCosto,
                monto: tieneCosto ? Number(monto) : null,
                foto: fotoData || '',
                creado: todayISO()
              };
              const resultado = saveNuevo(nuevo);
              if (resultado === true) {
                if (modalAlta) closeAltaModal();
                formAlta.reset();
              } else if (resultado === 'saved_without_image') {
                alert('Ítem guardado pero sin la imagen (imagen demasiado grande). Puedes intentar con una imagen más pequeña).');
                if (modalAlta) closeAltaModal();
                formAlta.reset();
              } else {
                alert('No se pudo guardar el ítem: almacenamiento lleno. Intenta eliminar elementos o usar una imagen más pequeña.');
                // no cerramos el modal para que el usuario pueda intentar con otra imagen / editar
              }
            };

            if (file) {
              // Leemos primero el file como DataURL y luego intentamos comprimirlo
              const reader = new FileReader();
              reader.onload = () => {
                const originalDataUrl = reader.result;
                // Intento comprimir la imagen (esto reduce mucho el tamaño en la mayoría de casos)
                compressDataUrl(originalDataUrl, 1024, 1024, 0.75, (compressed) => {
                  // llamar al guardado con la versión comprimida
                  crearYGuardar(compressed);
                }, (errCompress) => {
                  // si falla la compresión, guardo con el dataurl original (y saveNuevo tratará el Quota)
                  console.warn('No se pudo comprimir la imagen, se intentará guardar la original:', errCompress);
                  crearYGuardar(originalDataUrl);
                });
              };
              reader.readAsDataURL(file);
            } else {
              crearYGuardar('');
            }
          } catch (err) {
            console.error('Error en envío de formAlta:', err);
            alert('Ocurrió un error al guardar. Revisa consola.');
          }
        });
      }

      // click en tarjeta -> abrir detalle (delegado)
      if (grid) {
        grid.addEventListener('click', (e) => {
          const card = e.target.closest && e.target.closest('.jugador-card');
          if (!card) return;
          const id = card.dataset.id;
          const item = inventario.find(x=>x.id===id);
          if (item) openDetail(item);
        });
      }

      // Initial render
      renderInventario(applySearchFilter());

      // search input live
      if (buscador) {
        buscador.addEventListener('input', () => {
          const filtered = applySearchFilter();
          renderInventario(filtered);
        });
      }

      // Debug-level info
      console.info('inventario.js inicializado correctamente. Elementos encontrados:',
        {
          grid: !!grid,
          buscador: !!buscador,
          modalAlta: !!modalAlta,
          formAlta: !!formAlta,
          modalDetail: !!modalDetail
        });
    } catch (err) {
      console.error('Error inicializando inventario.js:', err);
    }
  });
})();

