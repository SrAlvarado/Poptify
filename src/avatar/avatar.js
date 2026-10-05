// Modo Avatar: solo se ve a Chupits, que baila según el género de lo que suena.
// - género del artista (Spotify, comando artist_genres) → estilo → baile + outfit
// - tempo real a partir del audio del sistema (onsets del bajo), si el audio reactivo está activo
// - estados: cambio de canción / like → salta · pausa → sentado · pausa larga o nada sonando → aburrido
import './chupits.js';
import './outfits.js';
import './chupits.css';

const C = () => window.Chupits;
const OUT = () => window.ChupitsOutfits;

// ---------- género → estilo ----------
// orden importa: "trap latino" es trap antes que latino; "pop rap" es rap antes que pop
const RULES = [
  ['trap', /trap|drill|rage|plugg/],
  ['reggaeton', /reggaet|urbano|dembow|perreo|latin|bachata|dancehall|moombah/],
  ['rap', /hip ?hop|rap|boom bap|grime/],
  ['techno', /techno|house|edm|electro|trance|minimal|rave|drum and bass|dnb|dubstep|garage|hardstyle|club/],
  ['rock', /rock|punk|metal|emo|grunge|hardcore|post-punk/],
  ['lofi', /lo-?fi|chill|ambient|indie|acoustic|jazz|soul|sleep|study|bedroom/],
  ['pop', /pop|dance|disco|k-?pop|europop|r&b/],
];
export function styleFromGenres(genres) {
  const g = (genres || []).join(' | ').toLowerCase();
  if (!g) return null;
  for (const [style, re] of RULES) if (re.test(g)) return style;
  return null;
}
// estilo → baile (rock y lo-fi no tienen baile propio todavía)
const DANCE = { rap: 'rap', trap: 'trap', reggaeton: 'reggaeton', techno: 'techno', pop: 'pop', rock: 'techno', lofi: 'sit' };
export const STYLES = ['rap', 'trap', 'reggaeton', 'techno', 'pop', 'rock', 'lofi'];
export const DANCES = ['rap', 'trap', 'reggaeton', 'techno', 'pop'];

// ---------- tempo a partir del audio ----------
// Detecta golpes de bajo (subida brusca sobre la media reciente) y estima el BPM con un
// histograma de intervalos entre golpes, plegado a 70–160.
export function createBeatTracker() {
  const hist = [];          // bajo reciente (para la media)
  let onsets = [];          // tiempos de golpe (s)
  let lastOnset = 0, bpm = null;
  return {
    feed(bass) {
      const t = performance.now() / 1000;
      hist.push(bass); if (hist.length > 30) hist.shift();
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      if (bass > mean * 1.3 + 0.03 && t - lastOnset > 0.28) {
        lastOnset = t;
        onsets.push(t);
        onsets = onsets.filter((o) => t - o < 10);
        if (onsets.length >= 6) bpm = estimate(onsets) ?? bpm;
      }
      if (t - lastOnset > 4) bpm = null;      // silencio: volvemos al tempo por defecto
    },
    bpm: () => bpm,
  };
  function estimate(on) {
    const bins = new Map();
    for (let i = 1; i < on.length; i++) for (let k = 1; k <= 2 && i - k >= 0; k++) {
      let b = 60 / ((on[i] - on[i - k]) / k);
      while (b < 70) b *= 2;
      while (b > 160) b /= 2;
      const key = Math.round(b / 2) * 2;
      bins.set(key, (bins.get(key) || 0) + (k === 1 ? 1 : 0.6));
    }
    let best = null, score = 0;
    for (const [k, v] of bins) { const s = v + (bins.get(k - 2) || 0) * 0.5 + (bins.get(k + 2) || 0) * 0.5; if (s > score) { score = s; best = k; } }
    return score >= 3 ? best : null;
  }
}
// cada baile tiene su zona de tempo: el trap va a medio tiempo, el reguetón nunca a 190
function foldFor(pose, bpm) {
  if (!bpm) return null;
  if (pose === 'trap') return bpm > 110 ? bpm / 2 : bpm;
  if (pose === 'reggaeton') return bpm > 130 ? bpm / 2 : bpm;
  if (pose === 'sit' || pose === 'bored' || pose === 'stand') return null;
  return bpm < 80 ? bpm * 2 : bpm;
}

