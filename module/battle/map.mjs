/**
 * Bataille sur la carte :
 * - menu du jeton de troupe (clic droit) : ordres, cible, officier, ralliement, fenêtre Bataille ;
 * - désignation de la cible en cliquant sur une troupe (Échap pour annuler) ;
 * - pastille d'ordre dans le bas du jeton et flèches « troupe → cible ».
 * Avant la révélation, ordres et flèches ne sont visibles que de qui commande la troupe (et du MJ).
 */
import { ORDER_ICONS, ORDERS, STATE_ORDER, TROOP_STATES } from "./battle-config.mjs";
import { SYSTEM_ID } from "../config.mjs";
import { BOOK_STATUS_CHIP, isBookTargeted } from "./book-config.mjs";
import { drawBookHealth, fillBookHUD } from "./book.mjs";
import { center, commandTroop, distance, mayCommand, plannedEngagements, rallyTroop, resolvePlanned, shootRange } from "./engagement.mjs";
import { afterPlan, APPROACH_ORDERS, cancelMovePick, cellCenter, contactForbidden, hasMoved, inContact, PATH_ORDERS, plannedPath, startMovePick } from "./moves.mjs";
import { chooseSplit, SPLIT_ORDERS } from "./split.mjs";
import { isAutoIcon } from "./troops.mjs";
import { isBook } from "./rules.mjs";
import { canCommand, getBattle, setUnit, unitOf } from "./state.mjs";
import { drawUnknownMask, fogName, fogOn, fogState, nextVeil, setVeil, toggleKnown, unknownToMe, veilState } from "./vision.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
export { ORDER_ICONS };
/** Ordres qui visent une troupe adverse. */
export const TARGETED_ORDERS = ["charge", "attack", "shoot"];

/** L'ordre (et la cible) de cette troupe est-il visible pour l'utilisateur ? */
export function orderVisible(token, battle) {
  return isBook(token.parent) || battle.revealed || canCommand(token, battle);
}

/* ---------- Désignation de la cible sur la carte ---------- */

let picking = null;

/** Attend un clic sur une troupe visible, puis l'enregistre comme cible (Échap : annuler). */
/** Cible possible d'une troupe : une troupe de l'autre camp, pas détruite (une troupe en déroute peut être poursuivie). */
export const validTarget = (token, target) => target?.actor?.type === "troop" && target.actor.system.side !== token.actor?.system.side
  && target.actor.system.state !== "destroyed";

export function startTargetPick(token, onPick = null) {
  cancelTargetPick();
  cancelMovePick();
  const view = canvas.app.view;
  const onDown = event => {
    if (event.button !== 0) return;
    const p = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
    // Seule une troupe ennemie encore sur le champ se désigne : un jeton détruit ou allié posé sur la même case est
    // ignoré (partie d'essai du 2026-11-03 : des tirs partis sur un bloc allié détruit).
    const under = canvas.tokens.placeables.filter(t => t.document.actor?.type === "troop" && t.document.id !== token.id
      && t.visible && t.bounds.contains(p.x, p.y));
    const hit = under.find(t => validTarget(token, t.document));
    event.stopPropagation();
    event.preventDefault();
    cancelTargetPick();
    if (!hit) return ui.notifications.info(loc(under.length ? "AFC.Battle.PickEnemyOnly" : "AFC.Battle.PickCancelled"));
    if (onPick) return onPick(hit.document);
    // L'ordre a pu changer depuis : on ne pose pas de cible sur un ordre qui n'en a pas.
    if (!isBook(token.parent) && !TARGETED_ORDERS.includes(unitOf(getBattle(), token.id).order)) return;
    setUnit(token.id, { target: hit.document.id }).then(() => afterPlan(token));
    ui.notifications.info(fmt("AFC.Battle.PlanSetDone", { a: token.name, d: fogName(hit.document) }));
    // La cible peut encore approcher : on prévient sans refuser.
    const battle = getBattle();
    if (unitOf(battle, token.id).order === "shoot") {
      const dist = distance(token, hit.document), range = shootRange(token.actor.system, battle);
      if (dist > range) ui.notifications.warn(fmt("AFC.Battle.Moves.TargetFar", { a: token.name, d: fogName(hit.document), n: dist, r: range }));
    }
  };
  const onKey = event => { if (event.key === "Escape") cancelTargetPick(); };
  view.addEventListener("pointerdown", onDown, { capture: true });
  window.addEventListener("keydown", onKey);
  view.style.cursor = "crosshair";
  picking = { onDown, onKey };
  ui.notifications.info(fmt("AFC.Battle.PickTarget", { name: token.name }));
}

export function cancelTargetPick() {
  if (!picking) return;
  canvas.app.view.removeEventListener("pointerdown", picking.onDown, { capture: true });
  window.removeEventListener("keydown", picking.onKey);
  canvas.app.view.style.cursor = "";
  picking = null;
}

/** Choix de la case d'arrivée : une seule désignation à la fois sur la carte. */
export function startMoveChoice(token) {
  cancelTargetPick();
  return startMovePick(token);
}

