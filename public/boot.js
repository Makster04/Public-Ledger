import {RecordLive} from './live.js';
window.RecordLive=RecordLive;
try {
  const history=fetch('/funder-history.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const portraits=fetch('/portraits/index.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const committees=fetch('/committees.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const sectors=fetch('/committee-sectors.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const scoreLog=fetch('/score-log.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const integrityLog=fetch('/integrity-preview-log.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const presentationLog=fetch('/score-presentation-log.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const senate=fetch('/senate.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const house=fetch('/house.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const elect=fetch('/members-elect.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const execTrades=fetch('/exec-trades.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const voteParty=fetch('/vote-party.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const attendance=fetch('/attendance.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const getItDone=fetch('/get-it-done.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const conflicts=fetch('/conflicts.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const groupRatings=fetch('/group-ratings.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  // The alignment questions and everyone's points on them (scripts/build-question-record.mjs), for the Ideology lean,
  // the compass and Your match.
  const questions=fetch('/questions.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const questionStances=fetch('/question-stances.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  // What the reviewed profiles said, tagged to the questions (scripts/question-statements.mjs).
  const questionStatements=fetch('/question-statements.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  // Each profile's promises to voters and whether they kept them (scripts/build-promises.mjs), for Keeps Their Word.
  const promises=fetch('/promises.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const corporatePacs=fetch('/corporate-pacs.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  // Each member's tracker money over the last three cycles, for the Tiers page's "Last 6 years" (scripts/build-corporate-pacs.mjs).
  const trackerHistory=fetch('/tracker-history.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  // The trackers' super PACs in this cycle's races, primaries and generals (scripts/build-super-pac-races.mjs).
  const superPacRaces=fetch('/super-pac-races.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  // The site's news for the ticker and the Latest updates page (scripts/build-news.mjs).
  const news=fetch('/news.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
  const response=await fetch('/research.json',{cache:'no-cache'});
  if(!response.ok)throw new Error('Research file unavailable');
  window.DATA=await response.json();
  window.FUNDHIST=await history;
  window.PORTRAITS=(await portraits)?.people||{};
  window.COMMITTEES=(await committees)||{committees:{},people:{}};
  window.COMMITTEE_SECTORS=(await sectors)?.committees||{};
  window.SCORELOG=(await scoreLog)?.entries||[];
  window.INTEGRITYLOG=(await integrityLog)?.entries||[];
  window.SCOREMIGRATIONS=(await presentationLog)?.entries||[];
  window.EXEC_TRADES=await execTrades;
  window.VOTE_PARTY=(await voteParty)?.votes||null;
  window.ATTENDANCE=await attendance;
  window.GET_IT_DONE=await getItDone;
  window.CONFLICTS=await conflicts;
  window.GROUP_RATINGS=await groupRatings;
  window.CORP_PACS=await corporatePacs;
  window.TRACKER_HISTORY=await trackerHistory;
  window.SUPER_PAC_RACES=await superPacRaces;
  window.NEWS=await news;
  window.QUESTIONS=(await questions)||{questions:[],categories:[]};
  window.QSTANCES=(await questionStances)||{people:{},coded:{}};
  window.QSTATEMENTS=(await questionStatements)||{people:{}};
  window.PROMISES=(await promises)||{people:{}};
  for(const p of [...(DATA.members||[]),...(DATA.cands||[]),...(DATA.featured||[])])p.promises=window.PROMISES.people?.[p.id]||[];
  const sen=await senate;window.SENATE=sen?.senators||[];window.SENATE_INFO=sen?{checked:sen.checked,source:sen.source,congress:sen.congress}:null;
  const hs=await house;window.HOUSE=hs?.members||[];window.HOUSE_INFO=hs?{checked:hs.checked,source:hs.source,congress:hs.congress}:null;
  // The House members-elect without a profile, and the races they won (public/members-elect.json, npm run house:elect).
  const el=await elect;window.MEMBERS_ELECT=el?.members||[];window.ELECT_RACES=el?.races||[];window.ELECT_INFO=el?{built:el.built,source:el.source}:null;
  await import('./app.js');
  // The ticker under the top bar (public/ticker.js): race calls, grade changes, promise checks, the trackers' money, FEC
  // reports, site updates, and the refresh's newest trades and disclosures. A person is named from the profiles and both
  // chambers' directories.
  import('./ticker.js').then(({mountTicker,pagePeople})=>{
    mountTicker(document.getElementById('ticker'),{research:window.DATA,log:window.SCOREMIGRATIONS,ratings:window.GROUP_RATINGS,news:window.NEWS,people:pagePeople(window)});
  }).catch(()=>{});
  await RecordLive.banner();
  window.addEventListener('hashchange',()=>RecordLive.banner());
  setInterval(()=>RecordLive.banner(),60000);
}catch(error){
  document.querySelector('#app').textContent='The saved research could not be loaded. Start the local server and reopen this page.';
  console.error(error);
}
