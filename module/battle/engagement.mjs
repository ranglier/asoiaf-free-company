/**
 * Résolution des engagements : tir et mêlée (bonus calculés depuis les ordres, le terrain, les
 * traits et les flancs), pertes d'états avec encaissement, ralliement, fin de tour et bilan.
 */
import { SYSTEM_ID } from "../config.mjs";
import { specialtyBonus } from "../data/actor-character.mjs";
import { rollDice } from "../dice/test-roll.mjs";
import {
  MAX_LOSS, MOVING_ORDERS, STATE_ORDER, TERRAINS, TRIANGLE, TROOP_STATES, WEATHER
} from "./battle-config.mjs";
import { getBattle, groupOfToken, saveBattle } from "./state.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const TACTICS = ["tactiques", "tactics"];
const COMMAND = ["commandement", "command"];

/* ---------- Carte : terrain, contact, distance ---------- */

const center = token => token.object?.center ?? { x: token.x + (token.width * canvas.grid.sizeX) / 2, y: token.y + (token.height * canvas.grid.sizeY) / 2 };

/** Terrains de la case d'un jeton (régions de la scène reconnues à leur nom). */
export function terrainAt(token) {
  const point = { ...center(token), elevation: 0 };
  const keys = new Set();
  for (const region of token.parent.regions) {
    const key = Object.entries(TERRAINS).find(([, t]) => t.match.test(region.name))?.[0];
    if (key && region.testPoint(point)) keys.add(key);
  }
  return [...keys];
}
const terrainValue = (keys, prop) => Math.max(0, ...keys.map(k => TERRAINS[k][prop] ?? 0));
const terrainHas = (keys, prop) => keys.some(k => TERRAINS[k][prop]);

/** Deux jetons sont-ils au contact (cases voisines) ? */
export function adjacent(a, b) {
  return canvas.grid.testAdjacency(canvas.grid.getOffset(center(a)), canvas.grid.getOffset(center(b)));
}

/** Distance en cases entre deux jetons. */
export function distance(a, b) {
  return canvas.grid.measurePath([center(a), center(b)]).spaces;
}

const alive = token => token.actor && !["routed", "destroyed"].includes(token.actor.system.state);
/** Troupes d'un camp au contact d'un jeton, sauf celles exclues. */
function flankers(target, side, exclude) {
  return target.parent.tokens.filter(t => t.actor?.type === "troop" && t.actor.system.side === side
    && !exclude.includes(t.id) && alive(t) && adjacent(t, target)).length;
}

/* ---------- Qui lance le dé ---------- */

/** Officier du groupe (Art militaire, Tactiques ou spécialité donnée), sinon rang de la troupe. */
function roller(token, battle, specialties = TACTICS) {
  const group = groupOfToken(battle, token.id);
  const officer = group?.officer ? game.actors.get(group.officer) : null;
  const warfare = officer?.system.abilities?.warfare;
  if (warfare) {
    return { name: officer.name, rank: warfare.rank, bonus: specialtyBonus(warfare, specialties), officer: true };
  }
  return { name: fmt("AFC.Battle.UnitRank", { name: token.name }), rank: token.actor.system.rank, bonus: 0, officer: false };
}

/* ---------- Calcul des modificateurs ---------- */

/** Une ligne de modificateur : dés de bonus (b), dés de test en plus (d), dés de malus (p). */
const mod = (label, { b = 0, d = 0, p = 0 } = {}) => ({ label, b, d, p });

