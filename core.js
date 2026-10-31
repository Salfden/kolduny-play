(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/matter.min.js'));else root.KoldunyCore=factory(root.Matter)})(typeof globalThis!=='undefined'?globalThis:this,function(M){
'use strict';
const {Engine,Bodies,Body,Composite,Constraint,Query,Vector}=M;
const W=1440,H=850,SPEED=3.15,JUMP=7.0,GRAVITY=.9,RANGE=440,MAX_OBJECTS=22;
const SPELLS={
 plank:{name:'Дубовая доска',sub:'Лёгкая · 340 см',icon:'plank',tip:'Длинная доска. Падает и вращается. Уложите оба края на опоры или закрепите гвоздём.',w:340,h:18,density:.0018},
 beam:{name:'Железная балка',sub:'Тяжёлая · 300 см',icon:'beam',tip:'Тяжёлая балка. Устойчива под ногами, но шар поднимет её с трудом.',w:300,h:22,density:.0038},
 crate:{name:'Деревянный ящик',sub:'Опора и противовес',icon:'crate',tip:'Ящик можно толкать, ставить под доску и поднимать воздушным шаром.',w:66,h:66,density:.0016},
 stone:{name:'Каменный куб',sub:'Тяжёлый противовес',icon:'stone',tip:'Тяжёлый куб для устойчивого основания или противовеса.',w:62,h:62,density:.004},
 ball:{name:'Лунный шар',sub:'Катится и толкает',icon:'ball',tip:'Тяжёлый шар скатывается по наклонным доскам и сдвигает предметы.',r:31,density:.0045},
 balloon:{name:'Воздушный шар',sub:'Поднимает груз',icon:'balloon',tip:'Нажмите на предмет — шар привяжется к нему. В воздухе создастся свободный шар. Подъёмная сила ограничена.',r:25,density:.0005},
 pin:{name:'Рунный гвоздь',sub:'Шарнир у опоры',icon:'pin',tip:'Нажмите на доску рядом с каменным островом или уже закреплённой конструкцией. Один гвоздь создаёт качели; два — устойчивое крепление.'},
 gust:{name:'Порыв ветра',sub:'Толкает предмет',icon:'gust',tip:'Толкните предмет от мага. Q/E меняет направление импульса.'}
};
const FAMILIES=[{name:'Разлом обсерватории',tag:'ПЕРЕПРАВА',hint:'Пролёт шире прыжка. Положите доску на края островов и закрепите её.'},{name:'Шахта созвездий',tag:'ВЕРТИКАЛЬНЫЙ ПУТЬ',hint:'Выход наверху. Наклонные доски, ящики и воздушный шар помогут набрать высоту.'},{name:'По разные стороны',tag:'ВСТРЕЧА В ЦЕНТРЕ',hint:'Вы начинаете порознь. Постройте два пути к высокому центральному острову.'},{name:'Сломанный механизм',tag:'РАВНОВЕСИЕ',hint:'Длинная доска на шарнире — качели. Груз на одном конце поднимает другой.'}];
function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function layout(seed){
 const r=random(seed),kind=seed%4,flip=r()>.5,platforms=[],jitter=(v,n)=>Math.round(v+(r()-.5)*n),add=(x,y,w,h=42)=>{const p={x,y,w,h,id:platforms.length};platforms.push(p);return p};let spawns,exitIndex,props=[];
 if(kind===0){const a=add(jitter(50,28),jitter(660,60),jitter(250,35)),b=add(jitter(580,30),jitter(605,40),jitter(210,30)),c=add(jitter(1080,25),jitter(550,60),jitter(300,25));spawns=[{platform:a.id,fraction:.25},{platform:r()>.5?a.id:b.id,fraction:.65}];exitIndex=c.id;add(jitter(680,50),jitter(255,65),150);}
 else if(kind===1){const a=add(jitter(115,60),jitter(735,20),300),b=add(jitter(570,45),jitter(520,30),265),c=add(jitter(970,50),jitter(285,40),300);spawns=[{platform:a.id,fraction:.28},{platform:r()>.5?b.id:a.id,fraction:.7}];exitIndex=c.id;add(jitter(100,30),jitter(310,30),170);}
 else if(kind===2){const a=add(55,jitter(630,65),260),b=add(1125,jitter(620,65),260),c=add(jitter(585,50),jitter(260,60),270);add(jitter(425,20),jitter(470,35),105);add(jitter(925,20),jitter(465,35),105);spawns=[{platform:a.id,fraction:.42},{platform:b.id,fraction:.58}];exitIndex=c.id;}
 else{const a=add(jitter(40,20),jitter(690,30),270),b=add(jitter(610,20),jitter(625,30),100),c=add(jitter(1075,20),jitter(390,45),310);add(860,jitter(620,20),80);spawns=[{platform:a.id,fraction:.3},{platform:a.id,fraction:.72}];exitIndex=c.id;props=[{type:'plank',x:b.x+b.w/2,y:b.y-24,angle:0,pivot:true,w:400},{type:'crate',x:a.x+a.w-50,y:a.y-50}];}
 if(flip){platforms.forEach(p=>p.x=W-p.x-p.w);props.forEach(p=>{p.x=W-p.x;p.angle=-p.angle});spawns.forEach(s=>s.fraction=1-s.fraction)}
 const exitPlatform=platforms[exitIndex],exit={x:exitPlatform.x+exitPlatform.w*(.36+r()*.28),y:exitPlatform.y};
 const starts=spawns.map(s=>{const p=platforms[s.platform];return{x:p.x+p.w*s.fraction,y:p.y-35,platform:s.platform}});
 const build=shuffle(['plank','beam'],r),heavy=shuffle(['crate','stone','ball'],r),utility=shuffle(['pin','balloon'],r);
 const spells=[[build[0],heavy[0],utility[0]],[build[1],r()>.55?'gust':heavy[1],utility[1]]];
 // Always keep one light load available for balloons on a vertical route.
 if(kind===1||kind===2)spells[0][1]='crate';
 return{seed,kind,flip,platforms,starts,exit,spells,props,stars:platforms.filter(p=>p.id!==exitIndex).slice(0,3).map(p=>({x:p.x+p.w*.7,y:p.y-70,got:false}))};
}
// A conservative ballistic graph: if even an ideal jump can reach the portal,
// this seed is rejected. Downward jumps are included, not just horizontal gaps.
function reachableWithoutMagic(map,start){
 const ps=map.platforms,seen=new Set([start.platform]),todo=[start.platform],g=GRAVITY*1000/3600;
 while(todo.length){const a=ps[todo.pop()];for(const b of ps){if(seen.has(b.id))continue;const dy=b.y-a.y,disc=JUMP*JUMP+2*g*dy;if(disc<0)continue;const frames=(JUMP+Math.sqrt(disc))/g,gap=Math.max(0,b.x-a.x-a.w,a.x-b.x-b.w);if(gap<=SPEED*frames+30){seen.add(b.id);todo.push(b.id)}}}
 const ep=ps.find(p=>map.exit.x>=p.x&&map.exit.x<=p.x+p.w&&map.exit.y===p.y);return seen.has(ep.id);
}
function generate(seed){seed=seed>>>0;for(let i=0;i<200;i++){const m=layout(seed);if(m.starts.every(s=>!reachableWithoutMagic(m,s)))return m;seed=(seed+4)>>>0}throw Error('Не удалось построить уровень')}
function cleanName(value,fallback='Колдун'){if(typeof value!=='string')return fallback;const n=[...value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g,'').replace(/\s+/g,' ').trim()].slice(0,20).join('');return n||fallback}
function ready(sim){return sim.players.length===2&&sim.players.every(p=>p.present)}
function canControl(sim,actor,turn=sim.turns){return ready(sim)&&!sim.won&&actor===sim.active&&!sim.players[actor]?.home&&turn===sim.turns}
function setPresent(sim,index,present,{respawn=false}={}){const p=sim.players[index];if(!p||(p.present===!!present&&!respawn))return;sim.inputs=[{},{}];p.jumpHeld=false;if(respawn){Body.setStatic(p.body,false);p.body.isSensor=false;p.home=false;Body.setPosition(p.body,sim.map.starts[index]);Body.setVelocity(p.body,{x:0,y:0});sim.won=false}if(p.present!==!!present){p.present=!!present;if(p.present)Composite.add(sim.engine.world,p.body);else Composite.remove(sim.engine.world,p.body)}emit(sim,'presence',{player:index,present:p.present})}
function create(seed,level=1,options={}){
 const map=generate(seed),engine=Engine.create({gravity:{x:0,y:GRAVITY},positionIterations:8,velocityIterations:8,constraintIterations:5});
 const sim={engine,map,level,active:0,casts:0,turns:0,players:[],objects:[],joints:[],won:false,events:[],nextId:1,inputs:[{},{}],tick:0};
 sim.terrain=map.platforms.map(p=>{const b=Bodies.rectangle(p.x+p.w/2,p.y+p.h/2,p.w,p.h,{isStatic:true,friction:.8,label:'island'});b.game={type:'island',platform:p.id};return b});
 Composite.add(engine.world,sim.terrain);
 sim.players=map.starts.map((p,i)=>{const b=Bodies.rectangle(p.x,p.y,28,48,{chamfer:{radius:8},density:.0028,friction:.12,frictionStatic:.6,frictionAir:.012,restitution:0,inertia:Infinity,collisionFilter:{category:2,mask:1},label:'wizard'});const player={body:b,present:!!(options.present||[true,false])[i],name:cleanName(options.names?.[i],i?'Друг':'Колдун'),home:false,face:i? -1:1,ground:false,coyote:0,jumpHeld:false};b.game={type:'wizard',player:i};if(player.present)Composite.add(engine.world,b);return player});
 map.props.forEach(p=>{const o=addObject(sim,p.type,p.x,p.y,p.angle||0,-1,{w:p.w});if(p.pivot)addPin(sim,o,{x:p.x,y:p.y})});
 return sim;
}
function emit(sim,type,info={}){sim.events.push({type,...info});if(sim.events.length>50)sim.events.shift()}
function addObject(sim,type,x,y,angle=0,owner=sim.active,extra={}){
 const def=SPELLS[type],w=extra.w||def.w,h=def.h,opts={density:def.density,friction:type==='ball'?.5:.7,frictionStatic:.9,frictionAir:.005,restitution:type==='ball'?.18:.03,label:type};
 const body=def.r?Bodies.circle(x,y,def.r,opts):Bodies.rectangle(x,y,w,h,{...opts,chamfer:{radius:type==='plank'||type==='beam'?3:5}});
 Body.setAngle(body,angle);const o={id:sim.nextId++,type,w,h,r:def.r,body,owner,pinned:false};body.game={type:'object',id:o.id};sim.objects.push(o);Composite.add(sim.engine.world,body);return o;
}
function addPin(sim,o,point){const local=Vector.sub(point,o.body.position),joint=Constraint.create({bodyA:o.body,pointA:local,pointB:{...point},length:0,stiffness:.9,damping:.12});const record={id:sim.nextId++,type:'pin',a:o.id,pointA:local,pointB:{...point},joint};sim.joints.push(record);o.pinned=true;Composite.add(sim.engine.world,joint);return record}
function findObject(sim,point,padding=0){const hits=Query.point(sim.objects.map(o=>o.body),point);if(hits.length)return sim.objects.find(o=>o.body===hits[hits.length-1]);if(padding){let best=null,d=padding;for(const o of sim.objects){const b=o.body.bounds,dx=Math.max(b.min.x-point.x,0,point.x-b.max.x),dy=Math.max(b.min.y-point.y,0,point.y-b.max.y),nd=Math.hypot(dx,dy);if(nd<d){d=nd;best=o}}return best}return null}
function nearSupport(sim,point,target){return sim.terrain.some(b=>{const q=b.bounds;return Math.hypot(Math.max(q.min.x-point.x,0,point.x-q.max.x),Math.max(q.min.y-point.y,0,point.y-q.max.y))<58})||sim.objects.some(o=>o!==target&&o.pinned&&Math.hypot(o.body.position.x-point.x,o.body.position.y-point.y)<150)}
function preview(sim,spell,x,y,angle=0){
 if(!ready(sim))return{ok:false,reason:'Для игры нужен второй человек. Пригласите друга в комнату.'};
 if(sim.won)return{ok:false,reason:'Оба колдуна уже дома'};
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(angle))return{ok:false,reason:'Неверная точка'};
 const player=sim.players[sim.active],p=player.body.position;if(player.home)return{ok:false,reason:'Колдун уже в портале и больше не колдует'};if(x<18||x>W-18||y<95||y>H-40)return{ok:false,reason:'Выберите место внутри мира'};
 if(Math.hypot(x-p.x,y-p.y)>RANGE)return{ok:false,reason:'Слишком далеко: подойдите ближе к месту колдовства'};
 const target=findObject(sim,{x,y},spell==='balloon'?65:10);
 if(spell==='erase')return target?{ok:true,target}:{ok:false,reason:'Рассеять можно только созданный предмет'};
 if(spell==='pin'){if(!target||!['plank','beam','crate','stone'].includes(target.type))return{ok:false,reason:'Гвоздь нужно поставить на доску, балку или ящик'};if(!nearSupport(sim,{x,y},target))return{ok:false,reason:'Гвоздю нужна опора: каменный остров или закреплённый предмет рядом'};if(sim.joints.filter(j=>j.type==='pin'&&j.a===target.id).length>=2)return{ok:false,reason:'На этом предмете уже два гвоздя'};return{ok:true,target}}
 if(spell==='gust')return target?{ok:true,target}:{ok:false,reason:'Направьте ветер на предмет'};
 if(!SPELLS[spell])return{ok:false,reason:'Неизвестное заклинание'};
 if(sim.objects.length>=MAX_OBJECTS)return{ok:false,reason:'В мире 22 предмета. Рассеяйте лишний правой кнопкой мыши'};
 if(spell==='balloon'&&target){const bx=target.body.position.x,by=target.body.bounds.min.y-100;if(sim.terrain.some(b=>Query.point([b],{x:bx,y:by}).length))return{ok:false,reason:'Над предметом недостаточно места для шара'};return{ok:true,target,x:bx,y:by}}
 const def=SPELLS[spell],probe=def.r?Bodies.circle(x,y,def.r):Bodies.rectangle(x,y,def.w,def.h);Body.setAngle(probe,angle);
 const blockers=[...sim.terrain,...sim.players.filter(q=>q.present&&!q.home).map(q=>q.body),...sim.objects.map(o=>o.body)];
 if(Query.collides(probe,blockers).some(c=>c.depth>2))return{ok:false,reason:'Предмет пересекает опору, мага или другую вещь'};
 return{ok:true,x,y};
}
function endTurn(sim,actor=sim.active,turn=sim.turns){if(!canControl(sim,actor,turn))return false;sim.inputs=[{},{}];sim.turns++;const other=1-sim.active;if(!sim.players[other].home)sim.active=other;sim.players.forEach(p=>p.jumpHeld=false);emit(sim,'turn',{active:sim.active});return true}
function removeObject(sim,o){for(const j of sim.joints.filter(j=>j.a===o.id||j.b===o.id)){Composite.remove(sim.engine.world,j.joint);sim.joints=sim.joints.filter(q=>q!==j)}Composite.remove(sim.engine.world,o.body);sim.objects=sim.objects.filter(q=>q!==o)}
function cast(sim,{spell,x,y,angle=0},actor=sim.active,turn=sim.turns){
 if(!canControl(sim,actor,turn))return{ok:false,reason:ready(sim)?'Сейчас ход напарника':'Ожидаем второго игрока'};
 if(spell!=='erase'&&!sim.map.spells[sim.active].includes(spell))return{ok:false,reason:'У этого колдуна нет такого заклинания'};
 const valid=preview(sim,spell,x,y,angle);if(!valid.ok)return valid;
 if(spell==='erase')removeObject(sim,valid.target);
 else if(spell==='pin')addPin(sim,valid.target,{x,y});
 else if(spell==='gust'){const o=valid.target;Body.applyForce(o.body,o.body.position,{x:Math.cos(angle)*o.body.mass*.035,y:Math.sin(angle)*o.body.mass*.035})}
 else if(spell==='balloon'&&valid.target){const t=valid.target,o=addObject(sim,'balloon',valid.x,valid.y,0);const joint=Constraint.create({bodyA:o.body,pointA:{x:0,y:22},bodyB:t.body,pointB:{x:0,y:0},length:85,stiffness:.055,damping:.09});sim.joints.push({id:sim.nextId++,type:'rope',a:o.id,b:t.id,pointA:{x:0,y:22},pointB:{x:0,y:0},joint});Composite.add(sim.engine.world,joint)}
 else addObject(sim,spell,x,y,angle);
 sim.casts++;emit(sim,'cast',{x,y,spell,owner:sim.active});endTurn(sim);return{ok:true};
}
function grounded(sim,p){const b=p.body,foot={x:b.position.x,y:b.bounds.max.y};return[-8,0,8].some(dx=>Query.ray([...sim.terrain,...sim.objects.map(o=>o.body)],{x:foot.x+dx,y:foot.y-3},{x:foot.x+dx,y:foot.y+6},2).length>0)}
function step(sim,dt=1000/60){
 if(sim.won||!ready(sim))return;sim.tick++;
 sim.players.forEach((p,i)=>{if(p.home)return;const b=p.body,input=sim.active===i?sim.inputs[i]:{},dir=(input.right?1:0)-(input.left?1:0);p.ground=grounded(sim,p);p.coyote=p.ground?6:Math.max(0,p.coyote-1);if(dir)p.face=dir;
  if(sim.active===i){const desired=dir*SPEED;Body.setVelocity(b,{x:b.velocity.x+(desired-b.velocity.x)*(p.ground?.5:.15),y:b.velocity.y});if(input.jump&&!p.jumpHeld&&p.coyote){Body.setVelocity(b,{x:b.velocity.x,y:-JUMP});p.coyote=0;emit(sim,'jump',{player:i})}p.jumpHeld=!!input.jump}
  else if(p.ground)Body.setVelocity(b,{x:b.velocity.x*.82,y:b.velocity.y});
 });
 sim.objects.forEach(o=>{if(o.type==='balloon'){const b=o.body,lift=b.position.y<140?-Math.min(.012,(140-b.position.y)*.0002):.018;Body.applyForce(b,b.position,{x:Math.sin(sim.tick*.015+o.id)*.0001,y:-lift});if(b.velocity.y< -1.5)Body.setVelocity(b,{x:b.velocity.x,y:-1.5})}});
 Engine.update(sim.engine,dt);
 for(const o of [...sim.objects])if(o.body.position.y>H+400||o.body.position.x< -700||o.body.position.x>W+700)removeObject(sim,o);
 sim.players.forEach((p,i)=>{if(p.home)return;const pos=p.body.position;if(pos.y>H+80||pos.x< -45||pos.x>W+45){Body.setPosition(p.body,sim.map.starts[i]);Body.setVelocity(p.body,{x:0,y:0});emit(sim,'fall',{player:i})}
  for(const s of sim.map.stars)if(!s.got&&Math.hypot(pos.x-s.x,pos.y-s.y)<42){s.got=true;emit(sim,'star',{x:s.x,y:s.y})}
  if(Math.abs(pos.x-sim.map.exit.x)<36&&Math.abs(pos.y-(sim.map.exit.y-35))<50){p.home=true;Body.setStatic(p.body,true);p.body.isSensor=true;sim.inputs=[{},{}];emit(sim,'home',{player:i,x:pos.x,y:pos.y});if(sim.players.every(q=>q.home)){sim.won=true;emit(sim,'win')}else{sim.active=1-i;emit(sim,'turn',{active:sim.active})}}
 });
}
function snapshot(sim){const body=b=>({x:b.position.x,y:b.position.y,a:b.angle,vx:b.velocity.x,vy:b.velocity.y,av:b.angularVelocity});return{seed:sim.map.seed,level:sim.level,active:sim.active,casts:sim.casts,turns:sim.turns,won:sim.won,stars:sim.map.stars.map(s=>s.got),players:sim.players.map(p=>({...body(p.body),name:p.name,present:p.present,home:p.home,face:p.face,ground:p.ground})),objects:sim.objects.map(o=>({id:o.id,type:o.type,w:o.w,h:o.h,r:o.r,owner:o.owner,pinned:o.pinned,...body(o.body)})),joints:sim.joints.map(j=>({id:j.id,type:j.type,a:j.a,b:j.b,pointA:j.joint.pointA,pointB:j.joint.pointB})),tick:sim.tick}}
function applySnapshot(sim,s){if(s.seed!==sim.map.seed||s.level!==sim.level)sim=create(s.seed,s.level);const set=(b,d)=>{Body.setPosition(b,{x:d.x,y:d.y});Body.setAngle(b,d.a||0);Body.setVelocity(b,{x:d.vx,y:d.vy});Body.setAngularVelocity(b,d.av||0)};
 sim.active=s.active;sim.casts=s.casts;sim.turns=s.turns;sim.won=s.won;sim.tick=s.tick;sim.map.stars.forEach((a,i)=>a.got=s.stars[i]);
 s.players.forEach((d,i)=>{const p=sim.players[i];setPresent(sim,i,d.present);set(p.body,d);p.name=cleanName(d.name,i?'Друг':'Колдун');p.home=d.home;p.face=d.face;p.ground=d.ground});sim.events=[];
 const incoming=new Set(s.objects.map(o=>o.id));for(const o of [...sim.objects])if(!incoming.has(o.id))removeObject(sim,o);
 for(const d of s.objects){let o=sim.objects.find(o=>o.id===d.id);if(!o){o=addObject(sim,d.type,d.x,d.y,d.a,d.owner,{w:d.w});o.id=d.id;o.body.game.id=d.id}o.pinned=d.pinned;set(o.body,d)}
 // Guest does not simulate physics; joints are visual records from the host.
 sim.joints=s.joints.map(j=>({...j,joint:j}));return sim;
}
return{M,W,H,SPEED,JUMP,GRAVITY,RANGE,MAX_OBJECTS,SPELLS,FAMILIES,random,generate,reachableWithoutMagic,cleanName,ready,canControl,setPresent,create,preview,cast,endTurn,step,snapshot,applySnapshot,findObject,addObject,addPin,grounded};
});
