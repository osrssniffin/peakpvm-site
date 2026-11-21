'use strict';
const CFG = window.SNIFFIN_CONFIG || {};
const $ = id => document.getElementById(id);
const live = { stats:null, pets:null, collection:null, categories:null, items:null, hours:null, meta:null };
const feedTimes = {};
let snapshotTime = null;
let currentFeedState = 'unavailable';
const FEED_KEYS = ['stats','pets','collection','categories','items','hours'];
const MISSING_SPRITE = 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect x="6" y="6" width="36" height="36" fill="#302a22" stroke="#8e7959" stroke-width="2"/><path d="M15 33L33 15M18 15l15 18" stroke="#a99373" stroke-width="3"/></svg>');
const categories = ['bosses','raids','clues','minigames','other'];
const titleCase = text => String(text||'').replaceAll('_',' ').replace(/\b[a-z]/g, m=>m.toUpperCase()).replace(/\bAnd\b/g,'and');
const niceName = str => ({the_fight_caves:'The Fight Caves',kril_tsutsaroth:"K'ril Tsutsaroth",kree_arra:"Kree'arra",the_gauntlet:'The Gauntlet',the_fractured_archive:'The Fractured Archive',thermonuclear_smoke_devil:'Thermonuclear smoke devil'})[str]||titleCase(str);
const norm = text => String(text||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const value = v => {const n=Number(v);return v!==null && v!==undefined && v!=='' && Number.isFinite(n)?n:null};
const format = n => n == null?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
const data = raw => raw?.data ?? raw ?? {};
const validResponse = (key,raw) => { const obj=data(raw); if(!isObj(obj))return false; if(key==='stats')return !!(obj.info || findKey(obj,['Overall_level','Overall','Attack','Ehb','Overall_rank'])!==null); if(key==='pets')return !!(isObj(obj.pets)||isObj(obj.Pets)||findKey(obj,['pet_count'])!==null); if(key==='collection')return !!(isObj(obj.items) && (findKey(obj,['last_checked','total_collections_available','total_collections_in_response','total_collections_finished'])!==null)); if(key==='categories')return Object.keys(obj).length>0; if(key==='items')return Object.keys(obj).length>0; if(key==='hours')return Object.keys(obj).length>0; return false; };
function noteFeed(key,raw,stamp,source){ if(!validResponse(key,raw))return false; const ts=Number.isFinite(Date.parse(stamp))?Date.parse(stamp):Date.now(); if(feedTimes[key]&&ts<feedTimes[key])return false; live[key]=raw;feedTimes[key]=ts;if(key==='stats')statsFeedSource=source;return true; }
const findKey = (obj, names) => {if(!obj || typeof obj!=='object')return null;for(const n of names){if(obj[n]!==undefined&&obj[n]!==null)return obj[n]}const target=names.map(norm);for(const [key,val] of Object.entries(obj)){if(target.includes(norm(key)) && val!==null)return val}return null};
const esc = s => String(s??'').replace(/[&<>"']/g, v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));
const isObj = x => x && typeof x==='object' && !Array.isArray(x);
const ENDPOINTS = {
 stats:`player_stats.php?player=${encodeURIComponent(CFG.PLAYER)}&bosses=1`,
 pets:`pets/pet_count.php?player=${encodeURIComponent(CFG.PLAYER)}`,
 collection:`collection-log/player_collection_log.php?player=${encodeURIComponent(CFG.PLAYER)}&includenames=1&includemissingitems=1`,
 categories:'collection-log/categories.php',items:'collection-log/items.php',hours:'pets/hours.php'
};
function set(id,v){if($(id))$(id).textContent=v}
function setStatus(message,kind='loading'){set('status',message);$('lamp').className='lamp '+(kind==='ok'?'ok':kind==='error'?'error':'')}
function cacheBust(){return `&_=${Date.now()}`}
async function getJSON(url){const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(16000),headers:{Accept:'application/json'}});if(!response.ok)throw Error(`${response.status} ${response.statusText}`);const json=await response.json();if(json?.error || json?.success === false)throw Error('Temple returned an API error');return json}
async function loadSnapshot(){try{const snap=await getJSON(CFG.SNAPSHOT_PATH+'?t='+Date.now());if(!isObj(snap)||snap.player && norm(snap.player)!==norm(CFG.PLAYER))throw Error('Wrong player snapshot');const obj=isObj(snap.results)?snap.results:snap;let loaded=0;const feedStamp=snap.feedUpdatedAt||{};for(const key of FEED_KEYS){if(obj[key] && noteFeed(key,obj[key],feedStamp[key]||snap.updatedAt||snap.updated_at||'1970-01-01T00:00:00Z','snapshot'))loaded++}snapshotTime=snap.updatedAt||snap.updated_at||null;live.meta=snapshotTime;return loaded}catch{return 0}}
function remoteURL(path){if(CFG.TEST_MODE && location.protocol==='file:') return `http://127.0.0.1:8765/api/${path}`;if(CFG.TEST_MODE) return `/api/${path}`;return `https://templeosrs.com/api/${path}`}
async function loadRemote(){const entries=await Promise.allSettled(Object.entries(ENDPOINTS).map(async ([key,path])=>{const obj=await getJSON(remoteURL(path)+(path.includes('?')?'&':'?')+'nocache='+Date.now());if(!noteFeed(key,obj,new Date().toISOString(),'live'))throw Error(key+' returned incomplete data');return key}));return {success:entries.filter(x=>x.status==='fulfilled').length,updated:entries.filter(x=>x.status==='fulfilled').map(x=>x.value),errors:entries.filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||x.reason))}}
let iconCache={};
async function loadIconMap(){if(window.SNIFFIN_EMBEDDED_ICON_MAP){iconCache=window.SNIFFIN_EMBEDDED_ICON_MAP;return}try{iconCache=await getJSON('./data/local-icon-map.json')}catch{iconCache={}}}
function wikiFile(name){return 'https://oldschool.runescape.wiki/Special:FilePath/'+encodeURIComponent(String(name||'').replaceAll(' ','_')+'.png')}
function iconCandidates(id,name){const options=[];const key=id==null?null:String(id);if(key&&iconCache[key])options.push(iconCache[key]);if(name&&iconCache[name])options.push(iconCache[name]);if(key)options.push('https://static.runelite.net/cache/item/icon/'+encodeURIComponent(key)+'.png');if(name)options.push(wikiFile(name));return [...new Set(options)]}
function iconUrl(id,name){return iconCandidates(id,name)[0]||''}
function createIcon(id,name,cls=''){const img=document.createElement('img');img.className=cls;img.alt='';img.setAttribute('aria-label',name+' icon');img.loading='lazy';img.decoding='async';const urls=iconCandidates(id,name);let ix=0;img.addEventListener('error',()=>{if(++ix<urls.length){img.src=urls[ix];return;}img.src=MISSING_SPRITE;img.classList.add('error-icon');img.alt='';img.setAttribute('aria-label',name+' (image unavailable)')});if(urls.length)img.src=urls[0];else{img.classList.add('error-icon');img.src=MISSING_SPRITE}return img}
function extractStats(){const root=data(live.stats);const info=isObj(root.info)?root.info:root;const overall=isObj(root.Overall)?root.Overall:isObj(root.overall)?root.overall:{};
 const total=value(findKey(root,['Overall_level','Overall level','total_level','totalLevel']))??value(findKey(info,['Overall_level','total_level']))??value(findKey(overall,['level']));
 const rank=value(findKey(root,['Overall_rank','Overall rank','overallRank']))??value(findKey(info,['Overall_rank','overall_rank']))??value(findKey(overall,['rank']));
 set('total-level',total===null?'—':String(Math.trunc(total)));set('overall-rank',format(rank));
 const ehbKey=findKey(root,['Primary_ehb'])??findKey(info,['Primary_ehb']);let ehb=value(findKey(root,[String(ehbKey||'Ehb'),'Ehb','Main-EHB','Primary_EHB']))??value(findKey(info,[String(ehbKey||'Ehb'),'Ehb','Main-EHB']));if(isObj(ehbKey))ehb=value(findKey(ehbKey,['value','ehb']));set('ehb',format(ehb));
 const pets=data(live.pets);const actualPets=value(findKey(pets,['pet_count','Pet Count']));set('pet-count',format(actualPets));
 const collection=data(live.collection);const got=value(findKey(collection,['total_collections_in_response','total_collections_finished']));const totalItems=value(findKey(collection,['total_collections_available']));set('collection-total',`${format(got)} / ${format(totalItems)}`);set('log-count-title',`${format(got)}/${format(totalItems)}`);
 set('log-finished',format(value(findKey(collection,['total_categories_finished'])))+' categories complete');
 const logTime=value(findKey(collection,['last_checked']));if(logTime){const d=new Date(logTime<1e12?logTime*1000:logTime);if(Number.isFinite(d.getTime()))set('sync-time','Log last synced at Temple '+d.toLocaleString())}else if(snapshotTime){set('sync-time','Snapshot '+new Date(snapshotTime).toLocaleString())}
}
// Target editing is gated by PIN verification BEFORE any editable controls are shown.
// Static GitHub Pages mode: PIN is a UI convenience, not a security boundary.
// Shared backend mode: PIN is verified on the Worker and save requires a short-lived token.
const TARGET_STORAGE = 'sniffin:pet-target:v1';
let bossOptions = [], target = null, targetScope='browser', pendingTarget = null, editToken=null;
function selectedBoss(){return target || bossOptions.find(x=>x.id===(CFG.DEFAULT_TARGET||'sarachnis')) || bossOptions[0] || null}
function getSavedTarget(){try{return localStorage.getItem(TARGET_STORAGE)}catch{return null}}
function saveLocalTarget(id){try{localStorage.setItem(TARGET_STORAGE,id);return true}catch{return false}}
function sharedTargetUrl(){return String(CFG.TARGET_API_URL||'').replace(/\/$/,'')}
async function fetchSharedTarget(){const res=await fetch(sharedTargetUrl()+'/target',{cache:'no-store'});if(!res.ok)throw Error('Shared target unavailable');const obj=await res.json();return bossOptions.find(x=>x.id===obj.target)||null}
async function loadBosses(){try{if(Array.isArray(window.SNIFFIN_EMBEDDED_BOSSES)){bossOptions=window.SNIFFIN_EMBEDDED_BOSSES}else{const response=await fetch('./data/pet-bosses.json',{cache:'no-store'});if(!response.ok)throw Error('Boss list not available');bossOptions=await response.json()}if(!Array.isArray(bossOptions)||!bossOptions.length)throw Error('Empty boss list')}catch(ex){setStatus('Boss options unavailable: '+ex.message,'error');return}
 target=bossOptions.find(x=>x.id===getSavedTarget())||selectedBoss();targetScope='browser';
 if(sharedTargetUrl()){try{const remote=await fetchSharedTarget();target=remote||bossOptions.find(x=>x.id===CFG.DEFAULT_TARGET)||bossOptions[0];targetScope='shared'}catch{targetScope='shared offline';target=null;set('target-storage','Shared target unavailable (not editable offline)')}}
 hunt();if($('profile-dialog')?.open)renderProfile();}
