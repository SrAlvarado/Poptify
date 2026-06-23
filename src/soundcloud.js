// SoundCloud integration via the official HTML5 Widget API.
// Poptify acts as the player: load a SoundCloud URL (track / playlist / likes)
// and control it. No API credentials needed.
//
// Docs: https://developers.soundcloud.com/docs/api/html5-widget

const API_SCRIPT = 'https://w.soundcloud.com/player/api.js';

let scriptPromise = null;
function loadApi() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.SC && window.SC.Widget) return resolve(window.SC);
    const s = document.createElement('script');
    s.src = API_SCRIPT;
    s.onload = () => resolve(window.SC);
    s.onerror = () => reject(new Error('no se pudo cargar el widget de SoundCloud'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// upgrade artwork resolution (SoundCloud serves small art by default)
function bigArtwork(url) {
  if (!url) return '';
  return url.replace('-large.', '-t500x500.');
}

export function createSoundCloud({ onUpdate }) {
  let widget = null;
  let ready = false;
  let pendingUrl = null;
  const snap = {
    track: null,     // { id, title, artist, durSec, curSec, image, artworkUrl }
    playing: false,
    loaded: false,
  };

  // hidden iframe that hosts the actual SoundCloud player
  const iframe = document.createElement('iframe');
  iframe.id = 'sc-widget';
  iframe.allow = 'autoplay';
  iframe.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  async function refreshSound() {
    if (!ready) return;
    widget.getCurrentSound((sound) => {
      if (!sound) return;
      snap.track = {
        id: 'sc:' + (sound.id || sound.permalink_url || ''),
        title: sound.title || '—',
        artist: (sound.user && sound.user.username) || '—',
        durSec: Math.round((sound.duration || 0) / 1000),
        curSec: snap.track ? snap.track.curSec : 0,
        artworkUrl: bigArtwork(sound.artwork_url || (sound.user && sound.user.avatar_url) || ''),
        image: '', // filled in by main.js via the Rust image fetcher (CORS-safe)
      };
      snap.loaded = true;
      onUpdate('track');
    });
  }

  function init() {
    if (widget || !window.SC) return;
    widget = window.SC.Widget(iframe);
    const E = window.SC.Widget.Events;
    widget.bind(E.READY, () => {
      ready = true;
      snap.loaded = true;
      refreshSound();
      if (pendingUrl) { doLoad(pendingUrl); pendingUrl = null; }
    });
    widget.bind(E.PLAY, () => { snap.playing = true; refreshSound(); onUpdate('play'); });
    widget.bind(E.PAUSE, () => { snap.playing = false; onUpdate('pause'); });
    widget.bind(E.FINISH, () => { snap.playing = false; onUpdate('finish'); });
    widget.bind(E.PLAY_PROGRESS, (e) => {
      if (snap.track && e && typeof e.currentPosition === 'number') {
        snap.track.curSec = Math.round(e.currentPosition / 1000);
      }
    });
  }

  function doLoad(url) {
    widget.load(url, {
      auto_play: true,
      callback: () => { snap.loaded = true; refreshSound(); onUpdate('loaded'); },
    });
  }

  return {
    async load(url) {
      await loadApi();
      if (!widget) {
        // first time: point the iframe at the player, then create the widget
        iframe.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) +
          '&auto_play=true&hide_related=true&show_comments=false&show_user=true&visual=false';
        await new Promise((r) => { iframe.onload = r; setTimeout(r, 1500); });
        init(); // READY → ready=true + refreshSound; PLAY flows from auto_play
      } else if (ready) {
        doLoad(url); // swap track without recreating the iframe
      } else {
        pendingUrl = url;
      }
    },
    play()  { if (ready) widget.play(); },
    pause() { if (ready) widget.pause(); },
    toggle() { if (!ready) return; snap.playing ? widget.pause() : widget.play(); },
    next()  { if (ready) widget.next(); },
    prev()  { if (ready) widget.prev(); },
    seekSec(sec) { if (ready) widget.seekTo(Math.round(sec * 1000)); },
    state() { return snap; },
  };
}
