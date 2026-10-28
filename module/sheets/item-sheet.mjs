import * as CONFIG_AFC from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/** Fiche d'objet unique : les champs affichés dépendent du type. */
export class AFCItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["afc", "sheet", "item", "parchment-window"],
    position: { width: 520, height: 560 },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  static PARTS = {
    sheet: { template: `systems/${CONFIG_AFC.SYSTEM_ID}/templates/item/item.hbs`, scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const localized = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v.label ?? v]));
    return Object.assign(context, {
      item,
      system: item.system,
      editable: this.isEditable,
      abilities: localized(CONFIG_AFC.ABILITIES),
      attackAbilities: Object.fromEntries(CONFIG_AFC.ATTACK_ABILITIES.map(k => [k, CONFIG_AFC.ABILITIES[k].label])),
      holdingResources: Object.fromEntries(CONFIG_AFC.HOLDING_RESOURCES.map(k => [k, `AFC.House.Resource.${k}`])),
      serviceSizes: localized(CONFIG_AFC.SERVICE_SIZES),
      unitTrainings: localized(CONFIG_AFC.UNIT_TRAININGS),
      qualityKinds: { benefit: "AFC.Quality.benefit", drawback: "AFC.Quality.drawback" },
      enrichedDescription: await TextEditor.enrichHTML(item.system.description ?? "", { relativeTo: item, secrets: item.isOwner })
    });
  }
}
