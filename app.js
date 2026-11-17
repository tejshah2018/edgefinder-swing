'use strict';
/* EDGEFINDER after-close research dashboard. Reuses historical v2.1 scoring logic. */
const $=id=>document.getElementById(id);
const fmt=(v,n=2)=>Number.isFinite(v)?v.toFixed(n):'—';
const pct=(v,n=1)=>Number.isFinite(v)?(v>=0?'+':'')+fmt(v,n)+'%':'—';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BENCHMARKS=['SPY','QQQ','SMH','XLK','XLF','XLY','XLC','XLV','XLE','XLP','XLI','XLB','XLU','XLRE','^VIX','^VVIX','DX-Y.NYB','DX=F'];
const sectorMap={
INTC:'SMH',AMBA:'SMH',SOXL:'SMH',PANW:'XLK',CRWD:'XLK',IONQ:'XLK',QBTS:'XLK',RGTI:'XLK',CMPS:'XLV',GHRS:'XLV',ATI:'XLI',PDD:'XLY',OKLO:'XLU',OUST:'XLK',EOSE:'XLI',IAI:'XLF',PYPL:'XLF',BMNR:'XLF',NVDA:'SMH',AMD:'SMH',AVGO:'SMH',MU:'SMH',AMAT:'SMH',TSM:'SMH',MSFT:'XLK',AAPL:'XLK',CRM:'XLK',ORCL:'XLK',PLTR:'XLK',GOOGL:'XLC',GOOG:'XLC',META:'XLC',NFLX:'XLC',AMZN:'XLY',TSLA:'XLY',LULU:'XLY',HD:'XLY',HOOD:'XLF',JPM:'XLF',BAC:'XLF',GS:'XLF',XOM:'XLE',CVX:'XLE',LLY:'XLV',UNH:'XLV',COST:'XLP',WMT:'XLP',CAT:'XLI',GE:'XLI',SLV:'SLV',GLD:'GLD',
HPE:'XLK',MRVL:'SMH',NOW:'XLK',CRDO:'SMH',APP:'XLC',ARM:'SMH',ASML:'SMH',QCOM:'SMH',TXN:'SMH',KLAC:'SMH',LRCX:'SMH',ADI:'SMH',SNPS:'XLK',CDNS:'XLK',ADBE:'XLK',UBER:'XLI',ABNB:'XLY',DASH:'XLY',SHOP:'XLK',MELI:'XLY',COIN:'XLF',MSTR:'XLK',SQ:'XLF',SOFI:'XLF',AFRM:'XLF',C:'XLF',WFC:'XLF',MS:'XLF',V:'XLF',MA:'XLF',AXP:'XLF',AXON:'XLI',RKLB:'XLI',ASTS:'XLC',LUNR:'XLI',TEM:'XLV',BBAI:'XLK',SOUN:'XLK',SMCI:'SMH',DELL:'XLK',HIMS:'XLV',CELH:'XLP',NKE:'XLY',SBUX:'XLY',TGT:'XLP',LOW:'XLY',BA:'XLI',RTX:'XLI',LMT:'XLI',ABBV:'XLV',MRK:'XLV',PFE:'XLV',AMGN:'XLV',GILD:'XLV',SPCX:'XLI',VCX:'XLK'};
let store={},derived={},rankings=[],chosen='',mode='swing',snapshot=null,loading=false,universe=[];
function sma(a,p){let out=Array(a.length).fill(NaN),v=0;for(let i=0;i<a.length;i++){v+=a[i]||0;if(i>=p)v-=a[i-p]||0;if(i>=p-1)out[i]=v/p;}return out;}
function ema(a,p){let out=Array(a.length).fill(NaN),start=p-1;if(a.length<p)return out;let seed=0;for(let j=0;j<p;j++)seed+=a[j];out[start]=seed/p;const k=2/(p+1);for(let i=p;i<a.length;i++)out[i]=a[i]*k+out[i-1]*(1-k);return out;}
function rsi(a,p=14){let out=Array(a.length).fill(NaN);if(a.length<p+1)return out;let up=0,dn=0;for(let i=1;i<=p;i++){const d=a[i]-a[i-1];up+=Math.max(d,0);dn+=Math.max(-d,0);}up/=p;dn/=p;out[p]=dn===0?100:100-100/(1+up/dn);for(let i=p+1;i<a.length;i++){const d=a[i]-a[i-1];up=(up*(p-1)+Math.max(d,0))/p;dn=(dn*(p-1)+Math.max(-d,0))/p;out[i]=dn===0?100:100-100/(1+up/dn);}return out;}
function atr(rows,p=14){const tr=rows.map((b,i)=>i===0?b.h-b.l:Math.max(b.h-b.l,Math.abs(b.h-rows[i-1].c),Math.abs(b.l-rows[i-1].c)));let out=Array(rows.length).fill(NaN);if(rows.length<p)return out;let seed=0;for(let i=0;i<p;i++)seed+=tr[i];out[p-1]=seed/p;for(let i=p;i<rows.length;i++)out[i]=(out[i-1]*(p-1)+tr[i])/p;return out;}
function features(rows){const cl=rows.map(b=>b.c),vol=rows.map(b=>b.v),e12=ema(cl,12),e26=ema(cl,26),m=e12.map((x,i)=>Number.isFinite(e26[i])?x-e26[i]:NaN);let signal=Array(cl.length).fill(NaN),valid=m.map((x,i)=>({x,i})).filter(a=>Number.isFinite(a.x)),sub=ema(valid.map(x=>x.x),9);valid.forEach((v,j)=>signal[v.i]=sub[j]);return {rows,cl,dateSet:new Set(rows.map(b=>b.date)),e20:ema(cl,20),e50:ema(cl,50),e200:ema(cl,200),rsi:rsi(cl),atr:atr(rows),vma:sma(vol,20),macd:m.map((x,i)=>Number.isFinite(signal[i])?x-signal[i]:NaN)};}
function ret(cl,i,p){return i>=p?100*(cl[i]/cl[i-p]-1):NaN;}
function alignedPerf(a,i,b){if(!a||!b)return NaN;let end=a.rows[i].date, map=new Map(b.rows.map((r,j)=>[r.date,b.cl[j]]));let common=[];for(let j=i;j>=0&&common.length<21;j--)if(map.has(a.rows[j].date))common.push([a.cl[j],map.get(a.rows[j].date)]);if(common.length<21)return NaN;return 100*(common[0][0]/common[20][0]-common[0][1]/common[20][1]);}
function regimeAt(f,date){if(!f)return 'UNVERIFIED';let i=f.rows.findLastIndex?f.rows.findLastIndex(r=>r.date<=date):-1;if(i<0){for(let j=f.rows.length-1;j>=0;j--)if(f.rows[j].date<=date){i=j;break;}}if(i<200)return 'UNVERIFIED';let c=f.cl[i],e50=f.e50[i],e200=f.e200[i];return c>e50&&e50>e200?'BULL':c<e50&&e50<e200?'BEAR':'MIXED';}
function evaluate(t,i,side){const f=derived[t], r=f.rows[i], c=r.c, vma=f.vma[i];if(!Number.isFinite(f.e200[i])||!Number.isFinite(f.atr[i])||i<205)return null;const sg=side==='LONG'?1:-1, up=sg===1, trend=up?c>f.e20[i]&&f.e20[i]>f.e50[i]&&f.e50[i]>f.e200[i]:c<f.e20[i]&&f.e20[i]<f.e50[i]&&f.e50[i]<f.e200[i], slope=sg*(f.e20[i]-f.e20[i-5])>0;
const rsiVal=f.rsi[i], macd=sg*f.macd[i], r20=sg*ret(f.cl,i,20), rsRaw=alignedPerf(f,i,derived.SPY),rs=sg*rsRaw, sector=sectorMap[t], sectRaw=sector&&sector!==t?alignedPerf(f,i,derived[sector]):NaN,sect=sg*sectRaw,vol=vma>0?r.v/vma:NaN;
const breakoutPeriod=mode==='swing'?10:20;const prior=up?Math.max(...f.rows.slice(i-breakoutPeriod,i).map(a=>a.h)):Math.min(...f.rows.slice(i-breakoutPeriod,i).map(a=>a.l));const distance=up?100*(prior-c)/c:100*(c-prior)/c;const broken=up?c>prior:c<prior;const near=distance<=1.5&&distance>=-0.5;const range=Math.max(.0001,r.h-r.l),closePosition=up?(c-r.l)/range:(r.h-c)/range;const atrPct=100*f.atr[i]/c;
let comps={};comps.Trend=(sg*(c-f.e20[i])>0?5:0)+(sg*(f.e20[i]-f.e50[i])>0?8:0)+(sg*(f.e50[i]-f.e200[i])>0?8:0)+(slope?4:0);
comps.Momentum=((up?rsiVal>=52&&rsiVal<=68:rsiVal>=32&&rsiVal<=48)?8:(up?rsiVal>48&&rsiVal<76:rsiVal>24&&rsiVal<52)?4:0)+(macd>0?6:0)+(r20>0?6:0);
comps['Relative strength']=(Number.isFinite(rs)?(rs>3?12:rs>0?8:rs>-2?3:0):0)+(Number.isFinite(sect)?(sect>2?8:sect>0?5:0):0);
comps.Volume=(vol>=1.3?8:vol>=1.1?5:vol>=.95?3:0)+(closePosition>=.75?7:closePosition>=.60?4:0);
comps.Structure=broken?10:near?6:distance<=3&&distance>=0?3:0;
const extended=up?rsiVal>77:rsiVal<23;comps.Risk=(atrPct>=.8&&atrPct<=5?5:atrPct<=8?2:0)+(!extended?5:0);
const score=Object.values(comps).reduce((a,b)=>a+b,0), market=regimeAt(derived.SPY,r.date), matched=market===(up?'BULL':'BEAR');const liquidity=Number.isFinite(vol), enoughRS=Number.isFinite(rs),fresh=!!derived.SPY&&derived.SPY.dateSet.has(r.date)&&(i!==f.rows.length-1||derived.SPY.rows.at(-1).date===r.date);
const entry=up?prior*1.001:prior*.999;const low5=Math.min(...f.rows.slice(i-4,i+1).map(b=>b.l)),high5=Math.max(...f.rows.slice(i-4,i+1).map(b=>b.h));const stop=up?Math.min(entry-(mode==='swing'?1.8:2.5)*f.atr[i],low5):Math.max(entry+(mode==='swing'?1.8:2.5)*f.atr[i],high5);const risk=Math.abs(entry-stop),target=entry+sg*2*risk;const riskPct=100*risk/entry;const volumeOK=vol>=1.1;
const qualified=trend&&slope&&r20>0&&rs>0&&matched&&fresh&&liquidity&&volumeOK&&!extended&&riskPct<=(mode==='swing'?10:17)&&score>=75;
let status=qualified&&broken?'TRIGGER':trend&&near&&score>=65?'SETUP':score>=65?'WATCH':'AVOID';
if(!enoughRS||!fresh||market==='UNVERIFIED')status='UNVERIFIED';
let reasons=[];if(!trend)reasons.push('EMA stack not aligned');else reasons.push('EMA 20/50/200 aligned');if(!Number.isFinite(rs))reasons.push('Need aligned SPY history for RS');else if(rs>0)reasons.push('Outperforming SPY');else reasons.push('Relative strength lagging SPY');if(matched)reasons.push('SPY regime confirms direction');else reasons.push('SPY regime does not confirm');if(broken)reasons.push('Closed through prior '+breakoutPeriod+'-day level');else if(near)reasons.push('Within 1.5% of breakout');else reasons.push('Breakout is not near');if(!volumeOK)reasons.push('Relative volume below 1.1×');if(extended)reasons.push('RSI is stretched');if(riskPct>(mode==='swing'?10:17))reasons.push('Stop distance too wide');
return{ticker:t,side,score,status,date:r.date,c,comps,rs:rsRaw,sectorRs:sectRaw,vol,entry,stop,target,riskPct,atrPct,market,reasons,broken,rsConfirmed:enoughRS,closePosition,trend,qualified,prior};}

