/**
 * Catalogue du patrimoine d'une Maison (livre de base, chapitre 6, étape quatre).
 * Libellés et effets : clés de traduction `AFC.Catalog.<clé>.name` / `.effect`.
 */

/** Possessions toutes faites, par ressource investie. */
export const HOLDINGS = [
  // Défense : bonus de Défense des unités qui défendent la fortification.
  { key: "superiorCastle", resource: "defense", cost: 50, buildTime: "144 + 10d6" },
  { key: "castle", resource: "defense", cost: 40, buildTime: "96 + 10d6" },
  { key: "smallCastle", resource: "defense", cost: 30, buildTime: "72 + 10d6" },
  { key: "hall", resource: "defense", cost: 20, buildTime: "60 + 10d6" },
  { key: "tower", resource: "defense", cost: 10, buildTime: "36 + 10d6" },
  // Influence : héritiers (Statut maximal de la Maison − 1, − 2, − 3).
  { key: "heirFirst", resource: "influence", cost: 20 },
  { key: "heirSecond", resource: "influence", cost: 10 },
  { key: "heirOther", resource: "influence", cost: 5 },
  // Puissance : maisons vassales (20 la première, 10 la deuxième, 5 les suivantes).
  { key: "bannerFirst", resource: "power", cost: 20 },
  { key: "bannerSecond", resource: "power", cost: 10 },
  { key: "bannerOther", resource: "power", cost: 5 },
  // Richesse.
  { key: "artisan", resource: "wealth", cost: 10, buildTime: "2d6" },
  { key: "godswood", resource: "wealth", cost: 5, buildTime: "24 + 2d6" },
  { key: "guild", resource: "wealth", cost: 15, buildTime: "2d6" },
  { key: "market", resource: "wealth", cost: 10, buildTime: "1d6" },
  { key: "maester", resource: "wealth", cost: 10, buildTime: "1d6" },
  { key: "mine", resource: "wealth", cost: 10, buildTime: "24 + 2d6" },
  { key: "port", resource: "wealth", cost: 10, buildTime: "3d6" },
  { key: "sept", resource: "wealth", cost: 15, buildTime: "12 + 2d6" }
];

/** Terrains d'un domaine (table 6-6). */
export const TERRAINS = {
  hills: 7,
  marsh: 3,
  mountains: 9,
  plains: 5
};

/** Traits d'un domaine (table 6-7). Les localités s'excluent entre elles. */
export const FEATURES = {
  lightWoods: 3,
  denseWoods: 5,
  stream: 1,
  river: 3,
  pond: 5,
  lake: 7,
  island: 10,
  coast: 3,
  grassland: 1,
  road: 5,
  ruin: 3
};
export const COMMUNITIES = {
  hamlet: 10,
  smallTown: 20,
  town: 30,
  largeTown: 40,
  city: 50
};

/** Unités d'une Maison : coût en Puissance de l'entraînement (la discipline vient de UNIT_TRAININGS). */
export const HOUSE_UNIT_TRAINING_COSTS = { green: 1, trained: 3, veteran: 5, elite: 7 };

/** Types d'unités (table 6-8) : coût en Puissance, modificateur de discipline, compétences clés. */
export const HOUSE_UNIT_TYPES = {
  archers: { cost: 3, discipline: 3, abilities: ["agility", "marksmanship", "awareness"], classes: "A" },
  cavalry: { cost: 5, discipline: -3, abilities: ["agility", "fighting", "animalHandling"], classes: "C", men: 20 },
  criminals: { cost: 1, discipline: 6, abilities: ["fighting", "stealth", "endurance"], classes: "I" },
  crusaders: { cost: 4, discipline: 0, abilities: ["athletics", "fighting", "endurance"], classes: "I" },
  scouts: { cost: 2, discipline: 3, abilities: ["endurance", "stealth", "awareness"], classes: "I" },
  personalGuard: { cost: 6, discipline: -6, abilities: ["athletics", "fighting", "endurance"], classes: "I" },
  garrison: { cost: 2, discipline: 0, abilities: ["fighting", "endurance", "awareness"], classes: "I" },
  guerillas: { cost: 2, discipline: 3, abilities: ["athletics", "stealth", "marksmanship"], classes: "I" },
  infantry: { cost: 4, discipline: 0, abilities: ["athletics", "fighting", "endurance"], classes: "I" },
  engineers: { cost: 2, discipline: 3, abilities: ["warfare", "fighting", "endurance"], classes: "S" },
  sailors: { cost: 4, discipline: 0, abilities: ["agility", "fighting", "awareness"], classes: "M" },
  mercenaries: { cost: 1, discipline: 3, abilities: ["athletics", "fighting", "endurance"], classes: "I" },
  warships: { cost: 7, discipline: 0, abilities: ["fighting", "marksmanship", "awareness"], classes: "M", men: 5 },
  peasants: { cost: 0, discipline: 6, abilities: ["animalHandling", "survival", "awareness"], classes: "I" },
  raiders: { cost: 3, discipline: 3, abilities: ["agility", "fighting", "endurance"], classes: "I" },
  support: { cost: 2, discipline: 3, abilities: ["animalHandling", "endurance", "healing"], classes: "S" },
  special: { cost: 4, discipline: 0, abilities: [], classes: "I" }
};

