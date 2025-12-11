document.addEventListener("DOMContentLoaded", () => {
  // Back arrow -> POS home (or history back)
  const backBtn = document.getElementById("learn-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // Use history first so it behaves like the rest of the app
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/pos/";
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
