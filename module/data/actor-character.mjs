import { ABILITIES, AGES, DEFAULT_RANK } from "../config.mjs";

const { fields } = foundry.data;

/** Schéma d'une capacité : rang + spécialités (dés bonus). */
export function abilitySchema() {
  return new fields.SchemaField({
    rank: new fields.NumberField({ required: true, integer: true, min: 1, max: 7, initial: DEFAULT_RANK }),
    specialties: new fields.ArrayField(new fields.SchemaField({
      name: new fields.StringField({ required: true, blank: true }),
      bonus: new fields.NumberField({ required: true, integer: true, min: 0, max: 7, initial: 1 })
    }))
  });
}

export function abilitiesSchema() {
  return new fields.SchemaField(Object.fromEntries(Object.keys(ABILITIES).map(k => [k, abilitySchema()])));
}

/** Calcule les valeurs dérivées communes aux PJ et PNJ. */
export function prepareCombatValues(system, items) {
  const a = system.abilities;
  const armor = items.filter(i => i.type === "armor" && i.system.equipped);
  const armorRating = armor.reduce((s, i) => s + i.system.rating, 0);
  const armorPenalty = armor.reduce((s, i) => s + i.system.penalty, 0);
  const shieldBonus = items.filter(i => i.type === "weapon" && i.system.equipped)
    .reduce((s, i) => s + (i.system.defenseBonus ?? 0), 0);

  system.health.max = a.endurance.rank * 3;
  system.composure.max = a.will.rank * 3;
  system.wounds.max = a.endurance.rank;
  system.injuries.max = a.endurance.rank;
  system.defense = {
    combat: a.agility.rank + a.athletics.rank + a.awareness.rank + shieldBonus - armorPenalty,
    intrigue: a.awareness.rank + a.cunning.rank + a.status.rank
  };
  system.armor = { rating: armorRating, penalty: armorPenalty };
  system.movement = 4;
}

const track = (initial = 0) => new fields.SchemaField({
  value: new fields.NumberField({ required: true, integer: true, min: 0, initial })
});

export default class CharacterData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["AFC.Character"];

  static defineSchema() {
    return {
      alias: new fields.StringField({ blank: true }),
      age: new fields.StringField({ initial: "adult", choices: Object.keys(AGES) }),
      gender: new fields.StringField({ blank: true }),
      house: new fields.StringField({ blank: true }),
      role: new fields.StringField({ blank: true }),
      motto: new fields.StringField({ blank: true }),
      abilities: abilitiesSchema(),
      health: track(6),
      composure: track(6),
      wounds: track(),
      injuries: track(),
      frustration: track(),
      stress: track(),
      destiny: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      experience: new fields.SchemaField({
        total: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        spent: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      biography: new fields.HTMLField({ blank: true })
    };
  }

  prepareDerivedData() {
    prepareCombatValues(this, this.parent.items);
  }
}
