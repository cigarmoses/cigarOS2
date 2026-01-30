/* /pos/category-page.js
   Universal POS category renderer (non-cigar categories)
   - Reads from /pos/pos-products.json
   - Filters by category (from <body data-category="..."> OR <h1> text OR URL path)
   - Renders cards in the same layout as your Accessories page
   - Keeps cart.js untouched (uses window.CigarOSCart.add)
   - Optional image resolving via <body data-image-dir="/img/lighters">
*/

(() => {
  "use strict";

  const PRODUCTS_URL = "/pos/pos-products.json";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Normalize for category matching (Food & Bevs vs Food and Bevs, etc.)
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

  // ---------------------------------------
  // Category detection
  // ---------------------------------------
  function detectCategory() {
    // 1) explicit body dataset
    const bodyCat = document.body?.dataset?.category;
    if (bodyCat && String(bodyCat).trim()) return String(bodyCat).trim();

    // 2) title text (your pages use .category-title)
    const h1 = $(".category-title");
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();

    // 3) URL segment fallback: /pos/foodandbevs/ => "foodandbevs"
    const path = location.pathname.split("?")[0].replace(/\/+$/, "");
    const seg = path.split("/").filter(Boolean).pop() || "";
    if (seg) {
      if (seg === "foodandbevs") return "Food & Bevs";
      return seg.charAt(0).toUpperCase() + seg.slice(1);
    }

    return "Category";
  }

  // ---------------------------------------
  // Image resolving (optional)
  // ---------------------------------------
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

    // Some hosts don’t like HEAD; fallback to GET
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
    // 1) If JSON has a direct image URL/path, use it
    const direct = String(item?.image ?? "").trim();
    if (direct) return direct;

    // 2) If you store an img key in JSON (optional), try that
    const key1 = normalizeKey(item?.imgKey || item?.key || "");
    if (key1) {
      const hit = await resolveByKey(key1, imageDir);
      if (hit) return hit;
    }

    // 3) fallback: normalized product name
    const nameKey = normalizeKey(item?.name || item?.product || "");
    if (nameKey) {
      const hit = await resolveByKey(nameKey, imageDir);
      if (hit) return hit;
    }

    return "";
  }

  // ---------------------------------------
  // Rendering
  // ---------------------------------------
  function buildCard(item, categoryLabel) {
    const brand = String(item.brand ?? "").trim();
    const product = String(item.product ?? item.name ?? "Item").trim();
    const name = String(item.name ?? product).trim();

    const price = Number(item.price ?? 0);

    const displayName = product;
    const displayPrice = `$${money(price)}`;

    const card = document.createElement("article");
    card.className = "category-card";
    card.setAttribute("data-receipt-item", "");

    // Minimal dataset contract for cart.js / your add logic
    card.dataset.type = "product";
    card.dataset.category = categoryLabel;
    card.dataset.brand = brand;
    card.dataset.name = name;
    card.dataset.price = String(isFinite(price) ? price : 0);

    // Image hints (optional)
    card.dataset.imgKey = normalizeKey(item.imgKey || name || product);

    card.innerHTML = `
      <div class="category-card-icon"></div>
      <div class="category-card-name">${escapeHTML(displayName)}</div>
      <div class="category-card-price">${escapeHTML(displayPrice)}</div>
    `;

    return card;
  }

  function attachCartTap(card) {
    card.addEventListener("click", () => {
      if (!window.CigarOSCart || typeof window.CigarOSCart.add !== "function") return;

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

  async function applyIcons(cards, itemsByCard, imageDir) {
    await Promise.all(
      cards.map(async (card) => {
        const iconBox = card.querySelector(".category-card-icon");
        if (!iconBox) return;

        const item = itemsByCard.get(card);
        const src = await resolveProductImage(item, imageDir);

        iconBox.innerHTML = "";
        if (!src) return;

        // contain behavior like your Accessories page
        iconBox.style.display = "grid";
        iconBox.style.placeItems = "center";
        iconBox.style.overflow = "hidden";

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
      })
    );
  }

  function wireSearch(gridEl, inputEl) {
    if (!gridEl || !inputEl) return;

    inputEl.addEventListener("input", () => {
      const q = norm(inputEl.value);
      const cards = $$(".category-card", gridEl);

      cards.forEach((card) => {
        const hay =
          norm(card.dataset.brand) +
          " " +
          norm(card.dataset.name) +
          " " +
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

  // ---------------------------------------
  // Main
  // ---------------------------------------
  async function init() {
    wireBack();

    const gridEl = $(".category-grid");
    const searchEl = $(".category-search-input");
    if (!gridEl) return;

    const categoryLabel = detectCategory();
    const categoryKey = norm(categoryLabel);

    // Image directory can be set per page:
    // <body data-image-dir="/img/lighters">
    const imageDir = String(document.body?.dataset?.imageDir || "").trim();

    // Fetch master products
    const res = await fetch(PRODUCTS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load products (${res.status})`);

    const all = await res.json();
    const items = Array.isArray(all) ? all : [];

    // Filter by category
    const filtered = items.filter((it) => norm(it.category) === categoryKey);

    // Render
    gridEl.innerHTML = "";
    const itemsByCard = new Map();
    const frag = document.createDocumentFragment();

    filtered.forEach((it) => {
      const card = buildCard(it, categoryLabel);
      attachCartTap(card);
      itemsByCard.set(card, it);
      frag.appendChild(card);
    });

    gridEl.appendChild(frag);

    // Search
    wireSearch(gridEl, searchEl);

    // Icons (optional)
    if (imageDir) {
      const cards = $$(".category-card", gridEl);
      await applyIcons(cards, itemsByCard, imageDir);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error(err);
    });
  });
})();
