/**
 * Actions des personnages dans le tour (décision du 2026-11-17, retours de la partie du 09/11).
 * Le joueur déclare l'action de son personnage dans la fenêtre Bataille, dès les ordres (action et troupe visée).
 * Après la révélation, il la joue : le système lance le test contre la bonne difficulté, garde le résultat, et le
 * bonus s'ajoute seul à la résolution de la troupe (Combattre en première ligne, Tirer avec l'unité). Le MJ voit
 * les actions encore à jouer dans « À résoudre » et peut les lancer à la place du joueur.
 */
import { ABILITIES } from "../config.mjs";
import { autoPenalties, rollDice } from "../dice/test-roll.mjs";
import { commandTroop, inPcPhase, rallyTroop } from "./engagement.mjs";
import { actionOf, isDeclared, recordAction } from "./pc-actions.mjs";
import { getBattle, unitOf } from "./state.mjs";
import { publicName, unknownToMe } from "./vision.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const L = "AFC.Battle.PcActions";

/** Actions de bataille, dans l'ordre de la liste. */
export const PC_ACTIONS = ["command", "rally", "frontLine", "shootWith", "readField", "carryOrder", "feat", "free"];
/** Troupe visée : une troupe de son camp, une troupe ennemie, ou au choix (exploit, action libre : facultative). */
const TROOP_KIND = { command: "own", rally: "own", frontLine: "own", shootWith: "own", carryOrder: "own", readField: "enemy", feat: "any", free: "any" };
/** Compétences proposées en premier, et spécialités cherchées (insensible à la casse). */
const TESTS = {
  frontLine: { abilities: ["fighting"], specialties: [] },
  shootWith: { abilities: ["marksmanship"], specialties: [] },
  readField: { abilities: ["warfare", "awareness"], specialties: ["tactiques", "tactics", "observation", "notice"] },
  carryOrder: { abilities: ["animalHandling", "athletics"], specialties: ["équitation", "equitation", "ride", "riding", "course", "run"] },
  feat: { abilities: [], specialties: [] },
  free: { abilities: [], specialties: [] }
};
/** Lire le champ : Délicat (9), +3 dans le brouillard ou la nuit (proposition du 2026-11-17). Porter un ordre : Routine (6). */
export const READ_FIELD = { base: 9, hard: 3 };
export const CARRY_ORDER = 6;

export { isDeclared };
/** Actions des personnages encore à jouer ce tour. */
export const pendingActions = battle => (Array.isArray(battle.actions) ? battle.actions : []).filter(isDeclared);

/** Avant le premier engagement : des actions de personnages déclarées n'ont pas été jouées ? Le MJ confirme. */
export async function confirmPcsDone() {
  const battle = getBattle();
  const pending = pendingActions(battle);
  if (!pending.length || battle.done?.length) return true;
  const names = pending.map(a => `${game.actors.get(a.actor)?.name ?? "?"} (${loc(`${L}.Action.${a.action}`)})`).join(", ");
  return DialogV2.confirm({
    window: { title: loc(`${L}.Title`) }, classes: ["afc", "afc-dialog"],
    content: `<p>${esc(fmt(`${L}.PendingConfirm`, { names }))}</p>`, rejectClose: false
  });
}

/** Camp d'un personnage : celui des troupes qu'il mène, sinon la Compagnie. */
function sideOf(actorId, battle, scene) {
  const led = battle.units.find(u => u.officer === actorId);
  return scene.tokens.get(led?.id)?.actor?.system.side ?? "company";
}

/** Troupes que l'action peut viser, pour la liste de la fenêtre. Un joueur ne voit pas les troupes cachées. */
export function troopChoices(actorId, action, battle = getBattle(), scene = canvas.scene) {
  const kind = TROOP_KIND[action];
  if (!kind || !scene) return [];
  const side = sideOf(actorId, battle, scene);
  const alive = t => t.actor?.type === "troop" && t.actor.system.state !== "destroyed" && (game.user.isGM || !t.hidden);
  return scene.tokens.filter(alive).filter(t => {
    const own = t.actor.system.side === side;
    if (action === "command") return own && unitOf(battle, t.id).officer === actorId;
    if (action === "rally") return own && t.actor.system.state !== "fresh";
    return kind === "own" ? own : kind === "enemy" ? !own : true;
  }).map(t => ({ id: t.id, name: unknownToMe(t) ? publicName(t) : t.name }))
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}

