// loyalty/loyalty.js

// Static JSON generated from your Excel, stored here:
const CONTACTS_URL = "/pos/pos-contacts.json";

let allContacts = [];
let lockerData = [];
let regularData = [];
let currentMode = "lockers";
let currentData = [];
let searchTerm = "";

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
  const nickname = c["Nickname AKA"] || "";
  const base = (first + " " + last).trim();
  if (nickname) return base + " (" + nickname + ")";
  return base || nickname || "Unknown";
}

function buildMetaPills(c, isLocker) {
  const pills = [];

  if (isLocker) {
    const ln = c["Locker number"];
    if (ln) pills.push("Locker " + ln);
  }

  const rewards = c["Rewards"];
  if (rewards !== null && rewards !== undefined && rewards !== "") {
    pills.push(formatPoints(rewards));
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

function renderList() {
  const listEl = document.getElementById("list");
  const summaryEl = document.getElementById("summary");
  if (!listEl || !summaryEl) return;

  const base = currentMode === "lockers" ? lockerData : regularData;
  currentData = base;

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

  // Sort: lockers by locker number, regulars by last name then first
  filtered = [...filtered].sort((a, b) => {
    if (currentMode === "lockers") {
      const la = safeLower(a["Locker number"]);
      const lb = safeLower(b["Locker number"]);
      if (la && lb && la !== lb) return la.localeCompare(lb, undefined, { numeric: true });
    }
    const lastA = safeLower(a["Last Name"]);
    const lastB = safeLower(b["Last Name"]);
    if (lastA !== lastB) return lastA.localeCompare(lastB);
    const firstA = safeLower(a["First Name"]);
    const firstB = safeLower(b["First Name"]);
    return firstA.localeCompare(firstB);
  });

  // Summary text
  const total = base.length;
  const shown = filtered.length;
  const label = currentMode === "lockers" ? "locker customers" : "regular customers";
  summaryEl.textContent = `${shown.toLocaleString()} of ${total.toLocaleString()} ${label} shown`;

  // Build rows
  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-state">No matching customers.</div>`;
    return;
  }

  const rowsHtml = filtered
    .map((c) => {
      const isLocker = (c.type || "").toLowerCase() === "locker";
      const rowClass = isLocker ? "row locker" : "row regular";

      const displayName = buildDisplayName(c);
      const email = c["Email"] || "";
      const phone = c["Phone"] || "";
      const birthday = c["Birthday"] ? formatDate(c["Birthday"]) : "";
      const company = c["Company"] || "";

      const metaPills = buildMetaPills(c, isLocker);

      const contactPieces = [];
      if (phone) contactPieces.push(phone);
      if (email) contactPieces.push(email);
      if (birthday) contactPieces.push("Birthday " + birthday);
      if (company) contactPieces.push(company);

      return `
        <div class="${rowClass}">
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
            contactPieces.length
              ? `<div class="contact-line">${contactPieces.join(" • ")}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  listEl.innerHTML = rowsHtml;
}

async function loadContacts() {
  try {
    const res = await fetch(CONTACTS_URL);
    if (!res.ok) {
      console.error("Failed to load contacts:", res.status, res.statusText);
      return;
    }
    const data = await res.json();

    // data is an array with "type" and "id" already set
    allContacts = Array.isArray(data) ? data : [];
    lockerData = allContacts.filter(
      (c) => safeLower(c.type) === "locker"
    );
    regularData = allContacts.filter(
      (c) => safeLower(c.type) === "regular"
    );

    renderList();
  } catch (err) {
    console.error("Error loading contacts:", err);
  }
}

function setMode(mode) {
  currentMode = mode === "regular" ? "regular" : "lockers";

  const buttons = document.querySelectorAll(".mode-btn");
  buttons.forEach((btn) => {
    const m = btn.getAttribute("data-mode");
    btn.classList.toggle("active", m === currentMode);
  });

  renderList();
}

function init() {
  const searchEl = document.getElementById("search");
  if (searchEl) {
    searchEl.addEventListener("input", (e) => {
      searchTerm = e.target.value || "";
      renderList();
    });
  }

  const buttons = document.querySelectorAll(".mode-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      setMode(mode);
    });
  });

  loadContacts();
}

document.addEventListener("DOMContentLoaded", init);
