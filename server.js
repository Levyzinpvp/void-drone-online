// VOID//DRONE online-versus server (Node.js + ws). Serve this project as a Web Service.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'scores.json');
let leaderboard = [];
try { const v = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); if (Array.isArray(v)) leaderboard = v; } catch (_) {}
const rooms = new Map();
const COLORS = ['#59f3ff', '#ff6c9d'];
function safeName(v) { return String(v || 'PILOTO').replace(/[^A-Za-z0-9 _.-]/g, '').trim().slice(0, 18) || 'PILOTO'; }
function send(ws, obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function codeGen() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let out=''; do { out=''; for(let i=0;i<5;i++) out+=chars[Math.floor(Math.random()*chars.length)]; } while(rooms.has(out)); return out; }
function publicPlayer(p) { return {id:p.id,name:p.name,x:p.x,y:p.y,hp:p.hp,maxHp:100,score:p.score,kills:p.kills,deaths:p.deaths,color:p.color,invuln:p.invuln,aimAngle:Math.atan2(p.aimY-p.y,p.aimX-p.x)}; }
function snapshot(room) { return {type:'state',room:room.code,timeLeft:Math.max(0,180-room.elapsed),players:[...room.players.values()].map(publicPlayer),bullets:room.bullets.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r,color:b.color,owner:b.owner})),started:room.started}; }
function sendRoom(room, obj) { for (const p of room.players.values()) send(p.ws, obj); }
function sendState(room) { const base=snapshot(room); for(const p of room.players.values()) send(p.ws,{...base,youId:p.id}); }
function saveLeaderboard() { try { fs.writeFileSync(DB_PATH, JSON.stringify(leaderboard.slice(0,100), null, 2)); } catch(e) { console.error('Could not save leaderboard:', e.message); } }
function recordMatch(room, winnerId) {
 for(const p of room.players.values()) {
  const key=p.name.toLowerCase(); let row=leaderboard.find(x=>x.key===key);
  if(!row){row={key,name:p.name,wins:0,losses:0,games:0,kills:0,points:0};leaderboard.push(row);}
  row.name=p.name;row.games++;row.kills+=p.kills;row.points+=p.score;
  if(winnerId===p.id)row.wins++;else row.losses++;
 }
 leaderboard.sort((a,b)=>b.wins-a.wins||b.points-a.points||b.kills-a.kills); leaderboard=leaderboard.slice(0,100); saveLeaderboard();
}
function finishRoom(room, winnerId, why) {
 if(room.finished)return; room.finished=true;room.started=false;room.winnerId=winnerId;recordMatch(room,winnerId);
 const winner=[...room.players.values()].find(p=>p.id===winnerId);
 const msg=winner?`${winner.name} venceu! ${why}`:`Partida encerrada: ${why}`;
 const data=snapshot(room);sendRoom(room,{type:'matchOver',winnerId,message:msg,snapshot:data,leaderboard});
}
function tryStart(room) {
 if(room.players.size===2 && !room.started && !room.finished) {
  room.started=true;room.elapsed=0;room.lastTick=Date.now();
  sendRoom(room,{type:'start',room:room.code,snapshot:snapshot(room)});sendState(room);
 } else sendRoom(room,{type:'waiting',room:room.code,players:[...room.players.values()].map(p=>({id:p.id,name:p.name}))});
}
function joinRoom(ws, msg) {
 if(ws.player) { send(ws,{type:'error',message:'Esta conexão já está em uma sala.'}); return; }
 const action=msg.type;
 let room;
 if(action==='create') { const code=codeGen();room={code,players:new Map(),bullets:[],started:false,finished:false,elapsed:0,lastBroadcast:0,lastTick:Date.now()};rooms.set(code,room); }
 else { const code=String(msg.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);room=rooms.get(code);if(!room){send(ws,{type:'error',message:'Sala não encontrada. Confira o código ou peça ao amigo para criar outra.'});return;}if(room.finished){send(ws,{type:'error',message:'Esta sala já terminou. Crie uma nova sala.'});return;}if(room.players.size>=2){send(ws,{type:'error',message:'Esta sala já está cheia.'});return;} }
 const id=Math.random().toString(36).slice(2,10);let name=safeName(msg.name);
 if([...room.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()))name=(name.slice(0,14)+'-'+(room.players.size+1)).slice(0,18);
 const side=room.players.size;
 const p={id,ws,name,color:COLORS[side],x:side===0?145:855,y:340,hp:100,score:0,kills:0,deaths:0,side,input:{up:false,down:false,left:false,right:false,shoot:false,aimX:500,aimY:340},aimX:side===0?800:200,aimY:340,fireCd:0,dashCd:0,dashLeft:0,invuln:2,empCd:0};
 room.players.set(id,p);ws.player=p;ws.room=room;
 send(ws,{type:'joined',id,room:room.code,players:[...room.players.values()].map(q=>({id:q.id,name:q.name})),leaderboard});
 tryStart(room);
}
function processMessage(ws, raw) {
 let msg;try{msg=JSON.parse(raw.toString());}catch(_){return;}
 if(!msg||typeof msg!=='object')return;
 if(msg.type==='leaderboard'){send(ws,{type:'leaderboard',entries:leaderboard.slice(0,10)});return;}
 if(msg.type==='create'||msg.type==='join'){joinRoom(ws,msg);return;}
 const p=ws.player,room=ws.room;if(!p||!room||room.finished)return;
 if(msg.type==='input') {
  const i=msg.input||{};p.input={up:!!i.up,down:!!i.down,left:!!i.left,right:!!i.right,shoot:!!i.shoot,aimX:Math.max(0,Math.min(1000,Number(i.aimX)||500)),aimY:Math.max(0,Math.min(680,Number(i.aimY)||340))};p.aimX=p.input.aimX;p.aimY=p.input.aimY;
 } else if(msg.type==='action') {
  if(msg.action==='dash'&&room.started&&p.dashCd<=0){let dx=(p.input.right?1:0)-(p.input.left?1:0),dy=(p.input.down?1:0)-(p.input.up?1:0);if(!dx&&!dy){dx=p.aimX-p.x;dy=p.aimY-p.y;}const len=Math.hypot(dx,dy)||1;p.x=Math.max(24,Math.min(976,p.x+dx/len*105));p.y=Math.max(24,Math.min(656,p.y+dy/len*105));p.dashCd=.95;p.invuln=Math.max(p.invuln,.28);}
  if(msg.action==='emp'&&room.started&&p.empCd<=0){p.empCd=8;for(let j=room.bullets.length-1;j>=0;j--){const b=room.bullets[j];if(b.owner!==p.id&&Math.hypot(b.x-p.x,b.y-p.y)<175)room.bullets.splice(j,1);}const other=[...room.players.values()].find(q=>q.id!==p.id);if(other&&Math.hypot(other.x-p.x,other.y-p.y)<235&&other.invuln<=0){other.hp-=12;p.score+=120;if(other.hp<=0)respawnPlayer(room,other,p);} }
 }
}
function respawnPlayer(room, target, attacker) {
 target.deaths++;attacker.kills++;attacker.score+=700;
 if(target.deaths>=5){finishRoom(room,attacker.id,`${attacker.kills} eliminações contra ${target.kills}.`);return;}
 target.hp=100;target.x=target.side===0?145:855;target.y=340;target.invuln=2;target.dashCd=0;target.empCd=0;
 room.bullets=room.bullets.filter(b=>b.owner!==attacker.id || Math.hypot(b.x-target.x,b.y-target.y)>45);
}
function tickRoom(room, now) {
 if(!room.started||room.finished||room.players.size!==2)return;
 let dt=Math.min(.05,Math.max(.001,(now-room.lastTick)/1000));room.lastTick=now;room.elapsed+=dt;
 const players=[...room.players.values()];
 for(const p of players){p.invuln=Math.max(0,p.invuln-dt);p.fireCd=Math.max(0,p.fireCd-dt);p.dashCd=Math.max(0,p.dashCd-dt);p.empCd=Math.max(0,p.empCd-dt);
  let dx=(p.input.right?1:0)-(p.input.left?1:0),dy=(p.input.down?1:0)-(p.input.up?1:0),len=Math.hypot(dx,dy)||1;if(dx||dy){p.x+=dx/len*305*dt;p.y+=dy/len*305*dt;}p.x=Math.max(24,Math.min(976,p.x));p.y=Math.max(24,Math.min(656,p.y));
  if(p.input.shoot&&p.fireCd<=0){const a=Math.atan2(p.input.aimY-p.y,p.input.aimX-p.x);room.bullets.push({owner:p.id,x:p.x+Math.cos(a)*21,y:p.y+Math.sin(a)*21,vx:Math.cos(a)*640,vy:Math.sin(a)*640,r:5,damage:17,life:2.4,color:p.color});p.fireCd=.19;}
 }
 for(let i=room.bullets.length-1;i>=0;i--){const b=room.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.x<0||b.x>1000||b.y<0||b.y>680){room.bullets.splice(i,1);continue;}const target=players.find(p=>p.id!==b.owner);if(target&&target.invuln<=0&&Math.hypot(target.x-b.x,target.y-b.y)<20+b.r){const attacker=players.find(p=>p.id===b.owner);if(attacker){target.hp-=b.damage;attacker.score+=Math.round(b.damage*10);if(target.hp<=0){respawnPlayer(room,target,attacker);if(room.finished)break;}}room.bullets.splice(i,1);}}
 if(room.elapsed>=180){const [a,b]=players;finishRoom(room,a.score===b.score?null:(a.score>b.score?a.id:b.id),'Tempo esgotado.');return;}
 if(now-room.lastBroadcast>=50){room.lastBroadcast=now;sendState(room);}
}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/leaderboard') {res.writeHead(200,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','cache-control':'no-store'});res.end(JSON.stringify({entries:leaderboard.slice(0,10)}));return;}
 let requested=url.pathname==='/'?'/index.html':url.pathname;
 const file=path.resolve(ROOT,'.'+decodeURIComponent(requested));
 if(!file.startsWith(ROOT+path.sep)&&file!==path.join(ROOT,'index.html')){res.writeHead(403);res.end('Forbidden');return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');return;}const ext=path.extname(file);const type=ext==='.html'?'text/html; charset=utf-8':ext==='.json'?'application/json; charset=utf-8':'application/octet-stream';res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(data);});
});
const wss=new WebSocket.Server({server,path:'/ws',maxPayload:16*1024});
wss.on('connection',ws=>{
 ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);ws.on('message',raw=>processMessage(ws,raw));ws.on('error',e=>console.warn('WebSocket:',e.message));
 ws.on('close',()=>{const p=ws.player,room=ws.room;if(!p||!room)return;room.players.delete(p.id);room.bullets=room.bullets.filter(b=>b.owner!==p.id);if(room.started&&!room.finished){room.started=false;const remaining=[...room.players.values()][0];if(remaining){send(remaining.ws,{type:'opponentLeft',message:'Seu oponente desconectou.'});} }if(room.players.size===0)rooms.delete(room.code);else if(!room.finished)sendRoom(room,{type:'waiting',room:room.code,players:[...room.players.values()].map(q=>({id:q.id,name:q.name}))});});
});
const ticker=setInterval(()=>{const now=Date.now();for(const room of rooms.values())tickRoom(room,now);},33);
const pinger=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},25000);
server.listen(PORT,'0.0.0.0',()=>console.log(`VOID//DRONE online server listening on ${PORT}`));
process.on('SIGTERM',()=>{clearInterval(ticker);clearInterval(pinger);for(const ws of wss.clients)ws.close();server.close(()=>process.exit(0));});
