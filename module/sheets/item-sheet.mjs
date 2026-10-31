import * as CONFIG_AFC from "../config.mjs";
import { TYPE_TRAITS } from "../battle/battle-config.mjs";
import { typeLabel } from "../battle/troops.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const UPGRADES = ["armor", "melee", "shoot"];
const { ItemSheetV2 } = foundry.applications.sheets;

/** Fiche d'objet unique : les champs affichés dépendent du type. */
export class AFCItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["afc", "sheet", "item", "parchment-window"],
    position: { width: 520, height: 560 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: { upgrade: AFCItemSheet.#onUpgrade }
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
      unitTypes: Object.fromEntries(Object.keys(TYPE_TRAITS).map(k => [k, typeLabel(k)]).sort((a, b) => a[1].localeCompare(b[1]))),
      unitUpgrades: item.type === "unit" ? UPGRADES.map(key => ({
        key, on: item.system.upgrades[key], label: `AFC.Unit.Upgrade.${key}`, effect: `AFC.Unit.Upgrade.${key}Effect`
      })) : [],
      qualityKinds: { benefit: "AFC.Quality.benefit", drawback: "AFC.Quality.drawback" },
      enrichedDescription: await TextEditor.enrichHTML(item.system.description ?? "", { relativeTo: item, secrets: item.isOwner })
    });
  }

  /** Achète une amélioration (1 point de Richesse par unité du bataillon), ou la retire sans remboursement. */
  static async #onUpgrade(event, target) {
    const item = this.document, key = target.dataset.upgrade;
    const path = `system.upgrades.${key}`;
    if (item.system.upgrades[key]) return item.update({ [path]: false });
    const loc = k => game.i18n.localize(k);
    const wealth = item.parent?.system.resources?.wealth;
    const cost = item.system.count;
    if (!wealth) return item.update({ [path]: true });
    const label = loc(`AFC.Unit.Upgrade.${key}`);
    const choice = await DialogV2.wait({
      window: { title: label }, classes: ["afc", "afc-dialog"], rejectClose: false,
      content: `<p>${game.i18n.format("AFC.Unit.Upgrade.confirm", { name: foundry.utils.escapeHTML(item.name), upgrade: label, cost, wealth: wealth.value })}</p>`,
      buttons: [
        { action: "pay", label: game.i18n.format("AFC.Unit.Upgrade.pay", { cost }), default: true },
        { action: "free", label: loc("AFC.Unit.Upgrade.free") }
      ]
    });
    if (choice === "pay") {
      if (wealth.value < cost) return ui.notifications.warn(loc("AFC.Unit.Upgrade.tooPoor"));
      await item.parent.update({ "system.resources.wealth.value": wealth.value - cost });
    }
    if (choice === "pay" || choice === "free") return item.update({ [path]: true });
  }
}
