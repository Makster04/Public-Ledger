// The promise finder: commitments in what members said (floor speeches, press releases, posts), the bill each one is
// about, and what they then did on it. Nothing it finds counts until a person reviews it (scripts/review-promises.mjs);
// scripts/find-promises.mjs reads the collected statements and writes the review queue.
//   1. A commitment: a sentence where they say what they will do ("I will vote no"), or where they take a side now
//      ("I oppose", "I rise in support of"). Reports of what they already did ("I voted for") aren't commitments.
//   2. The bill: one it names (by number or name), or, when it names none, the bill they voted on within CONTEXT_DAYS
//      afterward whose title and summary share the statement's subject (SALT, Ukraine, the debt limit, a nominee's name).
//   3. What they did: their recorded votes on it after the statement (and bills they sponsored or cosponsored), and a
//      draft verdict from the deciding vote. Conditions, procedural votes and changed bills are flagged for review.
import {billsInText} from './feeds.mjs';
import {billKey,billKeyFromText} from '../public/grades.js';

export const CONTEXT_DAYS=30, NAMED_DAYS=730;
const DAY=86400000;
export const daysBetween=(a,b)=>Math.round((Date.parse(String(b).slice(0,10))-Date.parse(String(a).slice(0,10)))/DAY);
// The Congress sitting on a date (the 118th: 2023–24).
export const congressOn=d=>Math.floor((Number(String(d).slice(0,4))-1789)/2)+1;
const fold=v=>String(v||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase();
const letters=v=>fold(v).replace(/[^a-z]/g,'');
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export const surnameOf=p=>String(p?.name||'').replace(/,?\s+(Jr\.?|Sr\.?|III|II|IV)$/i,'').trim().split(/\s+/).at(-1)||'';

// ---------- 1. Commitments ----------
// Sentences, keeping abbreviations together ("Mr. President", "H.R. 1", "U.S. Senate").
const ABBR=/\b(?:Mr|Mrs|Ms|Dr|Sen|Rep|Gov|Gen|Lt|Sgt|Jr|Sr|St|No|Nos|vs?|Inc|Co|Corp|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|Res|Con|Amdt|[A-Z])\./g;
export function sentences(text){
  const t=String(text||'').replace(/\s+/g,' ').replace(ABBR,m=>m.slice(0,-1)+'․');
  return t.split(/(?<=[.!?…]["”’)\]]*)\s+(?=["“‘(\[]?[A-Z])/).map(s=>s.replace(/․/g,'.').trim()).filter(s=>s.length>2);
}
const APOS=`['’]`;
const NEG=String.raw`(?:will not|won${APOS}?t|cannot|can${APOS}?t|could not|couldn${APOS}?t|refuse to|will never|would never|do not|don${APOS}?t|am not going to|${APOS}m not going to|are not going to|aren${APOS}?t going to|${APOS}re not going to)`;
// What a refusal is about: "I won't vote for", "we cannot support" (not "I don't believe", "we can't build").
const REFUSED=String.raw`\s+(?:(?:ever|again|simply|just|in good conscience)\s+)?(?:vote|support|back|accept|sign|cosponsor|confirm|allow|stand (?:by|for|with|behind)|go along|play along|be (?:a )?part of|agree to|let (?:this|that|it) (?:pass|happen|stand))\b`;
const FUT=String.raw`(?:will|${APOS}ll|shall|am going to|${APOS}m going to|are going to|${APOS}re going to|plan to|intend to|pledge to|promise to|vow to|commit to|am committed to|${APOS}m committed to|are committed to|am determined to|${APOS}m determined to)`;
const NOW_VERB=String.raw`(?:voting|supporting|opposing|introducing|cosponsoring|calling for|fighting|urging|asking|proud to (?:support|cosponsor|introduce|vote|stand))`;
const NOW=String.raw`(?:(?:(?:strongly|firmly|fully|proudly|absolutely|wholeheartedly|continue to)\s+)?(?:support|oppose|urge|reject|endorse|stand (?:with|against|behind|by))|(?:am|${APOS}m|are|${APOS}re) ${NOW_VERB}|have introduced|introduced|cosponsored|(?:am|${APOS}m) a cosponsor|rise (?:today )?(?:in (?:strong )?(?:support|opposition)|to (?:support|oppose|speak (?:in support|in opposition|against))))`;
const SUBJECT=String.raw`\b(?:I|we|my colleagues and I)\s+(?:(?:also|still|simply|just|absolutely|certainly|now|today)\s+)?`;
// A press-release headline or a video title written about them: "Ossoff Vows to…", "Sen. Marshall Introduces…".
const THIRD_PROMISE=String.raw`(?:will|won${APOS}?t|vows?|pledges?|promises?|plans?|intends?)`;
const THIRD_STANCE=String.raw`(?:urges?|opposes?|supports?|backs?|rejects?|announces? (?:(?:her|his|their) )?(?:opposition|support)|introduces?|unveils?|cosponsors?|pushes? for|fights? (?:for|against)|demands?|calls? (?:for|on)|slams?|blasts?|condemns?|denounces?|champions?)`;
const OPPOSE=/\b(?:vote (?:no|nay|against)|voting (?:no|nay|against)|oppos\w*|opposition|against|stop|block\w*|kill|defeat|repeal|reject\w*|filibuster|slam\w*|blast\w*|condemn\w*|denounc\w*|sink)\b/i;
const SUPPORT=/\b(?:vote (?:yes|yea|aye|for|to pass|to confirm)|voting (?:yes|yea|for)|support\w*|pass\w*|cosponsor\w*|introduc\w*|champion\w*|fight(?:ing)? for|back\w*|sign|approv\w*|confirm\w*|endors\w*|urg\w*|calls? (?:for|on)|push\w* for|demand\w*|unveil\w*)\b/i;
const CONDITION=/\b(?:if|unless|as long as|so long as|only if|provided that|until)\b/i;

// Which side a clause takes: the first "for" or "against" word after the commitment, turned around after "won't".
function sideOf(clause,negative){
  const o=OPPOSE.exec(clause),s=SUPPORT.exec(clause);
  let side=o&&(!s||o.index<=s.index)?'oppose':s?'support':'unclear';
  if(negative&&side!=='unclear')side=side==='oppose'?'support':'oppose';
  return side;
}
// The commitment in one sentence, or null. name: the person's surname, for headlines written about them.
// The patterns tried, in order, for a person (compiled once for each surname).
const PATTERNS=new Map();
function patterns(name){
  const k=name||'';if(PATTERNS.has(k))return PATTERNS.get(k);
  const third=name?String.raw`\b(?:(?:Sen(?:ator|\.)?|Rep(?:resentative|\.)?|Congress(?:man|woman)|Leader)\s+)?${esc(name)}\s+`:null;
  const tries=[[SUBJECT+NEG+REFUSED,'promise',true],[SUBJECT+FUT+'\\b','promise',false],[SUBJECT+NOW+'\\b','stance',false]];
  if(third)tries.push([third+`(?:won${APOS}?t)\\b`,'promise',true],[third+THIRD_PROMISE+'\\b','promise',false],[third+THIRD_STANCE+'\\b','stance',false]);
  const out=tries.map(([re,kind,negative])=>[new RegExp(re,'i'),kind,negative]);PATTERNS.set(k,out);return out;
}
export function commitmentIn(sentence,name){
  const s=String(sentence||'');
  for(const [re,kind,negative] of patterns(name)){
    const m=re.exec(s);if(!m)continue;
    // From the commitment on: its verb ("I rise in support", "won't vote for") and what follows.
    const side=sideOf(s.slice(m.index),negative);
    return {kind,side,sentence:s.trim(),conditional:CONDITION.test(s)};
  }
  return null;
}
// Every commitment in a text, each with the sentences around it (for linking and for the reviewer).
export function commitments(text,name){
  const list=sentences(text),out=[];
  list.forEach((s,i)=>{const c=commitmentIn(s,name);if(c)out.push({...c,context:list.slice(Math.max(0,i-1),i+2).join(' ')});});
  return out;
}

// ---------- 2. Bills ----------
// Bill numbers, without the ones a possessive makes up ("CPR News's 2026" isn't S. 2026).
export function billNumbers(text,date){
  return billsInText(String(text||'').replace(/['’]s\b/g,''),congressOn(date));
}
const norm=s=>' '+fold(s).replace(/[’']/g,"'").replace(/[^a-z0-9']+/g,' ').replace(/\s+/g,' ').trim()+' ';
// Names people use for bills that their titles don't give.
export const ALIASES=[
  ['big beautiful bill','119-hr-1'],['obbba','119-hr-1'],['obbb','119-hr-1'],['laken riley','119-s-5'],
  ['tax cuts and jobs act','115-hr-1'],['tcja','115-hr-1'],['inflation reduction act','117-hr-5376'],['american rescue plan','117-hr-1319'],
  ['chips and science act','117-hr-4346'],['bipartisan infrastructure','117-hr-3684'],['infrastructure investment and jobs act','117-hr-3684'],
  ['respect for marriage act','117-hr-8404'],['bipartisan safer communities act','117-s-2938'],['pact act','117-s-3373'],['fiscal responsibility act','118-hr-3746'],
];
// Titles too general to name one bill.
const GENERIC=/^ (?:(?:further |full year |consolidated |continuing |supplemental |additional )*appropriations(?: and extensions)? act|rescissions act|national defense authorization act|farm bill|reconciliation act|budget act|tax act) $/;
// The names to look for: [{name (normalized, with spaces around), key}]. titles: [{key, title}].
export function billNames(titles){
  const out=new Map();
  const add=(name,key)=>{const n=norm(name);if(n.trim().split(' ').length<2||GENERIC.test(n))return;(out.get(n)||out.set(n,new Set()).get(n)).add(key);};
  for(const {key,title} of titles){
    if(!key||!title)continue;
    const t=String(title).replace(/\s*\(.*?\)\s*/g,' ').replace(/,?\s+(?:of\s+)?\d{4}\s*$/,'').trim();
    // A name of three words or more ("Stop Insider Trading Act"), or two with an acronym first ("SAVE Act").
    const words=t.split(/\s+/);
    if(!/\bact$/i.test(t)||words.length<2)continue;
    if(words.length>=3||(/^[A-Z]{3,}$/.test(words[0])))add(t,key);
  }
  for(const [n,key] of ALIASES)add(n,key);
  return [...out].map(([name,keys])=>({name,keys:[...keys]}));
}
// The bills a text names: its bill numbers, then the bill names in it (a name inside a longer name it also has is the
// longer one's). Several bills of one name are all returned, newest Congress last.
// The names by their first word, so a text is checked only against names that start with one of its words.
const NAME_INDEX=new WeakMap();
const byFirstWord=names=>{let ix=NAME_INDEX.get(names);if(!ix){ix=new Map();for(const n of names){const w=n.name.trim().split(' ')[0];(ix.get(w)||ix.set(w,[]).get(w)).push(n);}NAME_INDEX.set(names,ix);}return ix;};
export function namedBills(text,date,names){
  const keys=new Set(billNumbers(text,date)),t=norm(text),ix=byFirstWord(names),hits=[];
  for(const w of new Set(t.trim().split(' ')))for(const n of ix.get(w)||[])if(!hits.includes(n)&&t.includes(n.name))hits.push(n);
  for(const h of hits)if(!hits.some(o=>o!==h&&o.name.length>h.name.length&&o.name.includes(h.name)))for(const k of h.keys)keys.add(k);
  const c=congressOn(date),congress=k=>Number(String(k).split('-')[0]);
  // A name in the Congress of the statement, or the next one, before older ones.
  return [...keys].sort((a,b)=>Math.abs(congress(a)-c-0.4)-Math.abs(congress(b)-c-0.4));
}

// Subjects named in a statement and in a bill's title or summary. Matching one is strong evidence of the same subject.
export const TOPICS={
  salt:/\bSALT\b|\bsalt (?:cap|deduction)|state and local tax/,
  'debt limit':/\bdebt (?:limit|ceiling)|default on (?:our|the) debt|fiscal responsibility act/i,
  reconciliation:/big,? beautiful bill|\bOBBBA?\b|\breconciliation\b/i,
  ukraine:/ukrain/i,israel:/\bisrael/i,taiwan:/taiwan/i,gaza:/\bgaza\b|\bhamas\b/i,
  border:/\bborder\b|immigra|asylum|migrant|illegal alien|laken riley|deport/i,
  medicaid:/medicaid/i,medicare:/medicare\b/i,'social security':/social security/i,snap:/\bSNAP\b|food stamps|nutrition assistance/,
  'health care':/affordable care act|obamacare|\bACA\b|premium tax credit|health insurance premium/,
  funding:/shutdown|continuing resolution|\bstopgap\b|government funding|fund the government|keep the government open|appropriations/i,
  stocks:/stock (?:trading|trades|ban|market)|insider trading|trading (?:individual )?stocks|\bstock act\b|trade stocks/i,
  abortion:/abortion|\broe\b|reproductive|\bdobbs\b|unborn/i,guns:/\bguns?\b|firearm|safer communities|assault weapon/i,
  climate:/climate|inflation reduction act|clean energy/i,chips:/\bCHIPS\b|semiconductor/,infrastructure:/infrastructure/i,
  crypto:/crypto|stablecoin|\bGENIUS\b|digital asset/,tiktok:/tiktok|bytedance/i,impeachment:/impeach/i,tariffs:/tariff/i,
  veterans:/veteran|\bPACT Act\b|burn pit/,drugs:/insulin|drug pric|prescription drug/i,marriage:/same-sex marriage|respect for marriage/i,
  elections:/electoral (?:votes?|count|college)|certif(?:y|ication|ying) (?:the )?(?:election|electoral)|\bSAVE Act\b|voter id|proof of citizenship|voting rights/i,
  epstein:/epstein/i,venezuela:/venezuela/i,'war powers':/war powers/i,unions:/\bunions?\b|\bPRO Act\b|collective bargaining|right to organize/,
  wages:/minimum wage|raise the wage|equal pay|paycheck fairness/i,taxes:/\btax (?:cuts?|increases?|hikes?|relief|bill|breaks?)|raise taxes|tax(?:es)? on/i,
};
// Subjects of the most-debated bills that their saved titles and summaries leave out.
export const BILL_TOPICS={
  '119-hr-1':['reconciliation','salt','medicaid','snap','debt limit','taxes','border'],'115-hr-1':['reconciliation','salt','taxes','health care'],
  '118-hr-3746':['debt limit','snap'],'118-hr-8035':['ukraine'],'118-hr-815':['ukraine','israel','taiwan','gaza','border'],
  '117-hr-5376':['climate','drugs','medicare','health care','taxes'],'117-hr-1319':['health care'],'117-hr-3684':['infrastructure'],
  '119-hr-4':['funding'],'119-hr-1968':['funding'],'119-hr-5371':['funding'],'119-hr-7148':['funding'],
};
export const topicsIn=text=>new Set(Object.entries(TOPICS).filter(([,re])=>re.test(String(text||''))).map(([k])=>k));
const STOP=new Set(`a about above act acts after again against all also am an and any are as at be because been before being below between both but by can congress could did do does doing down during each every federal few for from further get had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our ours out over own people same senate house she should so some such than that the their them then there these they this those through to too under until up us very was we were what when where which while who whom why will with would you your bill bills legislation vote votes voted voting today year years american americans america united states state nation national country government provide provides providing purposes amend amends amended title section code resolution joint concurrent motion amendment amendments passage cloture proceed proceeding nomination agree agreed agreeing question order senator senators representative representatives member members colleague colleagues president speaker madam mr ms mrs time make made need needs must going want sure know think thing things way new day days week weeks month months support supports supported supporting oppose opposed opposing opposition stand fight continue work working help ensure every one two three first last fiscal certain other others relating related respect including include includes may shall upon within without well like said says say back right rise let lets got really much many even still never ever always another good great important deal`.split(/\s+/));
const stem=w=>w.replace(/'s$/,'').replace(/(?<=\w{3})ies$/,'y').replace(/(?<=\w{3}[^s])s$/,'');
export const termsIn=text=>new Set(norm(text).trim().split(' ').map(w=>w.replace(/'/g,'')).filter(w=>w.length>=4&&!/^\d+$/.test(w)&&!STOP.has(w)).map(stem).filter(w=>!STOP.has(w)));
// The bills that can be linked by subject: {docs: Map key -> {terms, topics}, df: Map term -> bills, n}. bills: [{key, text}]
export function subjectIndex(bills){
  const docs=new Map();
  for(const {key,text} of bills){if(!key)continue;const d=docs.get(key)||docs.set(key,{text:''}).get(key);d.text+=' '+(text||'');}
  const df=new Map();
  for(const [key,d] of docs){d.terms=termsIn(d.text);d.topics=new Set([...topicsIn(d.text),...(BILL_TOPICS[key]||[])]);delete d.text;for(const w of d.terms)df.set(w,(df.get(w)||0)+1);}
  return {docs,df,n:docs.size};
}
export const MIN_SUBJECT=3;
// How well a statement fits one bill: 3 for each subject both name, plus the rarity of each word they share. It fits
// only with an anchor: a subject both name, or a word few bills have (a nominee's surname, "Hegseth").
// text: a statement, or prepare(statement) when it is compared with many bills.
export const prepare=text=>({terms:termsIn(text),topics:topicsIn(text)});
export function subjectFit(text,key,index){
  const d=index.docs.get(key);if(!d)return {score:0,anchor:false,words:[]};
  const p=typeof text==='string'?prepare(text):text;
  const topics=[...p.topics].filter(t=>d.topics.has(t)),terms=[...p.terms].filter(w=>d.terms.has(w));
  const idf=w=>Math.log((index.n+1)/((index.df.get(w)||0)+1)),rare=w=>(index.df.get(w)||0)<=Math.max(2,index.n*0.01);
  const score=3*topics.length+terms.reduce((a,w)=>a+Math.min(idf(w),5),0);
  return {score:Number(score.toFixed(2)),anchor:topics.length>0||terms.some(rare),words:[...new Set([...topics,...terms.sort((a,b)=>idf(b)-idf(a))])].slice(0,8)};
}

// ---------- 3. What they did ----------
// What kind of vote a roll call is. "final": passage, concurring, a conference report, a nomination, a resolution, a
// veto override; "procedural": cloture, motions to proceed, table or recommit, rules; "amendment": an amendment to it.
export function voteKind(question){
  const q=String(question||'');
  if(/suspend the rules and (?:pass|agree)/i.test(q))return 'final';
  if(/amendment/i.test(q)&&!/concur|recede|(?:senate|house) amendment/i.test(q))return 'amendment';
  if(/cloture|motion to proceed|\btable\b|recommit|previous question|\brule\b|waive|point of order|discharge|instruct|quorum|adjourn|reconsider/i.test(q))return 'procedural';
  return 'final';
}
export const castOf=v=>/^(?:yea|aye|yes|guilty)$/i.test(String(v||'').trim())?'yes':/^(?:nay|no|not guilty)$/i.test(String(v||'').trim())?'no':'missed';
export const fmtDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):String(d||'');
const VERDICT={consistent:'kept',partial:'partly kept',contradiction:'broken',unclear:'needs a closer look',pending:'no vote on it yet',changed:'changed'};
export const verdictLabel=a=>VERDICT[a]||a;
// A draft verdict from what they did after the statement. acts: one bill's actions on or after the statement date,
// oldest first ({kind: 'vote'|'sponsored'|'cosponsored', vote, question, date}).
export function draftVerdict(side,acts){
  const votes=acts.filter(a=>a.kind==='vote'&&voteKind(a.question)!=='amendment');
  const final=votes.filter(a=>voteKind(a.question)==='final'),pick=final.at(-1)||votes.at(-1);
  const flags=[];
  if(!pick){
    const s=acts.find(a=>a.kind!=='vote');
    return {assessment:'pending',why:s?`No vote on it yet; they ${s.kind} it on ${fmtDate(s.date)}.`:'No vote on it yet.',flags,deciding:null};
  }
  const cast=castOf(pick.vote),procedural=voteKind(pick.question)==='procedural';
  if(procedural)flags.push('procedural');
  if(new Set(final.map(a=>castOf(a.vote)).filter(c=>c!=='missed')).size>1)flags.push('mixed');
  const what=`${pick.vote} (${String(pick.question||'').replace(/^on\s+(?:the\s+)?/i,'').toLowerCase()||'vote'}, ${fmtDate(pick.date)})`;
  if(cast==='missed'){flags.push('missed');return {assessment:'unclear',why:`They didn't vote: ${what}.`,flags,deciding:pick};}
  if(side==='unclear'){flags.push('side');return {assessment:'unclear',why:`Voted ${what}; the statement doesn't say which way they'd vote.`,flags,deciding:pick};}
  const matches=(side==='support')===(cast==='yes');
  if(matches)return procedural?{assessment:'partial',why:`Only a procedural vote so far, and it matches: ${what}.`,flags,deciding:pick}
    :{assessment:'consistent',why:`Voted ${what}, as the statement said they would.`,flags,deciding:pick};
  return procedural?{assessment:'unclear',why:`A procedural vote went the other way: ${what}.`,flags,deciding:pick}
    :{assessment:'contradiction',why:`Voted ${what}, the opposite of the statement.`,flags,deciding:pick};
}
export const FLAGS={
  conditional:'The promise has a condition ("if…", "unless…"): check whether it happened.',
  procedural:'Only a procedural vote (cloture, a motion to proceed): moving a bill forward isn\'t passing it.',
  'same-day':'The vote was the same day as the statement: check the statement came first.',
  subject:'Linked by subject, not by name: check this is the bill they meant.',
  side:'The statement doesn\'t say clearly whether they were for or against it.',
  missed:'They didn\'t vote on it.',
  mixed:'Their votes on it went both ways (the bill may have changed between votes).',
  others:'Other bills also fit: check the right one is linked.',
  'sponsor-only':'No vote yet: only sponsoring or cosponsoring it.',
};

// ---------- Putting it together ----------
// The actions from a date through `days` after it. acts: oldest first.
export function actsAfter(acts,date,days){
  let lo=0,hi=acts.length;while(lo<hi){const m=(lo+hi)>>1;if(acts[m].date<date)lo=m+1;else hi=m;}
  const end=new Date(Date.parse(date)+days*DAY).toISOString().slice(0,10),out=[];
  for(let i=lo;i<acts.length&&acts[i].date<=end;i++)out.push(acts[i]);
  return out;
}
// One statement's commitments linked to bills and actions. statement: {person, source, text, title, date, url, srcTitle};
// acts: the person's actions, oldest first ({kind, key, date, vote, question, what, url}); names: billNames();
// index: subjectIndex(); titleOf: key -> a bill's title.
export function linkStatement(statement,{acts,names,index,surname}){
  const out=[],date=String(statement.date||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return out;
  const found=commitments(statement.text,surname);
  // A headline that is itself the commitment ("Ossoff Vows to Block…") when the body has none.
  if(!found.length&&statement.title&&statement.title!==statement.text)for(const c of commitments(statement.title,surname))found.push(c);
  const named=actsAfter(acts,date,NAMED_DAYS),near=actsAfter(acts,date,CONTEXT_DAYS);
  for(const c of found.slice(0,6)){
    // The bill: named in the sentence, then in the headline or speech title, then the only one the text names.
    let keys=namedBills(c.sentence,date,names),how='named';
    if(!keys.length&&statement.title)keys=namedBills(statement.title,date,names);
    if(!keys.length){const all=namedBills(statement.text,date,names);if(all.length===1)keys=all;}
    let key=null,fit=null,others=[];
    if(keys.length)key=keys.find(k=>named.some(a=>a.key===k))||keys[0];
    else{
      how='subject';
      const text=prepare(`${c.context} ${statement.title||''}`);
      const ranked=[...new Set(near.map(a=>a.key))].map(k=>({k,...subjectFit(text,k,index)})).filter(x=>x.anchor&&x.score>=MIN_SUBJECT).sort((a,b)=>b.score-a.score);
      if(!ranked.length)continue;
      key=ranked[0].k;fit=ranked[0];others=ranked.slice(1).filter(x=>x.score>=ranked[0].score*0.7).map(x=>x.k).slice(0,3);
    }
    const did=(how==='named'?named:near).filter(a=>a.key===key);
    // A stance with nothing done since, or a bill linked by subject with no vote, isn't a check yet.
    if(!did.length&&(how==='subject'||c.kind!=='promise'))continue;
    const draft=draftVerdict(c.side,did),flags=[...draft.flags];
    if(c.conditional)flags.unshift('conditional');
    if(how==='subject')flags.push('subject');
    if(others.length)flags.push('others');
    if(draft.deciding&&draft.deciding.date===date)flags.push('same-day');
    if(!did.some(a=>a.kind==='vote')&&did.length)flags.push('sponsor-only');
    out.push({person:statement.person,bill:key,side:c.side,kind:c.kind,
      said:{text:c.sentence,context:c.context===c.sentence?undefined:c.context,date,source:statement.source,src:{t:statement.srcTitle||statement.source,u:statement.url}},
      link:{how,...(fit?{score:fit.score,words:fit.words}:{}),...(others.length?{others}:{})},
      did,draft:{assessment:draft.assessment,label:verdictLabel(draft.assessment),why:draft.why},flags:[...new Set(flags)]});
  }
  // One check per bill from a statement: the commitment that says most clearly which way they'd go.
  const rank=x=>(x.side==='unclear'?0:2)+(x.kind==='promise'?1:0),best=new Map();
  for(const x of out)if(!best.has(x.bill)||rank(x)>rank(best.get(x.bill)))best.set(x.bill,x);
  return [...best.values()];
}
// One review item per person, bill and side: the earliest statement, with the later ones listed as "also".
export const reviewKey=x=>`${x.person}|${x.bill}|${x.side}`;
export function groupFindings(found){
  const by=new Map();
  for(const x of found.slice().sort((a,b)=>a.said.date.localeCompare(b.said.date))){
    const k=reviewKey(x),o=by.get(k);
    if(!o){by.set(k,{id:k,...x,also:[]});continue;}
    if(o.also.length<5&&!o.also.some(s=>s.src.u===x.said.src.u)&&o.said.src.u!==x.said.src.u)o.also.push({text:x.said.text,date:x.said.date,src:x.said.src});
  }
  return [...by.values()];
}
// The bills already checked for a person in the reviewed statements: the bills named in each check's topic and record,
// and the bill of the roll call it links to. votes: the saved roll calls ({key, url}).
export function checkedBills(person,votes=[]){
  const out=new Set();
  for(const s of person?.statements||[]){
    for(const k of billNumbers(`${s.topic||''} ${s.did?.text||''}`,s.did?.date||s.said?.date||''))out.add(k);
    const u=s.did?.src?.u;if(u)for(const v of votes)if(v.url===u&&v.key)out.add(v.key);
  }
  return out;
}

// The roll calls saved in public/research.json ("votes", "hvotes"), with each tracked person's position: the votes the
// finder can use anywhere (scripts/find-promises.mjs adds every other roll call from Voteview where it can be read).
export function savedVotes(research){
  const out=[];
  for(const [chamber,list] of [['S',research?.votes||[]],['H',research?.hvotes||[]]])for(const v of list){
    const [congress,session,number]=chamber==='S'?[v.congress,v.session,v.number]:String(v.id).split('-').slice(1).map(Number);
    out.push({id:v.id,chamber,congress:Number(congress),session:Number(session),number:Number(chamber==='S'?number:v.roll),key:billKeyFromText(v.bill?.measure)||`roll:${v.id}`,date:v.date,
      question:v.bill?.voteQuestion||v.question||'',what:v.bill?.popularTitle||v.short||'',measure:String(v.bill?.measure||'').replace(/\s*\(.*$/,''),
      text:[v.short,v.issue,v.bill?.popularTitle,v.bill?.officialTitle,v.bill?.summary].filter(Boolean).join(' '),pos:v.pos||{},
      url:chamber==='S'?`https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${String(number).padStart(5,'0')}.htm`:`https://clerk.house.gov/Votes/${v.year}${v.roll}`});
  }
  return out;
}
// One person's votes, oldest first, as actions.
export const votesOf=(id,votes)=>votes.filter(v=>v.pos[id]&&!/not in office/i.test(v.pos[id])).map(v=>({kind:'vote',key:v.key,date:v.date,vote:v.pos[id],question:v.question,what:v.what,measure:v.measure,chamber:v.chamber,congress:v.congress,session:v.session,number:v.number,url:v.url})).sort((a,b)=>a.date.localeCompare(b.date));

// ---------- Floor speeches ----------
// The text of a Congressional Record page from GovInfo (its HTML is the printed text in a <pre> block).
export function recordText(html){
  return String(html||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/\[\[Page [A-Z]?\d+\]\]/g,'').replace(/\{time\}\s+\d{4}/g,'').replace(/\r/g,'');
}
// What one member said on a Record page: their turns ("  Mr. OSSOFF. Mr. President, …") up to the next speaker's.
// person: {name, stateName}. A page whose turns can't be told apart gives nothing, rather than someone else's words.
export function speakerText(text,person){
  const turn=/^ {2,4}(?:(?:Mr|Mrs|Ms|Miss|Madam|Dr)\.\s+([A-Z][A-Z'’\- ]*[A-Z])(?:\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*))?|The\s+([A-Z][A-Za-z ]*?(?:pro tempore)?))\.\s/gm;
  const marks=[...String(text||'').matchAll(turn)];if(!marks.length)return '';
  const want=letters(surnameOf(person)),state=letters(person?.stateName);
  const parts=[];
  marks.forEach((m,i)=>{
    const who=letters(m[1]||'');if(!who||!want||!who.endsWith(want))return;
    if(m[2]&&state&&letters(m[2])!==state)return;
    parts.push(text.slice(m.index+m[0].length,i+1<marks.length?marks[i+1].index:text.length));
  });
  return parts.join(' ').replace(/\s+/g,' ').trim();
}
// Record page titles that are never about a bill.
export const ROUTINE=/^(?:prayer|pledge of allegiance|morning business|adjournment|recess|executive calendar|additional (?:statements|cosponsors)|submitted resolutions|messages? from the (?:house|senate|president)|measures? (?:referred|placed on the calendar|read)|enrolled bills?|executive and other communications|petitions and memorials|reports? of committees|introduction of bills|authority for committees|privileges of the floor|orders? for|unanimous consent|quorum call|appointments?|(?:a )?tribute|honoring|recognizing|remembering|celebrating|congratulating|in (?:honor|memory|recognition) of|personal explanation|leave of absence|the journal|designation of|notices? of|wishing|commending)/i;
