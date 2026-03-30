(() => {
  "use strict";

  const ICON_BASE = "/uxui/topbar";
  const THEME_KEY = "theme";

  function getTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function setTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    syncTopbarIcons();
  }

  function iconPath(name, theme) {
    const color = theme === "dark" ? "white" : "black";
    return `${ICON_BASE}/${name}-${color}.svg`;
  }

  function moonSunPath(theme) {
    return theme === "dark"
      ? `${ICON_BASE}/dark-moon.svg`
      : `${ICON_BASE}/light-sun.svg`;
  }

  function syncTopbarIcons(root = document) {
    const theme = getTheme();

    root.querySelectorAll("[data-utb-icon='back']").forEach((img) => {
      img.src = iconPath("back", theme);
    });

    root.querySelectorAll("[data-utb-icon='home']").forEach((img) => {
      img.src = iconPath("home", theme);
    });

    root.querySelectorAll("[data-utb-icon='search']").forEach((img) => {
      img.src = iconPath("search", theme);
    });

    root.querySelectorAll("[data-utb-icon='favorites']").forEach((img) => {
      img.src = iconPath("favorites", theme);
    });

    root.querySelectorAll("[data-utb-icon='cart']").forEach((img) => {
      img.src = iconPath("cart", theme);
    });

    root.querySelectorAll("[data-utb-icon='theme']").forEach((img) => {
      img.src = moonSunPath(theme);
    });
  }

  function getCartCount() {
    try {
      const raw = JSON.parse(localStorage.getItem("cigaros_cart") || "[]");
      return Array.isArray(raw) ? raw.length : 0;
    } catch {
      return 0;
    }
  }

  function syncCartBadges(root = document) {
    const count = getCartCount();
    root.querySelectorAll("[data-utb-cart-badge]").forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count <= 0;
    });
  }

  function buildTopbar(options = {}) {
    const {
      homeHref = "/",
      searchHref = "/search/",
      favoritesHref = "/pos/favorites/",
      cartHref = "/pos/invoice/",
      backHref = "",
      backMode = "history"
    } = options;

    const wrapper = document.createElement("div");
    wrapper.className = "utb-wrap";
    wrapper.innerHTML = `
      <div class="utb">
        ${
          backMode === "link" && backHref
            ? `<a class="utb-link" href="${backHref}" aria-label="Back">
                 <img class="utb-icon" data-utb-icon="back" alt="" />
               </a>`
            : `<button class="utb-btn" type="button" data-utb-back aria-label="Back">
                 <img class="utb-icon" data-utb-icon="back" alt="" />
               </button>`
        }

        <div class="utb-dock">
          <button class="utb-theme" type="button" data-utb-theme-toggle aria-label="Toggle theme" aria-pressed="false">
            <span class="utb-theme-track" aria-hidden="true"></span>
            <span class="utb-theme-thumb" aria-hidden="true">
              <img class="utb-icon" data-utb-icon="theme" alt="" />
            </span>
          </button>

          <a class="utb-mini" href="${homeHref}" aria-label="Home">
            <img class="utb-icon" data-utb-icon="home" alt="" />
          </a>

          <a class="utb-mini" href="${searchHref}" aria-label="Search">
            <img class="utb-icon" data-utb-icon="search" alt="" />
          </a>

          <a class="utb-mini" href="${favoritesHref}" aria-label="Favorites">
            <img class="utb-icon" data-utb-icon="favorites" alt="" />
          </a>
        </div>

        <a class="utb-link utb-cart" href="${cartHref}" aria-label="Invoice">
          <img class="utb-icon" data-utb-icon="cart" alt="" />
          <span class="utb-cart-badge" data-utb-cart-badge hidden>0</span>
        </a>
      </div>
    `;

    wrapper.querySelector("[data-utb-theme-toggle]")?.addEventListener("click", () => {
      const next = getTheme() === "dark" ? "light" : "dark";
      setTheme(next);
    });

    wrapper.querySelector("[data-utb-back]")?.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else window.location.href = homeHref;
    });

    syncTopbarIcons(wrapper);
    syncCartBadges(wrapper);

    const toggle = wrapper.querySelector("[data-utb-theme-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(getTheme() === "dark"));
    }

    return wrapper;
  }

  window.CigarOSTopbar = {
    mount(selector, options = {}) {
      const target = typeof selector === "string" ? document.querySelector(selector) : selector;
      if (!target) return null;
      const topbar = buildTopbar(options);
      target.innerHTML = "";
      target.appendChild(topbar);
      return topbar;
    },
    refresh() {
      syncTopbarIcons();
      syncCartBadges();
    },
    setTheme,
    getTheme
  };

  document.addEventListener("DOMContentLoaded", () => {
    syncTopbarIcons();
    syncCartBadges();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY || e.key === "cigaros_cart") {
      syncTopbarIcons();
      syncCartBadges();
    }
  });
})();
