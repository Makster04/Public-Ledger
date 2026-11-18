// Lobbied Bills, inside People First's Corporation Compromised: of the scored bills that one of their top business donors
// lobbied on, the share where they took the Profit side. "Lobbied on" means a lobbying report (LDA.gov) for the donor
// names the bill, or a report for a coalition that lists the donor among its members does. A report doesn't say which
// side the client was on, so this measures how often they sided with profit on the bills their business funders worked
// on, not whether they did what a funder wanted. public/lobbied-bills.json (scripts/build-lobbied-bills.mjs) holds, for
// each scored bill, the clients and coalition members that match some profile's donor; who matches whom is decided here,
// on the page and in the monthly recalculation alike.

// Words that name the kind of committee or company, not who it is, dropped from both names before comparing.
const DROP=new Set(['political','action','committee','pac','federal','employees','employee','good','government','fund','voluntary',
  'nonpartisan','bipartisan','inc','incorporated','corp','corporation','co','company','companies','cos','llc','lp','llp','ltd','plc',
  'holdings','holding','group','services','svcs']);
// Where a PAC's own name ends and the committee's words begin ("Chevron Employees Political Action…" is Chevron).
const PAC_START=new Set(['political','pac','employees','employee','fund','committee','federal','good','voluntary']);
// Small words left at either end once the rest is dropped ("Employees of RTX", "Merck & Co.", "Chevron U.S.A.").
const EDGE=new Set(['the','of','and','for','us','usa']);
const SHORT={assn:'association',assoc:'association',natl:'national',intl:'international',amer:'american',mfrs:'manufacturers',mfg:'manufacturing'};
// Words too common to identify an organization on their own: a shorter name made only of these (or of words under four
// letters) never matches a longer one.
const GENERIC=new Set(['american','americans','america','national','united','states','international','association','associations',
  'council','institute','federation','alliance','coalition','society','league','union','general','first','new','north','south',
  'east','west','central','energy','health','healthcare','financial','bank','banks','insurance','mutual','farm','global','of',
  'and','for','in','on','at','to','a','an','business','industry','industries','workers','members']);

// An organization's name as words: lower case, without parentheses (a PAC's short name), "AT&T" kept as one word, and the
// committee and company words dropped. pac: the name is a PAC's as the FEC lists it with each gift, cut off at 39
// characters, so a name that long loses its last word (it may be cut), and only the words before the committee's own
// ("Political", "PAC", "Employees", "Fund"…) are kept when there are any.
export function orgWords(name,{pac=false}={}){
  let s=String(name||'');
  if(pac&&s.length>=39)s=s.replace(/\s*\S+$/,'');
  s=s.toLowerCase().replace(/\([^)]*\)?/g,' ').replace(/([a-z0-9])&([a-z0-9])/g,'$1$2').replace(/&/g,' and ').replace(/['’.]/g,'');
  let w=s.split(/[^a-z0-9]+/).filter(Boolean).map(x=>SHORT[x]||x);
  if(pac){const k=w.findIndex(x=>PAC_START.has(x));if(k>0)w=w.slice(0,k);}
  w=w.filter(x=>!DROP.has(x));
  while(w.length&&EDGE.has(w[0]))w.shift();
  while(w.length&&EDGE.has(w[w.length-1]))w.pop();
  return w;
}
const telling=w=>w.some(x=>x.length>=4&&!GENERIC.has(x));
// A donor (its words) and a lobbying client or coalition member (a name) are the same organization: the same words
// (spaced either way, "ExxonMobil" and "Exxon Mobil"); or
// the client's name is the start of the donor's ("ConocoPhillips" and "ConocoPhillips Spirit PAC") and says who it is;
// or the donor's name of two words or more is the start of the client's ("BAE Systems" and "BAE Systems Inc. Electronic
// Systems"). One word alone ("Williams") must match exactly, so it can't pick up "Williams-Sonoma".
export function sameOrg(donor,client){
  const d=Array.isArray(donor)?donor:orgWords(donor),c=Array.isArray(client)?client:orgWords(client);
  if(!d.length||!c.length)return false;
  const starts=(a,b)=>a.every((x,i)=>x===b[i]);
  if(d.join('')===c.join(''))return d.join('').length>=3;
  if(d.length===c.length)return false;
  if(c.length<d.length)return starts(c,d)&&telling(c);
  return d.length>=2&&starts(d,c)&&telling(d);
}

// Their 20 largest business donors (the minimum of bills, 3, is PEOPLE_FIRST.minLobbied in public/six-scores.js).
export const TOP_BUSINESS_DONORS=20;
// Their top business donors, largest first: business PACs (pacRows [[nameIndex, amount, category]], business per
// isBusiness(nameIndex, category)) and the business groups whose positions are compared (funders with pac or routed money).
export function topBusinessDonors(pacRows,pacNames,isBusiness,funders=[],n=TOP_BUSINESS_DONORS){
  const by=new Map();
  for(const [i,amt,cat] of pacRows||[]){if(!(amt>0)||!isBusiness(i,cat))continue;const name=pacNames[i];if(!name)continue;const o=by.get(name)||by.set(name,{amount:0,pac:true}).get(name);o.amount+=amt;}
  for(const f of funders||[]){const amt=(f.pac||0)+(f.routed||0);if(!(amt>0)||!f.org)continue;const o=by.get(f.org)||by.set(f.org,{amount:0,pac:false}).get(f.org);o.amount+=amt;}
  // A group's PAC and the group itself ("Mortgage Bankers Association PAC" and "Mortgage Bankers Association") are one donor.
  const one=new Map();
  for(const [org,o] of by){const words=orgWords(org,{pac:o.pac}),k=words.join(' ');if(!k)continue;const d=one.get(k);if(d)d.amount+=o.amount;else one.set(k,{org,amount:o.amount,words});}
  return [...one.values()].map(d=>({...d,amount:Math.round(d.amount*100)/100})).sort((a,b)=>b.amount-a.amount).slice(0,n);
}
// scored: pvpScore().scored (one entry per bill, with credit = the bill on file and took = 'people' or 'profit');
// donors: topBusinessDonors(); lobbying: public/lobbied-bills.json. Returns {profit, n, bills: [{bill, took, by: [{donor,
// client, via}]}]} (via: the coalition the donor lobbied through), or null when the lobbying file isn't there.
export function lobbiedBills(scored,donors,lobbying){
  if(!lobbying?.bills)return null;
  const bills=[];
  for(const a of scored||[]){
    const entries=lobbying.bills[a.credit]?.clients||[],by=[];
    for(const d of donors||[])for(const [client,via] of entries)if(sameOrg(d.words,client)){by.push({donor:d.org,client,via:via||null});break;}
    if(by.length)bills.push({bill:a.credit,took:a.took,by});
  }
  return {profit:bills.filter(b=>b.took==='profit').length,n:bills.length,bills};
}
