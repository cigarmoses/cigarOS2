/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   Fixes included:
   ✅ Correct cigar row format (brand-row contract)
   ✅ Click cigar name/row -> cigar detail popup
   ✅ Green + uses [data-receipt-item] so cart.js adds 1 to invoice
   ✅ Filters button opens and filters list
   ✅ Bands button opens and shows band art for THIS brand (Padron scoped)

   NOTE:
   - This file is self-contained and defensive.
   - It injects its own modal + bottom-sheet UI so it works even if markup changed.
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  const brand = String(qp("brand") || "").trim();
  const brandKey = brand.toLowerCase().replace(/[^a-z0-9]+/g, "");

  const brandTitleEl = $("#brand-title");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const backBtn = $("#brand-back") || $(".pos-back");

  // Find Bands / Filters buttons even if IDs drifted
  function findButtonByText(txt) {
    const t = txt.toLowerCase();
    return $$("button, a").find((el) => (el.textContent || "").trim().toLowerCase() === t) || null;
  }

  const bandsBtn =
    $("#brand-band") ||
    $("#band-btn") ||
    $('[data-action="open-band"]') ||
    $('[data-open="band"]') ||
    findButtonByText("bands") ||
    findButtonByText("band");

  const filtersBtn =
    $("#brand-filters") ||
    $("#filters-btn") ||
    $('[data-action="open-filters"]') ||
    $('[data-open="filters"]') ||
    findButtonByText("filters") ||
    findButtonByText("filter");

  // ---------- helpers ----------
  const norm = (s) => String(s ?? "").trim();
  const lower = (s) => norm(s).toLowerCase();
  const slug = (s) => lower(s).replace(/[^a-z0-9]+/g, "").trim();

  function escapeHtml(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

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
    for (const k of keys) {
      if (r[k] != null && norm(r[k]) !== "") return r[k];
    }
    const map = Object.keys(r);
    for (const want of keys) {
      const hit = map.find((h) => lower(h) === lower(want));
      if (hit && norm(r[hit]) !== "") return r[hit];
    }
    return "";
  }

  function getBrand(r) {
    return pick(r, ["Brand", "brand", "Manufacturer", "maker"]);
  }
  function getLine(r) {
    return pick(r, ["Line", "line", "Collection", "Series"]);
  }
  function getCigar(r) {
    return pick(r, ["Cigar", "cigar", "Name", "Cigar Name"]);
  }
  function getWrapper(r) {
    return pick(r, ["Wrapper", "wrapper", "Wrapper Type", "Wrapper Shade"]);
  }
  function getBinder(r) {
    return pick(r, ["Binder", "binder"]);
  }
  function getFiller(r) {
    return pick(r, ["Filler", "filler"]);
  }
  function getOrigin(r) {
    return pick(r, ["Origin", "origin", "Country", "Country of Origin"]);
  }
  function getRing(r) {
    return pick(r, ["Ring", "ring", "RG", "Ring Gauge"]);
  }
  function getLength(r) {
    return pick(r, ["Length", "length"]);
  }
  function getMSRP(r) {
    return pick(r, ["MSRP", "msrp", "Price", "price"]);
  }
  function getImage(r) {
    return pick(r, ["Image", "image", "Photo", "photo", "Img", "img"]);
  }

  function parsePrice(val) {
    const s = String(val ?? "");
    const n = Number(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  // ---------- Modal (same as Favorites) ----------
  function ensureModalCSS() {
    if ($("#brand-modal-css")) return;
    const style = document.createElement("style");
    style.id = "brand-modal-css";
    style.textContent = `
      .cigar-modal-backdrop{
        position:fixed; inset:0;
        background:rgba(0,0,0,.35);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        opacity:0; pointer-events:none;
        transition: opacity .18s ease;
        z-index: 9998;
      }
      .cigar-modal{
        position:fixed;
        left:12px; right:12px;
        top:12vh;
        max-width: 920px;
        margin: 0 auto;
        background:#fff;
        border-radius: 22px;
        box-shadow: 0 30px 80px rgba(0,0,0,.22);
        transform: translateY(12px) scale(.98);
        opacity:0; pointer-events:none;
        transition: transform .18s ease, opacity .18s ease;
        z-index: 9999;
        overflow:hidden;
      }
      .cigar-modal.is-open{ opacity:1; pointer-events:auto; transform: translateY(0) scale(1); }
      .cigar-modal-backdrop.is-open{ opacity:1; pointer-events:auto; }

      .cigar-modal-head{
        padding: 14px 16px 10px;
        display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
        border-bottom: 1px solid rgba(15,26,44,.08);
      }
      .cigar-modal-title{
        font-weight: 900;
        letter-spacing: -0.02em;
        color:#0f1a2c;
        font-size: 18px;
        line-height: 1.15;
      }
      .cigar-modal-sub{
        margin-top:6px;
        color: rgba(15,26,44,.62);
        font-size: 13px;
        font-weight: 650;
      }
      .cigar-modal-close{
        width: 34px; height: 34px;
        border-radius: 999px;
        border: none;
        background:#f3f5f8;
        font-size: 18px;
        font-weight: 900;
        color:#0f1a2c;
        cursor:pointer;
        flex: 0 0 auto;
      }
      .cigar-modal-body{
        display:flex;
        gap: 14px;
        padding: 14px 16px 16px;
      }
      .cigar-modal-img{
        width: 132px;
        flex: 0 0 auto;
        border-radius: 16px;
        background:#f3f5f8;
        border: 1px solid rgba(15,26,44,.08);
        overflow:hidden;
        display:flex;
        align-items:center;
        justify-content:center;
      }
      .cigar-modal-img img{ display:block; width:100%; height:auto; }
      .cigar-modal-img .img-ph{
        padding: 16px 10px;
        text-align:center;
        color: rgba(15,26,44,.55);
        font-size: 12px;
        font-weight: 800;
        line-height: 1.25;
      }

      .cigar-modal-grid{
        flex: 1 1 auto;
        min-width:0;
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 14px;
      }
      .cigar-field{ min-width:0; }
      .cigar-label{
        color: rgba(15,26,44,.55);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .02em;
        text-transform: uppercase;
      }
      .cigar-value{
        margin-top:4px;
        color:#0f1a2c;
        font-size: 14px;
        font-weight: 850;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .cigar-modal-actions{
        padding: 12px 16px 16px;
        border-top: 1px solid rgba(15,26,44,.08);
        display:flex;
        gap: 10px;
      }
      .cigar-btn{
        flex: 1 1 auto;
        height: 46px;
        border-radius: 14px;
        border: none;
        font-weight: 900;
        font-size: 16px;
        cursor:pointer;
      }
      .cigar-btn.primary{ background:#34c759; color:#fff; }
      .cigar-btn.ghost{ background:#f3f5f8; color:#0f1a2c; }
    `;
    document.head.appendChild(style);
  }

  function ensureModalDOM() {
    ensureModalCSS();
    if ($("#cigar-modal")) return;

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

  let modalCurrentItem = null;

  function buildReceiptItem(rowObj) {
    const key = `${slug(rowObj.brand)}|${slug(rowObj.line)}|${slug(rowObj.cigar)}` || slug(rowObj.cigar);
    return {
      key,
      category: "Cigars",
      name: rowObj.displayName,
      price: rowObj.priceNumber,
      qty: 1,
      meta: {
        brand: rowObj.brand,
        line: rowObj.line,
        cigar: rowObj.cigar,
        length: rowObj.length,
        ring: rowObj.ring,
      },
    };
  }

  function openModal(item) {
    ensureModalDOM();
    modalCurrentItem = item;

    const title = `${item.line ? item.line + " — " : ""}${item.cigar || "Cigar"}`;
    $("#cigar-modal-title").textContent = title;
    $("#cigar-modal-sub").textContent = item.brand || "";

    const imgWrap = $("#cigar-modal-img");
    if (item.image) {
      imgWrap.innerHTML = `<img src="${item.image}" alt="" onerror="this.remove(); this.parentElement.innerHTML='<div class=img-ph>Image coming soon</div>'" />`;
    } else {
      imgWrap.innerHTML = `<div class="img-ph">Image coming soon</div>`;
    }

    const grid = $("#cigar-modal-grid");
    const fields = [
      ["Wrapper", item.wrapper],
      ["Binder", item.binder],
      ["Filler", item.filler],
      ["Origin", item.origin],
      ["Length", item.length ? `${item.length}"` : ""],
      ["Ring", item.ring ? `RG ${item.ring}` : ""],
      ["MSRP", item.msrp],
    ];

    grid.innerHTML = fields
      .filter(([, v]) => norm(v) !== "")
      .map(
        ([k, v]) => `
          <div class="cigar-field">
            <div class="cigar-label">${escapeHtml(k)}</div>
            <div class="cigar-value" title="${escapeHtml(v)}">${escapeHtml(v)}</div>
          </div>
        `
      )
      .join("");

    $("#cigar-modal-backdrop").classList.add("is-open");
    $("#cigar-modal").classList.add("is-open");

    $("#cigar-modal-add").onclick = () => {
      if (!modalCurrentItem) return;
      const fake = document.createElement("button");
      fake.setAttribute("data-receipt-item", JSON.stringify(modalCurrentItem.receiptItem));
      document.body.appendChild(fake);
      fake.click();
      fake.remove();
      closeModal();
    };
  }

  function closeModal() {
    const b = $("#cigar-modal-backdrop");
    const m = $("#cigar-modal");
    if (!b || !m) return;
    b.classList.remove("is-open");
    m.classList.remove("is-open");
    modalCurrentItem = null;
  }

  // ---------- Bottom sheet (Filters + Bands) ----------
  function ensureSheet() {
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
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div id="pos-sheet-title" style="font-weight:900; font-size:20px; letter-spacing:-0.02em; color:#0f1a2c;">Sheet</div>
        <button id="pos-sheet-close" type="button" aria-label="Close"
          style="width:34px; height:34px; border-radius:999px; border:none; background:#f3f5f8; font-size:18px; font-weight:900; color:#0f1a2c; cursor:pointer;">×</button>
      </div>
      <div id="pos-sheet-body" style="margin-top:10px; overflow:auto; padding-bottom:12px;"></div>
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

  // ---------- Data + Filters ----------
  const state = {
    all: [],
    view: [],
    q: "",
    ringMin: null,
    ringMax: null,
    lenMin: null,
    lenMax: null,
    band: null, // selected band/line token (Padron 1926/1964/Damaso etc.)
  };

  function num(x) {
    const n = Number(String(x ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function inBrand(r) {
    return slug(getBrand(r)) === slug(brand);
  }

  function passBand(r) {
    if (!state.band) return true;
    const token = lower(state.band);
    const blob = `${getLine(r)} ${getCigar(r)}`.toLowerCase();
    return blob.includes(token);
  }

  function passText(r) {
    if (!state.q) return true;
    const q = lower(state.q);
    const blob = `${getLine(r)} ${getCigar(r)} ${getWrapper(r)} ${getRing(r)} ${getLength(r)} ${getMSRP(r)}`.toLowerCase();
    return blob.includes(q);
  }

  function passNums(r) {
    const rg = num(getRing(r));
    const ln = num(getLength(r));

    if (state.ringMin != null && rg != null && rg < state.ringMin) return false;
    if (state.ringMax != null && rg != null && rg > state.ringMax) return false;
    if (state.lenMin != null && ln != null && ln < state.lenMin) return false;
    if (state.lenMax != null && ln != null && ln > state.lenMax) return false;

    return true;
  }

  function applyFilters() {
    state.view = state.all
      .filter(inBrand)
      .filter(passBand)
      .filter(passText)
      .filter(passNums);

    renderList();
  }

  function renderList() {
    if (!listEl) return;

    if (!state.view.length) {
      listEl.innerHTML = "";
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "No cigars match your selection.";
      }
      return;
    }
    if (statusEl) statusEl.hidden = true;

    listEl.innerHTML = state.view
      .map((r) => {
        const b = norm(getBrand(r));
        const l = norm(getLine(r));
        const c = norm(getCigar(r));
        const w = norm(getWrapper(r));
        const bi = norm(getBinder(r));
        const fi = norm(getFiller(r));
        const o = norm(getOrigin(r));
        const rg = norm(getRing(r));
        const ln = norm(getLength(r));
        const msrp = norm(getMSRP(r));
        const image = norm(getImage(r));

        const subBits = [w || "", ln ? `${ln}"` : "", rg ? `RG ${rg}` : ""].filter(Boolean);
        const sub = subBits.join(" • ");

        const displayName = (l && c) ? `${l} ${c}` : (c || l || "Cigar");
        const priceNumber = parsePrice(msrp);

        const receiptItem = buildReceiptItem({
          brand: b,
          line: l,
          cigar: c,
          length: ln,
          ring: rg,
          displayName,
          priceNumber,
        });

        return `
          <div class="brand-row" data-brand-row
               data-brand="${escapeHtml(b)}"
               data-line="${escapeHtml(l)}"
               data-cigar="${escapeHtml(c)}"
               data-wrapper="${escapeHtml(w)}"
               data-binder="${escapeHtml(bi)}"
               data-filler="${escapeHtml(fi)}"
               data-origin="${escapeHtml(o)}"
               data-length="${escapeHtml(ln)}"
               data-ring="${escapeHtml(rg)}"
               data-msrp="${escapeHtml(msrp)}"
               data-image="${escapeHtml(image)}">
            <div class="brand-row-left">
              <div class="brand-row-title">
                ${escapeHtml(l || b || "Cigar")}
                ${c ? `<span style="display:block; font-weight:900;">${escapeHtml(c)}</span>` : ""}
              </div>
              ${sub ? `<div class="brand-row-sub">${escapeHtml(sub)}</div>` : ``}
            </div>

            <div class="brand-row-right">
              ${msrp ? `<div class="brand-row-msrp">${escapeHtml(msrp)}</div>` : ``}
              <button type="button"
                class="pos-add"
                aria-label="Add to invoice"
                data-receipt-item='${escapeHtml(JSON.stringify(receiptItem))}'
                style="margin-left:10px; width:34px; height:34px; border-radius:999px; border:none; background:#34c759; color:#fff; font-weight:900; cursor:pointer;">
                +
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Click behavior:
  // - click + => cart.js handles
  // - click row/name => open modal
  function bindRowClicks() {
    if (!listEl) return;
    listEl.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-receipt-item]");
      if (addBtn) return;

      const row = e.target.closest("[data-brand-row]");
      if (!row) return;

      const item = {
        brand: norm(row.dataset.brand),
        line: norm(row.dataset.line),
        cigar: norm(row.dataset.cigar),
        wrapper: norm(row.dataset.wrapper),
        binder: norm(row.dataset.binder),
        filler: norm(row.dataset.filler),
        origin: norm(row.dataset.origin),
        length: norm(row.dataset.length),
        ring: norm(row.dataset.ring),
        msrp: norm(row.dataset.msrp),
        image: norm(row.dataset.image),
      };

      item.displayName = (item.line && item.cigar) ? `${item.line} ${item.cigar}` : (item.cigar || item.line || "Cigar");
      item.priceNumber = parsePrice(item.msrp);
      item.receiptItem = buildReceiptItem({
        brand: item.brand,
        line: item.line,
        cigar: item.cigar,
        length: item.length,
        ring: item.ring,
        displayName: item.displayName,
        priceNumber: item.priceNumber,
      });

      openModal(item);
    });
  }

  // ---------- Bands (Padron scoped) ----------
  function openBands() {
    const b = slug(brand);
    const knownPadron = ["1926", "1964", "damaso"];

    // Build band options from existing data first (unique lines)
    const lines = Array.from(
      new Set(
        state.all
          .filter(inBrand)
          .map((r) => norm(getLine(r)))
          .filter(Boolean)
      )
    );

    // If Padron, ensure 1926/1964/Damaso show (if present in data)
    if (b.includes("padron")) {
      for (const k of knownPadron) {
        if (!lines.some((x) => lower(x) === k)) {
          const has = state.all.filter(inBrand).some((r) => `${getLine(r)} ${getCigar(r)}`.toLowerCase().includes(k));
          if (has) lines.push(k === "damaso" ? "Damaso" : k);
        }
      }
    }

    const options = lines.length ? lines : ["All"];

    const html = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${options
          .map((label) => {
            const key = lower(label);
            const active = state.band && lower(state.band) === key;

            // Try common band art paths (only brand-scoped)
            const imgCandidates = [
              `/img/bands/${b}/${slug(label)}.svg`,
              `/img/bands/${b}/${slug(label)}.png`,
              `/img/icons/bands/${b}/${slug(label)}.svg`,
              `/img/icons/bands/${b}/${slug(label)}.png`,
            ];

            const src0 = imgCandidates[0];

            return `
              <button type="button" data-band-pick="${escapeHtml(label)}"
                style="text-align:left; border:none; background:transparent; padding:0; cursor:pointer;">
                <div style="border-radius:16px; overflow:hidden; background:#f3f5f8; border:1px solid rgba(15,26,44,.10);">
                  <img src="${src0}" alt="" style="display:block; width:100%; height:auto;"
                    onerror="
                      (function(img){
                        const tries=${escapeHtml(JSON.stringify(imgCandidates))};
                        let i=parseInt(img.getAttribute('data-try')||'0',10)||0;
                        i++;
                        if(i < tries.length){
                          img.setAttribute('data-try', String(i));
                          img.src = tries[i];
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
                <div style="margin-top:10px; display:flex; align-items:center; justify-content:space-between;">
                  <div style="font-weight:900; font-size:18px; color:#0f1a2c;">${escapeHtml(label)}</div>
                  <div style="width:24px; height:24px; border-radius:999px; border:2px solid ${active ? "#007aff" : "rgba(15,26,44,.20)"}; background:${active ? "#007aff" : "transparent"};"></div>
                </div>
              </button>
            `;
          })
          .join("")}

        <button type="button" id="band-clear"
          style="margin-top:8px; width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
          background:#fff; font-weight:900; font-size:16px; color:#0f1a2c; cursor:pointer;">Clear</button>
      </div>
    `;

    openSheet("Bands", html);

    $$("[data-band-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-band-pick");
        state.band = v && lower(v) !== "all" ? v : null;
        closeSheet();
        applyFilters();
      });
    });

    $("#band-clear")?.addEventListener("click", () => {
      state.band = null;
      closeSheet();
      applyFilters();
    });
  }

  // ---------- Filters ----------
  function openFilters() {
    const html = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <div style="font-weight:900; color:#0f1a2c; margin-bottom:8px;">Search</div>
          <input id="f-q" type="text" value="${escapeHtml(state.q)}" placeholder="Search cigars…"
            style="width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
            padding:0 14px; font-size:16px; outline:none;" />
        </div>

        <div style="display:flex; gap:12px;">
          <div style="flex:1;">
            <div style="font-weight:900; color:#0f1a2c; margin-bottom:8px;">Ring min</div>
            <input id="f-rmin" inputmode="numeric" placeholder="min"
              style="width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              padding:0 14px; font-size:16px; outline:none;" />
          </div>
          <div style="flex:1;">
            <div style="font-weight:900; color:#0f1a2c; margin-bottom:8px;">Ring max</div>
            <input id="f-rmax" inputmode="numeric" placeholder="max"
              style="width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              padding:0 14px; font-size:16px; outline:none;" />
          </div>
        </div>

        <div style="display:flex; gap:12px;">
          <div style="flex:1;">
            <div style="font-weight:900; color:#0f1a2c; margin-bottom:8px;">Length min</div>
            <input id="f-lmin" inputmode="decimal" placeholder="min"
              style="width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              padding:0 14px; font-size:16px; outline:none;" />
          </div>
          <div style="flex:1;">
            <div style="font-weight:900; color:#0f1a2c; margin-bottom:8px;">Length max</div>
            <input id="f-lmax" inputmode="decimal" placeholder="max"
              style="width:100%; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              padding:0 14px; font-size:16px; outline:none;" />
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button id="f-clear" type="button"
            style="flex:1; height:46px; border-radius:14px; border:1px solid rgba(15,26,44,.14);
              background:#fff; font-weight:900; font-size:16px; color:#0f1a2c; cursor:pointer;">Clear</button>
          <button id="f-apply" type="button"
            style="flex:1; height:46px; border-radius:14px; border:none;
              background:#007aff; font-weight:900; font-size:16px; color:#fff; cursor:pointer;">Apply</button>
        </div>
      </div>
    `;

    openSheet("Filters", html);

    const apply = () => {
      state.q = norm($("#f-q")?.value || "");
      state.ringMin = num($("#f-rmin")?.value || "");
      state.ringMax = num($("#f-rmax")?.value || "");
      state.lenMin = num($("#f-lmin")?.value || "");
      state.lenMax = num($("#f-lmax")?.value || "");
      closeSheet();
      applyFilters();
    };

    const clear = () => {
      state.q = "";
      state.ringMin = null;
      state.ringMax = null;
      state.lenMin = null;
      state.lenMax = null;
      closeSheet();
      applyFilters();
    };

    $("#f-apply")?.addEventListener("click", apply);
    $("#f-clear")?.addEventListener("click", clear);
    $("#f-q")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
    });
  }

  // ---------- Boot ----------
  async function boot() {
    if (brandTitleEl) brandTitleEl.textContent = brand || "Brand";
    backBtn?.addEventListener("click", () => history.back());

    bindRowClicks();

    // Wire buttons
    bandsBtn?.addEventListener("click", openBands);
    filtersBtn?.addEventListener("click", openFilters);

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Loading…";
    }

    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();
      state.all = csvToObjects(text);

      applyFilters();

      if (statusEl) statusEl.hidden = true;
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Failed to load cigars.";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
