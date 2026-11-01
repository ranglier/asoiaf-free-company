/**
 * Découpage d'un bataillon (règles maison) : une troupe de plusieurs unités en détache une partie sur
 * une case voisine, à condition que chaque morceau ait son officier.
 */
import { center } from "./engagement.mjs";
import { getBattle, gmHandlers, requestGM, setUnit, unitOf } from "./state.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

/** Case voisine libre, la plus proche du bord de son camp. */
function freeNeighbor(token) {
  const scene = token.parent;
  const taken = new Set(scene.tokens.filter(t => t.actor?.type === "troop").map(t => { const o = canvas.grid.getOffset(center(t)); return `${o.i},${o.j}`; }));
  const rect = canvas.dimensions.sceneRect;
  const cells = canvas.grid.getAdjacentOffsets(canvas.grid.getOffset(center(token)))
    .filter(o => !taken.has(`${o.i},${o.j}`)).map(o => ({ o, at: canvas.grid.getCenterPoint(o) })).filter(c => rect.contains(c.at.x, c.at.y));
  const toEdge = c => (token.actor.system.side === "company" ? c.at.x : -c.at.x);
  return cells.sort((a, b) => toEdge(a) - toEdge(b))[0]?.at ?? null;
}

/** Sépare `units` unités de la troupe, confiées à `officer`. */
export async function splitTroop({ token: id, units, officer, name = null }) {
  const scene = canvas.scene;
  const token = scene.tokens.get(id);
  const s = token?.actor?.system;
  if (!s || units < 1 || units >= s.units) return null;
  const at = freeNeighbor(token);
  if (!at) { ui.notifications.warn(loc("AFC.Battle.Split.NoRoom")); return null; }
  const men = Math.round(s.men * units / s.units);
  const data = token.actor.toObject();
  delete data._id;
  foundry.utils.mergeObject(data, {
    name: name ?? `${token.name} (${units})`,
    "system.units": units, "system.men": men,
    [`flags.asoiaf-free-company.unit`]: { order: "", target: "", officer, countered: false, path: [] },
    "prototypeToken.name": name ?? `${token.name} (${units})`
  });
  const actor = await Actor.create(data);
  await token.actor.update({ "system.units": s.units - units, "system.men": s.men - men });
  const doc = await actor.getTokenDocument({ x: at.x - canvas.grid.sizeX / 2, y: at.y - canvas.grid.sizeY / 2, hidden: token.hidden });
  const [created] = await scene.createEmbeddedDocuments("Token", [doc.toObject()]);
  return created;
}
gmHandlers.splitTroop = splitTroop;

/** Dialogue de découpage : combien d'unités, et quel officier pour le nouveau bloc. */
export async function chooseSplit(token) {
  const s = token.actor.system;
  const battle = getBattle();
  if (s.units < 2) return ui.notifications.info(loc("AFC.Battle.Split.TooSmall"));
  if (!unitOf(battle, token.id).officer) return ui.notifications.warn(loc("AFC.Battle.Split.NeedOfficer"));
  const busy = new Set(battle.units.map(u => u.officer).filter(Boolean));
  const officers = game.actors.filter(a => ["character", "npc"].includes(a.type) && a.system.abilities?.warfare && !busy.has(a.id) && (game.user.isGM || a.isOwner));
  if (!officers.length) return ui.notifications.warn(loc("AFC.Battle.Split.NoOfficer"));
  const pick = await DialogV2.prompt({
    window: { title: fmt("AFC.Battle.Split.Title", { name: token.name }) },
    classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog"><p class="hint">${fmt("AFC.Battle.Split.Hint", { n: s.units })}</p>
      <label>${loc("AFC.Battle.Split.Units")}<input type="number" name="units" value="1" min="1" max="${s.units - 1}"></label>
      <label>${loc("AFC.Battle.Officer")}<select name="officer">${officers.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label></div>`,
    ok: { label: loc("AFC.Battle.Apply"), callback: (ev, button) => ({ units: Number(button.form.elements.units.value) || 1, officer: button.form.elements.officer.value }) },
    rejectClose: false
  });
  if (pick) return requestGM("splitTroop", { token: token.id, ...pick });
}
