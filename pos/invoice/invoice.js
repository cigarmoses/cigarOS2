/* /pos/invoice/invoice.js
   Invoice page renderer (reads cart from localStorage)

   Works with the NEW /pos/cart.js (cart stored under "cigaros_pos_cart_v3")
   ✅ Renders rows into #invItems
   ✅ Qty +/- updates localStorage + triggers re-render
   ✅ Totals + 7% tax (simple default)
*/

(() => {
  "use strict";

  const CART_KEY = "cigaros_pos_cart_v3";
  const SHOP_KEY = "cigaros_pos_shop_name";
  const INV_KEY  = "cigaros_pos_invoice_number";
  const POS_TAX_RATE = 0.07;

  const $ = (sel, root = document) => root.querySelector(sel);

  const itemsEl = $("#invItems");
  const metaEl  = $("#invMeta");
  const shopEl  = $("#invShop");
  const numEl   = $("#invNum");

  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

  function safeJSONParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function loadCart() {
    return safeJSONParse(localStorage.getItem(CART_KEY), []) || [];
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    document.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: { cart } }));
  }

  function nowStamp() {
    const d = new Date();
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const day = days[d.getDay()];
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    let h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${day}  ${mm}/${dd}/${yyyy}  ${h}:${min} ${ampm}`;
  }

  function getShopName() {
    return localStorage.getItem(SHOP_KEY) || "Shop";
  }

  function getInvoiceNumber() {
    // Keep it stable until cleared; generate a readable number if missing
    let inv = localStorage.getItem(INV_KEY);
    if (inv) return inv;

    const d = new Date();
    const y = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rnd = String(Math.floor(Math.random() * 9000) + 1000);
    inv = `${y}${mm}${dd}-${rnd}`;
    localStorage.setItem(INV_KEY, inv);
    return inv;
  }

  function iconFor(item) {
    // Prefer explicit image if stored by cart.js / dataset
    if (item.image) return item.image;

    // Fallbacks by type/category
    const t = String(item.type || item.category || "").toLowerCase();
    if (t.includes("cigar")) return "/img/icons/categories/cigars.png";
    if (t.includes("accessor")) return "/img/icons/categories/accessories.png";
    if (t.includes("ash")) return "/img/icons/categories/ashtrays.png";
    if (t.includes("pipe")) return "/img/icons/categories/pipes.png";
    if (t.includes("food") || t.includes("bev")) return "/img/icons/categories/foodandbevs.png";
    return "/img/icons/categories/other.png";
  }

  function isCigarItem(item) {
    const t = String(item.type || "").toLowerCase();
    if (t === "cigar") return true;
    const c = String(item.category || "").toLowerCase();
    return c.includes("cigar");
  }

  function buildRow(item) {
    const isCigar = isCigarItem(item);

    // TEXT RULES (your spec)
    let t1, t2, t3;
    if (isCigar) {
      const brand = item.brand ? String(item.brand) : "";
      t1 = brand ? `Cigars - ${brand}` : "Cigars";
      // name is stored as line+name in your cart add flow sometimes; keep as-is
      t2 = String(item.name || "Cigar");
      t3 = String(item.vitola || item.sub || "");
    } else {
      t1 = String(item.category || "Other");
      t2 = String(item.brand || "-");
      t3 = String(item.name || "Item");
    }

    const unit = Number(item.msrp ?? item.price ?? 0);
    const qty  = Number(item.qty || 0);
    const total = unit * qty;

    const row = document.createElement("article");
    row.className = "inv-row";

    row.innerHTML = `
      <div class="inv-icon"><img alt="" loading="lazy" decoding="async"></div>

      <div class="inv-desc">
        <div class="t1"></div>
        <div class="t2"></div>
        <div class="t3"></div>
      </div>

      <div class="inv-unit">${fmt(unit)}</div>

      <div class="inv-qty" aria-label="Quantity">
        <button class="dec" type="button" aria-label="Decrease">−</button>
        <div class="qnum">${qty}</div>
        <button class="inc" type="button" aria-label="Increase">+</button>
      </div>

      <div class="inv-total">${fmt(total)}</div>
    `;

    const img = row.querySelector(".inv-icon img");
    img.src = iconFor(item);

    row.querySelector(".t1").textContent = t1;
    row.querySelector(".t2").textContent = t2;
    row.querySelector(".t3").textContent = t3;

    row.querySelector(".dec").addEventListener("click", () => {
      setQty(item.key, qty - 1);
    });

    row.querySelector(".inc").addEventListener("click", () => {
      setQty(item.key, qty + 1);
    });

    return row;
  }

  function setQty(itemKey, newQty) {
    const cart = loadCart();
    const idx = cart.findIndex((x) => x.key === itemKey);
    if (idx === -1) return;

    const q = Number(newQty || 0);

    if (q <= 0) {
      cart.splice(idx, 1);
    } else {
      cart[idx].qty = q;
    }

    saveCart(cart);
    render();
  }

  function computeBuckets(cart) {
    let tobacco = 0, alcohol = 0, other = 0;

    for (const it of cart) {
      const unit = Number(it.msrp ?? it.price ?? 0);
      const line = unit * Number(it.qty || 0);

      const bucket = String(it.bucket || it.category || it.type || "").toLowerCase();

      if (bucket.includes("alcohol")) {
        alcohol += line;
      } else if (bucket.includes("tobacco") || bucket.includes("cigar")) {
        tobacco += line;
      } else if (isCigarItem(it)) {
        // Treat cigars as tobacco even if bucket is missing
        tobacco += line;
      } else {
        other += line;
      }
    }

    const subtotal = tobacco + alcohol + other;

    // Simple default: 7% sales tax on subtotal
    // If you later implement category-specific tax rules, adjust here.
    const tax = subtotal * POS_TAX_RATE;
    const grand = subtotal + tax;

    return { tobacco, alcohol, other, subtotal, tax, grand };
  }

  function render() {
    const cart = loadCart();

    // header
    if (metaEl) metaEl.textContent = nowStamp();
    if (shopEl) shopEl.textContent = getShopName();
    if (numEl)  numEl.textContent  = `INV# ${getInvoiceNumber()}`;

    // items
    if (!itemsEl) return;
    itemsEl.innerHTML = "";

    if (!cart.length) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "No items yet.";
      itemsEl.appendChild(empty);
    } else {
      for (const it of cart) itemsEl.appendChild(buildRow(it));
    }

    // totals
    const t = computeBuckets(cart);
    const tTobacco  = $("#tTobacco");
    const tAlcohol  = $("#tAlcohol");
    const tOther    = $("#tOther");
    const tSubtotal = $("#tSubtotal");
    const tTax      = $("#tTax");
    const tGrand    = $("#tGrand");

    if (tTobacco)  tTobacco.textContent  = fmt(t.tobacco);
    if (tAlcohol)  tAlcohol.textContent  = fmt(t.alcohol);
    if (tOther)    tOther.textContent    = fmt(t.other);
    if (tSubtotal) tSubtotal.textContent = fmt(t.subtotal);
    if (tTax)      tTax.textContent      = fmt(t.tax);
    if (tGrand)    tGrand.textContent    = fmt(t.grand);
  }

  // Re-render when cart changes (new cart.js emits this)
  document.addEventListener("cigaros:cart-changed", render);

  // Back-compat: if anything emits this older event
  window.addEventListener("cigaros:cart", render);

  document.addEventListener("DOMContentLoaded", render);
})();
