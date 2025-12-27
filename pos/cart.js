/* /pos/cart.js
   Shared cart + INVOICE FAB + INVOICE modal + "Add to Bill" confirm modal

   Storage key: cigaros_cart_v1
   Receipt icon:
     /img/icons/receipt.png (empty)
     /img/icons/receiptred.png (has open items)

   Exposes:
     window.CigarOSCart.add(payload)        // direct add (cigars can use this)
     window.CigarOSCart.promptAdd(payload)  // shows Add-to-Bill confirm modal (non-cigar categories)

   Optional page-level meta override:
     window.CigarOSInvoiceMeta = {
       shopName: "Smoke Cigar Shop",
       invoiceNumber: "INV# 123456"
     }
*/

(() => {
  const CART_KEY = "cigaros_cart_v1";
  const TAX_RATE = 0.07;

  const ICON_GREEN = "/img/icons/receipt.png";
  const ICON_RED = "/img/icons/receiptred.png";

  // ---------- utils ----------
  const $ = (sel) => document.querySelector(sel);

  const money = (n) => Number(n || 0).toFixed(2);

  const safeJSON = (s, fallback) => {
    try { return JSON.parse(s); } catch { return fallback; }
  };

  const normalizeId = (s) => (s || "").toString().trim().toLowerCase();

  const escapeHTML = (s) => (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const nowStamp = () => {
    try {
      // "Wednesday 10/22/25 11:02 PM"
      const d = new Date();
      const weekday = d.toLocaleString(undefined, { weekday: "long" });
      const date = d.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "2-digit" });
      const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `${weekday} ${date} ${time}`;
    } catch {
      return new Date().toString();
    }
  };

  function getInvoiceMeta() {
    const meta = window.CigarOSInvoiceMeta || {};
    return {
      shopName: meta.shopName || "Smoke Cigar Shop",
      invoiceNumber: meta.invoiceNumber || "INV# 123456",
    };
  }

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
    const id = normalizeId(payload.id || payload.key || payload.name);
    if (!id) return;

    const idx = (cart.items || []).findIndex((x) => normalizeId(x.id) === id);

    // Store unit price in `price`
    const unitPrice = Number(payload.price ?? 0);

    if (idx >= 0) {
      cart.items[idx].qty = Number(cart.items[idx].qty || 0) + 1;
    } else {
      cart.items.push({
        id,
        qty: 1,

        // shared fields
        img: payload.img || "",

        // NON-CIGAR
        category: payload.category || "",
        name: payload.name || "Item",
        price: unitPrice, // unit price

        // CIGAR (optional)
        cigarName: payload.cigarName || "",     // display name (optional)
        cigarLine: payload.cigarLine || "",     // line (optional)
        brand: payload.brand || "",             // brand name
        vitola: payload.vitola || "",           // vitola string
        msrp: payload.msrp ?? "",               // msrp number/string
        url: payload.url || "",                 // hyperlink for cigar line+name
        isCigar: !!payload.isCigar,             // bool
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

  // ---------- expose API ----------
  window.CigarOSCart = {
    read: readCart,
    add: addItem,
    setQty,
    clear: clearCart,
    money,
    promptAdd: (payload) => openAddConfirm(payload),
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
        background: rgba(255,255,255,.80);
        color: rgba(15,26,44,.45);
        font-weight: 950;
        font-size: 24px;
        letter-spacing: -0.01em;
      }
      #addbill-overlay .addbill-btn.is-active {
        background: #ffffff;
        color: #0f1a2c;
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- invoice FAB ----------
  function ensureFab() {
    // reuse any old fab if present
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
            <button type="button" class="inv-btn" id="inv-confirm">Confirm Sale</button>
          </div>

          <div class="inv-totals" id="inv-totals"></div>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target?.matches("[data-close]")) closeInvoiceModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (overlay.classList.contains("open")) closeInvoiceModal();
        if (isAddOpen()) closeAddConfirm();
      }
    });

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
    const meta = getInvoiceMeta();
    overlay.querySelector("#inv-datetime").textContent = nowStamp();
    overlay.querySelector("#inv-shop").textContent = meta.shopName;
    overlay.querySelector("#inv-number").textContent = meta.invoiceNumber;

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

      // image
      const imgHTML = it.img
        ? `<div class="inv-ico"><img src="${escapeHTML(it.img)}" alt=""></div>`
        : `<div class="inv-ico"></div>`;

      // cigar?
      const isCigar = !!it.isCigar;

      if (!isCigar) {
        // NON-CIGAR: 3 lines = category, name, unit price
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

      // CIGAR: line1 = hyperlink cigar line+name, line2 = brand, line3 = vitola + MSRP
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
        <button type="button" class="addbill-btn is-active" id="addbill-btn">Add to bill</button>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target?.matches("[data-close]")) closeAddConfirm();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function isAddOpen() {
    const o = document.getElementById("addbill-overlay");
    return !!o && o.classList.contains("open");
  }

  let pendingAdd = null;

  function openAddConfirm(payload) {
    // expected payload: { id, category, name, price, img }
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

  // ---------- sync across pages/tabs ----------
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) updateFab();
  });
  window.addEventListener("cigaros:cart-changed", () => {
    updateFab();
    const inv = document.getElementById("invoice-overlay");
    if (inv && inv.classList.contains("open")) renderInvoice();
  });

  // ---------- init ----------
  window.addEventListener("DOMContentLoaded", () => {
    ensureStyles();
    ensureFab();
  });
})();
