/**
 * Aide de jeu à la négociation d'un contrat (règles maison de la Compagnie).
 * Simple fenêtre de rappel : rien n'est lancé ni appliqué, le MJ décide.
 * Elle liste aussi les services de la Compagnie qui peuvent peser dans la négociation.
 */
import { SYSTEM_ID } from "./config.mjs";

const { DialogV2 } = foundry.applications.api;
const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);

/** Catégories de services utiles à la négociation : état-major et diplomatie. */
const HELP_CATEGORIES = ["staff", "diplomacy"];

/** Valeur d'un point de Richesse en dragons d'or (livre de base : 200 dragons donnés = +1 Richesse). */
export const DRAGONS_PER_WEALTH = 200;
/** Ravitaillement obtenu pour 1 Richesse (règles maison). */
const SUPPLY_PER_WEALTH = 5;

/** Montant lisible (« 2 400 »). */
const fmt = n => n.toLocaleString(game.i18n.lang);

/**
 * Besoins mensuels de la Compagnie, pour situer une offre : entretien en Ravitaillement, son
 * équivalent en Richesse et en dragons d'or, réserves et couverture par le contrat en cours.
 */
function monthlyNeeds(s) {
  const upkeep = s.monthlySupply;
  const wealth = Math.ceil(upkeep / SUPPLY_PER_WEALTH);
  const pay = s.contract.pay ?? 0;
  return {
    upkeep, manpower: Math.floor(s.resources.manpower.value / 2), services: s.services.supply,
    organization: Math.floor(s.organization.effective / 10) * SUPPLY_PER_WEALTH,
    wealth, dragons: fmt(wealth * DRAGONS_PER_WEALTH),
    supply: s.supply, autonomy: upkeep ? Math.floor(s.supply / upkeep) : null,
    treasury: s.resources.wealth.value, treasuryDragons: fmt(s.resources.wealth.value * DRAGONS_PER_WEALTH),
    pay, payDragons: fmt(pay * DRAGONS_PER_WEALTH), margin: pay - wealth, deficit: Math.max(0, wealth - pay), hasPay: pay > 0
  };
}

export async function openContractHelp(company) {
  const services = company.items
    .filter(i => i.type === "service" && HELP_CATEGORIES.includes(i.getFlag(SYSTEM_ID, "catalog")?.category ?? i.system.category))
    .map(i => ({ name: i.name, effect: i.system.effect }));
  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/contract-help.hbs`, {
    company, services, contract: company.system.contract, needs: monthlyNeeds(company.system)
  });
  return new DialogV2({
    window: { title: game.i18n.format("AFC.ContractHelp.Title", { name: company.name }), icon: "fa-solid fa-file-signature" },
    classes: ["afc", "afc-dialog"],
    position: { width: 620 },
    content,
    buttons: [{ action: "close", label: game.i18n.localize("AFC.ContractHelp.Close"), default: true }]
  }).render({ force: true });
}
