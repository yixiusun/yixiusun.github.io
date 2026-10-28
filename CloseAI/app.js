/* Plain browser client. All rule decisions and randomness belong to the Worker. */
const $=id=>document.getElementById(id);
const API=(window.CLOSEAI_API||'').replace(/\/$/,'');
let state=null,busy=false,polling=false,token='',storageOK=true;
try {
  token=localStorage.getItem('closeai.identity')||'';
  if(!/^[a-f0-9]{64}$/.test(token)) {
    token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
    localStorage.setItem('closeai.identity',token);
  }
} catch { storageOK=false; }
const message=text=>{$('message').textContent=text;};
const letters=['A','B'],colors=['红','绿','蓝'];
async function request(path,body) {
  const response=await fetch(API+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000),cache:'no-store'});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||'请求失败');
  return data;
}
function accept(next) {
  if(state&&state.room===next.room&&state.revision>next.revision) return;
  if(!state||state.revision!==next.revision||state.room!==next.room) { state=next; render(); }
  $('connection').textContent='已同步';
}
function roomURL(id) { const u=new URL(location.href);u.search='';u.searchParams.set('room',id);return u; }
async function enter(id) {
  const next=await request(id?`/rooms/${id}/join`:'/rooms',{});
  state=null; accept(next);
  localStorage.setItem('closeai.lastRoom',next.room); history.replaceState(null,'',roomURL(next.room));
}
async function perform(fn) {
  if(busy) return;
  if(!API) { message('请先在 config.js 中填写后端地址。'); return; }
  if(!storageOK) { message('请允许浏览器本地存储，以保存玩家身份。'); return; }
  busy=true; message(''); controls();
  try { await fn(); } catch(e) { message(e.message==='Failed to fetch'?'连接失败，请检查网络和后端地址。':e.message); }
  finally {busy=false;controls();}
}
async function action(a) {
  await perform(async()=>{
    try { accept(await request(`/rooms/${state.room}/action`,{revision:state.revision,action:a})); }
    catch(e) { try { accept(await request(`/rooms/${state.room}`)); } catch {} throw e; }
  });
}
function controls() {
  document.querySelectorAll('button').forEach(b=>{b.disabled=busy;});
  $('science-toggle').disabled=busy||!state||state.frontier<100||state.players[state.seat].money<20;
  $('create').disabled=busy||!API||!storageOK; $('join').disabled=busy||!API||!storageOK;
}
function render() {
  const s=state,p=s.players[s.seat],mine=s.current===s.seat,active=mine&&!['waiting','finished'].includes(s.phase);
  $('lobby').hidden=true; $('game').hidden=false; $('invite').hidden=false; $('home').hidden=false;
  $('room-label').textContent=`房间 ${s.room}`;
  $('turn-label').textContent=s.phase==='waiting'?'等待另一位玩家加入':s.phase==='finished'?(s.winner===-1?'平局':`公司 ${letters[s.winner]} 获胜`):`第 ${s.turn} 回合 · ${mine?'轮到你行动':'等待公司 '+letters[s.current]}`;
  $('companies').innerHTML=s.players.map((p,i)=>`<section class="company"><div class="company-title"><h2>公司 ${letters[i]}</h2><span class="tag${i===s.seat?' solid':''}">${i===s.seat?'你':'对手'}</span>${p.published>s.players[1-i].published?'<span class="tag">领先</span>':''}</div><div class="stats"><div><span class="label">资金</span><span class="number">${p.money}</span><p class="small">收入 +${p.income}</p></div><div><span class="label">公开模型能力</span><span class="number">${p.published}</span><p class="small">已发布 v${p.publishedVersion}</p></div></div><div class="gems">${p.gems.map((n,k)=>`<span>◇ ${colors[k]} ${n}</span>`).join('')}</div></section>`).join('');
  $('steps').textContent=s.phase==='action'?'研究':s.phase==='publish'?'发布':s.phase==='end'?'回合结束':'';
  $('research').hidden=!(active&&s.phase==='action');
  $('publication').hidden=!(active&&s.phase==='publish');
  $('end').hidden=!(active&&s.phase==='end');
  $('version-choice').hidden=true; $('version-choice').replaceChildren();
  $('science-form').hidden=true;
  $('action-status').textContent=s.phase==='waiting'?'分享邀请链接开始对局。':s.phase==='finished'?'对局结束。':!mine?'等待对手。':s.phase==='publish'?'是否发布模型？':s.phase==='end'?'本回合行动已完成。':'';
  $('cost').max=p.money; $('cycles').max=Math.floor(p.money/20);
  $('research-progress').textContent=p.research?`研究剩余 ${p.research.remaining} 回合`:'';
  $('models').innerHTML=p.models.length?p.models.map(m=>`<tr><td>v${m.version}</td><td>${m.power}</td><td>${m.power===1?'不可发布':'未发布'}</td></tr>`).join(''):'<tr><td colspan="3">无</td></tr>';
  $('condition').textContent=s.condition?s.condition.map((n,k)=>n?`${colors[k]} × ${n}`:'').filter(Boolean).join(' / '):'—';
  $('deck-meta').textContent=`牌库剩余 ${s.remaining} 张`;
  $('events').replaceChildren();
  // Text nodes keep exported/player data out of HTML parsing.
  for(const log of s.logs.slice(-100).reverse()) {
    const li=document.createElement('li'),time=document.createElement('time');
    time.textContent=`ROUND ${log.turn} · 公司 ${letters[log.player]}`;
    li.append(time,document.createTextNode(log.text)); $('events').append(li);
  }
  controls();
}
$('create').onclick=()=>perform(()=>enter());
$('join').onclick=()=>perform(()=>{
  const id=$('room-input').value.trim().toUpperCase();
  if(!/^[A-F0-9]{12}$/.test(id)) throw new Error('请输入12位房间码');
  return enter(id);
});
$('model-form').onsubmit=e=>{e.preventDefault();action({type:'model',cost:Number($('cost').value),duration:Number($('duration').value)});};
$('science-toggle').onclick=()=>{$('science-form').hidden=!$('science-form').hidden;};
$('science-form').onsubmit=e=>{e.preventDefault();action({type:'science',cycles:Number($('cycles').value)});};
$('skip').onclick=()=>action({type:'skip'});
$('hold').onclick=()=>action({type:'hold'});
$('end').onclick=()=>action({type:'end'});
$('publish-yes').onclick=()=>{
  const list=state.players[state.seat].models.filter(m=>m.power>1);
  if(list.length===1) return action({type:'publish',version:list[0].version});
  $('publication').hidden=true; $('version-choice').hidden=false;
  $('version-choice').replaceChildren();
  for(const m of list) {const b=document.createElement('button'); b.textContent=`v${m.version} · 能力 ${m.power}`;b.onclick=()=>action({type:'publish',version:m.version});$('version-choice').append(b);}
};
$('invite').onclick=async()=>{
  const url=roomURL(state.room).href;
  try {await navigator.clipboard.writeText(url);message('邀请链接已复制。');} catch {message(url);}
};
$('home').onclick=()=>{state=null;history.replaceState(null,'',location.pathname);location.reload();};
$('download').onclick=()=>{
  const text=`CloseAI 房间 ${state.room}\n`+state.logs.map(l=>`回合 ${l.turn} 公司 ${letters[l.player]}：${l.text}`).join('\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`CloseAI_${state.room}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
const initial=new URLSearchParams(location.search).get('room');
if(initial) $('room-input').value=initial.toUpperCase();
try {const last=localStorage.getItem('closeai.lastRoom');if(last){$('resume').hidden=false;$('resume').onclick=()=>perform(()=>enter(last));}} catch {}
if(!API) message('请先在 config.js 中填写后端地址。');
else if(initial&&/^[A-Fa-f0-9]{12}$/.test(initial)) perform(()=>enter(initial.toUpperCase()));
controls();
setInterval(async()=>{
  if(!state||busy||polling||document.hidden||state.phase==='finished') return;
  const id=state.room; polling=true;
  try {const next=await request(`/rooms/${id}`); if(state?.room===id) accept(next);}
  catch {if(state?.room===id)$('connection').textContent='连接中断，正在重试…';}
  finally {polling=false;}
},2000);
