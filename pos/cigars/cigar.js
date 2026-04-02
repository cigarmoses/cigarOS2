/* /pos/cigars/cigar.js
   Canonical cigar detail page
   - Reads Google Sheets CSV
   - Opens by ?id= or ?slug=
   - Uses universal /pos/cart.js cart
   - Inline edit mode on page
   - Save currently updates the live page/local record immediately
   - To save back to Google Sheets, add an Apps Script/webhook URL below
*/

(() => {
  "use strict";

  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  // Optional: paste your Apps Script / webhook URL here later.
  // Example:
  // const SHEET_SAVE_ENDPOINT = "https://script.google.com/macros/s/XXXXX/exec";
  const SHEET_SAVE_ENDPOINT = "";

  const FAVORITES_KEY = "cigaros_favorite_keys";
  const COMPARE_KEY = "cigaros_compare_keys";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const card = $("#cdCard");
  const loading = $("#cdLoading");
  const backBtn = $("#cdBack");
  const themeToggle = $("#theme-toggle");

  let recordsCache = [];
  let activeRecord = null;
  let editMode = false;
  let draft = null;

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function getSavedTheme() {
    return localStorage.getItem("theme") || document.documentElement.getAttribute("data-theme") || "dark";
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeToggle?.setAttribute("aria-pressed", String(next === "dark"));
  }

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

  function compactKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/["'’]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function normalizeBrand(v) {
    return compactKey(v);
  }

  function normalizeAssetPath(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return value.startsWith("/") ? value : `/${value}`;
  }

  function escapeHTML(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(s) {
    return escapeHTML(s);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
        continue;
      }

      cur += ch;
    }

    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row);
    }

    return rows;
  }

  function normalizeHeader(h) {
    return String(h || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  function rowsToObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map((h) => String(h || "").trim());
    const normHeaders = headers.map(normalizeHeader);

    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => !String(c || "").trim())) continue;

      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = r[j] ?? "";
        obj[normHeaders[j]] = r[j] ?? "";
      }
      data.push(obj);
    }
    return data;
  }

  function getField(rec, keys) {
    for (const key of keys) {
      const value = rec?.[key];
      if (value != null && String(value).trim() !== "") return String(value).trim();
    }
    return "";
  }

  function setField(rec, primaryKey, value) {
    rec[primaryKey] = value;
    rec[normalizeHeader(primaryKey)] = value;
  }

  function getCigarId(rec) {
    return getField(rec, [
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

  function getBrand(rec) {
    return getField(rec, ["Brand", "brand", "brandname", "Brand aka", "brandaka"]);
  }

  function getLine(rec) {
    return getField(rec, ["Line", "line", "Series", "series"]);
  }

  function getName(rec) {
    return getField(rec, ["Cigar", "cigar", "Name", "name"]);
  }

  function getVitola(rec) {
    return getField(rec, ["Vitola", "vitola", "Style", "style", "Size", "size"]);
  }

  function getShape(rec) {
    return getField(rec, ["Shape", "shape"]);
  }

  function getWrapper(rec) {
    return getField(rec, ["Wrapper", "wrapper", "Wrapper Type", "wrappertypet"]);
  }

  function getBinder(rec) {
    return getField(rec, ["Binder", "binder"]);
  }

  function getFiller(rec) {
    return getField(rec, ["Filler", "filler"]);
  }

  function getStrength(rec) {
    return getField(rec, ["Strength", "strength"]);
  }

  function getRing(rec) {
    return getField(rec, ["Ring", "ring", "RG", "rg"]);
  }

  function getLength(rec) {
    return getField(rec, ["Length", "length"]);
  }

  function getOrigin(rec) {
    return getField(rec, ["Origin", "origin", "Country", "country"]);
  }

  function getShade(rec) {
    return getField(rec, ["Wrapper Shade", "wrappershade", "wrapper_shade", "shade"]);
  }

  function getImage(rec) {
    return getField(rec, ["Cigar IMG", "cigarimg", "Image", "image", "Photo", "photo"]);
  }

  function getBrandImage(rec) {
    return getField(rec, ["Brand IMG", "brandimg", "brand_image"]);
  }

  function getPrice(rec) {
    const raw = getField(rec, ["MSRP", "msrp", "Price", "price"]);
    const num = Number(String(raw).replace(/[^0-9.]/g, ""));
    return Number.isFinite(num) ? num : 0;
  }

  function bestTitle(rec) {
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    return [brand, line, name].filter(Boolean).join(" • ") || "Cigar";
  }

  function makeSlugFromRecord(rec) {
    const id = getCigarId(rec);
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    const vitola = getVitola(rec);
    return slugify([brand, line, name, vitola, id].filter(Boolean).join(" "));
  }

  function scoreRecord(rec) {
    let score = 0;
    if (getRing(rec)) score += 5;
    if (getLength(rec)) score += 5;
    if (getImage(rec)) score += 5;
    if (getPrice(rec)) score += 4;
    if (getVitola(rec)) score += 3;
    if (getShape(rec)) score += 3;
    if (getShade(rec)) score += 3;
    if (getStrength(rec)) score += 3;
    if (getWrapper(rec)) score += 2;
    if (getBinder(rec)) score += 2;
    if (getFiller(rec)) score += 2;
    if (getOrigin(rec)) score += 1;
    return score;
  }

  function findById(records, id) {
    const targetRaw = String(id || "").trim();
    if (!targetRaw) return null;

    const targetLoose = normalizeLoose(targetRaw);
    const targetSlug = slugify(targetRaw);

    const matches = records.filter((r) => {
      const candidates = [
        getField(r, ["Key", "key", "Cigar ID", "cigarId", "cigarid", "cigar_id", "id", "row_id"]),
        getField(r, ["Cigar", "cigar", "Name", "name"]),
        [getLine(r), getName(r)].filter(Boolean).join(" ").trim(),
        [getBrand(r), getLine(r), getName(r)].filter(Boolean).join(" ").trim(),
        [getBrand(r), getName(r)].filter(Boolean).join(" ").trim(),
        [getName(r), getVitola(r)].filter(Boolean).join(" ").trim()
      ]
        .filter(Boolean)
        .map((v) => String(v).trim());

      return candidates.some((value) => {
        return (
          value === targetRaw ||
          normalizeLoose(value) === targetLoose ||
          slugify(value) === targetSlug
        );
      });
    });

    if (!matches.length) return null;
    matches.sort((a, b) => scoreRecord(b) - scoreRecord(a));
    return matches[0];
  }

  function findBySlug(records, slug) {
    const target = String(slug || "").trim();
    if (!target) return null;

    const targetSlug = slugify(target);

    const matches = records.filter((r) => {
      return (
        makeSlugFromRecord(r) === targetSlug ||
        slugify(getCigarId(r)) === targetSlug
      );
    });

    if (!matches.length) return null;
    matches.sort((a, b) => scoreRecord(b) - scoreRecord(a));
    return matches[0];
  }

  function readSet(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  }

  function writeSet(key, set) {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {}
  }

  function flagForCountry(country) {
    const c = String(country || "").trim().toLowerCase();
    if (c === "cuba") return "🇨🇺";
    if (c === "nicaragua") return "🇳🇮";
    if (c === "dominican republic") return "🇩🇴";
    if (c === "honduras") return "🇭🇳";
    if (c === "mexico") return "🇲🇽";
    if (c === "ecuador") return "🇪🇨";
    if (c === "usa" || c === "united states") return "🇺🇸";
    return "";
  }

  function collectAccolades(records, rec) {
    const key = getCigarId(rec);
    const brand = getBrand(rec);
    const name = getName(rec);
    const vitola = getVitola(rec);

    const matches = records.filter((row) => {
      const rowKey = getCigarId(row);
      if (key && rowKey && rowKey === key) return true;

      return (
        getBrand(row) === brand &&
        getName(row) === name &&
        getVitola(row) === vitola
      );
    });

    const out = [];
    const seen = new Set();

    matches.forEach((row) => {
      const media = getField(row, ["Media", "media", "Source", "source"]);
      const year = getField(row, ["Year", "year"]);
      const rank = getField(row, ["Rank", "rank"]);
      if (!media && !year && !rank) return;

      const sig = `${media}|${year}|${rank}`;
      if (seen.has(sig)) return;
      seen.add(sig);

      out.push({ media, year, rank });
    });

    out.sort((a, b) => {
      const rankA = parseInt(a.rank, 10);
      const rankB = parseInt(b.rank, 10);
      const yearA = parseInt(a.year, 10);
      const yearB = parseInt(b.year, 10);

      if (Number.isFinite(rankA) && Number.isFinite(rankB) && rankA !== rankB) {
        return rankA - rankB;
      }
      if (Number.isFinite(yearA) && Number.isFinite(yearB) && yearA !== yearB) {
        return yearB - yearA;
      }
      return String(a.media).localeCompare(String(b.media));
    });

    return out.slice(0, 2);
  }

  function renderAccolades(accolades) {
    if (!accolades.length) {
      return `<div class="cd-accolade-empty">No accolades listed.</div>`;
    }

    return accolades.map((item) => {
      const bits = [];
      if (item.rank) bits.push(`#${escapeHTML(item.rank)}`);
      if (item.year) bits.push(escapeHTML(item.year));
      if (item.media) bits.push(escapeHTML(item.media));
      return `<div class="cd-accolade-line">${bits.join(" - ")}</div>`;
    }).join("");
  }

  function buildBrandIconCandidates(rec) {
    const fromSheet = normalizeAssetPath(getBrandImage(rec));
    const brand = getBrand(rec);
    const brandKey = normalizeBrand(brand);

    const out = [];
    if (fromSheet) out.push(fromSheet);

    if (brandKey) {
      out.push(`/img/icons/brands/${brandKey}.svg`);
      out.push(`/img/icons/brands/${brandKey}.png`);
    }

    return Array.from(new Set(out.filter(Boolean)));
  }

  function buildCigarImageCandidates(rec) {
    const fromSheet = normalizeAssetPath(getImage(rec));
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    const vitola = getVitola(rec);
    const shade = getShade(rec);

    const brandFolder = normalizeBrand(brand);
    const lineKey = compactKey(line);

    const out = [];
    if (fromSheet) out.push(fromSheet);

    if (brandFolder) {
      const combos = [
        compactKey([brand, line, name].join(" ")),
        compactKey([brand, line, name, vitola].join(" ")),
        compactKey([brand, name].join(" ")),
        compactKey([brand, name, vitola].join(" ")),
        compactKey([brand, vitola].join(" ")),
        compactKey([brand, name, shade].join(" ")),
        compactKey([brand, vitola, shade].join(" ")),
        compactKey([brand, line, vitola, shade].join(" "))
      ];

      if (lineKey.includes("1964")) {
        combos.push(compactKey([brand, "1964", name].join(" ")));
        combos.push(compactKey([brand, "1964", vitola].join(" ")));
        combos.push(compactKey([brand, "1964", name, shade].join(" ")));
        combos.push(compactKey([brand, "1964", vitola, shade].join(" ")));
      }

      combos
        .filter(Boolean)
        .forEach((key) => {
          out.push(`/img/cigars/${brandFolder}/${key}.png`);
        });
    }

    return Array.from(new Set(out.filter(Boolean)));
  }

  function makeDraftFromRecord(rec) {
    return {
      brand: getBrand(rec),
      line: getLine(rec),
      name: getName(rec),
      vitola: getVitola(rec),
      shape: getShape(rec),
      wrapper: getWrapper(rec),
      binder: getBinder(rec),
      filler: getFiller(rec),
      origin: getOrigin(rec),
      shade: getShade(rec),
      strength: getStrength(rec),
      ring: getRing(rec),
      length: getLength(rec),
      msrp: getPrice(rec) > 0 ? String(getPrice(rec)) : ""
    };
  }

  function applyDraftToRecord(rec, nextDraft) {
    setField(rec, "Brand", nextDraft.brand);
    setField(rec, "Line", nextDraft.line);
    setField(rec, "Cigar", nextDraft.name);
    setField(rec, "Vitola", nextDraft.vitola);
    setField(rec, "Shape", nextDraft.shape);
    setField(rec, "Wrapper", nextDraft.wrapper);
    setField(rec, "Binder", nextDraft.binder);
    setField(rec, "Filler", nextDraft.filler);
    setField(rec, "Origin", nextDraft.origin);
    setField(rec, "Wrapper Shade", nextDraft.shade);
    setField(rec, "Strength", nextDraft.strength);
    setField(rec, "Ring", nextDraft.ring);
    setField(rec, "Length", nextDraft.length);
    setField(rec, "MSRP", nextDraft.msrp);
  }

  async function persistDraftToSheet(rec, nextDraft) {
    if (!SHEET_SAVE_ENDPOINT) return false;

    const payload = {
      key: getCigarId(rec),
      brand: nextDraft.brand,
      line: nextDraft.line,
      cigar: nextDraft.name,
      vitola: nextDraft.vitola,
      shape: nextDraft.shape,
      wrapper: nextDraft.wrapper,
      binder: nextDraft.binder,
      filler: nextDraft.filler,
      origin: nextDraft.origin,
      wrapperShade: nextDraft.shade,
      strength: nextDraft.strength,
      ring: nextDraft.ring,
      length: nextDraft.length,
      msrp: nextDraft.msrp
    };

    const res = await fetch(SHEET_SAVE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
    return true;
  }

  function renderTextInput(field, value, cls = "cd-inline-input", placeholder = "") {
    return `<input
      class="${cls}"
      data-edit-field="${field}"
      type="text"
      value="${escapeAttr(value || "")}"
      placeholder="${escapeAttr(placeholder)}"
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
    >`;
  }

  function renderTopCopy(brand, line, name) {
    if (!editMode || !draft) {
      const displayName = [line, name].filter(Boolean).join(" ").trim() || name || line || "—";
      return `
        <div class="cd-head-copy">
          <div class="cd-brand" title="${escapeAttr(brand || "—")}">${escapeHTML(brand || "—")}</div>
          <div class="cd-name" title="${escapeAttr(displayName)}">${escapeHTML(displayName)}</div>
        </div>
      `;
    }

    return `
      <div class="cd-head-copy cd-head-copy--editing">
        ${renderTextInput("brand", draft.brand, "cd-brand-input", "Brand")}
        <div class="cd-head-edit-grid">
          ${renderTextInput("line", draft.line, "cd-name-input", "Line")}
          ${renderTextInput("name", draft.name, "cd-name-input", "Cigar")}
        </div>
      </div>
    `;
  }

  function renderSpecCard(label, fieldKey, value, opts = {}) {
    const valueClass = opts.text ? "cd-spec-value spec-text" : "cd-spec-value";
    const renderedValue = editMode && draft
      ? renderTextInput(fieldKey, draft[fieldKey], `cd-edit-input ${opts.text ? "is-text" : ""}`, label)
      : `<div class="${valueClass}" title="${escapeAttr(value)}">${escapeHTML(value)}</div>`;

    return `
      <div class="cd-card cd-spec">
        <div class="cd-card-label">${label}</div>
        ${renderedValue}
      </div>
    `;
  }

  function renderTobaccoRow(label, fieldKey, value) {
    const renderedValue = editMode && draft
      ? `<textarea class="cd-edit-textarea" data-edit-field="${fieldKey}" rows="2" placeholder="${escapeAttr(label)}">${escapeHTML(draft[fieldKey] || "")}</textarea>`
      : `<div class="cd-tobacco-value wrap-text" title="${escapeAttr(value)}">${escapeHTML(value)}</div>`;

    return `
      <div class="cd-tobacco-row">
        <div class="cd-card-label">${label}</div>
        ${renderedValue}
      </div>
    `;
  }

  function renderOriginCard(origin, flag) {
    if (editMode && draft) {
      return `
        <div class="cd-card cd-origin">
          <div class="cd-card-label">Origin</div>
          <div class="cd-origin-row is-editing">
            ${renderTextInput("origin", draft.origin, "cd-edit-input cd-edit-input--origin", "Country")}
          </div>
        </div>
      `;
    }

    return `
      <div class="cd-card cd-origin">
        <div class="cd-card-label">Origin</div>
        <div class="cd-origin-row">
          <div class="cd-origin-value" title="Rolled in ${escapeAttr(origin)}">
            Rolled in ${escapeHTML(origin)}
          </div>
          ${flag ? `<div class="cd-flag" aria-hidden="true">${flag}</div>` : ``}
        </div>
      </div>
    `;
  }

  function renderActionRow() {
    if (editMode) {
      return `
        <div class="cd-actions is-editing">
          <button class="cd-action" type="button" id="cdCancelEdit">Cancel</button>
          <button class="cd-action cd-action--primary" type="button" id="cdSaveEdit">Save</button>
          <button class="cd-action" type="button" id="cdFavorite">+ Favorites</button>
          <button class="cd-action" type="button" id="cdWishlist">+ Wishlist</button>
        </div>
      `;
    }

    return `
      <div class="cd-actions">
        <button class="cd-action" type="button" id="cdCompare">Compare</button>
        <button class="cd-action" type="button" id="cdFavorite">+ Favorites</button>
        <button class="cd-action" type="button" id="cdWishlist">+ Wishlist</button>
        <button class="cd-action" type="button" id="cdEdit">Edit</button>
      </div>
    `;
  }

  function addCurrentCigarToCart(rec) {
    const cartApi = window.cigarOSCart;
    if (!cartApi || typeof cartApi.add !== "function") return;

    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    const vitola = getVitola(rec) || getShape(rec);

    cartApi.add({
      type: "cigar",
      id: getCigarId(rec),
      brand,
      line,
      name: [line, name].filter(Boolean).join(" ").trim() || name || line || brand,
      vitola,
      price: getPrice(rec),
      image: buildCigarImageCandidates(rec)[0] || "",
      url: window.location.href
    });
  }

  function bindDraftInputs() {
    $$("[data-edit-field]", card).forEach((el) => {
      const field = el.dataset.editField;
      el.addEventListener("input", (e) => {
        if (!draft) return;
        draft[field] = e.target.value;
      });
    });
  }

  function render(records, rec) {
    activeRecord = rec;

    const id = getCigarId(rec);
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    const vitola = getVitola(rec) || "—";
    const wrapper = getWrapper(rec) || "—";
    const binder = getBinder(rec) || "—";
    const filler = getFiller(rec) || "—";
    const origin = getOrigin(rec) || "—";
    const strength = getStrength(rec) || "—";
    const shade = getShade(rec) || "—";
    const shape = getShape(rec) || "—";
    const ring = getRing(rec) || "—";
    const length = getLength(rec) || "—";
    const cigarImgCandidates = buildCigarImageCandidates(rec);
    const brandImgCandidates = buildBrandIconCandidates(rec);
    const flag = flagForCountry(editMode && draft ? draft.origin : origin);
    const accolades = collectAccolades(records, rec);

    document.title = bestTitle(rec);

    const msrp = editMode && draft
      ? Number(String(draft.msrp).replace(/[^0-9.]/g, ""))
      : getPrice(rec);

    const msrpText = Number.isFinite(msrp) && msrp > 0 ? `$${msrp.toFixed(2)}` : "";

    card.innerHTML = `
      <div class="cd-head">
        ${renderTopCopy(brand, line, name)}

        ${
          brandImgCandidates.length
            ? `<img class="cd-badge"
                id="cdBrandBadge"
                src="${escapeAttr(brandImgCandidates[0])}"
                data-fallbacks='${escapeAttr(JSON.stringify(brandImgCandidates.slice(1)))}'
                alt="${escapeAttr(brand)}"
                loading="lazy"
                decoding="async">`
            : `<div class="cd-badge-placeholder">Brand</div>`
        }
      </div>

      <div class="cd-grid">
        <div class="cd-left">
          ${
            cigarImgCandidates.length
              ? `<img class="cd-stick"
                  id="cdStickImage"
                  src="${escapeAttr(cigarImgCandidates[0])}"
                  data-fallbacks='${escapeAttr(JSON.stringify(cigarImgCandidates.slice(1)))}'
                  alt="${escapeAttr([line, name].filter(Boolean).join(" ").trim() || name || line || "Cigar")}"
                  loading="lazy"
                  decoding="async">`
              : `<div class="cd-stick-placeholder">No image</div>`
          }
        </div>

        <div class="cd-right">
          <div class="cd-spec-grid">
            ${renderSpecCard("Ring", "ring", editMode && draft ? draft.ring || "—" : ring)}
            ${renderSpecCard("Length", "length", editMode && draft ? draft.length || "—" : length)}
            ${renderSpecCard("Vitola", "vitola", editMode && draft ? draft.vitola || "—" : vitola, { text: true })}
            ${renderSpecCard("Wrapper Shade", "shade", editMode && draft ? draft.shade || "—" : shade, { text: true })}
            ${renderSpecCard("Strength", "strength", editMode && draft ? draft.strength || "—" : strength, { text: true })}
            ${renderSpecCard("Shape", "shape", editMode && draft ? draft.shape || "—" : shape, { text: true })}
          </div>

          <div class="cd-card cd-tobaccos">
            ${renderTobaccoRow("Wrapper", "wrapper", wrapper)}
            ${renderTobaccoRow("Binder", "binder", binder)}
            ${renderTobaccoRow("Filler", "filler", filler)}
          </div>

          <div class="cd-meta-stack">
            ${renderOriginCard(editMode && draft ? draft.origin || "—" : origin, flag)}

            <div class="cd-card cd-accolades">
              <div class="cd-card-label">Accolades</div>
              <div class="cd-accolade-list">${renderAccolades(accolades)}</div>
            </div>
          </div>

          ${renderActionRow()}

          ${
            editMode
              ? `<div class="cd-msrp-edit">
                  <div class="cd-card-label">MSRP</div>
                  ${renderTextInput("msrp", draft?.msrp || "", "cd-edit-input cd-edit-input--msrp", "MSRP")}
                </div>`
              : msrpText
                ? `<div class="cd-msrp">MSRP ${escapeHTML(msrpText)}</div>`
                : ``
          }
        </div>
      </div>
    `;

    const favoriteSet = readSet(FAVORITES_KEY);
    const compareSet = readSet(COMPARE_KEY);

    const favoriteBtn = $("#cdFavorite");
    const compareBtn = $("#cdCompare");
    const wishlistBtn = $("#cdWishlist");
    const editBtn = $("#cdEdit");
    const cancelEditBtn = $("#cdCancelEdit");
    const saveEditBtn = $("#cdSaveEdit");

    function syncUI() {
      favoriteBtn?.classList.toggle("is-on", favoriteSet.has(id));
      compareBtn?.classList.toggle("is-on", compareSet.has(id));
    }

    favoriteBtn?.addEventListener("click", () => {
      if (!id) return;
      if (favoriteSet.has(id)) favoriteSet.delete(id);
      else favoriteSet.add(id);
      writeSet(FAVORITES_KEY, favoriteSet);
      syncUI();
    });

    compareBtn?.addEventListener("click", () => {
      if (!id) return;
      if (compareSet.has(id)) compareSet.delete(id);
      else compareSet.add(id);

      const capped = Array.from(compareSet).slice(0, 4);
      writeSet(COMPARE_KEY, new Set(capped));
      syncUI();
    });

    wishlistBtn?.addEventListener("click", () => {
      addCurrentCigarToCart(rec);
    });

    editBtn?.addEventListener("click", () => {
      draft = makeDraftFromRecord(rec);
      editMode = true;
      render(recordsCache, activeRecord);
    });

    cancelEditBtn?.addEventListener("click", () => {
      editMode = false;
      draft = null;
      render(recordsCache, activeRecord);
    });

    saveEditBtn?.addEventListener("click", async () => {
      if (!activeRecord || !draft) return;

      applyDraftToRecord(activeRecord, draft);

      try {
        const wroteToSheet = await persistDraftToSheet(activeRecord, draft);
        editMode = false;
        draft = null;
        render(recordsCache, activeRecord);

        if (!wroteToSheet) {
          alert("Saved on page. To save back to Google Sheets too, add your Apps Script/webhook URL to SHEET_SAVE_ENDPOINT in cigar.js.");
        }
      } catch (err) {
        console.warn("[cigar detail] sheet save error:", err);
        editMode = false;
        draft = null;
        render(recordsCache, activeRecord);
        alert("Saved on page, but sheet save failed.");
      }
    });

    syncUI();

    if (editMode) bindDraftInputs();

    wireImageFallback($("#cdBrandBadge"), "cd-badge-placeholder", "Brand");
    wireImageFallback($("#cdStickImage"), "cd-stick-placeholder", "No image");
  }

  function wireImageFallback(img, fallbackClass, fallbackText) {
    if (!img) return;

    function tryNext() {
      let fallbacks = [];
      try {
        fallbacks = JSON.parse(img.dataset.fallbacks || "[]");
      } catch {
        fallbacks = [];
      }

      const next = fallbacks.shift();
      img.dataset.fallbacks = JSON.stringify(fallbacks);

      if (next) {
        img.src = next;
        return;
      }

      const fallback = document.createElement("div");
      fallback.className = fallbackClass;
      fallback.textContent = fallbackText;
      img.replaceWith(fallback);
    }

    img.addEventListener("error", tryNext, { once: false });
  }

  async function load() {
    applyTheme(getSavedTheme());

    themeToggle?.addEventListener("click", () => {
      applyTheme(getSavedTheme() === "dark" ? "light" : "dark");
    });

    backBtn?.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else window.location.href = "/pos/cigars/";
    });

    const idParam = getParam("id") || getParam("key");
    const slugParam = getParam("slug");

    try {
      const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
      const csvText = await res.text();

      const rows = parseCSV(csvText);
      const records = rowsToObjects(rows);
      recordsCache = records;

      let rec = null;

      if (idParam) rec = findById(records, idParam);
      if (!rec && idParam) rec = findBySlug(records, idParam);

      if (!rec && slugParam) rec = findBySlug(records, slugParam);
      if (!rec && slugParam && slugParam.includes("/")) {
        const last = slugParam.split("/").filter(Boolean).slice(-1)[0];
        rec = findBySlug(records, last);
      }

      if (!rec) {
        card.innerHTML = `<div class="cd-loading">Cigar not found.</div>`;
        return;
      }

      activeRecord = rec;
      render(records, rec);
    } catch (e) {
      card.innerHTML = `<div class="cd-loading">Error loading cigar data.</div>`;
      console.warn("[cigar detail] load error:", e);
    } finally {
      if (loading) loading.style.display = "none";
    }
  }

  load();
})();