// Chaikin Money Flow is only a price/volume pressure proxy, not actual fund flow.
function cmf20(rows,i=rows.length-1){
  if(i<19)return NaN;
  let weighted=0,total=0;
  for(let j=i-19;j<=i;j++){
    const r=rows[j],range=r.h-r.l;
    weighted+=(range>0?(2*r.c-r.h-r.l)/range:0)*r.v;
    total+=r.v;
  }
  return total?weighted/total:NaN;
}
function oneDay(f,i=f.cl.length-1){return i>0?100*(f.cl[i]/f.cl[i-1]-1):NaN;}
function daysSinceTrigger(t,side,i){
  const f=derived[t];
  for(let j=i;j>=Math.max(205,i-35);j--){
    const r=evaluate(t,j,side);
    if(r && r.status==='TRIGGER')return {bars:i-j,priceReturn:100*(f.cl[i]/f.cl[j]-1),date:f.rows[j].date};
  }
  return null;
}
function computeRows(){
  rankings=[];
  for(const ticker of universe){
    const f=derived[ticker];
    if(!f||f.rows.length<210)continue;
    const i=f.rows.length-1;
    const L=evaluate(ticker,i,'LONG'),S=evaluate(ticker,i,'SHORT');
    if(!L||!S)continue;
    const best=L.score>=S.score?L:S;
    const priorL=evaluate(ticker,i-1,'LONG'),priorS=evaluate(ticker,i-1,'SHORT');
    const prev=priorL&&priorS?(priorL.score>=priorS.score?priorL:priorS):null;
    const flow=cmf20(f.rows,i);
    const sector=sectorMap[ticker]||'—';
    const sectorInfo=derived[sector];
    let sectorLeader=Number.isFinite(sectorInfo?alignedPerf(sectorInfo,sectorInfo.rows.length-1,derived.SPY):NaN)
      ?alignedPerf(sectorInfo,sectorInfo.rows.length-1,derived.SPY):NaN;
    const signal=daysSinceTrigger(ticker,best.side,i);
    rankings.push({...best,priorLabel:prev?prev.side+' '+prev.score:'—',flow,
      sector,sectorLeader,oneDay:oneDay(f),signal});
  }
  rankings.sort((a,b)=>b.score-a.score || a.ticker.localeCompare(b.ticker));
  if(!rankings.find(r=>r.ticker===chosen))chosen=rankings[0]?.ticker||'';
}
function price(s){return fmt(s,2);}
function attrClass(x){return Number.isFinite(x)?(x>=0?'green':'red'):'muted';}
function svgSpark(f,big=false){
  if(!f)return '';
  const a=f.cl.slice(-(big?80:30)),w=640,h=big?120:40,pad=5,lo=Math.min(...a),hi=Math.max(...a);
  const d=a.map((v,i)=>(i?'L':'M')+fmt(pad+i*(w-2*pad)/(a.length-1),1)+','+fmt(h-pad-(v-lo)/(hi-lo||1)*(h-2*pad),1)).join(' ');
  const color=a.at(-1)>=a[0]?'#63e0ae':'#ff8996';
  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Price history"><path d="${d}" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
}
function macroCard(id,ticker,label){
  const f=derived[ticker];
  const el=$(id);
  if(!f){el.innerHTML=`<div class="macro-label">${label}</div><div class="macro-price muted">—</div><div class="macro-note">Source unavailable for this scan</div>`;return;}
  const c=f.cl.at(-1),move=oneDay(f),regime=regimeAt(f,f.rows.at(-1).date);
  let bias=regime==='BULL'?'BULLISH BIAS':regime==='BEAR'?'BEARISH BIAS':'NO CLEAR BIAS';
  let note=regime==='BULL'?'Close > EMA50 > EMA200':regime==='BEAR'?'Close < EMA50 < EMA200':'Trend mixed · be selective';
  if(ticker==='QQQ'&&derived.SPY){const rs=alignedPerf(f,f.rows.length-1,derived.SPY);note+=` · 20D vs SPY ${pct(rs)}`;}
  el.innerHTML=`<div class="macro-label">${label}</div><div class="macro-price">${price(c)} <span class="${attrClass(move)}">${pct(move)}</span></div><div class="macro-bias ${regime==='BULL'?'green':regime==='BEAR'?'red':'gold'}">${bias}</div><div class="macro-note">${esc(note)}</div>`;
}
function riskCard(id,symbol,label,type){
  const f=derived[symbol],el=$(id);
  if(!f){el.innerHTML=`<div class="macro-label">${label}</div><div class="macro-price muted">—</div><div class="macro-note">Unavailable; do not infer risk tone</div>`;return;}
  const c=f.cl.at(-1),change=oneDay(f),e20=f.e20.at(-1),e50=f.e50.at(-1);
  let tone='',note='',toneClass='gold';
  if(type==='VIX'){
    const rising=Number.isFinite(e20)&&c>e20;
    tone=c>=30?'HIGH RISK':c>=20?'ELEVATED VOL':'RELATIVELY CALM';
    toneClass=c>=30?'red':c>=20?'gold':'green';
    note=(rising?'Above':'At/below')+' 20D average · volatility '+(change>0?'increased':'declined')+' today';
  }else if(type==='VVIX'){
    tone=c>=115?'VOL-OF-VOL ELEVATED':c>=95?'CAUTION':'RELATIVELY CALM';
    toneClass=c>=115?'red':c>=95?'gold':'green';
    note='Heuristic risk band · changes can amplify gaps';
  }else{
    tone=Number.isFinite(e20)&&c>e20?'USD STRENGTH':'USD NOT CONFIRMED';
    toneClass=c>e20&&c>e50?'gold':'green';
    note=(snapshot?.meta?.dxy_is_futures_proxy?'DX futures proxy · ':'DXY index · ')+(Number.isFinite(e50)?(c>e50?'above':'below')+' 50D average':'trend unverified');
  }
  el.innerHTML=`<div class="macro-label">${label}</div><div class="macro-price">${price(c)} <span class="${attrClass(change)}">${pct(change)}</span></div><div class="macro-bias ${toneClass}">${tone}</div><div class="macro-note">${esc(note)}</div>`;
}
function renderMacro(){
  macroCard('spyCard','SPY','SPY · Broad market');
  macroCard('qqqCard','QQQ','QQQ · Growth / tech');
  riskCard('vixCard','^VIX','VIX · Volatility','VIX');
  riskCard('vvixCard','^VVIX','VVIX · Vol-of-vol','VVIX');
  riskCard('dxyCard',snapshot?.meta?.dxy_symbol||'DX-Y.NYB','DXY · US dollar','DXY');
}
function renderHeader(){
  const m=snapshot?.meta||{},date=m.data_date;
  const ok=!!derived.SPY && date && Object.keys(derived).length>=1;
  $('asOf').textContent=date||'—';
  $('generatedAt').textContent=m.generated_at_utc?'Snapshot generated '+new Date(m.generated_at_utc).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'})+' ET':'Snapshot not generated';
  const age=date?Math.max(0,Math.floor((Date.now()-new Date(date+'T23:59:00Z').getTime())/86400000)):999;
  const freshness=ok?(age>4?'Older market snapshot':'Daily snapshot ready'):'No completed scan yet';
  const pill=$('dataPill');pill.className='data-pill'+(ok?(age>4?' stale':' fresh'):'');pill.innerHTML=`<i></i> ${esc(freshness)}`;
  const errorCount=(m.missing_symbols||[]).length,lagCount=(m.lagging_symbols||[]).length;
  let msg=ok?`Daily bars as of <b>${esc(date)}</b> · ${m.total_downloaded||0}/${m.total_requested||0} instruments downloaded. Refresh Scan re-reads this published snapshot; the nightly job collects new closing prices.`
    :'No daily snapshot published yet. Deploy this site and run the GitHub Actions scan to load prices. No example or fabricated quotes are shown.';
  if(errorCount||lagCount)msg+=` <b>${errorCount} unavailable</b>, <b>${lagCount} lagging</b> (excluded from confirmed signals).`;
  if(errorCount)msg+=' Missing: '+esc((m.missing_symbols||[]).join(', '))+'.';
  if(lagCount)msg+=' Lagging: '+esc((m.lagging_symbols||[]).join(', '))+'.';
  if(snapshot.scanStatus?.status==='failed')msg+=' <b>Latest scan FAILED:</b> '+esc(snapshot.scanStatus.error)+' · attempted '+esc(snapshot.scanStatus.attempted_at_utc)+'. Last good data retained.';
  if(age>4&&ok)msg+=' <b>Data may be stale — verify before trading.</b>';
  const banner=$('dataStatus');banner.className='snapshot-status'+(age>4||!ok||errorCount?' warning':'');banner.innerHTML='<span class="status-icon">●</span> '+msg;
  $('kScreened').textContent=rankings.length||'—';$('kCoverage').textContent=`of ${m.stock_universe||universe.length} configured`;
  $('kLong').textContent=rankings.filter(r=>r.side==='LONG'&&r.status==='TRIGGER').length;
  $('kShort').textContent=rankings.filter(r=>r.side==='SHORT'&&r.status==='TRIGGER').length;
  $('kSetups').textContent=rankings.filter(r=>r.status==='SETUP').length;
}
function rowHtml(r){
  const flowText=!Number.isFinite(r.flow)?'Unavailable':r.flow>=.08?'Buying':r.flow<=-.08?'Selling':'Neutral';
  const flowColor=r.flow>=.08?'green':r.flow<=-.08?'red':'muted';
  const sectorText=Number.isFinite(r.sectorLeader)?(r.sectorLeader>0?'Leading':'Lagging'):'No sector read';
  const upDown=r.side==='LONG'?1:-1;
  const since=r.signal, sinceDisplay=since?`<span class="${since.priceReturn*upDown>=0?'green':'red'}">${pct(since.priceReturn)}</span><div class="tiny">${since.bars} sessions</div>`:'<span class="muted">—</span>';
  return `<tr data-ticker="${esc(r.ticker)}" class="${chosen===r.ticker?'selected':''}">
  <td><div class="ticker">${esc(r.ticker)}</div><div class="tiny">${esc(r.sector)} · ${esc(sectorText)}</div></td>
  <td><span class="score-num">${r.score}</span><div class="tiny">Prev ${esc(r.priorLabel)}</div><div class="score-meter"><i style="width:${r.score}%"></i></div></td>
  <td><span class="state ${r.status}">${r.status}</span></td>
  <td><div class="${flowColor}">${flowText}</div><div class="tiny">CMF ${fmt(r.flow,2)}</div></td>
  <td class="${attrClass(r.rs)}">${pct(r.rs)}<div class="tiny">Sector ${pct(r.sectorRs)}</div></td>
  <td class="${attrClass(r.oneDay)}">${pct(r.oneDay)}</td>
  <td>${sinceDisplay}</td><td><b>$${price(r.entry)}</b><div class="tiny">Close $${price(r.c)}</div></td></tr>`;
}
function filtered(){
  const query=$('search').value.trim().toUpperCase(),status=$('statusFilter').value,min=+ $('scoreFilter').value;
  return rankings.filter(r=>r.score>=min && (status==='all'||r.status===status) && (!query||r.ticker.includes(query)));
}
function renderTables(){
  const rows=filtered();
  for(const side of ['LONG','SHORT']){
    const list=rows.filter(r=>r.side===side);
    $(side==='LONG'?'longCount':'shortCount').textContent=`${list.length} stocks`;
    $(side==='LONG'?'longRows':'shortRows').innerHTML=list.length?list.map(rowHtml).join(''):
      '<tr><td colspan="8" class="empty">No matching candidates. Try lowering the minimum score or widening your filters.</td></tr>';
  }
  document.querySelectorAll('tr[data-ticker]').forEach(row=>row.addEventListener('click',()=>{chosen=row.dataset.ticker;renderTables();renderDetail();}));
}
function renderDetail(){
  const r=rankings.find(v=>v.ticker===chosen);
  if(!r){$('detailTitle').textContent='Choose a stock from either table';$('detailState').textContent='No selection';$('detailBody').innerHTML='<div class="empty roomy">No research candidate is available yet.</div>';return;}
  $('detailTitle').textContent=`${r.ticker} · ${r.side} review`;
  $('detailState').textContent=`${r.status} · ${r.score}/100`;
  const maxes={Trend:25,Momentum:20,'Relative strength':20,Volume:15,Structure:10,Risk:10};
  $('detailBody').innerHTML=`<div class="detail-top"><div><h4>$${price(r.c)} <span class="${attrClass(r.oneDay)}" style="font-size:14px">${pct(r.oneDay)}</span></h4><p>Daily closing bar ${esc(r.date)} · ${r.side} · ${r.sector} · SPY market ${r.market}</p></div><a class="button subtle" target="_blank" rel="noopener" href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(r.ticker)}">Chart ↗</a></div>
    ${svgSpark(derived[r.ticker],true)}
    <div class="fact-grid"><div class="fact"><span>Breakout entry</span><b>$${price(r.entry)}</b></div><div class="fact"><span>Protective stop</span><b>$${price(r.stop)}</b></div><div class="fact"><span>2R target</span><b>$${price(r.target)}</b></div><div class="fact"><span>Stop distance</span><b>${pct(r.riskPct)}</b></div><div class="fact"><span>20D RS vs SPY</span><b class="${attrClass(r.rs)}">${pct(r.rs)}</b></div><div class="fact"><span>20D RS vs sector</span><b class="${attrClass(r.sectorRs)}">${pct(r.sectorRs)}</b></div><div class="fact"><span>20D CMF</span><b>${fmt(r.flow,2)}</b></div><div class="fact"><span>Volume / 20D</span><b>${fmt(r.vol,2)}×</b></div></div>
    <div class="rule"></div><div class="eyebrow">SIX-FACTOR QUALITY BREAKDOWN</div><div class="factor-grid">${Object.entries(r.comps).map(([k,v])=>`<div class="factor-row"><div class="factor-label"><span>${esc(k)}</span><strong>${v}/${maxes[k]}</strong></div><div class="factor-bar"><i style="width:${Math.round(100*v/maxes[k])}%"></i></div></div>`).join('')}</div><div class="rule"></div><div class="eyebrow">GATES & CONFLICTS</div><ul class="detail-reasons">${r.reasons.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
    <p class="test-result">${r.status==='TRIGGER'?'Confirmed close-level signal. Entry, stop and target are screening levels only — no order is placed.':r.status==='UNVERIFIED'?'Unverified: SPY data missing or bar not synchronized. No trade signal can be confirmed.':'Not a confirmed trade. Use the setup as a watchlist candidate, not an entry instruction.'}</p>`;
}
function render(){renderHeader();renderMacro();renderTables();renderDetail();if(typeof window!=='undefined' && window.renderRotation)window.renderRotation();}
async function loadSnapshot(){
  if(loading)return;
  loading=true;
  $('refreshBtn').disabled=true;
  $('refreshBtn').textContent='↻ Loading…';
  try{
    const response=await fetch('data/market.json?refresh='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(!data||!data.meta||!data.symbols)throw Error('Unexpected snapshot format');
    try { const sr=await fetch('data/scan-status.json?refresh='+Date.now(),{cache:'no-store'}); if(sr.ok)data.scanStatus=await sr.json(); } catch(e){ data.scanStatus={status:'unknown'}; }
    snapshot=data;
    store=data.symbols;
    universe=Array.isArray(data.watchlist)?data.watchlist.filter(t=>!BENCHMARKS.includes(t)):Object.keys(store).filter(t=>!BENCHMARKS.includes(t));
    derived={};
    for(const [ticker,rows] of Object.entries(store))if(Array.isArray(rows)&&rows.length>=30){
      const sorted=rows.slice().sort((a,b)=>a.date.localeCompare(b.date));
      derived[ticker]=features(sorted);
    }
    computeRows();render();
    $('backtestResult').textContent='Historical bars loaded. Select Run historical test to estimate past performance under simplified next-open fills.';
  }catch(e){
    if(!snapshot){$('dataStatus').className='snapshot-status warning';$('dataStatus').textContent='Snapshot could not be loaded: '+e.message+'. Run the GitHub Actions workflow after deploying the site. No quotes or signals are fabricated.';}
    else $('dataStatus').textContent='Refresh failed: '+e.message+'. Showing the previous saved snapshot.';
  }finally{loading=false;$('refreshBtn').disabled=false;$('refreshBtn').textContent='↻ Refresh scan';}
}
function runBacktest(){
  const panel=$('backtestResult');
  if(!derived.SPY || !rankings.length){panel.textContent='No verified market history yet. Run the nightly scan first.';return;}
  panel.textContent='Simulating historical close-confirmed signals…';
  setTimeout(()=>{
    const hold=10, trades=[];
    let tested=0;
    for(const t of universe){
      const f=derived[t];if(!f||f.rows.length<245)continue;
      tested++;
      const rows=f.rows;
      for(let i=Math.max(220,rows.length-260);i<rows.length-hold-1;i++){
        const long=evaluate(t,i,'LONG'),short=evaluate(t,i,'SHORT');
        const sig=long?.status==='TRIGGER'?long:short?.status==='TRIGGER'?short:null;
        if(!sig)continue;
        const entry=rows[i+1].o,sg=sig.side==='LONG'?1:-1,risk=sg*(entry-sig.stop);
        if(!(risk>0&&risk/entry<=.10))continue;
        const target=entry+sg*2*risk;
        let exitIndex=Math.min(rows.length-1,i+hold),exit=rows[exitIndex].c,reason='TIME';
        for(let j=i+1;j<=exitIndex;j++){
          const b=rows[j],hitStop=sg===1?b.l<=sig.stop:b.h>=sig.stop,hitTarget=sg===1?b.h>=target:b.l<=target;
          if(hitStop){exit=sig.stop;exitIndex=j;reason='STOP';break;}
          if(hitTarget){exit=target;exitIndex=j;reason='TARGET';break;}
        }
        trades.push({ticker:t,side:sig.side,signal:rows[i].date,r:sg*(exit-entry)/risk,reason,exitDate:rows[exitIndex].date});
        i=exitIndex; // no overlapping trades within a ticker
      }
    }
    if(!trades.length){panel.textContent=`${tested} stocks with enough history; no trades passed the strict historical rules in this lookback.`;return;}
    const wins=trades.filter(t=>t.r>0).length,avg=trades.reduce((n,t)=>n+t.r,0)/trades.length;
    let running=0,peak=0,maxDD=0;
    for(const t of [...trades].sort((a,b)=>a.exitDate.localeCompare(b.exitDate))){running+=t.r;peak=Math.max(running,peak);maxDD=Math.min(maxDD,running-peak);}
    panel.innerHTML=`<div class="test-grid"><div class="test-stat"><span>Historical trades</span><strong>${trades.length}</strong></div><div class="test-stat"><span>Win rate</span><strong>${fmt(100*wins/trades.length,1)}%</strong></div><div class="test-stat"><span>Mean trade</span><strong class="${attrClass(avg)}">${avg>=0?'+':''}${fmt(avg,2)}R</strong></div></div><div class="tiny">${tested} eligible stocks · cumulative gross R ${fmt(trades.reduce((a,t)=>a+t.r,0),1)} · approximate max gross R drawdown ${fmt(maxDD,1)}. No costs, no portfolio position sizing, adjusted OHLC. Survivorship bias and stale historical ticker universes can substantially distort these results.</div>`;
  },30);
}
function downloadCsv(){
  const lines=[['Ticker','Side','Score','Previous','Status','As-of','Sector','Sector 20D RS vs SPY','CMF20','RS vs SPY','RS vs Sector','1D change %','Days since trigger','Price since trigger %','Close','Entry','Stop','2R target','Risk %'].join(',')];
  for(const r of filtered()){
    const cols=[r.ticker,r.side,r.score,r.priorLabel,r.status,r.date,r.sector,fmt(r.sectorLeader,2),fmt(r.flow,3),fmt(r.rs,2),fmt(r.sectorRs,2),fmt(r.oneDay,2),r.signal?.bars??'',fmt(r.signal?.priceReturn,2),fmt(r.c),fmt(r.entry),fmt(r.stop),fmt(r.target),fmt(r.riskPct,1)];
    lines.push(cols.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(','));
  }
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='edgefinder-scan-'+(snapshot?.meta?.data_date||'unavailable')+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function copyTop(){
  const rows=filtered().slice(0,15);
  if(!rows.length)return;
  const lines=[`EDGEFINDER ${snapshot?.meta?.data_date||''} · AFTER-CLOSE RESEARCH`, ...rows.map(r=>`${r.ticker} ${r.side} ${r.status} ${r.score}/100 | entry ${price(r.entry)} | stop ${price(r.stop)} | 2R ${price(r.target)}`)];
  try{await navigator.clipboard.writeText(lines.join('\n'));$('copyBtn').textContent='Copied ✓';setTimeout(()=>$('copyBtn').textContent='Copy top picks',1600);}catch(e){$('copyBtn').textContent='Clipboard blocked';setTimeout(()=>$('copyBtn').textContent='Copy top picks',1600);}
}
$('refreshBtn').addEventListener('click',loadSnapshot);
$('backtestBtn').addEventListener('click',runBacktest);
$('copyBtn').addEventListener('click',copyTop);
$('exportBtn').addEventListener('click',downloadCsv);
for(const id of ['search','statusFilter','scoreFilter'])$(id).addEventListener(id==='search'?'input':'change',renderTables);
loadSnapshot();
