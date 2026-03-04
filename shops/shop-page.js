/* /shops/shop-page.js
   FULL REPLACEMENT
   - Loads by ?shop=slug
   - Prefers /data/shops/{slug}.json but merges missing fields from /shops/shops.json
   - Logo: /img/icons/shops/{slug}.svg then png fallback
   - TAA badge only if true
   - Instagram button hides if missing
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function cleanStr(v){ return String(v ?? "").trim(); }

  function isTruthy(v){
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1","true","yes","y","x"].includes(s);
  }

  function getSlugFromUrl(){
    const u = new URL(window.location.href);
    return (u.searchParams.get("shop") || "").trim().toLowerCase();
  }

  function normalizeShop(raw, fallbackSlug){
    const slug = cleanStr(raw.slug || raw.Slug || raw.slug_id || fallbackSlug).toLowerCase();

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
        : {
            byob: raw.BYOB,
            tvs: raw.TVs,
            indoor: raw.Indoor,
            outdoor: raw.Outdoor,
            food: raw.Food,
            alcohol: raw.Alcohol,
            taa: raw.TAA,
          };

    const brands = Array.isArray(raw.brands)
      ? raw.brands
      : typeof raw.Brands === "string"
      ? raw.Brands.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

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

    return { slug, name, city, state, address, phone, website, email, instagram, amenities, brands, hours, raw };
  }

  function mergePreferA(a, b){
    const out = { ...b, ...a };

    const prefer = (key) => {
      const av = cleanStr(a?.[key]);
      const bv = cleanStr(b?.[key]);
      out[key] = av ? av : bv;
    };

    prefer("slug");
    prefer("name");
    prefer("city");
    prefer("state");
    prefer("address");
    prefer("phone");
    prefer("website");
    prefer("email");
    prefer("instagram");

    out.amenities = { ...(b?.amenities || {}), ...(a?.amenities || {}) };
    out.brands = (Array.isArray(a?.brands) && a.brands.length) ? a.brands : (Array.isArray(b?.brands) ? b.brands : []);
    out.hours = { ...(b?.hours || {}), ...(a?.hours || {}) };
    out.raw = a?.raw || b?.raw || {};

    return out;
  }

  function withCacheBust(url){
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${Date.now()}`;
  }

  async function fetchJson(url){
    const res = await fetch(withCacheBust(url), { cache:"no-store" });
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }

  function findInMaster(arr, slug){
    if (!Array.isArray(arr)) return null;
    const s = String(slug || "").trim().toLowerCase();
    if (!s) return null;

    return (
      arr.find((x) => String(x.slug || x.Slug || "").trim().toLowerCase() === s) ||
      arr.find((x) => {
        const name = String(x.Shop || x.name || "").trim().toLowerCase().replace(/\s+/g, "");
        return name && name === s.replace(/\s+/g, "");
      }) ||
      null
    );
  }

  async function loadShop(slug){
    let masterArr = [];
    try { masterArr = await fetchJson(`/shops/shops.json`); } catch(e){ masterArr = []; }

    if (slug) {
      try{
        const perRaw = await fetchJson(`/data/shops/${encodeURIComponent(slug)}.json`);
        const per = normalizeShop(perRaw, slug);

        const masterHitRaw = findInMaster(masterArr, slug);
        if (masterHitRaw) {
          const master = normalizeShop(masterHitRaw, slug);
          return mergePreferA(per, master);
        }
        return per;
      } catch(e){
        // fall through
      }
    }

    if (!Array.isArray(masterArr) || !masterArr.length) throw new Error("shops.json is empty or failed to load");

    if (slug) {
      const hit = findInMaster(masterArr, slug);
      if (hit) return normalizeShop(hit, slug);
    }

    return normalizeShop(masterArr[0], slug);
  }

  async function setShopLogo(slug){
    const img = $("#spLogo");
    if(!img || !slug) return;

    const svg = `/img/icons/shops/${slug}.svg`;
    const png = `/img/icons/shops/${slug}.png`;

    img.onerror = () => {
      img.onerror = () => { img.style.display = "none"; };
      img.src = png;
    };
    img.src = svg;
  }

  function renderHeader(shop){
    const nameEl = $("#spName");
    const cityEl = $("#spCity");

    if (nameEl) nameEl.textContent = shop.name || "Shop";
    if (cityEl) cityEl.textContent = [shop.city, shop.state].filter(Boolean).join(", ") || "—";
  }

  function renderTAABadge(shop){
    const el = $("#spTaa");
    if(!el) return;
    const taa = isTruthy(shop.amenities?.taa) || isTruthy(shop.raw?.TAA);
    el.hidden = !taa;
  }

  // Toast
  let toastTimer = null;
  function showToast(msg){
    const el = $("#spToast");
    if(!el) return;
    el.textContent = msg;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1600);
  }

  function renderAmenities(shop){
    const row = $("#spAmenRow");
    if(!row) return;
    row.innerHTML = "";

    const items = [
      { ok: isTruthy(shop.amenities?.indoor),  icon:"/img/icons/indoorseating.svg", text:"Indoor seating available" },
      { ok: isTruthy(shop.amenities?.tvs),     icon:"/img/icons/tv.svg",            text:"TVs available" },
      { ok: isTruthy(shop.amenities?.byob),    icon:"/img/icons/byob.svg",          text:"BYOB allowed" },
      { ok: isTruthy(shop.amenities?.food),    icon:"/img/icons/food.svg",          text:"Food available" },
      { ok: isTruthy(shop.amenities?.alcohol), icon:"/img/icons/alcohol.svg",       text:"Alcohol available" },
    ].filter(x => x.ok);

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

  function normalizeWebsiteUrl(v){
    const s = String(v || "").trim();
    if(!s) return "";
    if(/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  }

  function normalizeInstagramUrl(v){
    const s = String(v || "").trim();
    if(!s) return "";
    if(/^https?:\/\//i.test(s)) return s;
    const handle = s.replace(/^@/, "").trim();
    if(!handle) return "";
    return `https://instagram.com/${handle}`;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function renderHours(shop){
    const list = $("#spHoursList");
    const now = $("#spHoursNow");
    if(!list) return;

    const cleanHourValue = (v) => {
      if (v == null) return "";
      const s = String(v).trim();
      if (!s || s === "—" || s.toLowerCase() === "nan" || s.includes("â")) return "";
      return s;
    };

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

    if(!any){
      list.innerHTML = `<div class="sp-hours-row"><div class="sp-hours-day">Coming soon</div><div class="sp-hours-val">—</div></div>`;
      if(now) now.textContent = "—";
      return;
    }

    days.forEach(([day, val]) => {
      const v = val || "—";
      const row = document.createElement("div");
      row.className = "sp-hours-row";
      row.innerHTML = `<div class="sp-hours-day">${escapeHtml(day)}</div><div class="sp-hours-val">${escapeHtml(v)}</div>`;
      list.appendChild(row);
    });

    if(now) now.textContent = "—";
  }

  function renderAbout(shop){
    const el = $("#spAbout");
    if(!el) return;

    const items = [
      ["Address", shop.address || "—"],
      ["Phone", shop.phone || "—"],
      ["Website", shop.website || "—"],
      ["Instagram", shop.instagram || "—"],
      ["Email", shop.email || "—"],
    ];

    el.innerHTML = items.map(([k, v]) => `
      <div class="sp-about-item">
        <div class="sp-about-k">${escapeHtml(k)}</div>
        <div class="sp-about-v">${escapeHtml(v)}</div>
      </div>
    `).join("");
  }

  // Brands modal
  function openBrandsModal(brands){
    const modal = $("#spBrandsModal");
    const grid = $("#spBrandsGrid");
    if(!modal || !grid) return;

    grid.innerHTML = "";

    const list = Array.isArray(brands) ? brands : [];
    if(!list.length){
      grid.innerHTML = `<div style="padding:10px 6px;color:#8e8e93;font-weight:700;">No brands listed.</div>`;
    } else {
      list.forEach((b) => {
        const slug = String(b || "").trim();
        if(!slug) return;

        const item = document.createElement("div");
        item.className = "sp-brand";

        const img = document.createElement("img");
        img.className = "sp-brand-ico";
        img.alt = slug;

        const svg = `/img/icons/brands/${encodeURIComponent(slug)}.svg`;
        const png = `/img/icons/brands/${encodeURIComponent(slug)}.png`;
        img.onerror = () => { img.onerror = null; img.src = png; };
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

  function closeBrandsModal(){
    const modal = $("#spBrandsModal");
    if(modal) modal.hidden = true;
  }

  function wireBrandsModal(){
    const bg = $("#spBrandsCloseBg");
    const btn = $("#spBrandsCloseBtn");
    if(bg) bg.onclick = closeBrandsModal;
    if(btn) btn.onclick = closeBrandsModal;
    window.addEventListener("keydown", (e) => { if(e.key === "Escape") closeBrandsModal(); });
  }

  function wireDock(shop){
    const callBtn = $("#spActCall");
    const webBtn = $("#spActWeb");
    const brandsBtn = $("#spActBrands");
    const dirBtn = $("#spActDir");
    const igBtn = $("#spActInstagram");

    // CALL
    if(callBtn){
      const phone = cleanStr(shop.phone);
      callBtn.onclick = () => { if(phone) window.location.href = `tel:${phone}`; };
      callBtn.disabled = !phone;
      callBtn.style.opacity = phone ? "" : ".45";
    }

    // WEB
    if(webBtn){
      const url = normalizeWebsiteUrl(shop.website);
      webBtn.onclick = () => { if(url) window.open(url, "_blank", "noopener"); };
      webBtn.disabled = !url;
      webBtn.style.opacity = url ? "" : ".45";
    }

    // BRANDS
    if(brandsBtn){
      brandsBtn.onclick = () => openBrandsModal(shop.brands || []);
    }

    // DIRECTIONS
    if(dirBtn){
      const ok = !!(shop.address || shop.city || shop.state);
      dirBtn.onclick = () => {
        const dest = shop.address || [shop.city, shop.state].filter(Boolean).join(", ");
        if(!dest) return;
        window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`, "_blank", "noopener");
      };
      dirBtn.disabled = !ok;
      dirBtn.style.opacity = ok ? "" : ".45";
    }

    // INSTAGRAM
    if(igBtn){
      const igUrl = normalizeInstagramUrl(shop.instagram);
      if(!igUrl){
        igBtn.style.display = "none";
      } else {
        igBtn.style.display = "";
        igBtn.onclick = () => window.open(igUrl, "_blank", "noopener");
        igBtn.disabled = false;
        igBtn.style.opacity = "";
      }
    }
  }

  // Tabs
  function closeAllPanels(){
    const tabs = [
      { tab: $("#spTabHours"), panel: $("#spPanelHours") },
      { tab: $("#spTabAbout"), panel: $("#spPanelAbout") },
      { tab: $("#spTabUpdates"), panel: $("#spPanelUpdates") },
    ];
    tabs.forEach((t) => {
      if(t.tab){ t.tab.classList.remove("is-active"); t.tab.setAttribute("aria-selected","false"); }
      if(t.panel){ t.panel.classList.remove("is-active"); t.panel.setAttribute("aria-hidden","true"); }
    });
  }

  function setActivePanel(which){
    if(!which) return closeAllPanels();

    const tabs = [
      { key:"hours",   tab:$("#spTabHours"),   panel:$("#spPanelHours") },
      { key:"about",   tab:$("#spTabAbout"),   panel:$("#spPanelAbout") },
      { key:"updates", tab:$("#spTabUpdates"), panel:$("#spPanelUpdates") },
    ];

    tabs.forEach((t) => {
      const on = t.key === which;
      if(t.tab){ t.tab.classList.toggle("is-active", on); t.tab.setAttribute("aria-selected", on ? "true" : "false"); }
      if(t.panel){ t.panel.classList.toggle("is-active", on); t.panel.setAttribute("aria-hidden", on ? "false" : "true"); }
    });
  }

  function wireTabs(){
    const tHours = $("#spTabHours");
    const tAbout = $("#spTabAbout");
    const tUpdates = $("#spTabUpdates");
    if(tHours) tHours.onclick = () => setActivePanel("hours");
    if(tAbout) tAbout.onclick = () => setActivePanel("about");
    if(tUpdates) tUpdates.onclick = () => setActivePanel("updates");
  }

  async function init(){
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

  init().catch((err) => console.error("[shop-page.js] init failed:", err));
})();
