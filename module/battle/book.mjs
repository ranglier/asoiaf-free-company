/**
 * Règles de guerre du livre (chapitre 10) : commandants, initiative, ordres un par un avec test d'Art
 * militaire contre la Discipline, attaques, dégâts et moral, ordres permanents, bilan.
 * Les joueurs choisissent (clic droit, cible, fenêtre) ; l'exécution se fait chez le MJ actif, seul à
 * pouvoir écrire sur la scène et sur les troupes adverses. Rien à décider pour lui : la carte tombe.
 */
import { SYSTEM_ID } from "../config.mjs";
import { COMPANY_UNIT_TYPES, HOUSE_UNIT_TYPES } from "../catalog-data.mjs";
import { specialtyBonus } from "../data/actor-character.mjs";
import { rollDice } from "../dice/test-roll.mjs";
import {
  BOOK_ABILITY_PRIORITY, BOOK_ATTACHED_DAMAGE, BOOK_FORMATIONS, BOOK_ORDERS, BOOK_STATUS_CHIP, BOOK_SURVIVORS,
  BOOK_TERRAINS, BOOK_TYPE_MAP, BOOK_UPGRADES, BOOK_WEATHER, BOOK_ABILITIES, TROOP_STATS_VERSION, bookGlory
} from "./book-config.mjs";
import { adjacent, center, distance, regionTerrainKey } from "./engagement.mjs";
import { hexNumber, startTargetPick } from "./map.mjs";
import { gmHandlers, getBattle, requestGM, resetOrders, saveBattle, unitOf } from "./state.mjs";
import { isBook } from "./rules.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const L = "AFC.BattleBook";
const COMMAND = ["commandement", "command"];
const STRATEGY = ["stratégie", "strategie", "strategy"];
const SIDES = ["company", "enemy"];
const otherSide = side => (side === "company" ? "enemy" : "company");
const orderName = key => loc(`AFC.Battle.Order.${key}`);
/** Aide d'un ordre : celle du livre si elle diffère des règles maison. */
const orderHelp = key => loc(game.i18n.has(`${L}.OrderHelp.${key}`) ? `${L}.OrderHelp.${key}` : `AFC.Battle.OrderHelp.${key}`);

/* ---------- État de la bataille (livre) ---------- */

/** Les listes du tour sont des tableaux : setFlag fusionne les objets, il ne les viderait pas. */
const newBook = (old = {}) => ({
  phase: "setup", turn: "", first: "", initiative: { company: 0, enemy: 0 },
  commanders: old.commanders ?? { company: { commander: "", subs: [] }, enemy: { commander: "", subs: [] } },
  used: [], counts: [], acted: [], noStanding: [], suppressed: [], passed: [],
  yards: old.yards ?? 10, advanced: old.advanced ?? true, formations: old.formations ?? false
});

export function bookState(battle = getBattle()) {
  return foundry.utils.mergeObject(newBook(), battle.book ?? {}, { inplace: false });
}

async function saveBook(battle, book) {
  battle.book = book;
  return saveBattle(battle);
}

export const troopsOf = (scene = canvas.scene) => scene.tokens.filter(t => t.actor?.type === "troop");
const sideTroops = (side, scene) => troopsOf(scene).filter(t => t.actor.system.side === side);
const activeTroops = (side, scene) => sideTroops(side, scene).filter(t => t.actor.system.book.active);

/* ---------- Préparation des troupes ---------- */

/** Compétences et équipement du livre, d'après le type et l'entraînement de la troupe. */
export function bookDataFor(system) {
  const map = BOOK_TYPE_MAP[system.unitType] ?? { type: "infantry" };
  const keys = (COMPANY_UNIT_TYPES[system.unitType] ?? HOUSE_UNIT_TYPES[system.unitType])?.abilities ?? ["fighting", "endurance", "athletics"];
  const open = BOOK_ABILITY_PRIORITY.filter(k => keys.includes(k));
  const abilities = Object.fromEntries(BOOK_ABILITIES.map(k => [k, 2]));
  const upgrades = BOOK_UPGRADES[system.training] ?? 3;
  // Un Bleu n'a qu'un rang à placer : il va à sa dernière compétence clé, son métier reste à 2.
  if (system.training === "green" && open.length) abilities[open.at(-1)] += 1;
  else for (let i = 0; i < upgrades && open.length; i++) abilities[open[i % open.length]] += 1;
  return { ready: true, v: TROOP_STATS_VERSION, type: map.type, abilities, upArmor: !!map.armor, upFight: !!map.fight, upShoot: !!map.shoot };
}

export function prepareBookTroop(actor, { force = false } = {}) {
  if (actor?.type !== "troop" || (actor.system.book.ready && actor.system.book.v >= TROOP_STATS_VERSION && !force)) return;
  return actor.update({ "system.book": bookDataFor(actor.system) });
}

/* ---------- Bascule entre les deux jeux de règles ---------- */

/** Change les règles de la scène : la bataille repart au tour 1, chaque jeu garde ses données sur la troupe. */
export async function switchRules(rules) {
  if (!game.user.isGM) return;
  const battle = getBattle();
  const started = battle.round > 1 || battle.units.some(u => u.order);
  if (started) {
    const ok = await DialogV2.confirm({
      window: { title: loc("AFC.Battle.Rules.switchTitle") }, classes: ["afc", "afc-dialog"],
      content: `<p>${fmt("AFC.Battle.Rules.switchConfirm", { rules: loc(`AFC.Battle.Rules.${rules}`).toLowerCase() })}</p>`, rejectClose: false
    });
    if (!ok) return;
  }
  Object.assign(battle, { rules, round: 1, revealed: false, weather: "clear", engaged: [], done: [], reload: [], reloadNext: [], moved: [] });
  battle.book = newBook(battle.book);
  await saveBattle(battle);
  await resetOrders();
  if (rules === "book") for (const t of troopsOf()) await prepareBookTroop(t.actor);
  ChatMessage.create({ content: `<div class="afc-card battle"><p>${fmt("AFC.Battle.Rules.switched", { rules: loc(`AFC.Battle.Rules.${rules}`).toLowerCase() })}</p></div>` });
}

/** Repart de zéro avec ces règles : statuts, dégâts et ordres remis à neuf. */
export async function resetBook() {
  const battle = getBattle();
  Object.assign(battle, { round: 1, weather: "clear" });
  battle.book = newBook(battle.book);
  await saveBattle(battle);
  await resetOrders();
  for (const t of troopsOf()) {
    await t.actor.update({ "system.book": { status: "organized", damage: 0, penalties: 0, wasDamaged: false, formation: "none", defendResult: null, probing: false, setCharge: false, readied: "" } });
  }
}

/* ---------- Commandants ---------- */

const warfareOf = actor => actor?.system.abilities?.warfare;

/** Personnage attaché à une troupe qui n'est pas une garde personnelle : il ne donne plus d'ordres. */
function attachedAway(actorId, scene) {
  return troopsOf(scene).some(t => unitOf(getBattle(scene), t.id).officer === actorId && t.actor.system.book.type !== "personalGuard");
}

/** Commandants d'un camp : ordres par tour (rang d'Art militaire pour le chef, 1 par second) et restants. */
export function commandersOf(book, side, scene = canvas.scene) {
  const c = book.commanders[side] ?? { commander: "", subs: [] };
  const list = [];
  const add = (id, role) => {
    const actor = game.actors.get(id);
    if (!actor) return;
    const max = attachedAway(id, scene) ? 0 : role === "commander" ? (warfareOf(actor)?.rank ?? 0) : 1;
    const used = book.used.filter(u => u === id).length;
    list.push({ id, actor, name: actor.name, role, max, used, left: Math.max(0, max - used), owned: actor.isOwner });
  };
  add(c.commander, "commander");
  for (const id of c.subs ?? []) add(id, "sub");
  return list;
}
export const ordersLeft = (book, side, scene = canvas.scene) =>
  (book.passed.includes(side) ? 0 : commandersOf(book, side, scene).reduce((s, c) => s + c.left, 0));

