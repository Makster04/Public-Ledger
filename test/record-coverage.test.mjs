// Toward 10 or more quotes, stances and promises for everyone: the coverage report (scripts/coverage.mjs) and the
// Congressional Record collector (scripts/collect-record.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {daysIn,speechPages,routine,keptSentences,peopleByBioguide} from '../scripts/collect-record.mjs';
import {everyone,personCoverage,coverage} from '../scripts/coverage.mjs';
import {speakerText} from '../src/promise-finder.mjs';
import {searchTests} from '../scripts/question-statements.mjs';

const granule=({id,cls='HOUSE',title,speakers})=>`<relatedItem type="constituent" ID="id-${id}"><titleInfo><title>${title}</title></titleInfo>
  <location><url access="raw object" displayLabel="HTML rendition">https://www.govinfo.gov/content/pkg/${id.slice(0,15)}/html/${id}.htm</url></location>
  <extension><searchTitle>${title}; Congressional Record Vol. 171, No. 196</searchTitle><granuleClass>${cls}</granuleClass><accessId>${id}</accessId>
  ${speakers.map(b=>`<congMember bioGuideId="${b}" chamber="H" role="SPEAKING" state="NY"></congMember>`).join('')}</extension></relatedItem>`;

test('the Record days come from the sitemap; each day\'s speeches from its description',()=>{
  assert.deepEqual(daysIn('<loc>https://www.govinfo.gov/app/details/CREC-2025-01-03</loc><loc>https://www.govinfo.gov/app/details/CREC-2025-01-02</loc>'),['2025-01-02','2025-01-03']);
  const mods=`<mods>${granule({id:'CREC-2025-11-20-pt1-PgH4821-4',title:'SNAP CUTS',speakers:['Q000023']})}
    ${granule({id:'CREC-2025-11-20-pt1-PgD1-1',cls:'DAILYDIGEST',title:'Daily Digest',speakers:['Q000023']})}
    ${granule({id:'CREC-2025-11-20-pt1-PgH4800',title:'PRAYER',speakers:[]})}
    ${granule({id:'CREC-2025-11-20-pt1-PgS8000-2',cls:'SENATE',title:'NOMINATIONS &amp; VOTES',speakers:['S000148','Q000023']})}</mods>`;
  const pages=speechPages(mods);
  assert.deepEqual(pages.map(p=>[p.id,p.title,p.speakers.join(',')]),[['CREC-2025-11-20-pt1-PgH4821-4','SNAP CUTS','Q000023'],['CREC-2025-11-20-pt1-PgS8000-2','NOMINATIONS & VOTES','S000148,Q000023']]);
  assert.match(pages[0].url,/content\/pkg\/CREC-2025-11-20\/html\/CREC-2025-11-20-pt1-PgH4821-4\.htm$/);
  assert.ok(routine('HONORING DR. T. ANTHONY BRONNER')&&routine('PRAYER')&&!routine('SNAP CUTS'));
});

test('a speaker named in mixed case in the Record ("Mr. McCLINTOCK", "Ms. DeLAURO") is found',()=>{
  const t='  Mr. McCLINTOCK. Mr. Speaker, I will vote against this bill.\n  Ms. DeLAURO. Madam Speaker, we must protect Social Security.\n  Mr. JOHNSON of Georgia. I yield back.';
  assert.equal(speakerText(t,{name:'Tom McClintock',stateName:'California'}),'Mr. Speaker, I will vote against this bill.');
  assert.equal(speakerText(t,{name:'Rosa DeLauro',stateName:'Connecticut'}),'Madam Speaker, we must protect Social Security.');
  assert.equal(speakerText(t,{name:'Mike Johnson',stateName:'Louisiana'}),'','another state\'s Johnson');
});

test('only sentences naming a question\'s phrases or making a commitment are kept',()=>{
  const tests=searchTests({about:'',minimum_wage:{any:['minimum wage']}});
  const kept=keptSentences('Mr. Speaker, the weather in my district has been lovely this autumn and the leaves are falling. Raising the minimum wage would lift millions of workers out of poverty. I will vote against any bill that cuts veterans\' benefits next year.',{name:'Pat Doe'},tests);
  assert.deepEqual(kept,['Raising the minimum wage would lift millions of workers out of poverty.','I will vote against any bill that cuts veterans\' benefits next year.']);
});

test('members are found by bioguide ID in both chambers and the profiles',()=>{
  const m=peopleByBioguide({research:{members:[{id:'ossoff',name:'Jon Ossoff',bioguide:'O000174',stateName:'Georgia'}],cands:[]},senate:{senators:[{id:'warnock',name:'Raphael Warnock',bioguide:'W000790'}]},house:{members:[{id:'quigley',name:'Mike Quigley',bioguide:'Q000023'}]}});
  assert.deepEqual([...m.keys()].sort(),['O000174','Q000023','W000790']);
});

test('coverage counts promises, tagged quotes and stances, with what each person is short of',()=>{
  const files={research:{members:[{id:'a',name:'A',bioguide:'A1'}],cands:[{id:'c',name:'C'}]},senate:{senators:[{id:'a',name:'A',bioguide:'A1'},{id:'s',name:'S',bioguide:'S1'}]},house:{members:[]},elect:{members:[{id:'e',name:'E'}]},
    promises:{people:{a:Array(12).fill({})}},statements:{people:{c:{q1:[[0]],q2:[[1],[0]]}}},stances:{people:{A1:Object.fromEntries(Array.from({length:11},(_,i)=>[`q${i}`,[1,0]])),S1:{q1:[0,0]}}},has:()=>false};
  const kinds=Object.fromEntries(everyone(files).map(p=>[p.id,p.kind]));
  assert.deepEqual(kinds,{a:'full',c:'full',s:'senate',e:'elect'});
  const c=coverage(files),by=Object.fromEntries(c.people.map(p=>[p.id,p]));
  assert.deepEqual([by.a.promises,by.a.stances,by.a.short.promises],[12,11,0]);
  assert.deepEqual([by.c.quotes,by.c.stances,by.c.short.quotes],[3,2,7]);
  assert.equal(by.s.stances,0,'a question with no votes either way isn\'t a stance');
  assert.ok(by.s.next.some(n=>/Congressional Record/.test(n)));
  assert.deepEqual(c.totals.promises.all,{met:1,some:0,none:3,of:4});
  assert.equal(personCoverage({id:'x',bioguide:null,sitting:false},{}).sources.record,false);
});
