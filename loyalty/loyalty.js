/* /loyalty/loyalty.js
   Loyalty page controller (SF Pro / iOS style)

   FIXES (as requested):
   ✅ All: sorted by LAST name A–Z (no lockers-first)
   ✅ Regulars: ONLY explicitly-marked regulars (does NOT default everyone to regular)
   ✅ Lockers: sorted by locker number 1–25, and locker number appears BEFORE last name
   ✅ List rows have NO subtitles (details show on tap)

   Data:
   - Reads customers from localStorage: cigaros_customers_v1
   - Seeds from /pos/pos-contacts.json if localStorage is empty

   ICON RULE:
   - Columns labeled: Military, Paramedic, Firefighter, Police, Locker, Regular
   - If column has ANY value -> show that icon
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";
  const CONTACTS_JSON_URL = "/pos/pos-contacts.json";

  const ICON_BASE = "/img/icons/loyalty/";
  const ICONS = {
    military: `${ICON_BASE}military.svg`,
    paramedic: `${ICON_BASE}paramedic.svg`,
    firefighter: `${ICON_BASE}firefighter.svg`,
    police: `${ICON_BASE}police.svg`,
    locker: `${ICON_BASE}locker.svg`,
    regular: `${ICON_BASE}regular.svg`,
  };

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);

  const listEl = $("#list");
  const summaryEl = $("#summary");
  const searchEl = $("#search");
  const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
  const tonyFab = $("#tonyFab");

  // ---------- state ----------
  let state = {
    mode: "all", // all | regular | lockers
    query: "",
    customers: [],
    sales: [],
  };

  // ---------- utils ----------
  const safeJSON = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
  const writeJSON = (key, val) => localStorage.setItem(key, JSON.stringify(val));
  const norm = (s) => (s || "").toString().trim().toLowerCase();

  function escapeHTML(s) {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toNum(v) {
    if (v == null) return 0;
    const t = String(v).trim();
    if (!t) return 0;
    const cleaned = t.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function toStr(v) {
    return (v == null ? "" : String(v)).trim();
  }

  function lockerNum(c) {
    const raw = toStr(c.lockerNumber ?? c.locker ?? c["Locker number"] ?? "");
    const n = Number(String(raw).replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // ---------- column-based icon detection ----------
  function hasColumnValue(obj, columnTitle) {
    if (!obj) return false;

    const variants = [
      obj[columnTitle],
      obj[columnTitle.toLowerCase()],
      obj[columnTitle.toUpperCase()],
      obj[columnTitle.replace(/\s+/g, "")],
      obj[columnTitle.toLowerCase().replace(/\s+/g, "")]
    ];

    return variants.some(v => {
      if (v === true) return true;
      if (v === false || v == null) return false;
      const s = String(v).trim().toLowerCase();
      return s !== "" && s !== "0" && s !== "no";
    });
  }

  // ✅ IMPORTANT CHANGE:
  // - locker if Locker column OR lockerNumber exists
  // - regular ONLY if Regular column has value
  // - otherwise "other" (so Regulars tab doesn't capture everyone)
  function customerType(c) {
    if (hasColumnValue(c, "Locker") || lockerNum(c) != null) return "locker";
    if (hasColumnValue(c, "Regular")) return "regular";
    return "other";
  }

  function buildIconHTML(iconNames) {
    return iconNames
      .filter(Boolean)
      .map((n) => `<img class="loy-ico" src="${ICONS[n]}" alt="${escapeHTML(n)}" loading="lazy" />`)
      .join("");
  }

  function getRoleIcons(c) {
    const icons = [];
    if (hasColumnValue(c, "Military")) icons.push("military");
    if (hasColumnValue(c, "Paramedic")) icons.push("paramedic");
    if (hasColumnValue(c, "Firefighter")) icons.push("firefighter");
    if (hasColumnValue(c, "Police")) icons.push("police");
    return icons;
  }

  // ✅ Tier icon only for locker/regular
  function getTierIcon(c) {
    const t = customerType(c);
    if (t === "locker") return "locker";
    if (t === "regular") return "regular";
    return null;
  }

  // ---------- data access ----------
  function readCustomers() {
    const list = safeJSON(localStorage.getItem(CUSTOMERS_KEY), []);
    return Array.isArray(list) ? list : [];
  }

  function writeCustomers(list) {
    writeJSON(CUSTOMERS_KEY, list);
  }

  function readSales() {
    const list = safeJSON(localStorage.getItem(SALES_KEY), []);
    return Array.isArray(list) ? list : [];
  }

  function normalizeContacts(rows) {
    const arr = Array.isArray(rows) ? rows : [];

    return arr.map((r, idx) => {
      const id = toStr(r.id) || `c_${idx}_${Math.random().toString(16).slice(2)}`;

      const firstName = toStr(r["First Name"] ?? r.firstName ?? r.FirstName);
      const lastName  = toStr(r["Last Name"] ?? r.lastName ?? r.LastName);

      const phone     = toStr(r["Phone"] ?? r.phone);
      const email     = toStr(r["Email"] ?? r.email);

      const points    = toNum(r["Rewards"] ?? r.points);
      const lockerNumber = toStr(r["Locker number"] ?? r.lockerNumber ?? r.locker);

      const Military = r["Military"] ?? r.Military ?? r["military"] ?? r.military;
      const Paramedic = r["Paramedic"] ?? r.Paramedic ?? r["paramedic"] ?? r.paramedic;
      const Firefighter = r["Firefighter"] ?? r.Firefighter ?? r["firefighter"] ?? r.firefighter;
      const Police = r["Police"] ?? r.Police ?? r["police"] ?? r.police;
      const Locker = r["Locker"] ?? r.Locker ?? r["locker"] ?? r.locker;
      const Regular = r["Regular"] ?? r.Regular ?? r["regular"] ?? r.regular;

      return {
        id,
        firstName,
        lastName,
        phone,
        email,
        points,
        lockerNumber: lockerNumber || "",

        // ICON COLUMNS (exact titles)
        Military,
        Paramedic,
        Firefighter,
        Police,
        Locker,
        Regular,

        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async function seedCustomersFromJSONIfNeeded() {
    const existing = readCustomers();
    if (existing.length) return existing;

    try {
      const res = await fetch(CONTACTS_JSON_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch ${CONTACTS_JSON_URL} failed: ${res.status}`);
      const rows = await res.json();
      const normalized = normalizeContacts(rows);
      if (normalized.length) writeCustomers(normalized);
      return normalized;
    } catch (err) {
      console.warn("[Loyalty] Could not seed customers from JSON:", err);
      return existing;
    }
  }

  // ---------- filtering ----------
  function filteredCustomers() {
    const q = norm(state.query);
    let list = (state.customers || []).slice();

    if (state.mode === "regular") {
      list = list.filter((c) => customerType(c) === "regular");
    } else if (state.mode === "lockers") {
      list = list.filter((c) => customerType(c) === "locker");
    } // all = show everything (locker + regular + other)

    if (q) {
      list = list.filter((c) => {
        const hay = [
          c.lastName,
          c.firstName,
          c.phone,
          c.email,
          c.lockerNumber,
        ].map(norm).join(" ");
        return hay.includes(q);
      });
    }

    // ✅ SORT RULES (as requested)
    list.sort((a, b) => {
      if (state.mode === "lockers") {
        // locker number 1–25, then last/first
        const an = lockerNum(a) ?? 999999;
        const bn = lockerNum(b) ?? 999999;
        if (an !== bn) return an - bn;

        const al = norm(a.lastName);
        const bl = norm(b.lastName);
        if (al !== bl) return al.localeCompare(bl);
        return norm(a.firstName).localeCompare(norm(b.firstName));
      }

      // All + Regulars: last name A–Z, then first
      const al = norm(a.lastName);
      const bl = norm(b.lastName);
      if (al !== bl) return al.localeCompare(bl);
      return norm(a.firstName).localeCompare(norm(b.firstName));
    });

    return list;
  }

  // ---------- details dialog ----------
  function ensureDialog() {
    let dlg = $("#loyDetailsDialog");
    if (dlg) return dlg;

    const el = document.createElement("dialog");
    el.id = "loyDetailsDialog";
    el.style.border = "none";
    el.style.borderRadius = "16px";
    el.style.padding = "0";
    el.style.maxWidth = "520px";
    el.style.width = "92vw";
    el.style.boxShadow = "0 20px 60px rgba(0,0,0,.25)";

    el.innerHTML = `
      <div style="padding:14px 14px 12px; font-family: var(--font-text);">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
          <div style="min-width:0;">
            <div id="dlgName" style="font-family: var(--font-display); font-weight:800; font-size:20px; line-height:1.2;"></div>
            <div id="dlgMeta" style="margin-top:4px; font-size:13px; color:#8e8e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
          </div>
          <button id="dlgClose" type="button"
            style="border:none; background:transparent; font-size:16px; padding:6px 10px; cursor:pointer;">✕</button>
        </div>

        <div id="dlgBody" style="margin-top:10px; font-size:14px; color:#111; line-height:1.35;"></div>

        <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(0,0,0,.08); display:flex; justify-content:flex-end; gap:10px;">
          <button id="dlgOk" type="button"
            style="border:none; background:#007aff; color:#fff; font-weight:600; padding:10px 14px; border-radius:12px; cursor:pointer;">
            Done
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(el);

    const close = () => { if (el.open) el.close(); };
    el.querySelector("#dlgClose")?.addEventListener("click", close);
    el.querySelector("#dlgOk")?.addEventListener("click", close);

    el.addEventListener("click", (e) => {
      const rect = el.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) close();
    });

    return el;
  }

  function openDetails(customerId) {
    const c = state.customers.find(x => String(x.id) === String(customerId));
    if (!c) return;

    const dlg = ensureDialog();
    const dlgName = dlg.querySelector("#dlgName");
    const dlgMeta = dlg.querySelector("#dlgMeta");
    const dlgBody = dlg.querySelector("#dlgBody");

    const first = (c.firstName || "").trim();
    const last  = (c.lastName || "").trim();
    const ln = lockerNum(c);

    const nameLine = ln != null
      ? `${ln} ${last || "—"}, ${first || "—"}`
      : `${last || "—"}, ${first || "—"}`;

    if (dlgName) dlgName.textContent = nameLine;

    const t = customerType(c);
    const typeLabel = t === "locker" ? "Locker" : (t === "regular" ? "Regular" : "Customer");
    const metaBits = [typeLabel];
    if (ln != null) metaBits.push(`Locker ${ln}`);
    dlgMeta.textContent = metaBits.join(" • ");

    const bodyBits = [];
    if (c.phone) bodyBits.push(`<div><b>Phone:</b> ${escapeHTML(c.phone)}</div>`);
    if (c.email) bodyBits.push(`<div style="margin-top:6px;"><b>Email:</b> ${escapeHTML(c.email)}</div>`);
    bodyBits.push(`<div style="margin-top:6px;"><b>Points:</b> ${escapeHTML(String(Number(c.points || 0)))}</div>`);

    dlgBody.innerHTML = bodyBits.join("") || `<div style="color:#8e8e93;">No details available.</div>`;

    if (!dlg.open) dlg.showModal();
  }

  // ---------- render list ----------
  function render() {
    const list = filteredCustomers();

    if (summaryEl) {
      const total = state.customers.length;
      const showing = list.length;
      summaryEl.textContent = `${showing} of ${total} customers`;
    }

    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">No customers found</div>`;
      return;
    }

    listEl.innerHTML = list.map((c) => {
      const t = customerType(c);
      const rowClass = t === "locker" ? "row locker" : (t === "regular" ? "row regular" : "row regular");

      const first = (c.firstName || "").trim();
      const last  = (c.lastName || "").trim();
      const ln = lockerNum(c);

      // ✅ ROW TITLE RULES
      // Lockers tab + locker customers: "14 Armistead, Robin"
      // Everyone else: "Armistead, Robin"
      const title = (t === "locker" && ln != null)
        ? `<span class="name-last">${escapeHTML(String(ln))} ${escapeHTML(last || "—")}</span><span class="name-first">, ${escapeHTML(first || "—")}</span>`
        : `<span class="name-last">${escapeHTML(last || "—")}</span><span class="name-first">, ${escapeHTML(first || "—")}</span>`;

      const roleIcons = getRoleIcons(c);
      const tierIcon = getTierIcon(c); // null for "other"
      const icons = [...roleIcons, tierIcon].filter(Boolean);

      return `
        <div class="${rowClass}" data-id="${escapeHTML(c.id)}">
          <div class="row-left">
            <div class="row-name">${title}</div>
          </div>
          <div class="row-right" aria-hidden="true">
            ${buildIconHTML(icons)}
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".row").forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-id");
        openDetails(id);
      });
    });
  }

  // ---------- events ----------
  function bindEvents() {
    modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        modeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.mode = btn.getAttribute("data-mode") || "all";
        render();
      });
    });

    searchEl?.addEventListener("input", () => {
      state.query = searchEl.value || "";
      render();
    });

    tonyFab?.addEventListener("click", () => {
      window.location.href = "/learn/";
    });

    window.addEventListener("storage", (e) => {
      if (e.key === CUSTOMERS_KEY || e.key === SALES_KEY) loadAndRender();
    });

    window.addEventListener("cigaros:customers-changed", () => loadAndRender());
    window.addEventListener("cigaros:sales-changed", () => loadAndRender());
  }

  // ---------- load ----------
  async function loadAndRender() {
    state.sales = readSales();
    state.customers = await seedCustomersFromJSONIfNeeded();
    render();
  }

  // ---------- init ----------
  bindEvents();
  loadAndRender();
})();
