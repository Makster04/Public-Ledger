// The crypto and AI industry: the super PACs, companies and executives the "Crypto & AI industry" card on the Big Money Independence
// tab follows (approved 2026-11-08), and how FEC records are matched to them. Shared by the refresh (src/feeds.mjs,
// "industry-gifts"), which reads the gifts, and the page, which shows them. Shown only; no score uses it.
//
//   superPacs   their spending for and against a candidate, from the outside-spending records on file, matched by FEC
//               committee ID when known, otherwise by the exact name
//   companies   gifts from people who give the company as their employer (aliases: the spellings counted, compared
//               after normalizing; search: the words the FEC is asked for)
//   executives  gifts from each named leader, matched by first and last name and an employer on their list; shown by
//               name, as IntegrityIndex.us does
// Only gifts that match are kept; no other donor's name is ever saved.

export const INDUSTRY_LABEL={crypto:'Crypto',ai:'AI',both:'Crypto and AI'};

export const SUPER_PACS=[
  {name:'Fairshake',industry:'crypto',network:'Fairshake'},
  {name:'Defend American Jobs',industry:'crypto',network:'Fairshake',id:'C00836221'},
  {name:'Protect Progress',industry:'crypto',network:'Fairshake'},
  {name:'Fellowship PAC',industry:'crypto',network:'Fellowship PAC'},
  {name:'Leading the Future',industry:'ai',network:'Leading the Future'},
  {name:'Think Big',industry:'ai',network:'Leading the Future'},
  {name:'American Mission',industry:'ai',network:'Leading the Future',id:'C00916692'},
  {name:'Jobs and Democracy PAC',industry:'ai',network:'Public First'},
  {name:'Defending Our Values PAC',industry:'ai',network:'Public First'}];

export const COMPANIES=[
  {key:'coinbase',name:'Coinbase',industry:'crypto',aliases:['COINBASE','COINBASE GLOBAL'],search:['COINBASE']},
  {key:'ripple',name:'Ripple',industry:'crypto',aliases:['RIPPLE','RIPPLE LABS'],search:['RIPPLE']},
  {key:'kraken',name:'Kraken',industry:'crypto',aliases:['KRAKEN','PAYWARD','KRAKEN DIGITAL ASSET EXCHANGE'],search:['KRAKEN','PAYWARD']},
  {key:'gemini',name:'Gemini',industry:'crypto',aliases:['GEMINI','GEMINI TRUST','GEMINI SPACE STATION'],search:['GEMINI']},
  {key:'circle',name:'Circle',industry:'crypto',aliases:['CIRCLE INTERNET FINANCIAL','CIRCLE INTERNET','CIRCLE INTERNET GROUP'],search:['CIRCLE INTERNET']},
  {key:'galaxy',name:'Galaxy Digital',industry:'crypto',aliases:['GALAXY DIGITAL'],search:['GALAXY DIGITAL']},
  {key:'consensys',name:'Consensys',industry:'crypto',aliases:['CONSENSYS','CONSENSYS SOFTWARE'],search:['CONSENSYS']},
  {key:'uniswap',name:'Uniswap Labs',industry:'crypto',aliases:['UNISWAP LABS','UNISWAP','UNIVERSAL NAVIGATION'],search:['UNISWAP','UNIVERSAL NAVIGATION']},
  {key:'paradigm',name:'Paradigm',industry:'crypto',aliases:['PARADIGM OPERATIONS'],search:['PARADIGM OPERATIONS']},
  {key:'jump',name:'Jump Trading',industry:'crypto',aliases:['JUMP TRADING','JUMP CRYPTO'],search:['JUMP TRADING','JUMP CRYPTO']},
  {key:'blockchain-association',name:'Blockchain Association',industry:'crypto',aliases:['BLOCKCHAIN ASSOCIATION'],search:['BLOCKCHAIN ASSOCIATION']},
  {key:'a16z',name:'Andreessen Horowitz (a16z)',industry:'both',aliases:['ANDREESSEN HOROWITZ','A16Z','AH CAPITAL MANAGEMENT'],search:['ANDREESSEN','A16Z','AH CAPITAL']},
  {key:'openai',name:'OpenAI',industry:'ai',aliases:['OPENAI','OPEN AI','OPENAI OPCO'],search:['OPENAI','OPEN AI']},
  {key:'anthropic',name:'Anthropic',industry:'ai',aliases:['ANTHROPIC'],search:['ANTHROPIC']},
  {key:'xai',name:'xAI',industry:'ai',aliases:['XAI','X AI'],search:['XAI']},
  {key:'scale',name:'Scale AI',industry:'ai',aliases:['SCALE AI'],search:['SCALE AI']},
  {key:'perplexity',name:'Perplexity',industry:'ai',aliases:['PERPLEXITY','PERPLEXITY AI'],search:['PERPLEXITY']},
  {key:'databricks',name:'Databricks',industry:'ai',aliases:['DATABRICKS'],search:['DATABRICKS']},
  {key:'coreweave',name:'CoreWeave',industry:'ai',aliases:['COREWEAVE'],search:['COREWEAVE']},
  {key:'nvidia',name:'Nvidia',industry:'ai',aliases:['NVIDIA'],search:['NVIDIA']},
  {key:'palantir',name:'Palantir',industry:'ai',aliases:['PALANTIR','PALANTIR TECHNOLOGIES'],search:['PALANTIR']}];

