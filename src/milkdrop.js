// Milkdrop background via Butterchurn (WebGL port of the Winamp visualizer, MIT).
// Audio comes from the shared tap in hydra.js (getWave()): we inject the raw
// time-domain waveform with updateAudio(), so no AudioContext ever touches an
// input device — playback quality stays untouched.
// Lazy-loaded like hydra-synth so a load failure can't blank the app at startup.

import * as Hydra from './hydra.js';

let visualizer = null, canvas = null, raf = null;
let statusCb = null, lastError = '', names = [];
let currentPreset = '';

export function onStatus(fn) { statusCb = fn; }
export function getError() { return lastError; }
export function isReady() { return !!visualizer; }
export function presetNames() { return names; }

function makeCanvas() {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.id = 'milkdrop-canvas';
  canvas.width = 480; canvas.height = 480;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;';
  return canvas;
}

let ensuring = null;
async function ensure() {
  if (visualizer) return;
  if (ensuring) return ensuring;
  ensuring = (async () => {
    makeCanvas();
    const [bc, pr] = await Promise.all([import('butterchurn'), import('butterchurn-presets')]);
    const butterchurn = bc.default || bc;
    const presetLib = pr.default || pr;
    const presets = presetLib.getPresets();
    names = Object.keys(presets);
    // this AudioContext is only Butterchurn's internal clock — nothing connects to it
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    visualizer = butterchurn.createVisualizer(ctx, canvas, { width: 480, height: 480, pixelRatio: 1 });
    const saved = localStorage.getItem('milkdropPreset');
    currentPreset = (saved && presets[saved]) ? saved : names[Math.floor(names.length / 2)];
    visualizer.loadPreset(presets[currentPreset], 0);
    loop();
    lastError = '';
    console.debug('[poptify] butterchurn ready,', names.length, 'presets');
    if (statusCb) statusCb();
  })().catch(e => {
    lastError = (e && e.message) || String(e);
    console.error('[poptify] butterchurn init failed', e);
    if (statusCb) statusCb();
  });
  return ensuring;
}

export function getCanvas() { makeCanvas(); ensure(); return canvas; }
export function getPreset() { return currentPreset; }

export async function setPreset(name, blendSec = 2.7) {
  await ensure();
  if (!visualizer) return;
  const pr = await import('butterchurn-presets');
  const presets = (pr.default || pr).getPresets();
  if (!presets[name]) return;
  currentPreset = name;
  localStorage.setItem('milkdropPreset', name);
  visualizer.loadPreset(presets[name], blendSec);
}

export function randomPreset() {
  if (!names.length) return;
  setPreset(names[Math.floor(Math.random() * names.length)]);
  if (statusCb) statusCb();
}

function loop() {
  const w = Hydra.getWave();
  if (w && w.l && w.l.length) {
    const n = w.l.length;
    const mix = new Uint8Array(n);
    for (let i = 0; i < n; i++) mix[i] = (w.l[i] + w.r[i]) >> 1;
    visualizer.audio.updateAudio(mix, w.l, w.r);
  }
  try { visualizer.render(); } catch (e) { /* keep looping through bad frames */ }
  raf = requestAnimationFrame(loop);
}

export function stop() {
  if (raf) cancelAnimationFrame(raf), raf = null;
}
export function resume() {
  if (visualizer && !raf) loop();
}
