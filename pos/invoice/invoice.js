(() => {
  const CART_KEY = "cigaros_pos_cart_v3";
  const TAX = 0.07;

  const $ = (s) => document.querySelector(s);

  function loadCart(){
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  }

  function price(item){
    return Number(item.msrp || item.price || item.cost || 0);
  }

  function fmt(n){
    return `$${n.toFixed(2)}`;
  }

  function render(){
    const cart = loadCart();
    const el = $("#invItems");
    el.innerHTML = "";

    let total = 0;

    cart.forEach(item => {
      const unit = price(item);
      const qty = item.qty || 0;
      const line = unit * qty;
      total += line;

      const row = document.createElement("div");
      row.innerHTML = `
        <div>${item.name}</div>
        <div class="inv-meta-row">
          <div class="inv-msrp">${fmt(unit)}</div>
          <div class="inv-qty-wrap">QTY (${qty})</div>
          <div class="inv-total">${fmt(line)}</div>
        </div>
      `;
      el.appendChild(row);
    });

    const tax = total * TAX;

    $("#tGrand").textContent = fmt(total + tax);
  }

  document.addEventListener("DOMContentLoaded", render);
})();
