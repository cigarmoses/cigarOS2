// /learn/glossary/glossary.js
// Sleek iOS-style glossary: grouped list + search + bottom sheet

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
    return (s || "")
      .toString()
      .toLowerCase()
      .trim();
  }

  function matches(item, q) {
    if (!q) return true;
    const word = normalize(item.word);
    const def = normalize(item.definition);
    const aka = normalize(item.aka);
    const lang = normalize(item.language);
    return (
      word.includes(q) ||
      aka.includes(q) ||
      lang.includes(q) ||
      def.includes(q)
    );
  }

  function groupByLetter(items) {
    const groups = new Map();
    items.forEach((it) => {
      const L = (it.letter || "#").toString().toUpperCase();
      if (!groups.has(L)) groups.set(L, []);
      groups.get(L).push(it);
    });

    // sort letters with # first, then A-Z
    const letters = Array.from(groups.keys()).sort((a, b) => {
      if (a === "#") return -1;
      if (b === "#") return 1;
      return a.localeCompare(b);
    });

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
  function render(items) {
    listEl.innerHTML = "";
    emptyEl.hidden = items.length > 0;

    const grouped = groupByLetter(items);

    grouped.forEach((group) => {
      const section = el("div", "section");
      const header = el("div", "section-header", group.letter);
      const rowsWrap = el("div", "section-rows");

      group.items.forEach((item) => {
        const row = el("div", "row");
        row.tabIndex = 0;

        const left = el("div", "row-left");
        const word = el("div", "row-word", item.word);

        const defPreview = (item.definition || "").toString().replace(/\s+/g, " ").trim();
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

    // lock scroll behind sheet
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function closeSheet() {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    overlay.classList.remove("is-open");

    // unlock after animation
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
    clearBtn.classList.toggle("is-visible", !!q);

    activeItems = allItems.filter((it) => matches(it, q));
    render(activeItems);
  }

  searchEl.addEventListener("input", applySearch);

  clearBtn.addEventListener("click", () => {
    searchEl.value = "";
    searchEl.focus();
    applySearch();
  });

  // ------------------------
  // Init
  // ------------------------
  (async function init() {
    try {
      allItems = await loadData();
      activeItems = allItems.slice();
      render(activeItems);
      applySearch();
    } catch (err) {
      console.error(err);
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      emptyEl.querySelector(".empty-title").textContent = "Couldn’t load glossary";
      emptyEl.querySelector(".empty-sub").textContent = "Check /data/glossary.json";
    }
  })();
})();
