/* /pos/cart.js
   Shared POS Cart + Invoice Sheet controller

   ✅ Invoice sheet opens/closes reliably
   ✅ Badge updates + "has-items" class for red state
   ✅ Supports add-to-cart from:
      (A) JSON payload in data-receipt-item='{"name":...}'
      (B) dataset-style (data-name, data-price...)
   ✅ For cigar items: auto-uses BRAND ICON if img missing
   ✅ Invoice header: INVOICE / Shop Name / Date / Invoice #
   ✅ Customer attach UI wiring (basic)
   ✅ Does NOT hijack row clicks — only acts on buttons with [data-receipt-item]
*/

(() => {
  "use strict";

  const STORAGE_KEY = "cigaros_pos_cart_v1";
  const CUSTOMER_KEY = "cigaros_pos_customers_v1";
  const INVOICE_META_KEY = "cigaros_pos_invoice_meta_v1";

  const $ = (sel, root = document) => root.querySelector(sel);

  // -------------------------
  // State
  // -------------------------
  const state = {
    items: [],
    customer: null,   // { id, name, phone, email }
    invoice: null,    // { shop, dateISO, number }
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
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function slugBrand(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/['".]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function brandIconFromBrand(brand) {
    const slug = slugBrand(brand);
    if (!slug) return "";
    // ✅ per your repo: /img/icons/brands (plural)
    return `/img/icons/brands/${slug}.svg`;
  }

  function makeStableId(item) {
    const bits = [
      item.type || "product",
      item.category || "",
      item.brand || "",
      item.name || "",
      item.sub || "",
      String(item.price || ""),
    ].map((s) => String(s || "").trim().toLowerCase());
    return bits.join("|");
  }

  function escapeHTML(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function todayPretty() {
    const d = new Date();
    // “Tue Jan 27 2026”
    return d.toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric", year: "numeric"
    });
  }

  function newInvoiceNumber() {
    // simple 6-digit
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // -------------------------
  // Persistence
  // -------------------------
  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeParseJSON(raw, null);
    if (parsed && Array.isArray(parsed.items)) state.items = parsed.items;

    const cust = safeParseJSON(localStorage.getItem("cigaros_pos_selected_customer_v1"), null);
    if (cust && cust.id) state.customer = cust;

    const inv = safeParseJSON(localStorage.getItem(INVOICE_META_KEY), null);
    if (inv && inv.number) state.invoice = inv;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
  }

  function saveSelectedCustomer() {
    localStorage.setItem("cigaros_pos_selected_customer_v1", JSON.stringify(state.customer || null));
  }

  function ensureInvoiceMeta() {
    if (state.invoice && state.invoice.number) return;
    const shop = "Smoke Cigar Shop";
    const meta = {
      shop,
      dateISO: new Date().toISOString(),
      number: newInvoiceNumber(),
    };
    state.invoice = meta;
    localStorage.setItem(INVOICE_META_KEY, JSON.stringify(meta));
  }

  function getItemCount() {
    return state.items.reduce((sum, it) => sum + clamp(Number(it.qty || 0), 0, 999), 0);
  }

  // -------------------------
  // DOM refs
  // -------------------------
  let receiptBtn, badgeEl;
  let backdropEl, sheetEl, itemsEl, clearBtn;

  // header slots we will create inside the sheet
  let invHeadEl;

  // customer UI
  let custOpenBtn, custLabelEl, custPanelEl, custSearchEl, custListEl;
  let custAddOpenBtn, custFormEl, custAddCancelBtn;
  let custNameEl, custPhoneEl, custEmailEl;

  function resolveDOM() {
    receiptBtn = $("#receipt-open");
    badgeEl = $("#receipt-count");

    backdropEl = $("#sheet-backdrop");
    sheetEl = $("#sheet-receipt");

    itemsEl = $("#receipt-items");
    clearBtn = $("#receipt-clear");

    // customer attach (optional on pages, but present on brand.html if you used my updated file)
    custOpenBtn = $("#cust-open");
    custLabelEl = $("#cust-label");
    custPanelEl = $("#cust-panel");
    custSearchEl = $("#cust-search");
    custListEl = $("#cust-list");

    custAddOpenBtn = $("#cust-add-open");
    custFormEl = $("#cust-form");
    custAddCancelBtn = $("#cust-add-cancel");

    custNameEl = $("#cust-name");
    custPhoneEl = $("#cust-phone");
    custEmailEl = $("#cust-email");

    // invoice header container (we inject if missing)
    invHeadEl = sheetEl ? sheetEl.querySelector(".inv-head") : null;
  }

  // -------------------------
  // Sheet open/close
  // -------------------------
  function openSheet() {
    resolveDOM();
    if (!backdropEl || !sheetEl) return;

    ensureInvoiceMeta();
    renderInvoiceHeader();

    backdropEl.hidden = false;
    sheetEl.hidden = false;

    backdropEl.classList.add("open");
    sheetEl.classList.add("open");

    renderReceipt();
    updateBadge();
  }

  function closeSheet() {
    resolveDOM();
    if (!backdropEl || !sheetEl) return;

    // close customer panel if open
    if (custPanelEl) custPanelEl.hidden = true;
    if (custFormEl) custFormEl.hidden = true;

    backdropEl.hidden = true;
    sheetEl.hidden = true;

    backdropEl.classList.remove("open");
    sheetEl.classList.remove("open");
  }

  // -------------------------
  // Invoice header render
  // -------------------------
  function renderInvoiceHeader() {
    resolveDOM();
    if (!sheetEl) return;

    // Create header block once, right under the sheet header
    if (!invHeadEl) {
      const header = sheetEl.querySelector(".sheet-header");
      const head = document.createElement("div");
      head.className = "inv-head";
      head.innerHTML = `
        <div class="inv-title">INVOICE</div>
        <div class="inv-shop" id="inv-shop"></div>
        <div class="inv-date" id="inv-date"></div>
        <div class="inv-num" id="inv-num"></div>
      `;
      header.insertAdjacentElement("afterend", head);
      invHeadEl = head;
    }

    const shopEl = $("#inv-shop", sheetEl);
    const dateEl = $("#inv-date", sheetEl);
    const numEl = $("#inv-num", sheetEl);

    const shop = state.invoice?.shop || "Smoke Cigar Shop";
    const prettyDate = todayPretty();
    const num = state.invoice?.number ? `INV# ${state.invoice.number}` : "";

    if (shopEl) shopEl.textContent = shop;
    if (dateEl) dateEl.textContent = prettyDate;
    if (numEl) numEl.textContent = num;

    // customer label
    if (custLabelEl) {
      custLabelEl.textContent = state.customer?.name
        ? `${state.customer.name}${state.customer.phone ? " • " + state.customer.phone : ""}`
        : "Attach Saved Customer";
    }
  }

  // -------------------------
  // Receipt / invoice rendering (your 3-column row spec)
  // -------------------------
  function renderReceipt() {
    resolveDOM();
    if (!itemsEl) return;

    if (!state.items.length) {
      itemsEl.innerHTML = `
        <div class="inv-empty">
          No items yet.
        </div>
      `;
      return;
    }

    itemsEl.innerHTML = state.items.map((it) => {
      const qty = clamp(Number(it.qty || 1), 1, 999);
      const unit = toNum(it.price);
      const line = unit * qty;

      const icon = it.img ? it.img : (
        // ✅ for cigars, prefer brand icon if we have brand
        it.category?.toLowerCase() === "cigars" || it.type === "cigar"
          ? brandIconFromBrand(it.brand)
          : ""
      );

      const title1 = it.category || "Product";
      const title2 = it.name || "Item";
      const title3 = unit ? money(unit) : "";

      return `
        <div class="inv-row" data-id="${escapeHTML(it.id)}">
          <div class="inv-ico">
            ${icon ? `<img src="${escapeHTML(icon)}" alt="" onerror="this.style.display='none';" />` : ""}
          </div>

          <div class="inv-mid">
            <div class="inv-cat">${escapeHTML(title1)}</div>
            <div class="inv-name">${escapeHTML(title2)}</div>
            ${title3 ? `<div class="inv-msrp">${escapeHTML(title3)}</div>` : `<div class="inv-msrp">&nbsp;</div>`}
          </div>

          <div class="inv-right">
            <div class="inv-qty">
              <button type="button" class="inv-qty-btn" data-qty="-1" aria-label="Decrease">−</button>
              <div class="inv-qty-pill">${qty}</div>
              <button type="button" class="inv-qty-btn" data-qty="+1" aria-label="Increase">+</button>
            </div>

            <div class="inv-total">
              <div class="inv-total-top">$${money(line)}</div>
              <div class="inv-total-sub">$${money(unit)}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function updateBadge() {
    resolveDOM();
    const c = getItemCount();

    if (badgeEl) {
      badgeEl.textContent = String(c);
      badgeEl.hidden = c <= 0;
    }

    // ✅ toggle red state
    if (receiptBtn) {
      receiptBtn.classList.toggle("has-items", c > 0);
    }
  }

  // -------------------------
  // Cart operations
  // -------------------------
  function add(item) {
    if (!item) return;

    const normalized = {
      id: String(item.id || "").trim() || makeStableId(item),
      type: (item.type || "product").toLowerCase(),
      category: item.category || "Product",
      brand: item.brand || "",
      name: item.name || "Item",
      price: toNum(item.price),
      img: item.img || "",
      link: item.link || "",
      sub: item.sub || "",
      qty: clamp(Number(item.qty || 1), 1, 999),
    };

    // ✅ if cigar and no img, auto use brand icon
    const isCigar = normalized.category.toLowerCase() === "cigars" || normalized.type === "cigar";
    if (isCigar && !normalized.img) normalized.img = brandIconFromBrand(normalized.brand);

    const idx = state.items.findIndex((x) => x.id === normalized.id);
    if (idx >= 0) {
      state.items[idx].qty = clamp((state.items[idx].qty || 1) + normalized.qty, 1, 999);
    } else {
      state.items.push(normalized);
    }

    saveState();
    updateBadge();

    resolveDOM();
    if (sheetEl && !sheetEl.hidden) renderReceipt();
  }

  function clear() {
    state.items = [];
    saveState();
    updateBadge();
    renderReceipt();
  }

  // -------------------------
  // Parse click target into cart item
  // -------------------------
  function itemFromReceiptNode(node) {
    if (!node) return null;

    const raw = node.getAttribute("data-receipt-item");
    if (raw && raw.trim().startsWith("{")) {
      const payload = safeParseJSON(raw, null);
      if (!payload) return null;

      const category = payload.category || "Cigars";
      const brand = payload.brand || (payload.meta?.brand || "");
      const type = payload.type || (String(category).toLowerCase() === "cigars" ? "cigar" : "product");

      return {
        id: payload.id || payload.key || "",
        type,
        category,
        brand,
        name: payload.name || "",
        price: payload.price ?? 0,
        img: payload.img || "",
        sub: payload.sub || "",
        qty: payload.qty ?? 1,
        link: payload.link || payload.meta?.link || "",
      };
    }

    return {
      id: node.dataset.id || "",
      type: (node.dataset.type || "product").toLowerCase(),
      category: node.dataset.category || "Product",
      brand: node.dataset.brand || "",
      name: node.dataset.name || "Item",
      price: toNum(node.dataset.price || 0),
      img: node.dataset.img || "",
      link: node.dataset.link || "",
      sub: node.dataset.sub || "",
      qty: 1,
    };
  }

  // -------------------------
  // Customer attach (basic)
  // -------------------------
  function loadCustomers() {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    const parsed = safeParseJSON(raw, null);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveCustomers(list) {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(list || []));
  }

  function renderCustomerList(filterText = "") {
    resolveDOM();
    if (!custListEl) return;

    const q = String(filterText || "").trim().toLowerCase();
    const customers = loadCustomers();

    const hits = !q
      ? customers
      : customers.filter((c) => {
          const name = String(c.name || "").toLowerCase();
          const phone = String(c.phone || "").toLowerCase();
          return name.includes(q) || phone.includes(q);
        });

    custListEl.innerHTML = hits.length
      ? hits.map((c) => `
          <button type="button" class="cust-item" data-cust-id="${escapeHTML(c.id)}">
            <div class="cust-item-name">${escapeHTML(c.name || "Customer")}</div>
            <div class="cust-item-sub">${escapeHTML(c.phone || "")}</div>
          </button>
        `).join("")
      : `<div class="cust-empty">No matches.</div>`;
  }

  function pickCustomerById(id) {
    const customers = loadCustomers();
    const found = customers.find((c) => String(c.id) === String(id));
    if (!found) return;

    state.customer = found;
    saveSelectedCustomer();

    if (custLabelEl) {
      custLabelEl.textContent = `${found.name}${found.phone ? " • " + found.phone : ""}`;
    }
    if (custPanelEl) custPanelEl.hidden = true;
  }

  function openCustomerPanel() {
    resolveDOM();
    if (!custPanelEl) return;
    custPanelEl.hidden = false;
    if (custFormEl) custFormEl.hidden = true;
    renderCustomerList(custSearchEl ? custSearchEl.value : "");
    if (custSearchEl) custSearchEl.focus();
  }

  function closeCustomerPanel() {
    resolveDOM();
    if (!custPanelEl) return;
    custPanelEl.hidden = true;
    if (custFormEl) custFormEl.hidden = true;
  }

  function openCustomerForm() {
    resolveDOM();
    if (!custFormEl) return;
    custFormEl.hidden = false;
    if (custNameEl) custNameEl.value = "";
    if (custPhoneEl) custPhoneEl.value = "";
    if (custEmailEl) custEmailEl.value = "";
    if (custNameEl) custNameEl.focus();
  }

  function saveNewCustomer() {
    resolveDOM();
    const name = String(custNameEl?.value || "").trim();
    const phone = String(custPhoneEl?.value || "").trim();
    const email = String(custEmailEl?.value || "").trim();

    if (!name && !phone) return;

    const customers = loadCustomers();
    const id = String(Date.now());

    const newCust = { id, name: name || "Customer", phone, email };
    customers.unshift(newCust);
    saveCustomers(customers);

    state.customer = newCust;
    saveSelectedCustomer();

    if (custLabelEl) {
      custLabelEl.textContent = `${newCust.name}${newCust.phone ? " • " + newCust.phone : ""}`;
    }

    if (custFormEl) custFormEl.hidden = true;
    renderCustomerList("");
    if (custPanelEl) custPanelEl.hidden = true;
  }

  // -------------------------
  // Wiring
  // -------------------------
  function bindEventsOnce() {
    resolveDOM();

    if (receiptBtn && !receiptBtn.dataset.bound) {
      receiptBtn.dataset.bound = "1";
      receiptBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openSheet();
      });
    }

    if (backdropEl && !backdropEl.dataset.bound) {
      backdropEl.dataset.bound = "1";
      backdropEl.addEventListener("click", () => closeSheet());
    }

    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest("[data-sheet-close]");
      if (closeBtn) {
        e.preventDefault();
        closeSheet();
      }
    });

    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.dataset.bound = "1";
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clear();
      });
    }

    if (itemsEl && !itemsEl.dataset.bound) {
      itemsEl.dataset.bound = "1";
      itemsEl.addEventListener("click", (e) => {
        const row = e.target.closest(".inv-row");
        const btn = e.target.closest("[data-qty]");
        if (!row || !btn) return;

        const id = row.getAttribute("data-id");
        const it = state.items.find((x) => x.id === id);
        if (!it) return;

        const dir = btn.getAttribute("data-qty");
        const delta = dir === "+1" ? 1 : -1;
        const next = clamp(Number(it.qty || 1) + delta, 0, 999);

        if (next <= 0) state.items = state.items.filter((x) => x.id !== id);
        else it.qty = next;

        saveState();
        updateBadge();
        renderReceipt();
      });
    }

    // ✅ Customer attach UI
    if (custOpenBtn && !custOpenBtn.dataset.bound) {
      custOpenBtn.dataset.bound = "1";
      custOpenBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!custPanelEl) return;
        if (custPanelEl.hidden) openCustomerPanel();
        else closeCustomerPanel();
      });
    }

    if (custSearchEl && !custSearchEl.dataset.bound) {
      custSearchEl.dataset.bound = "1";
      custSearchEl.addEventListener("input", () => renderCustomerList(custSearchEl.value));
    }

    if (custListEl && !custListEl.dataset.bound) {
      custListEl.dataset.bound = "1";
      custListEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".cust-item");
        if (!btn) return;
        const id = btn.getAttribute("data-cust-id");
        if (id) pickCustomerById(id);
      });
    }

    if (custAddOpenBtn && !custAddOpenBtn.dataset.bound) {
      custAddOpenBtn.dataset.bound = "1";
      custAddOpenBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openCustomerForm();
      });
    }

    if (custAddCancelBtn && !custAddCancelBtn.dataset.bound) {
      custAddCancelBtn.dataset.bound = "1";
      custAddCancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (custFormEl) custFormEl.hidden = true;
      });
    }

    if (custFormEl && !custFormEl.dataset.bound) {
      custFormEl.dataset.bound = "1";
      custFormEl.addEventListener("submit", (e) => {
        e.preventDefault();
        saveNewCustomer();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSheet();
    });

    // ✅ Add-to-cart delegation:
    // ONLY handle if the click target is a BUTTON (or inside a button) that has [data-receipt-item]
    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest("button[data-receipt-item], [role='button'][data-receipt-item]");
        if (!btn) return;

        // prevent navigation and keep UI stable
        e.preventDefault();
        e.stopPropagation();

        const item = itemFromReceiptNode(btn);
        if (!item) return;

        add(item);
        updateBadge();
      },
      { passive: false }
    );
  }

  function boot() {
    loadState();
    ensureInvoiceMeta();
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
