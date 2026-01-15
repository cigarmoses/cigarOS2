/* /pos/cigars/favorites.js
   Favorites (CIGARS ONLY) — Store-wide favorites driven by Hub column "Favorite" = X/x

   Requirements satisfied:
   ✅ Favorites shows ONLY cigars where Favorite cell is X/x
   ✅ Uses the SAME row structure/flow as brand POS rows:
      - Click cigar name/line area -> opens cigar detail popup
      - Click green + -> adds 1 to invoice via shared cart.js interception on [data-receipt-item]
   ✅ No localStorage favorites. Source-of-truth = Hub sheet only.
   ✅ Defensive against column name drift.
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const listEl = $("#fav-cigars-list");
  const brandsGrid = $("#fav-brands-grid"); // we will intentionally leave this empty per your instruction
  const statusEl = $("#fav-status");
  const backBtn = $("#fav-back");

  // ---- helpers ----
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

  // CSV parser (simple + safe for quoted commas)
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

  // Column pickers (supports sheet drift)
  function pick(r, keys) {
    for (const k of keys) {
      if (r[k] != null && norm(r[k]) !== "") return r[k];
    }
    // fallback: case-insensitive header matching
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
    return pick(r, ["Wrapper", "wrapper", "Wrapper Type", "Wrapper Shade", "Wrapper Shade/Type"]);
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
  function getFavorite(r) {
    return pick(r, ["Favorite", "favorite", "Fav", "fav"]);
  }
  function getImage(r) {
    return pick(r, ["Image", "image", "Photo", "photo", "Img", "img"]);
  }

  function isFavRow(r) {
    return lower(getFavorite(r)) === "x";
  }

  function parsePrice(val) {
    const s = String(val ?? "");
    const n = Number(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  // ---- Inject minimal modal CSS (so Favorites can open the same style popup) ----
  function ensureModalCSS() {
    if ($("#fav-modal-css")) return;
    const style = document.createElement("style");
    style.id = "fav-modal-css";
    style.textContent = `
      /* Favorites cigar modal (matches brand POS modal feel) */
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
      .cigar-modal-img img{
        display:block;
        width:100%;
        height:auto;
      }
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
      .cigar-field{
        min-width:0;
      }
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

  function openModal(item) {
    ensureModalDOM();
    modalCurrentItem = item;

    const title = `${item.line ? item.line + " — " : ""}${item.cigar || "Cigar"}`;
    $("#cigar-modal-title").textContent = title;
    $("#cigar-modal-sub").textContent = item.brand || "";

    const imgWrap = $("#cigar-modal-img");
    const imgSrc = item.image;

    if (imgSrc) {
      imgWrap.innerHTML = `<img src="${imgSrc}" alt="" onerror="this.remove(); this.parentElement.innerHTML='<div class=img-ph>Image coming soon</div>'" />`;
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

    const backdrop = $("#cigar-modal-backdrop");
    const modal = $("#cigar-modal");
    backdrop.classList.add("is-open");
    modal.classList.add("is-open");

    // Add button uses the same cart interception contract as the green +
    $("#cigar-modal-add").onclick = () => {
      if (!modalCurrentItem) return;
      // programmatically trigger a click on a synthetic element with data-receipt-item
      const fake = document.createElement("button");
      fake.setAttribute("data-receipt-item", JSON.stringify(modalCurrentItem.receiptItem));
      document.body.appendChild(fake);
      fake.click();
      fake.remove();
      closeModal();
    };
  }

  function closeModal() {
    const backdrop = $("#cigar-modal-backdrop");
    const modal = $("#cigar-modal");
    if (!backdrop || !modal) return;
    backdrop.classList.remove("is-open");
    modal.classList.remove("is-open");
    modalCurrentItem = null;
  }

  // ---- Render: EXACT row behavior contract ----
  function buildReceiptItem(rowObj) {
    // Cart system: expects [data-receipt-item]. Provide rich payload + fallback fields.
    // Keep stable key so duplicates match properly.
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

  function rowDisplayName(brand, line, cigar) {
    // Your preference: 2-line row (Line + Cigar) like brand page
    // Keep dedupe clean:
    const l = norm(line);
    const c = norm(cigar);
    if (!l) return c || "";
    if (!c) return l;
    // Avoid double prefix if cigar already starts with line:
    return lower(c).startsWith(lower(l)) ? c : `${l} ${c}`;
  }

  function render(rows) {
    if (brandsGrid) {
      // You asked: leave brands out completely for now
      brandsGrid.innerHTML = "";
      brandsGrid.style.display = "none";
      const brandsSection = brandsGrid.closest("section");
      if (brandsSection) brandsSection.style.display = "none";
    }

    if (!listEl) return;

    if (!rows.length) {
      listEl.innerHTML = "";
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "No favorites yet.";
      }
      return;
    }

    if (statusEl) statusEl.hidden = true;

    listEl.innerHTML = rows
      .map((r) => {
        const brand = norm(getBrand(r));
        const line = norm(getLine(r));
        const cigar = norm(getCigar(r));
        const wrapper = norm(getWrapper(r));
        const binder = norm(getBinder(r));
        const filler = norm(getFiller(r));
        const origin = norm(getOrigin(r));
        const ring = norm(getRing(r));
        const length = norm(getLength(r));
        const msrp = norm(getMSRP(r));
        const image = norm(getImage(r));

        const leftTitleTop = line || brand || "Cigar";
        const leftTitleBottom = cigar || "";
        const subBits = [
          wrapper ? wrapper : "",
          length ? `${length}"` : "",
          ring ? `RG ${ring}` : "",
        ].filter(Boolean);
        const sub = subBits.join(" • ");

        const displayName = rowDisplayName(brand, line, cigar) || cigar || "Cigar";
        const priceNumber = parsePrice(msrp);

        const receiptItem = buildReceiptItem({
          brand,
          line,
          cigar,
          length,
          ring,
          displayName,
          priceNumber,
        });

        // IMPORTANT:
        // - Click name area -> open our cigar modal (same behavior as brand page modal)
        // - Click green + -> add to invoice (cart.js listens for [data-receipt-item])
        // - Keep row structure consistent with brand-page CSS classes
        return `
          <div class="brand-row" data-fav-row
               data-brand="${escapeHtml(brand)}"
               data-line="${escapeHtml(line)}"
               data-cigar="${escapeHtml(cigar)}"
               data-wrapper="${escapeHtml(wrapper)}"
               data-binder="${escapeHtml(binder)}"
               data-filler="${escapeHtml(filler)}"
               data-origin="${escapeHtml(origin)}"
               data-length="${escapeHtml(length)}"
               data-ring="${escapeHtml(ring)}"
               data-msrp="${escapeHtml(msrp)}"
               data-image="${escapeHtml(image)}">
            <div class="brand-row-left">
              <div class="brand-row-title">
                ${escapeHtml(leftTitleTop)}
                ${leftTitleBottom ? `<span style="display:block; font-weight:900;">${escapeHtml(leftTitleBottom)}</span>` : ""}
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

    // Bind click name/line area -> open modal
    // (Do NOT hijack plus clicks; cart.js will handle those)
    listEl.addEventListener(
      "click",
      (e) => {
        const addBtn = e.target.closest("[data-receipt-item]");
        if (addBtn) return; // let cart.js take it

        const row = e.target.closest("[data-fav-row]");
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

        item.displayName = rowDisplayName(item.brand, item.line, item.cigar) || item.cigar || "Cigar";
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
      },
      { passive: true }
    );
  }

  async function boot() {
    backBtn?.addEventListener("click", () => history.back());

    if (!listEl) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Favorites list container not found.";
      }
      return;
    }

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Loading…";
    }

    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();
      const rows = csvToObjects(text);

      const favs = rows.filter(isFavRow);

      // Stable sort (Brand -> Line -> Cigar)
      favs.sort((a, b) => {
        const A = `${lower(getBrand(a))} ${lower(getLine(a))} ${lower(getCigar(a))}`;
        const B = `${lower(getBrand(b))} ${lower(getLine(b))} ${lower(getCigar(b))}`;
        return A.localeCompare(B);
      });

      render(favs);

      if (statusEl) statusEl.hidden = true;
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Failed to load favorites.";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
