/* /pos/cart.js
   Shared cart + INVOICE FAB + INVOICE modal
   + Add-to-bill confirm modal (non-cigar categories)
   + Customer attach (search by first/last/phone/email)
   + Confirm Sale -> awards loyalty points + saves sale + clears cart
   + Save Draft -> saves draft invoice

   Storage:
     Cart:         cigaros_cart_v1
     Invoice meta: cigaros_invoice_meta_v1 (customer attachment)
     Customers:    cigaros_customers_v1
     Sales:        cigaros_sales_v1
     Drafts:       cigaros_invoice_drafts_v1
*/

(() => {
  // ---------- config ----------
  const CART_KEY = "cigaros_cart_v1";
  const META_KEY = "cigaros_invoice_meta_v1";
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";
  const DRAFTS_KEY = "cigaros_invoice_drafts_v1";

  const TAX_RATE = 0.07;

  const ICON_GREEN = "/img/icons/receipt.png";
  const ICON_RED = "/img/icons/receiptred.png";

  // Points config (override per shop if you want)
  // Example:
  // window.CigarOSLoyalty = { pointsPerDollar: 1, basis: "subtotal" } // or "total"
  const loyaltyCfg = () => {
    const cfg = window.CigarOSLoyalty || {};
    return {
      pointsPerDollar: Number(cfg.pointsPerDollar ?? 1),
      basis: (cfg.basis === "total" ? "total" : "subtotal"),
    };
  };

  // Optional invoice header meta override:
  // window.CigarOSInvoiceMeta = { shopName:"Smoke Cigar Shop", invoiceNumber:"INV# 123456" }
  function getInvoiceHeaderMeta() {
    const meta = window.CigarOSInvoiceMeta || {};
    return {
      shopName: meta.shopName || "Smoke Cigar Shop",
      invoiceNumber: meta.invoiceNumber || "INV# 123456",
    };
  }

  // ---------- utils ----------
  const money = (n) => Number(n || 0).toFixed(2);
  const safeJSON = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
  const normalizeId = (s) => (s || "").toString().trim().toLowerCase();
  const escapeHTML = (s) => (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const nowStamp = () => {
    try {
      const d = new Date();
      const weekday = d.toLocaleString(undefined, { weekday: "long" });
      const date = d.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "2-digit" });
      const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `${weekday} ${date} ${time}`;
    } catch {
      return new Date().toString();
    }
  };

  const uid = () => {
    // short-ish unique id
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
  };

  function readKey(key, fallback) {
    return safeJSON(localStorage.getItem(key), fallback);
  }
  function writeKey(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ---------- cart state ----------
  function readCart() {
    return readKey(CART_KEY, { items: [] });
  }
  function writeCart(cart) {
    writeKey(CART_KEY, cart);
    window.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: cart }));
  }
  function cartCount(cart) {
    return (cart.items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0);
  }

  function addItem(payload) {
    const cart = readCart();
    const id = normalizeId(payload.id || payload.key || payload.name);
    if (!id) return;

    const idx = (cart.items || []).findIndex((x) => normalizeId(x.id) === id);
    const unitPrice = Number(payload.price ?? 0);

    if (idx >= 0) {
      cart.items[idx].qty = Number(cart.items[idx].qty || 0) + 1;
    } else {
      cart.items.push({
        id,
        qty: 1,
        img: payload.img || "",

        // NON-CIGAR
        category: payload.category || "",
        name: payload.name || "Item",
        price: unitPrice, // unit price

        // CIGAR (optional)
        cigarName: payload.cigarName || "",
        cigarLine: payload.cigarLine || "",
        brand: payload.brand || "",
        vitola: payload.vitola || "",
        msrp: payload.msrp ?? "",
        url: payload.url || "",
        isCigar: !!payload.isCigar,
      });
    }

    writeCart(cart);
  }

  function setQty(id, qty) {
    const cart = readCart();
    const idx = (cart.items || []).findIndex((x) => normalizeId(x.id) === normalizeId(id));
    if (idx < 0) return;

    const q = Math.max(0, Number(qty || 0));
    if (q === 0) cart.items.splice(idx, 1);
    else cart.items[idx].qty = q;

    writeCart(cart);
  }

  function clearCart() {
    writeCart({ items: [] });
  }

  // ---------- invoice meta (attached customer) ----------
  function readInvoiceMeta() {
    return readKey(META_KEY, { customerId: "", customerLabel: "" });
  }
  function writeInvoiceMeta(meta) {
    writeKey(META_KEY, meta);
    window.dispatchEvent(new CustomEvent("cigaros:invoice-meta-changed", { detail: meta }));
  }
  function detachCustomer() {
    writeInvoiceMeta({ customerId: "", customerLabel: "" });
  }

  // ---------- customers + loyalty ----------
  function readCustomers() {
    return readKey(CUSTOMERS_KEY, []);
  }
  function writeCustomers(list) {
    writeKey(CUSTOMERS_KEY, list);
    window.dispatchEvent(new CustomEvent("cigaros:customers-changed", { detail: list }));
  }

  function computePoints(subtotal, total) {
    const cfg = loyaltyCfg();
    const basisVal = cfg.basis === "total" ? total : subtotal;
    const pts = Math.floor(Number(basisVal || 0) * Number(cfg.pointsPerDollar || 1));
    return Math.max(0, pts);
  }

  function awardPointsToCustomer(customerId, points) {
    const pts = Number(points || 0);
    if (!customerId || pts <= 0) return { ok: false };

    const customers = readCustomers();
    const idx = customers.findIndex((c) => String(c.id) === String(customerId));
    if (idx < 0) return { ok: false };

    customers[idx].points = Number(customers[idx].points || 0) + pts;
    customers[idx].updatedAt = new Date().toISOString();
    writeCustomers(customers);

    return { ok: true, customer: customers[idx] };
  }

  // ---------- sales + drafts ----------
  function readSales() {
    return readKey(SALES_KEY, []);
  }
  function writeSales(list) {
    writeKey(SALES_KEY, list);
    window.dispatchEvent(new CustomEvent("cigaros:sales-changed", { detail: list }));
  }

  function readDrafts() {
    return readKey(DRAFTS_KEY, []);
  }
  function writeDrafts(list) {
    writeKey(DRAFTS_KEY, list);
    window.dispatchEvent(new CustomEvent("cigaros:drafts-changed", { detail: list }));
  }

  // ---------- expose API ----------
  window.CigarOSCart = {
    read: readCart,
    add: addItem,
    setQty,
    clear: clearCart,
    money,
    promptAdd: (payload) => openAddConfirm(payload),

    // loyalty/customer helpers
    customers: {
      read: readCustomers,
      write: writeCustomers,
    },
    invoiceMeta: {
      read: readInvoiceMeta,
      write: writeInvoiceMeta,
      detach: detachCustomer,
    },
  };

  // ---------- styles ----------
  function ensureStyles() {
    if (document.getElementById("cigaros-invoice-styles")) return;

    const style = document.createElement("style");
    style.id = "cigaros-invoice-styles";
    style.textContent = `
      body.pos-modal-open { overflow: hidden; }

      /* ===== Invoice FAB (bottom-right) ===== */
      .receipt-fab {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 9998;
        width: 64px;
        height: 64px;
        border: 0;
        padding: 0;
        background: transparent;
        border-radius: 18px;
        display: grid;
        place-items: center;
      }
      .receipt-fab img { width: 64px; height: 64px; display: block; }

      .receipt-badge {
        position: absolute;
        right: -4px;
        top: -4px;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border-radius: 999px;
        background: #ff3b30;
        color: #fff;
        font-weight: 900;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 16px rgba(0,0,0,.22);
      }

      /* ===== INVOICE Modal ===== */
      #invoice-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
      }
      #invoice-overlay.open { display: block; }

      #invoice-overlay .inv-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      #invoice-overlay .inv-sheet {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(560px, 94vw);
        height: min(920px, 90vh);
        background: #fff;
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 20px 80px rgba(0,0,0,.35);
        display: flex;
        flex-direction: column;
      }

      #invoice-overlay .inv-head {
        position: relative;
        padding: 18px 18px 12px;
        text-align: center;
        border-bottom: 1px solid rgba(15,26,44,.08);
      }

      #invoice-overlay .inv-x {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        border: 0;
        background: rgba(15,26,44,.06);
        color: rgba(15,26,44,.55);
        font-weight: 900;
        cursor: pointer;
      }

      #invoice-overlay .inv-title {
        font-weight: 950;
        letter-spacing: -0.03em;
        font-size: 26px;
        color: #0f1a2c;
        margin-top: 2px;
      }

      #invoice-overlay .inv-meta {
        margin-top: 6px;
        display: grid;
        gap: 4px;
        color: rgba(15,26,44,.55);
        font-weight: 800;
        font-size: 16px;
      }

      #invoice-overlay .inv-customer {
        margin: 12px auto 0;
        width: min(420px, 92%);
        height: 54px;
        border-radius: 999px;
        border: 2px solid rgba(15,26,44,.14);
        background: #fff;
        color: rgba(15,26,44,.40);
        font-weight: 900;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;
        user-select: none;
      }
      #invoice-overlay .inv-customer.is-attached {
        color: rgba(15,26,44,.85);
      }
      #invoice-overlay .inv-customer .chev {
        width: 0; height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 10px solid rgba(15,26,44,.35);
        margin-left: 8px;
      }

      #invoice-overlay .inv-body {
        padding: 10px 18px 0;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
        flex: 1;
      }

      /* Line item rows (4 sections) */
      #invoice-overlay .inv-row {
        display: grid;
        grid-template-columns: 86px 1fr auto auto;
        gap: 16px;
        align-items: center;
        padding: 18px 0;
        border-bottom: 1px solid rgba(15,26,44,.10);
      }

      #invoice-overlay .inv-ico {
        width: 86px;
        height: 86px;
        border-radius: 22px;
        background: #d9e9f6;
        overflow: hidden;
        display: grid;
        place-items: center;
      }
      #invoice-overlay .inv-ico img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      #invoice-overlay .inv-text { min-width: 0; }
      #invoice-overlay .inv-l1 {
        font-weight: 950;
        font-size: 26px;
        letter-spacing: -0.02em;
        color: #0f1a2c;
        line-height: 1.05;
        margin-bottom: 4px;
      }
      #invoice-overlay .inv-l2 {
        font-weight: 850;
        font-size: 20px;
        color: rgba(15,26,44,.55);
        line-height: 1.15;
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #invoice-overlay .inv-l3 {
        font-weight: 850;
        font-size: 20px;
        color: rgba(15,26,44,.55);
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* cigar hyperlink */
      #invoice-overlay .inv-link {
        color: #0f7aff;
        text-decoration: underline;
        text-underline-offset: 4px;
      }

      /* qty adjuster: + [qty] - */
      #invoice-overlay .inv-qty {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: rgba(15,26,44,.55);
        font-weight: 950;
      }
      #invoice-overlay .inv-qty .qbtn {
        width: 28px;
        height: 28px;
        border: 0;
        background: transparent;
        color: rgba(15,26,44,.55);
        font-size: 26px;
        line-height: 1;
        font-weight: 900;
        cursor: pointer;
      }
      #invoice-overlay .inv-qty .qpill {
        min-width: 42px;
        height: 28px;
        border-radius: 999px;
        border: 2px solid rgba(15,26,44,.18);
        background: #fff;
        color: rgba(15,26,44,.70);
        display: grid;
        place-items: center;
        font-size: 16px;
        font-weight: 950;
        padding: 0 10px;
      }

      /* line total pill (blue) */
      #invoice-overlay .inv-total {
        height: 44px;
        min-width: 92px;
        border-radius: 12px;
        background: #0f7aff;
        color: #fff;
        font-weight: 950;
        font-size: 20px;
        letter-spacing: -0.01em;
        display: grid;
        place-items: center;
        padding: 0 14px;
        white-space: nowrap;
      }

      /* footer */
      #invoice-overlay .inv-foot {
        border-top: 1px solid rgba(15,26,44,.10);
        padding: 14px 18px 18px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        align-items: end;
      }

      #invoice-overlay .inv-actions {
        display: grid;
        gap: 12px;
        justify-items: start;
      }
      #invoice-overlay .inv-btn {
        width: 160px;
        height: 52px;
        border-radius: 14px;
        font-weight: 950;
        font-size: 18px;
        border: 2px solid rgba(15,26,44,.18);
        background: #fff;
        color: rgba(15,26,44,.55);
        cursor: pointer;
      }
      #invoice-overlay .inv-btn.primary {
        background: #0f7aff;
        border-color: #0f7aff;
        color: #fff;
      }

      #invoice-overlay .inv-totals {
        display: grid;
        gap: 6px;
        justify-items: end;
        font-weight: 950;
        color: rgba(15,26,44,.75);
      }
      #invoice-overlay .inv-totals .line {
        width: 100%;
        display: flex;
        justify-content: space-between;
        gap: 18px;
        font-size: 20px;
      }
      #invoice-overlay .inv-totals .line strong {
        color: rgba(15,26,44,.85);
      }
      #invoice-overlay .inv-totals .grand {
        margin-top: 10px;
        font-size: 28px;
        color: rgba(15,26,44,.90);
      }

      #invoice-overlay .inv-empty {
        padding: 18px 0;
        color: rgba(15,26,44,.45);
        font-weight: 900;
        font-size: 18px;
      }

      /* ===== Add-to-bill modal (non-cigar categories) ===== */
      #addbill-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: none;
      }
      #addbill-overlay.open { display: block; }

      #addbill-overlay .addbill-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      #addbill-overlay .addbill-card {
        position: absolute;
        left: 50%;
        top: 46%;
        transform: translate(-50%, -50%);
        width: min(520px, 92vw);
        background: #e9e9ea;
        border-radius: 22px;
        box-shadow: 0 20px 70px rgba(0,0,0,.30);
        padding: 22px 18px 18px;
        text-align: center;
      }

      #addbill-overlay .addbill-ico {
        width: 74px;
        height: 74px;
        border-radius: 18px;
        background: #dfe3e8;
        margin: 0 auto 12px;
        overflow: hidden;
        display: grid;
        place-items: center;
      }
      #addbill-overlay .addbill-ico img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      #addbill-overlay .addbill-title {
        font-weight: 950;
        font-size: 40px;
        letter-spacing: -0.03em;
        color: rgba(15,26,44,.86);
        margin: 2px 0 16px;
      }

      #addbill-overlay .addbill-btn {
        width: 100%;
        height: 58px;
        border-radius: 18px;
        border: 0;
        background: #ffffff;
        color: #0f1a2c;
        font-weight: 950;
        font-size: 24px;
        letter-spacing: -0.01em;
        cursor: pointer;
      }

      /* ===== Customer picker modal ===== */
      #cust-overlay {
        position: fixed;
        inset: 0;
        z-index: 10001;
        display: none;
      }
      #cust-overlay.open { display: block; }

      #cust-overlay .cust-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      #cust-overlay .cust-sheet {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(560px, 94vw);
        height: min(760px, 86vh);
        background: #fff;
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 20px 80px rgba(0,0,0,.35);
        display: flex;
        flex-direction: column;
      }

      #cust-overlay .cust-head {
        padding: 14px 16px 12px;
        border-bottom: 1px solid rgba(15,26,44,.10);
        display: grid;
        gap: 10px;
      }
      #cust-overlay .cust-toprow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      #cust-overlay .cust-title {
        font-weight: 950;
        font-size: 22px;
        color: #0f1a2c;
      }
      #cust-overlay .cust-close {
        border: 0;
        background: rgba(15,26,44,.06);
        width: 34px;
        height: 34px;
        border-radius: 999px;
        font-weight: 950;
        color: rgba(15,26,44,.55);
        cursor: pointer;
      }

      #cust-overlay .cust-search {
        width: 100%;
        height: 46px;
        border-radius: 14px;
        border: 2px solid rgba(15,26,44,.12);
        padding: 0 14px;
        font-weight: 900;
        font-size: 16px;
        outline: none;
      }

      #cust-overlay .cust-body {
        padding: 10px 16px 16px;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
        flex: 1;
      }

      #cust-overlay .cust-card {
        padding: 12px 12px;
        border: 1px solid rgba(15,26,44,.10);
        border-radius: 14px;
        display: grid;
        gap: 4px;
        margin-bottom: 10px;
        cursor: pointer;
      }
      #cust-overlay .cust-name {
        font-weight: 950;
        font-size: 18px;
        color: #0f1a2c;
      }
      #cust-overlay .cust-sub {
        font-weight: 850;
        font-size: 14px;
        color: rgba(15,26,44,.55);
      }

      #cust-overlay .cust-actions {
        padding: 12px 16px 16px;
        border-top: 1px solid rgba(15,26,44,.10);
        display: flex;
        gap: 10px;
        justify-content: space-between;
        align-items: center;
      }
      #cust-overlay .cust-btn {
        height: 44px;
        border-radius: 14px;
        border: 2px solid rgba(15,26,44,.14);
        background: #fff;
        color: rgba(15,26,44,.65);
        font-weight: 950;
        padding: 0 14px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- receipt/invoice FAB ----------
  function ensureFab() {
    let fab = document.querySelector(".receipt-fab") || document.querySelector(".pos-receipt-fab");
    if (!fab) {
      fab = document.createElement("button");
      fab.className = "receipt-fab";
      fab.type = "button";
      fab.setAttribute("aria-label", "Invoice");
      fab.innerHTML = `
        <img src="${ICON_GREEN}" alt="" />
        <span class="receipt-badge" hidden>0</span>
      `;
      document.body.appendChild(fab);
    } else {
      fab.classList.remove("pos-receipt-fab");
      fab.classList.add("receipt-fab");
      fab.type = "button";
      fab.setAttribute("aria-label", "Invoice");

      let img = fab.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        img.alt = "";
        fab.prepend(img);
      }

      let badge = fab.querySelector(".receipt-badge") || fab.querySelector(".pos-receipt-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "receipt-badge";
        badge.hidden = true;
        badge.textContent = "0";
        fab.appendChild(badge);
      } else {
        badge.classList.remove("pos-receipt-badge");
        badge.classList.add("receipt-badge");
      }
    }

    fab.addEventListener("click", (e) => {
      e.preventDefault();
      openInvoiceModal();
    });

    updateFab();
  }

  function updateFab() {
    const cart = readCart();
    const n = cartCount(cart);

    const fab = document.querySelector(".receipt-fab");
    if (!fab) return;

    const img = fab.querySelector("img");
    const badge = fab.querySelector(".receipt-badge");

    if (img) {
      img.src = n > 0 ? ICON_RED : ICON_GREEN;
      img.onerror = () => { img.src = ICON_GREEN; };
    }
    if (badge) {
      badge.textContent = String(n);
      badge.hidden = n <= 0;
      badge.style.display = n > 0 ? "flex" : "none";
    }
  }

  // ---------- invoice modal ----------
  function ensureInvoiceModal() {
    let overlay = document.getElementById("invoice-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "invoice-overlay";
    overlay.innerHTML = `
      <div class="inv-backdrop" data-close></div>

      <div class="inv-sheet" role="dialog" aria-modal="true" aria-label="Invoice">
        <div class="inv-head">
          <button type="button" class="inv-x" data-close aria-label="Close">X</button>

          <div class="inv-title">INVOICE</div>

          <div class="inv-meta">
            <div id="inv-datetime"></div>
            <div id="inv-shop"></div>
            <div id="inv-number"></div>
          </div>

          <div class="inv-customer" id="inv-customer">
            Attach Saved Customer <span class="chev"></span>
          </div>
        </div>

        <div class="inv-body">
          <div id="inv-list"></div>
        </div>

        <div class="inv-foot">
          <div class="inv-actions">
            <button type="button" class="inv-btn" id="inv-save">Save Draft</button>
            <button type="button" class="inv-btn primary" id="inv-confirm">Confirm</button>
          </div>

          <div class="inv-totals" id="inv-totals"></div>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target?.matches("[data-close]")) closeInvoiceModal();
    });

    overlay.querySelector("#inv-customer")?.addEventListener("click", () => openCustomerPicker());

    overlay.querySelector("#inv-save")?.addEventListener("click", () => saveDraft());
    overlay.querySelector("#inv-confirm")?.addEventListener("click", () => confirmSale());

    document.body.appendChild(overlay);
    return overlay;
  }

  function renderInvoice() {
    const cart = readCart();
    const items = cart.items || [];

    const overlay = ensureInvoiceModal();
    const listEl = overlay.querySelector("#inv-list");
    const totalsEl = overlay.querySelector("#inv-totals");

    // header meta
    const head = getInvoiceHeaderMeta();
    overlay.querySelector("#inv-datetime").textContent = nowStamp();
    overlay.querySelector("#inv-shop").textContent = head.shopName;
    overlay.querySelector("#inv-number").textContent = head.invoiceNumber;

    // customer label
    const meta = readInvoiceMeta();
    const custBtn = overlay.querySelector("#inv-customer");
    if (custBtn) {
      if (meta.customerId && meta.customerLabel) {
        custBtn.classList.add("is-attached");
        custBtn.innerHTML = `${escapeHTML(meta.customerLabel)} <span class="chev"></span>`;
      } else {
        custBtn.classList.remove("is-attached");
        custBtn.innerHTML = `Attach Saved Customer <span class="chev"></span>`;
      }
    }

    if (!listEl || !totalsEl) return;

    if (!items.length) {
      listEl.innerHTML = `<div class="inv-empty">No items yet.</div>`;
      totalsEl.innerHTML = "";
      return;
    }

    listEl.innerHTML = items.map((it) => {
      const id = escapeHTML(it.id);
      const qty = Number(it.qty || 0);
      const unit = Number(it.price || 0);
      const lineTotal = unit * qty;

      const imgHTML = it.img
        ? `<div class="inv-ico"><img src="${escapeHTML(it.img)}" alt=""></div>`
        : `<div class="inv-ico"></div>`;

      const isCigar = !!it.isCigar;

      if (!isCigar) {
        return `
          <div class="inv-row" data-id="${id}">
            ${imgHTML}
            <div class="inv-text">
              <div class="inv-l1">${escapeHTML(it.category || "Item")}</div>
              <div class="inv-l2">${escapeHTML(it.name || "Item")}</div>
              <div class="inv-l3">${money(unit)}</div>
            </div>

            <div class="inv-qty">
              <button type="button" class="qbtn" data-inc aria-label="Increase">+</button>
              <div class="qpill">${qty}</div>
              <button type="button" class="qbtn" data-dec aria-label="Decrease">−</button>
            </div>

            <div class="inv-total">${money(lineTotal)}</div>
          </div>
        `;
      }

      const cigarLine = (it.cigarLine || "").trim();
      const cigarName = (it.cigarName || it.name || "").trim();
      const linkText = escapeHTML([cigarLine, cigarName].filter(Boolean).join(" "));
      const brandName = escapeHTML(it.brand || "");
      const vitola = escapeHTML(it.vitola || "");
      const msrp = it.msrp !== "" && it.msrp != null ? money(it.msrp) : money(unit);
      const l3 = `${vitola}${vitola ? " - " : ""}${msrp}`;

      const link = it.url
        ? `<a class="inv-link" href="${escapeHTML(it.url)}">${linkText || escapeHTML(it.name || "Cigar")}</a>`
        : `<span>${linkText || escapeHTML(it.name || "Cigar")}</span>`;

      return `
        <div class="inv-row" data-id="${id}">
          ${imgHTML}
          <div class="inv-text">
            <div class="inv-l1">${link}</div>
            <div class="inv-l2">${brandName}</div>
            <div class="inv-l3">${l3}</div>
          </div>

          <div class="inv-qty">
            <button type="button" class="qbtn" data-inc aria-label="Increase">+</button>
            <div class="qpill">${qty}</div>
            <button type="button" class="qbtn" data-dec aria-label="Decrease">−</button>
          </div>

          <div class="inv-total">${money(lineTotal)}</div>
        </div>
      `;
    }).join("");

    // bind qty buttons
    listEl.querySelectorAll(".inv-row").forEach((row) => {
      const id = row.getAttribute("data-id");

      row.querySelector("[data-dec]")?.addEventListener("click", () => {
        const c = readCart();
        const item = c.items.find((x) => normalizeId(x.id) === normalizeId(id));
        if (!item) return;
        setQty(id, Number(item.qty || 0) - 1);
        renderInvoice();
      });

      row.querySelector("[data-inc]")?.addEventListener("click", () => {
        const c = readCart();
        const item = c.items.find((x) => normalizeId(x.id) === normalizeId(id));
        if (!item) return;
        setQty(id, Number(item.qty || 0) + 1);
        renderInvoice();
      });
    });

    // totals
    const subtotal = items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    totalsEl.innerHTML = `
      <div class="line"><span>SUBTOTAL</span><strong>${money(subtotal)}</strong></div>
      <div class="line"><span>TAX</span><strong>${money(tax)}</strong></div>
      <div class="line grand"><span>TOTAL</span><strong>${money(total)}</strong></div>
    `;
  }

  function openInvoiceModal() {
    const overlay = ensureInvoiceModal();
    overlay.classList.add("open");
    document.body.classList.add("pos-modal-open");
    renderInvoice();
  }

  function closeInvoiceModal() {
    const overlay = document.getElementById("invoice-overlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    document.body.classList.remove("pos-modal-open");
  }

  // ---------- Add-to-bill modal (non-cigar categories) ----------
  function ensureAddConfirm() {
    let overlay = document.getElementById("addbill-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "addbill-overlay";
    overlay.innerHTML = `
      <div class="addbill-backdrop" data-close></div>
      <div class="addbill-card" role="dialog" aria-modal="true" aria-label="Add to bill">
        <div class="addbill-ico" id="addbill-ico"></div>
        <div class="addbill-title" id="addbill-title"></div>
        <button type="button" class="addbill-btn" id="addbill-btn">Add to bill</button>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target?.matches("[data-close]")) closeAddConfirm();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  let pendingAdd = null;

  function openAddConfirm(payload) {
    pendingAdd = payload || null;

    const overlay = ensureAddConfirm();
    const ico = overlay.querySelector("#addbill-ico");
    const title = overlay.querySelector("#addbill-title");
    const btn = overlay.querySelector("#addbill-btn");

    if (ico) ico.innerHTML = payload?.img ? `<img src="${escapeHTML(payload.img)}" alt="">` : "";
    if (title) title.textContent = `${payload?.name || "Item"} - ${money(payload?.price || 0)}`;

    btn?.addEventListener("click", onConfirmAdd, { once: true });

    overlay.classList.add("open");
    document.body.classList.add("pos-modal-open");
  }

  function closeAddConfirm() {
    const overlay = document.getElementById("addbill-overlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    document.body.classList.remove("pos-modal-open");
    pendingAdd = null;
  }

  function onConfirmAdd() {
    if (!pendingAdd) return;

    addItem({
      id: pendingAdd.id || `${pendingAdd.category || ""}|${pendingAdd.name || ""}`,
      category: pendingAdd.category || "",
      name: pendingAdd.name || "Item",
      price: Number(pendingAdd.price || 0),
      img: pendingAdd.img || "",
      isCigar: false,
    });

    updateFab();
    const inv = document.getElementById("invoice-overlay");
    if (inv && inv.classList.contains("open")) renderInvoice();

    closeAddConfirm();
  }

  // ---------- customer picker ----------
  function ensureCustomerPicker() {
    let overlay = document.getElementById("cust-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "cust-overlay";
    overlay.innerHTML = `
      <div class="cust-backdrop" data-close></div>

      <div class="cust-sheet" role="dialog" aria-modal="true" aria-label="Select Customer">
        <div class="cust-head">
          <div class="cust-toprow">
            <div class="cust-title">Attach Customer</div>
            <button class="cust-close" type="button" data-close aria-label="Close">X</button>
          </div>
          <input class="cust-search" id="cust-search" type="search"
                 placeholder="Search first, last, phone, or email" />
        </div>

        <div class="cust-body" id="cust-list"></div>

        <div class="cust-actions">
          <button type="button" class="cust-btn" id="cust-detach">Detach</button>
          <button type="button" class="cust-btn" id="cust-closebtn">Close</button>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target?.matches("[data-close]")) closeCustomerPicker();
    });

    overlay.querySelector("#cust-closebtn")?.addEventListener("click", closeCustomerPicker);
    overlay.querySelector("#cust-detach")?.addEventListener("click", () => {
      detachCustomer();
      closeCustomerPicker();
      const inv = document.getElementById("invoice-overlay");
      if (inv && inv.classList.contains("open")) renderInvoice();
    });

    const input = overlay.querySelector("#cust-search");
    input?.addEventListener("input", () => renderCustomerList(input.value || ""));

    document.body.appendChild(overlay);
    return overlay;
  }

  function openCustomerPicker() {
    const overlay = ensureCustomerPicker();
    overlay.classList.add("open");
    document.body.classList.add("pos-modal-open");

    const input = overlay.querySelector("#cust-search");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 50);
    }

    renderCustomerList("");
  }

  function closeCustomerPicker() {
    const overlay = document.getElementById("cust-overlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    document.body.classList.remove("pos-modal-open");
  }

  function renderCustomerList(query) {
    const overlay = ensureCustomerPicker();
    const listEl = overlay.querySelector("#cust-list");
    if (!listEl) return;

    const q = (query || "").trim().toLowerCase();
    const customers = readCustomers();

    const filtered = !q ? customers : customers.filter((c) => {
      const hay = [
        c.firstName, c.lastName, c.phone, c.email,
        `${c.firstName || ""} ${c.lastName || ""}`.trim(),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div class="inv-empty">No customers found.</div>`;
      return;
    }

    listEl.innerHTML = filtered.map((c) => {
      const name = `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.email || c.phone || "Customer";
      const sub = [
        c.phone ? `Phone: ${c.phone}` : "",
        c.email ? `Email: ${c.email}` : "",
        `Points: ${Number(c.points || 0)}`,
      ].filter(Boolean).join(" • ");

      return `
        <div class="cust-card" data-cust="${escapeHTML(c.id)}">
          <div class="cust-name">${escapeHTML(name)}</div>
          <div class="cust-sub">${escapeHTML(sub)}</div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".cust-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-cust");
        const cust = customers.find((x) => String(x.id) === String(id));
        if (!cust) return;

        const label = `${(cust.firstName || "").trim()} ${(cust.lastName || "").trim()}`.trim()
          || cust.email || cust.phone || "Customer";

        writeInvoiceMeta({ customerId: cust.id, customerLabel: label });

        closeCustomerPicker();

        const inv = document.getElementById("invoice-overlay");
        if (inv && inv.classList.contains("open")) renderInvoice();
      });
    });
  }

  // ---------- draft + confirm ----------
  function getTotalsFromCart() {
    const items = readCart().items || [];
    const subtotal = items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }

  function saveDraft() {
    const cart = readCart();
    const items = cart.items || [];
    if (!items.length) return;

    const head = getInvoiceHeaderMeta();
    const meta = readInvoiceMeta();
    const totals = getTotalsFromCart();

    const drafts = readDrafts();
    drafts.unshift({
      id: uid(),
      createdAt: new Date().toISOString(),
      shopName: head.shopName,
      invoiceNumber: head.invoiceNumber,
      customerId: meta.customerId || "",
      customerLabel: meta.customerLabel || "",
      items,
      totals,
      status: "draft",
    });
    writeDrafts(drafts);

    // keep active cart (your call). If you want it cleared on draft, uncomment:
    // clearCart(); detachCustomer();

    // small UX: close invoice after saving
    closeInvoiceModal();
  }

  function confirmSale() {
    const cart = readCart();
    const items = cart.items || [];
    if (!items.length) return;

    const head = getInvoiceHeaderMeta();
    const meta = readInvoiceMeta();
    const totals = getTotalsFromCart();

    const pts = computePoints(totals.subtotal, totals.total);

    // award points if customer attached
    let awarded = null;
    if (meta.customerId) {
      awarded = awardPointsToCustomer(meta.customerId, pts);
    }

    // save sale record
    const sales = readSales();
    sales.unshift({
      id: uid(),
      createdAt: new Date().toISOString(),
      shopName: head.shopName,
      invoiceNumber: head.invoiceNumber,
      customerId: meta.customerId || "",
      customerLabel: meta.customerLabel || "",
      pointsEarned: meta.customerId ? pts : 0,
      items,
      totals,
      status: "paid",
    });
    writeSales(sales);

    // clear active bill
    clearCart();
    detachCustomer();
    updateFab();
    renderInvoice();

    // close modal
    closeInvoiceModal();
  }

  // ---------- global close behaviors ----------
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const inv = document.getElementById("invoice-overlay");
    if (inv && inv.classList.contains("open")) closeInvoiceModal();

    const add = document.getElementById("addbill-overlay");
    if (add && add.classList.contains("open")) closeAddConfirm();

    const cust = document.getElementById("cust-overlay");
    if (cust && cust.classList.contains("open")) closeCustomerPicker();
  });

  // ---------- sync across pages/tabs ----------
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) updateFab();
  });
  window.addEventListener("cigaros:cart-changed", () => {
    updateFab();
    const inv = document.getElementById("invoice-overlay");
    if (inv && inv.classList.contains("open")) renderInvoice();
  });
  window.addEventListener("cigaros:invoice-meta-changed", () => {
    const inv = document.getElementById("invoice-overlay");
    if (inv && inv.classList.contains("open")) renderInvoice();
  });

  // ---------- init ----------
  window.addEventListener("DOMContentLoaded", () => {
    ensureStyles();
    ensureFab();
  });
})();
