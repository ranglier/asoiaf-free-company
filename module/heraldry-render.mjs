/**
 * Dessin d'un blason en SVG, dans le style des écus du wiki : écu à bord argenté, champ légèrement
 * texturé et bombé, fond bleu nuit. Partitions, pièces ordinaires, rebattements, fourrures, lignes
 * héraldiques (sur les partitions droites et les pièces simples) et charges dessinées (silhouettes de
 * game-icons.net, attitude suggérée par une transformation).
 *
 * Spécification : { partition, line, colors: [champ, seconde], charge: { type, name, count, color, line, attitude } | null }
 * Les couleurs sont des noms du livre (« Sinople », « Or », « Hermine »...).
 */
import { HERALDRY_ICONS } from "./heraldry-icons.mjs";

/** Teintes des émaux et métaux. */
export const HERALDRY_COLORS = {
  Sable: "#1f1f24", Azur: "#1f4e96", Pourpre: "#6a2c7c", Gueules: "#a8191f", Sinople: "#1d7036",
  "Orangé": "#cf6f1c", Sanguine: "#6b1520", Argent: "#d9dcdf", Or: "#d6a530"
};
/** Fourrures : fond et mouchetures. */
const FURS = {
  Hermine: ["#f1eee6", "#16161a"], "Contre-hermine": ["#16161a", "#f1eee6"],
  Herminais: ["#d6a530", "#16161a"], "Péan": ["#16161a", "#d6a530"]
};

// Cadre de l'écu (viewBox 256 × 256).
const L = 28, R = 228, T = 22, B = 238, C = 128, M = 118, W = R - L, H = B - T;
const SHIELD = `M${L} ${T}H${R}V120C${R} 180 190 215 ${C} ${B}C66 215 ${L} 180 ${L} 120Z`;

/**
 * Lignes héraldiques (table 6-12) : un segment droit de p1 à p2 est remplacé par un motif
 * (vagues, créneaux, dents...). Renvoie les commandes de tracé sans le « M » initial.
 */
const LINE_STYLES = {
  "Ondé": { period: 32, amp: 6 }, "Nébulé": { period: 26, amp: 7 }, "Engrelé": { period: 24, amp: 8 },
  "Cannelé": { period: 24, amp: 8 }, "Dentelé": { period: 14, amp: 7 }, "Bande fuselée": { period: 40, amp: 11 },
  "Rayonnant": { period: 14, amp: 8 }, "Crénelé": { period: 30, amp: 9 }, "Écoté": { period: 28, amp: 8 }
};
function segment([x1, y1], [x2, y2], line) {
  const style = LINE_STYLES[line];
  if (!style) return `L${x2} ${y2}`;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = -uy, ny = ux;
  const k = Math.max(1, Math.round(len / style.period)), step = len / k, a = style.amp;
  // Point à la distance t le long du segment, décalé de o perpendiculairement.
  const P = (t, o = 0) => `${(x1 + ux * t + nx * o).toFixed(1)} ${(y1 + uy * t + ny * o).toFixed(1)}`;
  let d = "";
  for (let i = 0; i < k; i++) {
    const s = i * step;
    switch (line) {
      case "Ondé": d += `Q${P(s + step / 4, 2 * a)} ${P(s + step / 2)}Q${P(s + 3 * step / 4, -2 * a)} ${P(s + step)}`; break;
      case "Nébulé": d += `C${P(s, 1.8 * a)} ${P(s + step / 2, 1.8 * a)} ${P(s + step / 2)}C${P(s + step / 2, -1.8 * a)} ${P(s + step, -1.8 * a)} ${P(s + step)}`; break;
      case "Engrelé": d += `Q${P(s + step / 2, 2 * a)} ${P(s + step)}`; break;
      case "Cannelé": d += `Q${P(s + step / 2, -2 * a)} ${P(s + step)}`; break;
      case "Dentelé": case "Bande fuselée": d += `L${P(s + step / 2, a)}L${P(s + step)}`; break;
      case "Rayonnant": d += `Q${P(s + step * 0.15, a * 1.4)} ${P(s + step * 0.5, a)}Q${P(s + step * 0.6, 0)} ${P(s + step)}`; break;
      case "Crénelé": d += `L${P(s, a)}L${P(s + step / 2, a)}L${P(s + step / 2)}L${P(s + step)}`; break;
      case "Écoté": d += `L${P(s + step * 0.2, a)}L${P(s + step * 0.6, a)}L${P(s + step * 0.4)}L${P(s + step)}`; break;
    }
  }
  return d;
}
/** Polygone [[x, y, ligne ?], ...] : les côtés marqués reçoivent la ligne héraldique. */
function poly(points, line) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    d += p[2] && line ? segment(p, q, line) : `L${q[0]} ${q[1]}`;
  });
  return `${d}Z`;
}

