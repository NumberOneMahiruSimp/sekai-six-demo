import fs from 'node:fs';
const jp=JSON.parse(fs.readFileSync('musics-source.json'));
const en=new Map(JSON.parse(fs.readFileSync('musics-en-source.json')).map(s=>[s.id,s]));
const vocals=JSON.parse(fs.readFileSync('vocals-source.json'));
const overrides={201:["At God's Mercy",135],1:['Tell Your World',150],2:['ROKI',150],3:['Teo',185],47:['Melt',170],110:['Senbonzakura',154]};
const featured=[201,1,2,3,47,110];
const songs=jp.filter(s=>s.publishedAt<Date.now()).map(s=>{const v=vocals.find(v=>v.musicId===s.id&&v.musicVocalType==='sekai')||vocals.find(v=>v.musicId===s.id&&v.musicVocalType==='original_song');const char=v?.characters?.find(c=>c.characterId<=20)?.characterId;const group=char?['Leo/need','MORE MORE JUMP!','Vivid BAD SQUAD','Wonderlands × Showtime','Nightcord at 25:00'][Math.floor((char-1)/4)]:'VIRTUAL SINGER';return {id:s.id,title:overrides[s.id]?.[0]||en.get(s.id)?.title||s.title,japanese:s.title,artist:en.get(s.id)?.composer||s.composer,group,bpm:overrides[s.id]?.[1]||120,estimated:!overrides[s.id],duration:s.secForMusicScoreMaker||120,cover:`https://storage.sekai.best/sekai-jp-assets/music/jacket/${s.assetbundleName}/${s.assetbundleName}.png`,audio:v?`https://storage.sekai.best/sekai-jp-assets/music/long/${v.assetbundleName}/${v.assetbundleName}.wav`:null,featured:featured.includes(s.id)};}).sort((a,b)=>(featured.indexOf(a.id)<0?999:featured.indexOf(a.id))-(featured.indexOf(b.id)<0?999:featured.indexOf(b.id))||a.id-b.id);
fs.writeFileSync('catalog.json',JSON.stringify(songs));
console.log(`Built ${songs.length} song entries.`);
