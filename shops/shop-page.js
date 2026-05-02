(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const DEFAULT_SHOP_ICON = "/uxui/darkmode/darkmodeshops.png";

  /* ---------------- UTIL ---------------- */
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

  /* ---------------- DATA ---------------- */
  function normalizeFromMaster(raw) {
    return {
      key: canonicalKey(raw.slug || raw.name),
      name: cleanStr(raw.name),
      city: cleanStr(raw.city),
      state: cleanStr(raw.state),
      address: cleanStr(raw.address),
      phone: cleanStr(raw.phone),
      website: cleanStr(raw.website),
      email: cleanStr(raw.email),
      instagram: cleanStr(raw.instagram),
      amenities: raw.amenities || raw.features || {},
      brands: raw.brands || [],
      hours: {
        mon: raw.mon || raw.Monday || "",
        tue: raw.tue || raw.Tuesday || "",
        wed: raw.wed || raw.Wednesday || "",
        thu: raw.thu || raw.Thursday || "",
        fri: raw.fri || raw.Friday || "",
        sat: raw.sat || raw.Saturday || "",
        sun: raw.sun || raw.Sunday || "",
      },
      raw
    };
  }

  async function loadShop(key) {
    const masterArr = await fetchJson("/shops/shops.json");

    const hit =
      masterArr.find(x => canonicalKey(x.slug) === key) ||
      masterArr.find(x => canonicalKey(x.name) === key) ||
      masterArr[0];

    return normalizeFromMaster(hit);
  }

  /* ---------------- HEADER ---------------- */
  function renderHeader(shop) {
    $("#spName").textContent = shop.name || "Shop";
    $("#spCity").textContent =
      [shop.city, shop.state].filter(Boolean).join(", ") || "—";
  }

  function setShopLogo(key, name) {
    const img = $("#spLogo");
    if (!img) return;

    const svg = `/img/icons/shops/${key}.svg`;
    const png = `/img/icons/shops/${key}.png`;

    img.onerror = () => {
      img.src = png;
      img.onerror = () => (img.src = DEFAULT_SHOP_ICON);
    };

    img.src = svg;
  }

  function renderTAABadge(shop) {
    const taaEl = $("#spTaa");
    if (!taaEl) return;

    const taa = isTruthy(shop.amenities?.taa);
    taaEl.hidden = !taa;
  }

  /* ---------------- OPEN STATUS ---------------- */
  function parseTime(str) {
    if (!str) return null;

    const m = str.match(/(\d{1,2}):?(\d{0,2})\s?(AM|PM)/i);
    if (!m) return null;

    let h = +m[1];
    let min = +(m[2] || 0);
    const pm = m[3].toUpperCase() === "PM";

    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;

    return h * 60 + min;
  }

  function getTodayHours(shop) {
    const d = new Date().getDay();
    const map = ["sun","mon","tue","wed","thu","fri","sat"];
    return shop.hours[map[d]];
  }

  function computeOpenStatus(shop) {
    const str = getTodayHours(shop);
    if (!str) return null;

    const parts = str.split("-");
    if (parts.length !== 2) return null;

    let open = parseTime(parts[0]);
    let close = parseTime(parts[1]);

    if (open == null || close == null) return null;

    const now = new Date();
    let nowMin = now.getHours() * 60 + now.getMinutes();

    // 🔥 Overnight fix
    if (close < open) {
      close += 1440;
      if (nowMin < open) nowMin += 1440;
    }

    const isOpen = nowMin >= open && nowMin <= close;

    return {
      open: isOpen,
      closeLabel: parts[1].trim()
    };
  }

  function renderStatus(shop) {
    const status = computeOpenStatus(shop);
    if (!status) return;

    const container = document.createElement("div");
    container.className = "sp-status";

    container.innerHTML = `
      <div class="sp-status-dot ${status.open ? "open" : "closed"}"></div>
      <div class="sp-status-text">
        ${status.open ? "Open Now" : "Closed"}
        <span>• Closes ${status.closeLabel}</span>
      </div>
    `;

    $(".sp-city").after(container);
  }

  /* ---------------- HOURS ---------------- */
  function cleanHourValue(v) {
    if (!v) return "";
    return String(v).trim();
  }

  function renderHours(shop) {
    const list = $("#spHoursList");
    const now = $("#spHoursNow");
    if (!list) return;

    const days = [
      ["Monday", cleanHourValue(shop.hours.mon)],
      ["Tuesday", cleanHourValue(shop.hours.tue)],
      ["Wednesday", cleanHourValue(shop.hours.wed)],
      ["Thursday", cleanHourValue(shop.hours.thu)],
      ["Friday", cleanHourValue(shop.hours.fri)],
      ["Saturday", cleanHourValue(shop.hours.sat)],
      ["Sunday", cleanHourValue(shop.hours.sun)],
    ];

    list.innerHTML = "";

    const any = days.some(d => d[1]);

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

  /* ---------------- ABOUT ---------------- */
  function renderAbout(shop) {
    const el = $("#spAbout");

    const rows = [
      ["Address", shop.address],
      ["Phone", shop.phone],
      ["Email", shop.email]
    ].filter(r => r[1]);

    el.innerHTML = rows.map(r => `
      <div class="sp-about-item">
        <div class="sp-about-k">${r[0]}</div>
        <div class="sp-about-v">${r[1]}</div>
      </div>
    `).join("");
  }

  /* ---------------- DOCK ---------------- */
  function wireDock(shop) {
    if (shop.phone)
      $("#spActCall").onclick = () => location.href = `tel:${shop.phone}`;

    if (shop.website)
      $("#spActWeb").onclick = () => window.open(shop.website, "_blank");

    if (shop.address)
      $("#spActDir").onclick = () =>
        window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(shop.address)}`);

    if (shop.instagram)
      $("#spActInstagram").onclick = () =>
        window.open(`https://instagram.com/${shop.instagram.replace("@","")}`);
  }

  /* ---------------- TABS ---------------- */
  function wireTabs() {
    const tabs = ["Hours","About","Updates"];

    tabs.forEach(name => {
      const btn = $(`#spTab${name}`);
      const panel = $(`#spPanel${name}`);

      btn.onclick = () => {
        document.querySelectorAll(".sp-seg-btn").forEach(b => b.classList.remove("is-active"));
        document.querySelectorAll(".sp-panel").forEach(p => p.classList.remove("is-active"));

        btn.classList.add("is-active");
        panel.classList.add("is-active");
      };
    });
  }

  /* ---------------- INIT ---------------- */
  async function init() {
    wireTabs();

    const key = getKeyFromUrl();
    const shop = await loadShop(key);

    renderHeader(shop);
    setShopLogo(shop.key);
    renderTAABadge(shop);
    renderStatus(shop); // ✅ NEW
    renderHours(shop);
    renderAbout(shop);
    wireDock(shop);
  }

  init().catch(console.error);

})();
