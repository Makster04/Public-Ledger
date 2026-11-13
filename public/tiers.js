// Tiers (the Trackers page's second tab, approved 2026-11-13, five tiers the same day): where each sitting member stands
// on each tracker's money this cycle, against the typical member of their own chamber who took some. From the FEC bulk
// files the seating charts use (public/corporate-pacs.json, scripts/build-corporate-pacs.mjs), so every member is read
// the same way.
//   far     far above average: more than 3 × the typical amount (the median among the members of the chamber who took
//           any)
//   above   from 1.5 to 3 × the typical amount
//   about   from half to 1.5 × the typical amount
//   below   less than half of it
//   none    none this cycle
// A member's amount is the total the tracker's PACs gave their campaign this cycle, plus, for AIPAC, the gifts it
// collected from donors and passed on (when the file has them): not a career total, a share of what they raised, super
// PAC spending or employees' own gifts. Senators are compared with senators and House members with House members,
// since Senate campaigns raise far more. A member the file hasn't read isn't placed. Shown only; no grade uses it.
export const TIER_KEYS=['far','above','about','below','none'];
export const TIER_LABEL={far:'Far Above Average',above:'Above Average',about:'About Average',below:'Below Average',none:'None'};
export const TIER_FAR=3,TIER_ABOVE=1.5,TIER_BELOW=0.5;

// A member's money from a tracker this cycle: null when the file hasn't read them.
export function trackerAmount(cp,key,id){
  if(!cp?.people?.[id])return null;
  const v=cp.trackers?.[key]?.[id];
  return v?Math.max(0,(Number(v[0])||0)+(Number(v[2])||0)):0;
}
export function median(xs){
  const s=[...xs].sort((a,b)=>a-b);if(!s.length)return null;
  const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;
}
// The tier for an amount, given the chamber's typical amount (null: not read).
export function tierOf(amount,typical){
  if(amount==null)return null;
  if(!(amount>0))return 'none';
  if(!(typical>0))return 'about';
  return amount>TIER_FAR*typical?'far':amount>TIER_ABOVE*typical?'above':amount>=TIER_BELOW*typical?'about':'below';
}
// One chamber's tiers for one tracker. members: [{id, name, ...}]. Returns {typical, took, read, tiers: {above: [{m,
// amount}], ...} (largest first, then by name), byId: {id: tier}, notRead: [members]}.
export function chamberTiers(cp,key,members){
  const rows=(members||[]).map(m=>({m,amount:trackerAmount(cp,key,m.id)}));
  const read=rows.filter(r=>r.amount!=null),typical=median(read.filter(r=>r.amount>0).map(r=>r.amount));
  const tiers=Object.fromEntries(TIER_KEYS.map(k=>[k,[]])),byId={};
  for(const r of read){const t=tierOf(r.amount,typical);tiers[t].push(r);byId[r.m.id]=t;}
  for(const list of Object.values(tiers))list.sort((a,b)=>b.amount-a.amount||String(a.m.name).localeCompare(String(b.m.name)));
  return {typical,took:read.filter(r=>r.amount>0).length,read:read.length,tiers,byId,notRead:rows.filter(r=>r.amount==null).map(r=>r.m)};
}
