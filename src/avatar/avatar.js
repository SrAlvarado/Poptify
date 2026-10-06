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
// Las etiquetas llegan ordenadas por relevancia (la más votada primero): manda la primera que
// encaje. Dentro de una etiqueta, el orden de las reglas desempata ("latin trap" es trap, "pop rap" es rap).
// Deezer las devuelve traducidas según el país: también van en español.
const RULES = [
  ['trap', /trap|drill|rage|plugg/],
  ['reggaeton', /reggaet|urbano|dembow|perreo|latin|bachata|dancehall|moombah|salsa/],
  ['rap', /hip[ -]?hop|rap|boom bap|grime/],
  ['techno', /techno|house|edm|electr|trance|minimal|rave|drum and bass|dnb|dubstep|garage|hardstyle|club/],
  ['rock', /rock|punk|metal|emo|grunge|hardcore|post-punk|alternativ/],
  ['lofi', /lo-?fi|chill|ambient|indie|acoustic|jazz|soul|funk|sleep|study|bedroom|singer-songwriter|mellow|relax|r&b|rnb/],
  ['pop', /pop|dance|disco|k-?pop|europop/],
];
// etiquetas de ambiente (Last.fm, por canción): si una de las 5 más votadas dice que es tranquila,
// manda sobre el género ("A Mí" de Rels B es latin, pero se baila chill)
const MOOD_CHILL = /^(chill|chillout|chill out|mellow|relax|relaxing|calm|soft|slow|lo-?fi|sad|sleep|smooth)$/;
export function styleFromGenres(genres) {
  if ((genres || []).slice(0, 5).some((g) => MOOD_CHILL.test(g.toLowerCase().trim()))) return 'lofi';
  for (const g of genres || []) {
    const t = g.toLowerCase();
    for (const [style, re] of RULES) if (re.test(t)) return style;
  }
  return null;
}
// estilo → baile (rock no tiene baile propio todavía: usa el del techno)
const DANCE = { rap: 'rap', trap: 'trap', reggaeton: 'reggaeton', techno: 'techno', pop: 'pop', rock: 'techno', lofi: 'chill' };
export const STYLES = ['rap', 'trap', 'reggaeton', 'techno', 'pop', 'rock', 'lofi'];
export const DANCES = ['rap', 'trap', 'reggaeton', 'techno', 'pop', 'chill'];

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
  if (pose === 'chill') return bpm > 100 ? bpm / 2 : bpm;
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

  // el estilo se guarda por canción: con Last.fm las etiquetas son de cada tema, no del artista
  async function loadStyle(track) {
    const artist = (track.artist || '').split(',')[0].trim();
    const key = track.id;
    if (!key) { st.style = null; return; }
    if (!(key in genreCache)) {
      try {
        const style = styleFromGenres(await invoke('artist_genres', { artistId: track.artistId || '', artist, title: track.title || '' }));
        if (style) genreCache[key] = style;           // sin resultado no se cachea: se reintenta con la próxima canción
        else if (st.trackId === track.id) { st.style = null; refresh(); return; }
      } catch (e) { return; }
    }
    if (st.trackId === track.id) { st.style = genreCache[key]; refresh(); }
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
        st.trackId = id; st.artistId = track ? track.artistId || (track.artist || '').split(',')[0].trim() || null : null;
        st.style = id && id in genreCache ? genreCache[id] : null;
        st.lucha = !!id && Math.random() < 0.03;           // easter egg: de vez en cuando sale de luchador
        if (id) st.jumpUntil = now + 1300;
        if (track) loadStyle(track);
      }
      if (liked && !st.liked && id) st.jumpUntil = now + 1100;
      if (playing !== st.playing) st.pausedSince = now;
      st.playing = playing; st.liked = liked;
      refresh();
    },
    html: () => svg(),
    // tras cambiar la clave de Last.fm: olvida lo aprendido y vuelve a pedir el estilo de la canción actual
    refreshGenres(track) { for (const k in genreCache) delete genreCache[k]; st.style = null; if (track) loadStyle(track); },
    mount(el) { stageEl = el; C().furrify(el); },
    feedAudio(levels) { beat.feed(levels.bass); },
    prefs,
    set(key, val) { prefs[key] = val; localStorage.setItem(key === 'outfit' ? 'avatarOutfit' : 'avatarDance', val); st.shownKey = ''; refresh(); onChange && onChange(); },
    info: () => ({ style: st.style, pose: pose(), bpm: beat.bpm() }),
    outfitLabels: () => Object.keys(OUT()).filter((k) => OUT()[k].label).map((k) => [k, OUT()[k].label]),
  };
}
