// The parts of an annual disclosure Plays by the Rules reads besides assets and debts (src/schedules.mjs): earned
// income, outside positions, agreements, gifts and paid travel, from the House Clerk's PDF text and the Senate eFD page.
import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../data/config.json' with {type:'json'};
import {houseSections,houseAnnualSchedules,efdAnnualSchedules,scheduleCounts,spaced,SCHEDULES_READER} from '../src/schedules.mjs';
import {FEEDS,holdingsSnapshot,annualSummary,annualRows,efdSavedReport} from '../src/feeds.mjs';

// The layout the House Clerk's e-filed reports use, as the PDF reader (src/pdf.mjs) gives it: a heading per schedule,
// a line of column names, then a line an item (a long name can wrap onto the next line).
const HOUSE=`Schedule A: Assets and "Unearned" Income
Asset Owner Value of Asset Income Type(s) Income Current Year to Filing Income Preceding Year
Apple Inc. (AAPL) [ST] SP $15,001 - $50,000 Dividends $201 - $1,000 $201 - $1,000
Schedule B: Transactions
None disclosed.
Schedule C: Earned Income
Source Type Amount Current Year to Filing Amount Preceding Year
State of Maine Pension N/A $12,400.00
Northern Light Health Spouse Salary N/A N/A
Acme Publishing Royalties $3,250.00 $1,100.00
Schedule D: Liabilities
None disclosed.
Schedule E: Positions
Position Name of Organization
Board Member Smith Family Foundation
Trustee University of Maine Foundation, a charitable
organization
Managing Member Lighthouse Holdings LLC
Schedule F: Agreements
Date Parties To Terms of Agreement
01/2023 Filer and State of Maine Retirement System Continued participation in a defined benefit plan
Schedule G: Gifts
Source Description Value
Big Tech Corp. (Washington, DC, US) Conference ticket and dinner $415.00
Schedule H: Travel Payments and Reimbursements
Source Start Date End Date Itinerary Days at Own Exp Lodging? Food? Family?
Aspen Institute 08/12/2024 08/18/2024 DC - Aspen, CO - DC 0 Y Y N
Schedule I: Payments Made to Charity in Lieu of Honoraria
None disclosed.
Certification and Signature
I CERTIFY that the statements I have made on the attached Financial Disclosure Report are true.`;

test('a House report: each schedule\'s items, a wrapped name joined to its line, and the raw text kept',()=>{
  const sec=houseSections(HOUSE);
  assert.deepEqual(Object.keys(sec),['A','B','C','D','E','F','G','H','I']);assert.equal(sec.B,'','"None disclosed." is empty');
  const s=houseAnnualSchedules(HOUSE);
  assert.deepEqual(s.income.map(x=>[x.source,x.type,x.amounts]),[['State of Maine','Pension',[null,12400]],['Northern Light Health','Spouse Salary',[null,null]],['Acme Publishing','Royalties',[3250,1100]]]);
  assert.deepEqual(s.positions.map(x=>[x.position,x.org]),[['Board Member','Smith Family Foundation'],['Trustee','University of Maine Foundation, a charitable organization'],['Managing Member','Lighthouse Holdings LLC']]);
  assert.deepEqual(s.agreements.map(x=>[x.date,x.terms]),[['01/2023','Filer and State of Maine Retirement System Continued participation in a defined benefit plan']]);
  assert.deepEqual(s.gifts.map(x=>[x.source,x.value]),[['Big Tech Corp. (Washington, DC, US) Conference ticket and dinner',415]]);
  assert.deepEqual(s.travel.map(x=>[x.source,x.from,x.to,x.itinerary]),[['Aspen Institute','08/12/2024','08/18/2024','DC - Aspen, CO - DC']]);
  assert.equal(s.read,true);assert.match(s.raw.E,/Smith Family Foundation/);
  assert.deepEqual(scheduleCounts(s),{income:3,positions:3,agreements:1,gifts:1,travel:1});
  // The assets and the certification aren't items; a paper report (no text) reads as nothing.
  assert.ok(!JSON.stringify(s.positions).includes('CERTIFY'));
  const empty=houseAnnualSchedules('');assert.equal(empty.read,false);assert.deepEqual(scheduleCounts(empty),{income:0,positions:0,agreements:0,gifts:0,travel:0});
});

