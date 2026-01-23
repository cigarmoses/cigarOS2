/* /pos/favorites/favorites.js */

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);

  const listEl = $("#fav-list");
  const statusEl = $("#fav-status");

  const norm = (s) => (s ?? "").toString().trim();
  const low = (s) => norm(s).toLowerCase();
  const money = (v) => {
    const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    if (!isFinite(n) || n <= 0) return "";
    return n.toFixed(2);
  };

  const brandIconPath = (brand) => {
    const b = low(brand).replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").trim();
    return `/img/icons/brands/${b}.svg`;
  };

  const parseCSV = (text) => {
    const rows = [];
    let i = 0, cur = "", inQ = false;
    const out = [];

    // RFC-ish CSV parse (handles quotes/commas/newlines)
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        if (inQ && text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQ = !inQ; i++; continue;
      }
      if (!inQ && ch === ",") { out.push(cur); cur = ""; i++; continue; }
      if (!inQ && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        out.push(cur);
        rows.push(out.slice());
        out.length = 0;
        cur = "";
        i++;
        continue;
      }
      cur += ch; i++;
    }
    out.push(cur);
    rows.push(out);

    const header = rows.shift().map((h) => norm(h));
    return rows
      .filter((r) => r.some((c) => norm(c) !== ""))
      .map((r) => {
        const obj = {};
        header.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
        return obj;
      });
  };

  const isFav = (row) => {
    const v = low(row["Favorite"]);
    return v === "true" || v === "yes" || v === "1" || v === "y";
  };

  const displayTitle = (row) => {
    const line = norm(row["Line"]);
    const cigar = norm(row["Cigar"]);
    if (!line && !cigar) return "—";
    if (!line) return cigar;
    if (!cigar) return line;

    // de-dupe if cigar already starts with line
    const lc = low(cigar);
    const ll = low(line);
    if (lc.startsWith(ll)) return cigar;
    return `${line} ${cigar}`.replace(/\s+/g, " ").trim();
  };

  const subVitolaOnly = (row) => norm(row["Vitola"]) || "x";

  const renderRow = (row) => {
    const brand = norm(row["Brand"]);
    const title = displayTitle(row);
    const sub = subVitolaOnly(row);
    const msrp = money(row["MSRP"]);

    const iconSrc = brand ? brandIconPath(brand) : "";
    const key = norm(row["key"]) || `${brand}__${title}__${sub}`;

    const el = document.createElement("div");
    el.className = "cigar-row";
    el.dataset.key = key;

    el.innerHTML = `
      <div class="cigar-icon">
        ${iconSrc ? `<img src="${iconSrc}" alt="${brand}">` : ""}
      </div>

      <div class="cigar-text">
        <p class="cigar-title">${escapeHTML(title)}</p>
        <p class="cigar-sub">${escapeHTML(sub)}</p>
      </div>

      <div class="cigar-sep"></div>

      <div class="cigar-msrp">${msrp ? escapeHTML(msrp) : ""}</div>

      <button class="cigar-add" type="button" aria-label="Add to invoice">+</button>
    `;

    // Add-to-invoice: match Brand POS pattern (cart.js listens for data-receipt-item)
    const addBtn = el.querySelector(".cigar-add");
    addBtn.setAttribute("data-receipt-item", "1");
    addBtn.dataset.brand = brand;
    addBtn.dataset.line = norm(row["Line"]);
    addBtn.dataset.cigar = norm(row["Cigar"]);
    addBtn.dataset.vitola = norm(row["Vitola"]);
    addBtn.dataset.msrp = msrp;

    // OPTIONAL: If your cart.js expects a name/price field, add them too:
    addBtn.dataset.name = title;
    addBtn.dataset.price = msrp;

    return el;
  };

  const escapeHTML = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  async function init() {
    try {
      statusEl.textContent = "Loading favorites…";
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();
      const data = parseCSV(text);

      const favs = data.filter(isFav);

      listEl.innerHTML = "";
      if (!favs.length) {
        statusEl.textContent = "No favorites yet.";
        return;
      }

      statusEl.textContent = `${favs.length} favorites`;
      const frag = document.createDocumentFragment();
      favs.forEach((row) => frag.appendChild(renderRow(row)));
      listEl.appendChild(frag);
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Couldn’t load favorites.";
    }
  }

  init();
})();
