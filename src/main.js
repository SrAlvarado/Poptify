import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, currentMonitor, primaryMonitor } from '@tauri-apps/api/window';
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi';

const appWindow = getCurrentWindow();
const MARGIN = 22; // transparent breathing room around the popup (for shadow + 3D tilt)

// ---------- catalog ----------
const SKINS = [
  { id:'ios', name:'iOS', emoji:'📱' },
  { id:'ipod', name:'MP3 / iPod', emoji:'🎧' },
  { id:'gb', name:'Game Boy', emoji:'🎮' },
  { id:'psp', name:'PSP', emoji:'🕹️' },
  { id:'mp4', name:'MP4 / PMP', emoji:'📺' },
  { id:'vinyl', name:'Vinilo', emoji:'💿' },
  { id:'notch', name:'Notch (cámara)', emoji:'📷' },
];
const BGS = [
  { id:'dark', name:'Oscuro' },
  { id:'blur', name:'Difuminado' },
  { id:'vivid', name:'Vivo' },
];

// ---------- state ----------
const state = {
  skin: localStorage.getItem('skin') || 'ios',
  bg: localStorage.getItem('bg') || 'dark',
  mode: localStorage.getItem('mode') || 'expanded',
  settingsOpen: false,
  // live playback
  authed: false,
  hasClientId: false,
  track: null,       // { id, title, artist, durSec, curSec, image }
  playing: false,
  liked: false,
};