function bossKC(boss){if(!boss||!live.stats)return null;const root=data(live.stats);const info=isObj(root.info)?root.info:root;const source=[root, info,root.bosses,root.Bosses,root.boss_kc,root.bossKC,root.stats,root.data].filter(isObj);
 const keys=[boss.kcKey,boss.name,...(boss.kcAliases||[])].filter(Boolean);
 for(const obj of source){for(const k of keys){const candidate=findKey(obj,[k,k.replaceAll(' ','_'),k+' kc',k+'_kc',k+'_kills']);if(isObj(candidate)){const n=value(findKey(candidate,['kc','count','kills','value']));if(n!==null)return n}else{const n=value(candidate);if(n!==null)return n}}}return null}
function parsedPetRate(raw){if(isObj(raw))return parsedPetRate(findKey(raw,['drop_rate','rate']));if(typeof raw==='number')return raw>=1?raw:raw>0?1/raw:null;const str=String(raw??'').replaceAll(',','').trim();const fract=str.match(/1\s*\/\s*(\d+(?:\.\d+)?)/);if(fract)return Number(fract[1]);const n=Number(str);return Number.isFinite(n)&&n>0?(n>=1?n:1/n):null}
function petRate(boss){if(!boss)return null;const explicit=parsedPetRate(boss.dropRate??boss.rate);if(explicit>1)return explicit;if(boss.ambiguousRate)return null;const matches=bossOptions.filter(option=>norm(option.pet)===norm(boss.pet));if(matches.length>1)return null;const root=data(live.hours);const entries=Array.isArray(root)?root:Object.entries(root);const targetKey=norm(boss.pet);for(const entry of entries){let key,r;if(Array.isArray(root)){key=entry?.pet_name||'';r=entry}else{key=entry[0];r=entry[1]}if(norm(key)===targetKey||norm(r?.pet_name)===targetKey){return parsedPetRate(findKey(r,['drop_rate','rate']))}}return null}
function petIcon(boss){const holder=$('hunt-icon');if(!boss)return;holder.style.visibility='visible';holder.alt=boss.pet;const urls=iconCandidates(boss.itemId??petItemId(boss.pet),boss.pet);let attempt=0;holder.onerror=()=>{if(++attempt<urls.length){holder.src=urls[attempt]}else{holder.src=MISSING_SPRITE;holder.classList.add('error-icon')}};holder.classList.remove('error-icon');if(urls.length)holder.src=urls[0]}
function hunt(){const boss=selectedBoss();if(!boss)return;const kc=bossKC(boss),rate=petRate(boss);set('target-name',boss.pet);set('target-source',boss.name+' · pet hunt');set('target-kc',format(kc));
 const usable=rate>1&&!boss.ambiguousRate;
 set('target-rate',usable?`1 / ${format(rate)}`:'—');set('target-ratio',kc!=null&&usable?`${format(kc)} / ${format(rate)}`:'—');
 set('ratio-detail',kc!=null&&usable?"Temple KC / the selected pet’s drop-rate denominator":boss.ambiguousRate?'Rate differs by mode, roll, or variant':'Live KC / target pet drop rate');
 set('target-chance',kc!=null&&usable?`${(-Math.expm1(kc*Math.log1p(-1/rate))*100).toFixed(1)}%`:'—');
 set('hunt-foot',boss.note||(usable?'Temple pet drop rate; cumulative odds assume independent, equal-rate attempts.':'No verified single rate for this variant.'));
 set('target-storage',targetScope==='shared'?'Shared across visitors':targetScope==='shared offline'?'Shared target unavailable':'Saved only in this browser');petIcon(boss)}
