// /pos/cigars/brand.js
(function () {
  // ✅ Pulls live from Google Sheets via CSV export
  // If your data lives on a specific tab, add &gid=XXXX to this URL.
  const GOOGLE_SHEETS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  function withNoCache(url) {
    const u = new URL(url);
    u.searchParams.set("_ts", Date.now().toString());
    return u.toString();
  }

  function qs(id) {
    return document.getElementById(id);
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

  function setBrandIcon(imgEl, brandName) {
    const slug = brandSlug(brandName);
    if (!imgEl || !slug) return;

    // ✅ Correct path (your requirement)
    const src = `/img/icons/brands/${slug}.svg`;
    imgEl.onerror = () => {
      // If missing, keep a subtle placeholder instead of broken image icon
      imgEl.removeAttribute("src");
      imgEl.style.opacity = "0.15";
    };
    imgEl.src = src;
    imgEl.style.opacity = "1";
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
  let padronMode = ""; // "", "maduro", "natural"
  let bandPick = "";   // "", "1964", "1926", "damaso"

  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  // --- Filters
  function passesSearch(item) {
    if (!searchTerm) return true;
    const hay = [
      pick(item, ["Brand"]),
      pick(item, ["Line"]),
      pick(item, ["Cigar", "Cigar Name", "Name"]),
      pick(item, ["Vitola", "Style"]),
      pick(item, ["Wrapper Shade", "Shade"]),
    ].join(" ").toLowerCase();
    return hay.includes(searchTerm.toLowerCase());
  }

  function passesPadronMode(item) {
    if (BRAND !== "Padron") return true;
    if (!padronMode) return true;

    const txt = [
      pick(item, ["Cigar", "Cigar Name", "Name"]),
      pick(item, ["Wrapper Shade", "Shade"]),
      pick(item, ["Line"]),
    ].join(" ").toLowerCase();

    if (padronMode === "maduro") return txt.includes("maduro");
    if (padronMode === "natural") return txt.includes("natural");
    return true;
  }

  function passesBands(item) {
    if (!bandPick) return true;

    const txt = [
      pick(item, ["Line"]),
      pick(item, ["Cigar", "Cigar Name", "Name"]),
    ].join(" ").toLowerCase();

    if (bandPick === "1964") return txt.includes("1964");
    if (bandPick === "1926") return txt.includes("1926");
    if (bandPick === "damaso") return txt.includes("damaso");
    return true;
  }

  // --- Render
  function buildRow(item) {
    const row = document.createElement("div");
    row.className = "cigar-row";

    const img = document.createElement("img");
    img.className = "cigar-img";
    img.alt = "Brand icon";

    // ✅ Row icon: brand icon (Padron shows again)
    img.src = qs("brand-icon")?.src || "";
    img.onerror = () => {
      img.removeAttribute("src");
      img.style.opacity = "0.15";
    };

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

    // ✅ Subtitle: Wrapper SHADE – Vitola
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

    // ✅ MSRP comes from column titled "MSRP"
    const msrp = safeNum(pick(item, ["MSRP"]));
    price.textContent = fmtMoney(msrp);

    const plus = document.createElement("button");
    plus.className = "cigar-plus";
    plus.type = "button";
    plus.textContent = "+";
    plus.addEventListener("click", () => {
      plus.blur();
      // hook cart later
    });

    right.appendChild(divider);
    right.appendChild(price);
    right.appendChild(plus);

    row.appendChild(img);
    row.appendChild(mid);
    row.appendChild(right);

    return row;
  }

  function render() {
    const list = qs("brand-list");
    if (!list) return;

    list.innerHTML = "";

    const filtered = BRAND_ONLY
      .filter(passesSearch)
      .filter(passesPadronMode)
      .filter(passesBands);

    const frag = document.createDocumentFragment();
    filtered.forEach((item) => frag.appendChild(buildRow(item)));
    list.appendChild(frag);
  }

  function setSegState() {
    const btnM = qs("seg-maduro");
    const btnN = qs("seg-natural");
    const dot = document.querySelector(".seg-dot");

    if (!btnM || !btnN || !dot) return;

    btnM.setAttribute("aria-pressed", padronMode === "maduro" ? "true" : "false");
    btnN.setAttribute("aria-pressed", padronMode === "natural" ? "true" : "false");

    // dot active if either side active
    if (padronMode) dot.classList.add("active");
    else dot.classList.remove("active");
  }

  // --- Init
  async function run() {
    const params = new URLSearchParams(location.search);
    BRAND = params.get("brand") || "Brand";

    // Title
    const titleEl = qs("brand-title");
    if (titleEl) titleEl.textContent = BRAND;

    // Icon
    setBrandIcon(qs("brand-icon"), BRAND);

    // Padron-only segmented control
    const seg = qs("padron-seg");
    if (seg) seg.style.display = (BRAND === "Padron") ? "" : "none";

    // Fetch CSV
    const res = await fetch(withNoCache(GOOGLE_SHEETS_CSV_URL));
    const text = await res.text();
    const { data } = parseCSV(text);
    ALL = data;

    // Filter to current brand (case-insensitive)
    BRAND_ONLY = ALL.filter((r) => norm(pick(r, ["Brand"])) === norm(BRAND));

    // Search
    const search = qs("brand-search");
    if (search) {
      search.addEventListener("input", (e) => {
        searchTerm = e.target.value || "";
        render();
      });
    }

    // Modals
    const modalFilters = qs("modal-filters");
    const modalBands = qs("modal-bands");
    if (modalFilters) wireModal(modalFilters);
    if (modalBands) wireModal(modalBands);

    const btnFilters = qs("btn-filters");
    const btnBands = qs("btn-bands");

    if (btnFilters && modalFilters) btnFilters.addEventListener("click", () => openModal(modalFilters));
    if (btnBands && modalBands) btnBands.addEventListener("click", () => openModal(modalBands));

    // Bands modal actions
    const bandsClear = qs("bands-clear");
    const bandsConfirm = qs("bands-confirm");

    if (bandsClear) {
      bandsClear.addEventListener("click", () => {
        bandPick = "";
        document.querySelectorAll('input[name="bandart"]').forEach((r) => (r.checked = false));
        render();
        if (modalBands) closeModal(modalBands);
      });
    }

    if (bandsConfirm) {
      bandsConfirm.addEventListener("click", () => {
        const checked = document.querySelector('input[name="bandart"]:checked');
        bandPick = checked ? checked.value : "";
        render();
        if (modalBands) closeModal(modalBands);
      });
    }

    // Segmented Padron control
    const segM = qs("seg-maduro");
    const segN = qs("seg-natural");

    if (segM) {
      segM.addEventListener("click", () => {
        // tap again clears (show all)
        padronMode = (padronMode === "maduro") ? "" : "maduro";
        setSegState();
        render();
      });
    }

    if (segN) {
      segN.addEventListener("click", () => {
        padronMode = (padronMode === "natural") ? "" : "natural";
        setSegState();
        render();
      });
    }

    setSegState();

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
          '<div style="padding:14px;color:#ffb4b4;font-weight:900;">Brand failed to load from Google Sheets.</div>';
      }
    });
  });
})();
