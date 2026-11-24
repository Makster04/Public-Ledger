// The parts of an annual financial disclosure that Plays by the Rules' Outside Income & Conflicts and Gifts & Travel
// read, besides the assets and debts the net-worth reader already takes (src/feeds.mjs): earned income (who paid them
// or their spouse, for what, and how much), positions held outside government, agreements (future jobs, leaves,
// continuing payments), gifts, and travel paid by others. Read automatically from the House Clerk's PDF text (Schedules
// C, E, F, G and H) and the Senate eFD report page (its tables, found by their column headings). Nothing here judges
// an item: matching an organization to their committees is a separate step.
//
// Each list: income [{source, type, amounts: [current year, preceding year], text}], positions [{position, org, text}],
// agreements [{date, terms, text}], gifts [{source, value, text}], travel [{source, from, to, itinerary, text}].
// "text" is the line as read, so a reader that splits a line wrongly still shows what the form says.
const MONEY=/\$\s?[\d,]+(?:\.\d{2})?/g,HAS_MONEY=/\$\s?\d/;
const num=s=>{const n=Number(String(s||'').replace(/[$,\s]/g,''));return Number.isFinite(n)?n:null;};
const tidy=s=>String(s||'').replace(/\s+/g,' ').trim();

// ---------- House: Schedules C, E, F, G, H in the PDF's text ----------
// The headings are set in small capitals, which the newer reports' fonts don't map back to letters: "SCHEDULE C: EARNED
// INCOME" can come out as "S   C : E   I". Either form is a heading.
const HOUSE_HEAD=/^\s*S(?:chedule|\s)\s*([A-J])\s*:/i;
// The text of each schedule, by letter, without its heading line; "None disclosed." leaves it empty.
export function houseSections(text){
  const out={},lines=String(text||'').split(/\r?\n/);let cur=null;
  for(const line of lines){const m=line.match(HOUSE_HEAD);
    if(m){cur=m[1].toUpperCase();out[cur]=out[cur]||[];continue;}
    if(/^\s*(Exclusions of Spouse|Certification and Signature|Comments)\b/i.test(line)){cur=null;continue;}
    if(cur)out[cur].push(line);}
  const sec={};for(const [k,v] of Object.entries(out)){const t=v.join('\n').trim();sec[k]=/^None disclosed\.?$/i.test(t)?'':t;}
  return sec;
}
// A schedule's lines without its column headings and the form's notes.
const HOUSE_COLUMNS=[/^Source\s+Type\s+Amount/i,/^Position\s+Name of Organization/i,/^Date\s+Parties To\s+Terms/i,/^Source\s+Description\s+Value/i,/^Source\s+Start Date/i,
  /^(Current Year to Filing|Preceding Year|Days at Own|Lodging\?|Food\?|Family\?)\b/i,/^\*/,/^Filing ID\b/i,/^Page \d+ of \d+/i];
// The same headings with the letters spaced apart, as the newer reports' text comes out ("S o u rce T y p e A mo u n t").
const HOUSE_COLUMNS_FLAT=[/^SourceTypeAmount/i,/^PositionNameofOrganization/i,/^DatePartiesToTerms/i,/^SourceDescriptionValue/i,/^SourceStartDate/i,
  /^(CurrentYeartoFiling|PrecedingYear|DaysatOwn|Lodging\?|Food\?|Family\?|TripDetails|Inclusions)/i,/^(Exp\.?|Date|Liability)$/i];
const isColumns=l=>HOUSE_COLUMNS.some(r=>r.test(l))||HOUSE_COLUMNS_FLAT.some(r=>r.test(l.replace(/\s+/g,'')));
// A line in those fonts: many of its pieces single letters, and no whole word of seven letters or more ("C : P o sit io n
// is u nco m pensa t ed"). The items themselves are set in a plain font, so such a line is a heading or a note, never an item.
export const spaced=l=>{const w=tidy(l).split(' ');return w.length>=5&&w.filter(x=>/^[A-Za-z]$/.test(x)).length/w.length>=0.4&&!/[A-Za-z]{7}/.test(l);};
// A filer's note under an item ("C: Position is uncompensated."), with the lines it wraps onto.
const COMMENT=/^C\s*:/;
const bodyLines=t=>String(t||'').split(/\n/).map(tidy).filter(l=>l&&!isColumns(l)&&!/^None disclosed\.?$/i.test(l));
// Lines that belong to the item above them (a long name the PDF wrapped) join it; a note goes with the item as its comment,
// up to the next item. Each: {l: the item's line, c: its note, if any}.
function items(lines,starts){
  const out=[];let note=false;
  for(const l of lines){
    if(spaced(l)&&!COMMENT.test(l)){if(note)out[out.length-1].c+=' '+l;continue;}   // a heading, or the rest of a note
    if(COMMENT.test(l)&&out.length){const x=out[out.length-1];x.c=tidy(l.replace(COMMENT,''));note=true;continue;}
    if(starts(l)||!out.length){out.push({l});note=false;}
    else if(note)out[out.length-1].c+=' '+l;
    else out[out.length-1].l+=' '+l;
  }
  return out;
}
const withNote=(x,c)=>c?{...x,comment:c}:x;

