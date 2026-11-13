// Stances on the alignment questions (public/questions.json), and everything built from them: the Ideology lean, the
// political compass and Your match. Shared by the page, the build script (scripts/build-question-record.mjs) and the
// tests, so the numbers are worked out the same way everywhere.
//
// Points toward a question's side (sides[0] or sides[1]):
//   a statement that takes a side            3 (see the contradiction rule below)
//   a group rating on the topic              up to 3: 3 × |2 × score − 100| ÷ 100, toward the side the group favors when
//                                            the score is above 50, the other side when below (see ratingItems)
//   sponsoring a coded bill or amendment     1.5     an official act (executive office)    1.5
//   cosponsoring it                          1
//   a vote that decides it                   1       (Yea takes the bill's side, Nay the other)
// One credit per bill: a member who sponsored a bill and voted on it gets the higher value once, and several votes on
// one bill count once (the latest when they differ).
// Stance = (points for sides[0] − points for sides[1]) ÷ all points, from −1 to +1, shown once there are at least 3
// points; with fewer it reads "Not on record". Unknown never counts as either side.
// Contradiction rule: a statement is cancelled when a vote on the question taken after it went the other way. A
// statement made after an opposite vote counts, as a changed position, and the old vote still counts too.
export const QFORMULA='questions-2';
export const QPOINTS={statement:3,ratingMax:3,s:1.5,act:1.5,c:1,y:1,n:1,vote:1,state:1};
export const MIN_POINTS=3;
export const IDEOLOGY_MIN_CATEGORIES=3;
export const IMPORTANCE=[[1,'Least'],[2,'Less'],[3,'Somewhat'],[4,'More'],[5,'Most']];
const VOTE_KINDS=new Set(['y','n','vote','state']);
export const isVoteKind=k=>VOTE_KINDS.has(k);
const day=d=>String(d||'').slice(0,10);

// A record item's bill: "117-hr-1280#H117-123" -> "117-hr-1280".
export const billOf=ref=>String(ref||'').split('#')[0];
// One credit per bill: the highest-value item, and the latest of equal value. items: [{ref, kind, date, side}].
export function creditItems(items){
  const best=new Map();
  for(const it of items||[]){
    const k=billOf(it.ref),pts=QPOINTS[it.kind]??0;if(!pts)continue;
    const b=best.get(k);
    if(!b||pts>b.pts||(pts===b.pts&&day(it.date)>day(b.date)))best.set(k,{...it,pts});
  }
  return [...best.values()];
}
// Points for each side from record items (after one credit per bill), and the first and latest date of a credited vote
// toward each side, which the contradiction rule needs.
export function recordPoints(items){
  const out={a:0,b:0,firstA:'',lastA:'',firstB:'',lastB:''};
  for(const it of creditItems(items)){
    const A=it.side===0;out[A?'a':'b']+=it.pts;
    if(!isVoteKind(it.kind))continue;const d=day(it.date);if(!d)continue;
    const f=A?'firstA':'firstB',l=A?'lastA':'lastB';
    if(!out[f]||d<out[f])out[f]=d;if(!out[l]||d>out[l])out[l]=d;
  }
  out.a=Math.round(out.a*10)/10;out.b=Math.round(out.b*10)/10;
  return out;
}
// The contradiction rule for statements ([{side, date}]) against the votes (rec: recordPoints's dates). Each statement
// gets a status: "counted", "cancelled" (a later vote went the other way) or "changed" (counted; an earlier vote went
// the other way).
export function applyStatements(statements,rec={}){
  let a=0,b=0;
  const rows=(statements||[]).map(st=>{
    const d=day(st.date),A=st.side===0,laterOpp=A?rec.lastB:rec.lastA,earlierOpp=A?rec.firstB:rec.firstA;
    const status=d&&laterOpp&&laterOpp>d?'cancelled':d&&earlierOpp&&earlierOpp<d?'changed':'counted';
    if(status!=='cancelled'){if(A)a+=QPOINTS.statement;else b+=QPOINTS.statement;}
    return {...st,status};
  });
  return {a,b,rows};
}
// A group rating's points: 3 × |2s − 100| ÷ 100 toward the side the group favors (side: 0 or 1, score 0–100).
export const ratingPoints=score=>Number.isFinite(score)?QPOINTS.ratingMax*Math.abs(2*score-100)/100:0;
// A rating as a score from 0 to 100: the group's own percent, or its letter grade as A 100, B 75, C 50, D 25, F 0.
const LETTER_SCORE={A:100,B:75,C:50,D:25,F:0};
export function ratingScore(r){
  if(Number.isFinite(r?.score))return r.score;
  const m=/^([ABCDF])/i.exec(String(r?.grade||''));return m?LETTER_SCORE[m[1].toUpperCase()]:null;
}
// Group ratings on the questions. A question in public/questions.json can name the groups whose scorecard is about it,
// groups: {group key: the side a high rating from that group favors}; groups that rate across many topics (Heritage
// Action, CPAC, ProgressivePunch and the like) are on no question and count only in the Ideology tab's Ratings lean.
// A rating above 50 counts ratingPoints toward the group's side, one below 50 toward the other side, and 50 counts
// nothing (a score past 100, from bonus points, counts as 100). ratings: one person's rows in public/group-ratings.json
// ([{group, org, score?, grade?, year, url}]). Returns {question id: [{group, org, score, grade, year, url, favors, side,
// pts}]}.
export function ratingItems(ratings,questions){
  const by={};for(const q of questions||[])for(const [g,side] of Object.entries(q.groups||{}))(by[g]||=[]).push([q.id,side]);
  const out={};
  for(const r of ratings||[]){
    const on=by[r?.group];if(!on)continue;const raw=ratingScore(r);if(raw==null)continue;
    const sc=Math.max(0,Math.min(100,raw)),pts=Math.round(ratingPoints(sc)*10)/10;if(!pts)continue;
    for(const [qid,favors] of on)(out[qid]||=[]).push({group:r.group,org:r.org||r.group,score:Number.isFinite(r.score)?r.score:null,
      grade:r.grade||null,year:r.year??null,url:r.url||null,favors,side:sc>50?favors:1-favors,pts});
  }
  return out;
}

