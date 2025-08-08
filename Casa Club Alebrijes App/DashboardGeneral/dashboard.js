document.addEventListener("DOMContentLoaded", () => {
  const totalJugadoresEl = document.getElementById("totalJugadores");
  const totalAdeudoEl = document.getElementById("totalAdeudo");
  const totalRecaudadoEl = document.getElementById("totalRecaudado");
  const notificacionesEl = document.getElementById("notificaciones");

  // Cargar datos de LocalStorage
  const jugadores = JSON.parse(localStorage.getItem("jugadores")) || [];
  const pagos = JSON.parse(localStorage.getItem("pagos")) || [];

  // Total de jugadores
  if (totalJugadoresEl) totalJugadoresEl.textContent = jugadores.length;

  // Cálculo de pagos (total recaudado)
  let totalRecaudado = pagos.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
  if (totalRecaudadoEl) totalRecaudadoEl.textContent = formatCurrency(totalRecaudado);

  // Total adeudo (Ejemplo: mensualidad pendiente)
  const mensualidad = 500; // Ajusta el valor
  const totalAdeudo = jugadores.length * mensualidad - totalRecaudado;
  if (totalAdeudoEl) totalAdeudoEl.textContent = formatCurrency(totalAdeudo);

  // Notificaciones
  if (notificacionesEl) notificacionesEl.textContent = pagos.length
    ? `${pagos.length} pagos registrados`
    : "Sin pagos recientes";

  // Fecha y hora
  actualizarFechaHora();
  setInterval(actualizarFechaHora, 1000);

  // Llenar tablas y carousels
  llenarTablaPagos(pagos, jugadores);
  mostrarUltimosJugadores(jugadores);
});

/* ---- Funciones ---- */

// Actualiza fecha y hora
function actualizarFechaHora() {
  const fechaHoraEl = document.getElementById("fechaHora");
  if (!fechaHoraEl) return;
  const ahora = new Date();
  fechaHoraEl.textContent = ahora.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

// Llena tabla de últimos pagos
function llenarTablaPagos(pagos, jugadores) {
  const tablaPagos = document.getElementById("tablaPagos");
  if (!tablaPagos) return;

  tablaPagos.innerHTML = "";
  if (pagos.length === 0) {
    tablaPagos.innerHTML = `<tr><td colspan="3">No hay pagos registrados.</td></tr>`;
    return;
  }

  pagos
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5)
    .forEach(pago => {
      const jugador = jugadores.find(j => j.id === pago.jugador_id);
      const nombre = jugador ? `${jugador.nombres} ${jugador.apellido_paterno}` : "Desconocido";
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${nombre}</td>
        <td>${pago.fecha}</td>
        <td>${formatCurrency(pago.monto)}</td>
      `;
      tablaPagos.appendChild(fila);
    });
}

// Muestra los últimos jugadores
function mostrarUltimosJugadores(jugadores) {
  const contenedor = document.getElementById("jugadoresCarousel");
  if (!contenedor) return;

  contenedor.innerHTML = "";
  jugadores.slice(-5).forEach(j => {
    const fullName = `${j.nombres} ${j.apellido_paterno}`;
    const foto = j.imagen || "https://via.placeholder.com/100";
    const card = document.createElement("div");
    card.classList.add("jugador-card");
    card.innerHTML = `
      <img src="${foto}" alt="${fullName}">
      <h4>${fullName}</h4>
    `;
    contenedor.appendChild(card);
  });
}

// Formato de moneda
function formatCurrency(num) {
  return "$" + Number(num || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 });
}