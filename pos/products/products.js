/* /pos/products/products.js
   Products page
   - Loads /pos/products/products.json
   - Shows all products by default
   - Horizontal category filtering
   - Search filtering
   - Favorites toggle
   - Qty stepper per product
   - Shared cart hook support
*/

(() => {
  "use strict";

  const DATA_URL = "/pos/products.json";
  const FAVORITES_KEY = "cigaros_product_favorites";
  const QTY_KEY = "cigaros_product_qty";

  const CATEGORY_ORDER = [
    "All",
    "Drinks",
    "Food",
    "Alcohol",
    "Accessories",
    "Ashtrays",
    "Pipes",
    "Packs"
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const root = document.documentElement;
  const themeToggle = $("#theme-toggle");

  const categoryRow =
    $("#categoryRow") ||
    $(".pos-categories");

  const searchInput =
    $("#searchInput") ||
    $("#productSearch") ||
    $("#productsSearch");

  const grid =
    $("#productGrid") ||
    $(".pos-grid");

  const favoritesBtn =
    $("#favToggle") ||
    $("#productsFavToggle");

  const filterBtn =
    $("#filterBtn") ||
    $("#productsFilterBtn");

  const addToBillBtn =
    $("#addToBill") ||
    $("#addToBillBtn");

  const cartBadge = $("[data-cart-badge]");

  const state = {
    allProducts: [],
    activeCategory: "All",
    search: "",
    favoritesOnly: false,
    favorites: readSet(FAVORITES_KEY),
    qty: readQtyMap()
  };

  function getSavedTheme() {
    return localStorage.getItem("theme") || root.getAttribute("data-theme") || "dark";
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeToggle?.setAttribute("aria-pressed", String(next === "dark"));
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {}
  }

  function readQtyMap() {
    try {
      const raw = JSON.parse(localStorage.getItem(QTY_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writeQtyMap() {
    try {
      localStorage.setItem(QTY_KEY, JSON.stringify(state.qty));
    } catch {}
  }

  function formatPrice(value) {
    const num = Number(value);
    return Number.isFinite(num) ? `$${num.toFixed(2)}` : "$0.00";
  }

function normalizeCategory(value) {
  return String(value || "").trim();
}

function getImagePath(product) {
  if (product.image) return product.image;

  const byKey = slugify(product.key);
  const byName = slugify(product.name);
  const byBrand = slugify(product.brand);

  if (byName) return `/img/icons/${byName}.png`;
  if (byKey) return `/img/icons/${byKey}.png`;
  if (byBrand) return `/img/icons/${byBrand}.png`;

  return "";
}

  function getProductQty(key) {
    const n = Number(state.qty[key] || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function setProductQty(key, value) {
    const next = Math.max(0, Number(value) || 0);

    if (next <= 0) {
      delete state.qty[key];
    } else {
      state.qty[key] = next;
    }

    writeQtyMap();
  }

  function getSelectedItems() {
    return state.allProducts.filter((p) => getProductQty(p.key) > 0);
  }

  function getSelectedCount() {
    return getSelectedItems().reduce((sum, p) => sum + getProductQty(p.key), 0);
  }

  function updateAddToBillLabel() {
    if (!addToBillBtn) return;
    const count = getSelectedCount();
    addToBillBtn.textContent = `Add to Bill (${count})`;
  }

  function updateFavoritesUI() {
    favoritesBtn?.classList.toggle("is-on", state.favoritesOnly);
  }

  function updateCartBadge() {
    if (window.cigarOSCart?.updateBadges) {
      window.cigarOSCart.updateBadges();
    }

    const badge = cartBadge || $("[data-cart-badge]");
    if (!badge) return;
  }

  function buildCategoryList(products) {
    const found = new Set(products.map((p) => normalizeCategory(p.category)).filter(Boolean));
    return CATEGORY_ORDER.filter((cat) => cat === "All" || found.has(cat));
  }

  function renderCategories() {
    if (!categoryRow) return;

    const cats = buildCategoryList(state.allProducts);

    categoryRow.innerHTML = cats.map((cat) => `
      <button
        class="pos-chip${state.activeCategory === cat ? " is-active" : ""}"
        type="button"
        data-cat="${escapeHTML(cat)}"
      >${escapeHTML(cat)}</button>
    `).join("");

    $$("[data-cat]", categoryRow).forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeCategory = btn.getAttribute("data-cat") || "All";
        renderCategories();
        renderProducts();
      });
    });
  }

  function getFilteredProducts() {
    let list = [...state.allProducts];

    if (state.activeCategory !== "All") {
      list = list.filter((p) => normalizeCategory(p.category) === state.activeCategory);
    }

    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((p) => {
        const hay = [
          p.name,
          p.brand,
          p.category,
          p.key
        ].join(" ").toLowerCase();

        return hay.includes(q);
      });
    }

    if (state.favoritesOnly) {
      list = list.filter((p) => state.favorites.has(p.key));
    }

    return list;
  }

  function addProductToCart(product, qty) {
    const cartApi = window.cigarOSCart;
    if (!cartApi || typeof cartApi.add !== "function") return;

    for (let i = 0; i < qty; i++) {
      cartApi.add({
        type: "product",
        id: product.key,
        key: product.key,
        brand: product.brand || "",
        line: "",
        name: product.name || "",
        vitola: "",
        price: Number(product.price) || 0,
        image: product.image || "",
        url: window.location.href,
        category: product.category || ""
      });
    }

    updateCartBadge();
  }

  function onIncrement(productKey) {
    setProductQty(productKey, getProductQty(productKey) + 1);
    renderProducts();
  }

  function onDecrement(productKey) {
    setProductQty(productKey, getProductQty(productKey) - 1);
    renderProducts();
  }

  function onToggleFavorite(productKey) {
    if (state.favorites.has(productKey)) state.favorites.delete(productKey);
    else state.favorites.add(productKey);

    writeSet(FAVORITES_KEY, state.favorites);
    renderProducts();
  }

  function renderProducts() {
    if (!grid) return;

    const filtered = getFilteredProducts();

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="products-empty" style="grid-column:1/-1;padding:20px 4px;color:var(--muted);font-weight:700;">
          No products found.
        </div>
      `;
      updateAddToBillLabel();
      return;
    }

    grid.innerHTML = filtered.map((p) => {
      const qty = getProductQty(p.key);
      const isFavorite = state.favorites.has(p.key);
      const imagePath = getImagePath(p);
      const showBrand = String(p.brand || "").trim().length > 0;

      return `
        <article class="product-card pos-card" data-key="${escapeHTML(p.key)}">
          <div class="product-card-media">
            ${
              imagePath
                ? `<img class="product-card-image" src="${escapeHTML(imagePath)}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('is-fallback');">`
                : ``
            }
            <div class="product-card-fallback${imagePath ? "" : " is-visible"}">
              ${escapeHTML((p.name || "?").slice(0, 1))}
            </div>

            <button
              class="product-favorite${isFavorite ? " is-on" : ""}"
              type="button"
              data-favorite="${escapeHTML(p.key)}"
              aria-label="Favorite ${escapeHTML(p.name)}"
            >★</button>
          </div>

          <div class="product-card-body">
            <div class="product-name">${escapeHTML(p.name || "—")}</div>
            <div class="product-brand">${showBrand ? escapeHTML(p.brand) : "&nbsp;"}</div>
            <div class="product-price">${escapeHTML(formatPrice(p.price))}</div>
          </div>

          <div class="product-card-footer">
            <div class="product-qty" aria-label="Quantity">
              <button type="button" class="qty-btn" data-minus="${escapeHTML(p.key)}">−</button>
              <span class="qty-value">${qty}</span>
              <button type="button" class="qty-btn" data-plus="${escapeHTML(p.key)}">+</button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    $$("[data-plus]", grid).forEach((btn) => {
      btn.addEventListener("click", () => {
        onIncrement(btn.getAttribute("data-plus") || "");
      });
    });

    $$("[data-minus]", grid).forEach((btn) => {
      btn.addEventListener("click", () => {
        onDecrement(btn.getAttribute("data-minus") || "");
      });
    });

    $$("[data-favorite]", grid).forEach((btn) => {
      btn.addEventListener("click", () => {
        onToggleFavorite(btn.getAttribute("data-favorite") || "");
      });
    });

    updateAddToBillLabel();
  }

  function bindStaticControls() {
    themeToggle?.addEventListener("click", () => {
      applyTheme(getSavedTheme() === "dark" ? "light" : "dark");
    });

    searchInput?.addEventListener("input", (e) => {
      state.search = String(e.target.value || "").trim();
      renderProducts();
    });

    favoritesBtn?.addEventListener("click", () => {
      state.favoritesOnly = !state.favoritesOnly;
      updateFavoritesUI();
      renderProducts();
    });

    filterBtn?.addEventListener("click", () => {
      filterBtn.classList.toggle("is-on");
    });

    addToBillBtn?.addEventListener("click", () => {
      const selected = getSelectedItems();

      if (!selected.length) return;

      selected.forEach((product) => {
        const qty = getProductQty(product.key);
        if (qty > 0) addProductToCart(product, qty);
      });

      state.qty = {};
      writeQtyMap();
      renderProducts();
    });
  }

  function normalizeProducts(raw) {
    return raw.map((p) => ({
      key: String(p.key || "").trim(),
      category: normalizeCategory(p.category),
      brand: String(p.brand || "").trim(),
      name: String(p.name || p.product || "").trim(),
      price: Number(p.price) || 0,
      type: "product",
      taxable: Boolean(p.taxable),
      image: String(p.image || "").trim(),
      inventory: Number(p.inventory) || 0,
      status: String(p.status || "Active").trim()
    })).filter((p) => p.key && p.name);
  }

  async function loadProducts() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load products.json: ${res.status}`);

      const raw = await res.json();
      state.allProducts = normalizeProducts(Array.isArray(raw) ? raw : []);

      renderCategories();
      updateFavoritesUI();
      renderProducts();
      updateCartBadge();
    } catch (err) {
      console.error("products.js load error:", err);
      if (grid) {
        grid.innerHTML = `
          <div class="products-empty" style="grid-column:1/-1;padding:20px 4px;color:#ff6b6b;font-weight:700;">
            Error loading products.
          </div>
        `;
      }
    }
  }

  function init() {
    applyTheme(getSavedTheme());
    bindStaticControls();
    loadProducts();
  }

  init();
})();
