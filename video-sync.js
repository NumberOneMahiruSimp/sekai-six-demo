export function normalizeVideoDelay(value) {
  const delay=Number(value);
  return Number.isFinite(delay)?Math.max(-10,Math.min(10,delay)):0;
}

// Positive delay waits before showing the MV; negative delay skips its intro.
export function videoTimeAt(songPosition,delay,duration) {
  const position=songPosition-delay;
  if(position<0)return null;
  return Number.isFinite(duration)&&duration>0?position%duration:position;
}
