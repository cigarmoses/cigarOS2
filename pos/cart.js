/* /pos/cart.js
   Shared POS Cart + INVOICE modal controller (ALL POS pages)

   Goals:
   ✅ Bottom-right floating invoice icon (no background behind PNG)
   ✅ Badge count + "has-items" class
   ✅ INVOICE modal matches your old layout (and your NEW cigar text rule):
      - Centered, tall modal (not a bottom sheet)
      - Header: INVOICE / Shop / Date / INV#
      - Customer attach (search + add) works
      - Line items: icon | 3 lines text | qty controls above line total
      - Cigars text order:
          1) Cigar line + name
          2) Vitola
          3) MSRP (unit price)
      - Others text order:
          1) Category
          2) Product name
          3) MSRP (unit price)

   ✅ Add to cart: only triggers from + buttons (row-add / pos-add)
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
    // Tue, Jan 27, 2026
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
    localStorage.setItem(
      SELECTED_CUSTOMER_KEY,
      JSON.stringify(state.selectedCustomer)
    );
    renderCustomerLabel();
  }

  function getItemCount() {
    return state.items.reduce(
      (sum, it) => sum + clamp(Number(it.qty || 0), 0, 999),
      0
    );
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

  // -------------------------
  // DOM refs (existing ids in your pages)
  // -------------------------
  let fabBtn, badgeEl, fabImg;
  let backdropEl, sheetEl, itemsEl;

  // Injected (customer modal)
  let custOverlay;

  function resolveDOM() {
    fabBtn = $("#receipt-open");
    badgeEl = $("#receipt-count");
    fabImg = fabBtn ? fabBtn.querySelector("img") : null;

    backdropEl = $("#sheet-backdrop");
    sheetEl = $("#sheet-receipt");

    itemsEl = $("#receipt-items");
  }

  // -------------------------
  // Ensure INVOICE markup exists inside #sheet-receipt
  // IMPORTANT: this markup matches the CSS you pasted:
  //   #sheet-receipt .sheet-header / .sheet-x
  //   .inv-head / .inv-title / .inv-shop / .inv-date / .inv-num
  //   .inv-customer / .inv-customer-btn / .inv-customer-caret
  //   .inv-row / .inv-ico / .inv-cat / .inv-name / .inv-msrp
  //   .inv-right / .inv-qty / .inv-qty-btn / .inv-qty-pill / .inv-total-top / .inv-total-sub
  //   .sheet-footer / .sheet-btn
  // -------------------------
  function ensureInvoiceShell() {
    resolveDOM();
    if (!sheetEl) return;

    if (sheetEl.dataset.invoiceShell === "1") return;
    sheetEl.dataset.invoiceShell = "1";

    sheetEl.innerHTML = `
      <header class="sheet-header">
        <h2>Invoice</h2>
        <button class="sheet-x" type="button" data-sheet-close aria-label="Close">×</button>
      </header>

      <div class="inv-head">
        <div class="inv-title">INVOICE</div>
        <div class="inv-shop" id="inv-shop">${escapeHTML(getShopName())}</div>
        <div class="inv-date" id="inv-date">${escapeHTML(getNowLabel())}</div>
        <div class="inv-num" id="inv-num">INV# ${escapeHTML(
          getInvoiceNumber()
        )}</div>
      </div>

      <div class="inv-customer">
        <button class="inv-customer-btn" type="button" id="inv-customer-btn" aria-haspopup="dialog" aria-expanded="false">
          <span id="inv-customer-label">Attach Saved Customer</span>
          <span class="inv-customer-caret" aria-hidden="true"></span>
        </button>
      </div>

      <div class="sheet-body">
        <div class="receipt-items" id="receipt-items"></div>
      </div>

      <footer class="sheet-footer">
        <button class="sheet-btn" type="button" id="receipt-clear">Clear</button>
        <button class="sheet-btn primary" type="button" data-sheet-close>Close</button>
      </footer>
    `;

    // re-resolve now that we re-wrote the inside
    resolveDOM();

    // bind customer button once
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
    const phone = state.selectedCustomer.phone
      ? ` • ${state.selectedCustomer.phone}`
      : "";
    label.textContent = `${name}${phone}`;
  }

  // -------------------------
  // Open/close modal
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

    // If you ever add a red asset, this supports it:
    // <img ... data-active-src="/img/icons/receipt-red.png" data-src="/img/icons/receipt.png">
    if (fabImg) {
      const active = fabImg.getAttribute("data-active-src");
      const normal = fabImg.getAttribute("data-src") || fabImg.getAttribute("src");
      if (c > 0 && active) fabImg.src = active;
      else if (normal) fabImg.src = normal;
    }
  }

  // -------------------------
  // Item normalization
  // -------------------------
  function normalizeItem(item) {
    const isCigar =
      String(item.type || "").toLowerCase() === "cigar" ||
      String(item.category || "").toLowerCase() === "cigars";

    // Prefer brand icon for cigars
    let img = item.img || "";
    if (isCigar) {
      const b = item.brand || "";
      const slug = slugifyBrand(b);
      if (slug) img = `/img/icons/brands/${slug}.svg`;
    }

    return {
      id: String(item.id || "").trim() || makeStableId(item),
      type: (item.type || (isCigar ? "cigar" : "product")).toLowerCase(),
      category: item.category || (isCigar ? "Cigars" : "Product"),
      brand: item.brand || "",
      // For cigars, upstream should pass "Line — Cigar" as name (brand.js already does)
      name: item.name || "Item",
      vitola: item.vitola || "",
      // used as vitola for cigars (brand.js can pass sub=vitola or leave it blank)
      sub: item.sub || "",
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
      state.items[idx].qty = clamp(
        (state.items[idx].qty || 1) + normalized.qty,
        1,
        999
      );
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

    // JSON payload
    const raw = node.getAttribute("data-receipt-item");
    if (raw && raw.trim().startsWith("{")) {
      const payload = safeParseJSON(raw, null);
      if (!payload) return null;

      return {
        id: payload.id || payload.key || "",
        type:
          payload.type ||
          (payload.category?.toLowerCase() === "cigars" ? "cigar" : "product"),
        category: payload.category || "Product",
        brand: payload.brand || payload.meta?.brand || "",
        name: payload.name || "",
        vitola: payload.vitola || payload.meta?.vitola || "",
        sub: payload.sub || payload.vitola || payload.meta?.vitola || "",
        price: payload.price ?? payload.msrp ?? 0,
        img: payload.img || payload.brandImg || payload.brand_img || "",
        qty: payload.qty ?? 1,
        link: payload.link || payload.meta?.link || "",
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
    };
  }

  // -------------------------
  // Render INVOICE
  // (Text rules corrected to your final cigar rule)
  // -------------------------
  function renderInvoice() {
    resolveDOM();
    if (!itemsEl) return;

    if (!state.items.length) {
      itemsEl.innerHTML = `<div class="inv-empty">No items yet.</div>`;
      return;
    }

    itemsEl.innerHTML = state.items
      .map((it) => {
        const qty = clamp(Number(it.qty || 1), 1, 999);
        const unit = toNum(it.price);
        const lineTotal = unit * qty;

        const isCigar =
          it.type === "cigar" || String(it.category || "").toLowerCase() === "cigars";

        // ✅ FINAL TEXT RULES:
        // CIGARS:
        //   1) cigar line + name  (it.name)
        //   2) vitola             (it.sub / it.vitola)
        //   3) MSRP               (unit price)
        //
        // OTHER:
        //   1) category
        //   2) product name
        //   3) MSRP (unit)
        const line1 = isCigar ? (it.name || "Cigar") : (it.category || "Product");
        const line2 = isCigar ? (it.sub || it.vitola || "") : (it.name || "");
        const line3 = `$${money(unit)}`;

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
              <div class="inv-cat">${escapeHTML(line1)}</div>
              <div class="inv-name">${escapeHTML(line2)}</div>
              <div class="inv-msrp">${escapeHTML(line3)}</div>
            </div>

            <div class="inv-right">
              <div class="inv-qty">
                <button type="button" class="inv-qty-btn" data-qty="-1" aria-label="Decrease">−</button>
                <div class="inv-qty-pill">${qty}</div>
                <button type="button" class="inv-qty-btn" data-qty="+1" aria-label="Increase">+</button>
              </div>

              <div class="inv-total">
                <div class="inv-total-top">$${money(lineTotal)}</div>
                <div class="inv-total-sub">$${money(unit)}</div>
              </div>
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
    const x = custOverlay.querySelector(".cust-x");
    x.addEventListener("click", () => closeCustomerPicker());
    custOverlay.addEventListener("click", (e) => {
      if (e.target === custOverlay) closeCustomerPicker();
    });

    const q = custOverlay.querySelector("#cust-q");
    q.addEventListener("input", () => renderCustomerList());

    const addBtn = custOverlay.querySelector("#cust-add-btn");
    addBtn.addEventListener("click", () => {
      const name = custOverlay.querySelector("#cust-new-name").value.trim();
      const phone = custOverlay.querySelector("#cust-new-phone").value.trim();
      if (!name) return;

      const db = loadCustomerDB();
      const newCustomer = {
        id: String(Date.now()),
        name,
        phone,
      };
      db.unshift(newCustomer);
      saveCustomerDB(db);

      // select immediately
      setSelectedCustomer(newCustomer);

      // reset fields
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

    // reset search and render
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
    const q = (custOverlay.querySelector("#cust-q").value || "")
      .trim()
      .toLowerCase();

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
        const active =
          state.selectedCustomer && state.selectedCustomer.id === c.id;
        return `
          <button type="button" class="cust-row ${active ? "active" : ""}" data-id="${escapeHTML(
            c.id
          )}">
            <div class="cust-row-name">${escapeHTML(c.name || "Customer")}</div>
            <div class="cust-row-sub">${escapeHTML(c.phone || "")}</div>
          </button>
        `;
      })
      .join("");

    list.querySelectorAll(".cust-row").forEach((btn) => {
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
      backdropEl.addEventListener("click", () => closeSheet());
    }

    // Any close button (delegated)
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
    updateBadge();
    bindEventsOnce();

    window.CigarOSCart = {
      add,
      clear,
      openInvoice: openSheet,
      closeInvoice: closeSheet,
      openSheet,
      closeSheet,
      getCount: () => getItemCount(),
      getItems: () => [...state.items],
      money,
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
