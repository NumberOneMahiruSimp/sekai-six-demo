// Slide points store beats relative to the head; runtime path points use audio seconds.
function interpolate(points, value, key) {
  if (!points?.length) return null;
  if (value <= points[0][key]) return {...points[0]};
  const last = points.at(-1);
  if (value >= last[key]) return {...last};
  const nextIndex = points.findIndex(point => point[key] >= value);
  const a = points[nextIndex - 1], b = points[nextIndex];
  let p = (value - a[key]) / (b[key] - a[key]);
  if (a.ease === 'in') p *= p;
  else if (a.ease === 'out') p = 1 - (1-p)*(1-p);
  else if (a.ease === 'smooth') p = p*p*(3-2*p);
  return {lane:a.lane+(b.lane-a.lane)*p,width:(a.width||1)+((b.width||1)-(a.width||1))*p};
}
export function slideAtBeat(note, relativeBeat) {
  return interpolate(note.points,relativeBeat,'beat') || {lane:note.lane,width:note.width||1};
}
export function slidePosition(note, audioTime) {
  return interpolate(note.path,audioTime,'t') || {lane:note.lane,width:note.width||1};
}
export function slideLanesAt(note,audioTime,transferWindow=.085) {
  const lanes=new Set();
  // A small handover window allows the incoming key before the outgoing key is released.
  for(const delta of [-transferWindow,0,transferWindow]) {
    const position=slidePosition(note,Math.min(note.end,Math.max(note.t,audioTime+delta)));
    for(let lane=0;lane<6;lane++)if(Math.abs(lane-position.lane)<=Math.max(.53,(position.width||1)/2))lanes.add(lane);
  }
  return lanes;
}
export function slideIsHeld(note,audioTime,pressed) {return [...slideLanesAt(note,audioTime)].some(lane=>pressed.has(lane));}
