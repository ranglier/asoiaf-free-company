/**
 * Fiche de Troupe : type, entraînement, traits, état et compteurs de bataille.
 */
import { SYSTEM_ID, UNIT_TRAININGS } from "../config.mjs";
import { rollAbilityTest } from "../dice/test-roll.mjs";
import { ACTIVE_TRAITS, mergeTraits, STATE_ORDER, TROOP_STATES, TYPE_TRAITS } from "../battle/battle-config.mjs";
import { BOOK_ABILITIES, BOOK_EQUIPMENT, BOOK_FORMATIONS, BOOK_STATUS } from "../battle/book-config.mjs";
import { prepareBookTroop } from "../battle/book.mjs";
import { isBook } from "../battle/rules.mjs";
import { isAutoIcon, setTroopImage, troopIcon, typeLabel } from "../battle/troops.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class TroopSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["afc", "sheet", "actor", "troop"],
    position: { width: 680, height: 700 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      toggleEdit: TroopSheet.#onToggleEdit,
      rollSkill: TroopSheet.#onRollSkill,
      editImage: TroopSheet.#onEditImage,
      resetImage: TroopSheet.#onResetImage,
      resetTraits: TroopSheet.#onResetTraits,
      resetBook: TroopSheet.#onResetBook
    }
  };

  static PARTS = { sheet: { template: `systems/${SYSTEM_ID}/templates/actor/troop.hbs`, scrollable: [""] } };

  static TABS = {
    primary: {
      tabs: [{ id: "abilities", label: "AFC.Tab.abilities" }, { id: "troop", label: "AFC.Tab.troop" }],
      initial: "abilities"
    }
  };

  /** Mode édition (type, compétences, traits) ou mode jeu (compteurs de bataille et jets), comme les autres fiches. */
  editMode = false;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.document.system;
    const loc = k => game.i18n.localize(k);
    const book = isBook();
    const traits = ACTIVE_TRAITS.map(k => ({ key: k, label: loc(`AFC.Battle.Trait.${k}.name`), effect: loc(`AFC.Battle.Trait.${k}.effect`), on: s.traits.includes(k) }));
    const upgrades = book ? [
      { name: "system.book.upArmor", label: "AFC.BattleBook.UpArmor", on: s.book.upArmor },
      { name: "system.book.upFight", label: "AFC.BattleBook.UpFight", on: s.book.upFight },
      { name: "system.book.upShoot", label: "AFC.BattleBook.UpShoot", on: s.book.upShoot }
    ] : ["armor", "melee", "shoot"].map(k => ({
      name: `system.upgrades.${k}`, label: `AFC.Unit.Upgrade.${k}`, effect: `AFC.Unit.Upgrade.${k}Effect`, on: s.upgrades[k]
    }));
    // Sous-titre du mode jeu : type(s), entraînement, camp.
    const types = book ? [loc(`AFC.BattleBook.Type.${s.book.type}`)] : [s.unitType, s.unitType2].filter(Boolean).map(typeLabel);
    const subtitle = [...types, loc(UNIT_TRAININGS[s.training]?.label ?? ""), loc(`AFC.Battle.Side.${s.side}`)].filter(Boolean).join(" · ");
    Object.assign(context, {
      actor: this.document, system: s, editable: this.isEditable,
      editMode: this.isEditable && this.editMode, tabs: this._prepareTabs("primary"), subtitle,
      traits, activeTraits: traits.filter(t => t.on), upgrades, hasUpgrade: upgrades.some(u => u.on),
      bookTypeLabel: `AFC.BattleBook.Type.${s.book.type}`,
      bookRangeLabel: s.book.specialRange === "close" ? "AFC.BattleBook.RangeClose" : "AFC.BattleBook.RangeLong",
      sides: { company: "AFC.Battle.Side.company", enemy: "AFC.Battle.Side.enemy" },
      trainings: Object.fromEntries(Object.entries(UNIT_TRAININGS).map(([k, v]) => [k, v.label])),
      states: Object.fromEntries(STATE_ORDER.map(k => [k, TROOP_STATES[k].label])),
      types: Object.fromEntries(Object.keys(TYPE_TRAITS).map(k => [k, typeLabel(k)]).sort((a, b) => a[1].localeCompare(b[1]))),
      bookRules: book, isSpecial: s.book.type === "special", customImage: !isAutoIcon(this.document.img),
      // Compétences triées par ordre alphabétique, comme sur les fiches de personnage.
      bookAbilities: BOOK_ABILITIES.map(k => ({ key: k, name: loc(`AFC.Ability.${k}`), value: s.book.abilities[k] }))
        .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang)),
      bookRanges: { close: "AFC.BattleBook.RangeClose", long: "AFC.BattleBook.RangeLong" },
      bookTypes: Object.fromEntries(Object.keys(BOOK_EQUIPMENT).map(k => [k, `AFC.BattleBook.Type.${k}`])),
      bookStatuses: Object.fromEntries(BOOK_STATUS.map(k => [k, `AFC.BattleBook.Status.${k}`])),
      bookFormations: Object.fromEntries(Object.keys(BOOK_FORMATIONS).map(k => [k, `AFC.BattleBook.Formation.${k}`]))
    });
    return context;
  }

  /** Cases à cocher des traits -> liste. */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    // Armure améliorée cochée ou décochée : la réserve d'encaissement suit.
    const armor = foundry.utils.getProperty(data, "system.upgrades.armor");
    const s = this.document.system;
    if (armor !== undefined && armor !== s.upgrades.armor) foundry.utils.setProperty(data, "system.cushion", Math.max(0, s.cushion + (armor ? 1 : -1)));
    // Règles du livre : la fiche n'affiche pas les traits, on n'y touche pas.
    if (!form.elements[`trait.${ACTIVE_TRAITS[0]}`]) return data;
    const traits = ACTIVE_TRAITS.filter(k => form.elements[`trait.${k}`]?.checked);
    for (const k of ACTIVE_TRAITS) delete data[`trait.${k}`];
    delete data.trait;
    foundry.utils.setProperty(data, "system.traits", traits);
    return data;
  }

  static #onToggleEdit() {
    this.editMode = !this.editMode;
    return this.render();
  }

  /** Clic : test rapide ; Maj + clic : dialogue complet. */
  static #onRollSkill(event, target) {
    return rollAbilityTest(this.document, target.dataset.ability, { quick: !event.shiftKey });
  }

  /** Règles du livre : compétences et équipement recalculés depuis le type et l'entraînement. */
  static #onResetBook() { return prepareBookTroop(this.document, { force: true }); }

  static #onEditImage() {
    if (!this.isEditable) return;
    if (!game.user.can("FILES_BROWSE")) return ui.notifications.warn(game.i18n.localize("AFC.Battle.NoBrowse"));
    const FP = foundry.applications.apps.FilePicker.implementation;
    return new FP({ type: "image", current: this.document.img, callback: path => setTroopImage(this.document, path) }).browse();
  }

  /** Retour au symbole du type et du camp. */
  static #onResetImage() {
    return setTroopImage(this.document, troopIcon(this.document.system.unitType, this.document.system.side));
  }

  /** Traits par défaut du type d'unité. */
  static #onResetTraits() {
    const s = this.document.system;
    return this.document.update({ "system.traits": mergeTraits([s.unitType, s.unitType2]) });
  }
}
