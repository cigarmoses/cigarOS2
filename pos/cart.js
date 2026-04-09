const CART_KEY = "pos_cart";

export function getCart(){
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveCart(cart){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function addToCart(item){
  const cart = getCart();

  const existing = cart.find(i => i.id === item.id);

  if(existing){
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }

  saveCart(cart);
}

export function clearCart(){
  localStorage.removeItem(CART_KEY);
}

export function getCartTotal(){
  return getCart().reduce((sum, i) => sum + (i.price * i.qty), 0);
}
