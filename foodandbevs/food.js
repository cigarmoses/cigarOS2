// Helper: image with fallback
function icon(src){
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.onerror = () => { img.onerror = null; img.src = '/img/icons/pos.svg'; };
  return img;
}

// Prices
const P = {
  default: 1.50,
  water: 1.00,
  monstertea: 3.50
};

// Catalog (filenames exactly as in /img/icons/foodandbevs/)
const items = [
  { id:'bev-7up',          sku:'7up',          name:'7 UP',            icon:'/img/icons/foodandbevs/7up.svg',          price:P.default,   taxable:true },
  { id:'bev-cocacola',     sku:'cocacola',     name:'Coca-Cola',       icon:'/img/icons/foodandbevs/cocacola.svg',     price:P.default,   taxable:true },
  { id:'bev-cocacolazero', sku:'cocacolazero', name:'Coca-Cola Zero',  icon:'/img/icons/foodandbevs/cocacolazero.svg', price:P.default,   taxable:true },
  { id:'bev-dietcoke',     sku:'dietcoke',     name:'Diet Coke',       icon:'/img/icons/foodandbevs/dietcoke.svg',     price:P.default,   taxable:true },
  { id:'bev-dietdrpepper', sku:'dietdrpepper', name:'Diet Dr Pepper',  icon:'/img/icons/foodandbevs/dietdrpepper.svg', price:P.default,   taxable:true },
  { id:'bev-drpepper',     sku:'drpepper',     name:'Dr Pepper',       icon:'/img/icons/foodandbevs/drpepper.svg',     price:P.default,   taxable:true },
  { id:'bev-gingerale',    sku:'gingerale',    name:'Ginger Ale',      icon:'/img/icons/foodandbevs/gingerale.svg',    price:P.default,   taxable:true },
  { id:'bev-monstertea',   sku:'monstertea',   name:'Monster Tea',     icon:'/img/icons/foodandbevs/monstertea.svg',   price:P.monstertea,taxable:true },
  { id:'bev-pepsi',        sku:'pepsi',        name:'Pepsi',           icon:'/img/icons/foodandbevs/pepsi.svg',        price:P.default,   taxable:true },
  { id:'bev-rootbeer',     sku:'rootbeer',     name:'Root Beer',       icon:'/img/icons/foodandbevs/rootbeer.svg',     price:P.default,   taxable:true },
  { id:'bev-sprite',       sku:'sprite',       name:'Sprite',          icon:'/img/icons/foodandbevs/sprite.svg',       price:P.default,   taxable:true },
  // Water icon: add /img/icons/foodandbevs/water.svg if you have it; fallback will cover if not.
  { id:'bev-water',        sku:'water',        name:'Water',           icon:'/img/icons/foodandbevs/water.svg',        price:P.water,     taxable:true }
];

// Render
function renderBevs(){
  const host = document.getElementById('bevGrid');
  host.innerHTML = '';
  items.forEach(it => {
    const card = document.createElement('div');
    card.className = 'bev-card';
    card.appendChild(icon(it.icon));

    const name = document.createElement('div');
    name.className = 'bev-name';
    name.textContent = it.name;
    card.appendChild(name);

    const price = document.createElement('div');
    price.className = 'bev-price';
    price.textContent = `$${it.price.toFixed(2)}`;
    card.appendChild(price);

    card.addEventListener('click', () => Cart.addItem({
      id: it.id,
      sku: it.sku,
      name: it.name,
      category: 'Food & Beverages',
      price: it.price,
      icon: it.icon,
      taxable: it.taxable
    }, 1));

    host.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  Cart.setTaxRate(0.07);     // ensure 7% app-wide
  renderBevs();
  CartUI.mountCartUI();      // Checkout → /invoice/
});
