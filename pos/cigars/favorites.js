/* /pos/favorites/favorites.js */

(() => {
  "use strict";

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const FAVORITES_KEY = "cigaros_favorite_keys";

  const $ = (sel) => document.querySelector(sel);

  const listEl = $("#fav-list");
  const statusEl = $("#fav-status");

  const norm = (s) => String(s ?? "").trim();

  const low = (s) => norm(s).toLowerCase();

  function normalizeLoose(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/["'’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function slugify(s) {
    return normalizeLoose(s).replace(/\s+/g, "-");
  }

  const money = (v) => {
    const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    if (!isFinite(n) || n <= 0) return "";
    return n.toFixed(2);
  };

  const escapeHTML = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const brandIconPath = (brand) => {
    const b = low(brand)
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
    return b ? `/img/icons/brands/${b}.svg` : "";
  };

  const parseCSV = (text) => {
    const rows = [];
    let i = 0;
    let cur = "";
    let inQ = false;
    const out = [];

    while (i < text.length) {
      const ch = text[i];

      if (ch === '"') {
        if (inQ && text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQ = !inQ;
        i++;
        continue;
      }

      if (!inQ && ch === ",") {
        out.push(cur);
        cur = "";
        i++;
        continue;
      }

      if (!inQ && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        out.push(cur);
        rows.push(out.slice());
        out.length = 0;
        cur = "";
        i++;
        continue;
      }

      cur += ch;
      i++;
    }

    out.push(cur);
    rows.push(out);

    const header = (rows.shift() || []).map((h) => norm(h));

    return rows
      .filter((r) => r.some((c) => norm(c) !== ""))
      .map((r) => {
        const obj = {};
        header.forEach((h, idx) => {
          obj[h] = r[idx] ?? "";
        });
        return obj;
      });
  };

  function readFavoritesSet() {
    try {
      const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function getField(row, keys) {
    for (const key of keys) {
      const v = row?.[key];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function getCigarId(row) {
    return getField(row, [
      "Key",
      "key",
      "Cigar ID",
      "cigarId",
      "cigarid",
      "cigar_id",
      "id",
      "row_id"
    ]);
  }

  function getBrand(row) {
    return getField(row, ["Brand", "brand", "brandname", "Brand aka", "brandaka"]);
  }

  function getLine(row) {
    return getField(row, ["Line", "line", "Series", "series"]);
  }

  function getName(row) {
    return getField(row, ["Cigar", "cigar", "Name", "name"]);
  }

  function getVitola(row) {
    return getField(row, ["Vitola", "vitola", "Style", "style", "Size", "size"]);
  }

  function displayTitle(row) {
    const line = getLine(row);
    const cigar = getName(row);

    if (!line && !cigar) return "—";
    if (!line) return cigar;
    if (!cigar) return line;

    const lc = low(cigar);
    const ll = low(line);
    if (lc.startsWith(ll)) return cigar;

    return `${line} ${cigar}`.replace(/\s+/g, " ").trim();
  }

  function buildRowSlug(row) {
    const id = getCigarId(row);
    const brand = getBrand(row);
    const line = getLine(row);
    const cigar = getName(row);
    const vitola = getVitola(row);
    return slugify([brand, line, cigar, vitola, id].filter(Boolean).join(" "));
  }

  function buildPipeKey(row) {
    const brand = normalizeLoose(getBrand(row));
    const title = normalizeLoose(displayTitle(row));
    const vitola = normalizeLoose(getVitola(row));
    return [brand, title, vitola].join("|");
  }

  function favoriteMatchesRow(savedValue, row) {
    const savedRaw = norm(savedValue);
    if (!savedRaw) return false;

    const savedLoose = normalizeLoose(savedRaw);
    const savedSlug = slugify(savedRaw);

    const rowId = getCigarId(row);
    const rowBrand = getBrand(row);
    const rowLine = getLine(row);
    const rowName = getName(row);
    const rowVitola = getVitola(row);
    const rowTitle = displayTitle(row);
    const rowSlug = buildRowSlug(row);
    const pipeKey = buildPipeKey(row);

    const candidates = [
      rowId,
      rowTitle,
      rowName,
      [rowLine, rowName].filter(Boolean).join(" ").trim(),
      [rowBrand, rowLine, rowName].filter(Boolean).join(" ").trim(),
      [rowBrand, rowName].filter(Boolean).join(" ").trim(),
      [rowName, rowVitola].filter(Boolean).join(" ").trim(),
      pipeKey,
      rowSlug
    ].filter(Boolean);

    return candidates.some((candidate) => {
      const cRaw = norm(candidate);
      return (
        cRaw === savedRaw ||
        normalizeLoose(cRaw) === savedLoose ||
        slugify(cRaw) === savedSlug
      );
    });
  }

  function getFavoriteRows(data, favoritesSet) {
    const saved = Array.from(favoritesSet);
    if (!saved.length) return [];

    const matched = [];
    const usedRows = new Set();

    saved.forEach((fav) => {
      const found = data.find((row, idx) => {
        if (usedRows.has(idx)) return false;
        return favoriteMatchesRow(fav, row);
      });

      if (found) {
        const idx = data.indexOf(found);
        usedRows.add(idx);
        matched.push(found);
      }
    });

    return matched;
  }

  function renderRow(row) {
    const brand = getBrand(row);
    const title = displayTitle(row);
    const sub = getVitola(row) || "x";
    const msrp = money(getField(row, ["MSRP", "msrp"]));
    const iconSrc = brand ? brandIconPath(brand) : "";
    const rowId = getCigarId(row);
    const slug = buildRowSlug(row);

    const el = document.createElement("div");
    el.className = "cigar-row";
    if (rowId) el.dataset.key = rowId;

    el.innerHTML = `
      <div class="cigar-icon">
        ${iconSrc ? `<img src="${iconSrc}" alt="${escapeHTML(brand)}">` : ""}
      </div>

      <div class="cigar-text">
        <p class="cigar-title">${escapeHTML(title)}</p>
        <p class="cigar-sub">${escapeHTML(sub)}</p>
      </div>

      <div class="cigar-sep"></div>

      <div class="cigar-msrp">${msrp ? escapeHTML(msrp) : ""}</div>

      <button class="cigar-add" type="button" aria-label="Add to invoice">+</button>
    `;

    el.addEventListener("click", (e) => {
      if (e.target.closest(".cigar-add")) return;

      const params = new URLSearchParams();
      if (rowId) params.set("id", rowId);
      else params.set("slug", slug);

      window.location.href = `/pos/cigars/cigar?${params.toString()}`;
    });

    const addBtn = el.querySelector(".cigar-add");
    addBtn.setAttribute("data-receipt-item", "1");
    addBtn.dataset.brand = brand;
    addBtn.dataset.line = getLine(row);
    addBtn.dataset.cigar = getName(row);
    addBtn.dataset.vitola = getVitola(row);
    addBtn.dataset.msrp = msrp;
    addBtn.dataset.name = title;
    addBtn.dataset.price = msrp;

    return el;
  }

  async function init() {
    try {
      statusEl.textContent = "Loading favorites…";

      const favoritesSet = readFavoritesSet();

      if (!favoritesSet.size) {
        listEl.innerHTML = "";
        statusEl.textContent = "No favorites yet.";
        return;
      }

      const res = await fetch(CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);

      const text = await res.text();
      const data = parseCSV(text);

      const favs = getFavoriteRows(data, favoritesSet);

      listEl.innerHTML = "";

      if (!favs.length) {
        statusEl.textContent = "No favorites found.";
        return;
      }

      statusEl.textContent = `${favs.length} favorite${favs.length === 1 ? "" : "s"}`;

      const frag = document.createDocumentFragment();
      favs.forEach((row) => frag.appendChild(renderRow(row)));
      listEl.appendChild(frag);
    } catch (err) {
      console.error("[favorites] load error:", err);
      statusEl.textContent = "Couldn’t load favorites.";
    }
  }

  init();
})();
