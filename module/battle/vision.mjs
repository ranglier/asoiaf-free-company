/**
 * Brouillard de guerre par case (règles maison, option de bataille « fog », à l'essai) : ce que voit
 * la Compagnie, calculé comme dans le banc d'essai validé par Jules le 2026-11-02.
 * - Bois : de l'extérieur, on ne voit que la lisière. Depuis la lisière, on voit à 2 cases dans le bois
 *   et normalement dehors ; plus au fond, à 2 cases dans le bois et 1 case dehors. Éclaireurs : 1 de plus.
 * - Colline : du sommet, on voit tout, sauf le pied d'une autre colline caché par celle-ci. Vue
 *   symétrique : entre une colline et la plaine, on calcule depuis la colline.
 * - Village et ruines bloquent la vue ; brouillard (météo) : 2 cases.
 * - Repérer n'est pas identifier : au-delà de 4 cases (5 pour des éclaireurs), une troupe vue reste
 *   inconnue ; le MJ l'identifie à la main (Lire le champ).
 * - Embuscade : une troupe en lisière qui n'a pas encore agi n'est repérée qu'à 2 cases, des éclaireurs
 *   seulement au contact. Une troupe au contact est toujours vue.
 * Le MJ actif cache et montre les jetons ennemis (Foundry les masque alors aux joueurs) ; chaque client
 * assombrit les cases que la Compagnie ne voit pas. Un jeton que le MJ cache ou montre lui-même sort du
 * brouillard, jusqu'à ce qu'il l'y rende (menu du jeton).
 */
import { SYSTEM_ID } from "../config.mjs";
import { center, regionTerrainKey } from "./engagement.mjs";
import { isBook } from "./rules.mjs";
import { getBattle } from "./state.mjs";

const FOG = "fog";
/** Distance d'identification, en cases (éclaireurs : une de plus). */
export const IDENTIFY_RANGE = 4;
const BLOCKERS = ["village", "ruins"];
const loc = key => game.i18n.localize(key);

export const fogOn = (scene = canvas.scene) => !!scene && !isBook(scene) && !!getBattle(scene).fog;
const fogFlag = token => token.getFlag(SYSTEM_ID, FOG) ?? {};
const isTroop = token => token.actor?.type === "troop";
const isEnemy = token => isTroop(token) && token.actor.system.side === "enemy";
const isScout = actor => actor.system.traits?.includes("scouts") || [actor.system.unitType, actor.system.unitType2].includes("scouts");

/** Troupe ennemie que ce joueur voit sans l'avoir identifiée (le MJ voit tout). */
export const unknownToMe = token => !game.user.isGM && isEnemy(token) && !!fogFlag(token).unknown && fogOn(token.parent);
/** Nom affiché d'une troupe : « Troupe inconnue » tant qu'elle n'est pas identifiée. */
export const fogName = (token, { forAll = false } = {}) =>
  ((forAll ? isEnemy(token) && fogFlag(token).unknown && fogOn(token.parent) : unknownToMe(token)) ? loc("AFC.Battle.Fog.Unknown") : token.name);

/* ---------- Cases, terrains et ligne de vue ---------- */

const keyOf = o => `${o.i},${o.j}`;
const cube = o => canvas.grid.getCube(o);
const dist = (a, b) => canvas.grid.constructor.cubeDistance(cube(a), cube(b));
const cellOf = token => canvas.grid.getOffset(center(token));

/** Cases de la scène : celles dont le centre est sur la carte. */
function sceneCells() {
  const rect = canvas.dimensions.sceneRect;
  const first = canvas.grid.getOffset({ x: rect.x + 1, y: rect.y + 1 });
  const last = canvas.grid.getOffset({ x: rect.right - 1, y: rect.bottom - 1 });
  const cells = [];
  for (let i = first.i - 1; i <= last.i + 1; i++) {
    for (let j = first.j - 1; j <= last.j + 1; j++) {
      const at = canvas.grid.getCenterPoint({ i, j });
      if (rect.contains(at.x, at.y)) cells.push({ i, j });
    }
  }
  return cells;
}

