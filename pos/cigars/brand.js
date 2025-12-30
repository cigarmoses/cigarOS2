/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)
   - Loads canonical CSV
   - Renders rows
   - Filters + Bands modals
   - Uses shared /pos/cart.js for receipt + badge + persistence
*/

(() => {
  // Canonical data source
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  // --- DOM helpers ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // --- page elements (must exist in brand.html) ---
  const brandTitleEl = $("#brand-title");
  const brandIconEl = $("#brand-icon-img");
  const listEl = $("#brand-list");

  // modal elements (bands)
  const bandsBtn = $("#btn-bands");
  const bandsModal = $("#bands-modal");
  const bandsCloseBtn = $("#bands-close");
  const bandsClearBtn = $("#bands-clear");
  const bandsConfirmBtn = $("#bands-confirm");
  const bandsListEl = $("#bands-list");

  // --- state ---
  const urlBrand = new URLSearchParams(window.location.search).get("brand") || "";
  const BRAND = decodeURIComponent(urlBrand).trim();
  const state = {
    allRows: [],
    filteredRows: [],
    // selected band keys (lowercase)
    selectedBands: new Set(),
  };

  // --- Padron Bands (additions included) ---
  // NOTE: band keys are what we store in state.selectedBands
  // display text can be whatever you want users to see
  const PADRON_BANDS = [
    {
      key: "1926",
      label: "1926",
      img: "/img/icons/padron1926band.svg",
    },
    {
      key: "1964",
      label: "1964",
      img: "/img/icons/padron1964band.svg",
    },
    {
      key: "damaso",
      label: "Damaso",
      img: "/img/icons/padrondamasoband.svg",
    },

    // ✅ NEW (your 3 requested)
    {
      key: "black series",
      label: "Black Series",
      img: "/img/icons/padronblackseriesband.svg",
    },
    {
      key: "series",
      label: "Series",
      img: "/img/icons/padronseriesband.svg",
    },
    {
      key: "family reserve",
      label: "Family Reserve",
      img: "/img/icons/padronfamilyreserveband.svg",
    },
  ];

  // If you ever want brand-specific band sets:
  function getBandOptionsForBrand(brandName) {
    if (!brandName) return [];
    const b = brandName.toLowerCase();
    if (b === "padron" || b === "padrón") return PADRON_BANDS;
    return [];
  }

  // --- CSV parsing ---
  function parseCSV(text) {
    // minimal CSV parser (handles quoted commas)
    const rows = [];
    let i = 0;
    let field = "";
    let row = [];
    let inQuotes = false;

    while (i < text.length) {
      const c = text[i];

      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
        i += 1;
        continue;
      }

      if (!inQuotes && (c === "," || c === "\n" || c === "\r")) {
        row.push(field);
        field = "";

        if (c === ",") {
          i += 1;
          continue;
        }

        // newline (\r\n or \n)
        // finalize row if it has any data
        if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
        row = [];

        // skip \r\n pair
        if (c === "\r" && text[i + 1] === "\n") i += 2;
        else i += 1;

        continue;
      }

      field += c;
      i += 1;
    }

    // last field
    if (field.length || row.length) {
      row.push(field);
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
    }

    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((h) => (h || "").trim());
    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
      return obj;
    });
  }

  // --- brand icon ---
  function setBrandHeader(brandName) {
    if (brandTitleEl) brandTitleEl.textContent = brandName || "Brand";

    // you said icons live in /img/icons/brands (plural) in repo
    // but your cigar rows use img/icons/brand/{...}.svg in older code sometimes.
    // For the header, try the plural path first, then fallback to legacy.
    const safe = (brandName || "").toLowerCase().replace(/\s+/g, "");
    const plural = `/img/icons/brands/${safe}.svg`;
    const legacy = `/img/icons/brand/${safe}.svg`;

    if (brandIconEl) {
      brandIconEl.onerror = () => {
        brandIconEl.onerror = null;
        brandIconEl.src = legacy;
      };
      brandIconEl.src = plural;
      brandIconEl.alt = brandName;
    }
  }

  // --- filtering ---
  function normalize(s) {
    return (s || "").toString().trim().toLowerCase();
  }

  function applyFilters() {
    let rows = state.allRows.slice();

    // Filter to this brand page
    if (BRAND) {
      rows = rows.filter((r) => normalize(r.Brand) === normalize(BRAND));
    }

    // Bands filter (only if selections exist)
    if (state.selectedBands.size) {
      rows = rows.filter((r) => {
        // We try to match against:
        // - Line
        // - Cigar name
        // - any "Band" column if you add one later
        const line = normalize(r.Line);
        const cigar = normalize(r.Cigar);
        const bandCol = normalize(r.Band);

        for (const sel of state.selectedBands) {
          const k = normalize(sel);
          if (line.includes(k) || cigar.includes(k) || (bandCol && bandCol.includes(k))) {
            return true;
          }
        }
        return false;
      });
    }

    state.filteredRows = rows;
    renderList();
  }

  // --- list render (minimal, keep your existing HTML expectations) ---
  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = "";

    const rows = state.filteredRows;
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "brand-empty";
      empty.textContent = "No cigars match your filters.";
      listEl.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    rows.forEach((r) => {
      const item = document.createElement("div");
      item.className = "brand-row";

      // expected columns (based on your sheet structure)
      const cigarName = r.Cigar || "";
      const brandName = r.Brand || "";
      const vitola = r.Vitola || "";
      const msrp = r.MSRP || "";

      // image (if you have Cigar IMG column)
      const img = r["Cigar IMG"] || r.CigarIMG || "";

      item.innerHTML = `
        <div class="brand-row-left">
          <div class="brand-row-img">
            ${
              img
                ? `<img src="${img}" alt="${cigarName}" loading="lazy" />`
                : `<div class="brand-row-img-fallback"></div>`
            }
          </div>
          <div class="brand-row-text">
            <div class="brand-row-title">${escapeHtml(cigarName)}</div>
            <div class="brand-row-sub">${escapeHtml(brandName)}</div>
          </div>
        </div>

        <div class="brand-row-mid">
          <div class="brand-row-vitola">${escapeHtml(vitola)}</div>
          <div class="brand-row-msrp">${escapeHtml(msrp)}</div>
        </div>

        <div class="brand-row-right">
          <button class="brand-add-btn" type="button" aria-label="Add to receipt">+</button>
        </div>
      `;

      // Add-to-cart hookup (shared cart.js)
      const addBtn = item.querySelector(".brand-add-btn");
      if (addBtn && window.POS_CART && typeof window.POS_CART.addItem === "function") {
        addBtn.addEventListener("click", () => {
          window.POS_CART.addItem({
            name: cigarName,
            brand: brandName,
            price: parseMoney(msrp),
            meta: {
              vitola,
              rg: r.RG || "",
              length: r.Length || "",
              origin: r.Origin || "",
            },
          });
        });
      }

      frag.appendChild(item);
    });

    listEl.appendChild(frag);
  }

  function parseMoney(v) {
    const s = (v || "").toString().replace(/[^0-9.]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function escapeHtml(str) {
    return (str || "").toString().replace(/[&<>"']/g, (m) => {
      switch (m) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#039;";
        default:
          return m;
      }
    });
  }

  // --- Bands Modal UI ---
  function openBandsModal() {
    if (!bandsModal) return;
    bandsModal.classList.add("open");
    document.body.classList.add("modal-open");
    renderBandsOptions();
  }

  function closeBandsModal() {
    if (!bandsModal) return;
    bandsModal.classList.remove("open");
    document.body.classList.remove("modal-open");
  }

  function renderBandsOptions() {
    if (!bandsListEl) return;

    const opts = getBandOptionsForBrand(BRAND);
    bandsListEl.innerHTML = "";

    const frag = document.createDocumentFragment();

    opts.forEach((opt) => {
      const selected = state.selectedBands.has(opt.key);

      const card = document.createElement("div");
      card.className = "band-card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      card.innerHTML = `
        <div class="band-card-img">
          <img src="${opt.img}" alt="${escapeHtml(opt.label)}" loading="lazy" />
        </div>

        <div class="band-card-footer">
          <div class="band-card-label">${escapeHtml(opt.label)}</div>
          <div class="band-card-toggle ${selected ? "on" : ""}">
            <div class="band-card-toggle-knob"></div>
          </div>
        </div>
      `;

      const toggle = () => {
        if (state.selectedBands.has(opt.key)) state.selectedBands.delete(opt.key);
        else state.selectedBands.add(opt.key);
        renderBandsOptions();
      };

      card.addEventListener("click", toggle);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });

      frag.appendChild(card);
    });

    bandsListEl.appendChild(frag);
  }

  function clearBands() {
    state.selectedBands.clear();
    renderBandsOptions();
  }

  function confirmBands() {
    closeBandsModal();
    applyFilters();
  }

  // --- init ---
  async function init() {
    setBrandHeader(BRAND || "Brand");

    // wire modal buttons
    if (bandsBtn) bandsBtn.addEventListener("click", openBandsModal);
    if (bandsCloseBtn) bandsCloseBtn.addEventListener("click", closeBandsModal);
    if (bandsClearBtn) bandsClearBtn.addEventListener("click", clearBands);
    if (bandsConfirmBtn) bandsConfirmBtn.addEventListener("click", confirmBands);

    // close when tapping overlay (if your modal uses an overlay element)
    const overlay = $("#bands-overlay");
    if (overlay) overlay.addEventListener("click", closeBandsModal);

    // load CSV
    const res = await fetch(CSV_URL, { cache: "no-store" });
    const text = await res.text();

    const parsed = parseCSV(text);
    const objs = rowsToObjects(parsed);

    state.allRows = objs;
    applyFilters();
  }

  // go
  init().catch((err) => {
    console.error("brand.js init error:", err);
    if (listEl) {
      listEl.innerHTML = `<div class="brand-empty">Error loading cigars.</div>`;
    }
  });
})();
