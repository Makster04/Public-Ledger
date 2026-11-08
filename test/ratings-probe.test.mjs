import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUPS,probe,tablesOf,namesOn} from '../scripts/ratings-probe.mjs';

const page=`<html><head><title>2025 Scorecard</title><script src="/js/app.js"></script></head><body>
<a href="/members-of-congress">Members of Congress</a><a href="https://facebook.com/x">Share</a><a href="/download/scores-2025.csv">Download</a>
<table><tr><th>Member</th><th>State</th><th>Score</th></tr><tr><td>Ossoff, Jon</td><td>GA</td><td>97%</td></tr></table></body></html>`;
const fake=async(u)=>{u=String(u);
  if(u.endsWith('/js/app.js'))return new Response('fetch("/api/scorecard/members.json")',{status:200});
  if(u.includes('blocked'))return new Response('<html><title>Just a moment...</title></html>',{status:403});
  if(u.includes('data'))return Response.json([{name:'Ossoff',score:97}]);
  return new Response(page,{status:200,headers:{'content-type':'text/html'}});};

test('a scorecard page: its title, the members named, the links to the ratings, its tables and its scripts\' data addresses',async()=>{
  const r=await probe('https://scorecard.example.org/',{get:fake,surnames:['Ossoff','Collins']});
  const text=r.lines.join('\n');
  assert.match(text,/HTTP 200/);assert.match(text,/title: 2025 Scorecard/);
  assert.match(text,/profiled members named on the page: 1 \(Ossoff\)/);
  assert.match(text,/link: Members of Congress → https:\/\/scorecard\.example\.org\/members-of-congress/);
  assert.match(text,/link: Download → https:\/\/scorecard\.example\.org\/download\/scores-2025\.csv/);
  assert.doesNotMatch(text,/facebook/);
  assert.match(text,/table: 2 rows; first: Member \| State \| Score; second: Ossoff, Jon \| GA \| 97%/);
  assert.match(text,/data addresses in its scripts: .*\/api\/scorecard\/members\.json/);
  assert.equal(r.sample.ext,'html');
});

test('a bot check is recorded and left alone; JSON is described by its keys',async()=>{
  const b=await probe('https://blocked.example.org/',{get:fake});
  assert.match(b.lines.join('\n'),/bot check, not the page: .* left out/);assert.equal(b.sample,null);
  const j=await probe('https://data.example.org/scores.json',{get:fake});
  assert.match(j.lines.join('\n'),/JSON: a list of 1; first item's keys: name, score/);
});

test('every group has a side, an issue and addresses; ACLU and HRC wait on permission',()=>{
  for(const g of GROUPS){assert.ok(['conservative','liberal','none'].includes(g.lean),g.key);assert.ok(g.issue&&g.urls.length,g.key);for(const u of g.urls)assert.match(u,/^https:\/\//);}
  assert.deepEqual(GROUPS.filter(g=>g.permission).map(g=>g.key).sort(),['aclu','hrc']);
  assert.equal(new Set(GROUPS.map(g=>g.key)).size,GROUPS.length);
  assert.deepEqual(tablesOf('<p>none</p>'),[]);
  assert.deepEqual(namesOn('Sen. Booker voted',['Booker','Lee']),['Booker']);
});

test('a PDF scorecard: its text is read and saved, and the members named in it counted',async()=>{
  const content='BT /F1 12 Tf 72 720 Td (2025 Ratings) Tj 0 -14 Td (Ossoff, Jon GA 97%) Tj 0 -14 Td (Collins, Susan ME 31%) Tj ET';
  const pdf=`%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF`;
  const get=async()=>new Response(new TextEncoder().encode(pdf),{status:200,headers:{'content-type':'application/pdf'}});
  const r=await probe('https://scorecard.example.org/2025.pdf',{get,surnames:['Ossoff','Collins','Booker']});
  const text=r.lines.join('\n');
  assert.match(text,/A PDF: .* profiled members named in it: 2 \(Collins, Ossoff\)|A PDF: .* profiled members named in it: 2 \(Ossoff, Collins\)/);
  assert.equal(r.sample.ext,'txt');assert.match(r.sample.text,/Ossoff, Jon GA 97%/);
  const scanned=await probe('https://scorecard.example.org/scan.pdf',{get:async()=>new Response('%PDF-1.4\n1 0 obj << /Type /XObject /Subtype /Image /Length 2 >> stream\nxx\nendstream endobj',{status:200,headers:{'content-type':'application/pdf'}})});
  assert.match(scanned.lines.join('\n'),/A PDF with no text/);assert.equal(scanned.sample,null);
});

test('the groups added in November 2026 carry the sides chosen for them',()=>{
  const lean=Object.fromEntries(GROUPS.map(g=>[g.key,g.lean]));
  assert.equal(lean.norml,'liberal');assert.equal(lean.napo,'conservative');assert.equal(lean.standwithcrypto,'conservative');
  assert.equal(lean.humane,'liberal');for(const k of ['imeu','ajp','niac'])assert.equal(lean[k],'liberal',k);
  assert.deepEqual(GROUPS.filter(g=>g.lean==='none').map(g=>g.key).sort(),['c4ip','lugar']);
  assert.equal(GROUPS.length,58);
});

test('a PDF with huge pictures: its text is read without inflating them, and an oversized stream is dropped, not held',async()=>{
  const zlib=await import('node:zlib');const {pdfText,STREAM_CAP}=await import('../src/pdf.mjs');
  const bomb=zlib.deflateSync(Buffer.alloc(256e6));      // 256 MB of picture, compressed to about 250 KB
  const content='BT /F1 12 Tf 72 720 Td (Ossoff, Jon GA 97%) Tj ET';
  const parts=['%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    `3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R /Im2 7 0 R >> >> >> endobj\n4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`];
  const chunks=[Buffer.from(parts.join(''),'latin1')];
  for(const n of [6,7])chunks.push(Buffer.from(`${n} 0 obj << /Type /XObject /Subtype /Image /Width 8000 /Height 8000 /Filter /FlateDecode /Length ${bomb.length} >> stream\n`,'latin1'),bomb,Buffer.from('\nendstream endobj\n','latin1'));
  // A content stream that would inflate past the cap is dropped (its text lost), never held in memory.
  chunks.push(Buffer.from(`8 0 obj << /Filter /FlateDecode /Length ${bomb.length} >> stream\n`,'latin1'),bomb,Buffer.from('\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF','latin1'));
  const pdf=new Uint8Array(Buffer.concat(chunks));
  const before=process.memoryUsage().arrayBuffers,t0=Date.now();
  assert.equal(await pdfText(pdf),'Ossoff, Jon GA 97%');
  assert.ok(Date.now()-t0<15000,'quick');assert.ok(process.memoryUsage().arrayBuffers-before<STREAM_CAP*4,'the pictures were never inflated');
});

test('a PDF is read in a thread of its own, with a time limit',async()=>{
  const {pdfTextLimited}=await import('../scripts/ratings-probe.mjs');
  const content='BT /F1 12 Tf 72 720 Td (Collins, Susan ME 31%) Tj ET';
  const pdf=new TextEncoder().encode(`%PDF-1.4\n1 0 obj << /Type /Page /Contents 2 0 R /Resources << /Font << /F1 3 0 R >> >> >> endobj\n2 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj\n3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n%%EOF`);
  assert.deepEqual(await pdfTextLimited(pdf),{text:'Collins, Susan ME 31%'});
  const slow=await pdfTextLimited(pdf,{timeout:1});
  assert.equal(slow.text,'');assert.match(slow.why,/took longer than/);
});
