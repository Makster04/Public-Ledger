import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import * as F from '../src/promise-finder.mjs';
import {statementsOf,voteviewActs,measureOf} from '../scripts/find-promises.mjs';
import {reviewedStatement,didText,addCheck,decidingAct,card} from '../scripts/review-promises.mjs';

const root=new URL('../',import.meta.url);
const research=JSON.parse(fs.readFileSync(new URL('public/research.json',root),'utf8'));
const saved=F.savedVotes(research);
const people=[...research.members,...research.cands,...(research.featured||[])];
const titles=[...saved.map(v=>({key:v.key,title:v.what})),...research.billIndex.map(b=>({key:b.id,title:b.title})),...research.bills.map(b=>({key:b.id,title:b.title}))];
const names=F.billNames(titles),index=F.subjectIndex(saved.map(v=>({key:v.key,text:v.text})));

test('commitments: promises, stances and refusals, not reports or opinions',()=>{
  const lawler=F.commitmentIn('If the Senate reduces the SALT number, I will vote NO, and the bill will fail in the House.');
  assert.deepEqual([lawler.kind,lawler.side,lawler.conditional],['promise','oppose',true]);
  assert.equal(F.commitmentIn('And we will do everything in our power to stop it.').side,'oppose');
  assert.deepEqual(F.commitmentIn('Madam President, I rise in support of the Laken Riley Act.'),{kind:'stance',side:'support',sentence:'Madam President, I rise in support of the Laken Riley Act.',conditional:false});
  assert.equal(F.commitmentIn("I won't vote for a bill that cuts Medicaid.").side,'oppose');
  assert.equal(F.commitmentIn('We will continue to support our allies in Ukraine.').side,'support');
  assert.deepEqual(F.commitmentIn('Ossoff Vows to Block the Nominee','Ossoff')?.kind,'promise');
  assert.equal(F.commitmentIn('Sen. Marshall Introduces the Stop Insider Trading Act','Marshall').side,'support');
  // Reports of what they already did, and opinions, aren't commitments.
  for(const s of ['I voted for the bill last week.',"I don't believe the government should do that.","If we can't build things here, we're in trouble.",'The bill will fail.'])assert.equal(F.commitmentIn(s),null,s);
  assert.deepEqual(F.sentences('I support Roe v. Wade. H.R. 1 passed. Mr. President, I yield.'),['I support Roe v. Wade.','H.R. 1 passed.','Mr. President, I yield.']);
});

test('bills: numbers and names, without the made-up ones',()=>{
  assert.deepEqual(F.billNumbers("From CPR News's 2026 Senate voter guide",'2026-08-01'),[]);
  assert.deepEqual(F.billNumbers('I will vote against H.R. 3746.','2023-05-30'),['118-hr-3746']);
  assert.deepEqual(F.namedBills('We passed the Laken Riley Act.','2025-01-08',names),['119-s-5']);
  assert.deepEqual(F.namedBills('I will not vote for the GENIUS Act as written.','2025-07-10',names),['119-s-1582']);
  assert.deepEqual(F.namedBills('We need fiscal responsibility in Washington.','2023-05-01',names),[]);
  assert.deepEqual(F.namedBills('The One Big Beautiful Bill is a disaster.','2025-06-01',names),['119-hr-1']);
  // A name used in two Congresses: the one sitting when it was said comes first.
  const two=F.billNames([{key:'116-hr-7',title:'Paycheck Fairness Act'},{key:'117-hr-7',title:'Paycheck Fairness Act'}]);
  assert.deepEqual(F.namedBills('I support the Paycheck Fairness Act.','2021-03-01',two),['117-hr-7','116-hr-7']);
});

