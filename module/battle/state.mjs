/**
 * État de la bataille, rangé dans un drapeau de la scène active (écrit par le MJ). Les joueurs
 * donnent leurs ordres par le canal du système : le client du MJ les vérifie et les enregistre.
 * Les ordres sont lisibles par les clients (simple discrétion d'interface, pas un secret fort).
 */
import { SYSTEM_ID } from "../config.mjs";

const FLAG = "battle";
const CHANNEL = `system.${SYSTEM_ID}`;

/** Bataille de la scène (copie modifiable). */
export function getBattle(scene = canvas.scene) {
  const data = scene?.getFlag(SYSTEM_ID, FLAG);
  return foundry.utils.mergeObject(
    { round: 1, revealed: false, weather: "clear", groups: [], plans: [], engaged: [], reload: [], reloadNext: [] },
    foundry.utils.deepClone(data ?? {})
  );
}

/** Enregistre la bataille (MJ). Les listes sont remplacées en entier. */
export async function saveBattle(battle, scene = canvas.scene) {
  if (!game.user.isGM) return;
  return scene.setFlag(SYSTEM_ID, FLAG, battle);
}

/** Efface la bataille de la scène (MJ). */
export async function clearBattle(scene = canvas.scene) {
  return scene.unsetFlag(SYSTEM_ID, FLAG);
}

/** Groupe qui contient un jeton. */
export const groupOfToken = (battle, tokenId) => battle.groups.find(g => g.troops.includes(tokenId));

/** Un utilisateur peut-il donner l'ordre de ce groupe (officier ou une troupe à lui) ? */
export function canOrder(group, user = game.user, scene = canvas.scene) {
  if (user.isGM) return true;
  const officer = game.actors.get(group.officer);
  if (officer?.testUserPermission(user, "OWNER")) return true;
  return group.troops.some(id => scene.tokens.get(id)?.actor?.testUserPermission(user, "OWNER"));
}

/** Fixe l'ordre d'un groupe : directement pour le MJ, par le canal pour un joueur. */
export async function setOrder(groupId, order, { counter = false } = {}) {
  if (game.user.isGM) return applyOrder(canvas.scene, groupId, order, counter, game.user);
  game.socket.emit(CHANNEL, { action: "order", scene: canvas.scene.id, group: groupId, order, counter, user: game.user.id });
}

/**
 * Ordre donné depuis un jeton (carte) : à son groupe, ou à un groupe créé pour lui seul s'il n'en a pas.
 * Après la révélation, c'est un contre-ordre.
 */
export async function setTokenOrder(tokenId, order) {
  const counter = getBattle().revealed;
  if (game.user.isGM) return applyTokenOrder(canvas.scene, tokenId, order, counter, game.user);
  game.socket.emit(CHANNEL, { action: "orderToken", scene: canvas.scene.id, token: tokenId, order, counter, user: game.user.id });
}

async function applyTokenOrder(scene, tokenId, order, counter, user) {
  const battle = getBattle(scene);
  let group = groupOfToken(battle, tokenId);
  if (!group) {
    const token = scene.tokens.get(tokenId);
    if (!token?.actor || (!user.isGM && !token.actor.testUserPermission(user, "OWNER"))) return;
    group = { id: foundry.utils.randomID(), name: token.name, side: token.actor.system.side, officer: "", troops: [tokenId], order: "", countered: false };
    battle.groups.push(group);
    await saveBattle(battle, scene);
  }
  return applyOrder(scene, group.id, order, counter, user);
}

async function applyOrder(scene, groupId, order, counter, user) {
  const battle = getBattle(scene);
  const group = battle.groups.find(g => g.id === groupId);
  if (!group || !canOrder(group, user, scene)) return;
  // Avant la révélation : ordre libre. Après : un seul contre-ordre par groupe et par tour.
  if (battle.revealed) {
    if (!counter || group.countered) return;
    group.countered = true;
  }
  group.order = order;
  await saveBattle(battle, scene);
  if (battle.revealed) {
    ChatMessage.create({ content: `<div class="afc-card battle"><p>${game.i18n.format("AFC.Battle.CounterOrder", {
      group: foundry.utils.escapeHTML(group.name), order: game.i18n.localize(`AFC.Battle.Order.${order}`)
    })}</p></div>` });
  }
}

/** Cible désignée d'une troupe (Charger, Attaquer, Tirer). */
export const planOf = (battle, tokenId) => battle.plans.find(p => p.from === tokenId)?.to ?? null;

/**
 * Désigne (ou efface, cible nulle) la cible d'une troupe. Les joueurs le font avant la révélation ;
 * après, seul le MJ peut la changer.
 */
export async function setPlan(tokenId, targetId) {
  if (game.user.isGM) return applyPlan(canvas.scene, tokenId, targetId, game.user);
  game.socket.emit(CHANNEL, { action: "plan", scene: canvas.scene.id, token: tokenId, target: targetId, user: game.user.id });
}

async function applyPlan(scene, tokenId, targetId, user) {
  const battle = getBattle(scene);
  const token = scene.tokens.get(tokenId);
  if (!token?.actor) return;
  if (!user.isGM) {
    const group = groupOfToken(battle, tokenId);
    const allowed = group ? canOrder(group, user, scene) : token.actor.testUserPermission(user, "OWNER");
    if (!allowed || battle.revealed) return;
  }
  battle.plans = battle.plans.filter(p => p.from !== tokenId);
  if (targetId && targetId !== tokenId) battle.plans.push({ from: tokenId, to: targetId });
  await saveBattle(battle, scene);
}

/** Écoute du canal : seul le MJ actif traite les ordres des joueurs. */
export function registerBattleSocket() {
  game.socket.on(CHANNEL, data => {
    if (game.users.activeGM !== game.user) return;
    const scene = game.scenes.get(data?.scene);
    const user = game.users.get(data?.user);
    if (!scene || !user) return;
    if (data.action === "order") applyOrder(scene, data.group, data.order, data.counter, user);
    if (data.action === "orderToken") applyTokenOrder(scene, data.token, data.order, data.counter, user);
    if (data.action === "plan") applyPlan(scene, data.token, data.target, user);
  });
}
