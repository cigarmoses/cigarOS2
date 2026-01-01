/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   Updates:
   - Filters sheet is now centered popup (matches bands) via brand.html + brand.css
   - Bands popup: handled in CSS (center title/regular/scroll hint bar)
   - Maduro/Natural toggle now filters by CIGAR NAME ONLY (not wrapper shade)
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  // ---------- DOM (core) ----------
  const brandTitleEl = $("#brand-title");
  const brandIconWrap = $("#brand-icon");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");

  const backBtn = $("#brand-back");

  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");

  // wrapper toggle
  const wrapperSeg = $("#wrapper-seg");
  const btnMaduro = $("#seg-maduro");
  const btnNatural = $("#seg-natural");
  const segDot = $("#seg-switch");

  // Sheets
  const backdrop = $("#sheet-backdrop");

  const sheetFilters = $("#sheet-filters");
  const filtersOptions = $("#filters-options");
  const filtersConfirm = $("#filters-confirm");

  const sheetBands = $("#sheet-bands");
  const bandsOptions = $("#bands-options");
  const bandsConfirm = $("#bands-confirm");

  // ---------- State ----------
  let ALL = [];
  let VIEW = [];

  let pendingFilters = {};
  let activeFilters = {};

  let pendingBands = new Set();
  let activeBands = new Set();

  let wrapperState = "all"; // maduro | natural | all

  // ---------- helpers ----------
  const norm = (s) => (s || "").toString().trim().toLowerCase();
  const toNum = (v) => {
    const x = Number((v ?? "").toString().replace(/[^\d.]/g, ""));
    return Number.isFinite(x) ? x : 0;
  };
  const money = (n) =>
    window.CigarOSCart?.money ? window.CigarOSCart.money(n) : Number(n || 0).toFixed(2);

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
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
    return escapeHTML(s).replaceAll("`", "");
  }

  function normalizeIconPath(p) {
    let s = (p || "").toString().trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;

    if (s.startsWith("img/")) s = "/" + s;
    if (!s.startsWith("/")) s = "/" + s;

    s = s.replace(/^\/img\/icons\/brand\//i, "/img/icons/brands/");
    s = s.replace(/^\/img\/icons\/brands\/[a-z0-9]\/+/i, "/img/icons/brands/");
    s = s.replace(/\/{2,}/g, "/");
    return s;
  }

  function bestIconForRow(row) {
    const raw = row["Cigar IMG"] || row["Brand IMG"] || row["Manufacturer IMG"] || "";
    return normalizeIconPath(raw);
  }

  function bestBrandHeaderIcon(firstRow) {
    const raw = firstRow?.["Brand IMG"] || firstRow?.["Manufacturer IMG"] || "";
    const primary = normalizeIconPath(raw);
    if (primary) return primary;
    return bestIconForRow(firstRow || {});
  }

  function applyBrandHeader(brandName, firstRow) {
    if (brandTitleEl) brandTitleEl.textContent = brandName || "Brand";

    if (brandIconWrap) {
      const src = bestBrandHeaderIcon(firstRow);
      if (!src) {
        brandIconWrap.innerHTML = "";
        return;
      }
      brandIconWrap.innerHTML = `<img src="${escapeAttr(src)}" alt="" />`;
    }
  }

  // ---------- CSV parsing ----------
  function parseCSV(text) {
    const rows = [];
    let i = 0,
      field = "",
      row = [],
      inQuotes = false;

    while (i < text.length) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        if (c === '"') {
          inQuotes = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      } else {
        if (c === '"') {
          inQuotes = true;
          i++;
          continue;
        }
        if (c === ",") {
          row.push(field);
          field = "";
          i++;
          continue;
        }
        if (c === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          i++;
          continue;
        }
        if (c === "\r") {
          i++;
          continue;
        }
        field += c;
        i++;
      }
    }
    row.push(field);
    rows.push(row);

    while (rows.length && rows[rows.length - 1].every((x) => !x || !x.trim())) rows.pop();
    return rows;
  }

  function tableFromCSV(text) {
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const header = rows[0].map((h) => (h || "").trim());

    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const obj = {};
      for (let c = 0; c < header.length; c++) obj[header[c]] = (rows[r][c] ?? "").trim();
      out.push(obj);
    }
    return out;
  }

  // ---------- list render ----------
  function renderList(rows) {
    if (!listEl) return;

    if (!rows.length) {
      listEl.innerHTML = "";
      setStatus("No results.");
      return;
    }

    setStatus("");

    listEl.innerHTML = rows
      .map((row) => {
        const name = row.Cigar || "";
        const sub = row.Vitola || "";
        const price = money(toNum(row.MSRP));
        const icon = bestIconForRow(row);
        const id = row.key || `${row.Brand || ""}-${row.Cigar || ""}-${row.Vitola || ""}`;

        return `
          <div class="brand-row" data-id="${escapeAttr(id)}">
            <img class="row-ico" src="${escapeAttr(icon)}" alt=""
                 onerror="this.style.opacity='0';this.style.pointerEvents='none';" />
            <div class="row-main" data-open>
              <div class="row-title">${escapeHTML(name)}</div>
              <div class="row-sub">${escapeHTML(sub)}</div>
            </div>
            <div class="row-price">${price}</div>
            <button class="row-add" type="button" aria-label="Add" data-add>+</button>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const rowEl = e.currentTarget.closest(".brand-row");
        const id = rowEl?.getAttribute("data-id") || "";

        const row = rows.find((x) => {
          const rid = x.key || `${x.Brand || ""}-${x.Cigar || ""}-${x.Vitola || ""}`;
          return rid === id;
        });
        if (!row) return;

        window.CigarOSCart?.add({
          id: row.key || id,
          name: row.Cigar,
          brand: row.Brand,
          sub: row.Vitola ? `${row.Vitola} • ${row.Length} × ${row.RG}`.trim() : "",
          price: toNum(row.MSRP),
          img: bestIconForRow(row) || "",
        });
      });
    });
  }

  // ---------- filtering ----------
  function matchBandSource(row) {
    return `${row.Line || ""} ${row.Cigar || ""}`.toLowerCase();
  }

  // ✅ Maduro/Natural now based ONLY on cigar name
  function cigarNameHasMaduroOrNatural(cigarName, mode) {
    const n = norm(cigarName);
    const hasMaduro = n.includes("maduro");
    const hasNatural = n.includes("natural");

    if (mode === "maduro") return hasMaduro && !hasNatural;
    if (mode === "natural") return hasNatural && !hasMaduro;
    return true; // "all"
  }

  function applyAllFilters() {
    const q = norm(searchEl?.value || "");

    VIEW = ALL.filter((row) => {
      if (q) {
        const hay = norm(`${row.Cigar || ""} ${row.Vitola || ""} ${row.Line || ""}`);
        if (!hay.includes(q)) return false;
      }

      // ✅ wrapper toggle uses CIGAR NAME ONLY
      if (wrapperState !== "all") {
        const name = row.Cigar || "";
        if (!cigarNameHasMaduroOrNatural(name, wrapperState)) return false;
      }

      // field filters
      for (const [field, set] of Object.entries(activeFilters)) {
        if (!set || !set.size) continue;
        const v = norm(row[field] || "");
        if (!set.has(v)) return false;
      }

      // bands filter
      if (activeBands.size) {
        const src = matchBandSource(row);
        let ok = false;
        activeBands.forEach((token) => {
          if (src.includes(token)) ok = true;
        });
        if (!ok) return false;
      }

      return true;
    });

    renderList(VIEW);
  }

  // ---------- wrapper toggle ----------
  function setWrapperState(state) {
    wrapperState = state;
    if (wrapperSeg) wrapperSeg.dataset.state = state;

    btnMaduro?.setAttribute("aria-pressed", String(state === "maduro"));
    btnNatural?.setAttribute("aria-pressed", String(state === "natural"));

    applyAllFilters();
  }

  function initWrapperSeg() {
    if (!wrapperSeg) return;

    setWrapperState("all");

    btnMaduro?.addEventListener("click", () => setWrapperState("maduro"));
    btnNatural?.addEventListener("click", () => setWrapperState("natural"));

    segDot?.addEventListener("click", () => {
      if (wrapperState === "maduro") setWrapperState("all");
      else if (wrapperState === "all") setWrapperState("natural");
      else setWrapperState("maduro");
    });
  }

  // ---------- Sheets open/close ----------
  function openSheet(sheetEl) {
    if (!sheetEl) return;
    backdrop?.removeAttribute("hidden");
    sheetEl.removeAttribute("hidden");
    document.body.classList.add("pos-modal-open");
  }

  function closeSheet(sheetEl) {
    if (!sheetEl) return;
    sheetEl.setAttribute("hidden", "");

    const anyOpen =
      !($("#sheet-filters")?.hasAttribute("hidden")) ||
      !($("#sheet-bands")?.hasAttribute("hidden")) ||
      !($("#sheet-receipt")?.hasAttribute("hidden"));

    if (!anyOpen) backdrop?.setAttribute("hidden", "");
    document.body.classList.remove("pos-modal-open");
  }

  function closeAllSheets() {
    closeSheet(sheetFilters);
    closeSheet(sheetBands);
    const receipt = $("#sheet-receipt");
    if (receipt) closeSheet(receipt);
  }

  function initSheetCloseHandlers() {
    $$("[data-sheet-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sheet = btn.closest(".sheet");
        if (sheet) closeSheet(sheet);
      });
    });

    backdrop?.addEventListener("click", closeAllSheets);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllSheets();
    });
  }

  // ---------- Filters sheet ----------
  function cloneFilterSets(obj) {
    const out = {};
    for (const [k, set] of Object.entries(obj || {})) out[k] = new Set(set ? [...set] : []);
    return out;
  }

  function buildFilterOptions() {
    const FIELDS = [
      "Wrapper Shade",
      "Vitola",
      "RG",
      "Strength",
      "Length",
      "Shape",
      "Tubo",
      "Tin",
      "Pack",
      "Barber",
      "Box-Pressed",
      "Cuban",
      "Favorite",
    ];

    const options = {};
    FIELDS.forEach((f) => (options[f] = new Set()));
    ALL.forEach((row) => {
      FIELDS.forEach((f) => {
        const v = norm(row[f] || "");
        if (v) options[f].add(v);
      });
    });

    return { FIELDS, options };
  }

  // ✅ Render filter chips for a WHITE popup (no dark inline styles)
  function renderFiltersSheet() {
    if (!filtersOptions) return;

    const { FIELDS, options } = buildFilterOptions();
    pendingFilters = cloneFilterSets(activeFilters);

    filtersOptions.innerHTML = FIELDS.map((f) => {
      const vals = [...options[f]].sort();
      if (!vals.length) return "";
      return `
        <div class="filter-block" style="margin-bottom:14px;">
          <div class="filter-label" style="font-weight:800;opacity:.85;margin:6px 2px 8px;color:#0b1220;">
            ${escapeHTML(f)}
          </div>
          <div class="chip-wrap" style="display:flex;flex-wrap:wrap;gap:10px;">
            ${vals
              .map((v) => {
                const on = pendingFilters[f]?.has(v);
                return `<button type="button"
                  class="chip ${on ? "on" : ""}"
                  data-field="${escapeAttr(f)}"
                  data-val="${escapeAttr(v)}"
                  style="
                    padding:10px 12px;border-radius:999px;
                    border:1px solid rgba(15,23,42,.12);
                    background:${on ? "rgba(15,122,255,.12)" : "rgba(15,23,42,.06)"};
                    color:${on ? "rgba(15,122,255,.95)" : "rgba(15,23,42,.88)"};
                    font-weight:800;font-size:13px;
                  "
                >${escapeHTML(v)}</button>`;
              })
              .join("")}
          </div>
        </div>
      `;
    }).join("");

    filtersOptions.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const field = chip.getAttribute("data-field");
        const val = chip.getAttribute("data-val");
        if (!field || !val) return;

        pendingFilters[field] ||= new Set();
        if (pendingFilters[field].has(val)) {
          pendingFilters[field].delete(val);
          chip.classList.remove("on");
          chip.style.background = "rgba(15,23,42,.06)";
          chip.style.color = "rgba(15,23,42,.88)";
        } else {
          pendingFilters[field].add(val);
          chip.classList.add("on");
          chip.style.background = "rgba(15,122,255,.12)";
          chip.style.color = "rgba(15,122,255,.95)";
        }
      });
    });
  }

  function openFiltersSheet() {
    renderFiltersSheet();
    openSheet(sheetFilters);
  }

  // ---------- Bands sheet (Padron only) ----------
  function getBandLibraryForBrand(brandKey) {
    const LIB = {
      padron: [
        { token: "1926", label: "1926", src: "/img/icons/padron1926seriebank.svg" },
        { token: "1964", label: "1964", src: "/img/icons/padron1964anniversaryband.svg" },
        { token: "damaso", label: "Damaso", src: "/img/icons/padrondamasoband.svg" },
        { token: "black series", label: "Black Series", src: "/img/icons/padronblackseriesband.svg" },
        { token: "series", label: "Series", src: "/img/icons/padronseriesband.svg" },
        { token: "family reserve", label: "Family Reserve", src: "/img/icons/padronfamilyreserveband.svg" },
      ],
    };

    const list = LIB[brandKey] || [];
    return list.map((x) => ({
      ...x,
      src: (x.src || "").replace("seriebank", "serieband"),
    }));
  }

  function renderBandsSheet() {
    if (!bandsOptions) return;

    const brand = (qp("brand") || "").trim();
    const b = norm(brand);
    const bands = getBandLibraryForBrand(b);

    pendingBands = new Set(activeBands);

    if (!bands.length) {
      bandsOptions.innerHTML = `
        <div style="padding:10px 2px; font-size:16px; opacity:.75;">
          No bands configured for <b>${escapeHTML(brand || "this brand")}</b> yet.
        </div>
      `;
      return;
    }

    bandsOptions.innerHTML = bands
      .map((x) => {
        const checked = pendingBands.has(x.token);
        return `
          <label class="band-row">
            <div class="band-art">
              <img src="${escapeAttr(x.src)}" alt="${escapeAttr(x.label)}"
                   onerror="this.style.opacity='0.15';" />
            </div>
            <div class="band-meta">
              <span class="band-name">${escapeHTML(x.label)}</span>
              <input type="checkbox" class="band-check" data-token="${escapeAttr(x.token)}" ${
                checked ? "checked" : ""
              } />
            </div>
          </label>
        `;
      })
      .join("");

    bandsOptions.querySelectorAll(".band-check").forEach((cb) => {
      cb.addEventListener("change", () => {
        const token = cb.getAttribute("data-token");
        if (!token) return;
        if (cb.checked) pendingBands.add(token);
        else pendingBands.delete(token);
      });
    });
  }

  function openBandsSheet() {
    renderBandsSheet();
    openSheet(sheetBands);
  }

  // ---------- load ----------
  async function load() {
    const brand = (qp("brand") || "").trim();
    if (!brand) {
      setStatus("Missing brand.");
      return;
    }

    setStatus("Loading…");

    const url = `${CSV_URL}&_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const table = tableFromCSV(text);

    const brandNorm = norm(brand);
    ALL = table.filter((r) => norm(r.Brand) === brandNorm);
    if (!ALL.length) ALL = table.filter((r) => norm(r["Brand aka"]) === brandNorm);

    applyBrandHeader(brand, ALL[0]);
    applyAllFilters();
  }

  // ---------- init ----------
  function initBackButton() {
    if (!backBtn) return;
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.history.length > 1) return window.history.back();
      window.location.href = "/pos/cigars/";
    });
  }

  function initButtons() {
    btnFilters?.addEventListener("click", (e) => {
      e.preventDefault();
      openFiltersSheet();
    });

    btnBands?.addEventListener("click", (e) => {
      e.preventDefault();
      openBandsSheet();
    });

    filtersConfirm?.addEventListener("click", () => {
      activeFilters = cloneFilterSets(pendingFilters);
      closeSheet(sheetFilters);
      applyAllFilters();
    });

    bandsConfirm?.addEventListener("click", () => {
      activeBands = new Set(pendingBands);
      closeSheet(sheetBands);
      applyAllFilters();
    });
  }

  function init() {
    initBackButton();
    initButtons();
    initSheetCloseHandlers();
    initWrapperSeg();

    searchEl?.addEventListener("input", applyAllFilters);

    load().catch((err) => {
      console.error("brand.js load error:", err);
      setStatus("Failed to load cigars.");
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
