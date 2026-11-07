const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const code = fs.readFileSync(__dirname + '/app.js','utf8').replace(/  load\(\);\s*\}\)\(\);/,  '  globalThis.test = { load, render, preferences, get market() { return market; }, signal, pointPrice };\n})();');
class Element {
 constructor(){this.value='';this.textContent='';this.innerHTML='';this.handlers={};this.attrs={};this.classList={add(){},remove(){},toggle(){}};}
 addEventListener(name,fn){this.handlers[name]=fn;}
 setAttribute(k,v){this.attrs[k]=v;}
 querySelectorAll(){return [];}
}
const elements = new Map();
const document = { getElementById(id){if(!elements.has(id)) elements.set(id,new Element()); return elements.get(id);} };
const configs = [...code.matchAll(/^    \[(\d+), "([^"]+)", "([^"]+)", "([^"]*)"\],$/gm)].map(([,id,name,category,aliases]) => ({id:Number(id),name,category,aliases}));
const mapping = configs;
const now = Math.floor(Date.now()/1000);
let calls=0;
const context={document, console, Date, AbortSignal, localStorage:{getItem(){return '{"385":{"favorite":true,"quantity":100,"target":105}}';},setItem(k,v){this.value=v;}}, fetch:async url=>{
 calls++;
 if(url.endsWith('/mapping')) return {ok:true,json:async()=>mapping};
 if(url.endsWith('/latest')) return {ok:true,json:async()=>({data:Object.fromEntries(configs.map(x=>[x.id,{high:100,low:90,highTime:x.id===11212?now-7200:now,lowTime:now}]))})};
 const id=Number(url.split('id=')[1]);
 if(id===3144) throw new Error('isolated history failure');
 const count=id===24777?2:48;
 return {ok:true,json:async()=>({data:Array.from({length:count},(_,i)=>({timestamp:now-i*3600,avgHighPrice:id===29143?10000:120,avgLowPrice:id===29143?10000:100,highPriceVolume:10,lowPriceVolume:10}))})};
}};
vm.runInNewContext(code,context);
(async()=>{
 await context.test.load();
 assert.equal(context.test.market.length,78);
 assert.equal(elements.get('itemCount').textContent,'78 visible / 78 tracked');
 assert.equal(elements.get('overallPrice').textContent,'13.6% below normal','new outliers must not change the original basket');
 assert.equal(context.test.preferences.get(385).favorite,true);
 assert.equal(elements.get('buyTotal').textContent,'10,000 gp estimated · 1 supply');
 assert.match(elements.get('supplyRows').innerHTML,/Target reached/);
 assert.equal(context.test.market.find(x=>x.item.id===3144).signal.label,'Not enough data');
 assert.equal(context.test.market.find(x=>x.item.id===24777).signal.label,'Not enough data');
 assert.equal(context.test.market.find(x=>x.item.id===11212).buyStale,true);
 assert.equal(context.test.market.find(x=>x.item.id===11212).signal.label,'Not enough data');
 const before=calls;
 elements.get('supplySearch').value='ppot'; elements.get('supplySearch').handlers.input();
 assert.equal(elements.get('itemCount').textContent,'1 visible / 78 tracked');
 elements.get('categoryFilters').handlers.click({target:{closest:()=>({dataset:{category:'Food'}})}});
 assert.equal(elements.get('itemCount').textContent,'0 visible / 78 tracked');
 elements.get('clearFilters').handlers.click();
 elements.get('favoritesFilter').handlers.click();
 assert.equal(elements.get('itemCount').textContent,'1 visible / 78 tracked');
 assert.equal(calls,before,'filtering must not fetch');
 await context.test.load();
 // Failed history is retried, successful histories use the hour cache.
 assert.equal(calls-before,2);
 assert.equal(context.test.signal(NaN).label,'Not enough data');
 assert.ok(Number.isNaN(context.test.pointPrice({avgHighPrice:100,avgLowPrice:100,highPriceVolume:0,lowPriceVolume:0})));
 console.log('PASS: 78 mapped supplies; aliases; combined filters; favorites; saved totals; targets; stale buy quotes; thin/missing history; zero-volume prices; refresh cache; no search requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
