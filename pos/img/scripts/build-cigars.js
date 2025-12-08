// /pos/img/scripts/build-cigars.js

// Base for LIVE GOOGLE SHEETS HUB URL (we'll add cache-busting query params)
const GOOGLE_HUB_BASE =
  "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq";

// LOCAL JSON FALLBACK
const LOCAL_HUB_URL = "/hub/hub_11-5-25.json";

let hubData = [];
let filteredData = [];
let activeFilters = {};
let currentFilterId = null;

// -------------------------------
// Helpers
// -------------------------------
function brandSlug(name) {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(obj, ...keys) {
  for (const k of keys) {
    if (
      obj &&
      Object.prototype.hasOwnProperty.call(obj, k) &&
      obj[k] !== null &&
      obj[k] !== undefined &&
      obj[k] !== ""
    ) {
      return obj[k];
    }
  }
  return "";
}

function normalizeRow(r) {
  return {
    Brand: pick(r, "Brand", "brand", "BRAND") || "",
    Line: pick(r, "Line", "line") || "",
    Cigar: pick(r, "Cigar", "cigar", "Name") || "",
    Vitola: pick(r, "Vitola", "vitola") || "",
    Wrapper: pick(r, "Wrapper", "wrapper") || "",
    Binder: pick(r, "Binder", "binder") || "",
    Filler: pick(r, "Filler", "filler") || "",
    WrapperShade:
      pick(r, "Wrapper Shade", "WrapperShade", "wrapper_shade") || "",
    Length: pick(r, "Length", "length") || "",
    RG: pick(r, "RG", "Ring", "ring") || "",
    MSRP: pick(r, "MSRP", "msrp", "Price") || "",
    "Brand IMG":
      pick(
        r,
        "Brand IMG",
        "BrandIMG",
        "brand_img",
        "brand icon",
        "Brand Icon"
      ) || "",
  };
}

/**
 * Resolve the correct image src for a brand icon.
 */
function resolveBrandImg(rawImg, brandName) {
  const brand = (brandName || "").trim();
  let candidate = (rawImg || "").trim();

  // If nothing provided, fall back to brand name
  if (!candidate) {
    candidate = brand;
  }

  // If it's already a full URL or absolute path, use as-is
  if (
    candidate.startsWith("http://") ||
    candidate.startsWith("https://") ||
    candidate.startsWith("/")
  ) {
    return candidate;
  }

  // If it contains a slash but no leading / or protocol, treat as relative path
  if (candidate.includes("/")) {
    if (!candidate.startsWith("/")) {
      candidate = "/" + candidate;
    }
    return candidate;
  }

  // At this point, candidate is just a name or filename (no path)
  let base = candidate;
  let ext = ".svg";
  const dotIndex = candidate.lastIndexOf(".");

  if (dotIndex > 0 && dotIndex < candidate.length - 1) {
    ext = candidate.slice(dotIndex); // keep original extension
    base = candidate.slice(0, dotIndex);
  }

  const slug = brandSlug(base || brand);
  return `/img/icons/brands/${slug}${ext}`;
}

// Build a fresh Google URL each time with cache-busting param
function makeGoogleHubUrl() {
  const params = new URLSearchParams({
    tq: "select *",
    tqx: "out:json",
    cacheBust: String(Date.now()),
  });
  return `${GOOGLE_HUB_BASE}?${params.toString()}`;
}

// -------------------------------
// Fetch from Google Sheets (GViz)
// -------------------------------
async function fetchHubFromGoogle() {
  const url = makeGoogleHubUrl();
  console.log("[Hub] Trying Google Sheets URL:", url);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Google hub failed to load: " + res.status);
  }

  const text = await res.text();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Google hub JSON wrapper not found");
  }

  const jsonStr = text.slice(firstBrace, lastBrace + 1);
  const gviz = JSON.parse(jsonStr);

  const table = gviz.table;
  const headers = table.cols.map((c) => (c.label || c.id || "").trim());

  const rows = table.rows.map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      const cell = row.c[i];
      obj[h] = cell ? cell.v : "";
    });
    return obj;
  });

  console.log("[Hub] Google Sheets rows:", rows.length);
  return rows.map(normalizeRow);
}

// -------------------------------
// Fetch from local JSON (fallback)
// -------------------------------
async function fetchHubFromLocal() {
  console.log("[Hub] Falling back to local JSON...");
  const res = await fetch(LOCAL_HUB_URL);
  if (!res.ok) {
    throw new Error("Local hub failed to load: " + res.status);
  }
  const json = await res.json();
  console.log("[Hub] Local JSON rows:", json.length);
  return json.map(normalizeRow);
}

// -------------------------------
// LOAD HUB (Google first, then local)
// -------------------------------
async function loadHub() {
  try {
    try {
      hubData = await fetchHubFromGoogle();
    } catch (googleErr) {
      console.error("[Hub] Google fetch/parse error:", googleErr);
      hubData = await fetchHubFromLocal();
    }

    filteredData = [...hubData];

    renderBrandsGrid();
    renderCigarsGrid();
  } catch (err) {
    console.error("Error loading hub:", err);
  }
}

// -------------------------------
// RENDER BRAND GRID (main /pos/cigars/ page)
// -------------------------------
function renderBrandsGrid() {
  const container = document.getElementById("brands-grid");
  if (!container) return;

  const brandMap = new Map();

  hubData.forEach((row) => {
    const brandName = (row.Brand || "").trim();
    if (!brandName) return;

    if (!brandMap.has(brandName)) {
      brandMap.set(brandName, {
        Brand: brandName,
        rawImg: row["Brand IMG"] || "",
      });
    }
  });

  const brands = Array.from(brandMap.values()).sort((a, b) =>
    a.Brand.localeCompare(b.Brand)
  );

  container.innerHTML = "";

  brands.forEach((b) => {
    const brandName = b.Brand;
    const src = resolveBrandImg(b.rawImg, brandName);
    const href = `/pos/cigars/brand.html?brand=${encodeURIComponent(
      brandName
    )}`;

    const card = document.createElement("a");
    card.className = "brand-card";
    card.href = href;
    card.setAttribute("data-brand", brandName);

    card.innerHTML = `
      <div class="brand-card-inner">
        <div class="brand-card-icon-wrapper">
          <img class="brand-card-icon" src="${src}" alt="${brandName}">
        </div>
        <div class="brand-card-name">${brandName}</div>
      </div>
    `;

    container.appendChild(card);
  });
}

// -------------------------------
// RENDER CIGAR GRID (used on brand pages or others)
// -------------------------------
function renderCigarsGrid() {
  const container = document.querySelector("[data-cigar-grid]");
  if (!container) return;

  container.innerHTML = "";

  filteredData.forEach((row) => {
    const brandName = row.Brand || "";
    const src = resolveBrandImg(row["Brand IMG"] || "", brandName);

    const item = document.createElement("div");
    item.className = "cigar-item";

    item.innerHTML = `
      <a class="cigar-card">
        <img class="brand-icon" src="${src}" alt="${row.Brand}">
        <div class="cigar-name">${row.Line} ${row.Cigar}</div>
        <div class="cigar-vitola">${row.Vitola}</div>
        <div class="cigar-brand">${row.Brand}</div>
        <div class="cigar-msrp">$${row.MSRP || ""}</div>
      </a>
    `;

    container.appendChild(item);
  });
}

// -------------------------------
// BOOTUP
// -------------------------------
document.addEventListener("DOMContentLoaded", loadHub);
