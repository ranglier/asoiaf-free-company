/**
 * Barre de bataille, posée sur la carte : phase du tour et conduite du tour sans ouvrir la fenêtre.
 * MJ : révéler, résoudre le prochain engagement, fin de tour. Joueur : où en est le tour et ce qu'il
 * peut faire. Affichée seulement sur une scène qui contient des troupes.
 */
import { bookBar, onBookBar, switchRules } from "./book.mjs";
import { endTurn, plannedEngagements, resolvePlanned, revealOrders, terrainKeyOf } from "./engagement.mjs";
import { visibleRegions } from "./map.mjs";
import { isBook } from "./rules.mjs";
import { canCommand, getBattle, unitOf } from "./state.mjs";

const ID = "afc-battle-bar";
const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
let legendOpen = false;

/** Légende : couleur, nom et effet de chaque terrain de la scène (un nom inconnu est un simple repère). */
function legendHTML(scene) {
  const rows = visibleRegions(scene).map(r => {
    const key = terrainKeyOf(r.name);
    return `<li><span class="swatch" style="background:${r.color?.css ?? "transparent"}"></span><b>${esc(r.name)}</b>
      <small>${esc(loc(`AFC.Battle.${isBook(scene) ? "TerrainBook" : "TerrainEffect"}.${key ?? "landmark"}`))}</small></li>`;
  }).join("");
  return `<ul class="legend">${rows || `<li><small>${esc(loc("AFC.Battle.LegendEmpty"))}</small></li>`}</ul>`;
}

/** Troupes qui doivent recevoir un ordre : pour le MJ toutes, pour un joueur les siennes. */
function orderCount(battle, scene) {
  const troops = scene.tokens.filter(t => t.actor?.type === "troop" && !["routed", "destroyed"].includes(t.actor.system.state)
    && (game.user.isGM || canCommand(t, battle)));
  return { given: troops.filter(t => unitOf(battle, t.id).order).length, total: troops.length };
}

const button = (action, icon, label, { disabled = false, primary = false } = {}) =>
  `<button type="button" data-bar="${action}" class="${primary ? "primary" : ""}" ${disabled ? "disabled" : ""}><i class="fa-solid ${icon}"></i> ${esc(label)}</button>`;

/** Dessine ou met à jour la barre. */
export function renderBattleBar() {
  let bar = document.getElementById(ID);
  const scene = canvas.ready ? canvas.scene : null;
  const hasTroops = scene?.tokens.some(t => t.actor?.type === "troop");
  if (!hasTroops) return bar?.remove();
  if (!bar) {
    bar = document.createElement("div");
    bar.id = ID;
    bar.addEventListener("click", onClick);
    document.body.append(bar);
  }
  const battle = getBattle(scene);
  const count = orderCount(battle, scene);
  const book = isBook(scene);
  let phase = battle.revealed ? loc("AFC.Battle.PhaseRevealed") : loc("AFC.Battle.PhaseOrders");
  let info = "", actions = "", revealed = battle.revealed;
  if (book) {
    ({ phase, info, actions, revealed } = bookBar(battle, scene, button));
  } else if (game.user.isGM) {
    if (!battle.revealed) {
      info = fmt("AFC.Battle.BarOrders", count);
      actions = button("reveal", "fa-eye", loc("AFC.Battle.Reveal"), { primary: count.given > 0 });
    } else {
      const plans = plannedEngagements(battle, scene);
      const next = plans[0];
      info = next ? fmt("AFC.Battle.BarNext", { a: esc(next.fromName), o: esc(next.order), d: esc(next.toName), n: plans.length }) : loc("AFC.Battle.BarNoneLeft");
      if (next) actions += button("resolve", next.shoot ? "fa-bullseye" : "fa-khanda", loc("AFC.Battle.Resolve"), { primary: true });
      actions += button("endTurn", "fa-forward-step", loc("AFC.Battle.EndTurn"), { primary: !next });
    }
  } else if (!battle.revealed) {
    info = count.total ? fmt("AFC.Battle.BarOrdersPlayer", count) : loc("AFC.Battle.BarWaitingPlayer");
  } else {
    info = count.total ? loc("AFC.Battle.BarCounterPlayer") : loc("AFC.Battle.BarRevealedPlayer");
  }
  // Règles en cours : le MJ bascule d'un clic.
  const rules = loc(`AFC.Battle.Rules.${book ? "book" : "house"}`);
  const rulesPill = game.user.isGM
    ? `<button type="button" class="rules" data-bar="rules" data-tooltip="${esc(loc("AFC.Battle.Rules.hint"))}"><i class="fa-solid fa-right-left"></i> ${esc(rules)}</button>`
    : `<span class="rules">${esc(rules)}</span>`;
  actions += `<button type="button" class="icon ${legendOpen ? "primary" : ""}" data-bar="legend" data-tooltip="${esc(loc("AFC.Battle.Legend"))}"><i class="fa-solid fa-map"></i></button>`;
  actions += `<button type="button" class="icon" data-bar="window" data-tooltip="${esc(loc("AFC.Battle.Title"))}"><i class="fa-solid fa-chess-rook"></i></button>`;
  bar.innerHTML = `<span class="round">${esc(loc("AFC.Battle.Round"))} ${battle.round}</span>
    ${rulesPill}<span class="phase ${revealed ? "revealed" : ""}">${esc(phase)}</span>
    <span class="info" data-tooltip="${esc(info)}">${info}</span><span class="actions">${actions}</span>
    ${legendOpen ? legendHTML(scene) : ""}`;
}

function onClick(event) {
  const action = event.target.closest("[data-bar]")?.dataset.bar;
  if (action?.startsWith("book")) return onBookBar(action);
  if (action === "rules") return switchRules(isBook() ? "house" : "book");
  if (action === "reveal") return revealOrders();
  if (action === "endTurn") return endTurn();
  if (action === "window") return game.afc.openBattle();
  if (action === "legend") {
    legendOpen = !legendOpen;
    return renderBattleBar();
  }
  if (action === "resolve") {
    const next = plannedEngagements()[0];
    if (next) return resolvePlanned(next);
  }
}
