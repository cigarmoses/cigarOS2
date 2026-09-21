(() => {
  "use strict";

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";
  const FAVORITES_KEY = "cigaros_favorite_keys";
  const WISHLIST_KEY = "cigaros_wishlist_keys";
  const COMPARE_KEY = "cigaros_compare_keys";

  const $ = (sel, root = document) => root.querySelector(sel);

  const shell = $("#cdCard");
  const topbarTitle = $("#cdTopbarTitle");
  const loading = $("#cdLoading");
  const backBtn = $("#cdBack");

  backBtn?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.location.href = "/pos/cigars/";
  });

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name) || "";
    } catch {
      return "";
    }
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
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && ch === ",") {
        row.push(field);
        field = "";
        continue;
      }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i += 1;

        row.push(field);

        if (row.some((cell) => String(cell || "").trim() !== "")) {
          rows.push(row);
        }

        row = [];
        field = "";
        continue;
      }

      field += ch;
    }

    if (field.length || row.length) {
      row.push(field);

      if (row.some((cell) => String(cell || "").trim() !== "")) {
        rows.push(row);
      }
    }

    return rows;
  }

  function normalizeHeader(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/ /g, "_");
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];

    const headers = rows[0].map((h) => String(h || "").trim());
    const normalized = headers.map(normalizeHeader);

    return rows.slice(1).map((r) => {
      const obj = {};

      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? "").trim();
        obj[normalized[i]] = (r[i] ?? "").trim();
      });

      return obj;
    });
  }

  function getField(rec, keys) {
    for (const key of keys) {
      if (
        rec &&
        rec[key] != null &&
        String(rec[key]).trim() !== ""
      ) {
        return String(rec[key]).trim();
      }
    }

    return "";
  }

  function normalizeBrand(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function slugify(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/["']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getKey(rec) {
    return getField(rec, [
      "Key",
      "key",
      "cigar_id",
      "id",
      "row_id",
      "slug"
    ]);
  }

  function getBrand(rec) {
    return getField(rec, [
      "Brand",
      "brand",
      "brand_aka",
      "Brand aka"
    ]);
  }

  function getLine(rec) {
    return getField(rec, ["Line", "line"]);
  }

  function getName(rec) {
    return getField(rec, [
      "Cigar",
      "cigar",
      "Name",
      "name",
      "Cigar Name",
      "cigar_name"
    ]);
  }

  function getVitola(rec) {
    return getField(rec, [
      "Vitola",
      "vitola",
      "Style",
      "style"
    ]);
  }

  function getShape(rec) {
    return getField(rec, ["Shape", "shape"]);
  }

  function getRing(rec) {
    return getField(rec, [
      "RG",
      "rg",
      "Ring",
      "ring"
    ]);
  }

  function getLength(rec) {
    return getField(rec, ["Length", "length"]);
  }

  function getStrength(rec) {
    return getField(rec, ["Strength", "strength"]);
  }

  function getWrapper(rec) {
    return getField(rec, [
      "Wrapper",
      "wrapper",
      "wrapper_type"
    ]);
  }

  function getBinder(rec) {
    return getField(rec, ["Binder", "binder"]);
  }

  function getFiller(rec) {
    return getField(rec, ["Filler", "filler"]);
  }

  function getOrigin(rec) {
    return getField(rec, [
      "Origin",
      "origin",
      "country",
      "country_of_origin"
    ]);
  }

  function getShade(rec) {
    return getField(rec, [
      "Wrapper Shade",
      "wrapper_shade",
      "shade"
    ]);
  }

  function getCigarImg(rec) {
    return getField(rec, [
      "Cigar IMG",
      "cigar_img",
      "image",
      "img",
      "photo",
      "cigar_image"
    ]);
  }

  function getBrandImg(rec) {
    const direct = getField(rec, [
      "Brand IMG",
      "brand_img",
      "brand_image"
    ]);

    if (direct) return direct;

    const brand = getBrand(rec);

    return brand
      ? `/img/icons/brands/${normalizeBrand(brand)}.svg`
      : "";
  }

  function displayBrand(rec) {
    return (
      getBrand(rec) ||
      getField(rec, ["Manufacturer", "manufacturer"]) ||
      "Cigar"
    );
  }

  function displayName(rec) {
    const line = getLine(rec);
    const cigar = getName(rec);

    const combined = [line, cigar]
      .filter(Boolean)
      .join(" ")
      .trim();

    return combined || cigar || line || "Cigar";
  }

  function displayVitola(rec) {
    return getVitola(rec) || getShape(rec) || "—";
  }

  function makeSlug(rec) {
    const parts = [
      displayBrand(rec),
      getLine(rec),
      getName(rec),
      getVitola(rec),
      getKey(rec)
    ].filter(Boolean);

    return slugify(parts.join(" "));
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
      localStorage.setItem(
        key,
        JSON.stringify(Array.from(set))
      );
    } catch {}
  }

  function flagForCountry(country) {
    const c = String(country || "")
      .trim()
      .toLowerCase();

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
    const key = getKey(rec);
    const brand = getBrand(rec);
    const cigar = getName(rec);
    const vitola = getVitola(rec);

    const matches = records.filter((row) => {
      if (key && getKey(row) === key) return true;

      return (
        getBrand(row) === brand &&
        getName(row) === cigar &&
        getVitola(row) === vitola
      );
    });

    const seen = new Set();
    const out = [];

    matches.forEach((row) => {
      const media = getField(row, ["Media", "media"]);
      const year = getField(row, ["Year", "year"]);
      const rank = getField(row, ["Rank", "rank"]);

      if (!media && !year && !rank) return;

      const sig = [media, year, rank].join("|");

      if (seen.has(sig)) return;

      seen.add(sig);
      out.push({ media, year, rank });
    });

    return out.slice(0, 6);
  }

  function renderAccolades(accolades) {
    if (!accolades.length) {
      return `<div class="cd-accolade-empty">No accolades listed.</div>`;
    }

    return accolades.map((item) => `
      <div class="cd-accolade-row">
        <div class="cd-accolade-media">${escapeHTML(item.media || "—")}</div>
        <div class="cd-accolade-year">${escapeHTML(item.year || "—")}</div>
        <div class="cd-accolade-rank">${escapeHTML(item.rank || "—")}</div>
      </div>
    `).join("");
  }

  function openPosEditor(rec) {
    const oldEditor = document.getElementById("cdPosEditor");

    if (oldEditor) {
      oldEditor.remove();
    }

    const brand = displayBrand(rec);
    const name = displayName(rec);

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
        id: "customBoxSKU",
        label: "Custom Box SKU",
        type: "text",
        inputmode: "text"
      },
      {
        id: "inventorySingles",
        label: "Inventory (Singles)",
        type: "number",
        inputmode: "numeric"
      },
      {
        id: "inventoryBoxes",
        label: "Inventory (Boxes)",
        type: "number",
        inputmode: "numeric"
      },
      {
        id: "unitsPerBox",
        label: "Units per Box",
        type: "number",
        inputmode: "numeric"
      },
      {
        id: "msrpSingle",
        label: "MSRP Single",
        type: "number",
        inputmode: "decimal",
        step: "0.01"
      },
      {
        id: "msrpBox",
        label: "MSRP Box",
        type: "number",
        inputmode: "decimal",
        step: "0.01"
      },
      {
        id: "costSingle",
        label: "Cost Single",
        type: "number",
        inputmode: "decimal",
        step: "0.01"
      },
      {
        id: "costBox",
        label: "Cost Box",
        type: "number",
        inputmode: "decimal",
        step: "0.01"
      }
    ];

    const overlay = document.createElement("div");

    overlay.id = "cdPosEditor";

    overlay.style.cssText = [
      "position:fixed",
      "top:0",
      "right:0",
      "bottom:0",
      "left:0",
      "z-index:2147483647",
      "background:rgba(5,15,35,.55)",
      "display:flex",
      "align-items:flex-end",
      "justify-content:center",
      "padding:0",
      "margin:0",
      "box-sizing:border-box"
    ].join(";");

    const sheet = document.createElement("div");

    sheet.style.cssText = [
      "position:relative",
      "width:100%",
      "max-width:430px",
      "max-height:90vh",
      "overflow-y:auto",
      "-webkit-overflow-scrolling:touch",
      "background:#f5f7fa",
      "border-radius:24px 24px 0 0",
      "padding:12px 18px calc(24px + env(safe-area-inset-bottom, 0px))",
      "box-sizing:border-box",
      "box-shadow:0 -12px 40px rgba(0,0,0,.22)",
      "font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif"
    ].join(";");

    sheet.innerHTML = `
      <div style="
        width:38px;
        height:5px;
        border-radius:999px;
        background:#c7cbd1;
        margin:0 auto 14px;
      "></div>

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:14px;
      ">
        <button
          type="button"
          id="cdEditCancel"
          style="
            border:0;
            background:transparent;
            color:#64748b;
            font:inherit;
            font-size:15px;
            padding:10px 0;
          "
        >
          Cancel
        </button>

        <div style="
          color:#16263d;
          font-size:17px;
          font-weight:700;
          text-align:center;
        ">
          Edit POS Entry
        </div>

        <button
          type="button"
          id="cdEditSave"
          style="
            border:0;
            background:transparent;
            color:#007aff;
            font:inherit;
            font-size:15px;
            font-weight:700;
            padding:10px 0;
          "
        >
          Save
        </button>
      </div>

      <div style="
        color:#64748b;
        font-size:13px;
        margin:0 0 16px;
      ">
        ${escapeHTML(brand)} · ${escapeHTML(name)}
      </div>

      <div id="cdEditFields"></div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    const fieldsContainer = $("#cdEditFields", sheet);

    fields.forEach((field) => {
      const label = document.createElement("label");

      label.style.cssText = `
        display:block;
        margin:0 0 12px;
      `;

      const stepAttr = field.step
        ? `step="${escapeAttr(field.step)}"`
        : "";

      label.innerHTML = `
        <div style="
          margin:0 0 6px 4px;
          color:#64748b;
          font-size:12px;
          font-weight:600;
        ">
          ${escapeHTML(field.label)}
        </div>

        <input
          id="${escapeAttr(field.id)}"
          type="${escapeAttr(field.type)}"
          inputmode="${escapeAttr(field.inputmode)}"
          ${stepAttr}
          autocomplete="off"
          style="
            display:block;
            width:100%;
            height:48px;
            box-sizing:border-box;
            border:1px solid rgba(22,38,61,.12);
            border-radius:14px;
            background:#ffffff;
            color:#16263d;
            padding:0 14px;
            font:inherit;
            font-size:16px;
            outline:none;
            -webkit-appearance:none;
            appearance:none;
          "
        >
      `;

      fieldsContainer.appendChild(label);
    });

    const closeEditor = () => {
      overlay.remove();
    };

    $("#cdEditCancel", sheet)?.addEventListener(
      "click",
      closeEditor
    );

    $("#cdEditSave", sheet)?.addEventListener(
      "click",
      () => {
        console.log("Save POS entry clicked");
      }
    );

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeEditor();
      }
    });

    sheet.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }
  function render(rec, accolades) {
    const key = getKey(rec);
    const brand = displayBrand(rec);
    const name = displayName(rec);
    const ring = getRing(rec) || "—";
    const length = getLength(rec) || "—";
    const strength = getStrength(rec) || "—";
    const vitola = displayVitola(rec);
    const wrapper = getWrapper(rec) || "—";
    const binder = getBinder(rec) || "—";
    const filler = getFiller(rec) || "—";
    const origin = getOrigin(rec) || "—";
    const shade = getShade(rec) || "—";
    const cigarImg = getCigarImg(rec);
    const brandImg = getBrandImg(rec);
    const flag = flagForCountry(origin);

    document.title = `${brand} ${name}`.trim();

    if (topbarTitle) {
      topbarTitle.textContent = brand;
    }

    shell.innerHTML = `
      <div class="cd-head">
        <div class="cd-head-copy">
          <div class="cd-brand">${escapeHTML(brand)}</div>
          <div class="cd-name">${escapeHTML(name)}</div>
        </div>

        ${
          brandImg
            ? `<img
                class="cd-badge"
                src="${escapeAttr(brandImg)}"
                alt="${escapeAttr(brand)}"
                loading="lazy"
                decoding="async"
              >`
            : ``
        }
      </div>

      <div class="cd-grid">
        <div class="cd-left">
          ${
            cigarImg
              ? `<img
                  class="cd-stick"
                  src="${escapeAttr(cigarImg)}"
                  alt="${escapeAttr(name)}"
                  loading="lazy"
                  decoding="async"
                >`
              : ``
          }
        </div>

        <div class="cd-right">

          <div class="cd-stat-grid">
            <div class="cd-card cd-stat">
              <div class="cd-card-label">Ring</div>
              <div class="cd-stat-value">
                ${escapeHTML(ring)}
              </div>
            </div>

            <div class="cd-card cd-stat">
              <div class="cd-card-label">Length</div>
              <div class="cd-stat-value">
                ${escapeHTML(length)}
              </div>
            </div>
          </div>

          <div class="cd-mini-grid">
            <div class="cd-card cd-mini">
              <div class="cd-card-label">Strength</div>
              <div class="cd-mini-value">
                ${escapeHTML(strength)}
              </div>
            </div>

            <div class="cd-card cd-mini">
              <div class="cd-card-label">Vitola</div>
              <div class="cd-mini-value">
                ${escapeHTML(vitola)}
              </div>
            </div>
          </div>

          <div class="cd-card cd-tobaccos">

            <div class="cd-tobacco-row">
              <div class="cd-card-label">Wrapper</div>
              <div class="cd-tobacco-value">
                ${escapeHTML(wrapper)}
              </div>
            </div>

            <div class="cd-tobacco-row">
              <div class="cd-card-label">Binder</div>
              <div class="cd-tobacco-value">
                ${escapeHTML(binder)}
              </div>
            </div>

            <div class="cd-tobacco-row">
              <div class="cd-card-label">Filler</div>
              <div class="cd-tobacco-value">
                ${escapeHTML(filler)}
              </div>
            </div>

          </div>

          <div class="cd-card cd-origin">
            <div class="cd-card-label">
              Origin
            </div>

            <div class="cd-origin-row">
              <div class="cd-origin-value">
                ${escapeHTML(origin)}
              </div>

              ${
                flag
                  ? `<div
                      class="cd-flag"
                      aria-hidden="true"
                    >${flag}</div>`
                  : ``
              }
            </div>
          </div>

          <div class="cd-card cd-shade">
            <div class="cd-card-label">
              Wrapper Shade
            </div>

            <div class="cd-shade-value">
              ${escapeHTML(shade)}
            </div>
          </div>

          <div class="cd-card cd-accolades">
            <div class="cd-card-label">
              Accolades
            </div>

            <div class="cd-accolade-list">
              ${renderAccolades(accolades)}
            </div>
          </div>

        </div>
      </div>

      <div class="cd-actions">

        <button
          class="cd-action"
          type="button"
          id="btnFavorite"
        >
          Favorite
        </button>

        <button
          class="cd-action"
          type="button"
          id="btnCompare"
        >
          Compare
        </button>

        <button
          class="cd-action"
          type="button"
          id="btnWishlist"
        >
          Wishlist
        </button>

        <button
          class="cd-action"
          type="button"
          id="btnEdit"
        >
          Edit
        </button>

      </div>
    `;

    const favoriteSet = readSet(FAVORITES_KEY);
    const wishlistSet = readSet(WISHLIST_KEY);
    const compareSet = readSet(COMPARE_KEY);

    const favoriteBtn = $("#btnFavorite", shell);
    const wishlistBtn = $("#btnWishlist", shell);
    const compareBtn = $("#btnCompare", shell);
    const editBtn = $("#btnEdit", shell);

    function syncButtonState() {
      favoriteBtn?.classList.toggle(
        "is-on",
        favoriteSet.has(key)
      );

      wishlistBtn?.classList.toggle(
        "is-on",
        wishlistSet.has(key)
      );

      compareBtn?.classList.toggle(
        "is-on",
        compareSet.has(key)
      );
    }

    favoriteBtn?.addEventListener("click", () => {
      if (!key) return;

      if (favoriteSet.has(key)) {
        favoriteSet.delete(key);
      } else {
        favoriteSet.add(key);
      }

      writeSet(
        FAVORITES_KEY,
        favoriteSet
      );

      syncButtonState();
    });

    wishlistBtn?.addEventListener("click", () => {
      if (!key) return;

      if (wishlistSet.has(key)) {
        wishlistSet.delete(key);
      } else {
        wishlistSet.add(key);
      }

      writeSet(
        WISHLIST_KEY,
        wishlistSet
      );

      syncButtonState();
    });

    compareBtn?.addEventListener("click", () => {
      if (!key) return;

      if (compareSet.has(key)) {
        compareSet.delete(key);
      } else {
        compareSet.add(key);
      }

      writeSet(
        COMPARE_KEY,
        compareSet
      );

      syncButtonState();
    });

    /*
      EDIT is intentionally simple here:
      the button calls the dedicated editor function
      created in Part 1.
    */
    editBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      openPosEditor(rec);
    });

    syncButtonState();
  }
    function showNotFound() {
    shell.innerHTML = `
      <div class="cd-loading">
        Cigar not found.
      </div>
    `;
  }

  async function boot() {
    const wantedKey = getParam("key") || getParam("id");
    const wantedSlug = getParam("slug");

    try {
      const res = await fetch(
        SHEET_CSV_URL,
        {
          cache: "no-store"
        }
      );

      if (!res.ok) {
        throw new Error(
          `Request failed: ${res.status}`
        );
      }

      const text = await res.text();

      const records = rowsToObjects(
        parseCSV(text)
      );

      let rec = null;

      if (wantedKey) {
        rec =
          records.find(
            (row) => getKey(row) === wantedKey
          ) || null;
      }

      if (!rec && wantedSlug) {
        rec =
          records.find(
            (row) => makeSlug(row) === wantedSlug
          ) || null;
      }

      if (!rec) {
        showNotFound();
      } else {
        render(
          rec,
          collectAccolades(records, rec)
        );
      }

    } catch (err) {
      console.warn(
        "[cigar detail]",
        err
      );

      shell.innerHTML = `
        <div class="cd-loading">
          Error loading cigar.
        </div>
      `;
    } finally {
      loading?.remove();
    }
  }

  boot();

})();
