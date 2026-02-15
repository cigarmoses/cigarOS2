/* /loyalty/contact.js
   Full-page loyalty contact detail
   - Active tab bold only
   - Edit button unlocks ALL editable fields (except transaction history)
   - Saves to localStorage (cigaros_customers_v1)

   NOTE:
   A static Netlify site cannot write back to /loyalty/loyalty-contacts.json at runtime.
   Persisting edits into localStorage is the correct runtime behavior.
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

  // ---------- UI render helpers (editable fields) ----------
  function field(id, value, placeholder = "—", readonly = true) {
    const v = toStr(value);
    const shown = v || (readonly ? "—" : "");
    const ro = readonly ? "readonly" : "";
    const ph = readonly ? "" : `placeholder="${placeholder}"`;
    return `<input class="lc-field" id="${id}" value="${escapeAttr(shown)}" ${ro} ${ph} />`;
  }

  function textarea(id, value, placeholder = "", readonly = true) {
    const v = toStr(value);
    const ro = readonly ? "readonly" : "";
    const ph = placeholder ? `placeholder="${escapeAttr(placeholder)}"` : "";
    return `<textarea class="lc-textarea" id="${id}" ${ro} ${ph}>${escapeHTML(v)}</textarea>`;
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

  function csvToPills(v) {
    const s = toStr(v);
    if (!s) return [];
    return s
      .split(/[,|]/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // We support multiple key variants but SAVE into normalized keys:
  // phone, email, address, cigarSocial, favoritesBrands, favoritesCigars, nickname, firstName, lastName, note
  function getAddress(c) {
    return (
      toStr(c.address) ||
      toStr(c.Address) ||
      toStr(c["Address"]) ||
      ""
    );
  }

  function getCigarSocial(c) {
    return (
      toStr(c.cigarSocial) ||
      toStr(c["Cigar Social"]) ||
      toStr(c["CigarSocial"]) ||
      ""
    );
  }

  function getFavBrands(c) {
    return c.favoritesBrands ?? c["Favorite Brands"] ?? c.favoriteBrands ?? "";
  }

  function getFavCigars(c) {
    return c.favoritesCigars ?? c["Favorite Cigars"] ?? c.favoriteCigars ?? "";
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

  function renderContact(customer, editing) {
    const phone = editing ? toStr(customer.phone) : formatPhone(toStr(customer.phone));
    const email = toStr(customer.email);
    const address = getAddress(customer);
    const cigarSocial = getCigarSocial(customer);

    panelContact.innerHTML = `
      <div class="lc-kv">
        <div class="k">Cell:</div>
        <div class="v">${field("fPhone", phone, "412-555-1212", !editing)}</div>

        <div class="k">Email:</div>
        <div class="v">${field("fEmail", email, "name@email.com", !editing)}</div>

        <div class="k">Address:</div>
        <div class="v">${field("fAddress", address || (editing ? "" : "—"), "Street, City, ST ZIP", !editing)}</div>

        <div class="k">Cigar Social:</div>
        <div class="v">${field("fCigarSocial", cigarSocial || (editing ? "" : "—"), "@username", !editing)}</div>
      </div>
    `;
  }

  function renderFavorites(customer, editing) {
    const brandsRaw = getFavBrands(customer);
    const cigarsRaw = getFavCigars(customer);

    const brands = Array.isArray(brandsRaw) ? brandsRaw : csvToPills(brandsRaw);
    const cigars = Array.isArray(cigarsRaw) ? cigarsRaw : csvToPills(cigarsRaw);

    const brandsHTML = editing
      ? `<div style="padding: 12px 16px 18px;">${textarea("fFavBrands", Array.isArray(brandsRaw) ? brands.join(", ") : toStr(brandsRaw), "Comma-separated brands", false)}</div>`
      : (brands.length
          ? `<div class="pills">${brands.map((b) => `<div class="pill">${escapeHTML(b)}</div>`).join("")}</div>`
          : `<div class="empty-line">No favorite brands yet</div>`);

    const cigarsHTML = editing
      ? `<div style="padding: 12px 16px 18px;">${textarea("fFavCigars", Array.isArray(cigarsRaw) ? cigars.join(", ") : toStr(cigarsRaw), "Comma-separated cigars", false)}</div>`
      : (cigars.length
          ? `<div class="pills">${cigars.map((c) => `<div class="pill">${escapeHTML(c)}</div>`).join("")}</div>`
          : `<div class="empty-line">No favorite cigars yet</div>`);

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

  // ---------- edit mode ----------
  let editMode = false;
  let activeCustomerId = null;

  function setEditMode(on) {
    editMode = !!on;
    editBtn.textContent = editMode ? "DONE" : "EDIT";

    // unlock header fields
    noteEl.readOnly = !editMode;

    // re-render panels in edit/read mode
    const customers = readCustomers();
    const c = customers.find((x) => String(x.id) === String(activeCustomerId));
    if (!c) return;

    renderContact(c, editMode);
    renderFavorites(c, editMode);

    // allow editing name + nickname in header using prompt-free inline editing
    // (keeps layout identical; we swap the text node to an input only in edit mode)
    if (editMode) {
      makeHeaderEditable(c);
    } else {
      teardownHeaderEditable(c);
    }
  }

  function makeHeaderEditable(c) {
    // Name becomes two inputs behind the scenes
    // Replace nameEl content with inputs
    const first = toStr(c.firstName);
    const last = toStr(c.lastName);

    nameEl.innerHTML = `
      <input class="lc-field" id="fFirst" value="${escapeAttr(first)}" placeholder="First" />
      <span style="display:inline-block;width:8px;"></span>
      <input class="lc-field" id="fLast" value="${escapeAttr(last)}" placeholder="Last" />
    `;

    // AKA becomes input
    const nick = toStr(c.nickname ?? c.nick);
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

    const nick = toStr(c.nickname ?? c.nick);
    if (nick) {
      akaEl.style.display = "";
      akaEl.textContent = `aka ${nick}`;
    } else {
      akaEl.style.display = "none";
      akaEl.textContent = "";
    }
  }

  function saveEdits() {
    const customers = readCustomers();
    const idx = customers.findIndex((c) => String(c.id) === String(activeCustomerId));
    if (idx === -1) return;

    const c = customers[idx];

    // header fields
    const fFirst = document.getElementById("fFirst");
    const fLast = document.getElementById("fLast");
    const fNick = document.getElementById("fNick");

    if (fFirst) c.firstName = toStr(fFirst.value);
    if (fLast) c.lastName = toStr(fLast.value);

    if (fNick) c.nickname = toStr(fNick.value);

    c.note = toStr(noteEl.value);

    // contact fields
    const fPhone = document.getElementById("fPhone");
    const fEmail = document.getElementById("fEmail");
    const fAddress = document.getElementById("fAddress");
    const fCigarSocial = document.getElementById("fCigarSocial");

    if (fPhone) c.phone = normalizePhoneToDigits(fPhone.value) || toStr(fPhone.value);
    if (fEmail) c.email = toStr(fEmail.value);
    if (fAddress) c.address = toStr(fAddress.value);

    if (fCigarSocial) {
      const raw = toStr(fCigarSocial.value);
      c.cigarSocial = raw;
    }

    // favorites
    const fFavBrands = document.getElementById("fFavBrands");
    const fFavCigars = document.getElementById("fFavCigars");

    if (fFavBrands) c.favoritesBrands = toStr(fFavBrands.value);
    if (fFavCigars) c.favoritesCigars = toStr(fFavCigars.value);

    c.updatedAt = new Date().toISOString();

    customers[idx] = c;
    writeCustomers(customers);

    // re-render header + panels back in view mode
    renderIcons(c);
    teardownHeaderEditable(c);
    renderContact(c, false);
    renderFavorites(c, false);
  }

  // ---------- init ----------
  function init() {
    backBtn?.addEventListener("click", () => history.back());

    const id = getParam("id");
    activeCustomerId = id;

    const customers = readCustomers();
    const customer = customers.find((c) => String(c.id) === String(id));

    if (!customer) {
      nameEl.textContent = "Not found";
      panelHistory.innerHTML = `<div class="lc-row"><div class="left" style="color:#8e8e93;">Customer not found</div></div>`;
      return;
    }

    // Header render
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
    noteEl.readOnly = true;

    renderIcons(customer);

    // Tabs
    tabs.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
    showTab("contact"); // ✅ opens to Contact tab by default if you want
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === "contact"));

    // Panels
    const sales = readSales();
    renderHistory(customer, sales);
    renderContact(customer, false);
    renderFavorites(customer, false);

    // Edit
    editMode = false;
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