/** L'action a-t-elle besoin d'une troupe ? */
export const needsTroop = action => !["feat", "free"].includes(action);

/** Déclare l'action d'un personnage (phase des ordres ou après la révélation). */
export function declareAction(actorId, action, troop = "") {
  if (!PC_ACTIONS.includes(action)) return;
  if (needsTroop(action) && !troop) return ui.notifications.warn(loc(`${L}.NeedTroop`));
  return recordAction(actorId, { action, troop, status: "declared" });
}

/** Le joueur retire son action déclarée (tant qu'elle n'est pas jouée). */
export const cancelAction = actorId => recordAction(actorId, null);

/**
 * Joue l'action déclarée : Commander et Rallier passent par leurs fenêtres habituelles, les autres par un test
 * du personnage contre la difficulté de l'action. Après la révélation seulement.
 */
export async function playAction(actorId) {
  const battle = getBattle();
  const entry = actionOf(battle, actorId);
  if (!isDeclared(entry)) return;
  if (!battle.revealed) return ui.notifications.warn(loc(`${L}.AfterReveal`));
  // Commander se joue jusqu'au jet de sa troupe ; Rallier vérifie lui-même la phase.
  if (entry.action === "command") return commandTroop(entry.troop);
  if (entry.action === "rally") return rallyTroop(entry.troop, actorId);
  if (!(await inPcPhase(battle))) return;
  return pcTest(actorId, entry, battle);
}

/** Difficulté de l'action et son détail. */
function difficultyOf(entry, battle, scene) {
  if (["frontLine", "shootWith"].includes(entry.action)) {
    // Défense passive de l'adversaire de la troupe : sa cible, sinon le premier ennemi qui la vise.
    const foeId = unitOf(battle, entry.troop).target || battle.units.find(u => u.target === entry.troop)?.id;
    const foe = scene.tokens.get(foeId);
    if (!foe?.actor) return { value: null, detail: loc(`${L}.NoFoe`) };
    const value = 4 * foe.actor.system.melee;
    return { value, detail: fmt(`${L}.PassiveOf`, { name: publicName(foe), n: value }) };
  }
  if (entry.action === "readField") {
    const hard = battle.weather === "fog" || battle.night;
    const value = READ_FIELD.base + (hard ? READ_FIELD.hard : 0);
    return { value, detail: loc(hard ? `${L}.ReadFieldHard` : `${L}.ReadFieldBase`) };
  }
  if (entry.action === "carryOrder") return { value: CARRY_ORDER, detail: loc(`${L}.CarryOrderDiff`) };
  return { value: null, detail: loc(`${L}.GMDifficulty`) };
}

