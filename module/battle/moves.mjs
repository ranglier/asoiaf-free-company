/**
 * Mouvements des troupes (règles maison) : pendant la phase des ordres, on choisit la case d'arrivée
 * (Manœuvrer, Se replier) ou la cible (Charger, Attaquer) ; le mouvement prévu est dessiné pour qui
 * commande la troupe, et les jetons ne bougent qu'à la révélation, tous en même temps.
 */
import { adjacent, center, distance, regionTerrainKey, shootRange } from "./engagement.mjs";
import { isBook } from "./rules.mjs";
import { getBattle, gmHandlers, gmOnScene, requestGM, saveBattle, sceneOf, setUnit, unitOf } from "./state.mjs";
import { publicName } from "./vision.mjs";

const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
/** Ordres dont on choisit soi-même la case d'arrivée, et ordres qui rejoignent leur cible. */
export const PATH_ORDERS = ["maneuver", "run", "withdraw"];
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
export function occupiedCells(scene, { all = false } = {}) {
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
  const quick = s.has.mounted || s.has.light ? 1 : 0;
  if (order === "run") return s.move + quick + 1;
  return s.move + (order === "maneuver" ? quick : 0);
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

/**
 * Cases d'arrivée possibles pour cet ordre (Route : une case de plus à qui Manœuvre le long de la route).
 * La case d'un allié peut être visée (décision du 2026-11-02) : s'il la quitte ce tour, on y entre ;
 * sinon on s'arrête avant.
 */
export function destinations(token, order, occupied) {
  const range = moveRange(token, order);
  const cells = reach(token, range, occupied);
  if (order === "maneuver" && cellTerrains(cellOf(token), token.parent).includes("road")) {
    for (const [key, value] of reach(token, range + 1, occupied, { roadOnly: true })) if (!cells.has(key)) cells.set(key, value);
  }
  const here = keyOf(cellOf(token));
  return new Map([...cells].filter(([key]) => key !== here));
}

/**
 * Chemin d'une troupe qui rejoint sa cible : case choisie si elle convient et qu'elle est libre, sinon la
 * case libre la plus proche au contact (une case prise par un allié entre-temps ne fait pas échouer la charge).
 */
function approachPath(token, unit, occupied) {
  const target = token.parent.tokens.get(unit.target);
  if (!target) return [];
  const contact = new Set(canvas.grid.getAdjacentOffsets(cellOf(target)).map(keyOf));
  const free = ([key]) => !occupied.has(key);
  const list = [...destinations(token, "charge", occupied)].filter(free);
  const cells = new Map(list);
  const chosen = unit.path?.at(-1);
  if (chosen && contact.has(chosen) && cells.has(chosen)) return cells.get(chosen).path;
  if (contact.has(keyOf(cellOf(token)))) return [];
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
 * Case visée par plusieurs troupes : la plus rapide l'obtient ; à vitesse égale, personne. Les autres
 * s'arrêtent juste avant. Renvoie les messages pour les troupes visibles.
 */
function resolveDisputes(moves) {
  const notes = [];
  const label = list => list.map(m => esc(m.token.name)).join(", ");
  for (let changed = true; changed;) {
    changed = false;
    const byDest = new Map();
    for (const move of moves.filter(m => m.path.length)) {
      const dest = move.path.at(-1);
      byDest.set(dest, [...(byDest.get(dest) ?? []), move]);
    }
    for (const group of byDest.values()) {
      if (group.length < 2) continue;
      changed = true;
      const speed = m => m.token.actor.system.move;
      const top = Math.max(...group.map(speed));
      const fastest = group.filter(m => speed(m) === top);
      const winner = fastest.length === 1 ? fastest[0] : null;
      const losers = group.filter(m => m !== winner);
      for (const loser of losers) loser.path = loser.path.slice(0, -1);
      const seen = losers.filter(m => !m.token.hidden);
      if (!seen.length) continue;
      if (!winner) notes.push(fmt("AFC.Battle.Moves.DisputeTie", { list: label(seen) }));
      else if (winner.token.hidden) notes.push(fmt("AFC.Battle.Moves.DisputeBlocked", { list: label(seen) }));
      else notes.push(fmt("AFC.Battle.Moves.DisputeWon", { a: esc(winner.token.name), list: label(seen) }));
    }
  }
  return notes;
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
  // Échanges de cases entre alliés (décision du 2026-11-02) : deux troupes, ou plus en cercle,
  // qui visent chacune la case de la suivante bougent ensemble, si aucun ennemi ne barre leur chemin.
  const at = new Map(pending.map(m => [keyOf(cellOf(m.token)), m]));
  for (const move of [...pending]) {
    if (!pending.includes(move)) continue;
    const cycle = [];
    let next = move;
    while (next && !cycle.includes(next)) { cycle.push(next); next = at.get(next.path.at(-1)); }
    const side = move.token.actor.system.side;
    const clear = c => c.path.slice(0, -1).every(key => { const other = occupied.get(key); return !other || other.actor.system.side === side; });
    if (next !== move || cycle.some(c => c.token.actor.system.side !== side || !clear(c))) continue;
    for (const c of cycle) occupied.delete(keyOf(cellOf(c.token)));
    for (const c of cycle) {
      occupied.set(c.path.at(-1), c.token);
      results.push({ token: c.token, end: c.path.at(-1) });
    }
    pending = pending.filter(m => !cycle.includes(m));
  }
  for (const move of pending) {
    const end = walk(move.token, move.path, occupied);
    if (end) commit(move, end);
  }
  return results;
}

const canMove = token => !["routed", "destroyed"].includes(token.actor.system.state);

/* ---------- Contact (décision du 2026-11-02) ---------- */

/** Ordres qu'une troupe au contact d'un ennemi ne peut pas recevoir : elle ne rompt le contact qu'en Se repliant. */
export const CONTACT_FORBIDDEN = ["maneuver", "run"];

/** Troupes qui touchent une troupe ennemie active (positions du moment). */
function contactIds(scene) {
  // Un joueur ne compte pas les troupes cachées : le refus trahirait une embuscade.
  const list = troops(scene).filter(canMove).filter(t => game.user.isGM || !t.hidden);
  return new Set(list.filter(t => list.some(o => o.actor.system.side !== t.actor.system.side && adjacent(t, o))).map(t => t.id));
}

/**
 * La troupe est-elle au contact d'un ennemi au début du tour ? Avant la révélation : positions du moment ;
 * après (contre-ordre) : relevé fait à la révélation, avant les mouvements.
 */
export function inContact(token, battle = getBattle(token.parent)) {
  if (battle.revealed) return (battle.contact ?? []).includes(token.id);
  return contactIds(token.parent).has(token.id);
}

/**
 * Joue les mouvements de la révélation : manœuvres et replis, puis charges et attaques vers la position
 * réelle de leur cible. Une troupe au contact qui Se replie reste sur place jusqu'à la fin du tour (elle
 * encaisse les tirs et les mêlées d'abord) ; une troupe qui vise sa case pour la relever attend avec elle.
 */
export async function executeMoves(scene = canvas.scene) {
  const battle = getBattle(scene);
  const moved = new Set(battle.moved ?? []);
  const units = troops(scene).filter(canMove).map(token => ({ token, unit: unitOf(battle, token.id) }));
  const contact = contactIds(scene);
  battle.contact = [...contact];
  const withdrawing = units.filter(u => u.unit.order === "withdraw" && contact.has(u.token.id) && u.unit.path?.length);
  const held = new Set(withdrawing.map(u => keyOf(cellOf(u.token))));
  const relief = units.filter(u => PATH_ORDERS.includes(u.unit.order) && u.unit.order !== "withdraw" && !contact.has(u.token.id) && held.has(u.unit.path?.at(-1)));
  battle.deferred = [...withdrawing, ...relief].map(u => u.token.id);
  const deferred = new Set(battle.deferred);

  const paths = units.filter(u => PATH_ORDERS.includes(u.unit.order) && u.unit.path?.length && !deferred.has(u.token.id)).map(u => ({ token: u.token, path: [...u.unit.path] }));
  const notes = resolveDisputes(paths);
  const settled = settleMoves(paths.filter(p => p.path.length), occupiedCells(scene, { all: true }));
  if (settled.length) await scene.updateEmbeddedDocuments("Token", settled.map(r => tokenUpdate(r.token, r.end)));
  settled.forEach(r => moved.add(r.token.id));

  // Les plus rapides d'abord. Chacun voit la carte telle que les précédents l'ont laissée.
  const approaching = units.filter(u => APPROACH_ORDERS.includes(u.unit.order) && u.unit.target).sort((a, b) => b.token.actor.system.move - a.token.actor.system.move);
  for (const { token, unit } of approaching) {
    const occupied = occupiedCells(scene, { all: true });
    const end = walk(token, approachPath(token, unit, occupied), occupied);
    if (end) {
      await scene.updateEmbeddedDocuments("Token", [tokenUpdate(token, end)]);
      moved.add(token.id);
    }
    const target = scene.tokens.get(unit.target);
    if (target && !adjacent(token, target) && !token.hidden && !target.hidden) notes.push(fmt("AFC.Battle.Moves.NotReached", { a: esc(publicName(token)), d: esc(publicName(target)) }));
  }
  // Tirs devenus impossibles : la cible est sortie de portée pendant les mouvements.
  for (const token of troops(scene)) {
    const s = token.actor.system, unit = unitOf(battle, token.id), target = unit.target ? scene.tokens.get(unit.target) : null;
    if (unit.order !== "shoot" || !target || token.hidden || target.hidden || ["routed", "destroyed"].includes(s.state)) continue;
    const dist = distance(token, target), range = shootRange(s, battle);
    if (dist > range) notes.push(fmt("AFC.Battle.Moves.ShotOutOfRange", { a: esc(publicName(token)), d: esc(publicName(target)), n: dist, r: range }));
  }
  // Relit la bataille avant d'écrire : un point de plan ou un Commander arrivé pendant les mouvements reste.
  const fresh = getBattle(scene);
  Object.assign(fresh, { contact: battle.contact, deferred: battle.deferred, moved: [...moved] });
  await saveBattle(fresh, scene);
  if (notes.length) await ChatMessage.create({ content: `<div class="afc-card battle"><ul class="month-lines">${notes.map(n => `<li>${n}</li>`).join("")}</ul></div>` });
}

/**
 * Fin de tour : les troupes qui se repliaient au contact reculent, après les tirs et les mêlées, et les
 * troupes venues les relever prennent leur place (échange de cases compris). Une troupe en déroute ou
 * détruite ne recule pas ; sa relève n'entre que si la case est libre. Renvoie les lignes de la carte.
 */
export async function executeDeferredMoves(scene = canvas.scene) {
  const battle = getBattle(scene);
  const ids = battle.deferred ?? [];
  if (!ids.length) return [];
  const moves = ids.map(id => scene.tokens.get(id)).filter(t => t?.actor && canMove(t))
    .map(token => ({ token, path: [...(unitOf(battle, token.id).path ?? [])] })).filter(m => m.path.length);
  const notes = resolveDisputes(moves);
  const settled = settleMoves(moves.filter(m => m.path.length), occupiedCells(scene, { all: true }));
  if (settled.length) await scene.updateEmbeddedDocuments("Token", settled.map(r => tokenUpdate(r.token, r.end)));
  for (const r of settled) notes.push(fmt("AFC.Battle.Moves.Disengaged", { name: esc(r.token.name) }));
  const fresh = getBattle(scene);
  fresh.deferred = [];
  await saveBattle(fresh, scene);
  return notes;
}

/** Mouvement d'une seule troupe (contre-ordre). */
gmHandlers.troopMove = data => {
  const id = data.token;
  // Le calcul des cases se fait sur la carte affichée : le MJ doit regarder la scène du joueur.
  if (!gmOnScene(data)) return;
  // Laisse arriver l'ordre écrit par le joueur sur la troupe.
  setTimeout(async () => {
    const scene = sceneOf(data);
    if (scene?.id !== canvas.scene?.id) return;
    const token = scene.tokens.get(id);
    if (!token?.actor || !canMove(token)) return;
    const battle = getBattle(scene);
    if ((battle.moved ?? []).includes(id)) return;
    const unit = unitOf(battle, id);
    // Repli au contact (contre-ordre) : la troupe reculera en fin de tour, après les mêlées.
    if (unit.order === "withdraw" && (battle.contact ?? []).includes(id)) {
      battle.deferred = [...new Set([...(battle.deferred ?? []), id])];
      return saveBattle(battle, scene);
    }
    const occupied = occupiedCells(scene, { all: true });
    const path = PATH_ORDERS.includes(unit.order) ? unit.path ?? [] : APPROACH_ORDERS.includes(unit.order) && unit.target ? approachPath(token, unit, occupied) : [];
    const end = walk(token, path, occupied);
    if (!end) return;
    await scene.updateEmbeddedDocuments("Token", [tokenUpdate(token, end)]);
    battle.moved = [...(battle.moved ?? []), id];
    await saveBattle(battle, scene);
  }, 300);
};
