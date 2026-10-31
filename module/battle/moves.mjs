/**
 * Mouvements des troupes (règles maison) : pendant la phase des ordres, on choisit la case d'arrivée
 * (Manœuvrer, Se replier) ou la cible (Charger, Attaquer) ; le mouvement prévu est dessiné pour qui
 * commande la troupe, et les jetons ne bougent qu'à la révélation, tous en même temps.
 */
import { adjacent, center, regionTerrainKey } from "./engagement.mjs";
import { isBook } from "./rules.mjs";
import { getBattle, gmHandlers, requestGM, saveBattle, setUnit, unitOf } from "./state.mjs";

const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
/** Ordres dont on choisit soi-même la case d'arrivée, et ordres qui rejoignent leur cible. */
export const PATH_ORDERS = ["maneuver", "withdraw"];
export const APPROACH_ORDERS = ["charge", "attack"];

const keyOf = o => `${o.i},${o.j}`;
const offsetOf = key => { const [i, j] = key.split(",").map(Number); return { i, j }; };
export const cellOf = token => canvas.grid.getOffset(center(token));
export const cellCenter = key => canvas.grid.getCenterPoint(offsetOf(key));
const troops = scene => scene.tokens.filter(t => t.actor?.type === "troop");

/** Terrains d'une case. */
function cellTerrains(offset, scene) {
  const point = { ...canvas.grid.getCenterPoint(offset), elevation: 0 };
  return scene.regions.filter(r => regionTerrainKey(r) && r.testPoint(point)).map(regionTerrainKey);
}

/** Cases occupées. Pour un joueur, une troupe cachée n'existe pas : le tracé ne la trahit pas. */
function occupiedCells(scene, { all = false } = {}) {
  const cells = new Map();
  for (const t of troops(scene)) {
    if (t.actor.system.state === "destroyed" || (t.hidden && !all && !game.user.isGM)) continue;
    cells.set(keyOf(cellOf(t)), t);
  }
  return cells;
}

/** Portée du mouvement selon l'ordre. */
export function moveRange(token, order) {
  const s = token.actor.system;
  if (order === "withdraw") return 1;
  return s.move + (order === "maneuver" && (s.has.mounted || s.has.light) ? 1 : 0);
}

/**
 * Cases atteignables : marais à 2 points, rivière infranchissable sans gué ni pont, on traverse ses
 * alliés mais pas l'ennemi. Renvoie, pour chaque case, le coût et le chemin.
 */
function reach(token, range, occupied, { roadOnly = false } = {}) {
  const scene = token.parent;
  const rect = canvas.dimensions.sceneRect;
  const start = keyOf(cellOf(token));
  const seen = new Map([[start, { cost: 0, path: [] }]]);
  const queue = [start];
  while (queue.length) {
    queue.sort((a, b) => seen.get(a).cost - seen.get(b).cost);
    const current = queue.shift();
    const from = seen.get(current);
    for (const next of canvas.grid.getAdjacentOffsets(offsetOf(current))) {
      const key = keyOf(next);
      const at = canvas.grid.getCenterPoint(next);
      if (!rect.contains(at.x, at.y)) continue;
      const terrains = cellTerrains(next, scene);
      if (terrains.includes("river") && !terrains.includes("ford") && !terrains.includes("bridge")) continue;
      if (roadOnly && !terrains.includes("road")) continue;
      const other = occupied.get(key);
      if (other && other.actor.system.side !== token.actor.system.side) continue;
      const cost = from.cost + (terrains.includes("marsh") ? 2 : 1);
      if (cost > range || (seen.has(key) && seen.get(key).cost <= cost)) continue;
      seen.set(key, { cost, path: [...from.path, key] });
      queue.push(key);
    }
  }
  return seen;
}

/** Cases d'arrivée possibles pour cet ordre (Route : une case de plus à qui Manœuvre le long de la route). */
function destinations(token, order, occupied) {
  const range = moveRange(token, order);
  const cells = reach(token, range, occupied);
  if (order === "maneuver" && cellTerrains(cellOf(token), token.parent).includes("road")) {
    for (const [key, value] of reach(token, range + 1, occupied, { roadOnly: true })) if (!cells.has(key)) cells.set(key, value);
  }
  const here = keyOf(cellOf(token));
  return new Map([...cells].filter(([key]) => key !== here && !occupied.has(key)));
}