/** Arrondi d'une position cubique à la case la plus proche. */
function cubeRound({ q, r, s }) {
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (ds > dr) rs = -rq - rr;
  else rr = -rq - rs;
  return { q: rq, r: rr, s: rs };
}

/** Cases traversées par la ligne droite entre deux centres (sans les extrémités). */
function between(a, b) {
  const ca = cube(a), cb = cube(b);
  const n = dist(a, b), cells = [];
  // Léger décalage (celui du banc d'essai) : une ligne qui longe le bord de deux cases en prend toujours une, la même.
  for (let k = 1; k < n; k++) {
    const f = k / n;
    cells.push(canvas.grid.getOffset(cubeRound({
      q: ca.q + 1e-6 + (cb.q - ca.q) * f, r: ca.r - 3e-6 + (cb.r - ca.r) * f, s: ca.s + 2e-6 + (cb.s - ca.s) * f
    })));
  }
  return cells;
}

let cache = null;
/** Terrains changés (régions) : le relevé des cases est refait au prochain calcul. */
export function invalidateFog() { cache = null; }

/** Relevé de la scène : bois, collines (et leur massif), obstacles, lisières. */
function terrainOf(scene) {
  if (cache?.scene === scene.id) return cache;
  const regions = scene.regions.map(r => [r, regionTerrainKey(r)]).filter(([, k]) => ["wood", "hill", ...BLOCKERS].includes(k));
  const cells = sceneCells();
  const inScene = new Set(cells.map(keyOf));
  const terrain = new Map();
  for (const cell of cells) {
    const point = { ...canvas.grid.getCenterPoint(cell), elevation: 0 };
    const keys = new Set(regions.filter(([r]) => r.testPoint(point)).map(([, k]) => (BLOCKERS.includes(k) ? "block" : k)));
    if (keys.size) terrain.set(keyOf(cell), keys);
  }
  const has = (o, k) => !!terrain.get(keyOf(o))?.has(k);
  const neighbors = o => canvas.grid.getAdjacentOffsets(o).filter(n => inScene.has(keyOf(n)));
  // Massifs : collines qui se touchent.
  const massif = new Map();
  let id = 0;
  for (const cell of cells) {
    if (!has(cell, "hill") || massif.has(keyOf(cell))) continue;
    const stack = [cell];
    massif.set(keyOf(cell), id);
    while (stack.length) {
      for (const n of neighbors(stack.pop())) {
        if (has(n, "hill") && !massif.has(keyOf(n))) { massif.set(keyOf(n), id); stack.push(n); }
      }
    }
    id++;
  }
  cache = {
    scene: scene.id, cells, has, massif: o => massif.get(keyOf(o)),
    edge: o => has(o, "wood") && neighbors(o).some(n => !has(n, "wood"))
  };
  return cache;
}

/** Une troupe en a qui voit la case b ? (scout : éclaireurs ; mist : brouillard, 2 cases) */
function sees(a, b, { scout = false, mist = false }, t) {
  if (a.i === b.i && a.j === b.j) return true;
  if (mist && dist(a, b) > 2) return false;
  const W = o => t.has(o, "wood"), H = o => t.has(o, "hill"), V = o => t.has(o, "block");
  const inside = scout ? 3 : 2, outside = scout ? 2 : 1;
  // Depuis le bois : 2 cases dans le bois ; dehors, normalement depuis la lisière, sinon 1 case.
  if (W(a)) {
    let woods = 0, out = false;
    for (const h of between(a, b)) {
      if (W(h)) {
        if (out) return false;
        woods++;
      } else {
        if (woods > 0 || V(h) || H(h)) return false;
        out = true;
      }
    }
    if (W(b) && !out) return dist(a, b) <= inside;
    return woods <= inside;
  }
  // Vers le bois, de l'extérieur : la lisière seulement (éclaireurs : une case de plus).
  if (W(b)) {
    let woods = 0;
    for (const h of between(a, b)) {
      if (V(h) || (H(h) && !H(a))) return false;
      if (W(h)) woods++;
    }
    return woods <= outside - 1;
  }
  // Ailleurs : vue symétrique, calculée depuis la colline s'il y en a une.
  const [o, target] = H(b) && !H(a) ? [b, a] : [a, b];
  const line = between(o, target);
  for (const h of line) if (W(h) || V(h) || (H(h) && !H(o))) return false;
  // Angle mort : le pied d'une autre colline, derrière elle.
  if (H(o) && !H(target)) for (const h of line) if (H(h) && t.massif(h) !== t.massif(o) && dist(h, target) === 1) return false;
  return true;
}