/** Modificateurs de mêlée pour l'attaquant et le défenseur. */
export function meleeMods(att, def, battle) {
  const A = att.actor.system, D = def.actor.system;
  const aGroup = groupOfToken(battle, att.id), dGroup = groupOfToken(battle, def.id);
  const aOrder = aGroup?.order ?? "", dOrder = dGroup?.order ?? "";
  const charging = aOrder === "charge";
  const dTerrain = terrainAt(def), aTerrain = terrainAt(att);
  const am = [], dm = [], warnings = [];

  // Triangle (Choc : une cavalerie qui charge de l'infanterie annule le bonus de Tenir).
  if (TRIANGLE[aOrder] === dOrder) am.push(mod(loc("AFC.Battle.Mod.triangle"), { b: 1 }));
  if (TRIANGLE[dOrder] === aOrder) {
    const wall = D.has.shields && dOrder === "hold";
    const shock = charging && (A.has.shock || A.has.heavyShock) && !D.has.mounted && !D.has.pikes && !wall;
    if (shock) am.push(mod(loc("AFC.Battle.Mod.shockCancels")));
    else dm.push(mod(loc("AFC.Battle.Mod.triangle"), { b: 1 }));
  }
  // Flancs : chaque troupe alliée supplémentaire au contact de l'adversaire.
  const aFlank = flankers(def, A.side, [att.id]);
  const dFlank = flankers(att, D.side, [def.id]);
  if (aFlank) am.push(mod(fmt("AFC.Battle.Mod.flank", { n: aFlank }), { b: aFlank }));
  if (dFlank) dm.push(mod(fmt("AFC.Battle.Mod.flank", { n: dFlank }), { b: dFlank }));
  // Terrain du défenseur.
  if (terrainValue(dTerrain, "defense")) dm.push(mod(loc("AFC.Battle.Terrain.hill"), { b: 1 }));
  if (charging && terrainHas(dTerrain, "chargeUp")) am.push(mod(loc("AFC.Battle.Mod.chargeUp"), { p: 1 }));
  if (terrainHas(dTerrain, "attackerPenalty")) {
    am.push(mod(loc("AFC.Battle.Mod.crossing"), { p: 1 }));
    dm.push(mod(loc("AFC.Battle.Mod.holdCrossing"), { b: 1 }));
  }
  if (charging && terrainValue(dTerrain, "charge")) am.push(mod(loc("AFC.Battle.Terrain.obstacle"), { p: 1 }));
  if (dOrder === "hold" && terrainValue(dTerrain, "hold")) dm.push(mod(loc("AFC.Battle.Terrain.village"), { b: 1 }));
  if (dOrder === "hold" && D.has.defenders && terrainHas(dTerrain, "fortified")) dm.push(mod(loc("AFC.Battle.Trait.defenders.name"), { b: 1 }));
  // Cavalerie gênée par le terrain (bois, marais, village, gué).
  if (A.has.mounted && (terrainHas(dTerrain, "cavalry") || terrainHas(aTerrain, "cavalry"))) am.push(mod(loc("AFC.Battle.Mod.mountedTerrain"), { p: 1 }));
  if (D.has.mounted && terrainHas(dTerrain, "cavalry")) dm.push(mod(loc("AFC.Battle.Mod.mountedTerrain"), { p: 1 }));
  // Piques contre cavalerie.
  if (D.has.pikes && A.has.mounted) {
    dm.push(mod(loc("AFC.Battle.Trait.pikes.name"), { d: 1 }));
    if (charging && dOrder === "hold") am.push(mod(loc("AFC.Battle.Mod.pikesHold"), { p: 1 }));
  }
  if (A.has.pikes && D.has.mounted) am.push(mod(loc("AFC.Battle.Trait.pikes.name"), { d: 1 }));
  // Volée des armes de jet.
  if (A.has.javelins && charging) am.push(mod(loc("AFC.Battle.Mod.volley"), { b: 1 }));
  if (D.has.javelins && dOrder === "hold" && charging) dm.push(mod(loc("AFC.Battle.Mod.volley"), { b: 1 }));
  // États.
  if (A.state === "disordered") am.push(mod(loc("AFC.Battle.State.disordered"), { p: 1 }));
  if (D.state === "disordered") dm.push(mod(loc("AFC.Battle.State.disordered"), { p: 1 }));

  // Avertissements (règles que le MJ peut choisir d'appliquer autrement).
  if (!["charge", "attack"].includes(aOrder)) warnings.push(loc("AFC.Battle.Warn.notAttacking"));
  if (charging && A.state === "disordered") warnings.push(loc("AFC.Battle.Warn.chargeDisordered"));
  if (charging && (terrainHas(dTerrain, "noCharge") || WEATHER[battle.weather]?.noCharge)) warnings.push(loc("AFC.Battle.Warn.noCharge"));
  if (!adjacent(att, def)) warnings.push(loc("AFC.Battle.Warn.notAdjacent"));
  return { am, dm, warnings, aOrder, dOrder, heavyShock: charging && A.has.heavyShock };
}

