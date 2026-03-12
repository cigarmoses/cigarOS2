/* /pos/invoice/invoice.js */

(() => {
  "use strict";

  const CART_KEYS = [
    "cigaros_pos_cart_v3",
    "cigaros_pos_cart_v2",
    "cigaros_pos_cart",
    "cigaros_cart",
    "pos_cart",
    "cart"
  ];

  const SHOP_KEYS = [
    "cigaros_pos_shop_name",
    "cigaros_shop_name",
    "shop_name"
  ];

  const INV_KEY = "cigaros_pos_invoice_number";
  const POS_TAX_RATE = 0.07;

  const $ = (sel, root = document) => root.querySelector(sel);

  const itemsEl = $("#invItems");
  const metaEl  = $("#invMeta");
  const shopEl  = $("#invShop");
  const numEl   = $("#invNum");

  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

  function safeJSONParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function normalizeText(value, fallback = "") {
    if (value == null) return fallback;
    const out = String(value).trim();
    return out || fallback;
  }

  function numberFrom(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeItem(raw, index = 0) {
    if (!raw || typeof raw !== "object") return null;

    const brand = normalizeText(raw.brand || raw.maker || raw.company || "");
    const name =
      normalizeText(
        raw.name ||
        raw.title ||
        raw.productName ||
        raw.product ||
        raw.label ||
        "Item"
      );

    const vitola =
      normalizeText(
        raw.vitola ||
        raw.size ||
        raw.sub ||
        raw.subtitle ||
        raw.style ||
        raw.line ||
        ""
      );

    const category =
      normalizeText(
        raw.category ||
        raw.group ||
        raw.bucket ||
        raw.department ||
        ""
      );

    const type =
      normalizeText(
        raw.type ||
        raw.kind ||
        (category.toLowerCase().includes("cigar") ? "cigar" : "")
      );

    const image =
      normalizeText(
        raw.image ||
        raw.img ||
        raw.photo ||
        raw.icon ||
        raw.logo ||
        ""
      );

    const price = numberFrom(
      raw.msrp ??
      raw.price ??
      raw.unitPrice ??
      raw.unit_price ??
      raw.cost ??
      0,
      0
    );

    const qty = Math.max(
      0,
      Math.round(
        numberFrom(raw.qty ?? raw.quantity ?? raw.count ?? 1, 1)
      )
    );

    const key = normalizeText(
      raw.key ||
      raw.id ||
      raw.sku ||
      raw.slug ||
      `${brand}|${name}|${vitola}|${price}|${index}`
    );

    return {
      key,
      brand,
      name,
      vitola,
      category,
      type,
      image,
      msrp: price,
      qty
    };
  }

  function cartArrayFromUnknownShape(value) {
    if (Array.isArray(value)) {
      return value.map(normalizeItem).filter(Boolean);
    }

    if (!value || typeof value !== "object") {
      return [];
    }

    if (Array.isArray(value.items)) {
      return value.items.map(normalizeItem).filter(Boolean);
    }

    if (Array.isArray(value.cart)) {
      return value.cart.map(normalizeItem).filter(Boolean);
    }

    const vals = Object.values(value);
    if (vals.every((v) => v && typeof v === "object")) {
      return vals.map(normalizeItem).filter(Boolean);
    }

    return [];
  }

  function getActiveCartKey() {
    for (const key of CART_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = safeJSONParse(raw, null);
      const arr = cartArrayFromUnknownShape(parsed);
      if (arr.length) return key;
    }

    return CART_KEYS[0];
  }

  function loadCart() {
    for (const key of CART_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = safeJSONParse(raw, null);
      const arr = cartArrayFromUnknownShape(parsed);
      if (arr.length) return arr;
    }

    return [];
  }

  function saveCart(cart) {
    const activeKey = getActiveCartKey();
    localStorage.setItem(activeKey, JSON.stringify(cart));

    const detail = { cart, key: activeKey };

    document.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail }));
    window.dispatchEvent(new CustomEvent("cigaros:cart", { detail }));
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
    h = h % 12;
    if (h === 0) h = 12;

    const min = String(d.getMinutes()).padStart(2, "0");
    return `${day}  ${mm}/${dd}/${yyyy}  ${h}:${min} ${ampm}`;
  }

  function getShopName() {
    for (const key of SHOP_KEYS) {
      const value = localStorage.getItem(key);
      if (value && value.trim()) return value.trim();
    }
    return "Shop";
  }

  function getInvoiceNumber() {
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
    if (item.image) return item.image;

    const t = `${item.type} ${item.category}`.toLowerCase();

    if (t.includes("cigar")) return "/img/icons/categories/cigars.png";
    if (t.includes("accessor")) return "/img/icons/categories/accessories.png";
    if (t.includes("ash")) return "/img/icons/categories/ashtrays.png";
    if (t.includes("pipe")) return "/img/icons/categories/pipes.png";
    if (t.includes("food") || t.includes("bev")) return "/img/icons/categories/foodandbevs.png";
    if (t.includes("alcohol")) return "/img/icons/categories/foodandbevs.png";

    return "/img/icons/categories/other.png";
  }

  function isCigarItem(item) {
    const t = normalizeText(item.type).toLowerCase();
    const c = normalizeText(item.category).toLowerCase();

    return (
      t === "cigar" ||
      c.includes("cigar") ||
      c.includes("tobacco") ||
      normalizeText(item.vitola) !== ""
    );
  }

  function buildRow(item) {
    const isCigar = isCigarItem(item);

    let t1, t2, t3;

    if (isCigar) {
      t1 = item.brand ? `Cigars - ${item.brand}` : "Cigars";
      t2 = item.name || "Cigar";
      t3 = item.vitola || "";
    } else {
      t1 = item.category || "Other";
      t2 = item.brand || "-";
      t3 = item.name || "Item";
    }

    const unit = numberFrom(item.msrp, 0);
    const qty = Math.max(0, Math.round(numberFrom(item.qty, 0)));
    const total = unit * qty;

    const row = document.createElement("article");
    row.className = "inv-row";

    row.innerHTML = `
      <div class="inv-icon"><img alt="" loading="lazy" decoding="async" /></div>

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
    img.onerror = () => {
      img.onerror = null;
      img.src = "/img/icons/categories/other.png";
    };

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

    const q = Math.max(0, Math.round(numberFrom(newQty, 0)));

    if (q <= 0) {
      cart.splice(idx, 1);
    } else {
      cart[idx].qty = q;
    }

    saveCart(cart);
    render();
  }

  function computeBuckets(cart) {
    let tobacco = 0;
    let alcohol = 0;
    let other = 0;

    for (const it of cart) {
      const unit = numberFrom(it.msrp, 0);
      const qty = Math.max(0, Math.round(numberFrom(it.qty, 0)));
      const line = unit * qty;

      const bucket = `${it.category} ${it.type}`.toLowerCase();

      if (bucket.includes("alcohol")) {
        alcohol += line;
      } else if (bucket.includes("tobacco") || bucket.includes("cigar") || isCigarItem(it)) {
        tobacco += line;
      } else {
        other += line;
      }
    }

    const subtotal = tobacco + alcohol + other;
    const tax = subtotal * POS_TAX_RATE;
    const grand = subtotal + tax;

    return { tobacco, alcohol, other, subtotal, tax, grand };
  }

  function renderHeader() {
    if (metaEl) metaEl.textContent = nowStamp();
    if (shopEl) shopEl.textContent = getShopName();
    if (numEl) numEl.textContent = `INV# ${getInvoiceNumber()}`;
  }

  function renderItems(cart) {
    if (!itemsEl) return;

    itemsEl.innerHTML = "";

    if (!cart.length) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "No items yet.";
      itemsEl.appendChild(empty);
      return;
    }

    for (const item of cart) {
      itemsEl.appendChild(buildRow(item));
    }
  }

  function renderTotals(cart) {
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
    if (tSubtotal) tTobacco && (tSubtotal.textContent = fmt(t.subtotal));
    if (tTax)      tTax.textContent      = fmt(t.tax);
    if (tGrand)    tGrand.textContent    = fmt(t.grand);
  }

  function render() {
    const cart = loadCart();
    renderHeader();
    renderItems(cart);
    renderTotals(cart);
  }

  function handleStorage(e) {
    if (!e || !e.key || CART_KEYS.includes(e.key) || SHOP_KEYS.includes(e.key) || e.key === INV_KEY) {
      render();
    }
  }

  document.addEventListener("cigaros:cart-changed", render);
  window.addEventListener("cigaros:cart", render);
  window.addEventListener("storage", handleStorage);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
  document.addEventListener("DOMContentLoaded", render);
})();
