// Reading nonprofits' tax returns (IRS Form 990, 990-EZ and 990-PF) from the IRS's own e-file downloads
// (https://www.irs.gov/charities-non-profits/form-990-series-downloads), for scripts/build-990.mjs:
//   the yearly index      apps.irs.gov/pub/epostcard/990/xml/<year>/index_<year>.csv: one line a return filed that year,
//                         with the EIN, tax period, form, object ID and the monthly zip it's in
//   one return            read out of its monthly zip (about 150 MB) with three small byte-range requests: the zip's
//                         directory (read once a zip), the return's local header, and its compressed bytes
// The parts kept from a return: totals, political spending and payments to political organizations (Schedule C), grants
// to other organizations (Schedule I, or a private foundation's grants on the 990-PF) and related tax-exempt
// organizations (Schedule R). Donors (Schedule B) are blacked out of public copies, so they can't be read.
import zlib from 'node:zlib';

export const IRS_BASE='https://apps.irs.gov/pub/epostcard/990/xml';
export const indexURL=year=>`${IRS_BASE}/${year}/index_${year}.csv`;
export const zipURL=batch=>`${IRS_BASE}/${String(batch).slice(0,4)}/${batch}.zip`;
export const FORMS=new Set(['990','990EZ','990PF']);
export const normEIN=e=>String(e??'').replace(/\D/g,'').padStart(9,'0').slice(-9);

// One index line (RETURN_ID,FILING_TYPE,EIN,TAX_PERIOD,SUB_DATE,TAXPAYER_NAME,RETURN_TYPE,DLN,OBJECT_ID,XML_BATCH_ID); the
// name can hold commas, so the fields are read from both ends.
export function indexRow(line){
  const f=String(line||'').trim().split(',');
  if(f.length<10||!/^\d{18}$/.test(f.at(-2)||''))return null;
  const batch=f.at(-1),objectId=f.at(-2),form=f.at(-4),ein=normEIN(f[2]),period=f[3];
  if(!/^\d{6}$/.test(period)||!/^\d{4}_TEOS_XML_/.test(batch))return null;
  return {ein,period,name:f.slice(5,-4).join(',').trim(),form,objectId,batch};
}
// Each EIN's newest return of the three forms: the latest tax period, and of returns for the same period (an amended
// one), the latest filed (the larger object ID).
export function newestReturns(rows){
  const best=new Map();
  for(const r of rows){if(!r||!FORMS.has(r.form))continue;const was=best.get(r.ein);
    if(!was||r.period>was.period||(r.period===was.period&&r.objectId>was.objectId))best.set(r.ein,r);}
  return best;
}

