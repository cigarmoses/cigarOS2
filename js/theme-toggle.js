/* /js/theme-toggle.js
   - Toggles html[data-theme] between "light" and "dark"
   - Persists to localStorage
*/

(() => {
  const KEY = "cigaros_theme";

  function getTheme() {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;

    // fallback: prefer current html attr, else system
    const html = document.documentElement;
    const cur = html.getAttribute("data-theme");
    if (cur === "dark" || cur === "light") return cur;

    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function setTheme(next) {
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(KEY, next);
  }

  function toggleTheme() {
    const cur = getTheme();
    setTheme(cur === "dark" ? "light" : "dark");
  }

  function boot() {
    // apply theme immediately
    setTheme(getTheme());

    // bind button if present
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.addEventListener("click", toggleTheme);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
