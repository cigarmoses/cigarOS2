/* /pos/cart.js
   Shared POS Cart + Invoice (single controller for ALL POS pages)

   Goals (stable):
   ✅ Always defines window.CigarOSCart (even if DOM isn't ready yet)
   ✅ Receipt FAB (#receipt-open) opens the invoice modal everywhere
   ✅ add() always updates the badge (#receipt-count)
   ✅ No global click interception that breaks Cigars/Favorites pages
   ✅ Optional product-card interception ONLY when [data-receipt-item] exists,
      and NEVER blocks explicit add buttons ([data-add], [data-direct-add], .row-add, etc.)
*/

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  // -------------------------
  // State
  // -------------------------
  const STORAGE_KEY = "pos_cart_v1";
  const state = { items: [] };

  // DOM refs
  let receiptBtn = null;
  let receiptImg = null;
  let receiptCount = null;

  let invoiceOverlay = null;
  let invoiceSheet = null;

  // -------------------------
  // Utils
  // -------------------------
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const money = (n) => {
    const x = Number(n || 0);
    return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function safeJSONParse(s, fallback) {
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeJSONParse(raw, null);
    if (parsed && Array.isArray(parsed.items)) state.items = parsed.items;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
  }

  function getItemCount() {
    return state.items.reduce((sum, it) => sum + clamp(Number(it.qty || 0), 0, 999), 0);
  }

  function makeStableId(item) {
    // fallback if no id provided
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

  // -------------------------
  // Styles
  // -------------------------
  function injectStylesOnce() {
    if (document.getElementById("pos-cart-styles")) return;

    const style = document.createElement("style");
    style.id = "pos-cart-styles";
    style.textContent = `
      /* Receipt FAB (works with your existing markup too) */
      .pos-receipt-btn, #receipt-open.receipt-fab{
        position: fixed;
        right: 16px;
        bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        width: 54px;
        height: 54px;
        border-radius: 16px;
        border: 1px solid rgba(0,0,0,.08);
        background: #ffffff;
        box-shadow: 0 10px 24px rgba(0,0,0,.16);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        z-index: 9998;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .pos-receipt-img, #receipt-open img{
        width: 26px;
        height: 26px;
        display: block;
      }
      .receipt-badge, #receipt-count{
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 999px;
        background: #ff3b30;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #fff;
      }

      /* Invoice modal */
      .pos-invoice-overlay{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        display: none;
        z-index: 9999;
      }
      .pos-invoice-overlay.open{ display: block; }

      .pos-invoice-sheet{
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 0;
        width: min(720px, 100%);
        max-height: 78svh;
        background: #fff;
        border-top-left-radius: 22px;
        border-top-right-radius: 22px;
        box-shadow: 0 -12px 30px rgba(0,0,0,.22);
        overflow: hidden;
      }

      .pos-invoice-header{
        padding: 14px 16px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(0,0,0,.08);
      }
      .pos-invoice-title{
        font-family: var(--font-display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
        font-weight: 800;
        letter-spacing: .04em;
        font-size: 14px;
        color: #0f1a2c;
      }
      .pos-invoice-close{
        width: 32px;
        height: 32px;
        border-radius: 10px;
        border: 1px solid rgba(0,0,0,.10);
        background: #fff;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
      }

      .pos-invoice-body{
        padding: 10px 14px 14px;
        overflow: auto;
        max-height: calc(78svh - 120px);
      }

      .pos-inv-row{
        display: grid;
        grid-template-columns: 44px 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid rgba(0,0,0,.06);
      }
      .pos-inv-ico{
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: #f3f5f8;
        border: 1px solid rgba(0,0,0,.06);
        display:flex;align-items:center;justify-content:center;
        overflow:hidden;
      }
      .pos-inv-ico img{ width: 100%; height: 100%; object-fit: contain; }

      .pos-inv-name{
        font-weight: 700;
        font-size: 14px;
        color: #0f1a2c;
        line-height: 1.15;
      }
      .pos-inv-sub{
        margin-top: 3px;
        font-size: 12px;
        color: rgba(15,26,44,.70);
      }
      .pos-inv-right{
        text-align: right;
      }
      .pos-inv-price{
        font-weight: 800;
        font-size: 14px;
        color: #0f1a2c;
      }
      .pos-inv-qty{
        margin-top: 6px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .pos-qty-btn{
        width: 28px;
        height: 28px;
        border-radius: 10px;
        border: 1px solid rgba(0,0,0,.10);
        background: #fff;
        cursor: pointer;
        font-weight: 800;
      }
      .pos-qty-val{
        min-width: 22px;
        text-align: center;
        font-weight: 800;
        font-size: 13px;
      }

      .pos-invoice-footer{
        padding: 12px 14px 16px;
        border-top: 1px solid rgba(0,0,0,.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .pos-inv-total{
        font-weight: 900;
        font-size: 16px;
        color: #0f1a2c;
      }
      .pos-inv-actions{
        display:flex;
        gap: 10px;
      }
      .pos-inv-action{
        height: 38px;
        padding: 0 14px;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,.12);
        background: #fff;
        font-weight: 800;
        cursor: pointer;
      }
      .pos-inv-action.primary{
        background: #007aff;
        border-color: #007aff;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  // -------------------------
  // Receipt FAB
  // -------------------------
  function ensureReceiptButton() {
    if (receiptBtn) return;

    receiptBtn = $("#receipt-open");
    if (!receiptBtn) {
      // If a page forgot the markup, inject it.
      receiptBtn = document.createElement("button");
      receiptBtn.type = "button";
      receiptBtn.id = "receipt-open";
      receiptBtn.className = "pos-receipt-btn";
      receiptBtn.setAttribute("aria-label", "Invoice");
      receiptBtn.innerHTML = `
        <img class="pos-receipt-img" src="/img/icons/receipt.png" alt="" />
        <span class="receipt-badge" id="receipt-count" hidden>0</span>
      `;
      document.body.appendChild(receiptBtn);
    } else {
      // Normalize styling (works with your existing .receipt-fab)
      receiptBtn.classList.add("pos-receipt-btn");
      receiptImg = $("img", receiptBtn);
      if (receiptImg) receiptImg.classList.add("pos-receipt-img");

      receiptCount = $("#receipt-count") || $("#receipt-count", receiptBtn) || $("#receipt-count");
      if (!receiptCount) {
        receiptCount = document.createElement("span");
        receiptCount.id = "receipt-count";
        receiptCount.className = "receipt-badge";
        receiptCount.hidden = true;
        receiptCount.textContent = "0";
        receiptBtn.appendChild(receiptCount);
      }
    }

    // bind once
    if (!receiptBtn.dataset.bound) {
      receiptBtn.dataset.bound = "1";
      receiptBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openInvoice();
      });
    }

    updateReceiptButton();
  }

  function updateReceiptButton() {
    receiptCount = receiptCount || $("#receipt-count");
    if (!receiptCount) return;

    const count = getItemCount();
    receiptCount.textContent = String(count);
    receiptCount.hidden = count <= 0;

    // icon swap support (optional)
    const img = $("img", receiptBtn);
    if (img) img.src = count > 0 ? "/img/icons/receiptred.png" : "/img/icons/receipt.png";
  }

  // -------------------------
  // Invoice modal
  // -------------------------
  function ensureInvoiceModal() {
    if (invoiceOverlay) return;

    invoiceOverlay = document.createElement("div");
    invoiceOverlay.className = "pos-invoice-overlay";
    invoiceOverlay.setAttribute("aria-hidden", "true");
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

      <div class="pos-invoice-body" id="pos-invoice-body"></div>

      <div class="pos-invoice-footer">
        <div class="pos-inv-total" id="pos-inv-total">$0.00</div>
        <div class="pos-inv-actions">
          <button type="button" class="pos-inv-action" data-action="clear">Clear</button>
          <button type="button" class="pos-inv-action primary" data-action="close">Close</button>
        </div>
      </div>
    `;

    invoiceOverlay.appendChild(invoiceSheet);
    document.body.appendChild(invoiceOverlay);

    // actions
    $(".pos-invoice-close", invoiceSheet)?.addEventListener("click", closeInvoice);
    invoiceSheet.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (action === "close") closeInvoice();
      if (action === "clear") clear();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && invoiceOverlay.classList.contains("open")) closeInvoice();
    });
  }

  function renderInvoice() {
    if (!invoiceSheet) return;
    const body = $("#pos-invoice-body", invoiceSheet);
    const totalEl = $("#pos-inv-total", invoiceSheet);
    if (!body || !totalEl) return;

    if (!state.items.length) {
      body.innerHTML = `<div style="padding:12px 2px;color:rgba(15,26,44,.65);font-weight:600;">No items yet.</div>`;
      totalEl.textContent = "$0.00";
      return;
    }

    let total = 0;
    body.innerHTML = state.items
      .map((it) => {
        const price = Number(it.price || 0);
        const qty = clamp(Number(it.qty || 1), 1, 999);
        total += price * qty;

        const img = it.img
          ? `<img src="${escapeAttr(it.img)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none';" />`
          : "";
        const sub = it.sub ? `<div class="pos-inv-sub">${escapeHTML(it.sub)}</div>` : "";

        return `
          <div class="pos-inv-row" data-id="${escapeAttr(it.id)}">
            <div class="pos-inv-ico">${img}</div>

            <div>
              <div class="pos-inv-name">${escapeHTML(it.name || "Item")}</div>
              ${sub}
            </div>

            <div class="pos-inv-right">
              <div class="pos-inv-price">$${money(price)}</div>
              <div class="pos-inv-qty">
                <button type="button" class="pos-qty-btn" data-qty="-1">−</button>
                <div class="pos-qty-val">${qty}</div>
                <button type="button" class="pos-qty-btn" data-qty="+1">+</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    totalEl.textContent = `$${money(total)}`;

    // qty handlers (single delegated)
    body.onclick = (e) => {
      const row = e.target.closest(".pos-inv-row");
      const btn = e.target.closest("[data-qty]");
      if (!row || !btn) return;

      const id = row.getAttribute("data-id");
      const dir = btn.getAttribute("data-qty");
      const item = state.items.find((x) => x.id === id);
      if (!item) return;

      const delta = dir === "+1" ? 1 : -1;
      const next = clamp(Number(item.qty || 1) + delta, 0, 999);

      if (next <= 0) {
        state.items = state.items.filter((x) => x.id !== id);
      } else {
        item.qty = next;
      }

      saveState();
      updateReceiptButton();
      renderInvoice();
    };
  }

  function openInvoice() {
    ensureInvoiceModal();
    renderInvoice();
    invoiceOverlay.classList.add("open");
    invoiceOverlay.setAttribute("aria-hidden", "false");
  }

  function closeInvoice() {
    if (!invoiceOverlay) return;
    invoiceOverlay.classList.remove("open");
    invoiceOverlay.setAttribute("aria-hidden", "true");
  }

  // -------------------------
  // Public API
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
    if (idx >= 0) state.items[idx].qty = clamp((state.items[idx].qty || 1) + normalized.qty, 1, 999);
    else state.items.push(normalized);

    saveState();
    updateReceiptButton();

    // If modal open, re-render
    if (invoiceOverlay?.classList.contains("open")) renderInvoice();
  }

  function clear() {
    state.items = [];
    saveState();
    updateReceiptButton();
    renderInvoice();
  }

  // -------------------------
  // Optional: intercept generic POS product cards
  // (ONLY if they use [data-receipt-item])
  // -------------------------
  function installOptionalCardIntercept() {
    // If the page has no receipt items, do nothing.
    if (!document.querySelector("[data-receipt-item]")) return;

    document.addEventListener(
      "click",
      (e) => {
        const t = e.target;

        // Never interfere with explicit add buttons / cigars pages
        if (
          t.closest(
            "[data-add], [data-direct-add], .row-add, .pos-row-add, .pos-plus, .row-plus, .add-plus, .green-plus"
          )
        )
          return;

        // Favorites: never intercept
        if (t.closest("#fav-cigars-list, .fav-row, .fav-open")) return;

        const card = t.closest("[data-receipt-item]");
        if (!card) return;

        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        add({
          id: card.dataset.id || "",
          type: (card.dataset.type || "product").toLowerCase(),
          category: card.dataset.category || "Product",
          brand: card.dataset.brand || "",
          name: card.dataset.name || "Item",
          price: Number(card.dataset.price || 0),
          img: card.dataset.img || "",
          link: card.dataset.link || "",
          sub: card.dataset.sub || "",
          qty: 1,
        });

        // UX: open invoice after add
        openInvoice();
      },
      { passive: false }
    );
  }

  function escapeHTML(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function escapeAttr(s) {
    return escapeHTML(s).replace(/"/g, "&quot;");
  }

  // -------------------------
  // Boot
  // -------------------------
  function boot() {
    injectStylesOnce();
    loadState();
    ensureReceiptButton();
    ensureInvoiceModal();
    installOptionalCardIntercept();

    // expose
    window.CigarOSCart = {
      add,
      openInvoice,
      closeInvoice,
      clear,
      getCount: () => getItemCount(),
      getItems: () => [...state.items],
      money,
    };
  }

  // Define API early so cigars pages can call it even before DOMContentLoaded.
  window.CigarOSCart =
    window.CigarOSCart ||
    {
      add,
      openInvoice,
      closeInvoice,
      clear,
      getCount: () => getItemCount(),
      getItems: () => [...state.items],
      money,
    };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
