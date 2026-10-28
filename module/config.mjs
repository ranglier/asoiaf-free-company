/**
 * Constantes du système. Les libellés sont des clés de traduction (lang/*.json).
 */
export const SYSTEM_ID = "asoiaf-free-company";

/** Compétences, dans l'ordre d'affichage. `abbr` reprend les abréviations des règles maison. */
export const ABILITIES = {
  agility: { label: "AFC.Ability.agility", abbr: "AGI" },
  animalHandling: { label: "AFC.Ability.animalHandling", abbr: "DRESS" },
  athletics: { label: "AFC.Ability.athletics", abbr: "ATH" },
  awareness: { label: "AFC.Ability.awareness", abbr: "VIG" },
  cunning: { label: "AFC.Ability.cunning", abbr: "ING" },
  deception: { label: "AFC.Ability.deception", abbr: "DUP" },
  endurance: { label: "AFC.Ability.endurance", abbr: "ENDU" },
  fighting: { label: "AFC.Ability.fighting", abbr: "CAC" },
  healing: { label: "AFC.Ability.healing", abbr: "SOIN" },
  knowledge: { label: "AFC.Ability.knowledge", abbr: "CONN" },
  language: { label: "AFC.Ability.language", abbr: "LANG" },
  marksmanship: { label: "AFC.Ability.marksmanship", abbr: "TIR" },
  persuasion: { label: "AFC.Ability.persuasion", abbr: "PERS" },
  status: { label: "AFC.Ability.status", abbr: "STAT" },
  stealth: { label: "AFC.Ability.stealth", abbr: "DISCR" },
  survival: { label: "AFC.Ability.survival", abbr: "SURV" },
  thievery: { label: "AFC.Ability.thievery", abbr: "LARC" },
  warfare: { label: "AFC.Ability.warfare", abbr: "GUER" },
  will: { label: "AFC.Ability.will", abbr: "VOL" }
};

/** Groupes thématiques des compétences sur les fiches (regroupement maison, pas celui du livre). */
export const ABILITY_GROUPS = {
  combat: { label: "AFC.AbilityGroup.combat", abilities: ["agility", "athletics", "fighting", "endurance", "marksmanship", "warfare"] },
  society: { label: "AFC.AbilityGroup.society", abilities: ["deception", "persuasion", "status", "will"] },
  knowledge: { label: "AFC.AbilityGroup.knowledge", abilities: ["knowledge", "cunning", "language", "healing"] },
  terrain: { label: "AFC.AbilityGroup.terrain", abilities: ["stealth", "animalHandling", "thievery", "survival", "awareness"] }
};

/** Rang par défaut d'une compétence. */
export const DEFAULT_RANK = 2;

/** Compétences utilisables pour attaquer. */
export const ATTACK_ABILITIES = ["fighting", "marksmanship"];

/** Spécialités reconnues par nom (fr et en) pour les calculs automatiques. */
export const SPECIALTY_NAMES = {
  strength: ["force", "strength"],
  run: ["course", "run"]
};

/** Options du dialogue d'attaque : dés de test, dés bonus, dégâts de base. */
export const ATTACK_OPTIONS = {
  aim: { label: "AFC.Attack.Option.aim", bonus: 1 },
  charge: { label: "AFC.Attack.Option.charge", dice: -1, damage: 2 },
  cautious: { label: "AFC.Attack.Option.cautious", dice: -1 },
  reckless: { label: "AFC.Attack.Option.reckless", dice: 1 },
  surprise: { label: "AFC.Attack.Option.surprise", dice: 1 },
  helpless: { label: "AFC.Attack.Option.helpless", dice: 1 }
};

/** Couverture de la cible : bonus à sa Défense de combat. */
export const COVER = { 0: "AFC.Attack.Cover.none", 5: "AFC.Attack.Cover.partial", 10: "AFC.Attack.Cover.full" };

/** Visibilité : dés de malus. */
export const VISIBILITY = { 0: "AFC.Attack.Visibility.clear", 1: "AFC.Attack.Visibility.dim", 2: "AFC.Attack.Visibility.dark" };

/** Difficultés des tests (valeur cible). */
export const DIFFICULTIES = {
  0: "AFC.Difficulty.automatic",
  3: "AFC.Difficulty.easy",
  6: "AFC.Difficulty.routine",
  9: "AFC.Difficulty.challenging",
  12: "AFC.Difficulty.formidable",
  15: "AFC.Difficulty.hard",
  18: "AFC.Difficulty.veryHard",
  21: "AFC.Difficulty.heroic"
};

