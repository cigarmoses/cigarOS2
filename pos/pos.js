// Minimal cigar catalog (demo)
const cigars = [
  {
    id:'cig-andalusian-bull',
    name:'Andalusian Bull',
    brand:'La Flor Dominicana',
    vitola:'Figurado',
    price:32.00,
    icon:'/img/icons/lfd.svg', // replace with your cigar image/icon
    taxable:true
  },
  {
    id:'cig-fat-bottom-betty',
    name:'Fat Bottom Betty',
    brand:'La Flor Dominicana',
    vitola:'Gordo',
    price:13.99,
    icon:'/img/icons/betty.svg', // replace with brand icon
    taxable:true
  }
];

function renderCigars(){
  const host = document.getElementById('cigarGrid');
  host.innerHTML = '';

  cigars.forEach(c => {
    const card = document.createElement('div');
    card.className = 'cigar-card';
    card.innerHTML = `
      <img class="cigar-thumb" src="${c.icon}" alt="${c.name}" />
      <div class="cigar-meta">
        <a class="cigar-name">${c.name}</a>
        <span class="cigar-sub">${c.vitola} · ${c.brand}</span>
        <span class="cigar-sub">${c.price.toFixed(2)}${1 > 1 ? ' ea' : ''}</span>
      </div>
      <button class="add-btn">Add</button>
    `;

    // Name click could open modal with specs later
    card.querySelector('.cigar-name').addEventListener('click', () => {
      alert(`${c.name}\n${c.brand}\n${c.vitola}\n$${c.price.toFixed(2)}`);
    });

    card.querySelector('.add-btn').addEventListener('click', () => {
      Cart.addItem(c, 1);
    });

    host.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  Cart.setTaxRate(0.07);
  renderCigars();
  CartUI.mountCartUI({
    onCheckout(payload){
      alert('POS checkout payload:\n' + JSON.stringify(payload, null, 2));
    }
  });
});
