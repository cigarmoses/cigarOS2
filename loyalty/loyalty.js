/* /loyalty/loyalty.js
   Loyalty page controller (SF Pro / iOS style)

   - Reads customers from localStorage: cigaros_customers_v1
   - Seeds from /loyalty/loyalty-contacts.json
   - Search + segmented modes (All / Regulars / Lockers)
   - A–Z index scroller (right)

   Fixes:
     ✅ Always seeds from loyalty-contacts.json (not pos-contacts.json)
     ✅ Auto-refreshes localStorage when source changes (so Regulars/icons work)
     ✅ Role icons show for x/X/y/Y/true/1/"word"/numbers
     ✅ Lockers tab sorts by locker number numeric
     ✅ Tier icon shows ONLY when Locker or Regular is marked (no default regular)
     ✅ Regulars tab ONLY includes explicit X under Regular (numbers/words no longer count)
     ✅ Row click goes to full-page detail: /loyalty/contact.html?id=...

   NEW (Loyalty master-page filters):
     ✅ Filters bottom-sheet (iOS-style)
     ✅ Role filters: Military / Police / Firefighter / Paramedic (AND logic)
     ✅ Fav Brands multi-select, sourced from /data/brands.json
     ✅ Applied filter chips + clear per chip
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

  // ✅ correct source for loyalty contacts
  const CONTACTS_JSON_URL = "/loyalty/loyalty-contacts.json";

  // ✅ store the source we used so we can refresh if it changes
  const CONTACTS_SOURCE_KEY = "cigaros_customers_source_v1";
  const CONTACTS_SOURCE_VALUE = CONTACTS_JSON_URL;

  // ✅ brand source (canonical)
  const BRANDS_JSON_URL = "/data/brands.json";

  // ✅ Icons are pulled from: /img/icons/loyalty/*.svg
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
  const azIndexEl = $("#azIndex");

  // chips
  const chipsEl = $("#chips");

  // Add customer button (only shown on All tab) + dialog
  const addBtn = $("#addCustomerBtn");
  const addDlg = $("#addCustomerDialog");
  const acFirst = $("#acFirst");
  const acLast = $("#acLast");
  const acPhone = $("#acPhone");
  const acEmail = $("#acEmail");
  const acCancel = $("#acCancel");
  const acSave = $("#acSave");

  const tonyFab = $("#tonyFab");

  // Filters sheet
  const filtersBtn = $("#filtersBtn");
  const filterBackdrop = $("#filterBackdrop");
  const filterSheet = $("#filterSheet");
  const filtersClose = $("#filtersClose");
  const filtersReset = $("#filtersReset");
  const filtersApply = $("#filtersApply");
  const brandSearchEl = $("#brandSearch");
  const brandListEl = $("#brandList");

  const roleButtons = Array.from(document.querySelectorAll(".pill-toggle[data-role]"));

  // ---------- state ----------
  let state = {
    mode: "all", // all | regular | lockers
    query: "",
    customers: [],
    sales: [],

    // filter data sources
    brandOptions: [],

    // active filters (applied)
    filters: {
      roles: {
        Military: false,
        Police: false,
        Firefighter: false,
        Paramedic: false,
      },
      brands: [], // selected brand names (canonical)
    },

    // draft filters (editing inside sheet)
    draftFilters: null,

    // brand search in sheet
    brandQuery: "",
  };

  // ---------- utils ----------
  const safeJSON = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
  const writeJSON = (key, val) => localStorage.setItem(key, JSON.stringify(val));
  const norm = (s) => (s || "").toString().trim().toLowerCase();
  const toStr = (v) => (v == null ? "" : String(v)).trim();

  function escapeHTML(s) {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Marker values that should count as "true" in icon columns.
  // Accept: x/X, y/Y, true, 1, "yes", or the word of the column itself ("military", "police", etc.)
  // Also: numbers like locker "8" should count as true.
  function isTruthyMarker(v, columnTitle) {
    if (v === true) return true;
    if (v === false || v == null) return false;

    const s = String(v).trim().toLowerCase();
    if (!s) return false;

    if (s === "0" || s === "no" || s === "false" || s === "n") return false;

    // common markers
    if (s === "x" || s === "y" || s === "1" || s === "yes" || s === "true") return true;

    // numbers (locker numbers etc.)
    if (/^\d+(\.\d+)?$/.test(s)) return true;

    // sometimes sheet contains the word itself
    const col = String(columnTitle || "").trim().toLowerCase();
    if (col && s === col) return true;

    // sometimes "regular", "military", etc appears in longer strings
    if (col && s.includes(col)) return true;

    // any other non-empty token counts as true
    return true;
  }

  // ✅ strict X marker (used ONLY for Regular tab)
  function isExplicitX(v) {
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === "x";
  }

  // checks multiple possible key variants (exact, lower, upper, no spaces)
  function hasColumnValue(obj, columnTitle) {
    if (!obj) return false;

    const k = columnTitle;
    const variants = [
      obj[k],
      obj[k?.toLowerCase()],
      obj[k?.toUpperCase()],
      obj[k?.replace(/\s+/g, "")],
      obj[k?.toLowerCase()?.replace(/\s+/g, "")],
    ];

    return variants.some((v) => isTruthyMarker(v, columnTitle));
  }

  // ✅ same variant lookup, but ONLY counts explicit "X"
  function hasExplicitX(obj, columnTitle) {
    if (!obj) return false;

    const k = columnTitle;
    const variants = [
      obj[k],
      obj[k?.toLowerCase()],
      obj[k?.toUpperCase()],
      obj[k?.replace(/\s+/g, "")],
      obj[k?.toLowerCase()?.replace(/\s+/g, "")],
    ];

    return variants.some((v) => isExplicitX(v));
  }

  function nickname(c) {
    return (c.nickname || c.nick || "").trim();
  }

  function lockerNumOnly(c) {
    const raw = String(
      c.lockerNumber ||
      c["Locker number"] ||
      c.locker ||
      c["Locker"] ||
      ""
    ).trim();
    const n = raw.replace(/\D+/g, "");
    return n || "";
  }

  // ---------- type / shading rules ----------
  function isLockerCustomer(c) {
    // Locker column marker OR lockerNumber present
    return hasColumnValue(c, "Locker") || !!lockerNumOnly(c);
  }

  function isRegularCustomer(c) {
    // ✅ ONLY true if Regular column is explicitly "X"
    return hasExplicitX(c, "Regular");
  }

  function buildIconHTML(iconNames) {
    return (iconNames || [])
      .filter(Boolean)
      .map((n) => (
        `<img class="loy-ico" src="${ICONS[n]}" alt="${escapeHTML(n)}" loading="lazy" />`
      ))
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

  function getTierIcon(c) {
    if (isLockerCustomer(c)) return "locker";
    if (isRegularCustomer(c)) return "regular";
    return null; // IMPORTANT: no default tier icon
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

      // ✅ Handle your curly-quote header too:
      const nick = toStr(
        r['Nickname AKA'] ??
        r['Nickname “aka”'] ??
        r['Nickname "aka"'] ??
        r['Nickname aka'] ??
        r.nickname ??
        r.nick
      );

      const phone    = toStr(r["Phone"] ?? r.phone);
      const email    = toStr(r["Email"] ?? r.email);
      const birthday = toStr(r["Birthday"] ?? r.birthday);

      const pointsRaw = r["Rewards"] ?? r.points ?? r["Points"];
      const points = Number(String(pointsRaw ?? "0").replace(/[^0-9.\-]/g, "")) || 0;

      // ✅ In your sheet, locker number is in the "Locker" column (numbers)
      const lockerNumber = toStr(
        r["Locker number"] ??
        r.lockerNumber ??
        r.locker ??
        r["Locker"] // IMPORTANT
      );

      // icon columns (preserve)
      const Military    = r["Military"] ?? r.Military ?? r["military"] ?? r.military;
      const Paramedic   = r["Paramedic"] ?? r.Paramedic ?? r["paramedic"] ?? r.paramedic;
      const Firefighter = r["Firefighter"] ?? r.Firefighter ?? r["firefighter"] ?? r.firefighter;
      const Police      = r["Police"] ?? r.Police ?? r["police"] ?? r.police;
      const Locker      = r["Locker"] ?? r.Locker ?? r["locker"] ?? r.locker;
      const Regular     = r["Regular"] ?? r.Regular ?? r["regular"] ?? r.regular;

      // ✅ preserve Fav brand 1..N columns if present (case-insensitive)
      const favBrandMap = {};
      Object.keys(r || {}).forEach((k) => {
        const key = String(k || "").trim();
        const lower = key.toLowerCase();
        if (lower.startsWith("fav brand")) {
          favBrandMap[key] = toStr(r[k]);
        }
      });

      return {
        id,
        firstName,
        lastName,
        nickname: nick,

        phone,
        email,
        birthday,

        points,

        lockerNumber: lockerNumber || "",

        // ICON COLUMNS (exact titles)
        Military,
        Paramedic,
        Firefighter,
        Police,
        Locker,
        Regular,

        // Fav brands (raw columns)
        ...favBrandMap,

        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  // ✅ seed OR refresh when source changes
  async function seedCustomersFromJSONIfNeeded() {
    const existing = readCustomers();
    const prevSource = localStorage.getItem(CONTACTS_SOURCE_KEY) || "";

    const shouldRefreshFromSource =
      !existing.length ||
      prevSource !== CONTACTS_SOURCE_VALUE;

    if (!shouldRefreshFromSource) return existing;

    try {
      const res = await fetch(CONTACTS_JSON_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch ${CONTACTS_JSON_URL} failed: ${res.status}`);
      const rows = await res.json();
      const normalized = normalizeContacts(rows);

      if (normalized.length) {
        writeCustomers(normalized);
        localStorage.setItem(CONTACTS_SOURCE_KEY, CONTACTS_SOURCE_VALUE);
      }

      return normalized;
    } catch (err) {
      console.warn("[Loyalty] Could not seed customers from JSON:", err);
      return existing;
    }
  }

  async function loadBrandsIfNeeded() {
    if (state.brandOptions && state.brandOptions.length) return state.brandOptions;

    try {
      const res = await fetch(BRANDS_JSON_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch ${BRANDS_JSON_URL} failed: ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      state.brandOptions = arr.map((x) => toStr(x)).filter(Boolean);
      return state.brandOptions;
    } catch (err) {
      console.warn("[Loyalty] Could not load brands.json:", err);
      state.brandOptions = [];
      return [];
    }
  }

  // ---------- favorites (brands) ----------
  function getCustomerFavBrands(c) {
    // Support either:
    // 1) Fav brand 1..N columns (preferred)
    // 2) favBrands array (future)
    const out = [];

    if (Array.isArray(c?.favBrands)) {
      c.favBrands.forEach((b) => {
        const v = toStr(b);
        if (v) out.push(v);
      });
    }

    Object.keys(c || {}).forEach((k) => {
      const lower = String(k || "").trim().toLowerCase();
      if (!lower.startsWith("fav brand")) return;
      const v = toStr(c[k]);
      if (v) out.push(v);
    });

    // normalize unique (case-insensitive)
    const seen = new Set();
    const uniq = [];
    out.forEach((b) => {
      const key = norm(b);
      if (!key || seen.has(key)) return;
      seen.add(key);
      uniq.push(b);
    });
    return uniq;
  }

  function intersectsSelectedBrands(customer, selected) {
    const sel = (selected || []).map(norm).filter(Boolean);
    if (!sel.length) return true;

    const fav = getCustomerFavBrands(customer).map(norm);
    if (!fav.length) return false;

    const setFav = new Set(fav);
    return sel.some((s) => setFav.has(s));
  }

  // ---------- filtering + sorting ----------
  function passesRoleFilters(c) {
    const roles = state.filters.roles || {};
    const need = Object.keys(roles).filter((k) => roles[k] === true);
    if (!need.length) return true;

    // AND logic across checked roles
    return need.every((roleName) => hasColumnValue(c, roleName));
  }

  function filteredCustomers() {
    const q = norm(state.query);
    let list = (state.customers || []).slice();

    // Segmented modes still apply first
    if (state.mode === "regular") {
      list = list.filter((c) => isRegularCustomer(c));
    } else if (state.mode === "lockers") {
      list = list.filter((c) => isLockerCustomer(c));
    }

    // NEW: applied filters (roles + brands)
    list = list.filter((c) => passesRoleFilters(c));
    list = list.filter((c) => intersectsSelectedBrands(c, state.filters.brands));

    // Search
    if (q) {
      list = list.filter((c) => {
        const hay = [
          `${(c.lastName || "").trim()}, ${(c.firstName || "").trim()}`.trim(),
          `${(c.firstName || "").trim()} ${(c.lastName || "").trim()}`.trim(),
          nickname(c),
          c.phone,
          c.email,
          c.lockerNumber,
          ...getCustomerFavBrands(c),
        ].map(norm).join(" ");
        return hay.includes(q);
      });
    }

    // Sort
    if (state.mode === "lockers") {
      list.sort((a, b) => {
        const na = Number(lockerNumOnly(a)) || 0;
        const nb = Number(lockerNumOnly(b)) || 0;
        if (na !== nb) return na - nb;

        const la = (a.lastName || "").trim();
        const lb = (b.lastName || "").trim();
        const fa = (a.firstName || "").trim();
        const fb = (b.firstName || "").trim();
        const c1 = la.localeCompare(lb);
        if (c1) return c1;
        return fa.localeCompare(fb);
      });
    } else {
      list.sort((a, b) => {
        const la = (a.lastName || "").trim();
        const lb = (b.lastName || "").trim();
        const fa = (a.firstName || "").trim();
        const fb = (b.firstName || "").trim();
        const c1 = la.localeCompare(lb);
        if (c1) return c1;
        return fa.localeCompare(fb);
      });
    }

    return list;
  }

  function goToContact(id) {
    window.location.href = `/loyalty/contact.html?id=${encodeURIComponent(String(id))}`;
  }

  // ---------- chips ----------
  function hasAnyActiveFilters() {
    const r = state.filters.roles || {};
    const anyRole = Object.keys(r).some((k) => r[k] === true);
    const anyBrands = (state.filters.brands || []).length > 0;
    return anyRole || anyBrands;
  }

  function setFiltersBtnState() {
    if (!filtersBtn) return;
    const on = hasAnyActiveFilters();
    filtersBtn.classList.toggle("active", on);
  }

  function renderChips() {
    if (!chipsEl) return;

    const parts = [];

    Object.keys(state.filters.roles || {}).forEach((k) => {
      if (state.filters.roles[k]) {
        parts.push({ type: "role", key: k, label: k });
      }
    });

    (state.filters.brands || []).forEach((b) => {
      parts.push({ type: "brand", key: b, label: b });
    });

    if (!parts.length) {
      chipsEl.style.display = "none";
      chipsEl.innerHTML = "";
      setFiltersBtnState();
      return;
    }

    chipsEl.style.display = "flex";
    chipsEl.innerHTML = parts.map((p) => `
      <span class="chip" data-type="${escapeHTML(p.type)}" data-key="${escapeHTML(p.key)}">
        ${escapeHTML(p.label)}
        <button type="button" aria-label="Remove">×</button>
      </span>
    `).join("");

    chipsEl.querySelectorAll(".chip button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const chip = e.currentTarget.closest(".chip");
        const type = chip?.getAttribute("data-type");
        const key = chip?.getAttribute("data-key") || "";
        if (!type) return;

        if (type === "role") {
          state.filters.roles[key] = false;
        } else if (type === "brand") {
          state.filters.brands = (state.filters.brands || []).filter((x) => norm(x) !== norm(key));
        }

        render();
      });
    });

    setFiltersBtnState();
  }

  // ---------- render list ----------
  function render() {
    const list = filteredCustomers();

    if (summaryEl) {
      const total = state.customers.length;
      const showing = list.length;
      summaryEl.textContent = `${showing} of ${total} customers`;
    }

    if (addBtn) addBtn.style.display = (state.mode === "all") ? "inline-flex" : "none";

    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">No customers found</div>`;
      buildAZIndex([]);
      renderChips();
      return;
    }

    listEl.innerHTML = list.map((c) => {
      const isLocker = isLockerCustomer(c);
      const isReg = isRegularCustomer(c);

      const rowClass =
        isLocker ? "row locker" :
        isReg    ? "row regular" :
                 "row";

      const first = (c.firstName || "").trim();
      const last  = (c.lastName || "").trim();

      const lockerPrefix = (state.mode === "lockers")
        ? `<span class="locker-num">${escapeHTML(lockerNumOnly(c) || c.lockerNumber || "")}</span>`
        : ``;

      const nameHTML = `
        ${lockerPrefix}
        <span class="name-last">${escapeHTML(last)}</span><span>, </span>
        <span class="name-first">${escapeHTML(first)}</span>
      `;

      const roleIcons = getRoleIcons(c);
      const tierIcon = getTierIcon(c);
      const icons = tierIcon ? [...roleIcons, tierIcon] : [...roleIcons];

      return `
        <div class="${rowClass}" data-id="${escapeHTML(c.id)}" role="button" tabindex="0">
          <div class="row-left">
            <div class="row-name">${nameHTML}</div>
          </div>
          <div class="row-right" aria-hidden="true">
            ${buildIconHTML(icons)}
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".row").forEach((row) => {
      const id = row.getAttribute("data-id");
      row.addEventListener("click", () => goToContact(id));
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToContact(id);
        }
      });
    });

    buildAZIndex(list);
    renderChips();
  }

  // ---------- A–Z index ----------
  function buildAZIndex(list) {
    if (!azIndexEl) return;

    const show = (state.mode !== "lockers") && list.length > 10;
    azIndexEl.style.display = show ? "flex" : "none";
    azIndexEl.innerHTML = "";
    if (!show) return;

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

    const firstIndexByLetter = {};
    list.forEach((c, idx) => {
      const last = (c.lastName || "").trim();
      const ch = (last[0] || "#").toUpperCase();
      const letter = /[A-Z]/.test(ch) ? ch : "#";
      if (firstIndexByLetter[letter] == null) firstIndexByLetter[letter] = idx;
    });

    azIndexEl.innerHTML = letters.map((L) => (
      `<div class="az-letter" data-letter="${L}">${L}</div>`
    )).join("");

    function scrollToLetter(letter) {
      const idx = firstIndexByLetter[letter];
      if (idx == null) return;

      const row = listEl?.querySelectorAll(".row")?.[idx];
      if (row) row.scrollIntoView({ block: "start" });

      azIndexEl.querySelectorAll(".az-letter").forEach((el) => el.classList.remove("active"));
      const active = azIndexEl.querySelector(`.az-letter[data-letter="${letter}"]`);
      if (active) active.classList.add("active");
    }

    let touching = false;
    const getLetterFromPoint = (clientY) => {
      const rect = azIndexEl.getBoundingClientRect();
      const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
      const per = rect.height / letters.length;
      const idx = Math.min(letters.length - 1, Math.floor(y / per));
      return letters[idx];
    };

    azIndexEl.addEventListener("touchstart", (e) => {
      touching = true;
      const L = getLetterFromPoint(e.touches[0].clientY);
      scrollToLetter(L);
      e.preventDefault();
    }, { passive: false });

    azIndexEl.addEventListener("touchmove", (e) => {
      if (!touching) return;
      const L = getLetterFromPoint(e.touches[0].clientY);
      scrollToLetter(L);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener("touchend", () => { touching = false; }, { passive: true });

    azIndexEl.querySelectorAll(".az-letter").forEach((el) => {
      el.addEventListener("click", () => scrollToLetter(el.getAttribute("data-letter")));
    });
  }

  // ---------- Filters sheet ----------
  function cloneFilters(src) {
    return {
      roles: {
        Military: !!src?.roles?.Military,
        Police: !!src?.roles?.Police,
        Firefighter: !!src?.roles?.Firefighter,
        Paramedic: !!src?.roles?.Paramedic,
      },
      brands: Array.isArray(src?.brands) ? src.brands.slice() : [],
    };
  }

  function openFilters() {
    if (!filterSheet || !filterBackdrop) return;

    state.draftFilters = cloneFilters(state.filters);
    state.brandQuery = "";
    if (brandSearchEl) brandSearchEl.value = "";

    // sync role buttons
    roleButtons.forEach((btn) => {
      const role = btn.getAttribute("data-role");
      const on = !!state.draftFilters.roles[role];
      btn.classList.toggle("on", on);
    });

    // build list
    renderBrandList();

    filterBackdrop.classList.add("open");
    filterSheet.classList.add("open");

    setTimeout(() => brandSearchEl?.focus?.(), 50);
  }

  function closeFilters() {
    if (!filterSheet || !filterBackdrop) return;
    filterSheet.classList.remove("open");
    filterBackdrop.classList.remove("open");
    state.draftFilters = null;
  }

  function resetDraftFilters() {
    if (!state.draftFilters) state.draftFilters = cloneFilters(state.filters);

    state.draftFilters.roles = { Military:false, Police:false, Firefighter:false, Paramedic:false };
    state.draftFilters.brands = [];

    roleButtons.forEach((btn) => btn.classList.remove("on"));
    state.brandQuery = "";
    if (brandSearchEl) brandSearchEl.value = "";
    renderBrandList();
  }

  function applyDraftFilters() {
    if (!state.draftFilters) return;
    state.filters = cloneFilters(state.draftFilters);
    closeFilters();
    render();
  }

  function toggleDraftRole(roleName) {
    if (!state.draftFilters) state.draftFilters = cloneFilters(state.filters);
    state.draftFilters.roles[roleName] = !state.draftFilters.roles[roleName];

    const btn = roleButtons.find((b) => b.getAttribute("data-role") === roleName);
    if (btn) btn.classList.toggle("on", !!state.draftFilters.roles[roleName]);
  }

  function toggleDraftBrand(brandName) {
    if (!state.draftFilters) state.draftFilters = cloneFilters(state.filters);

    const list = state.draftFilters.brands || [];
    const exists = list.some((b) => norm(b) === norm(brandName));

    state.draftFilters.brands = exists
      ? list.filter((b) => norm(b) !== norm(brandName))
      : [...list, brandName];

    renderBrandList();
  }

  function renderBrandList() {
    if (!brandListEl) return;

    const opts = (state.brandOptions || []).slice();
    const q = norm(state.brandQuery);
    const filtered = q
      ? opts.filter((b) => norm(b).includes(q))
      : opts;

    const selected = (state.draftFilters?.brands || []).map(norm);
    const selSet = new Set(selected);

    if (!filtered.length) {
      brandListEl.innerHTML = `<div class="brand-row"><div class="brand-name" style="color:#8e8e93;">No brands found</div></div>`;
      return;
    }

    const checkSVG = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 7L10 17l-5-5" fill="none" stroke="rgba(0,122,255,.95)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;

    brandListEl.innerHTML = filtered.slice(0, 250).map((b) => {
      const on = selSet.has(norm(b));
      return `
        <div class="brand-row ${on ? "on" : ""}" data-brand="${escapeHTML(b)}" role="button" tabindex="0">
          <div class="brand-name">${escapeHTML(b)}</div>
          <div class="brand-check">${checkSVG}</div>
        </div>
      `;
    }).join("");

    brandListEl.querySelectorAll(".brand-row").forEach((row) => {
      const brand = row.getAttribute("data-brand") || "";
      const toggle = () => toggleDraftBrand(brand);

      row.addEventListener("click", toggle);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  // ---------- add customer ----------
  function openAddCustomer() {
    if (!addDlg) return;
    acFirst && (acFirst.value = "");
    acLast && (acLast.value = "");
    acPhone && (acPhone.value = "");
    acEmail && (acEmail.value = "");
    addDlg.showModal();
    setTimeout(() => acFirst?.focus?.(), 50);
  }

  function closeAddCustomer() {
    if (!addDlg) return;
    if (addDlg.open) addDlg.close();
  }

  function saveNewCustomer() {
    const firstName = toStr(acFirst?.value);
    const lastName = toStr(acLast?.value);
    const phone = toStr(acPhone?.value);
    const email = toStr(acEmail?.value);

    if (!firstName && !lastName && !phone && !email) {
      closeAddCustomer();
      return;
    }

    const now = new Date().toISOString();
    const newCust = {
      id: `c_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      firstName,
      lastName,
      phone,
      email,
      birthday: "",
      nickname: "",
      points: 0,
      lockerNumber: "",
      Military: "",
      Paramedic: "",
      Firefighter: "",
      Police: "",
      Locker: "",
      Regular: "",

      // optional future-friendly favorites store
      favBrands: [],

      createdAt: now,
      updatedAt: now,
    };

    const current = readCustomers();
    current.push(newCust);
    writeCustomers(current);

    state.customers = current;
    closeAddCustomer();
    render();
    goToContact(newCust.id);

    window.dispatchEvent(new Event("cigaros:customers-changed"));
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

    addBtn?.addEventListener("click", openAddCustomer);
    acCancel?.addEventListener("click", closeAddCustomer);
    acSave?.addEventListener("click", saveNewCustomer);

    addDlg?.addEventListener("click", (e) => {
      const rect = addDlg.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) closeAddCustomer();
    });

    tonyFab?.addEventListener("click", () => {
      window.location.href = "/learn/";
    });

    // Filters
    filtersBtn?.addEventListener("click", openFilters);
    filtersClose?.addEventListener("click", closeFilters);
    filtersReset?.addEventListener("click", resetDraftFilters);
    filtersApply?.addEventListener("click", applyDraftFilters);

    filterBackdrop?.addEventListener("click", closeFilters);

    roleButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-role");
        if (!role) return;
        toggleDraftRole(role);
      });
    });

    brandSearchEl?.addEventListener("input", () => {
      state.brandQuery = brandSearchEl.value || "";
      renderBrandList();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeFilters();
    });

    window.addEventListener("storage", (e) => {
      if (e.key === CUSTOMERS_KEY || e.key === SALES_KEY) loadAndRender(true);
    });

    window.addEventListener("cigaros:customers-changed", () => loadAndRender(true));
    window.addEventListener("cigaros:sales-changed", () => loadAndRender(true));
  }

  // ---------- load ----------
  async function loadAndRender() {
    state.sales = readSales();
    state.customers = await seedCustomersFromJSONIfNeeded();

    // load brands once
    await loadBrandsIfNeeded();

    render();
  }

  // ---------- init ----------
  bindEvents();
  loadAndRender();
})();
