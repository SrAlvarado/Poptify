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
    stand:  { label: 'De pie',   bpm: 0,   expr: 'sleepy', parts: { earR: { r: 12 } } },
    sit:    { label: 'Sentado',  bpm: 0,   expr: 'sleepy', sit: true,
              parts: { head: { y: 30 }, armL: { y: 26, r: -18 }, armR: { y: 26, r: 18 }, earR: { r: 10 } } },
    jump:   { label: 'Saltando', bpm: 100, expr: 'wide',
              parts: { armL: { r: 140, x: -20, y: -4 }, armR: { r: -140, x: 20, y: -4 }, earL: { r: -38 }, earR: { r: 38 },
                       legL: { r: 28, y: 8 }, legR: { r: -28, y: 8 } } },
    bored:  { label: 'Aburrido', bpm: 0,   expr: 'bored', sit: true, zzz: true,
              parts: { head: { y: 34, r: 11 }, armL: { y: 26, r: -12 }, armR: { y: 26, r: 22 },
                       earL: { r: -14 }, earR: { r: 78 } } },
    rap:    { label: 'Rap',      bpm: 90,  expr: 'sleepy',
              parts: { armR: { r: -96 }, armL: { r: -28 }, earR: { r: 16 }, head: { r: -3 } } },
    techno: { label: 'Techno',   bpm: 128, expr: 'closed',
              parts: { armR: { r: -140, x: 24, y: -6 }, armL: { r: 22 }, earL: { r: -4 }, earR: { r: 6 } } },
    reggaeton: { label: 'Reguetón', bpm: 95, expr: 'smug',
              parts: { armL: { r: 115, x: -18 }, armR: { r: -115, x: 18 }, earR: { r: 14 } } },
    trap:   { label: 'Trap',     bpm: 70,  expr: 'sleepy',
              parts: { armL: { r: 30 }, armR: { r: -30 }, head: { r: -5, y: 3 }, earL: { r: -18 }, earR: { r: 24 } } },
    pop:    { label: 'Pop',      bpm: 118, expr: 'happy',
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
  const EAR = (back) =>
    `<path class="fur" d="M108 98 C92 60 92 10 112 -18 C122 -31 137 -25 139 -8 C143 20 141 64 135 96 Z"/>` +
    (back
      ? `<path class="shade" d="M118 80 C110 50 111 16 120 -4" fill="none" stroke-width="4"/>`
      : `<path class="inner" d="M115 86 C104 56 104 18 116 -4 C121 -12 128 -9 129 1 C132 26 130 60 126 84 Z"/>`);

  const HEAD =
    `<path class="fur" d="M150 74 C202 74 223 104 223 138 C223 158 216 174 204 184 L210 194 L194 191 C182 199 166 202 150 202 C134 202 118 199 106 191 L90 194 L96 184 C84 174 77 158 77 138 C77 104 98 74 150 74 Z"/>` +
    `<path class="tuft" d="M139 82 Q145 70 150 79 Q155 68 161 82"/>`;

  function FACE(expr) {
    const eye = (ex, lidTilt) => {
      switch (expr) {
        case 'closed': return `<path class="ln" d="M${ex - 13} 139 Q${ex} 147 ${ex + 13} 139"/>`;
        case 'happy':  return `<path class="ln" d="M${ex - 13} 144 Q${ex} 129 ${ex + 13} 144"/>`;
        case 'wide':   return `<circle class="eye" cx="${ex}" cy="138" r="10"/><circle class="hl" cx="${ex + 3}" cy="134" r="3.2"/>`;
        case 'bored':  return `<path class="eye" d="M${ex - 13} 140 Q${ex} 149 ${ex + 13} 140 Z"/><path class="ln" d="M${ex - 16} 140 L${ex + 16} 140"/>`;
        default: // sleepy / smug: párpado caído, la seña de identidad de Chupits
          return `<path class="eye" d="M${ex - 14} 136 Q${ex} 152 ${ex + 14} 136 Z"/>` +
                 `<circle class="hl" cx="${ex + 4}" cy="141" r="2.2"/>` +
                 `<path class="ln" d="M${ex - 17} ${136 + lidTilt} Q${ex} 130 ${ex + 17} ${136 - lidTilt}"/>`;
      }
    };
    const smug = expr === 'smug';
    const mouth = {
      happy: `<path class="ln th" d="M150 165 L150 170"/><path class="mouth" d="M139 171 Q150 184 161 171 Z"/>`,
      wide:  `<path class="ln th" d="M150 165 L150 170"/><ellipse class="mouth" cx="150" cy="176" rx="5" ry="6"/>`,
      bored: `<path class="ln th" d="M150 165 L150 171 M141 174 L159 173"/>`,
    }[expr] || (smug
      ? `<path class="ln th" d="M150 165 L150 170 M150 170 Q144 175 138 172 M150 170 Q158 172 164 166"/>`
      : `<path class="ln th" d="M150 165 L150 170 M150 170 Q143 176 137 171 M150 170 Q157 176 163 171"/>`);
    return `<g class="face">` +
      `<ellipse class="blush" cx="112" cy="160" rx="13" ry="7"/><ellipse class="blush" cx="188" cy="160" rx="13" ry="7"/>` +
      `<g class="a-eyes" style="transform-origin:150px 140px">${expr === 'smug' ? eye(122, 6) + eye(178, -4) : eye(122, 2) + eye(178, -1)}</g>` +
      `<path class="nose" d="M142 155 Q150 150 158 155 Q154 163 150 164 Q146 163 142 155 Z"/>` + mouth +
      `<g class="whisk"><path d="M126 160 L86 150 M126 165 L82 166 M127 170 L88 182"/>` +
      `<path d="M174 160 L214 150 M174 165 L218 166 M173 170 L212 182"/></g></g>`;
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
    `<path class="fur" d="M150 176 C201 176 215 230 213 272 C211 322 191 346 150 346 C109 346 89 322 87 272 C85 230 99 176 150 176 Z"/>` +
    (back ? '' : `<ellipse class="belly" cx="150" cy="282" rx="38" ry="46"/>` +
                 `<path class="tuft" d="M134 228 L141 238 L150 229 L159 238 L166 228"/>`);

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
      part('earL', pose, EAR(back)) + part('earR', pose, mirror(EAR(back))) +
      HEAD + (opt.collar !== false ? COLLAR() : '') + (back ? '' : FACE(opt.expr || pose.expr)));
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
      `<path class="eye" d="M174 128 Q186 142 198 128 Z"/><path class="ln" d="M171 128 Q186 122 200 127"/>` +
      `<path class="nose" d="M224 136 Q232 136 231 144 Q226 146 222 142 Z"/>` +
      `<path class="ln th" d="M226 146 Q224 154 216 154"/>` +
      `<ellipse class="blush" cx="200" cy="154" rx="12" ry="6"/>` +
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
