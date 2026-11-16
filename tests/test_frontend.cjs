const fs=require('fs'),vm=require('vm'),assert=require('assert');
const market=JSON.parse(fs.readFileSync(process.env.FIXTURE || 'data/market.json','utf8'));
class El {constructor(id){this.id=id;this.textContent='';this.innerHTML='';this.className='';this.value=id==='scoreFilter'?'0':id==='statusFilter'?'all':'';this.dataset={};this.disabled=false;this.handlers={};}addEventListener(name,fn){this.handlers[name]=fn;}}
const el={}; const get=id=>el[id]||(el[id]=new El(id));
const document={getElementById:get,querySelectorAll:()=>[],createElement:()=>({click(){},remove(){}}),body:{appendChild(){} }};
const ctx={document,window:{},console,Date,Math,Number,Array,Map,Set,JSON,Promise,setTimeout,clearTimeout,Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},fetch:async()=>({ok:true,json:async()=>market})};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('app.js','utf8'),ctx);
setTimeout(()=>{
 console.log('Snapshot:',get('asOf').textContent,'Stocks:',get('kScreened').textContent,'Long:',get('longCount').textContent,'Short:',get('shortCount').textContent);
 assert.equal(get('asOf').textContent,market.meta.data_date || '—');
 if(Object.keys(market.symbols||{}).length){assert.ok(+get('kScreened').textContent>=0);assert.ok(get('longRows').innerHTML.includes('<tr')||get('shortRows').innerHTML.includes('<tr'));} else assert.equal(get('kScreened').textContent,'—');
 assert.ok(get('dataStatus').innerHTML.includes('No daily snapshot published') || get('dataStatus').innerHTML.includes('Daily bars as of'));
 console.log('UI smoke test passed');
},700);