/** Choix des commandants et seconds (un second par deux unités du camp). */
export async function chooseCommanders() {
  const battle = getBattle();
  const book = bookState(battle);
  const actors = game.actors.filter(a => ["character", "npc"].includes(a.type) && warfareOf(a)).sort((a, b) => warfareOf(b).rank - warfareOf(a).rank);
  const block = side => {
    const c = book.commanders[side];
    const pick = c.commander || actors.find(a => (side === "company") === (a.type === "character"))?.id;
    return `<div class="battle-side"><h3>${loc(`AFC.Battle.Side.${side}`)}</h3>
      <label>${loc(`${L}.Commander`)}<select name="${side}.commander"><option value=""></option>${actors.map(a => `<option value="${a.id}" ${a.id === pick ? "selected" : ""}>${esc(a.name)} (${warfareOf(a).rank})</option>`).join("")}</select></label>
      <p class="hint">${fmt(`${L}.SubsLimit`, { n: Math.floor(sideTroops(side).length / 2) })}</p>
      <div class="cmd-subs">${actors.map(a => `<label class="checkbox"><input type="checkbox" name="${side}.sub" value="${a.id}" ${c.subs?.includes(a.id) ? "checked" : ""}> ${esc(a.name)}</label>`).join("")}</div></div>`;
  };
  const picked = await DialogV2.prompt({
    window: { title: loc(`${L}.CommandersTitle`) }, classes: ["afc", "afc-dialog"], position: { width: 620 },
    content: `<div class="afc-test-dialog afc-battle-roll"><div class="battle-sides">${SIDES.map(block).join("")}</div></div>`,
    ok: {
      label: loc("AFC.Battle.Apply"),
      callback: (ev, button) => Object.fromEntries(SIDES.map(side => {
        const commander = button.form.elements[`${side}.commander`].value;
        const limit = Math.floor(sideTroops(side).length / 2);
        const subs = [...button.form.querySelectorAll(`[name="${side}.sub"]:checked`)].map(i => i.value).filter(id => id !== commander).slice(0, limit);
        return [side, { commander, subs }];
      }))
    },
    rejectClose: false
  });
  if (!picked) return false;
  book.commanders = picked;
  await saveBook(battle, book);
  return true;
}

/* ---------- Valeurs de bataille ---------- */

const pointKeys = (scene, point) => {
  const keys = new Set(), names = [];
  for (const region of scene.regions) {
    const key = regionTerrainKey(region);
    if (key && region.testPoint({ ...point, elevation: 0 })) { keys.add(key); names.push({ key, name: region.name }); }
  }
  return { keys: [...keys], names };
};
const terrainOf = token => pointKeys(token.parent, center(token));

/** Défense apportée par le terrain (une forêt dense, une muraille couvrent plus). */
function terrainCover(token) {
  const { keys, names } = terrainOf(token);
  return Math.max(0, ...keys.map(k => {
    const t = BOOK_TERRAINS[k];
    if (!t?.cover) return 0;
    return t.dense && names.some(n => n.key === k && t.dense.test(n.name)) ? t.denseCover : t.cover;
  }));
}

/** Défense d'une troupe contre un mode d'attaque, avec son détail. */
export function defenseOf(token, mode, book) {
  const b = token.actor.system.book;
  const parts = [];
  let value = b.defendResult ?? b.defense;
  parts.push(`${loc(b.defendResult === null ? `${L}.Defense` : "AFC.Battle.Order.defend")} ${value}`);
  const add = (label, n) => { if (n) { value += n; parts.push(`${label} ${n > 0 ? "+" : "−"}${Math.abs(n)}`); } };
  add(loc(`${L}.Cover`), terrainCover(token));
  if (b.probing) add(orderName("probing"), BOOK_ORDERS.probing.defense);
  if (book.formations) {
    const f = BOOK_FORMATIONS[b.formation] ?? {};
    add(loc(`${L}.Formation.${b.formation}`), (f.def ?? 0) + (mode === "shoot" ? f.shootDef ?? 0 : f.fightDef ?? 0));
  }
  return { value: Math.max(0, value), parts };
}

/** Difficulté du test d'Art militaire : Discipline, désorganisation, personnage attaché, ordres du tour… */
export function orderDifficulty(token, key, book, battle, formation = null) {
  const s = token.actor.system, b = s.book;
  const parts = [{ label: loc(`${L}.Discipline`), value: s.discipline }];
  const add = (label, value) => { if (value) parts.push({ label, value }); };
  add(loc(`${L}.Status.disorganized`), b.penalties * 3);
  if (unitOf(battle, token.id).officer) add(loc(`${L}.Attached`), -3);
  if (book.formations) add(loc(`${L}.Formation.${b.formation}`), BOOK_FORMATIONS[b.formation]?.discipline ?? 0);
  add(orderName(key), BOOK_ORDERS[key]?.mod ?? 0);
  if (key === "formation" && formation) add(loc(`${L}.Formation.${formation}`), BOOK_FORMATIONS[formation]?.mod ?? 0);
  add(loc(`${L}.PriorOrders`), book.counts.filter(id => id === token.id).length * 3);
  add(orderName("suppress"), book.suppressed.filter(s => s.id === token.id).reduce((n, s) => n + s.n, 0));
  return { parts, total: Math.max(0, parts.reduce((n, p) => n + p.value, 0)) };
}

/** Déplacement en cases, terrain et météo compris. */
export function moveCases(token, book, weather, sprint = false) {
  const b = token.actor.system.book;
  const { keys } = terrainOf(token);
  const road = keys.some(k => BOOK_TERRAINS[k]?.road);
  let slow = road ? 0 : Math.max(0, ...keys.map(k => BOOK_TERRAINS[k]?.slow ?? 0));
  slow += BOOK_WEATHER[weather]?.slow ?? 0;
  if (book.formations) slow += BOOK_FORMATIONS[b.formation]?.slow ?? 0;
  if (book.formations && BOOK_FORMATIONS[b.formation]?.stop) return 0;
  const yards = Math.max(10, b.moveYards - slow * 10);
  return Math.floor((sprint ? yards * 4 : yards) / book.yards);
}

/** Portée de tir de la troupe, en cases. */
const rangeCases = (token, book) => {
  const shoot = token.actor.system.book.shoot;
  return shoot ? Math.floor(shoot.yards / book.yards) : 0;
};

/** Mode d'attaque possible contre une cible : Corps à corps au contact, sinon Tir à portée. */
export function attackModes(att, def, book) {
  const modes = [];
  if (adjacent(att, def)) modes.push("melee");
  if (att.actor.system.book.shoot && distance(att, def) <= rangeCases(att, book)) modes.push("shoot");
  return modes;
}

/* ---------- Cartes de chat ---------- */

const renderCard = data => foundry.applications.handlebars.renderTemplate(`systems/${SYSTEM_ID}/templates/chat/battle-order.hbs`, data);
const poolLabel = (p, test) => `${p.rank}D${test.bonus ? ` +${test.bonus}B` : ""}${p.penalty ? ` −${p.penalty}D` : ""}${p.modifier ? ` ${p.modifier > 0 ? "+" : "−"}${Math.abs(p.modifier)}` : ""}`;
const seal = (ok, degrees) => (ok ? String(degrees) : '<i class="fa-solid fa-xmark"></i>');
const chip = status => `<span class="state-chip ${BOOK_STATUS_CHIP[status]}">${loc(`${L}.Status.${status}`)}</span>`;
const outcomeLine = (name, html, notes = []) => `<strong class="troop">${esc(name)}</strong> ${html}${notes.length ? `<small>${notes.map(esc).join(" · ")}</small>` : ""}`;

async function postCard(card, rolls) {
  return ChatMessage.create({ rolls, content: await renderCard(card) });
}

/* ---------- Mouvement automatique sur la carte ---------- */

