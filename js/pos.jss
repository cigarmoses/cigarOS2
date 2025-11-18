// /js/pos.js
// Universal red receipt pill for all POS pages

(function () {
  document.addEventListener("DOMContentLoaded", function () {
    // Only run on POS pages
    if (!window.location.pathname.startsWith("/pos/")) return;

    // Inject styles for the pill + hide any old icons
    if (!document.getElementById("receipt-pill-style")) {
      const style = document.createElement("style");
      style.id = "receipt-pill-style";
      style.textContent = `
        .receipt-pill {
          position: fixed;
          bottom: 22px;
          right: 22px;
          width: 70px;
          height: 130px;
          z-index: 9999;
          cursor: pointer;
        }
        .receipt-pill img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
        /* Hide any old black bill tab if it still exists */
        .pos-bill-tab {
          display: none !important;
        }
        /* Hide any stray big receipt icons that were dropped directly on the page */
        img[src="/uxui/receipt-icon.svg"]:not(.receipt-pill img) {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Avoid duplicates
    if (!document.querySelector(".receipt-pill")) {
      const pill = document.createElement("div");
      pill.className = "receipt-pill";
      pill.id = "open-receipt";
      pill.innerHTML = '<img src="/uxui/receipt-icon.svg" alt="Receipt">';
      document.body.appendChild(pill);

      pill.addEventListener("click", function () {
        const popup = document.getElementById("invoice-popup");
        if (popup) {
          popup.classList.add("open");
        } else {
          // Fallback: go to main receipt page if no popup on this screen
          window.location.href = "/pos/receipt/";
        }
      });
    }

    // Optional: close handler for invoice popup, if present
    const popup = document.getElementById("invoice-popup");
    const closeBtn = document.getElementById("close-receipt");
    if (popup && closeBtn) {
      closeBtn.addEventListener("click", function () {
        popup.classList.remove("open");
      });
    }
  });
})();
