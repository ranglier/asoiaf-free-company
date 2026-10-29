import * as CONFIG_AFC from "../config.mjs";
import { rollAbilityTest } from "../dice/test-roll.mjs";
import { rollAttack, weaponProfile, weaponQualities } from "../dice/attack.mjs";
import { runCreation } from "../creation.mjs";
import { HoldingCatalog } from "../apps/holding-catalog.mjs";
import { CompanyCatalog } from "../apps/company-catalog.mjs";
import { runMonthEnd } from "../month-end.mjs";
import { runConversion } from "../conversion.mjs";
import { runHouseEvent } from "../house-month.mjs";
import { runHeraldry } from "../heraldry.mjs";

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
      setGrip: AFCActorSheet.#onSetGrip,
      addRow: AFCActorSheet.#onAddRow,
      removeRow: AFCActorSheet.#onRemoveRow,
      openActor: AFCActorSheet.#onOpenActor
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
    if (actor.system.abilities) this._prepareCombatant(context);
    if (this.constructor.TABS.primary) context.tabs = this._prepareTabs("primary");
    return context;
  }

  /** Contexte commun aux PJ et PNJ : compétences, pistes de santé, armes. */
  _prepareCombatant(context) {
    const actor = this.document;
    const s = actor.system;
    // Compétences par groupe thématique, triées par ordre alphabétique dans chaque groupe.
    context.abilityGroups = Object.entries(CONFIG_AFC.ABILITY_GROUPS).map(([key, group]) => ({
      key, label: group.label,
      abilities: group.abilities.map(k => {
        const ab = s.abilities[k];
        return { key: k, name: game.i18n.localize(CONFIG_AFC.ABILITIES[k].label), ...ab,
          isDefault: ab.rank === CONFIG_AFC.DEFAULT_RANK && !ab.specialties.length };
      }).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang))
    }));

    context.track = {
      wounds: pips(s.wounds.value, s.wounds.max),
      injuries: pips(s.injuries.value, s.injuries.max)
    };
    context.healthPct = s.health.max ? Math.round(100 * s.health.value / s.health.max) : 0;
    context.weapons = (context.items.weapon ?? []).map(item => ({
      item, profile: weaponProfile(actor, item), qualities: weaponQualities(item)
    }));
  }

  /** Les listes (spécialités, événements, foyer) arrivent du formulaire en objets indexés : on les remet en tableaux. */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    for (const ability of Object.values(data.system?.abilities ?? {})) {
      if (ability.specialties && !Array.isArray(ability.specialties)) ability.specialties = Object.values(ability.specialties);
    }
    for (const key of ["events", "household", "members"]) {
      const list = data.system?.[key];
      if (list && !Array.isArray(list)) data.system[key] = Object.values(list);
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

  /** Lignes vides ajoutées aux listes du système. */
  static ROW_DEFAULTS = {
    events: { name: "", note: "" },
    household: { role: "", name: "", actor: "" },
    members: { role: "", name: "", actor: "" }
  };

  /** Liste de personnes (foyer, membres) pour le gabarit : acteur lié, index de ligne. */
  _prepareMembers(context, key) {
    context.actorOptions = Object.fromEntries(game.actors.filter(a => ["character", "npc"].includes(a.type)).map(a => [a.id, a.name]));
    context.memberList = key;
    return this.document.system[key].map((m, index) => ({
      ...m, index, linked: m.actor ? game.actors.get(m.actor) : null
    }));
  }

  static async #onAddRow(event, target) {
    const key = target.dataset.list;
    const list = [...this.document.system.toObject()[key], { ...AFCActorSheet.ROW_DEFAULTS[key] }];
    return this.document.update({ [`system.${key}`]: list });
  }

  static async #onRemoveRow(event, target) {
    const key = target.dataset.list;
    const list = this.document.system.toObject()[key];
    list.splice(Number(target.dataset.index), 1);
    return this.document.update({ [`system.${key}`]: list });
  }

  static #onOpenActor(event, target) {
    return game.actors.get(target.dataset.actorId)?.sheet.render(true);
  }

  static async #onSetGrip(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]").dataset.itemId);
    return item?.update({ "system.grip": target.dataset.grip });
  }
}

