/**
 * Troupes : création (depuis une unité de la Compagnie ou par le MJ), jetons et états visibles.
 */
import { SYSTEM_ID, UNIT_TRAININGS } from "../config.mjs";
import { COMPANY_UNIT_TYPES, HOUSE_UNIT_TYPES } from "../catalog-data.mjs";
import { combineTypes } from "../unit-mix.mjs";
import { mergeTraits, STATE_ORDER, TRAINING_BATTLE, TROOP_STATES, TYPE_ICONS, TYPE_TRAITS } from "./battle-config.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);

/** Moral de la Compagnie sur la Discipline (une difficulté) : bon moral −2, solide −1, grogne +1, crise +2. Sans Compagnie : 0. */
export const moraleMod = s => 0 - (game.actors.get(s.source.actor)?.system.cohesionState?.discipline ?? 0);

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
  await actor.update({ img, "prototypeToken.texture.src": img });
  // Toutes les scènes : la troupe peut être posée ailleurs que sur la scène affichée.
  for (const scene of game.scenes) {
    const updates = scene.tokens.filter(t => t.actorId === actor.id && t.actorLink).map(t => ({ _id: t.id, "texture.src": img }));
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
  }
}

/** Le symbole suit le type et le camp ; une image choisie par le joueur reste en place. */
export async function refreshTroopImage(actor) {
  const img = troopIcon(actor.system.unitType, actor.system.side);
  if (actor.img === img || !isAutoIcon(actor.img)) return;
  return setTroopImage(actor, img);
}

/** Dossier « Bataille » des acteurs (créé au besoin). */
async function battleFolder() {
  const name = loc("AFC.Battle.Folder");
  return game.folders.find(f => f.type === "Actor" && f.name === name) ?? Folder.create({ name, type: "Actor" });
}

/** Centre de la vue, aligné sur la grille, pour poser un jeton. */
function viewPosition() {
  const { x, y } = canvas.stage.pivot;
  const c = canvas.grid.getCenterPoint({ x, y });
  return { x: c.x - canvas.grid.sizeX / 2, y: c.y - canvas.grid.sizeY / 2 };
}

/** Crée l'acteur Troupe et son jeton au centre de la vue. */
async function createTroop({ name, side, unitType, unitType2 = "", skillKeys = [], upgrades = {}, units = 1, mightPerUnit = 0, training, men, discipline = null, traits = null, source = {}, ownership = {}, hidden = false }) {
  if (!canvas.scene) return ui.notifications.warn(loc("AFC.Battle.NoScene"));
  const typeOf = key => COMPANY_UNIT_TYPES[key] ?? HOUSE_UNIT_TYPES[key];
  const typeData = typeOf(unitType) ? combineTypes(typeOf(unitType), typeOf(unitType2)) : {};
  const img = troopIcon(unitType, side);
  const actor = await Actor.create({
    name, type: "troop", img, folder: (await battleFolder()).id, ownership,
    system: {
      side, unitType, unitType2, skillKeys, upgrades, units, mightPerUnit, training, men, source,
      traits: traits ?? mergeTraits([unitType, unitType2]),
      discipline: discipline ?? Math.max(0, (UNIT_TRAININGS[training]?.discipline ?? 6) + (typeData.discipline ?? 0)),
      cushion: (TRAINING_BATTLE[training]?.cushion ?? 0) + (upgrades.armor ? 1 : 0)
    },
    prototypeToken: {
      name, actorLink: true, texture: { src: img }, lockRotation: true,
      // Vision large : sur une scène avec vision des jetons, le joueur voit tout le champ de bataille.
      sight: { enabled: true, range: 1000 },
      disposition: side === "company" ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : CONST.TOKEN_DISPOSITIONS.HOSTILE,
      displayName: CONST.TOKEN_DISPLAY_MODES.HOVER
    }
  });
  const token = await actor.getTokenDocument({ ...viewPosition(), hidden });
  await canvas.scene.createEmbeddedDocuments("Token", [token.toObject()]);
  return actor;
}

/** Déploie une unité de la Compagnie (ou de la Maison) sur la scène active. */
export async function deployUnit(owner, item) {
  const types = unitTypesOf(item);
  const ownership = Object.fromEntries(Object.entries(owner.ownership).filter(([k]) => k !== "default"));
  ownership.default = CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED;
  const actor = await createTroop({
    name: item.name, side: "company", unitType: types.at(-1) ?? "", unitType2: types.length > 1 ? types[0] : "",
    skillKeys: item.system.skillKeys, upgrades: item.system.upgrades, units: item.system.count, mightPerUnit: item.system.mightCost, training: item.system.training,
    traits: mergeTraits(types),
    men: item.system.totalMen, discipline: item.system.discipline, source: { actor: owner.id, item: item.id }, ownership
  });
  if (actor) ui.notifications.info(game.i18n.format("AFC.Battle.Deployed", { name: item.name }));
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
