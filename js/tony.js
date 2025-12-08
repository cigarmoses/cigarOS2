// /js/ask-tony.js
(function () {
  const ICON_SRC = "/uxui/pop-up-ask-tony-grey-border.svg";

  // -----------------------------
  // Inject styles once
  // -----------------------------
  function injectStyles() {
    if (document.getElementById("tony-style")) return;

    const style = document.createElement("style");
    style.id = "tony-style";
    style.textContent = `
      :root {
        --tony-bg-scrim: rgba(15, 26, 44, 0.45);
        --tony-card-bg: #ffffff;
        --tony-ink: #0f1a2c;
        --tony-muted: #6c7178;
        --tony-pill-bg: #ffffff;
        --tony-pill-border: #d0d3d7;
        --tony-accent: #007aff;
        --tony-input-bg: #f2f2f7;
      }

      #tony-button {
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 6px 18px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 9998;
      }

      #tony-button img {
        width: 48px;
        height: 48px;
        display: block;
        border-radius: 50%;
      }

      /* Overlay */

      #tony-overlay {
        position: fixed;
        inset: 0;
        background: var(--tony-bg-scrim);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
      }

      #tony-overlay.is-open {
        display: flex;
      }

      .tony-modal {
        position: relative;
        width: min(600px, 100% - 32px);
        max-height: calc(100vh - 64px);
        background: var(--tony-card-bg);
        border-radius: 28px;
        box-shadow: 0 18px 45px rgba(0,0,0,0.25);
        padding: 20px 20px 16px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        font-family: var(--font-text, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
        color: var(--tony-ink);
      }

      @media (min-width: 600px) {
        .tony-modal {
          padding: 24px 24px 20px;
        }
      }

      .tony-close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: none;
        background: #f2f2f7;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      .tony-close span {
        font-size: 18px;
        line-height: 1;
      }

      .tony-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 8px;
        margin-bottom: 12px;
        text-align: center;
      }

      .tony-title {
        font-family: var(--font-display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
        font-weight: 800; /* SF Pro Display Heavy */
        font-size: 26px;
        letter-spacing: -0.02em;
        margin: 4px 0 2px;
      }

      .tony-subtitle {
        font-size: 14px;
        line-height: 1.35;
        color: var(--tony-muted);
        margin: 0;
      }

      .tony-avatar-wrap {
        margin-top: 12px;
        margin-bottom: 10px;
        width: 96px;
        height: 96px;
        border-radius: 999px;
        background: #f2f2f7;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .tony-avatar-wrap img {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        display: block;
      }

      /* Pills */

      .tony-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        margin-bottom: 12px;
        padding: 0 4px;
      }

      .tony-pill {
        border-radius: 9999px;
        border: 1px solid var(--tony-pill-border);
        background: var(--tony-pill-bg);
        padding: 6px 12px;
        font-size: 13px;
        line-height: 1.25;
        color: var(--tony-ink);
        font-family: var(--font-text, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
        cursor: pointer;
        white-space: nowrap;
      }

      .tony-pill:active {
        background: #f2f2f7;
      }

      /* Intro text card */

      .tony-body-card {
        background: #f5f5f8;
        border-radius: 18px;
        padding: 12px 14px;
        margin: 0 4px 10px;
        font-size: 14px;
        line-height: 1.5;
      }

      .tony-body-card p {
        margin: 0;
      }

      .tony-body-card p + p {
        margin-top: 8px;
      }

      /* Input row */

      .tony-input-row {
        margin-top: auto;
        padding-top: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tony-input {
        flex: 1;
        border-radius: 9999px;
        border: none;
        background: var(--tony-input-bg);
        padding: 10px 14px;
        font-size: 15px;
        font-family: var(--font-text, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
        color: var(--tony-ink);
        outline: none;
      }

      .tony-input::placeholder {
        color: #9a9ea6;
      }

      .tony-send {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        border: none;
        background: var(--tony-ink);
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      .tony-send span {
        font-size: 18px;
        transform: translateX(1px);
      }
    `;
    document.head.appendChild(style);
  }

  // -----------------------------
  // Create button + overlay
  // -----------------------------
  function createUI() {
    if (document.getElementById("tony-button")) return;

    // Floating button
    const btn = document.createElement("button");
    btn.id = "tony-button";
    btn.type = "button";
    btn.setAttribute("aria-label", "Ask Tony");
    btn.innerHTML = `
      <img src="${ICON_SRC}" alt="Ask Tony" loading="lazy" />
    `;
    document.body.appendChild(btn);

    // Overlay + modal
    const overlay = document.createElement("div");
    overlay.id = "tony-overlay";
    overlay.innerHTML = `
      <section class="tony-modal" role="dialog" aria-modal="true" aria-labelledby="tony-title">
        <button type="button" class="tony-close" aria-label="Close Ask Tony">
          <span>&times;</span>
        </button>

        <header class="tony-header">
          <h2 id="tony-title" class="tony-title">Ask Tony</h2>
          <p class="tony-subtitle">He knows cigars. And he knows a guy.</p>
          <div class="tony-avatar-wrap">
            <img src="${ICON_SRC}" alt="Tony" loading="lazy" />
          </div>
        </header>

        <div class="tony-pills">
          <button type="button" class="tony-pill">What does vitola mean?</button>
          <button type="button" class="tony-pill">What are some good Connecticut gordos?</button>
          <button type="button" class="tony-pill">Top 25 cigars last year?</button>
        </div>

        <div class="tony-body-card">
          <p>Hey, I’m Tony. I help you pick cigars that actually make sense for you. Brands, blends, size, strength—I got you.</p>
          <p>Ask me something like: “Show me a medium Nicaraguan toro under $15” or “What’s similar to Fuente Hemingway?”</p>
        </div>

        <form class="tony-input-row">
          <input
            class="tony-input"
            type="text"
            placeholder="Ask Tony..."
            aria-label="Ask Tony"
          />
          <button type="submit" class="tony-send" aria-label="Send question">
            <span>➤</span>
          </button>
        </form>
      </section>
    `;
    document.body.appendChild(overlay);

    // Wire up interactions
    const closeBtn = overlay.querySelector(".tony-close");
    const form = overlay.querySelector(".tony-input-row");
    const input = overlay.querySelector(".tony-input");
    const pills = overlay.querySelectorAll(".tony-pill");

    function open() {
      overlay.classList.add("is-open");
      setTimeout(() => input && input.focus(), 10);
    }

    function close() {
      overlay.classList.remove("is-open");
      input && (input.value = "");
    }

    btn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    pills.forEach((pill) => {
      pill.addEventListener("click", () => {
        if (!input) return;
        input.value = pill.textContent.trim();
        input.focus();
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) return;

      // Hook this into your real Tony logic
      console.log("Ask Tony:", value);

      // Optionally clear input or keep it
      input.value = "";
    });
  }

  // -----------------------------
  // Init
  // -----------------------------
  function init() {
    injectStyles();
    createUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
