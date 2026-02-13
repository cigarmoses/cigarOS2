/* /loyalty/loyalty.js
   Loyalty page controller (SF Pro / iOS style)

   - Reads customers from localStorage: cigaros_customers_v1
   - Seeds from /loyalty/loyalty-contacts.json if localStorage is empty
   - Search + segmented modes (All / Regulars / Lockers)
   - A–Z index scroller (right)
   - Customer profile dialog (iOS-style layout)

   ICON RULE:
   - Columns are labeled with icon names: Military, Paramedic, Firefighter, Police, Locker, Regular
   - If that column contains ANY marker (x/X/y/Y/1/true/yes or any non-empty value) -> show the icon

   IMPORTANT FIXES IN THIS VERSION:
   ✅ Uses absolute icon paths: /img/icons/loyalty/{name}.svg (no relative path weirdness)
   ✅ Seeds from /loyalty/loyalty-contacts.json (your new file)
   ✅ Column detection is robust to: casing, spaces, underscores, hyphens, trailing spaces
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

  // ✅ your new contacts file (Netlify-served)
  const CONTACTS_JSON_URL = "/loyalty/loyalty-contacts.json";

  // ✅ absolute path so it always works regardless of routing depth
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

  // Add customer button (only shown on All tab) + dialog
  const addBtn = $("#addCustomerBtn");
  const addDlg = $("#addCustomerDialog");
  const acFirst = $("#acFirst");
  const acLast = $("#acLast");
  const acPhone = $("#acPhone");
  const acEmail = $("#acEmail");
  const acCancel = $("#acCancel");
  const acSave = $("#acSave");

  // Profile dialog
  const dialog = $("#profileDialog");
  const pName = $("#pName");
  const pAka = $("#pAka");
  const pTier = $("#pTier");
  const pPointsPill = $("#pPointsPill");
  const pDetails = $("#pDetails");
  const pCloseX = $("#pCloseX");

  const tonyFab = $("#tonyFab");

  // ---------- state ----------
  let state = {
    mode: "all", // all | regular | lockers
    query: "",
    customers: [],
    sales: [],
    activeCustomerId: null,
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

  // normalize a key so we can match weird Excel/export variations
  function normKey(k) {
    return String(k || "")
      .trim()
      .toLowerCase()
      .replace(/[\s\-_]+/g, ""); // remove spaces/underscores/hyphens
  }

  // build a normalized lookup map for a row object
  function buildKeyMap(obj) {
    const m = Object.create(null);
    if (!obj || typeof obj !== "object") return m;

    for (const k of Object.keys(obj)) {
      const nk = normKey(k);
      if (!nk) continue;
      // first one wins (stable)
      if (m[nk] === undefined) m[nk] = obj[k];
    }
    return m;
  }

  // Marker values that should count as "true" in icon columns.
  function isTruthyMarker(v, columnTitle) {
    if (v === true) return true;
    if (v === false || v == null) return false;

    const s = String(v).trim().toLowerCase();
    if (!s) return false;

    if (s === "0" || s === "no" || s === "false" || s === "n") return false;

    // common markers
    if (s === "x" || s === "y" || s === "1" || s === "yes" || s === "true") return true;

    // sometimes sheet contains the word itself (or includes it)
    const col = String(columnTitle || "").trim().toLowerCase();
    if (col && (s === col || s.includes(col))) return true;

    // any other non-empty token counts as true
    return true;
  }

  // ✅ robust column detection (handles trailing spaces, weird casing, underscores, etc.)
  function hasColumnValue(obj, columnTitle) {
    if (!obj) return false;

    // fast-paths (exact/typical)
    const direct = obj[columnTitle];
    if (isTruthyMarker(direct, columnTitle)) return true;

    // normalized lookup
    const map = buildKeyMap(obj);
    const v = map[normKey(columnTitle)];
    return isTruthyMarker(v, columnTitle);
  }

  function nickname(c) {
    return (c.nickname || c.nick || "").trim();
  }

  function lockerNumOnly(c) {
    const raw =
      String(
        c.lockerNumber ||
        c["Locker number"] ||
        c["Locker Number"] ||
        c.locker ||
        ""
      ).trim();
    const n = raw.replace(/\D+/g, "");
    return n || "";
  }

  // ---------- type / shading rules ----------
  function isLockerCustomer(c) {
    return hasColumnValue(c, "Locker") || !!lockerNumOnly(c);
  }

  function isRegularCustomer(c) {
    return hasColumnValue(c, "Regular");
  }

  function buildIconHTML(iconNames) {
    if (!iconNames || !iconNames.length) return "";
    return iconNames.map((n) => (
      `<img class="loy-ico" src="${ICONS[n]}" alt="${escapeHTML(n)}" loading="lazy" />`
    )).join("");
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
    return null; // no default tier icon
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
      const nick      = toStr(r["Nickname AKA"] ?? r.nickname ?? r.nick);

      const phone     = toStr(r["Phone"] ?? r.phone);
      const email     = toStr(r["Email"] ?? r.email);
      const birthday  = toStr(r["Birthday"] ?? r.birthday);

      const pointsRaw = r["Rewards"] ?? r.points ?? r["Points"];
      const points    = Number(String(pointsRaw ?? "0").replace(/[^0-9.\-]/g, "")) || 0;

      const lockerNumber = toStr(r["Locker number"] ?? r["Locker Number"] ?? r.lockerNumber ?? r.locker);

      // Keep icon columns *as-is* (we still detect via normalized keys anyway)
      const Military    = r["Military"] ?? r.Military ?? r["military"] ?? r.military;
      const Paramedic   = r["Paramedic"] ?? r.Paramedic ?? r["paramedic"] ?? r.paramedic;
      const Firefighter = r["Firefighter"] ?? r.Firefighter ?? r["firefighter"] ?? r.firefighter;
      const Police      = r["Police"] ?? r.Police ?? r["police"] ?? r.police;
      const Locker      = r["Locker"] ?? r.Locker ?? r["locker"] ?? r.locker;
      const Regular     = r["Regular"] ?? r.Regular ?? r["regular"] ?? r.regular;

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

  // ---------- filtering + sorting ----------
  function filteredCustomers() {
    const q = norm(state.query);
    let list = (state.customers || []).slice();

    if (state.mode === "regular") {
      list = list.filter((c) => isRegularCustomer(c));
    } else if (state.mode === "lockers") {
      list = list.filter((c) => isLockerCustomer(c));
    }

    if (q) {
      list = list.filter((c) => {
        const last = (c.lastName || "").trim();
        const first = (c.firstName || "").trim();
        const hay = [
          `${first} ${last}`.trim(),
          `${last}, ${first}`.trim(),
          nickname(c),
          c.phone,
          c.email,
          c.lockerNumber,
        ].map(norm).join(" ");
        return hay.includes(q);
      });
    }

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

  // ---------- render list ----------
  function render() {
    const list = filteredCustomers();

    if (summaryEl) {
      const total = state.customers.length;
      const showing = list.length;
      summaryEl.textContent = `${showing} of ${total} customers`;
    }

    // Add button only on All
    if (addBtn) addBtn.style.display = (state.mode === "all") ? "inline-flex" : "none";

    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">No customers found</div>`;
      buildAZIndex([]);
      return;
    }

    listEl.innerHTML = list.map((c) => {
      const locker = isLockerCustomer(c);
      const reg = isRegularCustomer(c);

      const rowClass =
        locker ? "row locker" :
        reg    ? "row regular" :
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
        <div class="${rowClass}" data-id="${escapeHTML(c.id)}">
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
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-id");
        openProfile(id);
      });
    });

    buildAZIndex(list);
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

  // ---------- profile dialog ----------
  function openProfile(customerId) {
    state.activeCustomerId = customerId;

    const c = state.customers.find((x) => String(x.id) === String(customerId));
    if (!c) return;

    const first = (c.firstName || "").trim();
    const last  = (c.lastName || "").trim();
    if (pName) pName.innerHTML = `${escapeHTML(first || "—")}<br>${escapeHTML(last || "")}`.trim();

    const nick = nickname(c);
    if (pAka) {
      if (nick) {
        pAka.style.display = "";
        pAka.textContent = `aka ${nick}`;
      } else {
        pAka.style.display = "none";
        pAka.textContent = "";
      }
    }

    const locker = isLockerCustomer(c);
    const lockerNum = lockerNumOnly(c);
    const tierLine = locker
      ? `Locker ${lockerNum || c.lockerNumber || ""}`.trim()
      : (isRegularCustomer(c) ? "Regular" : "");

    if (pTier) pTier.textContent = tierLine || "—";

    const pts = Number(c.points || 0);
    if (pPointsPill) pPointsPill.textContent = String(pts);

    const phone = (c.phone || "").trim();
    const email = (c.email || "").trim();
    const bday  = (c.birthday || "").trim();

    const lines = [];
    if (phone) lines.push(phone);
    if (email) lines.push(email);
    if (bday)  lines.push(bday);

    if (pDetails) pDetails.textContent = lines.length ? lines.join("\n") : "—";

    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeProfile() {
    if (!dialog) return;
    if (dialog.open) dialog.close();
    state.activeCustomerId = null;
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
      createdAt: now,
      updatedAt: now,
    };

    const current = readCustomers();
    current.push(newCust);
    writeCustomers(current);

    state.customers = current;
    closeAddCustomer();
    render();
    openProfile(newCust.id);

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

    pCloseX?.addEventListener("click", closeProfile);

    dialog?.addEventListener("click", (e) => {
      const rect = dialog.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) closeProfile();
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

    window.addEventListener("storage", (e) => {
      if (e.key === CUSTOMERS_KEY || e.key === SALES_KEY) loadAndRender(true);
    });

    window.addEventListener("cigaros:customers-changed", () => loadAndRender(true));
    window.addEventListener("cigaros:sales-changed", () => loadAndRender(true));
  }

  // ---------- load ----------
  async function loadAndRender(keepDialog) {
    state.sales = readSales();
    state.customers = await seedCustomersFromJSONIfNeeded();

    render();

    if (keepDialog && dialog?.open && state.activeCustomerId) {
      openProfile(state.activeCustomerId);
    }
  }

  // ---------- init ----------
  bindEvents();
  loadAndRender(false);
})();
