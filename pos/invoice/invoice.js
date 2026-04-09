/* /pos/invoice/invoice.js
   Invoice page
   - 3-section invoice layout
   - loyalty profile dropdown
   - cigar + product row rendering
   - split bill popup state
   - keep tab open / save to profile hooks
*/

(() => {
  "use strict";

  const CART_KEY = "cigaros_pos_cart_v3";
  const SHOP_KEYS = ["cigaros_pos_shop_name", "cigaros_shop_name", "shop_name"];
  const INV_KEY = "cigaros_pos_invoice_number";
  const POS_TAX_RATE = 0.07;

  const CONTACTS_URL = "/loyalty/loyalty-contacts.json";
  const SELECTED_CUSTOMER_KEY = "cigaros_pos_invoice_customer";

  const SPLIT_MODE_KEY = "cigaros_pos_invoice_split_mode";
  const OPEN_TABS_KEY = "cigaros_pos_open_tabs_v1";
  const OPEN_ORDERS_KEY = "cigaros_pos_open_orders_v1";
  const CUSTOMER_ORDER_HISTORY_KEY = "cigaros_pos_customer_order_history_v1";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const itemsEl = $("#invItems");
  const metaEl = $("#invMeta");
  const shopEl = $("#invShop");
  const numEl = $("#invNum");

  const customerBtn = $("#invCustomerBtn");
  const customerLabel = $("#invCustomerLabel");
  const customerMenu = $("#invCustomerMenu");
  const customerList = $("#invCustomerList");
  const customerSearch = $("#invCustomerSearch");

  const splitLink = $("#invSplitLink");
  const splitModeEl = $("#invSplitMode");
  const splitBillBtn = $("#splitBillBtn");
  const splitBillPopup = $("#splitBillPopup");
  const splitBillOptions = $$(".split-bill-option");

  const keepTabOpenBtn = $("#keepTabOpenBtn");
  const saveToProfileBtn = $("#saveToProfileBtn");
  const cashOutBtn = $("#cashOutBtn");

  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

  let loyaltyCustomersCache = [];
  let customersLoadingPromise = null;

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

  function readList(key) {
    const data = safeJSONParse(localStorage.getItem(key), []);
    return Array.isArray(data) ? data : [];
  }

  function writeList(key, value) {
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
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
    const cart = safeJSONParse(localStorage.getItem(CART_KEY), []);
    return Array.isArray(cart) ? cart : [];
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    document.dispatchEvent(
      new CustomEvent("cigaros:cart-changed", { detail: { cart } })
    );
    window.dispatchEvent(
      new CustomEvent("cigaros:cart", { detail: { cart } })
    );

    if (window.cigarOSCart?.updateBadges) {
      window.cigarOSCart.updateBadges();
    }
  }

  function formatHeaderStamp() {
    const d = new Date();

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const day = days[d.getDay()];

    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();

    let h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;

    const min = String(d.getMinutes()).padStart(2, "0");

    return `${day} ${mm}-${dd}-${yyyy} ${h}:${min} ${ampm}`;
  }

  function getShopName() {
    for (const key of SHOP_KEYS) {
      const value = localStorage.getItem(key);
      if (value && value.trim()) return value.trim();
    }
    return "Smoke Cigar Lounge";
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

  function isCigarItem(item) {
    return (
      normStr(item.type).toLowerCase() === "cigar" ||
      normStr(item.category).toLowerCase().includes("cigar") ||
      normStr(item.category).toLowerCase().includes("tobacco") ||
      normStr(item.vitola) !== ""
    );
  }

  function itemCategory(item) {
    if (isCigarItem(item)) return "Cigars";
    return normStr(item.category) || "Other";
  }

  function itemBrand(item) {
    return normStr(item.brand);
  }

  function itemLineName(item) {
    if (isCigarItem(item)) {
      const line = normStr(item.line);
      const name = normStr(item.name);

      if (line && name) {
        if (name.toLowerCase().startsWith(line.toLowerCase())) return name;
        return `${line} ${name}`;
      }

      return name || line || "Cigar";
    }

    return normStr(item.name) || normStr(item.line) || "Item";
  }

  function itemLineTwo(item) {
    if (isCigarItem(item)) {
      return itemBrand(item) || "—";
    }

    return itemBrand(item) || itemCategory(item) || "—";
  }

  function itemLineThree(item) {
    if (isCigarItem(item)) {
      const vitola = normStr(item.vitola);
      return `Cigars - ${vitola || "—"}`;
    }

    const category = itemCategory(item);
    const variation = normStr(item.variation);

    if (variation) return `${category} - ${variation}`;
    return category || "";
  }

  function buildLineOne(item) {
    const text = itemLineName(item);
    const url = toAbsUrl(item.url || "");

    if (!url) {
      const div = document.createElement("div");
      div.className = "inv-line1";
      div.textContent = text;
      return div;
    }

    const a = document.createElement("a");
    a.className = "inv-line1 inv-line1-link";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text;
    return a;
  }

  function buildRow(item) {
    const unit = numberFrom(item.msrp, 0);
    const qty = Math.max(0, Math.round(numberFrom(item.qty, 0)));
    const total = unit * qty;

    const row = document.createElement("article");
    row.className = "inv-row";

    row.innerHTML = `
      <div class="inv-thumb"><img alt="" loading="lazy" decoding="async" /></div>

      <div class="inv-copy">
        <div class="inv-line2"></div>
        <div class="inv-line3"></div>
        <div class="inv-line4"></div>

        <div class="inv-meta-row">
          <div class="inv-msrp-wrap">
            <label>MSRP</label>
            <div class="inv-msrp">${fmt(unit)}</div>
          </div>

          <div class="inv-qty-wrap">
            <span class="inv-qty-label">QTY</span>
            <label>QTY</label>
            <select class="inv-qty-select" aria-label="Quantity"></select>
          </div>

          <div class="inv-total-wrap">
            <div class="inv-total">${fmt(total)}</div>
          </div>
        </div>
      </div>
    `;

    const img = row.querySelector(".inv-thumb img");
    img.src = normStr(item.image) || "/img/icons/categories/other.png";
    img.onerror = () => {
      img.onerror = null;
      img.src = "/img/icons/categories/other.png";
    };

    const line1 = buildLineOne(item);
    row.querySelector(".inv-copy").prepend(line1);

    const line2 = itemLineTwo(item);
    const line3 = itemLineThree(item);

    row.querySelector(".inv-line2").textContent = line2 || "—";
    row.querySelector(".inv-line3").textContent = line3 || "";
    row.querySelector(".inv-line3").style.display = line3 ? "" : "none";

    const select = row.querySelector(".inv-qty-select");
    for (let i = 0; i <= 24; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `(${i})`;
      if (i === qty) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener("change", () => {
      setQty(item.key, Number(select.value));
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
    if (metaEl) metaEl.textContent = formatHeaderStamp();
    if (shopEl) shopEl.textContent = getShopName();
    if (numEl) numEl.textContent = `INV #${getInvoiceNumber()}`;
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

    cart.forEach((item) => {
      itemsEl.appendChild(buildRow(item));
    });
  }

  function renderTotals(cart) {
    const t = computeBuckets(cart);

    const tTobacco = $("#tTobacco");
    const tAlcohol = $("#tAlcohol");
    const tOther = $("#tOther");
    const tSubtotal = $("#tSubtotal");
    const tTax = $("#tTax");
    const tGrand = $("#tGrand");

    if (tTobacco) tTobacco.textContent = fmt(t.tobacco);
    if (tAlcohol) tAlcohol.textContent = fmt(t.alcohol);
    if (tOther) tOther.textContent = fmt(t.other);
    if (tSubtotal) tSubtotal.textContent = fmt(t.subtotal);
    if (tTax) tTax.textContent = fmt(t.tax);
    if (tGrand) tGrand.textContent = fmt(t.grand);
  }

  function normalizeCustomer(raw, index = 0) {
    if (!raw || typeof raw !== "object") return null;

    const first = normStr(raw["First Name"]);
    const last = normStr(raw["Last Name"]);
    const nickname = normStr(raw["Nickname “aka”"] || raw['Nickname "aka"'] || raw["Nickname"]);
    const email = normStr(raw["Email"]);
    const phone = normStr(raw["Phone"]);

    const displayName =
      nickname ||
      [first, last].filter(Boolean).join(" ").trim() ||
      email ||
      phone ||
      `Customer ${index + 1}`;

    const sub = [phone, email].filter(Boolean).join(" • ");
    const searchBlob = [first, last, nickname, email, phone].join(" ").toLowerCase();

    return {
      id: `${displayName}|${email}|${phone}|${index}`,
      name: displayName,
      sub,
      searchBlob
    };
  }

  async function loadCustomers() {
    if (loyaltyCustomersCache.length) return loyaltyCustomersCache;
    if (customersLoadingPromise) return customersLoadingPromise;

    customersLoadingPromise = fetch(CONTACTS_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        loyaltyCustomersCache = arr.map(normalizeCustomer).filter(Boolean);
        return loyaltyCustomersCache;
      })
      .catch((err) => {
        console.error("Failed to load loyalty contacts:", err);
        loyaltyCustomersCache = [];
        return [];
      })
      .finally(() => {
        customersLoadingPromise = null;
      });

    return customersLoadingPromise;
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
    customerSearch?.focus();
  }

  function renderSelectedCustomer() {
    const selected = loadSelectedCustomer();
    if (customerLabel) {
      customerLabel.textContent = selected?.name || "Select Profile";
    }
  }

  async function renderCustomerList(filterText = "") {
    if (!customerList) return;

    const q = normStr(filterText).toLowerCase();
    customerList.innerHTML = `<div class="inv-customer-empty">Loading customers…</div>`;

    const allCustomers = await loadCustomers();
    const customers = allCustomers.filter((c) => !q || c.searchBlob.includes(q));

    customerList.innerHTML = "";

    if (!customers.length) {
      customerList.innerHTML = `<div class="inv-customer-empty">No saved customers</div>`;
      return;
    }

    customers.slice(0, 100).forEach((customer) => {
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
    });
  }

  function setupCustomerMenu() {
    renderSelectedCustomer();

    customerBtn?.addEventListener("click", async () => {
      if (customerMenu?.hidden) {
        if (customerSearch) customerSearch.value = "";
        openCustomerMenu();
        await renderCustomerList("");
      } else {
        closeCustomerMenu();
      }
    });

    customerSearch?.addEventListener("input", async () => {
      await renderCustomerList(customerSearch.value);
    });

    document.addEventListener("click", (e) => {
      if (customerMenu && !customerMenu.hidden && !e.target.closest(".inv-customer-wrap")) {
        closeCustomerMenu();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCustomerMenu();
    });
  }

  function getSplitMode() {
    return normStr(localStorage.getItem(SPLIT_MODE_KEY));
  }

  function setSplitMode(mode) {
    localStorage.setItem(SPLIT_MODE_KEY, normStr(mode));
    renderSplitMode();
  }

  function splitModeLabel(mode) {
    switch (mode) {
      case "alcohol-separate":
        return "Alcohol Separate selected";
      case "tobacco-separate":
        return "Tobacco Separate selected";
      case "food-separate":
        return "Food Separate selected";
      case "custom-split":
        return "Custom Split selected";
      default:
        return "No split selected";
    }
  }

  function renderSplitMode() {
    const mode = getSplitMode();

    if (splitModeEl) {
      splitModeEl.textContent = splitModeLabel(mode);
    }

    splitBillOptions.forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.splitMode === mode);
    });
  }

  function openSplitBillPopup() {
    if (!splitBillPopup || !splitBillBtn) return;
    splitBillPopup.classList.add("is-open");
    splitBillBtn.setAttribute("aria-expanded", "true");
  }

  function closeSplitBillPopup() {
    if (!splitBillPopup || !splitBillBtn) return;
    splitBillPopup.classList.remove("is-open");
    splitBillBtn.setAttribute("aria-expanded", "false");
  }

  function toggleSplitBillPopup() {
    if (!splitBillPopup) return;
    if (splitBillPopup.classList.contains("is-open")) {
      closeSplitBillPopup();
    } else {
      openSplitBillPopup();
    }
  }

  function setupSplitBillPopup() {
    splitBillBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSplitBillPopup();
    });

    splitLink?.addEventListener("click", () => {
      openSplitBillPopup();
    });

    splitBillOptions.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = normStr(btn.dataset.splitMode);
        setSplitMode(mode);
        closeSplitBillPopup();
      });
    });

    document.addEventListener("click", (e) => {
      if (
        splitBillPopup?.classList.contains("is-open") &&
        !e.target.closest(".inv-action-wrap") &&
        !e.target.closest(".inv-summary-left")
      ) {
        closeSplitBillPopup();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSplitBillPopup();
    });

    renderSplitMode();
  }

  function buildOrderSnapshot(cart) {
    const totals = computeBuckets(cart);
    const selectedCustomer = loadSelectedCustomer();

    return {
      id: `ord_${Date.now()}`,
      invoiceNumber: getInvoiceNumber(),
      createdAt: new Date().toISOString(),
      createdAtLabel: formatHeaderStamp(),
      shopName: getShopName(),
      customer: selectedCustomer || null,
      splitMode: getSplitMode() || "",
      items: cart.map((item) => ({
        ...item,
        qty: Math.max(0, Math.round(numberFrom(item.qty, 0))),
        msrp: numberFrom(item.msrp, 0)
      })),
      totals
    };
  }

  function handleKeepTabOpen() {
    const cart = loadCart();
    if (!cart.length) {
      window.alert("There are no items on this invoice yet.");
      return;
    }

    const note = window.prompt("Add a note for this open tab:");
    if (note == null) return;

    const tabs = readList(OPEN_TABS_KEY);
    const nextNumber = tabs.length + 1;
    const order = buildOrderSnapshot(cart);

    tabs.unshift({
      id: `tab_${Date.now()}`,
      tabNumber: nextNumber,
      label: `Open Tab #${nextNumber}${normStr(note) ? ` — ${normStr(note)}` : ""}`,
      note: normStr(note),
      status: "open-tab",
      ...order
    });

    writeList(OPEN_TABS_KEY, tabs);
    window.alert("Tab saved to Open Tabs.");
  }

  function handleSaveToProfile() {
    const cart = loadCart();
    if (!cart.length) {
      window.alert("There are no items on this invoice yet.");
      return;
    }

    const customer = loadSelectedCustomer();
    if (!customer) {
      window.alert("Select a loyalty profile first.");
      return;
    }

    const order = buildOrderSnapshot(cart);

    const openOrders = readList(OPEN_ORDERS_KEY);
    openOrders.unshift({
      id: `open_${Date.now()}`,
      status: "open-order",
      ...order
    });
    writeList(OPEN_ORDERS_KEY, openOrders);

    const history = safeJSONParse(localStorage.getItem(CUSTOMER_ORDER_HISTORY_KEY), {});
    const list = Array.isArray(history[customer.id]) ? history[customer.id] : [];
    list.unshift(order);
    history[customer.id] = list;
    localStorage.setItem(CUSTOMER_ORDER_HISTORY_KEY, JSON.stringify(history));

    window.alert(`Order saved to ${customer.name}'s profile and Open Orders.`);
  }

  function handleCashOut() {
    const cart = loadCart();
    if (!cart.length) {
      window.alert("There are no items on this invoice yet.");
      return;
    }

    document.dispatchEvent(
      new CustomEvent("cigaros:invoice-cashout", {
        detail: {
          invoiceNumber: getInvoiceNumber(),
          cart,
          totals: computeBuckets(cart),
          splitMode: getSplitMode()
        }
      })
    );

    window.alert("Cash Out is ready to connect to your payment flow next.");
  }

  function setupActionButtons() {
    keepTabOpenBtn?.addEventListener("click", handleKeepTabOpen);
    saveToProfileBtn?.addEventListener("click", handleSaveToProfile);
    cashOutBtn?.addEventListener("click", handleCashOut);
  }

  function render() {
    const cart = loadCart();
    renderHeader();
    renderItems(cart);
    renderTotals(cart);
    renderSelectedCustomer();
    renderSplitMode();
  }

  function handleStorage(e) {
    if (
      !e ||
      !e.key ||
      e.key === CART_KEY ||
      SHOP_KEYS.includes(e.key) ||
      e.key === INV_KEY ||
      e.key === SELECTED_CUSTOMER_KEY ||
      e.key === SPLIT_MODE_KEY
    ) {
      render();
    }
  }

  document.addEventListener("cigaros:cart-changed", render);
  window.addEventListener("cigaros:cart", render);
  window.addEventListener("storage", handleStorage);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });

  document.addEventListener("DOMContentLoaded", async () => {
    setupCustomerMenu();
    setupSplitBillPopup();
    setupActionButtons();
    render();
    await loadCustomers();
  });
})();