/** Onglets communs aux PJ et PNJ. */
const COMBATANT_TABS = (extra = []) => ({
  primary: {
    tabs: [
      { id: "abilities", label: "AFC.Tab.abilities" },
      { id: "combat", label: "AFC.Tab.combat" },
      ...extra,
      { id: "qualities", label: "AFC.Tab.qualities" },
      { id: "biography", label: "AFC.Tab.biography" }
    ],
    initial: "abilities"
  }
});

export class CharacterSheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = { classes: ["character"], position: { width: 820, height: 860 } };
  static PARTS = { sheet: { template: `${TPL}/character.hbs`, scrollable: [""] } };
  static TABS = COMBATANT_TABS([{ id: "equipment", label: "AFC.Tab.equipment" }]);

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.document.system;
    context.track.destiny = pips(s.destiny.value, Math.max(s.destiny.max, s.destiny.value));
    return context;
  }
}

export class NpcSheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = { classes: ["npc"], position: { width: 780, height: 780 } };
  static PARTS = { sheet: { template: `${TPL}/npc.hbs`, scrollable: [""] } };
  static TABS = COMBATANT_TABS();
}

/** Icônes des ressources (Font Awesome). */
const RESOURCE_ICONS = {
  defense: "fa-chess-rook", influence: "fa-crown", lands: "fa-mountain-sun", law: "fa-scale-balanced",
  population: "fa-people-group", power: "fa-chess-knight", wealth: "fa-coins",
  renown: "fa-crown", authority: "fa-gavel", manpower: "fa-people-group", might: "fa-swords",
  organization: "fa-scroll"
};

/** Liste des ressources pour les tuiles : clé, valeur, libellé, icône. */
function resourceTiles(resources, keys, prefix) {
  return keys.map(key => ({
    key, value: resources[key].value, label: `${prefix}.${key}`, icon: RESOURCE_ICONS[key],
    // Ressources où l'on investit (possessions de Maison, unités de Compagnie) : afficher le disponible.
    available: resources[key].available,
    hasBudget: (CONFIG_AFC.HOLDING_RESOURCES.includes(key) || ["manpower", "might"].includes(key)) && resources[key].available !== undefined
  }));
}

export class HouseSheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["house"],
    position: { width: 860, height: 860 },
    actions: {
      createHouse: HouseSheet.#onCreateHouse, openCatalog: HouseSheet.#onOpenCatalog,
      convert: HouseSheet.#onConvert, houseEvent: HouseSheet.#onHouseEvent, heraldry: HouseSheet.#onHeraldry
    }
  };
  static PARTS = { sheet: { template: `${TPL}/house.hbs`, scrollable: [""] } };
  static TABS = {
    primary: {
      tabs: [
        { id: "holdings", label: "AFC.Tab.holdings" },
        { id: "household", label: "AFC.Tab.household" },
        { id: "history", label: "AFC.Tab.history" }
      ],
      initial: "holdings"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.document.system;
    context.resources = resourceTiles(s.resources, CONFIG_AFC.HOUSE_RESOURCES, "AFC.House.Resource");
    context.resourcesEditable = context.editMode;
    context.realmLabel = CONFIG_AFC.REALMS[s.realm];
    // Possessions regroupées par ressource ; les unités vont avec la Puissance.
    const holdings = context.items.holding ?? [];
    context.holdingGroups = CONFIG_AFC.HOLDING_RESOURCES.map(key => ({
      key, icon: RESOURCE_ICONS[key], label: `AFC.House.Resource.${key}`,
      resource: s.resources[key],
      holdings: holdings.filter(h => h.system.resource === key),
      units: key === "power" ? (context.items.unit ?? []).map(item => ({
        item, training: CONFIG_AFC.UNIT_TRAININGS[item.system.training]?.label
      })) : null
    }));
    context.members = this._prepareMembers(context, "household");
    context.showCreate = context.editable && (!s.created || (context.editMode && game.user.isGM));
    return context;
  }

  static #onCreateHouse() {
    return runCreation(this.document);
  }

  static #onOpenCatalog() {
    return new HoldingCatalog(this.document).render(true);
  }

  static #onConvert() {
    return runConversion(this.document);
  }

  static #onHouseEvent() {
    return runHouseEvent(this.document);
  }

  static async #onHeraldry() {
    const arms = await runHeraldry();
    if (arms) await this.document.update({ "system.arms": arms });
  }
}

