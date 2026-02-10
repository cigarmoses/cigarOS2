/* /loyalty/loyalty.js
   Loyalty page controller

   Requirements implemented:
   ✅ iOS-ish list typography handled in CSS (17px / 44px row)
   ✅ A–Z right sidebar index (tap/drag to jump)
   ✅ All: sorted by last name A–Z (no lockers-first)
   ✅ Regulars: ONLY if JSON column "Regular" is truthy
   ✅ Lockers: ONLY if locker marker OR locker number exists
   ✅ Lockers: sort by locker number 1–25
   ✅ Lockers list label: "23 Moses, Michael" (locker # before last name)
   ✅ Row shading ONLY by data:
      - locker -> blue
      - regular -> orange
   ✅ Role icons show (Military/Police/Paramedic/Firefighter) via robust key normalization
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

  // Normalize object keys to improve column matching (fixes missing icons)
  function normalizeKey(k) {
    return String(k || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function valueByColumn(obj, columnTitle) {
    if (!obj) return undefined;

    const want = normalizeKey(columnTitle);
    // fast path: exact
    if (Object.prototype.hasOwnProperty.call(obj, columnTitle)) return obj[columnTitle];

    // scan keys once (objects are small enough)
    for (const k of Object.keys(obj)) {
      if (normalizeKey(k) === want) return obj[k];
    }
    return undefined;
  }

  function truthyCell(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    if (!s) return false;
    if (s === "0" || s === "no" || s === "false" || s === "n") return false;
    return true; // x, X, yes, 1, any string => true
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
  // - locker ONLY if Locker column truthy OR locker # exists
  // - regular ONLY if Regular column truthy
  // - otherwise "other"
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

      // Preserve icon columns (whatever casing/spaces the source uses, we keep originals too)
      return {
        ...r,
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
    } // all = show everyone

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
        // locker number 1–25 first
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

    const fn = firstName(c);
    const ln = lastName(c);
    const lnNum = lockerNum(c);

    const nameLine =
      (state.mode === "lockers" && lnNum != null)
        ? `${lnNum} ${ln || "—"}, ${fn || "—"}`
        : `${ln || "—"}, ${fn || "—"}`;

    if (dlgName) dlgName.textContent = nameLine;

    const t = customerType(c);
    const typeLabel = t === "locker" ? "Locker" : (t === "regular" ? "Regular" : "Customer");
    const metaBits = [typeLabel];
    if (lnNum != null) metaBits.push(`Locker ${lnNum}`);
    dlgMeta.textContent = metaBits.join(" • ");

    const bodyBits = [];
    if (c.phone) bodyBits.push(`<div><b>Phone:</b> ${escapeHTML(toStr(c.phone))}</div>`);
    if (c.email) bodyBits.push(`<div style="margin-top:6px;"><b>Email:</b> ${escapeHTML(toStr(c.email))}</div>`);
    bodyBits.push(`<div style="margin-top:6px;"><b>Points:</b> ${escapeHTML(String(toNum(c.points || 0)))}</div>`);

    dlgBody.innerHTML = bodyBits.join("") || `<div style="color:#8e8e93;">No details available.</div>`;

    if (!dlg.open) dlg.showModal();
  }

  // ---------- A–Z index ----------
  const AZ = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","#"];

  function renderAZ(list) {
    if (!azEl) return;

    // always show the full alphabet like iOS
    azEl.innerHTML = AZ.map(ch => `<div class="az-letter" data-ch="${ch}">${ch}</div>`).join("");

    // Active letter highlight based on state.activeAZ
    if (state.activeAZ) {
      const el = azEl.querySelector(`.az-letter[data-ch="${state.activeAZ}"]`);
      if (el) el.classList.add("active");
    }

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

    // click
    azEl.querySelectorAll(".az-letter").forEach((node) => {
      node.addEventListener("click", (e) => {
        const ch = e.currentTarget.getAttribute("data-ch");
        if (ch) scrollToLetter(ch);
      });
    });

    // touch drag
    let dragging = false;

    const onTouch = (e) => {
      if (!dragging) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const ch = pickByY(t.clientY);
      scrollToLetter(ch);
      e.preventDefault();
    };

    azEl.addEventListener("touchstart", (e) => {
      dragging = true;
      const t = e.touches && e.touches[0];
      if (t) {
        const ch = pickByY(t.clientY);
        scrollToLetter(ch);
      }
      e.preventDefault();
    }, { passive: false });

    azEl.addEventListener("touchmove", onTouch, { passive: false });
    azEl.addEventListener("touchend", () => { dragging = false; }, { passive: true });
    azEl.addEventListener("touchcancel", () => { dragging = false; }, { passive: true });

    // mouse drag (desktop)
    let mdown = false;
    azEl.addEventListener("mousedown", (e) => {
      mdown = true;
      const ch = pickByY(e.clientY);
      scrollToLetter(ch);
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!mdown) return;
      const ch = pickByY(e.clientY);
      scrollToLetter(ch);
    });
    window.addEventListener("mouseup", () => { mdown = false; });
  }

  // ---------- render ----------
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
      renderAZ([]);
      return;
    }

    listEl.innerHTML = list.map((c) => {
      const t = customerType(c);

      // Shade by data only:
      const rowClass =
        t === "locker" ? "row locker" :
        t === "regular" ? "row regular" :
        "row";

      const fn = firstName(c);
      const ln = lastName(c);
      const lnNum = lockerNum(c);

      // Row label rules:
      // - Lockers tab: "23 Moses, Michael" (if locker number exists)
      // - Otherwise: "Moses, Michael"
      const label =
        (state.mode === "lockers" && lnNum != null)
          ? `<span class="name-last">${escapeHTML(String(lnNum))} ${escapeHTML(ln || "—")}</span><span class="name-first">, ${escapeHTML(fn || "—")}</span>`
          : `<span class="name-last">${escapeHTML(ln || "—")}</span><span class="name-first">, ${escapeHTML(fn || "—")}</span>`;

      // Icons: role icons + tier icon
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

    listEl.querySelectorAll(".row").forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-id");
        if (id) openDetails(id);
      });
    });

    renderAZ(list);
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

    tonyFab?.addEventListener("click", () => {
      window.location.href = "/learn/";
    });

    window.addEventListener("storage", (e) => {
      if (e.key === CUSTOMERS_KEY) loadAndRender();
    });
  }

  // ---------- load ----------
  async function loadAndRender() {
    state.customers = await seedCustomersFromJSONIfNeeded();
    render();
  }

  // ---------- init ----------
  bindEvents();
  loadAndRender();
})();
