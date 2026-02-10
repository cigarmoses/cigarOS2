/* /pos/cart.js
   Global POS cart + invoice badge + add-to-cart wiring (ALL pages)

   Fixes:
   ✅ CAPTURE click handler so stopPropagation can't block add-to-cart
   ✅ Writes cart to localStorage (cigaros_pos_cart_v3)
   ✅ Also mirrors to legacy window.cigarOSCart ARRAY if it exists (pos.js compatibility)
   ✅ Invoice icon navigates to /pos/invoice/
*/

(() => {
  "use strict";

  const CART_KEY = "cigaros_pos_cart_v3";

  // -------------------------
  // helpers
  // -------------------------
  function safeJSONParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function loadCart() {
    return safeJSONParse(localStorage.getItem(CART_KEY), []) || [];
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function normStr(s) {
    return String(s || "").trim();
  }

  function parsePriceFromText(txt) {
    const t = String(txt || "");
    const m = t.match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    if (!m) return 0;
    return Number(m[1] || 0) || 0;
  }

  function getKey(item) {
    const sku = normStr(item.sku || item.id);
    if (sku) return sku.toLowerCase();

    const parts = [
      item.type || "cigar",
      item.brand || "",
      item.line || "",
      item.name || "",
      item.vitola || ""
    ].map((x) => normStr(x).toLowerCase());

    return parts.join("|");
  }

  // Distinct item count (qty > 0)
  function getCartCount(cartMaybe) {
    const cart = cartMaybe || loadCart();
    return cart.reduce((sum, it) => (Number(it?.qty || 0) > 0 ? sum + 1 : sum), 0);
  }

  function updateBadges(cartMaybe) {
    const cart = cartMaybe || loadCart();
    const count = getCartCount(cart);

    const legacy = document.getElementById("receipt-count");
    if (legacy) legacy.textContent = String(count);

    document.querySelectorAll("[data-cart-badge]").forEach((el) => {
      el.textContent = String(count);
    });

    document.querySelectorAll("[data-invoice-btn], #invoice-btn, .pos-invoice-btn").forEach((btn) => {
      btn.classList.toggle("has-items", count > 0);
    });
  }

  // -------------------------
  // legacy bridge (pos.js used window.cigarOSCart = [])
  // -------------------------
  function mirrorToLegacyArray(cart) {
    // If some other script set window.cigarOSCart as an array, keep it updated
    if (Array.isArray(window.cigarOSCart)) {
      window.cigarOSCart.length = 0;
      for (const it of cart) window.cigarOSCart.push(it);
    }
  }

  function addToCart(item, qtyToAdd = 1) {
    const cart = loadCart();
    const qtyAdd = Math.max(1, Number(qtyToAdd || 1));
    const price = Number(item.msrp || item.price || 0) || 0;

    const normalized = {
      type: item.type || "cigar",
      id: item.id || "",
      sku: item.sku || "",
      brand: normStr(item.brand),
      line: normStr(item.line),
      name: normStr(item.name),
      vitola: normStr(item.vitola),
      msrp: price,
      image: normStr(item.image)
    };

    const key = getKey(normalized);

    const existing = cart.find((x) => x.key === key);
    if (existing) {
      existing.qty = Number(existing.qty || 0) + qtyAdd;
      existing.type = normalized.type;
      existing.brand = normalized.brand;
      existing.line = normalized.line;
      existing.name = normalized.name;
      existing.vitola = normalized.vitola;
      existing.msrp = normalized.msrp;
      existing.image = normalized.image;
    } else {
      cart.push({ key, qty: qtyAdd, ...normalized });
    }

    saveCart(cart);
    mirrorToLegacyArray(cart);
    updateBadges(cart);

    document.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: { cart } }));
  }

  // -------------------------
  // DOM scrape fallbacks
  // -------------------------
  function scrapeFromCigarRow(btn) {
    const row =
      btn.closest(".cigar-row") ||
      btn.closest(".cigars-row") ||
      btn.closest(".brand-row") ||
      btn.closest("li") ||
      btn.closest(".row") ||
      btn.closest("[role='listitem']");

    if (!row) return null;

    const titleEl =
      row.querySelector(".cigar-title") ||
      row.querySelector(".row-title") ||
      row.querySelector("h3") ||
      row.querySelector("h2") ||
      row.querySelector(".title") ||
      row.querySelector("strong");

    const vitolaEl =
      row.querySelector(".cigar-subtitle") ||
      row.querySelector(".row-sub") ||
      row.querySelector(".subtitle") ||
      row.querySelector(".sub") ||
      row.querySelector("small");

    const priceEl =
      row.querySelector(".cigar-price") ||
      row.querySelector(".row-price") ||
      row.querySelector(".price") ||
      row.querySelector("[data-price]");

    const titleText = normStr(titleEl ? titleEl.textContent : row.textContent);
    const vitolaText = normStr(vitolaEl ? vitolaEl.textContent : "");
    const priceText = normStr(priceEl ? (priceEl.getAttribute("data-price") || priceEl.textContent) : "");

    const msrp = priceText ? parsePriceFromText(priceText) : parsePriceFromText(row.textContent);

    const item = {
      type: "cigar",
      brand: "",
      line: "",
      name: titleText,
      vitola: vitolaText,
      msrp
    };

    const img = row.querySelector("img");
    if (img) {
      item.image = img.getAttribute("src") || "";
      const alt = normStr(img.getAttribute("alt") || img.getAttribute("title") || "");
      if (alt && !item.brand) item.brand = alt;
    }

    return item.name ? item : null;
  }

  function scrapeFromModal(btn) {
    const modal =
      btn.closest(".modal") ||
      btn.closest(".pos-modal") ||
      btn.closest(".cigar-modal") ||
      document.querySelector(".modal.open, .pos-modal.open, .cigar-modal.open");

    if (!modal) return null;

    const nameEl =
      modal.querySelector(".cigar-name") ||
      modal.querySelector(".modal-title") ||
      modal.querySelector("h2") ||
      modal.querySelector("h3");

    const vitolaEl =
      modal.querySelector(".cigar-vitola") ||
      modal.querySelector(".modal-subtitle") ||
      modal.querySelector(".subtitle");

    const priceEl =
      modal.querySelector(".cigar-msrp") ||
      modal.querySelector(".modal-price") ||
      modal.querySelector(".price");

    const name = normStr(nameEl ? nameEl.textContent : "");
    const vitola = normStr(vitolaEl ? vitolaEl.textContent : "");
    const msrp = parsePriceFromText(priceEl ? priceEl.textContent : modal.textContent);

    return name ? { type: "cigar", brand: "", line: "", name, vitola, msrp } : null;
  }

  function itemFromDataset(ds) {
    const name = normStr(ds.name || ds.cigar || "");
    const brand = normStr(ds.brand || "");
    const line = normStr(ds.line || "");
    const vitola = normStr(ds.vitola || "");
    const msrp = Number(ds.msrp || ds.price || 0) || 0;

    if (!name && !brand) return null;

    return {
      type: ds.type || "cigar",
      id: ds.id || "",
      sku: ds.sku || "",
      brand,
      line,
      name: name || brand,
      vitola,
      msrp,
      image: ds.image || ""
    };
  }

  // -------------------------
  // Invoice nav
  // -------------------------
  function wireInvoiceNav(root = document) {
    const candidates = [
      ...root.querySelectorAll("[data-invoice-btn], #invoice-btn, .pos-invoice-btn, a[href*='invoice']")
    ];

    candidates.forEach((el) => {
      if (el.__invoiceNavBound) return;
      el.__invoiceNavBound = true;

      if (el.tagName === "A") {
        const href = el.getAttribute("href") || "";
        if (href.includes("invoice.html")) el.setAttribute("href", "/pos/invoice/");
      }

      el.addEventListener("click", (e) => {
        if (el.tagName === "A" && (e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        window.location.href = "/pos/invoice/";
      }, { passive: false });
    });
  }

  // -------------------------
  // Add-to-cart handler (CAPTURE ✅)
  // -------------------------
  function handleAddClick(e) {
    let btn = e.target.closest("[data-cart-add], [data-receipt-item]");
    if (!btn) {
      btn = e.target.closest(
        ".row-add, .pos-add, .cigar-add, .add-btn, .plus-btn, button[aria-label='Add'], button[title='Add']"
      );
    }
    if (!btn) return;

    if (btn.matches("[data-invoice-btn], #invoice-btn, .pos-invoice-btn")) return;

    const btnText = normStr(btn.textContent).toLowerCase();
    const looksLikeAdd =
      btn.hasAttribute("data-cart-add") ||
      btn.hasAttribute("data-receipt-item") ||
      btnText === "+" ||
      btnText.includes("add");

    if (!looksLikeAdd) return;

    const dsItem = itemFromDataset(btn.dataset);
    const rowItem = scrapeFromCigarRow(btn);
    const modalItem = scrapeFromModal(btn);

    const item = dsItem || rowItem || modalItem;
    if (!item || !item.name) return;

    addToCart(item, btn.dataset.qty || 1);
  }

  document.addEventListener("click", handleAddClick, true);

  // -------------------------
  // Init
  // -------------------------
  const initial = loadCart();
  mirrorToLegacyArray(initial);
  updateBadges(initial);
  wireInvoiceNav(document);

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        wireInvoiceNav(n);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Expose API without breaking legacy array
  if (!Array.isArray(window.cigarOSCart)) {
    window.cigarOSCart = window.cigarOSCart || {};
    window.cigarOSCart.add = addToCart;
    window.cigarOSCart.items = () => loadCart();
    window.cigarOSCart.count = () => getCartCount(loadCart());
  }
})();
