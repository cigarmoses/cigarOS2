/* /pos/cart.js
   Single shared cart + invoice sheet for ALL POS pages.
   Key rules:
   - Never auto-open invoice on page load
   - Close always works (button + backdrop + ESC)
   - Pages only call window.CigarOSCart.add(...) and optionally openInvoice()
*/

(() => {
  // Prevent double-init if accidentally included twice
  if (window.__CIGAROS_CART_INIT__) return;
  window.__CIGAROS_CART_INIT__ = true;

  const CART_KEY = "cigaros_cart_v1";
  const TAX_RATE = 0.07;

  // Icons (update paths if you want)
  const ICON_EMPTY = "/img/icons/receipt.png";
  const ICON_ACTIVE = "/img/icons/receiptred.png";

  // ---------- utils ----------
  const money = (n) => {
    const x = Number(n || 0);
    return x.toFixed(2);
  };

  const safeJSON = (s, fallback) => {
    try {
      const v = JSON.parse(s);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  };

  const normalizeId = (s) => (s || "").toString().trim().toLowerCase();

  const readCart = () => safeJSON(localStorage.getItem(CART_KEY), { items: [] });

  const writeCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: cart }));
  };

  const cartCount = (cart) =>
    (cart.items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0);

  const cartSubtotal = (cart) =>
    (cart.items || []).reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0), 0);

  // ---------- DOM: FAB + Sheet ----------
  function getOrCreateFab() {
    let fab =
      document.querySelector(".receipt-fab") ||
      document.querySelector(".pos-receipt-fab") ||
      document.querySelector(".receipt-fab-btn") ||
      document.getElementById("posReceiptFab");

    if (!fab) {
      fab = document.createElement("button");
      fab.type = "button";
      fab.className = "receipt-fab";
      document.body.appendChild(fab);
    }

    // Normalize FAB contents
    fab.classList.add("receipt-fab");
    fab.innerHTML = `
      <img class="receipt-fab-icon" alt="" />
      <span class="receipt-badge" hidden>0</span>
    `;

    // Basic positioning if page doesn't style it (won't override if your CSS already does)
    fab.style.position = fab.style.position || "fixed";
    fab.style.right = fab.style.right || "18px";
    fab.style.bottom = fab.style.bottom || "18px";
    fab.style.zIndex = fab.style.zIndex || "9999";
    fab.style.border = fab.style.border || "none";
    fab.style.background = fab.style.background || "transparent";
    fab.style.padding = fab.style.padding || "0";
    fab.style.cursor = fab.style.cursor || "pointer";

    return fab;
  }

  function ensureSheet() {
    let backdrop = document.getElementById("cigaros-invoice-backdrop");
    let sheet = document.getElementById("cigaros-invoice-sheet");

    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "cigaros-invoice-backdrop";
      document.body.appendChild(backdrop);
    }
    if (!sheet) {
      sheet = document.createElement("section");
      sheet.id = "cigaros-invoice-sheet";
      document.body.appendChild(sheet);
    }

    // Styles (kept inline so it works everywhere even before CSS cleanup)
    backdrop.style.position = "fixed";
    backdrop.style.inset = "0";
    backdrop.style.background = "rgba(0,0,0,.35)";
    backdrop.style.zIndex = "9998";

    sheet.style.position = "fixed";
    sheet.style.left = "0";
    sheet.style.right = "0";
    sheet.style.bottom = "0";
    sheet.style.zIndex = "9999";
    sheet.style.background = "#fff";
    sheet.style.borderTopLeftRadius = "18px";
    sheet.style.borderTopRightRadius = "18px";
    sheet.style.boxShadow = "0 -12px 40px rgba(0,0,0,.18)";
    sheet.style.maxHeight = "82vh";
    sheet.style.overflow = "auto";
    sheet.style.transform = "translateY(110%)";
    sheet.style.transition = "transform .18s ease";

    backdrop.hidden = true;

    return { backdrop, sheet };
  }

  let isOpen = false;
  const fab = getOrCreateFab();
  const { backdrop, sheet } = ensureSheet();

  function openInvoice() {
    isOpen = true;
    backdrop.hidden = false;
    sheet.style.transform = "translateY(0)";
    renderInvoice();
  }

  function closeInvoice() {
    isOpen = false;
    sheet.style.transform = "translateY(110%)";
    backdrop.hidden = true;
  }

  // Close actions
  backdrop.addEventListener("click", closeInvoice);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) closeInvoice();
  });

  fab.addEventListener("click", () => {
    openInvoice();
  });

  // ---------- invoice rendering ----------
  function renderInvoice() {
    const cart = readCart();
    const subtotal = cartSubtotal(cart);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    sheet.innerHTML = `
      <div style="padding:14px 16px 10px 16px; border-bottom:1px solid rgba(0,0,0,.06);">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <button type="button" data-action="close"
            style="border:none; background:transparent; font-size:18px; color:#0a66ff; font-weight:600; padding:6px 0;">
            Close
          </button>
          <div style="font-size:20px; font-weight:800;">Receipt</div>
          <div style="width:60px;"></div>
        </div>

        <div style="margin-top:8px; display:flex; align-items:center; justify-content:space-between;">
          <div style="font-size:13px; color:rgba(0,0,0,.55);">
            ${new Date().toLocaleString(undefined, { month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit" })}
          </div>
          <button type="button" data-action="customer"
            style="border:1px solid rgba(0,0,0,.12); background:#fff; border-radius:999px; padding:8px 12px; font-weight:700;">
            Customer: <span style="font-weight:800;">Attach customer</span> ▼
          </button>
        </div>

        <div style="margin-top:10px; font-size:52px; font-weight:900; letter-spacing:-1px;">Invoice</div>
      </div>

      <div id="cigaros-invoice-items" style="padding:10px 16px 0 16px;"></div>

      <div style="padding:14px 16px 18px 16px; border-top:1px solid rgba(0,0,0,.06);">
        <div style="display:flex; justify-content:flex-end; gap:18px; font-weight:800;">
          <div style="text-align:right;">
            <div style="opacity:.7;">SUBTOTAL</div>
            <div style="opacity:.7;">TAX</div>
            <div style="margin-top:10px;">TOTAL</div>
          </div>
          <div style="text-align:right; min-width:92px;">
            <div style="opacity:.8;">${money(subtotal)}</div>
            <div style="opacity:.8;">${money(tax)}</div>
            <div style="margin-top:10px;">${money(total)}</div>
          </div>
        </div>

        <div style="display:flex; gap:12px; margin-top:14px;">
          <button type="button" data-action="draft"
            style="flex:1; border:2px solid rgba(0,0,0,.12); background:#fff; border-radius:14px; padding:14px 12px; font-size:18px; font-weight:900;">
            SAVE DRAFT
          </button>
          <button type="button" data-action="confirm"
            style="flex:1; border:none; background:#0a66ff; color:#fff; border-radius:14px; padding:14px 12px; font-size:18px; font-weight:900;">
            CONFIRM
          </button>
        </div>
      </div>
    `;

    const itemsWrap = sheet.querySelector("#cigaros-invoice-items");
    const items = cart.items || [];

    if (!items.length) {
      itemsWrap.innerHTML = `<div style="padding:18px 0; color:rgba(0,0,0,.55); font-weight:700;">No items yet.</div>`;
      return;
    }

    itemsWrap.innerHTML = items
      .map((it) => {
        const title = it.category || it.type || "Item";   // <- category title (Packs, Pipes, Accessories, etc.)
        const name = it.name || "Item";
        const brand = it.brand || "";
        const unit = Number(it.price || 0);
        const qty = Number(it.qty || 0);
        const lineTotal = unit * qty;

        return `
          <div style="display:flex; gap:12px; padding:12px 0; border-bottom:1px solid rgba(0,0,0,.06);">
            <div style="width:58px; height:58px; border-radius:14px; background:rgba(10,102,255,.12); flex:0 0 58px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
              ${it.img ? `<img src="${it.img}" alt="" style="width:100%; height:100%; object-fit:cover;">` : ""}
            </div>

            <div style="flex:1; min-width:0;">
              <div style="font-size:22px; font-weight:900; line-height:1.05;">${escapeHTML(title)}</div>
              <div style="font-size:16px; color:rgba(0,0,0,.65); font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHTML(name)}
              </div>
              <div style="font-size:14px; color:rgba(0,0,0,.45); font-weight:700;">
                ${brand ? escapeHTML(brand) + " • " : ""}${money(unit)}
              </div>
            </div>

            <div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap:8px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <button type="button" data-action="dec" data-id="${escapeAttr(it.id)}"
                  style="width:32px; height:32px; border-radius:999px; border:1px solid rgba(0,0,0,.18); background:#fff; font-size:18px; font-weight:900;">−</button>
                <div style="min-width:18px; text-align:center; font-weight:900;">${qty}</div>
                <button type="button" data-action="inc" data-id="${escapeAttr(it.id)}"
                  style="width:32px; height:32px; border-radius:999px; border:1px solid rgba(0,0,0,.18); background:#fff; font-size:18px; font-weight:900;">+</button>
              </div>

              <div style="background:#0a66ff; color:#fff; padding:8px 12px; border-radius:10px; font-weight:900; font-size:16px;">
                ${money(lineTotal)}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function escapeHTML(s) {
    return (s ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function escapeAttr(s) {
    return escapeHTML(s).replaceAll('"', "&quot;");
  }

  // Sheet button actions + +/- qty (event delegation)
  sheet.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    if (!action) return;

    if (action === "close") return closeInvoice();

    if (action === "inc" || action === "dec") {
      const id = normalizeId(btn.getAttribute("data-id"));
      if (!id) return;

      const cart = readCart();
      const idx = (cart.items || []).findIndex((x) => normalizeId(x.id) === id);
      if (idx < 0) return;

      const cur = Number(cart.items[idx].qty || 0);
      const next = action === "inc" ? cur + 1 : cur - 1;

      if (next <= 0) cart.items.splice(idx, 1);
      else cart.items[idx].qty = next;

      writeCart(cart);
      renderInvoice();
      refreshFab();
      return;
    }

    // draft/confirm placeholders
    if (action === "draft") {
      // no-op for now
      return;
    }
    if (action === "confirm") {
      // no-op for now
      return;
    }
  });

  // ---------- public API ----------
  function add(payload) {
    const cart = readCart();

    const id = normalizeId(payload.id || payload.key || payload.name);
    if (!id) return;

    const existingIdx = (cart.items || []).findIndex((x) => normalizeId(x.id) === id);
    if (existingIdx >= 0) {
      cart.items[existingIdx].qty = Number(cart.items[existingIdx].qty || 0) + 1;
    } else {
      cart.items.push({
        id,
        type: payload.type || "product",
        category: payload.category || payload.type || "Item",
        brand: payload.brand || "",
        name: payload.name || "Item",
        sub: payload.sub || "",
        price: Number(payload.price || 0),
        img: payload.img || "",
        link: payload.link || "",
        qty: 1,
      });
    }

    writeCart(cart);
    refreshFab();
  }

  function clear() {
    writeCart({ items: [] });
    refreshFab();
    if (isOpen) renderInvoice();
  }

  function refreshFab() {
    const cart = readCart();
    const count = cartCount(cart);

    const imgEl = fab.querySelector(".receipt-fab-icon");
    const badgeEl = fab.querySelector(".receipt-badge");

    if (imgEl) imgEl.src = count > 0 ? ICON_ACTIVE : ICON_EMPTY;

    if (badgeEl) {
      if (count <= 0) {
        badgeEl.hidden = true;
      } else {
        badgeEl.hidden = false;
        badgeEl.textContent = String(count);
      }
    }
  }

  // Expose API
  window.CigarOSCart = {
    read: readCart,
    add,
    clear,
    openInvoice,
    closeInvoice,
    money,
  };

  // IMPORTANT: do NOT auto-open invoice on load.
  refreshFab();
})();
