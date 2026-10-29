/**
 * Dessin d'un blason en SVG, dans le style des écus du wiki : écu à bord argenté, champ légèrement
 * texturé et bombé, fond bleu nuit. Prototype : partitions, pièces ordinaires, rebattements,
 * fourrures et charges dessinées (silhouettes de game-icons.net). Les lignes héraldiques (ondé...)
 * et les attitudes des animaux ne sont pas encore dessinées.
 *
 * Spécification : { partition, colors: [champ, seconde], charge: { type, name, count, color } | null }
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

/** Zones de la seconde couleur pour chaque partition, et lignes de division à souligner. */
const PARTITIONS = {
  "Tranché": [`M${L} ${T}L${R} ${B}L${L} ${B}Z`],
  "Taillé": [`M${R} ${T}L${L} ${B}L${R} ${B}Z`],
  "Coupé": [`M${L} ${M}H${R}V${B}H${L}Z`],
  "Parti": [`M${C} ${T}H${R}V${B}H${C}Z`],
  "Écartelé": [`M${C} ${T}H${R}V${M}H${C}Z M${L} ${M}H${C}V${B}H${L}Z`],
  "Écartelé en six": [(() => {
    const w = W / 3, h = (B - T) / 2;
    return [[1, 0], [0, 1], [2, 1]].map(([i, j]) => `M${L + i * w} ${T + j * h}h${w}v${h}h${-w}Z`).join(" ");
  })()],
  "Écartelé en sautoir": [`M${L} ${T}L${C} ${M}L${L} ${B}Z M${R} ${T}L${C} ${M}L${R} ${B}Z`],
  "Chapé": [`M${L} ${T}L${C} ${T}L${L} ${B}Z M${C} ${T}L${R} ${T}L${R} ${B}Z`],
  "Chapé ployé": [`M${L} ${T}L${C} ${T}Q${L + 25} ${M} ${L} ${B}Z M${C} ${T}L${R} ${T}L${R} ${B}Q${R - 25} ${M} ${C} ${T}Z`],
  "Chaussé": [`M${L} ${T}L${C} ${B}L${L} ${B}Z M${R} ${T}L${R} ${B}L${C} ${B}Z`],
  "Chaussé ployé": [`M${L} ${T}Q${L + 25} ${M} ${C} ${B}L${L} ${B}Z M${R} ${T}L${R} ${B}L${C} ${B}Q${R - 25} ${M} ${R} ${T}Z`],
  "Mantelé": [`M${L} ${B}L${L} 190L${C} 80L${R} 190L${R} ${B}Z`],
  "Mantelé renversé": [`M${L} ${T}L${L} 60L${C} 170L${R} 60L${R} ${T}Z`],
  "Mantelé inversé": [`M${L} ${T}H${R}V190L${C} 80L${L} 190Z`],
  "Pairlé": [`M${L} ${T}L${R} ${T}L${C} ${M}Z`, `M${C} ${M}V${B}`],
  "Pairlé renversé": [`M${C} 130L${R} ${B}L${L} ${B}Z`, `M${C} ${T}V130`]
};

/** Pièces ordinaires : forme simple dans la couleur de la charge. */
function ordinary(name, fill) {
  const shape = (d, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const band = (h, angle) => `<rect x="-220" y="${-h / 2}" width="440" height="${h}" fill="${fill}" transform="translate(${C} 120) rotate(${angle})"/>`;
  const stroke = (d, w) => `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linejoin="miter"/>`;
  switch (name) {
    case "Chef": return shape(`M${L} ${T}h${W}v62h${-W}Z`);
    case "Canton": return shape(`M${L} ${T}h72v72h-72Z`);
    case "Bordure": return `<path d="${SHIELD}" fill="none" stroke="${fill}" stroke-width="34"/>`;
    case "Pal": return shape(`M${C - 30} ${T}h60v${H}h-60Z`);
    case "Vergette": return shape(`M${C - 11} ${T}h22v${H}h-22Z`);
    case "Divise": return shape(`M${L} ${M - 11}h${W}v22h${-W}Z`);
    case "Bande": return band(52, 45);
    case "Barre": return band(52, -45);
    case "Cotice": return band(20, 45);
    case "Croix": return shape(`M${C - 24} ${T}h48v${H}h-48Z M${L} 82h${W}v48h${-W}Z`);
    case "Chevron": return stroke(`M${L - 10} 205L${C} 92L${R + 10} 205`, 40);
    case "Étai": return stroke(`M${L - 10} 205L${C} 92L${R + 10} 205`, 16);
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

/** Charge dessinée (silhouette), ou cercle marqué « ? » si l'icône manque encore. */
function figure(name, count, fill) {
  const icon = HERALDRY_ICONS[name];
  return (LAYOUTS[Math.min(7, Math.max(1, count))]).map(([x, y, k]) => {
    const size = 150 * k;
    if (!icon) return `<g transform="translate(${x} ${y})"><circle r="${size / 2.4}" fill="${fill}"/><text y="${size / 7}" text-anchor="middle" font-size="${size / 2.2}" fill="#0008">?</text></g>`;
    const s = size / 512;
    return `<path d="${icon.d}" fill="${fill}" stroke="#000" stroke-opacity="0.45" stroke-width="${1.2 / s}" transform="translate(${x - size / 2} ${y - size / 2}) scale(${s})"/>`;
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
    field += `<path d="${zones[0]}" fill="${paint(second)}"/>`;
    field += zones.map(d => `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1.5"/>`).join("");
  }

  let charge = "";
  const c = spec.charge;
  if (c) {
    const fill = paint(c.color);
    if (c.type === "ordinary") charge = ordinary(c.name, fill) ?? "";
    else if (c.type === "subordinary") charge = subordinary(c.name, fill) ?? "";
    else charge = figure(c.name, c.count ?? 1, fill);
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