function renderBossOptions(){const select=$('target-select'),filter=norm($('target-search').value),active=pendingTarget||selectedBoss()?.id;select.replaceChildren();for(const boss of bossOptions){if(filter&&!norm(boss.name+' '+boss.pet).includes(filter))continue;const option=document.createElement('option');option.value=boss.id;option.textContent=`${boss.name} — ${boss.pet}`;option.selected=boss.id===active;select.append(option)}if(select.options.length&&!select.value)select.selectedIndex=0;describeBossOption()}
function describeBossOption(){const boss=bossOptions.find(x=>x.id===$('target-select').value);set('target-choice-details',boss?`${boss.pet} • ${boss.name}${boss.note?' • '+boss.note:''}`:'No matching pet bosses.')}
function showEditorStep(authorized){$('target-lock-step').hidden=authorized;$('target-edit-step').hidden=!authorized;$('target-save-actions').hidden=!authorized;set('target-dialog-title',authorized?'SELECT PET HUNT':'UNLOCK PET HUNT');if(authorized){$('target-search').value='';renderBossOptions();$('target-search').focus()}else{$('target-pin').value='';$('target-pin').focus()}}
function closeEditor(){const dialog=$('target-dialog');if(dialog.open)dialog.close();editToken=null;pendingTarget=null;showEditorStep(false);set('target-error','')}
function openEditor(){if(!bossOptions.length){setStatus('Boss list unavailable; refresh the page','error');return}if(targetScope==='shared offline'){setStatus('Shared target server unavailable; editing disabled','error');return}editToken=null;pendingTarget=selectedBoss()?.id;set('target-error','');showEditorStep(false);$('target-dialog').showModal();$('target-pin').focus()}
async function verifyPin(pin){if(!/^\d{4}$/.test(pin))throw Error('Enter the four-digit PIN.');if(sharedTargetUrl()){const res=await fetch(sharedTargetUrl()+'/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});if(!res.ok){if(res.status===401)throw Error('Incorrect PIN.');if(res.status===429)throw Error('Too many attempts. Try again later.');throw Error('Unlock failed ('+res.status+').')}const obj=await res.json();if(!obj.token)throw Error('Unlock response did not include a session.');return obj.token}
 // Static mode cannot secure the PIN against users inspecting public source.
 if(pin!=='7991')throw Error('Incorrect PIN.');return 'browser-unlocked'}
async function storeTarget(bossId){const obj=bossOptions.find(x=>x.id===bossId);if(!obj)throw Error('Select a listed boss.');if(!editToken)throw Error('Unlock the editor first.');
 if(sharedTargetUrl()){const res=await fetch(sharedTargetUrl()+'/target',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+editToken},body:JSON.stringify({target:bossId})});if(!res.ok)throw Error(res.status===401?'Unlock expired; close and enter PIN again.':'Could not save shared target ('+res.status+').');targetScope='shared'}else{if(editToken!=='browser-unlocked')throw Error('Unlock first.');if(!saveLocalTarget(bossId))throw Error('Browser storage is blocked.');targetScope='browser'}target=obj;hunt()}
