/* /pos/cart.js
   Global POS Invoice controller

   ✅ Injects a consistent top-left back button + top-right invoice pill on ALL /pos pages
   ✅ Listens for add-to-cart clicks via [data-receipt-item] OR .pos-add/.row-add
   ✅ Stores cart in localStorage and updates badge
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
  const $ = (sel, root=document) => root.querySelector(sel);

  function safeJsonParse(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  function readCart() {
    const raw = localStorage.getItem(CART_KEY);
    const cart = raw ? safeJsonParse(raw) : null;
    return cart && Array.isArray(cart.items) ? cart : { items: [] };
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function cartCount(cart) {
    return (cart.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  }

  function money(n) {
    const v = Number(n || 0);
    return v.toFixed(2);
  }

  // -------------------------
  // UI: inject global controls
  // -------------------------
  function ensureGlobalPosControls() {
    // only on /pos pages
    if (!location.pathname.includes("/pos/")) return;

    // add shared CSS once
    if (!$("#posGlobalControlsCss")) {
      const style = document.createElement("style");
      style.id = "posGlobalControlsCss";
      style.textContent = `
        /* ===== Global POS controls (top-left back + top-right invoice pill) ===== */
        .pos-global-controls{
          position: fixed;
          top: calc(10px + env(safe-area-inset-top));
          left: 10px;
          right: 10px;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: space-between;
          pointer-events: none;
        }
        .pos-global-controls > *{ pointer-events: auto; }

        .pos-back-btn{
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: none;
          background: transparent;
          display: grid;
          place-items: center;
          -webkit-tap-highlight-color: transparent;
        }
        .pos-back-btn svg{
          width: 22px;
          height: 22px;
          stroke: rgba(0,0,0,.65);
        }

        /* Invoice pill */
        .pos-invoice-pill{
          height: 44px;
          padding: 0 12px;
          border-radius: 16px;
          border: 2px solid rgba(0,0,0,.12);
          background: rgba(255,255,255,.85);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: inline-flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 10px 22px rgba(0,0,0,.12);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
          font-weight: 800;
          color: #1677ff;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
        }
        .pos-invoice-pill .pill-label{
          font-size: 18px;
          line-height: 1;
        }
        .pos-invoice-pill .pill-badge{
          min-width: 44px;
          height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          background: #ff3b30;
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 16px;
          line-height: 1;
          box-shadow: 0 10px 18px rgba(255,59,48,.22);
        }
      `;
      document.head.appendChild(style);
    }

    if (!$("#posGlobalControls")) {
      const wrap = document.createElement("div");
      wrap.id = "posGlobalControls";
      wrap.className = "pos-global-controls";

      wrap.innerHTML = `
        <button class="pos-back-btn" type="button" aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <a class="pos-invoice-pill" href="/pos/invoice.html" aria-label="Invoice">
          <span class="pill-label">Invoice</span>
          <span class="pill-badge" id="posInvoiceBadge">0</span>
        </a>
      `;

      document.body.appendChild(wrap);

      // Back behavior: match brand pages (history back; fallback to /pos/)
      wrap.querySelector(".pos-back-btn").addEventListener("click", () => {
        if (history.length > 1) history.back();
        else location.href = "/pos/";
      });
    }
  }

  function updateBadge() {
    const cart = readCart();
    const badge = $("#posInvoiceBadge");
    if (badge) badge.textContent = String(cartCount(cart));
  }

  // -------------------------
  // Cart actions
  // -------------------------
  function addItemFromPayload(payload) {
    if (!payload) return;

    // Require at least id + name
    const id = String(payload.id || payload.key || payload.sku || payload.name || "").trim();
    const name = String(payload.name || payload.title || "").trim();
    if (!id || !name) return;

    const cart = readCart();

    // normalize
    const item = {
      id,
      type: payload.type || "other", // "cigar" or "other"
      category: payload.category || "",
      brand: payload.brand || "",
      line: payload.line || "",        // cigar line (optional)
      vitola: payload.vitola || "",    // cigar vitola (optional)
      name,                            // display name
      unit: Number(payload.unit ?? payload.price ?? payload.msrp ?? 0),
      img: payload.img || payload.image || "",
      qty: 1
    };

    const existing = cart.items.find(x => x.id === item.id);
    if (existing) existing.qty = (Number(existing.qty) || 0) + 1;
    else cart.items.push(item);

    writeCart(cart);
    updateBadge();
  }

  // -------------------------
  // Click handling (THE IMPORTANT PART)
  // -------------------------
  function wireGlobalAddClicks() {
    document.addEventListener("click", (e) => {
      const btn =
        e.target.closest("[data-receipt-item]") ||
        e.target.closest(".pos-add") ||
        e.target.closest(".row-add") ||
        e.target.closest(".pos-add-btn");

      if (!btn) return;

      // If a cigar row is clickable to open details, we only want + to add.
      // Stop row click from hijacking.
      e.stopPropagation();

      let payload = null;

      if (btn.hasAttribute("data-receipt-item")) {
        payload = safeJsonParse(btn.getAttribute("data-receipt-item"));
      } else if (btn.dataset && btn.dataset.receiptItem) {
        payload = safeJsonParse(btn.dataset.receiptItem);
      }

      // If dev forgot JSON but put dataset fields, fall back:
      if (!payload) {
        payload = {
          id: btn.dataset.id || btn.dataset.key || btn.dataset.sku || "",
          name: btn.dataset.name || btn.dataset.title || "",
          type: btn.dataset.type || "other",
          category: btn.dataset.category || "",
          brand: btn.dataset.brand || "",
          line: btn.dataset.line || "",
          vitola: btn.dataset.vitola || "",
          unit: btn.dataset.unit || btn.dataset.price || btn.dataset.msrp || 0,
          img: btn.dataset.img || btn.dataset.image || ""
        };
      }

      addItemFromPayload(payload);
    }, { capture: true });
  }

  // -------------------------
  // Boot
  // -------------------------
  function boot() {
    ensureGlobalPosControls();
    wireGlobalAddClicks();
    updateBadge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
