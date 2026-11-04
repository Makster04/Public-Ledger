// Builds public/maps/<ST>.json: each county's outline, already projected to SVG coordinates, for every state with a 2026
// Senate race on the Races page (Alaska excepted: it reports by state house district, not borough). The county map on a
// race card colors these outlines with public/county-results.json (scripts/county-results.mjs).
//
// Outlines: U.S. Census Bureau cartographic boundary files (public domain), as simplified in the us-atlas package
// (counties-10m). The three packages are only needed to rebuild the outlines, so they aren't in package.json:
//   npm install --no-save us-atlas@3.0.1 topojson-client@3.1.0 d3-geo@3.1.1
//   node scripts/build-maps.mjs            writes public/maps/
import fs from 'node:fs';
import {feature} from 'topojson-client';
import {geoTransverseMercator,geoPath,geoCentroid} from 'd3-geo';

const root=new URL('..',import.meta.url);
// State postal codes → Census FIPS codes.
export const STATE_FIPS={AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',
  KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',
  OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56'};
// Map width in SVG units; the height follows the state's shape.
export const MAP_WIDTH=400;

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const research=JSON.parse(fs.readFileSync(new URL('public/research.json',root),'utf8'));
  const topo=JSON.parse(fs.readFileSync(new URL('node_modules/us-atlas/counties-10m.json',root),'utf8'));
  const counties=feature(topo,topo.objects.counties).features,states=feature(topo,topo.objects.states).features;
  const wanted=[...new Set([...research.races,...research.liteRaces].filter(r=>r.chamber==='S'&&r.state!=='AK').map(r=>r.state))].sort();
  fs.mkdirSync(new URL('public/maps/',root),{recursive:true});
  for(const st of wanted){
    const fips=STATE_FIPS[st],state=states.find(f=>f.id===fips);if(!state)throw new Error('no outline for '+st);
    // A transverse Mercator centered on the state keeps its shape true at this size, wherever it is.
    const [lon,lat]=geoCentroid(state),proj=geoTransverseMercator().rotate([-lon,-lat]).fitWidth(MAP_WIDTH,state),path=geoPath(proj).digits(1);
    const height=Math.ceil(path.bounds(state)[1][1]);
    const own=counties.filter(f=>f.id.startsWith(fips)).map(f=>({fips:f.id,name:f.properties.name,d:path(f)})).sort((a,b)=>a.fips.localeCompare(b.fips));
    const out={state:st,fips,width:MAP_WIDTH,height,source:'U.S. Census Bureau cartographic boundary files, simplified in the us-atlas package (counties-10m)',outline:path(state),counties:own};
    fs.writeFileSync(new URL(`public/maps/${st}.json`,root),JSON.stringify(out)+'\n');
    console.log(`${st}: ${own.length} counties, ${Math.round(JSON.stringify(out).length/1024)} KB`);
  }
}
