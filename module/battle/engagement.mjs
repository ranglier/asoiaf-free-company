/**
 * Résolution des engagements : tir et mêlée (bonus calculés depuis les ordres, le terrain, les
 * traits et les flancs), pertes d'états avec encaissement, ralliement, fin de tour et bilan.
 */
import { ABILITIES, SYSTEM_ID } from "../config.mjs";
import { cohesionLossReduction } from "../company-services.mjs";
import { specialtyBonus } from "../data/actor-character.mjs";
import { autoPenalties, evaluateTest, rollDice } from "../dice/test-roll.mjs";
import {
  MAX_LOSS, MOVING_ORDERS, OFFICER_TEST, ORDER_ICONS, STATE_ORDER, TERRAINS, TRIANGLE, TROOP_STATES, WEATHER
} from "./battle-config.mjs";
import { executeDeferredMoves, executeMoves } from "./moves.mjs";
import { mayAct, recordAction, withAction } from "./pc-actions.mjs";
import { moraleMod, troopPool } from "./troops.mjs";
import { askHandlers, askUser, canCommand, getBattle, gmHandlers, requestGM, resetOrders, saveBattle, sceneOf, unitOf } from "./state.mjs";
import { fogName, markActed, publicName, secretTroop } from "./vision.mjs";

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

/** Portée réelle d'une troupe, météo comprise. */
export const shootRange = (s, battle) => (WEATHER[battle.weather]?.rangeHalf ? Math.floor(s.range / 2) : s.range);

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

/** Dés de bonus d'un officier : 1 par tranche de 2 rangs d'Art militaire, Tactiques comptant comme des rangs (au moins 1). */
export const officerBonus = warfare => Math.max(1, Math.floor((warfare.rank + specialtyBonus(warfare, TACTICS)) / 2));

/** Dés de bonus de l'officier ce tour-ci : résultat de son test (option), sinon bonus fixe. */
export function officerDice(battle, tokenId, officerId, warfare) {
  if (!battle.officerTest) return officerBonus(warfare);
  return battle.command.find(c => c.id === tokenId && c.officer === officerId)?.bonus ?? 0;
}

/** La troupe lance sa propre compétence (Corps à corps ou Tir) ; son officier lui donne des dés de bonus. */
function roller(token, battle, kind = "melee") {
  const s = token.actor.system;
  const ability = kind === "shoot" ? s.shootSkill : "fighting";
  const skill = loc(`AFC.Ability.${ability}`);
  const officerId = unitOf(battle, token.id).officer;
  const officer = officerId ? game.actors.get(officerId) : null;
  const warfare = officer?.system.abilities?.warfare;
  const base = troopPool(s, ability, battle);
  return {
    // L'officier d'une troupe secrète n'est pas nommé : il la trahirait.
    name: warfare && !secretTroop(token) ? `${skill}, ${officer.name}` : skill, rank: base.rank,
    bonus: base.bonus + (warfare ? officerDice(battle, token.id, officerId, warfare) : 0), officer: !!warfare
  };
}

/* ---------- Calcul des modificateurs ---------- */

/**
 * Embuscade (décision du 2026-11-02) : une troupe cachée au moment de la révélation (brouillard de
 * guerre ou MJ), qui n'avait encore jamais agi et qui Charge, Attaque ou Tire, gagne +1B à cette action.
 */
