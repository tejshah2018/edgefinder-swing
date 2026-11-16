'use strict';
const assert=require('assert'),fs=require('fs');
const {updateHistory,engineFor}=require('../scripts/update_history.cjs');
const dates=[];for(let d=new Date('2025-01-02T00:00:00Z');dates.length<230;d.setUTCDate(d.getUTCDate()+1))if(d.getUTCDay()!==0&&d.getUTCDay()!==6)dates.push(d.toISOString().slice(0,10));
const bars=dates.map((date,i)=>({date,o:100+i,h:102+i,l:98+i,c:101+i,v:1000000}));
const sigDate=dates.at(-11),entry=bars.at(-10).o;
function market(stock=bars){return {meta:{data_date:dates.at(-1),total_downloaded:2,total_requested:2},symbols:{SPY:bars,TEST:stock},watchlist:[]};}
function seed(side='LONG'){return {schema_version:1,signals:[{id:'test-'+side,ticker:'TEST',side,signal_date:sigDate,recorded_at:sigDate+'T23:00:00Z',origin:'prospective',status:'TRIGGER',model_hash:engineFor(market()).hash,signal_close:bars.at(-11).c,entry:null,outcomes:{}}],sessions:[]};}
let a=updateHistory(market(),seed());
assert.equal(a.signals[0].entry.date,dates.at(-10));
for(const h of [2,5,10]){const o=a.signals[0].outcomes[h];assert.equal(o.state,'complete');assert.equal(o.session_date,dates[dates.length-11+h]);assert.ok(Math.abs(o.return_pct-100*(bars[dates.length-11+h].c/entry-1))<1e-10);}
let short=updateHistory(market(),seed('SHORT'));assert.equal(short.signals[0].outcomes[10].return_pct,-a.signals[0].outcomes[10].return_pct);
let missing=updateHistory(market(bars.filter(b=>b.date!==dates.at(-6))),seed());assert.equal(missing.signals[0].outcomes[5].state,'missing_data');assert.equal(missing.signals[0].outcomes[10].state,'complete');
let pending=market();pending.symbols.SPY=bars.slice(0,-8);pending.symbols.TEST=bars.slice(0,-8);pending.meta.data_date=dates.at(-9);let p=updateHistory(pending,seed());assert.equal(p.signals[0].outcomes[2].state,'complete');assert.equal(p.signals[0].outcomes[5].state,'pending');
let adjusted=market(bars.map(b=>({...b,o:b.o/2,h:b.h/2,l:b.l/2,c:b.c/2})));let split=updateHistory(adjusted,seed());assert.equal(split.signals[0].entry.open,a.signals[0].entry.open);assert.equal(split.signals[0].outcomes[10].return_pct,a.signals[0].outcomes[10].return_pct);
let repeated=updateHistory(market(bars.map(b=>({...b,c:b.c+10,h:b.h+10}))),a);assert.deepEqual(repeated.signals[0].outcomes,a.signals[0].outcomes);assert.equal(repeated.signals.length,1);
assert.throws(()=>updateHistory({meta:{},symbols:{}}),/synchronized SPY/);
const spyBars=dates.map((date,i)=>({date,o:100+i*.05,h:100.1+i*.05,l:99.9+i*.05,c:100+i*.05,v:1000000}));
let close=100;const stockBars=dates.map((date,i)=>{const open=close;close+=i<210?.2:(i%2?.8:-.5);return {date,o:open,h:Math.max(open,close)+.05,l:Math.min(open,close)-.05,c:close,v:i===229?2000000:1000000};});
const real={meta:{data_date:dates.at(-1),total_downloaded:3,total_requested:3},symbols:{SPY:spyBars,XLK:spyBars,AAPL:stockBars},watchlist:['AAPL']};
const now=real.meta.data_date+'T23:00:00Z';let live=updateHistory(real,null,now),again=updateHistory(real,live,now);assert.ok(live.signals.length>0);assert.deepEqual(again.signals,live.signals);assert.equal(again.sessions.length,1);assert.ok(live.signals.every(s=>s.signal_date===real.meta.data_date&&s.origin==='prospective'));assert.ok(live.signals.every(s=>[2,5,10].every(h=>s.outcomes[h].state==='pending')));
let late=updateHistory(real,null,'2026-11-17T20:00:00Z');assert.ok(late.signals.every(s=>s.origin==='late_snapshot'));
const engine=engineFor(real);for(const s of live.signals){const f=engine.frames[s.ticker],r=engine.evaluate(s.ticker,f.rows.length-1,s.side);assert.equal(s.score,r.score);assert.equal(s.planned_stop,r.stop);}
console.log('History tests passed: exact trading sessions, LONG/SHORT returns, missing bars, pending outcomes, adjustment basis, frozen results, daily deduplication, prospective/late provenance, shared scorer.');
