/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)
   - Loads canonical CSV
   - Renders rows
   - Filters + Bands modals
   - Uses shared /pos/cart.js for receipt + badge + persistence
   - FIXES:
     1) Filters/Bands buttons not opening (robust button selector fallbacks)
     2) Back button safe binding + fallback route
     3) Brand header icon robust + legacy path normalization
     4) Padron bands only on Padron page; other brands show "not configured" message
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- DOM (core) ----------
  const brandTitleEl = $("#brand-title");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl =
    $("#brand-search") ||
    $("#search") ||
    document.querySelector('input[type="search"]');

  // Buttons: use MANY fallbacks so you can rename HTML freely
  const btnFilters =
    $("#btn-filters") ||
    $("#filters-btn") ||
    document.querySelector('[data-action="filters"]') ||
    document.querySelector('[data-open="filters"]') ||
    document.querySelector(".btn-filters") ||
    document.querySelector(".filters-btn");

  const btnBands =
    $("#btn-bands") ||
    $("#bands-btn") ||
    document.querySelector('[data-action="bands"]') ||
    document.querySelector('[data-open="bands"]') ||
    document.querySelector(".btn-bands") ||
    document.querySelector(".bands-btn");

  // Back button(s)
  const backBtn =
    $("#brand-back") ||
    $("#pos-back") ||
    $("#category-back") ||
    document.querySelector(".pos-back") ||
    document.querySelector(".icon-btn.pos-back");

  // Wrapper toggle (maduro/all/natural) — optional (won’t break if missing)
  const wrapperSeg = $("#wrapper-seg");
  const btnMaduro = $("#seg-maduro");
  const btnNatural = $("#seg-natural");
  const segDot = $("#seg-dot");

  // Brand header icon (optional)
  const brandIconImg =
    $("#brand-icon-img") ||
    $("#brand-icon") ||
    document.querySelector(".brand-icon img") ||
    document.querySelector("#brand-icon-el img");

  // ---------- State ----------
  let ALL = [];
  let VIEW = [];

  let pendingFilters = {};
  let activeFilters = {};
  let pendingBands = new Set();
  let activeBands = new Set();

  let wrapperState = "all"; // maduro | natural | all

  // ---------- helpers ----------
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";
  const norm = (s) => (s || "").toString().trim().toLowerCase();

  const money = (n) =>
    window.CigarOSCart?.money
      ? window.CigarOSCart.money(n)
      : Number(n || 0).toFixed(2);

  const toNum = (v) => {
    const x = Number((v ?? "").toString().replace(/[^\d.]/g, ""));
    return Number.isFinite(x) ? x : 0;
  };

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  // Normalize icon paths:
  // - fixes /img/icons/brands/s/padron.svg -> /img/icons/brands/padron.svg
  // - fixes /img/icons/brand/... -> /img/icons/brands/...
  function normalizeIconPath(p) {
    let s = (p || "").toString().trim();
    if (!s) return "";

    // allow absolute urls
    if (/^https?:\/\//i.test(s)) return s;

    if (s.startsWith("img/")) s = "/" + s;
    if (!s.startsWith("/")) s = "/" + s;

    // singular -> plural folder
    s = s.replace(/^\/img\/icons\/brand\//i, "/img/icons/brands/");

    // strip /brands/<letter>/ prefix if present
    s = s.replace(/^\/img\/icons\/brands\/[a-z0-9]\/+/i, "/img/icons/brands/");

    // collapse ////
    s = s.replace(/\/{2,}/g, "/");
    return s;
  }

  function matchBandSource(row) {
    return `${row.Line || ""} ${row.Cigar || ""}`.toLowerCase();
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
      for (let c = 0; c < header.length; c++) {
        obj[header[c]] = (rows[r][c] ?? "").trim();
      }
      out.push(obj);
    }
    return out;
  }

  // ---------- images ----------
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

    if (brandIconImg) {
      const img = bestBrandHeaderIcon(firstRow);
      if (img) {
        brandIconImg.src = img;
        brandIconImg.style.display = "block";
        brandIconImg.style.visibility = "visible";
        brandIconImg.style.opacity = "1";
      } else {
        brandIconImg.removeAttribute("src");
        brandIconImg.style.display = "none";
      }
    }
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
        <div class="brand-row" data-id="${escapeHTML(id)}">
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
  function applyAllFilters() {
    const q = norm(searchEl?.value || "");

    VIEW = ALL.filter((row) => {
      if (q) {
        const hay = norm(`${row.Cigar || ""} ${row.Vitola || ""} ${row.Line || ""}`);
        if (!hay.includes(q)) return false;
      }

      if (wrapperState === "maduro") {
        const shade = norm(row["Wrapper Shade"] || row.Wrapper || "");
        if (!shade.includes("maduro")) return false;
      } else if (wrapperState === "natural") {
        const shade = norm(row["Wrapper Shade"] || row.Wrapper || "");
        if (shade.includes("maduro") && !shade.includes("natural")) return false;
      }

      for (const [k, set] of Object.entries(activeFilters)) {
        if (!set || !set.size) continue;
        const v = norm(row[k] || "");
        if (!set.has(v)) return false;
      }

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

    if (btnMaduro) btnMaduro.setAttribute("aria-pressed", String(state === "maduro"));
    if (btnNatural) btnNatural.setAttribute("aria-pressed", String(state === "natural"));

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

  // ---------- MODALS ----------
  function ensureModalBase(id, title) {
    let overlay = document.getElementById(id);
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = id;
    overlay.className = "pos-modal-overlay";
    overlay.hidden = true;

    overlay.innerHTML = `
      <div class="pos-modal-card" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
        <div class="pos-modal-card-head">
          <h3 class="pos-modal-card-title">${escapeHTML(title)}</h3>
          <button class="pos-modal-card-x" type="button" data-close aria-label="Close">×</button>
        </div>
        <div class="pos-modal-card-body"></div>
        <div class="pos-modal-card-foot">
          <button type="button" class="pos-btn-light" data-clear>Clear</button>
          <button type="button" class="pos-btn-blue" data-confirm>Confirm</button>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) hideModal(overlay);
    });

    overlay.querySelectorAll("[data-close]").forEach((b) =>
      b.addEventListener("click", () => hideModal(overlay))
    );

    document.addEventListener("keydown", (e) => {
      if (!overlay.hidden && e.key === "Escape") hideModal(overlay);
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function showModal(overlay) {
    overlay.hidden = false;
    document.body.classList.add("pos-modal-open");
  }
  function hideModal(overlay) {
    overlay.hidden = true;
    document.body.classList.remove("pos-modal-open");
  }

  function cloneFilterSets(obj) {
    const out = {};
    for (const [k, set] of Object.entries(obj || {})) out[k] = new Set(set ? [...set] : []);
    return out;
  }

  function openFilters() {
    const overlay = ensureModalBase("filters-modal", "Filters");
    const body = overlay.querySelector(".pos-modal-card-body");

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

    pendingFilters = cloneFilterSets(activeFilters);

    body.innerHTML = `
      <div class="filter-grid">
        ${FIELDS.map((f) => {
          const vals = [...options[f]].sort();
          if (!vals.length) return "";
          return `
            <div class="filter-block">
              <div class="filter-label">${escapeHTML(f)}</div>
              <div class="chip-wrap">
                ${vals.map((v) => {
                  const on = pendingFilters[f]?.has(v);
                  return `<button type="button" class="chip ${on ? "on" : ""}" data-field="${escapeAttr(
                    f
                  )}" data-val="${escapeAttr(v)}">${escapeHTML(v)}</button>`;
                }).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    body.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const field = chip.getAttribute("data-field");
        const val = chip.getAttribute("data-val");
        if (!field || !val) return;

        pendingFilters[field] ||= new Set();
        if (pendingFilters[field].has(val)) {
          pendingFilters[field].delete(val);
          chip.classList.remove("on");
        } else {
          pendingFilters[field].add(val);
          chip.classList.add("on");
        }
      });
    });

    // rebind buttons safely
    const clearBtn = overlay.querySelector("[data-clear]");
    const confirmBtn = overlay.querySelector("[data-confirm]");

    if (clearBtn) {
      const clone = clearBtn.cloneNode(true);
      clearBtn.replaceWith(clone);
      clone.addEventListener("click", () => {
        pendingFilters = {};
        openFilters();
      });
    }

    if (confirmBtn) {
      const clone = confirmBtn.cloneNode(true);
      confirmBtn.replaceWith(clone);
      clone.addEventListener("click", () => {
        activeFilters = cloneFilterSets(pendingFilters);
        hideModal(overlay);
        applyAllFilters();
      });
    }

    showModal(overlay);
  }

  function getBandLibraryForBrand(brandKey) {
    // Padron-only for now, others can be added later
    const LIB = {
      padron: [
        { token: "1926", label: "1926", src: "/img/icons/padron1926serieband.svg" },
        { token: "1964", label: "1964", src: "/img/icons/padron1964anniversaryband.svg" },
        { token: "damaso", label: "Damaso", src: "/img/icons/padrondamasoband.svg" },
        { token: "black series", label: "Black Series", src: "/img/icons/padronblackseriesband.svg" },
        { token: "series", label: "Series", src: "/img/icons/padronseriesband.svg" },
        { token: "family reserve", label: "Family Reserve", src: "/img/icons/padronfamilyreserveband.svg" },
      ],
    };

    return LIB[brandKey] || [];
  }

  function openBands() {
    const overlay = ensureModalBase("bands-modal", "Bands");
    overlay.classList.add("bands-modal");

    const confirmBtn = overlay.querySelector("[data-confirm]");
    if (confirmBtn) {
      confirmBtn.classList.remove("pos-btn-blue");
      confirmBtn.classList.add("pos-btn-green");
    }

    const body = overlay.querySelector(".pos-modal-card-body");

    const brand = (qp("brand") || "").trim();
    const b = norm(brand);

    const bands = getBandLibraryForBrand(b);
    pendingBands = new Set(activeBands);

    if (!bands.length) {
      body.innerHTML = `
        <div style="padding:12px 4px; font-size:16px; opacity:.7;">
          No bands configured for <b>${escapeHTML(brand || "this brand")}</b> yet.
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="bands-grid">
          ${bands.map((x) => {
            const on = pendingBands.has(x.token);
            return `
              <button type="button" class="band-card ${on ? "on" : ""}" data-token="${escapeAttr(x.token)}">
                <div class="band-imgwrap">
                  <img src="${escapeAttr(x.src)}" alt="${escapeAttr(x.label)}" />
                </div>
                <div class="band-foot">
                  <div class="band-label">${escapeHTML(x.label)}</div>
                  <div class="band-check">${on ? "✓" : ""}</div>
                </div>
              </button>
            `;
          }).join("")}
        </div>
      `;

      body.querySelectorAll(".band-card").forEach((card) => {
        card.addEventListener("click", () => {
          const token = card.getAttribute("data-token");
          if (!token) return;

          const check = card.querySelector(".band-check");

          if (pendingBands.has(token)) {
            pendingBands.delete(token);
            card.classList.remove("on");
            if (check) check.textContent = "";
          } else {
            pendingBands.add(token);
            card.classList.add("on");
            if (check) check.textContent = "✓";
          }
        });
      });
    }

    const clearBtn = overlay.querySelector("[data-clear]");
    const confirmBtn2 = overlay.querySelector("[data-confirm]");

    if (clearBtn) {
      const clone = clearBtn.cloneNode(true);
      clearBtn.replaceWith(clone);
      clone.addEventListener("click", () => {
        pendingBands = new Set();
        openBands();
      });
    }

    if (confirmBtn2) {
      const clone = confirmBtn2.cloneNode(true);
      confirmBtn2.replaceWith(clone);
      clone.addEventListener("click", () => {
        activeBands = new Set(pendingBands);
        hideModal(overlay);
        applyAllFilters();
      });
    }

    showModal(overlay);
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
    VIEW = [...ALL];
    applyAllFilters();
  }

  // Back button handler
  function initBackButton() {
    if (!backBtn) return;

    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = "/pos/cigars/";
    });
  }

  // IMPORTANT: bind click handlers even if the buttons were renamed
  function initButtons() {
    if (btnFilters) {
      btnFilters.addEventListener("click", (e) => {
        e.preventDefault();
        openFilters();
      });
    } else {
      console.warn("brand.js: Filters button not found (no #btn-filters / fallback selector matched).");
    }

    if (btnBands) {
      btnBands.addEventListener("click", (e) => {
        e.preventDefault();
        openBands();
      });
    } else {
      console.warn("brand.js: Bands button not found (no #btn-bands / fallback selector matched).");
    }
  }

  function init() {
    initBackButton();
    initButtons();

    searchEl?.addEventListener("input", () => applyAllFilters());
    initWrapperSeg();

    load().catch((err) => {
      console.error(err);
      setStatus("Failed to load cigars.");
    });
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

  window.addEventListener("DOMContentLoaded", init);
})();
