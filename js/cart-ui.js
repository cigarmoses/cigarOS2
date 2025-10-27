/* =========================================================
   CigarOS Cart UI Helper
   - Mounts a standard cart panel into any module
   - Expects container with these elements:
     #cartItems, #subtotal, #tax, #total, #checkout, #clearCart
   ========================================================= */

(function () {
  function format(n) { return `$${(Math.round(n * 100) / 100).toFixed(2)}`; }

  function mountCartUI({ onCheckout } = {}) {
    const els = {
      host: document.getElementById('cartItems'),
      subtotal: document.getElementById('subtotal'),
      tax: document.getElementById('tax'),
      total: document.getElementById('total'),
      checkout: document.getElementById('checkout'),
      clear: document.getElementById('clearCart')
    };

    function render(snapshot) {
      const { items, subtotal, tax, total } = snapshot;

      if (!items.length) {
        els.host.innerHTML = `<div class="empty">Tap an item to add it to the order.</div>`;
        els.subtotal.textContent = '$0.00';
        els.tax.textContent = '$0.00';
        els.total.textContent = '$0.00';
        els.checkout.disabled = true;
        return;
      }

      els.host.innerHTML = '';
      items.forEach(line => {
        const row = document.createElement('div');
        row.className = 'cart-row';
        const lineTotal = line.price * line.qty;

        row.innerHTML = `
          <img class="cart-thumb" src="${line.icon}" alt="${line.name}" />
          <div class="cart-title">
            <span class="name">${line.name}</span>
            <span class="unit">${format(line.price)} ${line.qty > 1 ? 'ea' : ''}</span>
            <div class="cart-qty">
              <button class="qty-btn" aria-label="decrease">−</button>
              <span class="qty-num">${line.qty}</span>
              <button class="qty-btn" aria-label="increase">+</button>
              <button class="qty-btn" aria-label="remove" title="Remove">×</button>
            </div>
          </div>
          <div class="cart-line-total">${format(lineTotal)}</div>
        `;

        const [decBtn, , incBtn, rmBtn] = row.querySelectorAll('.qty-btn');
        decBtn.addEventListener('click', () => Cart.dec(line.id));
        incBtn.addEventListener('click', () => Cart.inc(line.id));
        rmBtn.addEventListener('click', () => Cart.remove(line.id));

        els.host.appendChild(row);
      });

      els.subtotal.textContent = format(subtotal);
      els.tax.textContent = format(tax);
      els.total.textContent = format(total);
      els.checkout.disabled = false;
    }

    const unsubscribe = Cart.subscribe(render);

    els.clear?.addEventListener('click', () => Cart.clear());
    els.checkout?.addEventListener('click', () => {
      const payload = Cart.getSnapshot();
      if (typeof onCheckout === 'function') onCheckout(payload);
      else alert('Checkout payload:\n' + JSON.stringify(payload, null, 2));
    });

    // expose unmount if needed
    return () => unsubscribe();
  }

  window.CartUI = { mountCartUI };
})();
