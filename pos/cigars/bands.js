const btn=document.getElementById("btn-bands")

if(new URLSearchParams(location.search).get("brand")==="Padron"){

btn.onclick=()=>{

document.getElementById("bands-modal").style.display="block"

}

}
else{

btn.style.display="none"

}
