// /js/pos.js
// Core POS invoice + cart logic for CigarOS POS

(function () {
  const STORAGE_KEY = "cigaros_pos_cart";
  const TAX_RATE = 0.07; // 7% – change if needed

  // --------------- CART HELPERS -----------------

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (e) {
      console.error("Error reading cart from localStorage", e);
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }

  // Public helper: add item to cart
  // item shape: { id, name, vitola, brand, price, icon, qty }
  function addToCart(item) {
    const cart = getCart();
    const existingIndex = cart.findIndex((i) => i.id === item.id);

    if (existingIndex !== -1) {
      cart[existingIndex].qty += item.qty || 1;
    } else {
      cart.push({
        id: item.id,
        name: item.name,
        vitola: item.vitola || "",
        brand: item.brand || "",
        price: Number(item.price) || 0,
        icon: item.icon || "/img/icons/brands/default.svg",
        qty: item.qty || 1,
      });
    }

    saveCart(cart);
  }

  function clearCart() {
    saveCart([]);
  }

  function formatMoney(value) {
    return value.toFixed(2);
  }

  // expose minimal cart API if you want to use it elsewhere
  window.POSCart = {
    add: addToCart,
    clear: clearCart,
    get: getCart,
  };

  // --------------- INVOICE RENDERING -----------------

  function renderInvoice() {
    const cart = getCart();
    const container = document.getElementById("invoice-items");
    if (!container) return;

    container.innerHTML = "";

    let subtotal = 0;

    if (cart.length === 0) {
      container.innerHTML =
        '<p style="text-align:center; padding:24px 0; opacity:0.6;">No items in invoice.</p>';
    } else {
      cart.forEach((item, index) => {
        const lineTotal = item.price * item.qty;
        subtotal += lineTotal;

        const itemHtml = `
          <div class="invoice-item">
            <div class="invoice-item-icon">
              <img src="${item.icon}" alt="${item.brand}" />
            </div>

            <div class="invoice-item-details">
              <div class="item-name">${item.name}</div>
              <div class="item-sub">${item.vitola || ""}</div>
              <div class="item-sub">${item.brand || ""}</div>
              <div class="item-sub">${formatMoney(item.price)}</div>
            </div>

            <div class="invoice-item-qty" data-index="${index}">
              <div class="qty-label">QTY</div>

              <div class="qty-controls">
                <span class="qty-minus">-</span>
                <span class="qty-value">${item.qty}</span>
                <span class="qty-plus">+</span>
              </div>

              <div class="line-total">${formatMoney(lineTotal)}</div>
            </div>
          </div>
        `;

        container.insertAdjacentHTML("beforeend", itemHtml);
      });
    }

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const elSubtotal = document.getElementById("invoice-subtotal");
    const elTax = document.getElementById("invoice-tax");
    const elTotal = document.getElementById("invoice-total");

    if (elSubtotal) elSubtotal.textContent = formatMoney(subtotal);
    if (elTax) elTax.textContent = formatMoney(tax);
    if (elTotal) elTotal.textContent = formatMoney(total);

    // Set header date/time (ex: Sunday, 11/9/25  6:13 PM)
    const dateEl = document.getElementById("invoice-date");
    if (dateEl) {
      const now = new Date();
      const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
      const date = now.toLocaleDateString();
      const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      dateEl.textContent = `${weekday}, ${date}   ${time}`;
    }
  }

  // --------------- QTY CHANGE HANDLING -----------------

  function changeQty(index, delta) {
    const cart = getCart();
    if (!cart[index]) return;

    cart[index].qty += delta;
    if (cart[index].qty < 1) cart[index].qty = 1;

    saveCart(cart);
    renderInvoice();
  }

  // Attach to window in case you want to call directly
  window.changeQty = changeQty;

  // --------------- UI WIRING -----------------

  function setupInvoiceEvents() {
    const pill = document.getElementById("open-receipt");
    const popup = document.getElementById("invoice-popup");
    const closeBtn = document.getElementById("close-receipt");
    const itemsContainer = document.getElementById("invoice-items");

    if (pill && popup) {
      pill.addEventListener("click", () => {
        popup.classList.add("open");
        renderInvoice();
      });
    }

    if (closeBtn && popup) {
      closeBtn.addEventListener("click", () => {
        popup.classList.remove("open");
      });
    }

    // Optional: close when clicking dark background
    if (popup) {
      popup.addEventListener("click", (e) => {
        if (e.target === popup) {
          popup.classList.remove("open");
        }
      });
    }

    // Event delegation for + / -
    if (itemsContainer) {
      itemsContainer.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

        const qtyContainer = target.closest(".invoice-item-qty");
        if (!qtyContainer) return;

        const index = parseInt(qtyContainer.getAttribute("data-index") || "0", 10);

        if (target.classList.contains("qty-minus")) {
          changeQty(index, -1);
        } else if (target.classList.contains("qty-plus")) {
          changeQty(index, 1);
        }
      });
    }
  }

  // --------------- INIT -----------------

  document.addEventListener("DOMContentLoaded", () => {
    setupInvoiceEvents();
  });
})();
