// Poptify Android — lock-screen UI. The native shell (Kotlin) pushes state via
// window.poptifyUpdate(json) / window.poptifyAuth(bool); the UI calls back via AndroidBridge.

const bridge = window.AndroidBridge || { connect(){}, play(){}, pause(){}, next(){}, prev(){}, seek(){}, like(){} };
const state = { authed:false, track:null, playing:false, liked:false };
const $ = (s) => document.querySelector(s);

// ---------- clock ----------
function tickClock(){
  const d = new Date();
  $('#time').textContent = d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
  $('#date').textContent = d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
}
tickClock(); setInterval(tickClock, 5000);

// ---------- reactive background ----------
const cv = $('#bg'), bx = cv.getContext('2d');
let C1 = '#8b2bff', C2 = '#00e5ff', dpr = Math.min(window.devicePixelRatio||1, 2);
function resize(){ cv.width = innerWidth*dpr; cv.height = innerHeight*dpr; }
addEventListener('resize', resize); resize();
function hexA(h, a){ const n=parseInt(h.replace('#',''),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
let last = 0, paused = false;
document.addEventListener('visibilitychange', ()=> paused = document.hidden);
function frame(t){
  requestAnimationFrame(frame);
  if (paused || t-last < 33) return;   // ~30fps cap for battery
  last = t;
  const w = cv.width, h = cv.height;
  bx.fillStyle = '#07060c'; bx.fillRect(0,0,w,h);
  bx.globalCompositeOperation = 'lighter';
  const pts = [
    { x:0.30+0.16*Math.sin(t*0.00030), y:0.32+0.12*Math.cos(t*0.00025), c:C1, r:0.62 },
    { x:0.72+0.13*Math.cos(t*0.00021), y:0.36+0.15*Math.sin(t*0.00028), c:C2, r:0.56 },
    { x:0.50+0.18*Math.sin(t*0.00023), y:0.74+0.12*Math.cos(t*0.00030), c:C1, r:0.52 },
    { x:0.42+0.12*Math.cos(t*0.00026), y:0.60+0.14*Math.sin(t*0.00020), c:C2, r:0.46 },
  ];
  for (const p of pts){
    const R = p.r*Math.max(w,h);
    const g = bx.createRadialGradient(p.x*w, p.y*h, 0, p.x*w, p.y*h, R);
    g.addColorStop(0, hexA(p.c, 0.55)); g.addColorStop(1, hexA(p.c, 0));
    bx.fillStyle = g; bx.fillRect(0,0,w,h);
  }
  bx.globalCompositeOperation = 'source-over';
}
requestAnimationFrame(frame);

// ---------- icons ----------
const I = {
  prev:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5L9 12l11 7z"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5l11 7L4 19z"/></svg>',
  play:()=> state.playing
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l12 7-12 7z"/></svg>',
  heart:(f)=>`<svg viewBox="0 0 24 24" fill="${f?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
};
function fmt(ms){ const s=Math.max(0,Math.floor(ms/1000)); return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ---------- render the widget ----------
function render(){
  const np = $('#np');
  if (!state.authed){
    np.innerHTML = `<div class="msgcard"><div class="t">Poptify</div><div class="s">Conecta tu cuenta de Spotify.</div><button class="cta" data-act="connect">Conectar con Spotify</button></div>`;
    bind(); return;
  }
  const t = state.track;
  if (!t){ np.innerHTML = ''; return; }   // lock screen with just the clock + bg
  const pct = Math.max(0, Math.min(100, t.posMs / Math.max(1,t.durMs) * 100));
  np.innerHTML = `
    <div class="card">
      <div class="art"><img src="${t.image||''}" alt="" /></div>
      <div class="row">
        <div style="min-width:0"><div class="title">${esc(t.title)}</div><div class="artist">${esc(t.artist)}</div></div>
        <button class="like ${state.liked?'on':''}" data-act="like">${I.heart(state.liked)}</button>
      </div>
      <div class="seek" data-act="seek"><div class="bar"><div class="fill" id="fill" style="width:${pct}%"></div></div>
        <div class="times"><span id="cur">${fmt(t.posMs)}</span><span>-${fmt(t.durMs-t.posMs)}</span></div></div>
      <div class="ctrls">
        <button data-act="prev">${I.prev}</button>
        <button class="play" data-act="play">${I.play()}</button>
        <button data-act="next">${I.next}</button>
      </div>
    </div>`;
  bind();
}
function bind(){
  document.querySelectorAll('[data-act]').forEach(el=>el.addEventListener('click', e=>{
    const a = el.dataset.act;
    if (a==='connect') bridge.connect();
    else if (a==='play'){ state.playing=!state.playing; render(); state.playing?bridge.play():bridge.pause(); }
    else if (a==='next') bridge.next();
    else if (a==='prev') bridge.prev();
    else if (a==='like'){ state.liked=!state.liked; render(); bridge.like(state.liked); }
    else if (a==='seek'){ const bar=el.querySelector('.bar'); const r=bar.getBoundingClientRect();
      const frac=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));
      if(state.track){ state.track.posMs=Math.round(frac*state.track.durMs); render(); bridge.seek(state.track.posMs); } }
  }));
}

// ---------- from native ----------
window.poptifyAuth = (a) => { state.authed = !!a; render(); };
window.poptifyUpdate = (json) => {
  try {
    const d = typeof json==='string' ? JSON.parse(json) : json;
    state.authed = true;
    if (!d || !d.track){ state.track=null; render(); return; }
    state.playing = d.track.isPlaying; state.liked = d.track.liked;
    if (d.track.c1) C1 = d.track.c1; if (d.track.c2) C2 = d.track.c2;
    state.track = { title:d.track.title, artist:d.track.artist, image:d.track.image, durMs:d.track.durMs, posMs:d.track.posMs };
    render();
  } catch(e){ console.error(e); }
};

// local progress tick
setInterval(()=>{
  if (state.authed && state.track && state.playing){
    state.track.posMs = Math.min(state.track.durMs, state.track.posMs + 1000);
    const f=$('#fill'), c=$('#cur');
    if (f) f.style.width = (state.track.posMs/Math.max(1,state.track.durMs)*100)+'%';
    if (c) c.textContent = fmt(state.track.posMs);
  }
}, 1000);

render();