// first: the first names (or their start) the FEC may record; search: the names the FEC is asked for; employers: the
// other employers they list on their gifts (their company's spellings always count).
export const EXECUTIVES=[
  {key:'armstrong',name:'Brian Armstrong',role:'CEO',company:'coinbase',last:'ARMSTRONG',first:['BRIAN'],search:['BRIAN ARMSTRONG']},
  {key:'grewal',name:'Paul Grewal',role:'chief legal officer',company:'coinbase',last:'GREWAL',first:['PAUL'],search:['PAUL GREWAL']},
  {key:'shirzad',name:'Faryar Shirzad',role:'chief policy officer',company:'coinbase',last:'SHIRZAD',first:['FARYAR'],search:['SHIRZAD']},
  {key:'garlinghouse',name:'Brad Garlinghouse',role:'CEO',company:'ripple',last:'GARLINGHOUSE',first:['BRAD'],search:['GARLINGHOUSE']},
  {key:'larsen',name:'Chris Larsen',role:'co-founder',company:'ripple',last:'LARSEN',first:['CHRIS'],search:['CHRIS LARSEN','CHRISTIAN LARSEN']},
  {key:'alderoty',name:'Stuart Alderoty',role:'chief legal officer',company:'ripple',last:'ALDEROTY',first:['STU'],search:['ALDEROTY']},
  {key:'cwinklevoss',name:'Cameron Winklevoss',role:'co-founder',company:'gemini',last:'WINKLEVOSS',first:['CAMERON'],search:['WINKLEVOSS'],employers:['WINKLEVOSS CAPITAL']},
  {key:'twinklevoss',name:'Tyler Winklevoss',role:'co-founder',company:'gemini',last:'WINKLEVOSS',first:['TYLER'],search:[],employers:['WINKLEVOSS CAPITAL']},
  {key:'powell',name:'Jesse Powell',role:'co-founder',company:'kraken',last:'POWELL',first:['JESSE'],search:['JESSE POWELL']},
  {key:'allaire',name:'Jeremy Allaire',role:'CEO',company:'circle',last:'ALLAIRE',first:['JEREMY'],search:['JEREMY ALLAIRE']},
  {key:'novogratz',name:'Mike Novogratz',role:'CEO',company:'galaxy',last:'NOVOGRATZ',first:['MIKE','MICHAEL'],search:['NOVOGRATZ']},
  {key:'lubin',name:'Joseph Lubin',role:'founder',company:'consensys',last:'LUBIN',first:['JOE','JOSEPH'],search:['JOSEPH LUBIN','JOE LUBIN']},
  {key:'hadams',name:'Hayden Adams',role:'founder',company:'uniswap',last:'ADAMS',first:['HAYDEN'],search:['HAYDEN ADAMS']},
  {key:'mhuang',name:'Matt Huang',role:'co-founder',company:'paradigm',last:'HUANG',first:['MATT'],search:['MATT HUANG','MATTHEW HUANG']},
  {key:'andreessen',name:'Marc Andreessen',role:'co-founder',company:'a16z',last:'ANDREESSEN',first:['MARC'],search:['ANDREESSEN']},
  {key:'horowitz',name:'Ben Horowitz',role:'co-founder',company:'a16z',last:'HOROWITZ',first:['BEN'],search:['BEN HOROWITZ','BENJAMIN HOROWITZ']},
  {key:'dixon',name:'Chris Dixon',role:'head of a16z crypto',company:'a16z',last:'DIXON',first:['CHRIS'],search:['CHRIS DIXON','CHRISTOPHER DIXON']},
  {key:'altman',name:'Sam Altman',role:'CEO',company:'openai',last:'ALTMAN',first:['SAM'],search:['SAM ALTMAN','SAMUEL ALTMAN']},
  {key:'brockman',name:'Greg Brockman',role:'president',company:'openai',last:'BROCKMAN',first:['GREG'],search:['GREG BROCKMAN','GREGORY BROCKMAN']},
  {key:'lehane',name:'Chris Lehane',role:'global affairs',company:'openai',last:'LEHANE',first:['CHRIS'],search:['CHRIS LEHANE','CHRISTOPHER LEHANE']},
  {key:'damodei',name:'Dario Amodei',role:'CEO',company:'anthropic',last:'AMODEI',first:['DARIO'],search:['AMODEI']},
  {key:'daamodei',name:'Daniela Amodei',role:'president',company:'anthropic',last:'AMODEI',first:['DANIELA'],search:[]},
  {key:'jclark',name:'Jack Clark',role:'co-founder',company:'anthropic',last:'CLARK',first:['JACK'],search:['JACK CLARK']},
  {key:'musk',name:'Elon Musk',role:'founder',company:'xai',last:'MUSK',first:['ELON'],search:['ELON MUSK'],employers:['TESLA','TESLA MOTORS','SPACEX','SPACE EXPLORATION TECHNOLOGIES','X','THE BORING','NEURALINK']},
  {key:'srinivas',name:'Aravind Srinivas',role:'CEO',company:'perplexity',last:'SRINIVAS',first:['ARAVIND'],search:['ARAVIND SRINIVAS']},
  {key:'ghodsi',name:'Ali Ghodsi',role:'CEO',company:'databricks',last:'GHODSI',first:['ALI'],search:['GHODSI']},
  {key:'intrator',name:'Michael Intrator',role:'CEO',company:'coreweave',last:'INTRATOR',first:['MIKE','MICHAEL'],search:['INTRATOR']},
  {key:'jhuang',name:'Jensen Huang',role:'CEO',company:'nvidia',last:'HUANG',first:['JENSEN','JEN HSUN'],search:['JENSEN HUANG']},
  {key:'karp',name:'Alex Karp',role:'CEO',company:'palantir',last:'KARP',first:['ALEX'],search:['ALEX KARP','ALEXANDER KARP']},
  {key:'thiel',name:'Peter Thiel',role:'co-founder and chairman',company:'palantir',last:'THIEL',first:['PETER'],search:['PETER THIEL'],employers:['THIEL CAPITAL','FOUNDERS FUND']}];

