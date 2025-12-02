// loyalty/loyalty.js

const CONTACTS_URL = "/pos/pos-contacts.json";

let allContacts = [];
let lockerData = [];
let regularData = [];
let currentMode = "all";
let searchTerm = "";
let lastRenderedList = [];
let selectedContact = null;

// visit history in the modal
let currentVisitHistory = [];
let showAllVisits = false;

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

// Regulars: based on "Regular" column
function isRegular(c) {
  const v = safeLower(c["Regular"]);
  if (!v) return false;
  if (v.includes("regular")) return true;
  if (["reg", "r", "yes", "y", "1", "true"].includes(v)) return true;
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

  return pills;
}

/* ---------- STATUS ICONS (MILITARY / FIRST RESPONDERS) ---------- */

function hasFlagValue(value) {
  const v = safeLower(value);
  if (!v) return false;
  if (["yes", "y", "1", "true"].includes(v)) return true;
  // also treat the label itself as truthy if present
  if (v.includes("military") || v.includes("first responder")) return true;
  return false;
}

function buildStatusIcons(c) {
  const icons = [];

  if (hasFlagValue(c["Military"])) {
    icons.push({
      src: "/img/icons/military.svg",
      alt: "Military",
    });
  }

  if (hasFlagValue(c["First Responders"])) {
    icons.push({
      src: "/img/icons/firstresponders.svg",
      alt: "First responder",
    });
  }

  if (!icons.length) return "";

  return `
    <div class="status-icons">
      ${icons
        .map(
          (i) =>
            `<img src="${i.src}" alt="${i.alt}" class="status-icon" loading="lazy">`
        )
        .join("")}
    </div>
  `;
}

