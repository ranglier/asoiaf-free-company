/**
 * Tables des règles de guerre du livre de base (chapitre 10, tables 10-1 à 10-6 ; types et
 * entraînement : chapitre 6). Une case de la carte vaut 10 mètres par défaut.
 */

/** Statuts d'une unité (dégâts et moral). */
export const BOOK_STATUS = ["organized", "disorganized", "routed", "destroyed"];
/** Classe de la pastille d'état (mêmes couleurs que les règles maison). */
export const BOOK_STATUS_CHIP = { organized: "fresh", disorganized: "disordered", routed: "routed", destroyed: "destroyed" };

/** Compétences suivies sur une unité (les autres restent au rang 2 et ne servent pas en bataille). */
export const BOOK_ABILITIES = ["agility", "animalHandling", "athletics", "awareness", "endurance", "fighting", "marksmanship", "stealth", "survival", "warfare", "will"];
/** Version du calcul des compétences : une troupe plus ancienne est recalculée. */
export const TROOP_STATS_VERSION = 3;
/** Ordre de répartition de l'expérience : le combat d'abord. */
export const BOOK_ABILITY_PRIORITY = ["fighting", "marksmanship", "endurance", "athletics", "agility", "awareness", "stealth", "animalHandling", "survival", "warfare", "will"];
/** Améliorations de compétence selon l'entraînement (20 points d'expérience par rang). */
export const BOOK_UPGRADES = { support: 0, green: 1, trained: 3, veteran: 5, elite: 7 };

/**
 * Équipement de départ (table 10-1) et amélioré (table 10-2). ar, ap (malus d'armure), bulk ;
 * fight : Athlétisme + n ; shoot : [compétence, modificateur, portée].
 */
const SHOOT = (ability, mod, range) => ({ ability, mod, range });
export const BOOK_EQUIPMENT = {
  archers: { base: { ar: 2, ap: 1, bulk: 0, fight: -1, shoot: SHOOT("agility", 2, "long") }, up: { ar: 3, ap: 2, bulk: 0, fight: 0, shoot: SHOOT("agility", 3, "long") } },
  cavalry: { base: { ar: 5, ap: 3, bulk: 2, fight: 3 }, up: { ar: 9, ap: 5, bulk: 3, fight: 5 } },
  criminals: { base: { ar: 1, ap: 0, bulk: 0, fight: 1 }, up: { ar: 4, ap: 2, bulk: 1, fight: 2 } },
  engineers: { base: { ar: 2, ap: 1, bulk: 0, fight: -1 }, up: { ar: 5, ap: 3, bulk: 2, fight: 0 } },
  garrison: { base: { ar: 3, ap: 2, bulk: 0, fight: 1 }, up: { ar: 5, ap: 3, bulk: 2, fight: 2 } },
  guerillas: { base: { ar: 1, ap: 0, bulk: 0, fight: 0, shoot: SHOOT("agility", 1, "close") }, up: { ar: 3, ap: 2, bulk: 0, fight: 1, shoot: SHOOT("agility", 2, "close") } },
  infantry: { base: { ar: 3, ap: 2, bulk: 0, fight: 1 }, up: { ar: 4, ap: 2, bulk: 1, fight: 2 } },
  mercenaries: { base: { ar: 4, ap: 2, bulk: 1, fight: 1 }, up: { ar: 5, ap: 3, bulk: 2, fight: 3 } },
  peasants: { base: { ar: 0, ap: 0, bulk: 0, fight: -1, shoot: SHOOT("athletics", -1, "close") }, up: { ar: 2, ap: 1, bulk: 0, fight: 0, shoot: SHOOT("athletics", 0, "close") } },
  personalGuard: { base: { ar: 6, ap: 3, bulk: 2, fight: 1 }, up: { ar: 10, ap: 6, bulk: 3, fight: 2 } },
  raiders: { base: { ar: 2, ap: 1, bulk: 0, fight: 1 }, up: { ar: 5, ap: 2, bulk: 2, fight: 2 } },
  sailors: { base: { ar: 0, ap: 0, bulk: 0, fight: 1 }, up: { ar: 2, ap: 1, bulk: 0, fight: 2 } },
  scouts: { base: { ar: 2, ap: 1, bulk: 0, fight: 0, shoot: SHOOT("agility", 0, "long") }, up: { ar: 3, ap: 2, bulk: 0, fight: 1, shoot: SHOOT("agility", 1, "long") } },
  special: { base: { ar: 2, ap: 1, bulk: 0, fight: 0, shoot: SHOOT("agility", 0, "long") }, up: { ar: 6, ap: 3, bulk: 2, fight: 1, shoot: SHOOT("agility", 1, "long") } },
  support: { base: { ar: 0, ap: 0, bulk: 0, fight: -1 }, up: { ar: 2, ap: 1, bulk: 0, fight: 0 } },
  warships: { base: { ar: 5, ap: 0, bulk: 0, fight: 1, shoot: SHOOT("agility", 1, "long") }, up: { ar: 10, ap: 0, bulk: 0, fight: 4, shoot: SHOOT("agility", 3, "long") } }
};