/** Chemin d'une troupe qui rejoint sa cible : case choisie si elle convient, sinon la plus proche au contact. */
function approachPath(token, unit, occupied) {
  const target = token.parent.tokens.get(unit.target);
  if (!target) return [];
  const contact = new Set(canvas.grid.getAdjacentOffsets(cellOf(target)).map(keyOf));
  const cells = destinations(token, "charge", occupied);
  const chosen = unit.path?.at(-1);
  if (chosen && contact.has(chosen) && cells.has(chosen)) return cells.get(chosen).path;
  if (contact.has(keyOf(cellOf(token)))) return [];
  const list = [...cells];
  const closest = list.filter(([key]) => contact.has(key)).sort((a, b) => a[1].cost - b[1].cost)[0];
  if (closest) return closest[1].path;
  // Cible hors d'atteinte : on s'en rapproche autant que possible.
  const goal = canvas.grid.getCenterPoint(cellOf(target));
  const gap = point => canvas.grid.measurePath([point, goal]).spaces;
  const best = list.map(([key, v]) => ({ gap: gap(cellCenter(key)), cost: v.cost, path: v.path })).sort((a, b) => a.gap - b.gap || a.cost - b.cost)[0];
  return best && best.gap < gap(center(token)) ? best.path : [];
}

/** Mouvement prévu d'une troupe, pour le dessin (des cases, sans la case de départ). */
export function plannedPath(token, unit) {
  if (PATH_ORDERS.includes(unit.order)) return unit.path ?? [];
  if (APPROACH_ORDERS.includes(unit.order) && unit.target) return approachPath(token, unit, occupiedCells(token.parent));
  return [];
}

/* ---------- Choix de la case d'arrivée ---------- */

let picking = null;

/** Attend un clic sur une case en surbrillance (Échap : annuler ; clic sur la troupe : rester sur place). */
export function startMovePick(token) {
  cancelMovePick();
  const unit = unitOf(getBattle(token.parent), token.id);
  const occupied = occupiedCells(token.parent);
  const cells = destinations(token, APPROACH_ORDERS.includes(unit.order) ? "charge" : unit.order, occupied);
  if (APPROACH_ORDERS.includes(unit.order)) {
    const target = token.parent.tokens.get(unit.target);
    if (!target) return ui.notifications.warn(loc("AFC.Battle.Moves.NeedTarget"));
    const contact = new Set(canvas.grid.getAdjacentOffsets(cellOf(target)).map(keyOf));
    for (const key of [...cells.keys()]) if (!contact.has(key)) cells.delete(key);
  }
  if (!cells.size) return ui.notifications.info(fmt("AFC.Battle.Moves.Nowhere", { name: token.name }));

  const layer = new PIXI.Graphics();
  layer.name = "afcMoveRange";
  layer.eventMode = "none";
  const color = token.actor.system.side === "company" ? 0x4f8fc8 : 0xd04a3f;
  for (const key of cells.keys()) {
    const points = canvas.grid.getVertices(offsetOf(key)).flatMap(v => [v.x, v.y]);
    layer.lineStyle({ width: 2, color, alpha: 0.9 }).beginFill(color, 0.25).drawPolygon(points).endFill();
  }
  canvas.tokens.addChildAt(layer, 0);

  const view = canvas.app.view;
  const here = keyOf(cellOf(token));
  const onDown = async event => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const key = keyOf(canvas.grid.getOffset(canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY })));
    if (key !== here && !cells.has(key)) return ui.notifications.warn(loc("AFC.Battle.Moves.OutOfRange"));
    cancelMovePick();
    await setUnit(token.id, { path: key === here ? [] : cells.get(key).path });
    afterPlan(token);
  };
  const onKey = event => {
    if (event.key !== "Escape") return;
    cancelMovePick();
    afterPlan(token);
  };
  view.addEventListener("pointerdown", onDown, { capture: true });
  window.addEventListener("keydown", onKey);
  view.style.cursor = "crosshair";
  picking = { onDown, onKey, layer };
  ui.notifications.info(fmt("AFC.Battle.Moves.Pick", { name: token.name }));
}

export function cancelMovePick() {
  if (!picking) return;
  const view = canvas.app?.view;
  view?.removeEventListener("pointerdown", picking.onDown, { capture: true });
  window.removeEventListener("keydown", picking.onKey);
  if (view) view.style.cursor = "";
  if (!picking.layer.destroyed) picking.layer.destroy();
  picking = null;
}

/** La troupe a-t-elle déjà bougé ce tour ? */
export const hasMoved = token => (getBattle(token.parent).moved ?? []).includes(token.id);

/** Contre-ordre après la révélation : le mouvement se joue tout de suite, s'il n'a pas déjà eu lieu. */
export function afterPlan(token) {
  if (getBattle(token.parent).revealed && !isBook(token.parent) && !hasMoved(token)) requestGM("troopMove", { token: token.id });
}

/* ---------- Exécution, chez le MJ ---------- */

