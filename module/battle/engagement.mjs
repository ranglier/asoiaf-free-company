/**
 * Résolution des engagements : tir et mêlée (bonus calculés depuis les ordres, le terrain, les
 * traits et les flancs), pertes d'états avec encaissement, ralliement, fin de tour et bilan.
 */
import { SYSTEM_ID } from "../config.mjs";
import { specialtyBonus } from "../data/actor-character.mjs";
import { rollDice } from "../dice/test-roll.mjs";
import {
  MAX_LOSS, MOVING_ORDERS, ORDER_ICONS, STATE_ORDER, TERRAINS, TRIANGLE, TROOP_STATES, WEATHER
} from "./battle-config.mjs";
import { askHandlers, askUser, getBattle, resetOrders, saveBattle, unitOf } from "./state.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const TACTICS = ["tactiques", "tactics"];
const COMMAND = ["commandement", "command"];

/* ---------- Carte : terrain, contact, distance ---------- */

// Position enregistrée (_source) : dans un onglet en arrière-plan, l'animation retarde token.x et token.object.
export const center = token => ({ x: token._source.x + (token.width * canvas.grid.sizeX) / 2, y: token._source.y + (token.height * canvas.grid.sizeY) / 2 });

/** Terrain reconnu au nom d'une région (sinon, simple repère sans effet). */
export const terrainKeyOf = name => Object.entries(TERRAINS).find(([, t]) => t.match.test(name))?.[0];

/** Terrain d'une région : son type (panneau des terrains), sinon reconnu à son nom. Un repère n'a pas d'effet. */
export function regionTerrainKey(region) {
  const type = region.getFlag(SYSTEM_ID, "terrain");
  if (type) return type === "landmark" ? undefined : type;
  return terrainKeyOf(region.name);
}