test('the reviewed quotes: commitments linked by subject to the bill the reviewers chose, and none to a wrong one',()=>{
  const linked=[];
  for(const p of people)for(const s of p.statements||[]){
    const out=F.linkStatement({person:p.id,source:'research',text:s.said.text,date:s.said.date,url:s.said.src?.u},{acts:F.votesOf(p.id,saved),names,index,surname:F.surnameOf(p)});
    const truth=F.checkedBills({statements:[s]},saved);
    for(const x of out){assert.ok(truth.has(x.bill),`${p.id} ${s.said.date} linked to ${x.bill}`);linked.push(`${p.id} ${x.bill} ${x.side} ${x.draft.assessment}`);}
  }
  assert.deepEqual(linked.sort(),['lawler 119-hr-1 oppose contradiction','moore 118-hr-8035 oppose consistent','perry 118-hr-3746 oppose consistent']);
});

test('Lawler: the draft is "broken", but the condition is flagged for the reviewer',()=>{
  const lawler=people.find(p=>p.id==='lawler'),s=lawler.statements.find(x=>/SALT/.test(x.said.text));
  const [x]=F.linkStatement({person:'lawler',source:'research',text:s.said.text,date:s.said.date,url:'u'},{acts:F.votesOf('lawler',saved),names,index,surname:'Lawler'});
  assert.equal(x.link.how,'subject');assert.ok(x.link.words.includes('salt'));
  assert.deepEqual(x.flags,['conditional','subject']);
  assert.equal(x.did.at(-1).date,'2025-07-03');
});

test('draft verdicts from the deciding vote',()=>{
  const v=(vote,question,date='2025-02-01')=>({kind:'vote',vote,question,date});
  assert.equal(F.draftVerdict('support',[v('Yea','On Cloture'),v('Yea','On Passage')]).assessment,'consistent');
  assert.equal(F.draftVerdict('oppose',[v('Yea','On Motion to Suspend the Rules and Pass')]).assessment,'contradiction');
  const cloture=F.draftVerdict('support',[v('Yea','On the Cloture Motion')]);
  assert.deepEqual([cloture.assessment,cloture.flags],['partial',['procedural']]);
  assert.equal(F.draftVerdict('support',[v('Yea','On the Amendment'),v('Nay','On Passage')]).assessment,'contradiction');
  assert.deepEqual(F.draftVerdict('oppose',[v('Not Voting','On Passage')]).flags,['missed']);
  assert.equal(F.draftVerdict('support',[]).assessment,'pending');
  assert.ok(F.draftVerdict('support',[v('Yea','On Passage','2025-01-01'),v('Nay','On Motion to Concur in the Senate Amendment','2025-03-01')]).flags.includes('mixed'));
  assert.deepEqual(['On Passage','On the Cloture Motion','On Motion to Recommit','On the Amendment','On Motion to Concur in the Senate Amendment','On the Nomination'].map(F.voteKind),['final','procedural','procedural','amendment','final','final']);
});

test('floor speeches: only the speaker\'s own turns',()=>{
  const text=F.recordText(`<html><body><pre>
  Mr. SCOTT of Florida. Mr. President, I will vote no.
  The PRESIDING OFFICER. The Senator from South Carolina.
  Mr. SCOTT of South Carolina. Mr. President, I rise in support of this bill.
[[Page S4410]]
I will vote for it.
  Ms. CORTEZ MASTO. Mr. President, I oppose it.
</pre></body></html>`);
  assert.equal(F.speakerText(text,{name:'Tim Scott',stateName:'South Carolina'}),'Mr. President, I rise in support of this bill. I will vote for it.');
  assert.equal(F.speakerText(text,{name:'Rick Scott',stateName:'Florida'}),'Mr. President, I will vote no.');
  assert.equal(F.speakerText(text,{name:'Catherine Cortez Masto',stateName:'Nevada'}),'Mr. President, I oppose it.');
  assert.equal(F.speakerText('No turns here.',{name:'Jon Ossoff'}),'');
  assert.ok(F.ROUTINE.test('Morning Business')&&F.ROUTINE.test('Recognizing the Georgia Bulldogs')&&!F.ROUTINE.test('Laken Riley Act'));
});