const ambushing = (battle, token) => (battle.ambush ?? []).includes(token.id);
const OFFENSIVE = ["charge", "attack", "shoot"];

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
  // Tenir brise l'élan (option) : seuls les boucliers et les piques en tirent un bonus.
  const breaksCharge = !!battle.holdBreaks && charging && dOrder === "hold";
  if (breaksCharge) {
    if (D.has.shields || D.has.pikes) dm.push(mod(loc("AFC.Battle.Mod.triangle"), { b: 1 }));
    else am.push(mod(loc("AFC.Battle.Mod.holdBreaks")));
  } else if (TRIANGLE[dOrder] === aOrder) {
    const wall = D.has.shields && dOrder === "hold";
    const shock = charging && (A.has.shock || A.has.heavyShock) && !D.has.mounted && !D.has.pikes && !wall;
    if (shock) am.push(mod(loc("AFC.Battle.Mod.shockCancels")));
    else dm.push(mod(loc("AFC.Battle.Mod.triangle"), { b: 1 }));
  }
  // Surnombre (option de la bataille) : rapport des hommes des deux blocs, une unité montée comptant à part.
  if (battle.outnumber) {
    const edge = ratio => (ratio >= 3 ? 2 : ratio >= 1.5 ? 1 : 0);
    const aEdge = edge(A.strength / Math.max(1, D.strength)), dEdge = edge(D.strength / Math.max(1, A.strength));
    if (aEdge) am.push(mod(loc("AFC.Battle.Split.Outnumber"), { b: aEdge }));
    if (dEdge) dm.push(mod(loc("AFC.Battle.Split.Outnumber"), { b: dEdge }));
  }
  // Armes de mêlée améliorées.
  if (A.upgrades.melee) am.push(mod(loc("AFC.Unit.Upgrade.melee"), { b: 1 }));
  if (D.upgrades.melee) dm.push(mod(loc("AFC.Unit.Upgrade.melee"), { b: 1 }));
  // Embuscade : troupe cachée à la révélation, qui frappe pour la première fois.
  if (ambushing(battle, att)) am.push(mod(loc("AFC.Battle.Mod.ambush"), { b: 1 }));
  // Flanc : d'autres troupes alliées au contact de l'adversaire donnent +1B, quel que soit leur nombre
  // (décision du 2026-11-02, ancienne option « Flanc limité »).
  const aFlank = flankers(def, A.side, [att.id]), dFlank = flankers(att, D.side, [def.id]);
  if (aFlank) am.push(mod(fmt("AFC.Battle.Mod.flank", { n: aFlank }), { b: 1 }));
  if (dFlank) dm.push(mod(fmt("AFC.Battle.Mod.flank", { n: dFlank }), { b: 1 }));
  // Terrain du défenseur. La colline ne joue que contre un adversaire plus bas.
  const sameHeight = terrainValue(aTerrain, "defense") > 0;
  if (terrainValue(dTerrain, "defense") && !sameHeight) dm.push(mod(loc("AFC.Battle.Terrain.hill"), { b: 1 }));
  if (charging && terrainHas(dTerrain, "chargeUp") && !sameHeight) am.push(mod(loc("AFC.Battle.Mod.chargeUp"), { p: 1 }));
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
  if (A.has.javelins && charging && !breaksCharge) am.push(mod(loc("AFC.Battle.Mod.volley"), { b: 1 }));
  if (D.has.javelins && dOrder === "hold" && charging) dm.push(mod(loc("AFC.Battle.Mod.volley"), { b: 1 }));
  // Choc : la cavalerie qui charge une troupe qui ne Tient pas a +1B, comme la volée (décision du 2026-11-02).
  if (A.has.shock && charging && dOrder !== "hold") am.push(mod(loc("AFC.Battle.Mod.shock"), { b: 1 }));
  // Charge mutuelle : la troupe résolue en défenseur charge aussi et garde Choc et volée.
  const dCharging = dOrder === "charge" && charging;
  if (dCharging && D.has.shock) dm.push(mod(loc("AFC.Battle.Mod.shock"), { b: 1 }));
  if (dCharging && D.has.javelins) dm.push(mod(loc("AFC.Battle.Mod.volley"), { b: 1 }));
  // Course : une troupe essoufflée combat mal ce tour-ci.
  if (aOrder === "run") am.push(mod(loc("AFC.Battle.Mod.winded"), { p: 1 }));
  if (dOrder === "run") dm.push(mod(loc("AFC.Battle.Mod.winded"), { p: 1 }));
  // États.
  if (A.state === "disordered") am.push(mod(loc("AFC.Battle.State.disordered"), { p: 1 }));
  if (D.state === "disordered") dm.push(mod(loc("AFC.Battle.State.disordered"), { p: 1 }));

  // Avertissements (règles que le MJ peut choisir d'appliquer autrement).
  if (!["charge", "attack"].includes(aOrder)) warnings.push(loc("AFC.Battle.Warn.notAttacking"));
  if (charging && A.state === "disordered") warnings.push(loc("AFC.Battle.Warn.chargeDisordered"));
  if (charging && (terrainHas(dTerrain, "noCharge") || WEATHER[battle.weather]?.noCharge)) warnings.push(loc("AFC.Battle.Warn.noCharge"));
  if (!adjacent(att, def)) warnings.push(loc("AFC.Battle.Warn.notAdjacent"));
  return { am, dm, warnings, aOrder, dOrder, heavyShock: charging && A.has.heavyShock && !breaksCharge, dHeavyShock: dCharging && D.has.heavyShock };
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
  if (terrainValue(sTerrain, "defense") && !terrainValue(tTerrain, "defense")) mods.push(mod(loc("AFC.Battle.Terrain.hill"), { b: 1 }));
  if (S.upgrades.shoot) mods.push(mod(loc("AFC.Unit.Upgrade.shoot"), { b: 1 }));
  if (ambushing(battle, shooter)) mods.push(mod(loc("AFC.Battle.Mod.ambush"), { b: 1 }));
  if (weather.shoot) mods.push(mod(loc("AFC.Battle.Weather.rain"), { p: 1 }));
  if (S.state === "disordered") mods.push(mod(loc("AFC.Battle.State.disordered"), { p: 1 }));
  // Pertes non plafonnées : cible prise de flanc (au contact d'un allié du tireur), en mouvement ou désorganisée.
  const flanked = flankers(target, S.side, [shooter.id]) > 0;
  const uncapped = flanked || MOVING_ORDERS.includes(tOrder) || T.state === "disordered";
  if (!S.range) warnings.push(loc("AFC.Battle.Warn.noRange"));
  const range = shootRange(S, battle);
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
/** Destinataires d'une carte qui montre la Discipline : tout le monde pour la Compagnie, le MJ pour l'ennemi et les troupes cachées (elle trahirait l'entraînement). */
const disciplineWhisper = token => (token.actor.system.side === "company" && !token.hidden ? [] : ChatMessage.getWhisperRecipients("GM"));
const moraleLabel = n => `${loc("AFC.Battle.Options.morale")} ${n > 0 ? "+" : "−"}${Math.abs(n)}`;

/* ---------- Cartes de chat ---------- */

const renderCard = (name, data) => foundry.applications.handlebars.renderTemplate(`systems/${SYSTEM_ID}/templates/chat/${name}.hbs`, data);
/** Réserve de dés, comme sur les jets de fiche : « 4D +2B −1D +3 ». */
const poolLabel = (p, test) => `${p.rank}D${test.bonus ? ` +${test.bonus}B` : ""}${p.penalty ? ` −${p.penalty}D` : ""}${p.modifier ? ` ${p.modifier > 0 ? "+" : "−"}${Math.abs(p.modifier)}` : ""}`;
/** Modificateurs affichés en étiquettes : « Flanc (1) +1B ». */
const modTags = mods => mods.map(m => `${m.label}${m.b ? ` +${m.b}B` : ""}${m.d ? ` +${m.d}D` : ""}${m.p ? ` −${m.p}D` : ""}`);
const lossLabel = (name, n) => (n > 0 ? fmt(n === 1 ? "AFC.Battle.Card.Lose1" : "AFC.Battle.Card.LoseN", { l: name, n }) : loc("AFC.Battle.Card.NoLoss"));

/** Jet unique de la cible (option) : une fois par tour, les mêmes dés servent contre chaque attaquant. */
async function defenseRoll(p, id, scene) {
  const battle = getBattle(scene);
  const kept = battle.defenseDice.find(e => e.id === id)?.dice ?? [];
  const bonus = Math.max(0, Math.min(p.bonus, p.rank));
  const count = p.rank + bonus;
  let roll = null, dice = kept;
  if (kept.length < count) {
    roll = await new Roll(`${count - kept.length}d6`).evaluate();
    dice = [...kept, ...roll.dice[0].results.map(d => d.result)];
    battle.defenseDice = [...battle.defenseDice.filter(e => e.id !== id), { id, dice }];
    await saveBattle(battle, scene);
  }
  return { roll, bonus, reused: kept.length > 0, ...evaluateTest(dice.slice(0, count), p) };
}

