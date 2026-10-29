/**
 * Événement de maison (livre de base, chapitre 6 « La maison en action » et chapitre 11).
 * Au moins un mois sur trois, au plus une fois par mois. L'intendant fait un test de Statut
 * (dés de bonus d'Intendance) + modificateurs de Loi et de Population + possessions ; chaque tranche
 * de 5 points d'Influence dépensée ajoute 1d6. Si on ne fait pas le test, on peut ajouter 1 à une ressource.
 */
import {
  HOUSE_HOLDING_EVENT_BONUS, HOUSE_LAW_MODS, HOUSE_POPULATION_MODS, HOUSE_RESOURCES, SYSTEM_ID, houseFortune
} from "./config.mjs";
import { HOLDINGS } from "./catalog-data.mjs";
import { specialtyBonus } from "./data/actor-character.mjs";
import { rollDice } from "./dice/test-roll.mjs";

const { DialogV2 } = foundry.applications.api;
const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);
const loc = key => game.i18n.localize(key);
const STEWARDSHIP = ["intendance", "stewardship"];
const pick = (table, value) => table.find(([min]) => value >= min)?.[1] ?? 0;

/** Clé de catalogue d'une possession : drapeau, sinon nom identique à celui du catalogue. */
function holdingKey(item) {
  const flag = item.getFlag(SYSTEM_ID, "catalog")?.key;
  if (flag) return flag;
  return HOLDINGS.find(h => loc(`AFC.Catalog.${h.key}.name`).toLowerCase() === item.name.toLowerCase())?.key ?? null;
}

/** Possessions achevées qui modifient le test (une en construction ne compte pas). */
function holdingBonuses(house) {
  return house.items.filter(i => i.type === "holding" && !i.system.building)
    .map(i => ({ name: i.name, key: holdingKey(i) }))
    .filter(h => h.key in HOUSE_HOLDING_EVENT_BONUS)
    .map(h => {
      const bonus = HOUSE_HOLDING_EVENT_BONUS[h.key];
      return { ...h, bonus, display: typeof bonus === "string" ? bonus : `+${bonus}` };
    });
}

/** La maison possède-t-elle cette possession (achevée) ? */
const hasHolding = (house, key) => house.items.some(i => i.type === "holding" && !i.system.building && holdingKey(i) === key);

/** Intendant proposé : un membre du foyer dont le rôle l'évoque. */
function defaultSteward(house) {
  return house.system.household.find(m => m.actor && /intendan|steward|mestre|maester/i.test(m.role))?.actor ?? "";
}

export async function runHouseEvent(house) {
  const s = house.system;
  const bonuses = holdingBonuses(house);
  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/house-event.hbs`, {
    law: s.resources.law.value, lawMod: pick(HOUSE_LAW_MODS, s.resources.law.value),
    population: s.resources.population.value, popMod: pick(HOUSE_POPULATION_MODS, s.resources.population.value),
    bonuses, influence: s.resources.influence.value,
    market: hasHolding(house, "market") ? game.i18n.format("AFC.HouseEvent.MarketHint", { bonus: hasHolding(house, "port") ? "1d6" : "1" }) : "",
    stewardOptions: Object.fromEntries(game.actors.filter(a => ["character", "npc"].includes(a.type)).map(a => [a.id, a.name])),
    steward: defaultSteward(house),
    resources: Object.fromEntries(HOUSE_RESOURCES.map(k => [k, `AFC.House.Resource.${k}`]))
  });
  const opts = await DialogV2.prompt({
    window: { title: game.i18n.format("AFC.HouseEvent.Title", { name: house.name }) },
    classes: ["afc", "afc-dialog"],
    position: { width: 520 },
    content,
    ok: {
      label: loc("AFC.HouseEvent.Run"),
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          mode: f.mode.value, steward: f.steward.value, resource: f.resource.value,
          influence: Math.floor(Math.max(0, Number(f.influence.value) || 0) / 5) * 5
        };
      }
    },
    rejectClose: false
  });
  if (!opts) return;

  // Pas de test : +1 à une ressource au choix.
  if (opts.mode === "skip") {
    await house.update({ [`system.resources.${opts.resource}.value`]: s.resources[opts.resource].value + 1 });
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: house }),
      content: await renderTemplate(`systems/${SYSTEM_ID}/templates/chat/house-event-card.hbs`, {
        house, skipped: game.i18n.format("AFC.HouseEvent.Skipped", { res: loc(`AFC.House.Resource.${opts.resource}`) })
      })
    });
  }

  // Test d'Intendance et modificateurs.
  const steward = game.actors.get(opts.steward);
  const status = steward?.system.abilities?.status;
  const mods = [
    { label: game.i18n.format("AFC.HouseEvent.ModLaw", { n: s.resources.law.value }), value: pick(HOUSE_LAW_MODS, s.resources.law.value) },
    { label: game.i18n.format("AFC.HouseEvent.ModPopulation", { n: s.resources.population.value }), value: pick(HOUSE_POPULATION_MODS, s.resources.population.value) }
  ];
  for (const b of bonuses) {
    const value = typeof b.bonus === "string" ? (await new Roll(b.bonus).evaluate()).total : b.bonus;
    mods.push({ label: typeof b.bonus === "string" ? `${b.name} (${b.bonus})` : b.name, value });
  }
  const influenceDice = Math.min(opts.influence, s.resources.influence.value) / 5;
  if (influenceDice) {
    const value = (await new Roll(`${influenceDice}d6`).evaluate()).total;
    mods.push({ label: game.i18n.format("AFC.HouseEvent.ModInfluence", { n: influenceDice * 5, d: influenceDice }), value });
  }
  const modifier = mods.reduce((sum, m) => sum + m.value, 0);
  const rank = status?.rank ?? 2;
  const bonus = status ? specialtyBonus(status, STEWARDSHIP) : 0;
  const test = await rollDice({ rank, bonus, modifier });
  const key = houseFortune(test.total);

  if (influenceDice) await house.update({ "system.resources.influence.value": s.resources.influence.value - influenceDice * 5 });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: house }),
    rolls: [test.roll],
    content: await renderTemplate(`systems/${SYSTEM_ID}/templates/chat/house-event-card.hbs`, {
      house, steward: steward?.name ?? loc("AFC.Month.NoSteward"), rank, bonus, mods, test,
      name: loc(`AFC.HouseEvent.Fortune.${key}.name`), effect: loc(`AFC.HouseEvent.Fortune.${key}.effect`),
      market: hasHolding(house, "market") && ["growth", "blessing", "boon"].includes(key)
        ? game.i18n.format("AFC.HouseEvent.MarketHint", { bonus: hasHolding(house, "port") ? "1d6" : "1" }) : ""
    })
  });
}
