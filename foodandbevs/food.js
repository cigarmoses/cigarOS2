// Catalog — all $1.50, taxable = true
const PRICE = 1.50;
const bevItems = [
  { id:'bev-7up',          name:'7 UP',            icon:'/img/icons/foodandbevs/7up.svg',          price:PRICE, taxable:true },
  { id:'bev-cocacola',     name:'Coca-Cola',       icon:'/img/icons/foodandbevs/cocacola.svg',     price:PRICE, taxable:true },
  { id:'bev-cocacolazero', name:'Coca-Cola Zero',  icon:'/img/icons/foodandbevs/cocacolazero.svg', price:PRICE, taxable:true },
  { id:'bev-drpepper',     name:'Dr Pepper',       icon:'/img/icons/foodandbevs/drpepper.svg',     price:PRICE, taxable:true },
  { id:'bev-dietdrpepper', name:'Diet Dr Pepper',  icon:'/img/icons/foodandbevs/dietdrpepper.svg', price:PRICE, taxable:true },
  { id:'bev-gingerale',    name:'Ginger Ale',      icon:'/img/icons/foodandbevs/gingerale.svg',    price:PRICE, taxable:true },
  { id:'bev-monstertea',   name:'Monster Tea',     icon:'/img/icons/foodandbevs/monstertea.svg',   price:PRICE, taxable:true },
  { id:'bev-pepsi',        name:'Pepsi',           icon:'/img/icons/foodandbevs/pepsi.svg',        price:PRICE, taxable:true },
  { id:'bev-rootbeer',     name:'Root Beer',       icon:'/img/icons/foodandbevs/rootbeer.svg',     price:PRICE, taxable:true },
  { id:'bev-sprite',       name:'Sprite',          icon:'/img/icons/foodandbevs/sprite.svg',       price:PRICE, taxable:true },
];

function renderBevs(){
  const host = document.getElementById('bevGrid');
  host.innerHTML = '';
  bevItems.forEach(it => {
    const card = document.createElement('div');
    card.className = 'bev-card';
    card.innerHTML = `
      <img src="${it.icon}" alt="${it.name}"/>
      <span class="bev-name">${it.name}</span>
      <span class="bev-price">$${it.price.toFixed(2)}</span>
    `;
    card.addEventListener('click', () => Cart.addItem(it, 1));
    host.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // ensure 7% by default (can be changed elsewhere once for the whole app)
  Cart.setTaxRate(0.07);
  renderBevs();
  CartUI.mountCartUI({
    onCheckout(payload){
      // integrate with invoice/printer later
      alert('Checkout payload:\n' + JSON.stringify(payload, null, 2));
    }
  });
});
