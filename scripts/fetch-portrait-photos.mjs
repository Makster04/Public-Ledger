// Finds a photo that is free to reuse for each person on the site who still shows initials (no portrait in
// public/portraits/index.json): the lead photo of their Wikipedia article, when it is on Wikimedia Commons under a free
// license or in the public domain. Each photo is saved to data/portraits/<id>.<jpg|png> and listed in
// scripts/portrait-extra.json with its author, license and file page, for scripts/build-portraits.py to cut out.
// An entry in portrait-extra.json with "lookup": false (its Wikipedia photo was looked at and can't be used) isn't looked
// up again. A Wikipedia article counts only when its title is the person's name and its opening names their state; anyone without
// such an article, or whose article's photo isn't free, is listed and keeps the initials.
//   npm run portraits:fetch                      looks everyone up and saves the photos
//   npm run portraits:fetch -- --dry-run         lists what it would use, saving nothing
//   npm run portraits:fetch -- --only sc-andrews,H6MI07298
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const root=new URL('..',import.meta.url);
export const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',
  MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',
  NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
const AGENT='PublicLedger/1.0 (portrait lookup for a nonprofit scorecard; https://github.com/Makster04/Public-Ledger)';
const letters=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
const strip=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();

// Everyone on the site without a portrait: profiled people and the results-only nominees, with their state's name
// (written as a code or in full in research.json).
export function missing(research,index,extra){
  const out=[],seen=new Set(),add=(id,name,state)=>{if(!id||seen.has(id)||index.people?.[id]||(extra[id]&&(!extra[id].skip||extra[id].lookup===false)))return;seen.add(id);out.push({id,name,state:STATES[state]||state});};
  for(const p of [...research.members,...research.cands,...(research.featured||[])])add(p.id,p.name,p.state);
  for(const r of research.liteRaces)for(const n of r.nominees)add(n.fecCand||n.id,n.name,r.state);
  return out;
}
// A Wikipedia title is the person's when, without a note in parentheses, it has their first and last names.
export function titleFits(title,name){
  const t=letters(String(title).replace(/\([^)]*\)/g,'')).split(' '),n=letters(name).split(' ');
  return t.includes(n[0])&&t.at(-1)===n.at(-1);
}
// A license that allows reuse here: Creative Commons (not the noncommercial or no-derivatives kinds) or public domain.
export function freeLicense(short){
  const s=String(short||'');
  if(/\b(nc|nd)\b/i.test(s)||/non-?commercial|no ?deriv|fair use/i.test(s))return false;
  return /^(cc[ -]?(by|0|zero)|cc-by|public domain|pd\b|pdm)/i.test(s.trim());
}
// The line under a portrait.
export const creditOf=(artist,license)=>/^(public domain|pd)/i.test(license)?`Photo: ${artist||'unknown author'}, public domain, via Wikimedia Commons`
  :`Photo: ${artist||'unknown author'}, ${license}, via Wikimedia Commons; background removed for this site`;

async function api(host,params){
  const u=new URL(`https://${host}/w/api.php`);for(const [k,v] of Object.entries({format:'json',formatversion:2,...params}))u.searchParams.set(k,v);
  const res=await fetch(u,{headers:{'User-Agent':AGENT},signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw new Error(`${host} answered HTTP ${res.status}`);
  return res.json();
}
// One person: their article, its lead photo, and the photo's license. {found} or {none: why}.
export async function lookUp(person,{ask=api}={}){
  const state=STATES[person.state]||person.state||'';
  const search=await ask('en.wikipedia.org',{action:'query',list:'search',srsearch:`${person.name} ${state}`,srlimit:6,srprop:''});
  const titles=(search.query?.search||[]).map(r=>r.title).filter(t=>titleFits(t,person.name));
  if(!titles.length)return {none:'no Wikipedia article with that name'};
  const pages=await ask('en.wikipedia.org',{action:'query',prop:'extracts|pageimages',exintro:1,explaintext:1,exchars:1500,piprop:'name',titles:titles.join('|'),redirects:1});
  const fits=(pages.query?.pages||[]).filter(p=>!p.missing&&state&&String(p.extract||'').includes(state));
  if(!fits.length)return {none:`no Wikipedia article about them in ${state} (looked at: ${titles.join('; ')})`};
  const page=fits.sort((a,b)=>titles.indexOf(a.title)-titles.indexOf(b.title))[0];
  if(!page.pageimage)return {none:`"${page.title}" has no photo`};
  const info=await ask('commons.wikimedia.org',{action:'query',titles:`File:${page.pageimage}`,prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:900});
  const file=(info.query?.pages||[])[0],ii=file?.imageinfo?.[0];
  if(!ii||file.missing)return {none:`"${page.title}" has a photo that isn't on Wikimedia Commons, so it isn't free to reuse`};
  const meta=ii.extmetadata||{},license=strip(meta.LicenseShortName?.value||meta.License?.value);
  if(!freeLicense(license))return {none:`the photo on "${page.title}" has a license that doesn't allow this use (${license||'none given'})`};
  if(!/^image\/(jpeg|png)$/.test(ii.mime))return {none:`the photo on "${page.title}" is a ${ii.mime}, not a JPEG or PNG`};
  return {found:{article:page.title,file:page.pageimage,download:ii.thumburl||ii.url,page:ii.descriptionurl,ext:ii.mime==='image/png'?'png':'jpg',
    license,artist:strip(meta.Artist?.value).slice(0,120)}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),dry=args.includes('--dry-run'),i=args.indexOf('--only'),only=i>=0?new Set(args[i+1].split(',')):null;
  const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
  const research=read('public/research.json'),index=read('public/portraits/index.json'),extraFile=new URL('scripts/portrait-extra.json',root),extra=read('scripts/portrait-extra.json');
  const people=missing(research,index,extra).filter(p=>!only||only.has(p.id));
  console.log(`Looking up ${people.length} ${people.length===1?'person':'people'} without a portrait on Wikipedia…`);
  let saved=0;
  for(const p of people){
    let r;try{r=await lookUp(p);}catch(e){r={none:`couldn't ask Wikipedia (${e.cause?.code||e.message})`};}
    if(r.none){console.log(`NONE  ${p.id} ${p.name}: ${r.none}`);continue;}
    const f=r.found;console.log(`FOUND ${p.id} ${p.name}: "${f.article}" → ${f.page} (${f.license}, ${f.artist||'no author given'})`);
    if(dry)continue;
    try{
      const res=await fetch(f.download,{headers:{'User-Agent':AGENT},signal:AbortSignal.timeout(60000)});if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const file=`data/portraits/${p.id}.${f.ext}`;fs.writeFileSync(new URL(file,root),new Uint8Array(await res.arrayBuffer()));
      extra[p.id]={file,credit:creditOf(f.artist,f.license),url:f.page};saved++;
    }catch(e){console.log(`      couldn't download the photo (${e.cause?.code||e.message})`);}
    await new Promise(r=>setTimeout(r,500));
  }
  if(saved){fs.writeFileSync(extraFile,JSON.stringify(extra,null,2)+'\n');console.log(`\nSaved ${saved} ${saved===1?'photo':'photos'} to data/portraits/ and listed them in scripts/portrait-extra.json. Check the FOUND lines are the right people, then commit and push both.`);}
  else console.log(dry?'\nDry run: nothing saved.':'\nNothing saved.');
}
