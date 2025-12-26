/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)
   - Loads canonical CSV
   - Renders rows
   - Filters + Bands modals (working close/confirm)
   - Uses shared /pos/cart.js for receipt + badge + persistence

   FIXES IN THIS VERSION:
   ✅ SVGs/images render again by normalizing paths:
      - ensures leading "/" for local assets
      - auto-fixes /img/icons/brand/  -> /img/icons/brands/ (plural)
      - auto-fixes img/icons/...     -> /img/icons/...
   ✅ Row icon now falls back correctly if a cigar image fails:
      Cigar IMG -> Brand IMG -> Manufacturer IMG -> hidden
   ✅ Prevents duplicate modal button listeners stacking on repeated opens
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  // --- DOM ---
  const $ = (sel) => document.querySelector(sel);

  const brandTitleEl = $("#brand-title");
  const brandIconEl = $("#brand-icon-img");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");

  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");

  // wrapper toggle (maduro/all/natural)
  const wrapperSeg = $("#wrapper-seg");
  const btnMaduro = $("#seg-maduro");
  const btnNatural = $("#seg-natural");
  const segDot = $("#seg-dot");

  // --- State ---
  let ALL = [];
  let VIEW = [];

  // modal state
  let pendingFilters = {};
  let activeFilters = {};
  let pendingBands = new Set();
  let activeBands = new Set();

  // wrapper state
  let wrapperState = "all"; // maduro | natural | all

  // ---------- helpers ----------
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";
  const norm = (s) => (s || "").toString().trim().toLowerCase();
  const money = (n) =>
    window.CigarOSCart?.money ? window.CigarOSCart.money(n) : Number(n || 0).toFixed(2);

  const toNum = (v) => {
    const x = Number((v ?? "").toString().replace(/[^\d.]/g, ""));
    return Number.isFinite(x) ? x : 0;
  };

  // Match "Source column is line OR cigar name" rule for band filtering
  function matchBandSource(row) {
    return `${row.Line || ""} ${row.Cigar || ""}`.toLowerCase();
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  // ---------- PATH / IMAGE NORMALIZATION (FIX FOR SVGs NOT SHOWING) ----------
  function normalizeAssetPath(p) {
    let s = (p || "").toString().trim();
    if (!s) return "";

    // Leave full URLs alone
    if (/^https?:\/\//i.test(s)) return s;

    // If it starts with "img/..." make it "/img/..."
    if (!s.startsWith("/")) s = "/" + s;

    // Fix your known folder naming issue: brand vs brands
    // (you told me icons live under /img/icons/brands plural)
    s = s.replace(/^\/img\/icons\/brand\//i, "/img/icons/brands/");
    s = s.replace(/^\/img\/icons\/brand\/?/i, "/img/icons/brands/");

    // Some old rows might store "img/icons/brand/..." without leading slash
    s = s.replace(/^\/img\/icons\/brand\//i, "/img/icons/brands/");

    return s;
  }

  function bestIconForRow(row) {
    // prefer Cigar IMG, else Brand IMG, else Manufacturer IMG
    const raw = row["Cigar IMG"] || row["Brand IMG"] || row["Manufacturer IMG"] || "";
    return normalizeAssetPath(raw);
  }

  function brandIconForRow(row) {
    return normalizeAssetPath(row?.["Brand IMG"] || "");
  }

  function manufacturerIconForRow(row) {
    return normalizeAssetPath(row?.["Manufacturer IMG"] || "");
  }

  // ---------- CSV parsing by HEADER ----------
  function parseCSV(text) {
    // Robust CSV parser for quoted commas
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
        continue;
      }
    }
    row.push(field);
    rows.push(row);

    // Trim empty tail
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

  // ---------- brand header ----------
  function applyBrandHeader(brandName, firstRow) {
    if (brandTitleEl) brandTitleEl.textContent = brandName || "Brand";

    if (brandIconEl) {
      const raw = firstRow?.["Brand IMG"] || firstRow?.["Manufacturer IMG"] || "";
      const img = normalizeAssetPath(raw);

      if (img) {
        brandIconEl.src = img;
        brandIconEl.style.display = "block";
      } else {
        brandIconEl.removeAttribute("src");
        brandIconEl.style.display = "none";
      }
    }
  }

  // ---------- list render ----------
  function stableRowId(row) {
    // prefer key, else make a stable string
    const k = (row.key || "").trim();
    if (k) return k;
    const b = (row.Brand || "").trim();
    const c = (row.Cigar || "").trim();
    const v = (row.Vitola || "").trim();
    return `${b}__${c}__${v}`.replace(/\s+/g, " ").trim();
  }

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

        const icon0 = bestIconForRow(row);
        const icon1 = brandIconForRow(row);
        const icon2 = manufacturerIconForRow(row);

        const id = stableRowId(row);

        return `
          <div class="brand-row" data-id="${escapeHTML(id)}">
            <img
              class="row-ico"
              src="${escapeAttr(icon0)}"
              data-fallback1="${escapeAttr(icon1)}"
              data-fallback2="${escapeAttr(icon2)}"
              alt=""
            />
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

    // icon fallback behavior (fixes "blank icons" when one path is wrong)
    listEl.querySelectorAll("img.row-ico").forEach((img) => {
      img.addEventListener(
        "error",
        () => {
          const cur = img.getAttribute("src") || "";
          const fb1 = img.getAttribute("data-fallback1") || "";
          const fb2 = img.getAttribute("data-fallback2") || "";

          if (fb1 && cur !== fb1) {
            img.src = fb1;
            return;
          }
          if (fb2 && cur !== fb2) {
            img.src = fb2;
            return;
          }
          img.style.visibility = "hidden";
        },
        { once: false }
      );
    });

    // bind add buttons
    listEl.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const rowEl = e.currentTarget.closest(".brand-row");
        const id = rowEl?.getAttribute("data-id") || "";

        const row = rows.find((x) => stableRowId(x) === id);
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

      // Wrapper toggle (maduro/natural/all)
      if (wrapperState === "maduro") {
        const shade = norm(row["Wrapper Shade"] || row.Wrapper || "");
        if (!shade.includes("maduro")) return false;
      } else if (wrapperState === "natural") {
        const shade = norm(row["Wrapper Shade"] || row.Wrapper || "");
        if (shade.includes("maduro") && !shade.includes("natural")) return false;
      }

      // Active filters (chips)
      for (const [k, set] of Object.entries(activeFilters)) {
        if (!set || !set.size) continue;
        const v = norm(row[k] || "");
        if (!set.has(v)) return false;
      }

      // Active bands (match against Line OR Cigar)
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

  // ---------- wrapper toggle behavior (click words OR dot) ----------
  function setWrapperState(state) {
    wrapperState = state; // maduro | all | natural
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

    // close when tapping backdrop
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
    for (const [k, set] of Object.entries(obj || {})) {
      out[k] = new Set(set ? [...set] : []);
    }
    return out;
  }

  // ---------- Filters modal (chips) ----------
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

    // Build available options from ALL (brand scoped)
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
                ${vals
                  .map((v) => {
                    const on = pendingFilters[f]?.has(v);
                    return `<button type="button" class="chip ${
                      on ? "on" : ""
                    }" data-field="${escapeAttr(f)}" data-val="${escapeAttr(v)}">${escapeHTML(
                      v
                    )}</button>`;
                  })
                  .join("")}
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

    // IMPORTANT: use .onclick so we don't stack listeners every time you open modal
    const clearBtn = overlay.querySelector("[data-clear]");
    const confirmBtn = overlay.querySelector("[data-confirm]");

    if (clearBtn) {
      clearBtn.onclick = () => {
        pendingFilters = {};
        openFilters(); // rerender
      };
    }

    if (confirmBtn) {
      confirmBtn.onclick = () => {
        activeFilters = cloneFilterSets(pendingFilters);
        hideModal(overlay);
        applyAllFilters();
      };
    }

    showModal(overlay);
  }

  // ---------- Bands modal (centered with large images) ----------
  function openBands() {
    const overlay = ensureModalBase("bands-modal", "Bands");
    overlay.classList.add("bands-modal");
    const body = overlay.querySelector(".pos-modal-card-body");

    const brand = (qp("brand") || "").trim();
    const b = norm(brand);

    const BAND_LIBRARY = {
      padron: [
        { token: "1926", label: "1926", src: "/img/icons/padron1926serieband.svg" },
        { token: "1964", label: "1964", src: "/img/icons/padron1964anniversaryband.svg" },
        { token: "damaso", label: "Damaso", src: "/img/icons/padrondamasoband.svg" },
      ],
    };

    const bands = BAND_LIBRARY[b] || [];

    pendingBands = new Set(activeBands);

    body.innerHTML = `
      <div class="bands-grid">
        ${bands
          .map((x) => {
            const on = pendingBands.has(x.token);
            return `
              <button type="button" class="band-card ${on ? "on" : ""}" data-token="${escapeAttr(
              x.token
            )}">
                <div class="band-imgwrap">
                  <img src="${escapeAttr(x.src)}" alt="${escapeAttr(x.label)}" />
                </div>
                <div class="band-foot">
                  <div class="band-label">${escapeHTML(x.label)}</div>
                  <div class="band-check">${on ? "✓" : ""}</div>
                </div>
              </button>
            `;
          })
          .join("")}
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

    const clearBtn = overlay.querySelector("[data-clear]");
    const confirmBtn = overlay.querySelector("[data-confirm]");

    if (clearBtn) {
      clearBtn.onclick = () => {
        pendingBands = new Set();
        openBands();
      };
    }

    if (confirmBtn) {
      confirmBtn.onclick = () => {
        activeBands = new Set(pendingBands);
        hideModal(overlay);
        applyAllFilters();
      };
    }

    showModal(overlay);
  }

  // ---------- load data ----------
  async function load() {
    const brand = (qp("brand") || "").trim();
    if (!brand) {
      setStatus("Missing brand.");
      return;
    }

    setStatus("Loading…");

    const url = `${CSV_URL}&_=${Date.now()}`; // bust cache
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const table = tableFromCSV(text);

    // Filter rows by Brand column (exact match)
    const brandNorm = norm(brand);
    ALL = table.filter((r) => norm(r.Brand) === brandNorm);

    if (!ALL.length) {
      ALL = table.filter((r) => norm(r["Brand aka"]) === brandNorm);
    }

    applyBrandHeader(brand, ALL[0]);

    VIEW = [...ALL];
    applyAllFilters();
  }

  // ---------- init ----------
  function init() {
    btnFilters?.addEventListener("click", openFilters);
    btnBands?.addEventListener("click", openBands);

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
