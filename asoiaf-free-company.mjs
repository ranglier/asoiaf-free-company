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
import { prepareBookTroop } from "./module/battle/book.mjs";
import { isBook } from "./module/battle/rules.mjs";
import { TerrainPainter } from "./module/battle/terrain.mjs";
import { keepRemovedTroop, onRenderBattleCard } from "./module/battle/engagement.mjs";
import { migrateBattle, registerBattleSocket } from "./module/battle/state.mjs";
import { renderBattleBar } from "./module/battle/bar.mjs";
import { cancelMovePick } from "./module/battle/moves.mjs";
import { getBattle } from "./module/battle/state.mjs";
import { cancelTargetPick, drawHexNumbers, drawPlanArrows, drawRegionLabels, drawTroopMarks, onRenderTokenHUD, refreshOrderBadges, scheduleArrows } from "./module/battle/map.mjs";
import { refreshTroopImage, registerTroopStatuses, syncTroopStatus } from "./module/battle/troops.mjs";
import { drawFog, invalidateFog, markActed, onPreUpdateToken, scheduleFog, unknownToMe } from "./module/battle/vision.mjs";
import { evaluateTest, rollAbilityTest, rollTest } from "./module/dice/test-roll.mjs";
import { onRenderChatMessage, resolveDamage, rollAttack } from "./module/dice/attack.mjs";
import { registerSettings } from "./module/settings.mjs";
import { runCreation } from "./module/creation.mjs";
import { AFCCombatant } from "./module/dice/initiative.mjs";

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
  // Initiative : test d'Agilité (Vivacité), pour le Combat Tracker et le carrousel de combat.
  CONFIG.Combatant.documentClass = AFCCombatant;
  CONFIG.Combat.initiative = { formula: "2d6kh2", decimals: 1 };

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
    `systems/${AFC.SYSTEM_ID}/templates/apps/battle-troop.hbs`,
    `systems/${AFC.SYSTEM_ID}/templates/apps/battle-book.hbs`,
    `systems/${AFC.SYSTEM_ID}/templates/apps/battle-settings.hbs`,
    `systems/${AFC.SYSTEM_ID}/templates/apps/battle-book-troop.hbs`
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
  scheduleFog();
  BattleApp.refresh();
  drawHexNumbers();
  refreshOrderBadges();
  drawPlanArrows();
  renderBattleBar();
});
Hooks.on("canvasReady", () => {
  // Compétences des troupes posées avant leur introduction, ou calculées autrement.
  if (game.users.activeGM === game.user) for (const t of canvas.scene?.tokens ?? []) if (t.actor?.type === "troop") prepareBookTroop(t.actor);
  // Foundry fait contrôler à un joueur sans jeton de personnage sur la scène tous les jetons qu'il possède :
  // sur une carte de bataille, toutes ses troupes se retrouvent sélectionnées. On les relâche.
  if (!game.user.isGM) {
    const controlled = canvas.tokens.controlled;
    const ownedTroops = canvas.tokens.placeables.filter(t => t.actor?.type === "troop" && t.isOwner);
    if (controlled.length > 1 && controlled.every(t => t.actor?.type === "troop") && controlled.length === ownedTroops.length) canvas.tokens.releaseAll();
  }
  TerrainPainter.refresh();
  migrateBattle();
  invalidateFog();
  scheduleFog();
  drawHexNumbers();
  BattleApp.refresh();
  refreshOrderBadges();
  drawPlanArrows();
  drawRegionLabels();
  renderBattleBar();
});
// Noms sur la carte et légende : suivent les régions (un passage découvert apparaît aussitôt).
for (const hook of ["createRegion", "updateRegion", "deleteRegion"]) {
  Hooks.on(hook, () => {
    TerrainPainter.refresh();
    drawRegionLabels();
    renderBattleBar();
    invalidateFog();
    scheduleFog();
  });
}
// Les flèches suivent les jetons image par image (déplacements animés), et leur visibilité.
Hooks.on("refreshToken", (token, flags) => {
  if (flags.refreshPosition || flags.refreshVisibility) scheduleArrows();
  // Troupe inconnue (brouillard) : ni nom ni infobulle pour un joueur.
  if (unknownToMe(token.document)) {
    if (token.nameplate) token.nameplate.visible = false;
    if (token.tooltip) token.tooltip.visible = false;
  }
});
for (const hook of ["createToken", "deleteToken"]) {
  Hooks.on(hook, doc => {
    // Une troupe posée reçoit ses compétences et son équipement.
    if (hook === "createToken" && game.users.activeGM === game.user && doc.actor?.type === "troop") prepareBookTroop(doc.actor);
    if (doc.actor?.type === "troop") scheduleFog();
    scheduleArrows();
    drawRegionLabels();
    renderBattleBar();
  });
}
// Troupe touchée retirée de la carte : ses pertes restent au bilan.
Hooks.on("preDeleteToken", (doc, options, userId) => { if (userId === game.user.id) keepRemovedTroop(doc); });
Hooks.on("canvasTearDown", () => { cancelTargetPick(); cancelMovePick(); });
// Règles maison : pendant les ordres, un joueur ne déplace pas ses jetons (ils bougent à la révélation), sauf au déploiement.
Hooks.on("preUpdateToken", (doc, changes) => {
  if (game.user.isGM || doc.actor?.type !== "troop" || !("x" in changes || "y" in changes) || isBook(doc.parent)) return;
  const battle = getBattle(doc.parent);
  if (battle.revealed || battle.freeMove) return;
  ui.notifications.warn(game.i18n.localize("AFC.Battle.Moves.Locked"));
  return false;
});
// Brouillard : un jeton ennemi caché ou montré à la main par le MJ sort du brouillard.
Hooks.on("preUpdateToken", onPreUpdateToken);
// Une troupe déplacée peut ouvrir ou fermer un engagement ; une image changée redessine ses marques.
Hooks.on("updateToken", (doc, changes, options, userId) => {
  if (doc.object && "texture" in changes) drawTroopMarks(doc.object);
  // Ordre ou cible changés (drapeau du jeton) : fenêtre, barre, pastilles et flèches.
  if (doc.actor?.type === "troop" && foundry.utils.hasProperty(changes, `flags.${AFC.SYSTEM_ID}`) && doc.parent?.id === canvas.scene?.id) {
    BattleApp.refresh();
    renderBattleBar();
    refreshOrderBadges();
    scheduleArrows();
  }
  // Brouillard : une troupe déplacée, cachée ou montrée change ce qu'on voit ; un ennemi qui bouge après la révélation a agi.
  const moved = "x" in changes || "y" in changes;
  if (doc.actor?.type === "troop" && doc.parent?.id === canvas.scene?.id && (moved || "hidden" in changes || foundry.utils.hasProperty(changes, `flags.${AFC.SYSTEM_ID}.fog`))) scheduleFog();
  if (moved && userId === game.user.id && doc.actor?.type === "troop" && getBattle(doc.parent).revealed) markActed(doc);
  if (doc.actor?.type !== "troop" || !moved) return;
  BattleApp.refresh();
  renderBattleBar();
  scheduleArrows();
});
Hooks.on("drawToken", token => drawTroopMarks(token));
Hooks.on("renderTokenHUD", onRenderTokenHUD);
// Personnage joueur : jeton lié à la fiche par défaut (les dégâts vont au personnage, pas à une copie).
Hooks.on("preCreateActor", (actor, data) => {
  if (actor.type === "character" && foundry.utils.getProperty(data, "prototypeToken.actorLink") === undefined) actor.updateSource({ "prototypeToken.actorLink": true });
});
// Endurance changée : la Santé gagne (ou perd) la différence de maximum, les dégâts déjà subis restent.
Hooks.on("preUpdateActor", (actor, changes) => {
  const rank = foundry.utils.getProperty(changes, "system.abilities.endurance.rank");
  if (!["character", "npc"].includes(actor.type) || rank === undefined || foundry.utils.hasProperty(changes, "system.health.value")) return;
  const delta = (Number(rank) - actor.system.abilities.endurance.rank) * 3;
  if (delta) foundry.utils.setProperty(changes, "system.health.value", Math.max(0, actor.system.health.value + delta));
});
Hooks.on("controlToken", () => BattleApp.refresh());
Hooks.on("targetToken", () => BattleApp.refresh());
Hooks.on("updateActor", (actor, changes, options, userId) => {
  // Portrait d'un officier changé : les marqueurs le suivent.
  if (actor.type !== "troop") {
    if ("img" in changes) refreshOrderBadges();
    return;
  }
  BattleApp.refresh();
  renderBattleBar();
  // Brouillard : camp, état (troupe détruite) ou type (éclaireurs) changent ce que voit la Compagnie.
  if (["side", "state", "unitType", "unitType2", "traits"].some(k => foundry.utils.hasProperty(changes, `system.${k}`))) scheduleFog();
  // Ordre ou cible changés (drapeau de la troupe) : pastilles et flèches.
  if (foundry.utils.hasProperty(changes, `flags.${AFC.SYSTEM_ID}`)) {
    refreshOrderBadges();
    scheduleArrows();
  }
  // Icônes d'état du jeton, posées par le client qui a fait la modification.
  // État : marqueur au centre du jeton (et retrait des anciennes icônes d'état de Foundry).
  if (foundry.utils.hasProperty(changes, "system.state") || foundry.utils.hasProperty(changes, "system.book")) for (const t of actor.getActiveTokens()) drawTroopMarks(t);
  if (userId === game.user.id && foundry.utils.hasProperty(changes, "system.state")) syncTroopStatus(actor);
  // Compétences : suivent le type et l'entraînement.
  if (userId === game.user.id && (foundry.utils.hasProperty(changes, "system.training") || foundry.utils.hasProperty(changes, "system.unitType"))) prepareBookTroop(actor, { force: true });
  // Image personnalisée : liseré du camp.
  if ("img" in changes || foundry.utils.hasProperty(changes, "system.side")) for (const t of actor.getActiveTokens()) drawTroopMarks(t);
  // Symbole du jeton : suit le type et le camp.
  if (userId === game.user.id && (foundry.utils.hasProperty(changes, "system.side") || foundry.utils.hasProperty(changes, "system.unitType"))) refreshTroopImage(actor);
});
