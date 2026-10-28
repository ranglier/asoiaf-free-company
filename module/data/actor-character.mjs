import { ABILITIES, AGES, DEFAULT_RANK, SPECIALTY_NAMES } from "../config.mjs";

const { fields } = foundry.data;

/** Schéma d'une compétence : rang + spécialités (dés de bonus). */
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

/** Dés bonus d'une spécialité cherchée par nom (insensible à la casse), 0 si absente. */
export function specialtyBonus(ability, names) {
  const wanted = [names].flat().map(n => n.trim().toLowerCase());
  return ability?.specialties.find(s => wanted.includes(s.name.trim().toLowerCase()))?.bonus ?? 0;
}

/** Calcule les valeurs dérivées communes aux PJ et PNJ. */
export function prepareCombatValues(system, items) {
  const a = system.abilities;
  const equipped = items.filter(i => ["armor", "weapon"].includes(i.type) && i.system.equipped);
  const armor = equipped.filter(i => i.type === "armor");
  const armorRating = armor.reduce((s, i) => s + i.system.rating, 0);
  const armorPenalty = armor.reduce((s, i) => s + i.system.penalty, 0);
  const defenseBonus = equipped.filter(i => i.type === "weapon").reduce((s, i) => s + (i.system.defenseBonus ?? 0), 0);
  const bulk = equipped.reduce((s, i) => s + (i.system.bulk ?? 0), 0);

  system.health.max = a.endurance.rank * 3;
  system.composure.max = a.will.rank * 3;
  system.wounds.max = a.endurance.rank;
  system.injuries.max = a.endurance.rank;
  system.defense = {
    combat: a.agility.rank + a.athletics.rank + a.awareness.rank + defenseBonus - armorPenalty,
    intrigue: a.awareness.rank + a.cunning.rank + a.status.rank
  };
  system.armor = { rating: armorRating, penalty: armorPenalty, bulk };

  // Déplacement : 4 m (3 m si Athlétisme 1), +1 m par 2B en Course, -1 m par 2 points d'Encombrement.
  const run = specialtyBonus(a.athletics, SPECIALTY_NAMES.run);
  const base = (a.athletics.rank <= 1 && run < 1 ? 3 : 4) + Math.floor(run / 2);
  const move = Math.max(1, base - Math.floor(bulk / 2));
  system.movement = { value: move, sprint: Math.max(4, move * 4 - bulk) };

  // Malus appliqués automatiquement aux tests : -1D par blessure, -1 par lésion.
  system.penalties = { dice: system.wounds.value, modifier: system.injuries.value };
}

const track = (initial = 0) => new fields.SchemaField({
  value: new fields.NumberField({ required: true, integer: true, min: 0, initial })
});

export default class CharacterData extends foundry.abstract.TypeDataModel {
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
