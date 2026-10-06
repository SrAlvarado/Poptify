// Outfits de Chupits. Cada outfit rellena huecos del rig y cada hueco se pinta dentro de la pieza que lo mueve:
//   head / headBack (cabeza, coords de la cabeza sin escalar) · ear (oreja de delante = la izquierda)
//   neck (cuello, sobre el collar) · chest (pecho, sobre la pechera: arnés)
//   prop / propL (patas, coords de la pata izquierda: la derecha es su espejo)
//   El rig también acepta torso / pants / sleeve / shoe, pero los outfits no los usan: se decidió que fueran
//   minimalistas y que no taparan el cuerpo.
// Kits según "Accesorios por género" (Claude Docs · Patrones de baile por género): 2–3 piezas por género;
// el metal y el color separan los parecidos (rap y reguetón oro, trap diamante, techno y rock plata).
// Todas las funciones reciben la vista ('tq' | 'front' | 'back'). Los ids ch-* los hace únicos render().
(function () {
  // material: color sólido + luz arriba / sombra abajo + un perfil fino que lo separa del pelo blanco.
  // (antes llevaba también un degradado lateral que oscurecía los bordes y parecía transparente)
  const CL = (d, fill, extra = '') =>
    `<path d="${d}" fill="${fill}" stroke="#000" stroke-opacity=".38" stroke-width="1.2" stroke-linejoin="round"/><path d="${d}" fill="url(#ch-cloth)"/>${extra}`;
  const FOLD = (d, o = 0.35) => `<path d="${d}" fill="none" stroke="#000" stroke-opacity="${o}" stroke-width="1.6" stroke-linecap="round"/>`;
  const LINE = (d, c, w = 2, o = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const STAR = (x, y, r, c = '#fff') => `<path fill="${c}" d="M${x} ${y - r} L${x + r * .25} ${y - r * .25} L${x + r} ${y} L${x + r * .25} ${y + r * .25} L${x} ${y + r} L${x - r * .25} ${y + r * .25} L${x - r} ${y} L${x - r * .25} ${y - r * .25} Z"/>`;
  const EAR_G = (s) => `<g transform="rotate(-10 128 84)">${s}</g>`;      // mismo giro que la oreja del rig
  const DEFS = `<defs>` +
    `<linearGradient id="ch-ice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#d9f1ff"/><stop offset="1" stop-color="#a9c4d6"/></linearGradient>` +
    `</defs>`;

  // ---------- cabeza ----------
  // Todo lo que va en la cabeza se construye sobre SU silueta (la de 3/4 o la de frente), para que se
  // ajuste al cráneo en vez de ser una forma de frente pegada encima. La "cinta" es la curva de la
  // frente donde acaba un gorro: siempre por encima de los ojos.
  const HEADP = {
    tq: 'M140 64 C178 60 206 82 214 112 C220 132 218 150 208 162 C198 178 176 190 150 190 C124 190 100 180 92 160 C82 138 86 104 100 84 C110 70 124 64 140 64 Z',
    front: 'M150 66 C188 66 208 92 210 122 C212 146 204 166 186 176 C174 183 162 186 150 186 C138 186 126 183 114 176 C96 166 88 146 90 122 C92 92 112 66 150 66 Z',
  };
  const hp = (v) => (v === 'tq' ? HEADP.tq : HEADP.front);
  const BAND = (v, dy = 0) => v === 'tq'
    ? { l: [80, 112 + dy], c: [150, 84 + dy], r: [226, 98 + dy] }
    : { l: [82, 110 + dy], c: [150, 82 + dy], r: [218, 110 + dy] };
  const bandAt = (b, t) => [0, 1].map((k) => (1 - t) ** 2 * b.l[k] + 2 * (1 - t) * t * b.c[k] + t * t * b.r[k]);
  const SC = (k, cx = 152, cy = 128) => `transform="translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})"`;
  // copa del gorro: el cráneo un poco más grande, recortado por encima de la cinta
  function CROWN(v, id, fill, k = 1.07, inner = '', dy = 0) {
    const b = BAND(v, dy);
    return `<clipPath id="ch-cr${id}"><path d="M-60 -140 H360 V${b.r[1]} L${b.r[0]} ${b.r[1]} Q${b.c[0]} ${b.c[1]} ${b.l[0]} ${b.l[1]} L-60 ${b.l[1]} Z"/></clipPath>` +
      `<clipPath id="ch-cs${id}"><path d="${hp(v)}" ${SC(k)}/></clipPath>` +
      `<g clip-path="url(#ch-cr${id})"><path d="${hp(v)}" ${SC(k)} fill="${fill}" stroke="#000" stroke-opacity=".38" stroke-width="1.4"/>` +
      `<path d="${hp(v)}" ${SC(k)} fill="url(#ch-cloth)"/><g clip-path="url(#ch-cs${id})">${inner}</g></g>`;
  }
  // tira a lo largo de la cinta (puño del gorro, banda), recortada al cráneo
  const STRIP = (v, id, color, w, k = 1.08, dy = 0) => {
    const b = BAND(v, dy);
    return `<clipPath id="ch-st${id}"><path d="${hp(v)}" ${SC(k)}/></clipPath>` +
      `<g clip-path="url(#ch-st${id})">${LINE(`M${b.l[0] - 20} ${b.l[1] + 4} Q${b.c[0]} ${b.c[1]} ${b.r[0] + 20} ${b.r[1] - 2}`, color, w)}` +
      `${LINE(`M${b.l[0] - 20} ${b.l[1] + 4 - w / 2} Q${b.c[0]} ${b.c[1] - w / 2} ${b.r[0] + 20} ${b.r[1] - 2 - w / 2}`, '#fff', 1.2, .25)}</g>`;
  };

  // RAP · Kangol rojo de pelo con ala corta caída (LL Cool J)
  const KANGOL = (v) => {
    let fuzz = '';
    for (let i = 0; i < 70; i++) { const x = 84 + (i * 37) % 140, y = 46 + (i * 23) % 58; fuzz += `M${x} ${y} l${(i % 3) - 1} 3`; }
    const brim = v === 'tq' ? `<ellipse cx="156" cy="93" rx="76" ry="10" transform="rotate(-5 156 93)" fill="#a50d24" stroke="#000" stroke-opacity=".4" stroke-width="1.2"/>`
                            : `<ellipse cx="150" cy="94" rx="74" ry="10" fill="#a50d24" stroke="#000" stroke-opacity=".4" stroke-width="1.2"/>`;
    return brim + CROWN(v, 'k', '#c8102e', 1.09, LINE(fuzz, '#7d0a1d', 1.1, .5)) + STRIP(v, 'k', '#9b0c22', 4, 1.09);
  };
  // REGUETÓN · gorra plana negra, visera recta ladeada hacia atrás-izquierda
  const FLATCAP = (v) => {
    const b = BAND(v), A = bandAt(b, .12), B = bandAt(b, .38);
    const visor = `M${A[0]} ${A[1]} L${B[0]} ${B[1]} L${B[0] - 40} ${B[1] + 22} L${A[0] - 40} ${A[1] + 10} Z`;
    const under = `M${A[0] - 40} ${A[1] + 10} L${B[0] - 40} ${B[1] + 22} L${B[0] - 38} ${B[1] + 27} L${A[0] - 39} ${A[1] + 14} Z`;
    const seams = v === 'tq' ? FOLD('M150 50 Q128 70 120 104 M150 50 Q178 66 192 94', .5) : FOLD('M150 52 Q130 72 124 100 M150 52 Q170 72 176 100', .5);
    const logo = v === 'back' ? '' : `<text x="${v === 'tq' ? 166 : 140}" y="${v === 'tq' ? 86 : 88}" font-family="Georgia,serif" font-weight="900" font-size="17" fill="url(#ch-gold)" stroke="#5c4110" stroke-width=".5">P</text>`;
    return `<path d="${under}" fill="#2bff88" stroke="#000" stroke-opacity=".4" stroke-width="1"/>` + CL(visor, '#141416') +
      CROWN(v, 'f', '#151517', 1.06, seams) + `<circle cx="150" cy="${v === 'tq' ? 51 : 53}" r="3.5" fill="#151517"/>` + logo;
  };
  // LO-FI · beanie morado de punto (un poco flojo) con el puño vuelto
  const BEANIE = (v) => {
    let rib = '';
    for (let x = 78; x < 228; x += 8) rib += `M${x} 30 L${x + 2} 110`;
    return CROWN(v, 'b', '#7a5aa6', 1.11, LINE(rib, '#000', 1.2, .14), -2) + STRIP(v, 'b', '#6a4b95', 13, 1.1, 2) +
      (() => { const b = BAND(v, 2); let r = ''; for (let t = .04; t < 1; t += .045) { const [x, y] = bandAt(b, t); r += `M${x.toFixed(1)} ${(y - 5).toFixed(1)} l0 10`; } return `<clipPath id="ch-rb"><path d="${hp(v)}" ${SC(1.1)}/></clipPath><g clip-path="url(#ch-rb)">${LINE(r, '#000', 1.1, .25)}</g>`; })();
  };
  const HEADPHONES_ON = (v) => v === 'back' ? '' : v === 'tq'
    ? LINE('M90 124 C82 72 116 38 160 42 C198 46 222 74 220 104', '#26262b', 7) + LINE('M92 120 C86 74 118 42 160 46', '#fff', 1.2, .18) +
      `<ellipse cx="88" cy="130" rx="12" ry="20" fill="#2f2f36" stroke="#000" stroke-opacity=".5"/><ellipse cx="91" cy="130" rx="7" ry="14" fill="#3d3d45"/>` +
      `<ellipse cx="219" cy="112" rx="5" ry="13" fill="#2f2f36" stroke="#000" stroke-opacity=".5"/>`
    : LINE('M84 128 C78 72 114 42 150 42 C186 42 222 72 216 128', '#26262b', 7) +
      `<ellipse cx="84" cy="134" rx="10" ry="20" fill="#2f2f36"/><ellipse cx="216" cy="134" rx="10" ry="20" fill="#2f2f36"/>`;
  // TRAP · gafas oscuras subidas en la frente: estilo sin tapar el ojo
  const SHADES_UP = (v) => v === 'back' ? '' : v === 'tq'
    ? LINE('M122 94 L94 100', '#111', 2.6) +
      `<ellipse cx="139" cy="90" rx="17" ry="8.5" transform="rotate(-10 139 90)" fill="#0d0c10" stroke="#3a3a40" stroke-width="1.4"/>` +
      `<ellipse cx="195" cy="85" rx="10" ry="7.5" transform="rotate(-10 195 85)" fill="#0d0c10" stroke="#3a3a40" stroke-width="1.4"/>` +
      LINE('M156 87 Q170 82 185 84', '#3a3a40', 2) + LINE('M128 87 Q138 83 150 85 M189 81 Q195 79 201 81', '#fff', 1.4, .5)
    : `<ellipse cx="116" cy="88" rx="16" ry="8.5" fill="#0d0c10" stroke="#3a3a40" stroke-width="1.4"/><ellipse cx="184" cy="88" rx="16" ry="8.5" fill="#0d0c10" stroke="#3a3a40" stroke-width="1.4"/>` +
      LINE('M132 87 Q150 82 168 87', '#3a3a40', 2);
  // TECHNO · pasamontañas negro de punto con UNA abertura ancha para los ojos (estilo "shiesty");
  // las orejas salen por encima y el ojo queda a la vista
  const BALACLAVA = (v) => {
    const slot = v === 'tq' ? 'M118 104 Q168 94 216 102 L216 132 Q168 140 122 136 Q110 120 118 104 Z'
                            : 'M90 102 Q150 94 210 102 L210 132 Q150 140 90 132 Z';
    let rib = '';
    for (let x = 80; x < 228; x += 7) rib += `M${x} 50 L${x + 1} 196`;
    return `<clipPath id="ch-bc"><path d="${hp(v)}${v === 'back' ? '' : slot}" ${SC(1.03)} clip-rule="evenodd"/></clipPath>` +
      `<path d="${hp(v)}${v === 'back' ? '' : slot}" ${SC(1.03)} fill="#111113" fill-rule="evenodd" stroke="#000" stroke-width="1.4"/>` +
      `<path d="${hp(v)}" ${SC(1.03)} fill="url(#ch-cloth)" clip-path="url(#ch-bc)"/>` +
      `<g clip-path="url(#ch-bc)">${LINE(rib, '#fff', 1, .06)}</g>` +
      (v === 'back' ? '' : `<path d="${slot}" fill="none" stroke="#2a2a2e" stroke-width="2.4"/>`);   // borde del agujero, algo grueso como el punto
  };
  // POP · micro de diadema fino: diadema por encima de la cabeza y brazo hasta la boca
  const HEADSET = (v) => v === 'back' ? '' : v === 'tq'
    ? LINE('M98 126 C92 84 112 58 148 55 C174 54 192 63 202 76', '#1f1f23', 2.2) + `<circle cx="98" cy="131" r="6.5" fill="#1f1f23"/>` +   // la diadema se pierde por detrás
      LINE('M101 136 C114 162 150 172 177 163', '#1f1f23', 2) + `<ellipse cx="180" cy="162" rx="4" ry="3.2" fill="#1f1f23"/>`
    : LINE('M90 128 C84 74 118 46 150 46 C182 46 216 74 210 128', '#1f1f23', 2.2) + `<circle cx="90" cy="132" r="6.5" fill="#1f1f23"/>` +
      LINE('M93 138 C100 160 120 168 140 166', '#1f1f23', 2) + `<ellipse cx="142" cy="165" rx="4" ry="3.2" fill="#1f1f23"/>`;
  // ROCK · delineador negro corrido: raya bajo el ojo, difuminado y ala hacia fuera
  const LINER = (v) => {
    if (v === 'back') return '';
    const eye = (x, y, dir) => LINE(`M${x - 15 * dir} ${y} Q${x} ${y + 16} ${x + 15 * dir} ${y - 2}`, '#141214', 8, .16) +
      LINE(`M${x - 15 * dir} ${y} Q${x} ${y + 14} ${x + 15 * dir} ${y - 2}`, '#141214', 3.4, .9) +
      LINE(`M${x - 15 * dir} ${y - 1} L${x - 24 * dir} ${y - 8}`, '#141214', 3.4, .9);
    return v === 'tq' ? eye(146, 121, 1) : eye(116, 119, 1) + eye(184, 119, -1);
  };
  // máscara de luchador: la silueta exacta de la cabeza, con agujeros para ojos y morro (evenodd)
  const MASK = (v) => {
    const tq = v === 'tq', back = v === 'back';
    const E = (cx, cy, rx, ry) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
    const holes = back ? '' : tq ? E(146, 120, 22, 17) + E(190, 154, 18, 20) + E(210, 118, 6, 12) : E(116, 118, 20, 16) + E(184, 118, 20, 16) + E(150, 156, 18, 18);
    const star = tq ? 'M120 66 L127 84 L146 84 L131 95 L137 113 L120 102 L104 113 L110 95 L95 84 L114 84 Z'
                    : 'M150 68 L156 84 L173 84 L159 94 L165 110 L150 100 L135 110 L141 94 L127 84 L144 84 Z';
    return `<path d="${hp(v)}${holes}" ${SC(1.02)} fill="url(#ch-silver)" fill-rule="evenodd" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/>` +
      `<path d="${star}" fill="#141214"/>` +
      `<path d="${tq ? 'M166 92 L184 100 L176 108 L198 118 L182 122 L206 138 L178 130 L186 124 L166 118 L174 110 Z' : 'M186 92 L202 98 L194 106 L212 116 L198 120 L214 132 L192 126 L198 120 L182 114 L188 108 Z'}" fill="#141214"/>` +
      (back ? '' : tq ? LINE('M124 120 a22 17 0 1 0 44 0 a22 17 0 1 0 -44 0 M172 154 a18 20 0 1 0 36 0 a18 20 0 1 0 -36 0', '#e5333f', 2.4)
                      : LINE('M96 118 a20 16 0 1 0 40 0 a20 16 0 1 0 -40 0 M164 118 a20 16 0 1 0 40 0 a20 16 0 1 0 -40 0 M132 156 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0', '#e5333f', 2.4)) +
      LINE(tq ? 'M106 176 Q150 196 200 170' : 'M110 178 Q150 194 190 178', '#e5333f', 3);
  };

  // ---------- oreja de delante (la izquierda) ----------
  const BOW = (c, c2) => () => EAR_G(                                  // POP · lazo grande rosa
    CL('M126 40 C108 24 94 32 97 46 C100 60 114 54 126 40 Z', c) + CL('M126 40 C144 24 158 32 155 46 C152 60 138 54 126 40 Z', c) +
    CL('M124 42 L114 70 L120 68 L124 76 L127 44 Z', c2) + CL('M128 42 L138 70 L132 68 L128 76 L127 44 Z', c2) +
    `<ellipse cx="126" cy="41" rx="6" ry="5.5" fill="${c2}"/>` + LINE('M106 36 Q112 32 118 36 M136 36 Q142 32 148 36', '#fff', 1.6, .45));
  const HEART_EARRING = () => EAR_G(                                   // POP · pendiente de corazón
    `<circle cx="101" cy="44" r="2.4" fill="url(#ch-gold)"/>` + LINE('M101 46 L101 52', '#d4a537', 1.6) +
    `<path d="M101 64 C93 58 91 53 95 50 C97.5 48.5 100 49.5 101 51.5 C102 49.5 104.5 48.5 107 50 C111 53 109 58 101 64 Z" fill="#ff7eb6" stroke="#d4a537" stroke-width="1.2"/>`);
  // aro atravesando el borde de la oreja: solo se ve la parte de fuera (el resto queda "dentro")
  const HOOP = (c, r = 8) => `<path d="M100 ${34 - r * .2} A${r} ${r} 0 1 0 ${100 + r * 1.2} ${34 + r * .4}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;
  const GOLD_HOOP = () => EAR_G(HOOP('#d9ad3c', 10) + HOOP('#fff3c4', 10).replace('stroke-width="2.6"', 'stroke-width=".8" stroke-opacity=".7"'));
  // ROCK · aro de plata pequeño con una cruz latina colgando de una anilla (no un ♀)
  const HOOP_CROSS = () => EAR_G(HOOP('#c9ced6', 10) +
    `<g transform="rotate(14 96 44)">${LINE('M96 43 L96 47', '#c9ced6', 1.2)}` +
    `<path d="M95 47 h2 v3 h2.8 v1.8 h-2.8 v7.5 h-2 v-7.5 h-2.8 v-1.8 h2.8 Z" fill="#d6dbe0" stroke="#3e434a" stroke-width=".6"/></g>`);

  // ---------- cuello (sobre el collar) ----------
  // cadena por una curva del cuello al pecho; twist > 0 la convierte en cordón trenzado
  function CHAIN(n, rx, ry, depth, grad, stroke, twist = 0) {
    let s = '';
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = (1 - t) ** 2 * 92 + 2 * (1 - t) * t * 152 + t * t * 212, y = (1 - t) ** 2 * 196 + 2 * (1 - t) * t * depth + t * t * 196;
      const dx = 2 * (1 - t) * (152 - 92) + 2 * t * (212 - 152), dy = 2 * (1 - t) * (depth - 196) + 2 * t * (196 - depth);
      const a = Math.atan2(dy, dx) * 180 / Math.PI + (twist ? (i % 2 ? twist : -twist) : 0);
      s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx}" ry="${!twist && i % 2 ? ry * .55 : ry}" transform="rotate(${a.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#ch-${grad})" stroke="${stroke}" stroke-width=".8"/>`;
    }
    return s;
  }
  // centro de la curva a una profundidad dada (donde cuelga el colgante)
  const mid = (depth) => [152, 0.25 * 196 + 0.5 * depth + 0.25 * 196];
  // RAP · cordón de oro trenzado + medallón
  const ROPE_MEDALLION = () => {
    const [x, y] = mid(258);
    return CHAIN(30, 6, 3.4, 258, 'gold', '#7a5410', 38) +
      `<circle cx="${x}" cy="${y + 12}" r="13" fill="url(#ch-gold)" stroke="#7a5410" stroke-width="1.2"/>` +
      `<circle cx="${x}" cy="${y + 12}" r="9" fill="none" stroke="#7a5410" stroke-width="1" stroke-opacity=".6"/>` +
      `<text x="${x - 5.5}" y="${y + 17}" font-family="Georgia,serif" font-weight="900" font-size="15" fill="#7a5410">P</text>`;
  };
  // TRAP · 2–3 cadenas de "hielo" superpuestas + colgante raro: una zanahoria de diamantes
  const ICED = () => {
    const [x, y] = mid(272);
    const carrot = `<g transform="translate(${x} ${y + 4})">` +
      `<path d="M-9 0 L9 0 L1.5 30 Q0 33 -1.5 30 Z" fill="url(#ch-ice)" stroke="#7b97aa" stroke-width="1"/>` +
      LINE('M-6 6 L6 7 M-4 13 L4 14 M-3 20 L2 21', '#7b97aa', 1, .9) +
      `<path d="M-2 0 L-8 -11 L-1 -4 L0 -13 L2 -4 L8 -11 L2 0 Z" fill="url(#ch-ice)" stroke="#7b97aa" stroke-width=".8"/>` +
      STAR(6, 8, 4) + STAR(-5, 18, 3) + `</g>`;
    return CHAIN(34, 3.4, 2.6, 236, 'ice', '#8aa4b6') + CHAIN(38, 3.2, 2.4, 254, 'ice', '#8aa4b6') + CHAIN(42, 3, 2.2, 272, 'ice', '#8aa4b6') +
      carrot + STAR(118, 214, 4) + STAR(186, 226, 3.5);
  };
  // REGUETÓN · cadenas de oro superpuestas con cruz brillante
  const GOLD_CROSS = () => {
    const [x, y] = mid(262);
    return CHAIN(30, 4.4, 3, 240, 'gold', '#7a5410') + CHAIN(34, 4.4, 3, 262, 'gold', '#7a5410') +
      `<path transform="translate(${x} ${y + 4})" d="M-3.5 0 h7 v8 h8 v7 h-8 v18 h-7 v-18 h-8 v-7 h8 Z" fill="url(#ch-gold)" stroke="#7a5410" stroke-width="1"/>` +
      STAR(x, y + 15, 5);
  };
  // TECHNO · cadena plateada fina
  const FINE_SILVER = () => CHAIN(44, 2.2, 1.5, 230, 'silver', '#5b6168');
  // LO-FI · bufanda roja de punto (la de la Lofi Girl), con una punta cayendo
  const SCARF = () =>
    CL('M90 198 Q152 228 214 198 L215 211 Q152 242 89 211 Z', '#d2574a') +
    `<g opacity=".35">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => FOLD(`M${96 + i * 11.4} ${206 + Math.sin(i / 10 * Math.PI) * 15} l1 11`, .7)).join('')}</g>` +
    CL('M176 220 L192 216 L197 256 L182 259 Z', '#c84d41') + FOLD('M184 256 l1 5 M190 255 l1 5', .5);

  // ---------- pecho ----------
  // TECHNO · arnés de tiras negras finas con anilla plateada (Berlín)
  const HARNESS = () =>
    LINE('M90 214 Q120 232 150 250 M210 214 Q180 232 150 250 M150 250 L150 268', '#121214', 5) +
    LINE('M90 214 Q120 232 150 250 M210 214 Q180 232 150 250 M150 250 L150 268', '#3a3d44', 1.2, .8) +
    `<circle cx="150" cy="251" r="8" fill="#121214" fill-opacity=".001" stroke="#c9ced6" stroke-width="3.2"/>` + STAR(156, 245, 3.4);

  // ---------- manos (pata izquierda; la derecha es su espejo) ----------
  // RAP · anillo de cuatro dedos con el nombre
  // (sin letras: la pata derecha es un espejo y el texto saldría al revés)
  const KNUCKLE_RING = `<path d="M110 326 Q128 333 148 326 L148 337 Q128 344 110 337 Z" fill="url(#ch-gold)" stroke="#7a5410" stroke-width="1"/>` +
    [115, 124, 133, 142].map((x) => `<ellipse cx="${x}" cy="${331 + (x - 129) ** 2 / 300}" rx="3.6" ry="3" fill="url(#ch-gold)" stroke="#7a5410" stroke-width=".7"/>`).join('');
  // ROCK · muñequera de cuero con tachuelas
  const STUDS = `<path d="M100 314 Q127 322 154 314 L154 328 Q127 336 100 328 Z" fill="#141416"/>` +
                `<g fill="url(#ch-silver)">${[108, 118, 128, 138, 148].map((x) => `<circle cx="${x}" cy="${322 + (x - 127) ** 2 / 400}" r="2.6"/>`).join('')}</g>`;

  // Minimalistas a propósito: 2-3 piezas que dicen el género, el cuerpo y el pelo siempre a la vista.
  window.ChupitsOutfits = {
    rap:       { label: 'Rap',           head: KANGOL, neck: ROPE_MEDALLION, prop: () => KNUCKLE_RING },
    trap:      { label: 'Trap',          head: SHADES_UP, neck: () => DEFS + ICED() },
    reggaeton: { label: 'Reguetón',      head: FLATCAP, ear: GOLD_HOOP, neck: GOLD_CROSS },
    techno:    { label: 'Techno',        head: BALACLAVA, neck: FINE_SILVER, chest: HARNESS },
    pop:       { label: 'Pop',           ear: () => BOW('#ffb3d1', '#f28dbb')() + HEART_EARRING(), head: HEADSET },
    rock:      { label: 'Rock / Punk',   ear: HOOP_CROSS, head: LINER, propL: () => STUDS },
    lofi:      { label: 'Lo-fi / Chill', head: (v) => BEANIE(v) + HEADPHONES_ON(v), neck: SCARF },
    lucha:     { label: 'Lucha',         head: MASK },
  };
  // qué outfit va con cada baile (modo Auto)
  window.ChupitsOutfits.byPose = { rap: 'rap', trap: 'trap', reggaeton: 'reggaeton', techno: 'techno', pop: 'pop', chill: 'lofi' };
})();
