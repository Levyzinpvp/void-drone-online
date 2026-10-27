// VOID//DRONE online modes server: co-op boss rush, boss-race, duel, battle royale and 2v2 deathmatch.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'scores.json');
const ROOM_MODES = new Set(['coop','bossrace','duel','battleRoyale','teamDeathmatch']);
const GAME_MODES = new Set(['campaign','endless','nightmare','timed','practice']);
const CAPS = { coop:2, bossrace:2, duel:2, battleRoyale:10, teamDeathmatch:4 };
const MIN_START = { coop:2, bossrace:2, duel:2, battleRoyale:2, teamDeathmatch:4 };
const PLANETS = [
  {id:'vulcan',name:'VULCAN-9',accent:'#ff784f',desc:'Planeta vulcânico com tempestades de cinzas.'},
  {id:'glaciera',name:'GLACIERA',accent:'#7bdfff',desc:'Mundo de gelo com auroras.'},
  {id:'toxion',name:'TOXION PRIME',accent:'#b6ff63',desc:'Atmosfera tóxica e nebulosas verdes.'},
  {id:'dunaris',name:'DUNARIS',accent:'#f5c56b',desc:'Deserto orbital de poeira dourada.'},
  {id:'eclipse',name:'ECLIPSE-0',accent:'#bda0ff',desc:'Planeta escuro com anéis de energia.'},
  {id:'oceanus',name:'OCEANUS',accent:'#4aa7ff',desc:'Gigante oceânico com cinturões azuis.'}
];
let leaderboard = [];
try { const v = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); if (Array.isArray(v)) leaderboard = v; } catch (_) {}
const rooms = new Map();
function safeName(v) { return String(v || 'PILOTO').replace(/[^A-Za-z0-9 _.-]/g, '').trim().slice(0, 18) || 'PILOTO'; }
function safeRoomMode(v) { return ROOM_MODES.has(v) ? v : 'coop'; }
function safeGameMode(v) { return GAME_MODES.has(v) ? v : 'campaign'; }
function send(ws, obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function codeGen() { const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let out=''; do { out=''; for(let i=0;i<5;i++)out+=chars[Math.floor(Math.random()*chars.length)]; } while(rooms.has(out)); return out; }
function isPvp(mode) { return mode === 'duel' || mode === 'battleRoyale' || mode === 'teamDeathmatch'; }
function publicPlayer(p) {
  const s=p.stats||{},n=p.net||{};
  return {id:p.id,name:p.name,score:s.score||0,kills:s.kills||0,bossIndex:s.bossIndex||0,hp:s.hp||0,maxHp:s.maxHp||100,runTime:s.runTime||0,finished:!!s.finished,won:!!s.won,connected:!!p.ws&&p.ws.readyState===WebSocket.OPEN,
    x:n.x??0.5,y:n.y??0.72,aimX:n.aimX??0.5,aimY:n.aimY??0.3,angle:n.angle||0,firing:!!n.firing,dashing:!!n.dashing,alive:s.alive!==false,team:p.team||0,pvpKills:s.pvpKills||0,deaths:s.deaths||0,slot:p.slot||0};
}
function snapshot(room) { return {type:'roomState',room:room.code,mode:room.mode,gameMode:room.gameMode,elapsed:room.startedAt?Math.floor((Date.now()-room.startedAt)/1000):0,players:[...room.players.values()].map(publicPlayer),started:room.started,finished:room.finished,hostId:room.hostId,capacity:CAPS[room.mode],mapTheme:room.mapTheme,teamScore:room.teamScore,sharedBoss:room.sharedBossIndex>=0?{index:room.sharedBossIndex,hp:room.sharedBossHp,maxHp:room.sharedBossMaxHp}:null}; }
function sendRoom(room,obj) { for(const p of room.players.values())send(p.ws,obj); }
function sendState(room) { const now=Date.now(); if(room.lastStateSent&&now-room.lastStateSent<45){room.pendingState=true;return;} room.pendingState=false;room.lastStateSent=now;sendRoom(room,snapshot(room)); }
function lobbyUpdate(room) { const s=snapshot(room);sendRoom(room,{...s,type:'roomUpdate',canStart:room.players.size>=MIN_START[room.mode]}); }
function saveLeaderboard() { try { fs.writeFileSync(DB_PATH,JSON.stringify(leaderboard.slice(0,100),null,2)); } catch(e) { console.error('Could not save leaderboard:',e.message); } }
function updateLeaderboard(room, winners, message) {
  const winSet=new Set(winners||[]);
  for(const p of room.players.values()) {
    const s=p.stats||{},key=p.name.toLowerCase();let row=leaderboard.find(x=>x.key===key);
    if(!row){row={key,name:p.name,wins:0,losses:0,games:0,kills:0,points:0,playerKills:0,deaths:0};leaderboard.push(row);}
    row.name=p.name;row.games++;row.kills+=s.kills||0;row.points+=s.score||0;row.playerKills=(row.playerKills||0)+(s.pvpKills||0);row.deaths=(row.deaths||0)+(s.deaths||0);
    if(winSet.has(p.id))row.wins++;else if(winners!==null)row.losses++;
  }
  leaderboard.sort((a,b)=>b.wins-a.wins||b.points-a.points||b.playerKills-a.playerKills||b.kills-a.kills);leaderboard=leaderboard.slice(0,100);saveLeaderboard();room.finished=true;sendRoom(room,{type:'matchOver',winnerIds:[...(winners||[])],message,snapshot:snapshot(room),leaderboard});
}
function finishRace(room, loserId=null) {
  if(room.finished)return;
  const ps=[...room.players.values()];
  if(loserId){const winner=ps.find(p=>p.id!==loserId);updateLeaderboard(room,winner?[winner.id]:[],`${ps.find(p=>p.id===loserId)?.name||'Piloto'} foi destruído primeiro. ${winner?.name||'O rival'} vence a corrida.`);return;}
  const ranked=ps.slice().sort((a,b)=>(b.stats.kills||0)-(a.stats.kills||0)||(b.stats.score||0)-(a.stats.score||0)||(a.stats.runTime||0)-(b.stats.runTime||0));
  const tie=ranked.length>1&&(ranked[0].stats.kills||0)===(ranked[1].stats.kills||0)&&(ranked[0].stats.score||0)===(ranked[1].stats.score||0);
  updateLeaderboard(room,tie?ps.map(p=>p.id):[ranked[0].id],tie?'Corrida empatada: mesmos chefes e pontuação.':`${ranked[0].name} vence o Boss Rush: ${(ranked[0].stats.kills||0)} chefes contra ${(ranked[1]?.stats.kills||0)}.`);
}
function finishPvp(room, winnerIds, message) { if(room.finished)return; updateLeaderboard(room,winnerIds,message); }
function createRoom(mode, gameMode) {
  const planet=PLANETS[Math.floor(Math.random()*PLANETS.length)];
  const code=codeGen();const room={code,mode,gameMode,players:new Map(),hostId:null,started:false,finished:false,startedAt:0,mapTheme:planet,teamScore:{1:0,2:0},sharedBossIndex:-1,sharedBossHp:0,sharedBossMaxHp:0,matchTimer:null};rooms.set(code,room);return room;
}
function startRoom(room) {
  if(room.started||room.finished||room.players.size<MIN_START[room.mode])return;
  if(['battleRoyale','teamDeathmatch'].includes(room.mode)&&room.players.size<CAPS[room.mode]&&!room.launchRequested)return;
  room.started=true;room.startedAt=Date.now();room.teamScore={1:0,2:0};room.sharedBossIndex=-1;room.sharedBossHp=0;room.sharedBossMaxHp=0;
  let slot=0;for(const p of room.players.values()){p.slot=slot++;p.stats={score:0,kills:0,bossIndex:0,hp:100,maxHp:100,runTime:0,finished:false,won:false,alive:true,pvpKills:0,deaths:0,teamScore:0};p.net={x:.5,y:.7,aimX:.5,aimY:.3,angle:0,firing:false,dashing:false};p.invulnUntil=Date.now()+1200;p.hitCooldownUntil=0;p.lastProgress=0;p.lastNet=0;p.lastHit=0;p.bossWindowStart=0;p.bossDamageInWindow=0;
    p.team=room.mode==='teamDeathmatch'?(p.slot%2===0?1:2):0;
    send(p.ws,{type:'start',room:room.code,mode:room.mode,gameMode:room.gameMode,youId:p.id,slot:p.slot,team:p.team,mapTheme:room.mapTheme,snapshot:snapshot(room)});
  }
  sendState(room);
}
function joinRoom(ws,msg) {
  if(ws.player){send(ws,{type:'error',message:'Esta conexão já está em uma sala.'});return;}
  let room;
  if(msg.type==='create')room=createRoom(safeRoomMode(msg.roomMode||msg.mode),safeGameMode(msg.gameMode));
  else {const code=String(msg.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);room=rooms.get(code);if(!room){send(ws,{type:'error',message:'Sala não encontrada. Confira o código ou peça ao amigo para criar outra.'});return;}if(room.started||room.finished){send(ws,{type:'error',message:'A partida já começou ou terminou. Crie uma nova sala.'});return;}if(room.players.size>=CAPS[room.mode]){send(ws,{type:'error',message:'Esta sala já está cheia.'});return;}}
  let name=safeName(msg.name);if([...room.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()))name=(name.slice(0,14)+'-'+(room.players.size+1)).slice(0,18);
  const p={id:Math.random().toString(36).slice(2,10),ws,name,mode:room.mode,team:0,slot:room.players.size,stats:{score:0,kills:0,bossIndex:0,hp:100,maxHp:100,runTime:0,finished:false,won:false,alive:true,pvpKills:0,deaths:0,teamScore:0},net:{x:.5,y:.7,aimX:.5,aimY:.3,angle:0,firing:false,dashing:false},lastProgress:0,lastNet:0,lastHit:0,hitCooldownUntil:0,invulnUntil:0,bossWindowStart:0,bossDamageInWindow:0};
  room.players.set(p.id,p);if(!room.hostId)room.hostId=p.id;ws.player=p;ws.room=room;
  send(ws,{type:'joined',id:p.id,room:room.code,name:p.name,mode:room.mode,gameMode:room.gameMode,hostId:room.hostId,players:[...room.players.values()].map(publicPlayer),capacity:CAPS[room.mode],mapTheme:room.mapTheme,leaderboard,canStart:room.players.size>=MIN_START[room.mode]});
  lobbyUpdate(room);
  if(['coop','bossrace','duel'].includes(room.mode)&&room.players.size>=2)startRoom(room);
  else if(room.players.size>=CAPS[room.mode])startRoom(room);
}
function alivePlayers(room){return [...room.players.values()].filter(p=>p.stats.alive!==false);}
function handlePvpHit(p,room,m) {
  if(!room.started||room.finished||!isPvp(room.mode))return;
  const target=room.players.get(String(m.targetId||''));if(!target||target.id===p.id||target.stats.alive===false)return;
  if(room.mode==='teamDeathmatch'&&p.team===target.team)return;
  const now=Date.now();if(now<p.lastHit+24||now<target.invulnUntil||now<target.hitCooldownUntil)return;p.lastHit=now;
  const damage=Math.max(1,Math.min(48,Number(m.damage)||18));target.stats.hp=Math.max(0,(target.stats.hp||100)-damage);target.hitCooldownUntil=now+95;
  if(target.stats.hp<=0){target.stats.alive=false;target.stats.deaths=(target.stats.deaths||0)+1;p.stats.pvpKills=(p.stats.pvpKills||0)+1;p.stats.score=(p.stats.score||0)+500;
    if(room.mode==='teamDeathmatch'){
      room.teamScore[p.team]=(room.teamScore[p.team]||0)+1;
      target.respawnAt=now+1500;
      sendRoom(room,{type:'killFeed',message:`${p.name} derrubou ${target.name}`,killerId:p.id,targetId:target.id,teamScore:room.teamScore});
      if(room.teamScore[p.team]>=15){const team=p.team;finishPvp(room,[...room.players.values()].filter(q=>q.team===team).map(q=>q.id),`TIME ${team} venceu o Deathmatch 2×2 por ${room.teamScore[team]} a ${room.teamScore[team===1?2:1]}.`);}
    } else if(room.mode==='duel') {
      const winner=alivePlayers(room)[0];if(winner)finishPvp(room,[winner.id],`${winner.name} venceu o duelo. ${target.name} foi eliminado.`);
    } else if(room.mode==='battleRoyale') {
      const alive=alivePlayers(room);if(alive.length<=1)finishPvp(room,alive.map(q=>q.id),alive.length?`${alive[0].name} é o último drone em pé!`:'Battle Royale terminou sem sobreviventes.');
    }
  }
  if(!room.finished)sendState(room);
}
function handleMessage(ws,raw){
  let m;try{m=JSON.parse(raw.toString());}catch(_){return;}if(!m||typeof m!=='object')return;
  if(m.type==='leaderboard'){send(ws,{type:'leaderboard',entries:leaderboard.slice(0,10)});return;}
  if(m.type==='create'||m.type==='join'){joinRoom(ws,m);return;}
  const p=ws.player,room=ws.room;if(!p||!room)return;
  if(m.type==='launch'){
    if(p.id!==room.hostId){send(ws,{type:'error',message:'Somente quem criou a sala pode iniciar a partida.'});return;}
    if(room.players.size<MIN_START[room.mode]){send(ws,{type:'error',message:`Esta fila precisa de pelo menos ${MIN_START[room.mode]} jogadores para iniciar.`});return;}
    room.launchRequested=true;startRoom(room);return;
  }
  if(m.type==='progress'&&room.started&&!room.finished&&!isPvp(room.mode)){
    const now=Date.now();if(now-p.lastProgress<90)return;p.lastProgress=now;const n=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
    p.stats.score=Math.floor(n(m.score,0,1e9));p.stats.kills=Math.floor(n(m.kills,0,100000));p.stats.bossIndex=Math.floor(n(m.bossIndex,0,100000));p.stats.hp=Math.floor(n(m.hp,0,1e6));p.stats.maxHp=Math.floor(n(m.maxHp,1,1e6));p.stats.runTime=Math.floor(n(m.runTime,0,1e7));p.stats.finished=!!m.finished;p.stats.won=!!m.won;p.stats.alive=p.stats.hp>0&&!p.stats.finished;
    if(room.mode==='bossrace'&&p.stats.finished&&(!p.stats.won||p.stats.hp<=0)){finishRace(room,p.id);return;}
    sendState(room);
    if([...room.players.values()].every(q=>q.stats.finished)){
      if(room.mode==='coop'){const allWon=[...room.players.values()].every(q=>q.stats.won);updateLeaderboard(room,allWon?[...room.players.keys()]:[],allWon?'Equipe completou o Boss Rush cooperativo!':'Co-op encerrado: a equipe não concluiu a missão.');}
      else if(room.mode==='bossrace')finishRace(room);
    }
    return;
  }
  if(m.type==='state'&&room.started&&!room.finished){
    const now=Date.now();if(now-p.lastNet<45)return;p.lastNet=now;
    const n=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
    p.net={x:n(m.x,.02,.98),y:n(m.y,.08,.94),aimX:n(m.aimX,.0,1),aimY:n(m.aimY,.0,1),angle:n(m.angle,-Math.PI*2,Math.PI*2),firing:!!m.firing,dashing:!!m.dashing};
    if(Number(m.hp)>=0&&Number.isFinite(Number(m.hp))&&!isPvp(room.mode))p.stats.hp=Math.floor(n(m.hp,0,1e6));
    if(m.invulnerable)p.invulnUntil=Math.max(p.invulnUntil,now+100);
    sendState(room);return;
  }
  if(m.type==='shot'&&room.started&&!room.finished&&isPvp(room.mode)){
    const vals=['x','y','vx','vy','damage'];for(const k of vals)if(!Number.isFinite(Number(m[k])))return;
    const shot={type:'shot',playerId:p.id,team:p.team,x:Math.max(0,Math.min(1,Number(m.x))),y:Math.max(0,Math.min(1,Number(m.y))),vx:Math.max(-2,Math.min(2,Number(m.vx))),vy:Math.max(-2,Math.min(2,Number(m.vy))),color:room.mode==='teamDeathmatch'?(p.team===1?'#66eaff':'#ff709f'):'#73fbff',life:Math.max(.1,Math.min(2,Number(m.life)||1.5)),rocket:!!m.rocket};
    for(const q of room.players.values())if(q.id!==p.id)send(q.ws,shot);return;
  }
  if(m.type==='pvpHit'){handlePvpHit(p,room,m);return;}
  if(m.type==='bossInit'&&room.mode==='coop'&&room.started&&!room.finished){
    const index=Math.max(0,Math.min(100000,Math.floor(Number(m.index)||0))),maxHp=Math.max(1,Math.min(1e9,Number(m.maxHp)||1));
    if(room.sharedBossIndex<0||index>room.sharedBossIndex){room.sharedBossIndex=index;room.sharedBossMaxHp=maxHp;room.sharedBossHp=maxHp;sendRoom(room,{type:'coopBoss',index,hp:room.sharedBossHp,maxHp:room.sharedBossMaxHp,reset:true});}
    else if(index===room.sharedBossIndex)send(ws,{type:'coopBoss',index,hp:room.sharedBossHp,maxHp:room.sharedBossMaxHp});return;
  }
  if(m.type==='bossHit'&&room.mode==='coop'&&room.started&&!room.finished){
    const index=Math.floor(Number(m.index));if(index!==room.sharedBossIndex||room.sharedBossHp<=0)return;
    const now=Date.now();if(now-p.bossWindowStart>1000){p.bossWindowStart=now;p.bossDamageInWindow=0;}const rawDamage=Math.max(1,Math.min(500,Number(m.damage)||1));const damage=Math.min(rawDamage,Math.max(0,1600-p.bossDamageInWindow));if(damage<=0)return;p.bossDamageInWindow+=damage;room.sharedBossHp=Math.max(0,room.sharedBossHp-damage);
    sendRoom(room,{type:'coopBoss',index:room.sharedBossIndex,hp:room.sharedBossHp,maxHp:room.sharedBossMaxHp,sourceId:p.id});return;
  }
}
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/healthz'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return;}
  if(url.pathname==='/api/leaderboard'){res.writeHead(200,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','cache-control':'no-store'});res.end(JSON.stringify({entries:leaderboard.slice(0,10)}));return;}
  const requestPath=url.pathname==='/'?'/index.html':url.pathname;let file=path.resolve(ROOT,'.'+decodeURIComponent(requestPath));if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');return;}const ext=path.extname(file).toLowerCase();const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':'no-store'});res.end(data);});
});
const wss=new WebSocket.Server({server,path:'/ws',maxPayload:16*1024});
wss.on('connection',ws=>{ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);ws.on('message',raw=>handleMessage(ws,raw));ws.on('error',e=>console.warn('WebSocket:',e.message));ws.on('close',()=>{const p=ws.player,room=ws.room;if(!p||!room)return;room.players.delete(p.id);if(room.players.size===0){rooms.delete(room.code);return;}if(room.hostId===p.id&&!room.started){room.hostId=room.players.keys().next().value;const nextHost=room.players.get(room.hostId);if(nextHost)send(nextHost.ws,{type:'hostChanged',hostId:room.hostId});}if(room.started&&!room.finished&&isPvp(room.mode)){
      if(room.mode==='duel'){const winner=alivePlayers(room)[0];if(winner)finishPvp(room,[winner.id],`${winner.name} vence: o rival desconectou.`);}
      else if(room.mode==='battleRoyale'){const alive=alivePlayers(room);if(alive.length===1)finishPvp(room,[alive[0].id],`${alive[0].name} vence por sobrevivência após desconexão.`);}
    }
    if(!room.started)lobbyUpdate(room);else if(!room.finished)sendRoom(room,{type:'opponentLeft',message:`${p.name} desconectou.`,snapshot:snapshot(room)});
  });});
const tick=setInterval(()=>{const now=Date.now();for(const room of rooms.values()){
  if(room.finished)continue;
  let changed=false;
  if(room.mode==='teamDeathmatch'&&room.started){for(const p of room.players.values()){if(p.stats.alive===false&&p.respawnAt&&now>=p.respawnAt){p.stats.alive=true;p.stats.hp=100;p.respawnAt=0;p.invulnUntil=now+1200;p.net.x=p.team===1?.18+Math.random()*.18:.64+Math.random()*.18;p.net.y=.25+Math.random()*.5;sendRoom(room,{type:'respawn',playerId:p.id});changed=true;}}}
  if(room.pendingState||changed)sendState(room);
}},100);
const pinger=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},25000);
server.listen(PORT,'0.0.0.0',()=>console.log(`VOID//DRONE online modes server listening on ${PORT}`));
process.on('SIGTERM',()=>{clearInterval(tick);clearInterval(pinger);for(const ws of wss.clients)ws.close();server.close(()=>process.exit(0));});
