(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const DEFAULT_SHOP_ICON = "/uxui/darkmode/darkmodeshops.png";

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

    const qsId = canonicalKey(u.searchParams.get("id") || "");
    if (qsId) return qsId;

    const parts = u.pathname.split("/").filter(Boolean);

    if (parts.length >= 2 && parts[0] === "shops") {
      const second = canonicalKey(parts[1]);
      if (second && second !== "shoppagehtml") return second;
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
      key,
      name: cleanStr(raw.name || raw.Shop || raw.shop),
      city: cleanStr(raw.city || raw.City),
      state: cleanStr(raw.state || raw.ST || raw.State),
      address: cleanStr(raw.address || raw.Address),
      phone: cleanStr(raw.phone || raw.Phone || raw.Cell),
      website: cleanStr(raw.website || raw.Website),
      email: cleanStr(raw.email || raw.Email),
      instagram: cleanStr(raw.instagram || raw.Instagram),
      amenities: raw.amenities || {},
      hours,
      brands: raw.brands || [],
      raw,
    };
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
      list.innerHTML = `<div class="sp-hours-empty">Hours coming soon</div>`;
      if (now) now.textContent = "—";
      return;
    }

    days.forEach(([day, val]) => {
      if (!val) return;

      const row = document.createElement("div");
      row.className = "sp-hours-row";

      row.innerHTML = `
        <div class="sp-hours-day">${day}</div>
        <div class="sp-hours-val">${val}</div>
      `;

      list.appendChild(row);
    });

    if (now) now.textContent = "";
  }

  async function init() {
    const key = getKeyFromUrl();
    const shop = await fetchJson("/shops/shops.json").then(arr =>
      normalizeFromMaster(arr.find(s => canonicalKey(s.name) === key) || arr[0])
    );

    renderHours(shop);
  }

  init();
})();
