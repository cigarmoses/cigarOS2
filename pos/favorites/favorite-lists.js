/* Favorites Lists: independent of all existing favorites storage. */
(() => {
  'use strict';
  const KEY='cigaros_favorite_lists_v1';
  function read(){
    const raw=localStorage.getItem(KEY);
    const lists=raw===null ? {} : JSON.parse(raw);
    if(!lists || typeof lists!=='object' || Array.isArray(lists) || Object.values(lists).some(v=>!Array.isArray(v)||v.some(id=>typeof id!=='string'))) throw Error('Saved Lists could not be read. They have not been overwritten.');
    if(!Object.keys(lists).length){lists.Dad=[];localStorage.setItem(KEY,JSON.stringify(lists));}
    return lists;
  }
  function write(lists){localStorage.setItem(KEY,JSON.stringify(lists));window.dispatchEvent(new Event('favorite-lists-changed'));}
  function nameForm(existing=null){
    return new Promise(resolve=>{
      const formDialog=document.createElement('dialog');formDialog.className='favorite-lists-dialog';
      const form=document.createElement('form');
      const heading=document.createElement('h2');heading.textContent=existing===null?'Create New List':'Edit List';
      const label=document.createElement('label');label.textContent='List name';
      const input=document.createElement('input');input.type='text';input.required=true;input.maxLength=80;input.value=existing||'';
      input.style.cssText='width:100%;height:48px;padding:10px;font:inherit;background:var(--bg2,#fff);color:inherit;border:1px solid #888;border-radius:10px';label.style.display='block';label.append(input);
      const error=document.createElement('p');error.setAttribute('role','alert');
      const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>formDialog.close();
      const save=document.createElement('button');save.type='submit';save.className='lists-done';save.textContent='Save';
      let result=null;const focus=document.activeElement;
      form.append(heading,label,error,cancel,save);formDialog.append(form);document.body.append(formDialog);
      form.onsubmit=e=>{
        e.preventDefault();
        try{
          const name=input.value.trim();if(!name)throw Error('Enter a list name.');
          const lists=read();
          if(Object.keys(lists).some(n=>n!==existing&&n.toLowerCase()===name.toLowerCase()))throw Error('A list with that name already exists.');
          if(existing!==null&&!Object.hasOwn(lists,existing))throw Error('This list no longer exists.');
          const members=existing===null?[]:lists[existing];
          if(existing!==null)delete lists[existing];
          Object.defineProperty(lists,name,{value:members,enumerable:true,writable:true,configurable:true});
          write(lists);result=name;formDialog.close();
        }catch(e){error.textContent=e.message;}
      };
      formDialog.addEventListener('close',()=>{formDialog.remove();focus?.focus?.();resolve(result);},{once:true});
      formDialog.showModal();input.focus();
    });
  }
  function create(){return nameForm();}
  function rename(name){return nameForm(name);}
  const style=document.createElement('style');
  style.textContent=`.favorite-lists-dialog{width:min(430px,calc(100% - 28px));max-height:80dvh;padding:24px;border:1px solid var(--stroke,#ddd);border-radius:24px;background:var(--bg2,#fff);color:var(--text,#111);font-family:var(--font-sans,system-ui);box-shadow:0 24px 70px #0005}.favorite-lists-dialog::backdrop{background:#0006;backdrop-filter:blur(8px)}.favorite-lists-dialog h2{margin:0 0 10px}.favorite-lists-dialog p{font-size:14px}.favorite-lists-dialog label{display:flex;gap:12px;align-items:center;padding:12px 0;overflow-wrap:anywhere}.favorite-lists-dialog input{width:20px;height:20px}.favorite-lists-dialog button{padding:12px 16px;border:0;border-radius:14px;cursor:pointer;font:inherit;margin-top:12px}.favorite-lists-dialog .lists-done{background:#34c759;color:#fff;float:right}.favorite-list-edit{position:absolute;right:0;top:0;z-index:2;border:0;border-radius:99px;background:var(--glass2);color:var(--text);padding:8px 10px;cursor:pointer}.favorites-lists-select{max-width:230px;border:1px solid var(--stroke);border-radius:18px;background:var(--bg2);color:var(--text);padding:10px;font:inherit}.favorites-actions{align-items:center;justify-content:space-between;gap:8px}.favorites-lists-control{display:flex;align-items:center;gap:8px;font-size:14px}`;
  document.head.append(style);
  let dialog,activeId,returnFocus;
  const queue=[];
  function open(id,label='Saved to Favorites'){
    id=String(id||'').trim();if(!id)return;
    if(dialog?.open){if(id!==activeId&&!queue.some(x=>x[0]===id))queue.push([id,label]);return;}
    try{
      const lists=read();activeId=id;returnFocus=document.activeElement;
      if(!dialog){
        dialog=document.createElement('dialog');dialog.className='favorite-lists-dialog';dialog.setAttribute('aria-labelledby','favoriteListsTitle');document.body.append(dialog);
        dialog.addEventListener('close',()=>{returnFocus?.focus?.();const next=queue.shift();if(next)setTimeout(()=>open(...next),0);});
        dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
      }
      dialog.replaceChildren();
      const title=document.createElement('h2');title.id='favoriteListsTitle';title.textContent='Add to List';dialog.append(title);
      const caption=document.createElement('p');caption.textContent=label+'. Choosing a list is optional.';dialog.append(caption);
      const choices=document.createElement('div');dialog.append(choices);
      function render(){choices.replaceChildren();Object.entries(read()).forEach(([name,ids])=>{
        const row=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=ids.includes(activeId);
        box.addEventListener('change',()=>{try{const latest=read();if(!Object.hasOwn(latest,name))throw Error('This list no longer exists.');latest[name]=box.checked?[...new Set([...latest[name],activeId])]:latest[name].filter(x=>x!==activeId);write(latest);}catch(e){box.checked=!box.checked;alert(e.message);}});
        row.append(box,document.createTextNode(name));choices.append(row);
      });}
      render();
      const add=document.createElement('button');add.type='button';add.textContent='+ Create New List';add.onclick=async()=>{try{const name=await create();if(name)render();}catch(e){alert(e.message);}};
      const done=document.createElement('button');done.type='button';done.className='lists-done';done.textContent='Done';done.onclick=()=>dialog.close();dialog.append(add,done);dialog.showModal();
    }catch(e){alert(e.message);}
  }
  window.CigarosFavoriteLists={read,create,rename,open};
  // On save pages, notice newly added entries without intercepting or rewriting saves.
  const keys=['cigaros_pos_favorites_cigars','cigaros_user_favorite_cigars_v1'];
  function snapshot(){const ids=new Set();for(const key of keys){try{const raw=JSON.parse(localStorage.getItem(key)||'[]');for(const item of (Array.isArray(raw)?raw:raw.items||[])){const id=typeof item==='object'?item.key||item.id:item;if(id)ids.add(String(id));}}catch{}}return ids;}
  let previous=snapshot();
  if(!location.pathname.startsWith('/pos/favorites')){
    const check=()=>{const now=snapshot();for(const id of now)if(!previous.has(id))open(id);previous=now;};
    document.addEventListener('click',()=>setTimeout(check,0));
    setInterval(()=>{if(!document.hidden)check();},500);
  }
})();
