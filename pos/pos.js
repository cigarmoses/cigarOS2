// Use the shared cart (Cart, CartUI loaded in HTML)

// Helper to create an <img> that falls back to /img/icons/pos.svg if missing
function makeImg(src, alt){
  const img = document.createElement('img');
  img.className = 'cigar-thumb';
  img.alt = alt || '';
  img.src = src;
  img.onerror = () => { img.onerror = null; img.src = '/img/icons/pos.svg'; };
  return img;
}

// Catalog (note corrected "fatbottombetty")
const cigars = [
  {
    id:'cig-andalusian-bull',
    name:'Andalusian Bull',
    brand:'La Flor Dominicana',
    vitola:'Figurado',
    price:32.00,
    icon:'/img/cigars/andalusian-bull.png', // ensure this file exists or keep fallback
    taxable:true,
    length:'6.50',
    ring:'52',
    origin:'Dominican Republic'
  },
  {
    id:'cig-fatbottombetty',   // ✅ corrected internal ID
    name:'Fat Bottom Betty',   // ✅ display name still formatted for readability
    brand:'La Flor Dominicana',
    vitola:'Gordo',
    price:13.99,
    icon:'/img/cigars/fatbottombetty.png',  // ✅ corrected file name
    taxable:true,
    length:'5.00',
    ring:'60',
    origin:'Dominican Republic'
  }
];

function renderCigars(){
  const host = document.getElementById('cigarGrid');
  host.innerHTML = '';

  cigars.forEach(c => {
    const card = document.createElement('div');
    card.className = 'cigar-card';

    // Thumb (with fallback)
    const thumb = makeImg(c.icon || '/img/icons/pos.svg', c.name);

    // Meta block
    const meta = document.createElement('div');
    meta.className = 'cigar-meta';

    const nameLink = document.createElement('a');
    nameLink.className = 'cigar-name';
    nameLink.textContent = c.name;
    nameLink.href = 'javascript:void(0)';
    nameLink.addEventListener('click', () => {
      alert(`${c.name}\n${c.vitola} · ${c.brand}\n$${c.price.toFixed(2)}`);
      // later: open a proper modal with full cigar specs
    });

    const sub = document.createElement('div');
    sub.className = 'cigar-sub';
    sub.textContent = `${c.vitola} · ${c.brand}`;

    const unit = document.createElement('div');
    unit.className = 'cigar-unit';
    unit.textContent = c.price.toFixed(2);

    meta.appendChild(nameLink);
    meta.appendChild(sub);
    meta.appendChild(unit);

    // Add button
    const add = document.createElement('button');
    add.className = 'add-btn';
    add.textContent = 'Add';
    add.addEventListener('click', () => Cart.addItem(c, 1));

    // Assemble card
    card.appendChild(thumb);
    card.appendChild(meta);
    card.appendChild(add);

    host.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  Cart.setTaxRate(0.07); // enforce 7%
  renderCigars();
  CartUI.mountCartUI();   // shared sidebar; Checkout → /invoice/
});
