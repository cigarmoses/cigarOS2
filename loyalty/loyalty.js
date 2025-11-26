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

function buildLockerItem(c) {
  const first = c.first_name || "";
  const last = c.last_name || "";
  const name = `${first} ${last}`.trim() || "Customer";

  const favs = [
    c.fav_brand_1,
    c.fav_brand_2,
    c.fav_brand_3,
    c.fav_cigar_1,
    c.fav_cigar_2,
    c.fav_cigar_3,
  ].filter(Boolean).join(" • ");

  return {
    lockerNo: c.locker_number || "",
    name,
    nickname: c.nickname || "",
    pts: c.rewards_points ?? 0,
    last: formatDate(c.last_purchase),
    phone: c.phone || "—",
    email: c.email || "—",
    birthday: formatDate(c.birthday),
    fav: favs || "—",
    wishlist: "—",
    connections: "—",
    lastPurchase: formatDate(c.last_purchase),
  };
}

function buildRegularItem(c) {
  const first = c.first_name || "";
  const last = c.last_name || "";
  const name = `${first} ${last}`.trim() || "Customer";

  const favs = [
    c.fav_brand_1,
    c.fav_brand_2,
    c.fav_brand_3,
    c.fav_cigar_1,
    c.fav_cigar_2,
    c.fav_cigar_3,
  ].filter(Boolean).join(" • ");

  return {
    name,
    nickname: c.nickname || "",
    pts: c.rewards_points ?? 0,
    last: formatDate(c.last_purchase),
    phone: c.phone || "—",
    email: c.email || "—",
    birthday: formatDate(c.birthday),
    fav: favs || "—",
    wishlist: "—",
    connections: "—",
    lastPurchase: formatDate(c.last_purchase),
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
          ${item.nickname ? `<div style="font-size:.6rem;color:rgba(15,26,44,.45);">"${item.nickname}"</div>` : ""}
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

function openModal(item) {
  document.getElementById("mName").textContent = item.name || "—";
  document.getElementById("mNickname").textContent = item.nickname || "—";
  document.getElementById("mPhone").textContent = item.phone || "—";
  document.getElementById("mEmail").textContent = item.email || "—";
  document.getElementById("mBirthday").textContent = item.birthday || "—";
  document.getElementById("mPoints").textContent = item.pts ?? 0;
  document.getElementById("mFav").textContent = item.fav || "—";
  document.getElementById("mWishlist").textContent = item.wishlist || "—";
  document.getElementById("mConnections").textContent = item.connections || "—";
  document.getElementById("mLastPurchase").textContent = item.lastPurchase || "—";
  document.getElementById("modalOverlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
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