function setupEditor(){$('edit-target').addEventListener('click',openEditor);$('close-target').addEventListener('click',closeEditor);$('cancel-target').addEventListener('click',closeEditor);$('target-select').addEventListener('change',()=>{pendingTarget=$('target-select').value;describeBossOption()});$('target-search').addEventListener('input',renderBossOptions);
 $('target-unlock-form').addEventListener('submit',async e=>{e.preventDefault();set('target-error','');const btn=$('unlock-target');btn.disabled=true;try{editToken=await verifyPin($('target-pin').value);showEditorStep(true)}catch(ex){editToken=null;set('target-error',ex.message||'Unlock failed')}finally{btn.disabled=false}});
 $('target-form').addEventListener('submit',async e=>{e.preventDefault();if(!editToken){showEditorStep(false);return}const id=$('target-select').value;if(!id){set('target-error','Select a boss.');return}const btn=$('save-target');btn.disabled=true;set('target-error','');try{await storeTarget(id);closeEditor()}catch(ex){set('target-error',ex.message||'Unable to save')}finally{btn.disabled=false}});
 $('target-dialog').addEventListener('cancel',e=>{e.preventDefault();closeEditor()});$('target-dialog').addEventListener('close',()=>{editToken=null});}
function itemIds(v){if(Array.isArray(v))return v.flatMap(x=>isObj(x)?itemIds(x):(/^\d+$/.test(String(x))?[String(x)]:[]));if(isObj(v)){if(v.id!=null||v.item_id!=null)return[String(v.id??v.item_id)];if(Array.isArray(v.items)||isObj(v.items))return itemIds(v.items);return Object.entries(v).flatMap(([k,item])=>{if(/^\d+$/.test(k))return[k];if(isObj(item)||Array.isArray(item))return itemIds(item);return []})}return []}
function mapItems(){let root=data(live.items);if(isObj(root.items))root=root.items;const map={};const walk=(obj)=>{if(Array.isArray(obj)){for(const v of obj)walk(v);return}if(!isObj(obj))return;const directId=obj.id??obj.item_id, directName=obj.name??obj.item_name;if(directId!=null&&directName)map[String(directId)]=String(directName);for(const [k,v] of Object.entries(obj)){if(typeof v==='string'&&/^\d+$/.test(k))map[k]=v;else if(isObj(v)){const id=findKey(v,['id','item_id']),name=findKey(v,['name','item_name']);if(id!=null&&name)map[String(id)]=String(name);else if(name&&/^\d+$/.test(k))map[k]=String(name);else walk(v)}}};walk(root);return map}
function categoryCatalog(){let root=data(live.categories);if(isObj(root.categories))root=root.categories;const out=Object.fromEntries(categories.map(c=>[c,{}]));
 const aliases={bosses:['bosses','boss'],raids:['raids','raid'],clues:['clues','clue_scrolls','clue'],minigames:['minigames','minigame'],other:['other','others']};
 for(const cat of categories){const match=Object.entries(root).find(([k])=>aliases[cat].includes(norm(k).replace(/(scrolls)?$/,'')))||Object.entries(root).find(([k])=>norm(k)===norm(cat));const rows=match?.[1]||{};const records=Array.isArray(rows)?rows.map((v,i)=>[v?.slug??v?.name??String(i),v]):Object.entries(rows);
 for(const [slug,v] of records){const ids=itemIds(v);if(ids.length)out[cat][slug]=[...new Set(ids)]}}
 return out}
