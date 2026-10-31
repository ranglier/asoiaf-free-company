/**
 * Peinture des terrains (MJ) : on choisit un terrain dans le panneau, puis on clique ou on glisse sur
 * les cases de la carte pour les ajouter ; un clic sur une case déjà peinte la retire.
 * Chaque terrain est une région Foundry faite d'hexagones exacts ; son effet vient de son type, son
 * nom est libre.
 */
import { SYSTEM_ID } from "../config.mjs";
import { regionTerrainKey } from "./engagement.mjs";
import { isBook } from "./rules.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);
const P = "AFC.Battle.Painter";

/** Types proposés et leur couleur d'origine. */
const TERRAIN_TYPES = {
  hill: "#c9a227", wood: "#2f5d1e", marsh: "#4f6f5a", river: "#3b6f9e", ford: "#6fa8c9", bridge: "#b79b70",
  road: "#d6c6a0", village: "#a0632f", obstacle: "#7a4a1e", ruins: "#6b6459", landmark: "#8e1b1b"
};

/* ---------- Cases et formes ---------- */

const cellPoints = offset => canvas.grid.getVertices(offset).flatMap(v => [Math.round(v.x), Math.round(v.y)]);

/** Une forme est-elle l'hexagone de cette case ? (comparaison des centres, à quelques pixels près) */
function isCellShape(shape, center) {
  if (shape.type !== "polygon" || shape.points?.length !== 12) return false;
  let x = 0, y = 0;
  for (let i = 0; i < 12; i += 2) { x += shape.points[i]; y += shape.points[i + 1]; }
  return Math.hypot(x / 6 - center.x, y / 6 - center.y) < 4;
}

const cellInRegion = (region, center) => region.shapes.some(s => isCellShape(s, center));

/** Ajoute ou retire une case d'un terrain. */
async function setCell(region, offset, present) {
  const center = canvas.grid.getCenterPoint(offset);
  const shapes = region.toObject().shapes;
  const index = shapes.findIndex(s => isCellShape(s, center));
  if (present && index < 0) shapes.push({ type: "polygon", points: cellPoints(offset), hole: false });
  else if (!present && index >= 0) shapes.splice(index, 1);
  else return;
  await region.update({ shapes });
}

/* ---------- Panneau ---------- */

