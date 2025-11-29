const CONTACTS_URL = "/pos/pos-contacts.json";

let lockerData = [];
let regularData = [];
let currentMode = "lockers";
let currentData = [];

/* --------------------
    UTILITIES
--------------------- */

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString();
}

function slugBrand(name) {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildName(c) {
  const first = (c.first_name || "").trim();
  const last = (c.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (c.email) return c.email;
  return "Customer";
}

function hasIdentity(c) {
  return (
    (c.first_name && c.first_name.trim()) ||
    (c.last_name && c.last_name.trim()) ||
    (c.email && c.email.trim())
  );
}

function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

/* --------------------
   BUILD CONTACT ITEMS
--------------------- */

function buildLockerItem(c) {
  const favBrands = [c.fav_brand_1, c.fav_brand_2, c.fav_brand_3].filter(Boolean);
  const favCigars = [c.fav_cigar_1, c.fav_cigar_2, c.fav_cigar_3].filter(Boolean);
  const wishlist = [c.wishlist_1, c.wishlist_2, c.wishlist_3].filter(Boolean);

  return {
    lockerNo: c.locker_number || "",
    name: buildName(c),
    nickname: c.nickname || "",
    pts: c.rewards_points ?? 0,
    last: formatDate(c.last_purchase),
    phone: c.phone || "—",
    email: c.email || "—",
    birthday: formatDate(c.birthday),
    ring: c.ring_pref || "—",
    vitola: "—",
    favBrands,
    favCigars,
    wishlist,
  };
}

function buildRegularItem(c) {
  const favBrands = [c.fav_brand_1, c.fav_brand_2, c.fav_brand_3].filter(Boolean);
  const favCigars = [c.fav_cigar_1, c.fav_cigar_2, c.fav_cigar_3].filter(Boolean);
  const wishlist = [c.wishlist_1, c.wishlist_2, c.wishlist_3].filter(Boolean);

  return {
    name: buildName(c),
    nickname: c.nickname || "",
    pts: c.rewards_points ?? 0,
    last: formatDate(c.last_purchase),
    phone: c.phone || "—",
    email: c.email || "—",
    birthday: formatDate(c.birthday),
    ring: c.ring_pref || "—",
    vitola: "—",
    favBrands,
    favCigars,
    wishlist,
  };
}

/* --------------------
     RENDER LIST
--------------------- */

function renderList() {
  const wrap = document.getElementById("listWrap");
  wrap.querySelectorAll(".row").forEach(r => r.remove());

  if (!currentData.length) {
    const row = document.createElement("div");
    row.className = "row";
    row.style.gridTemplateColumns = "1fr";
    row.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#999;">No matching customers.</div>`;
    wrap.appendChild(row);
    return;
  }

  currentData.forEach(item => {
    const row = document.createElement("div");

    if (currentMode === "lockers") {
      row.className = "row locker";
      row.innerHTML = `
        <div><div class="locker-badge">${item.lockerNo}</div></div>
        <div>${item.name}</div>
        <div>${item.pts}</div>
        <div>${item.last}</div>
      `;
    } else {
      row.className = "row regular-bg";
      row.innerHTML = `
        <div></div>
        <div>
          ${item.name}
          ${item.nickname ? `<div style="font-size:.6rem; color:#889;">"${item.nickname}"</div>` : ""}
        </div>
        <div>${item.pts}</div>
        <div>${item.last}</div>
      `;
    }

    row.addEventListener("click", () => openModal(item));
    wrap.appendChild(row);
  });
}

/* --------------------
   MODE & SEARCH
--------------------- */

function switchMode(mode) {
  currentMode = mode;

  document.querySelector(".seg-btn.lockers").classList.toggle("active", mode === "lockers");
  document.querySelector(".seg-btn.regulars").classList.toggle("active", mode === "regulars");

  currentData = mode === "lockers" ? lockerData.slice() : regularData.slice();
  document.getElementById("searchInput").value = "";
  renderList();
}

function filterRows() {
  const val = document.getElementById("searchInput").value.toLowerCase();
  const base = currentMode === "lockers" ? lockerData : regularData;

  currentData = base.filter(r =>
    (r.name || "").toLowerCase().includes(val) ||
    (r.nickname || "").toLowerCase().includes(val)
  );

  renderList();
}

/* --------------------
      MODAL
--------------------- */

function openModal(item) {
  document.getElementById("pName").textContent = item.name;
  document.getElementById("pNickname").textContent = item.nickname || "";
  document.getElementById("pContactLine1").textContent = `${item.phone}; ${item.email}`;
  document.getElementById("pContactLine2").textContent = `Birthday: ${item.birthday}`;
  document.getElementById("pPoints").textContent = `${item.pts} points`;

  document.getElementById("pRing").textContent = item.ring;
  document.getElementById("pVitola").textContent = item.vitola;

  /* FAVORITE BRANDS */
  const brandsRow = document.getElementById("favBrandsRow");
  clearChildren(brandsRow);

  if (!item.favBrands.length) {
    brandsRow.innerHTML = `<div style="color:#999;">None yet</div>`;
  } else {
    item.favBrands.forEach(brand => {
      const pill = document.createElement("div");
      pill.className = "brand-pill";
      pill.innerHTML = `<img src="/img/icons/brands/${slugBrand(brand)}.svg" alt="${brand}">`;
      brandsRow.appendChild(pill);
    });
  }

  /* FAVORITE CIGARS */
  const cigarsRow = document.getElementById("favCigarsRow");
  clearChildren(cigarsRow);

  if (!item.favCigars.length) {
    cigarsRow.innerHTML = `<div style="color:#999;">None yet</div>`;
  } else {
    item.favCigars.forEach(c => {
      const card = document.createElement("div");
      card.className = "cigar-card";
      card.innerHTML = `
        <div class="cigar-name">${c}</div>
        <div class="cigar-sub">Favorite cigar</div>
      `;
      cigarsRow.appendChild(card);
    });
  }

  /* WISHLIST */
  const wlRow = document.getElementById("wishlistRow");
  clearChildren(wlRow);

  if (!item.wishlist.length) {
    wlRow.innerHTML = `<div style="color:#999;">Empty</div>`;
  } else {
    item.wishlist.forEach(c => {
      const card = document.createElement("div");
      card.className = "cigar-card";
      card.innerHTML = `
        <div class="cigar-name">${c}</div>
        <div class="cigar-sub">Not purchased yet</div>
      `;
      wlRow.appendChild(card);
    });
  }

  document.getElementById("modalOverlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}

window.switchMode = switchMode;
window.filterRows = filterRows;
window.closeModal = closeModal;

/* --------------------
   LOAD CONTACTS
--------------------- */

function loadContacts() {
  fetch(CONTACTS_URL)
    .then(res => res.json())
    .then(data => {
      const contacts = data.filter(c => c.active !== false && hasIdentity(c));

      lockerData = contacts
        .filter(c => c.locker_number)
        .map(buildLockerItem);

      regularData = contacts
        .filter(c => !c.locker_number)
        .map(buildRegularItem);

      switchMode("lockers");
    })
    .catch(err => console.error(err));
}

document.addEventListener("DOMContentLoaded", loadContacts);
