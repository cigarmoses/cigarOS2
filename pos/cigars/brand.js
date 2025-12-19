// /pos/cigars/brand.js
(function () {
  const SHEET_ID = "10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM";
  const GID = "822697742"; // your cigars tab gid
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function withNoCache(url) {
    const u = new URL(url);
    u.searchParams.set("_ts", Date.now().toString());
    return u.toString();
  }

  // CSV parser (quotes supported)
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
      if (row[k] != null && String(row[k]).trim() !== "") return row[k];
    }
    return "";
  }

  function safeSrc(src) {
    if (!src) return "";
    let s = String(src).trim();
    if (!s) return "";
    if (!s.startsWith("/") && !s.startsWith("http")) s = "/" + s.replace(/^\/+/, "");
    return s;
  }

  const BRAND_ICON_OVERRIDES = {
    aturrent: "aturrent",
    aflores: "aflores",
    carlostorano: "torano",
    brundelre: "brundelre",
    diamondcrown: "diamondcrown",
    elreydelmundo: "elreydelmundo",
    fonseca: "fonseca",
  };

  function brandSlug(name) {
    if (!name) return "";
    const canonical = String(name)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

    if (!canonical) return "";
    if (Object.prototype.hasOwnProperty.call(BRAND_ICON_OVERRIDES, canonical)) {
      return BRAND_ICON_OVERRIDES[canonical];
    }
    return canonical;
  }

  function setImgFallback(imgEl, candidates) {
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

  function fmtPrice(raw) {
    const s = (raw || "").toString().trim();
    if (!s) return "";
    // remove $ if present, keep numbers
    const cleaned = s.replace(/[^0-9.]/g, "");
    if (!cleaned) return "";
    const n = Number(cleaned);
    if (Number.isNaN(n)) return "";
    return n.toFixed(2);
  }

  function buildRow(row, brandName) {
    const cigar = pick(row, ["Cigar", "Name", "Cigar Name"]);
    const vitola = pick(row, ["Vitola", "Style", "Vitola/Size", "Shape"]);
    const brandImg = pick(row, ["Brand IMG", "Brand Img"]);
    const cigarImg = pick(row, ["Cigar IMG", "Cigar Img", "Image", "IMG"]);
    const priceRaw = pick(row, ["MSRP", "Price", "Cigar Cost", "Cost"]);
    const price = fmtPrice(priceRaw) || "—";

    const wrap = document.createElement("div");
    wrap.className = "brand-row";

    const left = document.createElement("div");
    left.className = "brand-row-left";

    const img = document.createElement("img");
    img.alt = "";

    // Prefer cigar image, else brand image, else brand icon fallback
    const candidates = [];
    if (cigarImg) candidates.push(safeSrc(cigarImg));
    if (brandImg) candidates.push(safeSrc(brandImg));
    const slug = brandSlug(brandName);
    if (slug) candidates.push(`/img/icons/brands/${slug}.svg`);
    if (slug) candidates.push(`/img/icons/brand/${slug}.svg`);
    setImgFallback(img, candidates);

    left.appendChild(img);

    const mid = document.createElement("div");
    mid.className = "brand-row-mid";

    const title = document.createElement("p");
    title.className = "brand-cigar";
    title.textContent = cigar || "Unnamed cigar";

    const sub = document.createElement("div");
    sub.className = "brand-brand";
    sub.textContent = brandName;

    mid.appendChild(title);
    mid.appendChild(sub);

    const right = document.createElement("div");
    right.className = "brand-row-right";

    const pr = document.createElement("div");
    pr.className = "brand-price";
    pr.textContent = price !== "—" ? price : "—";

    const vt = document.createElement("div");
    vt.className = "brand-vitola";
    vt.textContent = vitola || "";

    right.appendChild(pr);
    right.appendChild(vt);

    const add = document.createElement("button");
    add.className = "brand-add";
    add.type = "button";
    add.textContent = "+";
    add.addEventListener("click", () => {
      // Hook this into your cart/receipt system later.
      // For now: emit an event you can listen for globally.
      window.dispatchEvent(
        new CustomEvent("cigar:add", {
          detail: {
            brand: brandName,
            cigar,
            vitola,
            price: pr.textContent,
            rawRow: row,
          },
        })
      );
    });

    wrap.appendChild(left);
    wrap.appendChild(mid);
    wrap.appendChild(right);
    wrap.appendChild(add);

    return wrap;
  }

  function dedupeRows(list) {
    // Prefer explicit "key" if you have one, else composite
    const seen = new Set();
    const out = [];

    for (const r of list) {
      const k = pick(r, ["key", "Key"]).trim();
      const composite = [
        pick(r, ["Brand"]).trim(),
        pick(r, ["Cigar"]).trim(),
        pick(r, ["Vitola"]).trim(),
        pick(r, ["Wrapper"]).trim(),
        pick(r, ["Wrapper Shade"]).trim(),
        pick(r, ["RG"]).trim(),
        pick(r, ["Length"]).trim(),
      ].join("|");

      const id = k || composite;
      if (!id.trim()) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(r);
    }

    return out;
  }

  async function loadRows() {
    const res = await fetch(withNoCache(CSV_URL));
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const text = await res.text();
    return parseCSV(text).data;
  }

  function setHeaderBrand(brandName, anyRow) {
    const title = document.getElementById("brand-title");
    const sub = document.getElementById("brand-sub");
    const badgeImg = document.getElementById("brand-badge-img");

    title.textContent = brandName || "Brand";
    sub.textContent = "Cigars";

    const brandImg = anyRow ? pick(anyRow, ["Brand IMG", "Brand Img"]) : "";
    const slug = brandSlug(brandName);

    const candidates = [];
    if (brandImg) candidates.push(safeSrc(brandImg));
    if (slug) candidates.push(`/img/icons/brands/${slug}.svg`);
    if (slug) candidates.push(`/img/icons/brand/${slug}.svg`);

    if (candidates.length) setImgFallback(badgeImg, candidates);
    else badgeImg.style.display = "none";
  }

  async function run() {
    const back = document.getElementById("brand-back");
    if (back) {
      back.addEventListener("click", () => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/pos/cigars/";
      });
    }

    const listEl = document.getElementById("brand-list");
    const brandParam = qs("brand").trim();

    if (!brandParam) {
      listEl.innerHTML = `<div class="brand-empty">Missing brand parameter.</div>`;
      return;
    }

    try {
      const all = await loadRows();

      // Filter by Brand column (case-insensitive match)
      const filtered = all.filter((r) => {
        const b = (pick(r, ["Brand"]) || "").trim();
        return b.toLowerCase() === brandParam.toLowerCase();
      });

      const unique = dedupeRows(filtered);

      setHeaderBrand(brandParam, unique[0]);

      listEl.innerHTML = "";

      if (!unique.length) {
        listEl.innerHTML = `<div class="brand-empty">No cigars found for ${brandParam}.</div>`;
        return;
      }

      const frag = document.createDocumentFragment();
      unique.forEach((r) => frag.appendChild(buildRow(r, brandParam)));
      listEl.appendChild(frag);
    } catch (e) {
      console.error("[brand] error:", e);
      listEl.innerHTML = `<div class="brand-empty">Failed to load cigars for this brand.</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", run);
})();
