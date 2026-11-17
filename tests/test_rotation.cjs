const assert=require('node:assert/strict');
const {analyze,zone}=require('../rotation.js');
assert.equal(zone(1,1),'Leading');assert.equal(zone(1,-1),'Weakening');assert.equal(zone(-1,-1),'Lagging');assert.equal(zone(-1,1),'Improving');
const spy=[],fund=[];let d=new Date('2025-09-01T12:00Z');
for(let i=0;i<180;){if(d.getUTCDay()>0&&d.getUTCDay()<6){const date=d.toISOString().slice(0,10),c=100+i;spy.push({date,c:100,h:101,l:99,o:100,v:100});fund.push({date,c,h:c,l:c-2,o:c-1,v:100});i++;}d.setUTCDate(d.getUTCDate()+1);}
const asof=fund.at(-1).date,get=s=>analyze(s,asof).find(r=>r.ticker==='XLB');
let r=get({SPY:spy,XLB:fund});assert.equal(r.flow,1);assert.equal(r.points.length,8);assert.equal(r.zone,'Weakening');assert.ok(Math.abs(r.month-100*(279/258-1))<1e-9);assert.equal(r.rs,r.month);assert.equal(r.dollars,fund.slice(-20).reduce((s,b)=>s+b.c*100,0));
const base=fund.filter(b=>b.date<'2026').at(-1);assert.ok(Math.abs(r.ytd-100*(279/base.c-1))<1e-9);
assert.equal(get({SPY:spy,XLB:fund.slice(0,-1)}).available,false);assert.equal(get({SPY:spy}).available,false);assert.equal(get({SPY:[],XLB:fund}).available,false);
let low=fund.map(b=>({...b,h:b.c+2,l:b.c}));assert.equal(get({SPY:spy,XLB:low}).flow,-1);
let flat=fund.map(b=>({...b,h:b.c,l:b.c}));assert.equal(get({SPY:spy,XLB:flat}).flow,0);
assert.ok(Number.isNaN(get({SPY:spy,XLB:fund.map(b=>({...b,v:0}))}).flow));
const orig=JSON.stringify({SPY:spy,XLB:fund});get(JSON.parse(orig));assert.equal(JSON.stringify({SPY:spy,XLB:fund}),orig);
const fs=require('fs'),vm=require('vm');let nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',addEventListener(){},querySelectorAll(){return[];}});return nodes.get(id);};const ctx={document:{getElementById:node},window:{},snapshot:{symbols:{SPY:spy,XLB:fund},meta:{data_date:asof}}};vm.runInNewContext(fs.readFileSync('rotation.js','utf8'),ctx);assert.match(node('rotationChart').innerHTML,/<svg/);assert.match(node('rotationRows').innerHTML,/XLB/);assert.match(node('rotationCoverage').textContent,/1\/11/);
console.log('Rotation tests passed: quadrants, 8-point tails, aligned returns, YTD, CMF extremes, dollar proxy, zero volume/range, stale/missing funds and DOM rendering.');
