(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const DEFAULT_SHOP_ICON = "/uxui/darkmode/darkmodeshops.png";

  /* ---------------- UTIL ---------------- */
  const clean = (v) => String(v ?? "").trim();

  const keyify = (s) =>
    clean(s)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");

  const truthy = (v) => {
    if (v === true) return true;
    const s = clean(v).toLowerCase();
    return ["1", "true", "yes", "y", "x"].includes(s);
  };

  const fetchJSON = async (url) => {
    const res = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed");
    return res.json();
  };

  /* ---------------- URL ---------------- */
  function getKey() {
    const u = new URL(window.location.href);

    const qs = keyify(u.searchParams.get("shop"));
    if (qs) return qs;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[1]) return keyify(parts[1]);

    return "";
  }

  /* ---------------- DATA ---------------- */
  function normalize(raw) {
    return {
      key: keyify(raw.slug || raw.name),
      name: clean(raw.name),
      city: clean(raw.city),
      state: clean(raw.state),
      address: clean(raw.address),
      phone: clean(raw.phone),
      website: clean(raw.website),
      instagram: clean(raw.instagram),
      email: clean(raw.email),
      brands: raw.brands || [],
      amenities: raw.amenities || raw.features || {},
      hours: {
        mon: raw.mon || raw.Monday,
        tue: raw.tue || raw.Tuesday,
        wed: raw.wed || raw.Wednesday,
        thu: raw.thu || raw.Thursday,
        fri: raw.fri || raw.Friday,
        sat: raw.sat || raw.Saturday,
        sun: raw.sun || raw.Sunday,
      }
    };
  }

  async function loadShop() {
    const key = getKey();
    const data = await fetchJSON("/shops/shops.json");

    const hit =
      data.find(s => keyify(s.slug) === key) ||
      data.find(s => keyify(s.name) === key) ||
      data[0];

    return normalize(hit);
  }

  /* ---------------- HEADER ---------------- */
  function renderHeader(shop) {
    $("#spName").textContent = shop.name || "Shop";
    $("#spCity").textContent =
      [shop.city, shop.state].filter(Boolean).join(", ") || "—";
  }

  function setLogo(key) {
    const img = $("#spLogo");
    if (!img) return;

    const src = `/img/icons/shops/${key}.svg`;

    img.onerror = () => {
      img.src = `/img/icons/shops/${key}.png`;
      img.onerror = () => (img.src = DEFAULT_SHOP_ICON);
    };

    img.src = src;
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

    const open = parseTime(parts[0]);
    const close = parseTime(parts[1]);
    const now = new Date();
    const nowMin = now.getHours()*60 + now.getMinutes();

    if (open == null || close == null) return null;

    const isOpen = nowMin >= open && nowMin <= close;

    return {
      open: isOpen,
      closeLabel: parts[1].trim()
    };
  }

  function renderStatus(shop) {
    const container = document.createElement("div");
    container.className = "sp-status";

    const status = computeOpenStatus(shop);

    if (!status) return;

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
  function renderHours(shop) {
    const list = $("#spHoursList");
    list.innerHTML = "";

    const days = [
      ["Monday", shop.hours.mon],
      ["Tuesday", shop.hours.tue],
      ["Wednesday", shop.hours.wed],
      ["Thursday", shop.hours.thu],
      ["Friday", shop.hours.fri],
      ["Saturday", shop.hours.sat],
      ["Sunday", shop.hours.sun],
    ];

    const today = new Date().getDay();

    days.forEach(([d, v], i) => {
      if (!v) return;

      const row = document.createElement("div");
      row.className = "sp-hours-row";

      if (i === (today === 0 ? 6 : today - 1)) {
        row.style.background = "#f2f2f7";
        row.style.borderRadius = "10px";
        row.style.padding = "10px";
      }

      row.innerHTML = `
        <div class="sp-hours-day">${d}</div>
        <div class="sp-hours-val">${v}</div>
      `;

      list.appendChild(row);
    });
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
    const shop = await loadShop();

    renderHeader(shop);
    setLogo(shop.key);
    renderStatus(shop);
    renderHours(shop);
    renderAbout(shop);
    wireDock(shop);
    wireTabs();
  }

  init().catch(console.error);

})();