const offsetOf = token => canvas.grid.getOffset(center(token));
const sameOffset = (a, b) => a.i === b.i && a.j === b.j;

function occupied(offset, scene, exclude = []) {
  return troopsOf(scene).some(t => !exclude.includes(t.id) && t.actor.system.book.status !== "destroyed" && sameOffset(offsetOf(t), offset));
}
function passable(offset, scene) {
  const point = canvas.grid.getCenterPoint(offset);
  if (!canvas.dimensions.sceneRect.contains(point.x, point.y)) return false;
  const { keys, names } = pointKeys(scene, point);
  const crossing = keys.includes("ford") || keys.includes("bridge");
  return crossing || !keys.some(k => BOOK_TERRAINS[k]?.blocks || (BOOK_TERRAINS[k]?.wallBlocks && names.some(n => n.key === k && BOOK_TERRAINS[k].dense.test(n.name))));
}
function placeAt(token, offset) {
  const point = canvas.grid.getCenterPoint(offset);
  return token.update({ x: point.x - (token.width * canvas.grid.sizeX) / 2, y: point.y - (token.height * canvas.grid.sizeY) / 2 });
}

/** Pose l'attaquant sur la case libre au contact de sa cible la plus proche de lui. */
async function moveAdjacent(att, def) {
  if (adjacent(att, def)) return true;
  const from = center(att);
  const free = canvas.grid.getAdjacentOffsets(offsetOf(def)).filter(o => passable(o, att.parent) && !occupied(o, att.parent, [att.id]));
  if (!free.length) return false;
  const dist = o => { const c = canvas.grid.getCenterPoint(o); return Math.hypot(c.x - from.x, c.y - from.y); };
  await placeAt(att, free.reduce((best, o) => (dist(o) < dist(best) ? o : best)));
  return true;
}

/** Recule une troupe de n cases, à l'opposé d'une autre. Renvoie les cases parcourues et si elle a quitté la carte. */
async function pushAway(token, from, cases) {
  const scene = token.parent;
  const origin = center(from);
  let at = offsetOf(token), moved = 0, edge = false;
  for (let i = 0; i < cases; i++) {
    const here = canvas.grid.getCenterPoint(at);
    const away = Math.hypot(here.x - origin.x, here.y - origin.y);
    const options = canvas.grid.getAdjacentOffsets(at).map(o => {
      const c = canvas.grid.getCenterPoint(o);
      return { o, d: Math.hypot(c.x - origin.x, c.y - origin.y), inside: canvas.dimensions.sceneRect.contains(c.x, c.y) };
    }).filter(c => c.d > away);
    if (!options.some(c => c.inside)) { edge = true; break; }
    const next = options.filter(c => c.inside && passable(c.o, scene) && !occupied(c.o, scene, [token.id])).sort((a, b) => b.d - a.d)[0];
    if (!next) break;
    at = next.o;
    moved++;
  }
  if (moved) await placeAt(token, at);
  return { moved, edge };
}

/** Ennemis sur la ligne droite entre la troupe et sa cible, dans l'ordre (la cible en dernier). */
function enemiesOnLine(att, def) {
  const a = center(att), b = center(def);
  const steps = Math.max(1, distance(att, def) * 3);
  const side = att.actor.system.side;
  const found = [];
  for (let i = 1; i <= steps; i++) {
    const offset = canvas.grid.getOffset({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps });
    const hit = troopsOf(att.parent).find(t => t.actor.system.side !== side && t.actor.system.book.status !== "destroyed" && !found.includes(t) && sameOffset(offsetOf(t), offset));
    if (hit) found.push(hit);
  }
  return found.includes(def) ? found : [...found, def];
}

/* ---------- Attaque et dégâts ---------- */

/** Jet d'attaque d'une troupe. Renvoie la ligne de carte, le jet et les dégâts après armure. */
async function rollUnitAttack(att, def, mode, battle, book, { penalty = 0, base = 0, onHit = 0, b = 0, m = 0, charge = false, label = null } = {}) {
  const A = att.actor.system.book, D = def.actor.system.book;
  const weather = BOOK_WEATHER[battle.weather] ?? {};
  const tags = [];
  const rank = A.abilities[mode === "shoot" ? "marksmanship" : "fighting"];
  let dice = 0, pen = penalty, bonus = b, modifier = m + (weather.result ?? 0);
  if (penalty) tags.push(`${label ?? loc(`${L}.Order`)} −${penalty}D`);
  if (unitOf(battle, att.id).officer) { dice += 1; tags.push(`${loc(`${L}.Attached`)} +1D`); }
  if (A.penalties) { pen += A.penalties; tags.push(`${loc(`${L}.Status.disorganized`)} −${A.penalties}D`); }
  const wp = mode === "shoot" ? weather.shoot : weather.fight;
  if (wp) { pen += wp; tags.push(`${loc(`AFC.Battle.WeatherLabel`)} −${wp}D`); }
  if (weather.result) tags.push(`${loc(`AFC.Battle.WeatherLabel`)} ${weather.result}`);
  // Colline : dés de bonus contre un adversaire plus bas.
  const aKeys = terrainOf(att).keys, dKeys = terrainOf(def).keys;
  if (aKeys.includes("hill") && !dKeys.includes("hill")) { bonus += BOOK_TERRAINS.hill.bonus; tags.push(`${loc("AFC.Battle.Terrain.hill")} +1B`); }
  if (book.formations) {
    const f = BOOK_FORMATIONS[A.formation] ?? {};
    if (mode === "melee" && f.fightDice) { if (f.fightDice < 0) pen -= f.fightDice; else dice += f.fightDice; tags.push(`${loc(`${L}.Formation.${A.formation}`)} ${f.fightDice}D`); }
    if (charge && f.chargeDice) { dice += f.chargeDice; tags.push(`${loc(`${L}.Formation.${A.formation}`)} +${f.chargeDice}D`); }
    if (BOOK_FORMATIONS[D.formation]?.negateCharge && charge) base = 0;
  }
  const defense = defenseOf(def, mode, book);
  const pool = { rank: rank + dice, bonus, penalty: pen, modifier };
  const test = await rollDice({ ...pool, difficulty: defense.value });
  const hit = test.outcome.success;
  const degrees = hit ? test.outcome.degrees : 0;
  const weapon = (mode === "shoot" ? A.shoot?.damage ?? 0 : A.fightDamage) + base;
  const raw = hit ? weapon * degrees + onHit : 0;
  return {
    hit, degrees, raw, weapon, damage: Math.max(0, raw - D.ar), roll: test.roll,
    row: {
      name: att.name, sub: fmt(`${L}.AttackLine`, { mode: loc(`${L}.ModeLabel.${mode}`), d: def.name, n: defense.value }),
      total: test.total, dice: test.dice, pool: poolLabel(pool, test), tags: [...tags, ...defense.parts.slice(1)], winner: hit
    }
  };
}

/** Applique des dégâts : Santé, puis désorganisation, déroute (fuite au sprint), destruction. */
async function applyDamage(def, damage, from, battle, book) {
  const actor = def.actor;
  const b = actor.system.book;
  const notes = [];
  if (damage <= 0) return { status: b.status, notes: [loc(`${L}.ArmorHolds`)] };
  let status = b.status, left = b.damage, penalties = b.penalties;
  if (damage > b.health * 2) status = "destroyed";
  else if (status === "routed") status = "destroyed";
  else if (status === "disorganized") status = "routed";
  else {
    left += damage;
    if (left >= b.health) {
      left = b.health;
      status = "disorganized";
      penalties += 1;
      if (penalties >= b.abilities.endurance) { status = "destroyed"; notes.push(loc(`${L}.PenaltiesFull`)); }
    }
  }
  if (status === "destroyed") left = b.health;
  const update = { "system.book.damage": left, "system.book.status": status, "system.book.penalties": penalties, "system.book.wasDamaged": true };
  if (status === "routed" && book.formations) update["system.book.formation"] = "mob";
  await actor.update(update);
  // Personnage attaché : il encaisse aussi.
  const officerId = unitOf(battle, def.id).officer;
  const officer = officerId ? game.actors.get(officerId) : null;
  if (officer) notes.push(fmt(`${L}.AttachedHurt`, { name: officer.name, n: status === b.status ? BOOK_ATTACHED_DAMAGE.damaged : BOOK_ATTACHED_DAMAGE[status] }));
  if (status === "routed") {
    const flee = await pushAway(def, from, moveCases(def, book, battle.weather, true));
    notes.push(flee.edge ? loc(`${L}.FleeOff`) : fmt(`${L}.Flee`, { n: flee.moved }));
  }
  return { status, notes };
}

