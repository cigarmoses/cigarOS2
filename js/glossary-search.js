/* /js/glossary-search.js
   Global Glossary Search button + modal (top-right on ALL pages)
*/
(() => {
  const ICON_URL = "/img/icons/glossarysearch.svg";
  const DATA_URL = "/data/glossary.json"; // add this file (provided below)
  const IOS_BLUE = "#007aff";

  const state = {
    data: null,
    loaded: false,
    loading: false,
    lastQuery: "",
  };

  function injectStyles() {
    if (document.getElementById("glossary-search-style")) return;

    const style = document.createElement("style");
    style.id = "glossary-search-style";
    style.textContent = `
      :root { --ios-blue: ${IOS_BLUE}; --gs-ink:#0f1a2c; --gs-muted:#6a7586; }

      /* Top-right global button (overrides anything there) */
      #glossary-search-btn {
        position: fixed;
        top: calc(env(safe-area-inset-top, 0px) + 14px);
        right: calc(env(safe-area-inset-right, 0px) + 14px);
        width: 44px;
        height: 44px;
        border: none;
        background: transparent;
        padding: 0;
        z-index: 999999;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      /* Use SVG as a mask so it ALWAYS renders iOS blue */
      #glossary-search-btn .gs-icon {
        width: 30px;
        height: 30px;
        margin: 7px;
        background: var(--ios-blue);
        -webkit-mask: url(${ICON_URL}) center / contain no-repeat;
        mask: url(${ICON_URL}) center / contain no-repeat;
      }

      /* Modal overlay */
      #glossary-search-modal {
        position: fixed;
        inset: 0;
        z-index: 1000000;
        display: none;
      }
      #glossary-search-modal.gs-open { display: block; }

      #glossary-search-modal .gs-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 26, 44, 0.25);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      #glossary-search-modal .gs-sheet {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(env(safe-area-inset-top, 0px) + 64px);
        margin: 0 auto;
        width: min(720px, calc(100vw - 24px));
        background: #fff;
        border-radius: 22px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.25);
        overflow: hidden;
      }

      #glossary-search-modal .gs-header {
        padding: 14px 14px 10px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
        display: flex;
        gap: 10px;
        align-items: center;
      }

      #gs-search-input {
        flex: 1;
        height: 42px;
        border-radius: 14px;
        border: 1px solid rgba(0,0,0,0.10);
        background: #f3f7fb;
        padding: 0 14px;
        font-size: 16px;
        outline: none;
        color: var(--gs-ink);
        font-family: -apple-system, BlinkMacSystemFont, system-ui, "SF Pro Text", "SF Pro Display", sans-serif;
      }
      #gs-search-input::placeholder { color: rgba(106,117,134,0.85); }

      .gs-close {
        width: 40px;
        height: 40px;
        border-radius: 14px;
        border: none;
        background: #f3f7fb;
        color: var(--ios-blue);
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
      }

      #gs-results {
        max-height: min(60vh, 520px);
        overflow: auto;
        -webkit-overflow-scrolling: touch;
      }

      .gs-row {
        padding: 14px 14px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
        cursor: pointer;
      }
      .gs-row:active { background: rgba(0,122,255,0.06); }

      .gs-word {
        font-weight: 800;
        font-size: 16px;
        color: var(--gs-ink);
        font-family: -apple-system, BlinkMacSystemFont, system-ui, "SF Pro Display", "SF Pro Text", sans-serif;
      }
      .gs-def {
        margin-top: 6px;
        color: var(--gs-muted);
        font-size: 14px;
        line-height: 1.25;
        font-family: -apple-system, BlinkMacSystemFont, system-ui, "SF Pro Text", "SF Pro Display", sans-serif;
      }

      .gs-empty {
        padding: 18px 14px 22px;
        color: var(--gs-muted);
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  function createUI() {
    if (document.getElementById("glossary-search-btn")) return;

    // Button
    const btn = document.createElement("button");
    btn.id = "glossary-search-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Glossary search");
    btn.innerHTML = `<span class="gs-icon" aria-hidden="true"></span>`;
    document.body.appendChild(btn);

    // Modal
    const modal = document.createElement("div");
    modal.id = "glossary-search-modal";
    modal.innerHTML = `
      <div class="gs-backdrop" data-gs-close="1"></div>
      <div class="gs-sheet" role="dialog" aria-modal="true" aria-label="Glossary search">
        <div class="gs-header">
          <input id="gs-search-input" type="search" placeholder="Search glossary" autocomplete="off" />
          <button class="gs-close" type="button" aria-label="Close" data-gs-close="1">×</button>
        </div>
        <div id="gs-results"></div>
      </div>
    `;
    document.body.appendChild(modal);

    // Events
    btn.addEventListener("click", openModal);
    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-gs-close") === "1") closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    const input = modal.querySelector("#gs-search-input");
    input.addEventListener("input", () => {
      const q = input.value || "";
      renderResults(q);
    });
  }

  async function ensureDataLoaded() {
    if (state.loaded || state.loading) return;
    state.loading = true;

    try {
      const res = await fetch(DATA_URL, { cache: "force-cache" });
      if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);
      const json = await res.json();

      // Expect array of: { slug, Word, Definition, aka, Language, Picture }
      state.data = Array.isArray(json) ? json : [];
      state.loaded = true;
    } catch (err) {
      console.warn("[GlossarySearch] data load error:", err);
      state.data = [];
      state.loaded = true;
    } finally {
      state.loading = false;
    }
  }

  function openModal() {
    const modal = document.getElementById("glossary-search-modal");
    if (!modal) return;

    modal.classList.add("gs-open");

    const input = modal.querySelector("#gs-search-input");
    if (input) {
      input.value = "";
      input.focus();
    }

    // initial render (and load data)
    renderResults("");
  }

  function closeModal() {
    const modal = document.getElementById("glossary-search-modal");
    if (!modal) return;
    modal.classList.remove("gs-open");
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function toSlug(s) {
    return normalize(s)
      .replace(/&|\/+/g, " ")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function snippet(text, maxLen = 160) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (t.length <= maxLen) return t;
    return t.slice(0, maxLen - 1).trim() + "…";
  }

  function buildMatchList(q) {
    const data = state.data || [];
    const nq = normalize(q);

    if (!nq) return data.slice(0, 25);

    const scored = [];
    for (const item of data) {
      const w = normalize(item.Word);
      const aka = normalize(item.aka);
      const d = normalize(item.Definition);

      let score = 0;
      if (w === nq) score += 200;
      if (w.startsWith(nq)) score += 120;
      if (w.includes(nq)) score += 80;
      if (aka && aka.includes(nq)) score += 40;
      if (d.includes(nq)) score += 10;

      if (score > 0) scored.push({ item, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 25).map((x) => x.item);
  }

  async function renderResults(q) {
    const modal = document.getElementById("glossary-search-modal");
    if (!modal) return;

    const box = modal.querySelector("#gs-results");
    if (!box) return;

    // Avoid re-render spam with same query
    if (state.lastQuery === q && state.loaded) return;
    state.lastQuery = q;

    box.innerHTML = `<div class="gs-empty">Loading…</div>`;
    await ensureDataLoaded();

    const matches = buildMatchList(q);

    if (!matches.length) {
      box.innerHTML =
        `<div class="gs-empty">No matches. Try a different term.</div>`;
      return;
    }

    box.innerHTML = matches
      .map((m) => {
        const word = m.Word || "";
        const def = snippet(m.Definition || "");
        const slug = m.slug || toSlug(word);
        const safeWord = escapeHtml(word);
        const safeDef = escapeHtml(def);

        return `
          <div class="gs-row" data-gs-slug="${escapeAttr(slug)}">
            <div class="gs-word">${safeWord}</div>
            <div class="gs-def">${safeDef}</div>
          </div>
        `;
      })
      .join("");

    box.querySelectorAll(".gs-row").forEach((row) => {
      row.addEventListener("click", () => {
        const slug = row.getAttribute("data-gs-slug");
        if (!slug) return;

        // Go to the Glossary page, scroll to entry
        window.location.href = `/learn/glossary/?term=${encodeURIComponent(slug)}`;
      });
    });
  }

  // Tiny HTML escapers (safe render)
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function escapeAttr(str) {
    return escapeHtml(str).replaceAll("`", "&#096;");
  }

  function init() {
    injectStyles();
    createUI();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
