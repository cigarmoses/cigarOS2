// /pos/pos.js
// Handles the red receipt pill popup and the Loyalty dropdown.

/* =========================================================
   INVOICE POPUP OPEN/CLOSE
   ======================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const pill   = document.getElementById("open-receipt");
  const popup  = document.getElementById("invoice-popup");
  const closeX = document.getElementById("close-receipt");

  // Open popup when clicking the red pill
  if (pill && popup) {
    pill.addEventListener("click", () => {
      popup.classList.add("open");
    });
  }

  // Close popup via "Close" link
  if (closeX && popup) {
    closeX.addEventListener("click", () => {
      popup.classList.remove("open");
    });
  }

  // Clicking dark overlay closes popup (but not clicks inside the sheet)
  if (popup) {
    popup.addEventListener("click", (e) => {
      if (e.target === popup) {
        popup.classList.remove("open");
      }
    });
  }

  /* =====================================================
     LOYALTY DROPDOWN + SEARCH
     =================================================== */

  const loyaltyRow    = document.querySelector(".loyalty-row");
  const loyaltyMenu   = document.getElementById("loyalty-menu");
  const loyaltyList   = document.getElementById("loyalty-list");
  const loyaltySearch = document.getElementById("loyalty-search");
  const loyaltyLabel  = document.getElementById("loyalty-label");

  // TEMP DEMO DATA — replace with your real loyalty DB later
  const LOYALTY_CUSTOMERS = [
    { id: "C001", first: "Tony",    last: "Soprano",  nickname: "Tony" },
    { id: "C002", first: "Michael", last: "Smith",    nickname: "Mike" },
    { id: "C003", first: "Sarah",   last: "Johnson",  nickname: "SJ" },
    { id: "C004", first: "Chris",   last: "Garcia",   nickname: "Chris" },
  ];

  function renderCustomers(term = "") {
    if (!loyaltyList) return;

    const t = term.trim().toLowerCase();
    loyaltyList.innerHTML = "";

    const filtered = LOYALTY_CUSTOMERS.filter((c) => {
      if (!t) return true;
      return (
        (c.first     && c.first.toLowerCase().includes(t))  ||
        (c.last      && c.last.toLowerCase().includes(t))   ||
        (c.nickname  && c.nickname.toLowerCase().includes(t))
      );
    });

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "loyalty-meta";
      empty.textContent = "No customers found.";
      loyaltyList.appendChild(empty);
      return;
    }

    filtered.forEach((c) => {
      const div = document.createElement("div");
      div.className = "loyalty-customer";
      div.innerHTML = `
        <div class="loyalty-name">${c.first} ${c.last}</div>
        <div class="loyalty-meta">
          ${c.nickname ? `Nickname: ${c.nickname} · ` : ""}ID: ${c.id}
        </div>
      `;
      div.addEventListener("click", () => {
        if (loyaltyLabel) {
          loyaltyLabel.textContent = `${c.first} ${c.last}`;
        }
        if (loyaltyMenu) {
          loyaltyMenu.classList.remove("open");
        }
        // TODO: hook this into your cart/session as the active loyalty customer
        // e.g. window.currentLoyaltyCustomer = c;
      });
      loyaltyList.appendChild(div);
    });
  }

  // Open/close loyalty dropdown when clicking pill
  if (loyaltyRow && loyaltyMenu) {
    loyaltyRow.addEventListener("click", (e) => {
      e.stopPropagation();
      loyaltyMenu.classList.toggle("open");

      if (loyaltyMenu.classList.contains("open") && loyaltySearch) {
        loyaltySearch.focus();
      }
    });
  }

  // Filter customers by search text
  if (loyaltySearch) {
    loyaltySearch.addEventListener("input", (e) => {
      renderCustomers(e.target.value);
    });
  }

  // Close dropdown if clicking outside
  document.addEventListener("click", (e) => {
    if (!loyaltyMenu || !loyaltyMenu.classList.contains("open")) return;

    const clickedInside =
      loyaltyMenu.contains(e.target) ||
      (loyaltyRow && loyaltyRow.contains(e.target));

    if (!clickedInside) {
      loyaltyMenu.classList.remove("open");
    }
  });

  // Initial render of customers
  renderCustomers();

  /* =====================================================
     TIMESTAMP ON INVOICE HEADER
     =================================================== */
  const dateEl = document.getElementById("invoice-date");
  if (dateEl) {
    const d = new Date();
    const dayName = d.toLocaleDateString(undefined, { weekday: "long" });
    const dateStr = d.toLocaleDateString(undefined, {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    });
    const timeStr = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    dateEl.textContent = `${dayName}, ${dateStr}   ${timeStr}`;
  }
});
