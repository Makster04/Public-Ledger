import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root=new URL('../public/',import.meta.url);
const data=JSON.parse(await fs.readFile(new URL('research.json',root),'utf8'));
const index=JSON.parse(await fs.readFile(new URL('portraits/index.json',root),'utf8'));
// Everyone profiled, plus every other sitting senator (their basic profiles' cards).
const senate=JSON.parse(await fs.readFile(new URL('senate.json',root),'utf8')).senators;
// Results-only nominees (liteRaces) are known by their FEC candidate ID, or by id without one.
const ids=new Set(data.members.concat(data.cands,data.featured||[]).map(s=>s.id).concat(senate.map(s=>s.id),data.liteRaces.flatMap(r=>r.nominees.map(n=>n.fecCand||n.id))));
test('every portrait belongs to a profiled person or a sitting senator, exists as a WebP, and says where it came from',async()=>{
  for(const [id,p] of Object.entries(index.people)){
    assert.ok(ids.has(id),id+' is not in research.json or senate.json');
    assert.equal(p.file,`portraits/${id}.webp`);
    const b=await fs.readFile(new URL(p.file,root));
    assert.equal(b.toString('latin1',0,4)+b.toString('latin1',8,12),'RIFFWEBP',id+' is not a WebP');
    assert.ok(p.credit&&p.credit.length>10,id+' needs a credit');
    if(p.src)assert.match(p.src,/^https:\/\//,id+' has a bad source link');
  }
});
test('no stray portrait files',async()=>{
  for(const f of await fs.readdir(new URL('portraits/',root)))if(f!=='index.json')assert.ok(index.people[f.replace(/\.webp$/,'')],f+' is not listed in index.json');
});

// scripts/fetch-portrait-photos.mjs: a free photo from Wikipedia for each person still showing initials.
const {missing,titleFits,freeLicense,creditOf,lookUp,STATES}=await import('../scripts/fetch-portrait-photos.mjs');
const extra=JSON.parse(await fs.readFile(new URL('../scripts/portrait-extra.json',root),'utf8'));
test('the people still showing initials are looked up by name and state, and only a free photo of the right person is kept',async()=>{
  const left=missing(data,index,extra);
  for(const p of left){assert.ok(ids.has(p.id)&&p.name&&Object.values(STATES).includes(p.state),p.id);assert.ok(!index.people[p.id],p.id);}
  assert.ok(left.some(p=>p.id==='sc-andrews'&&p.state==='South Carolina'),'a results-only Senate nominee');
  assert.ok(left.some(p=>p.id==='H6VA02198'),'someone left on initials for a cropped official photo is tried again');
  assert.ok(titleFits('Tom Barrett (Michigan politician)','Tom Barrett'));assert.ok(titleFits('Marie Gluesenkamp Perez','Marie Gluesenkamp Perez'));
  assert.ok(!titleFits('Tom Barrett (footballer)','Thomas Barrett'),'a different first name');assert.ok(!titleFits('Barrett Tom','Tom Barrett'));
  for(const ok of ['CC BY-SA 4.0','CC BY 2.0','CC0','Public domain','PD-USGov'])assert.ok(freeLicense(ok),ok);
  for(const no of ['CC BY-NC 2.0','CC BY-ND 4.0','Fair use','',undefined])assert.ok(!freeLicense(no),String(no));
  assert.equal(creditOf('Jane Doe','CC BY-SA 4.0'),'Photo: Jane Doe, CC BY-SA 4.0, via Wikimedia Commons; background removed for this site');
  assert.equal(creditOf('U.S. House','Public domain'),'Photo: U.S. House, public domain, via Wikimedia Commons');
  // The lookups, answered here as Wikipedia and Commons would.
  const wiki=({search=[],pages=[],files=[]})=>async(host,q)=>q.list==='search'?{query:{search:search.map(title=>({title}))}}:host==='en.wikipedia.org'?{query:{pages}}:{query:{pages:files}};
  const andrews={id:'sc-andrews',name:'Annie Andrews',state:'South Carolina'};
  const file={imageinfo:[{mime:'image/jpeg',thumburl:'https://upload.wikimedia.org/x/900px-A.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:A.jpg',
    extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'},Artist:{value:'<a href="//x">Jane Doe</a>'}}}]};
  const found=await lookUp(andrews,{ask:wiki({search:['Annie Andrews','Andrews (surname)'],pages:[{title:'Annie Andrews',extract:'Annie Andrews is an American pediatrician from South Carolina.',pageimage:'A.jpg'}],files:[file]})});
  assert.deepEqual(found.found,{article:'Annie Andrews',file:'A.jpg',download:'https://upload.wikimedia.org/x/900px-A.jpg',page:'https://commons.wikimedia.org/wiki/File:A.jpg',ext:'jpg',license:'CC BY-SA 4.0',artist:'Jane Doe'});
  assert.match((await lookUp(andrews,{ask:wiki({search:['Annie Andrews'],pages:[{title:'Annie Andrews',extract:'Annie Andrews is an English actress.',pageimage:'A.jpg'}],files:[file]})})).none,/no Wikipedia article about them in South Carolina/,'someone else with the name');
  assert.match((await lookUp(andrews,{ask:wiki({search:['Andy Andrews']})})).none,/no Wikipedia article with that name/);
  assert.match((await lookUp(andrews,{ask:wiki({search:['Annie Andrews'],pages:[{title:'Annie Andrews',extract:'… South Carolina …',pageimage:'A.jpg'}],files:[{missing:true}]})})).none,/isn't on Wikimedia Commons/,'a local non-free photo');
  const nc={imageinfo:[{...file.imageinfo[0],extmetadata:{LicenseShortName:{value:'CC BY-NC 2.0'}}}]};
  assert.match((await lookUp(andrews,{ask:wiki({search:['Annie Andrews'],pages:[{title:'Annie Andrews',extract:'South Carolina',pageimage:'A.jpg'}],files:[nc]})})).none,/doesn't allow this use \(CC BY-NC 2\.0\)/);
});