const INCOME_TYPE=/\b(spouse salary|spouse income|salary|wages|honorari(?:a|um)|royalt(?:y|ies)|pension|retirement(?: benefits?)?|director'?s? fees?|board fees?|consulting(?: fees)?|commissions?|stipend|fees|other)\b/i;
export function houseIncome(text){
  return items(bodyLines(text),l=>INCOME_TYPE.test(l)||/(\$[\d,]|N\/A)/.test(l)).map(({l,c})=>{
    const amts=[...l.matchAll(/\$\s?[\d,]+(?:\.\d{2})?|N\/A/gi)].map(m=>/N\/A/i.test(m[0])?null:num(m[0]));
    const firstAmt=l.search(/\$\s?[\d,]|N\/A/i),head=(firstAmt>=0?l.slice(0,firstAmt):l).trim(),t=[...head.matchAll(new RegExp(INCOME_TYPE.source,'gi'))].pop();
    return withNote({source:tidy(t?head.slice(0,t.index):head)||null,type:t?tidy(t[0]):null,amounts:amts.slice(0,2),text:l},c);});
}
const POSITION=/^(Board (?:Member|Chair(?:man|woman|person)?|of Directors|of Trustees|of Advisors|of Visitors|of Governors|of Regents)|Advisory Board(?: Member)?|Executive Director|Managing (?:Member|Partner|Director)|General Partner|Limited Partner|Vice[- ]President|Vice Chair(?:man)?|Co-(?:Chair|Founder|Owner)|Chief Executive Officer|Honorary (?:Chair|Board Member|Trustee|Member|Director)|Director|Trustee|Officer|President|Treasurer|Secretary|Chair(?:man|woman|person)?|Member|Partner|Owner|Founder|Advis[eo]r|CEO|Manager|Elder|Deacon|Commissioner|Delegate|Fellow|Volunteer|Chaplain)\b/i;
export function housePositions(text){
  return items(bodyLines(text),l=>POSITION.test(l)).map(({l,c})=>{
    // A title with a second one after a slash ("Vice President/Director") is one title.
    const m=l.match(POSITION),both=m&&l.slice(m[0].length).match(/^\s*\/\s*[A-Z][\w-]*/),title=m?m[0]+(both?both[0]:''):'';
    return withNote({position:m?tidy(title):null,org:tidy(m?l.slice(title.length):l)||null,text:l},c);});
}
const DATE_START=/^(\d{1,2}\/(?:\d{1,2}\/)?\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(?:\d{1,2},\s*)?\d{4})\b/i;
export function houseAgreements(text){
  return items(bodyLines(text),l=>DATE_START.test(l)).map(({l,c})=>{const m=l.match(DATE_START);return withNote({date:m?m[1]:null,terms:tidy(m?l.slice(m[0].length):l)||null,text:l},c);});
}
export function houseGifts(text){
  return items(bodyLines(text),l=>HAS_MONEY.test(l)).map(({l,c})=>{const v=[...l.matchAll(MONEY)].pop();
    return withNote({source:tidy(v?l.slice(0,v.index):l)||null,value:v?num(v[0]):null,text:l},c);});
}
const DATE=/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;
// A trip's row ends with its days at the filer's own expense (and the Y/N columns, where shown); the source's name can
// wrap onto the lines above its dates, and the itinerary onto the lines below.
const ROW_END=/(?:^|\s)(?:\d{1,3}|[YN]|Yes|No)$/i;
function travelRows(lines){
  const rows=[];let cur=null;
  for(const l of lines){
    if(spaced(l))continue;
    if(COMMENT.test(l)){if(rows.length)rows[rows.length-1].c=tidy(l.replace(COMMENT,''));continue;}
    const n=(l.match(DATE)||[]).length;
    if(cur&&n>=2&&(cur.l.match(DATE)||[]).length>=2){rows.push(cur);cur=null;}   // two trips with no end mark between them
    cur=cur?{l:cur.l+' '+l}:{l};
    if((cur.l.match(DATE)||[]).length>=2&&ROW_END.test(l)){rows.push(cur);cur=null;}
  }
  if(cur)rows.push(cur);
  return rows.filter(r=>(r.l.match(DATE)||[]).length>=2);   // a stray piece with no dates (the Y/N columns on a line of their own) is left out
}
export function houseTravel(text){
  return travelRows(bodyLines(text)).map(({l,c})=>{const ds=[...l.matchAll(DATE)];
    const after=ds[1]?l.slice(ds[1].index+ds[1][0].length):'',itin=after.replace(/(\s+(\d+|[YN]|Yes|No))+\s*$/i,'');
    return withNote({source:tidy(ds[0]?l.slice(0,ds[0].index):l)||null,from:ds[0]?.[0]||null,to:ds[1]?.[0]||null,itinerary:tidy(itin)||null,text:l},c);});
}
// raw: each schedule's text as read (cut short), kept with the newest report so the reader can be checked against it.
// v: this reader's version; a report read by an earlier one is read again by the refresh (2 = the House Clerk's newer
// reports, from 2025 on, which the PDF reader couldn't open before, and their spaced-out headings and notes).
export const SCHEDULES_READER=2;
export function houseAnnualSchedules(text){
  const s=houseSections(text),cut=t=>t?String(t).slice(0,1500):'';
  return {income:houseIncome(s.C),positions:housePositions(s.E),agreements:houseAgreements(s.F),gifts:houseGifts(s.G),travel:houseTravel(s.H),
    read:Object.keys(s).length>0,v:SCHEDULES_READER,raw:{C:cut(s.C),E:cut(s.E),F:cut(s.F),G:cut(s.G),H:cut(s.H)}};
}

// ---------- Senate eFD: the report page's tables, by their column headings ----------
const strip=h=>tidy(String(h||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"'));
const fold=s=>s.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
export function efdAnnualSchedules(html){
  const out={income:[],positions:[],agreements:[],gifts:[],travel:[],read:false};
  for(const [table] of String(html||'').matchAll(/<table[\s\S]*?<\/table>/gi)){
    const heads=[...(table.match(/<thead[\s\S]*?<\/thead>/i)?.[0]||'').matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>fold(strip(m[1])));
    const has=(...ws)=>ws.every(w=>heads.some(h=>h.includes(w))),at=w=>heads.findIndex(h=>h.includes(w));
    const kind=has('who paid')||has('amount paid')?'income':has('position')&&has('entity')?'positions':has('parties')?'agreements':has('itinerary')?'travel'
      :has('value')&&!has('asset')&&(has('source')||has('description'))?'gifts':null;
    if(!kind)continue;out.read=true;
    for(const [,row] of (table.match(/<tbody[\s\S]*?<\/tbody>/i)?.[0]||'').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
      const cells=[...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>strip(m[1])),c=w=>{const i=at(w);return i>=0?cells[i]||'':'';};
      const text=cells.filter(x=>x&&!/^\d+$/.test(x)).join(' · ');if(!text)continue;
      if(kind==='income')out.income.push({source:c('who paid')||null,type:c('type')||null,amounts:[num((c('amount').match(MONEY)||[])[0])],paidTo:c('who was paid')||null,text});
      else if(kind==='positions')out.positions.push({position:c('position held')||c('position')||null,org:c('entity')||null,text});
      else if(kind==='agreements')out.agreements.push({date:c('date')||null,terms:[c('parties'),c('type'),c('status')].filter(Boolean).join(' · ')||null,text});
      else if(kind==='gifts')out.gifts.push({source:c('source')||c('description')||null,value:num((c('value').match(MONEY)||[])[0]),text});
      else out.travel.push({source:c('source')||c('sponsor')||null,from:c('date')||c('dates')||null,to:null,itinerary:c('itinerary')||null,text});
    }
  }
  return out;
}
// Counts, for the page and the checks: how many items each part holds.
export const scheduleCounts=s=>s?{income:s.income?.length||0,positions:s.positions?.length||0,agreements:s.agreements?.length||0,gifts:s.gifts?.length||0,travel:s.travel?.length||0}:null;
