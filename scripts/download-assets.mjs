import fs from 'node:fs';
const songs=JSON.parse(fs.readFileSync('catalog.json'));fs.mkdirSync('assets',{recursive:true});
const tasks=songs.slice(0,32).map(s=>[s.cover,`assets/${s.id}.png`]);
tasks.push(...songs.filter(s=>s.featured&&s.id!==201).map(s=>[s.audio,`assets/${s.id}.wav`]));
let i=0;await Promise.all(Array.from({length:4},async()=>{while(i<tasks.length){const [url,file]=tasks[i++];if(fs.existsSync(file))continue;try{const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(r.status);const b=Buffer.from(await r.arrayBuffer());fs.writeFileSync(file,b);console.log(file,b.length);}catch(e){console.log('Unavailable',file,e.message);}}}));
const manifest={};for(const s of songs){const audio=s.id===201?'assets/at-gods-mercy.wav':`assets/${s.id}.wav`;manifest[s.id]={...(fs.existsSync(audio)?{audio}:{}),...(fs.existsSync(`assets/${s.id}.png`)?{cover:`assets/${s.id}.png`}:{})};}fs.writeFileSync('assets/manifest.json',JSON.stringify(manifest));
