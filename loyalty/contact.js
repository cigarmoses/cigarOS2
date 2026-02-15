/* /loyalty/contact.js
   - Folder tabs + stretched content panel
   - Quick note placeholder behavior
   - Contact values use icons (more width, no wrapping)
   - Favorites pulled from JSON-style columns:
       "Fav brand 1", "Fav brand 2", ...
       "Fav cigar", "Fav cigar 2", ...
   - Edit toggles unlock fields, Done saves to localStorage customers
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

  // Brand icons live here (per your repo convention)
  const BRAND_ICON_BASE = "/img/icons/brands/"; // plural

  const ICON_BASE = "/img/icons/loyalty/";
  const ICONS = {
    military: `${ICON_BASE}military.svg`,
    paramedic: `${ICON_BASE}paramedic.svg`,
    firefighter: `${ICON_BASE}firefighter.svg`,
    police: `${ICON_BASE}police.svg`,
    locker: `${ICON_BASE}locker.svg`,
    regular: `${ICON_BASE}regular.svg`,
  };

  const $ = (sel) => document.querySelector(sel);

  const backBtn = $("#lcBack");
  const nameEl = $("#lcName");
  const akaEl = $("#lcAka");
  const noteEl = $("#lcNote");
  const iconsEl = $("#lcIcons");
  const editBtn = $("#lcEditBtn");

  const tabs = Array.from(document.querySelectorAll(".lc-tab"));
  const panelHistory = $("#panelHistory");
  const panelContact = $("#panelContact");
  const panelFavorites = $("#panelFavorites");

  const safeJSON = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
  const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const toStr = (v) => (v == null ? "" : String(v)).trim();

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function readCustomers() {
    const list = safeJSON(localStorage.getItem(CUSTOMERS_KEY), []);
    return Array.isArray(list) ? list : [];
  }

  function writeCustomers(list) {
    writeJSON(CUSTOMERS_KEY, list);
    window.dispatchEvent(new Event("cigaros:customers-changed"));
  }

  function readSales() {
    const list = safeJSON(localStorage.getItem(SALES_KEY), []);
    return Array.isArray(list) ? list : [];
  }

  function escapeHTML(s) {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(s) {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isTruthyMarker(v, columnTitle) {
    if (v === true) return true;
    if (v === false || v == null) return false;

    const s = String(v).trim().toLowerCase();
    if (!s) return false;
    if (s === "0" || s === "no" || s === "false" || s === "n") return false;
    if (s === "x" || s === "y" || s === "1" || s === "yes" || s === "true") return true;
    if (/^\d+(\.\d+)?$/.test(s)) return true;

    const col = String(columnTitle || "").trim().toLowerCase();
    if (col && (s === col || s.includes(col))) return true;

    return true;
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

  function isExplicitX(v) {
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === "x";
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

  function formatPhone(raw) {
    const d = String(raw || "").replace(/\D+/g, "");
    if (!d) return "";
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length === 11 && d[0] === "1") return `${d.slice(1,4)}-${d.slice(4,7)}-${d.slice(7)}`;
    return raw;
  }

  function normalizePhoneToDigits(raw) {
    return String(raw || "").replace(/\D+/g, "");
  }

  function buildIconBox(src, alt) {
    const wrap = document.createElement("div");
    wrap.className = "lc-ico";
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.loading = "lazy";
    wrap.appendChild(img);
    return wrap;
  }

  function renderIcons(c) {
    iconsEl.innerHTML = "";

    const roleIcons = [];
    if (hasColumnValue(c, "Military")) roleIcons.push("military");
    if (hasColumnValue(c, "Paramedic")) roleIcons.push("paramedic");
    if (hasColumnValue(c, "Firefighter")) roleIcons.push("firefighter");
    if (hasColumnValue(c, "Police")) roleIcons.push("police");

    const tier = isLockerCustomer(c) ? "locker" : (isRegularCustomer(c) ? "regular" : null);
    const list = tier ? [...roleIcons, tier] : [...roleIcons];

    if (!list.length) return;
    list.forEach((key) => iconsEl.appendChild(buildIconBox(ICONS[key], key)));
  }

  function showTab(tab) {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    panelHistory.style.display = tab === "history" ? "" : "none";
    panelContact.style.display = tab === "contact" ? "" : "none";
    panelFavorites.style.display = tab === "favorites" ? "" : "none";
  }

  function money(n) {
    const x = Number(n || 0);
    return `$${x.toFixed(2)}`;
  }

  // ---- Favorites parsing from JSON-style columns ----
  function keyIsFavBrand(k) {
    const s = String(k || "").trim().toLowerCase();
    return s.startsWith("fav brand");
  }
  function keyIsFavCigar(k) {
    const s = String(k || "").trim().toLowerCase();
    return s.startsWith("fav cigar");
  }
  function numFromKey(k) {
    const m = String(k || "").match(/(\d+)/);
    return m ? Number(m[1]) : 1; // "Fav cigar" (no number) treated as 1
  }

  function getFavBrandsFromColumns(c) {
    const pairs = Object.keys(c || {})
      .filter(keyIsFavBrand)
      .map((k) => ({ k, n: numFromKey(k), v: toStr(c[k]) }))
      .filter((x) => x.v);

    pairs.sort((a, b) => a.n - b.n);
    return pairs.map((x) => x.v);
  }

  function getFavCigarsFromColumns(c) {
    const pairs = Object.keys(c || {})
      .filter(keyIsFavCigar)
      .map((k) => ({ k, n: numFromKey(k), v: toStr(c[k]) }))
      .filter((x) => x.v);

    pairs.sort((a, b) => a.n - b.n);
    return pairs.map((x) => x.v);
  }

  function slugify(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function brandIconPath(brandName) {
    // best-effort: lowercase, no spaces, hyphen-separated
    const slug = slugify(brandName).replace(/-/g, "");
    // If your icons are *not* no-space, change this to slugify(brandName)
    return `${BRAND_ICON_BASE}${slug}.svg`;
  }

  function cigarDetailHref(displayName) {
    // Best-effort link: route to cigars page with query
    // If you have a dedicated cigar detail route later, swap here.
    return `/pos/cigars/?q=${encodeURIComponent(displayName)}`;
  }

  // ---------- panels ----------
  function renderHistory(customer, sales) {
    const cid = String(customer.id);
    const phone = toStr(customer.phone);
    const email = toStr(customer.email).toLowerCase();

    const matches = (sales || []).filter((s) => {
      const sid = toStr(s.customerId ?? s.contactId ?? s.customer_id);
      if (sid && String(sid) === cid) return true;

      const sPhone = toStr(s.phone ?? s.customerPhone ?? s.customer_phone);
      const sEmail = toStr(s.email ?? s.customerEmail ?? s.customer_email).toLowerCase();

      if (phone && sPhone && phone === sPhone) return true;
      if (email && sEmail && email === sEmail) return true;

      return false;
    });

    if (!matches.length) {
      panelHistory.innerHTML = `
        <div class="lc-row">
          <div class="left" style="color:#8e8e93;">No transactions yet</div>
        </div>
      `;
      return;
    }

    matches.sort((a, b) => {
      const da = new Date(a.date ?? a.createdAt ?? a.timestamp ?? 0).getTime() || 0;
      const db = new Date(b.date ?? b.createdAt ?? b.timestamp ?? 0).getTime() || 0;
      return db - da;
    });

    const rows = matches.slice(0, 25).map((s) => {
      const dt = new Date(s.date ?? s.createdAt ?? s.timestamp ?? Date.now());
      const label = dt.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });

      const total = Number(s.total ?? s.amount ?? s.grandTotal ?? 0) || 0;

      const pdfUrl =
        toStr(s.pdfUrl ?? s.pdfURL ?? s.invoicePdf ?? s.invoicePdfUrl ?? s.receiptPdfUrl ?? "");

      const viewHTML = pdfUrl
        ? `<a href="${pdfUrl}" target="_blank" rel="noopener">view</a>`
        : `<a href="javascript:void(0)" style="opacity:.35; pointer-events:none;">view</a>`;

      return `
        <div class="lc-row">
          <div class="left">${label}</div>
          <div class="mid">${money(total)}</div>
          <div class="right">${viewHTML}</div>
        </div>
      `;
    }).join("");

    panelHistory.innerHTML = `
      ${rows}
      <a class="lc-mutedlink" href="javascript:void(0)">view all transactions</a>
    `;
  }

  function iconSVG(type) {
    // simple inline icons (no external dependency)
    if (type === "phone") return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L9.9 10.7a16 16 0 0 0 3.4 3.4l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6A2 2 0 0 1 22 16.9z"></path>
      </svg>`;
    if (type === "mail") return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16v16H4z"></path>
        <path d="M4 6l8 6 8-6"></path>
      </svg>`;
    if (type === "pin") return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-4.4 7-11a7 7 0 0 0-14 0c0 6.6 7 11 7 11z"></path>
        <path d="M12 10.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z"></path>
      </svg>`;
    // cigar social / profile
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 21a8 8 0 1 0-16 0"></path>
        <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"></path>
      </svg>`;
  }

  function getAddress(c) {
    return toStr(c.address ?? c.Address ?? c["Address"] ?? "");
  }
  function getCigarSocial(c) {
    return toStr(c.cigarSocial ?? c["Cigar Social"] ?? c["CigarSocial"] ?? "");
  }

  function renderContact(customer, editing) {
    const phoneShown = editing ? toStr(customer.phone) : formatPhone(toStr(customer.phone));
    const email = toStr(customer.email);
    const address = getAddress(customer);
    const cigarSocial = getCigarSocial(customer);

    panelContact.innerHTML = `
      <div class="lc-kv">
        <div class="ico">${iconSVG("phone")}</div>
        <div class="v"><input class="lc-field" id="fPhone" value="${escapeAttr(phoneShown)}" ${editing ? "" : "readonly"} placeholder="412-555-1212"></div>

        <div class="ico">${iconSVG("mail")}</div>
        <div class="v"><input class="lc-field" id="fEmail" value="${escapeAttr(email)}" ${editing ? "" : "readonly"} placeholder="name@email.com"></div>

        <div class="ico">${iconSVG("pin")}</div>
        <div class="v"><input class="lc-field" id="fAddress" value="${escapeAttr(address)}" ${editing ? "" : "readonly"} placeholder="Street, City, ST ZIP"></div>

        <div class="ico">${iconSVG("user")}</div>
        <div class="v"><input class="lc-field" id="fCigarSocial" value="${escapeAttr(cigarSocial)}" ${editing ? "" : "readonly"} placeholder="@username"></div>
      </div>
    `;
  }

  function renderFavorites(customer) {
    const brands = getFavBrandsFromColumns(customer);
    const cigars = getFavCigarsFromColumns(customer);

    const brandIconsHTML = brands.length
      ? `<div class="brand-icons">
          ${brands.map((b) => `
            <img src="${brandIconPath(b)}" alt="${escapeAttr(b)}" title="${escapeAttr(b)}" loading="lazy"
                 onerror="this.style.display='none';" />
          `).join("")}
        </div>`
      : `<div class="empty-line">No favorite brands yet</div>`;

    const cigarPillsHTML = cigars.length
      ? `<div class="pills">
          ${cigars.map((c) => `
            <a class="pill" href="${cigarDetailHref(c)}">${escapeHTML(c)}</a>
          `).join("")}
        </div>`
      : `<div class="empty-line">No favorite cigars yet</div>`;

    panelFavorites.innerHTML = `
      <div class="section-title">Brands</div>
      ${brandIconsHTML}
      <div class="section-title">Cigars</div>
      ${cigarPillsHTML}
    `;
  }

  // ---------- edit mode ----------
  let editMode = false;
  let activeCustomerId = null;

  function nickname(c) {
    return toStr(c.nickname ?? c.nick ?? "");
  }

  function makeHeaderEditable(c) {
    const first = toStr(c.firstName);
    const last = toStr(c.lastName);

    nameEl.innerHTML = `
      <input class="lc-field" id="fFirst" value="${escapeAttr(first)}" placeholder="First" />
      <span style="display:inline-block;width:8px;"></span>
      <input class="lc-field" id="fLast" value="${escapeAttr(last)}" placeholder="Last" />
    `;

    const nick = nickname(c);
    akaEl.style.display = "";
    akaEl.innerHTML = `
      <span style="color:#8e8e93;font-weight:600;">aka </span>
      <input class="lc-field" id="fNick" value="${escapeAttr(nick)}" placeholder="Nickname" />
    `;
  }

  function teardownHeaderEditable(c) {
    const first = toStr(c.firstName);
    const last = toStr(c.lastName);
    nameEl.textContent = `${first} ${last}`.trim() || "—";

    const nick = nickname(c);
    if (nick) {
      akaEl.style.display = "";
      akaEl.textContent = `aka ${nick}`;
    } else {
      akaEl.style.display = "none";
      akaEl.textContent = "";
    }
  }

  function setNoteValue(c) {
    // ✅ placeholder automatically disappears when value exists
    noteEl.value = toStr(c.note);
    noteEl.readOnly = !editMode;
  }

  function setEditMode(on) {
    editMode = !!on;
    editBtn.textContent = editMode ? "DONE" : "EDIT";

    const customers = readCustomers();
    const c = customers.find((x) => String(x.id) === String(activeCustomerId));
    if (!c) return;

    setNoteValue(c);

    // panels
    renderContact(c, editMode);
    renderFavorites(c);

    // header fields
    if (editMode) makeHeaderEditable(c);
    else teardownHeaderEditable(c);
  }

  function saveEdits() {
    const customers = readCustomers();
    const idx = customers.findIndex((c) => String(c.id) === String(activeCustomerId));
    if (idx === -1) return;

    const c = customers[idx];

    // header
    const fFirst = document.getElementById("fFirst");
    const fLast = document.getElementById("fLast");
    const fNick = document.getElementById("fNick");

    if (fFirst) c.firstName = toStr(fFirst.value);
    if (fLast) c.lastName = toStr(fLast.value);
    if (fNick) c.nickname = toStr(fNick.value);

    // quick note
    c.note = toStr(noteEl.value);

    // contact
    const fPhone = document.getElementById("fPhone");
    const fEmail = document.getElementById("fEmail");
    const fAddress = document.getElementById("fAddress");
    const fCigarSocial = document.getElementById("fCigarSocial");

    if (fPhone) c.phone = normalizePhoneToDigits(fPhone.value) || toStr(fPhone.value);
    if (fEmail) c.email = toStr(fEmail.value);
    if (fAddress) c.address = toStr(fAddress.value);
    if (fCigarSocial) c.cigarSocial = toStr(fCigarSocial.value);

    c.updatedAt = new Date().toISOString();

    customers[idx] = c;
    writeCustomers(customers);

    // refresh view
    renderIcons(c);
    teardownHeaderEditable(c);
    setNoteValue(c);
    renderContact(c, false);
    renderFavorites(c);
  }

  // ---------- init ----------
  function init() {
    backBtn?.addEventListener("click", () => history.back());

    activeCustomerId = getParam("id");

    const customers = readCustomers();
    const customer = customers.find((c) => String(c.id) === String(activeCustomerId));

    if (!customer) {
      nameEl.textContent = "Not found";
      panelHistory.innerHTML = `<div class="lc-row"><div class="left" style="color:#8e8e93;">Customer not found</div></div>`;
      return;
    }

    // header render
    teardownHeaderEditable(customer);

    // aka line
    const nick = nickname(customer);
    if (nick) {
      akaEl.style.display = "";
      akaEl.textContent = `aka ${nick}`;
    } else {
      akaEl.style.display = "none";
      akaEl.textContent = "";
    }

    // quick note
    editMode = false;
    setNoteValue(customer);

    // icons
    renderIcons(customer);

    // tabs
    tabs.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

    // default open history (matches your example)
    showTab("history");

    // panels
    const sales = readSales();
    renderHistory(customer, sales);
    renderContact(customer, false);
    renderFavorites(customer);

    // edit
    editBtn.textContent = "EDIT";
    editBtn?.addEventListener("click", () => {
      if (!editMode) return setEditMode(true);
      // DONE
      saveEdits();
      setEditMode(false);
    });
  }

  init();
})();