// Stance from the points: s from −1 (all sides[1]) to +1 (all sides[0]); null under MIN_POINTS.
export function stanceOf(a,b){
  const total=(a||0)+(b||0);
  return {a:a||0,b:b||0,total,s:total>=MIN_POINTS?(a-b)/total:null};
}
// Yes / Leans yes / Mixed / Leans no / No (or the question's own sides), or "Not on record".
export function stanceWord(s,sides=['Yes','No']){
  if(s==null||!Number.isFinite(s))return 'Not on record';
  const lc=x=>x.charAt(0).toLowerCase()+x.slice(1);
  return s>=0.6?sides[0]:s>=0.2?`Leans ${lc(sides[0])}`:s>-0.2?'Mixed':s>-0.6?`Leans ${lc(sides[1])}`:sides[1];
}
// A question's lean, −100 (liberal) to +100 (conservative), when it has a liberal side; null otherwise.
export function questionLean(s,q){
  if(s==null||q?.liberal==null)return null;
  return Math.round(100*s*(q.liberal===0?-1:1));
}
const mean=xs=>xs.length?xs.reduce((t,x)=>t+x,0)/xs.length:null;
// Category leans (the average of their questions' leans) and the overall lean (the average of the category leans, at
// least IDEOLOGY_MIN_CATEGORIES). stances: {question id: {s, a, b}}.
export function ideologyLeans(stances,questions,categories){
  const byCat=new Map((categories||[]).map(c=>[c.id,{id:c.id,label:c.name,questions:[]}]));
  for(const q of questions||[]){
    const st=stances?.[q.id],s=st?.s??null,c=byCat.get(q.cat);if(!c)continue;
    c.questions.push({id:q.id,q:q.q,sides:q.sides,liberal:q.liberal,s,a:st?.a||0,b:st?.b||0,word:stanceWord(s,q.sides),lean:questionLean(s,q)});
  }
  const cats=[...byCat.values()].map(c=>{const placed=c.questions.filter(x=>x.lean!=null),onRecord=c.questions.filter(x=>x.s!=null);
    const m=mean(placed.map(x=>x.lean));return {...c,lean:m==null?null:Math.round(m),n:placed.length,onRecord:onRecord.length};});
  const scored=cats.filter(c=>c.lean!=null),m=mean(scored.map(c=>c.lean));
  return {categories:cats,scored:scored.length,lean:scored.length>=IDEOLOGY_MIN_CATEGORIES&&m!=null?Math.round(m):null};
}
// The compass: economic (across) and social (up and down) leans, from the questions on each axis.
export function compassFrom(stances,questions){
  const on=axis=>(questions||[]).filter(q=>q.axis===axis).map(q=>questionLean(stances?.[q.id]?.s??null,q)).filter(v=>v!=null);
  const ex=on('econ'),so=on('social'),mx=mean(ex),my=mean(so);
  return {x:mx==null?null:Math.round(mx),y:my==null?null:Math.round(my),nx:ex.length,ny:so.length};
}
// Your match: agreement on each question = (1 + your side × their stance) ÷ 2 (your side +1 for sides[0], −1 for
// sides[1]), weighted by the importance you set (1–5), over the questions where you both have a position. As before
// the questions, a match shows once their record covers at least MATCH_MIN of your answered questions (all of them if
// you answered fewer) and at least half of your total importance.
// answers: {question id: {side: 0|1, w: 1–5}}.
export const MATCH_MIN=3;
export function matchFrom(answers,stances,questions){
  const qs=new Map((questions||[]).map(q=>[q.id,q]));
  const rows=Object.entries(answers||{}).filter(([id,a])=>qs.has(id)&&(a?.side===0||a?.side===1)&&a.w>0).map(([id,a])=>{
    const q=qs.get(id),s=stances?.[id]?.s??null,u=a.side===0?1:-1;
    return {q,answer:a,s,word:stanceWord(s,q.sides),agree:s==null?null:(1+u*s)/2,status:s==null?'none':'record'};
  });
  const cov=rows.filter(r=>r.agree!=null),totW=rows.reduce((t,r)=>t+r.answer.w,0),covW=cov.reduce((t,r)=>t+r.answer.w,0);
  const need=Math.min(MATCH_MIN,rows.length),enough=rows.length&&cov.length>=need&&2*covW>=totW;
  const score=enough&&covW?Math.round(100*cov.reduce((t,r)=>t+r.answer.w*r.agree,0)/covW):null;
  const byCat={};for(const r of cov){const c=byCat[r.q.cat]||(byCat[r.q.cat]={w:0,sum:0,n:0});c.w+=r.answer.w;c.sum+=r.answer.w*r.agree;c.n++;}
  for(const c of Object.values(byCat))c.score=Math.round(100*c.sum/c.w);
  return {score,rows,nChosen:rows.length,nCov:cov.length,totW,covW,byCat,need};
}

