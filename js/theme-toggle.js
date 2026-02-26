/* /js/theme-toggle.js
   Applies theme to <html data-theme="">
   - localStorage "theme" = "light" | "dark" | "" (unset)
   - if unset, follows system preference
*/

(() => {
  const KEY = "theme";

  const getStored = () => {
    try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
  };

  const setStored = (v) => {
    try { localStorage.setItem(KEY, v); } catch {}
  };

  const mq = () => {
    try { return window.matchMedia("(prefers-color-scheme: dark)"); } catch { return null; }
  };

  const getSystemPref = () => {
    const m = mq();
    return m && m.matches ? "dark" : "light";
  };

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  };

  const init = () => {
    const saved = getStored();
    const usingSystem = !(saved === "dark" || saved === "light");
    applyTheme(usingSystem ? getSystemPref() : saved);

    const btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const cur = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        const next = cur === "dark" ? "light" : "dark";
        setStored(next);
        applyTheme(next);
      });
    }

    const m = mq();
    if (m) {
      m.addEventListener?.("change", () => {
        const now = getStored();
        const stillUsingSystem = !(now === "dark" || now === "light");
        if (stillUsingSystem) applyTheme(getSystemPref());
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