/** Modificateurs de tir et difficulté. */
export function shootMods(shooter, target, battle) {
  const S = shooter.actor.system, T = target.actor.system;
  const sOrder = groupOfToken(battle, shooter.id)?.order ?? "";
  const tOrder = groupOfToken(battle, target.id)?.order ?? "";
  const sTerrain = terrainAt(shooter), tTerrain = terrainAt(target);
  const weather = WEATHER[battle.weather] ?? {};
  const mods = [], diff = [{ label: loc("AFC.Battle.Mod.base"), value: 9 }], warnings = [];
  if ((T.has.heavyArmor || T.has.shields) && !S.has.piercing) diff.push({ label: loc(T.has.heavyArmor ? "AFC.Battle.Trait.heavyArmor.name" : "AFC.Battle.Trait.shields.name"), value: 3 });
  const cover = terrainValue(tTerrain, "cover");
  if (cover) diff.push({ label: loc("AFC.Battle.Mod.cover"), value: cover });
  if (terrainValue(sTerrain, "defense")) mods.push(mod(loc("AFC.Battle.Terrain.hill"), { b: 1 }));
  if (TRIANGLE.shoot === tOrder) mods.push(mod(loc("AFC.Battle.Mod.triangle"), { b: 1 }));
  if (weather.shoot) mods.push(mod(loc("AFC.Battle.Weather.rain"), { p: 1 }));
  if (S.state === "disordered") mods.push(mod(loc("AFC.Battle.State.disordered"), { p: 1 }));
  // Pertes non plafonnées : cible prise de flanc (au contact d'un allié du tireur), en mouvement ou désorganisée.
  const flanked = flankers(target, S.side, [shooter.id]) > 0;
  const uncapped = flanked || MOVING_ORDERS.includes(tOrder) || T.state === "disordered";
  if (!S.range) warnings.push(loc("AFC.Battle.Warn.noRange"));
  const range = weather.rangeHalf ? Math.floor(S.range / 2) : S.range;
  const dist = distance(shooter, target);
  if (S.range && dist > range) warnings.push(fmt("AFC.Battle.Warn.outOfRange", { d: dist, r: range }));
  if (sOrder !== "shoot") warnings.push(loc("AFC.Battle.Warn.notShooting"));
  if (S.has.reload && (battle.reload ?? []).includes(shooter.id)) warnings.push(loc("AFC.Battle.Warn.reload"));
  return { mods, diff, difficulty: diff.reduce((s, d) => s + d.value, 0), uncapped, warnings, tOrder };
}

/* ---------- Dialogue de résolution ---------- */

const modLine = m => `<li>${esc(m.label)}${m.b ? ` <b>+${m.b}B</b>` : ""}${m.d ? ` <b>+${m.d}D</b>` : ""}${m.p ? ` <b>−${m.p}D</b>` : ""}</li>`;
const sum = (mods, k) => mods.reduce((s, m) => s + m[k], 0);
const sideHTML = (title, r, mods, prefix) => `<div class="battle-side"><h3>${esc(title)}</h3>
  <p>${esc(r.name)} : ${r.rank}D${r.bonus ? ` + ${r.bonus}B` : ""}</p>
  <ul class="battle-mods">${mods.map(modLine).join("") || `<li class="hint">${loc("AFC.Battle.Mod.none")}</li>`}</ul>
  <div class="grid-3"><label>+B<input type="number" name="${prefix}b" value="0"></label>
  <label>−D<input type="number" name="${prefix}p" value="0"></label>
  <label>±<input type="number" name="${prefix}m" value="0"></label></div></div>`;

