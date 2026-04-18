const listEl = document.querySelector("#shList");
const searchInput = document.querySelector("#shQuery");
const stateSelect = document.querySelector("#shState");
const taaToggle = document.querySelector("#shTaaToggle");

const DEFAULT_SHOP_ICON = "/uxui/darkmode/darkmodeshops.png";

/*
  IMPORTANT:
  Replace this fallback path with the exact same TAA SVG path used on shop-page.js
  if your detail page uses a different asset path.
*/
const TAA_LOGO_FALLBACK = "/img/icons/taa.svg";

let ALL_SHOPS = [];
let onlyTaa = false;

function clean(v) {
  return String(v ?? "").trim();
}

function slugKey(v) {
  return clean(v)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

function shopDetailHref(shop) {
  const key = slugKey(shop.slug || shop.name);
  return `/shops/shop-page.html?shop=${encodeURIComponent(key)}`;
}

function logoHtml(key, name) {
  const safeKey = encodeURIComponent(key);
  const safeName = escapeHtml(name);
  const fallback = DEFAULT_SHOP_ICON;
  const svg = `/img/icons/shops/${safeKey}.svg`;
  const png = `/img/icons/shops/${safeKey}.png`;

  return `
    <img
      class="sh-item-logo"
      src="${svg}"
      alt="${safeName}"
      loading="lazy"
      onerror="
        if (!this.dataset.fallbackStep) {
          this.dataset.fallbackStep='png';
          this.src='${png}';
        } else if (this.dataset.fallbackStep==='png') {
          this.dataset.fallbackStep='default';
          this.src='${fallback}';
        } else {
          this.onerror=null;
          this.src='${fallback}';
        }
      "
    />
  `;
}

function getStateValue(shop) {
  return clean(shop.state || shop.State || shop.us_state || shop.region);
}

function shopHasTaa(shop) {
  const directTruthyKeys = [
    shop.taa,
    shop.TAA,
    shop.isTaa,
    shop.is_taa,
    shop.taaMember,
    shop.taa_member,
    shop.taamember,
    shop.member_taa
  ];

  if (directTruthyKeys.some((v) => v === true)) return true;

  const stringKeys = [
    shop.taa,
    shop.TAA,
    shop.isTaa,
    shop.is_taa,
    shop.taaMember,
    shop.taa_member,
    shop.member_taa,
    shop.memberships,
    shop.memberType,
    shop.badges,
    shop.tags,
    shop.associations
  ]
    .map((v) => clean(v).toLowerCase());

  return stringKeys.some((v) => {
    return v === "taa" ||
      v === "true" ||
      v.includes("taa") ||
      v.includes("tobacconists' association of america") ||
      v.includes("tobacconists association of america");
  });
}

function getTaaLogoSrc(shop) {
  return (
    clean(shop.taaLogo) ||
    clean(shop.taa_logo) ||
    clean(shop.taaSvg) ||
    clean(shop.taa_svg) ||
    TAA_LOGO_FALLBACK
  );
}

function taaHtml(shop) {
  if (!shopHasTaa(shop)) return "";

  const src = escapeHtml(getTaaLogoSrc(shop));
  return `
    <div class="sh-item-meta">
      <img
        class="sh-item-taa"
        src="${src}"
        alt="TAA member"
        loading="lazy"
        onerror="this.style.display='none';"
      />
    </div>
  `;
}

function populateStates(list) {
  if (!stateSelect) return;

  const current = stateSelect.value;
  const uniqueStates = [...new Set(
    list
      .map(getStateValue)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  stateSelect.innerHTML = `<option value="">All States</option>` +
    uniqueStates.map((state) => {
      const safe = escapeHtml(state);
      return `<option value="${safe}">${safe}</option>`;
    }).join("");

  if (uniqueStates.includes(current)) {
    stateSelect.value = current;
  }
}

function getFilteredShops(list, q, state, taaOnly) {
  const query = slugKey(q);
  const stateValue = clean(state).toLowerCase();

  return list.filter((shop) => {
    const n = slugKey(shop.name);
    const c = slugKey(shop.city);
    const s = slugKey(getStateValue(shop));
    const matchesQuery = !query || n.includes(query) || c.includes(query) || s.includes(query);
    const matchesState = !stateValue || clean(getStateValue(shop)).toLowerCase() === stateValue;
    const matchesTaa = !taaOnly || shopHasTaa(shop);

    return matchesQuery && matchesState && matchesTaa;
  });
}

function render(list, q = "", state = "", taaOnly = false) {
  listEl.innerHTML = "";

  const filtered = getFilteredShops(list, q, state, taaOnly);

  filtered.forEach((shop) => {
    const key = slugKey(shop.slug || shop.name);
    const row = document.createElement("a");

    row.className = "sh-item";
    row.href = shopDetailHref(shop);

    row.innerHTML = `
      <div class="sh-item-main">
        ${logoHtml(key, shop.name)}
        <div class="sh-item-copy">
          <div class="sh-item-name">${escapeHtml(shop.name)}</div>
          <div class="sh-item-sub">${escapeHtml(clean(shop.city))}, ${escapeHtml(getStateValue(shop))}</div>
        </div>
      </div>
      ${taaHtml(shop)}
    `;

    listEl.appendChild(row);
  });

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "sh-item";
    empty.innerHTML = `
      <div class="sh-item-main">
        <img
          class="sh-item-logo"
          src="${DEFAULT_SHOP_ICON}"
          alt="Default shop icon"
        />
        <div class="sh-item-copy">
          <div class="sh-item-name">No shops found</div>
          <div class="sh-item-sub">Try a different search or filter</div>
        </div>
      </div>
    `;
    listEl.appendChild(empty);
  }
}

function syncUi() {
  if (taaToggle) {
    taaToggle.setAttribute("aria-checked", String(onlyTaa));
  }
}

function rerender() {
  render(
    ALL_SHOPS,
    searchInput?.value || "",
    stateSelect?.value || "",
    onlyTaa
  );
}

async function init() {
  try {
    const res = await fetch(`/shops/shops.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load shops.json: ${res.status}`);

    const data = await res.json();
    ALL_SHOPS = Array.isArray(data) ? data : [];

    populateStates(ALL_SHOPS);
    syncUi();
    rerender();

    searchInput?.addEventListener("input", rerender);

    stateSelect?.addEventListener("change", rerender);

    taaToggle?.addEventListener("click", () => {
      onlyTaa = !onlyTaa;
      syncUi();
      rerender();
    });
  } catch (err) {
    console.error("[shop-search.js] init failed:", err);

    listEl.innerHTML = `
      <div class="sh-item">
        <div class="sh-item-main">
          <img
            class="sh-item-logo"
            src="${DEFAULT_SHOP_ICON}"
            alt="Default shop icon"
          />
          <div class="sh-item-copy">
            <div class="sh-item-name">Unable to load shops</div>
            <div class="sh-item-sub">Please try again</div>
          </div>
        </div>
      </div>
    `;
  }
}

init();
