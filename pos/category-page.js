/* /pos/category-page.js
   Universal POS category renderer (non-cigar categories) — UPDATED

   ✅ Reads from /pos/pos-products.json
   ✅ Detects category via:
      1) <body data-category="...">
      2) <h1 class="category-title">...</h1>
      3) URL segment fallback (/pos/accessories/, /pos/foodandbevs/, etc.)
   ✅ Renders into:
      <section class="category-grid" id="category-grid"></section>
      (also supports .category-grid without id)
   ✅ Adds to cart using /pos/cart.js (event delegation via data-cart-add)
   ✅ Injects Cigars-style invoice receipt icon (top-right)
   ✅ Option A: forces invoice navigation to /pos/invoice/ (NOT invoice.html)
*/

(() => {
  "use strict";

  const PRODUCTS_URL = "/pos/pos-products.json";

  const $ = (sel, root = document) => root.querySelector(sel);

  // ---------- utils ----------
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

  function parsePrice(p) {
    if (p == null) return 0;
    if (typeof p === "number") return p;
    const s = String(p);
    const m = s.match(/([0-9]+(?:\.[0-9]{1,2})?)/);
    return m ? Number(m[1]) : 0;
  }

  // ---------- category detection ----------
  function urlSlug() {
    const path = location.pathname.split("?")[0].replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    const i = parts.indexOf("pos");
    const seg = i >= 0 ? (parts[i + 1] || "") : (parts[parts.length - 1] || "");
    return String(seg || "").toLowerCase();
  }

  function prettyCategoryFromSlug(slug) {
    if (!slug) return "Category";
    if (slug === "foodandbevs") return "Food & Bevs";
    if (slug === "foodandbev") return "Food & Bevs";
    if (slug === "food") return "Food & Bevs";
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  function detectCategoryLabel() {
    const bodyCat = document.body?.dataset?.category;
    if (bodyCat && String(bodyCat).trim()) return String(bodyCat).trim();

    const h1 = $(".category-title");
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();

    return prettyCategoryFromSlug(urlSlug());
  }

  function categoryMatches(categoryLabel, itemCategory) {
    const want = norm(categoryLabel);
    const got = norm(itemCategory);

    if (!want || !got) return false;

    // Robust matching for Food & Bevs variants
    if (want === "foodandbevs") {
      return got.includes("food") || got.includes("bev");
    }

    // Robust matching for Accessories variants
    if (want === "accessories") {
      return got.includes("accessor");
    }

    // Robust matching for Packs
    if (want === "packs") {
      return got.includes("pack");
    }

    // Robust matching for Pipes
    if (want === "pipes") {
      return got.includes("pipe");
    }

    // Robust matching for Ashtrays
    if (want === "ashtrays") {
      return got.includes("ash");
    }

    // Default: contains match (not strict equality)
    return got.includes(want);
  }

  // ---------- invoice icon injection (Cigars-style receipt icon) ----------
  function injectInvoiceIcon() {
    // Remove any old invoice pill button if present
    document.querySelectorAll(".invoice-pill, .pos-invoice-pill, .invoiceButton, .invoice-btn").forEach((el) => {
      el.remove();
    });

    // If already present, do nothing
    if (document.querySelector(".pos-invoice-icon")) return;

    // Try common header containers used on category pages
    const header =
      document.querySelector(".category-topbar") ||
      document.querySelector(".pos-topbar") ||
      document.querySelector("header") ||
      null;

    // If there's no header, we can't safely place it
    if (!header) return;

    // Place inside a right-side container if possible
    const right =
      header.querySelector(".category-actions") ||
      header.querySelector(".pos-actions") ||
      header;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pos-invoice-icon";
    btn.setAttribute("aria-label", "Invoice");
    btn.setAttribute("data-invoice-btn", "true");

    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M6 2h12a2 2 0 0 1 2 2v18l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V4a2 2 0 0 1 2-2Zm2 6h8V6H8v2Zm0 4h8v-2H8v2Zm0 4h6v-2H8v2Z"/>
      </svg>
      <span class="pos-invoice-badge" data-cart-badge>0</span>
    `;

    // Insert at the end so it becomes "top-right"
    right.appendChild(btn);

    // Force Option A navigation target
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "/pos/invoice/";
    });
  }

  // ---------- icon resolving (keep your existing logic) ----------
  function defaultImageDirFromCategory(categoryLabel) {
    return `/img/icons/${norm(categoryLabel)}`;
  }

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
    const direct = String(item?.image ?? item?.img ?? "").trim();
    if (direct) return direct;

    const key = normalizeKey(item?.imgKey || item?.key || item?.name || item?.product || "");
    if (key) {
      const hit = await resolveByKey(key, imageDir);
      if (hit) return hit;
    }
    return "";
  }

  // ---------- rendering ----------
  function buildCard(item, categoryLabel) {
    const brand = String(item.brand ?? "").trim();
    const name = String(item.name ?? item.product ?? "Item").trim();
    const price = parsePrice(item.msrp ?? item.price ?? 0);

    const card = document.createElement("article");
    card.className = "category-card";

    // IMPORTANT: Use data-cart-add so /pos/cart.js can add it.
    card.setAttribute("data-cart-add", "true");

    // Data contract for cart.js (it reads dataset)
    card.dataset.type = "other";
    card.dataset.category = categoryLabel;
    card.dataset.brand = brand;
    card.dataset.name = name;
    card.dataset.msrp = String(isFinite(price) ? price : 0);

    // icon resolver hint
    card.dataset.imgKey = normalizeKey(item.imgKey || item.key || name);

    card.innerHTML = `
      <div class="category-card-icon"></div>
      <div class="category-card-name">${escapeHTML(name)}</div>
      <div class="category-card-price">$${escapeHTML(money(price))}</div>
      <button class="category-card-add" type="button" aria-label="Add" data-cart-add="true"
        data-type="other"
        data-category="${escapeHTML(categoryLabel)}"
        data-brand="${escapeHTML(brand)}"
        data-name="${escapeHTML(name)}"
        data-msrp="${String(isFinite(price) ? price : 0)}"
      >+</button>
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

  // Ensure any invoice anchors on the page use Option A route
  function forceInvoiceLinks() {
    document.querySelectorAll("a[href*='invoice']").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (href.includes("invoice.html")) a.setAttribute("href", "/pos/invoice/");
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
    forceInvoiceLinks();
    injectInvoiceIcon();

    const gridEl =
      $("#category-grid") ||
      $(".category-grid");

    const searchEl = $(".category-search-input") || $("input[type='search']");

    if (!gridEl) return;

    const categoryLabel = detectCategoryLabel();

    // image directory: body override OR default mapping
    const imageDir =
      String(document.body?.dataset?.imageDir || "").trim() ||
      defaultImageDirFromCategory(categoryLabel);

    // Fetch products
    const res = await fetch(PRODUCTS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load products (${res.status})`);

    const all = await res.json();
    const items = Array.isArray(all) ? all : (all.products || all.items || []);
    if (!Array.isArray(items)) return;

    // Filter by category (robust)
    const filtered = items.filter((it) =>
      categoryMatches(categoryLabel, it.category || it.Category || it.type || it.Type)
    );

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

    // Search
    wireSearch(gridEl, searchEl);

    // Icons
    await applyIcons(gridEl, itemsByKey, imageDir);

    // Re-ensure invoice icon exists after rendering
    injectInvoiceIcon();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => console.error(err));
  });
})();