/** Total de dés : rang + dés en plus, dés de bonus (plafonnés par rollDice), malus. */
function pool(r, mods, extra) {
  return { rank: r.rank + sum(mods, "d"), bonus: r.bonus + sum(mods, "b") + extra.b, penalty: sum(mods, "p") + extra.p, modifier: extra.m };
}
const readExtra = (f, p) => ({ b: Number(f[`${p}b`].value) || 0, p: Number(f[`${p}p`].value) || 0, m: Number(f[`${p}m`].value) || 0 });
const degreesOf = margin => Math.min(4, Math.floor(margin / 5) + 1);
const diceText = test => test.dice.map(d => d.kept ? `<b>${d.value}</b>` : `<s>${d.value}</s>`).join(" ");

/** Mêlée entre deux jetons (attaquant : jeton contrôlé ; défenseur : cible). */
export async function resolveMelee(att, def) {
  const battle = getBattle();
  const m = meleeMods(att, def, battle);
  const ra = roller(att, battle), rd = roller(def, battle);
  const opts = await DialogV2.prompt({
    window: { title: fmt("AFC.Battle.MeleeTitle", { a: att.name, d: def.name }) },
    classes: ["afc", "afc-dialog"],
    position: { width: 640 },
    content: `<div class="afc-test-dialog afc-battle-roll">
      ${m.warnings.map(w => `<p class="hint warn">${esc(w)}</p>`).join("")}
      <p class="hint">${fmt("AFC.Battle.OrdersLine", { a: orderLabel(m.aOrder), d: orderLabel(m.dOrder) })}</p>
      <div class="battle-sides">${sideHTML(att.name, ra, m.am, "a")}${sideHTML(def.name, rd, m.dm, "d")}</div></div>`,
    ok: { label: loc("AFC.Battle.Roll"), callback: (ev, button) => ({ a: readExtra(button.form.elements, "a"), d: readExtra(button.form.elements, "d") }) },
    rejectClose: false
  });
  if (!opts) return;
  const ta = await rollDice(pool(ra, m.am, opts.a));
  const td = await rollDice(pool(rd, m.dm, opts.d));
  let winner = null, loser = null, degrees = 0;
  if (ta.total > td.total) { winner = att; loser = def; degrees = degreesOf(ta.total - td.total); }
  else if (td.total > ta.total) { winner = def; loser = att; degrees = degreesOf(td.total - ta.total); }
  let losses = degrees;
  const notes = [];
  if (winner === att && m.heavyShock) { losses += 1; notes.push(loc("AFC.Battle.Trait.heavyShock.name")); }
  if (loser?.actor.system.has.heavyArmor && degrees >= 2) { losses -= 1; notes.push(loc("AFC.Battle.Trait.heavyArmor.name")); }
  await markEngaged([att.id, def.id]);
  const result = !winner ? loc("AFC.Battle.Tie")
    : fmt("AFC.Battle.MeleeResult", { w: winner.name, l: loser.name, n: degrees, losses });
  return postResult({
    title: fmt("AFC.Battle.MeleeTitle", { a: att.name, d: def.name }),
    lines: [
      `${esc(att.name)} (${esc(ra.name)}) : ${diceText(ta)} = <b>${ta.total}</b>`,
      `${esc(def.name)} (${esc(rd.name)}) : ${diceText(td)} = <b>${td.total}</b>`
    ],
    result, notes, rolls: [ta.roll, td.roll],
    apply: loser && losses > 0 ? { token: loser.id, losses } : null
  });
}

