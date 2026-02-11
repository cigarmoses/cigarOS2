/* /loyalty/loyalty.js
   Loyalty page controller (SF Pro / iOS style)

   - Reads customers from localStorage: cigaros_customers_v1
   - Seeds from /pos/pos-contacts.json if localStorage is empty
   - Search + segmented modes (All / Regulars / Lockers)
   - Customer profile dialog (NEW iOS-style layout)
   - Compact list rows with right-aligned status icons

   ICON RULE:
   - Columns are labeled exactly with the icon names:
     Military, Paramedic, Firefighter, Police, Locker, Regular
   - If that column contains ANY value (x, X, true, etc.) -> show that icon
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

  // Profile dialog (NEW)
  const dialog = $("#profileDialog");
  const pName = $("#pName");
  const pAka = $("#pAka");
  const pTier = $("#pTier");
  const pPointsPill = $("#pPointsPill");
  const pDetails = $("#pDetails");
  const pCloseX = $("#pCloseX");
  const pDone = $("#pDone");

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
  const toNum = (v) => {
    if (v == null) return 0;
    const t = String(v).trim();
    if (!t) return 0;
    const cleaned = t.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };
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

  // checks BOTH exact-case key and lowercase key (in case JSON normalized keys)
  function hasColumnValue(obj, columnTitle){
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

  function customerType(c) {
    // Locker column or lockerNumber wins
    if (hasColumnValue(c, "Locker") || c.locker || c.lockerNumber) return "locker";

    // Otherwise, only TRUE Regular column indicates regular
    if (hasColumnValue(c, "Regular")) return "regular";

    // backward compat if a type exists
    const t = norm(c.type || c.tier || c.segment || "");
    if (t.includes("locker")) return "locker";
    if (t.includes("regular")) return "regular";

    // default: regular (but note: tab filtering controls visibility)
    return "regular";
  }

  function firstLast(c){
    const first = (c.firstName || "").trim();
    const last = (c.lastName || "").trim();
    return `${first} ${last}`.trim();
  }

  function lastFirst(c){
    const first = (c.firstName || "").trim();
    const last = (c.lastName || "").trim();
    if (last && first) return `${last}, ${first}`;
    return (last || first || c.name || c.email || c.phone || "Customer").trim();
  }

  function nickname(c) {
    return (c.nickname || c.nick || "").trim();
  }

  function buildIconHTML(iconNames) {
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
    return customerType(c) === "locker" ? "locker" : "regular";
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

      const points    = toNum(r["Rewards"] ?? r.points);

      const lockerNumber = toStr(r["Locker number"] ?? r.lockerNumber ?? r.locker);
      const type = toStr(r["type"] ?? r.type);

      // keep icon columns intact
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
        nickname: nick,

        phone,
        email,
        birthday,

        points,

        type,
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
      // ONLY those marked Regular column
      list = list.filter((c) => customerType(c) === "regular" && hasColumnValue(c, "Regular"));
    } else if (state.mode === "lockers") {
      list = list.filter((c) => customerType(c) === "locker");
    }

    if (q) {
      list = list.filter((c) => {
        const hay = [
          firstLast(c),
          lastFirst(c),
          nickname(c),
          c.phone,
          c.email,
          c.lockerNumber,
        ].map(norm).join(" ");
        return hay.includes(q);
      });
    }

    // Sorting rules:
    // - All: sort by LAST NAME (iOS Contacts)
    // - Lockers tab: sort by lockerNumber numeric asc (1..25 etc)
    // - Regulars tab: sort by last name
    if (state.mode === "lockers") {
      list.sort((a, b) => {
        const na = Number(String(a.lockerNumber || "").replace(/\D+/g, "")) || 0;
        const nb = Number(String(b.lockerNumber || "").replace(/\D+/g, "")) || 0;
        if (na !== nb) return na - nb;
        return lastFirst(a).localeCompare(lastFirst(b));
      });
    } else {
      list.sort((a, b) => lastFirst(a).localeCompare(lastFirst(b)));
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

    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">No customers found</div>`;
      return;
    }

    listEl.innerHTML = list.map((c) => {
      const type = customerType(c);
      const rowClass = type === "locker" ? "row locker" : "row regular";

      const first = (c.firstName || "").trim();
      const last  = (c.lastName || "").trim();

      // Locker tab: show locker number before last name (not bold)
      const lockerPrefix = (state.mode === "lockers" && c.lockerNumber)
        ? `<span class="locker-num">${escapeHTML(String(c.lockerNumber).replace(/\D+/g, "") || c.lockerNumber)}</span>`
        : ``;

      const nameHTML = `
        ${lockerPrefix}
        <span class="name-last">${escapeHTML(last)}</span><span>, </span>
        <span class="name-first">${escapeHTML(first)}</span>
      `;

      // Right-side icons: role icons (0..4) + tier icon last (locker/regular)
      const roleIcons = getRoleIcons(c);
      const tierIcon = getTierIcon(c);
      const icons = [...roleIcons, tierIcon];

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
  }

  // ---------- profile dialog (NEW TARGET LOOK) ----------
  function openProfile(customerId) {
    state.activeCustomerId = customerId;

    const c = state.customers.find((x) => String(x.id) === String(customerId));
    if (!c) return;

    // Big name: First Last (as in your screenshot)
    if (pName) pName.textContent = firstLast(c) || "—";

    // aka line
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

    // Tier line: "Locker 23" or "Regular"
    const isLocker = customerType(c) === "locker";
    const lockerNum = String(c.lockerNumber || "").replace(/\D+/g, "") || "";
    const tierLine = isLocker
      ? `Locker ${lockerNum || c.lockerNumber || ""}`.trim()
      : `Regular`;

    if (pTier) pTier.textContent = tierLine || "—";

    // Points pill (green)
    const pts = Number(c.points || 0);
    if (pPointsPill) pPointsPill.textContent = String(pts);

    // Details: phone / email / birthday stacked
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

    // Close buttons in popup
    pCloseX?.addEventListener("click", closeProfile);
    pDone?.addEventListener("click", closeProfile);

    // Click outside dialog closes
    dialog?.addEventListener("click", (e) => {
      const rect = dialog.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) closeProfile();
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
