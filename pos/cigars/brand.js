/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   ✅ Fixes addressed:
   - Correct row DOM + proper alignment (no "Maduro 29.25" inline)
   - Row click opens your EXISTING cigar detail overlay (#cigarDetailOverlay)
   - Green + adds to invoice (via cart.js parsing data-receipt-item JSON)
   - Filters button opens (uses existing #sheet-filters shell)
   - Bands button opens (shows ALL band art images for current brand, with optional Line filter)
   - Scoped to current brand (?brand=Padron)

   Notes:
   - Uses Hub CSV export URL
   - Uses "Cigar IMG" for row icon + for Bands art gallery (if present)
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  const norm = (s) => String(s ?? "").trim();
  const lower = (s) => norm(s).toLowerCase();
  const slug = (s) => lower(s).replace(/[^a-z0-9]+/g, "");

  const esc = (s = "") =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  // ---- brand context ----
  const BRAND = norm(qp("brand"));
  const BRAND_SLUG = slug(BRAND);

  // ---- DOM ----
  const brandTitleEl = $("#brand-title");
  const brandIconWrap = $("#brand-icon");

  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");
  const backBtn = $("#brand-back") || $(".pos-back");

  // ✅ correct IDs from your brand.html
  const filtersBtn = $("#btn-filters");
  const bandsBtn = $("#btn-bands");

  // wrapper seg exists in HTML; we keep it non-breaking (optional)
  const wrapperSeg = $("#wrapper-seg");
  const btnMaduro = $("#seg-maduro");
  const btnNatural = $("#seg-natural");
  const btnSwitch = $("#seg-switch");

  // sheets from your HTML
  const backdropEl = $("#sheet-backdrop");
  const sheetFilters = $("#sheet-filters");
  const sheetBands = $("#sheet-bands");

  const bandsOptionsEl = $("#bands-options");
  const bandsConfirmBtn = $("#bands-confirm");

  // cigar detail overlay from your HTML
  const detailOverlay = $("#cigarDetailOverlay");
  const detailClose = $("#cigarDetailClose");
  const detailBody = $("#cigarDetailBody");

  // ---- CSV parsing ----
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
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length);
    if (!lines.length) return [];
    const headers = splitCsvLine(lines[0]).map((h) => norm(h));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const obj = {};
      for (let c = 0; c < headers.length; c++) obj[headers[c]] = norm(cols[c] ?? "");
      rows.push(obj);
    }
    return rows;
  }

  function pick(r, keys) {
    for (const k of keys) if (r[k] != null && norm(r[k]) !== "") return r[k];
    const ks = Object.keys(r);
    for (const want of keys) {
      const hit = ks.find((h) => lower(h) === lower(want));
      if (hit && norm(r[hit]) !== "") return r[hit];
    }
    return "";
  }

  // Hub columns (based on your header list)
  const getManufacturer = (r) => pick(r, ["Manufacturer"]);
  const getBrand = (r) => pick(r, ["Brand", "Manufacturer"]); // Brand preferred
  const getBrandImg = (r) => pick(r, ["Brand IMG", "Brand Img", "Brand Image"]);
  const getLine = (r) => pick(r, ["Line", "Series", "Collection"]);
  const getCigar = (r) => pick(r, ["Cigar", "Name", "Cigar Name"]);
  const getVitola = (r) => pick(r, ["Vitola"]);
  const getLength = (r) => pick(r, ["Length"]);
  const getRG = (r) => pick(r, ["RG", "Ring", "Ring Gauge"]);
  const getShape = (r) => pick(r, ["Shape"]);
  const getWrapper = (r) => pick(r, ["Wrapper", "Wrapper Shade", "Wrapper Type"]);
  const getBinder = (r) => pick(r, ["Binder"]);
  const getFiller = (r) => pick(r, ["Filler"]);
  const getOrigin = (r) => pick(r, ["Origin", "Country", "Country of Origin"]);
  const getStrength = (r) => pick(r, ["Strength"]);
  const getMSRP = (r) => pick(r, ["MSRP", "Price"]);
  const getCigarImg = (r) => pick(r, ["Cigar IMG", "Cigar Img", "Cigar Image", "Cigar IMG "]);
  const getWrapperShade = (r) => pick(r, ["Wrapper Shade"]);

  const toPrice = (x) => {
    const n = Number(String(x ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  // ---- state ----
  const state = {
    all: [],
    view: [],
    q: "",
    lineFilter: "", // used by Bands selection (Line)
    wrapperState: "all", // "all" | "maduro" | "natural"
  };

  function inBrand(r) {
    if (!BRAND) return true;
    return slug(getBrand(r) || getManufacturer(r)) === BRAND_SLUG;
  }

  function matchesWrapperState(r) {
    if (state.wrapperState === "all") return true;

    // attempt to decide via Wrapper Shade first (more explicit), then Wrapper text
    const shade = lower(getWrapperShade(r));
    const w = lower(getWrapper(r));

    const isMaduro = shade.includes("maduro") || w.includes("maduro");
    const isNatural =
      shade.includes("natural") ||
      shade.includes("claro") ||
      shade.includes("connecticut") ||
      w.includes("natural") ||
      w.includes("claro") ||
      w.includes("connecticut");

    if (state.wrapperState === "maduro") return isMaduro && !isNatural ? true : isMaduro;
    if (state.wrapperState === "natural") return isNatural && !isMaduro ? true : isNatural;

    return true;
  }

  function apply() {
    const q = lower(state.q);

    state.view = state.all
      .filter(inBrand)
      .filter(matchesWrapperState)
      .filter((r) => {
        if (!state.lineFilter) return true;
        return lower(getLine(r)) === lower(state.lineFilter);
      })
      .filter((r) => {
        if (!q) return true;
        const blob = [
          getLine(r),
          getCigar(r),
          getVitola(r),
          getWrapper(r),
          getWrapperShade(r),
          getOrigin(r),
          getRG(r),
          getLength(r),
          getShape(r),
          getStrength(r),
          getMSRP(r),
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });

    render();
  }

  // ---- cart payload (JSON) ----
  function receiptPayload(row) {
    const brand = norm(getBrand(row) || getManufacturer(row));
    const line = norm(getLine(row));
    const cigar = norm(getCigar(row));
    const vitola = norm(getVitola(row));
    const msrp = norm(getMSRP(row));

    const key = `${slug(brand)}|${slug(line)}|${slug(cigar)}|${slug(vitola)}`;

    return {
      id: key,
      key,
      type: "product",
      category: "Cigars",
      brand,
      name: `${line ? line + " — " : ""}${cigar}${vitola ? " (" + vitola + ")" : ""}`,
      price: toPrice(msrp),
      qty: 1,
      img: norm(getCigarImg(row)),
      sub: [norm(getOrigin(row)), norm(getLength(row)) ? `${norm(getLength(row))}"` : "", norm(getRG(row)) ? `RG ${norm(getRG(row))}` : ""]
        .filter(Boolean)
        .join(" • "),
      meta: {
        brand,
        line,
        cigar,
        vitola,
      },
    };
  }

  // ---- render rows ----
  function render() {
    if (!listEl) return;

    if (!state.view.length) {
      listEl.innerHTML = "";
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "No cigars found.";
      }
      return;
    }
    if (statusEl) statusEl.hidden = true;

    listEl.innerHTML = state.view
      .map((r) => {
        const brand = norm(getBrand(r) || getManufacturer(r));
        const line = norm(getLine(r));
        const cigar = norm(getCigar(r));
        const wrapper = norm(getWrapper(r));
        const origin = norm(getOrigin(r));
        const length = norm(getLength(r));
        const rg = norm(getRG(r));
        const msrp = norm(getMSRP(r));
        const img = norm(getCigarImg(r));

        const payload = receiptPayload(r);

        // ✅ Row uses OLD contract pieces that your brand.css already supports:
        // .row-ico + .row-main + .row-price + .row-add
        // (This ensures the icon column + divider + msrp align exactly.)
        const sub = [origin, length ? `${length}"` : "", rg ? `RG ${rg}` : ""].filter(Boolean).join(" • ");

        return `
          <div class="brand-row" data-row
               data-brand="${esc(brand)}"
               data-line="${esc(line)}"
               data-cigar="${esc(cigar)}"
               data-wrapper="${esc(wrapper)}"
               data-origin="${esc(origin)}"
               data-length="${esc(length)}"
               data-rg="${esc(rg)}"
               data-msrp="${esc(msrp)}"
               data-img="${esc(img)}">
            ${
              img
                ? `<img class="row-ico" src="${esc(img)}" alt="" onerror="this.style.display='none';" />`
                : `<div class="row-ico" aria-hidden="true" style="display:grid;place-items:center;color:rgba(255,255,255,.55);font-size:10px;font-weight:800;text-align:center;line-height:1.1;padding:6px;">IMG<br/>SOON</div>`
            }

            <div class="row-main">
              <div class="row-title">${esc(line || brand)}${cigar ? `<br/>${esc(cigar)}` : ""}${wrapper ? `<br/>${esc(wrapper)}` : ""}</div>
              ${sub ? `<div class="row-sub">${esc(sub)}</div>` : ""}
            </div>

            <div class="row-price">${esc(msrp)}</div>

            <button type="button"
              class="row-add"
              aria-label="Add to invoice"
              data-receipt-item='${esc(JSON.stringify(payload))}'>+</button>
          </div>
        `;
      })
      .join("");
  }

  // ---- Cigar Detail Overlay (build HTML that matches your brand.css .cd-* styles) ----
  function openDetail(item) {
    if (!detailOverlay || !detailBody) return;

    const brand = norm(item.brand);
    const line = norm(item.line);
    const cigar = norm(item.cigar);
    const wrapper = norm(item.wrapper);
    const binder = norm(item.binder);
    const filler = norm(item.filler);
    const origin = norm(item.origin);
    const length = norm(item.length);
    const rg = norm(item.rg);
    const msrp = norm(item.msrp);
    const img = norm(item.img);
    const vitola = norm(item.vitola);
    const shape = norm(item.shape);
    const strength = norm(item.strength);

    detailBody.innerHTML = `
      <div class="cigar-detail-body">

        <div class="cd-headercard">
          <div style="min-width:0;">
            <div class="cd-brand">${esc(brand || "Brand")}</div>
            <div class="cd-name" title="${esc(`${line ? line + " — " : ""}${cigar}`)}">${esc(`${line ? line + " — " : ""}${cigar}`)}</div>
          </div>
          <div class="cd-h-icon">
            ${
              img
                ? `<img src="${esc(img)}" alt="" onerror="this.style.display='none';" />`
                : `<div style="font-weight:800;font-size:11px;color:rgba(15,26,44,.55);padding:8px;text-align:center;line-height:1.1;">Image<br/>coming<br/>soon</div>`
            }
          </div>
        </div>

        <div class="cd-main">
          <div class="cd-img">
            ${
              img
                ? `<img class="cigar-detail-stick" src="${esc(img)}" alt="" onerror="this.style.display='none';" />`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(15,26,44,.45);font-weight:800;font-size:12px;text-align:center;padding:10px;">Image coming soon</div>`
            }
          </div>

          <div class="cd-right">
            <div class="cd-grid2">
              <div class="cd-stat">
                <div class="k">MSRP</div>
                <div class="v">${esc(msrp || "—")}</div>
              </div>
              <div class="cd-stat">
                <div class="k">RING</div>
                <div class="v">${esc(rg || "—")}</div>
              </div>
              <div class="cd-stat">
                <div class="k">LENGTH</div>
                <div class="v">${esc(length || "—")}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">VITOLA</div>
                <div class="v">${esc(vitola || "—")}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">SHAPE</div>
                <div class="v">${esc(shape || "—")}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">STRENGTH</div>
                <div class="v">${esc(strength || "—")}</div>
              </div>
            </div>

            <div class="cd-block">
              ${wrapper ? `<div class="cd-kv"><div class="k">WRAPPER</div><div class="v">${esc(wrapper)}</div></div>` : ""}
              ${binder ? `<div class="cd-kv"><div class="k">BINDER</div><div class="v">${esc(binder)}</div></div>` : ""}
              ${filler ? `<div class="cd-kv"><div class="k">FILLER</div><div class="v">${esc(filler)}</div></div>` : ""}
              ${origin ? `<div class="cd-kv"><div class="k">ORIGIN</div><div class="v">${esc(origin)}</div></div>` : ""}
            </div>

            <div class="cd-actions">
              <button class="cd-btn" type="button" id="cdAddBtn">ADD</button>
              <button class="cd-btn" type="button" disabled>EDIT</button>
              <button class="cd-btn" type="button" disabled>COMPARE</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add button: push same payload as the row +
    const addBtn = $("#cdAddBtn", detailBody);
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const payload = {
          id: item.key,
          key: item.key,
          type: "product",
          category: "Cigars",
          brand: item.brand,
          name: `${item.line ? item.line + " — " : ""}${item.cigar}${item.vitola ? " (" + item.vitola + ")" : ""}`,
          price: toPrice(item.msrp),
          qty: 1,
          img: item.img || "",
          sub: [item.origin, item.length ? `${item.length}"` : "", item.rg ? `RG ${item.rg}` : ""].filter(Boolean).join(" • "),
        };
        // cart.js capture handler will read attribute
        const fake = document.createElement("button");
        fake.setAttribute("data-receipt-item", JSON.stringify(payload));
        document.body.appendChild(fake);
        fake.click();
        fake.remove();
      });
    }

    // show overlay
    detailOverlay.classList.add("open");
    detailOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("cigar-detail-open");
  }

  function closeDetail() {
    if (!detailOverlay) return;
    detailOverlay.classList.remove("open");
    detailOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cigar-detail-open");
  }

  // ---- Sheets helpers (use existing #sheet-backdrop) ----
  function showBackdrop() {
    if (!backdropEl) return;
    backdropEl.hidden = false;
    backdropEl.classList.add("open");
  }

  function maybeHideBackdrop() {
    if (!backdropEl) return;

    const anyOpen = document.querySelector(
      '#sheet-receipt:not([hidden]), #sheet-bands:not([hidden]), #sheet-filters:not([hidden]), #cigarDetailOverlay.open, .cigar-modal.is-open'
    );

    if (!anyOpen) {
      backdropEl.hidden = true;
      backdropEl.classList.remove("open");
    } else {
      backdropEl.hidden = false;
      backdropEl.classList.add("open");
    }
  }

  function openFiltersSheet() {
    if (!sheetFilters) return;
    showBackdrop();
    sheetFilters.hidden = false;

    // simple: keep your existing UI; we just ensure it appears
    // (Your filter pills/search can be wired later; at minimum, button now works.)
  }

  // ---- Bands sheet (Padron example: show ALL band art images) ----
  let selectedLine = "";

  function openBandsSheet() {
    if (!sheetBands || !bandsOptionsEl) return;

    showBackdrop();
    sheetBands.hidden = false;

    // Build a gallery:
    // - Prefer Cigar IMG (band art)
    // - De-dupe by image URL
    const rows = state.all.filter(inBrand);

    const items = [];
    const seen = new Set();

    for (const r of rows) {
      const img = norm(getCigarImg(r));
      if (!img) continue;

      const line = norm(getLine(r));
      const cigar = norm(getCigar(r));
      const label = `${line || BRAND}${cigar ? " — " + cigar : ""}`;

      const key = `${img}`;
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({ img, line, label });
    }

    // Also support "no images"
    if (!items.length) {
      bandsOptionsEl.innerHTML = `
        <div style="padding:14px;color:rgba(15,26,44,.65);font-weight:700;">
          No band art images found for this brand.
          <div style="margin-top:8px;font-size:12px;font-weight:600;opacity:.8;">
            Add URLs to the <b>Cigar IMG</b> column to enable band art.
          </div>
        </div>
      `;
      if (bandsConfirmBtn) bandsConfirmBtn.disabled = true;
      return;
    }

    // Render selectable rows (filter by Line)
    bandsOptionsEl.innerHTML = items
      .map((it, idx) => {
        const checked = selectedLine && lower(selectedLine) === lower(it.line);
        return `
          <div class="band-row" data-band-row data-line="${esc(it.line)}">
            <div class="band-art">
              <img src="${esc(it.img)}" alt="" onerror="this.style.display='none';" />
            </div>
            <div class="band-meta">
              <div style="font-weight:800;font-size:14px;color:#0b1220;line-height:1.2;min-width:0;">
                ${esc(it.label)}
              </div>
              <input class="band-check" type="checkbox" ${checked ? "checked" : ""} aria-label="Select band" />
            </div>
          </div>
        `;
      })
      .join("");

    // Selection behavior (single-select by line)
    $$("[data-band-row]", bandsOptionsEl).forEach((rowEl) => {
      rowEl.addEventListener("click", (e) => {
        const line = rowEl.getAttribute("data-line") || "";
        selectedLine = line;

        // make it single-select: uncheck all, then check clicked
        $$("input.band-check", bandsOptionsEl).forEach((cb) => (cb.checked = false));
        const cb = $("input.band-check", rowEl);
        if (cb) cb.checked = true;

        if (bandsConfirmBtn) bandsConfirmBtn.disabled = false;

        e.preventDefault();
        e.stopPropagation();
      });
    });

    if (bandsConfirmBtn) bandsConfirmBtn.disabled = false;

    if (bandsConfirmBtn && !bandsConfirmBtn.dataset.bound) {
      bandsConfirmBtn.dataset.bound = "1";
      bandsConfirmBtn.addEventListener("click", () => {
        // apply line filter and close
        state.lineFilter = selectedLine || "";
        apply();

        sheetBands.hidden = true;
        maybeHideBackdrop();
      });
    }
  }

  // ---- wrapper toggle (optional, but stable) ----
  function setWrapperState(next) {
    state.wrapperState = next;

    if (wrapperSeg) wrapperSeg.dataset.state = next;

    if (btnMaduro) btnMaduro.setAttribute("aria-pressed", next === "maduro" ? "true" : "false");
    if (btnNatural) btnNatural.setAttribute("aria-pressed", next === "natural" ? "true" : "false");

    apply();
  }

  function bindWrapperSeg() {
    if (!wrapperSeg) return;

    // initialize
    wrapperSeg.dataset.state = wrapperSeg.dataset.state || "all";
    state.wrapperState = wrapperSeg.dataset.state;

    btnMaduro?.addEventListener("click", () => setWrapperState(state.wrapperState === "maduro" ? "all" : "maduro"));
    btnNatural?.addEventListener("click", () => setWrapperState(state.wrapperState === "natural" ? "all" : "natural"));
    btnSwitch?.addEventListener("click", () => {
      if (state.wrapperState === "maduro") setWrapperState("natural");
      else if (state.wrapperState === "natural") setWrapperState("maduro");
      else setWrapperState("maduro");
    });
  }

  // ---- Click bindings ----
  function bindRowClicks() {
    if (!listEl) return;

    // Single delegated handler (do not bind per render)
    if (listEl.dataset.bound) return;
    listEl.dataset.bound = "1";

    listEl.addEventListener("click", (e) => {
      const addBtn = e.target.closest(".row-add,[data-receipt-item]");
      if (addBtn) return; // cart.js handles adding

      const row = e.target.closest("[data-row]");
      if (!row) return;

      const item = {
        brand: norm(row.dataset.brand) || BRAND,
        line: norm(row.dataset.line),
        cigar: norm(row.dataset.cigar),
        wrapper: norm(row.dataset.wrapper),
        origin: norm(row.dataset.origin),
        length: norm(row.dataset.length),
        rg: norm(row.dataset.rg),
        msrp: norm(row.dataset.msrp),
        img: norm(row.dataset.img),
        vitola: "", // filled below from raw row match (best effort)
        shape: "",
        strength: "",
        binder: "",
        filler: "",
        key: `${slug(BRAND)}|${slug(row.dataset.line)}|${slug(row.dataset.cigar)}`,
      };

      // enrich from state.all best-effort match
      const match = state.all.find((r) => {
        if (!inBrand(r)) return false;
        return (
          lower(getLine(r)) === lower(item.line) &&
          lower(getCigar(r)) === lower(item.cigar) &&
          (item.img ? norm(getCigarImg(r)) === item.img : true)
        );
      });

      if (match) {
        item.vitola = norm(getVitola(match));
        item.shape = norm(getShape(match));
        item.strength = norm(getStrength(match));
        item.binder = norm(getBinder(match));
        item.filler = norm(getFiller(match));
      }

      openDetail(item);
    });
  }

  function bindHeaderAndButtons() {
    if (brandTitleEl) brandTitleEl.textContent = BRAND || "Brand";
    backBtn?.addEventListener("click", () => history.back());

    // Filters button
    filtersBtn?.addEventListener("click", () => {
      openFiltersSheet();
    });

    // Bands button
    bandsBtn?.addEventListener("click", () => {
      openBandsSheet();
    });

    // close detail overlay
    detailClose?.addEventListener("click", closeDetail);
    detailOverlay?.addEventListener("click", (e) => {
      // click outside sheet closes
      if (e.target === detailOverlay) closeDetail();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDetail();
    });
  }

  // ---- Brand icon ----
  function setBrandIconFromRows(rows) {
    if (!brandIconWrap) return;

    const best = rows.find((r) => norm(getBrandImg(r))) || rows.find((r) => norm(getBrandImg(r)) !== "");
    const src = best ? norm(getBrandImg(best)) : "";

    if (src) {
      brandIconWrap.innerHTML = `<img src="${esc(src)}" alt="" onerror="this.style.display='none';" />`;
    } else {
      // leave as empty placeholder (your CSS gives a nice glass tile)
      brandIconWrap.innerHTML = "";
    }
  }

  async function boot() {
    bindHeaderAndButtons();
    bindWrapperSeg();
    bindRowClicks();

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Loading…";
    }

    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();
      state.all = csvToObjects(text);

      // set brand icon from first matching brand rows
      const brandRows = state.all.filter(inBrand);
      setBrandIconFromRows(brandRows);

      // search input
      searchEl?.addEventListener("input", () => {
        state.q = norm(searchEl.value || "");
        apply();
      });

      apply();

      if (statusEl) statusEl.hidden = true;
    } catch (e) {
      console.error(e);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Failed to load cigars.";
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