/** Tir (tireur : jeton contrôlé ; cible : jeton ciblé). */
export async function resolveShoot(shooter, target) {
  const battle = getBattle();
  const m = shootMods(shooter, target, battle);
  const r = roller(shooter, battle);
  const opts = await DialogV2.prompt({
    window: { title: fmt("AFC.Battle.ShootTitle", { a: shooter.name, d: target.name }) },
    classes: ["afc", "afc-dialog"],
    position: { width: 460 },
    content: `<div class="afc-test-dialog afc-battle-roll">
      ${m.warnings.map(w => `<p class="hint warn">${esc(w)}</p>`).join("")}
      <p>${loc("AFC.Battle.Difficulty")} : <b>${m.difficulty}</b> <small>(${m.diff.map(d => `${esc(d.label)} ${d.value}`).join(" + ")})</small></p>
      <p class="hint">${loc(m.uncapped ? "AFC.Battle.Uncapped" : "AFC.Battle.Capped")}</p>
      ${sideHTML(shooter.name, r, m.mods, "a")}</div>`,
    ok: { label: loc("AFC.Battle.Roll"), callback: (ev, button) => readExtra(button.form.elements, "a") },
    rejectClose: false
  });
  if (!opts) return;
  const p = pool(r, m.mods, opts);
  const test = await rollDice({ ...p, difficulty: m.difficulty });
  const degrees = test.outcome?.success ? test.outcome.degrees : 0;
  const losses = m.uncapped ? degrees : Math.min(1, degrees);
  if (shooter.actor.system.has.reload) await setReload(shooter.id);
  return postResult({
    title: fmt("AFC.Battle.ShootTitle", { a: shooter.name, d: target.name }),
    lines: [`${esc(r.name)} : ${diceText(test)} = <b>${test.total}</b> / ${m.difficulty}`],
    result: degrees ? fmt("AFC.Battle.ShootHit", { n: degrees, losses, d: target.name }) : loc("AFC.Battle.ShootMiss"),
    notes: [], rolls: [test.roll],
    apply: losses ? { token: target.id, losses } : null
  });
}

/** Carte de chat du résultat, avec bouton « Appliquer les pertes » (MJ). */
async function postResult({ title, lines, result, notes, rolls, apply }) {
  const button = apply ? `<button type="button" data-afc-battle="apply" data-token="${apply.token}" data-losses="${apply.losses}">
    <i class="fa-solid fa-heart-crack"></i> ${loc("AFC.Battle.ApplyLosses")}</button>` : "";
  return ChatMessage.create({
    rolls,
    content: `<div class="afc-card battle"><header><h3>${esc(title)}</h3></header>
      <ul class="month-lines">${lines.map(l => `<li>${l}</li>`).join("")}</ul>
      <p class="battle-result">${esc(result)}${notes.length ? ` <small>(${notes.map(esc).join(", ")})</small>` : ""}</p>${button}</div>`
  });
}

/* ---------- Pertes, encaissement, ralliement ---------- */

/** Applique des pertes d'états à une troupe, après le choix d'encaissement. */
export async function applyLosses(tokenId, losses) {
  const token = canvas.scene.tokens.get(tokenId);
  const actor = token?.actor;
  if (!actor) return;
  const s = actor.system;
  let spend = 0;
  if (s.canCushion) {
    spend = await DialogV2.prompt({
      window: { title: fmt("AFC.Battle.CushionTitle", { name: token.name }) },
      classes: ["afc", "afc-dialog"],
      content: `<div class="afc-test-dialog"><p>${fmt("AFC.Battle.CushionQuestion", { n: losses, c: s.cushion })}</p>
        <label>${loc("AFC.Battle.Cushion")}<input type="number" name="spend" value="0" min="0" max="${Math.min(s.cushion, losses)}"></label></div>`,
      ok: { label: loc("AFC.Battle.Apply"), callback: (ev, button) => Math.max(0, Math.min(s.cushion, losses, Number(button.form.elements.spend.value) || 0)) },
      rejectClose: false
    });
    if (spend === null) return;
  }
  const notes = [];
  const before = s.stateIndex;
  let index = Math.min(STATE_ORDER.length - 1, before + losses - spend);
  // Indéfectible : la première déroute est annulée.
  if (index === 3 && s.has.steadfast && !actor.getFlag(SYSTEM_ID, "steadfastUsed")) {
    index = 2;
    await actor.setFlag(SYSTEM_ID, "steadfastUsed", true);
    notes.push(loc("AFC.Battle.Trait.steadfast.name"));
  }
  const disorders = s.disorders + (before < 2 && index >= 2 ? 1 : 0);
  // Unité brisée : les pertes cumulées atteignent le plafond.
  const lossNow = Math.min(MAX_LOSS, (TROOP_STATES[STATE_ORDER[index]].loss) + disorders * 5);
  if (lossNow >= MAX_LOSS && index < 4) { index = 4; notes.push(loc("AFC.Battle.Broken")); }
  const state = STATE_ORDER[index];
  if (s.has.green && losses - spend > 0 && !actor.getFlag(SYSTEM_ID, "firstLoss")) notes.push(loc("AFC.Battle.GreenCheck"));
  if (losses - spend > 0) await actor.setFlag(SYSTEM_ID, "firstLoss", true);
  if (state === "routed") notes.push(loc("AFC.Battle.Flee"));
  await actor.update({ "system.state": state, "system.cushion": s.cushion - spend, "system.disorders": disorders });
  return ChatMessage.create({
    content: `<div class="afc-card battle"><p>${fmt("AFC.Battle.LossesApplied", {
      name: esc(token.name), n: losses, spend, state: loc(TROOP_STATES[state].label)
    })}${notes.length ? ` <small>(${notes.map(esc).join(", ")})</small>` : ""}</p></div>`
  });
}

