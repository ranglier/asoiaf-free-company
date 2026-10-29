/**
 * Gestion des ressources (action de Maison, livre table 6-19 ; action de Compagnie, règles maison).
 * Une action convertit une ressource au taux normal ; une seconde conversion dans la même action
 * se fait au taux « précipité ». Le Ravitaillement de la Compagnie s'achète toujours à 1 Richesse pour 5.
 */
import { COMPANY_CONVERSIONS, HOUSE_CONVERSIONS, SYSTEM_ID } from "./config.mjs";

const { DialogV2 } = foundry.applications.api;
const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);
const loc = key => game.i18n.localize(key);

/** Libellé d'une ressource (le Ravitaillement n'est pas une ressource de la table). */
function resLabel(actor, key) {
  if (key === "supply") return loc("AFC.Company.supply");
  return loc(`${actor.type === "house" ? "AFC.House.Resource" : "AFC.Company.Resource"}.${key}`);
}

/** Points obtenus pour `amount` points cédés. */
function converted(table, from, to, amount, hasty) {
  const rule = table[from];
  if (!rule || !rule.to.includes(to) || amount <= 0) return 0;
  if (rule.per?.[to]) return amount * rule.per[to];
  return Math.floor(amount / (hasty ? rule.hasty : rule.rate));
}

/** Ouvre le dialogue de conversion et applique le résultat. */
export async function runConversion(actor) {
  const table = actor.type === "house" ? HOUSE_CONVERSIONS : COMPANY_CONVERSIONS;
  const sources = Object.fromEntries(Object.keys(table).map(k => [k, resLabel(actor, k)]));
  const targets = Object.fromEntries([...new Set(Object.values(table).flatMap(r => r.to))].map(k => [k, resLabel(actor, k)]));
  const rows = Object.entries(table).map(([from, r]) => ({
    from: resLabel(actor, from),
    to: r.to.map(t => resLabel(actor, t)).join(", "),
    rate: r.per ? `${r.rate}:1 · ${loc("AFC.Company.supply")} 1:${r.per.supply}` : `${r.rate}:1`,
    hasty: `${r.hasty}:1`
  }));
  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/conversion.hbs`, { rows, sources, targets });

  const result = await DialogV2.prompt({
    window: { title: game.i18n.format("AFC.Convert.Title", { name: actor.name }) },
    classes: ["afc", "afc-dialog"],
    position: { width: 540 },
    content,
    ok: {
      label: loc("AFC.Convert.Apply"),
      callback: (event, button) => {
        const f = button.form.elements;
        return [1, 2].map(i => ({
          from: f[`from${i}`].value, to: f[`to${i}`].value, amount: Math.max(0, Number(f[`amount${i}`].value) || 0), hasty: i === 2
        })).filter(c => c.from && c.to && c.amount);
      }
    },
    // Aperçu en direct de chaque conversion.
    render: (event, dialog) => {
      const root = dialog.element ?? dialog;
      const refresh = () => {
        for (const i of [1, 2]) {
          const from = root.querySelector(`[name="from${i}"]`).value;
          const to = root.querySelector(`[name="to${i}"]`).value;
          const amount = Number(root.querySelector(`[name="amount${i}"]`).value) || 0;
          const gain = converted(table, from, to, amount, i === 2);
          const ok = !from || !to || table[from]?.to.includes(to);
          root.querySelector(`[data-preview="${i}"]`).textContent = !from || !to || !amount ? ""
            : ok ? `→ +${gain} ${resLabel(actor, to)}` : loc("AFC.Convert.NotAllowed");
        }
      };
      root.querySelectorAll("select, input").forEach(el => el.addEventListener("input", refresh));
      refresh();
    },
    rejectClose: false
  });
  if (!result?.length) return;

  const s = actor.system;
  const values = Object.fromEntries(Object.entries(s.resources).map(([k, v]) => [k, v.value]));
  let supply = s.supply ?? 0;
  const lines = [];
  for (const c of result) {
    const gain = converted(table, c.from, c.to, c.amount, c.hasty);
    if (!gain || values[c.from] < c.amount) {
      ui.notifications.warn(game.i18n.format("AFC.Convert.Invalid", { from: resLabel(actor, c.from) }));
      continue;
    }
    values[c.from] -= c.amount;
    if (c.to === "supply") supply += gain; else values[c.to] += gain;
    lines.push(game.i18n.format(c.hasty ? "AFC.Convert.LineHasty" : "AFC.Convert.Line", {
      n: c.amount, from: resLabel(actor, c.from), gain, to: resLabel(actor, c.to)
    }));
  }
  if (!lines.length) return;
  const update = { "system.resources": Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v }])) };
  if (actor.type === "company") update["system.supply"] = supply;
  await actor.update(update);
  // Un investissement qui n'est plus couvert est perdu (règle du livre) : on le signale.
  const short = Object.entries(actor.system.resources).filter(([, r]) => r.available < 0).map(([k]) => resLabel(actor, k));
  if (short.length) lines.push(game.i18n.format("AFC.Convert.Uncovered", { list: short.join(", ") }));
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="afc-card month"><header><h3>${loc("AFC.Convert.CardTitle")}</h3><span class="subtitle">${foundry.utils.escapeHTML(actor.name)}</span></header>`
      + `<ul class="month-lines">${lines.map(l => `<li>${foundry.utils.escapeHTML(l)}</li>`).join("")}</ul></div>`
  });
}
