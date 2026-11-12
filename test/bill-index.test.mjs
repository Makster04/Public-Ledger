// The bill index's reader (scripts/build-bill-index.mjs): one GovInfo BILLSTATUS file into the index's record.
import test from 'node:test';
import assert from 'node:assert/strict';
import {billRecord,plainText,congressOf,SUMMARY_MAX} from '../scripts/build-bill-index.mjs';

const xml=({summaries='',cosponsors='',laws=''}={})=>`<?xml version="1.0" encoding="utf-8"?>
<billStatus><version>3.0.0</version><bill>
  <number>2474</number><type>HR</type><congress>117</congress><introducedDate>2021-04-09</introducedDate>
  <title>To amend the National Labor Relations Act, and for other purposes.</title>
  <titles>
    <item><titleType>Short Titles as Introduced</titleType><title>Protecting the Right to Organize Act of 2021</title></item>
    <item><titleType>Short Title(s) as Passed House</titleType><title>Protecting the Right to Organize Act of 2021</title></item>
    <item><titleType>Official Title as Introduced</titleType><title>To amend the National Labor Relations Act.</title></item>
  </titles>
  <policyArea><name>Labor and Employment</name></policyArea>
  <subjects><legislativeSubjects><item><name>Labor-management relations</name></item><item><name>Employee hiring</name></item></legislativeSubjects></subjects>
  ${summaries}
  <sponsors><item><bioguideId>S000522</bioguideId><fullName>Rep. Scott</fullName><party>D</party><state>VA</state></item></sponsors>
  ${cosponsors}
  <actions>
    <item><actionDate>2021-03-09</actionDate><text>On passage Passed</text><recordedVotes><recordedVote><rollNumber>75</rollNumber><chamber>House</chamber><congress>117</congress><date>2021-03-09T23:31:00Z</date><sessionNumber>1</sessionNumber></recordedVote></recordedVotes></item>
    <item><actionDate>2021-03-09</actionDate><text>Motion to recommit</text><recordedVotes><recordedVote><rollNumber>74</rollNumber><chamber>House</chamber><congress>117</congress><date>2021-03-09T22:00:00Z</date><sessionNumber>1</sessionNumber></recordedVote></recordedVotes></item>
    <item><actionDate>2021-03-09</actionDate><text>Same vote, listed twice</text><recordedVotes><recordedVote><rollNumber>75</rollNumber><chamber>House</chamber><congress>117</congress><date>2021-03-09T23:31:00Z</date><sessionNumber>1</sessionNumber></recordedVote></recordedVotes></item>
  </actions>
  ${laws}
  <latestAction><actionDate>2021-03-11</actionDate><text>Received in the Senate.</text></latestAction>
</bill></billStatus>`;

test('a bill\'s record: titles, subjects, sponsor, cosponsors with their dates, recorded votes once each in order',()=>{
  const r=billRecord(xml({
    summaries:`<summaries><summary><actionDate>2021-02-04</actionDate><updateDate>2021-02-10</updateDate><text><![CDATA[<p><b>Introduced</b> version &amp; text.</p>]]></text></summary>
      <summary><actionDate>2021-03-09</actionDate><updateDate>2021-03-20</updateDate><text><![CDATA[<p>Passed House: expands <strong>workers'</strong> protections.</p>]]></text></summary></summaries>`,
    cosponsors:`<cosponsors><item><bioguideId>A000370</bioguideId><sponsorshipDate>2021-02-04</sponsorshipDate><isOriginalCosponsor>True</isOriginalCosponsor></item>
      <item><bioguideId>B001281</bioguideId><sponsorshipDate>2021-03-01</sponsorshipDate><isOriginalCosponsor>False</isOriginalCosponsor><sponsorshipWithdrawnDate>2021-05-02</sponsorshipWithdrawnDate></item></cosponsors>`}));
  assert.equal(r.id,'117-hr-2474');assert.equal(r.c,117);assert.equal(r.t,'hr');assert.equal(r.n,2474);
  assert.deepEqual(r.short,['Protecting the Right to Organize Act of 2021'],'short titles once each; official titles left out');
  assert.equal(r.area,'Labor and Employment');assert.deepEqual(r.subjects,['Labor-management relations','Employee hiring']);
  assert.equal(r.summary,"Passed House: expands workers' protections.",'the latest summary, as plain text');
  assert.deepEqual(r.sponsor,{id:'S000522',party:'D',state:'VA'});
  assert.deepEqual(r.cosponsors,[{id:'A000370',date:'2021-02-04',orig:true},{id:'B001281',date:'2021-03-01',out:'2021-05-02'}]);
  assert.deepEqual(r.votes,[{ch:'H',roll:74,date:'2021-03-09',session:1,c:117},{ch:'H',roll:75,date:'2021-03-09',session:1,c:117}]);
  assert.equal(r.law,undefined);assert.deepEqual(r.latest,{date:'2021-03-11',text:'Received in the Senate.'});
});

