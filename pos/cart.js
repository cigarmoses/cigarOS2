/* /pos/cart.js
   Shared POS Cart + INVOICE modal controller (ALL POS pages)

   Fixes in this version:
   ✅ Add-to-bill confirm modal now CLOSES on Confirm/Cancel every time
   ✅ Invoice typography is no longer “all bold” (regular body, bold headers only)
   ✅ “Product” label now uses the actual category (Accessories / Ashtrays / Food & Bevs / Packs / Pipes / etc.)
   ✅ Qty adjuster smaller (buttons + text)
   ✅ Attach Saved Customer works (loads from localStorage + persists selected customer)
*/

(() => {
  "use strict";

  // -------------------------
  // Storage keys
  // -------------------------
  const CART_KEY = "cigaros_pos_cart_v3";
  const SHOP_KEY = "cigaros_pos_shop_name";
  const INV_KEY  = "cigaros_pos_invoice_number";
  const CUST_DB_KEY = "cigaros_pos_customers_v1";     // array of customers
  const CUST_ATTACHED_KEY = "cigaros_pos_attached_customer_v1"; // selected customer object
  const TAX_RATE = 0.07;

  // -------------------------
  // Helpers
  // -------------------------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clampInt = (v, min, max) => {
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  };

  const money = (n) => {
    const x = Number(n || 0);
    return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const titleCase = (s) => {
    if (!s) return "";
    return String(s)
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map(w => w ? (w[0].toUpperCase() + w.slice(1)) : "")
      .join(" ");
  };

  const safeJsonParse = (s, fallback) => {
    try { return JSON.parse(s); } catch { return fallback; }
  };

  const readCart = () => safeJsonParse(localStorage.getItem(CART_KEY) || "[]", []);
  const writeCart = (items) => localStorage.setItem(CART_KEY, JSON.stringify(items || []));

  const getShopName = () => localStorage.getItem(SHOP_KEY) || "Shop";
  const getInvoiceNumber = () => {
    let inv = localStorage.getItem(INV_KEY);
    if (!inv) {
      inv = String(Math.floor(100000 + Math.random() * 900000));
      localStorage.setItem(INV_KEY, inv);
    }
    return inv;
  };

  const todayLabel = () => {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  };

  const calcTotals = (items) => {
    const subtotal = items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const tax = +(subtotal * TAX_RATE).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);
    return { subtotal, tax, total };
  };

  // Category resolution:
  // We accept either: category, type, group, kind, section
  const resolveCategory = (it) => {
    const raw =
      it.category ||
      it.type ||
      it.group ||
      it.kind ||
      it.section ||
      it.collection ||
      "Product";

    // normalize common variants
    const s = String(raw).trim();

    // Your UI shows “Food & Bevs” etc — keep that exact style if present
    if (/food/i.test(s) && /bev/i.test(s)) return "Food & Bevs";
    if (/ash/i.test(s)) return "Ashtrays";
    if (/access/i.test(s)) return "Accessories";
    if (/pipe/i.test(s)) return "Pipes";
    if (/pack/i.test(s)) return "Packs";
    if (/cigar/i.test(s)) return "Cigars";

    return titleCase(s);
  };

  // -------------------------
  // Inject CSS (small overrides)
  // -------------------------
  const ensureCartCss = () => {
    if ($("#pos-cart-css")) return;
    const link = document.createElement("link");
    link.id = "pos-cart-css";
    link.rel = "stylesheet";
    link.href = "/pos/cart.css";
    document.head.appendChild(link);
  };

  // -------------------------
  // DOM injection
  // -------------------------
  const ensureDom = () => {
    // Floating invoice FAB
    if (!$("#pos-invoice-fab")) {
      const fab = document.createElement("button");
      fab.id = "pos-invoice-fab";
      fab.type = "button";
      fab.setAttribute("aria-label", "Open invoice");
      fab.innerHTML = `
        <span class="pos-fab-badge" id="pos-invoice-badge">0</span>
        <img class="pos-fab-img" src="/img/pos/invoice-fab.png" alt="" />
      `;
      document.body.appendChild(fab);
    }

    // Invoice modal
    if (!$("#pos-invoice-modal")) {
      const wrap = document.createElement("div");
      wrap.id = "pos-invoice-modal";
      wrap.className = "pos-modal";
      wrap.innerHTML = `
        <div class="pos-modal-backdrop" data-close="invoice"></div>
        <div class="pos-modal-sheet" role="dialog" aria-modal="true" aria-label="Invoice">
          <button class="pos-modal-x" type="button" data-close="invoice" aria-label="Close invoice">×</button>

          <div class="pos-invoice-head">
            <div class="pos-invoice-title">INVOICE</div>
            <div class="pos-invoice-shop" id="pos-invoice-shop"></div>
            <div class="pos-invoice-date" id="pos-invoice-date"></div>
            <div class="pos-invoice-inv" id="pos-invoice-inv"></div>
          </div>

          <div class="pos-invoice-customer">
            <div class="pos-cust-select-wrap">
              <select id="pos-cust-select" class="pos-cust-select" aria-label="Attach Saved Customer">
                <option value="">Attach Saved Customer</option>
              </select>
              <span class="pos-cust-caret">▼</span>
            </div>
          </div>

          <div class="pos-invoice-list" id="pos-invoice-list"></div>

          <div class="pos-invoice-totals">
            <div class="pos-trow"><span>Subtotal</span><span id="pos-subtotal">$0.00</span></div>
            <div class="pos-trow"><span>Tax</span><span id="pos-tax">$0.00</span></div>
            <div class="pos-trow pos-total"><span>TOTAL</span><span id="pos-total">$0.00</span></div>
          </div>

          <div class="pos-invoice-actions">
            <button class="pos-btn pos-btn-ghost" type="button" id="pos-clear-cart">Clear</button>
            <button class="pos-btn pos-btn-primary" type="button" data-close="invoice">Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
    }

    // Add-to-bill confirm modal
    if (!$("#pos-confirm-modal")) {
      const c = document.createElement("div");
      c.id = "pos-confirm-modal";
      c.className = "pos-confirm";
      c.innerHTML = `
        <div class="pos-confirm-backdrop" data-close="confirm"></div>
        <div class="pos-confirm-sheet" role="dialog" aria-modal="true" aria-label="Add to Bill">
          <div class="pos-confirm-title">Add to Bill</div>
          <div class="pos-confirm-sub" id="pos-confirm-sub">—</div>
          <div class="pos-confirm-actions">
            <button class="pos-btn pos-btn-ghost" type="button" data-close="confirm" id="pos-confirm-cancel">Cancel</button>
            <button class="pos-btn pos-btn-primary" type="button" id="pos-confirm-ok">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(c);
    }
  };

  // -------------------------
  // Modal open/close
  // -------------------------
  const openInvoice = () => {
    $("#pos-invoice-modal")?.classList.add("is-open");
    document.documentElement.classList.add("pos-modal-open");
    renderInvoice();
  };

  const closeInvoice = () => {
    $("#pos-invoice-modal")?.classList.remove("is-open");
    document.documentElement.classList.remove("pos-modal-open");
  };

  let confirmOnOk = null;

  const openConfirm = ({ label, onOk }) => {
    confirmOnOk = typeof onOk === "function" ? onOk : null;
    $("#pos-confirm-sub").textContent = label || "";
    $("#pos-confirm-modal").classList.add("is-open");
  };

  const closeConfirm = () => {
    $("#pos-confirm-modal").classList.remove("is-open");
    confirmOnOk = null;
  };

  // -------------------------
  // Customer attach
  // -------------------------
  const readCustomers = () => safeJsonParse(localStorage.getItem(CUST_DB_KEY) || "[]", []);
  const readAttachedCustomer = () => safeJsonParse(localStorage.getItem(CUST_ATTACHED_KEY) || "null", null);

  const writeAttachedCustomer = (cust) => {
    if (!cust) localStorage.removeItem(CUST_ATTACHED_KEY);
    else localStorage.setItem(CUST_ATTACHED_KEY, JSON.stringify(cust));
  };

  const buildCustomerSelect = () => {
    const sel = $("#pos-cust-select");
    if (!sel) return;

    const customers = readCustomers();
    const attached = readAttachedCustomer();

    // keep first option
    sel.innerHTML = `<option value="">Attach Saved Customer</option>`;

    customers.forEach((c, idx) => {
      const name = c.name || c.fullName || c.company || `Customer ${idx + 1}`;
      const email = c.email ? ` • ${c.email}` : "";
      const phone = c.phone ? ` • ${c.phone}` : "";
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = `${name}${email}${phone}`;
      sel.appendChild(opt);
    });

    // restore selection
    if (attached && customers.length) {
      const matchIdx = customers.findIndex(c => {
        const aName = attached.name || attached.fullName || attached.company || "";
        const cName = c.name || c.fullName || c.company || "";
        return aName && cName && aName === cName;
      });
      if (matchIdx >= 0) sel.value = String(matchIdx);
    }
  };

  const wireCustomerSelect = () => {
    const sel = $("#pos-cust-select");
    if (!sel) return;

    sel.addEventListener("change", () => {
      const customers = readCustomers();
      const idx = sel.value === "" ? -1 : clampInt(sel.value, 0, customers.length - 1);
      if (idx < 0) writeAttachedCustomer(null);
      else writeAttachedCustomer(customers[idx] || null);
    });
  };

  // -------------------------
  // Rendering
  // -------------------------
  const updateFabBadge = () => {
    const items = readCart();
    const count = items.reduce((n, it) => n + Number(it.qty || 0), 0);
    const badge = $("#pos-invoice-badge");
    if (badge) badge.textContent = String(count);
    $("#pos-invoice-fab")?.classList.toggle("has-items", count > 0);
  };

  const renderInvoice = () => {
    const items = readCart();

    $("#pos-invoice-shop").textContent = getShopName();
    $("#pos-invoice-date").textContent = todayLabel();
    $("#pos-invoice-inv").textContent = `INV# ${getInvoiceNumber()}`;

    buildCustomerSelect();

    const list = $("#pos-invoice-list");
    if (!list) return;

    if (!items.length) {
      list.innerHTML = `<div class="pos-empty">No items yet.</div>`;
    } else {
      list.innerHTML = items.map((it, i) => {
        const cat = resolveCategory(it);
        const name = it.name || it.title || "Item";
        const sub = it.subtitle || it.vitola || ""; // non-cigar ok
        const price = Number(it.price || 0);
        const qty = clampInt(it.qty || 1, 1, 999);
        const lineTotal = price * qty;

        // NOTE: icon is optional; show placeholder if missing
        const img = it.image || it.img || it.icon || "";

        return `
          <div class="pos-row" data-i="${i}">
            <div class="pos-row-left">
              <div class="pos-thumb">
                ${img ? `<img src="${img}" alt="" />` : `<div class="pos-thumb-ph"></div>`}
              </div>
              <div class="pos-meta">
                <div class="pos-cat">${cat}</div>
                <div class="pos-name">${name}</div>
                ${sub ? `<div class="pos-sub">${sub}</div>` : ``}
                <div class="pos-unit">${money(price)}</div>
              </div>
            </div>

            <div class="pos-row-right">
              <div class="pos-qty">
                <button class="pos-qty-btn" type="button" data-qty="dec" aria-label="Decrease quantity">−</button>
                <div class="pos-qty-val" aria-label="Quantity">${qty}</div>
                <button class="pos-qty-btn" type="button" data-qty="inc" aria-label="Increase quantity">+</button>
              </div>
              <div class="pos-line-total">${money(lineTotal)}</div>
            </div>
          </div>
        `;
      }).join("");
    }

    const { subtotal, tax, total } = calcTotals(items);
    $("#pos-subtotal").textContent = money(subtotal);
    $("#pos-tax").textContent = money(tax);
    $("#pos-total").textContent = money(total);

    updateFabBadge();
  };

  // -------------------------
  // Add-to-cart plumbing
  // -------------------------
  const addItem = (item) => {
    if (!item) return;
    const items = readCart();

    // Use stable key if provided (so duplicates add qty)
    const key = item.key || item.sku || item.id || `${resolveCategory(item)}|${item.name || ""}|${item.price || ""}`.trim();

    const idx = items.findIndex(x => (x.key || x.sku || x.id) ? (String(x.key || x.sku || x.id) === String(key)) : false);

    if (idx >= 0) {
      items[idx].qty = clampInt(Number(items[idx].qty || 0) + 1, 1, 999);
    } else {
      items.push({
        ...item,
        key,
        qty: clampInt(item.qty || 1, 1, 999),
        category: resolveCategory(item) // normalize once
      });
    }

    writeCart(items);
    updateFabBadge();
    renderInvoice();
  };

  // -------------------------
  // Event wiring
  // -------------------------
  const wireEvents = () => {
    // Open invoice
    $("#pos-invoice-fab")?.addEventListener("click", (e) => {
      e.preventDefault();
      openInvoice();
    });

    // Close invoice (x, backdrop, close btn)
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.matches('[data-close="invoice"]')) {
        e.preventDefault();
        closeInvoice();
      }
      if (t.matches('[data-close="confirm"]')) {
        e.preventDefault();
        closeConfirm();
      }
    });

    // Confirm modal buttons (IMPORTANT: always close)
    $("#pos-confirm-cancel")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeConfirm();
    });

    $("#pos-confirm-ok")?.addEventListener("click", (e) => {
      e.preventDefault();
      const fn = confirmOnOk;
      closeConfirm();         // CLOSE FIRST so it never gets stuck
      try { fn && fn(); } catch (err) { console.error(err); }
    });

    // Qty controls in invoice
    $("#pos-invoice-list")?.addEventListener("click", (e) => {
      const btn = (e.target instanceof Element) ? e.target.closest("[data-qty]") : null;
      if (!btn) return;

      const row = btn.closest(".pos-row");
      if (!row) return;

      const i = clampInt(row.getAttribute("data-i"), 0, 999999);
      const items = readCart();
      if (!items[i]) return;

      const dir = btn.getAttribute("data-qty");
      const cur = clampInt(items[i].qty || 1, 1, 999);

      if (dir === "inc") items[i].qty = clampInt(cur + 1, 1, 999);
      if (dir === "dec") items[i].qty = clampInt(cur - 1, 1, 999);

      // if dec would go below 1, remove item (optional behavior)
      if (dir === "dec" && cur === 1) items.splice(i, 1);

      writeCart(items);
      renderInvoice();
    });

    // Clear cart
    $("#pos-clear-cart")?.addEventListener("click", () => {
      writeCart([]);
      updateFabBadge();
      renderInvoice();
    });

    // Listen for add-to-cart triggers across POS
    // - Cigars typically add via explicit + buttons (pos-add / row-add)
    // - Non-cigars: clicking the card/row can open confirm modal, then add
    document.addEventListener("click", (e) => {
      const el = (e.target instanceof Element) ? e.target.closest("[data-receipt-item]") : null;
      if (!el) return;

      const raw = el.getAttribute("data-receipt-item");
      const item = safeJsonParse(raw, null);
      if (!item) return;

      // If element requests confirm (non-cigars)
      const wantsConfirm = el.hasAttribute("data-confirm-add") || item.confirm === true || item.type === "product";

      if (wantsConfirm) {
        e.preventDefault();
        const cat = resolveCategory(item);
        const name = item.name || item.title || "Item";
        const price = money(item.price || 0);
        openConfirm({
          label: `${cat} • ${name} • ${price}`,
          onOk: () => addItem(item)
        });
        return;
      }

      // No confirm: add immediately
      addItem(item);
    });

    wireCustomerSelect();
  };

  // -------------------------
  // Boot
  // -------------------------
  const init = () => {
    ensureCartCss();
    ensureDom();
    updateFabBadge();
    renderInvoice();
    wireEvents();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