const damageOutcome = (def, attack, result) => outcomeLine(def.name, `<span class="tag">−${attack.damage} ${loc("AFC.BattleBook.HealthShort")}</span> ${chip(result.status)}`, result.notes);

/* ---------- Exécution d'un ordre (chez le MJ) ---------- */

function advanceTurn(book, scene) {
  const other = otherSide(book.turn);
  if (ordersLeft(book, other, scene) > 0) book.turn = other;
  else if (ordersLeft(book, book.turn, scene) <= 0) book.turn = "";
}

const nameOf = token => token?.name ?? "";

/** Effet d'un ordre réussi. Modifie la carte (rows, outcomes, rolls) et l'état. */
async function applyOrderEffect(token, key, data, target, ctx) {
  const { battle, book, card } = ctx;
  const order = BOOK_ORDERS[key];
  const actor = token.actor;
  const addAttack = async (def, opts) => {
    const mode = opts.mode ?? data.mode ?? attackModes(token, def, book)[0] ?? "melee";
    const attack = await rollUnitAttack(token, def, mode, battle, book, { b: data.ab, m: data.am, ...opts });
    card.rows.push(attack.row);
    ctx.rolls.push(attack.roll);
    if (attack.hit) {
      const result = await applyDamage(def, attack.damage, token, battle, book);
      card.outcomes.push(damageOutcome(def, attack, result));
    } else card.outcomes.push(outcomeLine(token.name, `<small>${fmt(`${L}.Missed`, { d: def.name })}</small>`));
    return attack;
  };
  switch (order.kind) {
    case "attack": {
      ctx.mode = data.mode ?? attackModes(token, target, book)[0] ?? "melee";
      if (token.hidden) await token.update({ hidden: false });
      await addAttack(target, { mode: ctx.mode, penalty: order.penalty ?? 0, base: order.damage ?? 0, label: orderName(key) });
      if (order.defense) await actor.update({ "system.book.probing": true });
      if (order.withdraw) card.note = fmt(`${L}.WithdrawMove`, { n: Math.floor(moveCases(token, book, battle.weather) / 2) });
      if (order.note) card.note = loc(`${L}.Note.${key}`);
      break;
    }
    case "charge": {
      // Une troupe qui attend la charge frappe la première, à double dégât d'arme.
      const reached = await moveAdjacent(token, target);
      if (!reached) card.note = loc(`${L}.NoRoom`);
      ctx.mode = "melee";
      if (target.actor.system.book.setCharge && target.actor.system.book.active) {
        const counter = await rollUnitAttack(target, token, "melee", battle, book, { label: orderName("setCharge") });
        const raw = counter.hit ? counter.weapon * (counter.degrees + 1) : 0;
        counter.damage = Math.max(0, raw - actor.system.book.ar);
        counter.row.sub = `${orderName("setCharge")} · ${counter.row.sub}`;
        card.rows.push(counter.row);
        ctx.rolls.push(counter.roll);
        if (counter.hit) card.outcomes.push(damageOutcome(token, counter, await applyDamage(token, counter.damage, target, battle, book)));
        await target.actor.update({ "system.book.setCharge": false });
      }
      if (actor.system.book.active) await addAttack(target, { mode: "melee", penalty: 1, base: 2, charge: true, label: orderName("charge") });
      break;
    }
    case "line": {
      ctx.mode = "melee";
      const line = enemiesOnLine(token, target);
      await moveAdjacent(token, target);
      for (const [i, def] of line.entries()) {
        await addAttack(def, { mode: "melee", penalty: i, label: orderName(key), onHit: order.damageOnHit ? order.damage : 0 });
      }
      break;
    }
    case "move":
      card.note = fmt(`${L}.MoveNote`, { n: moveCases(token, book, battle.weather), s: moveCases(token, book, battle.weather, true) });
      break;
    case "defend":
      await resolveDefend(token, ctx);
      break;
    case "ready":
      await actor.update({ "system.book.readied": data.condition || loc(`${L}.ReadyDefault`) });
      card.note = fmt(`${L}.ReadyNote`, { c: data.condition || loc(`${L}.ReadyDefault`) });
      break;
    case "organize":
      await actor.update({ "system.book.status": "organized", "system.book.damage": 0 });
      card.outcomes.push(outcomeLine(token.name, chip("organized"), [fmt(`${L}.PenaltiesKept`, { n: actor.system.book.penalties })]));
      break;
    case "rally":
      await actor.update({ "system.book.status": "disorganized" });
      card.outcomes.push(outcomeLine(token.name, chip("disorganized")));
      break;
    case "regroup": {
      const heal = Math.min(actor.system.book.damage, ctx.degrees);
      await actor.update({ "system.book.damage": actor.system.book.damage - heal });
      card.note = fmt(`${L}.Regrouped`, { n: heal });
      break;
    }
    case "setCharge":
      await actor.update({ "system.book.setCharge": true });
      break;
    case "formation":
      await actor.update({ "system.book.formation": data.formation });
      card.note = loc(`${L}.Formation.${data.formation}`);
      break;
    case "forceBack": {
      ctx.mode = "melee";
      const a = actor.system.book, d = target.actor.system.book;
      const difficulty = d.abilities.athletics * 4;
      const pool = { rank: a.abilities.fighting, penalty: a.penalties };
      const test = await rollDice({ ...pool, difficulty });
      ctx.rolls.push(test.roll);
      card.rows.push({ name: token.name, sub: fmt(`${L}.ForceLine`, { d: target.name, n: difficulty }), total: test.total, dice: test.dice, pool: poolLabel(pool, test), tags: [], winner: test.outcome.success });
      if (test.outcome.success) {
        const push = await pushAway(target, token, Math.max(1, Math.floor((test.outcome.degrees * 10) / book.yards)));
        card.note = fmt(`${L}.Pushed`, { d: target.name, n: push.moved });
      }
      break;
    }
    case "hammer": {
      ctx.mode = "melee";
      const a = actor.system.book, d = target.actor.system.book;
      const pa = { rank: a.abilities.athletics, penalty: a.penalties }, pd = { rank: d.abilities.athletics, penalty: d.penalties };
      const ta = await rollDice(pa), td = await rollDice(pd);
      ctx.rolls.push(ta.roll, td.roll);
      const won = ta.total > td.total;
      card.rows.push({ name: token.name, sub: loc("AFC.Ability.athletics"), total: ta.total, dice: ta.dice, pool: poolLabel(pa, ta), tags: [], winner: won });
      card.rows.push({ name: target.name, sub: loc("AFC.Ability.athletics"), total: td.total, dice: td.dice, pool: poolLabel(pd, td), tags: [], winner: !won });
      if (won) {
        const push = await pushAway(target, token, Math.floor(moveCases(token, book, battle.weather) / 2));
        card.note = `${fmt(`${L}.Pushed`, { d: target.name, n: push.moved })} ${loc(`${L}.Note.hammerAnvil`)}`;
      }
      break;
    }
    case "reform": {
      const worst = target.actor.system.book.damage >= actor.system.book.damage ? target : token;
      const kept = worst === target ? token : target;
      await worst.actor.update({ "system.book.status": "destroyed" });
      await kept.actor.update({ "system.book.damage": 0 });
      card.note = fmt(`${L}.Reformed`, { a: worst.name, b: kept.name });
      break;
    }
    case "suppress": {
      ctx.mode = "shoot";
      const attack = await rollUnitAttack(token, target, "shoot", battle, book, { b: data.ab, m: data.am, label: orderName(key) });
      card.rows.push(attack.row);
      ctx.rolls.push(attack.roll);
      if (attack.hit) {
        book.suppressed.push({ id: target.id, n: 3 + attack.degrees - 1 });
        const notes = [fmt(`${L}.Suppressed`, { n: 3 + attack.degrees - 1 })];
        if (attack.degrees >= 2) {
          attack.damage = Math.max(0, attack.weapon * (attack.degrees - 1) - target.actor.system.book.ar);
          const result = await applyDamage(target, attack.damage, token, battle, book);
          card.outcomes.push(damageOutcome(target, attack, { ...result, notes: [...notes, ...result.notes] }));
        } else card.outcomes.push(outcomeLine(target.name, "", notes));
      }
      break;
    }
    default:
      card.note = loc(`${L}.Note.${key}`);
  }
}

