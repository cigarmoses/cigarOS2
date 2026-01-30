/* /pos/foodandbevs.js
   Food & Bevs page (LIVE from /pos/pos-products.json)

   ✅ Click targets:
      - icon button (.food-tile__btn)
      - product name text (.food-tile__label)
      (NOT the whole tile)

   ✅ iOS reliability:
      - event delegation on #grid
      - supports both click + touchend

   ✅ Adds to invoice via cart.js confirm modal using data-receipt-item
*/

(() => {
  "use strict";

  const DATA_URL = "/pos/pos-products.json";
  const CATEGORY_NAME = "Food & Bevs";
  const ICON_BASE = "/img/icons/foodandbevs/";

  // Set TRUE for one deploy if you need a proof that taps are firing
  const DEBUG_TAP_ALERT = false;

  const $ = (sel, root = document) => root.querySelector(sel);

  const grid = $("#grid");
  if (!grid) {
    console.error("[foodandbevs.js] Missing #grid");
    return;
  }

  let ITEMS = [];

  const money = (n) => `$${Number(n || 0).toFixed(2)}`;

  const slugify = (s) => String(s || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

  const safeJson = (obj) => {
    try { return JSON.stringify(obj); } catch { return "{}"; }
  };

  // Sends 1 qty to the invoice/cart via cart.js confirm modal
  function sendToCartConfirm(item) {
    const payload = {
      key: item.key,
      category: item.category,        // Food & Bevs
      brand: item.brand || "",
      name: item.name,                // invoice uses this as product name
      subtitle: item.variant || "",   // optional line 3
      price: item.price,
      qty: 1,
      image: item.image || "",
      brandIcon: item.brandIcon || "",
      distributor: item.distributor || "",
      bucket: item.bucket || "Other",
      taxable: !!item.taxable,
      confirm: true
    };

    const ghost = document.createElement("button");
    ghost.type = "button";
    ghost.style.display = "none";
    ghost.setAttribute("data-receipt-item", safeJson(payload));
    ghost.setAttribute("data-confirm-add", "1"); // force confirm modal
    document.body.appendChild(ghost);
    ghost.click();
    ghost.remove();
  }

  async function loadItems() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch ${DATA_URL} (${res.status})`);

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
          variant: p.variant || "",
          distributor: p.distributor || "",
          bucket: p.bucket || "Other",
          taxable: !!p.taxable,
          price: Number(p.price || 0),
          image: p.image || "",
          brandIcon: p.brandIcon || "",
          slug: slugify(name)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return items;
  }

  function render() {
    const frag = document.createDocumentFragment();

    for (const item of ITEMS) {
      const wrap = document.createElement("div");
      wrap.className = "food-tile";

      // Icon button (CLICK TARGET #1)
      const btn = document.createElement("button");
      btn.className = "food-tile__btn";
      btn.type = "button";
      btn.dataset.key = item.key;

      const img = document.createElement("img");
      img.alt = item.name;
      img.src = `${ICON_BASE}${item.slug}.svg`;

      img.onerror = () => {
        img.onerror = null;
        img.removeAttribute("src");
        img.style.display = "none";
      };

      btn.appendChild(img);

      // Label (CLICK TARGET #2)
      const label = document.createElement("div");
      label.className = "food-tile__label";
      label.textContent = item.name;
      label.dataset.key = item.key; // allow label to fire too

      const price = document.createElement("div");
      price.className = "food-tile__price";
      price.textContent = money(item.price);

      wrap.append(btn, label, price);
      frag.appendChild(wrap);
    }

    grid.innerHTML = "";
    grid.appendChild(frag);
  }

  // Event delegation: only allow clicks from icon button OR label
  function handleActivate(target) {
    const hit = target.closest(".food-tile__btn, .food-tile__label");
    if (!hit) return;

    const key = hit.dataset.key;
    if (!key) return;

    const item = ITEMS.find(x => x.key === key);
    if (!item) return;

    if (DEBUG_TAP_ALERT) alert(`tap: ${item.name}`);

    sendToCartConfirm(item);
  }

  function wireClicks() {
    // normal click
    grid.addEventListener("click", (e) => {
      handleActivate(e.target);
    });

    // iOS sometimes prefers touchend; keep it safe
    grid.addEventListener("touchend", (e) => {
      handleActivate(e.target);
    }, { passive: true });
  }

  async function init() {
    try {
      ITEMS = await loadItems();
      render();
      wireClicks();
      console.log(`[foodandbevs.js] Loaded ${ITEMS.length} Food & Bevs items`);
    } catch (err) {
      console.error(err);
      grid.innerHTML = `
        <div style="padding:16px; color:#b00020; font-weight:700;">
          Failed to load products. Confirm <code>${DATA_URL}</code> exists and is reachable.
        </div>
      `;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
