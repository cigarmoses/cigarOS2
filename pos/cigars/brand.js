/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   Fixes:
   ✅ Band button opens "Filter by band art" bottom sheet
   ✅ Filters button opens Filters bottom sheet
   ✅ Sheets are auto-injected if missing (no HTML edits required)
   ✅ Close: X, backdrop tap, ESC
   ✅ Confirm enables only when selection exists
   ✅ Applies selected band filter(s) to the cigar list

   Notes:
   - This file is defensive: it will NOT crash if certain DOM nodes are missing.
   - It reads data from the canonical Google Sheet CSV.
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  function escapeHtml(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function norm(s = "") {
    return String(s || "").trim();
  }

  function slug(s = "") {
    return norm(s).toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
  }

  function parseNum(x) {
    const n = Number(String(x || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function uniq(arr) {
    const out = [];
    const seen = new Set();
    for (const v of arr) {
      const k = slug(v);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(v);
    }
    return out;
  }

  // ---------- DOM (brand page) ----------
  const brandTitleEl = $("#brand-title");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");
  const backBtn = $("#brand-back") || $("#fav-back") || $(".pos-back");

  // Band / Filters buttons (supports several possible IDs/hooks)
  const bandBtn =
    $("#brand-band") ||
    $("#band-btn") ||
    $('[data-action="open-band"]') ||
    $('[data-open="band"]');

  const filtersBtn =
    $("#brand-filters") ||
    $("#filters-btn") ||
    $('[data-action="open-filters"]') ||
    $('[data-open="filters"]');

  // ---------- State ----------
  const state = {
    brand: norm(qp("brand")),
    line: norm(qp("line")),
    q: "",
    allRows: [],
    viewRows: [],
    bandSelected: new Set(), // selected band keys
  };

  // ---------- CSV parsing ----------
  function splitCsvLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
        continue;
      }

      if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur);
    return out;
  }

  function csvToObjects(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
    if (!lines.length) return [];

    const headers = splitCsvLine(lines[0]).map((h) => norm(h));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = norm(cols[idx] ?? "");
      });
      rows.push(obj);
    }
    return rows;
  }

  // Column name helpers (your sheet can evolve without breaking JS)
  function pick(obj, candidates) {
    for (const c of candidates) {
      if (obj[c] != null && String(obj[c]).trim() !== "") return obj[c];
    }
    return "";
  }

  function rowBrand(r) {
    return pick(r, ["Brand", "brand", "Manufacturer", "manufacturer", "Maker"]);
  }
  function rowLine(r) {
    return pick(r, ["Line", "line", "Collection", "collection", "Series"]);
  }
  function rowCigar(r) {
    return pick(r, ["Cigar", "cigar", "Name", "name", "Cigar Name"]);
  }
  function rowMsrp(r) {
    return pick(r, ["MSRP", "msrp", "Price", "price"]);
  }
  function rowRing(r) {
    return pick(r, ["Ring", "ring", "RG", "rg", "Ring Gauge"]);
  }
  function rowLength(r) {
    return pick(r, ["Length", "length"]);
  }
  function rowBandKey(r) {
    // If your sheet ever includes a dedicated band identifier, we’ll use it.
    return pick(r, ["Band", "band", "Band Key", "band_key", "BandKey", "Band Art", "band_art"]);
  }
  function rowBandArtFile(r) {
    // Optional: if you store file names like padron_1926_band.svg
    return pick(r, ["Band File", "band_file", "Band Art File", "band_art_file", "BandSVG"]);
  }

  // ---------- Bottom sheet injection ----------
  function ensureSheets() {
    if ($("#pos-sheet-backdrop")) return;

    const backdrop = document.createElement("div");
    backdrop.id = "pos-sheet-backdrop";
    backdrop.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,.35);
      opacity:0; pointer-events:none; transition:opacity .18s ease;
      z-index:9998;
    `;

    const sheet = document.createElement("div");
    sheet.id = "pos-sheet";
    sheet.style.cssText = `
      position:fixed; left:0; right:0; bottom:-8px;
      transform:translateY(100%); transition:transform .22s ease;
      background:#fff; border-top-left-radius:20px; border-top-right-radius:20px;
      box-shadow:0 -20px 50px rgba(0,0,0,.18);
      z-index:9999;
      max-height:80vh;
      display:flex; flex-direction:column;
      padding:14px 14px 10px;
    `;

    sheet.innerHTML = `
      <div id="pos-sheet-head" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div id="pos-sheet-title" style="font-weight:900; font-size:20px; letter-spacing:-0.02em; color:#0f1a2c;">Sheet</div>
        <button id="pos-sheet-close" type="button" aria-label="Close"
          style="width:34px; height:34px; border-radius:999px; border:none; background:#f3f5f8; font-size:18px; font-weight:900; color:#0f1a2c; cursor:pointer;">×</button>
      </div>
      <div id="pos-sheet-body" style="margin-top:10px; overflow:auto; padding-bottom:12px;"></div>
      <button id="pos-sheet-confirm" type="button"
        style="margin-top:8px; width:100%; height:48px; border:none; border-radius:14px;
        background:#e6e9ef; color:#0f1a2c; font-weight:900; font-size:16px; cursor:not-allowed; opacity:.55;"
        disabled>Confirm</button>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);

    const close = () => closeSheet();

    $("#pos-sheet-close").addEventListener("click", close);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  function openSheet({ title, bodyHTML, onConfirm, confirmEnabled }) {
    ensureSheets();

    $("#pos-sheet-title").textContent = title || "Sheet";
    $("#pos-sheet-body").innerHTML = bodyHTML || "";

    const confirmBtn = $("#pos-sheet-confirm");
    const enable = !!confirmEnabled;

    confirmBtn.disabled = !enable;
    confirmBtn.style.cursor = enable ? "pointer" : "not-allowed";
    confirmBtn.style.opacity = enable ? "1" : ".55";
    confirmBtn.style.background = enable ? "#007aff" : "#e6e9ef";
    confirmBtn.style.color = enable ? "#fff" : "#0f1a2c";

    confirmBtn.onclick = null;
    confirmBtn.onclick = () => {
      if (confirmBtn.disabled) return;
      try {
        onConfirm && onConfirm();
      } finally {
        closeSheet();
      }
    };

    const backdrop = $("#pos-sheet-backdrop");
    const sheet = $("#pos-sheet");

    backdrop.style.pointerEvents = "auto";
    requestAnimationFrame(() => {
      backdrop.style.opacity = "1";
      sheet.style.transform = "translateY(0)";
    });
  }

  function closeSheet() {
    const backdrop = $("#pos-sheet-backdrop");
    const sheet = $("#pos-sheet");
    if (!backdrop || !sheet) return;

    backdrop.style.opacity = "0";
    backdrop.style.pointerEvents = "none";
    sheet.style.transform = "translateY(100%)";
  }

  // ---------- Band sheet ----------
  function buildBandOptions() {
    // Derive band options:
    // 1) explicit Band/BandKey column
    // 2) fallback to Line (esp. Padron: 1926 / 1964 / Damaso)
    const brandRows = state.allRows.filter((r) => slug(rowBrand(r)) === slug(state.brand));
    const explicit = uniq(
      brandRows
        .map((r) => norm(rowBandKey(r)))
        .filter(Boolean)
        .filter((v) => v.toLowerCase() !== state.brand.toLowerCase())
    );

    let options = explicit.length ? explicit : uniq(brandRows.map((r) => norm(rowLine(r))).filter(Boolean));

    // Padron fallback: ensure these show if present in data
    if (slug(state.brand).includes("padron")) {
      const wanted = ["1926", "1964", "Damaso"];
      const present = new Set(options.map((x) => x.toLowerCase()));
      for (const w of wanted) {
        if (!present.has(w.toLowerCase())) {
          // only add if any row contains it (line or cigar contains it)
          const has = brandRows.some((r) => {
            const blob = `${rowLine(r)} ${rowCigar(r)}`.toLowerCase();
            return blob.includes(w.toLowerCase());
          });
          if (has) options.push(w);
        }
      }
      options = uniq(options);
    }

    return options;
  }

  function bandArtSrcFor(label) {
    // If you store a direct band file in the sheet, prefer it.
    // Otherwise, attempt common paths (svg first).
    // You can standardize later; this at least prevents "nothing shows".
    const b = slug(state.brand);
    const k = slug(label);

    // common repo patterns you’ve used:
    const candidates = [
      `/img/bands/${b}/${k}.svg`,
      `/img/bands/${b}/${k}.png`,
      `/img/bands/${b}/${k}.jpg`,
      `/img/band/${b}/${k}.svg`,
      `/img/band/${b}/${k}.png`,
      `/img/icons/bands/${b}/${k}.svg`,
      `/img/icons/bands/${b}/${k}.png`,
    ];

    return candidates[0]; // we’ll use onerror swap in img
  }

  function openBandSheet() {
    const bands = buildBandOptions();

    if (!bands.length) {
      openSheet({
        title: "Filter by band art",
        bodyHTML: `<div style="padding:14px 2px; color:#6b7280; font-size:14px;">No band art options found for this brand yet.</div>`,
        onConfirm: () => {},
        confirmEnabled: true,
      });
      return;
    }

    const bodyHTML = `
      <div style="display:flex; flex-direction:column; gap:14px; padding:6px 2px 2px;">
        ${bands
          .map((label) => {
            const key = slug(label);
            const checked = state.bandSelected.has(key);
            const src0 = bandArtSrcFor(label);

            return `
              <label style="display:flex; align-items:flex-end; gap:12px;">
                <div style="flex:1 1 auto; min-width:0;">
                  <div style="border-radius:16px; overflow:hidden; background:#f3f5f8; border:1px solid rgba(15,26,44,.08);">
                    <img
                      data-band-img
                      data-fallback="${escapeHtml(label)}"
                      src="${src0}"
                      alt="${escapeHtml(label)} band"
                      style="display:block; width:100%; height:auto;"
                      onerror="
                        (function(img){
                          const brand='${slug(state.brand)}';
                          const key='${key}';
                          const tries=[
                            '/img/bands/'+brand+'/'+key+'.svg',
                            '/img/bands/'+brand+'/'+key+'.png',
                            '/img/bands/'+brand+'/'+key+'.jpg',
                            '/img/icons/bands/'+brand+'/'+key+'.svg',
                            '/img/icons/bands/'+brand+'/'+key+'.png'
                          ];
                          const cur=img.getAttribute('data-try')||'0';
                          const idx=parseInt(cur,10)||0;
                          if(idx+1 < tries.length){
                            img.setAttribute('data-try', String(idx+1));
                            img.src = tries[idx+1];
                          } else {
                            img.style.display='none';
                            const ph=document.createElement('div');
                            ph.textContent='${escapeHtml(label)}';
                            ph.style.cssText='padding:18px 12px; font-weight:900; color:#0f1a2c;';
                            img.parentElement.appendChild(ph);
                          }
                        })(this);
                      "
                    />
                  </div>
                  <div style="margin-top:10px; display:flex; align-items:center; gap:10px;">
                    <div style="font-weight:900; color:#0f1a2c; font-size:18px;">${escapeHtml(label)}</div>
                    <div style="flex:1 1 auto;"></div>
                    <input type="checkbox" data-band-box value="${escapeHtml(key)}" ${
              checked ? "checked" : ""
            }
                      style="width:24px; height:24px; accent-color:#007aff;" />
                  </div>
                </div>
              </label>
            `;
          })
          .join("")}
      </div>
    `;

    openSheet({
      title: "Filter by band art",
      bodyHTML,
      confirmEnabled: state.bandSelected.size > 0,
      onConfirm: () => {
        const selected = new Set(
          $$('[data-band-box]:checked').map((el) => String(el.value || "").trim()).filter(Boolean)
        );
        state.bandSelected = selected;
        applyAllFilters();
        // Update badge/visual state on buttons if you want
        if (bandBtn) bandBtn.classList.toggle("is-active", state.bandSelected.size > 0);
      },
    });

    // live enable/disable confirm as user checks boxes
    const confirmBtn = $("#pos-sheet-confirm");
    const syncConfirm = () => {
      const count = $$('[data-band-box]:checked').length;
      confirmBtn.disabled = count === 0;
      confirmBtn.style.cursor = count ? "pointer" : "not-allowed";
      confirmBtn.style.opacity = count ? "1" : ".55";
      confirmBtn.style.background = count ? "#007aff" : "#e6e9ef";
      confirmBtn.style.color = count ? "#fff" : "#0f1a2c";
    };

    $$('[data-band-box]').forEach((cb) => cb.addEventListener("change", syncConfirm));
    syncConfirm();
  }

  // ---------- Filters sheet (basic but functional) ----------
  function openFiltersSheet() {
    // Basic filters that won’t break your layout:
    // - Search (local)
    // - Ring min/max
    // - Length min/max
    const rows = state.allRows.filter((r) => slug(rowBrand(r)) === slug(state.brand));
    const ringVals = rows.map((r) => parseNum(rowRing(r))).filter((n) => n != null);
    const lenVals = rows.map((r) => parseNum(rowLength(r))).filter((n) => n != null);

    const ringMin = ringVals.length ? Math.min(...ringVals) : "";
    const ringMax = ringVals.length ? Math.max(...ringVals) : "";
    const lenMin = lenVals.length ? Math.min(...lenVals) : "";
    const lenMax = lenVals.length ? Math.max(...lenVals) : "";

    const bodyHTML = `
      <div style="padding:6px 2px 2px; display:flex; flex-direction:column; gap:14px;">
        <div>
          <div style="font-weight:900; color:#0f1a2c; margin-bottom:8px;">Search</div>
          <input id="filt-q" type="text" value="${escapeHtml(state.q)}"
            placeholder="Search cigars…"
            style="width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              padding:0 14px; font-size:16px; outline:none;" />
        </div>

        <div style="display:flex; gap:12px;">
          <div style="flex:1;">
            <div style="font-weight:900; color:#0f1a2c; margin-bottom:8px;">Ring min</div>
            <input id="filt-ring-min" inputmode="numeric" placeholder="${ringMin}"
              style="width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              padding:0 14px; font-size:16px; outline:none;" />
          </div>
          <div style="flex:1;">
            <div style="font-weight:900; color:#0f1a2c; margin-bottom:8px;">Ring max</div>
            <input id="filt-ring-max" inputmode="numeric" placeholder="${ringMax}"
              style="width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              padding:0 14px; font-size:16px; outline:none;" />
          </div>
        </div>

        <div style="display:flex; gap:12px;">
          <div style="flex:1;">
            <div style="font-weight:900; color:#0f1a2c; margin-bottom:8px;">Length min</div>
            <input id="filt-len-min" inputmode="decimal" placeholder="${lenMin}"
              style="width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              padding:0 14px; font-size:16px; outline:none;" />
          </div>
          <div style="flex:1;">
            <div style="font-weight:900; color:#0f1a2c; margin-bottom:8px;">Length max</div>
            <input id="filt-len-max" inputmode="decimal" placeholder="${lenMax}"
              style="width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              padding:0 14px; font-size:16px; outline:none;" />
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button id="filt-clear" type="button"
            style="flex:1; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              background:#fff; font-weight:900; font-size:16px; color:#0f1a2c; cursor:pointer;">Clear</button>
          <button id="filt-apply" type="button"
            style="flex:1; height:46px; border-radius:14px; border:none;
              background:#007aff; font-weight:900; font-size:16px; color:#fff; cursor:pointer;">Apply</button>
        </div>

        <div style="color:#6b7280; font-size:13px; line-height:1.35;">
          These filters apply to the list immediately after confirm.
        </div>
      </div>
    `;

    openSheet({
      title: "Filters",
      bodyHTML,
      confirmEnabled: true,
      onConfirm: () => {
        // handled by Apply button too, but confirm just closes
      },
    });

    // Wire buttons inside sheet
    const apply = () => {
      state.q = norm($("#filt-q")?.value || "");
      state._ringMin = parseNum($("#filt-ring-min")?.value || "");
      state._ringMax = parseNum($("#filt-ring-max")?.value || "");
      state._lenMin = parseNum($("#filt-len-min")?.value || "");
      state._lenMax = parseNum($("#filt-len-max")?.value || "");
      applyAllFilters();
      if (filtersBtn) filtersBtn.classList.toggle("is-active", !!(state.q || state._ringMin || state._ringMax || state._lenMin || state._lenMax));
      closeSheet();
    };

    const clear = () => {
      state.q = "";
      state._ringMin = null;
      state._ringMax = null;
      state._lenMin = null;
      state._lenMax = null;
      applyAllFilters();
      if (filtersBtn) filtersBtn.classList.remove("is-active");
      closeSheet();
    };

    $("#filt-apply")?.addEventListener("click", apply);
    $("#filt-clear")?.addEventListener("click", clear);

    // Enter key = apply
    $("#filt-q")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
    });
  }

  // ---------- Filtering + rendering ----------
  function passesBandFilter(r) {
    if (!state.bandSelected.size) return true;

    const bandKey = norm(rowBandKey(r));
    const line = norm(rowLine(r));
    const cigar = norm(rowCigar(r));
    const blob = `${bandKey} ${line} ${cigar}`.toLowerCase();

    // if any selected label appears in any of these fields, keep it
    for (const k of state.bandSelected) {
      if (k && blob.includes(k)) return true;
    }
    return false;
  }

  function passesText(r) {
    if (!state.q) return true;
    const q = state.q.toLowerCase();
    const blob = `${rowLine(r)} ${rowCigar(r)} ${rowRing(r)} ${rowLength(r)} ${rowMsrp(r)}`.toLowerCase();
    return blob.includes(q);
  }

  function passesNumeric(r) {
    const ring = parseNum(rowRing(r));
    const len = parseNum(rowLength(r));

    if (state._ringMin != null && ring != null && ring < state._ringMin) return false;
    if (state._ringMax != null && ring != null && ring > state._ringMax) return false;
    if (state._lenMin != null && len != null && len < state._lenMin) return false;
    if (state._lenMax != null && len != null && len > state._lenMax) return false;

    return true;
  }

  function applyAllFilters() {
    const brandSlug = slug(state.brand);

    state.viewRows = state.allRows
      .filter((r) => slug(rowBrand(r)) === brandSlug)
      .filter((r) => (state.line ? slug(rowLine(r)) === slug(state.line) : true))
      .filter(passesBandFilter)
      .filter(passesText)
      .filter(passesNumeric);

    renderList();
  }

  function renderList() {
    if (!listEl) return;

    if (!state.viewRows.length) {
      listEl.innerHTML = "";
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "No cigars match your filters.";
      }
      return;
    }

    if (statusEl) statusEl.hidden = true;

    // Keep the markup minimal so your existing CSS handles layout.
    listEl.innerHTML = state.viewRows
      .map((r) => {
        const line = norm(rowLine(r));
        const cigar = norm(rowCigar(r));
        const name = [line, cigar].filter(Boolean).join(" — ");
        const msrp = norm(rowMsrp(r));
        const ring = norm(rowRing(r));
        const length = norm(rowLength(r));

        return `
          <div class="brand-row" data-cigar-row style="cursor:pointer;">
            <div class="brand-row-left">
              <div class="brand-row-title">${escapeHtml(name || "Cigar")}</div>
              <div class="brand-row-sub">${escapeHtml(
                [length ? `${length}"` : "", ring ? `RG ${ring}` : ""].filter(Boolean).join(" • ")
              )}</div>
            </div>
            <div class="brand-row-right">
              ${msrp ? `<div class="brand-row-msrp">${escapeHtml(msrp)}</div>` : ""}
            </div>
          </div>
        `;
      })
      .join("");

    // If your site already has a “detail popup” handler elsewhere,
    // we won’t override it. We simply keep row clickable.
    // (You can wire this to your existing modal later.)
  }

  // ---------- Boot ----------
  async function boot() {
    // Title
    if (brandTitleEl) brandTitleEl.textContent = state.brand || "Brand";

    // Back
    backBtn?.addEventListener("click", () => history.back());

    // Wire buttons
    if (bandBtn) bandBtn.addEventListener("click", openBandSheet);
    if (filtersBtn) filtersBtn.addEventListener("click", openFiltersSheet);

    // If buttons missing, don’t silently fail (helps you debug fast)
    if (!bandBtn) console.warn("[brand.js] Band button not found on page.");
    if (!filtersBtn) console.warn("[brand.js] Filters button not found on page.");

    // Fetch CSV
    try {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Loading…";
      }

      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();
      state.allRows = csvToObjects(text);

      if (statusEl) statusEl.hidden = true;

      applyAllFilters();
    } catch (e) {
      console.error(e);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Failed to load cigars.";
      }
    }

    // Optional: sync search bar if present
    if (searchEl) {
      searchEl.addEventListener("input", () => {
        state.q = norm(searchEl.value || "");
        applyAllFilters();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