/** Défendre : le test d'Agilité remplace la Défense jusqu'au prochain ordre de la troupe. */
async function resolveDefend(token, ctx) {
  const b = token.actor.system.book;
  const shield = token.actor.system.has.shields ? 2 : 0;
  const pool = { rank: b.abilities.agility, penalty: b.penalties, modifier: shield };
  const test = await rollDice(pool);
  await token.actor.update({ "system.book.defendResult": test.total });
  ctx.rolls.push(test.roll);
  ctx.card.rows.push({
    name: token.name, sub: fmt(`${L}.DefendLine`, { n: test.total }), total: test.total, dice: test.dice, pool: poolLabel(pool, test),
    tags: shield ? [`${loc("AFC.Battle.Trait.shields.name")} +${shield}`] : [], winner: true
  });
}

/** Ordre donné à une troupe : test d'Art militaire, puis effet. S'exécute chez le MJ. */
async function executeOrder(data) {
  const scene = game.scenes.get(data.scene);
  if (scene?.id !== canvas.scene?.id) return ui.notifications.warn(loc(`${L}.GmElsewhere`));
  const battle = getBattle(scene);
  const book = bookState(battle);
  const token = scene.tokens.get(data.token);
  const target = data.target ? scene.tokens.get(data.target) : null;
  const commander = game.actors.get(data.commander);
  const warfare = warfareOf(commander);
  const order = BOOK_ORDERS[data.order];
  if (!token?.actor || !warfare || !order) return;
  const diff = orderDifficulty(token, data.order, book, battle, data.formation);
  const pool = { rank: warfare.rank, bonus: specialtyBonus(warfare, COMMAND) + (data.b ?? 0), modifier: data.m ?? 0 };
  const test = await rollDice({ ...pool, difficulty: diff.total });
  const success = test.outcome.success, critical = !success && test.outcome.degrees >= 2;
  const side = token.actor.system.side;
  const unit = unitOf(battle, token.id);
  book.used.push(commander.id);
  book.counts.push(token.id);
  book.turn = side;

  const card = {
    success, seal: seal(success, test.outcome.degrees), rows: [], outcomes: [], note: "",
    verdict: fmt(`${L}.OrderVerdict.${success ? "ok" : critical ? "critical" : "fail"}`, { unit: token.name, order: orderName(data.order) }),
    detail: fmt(`${L}.OrderDetail`, { who: commander.name, n: diff.total, detail: diff.parts.map(p => `${p.label} ${p.value}`).join(" + ") })
  };
  card.rows.push({ name: commander.name, sub: `${loc("AFC.Ability.warfare")} · ${orderName(data.order)}`, total: test.total, dice: test.dice, pool: poolLabel(pool, test), tags: [], winner: success });
  const ctx = { battle, book, card, rolls: [test.roll], degrees: test.outcome.degrees, mode: "" };

  if (success) {
    book.acted.push(token.id);
    await token.actor.update({ "system.book.defendResult": null, "system.book.setCharge": false, "system.book.readied": "" });
    await applyOrderEffect(token, data.order, data, target, ctx);
    await token.actor.setFlag(SYSTEM_ID, "unit", { order: data.order, target: target?.id ?? "", officer: unit.officer, countered: false, mode: ctx.mode });
  } else {
    if (critical) book.noStanding.push(token.id);
    if (!unit.order) card.note = loc(`${L}.NoStanding`);
    else if (critical) card.note = loc(`${L}.CriticalStanding`);
    else card.note = fmt(`${L}.FollowsStanding`, { order: orderName(unit.order) });
    // Échec critique : un repli se transforme en désorganisation, une retraite en déroute.
    if (critical && order.critical === "disorganize" && token.actor.system.book.status === "organized") {
      await token.actor.update({ "system.book.status": "disorganized", "system.book.penalties": token.actor.system.book.penalties + 1 });
      card.outcomes.push(outcomeLine(token.name, chip("disorganized")));
    }
    if (critical && order.critical === "rout") {
      await token.actor.update({ "system.book.status": "routed" });
      card.outcomes.push(outcomeLine(token.name, chip("routed")));
    }
  }
  advanceTurn(book, scene);
  await saveBook(battle, book);
  return postCard(card, ctx.rolls);
}
gmHandlers.bookOrder = executeOrder;

/* ---------- Ordres permanents ---------- */

/** Ce que la troupe refera sans nouvel ordre, et contre qui. */
function standingAction(token, battle, book) {
  const unit = unitOf(battle, token.id);
  const standing = BOOK_ORDERS[unit.order]?.standing;
  if (!standing || !token.actor.system.book.active) return null;
  if (book.acted.includes(token.id) || book.noStanding.includes(token.id)) return null;
  if (standing !== "attack") return { kind: standing, order: unit.order };
  const side = token.actor.system.side;
  const enemies = activeTroops(otherSide(side), token.parent).filter(t => !t.hidden || game.user.isGM);
  const stored = enemies.find(t => t.id === unit.target && adjacent(token, t));
  const contact = stored ?? enemies.find(t => adjacent(token, t));
  if (contact) return { kind: "attack", order: unit.order, target: contact, mode: "melee" };
  if (unit.mode !== "shoot") return null;
  const inRange = enemies.filter(t => distance(token, t) <= rangeCases(token, book)).sort((a, b) => distance(token, a) - distance(token, b));
  return inRange[0] ? { kind: "attack", order: unit.order, target: inRange[0], mode: "shoot" } : null;
}

/** File des ordres permanents : un camp puis l'autre, en partant du vainqueur de l'initiative. */
export function standingQueue(battle = getBattle(), book = bookState(battle), scene = canvas.scene) {
  const list = side => sideTroops(side, scene).map(token => ({ token, action: standingAction(token, battle, book) })).filter(x => x.action);
  const first = book.first || "company";
  const a = list(first), b = list(otherSide(first));
  const queue = [];
  while (a.length || b.length) {
    if (a.length) queue.push(a.shift());
    if (b.length) queue.push(b.shift());
  }
  return queue;
}

async function resolveStanding(next, battle, book) {
  const { token, action } = next;
  const card = { success: true, seal: '<i class="fa-solid fa-rotate-right"></i>', rows: [], outcomes: [], note: "", verdict: fmt(`${L}.StandingVerdict`, { unit: token.name, order: orderName(action.order) }), detail: loc(`${L}.StandingDetail`) };
  const ctx = { battle, book, card, rolls: [] };
  book.acted.push(token.id);
  if (action.kind === "attack") {
    await token.actor.update({ "system.book.defendResult": null });
    const attack = await rollUnitAttack(token, action.target, action.mode, battle, book, {});
    card.rows.push(attack.row);
    ctx.rolls.push(attack.roll);
    if (attack.hit) card.outcomes.push(damageOutcome(action.target, attack, await applyDamage(action.target, attack.damage, token, battle, book)));
    else card.outcomes.push(outcomeLine(token.name, `<small>${fmt(`${L}.Missed`, { d: action.target.name })}</small>`));
  } else if (action.kind === "defend") await resolveDefend(token, ctx);
  else if (action.kind === "withdraw") card.note = fmt(`${L}.StandingWithdraw`, { n: moveCases(token, book, battle.weather) });
  else if (action.kind === "retreat") card.note = fmt(`${L}.StandingRetreat`, { n: moveCases(token, book, battle.weather) });
  await saveBook(battle, book);
  return postCard(card, ctx.rolls);
}

