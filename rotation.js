'use strict';
(function(){
const funds=[['XLB','Materials','sector'],['XLC','Communication services','sector'],['XLE','Energy','sector'],['XLF','Financials','sector'],['XLI','Industrials','sector'],['XLK','Technology','sector'],['XLP','Consumer staples','sector'],['XLRE','Real estate','sector'],['XLU','Utilities','sector'],['XLV','Health care','sector'],['XLY','Consumer discretionary','sector'],['XLG','S&P 500 top 50','style'],['QQQ','Nasdaq 100','style'],['MTUM','Momentum factor','style'],['MAGS','Magnificent Seven','style'],['IWM','Russell 2000 small cap','style'],['IWF','Russell 1000 growth','style'],['IWD','Russell 1000 value','style'],['RSP','S&P 500 equal weight','style']];
const zone=(x,y)=>x>=0?(y>=0?'Leading':'Weakening'):(y>=0?'Improving':'Lagging');
function week(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
function analyze(symbols,asof){
 const spy=(symbols.SPY||[]).filter(r=>r.date<=asof),sm=new Map(spy.map(r=>[r.date,r.c]));
 return funds.map(([ticker,name,group])=>{
 const rows=(symbols[ticker]||[]).filter(r=>r.date<=asof).slice().sort((a,b)=>a.date.localeCompare(b.date)),pairs=rows.filter(r=>sm.has(r.date)),last=pairs.at(-1);
 if(!last||last.date!==asof||!sm.has(asof))return {ticker,name,group,available:false,note:last?'Stale: '+last.date:'Unavailable'};
 const weeks=new Map();for(const r of pairs)weeks.set(week(r.date),{date:r.date,ratio:r.c/sm.get(r.date)});
 const w=[...weeks.values()],xs=w.map((r,i)=>i<12?NaN:100*(r.ratio/(w.slice(i-12,i+1).reduce((s,a)=>s+a.ratio,0)/13)-1));
 const points=w.map((r,i)=>({date:r.date,x:xs[i],y:i>=4?xs[i]-xs[i-4]:NaN})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(!points.length)return {ticker,name,group,available:false,note:'Need 17 weeks of aligned history'};
 const now=points.at(-1),old=points.at(-5),p=n=>pairs.length>n?100*(last.c/pairs.at(-1-n).c-1):NaN;
 const rs=pairs.length>21?p(21)-100*(sm.get(last.date)/sm.get(pairs.at(-22).date)-1):NaN;
 let weighted=0,volume=0,dollars=0;const recent=rows.slice(-20);
 for(const r of recent){const m=r.h>r.l?(2*r.c-r.h-r.l)/(r.h-r.l):0;weighted+=m*r.v;volume+=r.v;dollars+=m*r.v*r.c;}
 const flow=recent.length===20&&volume>0?weighted/volume:NaN,base=rows.filter(r=>r.date.slice(0,4)<asof.slice(0,4)).at(-1);
 return {ticker,name,group,available:true,date:last.date,price:last.c,today:p(1),month:p(21),rs,quarter:p(63),ytd:base?100*(last.c/base.c-1):NaN,flow,dollars:Number.isFinite(flow)?dollars:NaN,zone:zone(now.x,now.y),old:old?zone(old.x,old.y):'—',points:points.slice(-8),label:!Number.isFinite(flow)?'Unavailable':flow>=.05?'Buying pressure':flow<=-.05?(now.x>=0?'Selling into strength':'Selling pressure'):'Neutral'};
 });
}
if(typeof module!=='undefined'&&module.exports){module.exports={analyze,zone,week,funds};return;}
const el=id=>document.getElementById(id),num=(v,n=1)=>Number.isFinite(v)?v.toFixed(n):'—',pct=v=>Number.isFinite(v)?(v>0?'+':'')+num(v)+'%':'—',signed=v=>Number.isFinite(v)?(v>0?'+':'')+num(v,2):'—';
const cash=v=>!Number.isFinite(v)?'—':(v<0?'−':'+')+'$'+num(Math.abs(v)/(Math.abs(v)>=1e9?1e9:1e6))+(Math.abs(v)>=1e9?'B':'M');
const colors={Leading:'#63e0ae',Improving:'#7eafff',Weakening:'#e5b977',Lagging:'#ff8996'};
let category='sector',selected='',cached=[];
function draw(list){
 const valid=list.filter(r=>r.available);if(!valid.length){el('rotationChart').innerHTML='<p class="empty">No synchronized history available.</p>';return;}
 const all=valid.flatMap(r=>r.points),mx=Math.max(1,...all.map(p=>Math.abs(p.x)))*1.25,my=Math.max(.5,...all.map(p=>Math.abs(p.y)))*1.25,x=v=>460+v/mx*360,y=v=>245-v/my*180;
 let svg='<svg viewBox="0 0 920 510" role="img" aria-labelledby="rotTitle rotDesc"><title id="rotTitle">ETF rotation versus SPY</title><desc id="rotDesc">Weekly trails end in a large dot. Right is stronger relative trend. Up is improving momentum. Select a ticker below to highlight its trail.</desc><rect x="100" y="65" width="360" height="180" fill="#152b43"/><rect x="460" y="65" width="360" height="180" fill="#11382e"/><rect x="100" y="245" width="360" height="180" fill="#37202e"/><rect x="460" y="245" width="360" height="180" fill="#352f22"/>';
 for(const a of [-1,-.5,0,.5,1]){const xx=x(a*mx),yy=y(a*my);svg+='<path d="M'+xx+' 65V425 M100 '+yy+'H820" stroke="#435568" stroke-opacity="'+(a===0?1:.3)+'"/><text x="'+xx+'" y="447" text-anchor="middle">'+num(a*mx)+'</text><text x="88" y="'+(yy+4)+'" text-anchor="end">'+num(a*my)+'</text>';}
 svg+='<text x="115" y="88" fill="#7eafff">IMPROVING</text><text x="805" y="88" text-anchor="end" fill="#63e0ae">LEADING</text><text x="115" y="415" fill="#ff8996">LAGGING</text><text x="805" y="415" text-anchor="end" fill="#e5b977">WEAKENING</text><text x="460" y="480" text-anchor="middle">Relative strength vs 13-week baseline (%) →</text><text transform="translate(24 245) rotate(-90)" text-anchor="middle">4-week strength change (pp) →</text>';
 valid.sort((a,b)=>(a.ticker===selected?1:0)-(b.ticker===selected?1:0)).forEach((r,idx)=>{const color=colors[r.zone],dim=selected&&selected!==r.ticker?.15:1;
 svg+='<g opacity="'+dim+'"><polyline fill="none" stroke="'+color+'" stroke-width="'+(r.ticker===selected?3:1.5)+'" points="'+r.points.map(p=>x(p.x)+','+y(p.y)).join(' ')+'"/>';
 r.points.forEach((p,i)=>{svg+='<circle cx="'+x(p.x)+'" cy="'+y(p.y)+'" r="'+(i===r.points.length-1?5:2)+'" fill="'+color+'"><title>'+r.ticker+' '+p.date+' · strength '+num(p.x,2)+'% · momentum '+num(p.y,2)+' pp</title></circle>';});const p=r.points.at(-1);svg+='<text x="'+(x(p.x)+8)+'" y="'+(y(p.y)+(idx%2?14:-8))+'" fill="'+color+'" font-weight="700">'+r.ticker+'</text></g>';});el('rotationChart').innerHTML=svg+'</svg>';
}
function paint(){
 const list=cached.filter(r=>category==='all'||r.group===category).sort((a,b)=>(Number.isFinite(b.flow)?b.flow:-9)-(Number.isFinite(a.flow)?a.flow:-9)),good=list.filter(r=>r.available);
 el('rotationSummary').innerHTML=['Buying','Selling'].map((name,i)=>'<div><b class="'+(i?'red':'green')+'">'+name+' pressure</b><p>'+(good.filter(r=>i?r.flow<=-.05:r.flow>=.05).map(r=>r.ticker).join(' · ')||'None')+'</p></div>').join('');
 el('rotationCoverage').textContent='As of '+(snapshot?.meta?.data_date||'—')+' · '+good.length+'/'+list.length+' funds synchronized · latest point includes this week through the last close.';
 el('rotationRows').innerHTML=list.map(r=>!r.available?'<tr><td>'+r.ticker+'</td><td>'+r.name+'</td><td colspan="11">'+r.note+'</td></tr>':'<tr><td><button class="rotation-pick" data-rot="'+r.ticker+'" aria-pressed="'+(selected===r.ticker)+'">'+r.ticker+'</button></td><td>'+r.name+'</td><td>'+r.label+'</td><td style="color:'+colors[r.zone]+'">'+r.zone+'</td><td>'+r.old+'</td><td>'+signed(r.flow)+'</td><td>'+cash(r.dollars)+'</td><td>$'+num(r.price,2)+'</td>'+[r.today,r.month,r.rs,r.quarter,r.ytd].map(v=>'<td class="'+(v>0?'green':v<0?'red':'')+'">'+pct(v)+'</td>').join('')+'</tr>').join('');
 el('rotationRows').querySelectorAll('[data-rot]').forEach(b=>b.addEventListener('click',()=>{selected=selected===b.dataset.rot?'':b.dataset.rot;paint();}));draw(list);
}
window.renderRotation=function(){if(!el('rotationChart')||!snapshot)return;cached=analyze(snapshot.symbols,snapshot.meta.data_date);paint();};
el('rotationFilter').addEventListener('change',e=>{category=e.target.value;selected='';paint();});el('rotationClear').addEventListener('click',()=>{selected='';paint();});window.renderRotation();
})();