function parseOwned(){const root=data(live.collection);const entries=root.items||{};const byId=new Map(),byName=new Map();const add=(key,v)=>{const rec=isObj(v)?v:{count:v};const id=rec.id??rec.item_id??(/^\d+$/.test(key)?key:null);const name=rec.name||rec.item_name||(!/^\d+$/.test(key)?key:null);const count=value(rec.count??rec.quantity??((typeof v==='number'||typeof v==='boolean')?Number(v):null));if(id!=null&&count!==null)byId.set(String(id),count);if(name&&count!==null)byName.set(norm(name),count)};
 const walk=(obj)=>{if(!isObj(obj))return;for(const [key,v] of Object.entries(obj)){if(isObj(v)&&('id'in v||'item_id'in v||'count'in v||'quantity'in v)){add(key,v)}else if(isObj(v))walk(v);else if(typeof v==='number'||typeof v==='boolean')add(key,v)}};walk(entries);
 return {byId,byName,valid:!!live.collection&&validResponse('collection',live.collection)};}
let catalog={},names={},owned={},tab='bosses',selected=null,query='';
function makeModel(){catalog=categoryCatalog();names=mapItems();owned=parseOwned(); if(!catalog[tab]||!Object.keys(catalog[tab]).length){tab=categories.find(c=>Object.keys(catalog[c]||{}).length)||'bosses'}if(!selected||!catalog[tab]?.[selected]) selected=Object.keys(catalog[tab]||{})[0]||null;renderTabs();renderEntries();renderDetail();}
function visible(){return Object.keys(catalog[tab]||{}).filter(slug=>{const matchesName=norm(niceName(slug)).includes(norm(query));const matchItems=(catalog[tab][slug]||[]).some(id=>norm(names[id]||'').includes(norm(query)));return !query||matchesName||matchItems})}
function obtained(ids){return ids.filter(id=>{const v=owned.byId.get(String(id))??owned.byName.get(norm(names[String(id)]));return v!=null&&v>0}).length}
function renderTabs(){const node=$('log-tabs');node.replaceChildren();for(const cat of categories){const button=document.createElement('button');button.type='button';button.textContent=titleCase(cat);button.className=tab===cat?'selected':'';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(tab===cat));button.onclick=()=>{tab=cat;selected=visible()[0]||Object.keys(catalog[tab]||{})[0]||null;renderTabs();renderEntries();renderDetail()};node.append(button)}}
function renderEntries(){const node=$('log-list');node.replaceChildren();const rows=visible();for(const slug of rows){const ids=catalog[tab][slug];const button=document.createElement('button');button.className=selected===slug?'selected':'';const span=document.createElement('span');span.textContent=niceName(slug);const small=document.createElement('small');small.textContent=owned.valid?`${obtained(ids)}/${ids.length}`:'—/'+ids.length;button.append(span,small);button.onclick=()=>{selected=slug;renderEntries();renderDetail()};node.append(button)}if(!rows.length)node.innerHTML='<div class="placeholder">No matching categories</div>'}
function renderDetail(){const ids=catalog[tab]?.[selected];const box=$('log-slots');box.replaceChildren();if(!ids){set('entry-name','No collection available');set('entry-obtained','Temple categories have not loaded');set('entry-kc','');set('entry-ratio','—');box.innerHTML='<div class="placeholder">No verified category data loaded. Use Refresh or local live test.</div>';return}
 set('entry-name',niceName(selected));set('entry-obtained',owned.valid?`Obtained: ${obtained(ids)}/${ids.length}`:`Obtained: —/${ids.length} (unsynced)`);set('entry-ratio',owned.valid?`${Math.round(obtained(ids)/Math.max(ids.length,1)*100)}%`:'—');const bossStats=data(live.stats);const kc= bossKC({name:niceName(selected),kcKey:selected,kcAliases:[selected.replaceAll('_',' ')]});set('entry-kc',kc===null?'':`Kills: ${format(kc)}`);
 for(const id of ids){const itemName=names[String(id)] || `Item ${id}`;const count=owned.byId.get(String(id))??owned.byName.get(norm(itemName));const slot=document.createElement('div');const confirmedMissing=owned.valid && !count;slot.className='slot'+(confirmedMissing?' missing':'');slot.title=itemName+(owned.valid?` · ${format(count||0)} recorded`:' · Not synced');const img=createIcon(id,itemName);slot.append(img);if(count>0){const qty=document.createElement('span');qty.className='qty';qty.textContent=format(count);slot.append(qty)}const label=document.createElement('span');label.className='item-label';label.textContent=itemName;slot.append(label);box.append(slot)}set('log-footer-msg',`${Object.values(catalog[tab]||{}).length} categories · ${tab.toUpperCase()} · Temple catalog`)}
