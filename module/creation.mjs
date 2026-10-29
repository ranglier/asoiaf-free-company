/**
 * Création d'une Maison ou d'une Compagnie : ressources de départ, fondation, événements historiques.
 *
 * Les deux suivent le même déroulé :
 * 1. origine (Compagnie) ou royaume (Maison) : modificateurs des ressources ;
 * 2. 7d6 par ressource + modificateur (la Compagnie peut relancer sa ressource la plus faible) ;
 * 3. fondation (1d6) : nombre d'événements historiques (minimum 1) ;
 * 4. événements (3d6) : modificateurs en dés appliqués aux ressources (minimum 0).
 *
 * Tables : règles maison pour la Compagnie, livre de base (chapitre 6) pour la Maison.
 */
import {
  COMPANY_EVENTS, COMPANY_FOUNDINGS, COMPANY_ORIGINS, COMPANY_RESOURCES,
  HOUSE_EVENTS, HOUSE_FOUNDINGS, HOUSE_RESOURCES, REALM_MODIFIERS, REALM_ROLLS, REALMS, SYSTEM_ID
} from "./config.mjs";

const { DialogV2 } = foundry.applications.api;
const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);

/** Lance une formule de modificateur (« +1d6 », « -2d6 », « 6-2d6 ») et renvoie le total. */
async function rollModifier(formula) {
  const f = String(formula).trim();
  const roll = await new Roll(/^[+-]/.test(f) ? `0${f}` : `0+${f}`).evaluate();
  return roll.total;
}

/** Tables de création pour un type d'acteur (Maison ou Compagnie). */
function creationTables(type) {
  if (type === "company") {
    return {
      resources: COMPANY_RESOURCES,
      resourcePrefix: "AFC.Company.Resource",
      originField: "origin",
      originLabel: "AFC.Company.origin",
      origins: Object.fromEntries(Object.entries(COMPANY_ORIGINS).map(([k, o]) => [k, { label: o.label, mods: o.mods }])),
      foundings: COMPANY_FOUNDINGS,
      events: COMPANY_EVENTS,
      rerollLowest: true
    };
  }
  return {
    resources: HOUSE_RESOURCES,
    resourcePrefix: "AFC.House.Resource",
    originField: "realm",
    originLabel: "AFC.House.realm",
    origins: Object.fromEntries(Object.keys(REALMS).map(k => [k, { label: REALMS[k], mods: REALM_MODIFIERS[k] ?? {} }])),
    // Région tirée au 3d6 (table 6-1) : premier palier atteint.
    originRoll: { formula: "3d6", table: REALM_ROLLS },
    foundings: HOUSE_FOUNDINGS,
    events: HOUSE_EVENTS,
    rerollLowest: false,
    // Modifications initiales : chaque joueur ajoute 1d6 à une ressource (au plus deux jets par ressource).
    playerBonus: { max: 2 }
  };
}

/** Libellé localisé d'une ressource. */
const resLabel = (tables, key) => game.i18n.localize(`${tables.resourcePrefix}.${key}`);

/** Formate une liste de variations : « Renommée +4 · Autorité −3 ». */
function formatDeltas(tables, deltas) {
  return Object.entries(deltas).filter(([, v]) => v)
    .map(([k, v]) => `${resLabel(tables, k)} ${v > 0 ? "+" : "−"}${Math.abs(v)}`).join(" · ");
}

