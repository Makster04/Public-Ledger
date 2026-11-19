// Who won each of the House's 435 seats on Nov. 3, 2026, so the home page counts the House as it sits from Jan. 3, 2027
// (public/house-seats.json). Two Wikipedia sources, as scripts/build-members-elect.mjs reads them:
//   - each state's page of 2026 House elections: a district's winner as its election box marks it (in bold: the name,
//     the votes or the share; else the winning candidate of its general-election results table). This finds a member
//     who moved districts in redistricting: Ami Bera won CA-3 after representing CA-6, Debbie Wasserman Schultz FL-20
//     after FL-25;
//   - the "List of new members of the 120th United States Congress": every winner who isn't a member now. A district
//     it doesn't list, whose page has no result yet (some states' pages weren't filled in), is held by its member when
//     they were on the ballot: "returning", marked unconfirmed.
// Each winner is matched to the site's people: a member-elect (public/members-elect.json), a reviewed profile
// (public/research.json), or a sitting member of the same state (by name). A district data/members-elect-skip.json lists
// (a runoff, a race not called) waits, with its reason, whatever the page shows.
//   npm run house:seats               read the pages again (about a minute)
//   npm run house:seats -- --cached   use the pages saved last time (.local/wiki)
// The six delegates are elected on pages of their own and aren't read here; the page keeps a delegate unless a
// member-elect takes their seat.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {STATES,districtSection,electionBox,plain,wiki,statePage,newMembers} from './build-members-elect.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const LIST='List_of_new_members_of_the_120th_United_States_Congress';
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
const lastOf=name=>norm(String(name).replace(/,?\s+(jr|sr|ii|iii|iv)\.?\s*$/i,'')).split(' ').at(-1);
const firstOf=name=>norm(name).split(' ')[0];
export const seatKey=(st,d)=>`${st}-${d==='AL'||!Number(d)?0:Number(d)}`;
// A name as a page writes it, without notes: "Maxwell Frost; (Uncontested)" -> "Maxwell Frost".
export const cleanName=s=>String(s||'').replace(/\s*[;(].*$/,'').replace(/\s*\((incumbent|write-in)\)\s*$/i,'').trim();

// The districts a state page has: "District 7" headings, or one at-large district.
export function districtsOn(text){
  const ds=[...String(text||'').matchAll(/\n==\s*District (\d+)\s*==/g)].map(m=>String(Number(m[1])).padStart(2,'0'));
  return ds.length?[...new Set(ds)]:(/\{\{Infobox election/.test(text||'')?['AL']:[]);
}
// A template's "| key = value" lines.
const fieldsOf=t=>{const f={};for(const m of String(t||'').matchAll(/^\s*\|\s*([\w ]+?)\s*=\s*(.*)$/gm))f[m[1]]=m[2].trim();return f;};
// A district's winner ({name, party}), or null while there is none.
export function boldWinner(sec){
  const ib=fieldsOf(/\{\{Infobox election([\s\S]*?)\n\}\}/.exec(sec||'')?.[1]),box=electionBox(sec);
  for(let i=1;i<=8;i++){const raw=ib['nominee'+i]||ib['candidate'+i];if(!raw)continue;
    if(![raw,ib['popular_vote'+i],ib['percentage'+i]].some(v=>/'''/.test(v||'')))continue;
    const name=cleanName(plain(raw));return {name,party:box.nominees.find(n=>cleanName(n.name)===name)?.party||null};}
  const gen=/\n===+\s*General election\s*===+([\s\S]*)/i.exec(sec||'')?.[1]||'';
  const win=/\{\{Election box winning candidate[^\n|]*([\s\S]*?)\n\s*\}\}/i.exec(gen)?.[1];
  if(win){const f=fieldsOf(win),name=cleanName(plain(f.candidate)),p=plain(f.party);
    if(name)return {name,party:/Democratic/.test(p)?'D':/Republican/.test(p)?'R':p?'I':null};}
  return null;
}
// The nominees an election box lists (a district whose page has no result yet still names them).
export const nomineesOf=sec=>electionBox(sec).nominees.map(n=>cleanName(n.name));
// The site's person for a winner: a member-elect of that seat, a reviewed profile who won the seat's race, or a sitting
// House member of the same state with the same last name (their first name decides between two, then the seat).
export function matchWinner(w,seat,{elect=[],profiles=[],house=[]}={}){
  const st=seat.split('-')[0],same=n=>lastOf(n)===lastOf(w.name);
  const e=elect.find(m=>seatKey(...String(m.seat).split('-'))===seat&&same(m.name));if(e)return {id:e.id,via:'elect'};
  const p=profiles.find(x=>x.seat===seat&&same(x.name));if(p)return {id:p.id,via:'profile'};
  let h=house.filter(m=>m.state===st&&same(m.name));
  if(h.length>1)h=h.filter(m=>firstOf(m.name)===firstOf(w.name)||firstOf(m.name).startsWith(firstOf(w.name))||firstOf(w.name).startsWith(firstOf(m.name)));
  if(h.length>1)h=h.filter(m=>seatKey(m.state,m.district)===seat);
  return h.length===1?{id:h[0].id,via:'member'}:null;
}
// One seat: waiting (skip), the page's winner, or its member returning when no new member is listed for it.
export function seatOf({seat,sec,skip,listed,ctx}){
  if(skip)return {pending:skip};
  const w=boldWinner(sec);
  if(w){const who=matchWinner(w,seat,ctx);return {name:w.name,party:w.party,...(who||{id:null,via:null})};}
  // A new member the list names for the seat: their member-elect profile, when the site has it.
  if(listed){const who=matchWinner({name:listed},seat,{...ctx,house:[]});return who?{name:listed,party:(ctx.elect||[]).find(m=>m.id===who.id)?.party||null,...who}:{name:listed,party:null,id:null,via:null};}
  const st=seat.split('-')[0],noms=nomineesOf(sec);
  const m=(ctx.house||[]).find(x=>seatKey(x.state,x.district)===seat&&noms.some(n=>lastOf(n)===lastOf(x.name)));
  return m?{name:m.name,party:m.party,id:m.id,via:'member',unconfirmed:'No result on Wikipedia\'s page yet, and no new member listed for the seat'}
    :{pending:`No result on Wikipedia's page yet${st?'':''}`};
}

async function main(){
  const cached=process.argv.includes('--cached'),read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
  const E=read('public/members-elect.json'),house=read('public/house.json').members,D=read('public/research.json');
  const skip=read('data/members-elect-skip.json').skip||{};
  // Reviewed House profiles: their seat from their race (a profiled race "H-VA-02", or their own district).
  const profiles=[];
  for(const r of [...D.races,...(D.liteRaces||[]),...E.races]){const m=/^H-([A-Z]{2})-(\w+)$/.exec(r.id);if(!m||r.chamber!=='H')continue;
    const w=r.result?.winner,p=[...D.members,...D.cands].find(x=>x.id===w||(x.fecCand&&x.fecCand===w));if(p)profiles.push({id:p.id,name:p.name,seat:seatKey(m[1],m[2])});}
  for(const c of D.cands)if(c.chamber==='H'&&/^[A-Z]{2}-\w+$/.test(c.district||''))profiles.push({id:c.id,name:c.name,seat:seatKey(...c.district.split('-'))});
  const listed=new Map(newMembers(await wiki(LIST,cached)).map(r=>{const [st,d]=r.district.split('-');return [seatKey(st,d),`${r.first} ${r.last}`];}));
  const ctx={elect:E.members,profiles,house},seats={};
  for(const st of Object.keys(STATES)){
    let text='';try{text=await wiki(statePage(st,'1'),cached);}catch(e){console.log(`  ${st}: ${e.message}`);}
    if(st==='CA')text+='\n'+await wiki(statePage('CA','40'),cached).catch(()=>'');
    const ds=districtsOn(text);if(!ds.length){console.log(`  ${st}: no districts found`);continue;}
    for(const d of ds){const seat=seatKey(st,d);seats[seat]=seatOf({seat,sec:districtSection(text,d),skip:skip[`${st}-${d}`],listed:listed.get(seat),ctx});}
  }
  const out={about:'Who won each House seat on Nov. 3, 2026, matched to the site\'s people (id; via: member, elect or profile), for the home page\'s count of the House from Jan. 3, 2027. unconfirmed: a member counted as returning because their state\'s page had no result yet and no new member is listed for the seat. pending: a seat without a winner yet, and why. From scripts/build-house-seats.mjs (npm run house:seats), reading Wikipedia\'s 2026 House election pages and its list of new members.',
    built:new Date().toISOString().slice(0,10),source:{pages:'https://en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_elections',list:`https://en.wikipedia.org/wiki/${LIST}`},
    seats:Object.fromEntries(Object.entries(seats).sort(([a],[b])=>a.localeCompare(b,'en',{numeric:true})))};
  fs.writeFileSync(path.join(ROOT,'public','house-seats.json'),JSON.stringify(out,null,1)+'\n');
  const all=Object.entries(seats),pending=all.filter(([,x])=>x.pending),unconf=all.filter(([,x])=>x.unconfirmed),missing=all.filter(([,x])=>x.name&&!x.id);
  console.log(`${all.length} seats: ${all.length-pending.length-missing.length} with a winner on the site (${unconf.length} of them returning members not confirmed on Wikipedia yet), ${missing.length} winners without a profile here, ${pending.length} not decided. Wrote public/house-seats.json.`);
  if(pending.length)console.log(`Not decided yet:\n  ${pending.map(([k,x])=>`${k}: ${x.pending}`).join('\n  ')}`);
  if(missing.length)console.log(`Winners without a profile on the site (npm run house:elect adds members-elect; check data/members-elect-skip.json):\n  ${missing.map(([k,x])=>`${k} ${x.name}`).join('\n  ')}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exit(1);});
