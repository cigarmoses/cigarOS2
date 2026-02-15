/* /loyalty/contact.js
   Full-page loyalty contact detail (Tabs: History / Contact / Favorites)
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

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

  const backBtn = $(".lc-back");
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

    if (!list.length) {
      // keep the row from feeling empty: subtle placeholder icon box if none
      iconsEl.appendChild(buildIconBox(`${ICON_BASE}regular.svg`, "icon"));
      iconsEl.firstChild.style.opacity = "0.28";
      return;
    }

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

  function formatPhone(raw) {
    const d = String(raw || "").replace(/\D+/g, "");
    if (!d) return "";
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length === 11 && d[0] === "1") return `${d.slice(1,4)}-${d.slice(4,7)}-${d.slice(7)}`;
    return raw; // fallback
  }

  // HISTORY: tries to link by customerId first, then phone/email fallback
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

  function renderContact(customer) {
    const phone = formatPhone(toStr(customer.phone));
    const email = toStr(customer.email);

    // address keys vary; support common variants
    const address =
      toStr(customer.address) ||
      toStr(customer.Address) ||
      toStr(customer["Address"]) ||
      "";

    const cigarSocial =
      toStr(customer.cigarSocial) ||
      toStr(customer["Cigar Social"]) ||
      toStr(customer["CigarSocial"]) ||
      "";

    const addressHTML = address
      ? address.split("\n").map((l) => l.trim()).filter(Boolean).join("<br>")
      : "—";

    const cs = cigarSocial
      ? (cigarSocial.startsWith("@") ? cigarSocial : `@${cigarSocial}`)
      : "";

    const cigarSocialHTML = cs
      ? `<a href="javascript:void(0)">${cs}</a>`
      : "—";

    panelContact.innerHTML = `
      <div class="lc-kv">
        <div class="k">Cell:</div>
        <div class="v">${phone || "—"}</div>

        <div class="k">Email:</div>
        <div class="v">${email || "—"}</div>

        <div class="k">Address:</div>
        <div class="v">${addressHTML}</div>

        <div class="k">Cigar Social:</div>
        <div class="v">${cigarSocialHTML}</div>
      </div>
    `;
  }

  function csvToPills(v) {
    const s = toStr(v);
    if (!s) return [];
    return s
      .split(/[,|]/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function renderFavorites(customer) {
    const brandsRaw =
      customer.favoritesBrands ??
      customer["Favorite Brands"] ??
      customer.favoriteBrands ??
      "";

    const cigarsRaw =
      customer.favoritesCigars ??
      customer["Favorite Cigars"] ??
      customer.favoriteCigars ??
      "";

    const brands = Array.isArray(brandsRaw) ? brandsRaw : csvToPills(brandsRaw);
    const cigars = Array.isArray(cigarsRaw) ? cigarsRaw : csvToPills(cigarsRaw);

    const brandsHTML = brands.length
      ? `<div class="pills">${brands.map((b) => `<div class="pill">${b}</div>`).join("")}</div>`
      : `<div class="empty-line">No favorite brands yet</div>`;

    const cigarsHTML = cigars.length
      ? `<div class="pills">${cigars.map((c) => `<div class="pill">${c}</div>`).join("")}</div>`
      : `<div class="empty-line">No favorite cigars yet</div>`;

    panelFavorites.innerHTML = `
      <div class="section-title">Brands</div>
      <div class="section-divider"></div>
      ${brandsHTML}
      <div class="section-divider"></div>
      <div class="section-title">Cigars</div>
      <div class="section-divider"></div>
      ${cigarsHTML}
    `;
  }

  // EDIT MODE (for now: note only, exactly like your current behavior)
  let editMode = false;

  function setEditMode(on) {
    editMode = !!on;
    editBtn.textContent = editMode ? "DONE" : "EDIT";
    noteEl.readOnly = !editMode;
    noteEl.style.color = editMode ? "rgba(0,0,0,.82)" : "rgba(0,0,0,.72)";
  }

  function saveEdits(customerId, customers) {
    const idx = customers.findIndex((c) => String(c.id) === String(customerId));
    if (idx === -1) return;

    const c = customers[idx];
    c.note = toStr(noteEl.value);
    c.updatedAt = new Date().toISOString();
    customers[idx] = c;

    writeCustomers(customers);
  }

  function init() {
    backBtn?.addEventListener("click", () => history.back());

    const id = getParam("id");
    const customers = readCustomers();
    const customer = customers.find((c) => String(c.id) === String(id));

    if (!customer) {
      nameEl.textContent = "Not found";
      panelHistory.innerHTML = `<div class="lc-row"><div class="left" style="color:#8e8e93;">Customer not found</div></div>`;
      return;
    }

    // Header
    const first = toStr(customer.firstName);
    const last = toStr(customer.lastName);
    nameEl.textContent = `${first} ${last}`.trim() || "—";

    const nick = toStr(customer.nickname ?? customer.nick);
    if (nick) {
      akaEl.style.display = "";
      akaEl.textContent = `aka ${nick}`;
    } else {
      akaEl.style.display = "none";
      akaEl.textContent = "";
    }

    noteEl.value = toStr(customer.note);

    renderIcons(customer);

    // Tabs
    tabs.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
    showTab("history");

    // Panels
    const sales = readSales();
    renderHistory(customer, sales);
    renderContact(customer);
    renderFavorites(customer);

    // Edit
    setEditMode(false);
    editBtn?.addEventListener("click", () => {
      if (!editMode) return setEditMode(true);
      saveEdits(customer.id, customers);
      setEditMode(false);
    });
  }

  init();
})();