/** Troupes de la Compagnie qui regardent : case et éclaireurs. Une troupe cachée par le MJ (réserve) ne regarde pas. */
function observers(scene) {
  return scene.tokens.filter(t => isTroop(t) && t.actor.system.side === "company" && !t.hidden && t.actor.system.state !== "destroyed")
    .map(t => ({ cell: cellOf(t), scout: isScout(t.actor) }));
}

/** Cases que voit la Compagnie. */
export function companyView(scene = canvas.scene) {
  const t = terrainOf(scene);
  const mist = getBattle(scene).weather === "fog";
  const seen = new Set();
  for (const o of observers(scene)) for (const cell of t.cells) if (!seen.has(keyOf(cell)) && sees(o.cell, cell, { scout: o.scout, mist }, t)) seen.add(keyOf(cell));
  return seen;
}

/** Une troupe ennemie : vue de la Compagnie ? identifiée ? */
function enemyView(token, eyes, t, mist) {
  const cell = cellOf(token);
  const flag = fogFlag(token);
  const ambush = !flag.acted && t.edge(cell);
  let seen = false, known = !!flag.known;
  for (const o of eyes) {
    const d = dist(o.cell, cell);
    let visible = d <= 1 || sees(o.cell, cell, { scout: o.scout, mist }, t);
    // Embuscade en lisière : repérée à 2 cases, des éclaireurs seulement au contact.
    if (visible && d > 1 && ambush && (isScout(token.actor) || d > 2)) visible = false;
    if (!visible) continue;
    seen = true;
    if (d <= IDENTIFY_RANGE + (o.scout ? 1 : 0)) known = true;
  }
  return { seen, known };
}

/* ---------- Jetons ennemis (MJ actif) ---------- */

let pending = null;
/** Recalcule le brouillard un peu plus tard (une seule fois pour une rafale de changements). */
export function scheduleFog() {
  clearTimeout(pending);
  pending = setTimeout(() => { pending = null; applyFog(); drawFog(); }, 150);
}

/**
 * Cache ou montre les troupes ennemies selon ce que voit la Compagnie (MJ actif seulement). Brouillard
 * coupé : les jetons qu'il avait cachés réapparaissent.
 */
export async function applyFog(scene = canvas.scene) {
  if (game.users.activeGM !== game.user || !canvas.ready || scene?.id !== canvas.scene?.id) return;
  const on = fogOn(scene);
  const t = on ? terrainOf(scene) : null;
  const eyes = on ? observers(scene) : [];
  const mist = getBattle(scene).weather === "fog";
  const updates = [];
  for (const token of scene.tokens.filter(isEnemy)) {
    const flag = fogFlag(token);
    let hidden = token.hidden, auto = !!flag.auto, unknown = false, manual = !!flag.manual;
    if (!on) {
      if (auto) hidden = false;
      auto = false;
    } else {
      // Jeton que le MJ avait caché avant le brouillard : il reste à sa main.
      if (!token.getFlag(SYSTEM_ID, FOG) && token.hidden) manual = true;
      const view = enemyView(token, eyes, t, mist);
      unknown = !view.known;
      if (!manual) { hidden = !view.seen; auto = hidden; }
    }
    if (hidden !== token.hidden || auto !== !!flag.auto || unknown !== !!flag.unknown || manual !== !!flag.manual) {
      updates.push({ _id: token.id, hidden, [`flags.${SYSTEM_ID}.${FOG}`]: { auto, unknown, manual } });
    }
  }
  if (updates.length) await scene.updateEmbeddedDocuments("Token", updates, { afcFog: true });
}

