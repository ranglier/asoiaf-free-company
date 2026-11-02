/**
 * Fin de mois d'une Compagnie (règles maison révisées, docs : regles-compagnie).
 *
 * 1. Revenus : paie du contrat en cours, butin gardé (Richesse) ou distribué (Cohésion).
 * 2. Entretien : le Ravitaillement paie vivres et solde. S'il ne suffit pas, solde impayée :
 *    Cohésion −10 % du maximum ; au deuxième mois impayé d'affilée, désertions (−1d6 Effectif).
 *    Effets mensuels des services (Prévôt, Forgeron...).
 * 3. Test d'événement (facultatif) : Statut (Intendance) de l'intendant + modificateurs,
 *    lu sur une échelle régulière ; le MJ peut relancer avant de valider. La Cohésion
 *    compte telle que les revenus et l'entretien du mois l'ont laissée.
 * 4. Action de compagnie (facultative) : seul le repos a un effet chiffré (Cohésion +5).
 */
import {
  COHESION_TIERS, COMPANY_ACTIONS, COMPANY_MONTH_EVENTS, EVENT_ORGANIZATION_MODS,
  SERVICE_EVENT_BONUS, SERVICE_MONTHLY, SYSTEM_ID
} from "./config.mjs";
import { bestServiceItems, eventLossReductions, unpaidHalved } from "./company-services.mjs";
import { specialtyBonus } from "./data/actor-character.mjs";
import { rollDice } from "./dice/test-roll.mjs";

const { DialogV2 } = foundry.applications.api;
const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);
const loc = key => game.i18n.localize(key);

/** Événements du mois qui font perdre 1d6 sur une ressource : les services en réduisent la perte (le Déclin, −1, ne se réduit pas). */
const LOSS_EVENTS = ["disaster", "calamity"];

/** Rappel des réductions de pertes de la Compagnie (vide si aucune). */
function lossCare(company) {
  const list = Object.entries(eventLossReductions(company)).map(([k, n]) => `${loc(`AFC.Company.Resource.${k}`)} −${n}`).join(", ");
  return list ? game.i18n.format("AFC.Month.EventCare", { list }) : "";
}

/** Spécialité Intendance (fr / en) de la compétence Statut. */
const STEWARDSHIP = ["intendance", "stewardship"];

/** Clé de catalogue d'un service (null s'il a été créé à la main). */
const catalogKey = item => item.getFlag(SYSTEM_ID, "catalog")?.key ?? null;

/** Intendant proposé par défaut : un membre dont le rôle l'évoque, sinon le chef. */
function defaultSteward(company) {
  const s = company.system;
  const member = s.members.find(m => m.actor && /intendan|trésor|tresor|steward|paymaster|quartermaster/i.test(m.role));
  return member?.actor || s.leader || "";
}

/** Bonus de services au test d'événement (le meilleur service de chaque catégorie). */
function serviceEventBonus(company) {
  return bestServiceItems(company, k => SERVICE_EVENT_BONUS[k] ?? 0)
    .reduce((sum, i) => sum + (SERVICE_EVENT_BONUS[catalogKey(i)] ?? 0), 0);
}

/** Palier de Cohésion d'une valeur (le maximum est 3 × Autorité). */
function cohesionTier(cohesion, max) {
  const pct = max ? Math.round(100 * Math.max(0, Math.min(max, cohesion)) / max) : 0;
  return { pct, tier: COHESION_TIERS.find(t => pct >= t.min) ?? COHESION_TIERS.at(-1) };
}

/** Modificateurs du test d'événement, détaillés pour l'affichage (Cohésion du moment, sinon celle de la fiche). */
function eventModifiers(company, cohesion = company.system.cohesion) {
  const s = company.system;
  const org = EVENT_ORGANIZATION_MODS.find(([min]) => s.organization.effective >= min)?.[1] ?? 0;
  return [
    { label: loc("AFC.Month.ModOrganization"), value: org },
    { label: loc("AFC.Month.ModCohesion"), value: cohesionTier(cohesion, s.cohesionState.max).tier.eventMod },
    { label: loc("AFC.Month.ModServices"), value: serviceEventBonus(company) }
  ];
}