// The reviewed profiles' earlier evidence, by the issue it was coded to (research.json issues), carried over to the
// question that takes over that issue: [question, the question's side for the issue's side A]. Statements, state
// votes and official acts carry over; congressional votes and bills do too, but only for someone with no record in the
// bill index, since the question record already holds everyone else's. Two issues have no single question
// (marriage and contraception rights together; infrastructure and industrial investment), so they don't carry over.
export const LEGACY_ISSUES={health:['affordable-care-act',0],taxes:['tax-the-rich',0],immigration:['border-security',0],
  abortion:['abortion',1],guns:['gun-purchase-limits',0],climate:['climate-regulations',0],tariffs:['tariffs',0],
  ukraine:['ukraine-aid',0],warpowers:['war-powers',0],jan6:['reject-electoral-votes',1],labor:['union-rights',0],
  voting:['voter-id',0],vouchers:['school-vouchers',0],ethics:['congress-stock-trading',1]};
const LEGACY_KIND={state_vote:'state',official_act:'act',vote:'vote',senate_vote:'vote',house_vote:'vote',sponsored:'s',cosponsored:'c'};
export function legacyEvidence(evidence,{hasRecord=false}={}){
  const out={};
  for(const [issue,list] of Object.entries(evidence||{})){
    const m=LEGACY_ISSUES[issue];if(!m)continue;const [qid,sideA]=m,q=out[qid]||(out[qid]={items:[],statements:[]});
    for(const e of list||[]){
      if(e.side!=='A'&&e.side!=='B')continue;const side=e.side==='A'?sideA:1-sideA;
      if(e.type==='stated'){q.statements.push({side,date:e.date||null,title:e.title,why:e.why,src:e.src||null,ref:e.ref||null});continue;}
      const kind=LEGACY_KIND[e.type];if(!kind)continue;
      if(hasRecord&&['vote','s','c'].includes(kind))continue;
      q.items.push({ref:`legacy:${issue}:${e.ref||e.title}`,kind,date:e.date||null,side,title:e.title,why:e.why,src:e.src||null,pos:e.pos||null});
    }
  }
  return out;
}
// What they said, tagged to the questions (public/question-statements.json: {question: [[side, date, quote, link,
// where]]}), as statements: [{side, date, title, why, src}].
export function taggedStatements(said){
  const out={};
  for(const [qid,list] of Object.entries(said||{}))out[qid]=(list||[]).filter(x=>x?.[0]===0||x?.[0]===1).map(([side,date,quote,url,where])=>({side,date:date||null,
    title:where||'Statement',why:`"${String(quote).replace(/^[\s"“”]+|[\s"“”]+$/g,'')}"`,src:url?{u:url,t:/^Campaign website/.test(where||'')?'The saved campaign page':/post/i.test(where||'')?'The post':'Source'}:null,tagged:true}));
  return out;
}
// One person's stance on every question: their row in public/question-stances.json (rec: {question: [a, b, firstA,
// lastA, firstB, lastB]}), their carried-over evidence, what they said (said: their rows in
// public/question-statements.json; statements fall under the contradiction rule) and the group ratings on each question
// (ratings: their rows in public/group-ratings.json; questions: public/questions.json's list). A carried-over statement
// with the same link as a tagged one on the question counts once.
export function personStances(rec,evidence,{ratings=null,questions=null,said=null}={}){
  const legacy=legacyEvidence(evidence,{hasRecord:!!rec}),rated=ratingItems(ratings,questions),tagged=taggedStatements(said),out={};
  for(const qid of new Set([...Object.keys(rec||{}),...Object.keys(legacy),...Object.keys(rated),...Object.keys(tagged)])){
    const r=rec?.[qid],L0=legacy[qid]||{items:[],statements:[]},T=tagged[qid]||[],links=new Set(T.map(x=>x.src?.u).filter(Boolean));
    const L={items:L0.items,statements:[...T,...L0.statements.filter(x=>!x.src?.u||!links.has(x.src.u))]};
    const base=r?{a:r[0],b:r[1],firstA:r[2]||'',lastA:r[3]||'',firstB:r[4]||'',lastB:r[5]||''}:{a:0,b:0,firstA:'',lastA:'',firstB:'',lastB:''};
    const lp=recordPoints(L.items),dates={firstA:[base.firstA,lp.firstA].filter(Boolean).sort()[0]||'',lastA:[base.lastA,lp.lastA].filter(Boolean).sort().at(-1)||'',
      firstB:[base.firstB,lp.firstB].filter(Boolean).sort()[0]||'',lastB:[base.lastB,lp.lastB].filter(Boolean).sort().at(-1)||''};
    const st=applyStatements(L.statements,dates),R=rated[qid]||[];
    const ra=R.filter(x=>x.side===0).reduce((t,x)=>t+x.pts,0),rb=R.filter(x=>x.side===1).reduce((t,x)=>t+x.pts,0);
    const a=Math.round((base.a+lp.a+st.a+ra)*10)/10,b=Math.round((base.b+lp.b+st.b+rb)*10)/10;
    out[qid]={...stanceOf(a,b),record:{a:base.a,b:base.b},carried:{items:creditItems(L.items),points:{a:lp.a,b:lp.b}},statements:st.rows,
      ratings:R,ratingPoints:{a:Math.round(ra*10)/10,b:Math.round(rb*10)/10},dates};
  }
  return out;
}

