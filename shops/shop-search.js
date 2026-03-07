const listEl = document.querySelector("#shList")
const searchInput = document.querySelector("#shQuery")

function clean(v){
return String(v ?? "").trim()
}

function slugKey(v){

return clean(v)
.toLowerCase()
.replace(/&/g,"and")
.replace(/[^a-z0-9]/g,"")

}

function logoHtml(key,name){

const svg=`/img/icons/shops/${key}.svg`
const png=`/img/icons/shops/${key}.png`

return `
<img
class="sh-item-logo"
src="${svg}"
alt="${name}"
onerror="this.onerror=null;this.src='${png}'"
/>
`

}

function render(list,q){

const query=slugKey(q)

listEl.innerHTML=""

const filtered=list.filter(shop=>{

const n=slugKey(shop.name)
const c=slugKey(shop.city)

return !query || n.includes(query) || c.includes(query)

})

filtered.forEach(shop=>{

const key=slugKey(shop.slug || shop.name)

const row=document.createElement("a")

row.className="sh-item"

row.href=`/shops/${key}`

row.innerHTML=`

<div class="sh-item-main">

${logoHtml(key,shop.name)}

<div>

<div class="sh-item-name">${shop.name}</div>

<div class="sh-item-sub">${shop.city}, ${shop.state}</div>

</div>

</div>

`

listEl.appendChild(row)

})

}

async function init(){

const res = await fetch("/shops/shops.json?v="+Date.now())

const data = await res.json()

render(data,"")

searchInput.addEventListener("input",()=>{

render(data,searchInput.value)

})

}

init()