/** Engagements dont la fenêtre de résolution est ouverte : un double clic n'en ouvre pas une deuxième. */
const resolving = new Set();
export const resolvingOpen = () => resolving.size > 0;

/** Résolution protégée : une seule fenêtre par engagement. */
async function guarded(att, def, run) {
  const key = `${att.id}>${def.id}`;
  if (resolving.has(key)) return;
  resolving.add(key);
  try { return await run(); } finally { resolving.delete(key); }
}

/** Après la fenêtre : le tour a-t-il changé, ou l'engagement a-t-il été résolu entre-temps ? */
function stale(before, att, def, scene) {
  const now = getBattle(scene);
  if (now.round !== before.round || now.revealed !== before.revealed) {
    ui.notifications.warn(fmt("AFC.Battle.TurnChanged", { a: att.name, d: def.name }));
    return true;
  }
  if (!before.done.includes(att.id) && now.done.includes(att.id)) {
    ui.notifications.warn(fmt("AFC.Battle.AlreadyResolved", { a: att.name, d: def.name }));
    return true;
  }
  return false;
}

/** Mêlée entre deux jetons (attaquant : jeton contrôlé ; défenseur : cible). */
export function resolveMelee(att, def) {
  return guarded(att, def, () => meleeOnce(att, def));
}

async function meleeOnce(att, def) {
  const scene = att.parent;
  // Les tirs se résolvent avant les mêlées : leurs pertes en attente s'appliquent d'abord.
  await flushShots(scene);
  // Une volée en attente a pu mettre l'attaquant hors de combat ou détruire le défenseur : plus de mêlée.
  if (["routed", "destroyed"].includes(att.actor.system.state) || def.actor.system.state === "destroyed") {
    return ui.notifications.warn(fmt("AFC.Battle.MeleeCancelled", { a: att.name, d: def.name }));
  }
  const battle = getBattle(scene);
  const m = meleeMods(att, def, battle);
  m.warnings.push(...uncommanded([att, def], battle));
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
  if (!opts || stale(battle, att, def, scene)) return;
  markActed(att);
  const pa = pool(ra, m.am, opts.a), pd = pool(rd, m.dm, opts.d);
  const ta = await rollDice(pa);
  const td = battle.singleDefense ? await defenseRoll(pd, def.id, scene) : await rollDice(pd);
  let winner = null, loser = null, degrees = 0;
  if (ta.total > td.total) { winner = att; loser = def; degrees = degreesOf(ta.total - td.total); }
  else if (td.total > ta.total) { winner = def; loser = att; degrees = degreesOf(td.total - ta.total); }
  let losses = degrees;
  const notes = [];
  if ((winner === att && m.heavyShock) || (winner === def && m.dHeavyShock)) { losses += 1; notes.push(loc("AFC.Battle.Trait.heavyShock.name")); }
  if (loser?.actor.system.has.heavyArmor && degrees >= 2) { losses -= 1; notes.push(loc("AFC.Battle.Trait.heavyArmor.name")); }
  // Se replier : un état de moins, au moins un ; une troupe légère peut n'en perdre aucun.
  const loserOrder = loser === att ? m.aOrder : m.dOrder;
  if (loser && loserOrder === "withdraw" && losses > 0) {
    const kept = loser.actor.system.has.light ? Math.max(0, losses - 1) : Math.max(1, losses - 1);
    if (kept < losses) { losses = kept; notes.push(loc("AFC.Battle.Order.withdraw")); }
  }
  // Deux troupes qui se visent : une seule mêlée, les deux engagements sont résolus.
  const mutual = unitOf(battle, def.id).target === att.id && ["charge", "attack"].includes(m.dOrder);
  await markEngaged(scene, [att.id, def.id], mutual ? [att.id, def.id] : [att.id], winner ? [[winner.id, "won", 1], [loser.id, "lost", 1], [winner.id, "inflicted", losses]] : []);
  const side = (token, r, mods, p, test, order) => ({
    name: token.name, roller: r.name, order: orderLabel(order), total: test.total, dice: test.dice,
    pool: poolLabel(p, test), tags: [...modTags(mods), ...(test.reused ? [loc("AFC.Battle.Options.sameRoll")] : [])], winner: winner === token
  });
  const apply = loser && losses > 0 ? { token: loser.id, losses, scene: scene.id } : null;
  const sides = [side(att, ra, m.am, pa, ta, m.aOrder), side(def, rd, m.dm, pd, td, m.dOrder)];
  // Le vainqueur d'abord : le verdict se lit d'une traite.
  if (winner === def) sides.reverse();
  const content = await renderCard("battle-melee", {
    sides, degrees,
    verdict: winner ? fmt("AFC.Battle.Card.Wins", { w: winner.name }) : loc("AFC.Battle.Card.Tie"),
    detail: winner ? [lossLabel(loser.name, losses), ...notes].join(" · ") : loc("AFC.Battle.Card.TieDetail"),
    ...cardApply(apply, opts.auto)
  });
  return postResult({ content, rolls: [ta.roll, td.roll].filter(Boolean), apply, auto: opts.auto });
}

/** Tir (tireur : jeton contrôlé ; cible : jeton ciblé). */
export function resolveShoot(shooter, target) {
  return guarded(shooter, target, () => shootOnce(shooter, target));
}

