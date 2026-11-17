/**
 * Dessin des blasons par le module Coat of Arms (extension de Tokenizer 2), quand il est actif (décision du
 * 2026-11-17). Notre générateur garde les tables du livre, le français et la fiche de Maison ; seul le dessin
 * change. Un élément sans équivalent (lignes ondées ou engrelées, orangé, sanguine, péan, chapé, mantelé…) rend
 * la main à notre propre dessin, pour ne jamais montrer un blason faux.
 */
const MODULE = "tokenizer-2-coat-of-arms";

/** Le module est-il là, avec son API ? */
export const coaAvailable = () => !!game.modules.get(MODULE)?.active && !!game.modules.get(MODULE)?.api?.render;

const TINCTURES = {
  Sable: "sable", Azur: "azure", Pourpre: "purpure", Gueules: "gules", Sinople: "vert", Argent: "argent", Or: "or",
  Hermine: "ermine", "Contre-hermine": "ermines", Herminais: "erminois"
};
const FURS = ["ermine", "ermines", "erminois"];

/** Partitions sans ambiguïté de sens ni d'ordre des couleurs. */
const DIVISIONS = { Tranché: "bend", Taillé: "bend-sinister", Coupé: "fess", Parti: "pale", Écartelé: "quarterly", "Écartelé en sautoir": "saltire" };

/** Pièces ordinaires (le reste, comme pairle, giron, étai, vergette, n'a pas d'équivalent). */
const ORDINARIES = { Bande: "bend", Barre: "bend-sinister", Bordure: "bordure", Canton: "canton", Chevron: "chevron", Chef: "chief", Croix: "cross", Pal: "pale", Pile: "pile" };
/** Pièces du livre qui se dessinent en meuble chez Coat of Arms. */
const ORDINARY_CHARGES = { Losange: "lozenge", Macle: "mascle", Tourteau: "roundel" };
/** Rebattements : champ semé d'un motif. Le nombre de pièces (X) est repris quand il compte. */
const VARIATIONS = { "Bandé de X": "bendy", "Burelé de X": "barry", "Fascé de X": "barry", "Palé de X": "paly", Losangé: "lozengy", "Gironné de six ou de huit": "gyronny", "Échiqueté": "chequy" };

const ANIMALS = {
  Fourmi: "ant", "Chauve-souris": "bat", Ours: "bear", Abeille: "bee", Sanglier: "boar", "Tête de sanglier": ["boar", true],
  Daim: "stag", Taureau: "bull", "Tête de taureau": ["bull", true], Bœuf: "bull", Coq: "cock", Coquatrice: "cockatrice",
  Grue: "crane", "Corneille ou corbeau": "raven", Chevreuil: "stag", Chien: "hound", Mastiff: "talbot", Dauphin: "dolphin",
  Dragon: "dragon", Aigle: "eagle", Faucon: "falcon", "Oiseau de proie": "falcon", Poisson: "fish", Renard: "fox",
  Chèvre: "goat", Griffon: "griffin", Harpie: "harpy", Cheval: "horse", Léopard: "leopard", Lion: "lion",
  Manticore: "manticore", Sirène: "mermaid", Hibou: "owl", Bélier: "ram", Salamandre: "salamander", Hippocampe: "sea-horse",
  Scorpion: "scorpion", Serpent: "serpent", Araignée: "spider", Cerf: "stag", Hirondelle: "martlet", Cygne: "swan",
  Licorne: "unicorn", Loup: "wolf", Vouivre: "wyvern"
};
/** Attitudes : au plus proche (« saillant » n'existe pas, le cerf saillant se dresse comme un rampant). */
const ATTITUDES = { rampant: "rampant", saillant: "rampant", passant: "passant", posé: "statant", dormant: "couchant" };
const PLANTS = { Fleur: "rose", Arbre: "tree", Fruit: "apple", Noix: "acorn" };
const OBJECTS = {
  Ancre: "anchor", Enclume: "anvil", "Bras ou main en armure": "gauntlet", Hache: "battle-axe", Cloches: "bell", Pont: "bridge",
  Boucle: "buckle", Château: "castle", "Croissant de lune": "crescent", Couronne: "crown", Coquillage: "escallop",
  Gantelet: "gauntlet", Marteau: "hammer", "Main droite ou gauche": "hand", Harpe: "harp", Tête: "head", Casque: "helm",
  "Fer à cheval": "horseshoe", "Cor de chasse": "hunting-horn", Clefs: "key", Chevalier: "knight", Lune: "moon",
  "Rocs ou montagne": "mountain", Balance: "scale", "Fléau d'armes": "flail", Bateau: "lymphad", Crâne: "skull",
  Lance: "lance", "Étoile à sept branches": "estoile", "Soleil rayonnant": "sun", Épée: "sword", Tour: "tower", Roue: "wheel",
  Éclair: "thunderbolt", Comète: "shooting-star", "Cœur enflammé": "heart", Bras: "arm", "Bras nu": "arm"
};