test('one review item per person, bill and side, with the later statements listed',()=>{
  const x=(date,u)=>({person:'perry',bill:'118-hr-8035',side:'oppose',said:{text:`t ${date}`,date,src:{t:'s',u}}});
  const [g,...rest]=F.groupFindings([x('2024-04-19','b'),x('2024-04-18','a'),x('2024-04-19','b'),{...x('2024-04-18','c'),side:'support'}]);
  assert.equal(rest.length,1);assert.equal(g.id,'perry|118-hr-8035|oppose');assert.equal(g.said.date,'2024-04-18');assert.deepEqual(g.also.map(a=>a.src.u),['b']);
});

test('collected records as statements, and Voteview roll calls as actions',()=>{
  assert.deepEqual(statementsOf('press','perry',{title:'Perry Opposes Aid',summary:'He will vote no.',date:'2024-04-18T10:00:00Z',url:'https://perry.house.gov/1'}),
    [{person:'perry',source:'press',title:'Perry Opposes Aid',text:'Perry Opposes Aid. He will vote no.',date:'2024-04-18',url:'https://perry.house.gov/1',srcTitle:'Press release: Perry Opposes Aid'}]);
  assert.deepEqual(statementsOf('bluesky','moore',{id:'scan:list',since:2016}),[]);
  const floor=statementsOf('crec-day','CREC',{id:'CREC-2025-11-17-pt1-PgH4500',title:'EPSTEIN FILES TRANSPARENCY ACT',date:'2025-11-17',people:['lawler','perry'],url:'https://www.govinfo.gov/x'});
  assert.deepEqual(floor.map(s=>[s.person,s.title,s.text]),[['lawler','Epstein Files Transparency Act',null],['perry','Epstein Files Transparency Act',null]]);
  const files={members:[{icpsr:'1',bioguide_id:'P000605',chamber:'House'},{icpsr:'2',bioguide_id:'X000001',chamber:'House'}],
    rollcalls:[{rollnumber:'10',clerk_rollnumber:'151',session:'2',date:'2024-04-20',bill_number:'HR8035',vote_question:'On Passage',vote_desc:'Ukraine Security Supplemental Appropriations Act, 2024'},
      {rollnumber:'11',clerk_rollnumber:'152',session:'2',date:'2024-04-20',bill_number:'HR8036',vote_question:'On Passage',vote_desc:'Indo-Pacific Security Supplemental Appropriations Act, 2024'}],
    votes:[{icpsr:'1',rollnumber:'10',cast_code:'6'},{icpsr:'1',rollnumber:'11',cast_code:'9'},{icpsr:'2',rollnumber:'11',cast_code:'1'}]};
  const v=voteviewActs(files,'H',118,[{id:'perry',bioguide:'P000605'}],saved);
  // Roll call 151 is saved in research.json already, so only 152 comes from Voteview.
  assert.deepEqual(v.acts.get('perry').map(a=>[a.key,a.vote,a.url]),[['118-hr-8036','Not Voting','https://clerk.house.gov/Votes/2024152']]);
  assert.equal(measureOf('118-hjres-7'),'H.J.Res. 7');
});

