// System-audio tap (macOS 13+, ScreenCaptureKit).
//
// Passive copy of the OS mixer output: the music keeps flowing to the normal
// output device untouched (no BlackHole, no Multi-Output, no HFP downgrade on
// Bluetooth headphones). We only read the samples to compute FFT bands for the
// Hydra background and a time-domain waveform for Butterchurn, emitted to the
// webview as `audio-frame` events (~30 fps).
//
// Requires the Screen Recording permission (that's the permission that covers
// system audio on macOS).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

const SAMPLE_RATE: i32 = 48_000;
const WIN: usize = 1024; // analysis window (samples per channel)

#[derive(Clone, serde::Serialize)]
pub struct AudioFrame {
    level: f32,
    bass: f32,
    mid: f32,
    treble: f32,
    // unsigned 8-bit time-domain waveform (128 = silence), 1024 samples/channel,
    // exactly what Butterchurn's updateAudio() expects
    wave_l: Vec<u8>,
    wave_r: Vec<u8>,
}

/// Rolling per-channel sample history the SCK callback writes into.
struct Ring {
    l: Vec<f32>,
    r: Vec<f32>,
}

impl Ring {
    fn new() -> Self {
        Ring { l: vec![0.0; WIN], r: vec![0.0; WIN] }
    }
    fn push(&mut self, l: &[f32], r: &[f32]) {
        let keep = |buf: &mut Vec<f32>, new: &[f32]| {
            buf.extend_from_slice(new);
            let overflow = buf.len().saturating_sub(WIN);
            if overflow > 0 {
                buf.drain(..overflow);
            }
        };
        keep(&mut self.l, l);
        keep(&mut self.r, r);
    }
}

#[cfg(target_os = "macos")]
mod mac {
    use super::*;
    use screencapturekit::prelude::*;

    pub struct Tap {
        stream: SCStream,
        pub running: Arc<AtomicBool>,
    }

    struct Handler {
        ring: Arc<Mutex<Ring>>,
    }

    impl SCStreamOutputTrait for Handler {
        fn did_output_sample_buffer(&self, sample: CMSampleBuffer, of_type: SCStreamOutputType) {
            if of_type != SCStreamOutputType::Audio {
                return;
            }
            let Some(list) = sample.audio_buffer_list() else { return };
            let as_f32 = |b: &[u8]| -> Vec<f32> {
                b.chunks_exact(4)
                    .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
                    .collect()
            };
            // SCK delivers non-interleaved f32: one buffer per channel.
            // Fall back to de-interleaving a single stereo buffer just in case.
            let (l, r) = match list.num_buffers() {
                0 => return,
                1 => {
                    let buf = list.get(0).unwrap();
                    let data = as_f32(buf.data());
                    if buf.number_channels >= 2 {
                        let l: Vec<f32> = data.iter().step_by(2).copied().collect();
                        let r: Vec<f32> = data.iter().skip(1).step_by(2).copied().collect();
                        (l, r)
                    } else {
                        (data.clone(), data)
                    }
                }
                _ => (
                    as_f32(list.get(0).unwrap().data()),
                    as_f32(list.get(1).unwrap().data()),
                ),
            };
            if let Ok(mut ring) = self.ring.lock() {
                ring.push(&l, &r);
            }
        }
    }

    pub fn start(ring: Arc<Mutex<Ring>>) -> Result<Tap, String> {
        let content = SCShareableContent::get()
            .map_err(|e| format!("sin permiso de grabación de pantalla/audio: {e}"))?;
        let displays = content.displays();
        let display = displays.first().ok_or("no hay pantallas disponibles")?;
        let filter = SCContentFilter::create()
            .with_display(display)
            .with_excluding_windows(&[])
            .build();
        // audio-only: shrink video to nothing so the tap costs ~zero
        let config = SCStreamConfiguration::new()
            .with_captures_audio(true)
            .with_sample_rate(SAMPLE_RATE)
            .with_channel_count(2)
            .with_width(2)
            .with_height(2)
            .with_queue_depth(3);
        let mut stream = SCStream::new(&filter, &config);
        stream.add_output_handler(Handler { ring }, SCStreamOutputType::Audio);
        stream
            .start_capture()
            .map_err(|e| format!("no se pudo iniciar la captura: {e}"))?;
        Ok(Tap { stream, running: Arc::new(AtomicBool::new(true)) })
    }

