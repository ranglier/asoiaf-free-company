/**
 * État de la bataille.
 * - Sur la scène (drapeau, écrit par le MJ) : tour, révélation, météo, engagements du tour.
 * - Sur chaque troupe (drapeau de l'acteur) : ordre, cible, officier, contre-ordre. Le propriétaire
 *   de la troupe l'écrit lui-même : pas besoin qu'un MJ soit connecté pour donner un ordre.
 * Seul cas qui passe par le MJ : un joueur qui commande une troupe par son officier sans posséder la
 * troupe. Les ordres restent lisibles par les clients (discrétion d'interface, pas un secret fort).
 */
import { SYSTEM_ID } from "../config.mjs";

const FLAG = "battle";
const UNIT = "unit";
const CHANNEL = `system.${SYSTEM_ID}`;
const EMPTY_UNIT = { order: "", target: "", officer: "", countered: false };

/** Ordre, cible, officier et contre-ordre d'un jeton de troupe. */
function readUnit(token, legacy) {
  const flag = token.actor?.getFlag(SYSTEM_ID, UNIT);
  return { id: token.id, ...EMPTY_UNIT, ...(flag ?? legacy ?? {}) };
}

/** Bataille de la scène (copie modifiable) ; les troupes sont lues sur leurs acteurs. */
export function getBattle(scene = canvas.scene) {
  const data = foundry.utils.deepClone(scene?.getFlag(SYSTEM_ID, FLAG) ?? {});
  const battle = foundry.utils.mergeObject({ round: 1, revealed: false, weather: "clear", engaged: [], done: [], reload: [], reloadNext: [] }, data);
  // Anciennes versions : unités ou groupes rangés sur la scène.
  const legacy = {};
  for (const u of data.units ?? []) legacy[u.id] = u;
  for (const g of data.groups ?? []) for (const id of g.troops) legacy[id] = { order: g.order ?? "", officer: g.officer ?? "", target: data.plans?.find(p => p.from === id)?.to ?? "" };
  battle.units = (scene?.tokens.filter(t => t.actor?.type === "troop") ?? []).map(t => readUnit(t, legacy[t.id]));
  delete battle.groups;
  delete battle.plans;
  return battle;
}

/** Enregistre la partie « scène » de la bataille (MJ). */
export async function saveBattle(battle, scene = canvas.scene) {
  if (!game.user.isGM) return;
  const { units, ...rest } = battle;
  const old = scene.getFlag(SYSTEM_ID, FLAG);
  if (old?.groups || old?.plans || old?.units) await scene.unsetFlag(SYSTEM_ID, FLAG);
  return scene.setFlag(SYSTEM_ID, FLAG, rest);
}

/** Efface la bataille de la scène et les ordres des troupes (MJ). */
export async function clearBattle(scene = canvas.scene) {
  for (const t of scene.tokens.filter(t => t.actor?.type === "troop")) await t.actor.unsetFlag(SYSTEM_ID, UNIT);
  return scene.unsetFlag(SYSTEM_ID, FLAG);
}

/** Remet à zéro ordre, cible et contre-ordre (fin de tour), en gardant l'officier (MJ). */
export async function resetOrders(scene = canvas.scene) {
  for (const t of scene.tokens.filter(t => t.actor?.type === "troop")) {
    const officer = readUnit(t).officer;
    await t.actor.setFlag(SYSTEM_ID, UNIT, { ...EMPTY_UNIT, officer });
  }
}

/** Ordre, cible et officier d'une troupe dans une bataille déjà lue. */
export function unitOf(battle, tokenId) {
  return battle.units.find(u => u.id === tokenId) ?? { id: tokenId, ...EMPTY_UNIT };
}

/** Peut-on commander cette troupe : MJ, propriétaire de la troupe ou de son officier. */
export function canCommand(token, battle = getBattle(token.parent), user = game.user) {
  if (user.isGM) return true;
  if (token.actor?.testUserPermission(user, "OWNER")) return true;
  const officer = game.actors.get(unitOf(battle, token.id).officer);
  return !!officer?.testUserPermission(user, "OWNER");
}

/**
 * Modifie une troupe : { order, target, officer }. Avant la révélation, tout est libre ; après, un
 * joueur ne change ordre ou cible qu'une fois (contre-ordre). Le MJ n'a pas de limite.
 */
export async function setUnit(tokenId, changes) {
  const token = canvas.scene.tokens.get(tokenId);
  if (!token?.actor) return;
  if (token.actor.isOwner) return applyUnit(canvas.scene, tokenId, changes, game.user);
  // Commande par l'officier sans posséder la troupe : le MJ écrit à notre place.
  game.socket.emit(CHANNEL, { action: "unit", scene: canvas.scene.id, token: tokenId, changes, user: game.user.id });
}

async function applyUnit(scene, tokenId, changes, user) {
  const token = scene.tokens.get(tokenId);
  if (!token?.actor) return;
  const battle = getBattle(scene);
  if (!canCommand(token, battle, user)) return;
  const unit = { ...unitOf(battle, tokenId) };
  if (battle.revealed && !user.isGM && ("order" in changes || "target" in changes)) {
    if (unit.countered) return ui.notifications.warn(game.i18n.localize("AFC.Battle.AlreadyCountered"));
    unit.countered = true;
  }
  const counter = battle.revealed && "order" in changes && changes.order !== unit.order;
  for (const key of ["order", "target", "officer"]) if (key in changes) unit[key] = changes[key] ?? "";
  // Un ordre sans cible n'en garde pas (Tenir, Manœuvrer, Se replier).
  if (!["charge", "attack", "shoot"].includes(unit.order)) unit.target = "";
  const { id, ...data } = unit;
  await token.actor.setFlag(SYSTEM_ID, UNIT, data);
  if (counter) {
    ChatMessage.create({ content: `<div class="afc-card battle"><p>${game.i18n.format("AFC.Battle.CounterOrder", {
      group: foundry.utils.escapeHTML(token.name), order: game.i18n.localize(`AFC.Battle.Order.${unit.order}`)
    })}</p></div>` });
  }
}

/** Écoute du canal : un MJ (le premier connecté) écrit pour le joueur qui commande par son officier. */
export function registerBattleSocket() {
  game.socket.on(CHANNEL, data => {
    if (!game.user.isGM || data?.action !== "unit") return;
    // Un seul MJ traite la demande : le premier MJ actif qui a ce code (les autres l'ignorent).
    const gms = game.users.filter(u => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id));
    if (gms[0] !== game.user && game.users.activeGM !== game.user) return;
    const scene = game.scenes.get(data.scene);
    const user = game.users.get(data.user);
    if (scene && user) applyUnit(scene, data.token, data.changes ?? {}, user);
  });
}

/** Ancien format (ordres rangés sur la scène) : recopie sur les troupes, puis nettoie la scène (MJ). */
export async function migrateBattle(scene = canvas.scene) {
  const old = scene?.getFlag(SYSTEM_ID, FLAG);
  if (!game.user.isGM || !(old?.units || old?.groups || old?.plans)) return;
  const battle = getBattle(scene);
  for (const u of battle.units) {
    const token = scene.tokens.get(u.id);
    const { id, ...data } = u;
    if (token?.actor && !token.actor.getFlag(SYSTEM_ID, UNIT)) await token.actor.setFlag(SYSTEM_ID, UNIT, data);
  }
  await saveBattle(battle, scene);
}
