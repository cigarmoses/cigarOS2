/* /js/theme-toggle.js
   Theme toggle (html[data-theme]) + cart icon swap
*/

(() => {
  const HTML = document.documentElement;

  const CART_LIGHT = "/img/icons/cart-empty.svg";
  const CART_DARK  = "/img/icons/cart-red.svg";

  function setCartIcon(theme) {
    const img = document.querySelector("#invoice-icon");
    if (!img) return;
    img.src = theme === "dark" ? CART_DARK : CART_LIGHT;
  }

  function applyTheme(theme) {
    if (theme === "dark") HTML.setAttribute("data-theme", "dark");
    else HTML.removeAttribute("data-theme");

    localStorage.setItem("theme", theme);
    setCartIcon(theme);
  }

  function getInitialTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;

    // fallback: system
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    return prefersDark ? "dark" : "light";
  }

  function toggleTheme() {
    const cur = HTML.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(cur === "dark" ? "light" : "dark");
  }

  // boot
  applyTheme(getInitialTheme());

  // bind
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("#themeToggle");
    if (!btn) return;
    e.preventDefault();
    toggleTheme();
  });
})();
