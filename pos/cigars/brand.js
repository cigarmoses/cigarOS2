const brand=new URLSearchParams(location.search).get("brand")

const list=document.getElementById("brand-list")
const search=document.getElementById("brand-search")

let cigars=[]

async function load(){

const res=await fetch("/data/cigars.json")
const data=await res.json()

cigars=data.filter(c=>c.brand===brand)

render(cigars)

}

function render(rows){

list.innerHTML=""

rows.forEach(c=>{

const row=document.createElement("div")
row.className="brand-row"

row.innerHTML=`
<img src="/img/icons/brands/${brand.toLowerCase()}.svg">

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

const modal=document.getElementById("cigar-modal")
const card=document.getElementById("cigar-modal-card")

card.innerHTML=`

<img src="${c.image}" style="width:100%">

<h2>${c.name}</h2>

<div>Ring ${c.ring}</div>
<div>Length ${c.length}</div>
<div>${c.shape}</div>
<div>${c.wrapper}</div>

<button onclick="closeCigar()">Close</button>

`

modal.classList.add("show")

}

function closeCigar(){
document.getElementById("cigar-modal").classList.remove("show")
}

search.oninput=()=>{
const q=search.value.toLowerCase()

render(
cigars.filter(c=>c.name.toLowerCase().includes(q))
)
}

load()
