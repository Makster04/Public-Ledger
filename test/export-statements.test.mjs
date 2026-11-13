// npm run statements:export (scripts/export-statements.mjs): the statements the local refresh collected, as the sentences
// on the questions' topics, for tagging; and the finder reading them (scripts/question-statements.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {exportStatements,whereOf,readSpeeches,HOUR,RETRY_WAITS,MAX_SKIPPED} from '../scripts/export-statements.mjs';
import {searchTests,collectedDocs,statementCandidates,campaignOf,cycleOf} from '../scripts/question-statements.mjs';

const root=new URL('../',import.meta.url);
const tests=searchTests({'ukraine-aid':{any:['ukraine']},'minimum-wage':{any:['minimum wage']}});

test('only the sentences on a question\'s topic are kept, a statement with none is left out, each once',()=>{
  const out=exportStatements([
    {person:'perry',source:'press',title:'Perry Opposes Aid',text:'Perry Opposes Aid. I will vote against another blank check for Ukraine. The weather is nice today in Harrisburg.',date:'2024-04-18',url:'https://perry.house.gov/1'},
    {person:'perry',source:'press',title:'Perry Opposes Aid',text:'Perry Opposes Aid. I will vote against another blank check for Ukraine.',date:'2024-04-18',url:'https://perry.house.gov/1'},
    {person:'perry',source:'bluesky',text:'Happy Fourth of July to everyone in the district.',date:'2025-07-04',url:'https://bsky.app/1'},
    {person:'perry',source:'floor',title:'Raise The Wage Act',text:'Mr. Speaker, raising the minimum wage would cost jobs in Pennsylvania.',granule:'CREC-1',date:'2025-03-01',url:'https://www.govinfo.gov/1'}],tests);
  assert.deepEqual(out.perry.statements.map(s=>[s.date,s.source,s.where,s.sentences]),[
    ['2025-03-01','floor','Floor speech, Congressional Record: Raise The Wage Act',['Mr. Speaker, raising the minimum wage would cost jobs in Pennsylvania.']],
    ['2024-04-18','press','Press release: Perry Opposes Aid',['I will vote against another blank check for Ukraine.']]]);
  assert.deepEqual(out.perry.counts,{floor:1,press:1,bluesky:0,threads:0});
  assert.equal(whereOf({source:'threads'}),'Threads post');
});

test('the finder reads the export, and a statement outside a campaign site belongs to the election its date leads up to',()=>{
  const docs=collectedDocs({statements:[{date:'2025-03-01',source:'press',where:'Press release: Raise the wage',url:'https://x/1',sentences:['We must raise the minimum wage to $17 an hour.']},{date:'2024-01-01',source:'bluesky',where:'Bluesky post',url:'https://x/2',sentences:[]}]});
  assert.equal(docs.length,1);assert.equal(docs[0].year,2026);
  const c=statementCandidates(docs,{'minimum-wage':{any:['minimum wage']}});assert.equal(c.length,1);assert.equal(c[0].seen[0].where,'Press release: Raise the wage');
  assert.equal(cycleOf('2025-03-01'),'2026');assert.equal(cycleOf('2024-12-01'),'2024');
  assert.equal(campaignOf('Campaign website, 2020: Issues','2019-12-01'),'2020');assert.equal(campaignOf('Bluesky post, 2026 campaign','2025-01-01'),'2026');
  assert.equal(campaignOf('Portland Press Herald: Medicaid in the 2025 reconciliation bill','2025-07-01'),'2026','a year in a title is not the campaign');
});

