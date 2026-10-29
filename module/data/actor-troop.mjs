/**
 * Troupe : une unité sur la carte de bataille (un jeton). Elle peut venir d'une unité de la
 * Compagnie (source) ou être créée directement par le MJ (ennemis).
 */
import { UNIT_TRAININGS } from "../config.mjs";
import {
  DISORDER_LOSS, MAX_LOSS, RANGES, STATE_ORDER, TRAINING_BATTLE, TRAITS, TROOP_STATES
} from "../battle/battle-config.mjs";

const fields = foundry.data.fields;
const int = (initial, opts = {}) => new fields.NumberField({ required: true, integer: true, initial, ...opts });

export default class TroopData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      side: new fields.StringField({ initial: "enemy", choices: ["company", "enemy"] }),
      unitType: new fields.StringField({ blank: true }),
      training: new fields.StringField({ initial: "trained", choices: Object.keys(UNIT_TRAININGS) }),
      traits: new fields.ArrayField(new fields.StringField({ choices: TRAITS })),
      // Discipline du livre : difficulté pour rallier ou réorganiser (plus bas = mieux).
      discipline: int(6, { min: 0 }),
      state: new fields.StringField({ initial: "fresh", choices: STATE_ORDER }),
      cushion: int(1, { min: 0 }),
      disorders: int(0, { min: 0 }),
      rallies: int(0, { min: 0 }),
      men: int(100, { min: 0 }),
      source: new fields.SchemaField({
        actor: new fields.StringField({ blank: true }),
        item: new fields.StringField({ blank: true })
      }),
      notes: new fields.StringField({ blank: true })
    };
  }

  prepareDerivedData() {
    const t = TRAINING_BATTLE[this.training] ?? TRAINING_BATTLE.trained;
    this.rank = t.rank;
    this.cushionMax = t.cushion;
    this.ralliesMax = t.cushion + 1;
    this.has = Object.fromEntries(this.traits.map(k => [k, true]));
    // Déplacement : infanterie 1, Léger +1, Monté 3 (2 en Armure lourde), minimum 1.
    let move = this.has.mounted ? (this.has.heavyArmor ? 2 : 3) : 1;
    if (this.has.light) move += 1;
    if (this.has.heavyArmor && !this.has.mounted) move -= 1;
    this.move = Math.max(1, move);
    this.range = Math.max(0, ...this.traits.map(k => RANGES[k] ?? 0));
    this.stateIndex = STATE_ORDER.indexOf(this.state);
    // Pertes en fin de bataille : état + 5 % par désorganisation, plafonnées.
    this.loss = Math.min(MAX_LOSS, (TROOP_STATES[this.state]?.loss ?? 0) + this.disorders * DISORDER_LOSS);
    this.lostMen = Math.round(this.men * this.loss / 100);
    this.canCushion = this.state === "fresh" && this.cushion > 0;
  }
}
