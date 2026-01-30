/* /pos/invoice/invoice.js
   Renders invoice from window.CigarOSCart (localStorage)
*/

(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const money = (n) => {
    const v = Number(n);
    if (!isFinite(v)) return "0.00";
    return v.toFixed(2);
  };

  function formatDate(d) {
    try {
      return d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric", year:"numeric" });
    } catch {
      return "";
    }
  }

  function lineId(it) {
    return String(it.id || "").trim();
  }

  function render() {
    if (!window.CigarOSCart) return;

    const cart = window.CigarOSCart.cart || [];
    const shop = window.CigarOSCart.getShopName?.() || "Shop";
    const inv = window.CigarOSCart.getInvoiceNumber?.() || "";

    $("#invShop").textContent = shop;
    $("#invDate").textContent = formatDate(new Date());
    $("#invNum").textContent = `INV# ${inv}`;

    const itemsEl = $("#invItems");
    itemsEl.innerHTML = "";

    if (!cart.length) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.id = "invEmpty";
      empty.textContent = "No items yet.";
      itemsEl.appendChild(empty);
    } else {
      cart.forEach((it) => {
        const row = document.createElement("div");
        row.className = "inv-line";

        const left = document.createElement("div");
        const name = document.createElement("div");
        name.className = "inv-name";
        name.textContent = it.name || "Item";

        const sub = document.createElement("div");
        sub.className = "inv-sub";
        const parts = [];
        if (it.category) parts.push(it.category);
        if (it.brand) parts.push(it.brand);
        if (it.sub) parts.push(it.sub);
        sub.textContent = parts.join(" • ");

        left.appendChild(name);
        left.appendChild(sub);

        const right = document.createElement("div");

        const qty = document.createElement("div");
        qty.className = "inv-qty";

        const minus = document.createElement("button");
        minus.type = "button";
        minus.textContent = "−";
        minus.addEventListener("click", () => {
          const q = (Number(it.qty) || 1) - 1;
          window.CigarOSCart.setQty(lineId(it), q);
          render();
        });

        const n = document.createElement("div");
        n.className = "n";
        n.textContent = String(Number(it.qty) || 1);

        const plus = document.createElement("button");
        plus.type = "button";
        plus.textContent = "+";
        plus.addEventListener("click", () => {
          const q = (Number(it.qty) || 1) + 1;
          window.CigarOSCart.setQty(lineId(it), q);
          render();
        });

        qty.appendChild(minus);
        qty.appendChild(n);
        qty.appendChild(plus);

        const price = document.createElement("div");
        price.className = "inv-price";
        const lineTotal = (Number(it.price) || 0) * (Number(it.qty) || 0);
        price.textContent = `$${money(lineTotal)}`;

        right.appendChild(qty);
        right.appendChild(price);

        row.appendChild(left);
        row.appendChild(right);
        itemsEl.appendChild(row);
      });
    }

    // Totals (tax is currently 0 here; if you want 7% we can wire it next)
    const subtotal = cart.reduce((a, it) => a + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
    const tax = 0;
    const total = subtotal + tax;

    $("#invSubtotal").textContent = `$${money(subtotal)}`;
    $("#invTax").textContent = `$${money(tax)}`;
    $("#invTotal").textContent = `$${money(total)}`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const clearBtn = document.getElementById("invClear");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        window.CigarOSCart?.clear?.();
        render();
      });
    }

    render();

    // live update if cart changes in same page session
    window.addEventListener("cigaros:cart", () => render());
  });
})();