/* ---------- Conduite du tour (MJ) ---------- */

async function rollInitiative(battle, book) {
  const rows = [], rolls = [];
  const scores = {};
  for (const side of SIDES) {
    const commander = game.actors.get(book.commanders[side].commander);
    const warfare = warfareOf(commander);
    const pool = { rank: warfare.rank, bonus: specialtyBonus(warfare, STRATEGY) };
    const test = await rollDice(pool);
    rolls.push(test.roll);
    scores[side] = { total: test.total, rank: warfare.rank, bonus: pool.bonus };
    rows.push({ name: commander.name, sub: loc(`AFC.Battle.Side.${side}`), total: test.total, dice: test.dice, pool: poolLabel(pool, test), tags: [], side });
  }
  const { company: c, enemy: e } = scores;
  const first = c.total !== e.total ? (c.total > e.total ? "company" : "enemy")
    : c.rank !== e.rank ? (c.rank > e.rank ? "company" : "enemy")
      : c.bonus !== e.bonus ? (c.bonus > e.bonus ? "company" : "enemy") : (Math.random() < 0.5 ? "company" : "enemy");
  for (const row of rows) row.winner = row.side === first;
  Object.assign(book, { first, turn: first, initiative: { company: c.total, enemy: e.total }, phase: "actions1", used: [], counts: [], acted: [], noStanding: [], suppressed: [], passed: [] });
  // La Défense d'attaque prudente tient jusqu'au début du tour suivant.
  for (const t of troopsOf()) if (t.actor.system.book.probing) await t.actor.update({ "system.book.probing": false });
  await saveBook(battle, book);
  return postCard({
    success: true, seal: String(battle.round), rows, outcomes: [], note: loc(`${L}.Actions1Hint`),
    verdict: fmt(`${L}.InitiativeVerdict`, { side: loc(`AFC.Battle.Side.${first}`) }), detail: fmt(`${L}.InitiativeDetail`, { n: battle.round })
  }, rolls);
}

/** Bouton « étape suivante » de la barre et de la fenêtre. */
export async function nextStep() {
  if (!game.user.isGM) return;
  const battle = getBattle();
  const book = bookState(battle);
  if (book.phase === "setup" || book.phase === "end") {
    if (SIDES.some(side => !warfareOf(game.actors.get(book.commanders[side].commander)))) {
      ui.notifications.info(loc(`${L}.NeedCommanders`));
      if (!(await chooseCommanders())) return;
      return nextStep();
    }
    if (book.phase === "end") battle.round += 1;
    return rollInitiative(battle, book);
  }
  const flow = { actions1: "orders", orders: "actions2", actions2: "standing", standing: "end" };
  book.phase = flow[book.phase];
  if (book.phase === "orders") {
    book.turn = book.first;
    if (ordersLeft(book, book.turn) <= 0) book.turn = otherSide(book.first);
  }
  await saveBook(battle, book);
}

/** Le camp dont c'est le tour renonce à ses ordres restants. */
export async function passTurn() {
  const battle = getBattle();
  const book = bookState(battle);
  if (!book.turn) return;
  book.passed.push(book.turn);
  const other = otherSide(book.turn);
  book.turn = ordersLeft(book, other) > 0 ? other : "";
  return saveBook(battle, book);
}
gmHandlers.bookPass = passTurn;

export async function resolveNextStanding() {
  const battle = getBattle();
  const book = bookState(battle);
  const next = standingQueue(battle, book)[0];
  if (next) return resolveStanding(next, battle, book);
}
export async function resolveAllStanding() {
  for (;;) {
    const battle = getBattle();
    const book = bookState(battle);
    const next = standingQueue(battle, book)[0];
    if (!next) return;
    await resolveStanding(next, battle, book);
  }
}

/* ---------- Attaque libre (MJ) et troupe prête ---------- */