export class TerrainPainter extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "afc-terrain-painter",
    classes: ["afc", "afc-terrain-painter"],
    position: { width: 360, height: "auto", top: 80, left: 120 },
    window: { title: "AFC.Battle.Painter.Title", icon: "fa-solid fa-paintbrush", resizable: true },
    actions: {
      pick: TerrainPainter.#onPick,
      create: TerrainPainter.#onCreate,
      remove: TerrainPainter.#onRemove
    }
  };

  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/apps/terrain-painter.hbs` } };

  /** Terrain en cours de peinture. */
  regionId = null;

  static open() {
    const app = foundry.applications.instances.get("afc-terrain-painter") ?? new TerrainPainter();
    return app.render({ force: true });
  }

  static refresh() {
    const app = foundry.applications.instances.get("afc-terrain-painter");
    if (app?.rendered && !app.stroke) app.render();
  }

  get region() {
    return canvas.scene?.regions.get(this.regionId) ?? null;
  }

  async _prepareContext() {
    const regions = canvas.scene?.regions.contents ?? [];
    const row = r => ({ id: r.id, name: r.name, color: r.color?.css ?? "#888888", cells: r.shapes.length, active: r.id === this.regionId });
    const region = this.region;
    const types = Object.fromEntries(Object.keys(TERRAIN_TYPES).map(k => [k, `${P}.Type.${k}`]));
    const key = region ? regionTerrainKey(region) ?? "landmark" : "";
    return {
      rows: regions.map(row), types, newType: this.newType ?? "wood",
      region: region ? {
        id: region.id, name: region.name, color: region.color?.css ?? "#888888", key,
        secret: region.visibility !== CONST.REGION_VISIBILITY.ALWAYS,
        effect: loc(`AFC.Battle.${isBook() ? "TerrainBook" : "TerrainEffect"}.${key}`)
      } : null
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const on = (name, handler) => this.element.querySelector(`[name="${name}"]`)?.addEventListener("change", event => handler(event.target));
    on("newType", el => { this.newType = el.value; });
    on("name", el => this.region?.update({ name: el.value.trim() || this.region.name }));
    on("color", el => this.region?.update({ color: el.value }));
    on("type", el => this.region?.setFlag(SYSTEM_ID, "terrain", el.value));
    on("secret", el => this.region?.update({ visibility: el.checked ? CONST.REGION_VISIBILITY.GAMEMASTER : CONST.REGION_VISIBILITY.ALWAYS }));
    this.#listen();
  }

  async close(options) {
    this.#unlisten();
    return super.close(options);
  }

  static #onPick(event, target) {
    this.regionId = target.dataset.region === this.regionId ? null : target.dataset.region;
    this.render();
  }

  static async #onCreate() {
    const type = this.newType ?? "wood";
    const [region] = await canvas.scene.createEmbeddedDocuments("Region", [{
      name: loc(`${P}.Type.${type}`), color: TERRAIN_TYPES[type], shapes: [],
      visibility: CONST.REGION_VISIBILITY.ALWAYS, flags: { [SYSTEM_ID]: { terrain: type } }
    }]);
    this.regionId = region.id;
    this.render();
  }

  static async #onRemove() {
    const region = this.region;
    if (!region) return;
    const ok = await DialogV2.confirm({
      window: { title: loc(`${P}.Delete`) }, classes: ["afc", "afc-dialog"],
      content: `<p>${game.i18n.format(`${P}.DeleteConfirm`, { name: foundry.utils.escapeHTML(region.name) })}</p>`, rejectClose: false
    });
    if (!ok) return;
    this.regionId = null;
    await region.delete();
    this.render();
  }

  /* ---------- Peinture sur la carte ---------- */

  #handlers = null;

  /** Tant qu'un terrain est choisi, le clic gauche sur la carte peint (le clic droit déplace toujours la vue). */
  #listen() {
    if (!canvas.ready) return;
    const view = canvas.app.view;
    if (!this.region) return this.#unlisten();
    view.style.cursor = "crosshair";
    if (this.#handlers) return;
    const down = event => {
      if (event.button !== 0 || !this.region) return;
      event.stopPropagation();
      event.preventDefault();
      const offset = this.#cellAt(event);
      if (!offset) return;
      // Le premier clic décide : on peint, ou on efface, pendant tout le geste.
      const present = !cellInRegion(this.region, canvas.grid.getCenterPoint(offset));
      this.stroke = { present, done: new Set(), queue: Promise.resolve() };
      this.#paint(offset);
    };
    const move = event => {
      if (!this.stroke) return;
      const offset = this.#cellAt(event);
      if (offset) this.#paint(offset);
    };
    const up = async () => {
      const stroke = this.stroke;
      if (!stroke) return;
      this.stroke = null;
      await stroke.queue;
      this.render();
    };
    view.addEventListener("pointerdown", down, { capture: true });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    this.#handlers = { down, move, up, view };
  }

  #unlisten() {
    if (!this.#handlers) {
      if (canvas.ready) canvas.app.view.style.cursor = "";
      return;
    }
    const { down, move, up, view } = this.#handlers;
    view.removeEventListener("pointerdown", down, { capture: true });
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    view.style.cursor = "";
    this.#handlers = null;
    this.stroke = null;
  }

  /** La case sous la souris, seulement sur la carte elle-même (pas sur le panneau ni hors de la scène). */
  #cellAt(event) {
    if (event.target !== canvas.app.view) return null;
    const point = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
    if (!canvas.dimensions.sceneRect.contains(point.x, point.y)) return null;
    return canvas.grid.getOffset(point);
  }

  #paint(offset) {
    const { stroke } = this;
    const key = `${offset.i},${offset.j}`;
    if (!stroke || stroke.done.has(key)) return;
    stroke.done.add(key);
    // Une mise à jour à la fois : chacune repart des formes enregistrées par la précédente.
    stroke.queue = stroke.queue.then(() => (this.region ? setCell(this.region, offset, stroke.present) : null));
  }
}
