// Saved consistency assessments only: rendering never initiates classification.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number.isFinite(value)&&value>=0?value:0;
const pct=value=>Number.isFinite(value)&&value>=0&&value<=100?`${Math.round(value*10)/10}%`:null;
const LABELS={consistent:['✓','Consistent','consistent'],inconsistent:['✕','Inconsistent','inconsistent'],not_relevant:['—','Not relevant','irrelevant']};
const TEMPORAL={before:'Before statement',after:'After statement',same_day:'Same day · order within the day unknown',unknown:'Date relationship unknown'};
const SCOPES={position:'Policy position · compares dated actions before and after the statement',forward_commitment:'Forward commitment · earlier actions provide context only',retrospective:'Retrospective statement · later actions provide context only'};
const REASONS={missing_source:'Original source needed',missing_date:'Date needed',unknown_date:'Date relationship unknown',low_confidence:'Low model confidence',low_margin:'Competing classifications have similar probabilities',vague_statement:'Statement is too vague for a reliable assessment',insufficient_context:'More substantive context needed',before_statement:'Action predates the statement',provider_unconfigured:'Awaiting evaluation'};
const reason=value=>REASONS[value]||String(value||'').replace(/_/g,' ');
function sources(items){
  return (Array.isArray(items)?items:[]).flatMap(s=>{let url;try{url=new URL(s.url||s.u);}catch{return [];}
    return ['https:','http:'].includes(url.protocol)?[`<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.t||'Original source')} ↗</a>`]:[];}).join(' · ');
}
function classification(result){
  if(result.status!=='complete'||result.review_status!=='resolved')return ['?','Needs review','unresolved'];
  return LABELS[result.classification]||['?','Needs review','unresolved'];
}
function actionHtml(result,scope='position'){
  const action=result.action||{},[icon,label,cls]=classification(result),probabilities=result.probabilities||{},refs=sources(action.sources);
  const probabilityRows=Object.entries(LABELS).map(([key,[,name]])=>`<tr><th scope="row">${name}</th><td>${Number.isFinite(probabilities[key])&&probabilities[key]>=0&&probabilities[key]<=1?pct(probabilities[key]*100):'Not available'}</td></tr>`).join('');
  const reasons=Array.isArray(result.review_reasons)?result.review_reasons:[];
  const outsideScope=(scope==='forward_commitment'&&result.temporal_relation==='before')||(scope==='retrospective'&&result.temporal_relation==='after');
  return `<li class="consistency-action"><div class="consistency-action-head"><span class="consistency-label ${cls}">${icon} ${label}</span><span>${esc(action.date||'Date not recorded')} · ${esc(TEMPORAL[result.temporal_relation]||TEMPORAL.unknown)}</span></div>
    <p>${esc(action.text||action.description||action.title||'Action description not available')}</p>
    ${action.role||action.kind||action.position?`<p class="consistency-meta">Recorded role: ${esc(action.role||action.kind||'Not recorded')}${action.position?' · Position: <strong>'+esc(action.position)+'</strong>':''}</p>`:''}
    <p class="consistency-meta">${refs||'Original source not recorded'}</p>
    ${result.included_in_percentage===false?`<p class="consistency-meta">${outsideScope?'Outside the statement’s time scope · context only.':'Excluded from the consistency percentage.'}</p>`:''}
    <details class="consistency-detail"><summary>Classification and uncertainty</summary>
      ${result.classification&&result.review_status!=='resolved'?`<p>Provisional classification: ${esc(LABELS[result.classification]?.[1]||result.classification)}. Excluded from the percentage while unresolved.</p>`:''}
      ${reasons.length?`<p>Review needed: ${reasons.map(x=>esc(reason(x))).join('; ')}.</p>`:''}
      <table class="consistency-probabilities"><caption>Model category probabilities</caption><tbody>${probabilityRows}</tbody></table>
      <p class="consistency-meta">Model confidence: ${Number.isFinite(result.confidence)?pct(result.confidence*100)||'Not available':'Not available'}. Confidence is not a measure of verified accuracy.</p>
      <dl class="consistency-provenance"><dt>Action ID</dt><dd>${esc(action.id||'Not recorded')}</dd><dt>Model</dt><dd>${esc(result.model||'Not evaluated')}${result.model_version?' · '+esc(result.model_version):''}</dd><dt>Rubric</dt><dd>${esc(result.rubric_version||'Not recorded')}</dd><dt>Evaluated</dt><dd>${esc(result.classified_at||'Not yet evaluated')}</dd>${result.input_fingerprint?`<dt>Input fingerprint</dt><dd>${esc(result.input_fingerprint)}</dd>`:''}</dl>
    </details></li>`;
}
export function renderStatementConsistency(report){
  const statement=report.statement||{},c=report.counts||{},coverage=report.coverage||{},score=pct(report.percentage),actions=Array.isArray(report.actions)?report.actions:[],refs=sources(statement.sources);
  return `<article class="consistency-statement"><div class="consistency-statement-head"><h4>${esc(statement.title||statement.topic||'Recorded statement')}</h4><strong class="consistency-score">${score||'Insufficient evidence'}</strong></div>
    <blockquote>${esc(statement.text||'Statement text not available')}</blockquote>
    <p class="consistency-meta">${esc(statement.date||'Date not recorded')}${refs?' · '+refs:' · Original source not recorded'}</p>
    <p class="consistency-meta">Time scope: ${esc(SCOPES[statement.temporal_scope||'position']||'Not recorded')}</p>
    <ul class="consistency-counts" aria-label="Assessment counts"><li>✓ ${number(c.consistent)} consistent</li><li>✕ ${number(c.inconsistent)} inconsistent</li><li>— ${number(c.not_relevant)} not relevant</li><li>? ${number(c.review)} need review</li>${number(c.context_only)?`<li>↶ ${number(c.context_only)} outside time scope · context only</li>`:''}</ul>
    <p>${esc(report.narrative||'There is not enough resolved evidence to calculate a consistency percentage.')}</p>
    <p class="consistency-meta">${number(coverage.evaluated_count)} of ${number(coverage.candidate_count)} selected action candidates evaluated; ${number(coverage.resolved_relevant_count)} resolved, relevant actions count toward the percentage.${Number.isFinite(coverage.resolved_relevant_fraction)?` Resolved relevant coverage: ${pct(coverage.resolved_relevant_fraction*100)||'Not available'} of selected candidates.`:''}</p>
    ${coverage.retrieval_truncated?`<p class="consistency-meta">Candidate selection limit reached: ${number(coverage.candidate_count)} of ${number(coverage.candidate_pool_count)} possible related actions were selected. Additional candidates have not been evaluated.</p>`:''}
    <details class="consistency-detail"><summary>Inspect related actions (${actions.length})</summary>${actions.length?`<ol class="consistency-actions">${actions.map(result=>actionHtml(result,statement.temporal_scope||'position')).join('')}</ol>`:'<p>No related action candidates were found in the available records.</p>'}</details>
  </article>`;
}