/** Terrains de la case d'un jeton (régions de la scène reconnues à leur nom). */
export function terrainAt(token) {
  const point = { ...center(token), elevation: 0 };
  const keys = new Set();
  for (const region of token.parent.regions) {
    const key = regionTerrainKey(region);
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
  const officerId = unitOf(battle, token.id).officer;
  const officer = officerId ? game.actors.get(officerId) : null;
  const warfare = officer?.system.abilities?.warfare;
  if (warfare) {
    return { name: officer.name, rank: warfare.rank, bonus: specialtyBonus(warfare, specialties), officer: true };
  }
  return { name: loc("AFC.Battle.TroopRank"), rank: token.actor.system.rank, bonus: 0, officer: false };
}

/* ---------- Calcul des modificateurs ---------- */

/** Une ligne de modificateur : dés de bonus (b), dés de test en plus (d), dés de malus (p). */
const mod = (label, { b = 0, d = 0, p = 0 } = {}) => ({ label, b, d, p });

/** Modificateurs de mêlée pour l'attaquant et le défenseur. */
export function meleeMods(att, def, battle) {
  const A = att.actor.system, D = def.actor.system;
  const aOrder = unitOf(battle, att.id).order, dOrder = unitOf(battle, def.id).order;
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
  // Traverser un gué ou un pont : l'attaquant y est engagé, ou le défenseur l'y attend.
  if (terrainHas(dTerrain, "attackerPenalty") || terrainHas(aTerrain, "attackerPenalty")) {
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
  const sOrder = unitOf(battle, shooter.id).order;
  const tOrder = unitOf(battle, target.id).order;
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
/** Case « Appliquer les pertes tout de suite » des dialogues de résolution. */
const autoBox = () => `<label class="checkbox"><input type="checkbox" name="auto" checked> ${loc("AFC.Battle.AutoApply")}</label>`;
const degreesOf = margin => Math.min(4, Math.floor(margin / 5) + 1);

/* ---------- Cartes de chat ---------- */

const renderCard = (name, data) => foundry.applications.handlebars.renderTemplate(`systems/${SYSTEM_ID}/templates/chat/${name}.hbs`, data);
/** Réserve de dés, comme sur les jets de fiche : « 4D +2B −1D +3 ». */
const poolLabel = (p, test) => `${p.rank}D${test.bonus ? ` +${test.bonus}B` : ""}${p.penalty ? ` −${p.penalty}D` : ""}${p.modifier ? ` ${p.modifier > 0 ? "+" : "−"}${Math.abs(p.modifier)}` : ""}`;
/** Modificateurs affichés en étiquettes : « Flanc (1) +1B ». */
const modTags = mods => mods.map(m => `${m.label}${m.b ? ` +${m.b}B` : ""}${m.d ? ` +${m.d}D` : ""}${m.p ? ` −${m.p}D` : ""}`);
const lossLabel = (name, n) => (n > 0 ? fmt(n === 1 ? "AFC.Battle.Card.Lose1" : "AFC.Battle.Card.LoseN", { l: name, n }) : loc("AFC.Battle.Card.NoLoss"));

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
      <div class="battle-sides">${sideHTML(att.name, ra, m.am, "a")}${sideHTML(def.name, rd, m.dm, "d")}</div>${autoBox()}</div>`,
    ok: { label: loc("AFC.Battle.Roll"), callback: (ev, button) => ({ a: readExtra(button.form.elements, "a"), d: readExtra(button.form.elements, "d"), auto: button.form.elements.auto.checked }) },
    rejectClose: false
  });
  if (!opts) return;
  const pa = pool(ra, m.am, opts.a), pd = pool(rd, m.dm, opts.d);
  const ta = await rollDice(pa);
  const td = await rollDice(pd);
  let winner = null, loser = null, degrees = 0;
  if (ta.total > td.total) { winner = att; loser = def; degrees = degreesOf(ta.total - td.total); }
  else if (td.total > ta.total) { winner = def; loser = att; degrees = degreesOf(td.total - ta.total); }
  let losses = degrees;
  const notes = [];
  if (winner === att && m.heavyShock) { losses += 1; notes.push(loc("AFC.Battle.Trait.heavyShock.name")); }
  if (loser?.actor.system.has.heavyArmor && degrees >= 2) { losses -= 1; notes.push(loc("AFC.Battle.Trait.heavyArmor.name")); }
  // Deux troupes qui se visent : une seule mêlée, les deux engagements sont résolus.
  const mutual = unitOf(battle, def.id).target === att.id && ["charge", "attack"].includes(m.dOrder);
  await markEngaged([att.id, def.id], mutual ? [att.id, def.id] : [att.id]);
  const side = (token, r, mods, p, test, order) => ({
    name: token.name, roller: r.name, order: orderLabel(order), total: test.total, dice: test.dice,
    pool: poolLabel(p, test), tags: modTags(mods), winner: winner === token
  });
  const apply = loser && losses > 0 ? { token: loser.id, losses } : null;
  const sides = [side(att, ra, m.am, pa, ta, m.aOrder), side(def, rd, m.dm, pd, td, m.dOrder)];
  // Le vainqueur d'abord : le verdict se lit d'une traite.
  if (winner === def) sides.reverse();
  const content = await renderCard("battle-melee", {
    sides, degrees,
    verdict: winner ? fmt("AFC.Battle.Card.Wins", { w: winner.name }) : loc("AFC.Battle.Card.Tie"),
    detail: winner ? [lossLabel(loser.name, losses), ...notes].join(" · ") : loc("AFC.Battle.Card.TieDetail"),
    ...cardApply(apply, opts.auto)
  });
  return postResult({ content, rolls: [ta.roll, td.roll], apply, auto: opts.auto });
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
      ${sideHTML(shooter.name, r, m.mods, "a")}${autoBox()}</div>`,
    ok: { label: loc("AFC.Battle.Roll"), callback: (ev, button) => ({ ...readExtra(button.form.elements, "a"), auto: button.form.elements.auto.checked }) },
    rejectClose: false
  });
  if (!opts) return;
  const p = pool(r, m.mods, opts);
  const test = await rollDice({ ...p, difficulty: m.difficulty });
  const degrees = test.outcome?.success ? test.outcome.degrees : 0;
  const losses = m.uncapped ? degrees : Math.min(1, degrees);
  if (shooter.actor.system.has.reload) await setReload(shooter.id);
  await markEngaged([], [shooter.id]);
  const apply = losses ? { token: target.id, losses } : null;
  const content = await renderCard("battle-test", {
    title: loc("AFC.Battle.Card.Shoot"),
    subtitle: fmt("AFC.Battle.Card.ShootAt", { a: shooter.name, d: target.name }),
    total: test.total, dice: test.dice, success: degrees > 0, degrees,
    verdict: degrees ? `${loc("AFC.Battle.Card.Hit")} : ${lossLabel(target.name, losses)}` : loc("AFC.Battle.Card.Miss"),
    detail: fmt("AFC.Battle.Card.Against", { n: m.difficulty, detail: m.diff.map(d => `${d.label} ${d.value}`).join(" + ") }),
    pool: poolLabel(p, test), tags: [r.name, ...modTags(m.mods)],
    ...cardApply(apply, opts.auto)
  });
  return postResult({ content, rolls: [test.roll], apply, auto: opts.auto });
}