async function shootOnce(shooter, target) {
  const scene = shooter.parent;
  const battle = getBattle(scene);
  const m = shootMods(shooter, target, battle);
  m.warnings.push(...uncommanded([shooter], battle));
  const r = roller(shooter, battle, "shoot");
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
  if (!opts || stale(battle, shooter, target, scene)) return;
  markActed(shooter);
  // Tirs simultanés : pendant la phase de tir, les pertes attendent le dernier tir du tour.
  const volley = opts.auto && battle.revealed && unitOf(battle, shooter.id).order === "shoot";
  const p = pool(r, m.mods, opts);
  const test = await rollDice({ ...p, difficulty: m.difficulty });
  const degrees = test.outcome?.success ? test.outcome.degrees : 0;
  const losses = m.uncapped ? degrees : Math.min(1, degrees);
  if (shooter.actor.system.has.reload) await setReload(shooter.id, scene);
  // Touchée, même si elle encaisse : pas de réorganisation en fin de tour.
  await markEngaged(scene, degrees ? [target.id] : [], [shooter.id], [[shooter.id, "shots", 1], [shooter.id, "hits", degrees ? 1 : 0], [shooter.id, "inflicted", losses]]);
  const apply = losses ? { token: target.id, losses, scene: scene.id } : null;
  const content = await renderCard("battle-test", {
    title: loc("AFC.Battle.Card.Shoot"),
    subtitle: fmt("AFC.Battle.Card.ShootAt", { a: publicName(shooter), d: publicName(target) }),
    total: test.total, dice: test.dice, success: degrees > 0, degrees,
    verdict: degrees ? `${loc("AFC.Battle.Card.Hit")} : ${lossLabel(publicName(target), losses)}` : loc("AFC.Battle.Card.Miss"),
    detail: fmt("AFC.Battle.Card.Against", { n: m.difficulty, detail: m.diff.map(d => `${d.label} ${d.value}`).join(" + ") }),
    pool: poolLabel(p, test), tags: [r.name, ...modTags(m.mods)],
    ...cardApply(apply, opts.auto, volley)
  });
  const message = await postResult({ content, rolls: [test.roll], apply, auto: opts.auto, volley, scene });
  // Dernier tir du tour : toutes les pertes des tirs s'appliquent ensemble.
  if (volley && !plannedEngagements(getBattle(scene), scene).some(e => e.shoot)) await flushShots(scene);
  return message;
}

/** Pertes de la carte : appliquées tout de suite (en attendant l'encaissement), après le dernier tir, ou bouton pour le MJ. */
const cardApply = (apply, auto, volley = false) => ({
  apply: auto ? null : apply,
  pending: apply && auto ? loc(volley ? "AFC.Battle.Card.ShotPending" : "AFC.Battle.Card.Pending") : null
});
const PENDING_KEYS = ["AFC.Battle.Card.Pending", "AFC.Battle.Card.ShotPending"];

/** Publie la carte du résultat, puis applique les pertes si la case était cochée (ou les met en attente du dernier tir) : la carte se complète. */
async function postResult({ content, rolls, apply, auto, volley = false, scene = null }) {
  const message = await ChatMessage.create({ rolls, content });
  if (apply && auto && volley) {
    const battle = getBattle(scene);
    battle.pendingShots = [...(battle.pendingShots ?? []), { ...apply, message: message.id }];
    await saveBattle(battle, scene);
  } else if (apply && auto) await applyLosses(apply.token, apply.losses, message, apply.scene);
  return message;
}

