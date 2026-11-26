'use strict';
const storage={get(k){try{return localStorage.getItem(k)}catch{return null}},put(k,v){try{localStorage.setItem(k,v);return true}catch{return false}},remove(k){try{localStorage.removeItem(k)}catch{}}};
const clean=s=>String(s||'').trim().replace(/[_-]/g,' ').replace(/ +/g,' ');
const valid=s=>/^[a-zA-Z0-9 ]{1,12}$/.test(s);
const fromUrl=clean(new URLSearchParams(location.search).get('player'));
const saved=clean(storage.get('peak.profile.last'));
const player=valid(fromUrl)?fromUrl:valid(saved)?saved:'';
const profileKey='peak.profile.v1.'+player.toLowerCase()+'.';
window.SNIFFIN_CONFIG={PLAYER:player,DEFAULT_TARGET:'sarachnis',TEST_MODE:false,REFRESH_MS:15*60*1000};
document.getElementById('rsn').value=player;
document.getElementById('lookup').onsubmit=e=>{e.preventDefault();const n=clean(document.getElementById('rsn').value);if(!valid(n)){document.getElementById('lookup-note').textContent='Enter a valid OSRS username (1–12 characters).';return;}storage.put('peak.profile.last',n);location.href='?player='+encodeURIComponent(n)};
if(player){document.getElementById('player-content').hidden=false;document.querySelector('.profile-name').textContent=player;document.getElementById('profile-dialog-title').textContent=player;document.title=player+' · Peak PvM Player Profile';const portrait=document.getElementById('portrait'),note=document.getElementById('lookup-note');const pic=storage.get(profileKey+'photo');if(pic&&/^data:image\/(jpeg|png|webp);base64,/.test(pic))portrait.src=pic;
document.getElementById('photo').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>10000000){note.textContent='Choose a PNG, JPEG or WebP under 10 MB.';return;}let url=URL.createObjectURL(f);try{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=c.height=320;const side=Math.min(im.width,im.height);c.getContext('2d').drawImage(im,(im.width-side)/2,(im.height-side)/2,side,side,0,0,320,320);const data=c.toDataURL('image/jpeg',.86);portrait.src=data;note.textContent=storage.put(profileKey+'photo',data)?'Picture saved on this browser.':'Picture loaded, but browser storage is unavailable.';}catch{note.textContent='Could not read that image.'}finally{URL.revokeObjectURL(url);e.target.value=''}};
document.getElementById('reset-photo').onclick=()=>{storage.remove(profileKey+'photo');portrait.src='/peak-logo.webp';note.textContent='Picture reset.'};}
