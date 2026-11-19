// Helpers for reading other sites' pages, shared by the interest-group ratings readers (scripts/ratings-probe.mjs,
// scripts/collect-ratings.mjs). They came from the county results reader (scripts/county-results.mjs), taken down with
// the Races page on Nov. 19, 2026.

// A page as saved for a sample: no scripts, styles or comments, at most 150 KB.
// ASP.NET's hidden form fields (__VIEWSTATE …) can run to hundreds of kilobytes; their values are cut out.
const noViewState=t=>String(t).replace(/(<input\b[^>]*\bname="__[A-Z]+"[^>]*\bvalue=")[^"]*/gi,'$1…');
export const sampleOf=text=>noViewState(text).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\n\s*\n+/g,'\n').slice(0,150000);
// The addresses a page's scripts ask for: the quoted paths and URLs in its own and linked scripts that look like data.
export function scriptAddresses(code){
  const out=new Set();
  for(const m of String(code).matchAll(/["'`]((?:https?:)?\/{0,2}[\w.$\{\}-]*\/[\w.\/?=&%$\{\}:+-]{2,200})["'`]/g)){
    const v=m[1];if(/\.(css|js|png|svg|gif|jpe?g|ico|woff2?|ttf|map)(\?|$)/i.test(v)||/^\/\/?$/.test(v)||!/[a-z]{3}/i.test(v))continue;
    if(/api|json|xml|result|election|contest|county|race|data|export|feed|summary|candidate|s3|cdn|enr|vote/i.test(v))out.add(v);
    if(out.size>=300)break;
  }
  return [...out];
}
// A reply that is a bot check ("Just a moment…", a captcha) rather than the page: the site turns scripts away. It is said
// as such, and the way around it is a page saved from a browser, never a disguise.
export const botCheck=(status,url,head)=>/perfdrive\.com|captcha|__cf_chl/i.test(url||'')||(status===403||status===429||status===503||status===202)&&/just a moment|attention required|captcha|cf-chl|radware|challenge-platform/i.test(head||'');
