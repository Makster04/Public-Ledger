// The Trackers page's About view (#trackers-about, since Nov. 24, 2026): what each tracker follows, drawn from the same
// lists the site counts with (public/trackers.js, public/industries.js), so it never goes out of date. The kinds of data
// a tracker reads, every tracker at a glance, and a panel for each one: its companies and groups, its PACs by FEC ID and
// by name, its named people, the gifts passed on, its own super PACs, and what it leaves out. Shown only; nothing here
// is used in a grade. app.js passes the counts it has on hand (members who took some this cycle, and in their career).
import {COMPANIES,EXECUTIVES,SUPER_PACS,INDUSTRY_LABEL} from './industries.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// An FEC name in readable case, keeping the abbreviations in capitals.
export const titleCase=n=>String(n||'').toLowerCase().replace(/(^|[\s(/&'-])([a-z])/g,(x,a,b)=>a+b.toUpperCase())
  .replace(/\b(Pac|Llc|Ba|Usa|Us|Ii|Rtx|Ibm|Amd|Ge|Bae|Saic|Caci|Kbr|Bwx|Drs|Bny|Pnc|Rjc|Dmfi|Usi|Cvs|Bio|Gsk|Ema|Sbc|Nswa|Afpmpac|Mpac|Vpac|Qpac|Iti|Bsa|Ici|Lpl|Edj|Fmr|Cme|Axppac|Msvpac|Saipac)\b/g,w=>w.toUpperCase());
// A name pattern in plain words: the alternatives it accepts, without the regular-expression marks.
export function human(re){
  const src=re instanceof RegExp?re.source:String(re);
  const s=src.replace(/\(\?![^)]*\)/g,'').replace(/\\b/g,'').replace(/\^/g,'').replace(/\$$/,'');
  const parts=[];let depth=0,cur='';
  for(const ch of s){if(ch==='(')depth++;if(ch===')')depth--;if(ch==='|'&&depth===0){parts.push(cur);cur='';}else cur+=ch;}
  parts.push(cur);
  return parts.map(p=>p.replace(/\\\.\?/g,'.').replace(/\\\./g,'.').replace(/\[([^\]]*)\]/g,(m,c)=>c[0]||'').replace(/\\s[*+]?/g,' ')
    .replace(/\.\*/g,'…').replace(/\?/g,'').replace(/\\/g,'').replace(/\(([^)]*)\)/g,(m,c)=>'('+c.split('|').join(' / ')+')').replace(/\s+/g,' ').trim()).filter(Boolean);
}
// What each tracker leaves out, and a note where one helps (kept here, beside the panel that shows them).
export const LEFT_OUT={
  aipac:['J Street (approved: it often backs candidates AIPAC works against)','PACs that never say they are about Israel: the Maryland Association for Concerned Citizens PAC and Mid Manhattan PAC','NATPAC 1947 (a real-estate PAC some outside sites list as pro-Israel)','Every individual donor not approved by name, and the named donors\' super PAC money'],
  pharma:['Medical device makers','Drug distributors','Hospitals','Drugstore chains','Health insurers and PBMs (their own tracker)'],
  insurers:['Drugmakers (Big Pharma)','Drugstore chains (CVS Health is in, as the owner of Aetna and Caremark)','Hospitals'],
  oil:['Koch Industries','Coal and mining','Gas utilities'],
  tech:['Telecom and cable companies'],
  crypto:['Crypto companies not on the crypto and AI list'],
  defense:['Commercial-only aerospace','Space launch companies','The rest of GE and Honeywell (only their aerospace PACs count)','Defense trade groups (they have no PACs)'],
  wallstreet:['Community banks and the state bankers associations','Credit unions','Insurance companies']};
export const NOTES={
  aipac:'The tracker was called AIPAC until November 14, 2026; its links still use "aipac". The named donors are Miriam and Sheldon Adelson and the 20 people who gave United Democracy Project, AIPAC\'s super PAC, $1 million or more in 2021–2026 (FEC). The site states that giving, never a label for their beliefs.',
  pharma:'Split from Health Insurers + PBMs on November 18, 2026: drugmakers and insurers often lobby against each other on drug prices, though both give mostly to the same members (the health committees). PAC checks only: no super PAC of its own, and its people\'s gifts aren\'t read yet.',
  insurers:'The three biggest PBMs belong to insurers (Optum Rx to UnitedHealth, Caremark to CVS Health, Express Scripts to Cigna), so they\'re here. PAC checks only: no super PAC of its own, and its people\'s gifts aren\'t read yet.',
  oil:'PAC checks only: no super PAC of its own, and its people\'s gifts aren\'t read yet.',
  tech:'The AI companies, their executives and the AI super PACs come from the crypto and AI list. Their people\'s gifts are read by the refresh and shown beside the PAC checks.',
  crypto:'The crypto companies, their executives and the crypto super PACs come from the crypto and AI list. Their people\'s gifts are read by the refresh and shown beside the PAC checks.',
  defense:'PAC checks only: no super PAC of its own, and its people\'s gifts aren\'t read yet. Palantir\'s PAC is Big Tech + AI\'s by ID and counts here by name.',
  wallstreet:'PAC checks only: no super PAC of its own, and its people\'s gifts aren\'t read yet.'};
// The FEC's names for the committees on file, by ID (from the FEC committee records, Nov. 14, 2026).
export const PAC_NAMES={
  C00797670:"AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE",
  C00247403:"NORPAC",
  C00139659:"JOINT ACTION COMMITTEE FOR POLITICAL AFFAIRS",
  C00135541:"TO PROTECT OUR HERITAGE PAC",
  C00710848:"DMFI PAC",
  C00345132:"REPUBLICAN JEWISH COALITION POLITICAL ACTION COMMITTEE (RJC-PAC)",
  C00251876:"AMGEN INC. POLITICAL ACTION COMMITTEE",
  C00536573:"ABBVIE POLITICAL ACTION COMMITTEE",
  C00016683:"PFIZER INC. PAC",
  C00010983:"JOHNSON & JOHNSON POLITICAL ACTION COMMITTEE",
  C00199257:"GENENTECH INC. POLITICAL ACTION COMMITTEE (GENENPAC)",
  C00097485:"MERCK & CO., INC., EMPLOYEES POLITICAL ACTION COMMITTEE (MERCK PAC)",
  C00082792:"ELI LILLY AND COMPANY POLITICAL ACTION COMMITTEE",
  C00468660:"VERTEX PHARMACEUTICALS INCORPORATED POLITICAL ACTION COMMITTEE (VPAC)",
  C00021972:"PHARMACEUTICAL RESEARCH & MANUFACTURERS OF AMERICA BETTER GOVERNMENT COMMITTEE",
  C00199703:"GLAXOSMITHKLINE LLC PAC (GSK PAC)",
  C00355677:"BIOTECHNOLOGY INNOVATION ORGANIZATION PAC (BIO PAC)",
  C00396895:"GILEAD SCIENCES INC HEALTHCARE POLICY PAC",
  C00332395:"VIATRIS INC. POLITICAL ACTION COMMITTEE (VIAPAC)",
  C00420398:"BOEHRINGER INGELHEIM USA CORPORATION POLITICAL ACTION COMMITTEE (BOEHRINGER PAC)",
  C00390351:"BIOGEN INC. POLITICAL ACTION COMMITTEE A.K.A 'BIOGEN PAC'",
  C00424838:"NOVO NORDISK INC. PAC (NOVO NORDISK PAC)",
  C00033969:"NOVARTIS CORPORATION POLITICAL ACTION COMMITTEE",
  C00281162:"BAYER US LLC EMPLOYEE POLITICAL ACTION COMMITTEE (BAYERPAC)",
  C00562264:"REGENERON PHARMACEUTICALS, INC. PAC",
  C00035675:"BRISTOL-MYERS SQUIBB COMPANY POLITICAL ACTION COMMITTEE",
  C00441733:"TAKEDA PHARMACEUTICALS AMERICA INC. POLITICAL ACTION COMMITTEE",
  C00780171:"ORGANON & CO. EMPLOYEE POLITICAL ACTION COMMITTEE",
  C00144345:"SANOFI US SERVICES INC. EMPLOYEES' POLITICAL ACTION COMMITTEE",
  C00084061:"BLUE CROSS BLUE SHIELD OF MICHIGAN PAC",
  C00085316:"THE CIGNA GROUP EMPLOYEE POLITICAL ACTION COMMITTEE",
  C00161141:"GUIDEWELL MUTUAL HOLDING CORPORATION POLITICAL ACTION COMMITTEE (GUIDEWELL PAC)",
  C00194746:"BLUEPAC - BLUE CROSS BLUE SHIELD ASSOCIATION PAC",
  C00197228:"ELEVANCE HEALTH, INC. POLITICAL ACTION COMMITTEE (ELEVANCE HEALTH PAC)",
  C00199711:"HEALTH CARE SERVICE CORPORATION EMPLOYEES' POLITICAL ACTION COMMITTEE",
  C00271007:"HUMANA INC. POLITICAL ACTION COMMITTEE",
  C00274431:"UNITEDHEALTH GROUP INCORPORATED PAC (UNITEDHEALTH GROUP PAC)",
  C00276311:"BLUE CROSS AND BLUE SHIELD OF NEBRASKA PAC",
  C00384818:"CVS HEALTH PAC",
  C00388819:"PHARMACEUTICAL CARE MANAGEMENT ASSOCIATION POLITICAL ACTION COMMITTEE (PCMA PAC)",
  C00397851:"CENTENE CORPORATION POLITICAL ACTION COMMITTEE (CENTENE PAC)",
  C00430256:"MOLINA HEALTHCARE, INC. PAC",
  C00450056:"INDEPENDENCE BLUE CROSS LLC PAC",
  C00457242:"BLUE CROSS BLUE SHIELD OF ALABAMA PAC",
  C00035006:"CHEVRON EMPLOYEES POLITICAL ACTION COMMITTEE - CHEVRON CORPORATION",
  C00513549:"PHILLIPS 66 PAC",
  C00121368:"EXXON MOBIL CORPORATION POLITICAL ACTION COMMITTEE (EXXONMOBIL PAC)",
  C00040394:"THE WILLIAMS COMPANIES, INC. POLITICAL ACTION COMMITTEE",
  C00755454:"US ENERGY PAC (THE PAC OF AMERICAN EXPLORATION & PRODUCTION COUNCIL, INC.)",
  C00551184:"CONTINENTAL RESOURCES, INC. POLITICAL ACTION COMMITTEE",
  C00109546:"VALERO ENERGY CORPORATION POLITICAL ACTION COMMITTEE",
  C00354753:"DEVON ENERGY CORPORATION POLITICAL ACTION COMMITTEE (DEC PAC)",
  C00342766:"HF SINCLAIR CORPORATION POLITICAL ACTION COMMITTEE (DINO PAC)",
  C00246306:"IPAA WILDCATTERS FUND",
  C00035204:"ENERGY MARKETERS OF AMERICA SMALL BUSINESS COMMITTEE PAC (EMA SBC PAC)",
  C00483677:"AMERICAN PETROLEUM INSTITUTE POLITICAL ACTION COMMITTEE (API PAC)",
  C00430157:"CHENIERE ENERGY, INC. PAC",
  C00496307:"MARATHON PETROLEUM CORPORATION EMPLOYEES POLITICAL ACTION COMMITTEE (MPAC)",
  C00112896:"CONOCOPHILLIPS SPIRIT PAC",
  C00429662:"ENBRIDGE (U.S.) INC. POLITICAL ACTION COMMITTEE (ENBRIDGE PAC)",
  C00039503:"SHELL USA, INC. EMPLOYEE POLITICAL AWARENESS COMMITTEE",
  C00525055:"TRANSCANADA USA SERVICES, INC. PAC (TC PAC)",
  C00035691:"HALLIBURTON COMPANY PAC",
  C00431932:"OVINTIV USA INC. PAC",
  C00686287:"PLAINS ALL AMERICAN GP LLC PAC",
  C00083857:"OCCIDENTAL PETROLEUM CORPORATION POLITICAL ACTION COMMITTEE",
  C00116145:"INTERSTATE NATURAL GAS ASSOCIATION OF AMERICA POLITICAL ACTION COMMITTEE",
  C00426569:"WESTERN ENERGY ALLIANCE PAC",
  C00415026:"AMERICAN FUELS AND PETROCHEMICAL MANUFACTURERS ASSOCIATION POLITICAL ACTION COMMITTEE (AFPMPAC)",
  C00736421:"DELEK US HOLDINGS LLC PAC  (AKA DK PAC)",
  C00488080:"NATIONAL STRIPPER WELL ASSOCIATION PAC (NSWA PAC)",
  C00510016:"TARGA RESOURCES CORP. FEDERAL PAC",
  C00721647:"NEXTDECADE CORPORATION POLITICAL ACTION COMMITTEE",
  C00215384:"ONEOK INC. EMPLOYEE POLITICAL ACTION COMMITTEE",
  C00135855:"DIAMONDBACK ENERGY, INC. POLITICAL ACTION COMMITTEE (DIAMONDBACK ENERGY PAC)",
  C00486779:"LIQUID ENERGY PIPELINE ASSOCIATION PAC",
  C00151175:"EQT CORPORATION PAC",
  C00438754:"ENERGY TRANSFER EMPLOYEE MANAGEMENT COMPANY PAC (ENERGY TRANSFER PAC)",
  C00705996:"DIVERSIFIED GAS & OIL CORPORATION PAC",
  C00279224:"APACHE CORPORATION POLITICAL ACTION COMMITTE",
  C00496752:"ENTERPRISE PRODUCTS PARTNERS L.P. POLITICAL ACTION COMMITTEE",
  C00567081:"ENERGY INFRASTRUCTURE COUNCIL POLITICAL ACTION COMMITTEE",
  C00428623:"GOOGLE LLC NETPAC",
  C00227546:"MICROSOFT CORPORATION STAKEHOLDERS VOLUNTARY PAC - MSVPAC",
  C00360354:"AMAZON.COM SERVICES LLC SEPARATE SEGREGATED FUND (AMAZON PAC)",
  C00362707:"CISCO SYSTEMS, INC. FEDERAL PAC",
  C00328369:"TECHNOLOGY NETWORK (TECHNET) FEDERAL PAC",
  C00369751:"DELL TECHNOLOGIES, INC. POLITICAL ACTION COMMITTEE",
  C00125641:"INTEL CORPORATION POLITICAL ACTION COMMITTEE",
  C00339085:"QUALCOMM INCORPORATED POLITICAL ACTION COMMITTEE (QPAC)",
  C00498691:"EMPLOYEES OF PALANTIR TECHNOLOGIES INC. PAC",
  C00419036:"INFORMATION TECHNOLOGY INDUSTRY COUNCIL POLITICAL ACTION COMMITTEE  (ITI PAC)",
  C00375048:"CONSUMER TECHNOLOGY ASSOCIATION PAC",
  C00323048:"ORACLE AMERICA, INC. POLITICAL ACTION COMMITTEE (ORACLE PAC)",
  C00502906:"META PLATFORMS, INC. PAC",
  C00907683:"UBER TECHNOLOGIES, INC. SEPARATE SEGREGATED FUND",
  C00416685:"BSA BUSINESS SOFTWARE ALLIANCE, INC. PAC (BSA PAC)",
  C00804179:"COINBASE, INC. INNOVATION PAC (COINBASE INNOVATION PAC)",
  C00824896:"BLOCKCHAIN ASSOCIATION POLITICAL ACTION COMMITTEE (BA PAC)",
  C00303024:"LOCKHEED MARTIN CORPORATION EMPLOYEES' POLITICAL ACTION COMMITTEE",
  C00097568:"EMPLOYEES OF RTX CORPORATION POLITICAL ACTION COMMITTEE",
  C00078451:"GENERAL DYNAMICS CORPORATION POLITICAL ACTION COMMITTEE (GENERAL DYNAMICS EMPLOYEE PAC)",
  C00088591:"EMPLOYEES OF NORTHROP GRUMMAN CORPORATION PAC",
  C00142711:"THE BOEING COMPANY PAC",
  C00100321:"L3HARRIS TECHNOLOGIES, INC. PAC",
  C00129122:"AEROJET ROCKETDYNE AN L3HARRIS TECHNOLOGIES COMPANY PAC",
  C00281212:"BAE SYSTEMS INC. POLITICAL ACTION COMMITTEE (BAE SYSTEMS USA PAC)",
  C00546234:"LEIDOS INC. POLITICAL ACTION COMMITTEE",
  C00709816:"BOOZ ALLEN HAMILTON INC. PAC (BOOZ ALLEN PAC)",
  C00208983:"MANTECH INTERNATIONAL CORPORATION POLITICAL ACTION COMMITTEE   ( A.K.A 'MANTECH PAC')",
  C00383992:"PERATON CORP. POLITICAL ACTION COMMITTEE (A.K.A. 'PERATON PAC')",
  C00731414:"AMENTUM HOLDINGS, INC. PAC (AMENTUM PAC)",
  C00760710:"V2X, INC. POLITICAL ACTION COMMITTEE",
  C00215285:"GENERAL ATOMICS POLITICAL ACTION COMMITTEE",
  C00123612:"TEXTRON INC. POLITICAL ACTION COMMITTEE",
  C00367995:"SIERRA NEVADA COMPANY, LLC POLITICAL ACTION COMMITTEE",
  C00365502:"BWX TECHNOLOGIES, INC POLITICAL ACTION COMMITTEE",
  C00686709:"KRATOS DEFENSE & SECURITY SOLUTIONS, INC. POLITICAL ACTION COMMITTEE (KRATOS PAC)",
  C00797530:"AEROVIRONMENT, INC PAC",
  C00516864:"AUSTAL USA LLC FEDERAL POLITICAL ACTION COMMITTIEE",
  C00763623:"ANDURIL INDUSTRIES, INC. POLITICAL ACTION COMMITTEE (ANDURIL PAC)",
  C00782532:"SHIELD AI POLITICAL ACTION COMMITTEE (SAIPAC)",
  C00919555:"SARONIC TECHNOLOGIES INC. PAC",
  C00275123:"LEONARDO DRS PAC",
  C00890830:"AMERICAN RHEINMETALL DEFENSE, INC. POLITICAL ACTION COMMITTEE",
  C00437566:"ELBIT SYSTEMS OF AMERICA LLC POLITICAL ACTION COMMITTEE (ELBIT AMERICA PAC)",
  C00024869:"GENERAL ELECTRIC COMPANY AEROSPACE EMPLOYEE POLITICAL ACTION COMMITTEE (GE AEROSPACE PAC)",
  C00004275:"AMERICAN BANKERS ASSOCIATION PAC (BANKPAC)",
  C00008474:"CITIGROUP INC. PAC - FEDERAL (CITI PAC - FEDERAL)",
  C00017558:"THE BANK OF NEW YORK MELLON CORPORATION BIPARTISAN PAC (BNY BIPAC)",
  C00034595:"WELLS FARGO AND COMPANY EMPLOYEE PAC (AKA WELLS FARGO EMPLOYEE PAC)",
  C00035519:"BIPARTISAN VOLUNTARY PUBLIC AFFAIRS COMMITTEE OF THE PNC FINANCIAL SERVICES GROUP, INC. (PNC PAC)",
  C00035535:"CONSUMER BANKERS ASSOCIATION PAC",
  C00040535:"AMERICAN EXPRESS COMPANY POLITICAL ACTION COMMITTEE (AXPPAC)",
  C00072751:"STATE STREET BANK AND TRUST COMPANY VOLUNTARY POLITICAL ACTION COMMITTEE",
  C00076299:"CME GROUP INC. PAC",
  C00104299:"JPMORGAN CHASE & CO. FEDERAL POLITICAL ACTION COMMITTEE",
  C00105981:"INVESTMENT COMPANY INSTITUTE POLITICAL ACTION COMMITTEE (ICI PAC)",
  C00133389:"FUTURES INDUSTRY POLITICAL ACTION COMMITTEE",
  C00186064:"FEDERAL BIPARTISAN VOLUNTARY PUBLIC AFFAIRS COMMITTEE OF THE PNC FINANCIAL SERVICES GROUP, INC. (PNC",
  C00253369:"INVESCO HOLDING COMPANY (US), INC. EMPLOYEE POLITICAL ACTION COMMITTEE",
  C00300178:"WELLS FARGO AND COMPANY EMPLOYEES GOOD GOVERNMENT FEDERAL FUND II",
  C00306894:"MANAGED FUNDS ASSOCIATION POLITICAL ACTION COMMITTEE",
  C00326595:"CAPITAL ONE FINANCIAL CORP. ASSOC. POLITICAL FUND",
  C00327072:"SANTANDER HOLDINGS USA INC. PAC (SANTANDER US PAC)",
  C00337626:"MORGAN STANLEY POLITICAL ACTION COMMITTEE",
  C00350744:"THE GOLDMAN SACHS GROUP, INC. POLITICAL ACTION COMMITTEE",
  C00364778:"BANK OF AMERICA CORPORATION FEDERAL PAC",
  C00365122:"VISA, INC. POLITICAL ACTION COMMITTEE",
  C00366013:"NASDAQ, INC. PAC (NASDAQ PAC)",
  C00380550:"FMR LLC POLITICAL ACTION COMMITTEE - FEDERAL (FIDELITY PAC)",
  C00386524:"TRUIST FINANCIAL CORPORATION FEDERAL PAC",
  C00410266:"THE VANGUARD GROUP COMMITTEE FOR RESPONSIBLE GOVERNMENT",
  C00410274:"MASTERCARD INTERNATIONAL INC. EMPLOYEE PAC (MASTERCARD PAC) OR (MASTERCARD EMPLOYEE PAC)",
  C00410407:"EDJ HOLDING COMPANY, INC. POLITICAL ACTION COMMITTEE (EDWARD JONES PAC)",
  C00431312:"SECURITIES INDUSTRY AND FINANCIAL MARKETS ASSOCIATION POLITICAL ACTION COMMITTEE",
  C00479246:"BLACKROCK FUNDS SERVICES GROUP LLC POLITICAL ACTION COMMITTEE (BLACKROCK PAC)",
  C00486217:"LPL FINANCIAL LLC POLITICAL ACTION COMMITTEE (LPL PAC)",
  C00488882:"U.S. BANCORP FEDERAL POLITICAL ACTION COMMITTEE",
  C00494534:"THE BANK OF NEW YORK MELLON CORPORATION FEDERAL PAC (BNY FEDPAC)",
  C00495002:"AMERICAN INVESTMENT COUNCIL POLITICAL ACTION COMMITTEE",
  C00515148:"NORTHERN TRUST CORPORATION FEDERAL POLITICAL ACTION COMMITTEE (NORTHERN TRUST FEDERAL PAC)",
  C00579540:"ALLY FINANCIAL INC. ADVOCACY POLITICAL ACTION COMMITTEE",
  C00589119:"SYNCHRONY FINANCIAL EMPLOYEES POLITICAL ACTION COMMITTEE (SYNCPAC)",
  C00689091:"THE CARLYLE GROUP INC. PAC (AKA 'CARLYLE PAC')"};

const list=xs=>xs.length<=1?xs.join(''):xs.length===2?xs.join(' and '):`${xs.slice(0,-1).join(', ')} and ${xs.at(-1)}`;
// The companies on the crypto and AI list a tracker reads, and their approved executives.
export const listCompanies=t=>COMPANIES.filter(c=>(t.industries||[]).includes(c.industry));
export const executivesOf=t=>{const cs=new Map(listCompanies(t).map(c=>[c.key,c]));return EXECUTIVES.filter(e=>cs.has(e.company)).map(e=>({...e,companyName:cs.get(e.company).name}));};
const ownCompanies=t=>(t.companies||[]).filter(c=>!/crypto and AI list/.test(c));
// The five kinds of money a tracker can read: which trackers read each, from their own settings.
export function kinds(trackers){
  const names=f=>list(trackers.filter(f).map(t=>t.name)),all=trackers.length;
  return [
    {name:'PAC checks',tag:['yes','Counted'],who:`All ${all} trackers`,what:'Checks from the tracker\'s PACs to a member\'s campaign, refunds taken off.',src:'FEC bulk files: PAC-to-candidate contributions and the committee list, this cycle and every cycle since 1979–80; plus each reviewed profile\'s own PAC lines.'},
    {name:'Gifts passed on',tag:['yes','Counted'],who:names(t=>t.routed?.length),what:'Donors\' gifts a group collects and forwards to a campaign (earmarks).',src:'Each group\'s PAC payments (FEC Schedule B), read with the FEC key.'},
    {name:'Named donors\' own checks',tag:['yes','Counted'],who:names(t=>t.donors?.length),what:'Checks an approved, named person wrote to a member\'s own campaign committee.',src:'FEC itemized receipts (Schedule A), searched by name and state, every cycle since 1980; sitting members only.'},
    {name:'Employees\' and executives\' gifts',tag:['shown','Shown beside'],who:names(t=>t.industries?.length),what:'Gifts from people who list a company on the crypto and AI list as their employer; approved executives named.',src:'FEC itemized receipts by employer, read by the refresh.'},
    {name:'Super PAC spending',tag:['shown','Shown, never counted'],who:names(t=>t.superPacs?.length),what:'Ads and mail a tracker\'s own super PACs paid for or against a candidate. The campaign never takes it.',src:'FEC independent-expenditure files, primaries and generals.'}];
}
const pill=([k,l])=>`<span class="ta-pill ${k}">${esc(l)}</span>`;
const mk=(v,k)=>v?`<span class="ta-mk ${k}">${esc(v)}</span>`:'<span class="ta-mk no">—</span>';
const chips=(xs,mono)=>xs.length?`<div class="ta-chips">${xs.map(x=>`<span class="ta-chip${mono?' m':''}">${esc(x)}</span>`).join('')}</div>`:'<p class="small muted">None.</p>';
const block=(title,body)=>`<div class="ta-block"><h3>${esc(title)}</h3>${body}</div>`;
const fec=id=>`<a href="https://www.fec.gov/data/committee/${esc(id)}/" target="_blank" rel="noopener" class="ta-mono">${esc(id)}</a>`;
const countText=c=>c==null?'Waits':String(c);
// The donor's matching rule in words.
const matchRule=d=>['name',d.employers?.length?`employer (${d.employers.map(titleCase).join(' or ')}), any state`:'',d.states?.length?`state (${d.states.join(', ')})`:'',
  d.cities?.length?`city (${d.cities.map(titleCase).join(', ')})`:'',d.occupations?.length?`occupation (${d.occupations.map(titleCase).join(', ')})`:''].filter(Boolean).join(' + ');

// One tracker's panel. counts: {took, read, career} (null where not on file yet).
export function trackerPanel(t,counts={}){
  const own=ownCompanies(t),lc=listCompanies(t),ex=executivesOf(t),net=n=>SUPER_PACS.find(p=>p.name===n);
  const people=t.donors?.length
    ?`<div class="tablewrap"><table class="ta-table"><thead><tr><th>Donor</th><th>A gift is theirs when it matches</th></tr></thead><tbody>${t.donors.map(d=>`<tr><td>${esc(d.name)}</td><td>${esc(matchRule(d))}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Approved by name. No other donor's name is ever saved.</p>`
    :ex.length?`<div class="tablewrap"><table class="ta-table"><thead><tr><th>Executive</th><th>Role</th><th>Company</th></tr></thead><tbody>${ex.map(e=>`<tr><td>${esc(e.name)}</td><td>${esc(e.role)}</td><td>${esc(e.companyName)}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Approved for naming. Their gifts are shown beside the PAC checks, matched by first and last name and an employer on the company's list.</p>`
    :'<p class="small muted">Nobody is named for this tracker.</p>';
  const pacs=`<div class="tablewrap"><table class="ta-table"><thead><tr><th>FEC ID</th><th>Committee</th></tr></thead><tbody>${t.pacIds.map(id=>`<tr><td>${fec(id)}</td><td>${esc(titleCase(PAC_NAMES[id]||'Name not on file'))}</td></tr>`).join('')}</tbody></table></div>`;
  const routedNames=(t.routed||[]).map(g=>g==='aipac'?'AIPAC':titleCase(PAC_NAMES[g.replace(/^fec:/,'')]||g));
  return `<article class="ta-panel" aria-labelledby="ta-h-${esc(t.key)}">
    <header class="ta-ph"><h2 id="ta-h-${esc(t.key)}"><span aria-hidden="true">${esc(t.emoji||'')}</span> ${esc(t.name)}</h2>${t.card&&t.card!==t.name?`<p class="small muted">On the report card: "${esc(t.card)}"</p>`:''}
      <p>${esc(t.about)}</p>
      <div class="ta-stats"><div><b class="num">${t.pacIds.length}</b><span>PACs by FEC ID</span></div><div><b class="num">${t.patterns.length}</b><span>name patterns</span></div>
        <div><b class="num">${countText(counts.took)}</b><span>${counts.took==null?'members who took some this cycle: after the next npm run corporate:pacs':`of ${counts.read} members took some this cycle`}</span></div>
        <div><b class="num">${countText(counts.career)}</b><span>${counts.career==null?'with checks in their career: after the next npm run corporate:pacs':'with checks in their career'}</span></div></div></header>
    <div class="ta-grid2">
      ${block('Companies',own.length?chips(own):lc.length?'<p class="small muted">The companies on the crypto and AI list (below).</p>':'<p class="small muted">None: it follows groups, not companies.</p>')}
      ${block('Groups and trade associations',chips(t.groups||[]))}
    </div>
    <div class="ta-grid2">
      ${block('PACs on file, by FEC committee ID',pacs)}
      ${block('Also matched by name',`${chips(t.patterns.flatMap(human),true)}<p class="small muted">A committee whose FEC name contains one of these counts too, for PACs not on file yet. Names are compared in capitals, as the FEC writes them.</p>`)}
    </div>
    <div class="ta-grid2">
      ${block(t.donors?.length?'Named donors':'Named people',people)}
      ${block('Gifts passed on',routedNames.length?`${chips(routedNames)}<p class="small muted">What these groups collect from donors and forward to a campaign counts toward the ✕. AIPAC's are read for every cycle since 2022; the others' for this cycle.</p>`:'<p class="small muted">Not read for this tracker yet. Its page says "Not updated yet" rather than showing a zero.</p>')}
    </div>
    <div class="ta-grid2">
      ${lc.length?block('Companies whose employees\' gifts are read',chips(lc.map(c=>`${c.name} · ${INDUSTRY_LABEL[c.industry]||c.industry}`))):''}
      ${block('Its own super PACs',t.superPacs?.length?`${chips(t.superPacs.map(n=>{const s=net(n);return s&&s.network&&s.network!==n?`${n} · ${s.network} network`:n;}))}<p class="small muted">Shown under "Spent to help them win" and "Tracking Lobby Money". It never changes the ✕: the campaign doesn't take it.</p>`:'<p class="small muted">None.</p>')}
    </div>
    <div class="ta-grid2">
      ${block('Left out',`<ul class="ta-list">${(LEFT_OUT[t.key]||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`)}
      ${NOTES[t.key]?block('Notes',`<p class="small muted">${esc(NOTES[t.key])}</p>`):''}
    </div>
  </article>`;
}

// The whole view. trackers: TRACKERS; counts: {key: {took, read, career}}; sel: the tracker whose panel is open;
// meta: {through (the bulk files' last check date), read (members read), careerFrom (first cycle year)}.
export function trackerAboutHTML(trackers,counts={},sel=null,meta={}){
  const t=trackers.find(x=>x.key===sel)||trackers[0];
  const K=kinds(trackers);
  const row=x=>{const c=counts[x.key]||{},own=ownCompanies(x).length,lc=listCompanies(x).length,ex=executivesOf(x).length;
    return `<tr><td><button type="button" class="ta-go" data-ab="${esc(x.key)}"><span aria-hidden="true">${esc(x.emoji||'')}</span> ${esc(x.name)}</button></td>
      <td class="r num">${x.pacIds.length}</td><td class="r num">${x.patterns.length}</td><td class="r num">${own}${lc?` + ${lc}`:''}</td><td class="r num">${(x.groups||[]).length}</td>
      <td>${mk(x.routed?.length?`${x.routed.length} groups`:'','yes')}</td>
      <td>${x.donors?.length?mk(`${x.donors.length} donors`,'yes'):ex?mk(`${ex} executives`,'shown'):mk('')}</td>
      <td>${mk(x.industries?.length?'Read':'','shown')}</td><td>${mk(x.superPacs?.length?String(x.superPacs.length):'','shown')}</td>
      <td class="r num">${c.took==null?'Waits':`${c.took} of ${c.read}`}</td><td class="r num">${countText(c.career)}</td></tr>`;};
  return `<p class="intro">The ${trackers.length} lobbies whose money to each campaign the site follows: on every profile's Big Money Independence tab, the Trackers page, Career Totals and the seating charts. They're shown only; no grade uses them. These are the exact lists the site counts with (public/trackers.js and public/industries.js), so this page changes when they do.</p>
    <section class="ta-sec" aria-labelledby="ta-kinds"><h2 id="ta-kinds">The five kinds of data</h2>
      <p class="small muted">A tracker's ✕ ("took some") comes only from money the campaign itself took. The rest is shown beside it.</p>
      <div class="ta-kinds">${K.map(k=>`<div class="ta-kind">${pill(k.tag)}<b>${esc(k.name)}</b><p>${esc(k.what)}</p><p><strong>${esc(k.who||'None yet')}</strong></p><p class="ta-src">${esc(k.src)}</p></div>`).join('')}</div></section>
    <section class="ta-sec" aria-labelledby="ta-all"><h2 id="ta-all">All ${trackers.length} at a glance</h2>
      <div class="tablewrap"><table class="ta-table ta-matrix"><thead><tr><th>Tracker</th><th class="r">PACs by ID</th><th class="r">Name patterns</th><th class="r">Companies</th><th class="r">Groups</th><th>Gifts passed on</th><th>Named people</th><th>Employees' gifts</th><th>Own super PACs</th><th class="r">Took some this cycle</th><th class="r">Career</th></tr></thead>
      <tbody>${trackers.map(row).join('')}</tbody></table></div>
      <p class="small muted">Green: counted toward the ✕. Amber: shown beside it. "Companies" adds the companies on the crypto and AI list after a +. "Waits": not in the files on hand yet; it fills in with the next <code>npm run corporate:pacs</code>.</p></section>
    <section class="ta-sec" aria-labelledby="ta-each"><h2 id="ta-each">Each tracker</h2>
      <div class="ta-tabs" role="group" aria-label="Tracker">${trackers.map(x=>`<button type="button" class="ta-tab" data-ab="${esc(x.key)}" aria-pressed="${x.key===t.key}"><span aria-hidden="true">${esc(x.emoji||'')}</span> ${esc(x.name)}</button>`).join('')}</div>
      <div id="ta-panel">${trackerPanel(t,counts[t.key])}</div></section>
    <footer class="ta-foot small muted">
      <p>"Took some this cycle" counts sitting members of Congress with at least one check${meta.read?`, from the FEC bulk files (${meta.read} members read${meta.through?`, checks through ${esc(meta.through)}`:''})`:''}. "Career" counts members with a check from the tracker's PACs in any cycle since ${esc(meta.careerFrom||'1979–80')}.</p>
      <p>A PAC matches a tracker by its FEC committee ID (each checked by hand against the committee records on file) or by its name as the FEC writes it. No committee counts for two trackers by ID. Andreessen Horowitz counts for both Crypto and Big Tech + AI; Palantir for both Big Defense and Big Tech + AI.</p>
    </footer>`;
}
