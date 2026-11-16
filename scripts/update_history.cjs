'use strict';
// Run the dashboard's existing scorer without a browser; never maintain a second scoring implementation.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),HORIZONS=[2,5,10];
function engineFor(snapshot){
  const source=fs.readFileSync(path.join(ROOT,'app.js'),'utf8').split('// Chaikin Money Flow')[0];
  if(!source.includes('function evaluate('))throw Error('Dashboard scorer not found; history was not changed');
  const context=vm.createContext({});
  const engine=vm.runInContext(source+`;({evaluate,load(data){derived={};for(const [t,rows] of Object.entries(data.symbols)){if(Array.isArray(rows)&&rows.length>=30)derived[t]=features(rows);}return derived;},benchmarks:BENCHMARKS})`,context);
  engine.frames=engine.load(snapshot);
  engine.hash=crypto.createHash('sha256').update(source).digest('hex').slice(0,12);
  return engine;
}
function easternDate(iso){const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));const v=t=>p.find(x=>x.type===t).value;return `${v('year')}-${v('month')}-${v('day')}`;}
function updateHistory(snapshot,previous=null,now=new Date().toISOString()){
  const date=snapshot?.meta?.data_date,spy=snapshot?.symbols?.SPY;
  if(!date||!Array.isArray(spy)||spy.length<210||spy.at(-1).date!==date)throw Error('No synchronized SPY snapshot; history retained');
  const engine=engineFor(snapshot);
  const history=previous?JSON.parse(JSON.stringify(previous)):{schema_version:1,started_at:now,signals:[],sessions:[]};
  if(history.schema_version!==1||!Array.isArray(history.signals)||!Array.isArray(history.sessions))throw Error('Unsupported history format; history retained');
  history.updated_at=now;history.last_scan_session=date;history.model_hash=engine.hash;
  history.horizons=HORIZONS;
  history.method='Signed return from next-session open to session 2/5/10 close. Daily adjusted OHLCV, normalized to the recorded signal price basis. Screening entry/stop/target are frozen reference levels; they are not execution fills and do not stop these horizon measurements. No fees, slippage, borrow costs or portfolio sizing. Only prospectively recorded confirmed triggers count toward summary statistics.';
  const ids=new Set(history.signals.map(s=>s.id));let added=0;
  for(const ticker of snapshot.watchlist||[]){
    if(engine.benchmarks.includes(ticker)||!/^[A-Z0-9.^=-]+$/.test(ticker))continue;
    const f=engine.frames[ticker];if(!f||f.rows.length<210||f.rows.at(-1).date!==date)continue;
    const i=f.rows.length-1,L=engine.evaluate(ticker,i,'LONG'),S=engine.evaluate(ticker,i,'SHORT');
    if(!L||!S)continue;const r=L.score>=S.score?L:S;
    if(r.score<75||!['TRIGGER','SETUP','WATCH'].includes(r.status))continue;
    const id=`${date}:${ticker}:${r.side}:${engine.hash}`;if(ids.has(id))continue;
    history.signals.push({id,signal_date:date,recorded_at:now,ticker,side:r.side,status:r.status,score:r.score,model_hash:engine.hash,origin:easternDate(now)===date?'prospective':'late_snapshot',signal_close:r.c,planned_entry:r.entry,planned_stop:r.stop,planned_target:r.target,regime:r.market,rs:r.rs,relative_volume:r.vol,factors:r.comps,entry:null,outcomes:{}});
    ids.add(id);added++;
  }
  const sessions=spy.map(r=>r.date),warnings=[];
  for(const signal of history.signals){
    const future=sessions.filter(d=>d>signal.signal_date);
    const rows=snapshot.symbols[signal.ticker],byDate=new Map((rows||[]).map(r=>[r.date,r]));
    if(HORIZONS.every(h=>signal.outcomes[h]?.state==='complete'))continue;
    const anchor=byDate.get(signal.signal_date),scale=anchor?signal.signal_close/anchor.c:null;
    if(!scale||!Number.isFinite(scale)){warnings.push(`${signal.ticker} ${signal.signal_date}: signal-date history missing; pending outcomes retained`);continue;}
    const first=future[0],entryBar=byDate.get(first);
    if(!signal.entry&&entryBar)signal.entry={date:first,open:entryBar.o*scale,observed_at:now};
    for(const h of HORIZONS){
      if(signal.outcomes[h]?.state==='complete')continue;
      const targetDate=future[h-1];
      if(!targetDate){signal.outcomes[h]={state:'pending',reason:`Awaiting session ${h}`};continue;}
      const exit=byDate.get(targetDate);
      if(!entryBar||!exit){signal.outcomes[h]={state:'missing_data',reason:`Missing ${!entryBar?'next-session open':targetDate+' close'}`};warnings.push(`${signal.ticker} ${signal.signal_date}: ${h}-session outcome missing data`);continue;}
      // Use one provider snapshot for numerator and denominator so future corporate-action adjustments do not mix price bases.
      const value=(signal.side==='LONG'?1:-1)*100*(exit.c/entryBar.o-1);
      signal.outcomes[h]={state:'complete',session_date:targetDate,exit_close:exit.c*scale,return_pct:value,result:value>0?'win':value<0?'loss':'flat',observed_at:now};
    }
  }
  let session=history.sessions.find(s=>s.date===date&&s.model_hash===engine.hash);
  if(!session){session={date,model_hash:engine.hash,first_recorded_at:now};history.sessions.push(session);}
  Object.assign(session,{last_recorded_at:now,downloaded:snapshot.meta.total_downloaded,requested:snapshot.meta.total_requested,missing_symbols:snapshot.meta.missing_symbols||[],lagging_symbols:snapshot.meta.lagging_symbols||[],signals_recorded:history.signals.filter(s=>s.signal_date===date&&s.model_hash===engine.hash).length});
  history.warnings=[...new Set(warnings)];
  history.signals.sort((a,b)=>b.signal_date.localeCompare(a.signal_date)||b.score-a.score||a.id.localeCompare(b.id));
  return history;
}
function main(){
  const file=path.join(ROOT,'data/signal-history.json');
  const market=JSON.parse(fs.readFileSync(path.join(ROOT,'data/market.json'),'utf8'));
  const status=JSON.parse(fs.readFileSync(path.join(ROOT,'data/scan-status.json'),'utf8'));
  if(status.status!=='success')throw Error('Latest data scan did not succeed; history retained');
  const previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
  const history=updateHistory(market,previous);
  fs.writeFileSync(file+'.tmp',JSON.stringify(history,null,2)+'\n');fs.renameSync(file+'.tmp',file);
  console.log(`History: ${history.signals.length} signal observations in ${history.sessions.length} sessions; latest ${history.last_scan_session}; model ${history.model_hash}`);
}
if(require.main===module){
  const status={attempted_at:new Date().toISOString()};
  try{main();status.status='success';}
  catch(e){status.status='failed';status.error=e.message;console.error(e.stack);process.exitCode=1;}
  finally{fs.writeFileSync(path.join(ROOT,'data/history-status.json'),JSON.stringify(status)+'\n');}
}
module.exports={updateHistory,engineFor};
