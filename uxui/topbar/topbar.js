(() => {
  "use strict";

  const STORAGE_KEY = "cigaros-theme";

  const ASSETS = {
    light: {
      background: "/uxui/topbar/lightmode/lightmodebackground.svg",
      back: "/uxui/topbar/lightmode/lightmodeback.svg",
      cart: "/uxui/topbar/lightmode/lightmodecart.svg",
      favorites: "/uxui/topbar/lightmode/lightmodefavorites.svg",
      home: "/uxui/topbar/lightmode/lightmodehome.svg",
      search: "/uxui/topbar/lightmode/lightmodesearch.svg",
      toggle: "/uxui/topbar/lightmode/lightmodesuntoggle.svg"
    },
    dark: {
      background: "/uxui/topbar/darkmode/darkmodebackground.svg",
      back: "/uxui/topbar/darkmode/darkmodeback.svg",
      cart: "/uxui/topbar/darkmode/darkmodecart.svg",
      favorites: "/uxui/topbar/darkmode/darkmodefavorites.svg",
      home: "/uxui/topbar/darkmode/darkmodehome.svg",
      search: "/uxui/topbar/darkmode/darkmodesearch.svg",
      toggle: "/uxui/topbar/darkmode/darkmodemoontoggle.svg"
    }
  };

  function getTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;

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
    syncTopbarAssets();
  }

  function toggleTheme() {
    setTheme(getTheme() === "dark" ? "light" : "dark");
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
    root.querySelectorAll(".cigaros-topbar-cart-badge").forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count <= 0;
    });
  }

  function syncTopbarAssets(root = document) {
    const assets = getAssetSet();
    const theme = getTheme();

    root.querySelectorAll("[data-topbar-role='background']").forEach((img) => {
      img.src = assets.background;
    });

    root.querySelectorAll("[data-topbar-role='back']").forEach((img) => {
      img.src = assets.back;
    });

    root.querySelectorAll("[data-topbar-role='home']").forEach((img) => {
      img.src = assets.home;
    });

    root.querySelectorAll("[data-topbar-role='search']").forEach((img) => {
      img.src = assets.search;
    });

    root.querySelectorAll("[data-topbar-role='favorites']").forEach((img) => {
      img.src = assets.favorites;
    });

    root.querySelectorAll("[data-topbar-role='cart']").forEach((img) => {
      img.src = assets.cart;
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
      homeHref = "/",
      searchHref = "/search/",
      favoritesHref = "/pos/favorites/",
      cartHref = "/pos/cart/"
    } = options;

    const wrap = document.createElement("header");
    wrap.className = "cigaros-topbar";
    wrap.innerHTML = `
      <button
        type="button"
        class="cigaros-topbar-side cigaros-topbar-back"
        aria-label="Back">
        <img
          class="cigaros-topbar-icon cigaros-topbar-back-icon"
          data-topbar-role="back"
          alt=""
          draggable="false" />
      </button>

      <div class="cigaros-topbar-center" aria-label="Primary navigation">
        <img
          class="cigaros-topbar-background"
          data-topbar-role="background"
          alt=""
          draggable="false" />

        <button
          type="button"
          class="cigaros-topbar-toggle"
          aria-label="Toggle dark mode"
          aria-pressed="false">
          <img
            class="cigaros-topbar-icon cigaros-topbar-toggle-icon"
            data-topbar-role="toggle"
            alt=""
            draggable="false" />
        </button>

        <a href="${homeHref}" class="cigaros-topbar-link cigaros-topbar-home" aria-label="Home">
          <img
            class="cigaros-topbar-icon"
            data-topbar-role="home"
            alt=""
            draggable="false" />
        </a>

        <a href="${searchHref}" class="cigaros-topbar-link cigaros-topbar-search" aria-label="Search">
          <img
            class="cigaros-topbar-icon"
            data-topbar-role="search"
            alt=""
            draggable="false" />
        </a>

        <a href="${favoritesHref}" class="cigaros-topbar-link cigaros-topbar-favorites" aria-label="Favorites">
          <img
            class="cigaros-topbar-icon"
            data-topbar-role="favorites"
            alt=""
            draggable="false" />
        </a>
      </div>

      <a href="${cartHref}" class="cigaros-topbar-side cigaros-topbar-cart" aria-label="Cart">
        <img
          class="cigaros-topbar-icon cigaros-topbar-cart-icon"
          data-topbar-role="cart"
          alt=""
          draggable="false" />
        <span class="cigaros-topbar-cart-badge" hidden>0</span>
      </a>
    `;

    wrap.querySelector(".cigaros-topbar-back")?.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = homeHref;
      }
    });

    wrap.querySelector(".cigaros-topbar-toggle")?.addEventListener("click", () => {
      toggleTheme();
      syncCartBadges(document);
    });

    syncTopbarAssets(wrap);
    syncCartBadges(wrap);

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
    syncCartBadges(target);

    return node;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const theme = getTheme();
    document.documentElement.setAttribute("data-theme", theme);
    syncTopbarAssets(document);
    syncCartBadges(document);
  });

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === "cigaros_cart") {
      const theme = getTheme();
      document.documentElement.setAttribute("data-theme", theme);
      syncTopbarAssets(document);
      syncCartBadges(document);
    }
  });

  window.CigarOSTopbar = {
    mount,
    getTheme,
    setTheme,
    refresh() {
      syncTopbarAssets(document);
      syncCartBadges(document);
    }
  };
})();
