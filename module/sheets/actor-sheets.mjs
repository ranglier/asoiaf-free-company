import * as CONFIG_AFC from "../config.mjs";
import { rollAbilityTest } from "../dice/test-roll.mjs";
import { rollAttack, weaponProfile, weaponQualities } from "../dice/attack.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const TPL = `systems/${CONFIG_AFC.SYSTEM_ID}/templates/actor`;

/** Pastilles 1..max pour un compteur (rang, blessures, destinée...). */
function pips(value, max) {
  return Array.from({ length: max }, (_, i) => ({ n: i + 1, on: i < value }));
}

/** Fiche d'acteur commune : contexte, objets, spécialités, tests. */
class AFCActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["afc", "sheet", "actor"],
    position: { width: 760, height: 820 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollAbility: AFCActorSheet.#onRollAbility,
      rollSpecialty: AFCActorSheet.#onRollSpecialty,
      addSpecialty: AFCActorSheet.#onAddSpecialty,
      removeSpecialty: AFCActorSheet.#onRemoveSpecialty,
      createItem: AFCActorSheet.#onCreateItem,
      editItem: AFCActorSheet.#onEditItem,
      deleteItem: AFCActorSheet.#onDeleteItem,
      toggleEquipped: AFCActorSheet.#onToggleEquipped,
      toggleEdit: AFCActorSheet.#onToggleEdit,
      setPip: AFCActorSheet.#onSetPip,
      attack: AFCActorSheet.#onAttack,
      setGrip: AFCActorSheet.#onSetGrip
    }
  };

  /** Mode édition (champs modifiables) ou mode jeu (lecture et jets). */
  editMode = false;

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
      editMode: this.isEditable && this.editMode,
      htmlField,
      enrichedHtml: await TextEditor.enrichHTML(actor.system[htmlField] ?? "", { relativeTo: actor, secrets: actor.isOwner }),
      items: Object.groupBy(actor.items.contents.sort((a, b) => a.sort - b.sort), i => i.type)
    });
    if (actor.system.abilities) {
      // Capacités triées par ordre alphabétique dans la langue de l'utilisateur.
      context.abilities = Object.entries(CONFIG_AFC.ABILITIES).map(([key, def]) => {
        const ab = actor.system.abilities[key];
        return { key, ...def, name: game.i18n.localize(def.label), ...ab, pips: pips(ab.rank, 7),
          isDefault: ab.rank === CONFIG_AFC.DEFAULT_RANK && !ab.specialties.length };
      }).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
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

  /** Clic : test rapide ; Maj + clic : dialogue complet. */
  static async #onRollAbility(event, target) {
    return rollAbilityTest(this.document, target.dataset.ability, { quick: !event.shiftKey });
  }

  static async #onRollSpecialty(event, target) {
    return rollAbilityTest(this.document, target.dataset.ability, { quick: !event.shiftKey, specialty: Number(target.dataset.index) });
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

  static #onToggleEdit() {
    this.editMode = !this.editMode;
    return this.render();
  }

  /** Clic sur une pastille : fixe la valeur (re-clic sur la dernière pastille = la retire). */
  static async #onSetPip(event, target) {
    const path = target.dataset.path;
    const n = Number(target.dataset.n);
    const current = foundry.utils.getProperty(this.document, path);
    return this.document.update({ [path]: current === n ? n - 1 : n });
  }

  static async #onAttack(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]").dataset.itemId);
    return item && rollAttack(this.document, item, { quick: !event.shiftKey });
  }

  static async #onSetGrip(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]").dataset.itemId);
    return item?.update({ "system.grip": target.dataset.grip });
  }
}

export class CharacterSheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = { classes: ["character"], position: { width: 820, height: 860 } };
  static PARTS = { sheet: { template: `${TPL}/character.hbs`, scrollable: [".tab-body"] } };
  static TABS = {
    primary: {
      tabs: [
        { id: "abilities", label: "AFC.Tab.abilities" },
        { id: "combat", label: "AFC.Tab.combat" },
        { id: "equipment", label: "AFC.Tab.equipment" },
        { id: "qualities", label: "AFC.Tab.qualities" },
        { id: "biography", label: "AFC.Tab.biography" }
      ],
      initial: "abilities"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.document.system;
    context.tabs = this._prepareTabs("primary");
    context.track = {
      wounds: pips(s.wounds.value, s.wounds.max),
      injuries: pips(s.injuries.value, s.injuries.max),
      destiny: pips(s.destiny.value, Math.max(s.destiny.max, s.destiny.value))
    };
    context.healthPct = s.health.max ? Math.round(100 * s.health.value / s.health.max) : 0;
    context.composurePct = s.composure.max ? Math.round(100 * s.composure.value / s.composure.max) : 0;
    context.weapons = (context.items.weapon ?? []).map(item => ({
      item, profile: weaponProfile(this.document, item), qualities: weaponQualities(item)
    }));
    context.initial = (this.document.name || "?").charAt(0).toUpperCase();
    return context;
  }
}

export class NpcSheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = { classes: ["npc"], position: { width: 640, height: 700 } };
  static PARTS = { sheet: { template: `${TPL}/npc.hbs`, scrollable: [""] } };
  editMode = true;
}

export class HouseSheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["house"],
    position: { width: 640, height: 720 },
    actions: { createHouse: HouseSheet.#onCreateHouse }
  };
  static PARTS = { sheet: { template: `${TPL}/house.hbs`, scrollable: [""] } };
  editMode = true;

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
  editMode = true;

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