// ---------- a zip read with byte ranges ----------
// The end-of-directory record in a zip's last bytes: where its directory starts and how long it is.
export function zipEnd(tail){
  const b=Buffer.from(tail),i=b.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if(i<0)throw new Error('Not a zip: no end-of-directory record');
  return {entries:b.readUInt16LE(i+10),size:b.readUInt32LE(i+12),offset:b.readUInt32LE(i+16)};
}
// The directory: each file's name, where its local header starts, its compressed size and method.
export function zipDirectory(buf){
  const b=Buffer.from(buf),out={};let p=0;
  while(p+46<=b.length&&b.readUInt32LE(p)===0x02014b50){
    const method=b.readUInt16LE(p+10),csize=b.readUInt32LE(p+20),n=b.readUInt16LE(p+28),x=b.readUInt16LE(p+30),c=b.readUInt16LE(p+32),offset=b.readUInt32LE(p+42);
    out[b.toString('utf8',p+46,p+46+n)]={offset,csize,method};p+=46+n+x+c;
  }
  return out;
}
// A file's bytes, given its local header and what follows (at least 30 + name + extra + compressed size bytes).
export function zipFile(local,entry){
  const b=Buffer.from(local);
  if(b.readUInt32LE(0)!==0x04034b50)throw new Error('Not a zip local header');
  const start=30+b.readUInt16LE(26)+b.readUInt16LE(28),data=b.subarray(start,start+entry.csize);
  if(data.length<entry.csize)throw new Error('Zip entry cut short');
  if(entry.method===8)return zlib.inflateRawSync(data);
  if(entry.method===9)return inflate(data,{deflate64:true});
  if(entry.method===0)return Buffer.from(data);
  throw new Error(`Zip method ${entry.method} not supported`);
}
// Inflate (RFC 1951), and Deflate64, which the IRS's zips use (method 9) and Node's zlib can't read: the same format with
// a 64 KB window, length code 285 taking 16 extra bits from a base of 3, and distance codes 30 and 31.
const ORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
const LBASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
const LEXTRA=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
const DBASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,32769,49153];
const DEXTRA=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14];
function huff(lengths){
  const counts=new Uint16Array(16),offs=new Uint16Array(16),symbols=new Uint16Array(lengths.length);
  for(const l of lengths)counts[l]++;counts[0]=0;
  for(let i=1;i<16;i++)offs[i]=offs[i-1]+counts[i-1];
  lengths.forEach((l,s)=>{if(l)symbols[offs[l]++]=s;});
  return {counts,symbols};
}
export function inflate(input,{deflate64=false}={}){
  const src=Buffer.from(input);let pos=0,bit=0,out=Buffer.alloc(Math.max(1024,src.length*8)),n=0;
  const need=k=>{if(n+k>out.length){const b=Buffer.alloc(Math.max(out.length*2,n+k));out.copy(b,0,0,n);out=b;}};
  const bits=k=>{let v=0;for(let i=0;i<k;i++){if(pos>=src.length)throw new Error('Inflate: input cut short');v|=((src[pos]>>bit)&1)<<i;if(++bit===8){bit=0;pos++;}}return v;};
  const decode=t=>{let code=0,first=0,index=0;for(let len=1;len<16;len++){code|=bits(1);const c=t.counts[len];if(code-first<c)return t.symbols[index+code-first];index+=c;first+=c;first<<=1;code<<=1;}throw new Error('Inflate: bad code');};
  let fixedL,fixedD;
  for(let last=0;!last;){
    last=bits(1);const type=bits(2);
    if(type===0){if(bit){bit=0;pos++;}const len=src.readUInt16LE(pos);pos+=4;need(len);src.copy(out,n,pos,pos+len);n+=len;pos+=len;continue;}
    let L,D;
    if(type===1){if(!fixedL){const l=new Array(288).fill(8,0,144).fill(9,144,256).fill(7,256,280).fill(8,280,288);fixedL=huff(l);fixedD=huff(new Array(32).fill(5));}L=fixedL;D=fixedD;}
    else if(type===2){
      const hlit=bits(5)+257,hdist=bits(5)+1,hclen=bits(4)+4,cl=new Array(19).fill(0);
      for(let i=0;i<hclen;i++)cl[ORDER[i]]=bits(3);
      const C=huff(cl),lens=[];
      while(lens.length<hlit+hdist){const s=decode(C);
        if(s<16)lens.push(s);
        else if(s===16){const p=lens.at(-1);for(let r=3+bits(2);r>0;r--)lens.push(p);}
        else if(s===17){for(let r=3+bits(3);r>0;r--)lens.push(0);}
        else{for(let r=11+bits(7);r>0;r--)lens.push(0);}}
      L=huff(lens.slice(0,hlit));D=huff(lens.slice(hlit,hlit+hdist));
    }else throw new Error('Inflate: bad block type');
    for(;;){
      const s=decode(L);
      if(s<256){need(1);out[n++]=s;continue;}
      if(s===256)break;
      const i=s-257,len=deflate64&&i===28?3+bits(16):LBASE[i]+bits(LEXTRA[i]);
      const d=decode(D);if(d>=(deflate64?32:30))throw new Error('Inflate: bad distance');
      const dist=DBASE[d]+bits(DEXTRA[d]);if(dist>n)throw new Error('Inflate: distance too far');
      need(len);for(let k=0;k<len;k++,n++)out[n]=out[n-dist];
    }
  }
  return out.subarray(0,n);
}

