/* /loyalty/loyalty.js
   Loyalty page controller (SF Pro / iOS style)

   FIX:
   - If localStorage has no customers, auto-load from /pos/pos-contacts.json
   - Normalize JSON columns into the customer shape used by this page
   - Persist into localStorage under cigaros_customers_v1 so everything else works

   Storage Keys (must match /pos/cart.js):
     CUSTOMERS_KEY = "cigaros_customers_v1"
     SALES_KEY     = "cigaros_sales_v1"
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

  // Where your master contacts live (same-origin on Netlify)
  const CONTACTS_JSON_URL = "/pos/pos-contacts.json";

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);

  const listEl = $("#list");
  const summaryEl = $("#summary");
  const searchEl = $("#search");

  const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));

  const dialog = $("#profileDialog");
  const profileCard = $("#profileCard");

  const pName = $("#pName");
  const pSub = $("#pSub");
  const pPoints = $("#pPoints");

  const pLastPurchase = $("#pLastPurchase");
  const pVisitList = $("#pVisitList");
  const viewAllVisitsBtn = $("#viewAllVisitsBtn");

  const pPhone = $("#pPhone");
  const pEmail = $("#pEmail");
  const pBirthday = $("#pBirthday");

  const pFavBrands = $("#pFavBrands");
  const pFavCigars = $("#pFavCigars");
  const pRingPref = $("#pRingPref");

  const pWishlist = $("#pWishlist");

  const pStatYtd = $("#pStatYtd");
  const pStatVisits90 = $("#pStatVisits90");
  const pStatGift = $("#pStatGift");

  const editBtn = $("#editProfileBtn");
  const closeBtn = profileCard?.querySelector(".profile-close");

  const tonyFab = $("#tonyFab");

  // ---------- state ----------
  let state = {
    mode: "all", // all | regular | lockers
    query: "",
    customers: [],
    sales: [],
    activeCustomerId: null,
    showAllVisits: false,
    editing: false,
  };

  // ---------- utils ----------
  const safeJSON = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
  const writeJSON = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  const norm = (s) => (s || "").toString().trim().toLowerCase();

  const money = (n) => Number(n || 0).toFixed(2);

  const fmtDate = (isoOrDate) => {
    try {
      const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
      return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "—";
    }
  };

  const fmtDateTime = (isoOrDate) => {
    try {
      const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

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
    // strip currency, commas, "pts", etc.
    const cleaned = t.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function toStr(v) {
    const s = (v == null ? "" : String(v)).trim();
    return s;
  }

  // “locker vs regular”
  function customerType(c) {
    const t = norm(c.type || c.tier || c.segment || "");
    if (t.includes("locker")) return "locker";
    if (t.includes("regular")) return "regular";
    if (c.locker || c.lockerNumber) return "locker";
    return "regular";
  }

  function displayName(c) {
    const first = (c.firstName || "").trim();
    const last = (c.lastName || "").trim();
    const full = `${first} ${last}`.trim();
    return full || c.name || c.email || c.phone || "Customer";
  }

  function nickname(c) {
    return (c.nickname || c.nick || "").trim();
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

  // ---------- seed customers from /pos/pos-contacts.json ----------
  function normalizeContacts(rows) {
    const arr = Array.isArray(rows) ? rows : [];

    return arr.map((r, idx) => {
      // Your JSON keys look like:
      // 'First Name', 'Last Name', 'Nickname AKA', 'Phone', 'Email', 'Birthday',
      // 'Rewards', 'Locker number', 'type', 'YTD spend', '90-day visits', 'Gift card balance',
      // 'Ring Pref', 'Fav brand 1', 'Fav brand 2', 'Fav brand 3', 'Fav cigar', 'Fav cigar 2', 'Fav cigar 3'
      const id = toStr(r.id) || `c_${idx}_${Math.random().toString(16).slice(2)}`;

      const firstName = toStr(r["First Name"] ?? r.firstName ?? r.FirstName);
      const lastName = toStr(r["Last Name"] ?? r.lastName ?? r.LastName);
      const nicknameAKA = toStr(r["Nickname AKA"] ?? r.nickname ?? r.nick);

      const phone = toStr(r["Phone"] ?? r.phone);
      const email = toStr(r["Email"] ?? r.email);
      const birthday = toStr(r["Birthday"] ?? r.birthday);

      const points = toNum(r["Rewards"] ?? r.points);

      const lockerNumber = toStr(r["Locker number"] ?? r.lockerNumber ?? r.locker);
      const type = toStr(r["type"] ?? r.type);

      const ringPref = toStr(r["Ring Pref"] ?? r.ringPref ?? r.ringPreference);

      const favBrands = [
        toStr(r["Fav brand 1"]),
        toStr(r["Fav brand 2"]),
        toStr(r["Fav brand 3"]),
      ].filter(Boolean);

      const favCigars = [
        toStr(r["Fav cigar"]),
        toStr(r["Fav cigar 2"]),
        toStr(r["Fav cigar 3"]),
      ].filter(Boolean);

      const giftBalance = (() => {
        const gb = r["Gift card balance"] ?? r.giftBalance;
        const n = toNum(gb);
        return Number.isFinite(n) ? n : null;
      })();

      // keep these as informational fields (not required by the UI but helpful)
      const ytd = toNum(r["YTD spend"]);
      const visits90 = toNum(r["90-day visits"]);
      const lastPurchase = toStr(r["Last Purchase"]);

      // determine locker/regular if type missing
      const derivedType = (() => {
        const t = norm(type);
        if (t) return type;
        if (lockerNumber) return "locker";
        const reg = r["Regular"];
        if (norm(reg) === "yes" || norm(reg) === "true" || norm(reg) === "1") return "regular";
        return "regular";
      })();

      return {
        id,

        firstName,
        lastName,
        nickname: nicknameAKA,

        phone,
        email,
        birthday,

        points,
        type: derivedType,

        lockerNumber: lockerNumber || "",

        ringPref: ringPref || "",

        favBrands,
        favCigars,

        wishlist: Array.isArray(r.wishlist) ? r.wishlist : [],

        giftBalance,

        // helpful extras
        lastPurchaseText: lastPurchase || "",
        ytdSpendImported: ytd,
        visits90Imported: visits90,

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

      // If file exists but empty, don’t overwrite anything
      if (normalized.length) writeCustomers(normalized);

      return normalized;
    } catch (err) {
      console.warn("[Loyalty] Could not seed customers from JSON:", err);
      return existing; // still empty
    }
  }

  // ---------- sales helpers ----------
  function salesForCustomer(customerId) {
    const id = String(customerId || "");
    return (state.sales || [])
      .filter((s) => String(s.customerId || "") === id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function lastSale(customerId) {
    const s = salesForCustomer(customerId);
    return s[0] || null;
  }

  function ytdSpend(customerId) {
    const year = new Date().getFullYear();
    const s = salesForCustomer(customerId);
    return s.reduce((sum, sale) => {
      const d = new Date(sale.createdAt);
      if (d.getFullYear() !== year) return sum;
      return sum + Number(sale.totals?.total || 0);
    }, 0);
  }

  function visits90(customerId) {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const s = salesForCustomer(customerId);
    return s.filter((sale) => +new Date(sale.createdAt) >= cutoff).length;
  }

  // ---------- filtering ----------
  function filteredCustomers() {
    const q = norm(state.query);

    let list = (state.customers || []).slice();

    if (state.mode === "regular") {
      list = list.filter((c) => customerType(c) === "regular");
    } else if (state.mode === "lockers") {
      list = list.filter((c) => customerType(c) === "locker");
    }

    if (q) {
      list = list.filter((c) => {
        const hay = [
          displayName(c),
          nickname(c),
          c.firstName,
          c.lastName,
          c.phone,
          c.email,
          c.lockerNumber,
        ].map(norm).join(" ");
        return hay.includes(q);
      });
    }

    // Sort: lockers first in all-mode, then by points desc, then name
    list.sort((a, b) => {
      if (state.mode === "all") {
        const ta = customerType(a);
        const tb = customerType(b);
        if (ta !== tb) return ta === "locker" ? -1 : 1;
      }
      const pa = Number(a.points || 0);
      const pb = Number(b.points || 0);
      if (pb !== pa) return pb - pa;
      return displayName(a).localeCompare(displayName(b));
    });

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

      const name = escapeHTML(displayName(c));
      const nick = escapeHTML(nickname(c));
      const pts = Number(c.points || 0);

      const phone = (c.phone || "").trim();
      const email = (c.email || "").trim();

      const last = lastSale(c.id);
      const lastTxt = last ? `${fmtDate(last.createdAt)} • $${money(last.totals?.total || 0)}` : "—";

      const tagType = type === "locker" ? "Locker" : "Regular";
      const tagPts = `${pts} pts`;

      return `
        <div class="${rowClass}" data-id="${escapeHTML(c.id)}">
          <div class="row-header">
            <div class="name customer-name">${name}</div>
            <div class="points-pill">${escapeHTML(tagPts)}</div>
          </div>
          ${nick ? `<div class="nickname">${nick}</div>` : ``}
          <div class="meta-line">
            <span class="meta-pill">${tagType}</span>
            <span class="meta-pill">Last: ${escapeHTML(lastTxt)}</span>
          </div>
          <div class="contact-line">
            ${escapeHTML([phone, email].filter(Boolean).join(" • ") || "")}
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

  // ---------- profile dialog ----------
  function openProfile(customerId) {
    state.activeCustomerId = customerId;
    state.showAllVisits = false;
    state.editing = false;
    profileCard?.classList.remove("editing");

    const c = state.customers.find((x) => String(x.id) === String(customerId));
    if (!c) return;

    // header
    if (pName) pName.textContent = displayName(c);

    const type = customerType(c) === "locker" ? "Locker" : "Regular";
    const contact = [c.phone, c.email].filter(Boolean).join(" • ") || "Contact";
    if (pSub) pSub.textContent = `${type} • ${contact}`;

    if (pPoints) pPoints.textContent = `${Number(c.points || 0)} pts`;

    // purchase history
    const sales = salesForCustomer(c.id);
    const last = sales[0] || null;

    // If we have actual sales, use them; otherwise fall back to imported “Last Purchase” text if present
    if (pLastPurchase) {
      if (last?.createdAt) pLastPurchase.textContent = fmtDateTime(last.createdAt);
      else if (c.lastPurchaseText) pLastPurchase.textContent = c.lastPurchaseText;
      else pLastPurchase.textContent = "—";
    }

    renderVisitsList(c.id);

    // contact
    if (pPhone) pPhone.textContent = c.phone || "—";
    if (pEmail) pEmail.textContent = c.email || "—";
    if (pBirthday) pBirthday.textContent = c.birthday || "—";

    // favorites
    renderChips(pFavBrands, c.favBrands || c.favoriteBrands || []);
    renderChips(pFavCigars, c.favCigars || c.favoriteCigars || []);

    if (pRingPref) pRingPref.textContent = c.ringPref || c.ringPreference || "—";

    // wishlist (chips)
    renderChips(pWishlist, c.wishlist || []);

    // stats (prefer real sales calc; fall back to imported values if no sales exist)
    const hasSales = sales.length > 0;

    const ytd = hasSales ? ytdSpend(c.id) : (c.ytdSpendImported || 0);
    const v90 = hasSales ? visits90(c.id) : (c.visits90Imported || 0);

    if (pStatYtd) pStatYtd.textContent = `YTD spend: $${money(ytd)}`;
    if (pStatVisits90) pStatVisits90.textContent = `90-day visits: ${Number(v90 || 0)}`;

    if (pStatGift) {
      pStatGift.textContent =
        c.giftBalance != null && c.giftBalance !== ""
          ? `Gift card balance: $${money(c.giftBalance)}`
          : "—";
    }

    // dialog open
    if (dialog && !dialog.open) dialog.showModal();
  }

  function renderVisitsList(customerId) {
    const sales = salesForCustomer(customerId);

    const max = state.showAllVisits ? sales.length : Math.min(5, sales.length);
    const slice = sales.slice(0, max);

    if (!pVisitList) return;

    if (!slice.length) {
      pVisitList.innerHTML = `<div class="empty-state" style="padding:8px 0;">No purchases yet</div>`;
      return;
    }

    pVisitList.innerHTML = slice.map((s) => {
      const dt = fmtDate(s.createdAt);
      const amt = `$${money(s.totals?.total || 0)}`;
      return `
        <div class="visit-item">
          <div class="visit-date">${escapeHTML(dt)}</div>
          <div class="visit-amount">${escapeHTML(amt)}</div>
        </div>
      `;
    }).join("");

    if (viewAllVisitsBtn) {
      viewAllVisitsBtn.textContent = state.showAllVisits ? "View less" : "View all";
      viewAllVisitsBtn.disabled = sales.length <= 5;
    }
  }

  function renderChips(container, arr) {
    if (!container) return;
    const list = Array.isArray(arr) ? arr : [];

    if (!list.length) {
      container.innerHTML = `<span class="chip">—</span>`;
      return;
    }

    container.innerHTML = list.map((x) => `<span class="chip">${escapeHTML(x)}</span>`).join("");
  }

  function closeProfile() {
    if (!dialog) return;
    if (dialog.open) dialog.close();
    state.activeCustomerId = null;
    state.editing = false;
    profileCard?.classList.remove("editing");
  }

  // ---------- editing ----------
  function setEditable(on) {
    state.editing = !!on;

    if (!profileCard) return;
    profileCard.classList.toggle("editing", state.editing);

    const editableIds = [
      "pPhone",
      "pEmail",
      "pBirthday",
      "pRingPref",
      "pStatYtd",
      "pStatVisits90",
      "pStatGift",
      "pLastPurchase",
    ];

    editableIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.contentEditable = state.editing ? "true" : "false";
      el.spellcheck = false;
    });

    if (pWishlist) {
      if (state.editing) {
        pWishlist.contentEditable = "true";
        pWishlist.spellcheck = false;
        const c = getActiveCustomer();
        const w = (c?.wishlist || []).join(", ");
        pWishlist.innerHTML = escapeHTML(w || "");
      } else {
        pWishlist.contentEditable = "false";
      }
    }

    if (pFavBrands) {
      if (state.editing) {
        pFavBrands.contentEditable = "true";
        const c = getActiveCustomer();
        const v = (c?.favBrands || c?.favoriteBrands || []).join(", ");
        pFavBrands.innerHTML = escapeHTML(v || "");
      } else {
        pFavBrands.contentEditable = "false";
      }
    }

    if (pFavCigars) {
      if (state.editing) {
        pFavCigars.contentEditable = "true";
        const c = getActiveCustomer();
        const v = (c?.favCigars || c?.favoriteCigars || []).join(", ");
        pFavCigars.innerHTML = escapeHTML(v || "");
      } else {
        pFavCigars.contentEditable = "false";
      }
    }

    if (editBtn) editBtn.textContent = state.editing ? "Save" : "Edit";
  }

  function getActiveCustomer() {
    if (!state.activeCustomerId) return null;
    return state.customers.find((x) => String(x.id) === String(state.activeCustomerId)) || null;
  }

  function saveProfileEdits() {
    const c = getActiveCustomer();
    if (!c) return;

    const phone = (pPhone?.textContent || "").trim();
    const email = (pEmail?.textContent || "").trim();
    const birthday = (pBirthday?.textContent || "").trim();
    const ringPref = (pRingPref?.textContent || "").trim();

    c.phone = phone && phone !== "—" ? phone : "";
    c.email = email && email !== "—" ? email : "";
    c.birthday = birthday && birthday !== "—" ? birthday : "";
    c.ringPref = ringPref && ringPref !== "—" ? ringPref : "";

    const parseCSV = (txt) =>
      (txt || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

    if (pWishlist) {
      const w = (pWishlist.textContent || "").trim();
      c.wishlist = parseCSV(w);
    }
    if (pFavBrands) {
      const v = (pFavBrands.textContent || "").trim();
      c.favBrands = parseCSV(v);
    }
    if (pFavCigars) {
      const v = (pFavCigars.textContent || "").trim();
      c.favCigars = parseCSV(v);
    }

    c.updatedAt = new Date().toISOString();

    writeCustomers(state.customers);

    setEditable(false);
    openProfile(c.id);
    render();
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

    closeBtn?.addEventListener("click", closeProfile);
    dialog?.addEventListener("click", (e) => {
      const rect = dialog.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) closeProfile();
    });

    viewAllVisitsBtn?.addEventListener("click", () => {
      if (!state.activeCustomerId) return;
      state.showAllVisits = !state.showAllVisits;
      renderVisitsList(state.activeCustomerId);
    });

    editBtn?.addEventListener("click", () => {
      if (!state.activeCustomerId) return;
      if (!state.editing) setEditable(true);
      else saveProfileEdits();
    });

    tonyFab?.addEventListener("click", () => {
      window.location.href = "/learn/";
    });

    window.addEventListener("storage", (e) => {
      if (e.key === CUSTOMERS_KEY || e.key === SALES_KEY) {
        loadAndRender(true);
      }
    });

    window.addEventListener("cigaros:customers-changed", () => loadAndRender(true));
    window.addEventListener("cigaros:sales-changed", () => loadAndRender(true));
  }

  // ---------- load ----------
  async function loadAndRender(keepDialog) {
    // load sales first (fine)
    state.sales = readSales();

    // customers: localStorage first; if empty, seed from JSON
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