function petItemId(name){const alias={scorpia:'scorpiasoffspring',zulrah:'petsnakeling',snakeling:'petsnakeling',chaoselemental:'petchaoselemental',brutus:'brutus',araxxor:'nid'};const key=alias[norm(name)]||norm(name);const ids=catalog.other?.all_pets||[];for(const id of ids){const nm=norm(names[id]);if(nm===key||nm==='pet'+key||key==='pet'+nm)return id}return null}
function renderPets(){const root=data(live.pets);const pets=root.pets||root.Pets||{};const box=$('pet-grid');box.replaceChildren();let list=Object.entries(pets).filter(([,v])=>v===true || v===1 || v==='1' || (isObj(v)&&Number(v.owned??v.count)===1)).map(([name])=>name);if(!live.pets){box.innerHTML='<div class="placeholder">Pet ownership unavailable. No unverified pets are displayed.</div>';set('pet-summary','TEMPLE NOT CONNECTED');return}set('pet-summary',`${list.length} REGISTERED · TEMPLE`);if(!list.length){box.innerHTML='<div class="placeholder">No owned pets returned by Temple.</div>';return}
 for(const raw of list){const name=titleCase(raw);const card=document.createElement('article');card.className='pet-card';const img=createIcon(petItemId(name),name);card.append(img);const title=document.createElement('strong');title.textContent=name;const badge=document.createElement('small');badge.textContent='OBTAINED';card.append(title,badge);box.append(card)}}

