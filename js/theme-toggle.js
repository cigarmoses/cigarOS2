/* /js/theme-toggle.js
   Theme toggle (html[data-theme]) + cart icon swap + knob icon swap
*/

(() => {
  const HTML = document.documentElement;

  const SUN  = "/img/icons/sun.svg";
  const MOON = "/img/icons/moon.svg";

  const CART_LIGHT = "/img/icons/cart-empty.svg"; // blue
  const CART_DARK  = "/img/icons/cart-red.svg";   // red

  function setCartIcon(theme) {
    const img = document.querySelector("#invoice-icon");
    if (!img) return;
    img.src = theme === "dark" ? CART_DARK : CART_LIGHT;
  }

  function setKnobIcon(theme) {
    const knobImg = document.querySelector("#themeKnobIcon");
    if (!knobImg) return;
    knobImg.src = theme === "dark" ? MOON : SUN;
  }

  function applyTheme(theme) {
    if (theme === "dark") HTML.setAttribute("data-theme", "dark");
    else HTML.removeAttribute("data-theme");

    localStorage.setItem("theme", theme);
    setCartIcon(theme);
    setKnobIcon(theme);
  }

  function getInitialTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;

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
