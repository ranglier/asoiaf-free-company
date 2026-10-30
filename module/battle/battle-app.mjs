/**
 * Fenêtre Bataille : une fiche compacte par troupe (état, ordre, cible, officier), l'aide-mémoire,
 * et pour le MJ la conduite du tour (révélation, engagements prévus résolus en un clic, fin de tour).
 */
import { SYSTEM_ID } from "../config.mjs";
import { ORDERS, TRIANGLE, TROOP_STATES, WEATHER } from "./battle-config.mjs";
import { bookContext, bookReport, chooseCommanders, freeAttack, giveBookOrder, nextStep, resetBook, switchRules } from "./book.mjs";
import { battleRules, isBook, RULES } from "./rules.mjs";
import { battleReport, endTurn, orderLabel, plannedEngagements, rallyTroop, resolveMelee, resolvePlanned, resolveShoot, revealOrders } from "./engagement.mjs";
import { chooseOfficer, giveOrder, ORDER_ICONS, orderVisible, startTargetPick, TARGETED_ORDERS } from "./map.mjs";
import { canCommand, clearBattle, getBattle, saveBattle, setUnit, unitOf } from "./state.mjs";
import { createEnemyTroop } from "./troops.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);
const COMMAND = ["commandement", "command"];

export class BattleApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "afc-battle",
    classes: ["afc", "afc-battle-app"],
    position: { width: 820, height: 760 },
    window: { title: "AFC.Battle.Title", icon: "fa-solid fa-chess-rook", resizable: true },
    actions: {
      reveal: BattleApp.#onReveal,
      endTurn: BattleApp.#onEndTurn,
      report: BattleApp.#onReport,
      newEnemy: BattleApp.#onNewEnemy,
      reset: BattleApp.#onReset,
      melee: BattleApp.#onMelee,
      shoot: BattleApp.#onShoot,
      resolvePlan: BattleApp.#onResolvePlan,
      pickTarget: BattleApp.#onPickTarget,
      clearTarget: BattleApp.#onClearTarget,
      officer: BattleApp.#onOfficer,
      rally: BattleApp.#onRally,
      focus: BattleApp.#onFocus,
      openTroop: BattleApp.#onOpenTroop,
      bookNext: BattleApp.#onBookNext,
      bookCommanders: BattleApp.#onBookCommanders,
      bookFree: BattleApp.#onBookFree
    }
  };

  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/apps/battle.hbs`, scrollable: [".battle-scroll"] } };

  /** Ouvre (ou ramène au premier plan) la fenêtre unique. */
  static open() {
    const app = foundry.applications.instances.get("afc-battle") ?? new BattleApp();
    return app.render({ force: true });
  }

  /** Redessine la fenêtre si elle est ouverte. */
  static refresh() {
    const app = foundry.applications.instances.get("afc-battle");
    if (app?.rendered) app.render();
  }

  async _prepareContext() {
    const scene = canvas.scene;
    const battle = getBattle();
    const isGM = game.user.isGM;
    const tokens = scene?.tokens.filter(t => t.actor?.type === "troop") ?? [];
    // Charge des officiers : 1 + dés de bonus en Commandement.
    const officerLoad = {};
    for (const u of battle.units) if (u.officer) officerLoad[u.officer] = (officerLoad[u.officer] ?? 0) + 1;
    const commandMax = id => {
      const w = game.actors.get(id)?.system.abilities?.warfare;
      return 1 + (w?.specialties?.find(s => COMMAND.includes(s.name.trim().toLowerCase()))?.bonus ?? 0);
    };

    const troopView = token => {
      const s = token.actor.system;
      const unit = unitOf(battle, token.id);
      const mine = canCommand(token, battle);
      const visible = orderVisible(token, battle);
      const target = unit.target ? scene.tokens.get(unit.target) : null;
      const officer = unit.officer ? game.actors.get(unit.officer) : null;
      const known = isGM || s.side === "company";
      return {
        id: token.id, name: token.name, img: token.texture.src, hidden: token.hidden, side: s.side,
        state: s.state, stateLabel: TROOP_STATES[s.state].label, known, mine,
        order: unit.order, orderText: orderLabel(unit.order),
        orderOptions: ORDERS.map(k => ({ key: k, label: loc(`AFC.Battle.Order.${k}`), selected: k === unit.order })), orderIcon: ORDER_ICONS[unit.order] ?? "fa-flag",
        // Avant la révélation, un joueur ne sait même pas si l'ennemi a reçu un ordre.
        showOrder: visible && !!unit.order, secret: !visible && !!unit.order && (isGM || s.side === "company"),
        canSet: mine && !(battle.revealed && unit.countered && !isGM),
        countered: unit.countered,
        targeted: TARGETED_ORDERS.includes(unit.order),
        targetName: target && (isGM || !target.hidden) ? target.name : null,
        officerName: officer?.name ?? null,
        overload: officer && officerLoad[unit.officer] > commandMax(unit.officer) ? commandMax(unit.officer) : 0,
        cushion: s.cushion, cushionMax: s.cushionMax, disorders: s.disorders, rallies: s.rallies, ralliesMax: s.ralliesMax,
        move: s.move, range: s.range, rank: s.rank,
        traits: s.traits.map(k => ({ name: loc(`AFC.Battle.Trait.${k}.name`), effect: loc(`AFC.Battle.Trait.${k}.effect`) })),
        canRally: mine && !["fresh", "destroyed"].includes(s.state)
      };
    };
    const book = !!scene && isBook(scene);
    const side = key => (book ? [] : tokens).filter(t => t.actor.system.side === key && (isGM || key === "company" || !t.hidden)).map(troopView);

    const controlled = canvas.tokens.controlled[0]?.document;
    const targeted = [...game.user.targets][0]?.document;
    const plans = isGM && !book ? plannedEngagements(battle, scene) : [];

    return {
      battle, isGM, hasScene: !!scene, book,
      rules: scene ? battleRules(scene) : "house", rulesLabel: `AFC.Battle.Rules.${scene ? battleRules(scene) : "house"}`, settingsOpen: this.settingsOpen,
      ruleOptions: Object.fromEntries(RULES.map(k => [k, `AFC.Battle.Rules.${k}`])),
      orders: ORDERS.map(k => ({ key: k, label: loc(`AFC.Battle.Order.${k}`), icon: ORDER_ICONS[k], help: loc(`AFC.Battle.OrderHelp.${k}`) })),
      triangle: Object.entries(TRIANGLE).map(([a, b]) => ({ a: orderLabel(a), b: orderLabel(b) })),
      company: side("company"), enemy: side("enemy"),
      weathers: Object.fromEntries(Object.keys(WEATHER).map(k => [k, `AFC.Battle.Weather.${k}`])),
      weatherLabel: `AFC.Battle.Weather.${battle.weather}`,
      plans,
      controlled: controlled?.actor?.type === "troop" ? controlled.name : null,
      target: targeted?.actor?.type === "troop" ? targeted.name : null,
      ...(book ? bookContext(battle, scene, { orderLabel }) : {})
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[name="weather"]')?.addEventListener("change", async event => {
      const battle = getBattle();
      battle.weather = event.target.value;
      await saveBattle(battle);
    });
    // Choix d'un ordre dans une fiche de troupe (enchaîne sur la cible pour un ordre offensif).
    this.element.querySelectorAll("select[data-order]").forEach(select => select.addEventListener("change", event => {
      const token = canvas.scene.tokens.get(event.target.closest("[data-troop]").dataset.troop);
      if (token && event.target.value) giveOrder(token, event.target.value);
    }));
    // Paramètres : restent ouverts d'un affichage à l'autre ; annuler le changement de règles remet le choix en place.
    this.element.querySelector(".battle-settings")?.addEventListener("toggle", event => { this.settingsOpen = event.target.open; });
    this.element.querySelector('[name="battleRules"]')?.addEventListener("change", async event => {
      await switchRules(event.target.value);
      this.render();
    });
    // Règles du livre : ordre choisi dans la fiche, options de la bataille.
    this.element.querySelectorAll("select[data-book-order]").forEach(select => select.addEventListener("change", event => {
      const token = canvas.scene.tokens.get(event.target.closest("[data-troop]").dataset.troop);
      if (token && event.target.value) giveBookOrder(token, event.target.value);
    }));
    const option = (name, read) => this.element.querySelector(`[name="${name}"]`)?.addEventListener("change", async event => {
      const battle = getBattle();
      battle.book = { ...battle.book, ...read(event.target) };
      await saveBattle(battle);
    });
    option("bookYards", el => ({ yards: Math.max(1, Number(el.value) || 10) }));
    option("bookAdvanced", el => ({ advanced: el.checked }));
    option("bookFormations", el => ({ formations: el.checked }));
  }

  static #token(target) {
    return canvas.scene.tokens.get(target.closest("[data-troop]")?.dataset.troop);
  }

  static #onReveal() { return revealOrders(); }
  static #onEndTurn() { return endTurn(); }
  static #onReport() { return isBook() ? bookReport() : battleReport(); }
  static #onNewEnemy() { return createEnemyTroop(); }
  static #onPickTarget(event, target) { const t = BattleApp.#token(target); if (t) startTargetPick(t); }
  static #onClearTarget(event, target) { const t = BattleApp.#token(target); if (t) setUnit(t.id, { target: "" }); }
  static #onOfficer(event, target) { const t = BattleApp.#token(target); if (t) chooseOfficer(t); }
  static #onRally(event, target) { const t = BattleApp.#token(target); if (t) rallyTroop(t.id); }
  static #onOpenTroop(event, target) { BattleApp.#token(target)?.actor?.sheet.render(true); }

  /** Centre la vue sur la troupe et la sélectionne. */
  static #onFocus(event, target) {
    const token = BattleApp.#token(target)?.object;
    if (!token) return;
    canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 });
    if (token.isOwner) token.control({ releaseOthers: true });
  }

  /** Jeton contrôlé (qui agit) et cible : engagement libre. */
  static #pair() {
    const a = canvas.tokens.controlled[0]?.document;
    const d = [...game.user.targets][0]?.document;
    if (a?.actor?.type !== "troop" || d?.actor?.type !== "troop") {
      ui.notifications.warn(loc("AFC.Battle.SelectPair"));
      return null;
    }
    return [a, d];
  }
  static #onMelee() { const p = BattleApp.#pair(); return p && resolveMelee(...p); }
  static #onShoot() { const p = BattleApp.#pair(); return p && resolveShoot(...p); }

  /** Engagement prévu : tir si l'ordre est Tirer, sinon mêlée. */
  static #onResolvePlan(event, target) {
    const { from, to, shoot } = target.dataset;
    return resolvePlanned({ from, to, shoot: shoot === "true" });
  }

  static #onBookNext() { return nextStep(); }
  static #onBookCommanders() { return chooseCommanders(); }
  static #onBookFree() { const p = BattleApp.#pair(); return p && freeAttack(...p); }

  static async #onReset() {
    const ok = await DialogV2.confirm({ window: { title: loc("AFC.Battle.Reset") }, content: `<p>${loc("AFC.Battle.ResetConfirm")}</p>`, rejectClose: false });
    if (!ok) return;
    if (isBook()) return resetBook();
    const rules = getBattle().rules;
    await clearBattle();
    if (rules) await canvas.scene.setFlag(SYSTEM_ID, "battle", { rules });
  }
}