export class CompanySheet extends AFCActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["company"],
    position: { width: 860, height: 860 },
    actions: { createCompany: CompanySheet.#onCreateCompany, openCatalog: CompanySheet.#onOpenCatalog, monthEnd: CompanySheet.#onMonthEnd, convert: CompanySheet.#onConvert }
  };
  static PARTS = { sheet: { template: `${TPL}/company.hbs`, scrollable: [""] } };
  static TABS = {
    primary: {
      tabs: [
        { id: "services", label: "AFC.Tab.services" },
        { id: "units", label: "AFC.Tab.units" },
        { id: "members", label: "AFC.Tab.members" },
        { id: "history", label: "AFC.Tab.history" }
      ],
      initial: "services"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.document.system;
    context.resources = resourceTiles(s.resources, CONFIG_AFC.COMPANY_RESOURCES, "AFC.Company.Resource");
    // Les ressources de la Compagnie bougent souvent en jeu : modifiables dans les deux modes.
    context.resourcesEditable = context.editable;
    // Organisation : rappel de la valeur effective (avec les bonus des services).
    const org = context.resources.find(r => r.key === "organization");
    if (org && s.organization.bonus) org.hint = game.i18n.format("AFC.Company.orgEffective", { n: s.organization.effective });
    context.origins = Object.fromEntries(Object.entries(CONFIG_AFC.COMPANY_ORIGINS).map(([k, v]) => [k, v.label]));
    context.originLabel = CONFIG_AFC.COMPANY_ORIGINS[s.origin]?.label;
    context.leaderOptions = Object.fromEntries(game.actors.filter(a => a.type === "character").map(a => [a.id, a.name]));
    context.leader = s.leader ? game.actors.get(s.leader) : null;
    context.cohesionPct = Math.min(100, s.cohesionState.pct);
    context.spacePct = s.services.spaceMax ? Math.min(100, Math.round(100 * s.services.spaceUsed / s.services.spaceMax)) : 0;
    context.services = (context.items.service ?? []).map(item => ({ item, size: CONFIG_AFC.SERVICE_SIZES[item.system.size] }));
    context.units = (context.items.unit ?? []).map(item => ({
      item, training: CONFIG_AFC.UNIT_TRAININGS[item.system.training]?.label,
      classes: item.system.classList.map(c => game.i18n.localize(CONFIG_AFC.UNIT_CLASSES[c])).join(", ")
    }));
    context.unitTotals = context.units.reduce((t, u) => ({
      count: t.count + u.item.system.count, men: t.men + u.item.system.totalMen,
      manpower: t.manpower + u.item.system.totalManpower, might: t.might + u.item.system.totalMight
    }), { count: 0, men: 0, manpower: 0, might: 0 });
    context.initial = (this.document.name || "?").charAt(0).toUpperCase();
    context.members = this._prepareMembers(context, "members");
    // Bouton de création : caché une fois la Compagnie créée, sauf pour le MJ en mode édition (pour refaire).
    context.showCreate = context.editable && (!s.created || (context.editMode && game.user.isGM));
    return context;
  }

  static #onCreateCompany() {
    return runCreation(this.document);
  }

  static #onOpenCatalog() {
    return new CompanyCatalog(this.document).render(true);
  }

  static #onMonthEnd() {
    return runMonthEnd(this.document);
  }

  static #onConvert() {
    return runConversion(this.document);
  }
}
