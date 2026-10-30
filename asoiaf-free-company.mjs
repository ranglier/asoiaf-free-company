/**
 * ASOIAF Free Company : point d'entrée du système.
 */
import * as AFC from "./module/config.mjs";
import CharacterData from "./module/data/actor-character.mjs";
import NpcData from "./module/data/actor-npc.mjs";
import HouseData from "./module/data/actor-house.mjs";
import CompanyData from "./module/data/actor-company.mjs";
import TroopData from "./module/data/actor-troop.mjs";
import { ArmorData, BloodData, HoldingData, QualityData, ServiceData, UnitData, WeaponData } from "./module/data/items.mjs";
import { CharacterSheet, CompanySheet, HouseSheet, NpcSheet } from "./module/sheets/actor-sheets.mjs";
import { AFCItemSheet } from "./module/sheets/item-sheet.mjs";
import { TroopSheet } from "./module/sheets/troop-sheet.mjs";
import { BattleApp } from "./module/battle/battle-app.mjs";
import { onRenderBattleCard } from "./module/battle/engagement.mjs";
import { migrateBattle, registerBattleSocket } from "./module/battle/state.mjs";
import { renderBattleBar } from "./module/battle/bar.mjs";
import { cancelTargetPick, drawPlanArrows, drawTroopMarks, onRenderTokenHUD, refreshOrderBadges, scheduleArrows } from "./module/battle/map.mjs";
import { refreshTroopImage, registerTroopStatuses, syncTroopStatus } from "./module/battle/troops.mjs";
import { evaluateTest, rollAbilityTest, rollTest } from "./module/dice/test-roll.mjs";
import { onRenderChatMessage, resolveDamage, rollAttack } from "./module/dice/attack.mjs";
import { registerSettings } from "./module/settings.mjs";
import { runCreation } from "./module/creation.mjs";

Hooks.once("init", () => {
  CONFIG.AFC = AFC;
  game.afc = { rollAbilityTest, rollTest, evaluateTest, rollAttack, resolveDamage, runCreation, openBattle: () => BattleApp.open() };
  registerTroopStatuses();
  registerSettings();

  Object.assign(CONFIG.Actor.dataModels, {
    character: CharacterData,
    npc: NpcData,
    house: HouseData,
    company: CompanyData,
    troop: TroopData
  });
  Object.assign(CONFIG.Item.dataModels, {
    weapon: WeaponData,
    armor: ArmorData,
    quality: QualityData,
    blood: BloodData,
    service: ServiceData,
    holding: HoldingData,
    unit: UnitData
  });

  const { DocumentSheetConfig } = foundry.applications.apps;
  const sheets = { character: CharacterSheet, npc: NpcSheet, house: HouseSheet, company: CompanySheet, troop: TroopSheet };
  for (const [type, cls] of Object.entries(sheets)) {
    DocumentSheetConfig.registerSheet(Actor, AFC.SYSTEM_ID, cls, {
      types: [type], makeDefault: true, label: `AFC.Sheet.${type}`
    });
  }
  DocumentSheetConfig.registerSheet(Item, AFC.SYSTEM_ID, AFCItemSheet, { makeDefault: true, label: "AFC.Sheet.item" });

  return foundry.applications.handlebars.loadTemplates([
    ...["abilities", "vitals", "tabs-nav", "weapons", "armor", "qualities", "mode-toggle", "resources", "members", "events"]
      .map(p => `systems/${AFC.SYSTEM_ID}/templates/actor/parts/${p}.hbs`),
    `systems/${AFC.SYSTEM_ID}/templates/apps/battle-troop.hbs`
  ]);
});

Hooks.on("renderChatMessageHTML", onRenderChatMessage);

/**
 * Fenêtre détachée (bouton « Détacher ») : Foundry garde la taille fixe de l'application, même si
 * la fenêtre du navigateur est agrandie. Nos fenêtres (fiches, dialogues, catalogues) occupent
 * alors tout l'espace : classe afc-fill, appliquée seulement dans une fenêtre détachée (voir CSS).
 */
Hooks.on("openDetachedWindow", (id, win) => {
  const fit = () => win.document.getElementById(id)?.classList.toggle("afc-fill", win.document.getElementById(id).classList.contains("afc"));
  new win.MutationObserver(fit).observe(win.document.body, { childList: true });
  win.addEventListener("resize", fit);
});

/* ---------- Bataille ---------- */

Hooks.once("ready", registerBattleSocket);
Hooks.on("renderChatMessageHTML", onRenderBattleCard);

/** Bouton « Bataille » dans les outils des jetons. */
Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls.tokens ?? controls.token;
  if (!tokens?.tools) return;
  tokens.tools.afcBattle = {
    name: "afcBattle", title: "AFC.Battle.Title", tooltip: "AFC.Battle.Title", icon: "fa-solid fa-chess-rook", order: 99,
    button: true, visible: true, onChange: () => BattleApp.open()
  };
});

/** La fenêtre Bataille et les pastilles d'ordre suivent la scène, les troupes, la sélection et les cibles. */
Hooks.on("updateScene", (scene, changes) => {
  if (scene.id !== canvas.scene?.id || !foundry.utils.hasProperty(changes, `flags.${AFC.SYSTEM_ID}`)) return;
  BattleApp.refresh();
  refreshOrderBadges();
  drawPlanArrows();
  renderBattleBar();
});
Hooks.on("canvasReady", () => {
  migrateBattle();
  BattleApp.refresh();
  refreshOrderBadges();
  drawPlanArrows();
  renderBattleBar();
});
// Les flèches suivent les jetons image par image (déplacements animés), et leur visibilité.
Hooks.on("refreshToken", (token, flags) => {
  if (flags.refreshPosition || flags.refreshVisibility) scheduleArrows();
});
for (const hook of ["createToken", "deleteToken"]) {
  Hooks.on(hook, () => {
    scheduleArrows();
    renderBattleBar();
  });
}
Hooks.on("canvasTearDown", () => cancelTargetPick());
Hooks.on("drawToken", token => drawTroopMarks(token));
Hooks.on("renderTokenHUD", onRenderTokenHUD);
Hooks.on("controlToken", () => BattleApp.refresh());
Hooks.on("targetToken", () => BattleApp.refresh());
Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (actor.type !== "troop") return;
  BattleApp.refresh();
  renderBattleBar();
  // Ordre ou cible changés (drapeau de la troupe) : pastilles et flèches.
  if (foundry.utils.hasProperty(changes, `flags.${AFC.SYSTEM_ID}`)) {
    refreshOrderBadges();
    scheduleArrows();
  }
  // Icônes d'état du jeton, posées par le client qui a fait la modification.
  // État : marqueur au centre du jeton (et retrait des anciennes icônes d'état de Foundry).
  if (foundry.utils.hasProperty(changes, "system.state")) for (const t of actor.getActiveTokens()) drawTroopMarks(t);
  if (userId === game.user.id && foundry.utils.hasProperty(changes, "system.state")) syncTroopStatus(actor);
  // Symbole du jeton : suit le type et le camp.
  if (userId === game.user.id && (foundry.utils.hasProperty(changes, "system.side") || foundry.utils.hasProperty(changes, "system.unitType"))) refreshTroopImage(actor);
});
