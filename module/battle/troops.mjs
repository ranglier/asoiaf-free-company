/**
 * Troupes : création (depuis une unité de la Compagnie ou par le MJ), jetons et états visibles.
 */
import { SYSTEM_ID, UNIT_TRAININGS } from "../config.mjs";
import { COMPANY_UNIT_TYPES, HOUSE_UNIT_TYPES } from "../catalog-data.mjs";
import { combineTypes, defaultSkillKeys } from "../unit-mix.mjs";
import { mergeTraits, STATE_ORDER, TRAINING_BATTLE, TROOP_STATES, TYPE_ICONS, TYPE_TRAITS } from "./battle-config.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);

/** Moral de la Compagnie sur la Discipline (une difficulté) : bon moral −2, solide −1, grogne +1, crise +2. Sans Compagnie : 0. */
// Le moral de la Compagnie ne vaut que pour ses troupes (une troupe passée à l'ennemi ne le prend plus).
export const moraleMod = s => (s.side === "company" ? 0 - (game.actors.get(s.source.actor)?.system.cohesionState?.discipline ?? 0) : 0);

/** Dés d'une compétence. Option : 3D au plus, le reste en dés de bonus ; un Bleu a 2D+1B sur ses compétences clés. */
export function troopPool(s, ability, battle) {
  const rank = s.book.abilities[ability];
  if (!battle.trainingBonus) return { rank, bonus: 0 };
  const keys = s.skillKeys?.length ? s.skillKeys : defaultSkillKeys(s.unitType, s.unitType2);
  if (s.training === "green" && keys.includes(ability)) return { rank: 2, bonus: 1 };
  return rank > 3 ? { rank: 3, bonus: rank - 3 } : { rank, bonus: 0 };
}

/** Libellé d'un type d'unité (catalogue de la Compagnie, sinon de la Maison). */
export function typeLabel(key) {
  for (const prefix of ["AFC.CompanyCatalog.UnitType", "AFC.Catalog.UnitType"]) {
    if (game.i18n.has(`${prefix}.${key}`)) return loc(`${prefix}.${key}`);
  }
  return key;
}

/**
 * Types d'une unité : champ enregistré, sinon reconnus dans son nom (une unité à plusieurs types,
 * « Infanterie légère, Arbalétriers », cumule leurs traits). Le dernier (« Arbalétriers », « Cavalerie lourde ») donne le symbole.
 */
