// /pos/cigars/brand.js
(function () {
  // ✅ Pulls live from Google Sheets via CSV export
  // If you need a specific tab, add &gid=XXXX
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

  /**
   * ✅ Resolve a working brand icon URL BEFORE rendering rows.
   * This prevents the “question mark” placeholders on first load.
   */
  async function resolveBrandIconSrc(brandName, csvBrandImgPath) {
    const slug = brandSlug(brandName);

    const candidates = [];
    if (csvBrandImgPath) candidates.push(csvBrandImgPath);

    // your preferred folder first
    if (slug) candidates.push(`/img/icons/brands/${slug}.svg`);
    // legacy / alternate
    if (slug) candidates.push(`/img/icons/brand/${slug}.svg`);

    async function testSrc(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
      });
    }

    for (const src of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await testSrc(src);
      if (ok) return src;
    }
    return ""; // nothing worked
  }

  function setBrandIconEl(imgEl, src) {
    if (!imgEl) return;
    if (!src) {
      imgEl.style.display = "none";
      return;
    }
    imgEl.style.display = "";
    imgEl.src = src;
  }

  // --- State
  let ALL = [];
  let BRAND = "";
  let BRAND_ONLY = [];
  let searchTerm = "";
  let padronState = "all"; // "maduro" | "natural" | "all"
  let selectedBands = new Set(); // multi-select

  // ✅ cached fallback src for rows that have no cigar image
  let BRAND_ICON_SRC = "";

  function buildRow(item) {
    const row = document.createElement("div");
    row.className = "cigar-row";

    const img = document.createElement("img");
    img.className = "cigar-img";

    const cigarImg = pick(item, ["Cigar IMG", "Cigar Img", "Cigar Image", "Image", "IMG"]);

    // fallback: resolved brand icon if cigar image missing
    img.src = cigarImg || BRAND_ICON_SRC || "";
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

  // ✅ single state: all / maduro / natural (Padron only)
  function passesPadronState(item) {
    if (BRAND !== "Padron") return true;
    if (padronState === "all") return true;

    const txt = [
      pick(item, ["Cigar", "Cigar Name", "Name"]),
      pick(item, ["Wrapper Shade", "Shade"]),
      pick(item, ["Line"]),
    ]
      .join(" ")
      .toLowerCase();

    const isMaduro = txt.includes("maduro");
    const isNatural = txt.includes("natural");

    if (padronState === "maduro") return isMaduro;
    if (padronState === "natural") return isNatural;
    return true;
  }

  // ✅ multi-select bands (matches against line/name text)
  function passesBands(item) {
    if (BRAND !== "Padron") return true;
    if (!selectedBands.size) return true;

    const txt = [pick(item, ["Line"]), pick(item, ["Cigar", "Cigar Name", "Name"])]
      .join(" ")
      .toLowerCase();

    // any selected band matches
    for (const b of selectedBands) {
      if (b === "1926" && txt.includes("1926")) return true;
      if (b === "1964" && txt.includes("1964")) return true;
      if (b === "damaso" && txt.includes("damaso")) return true;
    }
    return false;
  }

  function render() {
    const list = qs("brand-list");
    list.innerHTML = "";

    const filtered = BRAND_ONLY.filter(passesSearch).filter(passesPadronState).filter(passesBands);

    const frag = document.createDocumentFragment();
    filtered.forEach((item) => frag.appendChild(buildRow(item)));
    list.appendChild(frag);
  }

  async function run() {
    const params = new URLSearchParams(location.search);
    BRAND = params.get("brand") || "Brand";

    const titleEl = qs("brand-title");
    if (titleEl) titleEl.textContent = BRAND;

    // Fetch CSV
    const res = await fetch(withNoCache(GOOGLE_SHEETS_CSV_URL));
    if (!res.ok) throw new Error("CSV fetch failed: " + res.status);
    const text = await res.text();
    const { data } = parseCSV(text);

    ALL = data;

    // Filter to current brand
    BRAND_ONLY = ALL.filter((r) => pick(r, ["Brand", "brand"]) === BRAND);

    // Resolve brand icon src FIRST (prevents broken icons on initial render)
    const brandImgFromRow = pick(BRAND_ONLY[0] || {}, ["Brand IMG", "Brand Img", "brand img"]);
    BRAND_ICON_SRC = await resolveBrandIconSrc(BRAND, brandImgFromRow);
    setBrandIconEl(qs("brand-icon"), BRAND_ICON_SRC);

    // Search
    const searchEl = qs("brand-search");
    if (searchEl) {
      searchEl.addEventListener("input", (e) => {
        searchTerm = e.target.value || "";
        render();
      });
    }

    // Padron-only segmented toggle wiring (expects #seg, #seg-maduro, #seg-natural, #seg-dot)
    const seg = qs("seg");
    const btnM = qs("seg-maduro");
    const btnN = qs("seg-natural");
    const dot = qs("seg-dot");

    function syncSegUI() {
      if (!seg) return;
      seg.dataset.state = padronState;
      if (btnM) btnM.setAttribute("aria-pressed", padronState === "maduro" ? "true" : "false");
      if (btnN) btnN.setAttribute("aria-pressed", padronState === "natural" ? "true" : "false");
    }

    if (BRAND === "Padron" && seg && btnM && btnN && dot) {
      syncSegUI();

      btnM.addEventListener("click", () => {
        padronState = padronState === "maduro" ? "all" : "maduro";
        syncSegUI();
        render();
      });

      btnN.addEventListener("click", () => {
        padronState = padronState === "natural" ? "all" : "natural";
        syncSegUI();
        render();
      });

      // Tap the switch itself:
      // - if all → natural
      // - else toggle maduro <-> natural
      dot.addEventListener("click", () => {
        if (padronState === "all") padronState = "natural";
        else padronState = padronState === "maduro" ? "natural" : "maduro";
        syncSegUI();
        render();
      });
    }

    // Modals
    const modalFilters = qs("modal-filters");
    const modalBands = qs("modal-bandart"); // keep your existing id
    if (modalFilters) wireModal(modalFilters);
    if (modalBands) wireModal(modalBands);

    const btnFilters = qs("btn-filters");
    const btnBands = qs("btn-bandart");
    if (btnFilters && modalFilters) btnFilters.addEventListener("click", () => openModal(modalFilters));
    if (btnBands && modalBands) btnBands.addEventListener("click", () => openModal(modalBands));

    // ✅ Band image selections (expects checkboxes with values: 1926 / 1964 / damaso)
    const confirm = qs("bandart-confirm");
    const clear = qs("bandart-clear");

    if (clear) {
      clear.addEventListener("click", () => {
        selectedBands = new Set();
        document.querySelectorAll('input[name="bandart"]').forEach((el) => (el.checked = false));
        render();
        if (modalBands) closeModal(modalBands);
      });
    }

    if (confirm) {
      confirm.addEventListener("click", () => {
        const next = new Set();
        document.querySelectorAll('input[name="bandart"]:checked').forEach((el) => {
          next.add(el.value);
        });
        selectedBands = next;
        render();
        if (modalBands) closeModal(modalBands);
      });
    }

    // Back
    const back = qs("brand-back");
    if (back) {
      back.addEventListener("click", () => {
        if (history.length > 1) history.back();
        else location.href = "/pos/cigars/";
      });
    }

    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    run().catch((err) => {
      console.error("[brand] failed:", err);
      const list = qs("brand-list");
      if (list) {
        list.innerHTML =
          '<div style="padding:14px;color:#ffb4b4;font-weight:800;">Brand failed to load. Check Google Sheets CSV access / console.</div>';
      }
    });
  });
})();
