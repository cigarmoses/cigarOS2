/* /pos/invoice/invoice.js
   Renders the “INVOICE FINAL” mobile layout using the shared cart (cart.js)

   ✅ No horizontal scroll
   ✅ Wraps text (never ellipsis)
   ✅ Cigar row formatting:
      Line 1: "Cigars - {brand}"
      Line 2: "{name}" (line + cigar)
      Line 3: "{sub}" (vitola)
   ✅ Other categories formatting:
      Line 1: "{category}"
      Line 2: "{brand or '-'}"
      Line 3: "{name}"
*/

(() => {
  "use strict";

  const TAX_RATE = 0.07; // matches your screenshots

  const $ = (sel, root = document) => root.querySelector(sel);

  const els = {
    date: $("#invDate"),
    shop: $("#invShop"),
    inv: $("#invNumber"),
    list: $("#invList"),
    totTobacco: $("#totTobacco"),
    totAlcohol: $("#totAlcohol"),
    totOther: $("#totOther"),
    totSubtotal: $("#totSubtotal"),
    totTax: $("#totTax"),
    totGrand: $("#totGrand"),
    attach: $("#attachCustomer"),
    draft: $("#btnDraft"),
    cash: $("#btnCashOut"),
  };

  const safeJSON = (str, fallback) => {
    try { return JSON.parse(str); } catch { return fallback; }
  };

  const CART_KEY = "cigaros_pos_cart_v3";

  const money = (n) => {
    const v = Number(n || 0);
    return `$${(isFinite(v) ? v : 0).toFixed(2)}`;
  };

  const norm = (s) => String(s ?? "").trim();

  const slugify = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

  function getCart() {
    // Prefer API if present, fallback to localStorage
    if (window.CigarOSCart && Array.isArray(window.CigarOSCart.cart)) {
      return window.CigarOSCart.cart;
    }
    return safeJSON(localStorage.getItem(CART_KEY) || "[]", []);
  }

  function setQty(id, qty) {
    if (window.CigarOSCart && typeof window.CigarOSCart.setQty === "function") {
      window.CigarOSCart.setQty(id, qty);
    } else {
      // fallback
      const cart = getCart();
      const it = cart.find(x => x.id === id);
      if (!it) return;
      const q = Number(qty);
      const next = (!isFinite(q) || q <= 0) ? cart.filter(x => x.id !== id) : cart.map(x => x.id === id ? { ...x, qty:q } : x);
      localStorage.setItem(CART_KEY, JSON.stringify(next));
    }
  }

  function getShopName() {
    if (window.CigarOSCart && typeof window.CigarOSCart.getShopName === "function") {
      return window.CigarOSCart.getShopName();
    }
    return localStorage.getItem("cigaros_pos_shop_name") || "Smoke Cigar Shop";
  }

  function getInvoiceNumber() {
    if (window.CigarOSCart && typeof window.CigarOSCart.getInvoiceNumber === "function") {
      return window.CigarOSCart.getInvoiceNumber();
    }
    return localStorage.getItem("cigaros_pos_invoice_number") || "123456";
  }

  function formatHeaderDate(d = new Date()) {
    const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
    const day = days[d.getDay()];
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    const yyyy = String(d.getFullYear());
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2,"0");
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    return `${day}  ${mm}/${dd}/${yyyy}  ${h}:${m} ${ap}`;
  }

  function classifyBucket(item) {
    // If you later add item.bucket to cart, we honor it
    const bucket = norm(item.bucket).toLowerCase();
    if (bucket === "tobacco") return "tobacco";
    if (bucket === "alcohol") return "alcohol";
    if (bucket === "other") return "other";

    // Otherwise infer: cigars + tobacco categories -> tobacco, everything else -> other
    const cat = norm(item.category).toLowerCase();
    const type = norm(item.type).toLowerCase();
    if (type === "cigar" || cat.includes("cigar")) return "tobacco";
    return "other";
  }

  function iconForItem(item) {
    const cat = norm(item.category);
    const brand = norm(item.brand);
    const name = norm(item.name);

    // Cigars: brand icon from /img/icons/brands (plural)
    if (cat.toLowerCase().includes("cigar")) {
      const b = slugify(brand || "cigars");
      return `/img/icons/brands/${b}.svg`;
    }

    // Otherwise: /img/icons/<categorySlug>/<productSlug>.svg
    const catSlug = slugify(cat);
    const prodSlug = slugify(name);
    if (!catSlug || !prodSlug) return "";
    return `/img/icons/${catSlug}/${prodSlug}.svg`;
  }

  function makeIconCell(item) {
    const wrap = document.createElement("div");
    wrap.className = "inv-icon";

    const src = iconForItem(item);
    if (!src) {
      const fallback = document.createElement("span");
      fallback.textContent = (norm(item.name || item.category || "X")[0] || "X").toUpperCase();
      wrap.appendChild(fallback);
      return wrap;
    }

    const img = document.createElement("img");
    img.alt = norm(item.name || item.category || "Item");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = src;

    img.onerror = () => {
      img.remove();
      const fallback = document.createElement("span");
      fallback.textContent = (norm(item.name || item.category || "X")[0] || "X").toUpperCase();
      wrap.appendChild(fallback);
    };

    wrap.appendChild(img);
    return wrap;
  }

  function makeRow(item) {
    const q = Number(item.qty || 0);
    const unit = Number(item.price || 0);
    const line = unit * q;

    const row = document.createElement("article");
    row.className = "inv-row";
    row.dataset.id = item.id;

    // icon
    row.appendChild(makeIconCell(item));

    // desc
    const desc = document.createElement("div");
    desc.className = "inv-desc";

    const cat = norm(item.category);
    const brand = norm(item.brand);
    const name = norm(item.name);
    const sub = norm(item.sub);

    const l1 = document.createElement("div");
    l1.className = "l1";

    const l2 = document.createElement("div");
    l2.className = "l2";

    const l3 = document.createElement("div");
    l3.className = "l3";

    // CIGAR formatting
    if (cat.toLowerCase().includes("cigar")) {
      l1.textContent = `Cigars - ${brand || "Cigars"}`;
      l2.textContent = name || "Cigar";
      l3.textContent = sub || "";
    } else {
      l1.textContent = cat || "Item";
      l2.textContent = brand || "-";
      l3.textContent = name || "Product";
    }

    desc.append(l1, l2, l3);

    // unit
    const unitEl = document.createElement("div");
    unitEl.className = "inv-unit";
    unitEl.textContent = money(unit);

    // qty
    const qty = document.createElement("div");
    qty.className = "inv-qty";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setQty(item.id, Math.max(0, q - 1));
      render();
    });

    const num = document.createElement("div");
    num.className = "n";
    num.textContent = String(q);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setQty(item.id, q + 1);
      render();
    });

    qty.append(minus, num, plus);

    // total
    const totalEl = document.createElement("div");
    totalEl.className = "inv-total";
    totalEl.textContent = money(line);

    row.append(desc, unitEl, qty, totalEl);
    return row;
  }

  function computeTotals(cart) {
    let tobacco = 0, alcohol = 0, other = 0, subtotal = 0;

    for (const it of cart) {
      const q = Number(it.qty || 0);
      const unit = Number(it.price || 0);
      const line = unit * q;
      subtotal += line;

      const bucket = classifyBucket(it);
      if (bucket === "tobacco") tobacco += line;
      else if (bucket === "alcohol") alcohol += line;
      else other += line;
    }

    const tax = subtotal * TAX_RATE;
    const grand = subtotal + tax;

    return { tobacco, alcohol, other, subtotal, tax, grand };
  }

  function renderHeader() {
    els.date.textContent = formatHeaderDate(new Date());
    els.shop.textContent = getShopName().toUpperCase();
    els.inv.textContent = `INV# ${String(getInvoiceNumber()).toUpperCase()}`;
  }

  function renderList(cart) {
    els.list.innerHTML = "";

    if (!cart.length) {
      const empty = document.createElement("div");
      empty.style.padding = "18px 6px";
      empty.style.opacity = ".65";
      empty.style.fontWeight = "800";
      empty.textContent = "No items yet.";
      els.list.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const it of cart) frag.appendChild(makeRow(it));
    els.list.appendChild(frag);
  }

  function renderTotals(cart) {
    const t = computeTotals(cart);
    els.totTobacco.textContent = money(t.tobacco);
    els.totAlcohol.textContent = money(t.alcohol);
    els.totOther.textContent = money(t.other);
    els.totSubtotal.textContent = money(t.subtotal);
    els.totTax.textContent = money(t.tax);
    els.totGrand.textContent = money(t.grand);
  }

  function render() {
    const cart = getCart();
    renderHeader();
    renderList(cart);
    renderTotals(cart);
  }

  function wireActions() {
    // Placeholder hooks (so you can wire later)
    els.attach?.addEventListener("click", () => {
      alert("Attach Saved Customer (hook this to your saved customer DB)");
    });

    els.draft?.addEventListener("click", () => {
      alert("Save as Draft (hook this to your draft logic)");
    });

    els.cash?.addEventListener("click", () => {
      alert("Cash Out (hook this to checkout)");
    });
  }

  // Live update if cart changes (cart.js dispatches this)
  window.addEventListener("cigaros:cart", () => render());

  document.addEventListener("DOMContentLoaded", () => {
    wireActions();
    render();
  });

})();