export function unitTypesOf(item) {
  if (item.system.unitType) return [item.system.unitType2, item.system.unitType].filter(Boolean);
  const keys = [...Object.keys(COMPANY_UNIT_TYPES), ...Object.keys(HOUSE_UNIT_TYPES)];
  const byLabel = [...keys].sort((a, b) => typeLabel(b).length - typeLabel(a).length);
  return item.name.split(/[,(]/).map(part => part.trim().toLowerCase())
    .map(part => byLabel.find(k => part.startsWith(typeLabel(k).toLowerCase()))).filter(Boolean);
}

/** Symbole du jeton : type d'unité et camp (bleu pour la Compagnie, rouge pour l'ennemi). */
export const troopIcon = (type, side) =>
  `systems/${SYSTEM_ID}/assets/troops/${TYPE_ICONS[type] ?? "infantry"}-${side === "company" ? "company" : "enemy"}.svg`;

/** L'image est-elle un symbole du système (et non une image choisie par le joueur) ? */
export const isAutoIcon = img => !img || img.startsWith(`systems/${SYSTEM_ID}/assets/troops/`);

/** Change l'image d'une troupe : fiche, prochains jetons et jetons déjà posés. */
export async function setTroopImage(actor, img) {
  // Fiche d'un bloc (jeton) : l'image est celle de l'unité, pour tous ses blocs.
  actor = baseTroop(actor);
  await actor.update({ img, "prototypeToken.texture.src": img });
  // Toutes les scènes : la troupe peut être posée ailleurs que sur la scène affichée.
  for (const scene of game.scenes) {
    const updates = scene.tokens.filter(t => t.actorId === actor.id).map(t => ({ _id: t.id, "texture.src": img }));
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
  }
}

/** Le symbole suit le type et le camp ; une image choisie par le joueur reste en place. */
export async function refreshTroopImage(actor) {
  const img = troopIcon(actor.system.unitType, actor.system.side);
  if (actor.img === img || !isAutoIcon(actor.img)) return;
  return setTroopImage(actor, img);
}

/** Dossier « Bataille » des acteurs, ou dossier au nom de la Compagnie (créé au besoin). */
async function battleFolder(name = loc("AFC.Battle.Folder")) {
  return game.folders.find(f => f.type === "Actor" && f.name === name) ?? Folder.create({ name, type: "Actor" });
}

/**
 * Blocs (décision du 2026-11-17) : une fiche par unité, chaque bloc posé sur la carte est un jeton non lié de cette
 * fiche, avec son propre effectif, état et encaissement. La fiche d'un bloc est celle de son jeton ; la fiche de
 * l'annuaire est l'unité au repos. Découper n'ajoute pas de fiche.
 */
export const baseTroop = actor => (actor?.isToken ? (actor.token?.baseActor ?? game.actors.get(actor.token?.actorId) ?? actor) : actor);

/** Blocs d'une unité posés sur les scènes qui ont une bataille (ou sur la scène active). */
export function blocksOf(actor) {
  const base = baseTroop(actor);
  if (!base) return [];
  return game.scenes.filter(s => s.getFlag(SYSTEM_ID, "battle") || s.active || s === canvas?.scene)
    .flatMap(scene => scene.tokens.filter(t => t.actorId === base.id && t.actor).map(token => ({ scene, token })));
}

/** Fiche de troupe d'une unité de la Compagnie ou de la Maison. */
export const troopOfUnit = item => game.actors.find(a => a.type === "troop" && a.system.source?.item === item.id);

/** Centre de la vue, aligné sur la grille, pour poser un jeton. */
function viewPosition() {
  const { x, y } = canvas.stage.pivot;
  const c = canvas.grid.getCenterPoint({ x, y });
  return { x: c.x - canvas.grid.sizeX / 2, y: c.y - canvas.grid.sizeY / 2 };
}

/** Données de troupe tirées d'une unité de la Compagnie ou de la Maison. */
function unitTroopData(owner, item) {
  const types = unitTypesOf(item);
  const ownership = Object.fromEntries(Object.entries(owner.ownership).filter(([k]) => k !== "default"));
  ownership.default = CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED;
  return {
    name: item.name, side: "company", unitType: types.at(-1) ?? "", unitType2: types.length > 1 ? types[0] : "",
    skillKeys: item.system.skillKeys, upgrades: item.system.upgrades, units: item.system.count, mightPerUnit: item.system.mightCost, training: item.system.training,
    traits: mergeTraits(types),
    men: item.system.totalMen, discipline: item.system.discipline, source: { actor: owner.id, item: item.id }, ownership, folderName: owner.name
  };
}

/** Crée l'acteur Troupe et son jeton au centre de la vue. */
async function createTroop(opts) {
  if (!canvas.scene) return ui.notifications.warn(loc("AFC.Battle.NoScene"));
  const actor = await createTroopActor(opts);
  if (actor) await placeTroop(actor, { hidden: opts.hidden });
  return actor;
}

/** Pose un bloc de l'unité au centre de la vue (jeton non lié : il porte son propre état). */
async function placeTroop(actor, { hidden = false } = {}) {
  // Brouillard de guerre : une troupe posée cachée par cette fenêtre reste gérée par le brouillard.
  const token = await actor.getTokenDocument({ ...viewPosition(), hidden, actorLink: false, flags: { [SYSTEM_ID]: { fog: { manual: false } } } });
  await canvas.scene.createEmbeddedDocuments("Token", [token.toObject()]);
}

/** Crée l'acteur Troupe (sans jeton). */
async function createTroopActor({ name, side, unitType, unitType2 = "", skillKeys = [], upgrades = {}, units = 1, mightPerUnit = 0, training, men, discipline = null, traits = null, source = {}, ownership = {}, folderName }) {
  const typeOf = key => COMPANY_UNIT_TYPES[key] ?? HOUSE_UNIT_TYPES[key];
  const typeData = typeOf(unitType) ? combineTypes(typeOf(unitType), typeOf(unitType2)) : {};
  const img = troopIcon(unitType, side);
  return Actor.create({
    name, type: "troop", img, folder: (await battleFolder(folderName)).id, ownership,
    system: {
      side, unitType, unitType2, skillKeys, upgrades, units, mightPerUnit, training, men, source,
      traits: traits ?? mergeTraits([unitType, unitType2]),
      discipline: discipline ?? Math.max(0, (UNIT_TRAININGS[training]?.discipline ?? 6) + (typeData.discipline ?? 0)),
      cushion: (TRAINING_BATTLE[training]?.cushion ?? 0) + (upgrades.armor ? 1 : 0)
    },
    prototypeToken: {
      name, actorLink: false, texture: { src: img }, lockRotation: true,
      // Vision large : sur une scène avec vision des jetons, le joueur voit tout le champ de bataille.
      sight: { enabled: true, range: 1000 },
      disposition: side === "company" ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : CONST.TOKEN_DISPOSITIONS.HOSTILE,
      displayName: CONST.TOKEN_DISPLAY_MODES.HOVER
    }
  });
}

/**
 * Fiche de troupe d'une unité : créée à l'ajout de l'unité dans la Compagnie ou la Maison, mise à jour depuis
 * l'unité à chaque déploiement (effectif, entraînement, améliorations) tant qu'aucun bloc n'est posé.
 */
export async function ensureUnitTroop(owner, item) {
  const data = unitTroopData(owner, item);
  const actor = troopOfUnit(item);
  if (!actor) return createTroopActor(data);
  // Unité déjà en bataille sur cette scène : on ne touche pas à sa fiche.
  if (canvas.scene?.tokens.some(t => t.actorId === actor.id)) return actor;
  const typeOf = key => COMPANY_UNIT_TYPES[key] ?? HOUSE_UNIT_TYPES[key];
  const mix = typeOf(data.unitType) ? combineTypes(typeOf(data.unitType), typeOf(data.unitType2)) : {};
  await actor.update({
    name: data.name, "prototypeToken.name": data.name, "prototypeToken.actorLink": false,
    "system.units": data.units, "system.men": data.men, "system.training": data.training, "system.upgrades": data.upgrades,
    "system.skillKeys": data.skillKeys, "system.mightPerUnit": data.mightPerUnit,
    "system.discipline": data.discipline ?? Math.max(0, (UNIT_TRAININGS[data.training]?.discipline ?? 6) + (mix.discipline ?? 0)),
    // Au repos, une unité est fraîche et a toute sa réserve.
    "system.state": "fresh", "system.disorders": 0, "system.rallies": 0,
    "system.cushion": (TRAINING_BATTLE[data.training]?.cushion ?? 0) + (data.upgrades?.armor ? 1 : 0)
  });
  return actor;
}

/** Déploie une unité de la Compagnie (ou de la Maison) sur la scène active : un bloc de sa fiche de troupe. */
export async function deployUnit(owner, item) {
  if (!canvas.scene) return ui.notifications.warn(loc("AFC.Battle.NoScene"));
  const existing = troopOfUnit(item);
  if (existing && canvas.scene.tokens.some(t => t.actorId === existing.id)) return ui.notifications.warn(game.i18n.format("AFC.Battle.AlreadyDeployed", { name: item.name }));
  const actor = await ensureUnitTroop(owner, item);
  if (!actor) return;
  await placeTroop(actor);
  ui.notifications.info(game.i18n.format("AFC.Battle.Deployed", { name: item.name }));
}

/** Crée une troupe ennemie (MJ) : type, entraînement, nom sans l'entraînement (secret pour les joueurs). */
export async function createEnemyTroop() {
  const types = Object.keys(COMPANY_UNIT_TYPES).map(k => `<option value="${k}">${typeLabel(k)}</option>`).join("");
  const trainings = Object.entries(UNIT_TRAININGS).map(([k, v]) => `<option value="${k}" ${k === "trained" ? "selected" : ""}>${loc(v.label)}</option>`).join("");
  const data = await DialogV2.prompt({
    window: { title: loc("AFC.Battle.NewEnemy") },
    classes: ["afc", "afc-dialog"],
    content: `<div class="afc-test-dialog">
      <label>${loc("AFC.Battle.UnitType")}<select name="type">${types}</select></label>
      <label>${loc("AFC.Unit.unitType2")}<select name="type2"><option value="">${loc("AFC.Unit.NoSecondType")}</option>${types}</select></label>
      <label>${loc("AFC.Unit.training")}<select name="training">${trainings}</select></label>
      <label>${loc("AFC.Battle.Name")}<input type="text" name="name" placeholder="${loc("AFC.Battle.NamePlaceholder")}"></label>
      <label>${loc("AFC.Unit.count")}<input type="number" name="units" value="1" min="1"></label>
      <label>${loc("AFC.Battle.Men")}<input type="number" name="men" value="100" min="0"></label>
      <label class="checkbox"><input type="checkbox" name="hidden" checked> ${loc("AFC.Battle.Hidden")}</label></div>`,
    ok: {
      label: loc("AFC.Battle.Create"),
      callback: (ev, button) => {
        const f = button.form.elements;
        return { type: f.type.value, type2: f.type2.value === f.type.value ? "" : f.type2.value, training: f.training.value, name: f.name.value.trim(), men: Number(f.men.value) || 0, units: Number(f.units.value) || 1, hidden: f.hidden.checked };
      }
    },
    rejectClose: false
  });
  if (!data) return;
  return createTroop({
    name: data.name || typeLabel(data.type), side: "enemy", unitType: data.type, unitType2: data.type2, training: data.training,
    men: data.men, units: data.units, hidden: data.hidden
  });
}

/** Effets d'état affichés sur le jeton. */
export function registerTroopStatuses() {
  for (const key of STATE_ORDER) {
    const s = TROOP_STATES[key];
    if (!s.icon) continue;
    CONFIG.statusEffects.push({ id: `afc-${key}`, name: s.label, img: s.icon });
  }
}

/**
 * L'état s'affiche désormais au centre du jeton (map.mjs) : on retire les icônes d'état de Foundry
 * posées par les versions précédentes (elles se plaçaient dans le coin du carré, hors du symbole).
 */
export async function syncTroopStatus(actor) {
  for (const key of STATE_ORDER) {
    if (actor.statuses.has(`afc-${key}`)) await actor.toggleStatusEffect(`afc-${key}`, { active: false });
  }
}
