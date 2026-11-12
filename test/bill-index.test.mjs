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
});

test('plain text from summary HTML; the Congress for a date',()=>{
  assert.equal(plainText('<p>A&nbsp;&amp; B</p><ul><li>C</li></ul>'),'A & B C');
  assert.equal(congressOf(new Date('2025-01-04')),119);assert.equal(congressOf(new Date('2026-11-12')),119);assert.equal(congressOf(new Date('2013-06-01')),113);
});