test('no summary, a law, a long summary cut at a word; anything else isn\'t a bill',()=>{
  const r=billRecord(xml({laws:'<laws><item><type>Public Law</type><number>117-1</number></item></laws>'}));
  assert.equal(r.summary,null);assert.equal(r.law,true);assert.deepEqual(r.cosponsors,[]);
  const long='word '.repeat(SUMMARY_MAX);const s=billRecord(xml({summaries:`<summaries><summary><actionDate>2021-01-01</actionDate><text>${long}</text></summary></summaries>`})).summary;
  assert.ok(s.length<=SUMMARY_MAX+2&&s.endsWith(' …'));
  assert.equal(billRecord('<other/>'),null);
  // the older layout: billNumber and billType
  assert.equal(billRecord('<billStatus><bill><billNumber>9</billNumber><billType>HR</billType><congress>117</congress><title>Reserved</title></bill></billStatus>').id,'117-hr-9');
});

test('plain text from summary HTML; the Congress for a date',()=>{
  assert.equal(plainText('<p>A&nbsp;&amp; B</p><ul><li>C</li></ul>'),'A & B C');
  assert.equal(congressOf(new Date('2025-01-04')),119);assert.equal(congressOf(new Date('2026-11-12')),119);assert.equal(congressOf(new Date('2013-06-01')),113);
});

import {amendmentRecords,amendmentYea} from '../scripts/build-bill-index.mjs';
test('an amendment\'s recorded votes: which way a Yea points, from the action\'s text',()=>{
  for(const t of ['On agreeing to the Rohrabacher amendment (A059) Agreed to by recorded vote: 219 - 189 (Roll no. 258).',
    'On agreeing to the Ellison amendment (A070) Failed by recorded vote: 196 - 211 (Roll no. 270).',
    'Amendment SA 2885 not agreed to in Senate by Yea-Nay Vote. 48 - 52. Record Vote Number: 314.',
    'Amendment SA 2915, under the order of 12/3/15, not having achieved 60 votes in the affirmative, was not agreed to in Senate by Yea-Nay Vote. 54 - 45.',
    'Motion to waive all applicable budgetary discipline with respect to amendment SA 2910 rejected in Senate by Yea-Nay Vote. 45 - 54.',
    'Cloture on amendment SA 4720 not invoked in Senate by Yea-Nay Vote. 47 - 53.'])assert.equal(amendmentYea(t),true,t);
  assert.equal(amendmentYea('Motion to table amendment SA 1234 agreed to in Senate by Yea-Nay Vote. 54 - 46.'),false);
  for(const t of ['Motion to table the motion to reconsider the vote on amendment SA 1 agreed to.','Point of order raised against amendment SA 2 well taken.','Motion to recommit with instructions failed.','Amendment offered.'])assert.equal(amendmentYea(t),null,t);
});
test('the amendments a bill\'s status file lists: sponsor, cosponsors, the bill they amend, each roll call once',()=>{
  const vote=(roll,text,d='2015-12-03')=>`<item><actionDate>${d}</actionDate><text>${text}</text><recordedVotes><recordedVote><rollNumber>${roll}</rollNumber><chamber>Senate</chamber><congress>114</congress><date>${d}T20:00:00Z</date><sessionNumber>1</sessionNumber></recordedVote></recordedVotes></item>`;
  const xml=`<billStatus><bill><number>3762</number><type>HR</type><congress>114</congress><title>T</title><amendments>
    <amendment><number>2910</number><congress>114</congress><type>SAMDT</type><purpose>To deny  firearms to suspected terrorists.</purpose>
      <sponsors><item><bioguideId>F000062</bioguideId><party>D</party><state>CA</state></item></sponsors>
      <cosponsors><item><bioguideId>W000802</bioguideId><sponsorshipDate>2015-12-03</sponsorshipDate></item></cosponsors>
      <submittedDate>2015-12-03T05:00:00Z</submittedDate><amendedAmendment><number>2874</number><congress>114</congress><type>SAMDT</type></amendedAmendment>
      <actions><count>3</count><actions>${vote(319,'Motion to waive all applicable budgetary discipline with respect to amendment SA 2910 rejected in Senate by Yea-Nay Vote. 45 - 54.')}${vote(319,'Roll call votes on amendments in Senate: Motion to waive all applicable budgetary discipline with respect to amendment SA 2910 rejected.')}<item><text>Amendment SA 2910 proposed.</text></item></actions></actions></amendment>
    <amendment><number>9</number><congress>114</congress><type>HAMDT</type><description>An amendment to strike section 2.</description><amendedBill><congress>114</congress><type>HR</type><number>5</number></amendedBill></amendment>
    <amendment><type>SAMDT</type></amendment></amendments></bill></billStatus>`;
  const [a,b,...rest]=amendmentRecords(xml);assert.equal(rest.length,0,'an amendment with no number is skipped');
  assert.equal(a.id,'114-samdt-2910');assert.equal(a.bill,'114-hr-3762');assert.equal(a.of,'114-samdt-2874');assert.equal(a.purpose,'To deny firearms to suspected terrorists.');
  assert.deepEqual(a.sponsor,{id:'F000062',party:'D',state:'CA'});assert.deepEqual(a.cosponsors,[{id:'W000802',date:'2015-12-03'}]);assert.equal(a.intro,'2015-12-03');
  assert.equal(a.votes.length,1);assert.deepEqual({...a.votes[0],text:undefined},{ch:'S',roll:319,date:'2015-12-03',session:1,c:114,yea:true,text:undefined});
  assert.equal(b.id,'114-hamdt-9');assert.equal(b.bill,'114-hr-5');assert.equal(b.purpose,'An amendment to strike section 2.');assert.deepEqual(b.votes,[]);assert.equal(b.sponsor,null);
  assert.deepEqual(amendmentRecords('<other/>'),[]);
});
