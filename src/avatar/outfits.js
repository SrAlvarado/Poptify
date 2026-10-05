// Outfits de Chupits. Cada outfit rellena huecos del rig y cada hueco se pinta dentro de la pieza que lo mueve:
//   head / headBack (cabeza, coords de la cabeza sin escalar) · ear (oreja de delante) · neck (cuello, sobre el collar)
//   prop / propL (patas, coords de la pata izquierda: la derecha es su espejo)
//   El rig también acepta torso / pants / sleeve / shoe, pero los outfits no los usan: se decidió que fueran
//   minimalistas y que no taparan el cuerpo.
// Todas las funciones reciben la vista ('tq' | 'front' | 'back'). Los ids ch-* los hace únicos render().
(function () {
  // tela: color plano + sombreado vertical y lateral encima, para que tenga volumen sin filtros
  const CL = (d, fill, extra = '') =>
    `<path d="${d}" fill="${fill}"/><path d="${d}" fill="url(#ch-cloth)"/><path d="${d}" fill="url(#ch-clothx)"/>${extra}`;
  const FOLD = (d, o = 0.35) => `<path d="${d}" fill="none" stroke="#000" stroke-opacity="${o}" stroke-width="1.6" stroke-linecap="round"/>`;
  const LINE = (d, c, w = 2, o = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round" stroke-linejoin="round"/>`;

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

  const Y2K = `<defs><linearGradient id="ch-y2k" x1="0" x2="1"><stop offset="0" stop-color="#ff4fa0" stop-opacity=".9"/><stop offset="1" stop-color="#ffd23f" stop-opacity=".9"/></linearGradient></defs>`;
  const STUDS = `<path d="M100 314 Q127 322 154 314 L154 328 Q127 336 100 328 Z" fill="#141416"/>` +
                `<g fill="url(#ch-silver)">${[108, 118, 128, 138, 148].map((x) => `<circle cx="${x}" cy="${322 + (x - 127) ** 2 / 400}" r="2.6"/>`).join('')}</g>`;

  // Minimalistas a propósito: 2-3 piezas que dicen el género, el cuerpo y el pelo siempre a la vista.
  window.ChupitsOutfits = {
    rap:       { label: 'Rap',          head: CAP_SIDE('#141416', true), neck: () => CHAIN(22, 6, 4.2, 258, 'gold', '#7a5410'), prop: () => MIC },
    trap:      { label: 'Trap',         headBack: (v) => v === 'back' ? '' : DURAG_TAILS(v), head: (v) => DURAG(v) + SHADES('#1b1426')(v),
                 neck: () => CHAIN(28, 3.4, 2.4, 238, 'silver', '#59606a') + PENDANT_P },
    reggaeton: { label: 'Reguetón',     head: (v) => Y2K + BUCKET('#ffd23f', '#ff4fa0', '#ff4fa0')(v) + SHADES('url(#ch-y2k)')(v) },
    techno:    { label: 'Techno',       head: SHADES('#0b0b0d'), neck: () => NECK_PHONES, propL: () => LED },
    pop:       { label: 'Pop',          ear: () => BOW('front'), head: (v) => SPARKLES(v) + HEADSET(v) },
    rock:      { label: 'Rock / Punk',  ear: () => PIN('front'), propL: () => STUDS },
    lofi:      { label: 'Lo-fi / Chill', head: (v) => BEANIE('#b58a3c')(v) + HEADPHONES_ON(v) },
    lucha:     { label: 'Lucha',        head: MASK },
  };
  // qué outfit va con cada baile (modo Auto)
  window.ChupitsOutfits.byPose = { rap: 'rap', trap: 'trap', reggaeton: 'reggaeton', techno: 'techno', pop: 'pop' };
})();