test('a reviewed item becomes a check in the site\'s shape',()=>{
  const item={id:'perry|118-hr-8035|oppose',person:'perry',name:'Scott Perry',bill:'118-hr-8035',measure:'H.R. 8035',title:'Ukraine aid supplemental',side:'oppose',kind:'stance',
    said:{text:'Perry Opposes Another Blank Check for Ukraine',date:'2024-04-18',source:'press',src:{t:'Press release: Perry Opposes Another Blank Check for Ukraine',u:'https://perry.house.gov/1'}},
    link:{how:'subject',score:6,words:['ukraine']},did:[{kind:'vote',vote:'Nay',question:'On passage',date:'2024-04-20',chamber:'H',congress:118,session:2,number:151,url:'https://clerk.house.gov/Votes/2024151'}],
    draft:{assessment:'consistent',label:'kept',why:'Voted Nay (passage, 2024-04-20), as the statement said they would.'},flags:['subject'],also:[]};
  assert.equal(didText(item),'Voted Nay on passage of H.R. 8035, Ukraine aid supplemental (Apr 20, 2024).');
  const st=reviewedStatement(item,'consistent','','2026-11-06');
  assert.deepEqual(st,{topic:'Ukraine aid supplemental (H.R. 8035)',said:{text:'"Perry Opposes Another Blank Check for Ukraine"',date:'2024-04-18',src:item.said.src},
    did:{text:didText(item),date:'2024-04-20',src:{t:'House roll call 151, 2024',u:'https://clerk.house.gov/Votes/2024151'}},assessment:'consistent',note:item.draft.why,found:{by:'promise finder',source:'press',link:'subject',reviewed:'2026-11-06'}});
  const copy=structuredClone({members:[{id:'perry',statements:[]}],cands:[]});
  assert.ok(addCheck(copy,'perry',st));assert.equal(copy.members[0].statements.length,1);assert.equal(addCheck(copy,'nobody',st),false);
  assert.equal(decidingAct([{kind:'vote',vote:'Yea',question:'On Passage',date:'1'},{kind:'vote',vote:'Yea',question:'On the Amendment',date:'2'}]).date,'1');
  assert.match(card(item,0,1),/Check: Linked by subject/);
});

test('npm run promises:find: a whole run on a small database',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'promises-')),dbFile=path.join(dir,'records.sqlite');
  const db=new DatabaseSync(dbFile);db.exec(fs.readFileSync(new URL('migrations/0001_initial.sql',root),'utf8'));
  const job=(id,kind,subject,rows)=>{db.prepare("INSERT INTO jobs(id,kind,subject,args,published_run) VALUES(?,?,?,'{}',?)").run(id,kind,subject,`run-${id}`);
    for(const r of rows)db.prepare('INSERT INTO records(run_id,id,payload) VALUES(?,?,?)').run(`run-${id}`,String(r.id),JSON.stringify(r));};
  job('press:perry','press','perry',[{id:'https://perry.house.gov/1',title:'Perry Opposes Another Blank Check for Ukraine',summary:'"We will vote no on the $61 billion supplemental," Perry said.',date:'2024-04-18',url:'https://perry.house.gov/1'}]);
  job('bluesky:perry','bluesky','perry',[{id:'at://1',handle:'perry.house.gov',text:'I will not vote for the GENIUS Act as written.',date:'2025-07-10',url:'https://bsky.app/profile/perry/post/1'},
    {id:'at://2',handle:'perry.house.gov',text:"From CPR News's 2026 Senate voter guide: I will keep fighting for Pennsylvania.",date:'2026-08-01',url:'https://bsky.app/profile/perry/post/2'}]);
  job('crec-day:CREC-2025-11-17','crec-day','CREC-2025-11-17',[{id:'CREC-2025-11-17-pt1-PgH4500',title:'EPSTEIN FILES TRANSPARENCY ACT',date:'2025-11-17',section:'HOUSE',people:['lawler','perry'],url:'https://www.govinfo.gov/app/details/CREC-2025-11-17/CREC-2025-11-17-pt1-PgH4500'},
    {id:'CREC-2025-11-17-pt1-PgH4400',title:'MORNING-HOUR DEBATE',date:'2025-11-17',section:'HOUSE',people:['lawler'],url:'https://www.govinfo.gov/x'}]);
  db.close();
  fs.mkdirSync(path.join(dir,'speeches'));
  fs.writeFileSync(path.join(dir,'speeches','CREC-2025-11-17-pt1-PgH4500.txt'),'  Mr. LAWLER. Mr. Speaker, I rise in support of this bill, and I will vote for it tomorrow.\n  The SPEAKER pro tempore. The gentleman yields back.\n  Mr. PERRY. Mr. Speaker, I will vote against it.\n');
  const out=path.join(dir,'queue.json');
  const log=execFileSync(process.execPath,['--no-warnings','scripts/find-promises.mjs','--db',dbFile,'--out',out,'--decisions',path.join(dir,'none.json'),'--no-voteview'],{cwd:new URL('.',root),encoding:'utf8',env:{...process.env,CONGRESS_API_KEY:'',GOVINFO_API_KEY:''}});
  assert.match(log,/Floor speeches about a bill the speaker voted on: 2 \(read before 2, read now 0\)/);
  const q=JSON.parse(fs.readFileSync(out,'utf8'));
  assert.deepEqual(q.items.map(x=>`${x.id} ${x.link.how} ${x.draft.assessment}`).sort(),[
    'lawler|119-hr-4405|support named consistent',
    'perry|118-hr-8035|oppose subject consistent',
    'perry|119-hr-4405|oppose named contradiction',
    'perry|119-s-1582|oppose named consistent']);
  assert.ok(!q.items.some(x=>/2026/.test(x.bill)));
  fs.rmSync(dir,{recursive:true,force:true});
});

