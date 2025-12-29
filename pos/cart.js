/* /pos/cart.js
   Shared POS Cart + Invoice (single controller for ALL POS pages)

   Fixes included:
   ✅ Uses /img/icons/receipt.png when cart is empty
   ✅ Uses /img/icons/receiptred.png when cart has items
   ✅ Shows item-count badge on top of the icon
   ✅ Receipt button stays SMALL bottom-right (does not take over screen)
   ✅ Invoice modal: blurred/dimmed backdrop, ~75% height, centered higher
   ✅ Close (X) always works
   ✅ Qty adjuster tightened
   ✅ Category label smaller + regular weight (not bold)
   ✅ "INVOICE" header uses SF Pro Display-ish bold + tighter tracking
   ✅ Save Draft / Confirm buttons side-by-side under totals
   ✅ Customer dropdown includes “Add new customer…” as 2nd option (above Walk-in)
   ✅ Prevents DOUBLE-ADD on category pages by intercepting clicks on [data-receipt-item]
      and showing “Add to invoice” popup — adds only when you tap that button.

   Public API:
     window.CigarOSCart.add(item)
     window.CigarOSCart.openInvoice()
     window.CigarOSCart.closeInvoice()
     window.CigarOSCart.clear()
*/

(() => {
  "use strict";

  // -------------------------
  // Config
  // -------------------------
  const STORAGE_KEY = "cigaros_pos_cart_v1";
  const STORAGE_CUSTOMER_KEY = "cigaros_pos_customer_v1";

  const ICON_EMPTY = "/img/icons/receipt.png";
  const ICON_FULL = "/img/icons/receiptred.png";

  // per your memory: 7% tax
  const TAX_RATE = 0.07;

  // If you want “Add new customer…” to go somewhere specific, change this:
  const ADD_NEW_CUSTOMER_URL = "/pos/loyalty/";

  // -------------------------
  // State
  // -------------------------
  let state = {
    items: [], // [{id,type,category,brand,name,price,img,link,sub,qty}]
    customer: "Walk-in",
    lastInvNumber: "123456",
    shopName: "Smoke Cigar Shop",
  };

  // -------------------------
  // Utilities
  // -------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const money = (n) => {
    const v = Number(n || 0);
    return v.toFixed(2);
  };

  const nowStamp = () => {
    // Example: Dec 29, 2025 at 10:51 AM (local)
    const d = new Date();
    const optsDate = { month: "short", day: "2-digit", year: "numeric" };
    const optsTime = { hour: "numeric", minute: "2-digit" };
    const date = d.toLocaleDateString(undefined, optsDate);
    const time = d.toLocaleTimeString(undefined, optsTime);
    return `${date} at ${time}`;
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) {
          state.items = parsed.items.map((it) => ({
            ...it,
            qty: clamp(Number(it.qty || 1), 1, 999),
            price: Number(it.price || 0),
          }));
        }
      }
    } catch (e) {}
    try {
      const rawC = localStorage.getItem(STORAGE_CUSTOMER_KEY);
      if (rawC) state.customer = rawC;
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          items: state.items,
        })
      );
    } catch (e) {}
    try {
      localStorage.setItem(STORAGE_CUSTOMER_KEY, state.customer);
    } catch (e) {}
  }

  function getItemCount() {
    return state.items.reduce((sum, it) => sum + Number(it.qty || 0), 0);
  }

  function getSubtotal() {
    return state.items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0), 0);
  }

  function getTax(subtotal) {
    return subtotal * TAX_RATE;
  }

  // -------------------------
  // UI: Floating receipt button + badge
  // -------------------------
  let receiptBtn, receiptImg, receiptBadge;
  let invoiceOverlay, invoiceSheet;
  let productOverlay, productSheet;

  function ensureReceiptButton() {
    if (receiptBtn) return;

    receiptBtn = document.createElement("button");
    receiptBtn.type = "button";
    receiptBtn.className = "pos-receipt-btn";
    receiptBtn.setAttribute("aria-label", "Open Invoice");

    receiptImg = document.createElement("img");
    receiptImg.className = "pos-receipt-img";
    receiptImg.alt = "Receipt";

    receiptBadge = document.createElement("span");
    receiptBadge.className = "pos-receipt-badge";
    receiptBadge.textContent = "";

    receiptBtn.appendChild(receiptImg);
    receiptBtn.appendChild(receiptBadge);

    receiptBtn.addEventListener("click", () => openInvoice());

    document.body.appendChild(receiptBtn);
    injectStyles();
    updateReceiptButton();
  }

  function updateReceiptButton() {
    const count = getItemCount();
    receiptImg.src = count === 0 ? ICON_EMPTY : ICON_FULL;

    if (count > 0) {
      receiptBadge.textContent = String(count);
      receiptBadge.style.display = "grid";
    } else {
      receiptBadge.textContent = "";
      receiptBadge.style.display = "none";
    }
  }

  // -------------------------
  // UI: Invoice modal
  // -------------------------
  function ensureInvoiceModal() {
    if (invoiceOverlay) return;

    invoiceOverlay = document.createElement("div");
    invoiceOverlay.className = "pos-invoice-overlay";
    invoiceOverlay.setAttribute("aria-hidden", "true");

    // close when tapping backdrop
    invoiceOverlay.addEventListener("click", (e) => {
      if (e.target === invoiceOverlay) closeInvoice();
    });

    invoiceSheet = document.createElement("div");
    invoiceSheet.className = "pos-invoice-sheet";
    invoiceSheet.setAttribute("role", "dialog");
    invoiceSheet.setAttribute("aria-modal", "true");

    invoiceSheet.innerHTML = `
      <div class="pos-invoice-header">
        <div class="pos-invoice-title">INVOICE</div>
        <button type="button" class="pos-invoice-close" aria-label="Close Invoice">×</button>
      </div>

      <div class="pos-invoice-meta">
        <div class="pos-invoice-meta-line pos-invoice-date">${nowStamp()}</div>
        <div class="pos-invoice-meta-line pos-invoice-shop">${escapeHtml(state.shopName)}</div>
        <div class="pos-invoice-meta-line pos-invoice-inv">INV# ${escapeHtml(state.lastInvNumber)}</div>
      </div>

      <div class="pos-invoice-customer">
        <select class="pos-invoice-select" aria-label="Attach Saved Customer">
          <option value="" disabled>Attach Saved Customer</option>
          <option value="__add_new__">Add new customer...</option>
          <option value="Walk-in">Walk-in</option>
          <option value="Michael Test">Michael Test</option>
          <option value="John Smith">John Smith</option>
        </select>
      </div>

      <div class="pos-invoice-list" role="list"></div>

      <div class="pos-invoice-footer">
        <div class="pos-invoice-totals">
          <div class="row"><span>Subtotal</span><strong class="pos-subtotal">$0.00</strong></div>
          <div class="row"><span>Tax</span><strong class="pos-tax">$0.00</strong></div>
          <div class="row total"><span>TOTAL</span><strong class="pos-total">$0.00</strong></div>
        </div>

        <div class="pos-invoice-actions">
          <button type="button" class="pos-action secondary" data-action="draft">Save Draft</button>
          <button type="button" class="pos-action primary" data-action="confirm">Confirm</button>
        </div>
      </div>
    `;

    invoiceOverlay.appendChild(invoiceSheet);
    document.body.appendChild(invoiceOverlay);

    // Close X
    $(".pos-invoice-close", invoiceSheet).addEventListener("click", closeInvoice);

    // Customer select
    const select = $(".pos-invoice-select", invoiceSheet);
    // set initial selected
    select.value = state.customer || "Walk-in";
    // if placeholder is shown, pick Walk-in
    if (!select.value) select.value = "Walk-in";

    select.addEventListener("change", () => {
      const v = select.value;
      if (v === "__add_new__") {
        // reset to Walk-in before navigating
        select.value = state.customer || "Walk-in";
        window.location.href = ADD_NEW_CUSTOMER_URL;
        return;
      }
      state.customer = v;
      saveState();
    });

    // Action buttons
    $$(".pos-action", invoiceSheet).forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        if (action === "draft") {
          // placeholder: keep state, close
          closeInvoice();
        } else if (action === "confirm") {
          // placeholder: clear + close
          clear();
          closeInvoice();
        }
      });
    });

    // ESC closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && invoiceOverlay?.classList.contains("open")) closeInvoice();
    });
  }

  function renderInvoice() {
    ensureInvoiceModal();

    // Refresh timestamp each open/render
    $(".pos-invoice-date", invoiceSheet).textContent = nowStamp();
    $(".pos-invoice-shop", invoiceSheet).textContent = state.shopName;
    $(".pos-invoice-inv", invoiceSheet).textContent = `INV# ${state.lastInvNumber}`;

    const list = $(".pos-invoice-list", invoiceSheet);
    list.innerHTML = "";

    state.items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "pos-line";
      row.setAttribute("role", "listitem");

      const imgSrc = it.img || ""; // optional per-item
      row.innerHTML = `
        <div class="pos-line-left">
          <div class="pos-line-thumb">
            ${imgSrc ? `<img src="${escapeAttr(imgSrc)}" alt="">` : `<div class="pos-line-thumb-fallback"></div>`}
          </div>
        </div>

        <div class="pos-line-mid">
          <div class="pos-line-cat">${escapeHtml(it.category || "")}</div>
          <div class="pos-line-name">${escapeHtml(it.name || "")}</div>
          <div class="pos-line-sub">${escapeHtml(it.price != null ? money(it.price) : "")}</div>
        </div>

        <div class="pos-line-right">
          <div class="pos-qty">
            <button type="button" class="qty-btn" data-qty="-1" aria-label="Decrease">−</button>
            <div class="qty-num">${escapeHtml(String(it.qty || 1))}</div>
            <button type="button" class="qty-btn" data-qty="+1" aria-label="Increase">+</button>
          </div>
          <div class="pos-line-price">$${escapeHtml(money((it.price || 0) * (it.qty || 1)))}</div>
        </div>
      `;

      // Qty controls (tight)
      $$(".qty-btn", row).forEach((b) => {
        b.addEventListener("click", () => {
          const dir = b.getAttribute("data-qty");
          if (dir === "+1") setQty(it.id, (it.qty || 1) + 1);
          if (dir === "-1") setQty(it.id, (it.qty || 1) - 1);
        });
      });

      list.appendChild(row);
    });

    const subtotal = getSubtotal();
    const tax = getTax(subtotal);
    const total = subtotal + tax;

    $(".pos-subtotal", invoiceSheet).textContent = `$${money(subtotal)}`;
    $(".pos-tax", invoiceSheet).textContent = `$${money(tax)}`;
    $(".pos-total", invoiceSheet).textContent = `$${money(total)}`;
  }

  function openInvoice() {
    ensureReceiptButton();
    ensureInvoiceModal();
    renderInvoice();

    invoiceOverlay.classList.add("open");
    invoiceOverlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("pos-lock");
  }

  function closeInvoice() {
    if (!invoiceOverlay) return;
    invoiceOverlay.classList.remove("open");
    invoiceOverlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("pos-lock");
  }

  // -------------------------
  // UI: Product “Add to invoice” popup (prevents double-add)
  // -------------------------
  function ensureProductPopup() {
    if (productOverlay) return;

    productOverlay = document.createElement("div");
    productOverlay.className = "pos-product-overlay";
    productOverlay.setAttribute("aria-hidden", "true");

    productOverlay.addEventListener("click", (e) => {
      if (e.target === productOverlay) closeProductPopup();
    });

    productSheet = document.createElement("div");
    productSheet.className = "pos-product-sheet";
    productSheet.setAttribute("role", "dialog");
    productSheet.setAttribute("aria-modal", "true");

    productOverlay.appendChild(productSheet);
    document.body.appendChild(productOverlay);
  }

  function openProductPopup(payload) {
    ensureProductPopup();

    const { img, title, priceLabel } = payload;

    productSheet.innerHTML = `
      <button type="button" class="pos-product-close" aria-label="Close">×</button>
      <div class="pos-product-inner">
        <div class="pos-product-icon">
          ${img ? `<img src="${escapeAttr(img)}" alt="">` : `<div class="pos-product-fallback"></div>`}
        </div>
        <div class="pos-product-title">${escapeHtml(title)}</div>
        <button type="button" class="pos-product-add">Add to invoice</button>
      </div>
    `;

    $(".pos-product-close", productSheet).addEventListener("click", closeProductPopup);
    $(".pos-product-add", productSheet).addEventListener("click", () => {
      // add only HERE (prevents double add)
      add(payload.item);
      closeProductPopup();
    });

    productOverlay.classList.add("open");
    productOverlay.setAttribute("aria-hidden", "false");
  }

  function closeProductPopup() {
    if (!productOverlay) return;
    productOverlay.classList.remove("open");
    productOverlay.setAttribute("aria-hidden", "true");
  }

  // -------------------------
  // Core cart operations
  // -------------------------
  function add(item) {
    if (!item) return;

    const normalized = {
      id: String(item.id || "").trim() || makeStableId(item),
      type: (item.type || "product").toLowerCase(),
      category: item.category || "Product",
      brand: item.brand || "",
      name: item.name || "Item",
      price: Number(item.price || 0),
      img: item.img || "",
      link: item.link || "",
      sub: item.sub || "",
      qty: clamp(Number(item.qty || 1), 1, 999),
    };

    const idx = state.items.findIndex((x) => x.id === normalized.id);
    if (idx >= 0) {
      state.items[idx].qty = clamp((state.items[idx].qty || 1) + normalized.qty, 1, 999);
    } else {
      state.items.push(normalized);
    }

    saveState();
    updateReceiptButton();

    // if invoice is open, live-render
    if (invoiceOverlay?.classList.contains("open")) renderInvoice();
  }

  function setQty(id, qty) {
    const idx = state.items.findIndex((x) => x.id === id);
    if (idx < 0) return;

    const q = Number(qty || 0);
    if (q <= 0) {
      state.items.splice(idx, 1);
    } else {
      state.items[idx].qty = clamp(q, 1, 999);
    }

    saveState();
    updateReceiptButton();
    renderInvoice();
  }

  function clear() {
    state.items = [];
    saveState();
    updateReceiptButton();
    if (invoiceOverlay?.classList.contains("open")) renderInvoice();
  }

  function makeStableId(item) {
    const category = (item.category || "product").toLowerCase();
    const brand = (item.brand || "").toLowerCase();
    const name = (item.name || "item").toLowerCase();
    return `${category}|${brand}|${name}`.replace(/\s+/g, " ").trim();
  }

  // -------------------------
  // Prevent double add on category pages (single change, no page edits)
  // -------------------------
  function installGlobalClickIntercept() {
    // Capture phase so we can stop page-level handlers that auto-add.
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;

        // If click is on an “explicit add button” (brand pages likely), don’t intercept.
        // (You can add selectors here if needed.)
        if (target.closest("[data-direct-add], .pos-row-add, .pos-plus, .row-plus, .add-plus, .green-plus")) {
          return;
        }

        const card = target.closest("[data-receipt-item]");
        if (!card) return;

        // Intercept and STOP other handlers to prevent “auto add on first click”
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        const type = (card.dataset.type || "product").toLowerCase();
        const category = card.dataset.category || "Product";
        const brand = card.dataset.brand || "";
        const name = card.dataset.name || "Item";
        const price = Number(card.dataset.price || "0");
        const img = card.dataset.img || ""; // optional
        const link = card.dataset.link || ""; // optional

        const id = (category + "|" + brand + "|" + name).toLowerCase();

        openProductPopup({
          img,
          title: `${name} - ${money(price)}`,
          priceLabel: money(price),
          item: {
            id,
            type,
            category,
            brand,
            name,
            price,
            img,
            link,
            sub: "",
            qty: 1,
          },
        });
      },
      true
    );
  }

  // -------------------------
  // Minimal HTML escaping helpers
  // -------------------------
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function escapeAttr(str) {
    return escapeHtml(str).replaceAll("`", "&#096;");
  }

  // -------------------------
  // Styles (injected once)
  // -------------------------
  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;

    const style = document.createElement("style");
    style.textContent = `
      /* lock background scroll when invoice open */
      .pos-lock { overflow: hidden; }
      html.pos-lock, body { overscroll-behavior: none; }

      /* Floating receipt button (small, bottom-right) */
      .pos-receipt-btn{
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: 56px;
        height: 56px;
        border: none;
        background: transparent;
        padding: 0;
        margin: 0;
        cursor: pointer;
        z-index: 9999;
        -webkit-tap-highlight-color: transparent;
      }
      .pos-receipt-img{
        width: 56px;
        height: 56px;
        display: block;
        border-radius: 14px;
        box-shadow: 0 10px 24px rgba(0,0,0,0.14);
      }
      .pos-receipt-badge{
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border-radius: 999px;
        background: #ff3b30;
        color: #fff;
        font: 700 12px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        display: none;
        place-items: center;
        box-shadow: 0 10px 18px rgba(0,0,0,0.18);
      }

      /* Invoice overlay backdrop (blur + dim) */
      .pos-invoice-overlay{
        position: fixed;
        inset: 0;
        display: none;
        align-items: flex-end;
        justify-content: center;
        z-index: 10000;
        background: rgba(10, 22, 40, 0.38);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        padding: 18px 14px 18px;
      }
      .pos-invoice-overlay.open{ display: flex; }

      /* Invoice sheet (~75% height, moved up more) */
      .pos-invoice-sheet{
        width: min(720px, 96vw);
        height: 75vh;
        background: rgba(255,255,255,0.96);
        border-radius: 22px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.25);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transform: translateY(-10vh); /* moves it up / centered more */
      }

      /* Header */
      .pos-invoice-header{
        position: relative;
        padding: 14px 16px 6px;
        text-align: center;
      }
      .pos-invoice-title{
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
        font-weight: 800;
        letter-spacing: -0.03em; /* tighter tracking */
        font-size: 17px;
        color: #0f1a2c;
      }
      .pos-invoice-close{
        position: absolute;
        right: 12px;
        top: 10px;
        width: 34px;
        height: 34px;
        border: none;
        border-radius: 999px;
        background: rgba(0,0,0,0.06);
        color: #0f1a2c;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
      }

      /* Meta */
      .pos-invoice-meta{
        text-align: center;
        padding: 2px 16px 10px;
        color: rgba(15,26,44,0.60);
        font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      }
      .pos-invoice-meta-line{
        font-size: 13px;
        line-height: 1.25;
      }

      /* Customer dropdown */
      .pos-invoice-customer{
        padding: 6px 16px 12px;
        display: flex;
        justify-content: center;
      }
      .pos-invoice-select{
        width: min(520px, 100%);
        height: 40px;
        border-radius: 999px;
        border: 1px solid rgba(15,26,44,0.12);
        background: #fff;
        padding: 0 14px;
        font: 600 15px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        color: #0f1a2c;
        outline: none;
      }

      /* List */
      .pos-invoice-list{
        flex: 1;
        overflow: auto;
        padding: 4px 16px 10px;
      }
      .pos-line{
        display: grid;
        grid-template-columns: 54px 1fr auto;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid rgba(15,26,44,0.08);
      }
      .pos-line:first-child{ border-top: none; }

      .pos-line-thumb{
        width: 54px;
        height: 54px;
        border-radius: 14px;
        overflow: hidden;
        display: grid;
        place-items: center;
      }
      .pos-line-thumb img{
        width: 54px;
        height: 54px;
        object-fit: cover;
      }
      .pos-line-thumb-fallback{
        width: 54px;
        height: 54px;
        border-radius: 14px;
        background: rgba(0,122,255,0.12);
      }

      .pos-line-mid{
        min-width: 0;
      }
      /* Category label: smaller, regular weight (NOT bold) */
      .pos-line-cat{
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
        font-weight: 500;
        font-size: 13px;
        color: rgba(15,26,44,0.55);
        margin-bottom: 2px;
      }
      .pos-line-name{
        font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        font-weight: 800;
        font-size: 18px;
        letter-spacing: -0.02em;
        color: #0f1a2c;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pos-line-sub{
        font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        font-weight: 600;
        font-size: 14px;
        color: rgba(15,26,44,0.45);
        margin-top: 2px;
      }

      .pos-line-right{
        display: grid;
        grid-auto-rows: min-content;
        justify-items: end;
        gap: 8px;
      }

      /* Qty adjuster tightened */
      .pos-qty{
        display: inline-flex;
        align-items: center;
        gap: 6px; /* tighter */
        color: rgba(15,26,44,0.70);
        font: 700 16px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      }
      .qty-btn{
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: none;
        background: rgba(0,0,0,0.06);
        color: rgba(15,26,44,0.70);
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }
      .qty-num{
        min-width: 18px;
        text-align: center;
      }

      .pos-line-price{
        font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        font-weight: 900;
        font-size: 20px;
        color: #0f1a2c;
      }

      /* Footer: totals + actions */
      .pos-invoice-footer{
        border-top: 1px solid rgba(15,26,44,0.10);
        padding: 12px 16px 14px;
        background: rgba(255,255,255,0.98);
      }
      .pos-invoice-totals{
        display: grid;
        gap: 6px;
        margin-bottom: 10px;
      }
      .pos-invoice-totals .row{
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font: 700 16px/1.2 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        color: rgba(15,26,44,0.70);
      }
      .pos-invoice-totals .row strong{
        color: #0f1a2c;
        font-weight: 900;
      }
      .pos-invoice-totals .row.total{
        margin-top: 2px;
        font: 900 18px/1.2 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        color: #0f1a2c;
      }

      /* Actions: side-by-side, centered, under totals */
      .pos-invoice-actions{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .pos-action{
        height: 44px;
        border-radius: 999px;
        font: 800 17px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        cursor: pointer;
      }
      .pos-action.secondary{
        background: #fff;
        color: #007aff;
        border: 1px solid rgba(0,122,255,0.35);
      }
      .pos-action.primary{
        background: #007aff;
        color: #fff;
        border: none;
      }

      /* Product popup overlay */
      .pos-product-overlay{
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        background: rgba(10, 22, 40, 0.28);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        padding: 18px;
      }
      .pos-product-overlay.open{ display: flex; }

      .pos-product-sheet{
        width: min(520px, 92vw);
        background: rgba(255,255,255,0.96);
        border-radius: 20px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.25);
        position: relative;
        padding: 18px 18px 16px;
      }
      .pos-product-close{
        position: absolute;
        right: 12px;
        top: 12px;
        width: 32px;
        height: 32px;
        border-radius: 999px;
        border: none;
        background: rgba(0,0,0,0.06);
        font-size: 20px;
        cursor: pointer;
      }
      .pos-product-inner{
        display: grid;
        justify-items: center;
        gap: 10px;
        padding-top: 6px;
      }
      .pos-product-icon{
        width: 64px;
        height: 64px;
        border-radius: 16px;
        overflow: hidden;
        display: grid;
        place-items: center;
      }
      .pos-product-icon img{
        width: 64px;
        height: 64px;
        object-fit: cover;
      }
      .pos-product-fallback{
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: rgba(0,122,255,0.18);
      }
      .pos-product-title{
        font: 900 34px/1.05 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        letter-spacing: -0.03em;
        color: #0f1a2c;
        text-align: center;
      }
      .pos-product-add{
        width: 100%;
        height: 44px;
        border-radius: 999px;
        border: none;
        background: rgba(0,122,255,0.12);
        color: #007aff;
        font: 800 18px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  // -------------------------
  // Init
  // -------------------------
  loadState();

  // Create UI once DOM exists
  const boot = () => {
    ensureReceiptButton();
    ensureInvoiceModal();
    ensureProductPopup();
    installGlobalClickIntercept();

    // Expose global API
    window.CigarOSCart = {
      add,
      openInvoice,
      closeInvoice,
      clear,
      getCount: () => getItemCount(),
      getItems: () => [...state.items],
    };
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
