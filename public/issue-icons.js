// The emoji for each issue category (the alignment questions' categories, public/questions.json), shown at the start of
// a sentence about that issue: each question, each promise and each reviewed check (approved 2026-11-13). Shown only.
export const ISSUE_ICON={technology:'💻','national-security':'🛡️',social:'👥',governance:'🏛️',environmental:'🌱',
  economic:'📈',domestic:'🇺🇸',healthcare:'🏥',infrastructure:'🏗️',education:'🎓',electoral:'🗳️',criminal:'⚖️',
  foreign:'🌎',immigration:'🛂',transportation:'🚆',science:'🔬',housing:'🏠'};

// A reviewed check has a free-text topic ("Medical debt relief"), not a category, so its category comes from the first
// rule its topic matches. The rules follow where the alignment questions put the same subject: guns, Social Security and
// congressional stock trading are Domestic Policy, right to repair is Technology, property taxes and homelessness are
// Housing. A topic no rule matches gets no emoji.
const TOPIC_RULES=[
  ['immigration',/immigra|border|deport|laken riley|driver'?s licen/i],
  ['healthcare',/medicaid|medicare|health|\baca\b|medical|prescription|\bhhs\b|kennedy jr/i],
  ['education',/school|educat|universit|classroom|k-12|voucher/i],
  ['electoral',/election|\bvot(e|er|ing)\b|redistrict|quorum|campaign|\bpacs?\b|citizens united|dark money|debates|outspent|withdraw|running for|party affiliation|party independence|candidacy|political outsider|fundrais/i],
  ['domestic',/stock|social security|\bguns?\b|firearm|open carry|term limit|supreme court|flag|cannabis|marijuana|decriminal/i],
  ['criminal',/police|policing|criminal|death penalty|crime|prosecut|fraud case|securities-fraud|methamphetamine|murdered|back the blue|justice department/i],
  ['foreign',/iran|ukraine|israel|gaza|china|chinese|foreign|nato/i],
  ['national-security',/defense|military|surveillance|\bnsa\b|\bwar\b/i],
  ['environmental',/climate|pollution|environment|coal|drilling|energy|fossil|electric|heating|house bill 6/i],
  ['technology',/\bai\b|chatbot|data center|repair|internet|social media/i],
  ['housing',/housing|homeless|\brent\b|property tax|mortgage/i],
  ['transportation',/\brail|transit|highway|transport|airport/i],
  ['infrastructure',/infrastructure|permitting|bridge|broadband|water/i],
  ['science',/science|research|vaccine|space|nasa/i],
  ['economic',/tax|tariff|trade|budget|deficit|debt|spending|wage|worker|bank|auto|farm|\bsalt\b|big beautiful|seafood|econom|poverty|income|costs?\b/i],
  ['governance',/ethic|scandal|gift|gaming board|shutdown|impeach|disclosure|leadership|infighting|bipartisan|working across|power of the purse|fraud|congress/i],
  ['social',/abortion|dobbs|lgbtq|transgender|church|religio|indigenous/i]];
export function topicCategory(topic){
  const t=String(topic||'');
  for(const [cat,re] of TOPIC_RULES)if(re.test(t))return cat;
  return null;
}
