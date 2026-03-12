/* /pos/invoice/invoice.js */

(() => {
  "use strict";

  const CART_KEY = "cigaros_pos_cart_v3";
  const SHOP_KEYS = [
    "cigaros_pos_shop_name",
    "cigaros_shop_name",
    "shop_name"
  ];
  const INV_KEY = "cigaros_pos_invoice_number";
  const POS_TAX_RATE = 0.07;

  const CUSTOMER_KEYS = [
    "cigaros_pos_customers_v3",
    "cigaros_pos_customers_v2",
    "cigaros_pos_customers_v1",
    "cigaros_pos_customers",
    "cigaros_customers",
    "customers",
    "customer_list",
    "saved_customers",
    "loyalty_customers",
    "cigaros_loyalty_customers"
  ];

  const SELECTED_CUSTOMER_KEY = "cigaros_pos_invoice_customer";

  const $ = (sel, root = document) => root.querySelector(sel);

  const itemsEl = $("#invItems");
  const metaEl = $("#invMeta");
  const shopEl = $("#invShop");
  const numEl = $("#invNum");

  const customerBtn = $("#invCustomerBtn");
  const customerLabel = $("#invCustomerLabel");
  const customerMenu = $("#invCustomerMenu");
  const customerList = $("#invCustomerList");
  const customerSearch = $("#invCustomerSearch");
  const customerSelected = $("#invCustomerSelected");

  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

  function safeJSONParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function normStr(value, fallback = "") {
    if (value == null) return fallback;
    const out = String(value).trim();
    return out || fallback;
  }

  function numberFrom(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function toAbsUrl(url) {
    const u = normStr(url);
    if (!u) return "";
    try {
      return new URL(u, window.location.origin).href;
    } catch {
      return u;
    }
  }

  function loadCart() {
    return safeJSONParse(localStorage.getItem(CART_KEY), []) || [];
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    document.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: { cart } }));
    window.dispatchEvent(new CustomEvent("cigaros:cart", { detail: { cart } }));
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
    return `${day} ${mm}/${dd}/${yyyy} ${h}:${min} ${ampm}`;
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
    const t = normStr(item.type).toLowerCase();
    const c = normStr(item.category).toLowerCase();

    return (
      t === "cigar" ||
      c.includes("cigar") ||
      c.includes("tobacco") ||
      normStr(item.vitola) !== ""
    );
  }

  function lineNameFor(item) {
    const a = normStr(item.line);
    const b = normStr(item.name);

    if (a && b) {
      if (b.toLowerCase().startsWith(a.toLowerCase())) return b;
      return `${a} ${b}`;
    }
    return b || a || "Cigar";
  }

  function buildDescMiddle(item) {
    const text = lineNameFor(item);
    const url = toAbsUrl(item.url || item.href || item.link || "");

    if (!url) {
      const div = document.createElement("div");
      div.className = "t2";
      div.textContent = text;
      return div;
    }

    const a = document.createElement("a");
    a.className = "t2-link";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text;
    return a;
  }

  function buildRow(item) {
    const isCigar = isCigarItem(item);

    const t1 = isCigar ? (item.brand ? item.brand : "Cigars") : (item.category || "Other");
    const t3 = isCigar ? (item.vitola || "") : (item.brand || "");

    const unit = numberFrom(item.msrp, 0);
    const qty = Math.max(0, Math.round(numberFrom(item.qty, 0)));
    const total = unit * qty;

    const row = document.createElement("article");
    row.className = "inv-row";

    row.innerHTML = `
      <div class="inv-icon"><img alt="" loading="lazy" decoding="async" /></div>

      <div class="inv-desc">
        <div class="t1"></div>
        <div class="t3"></div>
      </div>

      <div class="inv-side">
        <div class="inv-unit">${fmt(unit)}</div>
        <div class="inv-qty" aria-label="Quantity">
          <button class="dec" type="button" aria-label="Decrease">−</button>
          <div class="qnum">${qty}</div>
          <button class="inc" type="button" aria-label="Increase">+</button>
        </div>
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
    const middle = buildDescMiddle(item);
    row.querySelector(".inv-desc .t1").after(middle);
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
    if (tSubtotal) tSubtotal.textContent = fmt(t.subtotal);
    if (tTax)      tTax.textContent      = fmt(t.tax);
    if (tGrand)    tGrand.textContent    = fmt(t.grand);
  }

  function collectCustomersFromValue(value) {
    if (!value) return [];

    if (Array.isArray(value)) return value;
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.customers)) return value.customers;
    if (Array.isArray(value.results)) return value.results;
    if (Array.isArray(value.data)) return value.data;

    if (typeof value === "object") {
      const vals = Object.values(value);
      if (vals.some((v) => v && typeof v === "object")) return vals;
    }

    return [];
  }

  function normalizeCustomer(raw, index = 0) {
    if (!raw || typeof raw !== "object") return null;

    const id = normStr(raw.id || raw.customerId || raw.customer_id || `cust-${index}`);
    const first = normStr(raw.firstName || raw.first_name || "");
    const last = normStr(raw.lastName || raw.last_name || "");
    const name = normStr(raw.name || raw.fullName || raw.full_name || `${first} ${last}`.trim());

    const phone = normStr(raw.phone || raw.phoneNumber || raw.mobile || raw.cell || "");
    const email = normStr(raw.email || raw.emailAddress || "");
    const cigarsocial = normStr(raw.cigarsocial || raw.username || raw.handle || raw.cigarSocial || "");
    const loyaltyId = normStr(raw.loyaltyId || raw.loyalty_id || "");

    const displayName = name || email || phone || loyaltyId || "Unnamed customer";
    const sub = [phone, email, cigarsocial, loyaltyId].filter(Boolean).join(" • ");

    return { id, name: displayName, phone, email, cigarsocial, loyaltyId, sub, raw };
  }

  function loadCustomers() {
    const all = [];

    for (const key of CUSTOMER_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = safeJSONParse(raw, null);
      const arr = collectCustomersFromValue(parsed)
        .map(normalizeCustomer)
        .filter(Boolean);

      for (const customer of arr) {
        if (!all.some((x) => x.id === customer.id || (x.name === customer.name && x.sub === customer.sub))) {
          all.push(customer);
        }
      }
    }

    return all;
  }

  function loadSelectedCustomer() {
    return safeJSONParse(localStorage.getItem(SELECTED_CUSTOMER_KEY), null);
  }

  function saveSelectedCustomer(customer) {
    localStorage.setItem(SELECTED_CUSTOMER_KEY, JSON.stringify(customer || null));
  }

  function closeCustomerMenu() {
    if (!customerMenu || !customerBtn) return;
    customerMenu.hidden = true;
    customerBtn.setAttribute("aria-expanded", "false");
  }

  function openCustomerMenu() {
    if (!customerMenu || !customerBtn) return;
    customerMenu.hidden = false;
    customerBtn.setAttribute("aria-expanded", "true");
    if (customerSearch) customerSearch.focus();
  }

  function renderSelectedCustomer() {
    if (!customerSelected || !customerLabel) return;

    const selected = loadSelectedCustomer();

    if (!selected || !selected.name) {
      customerLabel.textContent = "ATTACH SAVED CUSTOMER";
      customerSelected.hidden = true;
      customerSelected.innerHTML = "";
      return;
    }

    customerLabel.textContent = selected.name.toUpperCase();
    customerSelected.hidden = false;
    customerSelected.innerHTML = `
      <div class="cust-name">${selected.name}</div>
      <div class="cust-sub">${selected.sub || "Saved customer attached"}</div>
    `;
  }

  function renderCustomerList(filterText = "") {
    if (!customerList) return;

    const q = normStr(filterText).toLowerCase();
    const customers = loadCustomers().filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.sub.toLowerCase().includes(q)
      );
    });

    customerList.innerHTML = "";

    if (!customers.length) {
      const empty = document.createElement("div");
      empty.className = "inv-customer-empty";
      empty.innerHTML = `
        <div class="inv-customer-name">No saved customers</div>
        <div class="inv-customer-sub">Nothing matched your search.</div>
      `;
      customerList.appendChild(empty);
      return;
    }

    for (const customer of customers) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inv-customer-item";
      btn.innerHTML = `
        <div class="inv-customer-name">${customer.name}</div>
        <div class="inv-customer-sub">${customer.sub || "Saved customer"}</div>
      `;
      btn.addEventListener("click", () => {
        saveSelectedCustomer(customer);
        renderSelectedCustomer();
        closeCustomerMenu();
      });
      customerList.appendChild(btn);
    }
  }

  function setupCustomerMenu() {
    if (!customerBtn || !customerMenu) return;

    renderSelectedCustomer();
    renderCustomerList("");

    customerBtn.addEventListener("click", () => {
      if (customerMenu.hidden) {
        if (customerSearch) customerSearch.value = "";
        renderCustomerList("");
        openCustomerMenu();
      } else {
        closeCustomerMenu();
      }
    });

    if (customerSearch) {
      customerSearch.addEventListener("input", () => {
        renderCustomerList(customerSearch.value);
      });
    }

    document.addEventListener("click", (e) => {
      if (!customerMenu.hidden && !e.target.closest(".inv-customer-wrap")) {
        closeCustomerMenu();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCustomerMenu();
    });
  }

  function render() {
    const cart = loadCart();
    renderHeader();
    renderItems(cart);
    renderTotals(cart);
    renderSelectedCustomer();
  }

  function handleStorage(e) {
    if (
      !e || !e.key ||
      e.key === CART_KEY ||
      SHOP_KEYS.includes(e.key) ||
      e.key === INV_KEY ||
      CUSTOMER_KEYS.includes(e.key) ||
      e.key === SELECTED_CUSTOMER_KEY
    ) {
      render();
      renderCustomerList(customerSearch ? customerSearch.value : "");
    }
  }

  document.addEventListener("cigaros:cart-changed", render);
  window.addEventListener("cigaros:cart", render);
  window.addEventListener("storage", handleStorage);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });

  document.addEventListener("DOMContentLoaded", () => {
    setupCustomerMenu();
    render();
  });
})();
