/* /loyalty/loyalty.js
   Fixes:
   ✅ move icons left (CSS handles)
   ✅ lockers: locker # NOT bold + extra spacing (HTML spans + CSS)
   ✅ Regulars tab now works (truthy detection expanded)
   ✅ Add green + on All tab (creates customer -> localStorage)
   ✅ Role icons show (better key matching + truthy markers)
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
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
  const azEl = $("#azIndex");
  const tonyFab = $("#tonyFab");

  const addBtn = $("#addCustomerBtn");
  const addDlg = $("#addCustomerDialog");
  const acFirst = $("#acFirst");
  const acLast = $("#acLast");
  const acPhone = $("#acPhone");
  const acEmail = $("#acEmail");
  const acCancel = $("#acCancel");
  const acSave = $("#acSave");

  // ---------- state ----------
  let state = {
    mode: "all", // all | regular | lockers
    query: "",
    customers: [],
    activeAZ: null,
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

  function toStr(v) {
    return (v == null ? "" : String(v)).trim();
  }

  function toNum(v) {
    if (v == null) return 0;
    const t = String(v).trim();
    if (!t) return 0;
    const cleaned = t.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  // Normalize keys: "Regular ", "REGULAR", "Regulars", etc. map cleanly
  function normalizeKey(k) {
    return String(k || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function valueByColumn(obj, columnTitle) {
    if (!obj) return undefined;

    // exact
    if (Object.prototype.hasOwnProperty.call(obj, columnTitle)) return obj[columnTitle];

    // normalize scan
    const want = normalizeKey(columnTitle);
    for (const k of Object.keys(obj)) {
      if (normalizeKey(k) === want) return obj[k];
    }

    // small extra: sometimes exported keys become "regulars" instead of "regular"
    if (want === "regular") {
      for (const k of Object.keys(obj)) {
        if (normalizeKey(k) === "regulars") return obj[k];
      }
    }
    if (want === "locker") {
      for (const k of Object.keys(obj)) {
        if (normalizeKey(k) === "lockers") return obj[k];
      }
    }

    return undefined;
  }

  // Truthy markers (expanded): x / X / r / R / yes / 1 / true / any non-empty
  function truthyCell(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;

    const s = String(v).trim().toLowerCase();
    if (!s) return false;

    // explicit falsy strings
    if (["0", "no", "false", "n", "none", "null"].includes(s)) return false;

    // allow common markers
    if (["x", "yes", "y", "1", "true", "r"].includes(s)) return true;

    // any other non-empty string counts as true
    return true;
  }

  function hasColumnValue(obj, columnTitle) {
    return truthyCell(valueByColumn(obj, columnTitle));
  }

  function lockerNum(c) {
    const raw = toStr(c.lockerNumber ?? c.locker ?? valueByColumn(c, "Locker number"));
    const n = Number(String(raw).replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // ✅ Strict classification:
  // - locker if Locker column truthy OR locker number exists
  // - regular if Regular column truthy
  // - otherwise other
  function customerType(c) {
    if (hasColumnValue(c, "Locker") || lockerNum(c) != null) return "locker";
    if (hasColumnValue(c, "Regular")) return "regular";
    return "other";
  }

  function lastName(c) {
    return toStr(c.lastName ?? c["Last Name"] ?? valueByColumn(c, "Last Name"));
  }
  function firstName(c) {
    return toStr(c.firstName ?? c["First Name"] ?? valueByColumn(c, "First Name"));
  }

  function letterBucket(c) {
    const l = lastName(c);
    const ch = (l[0] || "").toUpperCase();
    return /[A-Z]/.test(ch) ? ch : "#";
  }

  // ---------- icons ----------
  function getRoleIcons(c) {
    const icons = [];
    if (hasColumnValue(c, "Military")) icons.push("military");
    if (hasColumnValue(c, "Police")) icons.push("police");
    if (hasColumnValue(c, "Paramedic")) icons.push("paramedic");
    if (hasColumnValue(c, "Firefighter")) icons.push("firefighter");
    return icons;
  }

  function getTierIcon(c) {
    const t = customerType(c);
    if (t === "locker") return "locker";
    if (t === "regular") return "regular";
    return null;
  }

  function buildIconHTML(iconNames) {
    return iconNames
      .filter(Boolean)
      .map((n) => `<img class="loy-ico" src="${ICONS[n]}" alt="${escapeHTML(n)}" loading="lazy" />`)
      .join("");
  }

  // ---------- data ----------
  function readCustomers() {
    const list = safeJSON(localStorage.getItem(CUSTOMERS_KEY), []);
    return Array.isArray(list) ? list : [];
  }

  function writeCustomers(list) {
    writeJSON(CUSTOMERS_KEY, list);
  }

  function normalizeContacts(rows) {
    const arr = Array.isArray(rows) ? rows : [];

    return arr.map((r, idx) => {
      const id = toStr(r.id) || `c_${idx}_${Math.random().toString(16).slice(2)}`;

      const fn = toStr(valueByColumn(r, "First Name") ?? r.firstName ?? r.FirstName);
      const ln = toStr(valueByColumn(r, "Last Name") ?? r.lastName ?? r.LastName);

      const phone = toStr(valueByColumn(r, "Phone") ?? r.phone);
      const email = toStr(valueByColumn(r, "Email") ?? r.email);

      const points = toNum(valueByColumn(r, "Rewards") ?? r.points);

      const lockerNumber = toStr(valueByColumn(r, "Locker number") ?? r.lockerNumber ?? r.locker);

      return {
        ...r,                 // keep ALL original columns (including icon columns)
        id,
        firstName: fn,
        lastName: ln,
        phone,
        email,
        points,
        lockerNumber: lockerNumber || "",
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

  // ---------- filtering + sorting ----------
  function filteredCustomers() {
    const q = norm(state.query);
    let list = (state.customers || []).slice();

    if (state.mode === "regular") {
      list = list.filter((c) => customerType(c) === "regular");
    } else if (state.mode === "lockers") {
      list = list.filter((c) => customerType(c) === "locker");
    } // all shows everyone

    if (q) {
      list = list.filter((c) => {
        const hay = [
          lastName(c),
          firstName(c),
          toStr(c.phone),
          toStr(c.email),
          toStr(c.lockerNumber),
        ].map(norm).join(" ");
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      if (state.mode === "lockers") {
        const an = lockerNum(a) ?? 999999;
        const bn = lockerNum(b) ?? 999999;
        if (an !== bn) return an - bn;
      }
      const al = norm(lastName(a));
      const bl = norm(lastName(b));
      if (al !== bl) return al.localeCompare(bl);

      const af = norm(firstName(a));
      const bf = norm(firstName(b));
      return af.localeCompare(bf);
    });

    return list;
  }

  // ---------- details dialog (simple) ----------
  function ensureDetailsDialog() {
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
      <div style="padding:14px 14px 12px; font-family: var(--font-text); background:#fff;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
          <div style="min-width:0;">
            <div id="dlgName" style="font-family: var(--font-display); font-weight:800; font-size:20px; line-height:1.2;"></div>
            <div id="dlgMeta" style="margin-top:4px; font-size:13px; color:#8e8e93;"></div>
          </div>
          <button id="dlgClose" type="button"
            style="border:none; background:transparent; font-size:16px; padding:6px 10px; cursor:pointer;">✕</button>
        </div>

        <div id="dlgBody" style="margin-top:10px; font-size:14px; color:#111; line-height:1.35;"></div>

        <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(0,0,0,.08); display:flex; justify-content:flex-end;">
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

    const dlg = ensureDetailsDialog();
    const dlgName = dlg.querySelector("#dlgName");
    const dlgMeta = dlg.querySelector("#dlgMeta");
    const dlgBody = dlg.querySelector("#dlgBody");

    const fn = firstName(c);
    const ln = lastName(c);
    const num = lockerNum(c);

    if (dlgName) dlgName.textContent = `${ln || "—"}, ${fn || "—"}`;

    const t = customerType(c);
    const typeLabel = t === "locker" ? "Locker" : (t === "regular" ? "Regular" : "Customer");
    dlgMeta.textContent = num ? `${typeLabel} • Locker ${num}` : typeLabel;

    const bodyBits = [];
    if (c.phone) bodyBits.push(`<div><b>Cell:</b> ${escapeHTML(toStr(c.phone))}</div>`);
    if (c.email) bodyBits.push(`<div style="margin-top:6px;"><b>Email:</b> ${escapeHTML(toStr(c.email))}</div>`);
    dlgBody.innerHTML = bodyBits.join("") || `<div style="color:#8e8e93;">No details available.</div>`;

    if (!dlg.open) dlg.showModal();
  }

  // ---------- A–Z index ----------
  const AZ = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","#"];

  function renderAZ(list) {
    if (!azEl) return;

    azEl.innerHTML = AZ.map(ch => `<div class="az-letter" data-ch="${ch}">${ch}</div>`).join("");

    const scrollToLetter = (ch) => {
      const target = document.querySelector(`.row[data-letter="${ch}"]`);
      if (target) {
        target.scrollIntoView({ block: "start" });
        state.activeAZ = ch;
        azEl.querySelectorAll(".az-letter").forEach(x => x.classList.remove("active"));
        const el = azEl.querySelector(`.az-letter[data-ch="${ch}"]`);
        if (el) el.classList.add("active");
      }
    };

    const pickByY = (clientY) => {
      const rect = azEl.getBoundingClientRect();
      const y = Math.min(Math.max(clientY - rect.top, 0), rect.height - 1);
      const idx = Math.floor((y / rect.height) * AZ.length);
      return AZ[Math.min(Math.max(idx, 0), AZ.length - 1)];
    };

    azEl.querySelectorAll(".az-letter").forEach((node) => {
      node.addEventListener("click", (e) => {
        const ch = e.currentTarget.getAttribute("data-ch");
        if (ch) scrollToLetter(ch);
      });
    });

    let dragging = false;

    azEl.addEventListener("touchstart", (e) => {
      dragging = true;
      const t = e.touches && e.touches[0];
      if (t) scrollToLetter(pickByY(t.clientY));
      e.preventDefault();
    }, { passive: false });

    azEl.addEventListener("touchmove", (e) => {
      if (!dragging) return;
      const t = e.touches && e.touches[0];
      if (t) scrollToLetter(pickByY(t.clientY));
      e.preventDefault();
    }, { passive: false });

    azEl.addEventListener("touchend", () => { dragging = false; }, { passive: true });
    azEl.addEventListener("touchcancel", () => { dragging = false; }, { passive: true });
  }

  // ---------- Add customer ----------
  function showAddButton() {
    if (!addBtn) return;
    addBtn.style.display = (state.mode === "all") ? "inline-flex" : "none";
  }

  function openAddDialog() {
    if (!addDlg) return;
    acFirst.value = "";
    acLast.value = "";
    acPhone.value = "";
    acEmail.value = "";
    addDlg.showModal();
    setTimeout(() => acFirst?.focus(), 0);
  }

  function closeAddDialog() {
    if (!addDlg) return;
    if (addDlg.open) addDlg.close();
  }

  function addCustomer() {
    const first = toStr(acFirst?.value);
    const last = toStr(acLast?.value);
    const phone = toStr(acPhone?.value);
    const email = toStr(acEmail?.value);

    // minimal validation
    if (!first && !last && !phone && !email) return;

    const now = new Date().toISOString();
    const id = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const newCustomer = {
      id,
      firstName: first,
      lastName: last,
      phone,
      email,
      points: 0,
      lockerNumber: "",

      // default: not regular, not locker
      Regular: "",
      Locker: "",

      createdAt: now,
      updatedAt: now,
    };

    state.customers = [newCustomer, ...(state.customers || [])];
    writeCustomers(state.customers);
    closeAddDialog();
    render();
  }

  // ---------- render ----------
  function render() {
    const list = filteredCustomers();

    showAddButton();

    if (summaryEl) {
      const total = state.customers.length;
      const showing = list.length;
      summaryEl.textContent = `${showing} of ${total} customers`;
    }

    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">No customers found</div>`;
      renderAZ([]);
      return;
    }

    listEl.innerHTML = list.map((c) => {
      const t = customerType(c);

      const rowClass =
        t === "locker" ? "row locker" :
        t === "regular" ? "row regular" :
        "row";

      const fn = firstName(c);
      const ln = lastName(c);
      const num = lockerNum(c);

      // lockers tab label: number not bold + more space
      const label =
        (state.mode === "lockers" && num != null)
          ? `<span class="locker-num">${escapeHTML(String(num))}</span><span class="name-last">${escapeHTML(ln || "—")}</span><span class="name-first">, ${escapeHTML(fn || "—")}</span>`
          : `<span class="name-last">${escapeHTML(ln || "—")}</span><span class="name-first">, ${escapeHTML(fn || "—")}</span>`;

      const roleIcons = getRoleIcons(c);
      const tierIcon = getTierIcon(c);
      const icons = [...roleIcons, tierIcon].filter(Boolean);

      const bucket = letterBucket(c);

      return `
        <div class="${rowClass}" data-id="${escapeHTML(c.id)}" data-letter="${bucket}">
          <div class="row-left">
            <div class="row-name">${label}</div>
          </div>
          <div class="row-right" aria-hidden="true">
            ${buildIconHTML(icons)}
          </div>
        </div>
      `;
    }).join("");

    // Click row -> details
    listEl.querySelectorAll(".row").forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-id");
        if (id) openDetails(id);
      });
    });

    renderAZ(list);

    // Debug: if role icons still never appear, it's data not icons
    // (tier icons should always show if regular/locker)
    const anyRole = list.some(c => getRoleIcons(c).length > 0);
    if (!anyRole) {
      // This helps confirm whether the data actually has markers
      console.warn("[Loyalty] No role markers detected in Military/Police/Paramedic/Firefighter columns.");
    }
  }

  // ---------- init/load ----------
  async function loadAndRender() {
    state.customers = await seedCustomersFromJSONIfNeeded();

    // quick icon existence check (if these 404, role icons can't show)
    // This won’t block anything; just logs.
    ["military","police","paramedic","firefighter"].forEach((k) => {
      const img = new Image();
      img.onload = () => {};
      img.onerror = () => console.warn(`[Loyalty] Missing icon file: ${ICONS[k]}`);
      img.src = ICONS[k];
    });

    render();
  }

  // ---------- events ----------
  function bindEvents() {
    modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        modeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.mode = btn.getAttribute("data-mode") || "all";
        state.activeAZ = null;
        render();
      });
    });

    searchEl?.addEventListener("input", () => {
      state.query = searchEl.value || "";
      state.activeAZ = null;
      render();
    });

    addBtn?.addEventListener("click", openAddDialog);
    acCancel?.addEventListener("click", closeAddDialog);
    acSave?.addEventListener("click", addCustomer);

    // Enter key saves in add dialog
    addDlg?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCustomer();
      }
      if (e.key === "Escape") closeAddDialog();
    });

    tonyFab?.addEventListener("click", () => {
      window.location.href = "/learn/";
    });

    window.addEventListener("storage", (e) => {
      if (e.key === CUSTOMERS_KEY) loadAndRender();
    });
  }

  bindEvents();
  loadAndRender();
})();
