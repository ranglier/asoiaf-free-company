/**
 * Initiative du combat individuel (Combat Tracker, carrousel du module Carousel Combat Tracker, bouton des
 * fiches) : test d'Agilité, avec les dés de bonus de Vivacité ; les dés de bonus de Vivacité départagent
 * les égalités (décimale). Les malus automatiques des tests s'appliquent (blessures, lésions, armure,
 * troupe désorganisée).
 */
import { specialtyBonus } from "../data/actor-character.mjs";
import { autoPenalties } from "./test-roll.mjs";

const QUICKNESS = ["vivacité", "vivacite", "rapidité", "quickness"];
const loc = key => game.i18n.localize(key);

/** Rang d'Agilité, dés de bonus de Vivacité et malus automatiques d'un acteur. */
function initiativePool(actor) {
  const agility = actor.type === "troop"
    ? { rank: actor.system.book?.abilities?.agility ?? 2, specialties: [] }
    : actor.system.abilities?.agility;
  const rank = Math.max(1, agility?.rank ?? 2);
  const bonus = Math.min(rank, specialtyBonus(agility, QUICKNESS));
  return { rank, bonus, auto: autoPenalties(actor, "agility") };
}

/** Formule d'initiative d'un acteur : « (rang + bonus)d6, on garde les meilleurs dés de test ». */
export function initiativeFormula(actor) {
  if (!actor) return "2d6kh2";
  const { rank, bonus, auto } = initiativePool(actor);
  const kept = Math.max(1, rank - auto.dice);
  const mod = Math.round((auto.modifier + bonus / 10) * 10) / 10;
  return `${rank + bonus}d6kh${kept}${mod ? ` ${mod > 0 ? "+" : "-"} ${Math.abs(mod)}` : ""}`;
}

/** Réserve affichée sur la fiche : « 3D+1B », malus compris. */
export function initiativeLabel(actor) {
  const { rank, bonus, auto } = initiativePool(actor);
  return `${rank}D${bonus ? `+${bonus}B` : ""}${auto.dice ? ` −${auto.dice}D` : ""}${auto.modifier ? ` ${auto.modifier > 0 ? "+" : "−"}${Math.abs(auto.modifier)}` : ""}`;
}

/**
 * Bouton des fiches : lance l'initiative des jetons du personnage dans le combat en cours, en les y
 * ajoutant s'il le faut. Sans combat, le MJ en crée un sur la scène affichée.
 * (Actor#rollInitiative ajoute bien les jetons, mais ne lance pas leur initiative dans ce cas.)
 */
export async function rollActorInitiative(actor) {
  const tokens = actor.getActiveTokens(false, true);
  if (!tokens.length) return ui.notifications.warn(loc("AFC.Roll.InitiativeNoToken"));
  let combat = game.combat;
  if (!combat) {
    if (!game.user.isGM) return ui.notifications.warn(loc("AFC.Roll.InitiativeNoCombat"));
    combat = await Combat.implementation.create({ scene: canvas.scene?.id, active: true });
  }
  const missing = tokens.filter(t => !combat.combatants.some(c => c.tokenId === t.id));
  if (missing.length) {
    await combat.createEmbeddedDocuments("Combatant", missing.map(t => ({ tokenId: t.id, sceneId: t.parent.id, actorId: actor.id, hidden: t.hidden })));
  }
  const pending = combat.combatants.filter(c => tokens.some(t => t.id === c.tokenId) && c.initiative === null);
  if (!pending.length) return ui.notifications.info(loc("AFC.Roll.InitiativeDone"));
  return combat.rollInitiative(pending.map(c => c.id));
}

/** Combattant du système : la formule ci-dessus remplace celle de Foundry (vide pour ce système). */
export class AFCCombatant extends Combatant {
  _getInitiativeFormula() {
    return initiativeFormula(this.actor);
  }
}
