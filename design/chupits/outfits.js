// Outfits de Chupits. Cada outfit rellena huecos del rig y cada hueco se pinta dentro de la pieza que lo mueve:
//   head / headBack (cabeza, coords de la cabeza sin escalar) · ear (oreja de delante) · neck (cuello, sobre el collar)
//   torso / pants (cuerpo) · sleeve(side) / prop / propL (brazos, coords del brazo izquierdo: el derecho es su espejo)
//   shoe(side) (pies: si hay zapatos, los pies se pintan delante del cuerpo)
// Todas las funciones reciben la vista ('tq' | 'front' | 'back'). Los ids ch-* los hace únicos render().
(function () {
  // tela: color plano + sombreado vertical y lateral encima, para que tenga volumen sin filtros
  const CL = (d, fill, extra = '') =>
    `<path d="${d}" fill="${fill}"/><path d="${d}" fill="url(#ch-cloth)"/><path d="${d}" fill="url(#ch-clothx)"/>${extra}`;
  const FOLD = (d, o = 0.35) => `<path d="${d}" fill="none" stroke="#000" stroke-opacity="${o}" stroke-width="1.6" stroke-linecap="round"/>`;
  const LINE = (d, c, w = 2, o = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const front = (v) => v !== 'back';

  // ---------- torso ----------
  const T_TEE  = 'M96 194 C116 184 184 184 204 194 L222 232 C230 262 230 296 226 318 Q150 332 74 318 C70 296 70 262 78 232 Z';
  const T_LONG = 'M96 194 C116 184 184 184 204 194 L222 232 C232 266 232 304 228 332 Q150 346 72 332 C68 304 68 266 78 232 Z';
  const T_JKL  = 'M96 194 C110 188 124 186 136 188 C132 230 132 292 138 334 Q102 338 72 332 C68 304 68 266 78 232 Z';
  const T_JKR  = 'M204 194 C190 188 176 186 164 188 C168 230 168 292 162 334 Q198 338 228 332 C232 304 232 266 222 232 Z';
  const HOOD = (c) => CL('M82 216 C78 186 110 170 150 170 C190 170 222 186 218 216 Q150 196 82 216 Z', c) +
                      FOLD('M96 206 Q150 188 204 206', .45);
  // ---------- mangas (brazo izquierdo) ----------
  const S_SHORT = 'M97 228 C93 250 95 272 97 292 Q126 302 157 292 C155 268 155 248 155 230 Q126 218 97 228 Z';
  const S_LONG  = 'M97 228 C91 262 93 302 95 334 Q126 346 159 334 C157 300 155 262 155 230 Q126 218 97 228 Z';
  const CUFF = (c) => CL('M94 324 Q126 334 160 324 L160 337 Q126 348 94 337 Z', c) + FOLD('M98 330 L158 330', .2);
  const STRIPES = (c) => LINE('M101 236 C97 268 98 300 99 324', c, 2.4) + LINE('M107 234 C103 268 104 300 105 326', c, 2.4) + LINE('M113 233 C109 268 110 300 111 327', c, 2.4);
  // ---------- pantalones ----------
  const P_FULL  = 'M72 296 Q150 310 228 296 C232 322 230 346 224 362 L158 362 L150 336 L142 362 L76 362 C70 346 68 322 72 296 Z';
  const P_LOW   = 'M72 308 Q150 322 228 308 C232 330 230 350 224 364 L158 364 L150 342 L142 364 L76 364 C70 350 68 330 72 308 Z';
  const P_SHORT = 'M72 296 Q150 310 228 296 C230 314 228 328 224 340 L158 342 L150 326 L142 342 L76 340 C72 328 70 314 72 296 Z';
  const P_FLARE = 'M72 296 Q150 310 228 296 C230 324 236 348 246 364 L160 364 L150 334 L140 364 L54 364 C64 348 70 324 72 296 Z';
  const WAIST = (y = 304) => FOLD(`M72 ${y} Q150 ${y + 14} 228 ${y}`, .45);
  const PFOLDS = FOLD('M98 326 Q110 338 102 356 M202 326 Q190 340 198 356 M118 340 Q124 350 120 360 M182 340 Q176 350 180 360', .3);
  const CARGO = (c) => CL('M74 318 L96 316 L98 340 L76 342 Z', c) + CL('M226 318 L204 316 L202 340 L224 342 Z', c) +
                       FOLD('M74 326 L97 324 M226 326 L203 324', .5);
  // ---------- calzado (pie izquierdo; el derecho es su espejo) ----------
  const SOLE = (c, h = 8) => `<path d="M85 352 L145 352 L145 ${352 + h} Q115 ${356 + h} 85 ${352 + h} Z" fill="${c}"/>` + FOLD(`M86 ${352 + h / 2} L144 ${352 + h / 2}`, .2);
  const SNEAKER = (c, sole = '#f2f2f2') =>
    CL('M87 352 C85 338 95 330 109 328 L130 326 C138 326 143 334 143 342 L143 354 L87 354 Z', c) + SOLE(sole) +
    LINE('M110 332 L124 330 M110 338 L126 336', '#c9c9c9', 1.6);
  const HIGHTOP = (c, lace = '#222') =>
    CL('M88 352 C86 340 93 332 99 328 L101 306 L135 306 L137 326 C143 330 145 338 145 344 L145 354 L88 354 Z', c) + SOLE('#ffffff', 8) +
    LINE('M106 312 L128 310 M106 318 L130 316 M106 324 L132 322', lace, 1.8) +
    LINE('M120 324 C116 336 110 340 104 348 M124 324 C128 338 132 342 136 350', lace, 1.4);       // cordones sueltos
  const BOOT = (c) =>
    CL('M90 352 C88 340 95 330 99 326 L99 300 L137 300 L139 326 C145 332 147 340 147 346 L147 354 L90 354 Z', c) +
    `<path d="M86 352 L150 352 L150 362 L86 362 Z" fill="#111"/>` + LINE('M88 358 h6 M98 358 h6 M108 358 h6 M118 358 h6 M128 358 h6 M138 358 h6', '#333', 2) +
    LINE('M106 306 L130 304 M106 314 L130 312 M106 322 L132 320', '#555', 1.6);
  const PLATFORM = (c) => SNEAKER(c, '#d9d9e0') + SOLE('#f3b3d0', 16);
  const SLIDES = () =>
    CL('M98 318 L134 318 L136 350 L96 350 Z', '#f4f4f4') + LINE('M98 326 L134 326 M98 331 L134 331', '#1a1a1a', 2.2) +
    `<path d="M84 352 L146 352 L146 358 Q115 362 84 358 Z" fill="#161616"/>` +
    CL('M90 346 Q115 334 142 346 L142 354 Q115 346 90 354 Z', '#151515') + LINE('M104 344 L126 342', '#fff', 1.4, .8);

  // ---------- cabeza (coords de la cabeza; 'tq' = 3/4 mirando a la derecha) ----------
  const CAP_SIDE = (c, logo) => (v) =>
    v === 'tq'
      ? CL('M94 104 C92 70 120 52 152 52 C186 52 212 72 214 104 Q154 90 94 104 Z', c) +
        CL('M98 102 Q74 96 54 106 Q48 116 58 119 Q80 116 106 110 Z', c) +            // visera de lado, a la izquierda
        FOLD('M152 52 Q130 70 122 100 M152 52 Q176 70 186 96', .35) + `<circle cx="152" cy="52" r="3.5" fill="${c}"/>` +
        (logo ? `<text x="170" y="90" font-family="Georgia,serif" font-weight="900" font-size="20" fill="url(#ch-gold)">P</text>` : '')
      : CL('M90 106 C88 70 120 56 150 56 C180 56 212 70 210 106 Q150 92 90 106 Z', c) +
        CL('M94 104 Q68 98 48 110 Q42 120 52 122 Q76 118 102 112 Z', c) +
        (v === 'front' && logo ? `<text x="140" y="94" font-family="Georgia,serif" font-weight="900" font-size="20" fill="url(#ch-gold)">P</text>` : '');
  const BUCKET = (c, band, dots) => (v) => {
    const tq = v === 'tq';
    const crown = tq ? 'M104 94 C102 64 128 50 154 50 C182 50 202 64 204 94 Z' : 'M100 96 C98 66 124 52 150 52 C176 52 202 66 200 96 Z';
    const brim = tq ? 'M78 98 Q150 80 228 98 Q236 110 222 114 Q150 98 82 114 Q70 110 78 98 Z' : 'M74 100 Q150 82 226 100 Q234 112 220 116 Q150 100 80 116 Q66 112 74 100 Z';
    return CL(crown, c) + (dots ? `<g fill="${dots}" opacity=".9">` + [[120, 70], [140, 60], [160, 66], [182, 74], [130, 84], [170, 86], [150, 78]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2"/>`).join('') + `</g>` : '') +
      CL(tq ? 'M103 88 Q154 80 205 88 L205 95 Q154 87 103 95 Z' : 'M99 90 Q150 82 201 90 L201 97 Q150 89 99 97 Z', band) + CL(brim, c);
  };
  const DURAG = (v) => v === 'back'
    ? CL('M90 112 C88 74 116 56 150 56 C184 56 212 74 210 112 Z', '#16141a')
    : CL('M88 114 C86 76 116 54 150 54 C188 56 214 80 214 114 Q196 104 150 102 Q108 102 88 114 Z', '#16141a') +
      LINE('M112 70 Q140 58 176 66', '#fff', 3, .22) + LINE('M104 92 Q150 80 200 90', '#fff', 2, .12) +
      CL('M88 106 Q150 96 214 108 L214 116 Q150 104 88 114 Z', '#221f27');
  const DURAG_TAILS = (v) => CL('M98 104 C82 132 80 172 88 208 L100 206 C96 172 98 134 110 108 Z', '#16141a') +
                             CL('M108 106 C98 136 98 176 106 214 L117 210 C112 176 112 138 120 110 Z', '#1d1a22');
  const SHADES = (lens) => (v) => v === 'back' ? '' : v === 'tq'
    ? `<path d="M117 106 Q160 99 214 107 L212 125 Q168 133 121 129 Q113 118 117 106 Z" fill="${lens}"/>` +
      LINE('M122 110 Q160 104 208 111', '#fff', 1.6, .55) + LINE('M117 110 L92 108', '#111', 3)
    : `<path d="M88 106 Q150 97 212 106 L210 127 Q150 135 90 127 Z" fill="${lens}"/>` + LINE('M94 110 Q150 102 206 110', '#fff', 1.6, .5);
  const BEANIE = (c) => (v) =>
    CL(v === 'tq' ? 'M92 112 C90 70 118 48 152 48 C188 48 214 70 214 112 Z' : 'M90 112 C88 70 118 50 150 50 C182 50 212 70 210 112 Z', c) +
    CL(v === 'tq' ? 'M90 100 Q152 86 216 100 L216 118 Q152 104 90 120 Z' : 'M88 100 Q150 86 212 100 L212 118 Q150 104 88 120 Z', c) +
    `<g opacity=".3">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => FOLD(`M${98 + i * 11} ${96 - (i > 5 ? (10 - i) : i) * 1.3} l0 18`, .6)).join('')}</g>`;
  const HEADPHONES_ON = (v) => v === 'back' ? '' :
    LINE(v === 'tq' ? 'M96 126 C88 76 120 44 156 44 C194 46 218 76 216 120' : 'M94 126 C86 76 116 46 150 46 C184 46 214 76 206 126', '#2b2b30', 7) +
    CL(v === 'tq' ? 'M84 112 C84 102 96 98 104 104 L108 150 C100 158 86 152 84 142 Z' : 'M80 112 C80 102 92 98 100 104 L104 150 C96 158 82 152 80 142 Z', '#33333a') +
    CL(v === 'tq' ? 'M210 108 C216 104 222 110 222 118 L220 140 C218 146 212 146 210 142 Z' : 'M200 104 C208 98 220 102 220 112 L220 142 C218 152 204 158 196 150 Z', '#33333a');
  const BOW = (v) => v === 'back' ? '' :
    `<g transform="rotate(-10 128 84)">` +
    CL('M126 40 C108 24 94 32 97 46 C100 60 114 54 126 40 Z', '#121114') + CL('M126 40 C144 24 158 32 155 46 C152 60 138 54 126 40 Z', '#121114') +
    CL('M124 42 L114 70 L120 68 L124 76 L127 44 Z', '#121114') + CL('M128 42 L138 70 L132 68 L128 76 L127 44 Z', '#18171b') +
    `<ellipse cx="126" cy="41" rx="6" ry="5.5" fill="#1d1c21"/>` + LINE('M106 36 Q112 32 118 36 M136 36 Q142 32 148 36', '#fff', 1.6, .35) + `</g>`;
  const SPARKLES = (v) => v === 'back' ? '' : `<g fill="#fff" opacity=".9">` +
    (v === 'tq' ? [[118, 146, 6], [130, 158, 4], [212, 132, 4]] : [[104, 146, 6], [116, 158, 4], [196, 146, 6], [184, 158, 4]])
      .map(([x, y, r]) => `<path d="M${x} ${y - r} L${x + r * .25} ${y - r * .25} L${x + r} ${y} L${x + r * .25} ${y + r * .25} L${x} ${y + r} L${x - r * .25} ${y + r * .25} L${x - r} ${y} L${x - r * .25} ${y - r * .25} Z"/>`).join('') + `</g>`;
  const HEADSET = (v) => v === 'back' ? '' : v === 'tq'
    ? LINE('M112 132 C118 158 146 170 176 162', '#2a2a2e', 2.4) + `<ellipse cx="178" cy="162" rx="4" ry="3.4" fill="#2a2a2e"/>`
    : LINE('M96 132 C100 158 120 170 138 166', '#2a2a2e', 2.4) + `<ellipse cx="140" cy="166" rx="4" ry="3.4" fill="#2a2a2e"/>`;
  const PIN = (v) => v === 'back' ? '' :
    `<g transform="rotate(-10 128 84)">${LINE('M104 2 L122 -2', '#d6dbe0', 2.2)}${LINE('M104 6 L122 0', '#9aa1a9', 1.6)}<circle cx="102" cy="4" r="3.4" fill="none" stroke="#d6dbe0" stroke-width="1.8"/></g>`;
  // máscara de luchador: cubre la cabeza con agujeros para ojos y morro (evenodd)
  const MASK = (v) => {
    const tq = v === 'tq', back = v === 'back';
    const head = tq ? 'M140 64 C178 60 206 82 214 112 C220 132 218 150 208 162 C198 178 176 190 150 190 C124 190 100 180 92 160 C82 138 86 104 100 84 C110 70 124 64 140 64 Z'
                    : 'M150 66 C188 66 208 92 210 122 C212 146 204 166 186 176 C174 183 162 186 150 186 C138 186 126 183 114 176 C96 166 88 146 90 122 C92 92 112 66 150 66 Z';
    const E = (cx, cy, rx, ry) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
    const holes = back ? '' : tq ? E(146, 120, 22, 17) + E(190, 154, 18, 20) + E(210, 118, 6, 12) : E(116, 118, 20, 16) + E(184, 118, 20, 16) + E(150, 156, 18, 18);
    const star = tq ? 'M120 66 L127 84 L146 84 L131 95 L137 113 L120 102 L104 113 L110 95 L95 84 L114 84 Z'
                    : 'M150 68 L156 84 L173 84 L159 94 L165 110 L150 100 L135 110 L141 94 L127 84 L144 84 Z';
    return `<path d="${head}${holes}" fill="url(#ch-silver)" fill-rule="evenodd"/>` + `<path d="${head}${holes}" fill="url(#ch-clothx)" fill-rule="evenodd"/>` +
      `<path d="${star}" fill="#141214"/>` +
      `<path d="${tq ? 'M166 92 L184 100 L176 108 L198 118 L182 122 L206 138 L178 130 L186 124 L166 118 L174 110 Z' : 'M186 92 L202 98 L194 106 L212 116 L198 120 L214 132 L192 126 L198 120 L182 114 L188 108 Z'}" fill="#141214"/>` +
      (back ? '' : tq ? LINE('M124 120 a22 17 0 1 0 44 0 a22 17 0 1 0 -44 0 M172 154 a18 20 0 1 0 36 0 a18 20 0 1 0 -36 0', '#e5333f', 2.4)
                      : LINE('M96 118 a20 16 0 1 0 40 0 a20 16 0 1 0 -40 0 M164 118 a20 16 0 1 0 40 0 a20 16 0 1 0 -40 0 M132 156 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0', '#e5333f', 2.4)) +
      LINE(tq ? 'M106 176 Q150 196 200 170' : 'M110 178 Q150 194 190 178', '#e5333f', 3);
  };

  // ---------- cuello (sobre el collar) ----------
  function CHAIN(n, rx, ry, depth, grad, stroke) {
    let s = '';
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = (1 - t) ** 2 * 92 + 2 * (1 - t) * t * 152 + t * t * 212, y = (1 - t) ** 2 * 196 + 2 * (1 - t) * t * depth + t * t * 196;
      const dx = 2 * (1 - t) * (152 - 92) + 2 * t * (212 - 152), dy = 2 * (1 - t) * (depth - 196) + 2 * t * (196 - depth);
      const a = Math.atan2(dy, dx) * 180 / Math.PI;
      s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx}" ry="${i % 2 ? ry * .55 : ry}" transform="rotate(${a.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#ch-${grad})" stroke="${stroke}" stroke-width=".8"/>`;
    }
    return s;
  }
  const PENDANT_P = `<rect x="138" y="222" width="28" height="30" rx="5" fill="url(#ch-silver)" stroke="#59606a" stroke-width="1"/>` +
    `<text x="144" y="246" font-family="Georgia,serif" font-weight="900" font-size="22" fill="#2a2d33">P</text>` +
    `<path d="M162 226 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z" fill="#fff"/>`;
  // cascos de DJ apoyados en las clavículas, con la diadema por detrás del cuello
  const CUP = (x, a) => `<g transform="rotate(${a} ${x} 214)">` + CL(`M${x - 17} 214 a17 11 0 1 0 34 0 a17 11 0 1 0 -34 0 Z`, '#1d1d22') +
                        `<ellipse cx="${x}" cy="211" rx="11" ry="6" fill="#2c2c33"/>` + LINE(`M${x - 14} 216 a14 8 0 0 0 28 0`, '#c6ff00', 2, .9) + `</g>`;
  const NECK_PHONES = LINE('M96 206 C92 190 100 182 110 186 M204 206 C208 190 200 182 190 186', '#2b2b30', 5) + CUP(100, -24) + CUP(200, 24);
  const LED = `<path class="led" d="M100 318 Q127 326 154 318 L154 328 Q127 336 100 328 Z" fill="#c6ff00"/>`;
  const MIC = `<g transform="rotate(16 128 340)"><rect x="123.5" y="318" width="9" height="40" rx="3.5" fill="#1a1a1c"/>` +
              `<circle cx="128" cy="314" r="10" fill="url(#ch-silver)"/>` + LINE('M120 310 L136 318 M120 318 L136 310 M118 314 L138 314', '#6d737b', .9) + `</g>`;

  window.ChupitsOutfits = {
    rap: {
      label: 'Rap',
      head: CAP_SIDE('#141416', true),
      neck: () => CHAIN(22, 6, 4.2, 258, 'gold', '#7a5410'),
      torso: (v) => CL(T_JKL, '#17181c') + CL(T_JKR, '#17181c') + (front(v) ? LINE('M136 190 C132 232 132 292 138 334', '#c9ced6', 1.6, .8) + LINE('M164 190 C168 232 168 292 162 334', '#c9ced6', 1.6, .8) : '') +
                   LINE('M96 300 C92 316 96 336 104 350', '#e5333f', 4) + LINE('M204 300 C208 316 204 336 196 350', '#e5333f', 4) +          // tirantes sueltos
                   `<rect x="99" y="346" width="10" height="7" rx="1.5" fill="url(#ch-silver)"/><rect x="191" y="346" width="10" height="7" rx="1.5" fill="url(#ch-silver)"/>`,
      pants: () => CL('M73 294 Q150 308 227 294 L228 310 Q150 324 72 310 Z', '#f2f2f2') + LINE('M73 299 Q150 313 227 299', '#e5333f', 2) + LINE('M73 305 Q150 319 227 305', '#e5333f', 2) +   // goma del calzoncillo
                   CL(P_LOW, '#3b5c8c') + WAIST(316) + PFOLDS + FOLD('M150 322 L150 342', .4),
      sleeve: () => CL(S_LONG, '#17181c') + STRIPES('#f4f4f4') + CUFF('#17181c'),
      prop: () => MIC,
      shoe: () => HIGHTOP('#f6f6f6'),
    },
    trap: {
      label: 'Trap',
      headBack: (v) => v === 'back' ? '' : DURAG_TAILS(v),
      head: (v) => DURAG(v) + SHADES('#1b1426')(v),
      neck: () => CHAIN(28, 3.4, 2.4, 238, 'silver', '#59606a') + PENDANT_P,
      torso: () => HOOD('#1c1b21') + CL(T_LONG, '#1c1b21') + LINE('M138 196 L136 244 M162 196 L164 248', '#7b3ff2', 2.4) +
                   `<rect x="133" y="242" width="6" height="9" rx="2" fill="url(#ch-silver)"/><rect x="161" y="246" width="6" height="9" rx="2" fill="url(#ch-silver)"/>`,
      pants: () => CL(P_FULL, '#141416') + WAIST() + CARGO('#1b1b1e') + PFOLDS + FOLD('M84 350 Q92 346 100 352 M200 352 Q208 346 216 350', .5),
      sleeve: () => CL(S_LONG, '#1c1b21') + CUFF('#1c1b21') + FOLD('M100 280 Q112 286 124 280 M104 300 Q118 306 132 300', .3),
      shoe: () => SNEAKER('#efeff2', '#7b3ff2') + SOLE('#7b3ff2', 13),
    },
    reggaeton: {
      label: 'Reguetón',
      head: (v) => BUCKET('#ffd23f', '#ff4fa0', '#ff4fa0')(v) + (v === 'back' ? '' : SHADES('url(#ch-y2k)')(v)),
      neck: () => CHAIN(34, 2.6, 1.8, 236, 'gold', '#7a5410'),
      torso: (v) => `<defs><linearGradient id="ch-y2k" x1="0" x2="1"><stop offset="0" stop-color="#ff4fa0" stop-opacity=".9"/><stop offset="1" stop-color="#ffd23f" stop-opacity=".9"/></linearGradient></defs>` +
                    CL(T_TEE, '#ffd23f') + LINE('M110 190 Q150 206 190 190', '#22d39a', 4) +
                    (front(v) ? `<text x="132" y="230" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="24" fill="#22d39a" stroke="#0e7a58" stroke-width="1">10</text>` : '') +
                    LINE('M74 314 Q150 328 226 314', '#22d39a', 4),
      pants: () => CL(P_SHORT, '#22d39a') + WAIST() + LINE('M74 304 L76 338 M226 304 L224 338', '#fff', 3) + FOLD('M150 312 L150 326', .4),
      sleeve: () => CL(S_SHORT, '#ffd23f') + LINE('M97 284 Q126 294 157 284', '#22d39a', 4),
      shoe: () => SLIDES(),
    },
    techno: {
      label: 'Techno',
      head: (v) => BUCKET('#141416', '#1d1d20')(v) + SHADES('#0b0b0d')(v),
      neck: () => NECK_PHONES,
      torso: (v) => CL(T_TEE, '#131315') + (front(v) ? `<text x="114" y="226" font-family="ui-monospace,Menlo,monospace" font-weight="800" font-size="11" fill="#c6ff00" letter-spacing="1">POPTIFY</text>` +
                    LINE('M114 232 l6 -6 6 10 6 -14 6 18 6 -12 6 8 6 -4', '#c6ff00', 1.6) : ''),
      pants: () => CL(P_FULL, '#18181a') + WAIST() + CARGO('#202023') + PFOLDS,
      sleeve: () => CL(S_SHORT, '#131315') + FOLD('M100 284 Q126 292 154 284', .3),
      propL: () => LED,
      shoe: () => BOOT('#151515'),
    },
    pop: {
      label: 'Pop',
      ear: () => BOW('front'),
      head: (v) => SPARKLES(v) + HEADSET(v),
      torso: () => CL(T_LONG, '#ff5fa2') + LINE('M136 192 C134 236 134 294 140 336', '#c9ced6', 2, .9) +
                   CL('M72 322 Q150 336 228 322 L228 334 Q150 348 72 334 Z', '#e04d8c') + FOLD('M96 210 Q104 240 98 270 M204 210 Q196 240 202 270', .2),
      pants: () => CL(P_FLARE, '#f6f3f0') + WAIST() + FOLD('M90 330 Q80 350 70 362 M210 330 Q220 350 230 362', .2),
      sleeve: () => CL(S_LONG, '#ff5fa2') + CUFF('#e04d8c') + LINE('M104 240 Q112 260 108 280', '#fff', 3, .25),
      shoe: () => PLATFORM('#f2f2f6'),
    },
    rock: {
      label: 'Rock / Punk',
      ear: () => PIN('front'),
      torso: (v) => CL(T_TEE, '#ece9e4') + (front(v) ? FOLD('M146 200 L152 214 L148 222 M160 204 L156 216', .6) : '') +
                    CL(T_JKL, '#111113') + CL(T_JKR, '#111113') +
                    `<g fill="url(#ch-silver)">${[[100, 210], [92, 236], [86, 262], [84, 290], [200, 210], [208, 236], [214, 262], [216, 290]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('')}</g>` +
                    LINE('M134 190 L120 222 L136 232', '#2a2a2e', 2.2) + LINE('M166 190 L180 222 L164 232', '#2a2a2e', 2.2),
      pants: () => CL('M72 296 Q150 310 228 296 C230 322 226 346 218 362 L158 362 L150 336 L142 362 L82 362 C74 346 70 322 72 296 Z', '#1a1a1e') + WAIST() +
                   `<path d="M92 334 Q100 330 110 334 Q102 338 92 334 Z M190 342 Q198 338 208 342 Q200 346 190 342 Z" fill="#f2efe9" opacity=".85"/>`,
      sleeve: () => CL(S_LONG, '#111113') + CUFF('#111113') + LINE('M102 250 L108 252 M100 290 L106 292', '#c9ced6', 2) + LINE('M112 234 L150 234', '#2a2a2e', 2),
      shoe: () => BOOT('#0f0f10'),
    },
    lofi: {
      label: 'Lo-fi / Chill',
      head: (v) => BEANIE('#b58a3c')(v) + HEADPHONES_ON(v),
      torso: () => HOOD('#7d8590') + CL(T_LONG, '#7d8590') + CL('M112 278 Q150 270 188 278 L196 318 Q150 326 104 318 Z', '#737a85') + LINE('M138 196 L136 236 M162 196 L164 240', '#e8e3dc', 2.2),
      pants: () => CL(P_FULL, '#4b5a6a') + WAIST() + PFOLDS,
      sleeve: () => CL(S_LONG, '#7d8590') + CUFF('#737a85'),
      shoe: () => CL('M86 352 C84 340 96 332 112 330 L130 330 C140 330 146 338 146 346 L146 356 L86 356 Z', '#8a7b6b') +
                  CL('M84 346 Q115 338 148 346 L148 352 Q115 344 84 352 Z', '#f0e8dc') + SOLE('#5a4f45', 6),
    },
    lucha: {
      label: 'Lucha',
      head: MASK,
      torso: () => CL('M72 286 Q150 300 228 286 L229 310 Q150 324 71 310 Z', 'url(#ch-gold)') + FOLD('M72 292 Q150 306 228 292 M72 304 Q150 318 228 304', .35) +
                   `<g fill="#e5333f">${[[86, 298], [214, 298]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('')}</g>`,
    },
  };
  // qué outfit va con cada baile (modo Auto)
  window.ChupitsOutfits.byPose = { rap: 'rap', trap: 'trap', reggaeton: 'reggaeton', techno: 'techno', pop: 'pop' };
})();
