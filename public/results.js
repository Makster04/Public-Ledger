// Results of the November 3, 2026 general election: public/research.json "election" (the date and when the results were
// last checked) and a "result" on each race and toss-up race. A result names the winner (a person ID in a profiled race,
// an FEC candidate ID in a toss-up race), how the race was decided ("how": a news organization's call, or the loser's
// concession) and a source. A race that no news organization has called and nobody has conceded has no winner: it can
// name who is leading, but nobody is marked as having won or lost. All of it is unofficial until each state certifies.
//   {"winner":"ossoff","how":"Called by NBC News and CBS News","src":{"t":"…","u":"https://…"}}
//   {"winner":null,"leader":"peltola","how":"Mary Peltola led by 626 votes …","src":{…}}
// "special": a special election, whose winner takes the seat once the state certifies the result, not on Jan. 3.

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
