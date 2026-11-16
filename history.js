'use strict';
(()=>{
const el=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
let history=null,page=0,error='',busy=false;const size=25;
function filtered(){return (history?.signals||[]).filter(s=>(el('historySide').value==='all'||s.side===el('historySide').value)&&(el('historyState').value==='all'||s.status===el('historyState').value)&&s.ticker.includes(el('historySearch').value.trim().toUpperCase()));}
function outcome(s,h){const r=s.outcomes?.[h];if(r?.state!=='complete')return `<span class="muted">${r?.state==='missing_data'?'Missing data':'Pending'}</span>`;return `<span class="${r.return_pct>0?'green':r.return_pct<0?'red':'muted'}">${r.return_pct>0?'+':''}${number(r.return_pct)}%</span><div class="tiny">${esc(r.session_date)}</div>`;}
function render(){
 const status=el('historyStatus');
 if(!history){status.textContent=error||'Signal history will appear after the next successful scan.';el('historyRows').innerHTML='<tr><td colspan="10" class="empty">No recorded signal history yet. No historical winners have been seeded.</td></tr>';return;}
 status.textContent=(error?error+' Showing the previous loaded history. ':'')+`Last tracked session ${history.last_scan_session} · ${history.sessions.length} sessions logged · ${history.signals.length} signal observations · updated ${new Date(history.updated_at).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'})} ET.`;
 const tracked=(history.signals||[]).filter(s=>s.origin==='prospective'&&s.status==='TRIGGER'&&s.model_hash===history.model_hash);
 el('historyStats').innerHTML=[2,5,10].map(h=>{
  const done=tracked.filter(s=>s.outcomes[h]?.state==='complete');
  const sideStat=side=>{const a=done.filter(s=>s.side===side);return a.length?`${number(100*a.filter(s=>s.outcomes[h].return_pct>0).length/a.length,1)}% (${a.length})`:'— (0)';};
  const avg=done.length?done.reduce((a,s)=>a+s.outcomes[h].return_pct,0)/done.length:null;
  return `<article class="history-stat"><div class="eyebrow">${h}-SESSION OUTCOMES</div><strong>${done.length?number(avg)+'%':'Awaiting results'}</strong><span>Mean signed return · ${done.length} completed</span><div>LONG positive: ${sideStat('LONG')}</div><div>SHORT positive: ${sideStat('SHORT')}</div></article>`;
 }).join('');
 const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,pages-1);
 el('historyRows').innerHTML=rows.slice(page*size,(page+1)*size).map(s=>`<tr><td>${esc(s.signal_date)}<div class="tiny">${s.origin==='prospective'?'Recorded after close':'Late snapshot · excluded from stats'}</div></td><td><a href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(s.ticker)}" target="_blank" rel="noopener">${esc(s.ticker)} ↗</a><div class="tiny">${esc(s.side)}</div></td><td><span class="state ${esc(s.status)}">${esc(s.status)}</span><div class="tiny">Score ${s.score}/100</div></td><td>$${number(s.planned_entry)}<div class="tiny">Signal close $${number(s.signal_close)}</div></td><td>$${number(s.planned_stop)}</td><td>$${number(s.planned_target)}</td><td>${s.entry?'$'+number(s.entry.open)+'<div class="tiny">'+esc(s.entry.date)+'</div>':'Pending'}</td><td>${outcome(s,2)}</td><td>${outcome(s,5)}</td><td>${outcome(s,10)}</td></tr>`).join('')||'<tr><td colspan="10" class="empty">No matching observations. A session with no confirmed triggers is still logged.</td></tr>';
 el('historyPage').textContent=`Page ${page+1} of ${pages} · ${rows.length} observations`;
 el('historyPrev').disabled=page===0;el('historyNext').disabled=page>=pages-1;
 const warnings=history.warnings||[];el('historyWarnings').textContent=warnings.length?'Missing-data warnings: '+warnings.join('; '):'';
}
async function load(){
 if(busy)return;busy=true;
 try{const r=await fetch('data/signal-history.json?refresh='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const h=await r.json();if(h.schema_version!==1||!Array.isArray(h.signals))throw Error('Unexpected history format');history=h;error='';try{const sr=await fetch('data/history-status.json?refresh='+Date.now(),{cache:'no-store'});if(sr.ok){const st=await sr.json();if(st.status==='failed')error='Latest history update FAILED: '+st.error+' ('+st.attempted_at+').';}}catch(e){error='History update status could not be checked.';}}
 catch(e){error='History refresh unavailable ('+e.message+').';}finally{busy=false;render();}
}
function csv(){
 const headers=['Signal date','Recorded UTC','Origin','Ticker','Side','State','Score','Model','Signal close','Planned entry','Stop','Target','Next-session open date','Next-session open','2-session return %','2-session state','5-session return %','5-session state','10-session return %','10-session state'];
 const rows=filtered().map(s=>[s.signal_date,s.recorded_at,s.origin,s.ticker,s.side,s.status,s.score,s.model_hash,s.signal_close,s.planned_entry,s.planned_stop,s.planned_target,s.entry?.date||'',s.entry?.open??'',...[2,5,10].flatMap(h=>[s.outcomes[h]?.return_pct??'',s.outcomes[h]?.state||'pending'])]);
 const text=[headers,...rows].map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='edgefinder-signal-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
for(const id of ['historySide','historyState','historySearch'])el(id).addEventListener(id==='historySearch'?'input':'change',()=>{page=0;render();});
el('historyPrev').addEventListener('click',()=>{page--;render();});el('historyNext').addEventListener('click',()=>{page++;render();});el('historyCsv').addEventListener('click',csv);el('refreshBtn').addEventListener('click',load);load();
})();
