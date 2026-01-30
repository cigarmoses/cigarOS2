/* /pos/foodandbevs.js
   Food & Bevs page (LIVE from /pos/pos-products.json)

   Click targets:
   ✅ icon button (.food-tile__btn)
   ✅ product name text (.food-tile__label)

   Action:
   ✅ triggers cart.js confirm modal (non-cigars) and adds to invoice after confirm

   Debug:
   ✅ always shows Loading... then either renders items or shows error text in #grid
*/

(() => {
  "use strict";

  const DATA_URL = "/pos/pos-products.json";
  const CATEGORY_NAME = "Food & Bevs";
  const ICON_BASE = "/img/icons/foodandbevs/";

  const DEBUG_TAP_ALERT = false; // set true for 1 deploy if needed

  const $ = (sel, root = document) => root.querySelector(sel);

  const grid = $("#grid");
  if (!grid) {
    console.error("[foodandbevs.js] Missing #grid");
    return;
  }

  // Show immediate status so we know JS is running
  grid.innerHTML = `<div style="padding:16px;font-weight:800;">Loading…</div>`;

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

  function showError(err) {
    const msg = (err && err.message) ? err.message : String(err);
    grid.innerHTML = `
      <div style="padding:16px;color:#b00020;font-weight:900;">
        Food &amp; Bevs failed to load
      </div>
      <pre style="padding:16px;white-space:pre-wrap;word-break:break-word;background:#fff3f3;border-radius:12px;margin:0 12px 12px;">
${msg}
      </pre>
      <div style="padding:0 16px 16px;opacity:.8;">
        Check that <code>${DATA_URL}</code> is reachable and that this page is loading <code>/pos/foodandbevs.js</code>.
      </div>
    `;
  }

  // Invoke cart.js by clicking a hidden element with data-receipt-item
  function sendToCartConfirm(item) {
    const payload = {
      key: item.key,
      category: item.category,        // must be category for invoice header row
      brand: item.brand || "",
      name: item.name,                // product name shown on invoice
      subtitle: item.variant || "",   // optional third line
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
    ghost.setAttribute("data-confirm-add", "1");
    document.body.appendChild(ghost);
    ghost.click();
    ghost.remove();
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

    if (!items.length) {
      throw new Error(`No items found where category == "${CATEGORY_NAME}". Check your JSON category values.`);
    }

    return items;
  }

  function render() {
    const frag = document.createDocumentFragment();

    for (const item of ITEMS) {
      const wrap = document.createElement("div");
      wrap.className = "food-tile";

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

      const label = document.createElement("div");
      label.className = "food-tile__label";
      label.textContent = item.name;
      label.dataset.key = item.key;

      const price = document.createElement("div");
      price.className = "food-tile__price";
      price.textContent = money(item.price);

      wrap.append(btn, label, price);
      frag.appendChild(wrap);
    }

    grid.innerHTML = "";
    grid.appendChild(frag);
  }

  // Only icon or label triggers add
  function handleActivate(target) {
    const hit = target.closest(".food-tile__btn, .food-tile__label");
    if (!hit) return;

    const key = hit.dataset.key;
    const item = ITEMS.find(x => x.key === key);
    if (!item) return;

    if (DEBUG_TAP_ALERT) alert(`tap: ${item.name}`);

    sendToCartConfirm(item);
  }

  function wireClicks() {
    grid.addEventListener("click", (e) => handleActivate(e.target));
    grid.addEventListener("touchend", (e) => handleActivate(e.target), { passive: true });
  }

  async function init() {
    try {
      ITEMS = await loadItems();
      render();
      wireClicks();
      console.log(`[foodandbevs.js] Loaded ${ITEMS.length} items`);
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
