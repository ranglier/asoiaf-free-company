import { ABILITIES, ATTACK_ABILITIES, HOLDING_RESOURCES, SERVICE_SIZES, UNIT_CLASSES, UNIT_TRAININGS } from "../config.mjs";

const { fields } = foundry.data;

const description = () => new fields.HTMLField({ blank: true });
const int = (initial = 0, opts = {}) => new fields.NumberField({ required: true, integer: true, initial, ...opts });

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ability: new fields.StringField({ initial: "fighting", choices: ATTACK_ABILITIES }),
      specialty: new fields.StringField({ blank: true }),
      training: int(0, { min: 0 }),
      damageAbility: new fields.StringField({ initial: "athletics", choices: Object.keys(ABILITIES) }),
      damageMod: int(0),
      defenseBonus: int(0),
      // Qualités calculées automatiquement.
      piercing: int(0, { min: 0 }),
      powerful: new fields.BooleanField({ initial: false }),
      versatile: new fields.BooleanField({ initial: false }),
      twoHanded: new fields.BooleanField({ initial: false }),
      bulk: int(0, { min: 0 }),
      // Autres qualités, affichées dans la carte d'attaque.
      qualities: new fields.StringField({ blank: true }),
      grip: new fields.StringField({ initial: "one", choices: ["one", "two"] }),
      equipped: new fields.BooleanField({ initial: false }),
      description: description()
    };
  }
}

export class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rating: int(0, { min: 0 }),
      penalty: int(0, { min: 0 }),
      bulk: int(0, { min: 0 }),
      equipped: new fields.BooleanField({ initial: false }),
      description: description()
    };
  }
}

/** Avantage ou défaut. */
export class QualityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      kind: new fields.StringField({ initial: "benefit", choices: ["benefit", "drawback"] }),
      requirements: new fields.StringField({ blank: true }),
      description: description()
    };
  }
}

/** Sang (origine du personnage, règles maison). */
export class BloodData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      requirements: new fields.StringField({ blank: true }),
      summary: new fields.StringField({ blank: true }),
      description: description()
    };
  }
}

/** Service de gestion et patrimoine d'une Compagnie. */
export class ServiceData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      size: new fields.StringField({ initial: "small", choices: Object.keys(SERVICE_SIZES) }),
      category: new fields.StringField({ blank: true }),
      effect: new fields.StringField({ blank: true }),
      // Bonus permanent à l'Organisation effective (n'agrandit pas l'espace des services).
      organization: int(0),
      description: description()
    };
  }
}

/** Possession d'une Maison : investissement dans une ressource (château, héritier, domaine, vassal, mestre...). */
export class HoldingData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      resource: new fields.StringField({ initial: "wealth", choices: HOLDING_RESOURCES }),
      cost: int(0, { min: 0 }),
      effect: new fields.StringField({ blank: true }),
      requirement: new fields.StringField({ blank: true }),
      buildTime: new fields.StringField({ blank: true }),
      building: new fields.BooleanField({ initial: false }),
      description: description()
    };
  }
}

/** Unité militaire d'une Compagnie ou d'une Maison. */
export class UnitData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Type du catalogue (traits de bataille) ; vide pour les anciennes unités (reconnu au nom).
      unitType: new fields.StringField({ blank: true }),
      training: new fields.StringField({ initial: "green", choices: Object.keys(UNIT_TRAININGS) }),
      classes: new fields.StringField({ initial: "I" }),
      mightCost: int(1, { min: 0 }),
      disciplineMod: int(0),
      keyAbilities: new fields.StringField({ blank: true }),
      // Hommes par unité (100, 20 cavaliers, 5 navires) et nombre d'unités du bataillon.
      men: int(100, { min: 0 }),
      count: int(1, { min: 1 }),
      experience: int(0, { min: 0 }),
      description: description()
    };
  }

  prepareDerivedData() {
    const t = UNIT_TRAININGS[this.training];
    // Coûts par unité, puis totaux du bataillon (coût × nombre d'unités).
    this.manpowerCost = t?.manpower ?? 0;
    this.totalMen = this.men * this.count;
    this.totalManpower = this.manpowerCost * this.count;
    this.totalMight = this.mightCost * this.count;
    // La discipline ne descend jamais sous Élémentaire (0).
    this.discipline = Math.max(0, (t?.discipline ?? 0) + this.disciplineMod);
    this.classList = this.classes.split(/[ ,]+/).filter(c => c in UNIT_CLASSES);
  }
}
