   /* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   FIXES:
   ✅ Correct row DOM: left stack + right MSRP/+ (no "Maduro 29.25" inline)
   ✅ Click row opens cigar detail modal (built-in modal here)
   ✅ Green + adds to invoice via data-receipt-item
   ✅ Filters button works
   ✅ Bands button works (scoped to current brand)

   ✅ NEW (requested - ONLY):
   1) Row subtitle line = Vitola ONLY (from "Vitola" column)
   2) Left icon = Brand icon from /img/icons/brands/(brand).svg (e.g. /img/icons/brands/padron.svg)
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
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
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");
  const backBtn = $("#brand-back") || $(".pos-back");

  function findBtnByText(txt) {
    const t = lower(txt);
    return (
      $$("button, a")
        .filter((el) => el && norm(el.textContent))
        .find((el) => lower(el.textContent) === t) || null
    );
  }

  const filtersBtn =
    $("#brand-filters") ||
    $("#filters-btn") ||
    $('[data-action="open-filters"]') ||
    $('[data-open="filters"]') ||
    findBtnByText("filters");

  const bandsBtn =
    $("#brand-band") ||
    $("#band-btn") ||
    $('[data-action="open-band"]') ||
    $('[data-open="band"]') ||
    findBtnByText("bands");

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

  const getBrand = (r) => pick(r, ["Brand", "Manufacturer"]);
  const getLine = (r) => pick(r, ["Line", "Series", "Collection"]);
  const getCigar = (r) => pick(r, ["Cigar", "Name", "Cigar Name"]);
  const getVitola = (r) => pick(r, ["Vitola"]); // ✅ NEW: used for the subtitle line
  const getWrapper = (r) => pick(r, ["Wrapper", "Wrapper Type", "Wrapper Shade"]);
  const getBinder = (r) => pick(r, ["Binder"]);
  const getFiller = (r) => pick(r, ["Filler"]);
  const getOrigin = (r) => pick(r, ["Origin", "Country", "Country of Origin"]);
  const getRing = (r) => pick(r, ["Ring", "Ring Gauge", "RG"]);
  const getLength = (r) => pick(r, ["Length"]);
  const getMSRP = (r) => pick(r, ["MSRP", "Price"]);
  const getImage = (r) => pick(r, ["Image", "Img", "Photo"]);

  const priceNum = (x) => {
    const n = Number(String(x ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  // ---- invoice payload (cart.js listens for data-receipt-item) ----
  function buildReceiptItem({ brand, line, cigar, msrp }) {
    const key = `${slug(brand)}|${slug(line)}|${slug(cigar)}`;
    return {
      key,
      category: "Cigars",
      name: `${line ? line + " — " : ""}${cigar}`,
      price: priceNum(msrp),
      qty: 1,
      meta: { brand, line, cigar },
    };
  }

  // ---- modal (unchanged) ----
  function ensureModal() {
    if ($("#cigar-modal")) return;

    const style = document.createElement("style");
    style.textContent = `
      .cigar-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .18s ease;z-index:9998}
      .cigar-modal{position:fixed;left:12px;right:12px;top:12vh;max-width:920px;margin:0 auto;background:#fff;border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.22);transform:translateY(12px) scale(.98);opacity:0;pointer-events:none;transition:transform .18s ease,opacity .18s ease;z-index:9999;overflow:hidden}
      .cigar-modal.is-open{opacity:1;pointer-events:auto;transform:translateY(0) scale(1)}
      .cigar-modal-backdrop.is-open{opacity:1;pointer-events:auto}
      .cigar-modal-head{padding:14px 16px 10px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(15,26,44,.08)}
      .cigar-modal-title{font-weight:900;letter-spacing:-.02em;color:#0f1a2c;font-size:18px;line-height:1.15}
      .cigar-modal-sub{margin-top:6px;color:rgba(15,26,44,.62);font-size:13px;font-weight:650}
      .cigar-modal-close{width:34px;height:34px;border-radius:999px;border:none;background:#f3f5f8;font-size:18px;font-weight:900;color:#0f1a2c;cursor:pointer;flex:0 0 auto}
      .cigar-modal-body{display:flex;gap:14px;padding:14px 16px 16px}
      .cigar-modal-img{width:132px;flex:0 0 auto;border-radius:16px;background:#f3f5f8;border:1px solid rgba(15,26,44,.08);overflow:hidden;display:flex;align-items:center;justify-content:center}
      .cigar-modal-img img{display:block;width:100%;height:auto}
      .cigar-modal-img .img-ph{padding:16px 10px;text-align:center;color:rgba(15,26,44,.55);font-size:12px;font-weight:800;line-height:1.25}
      .cigar-modal-grid{flex:1 1 auto;min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}
      .cigar-field{min-width:0}
      .cigar-label{color:rgba(15,26,44,.55);font-size:11px;font-weight:800;letter-spacing:.02em;text-transform:uppercase}
      .cigar-value{margin-top:4px;color:#0f1a2c;font-size:14px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cigar-modal-actions{padding:12px 16px 16px;border-top:1px solid rgba(15,26,44,.08);display:flex;gap:10px}
      .cigar-btn{flex:1 1 auto;height:46px;border-radius:14px;border:none;font-weight:900;font-size:16px;cursor:pointer}
      .cigar-btn.primary{background:#34c759;color:#fff}
      .cigar-btn.ghost{background:#f3f5f8;color:#0f1a2c}
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement("div");
    backdrop.className = "cigar-modal-backdrop";
    backdrop.id = "cigar-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "cigar-modal";
    modal.id = "cigar-modal";
    modal.innerHTML = `
      <div class="cigar-modal-head">
        <div style="min-width:0;">
          <div class="cigar-modal-title" id="cigar-modal-title"></div>
          <div class="cigar-modal-sub" id="cigar-modal-sub"></div>
        </div>
        <button class="cigar-modal-close" id="cigar-modal-close" aria-label="Close">×</button>
      </div>
      <div class="cigar-modal-body">
        <div class="cigar-modal-img" id="cigar-modal-img"></div>
        <div class="cigar-modal-grid" id="cigar-modal-grid"></div>
      </div>
      <div class="cigar-modal-actions">
        <button class="cigar-btn ghost" id="cigar-modal-close2" type="button">Close</button>
        <button class="cigar-btn primary" id="cigar-modal-add" type="button">Add to invoice</button>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    const close = () => closeModal();
    $("#cigar-modal-close").addEventListener("click", close);
    $("#cigar-modal-close2").addEventListener("click", close);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  let modalItem = null;

  function openModal(item) {
    ensureModal();
    modalItem = item;

    $("#cigar-modal-title").textContent = `${item.line ? item.line + " — " : ""}${item.cigar}`;
    $("#cigar-modal-sub").textContent = item.brand;

    const imgWrap = $("#cigar-modal-img");
    if (item.image) {
      imgWrap.innerHTML = `<img src="${item.image}" alt=""
        onerror="this.remove(); this.parentElement.innerHTML='<div class=img-ph>Image coming soon</div>'" />`;
    } else {
      imgWrap.innerHTML = `<div class="img-ph">Image coming soon</div>`;
    }

    const fields = [
      ["WRAPPER", item.wrapper],
      ["BINDER", item.binder],
      ["FILLER", item.filler],
      ["ORIGIN", item.origin],
      ["LENGTH", item.length ? `${item.length}"` : ""],
      ["RING", item.ring ? `RG ${item.ring}` : ""],
      ["MSRP", item.msrp],
    ].filter(([, v]) => norm(v));

    $("#cigar-modal-grid").innerHTML = fields
      .map(
        ([k, v]) => `
        <div class="cigar-field">
          <div class="cigar-label">${esc(k)}</div>
          <div class="cigar-value" title="${esc(v)}">${esc(v)}</div>
        </div>`
      )
      .join("");

    $("#cigar-modal-backdrop").classList.add("is-open");
    $("#cigar-modal").classList.add("is-open");

    $("#cigar-modal-add").onclick = () => {
      if (!modalItem) return;
      const btn = document.createElement("button");
      btn.setAttribute("data-receipt-item", JSON.stringify(modalItem.receiptItem));
      document.body.appendChild(btn);
      btn.click();
      btn.remove();
      closeModal();
    };
  }

  function closeModal() {
    const b = $("#cigar-modal-backdrop");
    const m = $("#cigar-modal");
    if (!b || !m) return;
    b.classList.remove("is-open");
    m.classList.remove("is-open");
    modalItem = null;
  }

  // ---- bottom sheets (unchanged) ----
  function ensureSheet() {
    if ($("#pos-sheet")) return;

    const backdrop = document.createElement("div");
    backdrop.id = "pos-sheet-backdrop";
    backdrop.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:opacity .18s ease;z-index:9998";

    const sheet = document.createElement("div");
    sheet.id = "pos-sheet";
    sheet.style.cssText =
      "position:fixed;left:0;right:0;bottom:-8px;transform:translateY(100%);transition:transform .22s ease;background:#fff;border-top-left-radius:20px;border-top-right-radius:20px;box-shadow:0 -20px 50px rgba(0,0,0,.18);z-index:9999;max-height:80vh;display:flex;flex-direction:column;padding:14px 14px 10px";

    sheet.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div id="pos-sheet-title" style="font-weight:900;font-size:20px;letter-spacing:-0.02em;color:#0f1a2c;"></div>
        <button id="pos-sheet-close" type="button" aria-label="Close"
          style="width:34px;height:34px;border-radius:999px;border:none;background:#f3f5f8;font-size:18px;font-weight:900;color:#0f1a2c;cursor:pointer;">×</button>
      </div>
      <div id="pos-sheet-body" style="margin-top:10px;overflow:auto;padding-bottom:12px;"></div>
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

  function openSheet(title, html) {
    ensureSheet();
    $("#pos-sheet-title").textContent = title;
    $("#pos-sheet-body").innerHTML = html;
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

  // ---- state ----
  const state = { all: [], view: [], q: "", band: "" };

  function inBrand(r) {
    if (!BRAND) return true;
    return slug(getBrand(r)) === BRAND_SLUG;
  }

  function apply() {
    const q = lower(state.q);
    state.view = state.all
      .filter(inBrand)
      .filter((r) => {
        if (!state.band) return true;
        const blob = `${getLine(r)} ${getCigar(r)}`.toLowerCase();
        return blob.includes(lower(state.band));
      })
      .filter((r) => {
        if (!q) return true;
        const blob = `${getLine(r)} ${getCigar(r)} ${getWrapper(r)} ${getOrigin(r)} ${getRing(r)} ${getLength(r)} ${getMSRP(r)}`.toLowerCase();
        return blob.includes(q);
      });

    render();
  }

  // ---- render rows (ONLY TWO CHANGES INSIDE) ----
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
        const brand = norm(getBrand(r));
        const line = norm(getLine(r));
        const cigar = norm(getCigar(r));
        const vitola = norm(getVitola(r)); // ✅ NEW
        const wrapper = norm(getWrapper(r));
        const binder = norm(getBinder(r));
        const filler = norm(getFiller(r));
        const origin = norm(getOrigin(r));
        const ring = norm(getRing(r));
        const length = norm(getLength(r));
        const msrp = norm(getMSRP(r));
        const image = norm(getImage(r));

        const receiptItem = buildReceiptItem({ brand, line, cigar, msrp });

        // ✅ NEW: brand icon path from /img/icons/brands/(brand).svg
        const brandIconSrc = `/img/icons/brands/${slug(brand || BRAND)}.svg`;

        return `
          <div class="brand-row"
            data-row
            data-brand="${esc(brand)}"
            data-line="${esc(line)}"
            data-cigar="${esc(cigar)}"
            data-wrapper="${esc(wrapper)}"
            data-binder="${esc(binder)}"
            data-filler="${esc(filler)}"
            data-origin="${esc(origin)}"
            data-ring="${esc(ring)}"
            data-length="${esc(length)}"
            data-msrp="${esc(msrp)}"
            data-image="${esc(image)}">

            <!-- ✅ NEW: left brand icon (uses existing .row-ico styling in brand.css) -->
            <img class="row-ico" alt="" src="${esc(brandIconSrc)}"
                 onerror="this.style.visibility='hidden';" />

            <div class="brand-row-left">
              <div class="brand-row-title">
                <div>${esc(line || brand)}</div>
                <div>${esc(cigar)}</div>

              </div>

               <div class="brand-row-sub">
              <div>${esc(vitola)}</div>
               </div>
            </div>

            <div class="brand-row-right">
              <div class="brand-row-msrp">${esc(msrp)}</div>
              <button type="button"
                class="pos-add"
                aria-label="Add to invoice"
                data-receipt-item='${esc(JSON.stringify(receiptItem))}'>+</button>
            </div>

          </div>
        `;
      })
      .join("");
  }

  // row click -> modal (but ignore + button)
  function bindClicks() {
    if (!listEl) return;
    listEl.addEventListener("click", (e) => {
      const add = e.target.closest("[data-receipt-item]");
      if (add) return; // let cart.js handle

      const row = e.target.closest("[data-row]");
      if (!row) return;

      const item = {
        brand: norm(row.dataset.brand),
        line: norm(row.dataset.line),
        cigar: norm(row.dataset.cigar),
        wrapper: norm(row.dataset.wrapper),
        binder: norm(row.dataset.binder),
        filler: norm(row.dataset.filler),
        origin: norm(row.dataset.origin),
        ring: norm(row.dataset.ring),
        length: norm(row.dataset.length),
        msrp: norm(row.dataset.msrp),
        image: norm(row.dataset.image),
      };
      item.receiptItem = buildReceiptItem({
        brand: item.brand,
        line: item.line,
        cigar: item.cigar,
        msrp: item.msrp,
      });

      openModal(item);
    });
  }

  function openFilters() {
    openSheet(
      "Filters",
      `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <div style="font-weight:900;color:#0f1a2c;margin-bottom:8px;">Search</div>
          <input id="f-q" type="text" value="${esc(state.q)}" placeholder="Search…"
            style="width:100%;height:46px;border-radius:14px;border:1px solid rgba(15,26,44,.14);padding:0 14px;font-size:16px;outline:none;" />
        </div>
        <div style="display:flex;gap:10px;">
          <button id="f-clear" type="button"
            style="flex:1;height:46px;border-radius:14px;border:1px solid rgba(15,26,44,.14);background:#fff;font-weight:900;font-size:16px;color:#0f1a2c;cursor:pointer;">Clear</button>
          <button id="f-apply" type="button"
            style="flex:1;height:46px;border-radius:14px;border:none;background:#007aff;font-weight:900;font-size:16px;color:#fff;cursor:pointer;">Apply</button>
        </div>
      </div>
    `
    );

    const applyNow = () => {
      state.q = norm($("#f-q")?.value || "");
      closeSheet();
      apply();
    };
    const clearNow = () => {
      state.q = "";
      closeSheet();
      apply();
    };

    $("#f-apply")?.addEventListener("click", applyNow);
    $("#f-clear")?.addEventListener("click", clearNow);
    $("#f-q")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyNow();
    });
  }

  function openBands() {
    // build unique line list for this brand
    let lines = Array.from(new Set(state.all.filter(inBrand).map((r) => norm(getLine(r))).filter(Boolean)));
    if (!lines.length) lines = ["All"];

    openSheet(
      "Bands",
      `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${lines
          .map((l) => {
            const active = lower(state.band) === lower(l);
            return `
              <button type="button" data-band="${esc(l)}"
                style="text-align:left;border:1px solid rgba(15,26,44,.12);background:#fff;border-radius:14px;padding:14px;font-weight:900;font-size:16px;color:#0f1a2c;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                <span>${esc(l)}</span>
                <span style="width:18px;height:18px;border-radius:999px;border:2px solid ${active ? "#007aff" : "rgba(15,26,44,.18)"};background:${active ? "#007aff" : "transparent"};"></span>
              </button>
            `;
          })
          .join("")}
        <button id="b-clear" type="button"
          style="margin-top:6px;height:46px;border-radius:14px;border:1px solid rgba(15,26,44,.14);background:#fff;font-weight:900;font-size:16px;color:#0f1a2c;cursor:pointer;">
          Clear
        </button>
      </div>
    `
    );

    $$("[data-band]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-band") || "";
        state.band = lower(v) === "all" ? "" : v;
        closeSheet();
        apply();
      });
    });

    $("#b-clear")?.addEventListener("click", () => {
      state.band = "";
      closeSheet();
      apply();
    });
  }

  async function boot() {
    if (brandTitleEl) brandTitleEl.textContent = BRAND || "Brand";
    backBtn?.addEventListener("click", () => history.back());

    bindClicks();

    // wire search input (if present)
    searchEl?.addEventListener("input", () => {
      state.q = norm(searchEl.value || "");
      apply();
    });

    // wire buttons
    filtersBtn?.addEventListener("click", openFilters);
    bandsBtn?.addEventListener("click", openBands);

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Loading…";
    }

    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();
      state.all = csvToObjects(text);
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
