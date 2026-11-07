'use strict';
// A curated catalog: rates are only filled where sufficiently established and are editable server-side.
const PETS = [
 ['chaos-elemental','Pet chaos elemental','Chaos Elemental','chaos_elemental',300],
 ['baby-mole','Baby mole','Giant Mole','giant_mole',3000],
 ['scorpia','Scorpia\'s offspring','Scorpia','scorpia',2016],
 ['skotos','Skotos','Skotizo','skotizo',65],
 ['phoenix','Phoenix','Wintertodt','wintertodt',5000],
 ['snakeling','Pet snakeling','Zulrah','zulrah',4000],
 ['rock-golem','Rock golem','Mining',null,null],
 ['chompy','Chompy chick','Chompy bird hunting',null,500],
 ['nid','Nid','Araxxor','araxxor',3000],
 ['beef','Beef','Brutus',null,null],
 ['sraracha','Sraracha','Sarachnis','sarachnis',3000],
 ['vorki','Vorki','Vorkath','vorkath',3000],
 ['hellpuppy','Hellpuppy','Cerberus','cerberus',3000],
 ['hydra','Ikkle hydra','Alchemical Hydra','alchemical_hydra',3000],
 ['kraken','Pet kraken','Kraken','kraken',3000],
 ['thermy','Pet smoke devil','Thermonuclear smoke devil','thermonuclear_smoke_devil',3000],
 ['kq','Kalphite princess','Kalphite Queen','kalphite_queen',3000],
 ['kbd','Prince black dragon','King Black Dragon','king_black_dragon',3000],
 ['jad','TzRek-Jad','TzTok-Jad','tz_tok_jad',200],
 ['zuk','Jal-Nib-Rek','TzKal-Zuk','tz_kal_zuk',100],
 ['graardor','Pet general graardor','General Graardor','general_graardor',5000],
 ['kree','Pet kree\'arra','Kree\'arra','kree_arra',5000],
 ['zilyana','Pet zilyana','Commander Zilyana','commander_zilyana',5000],
 ['kril','Pet k\'ril tsutsaroth','K\'ril Tsutsaroth','kril_tsutsaroth',5000],
 ['sire','Abyssal orphan','Abyssal Sire','abyssal_sire',2560],
 ['corp','Pet dark core','Corporeal Beast','corporeal_beast',5000],
 ['muspah','Muphin','Phantom Muspah','phantom_muspah',2500],
 ['nex','Nexling','Nex','nex',500],
 ['nightmare','Little nightmare','Nightmare','nightmare',800],
 ['baron','Baron','Duke Sucellus','duke_sucellus',2500],
 ['butch','Butch','Vardorvis','vardorvis',3000],
 ['wisp','Wisp','The Whisperer','the_whisperer',2000],
 ['leviathan','Lil\'viathan','The Leviathan','the_leviathan',2500],
 ['scurry','Scurry','Scurrius','scurrius',3000],
 ['venenatis','Venenatis spiderling','Venenatis','venenatis',2000],
 ['vetion','Vet\'ion jr.','Vet\'ion','vetion',2000],
 ['callisto','Callisto cub','Callisto','callisto',2000],
 ['artio','Callisto cub','Artio','artio',2800],
 ['calvarion','Vet\'ion jr.','Calvar\'ion','calvarion',2800],
 ['spindel','Venenatis spiderling','Spindel','spindel',2800],
 ['tempoross','Tiny tempor','Tempoross','tempoross',8000],
 ['guardians','Abyssal protector','Guardians of the Rift',null,4000],
 ['heron','Heron','Fishing',null,null],
 ['beaver','Beaver','Woodcutting',null,null],
 ['rocky','Rocky','Thieving',null,null],
 ['squirrel','Giant squirrel','Agility',null,null],
 ['rift','Rift guardian','Runecraft',null,null],
 ['tangleroot','Tangleroot','Farming',null,null],
 ['chinchompa','Baby chinchompa','Hunter',null,null],
 ['herbi','Herbi','Herbiboar',null,6500],
 ['bloodhound','Bloodhound','Master clues',null,1000],
 ['mimic','Mimic','Mimic',null,250],
 ['goa','Youngllef','The Gauntlet','the_gauntlet',2000],
 ['zalcano','Smolcano','Zalcano','zalcano',2250],
 ['tob','Lil\' zik','Theatre of Blood','theatre_of_blood',null],
 ['cox','Olmlet','Chambers of Xeric','chambers_of_xeric',null],
 ['toa','Tumeken\'s guardian','Tombs of Amascut','tombs_of_amascut',null],
 ['huey','Huberte','Hueycoatl','the_hueycoatl',null],
 ['moons','Moxi','Amoxliatl','amoxliatl',null],
 ['sarach','Sraracha','Sarachnis','sarachnis',3000],
 ['giant-pet','Gull','Sailing',null,null]
];
// Shared pets from multiple bosses are displayed once, to avoid inflating collection size.
const CATALOG = PETS.filter(x=>!['artio','calvarion','spindel','sarach'].includes(x[0]));
const $=id=>document.getElementById(id);const fmt=n=>Number.isFinite(+n)?Math.floor(+n).toLocaleString('en-US'):'—';const clean=s=>String(s??'');
const escaped=s=>clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wikifile=name=>'https://oldschool.runescape.wiki/images/'+encodeURIComponent(name.replaceAll(' ','_')+'.png');
const wiki=name=>'https://oldschool.runescape.wiki/w/'+encodeURIComponent(name.replaceAll(' ','_'));
let serverState={username:'Sniffin',target:'sraracha',startKC:0,huntNote:'',owned:{},manualKC:{},rates:{},notes:[]};
let editable=null,metrics={},syncOk=false,adminAllowed=false,filter='all',sort='default',search='';
const pet=id=>CATALOG.find(p=>p[0]===id)||CATALOG[0];
function probability(k,n){if(!(n>0)||!(k>=0))return null;return -Math.expm1(k*Math.log1p(-1/n));}
function rateFor(p){const v=serverState.rates?.[p[0]];return v===undefined?p[4]:v;}
function kcFor(p){if(p[3]&&Number.isFinite(metrics[p[3]]))return metrics[p[3]];const n=Number(serverState.manualKC?.[p[0]]);return Number.isFinite(n)&&n>=0&&serverState.manualKC?.[p[0]]!==undefined?n:null;}
function snapshotValue(v){if(typeof v==='number')return v;if(v&&typeof v==='object'){for(const key of ['kills','value','score'])if(typeof v[key]==='number')return v[key];}return null;}
function setSyncLabel(msg,ok=false){$('syncLabel').textContent=msg;document.querySelector('.live-dot').style.background=ok?'#8bc68a':'#d4a35e';}
function toast(s){$('toast').textContent=s;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),4000);}
async function api(path,options={}){const res=await fetch('/sniffin/api/'+path,{credentials:'same-origin',cache:'no-store',...options});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||'Request failed ('+res.status+')');return body;}
async function loadState(){try{const state=await api('state');serverState={...serverState,...state,owned:state.owned||{},manualKC:state.manualKC||{},rates:state.rates||{},notes:state.notes||[]};render();}catch(e){setSyncLabel('STATE BACKEND NOT CONNECTED');toast('Server storage unavailable — showing demo defaults');}}
async function syncKC(){const user=clean(serverState.username).trim();if(!user){setSyncLabel('SET USERNAME IN EDIT MODE');return;}setSyncLabel('SYNCING WISE OLD MAN...');try{const data=await api('wom?username='+encodeURIComponent(user));const snapshot=data.latestSnapshot||data.snapshot||{};const bossData=snapshot.data?.bosses||snapshot.bosses||data.bosses||{};const found={};for(const [key,value] of Object.entries(bossData)){const n=snapshotValue(value);if(n!==null)found[key]=n;}
metrics=found;syncOk=Object.keys(found).length>0;setSyncLabel(syncOk?'WOM SYNCED · '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'NO WOM BOSS DATA',syncOk);render();}catch(e){syncOk=false;setSyncLabel('WOM OFFLINE / NOT TRACKED');render();}}
function render(){const owned=CATALOG.filter(p=>!!serverState.owned?.[p[0]]);$('ownedNum').textContent=fmt(owned.length);$('missingNum').textContent=fmt(CATALOG.length-owned.length);$('ownedSub').textContent='OF '+CATALOG.length+' IN THIS CATALOG';$('completionNum').textContent=Math.round(owned.length/CATALOG.length*100)+'%';$('completionBar').style.width=owned.length/CATALOG.length*100+'%';$('vaultCount').textContent=owned.length+' / '+CATALOG.length+' SECURED';let kcTotal=Object.values(metrics).filter(n=>Number.isFinite(n)&&n>=0).reduce((a,b)=>a+b,0);$('kcTotal').textContent=syncOk?fmt(kcTotal):'—';renderTarget();renderVault();renderFeed();}
function renderTarget(){const p=pet(serverState.target),kc=kcFor(p),rate=rateFor(p),chance=kc!==null&&rate?probability(kc,rate):null;$('targetImage').src=wikifile(p[1]);$('targetImage').style.opacity='1';$('targetName').textContent=p[2];$('targetPet').textContent='TARGET DROP: '+p[1]+(serverState.huntNote?' · '+serverState.huntNote:'');$('targetKC').textContent=kc===null?'—':fmt(kc);$('targetRate').textContent=rate?'1 / '+fmt(rate):'VARIES';$('targetChance').textContent=chance===null?'—':(chance*100).toFixed(1)+'%';$('targetPercent').textContent=chance===null?'N/A':(chance*100).toFixed(2)+'%';$('targetBar').style.width=chance===null?'0%':Math.min(chance*100,100)+'%';$('targetWiki').href=wiki(p[2]);$('targetSummary').textContent=kc===null?'NO KC AVAILABLE · CONNECT WOM OR ADD MANUAL KC':rate?'NEXT ROLL: 1 IN '+fmt(rate)+' · NO GUARANTEED DROP':'DROP RATE VARIES BY METHOD';}
function renderVault(){const items=CATALOG.filter(p=>filter==='all'||(filter==='owned')===!!serverState.owned?.[p[0]]).filter(p=>(p[1]+' '+p[2]).toLowerCase().includes(search));items.sort((a,b)=>sort==='name'?a[1].localeCompare(b[1]):sort==='kc'?(kcFor(b)??-1)-(kcFor(a)??-1):sort==='chance'?(probability(kcFor(b),rateFor(b))??-1)-(probability(kcFor(a),rateFor(a))??-1):CATALOG.indexOf(a)-CATALOG.indexOf(b));$('petGrid').innerHTML=items.map(p=>{const got=!!serverState.owned?.[p[0]],kc=kcFor(p),ownedDetail=serverState.owned?.[p[0]]||{};return `<article class="pet-tile ${got?'':'missing'}" title="${escaped(p[1])} from ${escaped(p[2])}"><div class="pet-state">${got?'◆ OWNED':'◇ UNKNOWN'}</div><div class="pet-rate">${rateFor(p)?'1/'+fmt(rateFor(p)):'—'}</div><img loading="lazy" src="${wikifile(p[1])}" alt="${escaped(p[1])}" onerror="this.style.opacity='.08'"><div class="pet-name">${escaped(p[1])}</div><div class="pet-detail">${got&&ownedDetail.kc?'DROP @ '+fmt(ownedDetail.kc)+' KC':kc!==null?fmt(kc)+' KC · '+escaped(p[2]):escaped(p[2])}</div></article>`;}).join('')||'<div class="empty">NO PETS MATCH THE FILTER.</div>';}
function renderFeed(){const notes=(serverState.notes||[]).slice().reverse();$('feedItems').innerHTML=notes.length?notes.map(n=>`<div class="feed-item"><div class="feed-icon">✦</div><div class="feed-copy"><strong>${escaped(n.title||'FIELD REPORT')}</strong><p>${escaped(n.body||'')}</p><small>${escaped(n.date||'')}</small></div></div>`).join(''):'<div class="empty">No field notes yet. The hunt awaits.</div>';}
function renderRng(){const rate=Number($('rngRate').value),kills=Number($('rngKills').value),n=probability(kills,rate);if(n===null||!Number.isFinite(n)){$('rngSuccess').textContent=$('rngDry').textContent='—';$('rngVerdict').textContent='ENTER A VALID RATE AND KC.';return;}$('rngSuccess').textContent=(n*100).toFixed(2)+'%';$('rngDry').textContent=((1-n)*100).toFixed(2)+'%';$('rngVerdict').textContent=n<.5?'NOT EVEN A COIN FLIP YET.':n<.9?'UNLUCKY? MAYBE. KEEP SNIFFIN.':n<.99?'THE RNG IS GETTING PERSONAL.':'CERTIFIED CURSED TERRITORY.';}
async function checkOwner(){try{const status=await api('auth/status');adminAllowed=!!status.allowed;$('editBtn').classList.toggle('hidden',!adminAllowed);if(status.authenticated)showEditor();}catch(_){adminAllowed=false;}}
function openModal(){$('editorModal').classList.remove('hidden');$('loginPanel').classList.remove('hidden');$('editPanel').classList.add('hidden');$('pinInput').value='';$('loginError').textContent='';$('pinInput').focus();}
function closeModal(){$('editorModal').classList.add('hidden');}
function showEditor(){editable=JSON.parse(JSON.stringify(serverState));$('loginPanel').classList.add('hidden');$('editPanel').classList.remove('hidden');$('editorModal').classList.remove('hidden');$('editUsername').value=editable.username||'';$('editTarget').innerHTML=CATALOG.map(p=>`<option value="${p[0]}">${escaped(p[2])} — ${escaped(p[1])}</option>`).join('');$('editTarget').value=editable.target||CATALOG[0][0];$('editStartKC').value=editable.startKC||0;$('editHuntNote').value=editable.huntNote||'';renderEditPets();renderEditNotes();}
function renderEditPets(){$('editPets').innerHTML=CATALOG.map(p=>{const v=editable.owned?.[p[0]];const manual=editable.manualKC?.[p[0]];return `<label class="edit-pet" title="${escaped(p[2])}"><input data-owned="${p[0]}" type="checkbox" ${v?'checked':''}><span>${escaped(p[1])}</span><input aria-label="Manual KC for ${escaped(p[1])}" data-manual="${p[0]}" type="number" min="0" placeholder="KC if no WOM" value="${manual??''}"><input aria-label="Drop KC for ${escaped(p[1])}" data-drop="${p[0]}" type="number" min="0" placeholder="DROP KC" value="${v?.kc??''}"><input aria-label="Drop rate denominator for ${escaped(p[1])}" data-rate="${p[0]}" type="number" min="1" placeholder="1 IN N" value="${editable.rates?.[p[0]]??p[4]??''}"></label>`}).join('');}
function renderEditNotes(){$('editNotes').innerHTML=(editable.notes||[]).map((n,i)=>`<div class="edit-note"><input data-note-date="${i}" aria-label="Note date" placeholder="DATE" value="${escaped(n.date||'')}"><input data-note-body="${i}" aria-label="Field note" placeholder="Field note" maxlength="200" value="${escaped(n.body||'')}"><button data-remove-note="${i}" type="button">×</button></div>`).join('');}
function captureEditor(){editable.username=$('editUsername').value.trim();editable.target=$('editTarget').value;editable.startKC=Math.max(0,Number($('editStartKC').value)||0);editable.huntNote=$('editHuntNote').value.trim();editable.owned={};editable.manualKC={};editable.rates={};document.querySelectorAll('[data-owned]').forEach(inp=>{const id=inp.dataset.owned;if(inp.checked){const drop=document.querySelector(`[data-drop="${id}"]`).value;editable.owned[id]={kc:drop===''?null:Math.max(0,Number(drop)||0)};}const manual=document.querySelector(`[data-manual="${id}"]`).value;if(manual!=='')editable.manualKC[id]=Math.max(0,Number(manual)||0);const rate=document.querySelector(`[data-rate="${id}"]`).value;if(rate!=='')editable.rates[id]=Math.max(1,Math.floor(Number(rate)||1));});(editable.notes||[]).forEach((n,i)=>{n.date=document.querySelector(`[data-note-date="${i}"]`)?.value||'';n.body=document.querySelector(`[data-note-body="${i}"]`)?.value||'';});}
async function save(){captureEditor();$('saveError').textContent='';$('saveBtn').disabled=true;try{const next=await api('state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(editable)});serverState=next;closeModal();toast('VAULT SAVED · LIVE FOR EVERYONE');render();await syncKC();}catch(e){$('saveError').textContent=e.message;}finally{$('saveBtn').disabled=false;}}
function init(){const glow=$('cursorGlow');window.addEventListener('pointermove',e=>{glow.style.left=e.clientX+'px';glow.style.top=e.clientY+'px';},{passive:true});$('rngRate').addEventListener('input',renderRng);$('rngKills').addEventListener('input',renderRng);$('searchPets').addEventListener('input',e=>{search=e.target.value.toLowerCase();renderVault();});$('sortPets').addEventListener('change',e=>{sort=e.target.value;renderVault();});$('filterTabs').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderVault();});$('refreshBtn').onclick=syncKC;$('editBtn').onclick=openModal;$('closeModal').onclick=closeModal;$('modalBackdrop').onclick=closeModal;$('pinInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('loginBtn').click();});$('loginBtn').onclick=async()=>{try{await api('auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:$('pinInput').value})});showEditor();}catch(e){$('loginError').textContent=e.message;}};$('logoutBtn').onclick=async()=>{try{await api('auth/logout',{method:'POST'});}catch(_){ }closeModal();toast('CONSOLE LOCKED');};$('saveBtn').onclick=save;$('addNoteBtn').onclick=()=>{captureEditor();editable.notes.push({date:new Date().toISOString().slice(0,10),body:''});renderEditNotes();};$('editNotes').addEventListener('click',e=>{const b=e.target.closest('[data-remove-note]');if(!b)return;captureEditor();editable.notes.splice(Number(b.dataset.removeNote),1);renderEditNotes();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});renderRng();render();Promise.all([loadState(),checkOwner()]).then(()=>syncKC());setInterval(syncKC,5*60*1000);setInterval(loadState,2*60*1000);}
document.addEventListener('DOMContentLoaded',init);
