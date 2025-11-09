document.addEventListener("DOMContentLoaded", () => {
  const fab = document.getElementById('receiptFab');
  const overlay = document.getElementById('receiptOverlay');
  const modal = document.getElementById('receiptModal');
  const closeBtn = document.getElementById('receiptClose');
  const checkoutBtn = document.getElementById('checkoutBtn');

  if (!fab || !overlay || !modal) return;

  const openReceipt = () => {
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      modal.classList.add('receipt-open');
    });
  };

  const closeReceipt = () => {
    modal.classList.remove('receipt-open');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 220);
  };

  fab.addEventListener('click', openReceipt);
  closeBtn.addEventListener('click', closeReceipt);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeReceipt();
  });
  if (checkoutBtn) checkoutBtn.addEventListener('click', closeReceipt);
});
