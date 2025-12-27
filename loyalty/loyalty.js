/* /loyalty/loyalty.js
   Loyalty page controller (SF Pro / iOS style)
   - Reads customers from localStorage: cigaros_customers_v1
   - Reads confirmed sales from localStorage: cigaros_sales_v1
   - Search + segmented modes (All / Regulars / Lockers)
   - Customer profile dialog with purchase history from sales
   - Simple inline edit mode for key fields, persisted back to customers

   Storage Keys (must match /pos/cart.js):
     CUSTOMERS_KEY = "cigaros_customers_v1"
     SALES_KEY     = "cigaros_sales_v1"
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

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

  // “locker vs regular” — you can tune this mapping later
  function customerType(c) {
    const t = norm(c.type || c.tier || c.segment || "");
    if (t.includes("locker")) return "locker";
    if (t.includes("regular")) return "regular";
    // fallback: if they have a “locker number” or “locker” field
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

  // sales for a given customer
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
    if (pLastPurchase) pLastPurchase.textContent = last ? fmtDateTime(last.createdAt) : "—";

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

    // stats
    if (pStatYtd) pStatYtd.textContent = `YTD spend: $${money(ytdSpend(c.id))}`;
    if (pStatVisits90) pStatVisits90.textContent = `90-day visits: ${visits90(c.id)}`;
    if (pStatGift) pStatGift.textContent = `Gift card balance: ${c.giftBalance != null ? `$${money(c.giftBalance)}` : "—"}`;

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
      // keep placeholder look consistent
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

    // These are safe to edit as plain text
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

    // Wishlist: allow simple comma-separated edit when in edit mode
    if (pWishlist) {
      if (state.editing) {
        pWishlist.contentEditable = "true";
        pWishlist.spellcheck = false;
        // convert chips -> text
        const c = getActiveCustomer();
        const w = (c?.wishlist || []).join(", ");
        pWishlist.innerHTML = escapeHTML(w || "");
      } else {
        pWishlist.contentEditable = "false";
      }
    }

    // Fav Brands / Fav Cigars: same approach
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

    // Pull edited fields
    const phone = (pPhone?.textContent || "").trim();
    const email = (pEmail?.textContent || "").trim();
    const birthday = (pBirthday?.textContent || "").trim();
    const ringPref = (pRingPref?.textContent || "").trim();

    c.phone = phone && phone !== "—" ? phone : "";
    c.email = email && email !== "—" ? email : "";
    c.birthday = birthday && birthday !== "—" ? birthday : "";
    c.ringPref = ringPref && ringPref !== "—" ? ringPref : "";

    // Chips edited as comma-separated text
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

    // persist
    writeCustomers(state.customers);

    // re-render dialog content from saved customer object
    setEditable(false);
    openProfile(c.id);
    render();
  }

  // ---------- events ----------
  function bindEvents() {
    // segmented control
    modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        modeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.mode = btn.getAttribute("data-mode") || "all";
        render();
      });
    });

    // search
    searchEl?.addEventListener("input", () => {
      state.query = searchEl.value || "";
      render();
    });

    // profile close
    closeBtn?.addEventListener("click", closeProfile);
    dialog?.addEventListener("click", (e) => {
      // click outside to close
      const rect = dialog.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) closeProfile();
    });

    // view all visits
    viewAllVisitsBtn?.addEventListener("click", () => {
      if (!state.activeCustomerId) return;
      state.showAllVisits = !state.showAllVisits;
      renderVisitsList(state.activeCustomerId);
    });

    // edit toggle
    editBtn?.addEventListener("click", () => {
      if (!state.activeCustomerId) return;
      if (!state.editing) setEditable(true);
      else saveProfileEdits();
    });

    // Tony (optional — keep harmless for now)
    tonyFab?.addEventListener("click", () => {
      // You can route this wherever you want later.
      // For now, just go to Learn home.
      window.location.href = "/learn/";
    });

    // live updates from POS confirms (storage changes)
    window.addEventListener("storage", (e) => {
      if (e.key === CUSTOMERS_KEY || e.key === SALES_KEY) {
        loadAndRender(true);
      }
    });

    // if you ever dispatch these custom events, we listen too
    window.addEventListener("cigaros:customers-changed", () => loadAndRender(true));
    window.addEventListener("cigaros:sales-changed", () => loadAndRender(true));
  }

  // ---------- load ----------
  function loadAndRender(keepDialog) {
    state.customers = readCustomers();
    state.sales = readSales();

    render();

    // keep profile open and refreshed if it’s currently open
    if (keepDialog && dialog?.open && state.activeCustomerId) {
      openProfile(state.activeCustomerId);
    }
  }

  // ---------- init ----------
  bindEvents();
  loadAndRender(false);
})();
