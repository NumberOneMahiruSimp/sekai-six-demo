import {keyLabel} from './preferences.js';
import {slidePosition} from './slide.js';

// A shared lane transform keeps note heads, hold ribbons and touch picking aligned.
export function laneGeometry(width, height, mode = 'perspective') {
  const bottom = Math.min(width * (width < 650 ? .98 : .76), 1080);
  const top = mode === 'flat' ? bottom : bottom * .34;
  const topY = height * .12, bottomY = height * .85;
  const point = (lane, p) => [width / 2 + (lane / 6 - .5) * (top + (bottom - top) * p), topY + (bottomY - topY) * p];
  return {point, topY, bottomY, bottom, laneAt(x) { return Math.floor((x - (width - bottom) / 2) / bottom * 6); }};
}
export class LaneRenderer {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); }
  draw(state, time, prefs, pressed, now, dt) {
    const canvas = this.canvas, ctx = this.ctx;
    const {width: w, height: h} = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) { canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    // Artwork lives behind the canvas; this tint dims it without dimming the notes.
    ctx.fillStyle = `rgba(18,16,31,${prefs.theme !== 'classic' ? prefs.backgroundDim : .92})`;
    ctx.fillRect(0, 0, w, h);
    const {point, bottomY, topY} = laneGeometry(w, h, prefs.laneMode);
    const poly = (pts, fill, stroke) => {ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}};
    poly([point(0,0),point(6,0),point(6,1.16),point(0,1.16)], '#161323ef');
    for(let l=0;l<6;l++) {
      if(l%2===0) poly([point(l,0),point(l+1,0),point(l+1,1.16),point(l,1.16)], '#ffffff04');
      if(pressed.has(l) || now-state.flashes[l]<140) {
        const grad=ctx.createLinearGradient(0,bottomY-180,0,bottomY);grad.addColorStop(0,'#8becd000');grad.addColorStop(1,'#8becd03c');
        poly([point(l,.68),point(l+1,.68),point(l+1,1),point(l,1)],grad);
      }
    }
    for(let l=0;l<=6;l++) {ctx.beginPath();ctx.moveTo(...point(l,0));ctx.lineTo(...point(l,1.16));ctx.lineWidth=l===0||l===6?2:1;ctx.strokeStyle=l===0||l===6?(prefs.theme==='emu'?'#ef91b68c':'#a4baff7a'):'#e3dffb1b';ctx.stroke();}
    const progress = nt => {const u=1-(nt-time)/prefs.travel;return prefs.laneMode==='flat'?u:u/Math.max(.35,1.65-.65*u);};
    // A single mild depth projection keeps heads, tails and measure lines together.
    const beatLength=60/state.chart.bpm;
    for(let b=Math.max(0,Math.floor((time-state.chart.offset)/beatLength));b<Math.ceil((time+prefs.travel-state.chart.offset)/beatLength);b++) {
      const p=progress(state.chart.offset+b*beatLength);
      if(p>=0&&p<=1&&b%4===0){ctx.beginPath();ctx.moveTo(...point(0,p));ctx.lineTo(...point(6,p));ctx.strokeStyle='#d5b4e012';ctx.stroke();}
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
      const size=(4.5+9*p)*prefs.noteScale, dp=size/(bottomY-topY)/2;
      const [left,right]=bounds(n),front=Math.min(1.06,p+dp),back=Math.max(0,p-dp),a=point(left,back),b=point(right,back),c=point(right,front),d=point(left,front);
      const [light,color]=colors[n.critical?'accent':n.type]||colors.tap;
      const grad=ctx.createLinearGradient(0,a[1],0,d[1]);grad.addColorStop(0,light);grad.addColorStop(.35,light);grad.addColorStop(.4,color);grad.addColorStop(1,color);
      ctx.lineWidth=1.3;ctx.shadowColor=color;ctx.shadowBlur=prefs.effects?5:0;poly([a,b,c,d],grad,light);ctx.shadowBlur=0;
      if(n.type==='flick'){
        const [x,y]=point((left+right)/2,p),scale=(.45+.55*p)*prefs.noteScale,aw=Math.min((b[0]-a[0])*.27,22*scale),ah=13*scale;
        for(let j=0;j<2;j++){const ay=y-size/2-6*scale-j*ah*.7;poly([[x-aw,ay],[x,ay-ah],[x+aw,ay],[x+aw,ay+6*scale],[x,ay-ah+6*scale],[x-aw,ay+6*scale]],n.critical?(j?'#fff9df':'#f3cc6a'):(j?'#fff0fa':'#ff93c8'));}
      }else if(n.type==='accent'){
        const [x,y]=point((left+right)/2,p);poly([[x,y-size*.28],[x+size*.3,y],[x,y+size*.28],[x-size*.3,y]],'#fffdf3');
      }
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
      poly([...left,...right.reverse()],color,n.critical?'#ffe6a253':'#b1ffe759');
      // Small diamonds identify editable waypoints without obscuring the ribbon.
      if(n.type==='slide')for(const node of (n.path||[]).slice(1,-1)){
        const p=progress(node.t);if(node.t<time||p<0||p>1)continue;
        const [x,y]=point(node.lane+.5,p),r=(2.5+3*p)*prefs.noteScale;
        poly([[x,y-r],[x+r*1.5,y],[x,y+r],[x-r*1.5,y]],n.critical?'#fff1c3':'#c9ffec');
      }
    }
    const visible=[];
    for(const n of state.notes){
      if(n.status==='done')continue;
      if(n.type==='hold'||n.type==='slide'){
        const tail=n.type==='slide'?slidePosition(n,n.end):n;
        visible.push({n:{...n,...tail,type:n.endFlick?'flick':n.type},p:progress(n.end)});
      }
      const head=n.type==='slide'?slidePosition(n,n.status==='holding'?Math.min(n.end,Math.max(n.t,time)):n.t):n;
      visible.push({n:{...n,...head},p:n.status==='holding'?1:progress(n.t)});
    }
    visible.sort((a,b)=>a.p-b.p).forEach(({n,p})=>drawNote(n,p));
    ctx.shadowColor='#ffe4f3';ctx.shadowBlur=prefs.effects?9:0;ctx.strokeStyle='#fff2fb';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...point(0,1));ctx.lineTo(...point(6,1));ctx.stroke();ctx.shadowBlur=0;
    for(let l=0;l<6;l++){
      const [x,y]=point(l+.5,1.075);ctx.textAlign='center';ctx.font=`600 ${w<650?11:14}px 'Segoe UI',sans-serif`;ctx.fillStyle=pressed.has(l)?'#fff6fa':'#c3b6d5';ctx.fillText(keyLabel(prefs.keys[l]),x,y);
    }
    if(prefs.effects){state.particles=state.particles.filter(p=>p.age<.45);for(const p of state.particles){if(!state.paused&&!state.finished){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;}const [x,y]=point(p.lane+.5,1);ctx.globalAlpha=Math.max(0,1-p.age/.45);ctx.fillStyle=p.type==='flick'?'#ffafd3':'#bcffe9';ctx.fillRect(x+p.x,y+p.y,3,3);}ctx.globalAlpha=1;}
    if(state.countdown>0&&!state.paused&&!state.finished){ctx.textAlign='center';ctx.fillStyle='#fff6fa';ctx.font="600 64px 'Segoe UI',sans-serif";ctx.fillText(state.countdown,w/2,h*.49);ctx.font="12px 'Segoe UI',sans-serif";ctx.fillStyle='#d7c3df';ctx.fillText('FIND YOUR RHYTHM',w/2,h*.49+35);}
  }
}
