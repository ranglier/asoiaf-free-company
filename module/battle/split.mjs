/**
 * Découpage d'un bataillon (règles maison) : une troupe de plusieurs unités en détache une partie sur
 * une case voisine. Le nouveau bloc peut recevoir un officier libre ou rester sans officier.
 */
import { SYSTEM_ID } from "../config.mjs";
import { specialtyBonus } from "../data/actor-character.mjs";
import { rollDice } from "../dice/test-roll.mjs";
import { center, commandDifficulty } from "./engagement.mjs";
import { inContact } from "./moves.mjs";
import { mayAct, recordAction } from "./pc-actions.mjs";
import { getBattle, gmHandlers, gmOnScene, requestGM, unitOf } from "./state.mjs";

const COMMAND = ["commandement", "command"];
/** Ordres permis le tour d'un découpage en pleine bataille. */
export const SPLIT_ORDERS = ["hold", "maneuver"];

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
export async function splitTroop(data) {
  const { token: id, units, officer, name = null, splitRound = null } = data;
  // La case voisine se cherche sur la carte affichée : le MJ doit regarder la scène du joueur.
  if (!gmOnScene(data)) return null;
  const scene = canvas.scene;
  const token = scene.tokens.get(id);
  const s = token?.actor?.system;
  if (!s || units < 1 || units >= s.units) return null;
  // Mêmes contrôles que le dialogue, quelle que soit la voie (requête d'un joueur, macro) : en pleine bataille,
  // pendant les ordres, hors contact, et seulement après le test d'officier réussi (splitRound du tour).
  const battle = getBattle(scene);
  const refuse = key => { ui.notifications.warn(loc(`AFC.Battle.Split.${key}`)); return null; };
  if (["routed", "destroyed"].includes(s.state)) return refuse("NotRouted");
  if (battle.round > 1 || battle.revealed) {
    if (battle.revealed) return refuse("OrdersOnly");
    if (inContact(token, battle)) return refuse("InContact");
    if (splitRound !== battle.round) return refuse("NeedTest");
  }
  const at = freeNeighbor(token);
  if (!at) { ui.notifications.warn(loc("AFC.Battle.Split.NoRoom")); return null; }
  const men = Math.round(s.men * units / s.units);
  // L'encaissement se partage au prorata, arrondi au profit du bloc d'origine : découper n'en crée pas.
  const cushion = Math.floor(s.cushion * units / s.units);
  // Nom unique : un deuxième bloc de même taille prend une lettre (« (1) B »).
  const base = name ?? `${token.name} (${units})`;
  const names = new Set(scene.tokens.map(t => t.name));
  let label = base;
  for (let n = 2; names.has(label); n++) label = `${base} ${String.fromCharCode(64 + n)}`;
  const source = token.actor.toObject();
  delete source._id;
  // Ordre et officier vont sur le jeton : l'acteur copié ne garde pas ceux de la troupe d'origine.
  delete source.flags?.[SYSTEM_ID]?.unit;
  foundry.utils.mergeObject(source, {
    name: label,
    "system.units": units, "system.men": men, "system.cushion": cushion,
    "prototypeToken.name": label
  });
  const actor = await Actor.create(source);
  await token.actor.update({ "system.units": s.units - units, "system.men": s.men - men, "system.cushion": s.cushion - cushion });
  const doc = await actor.getTokenDocument({
    x: at.x - canvas.grid.sizeX / 2, y: at.y - canvas.grid.sizeY / 2, hidden: token.hidden,
    // Le brouillard suit le nouveau bloc (caché, identifié ou non, comme la troupe d'origine).
    flags: { [SYSTEM_ID]: { unit: { order: "", target: "", officer, countered: false, path: [], splitRound }, ...(token.getFlag(SYSTEM_ID, "fog") ? { fog: foundry.utils.deepClone(token.getFlag(SYSTEM_ID, "fog")) } : {}) } }
  });
  const [created] = await scene.createEmbeddedDocuments("Token", [doc.toObject()]);
  // Découpage en pleine bataille : les deux blocs ne peuvent que Tenir ou Manœuvrer ce tour-ci.
  if (splitRound) await token.setFlag(SYSTEM_ID, "unit.splitRound", splitRound);
  return created;
}
gmHandlers.splitTroop = splitTroop;

/** Dialogue de découpage : combien d'unités, et quel officier pour le nouveau bloc. */
export async function chooseSplit(token) {
  const s = token.actor.system;
  const battle = getBattle();
  if (s.units < 2) return ui.notifications.info(loc("AFC.Battle.Split.TooSmall"));
  // Pendant la bataille (décision du 2026-11-03) : pendant les ordres, hors contact, troupe ni en déroute ni détruite,
  // et c'est l'action d'un officier (Art militaire, Commandement, contre la difficulté de Commander). Avant la
  // première révélation, le découpage reste libre.
  const inBattle = battle.round > 1 || battle.revealed;
  if (["routed", "destroyed"].includes(s.state)) return ui.notifications.warn(loc("AFC.Battle.Split.NotRouted"));
  if (inBattle && battle.revealed) return ui.notifications.warn(loc("AFC.Battle.Split.OrdersOnly"));
  if (inBattle && inContact(token, battle)) return ui.notifications.warn(loc("AFC.Battle.Split.InContact"));
  const busy = new Set(battle.units.map(u => u.officer).filter(Boolean));
  const officers = game.actors.filter(a => ["character", "npc"].includes(a.type) && a.system.abilities?.warfare && !busy.has(a.id) && (game.user.isGM || a.isOwner));
  const pick = await DialogV2.prompt({
    window: { title: fmt("AFC.Battle.Split.Title", { name: token.name }) },
    classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog"><p class="hint">${fmt("AFC.Battle.Split.Hint", { n: s.units })}</p>
      <label>${loc("AFC.Battle.Split.Units")}<input type="number" name="units" value="1" min="1" max="${s.units - 1}"></label>
      <label>${loc("AFC.Battle.Officer")}<select name="officer"><option value="">${loc("AFC.Battle.NoOfficer")}</option>${officers.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label></div>`,
    ok: { label: loc("AFC.Battle.Apply"), callback: (ev, button) => ({ units: Number(button.form.elements.units.value) || 1, officer: button.form.elements.officer.value }) },
    rejectClose: false
  });
  if (!pick) return;
  if (inBattle) {
    const leaderId = unitOf(battle, token.id).officer || pick.officer;
    const leader = game.actors.get(leaderId);
    const warfare = leader?.system.abilities?.warfare;
    if (!warfare) return ui.notifications.warn(loc("AFC.Battle.Split.NeedOfficer"));
    if (!(await mayAct(leader.id, battle))) return;
    const d = commandDifficulty(s);
    const test = await rollDice({ rank: warfare.rank, bonus: specialtyBonus(warfare, COMMAND), difficulty: d.total });
    await recordAction(leader.id, { action: "split", troop: token.id });
    const success = !!test.outcome?.success;
    await ChatMessage.create({ rolls: [test.roll], speaker: ChatMessage.getSpeaker({ actor: leader }), content: `<div class="afc-card battle"><p>${esc(fmt(success ? "AFC.Battle.Split.TestOk" : "AFC.Battle.Split.TestFail", { who: leader.name, name: token.name, n: test.total, d: d.total }))}</p></div>` });
    if (!success) return;
    pick.splitRound = battle.round;
  }
  return game.user.isGM ? splitTroop({ token: token.id, ...pick }) : requestGM("splitTroop", { token: token.id, ...pick });
}
