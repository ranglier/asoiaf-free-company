/**
 * Troupe : une unité sur la carte de bataille (un jeton). Elle peut venir d'une unité de la
 * Compagnie (source) ou être créée directement par le MJ (ennemis).
 */
import { UNIT_TRAININGS } from "../config.mjs";
import {
  DISORDER_LOSS, MAX_LOSS, RANGES, STATE_ORDER, TRAINING_BATTLE, TRAITS, TROOP_STATES
} from "../battle/battle-config.mjs";
import { BOOK_ABILITIES, BOOK_EQUIPMENT, BOOK_FORMATIONS, BOOK_MOVE, BOOK_RANGES, BOOK_STATUS } from "../battle/book-config.mjs";

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
      notes: new fields.StringField({ blank: true }),
      // Règles du livre : données à part (basculer de règles ne perd rien).
      book: new fields.SchemaField({
        ready: new fields.BooleanField({ initial: false }),
        type: new fields.StringField({ initial: "infantry", choices: Object.keys(BOOK_EQUIPMENT) }),
        abilities: new fields.SchemaField(Object.fromEntries(BOOK_ABILITIES.map(k => [k, int(2, { min: 1 })]))),
        upArmor: new fields.BooleanField({ initial: false }),
        upFight: new fields.BooleanField({ initial: false }),
        upShoot: new fields.BooleanField({ initial: false }),
        status: new fields.StringField({ initial: "organized", choices: BOOK_STATUS }),
        damage: int(0, { min: 0 }),
        penalties: int(0, { min: 0 }),
        wasDamaged: new fields.BooleanField({ initial: false }),
        formation: new fields.StringField({ initial: "none", choices: Object.keys(BOOK_FORMATIONS) }),
        defendResult: new fields.NumberField({ nullable: true, integer: true, initial: null }),
        probing: new fields.BooleanField({ initial: false }),
        setCharge: new fields.BooleanField({ initial: false }),
        readied: new fields.StringField({ blank: true })
      })
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
    this.prepareBook();
  }

  /** Valeurs dérivées des règles du livre (chapitre 10). */
  prepareBook() {
    const b = this.book, a = b.abilities;
    const eq = BOOK_EQUIPMENT[b.type] ?? BOOK_EQUIPMENT.infantry;
    const armor = b.upArmor ? eq.up : eq.base;
    const fight = b.upFight ? eq.up : eq.base;
    const shoot = (b.upShoot ? eq.up : eq.base).shoot;
    b.ar = armor.ar;
    b.armorPenalty = armor.ap;
    b.bulk = armor.bulk;
    b.defense = Math.max(0, a.agility + a.athletics + a.awareness - armor.ap);
    b.health = a.endurance * 3;
    b.healthLeft = Math.max(0, b.health - b.damage);
    b.fightDamage = Math.max(0, a.athletics + fight.fight);
    b.shoot = shoot ? { damage: Math.max(0, a[shoot.ability] + shoot.mod), range: shoot.range, yards: BOOK_RANGES[shoot.range] } : null;
    const mounted = b.type === "cavalry";
    const base = mounted ? BOOK_MOVE.cavalry : b.type === "warships" ? BOOK_MOVE.ships : BOOK_MOVE.infantry;
    b.mounted = mounted;
    b.moveYards = Math.max(10, base - armor.bulk * BOOK_MOVE.bulk);
    b.sprintYards = b.type === "warships" ? b.moveYards : b.moveYards * BOOK_MOVE.sprint;
    b.active = !["routed", "destroyed"].includes(b.status);
  }
}
