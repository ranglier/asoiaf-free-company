/**
 * Barre de bataille, posée sur la carte : phase du tour et conduite du tour sans ouvrir la fenêtre.
 * MJ : révéler, résoudre le prochain engagement, fin de tour. Joueur : où en est le tour et ce qu'il
 * peut faire. Affichée seulement sur une scène qui contient des troupes.
 */
import { bookBar, onBookBar } from "./book.mjs";
import { endTurn, pcPhase, plannedEngagements, resolvePlanned, regionTerrainKey, revealOrders, startBattle } from "./engagement.mjs";
import { actionOf, describeAction, isDeclared } from "./pc-actions.mjs";
import { confirmPcsDone, pendingActions, playAction } from "./pc-rolls.mjs";
import { visibleRegions } from "./map.mjs";
import { isBook } from "./rules.mjs";
import { canCommand, getBattle, isDeploying, unitOf } from "./state.mjs";

const ID = "afc-battle-bar";
const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
let legendOpen = false;

/** Légende : couleur, nom et effet de chaque terrain de la scène (un nom inconnu est un simple repère). */
function legendHTML(scene) {
  const rows = visibleRegions(scene).map(r => {
    const key = regionTerrainKey(r);
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

/**
 * Place de la barre : juste au-dessus de la barre de raccourcis, centrée sur elle (hors du milieu de la
 * carte et loin du carrousel de combat en haut). Sans barre de raccourcis : en bas de l'écran.
 */
function placeBar() {
  const bar = document.getElementById(ID);
  if (!bar) return;
  const hotbar = document.getElementById("hotbar");
  const r = hotbar?.offsetParent ? hotbar.getBoundingClientRect() : null;
  bar.style.bottom = r?.height ? `${Math.round(window.innerHeight - r.top + 6)}px` : "";
  bar.style.left = r?.width ? `${Math.round(r.left + r.width / 2)}px` : "";
}
let barWatch = null;
function watchHotbar() {
  if (barWatch || !window.ResizeObserver) return;
  barWatch = new ResizeObserver(() => placeBar());
  const hotbar = document.getElementById("hotbar");
  if (hotbar) barWatch.observe(hotbar);
  window.addEventListener("resize", () => placeBar());
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
  watchHotbar();
  placeBar();
  const battle = getBattle(scene);
  const count = orderCount(battle, scene);
  const book = isBook(scene);
  let phase = battle.revealed ? loc("AFC.Battle.PhaseRevealed") : loc("AFC.Battle.PhaseOrders");
  let info = "", actions = "", revealed = battle.revealed;
  if (book) {
    ({ phase, info, actions, revealed } = bookBar(battle, scene, button));
  } else {
    // Déploiement, ordres, personnages, engagements (décision du 2026-11-17 : la barre guide tout le tour).
    const deploying = isDeploying(battle);
    const pending = pendingActions(battle);
    const pcStep = battle.revealed && pending.length && pcPhase(battle);
    if (deploying) phase = loc("AFC.Battle.Ui.Step.deploy");
    else if (pcStep) phase = loc("AFC.Battle.Ui.Step.pcs");
    const names = pending.map(a => game.actors.get(a.actor)?.name ?? "?").join(", ");
    if (game.user.isGM) {
      if (deploying) {
        info = loc("AFC.Battle.DeployGM");
        actions = button("start", "fa-flag-checkered", loc("AFC.Battle.Start"), { primary: true });
      } else if (!battle.revealed) {
        info = fmt("AFC.Battle.BarOrders", count);
        actions = button("reveal", "fa-eye", loc("AFC.Battle.Reveal"), { primary: count.given > 0 });
      } else {
        const plans = plannedEngagements(battle, scene);
        const next = plans[0];
        info = pcStep ? esc(fmt("AFC.Battle.PcPhase", { n: pending.length, names }))
          : next ? fmt("AFC.Battle.BarNext", { a: esc(next.fromName), o: esc(next.order), d: esc(next.toName), n: plans.length }) : loc("AFC.Battle.BarNoneLeft");
        if (pcStep) actions += button("pcWindow", "fa-user-shield", loc("AFC.Battle.Ui.Drawer.pcs"), { primary: true });
        if (next) actions += button("resolve", next.shoot ? "fa-bullseye" : "fa-swords", loc("AFC.Battle.Resolve"), { primary: !pcStep });
        actions += button("endTurn", "fa-forward-step", loc("AFC.Battle.EndTurn"), { primary: !next && !pcStep });
      }
    } else {
      info = deploying ? loc("AFC.Battle.DeployPlayer")
        : !battle.revealed ? (count.total ? fmt("AFC.Battle.BarOrdersPlayer", count) : loc("AFC.Battle.BarWaitingPlayer"))
        : count.total ? loc("AFC.Battle.BarCounterPlayer") : loc("AFC.Battle.BarRevealedPlayer");
      // Mon personnage : une action à jouer (bouton direct), ou rien de déclaré (rappel).
      const mine = game.actors.filter(a => a.type === "character" && a.isOwner);
      const toPlay = mine.map(a => actionOf(battle, a.id)).find(isDeclared);
      if (toPlay && battle.revealed) actions += button(`play:${toPlay.actor}`, "fa-dice", fmt("AFC.Battle.PlayMine", { what: describeAction(toPlay, scene) }), { primary: true });
      else if (!deploying && mine.some(a => !actionOf(battle, a.id))) info += ` <span class="pc-hint">· ${esc(loc("AFC.Battle.PcActions.HintDeclare"))}</span>`;
    }
  }
  actions += `<button type="button" class="icon ${legendOpen ? "primary" : ""}" data-bar="legend" data-tooltip="${esc(loc("AFC.Battle.Legend"))}"><i class="fa-solid fa-map"></i></button>`;
  actions += `<button type="button" class="icon" data-bar="window" data-tooltip="${esc(loc("AFC.Battle.Title"))}"><i class="fa-solid fa-chess-rook"></i></button>`;
  bar.innerHTML = `<span class="round">${esc(loc("AFC.Battle.Round"))} ${battle.round}</span>
    <span class="phase ${revealed ? "revealed" : ""}">${esc(phase)}</span>
    <span class="info">${info}</span><span class="actions">${actions}</span>
    ${legendOpen ? legendHTML(scene) : ""}`;
}

function onClick(event) {
  const action = event.target.closest("[data-bar]")?.dataset.bar;
  if (action?.startsWith("book")) return onBookBar(action);
  if (action === "reveal") return revealOrders();
  if (action === "start") return startBattle();
  if (action === "pcWindow") return game.afc.openBattle({ drawer: "pcs" });
  if (action?.startsWith("play:")) return playAction(action.slice(5));
  if (action === "endTurn") return endTurn();
  if (action === "window") return game.afc.openBattle();
  if (action === "legend") {
    legendOpen = !legendOpen;
    return renderBattleBar();
  }
  if (action === "resolve") {
    const next = plannedEngagements()[0];
    if (next) return confirmPcsDone().then(ok => ok && resolvePlanned(next));
  }
}
