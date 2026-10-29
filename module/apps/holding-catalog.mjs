import { ABILITIES, SYSTEM_ID, UNIT_TRAININGS } from "../config.mjs";
import {
  COMMUNITIES, FEATURES, HOLDINGS, HOUSE_UNIT_TRAINING_COSTS, HOUSE_UNIT_TYPES, MERCENARY_WEALTH, TERRAINS
} from "../catalog-data.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);

/**
 * Catalogue du patrimoine d'une Maison : possessions toutes faites, constructeur de domaine
 * (terrain + traits) et constructeur d'unité (entraînement + type). Chaque ajout crée un objet
 * sur la fiche ; la fenêtre reste ouverte pour en ajouter d'autres.
 */
export class HoldingCatalog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["afc", "sheet", "afc-catalog"],
    position: { width: 720, height: 760 },
    window: { title: "AFC.Catalog.Title", resizable: true },
    actions: {
      addHolding: HoldingCatalog.#onAddHolding,
      addDomain: HoldingCatalog.#onAddDomain,
      addUnit: HoldingCatalog.#onAddUnit
    }
  };

  static PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/apps/holding-catalog.hbs`, scrollable: [".tab-body"] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "holdings", label: "AFC.Catalog.TabHoldings" },
        { id: "domain", label: "AFC.Catalog.TabDomain" },
        { id: "unit", label: "AFC.Catalog.TabUnit" }
      ],
      initial: "holdings"
    }
  };

  get title() {
    return `${loc("AFC.Catalog.Title")} : ${this.actor.name}`;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const r = this.actor.system.resources;
    const groups = ["defense", "influence", "power", "wealth"].map(resource => ({
      resource,
      label: `AFC.House.Resource.${resource}`,
      available: r[resource].available,
      holdings: HOLDINGS.filter(h => h.resource === resource).map(h => ({
        ...h,
        name: loc(`AFC.Catalog.${h.key}.name`),
        effect: loc(`AFC.Catalog.${h.key}.effect`),
        requirement: game.i18n.has(`AFC.Catalog.${h.key}.requirement`) ? loc(`AFC.Catalog.${h.key}.requirement`) : "",
        affordable: h.cost <= r[resource].available
      }))
    }));
    const list = (obj, prefix) => Object.entries(obj).map(([key, cost]) => ({ key, cost, label: loc(`${prefix}.${key}`) }));
    return Object.assign(context, {
      tabs: this._prepareTabs("primary"),
      groups,
      landsAvailable: r.lands.available,
      powerAvailable: r.power.available,
      terrains: list(TERRAINS, "AFC.Catalog.Terrain"),
      features: list(FEATURES, "AFC.Catalog.Feature"),
      communities: list(COMMUNITIES, "AFC.Catalog.Community"),
      trainings: Object.entries(HOUSE_UNIT_TRAINING_COSTS).map(([key, cost]) => ({
        key, cost, label: loc(UNIT_TRAININGS[key].label), discipline: UNIT_TRAININGS[key].discipline
      })),
      unitTypes: Object.entries(HOUSE_UNIT_TYPES).map(([key, t]) => ({
        key, ...t, label: loc(`AFC.Catalog.UnitType.${key}`),
        abilityNames: t.abilities.map(a => loc(ABILITIES[a].label)).join(", ") || loc("AFC.Catalog.AnyThree")
      }))
    });
  }

  /** Met à jour les coûts affichés des constructeurs à chaque changement. */
  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    const refresh = () => {
      const domain = this.#readDomain();
      root.querySelector("[data-domain-cost]").textContent = domain.cost;
      root.querySelector("[data-domain-name]").textContent = domain.name;
      const unit = this.#readUnit();
      root.querySelector("[data-unit-cost]").textContent = unit.totalCost;
      root.querySelector("[data-unit-discipline]").textContent = unit.discipline;
      root.querySelector("[data-unit-notes]").textContent = unit.notes.join(" · ");
    };
    root.querySelectorAll(".builder input, .builder select").forEach(el => el.addEventListener("change", refresh));
    refresh();
  }

  /** Domaine décrit par le formulaire : terrain, traits, localité, coût total, nom. */
  #readDomain() {
    const root = this.element;
    const terrain = root.querySelector('[name="terrain"]').value;
    const features = [...root.querySelectorAll('[name="feature"]:checked')].map(i => i.value);
    const community = root.querySelector('[name="community"]').value;
    const cost = TERRAINS[terrain] + features.reduce((s, f) => s + FEATURES[f], 0) + (COMMUNITIES[community] ?? 0);
    const parts = [loc(`AFC.Catalog.Terrain.${terrain}`), ...features.map(f => loc(`AFC.Catalog.Feature.${f}`))];
    if (community) parts.push(loc(`AFC.Catalog.Community.${community}`));
    return { terrain, features, community, cost, name: `${loc("AFC.Catalog.DomainPrefix")} : ${parts.join(", ").toLowerCase()}` };
  }

  /** Unité décrite par le formulaire : entraînement, type, coût, discipline, notes. */
  #readUnit() {
    const root = this.element;
    const training = root.querySelector('[name="training"]').value;
    const typeKey = root.querySelector('[name="unitType"]').value;
    const count = Math.max(1, Number(root.querySelector('[name="count"]')?.value) || 1);
    const type = HOUSE_UNIT_TYPES[typeKey];
    const notes = [];
    if (typeKey === "peasants") notes.push(loc("AFC.Catalog.NotePeasants"));
    if (typeKey === "mercenaries") notes.push(game.i18n.format("AFC.Catalog.NoteMercenaries", { n: MERCENARY_WEALTH[training] }));
    if (typeKey === "warships") notes.push(loc("AFC.Catalog.NoteWarships"));
    if (typeKey === "garrison") notes.push(loc("AFC.Catalog.NoteGarrison"));
    const cost = HOUSE_UNIT_TRAINING_COSTS[training] + type.cost;
    return {
      training, typeKey, type, notes, count, cost, totalCost: cost * count,
      discipline: Math.max(0, UNIT_TRAININGS[training].discipline + type.discipline)
    };
  }

  static async #onAddHolding(event, target) {
    const h = HOLDINGS.find(x => x.key === target.dataset.key);
    if (!h) return;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: loc(`AFC.Catalog.${h.key}.name`),
      type: "holding",
      system: {
        resource: h.resource, cost: h.cost,
        effect: loc(`AFC.Catalog.${h.key}.effect`),
        requirement: game.i18n.has(`AFC.Catalog.${h.key}.requirement`) ? loc(`AFC.Catalog.${h.key}.requirement`) : "",
        buildTime: h.buildTime ? `${h.buildTime} ${loc("AFC.Catalog.Months")}` : ""
      }
    }]);
    ui.notifications.info(game.i18n.format("AFC.Catalog.Added", { name: loc(`AFC.Catalog.${h.key}.name`), actor: this.actor.name }));
    return this.render();
  }

  static async #onAddDomain() {
    const d = this.#readDomain();
    await this.actor.createEmbeddedDocuments("Item", [{
      name: d.name, type: "holding",
      system: { resource: "lands", cost: d.cost, effect: loc("AFC.Catalog.DomainEffect") }
    }]);
    ui.notifications.info(game.i18n.format("AFC.Catalog.Added", { name: d.name, actor: this.actor.name }));
    return this.render();
  }

  static async #onAddUnit() {
    const u = this.#readUnit();
    const name = `${loc(`AFC.Catalog.UnitType.${u.typeKey}`)} (${loc(UNIT_TRAININGS[u.training].label).toLowerCase()})${u.count > 1 ? ` ×${u.count}` : ""}`;
    await this.actor.createEmbeddedDocuments("Item", [{
      name, type: "unit",
      system: {
        training: u.training, mightCost: u.cost, disciplineMod: u.type.discipline,
        classes: u.type.classes, men: u.type.men ?? 100, count: u.count,
        keyAbilities: u.type.abilities.map(a => loc(ABILITIES[a].label)).join(", "),
        experience: UNIT_TRAININGS[u.training].experience,
        description: u.notes.length ? `<p>${u.notes.join("</p><p>")}</p>` : ""
      }
    }]);
    ui.notifications.info(game.i18n.format("AFC.Catalog.Added", { name, actor: this.actor.name }));
    return this.render();
  }
}