/** Ralliement : test d'Art militaire (Commandement) d'un PJ ou PNJ contre la Discipline de la troupe. */
export async function rallyTroop(tokenId) {
  const token = canvas.scene.tokens.get(tokenId);
  const actor = token?.actor;
  if (!actor) return;
  const s = actor.system;
  if (s.state === "fresh") return ui.notifications.info(loc("AFC.Battle.RallyFresh"));
  if (s.state === "destroyed") return;
  if (s.state === "routed" && s.rallies >= s.ralliesMax) return ui.notifications.warn(loc("AFC.Battle.RallyLimit"));
  const candidates = game.actors.filter(a => ["character", "npc"].includes(a.type) && a.isOwner && a.system.abilities?.warfare);
  if (!candidates.length) return ui.notifications.warn(loc("AFC.Battle.NoRallier"));
  const pick = await DialogV2.prompt({
    window: { title: fmt("AFC.Battle.RallyTitle", { name: token.name }) },
    classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog"><p>${fmt("AFC.Battle.RallyIntro", { d: s.discipline })}</p>
      <label>${loc("AFC.Battle.Rallier")}<select name="who">${candidates.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label>
      <label>+B<input type="number" name="b" value="0"></label></div>`,
    ok: { label: loc("AFC.Battle.Roll"), callback: (ev, button) => ({ id: button.form.elements.who.value, b: Number(button.form.elements.b.value) || 0 }) },
    rejectClose: false
  });
  if (!pick) return;
  const rallier = game.actors.get(pick.id);
  const warfare = rallier.system.abilities.warfare;
  const test = await rollDice({ rank: warfare.rank, bonus: specialtyBonus(warfare, COMMAND) + pick.b, difficulty: s.discipline });
  const success = test.outcome?.success;
  if (success) {
    const fromRout = s.state === "routed";
    await actor.update({ "system.state": STATE_ORDER[s.stateIndex - 1], "system.rallies": s.rallies + (fromRout ? 1 : 0) });
  }
  return ChatMessage.create({
    rolls: [test.roll], speaker: ChatMessage.getSpeaker({ actor: rallier }),
    content: `<div class="afc-card battle"><header><h3>${fmt("AFC.Battle.RallyTitle", { name: esc(token.name) })}</h3></header>
      <p>${esc(rallier.name)} : ${diceText(test)} = <b>${test.total}</b> / ${s.discipline}</p>
      <p class="battle-result">${success ? fmt("AFC.Battle.RallyOk", { state: loc(TROOP_STATES[STATE_ORDER[s.stateIndex - 1]].label) }) : loc("AFC.Battle.RallyFail")}</p></div>`
  });
}

/* ---------- Suivi du tour ---------- */

async function markEngaged(ids) {
  const battle = getBattle();
  battle.engaged = [...new Set([...(battle.engaged ?? []), ...ids])];
  await saveBattle(battle);
}
async function setReload(id) {
  const battle = getBattle();
  battle.reloadNext = [...new Set([...(battle.reloadNext ?? []), id])];
  await saveBattle(battle);
}

export const orderLabel = key => (key ? loc(`AFC.Battle.Order.${key}`) : "—");

/** Révélation des ordres : carte de chat. */
export async function revealOrders() {
  const battle = getBattle();
  battle.revealed = true;
  await saveBattle(battle);
  const line = g => `<li><b>${esc(g.name)}</b> : ${esc(orderLabel(g.order))}</li>`;
  return ChatMessage.create({
    content: `<div class="afc-card battle"><header><h3>${fmt("AFC.Battle.RevealTitle", { n: battle.round })}</h3></header>
      <h4>${loc("AFC.Battle.Side.company")}</h4><ul class="month-lines">${battle.groups.filter(g => g.side === "company").map(line).join("")}</ul>
      <h4>${loc("AFC.Battle.Side.enemy")}</h4><ul class="month-lines">${battle.groups.filter(g => g.side === "enemy").map(line).join("")}</ul></div>`
  });
}

/** Fin de tour : réorganisation (Tenir sans combat), fuites, nouveau tour. */
export async function endTurn() {
  const battle = getBattle();
  const lines = [];
  for (const group of battle.groups) {
    for (const id of group.troops) {
      const token = canvas.scene.tokens.get(id);
      const s = token?.actor?.system;
      if (!s) continue;
      if (group.order === "hold" && !(battle.engaged ?? []).includes(id) && ["shaken", "disordered"].includes(s.state)) {
        const state = STATE_ORDER[s.stateIndex - 1];
        await token.actor.update({ "system.state": state });
        lines.push(fmt("AFC.Battle.Reorganized", { name: esc(token.name), state: loc(TROOP_STATES[state].label) }));
      }
      if (s.state === "routed") lines.push(fmt("AFC.Battle.Fleeing", { name: esc(token.name) }));
    }
  }
  battle.round += 1;
  battle.revealed = false;
  battle.engaged = [];
  battle.reload = battle.reloadNext ?? [];
  battle.reloadNext = [];
  for (const g of battle.groups) { g.order = ""; g.countered = false; }
  await saveBattle(battle);
  return ChatMessage.create({
    content: `<div class="afc-card battle"><header><h3>${fmt("AFC.Battle.EndTurnTitle", { n: battle.round - 1 })}</h3></header>
      <ul class="month-lines">${lines.map(l => `<li>${l}</li>`).join("") || `<li>${loc("AFC.Battle.NothingToReport")}</li>`}</ul></div>`
  });
}

/** Bilan : état final, désorganisations et pertes de chaque troupe. */
export async function battleReport() {
  const troops = canvas.scene.tokens.filter(t => t.actor?.type === "troop");
  const row = t => {
    const s = t.actor.system;
    return `<tr><td>${esc(t.name)}</td><td>${loc(TROOP_STATES[s.state].label)}</td><td class="center">${s.disorders}</td><td class="center">${s.loss} %</td><td class="center">${s.lostMen}</td></tr>`;
  };
  const table = side => `<h4>${loc(`AFC.Battle.Side.${side}`)}</h4><table class="afc-table"><thead><tr><th>${loc("AFC.Battle.Troop")}</th><th>${loc("AFC.Battle.StateLabel")}</th>
    <th class="center">${loc("AFC.Battle.Disorders")}</th><th class="center">%</th><th class="center">${loc("AFC.Battle.Men")}</th></tr></thead>
    <tbody>${troops.filter(t => t.actor.system.side === side).map(row).join("")}</tbody></table>`;
  return ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<div class="afc-card battle"><header><h3>${loc("AFC.Battle.ReportTitle")}</h3></header>${table("company")}${table("enemy")}
      <p class="hint">${loc("AFC.Battle.ReportHint")}</p></div>`
  });
}

/** Bouton « Appliquer les pertes » des cartes de chat (MJ). */
export function onRenderBattleCard(message, html) {
  html.querySelectorAll('[data-afc-battle="apply"]').forEach(button => {
    if (!game.user.isGM) return button.remove();
    button.addEventListener("click", () => applyLosses(button.dataset.token, Number(button.dataset.losses)));
  });
}
