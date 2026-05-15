/* /profile/profile.js */

(() => {
  "use strict";

  const root = document.documentElement;
  const toggle = document.getElementById("themeToggle");

  const STORAGE_KEY = "cigaros-theme";

  const savedTheme = localStorage.getItem(STORAGE_KEY);
  const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  const initialTheme = savedTheme || preferredTheme;

  root.setAttribute("data-theme", initialTheme);

  toggle?.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";

    root.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
  });

  const pressables = document.querySelectorAll(
    ".profile-row, .favorite-card, .id-card, .profile-back, .theme-toggle"
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