// ---------- a return's parts ----------
const unesc=s=>String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").trim();
// The first value of any of these tags in the text (tags without a namespace prefix, as the IRS writes them).
const tag=(x,...names)=>{for(const n of names){const m=new RegExp(`<${n}(?:\\s[^>]*)?>([^<]*)</${n}>`).exec(x);if(m)return unesc(m[1]);}return null;};
const amt=(x,...names)=>{const v=tag(x,...names);return v==null||v===''?null:Number(v);};
const blocks=(x,name)=>{const out=[],re=new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`,'g');let m;while((m=re.exec(x)))out.push(m[1]);return out;};
const section=(x,name)=>blocks(x,name)[0]||'';
const bizName=x=>[tag(x,'BusinessNameLine1Txt','BusinessNameLine1'),tag(x,'BusinessNameLine2Txt','BusinessNameLine2')].filter(Boolean).join(' ')||null;
const sum=(l,k)=>Math.round(l.reduce((t,r)=>t+(Number(r[k])||0),0));
export const TOP_GRANTS=25;

// A return's text -> what the site keeps.
export function parse990(xml){
  const x=String(xml||''),head=section(x,'ReturnHeader'),form=tag(head,'ReturnTypeCd');
  if(!form)throw new Error('Not an IRS e-file return');
  const filer=section(head,'Filer'),c=section(x,'IRS990ScheduleC'),i=section(x,'IRS990ScheduleI'),r=section(x,'IRS990ScheduleR');
  const sub=/<Organization501c3Ind/.test(x)?'3':(/organization501cTypeTxt="(\d+)"/.exec(x)||[])[1]||(/<Organization501cTypeTxt>(\d+)</.exec(x)||[])[1]||(form==='990PF'?'PF':null);
  const to527=blocks(c,'Section527PoliticalOrgGrp').map(g=>({name:bizName(section(g,'OrganizationBusinessName'))||bizName(g),ein:tag(g,'EIN')?normEIN(tag(g,'EIN')):null,
    paid:amt(g,'PaidInternalFundsAmt')||0,passed:amt(g,'ContributionsRcvdDlvrAmt')||0})).filter(g=>g.name);
  const grants=[...blocks(i,'RecipientTable').map(g=>({name:bizName(section(g,'RecipientBusinessName'))||bizName(g),ein:tag(g,'RecipientEIN')?normEIN(tag(g,'RecipientEIN')):null,
      section:tag(g,'IRCSectionDesc'),amount:(amt(g,'CashGrantAmt')||0)+(amt(g,'NonCashAssistanceAmt')||0),purpose:tag(g,'PurposeOfGrantTxt')})),
    // A private foundation's grants (990-PF Part XV): organizations only; a grant to a person is left out.
    ...blocks(x,'GrantOrContributionPdDurYrGrp').filter(g=>/<RecipientBusinessName/.test(g)).map(g=>({name:bizName(section(g,'RecipientBusinessName')),ein:null,
      section:tag(g,'RecipientFoundationStatusTxt'),amount:amt(g,'Amt')||0,purpose:tag(g,'GrantOrContributionPurposeTxt')}))].filter(g=>g.name&&g.amount>0).sort((a,b)=>b.amount-a.amount);
  const related=blocks(r,'IdRelatedTaxExemptOrgGrp').map(g=>({name:bizName(section(g,'DisregardedEntityName'))||bizName(g),ein:tag(g,'EIN')?normEIN(tag(g,'EIN')):null,
    section:tag(g,'ExemptCodeSectionTxt')})).filter(g=>g.name);
  return {ein:normEIN(tag(filer,'EIN')),name:bizName(filer),form,taxYear:Number(tag(head,'TaxYr'))||null,periodEnd:tag(head,'TaxPeriodEndDt'),subsection:sub,
    revenue:amt(x,'CYTotalRevenueAmt','TotalRevenueAmt','TotalRevAndExpnssAmt'),contributions:amt(x,'CYContributionsGrantsAmt','ContributionsGiftsGrantsEtcAmt','ContriRcvdRevAndExpnssAmt'),
    expenses:amt(x,'CYTotalExpensesAmt','TotalExpensesAmt','TotalExpensesRevAndExpnssAmt'),
    // Lobbying and political spending its members can't deduct (a 501(c)(4), (5) or (6), Schedule C Part III), or a
    // charity's lobbying (Part II).
    lobbying:amt(c,'NonDeductibleLbbyngPltclCYAmt','TotalLobbyingExpendituresAmt','TotLobbyingExpendituresAmt'),
    political:{spent:amt(c,'PoliticalExpendituresAmt'),exemptFunction:amt(c,'TotalExemptFunctionExpendAmt'),toPoliticalOrgs:sum(to527,'paid'),passedThrough:sum(to527,'passed'),orgs:to527.sort((a,b)=>b.paid+b.passed-(a.paid+a.passed))},
    grants:{total:sum(grants,'amount'),n:grants.length,top:grants.slice(0,TOP_GRANTS)},related:related.slice(0,40)};
}
