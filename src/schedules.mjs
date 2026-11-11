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
const HOUSE_HEAD=/^\s*Schedule\s+([A-J])\s*:/i;
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
const bodyLines=t=>String(t||'').split(/\n/).map(tidy).filter(l=>l&&!HOUSE_COLUMNS.some(r=>r.test(l))&&!/^None disclosed\.?$/i.test(l));
// Lines that belong to the item above them (a long name the PDF wrapped) join it.
function items(lines,starts){const out=[];for(const l of lines){if(starts(l)||!out.length)out.push(l);else out[out.length-1]+=' '+l;}return out;}

const INCOME_TYPE=/\b(spouse salary|spouse income|salary|wages|honorari(?:a|um)|royalt(?:y|ies)|pension|retirement(?: benefits?)?|director'?s? fees?|board fees?|consulting(?: fees)?|commissions?|stipend|fees|other)\b/i;
export function houseIncome(text){
  return items(bodyLines(text),l=>INCOME_TYPE.test(l)||/(\$[\d,]|N\/A)/.test(l)).map(l=>{
    const amts=[...l.matchAll(/\$\s?[\d,]+(?:\.\d{2})?|N\/A/gi)].map(m=>/N\/A/i.test(m[0])?null:num(m[0]));
    const firstAmt=l.search(/\$\s?[\d,]|N\/A/i),head=(firstAmt>=0?l.slice(0,firstAmt):l).trim(),t=[...head.matchAll(new RegExp(INCOME_TYPE.source,'gi'))].pop();
    return {source:tidy(t?head.slice(0,t.index):head)||null,type:t?tidy(t[0]):null,amounts:amts.slice(0,2),text:l};});
}
const POSITION=/^(Board (?:Member|Chair(?:man|woman|person)?|of Directors|of Trustees|of Advisors)|Advisory Board(?: Member)?|Executive Director|Managing (?:Member|Partner|Director)|General Partner|Limited Partner|Vice[- ]President|Vice Chair(?:man)?|Co-(?:Chair|Founder|Owner)|Chief Executive Officer|Honorary (?:Chair|Board Member|Trustee|Member|Director)|Director|Trustee|Officer|President|Treasurer|Secretary|Chair(?:man|woman|person)?|Member|Partner|Owner|Founder|Advis[eo]r|CEO|Manager|Elder|Deacon|Commissioner|Delegate|Fellow|Volunteer)\b/i;
export function housePositions(text){
  return items(bodyLines(text),l=>POSITION.test(l)).map(l=>{const m=l.match(POSITION);return {position:m?tidy(m[0]):null,org:tidy(m?l.slice(m[0].length):l)||null,text:l};});
}
const DATE_START=/^(\d{1,2}\/(?:\d{1,2}\/)?\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(?:\d{1,2},\s*)?\d{4})\b/i;
export function houseAgreements(text){
  return items(bodyLines(text),l=>DATE_START.test(l)).map(l=>{const m=l.match(DATE_START);return {date:m?m[1]:null,terms:tidy(m?l.slice(m[0].length):l)||null,text:l};});
}
export function houseGifts(text){
  return items(bodyLines(text),l=>HAS_MONEY.test(l)).map(l=>{const v=[...l.matchAll(MONEY)].pop();
    return {source:tidy(v?l.slice(0,v.index):l)||null,value:v?num(v[0]):null,text:l};});
}
const DATE=/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;
export function houseTravel(text){
  return items(bodyLines(text),l=>(l.match(DATE)||[]).length>=2).map(l=>{const ds=[...l.matchAll(DATE)];
    const after=ds[1]?l.slice(ds[1].index+ds[1][0].length):'',itin=after.replace(/(\s+(\d+|[YN]|Yes|No))+\s*$/i,'');
    return {source:tidy(ds[0]?l.slice(0,ds[0].index):l)||null,from:ds[0]?.[0]||null,to:ds[1]?.[0]||null,itinerary:tidy(itin)||null,text:l};});
}
// raw: each schedule's text as read (cut short), kept with the newest report so the reader can be checked against it.
export function houseAnnualSchedules(text){
  const s=houseSections(text),cut=t=>t?String(t).slice(0,1500):'';
  return {income:houseIncome(s.C),positions:housePositions(s.E),agreements:houseAgreements(s.F),gifts:houseGifts(s.G),travel:houseTravel(s.H),
    read:Object.keys(s).length>0,raw:{C:cut(s.C),E:cut(s.E),F:cut(s.F),G:cut(s.G),H:cut(s.H)}};
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
