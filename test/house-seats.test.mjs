// Who won each House seat (scripts/build-house-seats.mjs, public/house-seats.json), and the members-elect builder's
// FEC match when two candidates share a last name (scripts/build-members-elect.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {districtsOn,boldWinner,matchWinner,seatOf,cleanName,seatKey} from '../scripts/build-house-seats.mjs';
import {findCandidate,firstFits} from '../scripts/build-members-elect.mjs';

const box=(rows,extra='')=>`{{Infobox election\n| election_name = x\n${rows.map(([n,v,p],i)=>`| nominee${i+1} = ${n}\n| party${i+1} = ${p||'Democratic Party (United States)'}\n| popular_vote${i+1} = ${v}\n| percentage${i+1} = `).join('\n')}\n${extra}}}\n`;

test('a state page\'s districts, and each one\'s winner: in bold (name, votes or share), else the general election\'s winning candidate',()=>{
  assert.deepEqual(districtsOn('intro\n== District 1 ==\na\n== District 2 ==\nb'),['01','02']);
  assert.deepEqual(districtsOn('{{Infobox election\n| x = y\n}}'),['AL'],'one at-large district');
  assert.deepEqual(boldWinner(box([["'''[[Ami Bera]]'''",'122,614'],['Robb Tucker','88,752','Republican Party (United States)']])),{name:'Ami Bera',party:'D'});
  assert.deepEqual(boldWinner(box([['[[Gabe Amo]]',"'''112,107'''"],['Kellie Keenan','44,901']])),{name:'Gabe Amo',party:'D'},'Rhode Island bolds the votes');
  assert.equal(boldWinner(box([['[[Suzan DelBene]]',''],['Mary Silva','']])),null,'a page with no result yet');
  const gen=box([['[[A B]]',''],['C D','']])+`\n===General election===\n{{Election box begin\n| title = General election\n}}\n{{Election box winning candidate with party link\n| candidate = [[Pat Smith (politician)|Pat Smith]] (incumbent)\n| party = Republican Party (United States)\n| votes = 1\n}}\n`;
  assert.deepEqual(boldWinner(gen),{name:'Pat Smith',party:'R'},'the results table, a link with its own words');
  assert.equal(cleanName('Maxwell Frost; (Uncontested)'),'Maxwell Frost');assert.equal(seatKey('AK','AL'),'AK-0');assert.equal(seatKey('CA','03'),'CA-3');
});

test('a winner is matched to the site: a member-elect, a reviewed profile, or a member of the state who moved districts',()=>{
  const ctx={elect:[{id:'pan',name:'Richard Pan',seat:'CA-6'},{id:'nehlstx',name:'Trever Nehls',seat:'TX-22'}],profiles:[{id:'ojeda',name:'Richard Ojeda',seat:'NC-9'}],
    house:[{id:'bera',name:'Ami Bera',state:'CA',district:6},{id:'nehls',name:'Troy E. Nehls',state:'TX',district:22},{id:'jsmith',name:'Jason Smith',state:'MO',district:8},{id:'asmith',name:'Adrian Smith',state:'NE',district:3},
      {id:'csmith',name:'Chris Smith',state:'NJ',district:4},{id:'njsmith2',name:'Joe Smith',state:'NJ',district:9}]};
  assert.deepEqual(matchWinner({name:'Ami Bera'},'CA-3',ctx),{id:'bera',via:'member'},'Bera, from CA-6');
  assert.deepEqual(matchWinner({name:'Richard Pan'},'CA-6',ctx),{id:'pan',via:'elect'});
  assert.deepEqual(matchWinner({name:'Trever Nehls'},'TX-22',ctx),{id:'nehlstx',via:'elect'},'not his twin brother, who held the seat');
  assert.deepEqual(matchWinner({name:'Richard Ojeda'},'NC-9',ctx),{id:'ojeda',via:'profile'});
  assert.deepEqual(matchWinner({name:'Chris Smith'},'NJ-4',ctx),{id:'csmith',via:'member'},'two Smiths in a state: the first name decides');
  assert.equal(matchWinner({name:'Pat Nobody'},'OH-1',ctx),null);
  // A seat waits when the list of not-called races has it; a page without a result keeps its member when no new member is listed.
  assert.deepEqual(seatOf({seat:'LA-5',sec:'',skip:'Runoff Dec. 12, 2026',ctx}),{pending:'Runoff Dec. 12, 2026'});
  const ballot=box([['[[Jason Smith]]',''],['X Y','']]);
  assert.deepEqual(seatOf({seat:'MO-8',sec:ballot,ctx}),{name:'Jason Smith',party:undefined,id:'jsmith',via:'member',unconfirmed:'No result on Wikipedia\'s page yet, and no new member listed for the seat'});
  assert.deepEqual(seatOf({seat:'TX-22',sec:box([['Trever Nehls',''],['Z','']]),listed:'Trever Nehls',ctx}),{name:'Trever Nehls',party:null,id:'nehlstx',via:'elect'},'the list of new members names the winner');
  assert.deepEqual(seatOf({seat:'OH-1',sec:box([['A B',''],['C D','']]),ctx}),{pending:'No result on Wikipedia\'s page yet'},'no member on the ballot: waits');
});

test('two FEC candidates of one last name in a district: the one whose first name fits (Trever Nehls had his brother Troy\'s ID)',()=>{
  const T={cands:[{id:'H0TX22302',name:'NEHLS, TROY',st:'TX',dist:'22',party:'REP',receipts:429606},{id:'H6TX22283',name:'NEHLS, TREVER',st:'TX',dist:'22',party:'REP',receipts:327410}]};
  assert.equal(findCandidate(T,'TX-22','Trever Nehls','R').id,'H6TX22283');
  assert.equal(findCandidate(T,'TX-22','Troy Nehls','R').id,'H0TX22302');
  assert.equal(findCandidate({cands:[T.cands[0]]},'TX-22','T. Nehls','R').id,'H0TX22302','one candidate of the name: theirs, whatever the first name');
  assert.ok(firstFits('NEHLS, TREVER','Trever Nehls'));assert.ok(!firstFits('NEHLS, TROY','Trever Nehls'));
});