test('from the first full run: sentences only near a bill, a side on a subject, and an introduced bill are not linked to votes',()=>{
  const names=F.billNames([{key:'119-hr-9340',title:'Ratepayer Protection Act'}]);
  // Fifty other bills, so a word only these two share is as rare as it is among real roll calls.
  const index=F.subjectIndex([{key:'119-hr-9340',text:'Ratepayer Protection Act: utility costs, electricity rates and data centers'},{key:'119-sres-852',text:'A resolution requesting information on Israel\'s human rights practices'},
    ...Array.from({length:50},(_,i)=>({key:`119-hr-${i+1}`,text:`Bill number ${i+1} on highways, farms and post offices`}))]);
  const acts=[{kind:'vote',key:'119-sres-852',date:'2026-09-29',vote:'Nay',question:'On the Motion to Discharge'},{kind:'vote',key:'119-hr-9340',date:'2026-09-30',vote:'Nay',question:'On Cloture on the Motion to Proceed'},{kind:'vote',key:'119-hr-9340',date:'2026-10-02',vote:'Nay',question:'On Passage of the Bill'}];
  const link=(text,title,surname,date='2026-09-30')=>F.linkStatement({person:'x',source:'floor',text,title,date,url:'u'},{acts,names,index,surname});
  // Floor speeches filed under the bill's title, about something else.
  assert.deepEqual(link('I urge my colleagues to join us in taking real action on AI.','Ratepayer Protection Act','Schumer'),[]);
  assert.deepEqual(link('Conversations are taking place about how we will meet this increased energy demand.','Ratepayer Protection Act','Hagerty'),[]);
  // ...and one about the bill.
  const [r]=link('I urge my colleagues to oppose this legislation.','Ratepayer Protection Act','Ricketts');
  assert.deepEqual([r.bill,r.link.how,r.draft.assessment,r.confidence],['119-hr-9340','named','consistent','high']);
  // Support for a country isn't a side on a resolution about it.
  assert.deepEqual(link('Daines Urges Support for Israel on Senate Floor','Daines Urges Support for Israel on Senate Floor','Daines','2026-09-29'),[]);
  // Their own new bill, not a vote on another bill of the same subject.
  assert.deepEqual(link('Heinrich Unveils Bill to Lower Utility Costs, Require Data Centers to Pay Fair Share',null,'Heinrich'),[]);
  const [s]=link('I will vote against the bill that raises utility costs on families.',null,'Smith','2026-09-25');
  assert.deepEqual([s.bill,s.link.how,s.confidence],['119-hr-9340','subject','medium']);
});