/** Ouvre la palette d'ordres, vers la droite si elle sortirait de l'écran à gauche. */
export function togglePalette(palette) {
  palette.classList.remove("flip");
  palette.classList.toggle("open");
  if (palette.classList.contains("open") && palette.getBoundingClientRect().left < 60) palette.classList.add("flip");
}

/** Choix de l'officier d'une troupe (PJ ou PNJ que l'utilisateur possède ; tous pour le MJ). */
export async function chooseOfficer(token) {
  const battle = getBattle();
  const current = unitOf(battle, token.id).officer;
  const actors = game.actors.filter(a => ["character", "npc"].includes(a.type) && (game.user.isGM || a.isOwner));
  const officer = await DialogV2.prompt({
    window: { title: fmt("AFC.Battle.OfficerTitle", { name: token.name }) },
    classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog"><p class="hint">${loc("AFC.Battle.OfficerHint")}</p>
      <label>${loc("AFC.Battle.Officer")}<select name="officer"><option value="">${loc("AFC.Battle.NoOfficer")}</option>
      ${actors.map(a => `<option value="${a.id}" ${a.id === current ? "selected" : ""}>${foundry.utils.escapeHTML(a.name)}</option>`).join("")}</select></label></div>`,
    ok: { label: loc("AFC.Battle.Apply"), callback: (ev, button) => button.form.elements.officer.value },
    rejectClose: false
  });
  if (officer !== null) await setUnit(token.id, { officer });
}

/** Donne un ordre ; pour un ordre offensif, enchaîne sur la désignation de la cible. */
export async function giveOrder(token, order) {
  cancelTargetPick();
  cancelMovePick();
  if (order === "shoot" && !token.actor.system.range) return ui.notifications.warn(loc("AFC.Battle.Warn.noRange"));
  // Bloc découpé ce tour-ci en pleine bataille : Tenir ou Manœuvrer seulement.
  if (unitOf(getBattle(), token.id).splitRound === getBattle().round && !SPLIT_ORDERS.includes(order)) return ui.notifications.warn(loc("AFC.Battle.Split.Locked"));
  // Non combattant : ni Charger, ni Attaquer, ni Tirer.
  if (["charge", "attack", "shoot"].includes(order) && token.actor.system.has.noncombat) return ui.notifications.warn(loc("AFC.Battle.Warn.noncombat"));
  if (order === "shoot" && (getBattle().reload ?? []).includes(token.id)) return ui.notifications.warn(fmt("AFC.Battle.Reloading", { name: token.name }));
  // Au contact d'un ennemi, on ne rompt le contact qu'en Se repliant (le MJ peut passer outre).
  if (contactForbidden(token, order) && !isBook(token.parent) && inContact(token)) {
    ui.notifications.warn(fmt("AFC.Battle.Moves.InContact", { name: token.name }));
    if (!game.user.isGM) return;
  }
  await setUnit(token.id, { order });
  // Ordre refusé (contre-ordre déjà utilisé) : ni désignation ni confirmation. Une troupe commandée par son officier
  // sans être possédée passe par le MJ : on ne peut pas encore lire le résultat.
  if (token.isOwner && unitOf(getBattle(), token.id).order !== order) return;
  if (TARGETED_ORDERS.includes(order)) return startTargetPick(token);
  if (PATH_ORDERS.includes(order) && !hasMoved(token)) return startMoveChoice(token);
  ui.notifications.info(`${token.name} : ${loc(`AFC.Battle.Order.${order}`)}`);
  afterPlan(token);
}

/* ---------- Menu du jeton (HUD) ---------- */

export function onRenderTokenHUD(hud, html) {
  const token = hud.document;
  if (token.actor?.type !== "troop") return;
  const battle = getBattle();
  const unit = unitOf(battle, token.id);
  const col = html.querySelector(".col.left");
  if (!col) return;
  // Sur une troupe, on masque ce qui ne sert pas (altitude, barres, verrou, états, cible, combat…) ;
  // seul le bouton cacher/révéler du MJ reste. Masqués et non retirés : Foundry garde ses repères.
  for (const el of html.querySelectorAll(".col > *")) {
    if (el.dataset.action !== "visibility") el.style.display = "none";
  }
  const button = (icon, tooltip, onClick, { active = false } = {}) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `control-icon afc-hud${active ? " active" : ""}`;
    b.dataset.tooltip = tooltip;
    b.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    b.addEventListener("click", onClick);
    col.append(b);
    return b;
  };
  const book = isBook(token.parent);
  if (book) fillBookHUD(hud, token, button);
  const commander = canCommand(token, battle);
  const locked = battle.revealed && unit.countered && !game.user.isGM;

  if (!book && commander && !locked) {
    const palette = document.createElement("div");
    palette.className = "afc-order-palette";
    for (const order of ORDERS) {
      if (order === "shoot" && !token.actor.system.range) continue;
      const o = document.createElement("button");
      o.type = "button";
      o.className = `control-icon${unit.order === order ? " active" : ""}`;
      o.dataset.tooltip = `${loc(`AFC.Battle.Order.${order}`)} : ${loc(`AFC.Battle.OrderHelp.${order}`)}`;
      o.innerHTML = `<i class="fa-solid ${ORDER_ICONS[order]}"></i>`;
      o.addEventListener("click", event => {
        event.stopPropagation();
        hud.close();
        giveOrder(token, order);
      });
      palette.append(o);
    }
    const label = battle.revealed ? loc("AFC.Battle.Counter") : loc("AFC.Battle.GiveOrder");
    button(unit.order ? ORDER_ICONS[unit.order] : "fa-flag", label, () => togglePalette(palette), { active: !!unit.order }).append(palette);
    if (TARGETED_ORDERS.includes(unit.order)) {
      button("fa-crosshairs", unit.target ? loc("AFC.Battle.PlanChange") : loc("AFC.Battle.PlanSet"), () => { hud.close(); startTargetPick(token); });
    }
    // Case d'arrivée : à choisir pour Manœuvrer et Se replier, facultative pour Charger et Attaquer.
    const movable = PATH_ORDERS.includes(unit.order) || (APPROACH_ORDERS.includes(unit.order) && unit.target);
    if (movable && !hasMoved(token)) button("fa-route", loc("AFC.Battle.Moves.Button"), () => { hud.close(); startMoveChoice(token); });
  }
  // MJ : résoudre l'engagement de cette troupe directement depuis la carte.
  const plan = game.user.isGM && battle.revealed ? plannedEngagements(battle).find(p => p.from === token.id) : null;
  if (!book && plan) button(plan.shoot ? "fa-bullseye" : "fa-swords", fmt("AFC.Battle.ResolveHud", { d: plan.toName }), () => { hud.close(); resolvePlanned(plan); });
  if (commander) button("fa-user-tie", loc(book ? "AFC.BattleBook.Attach" : "AFC.Battle.OfficerButton"), () => { hud.close(); chooseOfficer(token); }, { active: !!unit.officer });
  if (!book && mayCommand(token, battle)) button("fa-bullhorn", loc("AFC.Battle.Options.commandHint"), () => { hud.close(); commandTroop(token.id); });
  if (!book && commander && token.actor.system.state !== "fresh") button("fa-flag-checkered", `${loc("AFC.Battle.Rally")} (${token.actor.system.rallies}/${token.actor.system.ralliesMax})`, () => rallyTroop(token.id));
  if (!book && battle.outnumber && commander && token.actor.system.units > 1) button("fa-code-branch", loc("AFC.Battle.Split.Button"), () => { hud.close(); chooseSplit(token); });
  // Visibilité d'une troupe ennemie pour les joueurs (MJ) : un clic passe à l'état suivant. En brouillard automatique,
  // « Identifier » garde la vue calculée et ne fait que donner le nom (Lire le champ).
  if (game.user.isGM && token.actor.system.side === "enemy") {
    const state = veilState(token), next = nextVeil(token);
    button(VEIL_ICONS[state], fmt("AFC.Battle.Veil.Button", { state: loc(`AFC.Battle.Veil.${state}`), next: loc(`AFC.Battle.Veil.${next}`) }), () => { hud.close(); setVeil(token, next); }, { active: state !== "auto" });
    if (state === "auto") {
      const fog = fogState(token);
      button("fa-magnifying-glass", loc(fog.known ? "AFC.Battle.Fog.Forget" : "AFC.Battle.Fog.Identify"), () => { hud.close(); toggleKnown(token); }, { active: !!fog.known });
    }
  }
  // Colonne de droite, avec cacher/révéler : fiche de la troupe et fenêtre Bataille.
  const right = html.querySelector(".col.right");
  if (token.actor.testUserPermission(game.user, "OBSERVER")) {
    right?.append(button("fa-file-lines", loc("AFC.Battle.OpenSheet"), () => { hud.close(); token.actor.sheet.render({ force: true }); }));
  }
  right?.append(button("fa-chess-rook", loc("AFC.Battle.Title"), () => game.afc.openBattle()));
  if (!book) html.append(hudCard(hud, token, battle, unit));
}

/**
 * Fiche résumée au-dessus du jeton (décision du 2026-11-17) : nom, état, effectif, encaissement, ordre et cible,
 * officier, en clair. Le MJ y corrige l'état et l'encaissement du bloc (même circuit que les résolutions).
 */
function hudCard(hud, token, battle, unit) {
  const s = token.actor.system;
  const esc = v => foundry.utils.escapeHTML(String(v ?? ""));
  const known = game.user.isGM || s.side === "company" || !unknownToMe(token);
  const card = document.createElement("div");
  card.className = "afc-hud-card";
  const target = unit.target ? token.parent.tokens.get(unit.target) : null;
  const officer = game.actors.get(unit.officer);
  const order = unit.order && orderVisible(token, battle)
    ? `<div><i class="fa-solid ${ORDER_ICONS[unit.order]}"></i> ${esc(loc(`AFC.Battle.Order.${unit.order}`))}${target && (game.user.isGM || !target.hidden) ? ` → ${esc(fogName(target))}` : ""}</div>` : "";
  const gm = game.user.isGM;
  const step = (path, delta, icon, label) => `<button type="button" data-hud-step="${path}" data-delta="${delta}" aria-label="${esc(label)}"><i class="fa-solid ${icon}"></i></button>`;
  card.innerHTML = `<b>${esc(fogName(token))}</b>
    ${known ? `<div class="hud-state"><span class="state-chip ${s.state}">${esc(loc(TROOP_STATES[s.state].label))}</span>${gm ? step("state", -1, "fa-arrow-up", loc("AFC.Battle.HudStateUp")) + step("state", 1, "fa-arrow-down", loc("AFC.Battle.HudStateDown")) : ""}</div>
    <div>${esc(fmt("AFC.Battle.MenCount", { n: s.men }))} · ${esc(loc("AFC.Battle.Cushion"))} ${s.cushion}/${s.cushionMax}${gm ? step("cushion", -1, "fa-minus", loc("AFC.Battle.HudCushionDown")) + step("cushion", 1, "fa-plus", loc("AFC.Battle.HudCushionUp")) : ""}</div>` : ""}
    ${order}
    ${officer && known ? `<div><i class="fa-solid fa-user-tie"></i> ${esc(officer.name)}</div>` : ""}`;
  card.addEventListener("click", async event => {
    const b = event.target.closest("[data-hud-step]");
    if (!b || !gm) return;
    event.stopPropagation();
    const delta = Number(b.dataset.delta);
    const a = token.actor, sys = a.system;
    if (b.dataset.hudStep === "state") {
      const i = Math.max(0, Math.min(STATE_ORDER.length - 1, sys.stateIndex + delta));
      await a.update({ "system.state": STATE_ORDER[i] });
    } else await a.update({ "system.cushion": Math.max(0, sys.cushion + delta) });
    hud.render();
  });
  return card;
}

/** Icônes des états de visibilité d'une troupe ennemie. */
const VEIL_ICONS = { auto: "fa-cloud", hidden: "fa-eye-slash", unknown: "fa-question", known: "fa-eye" };

/* ---------- Noms des terrains sur la carte ---------- */

/** Régions que l'utilisateur peut voir (le MJ : toutes, y compris un passage encore secret). */
export const visibleRegions = (scene = canvas.scene) =>
  scene.regions.filter(r => game.user.isGM || r.visibility === CONST.REGION_VISIBILITY.ALWAYS);

/** Centre d'une forme de région (polygone, rectangle ou ellipse). */
function shapeCenter(s) {
  if (s.points?.length) {
    const n = s.points.length / 2;
    let x = 0, y = 0;
    for (let i = 0; i < s.points.length; i += 2) { x += s.points[i]; y += s.points[i + 1]; }
    return { x: x / n, y: y / n };
  }
  return s.width ? { x: s.x + s.width / 2, y: s.y + s.height / 2 } : { x: s.x, y: s.y };
}

/** Le nom se pose sur la case de la région la plus proche de son milieu : jamais hors de la région. */
function regionAnchor(region) {
  const centers = region.shapes.map(shapeCenter);
  if (!centers.length) return null;
  const mid = { x: centers.reduce((s, c) => s + c.x, 0) / centers.length, y: centers.reduce((s, c) => s + c.y, 0) / centers.length };
  return centers.reduce((best, c) => (Math.hypot(c.x - mid.x, c.y - mid.y) < Math.hypot(best.x - mid.x, best.y - mid.y) ? c : best));
}

/** Écrit le nom de chaque région dans le haut de sa case (le bas du jeton porte l'ordre), sous les jetons. */
export function drawRegionLabels() {
  if (!canvas.ready) return;
  canvas.tokens.children.filter(c => c.name === "afcRegionLabels").forEach(c => c.destroy({ children: true }));
  if (!canvas.scene.tokens.some(t => t.actor?.type === "troop")) return;
  const layer = new PIXI.Container();
  layer.name = "afcRegionLabels";
  layer.eventMode = "none";
  const placed = [];
  for (const region of visibleRegions()) {
    const at = regionAnchor(region);
    if (!at) continue;
    const text = new foundry.canvas.containers.PreciseText(region.name, Object.assign(CONFIG.canvasTextStyle.clone(), {
      fontSize: 15, fill: "#f3ead6", stroke: "#1b140d", strokeThickness: 3, fontStyle: region.visibility === CONST.REGION_VISIBILITY.ALWAYS ? "normal" : "italic"
    }));
    text.anchor.set(0.5, 0.5);
    let y = at.y - canvas.grid.sizeY * 0.32;
    // Deux régions sur la même case (village et pieux) : l'un sous l'autre.
    while (placed.some(p => Math.abs(p.x - at.x) < (p.w + text.width) / 2 && Math.abs(p.y - y) < 16)) y += 17;
    text.position.set(at.x, y);
    placed.push({ x: at.x, y, w: text.width });
    layer.addChild(text);
  }
  canvas.tokens.addChildAt(layer, 0);
}

/* ---------- Numéros des cases ---------- */

/** Numéros affichés sur cette scène ? (réglage de la fenêtre Bataille, par scène) */
export const hexNumbersOn = (scene = canvas.scene) => !!scene?.getFlag(SYSTEM_ID, "hexNumbers");

/** Les cases de la scène, ligne par ligne, de gauche à droite : numéro -> centre. */
function numberedCells() {
  const rect = canvas.dimensions.sceneRect;
  const last = canvas.grid.getOffset({ x: rect.right - 1, y: rect.bottom - 1 });
  const first = canvas.grid.getOffset({ x: rect.x + 1, y: rect.y + 1 });
  const cells = [];
  for (let i = first.i; i <= last.i; i++) {
    for (let j = first.j - 1; j <= last.j + 1; j++) {
      const at = canvas.grid.getCenterPoint({ i, j });
      // Seules les cases entières comptent : pas de numéro sur une demi-case au bord de la carte.
      const w = canvas.grid.sizeX / 2, h = canvas.grid.sizeY / 2;
      if (at.x - w >= rect.left - 1 && at.x + w <= rect.right + 1 && at.y - h >= rect.top - 1 && at.y + h <= rect.bottom + 1) cells.push({ i, j, at, n: cells.length + 1 });
    }
  }
  return cells;
}

/** Numéro de la case d'un jeton (null si les numéros sont désactivés sur cette scène). */
export function hexNumber(token) {
  if (!hexNumbersOn(token.parent) || token.parent.id !== canvas.scene?.id) return null;
  const o = canvas.grid.getOffset(center(token));
  return numberedCells().find(c => c.i === o.i && c.j === o.j)?.n ?? null;
}

/** Écrit le numéro dans le bas de chaque case, juste sous le symbole du jeton. */
export function drawHexNumbers() {
  if (!canvas.ready) return;
  canvas.tokens.children.filter(c => c.name === "afcHexNumbers").forEach(c => c.destroy({ children: true }));
  if (!hexNumbersOn()) return;
  const layer = new PIXI.Container();
  layer.name = "afcHexNumbers";
  layer.eventMode = "none";
  const style = Object.assign(CONFIG.canvasTextStyle.clone(), { fontSize: 16, fill: "#f3ead6", stroke: "#1b140d", strokeThickness: 3 });
  for (const cell of numberedCells()) {
    const text = new foundry.canvas.containers.PreciseText(String(cell.n), style);
    text.anchor.set(0.5, 0.5);
    text.position.set(cell.at.x, cell.at.y + canvas.grid.sizeY * 0.31);
    layer.addChild(text);
  }
  canvas.tokens.addChildAt(layer, 0);
}

/* ---------- Pastilles d'ordre ---------- */

/** Dessine (ou retire) la pastille d'ordre d'un jeton de troupe. */
export function drawOrderBadge(token) {
  token.children.filter(c => c.name === "afcOrder").forEach(c => c.destroy({ children: true }));
  const doc = token.document;
  if (doc.actor?.type !== "troop" || !doc.parent) return;
  const battle = getBattle(doc.parent);
  const { order } = unitOf(battle, doc.id);
  if (!order || !orderVisible(doc, battle)) return;
  const text = new foundry.canvas.containers.PreciseText(loc(`AFC.Battle.Order.${order}`), Object.assign(CONFIG.canvasTextStyle.clone(), {
    fontSize: 13, fill: "#f3ead6", stroke: "#2b2118", strokeThickness: 3
  }));
  text.anchor.set(0.5, 1);
  const badge = new PIXI.Container();
  badge.name = "afcOrder";
  const bg = new PIXI.Graphics();
  const w = text.width + 14, h = text.height + 4;
  // Sombre : ordre encore secret (vu par son commandant) ; rouge : ordre révélé.
  bg.beginFill(battle.revealed || isBook(doc.parent) ? 0x8e1b1b : 0x2b2118, 0.88).drawRoundedRect(-w / 2, -h, w, h, 6).endFill();
  badge.addChild(bg, text);
  // Dans la bande vide du bas du jeton (le symbole occupe le milieu) : pas de chevauchement entre voisins.
  badge.position.set(token.w / 2, token.h - 2);
  token.addChild(badge);
}

export function refreshOrderBadges() {
  if (!canvas.ready) return;
  for (const token of canvas.tokens.placeables) if (token.document.actor?.type === "troop") drawTroopMarks(token);
}

/* ---------- Flèches des cibles ---------- */

/** Style selon l'ordre : charge épaisse, attaque pleine, tir en pointillés. */
const ARROWS = { charge: { width: 7 }, attack: { width: 4 }, shoot: { width: 3, dash: [14, 10] } };
let arrowFrame = null;

/** Redessine les flèches à la prochaine image (une seule fois, même si beaucoup de jetons bougent). */
export function scheduleArrows() {
  if (arrowFrame) return;
  arrowFrame = requestAnimationFrame(() => {
    arrowFrame = null;
    drawPlanArrows();
  });
}

/**
 * Flèches « troupe → cible », dessinées depuis la position affichée des jetons (elles suivent les
 * déplacements animés). Jamais vers ou depuis un jeton caché pour un joueur.
 */
export function drawPlanArrows() {
  if (!canvas.ready) return;
  canvas.tokens.children.filter(c => c.name === "afcPlans").forEach(c => c.destroy({ children: true }));
  const battle = getBattle();
  const layer = new PIXI.Container();
  layer.name = "afcPlans";
  for (const unit of battle.units) {
    if (!unit.target || !(TARGETED_ORDERS.includes(unit.order) || isBookTargeted(unit.order))) continue;
    // Règles du livre : la flèche montre la dernière cible, seulement si l'ordre persiste.
    if (isBook() && !canvas.scene.tokens.get(unit.id)?.actor?.system.book.active) continue;
    const from = canvas.tokens.get(unit.id), to = canvas.tokens.get(unit.target);
    if (!from?.document.actor || !to) continue;
    if (!orderVisible(from.document, battle)) continue;
    if (!game.user.isGM && (from.document.hidden || to.document.hidden)) continue;
    const style = unit.mode === "shoot" ? ARROWS.shoot : ARROWS[unit.order] ?? ARROWS.attack;
    const color = from.document.actor.system.side === "company" ? 0x4f8fc8 : 0xd04a3f;
    const a = from.center, b = to.center;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    // Depuis près du centre du jeton jusqu'au bord de la cible : visible même entre voisins.
    const r0 = canvas.grid.sizeX * 0.15, r1 = canvas.grid.sizeX * 0.38;
    const start = { x: a.x + ux * r0, y: a.y + uy * r0 };
    const end = { x: b.x - ux * r1, y: b.y - uy * r1 };
    const g = new PIXI.Graphics();
    g.lineStyle({ width: style.width + 4, color: 0x1b140d, alpha: 0.55 });
    segment(g, start, end, style.dash);
    g.lineStyle({ width: style.width, color, alpha: 0.95 });
    segment(g, start, end, style.dash);
    const head = 12 + style.width * 2, nx = -uy, ny = ux;
    g.lineStyle(0);
    g.beginFill(color, 0.95).drawPolygon([
      end.x + ux * 4, end.y + uy * 4,
      end.x - ux * head + nx * head * 0.6, end.y - uy * head + ny * head * 0.6,
      end.x - ux * head - nx * head * 0.6, end.y - uy * head - ny * head * 0.6
    ]).endFill();
    layer.addChild(g);
  }
  if (!battle.revealed && !isBook()) for (const unit of battle.units) drawPlannedMove(layer, unit, battle);
  // Au-dessus des jetons, semi-transparentes, pour rester lisibles entre cases voisines.
  layer.alpha = 0.85;
  canvas.tokens.addChild(layer);
}

/** Mouvement prévu : pointillés clairs le long du chemin et silhouette du jeton à l'arrivée (visible de qui commande). */
function drawPlannedMove(layer, unit, battle) {
  const from = canvas.tokens.get(unit.id);
  if (!from?.document.actor || !orderVisible(from.document, battle)) return;
  if (!game.user.isGM && from.document.hidden) return;
  const path = plannedPath(from.document, unit);
  if (!path.length) return;
  const color = from.document.actor.system.side === "company" ? 0x4f8fc8 : 0xd04a3f;
  const g = new PIXI.Graphics();
  let previous = from.center;
  for (const key of path) {
    const next = cellCenter(key);
    g.lineStyle({ width: 7, color: 0x1b140d, alpha: 0.45 });
    segment(g, previous, next, [12, 8]);
    g.lineStyle({ width: 3, color: 0xf3ead6, alpha: 0.95 });
    segment(g, previous, next, [12, 8]);
    previous = next;
  }
  layer.addChild(g);
  const texture = from.mesh?.texture;
  if (!texture) return;
  const ghost = new PIXI.Sprite(texture);
  ghost.anchor.set(0.5);
  ghost.width = from.mesh.width;
  ghost.height = from.mesh.height;
  ghost.position.set(previous.x, previous.y);
  ghost.alpha = 0.6;
  ghost.tint = color;
  layer.addChild(ghost);
}

/** Trait plein ou en pointillés. */
function segment(g, a, b, dash) {
  if (!dash) return g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  const len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  for (let d = 0, on = true, i = 0; d < len; i++, on = !on) {
    const step = Math.min(dash[i % 2], len - d);
    if (on) g.moveTo(a.x + ux * d, a.y + uy * d).lineTo(a.x + ux * (d + step), a.y + uy * (d + step));
    d += step;
  }
}

/* ---------- Marqueur d'état au centre du jeton ---------- */

/** Couleur du marqueur selon l'état (Fraîche : pas de marqueur). */
const STATE_COLORS = { shaken: 0xc9a227, disordered: 0xd0701c, routed: 0x9b2c25, destroyed: 0x2b2118 };

/** Rayon de l'anneau d'un jeton rond. */
/**
 * Rayon du disque d'un jeton rond : celui de l'image (disque de 236 sur 512), réduite pour ne pas remplir la case
 * (TOKEN_SCALE, décision du 2026-11-17).
 */
export const TOKEN_SCALE = 0.8;
const ringRadius = token => Math.min(token.w, token.h) * 0.462 * Math.abs(token.document.texture.scaleX || 1);

/**
 * Anneau du jeton (décision du 2026-11-17) : couleur et style au choix sur la fiche de troupe (simple, double, fin,
 * pointillé, pierre si Tokenizer 2 est actif, aucun). Plus de couleur imposée selon le camp.
 */
async function drawRing(token) {
  token.children.filter(c => c.name === "afcRing").forEach(c => c.destroy({ children: true }));
  const doc = token.document;
  if (doc.actor?.type !== "troop" || unknownToMe(doc)) return;
  const { ringColor = "#2b2118", ringStyle = "simple" } = doc.actor.system.appearance ?? {};
  if (ringStyle === "none") return;
  const color = foundry.utils.Color.from(ringColor);
  const r = ringRadius(token), cx = token.w / 2, cy = token.h / 2, w = token.w;
  const ring = new PIXI.Container();
  ring.name = "afcRing";
  ring.eventMode = "none";
  const stone = ringStyle === "stone" && game.modules.get("tokenizer-2")?.active;
  if (stone) {
    const texture = await foundry.canvas.loadTexture("modules/tokenizer-2/img/default-frame-pc.png").catch(() => null);
    if (token.destroyed) return;
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.position.set(cx, cy);
      sprite.width = sprite.height = r * 2.12;
      ring.addChild(sprite);
    }
  } else {
    const g = new PIXI.Graphics();
    const width = ringStyle === "thin" ? w * 0.025 : w * 0.055;
    if (ringStyle === "dotted") {
      // Pointillé : des arcs réguliers, PIXI ne trace pas de tirets.
      const n = 18, gap = 0.35;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * 2 * Math.PI, a1 = a0 + (1 - gap) * (2 * Math.PI / n);
        g.lineStyle({ width, color, alpha: 1 }).moveTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0)).arc(cx, cy, r, a0, a1);
      }
    } else {
      g.lineStyle({ width, color, alpha: 1 }).drawCircle(cx, cy, r);
      if (ringStyle === "double") g.lineStyle({ width: w * 0.018, color, alpha: 1 }).drawCircle(cx, cy, r - w * 0.065);
    }
    ring.addChild(g);
  }
  token.children.filter(c => c.name === "afcRing").forEach(c => c.destroy({ children: true }));
  token.addChild(ring);
}

/**
 * Marqueur d'état (décision du 2026-11-17, « anneau d'état ») : un anneau intérieur dans la couleur de l'état, qui
 * laisse le pictogramme entier ; en déroute et détruite, une pastille avec l'icône de l'état en bas à droite.
 * Visible de tous, sauf sur une troupe ennemie non identifiée.
 */
export async function drawStateMarker(token) {
  token.children.filter(c => c.name === "afcState").forEach(c => c.destroy({ children: true }));
  const actor = token.document.actor;
  if (actor?.type !== "troop") return;
  const state = isBook(token.document.parent) ? BOOK_STATUS_CHIP[actor.system.book.status] : actor.system.state;
  const color = STATE_COLORS[state];
  if (!color || unknownToMe(token.document)) return;
  const marker = new PIXI.Container();
  marker.name = "afcState";
  marker.eventMode = "none";
  const inner = new PIXI.Graphics();
  inner.lineStyle({ width: token.w * 0.05, color, alpha: 0.95 }).drawCircle(token.w / 2, token.h / 2, ringRadius(token) - token.w * 0.075);
  marker.addChild(inner);
  token.addChild(marker);
  raiseChevrons(token);
  token.children.filter(c => c.name === "afcState" && c !== marker).forEach(c => c.destroy({ children: true }));
  if (!["routed", "destroyed"].includes(state)) return;
  const pastille = new PIXI.Container();
  const r = token.w * 0.12;
  const circle = new PIXI.Graphics();
  circle.lineStyle({ width: 3, color: 0xf3ead6, alpha: 1 }).beginFill(color, 0.95).drawCircle(0, 0, r).endFill();
  pastille.addChild(circle);
  // Sur le bord du disque, en bas à droite.
  const R = ringRadius(token) * 0.74;
  pastille.position.set(token.w / 2 + R, token.h / 2 + R);
  marker.addChild(pastille);
  await drawStateIcon(token, pastille, state, r);
}

/** Les chevrons d'effectif passent au premier plan : l'anneau d'état ne les recouvre pas. */
function raiseChevrons(token) {
  const ch = token.children.find(c => c.name === "afcChevrons");
  if (ch) { token.removeChild(ch); token.addChild(ch); }
}

/** Icône de l'état dans la pastille. */
async function drawStateIcon(token, marker, state, r) {
  // Icônes de la maquette du 2026-11-17 (game-icons, en blanc) : fuite et crâne brisé.
  const src = `systems/${SYSTEM_ID}/assets/troops/states/${state}.svg`;
  if (src) {
    const texture = await foundry.canvas.loadTexture(src);
    if (texture && !marker.destroyed) {
      const icon = new PIXI.Sprite(texture);
      icon.anchor.set(0.5);
      icon.width = icon.height = r * 1.3;
      marker.addChild(icon);
    }
  }
}

/* ---------- Officier et image personnalisée ---------- */

/** Portrait rond de l'officier, dans le coin haut droit du jeton. Visible de tous. */
export async function drawOfficerMarker(token) {
  token.children.filter(c => c.name === "afcOfficer").forEach(c => c.destroy({ children: true }));
  const doc = token.document;
  if (doc.actor?.type !== "troop" || !doc.parent) return;
  const officer = game.actors.get(unitOf(getBattle(doc.parent), doc.id).officer);
  if (!officer || unknownToMe(doc)) return;
  const texture = await foundry.canvas.loadTexture(officer.img).catch(() => null) ?? await foundry.canvas.loadTexture("icons/svg/mystery-man.svg");
  if (token.destroyed || !texture) return;
  token.children.filter(c => c.name === "afcOfficer").forEach(c => c.destroy({ children: true }));
  const r = token.w * 0.17;
  const marker = new PIXI.Container();
  marker.name = "afcOfficer";
  const backing = new PIXI.Graphics().beginFill(0x2b2118).drawCircle(0, 0, r).endFill();
  const portrait = new PIXI.Sprite(texture);
  portrait.anchor.set(0.5);
  const scale = (2 * r) / Math.min(texture.width, texture.height);
  portrait.scale.set(scale);
  const mask = new PIXI.Graphics().beginFill(0xffffff).drawCircle(0, 0, r).endFill();
  portrait.mask = mask;
  const ring = new PIXI.Graphics().lineStyle({ width: 3, color: 0xd4af37 }).drawCircle(0, 0, r);
  marker.addChild(backing, portrait, mask, ring);
  marker.position.set(token.w * 0.8, token.h * 0.27);
  token.addChild(marker);
}

/** Une image personnalisée n'a plus les couleurs du camp : un liseré autour du jeton les rend. */
function drawSideFrame(token) {
  token.children.filter(c => c.name === "afcSideFrame").forEach(c => c.destroy({ children: true }));
  const doc = token.document;
  if (doc.actor?.type !== "troop" || isAutoIcon(doc.texture.src)) return;
  // L'hexagone de la case, rapporté au coin du jeton.
  const points = canvas.grid.getVertices(canvas.grid.getOffset(center(doc))).flatMap(v => [v.x - doc._source.x, v.y - doc._source.y]);
  const frame = new PIXI.Graphics();
  frame.name = "afcSideFrame";
  frame.eventMode = "none";
  frame.lineStyle({ width: 4, color: doc.actor.system.side === "company" ? 0x4f8fc8 : 0xd04a3f, alpha: 0.95 }).drawPolygon(points);
  token.addChild(frame);
}

/**
 * Chevrons d'effectif (décision du 2026-11-17) : un chevron par centaine d'hommes de force (une unité montée complète
 * compte 100), 5 au plus, empilés sur le bord gauche du jeton (retour du 2026-11-17). Pas sur une troupe ennemie
 * que le joueur n'a pas identifiée.
 */
function drawStrengthChevrons(token) {
  token.children.filter(c => c.name === "afcChevrons").forEach(c => c.destroy({ children: true }));
  const doc = token.document;
  const s = doc.actor?.system;
  if (doc.actor?.type !== "troop" || isBook(doc.parent) || s.state === "destroyed" || unknownToMe(doc)) return;
  const n = Math.max(1, Math.min(5, Math.round((s.strength ?? s.men) / 100)));
  const g = new PIXI.Graphics();
  g.name = "afcChevrons";
  g.eventMode = "none";
  const w = token.w * 0.13, h = w * 0.45, gap = h * 0.45;
  const total = n * h + (n - 1) * gap;
  // Colonne centrée verticalement, du bas vers le haut, comme des galons.
  // À gauche du disque, sans le chevaucher.
  const x = Math.max(token.w * 0.01, token.w / 2 - ringRadius(token) - w * 0.75), yBottom = (token.h + total) / 2 - h;
  // Couleur de l'anneau choisi (plus de bleu ou de rouge selon le camp).
  const color = foundry.utils.Color.from(s.appearance?.ringColor ?? "#2b2118");
  for (let i = 0; i < n; i++) {
    const y0 = yBottom - i * (h + gap);
    // Chevron pointe en haut, liseré clair pour rester lisible sur tous les terrains.
    g.lineStyle({ width: 7, color: 0xf3ead6, alpha: 1 }).moveTo(x, y0 + h).lineTo(x + w / 2, y0).lineTo(x + w, y0 + h);
    g.lineStyle({ width: 4, color, alpha: 1 }).moveTo(x, y0 + h).lineTo(x + w / 2, y0).lineTo(x + w, y0 + h);
  }
  token.addChild(g);
}

/** Pastille d'ordre et marqueur d'état d'un jeton de troupe ; troupe inconnue (brouillard) : un « ? ». */
export function drawTroopMarks(token) {
  // Plus de liseré aux couleurs du camp autour d'une image personnalisée : l'anneau choisi le remplace.
  token.children.filter(c => c.name === "afcSideFrame").forEach(c => c.destroy({ children: true }));
  drawRing(token);
  drawStrengthChevrons(token);
  drawOfficerMarker(token);
  drawOrderBadge(token);
  drawStateMarker(token);
  drawBookHealth(token);
  drawUnknownMask(token);
}
