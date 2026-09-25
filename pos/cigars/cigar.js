(() => {
  "use strict";

  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const FAVORITES_KEY = "cigaros_favorite_keys";
  const COMPARE_KEY = "cigaros_compare_keys";

  // Sheet column positions (0-based)
  // A=0 ... J=9, K=10, L=11, M=12
  const LENGTH_COL_INDEX = 10; // Column L
  const RING_COL_INDEX = 11;   // Column M

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
    return (
      localStorage.getItem("theme") ||
      rootEl.getAttribute("data-theme") ||
      "dark"
    );
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";

    rootEl.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);

    themeToggle?.setAttribute(
      "aria-pressed",
      String(next === "dark")
    );
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

    return value.startsWith("/")
      ? value
      : `/${value}`;
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

      if (
        (ch === "\n" || ch === "\r") &&
        !inQuotes
      ) {
        if (ch === "\r" && next === "\n") {
          i++;
        }

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
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function rowsToObjects(rows) {
    if (!rows || rows.length < 2) {
      return [];
    }

    const headers = rows[0].map(
      (h) => String(h || "").trim()
    );

    const normHeaders = headers.map(
      normalizeHeader
    );

    const data = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];

      if (
        !r ||
        r.every(
          (c) => !String(c || "").trim()
        )
      ) {
        continue;
      }

      const obj = {};

      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = r[j] ?? "";
        obj[normHeaders[j]] = r[j] ?? "";
      }

      obj.__row = r;
      obj.__length_col =
        r[LENGTH_COL_INDEX] ?? "";

      obj.__ring_col =
        r[RING_COL_INDEX] ?? "";

      data.push(obj);
    }

    return data;
  }

  function getField(rec, keys) {
    for (const key of keys) {
      const value = rec?.[key];

      if (
        value != null &&
        String(value).trim() !== ""
      ) {
        return String(value).trim();
      }
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
    return getField(rec, [
      "Brand",
      "brand",
      "brandname",
      "Brand aka",
      "brandaka"
    ]);
  }

  function getLine(rec) {
    return getField(rec, [
      "Line",
      "line",
      "Series",
      "series"
    ]);
  }

  function getName(rec) {
    return getField(rec, [
      "Cigar",
      "cigar",
      "Name",
      "name"
    ]);
  }

  function getVitola(rec) {
    return getField(rec, [
      "Vitola",
      "vitola",
      "Style",
      "style",
      "Size",
      "size"
    ]);
  }

  function getShape(rec) {
    return getField(rec, [
      "Shape",
      "shape"
    ]);
  }

  function getWrapper(rec) {
    return getField(rec, [
      "Wrapper",
      "wrapper"
    ]);
  }

  function getBinder(rec) {
    return getField(rec, [
      "Binder",
      "binder"
    ]);
  }

  function getFiller(rec) {
    return getField(rec, [
      "Filler",
      "filler"
    ]);
  }

  function getStrength(rec) {
    return getField(rec, [
      "Strength",
      "strength"
    ]);
  }

  function getRing(rec) {
    return getField(rec, [
      "Ring",
      "ring",
      "RG",
      "rg",
      "Ring Gauge",
      "ringgauge",
      "Ring Size",
      "ringsize"
    ]);
  }

  function getLength(rec) {
    return getField(rec, [
      "Length",
      "length",
      "Len",
      "len"
    ]);
  }

  function getOrigin(rec) {
    return getField(rec, [
      "Origin",
      "origin",
      "Country",
      "country"
    ]);
  }

  function getShade(rec) {
    return getField(rec, [
      "Wrapper Shade",
      "wrappershade",
      "wrapper_shade",
      "shade"
    ]);
  }

  function getImage(rec) {
    return getField(rec, [
      "Cigar IMG",
      "cigarimg",
      "Image",
      "image",
      "Photo",
      "photo"
    ]);
  }

  function getBrandImage(rec) {
    return getField(rec, [
      "Brand IMG",
      "brandimg",
      "brand_image"
    ]);
  }

  function getLineImage(rec) {
    return getField(rec, [
      "Line IMG",
      "lineimg",
      "line_image",
      "Line Image",
      "lineimage",
      "brand_line_img"
    ]);
  }

  function makeSlugFromRecord(rec) {
    const id = getCigarId(rec);
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    const vitola = getVitola(rec);

    return slugify(
      [
        brand,
        line,
        name,
        vitola,
        id
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  function scoreRecord(rec) {
    let score = 0;

    if (getRing(rec)) score += 50;
    if (getLength(rec)) score += 50;
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
    const targetRaw =
      String(id || "").trim();

    if (!targetRaw) {
      return null;
    }

    const targetLoose =
      normalizeLoose(targetRaw);

    const targetSlug =
      slugify(targetRaw);

    const matches = records.filter((r) => {
      const candidates = [
        getField(r, [
          "Key",
          "key",
          "Cigar ID",
          "cigarId",
          "cigarid",
          "cigar_id",
          "id",
          "row_id"
        ]),

        getField(r, [
          "Cigar",
          "cigar",
          "Name",
          "name"
        ]),

        [
          getLine(r),
          getName(r)
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),

        [
          getBrand(r),
          getLine(r),
          getName(r)
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),

        [
          getBrand(r),
          getName(r)
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),

        [
          getName(r),
          getVitola(r)
        ]
          .filter(Boolean)
          .join(" ")
          .trim()
      ]
        .filter(Boolean)
        .map(
          (v) => String(v).trim()
        );

      return candidates.some((value) => {
        return (
          value === targetRaw ||
          normalizeLoose(value) === targetLoose ||
          slugify(value) === targetSlug
        );
      });
    });

    if (!matches.length) {
      return null;
    }

    matches.sort(
      (a, b) =>
        scoreRecord(b) -
        scoreRecord(a)
    );

    return (
      matches.find(
        (r) =>
          getRing(r) &&
          getLength(r)
      ) ||
      matches[0]
    );
  }

  function findBySlug(records, slug) {
    const target =
      String(slug || "").trim();

    if (!target) {
      return null;
    }

    const targetSlug =
      slugify(target);

    const matches = records.filter((r) => {
      return (
        makeSlugFromRecord(r) === targetSlug ||
        slugify(getCigarId(r)) === targetSlug
      );
    });

    if (!matches.length) {
      return null;
    }

    matches.sort(
      (a, b) =>
        scoreRecord(b) -
        scoreRecord(a)
    );

    return (
      matches.find(
        (r) =>
          getRing(r) &&
          getLength(r)
      ) ||
      matches[0]
    );
  }

  function findByPipeKey(records, idParam) {
    const raw =
      String(idParam || "").trim();

    if (
      !raw ||
      !raw.includes("|")
    ) {
      return null;
    }

    const parts = raw
      .split("|")
      .map(
        (s) =>
          String(s || "").trim()
      );

    const [
      rawBrand = "",
      rawName = "",
      rawVitola = ""
    ] = parts;

    const partBrandLoose =
      normalizeLoose(rawBrand);

    const partBrandCompact =
      compactKey(rawBrand);

    const partName =
      normalizeLoose(rawName);

    const partVitola =
      normalizeLoose(rawVitola);

    const matches = records.filter((r) => {
      const brandRaw =
        getBrand(r);

      const brandLoose =
        normalizeLoose(brandRaw);

      const brandCompact =
        compactKey(brandRaw);

      const line =
        normalizeLoose(getLine(r));

      const cigar =
        normalizeLoose(getName(r));

      const vitola =
        normalizeLoose(getVitola(r));

      const fullName =
        normalizeLoose(
          [line, cigar]
            .filter(Boolean)
            .join(" ")
        );

      const brandMatch =
        !partBrandLoose ||
        brandLoose === partBrandLoose ||
        brandCompact === partBrandCompact;

      const nameMatch =
        !partName ||
        fullName === partName ||
        cigar === partName ||
        fullName.includes(partName) ||
        partName.includes(fullName);

      const vitolaMatch =
        !partVitola ||
        vitola === partVitola;

      return (
        brandMatch &&
        nameMatch &&
        vitolaMatch
      );
    });

    if (!matches.length) {
      return null;
    }

    matches.sort(
      (a, b) =>
        scoreRecord(b) -
        scoreRecord(a)
    );

    return matches[0];
  }

  function readSet(key) {
    try {
      const raw = JSON.parse(
        localStorage.getItem(key) || "[]"
      );

      return new Set(
        Array.isArray(raw)
          ? raw
          : []
      );
    } catch {
      return new Set();
    }
  }

  function writeSet(key, set) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(
          Array.from(set)
        )
      );
    } catch {}
  }

  function flagForCountry(country) {
    const c =
      String(country || "")
        .trim()
        .toLowerCase();

    if (c === "cuba") {
      return "🇨🇺";
    }

    if (c === "nicaragua") {
      return "🇳🇮";
    }

    if (c === "dominican republic") {
      return "🇩🇴";
    }

    if (c === "honduras") {
      return "🇭🇳";
    }

    if (c === "mexico") {
      return "🇲🇽";
    }

    if (c === "ecuador") {
      return "🇪🇨";
    }

    if (
      c === "usa" ||
      c === "united states"
    ) {
      return "🇺🇸";
    }

    return "";
  }

  function collectAccolades(records, rec) {
    const key = getCigarId(rec);
    const brand = getBrand(rec);
    const name = getName(rec);
    const vitola = getVitola(rec);

    const matches = records.filter((row) => {
      const rowKey = getCigarId(row);

      if (
        key &&
        rowKey &&
        rowKey === key
      ) {
        return true;
      }

      return (
        getBrand(row) === brand &&
        getName(row) === name &&
        getVitola(row) === vitola
      );
    });

    const out = [];
    const seen = new Set();

    matches.forEach((row) => {
      const media = getField(row, [
        "Media",
        "media",
        "Source",
        "source"
      ]);

      const year = getField(row, [
        "Year",
        "year"
      ]);

      const rank = getField(row, [
        "Rank",
        "rank"
      ]);

      if (
        !media &&
        !year &&
        !rank
      ) {
        return;
      }

      const sig =
        `${media}|${year}|${rank}`;

      if (seen.has(sig)) {
        return;
      }

      seen.add(sig);

      out.push({
        media,
        year,
        rank
      });
    });

    out.sort((a, b) => {
      const rankA =
        parseInt(a.rank, 10);

      const rankB =
        parseInt(b.rank, 10);

      const yearA =
        parseInt(a.year, 10);

      const yearB =
        parseInt(b.year, 10);

      if (
        Number.isFinite(rankA) &&
        Number.isFinite(rankB) &&
        rankA !== rankB
      ) {
        return rankA - rankB;
      }

      if (
        Number.isFinite(yearA) &&
        Number.isFinite(yearB) &&
        yearA !== yearB
      ) {
        return yearB - yearA;
      }

      return String(a.media)
        .localeCompare(
          String(b.media)
        );
    });

    return out.slice(0, 2);
  }

  function renderAccolades(accolades) {
    if (!accolades.length) {
      return "";
    }

    return accolades
      .map((item) => {
        const parts = [];

        if (item.rank) {
          parts.push(
            `#${escapeHTML(item.rank)}`
          );
        }

        if (item.year) {
          parts.push(
            `of ${escapeHTML(item.year)}`
          );
        }

        if (item.media) {
          parts.push(
            escapeHTML(item.media)
          );
        }

        return `
          <div class="cd-accolade-line">
            ${
              parts
                .join(" - ")
                .replace(" - of ", " of ")
            }
          </div>
        `;
      })
      .join("");
  }

  function resolveIsCuban(rec) {
    const explicit = getField(rec, [
      "Cuban",
      "cuban",
      "is_cuban"
    ]);

    if (explicit) {
      const v =
        explicit
          .toLowerCase()
          .trim();

      if (
        [
          "x",
          "yes",
          "true",
          "1",
          "cuban"
        ].includes(v)
      ) {
        return true;
      }

      if (
        [
          "no",
          "false",
          "0",
          "non-cuban",
          "non cuban"
        ].includes(v)
      ) {
        return false;
      }
    }

    return (
      getOrigin(rec)
        .toLowerCase() === "cuba"
    );
  }

  function buildBrandIconCandidates(rec) {
    const lineImg =
      normalizeAssetPath(
        getLineImage(rec)
      );

    const brandImg =
      normalizeAssetPath(
        getBrandImage(rec)
      );

    const brand =
      getBrand(rec);

    const brandKey =
      normalizeBrand(brand);

    const out = [];

    if (lineImg) {
      out.push(lineImg);
    }

    if (brandImg) {
      out.push(brandImg);
    }

    if (brandKey) {
      out.push(
        `/img/icons/brands/${brandKey}.svg`
      );

      out.push(
        `/img/icons/brands/${brandKey}.png`
      );
    }

    return Array.from(
      new Set(
        out.filter(Boolean)
      )
    );
  }

  function buildCigarImageCandidates(rec) {
    const fromSheet =
      normalizeAssetPath(
        getImage(rec)
      );

    const brand =
      getBrand(rec);

    const line =
      getLine(rec);

    const cigar =
      getName(rec);

    const vitola =
      getVitola(rec);

    const brandFolder =
      normalizeBrand(brand);

    const brandKey =
      compactKey(brand);

    const lineKey =
      compactKey(line);

    const cigarKey =
      compactKey(cigar);

    const vitolaKey =
      compactKey(vitola);

    const out = [];

    const isCuban =
      resolveIsCuban(rec);

    if (
      isCuban &&
      brandFolder
    ) {
      if (
        lineKey &&
        cigarKey
      ) {
        out.push(
          `/img/cigars/cuban/${brandFolder}/${lineKey}${cigarKey}.png`
        );
      }

      if (
        lineKey &&
        cigarKey &&
        vitolaKey
      ) {
        out.push(
          `/img/cigars/cuban/${brandFolder}/${lineKey}${cigarKey}${vitolaKey}.png`
        );
      }

      if (cigarKey) {
        out.push(
          `/img/cigars/cuban/${brandFolder}/${cigarKey}.png`
        );
      }
    }

    if (fromSheet) {
      out.push(fromSheet);
    }

    if (brandFolder) {
      const names = [];

      if (
        brandKey &&
        lineKey &&
        cigarKey
      ) {
        names.push(
          `${brandKey}${lineKey}${cigarKey}`
        );
      }

      if (
        brandKey &&
        lineKey &&
        cigarKey &&
        vitolaKey
      ) {
        names.push(
          `${brandKey}${lineKey}${cigarKey}${vitolaKey}`
        );
      }

      if (
        lineKey &&
        cigarKey
      ) {
        names.push(
          `${lineKey}${cigarKey}`
        );
      }

      if (
        lineKey &&
        cigarKey &&
        vitolaKey
      ) {
        names.push(
          `${lineKey}${cigarKey}${vitolaKey}`
        );
      }

      if (
        lineKey &&
        vitolaKey
      ) {
        names.push(
          `${lineKey}${vitolaKey}`
        );
      }

      if (
        brandKey &&
        cigarKey
      ) {
        names.push(
          `${brandKey}${cigarKey}`
        );
      }

      if (
        brandKey &&
        cigarKey &&
        vitolaKey
      ) {
        names.push(
          `${brandKey}${cigarKey}${vitolaKey}`
        );
      }

      if (cigarKey) {
        names.push(
          `${cigarKey}`
        );
      }

      if (
        cigarKey &&
        vitolaKey
      ) {
        names.push(
          `${cigarKey}${vitolaKey}`
        );
      }

      Array.from(
        new Set(names)
      ).forEach((name) => {
        out.push(
          `/img/cigars/${brandFolder}/${name}.png`
        );
      });
    }

    return Array.from(
      new Set(
        out.filter(Boolean)
      )
    );
  }

  function wireImageFallback(
    img,
    fallbackClass,
    fallbackText
  ) {
    if (!img) {
      return;
    }

    function tryNext() {
      let fallbacks = [];

      try {
        fallbacks = JSON.parse(
          img.dataset.fallbacks || "[]"
        );
      } catch {
        fallbacks = [];
      }

      const next =
        fallbacks.shift();

      img.dataset.fallbacks =
        JSON.stringify(fallbacks);

      if (next) {
        img.src = next;
        return;
      }

      const fallback =
        document.createElement("div");

      fallback.className =
        fallbackClass;

      fallback.textContent =
        fallbackText;

      img.replaceWith(fallback);
    }

    img.addEventListener(
      "error",
      tryNext,
      {
        once: false
      }
    );
  }

  function buildBrandHref(brand) {
    const value =
      String(brand || "").trim();

    if (!value) {
      return "/pos/cigars/";
    }

    return (
      `/pos/cigars/brand?brand=` +
      encodeURIComponent(value)
    );
  }

  function wireBrandNavigation(brand) {
    const href =
      buildBrandHref(brand);

    const brandTextEl =
      $(".cd-brand");

    const brandBadgeEl =
      $("#cdBrandBadge");

    const activate = (el) => {
      if (!el) {
        return;
      }

      el.style.cursor =
        "pointer";

      el.setAttribute(
        "role",
        "link"
      );

      el.setAttribute(
        "tabindex",
        "0"
      );

      const go = () => {
        window.location.href =
          href;
      };

      el.addEventListener(
        "click",
        go
      );

      el.addEventListener(
        "keydown",
        (e) => {
          if (
            e.key === "Enter" ||
            e.key === " "
          ) {
            e.preventDefault();
            go();
          }
        }
      );
    };

    activate(brandTextEl);
    activate(brandBadgeEl);
  }

  /*
    Demo POS storage adapter. Replace only these async load/save functions
    with an authenticated, store-scoped POS/HUB API for production.
    IndexedDB stores fields and image together in this browser only.
    Existing localStorage POS records are read until next saved to IndexedDB.
    This is demo storage, not secure shared HUB storage.
    Production authorization, MFA and access rules belong in the backend;
    never put privileged Supabase credentials in browser code.
  */
  const POS_STORAGE_PREFIX = "cigaros_demo_pos_v1:";
  const localCigarImages = new Map();

  function openPosDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("cigaros_demo_pos", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("records", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Browser storage is busy."));
    });
  }

  async function loadPosRecord(key) {
    if (!key) throw new Error("A cigar key is required.");
    const db = await openPosDatabase();
    const saved = await new Promise((resolve, reject) => {
      const tx = db.transaction("records", "readonly");
      const request = tx.objectStore("records").get(key);
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
    if (saved) return saved;
    const raw = localStorage.getItem(POS_STORAGE_PREFIX + key);
    if (raw === null) return null;
    let record;
    try {
      record = JSON.parse(raw);
    } catch {
      return null;
    }
    return record && typeof record === "object" &&
      !Array.isArray(record) && record.key === key ? record : null;
  }

  async function savePosRecord(record) {
    if (!record.key) throw new Error("A cigar key is required.");
    // Fields and original image commit together. Do not close on failure.
    const db = await openPosDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("records", "readwrite");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
      tx.objectStore("records").put(record);
    });
  }

  function cachePosImage(key, image) {
    const previous = localCigarImages.get(key);
    if (previous) URL.revokeObjectURL(previous);
    localCigarImages.delete(key);
    if (image?.blob instanceof Blob) {
      localCigarImages.set(key, URL.createObjectURL(image.blob));
    }
  }

  function showPosImage(rec) {
    const url = localCigarImages.get(getCigarId(rec));
    const container = $(".cd-left", card);
    if (!url || !container) return;
    const img = document.createElement("img");
    img.id = "cdStickImage";
    img.className = "cd-stick";
    img.alt = [getBrand(rec), getName(rec)].filter(Boolean).join(" ");
    img.src = url;
    const existing = $("#cdStickImage", container) ||
      $(".cd-stick-placeholder", container);
    if (existing) existing.replaceWith(img);
    else container.prepend(img);
  }

  function getPosFieldValue(rec, saved, field) {
    // Empty strings and zero are intentional saved values.
    if (saved && Object.prototype.hasOwnProperty.call(saved, field.id)) {
      const value = saved[field.id];
      if (typeof value === "string" || typeof value === "number") {
        return value;
      }
    }
    const keys = [field.label, normalizeHeader(field.label), field.id];
    if (field.id === "inventorySingles") {
      keys.push("Inventory singles", "Inventory", "inventory");
    }
    const hubValue = getField(rec, keys);
    if (hubValue === "") {
      return field.id === "inventorySingles" ? 89 : "";
    }
    if (field.type === "number") {
      // HUB currency cells may include a dollar sign or grouping commas.
      const numericValue = hubValue.replace(/[$,\s]/g, "");
      return numericValue !== "" && Number.isFinite(Number(numericValue))
        ? Number(numericValue) : "";
    }
    return hubValue;
  }

  // UPCs remain strings so manufacturer leading zeros are preserved.
  function isValidManufacturerUPC(value) {
    if (!/^[0-9]{12}$/.test(value)) return false;
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      sum += Number(value[i]) * (i % 2 === 0 ? 3 : 1);
    }
    return (10 - sum % 10) % 10 === Number(value[11]);
  }

  function wireManufacturerBarcodes(sheet) {
    const entries = [
      { input: $("#manufacturerSingleUPC", sheet), prefix: "cdSingle", label: "SINGLE STICK" },
      { input: $("#manufacturerBoxUPC", sheet), prefix: "cdBox", label: "BOX" }
    ];
    const placeholder = $("#cdBarcodePlaceholder", sheet);

    function update() {
      let hasValue = false;
      entries.forEach(({ input, prefix, label }) => {
        const value = input.value;
        const barcodeCard = $("#" + prefix + "BarcodeCard", sheet);
        const svg = $("#" + prefix + "Barcode", sheet);
        const message = $("#" + prefix + "BarcodeMessage", sheet);
        const present = value.trim() !== "";
        hasValue = hasValue || present;
        barcodeCard.style.display = present ? "block" : "none";
        // Remove any old bars immediately, including after an invalid edit.
        svg.replaceChildren();
        svg.style.display = "none";
        svg.removeAttribute("aria-label");
        message.textContent = "";
        message.hidden = true;
        if (!present) return;

        const showMessage = (text) => {
          message.textContent = text;
          message.hidden = false;
        };
        if (!isValidManufacturerUPC(value)) {
          showMessage(/^[0-9]{12}$/.test(value)
            ? "Invalid UPC-A check digit."
            : "Enter exactly 12 digits for a UPC-A barcode.");
          return;
        }
        if (typeof window.JsBarcode !== "function") {
          showMessage("Barcode preview unavailable. Please reload the page.");
          return;
        }
        try {
          window.JsBarcode(svg, value, {
            format: "UPC",
            width: 2,
            height: 72,
            displayValue: true,
            fontSize: 18,
            margin: 12,
            background: "#ffffff",
            lineColor: "#000000"
          });
          // Preserve the complete symbol and quiet zones on narrow screens.
          // JsBarcode 3.11.6 returns SVG dimensions such as "226px".
          const width = Number(svg.getAttribute("width"));
          const height = Number(svg.getAttribute("height"));
          const width = parseFloat(svg.getAttribute("width"));
          const height = parseFloat(svg.getAttribute("height"));
          if (!(width > 0 && height > 0)) throw new Error("Empty barcode");
          svg.setAttribute("viewBox", "0 0 " + width + " " + height);
          svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
          svg.setAttribute("role", "img");
          svg.setAttribute("aria-label", label + " UPC-A " + value);
          svg.style.display = "block";
          // JsBarcode replaces the inline style, so restore responsive sizing.
          svg.style.cssText = "display: block; width: 100%; height: auto; margin: 0 auto;";
        } catch {
          svg.replaceChildren();
          svg.style.display = "none";
          showMessage("Barcode preview unavailable.");
        }
      });
      placeholder.style.display = hasValue ? "none" : "flex";
    }

    entries.forEach(({ input }) => {
      input.addEventListener("input", update);
      input.addEventListener("change", update);
    });
    update();
    return update;
  }

  async function openPosEditor(rec) {
    const existingEditor =
      document.getElementById(
        "cdPosEditor"
      );

    if (existingEditor) {
      existingEditor.remove();
    }

    const brand =
      getBrand(rec) || "—";

    const line =
      getLine(rec);

    const name =
      getName(rec);

    const displayName =
      [line, name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      name ||
      line ||
      "—";

    const fields = [
      {
        id: "manufacturerSingleUPC",
        label: "Manufacturer Single UPC",
        type: "text",
        inputmode: "numeric"
      },
      {
        id: "manufacturerBoxUPC",
        label: "Manufacturer Box UPC",
        type: "text",
        inputmode: "numeric"
      },
      {
        id: "customSingleSKU",
        label: "Custom Single SKU",
        type: "text",
        inputmode: "text"
      },
      {
        id: "inventorySingles",
        label: "Inventory Singles",
        type: "number",
        inputmode: "numeric"
      },
      {
        id: "inventoryBoxes",
        label: "Inventory Boxes",
        type: "number",
        inputmode: "numeric"
      },
      {
        id: "msrp",
        label: "MSRP",
        type: "number",
        inputmode: "decimal",
        step: "0.01"
      },
      {
        id: "boxCount",
        label: "Box Count",
        type: "number",
        inputmode: "numeric"
      },
      {
        id: "boxMSRP",
        label: "Box MSRP",
        type: "number",
        inputmode: "decimal",
        step: "0.01"
      },
      {
        id: "cigarCost",
        label: "Cigar Cost",
        type: "number",
        inputmode: "decimal",
        step: "0.01"
      },
      {
        id: "customBoxSKU",
        label: "Custom Box SKU",
        type: "text",
        inputmode: "text"
      },
      {
        id: "boxCost",
        label: "Box Cost",
        type: "number",
        inputmode: "decimal",
        step: "0.01"
      }
    ];

    const overlay =
      document.createElement("div");

    overlay.id =
      "cdPosEditor";

    overlay.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 2147483647;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      background: rgba(5, 15, 35, 0.58);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    `;

    const sheet =
      document.createElement("div");

    sheet.style.cssText = `
      position: relative;
      width: 100%;
      max-width: 430px;
      max-height: 90vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      box-sizing: border-box;
      padding:
        12px
        18px
        calc(
          24px +
          env(safe-area-inset-bottom, 0px)
        );
      border-radius: 24px 24px 0 0;
      background: #f5f7fa;
      box-shadow:
        0 -12px 40px
        rgba(0, 0, 0, 0.22);
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "SF Pro Text",
        "Helvetica Neue",
        Arial,
        sans-serif;
    `;

    sheet.innerHTML = `
      <div style="
        width: 38px;
        height: 5px;
        margin: 0 auto 14px;
        border-radius: 999px;
        background: #c7cbd1;
      "></div>

      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      ">

        <button
          id="cdEditCancel"
          type="button"
          style="
            border: 0;
            background: transparent;
            color: #64748b;
            padding: 10px 0;
            font: inherit;
            font-size: 15px;
          "
        >
          Cancel
        </button>

        <div style="
          color: #16263d;
          font-size: 17px;
          font-weight: 700;
          text-align: center;
        ">
          Edit POS Entry
        </div>

        <button
          id="cdEditSave"
          type="button"
          style="
            border: 0;
            background: transparent;
            color: #007aff;
            padding: 10px 0;
            font: inherit;
            font-size: 15px;
            font-weight: 700;
          "
        >
          Save
        </button>

      </div>

      <div style="
        margin: 0 0 16px;
        color: #64748b;
        font-size: 13px;
      ">
        ${escapeHTML(brand)}
        ·
        ${escapeHTML(displayName)}
      </div>

      <div id="cdBarcodeArea" style="
        display: flex; flex-direction: column; gap: 10px;
        width: 100%; margin: 0 0 18px; box-sizing: border-box;
      ">
        <div id="cdSingleBarcodeCard" style="
          display: none; width: 100%; box-sizing: border-box; padding: 12px;
          border: 1px solid rgba(22, 38, 61, 0.12); border-radius: 14px;
          background: #ffffff; text-align: center;
        ">
          <div style="margin-bottom: 7px; color: #64748b; font-size: 10px;
            font-weight: 700; letter-spacing: 0.08em;">SINGLE STICK</div>
          <svg id="cdSingleBarcode" style="
            display: none; width: 100%; height: auto; margin: 0 auto;
          "></svg>
          <div id="cdSingleBarcodeMessage" role="status" aria-live="polite"
            style="padding: 16px 0; color: #64748b; font-size: 12px;" hidden></div>
        </div>
        <div id="cdBoxBarcodeCard" style="
          display: none; width: 100%; box-sizing: border-box; padding: 12px;
          border: 1px solid rgba(22, 38, 61, 0.12); border-radius: 14px;
          background: #ffffff; text-align: center;
        ">
          <div style="margin-bottom: 7px; color: #64748b; font-size: 10px;
            font-weight: 700; letter-spacing: 0.08em;">BOX</div>
          <svg id="cdBoxBarcode" style="
            display: none; width: 100%; height: auto; margin: 0 auto;
          "></svg>
          <div id="cdBoxBarcodeMessage" role="status" aria-live="polite"
            style="padding: 16px 0; color: #64748b; font-size: 12px;" hidden></div>
        </div>
        <div id="cdBarcodePlaceholder" style="
          display: flex; width: 100%; min-height: 92px; box-sizing: border-box;
          align-items: center; justify-content: center; padding: 16px;
          border: 1px dashed rgba(22, 38, 61, 0.20); border-radius: 14px;
          background: rgba(255, 255, 255, 0.45); color: #64748b;
          font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-align: center;
        ">NO MANUFACTURER BARCODE ADDED</div>
      </div>

      <div id="cdEditStatus" role="status" aria-live="polite"
        style="margin-bottom: 12px; color: #b00020;" hidden></div>
      <div style="margin: 0 0 18px;">
        <button id="cdUploadImage" type="button" disabled style="
          width: 100%; padding: 13px; border: 1px solid #007aff;
          border-radius: 12px; background: white; color: #007aff;
          font: inherit; font-weight: 700;">UPLOAD IMAGE</button>
        <input id="cdImageFile" type="file"
          accept="image/png,image/jpeg,image/webp" hidden>
        <p style="color: #64748b; font-size: 12px;">
          Demo: saved for this cigar in this browser only. PNG, JPG or WebP, up to 10 MB.
        </p>
        <img id="cdImagePreview" alt="Selected cigar image" hidden
          style="display: none; max-width: 100%; max-height: 220px; margin: 12px auto; object-fit: contain;">
        <div id="cdImageName" style="color: #64748b; font-size: 12px; overflow-wrap: anywhere;"></div>
      </div>
      <div id="cdEditFields" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 10px; align-items: end;"></div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    const fieldsContainer =
      $("#cdEditFields", sheet);

    fields.forEach((field) => {
      const fieldWrap =
        document.createElement("label");

      fieldWrap.style.cssText = `
        display: block;
        margin: 0;
        min-width: 0;
        ${field.id === "customSingleSKU" ? "grid-column: 1 / -1;" : ""}
      `;

      const stepAttribute =
        field.step
          ? `step="${escapeAttr(field.step)}"`
          : "";

      fieldWrap.innerHTML = `
        <div style="
          margin: 0 0 6px 4px;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
        ">
          ${escapeHTML(field.label)}
        </div>

        <input
          id="${escapeAttr(field.id)}"
          type="${escapeAttr(field.type)}"
          inputmode="${escapeAttr(field.inputmode)}"
          ${stepAttribute}
          autocomplete="off"
          style="
            display: block;
            width: 100%;
            height: 48px;
            min-width: 0;
            box-sizing: border-box;
            border:
              1px solid
              rgba(22, 38, 61, 0.12);
            border-radius: 14px;
            background: #ffffff;
            color: #16263d;
            padding: 0 14px;
            font: inherit;
            font-size: 16px;
            outline: none;
            -webkit-appearance: none;
            appearance: none;
          "
        >
      `;

      fieldsContainer.appendChild(
        fieldWrap
      );
    });

    const updateManufacturerBarcodes = wireManufacturerBarcodes(sheet);

    let previewUrl = "";
    const closeEditor = () => {
      if (saving) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      overlay.remove();
    };

    $("#cdEditCancel", sheet)
      ?.addEventListener(
        "click",
        closeEditor
      );

    const key = getCigarId(rec);
    const saveButton = $("#cdEditSave", sheet);
    const status = $("#cdEditStatus", sheet);
    let ready = false;
    let saving = false;
    let selectingImage = false;
    let selectedImage = null;
    const uploadButton = $("#cdUploadImage", sheet);
    const imageInput = $("#cdImageFile", sheet);
    const preview = $("#cdImagePreview", sheet);
    const imageName = $("#cdImageName", sheet);
    const displayPreview = (image) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = image?.blob instanceof Blob ? URL.createObjectURL(image.blob) : "";
      preview.hidden = !previewUrl;
      preview.style.display = previewUrl ? "block" : "none";
      if (previewUrl) preview.src = previewUrl;
      else preview.removeAttribute("src");
      imageName.textContent = image?.name || "";
    };
    const showError = (message) => {
      status.textContent = message;
      status.hidden = false;
    };
    saveButton.disabled = true;
    uploadButton.addEventListener("click", () => imageInput.click());
    imageInput.addEventListener("change", async () => {
      const file = imageInput.files[0];
      imageInput.value = "";
      if (!file || !ready || saving || selectingImage) return;
      status.hidden = true;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 10 * 1024 * 1024) {
        showError("Choose a PNG, JPG or WebP image no larger than 10 MB.");
        return;
      }
      selectingImage = true;
      saveButton.disabled = true;
      uploadButton.disabled = true;
      const candidateUrl = URL.createObjectURL(file);
      try {
        const check = new Image();
        check.src = candidateUrl;
        await check.decode();
        if (!overlay.isConnected) return;
        selectedImage = { blob: file, name: file.name };
        displayPreview(selectedImage);
      } catch {
        showError("This image could not be opened. Please choose another file.");
      } finally {
        URL.revokeObjectURL(candidateUrl);
        selectingImage = false;
        saveButton.disabled = false;
        uploadButton.disabled = false;
      }
    });

    saveButton.addEventListener("click", async () => {
      if (!ready || saving || selectingImage) return;
      const record = { key, image: selectedImage };
      for (const field of fields) {
        const input = $("#" + field.id, sheet);
        if (!input.reportValidity()) return;
        record[field.id] = field.type === "number" && input.value !== ""
          ? Number(input.value) : input.value;
      }
      saving = true;
      uploadButton.disabled = true;
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
      status.hidden = true;
      try {
        await savePosRecord(record);
        cachePosImage(key, selectedImage);
        showPosImage(rec);
        saving = false;
        closeEditor();
      } catch (error) {
        showError("Could not save your changes. Please try again. Your entries are still here.");
        console.warn("[POS editor] Save failed:", error);
      } finally {
        saving = false;
        uploadButton.disabled = false;
        saveButton.disabled = false;
        saveButton.textContent = "Save";
      }
    });

    overlay.addEventListener(
      "click",
      (event) => {
        if (
          event.target === overlay
        ) {
          closeEditor();
        }
      }
    );

    sheet.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
      }
    );

    fields.forEach((field) => {
      $("#" + field.id, sheet).disabled = true;
    });
    try {
      const saved = await loadPosRecord(key);
      if (!overlay.isConnected) return;
      selectedImage = saved?.image || null;
      displayPreview(selectedImage);
      fields.forEach((field) => {
        const input = $("#" + field.id, sheet);
        input.value = getPosFieldValue(rec, saved, field);
        input.disabled = false;
      });
      updateManufacturerBarcodes();
      ready = true;
      uploadButton.disabled = false;
      saveButton.disabled = false;
    } catch (error) {
      showError(key
        ? "Could not load saved values. Please allow browser storage and reopen Edit."
        : "This cigar has no record key, so changes cannot be saved.");
      console.warn("[POS editor] Load failed:", error);
    }

  }

  function render(records, rec) {
    const id = getCigarId(rec);
    const brand = getBrand(rec) || "—";
    const line = getLine(rec);
    const name = getName(rec);

    const displayName =
      [line, name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      name ||
      line ||
      "—";

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

    const cigarImgCandidates =
      buildCigarImageCandidates(rec);

    const brandImgCandidates =
      buildBrandIconCandidates(rec);

    const flag =
      flagForCountry(origin);

    const accolades =
      collectAccolades(
        records,
        rec
      );

    document.title =
      `${brand} ${displayName}`.trim();

    card.innerHTML = `
      <div class="cd-head">

        <div class="cd-head-copy">
          <div class="cd-brand">
            ${escapeHTML(brand)}
          </div>

          <div class="cd-name">
            ${escapeHTML(displayName)}
          </div>
        </div>

        ${
          brandImgCandidates.length
            ? `
              <img
                class="cd-badge"
                id="cdBrandBadge"
                src="${escapeAttr(brandImgCandidates[0])}"
                data-fallbacks='${escapeAttr(
                  JSON.stringify(
                    brandImgCandidates.slice(1)
                  )
                )}'
                alt="${escapeAttr(brand)}"
                loading="lazy"
                decoding="async"
              >
            `
            : `
              <div class="cd-badge-placeholder">
                Brand
              </div>
            `
        }

      </div>

      <div class="cd-grid">

        <div class="cd-left">

          ${
            cigarImgCandidates.length
              ? `
                <img
                  class="cd-stick"
                  id="cdStickImage"
                  src="${escapeAttr(cigarImgCandidates[0])}"
                  data-fallbacks='${escapeAttr(
                    JSON.stringify(
                      cigarImgCandidates.slice(1)
                    )
                  )}'
                  alt="${escapeAttr(displayName)}"
                  loading="lazy"
                  decoding="async"
                >
              `
              : `
                <div class="cd-stick-placeholder">
                  No image
                </div>
              `
          }

        </div>

        <div class="cd-right">

          <div class="cd-top-stats">

            <div class="cd-card cd-pair-card">

              <div class="cd-pair-grid">

                <div class="cd-pair-item">
                  <div class="cd-card-label">
                    Ring
                  </div>

                  <div class="cd-pair-value">
                    ${escapeHTML(ring)}
                  </div>
                </div>

                <div class="cd-pair-item">
                  <div class="cd-card-label">
                    Length
                  </div>

                  <div class="cd-pair-value">
                    ${escapeHTML(length)}
                  </div>
                </div>

              </div>

            </div>

            <div class="cd-card cd-mini cd-mini--single">

              <div class="cd-card-label">
                Vitola
              </div>

              <div class="cd-mini-value">
                ${escapeHTML(vitola)}
              </div>

            </div>

          </div>

          <div class="cd-card cd-shade-card">

            <div class="cd-card-label">
              Wrapper Shade
            </div>

            <div class="cd-shade-value">
              ${escapeHTML(shade)}
            </div>

          </div>

          <div class="cd-mini-grid">

            <div class="cd-card cd-mini">

              <div class="cd-card-label">
                Strength
              </div>

              <div class="cd-mini-value">
                ${escapeHTML(strength)}
              </div>

            </div>

            <div class="cd-card cd-mini">

              <div class="cd-card-label">
                Shape
              </div>

              <div class="cd-mini-value">
                ${escapeHTML(shape)}
              </div>

            </div>

          </div>

          <div class="cd-card cd-tobaccos">

            <div class="cd-tobacco-row">

              <div class="cd-card-label">
                Wrapper
              </div>

              <div class="cd-tobacco-value wrap-text">
                ${escapeHTML(wrapper)}
              </div>

            </div>

            <div class="cd-tobacco-row">

              <div class="cd-card-label">
                Binder
              </div>

              <div class="cd-tobacco-value wrap-text">
                ${escapeHTML(binder)}
              </div>

            </div>

            <div class="cd-tobacco-row">

              <div class="cd-card-label">
                Filler
              </div>

              <div class="cd-tobacco-value wrap-text">
                ${escapeHTML(filler)}
              </div>

            </div>

            <div class="cd-origin-inline">

              <span class="cd-origin-inline-text">
                Rolled in ${escapeHTML(origin)}
              </span>

              ${
                flag
                  ? `
                    <span
                      class="cd-flag"
                      aria-hidden="true"
                    >
                      ${flag}
                    </span>
                  `
                  : ``
              }

            </div>

          </div>

          ${
            accolades.length
              ? `
                <div class="cd-accolades-inline">
                  ${renderAccolades(accolades)}
                </div>
              `
              : ``
          }

          <div class="cd-actions">

            <button
              class="cd-action"
              type="button"
              id="cdCompare"
            >
              Compare
            </button>

            <button
              class="cd-action"
              type="button"
              id="cdFavorite"
            >
              Favorite
            </button>

            <button
              class="cd-action"
              type="button"
              id="cdWishlist"
            >
              Wishlist
            </button>

            <button
              class="cd-action cd-action--primary"
              type="button"
              id="cdEdit"
            >
              Edit
            </button>

          </div>

        </div>
      </div>
    `;

    const favoriteSet =
      readSet(FAVORITES_KEY);

    const compareSet =
      readSet(COMPARE_KEY);

    const favoriteBtn =
      $("#cdFavorite");

    const compareBtn =
      $("#cdCompare");

    const wishlistBtn =
      $("#cdWishlist");

    const editBtn =
      $("#cdEdit");

    const PROFILE_CIGAR_FAVORITES_KEY =
      "cigaros_user_favorite_cigars_v1";

    function readFavoriteCigars() {
      try {
        const raw =
          JSON.parse(
            localStorage.getItem(
              PROFILE_CIGAR_FAVORITES_KEY
            ) || "[]"
          );

        return Array.isArray(raw)
          ? raw
          : [];
      } catch {
        return [];
      }
    }

    function writeFavoriteCigars(items) {
      try {
        localStorage.setItem(
          PROFILE_CIGAR_FAVORITES_KEY,
          JSON.stringify(items)
        );
      } catch {}
    }

    function makeFavoritePayload() {
      return {
        key:
          id ||
          window.location.href,

        name:
          displayName,

        brand,

        vitola,

        img:
          cigarImgCandidates[0] ||
          "",

        href:
          window.location.pathname +
          window.location.search
      };
    }

    function cigarIsProfileFavorite() {
      const payload =
        makeFavoritePayload();

      return readFavoriteCigars()
        .some((item) => {
          return (
            item.href === payload.href ||
            item.key === payload.key
          );
        });
    }

    function addProfileFavorite() {
      const payload =
        makeFavoritePayload();

      const items =
        readFavoriteCigars();

      const exists =
        items.some((item) => {
          return (
            item.href === payload.href ||
            item.key === payload.key
          );
        });

      if (!exists) {
        items.unshift(payload);

        writeFavoriteCigars(
          items
        );
      }
    }

    function removeProfileFavorite() {
      const payload =
        makeFavoritePayload();

      const items =
        readFavoriteCigars()
          .filter((item) => {
            return (
              item.href !== payload.href &&
              item.key !== payload.key
            );
          });

      writeFavoriteCigars(
        items
      );
    }

    function syncUI() {
      const isFavorite =
        favoriteSet.has(id) ||
        cigarIsProfileFavorite();

      favoriteBtn?.classList.toggle(
        "is-on",
        isFavorite
      );

      compareBtn?.classList.toggle(
        "is-on",
        compareSet.has(id)
      );

      if (favoriteBtn) {
        favoriteBtn.textContent =
          isFavorite
            ? "Favorited"
            : "Favorite";
      }
    }

    favoriteBtn?.addEventListener(
      "click",
      () => {
        if (!id) {
          return;
        }

        const isFavorite =
          favoriteSet.has(id) ||
          cigarIsProfileFavorite();

        if (isFavorite) {
          favoriteSet.delete(id);
          removeProfileFavorite();
        } else {
          favoriteSet.add(id);
          addProfileFavorite();
        }

        writeSet(
          FAVORITES_KEY,
          favoriteSet
        );

        syncUI();
      }
    );

    compareBtn?.addEventListener(
      "click",
      () => {
        if (!id) {
          return;
        }

        if (compareSet.has(id)) {
          compareSet.delete(id);
        } else {
          compareSet.add(id);
        }

        const capped =
          Array.from(compareSet)
            .slice(0, 4);

        writeSet(
          COMPARE_KEY,
          new Set(capped)
        );

        syncUI();
      }
    );

    wishlistBtn?.addEventListener(
      "click",
      () => {
        const cartApi =
          window.cigarOSCart;

        if (
          !cartApi ||
          typeof cartApi.add !==
            "function"
        ) {
          return;
        }

        const cigarKey =
          id ||
          `${brand}|${name}|${vitola}`;

        cartApi.add({
          type: "cigar",
          key: cigarKey,
          id: cigarKey,
          brand,
          line,
          name,
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

          image:
            cigarImgCandidates[0] ||
            "",

          url:
            `/pos/cigars/cigar.html?key=` +
            encodeURIComponent(
              cigarKey
            )
        });
      }
    );

    /*
      EDIT BUTTON

      This is the new connection:
      tapping EDIT opens the POS editor
      created in Part 2.
    */
    editBtn?.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        openPosEditor(rec);
      }
    );

    syncUI();

    wireImageFallback(
      $("#cdBrandBadge"),
      "cd-badge-placeholder",
      "Brand"
    );

    wireImageFallback(
      $("#cdStickImage"),
      "cd-stick-placeholder",
      "No image"
    );

    wireBrandNavigation(
      brand
    );
  }

  async function load() {
    applyTheme(
      getSavedTheme()
    );

    themeToggle?.addEventListener(
      "click",
      () => {
        applyTheme(
          getSavedTheme() === "dark"
            ? "light"
            : "dark"
        );
      }
    );

    backBtn?.addEventListener(
      "click",
      () => {
        if (history.length > 1) {
          history.back();
        } else {
          window.location.href =
            "/pos/cigars/";
        }
      }
    );

    const idParam =
      getParam("id") ||
      getParam("key");

    const slugParam =
      getParam("slug");

    try {
      const res =
        await fetch(
          SHEET_CSV_URL,
          {
            cache: "no-store"
          }
        );

      if (!res.ok) {
        throw new Error(
          `CSV fetch failed: ${res.status}`
        );
      }

      const csvText =
        await res.text();

      const rows =
        parseCSV(csvText);

      const records =
        rowsToObjects(rows);

      let rec = null;

      if (idParam) {
        rec =
          findByPipeKey(
            records,
            idParam
          );
      }

      if (
        !rec &&
        idParam
      ) {
        rec =
          findById(
            records,
            idParam
          );
      }

      if (
        !rec &&
        idParam
      ) {
        rec =
          findBySlug(
            records,
            idParam
          );
      }

      if (
        !rec &&
        slugParam
      ) {
        rec =
          findBySlug(
            records,
            slugParam
          );
      }

      if (!rec) {
        card.innerHTML = `
          <div class="cd-loading">
            Cigar not found.
          </div>
        `;

        return;
      }

      try {
        const saved = await loadPosRecord(getCigarId(rec));
        cachePosImage(getCigarId(rec), saved?.image);
      } catch (error) {
        console.warn("[POS image] Local image could not be loaded:", error);
      }

      render(
        records,
        rec
      );
      showPosImage(rec);

    } catch (e) {
      card.innerHTML = `
        <div class="cd-loading">
          Error loading cigar data.
        </div>
      `;

      console.warn(
        "[cigar detail] load error:",
        e
      );

    } finally {
      if (loading) {
        loading.style.display =
          "none";
      }
    }
  }

  load();

})();
