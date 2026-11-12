(() => {
'use strict';
const $=id=>document.getElementById(id),api=window.CigarosPublicationLists,searchAPI=window.CigarosPublicationSearch;
let lists=[],index=[],publisher=null,shown=30,loading=false,request=0;
const pubs=api.publishers;
const text=v=>String(v??'').trim();
const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
const isCuban=r=>/^(?:yes|true|1|y|cuban|cuba|🇨🇺)$/i.test(text(r.cuban))||/^cuba$/i.test(text(r.origin));
function imageURL(raw){try{const u=new URL(raw,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function sourceURL(raw){try{const u=new URL(raw);return u.protocol==='https:'&&['cigaraficionado.com','cigarjournal.com','halfwheel.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:null;}catch{return null;}}
function route(push=false){const u=new URL(location.href);u.search='';if(publisher)u.searchParams.set('publication',publisher);if($('year').value)u.searchParams.set('year',$('year').value);if($('search').value)u.searchParams.set('q',$('search').value);if(!$('cubans').checked)u.searchParams.set('cubans','0');history[push?'pushState':'replaceState'](null,'',u.pathname+u.search);}
function showLogin(message=''){$('viewer').hidden=true;$('login').hidden=false;$('status').hidden=true;$('retry').hidden=true;$('loginError').textContent=message;$('password').value='';lists=[];index=[];$('results').replaceChildren();}
      function visiblePhotoBounds(img){
        const width = img.naturalWidth, height = img.naturalHeight;
        const full = {x:0,y:0,width,height};
        try{
          // Remove transparent padding only, never leaf pixels or white backgrounds.
          // Downsample solely for bounds detection; the displayed image stays original.
          const scale = Math.min(1, 1400 / Math.max(width,height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.ceil(width*scale));
          canvas.height = Math.max(1, Math.ceil(height*scale));
          const ctx = canvas.getContext("2d", {willReadFrequently:true});
          if(!ctx) return full;
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
          let left=canvas.width, right=-1, top=canvas.height, bottom=-1;
          for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++){
            if(pixels[(y*canvas.width+x)*4+3] > 0){
              left=Math.min(left,x); right=Math.max(right,x);
              top=Math.min(top,y); bottom=Math.max(bottom,y);
            }
          }
          if(right < left || bottom < top) return full;
          const sx=width/canvas.width, sy=height/canvas.height;
          const x=Math.max(0,Math.floor((left-1)*sx));
          const y=Math.max(0,Math.floor((top-1)*sy));
          const x2=Math.min(width,Math.ceil((right+2)*sx));
          const y2=Math.min(height,Math.ceil((bottom+2)*sy));
          return {x,y,width:x2-x,height:y2-y};
        }catch{
          // Cross-origin images without CORS remain usable, without alpha trimming.
          return full;
        }
      }

function horizontalPhoto(url){
 const frame=el('div','photo-frame'),img=new Image();img.alt='';img.decoding='async';img.loading='lazy';
 img.addEventListener('load',()=>{
  const b=visiblePhotoBounds(img),vertical=b.height>b.width,ns='http://www.w3.org/2000/svg';
  const art=document.createElementNS(ns,'svg'),source=document.createElementNS(ns,'image');
  art.classList.add('photo');art.setAttribute('viewBox',`0 0 ${vertical?b.height:b.width} ${vertical?b.width:b.height}`);art.setAttribute('preserveAspectRatio','xMidYMid meet');art.setAttribute('aria-hidden','true');art.setAttribute('focusable','false');
  source.setAttribute('width',img.naturalWidth);source.setAttribute('height',img.naturalHeight);source.setAttribute('href',url);
  source.setAttribute('transform',vertical?`matrix(0 1 -1 0 ${b.y+b.height} ${-b.x})`:`translate(${-b.x} ${-b.y})`);art.append(source);frame.replaceChildren(art);
 },{once:true});img.addEventListener('error',()=>frame.remove(),{once:true});img.src=url;frame.append(img);return frame;
}
function card(item){
 const r=item.record,root=el('details','card'),s=el('summary'),copy=el('div','copy');
 const awards=item.awards.map(a=>`${!publisher?pubs.find(p=>p.id===a.publisherId)?.name+' · ':''}${a.rankLabel} · ${a.year}`).join('  /  ');s.append(el('div','award',awards));
 const photo=imageURL(r.cigar_img||'');if(r.cigar_img&&photo)s.append(horizontalPhoto(photo));
 copy.append(el('div','brand',(isCuban(r)?'🇨🇺 ':'')+text(r.brand)),el('div','name',[r.line,r.cigar].filter(Boolean).join(' ')));
 const chevron=el('span','chevron','⌄');chevron.setAttribute('aria-hidden','true');copy.append(chevron);s.append(copy);root.append(s);
 const detail=el('div','details'),specs=el('div','specs');
 const groups=[['measurements',[['ring','Ring'],['length','Length'],['vitola','Vitola']]],['profile',[['wrapper_shade','Wrapper shade'],['strength','Strength']]],['tobaccos',[['wrapper','Wrapper'],['binder','Binder'],['filler','Filler']]],['origin-shape',[['origin','Rolled in (origin)'],['shape','Shape']]],['extras',[['box_pressed','Box-pressed'],['msrp','MSRP']]]];
 for(const [name,fields] of groups){const dl=el('dl','spec-group');dl.dataset.row=name;for(const [key,label] of fields){if(!text(r[key]))continue;const wrap=el('div','spec-pill');wrap.dataset.spec=key;wrap.append(el('dt','',label),el('dd','',r[key]));dl.append(wrap);}if(dl.children.length)specs.append(dl);}detail.append(specs);
 const notes=r.cigar_journal_tasting_notes||r.excerpt;if(notes)detail.append(el('p','notes',notes));const source=sourceURL(item.awards[0]?.sourceUrl);if(source){const a=el('a','source','View original ranking ↗');a.href=source;a.target='_blank';a.rel='noopener noreferrer';detail.append(a);}root.append(detail);return root;
}
function updateYears(value=''){const own=lists.filter(l=>l.kind==='annual'&&(!publisher||l.publisherId===publisher));const years=[...new Set(own.map(l=>l.year))].sort((a,b)=>b-a);$('year').replaceChildren(new Option('All years',''),new Option('No. 1s','winners'),...years.map(y=>new Option(String(y),String(y))));$('year').value=[...$('year').options].some(o=>o.value===value)?value:'';}
function render(){const searching=!!$('search').value.trim(),active=searching||!!publisher;
 $('publications').hidden=active;$('publicationFilters').hidden=!searching;$('browse').hidden=!active;$('back').hidden=!active;$('publicationName').hidden=searching;
 if(!active){$('results').replaceChildren();$('summary').textContent='';return;}
 $('publicationName').textContent=publisher?pubs.find(p=>p.id===publisher).name:'All publications';
 let matches=searching?searchAPI.search(index,$('search').value):index;
 matches=matches.map(item=>({...item,awards:item.awards.filter(a=>(!$('year').value||($('year').value==='winners'?a.rank===1:String(a.year)===$('year').value)))})).filter(item=>item.awards.length&&($('cubans').checked||!isCuban(item.record)));
 const view=searchAPI.rankResults(matches,pubs,publisher||'all');let results=view.results;
 for(const b of $('publicationFilters').children){const id=b.dataset.publication,count=view.counts?.[id]||0;b.querySelector('strong').textContent=count;b.setAttribute('aria-pressed',String((publisher||'all')===id));b.setAttribute('aria-label',`${b.querySelector('span').textContent}: ${count} cigars`);}
 if($('year').value==='winners')results.sort((a,b)=>b.bestYear-a.bestYear);
 $('summary').textContent=`${results.length} ranked ${results.length===1?'cigar':'cigars'}${searching?' · '+(publisher?pubs.find(p=>p.id===publisher).name:'All publications'):''}`;$('results').replaceChildren(...results.slice(0,shown).map(card));if(!results.length)$('results').append(el('p','','No cigars match these filters.'));$('more').hidden=results.length<=shown;
}
function choose(id,{restore=false}={}){const u=new URL(location.href);publisher=pubs.some(p=>p.id===id)?id:null;shown=30;
 if(restore){$('search').value=u.searchParams.get('q')||'';$('cubans').checked=u.searchParams.get('cubans')!=='0';}
 updateYears(restore?u.searchParams.get('year')||'':$('year').value);if(!restore)route(true);render();}
async function load(){if(loading)return;loading=true;const seq=++request;$('status').hidden=false;$('status').textContent='Loading rankings…';$('retry').hidden=true;
 try{const r=await fetch('/.netlify/functions/rankings-data',{cache:'no-store',credentials:'same-origin'});if(seq!==request)return;if(r.status===401){showLogin();return;}if(!r.ok)throw Error('Rankings could not be loaded. Please try again.');const data=await r.json();if(seq!==request)return;const built=api.build(data.rows);lists=built.lists;index=searchAPI.build(lists,pubs,data.rows);$('login').hidden=true;$('viewer').hidden=false;$('status').hidden=true;choose(new URL(location.href).searchParams.get('publication'),{restore:true});}
 catch(e){if(seq!==request)return;$('status').textContent=e.message;$('retry').hidden=false;}finally{loading=false;}}
for(const p of pubs){const b=el('button');b.type='button';b.setAttribute('aria-label',p.name);const img=el('img');img.src=window.CigarosPublicationLogos[p.id]||p.logo;img.alt=p.name;b.append(img,el('span','arrow','›'));b.onclick=()=>choose(p.id);$('publications').append(b);}
$('loginForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;$('loginError').textContent='';try{const r=await fetch('/.netlify/functions/rankings-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value})});$('password').value='';if(r.status===429)throw Error('Too many attempts. Wait a minute and try again.');const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Could not sign in. Please try again.');await load();}catch(error){$('loginError').textContent=error.message;}finally{b.disabled=false;}};
$('logout').onclick=async()=>{const b=$('logout');b.disabled=true;try{const r=await fetch('/.netlify/functions/rankings-logout',{method:'POST'});if(!r.ok)throw Error('Sign out failed. Please try again.');request++;showLogin();}catch(e){$('status').hidden=false;$('status').textContent=e.message;}finally{b.disabled=false;}};
$('back').onclick=()=>{$('search').value='';$('year').value='';$('cubans').checked=true;choose(null);};$('retry').onclick=load;for(const id of ['year','search','cubans'])$(id).addEventListener(id==='search'?'input':'change',()=>{shown=30;if(id==='search'&&!$('search').value.trim()){publisher=null;updateYears('');}route();render();});for(const [id,label] of [['all','All cigars'],...pubs.map(p=>[p.id,p.id==='consensus'?'Halfwheel':p.name])]){const b=el('button','publication-filter');b.type='button';b.dataset.publication=id;b.append(el('span','',label),el('strong','','0'));b.onclick=()=>choose(id==='all'?null:id);$('publicationFilters').append(b);}
$('more').onclick=()=>{shown+=30;render();};window.addEventListener('popstate',()=>choose(new URL(location.href).searchParams.get('publication'),{restore:true}));load();
})();
