(() => {
  "use strict";

  const STORAGE_KEY = "cigaros-theme";

  const ASSETS = {
    light: {
      back: "/uxui/topbar/back-black.svg",
      toggle: "/uxui/topbar/light-sun.svg"
    },
    dark: {
      back: "/uxui/topbar/back-white.svg",
      toggle: "/uxui/topbar/dark-moon.svg"
    }
  };

  function getTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;

    const legacy = localStorage.getItem("theme");
    if (legacy === "light" || legacy === "dark") return legacy;

    const docTheme = document.documentElement.getAttribute("data-theme");
    if (docTheme === "light" || docTheme === "dark") return docTheme;

    return "light";
  }

  function getAssetSet() {
    return getTheme() === "dark" ? ASSETS.dark : ASSETS.light;
  }

  function setTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
    localStorage.setItem("theme", nextTheme);
    syncTopbarAssets();
  }

  function toggleTheme() {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  }

  function syncTopbarAssets(root = document) {
    const assets = getAssetSet();
    const theme = getTheme();

    root.querySelectorAll("[data-topbar-role='back']").forEach((img) => {
      img.src = assets.back;
    });

    root.querySelectorAll("[data-topbar-role='toggle']").forEach((img) => {
      img.src = assets.toggle;
    });

    root.querySelectorAll(".cigaros-topbar-toggle").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(theme === "dark"));
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    });
  }

  function buildTopbar(options = {}) {
    const {
      backHref = "/",
      onBack = null
    } = options;

    const wrap = document.createElement("header");
    wrap.className = "cigaros-topbar";
    wrap.innerHTML = `
      <button
        type="button"
        class="cigaros-topbar-side cigaros-topbar-back"
        aria-label="Back">
        <img
          class="cigaros-topbar-icon"
          data-topbar-role="back"
          alt=""
          draggable="false" />
      </button>

      <button
        type="button"
        class="cigaros-topbar-toggle"
        aria-label="Toggle theme"
        aria-pressed="false">
        <span class="cigaros-topbar-toggle-track" aria-hidden="true"></span>
        <span class="cigaros-topbar-toggle-knob" aria-hidden="true">
          <img
            class="cigaros-topbar-toggle-icon"
            data-topbar-role="toggle"
            alt=""
            draggable="false" />
        </span>
      </button>
    `;

    wrap.querySelector(".cigaros-topbar-back")?.addEventListener("click", () => {
      if (typeof onBack === "function") {
        onBack();
        return;
      }

      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = backHref;
      }
    });

    wrap.querySelector(".cigaros-topbar-toggle")?.addEventListener("click", () => {
      toggleTheme();
      document.dispatchEvent(
        new CustomEvent("cigaros:theme-changed", { detail: { theme: getTheme() } })
      );
    });

    syncTopbarAssets(wrap);
    return wrap;
  }

  function mount(selector, options = {}) {
    const target =
      typeof selector === "string" ? document.querySelector(selector) : selector;

    if (!target) return null;

    target.innerHTML = "";
    const node = buildTopbar(options);
    target.appendChild(node);

    syncTopbarAssets(target);
    return node;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const theme = getTheme();
    document.documentElement.setAttribute("data-theme", theme);
    syncTopbarAssets(document);
  });

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === "theme") {
      const theme = getTheme();
      document.documentElement.setAttribute("data-theme", theme);
      syncTopbarAssets(document);
    }
  });

  window.CigarOSTopbar = {
    mount,
    getTheme,
    setTheme,
    refresh() {
      syncTopbarAssets(document);
    }
  };
})();
