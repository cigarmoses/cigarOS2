/* /shops/shop.js
   FULL REPLACEMENT FILE (v13.4)
   - Loads correct shop by ?shop=slug
   - Prefers /data/shops/{slug}.json, fallback /shops/shops.json
   - Uses slug for shop logo lookup (svg -> png fallback)
   - TAA badge hidden by default; only shows when taa=true
   - Panels CLOSED by default; tabs open panels
   - Dock Brands opens modal grid (4 across) of brand SVG icons (no shading)
   - Amenity icons clickable with toast descriptions
   - Dock Instagram button opens Instagram if present; hides if missing
   - Stronger normalization for Phone/Website/Instagram fields + cache bust
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "yes", "y", "x"].includes(s);
  }

  function getSlugFromUrl() {
    const u = new URL(window.location.href);
    return (u.searchParams.get("shop") || "").trim().toLowerCase();
  }

  function cleanStr(v) {
    if (v == null) return "";
    const s = String(v).trim();
    if (!s) return "";
    const low = s.toLowerCase();
    if (low === "nan" || low === "null" || low === "undefined") return "";
    return s;
  }

  function normalizePhone(v) {
    const s = cleanStr(v);
    if (!s) return "";
    // Keep + and digits only (tel: works better)
    const out = s.replace(/[^\d+]/g, "");
    return out;
  }

  function normalizeWebsite(v) {
    const s = cleanStr(v);
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    // If someone stored "www.site.com" or "site.com"
    return `https://${s.replace(/^\/+/, "")}`;
  }

  function normalizeInstagramUrl(v) {
    const s = cleanStr(v);
    if (!s) return "";

    // Already a URL
    if (/^https?:\/\//i.test(s)) return s;

    // Handle @username or username
    const handle = s.replace(/^@/, "").trim();
    if (!handle) return "";

    return `https://instagram.com/${handle}`;
  }

  function normalizeShop(raw, fallbackSlug) {
    const slug =
      cleanStr(raw.slug || raw.Slug || raw.slug_id || raw.fileSlug || fallbackSlug || "")
        .toLowerCase();

    const name = cleanStr(raw.name || raw.Shop || raw.shop || raw.Title);
    const city = cleanStr(raw.city || raw.City);
    const state = cleanStr(raw.state || raw.ST || raw.State);

    const address = cleanStr(raw.address || raw.Address);

    // ✅ More robust phone/website field mapping
    const phone = normalizePhone(
      raw.phone ??
      raw.Phone ??
      raw["Phone"] ??
      raw["Phone "] ??
      raw.Cell ??
      raw["Cell"] ??
      raw["Cell "]
    );

    const website = normalizeWebsite(
      raw.website ??
      raw.Website ??
      raw["Website"] ??
      raw["website"] ??
      raw["URL"] ??
      raw.url
    );

    const email = cleanStr(raw.email || raw.Email);

    // ✅ Instagram column support (Instagram / instagram / IG / handle)
    const instagramRaw = cleanStr(
      raw.instagram ??
      raw.Instagram ??
      raw["Instagram"] ??
      raw.ig ??
      raw.IG ??
      raw["IG"] ??
      raw["Instagram Handle"]
    );
    const instagram = instagramRaw; // keep raw for About panel
    const instagramUrl = normalizeInstagramUrl(instagramRaw);

    // Amenities (support both nested and sheet-style columns)
    const amenities =
      raw.amenities && typeof raw.amenities === "object"
        ? raw.amenities
        : {
            byob: raw.BYOB,
            tvs: raw.TVs,
            indoor: raw.Indoor,
            outdoor: raw.Outdoor,
            food: raw.Food,
            alcohol: raw.Alcohol,
            noalcohol: raw["No Alcohol"] || raw.NoAlcohol,
            quiet: raw.Quiet,
            livemusic: raw["Live Music"] || raw.LiveMusic,
            taa: raw.TAA,
          };

    // Brands: array preferred; string fallback
    const brands = Array.isArray(raw.brands)
      ? raw.brands
      : typeof raw.Brands === "string"
      ? raw.Brands.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Hours: support per-shop JSON "hours" or sheet fields Monday..Sunday
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

    return {
      slug,
      name,
      city,
      state,
      address,
      phone,
      website,
      email,
      instagram,
      instagramUrl,
      amenities,
      brands,
      hours,
      raw,
    };
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

  async function loadShop(slug) {
    if (slug) {
      try {
        const per = await fetchJson(`/data/shops/${encodeURIComponent(slug)}.json`);
        return normalizeShop(per, slug);
      } catch (e) {
        // fall through
      }
    }

    const arr = await fetchJson(`/shops/shops.json`);
    if (!Array.isArray(arr) || !arr.length) throw new Error("shops.json is empty");

    if (slug) {
      const hit =
        arr.find((x) => cleanStr(x.slug || x.Slug).toLowerCase() === slug) ||
        arr.find((x) =>
          cleanStr(x.Shop || x.name || x.Title)
            .toLowerCase()
            .replace(/\s+/g, "") === slug.replace(/\s+/g, "")
        );
      if (hit) return normalizeShop(hit, slug);
    }

    return normalizeShop(arr[0], slug);
  }

  async function setShopLogo(slug) {
    const img = $("#spLogo");
    if (!img || !slug) return;

    const svg = `/img/icons/shops/${slug}.svg`;
    const png = `/img/icons/shops/${slug}.png`;

    img.onerror = () => {
      img.onerror = () => {
        img.style.display = "none";
      };
      img.src = png;
    };
    img.src = svg;
  }

  function renderHeader(shop) {
    const name = shop.name || "Shop";
    const cityState = [shop.city, shop.state].filter(Boolean).join(", ") || "City, ST";

    const nameEl = $("#spName");
    const cityEl = $("#spCity");

    if (nameEl) nameEl.textContent = name;
    if (cityEl) cityEl.textContent = cityState;
  }

  function renderTAABadge(shop) {
    const taaIcon = $("#spTaaIcon");
    if (!taaIcon) return;

    // default hidden (HTML already sets display:none; keep it safe)
    const taa = isTruthy(shop.amenities?.taa) || isTruthy(shop.raw?.TAA);
    taaIcon.style.display = taa ? "" : "none";
  }

  // Toast
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

  function wireDock(shop) {
    const callBtn = $("#spActCall");
    const webBtn = $("#spActWeb");
    const brandsBtn = $("#spActBrands");
    const dirBtn = $("#spActDir");
    const igBtn = $("#spActInstagram");

    // Call
    if (callBtn) {
      callBtn.onclick = () => {
        if (shop.phone) window.location.href = `tel:${shop.phone}`;
      };
      callBtn.disabled = !shop.phone;
      callBtn.style.opacity = shop.phone ? "" : ".45";
    }

    // Web
    if (webBtn) {
      webBtn.onclick = () => {
        if (shop.website) window.open(shop.website, "_blank", "noopener");
      };
      webBtn.disabled = !shop.website;
      webBtn.style.opacity = shop.website ? "" : ".45";
    }

    // Brands
    if (brandsBtn) {
      brandsBtn.onclick = () => openBrandsModal(shop.brands || []);
    }

    // Directions
    if (dirBtn) {
      dirBtn.onclick = () => {
        const dest = shop.address || [shop.city, shop.state].filter(Boolean).join(", ");
        if (!dest) return;
        window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`, "_blank", "noopener");
      };
      const ok = !!(shop.address || shop.city || shop.state);
      dirBtn.disabled = !ok;
      dirBtn.style.opacity = ok ? "" : ".45";
    }

    // Instagram (hide if missing)
    if (igBtn) {
      const url = shop.instagramUrl || "";
      if (!url) {
        igBtn.style.display = "none";
      } else {
        igBtn.style.display = "";
        igBtn.onclick = () => window.open(url, "_blank", "noopener");
        igBtn.disabled = false;
        igBtn.style.opacity = "";
      }
    }
  }

  // Tabs CLOSED by default; tabs open panels
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
    if (!which) {
      closeAllPanels();
      return;
    }

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
    const s = cleanStr(v);
    if (!s || s === "—" || s.includes("â")) return "";
    return s;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
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

    const any = days.some((d) => d[1]);
    list.innerHTML = "";

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
      ["Website", shop.website || "—"],
      ["Instagram", shop.instagram || "—"],
      ["Email", shop.email || "—"],
    ];

    el.innerHTML = items
      .map(
        ([k, v]) => `
          <div class="sp-about-item">
            <div class="sp-about-k">${escapeHtml(k)}</div>
            <div class="sp-about-v">${escapeHtml(v)}</div>
          </div>
        `
      )
      .join("");
  }

  // Brands Modal (4 across, SVG icons, no shading)
  function openBrandsModal(brands) {
    const modal = $("#spBrandsModal");
    const grid = $("#spBrandsGrid");
    if (!modal || !grid) return;

    grid.innerHTML = "";

    const list = Array.isArray(brands) ? brands : [];
    if (!list.length) {
      grid.innerHTML = `<div style="padding:10px 6px;color:#8e8e93;font-weight:600;">No brands listed.</div>`;
    } else {
      list.forEach((b) => {
        const slug = cleanStr(b);
        if (!slug) return;

        const item = document.createElement("div");
        item.className = "sp-brand";

        const img = document.createElement("img");
        img.className = "sp-brand-ico";
        img.alt = slug;

        const svg = `/img/icons/brands/${encodeURIComponent(slug)}.svg`;
        const png = `/img/icons/brands/${encodeURIComponent(slug)}.png`;

        img.onerror = () => {
          img.onerror = null;
          img.src = png;
        };
        img.src = svg;

        const name = document.createElement("div");
        name.className = "sp-brand-name";
        name.textContent = slug;

        item.appendChild(img);
        item.appendChild(name);
        grid.appendChild(item);
      });
    }

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

  async function init() {
    wireTabs();
    wireBrandsModal();

    const slug = getSlugFromUrl();
    const shop = await loadShop(slug);

    renderHeader(shop);
    await setShopLogo(shop.slug || slug);
    renderTAABadge(shop);
    renderAmenities(shop);
    wireDock(shop);

    renderHours(shop);
    renderAbout(shop);

    setActivePanel(null);
  }

  init().catch((err) => console.error("[shop.js] init failed:", err));
})();
