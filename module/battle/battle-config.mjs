/**
 * Tables des règles de bataille (règles maison, docs/regles-bataille.md).
 */

/** États d'une troupe, du meilleur au pire, avec le pourcentage de pertes en fin de bataille. */
export const TROOP_STATES = {
  fresh: { label: "AFC.Battle.State.fresh", loss: 0, icon: null },
  shaken: { label: "AFC.Battle.State.shaken", loss: 10, icon: "icons/svg/downgrade.svg" },
  disordered: { label: "AFC.Battle.State.disordered", loss: 25, icon: "icons/svg/daze.svg" },
  routed: { label: "AFC.Battle.State.routed", loss: 40, icon: "icons/svg/terror.svg" },
  destroyed: { label: "AFC.Battle.State.destroyed", loss: 70, icon: "icons/svg/skull.svg" }
};
export const STATE_ORDER = Object.keys(TROOP_STATES);
/** Pertes supplémentaires par passage à Désorganisée ou pire, et plafond (unité brisée). */
export const DISORDER_LOSS = 5;
export const MAX_LOSS = 70;

/** Surnombre : une unité montée compte pour ce nombre d'hommes (20 chevaliers pèsent plus que 20 fantassins). */
export const MOUNTED_UNIT_STRENGTH = 200;

/** Test d'officier (option) : Discipline + 3, +1 par 100 hommes au-delà des 100 premiers ; +1B dès 1 degré, +2B dès 3 degrés. */
export const OFFICER_TEST = { margin: 3, perHundredMen: 1, degreesPerBonus: 2, max: 2 };

/** Entraînement : réserve d'encaissement. */
export const TRAINING_BATTLE = {
  support: { cushion: 0 },
  green: { cushion: 0 },
  trained: { cushion: 1 },
  veteran: { cushion: 2 },
  elite: { cushion: 3 }
};

/** Ordres. Ordres gagnants : Charger bat Tirer, Tenir bat Charger (Attaquer est neutre, Tirer n'a pas de bonus contre Tenir depuis la v0.27.5). */
export const ORDERS = ["charge", "attack", "hold", "shoot", "maneuver", "run", "withdraw"];
export const TRIANGLE = { charge: "shoot", hold: "charge" };
/** Ordres « en mouvement » (pertes au tir non plafonnées). */
export const MOVING_ORDERS = ["charge", "attack", "maneuver", "run"];

/** Traits d'équipement et de type. Le libellé et l'effet sont dans les fichiers de langue. */
export const TRAITS = [
  "heavyArmor", "shields", "shock", "heavyShock", "pikes", "mounted", "light", "bows", "crossbows",
  "piercing", "reload", "javelins", "slings", "green", "steadfast", "scouts", "defenders", "noncombat"
];
/** Traits retirés des règles : gardés dans la liste pour que les fiches existantes restent valides, sans effet ni affichage. */
export const RETIRED_TRAITS = ["green"];
export const ACTIVE_TRAITS = TRAITS.filter(k => !RETIRED_TRAITS.includes(k));
/** Portée de tir des traits de tir. */
export const RANGES = { bows: 4, crossbows: 3, javelins: 2, slings: 3 };

/** Traits déduits du type d'unité (catalogues de la Compagnie et de la Maison). */
export const TYPE_TRAITS = {
  volunteers: ["light"],
  lightInfantry: ["light", "javelins"],
  heavyInfantry: ["heavyArmor", "shields"],
  personalGuard: ["heavyArmor", "shields", "steadfast"],
  hedgeKnights: ["heavyArmor"],
  raiders: ["light", "javelins"],
  scouts: ["light", "scouts"],
  sailors: ["light"],
  garrison: ["shields", "defenders"],
  pikemen: ["pikes"],
  specialists: [],
  archers: ["bows"],
  crossbowmen: ["crossbows", "piercing", "reload"],
  lightCavalry: ["mounted", "light", "shock"],
  heavyCavalry: ["mounted", "heavyArmor", "heavyShock"],
  support: ["noncombat"],
  lightShips: [], heavyShips: [], warships: [], special: [],
  cavalry: ["mounted", "heavyArmor", "heavyShock"],
  criminals: ["light"],
  crusaders: ["steadfast"],
  infantry: ["shields"],
  guerillas: ["light", "javelins"],
  engineers: [],
  mercenaries: [],
  peasants: []
};

