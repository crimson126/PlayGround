(() => {
  'use strict';
  const canvas = document.getElementById('gameCanvas');
  let ctx = canvas.getContext('2d');
  const W = 900, H = 500, TILE = 50;
  const path = [{x:-30,y:100},{x:170,y:100},{x:230,y:130},{x:260,y:190},{x:300,y:220},{x:410,y:220},{x:455,y:250},{x:480,y:310},{x:530,y:340},{x:650,y:340},{x:700,y:310},{x:730,y:250},{x:780,y:220},{x:860,y:220}];
  const cards = {
    archer:{name:'WATCHTOWER',cost:60,range:155,damage:12,rate:.72,color:'#e6c27b',type:'arrow'},
    cannon:{name:'IRONMOUTH',cost:90,range:112,damage:33,rate:1.55,color:'#d4aa76',type:'cannon'},
    frost:{name:'FROSTWITCH',cost:75,range:128,damage:7,rate:.85,color:'#9ee5e8',type:'frost'},
    sun:{name:'SUN SHRINE',cost:80,range:0,damage:0,rate:8,color:'#f0cf75',type:'sun'}
  };
  let gold=160, lives=20, wave=0, kills=0, towers=[], enemies=[], projectiles=[], particles=[], floaters=[], selected='archer', running=false, paused=false, spawnLeft=0, spawnTimer=0, gameOver=false, gameWon=false, last=performance.now(), toastTimer, hover=null, animTime=0, speed=1, hurt=0, helpPaused=false;
  const pathSegments=[]; let pathLength=0;
  for(let i=1;i<path.length;i++){let a=path[i-1],b=path[i],len=Math.hypot(b.x-a.x,b.y-a.y);pathSegments.push({a,b,len,start:pathLength});pathLength+=len;}
  const trees=[]; let seed=92; const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  for(let i=0;i<120;i++){let x=rand()*W,y=rand()*H;if(distancePath(x,y)>62)trees.push({x,y,r:8+rand()*15,tone:Math.floor(rand()*4),depth:y});}
  function distancePath(x,y){let d=999;for(const s of pathSegments){const vx=s.b.x-s.a.x,vy=s.b.y-s.a.y,t=Math.max(0,Math.min(1,((x-s.a.x)*vx+(y-s.a.y)*vy)/(s.len*s.len)));d=Math.min(d,Math.hypot(x-(s.a.x+t*vx),y-(s.a.y+t*vy)));}return d;}
  function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);}
  window.addEventListener('resize',resize); resize();
  function atDistance(dist){for(const s of pathSegments){if(dist<=s.start+s.len){let t=(dist-s.start)/s.len;return{x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t,angle:Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x)};}}return {...path[path.length-1],angle:0};}
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function es(){return clamp(900/Math.max(320,canvas.clientWidth),1,1.8);}
  function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  let background=null;
  function buildBackground(){const c=document.createElement('canvas');c.width=W*2;c.height=H*2;const old=ctx;ctx=c.getContext('2d');ctx.setTransform(2,0,0,2,0,0);
    const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#344738');bg.addColorStop(.52,'#304133');bg.addColorStop(1,'#24392f');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // forest floor flecks
    for(let i=0;i<180;i++){let x=(i*127+13)%W,y=(i*83+21)%H;ctx.fillStyle=i%3===0?'#b4a06412':'#d3d5a50b';ctx.fillRect(x,y,1.5,1.5);}
    // subtle field grid
    ctx.strokeStyle='#c2bd8c0b';ctx.lineWidth=1;for(let x=0;x<=W;x+=TILE){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<=H;y+=TILE){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // clearing glows
    let glow=ctx.createRadialGradient(465,250,30,465,250,440);glow.addColorStop(0,'#8a965215');glow.addColorStop(1,'#18271a00');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
    // track shadow, border and road
    strokePath('#15251fc9',92);strokePath('#7f6a4666',78);strokePath('#9b815b',71);strokePath('#b59b6d',62);strokePath('#c1a477',2,'#e1ca935a');
    // wheel ruts and road grit
    for(const off of [-14,14]){for(const s of pathSegments){const nx=-(s.b.y-s.a.y)/s.len,ny=(s.b.x-s.a.x)/s.len;ctx.beginPath();ctx.moveTo(s.a.x+nx*off,s.a.y+ny*off);ctx.lineTo(s.b.x+nx*off,s.b.y+ny*off);ctx.strokeStyle='#826b4730';ctx.lineWidth=1.4;ctx.lineCap='round';ctx.stroke();}}
    for(let i=24;i<pathLength;i+=19){const p=atDistance(i),off=Math.sin(i*.7)*19;ctx.fillStyle='#6655382e';ctx.beginPath();ctx.ellipse(p.x+Math.sin(p.angle+Math.PI/2)*off,p.y+Math.cos(p.angle+Math.PI/2)*off,1.5,1,i,0,Math.PI*2);ctx.fill();}
    // edge brush details
    for(let i=0;i<pathLength;i+=23){const p=atDistance(i),n=i%2?1:-1;for(let s of [-1,1]){const x=p.x+Math.cos(p.angle+Math.PI/2)*n*s*42,y=p.y+Math.sin(p.angle+Math.PI/2)*n*s*42;ctx.fillStyle='#b8aa7745';ctx.beginPath();ctx.ellipse(x,y,2,1.5,p.angle,0,Math.PI*2);ctx.fill();}}
    // stones and tufts for texture
    for(let i=0;i<46;i++){const x=(i*197+37)%W,y=(i*131+59)%H;if(distancePath(x,y)<50)continue;ctx.fillStyle=i%2?'#a7a27b2e':'#6b7a542e';ctx.beginPath();ctx.ellipse(x,y,2.2,1.2,i,0,Math.PI*2);ctx.fill();}
    trees.sort((a,b)=>a.depth-b.depth);trees.forEach(tree=>drawTree(tree));
    drawKeep();
    const vig=ctx.createRadialGradient(W/2,H/2,H*.46,W/2,H/2,W*.68);vig.addColorStop(0,'#00000000');vig.addColorStop(1,'#0a141255');ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
    ctx=old;return c;
  }
  function draw(){ctx.clearRect(0,0,W,H);
    if(background)ctx.drawImage(background,0,0,W,H);else{ctx.fillStyle='#2d4034';ctx.fillRect(0,0,W,H);}
    // path center dashes
    ctx.save();ctx.setLineDash([9,13]);ctx.lineDashOffset=-animTime*12;strokePath('#ead29b66',2);ctx.restore();
    // the old gate where raiders enter
    const spawn=atDistance(28);ctx.save();ctx.translate(spawn.x,spawn.y);ctx.fillStyle='#cf8c4b0d';ctx.beginPath();ctx.arc(0,0,35+Math.sin(animTime*2)*4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e1b26b33';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.stroke();ctx.restore();
    // placement highlight
    if(hover && selected && !gameOver&&!gameWon){const cx=Math.floor(hover.x/TILE)*TILE+TILE/2,cy=Math.floor(hover.y/TILE)*TILE+TILE/2,def=cards[selected],valid=canPlace(cx,cy,selected,false)&&gold>=def.cost;ctx.fillStyle=valid?'#c9dd8a20':'#d66e5729';ctx.strokeStyle=valid?'#d8dc9c88':'#e6816b99';ctx.lineWidth=1;if(def.range){ctx.beginPath();ctx.arc(cx,cy,def.range,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.fillStyle=valid?'#d8d69c22':'#db73552c';ctx.fillRect(Math.floor(hover.x/TILE)*TILE,Math.floor(hover.y/TILE)*TILE,TILE,TILE);}
    towers.forEach(drawTower);enemies.forEach(drawEnemy);projectiles.forEach(drawProjectile);particles.forEach(drawParticle);floaters.forEach(drawFloater);
    if(hurt>0){ctx.globalAlpha=hurt*.22;ctx.fillStyle='#b64531';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
    if(paused){ctx.fillStyle='#101b18a8';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f0d79f';ctx.textAlign='center';ctx.font='700 18px "DM Sans"';ctx.fillText('BATTLE PAUSED',W/2,H/2);ctx.font='10px "DM Mono"';ctx.fillStyle='#c7c1aa';ctx.fillText('PRESS RESUME TO CONTINUE',W/2,H/2+23);}
    if(gameOver||gameWon){ctx.fillStyle='#101b18b8';ctx.fillRect(0,0,W,H);ctx.fillStyle=gameWon?'#efd48c':'#e29a7d';ctx.textAlign='center';ctx.font='700 27px "Playfair Display"';ctx.fillText(gameWon?'THE REALM ENDURES':'THE KEEP HAS FALLEN',W/2,H/2-12);ctx.font='11px "DM Mono"';ctx.fillStyle='#e7e0ca';ctx.fillText(gameWon?'A new legend is written in Ashenwood.':'The road is lost. Regroup and try again.',W/2,H/2+15);}
  }
  function strokePath(color,width,stroke){ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);for(let i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].y);ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();if(stroke){ctx.lineWidth=1;ctx.strokeStyle=stroke;ctx.stroke();}}
  function drawTree(t){const {x,y,r,tone}=t;const dark=['#132820','#172c22','#1a3025','#1d3428'][tone],mid=['#27442f','#2c4932','#314e36','#36543a'][tone],light=['#4a6540','#536c45','#5c744b','#657b50'][tone];
    ctx.fillStyle='#101c1755';ctx.beginPath();ctx.ellipse(x+r*.18,y+r*.42,r*.9,r*.34,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#463a2a';ctx.fillRect(x-1.7,y-r*.15,3.4,r*.65);
    const baseY=y+r*.36;
    for(let l=0;l<3;l++){const yy=baseY-l*r*.43,w=r*(1-l*.19),hh=r*.72;ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(x,yy-hh);ctx.lineTo(x-w,yy);ctx.lineTo(x+w,yy);ctx.closePath();ctx.fill();ctx.fillStyle=mid;ctx.beginPath();ctx.moveTo(x,yy-hh);ctx.lineTo(x-w*.82,yy-r*.05);ctx.lineTo(x+w*.35,yy);ctx.lineTo(x+w,yy);ctx.closePath();ctx.fill();ctx.fillStyle=light;ctx.globalAlpha=.48;ctx.beginPath();ctx.moveTo(x-w*.2,yy-hh*.82);ctx.lineTo(x-w*.78,yy-r*.07);ctx.lineTo(x-w*.12,yy);ctx.closePath();ctx.fill();ctx.globalAlpha=1;}
    ctx.fillStyle='#c3c88544';ctx.beginPath();ctx.arc(x+r*.2,y-r*1.1,1.3,0,Math.PI*2);ctx.fill();}
  function drawKeep(){let x=855,y=220;ctx.fillStyle='#171d19aa';ctx.beginPath();ctx.ellipse(x,y+24,40,25,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#62634f';ctx.fillRect(x-26,y-27,52,48);ctx.fillStyle='#827961';ctx.fillRect(x-32,y-35,15,54);ctx.fillRect(x+17,y-35,15,54);ctx.fillStyle='#9a8b68';ctx.fillRect(x-35,y-39,21,6);ctx.fillRect(x+14,y-39,21,6);ctx.fillStyle='#493e2b';ctx.beginPath();ctx.moveTo(x-16,y-27);ctx.lineTo(x,y-48);ctx.lineTo(x+16,y-27);ctx.fill();ctx.fillStyle='#332f25';ctx.fillRect(x-5,y+1,10,20);ctx.fillStyle='#edc46f';ctx.beginPath();ctx.arc(x,y-5,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e4ca83';ctx.font='9px "DM Mono"';ctx.textAlign='center';ctx.fillText('THE KEEP',x,y+34);}
  function drawTower(t){const def=cards[t.type],x=t.x,y=t.y;ctx.save();ctx.translate(x,y);if(t.type!=='sun'){ctx.strokeStyle=def.color+'20';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,def.range,0,Math.PI*2);ctx.stroke();}ctx.scale(es(),es());
    // common stone footing
    ctx.fillStyle='#0e1b16b0';ctx.beginPath();ctx.ellipse(0,9,20,9,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#4d4836';ctx.beginPath();ctx.ellipse(0,4,17,8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#7f7052';ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#a18a5f';ctx.beginPath();ctx.arc(0,-1,11,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#d9c28d';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(0,-1,11,0,Math.PI*2);ctx.stroke();
    if(t.type==='archer'){
      ctx.fillStyle='#53604b';ctx.fillRect(-8,-22,16,22);
      ctx.fillStyle='#748066';ctx.fillRect(-8,-22,5,22);
      ctx.fillStyle='#39453a';ctx.fillRect(4,-19,3,19);
      ctx.fillStyle='#748066';ctx.fillRect(-8,-27,4,5);ctx.fillRect(-2,-27,4,5);ctx.fillRect(4,-27,4,5);
      ctx.fillStyle='#1a251c';ctx.fillRect(-1.5,-17,3,8);ctx.fillStyle='#e3c47f';ctx.fillRect(-.5,-16,1,3);
      ctx.strokeStyle='#e8d59e';ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(0,-9,5.5,Math.PI*.75,Math.PI*1.25);ctx.stroke();
      ctx.strokeStyle='#c8ab74';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(7,-27);ctx.lineTo(7,-38);ctx.stroke();
      ctx.fillStyle='#8ea06b';ctx.beginPath();ctx.moveTo(7,-38);ctx.lineTo(15,-35);ctx.lineTo(7,-32);ctx.closePath();ctx.fill();
    }else if(t.type==='cannon'){
      ctx.fillStyle='#4c5346';ctx.fillRect(-11,-13,22,13);ctx.fillStyle='#707962';ctx.fillRect(-11,-13,6,13);
      ctx.fillStyle='#707962';ctx.fillRect(-11,-17,4,4);ctx.fillRect(-4,-17,4,4);ctx.fillRect(3,-17,4,4);
      ctx.fillStyle='#1b211b';ctx.beginPath();ctx.arc(0,-8,5,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.translate(0,-11);ctx.rotate(t.angle??-.55);ctx.fillStyle='#c1a878';roundRect(2,-5,19,10,2,'#343830','#b49a6c');ctx.fillStyle='#1f231e';ctx.beginPath();ctx.arc(21,0,4.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c8b07a';ctx.fillRect(4,-5,3,10);ctx.restore();
      ctx.fillStyle='#d8b46f';ctx.beginPath();ctx.arc(0,-8,1.8,0,Math.PI*2);ctx.fill();
    }else if(t.type==='frost'){
      ctx.fillStyle='#3f5b57';ctx.beginPath();ctx.arc(0,-8,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#547771';ctx.beginPath();ctx.arc(-3,-10,5,0,Math.PI*2);ctx.fill();
      ctx.shadowColor='#8ce9ea';ctx.shadowBlur=10;
      ctx.fillStyle='#a9e6e3';ctx.beginPath();ctx.moveTo(0,-32);ctx.lineTo(6,-16);ctx.lineTo(0,-10);ctx.lineTo(-6,-16);ctx.closePath();ctx.fill();
      ctx.fillStyle='#6fc4c7';ctx.beginPath();ctx.moveTo(-9,-18);ctx.lineTo(-4,-10);ctx.lineTo(-10,-7);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(9,-19);ctx.lineTo(10,-8);ctx.lineTo(4,-11);ctx.closePath();ctx.fill();
      ctx.shadowBlur=0;ctx.strokeStyle='#d6ffff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-32);ctx.lineTo(0,-10);ctx.stroke();
      ctx.fillStyle='#e6ffff';ctx.beginPath();ctx.arc(0,-20,1.7,0,Math.PI*2);ctx.fill();
    }else{
      ctx.fillStyle='#5d553b';ctx.beginPath();ctx.arc(0,-8,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#81754f';ctx.beginPath();ctx.arc(-2,-11,5,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.translate(0,-17);ctx.rotate(animTime*.35);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.strokeStyle='#d9b762';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);ctx.lineTo(Math.cos(a)*12,Math.sin(a)*12);ctx.stroke();}
      ctx.restore();
      ctx.shadowColor='#ffdc78';ctx.shadowBlur=12;ctx.fillStyle='#f4d478';ctx.beginPath();ctx.arc(0,-17,5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff3bd';ctx.beginPath();ctx.arc(-1,-18,2.4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
    if(t.level>1){ctx.fillStyle='#f0d274';ctx.font='9px "DM Mono"';ctx.textAlign='center';ctx.fillText('+'+(t.level-1),0,24);}ctx.restore();}
  function drawEnemy(e){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle||0);const sc=es();ctx.scale(sc,sc);const big=e.kind==='brute',wisp=e.kind==='wisp';const body=wisp?'#4b7b82':big?'#62443a':'#5e4936',accent=wisp?'#a8efec':big?'#d08a64':'#d6b37d';
    ctx.fillStyle='#101c16aa';ctx.beginPath();ctx.ellipse(0,11,big?14:10,4.5,0,0,Math.PI*2);ctx.fill();
    if(wisp){ctx.fillStyle='#7bdfe333';ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-(big?11:8),9);ctx.lineTo(-(big?8:5),-7);ctx.lineTo(0,-13);ctx.lineTo(big?8:5,-6);ctx.lineTo(big?12:8,9);ctx.closePath();ctx.fill();
    ctx.fillStyle=accent;ctx.beginPath();ctx.arc(0,-7,big?5:3.8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#2a2019';ctx.beginPath();ctx.arc(1.4,-7.5,1.2,0,Math.PI*2);ctx.fill();
    if(!wisp){ctx.strokeStyle='#b8a077';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(4,5);ctx.lineTo(14,-10);ctx.stroke();ctx.fillStyle='#d6c39b';ctx.beginPath();ctx.moveTo(14,-10);ctx.lineTo(11,-4);ctx.lineTo(17,-7);ctx.closePath();ctx.fill();}
    else{ctx.fillStyle='#bdf6f255';ctx.beginPath();ctx.arc(-9,2,2.2,0,Math.PI*2);ctx.arc(-14,5,1.3,0,Math.PI*2);ctx.fill();}
    if(big){ctx.fillStyle='#c7a477';ctx.beginPath();ctx.moveTo(-7,-12);ctx.lineTo(-11,-18);ctx.lineTo(-3,-14);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(7,-12);ctx.lineTo(11,-18);ctx.lineTo(3,-14);ctx.closePath();ctx.fill();ctx.strokeStyle='#b77f5c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,3,9,.2,Math.PI-.2);ctx.stroke();}
    if(e.slow>0){ctx.strokeStyle='#a9e9ee99';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,big?16:13,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    if(e.hp<e.maxHp){ctx.fillStyle='#1c241c';ctx.fillRect(e.x-11*sc,e.y-18*sc,22*sc,2.5);ctx.fillStyle=e.kind==='brute'?'#d78065':e.kind==='wisp'?'#8cdde0':'#c6ba78';ctx.fillRect(e.x-11*sc,e.y-18*sc,22*sc*clamp(e.hp/e.maxHp,0,1),2.5);}}
  function drawFloater(f){ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle=f.color;ctx.font=`600 ${Math.round(10*es())}px "DM Mono"`;ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y);ctx.globalAlpha=1;}
  function drawProjectile(p){const sc=es();ctx.save();ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=9;ctx.beginPath();ctx.arc(p.x,p.y,(p.type==='cannon'?4:2.5)*sc,0,Math.PI*2);ctx.fill();if(p.type==='arrow'){ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.fillRect(-5*sc,-1*sc,8*sc,2*sc);}ctx.restore();}
  function drawParticle(p){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*clamp(p.life/p.max,.2,1),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  function canPlace(x,y,type,show=true){if(x<35||x>820||y<30||y>470)return false;if(distancePath(x,y)<65)return false;if(towers.some(t=>Math.hypot(t.x-x,t.y-y)<38))return false;if(type==='sun'&&towers.filter(t=>t.type==='sun').length>=3)return false;return true;}
  function updateUI(){document.getElementById('goldValue').textContent=gold;document.getElementById('lifeValue').textContent=lives;document.getElementById('killCount').textContent=kills;document.getElementById('waveCount').innerHTML=`WAVE <b>${Math.min(wave,8)}</b> / 8`;document.getElementById('enemyCount').textContent=running?`${enemies.length+spawnLeft} HOSTILE${enemies.length+spawnLeft===1?'':'S'}`:gameWon?'REALM SECURED':gameOver?'KEEP FALLEN':'NO HOSTILES';document.getElementById('progressFill').style.width=`${wave/8*100}%`;document.getElementById('threatLevel').textContent=['I','II','III','IV','V','VI','VII','VIII'][Math.max(0,wave-1)]||'I';document.getElementById('turnNum').textContent=String(Math.max(1,Math.min(wave+1,8))).padStart(2,'0');document.querySelectorAll('.tower-card').forEach(el=>{el.classList.toggle('selected',el.dataset.type===selected);el.classList.toggle('unaffordable',gold<cards[el.dataset.type].cost);});const start=document.getElementById('startWave');start.disabled=running||gameOver||gameWon||wave>=8;start.innerHTML=gameWon?'<span class="play-icon">✦</span><span>VICTORY</span>':gameOver?'<span class="play-icon">×</span><span>DEFEATED</span>':wave>=8?'<span class="play-icon">✦</span><span>REALM SECURED</span>':running?'<span class="play-icon">⚔</span><span>WAVE IN PROGRESS</span>':`<span class="play-icon">▶</span><span>${wave===0?'BEGIN WAVE':'NEXT WAVE'}</span><kbd>SPACE</kbd>`;document.getElementById('pauseBtn').textContent=paused?'▶':'Ⅱ';document.getElementById('pauseBtn').setAttribute('aria-label',paused?'Resume game':'Pause game');const sb=document.getElementById('speedBtn');sb.textContent=`${speed}×`;sb.classList.toggle('fast',speed>1);}
  function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100);}
  function showEnd(win){gameWon=win;gameOver=!win;running=false;paused=false;document.getElementById('statusText').textContent=win?'VICTORY · ASHENWOOD IS SAFE':'THE KEEP HAS FALLEN';document.getElementById('endEmblem').textContent=win?'✦':'×';document.getElementById('endTitle').textContent=win?'The realm endures':'The keep has fallen';document.getElementById('endCopy').textContent=win?'Ashenwood stands. Eight waves broken against your walls — your name is written into the old songs.':'The road is lost and the gate lies open. Regroup, rebuild, and hold the crossing next time.';document.getElementById('endWaves').textContent=Math.min(wave,8);document.getElementById('endKills').textContent=kills;document.getElementById('endGold').textContent=gold;document.getElementById('endOverlay').classList.remove('hidden');updateUI();}
  function restartGame(){gold=160;lives=20;wave=0;kills=0;towers=[];enemies=[];projectiles=[];particles=[];floaters=[];running=false;paused=false;gameOver=false;gameWon=false;spawnLeft=0;spawnTimer=0;speed=1;hover=null;helpPaused=false;last=performance.now();document.getElementById('endOverlay').classList.add('hidden');document.getElementById('statusText').textContent='PREPARE YOUR DEFENSE';document.getElementById('missionTitle').textContent='A quiet moment';document.getElementById('missionCopy').textContent='Scouts report movement beyond the treeline. Prepare your defenses.';document.getElementById('canvasTip').classList.remove('hidden');document.getElementById('selectedInfo').classList.remove('hidden');select('archer');updateUI();}
  document.getElementById('restartBtn').addEventListener('click',restartGame);
  function select(type){selected=type;const label=document.getElementById('selectedInfo');label.classList.remove('hidden');label.querySelector('b').textContent=cards[type].name+' SELECTED';label.querySelector('small').innerHTML=`Click an open tile to place · <kbd>${['archer','cannon','frost','sun'].indexOf(type)+1}</kbd>`;document.getElementById('canvasTip').classList.remove('hidden');updateUI();}
  document.querySelectorAll('.tower-card').forEach(el=>el.addEventListener('click',()=>select(el.dataset.type)));
  canvas.addEventListener('pointermove',ev=>{const r=canvas.getBoundingClientRect();hover={x:(ev.clientX-r.left)/r.width*W,y:(ev.clientY-r.top)/r.height*H};});canvas.addEventListener('pointerleave',()=>hover=null);
  canvas.addEventListener('pointerdown',ev=>{if(!selected||paused||gameOver||gameWon)return;const r=canvas.getBoundingClientRect(),x=Math.floor(((ev.clientX-r.left)/r.width*W)/TILE)*TILE+TILE/2,y=Math.floor(((ev.clientY-r.top)/r.height*H)/TILE)*TILE+TILE/2;if(selected==='sun'&&towers.filter(t=>t.type==='sun').length>=3){toast('The sun’s light can only reach three shrines.');return;}if(!canPlace(x,y,selected)){toast('That ground is too treacherous for a defense.');return;}const def=cards[selected];if(gold<def.cost){toast(`You need ${def.cost-gold} more gold.`);return;}gold-=def.cost;towers.push({x,y,type:selected,cooldown:.2,angle:0,level:1,yieldTimer:8});hover=null;document.getElementById('canvasTip').classList.add('hidden');updateUI();});
  document.getElementById('startWave').addEventListener('click',startWave);
  function startWave(){if(running||gameOver||gameWon||wave>=8)return;wave++;running=true;paused=false;spawnLeft=5+wave*2;spawnTimer=.45;document.getElementById('statusText').textContent=`WAVE ${wave} · ENEMIES APPROACH`;document.getElementById('missionTitle').textContent=['','Scouts on the road','The raiders gather','A heavier host','The dead march','Wolves at the gate','Iron and ash','The last legion','The final assault'][wave]||'The enemy advances';document.getElementById('missionCopy').textContent=`Wave ${wave} is upon us. ${spawnLeft} hostiles are moving through Ashenwood.`;const banner=document.getElementById('waveBanner');banner.innerHTML=`WAVE <b>${wave}</b> INCOMING`;banner.classList.remove('hidden');setTimeout(()=>banner.classList.add('hidden'),1800);updateUI();}
  document.getElementById('pauseBtn').addEventListener('click',()=>{if(!running)return;paused=!paused;updateUI();});
  document.getElementById('speedBtn').addEventListener('click',()=>{speed=speed===1?2:1;updateUI();toast(speed===2?'Battle speed ×2':'Battle speed ×1');});document.getElementById('cancelPlacement').addEventListener('click',()=>{selected=null;document.getElementById('canvasTip').classList.add('hidden');document.getElementById('selectedInfo').classList.add('hidden');document.querySelectorAll('.tower-card').forEach(e=>e.classList.remove('selected'));});
  const backdrop=document.getElementById('modalBackdrop');function showHelp(){if(running&&!paused){helpPaused=true;paused=true;updateUI();}backdrop.classList.remove('hidden');}function hideHelp(){backdrop.classList.add('hidden');if(helpPaused){helpPaused=false;paused=false;updateUI();}}document.getElementById('helpBtn').addEventListener('click',showHelp);document.getElementById('deckHelp').addEventListener('click',showHelp);document.getElementById('modalClose').addEventListener('click',hideHelp);document.getElementById('modalOk').addEventListener('click',hideHelp);backdrop.addEventListener('click',e=>{if(e.target===backdrop)hideHelp();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){hideHelp();return;}if((e.key==='r'||e.key==='R')&&(gameOver||gameWon)){restartGame();return;}if(e.code==='Space'){e.preventDefault();if(!backdrop.classList.contains('hidden'))return;if(running){paused=!paused;updateUI();}else startWave();}if(['1','2','3','4'].includes(e.key))select(['archer','cannon','frost','sun'][Number(e.key)-1]);});
  function update(dt){animTime+=dt;hurt=Math.max(0,hurt-dt*2.2);if(!paused){if(running){spawnTimer-=dt;if(spawnLeft>0&&spawnTimer<=0){spawnEnemy();spawnLeft--;spawnTimer=Math.max(.4,1.05-wave*.045);}for(const e of enemies){let slow=e.slow>0?e.slowFactor:1;e.slow=Math.max(0,e.slow-dt);e.dist+=e.speed*slow*dt;const p=atDistance(e.dist);e.x=p.x;e.y=p.y;e.angle=p.angle;if(e.dist>=pathLength){e.dead=true;const loss=e.kind==='brute'?2:1;lives-=loss;hurt=1;floaters.push({x:e.x,y:e.y-24,text:`-${loss} ♥`,color:'#e0947b',life:1,max:1,vy:-22});makeBurst(e.x,e.y,'#d8876b',9);if(lives<=0&&!gameOver){lives=0;document.getElementById('missionTitle').textContent='The gate is breached';document.getElementById('missionCopy').textContent='The realm has fallen. Raise a new defense and try again.';showEnd(false);}}}
      enemies=enemies.filter(e=>!e.dead);
      towers.forEach(t=>{if(t.type==='sun'){t.yieldTimer-=dt;if(t.yieldTimer<=0){gold+=8+(wave>0?Math.floor(wave/3):0);t.yieldTimer=8;makeBurst(t.x,t.y-13,'#edcc76',5);updateUI();}return;}t.cooldown-=dt;if(t.cooldown<=0){const target=enemies.filter(e=>Math.hypot(e.x-t.x,e.y-t.y)<cards[t.type].range).sort((a,b)=>b.dist-a.dist)[0];if(target){t.angle=Math.atan2(target.y-t.y,target.x-t.x);t.cooldown=cards[t.type].rate*(t.level===2?.8:1);projectiles.push({x:t.x,y:t.y-12,target,speed:t.type==='cannon'?270:410,damage:cards[t.type].damage*(t.level===2?1.55:1),type:cards[t.type].type,color:cards[t.type].color});}}});
      projectiles.forEach(p=>{if(!p.target||p.target.dead){p.dead=true;return;}const dx=p.target.x-p.x,dy=p.target.y-p.y,d=Math.hypot(dx,dy),step=p.speed*dt;if(d<step+4){p.target.hp-=p.damage;p.dead=true;if(p.type==='frost'){p.target.slow=1.45;p.target.slowFactor=.55;}makeBurst(p.target.x,p.target.y,p.color,3);if(p.target.hp<=0){p.target.dead=true;kills++;const reward=p.target.kind==='brute'?11:p.target.kind==='wisp'?8:6;gold+=reward;floaters.push({x:p.target.x,y:p.target.y-26,text:`+${reward}`,color:'#f0d083',life:.9,max:.9,vy:-26});makeBurst(p.target.x,p.target.y,p.target.kind==='wisp'?'#9ee4df':'#d9b469',8);updateUI();}}else{p.x+=dx/d*step;p.y+=dy/d*step;}});projectiles=projectiles.filter(p=>!p.dead);enemies=enemies.filter(e=>!e.dead);
      if(spawnLeft===0&&enemies.length===0&&!gameOver&&!gameWon){running=false;const bonus=35+wave*5;gold+=bonus;floaters.push({x:820,y:200,text:`+${bonus}`,color:'#f0d083',life:1.2,max:1.2,vy:-26});document.getElementById('statusText').textContent=wave===8?'THE REALM ENDURES':'WAVE CLEARED · +'+bonus+' GOLD';document.getElementById('missionTitle').textContent=wave===8?'Ashenwood is safe':'The road is quiet';document.getElementById('missionCopy').textContent=wave===8?'The old road is held. The realm will remember.':'The attackers have been driven back. Your reserves have been replenished.';if(wave===8){setTimeout(()=>showEnd(true),750);}else{toast(`Wave ${wave} cleared · +${bonus} gold`);}updateUI();}
    }particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=14*dt;});particles=particles.filter(p=>p.life>0);floaters.forEach(f=>{f.life-=dt;f.y+=f.vy*dt;f.vy*=.96;});floaters=floaters.filter(f=>f.life>0);}
  }
  function spawnEnemy(){let kind=wave>=4&&Math.random()<.2?'brute':wave>=3&&Math.random()<.18?'wisp':'raider';let hp=(kind==='brute'?100:kind==='wisp'?42:48)+wave*(kind==='brute'?21:11);enemies.push({dist:0,x:path[0].x,y:path[0].y,angle:0,hp,maxHp:hp,kind,speed:(kind==='brute'?29:kind==='wisp'?47:38)+wave*1.7,slow:0,slowFactor:1,dead:false});updateUI();}
  function makeBurst(x,y,color,n){for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,s=20+Math.random()*65;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-18,r:1+Math.random()*2,life:.3+Math.random()*.4,max:.7,color});}}
  background=buildBackground();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{background=buildBackground();});function frame(now){let dt=Math.min(.04,(now-last)/1000);last=now;update(dt*speed);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);updateUI();
  // Tutorial overlay on first visit, with the opening placement still visible.
  setTimeout(showHelp,450);
})();