/** Fenêtre du test : compétence ou spécialité (la plus utile d'abord), dés, difficulté. */
function testDialog(actor, entry, d, troopName) {
  const abilities = actor.system.abilities;
  const title = key => loc(ABILITIES[key].label);
  const prefer = TESTS[entry.action] ?? { abilities: [], specialties: [] };
  const keys = Object.keys(ABILITIES).filter(k => abilities[k]).sort((x, y) => {
    const rank = k => { const i = prefer.abilities.indexOf(k); return i < 0 ? 99 : i; };
    return rank(x) - rank(y) || title(x).localeCompare(title(y));
  });
  // Choix par défaut : la compétence préférée que le personnage a, avec sa spécialité utile s'il en a une.
  let selected = keys[0];
  for (const k of prefer.abilities) {
    if (!abilities[k]) continue;
    const i = abilities[k].specialties.findIndex(sp => prefer.specialties.includes(sp.name.trim().toLowerCase()));
    selected = i >= 0 ? `${k}:${i}` : k;
    break;
  }
  const option = (value, label) => `<option value="${value}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`;
  const options = keys.map(k => [
    option(k, `${title(k)} (${abilities[k].rank})`),
    ...abilities[k].specialties.map((sp, i) => option(`${k}:${i}`, `${title(k)} (${abilities[k].rank}), ${sp.name} +${sp.bonus}${loc("AFC.Roll.BonusAbbr")}`))
  ].join("")).join("");
  return DialogV2.prompt({
    window: { title: `${loc(`${L}.Action.${entry.action}`)} : ${actor.name}` },
    classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog">
      <p class="hint">${esc(loc(`${L}.Effect.${entry.action}`))}${troopName ? ` · <b>${esc(troopName)}</b>` : ""}</p>
      <label>${loc("AFC.Battle.Options.commandSkill")}<select name="skill">${options}</select></label>
      <div class="row">
        <label>${loc("AFC.Roll.Bonus")}<input type="number" name="bonus" value="0" min="0"></label>
        <label>${loc("AFC.Roll.Penalty")}<input type="number" name="penalty" value="0" min="0"></label>
        <label>${loc("AFC.Roll.Modifier")}<input type="number" name="modifier" value="0"></label>
      </div>
      <label>${loc("AFC.Roll.Difficulty")}<input type="number" name="difficulty" value="${d.value ?? ""}" min="0" required></label>
      <p class="hint">${esc(d.detail)}</p></div>`,
    ok: {
      label: loc("AFC.Roll.Roll"),
      callback: (ev, button) => {
        const f = button.form.elements;
        const [key, index] = f.skill.value.split(":");
        const ability = abilities[key];
        const sp = index === undefined ? null : ability.specialties[Number(index)];
        const auto = autoPenalties(actor, key);
        return {
          skill: sp ? `${title(key)}, ${sp.name}` : title(key), notes: auto.notes, difficulty: Number(f.difficulty.value) || 0,
          pool: { rank: ability.rank, bonus: (sp?.bonus ?? 0) + (Number(f.bonus.value) || 0), penalty: (Number(f.penalty.value) || 0) + auto.dice, modifier: (Number(f.modifier.value) || 0) + auto.modifier }
        };
      }
    },
    rejectClose: false
  });
}

/** Ce que donne le résultat, en clair, pour la carte. */
function outcomeText(entry, success, degrees, troopName) {
  if (!success) return loc(`${L}.Fail.${["frontLine", "shootWith", "feat", "free"].includes(entry.action) ? "exposed" : entry.action}`);
  if (["frontLine", "shootWith"].includes(entry.action)) return fmt(`${L}.Bonus`, { n: degrees, name: troopName });
  if (entry.action === "readField") return loc(`${L}.Read.${Math.min(3, degrees)}`);
  if (entry.action === "carryOrder") return fmt(`${L}.CarryOk`, { name: troopName });
  return loc(`${L}.Scale.${Math.min(3, degrees)}`);
}

async function pcTest(actorId, entry, battle) {
  const scene = canvas.scene;
  const actor = game.actors.get(actorId);
  if (!actor?.system.abilities) return;
  const troop = scene.tokens.get(entry.troop);
  const troopName = troop ? (unknownToMe(troop) ? publicName(troop) : troop.name) : "";
  const d = difficultyOf(entry, battle, scene);
  const opts = await testDialog(actor, entry, d, troopName);
  if (!opts) return;
  const test = await rollDice({ ...opts.pool, difficulty: opts.difficulty });
  const success = !!test.outcome?.success;
  const degrees = success ? test.outcome.degrees : 0;
  await recordAction(actorId, { ...entry, status: "done", result: { success, degrees, total: test.total, difficulty: opts.difficulty } });
  const p = opts.pool;
  const pool = `${p.rank}D${test.bonus ? ` +${test.bonus}B` : ""}${p.penalty ? ` −${p.penalty}D` : ""}${p.modifier ? ` ${p.modifier > 0 ? "+" : "−"}${Math.abs(p.modifier)}` : ""}`;
  // Lire le champ sur une troupe cachée ou non identifiée : la carte reste entre le joueur et le MJ.
  const secret = entry.action === "readField";
  return ChatMessage.create({
    rolls: [test.roll], speaker: ChatMessage.getSpeaker({ actor }),
    whisper: secret ? [...ChatMessage.getWhisperRecipients("GM").map(u => u.id), game.user.id] : [],
    content: await foundry.applications.handlebars.renderTemplate("systems/asoiaf-free-company/templates/chat/battle-test.hbs", {
      title: loc(`${L}.Action.${entry.action}`),
      subtitle: troopName ? `${actor.name} · ${troopName}` : actor.name,
      total: test.total, dice: test.dice, success, degrees,
      verdict: outcomeText(entry, success, degrees, troopName),
      detail: fmt("AFC.Battle.Card.Against", { n: opts.difficulty, detail: d.detail }),
      pool, tags: [opts.skill, ...opts.notes]
    })
  });
}

