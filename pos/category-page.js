/* /pos/category-page.js
   Universal POS category renderer (non-cigar categories)

   ✅ Reads from /pos/pos-products.json
   ✅ Detects category via:
      1) <body data-category="...">
      2) <h1 class="category-title">...</h1>
      3) URL segment fallback
   ✅ Renders into:
      <section class="category-grid" id="category-grid"></section>
      (also supports .category-grid without id)
   ✅ Tap ANYWHERE on a card adds to invoice (event delegation)
   ✅ Optional icon resolver:
      <body data-image-dir="/img/icons/foodandbevs">
      or defaults to /img/icons/<normalized-category>
*/

(() => {
  "use strict";

  const PRODUCTS_URL = "/pos/pos-products.json";

  const $ = (sel, root = document) => root.querySelector(sel);

  // Normalize strings for matching
  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

  const money = (n) => {
    const v = Number(n);
    if (!isFinite(v)) return "0.00";
    return v.toFixed(2);
  };

  const escapeHTML = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // -----------------------------
  // Category detection
  // -----------------------------
  function detectCategoryLabel() {
    const bodyCat = document.body?.dataset?.category;
    if (bodyCat && String(bodyCat).trim()) return String(bodyCat).trim();

    const h1 = $(".category-title");
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();

    const path = location.pathname.split("?")[0].replace(/\/+$/, "");
    const seg = path.split("/").filter(Boolean).pop() || "";
    if (seg) {
      if (seg === "foodandbevs") return "Food & Bevs";
      return seg.charAt(0).toUpperCase() + seg.slice(1);
    }

    return "Category";
  }

  function defaultImageDirFromCategory(categoryLabel) {
    // default: /img/icons/<normalized-category>
    // e.g. Food & Bevs -> /img/icons/foodandbevs
    return `/img/icons/${norm(categoryLabel)}`;
  }

  // -----------------------------
  // Icon resolving
  // -----------------------------
  const existsCache = new Map();

  async function urlExists(url) {
    if (existsCache.has(url)) return existsCache.get(url);

    let ok = false;
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      ok = res.ok;
    } catch (_) {
      ok = false;
    }

    // fallback for hosts that dislike HEAD
    if (!ok) {
      try {
        const res = await fetch(url, { method: "GET", cache: "no-store" });
        ok = res.ok;
      } catch (_) {
        ok = false;
      }
    }

    existsCache.set(url, ok);
    return ok;
  }

  function normalizeKey(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/[\s-]+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  async function resolveByKey(key, baseDir) {
    if (!baseDir) return "";
    const exts = ["svg", "png", "jpg", "jpeg", "webp"];
    for (const ext of exts) {
      const url = `${baseDir}/${key}.${ext}`;
      if (await urlExists(url)) return url;
    }
    return "";
  }

  async function resolveProductImage(item, imageDir) {
    // 1) direct image path from JSON if present
    const direct = String(item?.image ?? "").trim();
    if (direct) return direct;

    // 2) key-based hit
    const key = normalizeKey(item?.imgKey || item?.key || item?.name || item?.product || "");
    if (key) {
      const hit = await resolveByKey(key, imageDir);
      if (hit) return hit;
    }

    return "";
  }

  // -----------------------------
  // Rendering
  // -----------------------------
  function buildCard(item, categoryLabel) {
    const brand = String(item.brand ?? "").trim();
    const name = String(item.name ?? item.product ?? "Item").trim();
    const price = Number(item.price ?? 0);

    const card = document.createElement("article");
    card.className = "category-card";
    card.setAttribute("data-receipt-item", "");

    // data contract used by our click handler
    card.dataset.type = "product";
    card.dataset.category = categoryLabel;
    card.dataset.brand = brand;
    card.dataset.name = name;
    card.dataset.price = String(isFinite(price) ? price : 0);

    // icon resolver hint
    card.dataset.imgKey = normalizeKey(item.imgKey || item.key || name);

    card.innerHTML = `
      <div class="category-card-icon"></div>
      <div class="category-card-name">${escapeHTML(name)}</div>
      <div class="category-card-price">$${escapeHTML(money(price))}</div>
    `;

    return card;
  }

  function wireSearch(gridEl, inputEl) {
    if (!gridEl || !inputEl) return;

    inputEl.addEventListener("input", () => {
      const q = norm(inputEl.value);
      const cards = Array.from(gridEl.querySelectorAll(".category-card"));

      cards.forEach((card) => {
        const hay =
          norm(card.dataset.brand) + " " +
          norm(card.dataset.name) + " " +
          norm(card.dataset.category);
        card.style.display = !q || hay.includes(q) ? "" : "none";
      });
    });
  }

  function wireBack() {
    const backBtn = $("#category-back");
    if (!backBtn) return;
    backBtn.addEventListener("click", () => {
      window.location.href = "/pos/";
    });
  }

  // ✅ ONE universal add-to-invoice handler (event delegation)
  function wireAddToInvoice(gridEl) {
    if (!gridEl) return;

    gridEl.addEventListener("click", (e) => {
      const card = e.target.closest?.(".category-card[data-receipt-item]");
      if (!card) return;

      // cart.js defines window.CigarOSCart
      if (!window.CigarOSCart || typeof window.CigarOSCart.add !== "function") {
        console.warn("CigarOSCart not ready yet");
        return;
      }

      const type = (card.dataset.type || "product").toLowerCase();
      const category = card.dataset.category || "Product";
      const brand = card.dataset.brand || "";
      const name = card.dataset.name || "Item";
      const price = Number(card.dataset.price || "0");

      const id = (category + "|" + brand + "|" + name).toLowerCase();

      window.CigarOSCart.add({
        id,
        type,
        category,
        brand,
        name,
        price,
        img: "",
        link: "",
        sub: ""
      });
    });
  }

  async function applyIcons(gridEl, itemsByKey, imageDir) {
    const cards = Array.from(gridEl.querySelectorAll(".category-card"));
    await Promise.all(cards.map(async (card) => {
      const iconBox = card.querySelector(".category-card-icon");
      if (!iconBox) return;

      const key = card.dataset.imgKey || "";
      const item = itemsByKey.get(key) || null;
      if (!item) return;

      const src = await resolveProductImage(item, imageDir);

      iconBox.innerHTML = "";
      if (!src) return;

      const img = document.createElement("img");
      img.alt = item?.name || item?.product || "Product";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = src;

      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
      img.style.display = "block";

      iconBox.appendChild(img);
    }));
  }

  async function init() {
    wireBack();

    const gridEl =
      $("#category-grid") ||
      $(".category-grid");

    const searchEl = $(".category-search-input");

    if (!gridEl) return;

    const categoryLabel = detectCategoryLabel();
    const categoryKey = norm(categoryLabel);

    // image directory: body override OR default mapping
    const imageDir =
      String(document.body?.dataset?.imageDir || "").trim() ||
      defaultImageDirFromCategory(categoryLabel);

    // Fetch master products
    const res = await fetch(PRODUCTS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load products (${res.status})`);

    const all = await res.json();
    const items = Array.isArray(all) ? all : [];

    // Filter by category
    const filtered = items.filter((it) => norm(it.category) === categoryKey);

    // Render
    gridEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    // Key map for icon lookup
    const itemsByKey = new Map();

    filtered.forEach((it) => {
      const card = buildCard(it, categoryLabel);
      frag.appendChild(card);

      const k = normalizeKey(it.imgKey || it.key || it.name || it.product || "");
      if (k && !itemsByKey.has(k)) itemsByKey.set(k, it);
    });

    gridEl.appendChild(frag);

    // ✅ ONE click handler for everything inside the grid
    wireAddToInvoice(gridEl);

    // Search
    wireSearch(gridEl, searchEl);

    // Icons
    await applyIcons(gridEl, itemsByKey, imageDir);
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error(err);
    });
  });
})();