/** Mercenaires : Richesse retirée par unité selon l'entraînement. */
export const MERCENARY_WEALTH = { green: 1, trained: 3, veteran: 6, elite: 9 };

/* ---------- Compagnie (règles maison) ---------- */

/**
 * Services de gestion et patrimoine. Une Compagnie ne prend qu'un service par catégorie,
 * sauf les diplomates. Libellés et effets : `AFC.CompanyCatalog.<clé>.name` / `.effect`.
 */
export const COMPANY_SERVICES = [
  { key: "blacksmith", size: "small", category: "forge" },
  { key: "masterSmith", size: "medium", category: "forge" },
  { key: "armorersGuild", size: "large", category: "forge" },
  { key: "carpenter", size: "small", category: "carpentry", organization: 2 },
  { key: "carpenterCrew", size: "medium", category: "carpentry", organization: 3 },
  { key: "woodworkersGuild", size: "large", category: "carpentry", organization: 5 },
  { key: "horseMasters", size: "large", category: "horses" },
  { key: "healers", size: "small", category: "healing" },
  { key: "fieldHospital", size: "large", category: "healing" },
  { key: "foreman", size: "small", category: "staff", organization: 1 },
  { key: "aidesDeCamp", size: "medium", category: "staff", organization: 2 },
  { key: "stewards", size: "large", category: "staff", organization: 3 },
  { key: "sutlers", size: "medium", category: "kitchen" },
  { key: "fieldCook", size: "large", category: "kitchen", organization: 2 },
  { key: "provost", size: "medium", category: "discipline" },
  { key: "disciplineOfficers", size: "large", category: "discipline" },
  { key: "drillSergeants", size: "medium", category: "training" },
  { key: "mastersAtArms", size: "large", category: "training" },
  { key: "priest", size: "small", category: "faith" },
  { key: "chaplains", size: "medium", category: "faith" },
  { key: "congregation", size: "large", category: "faith" },
  { key: "negotiator", size: "small", category: "diplomacy" },
  { key: "spokesman", size: "medium", category: "diplomacy" },
  { key: "logisticsSmall", size: "small", category: "logistics" },
  { key: "logisticsMedium", size: "medium", category: "logistics" },
  { key: "logisticsLarge", size: "large", category: "logistics" },
  { key: "maps", size: "small", category: "navigation" },
  { key: "guide", size: "medium", category: "navigation" }
];

/** Catégories sans limite d'un service. */
export const UNLIMITED_SERVICE_CATEGORIES = ["diplomacy"];

/**
 * Types d'unités de la Compagnie : coût en Puissance, modificateur de discipline,
 * compétences clés, classes (I, P, A, C, M, S) et hommes par unité.
 */
export const COMPANY_UNIT_TYPES = {
  volunteers: { cost: 0, discipline: 4, abilities: ["agility", "marksmanship", "awareness"], classes: "I" },
  lightInfantry: { cost: 1, discipline: 2, abilities: ["athletics", "fighting", "endurance"], classes: "I" },
  heavyInfantry: { cost: 2, discipline: 1, abilities: ["athletics", "fighting", "endurance"], classes: "I" },
  personalGuard: { cost: 4, discipline: -4, abilities: ["athletics", "fighting", "endurance"], classes: "I" },
  hedgeKnights: { cost: 5, discipline: -6, abilities: ["athletics", "fighting", "endurance"], classes: "I" },
  raiders: { cost: 1, discipline: 3, abilities: ["athletics", "fighting", "endurance"], classes: "I" },
  scouts: { cost: 1, discipline: 3, abilities: ["endurance", "stealth", "awareness"], classes: "I" },
  sailors: { cost: 2, discipline: 0, abilities: ["agility", "fighting", "awareness"], classes: "I M" },
  garrison: { cost: 1, discipline: 0, abilities: ["fighting", "endurance", "awareness"], classes: "I" },
  pikemen: { cost: 2, discipline: 1, abilities: ["athletics", "fighting", "endurance"], classes: "P" },
  specialists: { cost: 3, discipline: 3, abilities: ["athletics", "stealth", "marksmanship"], classes: "I" },
  archers: { cost: 2, discipline: 3, abilities: ["agility", "marksmanship", "awareness"], classes: "A" },
  crossbowmen: { cost: 3, discipline: 1, abilities: ["agility", "marksmanship", "awareness"], classes: "A" },
  lightCavalry: { cost: 2, discipline: -2, abilities: ["agility", "fighting", "animalHandling"], classes: "C", men: 30, mounted: true },
  heavyCavalry: { cost: 3, discipline: -4, abilities: ["agility", "fighting", "animalHandling"], classes: "C", men: 20, mounted: true },
  support: { cost: 0, discipline: 4, abilities: [], classes: "S" },
  lightShips: { cost: 4, discipline: 0, abilities: ["fighting", "marksmanship", "awareness"], classes: "M", men: 5 },
  heavyShips: { cost: 6, discipline: 0, abilities: ["fighting", "marksmanship", "awareness"], classes: "M", men: 5 },
  special: { cost: 4, discipline: 0, abilities: [], classes: "I" }
};
