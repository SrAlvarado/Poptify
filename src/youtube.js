// YouTube integration via the official IFrame Player API.
// Poptify acts as the player: paste a YouTube video URL and it plays *with its
// video* shown where the album art normally is. It's an independent source
// (like SoundCloud) — its own audio, its own metadata. No API key needed.
//
// Docs: https://developers.google.com/youtube/iframe_api_reference
//
// The player iframe lives in a fixed-position "stage" overlaid on the art slot
// (main.js positions it). We never re-parent the iframe — moving a YouTube
// iframe in the DOM reloads it — so the stage just floats over the cover.

const API_SCRIPT = 'https://www.youtube.com/iframe_api';

let scriptPromise = null;
function loadApi() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) try { prev(); } catch {} resolve(window.YT); };
    const s = document.createElement('script');
    s.src = API_SCRIPT;
    s.onerror = () => reject(new Error('no se pudo cargar el reproductor de YouTube'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// Pull the 11-char video id out of any youtube URL shape (watch, youtu.be,
// shorts, embed) — or accept a bare id.
export function parseVideoId(input) {
  if (!input) return '';
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1, 12);
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch {
    const m = s.match(/[a-zA-Z0-9_-]{11}/);
    if (m) return m[0];
  }
  return '';
}

export function createYouTube({ onUpdate }) {
  let player = null;
  let ready = false;
  let pendingId = null;
  let progressTimer = null;
  const snap = {
    track: null,    // { id, title, artist, durSec, curSec, image, thumbUrl }
    playing: false,
    loaded: false,
  };

  // fixed "stage" that floats over the art slot; main.js sizes/places it
  const stage = document.createElement('div');
  stage.id = 'yt-stage';
  stage.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;z-index:40;overflow:hidden;pointer-events:none;display:none;background:#000;';
  const mount = document.createElement('div');
  mount.id = 'yt-player';
  stage.appendChild(mount);
  document.body.appendChild(stage);

  function startProgress() {
    stopProgress();
    progressTimer = setInterval(() => {
      if (player && snap.track && snap.playing && player.getCurrentTime) {
        snap.track.curSec = Math.round(player.getCurrentTime());
      }
    }, 500);
  }
  function stopProgress() { if (progressTimer) { clearInterval(progressTimer); progressTimer = null; } }

  function refreshMeta() {
    if (!ready || !player.getVideoData) return;
    const d = player.getVideoData() || {};
    const id = d.video_id || (snap.track && snap.track.id) || '';
    snap.track = {
      id: 'yt:' + id,
      title: d.title || '—',
      artist: d.author || 'YouTube',
      durSec: Math.round((player.getDuration && player.getDuration()) || 0),
      curSec: snap.track ? snap.track.curSec : 0,
      thumbUrl: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '',
      image: '', // filled by main.js via the Rust image fetcher (CORS-safe)
    };
    snap.loaded = true;
    onUpdate('track');
  }

  function create(id) {
    player = new window.YT.Player(mount, {
      videoId: id,
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0 },
      events: {
        onReady: () => {
          ready = true; snap.loaded = true;
          try { player.playVideo(); } catch {}
          refreshMeta(); startProgress();
          if (pendingId) { player.loadVideoById(pendingId); pendingId = null; }
        },
        onStateChange: (e) => {
          const Y = window.YT.PlayerState;
          if (e.data === Y.PLAYING) { snap.playing = true; refreshMeta(); onUpdate('play'); }
          else if (e.data === Y.PAUSED) { snap.playing = false; onUpdate('pause'); }
          else if (e.data === Y.ENDED) { snap.playing = false; onUpdate('finish'); }
          else if (e.data === Y.CUED) { refreshMeta(); onUpdate('loaded'); }
        },
      },
    });
  }

  return {
    el() { return stage; },           // the floating stage (main.js positions it)
    async load(url) {
      const id = parseVideoId(url);
      if (!id) throw new Error('URL de YouTube no válida');
      await loadApi();
      if (!player) create(id);
      else if (ready) { player.loadVideoById(id); snap.playing = true; refreshMeta(); onUpdate('loaded'); }
      else pendingId = id;
    },
    play()  { if (ready) player.playVideo(); },
    pause() { if (ready) player.pauseVideo(); },
    toggle() { if (!ready) return; snap.playing ? player.pauseVideo() : player.playVideo(); },
    next()  {},   // single video — no playlist navigation
    prev()  { if (ready && player.seekTo) player.seekTo(0, true); },
    seekSec(sec) { if (ready && player.seekTo) player.seekTo(Math.round(sec), true); },
    state() { return snap; },
  };
}
