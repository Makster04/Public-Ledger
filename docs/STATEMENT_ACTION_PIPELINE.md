# Statement–action consistency pipeline

This feature evaluates agreement between a dated statement and selected, sourced actions by the same politician. It is a separate evidence report in Accountability → Promises & quotes. It does not replace the reviewed Promises Delivered grade or modify Ethics or Workers > Profit.

## Architecture and data model

The existing Node/Cloudflare application reads `public/research.json` and SQLite/D1 source-refresh records. Statements are nested under each person's `statements` (`said`, `did`, citations); actions also occur in `evidence`, roll calls, sponsorships and executive records. Existing `assessment` and `note` fields are reviewed verdicts, not model labels or classification evidence.

The new offline Python worker has separate modules:

| File | Responsibility |
|---|---|
| `scripts/consistency/records.py` | Canonical IDs, source normalization, action/event deduplication |
| `scripts/consistency/retrieval.py` | Candidate retrieval and temporal/evidence checks |
| `scripts/consistency/provider.py` | Documented-provider adapter, rubric, uncertainty, retries, usage |
| `scripts/consistency/storage.py` and `schema.sql` | Durable queue, leases and classification history |
| `scripts/consistency/aggregate.py` | Deterministic unweighted arithmetic and narrative |
| `scripts/consistency/cli.py` | Incremental preparation, bounded background execution, atomic export |
| `scripts/consistency/evaluate.py` | Reference-label comparison and disagreement report |
| `src/consistency.mjs` | Read-only saved-report endpoint |
| `public/consistency.js` and `.css` | Accessible expandable evidence panel |

Politicians use Bioguide IDs, then FEC candidate IDs, then an explicit local profile ID, with names used only for display. Stable statement identities derive from canonical person, statement text/date/source (or an explicit record ID). Actions use event identities including official roll calls. Distinct votes on the same bill remain distinct events. Source corrections change input fingerprints and cause new classifications while old results remain available for audit. Changing a position creates a separate dated statement; earlier statements are not overwritten.

Initial input is the saved research, including previously linked `did` records and additional recorded actions. The normalized `--records` extension accepts additional sourced statements/actions from another processing stage under known canonical person IDs. Raw source-refresh news/headline leads are not automatically treated as substantive political actions. They require attribution and source-backed normalization before entering that extension.

## Methodology v1

- Candidate retrieval uses existing statement/action links, bill identifiers, topic codes and shared keywords. Default maximum: 20 candidates per statement. Reports disclose the candidate pool, selected count and truncation. Topic overlap does not determine classification.
- Missing sources, missing/uncertain dates, vague statements and absent substantive descriptions require review before a provider request. A bill's title alone never supplies its effects.
- The model selects `consistent`, `inconsistent` or `not_relevant`, with all three probabilities. Each record preserves model/version, rubric/version, input hash, timestamps, sources and status.
- Default confidence threshold: 0.80; minimum lead over the next category: 0.20. Both are configurable and included in fingerprints. A low-confidence `not_relevant` answer remains unresolved.
- Each statement has an explicit time scope: `position` (default) includes dated earlier and later actions as agreement; `forward_commitment` excludes earlier actions; `retrospective` excludes later actions. Existing `promise: true` records default to forward commitments, with an explicit scope override supported. Excluded actions remain visible as context. Same-day actions are included but labeled as having unknown within-day order. Unknown dates require review. Review the assigned scope, especially retrospective claims currently tagged as promises. Agreement is not proof the statement caused an action.
- Percentage = `100 × consistent / (consistent + inconsistent)`, using only resolved relevant actions. No subjective importance weights. Default minimum: one resolved relevant action, with the denominator visible; use `--min-resolved` to require more. Zero resolved relevant actions means **Insufficient evidence**, never 0% or 100%.
- Relevant evidence coverage means resolved relevant actions divided by selected candidates. It is not measured recall over every action the politician ever took.
- Summaries are deterministic Python text based on stored counts. No narrative LLM is used, and no generated text is presented as the classifier's reasoning.
- Category scores returned by the model are uncalibrated model estimates. They are used only for review thresholds and are not empirical probabilities or measures of accuracy.

These are explicit initial implementation choices. Different temporal treatment, candidate limits, thresholds or minimum counts should be versioned and evaluated before publication.

## Database changes and auditability

The worker creates `.local/consistency.sqlite`, separate from the existing source database. Schema version 2 automatically migrates version 1, adding a persistent provider retry deadline. Its schema contains `consistency_meta`, `consistency_jobs` and `consistency_results`. No existing research fields or source tables are rewritten, and no D1 migration is required for the read-only public report.

Jobs have unique pair/fingerprint keys, atomic leases and durable statuses. Completed results are reused. Only fingerprints matching current inputs/configuration can be claimed. Changed evidence, model contract, rubric or policy creates a new job and preserves previous results. Error retries require `--retry-errors` and still respect saved provider Retry-After deadlines. A worker interrupted after claiming a job can be resumed after its lease expires; if the provider processed a request before a crash, a repeated request remains possible unless that provider supports its own idempotency keys.

`Store.history(pair_key)` provides the local audit history. Public reports expose current classifications and provenance, not secrets or raw provider error bodies. Unknown token/cost amounts remain unknown rather than being reported as zero.

## OpenAI Responses API configuration

