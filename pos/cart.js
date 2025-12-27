/* /pos/cart.js
   Shared cart + receipt FAB + receipt modal
   Used across all POS pages so the same active receipt persists.

   Fixes in this version:
   - Universal receipt FAB icon everywhere (bottom-right):
     - GREEN when cart is empty: /img/icons/receipt.png
     - RED when cart has items: /img/icons/receiptred.png
   - Removes/neutralizes legacy receipt buttons/links that:
     - show giant receipt art
     - show broken “?” image icon
     - navigate to /pos/receipt.html
   - Fixes wrong relative icon src like "img/icons/receipt.png" → "/img/icons/receipt.png"
*/

(() => {
  const CART_KEY = "cigaros_cart_v1";
  const TAX_RATE = 0.07;

  const ICON_GREEN = "/img/icons/receipt.png";
  const ICON_RED = "/img/icons/receiptred.png";

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
    try { return JSON.parse(s); } catch { return fallback; }
  };

  function normalizeId(s) {
    return (s || "").toString().trim().toLowerCase();
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

    const idx = cart.items.findIndex((x) => normalizeId(x.id) === id);
    if (idx >= 0) {
      cart.items[idx].qty = Number(cart.items[idx].qty || 0) + 1;
    } else {
      cart.items.push({
        id,
        name: payload.name || "Item",
        brand: payload.brand || "",
        sub: payload.sub || "",
        price: Number(payload.price || 0),
        img: payload.img || "",
        qty: 1,
      });
    }
    writeCart(cart);
  }

  function setQty(id, qty) {
    const cart = readCart();
    const idx = cart.items.findIndex((x) => normalizeId(x.id) === normalizeId(id));
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

  // ---------- legacy cleanup (kills the “?” button + receipt.html nav) ----------
  function cleanupLegacyReceiptUI() {
    // 1) Remove any links to /pos/receipt.html (these cause full-page receipt)
    document
      .querySelectorAll('a[href*="/pos/receipt.html"], a[href$="pos/receipt.html"]')
      .forEach((a) => a.remove());

    // 2) Remove inline onclick navigations to receipt.html
    document.querySelectorAll("[onclick]").forEach((el) => {
      const v = (el.getAttribute("onclick") || "").toLowerCase();
      if (v.includes("receipt.html")) el.remove();
    });

    // 3) Fix wrong relative icon src that causes Safari “?” placeholder
    //    (common mistake: "img/icons/receipt.png" instead of "/img/icons/receipt.png")
    document.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src") || "";
      const lower = src.toLowerCase();

      const isReceiptIcon =
        lower.includes("img/icons/receipt.png") ||
        lower.includes("img/icons/receiptred.png");

      const isWrongRelative =
        (lower.startsWith("img/icons/receipt") || lower.includes("/pos/") && lower.includes("img/icons/receipt")) &&
        !lower.startsWith("/img/icons/");

      if (isReceiptIcon && isWrongRelative) {
        img.setAttribute(
          "src",
          lower.includes("receiptred") ? ICON_RED : ICON_GREEN
        );
      }
    });

    // 4) Remove known “extra floating buttons” some pages add (safe targeted list)
    document
      .querySelectorAll(
        ".help-fab, .pos-help-fab, .receipt-float, .receipt-button, .receipt-shortcut, #receipt-fab, #receiptFab, #help-fab, #helpFab"
      )
      .forEach((el) => el.remove());
  }

  // ---------- receipt FAB ----------
  function ensureFab() {
    // Only ONE universal FAB: .receipt-fab
    let fab = document.querySelector(".receipt-fab");

    if (!fab) {
      fab = document.createElement("button");
      fab.className = "receipt-fab";
      fab.type = "button";
      fab.setAttribute("aria-label", "Receipt");
      fab.innerHTML = `
        <img src="${ICON_GREEN}" alt="" />
        <span class="receipt-badge" hidden>0</span>
      `;
      document.body.appendChild(fab);
    } else {
      // ensure img exists
      let img = fab.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        img.alt = "";
        fab.prepend(img);
      }
      // ensure badge exists
      if (!fab.querySelector(".receipt-badge")) {
        const b = document.createElement("span");
        b.className = "receipt-badge";
        b.hidden = true;
        b.textContent = "0";
        fab.appendChild(b);
      }
    }

    // bind click once
    if (!fab.dataset.bound) {
      fab.addEventListener("click", openReceiptModal);
      fab.dataset.bound = "1";
    }

    updateFabUI();
  }

  function updateFabUI() {
    const cart = readCart();
    const n = cartCount(cart);

    const fab = document.querySelector(".receipt-fab");
    if (!fab) return;

    const img = fab.querySelector("img");
    const badge = fab.querySelector(".receipt-badge");

    if (img) {
      img.src = n > 0 ? ICON_RED : ICON_GREEN;
      // safety: if the image fails, force back to GREEN so you never see "?"
      img.onerror = () => {
        img.src = ICON_GREEN;
      };
    }

    if (badge) {
      badge.textContent = String(n);
      badge.hidden = n <= 0;
    }
  }

  // ---------- receipt modal ----------
  function ensureReceiptModal() {
    let overlay = document.getElementById("receipt-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "receipt-overlay";
    overlay.className = "pos-modal-overlay";
    overlay.hidden = true;

    overlay.innerHTML = `
      <div class="pos-modal-sheet" role="dialog" aria-modal="true" aria-label="Receipt">
        <div class="pos-modal-head">
          <button type="button" class="pos-modal-x" data-close aria-label="Close">Close</button>
          <div class="pos-modal-meta">
            <div class="pos-modal-date" id="receipt-date"></div>
            <div class="pos-modal-customer">
              <span class="label">Customer:</span>
              <button type="button" class="pos-modal-pill">Attach customer ▾</button>
            </div>
          </div>
        </div>

        <h2 class="pos-modal-title">Receipt</h2>

        <div class="pos-receipt-list" id="receipt-list"></div>

        <div class="pos-receipt-totals" id="receipt-totals"></div>

        <div class="pos-receipt-actions">
          <button type="button" class="pos-btn-light" id="receipt-save">SAVE DRAFT</button>
          <button type="button" class="pos-btn-blue" id="receipt-mockup">MOCKUP</button>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeReceiptModal();
    });
    overlay.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", closeReceiptModal);
    });

    document.addEventListener("keydown", (e) => {
      if (!overlay.hidden && e.key === "Escape") closeReceiptModal();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function escapeHTML(s) {
    return (s ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderReceipt() {
    const cart = readCart();
    const list = document.getElementById("receipt-list");
    const totals = document.getElementById("receipt-totals");
    const dateEl = document.getElementById("receipt-date");

    if (dateEl) dateEl.textContent = nowStamp();
    if (!list || !totals) return;

    const items = cart.items || [];
    if (!items.length) {
      list.innerHTML = `<div class="pos-empty">No items yet.</div>`;
      totals.innerHTML = "";
      return;
    }

    list.innerHTML = items.map((it) => {
      const ico = it.img
        ? `<img class="pos-receipt-ico" src="${it.img}" alt="" />`
        : `<div class="pos-receipt-ico ph"></div>`;

      return `
        <div class="pos-receipt-row" data-id="${it.id}">
          ${ico}
          <div class="pos-receipt-main">
            <div class="pos-receipt-name">${escapeHTML(it.name)}</div>
            <div class="pos-receipt-sub">${escapeHTML(it.brand || "")}${it.sub ? ` • ${escapeHTML(it.sub)}` : ""}</div>
          </div>
          <div class="pos-receipt-qty">
            <button type="button" class="qty-btn" data-dec aria-label="Decrease">−</button>
            <div class="qty-num">${Number(it.qty || 0)}</div>
            <button type="button" class="qty-btn" data-inc aria-label="Increase">+</button>
          </div>
          <div class="pos-receipt-price">$${money((Number(it.price || 0) * Number(it.qty || 0)))}</div>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".pos-receipt-row").forEach((row) => {
      const id = row.getAttribute("data-id");

      row.querySelector("[data-dec]")?.addEventListener("click", () => {
        const c = readCart();
        const item = c.items.find((x) => normalizeId(x.id) === normalizeId(id));
        if (!item) return;
        setQty(id, Number(item.qty || 0) - 1);
        renderReceipt();
      });

      row.querySelector("[data-inc]")?.addEventListener("click", () => {
        const c = readCart();
        const item = c.items.find((x) => normalizeId(x.id) === normalizeId(id));
        if (!item) return;
        setQty(id, Number(item.qty || 0) + 1);
        renderReceipt();
      });
    });

    const subtotal = items.reduce(
      (sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 0)),
      0
    );
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    totals.innerHTML = `
      <div class="tot-line"><span>Subtotal</span><span>$${money(subtotal)}</span></div>
      <div class="tot-line"><span>Tax</span><span>$${money(tax)}</span></div>
      <div class="tot-line total"><span>Total</span><span>$${money(total)}</span></div>
      <div class="tot-actions">
        <button type="button" class="pos-btn-light" id="receipt-clear">Clear</button>
      </div>
    `;

    totals.querySelector("#receipt-clear")?.addEventListener("click", () => {
      clearCart();
      renderReceipt();
    });
  }

  function openReceiptModal() {
    const overlay = ensureReceiptModal();
    overlay.hidden = false;
    document.body.classList.add("pos-modal-open");
    renderReceipt();
  }

  function closeReceiptModal() {
    const overlay = document.getElementById("receipt-overlay");
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("pos-modal-open");
  }

  // keep UI synced across pages/tabs
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) updateFabUI();
  });
  window.addEventListener("cigaros:cart-changed", updateFabUI);

  window.addEventListener("DOMContentLoaded", () => {
    cleanupLegacyReceiptUI(); // kills the “?” + receipt.html full page links
    ensureFab();
    updateFabUI();
  });
})();
