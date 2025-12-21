// /pos/cigars/brand.js
(function () {
  const GOOGLE_SHEETS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  function withNoCache(url) {
    const u = new URL(url);
    u.searchParams.set("_ts", Date.now().toString());
    return u.toString();
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && ch === ",") {
        row.push(cur);
        cur = "";
        continue;
      }
      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
        continue;
      }
      cur += ch;
    }

    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);

    if (!rows.length) return { headers: [], data: [] };

    const headers = rows[0].map((h) => (h || "").trim());
    const data = rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").toString().trim();
      });
      return obj;
    });

    return { headers, data };
  }

  function pick(row, keys) {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return "";
  }

  function safeNum(v) {
    const n = Number(String(v || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function fmtMoney(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function brandSlug(name) {
    if (!name) return "";
    return String(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function setBrandIcon(imgEl, brandName, csvBrandImgPath) {
    const slug = brandSlug(brandName);

    const candidates = [];
    if (csvBrandImgPath) candidates.push(csvBrandImgPath);

    // prefer /img/icons/brands/ first
    if (slug) candidates.push(`/img/icons/brands/${slug}.svg`);
    if (slug) candidates.push(`/img/icons/brand/${slug}.svg`);

    let idx = 0;
    function tryNext() {
      if (idx >= candidates.length) {
        imgEl.style.display = "none";
        return;
      }
      imgEl.src = candidates[idx++];
    }
    imgEl.onerror = tryNext;
    tryNext();
  }

  function qs(id) {
    return document.getElementById(id);
  }

  // --- Modal helpers
  function openModal(modal) {
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal(modal) {
    modal.setAttribute("aria-hidden", "true");
  }
  function wireModal(modal) {
    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") {
        closeModal(modal);
      }
    });
  }

  // --- State
  let ALL = [];
  let BRAND = "";
  let BRAND_ONLY = [];
  let searchTerm = "";

  // ✅ tri-state toggle: "all" | "maduro" | "natural"
  let shadeState = "all";

  // ✅ multi-select bands
  let bandArts = new Set(); // values: "1964" | "1926" | "damaso"

  // --- Render row
  function buildRow(item) {
    const row = document.createElement("div");
    row.className = "cigar-row";

    const img = document.createElement("img");
    img.className = "cigar-img";

    const cigarImg = pick(item, ["Cigar IMG", "Cigar Img", "Cigar Image", "Image", "IMG"]);
    if (cigarImg) img.src = cigarImg;
    else img.src = qs("brand-icon")?.src || "";

    img.alt = pick(item, ["Cigar", "Name", "Cigar Name"]) || "Cigar";

    const mid = document.createElement("div");
    mid.className = "cigar-mid";

    const name = document.createElement("div");
    name.className = "cigar-name";

    const cigarName =
      pick(item, ["Cigar", "Cigar Name", "Name"]) ||
      pick(item, ["Vitola", "Style"]) ||
      "Cigar";
    name.textContent = cigarName;

    const sub = document.createElement("div");
    sub.className = "cigar-sub";

    // Subtitle: Wrapper SHADE – Vitola
    const shade = pick(item, ["Wrapper Shade", "Wrapper shade", "Shade"]);
    const vitola = pick(item, ["Vitola", "Style", "Vitola/Style"]);
    const subText = [shade, vitola].filter(Boolean).join(" – ");
    sub.textContent = subText || vitola || "";

    mid.appendChild(name);
    mid.appendChild(sub);

    const right = document.createElement("div");
    right.className = "cigar-right";

    const divider = document.createElement("div");
    divider.className = "cigar-divider";

    const price = document.createElement("div");
    price.className = "cigar-price";

    const msrp = safeNum(pick(item, ["MSRP", "Cigar MSRP", "Price"]));
    price.textContent = fmtMoney(msrp);

    const plus = document.createElement("button");
    plus.className = "cigar-plus";
    plus.type = "button";
    plus.textContent = "+";
    plus.addEventListener("click", () => plus.blur());

    right.appendChild(divider);
    right.appendChild(price);
    right.appendChild(plus);

    row.appendChild(img);
    row.appendChild(mid);
    row.appendChild(right);

    return row;
  }

  function passesSearch(item) {
    if (!searchTerm) return true;
    const hay = [
      pick(item, ["Brand", "brand"]),
      pick(item, ["Line", "line"]),
      pick(item, ["Cigar", "Cigar Name", "Name"]),
      pick(item, ["Vitola", "Style"]),
      pick(item, ["Wrapper Shade", "Shade"]),
    ]
      .join(" ")
      .toLowerCase();

    return hay.includes(searchTerm.toLowerCase());
  }

  // ✅ tri-state shade toggle filtering (Padron only)
  function passesShadeState(item) {
    if (BRAND !== "Padron") return true;
    if (shadeState === "all") return true;

    const txt = [
      pick(item, ["Cigar", "Cigar Name", "Name"]),
      pick(item, ["Wrapper Shade", "Shade"]),
      pick(item, ["Line"]),
    ]
      .join(" ")
      .toLowerCase();

    const isMaduro = txt.includes("maduro");
    const isNatural = txt.includes("natural");

    if (shadeState === "maduro") return isMaduro;
    if (shadeState === "natural") return isNatural;
    return true;
  }

  // ✅ multi-select bands filter
  function passesBands(item) {
    if (BRAND !== "Padron") return true;
    if (!bandArts.size) return true;

    const txt = [
      pick(item, ["Line"]),
      pick(item, ["Cigar", "Cigar Name", "Name"]),
    ].join(" ").toLowerCase();

    const wants1964 = bandArts.has("1964");
    const wants1926 = bandArts.has("1926");
    const wantsDamaso = bandArts.has("damaso");

    const match1964 = txt.includes("1964");
    const match1926 = txt.includes("1926");
    const matchDamaso = txt.includes("damaso");

    return (
      (wants1964 && match1964) ||
      (wants1926 && match1926) ||
      (wantsDamaso && matchDamaso)
    );
  }

  function render() {
    const list = qs("brand-list");
    list.innerHTML = "";

    const filtered = BRAND_ONLY
      .filter(passesSearch)
      .filter(passesShadeState)
      .filter(passesBands);

    const frag = document.createDocumentFragment();
    filtered.forEach((item) => frag.appendChild(buildRow(item)));
    list.appendChild(frag);
  }

  // --- Shade toggle behavior (exact rules you requested)
  function setShadeState(next) {
    shadeState = next;

    const seg = qs("seg-wrap");
    const btnM = qs("seg-maduro");
    const btnN = qs("seg-natural");

    seg.dataset.state = shadeState;

    btnM.setAttribute("aria-pressed", shadeState === "maduro" ? "true" : "false");
    btnN.setAttribute("aria-pressed", shadeState === "natural" ? "true" : "false");

    render();
  }

  function wireShadeToggle() {
    const seg = qs("seg-wrap");
    const btnM = qs("seg-maduro");
    const btnN = qs("seg-natural");
    const sw = qs("seg-switch");

    // Tap Maduro
    btnM.addEventListener("click", () => {
      if (shadeState === "maduro") setShadeState("all");  // tap active again -> All
      else setShadeState("maduro");
    });

    // Tap Natural
    btnN.addEventListener("click", () => {
      if (shadeState === "natural") setShadeState("all"); // tap active again -> All
      else setShadeState("natural");
    });

    // Tap the switch itself:
    sw.addEventListener("click", () => {
      if (shadeState === "maduro") setShadeState("natural");
      else if (shadeState === "natural") setShadeState("maduro");
      else {
        // if in All -> goes to Natural and stays standard color
        setShadeState("natural");
      }
    });

    // default
    setShadeState("all");
  }

  // --- Init
  async function run() {
    const params = new URLSearchParams(location.search);
    BRAND = params.get("brand") || "Brand";

    qs("brand-title").textContent = BRAND;

    // only show shade toggle for Padron
    const showPadron = BRAND === "Padron";
    qs("seg-wrap").style.display = showPadron ? "" : "none";

    // Fetch CSV
    const res = await fetch(withNoCache(GOOGLE_SHEETS_CSV_URL));
    const text = await res.text();
    const { data } = parseCSV(text);

    ALL = data;

    // Filter to current brand
    BRAND_ONLY = ALL.filter((r) => pick(r, ["Brand", "brand"]) === BRAND);

    // Top-right brand icon
    const brandImgFromRow = pick(BRAND_ONLY[0] || {}, ["Brand IMG", "Brand Img", "brand img"]);
    setBrandIcon(qs("brand-icon"), BRAND, brandImgFromRow);

    // Search
    qs("brand-search").addEventListener("input", (e) => {
      searchTerm = e.target.value || "";
      render();
    });

    // Modals
    const modalFilters = qs("modal-filters");
    const modalBandart = qs("modal-bandart");
    wireModal(modalFilters);
    wireModal(modalBandart);

    qs("btn-filters").addEventListener("click", () => openModal(modalFilters));
    qs("btn-bandart").addEventListener("click", () => openModal(modalBandart));

    // Bands: Clear + Confirm (multi-select)
    qs("bandart-clear").addEventListener("click", () => {
      bandArts = new Set();
      document.querySelectorAll('input[name="bandpick"]').forEach((c) => (c.checked = false));
      render();
      closeModal(modalBandart);
    });

    qs("bandart-confirm").addEventListener("click", () => {
      const next = new Set();
      document.querySelectorAll('input[name="bandpick"]:checked').forEach((c) => {
        next.add(String(c.value));
      });
      bandArts = next;
      render();
      closeModal(modalBandart);
    });

    // Back
    qs("brand-back").addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = "/pos/cigars/";
    });

    if (showPadron) wireShadeToggle();
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    run().catch((err) => {
      console.error("[brand] failed:", err);
      const list = qs("brand-list");
      list.innerHTML =
        '<div style="padding:14px;color:#ffb4b4;font-weight:800;">Brand failed to load from Google Sheets.</div>';
    });
  });
})();
