// /pos/cigars/cigars.js

document.addEventListener("DOMContentLoaded", () => {
  // ----------------------------------
  // Back button -> POS home
  // ----------------------------------
  const backBtn = document.getElementById("cigars-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/pos/";
    });
  }

  // ----------------------------------
  // Normalize brand image paths
  // Fixes /pos/cigars/img/... 404 issue
  // ----------------------------------
  function normalizeAssetPath(path) {
    if (!path) return "";
    if (path.startsWith("/") || path.startsWith("http")) return path;
    return "/" + path;
  }

  // Fix all brand icons already rendered
  const brandImages = document.querySelectorAll(
    ".brand-card img, .brand-tile img, .brand-icon"
  );

  brandImages.forEach((img) => {
    const src = img.getAttribute("src");
    if (!src) return;
    img.setAttribute("src", normalizeAssetPath(src));
  });
});
