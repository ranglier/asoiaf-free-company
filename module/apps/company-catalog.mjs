import { ABILITIES, SERVICE_SIZES, SYSTEM_ID, UNIT_TRAININGS } from "../config.mjs";
import { COMPANY_SERVICES, COMPANY_UNIT_TYPES, UNLIMITED_SERVICE_CATEGORIES } from "../catalog-data.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);

/** Catégorie de catalogue d'un service déjà présent sur la Compagnie (null s'il a été créé à la main). */
const catalogCategory = item => item.getFlag(SYSTEM_ID, "catalog")?.category ?? null;

/**
 * Catalogue de la Compagnie : services (règles maison) et constructeur d'unité
 * (entraînement = coût en Effectif, type = coût en Puissance).
 */
export class CompanyCatalog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["afc", "sheet", "afc-catalog"],
    position: { width: 760, height: 780 },
    window: { title: "AFC.CompanyCatalog.Title", resizable: true },
    actions: {
      addService: CompanyCatalog.#onAddService,
      addUnit: CompanyCatalog.#onAddUnit
    }
  };

  static PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/apps/company-catalog.hbs`, scrollable: [""] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "services", label: "AFC.CompanyCatalog.TabServices" },
        { id: "unit", label: "AFC.Catalog.TabUnit" }
      ],
      initial: "services"
    }
  };

  get title() {
    return `${loc("AFC.CompanyCatalog.Title")} : ${this.actor.name}`;
  }

  /** Une Compagnie dispose-t-elle d'un service d'une catégorie donnée ? */
  #hasCategory(category) {
    return this.actor.items.some(i => i.type === "service" && catalogCategory(i) === category);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.actor.system;
    const spaceLeft = s.services.spaceMax - s.services.spaceUsed;
    // Services groupés par catégorie, avec les blocages (espace, catégorie déjà prise).
    const categories = [...new Set(COMPANY_SERVICES.map(x => x.category))].map(category => {
      const taken = !UNLIMITED_SERVICE_CATEGORIES.includes(category) && this.#hasCategory(category);
      return {
        category, label: `AFC.CompanyCatalog.Category.${category}`, taken,
        services: COMPANY_SERVICES.filter(x => x.category === category).map(x => {
          const size = SERVICE_SIZES[x.size];
          return {
            ...x, size, sizeLabel: size.label,
            name: loc(`AFC.CompanyCatalog.${x.key}.name`),
            effect: loc(`AFC.CompanyCatalog.${x.key}.effect`),
            fits: size.space <= spaceLeft && !taken
          };
        })
      };
    });
    return Object.assign(context, {
      tabs: this._prepareTabs("primary"),
      categories,
      space: { used: s.services.spaceUsed, max: s.services.spaceMax, left: spaceLeft },
      wealth: s.resources.wealth.value,
      manpower: s.resources.manpower.value,
      might: s.resources.might.value,
      trainings: Object.entries(UNIT_TRAININGS).map(([key, t]) => ({ key, label: loc(t.label), manpower: t.manpower, discipline: t.discipline })),
      unitTypes: Object.entries(COMPANY_UNIT_TYPES).map(([key, t]) => ({
        key, ...t, label: loc(`AFC.CompanyCatalog.UnitType.${key}`),
        abilityNames: t.abilities.map(a => loc(ABILITIES[a].label)).join(", ") || loc("AFC.Catalog.AnyThree")
      }))
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    const refresh = () => {
      const u = this.#readUnit();
      root.querySelector("[data-unit-manpower]").textContent = u.totalManpower;
      root.querySelector("[data-unit-might]").textContent = u.totalMight;
      root.querySelector("[data-unit-discipline]").textContent = u.discipline;
      root.querySelector("[data-unit-notes]").textContent = u.notes.join(" · ");
    };
    root.querySelectorAll(".builder select, .builder input").forEach(el => el.addEventListener("change", refresh));
    refresh();
  }

  /** Unité décrite par le formulaire : coûts, discipline et rappels de règles. */
  #readUnit() {
    const root = this.element;
    const training = root.querySelector('[name="training"]').value;
    const typeKey = root.querySelector('[name="unitType"]').value;
    const count = Math.max(1, Number(root.querySelector('[name="count"]')?.value) || 1);
    const type = COMPANY_UNIT_TYPES[typeKey];
    const t = UNIT_TRAININGS[training];
    const notes = [];
    // Maîtres équestres : −1 au coût en Puissance des unités montées.
    let might = type.cost;
    if (type.mounted && this.#hasCategory("horses")) {
      might = Math.max(0, might - 1);
      notes.push(loc("AFC.CompanyCatalog.NoteHorseMasters"));
    }
    if (training === "trained" && !this.#hasCategory("training")) notes.push(loc("AFC.CompanyCatalog.NoteTraining"));
    // Vétérans et élites : recrutement direct ou par l'expérience, au choix du MJ.
    if (["veteran", "elite"].includes(training)) notes.push(loc("AFC.CompanyCatalog.NoteVeteran"));
    if (typeKey === "garrison") notes.push(loc("AFC.Catalog.NoteGarrison"));
    if (typeKey === "volunteers" || typeKey === "special") notes.push(loc("AFC.CompanyCatalog.NoteSpecial"));
    // La discipline ne descend jamais sous Élémentaire (0).
    return {
      training, typeKey, type, notes, count, might,
      manpower: t.manpower, totalManpower: t.manpower * count, totalMight: might * count,
      discipline: Math.max(0, t.discipline + type.discipline)
    };
  }

  static async #onAddService(event, target) {
    const x = COMPANY_SERVICES.find(s => s.key === target.dataset.key);
    if (!x) return;
    const name = loc(`AFC.CompanyCatalog.${x.key}.name`);
    await this.actor.createEmbeddedDocuments("Item", [{
      name, type: "service",
      system: {
        size: x.size, category: loc(`AFC.CompanyCatalog.Category.${x.category}`),
        effect: loc(`AFC.CompanyCatalog.${x.key}.effect`), organization: x.organization ?? 0
      },
      flags: { [SYSTEM_ID]: { catalog: { key: x.key, category: x.category } } }
    }]);
    ui.notifications.info(game.i18n.format("AFC.Catalog.Added", { name, actor: this.actor.name }));
    return this.render();
  }

  static async #onAddUnit() {
    const u = this.#readUnit();
    const name = `${loc(`AFC.CompanyCatalog.UnitType.${u.typeKey}`)} (${loc(UNIT_TRAININGS[u.training].label).toLowerCase()})${u.count > 1 ? ` ×${u.count}` : ""}`;
    await this.actor.createEmbeddedDocuments("Item", [{
      name, type: "unit",
      system: {
        unitType: u.typeKey,
        training: u.training, mightCost: u.might, disciplineMod: u.type.discipline,
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
