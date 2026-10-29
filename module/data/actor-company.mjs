import { COHESION_TIERS, COMPANY_ORIGINS, COMPANY_RESOURCES, SERVICE_SIZES } from "../config.mjs";

/** Personnes représentées par un point d'Effectif de réserve (non-combattants, recrues, suiveurs). */
const PEOPLE_PER_RESERVE_POINT = 40;

const { fields } = foundry.data;

const resource = () => new fields.SchemaField({
  value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
});

/** Compagnie de mercenaires (règles maison), modifiable par les joueurs. */
export default class CompanyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      origin: new fields.StringField({ blank: true, choices: Object.keys(COMPANY_ORIGINS) }),
      founding: new fields.StringField({ blank: true }),
      motto: new fields.StringField({ blank: true }),
      leader: new fields.ForeignDocumentField(foundry.documents.BaseActor, { idOnly: true }),
      resources: new fields.SchemaField(Object.fromEntries(COMPANY_RESOURCES.map(k => [k, resource()]))),
      supply: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      cohesion: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      // Membres : rôle (texte libre), nom, et lien éventuel vers un acteur du monde.
      members: new fields.ArrayField(new fields.SchemaField({
        role: new fields.StringField({ blank: true }),
        name: new fields.StringField({ blank: true }),
        actor: new fields.StringField({ blank: true })
      })),
      // Événements historiques tirés à la création (leurs effets sont déjà reportés dans les ressources).
      events: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ blank: true }),
        note: new fields.StringField({ blank: true })
      })),
      history: new fields.HTMLField({ blank: true })
    };
  }

  prepareDerivedData() {
    const r = this.resources;
    const services = this.parent.items.filter(i => i.type === "service");
    const leader = this.leader ? game.actors?.get(this.leader) : null;
    const leaderCunning = leader?.system.abilities?.cunning?.rank ?? 0;
    // Organisation de base (saisie) : donne l'espace des services. Organisation effective : base + bonus des services.
    const orgBonus = services.reduce((s, i) => s + (i.system.organization ?? 0), 0);
    this.organization = { base: r.organization.value, bonus: orgBonus, effective: r.organization.value + orgBonus };

    this.services = {
      count: services.length,
      spaceUsed: services.reduce((s, i) => s + (SERVICE_SIZES[i.system.size]?.space ?? 0), 0),
      spaceMax: Math.floor(r.organization.value / 10) * 3 + leaderCunning,
      supply: services.reduce((s, i) => s + (SERVICE_SIZES[i.system.size]?.supply ?? 0), 0)
    };

    // Effectif et Puissance investis dans les unités ; le reste de l'Effectif forme la réserve.
    const units = this.parent.items.filter(i => i.type === "unit");
    r.manpower.invested = units.reduce((s, i) => s + i.system.totalManpower, 0);
    r.manpower.available = r.manpower.value - r.manpower.invested;
    r.might.invested = units.reduce((s, i) => s + i.system.totalMight, 0);
    r.might.available = r.might.value - r.might.invested;

    // Personnes (indicatif) : hommes des unités + 40 personnes par point d'Effectif de réserve.
    const inArms = units.reduce((s, i) => s + i.system.totalMen, 0);
    const reserve = Math.max(0, r.manpower.available) * PEOPLE_PER_RESERVE_POINT;
    this.people = { inArms, reserve, total: inArms + reserve };

    // Entretien mensuel du ravitaillement : Effectif / 2 + entretien des services − 5 par tranche de 10 d'Organisation effective.
    this.monthlySupply = Math.max(0, Math.floor(r.manpower.value / 2) + this.services.supply - Math.floor(this.organization.effective / 10) * 5);

    const cohesionMax = r.authority.value * 3;
    const pct = cohesionMax ? Math.round((this.cohesion / cohesionMax) * 100) : 0;
    const tier = COHESION_TIERS.find(t => pct >= t.min) ?? COHESION_TIERS.at(-1);
    this.cohesionState = { max: cohesionMax, pct, discipline: tier.discipline, label: tier.label };
  }
}
