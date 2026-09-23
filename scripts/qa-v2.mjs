import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
fs.mkdirSync('qa/v2',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
await page.addInitScript(()=>{
  const AC=window.AudioContext;
  window.__sfx=0;
  window.AudioContext=class extends AC {
    constructor(...args){super(...args);window.__audio=this;}
    createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=(when=0,offset=0,...args)=>{if(source.buffer?.duration>.2){window.__songStart=when||this.currentTime;window.__songOffset=offset;}return start(when,offset,...args);};return source;}
    createOscillator(){const oscillator=super.createOscillator(),start=oscillator.start.bind(oscillator);oscillator.start=(...args)=>{window.__sfx++;return start(...args);};return oscillator;}
  };
});
await page.goto('http://127.0.0.1:5173');await page.locator('.song-card').first().waitFor();
assert.deepEqual(errors,[]);assert.equal(await page.locator('html').getAttribute('data-theme'),'emu');
await page.waitForFunction(()=>[...document.querySelectorAll('.emu-hero-art,.theme-chip img,.game-character')].every(img=>img.complete&&img.naturalWidth>0));
await page.screenshot({path:'qa/v2/library-desktop.png'});
await page.locator('#settingsBtn').click();await page.locator('[data-settings-tab="controls"]').click();
await page.locator('[data-bind="0"]').click();await page.keyboard.press('f');assert.match(await page.locator('#bindingStatus').textContent(),/already assigned/);await page.keyboard.press('a');assert.equal(await page.locator('[data-bind="0"] b').textContent(),'A');
await page.locator('#flickBinding').click();await page.keyboard.press('Space');assert.equal(await page.locator('#flickBinding').textContent(),'SPACE');
await page.screenshot({path:'qa/v2/settings-controls.png'});
await page.locator('[data-settings-tab="appearance"]').click();await page.locator('[name="theme"][value="classic"]').check();assert.equal(await page.locator('.emu-hero').isVisible(),false);await page.locator('[name="theme"][value="emu"]').check();
await page.locator('#laneMode').selectOption('flat');await page.locator('#laneMode').selectOption('perspective');
await page.locator('[data-settings-tab="play"]').click();await page.locator('#testHitSound').click();assert.equal(await page.evaluate(()=>window.__sfx),1);await page.locator('.settings-done').click();
assert.match(await page.locator('#gameKeys').textContent(),/A.*SPACE/);
await page.locator('#openEditor').click();await page.locator('#editor').waitFor({state:'visible'});
assert.ok(await page.locator('.note-cell.flick').count()>0);
await page.locator('[data-type="flick"]').click();const empty=page.locator('.note-cell:not(.has-note):not(.tail)').first();const added={beat:Number(await empty.getAttribute('data-beat')),lane:Number(await empty.getAttribute('data-lane'))};await empty.click();
await page.locator('#saveChart').click();assert.match(await page.locator('#editorStatus').textContent(),/Saved/);
const downloadPromise=page.waitForEvent('download');await page.locator('#exportChart').click();await(await downloadPromise).saveAs('qa/v2/chart.json');const chart=JSON.parse(fs.readFileSync('qa/v2/chart.json'));assert.ok(chart.notes.some(n=>n.beat===added.beat&&n.lane===added.lane&&n.type==='flick'));
await page.screenshot({path:'qa/v2/editor-desktop.png'});await page.locator('#editorBack').click();await page.locator('#playDemo').click();await page.locator('#game').waitFor({state:'visible'});await page.waitForTimeout(5300);await page.screenshot({path:'qa/v2/game-desktop.png'});
await page.keyboard.press('Escape');assert.match(await page.locator('#gameOverlay').textContent(),/On your time/);
await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',repeat:true,bubbles:true})));assert.match(await page.locator('#gameOverlay').textContent(),/On your time/);
await page.locator('#pauseSettings').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#settingsDialog').isVisible(),false);assert.equal(await page.locator('#gameOverlay').isVisible(),true);await page.locator('#leave').click();
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'qa/v2/library-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('.mobile-selected').isVisible(),true);
await page.locator('#settingsBtn').click();await page.locator('[data-settings-tab="appearance"]').click();await page.screenshot({path:'qa/v2/settings-mobile.png'});await page.locator('.settings-done').click();
await page.locator('#mobilePlay').click();await page.locator('#game').waitFor({state:'visible'});await page.waitForTimeout(5300);await page.screenshot({path:'qa/v2/game-mobile.png'});await page.keyboard.press('Escape');await page.locator('#leave').click();
await page.setViewportSize({width:1440,height:1000});
const duration=5,wav=Buffer.alloc(44+44100*duration*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);for(let i=0;i<44100*duration;i++)wav.writeInt16LE(Math.sin(i/44100*440*Math.PI*2)*1200,44+i*2);
await page.locator('#customSong').click();await page.locator('#audioFile').setInputFiles({name:'Flick QA.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>document.querySelector('#songDetail h2')?.textContent==='Flick QA');await page.locator('#openEditor').click();
const testChart={version:1,bpm:120,offset:.5,notes:[{beat:0,lane:0,type:'tap',duration:0},{beat:1,lane:1,type:'hold',duration:2},{beat:2,lane:2,type:'flick',duration:0},{beat:3,lane:4,type:'accent',duration:0},{beat:5,lane:3,type:'flick',duration:0},{beat:6,lane:5,type:'tap',duration:0}]};
await page.locator('#chartFile').setInputFiles({name:'flick-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(testChart))});await page.locator('#saveChart').click();await page.locator('#testChart').click();await page.locator('#game').waitFor({state:'visible'});
const sfxBefore=await page.evaluate(()=>window.__sfx);
await page.evaluate(()=>{
  const key=(type,key)=>document.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true}));
  const canvas=document.querySelector('#gameCanvas');canvas.setPointerCapture=()=>{};
  const rect=canvas.getBoundingClientRect(),bottom=Math.min(rect.width*.76,1080),x=rect.left+rect.width/2+bottom/12,y=rect.top+rect.height*.9;
  const touch=(type,dy=0)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:9,pointerType:'touch',clientX:x,clientY:y-dy,bubbles:true}));
  const events=[
    [.1,()=>key('keydown','k')],[.15,()=>key('keyup','k')],
    [.5,()=>key('keydown','a')],[.55,()=>key('keyup','a')],
    [1,()=>key('keydown','f')],[1.45,()=>key('keydown','g')],
    [1.47,()=>{window.__scoreBeforeFlick=document.querySelector('#score').textContent;}],
    [1.5,()=>key('keydown',' ')],[1.55,()=>key('keyup',' ')],[1.56,()=>key('keyup','g')],
    [2,()=>key('keydown','k')],[2.05,()=>key('keyup','k')],[2.1,()=>key('keyup','f')],
    [2.96,()=>touch('pointerdown')],[3,()=>touch('pointermove',30)],[3.05,()=>touch('pointerup',30)],
    [3.5,()=>key('keydown','l')],[3.55,()=>key('keyup','l')],
  ];
  const timer=setInterval(()=>{const t=window.__audio.currentTime-window.__songStart+window.__songOffset;while(events.length&&t>=events[0][0])events.shift()[1]();if(!events.length)clearInterval(timer);},1);
});
await page.locator('#retry').waitFor({timeout:15000});assert.match(await page.locator('#gameOverlay').textContent(),/Full combo!/);assert.equal(Number((await page.locator('.result-score').textContent()).replaceAll(',','')),1000000);assert.equal(await page.evaluate(()=>Number(window.__scoreBeforeFlick)),166667);assert.equal(await page.evaluate(()=>window.__sfx)-sfxBefore,7);await page.screenshot({path:'qa/v2/results.png'});
// Muting is independent of music, and an ordinary tap must not pass a true flick.
await page.locator('#settingsBtn').click();await page.locator('#hitVolume').fill('0');await page.locator('#hitVolume').dispatchEvent('input');await page.locator('.settings-done').click();const mutedBefore=await page.evaluate(()=>window.__sfx);await page.locator('#retry').click();
await page.evaluate(()=>{const events=[[.5,'keydown','a'],[.55,'keyup','a'],[1,'keydown','f'],[1.2,'keyup','f'],[1.5,'keydown','g'],[1.55,'keyup','g']];const timer=setInterval(()=>{const t=window.__audio.currentTime-window.__songStart+window.__songOffset;while(events.length&&t>=events[0][0]){const[,type,key]=events.shift();document.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true}));}if(!events.length)clearInterval(timer);},1);});
await page.locator('#retry').waitFor({timeout:15000});assert.equal(Number((await page.locator('.result-score').textContent()).replaceAll(',','')),166667);assert.equal(await page.evaluate(()=>window.__sfx),mutedBefore);assert.match(await page.locator('#gameOverlay').textContent(),/MISSES5/);await page.locator('#resultBack').click();await page.locator('#editorBack').click();
await page.reload();await page.locator('.song-card').first().waitFor();const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('six-settings')));assert.equal(prefs.keys[0],'a');assert.equal(prefs.flickKey,' ');assert.equal(prefs.hitVolume,0);assert.equal(prefs.theme,'emu');
const assets=await page.evaluate(async()=>{const {demoChart,analyzeRhythm,validateChart,noteTime}=await import('/chart.js');const songs=await fetch('/catalog.json').then(r=>r.json()),manifest=await fetch('/assets/manifest.json').then(r=>r.json()),ac=new AudioContext(),out=[];for(const song of songs.filter(s=>manifest[s.id]?.audio)){const buffer=await ac.decodeAudioData(await fetch('/'+manifest[song.id].audio).then(r=>r.arrayBuffer())),analysis=analyzeRhythm(buffer);const charts=['easy','normal','hard'].map(level=>validateChart(demoChart(song,level,analysis)));out.push({title:song.title,counts:charts.map(c=>c.notes.length),flicks:charts[1].notes.filter(n=>n.type==='flick').length,offset:charts[1].offset,fits:charts.every(c=>c.notes.every(n=>noteTime(n,c)+n.duration*60/c.bpm<buffer.duration))});}await ac.close();return out;});
assert.ok(assets.every(a=>a.fits&&a.flicks>0));assert.deepEqual(errors,[]);
fs.writeFileSync('qa/v2/report.json',JSON.stringify({passed:true,errors,assets,checks:['Emu official assets load','theme switching','duplicate rejection + rebind persistence','true modifier flick: plain tap rejected','upward touch swipe','tap + hold + flick + accent perfect run','correct-hit sound counts; muted/empty inputs silent','early hold release misses','pause repeat and modal Escape','flick editor/export','desktop/mobile layout and artwork','all bundled audio analyzed and chart ends fit']},null,2));
console.log('V2 browser QA passed',JSON.stringify(assets));await browser.close();