/** Test d'Intendance : renvoie le jet et la catégorie d'événement. */
async function rollEvent(company, stewardId, cohesion) {
  const steward = game.actors.get(stewardId);
  const status = steward?.system.abilities?.status;
  const mods = eventModifiers(company, cohesion);
  const modifier = mods.reduce((s, m) => s + m.value, 0);
  const rank = status?.rank ?? 2;
  const bonus = status ? specialtyBonus(status, STEWARDSHIP) : 0;
  const test = await rollDice({ rank, bonus, modifier });
  const event = COMPANY_MONTH_EVENTS.find(e => test.total <= e.max);
  return {
    steward: steward?.name ?? loc("AFC.Month.NoSteward"), rank, bonus, mods, modifier, test,
    key: event.key, name: loc(`AFC.Month.Event.${event.key}.name`), effect: loc(`AFC.Month.Event.${event.key}.effect`),
    care: LOSS_EVENTS.includes(event.key) ? lossCare(company) : ""
  };
}

/** Propose le résultat au MJ : garder ou relancer, autant de fois que voulu. */
async function chooseEvent(company, stewardId, cohesion) {
  for (;;) {
    const ev = await rollEvent(company, stewardId, cohesion);
    const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/month-event.hbs`, ev);
    const keep = await DialogV2.wait({
      window: { title: loc("AFC.Month.EventTitle") },
      classes: ["afc", "afc-dialog"],
      content,
      buttons: [
        { action: "keep", label: loc("AFC.Month.Keep"), icon: "fa-solid fa-check", default: true },
        { action: "reroll", label: loc("AFC.Month.Reroll"), icon: "fa-solid fa-rotate" }
      ],
      rejectClose: false
    });
    if (keep !== "reroll") return ev;
  }
}

/** Compagnies dont la fin de mois est ouverte (un double clic n'en ouvre qu'une). */
const running = new Set();

/** Lance la fin de mois d'une Compagnie. */
export async function runMonthEnd(company) {
  if (running.has(company.id)) return ui.notifications.warn(loc("AFC.Month.AlreadyOpen"));
  running.add(company.id);
  try { return await monthEnd(company); } finally { running.delete(company.id); }
}

async function monthEnd(company) {
  const s = company.system;
  const contractActive = s.contract.months > 0 && s.contract.pay > 0;
  const stewardOptions = Object.fromEntries(game.actors.filter(a => ["character", "npc"].includes(a.type)).map(a => [a.id, a.name]));

  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/month-end.hbs`, {
    system: s, month: s.month + 1, contractActive,
    actions: Object.fromEntries(COMPANY_ACTIONS.map(k => [k, `AFC.Month.Action.${k}`])),
    stewardOptions, steward: defaultSteward(company),
    hasMonthlyServices: company.items.some(i => i.type === "service" && SERVICE_MONTHLY[catalogKey(i)])
  });
  const opts = await DialogV2.prompt({
    window: { title: game.i18n.format("AFC.Month.Title", { name: company.name, n: s.month + 1 }) },
    classes: ["afc", "afc-dialog"],
    position: { width: 520 },
    content,
    ok: {
      label: loc("AFC.Month.Run"),
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          pay: Math.max(0, Number(f.pay.value) || 0),
          loot: Math.max(0, Number(f.loot.value) || 0),
          lootShared: Math.max(0, Number(f.lootShared.value) || 0),
          serviceEffects: f.serviceEffects?.checked ?? false,
          action: f.action.value,
          rollEvent: f.rollEvent.checked,
          steward: f.steward.value
        };
      }
    },
    // Raccourcis de partage et aperçu en direct.
    render: (event, dialog) => {
      const root = dialog.element ?? dialog;
      const loot = root.querySelector('[name="loot"]');
      const shared = root.querySelector('[name="lootShared"]');
      const preview = root.querySelector("[data-loot-preview]");
      const refresh = () => {
        const total = Math.max(0, Number(loot.value) || 0);
        const part = Math.min(total, Math.max(0, Number(shared.value) || 0));
        preview.textContent = game.i18n.format("AFC.Month.LootPreview", { shared: part, kept: total - part });
      };
      root.querySelectorAll("[data-loot-share]").forEach(a => a.addEventListener("click", () => {
        shared.value = Math.round((Number(loot.value) || 0) * Number(a.dataset.lootShare) / 100);
        refresh();
      }));
      loot.addEventListener("input", refresh);
      shared.addEventListener("input", refresh);
      refresh();
    },
    rejectClose: false
  });
  if (!opts) return;

  const r = Object.fromEntries(Object.entries(s.resources).map(([k, v]) => [k, v.value]));
  let supply = s.supply;
  let cohesion = s.cohesion;
  let unpaidMonths = s.unpaidMonths;
  const lines = [];
  const add = (key, data = {}) => lines.push(game.i18n.format(`AFC.Month.Line.${key}`, data));

  // 1. Revenus.
  if (opts.pay) { r.wealth += opts.pay; add("pay", { n: opts.pay }); }
  // Butin partagé : la part distribuée va à la Cohésion, le reste à la Richesse.
  if (opts.loot) {
    const shared = Math.min(opts.lootShared, opts.loot);
    const kept = opts.loot - shared;
    r.wealth += kept;
    cohesion += shared;
    add("loot", { n: opts.loot, shared, kept });
  }

  // 2. Entretien et solde.
  const upkeep = s.monthlySupply;
  if (supply >= upkeep) {
    supply -= upkeep;
    unpaidMonths = 0;
    add("upkeep", { n: upkeep, left: supply });
  } else {
    const cohesionLoss = Math.ceil(s.cohesionState.max / (unpaidHalved(company) ? 20 : 10));
    unpaidMonths += 1;
    const had = supply;
    supply = 0;
    cohesion -= cohesionLoss;
    add("unpaid", { n: upkeep, had, loss: cohesionLoss, months: unpaidMonths });
    if (unpaidMonths >= 2) {
      const deserters = (await new Roll("1d6").evaluate()).total;
      r.manpower = Math.max(0, r.manpower - deserters);
      add("desertion", { n: deserters });
    }
  }

  // Effets mensuels des services.
  if (opts.serviceEffects) {
    const monthly = k => Object.values(SERVICE_MONTHLY[k] ?? {}).reduce((a, b) => a + b, 0);
    for (const item of bestServiceItems(company, monthly)) {
      const effect = SERVICE_MONTHLY[catalogKey(item)];
      if (!effect) continue;
      for (const [key, n] of Object.entries(effect)) r[key] += n;
      add("service", { name: item.name, effect: Object.entries(effect).map(([k, n]) => `+${n} ${loc(`AFC.Company.Resource.${k}`)}`).join(", ") });
    }
  }

  // 3. Événement (facultatif, avec relance), avec la Cohésion laissée par les revenus et l'entretien.
  const event = opts.rollEvent ? await chooseEvent(company, opts.steward, cohesion) : null;

  // 4. Action.
  if (opts.action === "rest") {
    if (unpaidMonths) add("restUnpaid");
    else { cohesion += 5; add("rest"); }
  } else if (opts.action !== "none") add("action", { action: loc(`AFC.Month.Action.${opts.action}`) });

  // Contrat : un mois de moins.
  const contract = { ...s.contract };
  if (contractActive) {
    contract.months -= 1;
    add(contract.months ? "contractLeft" : "contractEnd", { employer: contract.employer || "—", n: contract.months });
  }

  // Cohésion bornée par son maximum (3 × Autorité, après les effets du mois).
  const cohesionMax = r.authority * 3;
  cohesion = Math.max(0, Math.min(cohesionMax, cohesion));
  const { pct, tier } = cohesionTier(cohesion, cohesionMax);
  if (tier.min === 0) add("crisis");

  await company.update({
    "system.resources": Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { value: v }])),
    "system.supply": supply,
    "system.cohesion": cohesion,
    "system.unpaidMonths": unpaidMonths,
    "system.month": s.month + 1,
    "system.contract": contract
  });

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: company }),
    content: await renderTemplate(`systems/${SYSTEM_ID}/templates/chat/month-card.hbs`, {
      company, month: s.month + 1, lines, event,
      cohesion, cohesionMax, pct, tierLabel: loc(tier.label), supply, wealth: r.wealth
    })
  });
}