/**
 * Types des catalogues (Compagnie, Maison) -> équipement du livre. armor, fight, shoot : équipement
 * amélioré d'emblée pour les types que le livre ne distingue pas (infanterie lourde, arbalétriers…).
 */
export const BOOK_TYPE_MAP = {
  volunteers: { type: "peasants" },
  lightInfantry: { type: "infantry" },
  heavyInfantry: { type: "infantry", armor: true, fight: true },
  personalGuard: { type: "personalGuard" },
  hedgeKnights: { type: "mercenaries", fight: true },
  raiders: { type: "raiders" },
  scouts: { type: "scouts" },
  sailors: { type: "sailors" },
  garrison: { type: "garrison" },
  pikemen: { type: "infantry", fight: true },
  specialists: { type: "special" },
  archers: { type: "archers" },
  crossbowmen: { type: "archers", shoot: true },
  lightCavalry: { type: "cavalry" },
  heavyCavalry: { type: "cavalry", armor: true, fight: true },
  support: { type: "support" },
  lightShips: { type: "warships" }, heavyShips: { type: "warships", armor: true }, warships: { type: "warships" },
  special: { type: "special" },
  cavalry: { type: "cavalry" },
  criminals: { type: "criminals" },
  crusaders: { type: "infantry" },
  infantry: { type: "infantry" },
  guerillas: { type: "guerillas" },
  engineers: { type: "engineers" },
  mercenaries: { type: "mercenaries" },
  peasants: { type: "peasants" }
};

/** Déplacement (mètres), portées (mètres) et barème des personnages attachés. */
export const BOOK_MOVE = { infantry: 40, cavalry: 80, ships: 60, sprint: 4, bulk: 10 };
export const BOOK_RANGES = { close: 20, long: 200 };
export const BOOK_ATTACHED_DAMAGE = { damaged: 1, disorganized: 2, routed: 5, destroyed: 10 };

/**
 * Ordres. mod : difficulté ajoutée au test d'Art militaire. kind : ce que fait le moteur.
 * target : "enemy" (cliquer un ennemi), "friend" (cliquer un allié). standing : ce que la troupe
 * refait ensuite sans nouvel ordre ("attack", "defend", "withdraw", "retreat" ou rien).
 */
export const BOOK_ORDERS = {
  attack: { mod: 0, kind: "attack", target: "enemy", standing: "attack", icon: "fa-hand-fist" },
  charge: { mod: 0, kind: "charge", target: "enemy", standing: "attack", icon: "fa-horse-head" },
  move: { mod: 0, kind: "move", icon: "fa-arrows-up-down-left-right" },
  defend: { mod: 0, kind: "defend", standing: "defend", icon: "fa-shield-halved" },
  withdrawFight: { mod: 0, kind: "attack", target: "enemy", penalty: 1, standing: "withdraw", withdraw: true, critical: "disorganize", icon: "fa-person-walking-arrow-loop-left" },
  ready: { mod: 0, kind: "ready", icon: "fa-hourglass-half" },
  organize: { mod: 0, kind: "organize", only: "disorganized", icon: "fa-people-group" },
  rally: { mod: 0, kind: "rally", only: "routed", icon: "fa-flag-checkered" },
  regroup: { mod: 0, kind: "regroup", icon: "fa-kit-medical" },
  retreat: { mod: 0, kind: "note", standing: "retreat", critical: "rout", icon: "fa-person-running" },
  formation: { mod: 0, kind: "formation", icon: "fa-table-cells" },
  // Ordres avancés.
  ambush: { mod: 3, kind: "attack", target: "enemy", damage: 2, standing: "attack", advanced: true, hiddenOnly: true, icon: "fa-eye-slash" },
  blitz: { mod: 6, kind: "line", target: "enemy", standing: "attack", advanced: true, icon: "fa-bolt" },
  envelop: { mod: 6, kind: "attack", target: "enemy", standing: "attack", advanced: true, note: true, icon: "fa-circle-notch" },
  forceBack: { mod: 3, kind: "forceBack", target: "enemy", standing: "attack", advanced: true, icon: "fa-angles-right" },
  hammerAnvil: { mod: 6, kind: "hammer", target: "enemy", standing: "attack", advanced: true, icon: "fa-hammer" },
  probing: { mod: 6, kind: "attack", target: "enemy", penalty: 1, defense: 2, standing: "attack", advanced: true, icon: "fa-magnifying-glass" },
  reform: { mod: 3, kind: "reform", target: "friend", advanced: true, icon: "fa-object-group" },
  sap: { mod: 3, kind: "note", advanced: true, icon: "fa-trowel" },
  scaleWalls: { mod: 3, kind: "note", advanced: true, icon: "fa-stairs" },
  setCharge: { mod: 3, kind: "setCharge", standing: "attack", advanced: true, icon: "fa-shield" },
  slashBurn: { mod: 3, kind: "note", advanced: true, icon: "fa-fire" },
  splitAttack: { mod: 6, kind: "note", standing: "attack", advanced: true, icon: "fa-code-branch" },
  suppress: { mod: 3, kind: "suppress", target: "enemy", standing: "attack", advanced: true, shootOnly: true, icon: "fa-cloud-showers-heavy" },
  trample: { mod: 3, kind: "line", target: "enemy", damage: 5, damageOnHit: true, standing: "attack", advanced: true, cavalryOnly: true, icon: "fa-horse" }
};
export const isBookTargeted = key => !!BOOK_ORDERS[key]?.target;

