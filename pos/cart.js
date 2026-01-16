/* /pos/cart.js
   Shared POS Cart + Receipt Sheet controller

   ✅ Supports BOTH cart add contracts:
      (A) data-receipt-item='{"key":...,"name":...,"price":...}'  (JSON payload)
      (B) dataset fields: data-id/data-name/data-price/...        (legacy)

   ✅ Uses EXISTING receipt sheet UI in your POS HTML:
      - #sheet-backdrop
      - #sheet-receipt
      - #receipt-items
      - #receipt-clear
      - [data-sheet-close]

   ✅ Receipt FAB always opens the receipt sheet
   ✅ Green + adds to cart + updates badge immediately
   ✅ Does NOT hijack row clicks (detail modals remain yours)
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
  // Sheet open/close (Receipt only)
  // -------------------------
  function openReceiptSheet() {
    resolveDOM();
    if (!backdropEl || !sheetEl) return;

    backdropEl.hidden = false;
    sheetEl.hidden = false;

    backdropEl.classList.add("open");
    sheetEl.classList.add("open");

    renderReceipt();
  }

  function closeReceiptSheet() {
    resolveDOM();
    if (!backdropEl || !sheetEl) return;

    sheetEl.hidden = true;
    sheetEl.classList.remove("open");

    // keep backdrop open if other sheets are visible
    const otherOpen = document.querySelector(
      '#sheet-bands:not([hidden]), #sheet-filters:not([hidden]), #cigarDetailOverlay.open, .cigar-modal.is-open'
    );
    if (!otherOpen) {
      backdropEl.hidden = true;
      backdropEl.classList.remove("open");
    } else {
      backdropEl.hidden = false;
      backdropEl.classList.add("open");
    }
  }

  // -------------------------
  // Receipt rendering (into #receipt-items)
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
          <div class="receipt-row" data-id="${escapeHTML(it.id)}"
               style="display:flex;gap:10px;align-items:center;padding:10px 6px;border-bottom:1px solid rgba(0,0,0,.06);">
            <div class="receipt-ico"
                 style="width:42px;height:42px;border-radius:12px;background:#f3f5f8;border:1px solid rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;overflow:hidden;">
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
                <button type="button" data-qty="-1"
                        style="width:28px;height:28px;border-radius:10px;border:1px solid rgba(0,0,0,.10);background:#fff;font-weight:900;">−</button>
                <div style="min-width:22px;text-align:center;font-weight:900;">${qty}</div>
                <button type="button" data-qty="+1"
                        style="width:28px;height:28px;border-radius:10px;border:1px solid rgba(0,0,0,.10);background:#fff;font-weight:900;">+</button>
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
  // Cart core
  // -------------------------
  function add(rawItem) {
    if (!rawItem) return;

    const normalized = {
      id: String(rawItem.id || rawItem.key || "").trim() || makeStableId(rawItem),
      type: (rawItem.type || "product").toLowerCase(),
      category: rawItem.category || "Product",
      brand: rawItem.brand || (rawItem.meta && rawItem.meta.brand) || "",
      name: rawItem.name || "Item",
      price: toNum(rawItem.price),
      img: rawItem.img || rawItem.image || "",
      link: rawItem.link || "",
      sub: rawItem.sub || "",
      qty: clamp(Number(rawItem.qty || 1), 1, 999),
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
  // Parse add payload from element
  // -------------------------
  function parseFromElement(el) {
    if (!el) return null;

    // (A) JSON payload in attribute
    const jsonAttr = el.getAttribute("data-receipt-item");
    if (jsonAttr) {
      const parsed = safeParseJSON(jsonAttr, null);
      if (parsed && typeof parsed === "object") return parsed;
    }

    // (B) legacy dataset fields
    const ds = el.dataset || {};
    if (ds.name || ds.price || ds.id) {
      return {
        id: ds.id || "",
        key: ds.key || "",
        type: (ds.type || "product").toLowerCase(),
        category: ds.category || "Product",
        brand: ds.brand || "",
        name: ds.name || "Item",
        price: toNum(ds.price || 0),
        img: ds.img || "",
        link: ds.link || "",
        sub: ds.sub || "",
        qty: 1,
      };
    }

    return null;
  }

  // -------------------------
  // Wiring
  // -------------------------
  function bindEventsOnce() {
    resolveDOM();

    // Receipt FAB opens receipt sheet
    if (receiptBtn && !receiptBtn.dataset.bound) {
      receiptBtn.dataset.bound = "1";
      receiptBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openReceiptSheet();
      });
    }

    // Backdrop click: close whichever sheets are open (receipt/bands/filters),
    // but never interfere with cigar detail overlay or favorites modal if they handle it.
    if (backdropEl && !backdropEl.dataset.bound) {
      backdropEl.dataset.bound = "1";
      backdropEl.addEventListener("click", () => {
        // close receipt
        closeReceiptSheet();

        // close bands/filters if present
        const bands = $("#sheet-bands");
        const filters = $("#sheet-filters");
        if (bands && !bands.hidden) bands.hidden = true;
        if (filters && !filters.hidden) filters.hidden = true;

        // if nothing left open, hide backdrop
        const otherOpen = document.querySelector(
          '#sheet-bands:not([hidden]), #sheet-filters:not([hidden]), #sheet-receipt:not([hidden]), #cigarDetailOverlay.open, .cigar-modal.is-open'
        );
        if (!otherOpen) {
          backdropEl.hidden = true;
          backdropEl.classList.remove("open");
        }
      });
    }

    // Close buttons (any sheet)
    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest("[data-sheet-close]");
      if (!closeBtn) return;

      e.preventDefault();

      // close receipt if it's open
      closeReceiptSheet();

      // close any other sheets
      const bands = $("#sheet-bands");
      const filters = $("#sheet-filters");
      if (bands && !bands.hidden) bands.hidden = true;
      if (filters && !filters.hidden) filters.hidden = true;

      // hide backdrop if nothing else open
      resolveDOM();
      const otherOpen = document.querySelector(
        '#sheet-bands:not([hidden]), #sheet-filters:not([hidden]), #sheet-receipt:not([hidden]), #cigarDetailOverlay.open, .cigar-modal.is-open'
      );
      if (!otherOpen && backdropEl) {
        backdropEl.hidden = true;
        backdropEl.classList.remove("open");
      }
    });

    // Clear receipt
    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.dataset.bound = "1";
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clear();
      });
    }

    // Qty adjust delegation inside receipt items
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

    // ESC closes only receipt (other sheets can close via their own logic)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeReceiptSheet();
    });

    // ✅ Universal ADD handler:
    // If ANY element with data-receipt-item is clicked, add it.
    // Do NOT open receipt sheet automatically.
    document.addEventListener(
      "click",
      (e) => {
        const el = e.target.closest("[data-receipt-item]");
        if (!el) return;

        // Allow row click handlers to still run when they aren't clicking the + button.
        // But for the + button itself we want add to work reliably.
        const payload = parseFromElement(el);
        if (!payload) return;

        // If it's clearly an "add" button, prevent navigation/other behavior.
        // (Most + buttons are <button>, but be defensive.)
        e.preventDefault();
        e.stopPropagation();

        add(payload);
      },
      { capture: true }
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
      openInvoice: openReceiptSheet,
      closeInvoice: closeReceiptSheet,
      openSheet: openReceiptSheet,
      closeSheet: closeReceiptSheet,
      getCount: () => getItemCount(),
      getItems: () => [...state.items],
      money,
    };
  }

  // define early
  window.CigarOSCart = window.CigarOSCart || {
    add,
    clear,
    openInvoice: openReceiptSheet,
    closeInvoice: closeReceiptSheet,
    openSheet: openReceiptSheet,
    closeSheet: closeReceiptSheet,
    getCount: () => getItemCount(),
    getItems: () => [...state.items],
    money,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
