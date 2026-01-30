/* /pos/cart.js
   Shared POS cart controller (ALL POS pages)

   ✅ Stores cart in localStorage
   ✅ Updates the invoice FAB badge everywhere
   ✅ Clicking the invoice FAB navigates to /pos/invoice/
   ✅ NO modal / NO injected sheet UI
*/

(() => {
  "use strict";

  // -------------------------
  // Storage keys
  // -------------------------
  const CART_KEY = "cigaros_pos_cart_v3";
  const SHOP_KEY = "cigaros_pos_shop_name";
  const INV_KEY  = "cigaros_pos_invoice_number";

  // -------------------------
  // Helpers
  // -------------------------
  const safeJSON = (str, fallback) => {
    try { return JSON.parse(str); } catch { return fallback; }
  };

  const loadCart = () => safeJSON(localStorage.getItem(CART_KEY) || "[]", []);
  const saveCart = (arr) => localStorage.setItem(CART_KEY, JSON.stringify(arr));

  const money = (n) => {
    const v = Number(n);
    if (!isFinite(v)) return "0.00";
    return v.toFixed(2);
  };

  const getShopName = () => localStorage.getItem(SHOP_KEY) || "Shop";

  const getInvoiceNumber = () => {
    let cur = Number(localStorage.getItem(INV_KEY) || "0");
    if (!cur || !isFinite(cur)) {
      cur = Math.floor(100000 + Math.random() * 900000);
      localStorage.setItem(INV_KEY, String(cur));
    }
    return cur;
  };

  // -------------------------
  // Badge + FAB
  // -------------------------
  function ensureFab() {
    // If already on invoice page, do NOT show the floating FAB
    if (location.pathname.startsWith("/pos/invoice")) return;

    let fab = document.getElementById("posInvoiceFab");
    if (fab) return fab;

    fab = document.createElement("button");
    fab.type = "button";
    fab.id = "posInvoiceFab";
    fab.className = "pos-invoice-fab";
    fab.setAttribute("aria-label", "Invoice");

    // Use your existing receipt icon asset
    fab.innerHTML = `
      <img src="/img/icons/receipt.png" alt="" />
      <span class="pos-invoice-badge" id="posInvoiceBadge" hidden>0</span>
    `;

    fab.addEventListener("click", () => {
      window.location.href = "/pos/invoice/";
    });

    document.body.appendChild(fab);
    return fab;
  }

  function updateBadge() {
    const cart = loadCart();
    const count = cart.reduce((a, it) => a + (Number(it.qty) || 0), 0);

    // Update any known badge nodes (old + new IDs/classes)
    const badge =
      document.getElementById("posInvoiceBadge") ||
      document.getElementById("posReceiptBadge") ||
      document.getElementById("receipt-count") ||
      document.getElementById("receipt-count") ||
      null;

    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count <= 0;
    }

    // Also update legacy “receipt-open” button badge if present
    const legacyBadge = document.getElementById("receipt-count");
    if (legacyBadge) {
      legacyBadge.textContent = String(count);
      legacyBadge.hidden = count <= 0;
    }

    // Dispatch event so invoice page can live-update if open in same tab
    window.dispatchEvent(new CustomEvent("cigaros:cart", { detail: { count } }));
  }

  function injectFabCSSIfMissing() {
    if (document.getElementById("posInvoiceFabCSS")) return;

    const style = document.createElement("style");
    style.id = "posInvoiceFabCSS";
    style.textContent = `
      .pos-invoice-fab{
        position:fixed;
        right:14px;
        bottom:calc(14px + env(safe-area-inset-bottom));
        width:62px;
        height:62px;
        border-radius:16px;
        border:none;
        background:transparent;
        padding:0;
        display:grid;
        place-items:center;
        z-index:9999;
        -webkit-tap-highlight-color:transparent;
      }
      .pos-invoice-fab img{
        width:62px;
        height:62px;
        display:block;
        border-radius:16px;
      }
      .pos-invoice-badge{
        position:absolute;
        right:-4px;
        top:-4px;
        min-width:22px;
        height:22px;
        padding:0 6px;
        border-radius:999px;
        background:#ff3b30;
        color:#fff;
        font-weight:900;
        font-size:12px;
        display:grid;
        place-items:center;
        line-height:1;
        box-shadow:0 8px 20px rgba(0,0,0,.25);
      }
    `;
    document.head.appendChild(style);
  }

  // -------------------------
  // Public API
  // -------------------------
  const API = {
    get cart() {
      return loadCart();
    },
    getShopName,
    getInvoiceNumber,

    add(item) {
      const cart = loadCart();
      const id = String(item?.id || "").trim();
      if (!id) return;

      const existing = cart.find((x) => x.id === id);

      if (existing) {
        existing.qty = (Number(existing.qty) || 0) + 1;
      } else {
        cart.push({
          id,
          type: String(item.type || "product"),
          category: String(item.category || ""),
          brand: String(item.brand || ""),
          name: String(item.name || "Item"),
          sub: String(item.sub || ""),
          price: Number(item.price || 0),
          qty: 1,
          img: String(item.img || ""),
          link: String(item.link || "")
        });
      }

      saveCart(cart);
      updateBadge();
    },

    setQty(id, qty) {
      const cart = loadCart();
      const it = cart.find((x) => x.id === id);
      if (!it) return;

      const q = Number(qty);
      if (!isFinite(q) || q <= 0) {
        const next = cart.filter((x) => x.id !== id);
        saveCart(next);
      } else {
        it.qty = q;
        saveCart(cart);
      }
      updateBadge();
    },

    clear() {
      saveCart([]);
      updateBadge();
    },

    totals() {
      const cart = loadCart();
      const subtotal = cart.reduce((a, it) => a + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
      return { subtotal, subtotalText: money(subtotal) };
    }
  };

  // Expose globally
  window.CigarOSCart = API;

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    injectFabCSSIfMissing();
    ensureFab();
    updateBadge();
  });

})();
