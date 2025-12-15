// /learn/glossary/glossary.js
// Sleek iOS-style glossary: grouped list + search + bottom sheet
// + Deep-link support: /learn/glossary/?term=<slug> scrolls + opens the entry

(function () {
  const DATA_URL = "/data/glossary.json";

  const listEl = document.getElementById("glossary-list");
  const emptyEl = document.getElementById("glossary-empty");
  const searchEl = document.getElementById("glossary-search");
  const clearBtn = document.getElementById("glossary-clear");

  const backBtn = document.getElementById("glossary-back");

  const overlay = document.getElementById("sheet-overlay");
  const sheet = document.getElementById("sheet");
  const sheetClose = document.getElementById("sheet-close");

  const sheetWord = document.getElementById("sheet-word");
  const sheetDefinition = document.getElementById("sheet-definition");
  const sheetMeta = document.getElementById("sheet-meta");
  const sheetLanguage = document.getElementById("sheet-language");
  const sheetAka = document.getElementById("sheet-aka");

  let allItems = [];
  let activeItems = [];

  // ------------------------
  // Back button
  // ------------------------
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "/learn/";
    });
  }

  // ------------------------
  // Data fetch
  // ------------------------
  async function loadData() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load glossary data");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  // ------------------------
  // Helpers
  // ------------------------
  function normalize(s) {
    return (s || "").toString().toLowerCase().trim();
  }

  // slugify must match the global search behavior
  function toSlug(s) {
    return normalize(s)
      .replace(/&|\/+/g, " ")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function firstLetter(word) {
    const w = (word || "").toString().trim();
    if (!w) return "#";
    const c = w[0].toUpperCase();
    return /[A-Z]/.test(c) ? c : "#";
  }

  function includesQ(hay, q) {
    if (!hay || !q) return false;
    return hay.includes(q);
  }

  function startsWithQ(hay, q) {
    if (!hay || !q) return false;
    return hay.startsWith(q);
  }

  function matches(item, q) {
    if (!q) return true;

    const word = normalize(item.word);
    const def = normalize(item.definition);
    const aka = normalize(item.aka);
    const lang = normalize(item.language);

    return (
      includesQ(word, q) ||
      includesQ(aka, q) ||
      includesQ(lang, q) ||
      includesQ(def, q)
    );
  }

  /**
   * Lower score = better result
   * Priority:
   * 0 exact word
   * 1 word startsWith
   * 2 word includes
   * 3 aka startsWith
   * 4 aka includes
   * 5 definition includes
   * 6 language includes
   * 9 fallback
   */
  function relevanceScore(item, q) {
    if (!q) return 9;

    const word = normalize(item.word);
    const aka = normalize(item.aka);
    const def = normalize(item.definition);
    const lang = normalize(item.language);

    if (word === q) return 0;
    if (startsWithQ(word, q)) return 1;
    if (includesQ(word, q)) return 2;

    if (aka && startsWithQ(aka, q)) return 3;
    if (aka && includesQ(aka, q)) return 4;

    if (def && includesQ(def, q)) return 5;
    if (lang && includesQ(lang, q)) return 6;

    return 9;
  }

  function compareByRelevance(q) {
    return (a, b) => {
      const sa = relevanceScore(a, q);
      const sb = relevanceScore(b, q);
      if (sa !== sb) return sa - sb;

      const aw = (a.word || "").toString().trim();
      const bw = (b.word || "").toString().trim();
      if (aw.length !== bw.length) return aw.length - bw.length;

      return aw.localeCompare(bw, undefined, { sensitivity: "base" });
    };
  }

  /**
   * Groups items by letter.
   * If keepOrder = true, section order follows first appearance in `items` (best matches bubble up).
   * If keepOrder = false, sections are A-Z with # first.
   */
  function groupByLetter(items, keepOrder) {
    const groups = new Map();
    const order = [];

    items.forEach((it) => {
      const L = (it.letter || "#").toString().toUpperCase();
      if (!groups.has(L)) {
        groups.set(L, []);
        order.push(L);
      }
      groups.get(L).push(it);
    });

    let letters;
    if (keepOrder) {
      letters = order;
    } else {
      letters = Array.from(groups.keys()).sort((a, b) => {
        if (a === "#") return -1;
        if (b === "#") return 1;
        return a.localeCompare(b);
      });
    }

    return letters.map((L) => ({
      letter: L,
      items: groups.get(L),
    }));
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  // ------------------------
  // Render list
  // ------------------------
  function render(items, searching) {
    listEl.innerHTML = "";
    emptyEl.hidden = items.length > 0;

    const grouped = groupByLetter(items, !!searching);

    grouped.forEach((group) => {
      const section = el("div", "section");
      const header = el("div", "section-header", group.letter);
      const rowsWrap = el("div", "section-rows");

      group.items.forEach((item) => {
        const row = el("div", "row");
        row.tabIndex = 0;

        // ✅ Deep-link anchors
        // Each glossary entry row gets an id equal to its slug
        if (item.slug) row.id = item.slug;
        if (item.slug) row.setAttribute("data-slug", item.slug);

        const left = el("div", "row-left");
        const word = el("div", "row-word", item.word);

        const defPreview = (item.definition || "")
          .toString()
          .replace(/\s+/g, " ")
          .trim();
        const subText = defPreview.length > 96 ? defPreview.slice(0, 96) + "…" : defPreview;
        const sub = el("div", "row-sub", subText);

        left.appendChild(word);
        left.appendChild(sub);

        const chevron = el("div", "row-chevron", "›");

        row.appendChild(left);
        row.appendChild(chevron);

        row.addEventListener("click", () => openSheet(item));
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openSheet(item);
          }
        });

        rowsWrap.appendChild(row);
      });

      section.appendChild(header);
      section.appendChild(rowsWrap);
      listEl.appendChild(section);
    });
  }

  // ------------------------
  // Bottom sheet
  // ------------------------
  function openSheet(item) {
    sheetWord.textContent = item.word || "—";
    sheetDefinition.textContent = (item.definition || "").toString().trim();

    const hasLang = !!(item.language && item.language.toString().trim());
    const hasAka = !!(item.aka && item.aka.toString().trim());

    sheetMeta.hidden = !(hasLang || hasAka);

    if (hasLang) {
      sheetLanguage.textContent = item.language.toString().trim();
      sheetLanguage.hidden = false;
    } else {
      sheetLanguage.hidden = true;
    }

    if (hasAka) {
      sheetAka.textContent = "aka: " + item.aka.toString().trim();
      sheetAka.hidden = false;
    } else {
      sheetAka.hidden = true;
    }

    overlay.hidden = false;
    overlay.classList.add("is-open");
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function closeSheet() {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    overlay.classList.remove("is-open");

    window.setTimeout(() => {
      overlay.hidden = true;
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }, 220);
  }

  overlay.addEventListener("click", closeSheet);
  sheetClose.addEventListener("click", closeSheet);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheet.classList.contains("is-open")) {
      closeSheet();
    }
  });

  // ------------------------
  // Search
  // ------------------------
  function applySearch() {
    const q = normalize(searchEl.value);
    const searching = !!q;

    clearBtn.classList.toggle("is-visible", searching);

    let filtered = allItems.filter((it) => matches(it, q));

    if (searching) {
      filtered = filtered.sort(compareByRelevance(q));
    }

    activeItems = filtered;

    render(activeItems, searching);
  }

  searchEl.addEventListener("input", applySearch);

  clearBtn.addEventListener("click", () => {
    searchEl.value = "";
    searchEl.focus();
    applySearch();
  });

  // ------------------------
  // Deep-link support
  // /learn/glossary/?term=<slug>
  // ------------------------
  function getTermParam() {
    const params = new URLSearchParams(window.location.search);
    const term = params.get("term");
    if (!term) return "";
    return decodeURIComponent(term).trim();
  }

  function jumpToTerm(termRaw) {
    if (!termRaw) return;

    // term can be slug or raw word — support both
    const targetSlug = toSlug(termRaw);

    // Find item in data (prefer exact slug match)
    const item =
      allItems.find((it) => (it.slug || "") === termRaw) ||
      allItems.find((it) => (it.slug || "") === targetSlug) ||
      allItems.find((it) => normalize(it.word) === normalize(termRaw)) ||
      null;

    if (!item) return;

    // Ensure list is in "full mode" when jumping
    // (clear any existing search filter so the row exists)
    if (searchEl && searchEl.value) {
      searchEl.value = "";
    }
    applySearch();

    // Scroll to row by id
    const elRow = document.getElementById(item.slug || targetSlug);
    if (elRow) {
      elRow.scrollIntoView({ behavior: "smooth", block: "start" });
      // small delay so the scroll finishes before opening sheet
      window.setTimeout(() => openSheet(item), 180);
    } else {
      // If for any reason row not found, still open sheet
      openSheet(item);
    }
  }

  // ------------------------
  // Init
  // ------------------------
  (async function init() {
    try {
      const raw = await loadData();

      // Normalize keys + compute slug + letter
      allItems = raw.map((x) => {
        const word = x.word ?? x.Word ?? "";
        const definition = x.definition ?? x.Definition ?? "";
        const aka = x.aka ?? x.AKA ?? x.Aka ?? "";
        const language = x.language ?? x.Language ?? "";

        const slug = x.slug || toSlug(word);
        const letter = x.letter || firstLetter(word);

        return {
          ...x,
          word,
          definition,
          aka,
          language,
          slug,
          letter,
        };
      });

      activeItems = allItems.slice();
      render(activeItems, false);
      applySearch();

      // ✅ Handle /learn/glossary/?term=...
      const term = getTermParam();
      if (term) {
        // wait a tick to ensure DOM is painted
        window.setTimeout(() => jumpToTerm(term), 60);
      }
    } catch (err) {
      console.error(err);
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      emptyEl.querySelector(".empty-title").textContent = "Couldn’t load glossary";
      emptyEl.querySelector(".empty-sub").textContent = "Check /data/glossary.json";
    }
  })();
})();
