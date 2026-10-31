'use strict';
const K=KoldunyCore,{W,H,SPELLS,FAMILIES}=K,$=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const COLORS=['#bc95ed','#7ecdb9'];
const paths={people:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5M2 20v-3a5 5 0 0 1 10 0v3m3-7a4 4 0 0 1 6 4v3',sound:'M4 9h4l5-5v16l-5-5H4Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16',reset:'M4 5v6h6M4 11a8 8 0 1 1 1 7',shuffle:'M3 5h3l12 14h3m-5-4 5 4-5 3M3 19h3l12-14h3m-5-3 5 3-5 4',expand:'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6',portal:'M5 21V10a7 7 0 0 1 14 0v11M2 22h20M9 19v-8a3 3 0 0 1 6 0v8',bulb:'M9 21h6m-7-7a7 7 0 1 1 8 0c-1.5 1-1.5 3-1.5 3h-5S9.5 15 8 14M12 1v2',plank:'m2 12 17-7 3 7-17 7Zm4-1 3 6m8-11 3 6M10 13l5-2',beam:'m2 10 18-5 2 3-18 5Zm2 3v5l18-5v-5M4 18l2 3 16-5v-3m-14-2 1 6m7-8 1 6',crate:'M3 4h18v17H3Zm0 0 18 17M21 4 3 21M3 8h18M7 4v17m10-17v17',stone:'m4 6 12-3 5 5v12L8 22l-4-5Zm0 0 4 5 13-3M8 11v11m4-7 5-1',ball:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM7 7c-3 2-3 6-1 8m8 3 4-4',balloon:'M19 9c0 5-7 10-7 10S5 14 5 9a7 7 0 0 1 14 0Zm-7 10v4M9 4C6 6 7 9 7 9',pin:'m7 3 10 0-2 5v4l4 2H5l4-2V8Zm5 11v9',gust:'M2 7h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M2 17h7a3 3 0 1 1-3 3'};
function icon(name){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[name]+'"/></svg>'}
document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));
document.querySelector('.canvas-wrap').appendChild($('lobbyTemplate').content.cloneNode(true));
let ownName='';try{ownName=K.cleanName(localStorage.getItem('kolduny-name'),'')}catch{}$('playerName').value=ownName;
let sim,selected=0,angle=0,hover=null,eraseMode=false,particles=[],clock=0,last=0,accumulator=0,toastTimer,sound=false,audio,mode='lobby',peer=null,conn=null,myPlayer=0,peerPromise=null,netTime=0,pending=false,connectionReady=false,roomCodeValue='',lastMessageAt=0,lastPingAt=0,view=new Map(),bg=document.createElement('canvas'),stars=[];
let prediction=null,movementInput={},movementSeq=0,pendingCorrectionSeq=null,hostInputSeq=-1,hostCorrectionSeq=null,correctionOffset={x:0,y:0};
bg.width=W;bg.height=H;
function newSeed(exclude){let s,m;do{s=crypto.getRandomValues(new Uint32Array(1))[0];m=K.generate(s)}while(m.kind===exclude||(sim&&exclude!==undefined&&m.spells.some((book,i)=>book.join()===sim.map.spells[i].join())));return s}
function start(seed=newSeed(),level=1){const names=sim?sim.players.map(p=>p.name):['Колдун','Друг'];names[myPlayer]=ownName||'Колдун';sim=K.create(seed,level,{present:connectionReady?[true,true]:[myPlayer===0,myPlayer===1],names});selected=0;angle=0;particles=[];view.clear();hover=null;eraseMode=false;accumulator=0;prediction=null;movementInput={};pendingCorrectionSeq=null;correctionOffset={x:0,y:0};buildBackground();updateUI();sync()}
function connected(){return connectionReady&&!!conn?.open&&K.ready(sim)}
function canPlay(){return connected()&&K.canControl(sim,myPlayer)}
function canWalk(){return connected()&&K.canMove(sim,myPlayer)}
function wizardName(i){return sim.players[i].name}
function notify(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
function updateUI(){
 const a=myPlayer,mine=canPlay(),together=connected(),f=FAMILIES[sim.map.kind];document.documentElement.style.setProperty('--active',COLORS[a]);
 $('levelNumber').textContent=String(sim.level).padStart(2,'0');$('levelName').textContent=f.name;$('familyTag').textContent=f.tag;$('seedTag').textContent='МИР '+sim.map.seed.toString(36).toUpperCase();
 $('turnPill').innerHTML='<i></i><span></span>';$('turnPill').querySelector('span').textContent=together?'Магия: '+wizardName(sim.active):'Ожидаем второго игрока';$('wizardName').textContent=wizardName(a);$('yourTurn').textContent=!together?'ОЖИДАНИЕ':sim.players[a].home?'В ПОРТАЛЕ':mine?'ВАША МАГИЯ':'МАГИЯ ДРУГА';$('wizardHint').textContent=!together?'Для игры нужно подключение друга':sim.players[a].home?'Ваш путь завершён. Наблюдайте за другом.':mine?'Колдуйте. Двигаться можно обоим.':'Можно ходить и прыгать. Магия пока у друга.';$('manaLabel').textContent=!together?'НУЖЕН ВТОРОЙ МАГ':sim.players[a].home?'КОЛДОВСТВО ЗАВЕРШЕНО':mine?'МАГИЯ ГОТОВА':'ВОССТАНАВЛИВАЕТСЯ';
 $('lobby').hidden=together;$('lobbyCount').textContent='1 / 2';$('selfName').textContent=wizardName(a);$('lobbyTitle').textContent=roomCodeValue?'Ждём второго колдуна.':'Для магии нужны двое.';$('lobbyText').textContent=roomCodeValue?'Отправьте код другу. Его колдун появится после входа в комнату.':'Создайте комнату или войдите к другу. Играть можно только вместе.';$('lobbyCode').textContent=roomCodeValue;$('lobbyCode').classList.toggle('hidden',!roomCodeValue);document.querySelector('.game-shell').classList.toggle('waiting',!together);document.querySelector('.workbench').classList.toggle('waiting',!together);
 ['pass','rotateLeft','rotateRight','eraseTouch'].forEach(id=>$(id).disabled=!mine);
 $('levelTip').textContent=!together?'Игра ждёт двух игроков. Вы управляете только своим колдуном.':sim.players[a].home?'Ваш колдун уже вышел: движение и заклинания недоступны. Оставайтесь в комнате до выхода напарника.':f.hint;$('worldHint').textContent=sim.players[a].home?wizardName(a)+' уже в портале. Второй маг завершает путь самостоятельно.':sim.map.kind===2?'Два берега. Один портал. Встречайтесь в центре.':sim.map.kind===1?'Выход наверху. Гравитация думает иначе.':sim.map.kind===3?'Равновесие — это тоже заклинание.':'Если путь исчез — его придётся изобрести.';
 $('spells').innerHTML=sim.map.spells[a].map((s,i)=>'<button class="spell '+(i===selected&&!eraseMode?'selected':'')+'" '+(!mine?'disabled ':'')+'data-spell="'+i+'" title="'+SPELLS[s].tip+'" aria-pressed="'+(i===selected&&!eraseMode)+'"><span class="spell-icon">'+icon(SPELLS[s].icon)+'</span><span><b>'+SPELLS[s].name+'</b><small>'+SPELLS[s].sub+'</small></span><span class="spell-number">'+(i+1)+'</span></button>').join('');
 document.querySelectorAll('[data-spell]').forEach(b=>b.onclick=()=>{selected=+b.dataset.spell;eraseMode=false;updateUI();canvas.focus({preventScroll:true})});
 $('angleLabel').textContent=Math.round(angle*180/Math.PI)+'°';$('stars').textContent=sim.map.stars.map(s=>s.got?'✦':'✧').join(' ');$('moveCount').textContent=sim.casts+' заклинаний';$('objectCount').textContent=sim.objects.length+' / '+K.MAX_OBJECTS+' предмета';
 if(sim.won&&together){$('win').classList.remove('hidden');$('winText').textContent=sim.casts+' заклинаний · '+sim.map.stars.filter(s=>s.got).length+' из 3 звёзд · два мага дома';document.querySelector('.win-stars').textContent=sim.map.stars.map(s=>s.got?'✦':'✧').join(' ')}else $('win').classList.add('hidden');
 $('eraseTouch').style.color=eraseMode?'#ecc39d':'';
}
function rotate(d){angle+=d*Math.PI/12;if(angle>Math.PI)angle-=Math.PI*2;if(angle< -Math.PI)angle+=Math.PI*2;updateUI()}
function beep(f=500){if(!sound)return;try{audio??=new AudioContext();audio.resume();const osc=audio.createOscillator(),g=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(f,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(f*1.4,audio.currentTime+.15);g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.3);osc.connect(g).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.3)}catch{}}
function burst(x,y,color,n=25){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*160,vy:(Math.random()-.5)*160,life:.7+Math.random()*.7,color})}
function events(){for(const e of sim.events){if(e.type==='cast'){burst(e.x,e.y,COLORS[e.owner],32);beep(390)}if(e.type==='jump')beep(170);if(e.type==='star'){burst(e.x,e.y,'#f4cd81',35);beep(800)}if(e.type==='fall'){notify(wizardName(e.player)+': снова на старте. Конструкции остались.');burst(sim.map.starts[e.player].x,sim.map.starts[e.player].y,COLORS[e.player],15)}if(e.type==='home'){burst(e.x,e.y,'#f2d19a',50);notify(wizardName(e.player)+' у портала. Осталось довести второго мага.')}if(e.type!=='jump')updateUI()}sim.events=[]}
function act(action){
 if(['cast','pass'].includes(action.type)){if(!canPlay())return;action.turn=sim.turns}
 if(mode==='guest'){if(conn?.open&&!pending){conn.send({type:'action',action});pending=true;setTimeout(()=>pending=false,600)}return}
 applyAction(action,myPlayer);sync();
}
function applyAction(a,actor){
 if(['cast','pass'].includes(a.type)&&!connected())return{ok:false,reason:'Ожидаем второго игрока'};
 if(a.type==='cast'){const r=K.cast(sim,a,actor,a.turn);if(!r.ok)return r;events();return r}
 if(a.type==='pass'){if(!K.endTurn(sim,actor,a.turn))return{ok:false,reason:'Сейчас ход напарника'};events();return{ok:true}}
 if(actor!==0)return{ok:false,reason:'Мир меняет создатель комнаты'};
 if(a.type==='reset')start(sim.map.seed,sim.level);
 if(a.type==='world')start(a.seed,a.level);
 return{ok:true};
}
function castAt(p,erase=false){if(!canPlay()){notify(!connected()?'Для игры нужен второй человек':sim.won?'Оба колдуна уже дома':'Сейчас ход вашего напарника');return}const spell=erase||eraseMode?'erase':sim.map.spells[myPlayer][selected];const result=K.preview(sim,spell,p.x,p.y,angle);if(!result.ok){notify(result.reason);return}act({type:'cast',spell,x:p.x,y:p.y,angle})}
function sync(){if(mode==='host'&&connectionReady&&conn?.open)conn.send({type:'state',state:K.snapshot(sim)})}
function path(c,points,fill,stroke,line=1){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke()}}
function ellipse(c,x,y,rx,ry,fill,stroke,line=1){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke()}}
function rect(c,x,y,w,h,r,fill,stroke,line=1){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke()}}
function line(c,x,y,xx,yy,color,width=1){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=width;c.stroke()}
function star(c,x,y,r,color,rotation=0){c.save();c.translate(x,y);c.rotate(rotation);c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,rr=i%2?r*.25:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}c.closePath();c.fillStyle=color;c.fill();c.restore()}
function arch(c,x,y,w,h,color,stroke){c.beginPath();c.moveTo(x-w/2,y);c.lineTo(x-w/2,y-h+w/2);c.arc(x,y-h+w/2,w/2,Math.PI,0);c.lineTo(x+w/2,y);c.closePath();if(color){c.fillStyle=color;c.fill()}if(stroke){c.strokeStyle=stroke;c.stroke()}}
function tower(c,x,y,w,h,color,details){
 rect(c,x-w/2,y-h,w,h,2,color);path(c,[[x-w*.65,y-h],[x,y-h-w*.6],[x+w*.65,y-h]],color);
 rect(c,x-w*.65,y-h+8,w*1.3,8,1,color);line(c,x-w/2,y-h+35,x+w/2,y-h+35,'#c3b4db0b',2);
 for(let j=0;j<3;j++){const yy=y-h+65+j*85;if(yy>y-10)break;arch(c,x,yy,14,29,details?'#baa57b15':'#161e322b');if(details){line(c,x,yy-24,x,yy,'#d6bf9020');line(c,x-6,yy-12,x+6,yy-12,'#d6bf9020')}}
}
function buildBackground(){
 const c=bg.getContext('2d'),r=K.random(sim.map.seed^184737);const schemes=[['#131b31','#2e2945','#40334c'],['#101d2d','#273545','#38404b'],['#1c1b32','#35304c','#53404e'],['#151d2c','#283340','#3b3e49']],pal=schemes[sim.map.kind];
 const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,pal[0]);g.addColorStop(.6,pal[1]);g.addColorStop(1,pal[2]);c.fillStyle=g;c.fillRect(0,0,W,H);
 const mx=sim.map.flip?W*.25:W*.74,my=140;let moon=c.createRadialGradient(mx,my,0,mx,my,200);moon.addColorStop(0,'#f5dbae1d');moon.addColorStop(.4,'#f5dbae08');moon.addColorStop(1,'#f5dbae00');c.fillStyle=moon;c.fillRect(mx-200,0,400,400);ellipse(c,mx,my,58,58,'#ded9bd');ellipse(c,mx-17,my-14,60,57,pal[0]);ellipse(c,mx,my,75,75,null,'#ded9bd0b');
 stars=[];for(let i=0;i<180;i++){let x=r()*W,y=r()*H*.78;const alpha=.12+r()*.4;ellipse(c,x,y,r()>.93?1.7:.8,.8,'rgba(222,218,233,'+alpha+')');if(i<30)stars.push({x,y,s:r()*4,phase:r()*6})}
 // Orbit lines and the skeleton of an abandoned celestial observatory.
 c.strokeStyle='#bfa6d10d';c.lineWidth=1;for(let i=0;i<4;i++){c.beginPath();c.ellipse(mx,my,170+i*85,160+i*75,-.35,0,Math.PI*2);c.stroke()}
 for(let i=0;i<13;i++){let x=i*125+35+r()*80,h=170+r()*330;tower(c,x,H+80,45+r()*60,h,'#182238aa',false)}
 for(let i=0;i<8;i++){let x=i*220-20,h=200+r()*380;tower(c,x,H+100,75+r()*50,h,'#172236bb',true)}
 arch(c,720,H+80,630,640,null,'#1623376b');c.lineWidth=35;arch(c,720,H+90,610,625,null,'#18243975');c.lineWidth=1;
 for(let i=0;i<5;i++){const x=i*315+65;line(c,x,-5,x+20,100+i%3*18,'#81738f19',2);ellipse(c,x+20,105+i%3*18,7,12,null,'#a18ca72a');star(c,x+20,105+i%3*18,4,'#cbb47c3b')}
 // Volumetric moonlight and the fog in the depths.
 path(c,[[mx-15,190],[mx+8,190],[mx+460,H],[mx+80,H]],'#d5c9bb04');path(c,[[mx+22,190],[mx+29,190],[mx+700,H],[mx+480,H]],'#d5c9bb03');
 let fog=c.createLinearGradient(0,630,0,H);fog.addColorStop(0,'#73578b00');fog.addColorStop(1,'#73658228');c.fillStyle=fog;c.fillRect(0,630,W,220);
 for(let i=0;i<4200;i++){c.fillStyle=r()>.5?'#ffffff03':'#00000005';c.fillRect(r()*W,r()*H,1+r()*2,1)}
 // Isolated chunks of masonry. Their collision surface exactly matches the top.
 for(const p of sim.map.platforms)drawIsland(c,p,r);
}
function drawIsland(c,p,r){
 const {x,y,w,h}=p;ellipse(c,x+w/2,y+42,w*.6,26,'#0a122132');
 path(c,[[x+2,y+16],[x+w-2,y+16],[x+w-15,y+h+25],[x+w*.79,y+h+53],[x+w*.67,y+h+34],[x+w*.53,y+h+85],[x+w*.38,y+h+48],[x+w*.24,y+h+63],[x+16,y+h+20]],'#2b3042','#111b2a',3);
 const rock=['#35394a','#414252','#303848','#49434e'];for(let j=0;j<Math.floor(w/40);j++){const xx=x+20+j*42;path(c,[[xx,y+h-2],[xx+38,y+h-5],[xx+16,y+h+35+r()*30]],rock[j%4])}
 rect(c,x,y,w,h,4,'#464658','#1b2232',3);rect(c,x+2,y+3,w-4,10,3,'#656176');line(c,x+6,y+3,x+w-6,y+3,'#aca1b1',1.4);rect(c,x+5,y+16,w-10,4,1,'#292e41');
 for(let xx=x+28;xx<x+w-8;xx+=42){line(c,xx,y+22,xx-6,y+h-1,'#2d3041',2);line(c,xx-12,y+27,xx+2,y+27,'#77708438')}
 // Bronze corner braces and inlaid constellations.
 [x+11,x+w-11].forEach(xx=>{rect(c,xx-4,y,8,h+3,2,'#927858','#262331',1.3);ellipse(c,xx,y+8,1.7,1.7,'#e3bb7b');ellipse(c,xx,y+h-7,1.7,1.7,'#c9a36e')});
 for(let xx=x+45;xx<x+w-30;xx+=66){star(c,xx,y+30,4,'#b29b6a8c');line(c,xx+8,y+30,xx+29,y+30,'#a88b6138')}
 if(w>170){const xx=x+w*.22;c.strokeStyle='#595266';c.lineWidth=2;c.beginPath();c.moveTo(xx,y+h+7);c.bezierCurveTo(xx-25,y+h+38,xx+33,y+h+39,xx+4,y+h+71);c.stroke();for(let j=0;j<3;j++)ellipse(c,xx+3+j*3,y+h+20+j*12,7,3,'#6c737360')}
 // Small candles make the safe surfaces readable.
 if(w>180){const xx=x+w-31;rect(c,xx-3,y-13,6,12,2,'#a8a9b0');ellipse(c,xx,y-18,2,5,'#ffe0a3');let g=c.createRadialGradient(xx,y-17,0,xx,y-17,28);g.addColorStop(0,'#ffd09725');g.addColorStop(1,'#ffd09700');c.fillStyle=g;c.fillRect(xx-28,y-45,56,56)}
}
function drawPortal(){const {x,y}=sim.map.exit;ctx.save();ctx.translate(x,y);const light=ctx.createRadialGradient(0,-58,1,0,-58,140);light.addColorStop(0,'#edc7803d');light.addColorStop(.5,'#e2b97911');light.addColorStop(1,'#e2b97900');ctx.fillStyle=light;ctx.fillRect(-140,-200,280,220);
 ctx.lineWidth=14;arch(ctx,0,-1,72,117,null,'#111b2b');ctx.lineWidth=9;arch(ctx,0,-1,72,117,null,'#83786b');ctx.lineWidth=2;arch(ctx,0,-1,72,117,null,'#d5b884');
 const g=ctx.createLinearGradient(0,-110,0,0);g.addColorStop(0,'#997d87');g.addColorStop(.5,'#f5ce8b');g.addColorStop(1,'#d59d66');arch(ctx,0,0,55,106,g);ctx.save();ctx.globalAlpha=.4+.1*Math.sin(clock*2);ctx.lineWidth=1;for(let i=0;i<3;i++)ellipse(ctx,0,-52,12+i*5,26+i*9,null,'#fff0be');ctx.restore();star(ctx,0,-53,13,'#fff0c6',clock*.1);
 rect(ctx,-48,-2,96,9,3,'#625e67','#141d2b',2);rect(ctx,-40,-8,80,7,2,'#ac9473');star(ctx,0,-137,10,'#dfbc7b');line(ctx,-27,-138,-14,-138,'#c9a97666');line(ctx,14,-138,27,-138,'#c9a97666');ctx.textAlign='center';ctx.font='500 11px Golos Text,Arial';ctx.fillStyle='#d4bb8a';ctx.fillText('П О Р Т А Л',0,-160);
 for(let i=0;i<8;i++){let a=clock*.5+i*.78;ellipse(ctx,Math.cos(a)*54,-58+Math.sin(a)*66,1.4,1.4,'#ecc88099')}ctx.restore();
}
function visibleBody(id,b){if(mode==='guest'&&id==='p'+myPlayer&&prediction)return{x:prediction.player.body.position.x+correctionOffset.x,y:prediction.player.body.position.y+correctionOffset.y,a:0};if(mode!=='guest')return{x:b.position.x,y:b.position.y,a:b.angle};let v=view.get(id);if(!v){v={x:b.position.x,y:b.position.y,a:b.angle};view.set(id,v)}v.x+=(b.position.x-v.x)*.55;v.y+=(b.position.y-v.y)*.55;v.a+=(b.angle-v.a)*.55;return v}
function drawObject(o,ghost=false,valid=true){
 const b=o.body,v=ghost?{x:b.position.x,y:b.position.y,a:b.angle}:visibleBody('o'+o.id,b);ctx.save();ctx.translate(v.x,v.y);ctx.rotate(v.a);if(ghost){ctx.globalAlpha=.45;ctx.shadowBlur=18;ctx.shadowColor=valid?'#ccb5ff':'#f79583'}
 const edge='#221b2c';
 if(o.type==='plank'||o.type==='beam'){
  const w=o.w,h=o.h,wood=o.type==='plank';rect(ctx,-w/2,-h/2,w,h,4,wood?'#aa7657':'#687383',edge,3);rect(ctx,-w/2+4,-h/2+2,w-8,4,2,wood?'#d8a273':'#a1a6ae');line(ctx,-w/2+5,h/2-3,w/2-5,h/2-3,wood?'#764a42':'#424a60',2);
  for(let x=-w/2+24;x<w/2-15;x+=34){if(wood){line(ctx,x,-2,x+23,-3,'#78504880');ellipse(ctx,x+8,3,4,1,null,'#78504899')}else{line(ctx,x,-h/2+5,x+18,h/2-4,'#333c50',1.5);line(ctx,x+18,-h/2+5,x,h/2-4,'#333c50',1.5)}}
  [-1,1].forEach(d=>{const x=d*(w/2-13);rect(ctx,x-5,-h/2-1,10,h+2,2,'#c0a472',edge,1.3);ellipse(ctx,x,0,2,2,'#f1d09b')});
 }else if(o.type==='crate'||o.type==='stone'){
  const w=o.w;rect(ctx,-w/2,-w/2,w,w,5,o.type==='crate'?'#9d6d50':'#767386',edge,3);
  if(o.type==='crate'){rect(ctx,-w/2+7,-w/2+7,w-14,w-14,1,'#735044');for(let x=-w/2+16;x<w/2-9;x+=13)line(ctx,x,-w/2+8,x,w/2-8,'#493442',1.5);path(ctx,[[-27,-24],[-23,-28],[27,24],[23,28]],'#c49669',edge,1);path(ctx,[[-27,24],[-23,28],[27,-24],[23,-28]],'#bc8c60',edge,1);rect(ctx,-w/2,-w/2,w,7,2,'#d2a273');rect(ctx,-w/2,w/2-7,w,7,2,'#a57c58');[-1,1].forEach(dx=>[-1,1].forEach(dy=>ellipse(ctx,dx*(w/2-9),dy*(w/2-9),2,2,'#393244')))}
  else{rect(ctx,-w/2+5,-w/2+4,w-10,8,2,'#a7a0ac');path(ctx,[[-20,18],[-22,-9],[-4,-19],[20,-3],[10,21]],'#64677c');star(ctx,0,2,13,'#bda379');star(ctx,0,2,7,'#777184');line(ctx,-23,22,22,22,'#4b4c63',3)}
 }else if(o.type==='ball'){
  const g=ctx.createRadialGradient(-12,-14,2,0,0,35);g.addColorStop(0,'#b2b0c7');g.addColorStop(.5,'#7f819c');g.addColorStop(1,'#414b66');ellipse(ctx,0,0,o.r,o.r,g,edge,3);ellipse(ctx,0,0,o.r-7,o.r-7,null,'#e2c68a80',2);star(ctx,0,0,14,'#d2bb90');star(ctx,0,0,8,'#656780');ellipse(ctx,-11,-15,4,2,'#e5d6ce88');
 }else if(o.type==='balloon'){
  const g=ctx.createLinearGradient(-25,0,25,0);g.addColorStop(0,'#7b416d');g.addColorStop(.45,'#c180a3');g.addColorStop(1,'#74395e');ellipse(ctx,0,0,25,31,g,edge,2.5);ellipse(ctx,0,0,13,30,null,'#edc88c77',1.2);line(ctx,-23,7,23,7,'#e4c29288',1.5);star(ctx,0,-7,9,'#f3d795');path(ctx,[[-5,29],[5,29],[3,37],[-3,37]],'#b69267',edge,1);ellipse(ctx,-8,-16,4,6,'#f8c8d845');
 }
 if(!ghost&&o.owner>=0&&o.type!=='balloon'){ctx.fillStyle=COLORS[o.owner];ctx.globalAlpha=.7;ellipse(ctx,0,o.type==='plank'||o.type==='beam'?1:20,2,2,COLORS[o.owner])}
 ctx.restore();
}
function drawJoints(){for(const j of sim.joints){const a=sim.objects.find(o=>o.id===j.a);if(!a)continue;const ap={x:a.body.position.x+j.joint.pointA.x,y:a.body.position.y+j.joint.pointA.y};if(j.type==='pin'){ellipse(ctx,ap.x,ap.y,7,7,'#d5b679','#32263e',2);star(ctx,ap.x,ap.y,4,'#f7dda3');ellipse(ctx,ap.x,ap.y,12,12,null,'#d9b67720')}else{const b=sim.objects.find(o=>o.id===j.b);if(!b)continue;const bp={x:b.body.position.x+j.joint.pointB.x,y:b.body.position.y+j.joint.pointB.y};ctx.beginPath();ctx.moveTo(ap.x,ap.y);ctx.quadraticCurveTo((ap.x+bp.x)/2+Math.sin(clock)*3,(ap.y+bp.y)/2, bp.x,bp.y);ctx.strokeStyle='#b39a7d';ctx.lineWidth=2;ctx.stroke()}}}
function drawWizard(p,i){
 if(!p.present||p.home)return;if(mode==='guest'&&i===myPlayer&&prediction)p={...p,body:prediction.player.body,face:prediction.player.face,ground:prediction.player.ground};const v=visibleBody('p'+i,p.body);ctx.save();ctx.translate(v.x,v.y);const active=connected()&&sim.active===i,walk=Math.min(1,Math.abs(p.body.velocity.x)/3),leg=Math.sin(clock*14)*walk*5,color=i?'#70b6a7':'#9e79d0',dark=i?'#355d65':'#5f447f',light=i?'#a1e0c1':'#d2abf1';
 ellipse(ctx,0,26,22,5,'#080f2555');if(active){ellipse(ctx,0,27,26,7,null,COLORS[i]+'99',1.4);ellipse(ctx,0,27,33,10,null,COLORS[i]+'22');star(ctx,0,-69,6,COLORS[i],clock*.4)}
 // Animated boots, thick outlines, cape and a bright scarf.
 rect(ctx,-13,18+leg,11,9,3,'#343345','#172031',2);rect(ctx,3,18-leg,12,9,3,'#343345','#172031',2);
 path(ctx,[[-12,-7],[10,-7],[19,21],[3,25],[-20,21]],dark,'#172030',2.5);const g=ctx.createLinearGradient(-14,0,15,24);g.addColorStop(0,light);g.addColorStop(.35,color);g.addColorStop(1,dark);path(ctx,[[-10,-7],[9,-7],[14,20],[-15,20]],g,'#2d2d42',1.2);line(ctx,-6,2,-8,16,light+'77',1.2);
 path(ctx,[[8,-4],[p.face*24,-2],[p.face*30,5],[8,4]],i?'#d3ba7e':'#ddac82','#25283b',1.3);
 ellipse(ctx,0,-17,12,14,'#e6c6a2','#25283a',2);path(ctx,[[-11,-15],[-9,-24],[9,-25],[11,-14],[5,-19],[-3,-20]],i?'#d1d2c1':'#534355');
 ellipse(ctx,-4+p.face*2,-16,1.7,2,'#29323f');ellipse(ctx,5+p.face*2,-16,1.7,2,'#29323f');ellipse(ctx,p.face*2,-11,2.5,1.5,'#c48c78');
 if(i)path(ctx,[[-9,-9],[-5,-3],[0,4],[6,-3],[9,-10],[1,-6]],'#d4dfd0','#293940',1);else{ellipse(ctx,-11,-13,3,5,'#584262');path(ctx,[[-9,-7],[-12,2],[-15,-7]],'#745878')}
 const hat=ctx.createLinearGradient(-20,-55,16,-25);hat.addColorStop(0,light);hat.addColorStop(.4,color);hat.addColorStop(1,dark);path(ctx,[[-17,-29],[-9,-42],[-2,-63],[7,-58],[11,-37],[22,-28]],hat,'#1b2537',2.5);path(ctx,[[-2,-63],[7,-58],[14,-55],[5,-55]],light,'#263047',1);ellipse(ctx,0,-28,25,6,dark,'#172439',2);ellipse(ctx,0,-30,25,5,color);path(ctx,[[-10,-36],[11,-35],[13,-29],[-12,-30]],'#d6ba83','#615161',1.2);star(ctx,2,-40,4,'#f6deaa');
 const sx=p.face*23;line(ctx,sx,25,sx,-24,'#182233',5);line(ctx,sx,25,sx,-24,'#a0856b',2.5);ellipse(ctx,sx,-27,6,8,COLORS[i],'#283042',2);ellipse(ctx,sx-1,-29,2,3,'#fff2c7');ellipse(ctx,p.face*17,3,4,4,'#e9cba6','#2f3244',1.5);
 ctx.font='600 11px Golos Text,Arial';ctx.textAlign='center';ctx.fillStyle=active?COLORS[i]:'#aba6b9';ctx.fillText(wizardName(i),0,48);ctx.restore();
}
function drawPreview(){if(!hover||!canPlay())return;const sp=eraseMode?'erase':sim.map.spells[sim.active][selected],p=sim.players[sim.active].body.position,valid=K.preview(sim,sp,hover.x,hover.y,angle);ctx.save();ctx.setLineDash([3,11]);if(!sim.players[sim.active].home)ellipse(ctx,p.x,p.y,K.RANGE,K.RANGE,null,COLORS[sim.active]+'27',1);ctx.restore();
 const col=valid.ok?'#d3b9fa':'#d98383';
 if(['pin','erase','gust'].includes(sp)||sp==='balloon'&&valid.target){ellipse(ctx,hover.x,hover.y,16,16,null,col,1.5);line(ctx,hover.x-24,hover.y,hover.x-10,hover.y,col);line(ctx,hover.x+10,hover.y,hover.x+24,hover.y,col);line(ctx,hover.x,hover.y-24,hover.x,hover.y-10,col);if(sp==='gust'){const dx=Math.cos(angle)*60,dy=Math.sin(angle)*60;line(ctx,hover.x,hover.y,hover.x+dx,hover.y+dy,col,2)}
 }else{const d=SPELLS[sp];drawObject({type:sp,w:d.w,h:d.h,r:d.r,body:{position:{x:hover.x,y:hover.y},angle}},true,valid.ok)}
 ctx.font='500 11px Golos Text,Arial';ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText(valid.ok?(sp==='erase'?'Рассеять':SPELLS[sp].name)+' · '+(sp==='pin'?'шарнир':Math.round(angle*180/Math.PI)+'°'):'× '+valid.reason,Math.max(180,Math.min(W-180,hover.x)),Math.max(90,hover.y-60));
}
function render(dt){clock+=dt;ctx.clearRect(0,0,W,H);ctx.drawImage(bg,0,0);for(const s of stars){ctx.globalAlpha=.25+.25*Math.sin(clock+s.phase);star(ctx,s.x,s.y,2+s.s*.2,'#e3ccae');ctx.globalAlpha=1}
 for(let i=0;i<20;i++){const x=(i*97.43+clock*5)%W,y=H-((i*63.6+clock*9)%H);ellipse(ctx,x,y,1.3,1.3,i%3?'#c6abd733':'#eec99255')}
 drawPortal();sim.map.stars.forEach((s,i)=>{if(s.got)return;const y=s.y+Math.sin(clock*2+i)*5;ellipse(ctx,s.x,y,18,18,'#e2b57109');star(ctx,s.x,y,11,'#efcd89',Math.sin(clock)*.1);star(ctx,s.x,y,5,'#fff0c4')});
 sim.objects.forEach(o=>drawObject(o));drawJoints();sim.players.forEach(drawWizard);drawPreview();
 particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=30*dt;p.life-=dt;ctx.globalAlpha=Math.min(1,Math.max(0,p.life));star(ctx,p.x,p.y,Math.min(4,p.life*4),p.color);ctx.globalAlpha=1}
 // Spawn sigils remain as landmarks after a fall.
 sim.map.starts.forEach((p,i)=>{if(!sim.players[i].present||sim.players[i].home)return;ellipse(ctx,p.x,sim.map.platforms[p.platform].y-1,19,3,null,COLORS[i]+'55',1)});
}
function correctLocalMovement(d){if(!prediction)return;const old={x:prediction.player.body.position.x+correctionOffset.x,y:prediction.player.body.position.y+correctionOffset.y};K.correctPrediction(prediction,d);const dx=old.x-d.x,dy=old.y-d.y;correctionOffset=Math.hypot(dx,dy)>140?{x:0,y:0}:{x:dx,y:dy}}
function flushMovementCorrection(){if(hostCorrectionSeq!==null&&connected()){conn.send({type:'movementCorrection',seq:hostCorrectionSeq,player:K.snapshot(sim).players[1]});hostCorrectionSeq=null}}
function frame(t){const dt=Math.min(.1,(t-last)/1000||.016);last=t;if(connected()&&(mode==='host'||mode==='guest'&&prediction&&canWalk())){accumulator+=dt;while(accumulator>=1/60){if(mode==='host')K.step(sim);else K.stepPrediction(prediction,movementInput);accumulator-=1/60}if(mode==='host'){events();flushMovementCorrection()}else{if(prediction.events.some(e=>e.type==='jump'))beep(170);prediction.events=[]}}else accumulator=0;const fade=Math.exp(-18*dt);correctionOffset.x*=fade;correctionOffset.y*=fade;render(dt);if(mode==='host'&&connected()&&(netTime+=dt)>.05){netTime=0;sync()}if(conn?.open&&connectionReady){const now=performance.now();if(now-lastPingAt>2000){lastPingAt=now;conn.send({type:'ping'})}if(now-lastMessageAt>12000)disconnect(conn,'Друг не отвечает. Игра остановлена до подключения.')}requestAnimationFrame(frame)}
function sendMovement(released){sim.inputs[myPlayer]={...movementInput};if(mode==='guest'&&connected()){movementSeq++;pendingCorrectionSeq=released?movementSeq:null;conn.send({type:'input',seq:movementSeq,released,input:{...movementInput}})}}
function input(key,down){if(!['left','right','jump'].includes(key)||down&&!canWalk()||!!movementInput[key]===down)return;movementInput[key]=down;sendMovement(!down)}
function release(){movementInput={};sim.inputs[myPlayer]={};sendMovement(true)}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
canvas.onpointermove=e=>hover=point(e);canvas.onpointerleave=()=>hover=null;canvas.onpointerdown=e=>{if(e.button===2)return;e.preventDefault();canvas.focus({preventScroll:true});hover=point(e);castAt(hover)};canvas.oncontextmenu=e=>{e.preventDefault();castAt(point(e),true)};canvas.addEventListener('wheel',e=>{e.preventDefault();rotate(e.deltaY>0?1:-1)},{passive:false});
const keymap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump'};
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||e.target.tagName==='INPUT')return;if(keymap[e.code]){e.preventDefault();input(keymap[e.code],true)}if(['Digit1','Digit2','Digit3'].includes(e.code)){selected=+e.code.slice(-1)-1;eraseMode=false;updateUI()}if(e.code==='KeyQ')rotate(-1);if(e.code==='KeyE')rotate(1);if(e.code==='Escape'){eraseMode=false;updateUI()}if(e.code==='Tab'){e.preventDefault();if(canPlay())act({type:'pass'})}});
document.addEventListener('keyup',e=>{if(keymap[e.code])input(keymap[e.code],false)});window.addEventListener('blur',release);
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);input(b.dataset.key,true)};b.onpointerup=b.onpointercancel=()=>input(b.dataset.key,false)});
$('rotateLeft').onclick=()=>rotate(-1);$('rotateRight').onclick=()=>rotate(1);$('eraseTouch').onclick=()=>{eraseMode=!eraseMode;updateUI();notify(eraseMode?'Нажмите на предмет, который нужно рассеять':'Выбрано заклинание')};$('pass').onclick=()=>{if(canPlay())act({type:'pass'});else notify('Сейчас ход друга')};
function hostOnly(fn){if(mode==='guest'){notify('Мир меняет создатель комнаты');return}release();fn()}
$('reset').onclick=()=>hostOnly(()=>act({type:'reset'}));$('newWorld').onclick=()=>hostOnly(()=>act({type:'world',seed:newSeed(sim.map.kind),level:sim.level}));$('next').onclick=()=>hostOnly(()=>act({type:'world',seed:newSeed(sim.map.kind),level:sim.level+1}));
$('help').onclick=$('helpFooter').onclick=()=>{release();$('helpDialog').showModal()};$('roomBtn').onclick=()=>{release();$('roomDialog').showModal()};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}});
$('sound').onclick=()=>{sound=!sound;$('sound').style.color=sound?'#edcf91':'';$('sound').setAttribute('aria-label',sound?'Выключить звук':'Включить звук');beep()};$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.game-shell').requestFullscreen()}catch{notify('Этот браузер не поддерживает полный экран')}};
function status(text){$('connectionStatus').textContent=text;$('roomStatus').textContent=text}
function loadPeer(){if(window.Peer)return Promise.resolve();if(peerPromise)return peerPromise;peerPromise=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';s.onload=res;s.onerror=()=>{peerPromise=null;rej(Error('Не удалось загрузить связь. Проверьте интернет.'))};document.head.appendChild(s)});return peerPromise}
function saveName(announce=true){const name=K.cleanName($('playerName').value,'');if(!name){$('nameStatus').textContent='Введите имя вашего колдуна';$('playerName').focus();return false}ownName=name;$('playerName').value=name;try{localStorage.setItem('kolduny-name',name)}catch{}sim.players[myPlayer].name=name;if(connected()){if(mode==='guest')conn.send({type:'rename',name});else sync()}$('nameStatus').textContent=announce?'Имя сохранено. Напарник увидит его в игре.':'Имя вашего колдуна: '+name;updateUI();return true}
function closeNetwork(){const old=peer,seed=sim.map.seed,level=sim.level;connectionReady=false;conn=null;peer=null;mode='lobby';myPlayer=0;roomCodeValue='';pending=false;release();if(old)old.destroy();$('roomCode').classList.add('hidden');start(seed,level);status('Ожидаем второго игрока · 1 / 2')}
function disconnect(c,text){if(conn!==c)return;connectionReady=false;conn=null;pending=false;release();prediction=null;pendingCorrectionSeq=null;K.setPresent(sim,1-myPlayer,false);sim.events=[];accumulator=0;try{c.close()}catch{}status(text);updateUI();notify(text)}
function acceptSnapshot(s){
 const oldSeed=sim.map.seed,oldLevel=sim.level,oldTurn=sim.turns,oldActive=sim.active,oldCast=sim.casts,oldWon=sim.won,oldNames=sim.players.map(p=>p.name).join('|'),oldObjects=sim.objects.length,oldStars=sim.map.stars.filter(s=>s.got).length;
 sim=K.applySnapshot(sim,s);pending=false;
 const worldChanged=oldSeed!==sim.map.seed||oldLevel!==sim.level;
 if(worldChanged){view.clear();buildBackground();selected=0;angle=0;release();prediction=null;pendingCorrectionSeq=null;correctionOffset={x:0,y:0}}
 if(oldActive!==sim.active||oldTurn!==sim.turns){selected=0;eraseMode=false}
 if(!prediction)prediction=K.createPrediction(sim,myPlayer);else{K.syncPredictionWorld(prediction,sim);if(!Object.values(movementInput).some(Boolean)&&pendingCorrectionSeq===null)correctLocalMovement(s.players[myPlayer])}
 if(oldCast!==sim.casts){beep(390);const last=sim.objects[sim.objects.length-1];if(last)burst(last.body.position.x,last.body.position.y,COLORS[1-sim.active],20)}
 if(oldActive!==sim.active||oldTurn!==sim.turns||oldSeed!==sim.map.seed||oldLevel!==sim.level||oldCast!==sim.casts||oldWon!==sim.won||oldNames!==sim.players.map(p=>p.name).join('|')||oldObjects!==sim.objects.length||oldStars!==sim.map.stars.filter(s=>s.got).length)updateUI();
}
function wire(c,host){
 conn=c;connectionReady=false;hostInputSeq=-1;hostCorrectionSeq=null;movementSeq=0;pendingCorrectionSeq=null;
 const welcome=()=>{lastMessageAt=lastPingAt=performance.now();$('roomDialog').close();status('В комнате 2 / 2 · вы — '+wizardName(myPlayer));updateUI();notify('Оба колдуна здесь. Начинается совместная магия!')};
 c.on('open',()=>{if(conn!==c)return;lastMessageAt=performance.now();status('Проверяем подключение второго колдуна…');if(!host)c.send({type:'hello',version:4,name:ownName})});
 c.on('data',m=>{if(conn!==c||!m||typeof m!=='object')return;lastMessageAt=performance.now();
  if(m.type==='ping'){c.send({type:'pong'});return}if(m.type==='pong')return;
  if(host&&m.type==='hello'&&!connectionReady){if(m.version!==4||!K.cleanName(m.name,'')){c.send({type:'rejected',reason:'Обновите игру и укажите имя колдуна'});disconnect(c,'Друг использует другую версию игры');return}sim.players[1].name=K.cleanName(m.name);K.setPresent(sim,1,true,{respawn:true});sim.events=[];connectionReady=true;c.send({type:'welcome',version:4,state:K.snapshot(sim)});welcome();return}
  if(!host&&m.type==='welcome'&&!connectionReady&&m.version===4&&m.state?.players?.length===2){acceptSnapshot(m.state);connectionReady=true;welcome();return}
  if(m.type==='rejected'){pending=false;notify(typeof m.reason==='string'?m.reason:'Действие отклонено');return}
  if(!connectionReady)return;
  if(host){
   if(m.type==='rename'){sim.players[1].name=K.cleanName(m.name,'Друг');sync();updateUI()}
   if(m.type==='input'&&Number.isSafeInteger(m.seq)&&m.seq>hostInputSeq&&m.input){hostInputSeq=m.seq;sim.inputs[1]=K.canMove(sim,1)?{left:m.input.left===true,right:m.input.right===true,jump:m.input.jump===true}:{};if(m.released===true)hostCorrectionSeq=m.seq}
   if(m.type==='action'&&m.action&&['cast','pass'].includes(m.action.type)){const r=applyAction(m.action,1);if(!r.ok)c.send({type:'rejected',reason:r.reason});sync()}
  }else if(m.type==='movementCorrection'&&m.seq===pendingCorrectionSeq&&m.seq===movementSeq&&m.player&&['x','y','vx','vy'].every(k=>Number.isFinite(m.player[k]))){correctLocalMovement(m.player);pendingCorrectionSeq=null}
  else if(m.type==='state'&&m.state?.players?.length===2&&Array.isArray(m.state.objects))acceptSnapshot(m.state);
 });
 c.on('close',()=>disconnect(c,'Друг отключился. Ожидаем второго игрока.'));
 c.on('error',()=>disconnect(c,'Связь с другом потеряна. Игра остановлена.'));
 setTimeout(()=>{if(conn===c&&!connectionReady)disconnect(c,'Подключение не завершилось. Проверьте код или другую сеть.')},18000);
}
async function connectOnline(host){
 if(!saveName(false))return;const code=$('joinCode').value.trim().toUpperCase();if(!host&&!/^[A-Z0-9]{6}$/.test(code)){status('Введите код из 6 букв и цифр');return}const btn=$(host?'createRoom':'joinRoom');btn.disabled=true;status('Открываем магический канал…');try{await loadPeer();closeNetwork();mode=host?'host':'guest';myPlayer=host?0:1;start(sim.map.seed,sim.level);
 const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',id=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>chars[n%chars.length]).join('');peer=new Peer(host?'kolduny-physics-v4-'+id:undefined,{debug:0});const thisPeer=peer;
 peer.on('open',()=>{if(peer!==thisPeer)return;btn.disabled=false;if(host){roomCodeValue=id;$('roomCode').textContent=id;$('roomCode').classList.remove('hidden');status('Комната открыта · 1 / 2. Передайте код другу.');peer.on('connection',c=>{if(conn){c.on('open',()=>c.close());return}wire(c,true)})}else{status('Ищем второго мага…');wire(peer.connect('kolduny-physics-v4-'+code,{reliable:true}),false)}updateUI()});peer.on('error',e=>{if(peer!==thisPeer)return;btn.disabled=false;if(conn)disconnect(conn,'Соединение с другом потеряно');status(e.type==='peer-unavailable'?'Комната не найдена. Проверьте код.':'Связь недоступна. Проверьте интернет или попробуйте другую сеть.')});setTimeout(()=>{btn.disabled=false;if(peer===thisPeer&&!peer.open)status('Сервер связи не отвечает. Попробуйте другую сеть.')},16000);
 }catch(e){status(e.message);btn.disabled=false}
}
$('createRoom').onclick=()=>connectOnline(true);$('joinRoom').onclick=()=>connectOnline(false);$('saveName').onclick=()=>saveName();$('lobbyRoom').onclick=()=>{release();$('roomDialog').showModal()};$('leaveRoom').onclick=()=>{closeNetwork();$('roomDialog').close();notify('Вы вышли из комнаты. Для игры пригласите друга.')};
const requestedSeed=new URLSearchParams(location.search).get('seed');start(requestedSeed!==null&&/^\d{1,10}$/.test(requestedSeed)?Number(requestedSeed)>>>0:undefined);requestAnimationFrame(frame);
