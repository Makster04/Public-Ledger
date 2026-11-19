// For tests only: the site's data with the people taken off it on Nov. 19, 2026 (data/removed.json) put back from
// test/fixtures/removed-2026.json, as the data was the day before. Many tests use them as worked examples (Collins
// above all); the site itself no longer has them.
import fs from 'node:fs';

const F=JSON.parse(fs.readFileSync(new URL('./removed-2026.json',import.meta.url),'utf8'));
const read=f=>JSON.parse(fs.readFileSync(new URL(`../../${f}`,import.meta.url),'utf8'));
export const REMOVED=F;
export function withRemovedResearch(D=read('public/research.json')){
  const have=new Set([...D.members,...D.cands].map(p=>p.id));
  D.members=[...D.members,...F.research.members.filter(p=>!have.has(p.id))];
  D.cands=[...D.cands,...F.research.cands.filter(p=>!have.has(p.id))];
  for(const [list,pos] of [['votes',F.research.votes],['hvotes',F.research.hvotes]])for(const v of D[list]||[])if(pos[v.id])v.pos={...v.pos,...pos[v.id]};
  if(D.bundled){D.bundled.people={...D.bundled.people,...F.research.bundled.people};D.bundled.listed={...D.bundled.listed,...F.research.bundled.listed};}
  return D;
}
export function withRemovedConfig(C=read('data/config.json')){
  const have=new Set(C.people.map(p=>p.id));C.people=[...C.people,...F.config.people.filter(p=>!have.has(p.id))];return C;
}
export function withRemovedHouse(H=read('public/house.json')){
  const have=new Set(H.members.map(m=>m.bioguide));
  H.members=[...H.members,...F.house.members.filter(m=>!have.has(m.bioguide))].sort((a,b)=>String(a.state).localeCompare(String(b.state))||(Number(a.district)||0)-(Number(b.district)||0));
  return H;
}
export function withRemovedSenate(S=read('public/senate.json')){
  const have=new Set(S.senators.map(m=>m.bioguide));
  S.senators=[...S.senators,...F.senate.senators.filter(m=>!have.has(m.bioguide))].sort((a,b)=>String(a.state).localeCompare(String(b.state))||String(a.name).localeCompare(String(b.name)));
  return S;
}
export function withRemovedCommittees(C=read('public/committees.json')){C.people={...C.people,...F.committees.people};return C;}
