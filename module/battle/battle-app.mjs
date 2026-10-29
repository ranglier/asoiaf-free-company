/**
 * Fenêtre Bataille : groupes des deux camps, ordres secrets, révélation, engagements (tir et mêlée
 * entre le jeton contrôlé et la cible), ralliement, fin de tour et bilan.
 */
import { SYSTEM_ID } from "../config.mjs";
import { ORDERS, TROOP_STATES, WEATHER } from "./battle-config.mjs";
import { battleReport, endTurn, orderLabel, rallyTroop, resolveMelee, resolveShoot, revealOrders } from "./engagement.mjs";
import { canOrder, clearBattle, getBattle, groupOfToken, saveBattle, setOrder } from "./state.mjs";
import { createEnemyTroop } from "./troops.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);

export class BattleApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "afc-battle",
    classes: ["afc", "afc-battle-app"],
    position: { width: 760, height: 720 },
    window: { title: "AFC.Battle.Title", icon: "fa-solid fa-chess-rook", resizable: true },
    actions: {
      setOrder: BattleApp.#onSetOrder,
      reveal: BattleApp.#onReveal,
      endTurn: BattleApp.#onEndTurn,
      report: BattleApp.#onReport,
      newGroup: BattleApp.#onNewGroup,
      deleteGroup: BattleApp.#onDeleteGroup,
      removeTroop: BattleApp.#onRemoveTroop,
      newEnemy: BattleApp.#onNewEnemy,
      melee: BattleApp.#onMelee,
      shoot: BattleApp.#onShoot,
      rally: BattleApp.#onRally,
      openTroop: BattleApp.#onOpenTroop,
      reset: BattleApp.#onReset
    }
  };

  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/apps/battle.hbs`, scrollable: [""] } };

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
    const orders = Object.fromEntries(ORDERS.map(k => [k, `AFC.Battle.Order.${k}`]));
    const groupView = group => {
      const mine = canOrder(group);
      const officer = game.actors.get(group.officer);
      const troops = group.troops.map(id => scene.tokens.get(id)).filter(t => t?.actor)
        .filter(t => isGM || group.side === "company" || !t.hidden)
        .map(t => {
          const s = t.actor.system;
          const known = isGM || s.side === "company";
          return {
            id: t.id, name: t.name, state: s.state, stateLabel: TROOP_STATES[s.state].label, known,
            cushion: s.cushion, cushionMax: s.cushionMax, disorders: s.disorders,
            rallies: s.rallies, ralliesMax: s.ralliesMax, move: s.move, range: s.range, hidden: t.hidden,
            traits: s.traits.map(k => loc(`AFC.Battle.Trait.${k}.name`)).join(", "),
            canRally: t.actor.isOwner || isGM
          };
        });
      const commandBonus = officer?.system.abilities?.warfare?.specialties
        ?.find(sp => ["commandement", "command"].includes(sp.name.trim().toLowerCase()))?.bonus ?? 0;
      return {
        ...group, troops, mine,
        officerName: officer?.name ?? loc("AFC.Battle.NoOfficer"),
        tooMany: officer && group.troops.length > 1 + commandBonus ? 1 + commandBonus : 0,
        showOrder: battle.revealed || mine,
        orderText: orderLabel(group.order),
        canSet: mine && (!battle.revealed || !group.countered),
        counterMode: battle.revealed,
        pending: !group.order
      };
    };
    const controlled = canvas.tokens.controlled[0]?.document;
    const target = [...game.user.targets][0]?.document;
    return {
      scene, battle, isGM, orders,
      company: battle.groups.filter(g => g.side === "company").map(groupView),
      enemy: battle.groups.filter(g => g.side === "enemy").map(groupView).filter(g => isGM || g.troops.length),
      weathers: Object.fromEntries(Object.keys(WEATHER).map(k => [k, `AFC.Battle.Weather.${k}`])),
      weatherLabel: `AFC.Battle.Weather.${battle.weather}`,
      controlled: controlled?.actor?.type === "troop" ? controlled.name : null,
      target: target?.actor?.type === "troop" ? target.name : null
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[name="weather"]')?.addEventListener("change", async event => {
      const battle = getBattle();
      battle.weather = event.target.value;
      await saveBattle(battle);
    });
  }

  static async #onSetOrder(event, target) {
    const select = target.closest("[data-group]").querySelector("select[name=order]");
    if (!select?.value) return;
    await setOrder(target.closest("[data-group]").dataset.group, select.value, { counter: getBattle().revealed });
    ui.notifications.info(loc("AFC.Battle.OrderSent"));
  }

  static #onReveal() { return revealOrders(); }
  static #onEndTurn() { return endTurn(); }
  static #onReport() { return battleReport(); }
  static #onNewEnemy() { return createEnemyTroop(); }

  /** Crée un groupe avec les jetons de troupes sélectionnés et un officier. */
  static async #onNewGroup() {
    const tokens = canvas.tokens.controlled.map(t => t.document).filter(t => t.actor?.type === "troop");
    if (!tokens.length) return ui.notifications.warn(loc("AFC.Battle.SelectTroops"));
    const side = tokens[0].actor.system.side;
    const officers = game.actors.filter(a => ["character", "npc"].includes(a.type));
    const data = await DialogV2.prompt({
      window: { title: loc("AFC.Battle.NewGroup") },
      classes: ["afc", "afc-dialog"],
      content: `<div class="afc-test-dialog">
        <label>${loc("AFC.Battle.GroupName")}<input type="text" name="name" value="${foundry.utils.escapeHTML(tokens.map(t => t.name).join(", "))}"></label>
        <label>${loc("AFC.Battle.Officer")}<select name="officer"><option value="">—</option>${officers.map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("")}</select></label></div>`,
      ok: { label: loc("AFC.Battle.Create"), callback: (ev, button) => ({ name: button.form.elements.name.value.trim(), officer: button.form.elements.officer.value }) },
      rejectClose: false
    });
    if (!data) return;
    const battle = getBattle();
    const ids = tokens.map(t => t.id);
    // Une troupe n'appartient qu'à un groupe.
    for (const g of battle.groups) g.troops = g.troops.filter(id => !ids.includes(id));
    battle.groups = battle.groups.filter(g => g.troops.length);
    battle.groups.push({ id: foundry.utils.randomID(), name: data.name || loc("AFC.Battle.Group"), side, officer: data.officer, troops: ids, order: "", countered: false });
    await saveBattle(battle);
  }

  static async #onDeleteGroup(event, target) {
    const battle = getBattle();
    battle.groups = battle.groups.filter(g => g.id !== target.closest("[data-group]").dataset.group);
    await saveBattle(battle);
  }

  static async #onRemoveTroop(event, target) {
    const battle = getBattle();
    const id = target.closest("[data-troop]").dataset.troop;
    const group = groupOfToken(battle, id);
    if (group) group.troops = group.troops.filter(t => t !== id);
    battle.groups = battle.groups.filter(g => g.troops.length);
    await saveBattle(battle);
  }

  /** Jeton contrôlé (attaquant ou tireur) et cible. */
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
  static #onRally(event, target) { return rallyTroop(target.closest("[data-troop]").dataset.troop); }
  static #onOpenTroop(event, target) {
    return canvas.scene.tokens.get(target.closest("[data-troop]").dataset.troop)?.actor?.sheet.render(true);
  }

  static async #onReset() {
    const ok = await DialogV2.confirm({ window: { title: loc("AFC.Battle.Reset") }, content: `<p>${loc("AFC.Battle.ResetConfirm")}</p>`, rejectClose: false });
    if (ok) await clearBattle();
  }
}