// ---------- Showing the record items ----------
const TYPE_LABEL={hr:'H.R.',s:'S.',hjres:'H.J.Res.',sjres:'S.J.Res.',hres:'H.Res.',sres:'S.Res.',hconres:'H.Con.Res.',sconres:'S.Con.Res.',hamdt:'H.Amdt.',samdt:'S.Amdt.'};
const TYPE_PATH={hr:'house-bill',s:'senate-bill',hjres:'house-joint-resolution',sjres:'senate-joint-resolution',hres:'house-resolution',sres:'senate-resolution',hconres:'house-concurrent-resolution',sconres:'senate-concurrent-resolution',hamdt:'house-amendment',samdt:'senate-amendment'};
const KIND_LABEL={s:'Sponsored',c:'Cosponsored',y:'Voted Yea',n:'Voted Nay',vote:'Voted',state:'State vote',act:'Official act'};
// "H117-123" -> Voteview's page for that roll call.
export const rollUrl=k=>{const m=/^([HS])(\d+)-(\d+)$/.exec(String(k||''));return m?`https://voteview.com/rollcall/R${m[1]}${m[2]}${m[3].padStart(4,'0')}`:null;};
// A bill or amendment id -> its label and Congress.gov page; "vote:H117-9" -> the roll call.
export function billLink(id){
  const v=/^vote:(.+)$/.exec(id);if(v)return {label:`Roll call ${v[1]}`,url:rollUrl(v[1])};
  const [c,t,n]=String(id).split('-');if(!TYPE_PATH[t])return {label:id,url:null};
  return {label:`${TYPE_LABEL[t]} ${n} (${c}th Congress)`,url:`https://www.congress.gov/${/amdt$/.test(t)?'amendment':'bill'}/${c}th-congress/${TYPE_PATH[t]}/${n}`};
}
// One person's items on one question ([[ref, kind, date, side]], public/question-evidence), with what each bill is
// (metaQ: {bill: [side, why, title]}, public/question-meta.json) and which item gets the bill's one credit.
export function recordRows(items,metaQ={}){
  const list=(items||[]).map(([ref,kind,date,side])=>({ref,kind,date,side})),credited=new Set(creditItems(list).map(x=>x.ref));
  return list.map(x=>{const bill=billOf(x.ref),m=metaQ[bill]||[],roll=String(x.ref).split('#')[1]||null,link=billLink(bill);
    return {...x,bill,credited:credited.has(x.ref),pts:credited.has(x.ref)?QPOINTS[x.kind]||0:0,what:KIND_LABEL[x.kind]||x.kind,
      billSide:m[0]??null,why:m[1]||null,title:m[2]||link.label,label:link.label,url:link.url,rollUrl:roll?rollUrl(roll):null};});
}