The earlier `JEV` names were placeholders, not a provider selection. The implementation now uses the OpenAI Responses API at `https://api.openai.com/v1/responses`, with `Authorization: Bearer …` authentication and Structured Outputs. The non-secret, reviewed configuration is `data/consistency/openai-responses.json`. It records official documentation URLs, model ID/version `gpt-6-luna`, reasoning effort `none`, a 256-token output limit, `store: false`, and the explicit `uncalibrated_model_estimates` probability semantics. The configured model documentation lists Responses and Structured Outputs as supported. The runtime also stores the actual model identifier returned by each response.

The request builder sends the statement/action pair as data, the fixed classification rubric as instructions, and a strict JSON schema requiring one of the three labels plus one numeric score for each label. The parser handles refusal and incomplete states before looking for output, then validates the label, all values, their range, sum and selected-label maximum. Any refusal, incomplete response, HTTP/authentication error, timeout or malformed output is stored without a fabricated classification. OpenAI request IDs and token usage are recorded when returned; API cost is left unknown unless a future documented response supplies it.

The manifest validator now requires an explicit `auth_prefix` and checks `Authorization` plus `Bearer ` for this provider, resolving the previous guide/validator mismatch. It pins the endpoint to the documented OpenAI host and URL so the secret cannot be sent to a manifest-supplied host. No key is stored in the config or public artifact.

### Credential setup

1. Create an OpenAI API project key from the [API Keys page](https://platform.openai.com/api-keys). API access and model availability depend on the API project and account limits.
2. Copy `.dev.vars.example` to the ignored local `.dev.vars` file if needed, and set `OPENAI_API_KEY=…`. Alternatively export `OPENAI_API_KEY` only in the server-side worker shell. Do not paste the key into chat, source control, the configuration file, or browser code.
3. Run `npm run consistency:prepare` to refresh the queue without network calls, then `npm run consistency:run -- --limit 20` to classify at most 20 eligible pairs. The reviewed config is selected by default; `--openai-config PATH` is available for explicit testing. `npm run consistency:export` republishes saved results. `npm start` does not run classifications.

The default worker makes individual requests, not provider batch jobs. It uses bounded retries for transient network/server errors, honors `Retry-After`, records deferrals, and never retries authentication failures automatically. Run it from a Python-capable environment with access to `api.openai.com`; the Cloudflare Worker only serves the saved report. TLS certificate verification is always enabled. If the Python distribution has no default CA bundle, install the optional `certifi` package with `python3 -m pip install certifi`; the adapter uses it when available and otherwise falls back to Python's configured CA roots. GPT-6 Luna is the documented cost-sensitive, high-volume option selected for this workload. Its API model availability still depends on the user's API project and limits.

## Running the pipeline

Python 3.10+ and the project's Node version are required. The classifier uses Python's standard library; `certifi` is optional for installations without a system CA bundle. No optional LLM is used.

```sh
npm run consistency:prepare
npm run consistency:status
npm run consistency:run -- --limit 20
npm run consistency:run -- --limit 20 --retry-errors
npm run consistency:export
```

Preparation builds the queue and exports honest unresolved reports without a key. `run` requires the checked-in reviewed OpenAI configuration and server key. `--openai-config`, `--research`, `--database`, `--output`, `--records`, `--candidates`, `--min-resolved`, `--confidence` and `--margin` are available for reproducible runs.

For a background service:

```sh
npm run consistency:run -- --watch 300 --limit 20
```

Each cycle reloads the inputs, adds changed/new pairs, resumes saved jobs, and atomically writes `public/consistency.json`. Public page loads only read that artifact through `/api/consistency?id=PROFILE_ID`, with a static-host fallback. They never invoke Python or OpenAI. Run the worker under a process supervisor or scheduler for production. Cloudflare Workers cannot run this standard-library Python process; run classification in a separate Python-capable job and publish the resulting artifact with the site. The existing Cloudflare source-refresh cron does not classify statements automatically.

## Validation and evaluation

```sh
npm run test:consistency
node --test test/consistency-ui.test.mjs
npm run check
npm test
npm run consistency:evaluate
npm run consistency:evaluate -- --results /path/to/model-results.json --output /path/to/evaluation.json
```

The evaluation fixture includes sourced legacy record comparisons across parties and explicitly synthetic boundary cases. Labels preserve their provenance, and **none is represented as independently human-adjudicated**. A human reviewer must adjudicate them before treating this as a human benchmark. Without model outputs, evaluation reports unavailable accuracy rather than inventing results. With outputs it reports confusion matrices, disagreements, review outcomes, errors, party slices and high-confidence agreement separately.

Remaining production validation: configure the user's OpenAI API credential, collect model outputs, obtain independent human reference labels, evaluate both candidate recall and classification errors, calibrate model-score thresholds, inspect source fidelity and generated summaries, and decide how incremental reports will be published on the hosted deployment. Provider contract and model selection are recorded, but account-specific model access has not been verified. This implementation does not establish model accuracy or political completeness.

## Validation snapshot

Implementation validation on November 2, 2026: 48 Python tests passed; saved-report frontend/API tests, syntax checks and the Cloudflare worker build passed. Desktop and 390px mobile browser checks found no page errors or horizontal overflow; the saved-report API returned HTTP 200. The previous bundled-gifts assertion was corrected to accept the source amount's cents; the current JavaScript test suite passes.

Preparation produced 144 statement reports across 59 profiles with statements and selected 494 candidate pairs. The normalizer covers 60 research profiles and 1,027 actions. No live OpenAI calls have been made and no accuracy score is claimed. Reports intentionally show insufficient/unresolved evidence pending credential setup and human evaluation. Model-reported category scores are explicitly labeled uncalibrated estimates. The local queue may also retain pending jobs for older fingerprints; workers only claim the current input/configuration fingerprints.
