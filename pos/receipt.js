// /pos/receipt.js
// Global Receipt button (bottom-right) for all POS pages.
// - Injects exactly ONE button (prevents duplicates)
// - Uses a configurable icon src + click target
// - Safe to include on every POS page

(function () {
  const DEFAULT_ICON_SRC = "/uxui/receipt-blue.svg"; // <-- set this to your final receipt SVG path
  const DEFAULT_HREF = "/pos/"; // <-- change if you have a dedicated receipt/checkout page

  function getMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute("content") : "";
  }

  function ensureStyles() {
    if (document.getElementById("pos-receipt-style")) return;

    const style = document.createElement("style");
    style.id = "pos-receipt-style";
    style.textContent = `
      #pos-receipt-btn{
        position: fixed;
        right: 20px;
        bottom: 20px;
        width: 62px;
        height: 62px;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 10px 22px rgba(0,0,0,0.22);
        display: grid;
        place-items: center;
        z-index: 9999;
        border: none;
        padding: 0;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      #pos-receipt-btn:active{
        transform: scale(0.98);
      }
      #pos-receipt-btn img{
        width: 46px;
        height: 46px;
        display: block;
      }
      /* Optional badge: set via <body data-receipt-count="3"> */
      #pos-receipt-badge{
        position: absolute;
        top: -8px;
        right: -8px;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border-radius: 999px;
        background: #ff3b30; /* iOS red */
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        font-size: 12px;
        font-weight: 700;
        line-height: 22px;
        text-align: center;
        box-shadow: 0 8px 16px rgba(0,0,0,0.18);
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function removeOldReceiptVariants() {
    // If older versions used different IDs/classes, kill them so only the new one remains.
    const selectors = [
      "#receipt-button",
      "#receipt-icon",
      ".receipt-fab",
      ".pos-receipt",
      "#pos-receipt-btn" // (we re-add cleanly)
    ];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((n) => n.remove());
    });
  }

  function inject() {
    // Only run on /pos pages
    if (!location.pathname.startsWith("/pos")) return;

    ensureStyles();
    removeOldReceiptVariants();

    // If another script already injected ours after remove, bail
    if (document.getElementById("pos-receipt-btn")) return;

    const iconSrc = getMeta("pos-receipt-icon") || DEFAULT_ICON_SRC;
    const href = getMeta("pos-receipt-href") || DEFAULT_HREF;

    const btn = document.createElement("button");
    btn.id = "pos-receipt-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Receipt");

    const img = document.createElement("img");
    img.alt = "Receipt";
    img.src = iconSrc;

    const badge = document.createElement("div");
    badge.id = "pos-receipt-badge";

    btn.appendChild(img);
    btn.appendChild(badge);

    btn.addEventListener("click", () => {
      window.location.href = href;
    });

    document.body.appendChild(btn);

    // Optional: badge count from body attribute
    const count = document.body.getAttribute("data-receipt-count");
    if (count && String(count).trim() !== "" && String(count) !== "0") {
      badge.textContent = String(count);
      badge.style.display = "block";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
