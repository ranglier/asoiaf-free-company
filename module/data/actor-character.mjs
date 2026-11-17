import { ABILITIES, AGES, DEFAULT_RANK, SPECIALTY_NAMES } from "../config.mjs";

const { fields } = foundry.data;

/** Schéma d'une compétence : rang + spécialités (dés de bonus). */
export function abilitySchema() {
  return new fields.SchemaField({
    rank: new fields.NumberField({ required: true, nullable: false, integer: true, min: 1, max: 7, initial: DEFAULT_RANK }),
    specialties: new fields.ArrayField(new fields.SchemaField({
      name: new fields.StringField({ required: true, blank: true }),
      bonus: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, max: 7, initial: 1 })
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

  // Bonus manuels (décision du 2026-11-17, comme sur la fiche Roll20) : Défense, Sang-froid, Santé.
  const bonus = system.bonuses ?? { defense: 0, intrigue: 0, composure: 0, health: 0 };
  system.health.max = Math.max(0, a.endurance.rank * 3 + bonus.health);
  system.composure.max = Math.max(0, a.will.rank * 3 + bonus.composure);
  system.wounds.max = a.endurance.rank;
  system.injuries.max = a.endurance.rank;
  // Frustration (intrigue) : jusqu'au rang de Volonté ; Fatigue : jusqu'au rang d'Endurance.
  if (system.frustration) system.frustration.max = a.will.rank;
  if (system.fatigue) system.fatigue.max = a.endurance.rank;
  system.defense = {
    combat: a.agility.rank + a.athletics.rank + a.awareness.rank + defenseBonus - armorPenalty + bonus.defense,
    intrigue: a.awareness.rank + a.cunning.rank + a.status.rank + bonus.intrigue
  };
  // Valeur passive : 4 x le rang, + 1 par dé de bonus de la spécialité qui s'applique (livre VO p. 51).
  // Difficulté d'un test fait contre quelqu'un qui ne lance pas (Discrétion contre Vigilance).
  const notice = specialtyBonus(a.awareness, SPECIALTY_NAMES.notice);
  system.passive = { awareness: a.awareness.rank * 4 + notice, awarenessBase: a.awareness.rank * 4, awarenessBonus: notice };
  system.armor = { rating: armorRating, penalty: armorPenalty, bulk };

  // Déplacement : 4 m (3 m si Athlétisme 1), +1 m par 2B en Course, -1 m par 2 points d'Encombrement.
  const run = specialtyBonus(a.athletics, SPECIALTY_NAMES.run);
  const base = (a.athletics.rank <= 1 && run < 1 ? 3 : 4) + Math.floor(run / 2);
  const move = Math.max(1, base - Math.floor(bulk / 2));
  system.movement = { value: move, sprint: Math.max(4, move * 4 - bulk) };

  // Malus appliqués automatiquement aux tests : -1D par blessure, -1 par lésion, -1 par point de Fatigue.
  system.penalties = { dice: system.wounds.value, modifier: system.injuries.value + (system.fatigue?.value ?? 0) };
  // Argent : tout ramené en pennies (1 cerf = 56 pennies, 1 dragon = 210 cerfs, repères de la fiche de la table).
  if (system.money) system.money.inPennies = system.money.copper + system.money.silver * COIN.stag + system.money.gold * COIN.stag * COIN.dragon;
}

/** Monnaie : un cerf d'argent vaut 56 pennies de cuivre, un dragon d'or 210 cerfs. */
export const COIN = { stag: 56, dragon: 210 };

/** Listes du personnage (onglet Personnage), comme sur la fiche Roll20. */
export const PERSONAL_LISTS = ["virtues", "vices", "goals", "motivations", "quirks", "distinctive", "servants", "allies", "enemies", "oaths"];

const int = (initial = 0, opts = {}) => new fields.NumberField({ required: true, nullable: false, integer: true, initial, ...opts });
const rows = shape => new fields.ArrayField(new fields.SchemaField(shape));

/** Champs communs aux PJ et PNJ ajoutés le 2026-11-17 : pistes d'intrigue et de fatigue, bonus, disposition, possessions, listes. */
export function personalSchema() {
  return {
    frustration: new fields.SchemaField({ value: int(0, { min: 0 }) }),
    fatigue: new fields.SchemaField({ value: int(0, { min: 0 }) }),
    bonuses: new fields.SchemaField({ defense: int(), intrigue: int(), composure: int(), health: int() }),
    disposition: new fields.SchemaField({ rating: int(), persuasion: int(), deception: int() }),
    money: new fields.SchemaField({ copper: int(0, { min: 0 }), silver: int(0, { min: 0 }), gold: int(0, { min: 0 }) }),
    gear: rows({ name: new fields.StringField({ blank: true }), value: new fields.StringField({ blank: true }) }),
    mounts: rows({ name: new fields.StringField({ blank: true }), value: new fields.StringField({ blank: true }) }),
    lists: new fields.SchemaField(Object.fromEntries(PERSONAL_LISTS.map(k => [k, rows({ text: new fields.StringField({ blank: true }) })])))
  };
}

/** Journal de dépenses (expérience, Gloire) : libellé et montant. */
const spendLog = () => rows({ label: new fields.StringField({ blank: true }), amount: int(0) });

const track = (initial = 0) => new fields.SchemaField({
  value: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial })
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
      // Destinée : max est la base (points de départ) ; bonus et points investis (sangs, avantages) la modifient.
      destiny: new fields.SchemaField({
        value: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
        max: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
        bonus: int()
      }),
      experience: new fields.SchemaField({
        total: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
        spent: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
        log: spendLog()
      }),
      glory: new fields.SchemaField({ total: int(0, { min: 0 }), spent: int(0, { min: 0 }), log: spendLog() }),
      ...personalSchema(),
      biography: new fields.HTMLField({ blank: true })
    };
  }

  prepareDerivedData() {
    prepareCombatValues(this, this.parent.items);
    // Destinée investie (décision du 2026-11-17) : chaque sang, avantage ou désavantage porte ses points (positif :
    // investis, négatif : rendus) ; la fiche fait la somme.
    const invested = this.parent.items.filter(i => ["quality", "blood"].includes(i.type)).reduce((n, i) => n + (i.system.destiny ?? 0), 0);
    this.destiny.invested = invested;
    this.destiny.total = Math.max(0, this.destiny.max + this.destiny.bonus - invested);
    // Expérience et Gloire : dépenses hors journal + journal.
    for (const key of ["experience", "glory"]) {
      const t = this[key];
      t.spentTotal = t.spent + t.log.reduce((n, l) => n + (l.amount ?? 0), 0);
      t.available = t.total - t.spentTotal;
    }
  }
}
