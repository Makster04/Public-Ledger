// The trackers: seven lobbies whose money the site follows on each profile (the Big Money Independence tab's "Trackers" and its
// "Summary of Major Lookouts") and on the Trackers page. Shown only; no grade uses them. Approved 2026-11-11 (Big Defense,
// Wall Street, and insurers and PBMs added to Big Pharma, 2026-11-13; AIPAC widened to the Pro-Israel Lobby, 2026-11-14).
//
// For each tracker:
//   pacIds / patterns   its PACs: the FEC committee IDs on file (checked by hand), and name patterns for committees not on
//                       file yet (a PAC line's committee name, in capitals)
//   routed              its groups whose routed ("bundled") gifts count (research.json "bundled", scripts/build-bundled.mjs)
//   groupPacs           each such group's own PAC: the reader of routed gifts also adds up that PAC's own checks to the
//                       campaign over the whole cycle ("direct"), which fills in a check the PAC lines read don't reach
//   donors              named individual donors whose own checks to a campaign count (approved by name; no other
//                       donor's name is ever saved): key, name, the FEC search ("LAST, FIRST"), and the last name, first
//                       names and states a gift must match, and for a common name also an employer, city or occupation on
//                       the gift (employers, cities, occupations). Read by npm run corporate:pacs into tracker-history.json.
//   pacsLabel, routedLabel  how the page names its PACs and the groups whose passed-on gifts count, when "<name>'s PACs"
//                       doesn't read well
//   superPacs           its own super PACs, by name (their spending for and against a candidate); superPacIds: their
//                       FEC committee IDs where known. superPacLine: the Summary of Major Lookouts shows their spending
//                       as an extra line (approved 2026-11-11 for Crypto and Big Tech + AI, whose money mostly arrives
//                       that way, and then for AIPAC's United Democracy Project); it never changes the mark
//   industries          the employee-gift groups the refresh reads for it (public/industries.js, "industry-gifts")
//   companies, groups   who it follows, as listed on the page
//   icon                its emoji, after its name on the Summary of Major Lookouts (approved 2026-11-13)
//   emoji               the one the report card shows as its icon, without the 🎁 (the row's heading says "gifts")
// A lookout counts what the campaign took: PAC checks, and gifts the group routed to it. Employees' own gifts are shown
// beside it, and super PAC spending only in the tracker: a super PAC spends on its own, often against the candidate.
import {SUPER_PACS} from './industries.js';