test('npm run statements:export: a whole run on a small database, without reading anything new',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'statements-')),dbFile=path.join(dir,'records.sqlite');
  const db=new DatabaseSync(dbFile);db.exec(fs.readFileSync(new URL('migrations/0001_initial.sql',root),'utf8'));
  const job=(id,kind,subject,rows)=>{db.prepare("INSERT INTO jobs(id,kind,subject,args,published_run) VALUES(?,?,?,'{}',?)").run(id,kind,subject,`run-${id}`);
    for(const r of rows)db.prepare('INSERT INTO records(run_id,id,payload) VALUES(?,?,?)').run(`run-${id}`,String(r.id),JSON.stringify(r));};
  job('press:perry','press','perry',[{id:'https://perry.house.gov/1',title:'Perry Opposes Another Blank Check for Ukraine',summary:'"We will vote no on the $61 billion supplemental for Ukraine," Perry said.',date:'2024-04-18',url:'https://perry.house.gov/1'},
    {id:'https://perry.house.gov/0',title:'Perry on Ukraine',summary:'Old news.',date:'2012-01-01',url:'https://perry.house.gov/0'}]);
  job('youtube:perry','youtube','perry',[{id:'v1',title:'Perry on raising the minimum wage',date:'2025-01-01',url:'https://youtube.com/1'}]);
  job('bluesky:nobody','bluesky','nobody',[{id:'at://9',handle:'x',text:'Send aid to Ukraine now, all of it.',date:'2025-07-10',url:'https://bsky.app/9'}]);
  job('crec-day:CREC-2025-11-17','crec-day','CREC-2025-11-17',[{id:'CREC-2025-11-17-pt1-PgH4500',title:'RAISE THE WAGE ACT',date:'2025-11-17',people:['lawler','perry'],url:'https://www.govinfo.gov/app/details/CREC-2025-11-17/CREC-2025-11-17-pt1-PgH4500'},
    {id:'CREC-2025-11-17-pt1-PgH4400',title:'PRAYER',date:'2025-11-17',people:['lawler'],url:'https://www.govinfo.gov/x'},
    {id:'CREC-2025-11-17-pt1-PgH4600',title:'UKRAINE',date:'2025-11-17',people:['perry'],url:'https://www.govinfo.gov/y'}]);
  db.close();
  fs.mkdirSync(path.join(dir,'speeches'));
  fs.writeFileSync(path.join(dir,'speeches','CREC-2025-11-17-pt1-PgH4500.txt'),'  Mr. LAWLER. Mr. Speaker, a higher minimum wage helps families in the Hudson Valley.\n  The SPEAKER pro tempore. The gentleman yields back.\n  Mr. PERRY. Mr. Speaker, this bill is not about the minimum wage at all, I yield back.\n');
  const out=path.join(dir,'out');
  const log=execFileSync(process.execPath,['--no-warnings','scripts/export-statements.mjs','--db',dbFile,'--out',out,'--read','0'],{cwd:new URL('.',root),encoding:'utf8',env:{...process.env,CONGRESS_API_KEY:'',GOVINFO_API_KEY:''}});
  assert.match(log,/press releases 1, floor speeches 4\./,"each speaker of a speech once, the 2012 release left out");assert.match(log,/1 still to read/);
  assert.deepEqual(fs.readdirSync(out).sort(),['lawler.json','perry.json'],'no file for someone without a profile; YouTube is left out');
  const perry=JSON.parse(fs.readFileSync(path.join(out,'perry.json'),'utf8')),lawler=JSON.parse(fs.readFileSync(path.join(out,'lawler.json'),'utf8'));
  assert.deepEqual(perry.statements.map(s=>s.source),['floor','press']);
  assert.deepEqual(perry.statements[0].sentences,['Mr. Speaker, this bill is not about the minimum wage at all, I yield back.'],'only the speaker\'s own words');
  assert.deepEqual(lawler.statements.map(s=>s.sentences[0]),['Mr. Speaker, a higher minimum wage helps families in the Hudson Valley.']);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('--wait: when GovInfo says to slow down, save, pause (an hour unless it says) and go on; without it, stop there',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'speeches-')),people=new Map([['perry',{name:'Scott Perry',stateName:'Pennsylvania'}]]);
  const page=w=>`<pre>  Mr. PERRY. Mr. Speaker, ${w}\n  The SPEAKER pro tempore. The gentleman yields back.\n</pre>`;
  const floor=()=>[{person:'perry',source:'floor',title:'Raise The Wage',granule:'CREC-2025-11-17-pt1-PgH1',date:'2025-11-17',url:'https://x/1'},
    {person:'perry',source:'floor',title:'Prayer',granule:'CREC-2025-11-17-pt1-PgH0',date:'2025-11-17',url:'https://x/0'},
    {person:'perry',source:'floor',title:'Ukraine',granule:'CREC-2025-11-16-pt1-PgH2',date:'2025-11-16',url:'https://x/2'}];
  const govinfo=answers=>{let i=0;return async()=>{const a=answers[i++]||{status:200,body:page('more.')};return new Response(a.body||'',{status:a.status,headers:a.headers||{}});};};
  const pauses=[],saved=[];
  const f1=floor(),r1=await readSpeeches(f1,{cache:dir,key:'k',env:{CONGRESS_API_KEY:'k',fetch:govinfo([{status:200,body:page('raise the minimum wage now.')},{status:429},{status:200,body:page('no more aid to Ukraine.')}])},
    people,maxRead:10,wait:true,gap:0,pause:async ms=>{if(ms)pauses.push(ms);},onPause:(ms,n)=>saved.push(n)});
  assert.deepEqual(r1,{fetched:2,waiting:0,stopped:null,pauses:1,skipped:0});assert.deepEqual(pauses,[HOUR],'an hour when GovInfo doesn\'t say');assert.deepEqual(saved,[1],'saved after the first read');
  assert.equal(f1[0].text,'Mr. Speaker, raise the minimum wage now.');assert.equal(f1[1].text,'','a routine page is skipped');assert.equal(f1[2].text,'Mr. Speaker, no more aid to Ukraine.');
  // the pages are saved: a second run reads nothing new
  const f2=floor(),r2=await readSpeeches(f2,{cache:dir,key:'k',env:{CONGRESS_API_KEY:'k',fetch:async()=>{throw new Error('no reads');}},people,maxRead:10,gap:0,pause:async()=>{}});
  assert.equal(r2.fetched,0);assert.equal(f2[2].text,'Mr. Speaker, no more aid to Ukraine.');
  // without --wait, a slow-down stops the reading; GovInfo's own Retry-After sets the pause
  const dir2=fs.mkdtempSync(path.join(os.tmpdir(),'speeches-'));
  const r3=await readSpeeches(floor(),{cache:dir2,key:'k',env:{CONGRESS_API_KEY:'k',fetch:govinfo([{status:429}])},people,maxRead:10,gap:0,pause:async()=>{}});
  assert.deepEqual([r3.fetched,r3.waiting,r3.stopped],[0,2,'GovInfo asked to slow down (HTTP 429)']);
  const waits=[];await readSpeeches(floor(),{cache:dir2,key:'k',env:{CONGRESS_API_KEY:'k',fetch:govinfo([{status:429,headers:{'retry-after':'120'}}])},people,maxRead:10,wait:true,gap:0,pause:async ms=>{if(ms)waits.push(ms);}});
  assert.deepEqual(waits,[120000]);
  fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(dir2,{recursive:true,force:true});
});

