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

export async function openContractHelp(company) {
  const services = company.items
    .filter(i => i.type === "service" && HELP_CATEGORIES.includes(i.getFlag(SYSTEM_ID, "catalog")?.category ?? i.system.category))
    .map(i => ({ name: i.name, effect: i.system.effect }));
  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/contract-help.hbs`, {
    company, services, contract: company.system.contract
  });
  return new DialogV2({
    window: { title: game.i18n.format("AFC.ContractHelp.Title", { name: company.name }), icon: "fa-solid fa-file-signature" },
    classes: ["afc", "afc-dialog"],
    position: { width: 620 },
    content,
    buttons: [{ action: "close", label: game.i18n.localize("AFC.ContractHelp.Close"), default: true }]
  }).render({ force: true });
}
