/* /js/theme-toggle.js
   Theme toggle (html[data-theme]) + cart "has items" swap (body.has-cart-items)

   Expects:
   - Theme toggle button id: #theme-toggle
   - Cart button uses two imgs:
       .cart-img--empty (blue)
       .cart-img--hot   (red)
     CSS swaps them when body.has-cart-items is present.
*/

(() => {
  const HTML = document.documentElement;
  const BODY = document.body;

  function getSavedTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return null;
  }

  function getSystemTheme() {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    return prefersDark ? "dark" : "light";
  }

  function setAria(theme) {
    const btn = document.querySelector("#theme-toggle");
    if (!btn) return;
    // aria-pressed=true means "dark mode on" in our UI
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    HTML.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setAria(next);
  }

  function toggleTheme() {
    const cur = HTML.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(cur === "dark" ? "light" : "dark");
  }

  // Cart state helper (red cart when items exist)
  function setCartHasItems(hasItems) {
    BODY.classList.toggle("has-cart-items", !!hasItems);
  }

  // Expose helper so brand.js / receipt code can call it when cart changes
  window.CigarOS_setCartHasItems = setCartHasItems;

  // boot theme
  const initial = getSavedTheme() || getSystemTheme();
  applyTheme(initial);

  // If user changes OS theme and they have NOT chosen a manual theme yet, follow system
  try {
    const mm = window.matchMedia?.("(prefers-color-scheme: dark)");
    mm?.addEventListener?.("change", () => {
      // only follow system when no manual choice exists
      if (getSavedTheme()) return;
      applyTheme(getSystemTheme());
    });
  } catch (_) {}

  // bind click
  document.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("#theme-toggle");
    if (!btn) return;
    e.preventDefault();
    toggleTheme();
  });

  // bind keyboard (space/enter)
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (!active || active.id !== "theme-toggle") return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggleTheme();
  });

  // OPTIONAL: if you store cart in localStorage, you can auto-sync here.
  // Leave OFF until you tell me your cart storage key/shape.
  // Example:
  // const raw = localStorage.getItem("pos_cart");
  // setCartHasItems(!!raw && raw !== "[]" );

})();
