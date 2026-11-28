// "No corporate PAC or lobby money" (approved 2026-11-28): No corporate PAC money and No lobby money shown as one badge,
// each half with its own mark, worth +5 each as before, so no score changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bonusBadges,unbought,UNBOUGHT} from '../public/six-scores.js';

const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const item=(label,status,points=0,group='money')=>({label,group,max:5,status,points,why:label});

test('the two halves make one badge: both, one or neither earned, or waiting',()=>{
  const b=(a,c)=>bonusBadges([item('No corporate PAC money',a,a==='yes'?5:0),item('No lobby money',c,c==='yes'?5:0),{label:'Holds no individual stocks',max:5,status:'no',points:0,why:'x'}]);
  const [g,s]=b('yes','no');
  assert.deepEqual([g.label,g.status,g.points,g.max,g.parts.length],['No corporate PAC or lobby money','partly',5,10,2]);
  assert.equal(g.why,'No corporate PAC money: yes · No lobby money: no');
  assert.equal(s.label,'Holds no individual stocks','the other bonuses as they are');
  assert.deepEqual([b('yes','yes')[0].status,b('yes','yes')[0].points],['yes',10]);
  assert.deepEqual([b('no','no')[0].status,b('no','no')[0].points],['no',0]);
  assert.equal(b('no','waiting')[0].status,'waiting','one half still not read: waiting, never no');
  assert.equal(b('yes','waiting')[0].status,'partly');
  assert.deepEqual(bonusBadges([]),[]);
});

test('the score is the same: each half still counts +5 on its own',()=>{
  assert.equal(UNBOUGHT.bonus.noCorporatePac,5);assert.equal(UNBOUGHT.bonus.noLobby,5);
  const x=unbought({chamber:'S',camp:{receipts:1e6,indiv:9e5,itemized:5e5,unitemized:4e5,pac:0}},{pacRows:[],lobby:{status:'took',total:1000,took:[{name:'Wall Street',total:1000}]}});
  const items=x.bonusItems,[g]=bonusBadges(items);
  assert.deepEqual(items.slice(0,2).map(i=>[i.label,i.group]),[['No corporate PAC money','money'],['No lobby money','money']]);
  assert.equal(g.points,items[0].points+items[1].points,'the badge adds up its halves');
  const bonus=x.parts.find(p=>p.key==='bonuses');
  assert.equal(bonus.points,items.reduce((t,i)=>t+i.points,0),'the Bonuses part counts every bonus as before');
});

test('the tab and the report card draw the badge with its halves',()=>{
  const app=read('../public/app.js'),card=read('../public/scorecard.js'),css=read('../public/remake.css');
  assert.ok(app.includes("const items=p=>p.items?`<ul class=\"st-items\">${bonusBadges(p.items).map(b=>b.parts?badge(b):line(b)).join('')}</ul>`"));
  assert.ok(app.includes("const mark=st=>st==='yes'?'✓':st==='partly'?'½':st==='waiting'?'…':'✕';"));
  assert.ok(app.includes("lists:u?[{title:'Bonuses',items:bonusBadges(u.bonusItems||[])}"),'the report card gets the badge');
  assert.ok(card.includes("partly:['#c98500','']")&&card.includes("it.status==='partly'?'½':'?'"));
  assert.ok(card.includes("(it.parts&&it.status==='partly'?` · ${it.parts.filter(p=>p.status==='yes').length} OF ${it.parts.length}`:'')"),'"1 OF 2"');
  assert.match(css,/\.st-items li\.partly > span:first-child \{ color: var\(--warn\); \}/);
});
