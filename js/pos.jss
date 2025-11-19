// /js/pos.js
// Universal red receipt pill + invoice popup behavior for ALL /pos pages

(function () {
  document.addEventListener("DOMContentLoaded", function () {
    // Only run on POS section
    if (!window.location.pathname.startsWith("/pos/")) return;

    // --- CLEAN UP ANY OLD STUFF ---------------------------------------
    // remove any existing pills
    document.querySelectorAll(".receipt-pill").forEach(el => el.remove());
    // remove any stray raw receipt-icon images
    document.querySelectorAll('img[src="/uxui/receipt-icon.svg"]').forEach(el => el.remove());
    // hide legacy black bill tab if it still exists
    document.querySelectorAll(".pos-bill-tab, .bill-modal").forEach(el => {
      el.style.display = "none";
    });

    // --- INJECT GLOBAL STYLES (PILL + POPUP) --------------------------
    if (!document.getElementById("receipt-pill-style")) {
      const style = document.createElement("style");
      style.id = "receipt-pill-style";
      style.textContent = `
        /* Small red vertical receipt pill - universal */
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

        /* Universal invoice popup overlay */
        .invoice-popup {
          position: fixed;
          inset: 0;
          display: none;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.35);
          z-index: 9998;
        }
        .invoice-popup.open {
          display: flex;
        }
        .invoice-popup-inner {
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          background: #ffffff;
          border-radius: 26px;
          padding: 24px 22px 28px;
          box-sizing: border-box;
        }
      `;
      document.head.appendChild(style);
    }

    // --- CREATE ONE PILL ----------------------------------------------
    const pill = document.createElement("div");
    pill.className = "receipt-pill";
    pill.id = "open-receipt";
    pill.innerHTML = '<img src="/uxui/receipt-icon.svg" alt="Receipt">';
    document.body.appendChild(pill);

    // --- WIRE UP OPEN/CLOSE LOGIC -------------------------------------
    const popup = document.getElementById("invoice-popup");
    const closeBtn = document.getElementById("close-receipt");

    function openInvoice() {
      if (popup) {
        popup.classList.add("open");
      } else {
        // Fallback if a page doesn't have the popup markup
        window.location.href = "/pos/receipt/";
      }
    }

    function closeInvoice() {
      if (popup) {
        popup.classList.remove("open");
      }
    }

    pill.addEventListener("click", openInvoice);

    if (closeBtn) {
      closeBtn.addEventListener("click", closeInvoice);
    }
    if (popup) {
      // click outside to close
      popup.addEventListener("click", function (e) {
        if (e.target === popup) closeInvoice();
      });
    }
  });
})();
