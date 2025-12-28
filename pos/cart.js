/* /pos/cart.js
   Shared cart + invoice FAB + invoice modal
   Used across all POS pages so the same active invoice persists.
*/

(() => {
  const CART_KEY = "cigaros_cart_v1";
  const TAX_RATE = 0.07;

  // Drafts + sales (basic persistence)
  const DRAFTS_KEY = "cigaros_invoice_drafts_v1";
  const SALES_KEY = "cigaros_sales_v1";

  // Loyalty
  const LOYALTY_CUSTOMERS_KEY = "cigaros_loyalty_customers_v1";
  const SELECTED_CUSTOMER_KEY = "cigaros_invoice_customer_v1";

  const ICON_EMPTY = "/img/icons/receipt.png";
  const ICON_ACTIVE = "/img/icons/receiptred.png";

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

  const uid = () => {
    return (
      "inv_" +
      Math.random().toString(16).slice(2) +
      "_" +
      Date.now().toString(16)
    );
  };

  function escapeHTML(s) {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- cart state ----------
  function readCart() {
    return safeJSON(localStorage.getItem(CART_KEY), { items: [] });
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(
      new CustomEvent("cigaros:cart-changed", { detail: cart })
    );
  }

  function normalizeId(s) {
    return (s || "").toString().trim().toLowerCase();
  }

  function cartCount(cart) {
    return (cart.items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0);
  }

  // payload supports:
  // { id, type: "product"|"cigar", category, name, brand, sub, price, img, link }
  function addItem(payload) {
    const cart = readCart();
    const id = normalizeId(payload.id || payload.key || payload.name);
    if (!id) return;

    const idx = cart.items.findIndex((x) => normalizeId(x.id) === id);
    if (idx >= 0) {
      cart.items[idx].qty = Number(cart.items[idx].qty || 0) + 1;
    } else {
      cart.items.push({
        id,
        type: payload.type || "product",
        category: payload.category || "",

        name: payload.name || "Item",
        price: Number(payload.price || 0),
        img: payload.img || "",

        brand: payload.brand || "",
        sub: payload.sub || "",
        link: payload.link || "",

        qty: 1,
      });
    }
    writeCart(cart);
  }

  function setQty(id, qty) {
    const cart = readCart();
    const idx = cart.items.findIndex(
      (x) => normalizeId(x.id) === normalizeId(id)
    );
    if (idx < 0) return;

    const q = Math.max(0, Number(qty || 0));
    if (q === 0) {
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].qty = q;
    }
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
    openInvoice: () => openInvoiceModal(),
  };

  // ---------- receipt/invoice FAB ----------
  function getOrCreateFab() {
    let fab =
      document.querySelector(".receipt-fab") ||
      document.getElementById("posReceiptFab") ||
      document.querySelector(".pos-receipt-fab");

    if (!fab) {
      fab = document.createElement("button");
      fab.type = "button";
      document.body.appendChild(fab);
    }

    fab.classList.add("receipt-fab");
    fab.removeAttribute("id");

    let img = fab.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.alt = "";
      fab.appendChild(img);
    }

    let badge = fab.querySelector(".receipt-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "receipt-badge";
      badge.hidden = true;
      badge.textContent = "0";
      fab.appendChild(badge);
    }

    img.src = ICON_EMPTY;

    // Prevent double-binding (safe)
    if (!fab.dataset.bound) {
      fab.dataset.bound = "1";
      fab.addEventListener("click", () => openInvoiceModal());
    }

    return fab;
  }

  function updateFab() {
    const cart = readCart();
    const n = cartCount(cart);

    const fab =
      document.querySelector(".receipt-fab") ||
      document.getElementById("posReceiptFab") ||
      document.querySelector(".pos-receipt-fab");

    if (!fab) return;

    const img = fab.querySelector("img");
    const badge = fab.querySelector(".receipt-badge");

    if (img) img.src = n > 0 ? ICON_ACTIVE : ICON_EMPTY;

    if (badge) {
      badge.textContent = String(n);
      badge.hidden = n <= 0;
    }
  }

  function ensureFabStyles() {
    if (document.getElementById("cigaros-fab-styles")) return;

    const style = document.createElement("style");
    style.id = "cigaros-fab-styles";
    style.textContent = `
      .receipt-fab{
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: 58px;
        height: 58px;
        border: none;
        background: transparent;
        padding: 0;
        border-radius: 16px;
        z-index: 60;
        cursor: pointer;
      }
      .receipt-fab img{
        width: 58px;
        height: 58px;
        display: block;
      }
      .receipt-fab .receipt-badge{
        position:absolute;
        right: -2px;
        bottom: -2px;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border-radius: 999px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 12px;
        font-weight: 700;
        background: #ff3b30;
        color: #fff;
        box-shadow: 0 6px 18px rgba(0,0,0,0.18);
      }

      .pos-modal-open{ overflow:hidden; }
      .pos-modal-overlay{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: 80;
        display:flex;
        align-items:flex-end;
        justify-content:center;
        padding: 14px;
      }
      .pos-modal-sheet{
        width: min(560px, 100%);
        background: #fff;
        border-radius: 18px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.35);
        overflow: hidden;
      }
      .pos-modal-topbar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(0,0,0,0.08);
      }
      .pos-modal-topbar .left,
      .pos-modal-topbar .center,
      .pos-modal-topbar .right{
        min-width: 80px;
      }
      .pos-modal-topbar .center{
        text-align:center;
        font-weight: 800;
        font-size: 18px;
      }
      .pos-link{
        border:none;
        background:transparent;
        color:#007aff;
        font-size: 16px;
        font-weight: 600;
        cursor:pointer;
      }
      .pos-meta{
        padding: 10px 14px 0;
        color: #6a7586;
        font-size: 13px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
      }
      .pos-customer-pill{
        border: 1px solid rgba(0,0,0,0.12);
        background: #fff;
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 14px;
        cursor:pointer;
        display:flex;
        gap: 8px;
        align-items:center;
        white-space: nowrap;
      }
      .pos-title{
        padding: 6px 14px 10px;
        font-size: 52px;
        font-weight: 900;
        letter-spacing: -0.02em;
        color: #0f1a2c;
      }
      .pos-list{
        padding: 6px 0;
        max-height: 54vh;
        overflow:auto;
      }
      .pos-empty{
        padding: 18px 14px;
        color:#6a7586;
        font-weight:600;
      }
      .inv-row{
        display:flex;
        gap: 12px;
        align-items:center;
        padding: 12px 14px;
        border-top: 1px solid rgba(0,0,0,0.08);
      }
      .inv-ico{
        width: 54px;
        height: 54px;
        border-radius: 14px;
        overflow:hidden;
        background: #e8f1ff;
        flex: 0 0 auto;
        display:flex;
        align-items:center;
        justify-content:center;
      }
      .inv-ico img{ width:100%; height:100%; object-fit:cover; display:block; }
      .inv-main{
        flex: 1 1 auto;
        min-width: 0;
      }
      .inv-line1{
        font-weight: 800;
        font-size: 18px;
        color:#0f1a2c;
        white-space: nowrap;
        overflow:hidden;
        text-overflow: ellipsis;
      }
      .inv-line2, .inv-line3{
        font-size: 14px;
        color:#6a7586;
        line-height: 1.2;
        white-space: nowrap;
        overflow:hidden;
        text-overflow: ellipsis;
      }
      .inv-line1 a{
        color:#007aff;
        text-decoration:none;
        font-weight: 800;
      }
      .inv-qty{
        display:flex;
        align-items:center;
        gap: 10px;
        background: #f2f2f7;
        border-radius: 999px;
        padding: 6px 10px;
        flex: 0 0 auto;
      }
      .qty-btn{
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border:none;
        background: transparent;
        font-size: 22px;
        font-weight: 700;
        color:#0f1a2c;
        cursor:pointer;
      }
      .qty-num{
        min-width: 16px;
        text-align:center;
        font-weight: 700;
        color:#0f1a2c;
      }
      .inv-total{
        font-weight: 800;
        font-size: 22px;
        color:#0f1a2c;
        flex: 0 0 auto;
        min-width: 86px;
        text-align:right;
      }

      .totals{
        padding: 10px 14px 0;
        border-top: 1px solid rgba(0,0,0,0.08);
      }
      .tot-line{
        display:flex;
        justify-content:space-between;
        font-size: 18px;
        padding: 4px 0;
        color:#0f1a2c;
      }
      .tot-line.total{
        font-size: 34px;
        font-weight: 900;
        padding-top: 8px;
      }
      .inv-actions{
        display:flex;
        gap: 12px;
        padding: 12px 14px 16px;
      }
      .btn-light{
        flex: 1 1 50%;
        border-radius: 16px;
        border: 2px solid rgba(0,0,0,0.12);
        background: #fff;
        padding: 16px 14px;
        font-weight: 900;
        font-size: 16px;
        cursor:pointer;
      }
      .btn-blue{
        flex: 1 1 50%;
        border-radius: 16px;
        border: none;
        background: #007aff;
        color:#fff;
        padding: 16px 14px;
        font-weight: 900;
        font-size: 16px;
        cursor:pointer;
      }

      .cust-sheet{
        width: min(560px, 100%);
        background: #fff;
        border-radius: 18px;
        overflow:hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.35);
      }
      .cust-body{ padding: 12px 14px 14px; }
      .cust-search{
        width: 100%;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,0.12);
        font-size: 15px;
        outline:none;
      }
      .cust-list{
        margin-top: 10px;
        max-height: 52vh;
        overflow:auto;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,0.10);
      }
      .cust-row{
        padding: 10px 12px;
        border-top: 1px solid rgba(0,0,0,0.08);
        cursor:pointer;
      }
      .cust-row:first-child{ border-top:none; }
      .cust-row .n{ font-weight: 800; color:#0f1a2c; }
      .cust-row .m{ font-size: 13px; color:#6a7586; margin-top:2px; }
      .cust-empty{
        padding: 12px;
        color:#6a7586;
        font-weight: 600;
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- invoice modal ----------
  function bindInvoiceCloseHandlers(overlay) {
    if (!overlay) return;

    // prevent double-binding
    if (overlay.dataset.bound === "1") return;
    overlay.dataset.bound = "1";

    // click outside to close
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeInvoiceModal();
    });

    // close buttons
    overlay.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", closeInvoiceModal);
    });

    // escape
    document.addEventListener("keydown", (e) => {
      if (!overlay.hidden && e.key === "Escape") closeInvoiceModal();
    });

    // attach customer picker
    overlay.querySelector("#inv-customer-btn")?.addEventListener("click", () => {
      openCustomerPicker();
    });

    // save/confirm
    overlay.querySelector("#inv-save")?.addEventListener("click", () => {
      saveDraft();
    });
    overlay.querySelector("#inv-confirm")?.addEventListener("click", () => {
      confirmSale();
    });
  }

  function ensureInvoiceModal() {
    let overlay = document.getElementById("invoice-overlay");

    // IMPORTANT: If it already exists, still bind handlers.
    if (overlay) {
      bindInvoiceCloseHandlers(overlay);
      return overlay;
    }

    overlay = document.createElement("div");
    overlay.id = "invoice-overlay";
    overlay.className = "pos-modal-overlay";
    overlay.hidden = true;

    overlay.innerHTML = `
      <div class="pos-modal-sheet" role="dialog" aria-modal="true" aria-label="Invoice">
        <div class="pos-modal-topbar">
          <div class="left"><button type="button" class="pos-link" data-close>Close</button></div>
          <div class="center">Receipt</div>
          <div class="right"></div>
        </div>

        <div class="pos-meta">
          <div id="inv-date"></div>
          <button type="button" class="pos-customer-pill" id="inv-customer-btn">
            <span style="color:#6a7586;font-weight:700;">Customer:</span>
            <span id="inv-customer-name" style="font-weight:900;color:#0f1a2c;">Attach customer</span>
            <span style="color:#6a7586;">▾</span>
          </button>
        </div>

        <div class="pos-title">Invoice</div>

        <div class="pos-list" id="inv-list"></div>

        <div class="totals" id="inv-totals"></div>

        <div class="inv-actions">
          <button type="button" class="btn-light" id="inv-save">SAVE DRAFT</button>
          <button type="button" class="btn-blue" id="inv-confirm">CONFIRM</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    bindInvoiceCloseHandlers(overlay);
    return overlay;
  }

  function openInvoiceModal() {
    ensureFabStyles();
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

  function selectedCustomerId() {
    return (localStorage.getItem(SELECTED_CUSTOMER_KEY) || "").trim();
  }

  function setSelectedCustomer(id) {
    localStorage.setItem(SELECTED_CUSTOMER_KEY, String(id || ""));
    renderCustomerChip();
  }

  function getCustomers() {
    return safeJSON(localStorage.getItem(LOYALTY_CUSTOMERS_KEY), []);
  }

  function setCustomers(list) {
    localStorage.setItem(LOYALTY_CUSTOMERS_KEY, JSON.stringify(list || []));
  }

  function renderCustomerChip() {
    const nameEl = document.getElementById("inv-customer-name");
    if (!nameEl) return;

    const id = selectedCustomerId();
    if (!id) {
      nameEl.textContent = "Attach customer";
      return;
    }

    const customers = getCustomers();
    const c = customers.find((x) => String(x.id) === String(id));
    nameEl.textContent = c?.name || "Attach customer";
  }

  function openCustomerPicker() {
    let overlay = document.getElementById("cust-overlay");
    if (overlay) {
      overlay.hidden = false;
      return;
    }

    overlay = document.createElement("div");
    overlay.id = "cust-overlay";
    overlay.className = "pos-modal-overlay";
    overlay.hidden = false;

    overlay.innerHTML = `
      <div class="cust-sheet" role="dialog" aria-modal="true" aria-label="Select customer">
        <div class="pos-modal-topbar">
          <div class="left"><button type="button" class="pos-link" data-cust-close>Close</button></div>
          <div class="center">Customer</div>
          <div class="right"></div>
        </div>
        <div class="cust-body">
          <input class="cust-search" id="cust-search" type="search" placeholder="Search name, phone, email" autocomplete="off" />
          <div class="cust-list" id="cust-list"></div>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.hidden = true;
    });
    overlay
      .querySelector("[data-cust-close]")
      ?.addEventListener("click", () => (overlay.hidden = true));

    document.body.appendChild(overlay);

    const input = overlay.querySelector("#cust-search");
    const list = overlay.querySelector("#cust-list");

    const render = (filter = "") => {
      const customers = getCustomers();
      const q = (filter || "").toLowerCase().trim();

      const filtered = !q
        ? customers
        : customers.filter((c) => {
            const blob = `${c.name || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
            return blob.includes(q);
          });

      if (!filtered.length) {
        list.innerHTML = `<div class="cust-empty">${
          customers.length
            ? "No matches."
            : "No customers found yet. Add customers in Loyalty first."
        }</div>`;
        return;
      }

      list.innerHTML = filtered
        .map((c) => {
          const meta = [
            c.phone ? `📞 ${c.phone}` : "",
            c.email ? `✉️ ${c.email}` : "",
            typeof c.points === "number" ? `${c.points} pts` : "",
          ]
            .filter(Boolean)
            .join(" • ");

          return `
            <div class="cust-row" data-id="${escapeHTML(String(c.id))}">
              <div class="n">${escapeHTML(c.name || "Customer")}</div>
              <div class="m">${escapeHTML(meta)}</div>
            </div>
          `;
        })
        .join("");

      list.querySelectorAll(".cust-row").forEach((row) => {
        row.addEventListener("click", () => {
          setSelectedCustomer(row.getAttribute("data-id"));
          overlay.hidden = true;
        });
      });
    };

    input?.addEventListener("input", () => render(input.value));
    render(input?.value || "");
  }

  function renderInvoice() {
    const cart = readCart();
    const list = document.getElementById("inv-list");
    const totals = document.getElementById("inv-totals");
    const dateEl = document.getElementById("inv-date");

    if (dateEl) dateEl.textContent = nowStamp();
    renderCustomerChip();

    if (!list || !totals) return;

    const items = cart.items || [];
    if (!items.length) {
      list.innerHTML = `<div class="pos-empty">No items yet.</div>`;
      totals.innerHTML = "";
      return;
    }

    list.innerHTML = items
      .map((it) => {
        const isCigar = String(it.type || "").toLowerCase() === "cigar";
        const imgHTML = it.img
          ? `<div class="inv-ico"><img src="${escapeHTML(it.img)}" alt="" /></div>`
          : `<div class="inv-ico"></div>`;

        let line1 = "";
        let line2 = "";
        let line3 = "";

        if (isCigar) {
          const title = escapeHTML(it.name);
          line1 = it.link
            ? `<div class="inv-line1"><a href="${escapeHTML(it.link)}" target="_blank" rel="noopener">${title}</a></div>`
            : `<div class="inv-line1">${title}</div>`;
          line2 = `<div class="inv-line2">${escapeHTML(it.brand || "")}</div>`;
          const sub = it.sub ? escapeHTML(it.sub) : "";
          line3 = `<div class="inv-line3">${sub}${sub ? " • " : ""}$${money(it.price)}</div>`;
        } else {
          // PRODUCT: title line = category
          line1 = `<div class="inv-line1">${escapeHTML(it.category || "Product")}</div>`;
          line2 = `<div class="inv-line2">${escapeHTML(it.name || "")}</div>`;
          line3 = `<div class="inv-line3">$${money(it.price)}</div>`;
        }

        return `
          <div class="inv-row" data-id="${escapeHTML(it.id)}">
            ${imgHTML}
            <div class="inv-main">
              ${line1}
              ${line2}
              ${line3}
            </div>
            <div class="inv-qty">
              <button type="button" class="qty-btn" data-dec aria-label="Decrease">−</button>
              <div class="qty-num">${Number(it.qty || 0)}</div>
              <button type="button" class="qty-btn" data-inc aria-label="Increase">+</button>
            </div>
            <div class="inv-total">$${money(Number(it.price || 0) * Number(it.qty || 0))}</div>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll(".inv-row").forEach((row) => {
      const id = row.getAttribute("data-id");
      row.querySelector("[data-dec]")?.addEventListener("click", () => {
        const c = readCart();
        const item = (c.items || []).find(
          (x) => normalizeId(x.id) === normalizeId(id)
        );
        if (!item) return;
        setQty(id, Number(item.qty || 0) - 1);
        renderInvoice();
      });
      row.querySelector("[data-inc]")?.addEventListener("click", () => {
        const c = readCart();
        const item = (c.items || []).find(
          (x) => normalizeId(x.id) === normalizeId(id)
        );
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
      <div class="tot-line"><span>Subtotal</span><span>$${money(subtotal)}</span></div>
      <div class="tot-line"><span>Tax</span><span>$${money(tax)}</span></div>
      <div class="tot-line total"><span>Total</span><span>$${money(total)}</span></div>
    `;
  }

  function computeTotals(items) {
    const subtotal = (items || []).reduce(
      (sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0),
      0
    );
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }

  function saveDraft() {
    const cart = readCart();
    const items = cart.items || [];
    if (!items.length) return;

    const totals = computeTotals(items);

    const draft = {
      id: uid(),
      createdAt: new Date().toISOString(),
      stamp: nowStamp(),
      customerId: selectedCustomerId() || "",
      items,
      totals,
    };

    const drafts = safeJSON(localStorage.getItem(DRAFTS_KEY), []);
    drafts.unshift(draft);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));

    clearCart();
    closeInvoiceModal();
  }

  function confirmSale() {
    const cart = readCart();
    const items = cart.items || [];
    if (!items.length) return;

    const totals = computeTotals(items);

    const sale = {
      id: uid(),
      createdAt: new Date().toISOString(),
      stamp: nowStamp(),
      customerId: selectedCustomerId() || "",
      items,
      totals,
    };

    const sales = safeJSON(localStorage.getItem(SALES_KEY), []);
    sales.unshift(sale);
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));

    const custId = selectedCustomerId();
    if (custId) {
      const customers = getCustomers();
      const idx = customers.findIndex((c) => String(c.id) === String(custId));
      if (idx >= 0) {
        const pts = Math.floor(Number(totals.total || 0));
        customers[idx].points = Number(customers[idx].points || 0) + pts;

        customers[idx].visits = Array.isArray(customers[idx].visits)
          ? customers[idx].visits
          : [];
        customers[idx].visits.unshift({
          saleId: sale.id,
          stamp: sale.stamp,
          total: Number(totals.total || 0),
          points: pts,
        });

        setCustomers(customers);
      }
    }

    clearCart();
    closeInvoiceModal();
  }

  // keep badge synced across pages/tabs
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) updateFab();
  });
  window.addEventListener("cigaros:cart-changed", () => {
    updateFab();
    const inv = document.getElementById("invoice-overlay");
    if (inv && !inv.hidden) renderInvoice();
  });

  // init
  window.addEventListener("DOMContentLoaded", () => {
    ensureFabStyles();
    getOrCreateFab();
    updateFab();
    ensureInvoiceModal(); // will now bind even if overlay exists
  });
})();
