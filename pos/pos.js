// /pos/pos.js
// Global cart + invoice helpers + popup wiring

(function () {
  const POS_TAX_RATE = 0.07;

  // Shared cart across POS pages
  const cart = [];
  window.cigarOSCart = cart; // just in case you want to inspect later

  function money(n) {
    return n.toFixed(2);
  }

  function getCartProductCount() {
    // number of distinct products with qty > 0
    return cart.reduce((sum, item) => (item.qty > 0 ? sum + 1 : sum), 0);
  }

  function updateReceiptBadge() {
    const countEl = document.getElementById("receipt-count");
    if (!countEl) return;
    const count = getCartProductCount();
    countEl.textContent = String(count);
  }

  function sanitizeItem(item) {
    return {
      id: item.id,
      name: item.name || "",
      vitola: item.vitola || "",
      brand: item.brand || "",
      price:
        typeof item.price === "number"
          ? item.price
          : (parseFloat(item.price) || 0),
      qty: item.qty && item.qty > 0 ? item.qty : 1,
      icon: item.icon || "/img/icons/categories/cigars.svg",
    };
  }

  function renderInvoice() {
    const container = document.getElementById("invoice-items");
    if (!container) {
      updateReceiptBadge();
      return;
    }

    // Remove any 0-qty items before rendering
    for (let i = cart.length - 1; i >= 0; i--) {
      if (!cart[i] || cart[i].qty <= 0) {
        cart.splice(i, 1);
      }
    }

    container.innerHTML = "";
    let subtotal = 0;

    cart.forEach((item) => {
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
            <div class="invoice-meta">${item.vitola}</div>
            <div class="invoice-meta">${item.brand}</div>
            <div class="invoice-meta">$${money(item.price)}</div>
          </div>
        </div>
        <div class="invoice-right">
          <div class="invoice-qty-label">QTY</div>
          <div class="invoice-qty-control">
            <button class="invoice-qty-btn" data-dir="-1" data-id="${item.id}">−</button>
            <span class="invoice-qty-value">${item.qty}</span>
            <button class="invoice-qty-btn" data-dir="1" data-id="${item.id}">+</button>
          </div>
          <div class="invoice-line-total">$${money(lineTotal)}</div>
        </div>
      `;

      container.appendChild(row);
    });

    const subtotalEl = document.getElementById("invoice-subtotal");
    const taxEl = document.getElementById("invoice-tax");
    const totalEl = document.getElementById("invoice-total");

    const tax = subtotal * POS_TAX_RATE;
    const total = subtotal + tax;

    if (subtotalEl) subtotalEl.textContent = `$${money(subtotal)}`;
    if (taxEl) taxEl.textContent = `$${money(tax)}`;
    if (totalEl) totalEl.textContent = `$${money(total)}`;

    updateReceiptBadge();
  }

  function updateCartQty(id, delta) {
    const idx = cart.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const item = cart[idx];
    item.qty += delta;
    if (item.qty <= 0) {
      // When qty hits zero, remove the product from the receipt
      cart.splice(idx, 1);
    }
    renderInvoice();
  }

  // Public function: add one (or more) items to invoice
  function addToInvoice(item) {
    if (!item || !item.id) return;

    const clean = sanitizeItem(item);
    const existing = cart.find((i) => i.id === clean.id);

    if (existing) {
      existing.qty += clean.qty;
    } else {
      cart.push(clean);
    }
    renderInvoice();
  }

  // Expose helpers
  window.addToInvoice = addToInvoice;
  window.renderInvoice = renderInvoice;

  // Initialize invoice date & qty button handlers
  function initInvoice() {
    const dateEl = document.getElementById("invoice-date");
    if (dateEl) {
      const d = new Date();
      const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
      const dateStr = d.toLocaleDateString(undefined, {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
      });
      const timeStr = d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      dateEl.textContent = `${weekday}, ${dateStr} — ${timeStr}`;
    }

    const container = document.getElementById("invoice-items");
    if (container && !container.__cigarOSBound) {
      container.__cigarOSBound = true;

      container.addEventListener("click", (e) => {
        const btn = e.target.closest(".invoice-qty-btn");
        if (!btn) return;
        const id = btn.dataset.id;
        const dir = Number(btn.dataset.dir || "0");
        if (!id || !dir) return;
        updateCartQty(id, dir);
      });
    }

    renderInvoice();
  }

  window.initInvoice = initInvoice;
})();

// Popup open/close wiring + initInvoice call + POS contacts dropdown
document.addEventListener("DOMContentLoaded", () => {
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

  if (typeof window.initInvoice === "function") {
    window.initInvoice();
  }

  // -----------------------
  // Loyalty contacts wiring
  // -----------------------

  const customerSelect = document.getElementById("receipt-customer");
  const customerSearchInput = document.getElementById("receipt-customer-search");

  let allContacts = [];

  // JSON version of your pos-contacts.xlsx (generated at build time)
  const CONTACTS_URL = "/pos/pos-contacts.json";

  function normalizePhone(value) {
    if (!value) return "";
    return String(value).replace(/\D+/g, "");
  }

  function formatContactLabel(contact) {
    const parts = [];

    const first = contact.first_name || "";
    const last = contact.last_name || "";
    const name = `${first} ${last}`.trim();

    if (name) parts.push(name);
    if (contact.phone) parts.push(contact.phone);
    if (contact.email) parts.push(contact.email);

    if (!parts.length && contact.customer_id != null) {
      parts.push(`Customer #${contact.customer_id}`);
    }

    return parts.join(" • ");
  }

  function renderCustomerOptions(contacts) {
    if (!customerSelect) return;

    customerSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Attach customer (optional)";
    customerSelect.appendChild(placeholder);

    contacts.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.customer_id;
      opt.textContent = formatContactLabel(c);
      customerSelect.appendChild(opt);
    });
  }

  function filterContacts(term) {
    if (!term) return allContacts;

    const search = term.toLowerCase().trim();
    const numeric = normalizePhone(term);

    return allContacts.filter((c) => {
      const first = (c.first_name || "").toLowerCase();
      const last = (c.last_name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phoneNorm = normalizePhone(c.phone || "");

      const nameMatch = first.includes(search) || last.includes(search);
      const emailMatch = email.includes(search);
      const phoneMatch = numeric && phoneNorm.includes(numeric);

      return nameMatch || emailMatch || phoneMatch;
    });
  }

  async function loadContacts() {
    // If there is no UI for contacts on this page, we can still safely try; it just won't render.
    try {
      const res = await fetch(CONTACTS_URL);
      if (!res.ok) {
        console.error("Failed to load contacts JSON:", res.status, res.statusText);
        return;
      }

      const data = await res.json();
      // Keep only active contacts by default (active !== false)
      allContacts = (data || []).filter((c) => c.active !== false);
      renderCustomerOptions(allContacts);
    } catch (err) {
      console.error("Error loading contacts:", err);
    }
  }

  if (customerSearchInput) {
    customerSearchInput.addEventListener("input", (e) => {
      const term = e.target.value || "";
      const filtered = filterContacts(term);
      renderCustomerOptions(filtered);
    });
  }

  if (customerSelect) {
    customerSelect.addEventListener("change", (e) => {
      const selectedId = e.target.value || "";

      // Attach to current invoice if you’re tracking it globally
      if (window.currentInvoice) {
        window.currentInvoice.customer_id = selectedId || null;
      }

      // Example: you could also look up the contact here
      // const chosen = allContacts.find(
      //   (c) => String(c.customer_id) === String(selectedId)
      // );
      // if (chosen) {
      //   // Show rewards_points, locker_number, etc.
      // }
    });
  }

  // Kick off loading contacts
  if (customerSelect || customerSearchInput) {
    loadContacts();
  }
});