const COMPANY=new Map(COMPANIES.map(c=>[c.key,c]));
// An employer as written on a gift, made comparable: capitals, no punctuation, and no INC, LLC, CORP and the like.
const SUFFIX=/\s+(INC|INCORPORATED|LLC|L L C|LP|LLP|CORP|CORPORATION|CO|COMPANY|PBC|LTD|LIMITED|HOLDINGS)$/;
export function normEmployer(s){
  let t=String(s||'').toUpperCase().replace(/&/g,' AND ').replace(/[.,'"’()]/g,'').replace(/[^A-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  for(let k=0;k<3&&SUFFIX.test(t);k++)t=t.replace(SUFFIX,'').trim();
  return t;
}
const ALIAS=new Map(COMPANIES.flatMap(c=>c.aliases.map(a=>[normEmployer(a),c.key])));
export const companyByEmployer=employer=>ALIAS.get(normEmployer(employer))||null;
// Which listed executive gave this gift: the same last name, a first name starting as theirs does, and an employer on
// their list (their company's spellings, or the other employers they give).
export function executiveFor(r){
  const last=String(r?.contributor_last_name||String(r?.contributor_name||'').split(',')[0]||'').toUpperCase().trim();
  const first=String(r?.contributor_first_name||String(r?.contributor_name||'').split(',')[1]||'').toUpperCase().trim();
  const emp=normEmployer(r?.contributor_employer);
  return EXECUTIVES.find(x=>x.last===last&&x.first.some(f=>first.startsWith(f))&&(companyByEmployer(emp)===x.company||(x.employers||[]).some(e=>normEmployer(e)===emp)))||null;
}
// The FEC searches for one campaign and cycle: employers ten at a time (the FEC takes at most ten names per request),
// then executives' names ten at a time.
export function industryQueries(){
  const chunk=(a,n=10)=>a.reduce((o,x,i)=>(i%n?o[o.length-1].push(x):o.push([x]),o),[]);
  return [...chunk([...new Set(COMPANIES.flatMap(c=>c.search))]).map(v=>({param:'contributor_employer',values:v})),
    ...chunk([...new Set(EXECUTIVES.flatMap(x=>x.search))]).map(v=>({param:'contributor_name',values:v}))];
}
// One FEC record as the refresh keeps it, or null when it is no one on the lists. Memo entries (a joint fundraiser's
// shares, credited elsewhere) are left out. Only the company, the executive's key, the amount and the date are kept.
export function industryRow(r){
  if(!r||String(r.memo_code||'').toUpperCase()==='X')return null;
  const amount=Number(r.contribution_receipt_amount);if(!Number.isFinite(amount))return null;
  const ex=executiveFor(r),co=ex?.company||companyByEmployer(r.contributor_employer);
  if(!co)return null;
  return {id:String(r.sub_id??r.transaction_id??''),co,ex:ex?.key||null,amount:Math.round(amount*100)/100,date:String(r.contribution_receipt_date||'').slice(0,10)||null};
}
// One cycle's gifts: by industry, each company's total (its executives' part inside it), and each executive's gifts.
export function industryGifts(rows){
  const by=new Map();
  for(const r of rows||[]){if(!r?.co)continue;const k=String(r.id);if(!by.has(k))by.set(k,r);}
  const out={total:0,n:0,industries:{}};
  for(const r of by.values()){
    const c=COMPANY.get(r.co);if(!c)continue;
    const ind=out.industries[c.industry]||={label:INDUSTRY_LABEL[c.industry],total:0,n:0,companies:{},executives:{}};
    const co=ind.companies[c.key]||={key:c.key,name:c.name,total:0,n:0,exec:0,execN:0};
    co.total+=r.amount;co.n++;ind.total+=r.amount;ind.n++;out.total+=r.amount;out.n++;
    if(r.ex){const x=EXECUTIVES.find(e=>e.key===r.ex);const e=ind.executives[r.ex]||={key:r.ex,name:x?.name||r.ex,role:x?.role||'',company:c.name,total:0,n:0};e.total+=r.amount;e.n++;co.exec+=r.amount;co.execN++;}
  }
  const round=n=>Math.round(n*100)/100;
  out.total=round(out.total);
  for(const ind of Object.values(out.industries)){
    ind.total=round(ind.total);
    ind.companies=Object.values(ind.companies).map(c=>({...c,total:round(c.total),exec:round(c.exec)})).sort((a,b)=>b.total-a.total);
    ind.executives=Object.values(ind.executives).map(e=>({...e,total:round(e.total)})).sort((a,b)=>b.total-a.total);
  }
  return out;
}
// The listed super PACs' spending for and against this person, from the outside-spending records on file (research.json
// out.cms rows [committee index, for, against, …] and ie.cm [ID, name, …]).
const normCmte=s=>String(s||'').toUpperCase().replace(/[.,'"’]/g,'').replace(/\s+INC$/,'').replace(/\s+/g,' ').trim();
export function industrySuperPacs(out,ieCm){
  const rows=[];
  for(const x of out?.cms||[]){
    const cm=(ieCm||[])[x[0]];if(!cm)continue;
    const sp=SUPER_PACS.find(p=>(p.id&&p.id===cm[0])||normCmte(p.name)===normCmte(cm[1]));if(!sp)continue;
    if(!(x[1]>0||x[2]>0))continue;
    rows.push({name:sp.name,id:cm[0],industry:sp.industry,network:sp.network,for:Math.round((x[1]||0)*100)/100,against:Math.round((x[2]||0)*100)/100});
  }
  const sum=(k,ind)=>Math.round(rows.filter(r=>!ind||r.industry===ind).reduce((t,r)=>t+r[k],0)*100)/100;
  return {rows:rows.sort((a,b)=>b.for+b.against-(a.for+a.against)),for:sum('for'),against:sum('against'),
    byIndustry:Object.fromEntries(['crypto','ai'].map(k=>[k,{for:sum('for',k),against:sum('against',k)}]))};
}