/** Applique les pertes des tirs mises en attente : après le dernier tir, avant une mêlée, ou à la fin du tour (MJ). */
export async function flushShots(scene = canvas.scene) {
  const battle = getBattle(scene);
  const list = battle.pendingShots ?? [];
  if (!list.length) return;
  battle.pendingShots = [];
  await saveBattle(battle, scene);
  for (const shot of list) await applyLosses(shot.token, shot.losses, game.messages.get(shot.message) ?? null, scene.id);
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
      <label>${loc("AFC.Battle.Cushion")}<input type="number" name="spend" value="${Math.min(1, cushion, losses)}" min="0" max="${Math.min(cushion, losses)}"></label></div>`,
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
 * la carte d'origine (message), sinon dans une carte à part. La troupe est cherchée sur la scène de
 * la carte : le MJ peut en regarder une autre. Une carte ne s'applique qu'une fois.
 */
export async function applyLosses(tokenId, losses, message = null, sceneId = null) {
  const key = message?.id ?? tokenId;
  if (applying.has(key)) return;
  applying.add(key);
  try { return await lossesOnce(tokenId, losses, message, sceneId); } finally { applying.delete(key); }
}
const applying = new Set();

async function lossesOnce(tokenId, losses, message, sceneId) {
  const scene = game.scenes.get(sceneId) ?? canvas.scene;
  const token = scene?.tokens.get(tokenId);
  const actor = token?.actor;
  if (!actor) return ui.notifications.warn(loc("AFC.Battle.TroopGone"));
  // Carte déjà remplie (bouton cliqué deux fois, ou par deux MJ) : rien à refaire.
  const card = message ? game.messages.get(message.id) ?? message : null;
  if (card && !card.content.includes('data-afc-battle="apply"') && !card.content.includes("data-afc-pending") && !PENDING_KEYS.some(k => card.content.includes(loc(k)))) return;
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
  if (state === "routed") notes.push(loc("AFC.Battle.Flee"));
  await actor.update({ "system.state": state, "system.cushion": s.cushion - spend, "system.disorders": disorders });
  const outcome = `<strong class="troop">${esc(publicName(token))}</strong>
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
  if (s.rallies >= s.ralliesMax) return ui.notifications.warn(loc("AFC.Battle.RallyLimit"));
  const morale = moraleMod(s);
  const discipline = Math.max(0, s.discipline + morale);
  const officerId = unitOf(getBattle(), tokenId).officer;
  // Ses propres personnages, et l'officier de la troupe, comme pour Commander.
  const candidates = game.actors.filter(a => ["character", "npc"].includes(a.type) && (a.isOwner || a.id === officerId) && a.system.abilities?.warfare);
  if (!candidates.length) return ui.notifications.warn(loc("AFC.Battle.NoRallier"));
  const pick = await DialogV2.prompt({
    window: { title: fmt("AFC.Battle.RallyTitle", { name: token.name }) },
    classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog"><p>${fmt("AFC.Battle.RallyIntro", { d: discipline, n: s.rallies, max: s.ralliesMax })}</p>
      <label>${loc("AFC.Battle.Rallier")}<select name="who">${candidates.map(a => `<option value="${a.id}" ${a.id === officerId ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
      <label>+B<input type="number" name="b" value="0"></label></div>`,
    ok: { label: loc("AFC.Battle.Roll"), callback: (ev, button) => ({ id: button.form.elements.who.value, b: Number(button.form.elements.b.value) || 0 }) },
    rejectClose: false
  });
  if (!pick || !(await mayAct(pick.id))) return;
  const rallier = game.actors.get(pick.id);
  const warfare = rallier.system.abilities.warfare;
  const p = { rank: warfare.rank, bonus: specialtyBonus(warfare, COMMAND) + pick.b };
  const test = await rollDice({ ...p, difficulty: discipline });
  // Rallier est l'action de bataille du personnage ce tour-ci, réussie ou non.
  await recordAction(pick.id, { action: "rally", troop: tokenId });
  const success = test.outcome?.success;
  if (success) {
    // Le joueur qui commande par son officier sans posséder la troupe passe par le MJ.
    const changes = { "system.state": STATE_ORDER[s.stateIndex - 1], "system.rallies": s.rallies + 1 };
    if (actor.isOwner) await actor.update(changes);
    else requestGM("troopUpdate", { actor: actor.id, changes });
  }
  return ChatMessage.create({
    rolls: [test.roll], speaker: ChatMessage.getSpeaker({ actor: rallier }), whisper: disciplineWhisper(token),
    content: await renderCard("battle-test", {
      title: loc("AFC.Battle.Card.Rally"),
      subtitle: fmt("AFC.Battle.Card.RallyBy", { who: rallier.name, name: token.name }),
      total: test.total, dice: test.dice, success, degrees: test.outcome?.degrees,
      verdict: success ? fmt("AFC.Battle.RallyOk", { state: loc(TROOP_STATES[STATE_ORDER[s.stateIndex - 1]].label) }) : loc("AFC.Battle.RallyFail"),
      detail: `${fmt("AFC.Battle.Card.AgainstDiscipline", { d: discipline })} · ${fmt("AFC.Battle.Card.RallyCount", { n: s.rallies + (success ? 1 : 0), max: s.ralliesMax })}`,
      pool: poolLabel(p, test), tags: morale ? [moraleLabel(morale)] : []
    })
  });
}

gmHandlers.troopUpdate = ({ actor, changes }) => game.actors.get(actor)?.update(changes);

/* ---------- Commander (test d'officier, en option) ---------- */

/** Difficulté : Discipline + 3, plus l'effectif (100 hommes se dirigent plus facilement que 300) et le moral de la Compagnie. */
export function commandDifficulty(s) {
  const size = Math.max(0, Math.ceil(s.men / 100) - 1) * OFFICER_TEST.perHundredMen;
  const morale = moraleMod(s);
  return { total: Math.max(0, s.discipline + OFFICER_TEST.margin + size + morale), size, morale };
}

/** L'officier peut-il encore commander cette troupe ce tour-ci ? C'est l'action qu'il choisit après la révélation, avant le jet de la troupe. */
export function mayCommand(token, battle = getBattle()) {
  const officerId = unitOf(battle, token.id).officer;
  return !!battle.officerTest && battle.revealed && !!game.actors.get(officerId)?.system.abilities?.warfare && alive(token)
    && canCommand(token, battle) && !battle.done.includes(token.id) && !battle.command.some(c => c.id === token.id && c.officer === officerId);
}

/** Officiers qui n'ont pas encore commandé : rappel au MJ avant de résoudre. */
const uncommanded = (tokens, battle) => (battle.officerTest ? tokens.filter(t => mayCommand(t, battle)).map(t => fmt("AFC.Battle.Options.notCommanded", { name: t.name })) : []);

const commanding = new Set();

/**
 * Fenêtre de l'action Commander : compétence ou spécialité de l'officier (Art militaire, Tactiques par défaut),
 * dés de bonus, de malus, modificateur et difficulté. Renvoie null si le joueur referme la fenêtre.
 */
function commandDialog(token, officer, d, detail) {
  const abilities = officer.system.abilities;
  const title = key => loc(ABILITIES[key].label);
  const keys = Object.keys(ABILITIES).filter(k => abilities[k]).sort((x, y) => title(x).localeCompare(title(y)));
  const tactics = abilities.warfare.specialties.findIndex(sp => TACTICS.includes(sp.name.trim().toLowerCase()));
  const selected = tactics >= 0 ? `warfare:${tactics}` : "warfare";
  const option = (value, label) => `<option value="${value}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`;
  const options = keys.map(k => [
    option(k, `${title(k)} (${abilities[k].rank})`),
    ...abilities[k].specialties.map((sp, i) => option(`${k}:${i}`, `${title(k)} (${abilities[k].rank}), ${sp.name} +${sp.bonus}${loc("AFC.Roll.BonusAbbr")}`))
  ].join("")).join("");
  // Le malus d'armure ne joue que sur l'Agilité : il ne s'affiche pas ici, le calcul final suit la compétence choisie.
  const notes = autoPenalties(officer, "warfare").notes;
  return DialogV2.prompt({
    window: { title: fmt("AFC.Battle.Options.commandDialog", { name: token.name }) },
    classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog">
      <p class="hint">${esc(officer.name)} · ${loc("AFC.Battle.Options.commandOutcome")}</p>
      <label>${loc("AFC.Battle.Options.commandSkill")}<select name="skill">${options}</select></label>
      <div class="row">
        <label>${loc("AFC.Roll.Bonus")}<input type="number" name="bonus" value="0" min="0"></label>
        <label>${loc("AFC.Roll.Penalty")}<input type="number" name="penalty" value="0" min="0"></label>
        <label>${loc("AFC.Roll.Modifier")}<input type="number" name="modifier" value="0"></label>
      </div>
      ${notes.length ? `<label class="checkbox"><input type="checkbox" name="auto" checked> ${loc("AFC.Roll.ApplyAuto")} : ${notes.map(n => `<span class="tag">${esc(n)}</span>`).join("")}</label>` : ""}
      <label>${loc("AFC.Roll.Difficulty")}<input type="number" name="difficulty" value="${d.total}" min="0"></label>
      <p class="hint">${esc(detail)}</p></div>`,
    ok: {
      label: loc("AFC.Roll.Roll"),
      callback: (ev, button) => {
        const f = button.form.elements;
        const [key, index] = f.skill.value.split(":");
        const ability = abilities[key];
        const sp = index === undefined ? null : ability.specialties[Number(index)];
        const auto = (f.auto?.checked ?? true) ? autoPenalties(officer, key) : { dice: 0, modifier: 0, notes: [] };
        const difficulty = f.difficulty.value === "" ? d.total : Number(f.difficulty.value);
        return {
          skill: sp ? `${title(key)}, ${sp.name}` : title(key), notes: auto.notes, difficulty,
          pool: { rank: ability.rank, bonus: (sp?.bonus ?? 0) + (Number(f.bonus.value) || 0), penalty: (Number(f.penalty.value) || 0) + auto.dice, modifier: (Number(f.modifier.value) || 0) + auto.modifier }
        };
      }
    },
    rejectClose: false
  });
}

/** Action Commander : le joueur lance le test de son officier ; la carte de l'ennemi et des troupes cachées reste au MJ. */
export async function commandTroop(tokenId) {
  const token = canvas.scene.tokens.get(tokenId);
  const battle = getBattle();
  if (!token?.actor || commanding.has(tokenId) || !mayCommand(token, battle)) return;
  if (!game.users.activeGM) return ui.notifications.warn(loc("AFC.BattleBook.NoGM"));
  commanding.add(tokenId);
  try {
    const s = token.actor.system;
    const officerId = unitOf(battle, tokenId).officer;
    const officer = game.actors.get(officerId);
    // Une action de bataille par personnage et par tour.
    if (!(await mayAct(officerId, battle))) return;
    const d = commandDifficulty(s);
    const detail = [fmt("AFC.Battle.Options.commandDetail", { d: s.discipline, m: OFFICER_TEST.margin }), ...(d.size ? [fmt("AFC.Battle.Options.commandSize", { n: d.size })] : []), ...(d.morale ? [moraleLabel(d.morale)] : [])].join(" + ");
    const opts = await commandDialog(token, officer, d, fmt("AFC.Battle.Card.Against", { n: d.total, detail }));
    if (!opts) return;
    const p = opts.pool;
    const test = await rollDice({ ...p, difficulty: opts.difficulty });
    const success = test.outcome.success;
    const degrees = success ? test.outcome.degrees : 0;
    const bonus = Math.min(OFFICER_TEST.max, Math.ceil(degrees / OFFICER_TEST.degreesPerBonus));
    const result = { id: tokenId, officer: officerId, bonus, scene: token.parent.id };
    await (game.user.isGM ? gmHandlers.setCommand(result) : requestGM("setCommand", result));
    return await ChatMessage.create({
      rolls: [test.roll], speaker: ChatMessage.getSpeaker({ actor: officer }),
      whisper: disciplineWhisper(token),
      content: await renderCard("battle-test", {
        title: loc("AFC.Battle.Options.commandButton"),
        subtitle: fmt("AFC.Battle.Options.commandBy", { who: officer.name, name: token.name }),
        total: test.total, dice: test.dice, success, degrees,
        verdict: bonus ? fmt("AFC.Battle.Options.commandOk", { n: bonus }) : loc("AFC.Battle.Options.noBonus"),
        detail: opts.difficulty === d.total ? fmt("AFC.Battle.Card.Against", { n: d.total, detail }) : fmt("AFC.Battle.Options.commandCustom", { n: opts.difficulty, d: d.total }),
        pool: poolLabel(p, test), tags: [opts.skill, ...opts.notes]
      })
    });
  } finally { commanding.delete(tokenId); }
}

gmHandlers.setCommand = async data => {
  const { id, officer, bonus } = data;
  const scene = sceneOf(data);
  const battle = getBattle(scene);
  battle.command = [...battle.command.filter(c => c.id !== id), { id, officer, bonus }];
  // Commander est l'action de bataille de l'officier ce tour-ci.
  battle.actions = withAction(battle, officer, { kind: "battle", action: "command", troop: id });
  await saveBattle(battle, scene);
};

/* ---------- Suivi du tour ---------- */

/** Note les troupes engagées en mêlée et les engagements résolus ce tour-ci. */
async function markEngaged(scene, ids, done = [], stats = []) {
  const battle = getBattle(scene);
  battle.stats ??= {};
  for (const [id, key, n] of stats) {
    battle.stats[id] ??= {};
    battle.stats[id][key] = (battle.stats[id][key] ?? 0) + n;
  }
  battle.engaged = [...new Set([...battle.engaged, ...ids])];
  battle.done = [...new Set([...battle.done, ...done])];
  await saveBattle(battle, scene);
}

/**
 * Engagements encore à résoudre : cibles désignées, tirs d'abord, puis mêlées. Une troupe en déroute
 * ou détruite n'attaque plus, et une cible retirée de la scène annule l'engagement.
 */
export function plannedEngagements(battle = getBattle(), scene = canvas.scene) {
  return battle.units.filter(u => u.target && ["charge", "attack", "shoot"].includes(u.order) && !battle.done.includes(u.id)).map(u => {
    const from = scene.tokens.get(u.id), to = scene.tokens.get(u.target);
    if (!from?.actor || !to?.actor || ["routed", "destroyed"].includes(from.actor.system.state)) return null;
    // Une cible détruite sort du combat ; une cible en déroute ne combat plus, on peut encore lui tirer dessus.
    if (to.actor.system.state === "destroyed" || (u.order !== "shoot" && to.actor.system.state === "routed")) return null;
    // Rechargement : pas de tir au tour qui suit un tir.
    if (u.order === "shoot" && (battle.reload ?? []).includes(u.id)) return null;
    // Après les mouvements, un tir demande la portée (la carte des mouvements le signale)...
    if (battle.revealed && u.order === "shoot" && distance(from, to) > shootRange(from.actor.system, battle)) return null;
    // ... et une mêlée demande le contact.
    if (battle.revealed && u.order !== "shoot" && !adjacent(from, to)) return null;
    return { from: u.id, to: u.target, fromName: from.name, toName: to.name, order: orderLabel(u.order), shoot: u.order === "shoot" };
  }).filter(Boolean).sort((a, b) => b.shoot - a.shoot);
}

/** Résout un engagement prévu : tir si l'ordre est Tirer, sinon mêlée. */
export function resolvePlanned(plan) {
  const a = canvas.scene.tokens.get(plan.from), d = canvas.scene.tokens.get(plan.to);
  if (!a || !d) return;
  return plan.shoot ? resolveShoot(a, d) : resolveMelee(a, d);
}
async function setReload(id, scene) {
  const battle = getBattle(scene);
  battle.reloadNext = [...new Set([...(battle.reloadNext ?? []), id])];
  await saveBattle(battle, scene);
}

export const orderLabel = key => (key ? loc(`AFC.Battle.Order.${key}`) : "—");

/** Révélation des ordres : carte de chat. */
/** Révélation en cours (un double clic ne la joue qu'une fois). */
let revealing = false;

export async function revealOrders() {
  if (revealing) return;
  revealing = true;
  try { return await revealOnce(); } finally { revealing = false; }
}

async function revealOnce() {
  const battle = getBattle();
  if (battle.revealed) return;
  battle.revealed = true;
  battle.moved = [];
  // Embuscades du tour : relevées avant les mouvements, qui peuvent révéler les troupes.
  battle.ambush = canvas.scene.tokens.filter(t => t.actor?.type === "troop" && t.hidden && alive(t) && !t.getFlag(SYSTEM_ID, "fog")?.acted
    && OFFENSIVE.includes(unitOf(battle, t.id).order)).map(t => t.id);
  await saveBattle(battle);
  // Les troupes cachées n'apparaissent pas dans la carte publique.
  const line = t => {
    const u = unitOf(battle, t.id);
    const target = u.target ? canvas.scene.tokens.get(u.target) : null;
    const icon = ORDER_ICONS[u.order] ?? "fa-minus";
    return `<li><i class="fa-solid ${icon}"></i><b>${esc(fogName(t, { forAll: true }))}</b> <span class="order">${esc(orderLabel(u.order))}${target && !target.hidden ? ` → ${esc(publicName(target))}` : ""}</span></li>`;
  };
  const troops = side => canvas.scene.tokens.filter(t => t.actor?.type === "troop" && t.actor.system.side === side && !t.hidden && alive(t));
  const group = side => {
    const list = troops(side);
    return list.length ? `<h4>${loc(`AFC.Battle.Side.${side}`)}</h4><ul class="orders">${list.map(line).join("")}</ul>` : "";
  };
  const message = await ChatMessage.create({
    content: `<div class="afc-card battle"><header><h3>${fmt("AFC.Battle.RevealTitle", { n: battle.round })}</h3></header>${group("company")}${group("enemy")}</div>`
  });
  // Les jetons ne bougent qu'ici : tous en même temps, une fois les ordres connus.
  await executeMoves();
  return message;
}

let ending = false;

/**
 * Fin de tour : réorganisation (Tenir sans combat), fuites, nouveau tour. Une seule à la fois (double
 * clic), et confirmation si elle efface des ordres non révélés ou laisse des engagements.
 */
export async function endTurn() {
  if (ending) return;
  ending = true;
  try {
    const before = getBattle();
    const warn = [];
    if (!before.revealed) warn.push(loc("AFC.Battle.EndTurnWarn.notRevealed"));
    else {
      const left = plannedEngagements(before).length;
      if (left) warn.push(fmt(left === 1 ? "AFC.Battle.EndTurnWarn.left1" : "AFC.Battle.EndTurnWarn.leftN", { n: left }));
    }
    if (resolvingOpen()) warn.push(loc("AFC.Battle.EndTurnWarn.open"));
    if (warn.length) {
      const ok = await DialogV2.confirm({
        window: { title: loc("AFC.Battle.EndTurn") }, classes: ["afc", "afc-dialog"],
        content: `${warn.map(w => `<p>${esc(w)}</p>`).join("")}<p>${loc("AFC.Battle.EndTurnWarn.confirm")}</p>`, rejectClose: false
      });
      if (!ok || getBattle().round !== before.round) return;
    }
    // Tirs encore en attente (le MJ a sauté un tir) : leurs pertes s'appliquent avant le nouveau tour.
    await flushShots();
    return await endTurnNow();
  } finally { ending = false; }
}

async function endTurnNow() {
  // Replis au contact et relèves : après les tirs et les mêlées.
  const lines = await executeDeferredMoves(canvas.scene);
  const battle = getBattle();
  for (const token of canvas.scene.tokens.filter(t => t.actor?.type === "troop")) {
    const s = token.actor.system;
    if (unitOf(battle, token.id).order === "hold" && !battle.engaged.includes(token.id) && ["shaken", "disordered"].includes(s.state)) {
      const state = STATE_ORDER[s.stateIndex - 1];
      await token.actor.update({ "system.state": state });
      lines.push(fmt("AFC.Battle.Reorganized", { name: esc(fogName(token, { forAll: true })), state: loc(TROOP_STATES[state].label) }));
    }
    if (s.state === "routed") lines.push(fmt("AFC.Battle.Fleeing", { name: esc(fogName(token, { forAll: true })) }));
  }
  // Relue après les mises à jour : un point de plan dépensé entre-temps reste dépensé.
  Object.assign(battle, getBattle());
  battle.round += 1;
  battle.revealed = false;
  battle.engaged = [];
  battle.ambush = [];
  battle.contact = [];
  battle.deferred = [];
  battle.done = [];
  battle.reload = battle.reloadNext ?? [];
  battle.reloadNext = [];
  battle.moved = [];
  battle.command = [];
  battle.defenseDice = [];
  battle.pendingShots = [];
  battle.actions = [];
  await saveBattle(battle);
  // On garde l'officier ; ordre, cible et contre-ordre repartent de zéro.
  await resetOrders();
  return ChatMessage.create({
    content: `<div class="afc-card battle"><header><h3>${fmt("AFC.Battle.EndTurnTitle", { n: battle.round - 1 })}</h3></header>
      <ul class="month-lines">${lines.map(l => `<li>${l}</li>`).join("") || `<li>${loc("AFC.Battle.NothingToReport")}</li>`}</ul></div>`
  });
}

/** Ce qu'a fait une troupe, en une ligne. */
function troopFacts(s, stat = {}) {
  const facts = [];
  const count = (n, one, many) => { if (n) facts.push(fmt(n === 1 ? one : many, { n })); };
  count(stat.won, "AFC.Battle.ReportCard.Won1", "AFC.Battle.ReportCard.WonN");
  count(stat.lost, "AFC.Battle.ReportCard.Lost1", "AFC.Battle.ReportCard.LostN");
  if (stat.shots) facts.push(fmt("AFC.Battle.ReportCard.Shots", { hits: stat.hits ?? 0, shots: stat.shots }));
  count(s.rallies, "AFC.Battle.ReportCard.Rally1", "AFC.Battle.ReportCard.RallyN");
  count(s.disorders, "AFC.Battle.ReportCard.Disorder1", "AFC.Battle.ReportCard.DisorderN");
  return facts.join(" · ");
}

/** Ce que le bilan retient d'une troupe. */
const reportEntry = token => {
  const s = token.actor.system;
  return { id: token.id, name: token.name, hidden: token.hidden, fog: !!token.getFlag(SYSTEM_ID, "fog"), side: s.side, state: s.state, men: s.men, lostMen: s.lostMen, loss: s.loss, lossBase: s.lossBase, care: s.care, rallies: s.rallies, disorders: s.disorders };
};

/** Troupe touchée retirée de la scène (une troupe détruite, par exemple) : ses pertes restent au bilan (MJ). */
export function keepRemovedTroop(token) {
  const scene = token.parent;
  if (!game.user.isGM || token.actor?.type !== "troop" || !token.actor.system.loss || !scene?.getFlag(SYSTEM_ID, "battle")) return;
  const entry = reportEntry(token);
  const battle = getBattle(scene);
  battle.removed = [...(battle.removed ?? []).filter(r => r.id !== entry.id), entry];
  saveBattle(battle, scene);
}

/** Bilan compact : pertes par camp, une ligne par troupe touchée (ses faits d'armes au survol). Réservé au MJ jusqu'à publication. */
export async function battleReport() {
  // Des tirs du dernier tour attendent encore leurs pertes : elles comptent au Bilan.
  await flushShots(canvas.scene);
  const battle = getBattle();
  // Soins recalculés avec les services actuels de la Compagnie (achetés ou retirés pendant la bataille).
  const onScene = canvas.scene.tokens.filter(t => t.actor?.type === "troop");
  for (const t of onScene) t.actor.prepareData();
  const troops = [...onScene.map(reportEntry), ...(battle.removed ?? [])].filter(t => !t.hidden || t.fog || t.loss > 0);
  const sides = ["company", "enemy"].map(key => {
    const list = troops.filter(t => t.side === key);
    const men = list.reduce((n, t) => n + t.men, 0);
    const lost = list.reduce((n, t) => n + t.lostMen, 0);
    const pct = men ? Math.round(lost * 100 / men) : 0;
    const touched = list.filter(t => t.loss > 0);
    const rows = touched.map(t => ({
      name: t.name, state: t.state, stateLabel: loc(TROOP_STATES[t.state].label), loss: t.loss, lostMen: t.lostMen, facts: troopFacts(t, battle.stats?.[t.id]),
      // Soins de la Compagnie : part rendue et pertes qu'il y aurait eu sans eux.
      care: t.care ? fmt("AFC.Battle.ReportCard.Care", { pct: Math.round(t.care * 100), n: Math.round(t.men * (t.lossBase ?? t.loss) / 100) }) : ""
    })).sort((a, b) => b.loss - a.loss || b.lostMen - a.lostMen);
    const intact = list.length - touched.length;
    // Rappel des services de culte : moins de Cohésion perdue sur une défaite ou un coup dur.
    const company = key === "company" ? onScene.filter(t => t.actor.system.side === "company").map(t => game.actors.get(t.actor.system.source.actor)).find(a => a?.type === "company") : null;
    const cohesionCare = company ? cohesionLossReduction(company) : 0;
    return {
      key, label: loc(`AFC.Battle.Side.${key}`), men, lost, pct, rows,
      intact: intact ? fmt(intact === 1 ? "AFC.Battle.ReportCard.Intact1" : "AFC.Battle.ReportCard.IntactN", { n: intact }) : "",
      cohesionCare: cohesionCare ? fmt("AFC.Battle.ReportCard.CohesionCare", { n: cohesionCare }) : ""
    };
  });
  return ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: await renderCard("battle-report", {
      rounds: Math.max(1, battle.round - (battle.revealed ? 0 : 1)), sides, roundsKey: battle.round - (battle.revealed ? 0 : 1) > 1 ? "AFC.Battle.ReportCard.Rounds" : "AFC.Battle.ReportCard.Rounds1"
    })
  });
}

/** Bouton « Appliquer les pertes » des cartes de chat (MJ). */
export function onRenderBattleCard(message, html) {
  html.querySelectorAll('[data-afc-battle="apply"]').forEach(button => {
    if (!game.user.isGM) return button.remove();
    button.addEventListener("click", () => {
      button.disabled = true;
      applyLosses(button.dataset.token, Number(button.dataset.losses), message, button.dataset.scene || null);
    });
  });
  // Bilan : le MJ le montre aux joueurs quand il est prêt.
  html.querySelectorAll('[data-afc-battle="publish"]').forEach(button => {
    if (!game.user.isGM) return button.remove();
    button.addEventListener("click", () => message.update({ whisper: [], content: message.content.replace(/<button[^>]*data-afc-battle="publish"[\s\S]*?<\/button>/, "") }));
  });
}
