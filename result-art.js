// Official game illustrations and English stamps; provenance is in assets/results/SOURCES.md.
export const RESULT_ART = {
  emu: {card:'res014_no010',title:'Our Feelings Become One',stamp:'stamp0168',reaction:'Wonderhoy!',position:'37% center'},
  ichika: {card:'res001_no006',title:'Smiling Once More',stamp:'stamp0051',reaction:'Hehe',position:'50% center'},
  saki: {card:'res002_no009',title:'The Best Doll Festival!',stamp:'stamp0060',reaction:'Yay!',position:'50% center'},
  minori: {card:'res005_no007',title:'For "Your" Sake',stamp:'stamp0090',reaction:'Hehehe',position:'50% center'},
  kohane: {card:'res009_no005',title:'Once More, Together',stamp:'stamp0394',reaction:'We did it!',position:'50% center'},
  tsukasa: {card:'res013_no006',title:"I'm The Lead!",stamp:'stamp0152',reaction:'Ha ha ha!',position:'50% center'},
  kanade: {card:'res017_no006',title:'From Feeling To Melody',stamp:'stamp0193',reaction:"That's nice...",position:'50% center'},
  miku: {card:'res021_no008',title:'The Big Debut',stamp:'stamp0234',reaction:'Hehehe',position:'50% center'},
};
for (const [id, art] of Object.entries(RESULT_ART)) {
  art.image=`assets/results/${id}/card.png`;
  art.sticker=`assets/results/${id}/stamp.png`;
}
