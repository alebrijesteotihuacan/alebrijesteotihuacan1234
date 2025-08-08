// Toggle menú
const menuBtn = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

menuBtn.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("show");
    overlay.classList.toggle("active", isOpen);
});

overlay.addEventListener("click", () => {
    sidebar.classList.remove("show");
    overlay.classList.remove("active");
});

// Formulario de Alta
const form = document.getElementById("formAltaJugador");
const fechaNacimientoInput = document.getElementById("fechaNacimiento");
const edadAniosInput = document.getElementById("edadAnios");
const edadMesesInput = document.getElementById("edadMeses");
const direccionTutorInput = document.getElementById("direccionTutor");

// Calcular edad y bloquear tutor si es mayor de edad
fechaNacimientoInput.addEventListener("change", function () {
    const fechaNac = new Date(this.value);
    const hoy = new Date();

    if (fechaNac > hoy) {
        alert("La fecha de nacimiento no puede ser futura.");
        this.value = "";
        return;
    }

    let edadAnio = hoy.getFullYear() - fechaNac.getFullYear();
    let edadMes = hoy.getMonth() - fechaNac.getMonth();
    if (edadMes < 0) {
        edadAnio--;
        edadMes += 12;
    }

    edadAniosInput.value = edadAnio;
    edadMesesInput.value = edadMes;

    direccionTutorInput.disabled = edadAnio >= 18;
});

// Mostrar campo NUI solo si eligen "Sí"
const tieneNui = document.getElementById("tieneNui");
const nuiField = document.getElementById("nuiField");
const nuiInput = document.getElementById("nuiInput");

if (tieneNui) {
    tieneNui.addEventListener("change", () => {
        const show = tieneNui.value === "si";
        nuiField.style.display = show ? "block" : "none";
        nuiInput.disabled = !show;
        if (!show) nuiInput.value = "";
    });
}

// Guardar datos en LocalStorage
form.addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData(form);
    const jugador = {};

    formData.forEach((value, key) => {
        jugador[key] = value;
    });

    // Procesar imagen de perfil
    const imagenFile = formData.get("imagen");
    const archiveroFiles = formData.getAll("archivero");

    // Leer imagen y archivos antes de guardar
    if (imagenFile && imagenFile.size > 0) {
        const reader = new FileReader();
        reader.onload = function (event) {
            jugador.imagen = event.target.result;
            procesarArchivero(archiveroFiles, jugador);
        };
        reader.readAsDataURL(imagenFile);
    } else {
        jugador.imagen = "";
        procesarArchivero(archiveroFiles, jugador);
    }
});

// Procesar múltiples archivos del archivero
function procesarArchivero(files, jugador) {
    const archivos = [];
    let pendientes = 0;

    if (files && files.length > 0 && files[0].size > 0) {
        pendientes = files.length;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = function (event) {
                archivos.push({
                    name: file.name,
                    type: file.type,
                    url: event.target.result
                });
                pendientes--;
                if (pendientes === 0) {
                    jugador.archivero = archivos;
                    guardarJugador(jugador);
                }
            };
            reader.readAsDataURL(file);
        });
    } else {
        jugador.archivero = [];
        guardarJugador(jugador);
    }
}

function guardarJugador(jugador) {
    jugador.id = "id-" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    let jugadores = JSON.parse(localStorage.getItem("jugadores")) || [];
    jugadores.push(jugador);
    localStorage.setItem("jugadores", JSON.stringify(jugadores));
    alert("Jugador registrado con éxito ✅");
    form.reset();
}