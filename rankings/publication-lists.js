
/* Publication lists use only the year/rank fields on their original HUB rows. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CigarosPublicationLists = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const publishers = Object.freeze([
    {id:'ca', name:'Cigar Aficionado', logo:'/img/icons/cigaraficionado.svg',
      archiveUrl:'https://www.cigaraficionado.com/top25', firstYear:2004},
    {id:'cj', name:'Cigar Journal', logo:'/img/icons/cigarjournal.svg',
      archiveUrl:'https://www.cigarjournal.com/ratings/top-25/', firstYear:2013},
    {id:'consensus', name:'halfwheel Consensus', logo:'/img/icons/halfwheel.svg',
      archiveUrl:'https://halfwheel.com/category/miscellaneous/awards/the-consensus/', firstYear:2011}
  ].map(Object.freeze));
  const schemas = Object.freeze({
    ca:{prefix:'cigar_aficionado_top_25',domain:'cigaraficionado.com'},
    cj:{prefix:'cigar_journal_top_25',domain:'cigarjournal.com'},
    consensus:{prefix:'hw_consensus',domain:'halfwheel.com'}
  });
  const text = value => String(value == null ? '' : value).trim();
  const usable = value => text(value) && !/^(?:n\/a|none|null|undefined|[—–-])$/i.test(text(value));
  const keyOf = row => text(row.key || row.cigar_id || row.id || row.row_id);
  const yearsIn = value => (text(value).match(/\b(?:19|20)\d{2}\b/g) || []).map(Number);
  const norm = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

  function displayName(row) {
    const brand=text(row.brand), line=text(row.line), cigar=text(row.cigar || row.name);
    const parts=line && norm(brand) && (' '+norm(line)+' ').includes(' '+norm(brand)+' ')
      ? [line,cigar] : [brand,line,cigar];
    const words=[];
    for (const part of parts.filter(usable)) {
      const next=part.split(/\s+/); let overlap=0;
      for (let n=1;n<=Math.min(words.length,next.length);n++) {
        if (norm(words.slice(-n).join(' '))===norm(next.slice(0,n).join(' '))) overlap=n;
      }
      words.push(...next.slice(overlap));
    }
    return words.join(' ') || text(row.vitola) || '—';
  }

  function parseRank(value) {
    const years=yearsIn(value);
    const clean=text(value).replace(/\(\s*(?:19|20)\d{2}\s*\)/g,'')
      .replace(/^(?:19|20)\d{2}\s*[:=]\s*/,'').trim();
    const match=clean.match(/^(?:(T(?:ied)?)[\s-]*)?(?:#|No\.?\s*)?(\d{1,2})$/i);
    if (!match || Number(match[2])<1 || Number(match[2])>25) return null;
    return {rank:Number(match[2]),isTie:Boolean(match[1]),explicitYear:years.length===1?years[0]:null};
  }

  function awardsFor(row,publisher,warn) {
    const prefix=schemas[publisher.id].prefix;
    const yearText=text(row[prefix+'_year']), rankText=text(row[prefix+'_rank']);
    if (!usable(yearText) && !usable(rankText)) return [];
    const years=yearsIn(yearText), parts=rankText.split(/[;\n|,]+/).filter(part=>part.trim());
    const ranks=parts.map(parseRank);
    if (!years.length || !parts.length || ranks.some(rank=>!rank)) {
      warn('has a missing or unreadable award year/rank'); return [];
    }
    const awards=[];
    years.forEach((year,index)=>{
      const explicit=ranks.filter(rank=>rank.explicitYear===year);
      const rank=explicit.length===1 ? explicit[0] : explicit.length ? null
        : ranks.length===years.length && !ranks[index].explicitYear ? ranks[index] : null;
      if (!rank) {warn('has an ambiguous rank for '+year);return;}
      if (!awards.some(award=>award.year===year && award.rank===rank.rank && award.isTie===rank.isTie))
        awards.push({...rank,year,yearIndex:index,yearCount:years.length});
    });
    return awards;
  }

  function sourceFor(row,publisher,award) {
    const {prefix,domain}=schemas[publisher.id];
    const fields=publisher.id==='cj' ? ['full_list','cigar_link','link'] : ['link','full_list'];
    const urls=fields.flatMap(field=>(text(row[prefix+'_'+field]).match(/https?:\/\/[^\s;,]+/g)||[]))
      .flatMap(raw=>{
        try {
          const url=new URL(raw.replace(/[)\].]+$/,''));
          return url.hostname===domain || url.hostname.endsWith('.'+domain)
            ? [{url:url.href,years:yearsIn(url.pathname+url.search)}] : [];
        } catch {return [];}
      });
    return urls.find(item=>item.years.includes(award.year))?.url
      || (award.yearCount===1 ? urls.find(item=>!item.years.length)?.url : '') || publisher.archiveUrl;
  }

  function completeness(entries) {
    const groups=new Map();
    entries.forEach(entry=>{
      if (!groups.has(entry.rank)) groups.set(entry.rank,[]);
      groups.get(entry.rank).push(entry);
    });
    let next=1,complete=true,expectedCount=25;
    for (const [rank,members] of [...groups].sort((a,b)=>a[0]-b[0])) {
      if (rank!==next || (members.length>1 && members.some(entry=>!entry.isTie))) complete=false;
      next=rank+members.length;
      expectedCount=Math.max(expectedCount,next-1);
    }
    return {expectedCount,complete:complete && next>25 && entries.length===expectedCount};
  }

  function build(records) {
    if (!Array.isArray(records)) throw new TypeError('Publication lists require an array of HUB rows.');
    const warnings=new Set(), slots=new Map(), entries=[];
    records.forEach((row,rowIndex)=>{
      if (!row || typeof row!=='object' || Array.isArray(row)) return;
      const hubRowNumber=Number(row.__hubSheetRow) || rowIndex+2;
      for (const publisher of publishers) {
        const warn=message=>warnings.add(publisher.name+', HUB row '+hubRowNumber+' '+message+'.');
        for (const award of awardsFor(row,publisher,warn)) {
          const slotId=publisher.id+':'+award.year+':'+award.rank;
          if (!slots.has(slotId)) slots.set(slotId,{identities:new Set(),numeric:null});
          const slot=slots.get(slotId);
          // Only an actual Hub key establishes duplicate identity. A keyless tie
          // remains its own row, even when another cigar has the same name.
          const identity=keyOf(row) || 'row:'+hubRowNumber;
          if (slot.identities.has(identity)) continue;
          if (!award.isTie && slot.numeric) {
            warn('duplicates '+award.year+' rank '+award.rank+'; the first HUB row supplies that slot');
            continue;
          }
          const record={...row,__publicationHubRow:true,__publicationHubRowNumber:hubRowNumber,__publishedName:displayName(row)};
          const entry={id:'award:'+slotId+':'+encodeURIComponent(identity),
            publisherId:publisher.id,year:award.year,rank:award.rank,
            rankLabel:award.isTie?'T-'+award.rank:'#'+award.rank,isTie:award.isTie,
            sourceOrder:rowIndex,record,sourceUrl:sourceFor(row,publisher,award),
            scope:publisher.id==='consensus'?'blend':'cigar'};
          slot.identities.add(identity);
          if (!award.isTie) slot.numeric=entry;
          entries.push(entry);
        }
      }
    });
    const lists=[];
    for (const publisher of publishers) {
      const own=entries.filter(entry=>entry.publisherId===publisher.id);
      const years=[...new Set(own.map(entry=>entry.year))].sort((a,b)=>b-a);
      const annual=years.map(year=>{
        const members=own.filter(entry=>entry.year===year).sort((a,b)=>a.rank-b.rank || a.sourceOrder-b.sourceOrder);
        const status=completeness(members);
        if (!status.complete) warnings.add(publisher.name+' '+year+': the HUB list is incomplete or has unresolved rank conflicts.');
        return {id:'pub:'+publisher.id+':'+year,publisherId:publisher.id,publisherName:publisher.name,
          kind:'annual',year,title:year+(publisher.id==='consensus'?' Consensus':' Top 25'),
          description:publisher.id==='consensus'
            ? 'The Consensus combines annual rankings from cigar media into one list. Explore the highest-ranked blends for '+year+'.'
            : publisher.name+'’s '+(publisher.id==='cj'?'Top 25 New Cigars':'Top 25 Cigars')+' of '+year+', selected through its annual blind tastings.',
          sourceUrl:members[0]?.sourceUrl || publisher.archiveUrl,entries:members,actualCount:members.length,...status};
      });
      const winners=annual.flatMap(list=>list.entries.filter(entry=>entry.rank===1))
        .sort((a,b)=>b.year-a.year || a.sourceOrder-b.sourceOrder);
      const expectedCount=years.length ? years[0]-publisher.firstYear+1 : null;
      const winnerYears=new Set(winners.map(entry=>entry.year));
      lists.push({id:'pub:'+publisher.id+':winners',publisherId:publisher.id,publisherName:publisher.name,
        kind:'winners',year:null,title:'No. 1s',description:publisher.id==='consensus'
          ? 'The No. 1 blends from halfwheel’s yearly consensus of cigar media rankings.'
          : publisher.id==='ca' ? "Cigar Aficionado's coveted #1 Cigar of the Year. View the list below for every cigar to claim the title (2004-2025)." : 'Every No. 1 from Cigar Journal’s annual Top 25 New Cigars.',
        sourceUrl:publisher.archiveUrl,entries:winners,actualCount:winners.length,expectedCount,
        complete:expectedCount!==null && winnerYears.size===expectedCount && winners.length===expectedCount});
      lists.push(...annual);
    }
    return {lists,warnings:[...warnings]};
  }

  return Object.freeze({publishers,build});
});

