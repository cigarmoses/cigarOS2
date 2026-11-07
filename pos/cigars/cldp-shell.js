/* CigarOS cinematic CLDP: local POS launcher and catalog search.
   Routes are verified against cigarOS2 HEAD 134f0c7. No new server endpoints. */
(() => {
  'use strict';
  let records = [], resolveRecord, launcher, dialog, previousOverflow = '';
  const paths = {
    search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
    library: '<path d="m3 10 9-7 9 7v11H3Z"/><path d="M12 12c-3-2-5-1-5-1v7s2-1 5 1c3-2 5-1 5-1v-7s-2-1-5 1v7"/>',
    cart: '<path d="M2 3h3l3 13h11l3-10H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>',
    loyalty: '<path d="m12 2 3 2 3 1 1 3 2 3-2 3-1 3-3 1-3 2-3-2-3-1-1-3-2-3 2-3 1-3 3-1Z"/><path d="m7 18-2 5 5-2m7-3 2 5-5-2"/>',
    news: '<rect x="3" y="3" width="18" height="19" rx="2"/><path d="M7 7h4v5H7Zm8 0h3m-3 4h3M7 16h11M7 19h11"/>',
    reports: '<path d="M3 22h19M4 22V14h4v8m3 0V8h4v14m3 0V2h4v20"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  const normalized = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function searchCatalog() {
    const input = dialog.querySelector('input'), list = dialog.querySelector('#cdSearchResults');
    const query = normalized(input.value.trim());
    list.replaceChildren();
    dialog.querySelector('#cdSearchStatus').textContent = '';
    if (!query) { list.textContent = 'Search by cigar, brand, or vitola.'; return; }
    const hits = records.filter(r => normalized(Object.values(r).join(' ')).includes(query));
    let count = 0; const seen = new Set();
    for (const row of hits) {
      const result = resolveRecord(row);
      if (!result?.href || seen.has(result.href)) continue;
      seen.add(result.href);
      const a = document.createElement('a');
      a.href = result.href;
      a.textContent = result.label;
      list.append(a);
      if (++count === 40) break;
    }
    const status = dialog.querySelector('#cdSearchStatus');
    status.textContent = count ? `${count} result${count === 1 ? '' : 's'}${count === 40 ? ' shown. Refine your search for more.' : '.'}` : 'No matching cigars.';
  }
  function showHome() {
    dialog.querySelector('#cdPosHome').hidden = false;
    dialog.querySelector('#cdPosSearch').hidden = true;
    dialog.querySelector('#cdPosTitle').textContent = 'POS';
  }
  function setClosed() {
    launcher.setAttribute('aria-expanded','false');
    launcher.setAttribute('aria-label','Open POS menu');
    document.body.style.overflow = previousOverflow;
    launcher.focus({preventScroll:true});
  }
  function close() { if (dialog?.open) dialog.close(); }
  function create() {
    launcher = document.createElement('button');
    launcher.id = 'cdPosLauncher'; launcher.type = 'button'; launcher.innerHTML = icon('grid');
    launcher.setAttribute('aria-label','Open POS menu'); launcher.setAttribute('aria-haspopup','dialog');
    launcher.setAttribute('aria-expanded','false'); launcher.setAttribute('aria-controls','cdPosMenu');
    dialog = document.createElement('dialog'); dialog.id = 'cdPosMenu'; dialog.setAttribute('aria-labelledby','cdPosTitle');
    const tiles = [['library','Cigar Library','/pos/cigars/'],['cart','Cart','/pos/invoice/'],['loyalty','Loyalty','/loyalty/'],['news','News','/news/'],['reports','Reports','/reports/']];
    dialog.innerHTML = `<header class="cd-pos-heading"><h2 id="cdPosTitle">POS</h2><button type="button" id="cdPosClose" aria-label="Close POS menu">×</button></header><div id="cdPosHome" class="cd-pos-tiles"><button type="button" id="cdPosSearchOpen">${icon('search')}<span>Search</span></button>${tiles.map(([i,label,url])=>`<a href="${url}">${icon(i)}<span>${label}</span></a>`).join('')}</div><section id="cdPosSearch" hidden><button type="button" id="cdSearchBack">‹ POS menu</button><label for="cdCatalogSearch">Search cigar library</label><input id="cdCatalogSearch" type="search" placeholder="Cigar, brand, or vitola" autocomplete="off"><p id="cdSearchStatus" role="status"></p><div id="cdSearchResults">Search by cigar, brand, or vitola.</div></section>`;
    document.body.append(dialog);
    launcher.addEventListener('click', () => {
      if (dialog.open) return close();
      showHome(); previousOverflow = document.body.style.overflow;
      dialog.showModal(); document.body.style.overflow = 'hidden';
      launcher.setAttribute('aria-expanded','true'); launcher.setAttribute('aria-label','Close POS menu');
    });
    dialog.querySelector('#cdPosClose').addEventListener('click',close);
    dialog.addEventListener('close',setClosed);
    dialog.addEventListener('click', e => { if(e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close(); } });
    dialog.querySelector('#cdPosSearchOpen').addEventListener('click', () => {
      dialog.querySelector('#cdPosHome').hidden = true;
      dialog.querySelector('#cdPosSearch').hidden = false;
      dialog.querySelector('#cdPosTitle').textContent = 'Search';
      searchCatalog(); dialog.querySelector('input').focus();
    });
    dialog.querySelector('#cdSearchBack').addEventListener('click', () => {showHome();dialog.querySelector('#cdPosSearchOpen').focus();});
    dialog.querySelector('input').addEventListener('input',searchCatalog);
    window.addEventListener('popstate',close);
    window.addEventListener('pagehide',close);
  }
  window.CigarDetailShell = {attach(dock, catalog, resolver) {
    resolveRecord = resolver;
    records = Array.isArray(catalog) ? catalog : [];
    if (!launcher) create();
    if (launcher.parentElement !== dock) dock.prepend(launcher);
  }};
})();
