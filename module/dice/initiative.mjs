/**
 * Initiative du combat individuel (Combat Tracker, et carrousel du module Carousel Combat Tracker) :
 * test d'Agilité, avec les dés de bonus de Vivacité ; les dés de bonus de Vivacité départagent les
 * égalités (décimale). Les malus automatiques des tests s'appliquent (blessures, lésions, armure, troupe
 * désorganisée).
 */
import { specialtyBonus } from "../data/actor-character.mjs";
import { autoPenalties } from "./test-roll.mjs";

const QUICKNESS = ["vivacité", "vivacite", "rapidité", "quickness"];

/** Formule d'initiative d'un acteur : « (rang + bonus)d6, on garde les meilleurs dés de test ». */
export function initiativeFormula(actor) {
  if (!actor) return "2d6kh2";
  const agility = actor.type === "troop"
    ? { rank: actor.system.book?.abilities?.agility ?? 2, specialties: [] }
    : actor.system.abilities?.agility;
  const rank = Math.max(1, agility?.rank ?? 2);
  const bonus = Math.min(rank, specialtyBonus(agility, QUICKNESS));
  const auto = autoPenalties(actor, "agility");
  const kept = Math.max(1, rank - auto.dice);
  const mod = Math.round((auto.modifier + bonus / 10) * 10) / 10;
  return `${rank + bonus}d6kh${kept}${mod ? ` ${mod > 0 ? "+" : "-"} ${Math.abs(mod)}` : ""}`;
}

/** Combattant du système : la formule ci-dessus remplace celle de Foundry (vide pour ce système). */
export class AFCCombatant extends Combatant {
  _getInitiativeFormula() {
    return initiativeFormula(this.actor);
  }
}
