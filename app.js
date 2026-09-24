import {demoChart, analyzeRhythm, validateChart, judgmentFor, noteTime} from './chart.js';
import {DEFAULT_KEYS, normalizeSettings, validateBinding, keyLabel} from './preferences.js';
import {HitAudio} from './hit-audio.js';
import {LaneRenderer, laneGeometry} from './renderer.js';
import {slideIsHeld} from './slide.js';
import {getTheme} from './themes.js';
import {getHostedSongs} from './library.js';
import {initAuth} from './auth.js';
import {chartFingerprint, resultSummary, RANK_MARKS} from './results.js';
import {normalizeVideoDelay, videoTimeAt} from './video-sync.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = (key, fallback) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}};
const write = (key, value) => {try {localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent('six-local-change',{detail:{key}})); return true;} catch {toast('Storage is full. Export your chart to keep a copy.'); return false;}};
const time = t => `${Math.floor(Math.max(0,t)/60)}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
const settings = normalizeSettings(read('six-settings', {}));
let videoChoices=read('six-video-choices',{});
if(!videoChoices||typeof videoChoices!=='object'||Array.isArray(videoChoices))videoChoices={};
let videoOffsets=read('six-video-offsets',{});
if(!videoOffsets||typeof videoOffsets!=='object'||Array.isArray(videoOffsets))videoOffsets={};
let songs=[], manifest={}, selected, filter='all', limit=24, difficulty='normal', view='library';
let favorites=new Set(read('six-favorites',[])), charts=read('six-charts',{}), records=read('six-records',{});
let audioContext, musicGain, hitAudio, source=null, previewSource=null;
let videoPlayPending=false, videoPlayToken=0;
const bufferCache=new Map(), analyses=new Map(), imported=new Map();
const videoFiles=new Map(), videoUrls=new Map();
let previewStart=0, previewOffset=0, previewPlaying=false;
let state=null, editorChart=null, editorPage=0, noteType='tap', editorDirty=false, loading=false, pendingAudioSong=null, pendingVideoSong=null;
const pressed=new Set(), keyboardLanes=new Map(), pointers=new Map(), flickKeys=new Set();
let toastTimer, captureBinding=null;
function toast(message) {$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
function cover(song) {return manifest[song.id]?.cover||song.cover||'';}
function musicVideo(song) {return videoUrls.get(String(song.id))||manifest[song.id]?.video||'';}
function ready(song) {return !!(manifest[song.id]?.audio||imported.has(song.id)||bufferCache.has(song.id));}
function persistSettings() {write('six-settings',settings);}
function applyAppearance() {
  document.documentElement.dataset.theme=settings.theme;
  document.documentElement.style.setProperty('--art-dim',settings.backgroundDim);
  const theme=getTheme(settings.theme),label=settings.theme==='classic'?'Classic stage':`${theme.short}’s stage`;
  $('#themeChipLabel').textContent=label;
  document.title=`SEKAI / SIX — ${label}`;
  if(theme.avatar){
    const setImage=(selector,src,alt)=>{const img=$(selector);if(img.getAttribute('src')!==src)img.src=src;img.alt=alt;};
    setImage('#themeChip img',theme.avatar,'');
    setImage('.emu-hero-art',theme.standing,`${theme.name} from ${theme.unit}`);
    setImage('.game-character',theme.background||theme.card,'');
    $('.emu-hero').setAttribute('aria-label',`${theme.name} theme`);
    $('.emu-hero-copy .eyebrow').textContent=`${theme.name} · ${theme.unit}`.toUpperCase();
    $('.emu-hero-copy h2').innerHTML=theme.title.map(safe).join('<br>');
    $('.emu-hero-tag').textContent=theme.tag;
  }
  $('#gameKeys').textContent=`${settings.keys.map(keyLabel).join(' · ')}  /  ↑ ${settings.flickMode==='tap'?'TAP ASSIST':keyLabel(settings.flickKey)}`;
  $$('.lane-labels span').slice(1).forEach((el,i)=>el.textContent=keyLabel(settings.keys[i]));
}
function setView(next) {view=next;for(const id of ['library','game','editor'])$('#'+id).classList.toggle('hidden',id!==next);document.body.dataset.view=next;window.scrollTo(0,0);}
function renderLibrary() {
  const hostedSongs=getHostedSongs(songs,manifest);
  let list=hostedSongs.filter(song=>{const query=$('#search').value.toLowerCase();return `${song.title} ${song.japanese} ${song.artist} ${song.group}`.toLowerCase().includes(query)&&(filter!=='ready'||ready(song))&&(filter!=='favorite'||favorites.has(song.id))&&(filter!=='charts'||charts[song.id]);});
  if($('#sort').value==='az')list.sort((a,b)=>a.title.localeCompare(b.title));
  const hiddenCount=songs.length-hostedSongs.length;
    $('#songCount').textContent=`${list.length} playable · ${hiddenCount} hidden (no hosted audio)`;
  $('#songGrid').innerHTML=list.slice(0,limit).map(song=>`<button class="song-card ${song.id===selected?.id?'selected':''}" data-song="${song.id}" aria-label="Select ${safe(song.title)}" aria-pressed="${song.id===selected?.id}"><div class="cover-wrap" style="--hue:${(Number(song.id)*47||220)%360}">${cover(song)?`<img src="${safe(cover(song))}" alt="${safe(song.title)} cover" loading="lazy">`:''}<span class="card-badge">${charts[song.id]?'MY CHART':ready(song)?'READY TO PLAY':'CATALOG'}</span>${song.id===selected?.id?'<span class="selected-check">✓</span>':''}</div><div class="card-title">${safe(song.title)}</div><div class="card-artist">${safe(song.artist)}</div></button>`).join('')||'<p class="empty">No songs here yet. Try a different search or add your own audio.</p>';
  $('#moreSongs').classList.toggle('hidden',list.length<=limit);
  $$('.song-card img').forEach(img=>img.onerror=()=>img.style.visibility='hidden');
  $$('.song-card').forEach(button=>button.onclick=()=>{void tileClick();stopPreview();selected=songs.find(song=>String(song.id)===button.dataset.song);renderLibrary();renderDetail();if(innerWidth<761)$('#songDetail').scrollIntoView({behavior:'smooth',block:'start'});});
}
function renderDetail() {
  const song=selected;
  if(!song)return;
  const saved=charts[song.id], videoId=String(song.id), hasVideo=Boolean(musicVideo(song));
  const localVideo=videoUrls.has(videoId), videoOn=hasVideo&&videoChoices[videoId]===true;
  $('#mobileSongName').textContent=song.title;$('#mobilePlay').disabled=loading;$('#mobilePlay').onclick=()=>startGame(saved||null);$('#mobileDetails').onclick=()=>$('#songDetail').scrollIntoView({behavior:'smooth'});
  $('#songDetail').innerHTML=`<div class="detail-topline"><span>YOUR NEXT LIVE</span><button id="favoriteSong" class="icon-button ${favorites.has(song.id)?'heart':''}" aria-label="${favorites.has(song.id)?'Remove from':'Add to'} favorites">${favorites.has(song.id)?'♥':'♡'}</button></div>
    <div class="detail-cover">✦${cover(song)?`<img src="${safe(cover(song))}" alt="${safe(song.title)} cover">`:''}</div>
    <h2>${safe(song.title)}</h2><p class="japanese">${safe(song.japanese)}</p><span class="unit-tag">${safe(song.group)}</span>
    <div class="details-meta"><div><small>ARTIST</small><strong>${safe(song.artist)}</strong></div><div><small>TEMPO</small><strong>${saved?.bpm||song.bpm} ${song.estimated&&!saved?'est. ':''}BPM</strong></div><div><small>LENGTH</small><strong>${time(bufferCache.get(song.id)?.duration||song.duration)}</strong></div></div>
    <p class="small-heading">CHOOSE YOUR DIFFICULTY</p><div class="difficulties">${[['easy','EASY',6],['normal','NORMAL',12],['hard','HARD',19]].map(([id,label,n])=>`<button class="difficulty ${difficulty===id?'active':''}" data-diff="${id}">${label}<b>${n}</b></button>`).join('')}</div>
    <div class="mv-choice"><div class="mv-copy"><strong>Music video</strong><small id="mvHint">${hasVideo?(localVideo?'Saved in this browser only.':'Video included with this song.'):'No matching MMD yet. Add a local MP4 or WebM to enable video.'}</small></div><label class="mv-toggle"><input id="mvToggle" type="checkbox" aria-label="Play ${safe(song.title)} with its music video" aria-describedby="mvHint" ${videoOn?'checked':''} ${hasVideo?'':'disabled'}><span>${videoOn?'On':'Off'}</span></label><button id="addVideo" type="button" class="secondary">${localVideo?'↻ Replace':'＋ Add MMD'}</button>${hasVideo?`<div class="mv-timing"><label for="mvDelay">Video delay <small>+ if video leads music; − to skip its intro</small></label><div class="mv-timing-field"><input id="mvDelay" type="number" min="-10" max="10" step="0.05" value="${normalizeVideoDelay(videoOffsets[videoId]).toFixed(2)}" aria-label="Video delay in seconds"><span>s</span></div></div>`:''}</div>
    <p class="audio-note">${ready(song)?'● Audio ready':'○ Online audio · loads when you play'}<br>${saved?'Your saved chart is selected. Try the new demo below for fresh patterns.':'Song-specific practice chart · taps, holds & upward flicks.'}${song.estimated&&!saved?' Tempo is an estimate; adjust it in Chart Studio.':''}</p>
    <button id="playSong" class="primary full" ${loading?'disabled':''}>${loading?'Preparing audio…':'▶ &nbsp; Play '+(saved?'my chart':'demo')}</button>
    <div class="detail-controls"><button id="openEditor" class="secondary">＋ Chart Studio</button><button id="attachAudio" class="secondary">↑ Replace audio</button></div>${saved?'<button id="playDemo" class="text-button full">Try the new demo arrangement</button>':''}
    <div class="key-guide"><div>${settings.keys.map(key=>`<kbd>${safe(keyLabel(key))}</kbd>`).join('')}</div><p>↑ Flick: ${settings.flickMode==='tap'?'tap assist':safe(keyLabel(settings.flickKey))+' + lane'} · or swipe up</p><button id="editBindings" class="text-button">Customize controls →</button><p class="help">${records[song.id]?'Personal best · '+Number(records[song.id]).toLocaleString():'Hit the line. Follow the rhythm.'}</p></div>`;
  $('.detail-cover img')?.addEventListener('error',e=>e.target.style.visibility='hidden');
  $('#favoriteSong').onclick=()=>{favorites.has(song.id)?favorites.delete(song.id):favorites.add(song.id);write('six-favorites',[...favorites]);renderDetail();renderLibrary();};
  $$('[data-diff]').forEach(button=>button.onclick=()=>{difficulty=button.dataset.diff;renderDetail();});
  $('#mvToggle').onchange=event=>{videoChoices={...videoChoices,[videoId]:event.target.checked};write('six-video-choices',videoChoices);event.target.nextElementSibling.textContent=event.target.checked?'On':'Off';};
  $('#mvDelay')?.addEventListener('change',event=>{const delay=normalizeVideoDelay(event.target.value);videoOffsets={...videoOffsets,[videoId]:delay};write('six-video-offsets',videoOffsets);event.target.value=delay.toFixed(2);});
  $('#addVideo').onclick=()=>{pendingVideoSong=song;$('#videoFile').click();};
  $('#playSong').onclick=()=>startGame(saved||null);$('#playDemo')?.addEventListener('click',()=>startGame(null));$('#openEditor').onclick=openEditor;
  $('#attachAudio').onclick=()=>{pendingAudioSong=song;$('#audioFile').click();};$('#editBindings').onclick=()=>showSettings('controls');
}
async function audioInit() {
  if(!audioContext){
    audioContext=new AudioContext({latencyHint:'interactive'});
    musicGain=audioContext.createGain();musicGain.connect(audioContext.destination);
    hitAudio=new HitAudio(audioContext);
  }
  musicGain.gain.value=settings.volume;
  await audioContext.resume();
  return hitAudio;
}
async function tileClick() {
  try {
    const audio=await audioInit();
    await audio.loadOriginal();
    audio.play({type:'ui'},Math.min(.3,settings.hitVolume),settings.hitSound);
  } catch { /* A song tile still works if the browser blocks UI audio. */ }
}
async function getBuffer(song) {
  if(bufferCache.has(song.id))return bufferCache.get(song.id);await audioInit();let data;
  if(imported.has(song.id))data=await imported.get(song.id).arrayBuffer();
  else{const url=manifest[song.id]?.audio||song.audio;if(!url)throw Error('Add an audio file for this song first.');const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('Audio unavailable. Use Replace audio to attach an MP3 or WAV.');data=await response.arrayBuffer();}
  const buffer=await audioContext.decodeAudioData(data);bufferCache.set(song.id,buffer);return buffer;
}
function arrangement(song,buffer) {if(buffer&&!analyses.has(song.id))analyses.set(song.id,analyzeRhythm(buffer));return demoChart(song,difficulty,analyses.get(song.id));}
function stopSource() {if(source){try{source.stop();}catch{}source.disconnect();source=null;}}
function stopPreview() {if(previewSource){previewSource.onended=null;try{previewSource.stop();}catch{}previewSource.disconnect();previewSource=null;}previewPlaying=false;$('#previewAudio').textContent='▶ Listen';}
function playBuffer(buffer,when,offset) {stopSource();source=audioContext.createBufferSource();source.buffer=buffer;source.connect(musicGain);source.start(when,Math.max(0,Math.min(offset,buffer.duration-.001)));}
function setGameVideoLive(live) {
  $('#gameVideo').classList.toggle('video-live',live);
  $('#game').dataset.video=live?'on':state?.videoEnabled?'waiting':'off';
  if(state)state.videoLive=live;
}
function pauseGameVideo() {
  videoPlayToken++;videoPlayPending=false;
  $('#gameVideo').pause();setGameVideoLive(false);
}
function prepareGameVideo(song,enabled) {
  const video=$('#gameVideo'),url=enabled?musicVideo(song):'';
  pauseGameVideo();video.onloadedmetadata=null;
  if(!url){video.classList.add('hidden');video.removeAttribute('src');video.load();$('#game').dataset.video='off';return false;}
  video.classList.remove('hidden');
  if(video.src!==new URL(url,location.href).href){video.src=url;video.load();}
  const seek=()=>{if(state?.song!==song||!state.videoEnabled)return;video.currentTime=videoTimeAt(gameTime(),state.videoDelay,video.duration)??0;};
  video.onloadedmetadata=seek;
  if(video.readyState>=1)seek();
  return true;
}
function seekGameVideo(position) {const video=$('#gameVideo');pauseGameVideo();if(state?.videoEnabled&&video.readyState>=1)video.currentTime=videoTimeAt(position,state.videoDelay,video.duration)??0;}
function syncGameVideo() {
  if(!state?.videoEnabled)return;
  const video=$('#gameVideo');
  const target=videoTimeAt(gameTime(),state.videoDelay,video.duration);
  if(state.paused||state.finished||audioContext.currentTime<state.readyAt||target===null){
    if(!video.paused||state.videoLive||videoPlayPending)pauseGameVideo();
    if(target===null&&video.readyState>=1&&video.currentTime>.05)video.currentTime=0;
    return;
  }
  if(video.readyState<2||video.seeking){setGameVideoLive(false);return;}
  if(Math.abs(video.currentTime-target)>.24){setGameVideoLive(false);video.currentTime=target;return;}
  if(video.paused){
    if(videoPlayPending)return;
    videoPlayPending=true;const token=++videoPlayToken;
    video.play().then(()=>{
      if(token!==videoPlayToken)return;
      videoPlayPending=false;
      if(state?.videoEnabled&&!state.paused&&!state.finished&&video.readyState>=2&&!video.seeking&&audioContext.currentTime>=state.readyAt&&videoTimeAt(gameTime(),state.videoDelay,video.duration)!==null)setGameVideoLive(true);
      else pauseGameVideo();
    }).catch(()=>{if(token===videoPlayToken){videoPlayPending=false;setGameVideoLive(false);}});
  }else setGameVideoLive(true);
}
function clearInputs() {pressed.clear();keyboardLanes.clear();pointers.clear();flickKeys.clear();}
function refreshPressed() {pressed.clear();for(const lane of keyboardLanes.values())pressed.add(lane);for(const pointer of pointers.values())pressed.add(pointer.lane);}
async function startGame(chart,fromEditor=false) {
  if(loading)return;const song=selected,requestedView=view;loading=true;if(view==='library')renderDetail();
  try{
    toast('Preparing your live…');stopPreview();const audio=await audioInit();const buffer=await getBuffer(song);await audio.loadOriginal();if(selected!==song||view!==requestedView)return;
    const custom=!!chart;chart=validateChart(chart||arrangement(song,buffer));if(!chart.notes.length)throw Error('Add a few notes to your chart before playing.');
    const notes=chart.notes.map(note=>{
      const t=noteTime(note,chart)+settings.offset/1000;
      const runtime={...note,t,end:t+note.duration*60/chart.bpm,status:'pending'};
      if(note.type==='slide')runtime.path=note.points.map(point=>({...point,t:t+point.beat*60/chart.bpm}));
      return runtime;
    });
    if(notes.some(note=>note.t<0||note.end>buffer.duration))throw Error('Some notes fall outside the audio. Adjust the offset or shorten your chart.');
    clearInputs();const startOffset=Math.max(0,Math.min(...notes.map(note=>note.t))-2),readyAt=audioContext.currentTime+2.5;
    const videoEnabled=videoChoices[String(song.id)]===true&&Boolean(musicVideo(song));
    state={song,chart,notes,buffer,readyAt,started:readyAt-startOffset,position:startOffset,countdown:3,paused:false,finished:false,score:0,combo:0,maxCombo:0,life:1000,counts:{PERFECT:0,GREAT:0,GOOD:0,BAD:0,MISS:0},timing:{FAST:0,LATE:0,FLICK:0},difficulty,flashes:Array(6).fill(-1000),particles:[],lastJudge:0,fromEditor,custom,videoEnabled,videoLive:false,videoDelay:normalizeVideoDelay(videoOffsets[String(song.id)])};
    setView('game');$('#gameOverlay').classList.remove('is-result');$('#gameOverlay').classList.add('hidden');$('#playingTitle').textContent=song.title;$('#playingInfo').textContent=`${chart.bpm} BPM · ${notes.length} notes · ${custom?'CUSTOM':'REMIX DEMO'}`;
    $('#gameMode').textContent=fromEditor?'CHART TEST':settings.practice?'PRACTICE · NO FAIL':'CHALLENGE';$('#judgment').textContent='';applyAppearance();prepareGameVideo(song,videoEnabled);playBuffer(buffer,readyAt,startOffset);updateHUD();$('#toast').classList.remove('show');
  }catch(error){toast(error.message.includes('fetch')?'Audio could not load. Use Replace audio to attach a local file.':error.message);}
  finally{loading=false;if(view==='library')renderDetail();}
}
function gameTime() {return state.paused||state.finished||audioContext.currentTime<state.readyAt?state.position:audioContext.currentTime-state.started;}
function updateHUD() {$('#score').textContent=String(Math.round(state.score)).padStart(7,'0');$('#combo').textContent=state.combo;$('#life').value=state.life;$('#lifeValue').textContent=Math.round(state.life);}
function successfulSound(note,result,phase='note') {
  if(!['PERFECT','GREAT','GOOD'].includes(result))return;
  const type=phase==='checkpoint'?'slideTick':phase==='release'?'release':note.type;
  hitAudio?.play({type,judgment:result,critical:note.type==='accent'||note.critical},settings.hitVolume,settings.hitSound);
}
function judge(note,result,delta=null,{wrongFlick=false}={}) {
  if(note.status==='done'||state.finished)return;note.status='done';state.counts[result]++;state.score+=1000000/state.notes.length*({PERFECT:1,GREAT:.8,GOOD:.5,BAD:.2,MISS:0}[result]);
  if(wrongFlick)state.timing.FLICK++;
  if(result!=='PERFECT'&&result!=='MISS'&&Number.isFinite(delta)&&Math.abs(delta)>.045)state.timing[delta<0?'FAST':'LATE']++;
  if(result==='MISS'||result==='BAD'){state.combo=0;state.life=Math.max(0,state.life-(result==='MISS'?75:35));}
  else{if(result==='GOOD')state.combo=0;else{state.combo++;state.maxCombo=Math.max(state.maxCombo,state.combo);}state.life=Math.min(1000,state.life+5);state.flashes[note.lane]=performance.now();successfulSound(note,result,['hold','slide'].includes(note.type)?'release':'note');}
  $('#judgment').textContent=result;$('#judgment').style.color=result==='MISS'?'#e8a1ba':result==='PERFECT'?'#d5ffeb':'#ffe0a4';state.lastJudge=performance.now();
  if(settings.effects&&!['MISS','BAD'].includes(result))for(let i=0;i<9;i++)state.particles.push({lane:note.lane,type:note.type,age:0,vx:(Math.random()-.5)*120,vy:-(Math.random()*140+45),x:0,y:0});
  updateHUD();if(!state.life&&!settings.practice&&!state.fromEditor)finishGame(true);
}
function activePlay() {return view==='game'&&state&&!state.paused&&!state.finished&&!$('#settingsDialog').open&&audioContext.currentTime>=state.readyAt;}
function hit(lane,isFlick=false) {
  if(!activePlay())return;state.flashes[lane]=performance.now();const t=gameTime(),note=state.notes.find(n=>n.lane===lane&&n.status==='pending'&&Math.abs(t-n.t)<=.18);if(!note)return;
  if(note.type==='flick'&&!isFlick&&settings.flickMode!=='tap')return;const result=judgmentFor(t-note.t);
  if(['hold','slide'].includes(note.type)&&result!=='BAD'){
    note.status='holding';note.headJudgment=result;note.headDelta=t-note.t;note.nextCheckpoint=1;successfulSound(note,result);
  }else judge(note,result,t-note.t);
}
function flick(lane,wrongDirection=false) {if(!activePlay())return false;const t=gameTime(),note=state.notes.find(n=>n.lane===lane&&n.type==='flick'&&n.status==='pending'&&Math.abs(t-n.t)<=.18);if(!note)return false;const timing=judgmentFor(t-note.t);judge(note,wrongDirection&&timing==='PERFECT'?'GREAT':timing,t-note.t,{wrongFlick:wrongDirection});return true;}
function isHeld(note,t) {return note.type==='slide'?slideIsHeld(note,t,pressed):pressed.has(note.lane);}
function release() {
  refreshPressed();if(!activePlay())return;
  const t=gameTime();
  for(const note of state.notes)if(note.status==='holding'&&!isHeld(note,t))judge(note,t>=note.end-.1?note.headJudgment:'MISS',t>=note.end-.1?note.headDelta:null);
}
function pauseGame() {
  if(!state||state.finished||view!=='game')return;if(state.paused){resumeGame();return;}state.position=gameTime();state.paused=true;seekGameVideo(state.position);stopSource();clearInputs();
  $('#gameOverlay').innerHTML=`<div class="overlay-card"><p class="eyebrow">TAKE A BREATH</p><h2>On your time.</h2><p>You’ll get a short count-in when you resume.<br>Re-hold any mint notes during the count-in.</p><button id="resume" class="primary full">▶ Resume</button><button id="restart" class="secondary full">↻ Restart</button><button id="pauseSettings" class="glass-button full">Controls & settings</button><button id="leave" class="glass-button full">${state.fromEditor?'Back to Chart Studio':'Back to library'}</button></div>`;
  $('#gameOverlay').classList.remove('hidden');$('#resume').onclick=resumeGame;$('#restart').onclick=()=>startGame(state.custom?state.chart:null,state.fromEditor);$('#pauseSettings').onclick=()=>showSettings('controls');$('#leave').onclick=leaveGame;
}
async function resumeGame() {if(!state?.paused||$('#settingsDialog').open)return;await audioInit();state.readyAt=audioContext.currentTime+1.2;state.started=state.readyAt-state.position;state.paused=false;state.resumeGrace=state.readyAt+.15;seekGameVideo(state.position);playBuffer(state.buffer,state.readyAt,state.position);$('#gameOverlay').classList.add('hidden');}
function finishGame(failed=false) {
  if(!state||state.finished)return;state.position=gameTime();state.finished=true;stopSource();pauseGameVideo();clearInputs();const score=Math.round(state.score);
  const recordKey=`${state.song.id}:${state.custom?'custom':state.difficulty}:${chartFingerprint(state.chart)}`;
  const previousBest=Number(records[recordKey])||0,isNewBest=!failed&&score>previousBest;
  if(isNewBest){records[recordKey]=score;records[state.song.id]=Math.max(Number(records[state.song.id])||0,score);write('six-records',records);}
  const summary=resultSummary({score,counts:state.counts,totalNotes:state.notes.length,maxCombo:state.maxCombo,failed,timing:state.timing});
  const theme=getTheme(settings.theme),art=theme.standing?`<img class="results-character" src="${safe(theme.standing)}" alt="" aria-hidden="true">`:'';
  const songCover=cover(state.song)?`<img src="${safe(cover(state.song))}" alt="" aria-hidden="true">`:'<span aria-hidden="true">✦</span>';
  const diff=state.custom?'CUSTOM':state.difficulty.toUpperCase(),level=state.custom?'MY CHART':{easy:'LV. 6',normal:'LV. 12',hard:'LV. 19'}[state.difficulty];
  const markers=RANK_MARKS.map(mark=>`<span class="results-rank-mark" style="--mark:${mark.score/1000000*100}%">${mark.label}</span>`).join('');
  const countRow=(label,value)=>`<div class="results-judgment-row results-judgment-${label.toLowerCase()}"><dt>${label}</dt><dd>${String(value).padStart(4,'0')}</dd></div>`;
  $('#gameOverlay').classList.add('is-result');
  $('#gameOverlay').innerHTML=`<section class="results-screen" data-art="${Boolean(theme.standing)}" aria-labelledby="resultsTitle">
    <header class="results-header"><div class="results-song"><div class="results-cover">${songCover}</div><div class="results-song-copy"><p class="results-kicker" id="resultsTitle">LIVE RESULT <span> / SIX KEYS</span></p><h2>${safe(state.song.title)}</h2><span class="results-difficulty" data-difficulty="${state.custom?'custom':state.difficulty}">${diff} <small>${level}</small></span></div></div><div class="results-rank"><div class="results-rank-caption">SCORE RANK</div><div class="results-rank-rail" role="img" aria-label="Score rank ${summary.rank} on this demo's one million point scale"><div class="results-rank-track"><span class="results-rank-fill" style="width:${summary.progress}%"></span>${markers}</div></div></div><div class="results-rank-letter" aria-hidden="true">${summary.rank}<small>RANK</small></div></header>
    <div class="results-body"><div class="results-main"><div class="results-clear-badge" data-clear="${failed?'failed':summary.badge==='ALL PERFECT'?'perfect':summary.badge==='FULL COMBO'?'full':'complete'}"><span aria-hidden="true">${failed?'◇':'✦'}</span> ${summary.badge}</div><div class="results-score-card"><div class="results-score-label">YOUR SCORE ${isNewBest?'<span class="results-new-best">↗ NEW BEST</span>':''}</div><div class="results-score">${String(score).padStart(7,'0')}</div><div class="results-best"><span>PERSONAL BEST</span><strong>${String(Math.max(previousBest,failed?0:score)).padStart(7,'0')}</strong></div></div><div class="results-breakdown"><div class="results-judgments"><h3 class="results-section-title">NOTE JUDGMENTS</h3><dl>${countRow('PERFECT',state.counts.PERFECT)}${countRow('GREAT',state.counts.GREAT)}${countRow('GOOD',state.counts.GOOD)}${countRow('BAD',state.counts.BAD)}${countRow('MISS',state.counts.MISS)}</dl></div><div class="results-performance"><div class="results-metrics"><div class="results-combo"><span>MAX COMBO</span><strong>${state.maxCombo}</strong></div><div class="results-accuracy"><span>ACCURACY</span><strong>${summary.accuracy.toFixed(1)}<small>%</small></strong></div></div><h3 class="results-section-title">TIMING</h3><div class="results-timing"><div><span>LATE</span><b>${summary.late}</b></div><div><span>FAST</span><b>${summary.fast}</b></div></div><div class="results-flick" title="Flicks judged in the wrong direction"><span>↗ FLICK ERRORS</span><b>${summary.flick}</b></div></div></div></div><div class="results-art" aria-hidden="true"><div class="results-art-orbit"></div>${art}${theme.standing?`<div class="results-character-caption"><span>${safe(theme.unit)}</span><strong>${safe(theme.name)}</strong></div>`:''}</div></div>
    <footer class="results-actions"><span class="results-footer-note">${failed?'A fresh start. Another chance.':'Every note is a little progress.'}</span><button id="resultBack" class="glass-button">${state.fromEditor?'← Chart Studio':'← Library'}</button><button id="retry" class="primary">↻ Play again</button></footer></section>`;
  $('#gameOverlay').classList.remove('hidden');$('#retry').onclick=()=>startGame(state.custom?state.chart:null,state.fromEditor);$('#resultBack').onclick=leaveGame;
}
function leaveGame() {stopSource();pauseGameVideo();$('#gameVideo').classList.add('hidden');$('#game').dataset.video='off';$('#gameOverlay').classList.remove('is-result');clearInputs();const back=state?.fromEditor;state=null;if(back){setView('editor');drawWave();}else{setView('library');renderLibrary();renderDetail();}}
const canvas=$('#gameCanvas'),renderer=new LaneRenderer(canvas);let lastFrame=performance.now();
function frame(now) {
  requestAnimationFrame(frame);const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;if(view!=='game'||!state)return;
  const t=gameTime();syncGameVideo();state.countdown=Math.max(0,Math.ceil(state.readyAt-audioContext.currentTime));
  if(activePlay()){
    for(const note of state.notes){
      if(note.status==='pending'&&t>note.t+.18)judge(note,'MISS');
      else if(note.status==='holding'){
        const held=isHeld(note,t);
        if(!held&&(!state.resumeGrace||audioContext.currentTime>state.resumeGrace))judge(note,'MISS');
        else if(t>=note.end-.025)judge(note,note.headJudgment,note.headDelta);
        else if(note.type==='slide'){
          while(note.nextCheckpoint<note.path.length-1&&t>=note.path[note.nextCheckpoint].t){
            successfulSound(note,'PERFECT','checkpoint');note.nextCheckpoint++;
          }
        }
      }
      if(state.finished)break;
    }
    if(t>=Math.max(state.buffer.duration,...state.notes.map(n=>n.end+.19))&&!state.finished)finishGame();
  }
  renderer.draw(state,t,settings,pressed,now,dt);if(now-state.lastJudge>650&&!state.paused)$('#judgment').textContent='';$('#gameTime').textContent=`${time(t)} / ${time(state.buffer.duration)}`;$('#gameProgress').style.width=`${Math.max(0,Math.min(100,t/state.buffer.duration*100))}%`;
}
requestAnimationFrame(frame);
function keyToken(event) {if(/^Key[A-Z]$/.test(event.code))return event.code.slice(3).toLowerCase();if(/^Digit[0-9]$/.test(event.code))return event.code.slice(5);return event.key.toLowerCase();}
document.addEventListener('keydown',event=>{
  if($('#settingsDialog').open||view!=='game'||event.target.matches?.('input,select,textarea'))return;
  if(event.key==='Escape'){event.preventDefault();if(!event.repeat)pauseGame();return;}const token=keyToken(event),id=event.code||token;if(event.repeat)return;
  if(token===settings.flickKey){event.preventDefault();flickKeys.add(id);for(const lane of pressed)flick(lane);return;}
  const lane=settings.keys.indexOf(token);if(lane<0)return;event.preventDefault();if(keyboardLanes.has(id))return;keyboardLanes.set(id,lane);refreshPressed();hit(lane,flickKeys.size>0);
});
document.addEventListener('keyup',event=>{const token=keyToken(event),id=event.code||token;flickKeys.delete(id);const lane=keyboardLanes.get(id);keyboardLanes.delete(id);if(lane!==undefined)release();});
canvas.addEventListener('pointerdown',event=>{
  if(!state||state.paused||state.finished)return;const rect=canvas.getBoundingClientRect(),lane=laneGeometry(rect.width,rect.height,settings.laneMode).laneAt(event.clientX-rect.left);if(lane<0||lane>5)return;
  canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{lane,startLane:lane,x:event.clientX,startY:event.clientY,y:event.clientY,last:performance.now(),distance:0,used:false});refreshPressed();hit(lane);
});
canvas.addEventListener('pointermove',event=>{
  const pointer=pointers.get(event.pointerId);if(!pointer)return;
  const rect=canvas.getBoundingClientRect(),nextLane=laneGeometry(rect.width,rect.height,settings.laneMode).laneAt(event.clientX-rect.left);
  if(nextLane>=0&&nextLane<6&&nextLane!==pointer.lane){pointer.lane=nextLane;refreshPressed();}
  if(pointer.used)return;
  const now=performance.now(),dy=pointer.y-event.clientY;
  if(now-pointer.last>180||dy<0)pointer.distance=0;
  pointer.distance+=Math.max(0,dy);pointer.last=now;pointer.y=event.clientY;
  if(pointer.distance>=18){pointer.used=true;flick(pointer.lane);}
  else if(Math.hypot(event.clientX-pointer.x,event.clientY-pointer.startY)>=25&&pointer.startY-event.clientY<10){pointer.used=flick(pointer.startLane,true);}
});
function pointerEnd(event) {const pointer=pointers.get(event.pointerId);pointers.delete(event.pointerId);if(pointer)release();}
canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);
window.addEventListener('blur',()=>{if(view==='game'&&state&&!state.paused&&!state.finished)pauseGame();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&view==='game'&&state&&!state.paused&&!state.finished)pauseGame();});
$('#pauseGame').onclick=pauseGame;$('#exitGame').onclick=()=>{if(state&&!state.finished&&!state.paused)pauseGame();else leaveGame();};

async function openEditor() {
  if(loading)return;stopPreview();const song=selected;let buffer=bufferCache.get(song.id);
  if(!charts[song.id]&&!buffer&&ready(song)){try{loading=true;toast('Preparing your song’s chart…');buffer=await getBuffer(song);}catch{toast('Audio will load when you preview.');}finally{loading=false;}if(selected!==song)return;}
  editorChart=structuredClone(charts[song.id]||arrangement(song,buffer));editorPage=0;editorDirty=false;
  $('#chartBpm').value=editorChart.bpm;$('#chartOffset').value=editorChart.offset;$('#editorTitle').textContent=song.title;
  $('#editorStatus').textContent=charts[song.id]?'Loaded your saved chart.':'Fresh demo chart loaded. Edit it or clear it to start your own.';
  $('#editorSeek').max=buffer?.duration||song.duration;$('#editorSeek').value=0;previewOffset=0;$('#editorPosition').textContent='0:00';setView('editor');applyAppearance();renderEditor();drawWave();
}
function syncTiming() {const bpm=Number($('#chartBpm').value),offset=Number($('#chartOffset').value);if(!Number.isFinite(bpm)||bpm<30||bpm>400||!Number.isFinite(offset)||offset< -10||offset>600)throw Error('Use BPM 30–400 and an offset between −10 and 600 seconds.');editorChart.bpm=bpm;editorChart.offset=offset;}
function dirty() {editorDirty=true;$('#editorStatus').textContent='Unsaved changes · save or export your chart.';}
function renderEditor() {
  const snap=Number($('#snap').value),start=editorPage*8,end=start+8;
  $('#beatRange').textContent=`Beats ${start+1}–${end} · measures ${Math.floor(start/4)+1}–${Math.floor(end/4)}`;$('#prevPage').disabled=editorPage===0;$('#noteCount').textContent=`${editorChart.notes.length} notes`;
  let html='';for(let beat=start;beat<end-.0001;beat+=snap){html+=`<div class="beat-row ${beat%4===0?'downbeat':''}"><span class="beat-label">${Number.isInteger(beat)?beat+1:'·'}</span>`;
    for(let lane=0;lane<6;lane++){
      const note=editorChart.notes.find(n=>n.lane===lane&&Math.abs(n.beat-beat)<.0001);
      const tail=editorChart.notes.some(n=>['hold','slide'].includes(n.type)&&n.lane===lane&&beat>n.beat&&beat<=n.beat+n.duration);
      const icon=note?.type==='flick'?'↑':note?.type==='slide'?'⌁':'';
      html+=`<button class="note-cell ${note?'has-note '+note.type:''} ${tail?'tail':''}" data-beat="${beat}" data-lane="${lane}" aria-label="${note?'Remove '+note.type:'Place '+noteType} note, beat ${beat+1}, lane ${safe(keyLabel(settings.keys[lane]))}" aria-pressed="${!!note}">${icon?`<span aria-hidden="true">${icon}</span>`:''}</button>`;
    }html+='</div>';}
  $('#noteGrid').innerHTML=html;$$('.note-cell').forEach(cell=>{cell.onclick=()=>editCell(Number(cell.dataset.beat),Number(cell.dataset.lane),false);cell.oncontextmenu=event=>{event.preventDefault();editCell(Number(cell.dataset.beat),Number(cell.dataset.lane),true);};});
}
function makeSlidePoints(lane,duration) {
  const handStart=Math.floor(lane/3)*3,local=lane-handStart;
  const centerIndex=lane<3?2:0,edgeIndex=lane<3?0:2;
  const stepToward=target=>{
    const next=local<target?local+1:local>target?local-1:(target===0?1:target-1);
    return handStart+next;
  };
  const center=stepToward(centerIndex),edge=stepToward(edgeIndex),shape=$('#slideShape').value;
  if(shape==='center'||shape==='edge')return [{beat:0,lane,ease:'smooth'},{beat:duration,lane:shape==='center'?center:edge,ease:'smooth'}];
  if(shape==='zigzag'){
    const second=center===edge?handStart+(centerIndex===2?0:2):edge;
    return [{beat:0,lane,ease:'smooth'},{beat:duration/3,lane:center,ease:'smooth'},{beat:duration*2/3,lane:second,ease:'smooth'},{beat:duration,lane,ease:'smooth'}];
  }
  const target=shape==='edge-return'?edge:center;
  return [{beat:0,lane,ease:'smooth'},{beat:duration/2,lane:target,ease:'smooth'},{beat:duration,lane,ease:'smooth'}];
}
function editCell(beat,lane,remove) {
  const index=editorChart.notes.findIndex(n=>n.lane===lane&&Math.abs(n.beat-beat)<.0001);
  if(index>=0)editorChart.notes.splice(index,1);
  else if(!remove){
    const duration=['hold','slide'].includes(noteType)?Number($('#holdLength').value):0;
    const note={beat,lane,type:noteType,duration};
    if(noteType==='slide')note.points=makeSlidePoints(lane,duration);
    try{validateChart({...editorChart,notes:[...editorChart.notes,note]});editorChart.notes.push(note);}catch(error){toast(error.message);return;}
  }
  dirty();renderEditor();
}
function saveEditor() {try{syncTiming();const chart=validateChart({...editorChart,songId:selected.id});if(!chart.notes.length)throw Error('Add at least one note before saving.');charts[selected.id]=chart;if(!write('six-charts',charts))return false;editorDirty=false;$('#editorStatus').textContent='Saved on this device. Export JSON for a portable backup.';toast('Chart saved');return true;}catch(error){toast(error.message);return false;}}
$('#saveChart').onclick=saveEditor;$('#testChart').onclick=()=>{try{syncTiming();startGame(editorChart,true);}catch(error){toast(error.message);}};
$('#editorBack').onclick=()=>{if(editorDirty&&!confirm('Leave Chart Studio without saving your changes?'))return;stopPreview();editorDirty=false;setView('library');renderLibrary();renderDetail();};
$('#prevPage').onclick=()=>{editorPage=Math.max(0,editorPage-1);renderEditor();};$('#nextPage').onclick=()=>{if(editorPage*8>100000)return;editorPage++;renderEditor();};$('#snap').onchange=renderEditor;
function updateEditorToolUI() {$('#slideShapeField').classList.toggle('hidden',noteType!=='slide');}
$$('[data-type]').forEach(button=>button.onclick=()=>{noteType=button.dataset.type;$$('[data-type]').forEach(b=>b.classList.toggle('active',b===button));updateEditorToolUI();renderEditor();});
$('#chartBpm').onchange=$('#chartOffset').onchange=dirty;
$('#clearChart').onclick=()=>{if(confirm('Remove all notes from this working chart? Your saved chart stays unchanged until you save.')){editorChart.notes=[];dirty();renderEditor();}};
$('#newDemoChart').onclick=()=>{if(editorDirty&&!confirm('Replace this unsaved working chart with a fresh demo?'))return;editorChart=arrangement(selected,bufferCache.get(selected.id));$('#chartBpm').value=editorChart.bpm;$('#chartOffset').value=editorChart.offset;editorPage=0;dirty();renderEditor();};
$('#exportChart').onclick=()=>{try{syncTiming();const chart=validateChart(editorChart),url=URL.createObjectURL(new Blob([JSON.stringify(chart,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=selected.title.replace(/[^a-zA-Z0-9]/g,'-')+'-6k.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Chart exported');}catch(error){toast(error.message);}};
$('#importChart').onclick=()=>$('#chartFile').click();
$('#chartFile').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;try{if(file.size>5000000)throw Error('Chart file is too large (maximum 5 MB).');const parsed=validateChart(JSON.parse(await file.text()));if(parsed.songId!==selected.id&&!confirm('This chart was made for another song. Import it onto the selected song?'))return;editorChart={...parsed,songId:selected.id};$('#chartBpm').value=parsed.bpm;$('#chartOffset').value=parsed.offset;editorPage=0;dirty();renderEditor();toast('Chart imported');}catch(error){toast('Could not import: '+error.message);}};
async function preview() {
  if(previewPlaying){previewOffset=audioContext.currentTime-previewStart;stopPreview();return;}
  try{await audioInit();const buffer=await getBuffer(selected);$('#editorSeek').max=buffer.duration;if(previewOffset>=buffer.duration)previewOffset=0;previewSource=audioContext.createBufferSource();previewSource.buffer=buffer;previewSource.connect(musicGain);previewSource.start(0,previewOffset);previewStart=audioContext.currentTime-previewOffset;previewPlaying=true;previewSource.onended=()=>{if(previewPlaying){stopPreview();previewOffset=0;}};$('#previewAudio').textContent='Ⅱ Pause';drawWave();}catch{toast('Preview unavailable. Add local audio from the library.');}
}
$('#previewAudio').onclick=preview;$('#editorSeek').oninput=()=>{const wasPlaying=previewPlaying;stopPreview();previewOffset=Number($('#editorSeek').value);$('#editorPosition').textContent=time(previewOffset);if(wasPlaying)preview();};
setInterval(()=>{if(view==='editor'&&previewPlaying){const t=audioContext.currentTime-previewStart;$('#editorSeek').value=t;$('#editorPosition').textContent=time(t);}},100);
function drawWave() {const canvas=$('#waveform'),rect=canvas.getBoundingClientRect();if(!rect.width)return;canvas.width=Math.round(rect.width*devicePixelRatio);canvas.height=65*devicePixelRatio;const ctx=canvas.getContext('2d');ctx.scale(devicePixelRatio,devicePixelRatio);const buffer=bufferCache.get(selected.id);ctx.clearRect(0,0,rect.width,65);if(!buffer){ctx.fillStyle='#7b8791';ctx.font='11px sans-serif';ctx.fillText('Press Listen to load the waveform.',18,37);return;}const data=buffer.getChannelData(0);ctx.fillStyle=settings.theme==='emu'?'#d16b98':'#70bfb8';for(let p=0;p<rect.width;p+=3){let max=0;const at=Math.floor(p/rect.width*data.length),stride=Math.max(1,Math.floor(data.length/rect.width/20));for(let j=0;j<20;j++)max=Math.max(max,Math.abs(data[Math.min(data.length-1,at+j*stride)]));const height=Math.max(1,max*48);ctx.fillRect(p,(65-height)/2,2,height);}}
window.addEventListener('resize',()=>{if(view==='editor')drawWave();});
let dbPromise;
function db() {return dbPromise??=new Promise((resolve,reject)=>{const request=indexedDB.open('sekai-six-audio',2);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains('songs'))database.createObjectStore('songs',{keyPath:'id'});if(!database.objectStoreNames.contains('videos'))database.createObjectStore('videos',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function storeAudio(item) {const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('songs','readwrite');tx.objectStore('songs').put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function storeVideo(item) {const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('videos','readwrite');tx.objectStore('videos').put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
function useVideoFile(id,file) {const key=String(id),old=videoUrls.get(key);if(old)URL.revokeObjectURL(old);videoFiles.set(key,file);videoUrls.set(key,URL.createObjectURL(file));}
async function restoreVideos() {try{const database=await db(),entries=await new Promise((resolve,reject)=>{const request=database.transaction('videos').objectStore('videos').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});for(const item of entries)if(item?.file)useVideoFile(item.id,item.file);}catch{toast('Saved videos could not be restored in this browser.');}}
async function restoreAudio() {try{const database=await db(),entries=await new Promise((resolve,reject)=>{const request=database.transaction('songs').objectStore('songs').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});for(const item of entries){imported.set(item.id,item.file);const index=songs.findIndex(song=>song.id===item.id);if(item.song){if(index<0)songs.unshift(item.song);else songs[index]={...songs[index],...item.song};}}}catch{toast('Local audio storage is unavailable. Imports will last for this session.');}}
$('#customSong').onclick=()=>{pendingAudioSong=null;$('#audioFile').click();};
$('#audioFile').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;const target=pendingAudioSong;try{if(file.size>200000000)throw Error('Choose an audio file under 200 MB.');await audioInit();const buffer=await audioContext.decodeAudioData(await file.arrayBuffer()),song=target||{id:'custom-'+Date.now(),title:file.name.replace(/\.[^.]+$/,''),japanese:'Your music, your chart',artist:'Local audio',group:'CUSTOM TRACK',bpm:120,estimated:true,featured:false};if(!target)songs.unshift(song);imported.set(song.id,file);bufferCache.set(song.id,buffer);analyses.delete(song.id);song.duration=buffer.duration;song.localAudio=true;selected=song;try{await storeAudio({id:song.id,file,song});toast('Audio added and saved on this device');}catch{toast('Audio added for this session; browser storage is unavailable.');}renderLibrary();renderDetail();}catch(error){toast('Could not load audio: '+error.message);}};
$('#videoFile').onchange=async event=>{const file=event.target.files[0];event.target.value='';const song=pendingVideoSong;pendingVideoSong=null;if(!file||!song)return;try{if(file.size>200000000)throw Error('Choose an MP4 or WebM under 200 MB.');if(!/^video\/(mp4|webm)$/.test(file.type)&&!(/\.(mp4|webm)$/i.test(file.name)))throw Error('Choose an MP4 or WebM video.');const probe=document.createElement('video');probe.preload='metadata';probe.muted=true;const probeUrl=URL.createObjectURL(file);try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Video took too long to open. Try a smaller MP4 or WebM.')),10000);probe.onloadedmetadata=()=>{clearTimeout(timer);resolve();};probe.onerror=()=>{clearTimeout(timer);reject(Error('This video format is not supported by your browser.'));};probe.src=probeUrl;});}finally{URL.revokeObjectURL(probeUrl);probe.removeAttribute('src');probe.load();}useVideoFile(song.id,file);try{await storeVideo({id:String(song.id),file});toast('MMD video saved in this browser');}catch{toast('Video added for this session; browser storage is unavailable.');}renderDetail();}catch(error){toast('Could not add video: '+error.message);}};
$('#search').oninput=()=>{limit=24;renderLibrary();};$('#sort').onchange=renderLibrary;$$('[data-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.filter;limit=24;$$('[data-filter]').forEach(b=>b.classList.toggle('active',b===button));renderLibrary();});$('#moreSongs').onclick=()=>{limit+=48;renderLibrary();};
$('#home').onclick=event=>{event.preventDefault();if(view==='game'){if(!state?.finished&&!state?.paused)pauseGame();else leaveGame();}else if(view==='editor')$('#editorBack').click();else window.scrollTo({top:0,behavior:'smooth'});};

function settingsTab(tab) {$$('[data-settings-tab]').forEach(button=>{button.classList.toggle('active',button.dataset.settingsTab===tab);button.setAttribute('aria-selected',button.dataset.settingsTab===tab);});$$('[data-settings-panel]').forEach(panel=>panel.classList.toggle('hidden',panel.dataset.settingsPanel!==tab));}
function renderBindings() {$('#keyBindings').innerHTML=settings.keys.map((key,index)=>`<button type="button" class="binding ${captureBinding===index?'capturing':''}" data-bind="${index}"><small>LANE ${index+1}</small><b>${captureBinding===index?'…':safe(keyLabel(key))}</b></button>`).join('');$$('[data-bind]').forEach(button=>button.onclick=()=>{captureBinding=Number(button.dataset.bind);$('#bindingStatus').textContent='Press your new key. Escape cancels.';renderBindings();});$('#flickBinding').textContent=captureBinding==='flick'?'Press a key…':keyLabel(settings.flickKey);}
function showSettings(tab='play') {
  if(view==='game'&&state&&!state.paused&&!state.finished)pauseGame();captureBinding=null;
  for(const [id,key] of [['speed','travel'],['volume','volume'],['offset','offset'],['hitVolume','hitVolume'],['hitSound','hitSound'],['flickMode','flickMode'],['laneMode','laneMode'],['noteScale','noteScale'],['backgroundDim','backgroundDim']])$('#'+id).value=settings[key];
  $('#speedValue').textContent=settings.travel.toFixed(1)+' s';$('#practice').checked=settings.practice;$('#effects').checked=settings.effects;
  $$('[name="theme"]').forEach(input=>input.checked=input.value===settings.theme);$('#bindingStatus').textContent='Click a key below, then press its replacement.';renderBindings();settingsTab(tab);$('#settingsDialog').showModal();
}
$('#settingsBtn').onclick=()=>showSettings();$('#themeChip').onclick=()=>showSettings('appearance');
$$('[data-settings-tab]').forEach(button=>button.onclick=()=>{captureBinding=null;renderBindings();settingsTab(button.dataset.settingsTab);});
$('#flickBinding').onclick=()=>{captureBinding='flick';$('#bindingStatus').textContent='Press a key for upward flicks. Escape cancels.';renderBindings();};
document.addEventListener('keydown',event=>{
  if(!$('#settingsDialog').open||captureBinding===null)return;event.preventDefault();event.stopImmediatePropagation();
  if(event.repeat)return;if(event.key==='Escape'){captureBinding=null;renderBindings();$('#bindingStatus').textContent='Binding canceled.';return;}
  const key=keyToken(event),error=validateBinding(key,settings.keys,settings.flickKey,captureBinding);if(error){$('#bindingStatus').textContent=error;return;}
  if(captureBinding==='flick')settings.flickKey=key;else settings.keys[captureBinding]=key;captureBinding=null;renderBindings();$('#bindingStatus').textContent='Key saved.';persistSettings();applyAppearance();
},true);
$('#resetKeys').onclick=()=>{settings.keys=[...DEFAULT_KEYS];settings.flickKey='shift';captureBinding=null;renderBindings();applyAppearance();persistSettings();$('#bindingStatus').textContent='Default controls restored.';};
$('#keyPreset').onchange=event=>{if(event.target.value==='default')settings.keys=[...DEFAULT_KEYS];else if(event.target.value==='asdf')settings.keys=['a','s','d','j','k','l'];else return;if(settings.keys.includes(settings.flickKey))settings.flickKey='shift';captureBinding=null;renderBindings();applyAppearance();persistSettings();};
for(const [id,key] of [['speed','travel'],['volume','volume'],['hitVolume','hitVolume'],['backgroundDim','backgroundDim'],['noteScale','noteScale']])$('#'+id).oninput=event=>{settings[key]=Number(event.target.value);if(id==='speed')$('#speedValue').textContent=settings.travel.toFixed(1)+' s';if(musicGain)musicGain.gain.value=settings.volume;applyAppearance();persistSettings();};
for(const id of ['hitSound','flickMode','laneMode'])$('#'+id).onchange=event=>{settings[id]=event.target.value;persistSettings();applyAppearance();};
$('#offset').onchange=event=>{settings.offset=Math.max(-500,Math.min(500,Number(event.target.value)||0));persistSettings();};
for(const id of ['practice','effects'])$('#'+id).onchange=event=>{settings[id]=event.target.checked;persistSettings();};
$$('[name="theme"]').forEach(input=>input.onchange=()=>{settings.theme=input.value;applyAppearance();persistSettings();});
$('#testHitSound').onclick=async()=>{const audio=await audioInit();await audio.loadOriginal();audio.play({type:'tap'},settings.hitVolume,settings.hitSound);};
$('#settingsDialog').addEventListener('close',()=>{captureBinding=null;clearInputs();persistSettings();applyAppearance();if(view==='library')renderDetail();if(view==='editor'){renderEditor();drawWave();}});
window.addEventListener('beforeunload',event=>{if(editorDirty){event.preventDefault();event.returnValue='';}});
async function init() {applyAppearance();void initAuth();try{[songs,manifest]=await Promise.all([fetch('catalog.json').then(r=>r.json()),fetch('assets/manifest.json').then(r=>r.json())]);await restoreAudio();await restoreVideos();selected=songs.find(song=>song.id===201)||songs[0];renderLibrary();renderDetail();}catch(error){$('#songGrid').innerHTML='<p class="empty">Could not load the library. Start the app with npm start, then open http://127.0.0.1:5173.</p>';console.error(error);}}
window.addEventListener('six-cloud-restore',event=>{
  const profile=event.detail||{};
  if(profile['six-settings'])Object.assign(settings,normalizeSettings(profile['six-settings']));
  if(profile['six-favorites'])favorites=new Set(profile['six-favorites']);
  if(profile['six-charts'])charts=profile['six-charts'];
  if(profile['six-records'])records=profile['six-records'];
  applyAppearance();
  if(view==='library'){renderLibrary();renderDetail();}
});
init();
