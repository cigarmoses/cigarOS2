// Minimal shared cart for category pages (4-up pages with items)
export function attachCartUI({ openButtonSelector, onConfirm }) {
  const sheet = document.getElementById("sheet");
  const sheetTitle = document.getElementById("sheetTitle");
  const sheetPrice = document.getElementById("sheetPrice");
  const sheetSubtotal = document.getElementById("sheetSubtotal");
  const qtyVal = document.getElementById("qtyVal");
  const btnMinus = document.getElementById("btnMinus");
  const btnPlus = document.getElementById("btnPlus");
  const btnAddToBill = document.getElementById("btnAddToBill");
  const cartCountEl = document.getElementById("cartCount");
  const cartTotalEl = document.getElementById("cartTotal");

  let cartQty = 0, cartTotal = 0;
  let current = { name:"", price:0, qty:1 };

  function open(item){
    current = { name:item.name, price:item.price, qty:1 };
    sheetTitle.textContent = current.name;
    sheetPrice.textContent = `$${current.price.toFixed(2)}`;
    qtyVal.textContent = "1";
    sheetSubtotal.textContent = `$${current.price.toFixed(2)} subtotal`;
    sheet.classList.add("sheet--open"); sheet.setAttribute("aria-hidden","false");
  }
  function close(){
    sheet.classList.remove("sheet--open"); sheet.setAttribute("aria-hidden","true");
  }
  btnMinus.addEventListener("click", ()=>{ if(current.qty>1){ current.qty--; qtyVal.textContent=String(current.qty); sheetSubtotal.textContent=`$${(current.qty*current.price).toFixed(2)} subtotal`; }});
  btnPlus.addEventListener("click", ()=>{ current.qty++; qtyVal.textContent=String(current.qty); sheetSubtotal.textContent=`$${(current.qty*current.price).toFixed(2)} subtotal`; });
  btnAddToBill.addEventListener("click", ()=>{
    cartQty += current.qty; cartTotal += current.qty*current.price;
    cartCountEl.textContent = String(cartQty);
    cartTotalEl.textContent = `$${cartTotal.toFixed(2)}`;
    if (typeof onConfirm === "function") onConfirm({ ...current });
    close();
  });
  document.querySelectorAll("[data-close-sheet]").forEach(el=>el.addEventListener("click", close));

  document.addEventListener("click",(e)=>{
    const t = e.target.closest(openButtonSelector);
    if(!t) return;
    const name = t.dataset.name;
    const price = parseFloat(t.dataset.price);
    open({ name, price });
  });
}
