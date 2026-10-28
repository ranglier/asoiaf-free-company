import { HOLDING_RESOURCES, HOUSE_RESOURCES, REALMS } from "../config.mjs";

/** Anciens rôles du foyer (liste fermée), convertis en texte libre traduit à la lecture. */
const LEGACY_ROLES = ["lord", "lady", "heir", "maester", "septon", "masterAtArms", "steward", "castellan", "knight", "other"];

const { fields } = foundry.data;

const resource = () => new fields.SchemaField({
  value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
});

/** Maison noble (règles d'origine). */
export default class HouseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      realm: new fields.StringField({ blank: true, choices: Object.keys(REALMS) }),
      seat: new fields.StringField({ blank: true }),
      liege: new fields.StringField({ blank: true }),
      head: new fields.StringField({ blank: true }),
      motto: new fields.StringField({ blank: true }),
      arms: new fields.StringField({ blank: true }),
      founding: new fields.StringField({ blank: true }),
      resources: new fields.SchemaField(Object.fromEntries(HOUSE_RESOURCES.map(k => [k, resource()]))),
      glory: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      // Événements historiques tirés à la création (leurs effets sont déjà reportés dans les ressources).
      events: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ blank: true }),
        note: new fields.StringField({ blank: true })
      })),
      // Foyer : rôle (texte libre), nom, et lien éventuel vers un acteur du monde.
      household: new fields.ArrayField(new fields.SchemaField({
        role: new fields.StringField({ blank: true }),
        name: new fields.StringField({ blank: true }),
        actor: new fields.StringField({ blank: true })
      })),
      history: new fields.HTMLField({ blank: true })
    };
  }

  /** Ancien champ royaume en texte libre : on le garde s'il correspond à une clé, sinon « autre ». */
  static migrateData(source) {
    if (source.realm && !(source.realm in REALMS)) source.realm = "other";
    // Rôles du foyer : ancienne liste fermée -> texte libre traduit.
    for (const m of source.household ?? []) {
      if (LEGACY_ROLES.includes(m.role)) m.role = game.i18n?.localize(`AFC.Household.${m.role}`) ?? m.role;
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    // Points investis : possessions (par ressource) et unités (en Puissance).
    const invested = Object.fromEntries(HOLDING_RESOURCES.map(k => [k, 0]));
    for (const item of this.parent.items) {
      if (item.type === "holding" && item.system.resource in invested) invested[item.system.resource] += item.system.cost;
      if (item.type === "unit") invested.power += item.system.mightCost;
    }
    for (const key of HOUSE_RESOURCES) {
      const r = this.resources[key];
      r.invested = invested[key] ?? 0;
      r.available = r.value - r.invested;
    }
  }
}
