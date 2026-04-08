/* /pos/products/products.js
   Products page
   - Loads /pos/products/products.json
   - Live cart qty controls
   - Favorites toggle
   - Search + category filtering
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

  const PRODUCT_IMAGE_OVERRIDES = {
    ashtraysopusx20thanniversaryashtrayopusx: ["/img/icons/ashtrays/opusx20thanniversaryashtray.jpg"],
    ashtraysrockypatelluxuryluminosoashtrayrockypatel: ["/img/icons/ashtrays/rockypatelluxuryluminosoashtray.jpg"],
    cutterslotuscyclopspunchlotus: ["/img/icons/cutters/lotuscyclopspunch.png"],
    cuttersstdupontcutterstandslimgoldstdupont: ["/img/icons/cutters/stdupontcutterstandslimgold.svg"],
    lighterseliebleuopusxangelssharelightereliebleu: ["/img/icons/lighters/elliebleuopusxangelssharelighter.png"],
    lighterseliebleuopusxhemingwaylightereliebleu: ["/img/icons/lighters/elliebleuopusxhemingwaylighter.png"],
    lightersexcaliburdoubletorchvcutterlighter: ["/img/icons/lighters/excaliburdoubletorchvcutlighter.png"],
    lightersstdupontligne1guillochelightergoldstdupont: ["/img/icons/lighters/stdupontligne1guillochelightergold.svg"],
    lightersstdupontslim7lacqueredsnakelighterstdupont: ["/img/icons/lighters/slim7lacqueredsnakelighter.png"],
    lightersvertigoboxertripletorchvertigo: ["/img/icons/lighters/vertigoboxertripletorch.png"],
    lightersvertigocyclonetripletorchvertigo: ["/img/icons/lighters/vertigocyclonetripletorch.png"],
    lightersvertigodaggerdoublejetvertigo: ["/img/icons/lighters/vertigodaggerdoublejet.png"],
    packspadronfamilyreservepackpadron: [
      "/img/icons/packs/padronfamilyreservepack.svg",
      "/img/icons/packs/padronfamilyreservepack.png",
      "/img/icons/packs/padronfamilyreservepack.jpg"
    ],
    packsperdomofreshpackchampagneperdomo: ["/img/icons/packs/perdomofreshpackchampagne.png"],
    packsperdomofreshpackmaduroperdomo: ["/img/icons/packs/perdomofreshpackmaduro.png"],
    packssharkpackarturofuente: ["/img/icons/packs/sharkpack.jpg"],
    pipesmrconsulpipe: ["/img/icons/pipes/mrconsulpipe.svg"],
    pipespipetobacco: ["/img/icons/pipes/pipetobacco.svg"]
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const categoryRow = $("#categoryRow");
  const searchInput = $("#searchInput");
  const grid = $("#productGrid");
  const filterBtn = $("#filterBtn");

  const state = {
    allProducts: [],
    activeCategory: "All",
    search: "",
    favorites: readSet(FAVORITES_KEY)
  };

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

  function formatPrice(value) {
    const num = Number(value);
    return Number.isFinite(num) ? `$${num.toFixed(2)}` : "$0.00";
  }

  function normalizeCategory(value) {
    return String(value || "").trim();
  }

  function getCategoryFolder(category) {
    const cat = String(category || "").trim().toLowerCase();
    if (cat === "alcohol") return "alcohol";
    if (cat === "ashtrays") return "ashtrays";
    if (cat === "cutters") return "cutters";
    if (cat === "drinks") return "drinks";
    if (cat === "food") return "food";
    if (cat === "lighters") return "lighters";
    if (cat === "packs") return "packs";
    if (cat === "pipes") return "pipes";
    return "";
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function getImageCandidates(product) {
    const key = String(product.key || "").trim();
    if (PRODUCT_IMAGE_OVERRIDES[key]) return PRODUCT_IMAGE_OVERRIDES[key];
    if (product.image) return [product.image];
    if (product.brandIcon) return [product.brandIcon];

    const folder = getCategoryFolder(product.category);
    const fileName = slugify(product.name);
    if (!folder || !fileName) return [];

    return unique([
      `/img/icons/${folder}/${fileName}.svg`,
      `/img/icons/${folder}/${fileName}.png`,
      `/img/icons/${folder}/${fileName}.jpg`,
      `/icons/${folder}/${fileName}.svg`,
      `/icons/${folder}/${fileName}.png`,
      `/icons/${folder}/${fileName}.jpg`
    ]);
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
        const hay = [p.name, p.brand, p.category, p.key].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }

    return list;
  }

  function getLiveQty(product) {
    return window.cigarOSCart?.getItemQty?.(product.key) || 0;
  }

  function setLiveQty(product, qty) {
    if (!window.cigarOSCart?.setQty) return;

    const imageCandidates = getImageCandidates(product);
    const image = imageCandidates[0] || "";

    window.cigarOSCart.setQty({
      key: product.key,
      type: "product",
      id: product.key,
      brand: product.brand || "",
      line: "",
      name: product.name || "",
      vitola: "",
      msrp: Number(product.price) || 0,
      image,
      url: window.location.href,
      category: product.category || ""
    }, qty);

    renderProducts();
  }

  function onIncrement(productKey) {
    const product = state.allProducts.find((p) => p.key === productKey);
    if (!product) return;
    setLiveQty(product, getLiveQty(product) + 1);
  }

  function onDecrement(productKey) {
    const product = state.allProducts.find((p) => p.key === productKey);
    if (!product) return;
    setLiveQty(product, Math.max(0, getLiveQty(product) - 1));
  }

  function onToggleFavorite(productKey) {
    if (state.favorites.has(productKey)) state.favorites.delete(productKey);
    else state.favorites.add(productKey);

    writeSet(FAVORITES_KEY, state.favorites);
    renderProducts();
  }

  function attachImageFallbacks() {
    $$("[data-image-candidates]", grid).forEach((img) => {
      const candidates = (img.getAttribute("data-image-candidates") || "").split("|").filter(Boolean);
      if (!candidates.length) return;

      let index = 0;

      const setSrc = () => {
        if (index >= candidates.length) {
          img.style.display = "none";
          img.parentElement?.classList.add("is-fallback");
          return;
        }
        img.src = candidates[index];
      };

      img.addEventListener("error", () => {
        index += 1;
        setSrc();
      });

      setSrc();
    });
  }

  function renderProducts() {
    if (!grid) return;

    const filtered = getFilteredProducts();

    if (!filtered.length) {
      grid.innerHTML = `<div class="products-empty">No products found.</div>`;
      return;
    }

    grid.innerHTML = filtered.map((p) => {
      const qty = getLiveQty(p);
      const isFavorite = state.favorites.has(p.key);
      const imageCandidates = getImageCandidates(p);
      const encodedCandidates = imageCandidates.map(escapeHTML).join("|");
      const showBrand = String(p.brand || "").trim().length > 0;

      return `
        <article class="product-card" data-key="${escapeHTML(p.key)}">
          <div class="product-card-media">
            ${
              imageCandidates.length
                ? `<img class="product-card-image" data-image-candidates="${encodedCandidates}" alt="${escapeHTML(p.name)}" loading="lazy">`
                : ``
            }

            <div class="product-card-fallback${imageCandidates.length ? "" : " is-visible"}">
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
      btn.addEventListener("click", () => onIncrement(btn.getAttribute("data-plus") || ""));
    });

    $$("[data-minus]", grid).forEach((btn) => {
      btn.addEventListener("click", () => onDecrement(btn.getAttribute("data-minus") || ""));
    });

    $$("[data-favorite]", grid).forEach((btn) => {
      btn.addEventListener("click", () => onToggleFavorite(btn.getAttribute("data-favorite") || ""));
    });

    attachImageFallbacks();
  }

  function bindStaticControls() {
    searchInput?.addEventListener("input", (e) => {
      state.search = String(e.target.value || "").trim();
      renderProducts();
    });

    filterBtn?.addEventListener("click", () => {
      filterBtn.classList.toggle("is-on");
    });

    window.addEventListener("cigaros:cart", () => {
      renderProducts();
    });

    document.addEventListener("cigaros:cart-changed", () => {
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
      brandIcon: String(p.brandIcon || "").trim(),
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
      renderProducts();
    } catch (err) {
      console.error("products.js load error:", err);
      if (grid) {
        grid.innerHTML = `<div class="products-empty" style="color:#ff3b30;">Error loading products.</div>`;
      }
    }
  }

  function init() {
    bindStaticControls();
    loadProducts();
  }

  init();
})();
