import {keyLabel} from './preferences.js';
import {slidePosition} from './slide.js';

// A shared lane transform keeps note heads, hold ribbons and touch picking aligned.
export function laneGeometry(width, height, mode = 'perspective') {
  const flat = mode === 'flat', compact = width < 650;
  const bottom = flat
    ? Math.min(width * (compact ? .98 : .76), 1080)
    : Math.min(width * (compact ? .96 : .86), height * 1.9, 1600);
  const top = flat ? bottom : bottom * (compact ? .23 : .18);
  const topY = height * (flat ? .12 : .055), bottomY = height * .85;
  const point = (lane, p) => [width / 2 + (lane / 6 - .5) * (top + (bottom - top) * p), topY + (bottomY - topY) * p];
  return {point, topY, bottomY, bottom, scaleAt: p => (top + (bottom - top) * p) / bottom, laneAt(x) { return Math.floor((x - (width - bottom) / 2) / bottom * 6); }};
}

// Keep the hit time exactly at p=1 while notes gather speed toward the player.
// Heads, tails, slide paths and beat lines all use this same projection.
export function noteProgress(noteTime, songTime, travel, mode = 'perspective') {
  const u = 1 - (noteTime - songTime) / travel;
  return mode === 'flat' ? u : u / Math.max(.3, 2.25 - 1.25 * u);
}
export class LaneRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  }
  draw(state, time, prefs, pressed, now, dt) {
    const canvas = this.canvas, ctx = this.ctx;
    const {width: w, height: h} = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) { canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    // Artwork lives behind the canvas; this tint dims it without dimming the notes.
    const backgroundDim = state.videoLive
      ? Math.min(prefs.backgroundDim, .14)
      : prefs.theme !== 'classic' ? prefs.backgroundDim : .92;
    ctx.fillStyle = `rgba(18,16,31,${backgroundDim})`;
    ctx.fillRect(0, 0, w, h);
    const {point, bottomY, topY, bottom, scaleAt} = laneGeometry(w, h, prefs.laneMode);
    const perspective = prefs.laneMode !== 'flat';
    const animated = prefs.effects && !this.reducedMotion.matches && !state.paused && !state.finished;
    const accents = {emu:'#ff9fce',ichika:'#8fcaff',saki:'#ffe1a1',minori:'#ffb0d2',kohane:'#ffc18e',tsukasa:'#ffdc93',kanade:'#c1b5ff',miku:'#81f1e1',classic:'#9edfee'};
    const accent = accents[prefs.theme] || accents.classic;
    const poly = (pts, fill, stroke) => {ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}};
    const progress = nt => noteProgress(nt, time, prefs.travel, prefs.laneMode);
    const beatLength = 60 / state.chart.bpm;
    const beatPhase = ((time - state.chart.offset) / beatLength % 1 + 1) % 1;
    const pulse = animated && !state.countdown ? (1 - beatPhase) ** 3 : 0;
    // A softly lit horizon and translucent stage retain the character/MV backdrop.
    if(perspective) {
      const halo = ctx.createRadialGradient(w/2,topY+12,0,w/2,topY+12,Math.max(80,bottom*.28));
      halo.addColorStop(0,accent+'25');halo.addColorStop(1,accent+'00');
      ctx.fillStyle=halo;ctx.fillRect(0,0,w,bottomY);
    }
    const laneFill = ctx.createLinearGradient(0,topY,0,bottomY);
    const transparentStage = state.videoLive || prefs.theme === 'miku';
    laneFill.addColorStop(0,transparentStage?'#11162720':'#15182a70');
    laneFill.addColorStop(.6,transparentStage?'#11162764':'#14182bc9');
    laneFill.addColorStop(1,transparentStage?'#11162792':'#121728eb');
    poly([point(0,0),point(6,0),point(6,1.17),point(0,1.17)],laneFill);
    const lineGradient=ctx.createLinearGradient(0,topY,0,bottomY);
    lineGradient.addColorStop(0,'#e9edff00');lineGradient.addColorStop(.35,'#e9edff12');lineGradient.addColorStop(1,'#e9edff38');
    for(let l=0;l<6;l++) {
      if(l%2===0) poly([point(l,0),point(l+1,0),point(l+1,1.17),point(l,1.17)], '#ffffff04');
      const flash=Math.max(0,1-(now-state.flashes[l])/260), held=pressed.has(l);
      if(held || flash>0) {
        const reach=perspective?.38:.64,grad=ctx.createLinearGradient(0,point(0,reach)[1],0,bottomY);
        grad.addColorStop(0,accent+'00');grad.addColorStop(1,accent+'75');
        ctx.globalAlpha=held?.65:flash;
        poly([point(l,reach),point(l+1,reach),point(l+1,1),point(l,1)],grad);
        ctx.globalAlpha=1;
      }
      ctx.lineWidth=1;poly([point(l+.035,1.018),point(l+.965,1.018),point(l+.965,1.125),point(l+.035,1.125)],held?accent+'32':'#e3eaff07',held?accent+'b3':'#e3eaff13');
    }
    for(let l=0;l<=6;l++) {
      const edge=l===0||l===6;
      if(edge&&perspective){ctx.lineWidth=9;ctx.strokeStyle=accent+'0d';ctx.beginPath();ctx.moveTo(...point(l,0));ctx.lineTo(...point(l,1.17));ctx.stroke();}
      ctx.beginPath();ctx.moveTo(...point(l,0));ctx.lineTo(...point(l,1.17));ctx.lineWidth=edge?2:1;ctx.strokeStyle=edge?accent+'91':lineGradient;ctx.stroke();
    }
    // Flowing beat markers reinforce depth without moving the judgment target.
    for(let b=Math.max(0,Math.floor((time-state.chart.offset)/beatLength));b<Math.ceil((time+prefs.travel-state.chart.offset)/beatLength);b++) {
      const p=progress(state.chart.offset+b*beatLength);
      if(p>=0&&p<=1&&(b%4===0||perspective&&animated)){
        ctx.globalAlpha=(.12+.25*p)*(b%4===0?1:.35);ctx.beginPath();ctx.moveTo(...point(0,p));ctx.lineTo(...point(6,p));ctx.lineWidth=1;ctx.strokeStyle=accent;ctx.stroke();ctx.globalAlpha=1;
        if(perspective&&animated){ctx.lineWidth=2;for(const edge of [0,6]){ctx.beginPath();ctx.moveTo(...point(edge,Math.max(0,p-.045)));ctx.lineTo(...point(edge,p));ctx.strokeStyle=accent+'a0';ctx.stroke();}}
      }
    }
    const colors={tap:['#e8f4ff','#61baf1'],hold:['#d0fff0','#44d4a4'],slide:['#d0fff0','#44d4a4'],flick:['#fff1fa','#ee72ae'],accent:['#fff9db','#e7bd61']};
    // A lane is a center index (lane + .5), so imported widths and slide nodes
    // share precisely the same geometry as ordinary one-key notes.
    const bounds=(n,inset=.075)=>{
      const width=Math.max(.15,Math.min(6,Number(n.width)||1)),center=n.lane+.5;
      const left=Math.max(0,center-width/2),right=Math.min(6,center+width/2);
      const pad=Math.min(inset,(right-left)*.15);
      return [left+pad,right-pad];
    };
    const drawNote=(n,p)=>{
      if(p<0||p>1.025)return;
      const depth=perspective?scaleAt(p):.8;
      const size=(3.5+13*depth)*prefs.noteScale*Math.max(.8,Math.min(1.18,h/800)), dp=size/(bottomY-topY)/2;
      const [left,right]=bounds(n),front=Math.min(1.06,p+dp),back=Math.max(0,p-dp),a=point(left,back),b=point(right,back),c=point(right,front),d=point(left,front);
      const [light,color]=colors[n.critical?'accent':n.type]||colors.tap;
      ctx.globalAlpha=Math.min(1,p/.07);
      const grad=ctx.createLinearGradient(0,a[1],0,d[1]);grad.addColorStop(0,light);grad.addColorStop(.22,light);grad.addColorStop(.3,color);grad.addColorStop(1,color);
      const thickness=2+depth*3;
      poly([d,c,[c[0],c[1]+thickness],[d[0],d[1]+thickness]],color+'65');
      ctx.lineWidth=Math.max(.7,depth*1.4);ctx.shadowColor=color;ctx.shadowBlur=prefs.effects?3+depth*7:0;poly([a,b,c,d],grad,light);ctx.shadowBlur=0;
      ctx.strokeStyle='#ffffffab';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a[0]+2,a[1]+1);ctx.lineTo(b[0]-2,b[1]+1);ctx.stroke();
      if(n.type==='flick'){
        const [x,y]=point((left+right)/2,p),scale=(.25+.75*depth)*prefs.noteScale,aw=Math.min((b[0]-a[0])*.27,25*scale),ah=15*scale;
        for(let j=0;j<2;j++){const ay=y-size/2-6*scale-j*ah*.7;poly([[x-aw,ay],[x,ay-ah],[x+aw,ay],[x+aw,ay+6*scale],[x,ay-ah+6*scale],[x-aw,ay+6*scale]],n.critical?(j?'#fff9df':'#f3cc6a'):(j?'#fff0fa':'#ff93c8'));}
      }else if(n.type==='accent'){
        const [x,y]=point((left+right)/2,p);poly([[x,y-size*.28],[x+size*.3,y],[x,y+size*.28],[x-size*.3,y]],'#fffdf3');
      }
      ctx.globalAlpha=1;
    };
    // Hold ribbons first, then every head in far-to-near order; no near note is obscured.
    for(const n of state.notes){
      if(!['hold','slide'].includes(n.type)||n.status==='done')continue;
      const start=Math.max(n.t,time),end=Math.min(n.end,time+prefs.travel);
      if(end<=start)continue;
      const left=[],right=[],samples=Math.max(2,Math.ceil((end-start)*55));
      for(let i=0;i<=samples;i++){
        const t=start+(end-start)*i/samples,p=Math.max(0,Math.min(1,progress(t)));
        const pos=n.type==='slide'?slidePosition(n,t):n,[a,b]=bounds(pos,.12);
        left.push(point(a,p));right.push(point(b,p));
      }
      const active=n.status==='holding',color=n.critical?(active?'#f3cb7194':'#d3aa555c'):(active?'#68e8bb94':'#53d4ac5e');
      ctx.lineWidth=active?1.5:1;
      const ribbon=[...left,...[...right].reverse()];
      const fill=ctx.createLinearGradient(0,topY,0,bottomY);fill.addColorStop(0,n.critical?'#f3cb7116':'#68e8bb16');fill.addColorStop(1,color);
      poly(ribbon,fill,n.critical?'#ffe6a28c':'#b1ffe78c');
      if(active&&prefs.effects){ctx.strokeStyle=n.critical?'#ffdf9b':'#a0ffde';ctx.lineWidth=2;for(const edge of [left,right]){ctx.beginPath();edge.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}}
      // Small diamonds identify editable waypoints without obscuring the ribbon.
      if(n.type==='slide')for(const node of (n.path||[]).slice(1,-1)){
        const p=progress(node.t);if(node.t<time||p<0||p>1)continue;
        const [x,y]=point(node.lane+.5,p),r=(2.5+3*p)*prefs.noteScale;
        poly([[x,y-r],[x+r*1.5,y],[x,y+r],[x-r*1.5,y]],n.critical?'#fff1c3':'#c9ffec');
      }
    }
    const visible=[];
    for(const n of state.notes){
      if(n.status==='done'||n.t>time+prefs.travel)continue;
      if(n.type==='hold'||n.type==='slide'){
        const tail=n.type==='slide'?slidePosition(n,n.end):n;
        visible.push({n:{...n,...tail,type:n.endFlick?'flick':n.type},p:progress(n.end)});
      }
      const head=n.type==='slide'?slidePosition(n,n.status==='holding'?Math.min(n.end,Math.max(n.t,time)):n.t):n;
      visible.push({n:{...n,...head},p:n.status==='holding'?1:progress(n.t)});
    }
    visible.sort((a,b)=>a.p-b.p).forEach(({n,p})=>drawNote(n,p));
    // Keep the target steady; the light and impact rings carry the movement.
    if(perspective&&prefs.effects){
      const glow=ctx.createLinearGradient(0,bottomY-18,0,bottomY+22);glow.addColorStop(0,accent+'00');glow.addColorStop(.45,accent+'38');glow.addColorStop(1,accent+'00');
      ctx.globalAlpha=.7+pulse*.3;poly([point(0,.965),point(6,.965),point(6,1.045),point(0,1.045)],glow);ctx.globalAlpha=1;
    }
    ctx.shadowColor=accent;ctx.shadowBlur=prefs.effects?12+pulse*7:0;ctx.strokeStyle='#fff5fc';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...point(0,1));ctx.lineTo(...point(6,1));ctx.stroke();ctx.shadowBlur=0;
    for(let l=0;l<6;l++){
      const [x,y]=point(l+.5,1.08);ctx.textAlign='center';ctx.font=`600 ${w<650?11:14}px 'Segoe UI',sans-serif`;ctx.fillStyle=pressed.has(l)?'#fff6fa':'#c3c5de';ctx.fillText(keyLabel(prefs.keys[l]),x,y);
      const age=(now-state.flashes[l])/300;
      if(animated&&age>=0&&age<1){
        const [hx,hy]=point(l+.5,1),radius=(bottom/6)*(.18+age*.37);
        ctx.globalAlpha=(1-age)**2;ctx.strokeStyle=accent;ctx.lineWidth=2.5-age;ctx.beginPath();ctx.ellipse(hx,hy,radius,6+age*15,0,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#ffffff';const r=5*(1-age);poly([[hx,hy-r*2],[hx+r,hy],[hx,hy+r*2],[hx-r,hy]],'#ffffff');ctx.globalAlpha=1;
      }
    }
    if(prefs.effects){state.particles=state.particles.filter(p=>p.age<.45);for(const p of state.particles){if(!state.paused&&!state.finished){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;}if(this.reducedMotion.matches)continue;const [x,y]=point(p.lane+.5,1);ctx.globalAlpha=Math.max(0,1-p.age/.45);ctx.fillStyle=p.type==='flick'?'#ffafd3':'#bcffe9';ctx.save();ctx.translate(x+p.x,y+p.y);ctx.rotate(Math.PI/4);ctx.fillRect(-2,-2,4,4);ctx.restore();}ctx.globalAlpha=1;}
    if(state.countdown>0&&!state.paused&&!state.finished){ctx.textAlign='center';ctx.fillStyle='#fff6fa';ctx.font="600 64px 'Segoe UI',sans-serif";ctx.fillText(state.countdown,w/2,h*.49);ctx.font="12px 'Segoe UI',sans-serif";ctx.fillStyle='#d7c3df';ctx.fillText('FIND YOUR RHYTHM',w/2,h*.49+35);}
  }
}
