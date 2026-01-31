/* /pos/foodandbevs.js
   Food & Bevs page (LIVE from /pos/pos-products.json)

   ✅ Renders cards into #grid
   ✅ Tap card adds to cart (cart.js listens to [data-receipt-item] + dataset fields)
   ✅ Search filters cards
   ✅ Shows on-screen errors if data fetch/category mismatch happens
*/

(() => {
  "use strict";

  const DATA_URL = "/pos/pos-products.json";
  const CATEGORY_NAME = "Food & Bevs";
  const ICON_BASE = "/img/icons/foodandbevs/";

  const $ = (sel, root = document) => root.querySelector(sel);

  const grid = $("#grid");
  const search = $("#search");

  if (!grid) {
    console.error("[foodandbevs.js] Missing #grid");
    return;
  }

  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");

  const money = (n) => `$${Number(n || 0).toFixed(2)}`;

  const slugify = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  function showError(title, detail) {
    grid.innerHTML = `
      <div style="padding:16px;color:#b00020;font-weight:900;">${title}</div>
      <pre style="margin:0 12px 12px;padding:12px;background:#fff3f3;border-radius:12px;white-space:pre-wrap;word-break:break-word;">${detail}</pre>
      <div style="padding:0 16px 16px;opacity:.8;">
        Check that <code>${DATA_URL}</code> loads in a browser and returns a JSON array.
      </div>
    `;
  }

  function setIcon(imgEl, slug) {
    const svg = `${ICON_BASE}${slug}.svg`;
    const png = `${ICON_BASE}${slug}.png`;
    const jpg = `${ICON_BASE}${slug}.jpg`;
    const jpeg = `${ICON_BASE}${slug}.jpeg`;
    const webp = `${ICON_BASE}${slug}.webp`;

    imgEl.src = svg;

    imgEl.onerror = () => {
      const src = imgEl.getAttribute("src") || "";
      if (src.endsWith(".svg")) { imgEl.src = png; return; }
      if (src.endsWith(".png")) { imgEl.src = jpg; return; }
      if (src.endsWith(".jpg")) { imgEl.src = jpeg; return; }
      if (src.endsWith(".jpeg")) { imgEl.src = webp; return; }
      imgEl.onerror = null;
      imgEl.style.opacity = "0";
    };
  }

  function buildCard(item) {
    const card = document.createElement("article");
    card.className = "category-card";
    card.setAttribute("data-receipt-item", "");

    // These dataset fields are what cart.js requires
    card.dataset.type = "product";
    card.dataset.category = item.category;
    card.dataset.brand = item.brand;
    card.dataset.name = item.name;
    card.dataset.price = String(item.price);

    const icon = document.createElement("div");
    icon.className = "category-card-icon";
    icon.style.display = "grid";
    icon.style.placeItems = "center";
    icon.style.overflow = "hidden";

    const img = document.createElement("img");
    img.alt = item.name;
    img.loading = "lazy";
    img.decoding = "async";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.display = "block";
    setIcon(img, item.slug);

    icon.appendChild(img);

    const name = document.createElement("div");
    name.className = "category-card-name";
    name.textContent = item.name;

    const price = document.createElement("div");
    price.className = "category-card-price";
    price.textContent = money(item.price);

    card.append(icon, name, price);
    return card;
  }

  function wireSearch() {
    if (!search) return;

    search.addEventListener("input", () => {
      const q = norm(search.value);
      const cards = Array.from(grid.querySelectorAll(".category-card"));

      cards.forEach((card) => {
        const hay = norm(card.dataset.name) + " " + norm(card.dataset.brand) + " " + norm(card.dataset.category);
        card.style.display = !q || hay.includes(q) ? "" : "none";
      });
    });
  }

  async function loadItems() {
    let res;
    try {
      res = await fetch(DATA_URL, { cache: "no-store" });
    } catch (e) {
      throw new Error(`Network error fetching ${DATA_URL}\n${e?.message || e}`);
    }

    if (!res.ok) {
      throw new Error(`Fetch failed: ${DATA_URL} (${res.status})`);
    }

    let all;
    try {
      all = await res.json();
    } catch (e) {
      throw new Error(`Invalid JSON at ${DATA_URL}\n${e?.message || e}`);
    }

    if (!Array.isArray(all)) {
      throw new Error(`pos-products.json must be an ARRAY. Got: ${typeof all}`);
    }

    const want = norm(CATEGORY_NAME);

    const items = all
      .filter(p => norm(p.category) === want)
      .map(p => {
        const name = String(p.product || p.name || "Item").trim();
        return {
          category: String(p.category || CATEGORY_NAME).trim(),
          brand: String(p.brand || "").trim(),
          name,
          price: Number(p.price || 0),
          slug: slugify(name)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { items, total: all.length };
  }

  function render(items) {
    const frag = document.createDocumentFragment();
    items.forEach((it) => frag.appendChild(buildCard(it)));
    grid.innerHTML = "";
    grid.appendChild(frag);
  }

  async function init() {
    grid.innerHTML = `<div style="padding:16px;font-weight:900;">Loading…</div>`;

    try {
      const { items, total } = await loadItems();

      if (!items.length) {
        showError(
          "No Food & Bevs items found",
          `Loaded ${total} total products but 0 matched category "${CATEGORY_NAME}".\n\nFix: Ensure pos-products.json has category exactly like Food & Bevs (or Food and Bevs).\nThis script normalizes both, so if it still shows 0, your category is something else.`
        );
        return;
      }

      render(items);
      wireSearch();
      console.log(`[foodandbevs.js] Rendered ${items.length} items`);
    } catch (err) {
      console.error(err);
      showError("Food & Bevs failed to load", err?.message || String(err));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
