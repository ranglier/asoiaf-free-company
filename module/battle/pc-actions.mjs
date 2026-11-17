/**
 * Actions des PJ pendant un tour de bataille (règles maison) : chaque PJ ou officier a, par tour, soit
 * une action de bataille (Commander, Rallier, Lire le champ…), soit une scène individuelle de 3 rounds.
 * Foundry tient le compteur sur la scène ; Commander et Rallier se comptent seuls, les autres actions se
 * cochent dans la fenêtre Bataille. Un joueur ne peut pas agir deux fois ; le MJ peut passer outre.
 * Le compteur repart à zéro en fin de tour.
 */
import { getBattle, gmHandlers, requestGM, saveBattle, sceneOf, serialGM, unitOf } from "./state.mjs";
import { fogState, setVeil, toggleKnown, unknownToMe, veilState } from "./vision.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const L = "AFC.Battle.PcActions";

/** Actions cochées à la main (Commander et Rallier passent par les boutons des troupes). */
export const MANUAL_ACTIONS = ["readField", "carryOrder", "frontLine", "shootWith", "feat", "free"];
/** Durée d'un tour de bataille, en rounds individuels (décision du 2026-11-02, à l'essai). */
export const SCENE_ROUNDS = 3;

/**
 * Ce qu'a fait un personnage ce tour-ci : { actor, kind: "battle", action, troop } ou { actor, kind: "scene", rounds }.
 * Rangé en liste sur la scène : une liste se remplace en entier, alors qu'un objet se fusionne (une entrée
 * retirée y resterait).
 */
export const actionOf = (battle, actorId) => (Array.isArray(battle.actions) ? battle.actions : []).find(a => a.actor === actorId) ?? null;

/** Liste des actions de la bataille, avec une entrée remplacée (ou retirée si entry est null). */
export function withAction(battle, actorId, entry) {
  const list = (Array.isArray(battle.actions) ? battle.actions : []).filter(a => a.actor !== actorId);
  return entry ? [...list, { actor: actorId, ...entry }] : list;
}

/** Action déclarée mais pas encore jouée (décision du 2026-11-17). */
export const isDeclared = entry => entry?.kind === "battle" && entry.status === "declared";

/** Texte court : « Commander (Archers) », « Scène : 2/3 rounds », « Lire le champ (Archers) : à jouer », « : 2 degrés ». */
export function describeAction(entry, scene = canvas.scene) {
  if (!entry) return loc(`${L}.Free`);
  if (entry.kind === "scene") return fmt(`${L}.Rounds`, { n: entry.rounds, max: SCENE_ROUNDS });
  const token = entry.troop ? scene?.tokens.get(entry.troop) : null;
  // Une troupe ennemie non identifiée reste « Troupe inconnue » pour le joueur.
  const troop = token ? (unknownToMe(token) || (!game.user.isGM && token.hidden) ? loc("AFC.Battle.Fog.Unknown") : token.name) : null;
  const what = `${loc(`${L}.Action.${entry.action}`)}${troop ? ` (${troop})` : ""}`;
  if (isDeclared(entry)) return fmt(`${L}.ToPlay`, { what });
  if (entry.result) return fmt(entry.result.success ? `${L}.Played` : `${L}.PlayedFail`, { what, n: entry.result.degrees });
  return what;
}

/** Bonus des personnages à une troupe pour ce tour : Combattre en première ligne (mêlée) ou Tirer avec l'unité (tir). */
export function pcBonuses(battle, tokenId, action) {
  return (Array.isArray(battle.actions) ? battle.actions : [])
    .filter(a => a.kind === "battle" && a.action === action && a.troop === tokenId && a.result?.success && a.result.degrees > 0)
    .map(a => ({ label: `${loc(`${L}.Action.${action}`)} (${game.actors.get(a.actor)?.name ?? "?"})`, b: a.result.degrees, d: 0, p: 0 }));
}

/**
 * Le personnage peut-il faire une action de bataille ? Un joueur est arrêté s'il a déjà agi ; le MJ
 * reçoit une confirmation (il peut faire une exception).
 */
export async function mayAct(actorId, battle = getBattle(), action = null) {
  const entry = actionOf(battle, actorId);
  // L'action déclarée pendant les ordres se joue maintenant : ce n'est pas une deuxième action.
  if (!entry || (isDeclared(entry) && (!action || entry.action === action))) return true;
  const data = { name: game.actors.get(actorId)?.name ?? "?", what: describeAction(entry) };
  if (!game.user.isGM) {
    ui.notifications.warn(fmt(`${L}.Busy`, data));
    return false;
  }
  return DialogV2.confirm({
    window: { title: loc(`${L}.Title`) }, classes: ["afc", "afc-dialog"],
    content: `<p>${esc(fmt(`${L}.BusyConfirm`, data))}</p>`, rejectClose: false
  });
}

