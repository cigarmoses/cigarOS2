document.addEventListener("DOMContentLoaded", () => {
  // Back arrow -> previous page or home
  const backBtn = document.getElementById("learn-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    });
  }

  // Card navigation
  const cards = document.querySelectorAll(".learn-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const target = card.getAttribute("data-target");
      if (target) {
        window.location.href = target;
      }
    });
  });

  // (Optional) hook up search later
});