// Live condensed account viewer. This reads the same verified Temple snapshot/live feeds as the rest of the profile.
const SKILL_ORDER=['Attack','Hitpoints','Mining','Strength','Agility','Smithing','Defence','Herblore','Fishing','Ranged','Thieving','Cooking','Prayer','Crafting','Firemaking','Magic','Fletching','Woodcutting','Runecraft','Slayer','Farming','Construction','Hunter','Sailing'];
let profileSearch='';
let statsFeedSource='unavailable';
function virtualLevel(xp){
 if(xp==null||xp<0)return null;
 let points=0,threshold=0,level=1;
 for(let n=1;n<=125;n++){
  points+=Math.floor(n+300*Math.pow(2,n/7));threshold=Math.floor(points/4);
  if(xp>=threshold)level=n+1;else break;
 }
 return level;
}
function readSkillRecord(skill){
 if(!live.stats)return {level:null,xp:null};
 const root=data(live.stats);
 const sources=[root,root.skills,root.Skills,root.info?.skills,root.info,root.player?.skills].filter(isObj);
 let level=null,xp=null;
 for(const source of sources){
   const record=findKey(source,[skill]);
   if(isObj(record)){
     level??=value(findKey(record,['level','lvl','virtual_level']));
     xp??=value(findKey(record,['xp','experience','exp']));
   }else if(record!==null && record!==undefined){
     const n=value(record);
     // Temple's flat skill fields usually contain XP, not levels.
     if(n!==null)xp??=n;
   }
   level??=value(findKey(source,[skill+'_level',skill+' level',skill+'_lvl']));
   xp??=value(findKey(source,[skill+'_xp',skill+'_experience',skill+' xp',skill+' experience']));
 }
 const virtual=xp!==null?virtualLevel(xp):null;
 return {level:level===null?(virtual===null?null:Math.min(virtual,99)):Math.floor(level),xp};
}
function skillLevel(skill){return readSkillRecord(skill).level}
function wikiIcon(name){return 'https://oldschool.runescape.wiki/Special:FilePath/'+encodeURIComponent(name.replaceAll(' ','_')+' icon.png')}
function statsIcon(name,kind){
 const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';
 if(kind==='skill'){
   img.src=window.SNIFFIN_SKILL_ICONS?.[norm(name)] || './assets/skill-icons/'+name.toLowerCase()+'.png';
   img.onerror=()=>{img.onerror=null;img.src=MISSING_SPRITE;img.classList.add('error-icon')};
 }else{
   const boss=bossOptions.find(b=>norm(b.name)===norm(name));
   // Prefer actual game item sprites where a reliable item ID exists.
   const itemId=boss?.itemId;
   img.src=itemId ? iconUrl(itemId,boss.pet) : wikiIcon(boss?.pet||name);
   img.onerror=()=>{img.onerror=null;img.src=MISSING_SPRITE;img.classList.add('error-icon')};
 }
 return img;
}
function collectBossKC(){
 const result=new Map();
 // Include all configured pet bosses plus any extra boss KC entries supplied by Temple.
 for(const boss of bossOptions){const kc=bossKC(boss);if(kc!==null){const name=boss.name;const key=norm(name);if(!result.has(key))result.set(key,{name,kc});}}
 const root=data(live.stats);
 const sub=[root.bosses,root.Bosses,root.boss_kc,root.bossKC,root.info?.bosses,root.info?.Bosses].filter(isObj);
 for(const container of sub){for(const [key,raw] of Object.entries(container)){
  const kc=isObj(raw)?value(findKey(raw,['kc','kills','count','value','score'])):value(raw);
  if(kc===null||kc<0)continue;
  const name=niceName(key),normalized=norm(name);
  if(!result.has(normalized))result.set(normalized,{name,kc});
 }}
 // Temple player_stats commonly exposes boss KC directly as top-level values.
 const skip=new Set([...SKILL_ORDER.map(norm),'overall','ehp','ehb','date','info']);
 for(const [key,raw] of Object.entries(root)){
  if(skip.has(norm(key))||/_rank$|_level$|_ehp$|_ehb$|_xp$|_experience$/i.test(key))continue;
  const known=bossOptions.find(b=>[b.kcKey,b.name,...(b.kcAliases||[])].filter(Boolean).some(k=>norm(k)===norm(key)));
  if(!known && !(root[key+'_rank']!==undefined || root[key+' rank']!==undefined))continue;
  const kc=isObj(raw)?value(findKey(raw,['kc','kills','count','value'])):value(raw);
  if(kc!==null){const nm=known?.name||niceName(key);if(!result.has(norm(nm)))result.set(norm(nm),{name:nm,kc});}
 }
 return [...result.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function renderProfile(){
 const skillRoot=$('profile-skills'),bossRoot=$('profile-bosses');if(!skillRoot||!bossRoot)return;
 skillRoot.replaceChildren();bossRoot.replaceChildren();
 const skills=SKILL_ORDER.map(name=>({name,...readSkillRecord(name)}));
 for(const skill of skills){const cell=document.createElement('div');cell.className='profile-skill';cell.title=skill.name+' — '+(skill.xp===null?'XP unavailable from Temple':Math.trunc(skill.xp).toLocaleString('en-US')+' XP');cell.setAttribute('aria-label',cell.title);cell.append(statsIcon(skill.name,'skill'));const lev=document.createElement('span');lev.className='profile-val';lev.textContent=skill.level===null?'—':String(skill.level);cell.append(lev);skillRoot.append(cell)}
 $('profile-skill-summary').textContent=skills.filter(s=>s.level!==null).length+'/'+skills.length+' LIVE';
 const list=collectBossKC().filter(b=>norm(b.name).includes(norm(profileSearch)));
 $('profile-boss-summary').textContent=list.length+' KC RECORDS';
 if(!list.length){const msg=document.createElement('div');msg.className='profile-empty';msg.textContent=live.stats?(profileSearch?'No matching bosses':'No boss KC supplied by Temple'):'Temple statistics unavailable';bossRoot.append(msg)}
 else for(const boss of list){const cell=document.createElement('div');cell.className='profile-boss';cell.title=boss.name+' · '+format(boss.kc)+' KC';cell.append(statsIcon(boss.name,'boss'));const label=document.createElement('span');label.className='profile-boss-name';label.textContent=boss.name;const amount=document.createElement('span');amount.className='profile-val';amount.textContent=format(boss.kc);cell.append(label,amount);bossRoot.append(cell)}
 $('profile-data-status').textContent=!live.stats?'TempleOSRS has not returned player statistics':statsFeedSource==='live'?'Live TempleOSRS player statistics':statsFeedSource==='snapshot'?'Latest saved TempleOSRS snapshot (may be delayed)':'Latest available TempleOSRS records';
}
function setupProfile(){
 for(const button of document.querySelectorAll('.profile-open'))button.addEventListener('click',()=>{profileSearch='';$('profile-boss-query').value='';renderProfile();$('profile-dialog').showModal()});
 $('close-profile').addEventListener('click',()=>$('profile-dialog').close());
 $('profile-boss-query').addEventListener('input',e=>{profileSearch=e.target.value;renderProfile()});
 $('profile-dialog').addEventListener('click',e=>{if(e.target===$('profile-dialog'))$('profile-dialog').close()});
}

let loading=false;
async function refresh(){
 if(loading)return;loading=true;$('refresh').disabled=true;setStatus('Checking TempleOSRS…');
 try{
   const count=await loadSnapshot();
   extractStats();makeModel();hunt();renderPets();
   const result=CFG.DIRECT_TEMPLE?await loadRemote():{success:0,updated:[],errors:[]};
   extractStats();makeModel();hunt();renderPets();if($('profile-dialog')?.open)renderProfile();
   const loaded=FEED_KEYS.filter(k=>live[k]).length;
   const timestamp=Math.max(0,...Object.values(feedTimes));
   const age=timestamp?Date.now()-timestamp:Infinity;
   const freshness=age>24*3600*1000?' · snapshot older than 24 hours':age>2*3600*1000?' · snapshot older than 2 hours':'';
   if(result.success===FEED_KEYS.length)setStatus('TempleOSRS live · 6/6 feeds updated','ok');
   else if(result.success>0)setStatus(`Temple live · ${result.success}/6 feeds refreshed · ${loaded}/6 available`,'ok');
   else if(loaded)setStatus(`Temple snapshot · ${loaded}/6 feeds available${freshness}`,age>24*3600*1000?'error':'ok');
   else setStatus('Temple unavailable · no valid saved data','error');
   if(snapshotTime&&!$('sync-time').textContent)set('sync-time','Snapshot '+new Date(snapshotTime).toLocaleString());
 }catch(err){setStatus('Unable to refresh · '+String(err.message||err),'error');}
 finally{$('refresh').disabled=false;loading=false;}
}
if(CFG.TEST_MODE){$('test-strip').hidden=false}
$('log-search').addEventListener('input',event=>{query=event.target.value.trim();selected=visible()[0]||null;renderEntries();renderDetail()});$('refresh').addEventListener('click',refresh);
setupEditor();setupProfile();Promise.allSettled([loadBosses(),loadIconMap()]).then(refresh);if(CFG.REFRESH_MS>0)setInterval(()=>{if(!document.hidden)refresh()},CFG.REFRESH_MS);