export function renderConsistency(data){
  const reports=data?.person?.statements;
  const intro='<header><p class="page-eyebrow">STATEMENT–ACTION CONSISTENCY</p><h3>How recorded actions relate to each statement</h3><p>Percentages measure agreement among relevant, resolved actions evaluated here—not every action this politician has taken. Each statement’s time scope determines whether earlier or later actions count.</p></header>';
  if(!Array.isArray(reports)||!reports.length)return `${intro}<p class="consistency-empty">No saved consistency assessments are available for this profile yet.</p>`;
  const method=data.methodology||{};
  return `${intro}<details class="consistency-method"><summary>How this percentage is calculated</summary><p>Consistent ÷ (consistent + inconsistent) × 100. Unresolved and irrelevant actions are excluded. At least ${number(method.min_resolved)||1} resolved relevant action${(number(method.min_resolved)||1)===1?' is':'s are'} required. Topic matches only select possible evidence; they do not establish relevance.</p><p>The assessments below are separate from the reviewed Promises Delivered grade.</p><p class="consistency-meta">Methodology: ${esc(method.version||'Not recorded')} · Rubric: ${esc(method.rubric_version||'Not recorded')} · Report saved: ${esc(data.generated_at||'Not recorded')}</p></details>${reports.map(renderStatementConsistency).join('')}`;
}

export async function loadConsistency(profileId,fetcher=fetch){
  let response;
  try{response=await fetcher('/api/consistency?id='+encodeURIComponent(profileId),{headers:{Accept:'application/json'}});
    if(response.ok){const data=await response.json();if(data?.schema_version===1&&Object.hasOwn(data,'person'))return data;}
  }catch{/* Static deployments do not expose the API. */}
  response=await fetcher('/consistency.json',{headers:{Accept:'application/json'}});
  if(response.status===404)return {schema_version:1,available:false,person:null};
  if(!response.ok)throw new Error('Saved report unavailable');
  const data=await response.json();
  if(data?.schema_version!==1||!data.people)throw new Error('Invalid saved report');
  return {schema_version:1,generated_at:data.generated_at,methodology:data.methodology,person:Object.hasOwn(data.people,profileId)?data.people[profileId]:null};
}
export async function mountConsistency(host,profileId,fetcher=fetch){
  if(!host)return;
  const token=Symbol();host.__consistencyToken=token;host.setAttribute('aria-busy','true');
  host.innerHTML='<p class="consistency-empty" role="status">Loading saved statement–action assessments…</p>';
  try{const data=await loadConsistency(profileId,fetcher);if(!host.isConnected||host.__consistencyToken!==token)return;host.innerHTML=renderConsistency(data);}
  catch{if(host.isConnected&&host.__consistencyToken===token)host.innerHTML='<h3>Statement–action consistency</h3><p class="consistency-empty" role="status">The saved assessments could not be loaded. Try opening this tab again.</p>';}
  finally{if(host.__consistencyToken===token)host.removeAttribute('aria-busy');}
}
