/* /pos/cart.js
   Shared POS Cart + Receipt Sheet controller

   FIXES:
   ✅ Uses EXISTING receipt sheet UI in HTML:
      - #sheet-backdrop
      - #sheet-receipt
      - #receipt-items
      - #receipt-clear
      - [data-sheet-close]
   ✅ Receipt FAB opens the sheet
   ✅ Supports BOTH:
      (A) dataset-style cards (data-name, data-price...)
      (B) JSON payload inside data-receipt-item='{"name":...}'
*/

(() => {
  "use strict";

  const STORAGE_KEY = "cigaros_pos_cart_v1";
  const $ = (sel, root = document) => root.querySelector(sel);

  // -------------------------
  // State
  // -------------------------
  const state = { items: [] };

  // -------------------------
  // Helpers
  // -------------------------
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const toNum = (v) => {
    const n = Number(String(v ?? "").replace(/[^0-9.]+/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const money = (n) => toNum(n).toFixed(2);

  function safeParseJSON(s, fallback) {
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeParseJSON(raw, null);
    if (parsed && Array.isArray(parsed.items)) state.items = parsed.items;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
  }

  function getItemCount() {
    return state.items.reduce((sum, it) => sum + clamp(Number(it.qty || 0), 0, 999), 0);
  }

  function makeStableId(item) {
    const bits = [
      item.type || "product",
      item.category || "",
      item.brand || "",
      item.name || "",
      item.sub || "",
      String(item.price || ""),
    ].map((s) => String(s || "").trim().toLowerCase());
    return bits.join("|");
  }

  function escapeHTML(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // -------------------------
  // DOM refs (existing sheet UI)
  // -------------------------
  let receiptBtn, badgeEl;
  let backdropEl, sheetEl, itemsEl, clearBtn;

  function resolveDOM() {
    receiptBtn = $("#receipt-open");
    badgeEl = $("#receipt-count");

    backdropEl = $("#sheet-backdrop");
    sheetEl = $("#sheet-receipt");

    itemsEl = $("#receipt-items");
    clearBtn = $("#receipt-clear");
  }

  // -------------------------
  // Sheet open/close
  // -------------------------
  function openSheet() {
    resolveDOM();
    if (!backdropEl || !sheetEl) return;

    backdropEl.hidden = false;
    sheetEl.hidden = false;

    backdropEl.classList.add("open");
    sheetEl.classList.add("open");

    renderReceipt();
  }

  function closeSheet() {
    resolveDOM();
    if (!backdropEl || !sheetEl) return;

    backdropEl.hidden = true;
    sheetEl.hidden = true;

    backdropEl.classList.remove("open");
    sheetEl.classList.remove("open");
  }

  // -------------------------
  // Receipt rendering
  // -------------------------
  function renderReceipt() {
    resolveDOM();
    if (!itemsEl) return;

    if (!state.items.length) {
      itemsEl.innerHTML = `
        <div style="padding:12px 6px;color:rgba(15,26,44,.65);font-weight:600;">
          No items yet.
        </div>
      `;
      return;
    }

    itemsEl.innerHTML = state.items
      .map((it) => {
        const qty = clamp(Number(it.qty || 1), 1, 999);
        const price = toNum(it.price);
        const line = price * qty;

        return `
          <div class="receipt-row" data-id="${escapeHTML(it.id)}" style="display:flex;gap:10px;align-items:center;padding:10px 6px;border-bottom:1px solid rgba(0,0,0,.06);">
            <div class="receipt-ico" style="width:42px;height:42px;border-radius:12px;background:#f3f5f8;border:1px solid rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;overflow:hidden;">
              ${it.img ? `<img src="${escapeHTML(it.img)}" alt="" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';" />` : ""}
            </div>

            <div style="flex:1;min-width:0;">
              <div style="font-weight:800;font-size:14px;line-height:1.15;color:#0f1a2c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escapeHTML(it.name || "Item")}
              </div>
              ${
                it.sub
                  ? `<div style="margin-top:3px;font-size:12px;color:rgba(15,26,44,.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(it.sub)}</div>`
                  : ""
              }
              <div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
                <button type="button" data-qty="-1" style="width:28px;height:28px;border-radius:10px;border:1px solid rgba(0,0,0,.10);background:#fff;font-weight:900;">−</button>
                <div style="min-width:22px;text-align:center;font-weight:900;">${qty}</div>
                <button type="button" data-qty="+1" style="width:28px;height:28px;border-radius:10px;border:1px solid rgba(0,0,0,.10);background:#fff;font-weight:900;">+</button>
              </div>
            </div>

            <div style="text-align:right;">
              <div style="font-weight:900;color:#0f1a2c;">$${money(price)}</div>
              <div style="margin-top:4px;font-size:12px;color:rgba(15,26,44,.65);">$${money(line)}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function updateBadge() {
    resolveDOM();
    if (!badgeEl) return;

    const c = getItemCount();
    badgeEl.textContent = String(c);
    badgeEl.hidden = c <= 0;
  }

  // -------------------------
  // Public API
  // -------------------------
  function add(item) {
    if (!item) return;

    const normalized = {
      id: String(item.id || "").trim() || makeStableId(item),
      type: (item.type || "product").toLowerCase(),
      category: item.category || "Product",
      brand: item.brand || "",
      name: item.name || "Item",
      price: toNum(item.price),
      img: item.img || "",
      link: item.link || "",
      sub: item.sub || "",
      qty: clamp(Number(item.qty || 1), 1, 999),
    };

    const idx = state.items.findIndex((x) => x.id === normalized.id);
    if (idx >= 0) state.items[idx].qty = clamp((state.items[idx].qty || 1) + normalized.qty, 1, 999);
    else state.items.push(normalized);

    saveState();
    updateBadge();

    resolveDOM();
    if (sheetEl && !sheetEl.hidden) renderReceipt();
  }

  function clear() {
    state.items = [];
    saveState();
    updateBadge();
    renderReceipt();
  }

  // -------------------------
  // Parse click target into cart item
  // -------------------------
  function itemFromReceiptNode(node) {
    if (!node) return null;

    // (B) JSON payload in data-receipt-item
    const raw = node.getAttribute("data-receipt-item");
    if (raw && raw.trim().startsWith("{")) {
      const payload = safeParseJSON(raw, null);
      if (payload) {
        // allow either already-normalized payload OR older "receiptItem" shape
        return {
          id: payload.id || payload.key || "",
          type: payload.type || "product",
          category: payload.category || "Cigars",
          brand: payload.brand || (payload.meta?.brand || ""),
          name: payload.name || "",
          price: payload.price ?? 0,
          img: payload.img || "",
          sub: payload.sub || "",
          qty: payload.qty ?? 1,
          link: payload.link || payload.meta?.link || "",
        };
      }
    }

    // (A) dataset-style
    return {
      id: node.dataset.id || "",
      type: (node.dataset.type || "product").toLowerCase(),
      category: node.dataset.category || "Product",
      brand: node.dataset.brand || "",
      name: node.dataset.name || "Item",
      price: toNum(node.dataset.price || 0),
      img: node.dataset.img || "",
      link: node.dataset.link || "",
      sub: node.dataset.sub || "",
      qty: 1,
    };
  }

  // -------------------------
  // Wiring
  // -------------------------
  function bindEventsOnce() {
    resolveDOM();

    if (receiptBtn && !receiptBtn.dataset.bound) {
      receiptBtn.dataset.bound = "1";
      receiptBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openSheet();
      });
    }

    if (backdropEl && !backdropEl.dataset.bound) {
      backdropEl.dataset.bound = "1";
      backdropEl.addEventListener("click", () => closeSheet());
    }

    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest("[data-sheet-close]");
      if (closeBtn) {
        e.preventDefault();
        closeSheet();
      }
    });

    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.dataset.bound = "1";
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clear();
      });
    }

    if (itemsEl && !itemsEl.dataset.bound) {
      itemsEl.dataset.bound = "1";
      itemsEl.addEventListener("click", (e) => {
        const row = e.target.closest(".receipt-row");
        const btn = e.target.closest("[data-qty]");
        if (!row || !btn) return;

        const id = row.getAttribute("data-id");
        const it = state.items.find((x) => x.id === id);
        if (!it) return;

        const dir = btn.getAttribute("data-qty");
        const delta = dir === "+1" ? 1 : -1;
        const next = clamp(Number(it.qty || 1) + delta, 0, 999);

        if (next <= 0) state.items = state.items.filter((x) => x.id !== id);
        else it.qty = next;

        saveState();
        updateBadge();
        renderReceipt();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSheet();
    });

    // Main click delegation: any element with [data-receipt-item] adds to cart
    document.addEventListener(
      "click",
      (e) => {
        const node = e.target.closest("[data-receipt-item]");
        if (!node) return;

        // Let other UIs keep their own row-click behavior; we only act on the + buttons/cards.
        // If you want stricter gating, we can later restrict to .row-add/.pos-add.
        e.preventDefault();
        e.stopPropagation();

        const item = itemFromReceiptNode(node);
        if (!item) return;

        add(item);
        updateBadge();
      },
      { passive: false }
    );
  }

  function boot() {
    loadState();
    resolveDOM();
    updateBadge();
    bindEventsOnce();

    window.CigarOSCart = {
      add,
      clear,
      openInvoice: openSheet,
      closeInvoice: closeSheet,
      openSheet,
      closeSheet,
      getCount: () => getItemCount(),
      getItems: () => [...state.items],
      money,
    };
  }

  window.CigarOSCart = window.CigarOSCart || {
    add,
    clear,
    openInvoice: openSheet,
    closeInvoice: closeSheet,
    openSheet,
    closeSheet,
    getCount: () => getItemCount(),
    getItems: () => [...state.items],
    money,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
