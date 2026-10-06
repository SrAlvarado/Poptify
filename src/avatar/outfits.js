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
  // tela: color plano + sombreado vertical y lateral encima, para que tenga volumen sin filtros
  const CL = (d, fill, extra = '') =>
    `<path d="${d}" fill="${fill}"/><path d="${d}" fill="url(#ch-cloth)"/><path d="${d}" fill="url(#ch-clothx)"/>${extra}`;
  const FOLD = (d, o = 0.35) => `<path d="${d}" fill="none" stroke="#000" stroke-opacity="${o}" stroke-width="1.6" stroke-linecap="round"/>`;
  const LINE = (d, c, w = 2, o = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const STAR = (x, y, r, c = '#fff') => `<path fill="${c}" d="M${x} ${y - r} L${x + r * .25} ${y - r * .25} L${x + r} ${y} L${x + r * .25} ${y + r * .25} L${x} ${y + r} L${x - r * .25} ${y + r * .25} L${x - r} ${y} L${x - r * .25} ${y - r * .25} Z"/>`;
  const EAR_G = (s) => `<g transform="rotate(-10 128 84)">${s}</g>`;      // mismo giro que la oreja del rig
  const DEFS = `<defs>` +
    `<linearGradient id="ch-mirror" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fd8ff"/><stop offset=".35" stop-color="#f1f3ff"/><stop offset=".6" stop-color="#ffb8ef"/><stop offset="1" stop-color="#7effd2"/></linearGradient>` +
    `<linearGradient id="ch-ice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#d9f1ff"/><stop offset="1" stop-color="#a9c4d6"/></linearGradient>` +
    `<linearGradient id="ch-pinklens" x1="0" x2="1"><stop offset="0" stop-color="#ff5fa8" stop-opacity=".85"/><stop offset="1" stop-color="#ff9a5c" stop-opacity=".85"/></linearGradient>` +
    `</defs>`;

  // ---------- cabeza (coords de la cabeza; 'tq' = 3/4 mirando a la derecha) ----------
  // RAP · Kangol bucket rojo de pelo (LL Cool J), con el ala caída
  const KANGOL = (v) => {
    const tq = v === 'tq';
    const crown = tq ? 'M100 98 C98 62 126 46 154 46 C184 46 206 62 208 98 Z' : 'M96 100 C94 64 122 48 150 48 C178 48 206 64 204 100 Z';
    const brim = tq ? 'M84 100 Q154 84 224 100 Q230 116 214 120 Q154 106 92 120 Q78 114 84 100 Z' : 'M80 102 Q150 86 220 102 Q226 118 210 122 Q150 108 90 122 Q74 116 80 102 Z';
    let fuzz = '';                                                    // textura de angora: pelillos cortos
    for (let i = 0; i < 46; i++) { const x = (tq ? 104 : 100) + (i * 37) % 100, y = 54 + (i * 23) % 44; fuzz += `M${x} ${y} l${(i % 3) - 1} 3`; }
    return CL(crown, '#c8102e') + LINE(fuzz, '#7d0a1d', 1.2, .55) + CL(brim, '#b30e28') + FOLD(tq ? 'M92 112 Q154 98 216 112' : 'M88 114 Q150 100 212 114', .3);
  };
  // REGUETÓN · gorra plana de visera recta, ladeada (Barrio Fino → Bad Bunny)
  const FLATCAP = (c, under) => (v) =>
    v === 'tq'
      ? CL('M94 104 C92 70 120 52 152 52 C186 52 212 72 214 104 Q154 92 94 104 Z', c) + `<circle cx="152" cy="52" r="3.5" fill="${c}"/>` +
        `<path d="M100 103 L50 100 L54 110 L104 112 Z" fill="${under}"/>` + CL('M100 101 L48 98 L50 104 L102 108 Z', c) +     // visera plana, recta
        FOLD('M152 52 Q130 70 122 100 M152 52 Q176 70 186 96', .35) + `<text x="168" y="92" font-family="Georgia,serif" font-weight="900" font-size="18" fill="url(#ch-gold)">P</text>`
      : CL('M90 106 C88 70 120 56 150 56 C180 56 212 70 210 106 Q150 94 90 106 Z', c) +
        `<path d="M96 105 L46 102 L50 112 L100 114 Z" fill="${under}"/>` + CL('M96 103 L44 100 L46 106 L98 110 Z', c);
  // gafas oscuras / envolventes (lente según el género)
  const SHADES = (lens) => (v) => v === 'back' ? '' : v === 'tq'
    ? `<path d="M117 106 Q160 99 214 107 L212 125 Q168 133 121 129 Q113 118 117 106 Z" fill="${lens}"/>` +
      LINE('M122 110 Q160 104 208 111', '#fff', 1.6, .55) + LINE('M117 110 L92 108', '#111', 3)
    : `<path d="M88 106 Q150 97 212 106 L210 127 Q150 135 90 127 Z" fill="${lens}"/>` + LINE('M94 110 Q150 102 206 110', '#fff', 1.6, .5);
  // TECHNO · envolventes de espejo iridiscente, tipo visor
  const MIRROR = (v) => v === 'back' ? '' : v === 'tq'
    ? `<path d="M112 104 Q162 94 218 104 L216 124 Q172 136 118 130 Q108 118 112 104 Z" fill="url(#ch-mirror)" stroke="#2b2f36" stroke-width="1.6"/>` +
      LINE('M120 110 Q164 102 210 109', '#fff', 2, .8) + LINE('M112 110 L90 107', '#1a1c20', 3.4)
    : `<path d="M84 104 Q150 94 216 104 L213 126 Q150 138 87 126 Z" fill="url(#ch-mirror)" stroke="#2b2f36" stroke-width="1.6"/>` + LINE('M92 110 Q150 101 208 110', '#fff', 2, .8);
  // REGUETÓN · gafas pequeñas de lente rosa-atardecer (Bad Bunny)
  const PINKGLASSES = (v) => v === 'back' ? '' : v === 'tq'
    ? `<ellipse cx="146" cy="120" rx="15" ry="10" transform="rotate(-8 146 120)" fill="url(#ch-pinklens)" stroke="url(#ch-gold)" stroke-width="1.8"/>` +
      `<ellipse cx="209" cy="118" rx="3.5" ry="8" fill="url(#ch-pinklens)" stroke="url(#ch-gold)" stroke-width="1.4"/>` +
      LINE('M161 117 Q184 112 206 115', '#c9a03a', 1.6) + LINE('M131 117 L96 110', '#c9a03a', 1.6)
    : `<ellipse cx="116" cy="118" rx="14" ry="10" fill="url(#ch-pinklens)" stroke="url(#ch-gold)" stroke-width="1.8"/>` +
      `<ellipse cx="184" cy="118" rx="14" ry="10" fill="url(#ch-pinklens)" stroke="url(#ch-gold)" stroke-width="1.8"/>` + LINE('M130 116 Q150 110 170 116', '#c9a03a', 1.6);
  // LO-FI · beanie de punto y auriculares grandes de diadema
  const BEANIE = (c) => (v) =>
    CL(v === 'tq' ? 'M92 112 C90 70 118 48 152 48 C188 48 214 70 214 112 Z' : 'M90 112 C88 70 118 50 150 50 C182 50 212 70 210 112 Z', c) +
    CL(v === 'tq' ? 'M90 100 Q152 86 216 100 L216 118 Q152 104 90 120 Z' : 'M88 100 Q150 86 212 100 L212 118 Q150 104 88 120 Z', c) +
    `<g opacity=".3">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => FOLD(`M${98 + i * 11} ${96 - (i > 5 ? (10 - i) : i) * 1.3} l0 18`, .6)).join('')}</g>`;
  const HEADPHONES_ON = (v) => v === 'back' ? '' :
    LINE(v === 'tq' ? 'M96 126 C88 76 120 44 156 44 C194 46 218 76 216 120' : 'M94 126 C86 76 116 46 150 46 C184 46 214 76 206 126', '#2b2b30', 7) +
    CL(v === 'tq' ? 'M84 112 C84 102 96 98 104 104 L108 150 C100 158 86 152 84 142 Z' : 'M80 112 C80 102 92 98 100 104 L104 150 C96 158 82 152 80 142 Z', '#33333a') +
    CL(v === 'tq' ? 'M210 108 C216 104 222 110 222 118 L220 140 C218 146 212 146 210 142 Z' : 'M200 104 C208 98 220 102 220 112 L220 142 C218 152 204 158 196 150 Z', '#33333a');
  // POP · micro de diadema fino (el "Madonna mic")
  const HEADSET = (v) => v === 'back' ? '' : v === 'tq'
    ? LINE('M112 132 C118 158 146 170 176 162', '#1f1f23', 2) + `<ellipse cx="178" cy="162" rx="3.6" ry="3" fill="#1f1f23"/>`
    : LINE('M96 132 C100 158 120 170 138 166', '#1f1f23', 2) + `<ellipse cx="140" cy="166" rx="3.6" ry="3" fill="#1f1f23"/>`;
  // ROCK · delineador negro corrido alrededor del ojo
  const LINER = (v) => {
    if (v === 'back') return '';
    const eye = (x, y, dir) => LINE(`M${x - 15 * dir} ${y} Q${x} ${y + 16} ${x + 15 * dir} ${y - 2}`, '#141214', 9, .22) +      // difuminado
      LINE(`M${x - 15 * dir} ${y} Q${x} ${y + 14} ${x + 15 * dir} ${y - 2}`, '#141214', 3, .75) +                                 // raya
      LINE(`M${x - 15 * dir} ${y} L${x - 23 * dir} ${y - 6}`, '#141214', 3, .75);                                                 // ala
    return v === 'tq' ? eye(146, 121, 1) : eye(116, 119, 1) + eye(184, 119, -1);
  };
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

  // ---------- oreja de delante (la izquierda) ----------
  const BOW = (c, c2) => () => EAR_G(                                  // POP · lazo grande rosa
    CL('M126 40 C108 24 94 32 97 46 C100 60 114 54 126 40 Z', c) + CL('M126 40 C144 24 158 32 155 46 C152 60 138 54 126 40 Z', c) +
    CL('M124 42 L114 70 L120 68 L124 76 L127 44 Z', c2) + CL('M128 42 L138 70 L132 68 L128 76 L127 44 Z', c2) +
    `<ellipse cx="126" cy="41" rx="6" ry="5.5" fill="${c2}"/>` + LINE('M106 36 Q112 32 118 36 M136 36 Q142 32 148 36', '#fff', 1.6, .45));
  const HEART_EARRING = () => EAR_G(                                   // POP · pendiente de corazón
    `<circle cx="101" cy="44" r="2.4" fill="url(#ch-gold)"/>` + LINE('M101 46 L101 52', '#d4a537', 1.6) +
    `<path d="M101 64 C93 58 91 53 95 50 C97.5 48.5 100 49.5 101 51.5 C102 49.5 104.5 48.5 107 50 C111 53 109 58 101 64 Z" fill="#ff7eb6" stroke="#d4a537" stroke-width="1.2"/>`);
  const HOOP_CROSS = () => EAR_G(                                      // ROCK · aro de plata con cruz colgando
    `<circle cx="100" cy="46" r="6.5" fill="none" stroke="#c9ced6" stroke-width="2.6"/>` +
    `<path d="M98.6 52.5 h2.8 v4 h3.4 v2.8 h-3.4 v8 h-2.8 v-8 h-3.4 v-2.8 h3.4 Z" fill="#d6dbe0" stroke="#4a4f56" stroke-width=".7"/>`);

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
    CL('M84 184 Q152 218 220 184 L222 204 Q152 240 82 204 Z', '#d2574a') +
    `<g opacity=".35">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => FOLD(`M${92 + i * 11} ${196 + Math.sin(i / 11 * Math.PI) * 18} l1 14`, .7)).join('')}</g>` +
    CL('M176 210 L196 206 L202 262 L184 266 Z', '#c84d41') + FOLD('M180 262 l1 6 M186 262 l1 6 M192 261 l1 6 M198 260 l1 6', .5);

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
  // TECHNO · glow stick verde (rave de los 90): halo con trazo translúcido, sin filtros
  const GLOWSTICK = `<g transform="rotate(-20 128 338)">` + LINE('M128 300 L128 352', '#9dff6a', 14, .18) + LINE('M128 302 L128 350', '#9dff6a', 7, .9) + LINE('M127 304 L127 348', '#efffe6', 2.2) + `</g>`;
  // ROCK · muñequera de cuero con tachuelas
  const STUDS = `<path d="M100 314 Q127 322 154 314 L154 328 Q127 336 100 328 Z" fill="#141416"/>` +
                `<g fill="url(#ch-silver)">${[108, 118, 128, 138, 148].map((x) => `<circle cx="${x}" cy="${322 + (x - 127) ** 2 / 400}" r="2.6"/>`).join('')}</g>`;

  // Minimalistas a propósito: 2-3 piezas que dicen el género, el cuerpo y el pelo siempre a la vista.
  window.ChupitsOutfits = {
    rap:       { label: 'Rap',           head: KANGOL, neck: ROPE_MEDALLION, prop: () => KNUCKLE_RING },
    trap:      { label: 'Trap',          head: SHADES('#0d0c10'), neck: () => DEFS + ICED() },
    reggaeton: { label: 'Reguetón',      head: (v) => DEFS + FLATCAP('#141416', '#2bff88')(v) + PINKGLASSES(v), neck: GOLD_CROSS },
    techno:    { label: 'Techno',        head: (v) => DEFS + MIRROR(v), neck: FINE_SILVER, chest: HARNESS, prop: () => GLOWSTICK },
    pop:       { label: 'Pop',           ear: () => DEFS + BOW('#ffb3d1', '#f28dbb')() + HEART_EARRING(), head: HEADSET },
    rock:      { label: 'Rock / Punk',   ear: HOOP_CROSS, head: LINER, propL: () => STUDS },
    lofi:      { label: 'Lo-fi / Chill', head: (v) => BEANIE('#7a5aa6')(v) + HEADPHONES_ON(v), neck: SCARF },
    lucha:     { label: 'Lucha',         head: MASK },
  };
  // qué outfit va con cada baile (modo Auto)
  window.ChupitsOutfits.byPose = { rap: 'rap', trap: 'trap', reggaeton: 'reggaeton', techno: 'techno', pop: 'pop', chill: 'lofi' };
})();
