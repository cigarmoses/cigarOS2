(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function cleanStr(v) {
    return String(v ?? "").trim();
  }

  function canonicalKey(s) {
    return cleanStr(s)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "yes", "y", "x"].includes(s);
  }

  function getKeyFromUrl() {
    const u = new URL(window.location.href);

    const qs = canonicalKey(u.searchParams.get("shop") || "");
    if (qs) return qs;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0] === "shops") {
      return canonicalKey(parts[1]);
    }

    return "";
  }

  function withCacheBust(url) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${Date.now()}`;
  }

  async function fetchJson(url) {
    const res = await fetch(withCacheBust(url), { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }

  function normalizeFromMaster(raw) {
    const key = canonicalKey(
      raw.logoKey || raw.slug || raw.Slug || raw.slug_id || raw.name || raw.Shop || raw.shop || ""
    );

    const name = cleanStr(raw.name || raw.Shop || raw.shop);
    const city = cleanStr(raw.city || raw.City);
    const state = cleanStr(raw.state || raw.ST || raw.State);

    const address =
      cleanStr(raw.address || raw.Address) ||
      [cleanStr(raw.address1), cleanStr(raw.address2)].filter(Boolean).join(" ").trim();

    const phone = cleanStr(raw.phone || raw.Phone || raw.Cell);
    const website = cleanStr(raw.website || raw.Website);
    const email = cleanStr(raw.email || raw.Email);
    const instagram = cleanStr(raw.instagram || raw.Instagram);

    const f = raw.features || raw.Features || {};
    const amenities =
      raw.amenities && typeof raw.amenities === "object"
        ? raw.amenities
        : {
            byob: f.byob,
            tvs: f.tvs,
            indoor: f.indoorSeating,
            outdoor: f.outdoorSeating,
            food: f.food,
            alcohol: f.alcohol,
            noalcohol: f.noAlcohol,
            quiet: f.quietSpace,
            livemusic: f.liveMusic,
            taa: f.taa,
          };

    const hours =
      raw.hours && typeof raw.hours === "object"
        ? raw.hours
        : {
            mon: raw.mon || raw.Monday,
            tue: raw.tue || raw.Tuesday,
            wed: raw.wed || raw.Wednesday,
            thu: raw.thu || raw.Thursday,
            fri: raw.fri || raw.Friday,
            sat: raw.sat || raw.Saturday,
            sun: raw.sun || raw.Sunday,
          };

    const brands = Array.isArray(raw.brands)
      ? raw.brands
      : typeof raw.Brands === "string"
        ? raw.Brands.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    return {
      key,
      name,
      city,
      state,
      address,
      phone,
      website,
      email,
      instagram,
      amenities,
      hours,
      brands,
      raw,
    };
  }

  function normalizeFromPerShop(raw, fallbackKey) {
    const key = canonicalKey(raw.slug || raw.Slug || raw.slug_id || fallbackKey);
    const name = cleanStr(raw.name || raw.Shop || raw.shop);
    const city = cleanStr(raw.city || raw.City);
    const state = cleanStr(raw.state || raw.ST || raw.State);

    const address = cleanStr(raw.address || raw.Address);
    const phone = cleanStr(raw.phone || raw.Phone || raw.Cell);
    const website = cleanStr(raw.website || raw.Website);
    const email = cleanStr(raw.email || raw.Email);
    const instagram = cleanStr(raw.instagram || raw.Instagram);

    const amenities =
      raw.amenities && typeof raw.amenities === "object"
        ? raw.amenities
        : { taa: raw.TAA };

    const hours =
      raw.hours && typeof raw.hours === "object"
        ? raw.hours
        : {
            mon: raw.mon || raw.Monday,
            tue: raw.tue || raw.Tuesday,
            wed: raw.wed || raw.Wednesday,
            thu: raw.thu || raw.Thursday,
            fri: raw.fri || raw.Friday,
            sat: raw.sat || raw.Saturday,
            sun: raw.sun || raw.Sunday,
          };

    const brands = Array.isArray(raw.brands)
      ? raw.brands
      : typeof raw.Brands === "string"
        ? raw.Brands.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    return {
      key,
      name,
      city,
      state,
      address,
      phone,
      website,
      email,
      instagram,
      amenities,
      hours,
      brands,
      raw,
    };
  }

  function mergePreferA(a, b) {
    const out = { ...b, ...a };

    const prefer = (k) => {
      const av = cleanStr(a?.[k]);
      const bv = cleanStr(b?.[k]);
      out[k] = av ? av : bv;
    };

    ["key", "name", "city", "state", "address", "phone", "website", "email", "instagram"].forEach(prefer);

    out.amenities = { ...(b?.amenities || {}), ...(a?.amenities || {}) };
    out.hours = { ...(b?.hours || {}), ...(a?.hours || {}) };
    out.brands =
      Array.isArray(a?.brands) && a.brands.length
        ? a.brands
        : Array.isArray(b?.brands)
          ? b.brands
          : [];
    out.raw = a?.raw || b?.raw || {};

    return out;
  }

  function findInMaster(masterArr, key) {
    if (!Array.isArray(masterArr) || !key) return null;
    const k = canonicalKey(key);

    return (
      masterArr.find((x) => canonicalKey(x.logoKey || "") === k) ||
      masterArr.find((x) => canonicalKey(x.slug || x.Slug || x.slug_id || "") === k) ||
      masterArr.find((x) => canonicalKey(x.name || x.Shop || x.shop || "") === k) ||
      null
    );
  }

  async function loadShop(key) {
    let masterArr = [];
    try {
      masterArr = await fetchJson("/shops/shops.json");
    } catch (e) {
      masterArr = [];
    }

    if (key) {
      try {
        const perRaw = await fetchJson(`/data/shops/${encodeURIComponent(key)}.json`);
        const per = normalizeFromPerShop(perRaw, key);

        const hit = findInMaster(masterArr, key);
        if (hit) {
          const master = normalizeFromMaster(hit);
          return mergePreferA(per, master);
        }
        return per;
      } catch (e) {
        // fallback to master-only below
      }
    }

    if (Array.isArray(masterArr) && masterArr.length) {
      if (key) {
        const hit = findInMaster(masterArr, key);
        if (hit) return normalizeFromMaster(hit);
      }
      return normalizeFromMaster(masterArr[0]);
    }

    return normalizeFromPerShop({ slug: key, name: "Shop" }, key);
  }

  function setShopLogo(key) {
    const img = $("#spLogo");
    if (!img || !key) return;

    const svg = `/img/icons/shops/${key}.svg`;
    const png = `/img/icons/shops/${key}.png`;

    img.alt = key;
    img.style.display = "";

    img.onerror = () => {
      img.onerror = () => {
        img.removeAttribute("src");
        img.style.display = "none";
      };
      img.src = png;
    };

    img.src = svg;
  }

  function renderHeader(shop) {
    const nameEl = $("#spName");
    const cityEl = $("#spCity");

    if (nameEl) nameEl.textContent = shop.name || "Shop";

    const cityState = [shop.city, shop.state].filter(Boolean).join(", ");
    if (cityEl) cityEl.textContent = cityState || "—";
  }

  function renderTAABadge(shop) {
    const taaEl = $("#spTaa");
    if (!taaEl) return;

    const taa =
      isTruthy(shop.amenities?.taa) ||
      isTruthy(shop.raw?.TAA) ||
      isTruthy(shop.raw?.features?.taa);

    taaEl.hidden = !taa;
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = $("#spToast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;

    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      el.hidden = true;
    }, 1600);
  }

  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    if (!row) return;

    row.innerHTML = "";

    const items = [
      { ok: isTruthy(shop.amenities?.indoor), icon: "/img/icons/indoorseating.svg", text: "Indoor seating available" },
      { ok: isTruthy(shop.amenities?.tvs), icon: "/img/icons/tv.svg", text: "TVs available" },
      { ok: isTruthy(shop.amenities?.byob), icon: "/img/icons/byob.svg", text: "BYOB allowed" },
      { ok: isTruthy(shop.amenities?.food), icon: "/img/icons/food.svg", text: "Food available" },
      { ok: isTruthy(shop.amenities?.alcohol), icon: "/img/icons/alcohol.svg", text: "Alcohol available" },
      { ok: isTruthy(shop.amenities?.quiet), icon: "/img/icons/quiet.svg", text: "Quiet space available" },
      { ok: isTruthy(shop.amenities?.livemusic), icon: "/img/icons/livemusic.svg", text: "Live music available" }
    ].filter((i) => i.ok);

    items.forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sp-amen-btn";
      btn.onclick = () => showToast(a.text);

      const img = document.createElement("img");
      img.src = a.icon;
      img.alt = a.text;
      img.className = "sp-amen-icon";

      btn.appendChild(img);
      row.appendChild(btn);
    });
  }

  function normalizeWebsiteUrl(v) {
    const s = cleanStr(v);
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  }

  function normalizeInstagramUrl(v) {
    const s = cleanStr(v);
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;

    const handle = s.replace(/^@/, "").trim();
    if (!handle) return "";
    return `https://instagram.com/${handle}`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function closeAllPanels() {
    const tabs = [
      { tab: $("#spTabHours"), panel: $("#spPanelHours") },
      { tab: $("#spTabAbout"), panel: $("#spPanelAbout") },
      { tab: $("#spTabUpdates"), panel: $("#spPanelUpdates") },
    ];

    tabs.forEach((t) => {
      if (t.tab) {
        t.tab.classList.remove("is-active");
        t.tab.setAttribute("aria-selected", "false");
      }
      if (t.panel) {
        t.panel.classList.remove("is-active");
        t.panel.setAttribute("aria-hidden", "true");
      }
    });
  }

  function setActivePanel(which) {
    if (!which) return closeAllPanels();

    const tabs = [
      { key: "hours", tab: $("#spTabHours"), panel: $("#spPanelHours") },
      { key: "about", tab: $("#spTabAbout"), panel: $("#spPanelAbout") },
      { key: "updates", tab: $("#spTabUpdates"), panel: $("#spPanelUpdates") },
    ];

    tabs.forEach((t) => {
      const on = t.key === which;
      if (t.tab) {
        t.tab.classList.toggle("is-active", on);
        t.tab.setAttribute("aria-selected", on ? "true" : "false");
      }
      if (t.panel) {
        t.panel.classList.toggle("is-active", on);
        t.panel.setAttribute("aria-hidden", on ? "false" : "true");
      }
    });
  }

  function wireTabs() {
    const tHours = $("#spTabHours");
    const tAbout = $("#spTabAbout");
    const tUpdates = $("#spTabUpdates");

    if (tHours) tHours.onclick = () => setActivePanel("hours");
    if (tAbout) tAbout.onclick = () => setActivePanel("about");
    if (tUpdates) tUpdates.onclick = () => setActivePanel("updates");
  }

  function cleanHourValue(v) {
    if (v == null) return "";
    const s = String(v).trim();
    if (!s || s === "—" || s.toLowerCase() === "nan" || s.includes("â")) return "";
    return s;
  }

  function renderHours(shop) {
    const list = $("#spHoursList");
    const now = $("#spHoursNow");
    if (!list) return;

    const days = [
      ["Monday", cleanHourValue(shop.hours?.mon)],
      ["Tuesday", cleanHourValue(shop.hours?.tue)],
      ["Wednesday", cleanHourValue(shop.hours?.wed)],
      ["Thursday", cleanHourValue(shop.hours?.thu)],
      ["Friday", cleanHourValue(shop.hours?.fri)],
      ["Saturday", cleanHourValue(shop.hours?.sat)],
      ["Sunday", cleanHourValue(shop.hours?.sun)],
    ];

    list.innerHTML = "";

    const any = days.some((d) => d[1]);
    if (!any) {
      list.innerHTML = `<div class="sp-hours-row"><div class="sp-hours-day">Coming soon</div><div class="sp-hours-val">—</div></div>`;
      if (now) now.textContent = "—";
      return;
    }

    days.forEach(([day, val]) => {
      const v = val || "—";
      const row = document.createElement("div");
      row.className = "sp-hours-row";
      row.innerHTML = `<div class="sp-hours-day">${escapeHtml(day)}</div><div class="sp-hours-val">${escapeHtml(v)}</div>`;
      list.appendChild(row);
    });

    if (now) now.textContent = "—";
  }

  function renderAbout(shop) {
    const el = $("#spAbout");
    if (!el) return;

    const items = [
      ["Address", shop.address || "—"],
      ["Phone", shop.phone || "—"],
      ["Email", shop.email || "—"],
    ];

    el.innerHTML = items.map(([k, v]) => `
      <div class="sp-about-item">
        <div class="sp-about-k">${escapeHtml(k)}</div>
        <div class="sp-about-v">${escapeHtml(v)}</div>
      </div>
    `).join("");
  }

  function openBrandsModal(brands) {
    const modal = $("#spBrandsModal");
    const grid = $("#spBrandsGrid");
    if (!modal || !grid) return;

    grid.innerHTML = "";
    const list = Array.isArray(brands) ? brands : [];

    if (!list.length) {
      grid.innerHTML = `<div style="padding:10px 6px;color:#8e8e93;font-weight:700;">No brands listed.</div>`;
      modal.hidden = false;
      return;
    }

    list.forEach((b) => {
      const raw = cleanStr(b);
      if (!raw) return;

      const exact = encodeURIComponent(raw);
      const key = canonicalKey(raw);
      const keyEnc = encodeURIComponent(key);

      const item = document.createElement("div");
      item.className = "sp-brand";

      const img = document.createElement("img");
      img.className = "sp-brand-ico";
      img.alt = raw;

      const candidates = [
        `/img/icons/brands/${exact}.svg`,
        `/img/icons/brands/${exact}.png`,
        `/img/icons/brands/${keyEnc}.svg`,
        `/img/icons/brands/${keyEnc}.png`
      ];

      let idx = 0;
      img.onerror = () => {
        idx += 1;
        if (idx < candidates.length) {
          img.src = candidates[idx];
        } else {
          img.onerror = null;
          img.style.display = "none";
        }
      };

      img.src = candidates[0];

      const name = document.createElement("div");
      name.className = "sp-brand-name";
      name.textContent = raw;

      item.appendChild(img);
      item.appendChild(name);
      grid.appendChild(item);
    });

    modal.hidden = false;
  }

  function closeBrandsModal() {
    const modal = $("#spBrandsModal");
    if (modal) modal.hidden = true;
  }

  function wireBrandsModal() {
    const bg = $("#spBrandsCloseBg");
    const btn = $("#spBrandsCloseBtn");

    if (bg) bg.onclick = closeBrandsModal;
    if (btn) btn.onclick = closeBrandsModal;

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBrandsModal();
    });
  }

  function hideIfMissing(btn, ok) {
    if (!btn) return;
    btn.hidden = !ok;
  }

  function wireDock(shop) {
    const callBtn = $("#spActCall");
    const webBtn = $("#spActWeb");
    const brandsBtn = $("#spActBrands");
    const dirBtn = $("#spActDir");
    const igBtn = $("#spActInstagram");

    const phone = cleanStr(shop.phone);
    const webUrl = normalizeWebsiteUrl(shop.website);
    const brandList = Array.isArray(shop.brands) ? shop.brands : [];
    const dest = cleanStr(shop.address) || [shop.city, shop.state].filter(Boolean).join(", ");
    const igUrl = normalizeInstagramUrl(shop.instagram);

    hideIfMissing(callBtn, !!phone);
    hideIfMissing(webBtn, !!webUrl);
    hideIfMissing(brandsBtn, brandList.length > 0);
    hideIfMissing(dirBtn, !!dest);
    hideIfMissing(igBtn, !!igUrl);

    if (callBtn && phone) {
      callBtn.onclick = () => { window.location.href = `tel:${phone}`; };
    }

    if (webBtn && webUrl) {
      webBtn.onclick = () => { window.open(webUrl, "_blank", "noopener"); };
    }

    if (brandsBtn && brandList.length) {
      brandsBtn.onclick = () => openBrandsModal(brandList);
    }

    if (dirBtn && dest) {
      dirBtn.onclick = () => {
        window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`, "_blank", "noopener");
      };
    }

    if (igBtn && igUrl) {
      igBtn.onclick = () => window.open(igUrl, "_blank", "noopener");
    }
  }

  async function init() {
    wireTabs();
    wireBrandsModal();

    const urlKey = getKeyFromUrl();
    const shop = await loadShop(urlKey);
    const assetKey = canonicalKey(shop.key || urlKey);

    renderHeader(shop);
    setShopLogo(assetKey);
    renderTAABadge(shop);
    renderAmenities(shop);
    renderHours(shop);
    renderAbout(shop);
    wireDock(shop);

    setActivePanel(null);
  }

  init().catch((err) => {
    console.error("[shop-page.js] init failed:", err);
  });
})();
