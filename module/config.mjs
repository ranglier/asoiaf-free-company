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

/** Royaumes de Westeros du livre de base (+ autre, pour Essos). */
export const REALMS = {
  kingsLanding: "AFC.Realm.kingsLanding",
  dragonstone: "AFC.Realm.dragonstone",
  north: "AFC.Realm.north",
  ironIslands: "AFC.Realm.ironIslands",
  riverlands: "AFC.Realm.riverlands",
  mountainsOfTheMoon: "AFC.Realm.mountainsOfTheMoon",
  westerlands: "AFC.Realm.westerlands",
  reach: "AFC.Realm.reach",
  stormlands: "AFC.Realm.stormlands",
  dorne: "AFC.Realm.dorne",
  other: "AFC.Realm.other"
};

/**
 * Tables de création de Maison (livre de base, chapitre 6, tables 6-2 à 6-4).
 * Ordre des valeurs : Défense, Influence, Terres, Loi, Population, Puissance, Richesse.
 */
const HOUSE_ORDER = ["defense", "influence", "lands", "law", "population", "power", "wealth"];
const houseValues = values => Object.fromEntries(values.map((v, i) => [HOUSE_ORDER[i], v]).filter(([, v]) => v));

/** Modificateurs de départ par royaume (table 6-2). */
export const REALM_MODIFIERS = {
  kingsLanding: houseValues([5, -5, -5, 20, 5, -5, -5]),
  dragonstone: houseValues([20, -5, -5, 5, 0, 0, -5]),
  north: houseValues([5, 10, 20, -10, -5, -5, -5]),
  ironIslands: houseValues([10, -5, -5, 0, 0, 10, 0]),
  riverlands: houseValues([-5, -5, 5, 0, 10, 0, 5]),
  mountainsOfTheMoon: houseValues([20, 10, -5, -10, -5, 0, 0]),
  westerlands: houseValues([-5, 10, -5, -5, -5, 0, 20]),
  reach: houseValues([-5, 10, 0, -5, 5, 0, 5]),
  stormlands: houseValues([5, 0, -5, 10, -5, 5, 0]),
  dorne: houseValues([0, -5, 10, -5, 0, 10, 0])
};

/** Première fondation (1d6, table 6-3) : nombre d'événements historiques (minimum 1). */
export const HOUSE_FOUNDINGS = [
  { label: "AFC.House.Founding.ancient", events: "1d6+3" },
  { label: "AFC.House.Founding.veryOld", events: "1d6+2" },
  { label: "AFC.House.Founding.old", events: "1d6+1" },
  { label: "AFC.House.Founding.established", events: "1d6" },
  { label: "AFC.House.Founding.recent", events: "1d6-1" },
  { label: "AFC.House.Founding.new", events: "1d6-2" }
];

/** Événements historiques d'une Maison (3d6, table 6-4 de l'édition française, dont l'ordre diffère de la VO). */
const houseEvent = (key, values) => ({ label: `AFC.House.Event.${key}`, mods: houseValues(values) });
export const HOUSE_EVENTS = {
  3: houseEvent("calamity", ["-2d6", "-2d6", "-2d6", "-2d6", "-2d6", "-2d6", "-2d6"]),
  4: houseEvent("defeat", ["-1d6", "-1d6", "-1d6", "", "-1d6", "-1d6", "-1d6"]),
  5: houseEvent("catastrophe", ["", "", "", "-1d6", "-1d6", "-1d6", "-1d6"]),
  6: houseEvent("madness", ["6-2d6", "6-2d6", "6-2d6", "6-2d6", "6-2d6", "6-2d6", "6-2d6"]),
  7: houseEvent("invasion", ["", "", "", "-2d6", "-1d6", "-1d6", "-1d6"]),
  8: houseEvent("scandal", ["", "-1d6", "-1d6", "", "", "-1d6", ""]),
  9: houseEvent("treachery", ["", "-1d6", "", "-1d6", "", "+1d6", ""]),
  10: houseEvent("decline", ["", "-1d6", "-1d6", "", "", "-1d6", "-1d6"]),
  11: { label: "AFC.House.Event.infrastructure", choose: 2, formula: "1d6" },
  12: houseEvent("evolution", ["", "+1d6", "+1d6", "", "", "+1d6", "+1d6"]),
  13: houseEvent("favor", ["", "+1d6", "+1d6", "+1d6", "", "+1d6", ""]),
  14: houseEvent("victory", ["+1d6", "+1d6", "", "", "", "+1d6", ""]),
  15: houseEvent("blackSheep", ["", "+1d6", "", "-1d6", "-1d6", "+1d6", ""]),
  16: houseEvent("glory", ["+1d6", "+1d6", "", "+1d6", "", "+1d6", ""]),
  17: houseEvent("conquest", ["-1d6", "+1d6", "+1d6", "-1d6", "+1d6", "", "+1d6"]),
  18: houseEvent("windfall", ["+1d6", "+2d6", "+1d6", "+1d6", "+1d6", "+2d6", "+2d6"])
};

