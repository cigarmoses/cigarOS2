/* Main POS visual filters. Values stay draft-only until the parent applies them. */
(() => {
  'use strict';
  const STRENGTH = ['Mild','Mild–Medium','Medium','Medium–Full','Full'];
  const SHADES = ['Claro','Colorado Claro','Colorado','Colorado Maduro','Maduro','Oscuro','Candela'];
  function render({key,container,value=null,onChange=()=>{},shadeValues=[],selected=new Set(),search='',onShadeChange=()=>{},asset='/pos/cigars/filter-assets/'}) {
    if(!['length','ring','strength','shade'].includes(key))return false;
    container.replaceChildren();
    const root=document.createElement('div');root.className='main-visual-filter main-visual-controls brand-filter-visual';root.dataset.visualKey=key;container.append(root);
    let current=Array.isArray(value)?[...value]:null;
    if(key==='shade'){
      const grid=document.createElement('div');grid.className='shade-grid';root.append(grid);
      const values=[...SHADES,...[...new Set([...shadeValues,...selected])].filter(v=>v&&!SHADES.includes(v))];
      const query=String(search).trim().toLowerCase();let visibleCount=0;
      values.forEach((label,index)=>{
        const item=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
        item.className='brand-filter-option';item.hidden=!!query&&!label.toLowerCase().includes(query);if(!item.hidden)visibleCount++;input.type='checkbox';input.value=label;input.checked=selected.has(label);text.textContent=label;item.append(input);
        input.addEventListener('change',()=>{onShadeChange(label,input.checked);});
        if(index<SHADES.length){
          item.classList.add('shade-option');item.dataset.shade=label.toLowerCase().replaceAll(' ','-');
          const img=document.createElement('img');img.src=asset+'shade-'+item.dataset.shade+'.svg?v=20261117-leaves2';img.alt='';item.append(img,text);grid.append(item);
        }else{item.classList.add('main-shade-extra');item.append(text);root.append(item);}
      });
      if(!visibleCount){const empty=document.createElement('p');empty.className='fm__empty';empty.textContent='No options found.';root.append(empty);}
      return true;
    }
    const field=document.createElement('div');field.className='visual-range'+(key==='strength'?' strength-range':'');root.append(field);
    if(key==='strength'){
      field.innerHTML='<p class="strength-selection" aria-live="polite"></p><div class="range-ruler strength-slider"><div class="range-track"></div>'+[0,1].map(i=>`<input type="range" min="0" max="4" step="1" data-strength-bound="${i}" aria-label="${i?'Maximum':'Minimum'} strength">`).join('')+'</div><div class="strength-scale" aria-hidden="true">'+STRENGTH.map(label=>`<span>${label.replace('–','–<br>')}</span>`).join('')+'</div>';
      const refresh=()=>{
        const range=current||[0,4];field.style.setProperty('--range-min',`${range[0]/4*100}%`);field.style.setProperty('--range-max',`${range[1]/4*100}%`);
        field.querySelectorAll('[data-strength-bound]').forEach(input=>{const v=range[Number(input.dataset.strengthBound)];input.value=v;input.setAttribute('aria-valuetext',STRENGTH[v]);});
        field.querySelector('.strength-selection').textContent=current?(range[0]===range[1]?STRENGTH[range[0]]:STRENGTH[range[0]]+' to '+STRENGTH[range[1]]):'Any strength';
      };
      field.querySelectorAll('[data-strength-bound]').forEach(input=>input.addEventListener('input',()=>{
        const i=Number(input.dataset.strengthBound),range=[...(current||[0,4])];range[i]=Math.max(0,Math.min(4,Number(input.value)));if(range[0]>range[1])range[1-i]=range[i];current=range;refresh();onChange([...current]);
      }));refresh();return true;
    }
    const isRing=key==='ring',label=isRing?'ring gauge':'length',low=isRing?20:0,high=isRing?80:8,step=isRing?1:.125,defaults=isRing?[32,50]:[5,7];
    field.innerHTML=`<div class="range-number-row">${['Minimum','Maximum'].map((name,i)=>`<label>${name}<input type="number" inputmode="decimal" min="${low}" max="${high}" step="${step}" data-bound="${i}" aria-label="${name} ${label}"></label>`).join('')}</div>`;
    if(isRing){
      field.insertAdjacentHTML('beforeend',`<div class="ring-comparison" aria-hidden="true">${['dime','quarter'].map((coin,i)=>`<div class="ring-reference"><div class="ring-stage"><img class="coin-art ${coin}" src="${asset}${coin}.svg" alt=""><img class="ring-art ring-art-${i}" src="${asset}cigar-end.svg" alt=""></div><div class="coin-caption">${i?'Quarter = 60':'Dime = 45'}</div></div>`).join('')}</div><p class="range-help">Enter a minimum and maximum ring gauge.</p>`);
    }else{
      field.insertAdjacentHTML('beforeend',`<div class="length-comparison" aria-hidden="true"><img class="length-cigar" src="${asset}length-cigar.png" alt=""></div><div class="length-ruler-art"><img src="${asset}ruler-8-inch.svg" alt="Ruler from 0 to 8 inches"></div><div class="range-ruler length-slider"><div class="range-track"></div>${[0,1].map(i=>`<input type="range" min="${low}" max="${high}" step="${step}" data-bound="${i}" aria-label="${i?'Maximum':'Minimum'} length slider">`).join('')}</div><p class="range-help">Drag either handle or enter a length in inches.</p>`);
    }
    const refresh=(editing=null)=>{
      const values=current||defaults;field.querySelectorAll('input[data-bound]').forEach(input=>{if(input!==editing)input.value=values[Number(input.dataset.bound)];});
      field.style.setProperty('--range-min',`${(values[0]-low)/(high-low)*100}%`);field.style.setProperty('--range-max',`${(values[1]-low)/(high-low)*100}%`);field.classList.toggle('range-active',!!current);
      if(isRing)values.forEach((v,i)=>field.querySelector(`.ring-art-${i}`).style.width=`${v/80*100}%`);
      else{field.style.setProperty('--cigar-width',`${values[1]/8*100}%`);field.style.setProperty('--cigar-solid',`${!values[1]?100:values[0]/values[1]*100}%`);field.style.setProperty('--cigar-max','100%');}
    };
    function edit(input,final=false){
      if(input.value===''||!Number.isFinite(input.valueAsNumber)){if(final)refresh();return;}
      const bound=Number(input.dataset.bound),values=[...(current||defaults)],raw=input.valueAsNumber;
      if(!final&&input.type==='number'&&(raw<low||raw>high||(!bound&&raw>values[1])||(bound&&raw<values[0])))return;
      let next=Math.max(low,Math.min(high,Math.round(raw/step)*step));next=bound?Math.max(values[0],next):Math.min(values[1],next);values[bound]=next;current=values;refresh(!final&&input.type==='number'?input:null);onChange([...current]);
    }
    field.querySelectorAll('input[data-bound]').forEach(input=>input.addEventListener('input',()=>edit(input)));
    field.querySelectorAll('input[type="number"]').forEach(input=>input.addEventListener('change',()=>edit(input,true)));
    refresh();return true;
  }
  window.CigarVisualFilters={render};
})();
