/* /js/theme-toggle.js */

(() => {
  const STORAGE_KEY = "cigaros_theme"; // "dark" | "light"

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    const btn = document.querySelector("[data-theme-toggle]");
    if (btn) btn.setAttribute("aria-pressed", String(isDark));
  }

  function getSavedTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  function saveTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }

  function init() {
    const saved = getSavedTheme();
    const initial = saved || getSystemTheme();
    applyTheme(initial);

    // Keep in sync with OS changes ONLY if user hasn't explicitly chosen
    if (!saved && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener?.("change", () => applyTheme(getSystemTheme()));
    }

    document.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-theme-toggle]");
      if (!btn) return;

      const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      saveTheme(next);
      applyTheme(next);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
