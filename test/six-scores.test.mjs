import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {leanLabel,issueLeans,ideology,ratingsLean,dwLean,keepsTheirWord,showsUp,unbought,unboughtPledges,stockHoldings,aboveBoard,tradeConflicts,behaviorCci,peopleFirst,SIX} from '../public/six-scores.js';
import {makeScorer} from '../public/scoring.js';

const read=f=>JSON.parse(fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8'));

test('Ideology: a lean on each left–right issue, the overall average, and the two checks',()=>{
  assert.deepEqual([-100,-61,-60,-20,0,20,21,60,61,100,null].map(leanLabel),['Very liberal','Very liberal','Liberal','Moderate','Moderate','Moderate','Conservative','Conservative','Very conservative','Very conservative',null]);
  const issues=[{id:'guns',label:'Guns',liberalSide:'A'},{id:'taxes',label:'Taxes',liberalSide:'A'},{id:'imm',label:'Immigration',liberalSide:'B'},{id:'tariffs',label:'Tariffs',liberalSide:null,leanNote:'Not left–right'}];
  const vote=(side,bill)=>({type:'senate_vote',side,bill});
  const person={evidence:{
    guns:[vote('B','a'),vote('B','b'),vote('A','c'),vote('B','d')],           // 3 conservative, 1 liberal: +50
    taxes:[vote('B','e'),{type:'stated',side:'A'}],                            // the vote counts, the statement doesn't: +100
    imm:[{type:'stated',side:'B'},{type:'stated',side:'B'}],                    // statements only, both liberal (B): −100
    tariffs:[vote('A','f')]}};                                                 // shown, no lean
  const leans=issueLeans(person,issues);
  assert.deepEqual(leans.map(x=>[x.id,x.lean,x.basis]),[['guns',50,'record'],['taxes',100,'record'],['imm',-100,'statements'],['tariffs',null,'record']]);
  assert.equal(leans[3].cross,true);
  const x=ideology({...person,ideo:{dim1:0.45}},issues,{ratings:[{org:'NRA',lean:'conservative',grade:'A'},{org:'LCV',lean:'liberal',score:20},{org:'AFL-CIO',lean:'liberal',score:30}]});
  assert.deepEqual([x.lean,x.label,x.dw,x.ratings.lean],[17,'Moderate',45,67]);
  // Fewer than three left–right issues: no overall lean.
  assert.equal(ideology({evidence:{guns:person.evidence.guns}},issues).lean,null);
  assert.equal(dwLean(null),null);
  assert.deepEqual(ratingsLean([{org:'X',lean:'liberal'}]),{lean:null,rows:[]});
});

test('Keeps Their Word and Shows Up: the examples in the proposal',()=>{
  const st=a=>({assessment:a});
  // 4 kept, 2 partially kept (one a compromise), 1 broken: 100 × (4 + 0.5 + 0.5) ÷ 7 = 71.
  const w=keepsTheirWord({statements:[st('consistent'),st('consistent'),st('consistent'),st('consistent'),st('partial'),st('compromise'),st('contradiction'),{assessment:'consistent',debate:true}]});
  assert.deepEqual([w.pct,w.letter],[71,'C']);
  assert.deepEqual(w.parts.find(p=>p.key==='partly'),{key:'partly',label:'Partially kept (½)',value:2});
  assert.deepEqual(w.parts.map(p=>p.key),['kept','partly','broken','alleged','clear'],'four verdicts, and the count');
  assert.equal(keepsTheirWord({statements:[st('consistent')]}).pct,null);
  const attendance={source:'https://voteview.com/data',people:{x:{years:{2025:{votes:100,missed:2}},spans:[],missed:{}}},days:{}};
  const getItDone={people:{x:{congresses:{119:{chamber:'S',party:'D',sponsored:10,advanced:4}}}},medians:{119:{S:{D:0.2}}}};
  const u=showsUp({id:'x'},{attendance,getItDone,asOfYear:2026});
  assert.deepEqual([u.pct,u.letter,u.parts.map(p=>p.value)],[93,'A',[90,100]]);
  // Without Get It Done, Attendance alone.
  assert.equal(showsUp({id:'x'},{attendance,getItDone:null,asOfYear:2026}).pct,90);
  assert.equal(showsUp({id:'y'},{attendance,getItDone,asOfYear:2026}).pct,null);
});

// The proposal's Big Money Independence example: a House member who raised $2 million.
const member={id:'m',chamber:'H',statements:[],camp:{receipts:2_000_000,indiv:1_600_000,unitemized:1_000_000,itemized:600_000,pac:400_000,self:0,transfers:0,start:'2025-01-01',end:'2026-10-14'}};
const sizes={start:'2025-01-01',end:'2026-10-14',notSorted:0,brackets:[{size:0,total:1_000_000},{size:200,total:0},{size:500,total:0},{size:1000,total:0},{size:2000,total:600_000}]};
const snapshot={year:2025,url:'https://disclosures-clerk.house.gov/x.pdf',assets:[{name:'Acme Corp',type:'Stock',value:'$200,000'},{name:'Index fund',type:'Mutual fund',value:'$1,001 - $15,000'}]};
const trades={covered:true,rows:Array.from({length:10},(_,i)=>({traded:`2025-0${1+(i%9)}-15`,low:1001,high:15000}))};
const bills=[{id:'119-hr-1',reform:['stock-trading'],cosponsors:[{person:'m'}]}];
test('Big Money Independence: their published formula, with the House weights',()=>{
  const pledges=unboughtPledges(member,bills);
  assert.deepEqual(pledges.map(p=>[p.kind,p.points,p.via]),[['corporate-pac',0,null],['lobbying',0,null],['stock-trading',1,'bill'],['citizens-united',0,null]]);
  // A reform bill they introduced counts like one they cosponsored, even when the bill's own sponsor list doesn't have them.
  const own=unboughtPledges({...member,bills:[{congress:118,num:'H.R. 7'}]},[{id:'119-hr-2',versions:['118-hr-7'],reform:['lobbying']}]);
  assert.deepEqual([own[1].points,own[1].via,own[1].how],[1,'bill','sponsored']);
  const u=unbought(member,{sizes,pacRows:[{kind:'corporate',amount:300_000},{kind:'labor',amount:100_000}],earmarks:[{group:'J Street',amount:50_000},{group:'ActBlue',amount:9e6}],snapshot,trades,pledges});
  assert.deepEqual(Object.fromEntries(u.parts.map(p=>[p.key,p.points])),{donor:8.6,pac:-4.6,reliance:-5,earmarks:-1,stocks:-7.5,trades:-4.6,bonuses:0,pledges:1});
  assert.deepEqual([u.pct,u.letter],[62,'D']);
  // The stock terms are never dropped: without the disclosure there is no grade, only the parts read so far.
  const waiting=unbought(member,{sizes,pacRows:[{kind:'corporate',amount:300_000}],snapshot:null,trades,pledges});
  assert.equal(waiting.pct,null);assert.match(waiting.why,/annual financial disclosure hasn't been read/);
  // No PAC money, no individual stocks: both bonuses.
  const clean=unbought({...member,camp:{...member.camp,pac:0}},{sizes,pacRows:[],snapshot:{assets:[{name:'Fund',type:'Mutual fund',value:'$1,001 - $15,000'}]},trades:{covered:true,rows:[]},pledges:[]});
  assert.deepEqual(clean.parts.find(p=>p.key==='bonuses').points,6);
  // The Senate's weights: smaller donor weights and per-dollar PAC rates.
  const sen=unbought({...member,chamber:'S'},{sizes,pacRows:[{kind:'corporate',amount:400_000}],snapshot,trades,pledges});
  assert.deepEqual([sen.parts[0].points,sen.parts[1].points],[7.6,-4]);
  // An open-ended value on their report, or a blind trust.
  assert.match(stockHoldings({assets:[{name:'Acme',type:'Stock',value:'Over $50,000,000'}]}).why,/open-ended/);
  assert.equal(stockHoldings(null,{status:'blind-trust'}).value,0);
  assert.match(unbought({...member,office:'President'}).why,/president/);
});

test('Plays by the Rules: the four indexes, rescaled over the ones available, minus Legal Trouble',()=>{
  const rows=Array.from({length:20},(_,i)=>({traded:'2025-03-01',filed:i<5?'2025-05-01':'2025-03-20',asset:'stock',amount:'$1,001 - $15,000',sector:i<10?'Energy':'Tech',flag:i<8?'near a vote':null}));
  const person={id:'p',ethicsSearched:'Searched court, ethics and DOJ records, 2026-11-01',ethics:[{status:'investigation',stage:'closed',kind:'ethics'}]};
  const a=aboveBoard(person,{trades:{rows,covered:true,overseen:['Energy'],inDonors:4}});
  // Trade Conflicts = 0.45 × 50 + 0.30 × 40 + 0.25 × 20 = 39.5 → 40; Dodger = 25 (5 of 20 late).
  assert.deepEqual([a.tradeConflicts.index,a.dodger.index],[40,25]);
  // 100 − (0.25 × 40 + 0.20 × 25) ÷ 0.45 − 5 = 61.7.
  assert.deepEqual([a.pct,a.letter],[62,'D']);
  assert.deepEqual(a.parts.map(p=>p.points),[null,null,-22.2,-11.1,-5]);
  // Legal records alone aren't enough; no review, no grade.
  assert.match(aboveBoard(person,{}).why,/None of the four indexes/);
  assert.match(aboveBoard({...person,ethicsSearched:''},{trades:{rows,covered:true}}).why,/legal record/);
  // Fewer than 5 trades: no Trade Conflicts; covered with none: 0.
  assert.equal(tradeConflicts(rows.slice(0,3)).index,null);
  assert.equal(tradeConflicts([]).index,0);
});

test('People First: legislative action and the behavior-only CCI',()=>{
  const cci=behaviorCci({businessVotes:{index:50},lobbied:{profit:3,n:14}});
  assert.equal(cci.index,40);
  const p=peopleFirst({pct:70,n:10,nPeople:7,nProfit:3},cci);
  assert.deepEqual([p.pct,p.letter],[68,'D']);
  assert.equal(peopleFirst({pct:70,n:10},behaviorCci({})).pct,70);
  assert.equal(peopleFirst({pct:null,n:1},cci).pct,null);
});

test('every profile: the six scores compute without errors and say why one isn\'t graded',()=>{
  const r=read('public/research.json');
  const sc=makeScorer(r,read('public/committees.json'),read('public/committee-sectors.json').committees||{},read('public/vote-party.json').votes);
  const ctx={attendance:read('public/attendance.json'),getItDone:read('public/get-it-done.json')};
  for(const s of [...r.members,...r.cands]){
    const x=sc.six(s,ctx);
    for(const k of ['word','showsup','aboveboard','peoplefirst']){
      const g=x[k];assert.ok(g.pct==null?typeof g.why==='string'&&g.why.length>0:g.pct>=0&&g.pct<=100,`${s.id} ${k}`);
    }
    assert.ok(x.ideology.lean==null||Math.abs(x.ideology.lean)<=100,s.id);
  }
  assert.deepEqual(SIX.map(x=>x.key),['ideology','word','showsup','unbought','aboveboard','peoplefirst']);
});

test('the Ideology number is in the color of its place on the bar, wherever it shows',async()=>{
  const fs=await import('node:fs');
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../public/remake.css',import.meta.url),'utf8');
  // The bar: blue at −100, its dark middle at 0, red at +100. The number: the same share of blue or red, with the light
  // text gray in place of the dark middle so it stays readable.
  assert.match(css,/\.st-scale-bar \{[^}]*linear-gradient\(90deg, var\(--dem\), var\(--surface-2\) 50%, var\(--rep\)\)/);
  const leanColor=new Function(`${app.match(/const leanColor=[\s\S]*?\};/)[0]};return leanColor;`)();
  assert.equal(leanColor(-100),'color-mix(in oklab, var(--dem) 100%, var(--ink-2))');
  assert.equal(leanColor(-14),'color-mix(in oklab, var(--dem) 14%, var(--ink-2))');
  assert.equal(leanColor(0),'var(--ink-2)');
  assert.equal(leanColor(67),'color-mix(in oklab, var(--rep) 67%, var(--ink-2))');
  assert.equal(leanColor(250),'color-mix(in oklab, var(--rep) 100%, var(--ink-2))');
  assert.equal(leanColor(null),'');
  // The home cards and profile tiles, the Ideology tab, and the Scores ranking.
  assert.match(app,/<b class="lean"\$\{leanStyle\(i\.lean\)\}>/);
  assert.match(app,/<b\$\{leanStyle\(x\.lean\)\}>\$\{signed\(x\.lean\)\}<\/b><span>/);
  assert.match(app,/'Not placed yet':`<b\$\{leanStyle\(x\.lean\)\}>\$\{signed\(x\.lean\)\} ?<\/b> · /);
});