/** Lance la création complète pour une Maison ou une Compagnie. */
export async function runCreation(actor) {
  const tables = creationTables(actor.type);

  // Étape 1 : origine / royaume et fondation.
  const step1 = await DialogV2.prompt({
    window: { title: game.i18n.format("AFC.Creation.Title", { name: actor.name }) },
    classes: ["afc", "afc-dialog"],
    content: await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/creation-start.hbs`, {
      tables,
      origins: Object.fromEntries(Object.entries(tables.origins).map(([k, o]) => [k, o.label])),
      foundings: Object.fromEntries(tables.foundings.map((f, i) => [String(i), f.label])),
      selected: actor.system[tables.originField],
      players: game.users.filter(u => !u.isGM).length || 1
    }),
    ok: {
      label: game.i18n.localize("AFC.Creation.Roll"),
      callback: (event, button) => ({
        origin: button.form.elements.origin.value,
        founding: button.form.elements.founding.value,
        players: Math.max(0, Number(button.form.elements.players?.value) || 0)
      })
    },
    rejectClose: false
  });
  if (!step1) return;

  // Région tirée au hasard (Maison).
  if (step1.origin === "random" && tables.originRoll) {
    const total = (await new Roll(tables.originRoll.formula).evaluate()).total;
    step1.origin = tables.originRoll.table.find(([max]) => total <= max)?.[1] ?? "";
  }

  // Étape 2 : ressources de départ (7d6 + modificateur, minimum 0).
  const mods = tables.origins[step1.origin]?.mods ?? {};
  const rollResource = async key => {
    const roll = await new Roll("7d6").evaluate();
    return { roll: roll.total, players: 0, mod: mods[key] ?? 0 };
  };
  const base = {};
  for (const key of tables.resources) base[key] = await rollResource(key);
  const value = key => Math.max(0, base[key].roll + base[key].players + base[key].mod);

  // Maison : chaque joueur lance 1d6 et l'ajoute à la ressource de son choix.
  if (tables.playerBonus && step1.players) {
    const dice = [];
    for (let i = 0; i < step1.players; i++) dice.push((await new Roll("1d6").evaluate()).total);
    const chosen = await choosePlayerBonus(tables, dice, base);
    chosen.forEach((key, i) => { base[key].players += dice[i]; });
  }

  // Compagnie : relance possible de la ressource la plus faible (le nouveau jet est conservé).
  let rerolled = null;
  if (tables.rerollLowest) {
    const lowest = tables.resources.reduce((lo, k) => (value(k) < value(lo) ? k : lo));
    const lines = tables.resources.map(k => `<li><strong>${resLabel(tables, k)}</strong> ${value(k)}${k === lowest ? " ←" : ""}</li>`).join("");
    const reroll = await DialogV2.confirm({
      window: { title: game.i18n.localize("AFC.Creation.RerollTitle") },
      classes: ["afc", "afc-dialog"],
      content: `<ul class="afc-roll-list">${lines}</ul><p>${game.i18n.format("AFC.Creation.RerollQuestion", { res: resLabel(tables, lowest), n: value(lowest) })}</p>`,
      rejectClose: false
    });
    if (reroll) {
      const before = value(lowest);
      base[lowest] = await rollResource(lowest);
      rerolled = { key: lowest, before, after: value(lowest) };
    }
  }

  // Étape 3 : fondation et nombre d'événements.
  let foundingIndex = Number(step1.founding);
  if (step1.founding === "random" || Number.isNaN(foundingIndex)) foundingIndex = (await new Roll("1d6").evaluate()).total - 1;
  const founding = tables.foundings[foundingIndex];
  const eventCount = founding ? Math.max(1, (await new Roll(founding.events).evaluate()).total) : 0;

  // Étape 4 : événements historiques (3d6), appliqués dans l'ordre (ressources minimum 0).
  const current = Object.fromEntries(tables.resources.map(k => [k, value(k)]));
  const events = [];
  for (let i = 0; i < eventCount; i++) {
    const roll = (await new Roll("3d6").evaluate()).total;
    const event = tables.events[roll];
    if (!event) { events.push({ roll, name: `3d6 = ${roll}`, deltas: {} }); continue; }
    const deltas = {};
    if (event.choose) {
      const chosen = await chooseResources(tables, event, current);
      for (const key of chosen) deltas[key] = await rollModifier(event.formula);
    } else {
      for (const [key, formula] of Object.entries(event.mods ?? {})) deltas[key] = await rollModifier(formula);
    }
    for (const [key, d] of Object.entries(deltas)) {
      const before = current[key];
      current[key] = Math.max(0, before + d);
      deltas[key] = current[key] - before;
    }
    events.push({ roll, name: game.i18n.localize(event.label), deltas });
  }

  // Récapitulatif avant d'appliquer.
  const summary = {
    actor, tables, rerolled, playerBonus: Boolean(tables.playerBonus && step1.players),
    origin: tables.origins[step1.origin] ? game.i18n.localize(tables.origins[step1.origin].label) : null,
    founding: founding ? game.i18n.localize(founding.label) : null,
    eventCount,
    rows: tables.resources.map(k => ({
      label: resLabel(tables, k), roll: base[k].roll, players: base[k].players, mod: base[k].mod, start: value(k),
      events: current[k] - value(k), final: current[k]
    })),
    events: events.map(e => ({ ...e, text: formatDeltas(tables, e.deltas) }))
  };
  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/creation-summary.hbs`, summary);
  const apply = await DialogV2.confirm({
    window: { title: game.i18n.format("AFC.Creation.Title", { name: actor.name }) },
    classes: ["afc", "afc-dialog", "afc-creation"],
    position: { width: 560 },
    content,
    yes: { label: game.i18n.localize("AFC.Creation.Apply") },
    no: { label: game.i18n.localize("Cancel") },
    rejectClose: false
  });
  if (!apply) return;

  await actor.update({
    [`system.${tables.originField}`]: step1.origin || actor.system[tables.originField],
    "system.founding": summary.founding ?? actor.system.founding,
    "system.resources": Object.fromEntries(tables.resources.map(k => [k, { value: current[k] }])),
    "system.events": summary.events.map(e => ({ name: e.name, note: e.text })),
    ...(actor.type === "company" ? { "system.created": true } : {})
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: await renderTemplate(`systems/${SYSTEM_ID}/templates/chat/creation-card.hbs`, summary)
  });
}

/** Dialogue de choix des ressources pour un événement « choisissez-en deux » (Prospérité). */
async function chooseResources(tables, event, current) {
  const count = event.choose;
  const content = `<p>${game.i18n.format("AFC.Creation.ChooseResources", { event: game.i18n.localize(event.label), n: count, formula: event.formula })}</p>
    <div class="afc-choose">${tables.resources.map(k => `<label class="checkbox"><input type="checkbox" name="${k}"> ${resLabel(tables, k)} (${current[k]})</label>`).join("")}</div>
    <p class="hint">${game.i18n.format("AFC.Creation.ChooseExactly", { n: count })}</p>`;
  const chosen = await DialogV2.prompt({
    window: { title: game.i18n.localize(event.label) },
    classes: ["afc", "afc-dialog"],
    content,
    ok: {
      label: game.i18n.localize("AFC.Creation.Confirm"),
      callback: (ev, button) => tables.resources.filter(k => button.form.elements[k]?.checked)
    },
    // Le bouton Valider n'est actif qu'avec exactement `count` ressources cochées.
    render: (ev, dialog) => {
      const root = dialog.element ?? dialog;
      const ok = root.querySelector('button[data-action="ok"]');
      const boxes = [...root.querySelectorAll('.afc-choose input[type="checkbox"]')];
      const sync = () => { ok.disabled = boxes.filter(b => b.checked).length !== count; };
      boxes.forEach(b => b.addEventListener("change", sync));
      sync();
    },
    rejectClose: false
  });
  // Fenêtre fermée sans choix : les ressources les plus faibles.
  return chosen?.length === count ? chosen : [...tables.resources].sort((a, b) => current[a] - current[b]).slice(0, count);
}

/**
 * Modifications initiales de la Maison : un dé par joueur, chacun choisit sa ressource.
 * Au plus `max` jets sur une même ressource ; le bouton Valider reste inactif sinon.
 */
async function choosePlayerBonus(tables, dice, base) {
  const max = tables.playerBonus.max;
  const options = tables.resources.map(k => `<option value="${k}">${resLabel(tables, k)} (${base[k].roll})</option>`).join("");
  const rows = dice.map((d, i) => `<label>${game.i18n.format("AFC.Creation.PlayerDie", { n: i + 1, d })}<select name="p${i}">${options}</select></label>`).join("");
  const chosen = await DialogV2.prompt({
    window: { title: game.i18n.localize("AFC.Creation.PlayersTitle") },
    classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog"><p class="hint">${game.i18n.format("AFC.Creation.PlayersHint", { max })}</p>${rows}<p class="hint warn" data-warn></p></div>`,
    ok: {
      label: game.i18n.localize("AFC.Creation.Confirm"),
      callback: (ev, button) => dice.map((d, i) => button.form.elements[`p${i}`].value)
    },
    render: (ev, dialog) => {
      const root = dialog.element ?? dialog;
      const ok = root.querySelector('button[data-action="ok"]');
      const selects = [...root.querySelectorAll("select")];
      // Répartition initiale : on tourne sur les ressources pour respecter la limite.
      selects.forEach((s, i) => { s.value = tables.resources[i % tables.resources.length]; });
      const sync = () => {
        const counts = {};
        selects.forEach(s => { counts[s.value] = (counts[s.value] ?? 0) + 1; });
        const over = Object.entries(counts).filter(([, n]) => n > max).map(([k]) => resLabel(tables, k));
        ok.disabled = over.length > 0;
        root.querySelector("[data-warn]").textContent = over.length ? game.i18n.format("AFC.Creation.PlayersOver", { list: over.join(", "), max }) : "";
      };
      selects.forEach(s => s.addEventListener("change", sync));
      sync();
    },
    rejectClose: false
  });
  // Fenêtre fermée : répartition par défaut (une ressource différente par dé).
  return chosen ?? dice.map((d, i) => tables.resources[i % tables.resources.length]);
}
