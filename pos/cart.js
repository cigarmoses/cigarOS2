/* /pos/cart.js
   Global POS cart + invoice badge + add-to-cart wiring (ALL pages)

   Fixes:
   ✅ Green + adds to cart (even if data attrs are missing) via DOM fallback scraping
   ✅ Modal "Add" adds to cart via DOM fallback scraping
   ✅ Invoice badge count updates
   ✅ Invoice icon navigates to /pos/invoice/ (correct view)
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

  function money(n) {
    const x = Number(n || 0);
    return x.toFixed(2);
  }

  function normStr(s) {
    return String(s || "").trim();
  }

  function parsePriceFromText(txt) {
    const t = String(txt || "");
    // matches $59.00, 59.00, 59
    const m = t.match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    if (!m) return 0;
    return Number(m[1] || 0) || 0;
  }

  function getKey(item) {
    // stable key – prefers sku/id else composite
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
    updateBadges(cart);
    document.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: { cart } }));
  }

  function getCartCount(cartMaybe) {
    const cart = cartMaybe || loadCart();
    // total quantity
    return cart.reduce((sum, it) => sum + Number(it.qty || 0), 0);
  }

  function updateBadges(cartMaybe) {
    const cart = cartMaybe || loadCart();
    const count = getCartCount(cart);

    // legacy badge
    const legacy = document.getElementById("receipt-count");
    if (legacy) legacy.textContent = String(count);

    // any badge nodes
    document.querySelectorAll("[data-cart-badge]").forEach((el) => {
      el.textContent = String(count);
    });

    // toggle has-items on invoice button(s)
    document.querySelectorAll("[data-invoice-btn], #invoice-btn, .pos-invoice-btn").forEach((btn) => {
      btn.classList.toggle("has-items", count > 0);
    });
  }

  // -------------------------
  // DOM scrape fallbacks
  // -------------------------
  function scrapeFromCigarRow(btn) {
    // Try to find the row container
    const row =
      btn.closest(".cigar-row") ||
      btn.closest(".cigars-row") ||
      btn.closest(".brand-row") ||
      btn.closest("li") ||
      btn.closest(".row") ||
      btn.closest("[role='listitem']");

    if (!row) return null;

    // Title / vitola / price patterns from your screenshot
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

    // Try to split "Line + Name" if possible (your brand pages often do this)
    // We'll keep it simple: line unknown, name = titleText.
    const item = {
      type: "cigar",
      brand: "",
      line: "",
      name: titleText,
      vitola: vitolaText,
      msrp
    };

    // If row has a brand icon with alt/title
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
    // works if you DO have data attrs
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
  // Invoice icon: always go to correct page
  // -------------------------
  function wireInvoiceNav(root = document) {
    const candidates = [
      ...root.querySelectorAll("[data-invoice-btn], #invoice-btn, .pos-invoice-btn, a[href*='invoice']")
    ];

    candidates.forEach((el) => {
      // If it's a link, fix href
      if (el.tagName === "A") {
        const href = el.getAttribute("href") || "";
        if (href.includes("invoice.html")) el.setAttribute("href", "/pos/invoice/");
      }

      // Add click override to be safe
      el.addEventListener("click", (e) => {
        // allow cmd/ctrl click open new tab if anchor
        if (el.tagName === "A" && (e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        window.location.href = "/pos/invoice/";
      }, { passive: false });
    });
  }

  // -------------------------
  // Global click handler for add buttons
  // -------------------------
  document.addEventListener("click", (e) => {
    // 1) preferred: data-cart-add or data-receipt-item
    let btn = e.target.closest("[data-cart-add], [data-receipt-item]");
    // 2) fallback: common + button classes / aria labels
    if (!btn) {
      btn = e.target.closest(
        ".row-add, .pos-add, .cigar-add, .add-btn, .plus-btn, button[aria-label='Add'], button[title='Add']"
      );
    }

    if (!btn) return;

    // If this is invoice icon/button, let invoice wiring handle it
    if (btn.matches("[data-invoice-btn], #invoice-btn, .pos-invoice-btn")) return;

    // Detect "Add" text in modal
    const btnText = normStr(btn.textContent).toLowerCase();
    const looksLikeAdd =
      btn.hasAttribute("data-cart-add") ||
      btn.hasAttribute("data-receipt-item") ||
      btnText === "+" ||
      btnText.includes("add");

    if (!looksLikeAdd) return;

    // 1) dataset item
    const dsItem = itemFromDataset(btn.dataset);

    // 2) fallback: row scrape
    const rowItem = scrapeFromCigarRow(btn);

    // 3) fallback: modal scrape
    const modalItem = scrapeFromModal(btn);

    const item = dsItem || rowItem || modalItem;
    if (!item || !item.name) return;

    addToCart(item, btn.dataset.qty || 1);
  });

  // -------------------------
  // Init
  // -------------------------
  updateBadges(loadCart());
  wireInvoiceNav(document);

  // If elements mount later, keep wiring
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        wireInvoiceNav(n);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Small global API (optional)
  window.cigarOSCart = window.cigarOSCart || {};
  window.cigarOSCart.add = addToCart;
  window.cigarOSCart.items = () => loadCart();
  window.cigarOSCart.count = () => getCartCount(loadCart());
})();