test('a Senate eFD report: the income, positions, agreements, gifts and travel tables, not the assets or transactions',()=>{
  const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const html=table(['#','Asset','Asset Type','Owner','Value','Income Type','Income Amount'],[['1','Vanguard 500','Mutual Funds','Spouse','$100,001 - $250,000','Dividends','$2,501 - $5,000']])
    +table(['#','Who Was Paid','Type','Who Paid','Amount Paid'],[['1','Spouse','Salary','<strong>Maine Medical Center</strong>','$84,000.00'],['2','Self','Honoraria','Rotary Club','$500.00']])
    +table(['#','Position Dates','Position Held','Entity','Entity Type','Comments'],[['1','2015 - Present','Board Member','Friends of Acadia','Non-Profit','']])
    +table(['#','Date','Parties Involved','Type','Status and Terms'],[['1','01/2019','Self and Big Law LLP','Leave of absence','Return possible']])
    +table(['#','Date','Recipient','Value','Source','Description'],[['1','03/01/2025','Self','$450.00','Acme Corp','Dinner']])
    +table(['#','Dates','Traveler(s)','Source','Itinerary','Reimbursed For'],[['1','04/02/2025 - 04/05/2025','Self','Aspen Institute','DC - Aspen - DC','Travel, lodging']])
    +table(['#','Transaction Date','Owner','Ticker','Asset Name','Type','Amount'],[['1','01/02/2025','Self','AAPL','Apple','Purchase','$1,001 - $15,000']]);
  const s=efdAnnualSchedules(html);
  assert.deepEqual(s.income.map(x=>[x.source,x.type,x.amounts[0],x.paidTo]),[['Maine Medical Center','Salary',84000,'Spouse'],['Rotary Club','Honoraria',500,'Self']]);
  assert.deepEqual(s.positions.map(x=>[x.position,x.org]),[['Board Member','Friends of Acadia']]);
  assert.deepEqual(s.agreements.map(x=>[x.date,x.terms]),[['01/2019','Self and Big Law LLP · Leave of absence · Return possible']]);
  assert.deepEqual(s.gifts.map(x=>[x.source,x.value]),[['Acme Corp',450]]);
  assert.deepEqual(s.travel.map(x=>[x.source,x.itinerary]),[['Aspen Institute','DC - Aspen - DC']]);
  assert.equal(s.read,true);
  // A page saved from a browser for the eFD import carries them too.
  assert.equal(efdSavedReport(`<h1>Annual Report for CY 2025</h1>${html}`).holdings.schedules.income.length,2);
  assert.equal(efdAnnualSchedules('<p>Paper report</p>').read,false);
});

test('kept with each report: the newest with its raw text, the years before without it',()=>{
  const r=(id,year,filed)=>({id,...holdingsSnapshot({year,filed,url:`u${id}`,type:'annual'},{assets:[{name:'Fund',type:'Mutual Funds',value:'$1,001 - $15,000'}],debts:[],schedules:houseAnnualSchedules(HOUSE)})});
  const s=annualSummary([r('a',2023,'2023-05-10'),r('b',2024,'2024-05-10')]);
  assert.equal(s.schedules.income.length,3);assert.ok(s.schedules.raw,'the newest keeps the raw text');
  assert.equal(s.history[1].schedules.positions.length,3);assert.equal(s.history[1].schedules.raw,undefined,'earlier years don\'t');
  assert.ok(annualRows(s).every(x=>x.schedules),'carried into the next read, so they aren\'t read again');
});

test('the House job reads again, once, a report saved before these parts were read',async()=>{
  const p=config.people.find(x=>x.inOffice&&x.chamber==='H');
  const filings=[{id:'9',type:'O',year:2025,filed:'2025-05-15',url:'https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2025/9.pdf'}];
  // Saved before: the report with its assets, but no schedules.
  let saved={id:'9',year:2025,filed:'2025-05-15',url:filings[0].url,type:'O',low:1,high:2,assets:[{name:'Fund',value:'$1,001 - $15,000'}],debts:[],history:[]};const urls=[];
  const env={DB:{prepare:()=>({bind:()=>({all:async()=>({results:[{payload:JSON.stringify({byPerson:{[p.id]:filings}})}]}),first:async()=>saved?{payload:JSON.stringify(saved)}:null})})},
    fetch:async u=>{urls.push(String(u));return new Response(new Uint8Array([1,2,3]));}};
  const run=async()=>{let cursor=null,rows=[];do{const r=await FEEDS['net-worth-house'].page({kind:'net-worth-house',subject:p.id,args:'{}',cursor,started_at:new Date().toISOString()},{},env,config);rows.push(...r.rows);cursor=r.next;}while(cursor);
    return FEEDS['net-worth-house'].summarize(rows);};
  let snap=await run();assert.deepEqual(urls,[filings[0].url],'read again for its other parts');assert.ok(snap.schedules);
  saved=snap;urls.length=0;snap=await run();assert.deepEqual(urls,[],'then not again');
});

