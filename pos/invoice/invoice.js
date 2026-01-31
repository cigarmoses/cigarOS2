/* /pos/invoice/invoice.js
   Renders invoice list from CigarOSCart (localStorage)

   ✅ Cigar rows:
      t1 = "Cigars - {brand}"
      t2 = "{name}" (line+name)
      t3 = "{sub}"  (vitola)

   ✅ Other rows:
      t1 = "{category}"
      t2 = "{brand}" (or "-" if missing)
      t3 = "{name}"
*/

(() => {
  "use strict";

  const $ = (sel, root=document) => root.querySelector(sel);

  const itemsEl = $("#invItems");
  const metaEl  = $("#invMeta");
  const shopEl  = $("#invShop");
  const numEl   = $("#invNum");

  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

  function nowStamp() {
    const d = new Date();
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const day = days[d.getDay()];
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    const yyyy = d.getFullYear();
    let h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    const min = String(d.getMinutes()).padStart(2,"0");
    return `${day}  ${mm}/${dd}/${yyyy}  ${h}:${min} ${ampm}`;
  }

  function iconFor(item) {
    // If you later store img in cart, use it. Otherwise fallback.
    if (item.img) return item.img;

    // Basic category fallback icons (safe)
    const c = String(item.category||"").toLowerCase();
    if (c.includes("cigar")) return "/img/icons/categories/cigars.png";
    if (c.includes("accessor")) return "/img/icons/categories/accessories.png";
    if (c.includes("ash")) return "/img/icons/categories/ashtrays.png";
    if (c.includes("pipe")) return "/img/icons/categories/pipes.png";
    if (c.includes("food")) return "/img/icons/categories/foodandbevs.png";
    return "/img/icons/categories/other.png";
  }

  function buildRow(item) {
    const isCigar =
      String(item.type||"").toLowerCase() === "cigar" ||
      String(item.category||"").toLowerCase().includes("cigar");

    // TEXT RULES (your spec)
    let t1, t2, t3;

    if (isCigar) {
      const brand = item.brand ? String(item.brand) : "";
      t1 = brand ? `Cigars - ${brand}` : "Cigars";
      t2 = String(item.name || "Cigar");
      t3 = String(item.sub || "");
    } else {
      t1 = String(item.category || "Other");
      t2 = String(item.brand || "-");
      t3 = String(item.name || "Item");
    }

    const unit = Number(item.price || 0);
    const qty  = Number(item.qty || 0);
    const total = unit * qty;

    const row = document.createElement("article");
    row.className = "inv-row";

    row.innerHTML = `
      <div class="inv-icon"><img alt="" loading="lazy" decoding="async"></div>

      <div class="inv-desc">
        <div class="t1"></div>
        <div class="t2"></div>
        <div class="t3"></div>
      </div>

      <div class="inv-unit">${fmt(unit)}</div>

      <div class="inv-qty" aria-label="Quantity">
        <button class="dec" type="button" aria-label="Decrease">−</button>
        <div class="qnum">${qty}</div>
        <button class="inc" type="button" aria-label="Increase">+</button>
      </div>

      <div class="inv-total">${fmt(total)}</div>
    `;

    const img = row.querySelector(".inv-icon img");
    img.src = iconFor(item);

    row.querySelector(".t1").textContent = t1;
    row.querySelector(".t2").textContent = t2;
    row.querySelector(".t3").textContent = t3;

    row.querySelector(".dec").addEventListener("click", () => {
      window.CigarOSCart.setQty(item.id, qty - 1);
      render();
    });
    row.querySelector(".inc").addEventListener("click", () => {
      window.CigarOSCart.setQty(item.id, qty + 1);
      render();
    });

    return row;
  }

  function computeBuckets(cart) {
    let tobacco = 0, alcohol = 0, other = 0;

    for (const it of cart) {
      const line = Number(it.price||0) * Number(it.qty||0);
      const bucket = String(it.bucket || it.category || "").toLowerCase();

      // If you later store bucket explicitly, it’ll work automatically.
      if (bucket.includes("tobacco") || bucket.includes("cigar") || String(it.category||"").toLowerCase().includes("cigar")) {
        tobacco += line;
      } else if (bucket.includes("alcohol")) {
        alcohol += line;
      } else {
        other += line;
      }
    }

    const subtotal = tobacco + alcohol + other;
    const tax = 0; // keep 0 unless you’re applying tax rules here
    const grand = subtotal + tax;

    return { tobacco, alcohol, other, subtotal, tax, grand };
  }

  function render() {
    const cart = window.CigarOSCart?.cart || [];

    // header
    metaEl.textContent = nowStamp();
    shopEl.textContent = window.CigarOSCart?.getShopName?.() || "Shop";
    numEl.textContent  = `INV# ${window.CigarOSCart?.getInvoiceNumber?.() || "—"}`;

    // items
    itemsEl.innerHTML = "";

    if (!cart.length) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "No items yet.";
      itemsEl.appendChild(empty);
    } else {
      for (const it of cart) itemsEl.appendChild(buildRow(it));
    }

    // totals
    const t = computeBuckets(cart);
    $("#tTobacco").textContent  = fmt(t.tobacco);
    $("#tAlcohol").textContent  = fmt(t.alcohol);
    $("#tOther").textContent    = fmt(t.other);
    $("#tSubtotal").textContent = fmt(t.subtotal);
    $("#tTax").textContent      = fmt(t.tax);
    $("#tGrand").textContent    = fmt(t.grand);
  }

  window.addEventListener("cigaros:cart", render);

  document.addEventListener("DOMContentLoaded", () => {
    // Make sure cart.js loaded
    if (!window.CigarOSCart) {
      console.error("[invoice.js] CigarOSCart missing. Did /pos/cart.js load?");
      return;
    }
    render();
  });
})();