// ---------- SVG icons ----------
const I = {
  prev:'<svg width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" style="width:60%;height:60%"><path d="M6 5h2v14H6zM20 5L9 12l11 7z"/></svg>',
  next:'<svg width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" style="width:60%;height:60%"><path d="M16 5h2v14h-2zM4 5l11 7L4 19z"/></svg>',
  play:()=> state.playing
    ? '<svg viewBox="0 0 24 24" fill="currentColor" style="width:55%;height:55%"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor" style="width:55%;height:55%"><path d="M8 5l12 7-12 7z"/></svg>',
  heart:(filled)=>`<svg viewBox="0 0 24 24" fill="${filled?'currentColor':'none'}" stroke="currentColor" stroke-width="2" style="width:80%;height:80%"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:60%;height:60%"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:55%;height:55%"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

// ---------- cover image + reactive colors ----------
const off = document.createElement('canvas'); off.width = 300; off.height = 300;
const offc = off.getContext('2d', { willReadFrequently: true });
let coverImg = null;       // HTMLImageElement of the current album art
let coverColors = null;    // { avg, dom, dataURL }
let coverSrc = '';         // current image data URL (to detect changes)

function drawImageCover(c, w, h, img) {
  if (!img) { c.fillStyle = '#202028'; c.fillRect(0,0,w,h); return; }
  const ir = img.width / img.height, r = w / h;
  let sw, sh, sx, sy;
  if (ir > r) { sh = img.height; sw = sh * r; sx = (img.width - sw)/2; sy = 0; }
  else { sw = img.width; sh = sw / r; sx = 0; sy = (img.height - sh)/2; }
  c.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

function computeColors(img, dataURL) {
  offc.clearRect(0,0,off.width,off.height);
  drawImageCover(offc, off.width, off.height, img);
  const data = offc.getImageData(0,0,off.width,off.height).data;
  let r=0,g=0,b=0,n=0; const bk={};
  for (let i=0;i<data.length;i+=4*40){ const R=data[i],G=data[i+1],B=data[i+2]; r+=R;g+=G;b+=B;n++; const k=`${R>>5},${G>>5},${B>>5}`; bk[k]=(bk[k]||0)+1; }
  const avg=[Math.round(r/n),Math.round(g/n),Math.round(b/n)]; let best=null,bs=-1;
  for (const k in bk){ const [br,bg,bb]=k.split(',').map(x=>(parseInt(x)<<5)+16); const sat=Math.max(br,bg,bb)-Math.min(br,bg,bb); const sc=bk[k]*(sat+30); if(sc>bs){bs=sc;best=[br,bg,bb];} }
  return { avg, dom: best||avg, dataURL };
}

function fallbackColors() { return { avg:[40,40,48], dom:[60,60,80], dataURL:'' }; }
function colors() { return coverColors || fallbackColors(); }

// load a new cover image (returns a promise that resolves once decoded)
function loadCover(dataURL) {
  return new Promise(res => {
    if (!dataURL) { coverImg=null; coverColors=fallbackColors(); coverSrc=''; return res(); }
    const img = new Image();
    img.onload = () => { coverImg = img; coverColors = computeColors(img, dataURL); coverSrc = dataURL; res(); };
    img.onerror = () => { coverImg = null; coverColors = fallbackColors(); coverSrc = dataURL; res(); };
    img.src = dataURL;
  });
}

function bgCSS(col) {
  const d=`rgb(${col.dom.join(',')})`, a=`rgb(${col.avg.join(',')})`;
  const dark=`rgb(${col.dom.map(v=>Math.round(v*0.32)).join(',')})`;
  if (state.bg==='vivid') {
    const v=col.dom.map(v=>Math.min(255,Math.round(v*1.25+30))), v2=col.avg.map(v=>Math.min(255,Math.round(v*1.2+20)));
    return `radial-gradient(120% 90% at 25% 0%, rgb(${v.join(',')}), transparent 65%), linear-gradient(160deg, rgb(${v.join(',')}), rgb(${v2.join(',')}))`;
  }
  return `radial-gradient(120% 80% at 30% 10%, ${d}, transparent 60%), radial-gradient(120% 90% at 80% 100%, ${a}, transparent 55%), linear-gradient(160deg, ${d}, ${dark})`;
}
function fmt(s){s=Math.max(0,Math.floor(s));const m=Math.floor(s/60),sec=s%60;return `${m}:${sec.toString().padStart(2,'0')}`;}

// ====================== SKIN RENDERERS ======================
function renderIOS(al, col) {
  const pct = al.cur/al.dur*100;
  const blur = state.bg==='blur';
  return `
  <div class="bg" style="background:${bgCSS(col)}"></div>
  <div class="bg-blur" style="background-image:url(${col.dataURL});opacity:${blur?1:0}"></div>
  <div class="noise" style="background:rgba(0,0,0,${state.bg==='vivid'?0.12:state.bg==='blur'?0.25:0.30})"></div>
  <div class="inner">
    <div class="grip"></div>
    <div class="topbar"><span class="live"></span> Reproduciendo ahora</div>
    <div class="art"><canvas data-art width="600" height="600"></canvas></div>
    <div class="track">
      <div style="min-width:0">
        <div class="title">${al.title}</div>
        <div class="artist">${al.artist}</div>
      </div>
      <button class="icon-btn like ${state.liked?'liked':''}" data-act="like" title="Favorito">${I.heart(state.liked)}</button>
    </div>
    <div class="scrub">
      <div class="bar" data-act="seek"><div class="fill" style="width:${pct}%"></div></div>
      <div class="times"><span>${fmt(al.cur)}</span><span>-${fmt(al.dur-al.cur)}</span></div>
    </div>
    <div class="ctrls">
      <button class="icon-btn" data-act="prev">${I.prev}</button>
      <button class="icon-btn play" data-act="play">${I.play()}</button>
      <button class="icon-btn" data-act="next">${I.next}</button>
    </div>
    <div class="actions">
      <button class="pill" data-act="lyrics"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h12M4 18h8"/></svg>Letra</button>
      <button class="pill" data-act="video"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>Vídeo</button>
    </div>
  </div>`;
}

function renderIOSMini(al, col) {
  const pct = al.cur/al.dur*100;
  const blur = state.bg==='blur';
  return `
  <div class="bg" style="background:${bgCSS(col)}"></div>
  <div class="bg-blur" style="background-image:url(${col.dataURL});opacity:${blur?1:0}"></div>
  <div class="noise" style="background:rgba(0,0,0,${state.bg==='vivid'?0.12:state.bg==='blur'?0.25:0.30})"></div>
  <div class="inner">
    <div class="mini-bar">
      <div class="mini-art"><canvas data-art width="120" height="120"></canvas></div>
      <button class="icon-btn" data-act="prev" title="Anterior">${I.prev}</button>
      <button class="icon-btn play" data-act="play" title="Pausa">${I.play()}</button>
      <button class="icon-btn" data-act="next" title="Siguiente">${I.next}</button>
      <div class="mini-seek">
        <div class="bar" data-act="seek"><div class="fill" style="width:${pct}%"></div></div>
        <div class="mini-times"><span>${fmt(al.cur)}</span><span>${fmt(al.dur)}</span></div>
      </div>
      <button class="icon-btn like ${state.liked?'liked':''}" data-act="like" title="Favorito">${I.heart(state.liked)}</button>
      <button class="icon-btn settings-inline" data-act="settings" title="Ajustes">${I.gear}</button>
    </div>
  </div>`;
}

function renderIpod(al) {
  const pct = al.cur/al.dur*100;
  return `
  <div class="screen">
    <div class="reflect"></div>
    <div class="scr-top"><span>Now Playing</span><span>${state.playing?'▶':'❚❚'} ♪</span></div>
    <div class="scr-main">
      <div class="scr-art"><canvas data-art width="200" height="200"></canvas></div>
      <div class="scr-info">
        <div class="title">${al.title}</div>
        <div class="artist">${al.artist}</div>
        <button class="icon-btn like" data-act="like" style="${state.liked?'color:#1ed760':''}">${I.heart(state.liked)}</button>
      </div>
    </div>
    <div class="scr-bar">
      <div class="bar" data-act="seek"><div class="fill" style="width:${pct}%"></div></div>
      <div class="scr-times"><span>${fmt(al.cur)}</span><span>-${fmt(al.dur-al.cur)}</span></div>
    </div>
  </div>
  <div class="wheel">
    <button class="wbtn menu" data-act="like">MENU</button>
    <button class="wbtn prev" data-act="prev">|◄◄</button>
    <button class="wbtn next" data-act="next">►►|</button>
    <button class="wbtn play" data-act="play">►❚❚</button>
    <div class="center" data-act="play">${I.play()}</div>
  </div>`;
}

function renderGB(al) {
  const pct = al.cur/al.dur*100;
  return `
  <div class="gb-head">DOT MATRIX WITH STEREO SOUND</div>
  <div class="gb-screenbox">
    <div class="gb-power">BATTERY</div>
    <div class="lcd">
      <div class="lcd-art"><canvas data-art width="160" height="160"></canvas></div>
      <div class="title">${al.title}</div>
      <div class="artist">${al.artist}</div>
      <div class="bar" data-act="seek"><div class="fill" style="width:${pct}%"></div></div>
    </div>
  </div>
  <div class="gb-logo">Poptify<span> ♪</span></div>
  <div class="gb-ctrls">
    <div class="dpad">
      <button class="d du" data-act="like" title="Favorito">${state.liked?'♥':'♡'}</button>
      <button class="d dl" data-act="prev">◄</button>
      <div class="dc"></div>
      <button class="d dr" data-act="next">►</button>
      <button class="d dd"></button>
    </div>
    <div class="ab">
      <button class="ab-btn ab-lbl" data-l="B" data-act="like">${state.liked?'♥':'♡'}</button>
      <button class="ab-btn ab-lbl" data-l="A" data-act="play">${state.playing?'❚❚':'►'}</button>
    </div>
  </div>
  <div class="startsel">
    <div class="ss"><div class="pillbtn"></div><span class="sslbl">SELECT</span></div>
    <div class="ss"><div class="pillbtn"></div><span class="sslbl">START</span></div>
  </div>`;
}

function renderPSP(al, col) {
  const pct = al.cur/al.dur*100;
  return `
  <div class="psp-side">
    <div class="dpad">
      <button class="d du"></button>
      <button class="d dl" data-act="prev">◄</button>
      <button class="d dr" data-act="next">►</button>
      <button class="d dd"></button>
    </div>
    <div class="analog"></div>
  </div>
  <div class="screen">
    <div class="bg" style="background:${bgCSS(col)}"></div>
    <div class="blur" style="background-image:url(${col.dataURL})"></div>
    <div class="noise"></div>
    <div class="scr-content">
      <div class="row1">
        <div class="art"><canvas data-art width="160" height="160"></canvas></div>
        <div style="min-width:0">
          <div class="title">${al.title}</div>
          <div class="artist">${al.artist}</div>
        </div>
      </div>
      <div class="scr-bar">
        <div class="bar" data-act="seek"><div class="fill" style="width:${pct}%"></div></div>
        <div class="times"><span>${fmt(al.cur)}</span><span>-${fmt(al.dur-al.cur)}</span></div>
      </div>
    </div>
    <div class="psp-logo">POPTIFY</div>
  </div>
  <div class="psp-side">
    <div class="face">
      <button class="fbtn triangle" data-act="like" title="Favorito">${state.liked?'♥':'△'}</button>
      <button class="fbtn circle" data-act="like" title="Favorito">●</button>
      <button class="fbtn cross" data-act="play" title="Play/Pausa">${state.playing?'❚❚':'✕'}</button>
      <button class="fbtn square" data-act="next" title="Siguiente">■</button>
    </div>
  </div>`;
}

function renderMP4(al, col) {
  const pct = al.cur/al.dur*100;
  return `
  <div class="m-brand">▶ POPTIFY MEDIA</div>
  <div class="m-screen">
    <div class="bg" style="background:${bgCSS(col)}"></div>
    <div class="art"><canvas data-art width="400" height="300"></canvas></div>
    <div class="play-glyph" data-act="play"><div class="circle">${I.play()}</div></div>
    <div class="ov">
      <div class="title">${al.title}</div>
      <div class="artist">${al.artist}</div>
      <div class="bar" data-act="seek"><div class="fill" style="width:${pct}%"></div></div>
    </div>
  </div>
  <div class="m-ctrls">
    <button class="icon-btn" data-act="prev">${I.prev}</button>
    <button class="icon-btn like ${state.liked?'liked':''}" data-act="like">${I.heart(state.liked)}</button>
    <button class="icon-btn play" data-act="play">${I.play()}</button>
    <button class="icon-btn" data-act="next">${I.next}</button>
  </div>`;
}

function renderVinyl(al, col) {
  const pct = al.cur/al.dur*100;
  return `
  <div class="v-bg" style="background-image:url(${col.dataURL})"></div>
  <div class="v-inner">
    <div class="turntable">
      <div class="disc ${state.playing?'':'paused'}">
        <div class="label"><canvas data-art width="120" height="120"></canvas></div>
        <div class="hole"></div>
      </div>
      <div class="v-info">
        <div class="title">${al.title}</div>
        <div class="artist">${al.artist}</div>
        <button class="icon-btn like ${state.liked?'liked':''}" data-act="like">${I.heart(state.liked)}</button>
      </div>
    </div>
    <div class="v-scrub">
      <div class="bar" data-act="seek"><div class="fill" style="width:${pct}%"></div></div>
      <div class="v-times"><span>${fmt(al.cur)}</span><span>-${fmt(al.dur-al.cur)}</span></div>
    </div>
    <div class="v-ctrls">
      <button class="icon-btn" data-act="prev">${I.prev}</button>
      <button class="icon-btn play" data-act="play">${I.play()}</button>
      <button class="icon-btn" data-act="next">${I.next}</button>
    </div>
  </div>`;
}

function renderNotch(al, col) {
  const pct = al.cur/al.dur*100;
  const glow = `radial-gradient(60% 130% at 16% 50%, rgb(${col.dom.join(',')}), transparent 72%), radial-gradient(60% 130% at 84% 50%, rgb(${col.avg.join(',')}), transparent 72%)`;
  return `
  <div class="n-glow" style="background:${glow}"></div>
  <div class="notch-body">
    <div class="notch-left">
      <div class="n-art"><canvas data-art width="80" height="80"></canvas></div>
      <div class="n-info">
        <div class="title">${al.title}</div>
        <div class="artist">${al.artist}</div>
      </div>
      <div class="eq ${state.playing?'':'paused'}"><span></span><span></span><span></span><span></span></div>
    </div>
    <div class="notch-cam"><div class="lens"></div></div>
    <div class="notch-right">
      <button class="icon-btn" data-act="prev" title="Anterior">${I.prev}</button>
      <button class="icon-btn play" data-act="play" title="Pausa">${I.play()}</button>
      <button class="icon-btn" data-act="next" title="Siguiente">${I.next}</button>
      <button class="icon-btn like ${state.liked?'liked':''}" data-act="like" title="Favorito">${I.heart(state.liked)}</button>
      <button class="icon-btn settings-inline" data-act="settings" title="Ajustes">${I.gear}</button>
    </div>
  </div>
  <div class="notch-progress"><div class="bar" data-act="seek"><div class="fill" style="width:${pct}%"></div></div></div>`;
}

// ---------- auth / empty screens ----------
function renderConnect() {
  const needId = !state.hasClientId;
  return `
  <div class="auth">
    <div class="auth-logo">🎵</div>
    <div class="auth-title">Poptify</div>
    ${needId ? `
      <div class="auth-sub">Pega tu <b>Client ID</b> de la app de Spotify Developer.<br>Redirect URI: <code>http://127.0.0.1:14528/callback</code></div>
      <input id="clientIdInput" class="auth-input" placeholder="Spotify Client ID" />
      <button class="auth-btn" data-act="save-id">Guardar</button>
    ` : `
      <div class="auth-sub">Conecta tu cuenta para ver lo que está sonando.</div>
      <button class="auth-btn spotify" data-act="login">Conectar con Spotify</button>
    `}
  </div>`;
}
function renderEmpty() {
  return `
  <div class="auth">
    <div class="auth-logo">🔇</div>
    <div class="auth-title">Nada sonando</div>
    <div class="auth-sub">Reproduce algo en Spotify y aparecerá aquí.</div>
    <button class="auth-btn ghost" data-act="settings">Ajustes</button>
  </div>`;
}

// ---------- settings panel (floating) ----------
const settingsEl = document.getElementById('settings');
const scrimEl = document.getElementById('scrim');

function renderSettings() {
  const skinOpts = SKINS.map(s=>`<div class="opt ${state.skin===s.id?'active':''}" data-set-skin="${s.id}"><span class="emoji">${s.emoji}</span>${s.name}</div>`).join('');
  const bgOpts = BGS.map(b=>`<div class="opt ${state.bg===b.id?'active':''}" data-set-bg="${b.id}">${b.name}</div>`).join('');
  const modeOpts = ['expanded','mini'].map(m=>`<div class="opt ${state.mode===m?'active':''}" data-set-mode="${m}">${m==='expanded'?'Expandido':'Mini'}</div>`).join('');
  settingsEl.innerHTML = `
    <h3>Ajustes <button class="icon-btn close" data-act="settings">${I.close}</button></h3>
    <div class="sec"><span class="lbl">Display</span><div class="opts" style="grid-template-columns:repeat(2,1fr)">${skinOpts}</div></div>
    <div class="sec"><span class="lbl">Fondo</span><div class="opts" style="grid-template-columns:repeat(3,1fr)">${bgOpts}</div></div>
    <div class="sec"><span class="lbl">Modo (iOS)</span><div class="opts">${modeOpts}</div></div>
    ${state.authed ? `<div class="sec"><button class="opt" style="width:100%" data-act="logout">Cerrar sesión de Spotify</button></div>` : ``}`;
  settingsEl.querySelectorAll('[data-set-skin]').forEach(el=>el.addEventListener('click',()=>{ state.skin=el.dataset.setSkin; localStorage.setItem('skin',state.skin); render(true); }));
  settingsEl.querySelectorAll('[data-set-bg]').forEach(el=>el.addEventListener('click',()=>{ state.bg=el.dataset.setBg; localStorage.setItem('bg',state.bg); render(true); }));
  settingsEl.querySelectorAll('[data-set-mode]').forEach(el=>el.addEventListener('click',()=>{ state.mode=el.dataset.setMode; localStorage.setItem('mode',state.mode); render(true); }));
  settingsEl.querySelector('[data-act="settings"]').addEventListener('click',()=>{ state.settingsOpen=false; syncSettings(); });
  const logout = settingsEl.querySelector('[data-act="logout"]');
  if (logout) logout.addEventListener('click', async ()=>{ await invoke('logout'); state.settingsOpen=false; state.authed=false; state.track=null; render(true); });
  settingsEl.classList.toggle('open', state.settingsOpen);
  scrimEl.classList.toggle('show', state.settingsOpen);
}

function syncSettings() {
  renderSettings();
  layout();
}

// ---------- main render ----------
const popup = document.getElementById('popup');
let likeJustToggled = false;
let lastSkin = null;

function trackForSkin() {
  if (!state.track) return { title:'—', artist:'—', cur:0, dur:1 };
  return { title: state.track.title || '—', artist: state.track.artist || '—', cur: state.track.curSec, dur: Math.max(1, state.track.durSec) };
}

function render(swap) {
  // not connected yet → connect / setup screen
  if (!state.authed) {
    popup.className = 'popup skin-ios';
    popup.innerHTML = renderConnect();
    bindControls();
    syncSettings();
    return;
  }
  // connected but nothing playing
  if (!state.track) {
    popup.className = 'popup skin-ios';
    popup.innerHTML = renderEmpty();
    bindControls();
    syncSettings();
    return;
  }

  const al = trackForSkin();
  const col = colors();
  const isMini = state.skin==='ios' && state.mode==='mini';
  const inlineSettings = isMini || state.skin==='notch';
  const renderers = { ios:renderIOS, ipod:renderIpod, gb:renderGB, psp:renderPSP, mp4:renderMP4, vinyl:renderVinyl, notch:renderNotch };
  popup.className = 'popup skin-' + state.skin + (isMini ? ' mini' : '');
  const gear = inlineSettings ? '' : `<button class="icon-btn gear" data-act="settings" title="Ajustes">${I.gear}</button>`;
  popup.innerHTML = gear + (isMini ? renderIOSMini(al, col) : renderers[state.skin](al, col));
  popup.querySelectorAll('canvas[data-art]').forEach(cv => drawImageCover(cv.getContext('2d'), cv.width, cv.height, coverImg));
  bindControls();
  syncSettings();
  lastSkin = state.skin;
  if (swap) { popup.classList.remove('swap-anim'); void popup.offsetWidth; popup.classList.add('swap-anim'); }
  if (likeJustToggled) {
    likeJustToggled = false;
    popup.querySelectorAll('[data-act="like"]').forEach(b=>{ b.classList.remove('heart-pop'); void b.offsetWidth; b.classList.add('heart-pop'); });
  }
}

// resize the OS window to fit the current skin (+ settings panel when open),
// place the popup/panel inside, and pin the notch to the top of the screen.
let lastWinW = 0, lastWinH = 0;
let resizing = false;
async function layout() {
  popup.style.transform = ''; // clear tilt so measurements are clean
  const pr = popup.getBoundingClientRect();
  const pw = Math.ceil(pr.width), ph = Math.ceil(pr.height);
  const gap = 14, panelW = 300;
  let winW, winH;

  if (state.settingsOpen) {
    const panelH = Math.ceil(settingsEl.offsetHeight) || 360;
    winW = MARGIN + pw + gap + panelW + MARGIN;
    winH = MARGIN * 2 + Math.max(ph, panelH);
    popup.style.left = MARGIN + 'px';
    popup.style.top = Math.round((winH - ph) / 2) + 'px';
    settingsEl.style.left = (MARGIN + pw + gap) + 'px';
    settingsEl.style.top = Math.round((winH - panelH) / 2) + 'px';
  } else {
    winW = pw + MARGIN * 2;
    winH = ph + MARGIN * 2;
    popup.style.left = MARGIN + 'px';
    popup.style.top = MARGIN + 'px';
  }

  if (winW === lastWinW && winH === lastWinH) return;
  lastWinW = winW; lastWinH = winH;
  resizing = true;
  try {
    await appWindow.setSize(new LogicalSize(winW, winH));
    // use the monitor the window is CURRENTLY on (not the primary), so dragging
    // it to another display doesn't yank it back
    const mon = (await currentMonitor()) || (await primaryMonitor());
    if (mon) {
      const sf = mon.scaleFactor || 1;
      const sw = mon.size.width / sf, sh = mon.size.height / sf;
      const mx = mon.position.x / sf, my = mon.position.y / sf;
      if (state.skin === 'notch' && state.authed && state.track) {
        // pin the notch to the top-center of the CURRENT display
        await appWindow.setPosition(new LogicalPosition(Math.round(mx + (sw - winW) / 2), Math.round(my)));
      } else {
        // only nudge back if it would actually fall off the current screen
        const pos = await appWindow.outerPosition();
        let x = pos.x / sf, y = pos.y / sf;
        let nx = x, ny = y;
        if (x + winW > mx + sw) nx = mx + sw - winW - 8;
        if (y + winH > my + sh) ny = my + sh - winH - 8;
        if (nx < mx + 8) nx = mx + 8;
        if (ny < my + 8) ny = my + 8;
        if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) {
          await appWindow.setPosition(new LogicalPosition(Math.round(nx), Math.round(ny)));
        }
      }
    }
  } catch (e) { console.error('layout', e); }
  resizing = false;
}

// ---------- actions ----------
function bindControls() {
  popup.querySelectorAll('[data-act]').forEach(el => {
    el.addEventListener('click', async e => {
      const act = el.dataset.act;
      if (act==='play') {
        state.playing = !state.playing; render();
        try { await invoke('set_playing', { play: state.playing }); } catch(err){ console.error(err); }
      } else if (act==='next') {
        try { await invoke('next_track'); } catch(err){ console.error(err); }
        setTimeout(poll, 350);
      } else if (act==='prev') {
        try { await invoke('prev_track'); } catch(err){ console.error(err); }
        setTimeout(poll, 350);
      } else if (act==='like') {
        if (!state.track) return;
        state.liked = !state.liked; likeJustToggled = true; render();
        try { await invoke('set_like', { trackId: state.track.id, liked: state.liked }); } catch(err){ console.error(err); }
      } else if (act==='settings') {
        state.settingsOpen = !state.settingsOpen; syncSettings();
      } else if (act==='seek') {
        if (!state.track) return;
        const r = el.getBoundingClientRect();
        const frac = Math.min(1, Math.max(0, (e.clientX - r.left)/r.width));
        const positionMs = Math.round(frac * state.track.durSec * 1000);
        state.track.curSec = Math.round(positionMs/1000); render();
        try { await invoke('seek', { positionMs }); } catch(err){ console.error(err); }
      } else if (act==='login') {
        el.textContent = 'Abriendo Spotify…'; el.disabled = true;
        try { await invoke('login'); state.authed = true; await poll(); render(true); }
        catch(err){ console.error(err); el.textContent = 'Reintentar'; el.disabled = false; }
      } else if (act==='save-id') {
        const input = popup.querySelector('#clientIdInput');
        const id = (input?.value || '').trim();
        if (!id) return;
        try { await invoke('set_client_id', { clientId: id }); state.hasClientId = true; render(true); }
        catch(err){ console.error(err); }
      } else if (act==='logout') {
        await invoke('logout'); state.authed=false; state.track=null; render(true);
      } else if (act==='lyrics') {
        alert('Letra: pendiente de integrar un proveedor de letras.');
      } else if (act==='video') {
        alert('Vídeo: la API pública de Spotify no expone vídeo/canvas todavía.');
      }
    });
  });
}

scrimEl.addEventListener('click', ()=>{ state.settingsOpen=false; syncSettings(); });

// ---------- Apple-style tilt ----------
let tiltRAF = null;
popup.addEventListener('pointermove', e => {
  if (state.skin==='notch' || !state.authed || !state.track) return;
  const r = popup.getBoundingClientRect();
  const px = (e.clientX - r.left)/r.width - 0.5, py = (e.clientY - r.top)/r.height - 0.5;
  if (tiltRAF) cancelAnimationFrame(tiltRAF);
  tiltRAF = requestAnimationFrame(()=>{ popup.style.transform = `perspective(1000px) rotateY(${px*4}deg) rotateX(${-py*4}deg)`; });
});
popup.addEventListener('pointerleave', ()=>{ popup.style.transform=''; });

// ---------- drag the OS window from anywhere on the popup ----------
popup.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (e.target.closest('[data-act]') || e.target.closest('input')) return; // keep controls clickable
  appWindow.startDragging();
});
window.addEventListener('resize', ()=>{ layout(); });

// ---------- polling Spotify ----------
let lastTrackId = null;
async function poll() {
  try {
    const np = await invoke('now_playing'); // null | {id,title,artist,album,image,duration_ms,progress_ms,is_playing,liked}
    if (!np) {
      const had = !!state.track;
      state.track = null;
      if (had) render(true);
      return;
    }
    console.debug('[poptify] now_playing:', np.title, '| playing=', np.is_playing, '| liked=', np.liked);
    const trackChanged = np.id !== lastTrackId;
    state.playing = np.is_playing;
    state.liked = np.liked;
    state.track = {
      id: np.id, title: np.title, artist: np.artist,
      durSec: Math.round(np.duration_ms/1000), curSec: Math.round(np.progress_ms/1000),
      image: np.image,
    };
    if (trackChanged) {
      lastTrackId = np.id;
      await loadCover(np.image);
      render(true);
    } else {
      render(false);
    }
  } catch (err) {
    console.error('poll error', err);
  }
}

// local 1s ticker advances progress between polls (smoother bar)
setInterval(() => {
  if (state.authed && state.track && state.playing) {
    state.track.curSec = Math.min(state.track.durSec, state.track.curSec + 1);
    render(false);
  }
}, 1000);

// poll the API a bit less often (avoid hammering)
setInterval(poll, 3000);

// ---------- boot ----------
async function boot() {
  try {
    state.hasClientId = await invoke('has_client_id');
    state.authed = await invoke('auth_status');
  } catch (err) { console.error('boot error', err); }
  if (state.authed) await poll();
  render(true);
}
boot();
