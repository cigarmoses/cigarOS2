/* /pos/cigars/favorites.js
   Favorites (CIGARS ONLY) — Store-wide favorites driven by Hub column "Favorite" = X/x

   ✅ Favorites shows ONLY cigars where Favorite cell is X/x
   ✅ Rows look/behave like brand POS:
      - Left icon (Cigar IMG) + stacked text + price + green +
      - Click row text area -> opens detail modal
      - Click green + -> adds 1 to invoice (cart.js JSON contract)
   ✅ No brand favorites (brands section hidden)
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const listEl = $("#fav-cigars-list");
  const brandsGrid = $("#fav-brands-grid");
  const statusEl = $("#fav-status");
  const backBtn = $("#fav-back");

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

  // CSV parser
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

  // Hub columns
  const getManufacturer = (r) => pick(r, ["Manufacturer"]);
  const getBrand = (r) => pick(r, ["Brand", "Manufacturer"]);
  const getLine = (r) => pick(r, ["Line"]);
  const getCigar = (r) => pick(r, ["Cigar", "Name", "Cigar Name"]);
  const getWrapper = (r) => pick(r, ["Wrapper", "Wrapper Shade"]);
  const getBinder = (r) => pick(r, ["Binder"]);
  const getFiller = (r) => pick(r, ["Filler"]);
  const getOrigin = (r) => pick(r, ["Origin"]);
  const getLength = (r) => pick(r, ["Length"]);
  const getRG = (r) => pick(r, ["RG", "Ring"]);
  const getVitola = (r) => pick(r, ["Vitola"]);
  const getShape = (r) => pick(r, ["Shape"]);
  const getStrength = (r) => pick(r, ["Strength"]);
  const getMSRP = (r) => pick(r, ["MSRP", "Price"]);
  const getCigarImg = (r) => pick(r, ["Cigar IMG", "Cigar Img", "Cigar Image"]);
  const getFavorite = (r) => pick(r, ["Favorite"]);

  const toPrice = (x) => {
    const n = Number(String(x ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  function isFavRow(r) {
    return lower(getFavorite(r)) === "x";
  }

  // ---- Modal (Favorites-only) ----
  function ensureModalCSS() {
    if ($("#fav-modal-css")) return;
    const style = document.createElement("style");
    style.id = "fav-modal-css";
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

  let modalItem = null;

  function openModal(item) {
    ensureModalDOM();
    modalItem = item;

    const title = `${item.line ? item.line + " — " : ""}${item.cigar || "Cigar"}`;
    $("#cigar-modal-title").textContent = title;
    $("#cigar-modal-sub").textContent = item.brand || "";

    const imgWrap = $("#cigar-modal-img");
    const imgSrc = item.img;

    if (imgSrc) {
      imgWrap.innerHTML = `<img src="${esc(imgSrc)}" alt=""
        onerror="this.remove(); this.parentElement.innerHTML='<div class=img-ph>Image coming soon</div>'" />`;
    } else {
      imgWrap.innerHTML = `<div class="img-ph">Image coming soon</div>`;
    }

    const fields = [
      ["Wrapper", item.wrapper],
      ["Binder", item.binder],
      ["Filler", item.filler],
      ["Origin", item.origin],
      ["Length", item.length ? `${item.length}"` : ""],
      ["Ring", item.rg ? `RG ${item.rg}` : ""],
      ["Vitola", item.vitola],
      ["Shape", item.shape],
      ["Strength", item.strength],
      ["MSRP", item.msrp],
    ];

    $("#cigar-modal-grid").innerHTML = fields
      .filter(([, v]) => norm(v) !== "")
      .map(
        ([k, v]) => `
          <div class="cigar-field">
            <div class="cigar-label">${esc(k)}</div>
            <div class="cigar-value" title="${esc(v)}">${esc(v)}</div>
          </div>
        `
      )
      .join("");

    $("#cigar-modal-backdrop").classList.add("is-open");
    $("#cigar-modal").classList.add("is-open");

    $("#cigar-modal-add").onclick = () => {
      if (!modalItem) return;
      const fake = document.createElement("button");
      fake.setAttribute("data-receipt-item", JSON.stringify(modalItem.receiptItem));
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
    modalItem = null;
  }

  // ---- Receipt payload (JSON) ----
  function receiptPayload(r) {
    const brand = norm(getBrand(r) || getManufacturer(r));
    const line = norm(getLine(r));
    const cigar = norm(getCigar(r));
    const vitola = norm(getVitola(r));
    const msrp = norm(getMSRP(r));

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
      img: norm(getCigarImg(r)),
      sub: [norm(getOrigin(r)), norm(getLength(r)) ? `${norm(getLength(r))}"` : "", norm(getRG(r)) ? `RG ${norm(getRG(r))}` : ""]
        .filter(Boolean)
        .join(" • "),
      meta: { brand, line, cigar, vitola },
    };
  }

  // ---- Render ----
  function render(rows) {
    // Hide brands section completely (per your instruction)
    if (brandsGrid) {
      brandsGrid.innerHTML = "";
      const section = brandsGrid.closest("section");
      if (section) section.style.display = "none";
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
        const brand = norm(getBrand(r) || getManufacturer(r));
        const line = norm(getLine(r));
        const cigar = norm(getCigar(r));
        const wrapper = norm(getWrapper(r));
        const binder = norm(getBinder(r));
        const filler = norm(getFiller(r));
        const origin = norm(getOrigin(r));
        const length = norm(getLength(r));
        const rg = norm(getRG(r));
        const vitola = norm(getVitola(r));
        const shape = norm(getShape(r));
        const strength = norm(getStrength(r));
        const msrp = norm(getMSRP(r));
        const img = norm(getCigarImg(r));

        const payload = receiptPayload(r);
        const sub = [origin, length ? `${length}"` : "", rg ? `RG ${rg}` : ""].filter(Boolean).join(" • ");

        return `
          <div class="fav-row" data-fav-row
               data-brand="${esc(brand)}"
               data-line="${esc(line)}"
               data-cigar="${esc(cigar)}"
               data-wrapper="${esc(wrapper)}"
               data-binder="${esc(binder)}"
               data-filler="${esc(filler)}"
               data-origin="${esc(origin)}"
               data-length="${esc(length)}"
               data-rg="${esc(rg)}"
               data-vitola="${esc(vitola)}"
               data-shape="${esc(shape)}"
               data-strength="${esc(strength)}"
               data-msrp="${esc(msrp)}"
               data-img="${esc(img)}">

            ${
              img
                ? `<img class="fav-ico" src="${esc(img)}" alt="" onerror="this.style.display='none';" />`
                : `<div class="fav-ico" aria-hidden="true" style="display:grid;place-items:center;font-size:10px;font-weight:800;color:rgba(15,26,44,.55);text-align:center;line-height:1.1;padding:6px;">IMG<br/>SOON</div>`
            }

            <div class="fav-main">
              <button class="fav-open" type="button" aria-label="Open cigar details">
                <div class="fav-title">${esc(line || brand)}${cigar ? `<br/>${esc(cigar)}` : ""}${wrapper ? `<br/>${esc(wrapper)}` : ""}</div>
                ${sub ? `<div class="fav-sub">${esc(sub)}</div>` : ""}
              </button>
            </div>

            <div class="fav-price">${esc(msrp)}</div>

            <button type="button"
              class="fav-add"
              aria-label="Add to invoice"
              data-receipt-item='${esc(JSON.stringify(payload))}'>+</button>
          </div>
        `;
      })
      .join("");

    // Bind row open (once)
    if (!listEl.dataset.bound) {
      listEl.dataset.bound = "1";
      listEl.addEventListener("click", (e) => {
        const addBtn = e.target.closest("[data-receipt-item]");
        if (addBtn) return; // cart.js handles add

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
          rg: norm(row.dataset.rg),
          vitola: norm(row.dataset.vitola),
          shape: norm(row.dataset.shape),
          strength: norm(row.dataset.strength),
          msrp: norm(row.dataset.msrp),
          img: norm(row.dataset.img),
        };

        item.receiptItem = {
          id: `${slug(item.brand)}|${slug(item.line)}|${slug(item.cigar)}|${slug(item.vitola)}`,
          type: "product",
          category: "Cigars",
          brand: item.brand,
          name: `${item.line ? item.line + " — " : ""}${item.cigar}${item.vitola ? " (" + item.vitola + ")" : ""}`,
          price: toPrice(item.msrp),
          qty: 1,
          img: item.img || "",
          sub: [item.origin, item.length ? `${item.length}"` : "", item.rg ? `RG ${item.rg}` : ""].filter(Boolean).join(" • "),
        };

        openModal(item);
      });
    }
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
