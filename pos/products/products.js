/* /pos/products/products.js
   POS Products
   - Loads /pos/products/products.json
   - Category chips
   - Search
   - Favorite toggle
   - Qty stepper with shared cart
*/

(() => {
  "use strict";

  const DATA_URL = "/pos/products/products.json";
  const FAVORITES_KEY = "cigaros_product_favorites";

  const CATEGORY_ORDER = [
    "Drinks",
    "Food",
    "Packs",
    "Alcohol",
    "Ashtrays",
    "Cutters",
    "Lighters",
    "Pipes",
    "All"
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const grid = $("#productGrid");
  const searchInput = $("#searchInput");
  const categoryRow = $("#categoryRow");
  const filterBtn = $("#filterBtn");
  const themeToggle = $("#theme-toggle");
  const searchBtn = $("#productsSearchBtn");

  const state = {
    products: [],
    activeCategory: "All",
    search: "",
    favoritesOnly: false,
    favorites: readSet(FAVORITES_KEY)
  };

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(next === "dark"));
    }
  }

  function initThemeToggle() {
    const saved =
      localStorage.getItem("theme") ||
      document.documentElement.getAttribute("data-theme") ||
      "light";

    applyTheme(saved);

    themeToggle?.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  function readSet(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  }

  function writeSet(key, set) {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  }

  function formatPrice(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : "$0.00";
  }

  function normalizeProducts(raw) {
    return raw
      .map((item) => ({
        key: normalizeText(item.key),
        category: normalizeText(item.category),
        brand: normalizeText(item.brand),
        name: normalizeText(item.name || item.product),
        price: Number(item.price) || 0,
        image: normalizeText(item.image),
        brandIcon: normalizeText(item.brandIcon),
        status: normalizeText(item.status || "Active"),
        inventory: Number(item.inventory) || 0,
        taxable: Boolean(item.taxable)
      }))
      .filter((item) => item.key && item.name);
  }

  function getCategoryFolder(category) {
    return slugify(category);
  }

  function getImageCandidates(product) {
    if (product.image) return [product.image];
    if (product.brandIcon) return [product.brandIcon];

    const folder = getCategoryFolder(product.category);
    const file = slugify(product.name);

    if (!folder || !file) return [];

    return [
      `/img/icons/${folder}/${file}.svg`,
      `/img/icons/${folder}/${file}.png`,
      `/img/icons/${folder}/${file}.jpg`
    ];
  }

  function buildCategoryList(products) {
    const found = new Set(products.map((p) => p.category).filter(Boolean));
    return CATEGORY_ORDER.filter((cat) => cat === "All" || found.has(cat));
  }

  function renderCategories() {
    if (!categoryRow) return;

    const cats = buildCategoryList(state.products);

    categoryRow.innerHTML = cats
      .map((cat) => {
        return `
          <button
            class="pos-chip${state.activeCategory === cat ? " is-active" : ""}"
            type="button"
            data-category="${escapeHTML(cat)}"
          >${escapeHTML(cat)}</button>
        `;
      })
      .join("");

    $$("[data-category]", categoryRow).forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeCategory = btn.getAttribute("data-category") || "All";
        renderCategories();
        renderProducts();
      });
    });
  }

  function getFilteredProducts() {
    let items = [...state.products];

    if (state.activeCategory !== "All") {
      items = items.filter((p) => p.category === state.activeCategory);
    }

    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter((p) => {
        const hay = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (state.favoritesOnly) {
      items = items.filter((p) => state.favorites.has(p.key));
    }

    return items;
  }

  function buildCartItem(product) {
    return {
      key: product.key,
      type: "product",
      id: product.key,
      category: product.category,
      brand: product.brand,
      line: "",
      name: product.name,
      vitola: "",
      msrp: product.price,
      image: getImageCandidates(product)[0] || "",
      url: window.location.href
    };
  }

  function getCartQty(product) {
    const api = window.cigarOSCart;
    if (!api || typeof api.getItemQty !== "function") return 0;
    return api.getItemQty(buildCartItem(product)) || 0;
  }

  function setCartQty(product, qty) {
    const api = window.cigarOSCart;
    if (!api || typeof api.setQty !== "function") return;
    api.setQty(buildCartItem(product), qty);
  }

  function toggleFavorite(key) {
    if (state.favorites.has(key)) {
      state.favorites.delete(key);
    } else {
      state.favorites.add(key);
    }

    writeSet(FAVORITES_KEY, state.favorites);
    renderProducts();
  }

  function renderProducts() {
    if (!grid) return;

    const items = getFilteredProducts();

    if (!items.length) {
      grid.innerHTML = `<div class="products-empty">No products found.</div>`;
      return;
    }

    grid.innerHTML = items
      .map((product) => {
        const qty = getCartQty(product);
        const isFavorite = state.favorites.has(product.key);
        const imageCandidates = getImageCandidates(product);
        const fallbackLetter = (product.name || "?").slice(0, 1).toUpperCase();

        return `
          <article class="product-card" data-key="${escapeHTML(product.key)}">
            <div class="product-card-media">
              ${
                imageCandidates.length
                  ? `<img
                      class="product-card-image"
                      src="${escapeHTML(imageCandidates[0])}"
                      alt="${escapeHTML(product.name)}"
                      loading="lazy"
                      decoding="async"
                      onerror="this.style.display='none'; this.parentElement.classList.add('is-fallback');"
                    >`
                  : ``
              }

              <div class="product-card-fallback${imageCandidates.length ? "" : " is-visible"}">
                ${escapeHTML(fallbackLetter)}
              </div>

              <button
                class="product-favorite${isFavorite ? " is-on" : ""}"
                type="button"
                data-favorite="${escapeHTML(product.key)}"
                aria-label="Favorite ${escapeHTML(product.name)}"
              >★</button>
            </div>

            <div class="product-card-body">
              <div class="product-name">${escapeHTML(product.name)}</div>
              <div class="product-brand">${escapeHTML(product.brand || "\u00A0")}</div>
              <div class="product-price">${escapeHTML(formatPrice(product.price))}</div>
            </div>

            <div class="product-card-footer">
              <div class="product-qty" aria-label="Quantity">
                <button type="button" class="qty-btn" data-minus="${escapeHTML(product.key)}">−</button>
                <span class="qty-value">${qty}</span>
                <button type="button" class="qty-btn" data-plus="${escapeHTML(product.key)}">+</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    $$("[data-plus]", grid).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-plus") || "";
        const product = state.products.find((p) => p.key === key);
        if (!product) return;
        setCartQty(product, getCartQty(product) + 1);
        renderProducts();
      });
    });

    $$("[data-minus]", grid).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-minus") || "";
        const product = state.products.find((p) => p.key === key);
        if (!product) return;
        setCartQty(product, Math.max(0, getCartQty(product) - 1));
        renderProducts();
      });
    });

    $$("[data-favorite]", grid).forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleFavorite(btn.getAttribute("data-favorite") || "");
      });
    });
  }

  function bindUI() {
    searchInput?.addEventListener("input", (e) => {
      state.search = normalizeText(e.target.value).toLowerCase();
      renderProducts();
    });

    filterBtn?.addEventListener("click", () => {
      state.favoritesOnly = !state.favoritesOnly;
      filterBtn.classList.toggle("is-on", state.favoritesOnly);
      renderProducts();
    });

    searchBtn?.addEventListener("click", () => {
      if (typeof window.openGlobalSearch === "function") {
        window.openGlobalSearch();
      } else {
        searchInput?.focus();
      }
    });

    document.addEventListener("cigaros:cart-changed", () => {
      renderProducts();
    });
  }

  async function loadProducts() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load products: ${res.status}`);

      const raw = await res.json();
      state.products = normalizeProducts(Array.isArray(raw) ? raw : []);

      renderCategories();
      renderProducts();
    } catch (err) {
      console.error("Failed to load products:", err);
      if (grid) {
        grid.innerHTML = `<div class="products-empty" style="color:#ff3b30;">Error loading products.</div>`;
      }
    }
  }

  function init() {
    initThemeToggle();
    bindUI();
    loadProducts();
  }

  init();
})();
