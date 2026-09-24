// The six-key demo has a fixed 1,000,000-point ceiling and no card-power bonus.
// Ranks are scaled to that ceiling so they remain meaningful for every chart.
export const SCORE_CEILING = 1_000_000;
export const RANK_MARKS = [
  {label:'C', score:0},
  {label:'B', score:500_000},
  {label:'A', score:750_000},
  {label:'S', score:900_000},
];

export function scoreRank(score) {
  return RANK_MARKS.findLast(mark => score >= mark.score)?.label || 'C';
}

export function chartFingerprint(chart) {
  let hash=2166136261;
  for(const char of JSON.stringify([chart.bpm,chart.offset,chart.notes])){
    hash^=char.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(36);
}

export function resultSummary({score, counts, totalNotes, maxCombo, failed=false, timing={}}) {
  const judged=Object.values(counts).reduce((sum,count)=>sum+count,0);
  const complete=totalNotes>0&&!failed&&judged===totalNotes;
  const fullCombo=complete&&counts.GOOD+counts.BAD+counts.MISS===0&&maxCombo===totalNotes;
  const allPerfect=fullCombo&&counts.PERFECT===totalNotes;
  const accuracy=totalNotes
    ? (counts.PERFECT+counts.GREAT*.8+counts.GOOD*.5+counts.BAD*.2)/totalNotes*100
    : 0;
  return {
    rank:scoreRank(score),
    progress:Math.max(0,Math.min(100,score/SCORE_CEILING*100)),
    accuracy,
    badge:failed?'LIVE FAILED':allPerfect?'ALL PERFECT':fullCombo?'FULL COMBO':'LIVE COMPLETE',
    fast:timing.FAST||0,
    late:timing.LATE||0,
    flick:timing.FLICK||0,
  };
}
