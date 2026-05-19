(() => {
  "use strict";

  const root = document.documentElement;
  const toggle = document.getElementById("themeToggle");
  const icon = document.getElementById("themeIcon");

  const STORAGE_KEY = "cigaros-theme";

  function applyTheme(theme){
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);

    if(icon){
      icon.src = theme === "dark"
        ? "/img/icons/moon.svg"
        : "/img/icons/sun.svg";
    }
  }

  applyTheme(localStorage.getItem(STORAGE_KEY) || "dark");

  toggle?.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
  });
})();