/**
 * Zones de la seconde couleur pour chaque partition : polygones dont les côtés marqués sont les
 * lignes de division (elles peuvent recevoir une ligne héraldique), ou tracés courbes fixes.
 * Second élément facultatif : trait de division supplémentaire (pairlé).
 */
const E = 12; // débord hors de l'écu (le reste est masqué)
const PARTITIONS = {
  "Tranché": [[[L - E, T - E, 1], [R + E, B + E, 0], [L - E, B + E, 0]]],
  "Taillé": [[[L - E, B + E, 1], [R + E, T - E, 0], [R + E, B + E, 0]]],
  "Coupé": [[[R + E, M, 1], [L - E, M, 0], [L - E, B + E, 0], [R + E, B + E, 0]]],
  "Parti": [[[C, B + E, 1], [C, T - E, 0], [R + E, T - E, 0], [R + E, B + E, 0]]],
  "Écartelé": [[[C, T - E, 0], [R + E, T - E, 0], [R + E, M, 1], [C, M, 1]], [[L - E, M, 1], [C, M, 1], [C, B + E, 0], [L - E, B + E, 0]]],
  "Écartelé en six": [[1, 0], [0, 1], [2, 1]].map(([i, j]) => {
    const w = W / 3, h = H / 2, x = L + i * w, y = T + j * h;
    return [[x, y, 0], [x + w, y, 0], [x + w, y + h, 0], [x, y + h, 0]];
  }),
  "Écartelé en sautoir": [[[L - E, T - E, 1], [C, M, 1], [L - E, B + E, 0]], [[R + E, B + E, 1], [C, M, 1], [R + E, T - E, 0]]],
  "Chapé": [[[C, T - E, 1], [L - E, B + E, 0], [L - E, T - E, 0]], [[R + E, B + E, 1], [C, T - E, 0], [R + E, T - E, 0]]],
  "Chapé ployé": `M${L} ${T}L${C} ${T}Q${L + 25} ${M} ${L} ${B}Z M${C} ${T}L${R} ${T}L${R} ${B}Q${R - 25} ${M} ${C} ${T}Z`,
  "Chaussé": [[[L - E, T - E, 1], [C, B + E, 0], [L - E, B + E, 0]], [[C, B + E, 1], [R + E, T - E, 0], [R + E, B + E, 0]]],
  "Chaussé ployé": `M${L} ${T}Q${L + 25} ${M} ${C} ${B}L${L} ${B}Z M${R} ${T}L${R} ${B}L${C} ${B}Q${R - 25} ${M} ${R} ${T}Z`,
  "Mantelé": [[[L - E, 200, 1], [C, 80, 1], [R + E, 200, 0], [R + E, B + E, 0], [L - E, B + E, 0]]],
  "Mantelé renversé": [[[R + E, 50, 1], [C, 170, 1], [L - E, 50, 0], [L - E, T - E, 0], [R + E, T - E, 0]]],
  "Mantelé inversé": [[[R + E, 200, 1], [C, 80, 1], [L - E, 200, 0], [L - E, T - E, 0], [R + E, T - E, 0]]],
  "Pairlé": [[[R + E, T - E, 1], [C, M, 1], [L - E, T - E, 0]]],
  "Pairlé renversé": [[[L - E, B + E, 1], [C, 130, 1], [R + E, B + E, 0]]]
};
/** Traits de division qui ne bordent aucune zone colorée (le pied du pairlé). */
const EXTRA_LINES = { "Pairlé": [[C, M], [C, B + E]], "Pairlé renversé": [[C, 130], [C, T - E]] };

