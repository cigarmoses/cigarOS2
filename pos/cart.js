/* /pos/cart.js
   Shared POS cart controller (ALL POS pages)

   ✅ Stores cart in localStorage
   ✅ Updates header badge everywhere (if present)
   ✅ Clicking header Invoice button goes to /pos/invoice/
   ✅ NO floating FAB / NO modal / NO injected UI
   ✅ Back-compat: click any element with [data-receipt-item] + dataset fields adds to cart
   ✅ Removes legacy invoice/modal/sheet nodes so they can’t pop up anymore
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
      document.querySelectorAll(sel).forEach((el) => el.remove());
    });

    // If any legacy "receipt-open" button exists, force it to navigate
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
  // Badge updater (header)
  // -------------------------
  function updateBadges() {
    const cart = loadCart();
    const count = cart.reduce((a, it) => a + (Number(it.qty) || 0), 0);

    // New header badge IDs
    const headerBadge =
      document.getElementById("invoiceBadge") ||
      document.getElementById("posInvoiceBadge") ||
      null;

    if (headerBadge) {
      headerBadge.textContent = String(count);
      headerBadge.hidden = count <= 0;
    }

    // Also update any legacy badge nodes if they exist
    const legacyBadge =
      document.getElementById("posReceiptBadge") ||
      document.getElementById("receipt-count") ||
      null;

    if (legacyBadge) {
      legacyBadge.textContent = String(count);
      legacyBadge.hidden = count <= 0;
    }

    // Dispatch event (useful if invoice page listens)
    window.dispatchEvent(new CustomEvent("cigaros:cart", { detail: { count } }));
  }

  // Ensure header invoice button always routes correctly
  function wireHeaderInvoiceBtn() {
    const btn = document.getElementById("invoiceBtn");
    if (!btn) return;
    btn.setAttribute("href", "/pos/invoice/");
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
      updateBadges();
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
      updateBadges();
    },

    clear() {
      saveCart([]);
      updateBadges();
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

      // opt-out
      if (el.hasAttribute("data-no-cart")) return;

      const priceRaw = el.dataset.price;
      const name = el.dataset.name;
      const category = el.dataset.category;

      // Only add if it looks like a product tile/card
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
    killLegacyInvoiceUI();
    wireHeaderInvoiceBtn();
    updateBadges();
    wireDatasetAdds();
  });

})();