/** Traits d'une unité à un ou deux types : une arme de tir remplace les armes de jet, l'armure lourde exclut Léger. */
export function mergeTraits(types) {
  const traits = new Set(types.flatMap(t => TYPE_TRAITS[t] ?? []));
  if (traits.has("bows") || traits.has("crossbows") || traits.has("slings")) traits.delete("javelins");
  if (traits.has("heavyArmor")) traits.delete("light");
  return [...traits];
}

/** Image du jeton selon le type d'unité. */
export const TYPE_ICONS = {
  heavyInfantry: "heavy", personalGuard: "heavy", hedgeKnights: "heavy", garrison: "heavy", infantry: "infantry",
  pikemen: "pikes", archers: "archers", crossbowmen: "crossbows", lightCavalry: "lightcav",
  heavyCavalry: "heavycav", cavalry: "heavycav", scouts: "scouts", support: "support", engineers: "support",
  lightShips: "ships", heavyShips: "ships", warships: "ships", sailors: "ships",
  lightInfantry: "light", raiders: "light", guerillas: "light", volunteers: "infantry", peasants: "infantry",
  criminals: "light", crusaders: "infantry", mercenaries: "infantry", specialists: "infantry", special: "infantry"
};

/**
 * Terrains, reconnus au nom des régions de la scène (« Bois », « Colline »…).
 * cover : difficulté ajoutée aux tirs ; defense : +1B à qui l'occupe en défense et au tir ;
 * cavalry : −1D à la cavalerie ; hold : +1B pour Tenir ; noCharge ; charge : −1D à une charge qui y entre.
 */
export const TERRAINS = {
  hill: { match: /colline|cr[eê]te|hill|ridge/i, defense: 1, chargeUp: 1 },
  wood: { match: /bois|for[eê]t|wood|forest/i, cover: 3, cavalry: 1 },
  marsh: { match: /marais|marsh|swamp/i, noCharge: true, cavalry: 1 },
  river: { match: /rivi[eè]re|fleuve|river/i, impassable: true },
  ford: { match: /gu[eé]|ford/i, attackerPenalty: 1, defenderBonus: 1, cavalry: 1 },
  bridge: { match: /pont|bridge/i, attackerPenalty: 1, defenderBonus: 1 },
  road: { match: /route|chemin|road/i },
  village: { match: /village|ferme|farm/i, cover: 3, hold: 1, cavalry: 1 },
  obstacle: { match: /haie|pieux|foss[eé]|obstacle|hedge|stake|ditch/i, cover: 1, charge: 1 },
  ruins: { match: /ruine|fortif|muraille|rempart|ruin|wall/i, cover: 3, fortified: true }
};

/**
 * Météo de la bataille. Brouillard : vue à 2 cases ; la portée n'est plus divisée par deux (décision de
 * Jules, 2026-11-02) : au-delà de la vue, on tire à l'aveugle.
 */
export const WEATHER = { clear: {}, rain: { shoot: 1, noCharge: true }, fog: { sight: 2 } };

/** Icône de chaque ordre (carte, fenêtre Bataille, carte de chat). */
export const ORDER_ICONS = {
  charge: "fa-horse-head", attack: "fa-hand-fist", hold: "fa-shield-halved",
  shoot: "fa-bullseye", maneuver: "fa-arrows-up-down-left-right", run: "fa-person-running", withdraw: "fa-person-walking-arrow-loop-left"
};
