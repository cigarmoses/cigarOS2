/* /pos/cart.js
   Shared POS cart controller (ALL POS pages)

   ✅ Stores cart in localStorage
   ✅ Injects TOP-RIGHT "Invoice" pill + badge on every POS page
   ✅ Invoice pill navigates to /pos/invoice/
   ✅ Clicking any element with [data-receipt-item] (or common + button patterns) adds to cart
   ✅ Uses CAPTURE click listener so it works even if page JS stops propagation
   ✅ No bottom-right floating icon (removed)
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

  const norm = (s) => String(s ?? "").trim();

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
  // Invoice pill (top-right)
  // -------------------------
  function injectInvoicePillCSSOnce() {
    if (document.getElementById("posInvoicePillCSS")) return;

    const style = document.createElement("style");
    style.id = "posInvoicePillCSS";
    style.textContent = `
      /* Top-right invoice pill (matches your screenshots) */
      .pos-invoice-pill{
        display:inline-flex;
        align-items:center;
        gap:12px;
        height:56px;
        padding:0 18px;
        border-radius:20px;
        border:2px solid rgba(0,0,0,.10);
        background:#f7f7f8;
        box-shadow:0 10px 22px rgba(0,0,0,.06);
        font-weight:900;
        font-size:22px;
        letter-spacing:-.02em;
        line-height:1;
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      .pos-invoice-pill:active{ transform:scale(.99); }

      .pos-invoice-pill .pos-badge{
        min-width:38px;
        height:34px;
        padding:0 12px;
        border-radius:999px;
        background:#ff3b30;
        color:#fff;
        display:grid;
        place-items:center;
        font-weight:900;
        font-size:18px;
        box-shadow:0 10px 18px rgba(255,59,48,.25);
      }

      /* If we can’t find a header container, we pin it */
      .pos-invoice-pill.pos-fixed{
        position:fixed;
        top:12px;
        right:12px;
        z-index:9999;
      }

      /* In pages where you already have a header row layout */
      .page-header{
        position:relative;
      }
      .page-header .pos-invoice-pill{
        position:absolute;
        right:12px;
        top:10px;
      }

      /* Brand pages usually have their own header; we still pin safely */
      @media (max-width: 520px){
        .pos-invoice-pill{
          height:52px;
          padding:0 16px;
          font-size:20px;
          border-radius:18px;
        }
        .pos-invoice-pill .pos-badge{
          min-width:34px;
          height:30px;
          font-size:16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureInvoicePill() {
    // Don’t show pill on invoice page itself
    if (location.pathname.startsWith("/pos/invoice")) return null;

    let pill = document.getElementById("posInvoicePill");
    if (pill) return pill;

    pill = document.createElement("button");
    pill.type = "button";
    pill.id = "posInvoicePill";
    pill.className = "pos-invoice-pill";
    pill.setAttribute("aria-label", "Invoice");

    pill.innerHTML = `
      <span class="pos-label">Invoice</span>
      <span class="pos-badge" id="posInvoiceBadge">0</span>
    `;

    pill.addEventListener("click", () => {
      window.location.href = "/pos/invoice/";
    });

    // Try to place in a known header container first
    const header =
      document.querySelector(".page-header") ||
      document.querySelector(".brand-header") ||
      document.querySelector("header");

    if (header) {
      header.appendChild(pill);
    } else {
      pill.classList.add("pos-fixed");
      document.body.appendChild(pill);
    }

    return pill;
  }

  function updateBadge() {
    const cart = loadCart();
    const count = cart.reduce((a, it) => a + (Number(it.qty) || 0), 0);

    const badge =
      document.getElementById("posInvoiceBadge") ||
      document.getElementById("posReceiptBadge") ||
      document.getElementById("receipt-count") ||
      null;

    if (badge) badge.textContent = String(count);

    // Broadcast
    window.dispatchEvent(new CustomEvent("cigaros:cart", { detail: { count } }));
  }

  // -------------------------
  // Cart API
  // -------------------------
  const API = {
    get cart() { return loadCart(); },
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
        saveCart(cart.filter((x) => x.id !== id));
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
  // Add-to-cart (capture phase so + buttons always work)
  // -------------------------
  function readAddPayload(el) {
    const d = el?.dataset || {};
    // price can appear as price / msrp
    const priceRaw = d.price ?? d.msrp ?? d.unitPrice ?? null;

    // category can appear as category / posCategory
    const category =
      d.category ?? d.posCategory ?? d.cat ?? "";

    // name can appear as name / product / cigar
    const name =
      d.name ?? d.product ?? d.cigar ?? "";

    // brand sometimes exists
    const brand =
      d.brand ?? d.line ?? d.manufacturer ?? "";

    // "sub" line (vitola or subtitle) often exists
    const sub =
      d.sub ?? d.vitola ?? d.subtitle ?? "";

    // type hint
    const type = (d.type || "").toLowerCase();

    const price = Number(priceRaw || "0");
    const hasBasics = (name && (priceRaw != null) && (category || type));

    if (!hasBasics) return null;

    const finalCategory =
      category ||
      (type === "cigar" ? "Cigars" : "Other");

    const finalType =
      type || (finalCategory.toLowerCase() === "cigars" ? "cigar" : "product");

    // Prefer supplied id/key if present
    const id =
      (d.id || d.key || (finalCategory + "|" + brand + "|" + name + "|" + sub)).toLowerCase();

    return {
      id,
      type: finalType,
      category: finalCategory,
      brand,
      name,
      sub,
      price
    };
  }

  function wireAdds() {
    document.addEventListener("click", (e) => {
      const t = e.target;

      // 1) Primary contract: any element (or ancestor) with [data-receipt-item]
      let el = t?.closest?.("[data-receipt-item]");

      // 2) Also support common + buttons on brand pages (in case they’re missing the attribute)
      if (!el) {
        el = t?.closest?.(
          ".pos-add, .row-add, .add, .add-btn, .plus, button[data-add], button[data-cart-add]"
        );
      }

      if (!el) return;
      if (el.hasAttribute("data-no-cart")) return;

      // If button is inside a row that holds the dataset, prefer the row’s dataset
      const row = el.closest?.("[data-receipt-item], [data-row], .brand-row, .row") || el;

      const payload =
        readAddPayload(row) ||
        readAddPayload(el);

      if (!payload) return;

      API.add(payload);
    }, true); // CAPTURE: ensures it fires even if other code stops propagation
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    injectInvoicePillCSSOnce();
    ensureInvoicePill();
    updateBadge();
    wireAdds();
  });
})();
