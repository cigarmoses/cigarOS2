/* /pos/cart.js
   Universal POS cart + invoice badge + shared qty control

   - Persists cart in localStorage
   - Supports add(), setQty(), getItemQty(), remove(), clear()
   - Updates all cart badges
   - Keeps invoice page in sync
*/

(() => {
  "use strict";

  const CART_KEY = "cigaros_pos_cart_v3";

  function safeJSONParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function loadCart() {
    const cart = safeJSONParse(localStorage.getItem(CART_KEY), []);
    return Array.isArray(cart) ? cart : [];
  }

  function norm(value) {
    return String(value || "").trim();
  }

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function toAbsUrl(url) {
    const value = norm(url);
    if (!value) return "";
    try {
      return new URL(value, window.location.origin).href;
    } catch {
      return value;
    }
  }

  function makeKey(item) {
    const explicit =
      norm(item.key) ||
      norm(item.id) ||
      norm(item.sku);

    if (explicit) return explicit.toLowerCase();

    return [
      norm(item.type || "item").toLowerCase(),
      norm(item.category).toLowerCase(),
      norm(item.brand).toLowerCase(),
      norm(item.line).toLowerCase(),
      norm(item.name).toLowerCase(),
      norm(item.vitola).toLowerCase()
    ].join("|");
  }

  function normalizeItem(item) {
    const msrp = toNumber(
      item.msrp != null ? item.msrp : item.price,
      0
    );

    const normalized = {
      key: "",
      type: norm(item.type || "product"),
      category: norm(item.category || ""),
      id: norm(item.id || ""),
      sku: norm(item.sku || ""),
      brand: norm(item.brand || ""),
      line: norm(item.line || ""),
      name: norm(item.name || ""),
      vitola: norm(item.vitola || ""),
      ring: norm(item.ring || ""),
      length: norm(item.length || ""),
      shape: norm(item.shape || ""),
      wrapper: norm(item.wrapper || ""),
      binder: norm(item.binder || ""),
      filler: norm(item.filler || ""),
      origin: norm(item.origin || ""),
      shade: norm(item.shade || ""),
      strength: norm(item.strength || ""),
      msrp,
      image: norm(item.image || ""),
      url: toAbsUrl(item.url || item.href || item.link || "")
    };

    normalized.key = makeKey({
      ...item,
      key: item.key || item.id || item.sku || ""
    });

    return normalized;
  }

  function findIndex(cart, item) {
    const key = makeKey(item);
    return cart.findIndex((x) => x.key === key);
  }

  function getCartCount(cartMaybe) {
    const cart = cartMaybe || loadCart();
    return cart.reduce((sum, item) => sum + Math.max(0, toNumber(item.qty, 0)), 0);
  }

  function updateBadges(cartMaybe) {
    const cart = cartMaybe || loadCart();
    const count = getCartCount(cart);

    document.querySelectorAll("[data-cart-badge]").forEach((el) => {
      el.textContent = String(count);
      el.hidden = count <= 0;
    });

    const legacy = document.getElementById("receipt-count");
    if (legacy) legacy.textContent = String(count);

    document.querySelectorAll("[data-invoice-btn], #invoice-btn, .pos-invoice-btn").forEach((btn) => {
      btn.classList.toggle("has-items", count > 0);
      btn.setAttribute("data-cart-count", String(count));
    });
  }

  function mirrorLegacy(cart) {
    if (Array.isArray(window.cigarOSCartLegacy)) {
      window.cigarOSCartLegacy.length = 0;
      cart.forEach((item) => window.cigarOSCartLegacy.push(item));
    }
  }

  function emitCartEvents(cart) {
    document.dispatchEvent(
      new CustomEvent("cigaros:cart-changed", { detail: { cart } })
    );
    window.dispatchEvent(
      new CustomEvent("cigaros:cart", { detail: { cart } })
    );
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    mirrorLegacy(cart);
    updateBadges(cart);
    emitCartEvents(cart);
  }

  function add(item, qtyToAdd = 1) {
    const cart = loadCart();
    const normalized = normalizeItem(item);
    const qtyAdd = Math.max(1, Math.round(toNumber(qtyToAdd, 1)));
    const idx = findIndex(cart, normalized);

    if (idx >= 0) {
      cart[idx] = {
        ...cart[idx],
        ...normalized,
        qty: Math.max(0, toNumber(cart[idx].qty, 0)) + qtyAdd
      };
    } else {
      cart.push({
        ...normalized,
        qty: qtyAdd
      });
    }

    saveCart(cart);
  }

  function setQty(item, qty) {
    const cart = loadCart();
    const normalized = normalizeItem(item);
    const nextQty = Math.max(0, Math.round(toNumber(qty, 0)));
    const idx = findIndex(cart, normalized);

    if (nextQty <= 0) {
      if (idx >= 0) {
        cart.splice(idx, 1);
        saveCart(cart);
      } else {
        updateBadges(cart);
      }
      return;
    }

    if (idx >= 0) {
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
  }

  function getItemQty(item) {
    const cart = loadCart();
    const normalized = normalizeItem(item);
    const idx = findIndex(cart, normalized);
    if (idx < 0) return 0;
    return Math.max(0, toNumber(cart[idx].qty, 0));
  }

  function remove(item) {
    const cart = loadCart();
    const idx = findIndex(cart, item);
    if (idx >= 0) {
      cart.splice(idx, 1);
      saveCart(cart);
    }
  }

  function clear() {
    saveCart([]);
  }

  function items() {
    return loadCart();
  }

  function count() {
    return getCartCount(loadCart());
  }

  function wireInvoiceButtons(root = document) {
    root.querySelectorAll("[data-invoice-btn], #invoice-btn, .pos-invoice-btn").forEach((el) => {
      if (el.__cigarosInvoiceBound) return;
      el.__cigarosInvoiceBound = true;

      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = "/pos/invoice/";
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireInvoiceButtons(document);
    updateBadges(loadCart());
  });

  const observer = new MutationObserver(() => {
    wireInvoiceButtons(document);
    updateBadges(loadCart());
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.cigarOSCart = {
    key: CART_KEY,
    loadCart,
    items,
    count,
    add,
    setQty,
    getItemQty,
    remove,
    clear,
    updateBadges: () => updateBadges(loadCart())
  };

  updateBadges(loadCart());
})();
