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
  const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  setTheme(savedTheme || preferredTheme);

  toggle?.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "light";
    setTheme(current === "dark" ? "light" : "dark");
  });

  const pressables = document.querySelectorAll(
    ".profile-row, .favorite-card, .qr-card, .back-btn, .theme-toggle"
  );

  pressables.forEach((el) => {
    el.addEventListener("pointerdown", () => {
      el.style.filter = "brightness(.96)";
    });

    const clear = () => {
      el.style.filter = "";
    };

    el.addEventListener("pointerup", clear);
    el.addEventListener("pointercancel", clear);
    el.addEventListener("pointerleave", clear);
  });
})();