    impl Tap {
        pub fn stop(&self) {
            self.running.store(false, Ordering::SeqCst);
            let _ = self.stream.stop_capture();
        }
    }
}

#[cfg(target_os = "macos")]
static TAP: Mutex<Option<mac::Tap>> = Mutex::new(None);

/// Hann-windowed 1024-point FFT → per-band energy mapped like an AnalyserNode
/// (dB range -100..-30 → 0..1) so the Hydra sketches keep their tuned feel.
fn bands(mono: &[f32]) -> (f32, f32, f32, f32) {
    use rustfft::{num_complex::Complex, FftPlanner};
    let n = mono.len();
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(n);
    let mut buf: Vec<Complex<f32>> = mono
        .iter()
        .enumerate()
        .map(|(i, &v)| {
            let w = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / n as f32).cos();
            Complex::new(v * w, 0.0)
        })
        .collect();
    fft.process(&mut buf);
    let half = n / 2;
    let to_unit = |mag: f32| -> f32 {
        let db = 20.0 * (mag.max(1e-10)).log10();
        ((db + 100.0) / 70.0).clamp(0.0, 1.0)
    };
    // ~47 Hz per bin at 48 kHz / 1024
    let hz_per_bin = SAMPLE_RATE as f32 / n as f32;
    let (b_end, m_end) = ((250.0 / hz_per_bin) as usize, (2000.0 / hz_per_bin) as usize);
    let mut acc = [0.0f32; 4]; // bass, mid, treble, all
    let mut cnt = [0u32; 4];
    for (i, c) in buf.iter().enumerate().take(half).skip(1) {
        let u = to_unit(c.norm() * 2.0 / n as f32);
        let band = if i < b_end { 0 } else if i < m_end { 1 } else { 2 };
        acc[band] += u;
        cnt[band] += 1;
        acc[3] += u;
        cnt[3] += 1;
    }
    let avg = |i: usize| if cnt[i] == 0 { 0.0 } else { acc[i] / cnt[i] as f32 };
    (avg(3), avg(0), avg(1), avg(2))
}

fn to_wave(ch: &[f32]) -> Vec<u8> {
    ch.iter()
        .map(|&v| ((v * 127.0 + 128.0).clamp(0.0, 255.0)) as u8)
        .collect()
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn start_audio_tap(app: AppHandle) -> Result<(), String> {
    let mut guard = TAP.lock().unwrap();
    if guard.is_some() {
        return Ok(());
    }
    let ring = Arc::new(Mutex::new(Ring::new()));
    let tap = mac::start(ring.clone())?;
    let running = tap.running.clone();
    *guard = Some(tap);
    drop(guard);

    std::thread::spawn(move || {
        // smoothed band values (same feel as analyser.smoothingTimeConstant)
        let mut sm = [0.0f32; 4];
        while running.load(Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_millis(33));
            let (l, r) = match ring.lock() {
                Ok(g) => (g.l.clone(), g.r.clone()),
                Err(_) => break,
            };
            let mono: Vec<f32> = l.iter().zip(&r).map(|(a, b)| (a + b) * 0.5).collect();
            let (level, bass, mid, treble) = bands(&mono);
            for (s, v) in sm.iter_mut().zip([level, bass, mid, treble]) {
                *s = *s * 0.8 + v * 0.2;
            }
            let frame = AudioFrame {
                level: sm[0],
                bass: sm[1],
                mid: sm[2],
                treble: sm[3],
                wave_l: to_wave(&l),
                wave_r: to_wave(&r),
            };
            let _ = app.emit("audio-frame", &frame);
        }
    });
    Ok(())
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn stop_audio_tap() {
    if let Some(tap) = TAP.lock().unwrap().take() {
        tap.stop();
    }
}

// On non-macOS platforms the frontend falls back to getUserMedia (loopback
// device like VB-Cable / Stereo Mix), same as before.
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn start_audio_tap(_app: AppHandle) -> Result<(), String> {
    Err("tap nativo no disponible en esta plataforma".into())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn stop_audio_tap() {}
