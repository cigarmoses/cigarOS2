/* /pos/cart.js
   Shared POS cart + invoice UI controller (global, all POS pages)

   Fixes:
   - Uses ONE shared cart across all POS pages (localStorage)
   - Bottom-right receipt FAB uses:
       empty: /img/icons/receipt.png
       has items: /img/icons/receiptred.png
     + badge count overlay
   - Invoice modal:
       * moved DOWN slightly (gap under iOS top bar)
       * stronger blurred/shaded backdrop
       * ~75% vertical coverage
       * SF Pro Display-ish header (tight tracking)
       * category label smaller + NOT bold
       * smaller +/- circles + tighter spacing
       * qty controls ABOVE price
       * price centered under qty controls (shifted left)
       * buttons centered under totals, side-by-side
   - Product pages (Food&Bevs, Accessories, Ashtrays, Pipes, Packs):
       * tapping a card shows an "Add to invoice" popup
       * ONLY adds on tapping "Add to invoice" (prevents double-add)
       * implemented centrally by capturing clicks on [data-receipt-item]
         and stopping any page-level handlers
*/

(() => {
  "use strict";

  // ---------- Config ----------
  const STORAGE_KEY = "cigaros_cart_v1";
  const TAX_RATE = 0.07; // (your default memory)
  const RECEIPT_ICON_EMPTY = "/img/icons/receipt.png";
  const RECEIPT_ICON_FULL = "/img/icons/receiptred.png";

  // Demo customer options (UI only for now)
  const CUSTOMER_OPTIONS = [
    { value: "", label: "Attach loyalty profile…", disabled: true },
    { value: "__add_new__", label: "Add new customer…" },
    { value: "walkin", label: "Walk-in" },
    { value: "michael_test", label: "Michael Test" },
    { value: "john_smith", label: "John Smith" },
  ];

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = (n) => (Number(n || 0)).toFixed(2);

  function safeJsonParse(str, fallback) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const st = safeJsonParse(raw, null);
    if (!st || typeof st !== "object") return { items: [], customer: "" };
    if (!Array.isArray(st.items)) st.items = [];
    if (typeof st.customer !== "string") st.customer = "";
    return st;
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function calcCounts(items) {
    return items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  }

  function calcSubtotal(items) {
    return items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  }

  // ---------- State ----------
  const state = loadState();

  // ---------- Inject CSS (keeps this “one change” across all pages) ----------
  function injectStylesOnce() {
    if (document.getElementById("cigaros-cart-styles")) return;

    const style = document.createElement("style");
    style.id = "cigaros-cart-styles";
    style.textContent = `
/* ===== Shared Receipt FAB ===== */
#pos-receipt-fab{
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 56px;
  height: 56px;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  z-index: 9998;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
#pos-receipt-fab img{
  width: 56px;
  height: 56px;
  display: block;
}
#pos-receipt-badge{
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #ff3b30;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 800;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  display: none;
  box-shadow: 0 6px 18px rgba(0,0,0,.18);
}

/* ===== Overlay ===== */
.cigaros-overlay{
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: none;
}
.cigaros-overlay.is-open{ display: block; }
.cigaros-overlay-backdrop{
  position: absolute;
  inset: 0;
  background: rgba(8, 20, 40, 0.55); /* darker */
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* ===== Invoice sheet (moved DOWN slightly) ===== */
.cigaros-sheet{
  position: absolute;
  left: 12px;
  right: 12px;
  top: 56px;            /* <-- DOWN a bit so iOS top bar area shows */
  height: 75vh;         /* ~75% coverage */
  background: rgba(255,255,255,0.98);
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0,0,0,.22);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.cigaros-sheet-header{
  padding: 14px 16px 8px;
  text-align: center;
  position: relative;
}
.cigaros-sheet-title{
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 900;
  letter-spacing: -0.02em; /* tighter tracking */
  font-size: 16px;
}
.cigaros-sheet-sub{
  margin-top: 6px;
  color: rgba(15,26,44,0.55);
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 600;
  font-size: 13px;
  line-height: 1.25;
}
.cigaros-close{
  position: absolute;
  right: 12px;
  top: 10px;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: none;
  background: rgba(120,120,120,0.14);
  color: rgba(0,0,0,0.75);
  font-size: 22px;
  line-height: 34px;
  cursor: pointer;
}
.cigaros-customer{
  padding: 10px 16px 8px;
}
.cigaros-customer select{
  width: 100%;
  height: 42px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.10);
  background: rgba(245,247,250,0.9);
  padding: 0 14px;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 700;
  color: rgba(15,26,44,0.85);
  outline: none;
}

/* ===== Items list ===== */
.cigaros-items{
  padding: 6px 12px 0;
  overflow: auto;
  flex: 1 1 auto;
}
.cigaros-row{
  display: grid;
  grid-template-columns: 56px 1fr 122px;
  gap: 10px;
  align-items: center;
  padding: 10px 6px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.cigaros-row:last-child{ border-bottom: none; }

.cigaros-thumb{
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: rgba(0,122,255,0.15);
  overflow: hidden;
  display: grid;
  place-items: center;
}
.cigaros-thumb img{
  width: 56px;
  height: 56px;
  object-fit: cover;
  display: block;
}
.cigaros-info{
  min-width: 0;
}
.cigaros-cat{
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 12px;          /* smaller */
  font-weight: 600;         /* NOT bold heavy */
  color: rgba(15,26,44,0.55);
  margin-bottom: 2px;
}
.cigaros-name{
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: rgba(15,26,44,0.92);
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cigaros-sub{
  margin-top: 3px;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: rgba(15,26,44,0.55);
}

.cigaros-controls{
  display: grid;
  grid-template-rows: auto auto;
  justify-items: center;     /* centers price under qty */
  align-content: center;
  gap: 6px;
}

/* qty row ABOVE price */
.cigaros-qty{
  display: inline-flex;
  align-items: center;
  gap: 6px;                  /* tighter */
}
.cigaros-qtybtn{
  width: 26px;               /* smaller circles */
  height: 26px;
  border-radius: 999px;
  border: none;
  background: rgba(120,120,120,0.18);
  color: rgba(0,0,0,0.70);
  font-size: 16px;
  line-height: 26px;
  font-weight: 900;
  cursor: pointer;
}
.cigaros-qtynum{
  min-width: 16px;
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 900;
  color: rgba(15,26,44,0.60);
}

/* price centered UNDER qty */
.cigaros-price{
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 1000;
  font-size: 22px;
  letter-spacing: -0.02em;
  color: rgba(0,0,0,0.88);
  transform: translateX(-8px); /* <-- nudge LEFT so it sits centered under qty cluster */
}

/* ===== Footer ===== */
.cigaros-footer{
  padding: 10px 16px 14px;
  border-top: 1px solid rgba(0,0,0,0.06);
}
.cigaros-totals{
  display: grid;
  grid-template-columns: 1fr auto;
  row-gap: 6px;
  column-gap: 10px;
  align-items: baseline;
  margin-bottom: 10px;
}
.cigaros-tlabel{
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 20px;
  font-weight: 900;
  color: rgba(15,26,44,0.55);
}
.cigaros-tlabel.total{
  color: rgba(15,26,44,0.92);
}
.cigaros-tval{
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 22px;
  font-weight: 1000;
  color: rgba(0,0,0,0.88);
}
.cigaros-buttons{
  display: flex;
  gap: 12px;
  justify-content: center; /* centered under totals */
}
.cigaros-btn{
  flex: 1 1 0;
  max-width: 220px;
  height: 48px;
  border-radius: 999px;
  border: 2px solid rgba(0,122,255,0.35);
  background: rgba(255,255,255,0.95);
  color: #007aff;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 900;
  font-size: 18px;
  cursor: pointer;
}
.cigaros-btn.primary{
  border-color: #007aff;
  background: #007aff;
  color: white;
}

/* ===== Add-to-invoice popup ===== */
.cigaros-addbox{
  position: absolute;
  left: 18px;
  right: 18px;
  top: 26vh;
  background: rgba(255,255,255,0.98);
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0,0,0,.22);
  padding: 16px;
}
.cigaros-addhead{
  display: grid;
  grid-template-columns: 56px 1fr 34px;
  gap: 12px;
  align-items: center;
}
.cigaros-addname{
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 1000;
  font-size: 22px;
  letter-spacing: -0.02em;
  color: rgba(15,26,44,0.92);
  line-height: 1.05;
}
.cigaros-addsub{
  margin-top: 4px;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 900;
  font-size: 18px;
  color: rgba(15,26,44,0.72);
}
.cigaros-addbtn{
  width: 100%;
  margin-top: 14px;
  height: 52px;
  border-radius: 999px;
  border: none;
  background: rgba(0,122,255,0.12);
  color: #007aff;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 1000;
  font-size: 20px;
  cursor: pointer;
}
    `;
    document.head.appendChild(style);
  }

  // ---------- UI: FAB + overlay ----------
  let fabBtn, fabImg, fabBadge;
  let overlayEl;

  function ensureFab() {
    if (document.getElementById("pos-receipt-fab")) return;

    fabBtn = document.createElement("button");
    fabBtn.id = "pos-receipt-fab";
    fabBtn.type = "button";
    fabBtn.setAttribute("aria-label", "Invoice");

    fabImg = document.createElement("img");
    fabImg.alt = "Invoice";

    fabBadge = document.createElement("div");
    fabBadge.id = "pos-receipt-badge";

    fabBtn.appendChild(fabImg);
    fabBtn.appendChild(fabBadge);
    document.body.appendChild(fabBtn);

    fabBtn.addEventListener("click", () => api.openInvoice());
  }

  function ensureOverlay() {
    if (document.getElementById("cigaros-overlay")) return;

    overlayEl = document.createElement("div");
    overlayEl.id = "cigaros-overlay";
    overlayEl.className = "cigaros-overlay";

    const backdrop = document.createElement("div");
    backdrop.className = "cigaros-overlay-backdrop";
    backdrop.addEventListener("click", () => api.closeAll());

    overlayEl.appendChild(backdrop);
    document.body.appendChild(overlayEl);
  }

  function openOverlay() {
    ensureOverlay();
    overlayEl.classList.add("is-open");
  }

  function closeOverlay() {
    if (!overlayEl) overlayEl = document.getElementById("cigaros-overlay");
    overlayEl?.classList.remove("is-open");
    // remove any panels inside overlay (sheet/addbox)
    $$(".cigaros-sheet, .cigaros-addbox", overlayEl).forEach((n) => n.remove());
  }

  // ---------- Invoice sheet ----------
  function renderInvoiceSheet() {
    ensureOverlay();
    // clear existing sheet if any
    $$(".cigaros-sheet", overlayEl).forEach((n) => n.remove());

    const sheet = document.createElement("div");
    sheet.className = "cigaros-sheet";

    const header = document.createElement("div");
    header.className = "cigaros-sheet-header";

    const title = document.createElement("div");
    title.className = "cigaros-sheet-title";
    title.textContent = "INVOICE";

    const sub = document.createElement("div");
    sub.className = "cigaros-sheet-sub";
    const now = new Date();
    sub.innerHTML = `
      ${now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} at ${now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}<br/>
      Smoke Cigar Shop<br/>
      INV# 123456
    `;

    const closeBtn = document.createElement("button");
    closeBtn.className = "cigaros-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => api.closeInvoice());

    header.appendChild(title);
    header.appendChild(sub);
    header.appendChild(closeBtn);

    const customer = document.createElement("div");
    customer.className = "cigaros-customer";
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "Attach loyalty profile");

    // Build options (order: placeholder, add new, walk-in, others)
    CUSTOMER_OPTIONS.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.disabled) o.disabled = true;
      sel.appendChild(o);
    });

    // Restore saved customer selection, but keep placeholder if empty
    sel.value = state.customer || "";

    // If no saved customer, keep placeholder selected
    if (!state.customer) sel.selectedIndex = 0;

    sel.addEventListener("change", () => {
      const v = sel.value;
      if (v === "__add_new__") {
        // Keep placeholder visible after action
        sel.selectedIndex = 0;
        // Route placeholder — change later when your loyalty page exists
        window.location.href = "/pos/loyalty/";
        return;
      }
      state.customer = v;
      saveState(state);
    });

    customer.appendChild(sel);

    const itemsWrap = document.createElement("div");
    itemsWrap.className = "cigaros-items";

    const items = state.items;

    if (!items.length) {
      const empty = document.createElement("div");
      empty.style.padding = "24px 10px";
      empty.style.textAlign = "center";
      empty.style.color = "rgba(15,26,44,0.55)";
      empty.style.fontFamily = "-apple-system, BlinkMacSystemFont, system-ui, sans-serif";
      empty.style.fontWeight = "800";
      empty.textContent = "No items on invoice";
      itemsWrap.appendChild(empty);
    } else {
      items.forEach((it) => itemsWrap.appendChild(renderInvoiceRow(it)));
    }

    const footer = document.createElement("div");
    footer.className = "cigaros-footer";

    const subtotal = calcSubtotal(items);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const totals = document.createElement("div");
    totals.className = "cigaros-totals";
    totals.innerHTML = `
      <div class="cigaros-tlabel">Subtotal</div><div class="cigaros-tval">$${money(subtotal)}</div>
      <div class="cigaros-tlabel">Tax</div><div class="cigaros-tval">$${money(tax)}</div>
      <div class="cigaros-tlabel total">TOTAL</div><div class="cigaros-tval">$${money(total)}</div>
    `;

    const btns = document.createElement("div");
    btns.className = "cigaros-buttons";

    const saveDraft = document.createElement("button");
    saveDraft.className = "cigaros-btn";
    saveDraft.type = "button";
    saveDraft.textContent = "Save Draft";
    saveDraft.addEventListener("click", () => {
      // placeholder: keep for now
      // you can persist drafts later
      api.closeInvoice();
    });

    const confirm = document.createElement("button");
    confirm.className = "cigaros-btn primary";
    confirm.type = "button";
    confirm.textContent = "Confirm";
    confirm.addEventListener("click", () => {
      // placeholder: finalize sale later
      api.clear();
      api.closeInvoice();
    });

    btns.appendChild(saveDraft);
    btns.appendChild(confirm);

    footer.appendChild(totals);
    footer.appendChild(btns);

    sheet.appendChild(header);
    sheet.appendChild(customer);
    sheet.appendChild(itemsWrap);
    sheet.appendChild(footer);

    overlayEl.appendChild(sheet);
  }

  function renderInvoiceRow(it) {
    const row = document.createElement("div");
    row.className = "cigaros-row";
    row.dataset.id = it.id;

    const thumb = document.createElement("div");
    thumb.className = "cigaros-thumb";

    if (it.img) {
      const img = document.createElement("img");
      img.src = it.img;
      img.alt = it.name || "Item";
      thumb.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "cigaros-info";

    const cat = document.createElement("div");
    cat.className = "cigaros-cat";
    cat.textContent = it.category || "Product";

    const name = document.createElement("div");
    name.className = "cigaros-name";
    name.textContent = it.name || "Item";

    const sub = document.createElement("div");
    sub.className = "cigaros-sub";
    // show brand + unit price as small line (keeps your earlier look)
    const brand = it.brand ? it.brand : "";
    const unit = `$${money(it.price)}`;
    sub.textContent = brand ? `${brand} • ${unit}` : unit;

    info.appendChild(cat);
    info.appendChild(name);
    info.appendChild(sub);

    const controls = document.createElement("div");
    controls.className = "cigaros-controls";

    // qty controls ABOVE price
    const qty = document.createElement("div");
    qty.className = "cigaros-qty";

    const minus = document.createElement("button");
    minus.className = "cigaros-qtybtn";
    minus.type = "button";
    minus.textContent = "−";
    minus.addEventListener("click", (e) => {
      e.stopPropagation();
      api.dec(it.id);
      // rerender invoice sheet in-place
      renderInvoiceSheet();
      openOverlay();
    });

    const num = document.createElement("div");
    num.className = "cigaros-qtynum";
    num.textContent = String(it.qty || 1);

    const plus = document.createElement("button");
    plus.className = "cigaros-qtybtn";
    plus.type = "button";
    plus.textContent = "+";
    plus.addEventListener("click", (e) => {
      e.stopPropagation();
      api.inc(it.id);
      renderInvoiceSheet();
      openOverlay();
    });

    qty.appendChild(minus);
    qty.appendChild(num);
    qty.appendChild(plus);

    const price = document.createElement("div");
    price.className = "cigaros-price";
    price.textContent = `$${money((Number(it.price) || 0) * (Number(it.qty) || 0))}`;

    controls.appendChild(qty);
    controls.appendChild(price);

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(controls);

    return row;
  }

  // ---------- Add-to-invoice popup (product pages) ----------
  function openAddPopupFromCard(cardEl) {
    const type = (cardEl.dataset.type || "product").toLowerCase();
    const category = cardEl.dataset.category || "Product";
    const brand = cardEl.dataset.brand || "";
    const name = cardEl.dataset.name || "Item";
    const price = Number(cardEl.dataset.price || "0");
    const img = cardEl.dataset.img || "";
    const link = cardEl.dataset.link || "";

    const id = (category + "|" + brand + "|" + name).toLowerCase();

    openOverlay();
    // remove existing addbox if any
    $$(".cigaros-addbox", overlayEl).forEach((n) => n.remove());

    const box = document.createElement("div");
    box.className = "cigaros-addbox";

    const head = document.createElement("div");
    head.className = "cigaros-addhead";

    const thumb = document.createElement("div");
    thumb.className = "cigaros-thumb";
    if (img) {
      const im = document.createElement("img");
      im.src = img;
      im.alt = name;
      thumb.appendChild(im);
    }

    const textWrap = document.createElement("div");
    const nm = document.createElement("div");
    nm.className = "cigaros-addname";
    nm.textContent = name;

    const sm = document.createElement("div");
    sm.className = "cigaros-addsub";
    sm.textContent = `${brand ? brand + " • " : ""}$${money(price)}`;

    textWrap.appendChild(nm);
    textWrap.appendChild(sm);

    const x = document.createElement("button");
    x.className = "cigaros-close";
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.textContent = "×";
    x.addEventListener("click", () => closeOverlay());

    head.appendChild(thumb);
    head.appendChild(textWrap);
    head.appendChild(x);

    const addBtn = document.createElement("button");
    addBtn.className = "cigaros-addbtn";
    addBtn.type = "button";
    addBtn.textContent = "Add to invoice";
    addBtn.addEventListener("click", () => {
      api.add({
        id,
        type,
        category,
        brand,
        name,
        price,
        img,
        link,
        sub: "",
      });
      closeOverlay(); // close popup; user taps FAB to view invoice
    });

    box.appendChild(head);
    box.appendChild(addBtn);
    overlayEl.appendChild(box);
  }

  // ---------- Cart operations ----------
  function findItemIndex(id) {
    return state.items.findIndex((it) => it.id === id);
  }

  function normalizeItem(item) {
    return {
      id: String(item.id || "").trim(),
      type: String(item.type || "product"),
      category: String(item.category || "Product"),
      brand: String(item.brand || ""),
      name: String(item.name || "Item"),
      price: Number(item.price || 0),
      qty: Number(item.qty || 1),
      img: String(item.img || ""),
      link: String(item.link || ""),
      sub: String(item.sub || ""),
    };
  }

  function updateFab() {
    ensureFab();
    const count = calcCounts(state.items);

    const src = count > 0 ? RECEIPT_ICON_FULL : RECEIPT_ICON_EMPTY;
    fabImg.src = src;

    if (count > 0) {
      fabBadge.style.display = "block";
      fabBadge.textContent = String(count);
    } else {
      fabBadge.style.display = "none";
      fabBadge.textContent = "";
    }
  }

  // ---------- Public API ----------
  const api = {
    add(item) {
      const it = normalizeItem(item);
      if (!it.id) return;

      const idx = findItemIndex(it.id);
      if (idx >= 0) {
        state.items[idx].qty = (Number(state.items[idx].qty) || 0) + 1;
      } else {
        state.items.push(it);
      }
      saveState(state);
      updateFab();
    },

    inc(id) {
      const idx = findItemIndex(id);
      if (idx < 0) return;
      state.items[idx].qty = (Number(state.items[idx].qty) || 0) + 1;
      saveState(state);
      updateFab();
    },

    dec(id) {
      const idx = findItemIndex(id);
      if (idx < 0) return;
      const q = Number(state.items[idx].qty) || 0;
      if (q <= 1) {
        state.items.splice(idx, 1);
      } else {
        state.items[idx].qty = q - 1;
      }
      saveState(state);
      updateFab();
    },

    clear() {
      state.items = [];
      saveState(state);
      updateFab();
    },

    openInvoice() {
      openOverlay();
      renderInvoiceSheet();
      // ensure invoice (not addbox)
      $$(".cigaros-addbox", overlayEl).forEach((n) => n.remove());
    },

    closeInvoice() {
      closeOverlay();
    },

    closeAll() {
      closeOverlay();
    },

    get items() {
      return state.items.slice();
    },
  };

  window.CigarOSCart = api;

  // ---------- Global click interception for product pages ----------
  // This prevents old page scripts from auto-adding on first tap.
  function attachGlobalReceiptItemHandler() {
    document.addEventListener(
      "click",
      (e) => {
        const card = e.target?.closest?.("[data-receipt-item]");
        if (!card) return;

        // Capture-phase handler runs before other listeners.
        // Stop other page-level click handlers from firing (prevents double-add).
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        openAddPopupFromCard(card);
      },
      true // <-- capture
    );
  }

  // ---------- Init ----------
  function init() {
    injectStylesOnce();
    ensureFab();
    ensureOverlay();
    updateFab();
    attachGlobalReceiptItemHandler();

    // Keep FAB/badge synced if multiple tabs/pages update
    window.addEventListener("storage", (ev) => {
      if (ev.key !== STORAGE_KEY) return;
      const st = loadState();
      state.items = st.items || [];
      state.customer = st.customer || "";
      updateFab();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
