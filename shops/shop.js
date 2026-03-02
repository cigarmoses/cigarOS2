/* /shops/shop.js
   FULL REPLACEMENT FILE (v13.1)
   - Loads correct shop by ?shop=slug
   - Prefers /data/shops/{slug}.json, falls back to /shops/shops.json
   - Correctly hides #spTaaIcon when not TAA
   - Renders Hours / Brands / Updates + tab switching
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function toStr(v){ return v == null ? "" : String(v).trim(); }

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "yes", "y", "x", "✓", "check", "checked"].includes(s);
  }

  function getSlugFromUrl() {
    const u = new URL(window.location.href);
    return (u.searchParams.get("shop") || "").trim().toLowerCase();
  }

  function slugify(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function sanitizeLogoName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizeShop(raw, fallbackSlug) {
    const slug = toStr(raw.slug || raw.Slug || raw.slug_id || fallbackSlug).toLowerCase();

    const name = toStr(raw.name || raw.Shop || raw.shop || raw.Title);
    const city = toStr(raw.city || raw.City);
    const state = toStr(raw.state || raw.ST || raw.State);

    const address = toStr(raw.address || raw.Address || raw.address1);
    const phone = toStr(raw.phone || raw.Phone || raw.cell || raw.Cell);
    const website = toStr(raw.website || raw.Website);
    const email = toStr(raw.email || raw.Email);

    const amenities = raw.amenities && typeof raw.amenities === "object"
      ? raw.amenities
      : {
          byob: raw.BYOB,
          tvs: raw.TVs || raw.TV,
          indoor: raw.Indoor,
          outdoor: raw.Outdoor,
          food: raw.Food,
          alcohol: raw.Alcohol,
          noalcohol: raw["No Alcohol"] || raw.NoAlcohol,
          quiet: raw.Quiet,
          livemusic: raw["Live Music"] || raw.LiveMusic,
          taa: raw.TAA
        };

    const brandsRaw = raw.brands ?? raw.Brands ?? raw["Cigar brands"] ?? raw["Cigar Brands"];
    const brands = Array.isArray(brandsRaw)
      ? brandsRaw.map(toStr).filter(Boolean)
      : toStr(brandsRaw)
          ? toStr(brandsRaw).split(/[,|\n/]+/g).map(toStr).filter(Boolean)
          : [];

    const hours = raw.hours && typeof raw.hours === "object" ? raw.hours : null;

    const updates = toStr(raw.updates || raw.Updates || raw.update || raw.Update);
    const updateTime = toStr(raw.updateTime || raw.UpdateTime);

    const latitude = raw.latitude ?? raw.lat ?? raw.Latitude;
    const longitude = raw.longitude ?? raw.lng ?? raw.Longitude;

    return {
      slug,
      name,
      city,
      state,
      address,
      phone,
      website,
      email,
      amenities,
      brands,
      hours,
      updates,
      updateTime,
      latitude,
      longitude,
      raw
    };
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }

  async function loadShop(slug) {
    // 1) per-shop
    if (slug) {
      try {
        const per = await fetchJson(`/data/shops/${encodeURIComponent(slug)}.json?v=${Date.now()}`);
        return normalizeShop(per, slug);
      } catch {}
    }

    // 2) fallback list
    const arr = await fetchJson(`/shops/shops.json?v=${Date.now()}`);
    if (!Array.isArray(arr) || !arr.length) throw new Error("shops.json is empty");

    if (slug) {
      const hit =
        arr.find(x => slugify(x.slug || x.Slug || x.shop || x.Shop || x.name || x.Name) === slug) ||
        arr.find(x => sanitizeLogoName(x.Shop || x.name || "") === sanitizeLogoName(slug));
      if (hit) return normalizeShop(hit, slug);
    }

    return normalizeShop(arr[0], slug);
  }

  function setLogo(shop) {
    const img = $("#spLogo");
    if (!img) return;

    const base = shop.slug || sanitizeLogoName(shop.name);
    const svg = `/img/icons/shops/${base}.svg?v=${Date.now()}`;
    const png = `/img/icons/shops/${base}.png?v=${Date.now()}`;

    img.style.display = "block";

    img.onerror = () => {
      img.onerror = () => { img.style.display = "none"; };
      img.src = png;
    };

    img.src = svg;
  }

  function buildDirectionsUrl(shop) {
    const lat = Number(shop.latitude);
    const lng = Number(shop.longitude);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const q = hasCoords
      ? `${lat},${lng}`
      : (shop.address || [shop.name, shop.city, shop.state].filter(Boolean).join(", "));

    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=d`;
  }

  function renderHeader(shop) {
    $("#spName").textContent = shop.name || "Shop";
    $("#spCity").textContent = [shop.city, shop.state].filter(Boolean).join(", ");

    // City click => directions
    const addrBtn = $("#spAddressBtn");
    if (addrBtn) addrBtn.onclick = () => window.open(buildDirectionsUrl(shop), "_blank", "noopener");
  }

  function renderTAABadge(shop) {
    const badge = $("#spTaaIcon");               // ✅ correct ID
    if (!badge) return;

    const taa = isTruthy(shop.amenities?.taa) || isTruthy(shop.raw?.TAA);
    badge.style.display = taa ? "block" : "none"; // ✅ hide for non-TAA
  }

  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    if (!row) return;

    row.innerHTML = "";

    // per your request: show amenities icons only (no text)
    // and keep it simple: indoor, tvs, byob (max 3)
    const items = [
      { ok: isTruthy(shop.amenities?.indoor), icon: "/img/icons/indoorseating.svg", alt: "Indoor" },
      { ok: isTruthy(shop.amenities?.tvs), icon: "/img/icons/tv.svg", alt: "TV" },
      { ok: isTruthy(shop.amenities?.byob), icon: "/img/icons/byob.svg", alt: "BYOB" }
    ].filter(i => i.ok);

    items.forEach(a => {
      const img = document.createElement("img");
      img.src = `${a.icon}?v=${Date.now()}`;
      img.alt = a.alt;
      img.className = "sp-amen-icon";
      row.appendChild(img);
    });
  }

  function wireDock(shop) {
    const phone = toStr(shop.phone);
    const web = toStr(shop.website);
    const dirUrl = buildDirectionsUrl(shop);

    const callBtn = $("#spActCall");
    const webBtn = $("#spActWeb");
    const brandsBtn = $("#spActBrands");
    const dirBtn = $("#spActDir");

    if (callBtn) {
      if (!phone) callBtn.classList.add("is-disabled");
      callBtn.onclick = () => { if (phone) window.location.href = `tel:${phone.replace(/[^\d+]/g,"")}`; };
    }

    if (webBtn) {
      if (!web) webBtn.classList.add("is-disabled");
      webBtn.onclick = () => {
        if (!web) return;
        const url = /^https?:\/\//i.test(web) ? web : `https://${web}`;
        window.open(url, "_blank", "noopener");
      };
    }

    if (brandsBtn) {
      brandsBtn.onclick = () => activateTab("brands");
    }

    if (dirBtn) {
      dirBtn.onclick = () => window.open(dirUrl, "_blank", "noopener");
    }
  }

  function renderHours(shop) {
    const nowEl = $("#spHoursNow");
    const listEl = $("#spHoursList");
    if (!listEl) return;

    listEl.innerHTML = "";

    const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

    // NEW shape: hours: { mon:"10–6", tue:"..." } or full names
    function getHourForDay(d) {
      if (shop.hours && typeof shop.hours === "object") {
        const k3 = d.slice(0,3).toLowerCase();
        const v = toStr(shop.hours[k3] ?? shop.hours[d] ?? shop.hours[d.toLowerCase()]);
        return v;
      }
      // fallback legacy columns
      return toStr(shop.raw?.[d] ?? shop.raw?.[d.toLowerCase()] ?? shop.raw?.[d.slice(0,3)] ?? shop.raw?.[d.slice(0,3).toLowerCase()]);
    }

    const rows = days.map((d) => {
      const v = getHourForDay(d);
      const show = v && !["-","—","n/a","na"].includes(v.toLowerCase()) ? v : "—";
      const row = document.createElement("div");
      row.className = "sp-hour-row";
      row.innerHTML = `<div class="sp-hour-d">${d}</div><div class="sp-hour-v">${show}</div>`;
      return row;
    });

    rows.forEach(r => listEl.appendChild(r));

    // simple “Now” label (optional)
    if (nowEl) nowEl.textContent = "—";
  }

  function renderContact(shop) {
    const kv = $("#spContactKv");
    if (!kv) return;

    const phone = toStr(shop.phone) || "—";
    const web = toStr(shop.website) || "—";
    const addr = toStr(shop.address) || [shop.city, shop.state].filter(Boolean).join(", ") || "—";

    kv.innerHTML = `
      <div class="sp-kv-row"><div class="sp-kv-k">Phone</div><div class="sp-kv-v">${phone}</div></div>
      <div class="sp-kv-row"><div class="sp-kv-k">Website</div><div class="sp-kv-v">${web}</div></div>
      <div class="sp-kv-row"><div class="sp-kv-k">Address</div><div class="sp-kv-v">${addr}</div></div>
    `;
  }

  function renderBrands(shop) {
    const wrap = $("#spBrandChips");
    const empty = $("#spBrandsEmpty");
    if (!wrap) return;

    wrap.innerHTML = "";

    const brands = (shop.brands || []).map(toStr).filter(Boolean);

    if (!brands.length) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    brands.forEach((b) => {
      const chip = document.createElement("div");
      chip.className = "sp-chip";
      chip.textContent = b;
      wrap.appendChild(chip);
    });
  }

  function renderUpdates(shop) {
    const txt = $("#spUpdateText");
    const t = $("#spUpdateTime");
    if (txt) txt.textContent = shop.updates || "No updates yet.";
    if (t) t.textContent = shop.updateTime || "—";
  }

  function activateTab(which) {
    const tabs = {
      overview: { btn: $("#spTabOverview"), panel: $("#spPanelOverview") },
      brands: { btn: $("#spTabBrands"), panel: $("#spPanelBrands") },
      updates: { btn: $("#spTabUpdates"), panel: $("#spPanelUpdates") }
    };

    Object.keys(tabs).forEach((k) => {
      tabs[k].btn?.classList.toggle("is-active", k === which);
      tabs[k].btn?.setAttribute("aria-selected", String(k === which));
      tabs[k].panel?.classList.toggle("is-active", k === which);
    });
  }

  function wireTabs() {
    $("#spTabOverview")?.addEventListener("click", () => activateTab("overview"));
    $("#spTabBrands")?.addEventListener("click", () => activateTab("brands"));
    $("#spTabUpdates")?.addEventListener("click", () => activateTab("updates"));
  }

  async function init() {
    const slug = getSlugFromUrl();
    const shop = await loadShop(slug);

    renderHeader(shop);
    renderTAABadge(shop);
    setLogo(shop);

    renderAmenities(shop);
    wireDock(shop);

    wireTabs();
    activateTab("overview");

    renderHours(shop);
    renderContact(shop);
    renderBrands(shop);
    renderUpdates(shop);
  }

  init().catch((err) => {
    console.error("[shop.js] init failed:", err);
    const name = $("#spName");
    if (name) name.textContent = "Shop not found";
    const city = $("#spCity");
    if (city) city.textContent = "—";
  });
})();
