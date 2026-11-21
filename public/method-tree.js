// The Methodology page as a tree (Nov. 18, 2026): its sections, grouped into branches. Each branch opens to its topics,
// and each topic to its text. A topic is a section's heading (matched by how it starts), or a special one (starting with
// "@") that app.js builds: the six scores, the trackers, and the parts moved out of other sections. A heading no branch
// names lands under "More", so nothing is dropped; test/method-tree.test.mjs checks that none does.
export const METHOD_TREE=[
  {key:'six',icon:'📊',name:'The six scores',about:'How each grade and the Ideology position is worked out, the grade scale, and the monthly recalculation.',
    topics:['@six','Grades on the home page','Monthly recalculation and change log']},
  {key:'money',icon:'💵',name:'Money',about:'Where every money number comes from: campaign funds, PACs, outside spending, gifts passed on, nonprofits and the trackers.',
    topics:['@trackers','Campaign funds raised','PAC contributions','Outside spending','Super PAC share','Combined view','Money routed through PACs','@outsideMonthly',
      'Money shown beside the grades','Nonprofits\' tax returns','Funders\' own positions','Money and votes side by side']},
  {key:'record',icon:'🗳️',name:'Votes, bills and positions',about:'How votes, bills and statements become positions, and how they\'re checked against each other.',
    topics:['Legislative record','Voting ideology','Key votes marked','Position by issue','Statements vs. actions','Voter alignment','Ethics and compliance','Records for candidates who are not in Congress']},
  {key:'pages',icon:'🧭',name:'The pages',about:'What each page and card shows, and how to read it.',
    topics:['The Overview page','Profile pages','Score pages','Group colors','Portraits']},
  {key:'coverage',icon:'🔎',name:'Who and what is covered',about:'Who is profiled, which races, where records come from and how often, and what is missing.',
    topics:['Who is covered','Competitive races','Election results','What refreshes','Automatic refresh checks','Known gaps','Independence']},
  {key:'glossary',icon:'📖',name:'Glossary',about:'The terms used across the site, in plain words.',topics:['Glossary']},
  {key:'history',icon:'🕘',name:'What changed, and when',about:'Every rule and formula change, the grades that were retired, and the earlier score logs.',
    topics:['What changed in this version','@retiredGrades','Integrity (retired','@oldLogs','@migrations']},
];
// The six scores' own section and the parts moved out of others are built by app.js, never matched as headings.
export const BUILT_SECTIONS=['The six scores'];
// Which branch a section heading belongs to: {branch, at (its place in the branch)}, or null for "More".
export function topicOf(heading){
  const h=String(heading||'').trim();
  for(const b of METHOD_TREE)for(const [at,t] of b.topics.entries())if(!t.startsWith('@')&&h.startsWith(t))return {branch:b.key,at};
  return null;
}
// A topic's one-line summary: the first sentence of its first paragraph or list item, at most 130 characters.
export function blurbOf(text){
  const s=String(text||'').replace(/\s+/g,' ').replace(/^(Definition|What it shows):\s*/,'').trim().split(/(?<=[.!?])\s/)[0]||'';
  return s.length>130?s.slice(0,127).replace(/\s\S*$/,'')+'…':s;
}