test('a report read by an earlier version of the reader is read again, once, and the new reading replaces the old',async()=>{
  const p=config.people.find(x=>x.inOffice&&x.chamber==='H');
  const filings=[{id:'9',type:'O',year:2025,filed:'2025-05-15',url:'https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2025/9.pdf'}];
  // Saved by the first reader, which couldn't open the House Clerk's newer reports: no assets, no parts, no version.
  let saved={id:'9',year:2025,filed:'2025-05-15',url:filings[0].url,type:'O',low:0,high:0,assets:[],debts:[],unreadable:true,
    schedules:{income:[],positions:[],agreements:[],gifts:[],travel:[],read:false},history:[]};const urls=[];
  const env={DB:{prepare:()=>({bind:()=>({all:async()=>({results:[{payload:JSON.stringify({byPerson:{[p.id]:filings}})}]}),first:async()=>saved?{payload:JSON.stringify(saved)}:null})})},
    fetch:async u=>{urls.push(String(u));return new Response(new Uint8Array([1,2,3]));}};
  const run=async()=>{let cursor=null,rows=[];do{const r=await FEEDS['net-worth-house'].page({kind:'net-worth-house',subject:p.id,args:'{}',cursor,started_at:new Date().toISOString()},{},env,config);rows.push(...r.rows);cursor=r.next;}while(cursor);
    return FEEDS['net-worth-house'].summarize(rows);};
  let snap=await run();assert.deepEqual(urls,[filings[0].url]);assert.equal(snap.schedules.v,SCHEDULES_READER,'the new reading kept');
  assert.equal(snap.history.length,1);
  saved=snap;urls.length=0;await run();assert.deepEqual(urls,[],'then not again');
});

// The House Clerk's newer reports (2025 on), as the PDF reader gives their text: the headings in small capitals come out
// as "S C :", the column names and the filer's notes letter by letter, a title can have a second after a slash, and a
// trip's source can wrap onto the lines above its dates.
const HOUSE_2025=`S A : A "U " I
A sse t O w n e r V alu e o f A sse t I n c o me T y p e (s) I n c o me T x . >
Bank of America Checking [BA] JT $50,001 -
$100,000
Interest $1 - $200
S C : E I
S o u rc e T y p e A mo u n t
Dean's Car Care Salary $28,478.00
S E : P
P o si t i o n N ame o f O rg an i z at i o n
Trustee The Anastasia Fund
C : P o sit io n is u nco m pensa t ed . T h e A na st a sia F u nd , P . O . B o x 2 12 1, T o l ed o , O H 4 36 0 3.
a nd S t eph en K a pt u r ]
Vice President/Director Castor-Bell-Lewis Family Foundation (uncompensated)
Chaplain Local Chapter of the Military Officers of America Association
C : U nco m pensa t ed
Board of Visitors Air Force Academy
S H : T P R
T r i p D e t a i l s I n c l u si o n s
S o u rc e S t art D at e E n d D at e I t i n e rary D ay s at O w n
E x p .
L o d g i n g ? Fo o d ? Fami ly ?
RMSP (Mainstreet
Republicans)
04/05/2025 04/18/2025 Washington D.C. -
Crete, Greece - Omaha,
Nebraska
0
Marshall Scholars 05/08/2025 05/13/2025 Washington D.C. -
London, UK - Omaha, Nebraska
0
S I : P M C I L H
None disclosed.`;

test('a House report in the newer layout: small-capital headings, spaced-out column names and notes, wrapped trips',()=>{
  assert.deepEqual(Object.keys(houseSections(HOUSE_2025)),['A','C','E','H','I']);
  const s=houseAnnualSchedules(HOUSE_2025);
  assert.deepEqual(s.income.map(x=>[x.source,x.type,x.amounts]),[["Dean's Car Care",'Salary',[28478]]]);
  assert.deepEqual(s.positions.map(x=>[x.position,x.org]),[['Trustee','The Anastasia Fund'],['Vice President/Director','Castor-Bell-Lewis Family Foundation (uncompensated)'],
    ['Chaplain','Local Chapter of the Military Officers of America Association'],['Board of Visitors','Air Force Academy']]);
  assert.match(s.positions[0].comment,/^P o sit io n is u nco m pensa t ed .* K a pt u r \]$/,'a note, with the line it wraps onto, goes with its item');
  assert.match(s.positions[2].comment,/U nco m pensa t ed/);assert.equal(s.positions[1].comment,undefined);
  assert.deepEqual(s.travel.map(x=>[x.source,x.from,x.to,x.itinerary]),[['RMSP (Mainstreet Republicans)','04/05/2025','04/18/2025','Washington D.C. - Crete, Greece - Omaha, Nebraska'],
    ['Marshall Scholars','05/08/2025','05/13/2025','Washington D.C. - London, UK - Omaha, Nebraska']]);
  assert.equal(s.v,SCHEDULES_READER);
});

test('a letter-spaced line is told apart from an item with short words in it',()=>{
  for(const l of ['T r i p D e t a i l s I n c l u si o n s','C : U nco m pensa t ed','L o d g i n g ? Fo o d ? Fami ly ?','a nd S t eph en K a pt u r ]'])assert.ok(spaced(l),l);
  for(const l of ['Aspen Institute 08/12/2024 08/18/2024 DC - Aspen, CO - DC 0 Y Y N','Japan - Lexington, KY','J P Morgan Chase & Co','US Bank Savings Account [BA] SP $1,001 - $15,000'])assert.ok(!spaced(l),l);
});
