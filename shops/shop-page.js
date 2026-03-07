function key(v){

return String(v ?? "")
.toLowerCase()
.replace(/[^a-z0-9]/g,"")

}

function getSlug(){

const parts=window.location.pathname.split("/")

return key(parts[2])

}

async function init(){

const slug=getSlug()

const res=await fetch("/shops/shops.json?v="+Date.now())

const list=await res.json()

const shop=list.find(s=>key(s.slug || s.name)===slug)

if(!shop)return

document.getElementById("spName").textContent=shop.name

document.getElementById("spCity").textContent=`${shop.city}, ${shop.state}`

const logoKey=key(shop.slug || shop.name)

const logo=document.getElementById("spLogo")

logo.src=`/img/icons/shops/${logoKey}.svg`

logo.onerror=()=>{

logo.src=`/img/icons/shops/${logoKey}.png`

}

document.getElementById("aboutContent").innerHTML=`

<p>${shop.address}</p>
<p>${shop.phone}</p>

`

}

init()
