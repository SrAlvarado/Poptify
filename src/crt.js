// Real CRT/fisheye for the album art: a WebGL barrel-distortion shader with
// scanlines, vignette and a touch of chromatic aberration. Used by the "CRT"
// skin on the cover canvas (Spotify / SoundCloud). For a YouTube video the
// iframe can't be sampled cross-origin, so main.js falls back to CSS curvature.
//
// One persistent WebGL context lives on an internal offscreen canvas; the
// result is blitted onto the visible 2D cover canvas. This avoids spawning a
// new GL context on every re-render (browsers cap them at ~16).

const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;

const FRAG = `precision mediump float; varying vec2 uv; uniform sampler2D tex;
vec2 bulge(vec2 c){
  vec2 cc = c - 0.5;
  float d = dot(cc, cc);
  return c + cc * d * 0.28;          // curvature amount
}
void main(){
  vec2 w = bulge(uv);
  if (w.x < 0.0 || w.x > 1.0 || w.y < 0.0 || w.y > 1.0){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
  vec2 cc = (w - 0.5);
  vec3 col;
  col.r = texture2D(tex, w + cc * 0.006).r;
  col.g = texture2D(tex, w).g;
  col.b = texture2D(tex, w - cc * 0.006).b;
  float sl = 0.86 + 0.14 * sin(w.y * 540.0);      // scanlines
  col *= sl;
  float m = 0.92 + 0.08 * sin(w.x * 900.0);        // phosphor mask
  col *= m;
  float v = smoothstep(0.85, 0.35, length(cc));    // vignette
  col *= 0.55 + 0.45 * v;
  col = pow(col, vec3(0.92));                       // gentle lift
  gl_FragColor = vec4(col, 1.0);
}`;

let GL = null;       // persistent { gl, tex, glCanvas }
let off = null;      // offscreen 2D canvas to cover-fit the image
let offc = null;

function init() {
  const glCanvas = document.createElement('canvas');
  const gl = glCanvas.getContext('webgl', { antialias: true });
  if (!gl) return false;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  GL = { gl, tex, glCanvas };
  off = document.createElement('canvas');
  offc = off.getContext('2d');
  return true;
}

// cover-fit an image into a w*h 2D canvas (same math as drawImageCover)
function coverInto(c, w, h, img) {
  c.canvas.width = w; c.canvas.height = h;
  if (!img) { c.fillStyle = '#101014'; c.fillRect(0, 0, w, h); return; }
  const ir = img.width / img.height, r = w / h;
  let sw, sh, sx, sy;
  if (ir > r) { sh = img.height; sw = sh * r; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / r; sx = 0; sy = (img.height - sh) / 2; }
  c.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

// Render the (cover-fit) image into `canvas` through the CRT shader.
// Returns false if WebGL is unavailable so the caller can fall back to 2D.
export function renderCRT(canvas, img) {
  if (!GL && init() === false) return false;
  const { gl, tex, glCanvas } = GL;
  const w = canvas.width, h = canvas.height;
  if (glCanvas.width !== w || glCanvas.height !== h) { glCanvas.width = w; glCanvas.height = h; }
  coverInto(offc, w, h, img);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // blit the GL result onto the visible 2D cover canvas
  canvas.getContext('2d').drawImage(glCanvas, 0, 0);
  return true;
}