/** Formations (règle optionnelle). mod : difficulté de l'ordre. */
export const BOOK_FORMATIONS = {
  none: { mod: 0 },
  battle: { mod: 0, slow: 1 },
  checkered: { mod: 0, shootDef: 5, discipline: 3, slow: 1 },
  column: { mod: 0, fightDice: -1 },
  mob: { mod: -3, def: -5, discipline: 6 },
  phalanx: { mod: 6, fightDef: 5, shootDef: -5, slow: 2, noCavalry: true },
  shieldWall: { mod: 6, fightDef: 5, stop: true, negateCharge: true },
  square: { mod: 6, stop: true },
  tortoise: { mod: 9, def: 5, noAttack: true, slow: 2 },
  wedge: { mod: 3, chargeDice: 1, shootDef: -5 }
};

/**
 * Terrains (table 10-3), sur les mêmes régions nommées que les règles maison.
 * cover : Défense contre Corps à corps et Tir ; slow : mètres ôtés par tranche de 10 ; bonus : dés de
 * bonus contre un adversaire plus bas ; blocks : infranchissable ; road : annule un ralentissement.
 */
export const BOOK_TERRAINS = {
  hill: { slow: 1, bonus: 1 },
  wood: { cover: 2, denseCover: 5, dense: /dense|profond/i },
  marsh: { slow: 1 },
  river: { blocks: true },
  ford: { slow: 1 },
  bridge: { slow: 1 },
  road: { road: true },
  village: { slow: 1 },
  obstacle: { cover: 1 },
  ruins: { cover: 2, denseCover: 5, dense: /muraille|rempart|wall/i, wallBlocks: true }
};

/** Météo et visibilité. fight, shoot : dés de malus ; result : modificateur aux résultats. */
export const BOOK_WEATHER = {
  clear: {},
  lightRain: {},
  heavyRain: { result: -2 },
  lightSnow: { result: -2 },
  heavySnow: { result: -2, fight: 2, shoot: 4, slow: 1 },
  dim: { fight: 1, shoot: 2 },
  dark: { fight: 2, shoot: 4, slow: 1 }
};

/** Survivants (table 10-6) : colonne selon l'état final, ligne selon 1d6 (0 ou moins en tête). */
const X = "destroyed", I = 0;
export const BOOK_SURVIVORS = {
  noDamage: [-2, -1, I, I, I, 1, 2],
  damaged: [-3, -2, -1, I, I, I, 1],
  disorganized: [X, -3, -2, -1, I, I, I],
  routed: [X, X, -3, -2, -1, I, I],
  destroyed: [X, X, X, -3, -2, -1, I]
};
/** Gloire (table 10-5) : palier selon les unités vaincues. */
export const bookGlory = (defeated, outnumber = 0) => (defeated >= 10 ? 4 : defeated >= 7 ? 3 : defeated >= 4 ? 2 : defeated >= 1 ? 1 : 0)
  + (outnumber >= 3 ? 3 : outnumber >= 2 ? 2 : outnumber >= 1.5 ? 1 : 0);