async function attackDialog(att, def, book, title) {
  const modes = attackModes(att, def, book);
  const list = modes.length ? modes : ["melee"];
  return DialogV2.prompt({
    window: { title }, classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog afc-battle-roll">
      ${modes.length ? "" : `<p class="hint warn">${loc(`${L}.OutOfReach`)}</p>`}
      ${list.length > 1 ? `<label>${loc(`${L}.Mode`)}<select name="mode">${list.map(m => `<option value="${m}">${loc(`${L}.ModeLabel.${m}`)}</option>`).join("")}</select></label>` : `<input type="hidden" name="mode" value="${list[0]}">`}
      <div class="grid-3"><label>+B<input type="number" name="b" value="0"></label><label>−D<input type="number" name="p" value="0"></label><label>±<input type="number" name="m" value="0"></label></div></div>`,
    ok: { label: loc("AFC.Battle.Roll"), callback: (ev, button) => { const f = button.form.elements; return { mode: f.mode.value, b: Number(f.b.value) || 0, p: Number(f.p.value) || 0, m: Number(f.m.value) || 0 }; } },
    rejectClose: false
  });
}

async function executeFreeAttack(data) {
  const scene = game.scenes.get(data.scene);
  if (scene?.id !== canvas.scene?.id) return ui.notifications.warn(loc(`${L}.GmElsewhere`));
  const battle = getBattle(scene);
  const book = bookState(battle);
  const att = scene.tokens.get(data.token), def = scene.tokens.get(data.target);
  if (!att?.actor || !def?.actor) return;
  const attack = await rollUnitAttack(att, def, data.mode, battle, book, { b: data.b, m: data.m, penalty: data.p, label: loc(`${L}.FreeAttack`) });
  const card = {
    success: attack.hit, seal: seal(attack.hit, attack.degrees), rows: [attack.row], outcomes: [], note: "",
    verdict: fmt(`${L}.${data.ready ? "ReadyVerdict" : "FreeVerdict"}`, { unit: att.name, d: def.name }), detail: loc(`${L}.FreeDetail`)
  };
  if (attack.hit) card.outcomes.push(damageOutcome(def, attack, await applyDamage(def, attack.damage, att, battle, book)));
  if (data.ready) await att.actor.update({ "system.book.readied": "" });
  return postCard(card, [attack.roll]);
}
gmHandlers.bookFree = executeFreeAttack;

export async function freeAttack(att, def, { ready = false } = {}) {
  const book = bookState();
  const opts = await attackDialog(att, def, book, fmt(`${L}.FreeTitle`, { a: att.name, d: def.name }));
  if (opts) return requestGM("bookFree", { scene: canvas.scene.id, token: att.id, target: def.id, ready, ...opts });
}

/* ---------- Donner un ordre (côté joueur et MJ) ---------- */

/** Le MJ, ou un joueur qui possède la troupe ou un commandant du camp. */
export function canOrder(token, book = bookState()) {
  if (game.user.isGM) return true;
  if (token.actor?.isOwner) return true;
  return commandersOf(book, token.actor?.system.side).some(c => c.owned);
}

/** Ordres proposés pour cette troupe, selon son statut et les options de la bataille. */
export function availableOrders(token, book) {
  const b = token.actor.system.book;
  if (!b.active && b.status !== "routed") return [];
  return Object.keys(BOOK_ORDERS).filter(key => {
    const o = BOOK_ORDERS[key];
    if (b.status === "routed") return key === "rally";
    if (o.only && o.only !== b.status) return false;
    if (o.advanced && !book.advanced) return false;
    if (o.hiddenOnly && !token.hidden) return false;
    if (o.shootOnly && !b.shoot) return false;
    if (o.cavalryOnly && !b.mounted) return false;
    if (key === "regroup" && !b.damage) return false;
    if (key === "formation" && !book.formations) return false;
    if (book.formations && BOOK_FORMATIONS[b.formation]?.noAttack && o.target === "enemy") return false;
    return true;
  });
}

/** Clic sur un ordre : cible éventuelle, dialogue court, puis exécution chez le MJ. */
export async function giveBookOrder(token, key) {
  const book = bookState();
  const order = BOOK_ORDERS[key];
  if (book.phase !== "orders") return ui.notifications.warn(loc(`${L}.NotOrders`));
  const side = token.actor.system.side;
  if (book.turn !== side && !game.user.isGM) return ui.notifications.warn(loc(`${L}.NotYourTurn`));
  if (!order.target) return orderDialog(token, key, null);
  startTargetPick(token, hit => {
    const wrongSide = order.target === "enemy" ? hit.actor.system.side === side : hit.actor.system.side !== side;
    if (wrongSide) return ui.notifications.warn(loc(`${L}.WrongTarget.${order.target}`));
    return orderDialog(token, key, hit);
  });
}

async function orderDialog(token, key, target) {
  const battle = getBattle();
  const book = bookState(battle);
  const side = token.actor.system.side;
  const commanders = commandersOf(book, side).filter(c => c.left > 0 && (game.user.isGM || c.owned));
  if (!commanders.length) return ui.notifications.warn(loc(`${L}.NoCommander`));
  const order = BOOK_ORDERS[key];
  const warnings = [];
  const modes = target && order.target === "enemy" ? attackModes(token, target, book) : [];
  const sprint = moveCases(token, book, battle.weather, true);
  if (["charge", "line"].includes(order.kind) && distance(token, target) > sprint + 1) warnings.push(fmt(`${L}.TooFar`, { d: distance(token, target), n: sprint }));
  if (["attack", "forceBack", "hammer", "suppress"].includes(order.kind) && !modes.length) warnings.push(loc(`${L}.OutOfReach`));
  if (order.kind === "reform" && !adjacent(token, target)) warnings.push(loc(`${L}.NotAdjacent`));
  const diff = orderDifficulty(token, key, book, battle);
  const showMode = order.kind === "attack" && modes.length > 1;
  const preview = target && order.target === "enemy" ? fmt(`${L}.Preview`, { d: target.name }) : "";
  const data = await DialogV2.prompt({
    window: { title: `${token.name} : ${orderName(key)}` }, classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog afc-battle-roll">
      ${warnings.map(w => `<p class="hint warn">${esc(w)}</p>`).join("")}
      <p>${loc(`${L}.Difficulty`)} : <b data-diff>${diff.total}</b> <small data-diff-detail>(${diff.parts.map(p => `${esc(p.label)} ${p.value}`).join(" + ")})</small></p>
      ${preview ? `<p class="hint">${esc(preview)}</p>` : ""}
      <p class="hint">${orderHelp(key)}</p>
      <label>${loc(`${L}.Commander`)}<select name="commander">${commanders.map(c => `<option value="${c.id}">${esc(c.name)} (${c.left})</option>`).join("")}</select></label>
      ${showMode ? `<label>${loc(`${L}.Mode`)}<select name="mode">${modes.map(m => `<option value="${m}" ${m === "melee" ? "selected" : ""}>${loc(`${L}.ModeLabel.${m}`)}</option>`).join("")}</select></label>` : ""}
      ${order.kind === "ready" ? `<label>${loc(`${L}.ReadyCondition`)}<input type="text" name="condition" placeholder="${esc(loc(`${L}.ReadyDefault`))}"></label>` : ""}
      ${order.kind === "formation" ? `<label>${loc(`${L}.FormationLabel`)}<select name="formation">${Object.keys(BOOK_FORMATIONS).filter(k => k !== "none").map(k => `<option value="${k}">${loc(`${L}.Formation.${k}`)}</option>`).join("")}</select></label>` : ""}
      <div class="grid-3"><label>${loc(`${L}.BonusWarfare`)}<input type="number" name="b" value="0"></label><label>±<input type="number" name="m" value="0"></label></div></div>`,
    ok: {
      label: loc("AFC.Battle.Roll"),
      callback: (ev, button) => {
        const f = button.form.elements;
        return { commander: f.commander.value, b: Number(f.b.value) || 0, m: Number(f.m.value) || 0, mode: f.mode?.value, condition: f.condition?.value?.trim(), formation: f.formation?.value };
      }
    },
    rejectClose: false
  });
  if (data) return requestGM("bookOrder", { scene: canvas.scene.id, token: token.id, target: target?.id ?? "", order: key, ...data });
}

/* ---------- Menu du jeton ---------- */

/** Colonne de gauche du menu du jeton, en règles du livre. */
export function fillBookHUD(hud, token, addButton) {
  const battle = getBattle();
  const book = bookState(battle);
  if (!canOrder(token, book)) return;
  const unit = unitOf(battle, token.id);
  const orders = availableOrders(token, book);
  if (orders.length) {
    const palette = document.createElement("div");
    palette.className = "afc-order-palette book";
    for (const key of orders) {
      const o = document.createElement("button");
      o.type = "button";
      o.className = `control-icon${unit.order === key ? " active" : ""}${BOOK_ORDERS[key].advanced ? " advanced" : ""}`;
      o.dataset.tooltip = `${orderName(key)} (${fmt(`${L}.DifficultyShort`, { n: orderDifficulty(token, key, book, battle).total })}) : ${orderHelp(key)}`;
      o.innerHTML = `<i class="fa-solid ${BOOK_ORDERS[key].icon}"></i>`;
      o.addEventListener("click", event => {
        event.stopPropagation();
        hud.close();
        giveBookOrder(token, key);
      });
      palette.append(o);
    }
    addButton(BOOK_ORDERS[unit.order]?.icon ?? "fa-flag", loc("AFC.Battle.GiveOrder"), () => palette.classList.toggle("open"), { active: !!unit.order }).append(palette);
  }
  if (token.actor.system.book.readied) {
    addButton("fa-bell", fmt(`${L}.ReadyTrigger`, { c: token.actor.system.book.readied }), () => {
      hud.close();
      startTargetPick(token, hit => freeAttack(token, hit, { ready: true }));
    });
  }
}

/* ---------- Barre de bataille ---------- */

/** Contenu de la barre en règles du livre : phase, à qui le tour, boutons de l'étape. */
export function bookBar(battle, scene, button) {
  const book = bookState(battle);
  const gm = game.user.isGM;
  const phase = loc(`${L}.Phase.${book.phase}`);
  let info = "", actions = "", revealed = false;
  if (book.phase === "setup") {
    const names = SIDES.map(s => game.actors.get(book.commanders[s].commander)?.name ?? "—").join(" / ");
    info = gm ? fmt(`${L}.BarSetup`, { names: esc(names) }) : loc(`${L}.BarWait`);
    if (gm) actions = button("bookCommanders", "fa-user-tie", loc(`${L}.Commanders`)) + button("bookNext", "fa-dice", loc(`${L}.RollInitiative`), { primary: true });
  } else if (book.phase === "actions1" || book.phase === "actions2") {
    info = loc(`${L}.BarActions`);
    if (gm) actions = button("bookNext", "fa-forward-step", loc(`${L}.Next.${book.phase}`), { primary: true });
  } else if (book.phase === "orders") {
    revealed = true;
    const left = SIDES.map(s => ordersLeft(book, s, scene));
    if (!book.turn) info = loc(`${L}.BarOrdersDone`);
    else {
      const n = ordersLeft(book, book.turn, scene);
      const mine = gm || (book.turn === "company" && commandersOf(book, "company", scene).some(c => c.owned));
      info = mine ? fmt(`${L}.BarYourTurn`, { side: loc(`AFC.Battle.Side.${book.turn}`), n }) : fmt(`${L}.BarTheirTurn`, { side: loc(`AFC.Battle.Side.${book.turn}`), n });
      if (mine) actions += button("bookPass", "fa-hand", loc(`${L}.Pass`));
    }
    if (gm) actions += button("bookNext", "fa-forward-step", loc(`${L}.Next.orders`), { primary: left[0] + left[1] === 0 || !book.turn });
  } else if (book.phase === "standing") {
    const queue = standingQueue(battle, book, scene);
    info = queue.length ? fmt(`${L}.BarStanding`, { unit: esc(queue[0].token.name), n: queue.length }) : loc(`${L}.BarStandingDone`);
    if (gm && queue.length) actions += button("bookResolve", "fa-rotate-right", loc("AFC.Battle.Resolve"), { primary: true }) + button("bookAll", "fa-forward-fast", loc(`${L}.ResolveAll`));
    if (gm) actions += button("bookNext", "fa-forward-step", loc(`${L}.Next.standing`), { primary: !queue.length });
  } else {
    info = loc(`${L}.BarEnd`);
    if (gm) actions = button("bookNext", "fa-dice", loc(`${L}.NextRound`), { primary: true }) + button("bookReport", "fa-scroll", loc("AFC.Battle.Report"));
  }
  return { phase, info, actions, revealed };
}

