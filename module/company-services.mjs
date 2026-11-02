/**
 * Services de la Compagnie qui réduisent des pertes (règles maison révisées le 2026-11-03).
 * - Bataille : le petit hôpital rend un quart des pertes de chaque troupe de la Compagnie au Bilan,
 *   les maîtres équestres un quart de celles des troupes montées ; les deux se cumulent.
 * - Événements du mois : une perte de Puissance, d'Effectif ou d'Autorité est réduite (jamais sous 1).
 * - Cohésion : aumôniers et congrégation réduisent la perte d'une défaite ou d'un coup dur, au plus
 *   de moitié ; cantiniers et cuisinier divisent par deux la perte d'une solde impayée.
 * Une Compagnie n'a qu'un service par catégorie : si une fiche en porte deux, seul le meilleur compte.
 */
import { SYSTEM_ID } from "./config.mjs";
import { COMPANY_SERVICES, UNLIMITED_SERVICE_CATEGORIES } from "./catalog-data.mjs";

/** Part des pertes de bataille rendue par service : toutes les troupes, ou les montées seulement. */
export const BATTLE_CARE = { fieldHospital: { all: 0.25 }, horseMasters: { mounted: 0.25 } };
/** Réduction des pertes d'une ressource lors d'un événement du mois (minimum 1). */
export const EVENT_LOSS_REDUCTION = {
  masterSmith: { might: 1 }, armorersGuild: { might: 2 },
  healers: { manpower: 1 }, fieldHospital: { manpower: 2 },
  sutlers: { authority: 1 }, fieldCook: { authority: 1 }
};
/** Points de Cohésion perdus en moins sur une défaite ou un coup dur (au plus la moitié de la perte). */
export const COHESION_LOSS_REDUCTION = { chaplains: 3, congregation: 6 };
/** Services qui divisent par deux la perte de Cohésion d'une solde impayée. */
export const UNPAID_HALF = ["sutlers", "fieldCook"];

const CATEGORY = Object.fromEntries(COMPANY_SERVICES.map(s => [s.key, s.category]));

/** Clés de catalogue des services d'une Compagnie (les services créés à la main n'en ont pas). */
export function serviceKeys(company) {
  return (company?.items ?? []).filter(i => i.type === "service").map(i => i.getFlag(SYSTEM_ID, "catalog")?.key).filter(Boolean);
}

/**
 * Services qui comptent : le meilleur de chaque catégorie selon valueOf (clé -> nombre), tous ceux d'une catégorie
 * sans limite (diplomatie) et ceux créés à la main. Sert aux effets qui ne passent pas par une table de ce fichier.
 */
export function bestServiceItems(company, valueOf) {
  const best = new Map(), out = [];
  for (const item of (company?.items ?? []).filter(i => i.type === "service")) {
    const key = item.getFlag(SYSTEM_ID, "catalog")?.key;
    const cat = CATEGORY[key];
    if (!key || !cat || UNLIMITED_SERVICE_CATEGORIES.includes(cat)) { out.push(item); continue; }
    const kept = best.get(cat);
    if (!kept || valueOf(key, item) > valueOf(kept.getFlag(SYSTEM_ID, "catalog").key, kept)) best.set(cat, item);
  }
  return [...out, ...best.values()];
}

/** Somme sur les catégories du meilleur service de chacune (valueOf : clé -> nombre). */
function bestPerCategory(company, valueOf) {
  const best = {};
  for (const key of serviceKeys(company)) {
    const cat = CATEGORY[key] ?? key;
    best[cat] = Math.max(best[cat] ?? 0, valueOf(key));
  }
  return Object.values(best).reduce((a, b) => a + b, 0);
}

/** Part des pertes de bataille rendue à une troupe de cette Compagnie (0 à 0,5). */
export function battleCare(company, mounted) {
  return bestPerCategory(company, key => {
    const care = BATTLE_CARE[key];
    return (care?.all ?? 0) + (mounted ? care?.mounted ?? 0 : 0);
  });
}

/** Réductions de pertes des événements du mois, par ressource ({ might: 2, authority: 1 }). */
export function eventLossReductions(company) {
  const out = {};
  for (const res of ["might", "manpower", "authority"]) {
    const n = bestPerCategory(company, key => EVENT_LOSS_REDUCTION[key]?.[res] ?? 0);
    if (n) out[res] = n;
  }
  return out;
}

/** Points de Cohésion perdus en moins sur une défaite ou un coup dur. */
export function cohesionLossReduction(company) {
  return bestPerCategory(company, key => COHESION_LOSS_REDUCTION[key] ?? 0);
}

/** Perte de Cohésion d'une défaite ou d'un coup dur, une fois le culte appliqué (au plus la moitié en moins). */
export function reducedCohesionLoss(company, loss) {
  return Math.max(Math.ceil(loss / 2), loss - cohesionLossReduction(company));
}

/** La solde impayée ne coûte que la moitié de la perte de Cohésion habituelle. */
export function unpaidHalved(company) {
  return serviceKeys(company).some(key => UNPAID_HALF.includes(key));
}
