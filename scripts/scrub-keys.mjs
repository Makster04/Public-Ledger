// Strips key-like values from pages saved from other sites (data/ratings-samples/, data/county-samples/, the probe
// reports) before they're written, so a site's own browser key (a Google Maps key, a search widget's token) is never
// committed here. From the Nov. 18, 2026 audit. The page's structure, which the readers are written from, is kept.
//   node scripts/scrub-keys.mjs     scrub the saved pages already on disk
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const R='REDACTED';
// Google keys; then a value of 24+ key characters given to anything named like a key, token or secret (in JSON, JS,
// HTML attributes or a URL); then provider tokens with known prefixes.
const RULES=[
  [/AIza[0-9A-Za-z_-]{35}/g,()=>R],
  [/((?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|client[_-]?secret|secret|token|sitekey|site[_-]?key|key)["']?\s*[:=]\s*["']?)([A-Za-z0-9_\-.]{24,})/gi,(m,a)=>a+R],
  [/([?&](?:api[_-]?key|apikey|key|token|access_token)=)([A-Za-z0-9_\-.]{16,})/gi,(m,a)=>a+R],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:ant-|live_|test_)[A-Za-z0-9_-]{20,}|pk_(?:live|test)_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/g,()=>R],
];
export function scrubKeys(text){
  let out=String(text);for(const [rx,fn] of RULES)out=out.replace(rx,fn);return out;
}
export const SAVED=['data/ratings-samples','data/county-samples','data/ratings-probe.txt','data/ratings-browse.txt','data/county-probe.txt'];

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let changed=0;
  const files=SAVED.flatMap(p=>{const f=path.join(ROOT,p);if(!fs.existsSync(f))return [];return fs.statSync(f).isDirectory()?fs.readdirSync(f).map(n=>path.join(f,n)):[f];});
  for(const f of files){if(!/\.(html?|txt|json|js|xml|csv)$/i.test(f))continue;const t=fs.readFileSync(f,'utf8'),n=scrubKeys(t);if(n!==t){fs.writeFileSync(f,n);changed++;console.log(`scrubbed ${path.relative(ROOT,f)}`);}}
  console.log(`${changed} of ${files.length} saved pages had key-like values; they now read ${R}.`);
}