/** Clics de la barre propres au livre. */
export function onBookBar(action) {
  if (action === "bookNext") return nextStep();
  if (action === "bookCommanders") return chooseCommanders();
  if (action === "bookPass") return requestGM("bookPass", {});
  if (action === "bookResolve") return resolveNextStanding();
  if (action === "bookAll") return resolveAllStanding();
  if (action === "bookReport") return bookReport();
}

/* ---------- Fenêtre Bataille ---------- */

export function bookContext(battle, scene, { orderLabel }) {
  const book = bookState(battle);
  const isGM = game.user.isGM;
  const view = token => {
    const s = token.actor.system, b = s.book;
    const unit = unitOf(battle, token.id);
    const target = unit.target ? scene.tokens.get(unit.target) : null;
    const officer = unit.officer ? game.actors.get(unit.officer) : null;
    const known = isGM || s.side === "company";
    const mine = canOrder(token, book);
    const yours = mine && book.phase === "orders" && (isGM || book.turn === s.side);
    return {
      id: token.id, name: token.name, img: token.texture.src, hex: hexNumber(token), hidden: token.hidden, side: s.side, known, mine,
      status: b.status, chip: BOOK_STATUS_CHIP[b.status], statusLabel: `${L}.Status.${b.status}`,
      health: b.health, left: b.healthLeft, percent: b.health ? Math.round((b.healthLeft / b.health) * 100) : 0,
      defense: defenseOf(token, "melee", book).value, ar: b.ar, damage: b.fightDamage, shoot: b.shoot,
      discipline: orderDifficulty(token, "move", book, battle).total, penalties: b.penalties,
      move: moveCases(token, book, battle.weather), sprint: moveCases(token, book, battle.weather, true),
      range: rangeCases(token, book), orderText: unit.order ? orderLabel(unit.order) : "", orderIcon: BOOK_ORDERS[unit.order]?.icon ?? "fa-flag",
      targetName: target && (isGM || !target.hidden) ? target.name : null, officerName: officer?.name ?? null,
      readied: b.readied, formation: book.formations && b.formation !== "none" ? `${L}.Formation.${b.formation}` : null,
      priorOrders: book.counts.filter(id => id === token.id).length, acted: book.acted.includes(token.id),
      options: yours ? availableOrders(token, book).map(key => ({ key, label: orderLabel(key) })) : null
    };
  };
  const side = key => sideTroops(key, scene).filter(t => isGM || key === "company" || !t.hidden).map(view);
  const cmd = key => commandersOf(book, key, scene).map(c => ({ name: c.name, role: c.role, left: c.left, max: c.max }));
  return {
    bookData: book, phaseLabel: `${L}.Phase.${book.phase}`,
    turnLabel: book.turn ? `AFC.Battle.Side.${book.turn}` : null,
    company: side("company"), enemy: side("enemy"), cmdCompany: cmd("company"), cmdEnemy: cmd("enemy"),
    weathers: Object.fromEntries(Object.keys(BOOK_WEATHER).map(k => [k, `${L}.Weather.${k}`])),
    weatherLabel: `${L}.Weather.${battle.weather in BOOK_WEATHER ? battle.weather : "clear"}`,
    bookOrders: Object.keys(BOOK_ORDERS).filter(k => k !== "formation" || book.formations).filter(k => book.advanced || !BOOK_ORDERS[k].advanced).map(k => ({
      key: k, label: orderLabel(k), icon: BOOK_ORDERS[k].icon, mod: BOOK_ORDERS[k].mod, help: orderHelp(k)
    }))
  };
}

/* ---------- Bilan (tables 10-5 et 10-6) ---------- */

export async function bookReport() {
  const scene = canvas.scene;
  const rolls = [];
  const row = async t => {
    const b = t.actor.system.book;
    const column = b.status === "destroyed" ? "destroyed" : b.status === "routed" ? "routed" : b.status === "disorganized" || b.penalties ? "disorganized" : b.wasDamaged ? "damaged" : "noDamage";
    const roll = await new Roll("1d6").evaluate();
    rolls.push(roll);
    const value = Math.max(0, Math.min(6, roll.total - b.penalties));
    const result = BOOK_SURVIVORS[column][value];
    const text = result === "destroyed" ? loc(`${L}.Status.destroyed`) : result === 0 ? loc(`${L}.Intact`) : fmt(`${L}.TrainingStep`, { n: `${result > 0 ? "+" : "−"}${Math.abs(result)}` });
    return `<tr><td>${esc(t.name)}</td><td>${loc(`${L}.Status.${b.status}`)}</td><td class="center">${roll.total}${b.penalties ? ` −${b.penalties}` : ""}</td><td>${esc(text)}</td></tr>`;
  };
  const table = async side => {
    const rows = [];
    for (const t of sideTroops(side, scene)) rows.push(await row(t));
    return `<h4>${loc(`AFC.Battle.Side.${side}`)}</h4><table class="afc-table"><thead><tr><th>${loc("AFC.Battle.Troop")}</th><th>${loc("AFC.Battle.StateLabel")}</th><th class="center">1d6</th><th>${loc(`${L}.Survivors`)}</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
  };
  const beaten = side => sideTroops(side, scene).filter(t => !t.actor.system.book.active).length;
  const glory = side => {
    const mine = sideTroops(side, scene).length || 1, foes = sideTroops(otherSide(side), scene).length;
    return bookGlory(beaten(otherSide(side)), foes / mine);
  };
  const content = `<div class="afc-card battle"><header><h3>${loc("AFC.Battle.ReportTitle")}</h3></header>
    ${await table("company")}${await table("enemy")}
    <p>${fmt(`${L}.GloryLine`, { c: glory("company"), e: glory("enemy") })}</p><p class="hint">${loc(`${L}.ReportHint`)}</p></div>`;
  return ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM"), rolls, content });
}

/* ---------- Santé sur le jeton ---------- */

/** Barre de Santé, dans le haut du jeton (règles du livre). */
export function drawBookHealth(token) {
  token.children.filter(c => c.name === "afcHealth").forEach(c => c.destroy({ children: true }));
  const actor = token.document.actor;
  if (actor?.type !== "troop" || !isBook(token.document.parent)) return;
  const b = actor.system.book;
  if (!b.health || b.status === "destroyed") return;
  const bar = new PIXI.Graphics();
  bar.name = "afcHealth";
  const w = token.w * 0.6, h = 7, x = (token.w - w) / 2, y = token.h * 0.16;
  const ratio = b.healthLeft / b.health;
  bar.beginFill(0x1b140d, 0.9).drawRoundedRect(x - 1, y - 1, w + 2, h + 2, 3).endFill();
  bar.beginFill(ratio > 0.5 ? 0x5f8f3e : ratio > 0.25 ? 0xc9a227 : 0xa83226, 1).drawRect(x, y, w * ratio, h).endFill();
  token.addChild(bar);
}