/** Position du coin du jeton pour le poser au centre d'une case. */
function tokenUpdate(token, key) {
  const c = cellCenter(key);
  return { _id: token.id, x: Math.round(c.x - (token.width * canvas.grid.sizeX) / 2), y: Math.round(c.y - (token.height * canvas.grid.sizeY) / 2) };
}

/** Dernière case libre du chemin : on s'arrête avant un ennemi, on ne finit pas sur une case prise. */
function walk(token, path, occupied) {
  let last = null;
  for (const key of path) {
    const other = occupied.get(key);
    if (other && other.id !== token.id && other.actor.system.side !== token.actor.system.side) break;
    if (!other) last = key;
  }
  return last;
}

/**
 * Manœuvres simultanées : d'abord ceux dont la case d'arrivée est libre (une place libérée sert au
 * suivant), puis les autres s'arrêtent à la dernière case libre de leur chemin.
 */
function settleMoves(moves, occupied) {
  const results = [];
  const commit = (move, end) => {
    occupied.delete(keyOf(cellOf(move.token)));
    occupied.set(end, move.token);
    results.push({ token: move.token, end });
  };
  let pending = [...moves], progress = true;
  while (pending.length && progress) {
    progress = false;
    for (const move of [...pending]) {
      const end = walk(move.token, move.path, occupied);
      if (end !== move.path.at(-1)) continue;
      commit(move, end);
      pending = pending.filter(m => m !== move);
      progress = true;
    }
  }
  for (const move of pending) {
    const end = walk(move.token, move.path, occupied);
    if (end) commit(move, end);
  }
  return results;
}

const canMove = token => !["routed", "destroyed"].includes(token.actor.system.state);

/** Joue les mouvements de la révélation : manœuvres et replis, puis charges et attaques vers la position réelle de leur cible. */
export async function executeMoves(scene = canvas.scene) {
  const battle = getBattle(scene);
  const moved = new Set(battle.moved ?? []);
  const units = troops(scene).filter(canMove).map(token => ({ token, unit: unitOf(battle, token.id) }));

  const paths = units.filter(u => PATH_ORDERS.includes(u.unit.order) && u.unit.path?.length).map(u => ({ token: u.token, path: u.unit.path }));
  const settled = settleMoves(paths, occupiedCells(scene, { all: true }));
  if (settled.length) await scene.updateEmbeddedDocuments("Token", settled.map(r => tokenUpdate(r.token, r.end)));
  settled.forEach(r => moved.add(r.token.id));

  // Les plus rapides d'abord. Chacun voit la carte telle que les précédents l'ont laissée.
  const notes = [];
  const approaching = units.filter(u => APPROACH_ORDERS.includes(u.unit.order) && u.unit.target).sort((a, b) => b.token.actor.system.move - a.token.actor.system.move);
  for (const { token, unit } of approaching) {
    const occupied = occupiedCells(scene, { all: true });
    const end = walk(token, approachPath(token, unit, occupied), occupied);
    if (end) {
      await scene.updateEmbeddedDocuments("Token", [tokenUpdate(token, end)]);
      moved.add(token.id);
    }
    const target = scene.tokens.get(unit.target);
    if (target && !adjacent(token, target) && !token.hidden && !target.hidden) notes.push(fmt("AFC.Battle.Moves.NotReached", { a: esc(token.name), d: esc(target.name) }));
  }
  battle.moved = [...moved];
  await saveBattle(battle, scene);
  if (notes.length) await ChatMessage.create({ content: `<div class="afc-card battle"><ul class="month-lines">${notes.map(n => `<li>${n}</li>`).join("")}</ul></div>` });
}

/** Mouvement d'une seule troupe (contre-ordre). */
gmHandlers.troopMove = ({ token: id }) => {
  // Laisse arriver l'ordre écrit par le joueur sur la troupe.
  setTimeout(async () => {
    const scene = canvas.scene;
    const token = scene?.tokens.get(id);
    if (!token?.actor || !canMove(token)) return;
    const battle = getBattle(scene);
    if ((battle.moved ?? []).includes(id)) return;
    const unit = unitOf(battle, id);
    const occupied = occupiedCells(scene, { all: true });
    const path = PATH_ORDERS.includes(unit.order) ? unit.path ?? [] : APPROACH_ORDERS.includes(unit.order) && unit.target ? approachPath(token, unit, occupied) : [];
    const end = walk(token, path, occupied);
    if (!end) return;
    await scene.updateEmbeddedDocuments("Token", [tokenUpdate(token, end)]);
    battle.moved = [...(battle.moved ?? []), id];
    await saveBattle(battle, scene);
  }, 300);
};
