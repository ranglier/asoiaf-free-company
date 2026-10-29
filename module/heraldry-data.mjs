/**
 * Tables d'héraldique du livre de base (chapitre 6, tables 6-9 à 6-17, édition française).
 * Chaque table est une liste [valeur maximale, libellé] : on garde la première ligne atteinte.
 * Libellés en français seulement (termes du livre).
 */

/** 6-9 : émaux (2d6), avec leur signification. */
export const TINCTURES = [
  [3, "Sable", "constance, chagrin"],
  [5, "Azur", "loyauté, vérité, dévouement"],
  [6, "Pourpre", "justice, souveraineté, domination"],
  [8, "Gueules", "force militaire, magnanimité, noble sacrifice, guerriers"],
  [10, "Sinople", "espoir, joie, dévotion et loyauté en amour"],
  [11, "Orangé", "ambition et mérite"],
  [12, "Sanguine", "patience et victoire au combat"]
];
/** 6-9 : métaux (1d6). */
export const METALS = [[3, "Argent", "paix ou sincérité"], [6, "Or", "générosité"]];
/** 6-9 : fourrures (3d6). */
export const FURS = [[14, ""], [15, "Hermine"], [16, "Contre-hermine"], [17, "Péan"], [18, "Herminais"]];

/** 6-10 : partitions (7d6). */
export const PARTITIONS = [
  [9, "Tranché"], [11, "Taillé"], [14, "Coupé"], [15, "Chapé"], [16, "Chapé ployé"], [17, "Chaussé"],
  [18, "Chaussé ployé"], [21, "Mantelé"], [28, "Plain"], [30, "Mantelé renversé"], [33, "Parti"],
  [35, "Pairlé"], [36, "Pairlé renversé"], [37, "Mantelé inversé"], [39, "Écartelé"], [40, "Écartelé en six"],
  [42, "Écartelé en sautoir"]
];
export const PLAIN = "Plain";

/** 6-11 : types de charge (3d6). */
export const CHARGE_TYPES = [[4, "line"], [5, "plant"], [7, "animal"], [13, "ordinary"], [16, "subordinary"], [18, "object"]];

/** 6-12 : lignes héraldiques (2d6). */
export const LINES = [
  [2, "Bande fuselée"], [4, "Crénelé"], [5, "Engrelé"], [6, "Cannelé"], [7, "Dentelé"], [8, "Nébulé"],
  [9, "Écoté"], [10, "Rayonnant"], [12, "Ondé"]
];

/** 6-13 : plantes (2d6). */
export const PLANTS = [[3, "Baies"], [4, "Flétri"], [6, "Fleur"], [8, "Fruit"], [9, "Noix"], [10, "Plante"], [12, "Arbre"]];

/** 6-14 : animaux (13d6), et attitudes (au choix). */
export const ANIMALS = [
  "Fourmi", "Bois de cerf", "Âne", "Aurochs", "Chauve-souris", "Castor", "Ours", "Abeille", "Sanglier",
  "Tête de sanglier", "Daim", "Taureau", "Tête de taureau", "Cornes de taureau", "Papillon", "Chat",
  "Serres d'oiseau", "Coq", "Coquatrice", "Grue", "Corneille ou corbeau", "Chevreuil", "Chien", "Dauphin",
  "Dragon", "Canard", "Aigle", "Aigle bicéphale", "Faucon", "Plumes", "Poisson", "Renard", "Chèvre", "Oie",
  "Griffon", "Harpie", "Biche", "Oiseau de proie", "Cheval", "Léopard", "Lion", "Mammouth", "Manticore",
  "Mastiff", "Sirène", "Loutre", "Hibou", "Bœuf", "Cochon", "Bélier", "Salamandre", "Hippocampe", "Scorpion",
  "Serpent", "Lynx", "Araignée", "Écureuil", "Cerf", "Hirondelle", "Cygne", "Tigre", "Tortue", "Licorne",
  "Vautour", "Loup", "Vouivre"
].map((name, i) => [13 + i, name]);
export const ATTITUDES = [
  "rampant", "passant", "saillant", "accroupi", "posé", "affronté", "dormant", "éployé", "gardant", "regardant"
];
/** L'attitude « éployé » ne vaut que pour les oiseaux. */
export const BIRDS = [
  "Coq", "Coquatrice", "Grue", "Corneille ou corbeau", "Canard", "Aigle", "Aigle bicéphale", "Faucon", "Oie",
  "Hibou", "Hirondelle", "Cygne", "Vautour", "Oiseau de proie"
];

/** 6-15 : pièces ordinaires (5d6). */
export const ORDINARIES = [
  [5, "Cyclamor"], [7, "Divise"], [9, "Bande"], [10, "Barre"], [11, "Cotice"], [12, "Bordure"], [13, "Canton"],
  [14, "Échiqueté"], [15, "Chevron"], [16, "Étai"], [17, "Chef"], [18, "Croix"], [19, "Écusson"], [20, "Fuseau"],
  [21, "Giron"], [22, "Losange"], [23, "Macle"], [24, "Pal"], [25, "Pairle"], [26, "Vergette"], [27, "Pile"],
  [28, "Pointe"], [30, "Tourteau"]
];

/** 6-16 : rebattements (2d6) ; X = 1d6+1. */
export const SUBORDINARIES = [
  [3, "Bandé de X"], [4, "Burelé de X"], [5, "Fascé de X"], [6, "Chevronné de X"], [7, "Fuselé"],
  [8, "Gironné de six ou de huit"], [9, "Losangé"], [10, "Pilé de X"], [11, "Palé bandé"], [12, "Palé de X"]
];

/** 6-17 : objets (15d6) ; nombre = 1d6−2, minimum 1. */
export const OBJECTS = [
  "Outils agricoles", "Ancre", "Enclume", "Bras ou main en armure", "Bras nu", "Hache", "Bannière", "Baguette",
  "Fanal ou lanterne", "Cloches", "Os", "Arc", "Arc et flèches", "Pont", "Boucle", "Pointes", "Bougie", "Château",
  "Chaînes", "Nuages", "Pièce de monnaie", "Colonne ou pilier", "Comète", "Corne d'abondance", "Croissant de lune",
  "Tibias en croix", "Couronne", "Dague", "Dés", "Gouttes", "Tambour", "Coquillage", "Œil", "Fers de prisonnier",
  "Doigt pointé", "Feu", "Gantelet", "Joyau ou bijou", "Marteau", "Main droite ou gauche", "Harpe", "Tête",
  "Cœur enflammé", "Casque", "Fer à cheval", "Sablier", "Cor de chasse", "Clefs", "Chevalier", "Échelle",
  "Pertuisane", "Jambe", "Niveau (outil)", "Éclair", "Homme", "Lune", "Herse", "Rocs ou montagne", "Selle",
  "Balance", "Fléau d'armes", "Bateau", "Bateau démâté", "Crâne", "Lance", "Pointe de lance",
  "Étoile à sept branches", "Soleil rayonnant", "Épée", "Torche", "Tour", "Trident", "Trompette", "Roue", "Ailes",
  "Femme"
].map((name, i) => [15 + i, name]);
