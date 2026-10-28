/**
 * ASOIAF Free Company : point d'entrée du système.
 */
import * as AFC from "./module/config.mjs";
import CharacterData from "./module/data/actor-character.mjs";
import NpcData from "./module/data/actor-npc.mjs";
import HouseData from "./module/data/actor-house.mjs";
import CompanyData from "./module/data/actor-company.mjs";
import { ArmorData, BloodData, HoldingData, QualityData, ServiceData, UnitData, WeaponData } from "./module/data/items.mjs";
import { CharacterSheet, CompanySheet, HouseSheet, NpcSheet } from "./module/sheets/actor-sheets.mjs";
import { AFCItemSheet } from "./module/sheets/item-sheet.mjs";
import { evaluateTest, rollAbilityTest, rollTest } from "./module/dice/test-roll.mjs";
import { onRenderChatMessage, resolveDamage, rollAttack } from "./module/dice/attack.mjs";
import { registerSettings } from "./module/settings.mjs";

Hooks.once("init", () => {
  CONFIG.AFC = AFC;
  game.afc = { rollAbilityTest, rollTest, evaluateTest, rollAttack, resolveDamage };
  registerSettings();

  Object.assign(CONFIG.Actor.dataModels, {
    character: CharacterData,
    npc: NpcData,
    house: HouseData,
    company: CompanyData
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
  const sheets = { character: CharacterSheet, npc: NpcSheet, house: HouseSheet, company: CompanySheet };
  for (const [type, cls] of Object.entries(sheets)) {
    DocumentSheetConfig.registerSheet(Actor, AFC.SYSTEM_ID, cls, {
      types: [type], makeDefault: true, label: `AFC.Sheet.${type}`
    });
  }
  DocumentSheetConfig.registerSheet(Item, AFC.SYSTEM_ID, AFCItemSheet, { makeDefault: true, label: "AFC.Sheet.item" });

  return foundry.applications.handlebars.loadTemplates([
    ...["abilities", "vitals", "tabs-nav", "weapons", "armor", "qualities", "mode-toggle", "resources", "members"]
      .map(p => `systems/${AFC.SYSTEM_ID}/templates/actor/parts/${p}.hbs`)
  ]);
});

Hooks.on("renderChatMessageHTML", onRenderChatMessage);
