// The trackers: five lobbies whose money the site follows on each profile (the Unbought tab's "Trackers" and its
// "Summary of Major Lookouts") and on the Trackers page. Shown only; no grade uses them. Approved 2026-11-11.
//
// For each tracker:
//   pacIds / patterns   its PACs: the FEC committee IDs on file (checked by hand), and name patterns for committees not on
//                       file yet (a PAC line's committee name, in capitals)
//   routed              its groups whose routed ("bundled") gifts count (research.json "bundled", scripts/build-bundled.mjs)
//   groupPacs           each such group's own PAC: the reader of routed gifts also adds up that PAC's own checks to the
//                       campaign over the whole cycle ("direct"), which fills in a check the PAC lines read don't reach
//   superPacs           its own super PACs, by name (their spending for and against a candidate)
//   industries          the employee-gift groups the refresh reads for it (public/industries.js, "industry-gifts")
//   companies, groups   who it follows, as listed on the page
// A lookout counts what the campaign took: PAC checks, and gifts the group routed to it. Employees' own gifts are shown
// beside it, and super PAC spending only in the tracker: a super PAC spends on its own, often against the candidate.
import {SUPER_PACS} from './industries.js';

const P=s=>new RegExp(s);
export const TRACKERS=[
  {key:'aipac',name:'AIPAC',long:'AIPAC (American Israel Public Affairs Committee)',
    about:'The American Israel Public Affairs Committee: its PAC\'s checks, the gifts it collects from donors and passes on to campaigns, and its super PAC, United Democracy Project.',
    pacIds:['C00797670'],patterns:[P('^AMERICAN ISRAEL PUBLIC AFFAIRS'),P('^AIPAC\\b')],routed:['aipac'],
    groupPacs:{aipac:{cid:'C00797670',name:'AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE'}},superPacs:['United Democracy Project'],industries:[],
    companies:[],groups:['AIPAC PAC']},
  {key:'pharma',name:'Big Pharma',long:'Big Pharma (drugmakers)',
    about:'Drugmakers and their trade groups. Medical device makers, distributors, pharmacy benefit managers and pharmacies aren\'t included.',
    pacIds:['C00251876','C00536573','C00016683','C00010983','C00199257','C00097485','C00082792','C00468660','C00021972','C00199703','C00355677','C00396895','C00332395','C00420398','C00390351','C00424838','C00033969','C00281162','C00562264','C00035675','C00441733','C00780171','C00144345'],
    patterns:['\\bPFIZER\\b','\\bMERCK\\b','JOHNSON (AND|&) JOHNSON','\\bABBVIE\\b','ELI LILLY','BRISTOL[- ]MYERS','\\bAMGEN\\b','\\bGILEAD\\b','\\bREGENERON\\b','\\bVERTEX PHARM','\\bBIOGEN\\b','\\bMODERNA\\b','\\bNOVARTIS\\b','\\bSANOFI\\b','GLAXOSMITHKLINE|\\bGSK\\b','ASTRAZENECA','NOVO NORDISK','\\bGENENTECH\\b','\\bBAYER\\b','BOEHRINGER','\\bTAKEDA\\b','\\bTEVA\\b','\\bVIATRIS\\b','\\bORGANON\\b','PHARMACEUTICAL RESEARCH (AND|&) MANUFACTURERS|\\bPHRMA\\b','BIOTECHNOLOGY INNOVATION ORGANIZATION','ASSOCIATION FOR ACCESSIBLE MEDICINES'].map(P),
    routed:[],superPacs:[],industries:[],
    companies:['Pfizer','Merck','Johnson & Johnson','AbbVie','Eli Lilly','Bristol Myers Squibb','Amgen','Gilead','Regeneron','Vertex','Biogen','Moderna','Novartis','Sanofi','GSK','AstraZeneca','Novo Nordisk','Genentech (Roche)','Bayer','Boehringer Ingelheim','Takeda','Teva','Viatris','Organon'],
    groups:['PhRMA','BIO (Biotechnology Innovation Organization)','Association for Accessible Medicines']},
  {key:'oil',name:'Big Oil',long:'Big Oil (oil and gas)',
    about:'Oil and gas producers, refiners, pipelines and LNG, oilfield services, and their trade groups. Koch Industries, coal and mining, and gas utilities aren\'t included.',
    pacIds:['C00035006','C00513549','C00121368','C00040394','C00755454','C00551184','C00109546','C00354753','C00342766','C00246306','C00035204','C00483677','C00430157','C00496307','C00112896','C00429662','C00039503','C00525055','C00035691','C00431932','C00686287','C00083857','C00116145','C00426569','C00415026','C00736421','C00488080','C00510016','C00721647','C00215384','C00135855','C00486779','C00151175','C00438754','C00705996','C00279224','C00496752','C00567081'],
    patterns:['\\bEXXON','\\bCHEVRON\\b','CONOCOPHILLIPS','OCCIDENTAL PETROLEUM','\\bEOG RESOURCES','DEVON ENERGY','DIAMONDBACK ENERGY','CONTINENTAL RESOURCES','COTERRA','OVINTIV','\\bAPACHE CORP','\\bAPA CORP','\\bEQT CORP','EXPAND ENERGY','CHESAPEAKE ENERGY','ANTERO RESOURCES','DIVERSIFIED (GAS|ENERGY)','HILCORP','\\bSHELL (OIL|USA|EMPLOYEE|PETROLEUM)','\\bBP (AMERICA|CORPORATION NORTH)',
      'MARATHON PETROLEUM','\\bVALERO\\b','PHILLIPS 66','HF SINCLAIR','DELEK US','PBF (ENERGY|HOLDING)','ENERGY TRANSFER','KINDER MORGAN','WILLIAMS COMPANIES','ENTERPRISE PRODUCTS','\\bONEOK\\b','TARGA RESOURCES','PLAINS ALL AMERICAN','ENBRIDGE','TRANSCANADA|\\bTC ENERGY','CHENIERE','VENTURE GLOBAL','NEXTDECADE','HALLIBURTON','SCHLUMBERGER|\\bSLB\\b','BAKER HUGHES',
      'AMERICAN PETROLEUM INSTITUTE','INDEPENDENT PETROLEUM ASSOCIATION|\\bIPAA\\b|WILDCATTERS FUND','AMERICAN EXPLORATION (AND|&) PRODUCTION|\\bAXPC\\b|^US ENERGY PAC','AMERICAN FUELS? (AND|&) PETROCHEMICAL','INTERSTATE NATURAL GAS ASSOCIATION','LIQUID ENERGY PIPELINE','WESTERN ENERGY ALLIANCE','ENERGY MARKETERS OF AMERICA','STRIPPER WELL','ENERGY INFRASTRUCTURE COUNCIL'].map(P),
    routed:[],superPacs:[],industries:[],
    companies:['ExxonMobil','Chevron','ConocoPhillips','Occidental Petroleum','EOG Resources','Devon Energy','Diamondback Energy','Continental Resources','Coterra Energy','Ovintiv','APA (Apache)','EQT','Expand Energy (Chesapeake)','Antero Resources','Diversified Energy','Hilcorp','Shell USA','BP America',
      'Marathon Petroleum','Valero','Phillips 66','HF Sinclair','Delek US','PBF Energy','Energy Transfer','Kinder Morgan','Williams Companies','Enterprise Products','ONEOK','Targa Resources','Plains All American','Enbridge','TC Energy (TransCanada)','Cheniere','Venture Global','NextDecade','Halliburton','SLB (Schlumberger)','Baker Hughes'],
    groups:['American Petroleum Institute','Independent Petroleum Association of America (Wildcatters Fund)','American Exploration & Production Council (US Energy PAC)','American Fuel & Petrochemical Manufacturers','Interstate Natural Gas Association of America','Liquid Energy Pipeline Association','Western Energy Alliance','Energy Marketers of America','National Stripper Well Association','Energy Infrastructure Council']},
  {key:'tech',name:'Big Tech + AI',long:'Big Tech and AI',
    about:'The largest tech platforms, chip and hardware makers and app companies, the AI companies and AI super PACs, and their trade groups. Telecom and cable aren\'t included.',
    pacIds:['C00428623','C00227546','C00360354','C00362707','C00328369','C00369751','C00125641','C00339085','C00498691','C00419036','C00375048','C00323048','C00502906','C00907683','C00416685'],
    patterns:['\\bGOOGLE\\b|\\bALPHABET\\b','\\bMICROSOFT\\b','\\bMETA PLATFORMS\\b|\\bFACEBOOK\\b','\\bAMAZON\\.?COM\\b|\\bAMAZON (SERVICES|WEB)','\\bAPPLE INC','\\bORACLE\\b','SALESFORCE','\\bIBM\\b|INTERNATIONAL BUSINESS MACHINES','\\bADOBE\\b','\\bINTEL CORP','QUALCOMM','ADVANCED MICRO DEVICES','CISCO SYSTEMS','\\bDELL\\b','\\bHP INC|HEWLETT','\\bUBER\\b','\\bNETFLIX\\b','\\bAIRBNB\\b','DOORDASH',
      'TECHNOLOGY NETWORK|\\bTECHNET\\b','INFORMATION TECHNOLOGY INDUSTRY COUNCIL','CONSUMER TECHNOLOGY ASSOCIATION','SEMICONDUCTOR INDUSTRY ASSOCIATION','SOFTWARE ALLIANCE','\\bNVIDIA\\b','PALANTIR','OPENAI','ANTHROPIC','ANDREESSEN'].map(P),
    routed:[],superPacs:SUPER_PACS.filter(p=>p.industry==='ai').map(p=>p.name),industries:['ai','both'],
    companies:['Alphabet (Google, YouTube)','Microsoft','Meta','Amazon','Apple','Oracle','Salesforce','IBM','Adobe','Intel','Qualcomm','AMD','Cisco','Dell','HP','Uber','Netflix','Airbnb','DoorDash','and the AI companies on the crypto and AI list'],
    groups:['TechNet','Information Technology Industry Council','Consumer Technology Association','Semiconductor Industry Association','BSA (The Software Alliance)']},
  {key:'crypto',name:'Crypto',long:'Crypto',
    about:'The crypto companies and the Fairshake and Fellowship super PACs, with the executives approved for naming.',
    pacIds:['C00804179','C00824896'],
    patterns:['COINBASE','\\bRIPPLE\\b','KRAKEN|PAYWARD','\\bGEMINI\\b','CIRCLE INTERNET','GALAXY DIGITAL','CONSENSYS','UNISWAP','PARADIGM OPERATIONS','JUMP TRADING','BLOCKCHAIN ASSOCIATION','ANDREESSEN','FAIRSHAKE'].map(P),
    routed:[],superPacs:SUPER_PACS.filter(p=>p.industry==='crypto').map(p=>p.name),industries:['crypto','both'],
    companies:['the crypto companies on the crypto and AI list'],groups:['Blockchain Association']}];
