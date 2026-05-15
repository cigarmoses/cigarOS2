/* /profile/profile.js */

(() => {
  "use strict";

  const root = document.documentElement;
  const toggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");

  const STORAGE_KEY = "cigaros-theme";

  const setTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);

    if (themeIcon) {
      themeIcon.src = theme === "dark"
        ? "/img/icons/moon.svg"
        : "/img/icons/sun.svg";
    }
  };

  const savedTheme = localStorage.getItem(STORAGE_KEY);
  setTheme(savedTheme || "light");

  toggle?.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "light";
    setTheme(current === "dark" ? "light" : "dark");
  });
})();
