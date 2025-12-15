// /js/global.js
// Global CigarOS2 behaviors loaded on ALL pages.

document.addEventListener("DOMContentLoaded", () => {
  // Inject Glossary Search everywhere
  const already = document.querySelector('script[src="/js/glossary-search.js"]');
  if (!already) {
    const s = document.createElement("script");
    s.src = "/js/glossary-search.js";
    s.defer = true;
    document.body.appendChild(s);
  }
});
