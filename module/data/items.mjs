import { ABILITIES, SERVICE_SIZES, UNIT_CLASSES, UNIT_TRAININGS } from "../config.mjs";

const { fields } = foundry.data;

const description = () => new fields.HTMLField({ blank: true });
const int = (initial = 0, opts = {}) => new fields.NumberField({ required: true, integer: true, initial, ...opts });

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ability: new fields.StringField({ initial: "fighting", choices: Object.keys(ABILITIES) }),
      specialty: new fields.StringField({ blank: true }),
      damageAbility: new fields.StringField({ initial: "athletics", choices: Object.keys(ABILITIES) }),
      damageMod: int(0),
      defenseBonus: int(0),
      qualities: new fields.StringField({ blank: true }),
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
      description: description()
    };
  }
}

/** Unité militaire d'une Compagnie. */
export class UnitData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      training: new fields.StringField({ initial: "green", choices: Object.keys(UNIT_TRAININGS) }),
      classes: new fields.StringField({ initial: "I" }),
      mightCost: int(1, { min: 0 }),
      disciplineMod: int(0),
      keyAbilities: new fields.StringField({ blank: true }),
      men: int(100, { min: 0 }),
      experience: int(0, { min: 0 }),
      description: description()
    };
  }

  prepareDerivedData() {
    const t = UNIT_TRAININGS[this.training];
    this.manpowerCost = t?.manpower ?? 0;
    this.discipline = (t?.discipline ?? 0) + this.disciplineMod;
    this.classList = this.classes.split(/[ ,]+/).filter(c => c in UNIT_CLASSES);
  }
}
