import {RESULT_ART} from './result-art.js';
// One registry drives theme selection, artwork, captions, and saved preferences.
export const THEMES = {
  emu: {name:'Emu Otori',short:'Emu',unit:'Wonderlands × Showtime',title:['A little wonder.','A lot of rhythm.'],tag:'✦ WONDERHOY!',avatar:'assets/emu/emu-avatar.webp',standing:'assets/emu/emu-standing.webp',card:'assets/emu/emu-card.webp'},
  ichika: {name:'Ichika Hoshino',short:'Ichika',unit:'Leo/need',title:['Under one sky.','On the same beat.'],tag:'✦ LEO/NEED'},
  saki: {name:'Saki Tenma',short:'Saki',unit:'Leo/need',title:['A brighter day.','One note away.'],tag:'✦ LEO/NEED'},
  minori: {name:'Minori Hanasato',short:'Minori',unit:'MORE MORE JUMP!',title:['A little hope.','A bigger stage.'],tag:'✦ MORE MORE JUMP!'},
  kohane: {name:'Kohane Azusawa',short:'Kohane',unit:'Vivid BAD SQUAD',title:['Find your voice.','Feel the beat.'],tag:'✦ VIVID BAD SQUAD'},
  tsukasa: {name:'Tsukasa Tenma',short:'Tsukasa',unit:'Wonderlands × Showtime',title:['The lights are up.','Your stage awaits.'],tag:'✦ WONDERLANDS × SHOWTIME'},
  kanade: {name:'Kanade Yoisaki',short:'Kanade',unit:'Nightcord at 25:00',title:['A quiet night.','A melody to keep.'],tag:'✦ NIGHTCORD AT 25:00'},
  miku: {name:'Hatsune Miku',short:'Miku',unit:'VIRTUAL SINGER',title:['Your world.','Your melody.'],tag:'✦ VIRTUAL SINGER',background:'assets/characters/miku/background.png'},
  classic: {name:'Classic',short:'Classic'},
};
for(const [id,theme] of Object.entries(THEMES)) {
  theme.resultArt=RESULT_ART[id];
  if(id==='classic'||id==='emu')continue;
  for(const asset of ['avatar','standing','card'])theme[asset]=`assets/characters/${id}/${asset}.webp`;
}
export function getTheme(id) {return THEMES[id] || THEMES.emu;}
