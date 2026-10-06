// Chupits — rig 2D de la mascota de Poptify (estilo realista, vista principal 3/4).
// Un único esqueleto SVG por piezas (orejas, cabeza, cuerpo, patas) con pivotes fijos.
// Cada pose = transformaciones estáticas por pieza + clase CSS con la animación (a tempo vía --b).
// Las piezas animables van en dos capas: <g class="P"> (pose estática) > <g class="a-P"> (animación),
// así los outfits se podrán colgar de la misma pieza y heredar pose y baile sin redibujar nada.
// El pelaje no se dibuja a mano: furrify() lo genera sobre cada forma .fur ya en el DOM.
(function () {
  // pivotes en coordenadas del viewBox (0 -40 300 420)
  const PIV = {
    root: [150, 352], body: [150, 350], head: [150, 180],
    earL: [128, 84], earR: [172, 84], armL: [128, 244], armR: [172, 244],
    legL: [112, 340], legR: [188, 340],
  };

  // ---------- poses ----------
  // r = rotación (grados, horario), x/y = desplazamiento, sx/sy = escala desde el pivote
  // armsFront: brazos delante de la cabeza (bailes que los suben por encima de los hombros)
  const POSES = {
    stand:  { label: 'De pie',   bpm: 0,   expr: 'grumpy', parts: { head: { r: 4 } } },
    sit:    { label: 'Sentado',  bpm: 0,   expr: 'grumpy', sit: true,
              parts: { head: { y: 30 }, armL: { y: 22, r: -2 }, armR: { y: 22, r: 2 } } },
    jump:   { label: 'Saltando', bpm: 100, expr: 'shout', armsFront: true,
              parts: { armL: { r: 115, x: -16 }, armR: { r: -115, x: 16 }, earL: { r: -30 }, earR: { r: 30 },
                       legL: { r: 26, y: 8 }, legR: { r: -26, y: 8 } } },
    bored:  { label: 'Aburrido', bpm: 0,   expr: 'bored', sit: true, zzz: true,
              parts: { head: { y: 36, r: 12 }, armL: { y: 22, r: -2 }, armR: { y: 22, r: 4 },
                       earL: { r: -60 }, earR: { r: 10 } } },
    rap:    { label: 'Rap',      bpm: 90,  expr: 'grumpy',
              parts: { armR: { r: -78, x: 10 }, armL: { r: -4 }, earL: { r: -8 }, head: { r: 3 } } },
    techno: { label: 'Techno',   bpm: 128, expr: 'closed',
              parts: { armR: { r: -150, x: 26, y: -8 }, armL: { r: 8 }, earL: { r: -6 }, earR: { r: 4 } } },
    reggaeton: { label: 'Reguetón', bpm: 95, expr: 'smug',
              parts: { armL: { r: -60, sx: .9, sy: .66 }, armR: { r: 60, sx: .9, sy: .66 }, earL: { r: -10 } } },
    trap:   { label: 'Trap',     bpm: 70,  expr: 'grumpy',
              parts: { armL: { sx: .9, sy: .7 }, armR: { sx: .9, sy: .7 }, head: { r: 6, y: 3 }, earL: { r: -18 }, earR: { r: 14 } } },
    pop:    { label: 'Pop',      bpm: 118, expr: 'grin', armsFront: true,
              parts: { armL: { x: -14, sx: .9, sy: .7 }, armR: { x: 14, sx: .9, sy: .7 }, earL: { r: -8 }, earR: { r: 6 } } },
    chill:  { label: 'Chill',    bpm: 80,  expr: 'closed', sit: true,
              parts: { head: { y: 30 }, armL: { y: 22, r: -2 }, armR: { y: 22, r: 2 }, earR: { r: 10 } } },
  };

  function T(name, p) {
    if (!p) return '';
    const [px, py] = PIV[name];
    let t = '';
    if (p.x || p.y) t += `translate(${p.x || 0} ${p.y || 0}) `;
    if (p.r) t += `rotate(${p.r} ${px} ${py}) `;
    if (p.sx || p.sy) t += `translate(${px} ${py}) scale(${p.sx || 1} ${p.sy || 1}) translate(${-px} ${-py})`;
    return t.trim();
  }
  // pieza = pose estática + capa animable con su pivote como transform-origin
  function part(name, pose, inner) {
    const [px, py] = PIV[name];
    return `<g class="${name}" transform="${T(name, pose.parts && pose.parts[name])}">` +
      `<g class="a-${name}" style="transform-origin:${px}px ${py}px">${inner}</g></g>`;
  }
  const mirror = (s) => `<g transform="translate(300 0) scale(-1 1)">${s}</g>`;
  const E = (cx, cy, rx, ry) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
  // forma con pelo: data-flow = hacia dónde cae el pelo, data-fl = largo, data-fd = densidad
  const FUR = (d, flow = 'down', fl = 7, fd = 1, cls = '') =>
    `<path class="fur ${cls}" fill="url(#ch-fur)" d="${d}" data-flow="${flow}" data-fl="${fl}" data-fd="${fd}"/>`;
  // capa de pelo que va encima de otra: sin borde sombreado ni degradado propio, para que no marque una raya
  const OVER = (d, fl) => `<path class="fur over" fill="#f6f3f0" d="${d}" data-flow="down" data-fl="${fl}" data-fd="1.2" data-ns="1"/>`;
  const AO = (cx, cy, rx, ry, o = 0.45) => `<ellipse class="ao" fill="url(#ch-dark)" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" opacity="${o}"/>`;

  // los ids llevan el prefijo ch- y render() los hace únicos por ilustración
  const DEFS =
    `<defs>` +
    `<radialGradient id="ch-fur" cx=".45" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#f5f2ef"/><stop offset=".8" stop-color="#dcd4cf"/><stop offset="1" stop-color="#aaa09a"/></radialGradient>` +
    `<linearGradient id="ch-ear" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#cf9a96"/><stop offset=".55" stop-color="#e9c3bd"/><stop offset="1" stop-color="#f4e2de"/></linearGradient>` +
    `<radialGradient id="ch-eye" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#4d4448"/><stop offset=".45" stop-color="#1b1618"/><stop offset="1" stop-color="#040304"/></radialGradient>` +
    `<radialGradient id="ch-nose" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#f4c9c9"/><stop offset="1" stop-color="#d49a9c"/></radialGradient>` +
    `<linearGradient id="ch-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#565b62"/><stop offset=".28" stop-color="#f8fafc"/><stop offset=".5" stop-color="#9ea5ad"/><stop offset=".72" stop-color="#e6eaee"/><stop offset="1" stop-color="#3f444a"/></linearGradient>` +
    // sombras y brillos difusos con degradados radiales, no con blur: un filtro se recalcula en cada fotograma
    `<radialGradient id="ch-dark"><stop offset="0" stop-color="#3d3431"/><stop offset="1" stop-color="#3d3431" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="ch-shade"><stop offset="0" stop-color="#9b8f89"/><stop offset="1" stop-color="#9b8f89" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="ch-lite"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="ch-cloth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>` +
    `<linearGradient id="ch-clothx" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>` +
    `<linearGradient id="ch-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset=".4" stop-color="#e2b23e"/><stop offset="1" stop-color="#8a5f12"/></linearGradient>` +
    `<linearGradient id="ch-silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#b9c0c8"/><stop offset="1" stop-color="#5b6168"/></linearGradient>` +
    `<radialGradient id="ch-refl"><stop offset="0" stop-color="#9c99a2"/><stop offset="1" stop-color="#9c99a2" stop-opacity="0"/></radialGradient>` +
    `</defs>`;

  // ---------- piezas ----------
  // oreja larga y translúcida; back = vista por detrás (sin rosa); la derecha lleva un mordisco
  const EAR = (back, notch) =>
    `<g transform="rotate(-10 128 84)">` +
    FUR(notch
      ? 'M114 92 C100 56 99 30 100 16 Q108 13 108 6 Q106 -1 101 -3 C102 -16 108 -26 118 -32 C126 -44 142 -40 146 -24 C152 6 148 56 142 90 Z'
      : 'M114 92 C100 56 100 4 118 -32 C126 -44 142 -40 146 -24 C152 6 148 56 142 90 Z', 'up', 6, 1.2) +
    (back ? '' :
      `<path class="inner" fill="url(#ch-ear)" d="M122 80 C112 52 112 10 124 -18 C129 -26 137 -24 139 -14 C143 10 141 52 137 78 Z"/>` +
      `<path class="vein" d="M129 70 C126 44 127 14 131 -6 M133 52 C134 36 136 22 135 8"/>`) +
    `</g>`;

  // ojo realista: globo negro brillante; el pelo de la cara hace de párpado (cover 0 = abierto, 1 = cerrado).
  // tilt baja un poco el lado del lagrimal: mirada de mala uva sin convertir el ojo en rendija.
  let eyeN = 0;
  function EYE(cx, cy, rx, ry, rot, cover, tilt = 2.5) {
    const id = 'ch-e' + (++eyeN);
    const lid = cy - ry + 2 * ry * cover, lidIn = Math.min(cy + ry, lid + tilt);
    const lidD = `M${cx - rx - 3} ${lid} Q${cx} ${lid + 3} ${cx + rx + 3} ${lidIn}`;
    return `<g transform="rotate(${rot} ${cx} ${cy})">` +
      `<clipPath id="${id}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>` +
      `<clipPath id="${id}l"><path d="${lidD} L${cx + rx + 3} ${cy + ry + 3} L${cx - rx - 3} ${cy + ry + 3} Z"/></clipPath>` +
      `<ellipse class="socket" fill="url(#ch-shade)" cx="${cx}" cy="${cy + 1}" rx="${rx + 3}" ry="${ry + 3}"/>` +
      (cover < 0.97
        ? `<g clip-path="url(#${id})"><g clip-path="url(#${id}l)">` +
            `<ellipse class="eyeball" fill="url(#ch-eye)" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>` +
            `<ellipse class="refl" fill="url(#ch-refl)" cx="${cx + rx * 0.35}" cy="${cy - ry * 0.1}" rx="${rx * 0.45}" ry="${ry * 0.35}"/>` +
            `<ellipse class="glint" cx="${cx + rx * 0.3}" cy="${Math.max(lid + 3, cy - ry * 0.35)}" rx="${rx * 0.22}" ry="${ry * 0.16}"/>` +
          `</g></g>`
        : '') +
      `<ellipse class="rim" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" clip-path="url(#${id}l)"/>` +
      `<path class="lash" d="M${cx - rx - 1} ${lid + 0.3} Q${cx} ${lid + 3.3} ${cx + rx + 1} ${lidIn + 0.3}"/>` +
      `<path class="lidfold" d="M${cx - rx} ${lid - 4} Q${cx} ${lid - 2} ${cx + rx} ${lidIn - 4}"/>` +
      `</g>`;
  }
  const COVER = { grumpy: .34, smug: .3, closed: 1, bored: .58, shout: .08, grin: .5 };

  // cabeza en 3/4 mirando a la derecha (la vista principal, como la foto de referencia)
  function HEAD_TQ(expr, pose) {
    const c = COVER[expr] ?? .34;
    const open = expr === 'shout';
    const up = expr === 'smug' || expr === 'grin';
    const mouth = open
      ? `<ellipse class="mouth" cx="192" cy="160" rx="4" ry="3.2"/>`
      : `<path class="lip" d="M192 149 L192 155 M192 155 Q187 159 ${up ? '181 156' : '181 160'} M192 155 Q197 158 ${expr === 'grin' ? '204 149' : up ? '203 152' : '202 159'}"/>`;
    return part('earR', pose, mirror(EAR(true, true))) +                         // oreja de detrás: se le ve el dorso
      part('earL', pose, EAR(false) + slot('ear')) + slot('headBack') +
      AO(152, 186, 50, 12, 0.5) +
      FUR('M140 64 C178 60 206 82 214 112 C220 132 218 150 208 162 C198 178 176 190 150 190 C124 190 100 180 92 160 C82 138 86 104 100 84 C110 70 124 64 140 64 Z', 'out:165,130', 9, 1.1) +
      `<g class="face">` +
      `<ellipse class="brow" fill="url(#ch-shade)" cx="146" cy="100" rx="22" ry="8"/>` +
      `<g class="a-eyes" style="transform-origin:150px 118px">` +
        EYE(146, 119, 15, 12.5, -8, c) +
        EYE(208.5, 118, 2.6, 8, 4, Math.min(1, c + .05), 0) +                    // ojo de detrás: apenas una rodaja
      `</g>` +
      FUR(E(185, 154, 11, 8), 'out:192,150', 3, 1.4, 'pad') + FUR(E(200, 152, 8, 7), 'out:192,150', 3, 1.4, 'pad') +
      (open ? '' : FUR(E(191, 168, 8, 6), 'down', 3, 1.4, 'pad')) +
      mouth +
      `<g class="dots"><circle cx="180" cy="151" r=".9"/><circle cx="183" cy="156" r=".9"/><circle cx="178" cy="157" r=".9"/><circle cx="203" cy="150" r=".9"/></g>` +
      `<path class="nose" fill="url(#ch-nose)" d="M186 141 Q192 138 198 141 Q195.5 147 192 148 Q188.5 147 186 141 Z"/>` +
      `<g class="whisk"><path d="M200 152 C226 144 246 140 272 142 M202 156 C228 158 250 164 270 176 M200 160 C220 170 234 182 246 198"/>` +
      `<path d="M178 154 C160 150 146 150 128 154 M178 158 C164 162 152 168 140 178"/></g>` +
      `</g>`;
  }

  // cabeza de frente (para la vista frontal y las tarjetas de turnaround)
  function HEAD_FRONT(expr, pose, back) {
    const c = COVER[expr] ?? .34;
    const open = expr === 'shout';
    const up = expr === 'smug' || expr === 'grin';
    const mouth = open
      ? `<ellipse class="mouth" cx="150" cy="161" rx="4.5" ry="3.4"/>`
      : `<path class="lip" d="M150 152 L150 158 M150 158 Q144 162 ${up ? '138 159' : '138 163'} M150 158 Q156 162 ${expr === 'grin' ? '163 151' : up ? '162 154' : '162 163'}"/>`;
    return part('earL', pose, EAR(back) + slot('ear')) + part('earR', pose, mirror(EAR(back, true))) + slot('headBack') +
      AO(150, 184, 48, 12, 0.5) +
      FUR(E(104, 152, 22, 20), 'out:150,130', 9, 1) + FUR(E(196, 152, 22, 20), 'out:150,130', 9, 1) +
      FUR('M150 66 C188 66 208 92 210 122 C212 146 204 166 186 176 C174 183 162 186 150 186 C138 186 126 183 114 176 C96 166 88 146 90 122 C92 92 112 66 150 66 Z',
          back ? 'down' : 'out:150,140', 6, 1) +
      (back ? '' :
        `<g class="face">` +
        `<ellipse class="brow" fill="url(#ch-shade)" cx="116" cy="101" rx="18" ry="7"/><ellipse class="brow" fill="url(#ch-shade)" cx="184" cy="101" rx="18" ry="7"/>` +
        `<g class="a-eyes" style="transform-origin:150px 116px">${EYE(116, 117, 12.5, 11.5, -4, c)}${mirror(EYE(116, 117, 12.5, 11.5, -4, c))}</g>` +
        FUR(E(142, 153, 11, 8), 'out:150,150', 3, 1.4, 'pad') + FUR(E(158, 153, 11, 8), 'out:150,150', 3, 1.4, 'pad') +
        (open ? '' : FUR(E(150, 168, 9, 6), 'down', 3, 1.4, 'pad')) +
        mouth +
        `<path class="nose" fill="url(#ch-nose)" d="M144.5 141 Q150 138 155.5 141 Q153 147 150 148 Q147 147 144.5 141 Z"/>` +
        `<g class="whisk"><path d="M135 152 C110 146 84 142 52 148 M135 156 C108 158 80 162 54 172 M137 160 C116 168 98 178 78 196"/>` +
        `<path d="M165 152 C190 146 216 142 248 148 M165 156 C192 158 220 162 246 172 M163 160 C184 168 202 178 222 196"/></g>` +
        `</g>`);
  }

  // collar: cinta fina casi tapada por el pelo y pinchos cónicos cromados en abanico.
  // half = 'back' (los que asoman por detrás de la cabeza) o 'front'
  function COLLAR(half) {
    const cx = 152, cy = 182, rx = 66, ry = 24;
    let s = half === 'front'
      // cinta de cuero negra, a la vista (antes la tapaba un mechón de pelo y no se leía negra)
      ? `<path class="band" d="M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}"/>` +
        `<path class="band-hl" d="M${cx - rx + 6} ${cy + 2} A${rx - 6} ${ry - 4} 0 0 0 ${cx + rx - 6} ${cy + 2}"/>`
      : '';
    for (let k = 0; k < 14; k++) {
      const th = (k / 14) * Math.PI * 2 + 0.2;
      const front = Math.sin(th) > 0.05;
      if ((half === 'front') !== front) continue;
      const x = cx + rx * Math.cos(th), y = cy + ry * Math.sin(th);
      const ang = Math.atan2(Math.sin(th) * 0.8, Math.cos(th)) * 180 / Math.PI;
      const len = front ? 18 + 18 * Math.abs(Math.cos(th)) : 30;       // los de delante apuntan a cámara: escorzo
      const w = 11;
      s += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})">` +
           `<path class="spike" fill="url(#ch-chrome)" d="M-2 ${-w / 2} L${len} 0 L-2 ${w / 2} Q-6 0 -2 ${-w / 2} Z"/>` +
           (k % 5 === 1 ? `<path class="spark" d="M${len * .55} -9 L${len * .55 + 1} -1 L${len * .55 + 9} 0 L${len * .55 + 1} 1 L${len * .55} 9 L${len * .55 - 1} 1 L${len * .55 - 9} 0 L${len * .55 - 1} -1 Z"/>` : '') +
           `</g>`;
    }
    return s;
  }

  // vestido, el pelo del cuerpo es corto: si no, asoma por los lados de la ropa
  const BODY = (back, clothed) =>
    FUR('M150 168 C206 168 230 222 230 284 C230 332 208 356 150 356 C92 356 70 332 70 284 C70 222 94 168 150 168 Z', 'down', clothed ? 3 : 10, 1) +
    `<ellipse class="thigh" fill="url(#ch-shade)" cx="96" cy="318" rx="26" ry="34"/><ellipse class="thigh" fill="url(#ch-shade)" cx="204" cy="318" rx="26" ry="34"/>` +
    (back ? '' : `<ellipse class="belly" fill="url(#ch-lite)" cx="150" cy="286" rx="46" ry="54"/>` +
                 FUR(E(152, 212, 58, 34), 'down', 13, 1.1));                                 // pechera
  // segunda capa de pechera por encima del arranque de las patas: así nacen del pelo, no se pegan encima
  const RUFF = OVER('M98 222 Q150 206 202 222 Q206 246 186 258 Q150 272 114 258 Q94 246 98 222 Z', 12);

  // pata delantera: gruesa, nace bajo la pechera y cuelga pegada a la otra hasta abajo, como en la foto
  const ARM =
    `<ellipse class="ao" fill="url(#ch-dark)" cx="148" cy="304" rx="6" ry="44" opacity=".5"/>` +
    FUR('M110 236 C102 262 104 296 106 322 C106 340 116 350 130 350 C144 350 150 342 149 328 C148 304 147 272 148 238 Z', 'down', 7, 1.2) +
    `<path class="toe" d="M118 346 Q120 341 119 336 M127 349 Q128 343 127 338 M137 348 Q138 343 137 338"/>`;
  // pies traseros: detrás del cuerpo, solo asoma la punta
  const FOOT = AO(116, 356, 28, 4, 0.6) + FUR(E(114, 351, 24, 8), 'out:114,340', 5, 1.2);
  const FOOT_SIT = AO(112, 356, 28, 4, 0.6) + FUR(E(108, 351, 26, 9), 'out:108,340', 5, 1.2);
  const TAIL = FUR(E(150, 322, 20, 18), 'out:150,322', 9, 1.4);

  // outfit: capas por hueco (ver outfits.js). Cada hueco se pinta dentro de la pieza del rig que lo mueve.
  let OF = null, OV = 'tq';
  const slot = (name, ...a) => (OF && OF[name] ? OF[name](OV, ...a) : '');

  function body(pose, opt) {
    const view = opt.view || 'tq';
    OF = opt.outfit && window.ChupitsOutfits ? window.ChupitsOutfits[opt.outfit] || null : null;
    OV = view;
    const back = view === 'back';
    const sit = !!pose.sit;
    const expr = opt.expr || pose.expr;
    const legs = part('legL', pose, (sit ? FOOT_SIT : FOOT) + slot('shoe', 'L')) + part('legR', pose, mirror((sit ? FOOT_SIT : FOOT) + slot('shoe', 'R')));
    const shoesFront = !!(OF && OF.shoe);
    const bodyPose = sit ? { parts: { body: { sy: 0.86 } } } : pose;
    const collar = opt.collar !== false;
    const head = part('head', pose,
      (collar ? COLLAR('back') : '') +
      `<g transform="translate(150 188) scale(.94) translate(-150 -188)">` +
      (view === 'tq' ? HEAD_TQ(expr, pose) : HEAD_FRONT(expr, pose, back)) + slot('head') + `</g>` +
      (collar ? COLLAR('front') : '') + slot('neck'));
    const arms = part('armL', pose, ARM + slot('sleeve', 'L') + slot('propL')) + part('armR', pose, mirror(ARM + slot('sleeve', 'R') + slot('prop')));
    const clothed = !!(OF && OF.torso && OF.pants);
    const clothes = (OF && (OF.torso || OF.pants))
      ? `<g transform="translate(150 0) scale(1.05 1) translate(-150 0)">${slot('pants') + slot('torso')}</g>` : '';
    return (shoesFront && !back ? '' : legs) +
      (back ? arms : '') +
      part('body', bodyPose, BODY(back, clothed) + clothes) +
      (back ? (sit ? `<g transform="translate(0 10)">${TAIL}</g>` : TAIL)
            : (shoesFront ? legs : '') + (pose.armsFront ? '' : arms) + (OF && OF.torso ? '' : part('body', bodyPose, RUFF)) +
              (OF && OF.chest ? part('body', bodyPose, slot('chest')) : '')) +     // arnés y similares, sobre la pechera
      head + (pose.armsFront && !back ? arms : '');
  }

  // perfil (mirando a la derecha): dibujo propio, mismo pelaje y paleta
  function side(opt) {
    return FUR(E(84, 296, 17, 15), 'out:84,296', 9, 1.4) +                                              // cola
      `<g transform="rotate(-30 150 80)">${FUR('M134 90 C120 56 120 4 138 -32 C146 -44 162 -40 166 -24 C172 6 168 56 162 88 Z', 'up', 6, 1.2)}</g>` +
      FUR('M140 176 C96 182 80 236 84 284 C88 330 124 350 168 348 C206 346 216 310 208 266 C200 222 182 172 140 176 Z', 'down', 9, 1) +
      FUR(E(124, 306, 48, 40), 'out:150,290', 8, 1) +
      AO(150, 351, 56, 5, 0.6) + FUR('M100 344 C120 336 180 336 200 342 C208 348 198 353 180 353 L106 353 C96 353 94 347 100 344 Z', 'out:150,340', 5, 1.2) +
      FUR(E(188, 208, 32, 30), 'down', 13, 1.1) +
      FUR('M180 240 C188 262 190 300 192 330 C193 342 206 344 208 336 C206 310 204 270 196 244 Z', 'down', 6, 1.2) +
      `<g transform="rotate(-14 150 80)">${FUR('M138 90 C124 56 124 4 142 -32 C150 -44 166 -40 170 -24 C176 6 172 56 166 88 Z', 'up', 6, 1.2)}` +
        `<path class="inner" fill="url(#ch-ear)" d="M146 80 C136 52 136 8 148 -20 C153 -28 161 -26 163 -16 C167 10 165 52 161 78 Z"/></g>` +
      FUR('M112 118 C112 84 146 66 180 72 C210 78 230 102 234 128 C236 146 226 158 212 164 C196 176 160 182 136 174 C118 168 112 146 112 118 Z', 'out:200,130', 6, 1) +
      FUR(E(186, 150, 24, 20), 'out:200,140', 8, 1) +
      (opt.collar !== false
        ? `<path class="band" d="M118 172 Q156 200 198 182"/>` +
          [[122, 176, 150, 30], [140, 190, 115, 26], [162, 196, 90, 22], [184, 190, 60, 26], [200, 182, 30, 30]].map(([x, y, a, l]) =>
            `<g transform="translate(${x} ${y}) rotate(${a})"><path class="spike" fill="url(#ch-chrome)" d="M-2 -5.5 L${l} 0 L-2 5.5 Q-6 0 -2 -5.5 Z"/></g>`).join('')
        : '') +
      `<ellipse class="brow" fill="url(#ch-shade)" cx="190" cy="98" rx="18" ry="7"/>` +
      EYE(190, 113, 13, 12, -6, .34) +
      FUR(E(222, 146, 12, 9), 'out:222,146', 3, 1.4, 'pad') + FUR(E(214, 162, 9, 6), 'down', 3, 1.4, 'pad') +
      `<path class="nose" fill="url(#ch-nose)" d="M226 132 Q234 131 235 138 Q231 143 226 141 Z"/>` +
      `<path class="lip" d="M232 141 Q230 150 224 154"/>` +
      `<g class="whisk"><path d="M226 148 C246 142 262 140 286 144 M226 152 C248 154 266 160 284 170 M224 156 C240 166 252 176 266 192"/></g>`;
  }

  let uidN = 0;
  function render(opt = {}) {
    const pose = POSES[opt.pose || 'stand'];
    const view = opt.view || 'tq';
    const bpm = opt.bpm || pose.bpm || 90;
    const uid = 'ch' + (++uidN) + '-';
    return (`<svg class="chupits pose-${opt.pose || 'stand'} view-${view}" viewBox="${opt.vb || '0 -40 300 420'}" style="--b:${(60 / bpm).toFixed(3)}s">` +
      DEFS + `<ellipse class="shadow" fill="url(#ch-dark)" cx="150" cy="354" rx="96" ry="12" style="transform-origin:150px 354px"/>` +
      `<g><g class="a-root" style="transform-origin:150px 352px">` +
      `<ellipse class="halo" fill="url(#ch-lite)" cx="150" cy="190" rx="135" ry="200"/>` +
      (view === 'side' ? side(opt) : body(pose, opt)) +
      (pose.zzz && view !== 'side' ? `<g class="zzz"><text x="214" y="70">z</text><text x="232" y="44">z</text><text x="252" y="16">Z</text></g>` : '') +
      `</g></g></svg>`).replace(/\bch-/g, uid);
  }

  // ---------- pelaje procedural ----------
  // Recorre el contorno de cada forma .fur y le planta mechones (cortos + algún mechón largo suelto)
  // siguiendo data-flow, más pelo fino por dentro para la textura. Todo se agrupa en 5 <path> por forma.
  // Las formas no cambian entre poses (la pose solo las gira), así que el pelo de cada una se calcula
  // una vez y se cachea: cambiar de pose o de baile no vuelve a generar nada.
  const furCache = new Map();
  function furFor(path, pt) {
    const fl = +path.dataset.fl || 7, fd = +path.dataset.fd || 1, flow = path.dataset.flow || 'down', ns = !!path.dataset.ns;
    const key = `${path.getAttribute('d')}|${flow}|${fl}|${fd}|${ns}`;
    if (furCache.has(key)) return furCache.get(key);
    let seed = 0;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) | 0;      // semilla fija por forma
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const inside = (x, y) => { pt.x = x; pt.y = y; return path.isPointInFill(pt); };
    const bb = path.getBBox();
    const fdir = (x, y) => {
      if (flow === 'down') return [0, 1];
      if (flow === 'up') return [0, -1];
      const [cx, cy] = flow.startsWith('out:') ? flow.slice(4).split(',').map(Number) : [bb.x + bb.width / 2, bb.y + bb.height / 2];
      const dx = x - cx, dy = y - cy + 0.001, m = Math.hypot(dx, dy);
      return [dx / m, dy / m];
    };
    const out = { el: [], ed: [], il: [], id: [], w: [] };
    const strand = (k, sx, sy, dx, dy, len, bend = 0.5) => {
      const ex = sx + dx * len, ey = sy + dy * len, b = (rnd() - 0.5) * len * bend;
      out[k].push(`M${sx.toFixed(1)} ${sy.toFixed(1)}Q${((sx + ex) / 2 - dy * b).toFixed(1)} ${((sy + ey) / 2 + dx * b).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    };
    // borde: se muestrea el contorno una sola vez y la tangente sale de los vecinos
    const L = path.getTotalLength(), step = 1.6 / fd, P = [];
    for (let l = 0; l < L; l += step * (0.6 + rnd() * 0.8)) P.push(path.getPointAtLength(l));
    for (let i = 0; i < P.length; i++) {
      const p = P[i], a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length];
      let tx = b.x - a.x, ty = b.y - a.y; const tm = Math.hypot(tx, ty) || 1; tx /= tm; ty /= tm;
      let nx = -ty, ny = tx;
      if (inside(p.x + nx * 2.5, p.y + ny * 2.5)) { nx = -nx; ny = -ny; }
      const [fx, fy] = fdir(p.x, p.y);
      let dx = nx * 0.45 + fx * 0.7 + (rnd() - 0.5) * 0.45, dy = ny * 0.45 + fy * 0.7 + (rnd() - 0.5) * 0.45;
      const dm = Math.hypot(dx, dy) || 1; dx /= dm; dy /= dm;
      const shadeSide = !ns && (ny > 0.3 || (flow === 'up' && rnd() < 0.3));
      strand(shadeSide && rnd() < 0.7 ? 'ed' : 'el', p.x - nx * 4, p.y - ny * 4, dx, dy, fl * (0.25 + rnd() * 0.6) + 4);
      if (rnd() < 0.12) strand('w', p.x - nx * 2, p.y - ny * 2, dx, dy, fl * (0.9 + rnd() * 0.9), 0.9);   // mechón suelto
    }
    // interior
    const n = Math.round((bb.width * bb.height) / (75 / fd));
    for (let i = 0; i < n; i++) {
      const x = bb.x + rnd() * bb.width, y = bb.y + rnd() * bb.height;
      if (!inside(x, y)) continue;
      const [fx, fy] = fdir(x, y);
      let dx = fx + (rnd() - 0.5) * 0.6, dy = fy + (rnd() - 0.5) * 0.6; const dm = Math.hypot(dx, dy) || 1;
      const low = (y - bb.y) / bb.height;
      strand(rnd() < 0.2 + low * 0.45 ? 'id' : 'il', x, y, dx / dm, dy / dm, fl * (0.3 + rnd() * 0.4));
    }
    const html = `<path class="s-id" d="${out.id.join('')}"/><path class="s-il" d="${out.il.join('')}"/>` +
                 `<path class="s-ed" d="${out.ed.join('')}"/><path class="s-el" d="${out.el.join('')}"/><path class="s-w" d="${out.w.join('')}"/>`;
    furCache.set(key, html);
    return html;
  }
  function furrify(root) {
    root.querySelectorAll('svg.chupits:not([data-fur])').forEach((svg) => {
      svg.dataset.fur = '1';
      const pt = svg.createSVGPoint();
      svg.querySelectorAll('path.fur').forEach((path) => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'strands');
        g.innerHTML = furFor(path, pt);
        path.after(g);
      });
    });
  }

  window.Chupits = { render, furrify, POSES };
})();
