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
const validResponse = (key,raw) => { const obj=data(raw); if(!isObj(obj)||raw?.error||raw?.success===false)return false; if(key==='stats'){const info=isObj(obj.info)?obj.info:{};const name=info.player_name_with_capitalization||info.Username||obj.player_name_with_capitalization||obj.player;const skills=['Attack','Hitpoints','Mining','Strength','Agility','Smithing','Defence','Herblore','Fishing','Ranged','Thieving','Cooking','Prayer','Crafting','Firemaking','Magic','Fletching','Woodcutting','Runecraft','Slayer','Farming','Construction','Hunter','Sailing'];const xp=skills.filter(k=>value(findKey(obj,[k,k+'_xp',k+'_experience']))!==null).length;return (!name||norm(name)===norm(CFG.PLAYER))&&value(findKey(obj,['Overall_level','total_level']))!==null&&value(findKey(obj,['Ehp','Main-EHP']))!==null&&value(findKey(obj,['Ehb','Main-EHB']))!==null&&xp>=23&&Object.keys(obj).some(k=>/_ehb$/i.test(k))} if(key==='pets')return normalizePetOwnership(raw).size>0; if(key==='collection')return collectionComplete(raw); if(key==='categories')return categoriesComplete(raw); if(key==='items')return Object.keys(itemNameMap(raw)).length>=1000; if(key==='hours')return Object.keys(obj).length>0; return false; };
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
async function loadRemote(){if(CFG.TEST_MODE){const entries=await Promise.allSettled(Object.entries(ENDPOINTS).map(async ([key,path])=>{const obj=await getJSON(remoteURL(path)+(path.includes('?')?'&':'?')+'nocache='+Date.now());if(!noteFeed(key,obj,new Date().toISOString(),'live'))throw Error(key+' returned incomplete data');return key}));return {success:entries.filter(x=>x.status==='fulfilled').length,updated:entries.filter(x=>x.status==='fulfilled').map(x=>x.value),errors:entries.filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||x.reason))}}if(!sharedTargetUrl())throw Error('Temple sync service is not configured');const snapshot=await getJSON(sharedTargetUrl()+'/live');if(snapshot.player&&norm(snapshot.player)!==norm(CFG.PLAYER))throw Error('Wrong player snapshot');const results=isObj(snapshot.results)?snapshot.results:snapshot,stamps=snapshot.feedUpdatedAt||{},updated=[];for(const key of FEED_KEYS)if(results[key]&&noteFeed(key,results[key],stamps[key]||snapshot.updatedAt||'1970-01-01T00:00:00Z','live'))updated.push(key);snapshotTime=snapshot.updatedAt||null;if(snapshotTime){const d=new Date(snapshotTime);if(Number.isFinite(d.getTime()))set('sync-time','Temple data last successfully synced '+d.toLocaleString())}return {success:Array.isArray(snapshot.refreshed)?snapshot.refreshed.length:updated.length,updated:Array.isArray(snapshot.refreshed)?snapshot.refreshed:updated,errors:[],stale:!!snapshot.stale}}
let iconCache={};
async function loadIconMap(){if(window.SNIFFIN_EMBEDDED_ICON_MAP){iconCache=window.SNIFFIN_EMBEDDED_ICON_MAP;return}try{iconCache=await getJSON('./data/local-icon-map.json')}catch{iconCache={}}}
function wikiFile(name){return 'https://oldschool.runescape.wiki/Special:FilePath/'+encodeURIComponent(String(name||'').replaceAll(' ','_')+'.png')}
function iconCandidates(id,name){const options=[];const key=id==null?null:String(id);if(key&&iconCache[key])options.push(iconCache[key]);if(key)options.push('https://static.runelite.net/cache/item/icon/'+encodeURIComponent(key)+'.png');const namedIcon=name&&iconCache[name];if(namedIcon&&!/\/legacy-\d+\.png(?:[?#]|$)/i.test(namedIcon))options.push(namedIcon);if(name)options.push(wikiFile(name));return [...new Set(options)]}
function iconUrl(id,name){return iconCandidates(id,name)[0]||''}
function createIcon(id,name,cls=''){const img=document.createElement('img');img.className=cls;img.alt='';img.setAttribute('aria-label',name+' icon');img.loading='lazy';img.decoding='async';const urls=iconCandidates(id,name);let ix=0;img.addEventListener('error',()=>{if(++ix<urls.length){img.src=urls[ix];return;}img.src=MISSING_SPRITE;img.classList.add('error-icon');img.alt='';img.setAttribute('aria-label',name+' (image unavailable)')});if(urls.length)img.src=urls[0];else{img.classList.add('error-icon');img.src=MISSING_SPRITE}return img}
function extractStats(){const root=data(live.stats);const info=isObj(root.info)?root.info:root;const overall=isObj(root.Overall)?root.Overall:isObj(root.overall)?root.overall:{};
 const total=value(findKey(root,['Overall_level','Overall level','total_level','totalLevel']))??value(findKey(info,['Overall_level','total_level']))??value(findKey(overall,['level']));
 const rank=value(findKey(root,['Overall_rank','Overall rank','overallRank']))??value(findKey(info,['Overall_rank','overall_rank']))??value(findKey(overall,['rank']));
 set('total-level',total===null?'—':String(Math.trunc(total)));set('overall-rank',format(rank));
 const ehbKey=findKey(root,['Primary_ehb'])??findKey(info,['Primary_ehb']);let ehb=value(findKey(root,[String(ehbKey||'Ehb'),'Ehb','Main-EHB','Primary_EHB']))??value(findKey(info,[String(ehbKey||'Ehb'),'Ehb','Main-EHB']));if(isObj(ehbKey))ehb=value(findKey(ehbKey,['value','ehb']));set('ehb',format(ehb));
 const ehpKey=findKey(root,['Primary_ehp'])??findKey(info,['Primary_ehp']);let ehp=value(findKey(root,[String(ehpKey||'Ehp'),'Ehp','Main-EHP','Primary_EHP']))??value(findKey(info,[String(ehpKey||'Ehp'),'Ehp','Main-EHP']));if(isObj(ehpKey))ehp=value(findKey(ehpKey,['value','ehp']));set('ehp',format(ehp));
 const pets=data(live.pets);const actualPets=value(findKey(pets,['pet_count','Pet Count']))??(live.pets?normalizePetOwnership(live.pets).size:null);set('pet-count',format(actualPets));
 const collection=data(live.collection);const got=value(findKey(collection,['total_collections_in_response','total_collections_finished']));const totalItems=value(findKey(collection,['total_collections_available']));set('collection-total',`${format(got)} / ${format(totalItems)}`);set('log-count-title',`${format(got)}/${format(totalItems)}`);
 set('log-finished',format(value(findKey(collection,['total_categories_finished'])))+' categories complete');
 const logTime=value(findKey(collection,['last_checked']));if(snapshotTime){const d=new Date(snapshotTime);if(Number.isFinite(d.getTime()))set('sync-time','Temple data last successfully synced '+d.toLocaleString())}else if(logTime){const d=new Date(logTime<1e12?logTime*1000:logTime);if(Number.isFinite(d.getTime()))set('sync-time','Log last checked at Temple '+d.toLocaleString())}
}
// Target editing is gated by PIN verification BEFORE any editable controls are shown.
// Static GitHub Pages mode: PIN is a UI convenience, not a security boundary.
// Shared backend mode: PIN is verified on the Worker and save requires a short-lived token.
let bossOptions = [], target = null, targetScope='browser', pendingTarget = null, editToken=null;
function selectedBoss(){return target || bossOptions.find(x=>x.id===(CFG.DEFAULT_TARGET||'sarachnis')) || bossOptions[0] || null}
function sharedTargetUrl(){return String(CFG.TARGET_API_URL||'').replace(/\/$/,'')}
async function fetchSharedTarget(){const res=await fetch(sharedTargetUrl()+'/target',{cache:'no-store'});if(!res.ok)throw Error('Shared target unavailable');const obj=await res.json();return bossOptions.find(x=>x.id===obj.target)||null}
async function loadBosses(){try{if(Array.isArray(window.SNIFFIN_EMBEDDED_BOSSES)){bossOptions=window.SNIFFIN_EMBEDDED_BOSSES}else{const response=await fetch('./data/pet-bosses.json',{cache:'no-store'});if(!response.ok)throw Error('Boss list not available');bossOptions=await response.json()}if(!Array.isArray(bossOptions)||!bossOptions.length)throw Error('Empty boss list')}catch(ex){setStatus('Boss options unavailable: '+ex.message,'error');return}
 target=bossOptions.find(x=>x.id===(CFG.DEFAULT_TARGET||'sarachnis'))||bossOptions[0]||null;targetScope='shared offline';
 if(sharedTargetUrl()){try{const remote=await fetchSharedTarget();target=remote||target;targetScope='shared'}catch{targetScope='shared offline';set('target-storage','Shared target unavailable (not editable offline)')}}
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
 set('target-storage',targetScope==='shared'?'Shared across visitors':'Shared target unavailable');petIcon(boss)}
function renderBossOptions(){const select=$('target-select'),filter=norm($('target-search').value),active=pendingTarget||selectedBoss()?.id;select.replaceChildren();for(const boss of bossOptions){if(filter&&!norm(boss.name+' '+boss.pet).includes(filter))continue;const option=document.createElement('option');option.value=boss.id;option.textContent=`${boss.name} — ${boss.pet}`;option.selected=boss.id===active;select.append(option)}if(select.options.length&&!select.value)select.selectedIndex=0;describeBossOption()}
function describeBossOption(){const boss=bossOptions.find(x=>x.id===$('target-select').value);set('target-choice-details',boss?`${boss.pet} • ${boss.name}${boss.note?' • '+boss.note:''}`:'No matching pet bosses.')}
function showEditorStep(authorized){$('target-lock-step').hidden=authorized;$('target-edit-step').hidden=!authorized;$('target-save-actions').hidden=!authorized;set('target-dialog-title',authorized?'SELECT PET HUNT':'UNLOCK PET HUNT');if(authorized){$('target-search').value='';renderBossOptions();$('target-search').focus()}else{$('target-pin').value='';$('target-pin').focus()}}
function closeEditor(){const dialog=$('target-dialog');if(dialog.open)dialog.close();editToken=null;pendingTarget=null;showEditorStep(false);set('target-error','')}
function openEditor(){if(!bossOptions.length){setStatus('Boss list unavailable; refresh the page','error');return}if(targetScope==='shared offline'){setStatus('Shared target server unavailable; editing disabled','error');return}editToken=null;pendingTarget=selectedBoss()?.id;set('target-error','');showEditorStep(false);$('target-dialog').showModal();$('target-pin').focus()}
async function verifyPin(pin){if(!/^\d{4}$/.test(pin))throw Error('Enter the four-digit PIN.');if(!sharedTargetUrl())throw Error('Editor service unavailable.');const res=await fetch(sharedTargetUrl()+'/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});if(!res.ok){if(res.status===401)throw Error('Incorrect PIN.');if(res.status===403)throw Error('Editor is not available from this network.');if(res.status===429)throw Error('Too many attempts. Try again later.');throw Error('Unlock failed ('+res.status+').')}const obj=await res.json();if(!obj.token)throw Error('Unlock response did not include a session.');return obj.token}
async function storeTarget(bossId){const obj=bossOptions.find(x=>x.id===bossId);if(!obj)throw Error('Select a listed boss.');if(!editToken)throw Error('Unlock the editor first.');if(!sharedTargetUrl())throw Error('Editor service unavailable.');const res=await fetch(sharedTargetUrl()+'/target',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+editToken},body:JSON.stringify({target:bossId})});if(!res.ok)throw Error(res.status===401?'Unlock expired; close and enter PIN again.':res.status===403?'Editor is not available from this network.':'Could not save shared target ('+res.status+').');targetScope='shared';target=obj;hunt()}
function setupEditor(){$('edit-target').addEventListener('click',openEditor);$('close-target').addEventListener('click',closeEditor);$('cancel-target').addEventListener('click',closeEditor);$('target-select').addEventListener('change',()=>{pendingTarget=$('target-select').value;describeBossOption()});$('target-search').addEventListener('input',renderBossOptions);
 $('target-unlock-form').addEventListener('submit',async e=>{e.preventDefault();set('target-error','');const btn=$('unlock-target');btn.disabled=true;try{editToken=await verifyPin($('target-pin').value);showEditorStep(true)}catch(ex){editToken=null;set('target-error',ex.message||'Unlock failed')}finally{btn.disabled=false}});
 $('target-form').addEventListener('submit',async e=>{e.preventDefault();if(!editToken){showEditorStep(false);return}const id=$('target-select').value;if(!id){set('target-error','Select a boss.');return}const btn=$('save-target');btn.disabled=true;set('target-error','');try{await storeTarget(id);closeEditor()}catch(ex){set('target-error',ex.message||'Unable to save')}finally{btn.disabled=false}});
 $('target-dialog').addEventListener('cancel',e=>{e.preventDefault();closeEditor()});$('target-dialog').addEventListener('close',()=>{editToken=null});}
function itemIds(v){if(Array.isArray(v))return v.flatMap(x=>isObj(x)?itemIds(x):(/^\d+$/.test(String(x))?[String(x)]:[]));if(isObj(v)){if(v.id!=null||v.item_id!=null)return[String(v.id??v.item_id)];if(Array.isArray(v.items)||isObj(v.items))return itemIds(v.items);return Object.entries(v).flatMap(([k,item])=>{if(/^\d+$/.test(k))return[k];if(isObj(item)||Array.isArray(item))return itemIds(item);return []})}return []}
function categoriesComplete(raw){let root=data(raw);if(isObj(root.categories))root=root.categories;const groups={bosses:['bosses','boss'],raids:['raids','raid'],clues:['clues','clue_scrolls','clue'],minigames:['minigames','minigame'],other:['other','others']};return Object.values(groups).every(aliases=>{const entry=Object.entries(root).find(([k])=>aliases.includes(norm(k).replace(/(scrolls)?$/,'')));return !!entry&&isObj(entry[1])&&Object.keys(entry[1]).length>0})}
function collectionComplete(raw){const root=data(raw),items=root.items,total=value(findKey(root,['total_collections_available'])),returned=value(findKey(root,['total_collections_in_response'])),categoryTotal=value(findKey(root,['total_categories_available'])),checked=findKey(root,['last_checked']);if(!(isObj(items)||Array.isArray(items))||!total||!Number.isInteger(returned)||returned<0||!categoryTotal||checked==null)return false;const ids=new Set();const walk=node=>{if(Array.isArray(node)){for(const child of node)walk(child);return}if(!isObj(node))return;const direct=node.id??node.item_id;if(direct!=null)ids.add(String(direct));for(const [key,child] of Object.entries(node)){if(/^\d+$/.test(key))ids.add(key);if(isObj(child)||Array.isArray(child))walk(child)}};walk(items);return ids.size>=total}
function normalizePetOwnership(raw){const root=data(raw),source=root?.pets??root?.Pets??root?.pet_count??root?.Pet_Count??null,out=new Map();const add=(name,rawCount)=>{if(!name)return;let count;if(typeof rawCount==='boolean')count=rawCount?1:0;else if(typeof rawCount==='number'||typeof rawCount==='string'){count=Number(rawCount)}else if(isObj(rawCount)){const field=findKey(rawCount,['count','quantity','owned','pet_count','amount']);if(typeof field==='boolean')count=field?1:0;else count=Number(field)}else return;if(Number.isFinite(count)&&count>0){const key=String(name).trim();if(key)out.set(key,Math.max(count,out.get(key)||0))}};const walk=(node,fallback='')=>{if(Array.isArray(node)){for(const rec of node){if(isObj(rec)){const name=findKey(rec,['pet_name','name','pet','item_name']);const count=findKey(rec,['count','quantity','owned','pet_count','amount']);if(name!=null&&count!=null)add(name,count);else walk(rec)}else if(typeof rec==='string')add(rec,1)}return}if(!isObj(node))return;const ownName=findKey(node,['pet_name','item_name']);const ownCount=findKey(node,['count','quantity','owned','pet_count','amount']);if(ownName!=null&&ownCount!=null){add(ownName,ownCount);return}for(const [key,val] of Object.entries(node)){if(['total','total_pets','last_checked','updated_at','player','player_name','username'].includes(norm(key)))continue;if(isObj(val)||Array.isArray(val))walk(val,key);else add(key,val)}};if(isObj(source)||Array.isArray(source))walk(source);return out}
function itemNameMap(raw){let root=data(raw);if(isObj(root.items))root=root.items;const out={};const walk=node=>{if(Array.isArray(node)){for(const child of node)walk(child);return}if(!isObj(node))return;const id=node.id??node.item_id,name=node.name??node.item_name;if(id!=null&&name)out[String(id)]=String(name);for(const [key,val] of Object.entries(node)){if(/^\d+$/.test(key)&&typeof val==='string')out[key]=val;else if(isObj(val)||Array.isArray(val))walk(val)}};walk(root);return out}
function mapItems(){let root=data(live.items);if(isObj(root.items))root=root.items;const map={};const walk=(obj)=>{if(Array.isArray(obj)){for(const v of obj)walk(v);return}if(!isObj(obj))return;const directId=obj.id??obj.item_id, directName=obj.name??obj.item_name;if(directId!=null&&directName)map[String(directId)]=String(directName);for(const [k,v] of Object.entries(obj)){if(typeof v==='string'&&/^\d+$/.test(k))map[k]=v;else if(isObj(v)){const id=findKey(v,['id','item_id']),name=findKey(v,['name','item_name']);if(id!=null&&name)map[String(id)]=String(name);else if(name&&/^\d+$/.test(k))map[k]=String(name);else walk(v)}}};walk(root);return map}
function categoryCatalog(){let root=data(live.categories);if(isObj(root.categories))root=root.categories;const out=Object.fromEntries(categories.map(c=>[c,{}]));
 const aliases={bosses:['bosses','boss'],raids:['raids','raid'],clues:['clues','clue_scrolls','clue'],minigames:['minigames','minigame'],other:['other','others']};
 for(const cat of categories){const match=Object.entries(root).find(([k])=>aliases[cat].includes(norm(k).replace(/(scrolls)?$/,'')))||Object.entries(root).find(([k])=>norm(k)===norm(cat));const rows=match?.[1]||{};const records=Array.isArray(rows)?rows.map((v,i)=>[v?.slug??v?.name??String(i),v]):Object.entries(rows);
 for(const [slug,v] of records){const ids=itemIds(v);if(ids.length)out[cat][slug]=[...new Set(ids)]}}
 return out}
function parseOwned(){const root=data(live.collection),entries=root.items||{},byId=new Map(),byName=new Map();const add=(key,v)=>{const rec=isObj(v)?v:{count:v};const id=rec.id??rec.item_id??(/^\d+$/.test(String(key))?key:null);const name=rec.name||rec.item_name||(!/^\d+$/.test(String(key))?key:null);const rawCount=rec.count??rec.quantity??((typeof v==='number'||typeof v==='boolean')?Number(v):null);const count=value(rawCount);if(id!=null&&count!==null)byId.set(String(id),Math.max(count,byId.get(String(id))||0));if(name&&count!==null)byName.set(norm(name),Math.max(count,byName.get(norm(name))||0))};const walk=obj=>{if(Array.isArray(obj)){for(const item of obj){if(isObj(item)&&(item.id!=null||item.item_id!=null||item.count!=null||item.quantity!=null))add(item.id??item.item_id,item);else walk(item)}return}if(!isObj(obj))return;for(const [key,v] of Object.entries(obj)){if(isObj(v)&&('id'in v||'item_id'in v||'count'in v||'quantity'in v))add(key,v);else if(isObj(v)||Array.isArray(v))walk(v);else if(typeof v==='number'||typeof v==='boolean')add(key,v)}};walk(entries);return {byId,byName,valid:collectionComplete(live.collection)};}
let catalog={},names={},owned={},tab='bosses',selected=null,query='';
function makeModel(){catalog=categoryCatalog();names=mapItems();owned=parseOwned(); if(!catalog[tab]||!Object.keys(catalog[tab]).length){tab=categories.find(c=>Object.keys(catalog[c]||{}).length)||'bosses'}if(!selected||!catalog[tab]?.[selected]) selected=Object.keys(catalog[tab]||{})[0]||null;renderTabs();renderEntries();renderDetail();}
function visible(){return Object.keys(catalog[tab]||{}).filter(slug=>{const matchesName=norm(niceName(slug)).includes(norm(query));const matchItems=(catalog[tab][slug]||[]).some(id=>norm(names[id]||'').includes(norm(query)));return !query||matchesName||matchItems})}
function obtained(ids){return ids.filter(id=>{const v=owned.byId.get(String(id))??owned.byName.get(norm(names[String(id)]));return v!=null&&v>0}).length}
function renderTabs(){const node=$('log-tabs');node.replaceChildren();for(const cat of categories){const button=document.createElement('button');button.type='button';button.textContent=titleCase(cat);button.className=tab===cat?'selected':'';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(tab===cat));button.onclick=()=>{tab=cat;selected=visible()[0]||Object.keys(catalog[tab]||{})[0]||null;renderTabs();renderEntries();renderDetail()};node.append(button)}}
function renderEntries(){const node=$('log-list');node.replaceChildren();const rows=visible();for(const slug of rows){const ids=catalog[tab][slug];const button=document.createElement('button');const obtainedCount=obtained(ids);button.className=[selected===slug?'selected':'',owned.valid&&obtainedCount===ids.length?'complete':'',owned.valid&&obtainedCount>0&&obtainedCount<ids.length?'partial':''].filter(Boolean).join(' ');const span=document.createElement('span');span.textContent=niceName(slug);const small=document.createElement('small');small.textContent=owned.valid?`${obtained(ids)}/${ids.length}`:'—/'+ids.length;button.append(span,small);button.onclick=()=>{selected=slug;renderEntries();renderDetail()};node.append(button)}if(!rows.length)node.innerHTML='<div class="placeholder">No matching categories</div>'}
function renderDetail(){const ids=catalog[tab]?.[selected];const box=$('log-slots');box.replaceChildren();if(!ids){set('entry-name','No collection available');set('entry-obtained','Temple categories have not loaded');set('entry-kc','');set('entry-ratio','—');box.innerHTML='<div class="placeholder">No verified category data loaded. Use Refresh or local live test.</div>';return}
 set('entry-name',niceName(selected));set('entry-obtained',owned.valid?`Obtained: ${obtained(ids)}/${ids.length}`:`Obtained: —/${ids.length} (unsynced)`);set('entry-ratio',owned.valid?`${Math.round(obtained(ids)/Math.max(ids.length,1)*100)}%`:'—');const bossStats=data(live.stats);const kc= bossKC({name:niceName(selected),kcKey:selected,kcAliases:[selected.replaceAll('_',' ')]});set('entry-kc',kc===null?'':`Kills: ${format(kc)}`);
 for(const id of ids){const itemName=names[String(id)] || `Item ${id}`;const count=owned.byId.get(String(id))??owned.byName.get(norm(itemName));const slot=document.createElement('div');const confirmedMissing=owned.valid && !count;slot.className='slot'+(confirmedMissing?' missing':'');slot.title=itemName+(owned.valid?` · ${format(count||0)} recorded`:' · Not synced');const img=createIcon(id,itemName);slot.append(img);if(count>0){const qty=document.createElement('span');qty.className='qty';qty.textContent=format(count);slot.append(qty)}const label=document.createElement('span');label.className='item-label';label.textContent=itemName;slot.append(label);box.append(slot)}set('log-footer-msg',`${Object.values(catalog[tab]||{}).length} categories · ${tab.toUpperCase()} · Temple catalog`)}
function petItemId(name){const alias={scorpia:'scorpiasoffspring',zulrah:'petsnakeling',snakeling:'petsnakeling',chaoselemental:'petchaoselemental',brutus:'brutus',araxxor:'nid'};const key=alias[norm(name)]||norm(name);const ids=catalog.other?.all_pets||[];for(const id of ids){const nm=norm(names[id]);if(nm===key||nm==='pet'+key||key==='pet'+nm)return id}return null}
function canonicalPetName(name){const key=norm(name).replace(/^pet/,'');for(const id of catalog.other?.all_pets||[]){const canonical=names[String(id)];if(canonical&&norm(canonical).replace(/^pet/,'')===key)return canonical}return titleCase(name)}
function renderPets(){const box=$('pet-grid');box.replaceChildren();if(!live.pets&&!owned.valid){box.innerHTML='<div class="placeholder">Pet ownership unavailable. No unverified pets are displayed.</div>';set('pet-summary','TEMPLE NOT CONNECTED');return}const found=new Map();for(const [name,count] of normalizePetOwnership(live.pets)){const canonical=canonicalPetName(name);found.set(canonical,Math.max(count,found.get(canonical)||0))}if(owned.valid){for(const id of catalog.other?.all_pets||[]){const count=owned.byId.get(String(id))??owned.byName.get(norm(names[String(id)]||''));const name=names[String(id)];if(name&&count>0)found.set(name,Math.max(count,found.get(name)||0))}}const list=[...found.entries()];set('pet-summary',live.pets?'REGISTERED · TEMPLE':list.length?'COLLECTION LOG':'TEMPLE PETS UNAVAILABLE');if(!list.length){box.innerHTML=live.pets?'<div class="placeholder">No owned pets returned by Temple.</div>':'<div class="placeholder">Temple pet ownership unavailable. Collection log data is also checked when synced.</div>';return}for(const [name,count] of list){const card=document.createElement('article');card.className='pet-card';const img=createIcon(petItemId(name),name);card.append(img);const title=document.createElement('strong');title.textContent=name;const badge=document.createElement('small');badge.textContent=count>1?'OBTAINED ×'+format(count):'OBTAINED';card.append(title,badge);box.append(card)}}

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
 const displayLevel=virtual!==null?virtual:(level===null?null:Math.min(Math.floor(level),99));
 return {level:displayLevel,xp};
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
   const itemId=boss?.itemId ?? petItemId(boss?.pet||name);
   return createIcon(itemId,boss?.pet||name);
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
   const result=await loadRemote();
   extractStats();makeModel();hunt();renderPets();if($('profile-dialog')?.open)renderProfile();
   const loaded=FEED_KEYS.filter(k=>live[k]).length;
   const timestamp=Math.max(0,...Object.values(feedTimes));
   const age=timestamp?Date.now()-timestamp:Infinity;
   const unavailable=FEED_KEYS.filter(k=>!live[k]).length;
   const freshFeeds=FEED_KEYS.filter(k=>live[k]&&Date.now()-(feedTimes[k]||0)<=30*60*1000).length;
   const staleFeeds=FEED_KEYS.filter(k=>live[k]&&Date.now()-(feedTimes[k]||0)>24*3600*1000).length;
   const cachedFeeds=Math.max(0,loaded-freshFeeds-staleFeeds);
   if(result.success===FEED_KEYS.length&&!result.stale)setStatus('TempleOSRS live · 6/6 feeds refreshed','ok');
   else if(result.success>0)setStatus(`Temple partial · ${result.success} current · ${cachedFeeds} cached · ${staleFeeds} stale · ${unavailable} unavailable`,staleFeeds?'error':'ok');
   else if(loaded)setStatus(`Temple cached · ${freshFeeds} current · ${cachedFeeds} cached · ${staleFeeds} stale · ${unavailable} unavailable`,staleFeeds?'error':'ok');
   else setStatus('Temple unavailable · no valid saved data','error');
   if(snapshotTime&&!$('sync-time').textContent)set('sync-time','Snapshot '+new Date(snapshotTime).toLocaleString());
 }catch(err){setStatus('Unable to refresh · '+String(err.message||err),'error');}
 finally{$('refresh').disabled=false;loading=false;}
}
if(CFG.TEST_MODE){$('test-strip').hidden=false}
$('log-search').addEventListener('input',event=>{query=event.target.value.trim();selected=visible()[0]||null;renderEntries();renderDetail()});$('refresh').addEventListener('click',refresh);
setupEditor();setupProfile();Promise.allSettled([loadBosses(),loadIconMap()]).then(refresh);if(CFG.REFRESH_MS>0)setInterval(()=>{if(!document.hidden)refresh()},CFG.REFRESH_MS);


function setupAvatar(){
 const avatar=$('profile-avatar');if(!avatar)return;
 const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');let pointer=null,frame=0,burstTimer=0;
 const updateTilt=()=>{frame=0;if(!pointer||reduceMotion.matches)return;const r=avatar.getBoundingClientRect(),x=(pointer.x-r.left)/r.width,y=(pointer.y-r.top)/r.height;avatar.style.setProperty('--avatar-tilt-x',((x-.5)*8).toFixed(2)+'deg');avatar.style.setProperty('--avatar-tilt-y',((.5-y)*7).toFixed(2)+'deg')};
 avatar.addEventListener('pointermove',e=>{if(reduceMotion.matches||e.pointerType!=='mouse')return;pointer={x:e.clientX,y:e.clientY};if(!frame)frame=requestAnimationFrame(updateTilt)});
 avatar.addEventListener('pointerleave',()=>{pointer=null;avatar.style.removeProperty('--avatar-tilt-x');avatar.style.removeProperty('--avatar-tilt-y')});
 const activate=()=>{avatar.classList.remove('avatar-bursting');void avatar.offsetWidth;avatar.classList.add('avatar-bursting');clearTimeout(burstTimer);burstTimer=window.setTimeout(()=>avatar.classList.remove('avatar-bursting'),1700)};
 avatar.addEventListener('click',activate);
 avatar.addEventListener('keydown',e=>{if(e.target!==avatar)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});
}
setupAvatar();
