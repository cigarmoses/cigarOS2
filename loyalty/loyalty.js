// loyalty/loyalty.js

const CONTACTS_URL = "/pos/pos-contacts.json";

let allContacts = [];
let lockerData = [];
let regularData = [];
let currentMode = "all";
let searchTerm = "";
let lastRenderedList = [];
let selectedContact = null;

function safeLower(v) {
  if (v === null || v === undefined) return "";
  return String(v).toLowerCase();
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString();
}

function formatPoints(raw) {
  if (raw === null || raw === undefined || raw === "") return "0 pts";
  const num = Number(raw);
  if (isNaN(num)) return String(raw);
  return num.toLocaleString() + " pts";
}

function buildDisplayName(c) {
  const first = c["First Name"] || "";
  const last = c["Last Name"] || "";
  const base = (first + " " + last).trim();
  return base || c["Nickname AKA"] || "Unknown";
}

function isLocker(c) {
  const ln = (c["Locker number"] ?? "").toString().trim();
  return ln !== "" && ln !== "0";
}

// Regulars are indicated by the "Regular" column containing "regular", "reg", "yes", "1", etc.
function isRegular(c) {
  const v = safeLower(c["Regular"]);
  if (!v) return false;
  if (v.includes("regular")) return true;
  if (["reg", "r", "yes", "y", "1"].includes(v)) return true;
  return false;
}

function buildMetaPills(c, lockerFlag, regularFlag) {
  const pills = [];

  if (lockerFlag) {
    const ln = c["Locker number"];
    if (ln) pills.push("Locker " + ln);
  }

  if (regularFlag) {
    pills.push("Regular");
  }

  const lastPurchase = c["Last Purchase"];
  if (lastPurchase) {
    pills.push("Last visit " + formatDate(lastPurchase));
  }

  const visits90 = c["90-day visits"];
  if (visits90 !== null && visits90 !== undefined && visits90 !== "") {
    pills.push("90-day visits: " + visits90);
  }

  const favBrand = c["Fav brand 1"];
  if (favBrand) {
    pills.push("Fav brand: " + favBrand);
  }

  // NOTE: we intentionally do NOT include points here.
  return pills;
}

function renderList() {
  const listEl = document.getElementById("list");
  const summaryEl = document.getElementById("summary");
  if (!listEl || !summaryEl) return;

  let base;
  if (currentMode === "lockers") {
    base = lockerData;
  } else if (currentMode === "regular") {
    base = regularData;
  } else {
    base = allContacts;
  }

  // Filter by search term
  const term = searchTerm.trim().toLowerCase();
  let filtered = base;

  if (term) {
    filtered = base.filter((c) => {
      const haystack =
        safeLower(c["First Name"]) +
        " " +
        safeLower(c["Last Name"]) +
        " " +
        safeLower(c["Nickname AKA"]) +
        " " +
        safeLower(c["Phone"]) +
        " " +
        safeLower(c["Email"]) +
        " " +
        safeLower(c["Locker number"]);
      return haystack.includes(term);
    });
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    // For lockers, sort by locker number first
    if (currentMode === "lockers") {
      const la = safeLower(a["Locker number"]);
      const lb = safeLower(b["Locker number"]);
      if (la && lb && la !== lb) {
        return la.localeCompare(lb, undefined, { numeric: true });
      }
    }
    const lastA = safeLower(a["Last Name"]);
    const lastB = safeLower(b["Last Name"]);
    if (lastA !== lastB) return lastA.localeCompare(lastB);
    const firstA = safeLower(a["First Name"]);
    const firstB = safeLower(b["First Name"]);
    return firstA.localeCompare(firstB);
  });

  lastRenderedList = filtered;

  // Summary label
  let label = "customers";
  if (currentMode === "lockers") label = "locker customers";
  if (currentMode === "regular") label = "regular customers";

  summaryEl.textContent = `${filtered.length.toLocaleString()} of ${base.length.toLocaleString()} ${label} shown`;

  // Empty state
  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-state">No matching customers.</div>`;
    return;
  }

  // Build HTML
  const rowsHtml = filtered
    .map((c, idx) => {
      const lockerFlag = isLocker(c);
      const regularFlag = isRegular(c);
      const modeClass = lockerFlag ? "locker" : "regular";

      const displayName = buildDisplayName(c);
      const email = c["Email"] || "";
      const phone = c["Phone"] || "";
      const birthday = c["Birthday"] ? formatDate(c["Birthday"]) : "";
      const company = c["Company"] || "";

      const metaPills = buildMetaPills(c, lockerFlag, regularFlag);

      const contactPieces = [];
      if (phone) contactPieces.push(phone);
      if (email) contactPieces.push(email);
      if (birthday) contactPieces.push("Birthday " + birthday);
      if (company) contactPieces.push(company);

      const contactsLine = contactPieces.join(" • ");

      return `
        <div class="row ${modeClass}" data-idx="${idx}">
          <div class="row-header">
            <div>
              <div class="name">${displayName}</div>
              ${
                c["Nickname AKA"]
                  ? `<div class="nickname">AKA ${c["Nickname AKA"]}</div>`
                  : ""
              }
            </div>
            <div class="points-pill">
              ${formatPoints(c["Rewards"])}
            </div>
          </div>
          ${
            metaPills.length
              ? `<div class="meta-line">
                  ${metaPills.map((p) => `<span class="meta-pill">${p}</span>`).join("")}
                 </div>`
              : ""
          }
          ${
            contactsLine
              ? `<div class="contact-line">${contactsLine}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  listEl.innerHTML = rowsHtml;

  // Attach row click handlers to open profile card
  listEl.querySelectorAll(".row").forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      const idx = Number(rowEl.getAttribute("data-idx"));
      const contact = lastRenderedList[idx];
      if (contact) openProfile(contact);
    });
  });
}