/** La ligne héraldique est-elle dessinée sur cette partition ou cette pièce ? */
export function canDrawLine(spec) {
  if (spec.line) return Array.isArray(PARTITIONS[spec.partition]) && spec.partition !== "Écartelé en six";
  if (spec.charge?.line) return LINED_ORDINARIES.includes(spec.charge.name);
  return true;
}
const LINED_ORDINARIES = ["Chef", "Pal", "Vergette", "Divise", "Bande", "Barre", "Cotice", "Croix", "Chevron", "Étai", "Canton"];

/** Pièces ordinaires : forme simple dans la couleur de la charge. */
function ordinary(name, fill, line = null) {
  const shape = (d, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const lined = points => shape(poly(points, line));
  // Bande : rectangle tourné autour du centre ; ses deux grands côtés reçoivent la ligne.
  const band = (h, angle) => `<path d="${poly([[-220, -h / 2, 1], [220, -h / 2, 0], [220, h / 2, 1], [-220, h / 2, 0]], line)}" fill="${fill}" transform="translate(${C} 120) rotate(${angle})"/>`;
  const stroke = (d, w) => `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linejoin="miter"/>`;
  // Chevron : bande brisée d'épaisseur t, pointe au centre.
  const chevron = t => lined([[L - E, 205 - t, 1], [C, 92 - t, 1], [R + E, 205 - t, 0], [R + E, 205 + t, 1], [C, 92 + t, 1], [L - E, 205 + t, 0]]);
  switch (name) {
    case "Chef": return lined([[L - E, T - E, 0], [R + E, T - E, 0], [R + E, 84, 1], [L - E, 84, 0]]);
    case "Canton": return lined([[L - E, T - E, 0], [L + 72, T - E, 1], [L + 72, T + 72, 1], [L - E, T + 72, 0]]);
    case "Bordure": return `<path d="${SHIELD}" fill="none" stroke="${fill}" stroke-width="34"/>`;
    case "Pal": return lined([[C - 30, T - E, 1], [C - 30, B + E, 0], [C + 30, B + E, 1], [C + 30, T - E, 0]]);
    case "Vergette": return lined([[C - 11, T - E, 1], [C - 11, B + E, 0], [C + 11, B + E, 1], [C + 11, T - E, 0]]);
    case "Divise": return lined([[L - E, M - 11, 1], [R + E, M - 11, 0], [R + E, M + 11, 1], [L - E, M + 11, 0]]);
    case "Bande": return band(52, 45);
    case "Barre": return band(52, -45);
    case "Cotice": return band(20, 45);
    case "Croix": {
      const a = 24, y = 106;
      return lined([[C - a, T - E, 1], [C - a, y - a, 1], [L - E, y - a, 0], [L - E, y + a, 1], [C - a, y + a, 1], [C - a, B + E, 0],
        [C + a, B + E, 1], [C + a, y + a, 1], [R + E, y + a, 0], [R + E, y - a, 1], [C + a, y - a, 1], [C + a, T - E, 0]]);
    }
    case "Chevron": return chevron(22);
    case "Étai": return chevron(8);
    case "Pairle": return stroke(`M${L} ${T}L${C} 112L${R} ${T}M${C} 112V${B}`, 34);
    case "Pile": return shape(`M${C - 52} ${T}L${C + 52} ${T}L${C} 205Z`);
    case "Pointe": return shape(`M${C - 70} ${B}L${C} 140L${C + 70} ${B}Z`);
    case "Giron": return shape(`M${L} ${T}L${C} 120L${L} 120Z`);
    case "Écusson": return `<path d="${SHIELD}" fill="${fill}" transform="translate(${C} 118) scale(0.42) translate(${-C} -130)"/>`;
    case "Losange": return shape(`M${C} 58L${C + 46} 120L${C} 182L${C - 46} 120Z`);
    case "Fuseau": return shape(`M${C} 48L${C + 28} 120L${C} 192L${C - 28} 120Z`);
    case "Macle": return shape(`M${C} 58L${C + 46} 120L${C} 182L${C - 46} 120Z M${C} 88L${C - 23} 120L${C} 152L${C + 23} 120Z`, `fill-rule="evenodd"`);
    case "Cyclamor": return `<circle cx="${C}" cy="118" r="52" fill="none" stroke="${fill}" stroke-width="18"/>`;
    case "Tourteau": return `<circle cx="${C}" cy="118" r="50" fill="${fill}"/>`;
    case "Échiqueté": {
      const s = W / 8;
      let d = "";
      for (let i = 0; i < 8; i++) for (let j = 0; j < 9; j++) if ((i + j) % 2) d += `M${L + i * s} ${T + j * s}h${s}v${s}h${-s}Z`;
      return shape(d);
    }
  }
  return null;
}

/** Rebattements : le champ est partagé en pièces alternées (couleur du champ / de la charge). */
function subordinary(name, fill) {
  const n = Number(name.match(/\d+/)?.[0]) || 6;
  const stripes = (count, horizontal) => {
    let d = "";
    const step = (horizontal ? H : W) / count;
    for (let i = 1; i < count; i += 2) d += horizontal ? `M${L} ${T + i * step}h${W}v${step}h${-W}Z` : `M${L + i * step} ${T}h${step}v${H}h${-step}Z`;
    return `<path d="${d}" fill="${fill}"/>`;
  };
  if (name.startsWith("Fascé")) return stripes(n, true);
  if (name.startsWith("Burelé")) return stripes(n * 2, true);
  if (name.startsWith("Palé de")) return stripes(n, false);
  if (name.startsWith("Bandé")) {
    const span = 300, step = span / n;
    let d = "";
    for (let i = 1; i < n; i += 2) d += `M-220 ${-span / 2 + i * step}h440v${step}h-440Z`;
    return `<path d="${d}" fill="${fill}" transform="translate(${C} 120) rotate(45)"/>`;
  }
  if (name.startsWith("Chevronné")) {
    const step = 260 / n;
    let out = "";
    for (let i = 1; i < n; i += 2) {
      const y = 40 + i * step;
      out += `<path d="M${L - 40} ${y + 110}L${C} ${y}L${R + 40} ${y + 110}" fill="none" stroke="${fill}" stroke-width="${step}"/>`;
    }
    return out;
  }
  if (name.startsWith("Pilé")) {
    const w = W / n;
    let d = "";
    for (let i = 0; i < n; i++) d += `M${L + i * w} ${T}h${w}L${L + i * w + w / 2} 200Z`;
    return `<path d="${d}" fill="${fill}"/>`;
  }
  if (name.startsWith("Gironné")) {
    let d = "";
    for (let i = 0; i < 8; i += 2) {
      const a1 = (i * Math.PI) / 4, a2 = ((i + 1) * Math.PI) / 4;
      d += `M${C} 120L${C + 300 * Math.cos(a1)} ${120 + 300 * Math.sin(a1)}L${C + 300 * Math.cos(a2)} ${120 + 300 * Math.sin(a2)}Z`;
    }
    return `<path d="${d}" fill="${fill}"/>`;
  }
  if (name === "Losangé" || name === "Fuselé") {
    const w = name === "Losangé" ? 40 : 28, h = name === "Losangé" ? 40 : 60;
    let d = "";
    // Un seul réseau de losanges sur deux : l'autre garde la couleur du champ.
    for (let y = T - h; y < B + h; y += h) {
      for (let x = L - w; x < R + w; x += w) d += `M${x + w / 2} ${y}l${w / 2} ${h / 2}l${-w / 2} ${h / 2}l${-w / 2} ${-h / 2}Z`;
    }
    return `<path d="${d}" fill="${fill}"/>`;
  }
  if (name === "Palé bandé") {
    const cw = W / 6, h = 36;
    let d = "";
    for (let i = 0; i < 6; i++) {
      const x = L + i * cw;
      for (let j = 0; j < 16; j++) if ((i + j) % 2) {
        const y = T - 240 + j * h + (x - L);
        d += `M${x} ${y}l${cw} ${cw}v${h}l${-cw} ${-cw}Z`;
      }
    }
    return `<path d="${d}" fill="${fill}"/>`;
  }
  return null;
}

/** Positions des charges répétées (rangées classiques : 2-1, 2-2, 2-1-2, 3-2-1, 2-2-2-1). */
const LAYOUTS = {
  1: [[C, 118, 1]],
  2: [[C - 46, 110, 0.62], [C + 46, 110, 0.62]],
  3: [[C - 46, 88, 0.55], [C + 46, 88, 0.55], [C, 168, 0.55]],
  4: [[C - 46, 82, 0.5], [C + 46, 82, 0.5], [C - 46, 152, 0.5], [C + 46, 152, 0.5]],
  5: [[C - 50, 72, 0.42], [C + 50, 72, 0.42], [C, 128, 0.42], [C - 50, 184, 0.36], [C + 50, 184, 0.36]].slice(0, 5),
  6: [[C - 60, 70, 0.36], [C, 70, 0.36], [C + 60, 70, 0.36], [C - 32, 128, 0.36], [C + 32, 128, 0.36], [C, 184, 0.36]],
  7: [[C - 34, 56, 0.28], [C + 34, 56, 0.28], [C - 34, 100, 0.28], [C + 34, 100, 0.28], [C - 34, 144, 0.28], [C + 34, 144, 0.28], [C, 190, 0.28]]
};

/**
 * Attitudes : chaque silhouette n'a qu'une pose, l'attitude est suggérée par une transformation
 * (bête dressée inclinée, couchée aplatie, regardant retournée). Les autres gardent la pose de l'icône.
 */
const ATTITUDES = {
  rampant: "rotate(-22)", saillant: "rotate(-34)", accroupi: "translate(0 8) scale(1 0.86)",
  dormant: "translate(0 18) scale(1.05 0.68)", regardant: "scale(-1 1)"
};

/** Charge dessinée (silhouette), ou cercle marqué « ? » si l'icône manque. */
function figure(name, count, fill, attitude) {
  const icon = HERALDRY_ICONS[name];
  const pose = ATTITUDES[attitude] ?? "";
  return (LAYOUTS[Math.min(7, Math.max(1, count))]).map(([x, y, k]) => {
    const size = 150 * k;
    if (!icon) return `<g transform="translate(${x} ${y})"><circle r="${size / 2.4}" fill="${fill}"/><text y="${size / 7}" text-anchor="middle" font-size="${size / 2.2}" fill="#0008">?</text></g>`;
    const s = size / 512;
    return `<g transform="translate(${x} ${y}) ${pose}"><path d="${icon.d}" fill="${fill}" stroke="#000" stroke-opacity="0.45" stroke-width="${1.2 / s}" transform="scale(${s}) translate(-256 -256)"/></g>`;
  }).join("");
}

/** Le blason sait-il dessiner cette charge ? */
export function canDraw(charge) {
  if (!charge) return true;
  if (charge.type === "ordinary") return ordinary(charge.name, "#000") !== null;
  if (charge.type === "subordinary") return subordinary(charge.name, "#000") !== null;
  return Boolean(HERALDRY_ICONS[charge.name]);
}

/** Construit l'image SVG du blason. */
export function renderArms(spec, { id = "afc-arms" } = {}) {
  const defs = [];
  const paint = color => {
    if (FURS[color]) {
      const [ground, spot] = FURS[color];
      const pid = `${id}-fur-${Object.keys(FURS).indexOf(color)}`;
      if (!defs.some(d => d.includes(pid))) {
        const ermine = `M10 3l-1.6 2 1.6 2 1.6-2z M5.5 6l-1.4 1.7 1.4 1.7 1.4-1.7z M14.5 6l-1.4 1.7 1.4 1.7 1.4-1.7z M10 9c-1.5 4-3.5 7-5 10h3.2l1.8-2.6 1.8 2.6H15c-1.5-3-3.5-6-5-10z`;
        defs.push(`<pattern id="${pid}" width="28" height="30" patternUnits="userSpaceOnUse"><rect width="28" height="30" fill="${ground}"/>
          <path d="${ermine}" fill="${spot}" transform="translate(-2 0)"/><path d="${ermine}" fill="${spot}" transform="translate(12 15)"/></pattern>`);
      }
      return `url(#${pid})`;
    }
    return HERALDRY_COLORS[color] ?? "#888";
  };

  const [first, second] = spec.colors;
  const zones = PARTITIONS[spec.partition];
  let field = `<rect x="${L}" y="${T}" width="${W}" height="${H}" fill="${paint(first)}"/>`;
  if (zones && second) {
    const d = Array.isArray(zones) ? zones.map(p => poly(p, spec.line)).join(" ") : zones;
    const extra = EXTRA_LINES[spec.partition];
    const lineD = extra ? `M${extra[0][0]} ${extra[0][1]}${segment(extra[0], extra[1], spec.line)}` : "";
    field += `<path d="${d}" fill="${paint(second)}"/>`;
    field += `<path d="${d} ${lineD}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1.5"/>`;
  }

  let charge = "";
  const c = spec.charge;
  if (c) {
    const fill = paint(c.color);
    if (c.type === "ordinary") charge = ordinary(c.name, fill, c.line) ?? "";
    else if (c.type === "subordinary") charge = subordinary(c.name, fill) ?? "";
    else charge = figure(c.name, c.count ?? 1, fill, c.attitude);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <radialGradient id="${id}-bg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#2a3550"/><stop offset="1" stop-color="#121826"/></radialGradient>
    <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6f7f8"/><stop offset="0.35" stop-color="#9da2a8"/><stop offset="0.6" stop-color="#e9ebed"/><stop offset="1" stop-color="#6c7178"/>
    </linearGradient>
    <radialGradient id="${id}-light" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.42"/></radialGradient>
    <filter id="${id}-tex" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.75" numOctaves="2" seed="7"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.22"/></feComponentTransfer>
    </filter>
    <filter id="${id}-relief"><feDropShadow dx="1.5" dy="2" stdDeviation="1.5" flood-opacity="0.55"/></filter>
    <clipPath id="${id}-clip"><path d="${SHIELD}"/></clipPath>
    ${defs.join("")}
  </defs>
  <rect width="256" height="256" fill="url(#${id}-bg)"/>
  <path d="${SHIELD}" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="16" transform="translate(0 3)"/>
  <g clip-path="url(#${id}-clip)">
    ${field}
    <g filter="url(#${id}-relief)">${charge}</g>
    <rect x="${L}" y="${T}" width="${W}" height="${H}" filter="url(#${id}-tex)"/>
    <rect x="${L}" y="${T}" width="${W}" height="${H}" fill="url(#${id}-light)"/>
  </g>
  <path d="${SHIELD}" fill="none" stroke="url(#${id}-rim)" stroke-width="9"/>
  <path d="${SHIELD}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1" transform="translate(${C} 120) scale(0.955) translate(${-C} -120)"/>
</svg>`;
}
