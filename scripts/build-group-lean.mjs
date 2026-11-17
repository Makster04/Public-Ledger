// Each group's political lean, for coloring its name (public/group-lean.json): red for groups that mostly help
// Republicans, blue for groups that mostly help Democrats, yellow for libertarian groups, grey for bipartisan ones.
// From the FEC bulk files on disk (npm run corporate:pacs downloads them), the last three cycles:
//   helps Republicans  gifts to Republican candidates and spending for them (pas2: 24K, 24E, 24Z), and general-election
//                      spending against Democrats (24A); a Form 5 filer's (FEC ID C9…) spending from the cycle's
//                      independent-expenditure file, the same way
//   helps Democrats    the same, the other way round
// Spending against a candidate in a primary is left out: opposing a Republican in a primary doesn't help Democrats.
//   red    75% or more of its money helps Republicans      blue   75% or more helps Democrats
//   grey   anything between (bipartisan), or a hand-set reason below
//   yellow libertarian: only a group that calls itself libertarian, set by hand below (none of the groups yet)
//   npm run groups:lean
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {lines} from './build-corporate-pacs.mjs';
import {readIeRecords} from './build-super-pac-races.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const LEAN_SHARE=75;
// Set by hand, with the reason shown on the page. Only a reason the money can't show belongs here.
export const LEAN_SET={
  fairshake:{lean:'bipartisan',why:'Only its Republican-side super PAC (Defend American Jobs) is tracked here; the Fairshake network also runs Protect Progress, which backs Democrats.'},
};
export const LEAN_LABEL={republican:'Mostly helps Republicans',democrat:'Mostly helps Democrats',libertarian:'Libertarian',bipartisan:'Bipartisan'};

// One row's side: 'R' or 'D' (or null for another party or an unknown candidate). sup: spending for, or a gift.
export function sideOf(party,sup){
  const p=String(party||'').toUpperCase(),r=/^REP/.test(p),d=/^(DEM|DFL)/.test(p);
  if(!r&&!d)return null;
  return sup?(r?'R':'D'):(r?'D':'R');
}
// The lean from the two totals: {lean, rShare}.
export function leanOf(R,D,set=null){
  const t=R+D,rShare=t?Math.round(R/t*1000)/10:null;
  if(set)return {lean:set.lean,rShare,why:set.why};
  if(rShare==null)return {lean:null,rShare};
  return {lean:rShare>=LEAN_SHARE?'republican':rShare<=100-LEAN_SHARE?'democrat':'bipartisan',rShare};
}

async function main(){
  const dir=process.env.FEC_BULK_DIR||path.join(ROOT,'.local','fec-bulk');
  const research=JSON.parse(fs.readFileSync(path.join(ROOT,'public','research.json'),'utf8'));
  const cycle=Number(JSON.parse(fs.readFileSync(path.join(ROOT,'data','config.json'),'utf8')).cycle)||2026;
  const cycles=[cycle-4,cycle-2,cycle].map(c=>String(c).slice(2));
  const groups=research.groupPos||[],byCmte=new Map();
  for(const g of groups)for(const c of g.fecIds||[])byCmte.set(c.id,g.key);
  const sums=Object.fromEntries(groups.map(g=>[g.key,{R:0,D:0}]));
  const party=new Map(),used=[];
  for(const yy of cycles){
    const cn=path.join(dir,`cn${yy}.zip`),pas2=path.join(dir,`pas2${yy}.zip`);
    if(!fs.existsSync(cn)||!fs.existsSync(pas2)){console.warn(`Skipped 20${yy}: cn${yy}.zip or pas2${yy}.zip isn't in ${dir} (npm run corporate:pacs downloads them).`);continue;}
    used.push(`20${yy}`);
    for await(const line of lines(cn,'cn.txt')){const f=line.split('|');party.set(f[0],f[2]);}
    for await(const line of lines(pas2,'itpas2.txt')){
      const f=line.split('|'),key=byCmte.get(f[0]);if(!key)continue;
      const tp=f[5],amount=Number(f[14])||0;
      const side=['24K','24E','24Z'].includes(tp)?sideOf(party.get(f[16]),true):tp==='24A'&&/^G/.test(f[3]||'')?sideOf(party.get(f[16]),false):null;
      if(side)sums[key][side]+=amount;
    }
  }
  const ie=path.join(dir,`independent_expenditure_${cycle}.csv`);
  if(fs.existsSync(ie))for(const r of await readIeRecords(ie)){
    const key=byCmte.get(r.spe_id);if(!key||!/^C9/.test(r.spe_id))continue;
    if(r.sup_opp!=='S'&&!/^G/i.test(r.ele_type||''))continue;
    const side=sideOf(/REPUBLICAN/i.test(r.cand_pty_aff||'')?'REP':/DEMOCRAT/i.test(r.cand_pty_aff||'')?'DEM':'',r.sup_opp==='S');
    if(side)sums[key][side]+=Number(r.exp_amo)||0;
  }
  if(!used.length)throw new Error(`No FEC bulk files in ${dir}. Run npm run corporate:pacs first.`);
  const out={about:'Each group\'s lean, from which party its PAC gifts and campaign spending helped (FEC bulk files). See scripts/build-group-lean.mjs.',
    built:new Date().toISOString().slice(0,10),cycles:used,share:LEAN_SHARE,groups:{}};
  for(const g of groups){const s=sums[g.key];out.groups[g.key]={...leanOf(s.R,s.D,LEAN_SET[g.key]),R:Math.round(s.R),D:Math.round(s.D)};}
  fs.writeFileSync(path.join(ROOT,'public','group-lean.json'),JSON.stringify(out,null,1)+'\n');
  const n=k=>Object.values(out.groups).filter(x=>x.lean===k).length;
  console.log(`Wrote public/group-lean.json (${used.join(', ')}): ${n('republican')} Republican, ${n('democrat')} Democratic, ${n('bipartisan')} bipartisan, ${n('libertarian')} libertarian, ${n(null)} with no money on file.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exit(1);});
