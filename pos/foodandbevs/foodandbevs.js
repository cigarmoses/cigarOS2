/* /pos/foodandbevs.js
   Food & Beverages page (LIVE from master sheet)
   - 4-up grid
   - Icons stay at: /img/icons/foodandbevs/<slug>.svg
   - Data source: /pos/pos-products.json (generated from your Excel)
   - Adds items to the global invoice/cart via data-receipt-item + confirm modal
*/

(() => {
  "use strict";

  const DATA_URL = "/pos/pos-products.json";
  const CATEGORY_NAME = "Food & Bevs";
  const ICON_BASE = "/img/icons/foodandbevs/";

  const $ = (sel, root = document) => root.querySelector(sel);

  // DOM
  const grid = $("#grid");

  const cartPill = $("#cartPill");
  const cartCountEl = $("#cartCount");
  const cartTotalEl = $("#cartTotal");

  const sheet = $("#sheet");
  const sheetTitle = $("#sheetTitle");
  const sheetPrice = $("#sheetPrice");
  const sheetSubtotal = $("#sheetSubtotal");
  const qtyVal = $("#qtyVal");
  const btnMinus = $("#btnMinus");
  const btnPlus = $("#btnPlus");
  const btnAddToBill = $("#btnAddToBill");

  // Defensive: required nodes
  if (!grid || !sheet || !sheetTitle || !sheetPrice || !sheetSubtotal || !qtyVal || !btnMinus || !btnPlus || !btnAddToBill) {
    console.error("[foodandbevs.js] Missing required DOM nodes. Check ids in HTML.");
    return;
  }

  // -------------------------
  // State
  // -------------------------
  let ITEMS = [];            // loaded from JSON
  let currentItem = null;
  let currentQty = 1;

  // Local pill display only (your global invoice/cart has its own FAB+badge)
  let cartQty = 0;
  let cartTotal = 0;

  // -------------------------
  // Helpers
  // -------------------------
  const money = (n) => `$${Number(n || 0).toFixed(2)}`;

  const slugify = (s) => String(s || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

  const toIconSlug = (item) => {
    // Prefer explicit icon slug if you ever add it later
    if (item.slug) return String(item.slug);

    // Try to match existing naming: use product name
    // Example: "Diet Dr. Pepper" => "dietdrpepper"
    const base = item.product || item.name || item.brand || "";
    return slugify(base);
  };

  const safeJson = (obj) => {
    try { return JSON.stringify(obj); } catch { return "{}"; }
  };

  // -------------------------
  // Data load (from your Excel → JSON)
  // -------------------------
  async function loadItems() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch ${DATA_URL} (${res.status})`);

    const all = await res.json();
    if (!Array.isArray(all)) throw new Error("pos-products.json is not an array");

    // Filter only Food & Bevs (case-insensitive)
    const items = all.filter(p => String(p.category || "").toLowerCase() === CATEGORY_NAME.toLowerCase());

    // Normalize for UI
    return items.map(p => {
      const productName = p.product || p.name || p.brand || "Item";
      return {
        key: p.key || `${CATEGORY_NAME}:${productName}:${p.price}`,
        category: p.category || CATEGORY_NAME,
        brand: p.brand || "",
        product: productName,
        variant: p.variant || "",
        distributor: p.distributor || "",
        bucket: p.bucket || "Other",
        taxable: !!p.taxable,
        price: Number(p.price || 0),
        image: p.image || "",           // optional
        brandIcon: p.brandIcon || "",   // optional
        // UI-only
        name: productName,
        slug: toIconSlug({ product: productName })
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  // -------------------------
  // Render grid (4-up)
  // -------------------------
  function render() {
    const frag = document.createDocumentFragment();

    ITEMS.forEach(item => {
      const wrap = document.createElement("div");
      wrap.className = "food-tile";

      const btn = document.createElement("button");
      btn.className = "food-tile__btn";
      btn.type = "button";

      // keep for any legacy uses
      btn.dataset.name = item.name;
      btn.dataset.price = String(item.price);

      const img = document.createElement("img");
      img.alt = item.name;

      // Keep your exact icon location
      img.src = `${ICON_BASE}${item.slug}.svg`;

      // If an icon is missing, fail gracefully (don’t show broken image icon)
      img.onerror = () => {
        img.onerror = null;
        img.removeAttribute("src");
        img.style.display = "none";
      };

      btn.appendChild(img);

      const label = document.createElement("div");
      label.className = "food-tile__label";
      label.textContent = item.name;

      const price = document.createElement("div");
      price.className = "food-tile__price";
      price.textContent = money(item.price);

      wrap.append(btn, label, price);
      frag.appendChild(wrap);

      btn.addEventListener("click", () => openSheet(item));
    });

    grid.innerHTML = "";
    grid.appendChild(frag);
  }

  // -------------------------
  // Sheet
  // -------------------------
  function openSheet(item) {
    currentItem = item;
    currentQty = 1;

    sheetTitle.textContent = item.name;
    sheetPrice.textContent = money(item.price);
    qtyVal.textContent = String(currentQty);
    sheetSubtotal.textContent = `${money(item.price * currentQty)} subtotal`;

    sheet.classList.add("sheet--open");
    sheet.setAttribute("aria-hidden", "false");
  }

  function closeSheet() {
    sheet.classList.remove("sheet--open");
    sheet.setAttribute("aria-hidden", "true");
  }

  btnMinus.addEventListener("click", () => {
    if (!currentItem) return;
    if (currentQty > 1) {
      currentQty--;
      qtyVal.textContent = String(currentQty);
      sheetSubtotal.textContent = `${money(currentItem.price * currentQty)} subtotal`;
    }
  });

  btnPlus.addEventListener("click", () => {
    if (!currentItem) return;
    currentQty++;
    qtyVal.textContent = String(currentQty);
    sheetSubtotal.textContent = `${money(currentItem.price * currentQty)} subtotal`;
  });

  // -------------------------
  // Add to Bill (global cart/invoice)
  // -------------------------
  btnAddToBill.addEventListener("click", () => {
    if (!currentItem) return;

    // Update the local pill UI (optional, keeps your current UX)
    const add = currentItem.price * currentQty;
    cartQty += currentQty;
    cartTotal += add;

    if (cartCountEl) cartCountEl.textContent = String(cartQty);
    if (cartTotalEl) cartTotalEl.textContent = money(cartTotal);
    if (cartPill) cartPill.classList.add("is-active");

    // Send ONE item with qty into the global cart (cart.js listens for [data-receipt-item])
    // We trigger the same click hook by creating a temporary element with the dataset.
    const payload = {
      key: currentItem.key,
      category: currentItem.category,      // "Food & Bevs"
      brand: currentItem.brand,            // optional
      name: currentItem.name,              // Product name (invoice uses this)
      subtitle: currentItem.variant || "", // optional 3rd line
      price: currentItem.price,
      qty: currentQty,
      image: currentItem.image || "",      // optional
      brandIcon: currentItem.brandIcon || "",
      distributor: currentItem.distributor || "",
      bucket: currentItem.bucket || "Other",
      taxable: !!currentItem.taxable,
      confirm: true                         // non-cigars confirm modal
    };

    const ghost = document.createElement("button");
    ghost.type = "button";
    ghost.style.display = "none";
    ghost.setAttribute("data-receipt-item", safeJson(payload));
    ghost.setAttribute("data-confirm-add", "1"); // cart.js will show confirm
    document.body.appendChild(ghost);

    // Click to invoke cart.js listener
    ghost.click();
    ghost.remove();

    closeSheet();
  });

  // Close handlers
  document.querySelectorAll("[data-close-sheet]").forEach(el =>
    el.addEventListener("click", closeSheet)
  );

  // -------------------------
  // Boot
  // -------------------------
  async function init() {
    try {
      ITEMS = await loadItems();
      render();
    } catch (err) {
      console.error(err);
      grid.innerHTML = `
        <div style="padding:16px; color:#b00020; font-weight:700;">
          Failed to load products. Make sure <code>${DATA_URL}</code> exists in the repo and is reachable.
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
