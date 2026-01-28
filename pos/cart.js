/* /pos/cart.js
   Self-contained Invoice/Cart controller (no external cart.css required)

   Fixes:
   ✅ Confirm modal closes on Cancel/Confirm
   ✅ Typography no longer “all bold” (scoped to invoice UI only)
   ✅ Category label shows real category (Accessories / Ashtrays / Food & Bevs / Packs / Pipes / etc.)
   ✅ Qty controls smaller
   ✅ Attach Saved Customer works (loads from /pos/pos-contacts.json + caches in localStorage)
*/

(() => {
  "use strict";

  // -------------------------
  // Storage keys
  // -------------------------
  const CART_KEY = "cigaros_pos_cart_v3";
  const SHOP_KEY = "cigaros_pos_shop_name";
  const INV_KEY = "cigaros_pos_invoice_number";

  // customers
  const CUST_CACHE_KEY = "cigaros_pos_customers_cache_v1";
  const CUST_ATTACHED_KEY = "cigaros_pos_attached_customer_v1";

  const TAX_RATE = 0.07;

  // -------------------------
  // Helpers
  // -------------------------
  const $ = (sel, root = document) => root.querySelector(sel);

  const safeJsonParse = (s, fallback) => {
    try { return JSON.parse(s); } catch { return fallback; }
  };

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
    return d.toLocaleDateString(undefined, {
      weekday: "short", year: "numeric", month: "short", day: "numeric"
    });
  };

  const calcTotals = (items) => {
    const subtotal = items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const tax = +(subtotal * TAX_RATE).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);
    return { subtotal, tax, total };
  };

  // category mapping (accept multiple field names)
  const resolveCategory = (it) => {
    const raw =
      it.category ||
      it.type ||
      it.group ||
      it.kind ||
      it.section ||
      it.collection ||
      it.department ||
      "";

    const s = String(raw || "").trim();
    if (/food/i.test(s) && (/bev/i.test(s) || /bevs/i.test(s))) return "Food & Bevs";
    if (/ash/i.test(s)) return "Ashtrays";
    if (/access/i.test(s)) return "Accessories";
    if (/pipe/i.test(s)) return "Pipes";
    if (/pack/i.test(s)) return "Packs";
    if (/cigar/i.test(s)) return "Cigars";

    // last resort:
    return s ? titleCase(s) : "Product";
  };

  // stable key for deduping cart lines
  const itemKey = (it) => String(
    it.key || it.sku || it.id || `${resolveCategory(it)}|${it.name || it.title || ""}|${it.price || ""}`
  );

  // -------------------------
  // Inline CSS (SCOPED to invoice UI only)
  // -------------------------
  const ensureInlineStyles = () => {
    if ($("#pos-invoice-inline-css")) return;
    const style = document.createElement("style");
    style.id = "pos-invoice-inline-css";
    style.textContent = `
/* scoped: only our injected UI uses these ids/classes */
#pos-invoice-fab{
  position:fixed; right:18px; bottom:18px; z-index:9999;
  border:0; background:transparent; padding:0;
  width:58px; height:58px;
}
#pos-invoice-fab .fab{
  width:58px; height:58px; border-radius:18px;
  display:flex; align-items:center; justify-content:center;
  background:#fff; box-shadow:0 14px 34px rgba(0,0,0,.18);
  border:1px solid rgba(0,0,0,.08);
}
#pos-invoice-fab .fab span{ font-size:26px; }
#pos-invoice-badge{
  position:absolute; right:-2px; top:-2px;
  min-width:22px; height:22px; padding:0 6px;
  border-radius:999px; background:#ff3b30; color:#fff;
  font-weight:800; font-size:13px;
  display:inline-flex; align-items:center; justify-content:center;
  box-shadow:0 6px 14px rgba(0,0,0,.18);
}

#pos-invoice-modal, #pos-confirm-modal{
  position:fixed; inset:0; z-index:10000; display:none;
  font-family:-apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}
#pos-invoice-modal.is-open, #pos-confirm-modal.is-open{ display:block; }

.pos-backdrop{
  position:absolute; inset:0; background:rgba(0,0,0,.35);
  backdrop-filter:blur(4px);
}

#pos-invoice-sheet{
  position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:min(720px, calc(100vw - 22px));
  max-height:calc(100vh - 26px);
  overflow:hidden;
  border-radius:22px; background:#fff;
  box-shadow:0 22px 70px rgba(0,0,0,.25);
  color:#0f1a2c;
  font-weight:400; /* IMPORTANT: regular */
}

#pos-invoice-x{
  position:absolute; right:12px; top:12px;
  width:36px; height:36px; border-radius:999px;
  border:0; background:rgba(15,26,44,.06);
  color:#0f1a2c; font-size:22px; line-height:1;
}

#pos-invoice-head{ padding:18px 18px 10px; text-align:center; }
#pos-invoice-head .t{ font-weight:900; letter-spacing:.08em; font-size:16px; }
#pos-invoice-head .shop{ font-weight:800; font-size:24px; margin-top:4px; }
#pos-invoice-head .date{ font-weight:700; font-size:22px; margin-top:2px; }
#pos-invoice-head .inv{ margin-top:6px; color:rgba(15,26,44,.55); font-weight:700; font-size:18px; }

#pos-customer{ padding:6px 18px 10px; }
#pos-customer select{
  width:100%;
  border:1px solid rgba(15,26,44,.14);
  border-radius:999px;
  padding:12px 44px 12px 16px;
  font-size:18px;
  font-weight:700;
  color:rgba(15,26,44,.65);
  background:#fff;
  appearance:none;
}
#pos-customer .caret{
  position:absolute; right:16px; top:50%; transform:translateY(-50%);
  color:rgba(15,26,44,.45); pointer-events:none; font-size:14px;
}
#pos-customer .wrap{ position:relative; }

#pos-invoice-list{
  padding:0 12px;
  overflow:auto;
  max-height:calc(100vh - 420px);
}

.pos-row{
  display:flex; justify-content:space-between; gap:12px;
  padding:12px;
  border-top:1px solid rgba(15,26,44,.10);
}
.pos-left{ display:flex; align-items:center; gap:12px; min-width:0; }
.pos-thumb{
  width:56px; height:56px; border-radius:16px;
  background:rgba(15,26,44,.06); overflow:hidden; flex:0 0 auto;
}
.pos-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.pos-meta{ min-width:0; }
.pos-cat{ font-weight:800; font-size:18px; line-height:1.05; }
.pos-name{ font-weight:700; font-size:18px; color:rgba(15,26,44,.78); margin-top:2px; }
.pos-sub{ font-weight:600; font-size:15px; color:rgba(15,26,44,.55); margin-top:2px; }
.pos-unit{ font-weight:700; font-size:15px; color:rgba(15,26,44,.45); margin-top:2px; }

.pos-right{ display:flex; align-items:center; gap:12px; flex:0 0 auto; }
.pos-qty{ display:inline-flex; align-items:center; gap:8px; }
.pos-qty button{
  width:34px; height:34px; border-radius:10px;
  border:1px solid rgba(15,26,44,.12); background:#fff;
  font-size:20px; font-weight:900; color:#007aff;
}
.pos-qty .val{
  width:34px; height:34px; border-radius:12px;
  border:1px solid rgba(15,26,44,.12); background:#fff;
  display:flex; align-items:center; justify-content:center;
  font-size:16px; font-weight:800; color:rgba(15,26,44,.75);
}
.pos-line-total{ font-size:22px; font-weight:900; min-width:96px; text-align:right; }

#pos-totals{
  border-top:1px solid rgba(15,26,44,.10);
  padding:12px 18px 6px;
}
#pos-totals .row{
  display:flex; justify-content:space-between;
  font-size:22px; font-weight:800; color:rgba(15,26,44,.72);
  padding:6px 0;
}
#pos-totals .row.total{
  font-size:34px; font-weight:1000; color:rgba(15,26,44,.95);
  padding-top:10px;
}

#pos-actions{ display:flex; gap:12px; padding:12px 18px 18px; }
#pos-actions button{
  border:0; border-radius:14px; padding:14px 18px;
  font-size:20px; font-weight:900; flex:1;
}
#pos-clear{ background:rgba(15,26,44,.06); color:#007aff; }
#pos-close{ background:#007aff; color:#fff; }

/* confirm sheet */
#pos-confirm-sheet{
  position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:min(720px, calc(100vw - 22px));
  border-radius:18px; background:#fff;
  box-shadow:0 22px 70px rgba(0,0,0,.25);
  padding:18px;
  color:#0f1a2c;
  font-weight:400;
}
#pos-confirm-sheet .title{ text-align:center; font-size:20px; font-weight:900; }
#pos-confirm-sheet .sub{
  margin-top:10px; text-align:center;
  color:rgba(15,26,44,.65); font-size:20px; font-weight:700;
}
#pos-confirm-sheet .buttons{ margin-top:14px; display:flex; gap:12px; }
#pos-confirm-sheet .buttons button{
  border:0; border-radius:14px; padding:14px 18px;
  font-size:20px; font-weight:900; flex:1;
}
#pos-confirm-cancel{ background:rgba(15,26,44,.06); color:#007aff; }
#pos-confirm-ok{ background:#007aff; color:#fff; }
    `;
    document.head.appendChild(style);
  };

  // -------------------------
  // DOM injection
  // -------------------------
  const ensureDom = () => {
    if (!$("#pos-invoice-fab")) {
      const fab = document.createElement("button");
      fab.id = "pos-invoice-fab";
      fab.type = "button";
      fab.setAttribute("aria-label", "Open invoice");
      fab.innerHTML = `
        <span id="pos-invoice-badge">0</span>
        <div class="fab" aria-hidden="true"><span>🧾</span></div>
      `;
      document.body.appendChild(fab);
    }

    if (!$("#pos-invoice-modal")) {
      const wrap = document.createElement("div");
      wrap.id = "pos-invoice-modal";
      wrap.innerHTML = `
        <div class="pos-backdrop" data-close="invoice"></div>
        <div id="pos-invoice-sheet" role="dialog" aria-modal="true" aria-label="Invoice">
          <button id="pos-invoice-x" type="button" data-close="invoice" aria-label="Close">×</button>

          <div id="pos-invoice-head">
            <div class="t">INVOICE</div>
            <div class="shop" id="pos-invoice-shop"></div>
            <div class="date" id="pos-invoice-date"></div>
            <div class="inv" id="pos-invoice-inv"></div>
          </div>

          <div id="pos-customer">
            <div class="wrap">
              <select id="pos-cust-select" aria-label="Attach Saved Customer">
                <option value="">Attach Saved Customer</option>
              </select>
              <span class="caret">▼</span>
            </div>
          </div>

          <div id="pos-invoice-list"></div>

          <div id="pos-totals">
            <div class="row"><span>Subtotal</span><span id="pos-subtotal">$0.00</span></div>
            <div class="row"><span>Tax</span><span id="pos-tax">$0.00</span></div>
            <div class="row total"><span>TOTAL</span><span id="pos-total">$0.00</span></div>
          </div>

          <div id="pos-actions">
            <button id="pos-clear" type="button">Clear</button>
            <button id="pos-close" type="button" data-close="invoice">Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
    }

    if (!$("#pos-confirm-modal")) {
      const c = document.createElement("div");
      c.id = "pos-confirm-modal";
      c.innerHTML = `
        <div class="pos-backdrop" data-close="confirm"></div>
        <div id="pos-confirm-sheet" role="dialog" aria-modal="true" aria-label="Add to Bill">
          <div class="title">Add to Bill</div>
          <div class="sub" id="pos-confirm-sub">—</div>
          <div class="buttons">
            <button id="pos-confirm-cancel" type="button" data-close="confirm">Cancel</button>
            <button id="pos-confirm-ok" type="button">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(c);
    }
  };

  // -------------------------
  // Modals
  // -------------------------
  const openInvoice = () => {
    $("#pos-invoice-modal")?.classList.add("is-open");
    renderInvoice();
  };

  const closeInvoice = () => {
    $("#pos-invoice-modal")?.classList.remove("is-open");
  };

  let confirmOnOk = null;

  const openConfirm = (label, onOk) => {
    confirmOnOk = typeof onOk === "function" ? onOk : null;
    $("#pos-confirm-sub").textContent = label || "";
    $("#pos-confirm-modal")?.classList.add("is-open");
  };

  const closeConfirm = () => {
    $("#pos-confirm-modal")?.classList.remove("is-open");
    confirmOnOk = null;
  };

  // -------------------------
  // Customers: load from /pos/pos-contacts.json (exists in your repo)
  // -------------------------
  const readCachedCustomers = () =>
    safeJsonParse(localStorage.getItem(CUST_CACHE_KEY) || "[]", []);

  const readAttachedCustomer = () =>
    safeJsonParse(localStorage.getItem(CUST_ATTACHED_KEY) || "null", null);

  const writeAttachedCustomer = (cust) => {
    if (!cust) localStorage.removeItem(CUST_ATTACHED_KEY);
    else localStorage.setItem(CUST_ATTACHED_KEY, JSON.stringify(cust));
  };

  const loadCustomers = async () => {
    // prefer cached
    const cached = readCachedCustomers();
    if (Array.isArray(cached) && cached.length) return cached;

    // fetch from file you have
    try {
      const res = await fetch("/pos/pos-contacts.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`contacts fetch failed: ${res.status}`);
      const data = await res.json();

      const list = Array.isArray(data) ? data : (Array.isArray(data.customers) ? data.customers : []);
      if (Array.isArray(list)) {
        localStorage.setItem(CUST_CACHE_KEY, JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.warn(e);
    }
    return [];
  };

  const buildCustomerSelect = async () => {
    const sel = $("#pos-cust-select");
    if (!sel) return;

    const customers = await loadCustomers();
    const attached = readAttachedCustomer();

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

    if (attached && customers.length) {
      const aName = attached.name || attached.fullName || attached.company || "";
      const matchIdx = customers.findIndex(c => {
        const cName = c.name || c.fullName || c.company || "";
        return aName && cName && aName === cName;
      });
      if (matchIdx >= 0) sel.value = String(matchIdx);
    }
  };

  // -------------------------
  // Rendering
  // -------------------------
  const updateBadge = () => {
    const items = readCart();
    const count = items.reduce((n, it) => n + Number(it.qty || 0), 0);
    const b = $("#pos-invoice-badge");
    if (b) b.textContent = String(count);
  };

  const renderInvoice = async () => {
    const items = readCart();

    $("#pos-invoice-shop").textContent = getShopName();
    $("#pos-invoice-date").textContent = todayLabel();
    $("#pos-invoice-inv").textContent = `INV# ${getInvoiceNumber()}`;

    await buildCustomerSelect();

    const list = $("#pos-invoice-list");
    if (!list) return;

    if (!items.length) {
      list.innerHTML = `<div style="padding:18px;text-align:center;color:rgba(15,26,44,.6);font-weight:600">No items yet.</div>`;
    } else {
      list.innerHTML = items.map((it, i) => {
        const cat = resolveCategory(it);
        const name = it.name || it.title || "Item";
        const sub = it.subtitle || it.vitola || "";
        const price = Number(it.price || 0);
        const qty = clampInt(it.qty || 1, 1, 999);
        const lineTotal = price * qty;
        const img = it.image || it.img || it.icon || "";

        return `
          <div class="pos-row" data-i="${i}">
            <div class="pos-left">
              <div class="pos-thumb">
                ${img ? `<img src="${img}" alt="" />` : ``}
              </div>
              <div class="pos-meta">
                <div class="pos-cat">${cat}</div>
                <div class="pos-name">${name}</div>
                ${sub ? `<div class="pos-sub">${sub}</div>` : ``}
                <div class="pos-unit">${money(price)}</div>
              </div>
            </div>

            <div class="pos-right">
              <div class="pos-qty">
                <button type="button" data-qty="dec" aria-label="Decrease">−</button>
                <div class="val" aria-label="Quantity">${qty}</div>
                <button type="button" data-qty="inc" aria-label="Increase">+</button>
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

    updateBadge();
  };

  // -------------------------
  // Add-to-cart
  // -------------------------
  const addItem = (item) => {
    if (!item) return;

    const items = readCart();
    const k = itemKey(item);
    const idx = items.findIndex(x => itemKey(x) === k);

    if (idx >= 0) {
      items[idx].qty = clampInt(Number(items[idx].qty || 0) + 1, 1, 999);
    } else {
      items.push({
        ...item,
        key: k,
        qty: clampInt(item.qty || 1, 1, 999),
        category: resolveCategory(item)
      });
    }

    writeCart(items);
    updateBadge();
    renderInvoice();
  };

  // -------------------------
  // Events
  // -------------------------
  const wireEvents = () => {
    // open invoice
    $("#pos-invoice-fab")?.addEventListener("click", (e) => {
      e.preventDefault();
      openInvoice();
    });

    // close invoice / confirm via backdrop + close buttons
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

    // confirm ok (ALWAYS closes)
    $("#pos-confirm-ok")?.addEventListener("click", (e) => {
      e.preventDefault();
      const fn = confirmOnOk;
      closeConfirm();
      try { fn && fn(); } catch (err) { console.error(err); }
    });

    // qty controls
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
      if (dir === "dec") {
        if (cur === 1) items.splice(i, 1);
        else items[i].qty = clampInt(cur - 1, 1, 999);
      }

      writeCart(items);
      renderInvoice();
    });

    // clear cart
    $("#pos-clear")?.addEventListener("click", () => {
      writeCart([]);
      updateBadge();
      renderInvoice();
    });

    // close button
    $("#pos-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeInvoice();
    });

    // customer select
    $("#pos-cust-select")?.addEventListener("change", async (e) => {
      const sel = e.currentTarget;
      const customers = await loadCustomers();
      const idx = sel.value === "" ? -1 : clampInt(sel.value, 0, customers.length - 1);
      if (idx < 0) writeAttachedCustomer(null);
      else writeAttachedCustomer(customers[idx] || null);
    });

    // global add-to-cart hook (existing POS uses data-receipt-item JSON)
    document.addEventListener("click", (e) => {
      const el = (e.target instanceof Element) ? e.target.closest("[data-receipt-item]") : null;
      if (!el) return;

      const raw = el.getAttribute("data-receipt-item");
      const item = safeJsonParse(raw, null);
      if (!item) return;

      // if confirm is requested by attribute or by item.confirm
      const wantsConfirm = el.hasAttribute("data-confirm-add") || item.confirm === true;

      if (wantsConfirm) {
        e.preventDefault();
        const cat = resolveCategory(item);
        const name = item.name || item.title || "Item";
        const price = money(item.price || 0);
        openConfirm(`${cat} • ${name} • ${price}`, () => addItem(item));
        return;
      }

      addItem(item);
    });
  };

  // -------------------------
  // Boot
  // -------------------------
  const init = () => {
    ensureInlineStyles();
    ensureDom();
    updateBadge();
    wireEvents();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
