(function () {
  // Path to Tony icon used in button + header
  const ICON_SRC = "/img/tony.png"; // change if you store it somewhere else

  // Create Tony button + panel and inject into DOM
  function createTonyDOM() {
    if (document.getElementById("tony-button") ||
        document.getElementById("tony-panel")) {
      return; // already injected
    }

    // Floating button
    const btn = document.createElement("div");
    btn.id = "tony-button";
    btn.innerHTML = `<img src="${ICON_SRC}" alt="Ask Tony">`;

    // Slide-up panel
    const panel = document.createElement("div");
    panel.id = "tony-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <div id="tony-header">
        <div id="tony-header-left">
          <img src="${ICON_SRC}" alt="Tony">
          <div>
            <div class="tony-title">Ask Tony…</div>
            <div class="tony-subtitle">Your personal cigar guide</div>
          </div>
        </div>
        <button id="tony-close" aria-label="Close Tony">✕</button>
      </div>
      <div id="tony-messages"></div>
      <form id="tony-input" autocomplete="off">
        <input id="tony-query" placeholder="Ask Tony…" />
        <button id="tony-send" type="submit">➤</button>
      </form>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    wireTony(btn, panel);
  }

  // Wire up behavior: open/close, send, fake responses
  function wireTony(btn, panel) {
    const form = panel.querySelector("#tony-input");
    const input = panel.querySelector("#tony-query");
    const msgs  = panel.querySelector("#tony-messages");
    const close = panel.querySelector("#tony-close");

    function openPanel() {
      panel.classList.add("tony-open");
      panel.setAttribute("aria-hidden", "false");
      // Seed with intro messages once
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
      panel.classList.remove("tony-open");
      panel.setAttribute("aria-hidden", "true");
    }

    function addBubble(container, text, fromTony) {
      const div = document.createElement("div");
      div.className = "tony-bubble " + (fromTony ? "tony" : "user");
      div.textContent = text;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function addUser(text) {
      addBubble(msgs, text, false);
    }

    function addTony(container, text) {
      addBubble(container, text, true);
    }

    // Simple canned “AI” responses for demo purposes
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

    // Events
    btn.addEventListener("click", () => {
      if (panel.classList.contains("tony-open")) {
        closePanel();
      } else {
        openPanel();
      }
    });

    if (close) {
      close.addEventListener("click", closePanel);
    }

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

  // Inject once DOM is ready on every page where this script is loaded
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", createTonyDOM);
    } else {
      createTonyDOM();
    }
  }
})();
