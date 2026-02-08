/* /pos/cart.js
   Shared POS Cart + badge updater (ALL POS pages)

   Fixes:
   ✅ Clicking any green + (row) adds item
   ✅ Clicking modal "Add" adds item
   ✅ Badge updates anywhere (#receipt-count or [data-cart-badge])
   ✅ Persists cart in localStorage
*/

(() => {
  "use strict";

  const CART_KEY = "cigaros_pos_cart_v3";

  function money(n) {
    const x = Number(n || 0);
    return x.toFixed(2);
  }

  function safeJSONParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function loadCart() {
    return safeJSONParse(localStorage.getItem(CART_KEY), []) || [];
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function getKeyFromData(d) {
    // Prefer sku/id if present; otherwise stable composite
    return (
      d.sku ||
      d.id ||
      [
        d.type || "cigar",
        d.brand || "",
        d.line || "",
        d.name || d.cigar || "",
        d.vitola || ""
      ].join("|").toLowerCase()
    );
  }

  function normalizeFromDataset(ds) {
    // Support multiple naming styles you may have in different pages
    return {
      type: ds.type || "cigar",
      id: ds.id || "",
      sku: ds.sku || "",
      brand: ds.brand || "",
      line: ds.line || "",
      name: ds.name || ds.cigar || "",
      vitola: ds.vitola || "",
      msrp: ds.msrp || ds.price || "",
      image: ds.image || ""
    };
  }

  function addToCart(item, qtyToAdd = 1) {
    const cart = loadCart();
    const key = getKeyFromData(item);

    const price = Number(item.msrp || 0);
    const qtyAdd = Math.max(1, Number(qtyToAdd || 1));

    const existing = cart.find((x) => x.key === key);
    if (existing) {
      existing.qty = Number(existing.qty || 0) + qtyAdd;
      // keep latest metadata
      existing.brand = item.brand;
      existing.line = item.line;
      existing.name = item.name;
      existing.vitola = item.vitola;
      existing.msrp = price;
      existing.image = item.image;
      existing.type = item.type || existing.type;
    } else {
      cart.push({
        key,
        qty: qtyAdd,
        type: item.type || "cigar",
        brand: item.brand || "",
        line: item.line || "",
        name: item.name || "",
        vitola: item.vitola || "",
        msrp: price,
        image: item.image || ""
      });
    }

    saveCart(cart);
    document.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: { cart } }));
    updateBadges(cart);
  }

  function getCartCount(cart) {
    const c = cart || loadCart();
    // count total qty (not distinct items)
    return c.reduce((sum, it) => sum + Number(it.qty || 0), 0);
  }

  function updateBadges(cartMaybe) {
    const cart = cartMaybe || loadCart();
    const count = getCartCount(cart);

    // Legacy badge id
    const legacy = document.getElementById("receipt-count");
    if (legacy) legacy.textContent = String(count);

    // Any badge placeholders
    document.querySelectorAll("[data-cart-badge]").forEach((el) => {
      el.textContent = String(count);
    });

    // Toggle a class on invoice buttons if you want styling
    document.querySelectorAll("[data-invoice-btn]").forEach((btn) => {
      btn.classList.toggle("has-items", count > 0);
    });
  }

  // Global click listener: supports BOTH patterns
  // 1) data-receipt-item="true"
  // 2) data-cart-add="true"
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-receipt-item], [data-cart-add]");
    if (!btn) return;

    // Don’t hijack disabled buttons
    if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return;

    const item = normalizeFromDataset(btn.dataset);
    if (!item.name && !item.brand) return;

    addToCart(item, btn.dataset.qty || 1);
  });

  // Keep badges correct on load
  updateBadges(loadCart());

  // Expose tiny API (optional)
  window.cigarOSCart = window.cigarOSCart || {};
  window.cigarOSCart.add = addToCart;
  window.cigarOSCart.count = () => getCartCount(loadCart());
  window.cigarOSCart.items = () => loadCart();
})();