/** Pertes de la carte : appliquées tout de suite (en attendant l'encaissement), ou bouton pour le MJ. */
const cardApply = (apply, auto) => ({ apply: auto ? null : apply, pending: apply && auto ? loc("AFC.Battle.Card.Pending") : null });

/** Publie la carte du résultat, puis applique les pertes si la case était cochée : la carte se complète. */
async function postResult({ content, rolls, apply, auto }) {
  const message = await ChatMessage.create({ rolls, content });
  if (apply && auto) await applyLosses(apply.token, apply.losses, message);
  return message;
}

/** Inscrit le résultat des pertes dans la carte d'origine et retire le bouton. */
function fillOutcome(message, html) {
  return message.update({
    content: message.content.replace(/<div class="battle-outcome">[\s\S]*?<\/div>/, `<div class="battle-outcome">${html}</div>`)
      .replace(/<button[^>]*data-afc-battle="apply"[\s\S]*?<\/button>/, "")
  });
}

/* ---------- Pertes, encaissement, ralliement ---------- */

/** Combien de points d'encaissement dépenser ? (null si la fenêtre est fermée) */
function cushionDialog({ name, losses, cushion }) {
  return DialogV2.prompt({
    window: { title: fmt("AFC.Battle.CushionTitle", { name }) },
    classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog"><p>${fmt("AFC.Battle.CushionQuestion", { n: losses, c: cushion })}</p>
      <label>${loc("AFC.Battle.Cushion")}<input type="number" name="spend" value="0" min="0" max="${Math.min(cushion, losses)}"></label></div>`,
    ok: { label: loc("AFC.Battle.Apply"), callback: (ev, button) => Math.max(0, Math.min(cushion, losses, Number(button.form.elements.spend.value) || 0)) },
    rejectClose: false
  });
}
askHandlers.cushion = cushionDialog;

/**
 * Choix d'encaissement : c'est au joueur qui possède la troupe de décider. Sans joueur connecté, ou
 * sans réponse à temps, la question revient à qui applique les pertes (le MJ).
 * Le joueur qui ferme sa fenêtre n'encaisse rien ; le MJ qui ferme la sienne annule.
 */
async function askCushion(token, losses) {
  const actor = token.actor;
  const data = { name: token.name, losses, cushion: actor.system.cushion };
  const player = game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
  if (!game.user.isGM || !player) return cushionDialog(data);
  ui.notifications.info(fmt("AFC.Battle.CushionWaiting", { name: token.name, user: player.name }));
  const answer = await askUser(player.id, "cushion", data);
  if (answer === undefined) return cushionDialog(data);
  return Math.max(0, Math.min(data.cushion, losses, answer ?? 0));
}

/**
 * Applique des pertes d'états à une troupe, après le choix d'encaissement. Le résultat s'inscrit dans
 * la carte d'origine (message), sinon dans une carte à part.
 */
export async function applyLosses(tokenId, losses, message = null) {
  const token = canvas.scene.tokens.get(tokenId);
  const actor = token?.actor;
  if (!actor) return;
  const s = actor.system;
  let spend = 0;
  if (s.canCushion) {
    spend = await askCushion(token, losses);
    // Annulé par le MJ : la carte le dit, les pertes ne sont pas appliquées.
    if (spend === null) return message && fillOutcome(message, `<small>${loc("AFC.Battle.Card.Cancelled")}</small>`);
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
  const outcome = `<strong class="troop">${esc(token.name)}</strong>
    ${spend ? `<span class="tag">${fmt("AFC.Battle.Card.Cushioned", { n: spend })}</span>` : ""}
    <span class="state-chip ${state}">${loc(TROOP_STATES[state].label)}</span>
    ${notes.length ? `<small>${notes.map(esc).join(" · ")}</small>` : ""}`;
  if (message) return fillOutcome(message, outcome);
  return ChatMessage.create({ content: `<div class="afc-card battle"><div class="battle-outcome">${outcome}</div></div>` });
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
  const p = { rank: warfare.rank, bonus: specialtyBonus(warfare, COMMAND) + pick.b };
  const test = await rollDice({ ...p, difficulty: s.discipline });
  const success = test.outcome?.success;
  if (success) {
    const fromRout = s.state === "routed";
    await actor.update({ "system.state": STATE_ORDER[s.stateIndex - 1], "system.rallies": s.rallies + (fromRout ? 1 : 0) });
  }
  return ChatMessage.create({
    rolls: [test.roll], speaker: ChatMessage.getSpeaker({ actor: rallier }),
    content: await renderCard("battle-test", {
      title: loc("AFC.Battle.Card.Rally"),
      subtitle: fmt("AFC.Battle.Card.RallyBy", { who: rallier.name, name: token.name }),
      total: test.total, dice: test.dice, success, degrees: test.outcome?.degrees,
      verdict: success ? fmt("AFC.Battle.RallyOk", { state: loc(TROOP_STATES[STATE_ORDER[s.stateIndex - 1]].label) }) : loc("AFC.Battle.RallyFail"),
      detail: fmt("AFC.Battle.Card.AgainstDiscipline", { d: s.discipline }),
      pool: poolLabel(p, test), tags: []
    })
  });
}

/* ---------- Suivi du tour ---------- */

/** Note les troupes engagées en mêlée et les engagements résolus ce tour-ci. */
async function markEngaged(ids, done = []) {
  const battle = getBattle();
  battle.engaged = [...new Set([...battle.engaged, ...ids])];
  battle.done = [...new Set([...battle.done, ...done])];
  await saveBattle(battle);
}

/**
 * Engagements encore à résoudre : cibles désignées, tirs d'abord, puis mêlées. Une troupe en déroute
 * ou détruite n'attaque plus, et une cible retirée de la scène annule l'engagement.
 */
export function plannedEngagements(battle = getBattle(), scene = canvas.scene) {
  return battle.units.filter(u => u.target && ["charge", "attack", "shoot"].includes(u.order) && !battle.done.includes(u.id)).map(u => {
    const from = scene.tokens.get(u.id), to = scene.tokens.get(u.target);
    if (!from?.actor || !to?.actor || ["routed", "destroyed"].includes(from.actor.system.state)) return null;
    return { from: u.id, to: u.target, fromName: from.name, toName: to.name, order: orderLabel(u.order), shoot: u.order === "shoot" };
  }).filter(Boolean).sort((a, b) => b.shoot - a.shoot);
}

/** Résout un engagement prévu : tir si l'ordre est Tirer, sinon mêlée. */
export function resolvePlanned(plan) {
  const a = canvas.scene.tokens.get(plan.from), d = canvas.scene.tokens.get(plan.to);
  if (!a || !d) return;
  return plan.shoot ? resolveShoot(a, d) : resolveMelee(a, d);
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
  // Les troupes cachées n'apparaissent pas dans la carte publique.
  const line = t => {
    const u = unitOf(battle, t.id);
    const target = u.target ? canvas.scene.tokens.get(u.target) : null;
    const icon = ORDER_ICONS[u.order] ?? "fa-minus";
    return `<li><i class="fa-solid ${icon}"></i><b>${esc(t.name)}</b> <span class="order">${esc(orderLabel(u.order))}${target && !target.hidden ? ` → ${esc(target.name)}` : ""}</span></li>`;
  };
  const troops = side => canvas.scene.tokens.filter(t => t.actor?.type === "troop" && t.actor.system.side === side && !t.hidden && alive(t));
  const group = side => {
    const list = troops(side);
    return list.length ? `<h4>${loc(`AFC.Battle.Side.${side}`)}</h4><ul class="orders">${list.map(line).join("")}</ul>` : "";
  };
  return ChatMessage.create({
    content: `<div class="afc-card battle"><header><h3>${fmt("AFC.Battle.RevealTitle", { n: battle.round })}</h3></header>${group("company")}${group("enemy")}</div>`
  });
}

/** Fin de tour : réorganisation (Tenir sans combat), fuites, nouveau tour. */
export async function endTurn() {
  const battle = getBattle();
  const lines = [];
  for (const token of canvas.scene.tokens.filter(t => t.actor?.type === "troop")) {
    const s = token.actor.system;
    if (unitOf(battle, token.id).order === "hold" && !battle.engaged.includes(token.id) && ["shaken", "disordered"].includes(s.state)) {
      const state = STATE_ORDER[s.stateIndex - 1];
      await token.actor.update({ "system.state": state });
      lines.push(fmt("AFC.Battle.Reorganized", { name: esc(token.name), state: loc(TROOP_STATES[state].label) }));
    }
    if (s.state === "routed") lines.push(fmt("AFC.Battle.Fleeing", { name: esc(token.name) }));
  }
  battle.round += 1;
  battle.revealed = false;
  battle.engaged = [];
  battle.done = [];
  battle.reload = battle.reloadNext ?? [];
  battle.reloadNext = [];
  await saveBattle(battle);
  // On garde l'officier ; ordre, cible et contre-ordre repartent de zéro.
  await resetOrders();
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
    button.addEventListener("click", () => applyLosses(button.dataset.token, Number(button.dataset.losses), message));
  });
}
