(() => {
  "use strict";

  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const FAVORITES_KEY = "cigaros_favorite_keys";
  const COMPARE_KEY = "cigaros_compare_keys";

  const $ = (sel, root = document) => root.querySelector(sel);

  const card = $("#cdCard");
  const loading = $("#cdLoading");
  const backBtn = $("#cdBack");
  const themeToggle = $("#theme-toggle");
  const rootEl = document.documentElement;

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name) || "";
    } catch {
      return "";
    }
  }

  function getSavedTheme() {
    return localStorage.getItem("theme") || rootEl.getAttribute("data-theme") || "dark";
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    rootEl.setAttribute("data-theme", next);
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
    return getField(rec, ["Wrapper", "wrapper"]);
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
        return value === targetRaw || normalizeLoose(value) === targetLoose || slugify(value) === targetSlug;
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
      return makeSlugFromRecord(r) === targetSlug || slugify(getCigarId(r)) === targetSlug;
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

      return getBrand(row) === brand && getName(row) === name && getVitola(row) === vitola;
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

      if (Number.isFinite(rankA) && Number.isFinite(rankB) && rankA !== rankB) return rankA - rankB;
      if (Number.isFinite(yearA) && Number.isFinite(yearB) && yearA !== yearB) return yearB - yearA;
      return String(a.media).localeCompare(String(b.media));
    });

    return out.slice(0, 2);
  }

  function renderAccolades(accolades) {
    if (!accolades.length) return "";

    return accolades.map((item) => {
      const parts = [];
      if (item.rank) parts.push(`#${escapeHTML(item.rank)}`);
      if (item.year) parts.push(`of ${escapeHTML(item.year)}`);
      if (item.media) parts.push(escapeHTML(item.media));
      return `<div class="cd-accolade-line">${parts.join(" - ").replace(" - of ", " of ")}</div>`;
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

      combos.filter(Boolean).forEach((key) => {
        out.push(`/img/cigars/${brandFolder}/${key}.png`);
      });
    }

    return Array.from(new Set(out.filter(Boolean)));
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

  function render(records, rec) {
    const id = getCigarId(rec);
    const brand = getBrand(rec) || "—";
    const line = getLine(rec);
    const name = getName(rec);
    const displayName = [line, name].filter(Boolean).join(" ").trim() || name || line || "—";
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
    const flag = flagForCountry(origin);
    const accolades = collectAccolades(records, rec);

    document.title = `${brand} ${displayName}`.trim();

    card.innerHTML = `
      <div class="cd-head">
        <div class="cd-head-copy">
          <div class="cd-brand">${escapeHTML(brand)}</div>
          <div class="cd-name">${escapeHTML(displayName)}</div>
        </div>

        ${
          brandImgCandidates.length
            ? `<img
                class="cd-badge"
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
              ? `<img
                  class="cd-stick"
                  id="cdStickImage"
                  src="${escapeAttr(cigarImgCandidates[0])}"
                  data-fallbacks='${escapeAttr(JSON.stringify(cigarImgCandidates.slice(1)))}'
                  alt="${escapeAttr(displayName)}"
                  loading="lazy"
                  decoding="async">`
              : `<div class="cd-stick-placeholder">No image</div>`
          }
        </div>

        <div class="cd-right">
          <div class="cd-stat-grid">
            <div class="cd-card cd-stat">
              <div class="cd-card-label">Ring</div>
              <div class="cd-stat-value">${escapeHTML(ring)}</div>
            </div>
            <div class="cd-card cd-stat">
              <div class="cd-card-label">Length</div>
              <div class="cd-stat-value">${escapeHTML(length)}</div>
            </div>
          </div>

          <div class="cd-mini-grid">
            <div class="cd-card cd-mini">
              <div class="cd-card-label">Vitola</div>
              <div class="cd-mini-value">${escapeHTML(vitola)}</div>
            </div>
            <div class="cd-card cd-mini">
              <div class="cd-card-label">Wrapper Shade</div>
              <div class="cd-mini-value">${escapeHTML(shade)}</div>
            </div>
            <div class="cd-card cd-mini">
              <div class="cd-card-label">Strength</div>
              <div class="cd-mini-value">${escapeHTML(strength)}</div>
            </div>
            <div class="cd-card cd-mini">
              <div class="cd-card-label">Shape</div>
              <div class="cd-mini-value">${escapeHTML(shape)}</div>
            </div>
          </div>

          <div class="cd-card cd-tobaccos">
            <div class="cd-tobacco-row">
              <div class="cd-card-label">Wrapper</div>
              <div class="cd-tobacco-value wrap-text">${escapeHTML(wrapper)}</div>
            </div>
            <div class="cd-tobacco-row">
              <div class="cd-card-label">Binder</div>
              <div class="cd-tobacco-value wrap-text">${escapeHTML(binder)}</div>
            </div>
            <div class="cd-tobacco-row">
              <div class="cd-card-label">Filler</div>
              <div class="cd-tobacco-value wrap-text">${escapeHTML(filler)}</div>
            </div>

            <div class="cd-origin-inline">
              <span class="cd-origin-inline-text">Rolled in ${escapeHTML(origin)}</span>
              ${flag ? `<span class="cd-flag" aria-hidden="true">${flag}</span>` : ``}
            </div>
          </div>

          ${accolades.length ? `<div class="cd-accolades-inline">${renderAccolades(accolades)}</div>` : ``}

          <div class="cd-actions">
            <button class="cd-action" type="button" id="cdCompare">Compare</button>
            <button class="cd-action" type="button" id="cdFavorite">Favorite</button>
            <button class="cd-action" type="button" id="cdWishlist">Wishlist</button>
            <button class="cd-action cd-action--primary" type="button" id="cdEdit">Edit</button>
          </div>
        </div>
      </div>
    `;

    const favoriteSet = readSet(FAVORITES_KEY);
    const compareSet = readSet(COMPARE_KEY);

    const favoriteBtn = $("#cdFavorite");
    const compareBtn = $("#cdCompare");
    const wishlistBtn = $("#cdWishlist");

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
      const cartApi = window.cigarOSCart;
      if (!cartApi || typeof cartApi.add !== "function") return;

      cartApi.add({
        type: "cigar",
        key: id,
        id,
        brand,
        line,
        name: displayName,
        vitola,
        ring,
        length,
        shape,
        wrapper,
        binder,
        filler,
        origin,
        shade,
        strength,
        image: cigarImgCandidates[0] || "",
        url: window.location.href
      });
    });

    syncUI();

    wireImageFallback($("#cdBrandBadge"), "cd-badge-placeholder", "Brand");
    wireImageFallback($("#cdStickImage"), "cd-stick-placeholder", "No image");
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

      let rec = null;
      if (idParam) rec = findById(records, idParam);
      if (!rec && idParam) rec = findBySlug(records, idParam);
      if (!rec && slugParam) rec = findBySlug(records, slugParam);

      if (!rec) {
        card.innerHTML = `<div class="cd-loading">Cigar not found.</div>`;
        return;
      }

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
