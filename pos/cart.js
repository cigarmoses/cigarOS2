/* /pos/cart.js
   Shared cart + bottom-right invoice FAB + invoice modal + product "Add to invoice" confirm popup.
   Single source of truth across all POS pages.

   Storage:
   - CART_KEY: active open invoice (persists across pages until saved/confirmed)
   - (sales + customers can be wired next; this file focuses on the cart/invoice UX)

   Icon logic:
   - Green icon when cart empty: /img/icons/receipt.png
   - Red icon when cart has items: /img/icons/receiptred.png
*/

(() => {
  const CART_KEY = "cigaros_cart_v1";
  const TAX_RATE = 0.07;

  // ---------- utils ----------
  const money = (n) => {
    const x = Number(n || 0);
    return x.toFixed(2);
  };

  const nowStamp = () => {
    try {
      return new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return new Date().toString();
    }
  };

  const safeJSON = (s, fallback) => {
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  };

  const norm = (s) => (s || "").toString().trim().toLowerCase();

  const escapeHTML = (s) => {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  // ---------- cart state ----------
  function readCart() {
    return safeJSON(localStorage.getItem(CART_KEY), { items: [] });
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: cart }));
  }

  function cartCount(cart) {
    return (cart.items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0);
  }

  function addItem(payload) {
    const cart = readCart();

    // stable id (category|brand|name|sub)
    const id =
      payload.id ||
      `${payload.kind || ""}|${payload.category || ""}|${payload.brand || ""}|${payload.name || ""}|${payload.sub || ""}`;
    const key = norm(id);
    if (!key) return;

    const idx = cart.items.findIndex((x) => norm(x.id) === key);

    if (idx >= 0) {
      cart.items[idx].qty = Number(cart.items[idx].qty || 0) + 1;
    } else {
      cart.items.push({
        id: key,

        kind: payload.kind || "product", // "product" | "cigar"
        category: payload.category || "",

        // product fields
        name: payload.name || "Item",
        price: Number(payload.price || 0),
        img: payload.img || "",

        // cigar-ish fields (optional)
        brand: payload.brand || "",
        sub: payload.sub || "", // vitola/size line
        href: payload.href || "", // optional link for cigar name row

        qty: 1,
      });
    }

    writeCart(cart);
  }

  function setQty(id, qty) {
    const cart = readCart();
    const idx = cart.items.findIndex((x) => norm(x.id) === norm(id));
    if (idx < 0) return;

    const q = Math.max(0, Number(qty || 0));
    if (q === 0) cart.items.splice(idx, 1);
    else cart.items[idx].qty = q;

    writeCart(cart);
  }

  function clearCart() {
    writeCart({ items: [] });
  }

  // expose API
  window.CigarOSCart = {
    read: readCart,
    add: addItem,
    setQty,
    clear: clearCart,
    money,
  };

  // ---------- styles (injected so every page gets correct FAB + modals) ----------
  function ensureStyles() {
    if (document.getElementById("cigaros-cart-styles")) return;

    const css = document.createElement("style");
    css.id = "cigaros-cart-styles";
    css.textContent = `
      /* Bottom-right invoice icon */
      .receipt-fab{
        position:fixed;
        right:16px;
        bottom:16px;
        width:56px;
        height:56px;
        border:none;
        padding:0;
        border-radius:16px;
        background:transparent;
        z-index:999;
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      .receipt-fab img{
        width:56px;
        height:56px;
        display:block;
        border-radius:16px;
        box-shadow:0 10px 22px rgba(0,0,0,0.18);
        background:#fff;
      }
      .receipt-badge{
        position:absolute;
        right:-6px;
        top:-6px;
        min-width:22px;
        height:22px;
        padding:0 6px;
        border-radius:999px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:12px;
        font-weight:800;
        color:#fff;
        background:#ff3b30;
        box-shadow:0 8px 16px rgba(0,0,0,0.22);
      }

      /* Dimmed overlay */
      .pos-modal-overlay{
        position:fixed;
        inset:0;
        background:rgba(0,0,0,0.35);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:14px;
        z-index:1000;
      }

      /* Sheet */
      .pos-modal-sheet{
        width:min(520px, 100%);
        max-height:calc(100vh - 28px);
        background:#fff;
        border-radius:18px;
        overflow:hidden;
        box-shadow:0 24px 60px rgba(0,0,0,0.35);
        display:flex;
        flex-direction:column;
      }

      .pos-modal-head{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        padding:14px 16px 6px;
      }
      .pos-modal-x{
        border:none;
        background:transparent;
        color:#007aff;
        font-size:16px;
        font-weight:600;
        cursor:pointer;
        padding:0;
      }
      .pos-modal-meta{
        text-align:right;
        color:#6a7586;
        font-size:12px;
        line-height:1.2;
      }
      .pos-modal-meta .pos-modal-date{
        font-weight:600;
      }
      .pos-modal-customer{
        margin-top:6px;
        display:flex;
        gap:8px;
        align-items:center;
        justify-content:flex-end;
      }
      .pos-modal-customer .label{
        color:#6a7586;
        font-weight:600;
      }
      .pos-modal-pill{
        border:1px solid #d1d7e2;
        background:#fff;
        border-radius:999px;
        padding:6px 10px;
        font-size:12px;
        font-weight:700;
        cursor:pointer;
      }

      .pos-modal-title{
        font-size:44px;
        font-weight:900;
        margin:0;
        padding:0 16px 10px;
        color:#0f1a2c;
      }

      /* Invoice list */
      .pos-invoice-list{
        padding:0 0 6px;
        overflow:auto;
        -webkit-overflow-scrolling:touch;
        border-top:1px solid #e6ebf2;
        border-bottom:1px solid #e6ebf2;
      }

      .pos-invoice-row{
        display:grid;
        grid-template-columns:64px 1fr auto auto;
        gap:12px;
        align-items:center;
        padding:12px 16px;
        border-bottom:1px solid #eef2f7;
      }
      .pos-invoice-row:last-child{ border-bottom:none; }

      .pos-invoice-ico{
        width:56px;
        height:56px;
        border-radius:12px;
        background:#dbe8f8;
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
      }
      .pos-invoice-ico img{
        width:100%;
        height:100%;
        object-fit:cover;
      }

      .pos-invoice-main{ min-width:0; }
      .pos-invoice-cat{
        font-size:14px;
        font-weight:900;
        color:#0f1a2c;
        line-height:1.1;
      }
      .pos-invoice-name{
        font-size:14px;
        font-weight:700;
        color:#0f1a2c;
        line-height:1.2;
        margin-top:2px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      .pos-invoice-name a{
        color:#0a84ff;
        text-decoration:none;
        font-weight:900;
      }
      .pos-invoice-sub{
        font-size:12px;
        color:#6a7586;
        margin-top:2px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .pos-qty{
        display:flex;
        align-items:center;
        gap:8px;
        background:#f2f4f8;
        border-radius:999px;
        padding:6px 10px;
      }
      .qty-btn{
        border:none;
        background:transparent;
        font-size:18px;
        font-weight:900;
        color:#0f1a2c;
        cursor:pointer;
        width:22px;
        height:22px;
        line-height:22px;
      }
      .qty-num{
        font-size:14px;
        font-weight:900;
        width:18px;
        text-align:center;
      }

      .pos-line-total{
        font-size:16px;
        font-weight:900;
        color:#0f1a2c;
        white-space:nowrap;
      }

      /* Totals + actions */
      .pos-totals{
        padding:12px 16px 8px;
      }
      .tot-line{
        display:flex;
        justify-content:space-between;
        font-size:14px;
        margin-top:6px;
        color:#0f1a2c;
        font-weight:700;
      }
      .tot-line.total{
        font-size:18px;
        font-weight:900;
        margin-top:10px;
      }

      .pos-actions{
        display:flex;
        gap:12px;
        padding:12px 16px 16px;
      }
      .pos-btn-light{
        flex:1;
        border-radius:14px;
        border:1px solid #d1d7e2;
        background:#fff;
        font-weight:900;
        padding:14px 12px;
        cursor:pointer;
      }
      .pos-btn-blue{
        flex:1;
        border-radius:14px;
        border:none;
        background:#0a84ff;
        color:#fff;
        font-weight:900;
        padding:14px 12px;
        cursor:pointer;
      }

      /* Add-to-invoice confirm popup */
      .pos-confirm-card{
        width:min(360px, 100%);
        background:#e9e9ea;
        border-radius:18px;
        padding:18px 18px 16px;
        box-shadow:0 24px 60px rgba(0,0,0,0.35);
        text-align:center;
      }
      .pos-confirm-ico{
        width:72px;
        height:72px;
        border-radius:18px;
        margin:0 auto 10px;
        overflow:hidden;
        background:#dbe8f8;
      }
      .pos-confirm-ico img{
        width:100%;
        height:100%;
        object-fit:cover;
      }
      .pos-confirm-title{
        font-size:28px;
        font-weight:900;
        margin:0 0 12px;
        color:#222;
      }
      .pos-confirm-btn{
        width:100%;
        border:none;
        border-radius:999px;
        padding:14px 14px;
        font-weight:900;
        font-size:18px;
        background:#fff;
        cursor:pointer;
      }
      .pos-confirm-btn:disabled{
        opacity:.55;
        cursor:not-allowed;
      }

      body.pos-modal-open { overflow:hidden; }
    `;
    document.head.appendChild(css);
  }

  // ---------- Invoice FAB ----------
  function ensureFab() {
    ensureStyles();

    let fab = document.querySelector(".receipt-fab");
    if (!fab) {
      fab = document.createElement("button");
      fab.className = "receipt-fab";
      fab.type = "button";
      fab.setAttribute("aria-label", "Invoice");
      fab.innerHTML = `
        <img src="/img/icons/receipt.png" alt="" />
        <span class="receipt-badge" hidden>0</span>
      `;
      document.body.appendChild(fab);
    }

    fab.addEventListener("click", () => openInvoiceModal());
    updateFab();
  }

  function updateFab() {
    const cart = readCart();
    const n = cartCount(cart);

    const fab = document.querySelector(".receipt-fab");
    if (!fab) return;

    const img = fab.querySelector("img");
    const badge = fab.querySelector(".receipt-badge");

    if (img) img.src = n > 0 ? "/img/icons/receiptred.png" : "/img/icons/receipt.png";
    if (badge) {
      badge.textContent = String(n);
      badge.hidden = n <= 0;
    }
  }

  // ---------- Invoice modal ----------
  function ensureInvoiceModal() {
    ensureStyles();

    let overlay = document.getElementById("invoice-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "invoice-overlay";
    overlay.className = "pos-modal-overlay";
    overlay.hidden = true;

    overlay.innerHTML = `
      <div class="pos-modal-sheet" role="dialog" aria-modal="true" aria-label="Invoice">
        <div class="pos-modal-head">
          <button type="button" class="pos-modal-x" data-close aria-label="Close">Close</button>
          <div class="pos-modal-meta">
            <div class="pos-modal-date" id="invoice-date"></div>
            <div class="pos-modal-customer">
              <span class="label">Customer:</span>
              <button type="button" class="pos-modal-pill" id="invoice-customer-pill">Attach customer ▾</button>
            </div>
          </div>
        </div>

        <h2 class="pos-modal-title">Invoice</h2>

        <div class="pos-invoice-list" id="invoice-list"></div>

        <div class="pos-totals" id="invoice-totals"></div>

        <div class="pos-actions">
          <button type="button" class="pos-btn-light" id="invoice-save">SAVE DRAFT</button>
          <button type="button" class="pos-btn-blue" id="invoice-confirm">CONFIRM</button>
        </div>
      </div>
    `;

    // close behaviors
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeInvoiceModal();
    });
    overlay.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", closeInvoiceModal);
    });
    document.addEventListener("keydown", (e) => {
      if (!overlay.hidden && e.key === "Escape") closeInvoiceModal();
    });

    // TODO: wire real customer dropdown later
    overlay.querySelector("#invoice-customer-pill")?.addEventListener("click", () => {
      alert("Customer attach UI will be wired next (loyalty points).");
    });

    // TODO: wire save/confirm later
    overlay.querySelector("#invoice-save")?.addEventListener("click", () => {
      alert("Save Draft will be wired next.");
    });
    overlay.querySelector("#invoice-confirm")?.addEventListener("click", () => {
      alert("Confirm will be wired next (points + sales).");
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function renderInvoice() {
    const cart = readCart();
    const list = document.getElementById("invoice-list");
    const totals = document.getElementById("invoice-totals");
    const dateEl = document.getElementById("invoice-date");

    if (dateEl) dateEl.textContent = nowStamp();
    if (!list || !totals) return;

    const items = cart.items || [];
    if (!items.length) {
      list.innerHTML = `<div style="padding:16px;color:#6a7586;font-weight:800;">No items yet.</div>`;
      totals.innerHTML = "";
      return;
    }

    list.innerHTML = items
      .map((it) => {
        const unit = Number(it.price || 0);
        const qty = Number(it.qty || 0);
        const lineTotal = unit * qty;

        const ico = it.img
          ? `<div class="pos-invoice-ico"><img src="${escapeHTML(it.img)}" alt="" /></div>`
          : `<div class="pos-invoice-ico"></div>`;

        // PRODUCT (Food & Bevs, Accessories, Ashtrays, Pipes, Packs):
        // 1) img
        // 2) category (bold), name, price
        // 3) qty adjuster
        // 4) line item total
        if ((it.kind || "product") !== "cigar") {
          return `
            <div class="pos-invoice-row" data-id="${escapeHTML(it.id)}">
              ${ico}
              <div class="pos-invoice-main">
                <div class="pos-invoice-cat">${escapeHTML(it.category || "Item")}</div>
                <div class="pos-invoice-name">${escapeHTML(it.name || "Item")}</div>
                <div class="pos-invoice-sub">${escapeHTML(money(unit))}</div>
              </div>
              <div class="pos-qty">
                <button type="button" class="qty-btn" data-dec aria-label="Decrease">−</button>
                <div class="qty-num">${qty}</div>
                <button type="button" class="qty-btn" data-inc aria-label="Increase">+</button>
              </div>
              <div class="pos-line-total">$${money(lineTotal)}</div>
            </div>
          `;
        }

        // CIGAR (kept compatible; you’ll refine later):
        // line1: cigar name (link if href)
        // line2: brand
        // line3: vitola/sub + MSRP (unit)
        const cigarName = it.href
          ? `<a href="${escapeHTML(it.href)}">${escapeHTML(it.name || "Cigar")}</a>`
          : escapeHTML(it.name || "Cigar");

        return `
          <div class="pos-invoice-row" data-id="${escapeHTML(it.id)}">
            ${ico}
            <div class="pos-invoice-main">
              <div class="pos-invoice-name">${cigarName}</div>
              <div class="pos-invoice-sub">${escapeHTML(it.brand || "")}</div>
              <div class="pos-invoice-sub">${escapeHTML(it.sub || "")}${it.sub ? " • " : ""}${escapeHTML(money(unit))}</div>
            </div>
            <div class="pos-qty">
              <button type="button" class="qty-btn" data-dec aria-label="Decrease">−</button>
              <div class="qty-num">${qty}</div>
              <button type="button" class="qty-btn" data-inc aria-label="Increase">+</button>
            </div>
            <div class="pos-line-total">$${money(lineTotal)}</div>
          </div>
        `;
      })
      .join("");

    // bind qty buttons
    list.querySelectorAll(".pos-invoice-row").forEach((row) => {
      const id = row.getAttribute("data-id");
      row.querySelector("[data-dec]")?.addEventListener("click", () => {
        const c = readCart();
        const item = (c.items || []).find((x) => norm(x.id) === norm(id));
        if (!item) return;
        setQty(id, Number(item.qty || 0) - 1);
        renderInvoice();
      });
      row.querySelector("[data-inc]")?.addEventListener("click", () => {
        const c = readCart();
        const item = (c.items || []).find((x) => norm(x.id) === norm(id));
        if (!item) return;
        setQty(id, Number(item.qty || 0) + 1);
        renderInvoice();
      });
    });

    const subtotal = items.reduce(
      (sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0),
      0
    );
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    totals.innerHTML = `
      <div class="tot-line"><span>SUBTOTAL</span><span>${money(subtotal)}</span></div>
      <div class="tot-line"><span>TAX</span><span>${money(tax)}</span></div>
      <div class="tot-line total"><span>TOTAL</span><span>${money(total)}</span></div>
    `;
  }

  function openInvoiceModal() {
    const overlay = ensureInvoiceModal();
    overlay.hidden = false;
    document.body.classList.add("pos-modal-open");
    renderInvoice();
  }

  function closeInvoiceModal() {
    const overlay = document.getElementById("invoice-overlay");
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("pos-modal-open");
  }

  // ---------- product "Add to invoice" confirm popup ----------
  function ensureAddConfirm() {
    ensureStyles();

    let overlay = document.getElementById("addconfirm-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "addconfirm-overlay";
    overlay.className = "pos-modal-overlay";
    overlay.hidden = true;

    overlay.innerHTML = `
      <div class="pos-confirm-card" role="dialog" aria-modal="true" aria-label="Add to invoice">
        <div class="pos-confirm-ico" id="addconfirm-ico"></div>
        <div class="pos-confirm-title" id="addconfirm-title">Item</div>
        <button type="button" class="pos-confirm-btn" id="addconfirm-btn">Add to invoice</button>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeAddConfirm();
    });
    document.addEventListener("keydown", (e) => {
      if (!overlay.hidden && e.key === "Escape") closeAddConfirm();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  let pendingPayload = null;

  function openAddConfirm(payload) {
    pendingPayload = payload;

    const overlay = ensureAddConfirm();
    const ico = overlay.querySelector("#addconfirm-ico");
    const title = overlay.querySelector("#addconfirm-title");
    const btn = overlay.querySelector("#addconfirm-btn");

    const name = payload?.name || "Item";
    const price = money(payload?.price || 0);

    if (title) title.textContent = `${name} - ${price}`;

    if (ico) {
      ico.innerHTML = payload?.img
        ? `<img src="${escapeHTML(payload.img)}" alt="" />`
        : ``;
    }

    if (btn) {
      btn.disabled = false;
      btn.onclick = () => {
        if (!pendingPayload) return;
        btn.disabled = true;

        addItem(pendingPayload);
        updateFab();
        closeAddConfirm();
      };
    }

    overlay.hidden = false;
    document.body.classList.add("pos-modal-open");
  }

  function closeAddConfirm() {
    const overlay = document.getElementById("addconfirm-overlay");
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("pos-modal-open");
    pendingPayload = null;
  }

  // ---------- click wiring for non-cigar product pages ----------
  // Any element with [data-invoice-product] will trigger the add-confirm popup.
  function bindProductClicks() {
    document.querySelectorAll("[data-invoice-product]").forEach((el) => {
      el.addEventListener("click", () => {
        const payload = {
          kind: "product",
          category: el.getAttribute("data-category") || "",
          name: el.getAttribute("data-name") || "Item",
          price: Number(el.getAttribute("data-price") || 0),
          img: el.getAttribute("data-img") || "",
        };
        openAddConfirm(payload);
      });
    });
  }

  // keep synced across pages/tabs
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) updateFab();
  });
  window.addEventListener("cigaros:cart-changed", () => updateFab());

  // initialize
  window.addEventListener("DOMContentLoaded", () => {
    ensureFab();
    bindProductClicks();
    updateFab();
  });
})();
