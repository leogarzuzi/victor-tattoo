(() => {
  const photo = document.querySelector('.portrait-before');
  const frame = document.querySelector('.portrait-frame');
  const paper = frame.querySelector('.tear-paper');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { photo.remove(); paper.remove(); return; }
  paper.innerHTML = `<defs>
    <linearGradient id="paper-fold" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#aaa397"/><stop offset=".15" stop-color="#ded7c9"/><stop offset=".43" stop-color="#f4efe4"/><stop offset=".78" stop-color="#e7e0d2"/><stop offset="1" stop-color="#b9b0a1"/></linearGradient>
    <filter id="paper-grain" x="-10%" y="-20%" width="120%" height="150%"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" seed="18" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".18"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  </defs>
  <path class="rip-shadow" fill="none" stroke="#342e2855" stroke-width="6"/>
  <path class="rip-edge" fill="none" stroke="#eee7dc" stroke-width="2.5"/>
  <path class="paper-flap" fill="url(#paper-fold)" filter="url(#paper-grain)"/>
  <path class="fold-crease" fill="none" stroke="#fff9" stroke-width="1.2"/>`;
  const flap=paper.querySelector('.paper-flap'), crease=paper.querySelector('.fold-crease');
  const edge=paper.querySelector('.rip-edge'), shadow=paper.querySelector('.rip-shadow');
  const gradient=paper.querySelector('linearGradient');
  const W=1672,H=941;
  // A fixed fibrous tear, progressively exposed from the upper right downward.
  const tearX=y=>W*(.99-.39*y/H)+Math.sin(y*1.41)*1.3+Math.sin(y*.37)*1.8+Math.sin(y*.083)*1.6;
  let started=false;
  async function reveal() {
    if(started)return;
    started=true;
    await Promise.all([...frame.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
    const start=performance.now()+450;
    function draw(now) {
      const progress=Math.min(1,Math.max(0,(now-start)/3100));
      const t=progress*progress*(3-2*progress), y=t*H, x=tearX(y);
      const trail=[];
      for(let sy=0;sy<y;sy+=4)trail.push([tearX(sy),sy]);
      trail.push([x,y]);
      const curl=Math.sin(Math.PI*progress)*Math.min(100,(W-x)*.2);
      // The free sheet is pulled down: a curved fold rolls ahead of the tear tip.
      const front=[];
      for(let i=1;i<=20;i++){
        const u=i/20;
        front.push([x+(W-x)*u,y+Math.sin(u*Math.PI)*curl*.35+u*curl*.28]);
      }
      const polygon=[[0,0],...trail,...front,[W,H],[0,H]];
      photo.style.clipPath=`polygon(${polygon.map(([px,py])=>`${px/W*100}% ${py/H*100}%`).join(',')})`;
      const rip=trail.map((p,i)=>`${i?'L':'M'} ${p}`).join(' ');
      edge.setAttribute('d',progress>0?rip:'');shadow.setAttribute('d',progress>0?rip:'');
      const rightY=y+curl*.28;
      const d=progress>0&&progress<1?`M ${x} ${y} Q ${x+(W-x)*.5} ${y+curl*.8} ${W} ${rightY} L ${W+12} ${rightY+curl*.72} Q ${x+(W-x)*.64} ${y+curl*1.8} ${x} ${y} Z`:'';
      flap.setAttribute('d',d);
      crease.setAttribute('d',progress>0&&progress<1?`M ${x} ${y} Q ${x+(W-x)*.5} ${y+curl*.8} ${W} ${rightY}`:'');
      gradient.setAttribute('x1',x);gradient.setAttribute('x2',x);
      gradient.setAttribute('y1',y);gradient.setAttribute('y2',y+Math.max(1,curl*1.2));
      if(progress<1)requestAnimationFrame(draw);
      else{photo.classList.add('done');paper.style.transition='opacity .45s ease';paper.style.opacity='0';setTimeout(()=>{photo.remove();paper.remove();},500);}
    }
    requestAnimationFrame(draw);
  }
  addEventListener('intro:complete',reveal,{once:true});
})();
