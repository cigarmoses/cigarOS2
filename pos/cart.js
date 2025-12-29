/* /pos/cart.js
   One shared cart + invoice sheet for ALL POS pages.

   - Persists to localStorage
   - Creates a small bottom-right receipt FAB (if page doesn't already have one)
   - Creates an invoice bottom sheet (if page doesn't already have one)
   - Category pages: tap product card => popup => "Add to invoice"
   - Brand page: can keep using its existing plus-button add flow (won't be broken)
*/

(() => {
  const STORAGE_KEY = "cigaros_cart_v1";

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const money = (n) => {
    const x = Number(n || 0);
    return x.toFixed(2);
  };

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function cartCount(items) {
    return items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  }

  function upsertItem(next) {
    const items = loadCart();
    const key = String(next.id || "").trim();
    if (!key) return items;

    const found = items.find((x) => x.id === key);
    if (found) {
      found.qty = (Number(found.qty) || 0) + (Number(next.qty) || 1);
    } else {
      items.push({
        id: key,
        type: next.type || "product",
        category: next.category || "",
        brand: next.brand || "",
        name: next.name || "Item",
        price: Number(next.price || 0),
        qty: Number(next.qty || 1),
        img: next.img || "",
        link: next.link || "",
        sub: next.sub || ""
      });
    }
    saveCart(items);
    return items;
  }

  function clearCart() {
    saveCart([]);
  }

  // ---------- styles (fixes the “giant icon” problem everywhere) ----------
  function injectStylesOnce() {
    if ($("#cigaros-cart-styles")) return;

    const style = document.createElement("style");
    style.id = "cigaros-cart-styles";
    style.textContent = `
      /* Shared receipt FAB — force consistent small size on all pages */
      .receipt-fab,
      .pos-receipt-fab {
        position: fixed;
        right: 18px;
        bottom: 18px;
        width: 56px;
        height: 56px;
        border-radius: 18px;
        border: none;
        background: transparent;
        padding: 0;
        margin: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        -webkit-tap-highlight-color: transparent;
      }
      .receipt-fab img,
      .pos-receipt-fab img {
        width: 56px;
        height: 56px;
        display: block;
        object-fit: contain;
      }
      .receipt-badge,
      .pos-receipt-badge {
        position: absolute;
        right: -2px;
        bottom: -2px;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 999px;
        background: #ff3b30;
        color: #fff;
        font: 700 12px/20px -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        display: none;
        align-items: center;
        justify-content: center;
      }

      /* Product popup */
      .pos-product-modal[hidden]{ display:none !important; }
      .pos-product-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: grid;
        place-items: center;
      }
      .pos-product-backdrop{
        position:absolute;
        inset:0;
        background: rgba(0,0,0,.35);
      }
      .pos-product-card{
        position: relative;
        width: min(560px, calc(100vw - 32px));
        border-radius: 22px;
        background: #fff;
        box-shadow: 0 30px 70px rgba(0,0,0,.25);
        padding: 18px 18px 16px;
      }
      .pos-product-x{
        position:absolute;
        top: 12px;
        right: 12px;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        border:none;
        background: #f1f3f6;
        color:#111;
        font-size: 20px;
        line-height: 34px;
      }
      .pos-product-top{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap: 10px;
        padding: 10px 0 8px;
      }
      .pos-product-icon{
        width: 64px;
        height: 64px;
        border-radius: 18px;
        overflow:hidden;
        background:#eaf0ff;
        display:grid;
        place-items:center;
      }
      .pos-product-icon img{
        width: 64px;
        height: 64px;
        object-fit: contain;
        display:block;
      }
      .pos-product-title{
        font: 800 40px/1.05 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        letter-spacing: -0.03em;
        color:#0f1a2c;
        text-align:center;
        margin: 0;
      }
      .pos-product-actions{
        margin-top: 12px;
        background: #f3f5f8;
        border-radius: 18px;
        padding: 14px;
        display:flex;
        justify-content:center;
      }
      .pos-product-add{
        width: 100%;
        border:none;
        background: transparent;
        color: #007aff;
        font: 800 22px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        padding: 16px 10px;
      }

      /* Invoice sheet */
      .pos-invoice-backdrop[hidden]{ display:none !important; }
      .pos-invoice-backdrop{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.35);
        z-index: 10001;
      }
      .pos-invoice-sheet[hidden]{ display:none !important; }
      .pos-invoice-sheet{
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10002;
        background: #fff;
        border-top-left-radius: 22px;
        border-top-right-radius: 22px;
        box-shadow: 0 -25px 60px rgba(0,0,0,.25);
        max-height: 82vh;
        overflow: hidden;
      }
      .pos-invoice-header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 12px 16px 10px;
        border-bottom: 1px solid rgba(0,0,0,.08);
      }
      .pos-invoice-close{
        border:none;
        background: none;
        color: #007aff;
        font: 700 18px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        padding: 10px 6px;
      }
      .pos-invoice-title{
        font: 800 20px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        color:#0f1a2c;
      }
      .pos-invoice-body{
        padding: 12px 16px 14px;
        overflow:auto;
        max-height: calc(82vh - 56px - 70px);
      }
      .pos-invoice-row{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(0,0,0,.06);
      }
      .pos-invoice-left{
        min-width: 0;
      }
      .pos-invoice-cat{
        font: 900 14px/1.1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        color:#0f1a2c;
        margin-bottom: 4px;
      }
      .pos-invoice-name{
        font: 700 16px/1.15 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        color:#0f1a2c;
      }
      .pos-invoice-sub{
        font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        color: rgba(15,26,44,.55);
        margin-top: 3px;
      }
      .pos-invoice-right{
        text-align:right;
        flex: 0 0 auto;
      }
      .pos-invoice-qty{
        font: 800 14px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        color: rgba(15,26,44,.65);
      }
      .pos-invoice-price{
        margin-top: 6px;
        font: 900 16px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        color:#0f1a2c;
      }
      .pos-invoice-footer{
        padding: 12px 16px 14px;
        border-top: 1px solid rgba(0,0,0,.08);
        display:flex;
        gap: 12px;
      }
      .pos-invoice-btn{
        flex:1;
        border-radius: 14px;
        border: 1px solid rgba(0,0,0,.12);
        background:#fff;
        padding: 14px 12px;
        font: 800 16px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      }
      .pos-invoice-btn.primary{
        background:#007aff;
        border-color:#007aff;
        color:#fff;
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- UI injection / wiring ----------
  function ensureFab() {
    // If your brand page already has its own button, don't inject another.
    const existingFab =
      $("#receipt-open") ||
      $("#posReceiptFab") ||
      $(".receipt-fab") ||
      $(".pos-receipt-fab");

    if (existingFab) return existingFab;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "receipt-fab";
    btn.id = "receipt-open";
    btn.setAttribute("aria-label", "Receipt");

    // use your existing green receipt icon path if you want
    const img = document.createElement("img");
    img.src = "/img/icons/receipt.png"; // adjust if your asset lives elsewhere
    img.alt = "";
    btn.appendChild(img);

    const badge = document.createElement("span");
    badge.className = "receipt-badge";
    badge.id = "receipt-count";
    badge.textContent = "0";
    btn.appendChild(badge);

    document.body.appendChild(btn);
    return btn;
  }

  function ensureInvoiceSheet() {
    // If brand page already has #sheet-receipt, don't inject a second one
    if ($("#sheet-receipt") || $(".pos-invoice-sheet")) return;

    const backdrop = document.createElement("div");
    backdrop.className = "pos-invoice-backdrop";
    backdrop.id = "pos-invoice-backdrop";
    backdrop.hidden = true;

    const sheet = document.createElement("section");
    sheet.className = "pos-invoice-sheet";
    sheet.id = "pos-invoice-sheet";
    sheet.hidden = true;

    sheet.innerHTML = `
      <header class="pos-invoice-header">
        <button class="pos-invoice-close" type="button" data-invoice-close>Close</button>
        <div class="pos-invoice-title">Receipt</div>
        <div style="width:54px;"></div>
      </header>
      <div class="pos-invoice-body" id="pos-invoice-items"></div>
      <footer class="pos-invoice-footer">
        <button class="pos-invoice-btn" type="button" data-invoice-clear>Clear</button>
        <button class="pos-invoice-btn primary" type="button" data-invoice-close>Confirm</button>
      </footer>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
  }

  function ensureProductModal() {
    if ($("#pos-product-modal")) return;

    const wrap = document.createElement("div");
    wrap.className = "pos-product-modal";
    wrap.id = "pos-product-modal";
    wrap.hidden = true;

    wrap.innerHTML = `
      <div class="pos-product-backdrop" data-product-close></div>
      <div class="pos-product-card" role="dialog" aria-modal="true" aria-label="Product">
        <button class="pos-product-x" type="button" data-product-close aria-label="Close">×</button>

        <div class="pos-product-top">
          <div class="pos-product-icon" id="pos-product-icon"></div>
          <h2 class="pos-product-title" id="pos-product-title">Item</h2>
        </div>

        <div class="pos-product-actions">
          <button class="pos-product-add" type="button" id="pos-product-add">Add to invoice</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    // close wiring
    $$("[data-product-close]", wrap).forEach((el) => {
      el.addEventListener("click", () => closeProductModal());
    });
  }

  function openProductModal(card) {
    ensureProductModal();

    const modal = $("#pos-product-modal");
    const icon = $("#pos-product-icon");
    const title = $("#pos-product-title");
    const addBtn = $("#pos-product-add");

    const type = (card.dataset.type || "product").toLowerCase();
    const category = card.dataset.category || "Product";
    const brand = card.dataset.brand || "";
    const name = card.dataset.name || "Item";
    const price = Number(card.dataset.price || "0");
    const img = card.dataset.img || "";

    // title like your screenshot: "7up - 1.50"
    title.textContent = `${name} - ${money(price)}`;

    // icon
    icon.innerHTML = "";
    if (img) {
      const im = document.createElement("img");
      im.src = img;
      im.alt = "";
      icon.appendChild(im);
    }

    // bind add
    addBtn.onclick = () => {
      const id = (category + "|" + brand + "|" + name).toLowerCase();
      upsertItem({ id, type, category, brand, name, price, qty: 1, img });
      updateBadgeEverywhere();
      closeProductModal();
    };

    modal.hidden = false;
  }

  function closeProductModal() {
    const modal = $("#pos-product-modal");
    if (modal) modal.hidden = true;
  }

  function openInvoice() {
    // If you're on brand page using its own sheet, let that page control it.
    const injectedSheet = $("#pos-invoice-sheet");
    const injectedBackdrop = $("#pos-invoice-backdrop");

    if (injectedSheet && injectedBackdrop) {
      renderInjectedInvoice();
      injectedBackdrop.hidden = false;
      injectedSheet.hidden = false;
      return;
    }

    // If brand page has its own sheet (#sheet-receipt) we won't fight it here.
    // The brand page can keep calling its own open logic.
  }

  function closeInvoice() {
    const injectedSheet = $("#pos-invoice-sheet");
    const injectedBackdrop = $("#pos-invoice-backdrop");
    if (injectedSheet && injectedBackdrop) {
      injectedBackdrop.hidden = true;
      injectedSheet.hidden = true;
      return;
    }
  }

  function renderInjectedInvoice() {
    const list = $("#pos-invoice-items");
    if (!list) return;

    const items = loadCart();
    if (items.length === 0) {
      list.innerHTML = `<div style="padding:18px 0;color:rgba(15,26,44,.6);font:700 16px/1.2 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;">No items yet</div>`;
      return;
    }

    list.innerHTML = items
      .map((it) => {
        const cat = it.category || it.type || "Item";
        const sub = [it.brand].filter(Boolean).join(" • ");
        const line = Number(it.price || 0) * (Number(it.qty) || 1);
        return `
          <div class="pos-invoice-row">
            <div class="pos-invoice-left">
              <div class="pos-invoice-cat">${escapeHtml(cat)}</div>
              <div class="pos-invoice-name">${escapeHtml(it.name || "Item")}</div>
              ${sub ? `<div class="pos-invoice-sub">${escapeHtml(sub)}</div>` : ``}
            </div>
            <div class="pos-invoice-right">
              <div class="pos-invoice-qty">x${Number(it.qty) || 1}</div>
              <div class="pos-invoice-price">$${money(line)}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function updateBadgeEverywhere() {
    const items = loadCart();
    const count = cartCount(items);

    // injected FAB badge
    const badgeA = $("#receipt-count");
    if (badgeA) {
      if (count <= 0) badgeA.style.display = "none";
      else {
        badgeA.textContent = String(count);
        badgeA.style.display = "flex";
      }
    }

    // legacy badge ids (in case any old pages still have them)
    const badgeB = $("#posReceiptBadge");
    if (badgeB) {
      if (count <= 0) badgeB.style.display = "none";
      else {
        badgeB.textContent = String(count);
        badgeB.style.display = "flex";
      }
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- click wiring ----------
  function wireCategoryCards() {
    // This is the key “one change” you wanted:
    // Any page with [data-receipt-item] cards gets tap => product popup.
    $$("#pos-product-modal").forEach(() => {}); // no-op, ensures query doesn't throw

    $$("[data-receipt-item]").forEach((card) => {
      // don't double-bind
      if (card.dataset.cartBound === "1") return;
      card.dataset.cartBound = "1";

      card.addEventListener("click", (e) => {
        // If someday you add internal buttons/links, keep this safe:
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
        if (tag === "a" || tag === "button") return;

        openProductModal(card);
      });
    });
  }

  function wireInvoiceControls() {
    // injected sheet controls
    const backdrop = $("#pos-invoice-backdrop");
    const sheet = $("#pos-invoice-sheet");
    if (backdrop) backdrop.addEventListener("click", closeInvoice);

    $$("[data-invoice-close]").forEach((btn) => btn.addEventListener("click", closeInvoice));
    $$("[data-invoice-clear]").forEach((btn) =>
      btn.addEventListener("click", () => {
        clearCart();
        updateBadgeEverywhere();
        renderInjectedInvoice();
      })
    );

    // FAB open (works on injected FAB)
    const fab = $("#receipt-open") || $("#posReceiptFab") || $(".receipt-fab") || $(".pos-receipt-fab");
    if (fab && fab.dataset.cartFabBound !== "1") {
      fab.dataset.cartFabBound = "1";
      fab.addEventListener("click", () => openInvoice());
    }
  }

  // ---------- public API ----------
  window.CigarOSCart = {
    add: (item) => {
      upsertItem(item || {});
      updateBadgeEverywhere();
    },
    clear: () => {
      clearCart();
      updateBadgeEverywhere();
    },
    getItems: () => loadCart(),
    openInvoice,
    closeInvoice
  };

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", () => {
    injectStylesOnce();

    // only inject sheet/fab if the page doesn't already have the brand-page ones
    ensureInvoiceSheet();
    ensureFab();

    ensureProductModal();

    wireCategoryCards();
    wireInvoiceControls();
    updateBadgeEverywhere();
  });
})();