/** Note une action de bataille, un round de scène (entry = "round") ou efface la ligne (entry = null). */
export function recordAction(actorId, entry, scene = canvas.scene) {
  const data = { scene: scene?.id, actor: actorId, entry };
  // Un MJ écrit lui-même ; un joueur passe par le MJ actif.
  return game.user.isGM ? gmHandlers.pcAction({ ...data, user: game.user.id }) : requestGM("pcAction", data);
}

gmHandlers.pcAction = serialGM(async data => {
  const scene = sceneOf(data);
  const user = game.users.get(data.user);
  const actor = game.actors.get(data.actor);
  if (!scene || !actor || !user) return;
  const battle = getBattle(scene);
  // L'officier d'une troupe (un PNJ du MJ, par exemple) agit pour le joueur qui la conduit.
  const troop = data.entry?.troop ? scene.tokens.get(data.entry.troop) : null;
  const officerOf = troop && unitOf(battle, troop.id).officer === actor.id && troop.actor?.testUserPermission(user, "OWNER");
  if (!(user.isGM || actor.testUserPermission(user, "OWNER") || officerOf)) return;
  const old = actionOf(battle, data.actor);
  let entry;
  if (data.entry === null) {
    // Un joueur retire son action tant qu'elle n'est pas jouée ; le MJ efface tout.
    if (!user.isGM && !isDeclared(old)) return;
    entry = null;
  } else if (data.entry === "round") {
    // Une scène individuelle ne suit pas une action de bataille.
    if (old?.kind === "battle") return;
    entry = { kind: "scene", rounds: Math.min(SCENE_ROUNDS, (old?.rounds ?? 0) + 1) };
  } else {
    // Un joueur ne déclare pas une deuxième action par-dessus une action jouée.
    if (!user.isGM && old && !isDeclared(old) && data.entry.status === "declared") return;
    entry = { kind: "battle", action: data.entry.action, troop: data.entry.troop ?? "" };
    if (data.entry.status) entry.status = data.entry.status;
    if (data.entry.result) entry.result = data.entry.result;
  }
  battle.actions = withAction(battle, data.actor, entry);
  await saveBattle(battle, scene);
  // Le MJ est prévenu de ce que font les joueurs (décision du 2026-11-17 : plus rien à retenir de tête).
  if (!user.isGM && game.user.isGM) {
    const what = entry ? describeAction(entry, scene) : loc(`${L}.Cancelled`);
    ui.notifications.info(`${actor.name} : ${what}`);
  }
  // Lire le champ réussi : la troupe visée est identifiée (brouillard de guerre ou voile « inconnue »).
  if (entry?.action === "readField" && entry.result?.success) await identify(scene.tokens.get(entry.troop));
});

/** Identifie une troupe ennemie pour la Compagnie (MJ). */
async function identify(token) {
  if (!token) return;
  if (veilState(token) === "unknown") return setVeil(token, "known");
  if (!fogState(token).known) await toggleKnown(token);
}

/**
 * Lignes du panneau : officiers des troupes de la scène et personnages des joueurs. Un joueur ne voit
 * pas les officiers des seules troupes ennemies.
 */
export function pcLines(battle, scene) {
  const isGM = game.user.isGM;
  const sides = new Map();
  for (const u of battle.units) {
    if (!u.officer) continue;
    const side = scene.tokens.get(u.id)?.actor?.system.side;
    sides.set(u.officer, [...(sides.get(u.officer) ?? []), side]);
  }
  const ids = new Set([...sides.keys(), ...game.actors.filter(a => a.type === "character" && a.hasPlayerOwner).map(a => a.id)]);
  return [...ids].map(id => game.actors.get(id)).filter(a => a && (isGM || a.hasPlayerOwner || sides.get(a.id)?.includes("company")))
    .map(a => {
      const entry = actionOf(battle, a.id);
      const canEdit = isGM || a.isOwner;
      return {
        id: a.id, name: a.name, img: a.img, status: describeAction(entry, scene), done: !!entry, canEdit,
        canAct: canEdit && (isGM || !entry),
        canRound: canEdit && entry?.kind !== "battle" && (entry?.rounds ?? 0) < SCENE_ROUNDS,
        canClear: isGM && !!entry
      };
    }).sort((x, y) => x.name.localeCompare(y.name));
}

/** Officier de la troupe qui a déjà agi ce tour : texte de l'infobulle, sinon "". */
export function officerBusy(battle, tokenId) {
  const officer = unitOf(battle, tokenId).officer;
  const entry = officer ? actionOf(battle, officer) : null;
  return entry ? fmt(`${L}.Busy`, { name: game.actors.get(officer)?.name ?? "?", what: describeAction(entry) }) : "";
}
