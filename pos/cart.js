/* /pos/cart.js
   ONE shared cart + invoice controller for all POS pages

   Fixes:
   - Prevents double-add: tapping a product card opens "Add to invoice" popup ONLY (no auto add)
   - Works without editing every category page (intercepts in CAPTURE phase)
   - Restores full INVOICE layout + badge count on icon
   - Close always works
*/

(() => {
  const TAX_RATE = 0.07;
  const STORAGE_KEY = "cigaros_cart_v1";

  // ---------- State ----------
  const state = {
    items: loadItems(),
    isInvoiceOpen: false,
    isQuickAddOpen: false,
    pendingItem: null
  };

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {}
  }

  function money(n) {
    const x = Number(n || 0);
    return x.toFixed(2);
  }

  function cartCount() {
    return state.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  }

  function subtotal() {
    return state.items.reduce((sum, it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.price) || 0;
      return sum + qty * price;
    }, 0);
  }

  function taxAmount() {
    return subtotal() * TAX_RATE;
  }

  function total() {
    return subtotal() + taxAmount();
  }

  // ---------- DOM Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    children.forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return node;
  }

  // ---------- Styles (injected so you don't have to touch every page) ----------
  const STYLE_ID = "cigaros-cart-styles";
  function injectStylesOnce() {
    if (document.getElementById(STYLE_ID)) return;

    const css = `
/* --- Floating Invoice Button --- */
.pos-invoice-fab{
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  border: none;
  background: rgba(255,255,255,0.92);
  box-shadow: 0 10px 26px rgba(15, 26, 44, 0.18), 0 2px 8px rgba(15, 26, 44, 0.10);
  display: grid;
  place-items: center;
  z-index: 9999;
  -webkit-tap-highlight-color: transparent;
}
.pos-invoice-fab img{
  width: 30px;
  height: 30px;
  display: block;
}
.pos-invoice-badge{
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #ff3b30;
  color: #fff;
  font: 700 12px/20px -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  text-align: center;
  box-shadow: 0 6px 14px rgba(0,0,0,0.18);
}

/* --- Overlay --- */
.pos-overlay{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.28);
  z-index: 10000;
}

/* --- Quick Add Modal (product tap -> Add to invoice) --- */
.pos-quickadd{
  position: fixed;
  left: 50%;
  top: 52%;
  transform: translate(-50%, -50%);
  width: min(560px, calc(100% - 24px));
  background: #fff;
  border-radius: 22px;
  box-shadow: 0 18px 60px rgba(0,0,0,0.25);
  overflow: hidden;
  z-index: 10001;
}
.pos-quickadd-inner{
  padding: 18px 18px 16px;
  display: grid;
  gap: 12px;
  justify-items: center;
  text-align: center;
}
.pos-quickadd-x{
  position: absolute;
  right: 12px;
  top: 12px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  background: #eef1f5;
  font-size: 22px;
  line-height: 1;
}
.pos-quickadd-icon{
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: #e9eef6;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.pos-quickadd-icon img{
  width: 72px;
  height: 72px;
  object-fit: contain;
}
.pos-quickadd-title{
  font: 900 34px/1.05 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  letter-spacing: -0.02em;
  color: #0f1a2c;
}
.pos-quickadd-btn{
  width: 100%;
  border: none;
  border-radius: 14px;
  padding: 14px 14px;
  background: #f2f4f8;
  color: #007aff;
  font: 800 20px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
}

/* --- Invoice Modal (restored layout) --- */
.pos-invoice{
  position: fixed;
  left: 50%;
  top: 52%;
  transform: translate(-50%, -50%);
  width: min(720px, calc(100% - 18px));
  max-height: calc(100% - 22px);
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 20px 70px rgba(0,0,0,0.28);
  overflow: hidden;
  z-index: 10002;
  display: grid;
  grid-template-rows: auto 1fr auto;
}
.pos-invoice-top{
  padding: 16px 18px 10px;
  border-bottom: 1px solid #eef1f5;
  position: relative;
  text-align: center;
}
.pos-invoice-top h2{
  margin: 0;
  font: 900 18px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  letter-spacing: 0.08em;
  color: #111;
}
.pos-invoice-top .pos-invoice-sub{
  margin-top: 6px;
  font: 500 13px/1.35 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  color: rgba(15,26,44,0.55);
}
.pos-invoice-close{
  position: absolute;
  right: 14px;
  top: 12px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  background: #eef1f5;
  font-size: 22px;
  line-height: 1;
}
.pos-invoice-body{
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 14px 14px 12px;
}
.pos-invoice-row{
  display: grid;
  grid-template-columns: 54px 1fr auto;
  gap: 12px;
  padding: 14px 10px;
  border-bottom: 1px solid #eef1f5;
  align-items: center;
}
.pos-invoice-thumb{
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: #dbe8ff;
  overflow: hidden;
}
.pos-invoice-thumb img{
  width: 54px;
  height: 54px;
  object-fit: cover;
  display: block;
}
.pos-invoice-meta{
  display: grid;
  gap: 3px;
}
.pos-invoice-cat{
  font: 800 18px/1.1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  color: #0f1a2c;
}
.pos-invoice-name{
  font: 600 14px/1.2 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  color: rgba(15,26,44,0.75);
}
.pos-invoice-subline{
  font: 600 14px/1.2 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  color: rgba(15,26,44,0.35);
}
.pos-invoice-controls{
  display: grid;
  grid-template-columns: auto auto;
  gap: 10px;
  align-items: center;
}
.pos-stepper{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgba(15,26,44,0.55);
  font: 700 16px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
}
.pos-stepper button{
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(15,26,44,0.15);
  background: #fff;
  font: 800 18px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
}
.pos-pricepill{
  min-width: 74px;
  height: 34px;
  border-radius: 10px;
  background: #007aff;
  color: #fff;
  font: 900 16px/34px -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  text-align: center;
  padding: 0 10px;
}
.pos-invoice-bottom{
  border-top: 1px solid #eef1f5;
  padding: 12px 14px 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: end;
}
.pos-invoice-actions{
  display: grid;
  gap: 10px;
}
.pos-btn{
  border-radius: 12px;
  padding: 12px 14px;
  font: 800 16px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  border: 1px solid rgba(15,26,44,0.15);
  background: #fff;
}
.pos-btn.primary{
  border: none;
  background: #007aff;
  color: #fff;
}
.pos-totals{
  justify-self: end;
  text-align: right;
  display: grid;
  gap: 8px;
  font: 800 18px/1.1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  color: #0f1a2c;
}
.pos-totals .row{
  display: grid;
  grid-template-columns: auto 110px;
  gap: 14px;
}
.pos-totals .label{
  justify-self: start;
  color: rgba(15,26,44,0.55);
  font-weight: 800;
}
.pos-totals .value{
  justify-self: end;
}

/* Mobile sheet feel */
@media (max-width: 560px){
  .pos-invoice, .pos-quickadd{
    left: 50%;
    top: auto;
    bottom: 10px;
    transform: translateX(-50%);
    width: calc(100% - 14px);
    max-height: calc(100% - 24px);
    border-radius: 22px;
  }
}
    `.trim();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- UI Mount ----------
  injectStylesOnce();

  const fab = el("button", { class: "pos-invoice-fab", type: "button", "aria-label": "Invoice" });
  const fabImg = el("img", {
    src: "/img/icons/pos/invoice.png",
    alt: "Invoice"
  });
  const badge = el("div", { class: "pos-invoice-badge" }, ["0"]);

  fab.appendChild(fabImg);
  fab.appendChild(badge);
  document.body.appendChild(fab);

  fab.addEventListener("click", () => openInvoice());

  function setBadge() {
    const n = cartCount();
    badge.textContent = String(n);
    badge.style.display = n > 0 ? "block" : "none";
  }
  setBadge();

  // ---------- Invoice Modal ----------
  let overlayEl = null;
  let invoiceEl = null;

  function buildInvoice() {
    const now = new Date();
    const dateStr = now.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });

    const top = el("div", { class: "pos-invoice-top" }, [
      el("button", { class: "pos-invoice-close", type: "button" }, ["×"]),
      el("h2", {}, ["INVOICE"]),
      el("div", { class: "pos-invoice-sub" }, [
        el("div", {}, [dateStr]),
        el("div", {}, ["Smoke Cigar Shop"]),
        el("div", {}, ["INV# 123456"])
      ])
    ]);

    const body = el("div", { class: "pos-invoice-body" });

    const bottom = el("div", { class: "pos-invoice-bottom" }, [
      el("div", { class: "pos-invoice-actions" }, [
        el("button", { class: "pos-btn", type: "button", id: "pos-save-draft" }, ["Save Draft"]),
        el("button", { class: "pos-btn primary", type: "button", id: "pos-confirm" }, ["Confirm"])
      ]),
      el("div", { class: "pos-totals" }, [
        el("div", { class: "row" }, [
          el("div", { class: "label" }, ["SUBTOTAL"]),
          el("div", { class: "value", id: "pos-subtotal" }, [money(subtotal())])
        ]),
        el("div", { class: "row" }, [
          el("div", { class: "label" }, ["TAX"]),
          el("div", { class: "value", id: "pos-tax" }, [money(taxAmount())])
        ]),
        el("div", { class: "row" }, [
          el("div", { class: "label" }, ["TOTAL"]),
          el("div", { class: "value", id: "pos-total" }, [money(total())])
        ])
      ])
    ]);

    const wrap = el("div", { class: "pos-invoice" }, [top, body, bottom]);

    // close
    $(".pos-invoice-close", wrap).addEventListener("click", () => closeInvoice());

    // click overlay closes too
    overlayEl?.addEventListener("click", (e) => {
      if (e.target === overlayEl) closeInvoice();
    });

    return { wrap, body };
  }

  function renderInvoiceRows(body) {
    body.innerHTML = "";

    if (!state.items.length) {
      body.appendChild(
        el("div", { style: "padding: 18px; color: rgba(15,26,44,0.55); font: 700 16px/1.3 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;" }, [
          "No items yet. Add products to begin."
        ])
      );
      updateTotals();
      return;
    }

    state.items.forEach((it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.price) || 0;
      const lineTotal = qty * price;

      const thumb = el("div", { class: "pos-invoice-thumb" });
      if (it.img) {
        thumb.appendChild(el("img", { src: it.img, alt: it.name || "Item" }));
      }

      const meta = el("div", { class: "pos-invoice-meta" }, [
        el("div", { class: "pos-invoice-cat" }, [it.category || "Product"]),
        el("div", { class: "pos-invoice-name" }, [it.name || "Item"]),
        el("div", { class: "pos-invoice-subline" }, [it.brand || money(it.price)])
      ]);

      const minusBtn = el("button", { type: "button" }, ["−"]);
      const plusBtn = el("button", { type: "button" }, ["+"]);
      const qtyEl = el("div", {}, [String(qty)]);

      minusBtn.addEventListener("click", () => changeQty(it.id, -1));
      plusBtn.addEventListener("click", () => changeQty(it.id, +1));

      const stepper = el("div", { class: "pos-stepper" }, [minusBtn, qtyEl, plusBtn]);
      const pill = el("div", { class: "pos-pricepill" }, [money(lineTotal)]);

      const controls = el("div", { class: "pos-invoice-controls" }, [stepper, pill]);

      const row = el("div", { class: "pos-invoice-row" }, [thumb, meta, controls]);
      body.appendChild(row);
    });

    updateTotals();
  }

  function updateTotals() {
    const subEl = $("#pos-subtotal", invoiceEl);
    const taxEl = $("#pos-tax", invoiceEl);
    const totEl = $("#pos-total", invoiceEl);
    if (subEl) subEl.textContent = money(subtotal());
    if (taxEl) taxEl.textContent = money(taxAmount());
    if (totEl) totEl.textContent = money(total());
  }

  function openInvoice() {
    if (state.isInvoiceOpen) return;
    state.isInvoiceOpen = true;

    overlayEl = el("div", { class: "pos-overlay" });
    document.body.appendChild(overlayEl);

    const built = buildInvoice();
    invoiceEl = built.wrap;
    document.body.appendChild(invoiceEl);

    renderInvoiceRows(built.body);
  }

  function closeInvoice() {
    state.isInvoiceOpen = false;
    if (invoiceEl) invoiceEl.remove();
    if (overlayEl) overlayEl.remove();
    invoiceEl = null;
    overlayEl = null;
  }

  // ---------- Quick Add Popup ----------
  let quickEl = null;

  function openQuickAdd(item) {
    if (!item) return;
    state.pendingItem = item;

    // ensure invoice overlay exists (and blocks background)
    if (!overlayEl) {
      overlayEl = el("div", { class: "pos-overlay" });
      overlayEl.addEventListener("click", (e) => {
        if (e.target === overlayEl) closeQuickAdd();
      });
      document.body.appendChild(overlayEl);
    }

    quickEl = el("div", { class: "pos-quickadd" }, [
      el("button", { class: "pos-quickadd-x", type: "button" }, ["×"]),
      el("div", { class: "pos-quickadd-inner" }, [
        el("div", { class: "pos-quickadd-icon" }, [
          item.img ? el("img", { src: item.img, alt: item.name || "Item" }) : el("div")
        ]),
        el("div", { class: "pos-quickadd-title" }, [`${item.name || "Item"} - ${money(item.price)}`]),
        el("button", { class: "pos-quickadd-btn", type: "button" }, ["Add to invoice"])
      ])
    ]);

    $(".pos-quickadd-x", quickEl).addEventListener("click", () => closeQuickAdd());
    $(".pos-quickadd-btn", quickEl).addEventListener("click", () => {
      add(item);
      closeQuickAdd();
      // Do NOT auto-open invoice; user taps icon to view (matches your flow)
      // openInvoice();
    });

    document.body.appendChild(quickEl);
    state.isQuickAddOpen = true;
  }

  function closeQuickAdd() {
    state.isQuickAddOpen = false;
    state.pendingItem = null;
    if (quickEl) quickEl.remove();
    quickEl = null;

    // if invoice isn't open, remove overlay too
    if (!state.isInvoiceOpen && overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
  }

  // ---------- Cart Operations ----------
  function add(item) {
    if (!item || !item.id) return;

    const existing = state.items.find((x) => x.id === item.id);
    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + 1;
    } else {
      state.items.push({
        id: item.id,
        type: item.type || "product",
        category: item.category || "Product",
        brand: item.brand || "",
        name: item.name || "Item",
        price: Number(item.price) || 0,
        img: item.img || "",
        link: item.link || "",
        qty: 1
      });
    }

    saveItems();
    setBadge();

    // If invoice is open, rerender rows/totals
    if (state.isInvoiceOpen && invoiceEl) {
      const body = $(".pos-invoice-body", invoiceEl);
      if (body) renderInvoiceRows(body);
    }
  }

  function changeQty(id, delta) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    it.qty = (Number(it.qty) || 0) + delta;
    if (it.qty <= 0) {
      state.items = state.items.filter((x) => x.id !== id);
    }
    saveItems();
    setBadge();

    if (state.isInvoiceOpen && invoiceEl) {
      const body = $(".pos-invoice-body", invoiceEl);
      if (body) renderInvoiceRows(body);
    }
  }

  function clear() {
    state.items = [];
    saveItems();
    setBadge();
    if (state.isInvoiceOpen && invoiceEl) {
      const body = $(".pos-invoice-body", invoiceEl);
      if (body) renderInvoiceRows(body);
    }
  }

  // ---------- The KEY FIX: intercept product-card taps (capture phase) ----------
  document.addEventListener(
    "click",
    (e) => {
      const card = e.target?.closest?.("[data-receipt-item]");
      if (!card) return;

      // IMPORTANT: Stop old per-page handlers that were auto-adding on card tap
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

      const type = (card.dataset.type || "product").toLowerCase();
      const category = card.dataset.category || "Product";
      const brand = card.dataset.brand || "";
      const name = card.dataset.name || "Item";
      const price = Number(card.dataset.price || "0");
      const img = card.dataset.img || "";
      const link = card.dataset.link || "";

      const id = (category + "|" + brand + "|" + name).toLowerCase();

      openQuickAdd({
        id,
        type,
        category,
        brand,
        name,
        price,
        img,
        link
      });
    },
    true // <-- CAPTURE = beats the old bubbling listeners in those pages
  );

  // ---------- Expose API for brand page (+ button uses this) ----------
  window.CigarOSCart = {
    add,
    clear,
    openInvoice,
    closeInvoice,
    getItems: () => [...state.items]
  };
})();
