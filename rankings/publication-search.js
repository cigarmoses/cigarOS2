
/* All-field search over accepted publication awards. No inventory-only rows. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.CigarosPublicationSearch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function normalize(value){
    return String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
      .replace(/[’'`]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
  }
  function values(value){
    if(value==null)return [];
    if(Array.isArray(value))return value.flatMap(values);
    if(typeof value==='object')return Object.entries(value).filter(([key])=>!key.startsWith('__')).flatMap(([,item])=>values(item));
    return [String(value)];
  }
  function numericKey(value){
    if(value.includes('/') || !value.includes('.'))return value;
    const [whole,fraction]=value.split('.');
    const tail=fraction.replace(/0+$/,'');
    return (whole||'0')+(tail?'.'+tail:'');
  }
  function numericTokens(value){
    return (String(value??'').normalize('NFKC').match(/(?:\d+(?:\.\d+)?|\.\d+)(?:\/\d+)?/g)||[]).map(numericKey);
  }
  function identity(entry){
    const row=entry.record;
    const key=String(row.key||row.cigar_id||row.id||row.row_id||'').trim();
    return key?'key:'+key:'row:'+(row.__publicationHubRowNumber||row.__hubSheetRow||entry.sourceOrder);
  }
  function build(lists,publishers,records=[]){
    const groups=new Map(),publisherMap=new Map(publishers.map(p=>[p.id,p.name]));
    for(const list of lists){
      // Winner views duplicate the annual entries and are deliberately excluded.
      if(list.kind!=='annual' && !/:\d{4}$/.test(list.id))continue;
      for(const entry of list.entries||[]){
        if(!entry.record || !publisherMap.has(entry.publisherId))continue;
        const key=identity(entry);
        if(!groups.has(key))groups.set(key,{id:key,record:entry.record,awards:[],raw:[],seen:new Set()});
        const group=groups.get(key);
        if(group.seen.has(entry.id))continue;
        group.seen.add(entry.id);group.awards.push(entry);
        // Every original Hub column value is a keyword, including new columns.
        group.raw.push(...values(entry.record),publisherMap.get(entry.publisherId),String(entry.year),entry.rankLabel);
      }
    }
    // Same-key Hub rows may carry details omitted on an award's original row.
    // Enrich keywords only; never infer awards by name or add inventory results.
    for(const row of records){
      if(!row || typeof row!=='object')continue;
      const key=String(row.key||row.cigar_id||row.id||row.row_id||'').trim();
      const group=key && groups.get('key:'+key);
      if(group)group.raw.push(...values(row));
    }
    return [...groups.values()].map(group=>{
      group.awards.sort((a,b)=>b.year-a.year||a.rank-b.rank||a.publisherId.localeCompare(b.publisherId));
      const fields=[...new Set(group.raw.map(normalize).filter(Boolean))];
      const numbers=new Set(group.raw.flatMap(numericTokens));
      return {id:group.id,record:group.record,awards:group.awards,fields,compact:fields.map(field=>field.replace(/ /g,'')),numbers};
    }).sort((a,b)=>b.awards[0].year-a.awards[0].year||a.awards[0].rank-b.awards[0].rank||
      String(a.record.__publishedName||'').localeCompare(String(b.record.__publishedName||'')));
  }
  function search(index,query){
    const parts=String(query??'').trim().split(/\s+/).filter(Boolean);
    const terms=parts.flatMap(part=>{
      const numeric=part.normalize('NFKC').replace(/^[#"'‘’“”([{]+|[)"'‘’“”\]},;:!?]+$/g,'').replace(/\.$/,'');
      return /^(?:\d+(?:\.\d+)?|\.\d+)(?:\/\d+)?$/.test(numeric)
        ? [{number:numericKey(numeric)}] : normalize(part).split(' ').filter(Boolean).map(text=>({text}));
    });
    if(!terms.length)return [];
    return index.filter(item=>terms.every(term=>term.number?item.numbers.has(term.number):
      item.fields.some(field=>field.includes(term.text))||item.compact.some(field=>field.includes(term.text))));
  }
  // A cigar appears once, ordered by its best rank in the selected publication(s).
  // Projection only: never mutate the catalog's records, awards or keyword index.
  function rankResults(matches,publishers,filter='all'){
    const ids=new Set(publishers.map(p=>p.id));
    const selected=filter==='all'||ids.has(filter)?filter:'all';
    const counts=Object.fromEntries([['all',matches.length],...publishers.map(p=>[p.id,0])]);
    const compareText=(a,b)=>normalize(a).localeCompare(normalize(b),'en',{numeric:true,sensitivity:'base'});
    const compareAward=(a,b)=>Number(a.rank)-Number(b.rank)||Number(b.year)-Number(a.year)||
      compareText(a.publisherId,b.publisherId)||String(a.id).localeCompare(String(b.id));
    const nameOf=item=>item.record.__publishedName || [item.record.brand,item.record.line,item.record.cigar||item.record.name,item.record.vitola].filter(Boolean).join(' ');
    const results=[];
    for(const item of matches){
      for(const id of new Set(item.awards.map(award=>award.publisherId))){if(ids.has(id))counts[id]++;}
      const awards=item.awards.filter(award=>selected==='all'||award.publisherId===selected).sort(compareAward);
      if(!awards.length)continue;
      // Awards are rank ASC / year DESC, so this year belongs to the best rank,
      // never a newer but lower-ranked accolade on the same cigar.
      results.push({...item,awards,bestRank:Number(awards[0].rank),bestYear:Number(awards[0].year)});
    }
    results.sort((a,b)=>a.bestRank-b.bestRank||b.bestYear-a.bestYear||
      compareText(a.record.brand,b.record.brand)||compareText(nameOf(a),nameOf(b))||
      String(a.id).localeCompare(String(b.id)));
    return {results,counts,filter:selected};
  }
  function formatSize(record){
    const dimension=value=>{
      const text=String(value??'').trim();
      return /^(?:n\/a|na|none|null|undefined|unknown|[—–-]+|0(?:\.0+)?)$/i.test(text)?'':text;
    };
    const ring=dimension(record.ring),length=dimension(record.length);
    return ring&&length?ring+' x '+length:ring?'Ring '+ring:length?'Length '+length:'';
  }
  return Object.freeze({normalize,build,search,rankResults,formatSize});
});

  