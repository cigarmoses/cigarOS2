/* /pos/cart.js
   Shared POS Cart + INVOICE modal controller (ALL POS pages)

   FIXES IN THIS VERSION:
   ✅ Invoice row NEVER causes horizontal scrolling (matches invoice.css grid)
   ✅ Cigars show: (Line + Cigar) / Vitola / MSRP (unit)
   ✅ Non-cigars show: Category / Product Name / MSRP (unit)
   ✅ Non-cigar category no longer falls back to "Product" when we can infer it
      (infers from payload, dataset, link, or current /pos/{category}/ page)
   ✅ Works on ALL POS pages (injects FAB/backdrop/sheet markup if missing)
   ✅ Add to cart: ONLY from + buttons (row-add / pos-add)
*/

(() => {
  "use strict";

  // -------------------------
  // Storage keys
  // -------------------------
  const CART_KEY = "cigaros_pos_cart_v2";
  const SHOP_KEY = "cigaros_pos_shop_name";
  const INV_KEY = "cigaros_pos_invoice_number";
  const CUSTOMER_DB_KEY = "cigaros_pos_customers_v1";
  const SELECTED_CUSTOMER_KEY = "cigaros_pos_selected_customer_v1";

  const TAX_RATE = 0.07;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // -------------------------
  // State
  // -------------------------
  const state = {
    items: [],
    selectedCustomer: null, // { id, name, phone }
  };

  // -------------------------
  // Helpers
  // -------------------------
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const toNum = (v) => {
    const n = Number(String(v ?? "").replace(/[^0-9.]+/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const money = (n) => toNum(n).toFixed(2);

  function safeParseJSON(s, fallback) {
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  }

  function escapeHTML(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function slugifyBrand(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .replace(/^\-+|\-+$/g, "");
  }

  function titleCase(s) {
    const x = String(s || "").trim();
    if (!x) return "";
    return x
      .split(/\s+/g)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  function categoryFromPath(pathname) {
    const p = String(pathname || location.pathname || "").toLowerCase();
    if (p.includes("/pos/ashtrays")) return "Ashtrays";
    if (p.includes("/pos/accessories")) return "Accessories";
    if (p.includes("/pos/foodandbevs")) return "Food & Bevs";
    if (p.includes("/pos/pipes")) return "Pipes";
    if (p.includes("/pos/packs")) return "Packs";
    if (p.includes("/pos/cigars")) return "Cigars";
    return "";
  }

  function categoryFromLink(link) {
    const s = String(link || "").toLowerCase();
    if (!s) return "";
    if (s.includes("/pos/ashtrays")) return "Ashtrays";
    if (s.includes("/pos/accessories")) return "Accessories";
    if (s.includes("/pos/foodandbevs")) return "Food & Bevs";
    if (s.includes("/pos/pipes")) return "Pipes";
    if (s.includes("/pos/packs")) return "Packs";
    if (s.includes("/pos/cigars")) return "Cigars";
    return "";
  }

  function getShopName() {
    return localStorage.getItem(SHOP_KEY) || "Smoke Cigar Shop";
  }

  function getInvoiceNumber() {
    let inv = localStorage.getItem(INV_KEY);
    if (!inv) {
      inv = String(Math.floor(100000 + Math.random() * 900000));
      localStorage.setItem(INV_KEY, inv);
    }
    return inv;
  }

  function getNowLabel() {
    const d = new Date();
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function loadCart() {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = safeParseJSON(raw, null);
    if (parsed && Array.isArray(parsed.items)) state.items = parsed.items;

    const sel = safeParseJSON(localStorage.getItem(SELECTED_CUSTOMER_KEY), null);
    if (sel && sel.id) state.selectedCustomer = sel;
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify({ items: state.items }));
  }

  function setSelectedCustomer(c) {
    state.selectedCustomer = c || null;
    localStorage.setItem(SELECTED_CUSTOMER_KEY, JSON.stringify(state.selectedCustomer));
    renderCustomerLabel();
  }

  function getItemCount() {
    return state.items.reduce((sum, it) => sum + clamp(Number(it.qty || 0), 0, 999), 0);
  }

  function makeStableId(item) {
    const bits = [
      item.type || "product",
      item.category || "",
      item.brand || "",
      item.name || "",
      item.vitola || item.sub || "",
      String(item.price || ""),
    ].map((s) => String(s || "").trim().toLowerCase());
    return bits.join("|");
  }

  function isCigarItem(item) {
    const t = String(item?.type || "").toLowerCase();
    const c = String(item?.category || "").toLowerCase();
    return t === "cigar" || c === "cigars";
  }

  // -------------------------
  // DOM refs (created if missing)
  // -------------------------
  let fabBtn, badgeEl, fabImg;
  let backdropEl, sheetEl, itemsEl;
  let custOverlay;

  function ensureBaseMarkup() {
    // FAB
    if (!$("#receipt-open")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "receipt-fab";
      btn.id = "receipt-open";
      btn.setAttribute("aria-label", "Invoice");
      btn.innerHTML = `
        <img src="/img/icons/receipt.png" alt="" />
        <span class="receipt-badge" id="receipt-count" hidden>0</span>
      `;
      document.body.appendChild(btn);
    }

    // Backdrop
    if (!$("#sheet-backdrop")) {
      const bd = document.createElement("div");
      bd.className = "sheet-backdrop";
      bd.id = "sheet-backdrop";
      bd.hidden = true;
      document.body.appendChild(bd);
    }

    // Sheet
    if (!$("#sheet-receipt")) {
      const sheet = document.createElement("section");
      sheet.className = "sheet invoice-sheet";
      sheet.id = "sheet-receipt";
      sheet.setAttribute("role", "dialog");
      sheet.setAttribute("aria-modal", "true");
      sheet.setAttribute("aria-label", "Invoice");
      sheet.hidden = true;
      document.body.appendChild(sheet);
    }
  }

  function resolveDOM() {
    ensureBaseMarkup();

    fabBtn = $("#receipt-open");
    badgeEl = $("#receipt-count");
    fabImg = fabBtn ? fabBtn.querySelector("img") : null;

    backdropEl = $("#sheet-backdrop");
    sheetEl = $("#sheet-receipt");
    itemsEl = $("#receipt-items"); // created inside shell
  }

  // -------------------------
  // Invoice shell (MUST match /pos/invoice.css)
  // -------------------------
  function ensureInvoiceShell() {
    resolveDOM();
    if (!sheetEl) return;

    if (sheetEl.dataset.invoiceShell === "1") return;
    sheetEl.dataset.invoiceShell = "1";

    sheetEl.innerHTML = `
      <button class="invoice-x" type="button" data-sheet-close aria-label="Close">×</button>

      <div class="invoice-head">
        <div class="invoice-head-title">INVOICE</div>
        <div class="invoice-head-shop" id="inv-shop">${escapeHTML(getShopName())}</div>
        <div class="invoice-head-date" id="inv-date">${escapeHTML(getNowLabel())}</div>
        <div class="invoice-head-num" id="inv-num">INV# ${escapeHTML(getInvoiceNumber())}</div>
      </div>

      <button class="invoice-customer" type="button" id="inv-customer-btn">
        <span id="inv-customer-label">Attach Saved Customer</span>
        <span class="invoice-customer-chev" aria-hidden="true"></span>
      </button>

      <div class="invoice-items" id="receipt-items"></div>

      <div class="invoice-totals">
        <div class="tot-row"><span>Subtotal</span><strong id="inv-subtotal">$0.00</strong></div>
        <div class="tot-row"><span>Tax</span><strong id="inv-tax">$0.00</strong></div>
        <div class="tot-row tot-total"><span>TOTAL</span><strong id="inv-total">$0.00</strong></div>
      </div>

      <div class="invoice-actions">
        <button class="inv-btn" type="button" id="receipt-clear">Clear</button>
        <button class="inv-btn primary" type="button" data-sheet-close>Close</button>
      </div>
    `;

    resolveDOM();
    itemsEl = $("#receipt-items");

    const custBtn = $("#inv-customer-btn");
    if (custBtn && !custBtn.dataset.bound) {
      custBtn.dataset.bound = "1";
      custBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openCustomerPicker();
      });
    }

    renderCustomerLabel();
  }

  function renderCustomerLabel() {
    const label = $("#inv-customer-label");
    if (!label) return;

    if (!state.selectedCustomer) {
      label.textContent = "Attach Saved Customer";
      return;
    }
    const name = state.selectedCustomer.name || "Customer";
    const phone = state.selectedCustomer.phone ? ` • ${state.selectedCustomer.phone}` : "";
    label.textContent = `${name}${phone}`;
  }

  // -------------------------
  // Open/close invoice
  // -------------------------
  function openSheet() {
    resolveDOM();
    if (!backdropEl || !sheetEl) return;

    ensureInvoiceShell();

    backdropEl.hidden = false;
    sheetEl.hidden = false;

    backdropEl.classList.add("open");
    sheetEl.classList.add("open");

    document.body.classList.add("pos-invoice-open");
    renderInvoice();
  }

  function closeSheet() {
    resolveDOM();
    if (!backdropEl || !sheetEl) return;

    backdropEl.classList.remove("open");
    sheetEl.classList.remove("open");

    backdropEl.hidden = true;
    sheetEl.hidden = true;

    document.body.classList.remove("pos-invoice-open");
  }

  // -------------------------
  // Badge + FAB state
  // -------------------------
  function updateBadge() {
    resolveDOM();
    if (!badgeEl) return;

    const c = getItemCount();
    badgeEl.textContent = String(c);
    badgeEl.hidden = c <= 0;

    if (fabBtn) {
      if (c > 0) fabBtn.classList.add("has-items");
      else fabBtn.classList.remove("has-items");
    }

    if (fabImg) {
      const active = fabImg.getAttribute("data-active-src");
      const normal = fabImg.getAttribute("data-src") || fabImg.getAttribute("src");
      if (c > 0 && active) fabImg.src = active;
      else if (normal) fabImg.src = normal;
    }
  }

  // -------------------------
  // Item normalization (vitola + category)
  // -------------------------
  function normalizeItem(item) {
    const cigar = isCigarItem(item);

    // category inference for NON-cigars (fixes "Product" -> "Ashtrays", etc.)
    let category = String(item.category || "").trim();
    const catLower = category.toLowerCase();
    const isGenericCategory = !category || catLower === "product" || catLower === "products";

    if (isGenericCategory && !cigar) {
      const fromLink = categoryFromLink(item.link);
      const fromPage = categoryFromPath(item.sourcePage || "");
      category = fromLink || fromPage || category || "Product";
    }

    // Prefer brand icon for cigars
    let img = item.img || "";
    if (cigar) {
      const b = item.brand || "";
      const slug = slugifyBrand(b);
      if (slug) img = `/img/icons/brands/${slug}.svg`;
      category = "Cigars";
    }

    // Vitola carry-through (fixes missing vitola line)
    const vitola = String(item.vitola || item.meta?.vitola || "").trim();
    const sub = String(item.sub || vitola || "").trim();

    return {
      id: String(item.id || "").trim() || makeStableId(item),
      type: (item.type || (cigar ? "cigar" : "product")).toLowerCase(),
      category: category || (cigar ? "Cigars" : "Product"),
      brand: item.brand || "",
      name: item.name || "Item",
      vitola,
      sub,
      price: toNum(item.price),
      img,
      link: item.link || "",
      qty: clamp(Number(item.qty || 1), 1, 999),
    };
  }

  // -------------------------
  // Add / Clear
  // -------------------------
  function add(item) {
    if (!item) return;

    const normalized = normalizeItem(item);
    const idx = state.items.findIndex((x) => x.id === normalized.id);

    if (idx >= 0) {
      state.items[idx].qty = clamp((state.items[idx].qty || 1) + normalized.qty, 1, 999);
    } else {
      state.items.push(normalized);
    }

    saveCart();
    updateBadge();

    resolveDOM();
    if (sheetEl && !sheetEl.hidden) renderInvoice();
  }

  function clear() {
    state.items = [];
    saveCart();
    updateBadge();
    renderInvoice();
  }

  // -------------------------
  // Parse add-button node -> cart item
  // -------------------------
  function itemFromReceiptNode(node) {
    if (!node) return null;

    const sourcePage = location.pathname || "";

    // JSON payload
    const raw = node.getAttribute("data-receipt-item");
    if (raw && raw.trim().startsWith("{")) {
      const payload = safeParseJSON(raw, null);
      if (!payload) return null;

      const inferredType =
        payload.type ||
        (String(payload.category || payload.meta?.category || "").toLowerCase() === "cigars"
          ? "cigar"
          : "product");

      const category =
        payload.category ||
        payload.meta?.category ||
        payload.meta?.Category ||
        node.dataset.category ||
        "Product";

      const vitola =
        payload.vitola ||
        payload.meta?.vitola ||
        payload.meta?.Vitola ||
        node.dataset.vitola ||
        "";

      return {
        id: payload.id || payload.key || "",
        type: inferredType,
        category,
        brand: payload.brand || payload.meta?.brand || node.dataset.brand || "",
        name: payload.name || payload.meta?.name || node.dataset.name || "",
        vitola,
        sub: payload.sub || vitola || payload.meta?.vitola || "",
        price: payload.price ?? payload.msrp ?? payload.meta?.msrp ?? node.dataset.price ?? 0,
        img:
          payload.img ||
          payload.brandImg ||
          payload.brand_img ||
          node.dataset.img ||
          "",
        qty: payload.qty ?? 1,
        link: payload.link || payload.meta?.link || node.dataset.link || "",
        sourcePage,
        meta: payload.meta || null,
      };
    }

    // Dataset-style
    return {
      id: node.dataset.id || "",
      type: (node.dataset.type || "").toLowerCase(),
      category: node.dataset.category || "Product",
      brand: node.dataset.brand || "",
      name: node.dataset.name || "Item",
      vitola: node.dataset.vitola || "",
      sub: node.dataset.sub || node.dataset.vitola || "",
      price: toNum(node.dataset.price || 0),
      img: node.dataset.img || "",
      qty: 1,
      link: node.dataset.link || "",
      sourcePage,
    };
  }

  // -------------------------
  // Render invoice rows + totals (matches invoice.css classes)
  // -------------------------
  function renderInvoice() {
    resolveDOM();
    if (!itemsEl) return;

    // totals
    const subtotal = state.items.reduce(
      (s, it) => s + toNum(it.price) * clamp(Number(it.qty || 1), 1, 999),
      0
    );
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const elSub = $("#inv-subtotal");
    const elTax = $("#inv-tax");
    const elTot = $("#inv-total");
    if (elSub) elSub.textContent = `$${money(subtotal)}`;
    if (elTax) elTax.textContent = `$${money(tax)}`;
    if (elTot) elTot.textContent = `$${money(total)}`;

    if (!state.items.length) {
      itemsEl.innerHTML = `<div class="inv-empty">No items yet.</div>`;
      return;
    }

    itemsEl.innerHTML = state.items
      .map((it) => {
        const qty = clamp(Number(it.qty || 1), 1, 999);
        const unit = toNum(it.price);
        const lineTotal = unit * qty;

        const cigar = isCigarItem(it);

        // FINAL TEXT RULES:
        // CIGARS:  (Line + Cigar) / Vitola / MSRP
        // OTHER:   Category / Product Name / MSRP
        const l1 = cigar ? (it.name || "Cigar") : (it.category || "Product");
        const l2 = cigar ? (it.sub || it.vitola || "") : (it.name || "");
        const l3 = `$${money(unit)}`;

        return `
          <div class="inv-row" data-id="${escapeHTML(it.id)}">
            <div class="inv-ico">
              ${
                it.img
                  ? `<img src="${escapeHTML(it.img)}" alt="" onerror="this.style.display='none';" />`
                  : ""
              }
            </div>

            <div class="inv-mid">
              <div class="inv-l1">${escapeHTML(l1)}</div>
              <div class="inv-l2">${escapeHTML(l2)}</div>
              <div class="inv-l3">${escapeHTML(l3)}</div>
            </div>

            <div class="inv-right">
              <div class="inv-qty">
                <button type="button" class="qbtn" data-qty="-1" aria-label="Decrease">−</button>
                <div class="qval">${qty}</div>
                <button type="button" class="qbtn" data-qty="+1" aria-label="Increase">+</button>
              </div>
              <div class="inv-line">$${money(lineTotal)}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // -------------------------
  // Customer DB (localStorage)
  // -------------------------
  function loadCustomerDB() {
    const db = safeParseJSON(localStorage.getItem(CUSTOMER_DB_KEY), []);
    return Array.isArray(db) ? db : [];
  }

  function saveCustomerDB(db) {
    localStorage.setItem(CUSTOMER_DB_KEY, JSON.stringify(db || []));
  }

  function ensureCustomerOverlay() {
    if (custOverlay) return;

    custOverlay = document.createElement("div");
    custOverlay.className = "cust-overlay";
    custOverlay.hidden = true;
    custOverlay.innerHTML = `
      <div class="cust-card" role="dialog" aria-modal="true" aria-label="Customers">
        <button class="cust-x" type="button" aria-label="Close">×</button>

        <div class="cust-title">Attach Saved Customer</div>

        <div class="cust-search">
          <input type="search" id="cust-q" placeholder="Search name or phone..." autocomplete="off" />
        </div>

        <div class="cust-list" id="cust-list"></div>

        <div class="cust-add">
          <div class="cust-add-title">Add New Customer</div>
          <div class="cust-add-grid">
            <input type="text" id="cust-new-name" placeholder="Full name" />
            <input type="tel" id="cust-new-phone" placeholder="Phone" />
          </div>
          <button class="cust-add-btn" type="button" id="cust-add-btn">Add Customer</button>
        </div>
      </div>
    `;
    document.body.appendChild(custOverlay);

    // close handlers
    custOverlay.querySelector(".cust-x").addEventListener("click", closeCustomerPicker);
    custOverlay.addEventListener("click", (e) => {
      if (e.target === custOverlay) closeCustomerPicker();
    });

    custOverlay.querySelector("#cust-q").addEventListener("input", renderCustomerList);

    custOverlay.querySelector("#cust-add-btn").addEventListener("click", () => {
      const name = custOverlay.querySelector("#cust-new-name").value.trim();
      const phone = custOverlay.querySelector("#cust-new-phone").value.trim();
      if (!name) return;

      const db = loadCustomerDB();
      const newCustomer = { id: String(Date.now()), name, phone };
      db.unshift(newCustomer);
      saveCustomerDB(db);

      setSelectedCustomer(newCustomer);

      custOverlay.querySelector("#cust-new-name").value = "";
      custOverlay.querySelector("#cust-new-phone").value = "";

      renderCustomerList();
      closeCustomerPicker();
    });
  }

  function openCustomerPicker() {
    ensureCustomerOverlay();
    custOverlay.hidden = false;
    custOverlay.classList.add("open");

    const q = custOverlay.querySelector("#cust-q");
    q.value = "";
    q.focus();

    renderCustomerList();
  }

  function closeCustomerPicker() {
    if (!custOverlay) return;
    custOverlay.classList.remove("open");
    custOverlay.hidden = true;
  }

  function renderCustomerList() {
    if (!custOverlay) return;

    const db = loadCustomerDB();
    const q = (custOverlay.querySelector("#cust-q").value || "").trim().toLowerCase();

    const rows = db.filter((c) => {
      if (!q) return true;
      const name = String(c.name || "").toLowerCase();
      const phone = String(c.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });

    const list = custOverlay.querySelector("#cust-list");

    if (!rows.length) {
      list.innerHTML = `<div class="cust-empty">No matches.</div>`;
      return;
    }

    list.innerHTML = rows
      .slice(0, 100)
      .map((c) => {
        const active = state.selectedCustomer && state.selectedCustomer.id === c.id;
        return `
          <button type="button" class="cust-row ${active ? "active" : ""}" data-id="${escapeHTML(c.id)}">
            <div class="cust-row-name">${escapeHTML(c.name || "Customer")}</div>
            <div class="cust-row-sub">${escapeHTML(c.phone || "")}</div>
          </button>
        `;
      })
      .join("");

    $$(".cust-row", list).forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const found = db.find((x) => String(x.id) === String(id));
        if (!found) return;
        setSelectedCustomer(found);
        closeCustomerPicker();
      });
    });
  }

  // -------------------------
  // Event wiring
  // -------------------------
  function bindEventsOnce() {
    resolveDOM();

    // Open invoice
    if (fabBtn && !fabBtn.dataset.bound) {
      fabBtn.dataset.bound = "1";
      fabBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openSheet();
      });
    }

    // Backdrop close
    if (backdropEl && !backdropEl.dataset.bound) {
      backdropEl.dataset.bound = "1";
      backdropEl.addEventListener("click", closeSheet);
    }

    // Close buttons (delegated)
    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest("[data-sheet-close]");
      if (!closeBtn) return;
      e.preventDefault();
      closeSheet();
    });

    // Clear
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("#receipt-clear");
      if (!btn) return;
      e.preventDefault();
      clear();
    });

    // Qty clicks (delegated)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".inv-row [data-qty]");
      if (!btn) return;

      const row = e.target.closest(".inv-row");
      if (!row) return;

      const id = row.getAttribute("data-id");
      const it = state.items.find((x) => x.id === id);
      if (!it) return;

      const dir = btn.getAttribute("data-qty");
      const delta = dir === "+1" ? 1 : -1;

      const next = clamp(Number(it.qty || 1) + delta, 0, 999);
      if (next <= 0) state.items = state.items.filter((x) => x.id !== id);
      else it.qty = next;

      saveCart();
      updateBadge();
      renderInvoice();
    });

    // ESC close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeCustomerPicker();
        closeSheet();
      }
    });

    // ADD-TO-CART gating:
    // Only fire when the user clicks a PLUS BUTTON (pos-add / row-add),
    // NOT when they click the row text area.
    document.addEventListener(
      "click",
      (e) => {
        const node = e.target.closest("[data-receipt-item]");
        if (!node) return;

        const isAddBtn =
          node.classList.contains("pos-add") ||
          node.classList.contains("row-add") ||
          node.matches("button.pos-add,button.row-add");

        if (!isAddBtn) return;

        e.preventDefault();
        e.stopPropagation();

        const item = itemFromReceiptNode(node);
        if (!item) return;

        add(item);
      },
      { passive: false }
    );
  }

  function boot() {
    loadCart();
    resolveDOM();
    ensureInvoiceShell();
    updateBadge();
    bindEventsOnce();

    window.CigarOSCart = {
      add,
      clear,
      openInvoice: openSheet,
      closeInvoice: closeSheet,
      getCount: () => getItemCount(),
      getItems: () => [...state.items],
      money,
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
