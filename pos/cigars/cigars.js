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
  // Asset path normalizer (root-absolute)
  // ----------------------------------
  function toRootAbsolute(url) {
    if (!url) return url;

    const s = String(url).trim();

    // Leave absolute URLs alone
    if (
      s.startsWith("/") ||
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("data:") ||
      s.startsWith("blob:")
    ) {
      return s;
    }

    // Make relative paths root-absolute
    return "/" + s.replace(/^\.?\//, "");
  }

  function fixSrc(img) {
    const src = img.getAttribute("src");
    if (!src) return;
    img.setAttribute("src", toRootAbsolute(src));
  }

  function fixSrcset(el) {
    const srcset = el.getAttribute("srcset");
    if (!srcset) return;

    // srcset format: "url1 1x, url2 2x" OR "url 320w"
    const fixed = srcset
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const pieces = part.split(/\s+/);
        const url = pieces.shift();
        const descriptor = pieces.join(" ");
        const newUrl = toRootAbsolute(url);
        return descriptor ? `${newUrl} ${descriptor}` : newUrl;
      })
      .join(", ");

    el.setAttribute("srcset", fixed);
  }

  function fixInlineBackground(el) {
    const style = el.getAttribute("style");
    if (!style || !style.includes("url(")) return;

    // Replace url(img/...) or url(./img/...) etc with url(/img/...)
    const fixed = style.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, path) => {
      const newPath = toRootAbsolute(path);
      return `url(${q || ""}${newPath}${q || ""})`;
    });

    if (fixed !== style) el.setAttribute("style", fixed);
  }

  function fixSvgHrefs(root) {
    // Handles <use href="...">, <image href="..."> and xlink:href variants
    const nodes = root.querySelectorAll
      ? root.querySelectorAll("[href], [xlink\\:href]")
      : [];

    nodes.forEach((n) => {
      const href = n.getAttribute("href");
      if (href) n.setAttribute("href", toRootAbsolute(href));

      const xhref = n.getAttribute("xlink:href");
      if (xhref) n.setAttribute("xlink:href", toRootAbsolute(xhref));
    });
  }

  function fixAllAssets(root = document) {
    // imgs
    root.querySelectorAll("img[src]").forEach(fixSrc);

    // srcset on <img> or <source>
    root.querySelectorAll("[srcset]").forEach(fixSrcset);

    // inline background images
    root.querySelectorAll("[style*='url(']").forEach(fixInlineBackground);

    // svg href/xlink:href
    fixSvgHrefs(root);
  }

  // Run once now
  fixAllAssets(document);

  // Run again shortly after (helps when UI paints right after load)
  setTimeout(() => fixAllAssets(document), 250);
  setTimeout(() => fixAllAssets(document), 1000);

  // ----------------------------------
  // Watch for dynamically inserted tiles/icons
  // ----------------------------------
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return; // ELEMENT_NODE only
          fixAllAssets(node);
        });
      } else if (m.type === "attributes") {
        const el = m.target;
        if (!(el && el.getAttribute)) continue;

        if (m.attributeName === "src" && el.tagName === "IMG") fixSrc(el);
        if (m.attributeName === "srcset") fixSrcset(el);
        if (m.attributeName === "style") fixInlineBackground(el);
        if (m.attributeName === "href" || m.attributeName === "xlink:href") {
          // SVG use/image
          const v =
            el.getAttribute(m.attributeName) ||
            el.getAttribute(m.attributeName === "href" ? "xlink:href" : "href");
          if (v) el.setAttribute(m.attributeName, toRootAbsolute(v));
        }
      }
    }
  });

  mo.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "style", "href", "xlink:href"],
  });
});
