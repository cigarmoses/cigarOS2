/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   FIXES in this version:
   ✅ Removes injected Filters sheet CSS (was overriding brand.css and breaking iOS layout)
   ✅ Uses brand.css for sheet positioning (centered popup)
   ✅ Bulletproof modal/backdrop open/close (prevents "stuck" pos-modal-open)
   ✅ Adds receipt click fallback handler
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
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

  // applied filters row under controls (optional; kept)
  const brandAppliedWrap = $("#brand-applied");
  const brandAppliedRow = $("#brand-applied-row");

  // Backdrop + Sheets
  const backdrop = $("#sheet-backdrop");
  const sheetBands = $("#sheet-bands");
  const bandsOptions = $("#bands-options");
  const bandsConfirm = $("#bands-confirm");

  // Filters sheet
  const sheetFilters = $("#sheet-filters");

  // Receipt (fallback click binding)
  const receiptBtn = document.querySelector("#receipt-fab, .receipt-fab");

  // ---------- State ----------
  let ALL = [];
  let VIEW_BY_ID = Object.create(null);

  // Band filters
  let pendingBands = new Set();
  let activeBands = new Set();

  // Wrapper “maduro/natural/all”
  let wrapperState = "all"; // maduro | natural | all

  // Price range derived from data
  let PRICE_MIN = 0;
  let PRICE_MAX = 0;

  // Filters (ACTIVE = applied)
  const active = {
    priceMin: null,
    priceMax: null,
    fields: {
      Vitola: new Set(),
      RG: new Set(),
      Length: new Set(),
      "Wrapper Shade": new Set(),
      Strength: new Set(),
      Shape: new Set(),
    },
    onlyShow: "", // Barberpole, Box-Pressed, Flavored, Tins, Packs, Tubos
  };

  // Filters (PENDING = in open sheet)
  let pending = null;

  // Accordion open section key
  let openSection = "";

  // ---------- helpers ----------
  const norm = (s) => (s || "").toString().trim().toLowerCase();
  const normKeepCase = (s) => (s || "").toString().trim();

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

    // normalize to /img/icons/brands/
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

  // ---------- LIST render ----------
  function injectRowOpenHitStylesOnce() {
    const id = "brand-row-openhit-style";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .brand-row{ position: relative; }
      .brand-row .row-openhit{
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 132px;
        border: none;
        background: transparent;
        padding: 0;
        margin: 0;
        cursor: pointer;
        z-index: 2;
        border-radius: 18px;
      }
      .brand-row .row-price,
      .brand-row .row-add{
        position: relative;
        z-index: 3;
      }
    `;
    document.head.appendChild(style);
  }

  function renderList(rows) {
    if (!listEl) return;

    VIEW_BY_ID = Object.create(null);

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

        VIEW_BY_ID[id] = row;

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

            <button class="row-openhit" type="button" aria-label="Open details" data-open-detail></button>
          </div>
        `;
      })
      .join("");

    injectRowOpenHitStylesOnce();
  }

  function initListDelegation() {
    if (!listEl) return;

    listEl.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        const rowEl = addBtn.closest(".brand-row");
        const id = rowEl?.getAttribute("data-id") || "";
        const row = VIEW_BY_ID[id];
        if (!row) return;

        window.CigarOSCart?.add({
          id: row.key || id,
          name: row.Cigar,
          brand: row.Brand,
          sub: row.Vitola ? `${row.Vitola} • ${row.Length} × ${row.RG}`.trim() : "",
          price: toNum(row.MSRP),
          img: bestIconForRow(row) || "",
        });
        return;
      }
    });
  }

  // ---------- filtering helpers ----------
  function matchBandSource(row) {
    return `${row.Line || ""} ${row.Cigar || ""}`.toLowerCase();
  }

  function isTruthyCell(v) {
    const s = norm(v);
    if (!s) return false;
    if (s === "0" || s === "false" || s === "no" || s === "n") return false;
    return true;
  }

  function onlyShowPass(row) {
    const key = active.onlyShow;
    if (!key) return true;

    if (key === "Barberpole") return isTruthyCell(row.Barber);
    if (key === "Box-Pressed") return isTruthyCell(row["Box-Pressed"]);
    if (key === "Flavored") return isTruthyCell(row.Flavored);
    if (key === "Tins") return isTruthyCell(row.Tin);
    if (key === "Packs") return isTruthyCell(row.Pack);
    if (key === "Tubos") return isTruthyCell(row.Tubo);

    return true;
  }

  function applyAllFilters() {
    const q = norm(searchEl?.value || "");

    const out = ALL.filter((row) => {
      // search
      if (q) {
        const hay = norm(`${row.Cigar || ""} ${row.Vitola || ""} ${row.Line || ""}`);
        if (!hay.includes(q)) return false;
      }

      // wrapper toggle (by cigar name only)
      const cigarName = norm(row.Cigar || "");
      if (wrapperState === "maduro") {
        if (!cigarName.includes("maduro")) return false;
      } else if (wrapperState === "natural") {
        if (!cigarName.includes("natural")) return false;
      }

      // price range
      const msrp = toNum(row.MSRP);
      if (active.priceMin != null && msrp < active.priceMin) return false;
      if (active.priceMax != null && msrp > active.priceMax) return false;

      // multi-select fields
      for (const [field, set] of Object.entries(active.fields)) {
        if (!set || !set.size) continue;
        const cell = row[field] ?? "";
        const k = norm(cell);
        if (!set.has(k)) return false;
      }

      // only show radio
      if (!onlyShowPass(row)) return false;

      // bands
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

    renderList(out);
    renderMainAppliedChips();
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

  // ---------- backdrop + sheet open/close (bulletproof) ----------
  function openBackdrop() {
    if (backdrop) backdrop.removeAttribute("hidden");
    document.body.classList.add("pos-modal-open");
  }

  function anySheetOpen() {
    const filtersOpen = sheetFilters && !sheetFilters.hasAttribute("hidden");
    const bandsOpen = sheetBands && !sheetBands.hasAttribute("hidden");
    return Boolean(filtersOpen || bandsOpen);
  }

  function closeBackdropIfNoSheets() {
    if (!anySheetOpen()) {
      backdrop?.setAttribute("hidden", "");
      document.body.classList.remove("pos-modal-open");
    }
  }

  // ---------- Filters value ordering ----------
  const ORDER_VITOLA = [
    "Robusto",
    "Toro",
    "Gordo",
    "Churchill",
    "Corona",
    "Corona Extra",
    "Corona Gorda",
    "Lancero",
    "Pyramid",
    "Belicoso",
    "Gigante",
  ];

  const ORDER_SHADE = [
    "Natural",
    "Connecticut",
    "Colorado",
    "Colorado Maduro",
    "Maduro",
    "Oscuro",
    "Candela",
    "EMS",
  ];

  const ORDER_STRENGTH = ["Mellow", "Mild", "Medium", "Medium-Full", "Full"];

  const ORDER_SHAPE = ["Parejo", "Perfecto", "Pyramid", "Torpedo", "Figurado", "Belicoso"];

  function uniqSorted(list) {
    const seen = new Map(); // norm -> display
    list.forEach((v) => {
      const d = normKeepCase(v);
      if (!d) return;
      const k = norm(d);
      if (!seen.has(k)) seen.set(k, d);
    });
    return Array.from(seen.entries()).map(([k, d]) => ({ k, d }));
  }

  function orderedWithAppend(values, preferredOrder) {
    const map = new Map(values.map((x) => [x.k, x.d]));

    const out = [];
    const used = new Set();

    preferredOrder.forEach((label) => {
      const k = norm(label);
      if (map.has(k)) {
        out.push({ k, d: map.get(k) });
        used.add(k);
      }
    });

    const extras = values
      .filter((x) => !used.has(x.k))
      .sort((a, b) => a.d.localeCompare(b.d));
    out.push(...extras);

    return out;
  }

  function getFieldValues(field) {
    const vals = [];
    ALL.forEach((r) => {
      const v = r[field];
      if (v != null && `${v}`.trim() !== "") vals.push(v);
    });

    let base = uniqSorted(vals);

    if (field === "Vitola") return orderedWithAppend(base, ORDER_VITOLA);
    if (field === "Wrapper Shade") return orderedWithAppend(base, ORDER_SHADE);
    if (field === "Strength") return orderedWithAppend(base, ORDER_STRENGTH);
    if (field === "Shape") return orderedWithAppend(base, ORDER_SHAPE);

    if (field === "Length") return base.sort((a, b) => (Number(b.d) || 0) - (Number(a.d) || 0));
    if (field === "RG") return base.sort((a, b) => (Number(a.d) || 0) - (Number(b.d) || 0));

    return base.sort((a, b) => a.d.localeCompare(b.d));
  }

  // ---------- Filters sheet (NO injected CSS anymore) ----------
  function cloneActiveToPending() {
    const p = {
      priceMin: active.priceMin,
      priceMax: active.priceMax,
      fields: {},
      onlyShow: active.onlyShow,
    };
    for (const [k, set] of Object.entries(active.fields)) {
      p.fields[k] = new Set(set ? [...set] : []);
    }
    return p;
  }

  function pendingIsSameAsActive() {
    if (!pending) return true;

    const aMin = active.priceMin ?? null;
    const aMax = active.priceMax ?? null;
    const pMin = pending.priceMin ?? null;
    const pMax = pending.priceMax ?? null;

    if (aMin !== pMin) return false;
    if (aMax !== pMax) return false;
    if ((active.onlyShow || "") !== (pending.onlyShow || "")) return false;

    for (const key of Object.keys(active.fields)) {
      const aSet = active.fields[key] || new Set();
      const pSet = pending.fields[key] || new Set();
      if (aSet.size !== pSet.size) return false;
      for (const v of aSet) if (!pSet.has(v)) return false;
    }
    return true;
  }

  function pendingHasAnySelection() {
    if (!pending) return false;

    // price differs from full range
    const pMin = pending.priceMin ?? PRICE_MIN;
    const pMax = pending.priceMax ?? PRICE_MAX;
    if (pMin !== PRICE_MIN || pMax !== PRICE_MAX) return true;

    if (pending.onlyShow) return true;

    for (const set of Object.values(pending.fields)) {
      if (set && set.size) return true;
    }
    return false;
  }

  function setFiltersSheetOpen(open) {
    if (!sheetFilters) return;
    if (open) {
      sheetFilters.removeAttribute("hidden");
      openBackdrop();
    } else {
      sheetFilters.setAttribute("hidden", "");
      closeBackdropIfNoSheets();
    }
  }

  // ✅ Remove "Any" text entirely
  function buildSectionMeta(fieldKey) {
    const set = pending?.fields?.[fieldKey];
    if (!set || !set.size) return "";
    return `${set.size} selected`;
  }

  function clampPrice(minV, maxV) {
    let a = Number(minV);
    let b = Number(maxV);

    if (!Number.isFinite(a)) a = PRICE_MIN;
    if (!Number.isFinite(b)) b = PRICE_MAX;

    a = Math.max(PRICE_MIN, Math.min(PRICE_MAX, a));
    b = Math.max(PRICE_MIN, Math.min(PRICE_MAX, b));

    if (a > b) {
      const t = a;
      a = b;
      b = t;
    }

    const snap = (x) => Math.round(x * 4) / 4;
    return [snap(a), snap(b)];
  }

  function renderFiltersSheet() {
    if (!sheetFilters) return;

    if (!pending) pending = cloneActiveToPending();
    if (!openSection) openSection = "";

    const [pMin, pMax] = clampPrice(
      pending.priceMin ?? PRICE_MIN,
      pending.priceMax ?? PRICE_MAX
    );
    pending.priceMin = pMin;
    pending.priceMax = pMax;

    const applyEnabled = pendingHasAnySelection() || !pendingIsSameAsActive();
    const applyClass = applyEnabled ? "is-on" : "is-off";

    const minPct =
      PRICE_MAX === PRICE_MIN ? 0 : ((pMin - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
    const maxPct =
      PRICE_MAX === PRICE_MIN ? 100 : ((pMax - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;

    sheetFilters.innerHTML = `
      <div class="fsh-head">
        <div class="fsh-grab" aria-hidden="true"></div>
        <div class="fsh-titleRow">
          <div class="fsh-title">Filters</div>
          <button class="fsh-x" type="button" aria-label="Close" data-fsh-close>×</button>
        </div>

        <div class="priceBox">
          <div class="priceTop">
            <div class="priceLbl">Price Range</div>
            <div class="priceInputs">
              <input class="numInp" type="number" inputmode="decimal" step="0.25"
                     min="${PRICE_MIN}" max="${PRICE_MAX}" value="${pMin}"
                     data-price-min-input />
              <span class="dash">–</span>
              <input class="numInp" type="number" inputmode="decimal" step="0.25"
                     min="${PRICE_MIN}" max="${PRICE_MAX}" value="${pMax}"
                     data-price-max-input />
            </div>
          </div>

          <div class="dualWrap" aria-label="Price slider">
            <div class="dualTrack">
              <div class="dualFill" style="left:${minPct}%; width:${Math.max(0, maxPct - minPct)}%;"></div>
            </div>

            <div class="dualRange">
              <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="0.25"
                     value="${pMin}" data-price-min-range />
              <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="0.25"
                     value="${pMax}" data-price-max-range />
            </div>
          </div>
        </div>
      </div>

      <div class="fsh-body">
        <div class="accList" role="list">
          ${renderAccRow("Vitola", "Vitola")}
          ${renderAccRow("Ring", "RG")}
          ${renderAccRow("Length", "Length")}
          ${renderAccRow("Wrapper Shade", "Wrapper Shade")}
          ${renderAccRow("Strength", "Strength")}
          ${renderAccRow("Shape", "Shape")}
        </div>

        <div class="radioGrid">
          <div class="radioTitle">Only Show</div>
          <div class="radioRows">
            ${renderRadioOpt("Barberpole")}
            ${renderRadioOpt("Box-Pressed")}
            ${renderRadioOpt("Flavored")}
            ${renderRadioOpt("Tins")}
            ${renderRadioOpt("Packs")}
            ${renderRadioOpt("Tubos")}
          </div>
        </div>
      </div>

      <div class="fsh-foot">
        <button type="button" class="applyBtn ${applyClass}" data-apply-filters>
          Apply Filters
        </button>
      </div>
    `;

    // close
    sheetFilters.querySelector("[data-fsh-close]")?.addEventListener("click", () => {
      pending = null;
      openSection = "";
      setFiltersSheetOpen(false);
    });

    // price controls
    const minInp = sheetFilters.querySelector("[data-price-min-input]");
    const maxInp = sheetFilters.querySelector("[data-price-max-input]");
    const minRng = sheetFilters.querySelector("[data-price-min-range]");
    const maxRng = sheetFilters.querySelector("[data-price-max-range]");

    const syncFrom = (minVal, maxVal) => {
      const [a, b] = clampPrice(minVal, maxVal);
      pending.priceMin = a;
      pending.priceMax = b;
      renderFiltersSheet();
    };

    minInp?.addEventListener("change", () => syncFrom(minInp.value, maxInp?.value));
    maxInp?.addEventListener("change", () => syncFrom(minInp?.value, maxInp.value));
    minRng?.addEventListener("input", () => syncFrom(minRng.value, maxRng?.value));
    maxRng?.addEventListener("input", () => syncFrom(minRng?.value, maxRng.value));

    // accordion
    sheetFilters.querySelectorAll("[data-acc]").forEach((row) => {
      row.addEventListener("click", () => {
        const key = row.getAttribute("data-acc") || "";
        openSection = openSection === key ? "" : key;
        renderFiltersSheet();
      });
    });

    // pills
    sheetFilters.querySelectorAll("[data-pill-field]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const field = btn.getAttribute("data-pill-field");
        const val = btn.getAttribute("data-pill-val");
        if (!field || !val) return;

        pending.fields[field] ||= new Set();
        if (pending.fields[field].has(val)) pending.fields[field].delete(val);
        else pending.fields[field].add(val);

        renderFiltersSheet();
      });
    });

    // Only Show radios
    sheetFilters.querySelectorAll("[data-onlyshow]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-onlyshow") || "";
        pending.onlyShow = pending.onlyShow === k ? "" : k;
        renderFiltersSheet();
      });
    });

    // Apply
    sheetFilters.querySelector("[data-apply-filters]")?.addEventListener("click", () => {
      if (!pending) return;

      active.priceMin = pending.priceMin;
      active.priceMax = pending.priceMax;
      active.onlyShow = pending.onlyShow;

      for (const key of Object.keys(active.fields)) {
        active.fields[key] = new Set(pending.fields[key] ? [...pending.fields[key]] : []);
      }

      pending = null;
      openSection = "";
      setFiltersSheetOpen(false);
      applyAllFilters();
    });
  }

  function renderAccRow(label, fieldKey) {
    const isOpen = openSection === fieldKey;
    const plus = isOpen ? "−" : "+";
    const meta = buildSectionMeta(fieldKey);
    const panel = isOpen ? renderPillsPanel(fieldKey) : "";

    return `
      <div class="accRow" data-acc="${escapeAttr(fieldKey)}" role="listitem">
        <div class="accLeft">
          <div class="accPlus">${plus}</div>
          <div class="accLabel">${escapeHTML(label)}</div>
        </div>
        <div class="accMeta">${escapeHTML(meta)}</div>
      </div>
      <div class="accPanel ${isOpen ? "is-open" : ""}">
        ${panel}
      </div>
    `;
  }

  function renderPillsPanel(fieldKey) {
    const values = getFieldValues(fieldKey);
    const set = pending?.fields?.[fieldKey] || new Set();

    return `
      <div class="pillGrid">
        ${values
          .map(({ k, d }) => {
            const on = set.has(k);
            return `
              <button type="button"
                class="optPill ${on ? "is-on" : ""}"
                data-pill-field="${escapeAttr(fieldKey)}"
                data-pill-val="${escapeAttr(k)}">
                ${escapeHTML(d)}
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderRadioOpt(label) {
    const on = (pending?.onlyShow || "") === label;
    return `
      <div class="radioOpt ${on ? "is-on" : ""}" data-onlyshow="${escapeAttr(label)}">
        <div class="radioDot" aria-hidden="true"></div>
        <div class="radioTxt">${escapeHTML(label)}</div>
      </div>
    `;
  }

  // ---------- applied chips under controls ----------
  function renderMainAppliedChips() {
    if (!brandAppliedWrap || !brandAppliedRow) return;

    const chips = [];

    const min = active.priceMin ?? PRICE_MIN;
    const max = active.priceMax ?? PRICE_MAX;
    if (min !== PRICE_MIN || max !== PRICE_MAX) {
      chips.push({ type: "price", label: `Price: $${money(min)}–$${money(max)}` });
    }

    for (const [field, set] of Object.entries(active.fields)) {
      if (!set || !set.size) continue;
      set.forEach((k) => chips.push({ type: "field", field, k, label: `${field}: ${k}` }));
    }

    if (active.onlyShow) chips.push({ type: "only", label: `Only: ${active.onlyShow}` });

    if (!chips.length) {
      brandAppliedWrap.setAttribute("hidden", "");
      brandAppliedRow.innerHTML = "";
      return;
    }

    brandAppliedWrap.removeAttribute("hidden");
    brandAppliedRow.innerHTML = chips
      .map(
        (c, idx) => `
        <button type="button" class="applied-chip" data-chip="${idx}">
          <span class="t">${escapeHTML(c.label)}</span>
          <span class="x" aria-hidden="true">×</span>
        </button>
      `
      )
      .join("");

    brandAppliedRow.querySelectorAll(".applied-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-chip"));
        const c = chips[idx];
        if (!c) return;

        if (c.type === "price") {
          active.priceMin = PRICE_MIN;
          active.priceMax = PRICE_MAX;
        } else if (c.type === "only") {
          active.onlyShow = "";
        } else if (c.type === "field") {
          active.fields[c.field]?.delete(c.k);
        }

        applyAllFilters();
      });
    });
  }

  // ---------- Bands sheet ----------
  function getBandLibraryForBrand(brandKey) {
    const LIB = {
      padron: [
        { token: "1926", label: "1926", src: "/img/icons/padron1926serieband.svg" },
        { token: "1964", label: "1964", src: "/img/icons/padron1964anniversaryband.svg" },
        { token: "damaso", label: "Damaso", src: "/img/icons/padrondamasoband.svg" },
      ],
    };
    return LIB[brandKey] || [];
  }

  function updateBandsConfirmState() {
    if (!bandsConfirm) return;
    bandsConfirm.disabled = pendingBands.size === 0;
  }

  function renderBandsSheet() {
    if (!bandsOptions) return;

    const brand = (qp("brand") || "").trim();
    const b = norm(brand);
    const bands = getBandLibraryForBrand(b);

    pendingBands = new Set(activeBands);
    updateBandsConfirmState();

    if (!bands.length) {
      bandsOptions.innerHTML = `
        <div style="padding:10px 2px; font-size:16px; opacity:.75;">
          No bands configured for <b>${escapeHTML(brand || "this brand")}</b> yet.
        </div>
      `;
      updateBandsConfirmState();
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
              <input type="checkbox" class="band-check" data-token="${escapeAttr(x.token)}"
                     ${checked ? "checked" : ""} />
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
        updateBandsConfirmState();
      });
    });

    updateBandsConfirmState();
  }

  function openBandsSheet() {
    renderBandsSheet();
    sheetBands?.removeAttribute("hidden");
    openBackdrop();
  }

  function closeBandsSheet() {
    sheetBands?.setAttribute("hidden", "");
    closeBackdropIfNoSheets();
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

  function initBackdropHandlers() {
    backdrop?.addEventListener("click", () => {
      // close filters
      if (sheetFilters && !sheetFilters.hasAttribute("hidden")) {
        pending = null;
        openSection = "";
        setFiltersSheetOpen(false);
      }
      // close bands
      if (sheetBands && !sheetBands.hasAttribute("hidden")) {
        closeBandsSheet();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      if (sheetFilters && !sheetFilters.hasAttribute("hidden")) {
        pending = null;
        openSection = "";
        setFiltersSheetOpen(false);
      }
      if (sheetBands && !sheetBands.hasAttribute("hidden")) {
        closeBandsSheet();
      }
    });
  }

  function initButtons() {
    btnFilters?.addEventListener("click", (e) => {
      e.preventDefault();
      pending = cloneActiveToPending();
      openSection = "";
      renderFiltersSheet();
      setFiltersSheetOpen(true);
    });

    btnBands?.addEventListener("click", (e) => {
      e.preventDefault();
      openBandsSheet();
    });

    bandsConfirm?.addEventListener("click", () => {
      if (bandsConfirm.disabled) return;
      activeBands = new Set(pendingBands);
      closeBandsSheet();
      applyAllFilters();
    });
  }

  function initReceiptFallback() {
    if (!receiptBtn) return;

    receiptBtn.addEventListener("click", () => {
      // If cart.js already handles this, no harm.
      // If it doesn't, try common APIs:
      const c = window.CigarOSCart;
      if (!c) return;

      if (typeof c.toggleReceipt === "function") return c.toggleReceipt();
      if (typeof c.openReceipt === "function") return c.openReceipt();
      if (typeof c.open === "function") return c.open("receipt");

      // last resort: emit event (if your cart listens to it)
      window.dispatchEvent(new CustomEvent("cigaros:receipt:toggle"));
    });
  }

  function computePriceRangeFromAll() {
    if (!ALL.length) {
      PRICE_MIN = 0;
      PRICE_MAX = 0;
      return;
    }
    let min = Infinity;
    let max = -Infinity;
    ALL.forEach((r) => {
      const n = toNum(r.MSRP);
      if (!Number.isFinite(n)) return;
      if (n < min) min = n;
      if (n > max) max = n;
    });
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;

    const roundDown = (x) => Math.floor(x * 4) / 4;
    const roundUp = (x) => Math.ceil(x * 4) / 4;

    PRICE_MIN = roundDown(min);
    PRICE_MAX = roundUp(max);

    // Default: full range
    active.priceMin = PRICE_MIN;
    active.priceMax = PRICE_MAX;
  }

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
    computePriceRangeFromAll();

    setStatus("");
    applyAllFilters();
  }

  function init() {
    initBackButton();
    initBackdropHandlers();
    initButtons();
    initWrapperSeg();
    initListDelegation();
    initReceiptFallback();

    searchEl?.addEventListener("input", applyAllFilters);

    load().catch((err) => {
      console.error("brand.js load error:", err);
      setStatus("Failed to load cigars.");
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