test('a page that times out is tried again, then skipped for the next run; GovInfo not answering at all pauses or stops',async()=>{
  const people=new Map([['perry',{name:'Scott Perry',stateName:'Pennsylvania'}]]);
  const page=w=>`<pre>  Mr. PERRY. Mr. Speaker, ${w}\n  The SPEAKER pro tempore. The gentleman yields back.\n</pre>`;
  const floor=n=>Array.from({length:n},(_,i)=>({person:'perry',source:'floor',title:'Raise The Wage '+i,granule:`CREC-2025-11-${String(20-i).padStart(2,'0')}-pt1-PgH${i}`,date:`2025-11-${String(20-i).padStart(2,'0')}`,url:'https://x/'+i}));
  const timeout=()=>{throw new DOMException('The operation was aborted due to timeout','TimeoutError');};
  const answers=list=>{let i=0;return async()=>{const a=list[i++]||'ok';if(a==='timeout')timeout();if(a==='503')return new Response('',{status:503});return new Response(page('raise the minimum wage now.'),{status:200});};};
  // one timeout, then the page answers: read, after one short wait
  let dir=fs.mkdtempSync(path.join(os.tmpdir(),'speeches-')),waits=[];
  let r=await readSpeeches(floor(2),{cache:dir,key:'k',env:{CONGRESS_API_KEY:'k',fetch:answers(['timeout'])},people,maxRead:10,gap:0,pause:async ms=>{if(ms)waits.push(ms);}});
  assert.deepEqual([r.fetched,r.skipped,r.stopped],[2,0,null]);assert.deepEqual(waits,[RETRY_WAITS[0]]);
  // a page that never answers (timeouts and a 503) is skipped, and the next one is read; it's still waiting for the next run
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'speeches-'));waits=[];
  r=await readSpeeches(floor(2),{cache:dir,key:'k',env:{CONGRESS_API_KEY:'k',fetch:answers(['timeout','503','timeout','timeout'])},people,maxRead:10,gap:0,pause:async ms=>{if(ms)waits.push(ms);}});
  assert.deepEqual([r.fetched,r.skipped,r.waiting,r.stopped],[1,1,1,null]);assert.deepEqual(waits,RETRY_WAITS);
  // nothing answers: without --wait it stops after MAX_SKIPPED pages; with --wait it pauses an hour and goes on
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'speeches-'));
  r=await readSpeeches(floor(MAX_SKIPPED+1),{cache:dir,key:'k',env:{CONGRESS_API_KEY:'k',fetch:async()=>timeout()},people,maxRead:20,gap:0,pause:async()=>{}});
  assert.equal(r.skipped,MAX_SKIPPED);assert.match(r.stopped,/stopped answering/);
  const down=Array((RETRY_WAITS.length+1)*MAX_SKIPPED).fill('timeout');waits=[];
  r=await readSpeeches(floor(MAX_SKIPPED+1),{cache:dir,key:'k',env:{CONGRESS_API_KEY:'k',fetch:answers(down)},people,maxRead:20,wait:true,gap:0,pause:async ms=>{if(ms)waits.push(ms);},onPause:()=>{}});
  assert.deepEqual([r.pauses,r.stopped,r.skipped,r.fetched],[1,null,MAX_SKIPPED-1,2],'after an hour\'s pause, the page it stopped on is tried again and the rest are read');assert.ok(waits.includes(HOUR));
  fs.rmSync(dir,{recursive:true,force:true});
});
