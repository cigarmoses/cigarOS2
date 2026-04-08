/* /pos/cart.js
   Universal POS cart
   - Persists cart in localStorage
   - Supports add / setQty / remove
   - Keeps invoice badges synced
   - Preserves richer fields for invoice rendering
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
    mirrorToLegacyArray(cart);
    updateBadges(cart);
    document.dispatchEvent(new CustomEvent("cigaros:cart-changed", { detail: { cart } }));
    window.dispatchEvent(new CustomEvent("cigaros:cart", { detail: { cart } }));
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
      item.type || "item",
      item.category || "",
      item.brand || "",
      item.line || "",
      item.name || "",
      item.vitola || "",
      item.variation || ""
    ].map((x) => normStr(x).toLowerCase());

    return parts.join("|");
  }

  function normalizeItem(item) {
    const price = Number(item.msrp ?? item.price ?? 0) || 0;

    return {
      type: item.type || "item",
      id: item.id || "",
      sku: item.sku || "",
      key: item.key || "",
      category: normStr(item.category),
      brand: normStr(item.brand),
      line: normStr(item.line),
      name: normStr(item.name),
      vitola: normStr(item.vitola),
      variation: normStr(item.variation),
      ring: normStr(item.ring),
      length: normStr(item.length),
      shape: normStr(item.shape),
      wrapper: normStr(item.wrapper),
      binder: normStr(item.binder),
      filler: normStr(item.filler),
      origin: normStr(item.origin),
      shade: normStr(item.shade),
      strength: normStr(item.strength),
      msrp: price,
      image: normStr(item.image),
      url: toAbsUrl(item.url || item.href || item.link || "")
    };
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
    if (Array.isArray(window.cigarOSCartItems)) {
      window.cigarOSCartItems.length = 0;
      for (const it of cart) window.cigarOSCartItems.push(it);
    }
  }

  function findIndex(cart, key) {
    return cart.findIndex((x) => x.key === key);
  }

  function addToCart(item, qtyToAdd = 1) {
    const cart = loadCart();
    const normalized = normalizeItem(item);
    const key = normalized.key || getKey(normalized);
    const qtyAdd = Math.max(1, Number(qtyToAdd || 1));

    const existingIdx = findIndex(cart, key);
    if (existingIdx >= 0) {
      cart[existingIdx] = {
        ...cart[existingIdx],
        ...normalized,
        key,
        qty: Number(cart[existingIdx].qty || 0) + qtyAdd
      };
    } else {
      cart.push({
        ...normalized,
        key,
        qty: qtyAdd
      });
    }

    saveCart(cart);
  }

  function setQty(itemOrKey, nextQty) {
    const cart = loadCart();
    const key = typeof itemOrKey === "string"
      ? itemOrKey
      : (itemOrKey.key || getKey(normalizeItem(itemOrKey)));

    const qty = Math.max(0, Number(nextQty || 0));
    const idx = findIndex(cart, key);

    if (idx >= 0) {
      if (qty <= 0) cart.splice(idx, 1);
      else cart[idx].qty = qty;
      saveCart(cart);
      return;
    }

    if (qty <= 0 || typeof itemOrKey === "string") return;

    const normalized = normalizeItem(itemOrKey);
    cart.push({
      ...normalized,
      key,
      qty
    });
    saveCart(cart);
  }

  function remove(itemOrKey) {
    setQty(itemOrKey, 0);
  }

  function itemFromDataset(ds) {
    const name = normStr(ds.name || ds.cigar || "");
    const brand = normStr(ds.brand || "");
    const line = normStr(ds.line || "");
    const vitola = normStr(ds.vitola || "");
    const category = normStr(ds.category || "");
    const variation = normStr(ds.variation || "");
    const ring = normStr(ds.ring || "");
    const length = normStr(ds.length || "");
    const shape = normStr(ds.shape || "");
    const strength = normStr(ds.strength || "");
    const shade = normStr(ds.shade || "");
    const origin = normStr(ds.origin || "");
    const msrp = Number(ds.msrp || ds.price || 0) || 0;
    const url = toAbsUrl(ds.url || ds.href || ds.link || "");

    if (!name && !brand) return null;

    return {
      type: ds.type || "item",
      id: ds.id || "",
      sku: ds.sku || "",
      category,
      brand,
      line,
      name: name || brand,
      vitola,
      variation,
      ring,
      length,
      shape,
      strength,
      shade,
      origin,
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
      cls.includes("row-add") ||
      cls.includes("pos-add") ||
      cls.includes("cigar-add") ||
      cls.includes("add-btn") ||
      cls.includes("plus-btn")
    ) return true;

    if (text === "+" || text === "＋") return true;
    if (aria.includes("add")) return true;
    if (title.includes("add")) return true;

    return false;
  }

  function scrapeFromRow(btn) {
    const row =
      btn.closest(".cigar-row") ||
      btn.closest(".brand-row") ||
      btn.closest(".product-row") ||
      btn.closest(".item-row") ||
      btn.closest(".row") ||
      btn.closest("[role='listitem']");

    if (!row) return null;

    const titleEl =
      row.querySelector(".cigar-title") ||
      row.querySelector(".brand-row-title") ||
      row.querySelector(".product-title") ||
      row.querySelector(".item-title") ||
      row.querySelector(".title") ||
      row.querySelector("h3") ||
      row.querySelector("h2");

    const subEl =
      row.querySelector(".cigar-subtitle") ||
      row.querySelector(".brand-row-sub") ||
      row.querySelector(".product-subtitle") ||
      row.querySelector(".sub");

    const priceEl =
      row.querySelector(".cigar-price") ||
      row.querySelector(".brand-row-msrp") ||
      row.querySelector(".product-price") ||
      row.querySelector(".price");

    const img = row.querySelector("img");

    const item = {
      type: "item",
      name: normStr(titleEl?.textContent || ""),
      vitola: normStr(subEl?.textContent || ""),
      msrp: parsePriceFromText(priceEl?.textContent || row.textContent),
      image: img?.getAttribute("src") || "",
      url: row.querySelector("a[href]")?.getAttribute("href") || ""
    };

    return item.name ? item : null;
  }

  function handleAddClick(e) {
    const btn = e.target.closest("button, [role='button'], .row-add, .pos-add, .cigar-add, .add-btn, .plus-btn, [data-cart-add]");
    if (!btn) return;
    if (btn.matches("[data-invoice-btn], #invoice-btn, .pos-invoice-btn")) return;
    if (!looksLikePlusButton(btn)) return;

    const item = itemFromDataset(btn.dataset) || scrapeFromRow(btn);
    if (!item || !item.name) return;

    addToCart(item, btn.dataset.qty || 1);
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

  document.addEventListener("click", handleAddClick, true);

  const initial = loadCart();
  mirrorToLegacyArray(initial);
  wireInvoiceNav(document);
  updateBadges(initial);

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
    add: addToCart,
    setQty,
    remove,
    items: () => loadCart(),
    count: () => getCartCount(loadCart()),
    updateBadges: () => updateBadges(loadCart()),
    clear: () => saveCart([]),
    key: CART_KEY
  };
})();
