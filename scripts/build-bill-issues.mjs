// The alignment questions (public/questions.json) each bill on the Legislation tab is coded to (data/question-bills.json),
// by bill id, into public/bill-questions.js: what the tab names each bill's issues by (public/legislation-page.js
// billIssues). Only the tab's bills, with their other versions, so the page doesn't load the whole coding. Run it after
// coding bills to questions or adding bills to the tab:
//   npm run bills:issues
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {makeScorer} from '../public/scoring.js';
import {legislationModel} from '../public/legislation-page.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
export const OUT=path.join(root,'public','bill-questions.js');

// {bill id: [question ids]} for the tab's bills, a bill's versions counting as the bill. questionBills: data/question-bills.json.
export function billQuestions(data,scored,questionBills){
  const byBill=new Map();
  for(const [q,bills] of Object.entries(questionBills||{})){if(q==='about'||!bills||typeof bills!=='object')continue;
    for(const id of Object.keys(bills))(byBill.get(id)||byBill.set(id,[]).get(id)).push(q);}
  const out={};
  for(const b of legislationModel(data,{scored})){const qs=[...new Set((b.keys||[b.id]).flatMap(k=>byBill.get(k)||[]))];if(qs.length)out[b.id]=qs;}
  return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));
}
export const moduleText=map=>`// Written by scripts/build-bill-issues.mjs (npm run bills:issues) from data/question-bills.json: the alignment questions
// (public/questions.json) each bill on the Legislation tab is coded to, by bill id. Not edited by hand.
export default ${JSON.stringify(map,null,1)};
`;
// What the file should hold now, from the repository's data.
export function current(){
  const data=read('public/research.json');
  const scorer=makeScorer(data,read('public/committees.json'),read('public/committee-sectors.json').committees||{},read('public/vote-party.json').votes);
  return moduleText(billQuestions(data,scorer.bills,read('data/question-bills.json')));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const text=current();fs.writeFileSync(OUT,text);
  const n=Object.keys((await import(pathToFileURL(OUT).href+'?'+Date.now())).default).length;
  console.log(`Wrote public/bill-questions.js: ${n} bills coded to alignment questions.`);
}
