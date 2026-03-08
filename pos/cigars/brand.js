const brandName=new URLSearchParams(location.search).get("brand")

const list=document.getElementById("brand-list")

let cigars=[]

async function load(){

const res=await fetch("/data/cigars.json")
const data=await res.json()

cigars=data.filter(c=>c.brand===brandName)

render(cigars)

}

function render(rows){

list.innerHTML=""

rows.forEach(c=>{

const row=document.createElement("div")
row.className="brand-row"

row.innerHTML=`
<img src="/img/icons/brands/${c.brand.toLowerCase()}.svg">

<div class="brand-row-main">

<div class="brand-row-title">${c.name}</div>
<div class="brand-row-sub">${c.vitola}</div>

</div>

<div class="brand-row-right">

<div class="brand-row-price">${c.price}</div>

<button class="pos-add">+</button>

</div>
`

row.querySelector(".brand-row-title").onclick=()=>{
openCigar(c)
}

list.appendChild(row)

})

}

function openCigar(c){

const modal=document.createElement("div")

modal.className="cigar-modal"

modal.innerHTML=`

<div class="cigar-modal-card">

<img src="${c.image}" class="cigar-stick">

<div class="cigar-specs">

<div>Ring ${c.ring}</div>
<div>Length ${c.length}</div>
<div>${c.shape}</div>
<div>${c.wrapper}</div>

</div>

<button onclick="this.closest('.cigar-modal').remove()">Close</button>

</div>

`

document.body.appendChild(modal)

}

load()
