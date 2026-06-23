// Hydra (hydra-synth) reactive background.
// Driven by: album colors + song progress, and optionally real audio
// (FFT bands) captured from a chosen input device — e.g. a BlackHole
// loopback device so it reacts to system audio even through headphones.

import Hydra from 'hydra-synth';

// shared live values the sketches read every frame
const dyn = {
  t: 0,
  progress: 0,
  audioOn: false,
  audio: { level: 0, bass: 0, mid: 0, treble: 0 },
};

let hydra = null, h = null, canvas = null, rafT = null;
let currentSketch = 'andromeda';
let currentColors = { d: [0.4, 0.4, 0.6], a: [0.2, 0.2, 0.3] };

function normColors(col) {
  return { d: col.dom.map(v => v / 255), a: col.avg.map(v => v / 255) };
}

// ---------- sketches: (h, c) build the chain; read dyn.* in arrow args ----------
export const SKETCHES = [
  { id: 'andromeda', name: 'Andrómeda' },
  { id: 'nebula', name: 'Nebulosa' },
  { id: 'waves', name: 'Ondas' },
  { id: 'kaleido', name: 'Caleidoscopio' },
];

const BUILD = {
  andromeda(h, c) {
    const [r, g, b] = c.d, [r2, g2, b2] = c.a;
    h.voronoi(() => 4 + dyn.audio.bass * 8, () => 0.15 + dyn.progress * 0.3, 0.3)
      .color(r * 1.3, g * 1.3, b * 1.3)
      .modulate(h.osc(() => 2 + dyn.audio.mid * 4, 0.1).rotate(() => dyn.t * 0.05))
      .add(h.gradient(0).color(r2, g2, b2).rotate(() => dyn.t * 0.02), 0.3)
      .scale(() => 1 + dyn.audio.level * 0.4)
      .out(h.o0);
  },
  nebula(h, c) {
    const [r, g, b] = c.d, [r2, g2, b2] = c.a;
    h.noise(() => 3 + dyn.audio.bass * 4, 0.12)
      .color(r, g, b)
      .add(h.noise(6, 0.05).color(r2, g2, b2), 0.5)
      .modulateScale(h.osc(() => 1 + dyn.audio.mid * 3).rotate(() => dyn.t * 0.03), 0.4)
      .contrast(1.3)
      .brightness(() => -0.1 + dyn.audio.level * 0.2)
      .out(h.o0);
  },
  waves(h, c) {
    const [r, g, b] = c.d, [r2, g2, b2] = c.a;
    h.osc(() => 8 + dyn.audio.treble * 10, 0.0, () => 0.6 + dyn.progress)
      .color(r, g, b)
      .modulate(h.osc(3, 0.1).rotate(() => dyn.t * 0.04), () => 0.2 + dyn.audio.bass * 0.6)
      .add(h.solid(r2, g2, b2, 1), 0.25)
      .kaleid(() => 2 + Math.round(dyn.audio.mid * 4))
      .scrollY(() => dyn.t * 0.01)
      .out(h.o0);
  },
  kaleido(h, c) {
    const [r, g, b] = c.d, [r2, g2, b2] = c.a;
    h.shape(() => 3 + Math.round(dyn.audio.bass * 6), 0.3, 0.05)
      .color(r, g, b)
      .repeat(2, 2)
      .modulateRotate(h.osc(2).rotate(() => dyn.t * 0.05))
      .add(h.gradient(0).color(r2, g2, b2), 0.3)
      .kaleid(() => 4 + Math.round(dyn.progress * 6))
      .scale(() => 1 + dyn.audio.level * 0.3)
      .out(h.o0);
  },
};

export function ensure() {
  if (hydra) return;
  canvas = document.createElement('canvas');
  canvas.id = 'hydra-canvas';
  canvas.width = 480; canvas.height = 480;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;';
  hydra = new Hydra({ canvas, detectAudio: false, makeGlobal: false, autoLoop: true, width: 480, height: 480 });
  h = hydra.synth;
  applySketch(currentSketch, null);
  const tick = () => { dyn.t += 0.016; rafT = requestAnimationFrame(tick); };
  tick();
}

export function getCanvas() { ensure(); return canvas; }

export function applySketch(id, colors) {
  ensure();
  if (id) currentSketch = id;
  if (colors) currentColors = normColors(colors);
  (BUILD[currentSketch] || BUILD.andromeda)(h, currentColors);
}

export function setColors(colors) { applySketch(currentSketch, colors); }
export function setProgress(p) { dyn.progress = Math.max(0, Math.min(1, p || 0)); }

// ---------- audio capture (BlackHole / any input device) ----------
let audioCtx = null, analyser = null, srcNode = null, stream = null, rafA = null, freq = null;

export async function listInputs() {
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter(d => d.kind === 'audioinput').map(d => ({ id: d.deviceId, label: d.label || 'Entrada de audio' }));
  } catch (e) { return []; }
}

export async function startAudio(deviceId) {
  stopAudio();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    video: false,
  });
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  srcNode = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.82;
  srcNode.connect(analyser);
  freq = new Uint8Array(analyser.frequencyBinCount);
  const n = freq.length;
  const b1 = Math.floor(n * 0.08), b2 = Math.floor(n * 0.4);
  const loop = () => {
    analyser.getByteFrequencyData(freq);
    let bass = 0, mid = 0, tre = 0, all = 0;
    for (let i = 0; i < n; i++) { all += freq[i]; if (i < b1) bass += freq[i]; else if (i < b2) mid += freq[i]; else tre += freq[i]; }
    dyn.audio.level = (all / n) / 255;
    dyn.audio.bass = (bass / Math.max(1, b1)) / 255;
    dyn.audio.mid = (mid / Math.max(1, b2 - b1)) / 255;
    dyn.audio.treble = (tre / Math.max(1, n - b2)) / 255;
    rafA = requestAnimationFrame(loop);
  };
  loop();
  dyn.audioOn = true;
}

export function stopAudio() {
  if (rafA) cancelAnimationFrame(rafA), rafA = null;
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close().catch(() => {});
  audioCtx = analyser = srcNode = stream = freq = null;
  dyn.audioOn = false;
  dyn.audio = { level: 0, bass: 0, mid: 0, treble: 0 };
}

export function audioActive() { return dyn.audioOn; }
