import { HOUSE_RESOURCES } from "../config.mjs";

const { fields } = foundry.data;

const resource = () => new fields.SchemaField({
  value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
});

/** Maison noble (règles d'origine). */
export default class HouseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      realm: new fields.StringField({ blank: true }),
      seat: new fields.StringField({ blank: true }),
      liege: new fields.StringField({ blank: true }),
      head: new fields.StringField({ blank: true }),
      motto: new fields.StringField({ blank: true }),
      arms: new fields.StringField({ blank: true }),
      founding: new fields.StringField({ blank: true }),
      resources: new fields.SchemaField(Object.fromEntries(HOUSE_RESOURCES.map(k => [k, resource()]))),
      history: new fields.HTMLField({ blank: true })
    };
  }
}
