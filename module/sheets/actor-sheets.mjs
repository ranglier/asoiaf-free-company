import * as CONFIG_AFC from "../config.mjs";
import { rollAbilityTest } from "../dice/test-roll.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const TPL = `systems/${CONFIG_AFC.SYSTEM_ID}/templates/actor`;

/** Fiche d'acteur commune : contexte, objets, spécialités, tests. */
class AFCActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["afc", "sheet", "actor"],
    position: { width: 760, height: 820 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollAbility: AFCActorSheet.#onRollAbility,
      addSpecialty: AFCActorSheet.#onAddSpecialty,
      removeSpecialty: AFCActorSheet.#onRemoveSpecialty,
      createItem: AFCActorSheet.#onCreateItem,
      editItem: AFCActorSheet.#onEditItem,
      deleteItem: AFCActorSheet.#onDeleteItem,
      toggleEquipped: AFCActorSheet.#onToggleEquipped
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const htmlField = actor.system.biography !== undefined ? "biography" : "history";
    Object.assign(context, {
      actor,
      system: actor.system,
      config: CONFIG_AFC,
      editable: this.isEditable,
      htmlField,
      enrichedHtml: await TextEditor.enrichHTML(actor.system[htmlField] ?? "", { relativeTo: actor, secrets: actor.isOwner }),
      items: Object.groupBy(actor.items.contents.sort((a, b) => a.sort - b.sort), i => i.type)
    });
    if (actor.system.abilities) {
      context.abilities = Object.entries(CONFIG_AFC.ABILITIES).map(([key, def]) => ({
        key, ...def, ...actor.system.abilities[key]
      }));
    }
    return context;
  }

  /** Les spécialités arrivent du formulaire sous forme d'objet indexé : on les remet en tableau. */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    for (const ability of Object.values(data.system?.abilities ?? {})) {
      if (ability.specialties && !Array.isArray(ability.specialties)) ability.specialties = Object.values(ability.specialties);
    }
    return data;
  }

  static async #onRollAbility(event, target) {
    return rollAbilityTest(this.document, target.dataset.ability);
  }

  static async #onAddSpecialty(event, target) {
    const key = target.dataset.ability;
    const list = [...this.document.system.toObject().abilities[key].specialties, { name: "", bonus: 1 }];
    return this.document.update({ [`system.abilities.${key}.specialties`]: list });
  }

  static async #onRemoveSpecialty(event, target) {
    const key = target.dataset.ability;
    const list = this.document.system.toObject().abilities[key].specialties;
    list.splice(Number(target.dataset.index), 1);
    return this.document.update({ [`system.abilities.${key}.specialties`]: list });
  }

  static async #onCreateItem(event, target) {
    const type = target.dataset.type;
    const name = game.i18n.format("AFC.Item.New", { type: game.i18n.localize(`TYPES.Item.${type}`) });
    const [item] = await this.document.createEmbeddedDocuments("Item", [{ name, type }]);
    return item?.sheet.render(true);
  }

  static #onEditItem(event, target) {
    return this.document.items.get(target.closest("[data-item-id]").dataset.itemId)?.sheet.render(true);
  }

  static async #onDeleteItem(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]").dataset.itemId);
    return item?.deleteDialog();
  }

  static async #onToggleEquipped(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]").dataset.itemId);
    return item?.update({ "system.equipped": !item.system.equipped });
  }
}

export class CharacterSheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = { classes: ["character"] };
  static PARTS = { sheet: { template: `${TPL}/character.hbs`, scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.itemTypes = ["blood", "quality", "weapon", "armor"];
    return context;
  }
}

export class NpcSheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = { classes: ["npc"], position: { width: 640, height: 700 } };
  static PARTS = { sheet: { template: `${TPL}/npc.hbs`, scrollable: [""] } };
}

export class HouseSheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["house"],
    position: { width: 640, height: 720 },
    actions: { createHouse: HouseSheet.#onCreateHouse }
  };
  static PARTS = { sheet: { template: `${TPL}/house.hbs`, scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.resources = CONFIG_AFC.HOUSE_RESOURCES.map(key => ({ key, value: this.document.system.resources[key].value }));
    return context;
  }

  static #onCreateHouse() {
    ui.notifications.info(game.i18n.localize("AFC.House.CreateSoon"));
  }
}

export class CompanySheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["company"],
    position: { width: 760, height: 820 },
    actions: { createCompany: CompanySheet.#onCreateCompany }
  };
  static PARTS = { sheet: { template: `${TPL}/company.hbs`, scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    context.resources = CONFIG_AFC.COMPANY_RESOURCES.map(key => ({ key, value: system.resources[key].value }));
    context.origins = Object.fromEntries(Object.entries(CONFIG_AFC.COMPANY_ORIGINS).map(([k, v]) => [k, v.label]));
    context.leaderOptions = Object.fromEntries(game.actors.filter(a => a.type === "character").map(a => [a.id, a.name]));
    context.units = (context.items.unit ?? []).map(u => ({
      item: u, training: CONFIG_AFC.UNIT_TRAININGS[u.system.training]?.label
    }));
    return context;
  }

  static #onCreateCompany() {
    ui.notifications.info(game.i18n.localize("AFC.Company.CreateSoon"));
  }
}
