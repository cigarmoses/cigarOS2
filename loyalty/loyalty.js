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

   NEW:
     ✅ Row click goes to full-page detail: /loyalty/contact.html?id=...
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

  const CONTACTS_JSON_URL = "/loyalty/loyalty-contacts.json";

  const CONTACTS_SOURCE_KEY = "cigaros_customers_source_v1";
  const CONTACTS_SOURCE_VALUE = CONTACTS_JSON_URL;

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
  function isTruthyMarker(v, columnTitle) {
    if (v === true) return true;
    if (v === false || v == null) return false;

    const s = String(v).trim().toLowerCase();
    if (!s) return false;

    if (s === "0" || s === "no" || s === "false" || s === "n") return false;

    if (s === "x" || s === "y" || s === "1" || s === "yes" || s === "true") return true;

    if (/^\d+(\.\d+)?$/.test(s)) return true;

    const col = String(columnTitle || "").trim().toLowerCase();
    if (col && s === col) return true;
    if (col && s.includes(col)) return true;

    return true;
  }

  function isExplicitX(v) {
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === "x";
  }

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

  function isLockerCustomer(c) {
    return hasColumnValue(c, "Locker") || !!lockerNumOnly(c);
  }

  function isRegularCustomer(c) {
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

      const lockerNumber = toStr(
        r["Locker number"] ??
        r.lockerNumber ??
        r.locker ??
        r["Locker"]
      );

      const Military    = r["Military"] ?? r.Military ?? r["military"] ?? r.military;
      const Paramedic   = r["Paramedic"] ?? r.Paramedic ?? r["paramedic"] ?? r.paramedic;
      const Firefighter = r["Firefighter"] ?? r.Firefighter ?? r["firefighter"] ?? r.firefighter;
      const Police      = r["Police"] ?? r.Police ?? r["police"] ?? r.police;
      const Locker      = r["Locker"] ?? r.Locker ?? r["locker"] ?? r.locker;
      const Regular     = r["Regular"] ?? r.Regular ?? r["regular"] ?? r.regular;

      // favorites placeholders (safe if missing)
      const favoritesBrands = r.favoritesBrands ?? r["Favorite Brands"] ?? r.favoriteBrands ?? "";
      const favoritesCigars = r.favoritesCigars ?? r["Favorite Cigars"] ?? r.favoriteCigars ?? "";

      // Cigar Social handle + quick note placeholders
      const cigarSocial = toStr(r.cigarSocial ?? r["Cigar Social"] ?? r["CigarSocial"] ?? "");
      const note = toStr(r.note ?? r["Note"] ?? r["Quick Note"] ?? "");

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

        cigarSocial,
        note,

        favoritesBrands,
        favoritesCigars,

        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }

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
        const hay = [
          `${(c.lastName || "").trim()}, ${(c.firstName || "").trim()}`.trim(),
          `${(c.firstName || "").trim()} ${(c.lastName || "").trim()}`.trim(),
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
  function goToContact(customerId) {
    const url = `/loyalty/contact.html?id=${encodeURIComponent(String(customerId))}`;
    window.location.href = url;
  }

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
      cigarSocial: "",
      note: "",
      favoritesBrands: "",
      favoritesCigars: "",
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
