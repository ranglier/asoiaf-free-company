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
    position: { width: 640, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      toggleEdit: TroopSheet.#onToggleEdit,
      setState: TroopSheet.#onSetState,
      setPip: TroopSheet.#onSetPip,
      rollSkill: TroopSheet.#onRollSkill,
      editImage: TroopSheet.#onEditImage,
      resetImage: TroopSheet.#onResetImage,
      resetTraits: TroopSheet.#onResetTraits,
      resetBook: TroopSheet.#onResetBook
    }
  };

  static PARTS = { sheet: { template: `systems/${SYSTEM_ID}/templates/actor/troop.hbs`, scrollable: [""] } };

  /** Mode édition (type, compétences, traits) ou mode jeu (compteurs de bataille et jets), comme les autres fiches. */
  editMode = false;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.document.system;
    const loc = k => game.i18n.localize(k);
    const book = isBook();
    const men = n => game.i18n.format("AFC.Battle.MenCount", { n });
    const pips = (value, max) => Array.from({ length: max }, (_, i) => ({ n: i + 1, on: i < value }));
    const passive = { label: "AFC.Character.passiveAwareness", value: s.passive.awareness, hint: "AFC.Character.passiveAwarenessHint" };
    const discipline = { label: book ? "AFC.BattleBook.Discipline" : "AFC.Battle.Discipline", value: s.discipline, raw: s.discipline, input: "system.discipline" };
    // Ligne de profil : ce qu'on regarde pendant la bataille.
    const profile = book ? [
      { label: "AFC.BattleBook.Defense", value: s.book.defense },
      { label: "AFC.BattleBook.ArmorRating", value: s.book.ar },
      { label: "AFC.BattleBook.FightDamage", value: s.book.fightDamage },
      { label: "AFC.BattleBook.ShootDamage", value: s.book.shoot?.damage ?? "—" },
      { label: "AFC.BattleBook.MoveYards", value: s.book.moveYards },
      discipline, passive
    ] : [
      { label: "AFC.Ability.fighting", value: `${s.melee}D`, roll: "fighting" },
      { label: `AFC.Ability.${s.shootSkill}`, value: s.range ? `${s.shootRank}D` : "—", roll: s.range ? s.shootSkill : null },
      discipline,
      { label: "AFC.Battle.Move", value: s.move },
      { label: "AFC.Battle.Range", value: s.range || "—" },
      passive
    ];
    // Échelle d'état et compteurs.
    const current = book ? s.book.status : s.state;
    const order = book ? BOOK_STATUS : STATE_ORDER;
    const states = order.map((k, i) => ({
      key: k, label: book ? `AFC.BattleBook.Status.${k}` : TROOP_STATES[k].label, on: k === current, past: i < order.indexOf(current)
    }));
    const counters = book ? [
      { label: "AFC.BattleBook.Health", text: `${s.book.healthLeft} / ${s.book.health}` },
      { label: "AFC.BattleBook.DamageTaken", input: "system.book.damage", raw: s.book.damage },
      { label: "AFC.BattleBook.Penalties", path: "system.book.penalties", pips: pips(s.book.penalties, Math.max(3, s.book.penalties + 1)) },
      { label: "AFC.Battle.Men", input: "system.men", raw: s.men }
    ] : [
      { label: "AFC.Battle.Cushion", path: "system.cushion", pips: pips(s.cushion, Math.max(s.cushionMax, s.cushion)) },
      { label: "AFC.Battle.Rallies", path: "system.rallies", pips: pips(s.rallies, Math.max(s.ralliesMax, s.rallies)) },
      { label: "AFC.Battle.Disorders", path: "system.disorders", pips: pips(s.disorders, Math.max(3, s.disorders + 1)) },
      { label: "AFC.Battle.Men", input: "system.men", raw: s.men },
      { label: "AFC.Battle.Loss", text: `${s.loss} % (${men(s.lostMen)})` }
    ];
    // Compétences hors de la ligne de profil.
    const inProfile = book ? [] : ["fighting", s.range ? s.shootSkill : null];
    const traits = ACTIVE_TRAITS.map(k => ({ key: k, label: loc(`AFC.Battle.Trait.${k}.name`), effect: loc(`AFC.Battle.Trait.${k}.effect`), on: s.traits.includes(k) }));
    const upgrades = book ? [
      { name: "system.book.upArmor", label: "AFC.BattleBook.UpArmor", on: s.book.upArmor },
      { name: "system.book.upFight", label: "AFC.BattleBook.UpFight", on: s.book.upFight },
      { name: "system.book.upShoot", label: "AFC.BattleBook.UpShoot", on: s.book.upShoot }
    ] : ["armor", "melee", "shoot"].map(k => ({
      name: `system.upgrades.${k}`, label: `AFC.Unit.Upgrade.${k}`, effect: `AFC.Unit.Upgrade.${k}Effect`, on: s.upgrades[k]
    }));
    // Sous-titre du mode jeu : type(s), entraînement, camp, hommes.
    const types = book ? [loc(`AFC.BattleBook.Type.${s.book.type}`)] : [s.unitType, s.unitType2].filter(Boolean).map(typeLabel);
    const subtitle = [...types, loc(UNIT_TRAININGS[s.training]?.label ?? ""), loc(`AFC.Battle.Side.${s.side}`), men(s.men)].filter(Boolean).join(" · ");
    // Compétences triées par ordre alphabétique, comme sur les fiches de personnage.
    const bookAbilities = BOOK_ABILITIES.map(k => ({ key: k, name: loc(`AFC.Ability.${k}`), value: s.book.abilities[k] }))
      .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    Object.assign(context, {
      actor: this.document, system: s, editable: this.isEditable,
      editMode: this.isEditable && this.editMode, subtitle, profile, states, counters,
      stateLabel: book ? "AFC.BattleBook.StatusLabel" : "AFC.Battle.StateLabel",
      traits, activeTraits: traits.filter(t => t.on), upgrades,
      sides: { company: "AFC.Battle.Side.company", enemy: "AFC.Battle.Side.enemy" },
      trainings: Object.fromEntries(Object.entries(UNIT_TRAININGS).map(([k, v]) => [k, v.label])),
      types: Object.fromEntries(Object.keys(TYPE_TRAITS).map(k => [k, typeLabel(k)]).sort((a, b) => a[1].localeCompare(b[1]))),
      bookRules: book, isSpecial: s.book.type === "special", customImage: !isAutoIcon(this.document.img),
      bookAbilities, otherAbilities: bookAbilities.filter(a => !inProfile.includes(a.key)),
      bookRanges: { close: "AFC.BattleBook.RangeClose", long: "AFC.BattleBook.RangeLong" },
      bookTypes: Object.fromEntries(Object.keys(BOOK_EQUIPMENT).map(k => [k, `AFC.BattleBook.Type.${k}`])),
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

  /** Clic sur l'échelle : état (règles maison) ou statut (livre). */
  static #onSetState(event, target) {
    if (!this.isEditable) return;
    return this.document.update({ [isBook() ? "system.book.status" : "system.state"]: target.dataset.state });
  }

  /** Clic sur une pastille : fixe la valeur (re-clic sur la dernière pastille = la retire). */
  static #onSetPip(event, target) {
    if (!this.isEditable) return;
    const path = target.dataset.path;
    const n = Number(target.dataset.n);
    return this.document.update({ [path]: foundry.utils.getProperty(this.document, path) === n ? n - 1 : n });
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