const P=s=>new RegExp(s);
export const TRACKERS=[
  // The key stays 'aipac' (links, files). Its PACs: AIPAC's, the PACs that say on their own sites that they exist to support
  // Israel or the U.S.-Israel relationship (NORPAC, JACPAC, To Protect Our Heritage, U.S. Israel PAC, CityPAC, DMFI PAC),
  // the Republican Jewish Coalition's (approved), and those named for supporting Israel. Not J Street's (approved
  // 2026-11-14: it often backs candidates AIPAC works against), and not those that don't say so (checked 2026-11-14:
  // the Maryland Association for Concerned Citizens PAC, Mid Manhattan PAC, NATPAC 1947).
  {key:'aipac',icon:'🇮🇱🎁',emoji:'🇮🇱',name:'Pro-Israel Lobby',card:'Pro-Israel',long:'Pro-Israel Lobby (AIPAC and other pro-Israel PACs)',
    about:'AIPAC and the PACs that say they exist to support Israel or the U.S.–Israel relationship (NORPAC, JACPAC, To Protect Our Heritage PAC, U.S. Israel PAC, CityPAC, DMFI PAC, the Republican Jewish Coalition\'s PAC and others named for Israel): their PACs\' checks, the gifts AIPAC, NORPAC, JACPAC and the RJC collect from donors and pass on to campaigns, the named donors\' own checks (Miriam and Sheldon Adelson, and the 20 people who gave AIPAC\'s super PAC $1 million or more), and that super PAC, United Democracy Project. J Street isn\'t included.',
    // (by ID where the committee is on file; U.S. Israel PAC, CityPAC and the PACs named for Israel by their FEC names)
    pacIds:['C00797670','C00247403','C00139659','C00135541','C00710848','C00345132'],
    patterns:['^AMERICAN ISRAEL PUBLIC AFFAIRS','^AIPAC\\b','^NORPAC\\b','^JOINT ACTION COMMITTEE FOR POLITICAL AFFAIRS','\\bJACPAC\\b','^TO PROTECT OUR HERITAGE','^U\\.? ?S\\.? ISRAEL PAC|\\bUSI PAC\\b','^CITYPAC\\b','^DMFI PAC|DEMOCRATIC MAJORITY FOR ISRAEL','REPUBLICAN JEWISH COALITION','FRIENDS OF ISRAEL','^AMERICAN PRO-ISRAEL PAC','^PRO-ISRAEL AMERICA','DEFENDERS OF ISRAEL','U\\.?S\\.? ISRAEL FRIENDSHIP','CHRISTIANS FOR ISRAEL','DEMOCRATS FOR ISRAEL'].map(P),
    routed:['aipac','fec:C00247403','fec:C00139659','fec:C00345132'],
    groupPacs:{aipac:{cid:'C00797670',name:'AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE'}},
    // Named donors (approved 2026-11-14): Miriam and Sheldon Adelson, and every individual who gave United Democracy
    // Project, AIPAC's super PAC, $1 million or more in 2021–2026 (the FEC's records of its receipts). What the site says
    // about them is that giving, never a label for their beliefs. A common name is matched by its employer on the gift, in
    // any state (people move: Paul Singer's gifts now come from Florida); the Rubins by their state, city and occupation;
    // every other name by the states on their UDP gifts.
    donors:[{key:'madelson',name:'Miriam Adelson',search:'ADELSON, MIRIAM',last:'ADELSON',first:['MIRIAM'],states:['NV']},
      {key:'sadelson',name:'Sheldon Adelson',search:'ADELSON, SHELDON',last:'ADELSON',first:['SHELDON'],states:['NV']},
      {key:'koum',name:'Jan Koum',search:'KOUM, JAN',last:'KOUM',first:['JAN'],states:['CA']},
      {key:'jjacobson',name:'Jonathon Jacobson',search:'JACOBSON, JONATHON',last:'JACOBSON',first:['JONATHON'],states:['MA']},
      {key:'psinger',name:'Paul Singer',search:'SINGER, PAUL',last:'SINGER',first:['PAUL'],states:[],employers:['ELLIOTT']},
      {key:'saban',name:'Haim Saban',search:'SABAN, HAIM',last:'SABAN',first:['HAIM'],states:['CA']},
      {key:'bmarcus',name:'Bernard Marcus',search:'MARCUS, BERNARD',last:'MARCUS',first:['BERNARD','BERNIE'],states:[],employers:['HOME DEPOT','MARCUS FOUNDATION']},
      {key:'hlerner',name:'Helaine Lerner',search:'LERNER, HELAINE',last:'LERNER',first:['HELAINE'],states:['NY']},
      {key:'mrowan',name:'Marc Rowan',search:'ROWAN, MARC',last:'ROWAN',first:['MARC'],states:['NY']},
      {key:'zalik',name:'David Zalik',search:'ZALIK, DAVID',last:'ZALIK',first:['DAVID'],states:['GA']},
      {key:'lrubin',name:'Linda Rubin',search:'RUBIN, LINDA',last:'RUBIN',first:['LINDA'],states:['CA'],cities:['LOS ANGELES'],occupations:['INVESTOR']},
      {key:'bfrank',name:'Blair Frank',search:'FRANK, BLAIR',last:'FRANK',first:['BLAIR'],states:[],employers:['CAPITAL GROUP']},
      {key:'vkohn',name:'Victor Kohn',search:'KOHN, VICTOR',last:'KOHN',first:['VICTOR'],states:['CA']},
      {key:'leffell',name:'Michael Leffell',search:'LEFFELL, MICHAEL',last:'LEFFELL',first:['MICHAEL'],states:['NY']},
      {key:'ahartman',name:'Alan Hartman',search:'HARTMAN, ALAN',last:'HARTMAN',first:['ALAN'],states:[],employers:['CENTERVIEW']},
      {key:'schwartzberg',name:'Andrew Schwartzberg',search:'SCHWARTZBERG, ANDREW',last:'SCHWARTZBERG',first:['ANDREW'],states:['CA']},
      {key:'detoledo',name:'Phil de Toledo',search:'DE TOLEDO, PHIL',last:'DETOLEDO',first:['PHIL'],states:['CA']},
      {key:'sgrossman',name:'Sanford Grossman',search:'GROSSMAN, SANFORD',last:'GROSSMAN',first:['SANFORD'],states:['CO']},
      {key:'dmesser',name:'David Messer',search:'MESSER, DAVID',last:'MESSER',first:['DAVID'],states:[],employers:['FREEPOINT']},
      {key:'rayant',name:'Garry Rayant',search:'RAYANT, GARRY',last:'RAYANT',first:['GARRY'],states:['CA']},
      {key:'plevy',name:'Paul Levy',search:'LEVY, PAUL',last:'LEVY',first:['PAUL'],states:[],employers:['JLL']},
      {key:'trubin',name:'Tony Rubin',search:'RUBIN, TONY',last:'RUBIN',first:['TONY','ANTHONY'],states:['CA'],cities:['LOS ANGELES'],occupations:['INVESTOR']}],
    pacsLabel:'the pro-Israel PACs',routedLabel:'AIPAC, NORPAC, JACPAC and the RJC',
    superPacs:['United Democracy Project'],superPacLine:true,industries:[],
    companies:[],groups:['AIPAC PAC','NORPAC','JACPAC','To Protect Our Heritage PAC','U.S. Israel PAC (USI PAC)','CityPAC','DMFI PAC','Republican Jewish Coalition PAC']},
  {key:'pharma',icon:'💊🎁',emoji:'💊',name:'Big Pharma + Insurance',card:'Pharma + Ins.',long:'Big Pharma + Insurance (drugmakers, health insurers and PBMs)',
    about:'Drugmakers, health insurers and the pharmacy benefit managers (PBMs) the biggest insurers own, and their trade groups. Drugmakers and insurers often lobby against each other on drug prices; both give most to the health committees. Medical device makers, distributors, hospitals and drugstore chains aren\'t included.',
    pacIds:['C00251876','C00536573','C00016683','C00010983','C00199257','C00097485','C00082792','C00468660','C00021972','C00199703','C00355677','C00396895','C00332395','C00420398','C00390351','C00424838','C00033969','C00281162','C00562264','C00035675','C00441733','C00780171','C00144345',
      'C00084061','C00085316','C00161141','C00194746','C00197228','C00199711','C00271007','C00274431','C00276311','C00384818','C00388819','C00397851','C00430256','C00450056','C00457242'],
    patterns:['\\bPFIZER\\b','\\bMERCK\\b','JOHNSON (AND|&) JOHNSON','\\bABBVIE\\b','ELI LILLY','BRISTOL[- ]MYERS','\\bAMGEN\\b','\\bGILEAD\\b','\\bREGENERON\\b','\\bVERTEX PHARM','\\bBIOGEN\\b','\\bMODERNA\\b','\\bNOVARTIS\\b','\\bSANOFI\\b','GLAXOSMITHKLINE|\\bGSK\\b','ASTRAZENECA','NOVO NORDISK','\\bGENENTECH\\b','\\bBAYER\\b','BOEHRINGER','\\bTAKEDA\\b','\\bTEVA\\b','\\bVIATRIS\\b','\\bORGANON\\b','PHARMACEUTICAL RESEARCH (AND|&) MANUFACTURERS|\\bPHRMA\\b','BIOTECHNOLOGY INNOVATION ORGANIZATION','ASSOCIATION FOR ACCESSIBLE MEDICINES',
      // Health insurers and PBMs (added 2026-11-13).
      'UNITEDHEALTH|\\bOPTUM\\b','ELEVANCE HEALTH|\\bANTHEM\\b','\\bCIGNA\\b','EXPRESS SCRIPTS','\\bHUMANA\\b','\\bCENTENE\\b','CVS HEALTH|\\bAETNA\\b|CAREMARK','MOLINA HEALTHCARE','BLUE ?CROSS|BLUE ?SHIELD|\\bBLUEPAC\\b','HEALTH CARE SERVICE CORP',
      '\\bHIGHMARK\\b','GUIDEWELL','PREMERA','HORIZON HEALTHCARE SERVICES','CAREFIRST','AMERICA\'?S HEALTH INSURANCE PLANS|\\bAHIP\\b','PHARMACEUTICAL CARE MANAGEMENT|\\bPCMA\\b','PRIME THERAPEUTICS'].map(P),
    routed:[],superPacs:[],industries:[],
    companies:['Pfizer','Merck','Johnson & Johnson','AbbVie','Eli Lilly','Bristol Myers Squibb','Amgen','Gilead','Regeneron','Vertex','Biogen','Moderna','Novartis','Sanofi','GSK','AstraZeneca','Novo Nordisk','Genentech (Roche)','Bayer','Boehringer Ingelheim','Takeda','Teva','Viatris','Organon','UnitedHealth Group (Optum Rx)','CVS Health (Aetna, Caremark)','Cigna (Express Scripts)','Elevance Health (Anthem)','Humana','Centene','Molina Healthcare','the Blue Cross Blue Shield plans','Prime Therapeutics'],
    groups:['PhRMA','BIO (Biotechnology Innovation Organization)','Association for Accessible Medicines','AHIP (America\'s Health Insurance Plans)','Blue Cross Blue Shield Association','PCMA (the PBMs\' trade group)']},
  {key:'oil',icon:'🛢️🎁',emoji:'🛢️',name:'Big Oil',long:'Big Oil (oil and gas)',
    about:'Oil and gas producers, refiners, pipelines and LNG, oilfield services, and their trade groups. Koch Industries, coal and mining, and gas utilities aren\'t included.',
    pacIds:['C00035006','C00513549','C00121368','C00040394','C00755454','C00551184','C00109546','C00354753','C00342766','C00246306','C00035204','C00483677','C00430157','C00496307','C00112896','C00429662','C00039503','C00525055','C00035691','C00431932','C00686287','C00083857','C00116145','C00426569','C00415026','C00736421','C00488080','C00510016','C00721647','C00215384','C00135855','C00486779','C00151175','C00438754','C00705996','C00279224','C00496752','C00567081'],
    patterns:['\\bEXXON','\\bCHEVRON\\b','CONOCOPHILLIPS','OCCIDENTAL PETROLEUM','\\bEOG RESOURCES','DEVON ENERGY','DIAMONDBACK ENERGY','CONTINENTAL RESOURCES','COTERRA','OVINTIV','\\bAPACHE CORP','\\bAPA CORP','\\bEQT CORP','EXPAND ENERGY','CHESAPEAKE ENERGY','ANTERO RESOURCES','DIVERSIFIED (GAS|ENERGY)','HILCORP','\\bSHELL (OIL|USA|EMPLOYEE|PETROLEUM)','\\bBP (AMERICA|CORPORATION NORTH)',
      'MARATHON PETROLEUM','\\bVALERO\\b','PHILLIPS 66','HF SINCLAIR','DELEK US','PBF (ENERGY|HOLDING)','ENERGY TRANSFER','KINDER MORGAN','WILLIAMS COMPANIES','ENTERPRISE PRODUCTS','\\bONEOK\\b','TARGA RESOURCES','PLAINS ALL AMERICAN','ENBRIDGE','TRANSCANADA|\\bTC ENERGY','CHENIERE','VENTURE GLOBAL','NEXTDECADE','HALLIBURTON','SCHLUMBERGER|\\bSLB\\b','BAKER HUGHES',
      'AMERICAN PETROLEUM INSTITUTE','INDEPENDENT PETROLEUM ASSOCIATION|\\bIPAA\\b|WILDCATTERS FUND','AMERICAN EXPLORATION (AND|&) PRODUCTION|\\bAXPC\\b|^US ENERGY PAC','AMERICAN FUELS? (AND|&) PETROCHEMICAL','INTERSTATE NATURAL GAS ASSOCIATION','LIQUID ENERGY PIPELINE','WESTERN ENERGY ALLIANCE','ENERGY MARKETERS OF AMERICA','STRIPPER WELL','ENERGY INFRASTRUCTURE COUNCIL'].map(P),
    routed:[],superPacs:[],industries:[],
    companies:['ExxonMobil','Chevron','ConocoPhillips','Occidental Petroleum','EOG Resources','Devon Energy','Diamondback Energy','Continental Resources','Coterra Energy','Ovintiv','APA (Apache)','EQT','Expand Energy (Chesapeake)','Antero Resources','Diversified Energy','Hilcorp','Shell USA','BP America',
      'Marathon Petroleum','Valero','Phillips 66','HF Sinclair','Delek US','PBF Energy','Energy Transfer','Kinder Morgan','Williams Companies','Enterprise Products','ONEOK','Targa Resources','Plains All American','Enbridge','TC Energy (TransCanada)','Cheniere','Venture Global','NextDecade','Halliburton','SLB (Schlumberger)','Baker Hughes'],
    groups:['American Petroleum Institute','Independent Petroleum Association of America (Wildcatters Fund)','American Exploration & Production Council (US Energy PAC)','American Fuel & Petrochemical Manufacturers','Interstate Natural Gas Association of America','Liquid Energy Pipeline Association','Western Energy Alliance','Energy Marketers of America','National Stripper Well Association','Energy Infrastructure Council']},
  {key:'tech',icon:'🤖🎁',emoji:'🤖',name:'Big Tech + AI',long:'Big Tech and AI',
    about:'The largest tech platforms, chip and hardware makers and app companies, the AI companies and AI super PACs, and their trade groups. Telecom and cable aren\'t included.',
    pacIds:['C00428623','C00227546','C00360354','C00362707','C00328369','C00369751','C00125641','C00339085','C00498691','C00419036','C00375048','C00323048','C00502906','C00907683','C00416685'],
    patterns:['\\bGOOGLE\\b|\\bALPHABET\\b','\\bMICROSOFT\\b','\\bMETA PLATFORMS\\b|\\bFACEBOOK\\b','\\bAMAZON\\.?COM\\b|\\bAMAZON (SERVICES|WEB)','\\bAPPLE INC','\\bORACLE\\b','SALESFORCE','\\bIBM\\b|INTERNATIONAL BUSINESS MACHINES','\\bADOBE\\b','\\bINTEL CORP','QUALCOMM','ADVANCED MICRO DEVICES','CISCO SYSTEMS','\\bDELL\\b','\\bHP INC|HEWLETT','\\bUBER\\b','\\bNETFLIX\\b','\\bAIRBNB\\b','DOORDASH',
      'TECHNOLOGY NETWORK|\\bTECHNET\\b','INFORMATION TECHNOLOGY INDUSTRY COUNCIL','CONSUMER TECHNOLOGY ASSOCIATION','SEMICONDUCTOR INDUSTRY ASSOCIATION','SOFTWARE ALLIANCE','\\bNVIDIA\\b','PALANTIR','OPENAI','ANTHROPIC','ANDREESSEN'].map(P),
    routed:[],superPacs:SUPER_PACS.filter(p=>p.industry==='ai').map(p=>p.name),superPacIds:SUPER_PACS.filter(p=>p.industry==='ai'&&p.id).map(p=>p.id),superPacLine:true,industries:['ai','both'],
    companies:['Alphabet (Google, YouTube)','Microsoft','Meta','Amazon','Apple','Oracle','Salesforce','IBM','Adobe','Intel','Qualcomm','AMD','Cisco','Dell','HP','Uber','Netflix','Airbnb','DoorDash','and the AI companies on the crypto and AI list'],
    groups:['TechNet','Information Technology Industry Council','Consumer Technology Association','Semiconductor Industry Association','BSA (The Software Alliance)']},
  {key:'crypto',icon:'🤑🎁',emoji:'🤑',name:'Crypto',long:'Crypto',
    about:'The crypto companies and the Fairshake and Fellowship super PACs, with the executives approved for naming.',
    pacIds:['C00804179','C00824896'],
    patterns:['COINBASE','\\bRIPPLE\\b','KRAKEN|PAYWARD','\\bGEMINI\\b','CIRCLE INTERNET','GALAXY DIGITAL','CONSENSYS','UNISWAP','PARADIGM OPERATIONS','JUMP TRADING','BLOCKCHAIN ASSOCIATION','ANDREESSEN','FAIRSHAKE'].map(P),
    routed:[],superPacs:SUPER_PACS.filter(p=>p.industry==='crypto').map(p=>p.name),superPacIds:SUPER_PACS.filter(p=>p.industry==='crypto'&&p.id).map(p=>p.id),superPacLine:true,industries:['crypto','both'],
    companies:['the crypto companies on the crypto and AI list'],groups:['Blockchain Association']},
  {key:'defense',icon:'🪖🎁',emoji:'🪖',name:'Big Defense',long:'Big Defense (defense contractors)',
    about:'Defense contractors: the makers of weapons, warships, military aircraft and engines, munitions and drones, and military services and IT. Commercial-only aerospace, space launch companies, and the rest of GE and Honeywell aren\'t included. The defense trade groups (the Aerospace Industries Association, the National Defense Industrial Association) have no PACs. Palantir also counts in Big Tech + AI.',
    // Approved 2026-11-13. Palantir's PAC (C00498691) is Big Tech + AI's by ID and counts here by name.
    pacIds:['C00303024','C00097568','C00078451','C00088591','C00142711','C00100321','C00129122','C00281212','C00546234','C00709816','C00208983','C00383992','C00731414','C00760710','C00215285','C00123612','C00367995','C00365502','C00686709','C00797530','C00516864','C00763623','C00782532','C00919555','C00275123','C00890830','C00437566','C00024869'],
    patterns:['LOCKHEED','RAYTHEON|\\bRTX\\b','GENERAL DYNAMICS','NORTHROP','\\bBOEING\\b(?!.*CREDIT UNION)','L3HARRIS|AEROJET','\\bBAE SYSTEMS','HUNTINGTON INGALLS','\\bLEIDOS\\b','SCIENCE APPLICATIONS INTERNATIONAL','BOOZ ALLEN','\\bCACI\\b','\\bKBR\\b','MANTECH','PERATON','AMENTUM|CRITICAL MISSION SOLUTIONS','\\bV2X\\b|VECTRUS','PARSONS CORP',
      'GENERAL ATOMICS','TEXTRON','SIERRA NEVADA (CORPORATION|COMPANY)','BWX TECHNOLOGIES','CURTISS[- ]WRIGHT','MERCURY SYSTEMS','KRATOS DEFENSE','AEROVIRONMENT','OSHKOSH CORP','AUSTAL','ANDURIL','PALANTIR','SHIELD AI','EPIRUS','SARONIC',
      'LEONARDO DRS|\\bDRS TECHNOLOGIES','RHEINMETALL','ELBIT SYSTEMS','^SAAB\\b','THALES','\\bNAMMO\\b','GE AEROSPACE|GENERAL ELECTRIC COMPANY AEROSPACE','HONEYWELL AEROSPACE'].map(P),
    routed:[],superPacs:[],industries:[],
    companies:['Lockheed Martin','RTX (Raytheon)','General Dynamics','Northrop Grumman','Boeing','L3Harris (and Aerojet Rocketdyne)','BAE Systems','Huntington Ingalls','Leidos','SAIC','Booz Allen Hamilton','CACI','KBR','ManTech','Peraton','Amentum','V2X','Parsons','General Atomics','Textron','Sierra Nevada','BWX Technologies','Curtiss-Wright','Mercury Systems','Kratos','AeroVironment','Oshkosh','Austal USA','Anduril','Palantir','Shield AI','Epirus','Saronic','Leonardo DRS','Rheinmetall','Elbit America','Saab','Thales USA','Nammo','GE Aerospace','Honeywell Aerospace'],
    groups:[]},
  {key:'wallstreet',icon:'💰🎁',emoji:'💰',name:'Wall Street',long:'Wall Street (big banks, investment firms and private equity)',
    about:'The big banks, investment banks and asset managers, private equity, trading firms, the stock and futures exchanges, the card companies and brokerages, and their national trade groups. Community banks and the state bankers associations, credit unions, and insurance companies aren\'t included.',
    // Approved 2026-11-13.
    pacIds:['C00004275','C00008474','C00017558','C00034595','C00035519','C00035535','C00040535','C00072751','C00076299','C00104299','C00105981','C00133389','C00186064','C00253369','C00300178','C00306894','C00326595','C00327072','C00337626','C00350744','C00364778','C00365122','C00366013','C00380550','C00386524','C00410266','C00410274','C00410407','C00431312','C00479246','C00486217','C00488882','C00494534','C00495002','C00515148','C00579540','C00589119','C00689091'],
    patterns:['JPMORGAN|J\\.? ?P\\.? MORGAN','GOLDMAN SACHS','MORGAN STANLEY','BANK OF AMERICA','CITIGROUP|\\bCITI PAC','WELLS FARGO','U\\.?S\\.? BANCORP','PNC FINANCIAL','\\bTRUIST\\b','CAPITAL ONE','BANK OF NEW YORK MELLON|\\bBNY (BIPAC|FEDPAC)','STATE STREET (BANK|CORP)','NORTHERN TRUST','SANTANDER',
      'BLACKROCK','VANGUARD GROUP','FMR LLC|\\(FIDELITY PAC\\)','\\bINVESCO\\b','CHARLES SCHWAB','EDWARD JONES|EDJ HOLDING','LPL FINANCIAL','RAYMOND JAMES','ROBINHOOD',
      'BLACKSTONE','\\bKKR\\b|KOHLBERG KRAVIS','CARLYLE (GROUP|PAC)','APOLLO (GLOBAL|MANAGEMENT)','\\bARES MANAGEMENT','CITADEL','ELLIOTT MANAGEMENT',
      'NASDAQ','INTERCONTINENTAL EXCHANGE|NEW YORK STOCK EXCHANGE','CME GROUP','\\bCBOE\\b','\\bVISA,? INC','MASTERCARD','AMERICAN EXPRESS','DISCOVER FINANCIAL','SYNCHRONY','ALLY FINANCIAL',
      'AMERICAN BANKERS ASSOC','BANK POLICY INSTITUTE','CONSUMER BANKERS ASSOC','SECURITIES INDUSTRY AND FINANCIAL MARKETS|\\bSIFMA\\b','INVESTMENT COMPANY INSTITUTE','AMERICAN INVESTMENT COUNCIL','MANAGED FUNDS ASSOC','FUTURES INDUSTRY'].map(P),
    routed:[],superPacs:[],industries:[],
    companies:['JPMorgan Chase','Goldman Sachs','Morgan Stanley','Bank of America','Citigroup','Wells Fargo','U.S. Bancorp','PNC','Truist','Capital One','BNY','State Street','Northern Trust','Santander US','BlackRock','Vanguard','Fidelity','Invesco','Edward Jones','LPL Financial','Robinhood','Carlyle','Citadel Securities','Nasdaq','Intercontinental Exchange (NYSE)','CME Group','Cboe','Visa','Mastercard','American Express','Discover','Synchrony','Ally'],
    groups:['American Bankers Association (BankPAC)','Bank Policy Institute','Consumer Bankers Association','SIFMA','Investment Company Institute','American Investment Council (private equity)','Managed Funds Association (hedge funds)','Futures Industry Association']}];
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
    for(const l of list||[])if(l&&l.amount>0){const k=l.cid||upper(l.name);const o=own.get(k)||{cid:l.cid||null,name:l.name||'',amount:0,...(l.bulk?{bulk:true}:{})};o.amount=cents(o.amount+(Number(l.amount)||0));own.set(k,o);}
    for(const [k,o] of own){const was=by.get(k);if(!was||o.amount>was.amount)by.set(k,{...o,name:o.name||was?.name||''});}
  }
  return [...by.values()];
}
// One tracker's money to one campaign. pacLines: the period's PAC lines ([{cid, name, amount}]), or null when they
// haven't been read; routed: {group: amount} for the period; routedKnown: every gift routed to them was searched for;
// direct: {group: amount}, the group's own PAC checks to the campaign this cycle from its own reports (counted once
// with its PAC line, at the larger amount); employees: {industry: total} for the period, or null when not read;
// donors: {donor key: amount}, the named donors' own checks to the campaign in the period, or null when not read.
// status: took (some PAC checks, routed gifts or named donors' checks), none (none, with every needed record read),
// waiting (not read yet: never shown as none).
export function trackerMoney(t,{pacLines=null,routed=null,routedKnown=false,direct=null,employees=null,donors=null}={}){
  const by=new Map();
  for(const l of pacLines||[])if(isTrackerPac(t,l)){const k=l.cid||upper(l.name);const o=by.get(k)||{cid:l.cid||null,name:l.name,amount:0,n:0,...(l.bulk?{bulk:true}:{})};o.amount=cents(o.amount+l.amount);o.n++;by.set(k,o);}
  for(const [g,gp] of Object.entries(t.groupPacs||{})){const a=Number(direct?.[g])||0;if(!(a>0))continue;
    const o=by.get(gp.cid);if(!o)by.set(gp.cid,{cid:gp.cid,name:gp.name,amount:cents(a),n:1,own:true});else if(a>o.amount){o.amount=cents(a);o.own=true;}}
  const pacs=[...by.values()].sort((a,b)=>b.amount-a.amount),pac=cents(pacs.reduce((s,p)=>s+p.amount,0));
  const rt=cents(t.routed.reduce((s,g)=>s+(Number(routed?.[g])||0),0));
  const named=(t.donors||[]).map(d=>({key:d.key,name:d.name,amount:cents(Number(donors?.[d.key])||0)})).filter(d=>d.amount>0).sort((a,b)=>b.amount-a.amount);
  const dn=cents(named.reduce((s,d)=>s+d.amount,0)),total=cents(pac+rt+dn);
  const known=pacLines!=null&&(!t.routed.length||routedKnown)&&(!(t.donors||[]).length||donors!=null);
  const emp=t.industries.length&&employees?cents(t.industries.reduce((s,k)=>s+(Number(employees[k])||0),0)):null;
  return {key:t.key,name:t.name,pacs,pac,routed:rt,donors:dn,named,total,employees:emp,status:total>0?'took':known?'none':'waiting'};
}
// How the page names a tracker's PACs and the groups whose passed-on gifts count.
export const pacsOf=t=>t.pacsLabel||`${t.name}'s PACs`;
export const routedBy=t=>t.routedLabel||t.name;
// Does this gift (an FEC Schedule A row: contributor_last_name, contributor_first_name, contributor_state, and the
// employer, city and occupation) come from the named donor? The same last name, a first name starting as theirs does, one
// of their states when they have any, and where their name is common, an employer containing one of theirs, their city
// and an occupation containing one of theirs.
export function isNamedDonor(d,r){
  const last=upper(r?.contributor_last_name).replace(/[^A-Z]/g,''),first=upper(r?.contributor_first_name).trim(),has=(list,v)=>!(list||[]).length||list.some(x=>upper(v).includes(x));
  return !!d&&last===d.last&&d.first.some(f=>first.startsWith(f))&&(!(d.states||[]).length||d.states.includes(upper(r?.contributor_state)))
    &&has(d.employers,r?.contributor_employer)&&(!(d.cities||[]).length||d.cities.includes(upper(r?.contributor_city).trim()))&&has(d.occupations,r?.contributor_occupation);
}
// The named donors' checks to one member over some cycles, from the career file (tracker-history.json "donors": {tracker:
// {member: {cycle: {donor key: dollars}}}}): {donor key: dollars}, or null when the file hasn't read every one of the
// tracker's donors ("donorKeys").
export function donorAmounts(h,t,id,cycles){
  const list=t?.donors||[];if(!list.length)return {};
  if(!list.every(d=>(h?.donorKeys||[]).includes(d.key)))return null;
  const by=h.donors?.[t.key]?.[id]||{},want=cycles?new Set(cycles.map(Number)):null,out={};
  for(const [cy,m] of Object.entries(by))if(!want||want.has(Number(cy)))for(const [k,v] of Object.entries(m||{}))out[k]=cents((out[k]||0)+(Number(v)||0));
  return out;
}
export const lookouts=inputs=>TRACKERS.map(t=>trackerMoney(t,inputs));
// Is this super PAC (an FEC committee ID and name) one of the tracker's own? By ID, or by name, ignoring case,
// punctuation and a short tag in brackets at the end ("United Democracy Project ('UDP')").
const normName=x=>upper(x).replace(/[.,'"’]/g,'').replace(/\s*\([A-Z0-9 &-]{1,12}\)$/,'').replace(/\s+INC$/,'').replace(/\s+/g,' ').trim();
export const isOwnSuperPac=(t,{id,name}={})=>!!((id&&(t.superPacIds||[]).includes(id))||(name&&t.superPacs.some(n=>normName(n)===normName(name))));
// The tracker's own super PACs' spending for and against one person, from the outside-spending records on file
// (research.json: the person's "out.cms" rows [committee index, for, against] into "ie.cm" [id, name, …]). null when
// the person has no records on file.
export function trackerOutside(t,out,cms){
  if(!out)return null;
  const rows=[];
  for(const x of out.cms||[]){const c=(cms||[])[x[0]];if(!c||!isOwnSuperPac(t,{id:c[0],name:c[1]}))continue;rows.push({id:c[0],name:c[1],for:cents(Number(x[1])||0),against:cents(Number(x[2])||0)});}
  return {rows,for:cents(rows.reduce((a,r)=>a+r.for,0)),against:cents(rows.reduce((a,r)=>a+r.against,0)),start:out.start||null,end:out.end||null};
}
// Its own super PACs' spending for and against one person this cycle: the refresh's super PAC records (sp, from
// /api/superpacs) when they show some, else the records on file, else whichever was read (all zero). source: 'refresh'
// or 'file'; null when neither has been read.
export function ownSuperPacSpending(t,{sp=null,cand=null,out=null,cms=null}={}){
  const live=sp?.superPacs?(()=>{const rows=trackerSuperPacs(t,sp,cand).named;return {rows,for:cents(rows.reduce((a,r)=>a+r.for,0)),against:cents(rows.reduce((a,r)=>a+r.against,0)),source:'refresh'};})():null;
  const file=trackerOutside(t,out,cms),some=x=>x&&(x.for>0||x.against>0);
  if(some(live))return live;
  if(some(file))return {...file,source:'file'};
  return live||(file?{...file,source:'file'}:null);
}
// Super PACs and a tracker, from the Super PACs page's data (/api/superpacs: each super PAC's spending for and against
// each candidate, and its largest gifts, organizations by name): its own super PACs by name, and the super PACs its
// companies and groups gave to (their gifts among the largest read), each with its spending for and against cand (an
// FEC candidate ID).
export function trackerSuperPacs(t,data,cand){
  const spent=o=>{const c=(o.cands||[]).find(x=>x.cand===cand);return {for:cents(c?.for||0),against:cents(c?.against||0)};};
  const named=[],funded=[];
  for(const o of data?.superPacs||[]){
    const own=isOwnSuperPac(t,o);
    if(own)named.push({id:o.id,name:o.name,total:o.total,...spent(o)});
    const orgs=(o.donors?.orgs||[]).filter(g=>t.patterns.some(r=>r.test(upper(g.name))));
    if(orgs.length&&!own)funded.push({id:o.id,name:o.name,given:cents(orgs.reduce((s,g)=>s+g.amount,0)),givers:orgs.map(g=>g.name),read:o.donors.orgs.reduce((s,g)=>s+g.amount,0)+(o.donors.indiv?.total||0),...spent(o)});
  }
  return {named,funded:funded.sort((a,b)=>b.given-a.given)};
}

// ---------- Spent to help them win (approved 2026-11-13) ----------
// What a tracker's own super PACs spent to help one candidate win this cycle, from public/super-pac-races.json (the FEC's
// independent expenditures, primaries and generals; scripts/build-super-pac-races.mjs). Each super PAC is judged on its
// own (a tracker can hold super PACs on both sides of a race, as Big Tech + AI does): what it spent for them, plus what it
// spent against their opponents in an election they were in, when it spent nothing against them there and either spent
// for them or the election was a two-way contest (two candidates with outside spending). In a primary or a runoff, only
// their own party's candidates are their opponents (except in the top-two and top-four states, where everyone runs in
// one primary); in a general, special or other election, every other candidate for the seat is. A candidate the FEC lists
// under two IDs in one seat (the same name) is one person. Spending against them is kept apart; spending for or against
// the race's other candidates that doesn't count is listed. ids: their FEC candidate IDs (their own and any other
// campaign's). null without the file or without any spending in their races.
export const ELECTION_LABEL={P:'Primary',G:'General',R:'Runoff',S:'Special',O:'Other',C:'Convention'};
const OPEN_PRIMARY=new Set(['CA','WA','AK']);
const personKey=c=>{const [last,first]=String(c?.[0]||'').toUpperCase().split(',');return `${(last||'').replace(/[^A-Z]/g,'')}|${String(first||'').trim().split(/\s+/)[0].replace(/[^A-Z]/g,'')}|${c?.[1]}`;};
export function helpToWin(t,races,ids){
  if(!races?.rows||!t?.superPacs?.length)return null;
  const C=races.cands||{},who=Object.fromEntries(Object.entries(C).map(([id,c])=>[id,personKey(c)]));
  const mine=new Set((ids||[]).filter(id=>C[id]).map(id=>who[id]));if(!mine.size)return null;
  // Each person in these seats: their seat, party and the elections they were in (all their IDs together).
  const people={};
  for(const [id,c] of Object.entries(C)){const k=who[id],p=people[k]||(people[k]={name:c[0],seat:c[1],party:'',ele:''});if(!p.party&&c[2])p.party=c[2];for(const e of String(c[3]))if(!p.ele.includes(e))p.ele+=e;}
  const seats=new Set([...mine].map(k=>people[k].seat));
  // The candidates in one election of a seat, from one candidate's view: their opponents are their party's in a primary.
  const field=(me,ele)=>Object.entries(people).filter(([k,p])=>p.seat===me.seat&&p.ele.includes(ele)&&(!['P','R'].includes(ele)||OPEN_PRIMARY.has(me.seat.split('-')[1])||!me.party||!p.party||p.party===me.party)).map(([k])=>k);
  // Each super PAC's spending in these seats: by super PAC, election, person and side.
  const by=new Map(),key=(sp,ele,k,so)=>`${sp}|${ele}|${k}|${so}`,get=(...a)=>by.get(key(...a))||0;
  const lines=[];
  for(const [sp,cand,so,ele,amount] of races.rows){
    if(races.spenders?.[sp]?.[1]!==t.key||!C[cand]||!seats.has(C[cand][1]))continue;
    const k=who[cand],a=Number(amount)||0;by.set(key(sp,ele,k,so),get(sp,ele,k,so)+a);
    lines.push({sp,spName:races.spenders[sp][0],person:k,cand,name:people[k].name,party:people[k].party,so,ele,amount:a});
  }
  if(!lines.length)return null;
  const forThem=[],againstThem=[],rivals=[],others=[];
  for(const l of lines){
    if(mine.has(l.person)){(l.so==='O'?againstThem:forThem).push(l);continue;}
    // Against an opponent: counts when this super PAC backed one of their candidates there and didn't go after them.
    const me=[...mine].map(k=>({k,...people[k]})).find(m=>m.seat===people[l.person].seat&&m.ele.includes(l.ele));
    const f=me&&field(me,l.ele),rival=me&&l.so==='O'&&f.includes(l.person)&&f.includes(me.k);
    const counts=rival&&!get(l.sp,l.ele,me.k,'O')&&(get(l.sp,l.ele,me.k,'S')>0||(f.length===2&&!get(l.sp,l.ele,l.person,'S')));
    (counts?rivals:others).push(l);
  }
  const sum=list=>cents(list.reduce((a,r)=>a+r.amount,0)),f=sum(forThem),a=sum(rivals);
  return {help:cents(f+a),forThem:f,againstRivals:a,againstThem:sum(againstThem),rows:{forThem,againstThem,rivals,others}};
}
// "EL-SAYED, ABDUL" / "Massie, Thomas" -> "Abdul El-Sayed" / "Thomas Massie".
export function fecName(n){
  const [last,first]=String(n||'').split(',').map(x=>x.trim());
  const cap=w=>w.toLowerCase().replace(/(^|[\s'-])([a-z])/g,(x,a,b)=>a+b.toUpperCase());
  return first?`${cap(first)} ${cap(last)}`:cap(String(n||''));
}
