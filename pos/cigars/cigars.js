// /pos/cigars/cigars.js

document.addEventListener("DOMContentLoaded", () => {
  // ----------------------------------
  // Back button: go to main POS page
  // ----------------------------------
  const backBtn = document.getElementById("cigars-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/pos/";
    });
  }

  // ----------------------------------
  // Fix relative asset paths on /pos/cigars/
  // Example bad:  img/icons/brands/padron.svg
  // Needs to be:  /img/icons/brands/padron.svg
  // ----------------------------------
  function toRootAbsolute(url) {
    if (!url) return url;
    const s = String(url).trim();

    if (
      s.startsWith("/") ||
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("data:") ||
      s.startsWith("blob:")
    ) return s;

    return "/" + s.replace(/^\.?\//, "");
  }

  function fixAllAssets(root = document) {
    // <img src="...">
    root.querySelectorAll?.("img[src]")?.forEach((img) => {
      const src = img.getAttribute("src");
      if (src) img.setAttribute("src", toRootAbsolute(src));
    });

    // inline style background-image:url(...)
    root.querySelectorAll?.("[style*='url(']")?.forEach((el) => {
      const style = el.getAttribute("style");
      if (!style) return;

      const fixed = style.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, path) => {
        return `url(${q || ""}${toRootAbsolute(path)}${q || ""})`;
      });

      if (fixed !== style) el.setAttribute("style", fixed);
    });

    // SVG href / xlink:href (for <use> etc)
    root.querySelectorAll?.("[href], [xlink\\:href]")?.forEach((n) => {
      const href = n.getAttribute("href");
      if (href) n.setAttribute("href", toRootAbsolute(href));

      const xhref = n.getAttribute("xlink:href");
      if (xhref) n.setAttribute("xlink:href", toRootAbsolute(xhref));
    });
  }

  // Run immediately (for any server-rendered markup)
  fixAllAssets(document);

  // Also run shortly after (helps with quick post-load renders)
  setTimeout(() => fixAllAssets(document), 250);
  setTimeout(() => fixAllAssets(document), 1200);

  // Watch for brand tiles/icons being injected by build-cigars.js
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type !== "childList") continue;

      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return; // element only
        fixAllAssets(node);
      });
    }
  });

  mo.observe(document.documentElement, { subtree: true, childList: true });
});