/**
 * Notre blason (modèle de heraldry.mjs) en blason Coat of Arms. Renvoie { arms } ou { missing } : ce qui n'a
 * pas d'équivalent (le dessin du système sert alors).
 */
export function toCoa(model) {
  const missing = [];
  const tincture = name => {
    const t = TINCTURES[name];
    if (!t) missing.push(name);
    return t ?? "or";
  };
  const [first, second] = model.colors ?? [];
  const field = { tincture: tincture(first), division: null, variation: null };
  if (model.partition && model.partition !== "Plain") {
    const type = DIVISIONS[model.partition];
    if (!type) missing.push(model.partition);
    if (model.line) missing.push(model.line);
    field.division = { type: type ?? "pale", tinctures: [field.tincture, tincture(second)], design: "overall" };
  }
  const arms = { version: 1, field, ordinary: null, charges: [], halves: null };
  const c = model.charge;
  if (c) {
    const color = tincture(c.color);
    const count = Math.max(1, Number(c.count) || 1);
    if (c.line) missing.push(c.line);
    switch (c.type) {
      case "ordinary":
        if (ORDINARIES[c.name]) arms.ordinary = { type: ORDINARIES[c.name], tincture: color, charges: [] };
        else if (ORDINARY_CHARGES[c.name]) arms.charges.push({ type: ORDINARY_CHARGES[c.name], tincture: color, count });
        else if (VARIATIONS[c.name] && !field.division) field.variation = { type: VARIATIONS[c.name], tinctures: [field.tincture, color] };
        else missing.push(c.name);
        break;
      case "subordinary": {
        const type = VARIATIONS[c.name];
        if (!type || field.division) missing.push(c.name);
        else field.variation = { type, tinctures: [field.tincture, color], count: ["barry", "paly", "bendy"].includes(type) ? count : null };
        break;
      }
      case "animal": {
        const a = ANIMALS[c.name];
        if (!a) { missing.push(c.name); break; }
        const [type, head] = Array.isArray(a) ? a : [a, false];
        arms.charges.push({ type, tincture: color, count, head, attitude: ATTITUDES[c.attitude] ?? null });
        break;
      }
      case "plant":
        if (PLANTS[c.name]) arms.charges.push({ type: PLANTS[c.name], tincture: color, count });
        else missing.push(c.name);
        break;
      case "object":
        if (OBJECTS[c.name]) arms.charges.push({ type: OBJECTS[c.name], tincture: color, count });
        else missing.push(c.name);
        break;
      default:
        missing.push(c.name ?? c.type);
    }
  }
  // Une fourrure ne se pose pas en meuble chez Coat of Arms : elle ne vaut que pour le champ.
  for (const ch of arms.charges) if (FURS.includes(ch.tincture)) missing.push(ch.tincture);
  if (missing.length) return { missing: [...new Set(missing)] };
  return { arms: game.modules.get(MODULE).api.normaliseArms(arms) };
}

/** Dessin Coat of Arms (canvas), ou null si un élément manque. */
export async function renderCoa(model, size = 512) {
  if (!coaAvailable()) return null;
  const { arms } = toCoa(model);
  if (!arms) return null;
  const api = game.modules.get(MODULE).api;
  await api.ready?.();
  return api.render(arms, { size });
}

/** Image PNG du blason Coat of Arms, pour l'enregistrer comme portrait. */
export async function coaBlob(model, size = 1024) {
  const canvas = await renderCoa(model, size);
  if (!canvas) return null;
  return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
}
