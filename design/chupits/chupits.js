// Chupits — rig 2D de la mascota de Poptify.
// Un único esqueleto SVG por piezas (orejas, cabeza, cuerpo, brazos, pies) con pivotes fijos.
// Cada pose = transformaciones estáticas por pieza + clase CSS con la animación (a tempo vía --b).
// Las piezas animables van en dos capas: <g class="P"> (pose estática) > <g class="a-P"> (animación),
// así los outfits se podrán colgar de la misma pieza y heredar pose y baile sin redibujar nada.
(function () {
  // pivotes en coordenadas del viewBox (0 -40 300 420)
  const PIV = {
    root: [150, 350], body: [150, 345], head: [150, 196],
    earL: [124, 94], earR: [176, 94], armL: [112, 212], armR: [188, 212],
    legL: [118, 336], legR: [182, 336], eyes: [150, 140],
  };

  // ---------- poses ----------
  // r = rotación (grados, horario), x/y = desplazamiento, sx/sy = escala desde el pivote
  const POSES = {
    stand:  { label: 'De pie',   bpm: 0,   expr: 'grumpy', parts: { earR: { r: 4 }, head: { r: -4 } } },
    sit:    { label: 'Sentado',  bpm: 0,   expr: 'grumpy', sit: true,
              parts: { head: { y: 30 }, armL: { y: 26, r: -18 }, armR: { y: 26, r: 18 }, earR: { r: 10 } } },
    jump:   { label: 'Saltando', bpm: 100, expr: 'shout',
              parts: { armL: { r: 140, x: -20, y: -4 }, armR: { r: -140, x: 20, y: -4 }, earL: { r: -38 }, earR: { r: 38 },
                       legL: { r: 28, y: 8 }, legR: { r: -28, y: 8 } } },
    bored:  { label: 'Aburrido', bpm: 0,   expr: 'bored', sit: true, zzz: true,
              parts: { head: { y: 34, r: 11 }, armL: { y: 26, r: -12 }, armR: { y: 26, r: 22 },
                       earL: { r: -14 }, earR: { r: 78 } } },
    rap:    { label: 'Rap',      bpm: 90,  expr: 'grumpy',
              parts: { armR: { r: -96 }, armL: { r: -28 }, earR: { r: 16 }, head: { r: -3 } } },
    techno: { label: 'Techno',   bpm: 128, expr: 'closed',
              parts: { armR: { r: -140, x: 24, y: -6 }, armL: { r: 22 }, earL: { r: -4 }, earR: { r: 6 } } },
    reggaeton: { label: 'Reguetón', bpm: 95, expr: 'smug',
              parts: { armL: { r: 115, x: -18 }, armR: { r: -115, x: 18 }, earR: { r: 14 } } },
    trap:   { label: 'Trap',     bpm: 70,  expr: 'grumpy',
              parts: { armL: { r: 30 }, armR: { r: -30 }, head: { r: -5, y: 3 }, earL: { r: -18 }, earR: { r: 24 } } },
    pop:    { label: 'Pop',      bpm: 118, expr: 'grin',
              parts: { armL: { r: 140, x: -20, y: -4 }, armR: { r: -40 }, earL: { r: -8 }, earR: { r: 8 } } },
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

  // ---------- piezas ----------
  // orejas más anchas y abiertas en V (como la foto del cigarro); la derecha lleva un mordisco
  const EAR = (back, notch) =>
    `<g transform="rotate(-14 124 94)">` +
    (notch
      ? `<path class="fur" d="M106 98 C90 64 88 34 91 18 Q101 16 102 8 Q100 2 94 2 C98 -10 104 -20 112 -24 C124 -32 140 -24 142 -6 C146 22 143 66 137 96 Z"/>`
      : `<path class="fur" d="M106 98 C88 60 88 8 110 -22 C122 -34 140 -26 142 -6 C146 22 143 66 137 96 Z"/>`) +
    (back
      ? `<path class="shade" d="M118 80 C110 50 111 16 120 -4" fill="none" stroke-width="4"/>`
      : `<path class="inner" d="M114 86 C102 56 102 18 116 -8 C122 -16 130 -12 131 0 C134 26 132 60 127 84 Z"/>`) +
    `</g>`;

  const HEAD =
    `<path class="fur" d="M150 82 C194 82 216 104 219 132 C221 148 226 164 218 178 L228 186 L212 188 L216 196 L200 194 C188 203 170 206 150 206 C130 206 112 203 100 194 L84 196 L88 188 L72 186 L82 178 C74 164 79 148 81 132 C84 104 106 82 150 82 Z"/>` +
    `<path class="tuft" d="M138 88 L144 78 L150 87 L156 76 L162 88"/>`;

  // cara de matón: cejas de pelo en V, ojos rasgados sin brillo, morro hinchado y boca fruncida
  function FACE(expr) {
    const B = { grumpy: [118, 133], smug: [118, 133], closed: [122, 131], bored: [126, 128], shout: [114, 136], grin: [119, 133] }[expr] || [118, 133];
    const brow = (o, n) => `<path class="brow" d="M102 ${o} Q118 ${o - 1} 138 ${n}"/>`;
    const browR = expr === 'smug' ? `<path class="brow" d="M198 116 Q180 112 162 124"/>` : mirror(brow(B[0], B[1]));
    const slit = { // ojo izquierdo; el derecho es su espejo
      grumpy: `<path class="eye slit" d="M107 136 Q123 138 137 143 Q122 146 110 140 Z"/><path class="bag" d="M112 150 Q123 154 133 151"/>`,
      closed: `<path class="ln" d="M109 140 Q122 146 135 141"/>`,
      bored:  `<path class="eye slit" d="M110 139 Q122 144 134 140 Z"/><path class="ln" d="M107 139 L137 140"/><path class="bag" d="M112 150 Q123 154 133 151"/>`,
      shout:  `<path class="eye slit" d="M107 134 Q123 135 137 141 Q122 148 109 140 Z"/>`,
      grin:   `<path class="ln" d="M109 142 Q122 136 135 142"/>`,
    };
    const eyeL = slit[expr] || slit.grumpy;
    const eyeR = expr === 'smug' ? `<path class="ln" d="M165 141 Q178 135 191 139"/>` : mirror(eyeL);
    const pout = `<path class="ln th" d="M132 184 Q140 170 150 170 Q160 170 168 184"/><path class="fur th" d="M141 181 Q150 192 159 181 Q150 177 141 181 Z"/>`;
    const mouth = {
      shout: `<path class="mouth" d="M136 177 Q150 202 164 177 Q150 182 136 177 Z"/><path class="tooth" d="M144 179 h5 v8 h-5 Z M151 179 h5 v8 h-5 Z"/>`,
      grin:  `<path class="mouth" d="M130 174 Q150 194 170 174 Q150 182 130 174 Z"/><path class="tooth" d="M144 177 h5 v7 h-5 Z M151 177 h5 v7 h-5 Z"/>`,
      smug:  `<path class="ln th" d="M132 184 Q140 170 150 170 Q160 170 166 166"/><path class="fur th" d="M141 181 Q150 192 159 181 Q150 177 141 181 Z"/>`,
    }[expr] || pout;
    return `<g class="face">` +
      `<g class="a-eyes" style="transform-origin:150px 140px">${eyeL}${eyeR}</g>` + brow(B[0], B[1]) + browR +
      `<g class="whisk"><path d="M128 166 L80 154 M128 171 L76 174 M130 176 L86 194"/>` +
      `<path d="M172 166 L220 154 M172 171 L224 174 M170 176 L214 194"/></g>` +
      `` +
      mouth +
      `<path class="nose" d="M143 153 Q150 149 157 153 Q153 160 150 161 Q147 160 143 153 Z"/><path class="ln th" d="M150 161 L150 170"/>` +
      `</g>`;
  }

  // collar de pinchos: el único accesorio que lleva siempre (también "naked")
  function COLLAR() {
    let s = `<path class="collar" d="M95 194 Q150 226 205 194 L207 210 Q150 244 93 210 Z"/>`;
    for (let i = 0; i < 5; i++) {
      const t = 0.14 + i * 0.18;                       // puntos a lo largo de la curva inferior
      const x = (1 - t) ** 2 * 93 + 2 * (1 - t) * t * 150 + t * t * 207;
      const y = (1 - t) ** 2 * 210 + 2 * (1 - t) * t * 244 + t * t * 210;
      const ang = (t - 0.5) * -110;                     // pinchos en abanico, como el de la foto
      s += `<path class="spike" transform="rotate(${ang} ${x} ${y})" d="M${x - 7} ${y - 5} L${x} ${y + 22} L${x + 7} ${y - 5} Z"/>`;
    }
    return s + `<circle class="ring" cx="150" cy="232" r="4.5"/>`;
  }

  const BODY = (back) =>
    `<path class="fur" d="M150 174 C206 174 219 228 216 272 C213 322 192 346 150 346 C108 346 87 322 84 272 C81 228 94 174 150 174 Z"/>` +
    (back ? '' : `<ellipse class="belly" cx="150" cy="286" rx="34" ry="40"/>` +
                 `<path class="tuft" d="M130 230 L138 242 L144 233 L150 245 L156 233 L162 242 L170 230"/>`);

  const ARM = `<path class="fur" d="M113 207 C96 213 87 240 91 262 C93 276 111 278 115 265 C119 249 121 228 121 213 Z"/>` +
              `<path class="ln th" d="M98 268 L100 262 M105 270 L106 264"/>`;
  const FOOT = `<ellipse class="fur" cx="118" cy="338" rx="27" ry="13"/><path class="ln th" d="M100 336 L104 333 M108 340 L111 336"/>`;
  const FOOT_SIT = `<ellipse class="fur" cx="122" cy="340" rx="20" ry="15"/><ellipse class="pad" cx="122" cy="343" rx="8" ry="6"/>`;
  const HAUNCH = `<ellipse class="fur" cx="104" cy="312" rx="38" ry="33"/>`;
  const TAIL = `<path class="fur" d="M150 296 c-14 0 -24 9 -22 21 c-6 6 -2 18 8 18 c4 8 18 8 22 0 c10 0 14 -12 8 -18 c2 -12 -8 -21 -16 -21 Z"/>`;

  function front(pose, opt) {
    const back = opt.view === 'back';
    const p = pose.parts || {};
    let legs = '', haunch = '';
    if (pose.sit) {
      haunch = HAUNCH + mirror(HAUNCH);
      legs = part('legL', pose, FOOT_SIT) + part('legR', pose, mirror(FOOT_SIT));
    } else {
      legs = part('legL', pose, FOOT) + part('legR', pose, mirror(FOOT));
    }
    const bodyPose = pose.sit ? { parts: { body: { sy: 0.84 } } } : pose;
    const head = part('head', pose,
      `<g transform="translate(150 200) scale(.92) translate(-150 -200)">` +
      part('earL', pose, EAR(back)) + part('earR', pose, mirror(EAR(back, true))) +
      HEAD + (back ? '' : FACE(opt.expr || pose.expr)) + `</g>` +
      (opt.collar !== false ? COLLAR() : ''));
    const arms = part('armL', pose, ARM) + part('armR', pose, mirror(ARM));
    return `<g class="a-root" style="transform-origin:150px 350px">` +
      (back ? legs + haunch : haunch) +
      part('body', bodyPose, BODY(back)) +
      (back ? (pose.sit ? `<g transform="translate(0 22)">${TAIL}</g>` : TAIL) : legs) +
      (back ? arms + head : head + arms) +
      (pose.zzz ? `<g class="zzz"><text x="214" y="70">z</text><text x="232" y="44">z</text><text x="252" y="16">Z</text></g>` : '') +
      `</g>`;
  }

  // perfil (mirando a la derecha): dibujo propio, misma paleta y grosores
  function side(opt) {
    return `<g class="a-root" style="transform-origin:150px 350px">` +
      `<path class="fur" d="M78 300 c-14 0 -22 10 -18 20 c-6 8 2 20 12 16 c8 8 22 2 20 -8 c8 -8 2 -26 -14 -28 Z"/>` + // cola
      `<path class="fur" d="M128 182 C88 190 74 246 80 292 C86 334 124 348 168 346 C204 344 214 310 206 270 C198 224 172 178 128 182 Z"/>` +
      `<ellipse class="fur" cx="126" cy="306" rx="44" ry="36"/>` +                                             // muslo
      `<ellipse class="fur" cx="152" cy="340" rx="46" ry="11"/>` +                                             // pie largo
      `<path class="fur" d="M186 236 C200 246 204 272 196 284 C190 292 178 288 178 276 C178 262 176 248 176 240 Z"/>` + // brazo
      `<g class="a-earL" style="transform-origin:140px 96px"><g transform="rotate(-24 140 96)">` +
        `<path class="fur" d="M118 98 C102 60 102 10 122 -18 C132 -31 147 -25 149 -8 C153 20 151 64 145 96 Z"/></g></g>` +
      `<g transform="rotate(-8 152 96)"><path class="fur" d="M130 98 C114 60 114 10 134 -18 C144 -31 159 -25 161 -8 C165 20 163 64 157 96 Z"/>` +
        `<path class="inner" d="M137 86 C126 56 126 18 138 -4 C143 -12 150 -9 151 1 C154 26 152 60 148 84 Z"/></g>` +
      `<path class="fur" d="M106 128 C104 92 140 72 176 80 C204 86 226 110 230 138 C233 158 220 172 204 177 C178 188 136 190 118 174 L104 180 L108 166 C102 156 104 142 106 128 Z"/>` +
      (opt.collar !== false
        ? `<path class="collar" d="M112 172 Q150 196 192 182 L196 196 Q150 214 110 186 Z"/>` +
          [[124, 192, 20], [146, 202, 0], [170, 200, -20]].map(([x, y, a]) =>
            `<path class="spike" transform="rotate(${a} ${x} ${y})" d="M${x - 6} ${y - 4} L${x} ${y + 20} L${x + 6} ${y - 4} Z"/>`).join('')
        : '') +
      `<path class="tuft" d="M108 150 L100 156 L110 158 L102 166"/>` +
      `<path class="ln" d="M174 132 Q187 137 200 135"/><path class="brow" d="M168 118 Q186 116 204 128"/>` +
      `<path class="nose" d="M224 136 Q232 136 231 144 Q226 146 222 142 Z"/>` +
      
      `<ellipse class="fur th" cx="214" cy="152" rx="13" ry="10"/><path class="fur th" d="M206 164 Q214 176 222 164 Z"/>` +
      `<g class="whisk"><path d="M214 148 L252 138 M214 152 L256 154 M212 156 L250 168"/></g>` +
      `</g>`;
  }

  function render(opt = {}) {
    const pose = POSES[opt.pose || 'stand'];
    const view = opt.view || 'front';
    const bpm = opt.bpm || pose.bpm || 90;
    return `<svg class="chupits pose-${opt.pose || 'stand'} view-${view}" viewBox="${opt.vb || '0 -40 300 420'}" style="--b:${(60 / bpm).toFixed(3)}s">` +
      `<ellipse class="shadow" cx="150" cy="351" rx="78" ry="11" style="transform-origin:150px 351px"/>` +
      (view === 'side' ? side(opt) : front(pose, opt)) + `</svg>`;
  }

  window.Chupits = { render, POSES };
})();
