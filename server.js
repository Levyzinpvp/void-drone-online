// VOID//DRONE Boss Rush race server. Actual combat runs the same HTML game client-side.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'scores.json');
const MODES = new Set(['campaign','endless','nightmare','timed','practice']);
let leaderboard = [];
try { const v = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); if (Array.isArray(v)) leaderboard = v; } catch (_) {}
const rooms = new Map();
function safeName(v) { return String(v || 'PILOTO').replace(/[^A-Za-z0-9 _.-]/g, '').trim().slice(0, 18) || 'PILOTO'; }
function safeMode(v) { return MODES.has(v) ? v : 'campaign'; }
function send(ws, obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function codeGen() { const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let out='';do{out='';for(let i=0;i<5;i++)out+=chars[Math.floor(Math.random()*chars.length)];}while(rooms.has(out));return out; }
function publicPlayer(p) { const s=p.stats||{};return {id:p.id,name:p.name,score:s.score||0,kills:s.kills||0,bossIndex:s.bossIndex||0,hp:s.hp||0,maxHp:s.maxHp||100,runTime:s.runTime||0,finished:!!s.finished,won:!!s.won,mode:p.mode,connected:!!p.ws&&p.ws.readyState===WebSocket.OPEN}; }
function snapshot(room) { return {type:'raceState',room:room.code,mode:room.mode,elapsed:room.startedAt?Math.floor((Date.now()-room.startedAt)/1000):0,players:[...room.players.values()].map(publicPlayer),started:room.started,finished:room.finished}; }
function sendRoom(room,obj){for(const p of room.players.values())send(p.ws,obj);}
function sendState(room){const base=snapshot(room);for(const p of room.players.values())send(p.ws,{...base,youId:p.id});}
function saveLeaderboard(){try{fs.writeFileSync(DB_PATH,JSON.stringify(leaderboard.slice(0,100),null,2));}catch(e){console.error('Could not save leaderboard:',e.message);}}
function recordMatch(room){if(room.recorded)return;room.recorded=true;const players=[...room.players.values()];if(players.length<2)return;const ranked=players.slice().sort((a,b)=>{const x=a.stats||{},y=b.stats||{};return (y.kills||0)-(x.kills||0)||(y.score||0)-(x.score||0)||(x.runTime||0)-(y.runTime||0);});const top=ranked[0],runner=ranked[1];const a=top.stats||{},b=runner.stats||{};const draw=(a.kills||0)===(b.kills||0)&&(a.score||0)===(b.score||0)&&(a.runTime||0)===(b.runTime||0);
 for(const p of players){const s=p.stats||{},key=p.name.toLowerCase();let row=leaderboard.find(x=>x.key===key);if(!row){row={key,name:p.name,wins:0,losses:0,games:0,kills:0,points:0};leaderboard.push(row);}row.name=p.name;row.games++;row.kills+=s.kills||0;row.points+=s.score||0;if(draw)row.draws=(row.draws||0)+1;else if(p.id===top.id)row.wins++;else row.losses++;}
 leaderboard.sort((a,b)=>b.wins-a.wins||b.points-a.points||b.kills-a.kills);leaderboard=leaderboard.slice(0,100);saveLeaderboard();room.finished=true;const message=draw?`Empate! Ambos terminaram com ${a.kills||0} chefes e ${a.score||0} pontos.`:`${top.name} venceu a corrida de Boss Rush: ${a.kills||0} chefes e ${a.score||0} pontos contra ${b.kills||0} chefes e ${b.score||0} pontos.`;sendRoom(room,{type:'raceOver',winnerId:draw?null:top.id,message,snapshot:snapshot(room),leaderboard});}
function startRoom(room){if(room.players.size===2&&!room.started&&!room.finished){if(room.hasStartedBefore){for(const p of room.players.values())p.stats={score:0,kills:0,bossIndex:0,hp:100,maxHp:100,runTime:0,finished:false,won:false};}room.started=true;room.hasStartedBefore=true;room.startedAt=Date.now();for(const p of room.players.values())send(p.ws,{type:'start',room:room.code,mode:room.mode,youId:p.id,snapshot:snapshot(room)});sendState(room);}else sendRoom(room,{type:'waiting',room:room.code,mode:room.mode,players:[...room.players.values()].map(publicPlayer)});}
function joinRoom(ws,msg){if(ws.player){send(ws,{type:'error',message:'Esta conexão já está em uma sala.'});return;}let room;const action=msg.type;
 if(action==='create'){const code=codeGen();room={code,mode:safeMode(msg.mode),players:new Map(),started:false,finished:false,recorded:false,hasStartedBefore:false,startedAt:0};rooms.set(code,room);}
 else{const code=String(msg.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);room=rooms.get(code);if(!room){send(ws,{type:'error',message:'Sala não encontrada. Confira o código ou peça ao amigo para criar outra.'});return;}if(room.finished){send(ws,{type:'error',message:'Esta sala já terminou. Crie uma nova sala.'});return;}if(room.players.size>=2){send(ws,{type:'error',message:'Esta sala já está cheia.'});return;}}
 let name=safeName(msg.name);if([...room.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()))name=(name.slice(0,14)+'-'+(room.players.size+1)).slice(0,18);
 const p={id:Math.random().toString(36).slice(2,10),ws,name,mode:room.mode,stats:{score:0,kills:0,bossIndex:0,hp:100,maxHp:100,runTime:0,finished:false,won:false},lastProgress:0};room.players.set(p.id,p);ws.player=p;ws.room=room;
 send(ws,{type:'joined',id:p.id,room:room.code,name:p.name,mode:room.mode,players:[...room.players.values()].map(publicPlayer),leaderboard});startRoom(room);
}
function handleMessage(ws,raw){let m;try{m=JSON.parse(raw.toString());}catch(_){return;}if(!m||typeof m!=='object')return;
 if(m.type==='leaderboard'){send(ws,{type:'leaderboard',entries:leaderboard.slice(0,10)});return;}
 if(m.type==='create'||m.type==='join'){joinRoom(ws,m);return;}
 const p=ws.player,room=ws.room;if(!p||!room)return;
 if(m.type==='progress'&&room.started&&!room.finished){const now=Date.now();if(now-p.lastProgress<100)return;p.lastProgress=now;const n=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));p.stats={score:Math.floor(n(m.score,0,1e9)),kills:Math.floor(n(m.kills,0,100000)),bossIndex:Math.floor(n(m.bossIndex,0,100000)),hp:Math.floor(n(m.hp,0,1000000)),maxHp:Math.floor(n(m.maxHp,1,1000000)),runTime:Math.floor(n(m.runTime,0,1e7)),finished:!!m.finished,won:!!m.won};sendState(room);if([...room.players.values()].every(q=>q.stats.finished))recordMatch(room);}
}
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/leaderboard'){res.writeHead(200,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','cache-control':'no-store'});res.end(JSON.stringify({entries:leaderboard.slice(0,10)}));return;}const requestPath=url.pathname==='/'?'/index.html':url.pathname;let file=path.resolve(ROOT,'.'+decodeURIComponent(requestPath));if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);res.end('Forbidden');return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');return;}const ext=path.extname(file).toLowerCase();const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':'no-store'});res.end(data);});});
const wss=new WebSocket.Server({server,path:'/ws',maxPayload:16*1024});
wss.on('connection',ws=>{ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);ws.on('message',raw=>handleMessage(ws,raw));ws.on('error',e=>console.warn('WebSocket:',e.message));ws.on('close',()=>{const p=ws.player,room=ws.room;if(!p||!room)return;room.players.delete(p.id);if(room.players.size===0)rooms.delete(room.code);else if(!room.finished){room.started=false;sendRoom(room,{type:'opponentLeft',message:'Seu oponente desconectou.',snapshot:snapshot(room)});}});});
const pinger=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},25000);
server.listen(PORT,'0.0.0.0',()=>console.log(`VOID//DRONE Boss Rush race server listening on ${PORT}`));
process.on('SIGTERM',()=>{clearInterval(pinger);for(const ws of wss.clients)ws.close();server.close(()=>process.exit(0));});