/** Âges autorisés à la création (règles maison). */
export const AGES = {
  youth: "AFC.Age.youth",
  adult: "AFC.Age.adult",
  middleAge: "AFC.Age.middleAge"
};

/** Ressources d'une Maison (règles d'origine). */
export const HOUSE_RESOURCES = ["defense", "influence", "lands", "law", "population", "power", "wealth"];

/** Ressources dans lesquelles on investit des possessions (Loi et Population n'en ont pas). */
export const HOLDING_RESOURCES = ["defense", "influence", "lands", "power", "wealth"];

/** Royaumes de Westeros (+ autre, pour Essos). */
export const REALMS = {
  crownlands: "AFC.Realm.crownlands",
  dorne: "AFC.Realm.dorne",
  ironIslands: "AFC.Realm.ironIslands",
  north: "AFC.Realm.north",
  riverlands: "AFC.Realm.riverlands",
  vale: "AFC.Realm.vale",
  reach: "AFC.Realm.reach",
  stormlands: "AFC.Realm.stormlands",
  westerlands: "AFC.Realm.westerlands",
  other: "AFC.Realm.other"
};


/** Ressources d'une Compagnie (règles maison). */
export const COMPANY_RESOURCES = ["renown", "authority", "manpower", "might", "wealth", "organization"];

/** Origines des fondateurs d'une Compagnie et leurs modificateurs. */
export const COMPANY_ORIGINS = {
  merchants: { label: "AFC.Company.Origin.merchants", mods: { renown: 0, organization: 10, authority: -5, manpower: 0, might: -5, wealth: 10 } },
  nobles: { label: "AFC.Company.Origin.nobles", mods: { renown: 10, organization: -5, authority: 0, manpower: -5, might: 0, wealth: 10 } },
  commoners: { label: "AFC.Company.Origin.commoners", mods: { renown: -5, organization: 5, authority: 0, manpower: 20, might: 0, wealth: -10 } },
  outlaws: { label: "AFC.Company.Origin.outlaws", mods: { renown: -10, organization: 0, authority: -5, manpower: 10, might: 10, wealth: 5 } },
  soldiers: { label: "AFC.Company.Origin.soldiers", mods: { renown: 0, organization: 5, authority: 10, manpower: 0, might: 15, wealth: -20 } },
  sailors: { label: "AFC.Company.Origin.sailors", mods: { renown: 10, organization: 10, authority: 0, manpower: -5, might: 0, wealth: -5 } },
  zealots: { label: "AFC.Company.Origin.zealots", mods: { renown: 5, organization: 5, authority: 0, manpower: 20, might: 0, wealth: -20 } }
};

/** Taille des services : coût en espace, prix et entretien en Richesse. */
export const SERVICE_SIZES = {
  small: { label: "AFC.Service.Size.small", space: 1, cost: 3, upkeep: 1 },
  medium: { label: "AFC.Service.Size.medium", space: 2, cost: 6, upkeep: 2 },
  large: { label: "AFC.Service.Size.large", space: 3, cost: 9, upkeep: 3 }
};

/** Entraînement des unités : coût en Effectif, discipline (difficulté) et expérience. */
export const UNIT_TRAININGS = {
  support: { label: "AFC.Unit.Training.support", manpower: 1, discipline: 12, experience: 0 },
  green: { label: "AFC.Unit.Training.green", manpower: 1, discipline: 9, experience: 20 },
  trained: { label: "AFC.Unit.Training.trained", manpower: 2, discipline: 6, experience: 60 },
  veteran: { label: "AFC.Unit.Training.veteran", manpower: 3, discipline: 3, experience: 100 },
  elite: { label: "AFC.Unit.Training.elite", manpower: 4, discipline: 0, experience: 140 }
};

/** Classes d'unités (tables d'avantages). */
export const UNIT_CLASSES = {
  I: "AFC.Unit.Class.I",
  P: "AFC.Unit.Class.P",
  A: "AFC.Unit.Class.A",
  C: "AFC.Unit.Class.C",
  M: "AFC.Unit.Class.M",
  S: "AFC.Unit.Class.S"
};

/** Paliers de Cohésion (pourcentage minimal -> bonus de discipline et clé de description). */
export const COHESION_TIERS = [
  { min: 85, discipline: 2, label: "AFC.Company.Cohesion.excellent" },
  { min: 60, discipline: 1, label: "AFC.Company.Cohesion.good" },
  { min: 50, discipline: 0, label: "AFC.Company.Cohesion.minor" },
  { min: 25, discipline: 0, label: "AFC.Company.Cohesion.logistics" },
  { min: 0, discipline: 0, label: "AFC.Company.Cohesion.critical" }
];