async function loadContacts() {
  try {
    const res = await fetch(CONTACTS_URL);
    if (!res.ok) {
      console.error("Failed to load contacts:", res.status, res.statusText);
      return;
    }
    const data = await res.json();

    allContacts = Array.isArray(data) ? data : [];
    lockerData = allContacts.filter(isLocker);
    regularData = allContacts.filter(isRegular);

    renderList();
  } catch (err) {
    console.error("Error loading contacts:", err);
  }
}

function setMode(mode) {
  currentMode = mode;

  document
    .querySelectorAll(".mode-btn")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });

  renderList();
}

/* ---------- Profile dialog ---------- */

function fillChips(container, items) {
  container.innerHTML = "";
  if (!items.length) {
    const span = document.createElement("span");
    span.textContent = "None";
    span.className = "chip";
    container.appendChild(span);
    return;
  }
  items.forEach((item) => {
    const span = document.createElement("span");
    span.textContent = item;
    span.className = "chip";
    container.appendChild(span);
  });
}

function openProfile(c) {
  selectedContact = c;

  const profileDialog = document.getElementById("profileDialog");
  const card = document.getElementById("profileCard");

  // Header
  const name = buildDisplayName(c);
  document.getElementById("pName").textContent = name;

  const lockerInfo = isLocker(c) ? `Locker ${c["Locker number"]}` : "No locker";
  const email = c["Email"] || "";
  const phone = c["Phone"] || "";
  const contactLine = [lockerInfo, email || phone].filter(Boolean).join(" • ");
  document.getElementById("pSub").textContent = contactLine || lockerInfo;

  document.getElementById("pPoints").textContent = formatPoints(c["Rewards"]);

  // Purchase history
  document.getElementById("pLastPurchase").textContent =
    c["Last Purchase"] ? formatDate(c["Last Purchase"]) : "—";
  document.getElementById("pYtd").textContent = c["YTD spend"] || "—";
  document.getElementById("pVisits90").textContent =
    c["90-day visits"] || "—";
  document.getElementById("pGift").textContent =
    c["Gift card balance"] || "—";

  // Favorites
  const favBrands = [
    c["Fav brand 1"],
    c["Fav brand 2"],
    c["Fav brand 3"],
  ].filter(Boolean);
  fillChips(document.getElementById("pFavBrands"), favBrands);

  const favCigars = [
    c["Fav cigar"],
    c["Fav cigar 2"],
    c["Fav cigar 3"],
  ].filter(Boolean);
  fillChips(document.getElementById("pFavCigars"), favCigars);

  document.getElementById("pRingPref").textContent =
    c["Ring Pref"] || "—";

  // Wishlist – collect any fields starting with "Wishlist"
  const wishlistItems = Object.keys(c)
    .filter((k) => k.toLowerCase().startsWith("wishlist"))
    .map((k) => c[k])
    .filter(Boolean);
  fillChips(document.getElementById("pWishlist"), wishlistItems);

  // Reset editing state
  card.classList.remove("editing");
  document
    .querySelectorAll("#profileDialog .profile-editable")
    .forEach((el) => {
      el.contentEditable = "false";
    });
  const editBtn = document.getElementById("editProfileBtn");
  editBtn.textContent = "Edit";

  profileDialog.showModal();
}

/* ---------- Init ---------- */

function initProfileDialog() {
  const profileDialog = document.getElementById("profileDialog");
  const card = document.getElementById("profileCard");
  const closeBtn = document.querySelector(".profile-close");
  const editBtn = document.getElementById("editProfileBtn");

  closeBtn.addEventListener("click", () => {
    profileDialog.close();
  });

  profileDialog.addEventListener("click", (e) => {
    if (e.target === profileDialog) {
      profileDialog.close();
    }
  });

  editBtn.addEventListener("click", () => {
    const isEditing = card.classList.toggle("editing");
    document
      .querySelectorAll("#profileDialog .profile-editable")
      .forEach((el) => {
        el.contentEditable = isEditing ? "true" : "false";
      });
    editBtn.textContent = isEditing ? "Done" : "Edit";
    // (We can hook up saving back into selectedContact later if desired.)
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Mode buttons
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  // Search
  const searchEl = document.getElementById("search");
  searchEl.addEventListener("input", (e) => {
    searchTerm = e.target.value || "";
    renderList();
  });

  initProfileDialog();
  loadContacts();
});
