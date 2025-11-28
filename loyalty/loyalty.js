const CONTACTS_URL = "/pos/pos-contacts.json";

let lockerData = [];
let regularData = [];
let currentMode = "lockers";
let currentData = [];

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString();
}

// simple helper: turn "Arturo Fuente" -> "arturo-fuente"
function slugBrand(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildLockerItem(c) {
  const first = c.first_name || "";
  const last = c.last_name || "";
  const name = `${first} ${last}`.trim() || "Customer";

  const favBrands = [
    c.fav_brand_1,
    c.fav_brand_2,
    c.fav_brand_3,
  ].filter(Boolean);

  const favCigars = [
    c.fav_cigar_1,
    c.fav_cigar_2,
    c.fav_cigar_3,
  ].filter(Boolean);

  const wishlist = [
    c.wishlist_1,
    c.wishlist_2,
    c.wishlist_3,
  ].filter(Boolean);

  return {
    lockerNo: c.locker_number || "",
    name,
    nickname: c.nickname || "",
    pts: c.rewards_points ?? 0,
    last: formatDate(c.last_purchase),
    phone: c.phone || "—",
    email: c.email || "—",
    birthday: formatDate(c.birthday),
    ring: c.pref_ring || c.ring || "",
    vitola: c.pref_vitola || c.vitola || "",
    favBrands,
    favCigars,
    wishlist,
  };
}

function buildRegularItem(c) {
  const first = c.first_name || "";
  const last = c.last_name || "";
  const name = `${first} ${last}`.trim() || "Customer";

  const favBrands = [
    c.fav_brand_1,
    c.fav_brand_2,
    c.fav_brand_3,
  ].filter(Boolean);

  const favCigars = [
    c.fav_cigar_1,
    c.fav_cigar_2,
    c.fav_cigar_3,
  ].filter(Boolean);

  const wishlist = [
    c.wishlist_1,
    c.wishlist_2,
    c.wishlist_3,
  ].filter(Boolean);

  return {
    name,
    nickname: c.nickname || "",
    pts: c.rewards_points ?? 0,
    last: formatDate(c.last_purchase),
    phone: c.phone || "—",
    email: c.email || "—",
    birthday: formatDate(c.birthday),
    ring: c.pref_ring || c.ring || "",
    vitola: c.pref_vitola || c.vitola || "",
    favBrands,
    favCigars,
    wishlist,
  };
}

function renderList() {
  const wrap = document.getElementById("listWrap");
  if (!wrap) return;

  wrap.querySelectorAll(".row").forEach(r => r.remove());

  currentData.forEach((item) => {
    const row = document.createElement("div");
    if (currentMode === "lockers") {
      row.className = "row locker";
      row.innerHTML = `
        <div><div class="locker-badge">${item.lockerNo ?? ""}</div></div>
        <div>${item.name}</div>
        <div>${item.pts ?? 0}</div>
        <div>${item.last ?? "—"}</div>
      `;
    } else {
      row.className = "row regular regular-bg";
      row.innerHTML = `
        <div></div>
        <div>
          ${item.name}
          ${
            item.nickname
              ? `<div style="font-size:.6rem;color:rgba(15,26,44,.45);">"${item.nickname}"</div>`
              : ""
          }
        </div>
        <div>${item.pts ?? 0}</div>
        <div>${item.last ?? "—"}</div>
      `;
    }
    row.addEventListener("click", () => openModal(item));
    wrap.appendChild(row);
  });
}

function switchMode(mode) {
  currentMode = mode;
  const lockersBtn = document.querySelector(".seg-btn.lockers");
  const regularsBtn = document.querySelector(".seg-btn.regulars");
  if (lockersBtn) lockersBtn.classList.toggle("active", mode === "lockers");
  if (regularsBtn) regularsBtn.classList.toggle("active", mode === "regulars");

  currentData = mode === "lockers" ? lockerData.slice() : regularData.slice();
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";
  renderList();
}

function filterRows() {
  const input = document.getElementById("searchInput");
  const val = (input ? input.value : "").toLowerCase();
  const base = currentMode === "lockers" ? lockerData : regularData;
  currentData = base.filter(r => r.name.toLowerCase().includes(val));
  renderList();
}

function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function openModal(item) {
  const overlay = document.getElementById("loyaltyProfile");
  if (!overlay) return;

  // contact card
  const nameEl = document.getElementById("pName");
  const nickEl = document.getElementById("pNickname");
  const line1 = document.getElementById("pContactLine1");
  const line2 = document.getElementById("pContactLine2");

  if (nameEl) nameEl.textContent = item.name || "—";
  if (nickEl) nickEl.textContent = item.nickname || "";
  if (line1) line1.textContent = `${item.phone || "—"}; ${item.email || "—"}`;
  if (line2) line2.textContent = `Birthday: ${item.birthday || "—"}`;

  // history points
  const pointsEl = document.getElementById("pPoints");
  if (pointsEl) {
    const pts = item.pts ?? 0;
    pointsEl.textContent = `${pts} point${pts === 1 ? "" : "s"}`;
  }

  // profile ring / vitola
  const ringEl = document.getElementById("pRing");
  const vitolaEl = document.getElementById("pVitola");
  if (ringEl) ringEl.textContent = item.ring || "—";
  if (vitolaEl) vitolaEl.textContent = item.vitola || "—";

  // favorite brands
  const brandsRow = document.getElementById("favBrandsRow");
  clearChildren(brandsRow);
  (item.favBrands && item.favBrands.length ? item.favBrands : ["—"]).forEach(brand => {
    const pill = document.createElement("div");
    pill.className = "lp-brand-pill";

    if (brand === "—") {
      pill.textContent = "None yet";
    } else {
      const img = document.createElement("img");
      img.alt = brand;
      img.src = `/img/icons/brands/${slugBrand(brand)}.svg`;
      pill.appendChild(img);
    }
    brandsRow && brandsRow.appendChild(pill);
  });

  // favorite cigars
  const cigarsRow = document.getElementById("favCigarsRow");
  clearChildren(cigarsRow);
  (item.favCigars && item.favCigars.length ? item.favCigars : ["—"]).forEach(label => {
    const card = document.createElement("div");
    card.className = "lp-cigar-card";

    const stick = document.createElement("div");
    stick.className = "lp-cigar-stick";
    card.appendChild(stick);

    const copy = document.createElement("div");
    copy.className = "lp-cigar-copy";

    const name = document.createElement("div");
    name.className = "lp-cigar-name";
    name.textContent = label === "—" ? "No favorites yet" : label;
    copy.appendChild(name);

    if (label !== "—") {
      const sub = document.createElement("div");
      sub.className = "lp-cigar-sub";
      sub.textContent = "Favorite cigar";
      copy.appendChild(sub);
    }

    card.appendChild(copy);
    cigarsRow && cigarsRow.appendChild(card);
  });

  // wishlist
  const wishlistRow = document.getElementById("wishlistRow");
  clearChildren(wishlistRow);
  const wl = item.wishlist && item.wishlist.length ? item.wishlist : ["—"];
  wl.forEach(label => {
    const card = document.createElement("div");
    card.className = "lp-cigar-card";

    const stick = document.createElement("div");
    stick.className = "lp-cigar-stick lp-cigar-wishlist";
    card.appendChild(stick);

    const copy = document.createElement("div");
    copy.className = "lp-cigar-copy";

    const name = document.createElement("div");
    name.className = "lp-cigar-name";
    name.textContent = label === "—" ? "Empty wishlist" : label;
    copy.appendChild(name);

    if (label !== "—") {
      const sub = document.createElement("div");
      sub.className = "lp-cigar-sub";
      sub.textContent = "Not purchased yet";
      copy.appendChild(sub);
    }

    card.appendChild(copy);
    wishlistRow && wishlistRow.appendChild(card);
  });

  overlay.classList.add("is-visible");
}

function closeModal() {
  const overlay = document.getElementById("loyaltyProfile");
  if (overlay) overlay.classList.remove("is-visible");
}

// Expose handlers for inline HTML
window.switchMode = switchMode;
window.filterRows = filterRows;
window.closeModal = closeModal;

function loadContacts() {
  fetch(CONTACTS_URL)
    .then(res => {
      if (!res.ok) throw new Error("Failed to load contacts: " + res.status);
      return res.json();
    })
    .then(data => {
      const contacts = (data || []).filter(c => c.active !== false);

      lockerData = contacts
        .filter(c => c.locker_number != null && String(c.locker_number).trim() !== "")
        .map(buildLockerItem);

      regularData = contacts
        .filter(c => (!c.locker_number || String(c.locker_number).trim() === "") && (c.first_name || c.last_name))
        .map(buildRegularItem);

      switchMode("lockers");
    })
    .catch(err => {
      console.error("Error loading loyalty contacts:", err);
    });
}

document.addEventListener("DOMContentLoaded", loadContacts);
