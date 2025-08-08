document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  menuBtn.addEventListener("click", (e) => {
    const isOpen = sidebar.classList.toggle("show");
    overlay.classList.toggle("active", isOpen);
    menuBtn.innerHTML = isOpen ? "&times;" : "&#9776;";
    e.stopPropagation();
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("show");
    overlay.classList.remove("active");
    menuBtn.innerHTML = "&#9776;";
  });

  document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
      sidebar.classList.remove("show");
      overlay.classList.remove("active");
      menuBtn.innerHTML = "&#9776;";
    }
  });
});