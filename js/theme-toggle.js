/* /js/theme-toggle.js
   Global theme toggle:
   - Stores preference in localStorage: "theme" = "light" | "dark"
   - Applies to <html data-theme="..."> (matches /css/theme.css)
*/

(() => {
  const KEY = "theme";

  const getStored = () => {
    try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
  };

  const setStored = (v) => {
    try { localStorage.setItem(KEY, v); } catch {}
  };

  const getSystemPref = () => {
    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  };

  const applyTheme = (theme) => {
    const root = document.documentElement; // ✅ <html>
    if (!root) return;

    root.dataset.theme = theme;

    const btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");

      const ico = btn.querySelector(".tt-knob-ico");
      if (ico) {
        ico.innerHTML =
          theme === "dark"
            ? `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                 <path d="M20 15.2A7.7 7.7 0 0 1 8.8 4a6.5 6.5 0 1 0 11.2 11.2Z"
                       fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>`
            : `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                 <path d="M12 18a6 6 0 1 0 0-12a6 6 0 0 0 0 12Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                 <path d="M12 2.3v2.3M12 19.4v2.3M3.1 12h2.3M18.6 12h2.3M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M19.4 4.6l-1.6 1.6M6.2 17.8l-1.6 1.6"
                       fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
               </svg>`;
      }
    }
  };

  const init = () => {
    const saved = getStored();
    const theme = saved === "dark" || saved === "light" ? saved : getSystemPref();
    applyTheme(theme);

    const btn = document.getElementById("theme-toggle");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      const next = cur === "dark" ? "light" : "dark";
      setStored(next);
      applyTheme(next);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
