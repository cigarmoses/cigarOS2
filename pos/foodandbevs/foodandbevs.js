/* /pos/foodandbevs.js
   Food & Bevs page (LIVE from /pos/pos-products.json)

   ✅ Loads items where category == "Food & Bevs"
   ✅ Renders icon + label + price
   ✅ Click ANYWHERE on a tile adds to cart via window.CigarOSCart.add()
   ✅ Icons resolved from /img/icons/foodandbevs using:
      item.image (if present) OR slug key with svg/png/jpg/jpeg/webp fallback
*/

(() => {
  "use strict";

  const DATA_URL = "/pos/pos-products.json";
  const CATEGORY_NAME = "Food & Bevs";
  const ICON_DIR = "/img/icons/foodandbevs";

  const $ = (sel, root = document) => root.querySelector(sel);

  const grid = $("#grid");
  if (!grid) return console.error("[foodandbevs.js] Missing #grid");

  grid.innerHTML = `<div style="padding:16px;font-weight:800;">Loading…</div>`;

  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

  const money = (n) => `$${Number(n || 0).toFixed(2)}`;

  // Turns "Coke Zero" -> "cokezero"
  const keyify = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  // -------- icon resolver --------
  const existsCache = new Map();

  async function urlExists(url) {
    if (existsCache.has(url)) return existsCache.get(url);

    let ok = false;
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      ok = res.ok;
    } catch (_) {}

    // fallback if HEAD blocked
    if (!ok) {
      try {
        const res = await fetch(url, { method: "GET", cache: "no-store" });
        ok = res.ok;
      } catch (_) {}
    }

    existsCache.set(url, ok);
    return ok;
  }

  async function resolveIconSrc(item) {
    // 1) If JSON includes a direct image path/url, use it
    const direct = String(item.image || "").trim();
    if (direct) return direct;

    // 2) Try key candidates against ICON_DIR with multi-ext fallback
    const candidates = [
      keyify(item.slug || ""),
      keyify(item.product || ""),
      keyify(item.name || ""),
      keyify(item.key || "")
    ].filter(Boolean);

    const exts = ["svg", "png", "jpg", "jpeg", "webp"];

    for (const c of candidates) {
      for (const ext of exts) {
        const url = `${ICON_DIR}/${c}.${ext}`;
        if (await urlExists(url)) return url;
      }
    }

    return "";
  }

  // -------- cart add --------
  function addToCart(item) {
    if (!window.CigarOSCart || typeof window.CigarOSCart.add !== "function") {
      console.warn("[foodandbevs.js] CigarOSCart not ready yet");
      return;
    }

    const category = item.category || CATEGORY_NAME;
    const brand = item.brand || "";
    const name = item.name || item.product || "Item";
    const price = Number(item.price || 0);

    const id = (category + "|" + brand + "|" + name).toLowerCase();

    window.CigarOSCart.add({
      id,
      type: "product",
      category,
      brand,
      name,
      price,
      sub: item.variant || "",
      img: item.image || "",
      link: ""
    });
  }

  async function loadItems() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${DATA_URL} (${res.status})`);

    const all = await res.json();
    if (!Array.isArray(all)) throw new Error("pos-products.json is not an array");

    const items = all
      .filter((p) => norm(p.category) === norm(CATEGORY_NAME))
      .map((p) => {
        const name = p.product || p.name || p.brand || "Item";
        return {
          key: p.key || `${CATEGORY_NAME}:${name}:${p.price}`,
          category: p.category || CATEGORY_NAME,
          brand: p.brand || "",
          name,
          variant: p.variant || "",
          price: Number(p.price || 0),
          image: p.image || "",
          slug: keyify(name)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!items.length) {
      throw new Error(`No items found where category == "${CATEGORY_NAME}"`);
    }

    return items;
  }

  async function render(items) {
    const frag = document.createDocumentFragment();

    for (const item of items) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "food-tile";
      tile.dataset.key = item.key;

      // icon box
      const iconBox = document.createElement("div");
      iconBox.className = "food-tile__icon";

      const src = await resolveIconSrc(item);
      if (src) {
        const img = document.createElement("img");
        img.alt = item.name;
        img.loading = "lazy";
        img.decoding = "async";
        img.src = src;
        iconBox.appendChild(img);
      }

      const label = document.createElement("div");
      label.className = "food-tile__label";
      label.textContent = item.name;

      const price = document.createElement("div");
      price.className = "food-tile__price";
      price.textContent = money(item.price);

      tile.append(iconBox, label, price);

      tile.addEventListener("click", () => addToCart(item));

      frag.appendChild(tile);
    }

    grid.innerHTML = "";
    grid.appendChild(frag);
  }

  function showError(err) {
    const msg = err?.message ? err.message : String(err);
    grid.innerHTML = `
      <div style="padding:16px;color:#b00020;font-weight:900;">Food &amp; Bevs failed</div>
      <pre style="padding:16px;white-space:pre-wrap;word-break:break-word;background:#fff3f3;border-radius:12px;margin:0 12px 12px;">${msg}</pre>
    `;
  }

  async function init() {
    try {
      const items = await loadItems();
      await render(items);
      console.log(`[foodandbevs.js] Rendered ${items.length} items`);
    } catch (e) {
      console.error(e);
      showError(e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
