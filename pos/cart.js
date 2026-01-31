/* /pos/cart.js
   Shared POS cart controller (ALL POS pages)

   ✅ Stores cart in localStorage
   ✅ Updates the invoice FAB badge everywhere
   ✅ Clicking the invoice FAB navigates to /pos/invoice/
   ✅ Back-compat: clicking any element with [data-receipt-item] + dataset fields adds to cart
   ✅ Cleans legacy invoice/modal UI so it can’t pop up anymore
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

  const norm = (s) => String(s ?? "").trim();

  // -------------------------
  // Legacy UI cleanup (prevents old popup)
  // -------------------------
  function killLegacyInvoiceUI() {
    // remove known legacy nodes (safe if they don’t exist)
    const selectors = [
      "#receipt-modal",
      "#invoice-modal",
      "#posInvoiceModal",
      "#posReceiptModal",
      ".receipt-modal",
      ".invoice-modal",
      ".pos-invoice-modal",
      ".pos-receipt-modal",
      "#sheet-backdrop",
      "#sheet",
      ".sheet__backdrop",
      ".sheet"
    ];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        // Don’t delete normal category sheets unless you want:
        // We only nuke if it looks like legacy invoice/modal container.
        // But #sheet is the old product sheet; remove it to avoid any popups.
        el.remove();
      });
    });

    // Force legacy “receipt” buttons to navigate instead of open a modal
    const legacyOpen = document.getElementById("receipt-open");
    if (legacyOpen) {
      legacyOpen.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = "/pos/invoice/";
      }, true);
    }
  }

  // -------------------------
  // Badge + FAB
  // -------------------------
  function ensureFab() {
    // If already on invoice page, do NOT show the floating FAB
    if (location.pathname.startsWith("/pos/invoice")) return null;

    let fab = document.getElementById("posInvoiceFab");
    if (fab) return fab;

    fab = document.createElement("button");
    fab.type = "button";
    fab.id = "posInvoiceFab";
    fab.className = "pos-invoice-fab";
    fab.setAttribute("aria-label", "Invoice");

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
      null;

    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count <= 0;
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

      const id = norm(item?.id);
      if (!id) return;

      const existing = cart.find((x) => x.id === id);

      if (existing) {
        existing.qty = (Number(existing.qty) || 0) + 1;
      } else {
        cart.push({
          id,
          type: norm(item?.type || "product"),
          category: norm(item?.category || ""),
          brand: norm(item?.brand || ""),
          name: norm(item?.name || "Item"),
          sub: norm(item?.sub || ""),
          price: Number(item?.price || 0),
          qty: 1,
          img: norm(item?.img || ""),
          link: norm(item?.link || "")
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

  window.CigarOSCart = API;

  // -------------------------
  // Back-compat: click-to-add via dataset
  // -------------------------
  function wireDatasetAdds() {
    document.addEventListener("click", (e) => {
      const el = e.target?.closest?.("[data-receipt-item]");
      if (!el) return;

      // If element is explicitly opt-out
      if (el.hasAttribute("data-no-cart")) return;

      // If page already handles click and wants to stop, let it.
      // (We only add if it has the fields we need.)
      const priceRaw = el.dataset.price;
      const name = el.dataset.name;
      const category = el.dataset.category;

      if (!name || !category || priceRaw == null) return;

      const type = (el.dataset.type || "product").toLowerCase();
      const brand = el.dataset.brand || "";
      const price = Number(priceRaw || "0");

      const id = (category + "|" + brand + "|" + name).toLowerCase();

      API.add({ id, type, category, brand, name, price, img: "", link: "", sub: "" });
    }, { passive: true });
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    injectFabCSSIfMissing();
    killLegacyInvoiceUI();
    ensureFab();
    updateBadge();
    wireDatasetAdds();
  });

})();
