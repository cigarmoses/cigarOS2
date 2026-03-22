/* /pos/cart.js
   Universal POS cart + invoice badge + invoice navigation

   - Persists cart in localStorage
   - Universal invoice icon support across all POS pages
   - More forgiving add-to-cart detection
   - Updates all cart badges
   - Routes invoice button clicks to /pos/invoice/
*/

(() => {
  "use strict";

  const CART_KEY = "cigaros_pos_cart_v3";

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

  function toAbsUrl(url) {
    const u = normStr(url);
    if (!u) return "";
    try {
      return new URL(u, window.location.origin).href;
    } catch {
      return u;
    }
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

  function getCartCount(cartMaybe) {
    const cart = cartMaybe || loadCart();
    return cart.reduce((sum, it) => sum + Math.max(0, Number(it?.qty || 0)), 0);
  }

  function updateBadges(cartMaybe) {
    const cart = cartMaybe || loadCart();
    const count = getCartCount(cart);

    const legacy = document.getElementById("receipt-count");
    if (legacy) legacy.textContent = String(count);

    document.querySelectorAll("[data-cart-badge]").forEach((el) => {
      el.textContent = String(count);
      el.hidden = count <= 0;
    });

    document.querySelectorAll("[data-invoice-btn], #invoice-btn, .pos-invoice-btn").forEach((btn) => {
      btn.classList.toggle("has-items", count > 0);
      btn.setAttribute("data-cart-count", String(count));
    });
  }

  function mirrorToLegacyArray(cart) {
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
      image: normStr(item.image),
      url: toAbsUrl(item.url || item.href || item.link || "")
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
      if (normalized.url) existing.url = normalized.url;
    } else {
      cart.push({ key, qty: qtyAdd, ...normalized });
    }

    saveCart(cart);
    mirrorToLegacyArray(cart);
    updateBadges(cart);

    document.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: { cart } }));
    window.dispatchEvent(new CustomEvent("cigaros:cart", { detail: { cart } }));
  }

  function findBestRowLink(row) {
    if (!row) return "";

    const preferred =
      row.querySelector(".cigar-title a[href]") ||
      row.querySelector(".row-title a[href]") ||
      row.querySelector(".title a[href]") ||
      row.querySelector("h3 a[href]") ||
      row.querySelector("h2 a[href]") ||
      row.querySelector("a[data-cigar-link][href]") ||
      row.querySelector("a[href]");

    if (!preferred) return "";
    return toAbsUrl(preferred.getAttribute("href") || "");
  }

  function scrapeFromCigarRow(btn) {
    const row =
      btn.closest(".cigar-row") ||
      btn.closest(".cigars-row") ||
      btn.closest(".brand-row") ||
      btn.closest(".product-row") ||
      btn.closest(".menu-row") ||
      btn.closest(".item-row") ||
      btn.closest("li") ||
      btn.closest(".row") ||
      btn.closest("[role='listitem']");

    if (!row) return null;

    const titleEl =
      row.querySelector(".cigar-title") ||
      row.querySelector(".row-title") ||
      row.querySelector(".product-title") ||
      row.querySelector(".item-title") ||
      row.querySelector("h3") ||
      row.querySelector("h2") ||
      row.querySelector(".title") ||
      row.querySelector("strong");

    const vitolaEl =
      row.querySelector(".cigar-subtitle") ||
      row.querySelector(".row-sub") ||
      row.querySelector(".product-subtitle") ||
      row.querySelector(".item-subtitle") ||
      row.querySelector(".subtitle") ||
      row.querySelector(".sub") ||
      row.querySelector("small");

    const priceEl =
      row.querySelector(".cigar-price") ||
      row.querySelector(".row-price") ||
      row.querySelector(".product-price") ||
      row.querySelector(".item-price") ||
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
      msrp,
      url: findBestRowLink(row)
    };

    const img = row.querySelector("img");
    if (img) {
      item.image = img.getAttribute("src") || "";
      const alt = normStr(img.getAttribute("alt") || img.getAttribute("title") || "");
      if (alt && !item.brand) item.brand = alt;
    }

    const brandEl =
      row.querySelector("[data-brand-name]") ||
      row.querySelector(".brand-name") ||
      row.querySelector(".brand-logo");

    if (!item.brand && brandEl) {
      item.brand = normStr(
        brandEl.getAttribute?.("data-brand-name") ||
        brandEl.getAttribute?.("alt") ||
        brandEl.textContent
      );
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

    const linkEl =
      modal.querySelector("a[data-cigar-link][href]") ||
      modal.querySelector(".modal-title a[href]") ||
      modal.querySelector("a[href]");

    const name = normStr(nameEl ? nameEl.textContent : "");
    const vitola = normStr(vitolaEl ? vitolaEl.textContent : "");
    const msrp = parsePriceFromText(priceEl ? priceEl.textContent : modal.textContent);
    const url = toAbsUrl(linkEl ? linkEl.getAttribute("href") || "" : "");

    return name ? { type: "cigar", brand: "", line: "", name, vitola, msrp, url } : null;
  }

  function itemFromDataset(ds) {
    const name = normStr(ds.name || ds.cigar || "");
    const brand = normStr(ds.brand || "");
    const line = normStr(ds.line || "");
    const vitola = normStr(ds.vitola || "");
    const msrp = Number(ds.msrp || ds.price || 0) || 0;
    const url = toAbsUrl(ds.url || ds.href || ds.link || "");

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
      image: ds.image || "",
      url
    };
  }

  function looksLikePlusButton(btn) {
    if (!btn) return false;

    const text = normStr(btn.textContent).replace(/\s+/g, "");
    const aria = normStr(btn.getAttribute("aria-label")).toLowerCase();
    const title = normStr(btn.getAttribute("title")).toLowerCase();
    const cls = normStr(btn.className).toLowerCase();

    if (
      btn.hasAttribute("data-cart-add") ||
      btn.hasAttribute("data-receipt-item") ||
      cls.includes("row-add") ||
      cls.includes("pos-add") ||
      cls.includes("cigar-add") ||
      cls.includes("add-btn") ||
      cls.includes("plus-btn")
    ) {
      return true;
    }

    if (text === "+" || text === "＋") return true;
    if (aria.includes("add")) return true;
    if (title.includes("add")) return true;

    return false;
  }

  function wireInvoiceNav(root = document) {
    const candidates = [
      ...root.querySelectorAll(
        "[data-invoice-btn], #invoice-btn, .pos-invoice-btn, a[href*='/pos/invoice'], a[href*='invoice']"
      )
    ];

    candidates.forEach((el) => {
      if (el.__invoiceNavBound) return;
      el.__invoiceNavBound = true;

      if (el.tagName === "A") {
        el.setAttribute("href", "/pos/invoice/");
      }

      el.addEventListener("click", (e) => {
        if (el.tagName === "A" && (e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        window.location.href = "/pos/invoice/";
      }, { passive: false });
    });
  }

  function ensureUniversalInvoiceButtons(root = document) {
    const existing = root.querySelector?.("[data-invoice-btn], #invoice-btn, .pos-invoice-btn");
    if (existing) return;

    const likelyHolders = [
      ...root.querySelectorAll?.(".top-right, .page-actions, .brand-actions, .header-actions, .pos-actions, .nav-actions, .actions, header") || []
    ];

    likelyHolders.forEach((holder) => {
      const iconish = holder.querySelector("a[aria-label*='invoice' i], button[aria-label*='invoice' i], a[aria-label*='cart' i], button[aria-label*='cart' i]");
      if (!iconish || iconish.__invoiceNormalized) return;

      iconish.__invoiceNormalized = true;
      iconish.classList.add("pos-invoice-btn");
      iconish.setAttribute("data-invoice-btn", "");
      if (iconish.tagName === "A") iconish.setAttribute("href", "/pos/invoice/");

      if (!iconish.querySelector("[data-cart-badge]")) {
        const badge = document.createElement("span");
        badge.setAttribute("data-cart-badge", "");
        badge.textContent = "0";
        badge.hidden = true;
        iconish.appendChild(badge);
      }
    });
  }

  function handleAddClick(e) {
    const btn = e.target.closest("button, [role='button'], .row-add, .pos-add, .cigar-add, .add-btn, .plus-btn, [data-cart-add], [data-receipt-item]");
    if (!btn) return;

    if (btn.matches("[data-invoice-btn], #invoice-btn, .pos-invoice-btn")) return;
    if (!looksLikePlusButton(btn)) return;

    const dsItem = itemFromDataset(btn.dataset);
    const rowItem = scrapeFromCigarRow(btn);
    const modalItem = scrapeFromModal(btn);

    const item = dsItem || rowItem || modalItem;
    if (!item || !item.name) return;

    addToCart(item, btn.dataset.qty || 1);
  }

  document.addEventListener("click", handleAddClick, true);

  const initial = loadCart();
  mirrorToLegacyArray(initial);
  ensureUniversalInvoiceButtons(document);
  wireInvoiceNav(document);
  updateBadges(initial);

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        ensureUniversalInvoiceButtons(n);
        wireInvoiceNav(n);
      }
    }
    updateBadges(loadCart());
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.cigarOSCart = window.cigarOSCart || {};
  window.cigarOSCart.add = addToCart;
  window.cigarOSCart.items = () => loadCart();
  window.cigarOSCart.count = () => getCartCount(loadCart());
  window.cigarOSCart.updateBadges = () => updateBadges(loadCart());
  window.cigarOSCart.key = CART_KEY;
  window.cigarOSCart.clear = () => {
    localStorage.setItem(CART_KEY, JSON.stringify([]));
    updateBadges([]);
    document.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: { cart: [] } }));
    window.dispatchEvent(new CustomEvent("cigaros:cart", { detail: { cart: [] } }));
  };
})();
