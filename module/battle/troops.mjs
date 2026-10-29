/**
 * Troupes : création (depuis une unité de la Compagnie ou par le MJ), jetons et états visibles.
 */
import { SYSTEM_ID, UNIT_TRAININGS } from "../config.mjs";
import { COMPANY_UNIT_TYPES, HOUSE_UNIT_TYPES } from "../catalog-data.mjs";
import { STATE_ORDER, TRAINING_BATTLE, TROOP_STATES, TYPE_ICONS, TYPE_TRAITS } from "./battle-config.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);

/** Libellé d'un type d'unité (catalogue de la Compagnie, sinon de la Maison). */
export function typeLabel(key) {
  for (const prefix of ["AFC.CompanyCatalog.UnitType", "AFC.Catalog.UnitType"]) {
    if (game.i18n.has(`${prefix}.${key}`)) return loc(`${prefix}.${key}`);
  }
  return key;
}

/**
 * Types d'une unité : champ enregistré, sinon reconnus dans son nom (une unité à plusieurs types,
 * « Infanterie légère, Arbalétriers », cumule leurs traits). Le premier sert pour l'image.
 */
export function unitTypesOf(item) {
  if (item.system.unitType) return [item.system.unitType];
  const keys = [...Object.keys(COMPANY_UNIT_TYPES), ...Object.keys(HOUSE_UNIT_TYPES)];
  const byLabel = [...keys].sort((a, b) => typeLabel(b).length - typeLabel(a).length);
  return item.name.split(/[,(]/).map(part => part.trim().toLowerCase())
    .map(part => byLabel.find(k => part.startsWith(typeLabel(k).toLowerCase()))).filter(Boolean);
}

/** Image de jeton d'un type d'unité. */
export const troopIcon = type => `systems/${SYSTEM_ID}/assets/troops/${TYPE_ICONS[type] ?? "infantry"}.svg`;

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
async function createTroop({ name, side, unitType, training, men, discipline = null, traits = null, source = {}, ownership = {}, hidden = false }) {
  if (!canvas.scene) return ui.notifications.warn(loc("AFC.Battle.NoScene"));
  const typeData = COMPANY_UNIT_TYPES[unitType] ?? HOUSE_UNIT_TYPES[unitType] ?? {};
  const img = troopIcon(unitType);
  const actor = await Actor.create({
    name, type: "troop", img, folder: (await battleFolder()).id, ownership,
    system: {
      side, unitType, training, men, source,
      traits: traits ?? TYPE_TRAITS[unitType] ?? [],
      discipline: discipline ?? Math.max(0, (UNIT_TRAININGS[training]?.discipline ?? 6) + (typeData.discipline ?? 0)),
      cushion: TRAINING_BATTLE[training]?.cushion ?? 0
    },
    prototypeToken: {
      name, actorLink: true, texture: { src: img },
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
    name: item.name, side: "company", unitType: types[0] ?? "", training: item.system.training,
    traits: [...new Set(types.flatMap(t => TYPE_TRAITS[t] ?? []))],
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
      <label>${loc("AFC.Unit.training")}<select name="training">${trainings}</select></label>
      <label>${loc("AFC.Battle.Name")}<input type="text" name="name" placeholder="${loc("AFC.Battle.NamePlaceholder")}"></label>
      <label>${loc("AFC.Battle.Men")}<input type="number" name="men" value="100" min="0"></label>
      <label class="checkbox"><input type="checkbox" name="hidden" checked> ${loc("AFC.Battle.Hidden")}</label></div>`,
    ok: {
      label: loc("AFC.Battle.Create"),
      callback: (ev, button) => {
        const f = button.form.elements;
        return { type: f.type.value, training: f.training.value, name: f.name.value.trim(), men: Number(f.men.value) || 0, hidden: f.hidden.checked };
      }
    },
    rejectClose: false
  });
  if (!data) return;
  return createTroop({
    name: data.name || typeLabel(data.type), side: "enemy", unitType: data.type, training: data.training,
    men: data.men, hidden: data.hidden
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

/** Met les icônes d'état du jeton en accord avec l'état de la troupe. */
export async function syncTroopStatus(actor) {
  for (const key of STATE_ORDER) {
    if (!TROOP_STATES[key].icon) continue;
    const active = actor.system.state === key;
    if (actor.statuses.has(`afc-${key}`) !== active) await actor.toggleStatusEffect(`afc-${key}`, { active, overlay: key === "destroyed" });
  }
}
