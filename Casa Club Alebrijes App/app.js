const loginBtn = document.getElementById('loginBtn');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('errorMsg');

// Ocultar loader y mostrar login cuando cargue todo
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').style.display = 'none';
    document.querySelector('.login-wrapper').classList.remove('hidden');
  }, 2000); // esperar animación
});

// Validación de acceso
loginBtn.addEventListener('click', () => {
  const pw = passwordInput.value;
  if (pw === '1234') {
    errorMsg.style.display = 'none';
    window.location.href = '../DashboardGeneral/dashboard.html'; // Ruta corregida
  } else {
    errorMsg.style.display = 'block';
  }
});

passwordInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') loginBtn.click();
});