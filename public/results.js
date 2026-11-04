// Results of the November 3, 2026 general election: public/research.json "election" (the date and when the results were
// last checked) and a "result" on each race and toss-up race. A result names the winner (a person ID in a profiled race,
// an FEC candidate ID in a toss-up race), how the race was decided ("how": a news organization's call, or the loser's
// concession) and a source. A race that no news organization has called and nobody has conceded has no winner: it can
// name who is leading, but nobody is marked as having won or lost. All of it is unofficial until each state certifies.
//   {"winner":"ossoff","how":"Called by NBC News and CBS News","src":{"t":"…","u":"https://…"}}
//   {"winner":null,"leader":"peltola","how":"Mary Peltola led by 626 votes …","src":{…}}
// "special": a special election, whose winner takes the seat once the state certifies the result, not on Jan. 3.
// A results-only race (liteRaces, chamber "S" or "H") lists its nominees; each is known by their FEC candidate ID, or,
// without one, by "id": a sitting senator's directory ID (their basic profile and portrait) or "state-lastname".
export const nomineeKey=n=>n.fecCand||n.id;

export const OUTCOME={
  won:{label:'Won',cls:'good'},
  lost:{label:'Lost',cls:'neutral'},
  pending:{label:'Not called yet',cls:'warn'}};

// A race's result, or null when none is on file.
export function raceResult(race){
  const r=race?.result;if(!r)return null;
  return {decided:!!r.winner,winner:r.winner||null,leader:r.leader||null,how:r.how||'',src:r.src||null,special:!!r.special};
}
// One candidate's outcome: 'won', 'lost', 'pending' (not called yet) or null (no result on file). key: their person ID in
// a profiled race, their FEC candidate ID in a toss-up race.
export function outcomeOf(race,key){
  const r=raceResult(race);if(!r)return null;
  if(!r.decided)return 'pending';
  return r.winner===key?'won':'lost';
}
// What the outcome means for the seat. incumbent: whether this candidate holds the seat; winner: the winner's name.
export function seatNote(race,key,{incumbent=false,winner=''}={}){
  const r=raceResult(race),o=outcomeOf(race,key);
  if(o==='won')return incumbent?'Re-elected':r.special?'Takes the seat once the state certifies the result':'Takes office Jan. 3, 2027';
  if(o==='lost'&&incumbent)return r.special?`Serves until ${winner||'the winner'} is sworn in, after the state certifies the result`:'Serves until Jan. 3, 2027';
  return '';
}
// How many races are decided, and which are not called yet.
export function resultCounts(races){
  const on=races.filter(r=>r.result);
  return {total:races.length,decided:on.filter(r=>r.result.winner).length,pending:on.filter(r=>!r.result.winner),missing:races.length-on.length};
}
// The 2026 line under a name ("Seeking a 6th term", "Challenging Sen. Jon Ossoff") in the past tense once the race is
// decided: "Won a 6th term" or "Sought a 6th term", "Defeated Sen. …" or "Challenged Sen. …". Unchanged until then.
const PAST=[[/^Seeking /,'Won ','Sought '],[/^Running for /,'Won ','Ran for '],[/^Challenging /,'Defeated ','Challenged '],
  [/in the special election$/,'won the special election','lost the special election']];
