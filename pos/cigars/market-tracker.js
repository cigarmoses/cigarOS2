/* CigarOS manual market tracker, Option B UI, November 6 2026. No retailer requests, scraping or HUB writes. */
(function (root) {
  'use strict';
  const SCHEMA = 1;
  const PREFIX = 'cigaros_market_manual_v1:';
  const ASSETS = '/pos/cigars/market-assets/';
  const RETAILERS = Object.freeze([
    {id:'neptune', name:'Neptune', initials:'N', domains:['neptunecigar.com'], logo:'neptune.svg'},
    {id:'famous', name:'Famous', initials:'F', domains:['famous-smoke.com'], logo:'famous.svg'},
    {id:'thompson', name:'Thompson', initials:'T', domains:['thompsoncigar.com'], logo:'thompson.svg'},
    {id:'holts', name:'Holts', initials:'H', domains:['holts.com'], logo:'holts.svg'},
    {id:'ci', name:'Cigars International', initials:'CI', domains:['cigarsinternational.com'], logo:'ci-smiley.svg'},
    {id:'cigargod', name:'Cigar God', initials:'CG', domains:['cigargod.com'], logo:'cigargod.svg'}
  ]);
  const FIELDS = ['brand','line','name','vitola','length','ring','wrapper','shade','shape','origin'];
  const clean = value => String(value ?? '').normalize('NFC').trim();
  const clone = value => JSON.parse(JSON.stringify(value));
  function identity(record) {
    const key = clean(record?.key);
    // Do not use the URL, display title alone, media rank, or row position as identity.
    const variant = FIELDS.map(field => clean(record?.[field]));
    if (!key && !(variant[0] && variant[2] && variant[3] && variant[4] && variant[5] && variant[6])) return null;
    return JSON.stringify(['v1', key, ...variant]);
  }
  function storageKey(id) { return PREFIX + encodeURIComponent(id); }
  function price(value, label = 'Price') {
    if (value === '' || value === null || value === undefined) return null;
    const str = String(value).trim();
    if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(str)) throw new Error(label + ' must be a positive USD amount with at most two decimal places.');
    const cents = Math.round(Number(str) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000) throw new Error(label + ' must be greater than 0 and no more than 1,000,000.00.');
    return cents / 100;
  }
  function optionalPrice(value) { try { return price(clean(value).replace(/^\$/, '').replace(/,/g, '')); } catch { return null; } }
  function safeURL(value, retailerId) {
    const raw = clean(value);
    if (!raw) return '';
    if (raw.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(raw)) throw new Error('Use a full HTTPS product link without spaces.');
    const retailer = RETAILERS.find(item => item.id === retailerId);
    let url;
    try { url = new URL(raw); } catch { throw new Error('Use a full HTTPS product link.'); }
    if (!retailer || url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
        !retailer.domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) {
      throw new Error('Use an HTTPS link on ' + (retailer?.domains[0] || 'the selected retailer website') + '.');
    }
    return url.href;
  }
  function emptyOffer(id) { return {id, url:'', stock:'unknown', basis:'single', singlePrice:null, boxPrice:null, boxCount:null, checkedAt:null}; }
  function normalizeOffer(input, retailerId) {
    const result = emptyOffer(retailerId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid retailer entry.');
    if (!['unknown','in_stock','out_of_stock'].includes(input.stock)) throw new Error('Choose a stock status.');
    if (!['single','box'].includes(input.basis)) throw new Error('Choose actual single or box-derived.');
    result.url = safeURL(input.url, retailerId);
    result.stock = input.stock; result.basis = input.basis;
    if (result.basis === 'single') result.singlePrice = price(input.singlePrice, 'Single price');
    else {
      result.boxPrice = price(input.boxPrice, 'Box price');
      if (input.boxCount !== '' && input.boxCount != null) {
        if (!/^\d+$/.test(String(input.boxCount)) || !Number.isSafeInteger(Number(input.boxCount)) || Number(input.boxCount) < 1 || Number(input.boxCount) > 1000) throw new Error('Box count must be a whole number from 1 to 1,000.');
        result.boxCount = Number(input.boxCount);
      }
      if ((result.boxPrice == null) !== (result.boxCount == null)) throw new Error('Enter both the box price and the cigar count.');
    }
    const amount = unitPrice(result);
    if (result.stock === 'in_stock' && amount == null) throw new Error('An available offer needs a price.');
    if (result.stock === 'in_stock' && !result.url) throw new Error('An available offer needs its exact product link.');
    if (input.checkedAt != null && input.checkedAt !== '') {
      if (typeof input.checkedAt !== 'string' || !Number.isFinite(Date.parse(input.checkedAt))) throw new Error('Invalid price check date.');
      result.checkedAt = new Date(input.checkedAt).toISOString();
    }
    return result;
  }
  function unitPrice(offer) {
    if (offer.basis === 'single') return offer.singlePrice;
    return offer.boxPrice != null && offer.boxCount > 0 ? offer.boxPrice / offer.boxCount : null;
  }
  function summary(offers, basis = 'single') {
    const eligible = offers.filter(offer => offer.stock === 'in_stock' && offer.basis === basis && unitPrice(offer) > 0);
    // Sum integer cents for singles; divide box cents before averaging, never rounded unit prices.
    const totalCents = eligible.reduce((sum, offer) => sum + (offer.basis === 'single' ? Math.round(offer.singlePrice * 100) : Math.round(offer.boxPrice * 100) / offer.boxCount), 0);
    return {count:eligible.length, average:eligible.length ? totalCents / eligible.length / 100 : null};
  }
  function emptyDocument(id) {
    return {schema:SCHEMA, identity:id, comparisonBasis:'single', yourPrice:null, savedAt:null, offers:RETAILERS.map(retailer => emptyOffer(retailer.id))};
  }
  function validateDocument(input, id) {
    if (!input || input.schema !== SCHEMA || input.identity !== id || !Array.isArray(input.offers) || input.offers.length !== RETAILERS.length) throw new Error('Saved prices have an unsupported format or a different cigar identity.');
    if (!['single','box'].includes(input.comparisonBasis)) throw new Error('Saved comparison basis is invalid.');
    if (new Set(input.offers.map(offer => offer?.id)).size !== RETAILERS.length) throw new Error('Saved retailer entries are duplicated.');
    const result = emptyDocument(id);
    result.comparisonBasis = input.comparisonBasis;
    result.yourPrice = price(input.yourPrice, 'Your price');
    result.offers = RETAILERS.map(retailer => {
      const value = input.offers.find(offer => offer?.id === retailer.id);
      if (!value) throw new Error('A saved retailer entry is missing.');
      return normalizeOffer(value, retailer.id);
    });
    if (input.savedAt != null) {
      if (typeof input.savedAt !== 'string' || !Number.isFinite(Date.parse(input.savedAt))) throw new Error('Saved date is invalid.');
      result.savedAt = new Date(input.savedAt).toISOString();
    }
    return result;
  }
  function read(storage, id) {
    const raw = storage.getItem(storageKey(id));
    if (raw === null) return {raw:null, data:emptyDocument(id)};
    if (raw.length > 100000) throw new Error('Saved prices are too large to read safely.');
    return {raw, data:validateDocument(JSON.parse(raw), id)};
  }
  function save(storage, data, expectedRaw) {
    const checked = validateDocument(data, data.identity);
    const key = storageKey(data.identity);
    if (storage.getItem(key) !== expectedRaw) throw new Error('Saved prices changed in another tab. Close and reopen the tracker before saving.');
    checked.savedAt = new Date().toISOString();
    const raw = JSON.stringify(checked);
    storage.setItem(key, raw);
    return {data:checked, raw};
  }
  const api = {identity, storageKey, price, safeURL, emptyOffer, normalizeOffer, unitPrice, summary, emptyDocument, validateDocument, read, save, RETAILERS};
  root.CigarMarketTracker = api;
  if (!root.document) return;

  const document = root.document;
  let context = null, panel = null, editor = null, discard = null, draft = null, saved = null;
  let expectedRaw = null, dirty = false, editorDirty = false, storageFailure = '', posPrice = null, posNotice = '', view = 0;
  const format = value => value == null ? '—' : value.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const currency = value => '$' + format(value);
  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function button(text, className, handler) {
    const el = node('button', className, text); el.type = 'button';
    if (handler) el.addEventListener('click', handler);
    return el;
  }
  function icon(name) {
    const paths = {
      close:'M6 6l12 12M18 6L6 18',
      pencil:'M15 5l4 4M4 20l4-1 12-12-4-4L4 15z',
      arrow:'M7 17L17 7M7 7h10v10',
      download:'M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5'
    };
    const el=document.createElementNS('http://www.w3.org/2000/svg','svg');
    el.setAttribute('viewBox','0 0 24 24');el.setAttribute('aria-hidden','true');el.setAttribute('focusable','false');
    const path=document.createElementNS(el.namespaceURI,'path');path.setAttribute('d',paths[name]);
    path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');
    path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');el.append(path);return el;
  }
  function iconButton(name, label, className, handler) {
    const el=button('',className,handler);el.append(icon(name));el.setAttribute('aria-label',label);el.title=label;return el;
  }
  function modal(id, labelledBy) {
    const el = node('dialog', 'cmt-dialog'); el.id = id;
    el.setAttribute('aria-labelledby', labelledBy); el.setAttribute('aria-modal', 'true');
    document.body.appendChild(el); return el;
  }
  function message(text, error = false) {
    const el = panel?.querySelector('#cmt-status'); if (!el) return;
    el.textContent = text; el.classList.toggle('cmt-error', error);
  }
  function markDirty() { dirty = JSON.stringify(draft) !== JSON.stringify(saved); }
  function preventUnload(event) { if ((dirty || editorDirty) && panel?.open) { event.preventDefault(); event.returnValue = ''; } }
  root.addEventListener('beforeunload', preventUnload);
  function removeDialog(el) { if (!el) return; if (el.open) el.close(); el.remove(); }
  function close(force = false) {
    if (dirty && !force) { confirmDiscard(); return; }
    const hadPanel = !!panel?.open;
    ++view; removeDialog(discard); removeDialog(editor); removeDialog(panel);
    discard = editor = panel = null; draft = saved = null; dirty = false; editorDirty = false;
    document.documentElement.classList.remove('cmt-modal-open');
    if (hadPanel) document.getElementById('cdMarketTracker')?.focus();
  }
  function confirmDiscard() {
    if (discard) return;
    discard = modal('cmt-discard', 'cmt-discard-title');
    discard.append(node('h2', '', 'Discard unsaved changes?'));
    discard.querySelector('h2').id = 'cmt-discard-title';
    discard.append(node('p', 'cmt-help', 'Your saved prices will stay unchanged. Choose Keep editing to save your changes.'));
    const actions = node('div', 'cmt-footer');
    actions.append(button('Keep editing', 'cmt-secondary', () => {removeDialog(discard); discard = null;}), button('Discard changes', 'cmt-danger', () => close(true)));
    discard.append(actions); discard.addEventListener('cancel', event => {event.preventDefault(); removeDialog(discard); discard = null;}); discard.showModal();
  }
  function snapshotLabel() {
    if (dirty) return 'Unsaved changes';
    return draft.savedAt ? 'Saved on this device' : 'This device only';
  }
  function ownPrice() { return draft.yourPrice ?? posPrice; }
  function renderPanel() {
    if (!panel || !draft) return;
    const result=summary(draft.offers,draft.comparisonBasis);
    [['cmt-online-average',result.average],['cmt-your-price',ownPrice()]].forEach(([id,value])=>{
      const el=panel.querySelector('#'+id);el.textContent=format(value);el.dataset.hasPrice=String(value!=null);
      el.setAttribute('aria-label',value==null?'No price':currency(value)+' USD');
      el.classList.toggle('cmt-large-value',value!=null&&value>=1000);
    });
    panel.querySelector('#cmt-own-source').textContent=draft.yourPrice!=null?'Your single price':posPrice!=null?'POS MSRP · single':'Add your price';
    panel.querySelector('#cmt-basis').value=draft.comparisonBasis;
    panel.querySelectorAll('[data-basis]').forEach(el=>{const selected=el.dataset.basis===draft.comparisonBasis;el.setAttribute('aria-checked',String(selected));el.tabIndex=selected?0:-1;});
    panel.querySelector('#cmt-average-note').textContent=result.count?`${result.count} available ${result.count===1?'offer':'offers'}`:'No available offers';
    panel.querySelector('#cmt-saved').textContent=snapshotLabel();
    panel.querySelector('#cmt-last-saved').textContent=draft.savedAt?'Last saved '+new Date(draft.savedAt).toLocaleString():'No saved prices yet.';
    const list=panel.querySelector('#cmt-retailers');list.replaceChildren();
    RETAILERS.forEach(retailer=>{
      const offer=draft.offers.find(item=>item.id===retailer.id),amount=unitPrice(offer);
      const row=node('div','cmt-retailer');row.dataset.retailer=retailer.id;
      row.addEventListener('contextmenu',event=>{event.preventDefault();openRetailerEditor(retailer.id);});
      const link=node(offer.url?'a':'div','cmt-retailer-main');
      if(offer.url){link.href=safeURL(offer.url,retailer.id);link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';link.setAttribute('aria-label','Open '+retailer.name+' product listing in a new tab');}
      const badge=node('span','cmt-badge cmt-badge-'+retailer.id);badge.setAttribute('aria-hidden','true');
      const fallback=node('span','cmt-logo-fallback',retailer.initials);badge.append(fallback);
      if(retailer.logo){
        const img=node('img');img.src=ASSETS+retailer.logo;img.alt='';img.width=72;img.height=72;
        img.addEventListener('load',()=>{fallback.hidden=true;badge.classList.add('cmt-logo-loaded');},{once:true});
        img.addEventListener('error',()=>{img.remove();fallback.hidden=false;badge.classList.remove('cmt-logo-loaded');},{once:true});badge.append(img);
      }
      const title=node('span','cmt-retailer-name',retailer.name);
      if(offer.url){const arrow=icon('arrow');arrow.classList.add('cmt-link-arrow');title.append(arrow);}
      link.append(badge,title);row.append(link);
      const stockText={unknown:amount==null?'Add price':'Not checked',in_stock:'In stock',out_of_stock:'Out of stock'}[offer.stock];
      const stock=node('span','cmt-stock cmt-stock-'+offer.stock,stockText);
      const money=node('strong','cmt-retailer-price',offer.stock==='out_of_stock'?'—':amount==null?'—':currency(amount));
      const bottom=node('div','cmt-tile-bottom');bottom.append(stock,money);row.append(bottom);
      if(offer.basis==='box'&&amount!=null)row.append(node('span','cmt-basis-label','Box ÷ '+offer.boxCount+' · per cigar'));
      if(amount!=null&&offer.basis!==draft.comparisonBasis)row.append(node('span','cmt-basis-label','Other basis · excluded'));
      const details=[];
      if(offer.checkedAt)details.push('Entered '+new Date(offer.checkedAt).toLocaleDateString());
      if(offer.stock==='out_of_stock'&&amount!=null)details.push('Last price '+currency(amount));
      if(offer.basis==='box'&&offer.boxPrice!=null)details.push(currency(offer.boxPrice)+' for '+offer.boxCount+' cigars');
      if(details.length)row.title=details.join(' · ');
      const edit=iconButton('pencil','Edit '+retailer.name+' price and link','cmt-edit-row',()=>openRetailerEditor(retailer.id));
      row.append(edit);list.append(row);
    });
    panel.querySelector('#cmt-run').disabled=!!storageFailure||!context.id;
    panel.querySelector('#cmt-export').disabled=!saved?.savedAt;
  }
  async function open() {
    if (panel?.open) { panel.focus(); return; }
    const openingContext = context, token = ++view;
    posPrice = optionalPrice(context.record.msrp); posNotice = '';
    storageFailure = ''; expectedRaw = null;
    try { if (!context.id) throw new Error('This cigar needs a unique catalog key or complete variant details before prices can be saved.'); const loaded = read(root.localStorage, context.id); saved = loaded.data; expectedRaw = loaded.raw; }
    catch (error) { saved = emptyDocument(context.id); storageFailure = 'Saved prices could not be loaded. Nothing was overwritten. ' + error.message; }
    draft = clone(saved); dirty = false;
    panel = modal('cmt-panel', 'cmt-title');
    const shell=node('div','cmt-shell');panel.append(shell);
    const header=node('div','cmt-header');const title=node('h2','','Market prices');title.id='cmt-title';
    header.append(title,iconButton('close','Close market prices','cmt-close',()=>close()));shell.append(header);
    const content=node('div','cmt-content');shell.append(content);
    const cigar=node('div','cmt-cigar');
    cigar.append(node('p','cmt-brand',[context.record.brand,context.record.line].map(clean).filter(Boolean).join(' · ')));
    cigar.append(node('p','cmt-cigar-name',clean(context.record.name)||clean(context.record.vitola)||'Cigar'));
    const variant=[context.record.vitola,context.record.length&&context.record.ring?`${context.record.length} × ${context.record.ring}`:'',context.record.wrapper,context.record.shade].map(clean).filter(Boolean);
    cigar.append(node('p','cmt-variant',[...new Set(variant)].join(' · ')));content.append(cigar);
    const stats=node('div','cmt-stats');
    [['Online average','cmt-online-average','cmt-average-note'],['Your price','cmt-your-price','cmt-own-source']].forEach(([label,id,note])=>{
      const item=node('div','cmt-stat');item.append(node('div','cmt-stat-label',label));
      const amount=node('div','cmt-stat-amount','—');amount.id=id;item.append(amount);
      const caption=node('div','cmt-stat-caption');caption.id=note;item.append(caption);
      if(id==='cmt-your-price')item.append(iconButton('pencil','Edit your price','cmt-own-edit',openYourPriceEditor));stats.append(item);
    });content.append(stats);
    const controls=node('div','cmt-controls');controls.setAttribute('role','radiogroup');controls.setAttribute('aria-label','Average price basis');
    const select=node('select');select.id='cmt-basis';select.hidden=true;select.setAttribute('aria-label','Average basis');
    [['single','Single'],['box','Box / cigar']].forEach(([value,text])=>{
      const option=node('option','',text);option.value=value;select.append(option);
      const choice=button(text,'cmt-segment',()=>{select.value=value;select.dispatchEvent(new Event('change'));});choice.dataset.basis=value;choice.setAttribute('role','radio');
      choice.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
        event.preventDefault();const next=event.key==='Home'?'single':event.key==='End'?'box':choice.dataset.basis==='single'?'box':'single';
        controls.querySelector('[data-basis="'+next+'"]').click();controls.querySelector('[data-basis="'+next+'"]').focus();
      });controls.append(choice);
    });
    select.addEventListener('change',()=>{draft.comparisonBasis=select.value;markDirty();renderPanel();message('');});
    content.append(select,controls);
    const listHeader=node('div','cmt-list-header');listHeader.append(node('span','','Retailers'),node('span','','USD / cigar'));content.append(listHeader);
    const list=node('div','cmt-retailers');list.id='cmt-retailers';content.append(list);
    const info=node('details','cmt-info');info.append(node('summary','','About & backup'));
    info.append(node('p','cmt-help','Manual prices only. Save prices recomputes the average and saves your entries; it never checks retailer websites.'));
    info.append(node('p','cmt-help','Only in-stock offers with the selected basis count. Single and box-derived prices are never mixed. Box prices require buying the full box. Tax, shipping, coupons and membership deals are excluded.'));
    info.append(node('p','cmt-help','Saved in this browser on this device. No sync or HUB backup. Clearing browser data removes prices. Your comparison price never changes POS pricing.'));
    info.append(node('p','cmt-help','Tap a linked logo or retailer name to open its listing. Use the pencil to edit. Apply stages a change; Save prices stores it.'));
    const timestamp=node('p','cmt-help');timestamp.id='cmt-last-saved';info.append(timestamp);
    const exportButton=button('Export saved prices','cmt-export',exportSaved);exportButton.id='cmt-export';exportButton.prepend(icon('download'));info.append(exportButton);content.append(info);
    const savebar=node('div','cmt-savebar');const status=node('p','cmt-status');status.id='cmt-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');savebar.append(status);
    const run=button('Save prices','cmt-primary',runComparison);run.id='cmt-run';run.title='Recompute and save manual prices in this browser';savebar.append(run);
    const meta=node('p','cmt-save-meta');meta.append(node('span','','Manual prices · '));const savedLabel=node('span','cmt-saved');savedLabel.id='cmt-saved';meta.append(savedLabel);savebar.append(meta);shell.append(savebar);
    panel.addEventListener('cancel',event=>{event.preventDefault();close();});
    renderPanel();document.documentElement.classList.add('cmt-modal-open');panel.showModal();
    message(storageFailure,!!storageFailure);
    if (typeof openingContext.loadPos === 'function') {
      try {
        const pos = await openingContext.loadPos();
        if (view !== token || context !== openingContext || !panel?.open) return;
        if (pos && Object.prototype.hasOwnProperty.call(pos,'msrp')) posPrice = optionalPrice(pos.msrp);
        renderPanel();
      } catch {
        if (view !== token || context !== openingContext || !panel?.open) return;
        posNotice = 'Local POS MSRP could not be read; the catalog fallback is shown when available.';
        message(storageFailure || posNotice, !!storageFailure);
      }
    }
  }
  function runComparison() {
    if (!draft || storageFailure) return;
    try {
      const result = save(root.localStorage, draft, expectedRaw);
      draft = clone(result.data);saved = clone(result.data);expectedRaw = result.raw;dirty = false;
      renderPanel();message('Prices saved.');
    } catch (error) { message('Not saved. Your edits are still open. ' + error.message, true); }
  }
  function exportSaved() {
    if (!saved?.savedAt) return;
    const text = JSON.stringify({format:'CigarOS manual market backup', exportedAt:new Date().toISOString(), record:context.record, comparison:saved}, null, 2);
    const url = URL.createObjectURL(new Blob([text], {type:'application/json'}));
    const a = node('a');a.href=url;a.download='cigaros-market-prices-' + new Date().toISOString().slice(0,10) + '.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message('Exported the last saved snapshot' + (dirty ? '; unsaved edits are not included.' : '.'));
  }
  function field(form, labelText, id, type='text') {
    const label=node('label','cmt-field',labelText), input=node('input');input.id=id;input.name=id;input.type=type;label.htmlFor=id;label.append(input);form.append(label);return input;
  }
  function editorShell(titleText, opener) {
    if (editor) {editor.focus();return null;}
    editor=modal('cmt-editor','cmt-editor-title');
    const title=node('h2','',titleText);title.id='cmt-editor-title';editor.append(title);
    const form=node('form','cmt-form');editor.append(form);editorDirty=false;
    form.addEventListener('input',()=>{editorDirty=true;});form.addEventListener('change',()=>{editorDirty=true;});
    const error=node('p','cmt-error');error.id='cmt-edit-error';error.setAttribute('role','alert');
    const actions=node('div','cmt-footer');
    const cancel=()=>{removeDialog(editor);editor=null;editorDirty=false;if(opener?.isConnected)opener.focus();};
    actions.append(button('Cancel','cmt-secondary',cancel));const apply=node('button','cmt-primary','Apply');apply.type='submit';actions.append(apply);
    editor.addEventListener('cancel',event=>{event.preventDefault();cancel();});
    return {form,error,actions,finish:()=>{removeDialog(editor);editor=null;editorDirty=false;markDirty();renderPanel();panel.querySelector('#cmt-run')?.focus();message(dirty?'Changes ready to save.':'No changes to save.');},show:()=>{form.append(error,actions);editor.showModal();}};
  }
  function openYourPriceEditor() {
    const shell=editorShell('Your single price',document.activeElement);if(!shell)return;
    shell.form.append(node('p','cmt-help','For this comparison only. POS prices stay unchanged. Leave blank to use POS MSRP.'));
    const input=field(shell.form,'Your price · USD','cmt-own-input');input.inputMode='decimal';input.maxLength=12;input.placeholder=posPrice==null?'e.g. 19.99':format(posPrice);input.value=draft.yourPrice??'';
    shell.form.addEventListener('submit',event=>{event.preventDefault();try{draft.yourPrice=price(input.value,'Your price');shell.finish();}catch(error){shell.error.textContent=error.message;input.focus();}});shell.show();
  }
  function openRetailerEditor(id) {
    const retailer=RETAILERS.find(item=>item.id===id);if(!retailer)return;
    const shell=editorShell('Edit ' + retailer.name,document.activeElement);if(!shell)return;
    const current=draft.offers.find(item=>item.id===id);
    if(current.checkedAt)shell.form.append(node('p','cmt-help','Last entered '+new Date(current.checkedAt).toLocaleString()));
    shell.form.append(node('p','cmt-help','Match this exact cigar and size. Use the regular price, before coupons.'));
    const url=field(shell.form,'Product link · ' + retailer.domains[0],'cmt-url','url');url.placeholder='https://www.'+retailer.domains[0]+'/…';url.maxLength=2048;url.value=current.url;
    const stockLabel=node('label','cmt-field','Stock status'),stock=node('select');stock.id='cmt-stock';stockLabel.htmlFor=stock.id;
    [['unknown','Not checked'],['in_stock','Available'],['out_of_stock','Out of stock']].forEach(([value,text])=>{const option=node('option','',text);option.value=value;stock.append(option);});stock.value=current.stock;stockLabel.append(stock);shell.form.append(stockLabel);
    const basisLabel=node('label','cmt-field','Price type'),basis=node('select');basis.id='cmt-price-type';basisLabel.htmlFor=basis.id;
    [['single','Actual single sold individually'],['box','Box price divided by cigar count']].forEach(([value,text])=>{const option=node('option','',text);option.value=value;basis.append(option);});basis.value=current.basis;basisLabel.append(basis);shell.form.append(basisLabel);
    const single=field(shell.form,'Actual single price · USD','cmt-single');single.inputMode='decimal';single.maxLength=12;single.value=current.singlePrice??'';
    const box=field(shell.form,'Full box price · USD','cmt-box');box.inputMode='decimal';box.maxLength=12;box.value=current.boxPrice??'';
    const count=field(shell.form,'Cigars in this box','cmt-count');count.inputMode='numeric';count.maxLength=4;count.value=current.boxCount??'';
    const preview=node('p','cmt-help');shell.form.append(preview);
    const update=()=>{single.parentElement.hidden=basis.value!=='single';box.parentElement.hidden=basis.value!=='box';count.parentElement.hidden=basis.value!=='box';single.disabled=basis.value!=='single';box.disabled=basis.value!=='box';count.disabled=basis.value!=='box';const total=optionalPrice(box.value),n=Number(count.value);preview.textContent=basis.value==='box'&&total&&Number.isInteger(n)&&n>0&&n<=1000?currency(total/n)+' per cigar · box-derived; buying the full box is required.':'';};
    basis.addEventListener('change',update);box.addEventListener('input',update);count.addEventListener('input',update);update();
    shell.form.addEventListener('submit',event=>{
      event.preventDefault();
      try {
        const candidate=normalizeOffer({url:url.value,stock:stock.value,basis:basis.value,singlePrice:single.value,boxPrice:box.value,boxCount:count.value,checkedAt:current.checkedAt},id);
        const changed=JSON.stringify(candidate)!==JSON.stringify(current);
        if(changed)candidate.checkedAt=new Date().toISOString();
        draft.offers[draft.offers.findIndex(item=>item.id===id)]=candidate;shell.finish();
      }catch(error){shell.error.textContent=error.message;}
    });shell.show();
  }
  api.mount = function mount(options) {
    const record = Object.fromEntries(['key','msrp',...FIELDS].map(field=>[field,clean(options.record?.[field])]));
    const id=identity(record);
    close(true);
    context={record,id,loadPos:options.loadPos};
    let trigger=document.getElementById('cdMarketTracker');
    if(!trigger){
      const bar=document.querySelector('.cd-topbar');
      const slot=bar?.querySelector('.cd-topbar-spacer');if(!slot)return;
      trigger=button('', 'icon-btn cmt-open');trigger.id='cdMarketTracker';trigger.setAttribute('aria-label','Open market price tracker');trigger.title='Market price tracker';trigger.setAttribute('aria-haspopup','dialog');
      const img=node('img');img.src=ASSETS+'www-icon.svg';img.alt='';trigger.append(img);
      // Keep the original three grid columns: Back | middle slot | theme.
      // A fourth top-level child would push the theme toggle to a new row.
      slot.removeAttribute('aria-hidden');slot.classList.add('cmt-button-slot');slot.append(trigger);
      trigger.addEventListener('click',()=>{void open();});
    }
  };
  root.addEventListener('popstate',()=>close(true));
  root.addEventListener('storage',event=>{
    if(!panel?.open||!context?.id||event.storageArea!==root.localStorage||(event.key!==null&&event.key!==storageKey(context.id)))return;
    message('Saved prices changed in another tab. Close and reopen the tracker to load them. Unsaved edits are not overwritten.',true);
  });
})(typeof window !== 'undefined' ? window : globalThis);