// ---------- controlador ----------
export function createAvatar({ invoke, onChange }) {
  const prefs = {
    outfit: localStorage.getItem('avatarOutfit') || 'auto',   // auto | naked | <id>
    dance: localStorage.getItem('avatarDance') || 'auto',     // auto | <pose>
  };
  const st = {
    trackId: null, artistId: null, playing: false, liked: false,
    style: null, lucha: false,
    jumpUntil: 0, pausedSince: 0,
    shownKey: '', shownBpm: 0,
  };
  const genreCache = {};
  const beat = createBeatTracker();
  let stageEl = null;

  async function loadStyle(artistId, trackId) {
    if (!artistId) { st.style = null; return; }
    if (!(artistId in genreCache)) {
      try { genreCache[artistId] = styleFromGenres(await invoke('artist_genres', { artistId })); }
      catch (e) { genreCache[artistId] = null; }
    }
    if (st.trackId === trackId) { st.style = genreCache[artistId]; refresh(); }
  }

  function pose() {
    const now = performance.now();
    if (!st.trackId) return 'bored';
    if (now < st.jumpUntil) return 'jump';
    if (!st.playing) return now - st.pausedSince > 60000 ? 'bored' : 'sit';
    if (prefs.dance !== 'auto') return prefs.dance;
    return DANCE[st.style] || 'pop';        // sin género conocido: el baile más neutro
  }
  function outfit(p) {
    if (prefs.outfit === 'naked') return null;
    if (prefs.outfit !== 'auto') return prefs.outfit;
    if (st.lucha) return 'lucha';
    if (!st.trackId) return null;
    // el outfit sale del género; si se fuerza un baile, sigue al baile
    if (prefs.dance !== 'auto') return OUT().byPose[prefs.dance] || null;
    return st.style || null;
  }

  function svg() {
    const p = pose();
    const bpm = foldFor(p, beat.bpm()) || undefined;
    st.shownKey = p + '|' + outfit(p); st.shownBpm = bpm || 0;
    return C().render({ pose: p, outfit: outfit(p), bpm });
  }
  // repinta solo el escenario si cambió la pose, el outfit o el tempo (no reconstruye el popup)
  function refresh() {
    if (!stageEl || !stageEl.isConnected) return;
    const p = pose();
    const key = p + '|' + outfit(p);
    const bpm = foldFor(p, beat.bpm()) || 0;
    if (key === st.shownKey && Math.abs(bpm - st.shownBpm) < 4) return;
    if (key === st.shownKey && bpm && st.shownBpm) {
      // solo cambia el tempo: se ajusta --b sin repintar
      const el = stageEl.querySelector('svg.chupits');
      if (el) { el.style.setProperty('--b', (60 / bpm).toFixed(3) + 's'); st.shownBpm = bpm; return; }
    }
    stageEl.innerHTML = svg();
    C().furrify(stageEl);
  }
  setInterval(refresh, 500);

  return {
    // datos de la canción actual (se llama en cada applyActive)
    update(track, playing, liked) {
      const id = track ? track.id : null;
      const now = performance.now();
      if (id !== st.trackId) {
        st.trackId = id; st.artistId = track ? track.artistId || null : null;
        st.style = st.artistId && st.artistId in genreCache ? genreCache[st.artistId] : null;
        st.lucha = !!id && Math.random() < 0.03;           // easter egg: de vez en cuando sale de luchador
        if (id) st.jumpUntil = now + 1300;
        loadStyle(st.artistId, id);
      }
      if (liked && !st.liked && id) st.jumpUntil = now + 1100;
      if (playing !== st.playing) st.pausedSince = now;
      st.playing = playing; st.liked = liked;
      refresh();
    },
    html: () => svg(),
    mount(el) { stageEl = el; C().furrify(el); },
    feedAudio(levels) { beat.feed(levels.bass); },
    prefs,
    set(key, val) { prefs[key] = val; localStorage.setItem(key === 'outfit' ? 'avatarOutfit' : 'avatarDance', val); st.shownKey = ''; refresh(); onChange && onChange(); },
    info: () => ({ style: st.style, pose: pose(), bpm: beat.bpm() }),
    outfitLabels: () => Object.keys(OUT()).filter((k) => OUT()[k].label).map((k) => [k, OUT()[k].label]),
  };
}
