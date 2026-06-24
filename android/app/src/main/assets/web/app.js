// Poptify Android — WebView UI. Presentation only: the native shell (Kotlin)
// pushes now-playing state via window.poptifyUpdate(json) and window.poptifyAuth(json),
// and the UI calls back through the AndroidBridge JS interface.

const bridge = window.AndroidBridge || {
  connect(){}, play(){}, pause(){}, next(){}, prev(){}, seek(){}, like(){},
};

const state = { authed: false, premium: true, track: null, playing: false, liked: false };

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const bgEl = $('#bg');

function fmt(ms){ const s=Math.max(0,Math.floor(ms/1000)); const m=Math.floor(s/60); return `${m}:${(s%60).toString().padStart(2,'0')}`; }

const I = {
  prev:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5L9 12l11 7z"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5l11 7L4 19z"/></svg>',
  play:()=> state.playing
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l12 7-12 7z"/></svg>',
  heart:(f)=>`<svg viewBox="0 0 24 24" fill="${f?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
};

function setBg(url){
  bgEl.style.backgroundImage = url ? `url("${url}")` : 'none';
}

function render(){
  if (!state.authed){
    setBg('');
    stage.innerHTML = `
      <div class="center">
        <div class="logo">🎵</div>
        <div class="big">Poptify</div>
        <div class="sub">Conecta tu cuenta de Spotify para ver lo que suena.</div>
        <button class="cta" data-act="connect">Conectar con Spotify</button>
      </div>`;
    bind(); return;
  }
  const t = state.track;
  if (!t){
    setBg('');
    stage.innerHTML = `<div class="center"><div class="logo">🔇</div><div class="big">Nada sonando</div><div class="sub">Reproduce algo en Spotify.</div></div>`;
    bind(); return;
  }
  setBg(t.image);
  const pct = Math.max(0, Math.min(100, t.posMs / Math.max(1, t.durMs) * 100));
  stage.innerHTML = `
    <div class="player">
      <div class="art"><img src="${t.image || ''}" alt="" /></div>
      <div class="row">
        <div class="meta">
          <div class="title">${escapeHtml(t.title)}</div>
          <div class="artist">${escapeHtml(t.artist)}</div>
        </div>
        <button class="icon like ${state.liked?'on':''}" data-act="like">${I.heart(state.liked)}</button>
      </div>
      <div class="seek" data-act="seek"><div class="bar"><div class="fill" id="fill" style="width:${pct}%"></div></div>
        <div class="times"><span id="cur">${fmt(t.posMs)}</span><span>-${fmt(t.durMs - t.posMs)}</span></div>
      </div>
      <div class="ctrls">
        <button class="icon" data-act="prev">${I.prev}</button>
        <button class="icon play" data-act="play">${I.play()}</button>
        <button class="icon" data-act="next">${I.next}</button>
      </div>
    </div>`;
  bind();
}

function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function bind(){
  stage.querySelectorAll('[data-act]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      const a = el.dataset.act;
      if (a==='connect') bridge.connect();
      else if (a==='play'){ state.playing=!state.playing; render(); state.playing?bridge.play():bridge.pause(); }
      else if (a==='next') bridge.next();
      else if (a==='prev') bridge.prev();
      else if (a==='like'){ state.liked=!state.liked; render(); bridge.like(state.liked); }
      else if (a==='seek'){
        const bar = el.querySelector('.bar'); const r=bar.getBoundingClientRect();
        const frac = Math.min(1, Math.max(0, (e.clientX-r.left)/r.width));
        if (state.track){ state.track.posMs = Math.round(frac*state.track.durMs); render(); bridge.seek(state.track.posMs); }
      }
    });
  });
}

// ---- called from native ----
window.poptifyAuth = (authed) => { state.authed = !!authed; render(); };
window.poptifyUpdate = (json) => {
  try {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    state.authed = true;
    if (!d || !d.track) { state.track = null; render(); return; }
    state.playing = d.track.isPlaying;
    state.liked = d.track.liked;
    state.track = { title:d.track.title, artist:d.track.artist, image:d.track.image,
                    durMs:d.track.durMs, posMs:d.track.posMs };
    render();
  } catch(e){ console.error(e); }
};

// local progress tick between native pushes
setInterval(()=>{
  if (state.authed && state.track && state.playing){
    state.track.posMs = Math.min(state.track.durMs, state.track.posMs + 1000);
    const f=$('#fill'), c=$('#cur');
    if (f) f.style.width = (state.track.posMs/Math.max(1,state.track.durMs)*100)+'%';
    if (c) c.textContent = fmt(state.track.posMs);
  }
}, 1000);

render();
