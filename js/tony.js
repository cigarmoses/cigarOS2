(function () {
  const ICON_SRC = "/uxui/pop-up-ask-tony-grey-border.svg";

  function injectStyles() {
    if (document.getElementById("tony-style")) return;

    const style = document.createElement("style");
    style.id = "tony-style";
    style.textContent = `
      /* Floating Tony button (POS-style) */
      #tonyFab,
      .tony-fab {
        position: fixed;
        bottom: 16px;
        left: 16px;
        width: 46px;
        height: 46px;
        border-radius: 999px;
        background: transparent;
        border: none;
        padding: 0;
        z-index: 9998;
        cursor: pointer;
      }

      #tonyFab img,
      .tony-fab img {
        width: 100%;
        height: 100%;
        display: block;
        border-radius: inherit;
      }

      /* Legacy #tony-button support (News page etc.) */
      #tony-button {
        position: fixed;
        bottom: 16px;
        left: 16px;
        width: 46px;
        height: 46px;
        border-radius: 999px;
        background: transparent;
        border: none;
        padding: 0;
        z-index: 9998;
        cursor: pointer;
      }

      #tony-button img {
        width: 100%;
        height: 100%;
        display: block;
        border-radius: inherit;
      }

      #tony-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.25);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }

      #tony-overlay.tony-open {
        display: flex;
      }

      #tony-modal {
        position: relative;
        background: #ffffff;
        border-radius: 32px;
        border: 3px solid #111111;
        max-width: 480px;
        width: min(92vw, 480px);
        max-height: min(560px, 92vh);
        padding: 26px 24px 18px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.35);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      #tony-modal-tail {
        position: absolute;
        left: 36px;
        bottom: -26px;
        width: 96px;
        height: 38px;
        background: #ffffff;
        border: 3px solid #111111;
        border-top: none;
        border-radius: 0 0 32px 32px;
        transform: skewX(-18deg);
        box-shadow: 0 18px 32px rgba(0,0,0,0.35);
      }

      #tony-modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      #tony-modal-title {
        flex: 1;
        text-align: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
        font-weight: 800;
        font-size: 26px;
        letter-spacing: 0.02em;
      }

      #tony-close {
        border: none;
        background: transparent;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        color: #555555;
      }

      #tony-modal-avatar {
        display: flex;
        justify-content: center;
        margin: 6px 0 10px;
      }

      #tony-modal-avatar img {
        width: 110px;
        height: 110px;
        border-radius: 50%;
      }

      #tony-tagline {
        text-align: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
        font-size: 15px;
        margin: 0 0 14px;
        color: #202020;
      }

      #tony-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        margin-bottom: 10px;
      }

      .tony-chip {
        border-radius: 999px;
        border: 1px solid #d0d0d0;
        padding: 6px 10px;
        font-size: 12px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
        background: #f7f7f7;
        color: #777777;
        cursor: pointer;
        white-space: nowrap;
      }

      #tony-messages {
        flex: 1;
        overflow-y: auto;
        padding: 4px 2px 0;
        margin-bottom: 8px;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 14px;
        color: #222222;
      }

      .tony-bubble {
        max-width: 100%;
        padding: 8px 10px;
        margin-bottom: 6px;
        border-radius: 12px;
        line-height: 1.4;
      }

      .tony-bubble.tony {
        margin-right: auto;
        background: #f3f3f3;
        border: 1px solid #dddddd;
      }

      .tony-bubble.user {
        margin-left: auto;
        background: #d9e6ff;
        border: 1px solid #b9cfff;
      }

      #tony-input {
        display: flex;
        align-items: center;
        gap: 8px;
        border-top: 1px solid #eeeeee;
        padding-top: 8px;
        margin-top: 4px;
      }

      #tony-query {
        flex: 1;
        padding: 8px 10px;
        border-radius: 999px;
        border: 1px solid #d0d0d0;
        font-size: 14px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
        outline: none;
      }

      #tony-query:focus {
        border-color: #111111;
      }

      #tony-send {
        border: none;
        border-radius: 999px;
        padding: 8px 14px;
        font-size: 16px;
        cursor: pointer;
        background: #111111;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      @media (max-width: 480px) {
        #tony-modal {
          border-radius: 26px;
          padding: 22px 18px 14px;
        }

        #tony-modal-title {
          font-size: 22px;
        }

        #tony-modal-avatar img {
          width: 96px;
          height: 96px;
        }

        #tony-modal-tail {
          left: 28px;
          width: 80px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createTonyDOM() {
    injectStyles();

    // Reuse any existing Tony button in this priority:
    // 1) #tonyFab  2) .tony-fab  3) #tony-button (legacy)
    let btn =
      document.getElementById("tonyFab") ||
      document.querySelector(".tony-fab") ||
      document.getElementById("tony-button");

    // If legacy #tony-button exists, normalize it
    if (btn && btn.id === "tony-button") {
      btn.classList.add("tony-fab");
    }

    // If nothing exists, create a standard one
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "tonyFab";
      btn.className = "tony-fab";
      const img = document.createElement("img");
      img.src = ICON_SRC;
      img.alt = "Ask Tony";
      btn.appendChild(img);
      document.body.appendChild(btn);
    } else {
      // Force the correct icon on any existing button
      let img = btn.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        btn.appendChild(img);
      }
      img.src = ICON_SRC;
      img.alt = "Ask Tony";
    }

    // Avoid wiring twice
    if (btn.dataset.tonyWired === "1") return;
    btn.dataset.tonyWired = "1";

    // Overlay + modal (create if needed)
    let overlay = document.getElementById("tony-overlay");
    let modal;

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "tony-overlay";

      modal = document.createElement("div");
      modal.id = "tony-modal";

      modal.innerHTML = `
        <div id="tony-modal-header">
          <span style="width:32px;"></span>
          <div id="tony-modal-title">Ask Tony…</div>
          <button id="tony-close" aria-label="Close Tony">×</button>
        </div>
        <div id="tony-modal-avatar">
          <img src="${ICON_SRC}" alt="Tony">
        </div>
        <p id="tony-tagline">He knows cigars. And he knows a guy.</p>
        <div id="tony-suggestions">
          <button class="tony-chip" data-q="What does vitola mean? Show me a picture of one.">What does vitola mean?</button>
          <button class="tony-chip" data-q="What are some good Connecticut gordos?">What are some good Connecticut gordos?</button>
          <button class="tony-chip" data-q="What were Cigar Aficionado’s top 25 cigars last year?">Top 25 cigars last year?</button>
        </div>
        <div id="tony-messages"></div>
        <form id="tony-input" autocomplete="off">
          <input id="tony-query" placeholder="Ask Tony…" />
          <button id="tony-send" type="submit">➤</button>
        </form>
        <div id="tony-modal-tail"></div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    } else {
      modal = document.getElementById("tony-modal");
    }

    wireTony(btn, overlay, modal);
  }

  function wireTony(btn, overlay, modal) {
    const form = modal.querySelector("#tony-input");
    const input = modal.querySelector("#tony-query");
    const msgs  = modal.querySelector("#tony-messages");
    const close = modal.querySelector("#tony-close");
    const chips = modal.querySelectorAll(".tony-chip");

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

    function openModal() {
      overlay.classList.add("tony-open");
      if (!msgs.hasChildNodes()) {
        addTony(
          msgs,
          "Hey, I’m Tony. I help you pick cigars that actually make sense for you. Brands, blends, size, strength—I got you."
        );
        addTony(
          msgs,
          "Ask me something like: “Show me a medium Nicaraguan toro under $15” or “What’s similar to Fuente Hemingway?”"
        );
      }
      setTimeout(() => input && input.focus(), 150);
    }

    function closeModal() {
      overlay.classList.remove("tony-open");
    }

    // 93% cigar info / 7% Tony attitude
    function fakeTonyAnswer(q) {
      const qq = q.toLowerCase();

      if (qq.includes("nicaragua") || qq.includes("nicaraguan")) {
        return (
          "You’re talking Nicaraguan, so expect pepper, earth, cocoa — plenty of flavor.\n\n" +
          "Lines you should look at:\n" +
          "• Padrón 2000 / 3000 (classic, no nonsense)\n" +
          "• Oliva Serie V for something richer\n" +
          "• My Father if you like a little spice\n\n" +
          "What do you think, I’ve had my fair share of sticks?"
        );
      }

      if (qq.includes("cameroon")) {
        return (
          "Cameroon wrapper is medium, sweet, and a little toasty — think baking spice, cedar, and a dry sweetness.\n\n" +
          "If you’re into that profile, look for cigars like:\n" +
          "• Arturo Fuente Hemingway (classic move)\n" +
          "• Some of the old-school Oliva and CAO Cameroon blends\n\n" +
          "You want flavor without getting knocked over? Cameroon’s a good lane."
        );
      }

      if (
        qq.includes("beginner") ||
        qq.includes("new to cigars") ||
        qq.includes("first cigar") ||
        qq.includes("new smoker")
      ) {
        return (
          "First cigar or still figuring it out? No problem.\n\n" +
          "Here’s where I’d start you:\n" +
          "• Connecticut-wrapped robusto — mild to medium\n" +
          "• Smaller ring gauge so you’re not wrestling with it\n" +
          "• Pair it with coffee or water so you taste the cigar, not just the drink\n\n" +
          "Everybody started somewhere. I got you."
        );
      }

      if (
        qq.includes("pair") ||
        qq.includes("pairing") ||
        qq.includes("drink with") ||
        qq.includes("go with")
      ) {
        return (
          "Alright, here’s the move on pairings:\n\n" +
          "• Light / Connecticut cigars → coffee, light rum, champagne\n" +
          "• Medium cigars → bourbon, aged rum, red wine\n" +
          "• Full-bodied cigars → peated whisky, espresso, rich stout\n\n" +
          "Match the strength first, then worry about flavor notes. You do that, you’re already ahead of half the room."
        );
      }

      if (
        qq.includes("strong") ||
        qq.includes("full body") ||
        qq.includes("full-bodied") ||
        qq.includes("full strength")
      ) {
        return (
          "You want something with some horsepower, huh?\n\n" +
          "Look at cigars like:\n" +
          "• Joya de Nicaragua Antaño\n" +
          "• My Father Le Bijou\n" +
          "• Some of the stronger Nicaraguan maduros\n\n" +
          "Take it slow, especially if you haven’t danced with the full-strength stuff before."
        );
      }

      return (
        "Good question. Here’s how I think about any cigar:\n\n" +
        "1) Wrapper — biggest driver of flavor and first impression\n" +
        "2) Country — Nicaragua, DR, Honduras, Cuba… all have their own character\n" +
        "3) Size / vitola — how long you’re smoking and how intense it feels\n\n" +
        "Give me brand, line, and size, and I’ll narrow it down for you. I got you."
      );
    }

    // Events
    btn.addEventListener("click", openModal);
    close.addEventListener("click", closeModal);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = (input.value || "").trim();
      if (!q) return;
      addUser(q);
      input.value = "";
      setTimeout(() => {
        addTony(msgs, fakeTonyAnswer(q));
      }, 350);
    });

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const q = chip.getAttribute("data-q") || chip.textContent;
        addUser(q);
        setTimeout(() => {
          addTony(msgs, fakeTonyAnswer(q));
        }, 350);
      });
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
