(function () {
  const ICON_SRC = "/img/tony.png"; // path to your Tony icon

  function createTonyDOM() {
    if (document.getElementById("tony-button") ||
        document.getElementById("tony-panel")) {
      return;
    }

    // --- Button ---
    const btn = document.createElement("div");
    btn.id = "tony-button";
    btn.style.cssText = [
      "position:fixed",
      "bottom:20px",
      "left:20px",
      "width:44px",
      "height:44px",
      "border-radius:50%",
      "background:#ffffff",
      "box-shadow:0 4px 12px rgba(0,0,0,0.25)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "cursor:pointer",
      "z-index:9998"
    ].join(";");
    const btnImg = document.createElement("img");
    btnImg.src = ICON_SRC;
    btnImg.alt = "Ask Tony";
    btnImg.style.cssText = [
      "width:38px",
      "height:38px",
      "border-radius:50%",
      "display:block"
    ].join(";");
    btn.appendChild(btnImg);

    // --- Panel ---
    const panel = document.createElement("div");
    panel.id = "tony-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.style.cssText = [
      "position:fixed",
      "bottom:80px",
      "left:16px",
      "width:min(420px,calc(100vw - 32px))",
      "max-height:min(520px,calc(100vh - 140px))",
      "background:#f8f5ef",
      "border-radius:20px",
      "box-shadow:0 16px 40px rgba(0,0,0,0.35)",
      "display:flex",
      "flex-direction:column",
      "opacity:0",
      "transform:translateY(16px)",
      "pointer-events:none",
      "transition:opacity .25s ease,transform .25s ease",
      "z-index:9999",
      "overflow:hidden",
      "border:1px solid #e1d4bc",
      "font-family:Georgia,'Times New Roman',serif"
    ].join(";");

    panel.innerHTML = `
      <div id="tony-header" style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:10px 14px;
        background:#f2e7d4;
        border-bottom:1px solid #e1d4bc;
      ">
        <div id="tony-header-left" style="display:flex;align-items:center;gap:8px;">
          <img src="${ICON_SRC}" alt="Tony" style="
            width:32px;
            height:32px;
            border-radius:50%;
          ">
          <div>
            <div class="tony-title" style="font-size:15px;font-weight:600;letter-spacing:.02em;">
              Ask Tony…
            </div>
            <div class="tony-subtitle" style="font-size:11px;color:#7b6b4c;">
              Your personal cigar guide
            </div>
          </div>
        </div>
        <button id="tony-close" aria-label="Close Tony" style="
          border:none;
          background:transparent;
          font-size:16px;
          cursor:pointer;
          color:#7b6b4c;
        ">✕</button>
      </div>
      <div id="tony-messages" style="
        flex:1;
        padding:10px 12px 4px;
        overflow-y:auto;
        font-size:13px;
        color:#2f2617;
      "></div>
      <form id="tony-input" autocomplete="off" style="
        display:flex;
        align-items:center;
        gap:8px;
        padding:8px 10px 10px;
        border-top:1px solid #e1d4bc;
        background:#f5eee3;
      ">
        <input id="tony-query" placeholder="Ask Tony…" style="
          flex:1;
          padding:7px 9px;
          border-radius:10px;
          border:1px solid #d0c2a5;
          font-size:13px;
          font-family:inherit;
          outline:none;
          background:#fdfaf5;
        " />
        <button id="tony-send" type="submit" style="
          border:none;
          border-radius:10px;
          padding:6px 12px;
          font-size:16px;
          cursor:pointer;
          background:#b89b64;
          color:#fff;
        ">➤</button>
      </form>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    wireTony(btn, panel);
  }

  function wireTony(btn, panel) {
    const form = panel.querySelector("#tony-input");
    const input = panel.querySelector("#tony-query");
    const msgs  = panel.querySelector("#tony-messages");
    const close = panel.querySelector("#tony-close");

    function openPanel() {
      panel.style.opacity = "1";
      panel.style.transform = "translateY(0)";
      panel.style.pointerEvents = "auto";
      panel.setAttribute("aria-hidden", "false");

      if (!msgs.hasChildNodes()) {
        addTony(
          msgs,
          "Hey, I’m Tony. Ask me anything about cigars—brands, sizes, strength, pairings, you name it."
        );
        addTony(
          msgs,
          "Try: “Show me a medium Nicaraguan toro under $15.”"
        );
      }
      setTimeout(() => input && input.focus(), 150);
    }

    function closePanel() {
      panel.style.opacity = "0";
      panel.style.transform = "translateY(16px)";
      panel.style.pointerEvents = "none";
      panel.setAttribute("aria-hidden", "true");
    }

    function addBubble(container, text, fromTony) {
      const div = document.createElement("div");
      div.textContent = text;
      div.style.cssText = [
        "max-width:88%",
        "padding:8px 10px",
        "margin-bottom:6px",
        "border-radius:12px",
        "line-height:1.4",
        fromTony
          ? "margin-right:auto;background:#ffffff;border:1px solid #e1d4bc;"
          : "margin-left:auto;background:#d9c7a5;"
      ].join("");
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function addUser(text) {
      addBubble(msgs, text, false);
    }

    function addTony(container, text) {
      addBubble(container, text, true);
    }

    function fakeTonyAnswer(q) {
      const qq = q.toLowerCase();

      if (qq.includes("nicaragua") || qq.includes("nicaraguan")) {
        return (
          "If you like Nicaraguan cigars, look for pepper, earth, and cocoa.\n\n" +
          "Classic Nicaraguan families:\n" +
          "• Padrón (1964 / 1926)\n" +
          "• My Father / Don Pepin\n" +
          "• Oliva Serie V\n" +
          "• AJ Fernandez blends"
        );
      }

      if (qq.includes("cameroon")) {
        return (
          "Cameroon wrapper is usually medium with a dry sweetness—baking spice, cedar, and toast.\n\n" +
          "Great for flavor without heavy strength."
        );
      }

      if (qq.includes("beginner") || qq.includes("new")) {
        return (
          "For beginners I like mild-to-medium sticks:\n" +
          "• Connecticut-wrapped robustos\n" +
          "• Smaller ring gauges\n" +
          "• Pair with coffee or water so you really taste the cigar."
        );
      }

      if (qq.includes("pair") || qq.includes("pairing")) {
        return (
          "Pairing rule of thumb:\n" +
          "• Light cigars → coffee, light rum, champagne\n" +
          "• Medium cigars → bourbon, aged rum, red wine\n" +
          "• Full cigars → peated whisky, espresso\n\n" +
          "Match strength first, then play with flavors."
        );
      }

      return (
        "Good question. Quick checklist:\n\n" +
        "1) Wrapper (biggest flavor driver)\n" +
        "2) Country (Nicaragua, DR, Honduras, Cuba, etc.)\n" +
        "3) Size / vitola (how long & intense it’ll be)\n\n" +
        "Give me brand + line + size and I’ll go deeper."
      );
    }

    btn.addEventListener("click", () => {
      if (panel.getAttribute("aria-hidden") === "false") {
        closePanel();
      } else {
        openPanel();
      }
    });

    if (close) close.addEventListener("click", closePanel);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = (input.value || "").trim();
      if (!q) return;
      addUser(q);
      input.value = "";
      setTimeout(() => {
        addTony(msgs, fakeTonyAnswer(q));
      }, 400);
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", createTonyDOM);
    } else {
      createTonyDOM();
    }
  }
})();
