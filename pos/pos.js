// /pos/pos.js
// Global POS cart + invoice popup logic

(function () {
  const TAX_RATE = 0.07;

  const state = {
    items: [] // { id, name, brand, vitola, price, qty, icon, stockEl }
  };

  // ---------- Helpers ----------

  function formatMoney(value) {
    return value.toFixed(2);
  }

  function findItemIndex(id) {
    return state.items.findIndex((i) => i.id === id);
  }

  function totalQty() {
    return state.items.reduce((sum, i) => sum + i.qty, 0);
  }

  function adjustStock(el, delta) {
    if (!el) return;
    const current = parseInt(el.textContent, 10);
    if (Number.isNaN(current)) return;
    const next = Math.max(0, current + delta);
    el.textContent = String(next);
  }

  // ---------- Cart core ----------

  function addItem(config) {
    const id = String(config.id || "").trim();
    if (!id) return;

    const qtyToAdd = config.qty && config.qty > 0 ? config.qty : 1;

    let item = state.items.find((i) => i.id === id);
    if (!item) {
      item = {
        id,
        name: config.name || "",
        brand: config.brand || "",
        vitola: config.vitola || "",
        price: Number(config.price || 0),
        qty: 0,
        icon: config.icon || "/img/icons/categories/cigars.svg",
        stockEl: config.stockEl || null
      };
      state.items.push(item);
    }

    item.qty += qtyToAdd;

    // Decrement visible stock if we have a pill element
    if (config.stockEl) {
      item.stockEl = config.stockEl;
      adjustStock(item.stockEl, -qtyToAdd);
    }

    renderAll();
  }

  function changeQty(id, delta) {
    const idx = findItemIndex(id);
    if (idx === -1) return;

    const item = state.items[idx];
    const newQty = item.qty + delta;

    // If qty goes to 0 or below, remove item entirely
    if (newQty <= 0) {
      // Return all remaining qty to stock pill
      if (item.stockEl) {
        adjustStock(item.stockEl, item.qty);
      }
      state.items.splice(idx, 1);
    } else {
      item.qty = newQty;
      // Adjust stock pill each click
      if (item.stockEl) {
        adjustStock(item.stockEl, -delta);
      }
    }

    renderAll();
  }

  // ---------- UI: badge + invoice ----------

  function updateReceiptBadge() {
    const pill = document.getElementById("open-receipt");
    if (!pill) return;

    let badge = document.getElementById("receipt-count");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "receipt-count";
      badge.className = "receipt-count";
      pill.appendChild(badge);
    }

    badge.textContent = String(totalQty());
  }

  function renderInvoice() {
    const container = document.getElementById("invoice-items");
    const subtotalEl = document.getElementById("invoice-subtotal");
    const taxEl = document.getElementById("invoice-tax");
    const totalEl = document.getElementById("invoice-total");

    if (!container) return;

    container.innerHTML = "";
    let subtotal = 0;

    state.items.forEach((item) => {
      const lineTotal = item.price * item.qty;
      subtotal += lineTotal;

      const row = document.createElement("div");
      row.className = "invoice-item";
      row.dataset.id = item.id;

      row.innerHTML = `
        <div class="invoice-left">
          <div class="invoice-thumb">
            <img src="${item.icon}" alt="${item.brand || item.name}">
          </div>
          <div class="invoice-text">
            <button type="button" class="invoice-name">${item.name}</button>
            ${
              item.vitola
                ? `<div class="invoice-meta">${item.vitola}</div>`
                : ""
            }
            ${
              item.brand
                ? `<div class="invoice-meta">${item.brand}</div>`
                : ""
            }
            <div class="invoice-meta">$${formatMoney(item.price)}</div>
          </div>
        </div>
        <div class="invoice-right">
          <div class="invoice-qty-label">QTY</div>
          <div class="invoice-qty-control">
            <button class="invoice-qty-btn" data-dir="-1">−</button>
            <span class="invoice-qty-value">${item.qty}</span>
            <button class="invoice-qty-btn" data-dir="1">+</button>
          </div>
          <div class="invoice-line-total">$${formatMoney(lineTotal)}</div>
        </div>
      `;

      container.appendChild(row);
    });

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    if (subtotalEl) subtotalEl.textContent = `$${formatMoney(subtotal)}`;
    if (taxEl) taxEl.textContent = `$${formatMoney(tax)}`;
    if (totalEl) totalEl.textContent = `$${formatMoney(total)}`;
  }

  function renderAll() {
    renderInvoice();
    updateReceiptBadge();
  }

  function initDateStamp() {
    const dateEl = document.getElementById("invoice-date");
    if (!dateEl) return;

    const d = new Date();
    const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
    const dateStr = d.toLocaleDateString(undefined, {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit"
    });
    const timeStr = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    });

    dateEl.textContent = `${weekday}, ${dateStr} — ${timeStr}`;
  }

  // ---------- Popup open/close ----------

  function initPopup() {
    const pill = document.getElementById("open-receipt");
    const popup = document.getElementById("invoice-popup");
    const closeBtn = document.getElementById("close-receipt");

    if (pill && popup) {
      pill.addEventListener("click", () => {
        popup.classList.add("open");
      });
    }

    if (closeBtn && popup) {
      closeBtn.addEventListener("click", () => {
        popup.classList.remove("open");
      });
    }

    if (popup) {
      popup.addEventListener("click", (e) => {
        if (e.target === popup) {
          popup.classList.remove("open");
        }
      });
    }
  }

  // ---------- Event wiring ----------

  document.addEventListener("DOMContentLoaded", () => {
    initPopup();
    initDateStamp();
    renderAll(); // initial (empty) state

    // Quantity buttons in invoice (delegated)
    const itemsContainer = document.getElementById("invoice-items");
    if (itemsContainer) {
      itemsContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".invoice-qty-btn");
        if (!btn) return;

        const dir = Number(btn.dataset.dir || "0");
        if (!dir) return;

        const row = btn.closest(".invoice-item");
        if (!row) return;

        const id = row.dataset.id;
        if (!id) return;

        changeQty(id, dir);
      });
    }

    // Generic "add to cart" handler:
    // Any element with data-pos-add will use its data-* attrs.
    document.body.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-pos-add]");
      if (!trigger) return;

      e.preventDefault();

      const row = trigger.closest("[data-pos-row]");

      const id =
        (row && row.dataset.id) ||
        trigger.dataset.id ||
        trigger.getAttribute("data-pos-add");

      if (!id) return;

      const payload = {
        id,
        name: (row && row.dataset.name) || trigger.dataset.name || "",
        brand: (row && row.dataset.brand) || trigger.dataset.brand || "",
        vitola: (row && row.dataset.vitola) || trigger.dataset.vitola || "",
        price: Number(
          (row && row.dataset.price) ||
            trigger.dataset.price ||
            trigger.dataset.msrp ||
            0
        ),
        icon:
          (row && row.dataset.icon) ||
          trigger.dataset.icon ||
          "/img/icons/categories/cigars.svg",
        stockEl: trigger.hasAttribute("data-pos-stock") ? trigger : null
      };

      addItem(payload);
    });
  });

  // ---------- Public API (for your brand rows etc.) ----------

  window.POSCart = {
    addItem,
    changeQty,
    getItems() {
      return state.items.map((i) => ({ ...i }));
    }
  };

  // Simple helper if you want to call it manually:
  window.POS_addItem = addItem;
})();