/** Le MJ cache ou montre un jeton ennemi lui-même : le brouillard ne le touche plus. */
export function onPreUpdateToken(doc, changes, options) {
  if (options.afcFog || !game.user.isGM || !("hidden" in changes) || !isEnemy(doc) || !fogOn(doc.parent)) return;
  foundry.utils.setProperty(changes, `flags.${SYSTEM_ID}.${FOG}.manual`, true);
  foundry.utils.setProperty(changes, `flags.${SYSTEM_ID}.${FOG}.auto`, false);
}

/** Une troupe ennemie a agi (combat, tir, mouvement après la révélation) : fin de son embuscade. */
export function markActed(token) {
  if (game.user.isGM && isEnemy(token) && !fogFlag(token).acted) return token.setFlag(SYSTEM_ID, FOG, { acted: true });
}

/** Rend le jeton au brouillard (après l'avoir caché ou montré à la main). */
export const releaseToFog = token => token.setFlag(SYSTEM_ID, FOG, { manual: false });
/** Identifie la troupe pour les joueurs (Lire le champ), ou annule. */
export const toggleKnown = token => token.setFlag(SYSTEM_ID, FOG, { known: !fogFlag(token).known });
export const fogState = token => fogFlag(token);

/* ---------- Cases non vues, sur la carte ---------- */

/** Assombrit les cases que la Compagnie ne voit pas (le MJ : légèrement, pour suivre). */
export function drawFog() {
  if (!canvas.ready) return;
  canvas.tokens.children.filter(c => c.name === "afcFog").forEach(c => c.destroy({ children: true }));
  if (!fogOn() || !canvas.scene.tokens.some(isTroop)) return;
  const seen = companyView();
  const layer = new PIXI.Graphics();
  layer.name = "afcFog";
  layer.eventMode = "none";
  layer.beginFill(0x15100b, game.user.isGM ? 0.3 : 0.62);
  for (const cell of terrainOf(canvas.scene).cells) {
    if (!seen.has(keyOf(cell))) layer.drawPolygon(canvas.grid.getVertices(cell).flatMap(v => [v.x, v.y]));
  }
  layer.endFill();
  canvas.tokens.addChildAt(layer, 0);
}

/** Masque « ? » sur une troupe inconnue (joueurs) : ni image, ni nom, ni état. */
export function drawUnknownMask(token) {
  token.children.filter(c => c.name === "afcUnknown").forEach(c => c.destroy({ children: true }));
  if (!unknownToMe(token.document)) return;
  const doc = token.document;
  const points = canvas.grid.getVertices(canvas.grid.getOffset(center(doc))).flatMap(v => [v.x - doc._source.x, v.y - doc._source.y]);
  const mask = new PIXI.Container();
  mask.name = "afcUnknown";
  mask.eventMode = "none";
  const hex = new PIXI.Graphics();
  hex.lineStyle({ width: 4, color: 0xd04a3f, alpha: 0.95 }).beginFill(0x4a4540, 1).drawPolygon(points).endFill();
  const text = new foundry.canvas.containers.PreciseText("?", Object.assign(CONFIG.canvasTextStyle.clone(), {
    fontSize: Math.round(token.h * 0.45), fill: "#f3ead6", stroke: "#1b140d", strokeThickness: 4
  }));
  text.anchor.set(0.5);
  text.position.set(token.w / 2, token.h / 2);
  mask.addChild(hex, text);
  token.addChild(mask);
}