export function termAfter(term,outcome){
  if(!term||(outcome!=='won'&&outcome!=='lost'))return term;
  for(const [re,won,lost] of PAST)if(re.test(term))return term.replace(re,outcome==='won'?won:lost);
  return term;
}
// The vote count on file for a race (result.tally): each candidate's share, and votes when reported, highest first; the
// other candidates named in the same count; what is left (candidates and write-ins not named, shown from half a point);
// and the votes counted: the source's total, or the sum of every candidate's votes when all were reported and none is
// left unnamed. counted: how much of the vote was in.
export function tallyOf(race){
  const t=race?.result?.tally;if(!t)return null;
  const keys=race.keys||race.nominees.map(nomineeKey);
  // Highest share first; on equal shares (rounded), the one with more votes.
  const rows=keys.map(key=>({key,pct:t.shares?.[key]??null,votes:t.votes?.[key]??null})).sort((a,b)=>(b.pct??-1)-(a.pct??-1)||(b.votes??-1)-(a.votes??-1));
  const others=t.others||[],listed=[...rows,...others];
  const rest=Math.round((100-listed.reduce((a,x)=>a+(x.pct||0),0))*10)/10;
  const summed=t.total==null&&rest<0.5&&listed.every(x=>x.votes!=null);
  // whole: the source gave whole percentages, so they are shown that way; otherwise every share gets one decimal.
  const whole=listed.every(x=>x.pct==null||Number.isInteger(x.pct));
  return {rows,others,rest:rest>=0.5?rest:0,total:t.total??(summed?listed.reduce((a,x)=>a+x.votes,0):null),summed,whole,counted:t.counted||'',src:t.src||null,asof:t.asof||null};
}
// A share as shown: one decimal, or a whole number when the source gave whole percentages.
export const sharePct=(x,whole=false)=>x==null?'—':(whole?Math.round(x):x.toFixed(1))+'%';
// Did the seat change parties? The winner's party against the party that held the seat before the election (race.held:
// the incumbent who ran, or the outgoing member of an open seat, including a redrawn district's current member). Null
// until the race is decided.
export const PARTY_COLOR={D:'Blue',R:'Red',I:'Independent'};
const PARTY_PLURAL={D:'Democrats',R:'Republicans',I:'Independents'};
export function seatChange(race,winnerParty){
  const r=raceResult(race),from=race?.held?.party;
  if(!r?.decided||!from||!winnerParty)return null;
  const flip=winnerParty!==from,to=PARTY_PLURAL[winnerParty]||winnerParty;
  return {flip,from,to:winnerParty,label:flip?'Flip +1':`Remains ${PARTY_COLOR[winnerParty]||winnerParty}`,
    detail:flip?`${to} take the seat from ${PARTY_PLURAL[from]||from}`:`${to} keep the seat`};
}
// The vote count from the state's own county results (public/county-results.json), in tallyOf's shape, when that read is
// at least as recent as the count on file (result.tally): each candidate's share and votes, the other candidates by name
// (from half a point; the rest together), the votes counted and how many precincts or counties had reported. Null
// without county results, or when the count on file is newer.
const SHORT_PARTY=p=>({LIB:'L',GRE:'G',GRN:'G',IND:'I',CON:'C',CST:'C',DEM:'D',REP:'R'})[String(p||'').slice(0,3).toUpperCase()]||'';
export function countyTally(race,c){
  if(!c?.total||!c.counties)return null;
  const t=race?.result?.tally;if(t?.asof&&String(c.fetched||'').slice(0,10)<t.asof)return null;
  const totals={};for(const v of Object.values(c.counties))for(const [k,n] of Object.entries(v))totals[k]=(totals[k]||0)+n;
  const pct=n=>n/c.total*100,keys=race.keys||race.nominees.map(nomineeKey);
  const rows=keys.map(key=>({key,pct:totals[key]?pct(totals[key]):null,votes:totals[key]??null})).sort((a,b)=>(b.pct??-1)-(a.pct??-1)||(b.votes??-1)-(a.votes??-1));
  const named=(c.others||[]).filter(o=>pct(o.votes)>=0.5).slice(0,4).map(o=>({name:o.name,party:SHORT_PARTY(o.party),pct:pct(o.votes),votes:o.votes}));
  const rest=Math.round((pct(totals.other||0)-named.reduce((a,o)=>a+o.pct,0))*10)/10;
  const r=c.reporting,n=x=>x.toLocaleString('en-US');
  const counted=[r?`${n(r.n)} of ${n(r.of)} ${r.unit} reporting`:`${Object.keys(c.counties).length} counties with votes`,'in the state’s own count'].join(', ');
  return {rows,others:named,rest:rest>=0.5?rest:0,total:c.total,summed:false,whole:false,counted,src:c.source,asof:String(c.fetched).slice(0,10),fetched:c.fetched,fromState:true};
}
