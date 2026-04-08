/* /pos/cart.js
   Universal POS cart + invoice badge + invoice navigation
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
    const explicit = normStr(item.key);
    if (explicit) return explicit.toLowerCase();

    const sku = normStr(item.sku || item.id);
    if (sku) return sku.toLowerCase();

    return [
      item.type || "item",
      item.category || "",
      item.brand || "",
      item.line || "",
      item.name || "",
      item.vitola || ""
    ].map((x) => normStr(x).toLowerCase()).join("|");
  }

  function getCartCount(cartMaybe) {
    const cart = cartMaybe || loadCart();
    return cart.reduce((sum, it) => sum + Math.max(0, Number(it?.qty || 0)), 0);
  }

  function getItemQty(key) {
    const k = normStr(key).toLowerCase();
    if (!k) return 0;
    const cart = loadCart();
    const found = cart.find((x) => normStr(x.key).toLowerCase() === k);
    return found ? Math.max(0, Number(found.qty || 0)) : 0;
  }

  function dispatchCart(cart) {
    document.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: { cart } }));
    window.dispatchEvent(new CustomEvent("cigaros:cart", { detail: { cart } }));
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

  function normalizeItem(item) {
    const price = Number(item.msrp ?? item.price ?? 0) || 0;

    return {
      key: getKey(item),
      type: normStr(item.type || "item"),
      category: normStr(item.category || ""),
      id: normStr(item.id || ""),
      sku: normStr(item.sku || ""),
      brand: normStr(item.brand || ""),
      line: normStr(item.line || ""),
      name: normStr(item.name || ""),
      vitola: normStr(item.vitola || ""),
      msrp: price,
      image: normStr(item.image || ""),
      url: toAbsUrl(item.url || item.href || item.link || ""),
      qty: Math.max(0, Number(item.qty || 0))
    };
  }

  function setItemQty(item, qty) {
    const cart = loadCart();
    const normalized = normalizeItem(item);
    const nextQty = Math.max(0, Number(qty || 0));
    const idx = cart.findIndex((x) => normStr(x.key).toLowerCase() === normalized.key.toLowerCase());

    if (nextQty <= 0) {
      if (idx !== -1) cart.splice(idx, 1);
      saveCart(cart);
      updateBadges(cart);
      dispatchCart(cart);
      return;
    }

    if (idx !== -1) {
      cart[idx] = {
        ...cart[idx],
        ...normalized,
        qty: nextQty
      };
    } else {
      cart.push({
        ...normalized,
        qty: nextQty
      });
    }

    saveCart(cart);
    updateBadges(cart);
    dispatchCart(cart);
  }

  function addToCart(item, qtyToAdd = 1) {
    const normalized = normalizeItem(item);
    const current = getItemQty(normalized.key);
    setItemQty(normalized, current + Math.max(1, Number(qtyToAdd || 1)));
  }

  function removeFromCart(item, qtyToRemove = 1) {
    const normalized = normalizeItem(item);
    const current = getItemQty(normalized.key);
    setItemQty(normalized, Math.max(0, current - Math.max(1, Number(qtyToRemove || 1))));
  }

  function clearCart() {
    saveCart([]);
    updateBadges([]);
    dispatchCart([]);
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

  const initial = loadCart();
  updateBadges(initial);
  wireInvoiceNav(document);

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        wireInvoiceNav(n);
      }
    }
    updateBadges(loadCart());
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.cigarOSCart = {
    key: CART_KEY,
    items: () => loadCart(),
    count: () => getCartCount(loadCart()),
    getItemQty,
    add: addToCart,
    remove: removeFromCart,
    setQty: setItemQty,
    updateBadges: () => updateBadges(loadCart()),
    clear: clearCart
  };
})();
