/* /pos/foodandbevs.js
   Food & Bevs page (LIVE from /pos/pos-products.json)

   ✅ Renders a category grid
   ✅ Icons from: /img/icons/foodandbevs/<slug>.svg (fallback to png/jpg if present)
   ✅ Tap anywhere on a card adds to invoice (via cart.js back-compat [data-receipt-item])
*/

(() => {
  "use strict";

  const DATA_URL = "/pos/pos-products.json";
  const CATEGORY_NAME = "Food & Bevs";
  const ICON_BASE = "/img/icons/foodandbevs/";

  const $ = (sel, root = document) => root.querySelector(sel);

  const grid = $("#grid");
  if (!grid) {
    console.error("[foodandbevs.js] Missing #grid");
    return;
  }

  grid.innerHTML = `<div style="padding:16px;font-weight:800;">Loading…</div>`;

  const money = (n) => `$${Number(n || 0).toFixed(2)}`;

  const slugify = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

  // Try svg first, then png/jpg if your folder has them
  function setIcon(imgEl, slug) {
    const svg = `${ICON_BASE}${slug}.svg`;
    const png = `${ICON_BASE}${slug}.png`;
    const jpg = `${ICON_BASE}${slug}.jpg`;

    imgEl.src = svg;

    imgEl.onerror = () => {
      // swap to png, then jpg, then show nothing (but keep layout)
      if (imgEl.src.endsWith(".svg")) {
        imgEl.src = png;
        return;
      }
      if (imgEl.src.endsWith(".png")) {
        imgEl.src = jpg;
        return;
      }
      imgEl.onerror = null;
      imgEl.style.opacity = "0"; // don't collapse the box; just hide image
    };
  }

  function showError(err) {
    const msg = (err && err.message) ? err.message : String(err);
    grid.innerHTML = `
      <div style="padding:16px;color:#b00020;font-weight:900;">
        Food &amp; Bevs failed to load
      </div>
      <pre style="padding:16px;white-space:pre-wrap;word-break:break-word;background:#fff3f3;border-radius:12px;margin:0 12px 12px;">${msg}</pre>
      <div style="padding:0 16px 16px;opacity:.8;">
        Check <code>${DATA_URL}</code> and confirm this page loads <code>/pos/foodandbevs.js</code>.
      </div>
    `;
  }

  async function loadItems() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${DATA_URL} (${res.status})`);

    const all = await res.json();
    if (!Array.isArray(all)) throw new Error("pos-products.json is not an array");

    const items = all
      .filter(p => String(p.category || "").toLowerCase() === CATEGORY_NAME.toLowerCase())
      .map(p => {
        const name = p.product || p.name || "Item";
        const price = Number(p.price || 0);

        return {
          category: p.category || CATEGORY_NAME,
          brand: p.brand || "",
          name,
          price,
          slug: slugify(name)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!items.length) {
      throw new Error(`No items found where category == "${CATEGORY_NAME}". Check JSON category values.`);
    }

    return items;
  }

  function render(items) {
    const frag = document.createDocumentFragment();

    for (const item of items) {
      // Use the SAME visual layout you already have (category.css)
      // but make the whole card a [data-receipt-item] tap target
      const card = document.createElement("article");
      card.className = "category-card";
      card.setAttribute("data-receipt-item", "");

      // These are the ONLY fields your new cart.js needs to add
      card.dataset.type = "product";
      card.dataset.category = item.category;
      card.dataset.brand = item.brand;
      card.dataset.name = item.name;
      card.dataset.price = String(item.price);

      // Icon box (same as Accessories)
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
      frag.appendChild(card);
    }

    grid.innerHTML = "";
    grid.appendChild(frag);
  }

  async function init() {
    try {
      const items = await loadItems();
      render(items);
      console.log(`[foodandbevs.js] Rendered ${items.length} items`);
      // NOTE: no click handler needed here.
      // Your new cart.js listens for clicks on [data-receipt-item] with dataset fields.
    } catch (err) {
      console.error(err);
      showError(err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
