import { abilitiesSchema, prepareCombatValues } from "./actor-character.mjs";

const { fields } = foundry.data;

/** PNJ allégé : compétences et santé, avec un lien vers la fiche source (Maze). */
export default class NpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      role: new fields.StringField({ blank: true }),
      abilities: abilitiesSchema(),
      health: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 6 })
      }),
      composure: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 6 })
      }),
      wounds: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      injuries: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      sourceUrl: new fields.StringField({ blank: true }),
      biography: new fields.HTMLField({ blank: true })
    };
  }

  prepareDerivedData() {
    prepareCombatValues(this, this.parent.items);
  }
}