export const TRACKER=Object.fromEntries(TRACKERS.map(t=>[t.key,t]));

const cents=n=>Math.round(n*100)/100;
const upper=s=>String(s||'').toUpperCase();
// Is this PAC line (a committee ID and name) one of the tracker's PACs?
export const isTrackerPac=(t,l)=>(l?.cid&&t.pacIds.includes(l.cid))||t.patterns.some(r=>r.test(upper(l?.name)));
// The PAC lines on file in research.json for a reviewed profile ("pac.rows": [name index, amount, …]), with each
// committee's ID and full name.
export function researchPacLines(data,s){
  return (s?.pac?.rows||[]).map(([i,amount])=>{const cid=(data?.pacIds||[])[i]||null;return {cid,name:(cid&&data?.pacCommittees?.[cid]?.[0])||(data?.pacNames||[])[i]||'',amount:Number(amount)||0};}).filter(l=>l.amount>0);
}
// One period's PAC lines from two reads of the same checks: the reviewed reports (complete for their dates) and the
// refresh's whole-cycle list (the largest givers when there are many). Within a list a committee's checks add up; across
// the lists each committee counts once, at the larger total.
export function mergePacLines(...lists){
  const by=new Map();
  for(const list of lists){
    const own=new Map();
    for(const l of list||[])if(l&&l.amount>0){const k=l.cid||upper(l.name);const o=own.get(k)||{cid:l.cid||null,name:l.name||'',amount:0};o.amount=cents(o.amount+(Number(l.amount)||0));own.set(k,o);}
    for(const [k,o] of own){const was=by.get(k);if(!was||o.amount>was.amount)by.set(k,{...o,name:o.name||was?.name||''});}
  }
  return [...by.values()];
}
// One tracker's money to one campaign. pacLines: the period's PAC lines ([{cid, name, amount}]), or null when they
// haven't been read; routed: {group: amount} for the period; routedKnown: every gift routed to them was searched for;
// direct: {group: amount}, the group's own PAC checks to the campaign this cycle from its own reports (counted once
// with its PAC line, at the larger amount); employees: {industry: total} for the period, or null when not read.
// status: took (some PAC checks or routed gifts), none (none, with every needed record read), waiting (not read yet:
// never shown as none).
export function trackerMoney(t,{pacLines=null,routed=null,routedKnown=false,direct=null,employees=null}={}){
  const by=new Map();
  for(const l of pacLines||[])if(isTrackerPac(t,l)){const k=l.cid||upper(l.name);const o=by.get(k)||{cid:l.cid||null,name:l.name,amount:0,n:0};o.amount=cents(o.amount+l.amount);o.n++;by.set(k,o);}
  for(const [g,gp] of Object.entries(t.groupPacs||{})){const a=Number(direct?.[g])||0;if(!(a>0))continue;
    const o=by.get(gp.cid);if(!o)by.set(gp.cid,{cid:gp.cid,name:gp.name,amount:cents(a),n:1,own:true});else if(a>o.amount){o.amount=cents(a);o.own=true;}}
  const pacs=[...by.values()].sort((a,b)=>b.amount-a.amount),pac=cents(pacs.reduce((s,p)=>s+p.amount,0));
  const rt=cents(t.routed.reduce((s,g)=>s+(Number(routed?.[g])||0),0)),total=cents(pac+rt);
  const known=pacLines!=null&&(!t.routed.length||routedKnown);
  const emp=t.industries.length&&employees?cents(t.industries.reduce((s,k)=>s+(Number(employees[k])||0),0)):null;
  return {key:t.key,name:t.name,pacs,pac,routed:rt,total,employees:emp,status:total>0?'took':known?'none':'waiting'};
}
export const lookouts=inputs=>TRACKERS.map(t=>trackerMoney(t,inputs));
// Super PACs and a tracker, from the Super PACs page's data (/api/superpacs: each super PAC's spending for and against
// each candidate, and its largest gifts, organizations by name): its own super PACs by name, and the super PACs its
// companies and groups gave to (their gifts among the largest read), each with its spending for and against cand (an
// FEC candidate ID).
export function trackerSuperPacs(t,data,cand){
  const own=new Set(t.superPacs.map(upper)),spent=o=>{const c=(o.cands||[]).find(x=>x.cand===cand);return {for:cents(c?.for||0),against:cents(c?.against||0)};};
  const named=[],funded=[];
  for(const o of data?.superPacs||[]){
    if(own.has(upper(o.name)))named.push({id:o.id,name:o.name,total:o.total,...spent(o)});
    const orgs=(o.donors?.orgs||[]).filter(g=>t.patterns.some(r=>r.test(upper(g.name))));
    if(orgs.length&&!own.has(upper(o.name)))funded.push({id:o.id,name:o.name,given:cents(orgs.reduce((s,g)=>s+g.amount,0)),givers:orgs.map(g=>g.name),read:o.donors.orgs.reduce((s,g)=>s+g.amount,0)+(o.donors.indiv?.total||0),...spent(o)});
  }
  return {named,funded:funded.sort((a,b)=>b.given-a.given)};
}