/** Région de départ tirée au 3d6 (table 6-1). */
export const REALM_ROLLS = [
  [3, "kingsLanding"], [4, "dragonstone"], [6, "north"], [7, "ironIslands"], [9, "riverlands"],
  [11, "mountainsOfTheMoon"], [13, "westerlands"], [15, "reach"], [17, "stormlands"], [18, "dorne"]
];


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

/** Ancienneté d'une Compagnie (1d6) : nombre d'événements historiques (minimum 1). Règles maison. */
export const COMPANY_FOUNDINGS = [
  { label: "AFC.Company.Founding.antique", events: "1d6+4" },
  { label: "AFC.Company.Founding.veryOld", events: "1d6+3" },
  { label: "AFC.Company.Founding.old", events: "1d6+2" },
  { label: "AFC.Company.Founding.established", events: "1d6+1" },
  { label: "AFC.Company.Founding.recent", events: "1d6-1" },
  { label: "AFC.Company.Founding.fresh", events: "1d6-2" }
];

/** Événements historiques d'une Compagnie (3d6). Ordre des valeurs : Renommée, Organisation, Autorité, Effectif, Puissance, Richesse. */
const COMPANY_EVENT_ORDER = ["renown", "organization", "authority", "manpower", "might", "wealth"];
const companyEvent = (key, values) => ({
  label: `AFC.Company.Event.${key}`,
  mods: Object.fromEntries(values.map((v, i) => [COMPANY_EVENT_ORDER[i], v]).filter(([, v]) => v))
});
export const COMPANY_EVENTS = {
  3: companyEvent("calamity", ["-2d6", "-1d6", "-1d6", "-1d6", "-2d6", "-2d6"]),
  4: companyEvent("defeat", ["-1d6", "-1d6", "-1d6", "-1d6", "-1d6", ""]),
  5: companyEvent("catastrophe", ["", "-1d6", "-1d6", "-1d6", "-1d6", "-1d6"]),
  6: companyEvent("madness", ["6-2d6", "6-2d6", "6-2d6", "6-2d6", "6-2d6", "6-2d6"]),
  7: companyEvent("mutiny", ["", "-1d6", "-2d6", "-1d6", "-1d6", ""]),
  8: companyEvent("scandal", ["-1d6", "", "-1d6", "", "", ""]),
  9: companyEvent("treachery", ["-1d6", "", "", "-1d6", "+1d6", ""]),
  10: companyEvent("decline", ["-1d6", "", "", "-1d6", "-1d6", "-1d6"]),
  11: { label: "AFC.Company.Event.prosperity", choose: 2, formula: "1d6" },
  12: companyEvent("evolution", ["", "+1d6", "", "+1d6", "+1d6", "+1d6"]),
  13: companyEvent("favor", ["+1d6", "", "", "", "", "+2d6"]),
  14: companyEvent("victory", ["+1d6", "+1d6", "+1d6", "", "+1d6", "+1d6"]),
  15: companyEvent("cruelty", ["+1d6", "", "-1d6", "-1d6", "+1d6", ""]),
  16: companyEvent("glory", ["+1d6", "", "+1d6", "", "", "+1d6"]),
  17: companyEvent("rival", ["+1d6", "-1d6", "-1d6", "+1d6", "+1d6", "+1d6"]),
  18: companyEvent("windfall", ["+2d6", "+1d6", "+1d6", "+1d6", "+2d6", "+2d6"])
};

/** Taille des services : coût en espace, prix d'achat en Richesse, entretien mensuel en Ravitaillement. */
export const SERVICE_SIZES = {
  small: { label: "AFC.Service.Size.small", space: 1, cost: 3, supply: 5 },
  medium: { label: "AFC.Service.Size.medium", space: 2, cost: 6, supply: 10 },
  large: { label: "AFC.Service.Size.large", space: 3, cost: 9, supply: 15 }
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
