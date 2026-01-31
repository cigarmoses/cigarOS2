 /* /pos/foodandbevs.js
   Food & Bevs page (LIVE from /pos/pos-products.json)

   ✅ Renders tiles into #grid
   ✅ Icon resolver: .svg → .png → .jpg → .jpeg → .webp
   ✅ Tap ANYWHERE on a tile adds to cart and updates badge
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

  const slugify = (s) => String(s || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

  function buildIconImg(name, slug) {
    const exts = ["svg", "png", "jpg", "jpeg", "webp"];
    let i = 0;

    const img = document.createElement("img");
    img.alt = name;

    const tryNext = () => {
      if (i >= exts.length) {
        img.remove(); // no icon found
        return;
      }
      img.src = `${ICON_BASE}${slug}.${exts[i++]}`;
    };

    img.onerror = () => tryNext();
    tryNext();
    return img;
  }

  async function loadItems() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${DATA_URL} (${res.status})`);

    const all = await res.json();
    if (!Array.isArray(all)) throw new Error("pos-products.json is not an array");

    const items = all
      .filter(p => String(p.category || "").toLowerCase() === CATEGORY_NAME.toLowerCase())
      .map(p => {
        const name = p.product || p.name || p.brand || "Item";
        return {
          key: p.key || `${CATEGORY_NAME}:${name}:${p.price}`,
          category: p.category || CATEGORY_NAME,
          brand: p.brand || "",
          name,
          sub: p.variant || "",
          price: Number(p.price || 0),
          slug: slugify(name)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!items.length) {
      throw new Error(`No items found where category == "${CATEGORY_NAME}". Check JSON category values.`);
    }
    return items;
  }

  function addToCart(item) {
    if (!window.CigarOSCart || typeof window.CigarOSCart.add !== "function") {
      console.warn("CigarOSCart not ready yet");
      return;
    }

    const id = (item.category + "|" + item.brand + "|" + item.name).toLowerCase();

    window.CigarOSCart.add({
      id,
      type: "product",
      category: item.category,
      brand: item.brand,
      name: item.name,
      sub: item.sub || "",
      price: item.price,
      img: "",
      link: ""
    });
  }

  function render(items) {
    const frag = document.createDocumentFragment();

    for (const item of items) {
      const tile = document.createElement("div");
      tile.className = "food-tile";
      tile.dataset.key = item.key;

      const btn = document.createElement("button");
      btn.className = "food-tile__btn";
      btn.type = "button";

      const img = buildIconImg(item.name, item.slug);
      if (img) btn.appendChild(img);

      const label = document.createElement("div");
      label.className = "food-tile__label";
      label.textContent = item.name;

      const price = document.createElement("div");
      price.className = "food-tile__price";
      price.textContent = money(item.price);

      tile.append(btn, label, price);
      frag.appendChild(tile);
    }

    grid.innerHTML = "";
    grid.appendChild(frag);

    // ONE handler: tap anywhere on tile
    grid.addEventListener("click", (e) => {
      const tile = e.target.closest(".food-tile");
      if (!tile) return;

      const key = tile.dataset.key;
      const item = items.find(x => x.key === key);
      if (!item) return;

      addToCart(item);
    }, { passive: true });
  }

  async function init() {
    try {
      const items = await loadItems();
      render(items);
      console.log(`[foodandbevs.js] Loaded ${items.length} items`);
    } catch (err) {
      console.error(err);
      grid.innerHTML = `
        <div style="padding:16px;color:#b00020;font-weight:900;">
          Food &amp; Bevs failed to load
        </div>
        <pre style="padding:16px;white-space:pre-wrap;word-break:break-word;background:#fff3f3;border-radius:12px;margin:0 12px 12px;">
${(err && err.message) ? err.message : String(err)}
        </pre>
      `;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
