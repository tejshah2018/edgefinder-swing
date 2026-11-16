'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const real=JSON.parse(fs.readFileSync('data/signal-history.json','utf8'));
class El{constructor(id){this.value=['historySide','historyState'].includes(id)?'all':'';this.handlers={};this.innerHTML='';this.textContent='';}addEventListener(e,fn){this.handlers[e]=fn;}}
const els={},get=id=>els[id]||(els[id]=new El(id));
const context=vm.createContext({document:{getElementById:get},console,Intl,Date,Number,Set,JSON,Math,Array,encodeURIComponent,setTimeout,URL,Blob,fetch:async(url)=>({ok:true,json:async()=>url.includes('history-status')?{status:'success'}:real})});
vm.runInContext(fs.readFileSync('history.js','utf8'),context);
setTimeout(()=>{assert.ok(get('historyStatus').textContent.includes(real.last_scan_session));assert.ok(get('historyStats').innerHTML.includes('completed'));assert.ok(!get('historyRows').innerHTML.includes('undefined'));get('historySide').value='SHORT';get('historySide').handlers.change();assert.ok(!get('historyRows').innerHTML.includes('>LONG<'));console.log('History UI: real journal renders, summaries and side filter pass');},100);