/* ---------- LIST RENDER ---------- */

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

  filtered = [...filtered].sort((a, b) => {
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

  let label = "customers";
  if (currentMode === "lockers") label = "locker customers";
  if (currentMode === "regular") label = "regular customers";

  summaryEl.textContent = `${filtered.length.toLocaleString()} of ${base.length.toLocaleString()} ${label} shown`;

  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-state">No matching customers.</div>`;
    return;
  }

  const rowsHtml = filtered
    .map((c, idx) => {
      const lockerFlag = isLocker(c);
      const regularFlag = isRegular(c);

      let rowClass = "neutral";
      if (lockerFlag) rowClass = "locker";
      else if (regularFlag) rowClass = "regular";

      const displayName = buildDisplayName(c);
      const email = c["Email"] || "";
      const phone = c["Phone"] || "";
      const birthday = c["Birthday"] ? formatDate(c["Birthday"]) : "";
      const company = c["Company"] || "";

      const metaPills = buildMetaPills(c, lockerFlag, regularFlag);
      const statusIcons = buildStatusIcons(c);

      const contactPieces = [];
      if (phone) contactPieces.push(phone);
      if (email) contactPieces.push(email);
      if (birthday) contactPieces.push("Birthday " + birthday);
      if (company) contactPieces.push(company);

      const contactsLine = contactPieces.join(" • ");

      return `
        <div class="row ${rowClass}" data-idx="${idx}">
          <div class="row-header">
            <div class="name-block">
              <div class="name-row">
                <div class="name">${displayName}</div>
                ${statusIcons}
              </div>
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

  // attach row click handlers
  listEl.querySelectorAll(".row").forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      const idx = Number(rowEl.getAttribute("data-idx"));
      const contact = lastRenderedList[idx];
      if (contact) openProfile(contact);
    });
  });
}

/* ---------- DATA LOAD ---------- */

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

/* ---------- VISIT HISTORY HELPERS ---------- */

function getVisitHistory(contact) {
  const arr =
    contact.purchase_history ||
    contact.purchaseHistory ||
    contact.PurchaseHistory;
  return Array.isArray(arr) ? arr : [];
}

function renderVisitHistory() {
  const container = document.getElementById("pVisitList");
  container.innerHTML = "";

  if (!currentVisitHistory || !currentVisitHistory.length) {
    container.innerHTML =
      '<div class="visit-item"><span class="visit-date">No visit history yet</span></div>';
    return;
  }

  const items = showAllVisits
    ? currentVisitHistory
    : currentVisitHistory.slice(0, 6);

  items.forEach((v) => {
    const row = document.createElement("div");
    row.className = "visit-item";
    const date = v.date ? formatDate(v.date) : "—";
    const amount = v.amount != null ? `$${v.amount}` : "";
    row.innerHTML = `
      <span class="visit-date">${date}</span>
      <span class="visit-amount">${amount}</span>
    `;
    container.appendChild(row);
  });

  const btn = document.getElementById("viewAllVisitsBtn");
  if (!btn) return;
  if (!currentVisitHistory.length || currentVisitHistory.length <= 6) {
    btn.disabled = true;
    btn.textContent = "View all";
  } else {
    btn.disabled = false;
    btn.textContent = showAllVisits ? "View less" : "View all";
  }
}

/* ---------- PROFILE DIALOG ---------- */

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

  const name = buildDisplayName(c);
  document.getElementById("pName").textContent = name;

  const lockerInfo = isLocker(c) ? `Locker ${c["Locker number"]}` : "No locker";
  const email = c["Email"] || "";
  const phone = c["Phone"] || "";
  const subPieces = [lockerInfo];
  if (email) subPieces.push(email);
  else if (phone) subPieces.push(phone);
  document.getElementById("pSub").textContent = subPieces.join(" • ");

  document.getElementById("pPoints").textContent = formatPoints(c["Rewards"]);

  // purchase history summary
  document.getElementById("pLastPurchase").textContent =
    c["Last Purchase"] ? formatDate(c["Last Purchase"]) : "—";

  currentVisitHistory = getVisitHistory(c);
  showAllVisits = false;
  renderVisitHistory();

  // contact section
  document.getElementById("pPhone").textContent = phone || "—";
  document.getElementById("pEmail").textContent = email || "—";
  document.getElementById("pBirthday").textContent =
    c["Birthday"] ? formatDate(c["Birthday"]) : "—";

  // favorites
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

  // wishlist
  const wishlistItems = Object.keys(c)
    .filter((k) => k.toLowerCase().startsWith("wishlist"))
    .map((k) => c[k])
    .filter(Boolean);
  const wishlistEl = document.getElementById("pWishlist");
  if (!wishlistItems.length) {
    wishlistEl.textContent = "None";
  } else {
    wishlistEl.textContent = wishlistItems.join(", ");
  }

  // loyalty stats pills
  document.getElementById("pStatYtd").textContent =
    c["YTD spend"] || "YTD: —";
  document.getElementById("pStatVisits90").textContent =
    c["90-day visits"] || "90-day visits: —";
  document.getElementById("pStatGift").textContent =
    c["Gift card balance"] || "Gift card: —";

  // reset editing state
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

function initProfileDialog() {
  const profileDialog = document.getElementById("profileDialog");
  const card = document.getElementById("profileCard");
  const closeBtn = document.querySelector(".profile-close");
  const editBtn = document.getElementById("editProfileBtn");
  const viewAllBtn = document.getElementById("viewAllVisitsBtn");

  closeBtn.addEventListener("click", () => {
    profileDialog.close();
  });

  profileDialog.addEventListener("click", (e) => {
    if (e.target === profileDialog) {
      profileDialog.close();
    }
  });

  viewAllBtn.addEventListener("click", () => {
    if (!currentVisitHistory.length || currentVisitHistory.length <= 6) return;
    showAllVisits = !showAllVisits;
    renderVisitHistory();
  });

  editBtn.addEventListener("click", () => {
    const isEditing = card.classList.toggle("editing");
    const editables = document.querySelectorAll(
      "#profileDialog .profile-editable"
    );

    editables.forEach((el) => {
      el.contentEditable = isEditing ? "true" : "false";
    });

    if (!isEditing) {
      if (!selectedContact) return;

      const changes = {
        "Last Purchase":
          document.getElementById("pLastPurchase").textContent === "—"
            ? null
            : document.getElementById("pLastPurchase").textContent,
        Phone: document.getElementById("pPhone").textContent || null,
        Email: document.getElementById("pEmail").textContent || null,
        Birthday: document.getElementById("pBirthday").textContent || null,
        "Ring Pref": document.getElementById("pRingPref").textContent || null,
        "YTD spend":
          document.getElementById("pStatYtd").textContent || null,
        "90-day visits":
          document.getElementById("pStatVisits90").textContent || null,
        "Gift card balance":
          document.getElementById("pStatGift").textContent || null,
        Wishlist: document.getElementById("pWishlist").innerText.trim() || null,
      };

      Object.assign(selectedContact, changes);
      renderList();
      // later: send `changes` to a write API so it persists
    }

    editBtn.textContent = isEditing ? "Done" : "Edit";
  });
}

/* ---------- INIT ---------- */

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  const searchEl = document.getElementById("search");
  searchEl.addEventListener("input", (e) => {
    searchTerm = e.target.value || "";
    renderList();
  });

  // Add CSS for the new icon layout (keeps everything aligned)
  const style = document.createElement("style");
  style.textContent = `
    .name-block { display:flex; flex-direction:column; gap:2px; }
    .name-row { display:flex; align-items:center; gap:4px; }
    .status-icons { display:flex; align-items:center; gap:4px; }
    .status-icon { width:16px; height:16px; }
  `;
  document.head.appendChild(style);

  initProfileDialog();
  loadContacts();
});
