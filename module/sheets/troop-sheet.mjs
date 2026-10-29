/**
 * Fiche de Troupe : type, entraînement, traits, état et compteurs de bataille.
 */
import { SYSTEM_ID, UNIT_TRAININGS } from "../config.mjs";
import { STATE_ORDER, TRAITS, TROOP_STATES, TYPE_TRAITS } from "../battle/battle-config.mjs";
import { typeLabel } from "../battle/troops.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class TroopSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["afc", "sheet", "actor", "troop"],
    position: { width: 520, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      editImage: TroopSheet.#onEditImage,
      resetTraits: TroopSheet.#onResetTraits
    }
  };

  static PARTS = { sheet: { template: `systems/${SYSTEM_ID}/templates/actor/troop.hbs`, scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.document.system;
    const loc = k => game.i18n.localize(k);
    Object.assign(context, {
      actor: this.document, system: s, editable: this.isEditable,
      sides: { company: "AFC.Battle.Side.company", enemy: "AFC.Battle.Side.enemy" },
      trainings: Object.fromEntries(Object.entries(UNIT_TRAININGS).map(([k, v]) => [k, v.label])),
      states: Object.fromEntries(STATE_ORDER.map(k => [k, TROOP_STATES[k].label])),
      types: Object.fromEntries(Object.keys(TYPE_TRAITS).map(k => [k, typeLabel(k)]).sort((a, b) => a[1].localeCompare(b[1]))),
      traits: TRAITS.map(k => ({ key: k, label: loc(`AFC.Battle.Trait.${k}.name`), effect: loc(`AFC.Battle.Trait.${k}.effect`), on: s.traits.includes(k) }))
    });
    return context;
  }

  /** Cases à cocher des traits -> liste. */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const traits = TRAITS.filter(k => form.elements[`trait.${k}`]?.checked);
    for (const k of TRAITS) delete data[`trait.${k}`];
    delete data.trait;
    foundry.utils.setProperty(data, "system.traits", traits);
    return data;
  }

  static #onEditImage() {
    const FP = foundry.applications.apps.FilePicker.implementation;
    return new FP({ type: "image", current: this.document.img, callback: path => this.document.update({ img: path }) }).browse();
  }

  /** Traits par défaut du type d'unité. */
  static #onResetTraits() {
    return this.document.update({ "system.traits": TYPE_TRAITS[this.document.system.unitType] ?? [] });
  }
}
