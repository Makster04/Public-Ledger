// The site's news for the ticker and the Latest updates page (scripts/build-news.mjs, public/news.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NEWS_DAYS,GRADES,gradeWhy,gradeNews,promiseNews,lobbyNews,superPacNews,mergeNews} from '../scripts/build-news.mjs';

const NOV14=Date.parse('2026-11-14T15:00:00Z');

test('grade changes: only a grade that moved, newly graded or no longer graded, with the reason in plain words',()=>{
  assert.deepEqual(GRADES,['word','showsup','peoplefirst']);
  const before={a:{word:{pct:67,kept:6,half:0,broken:3,counted:9},showsup:{pct:91,votes:400,missed:20}},b:{word:{pct:null,counted:2}},c:{peoplefirst:{pct:70,actions:10}}};
  const now={a:{word:{pct:85,kept:15,half:0,broken:4,counted:19},showsup:{pct:91,votes:410,missed:21}},b:{word:{pct:74,counted:23}},c:{peoplefirst:{pct:null,actions:2}},d:{word:{pct:null,counted:1}}};
  const g=gradeNews(before,now,'2026-11-14');
  assert.deepEqual(g.map(x=>[x.id,x.grade,x.from,x.to,x.fromLetter,x.toLetter,x.why]),[
    ['a','word',67,85,'D','B','10 more promises checked, 1 broken'],['b','word',null,74,null,'C','23 promises decided'],['c','peoplefirst',70,null,'C',null,'8 fewer scored actions']],
    'Shows Up stayed at 91 and d is still not graded: left out');
  assert.equal(g[0].key,'grade:a:word:67>85');assert.equal(g[0].date,'2026-11-14');
  assert.equal(gradeWhy('showsup',{pct:90,votes:100,missed:5},{pct:85,votes:120,missed:9}),'20 more roll calls, 4 missed');
  assert.equal(gradeWhy('peoplefirst',null,{pct:80,actions:1}),'1 scored action');
});

test('promise checks: reviewed verdicts only, dated by the review, with the promise\'s topic and not its words',()=>{
  const reviews={booker:{'drugs@2021-04-21':{status:'partly',date:'2026-11-13'},'x@2022-01-01':{status:'unclear',date:'2026-11-13'},'y@2022-01-01':{status:'kept'}},
    ossoff:{'prisons@2020-11-03':{status:'alleged',date:'2026-11-13'}}};
  const long='I '+'will fight for this every single day '.repeat(5);
  const p=promiseNews(reviews,{booker:[{key:'drugs@2021-04-21',qs:[['decriminalize-drugs',0]],quote:'I support decriminalization.'}],ossoff:[{key:'prisons@2020-11-03',quote:long}]});
  assert.deepEqual(p.map(x=>[x.id,x.status,x.date]),[['booker','partly','2026-11-13'],['ossoff','alleged','2026-11-13']],'unclear and undated reviews left out');
  assert.deepEqual(p.map(x=>x.topic),['decriminalize-drugs','prisons'],'the question it\'s checked against, else the start of its key');
  assert.ok(p.every(x=>!('quote' in x)),'no quotes');
  assert.equal(p[0].key,'promise:booker:drugs@2021-04-21:partly','a changed verdict is new news');
});

test('the trackers\' PAC checks: one item per PAC, date and amount, with every member who got it',()=>{
  const c=(id,amount,date='2026-10-07',cmte='C00142711')=>({cmte,pac:'THE BOEING COMPANY PAC',id,amount,date,keys:['defense']});
  const l=lobbyNews([c('clyburn',5000),c('meng',5000),c('meng',5000),c('tonko',1000,'2026-10-12'),c('x',-500),{...c('y',1000),keys:[]}]);
  assert.deepEqual(l.map(x=>[x.date,x.amount,x.ids]),[['2026-10-12',1000,['tonko']],['2026-10-07',5000,['clyburn','meng']]],'newest first; a refund and an unmatched PAC left out');
  assert.deepEqual([l[1].tracker,l[1].pac,l[1].key],['defense','THE BOEING COMPANY PAC','lobby:C00142711:2026-10-07:5000']);
});

test('the trackers\' super PACs: a day\'s spending for or against a candidate, at its latest amendment, $10,000 or more',()=>{
  const r=(o)=>({spe_id:'C00836221',spe_nam:'DEFEND AMERICAN JOBS',cand_id:'S4NE00207',cand_name:'OSBORN, DAN',can_office:'S',can_office_state:'NE',can_office_dis:'00',cand_pty_aff:'INDEPENDENT',sup_opp:'O',ele_type:'G2026',exp_amo:'1000000',exp_date:'27-OCT-26',file_num:'1',tran_id:'t1',...o});
  const s=superPacNews([r({}),r({file_num:'2',exp_amo:'2000000'}),r({tran_id:'t2',exp_amo:'650335.68'}),r({tran_id:'t3',exp_amo:'5000',exp_date:'28-OCT-26'}),
    r({tran_id:'t4',spe_id:'C9',spe_nam:'SOME OTHER PAC',exp_amo:'9000000'})]);
  assert.deepEqual(s.map(x=>[x.tracker,x.cand,x.so,x.seat,x.party,x.ele,x.amount,x.date]),[['crypto','S4NE00207','O','S-NE','I','G',2650335.68,'2026-10-27']],
    'the amendment replaces the original and the day adds up; under $10,000 and another spender left out');
});

test('merging with the last file: first-file items go by their own date, later ones are stamped, nothing past 45 days',()=>{
  assert.equal(NEWS_DAYS,45);
  const a={key:'a',kind:'promise',date:'2026-11-13'},b={key:'b',kind:'lobby',date:'2026-10-07'},old={key:'o',kind:'lobby',date:'2026-09-01'};
  const first=mergeNews(null,[a,b,old],{now:NOV14});
  assert.deepEqual(first.map(x=>[x.key,x.seen]),[['a',null],['b',null]],'the first file: no stamps; a check from Sept. 1 is past 45 days');
  const c={key:'c',kind:'lobby',date:'2026-10-05'},later=NOV14+864e5;
  const second=mergeNews({items:first},[a,c],{now:later});
  assert.deepEqual(second.map(x=>[x.key,x.seen]),[['c',new Date(later).toISOString()],['a',null],['b',null]],
    'a new item read today is today\'s news, though its own date is older; one not found again stays');
  const stale={key:'s',kind:'lobby',date:'2026-09-29'};
  assert.ok(!mergeNews({items:second},[a,stale],{now:later}).some(x=>x.key==='s'),'an old check found again once out of the window: not news');
  const gone=mergeNews({items:second},[],{now:later+50*864e5});
  assert.deepEqual(gone,[],'all past 45 days');
});

test('the news file on hand: built from the site\'s own files, items newest first and within 45 days of its build',()=>{
  const n=JSON.parse(fs.readFileSync(new URL('../public/news.json',import.meta.url),'utf8'));
  assert.ok(n.built&&Array.isArray(n.items));
  const at=x=>Date.parse(x.seen||`${String(x.date).slice(0,10)}T12:00:00Z`),built=Date.parse(n.built+'T23:59:59Z');
  for(let i=1;i<n.items.length;i++)assert.ok(at(n.items[i-1])>=at(n.items[i]),'newest first');
  assert.ok(n.items.every(x=>['grade','promise','lobby','superpac'].includes(x.kind)&&built-at(x)<=(NEWS_DAYS+1)*864e5));
  assert.equal(new Set(n.items.map(x=>x.key)).size,n.items.length,'each once');
});
