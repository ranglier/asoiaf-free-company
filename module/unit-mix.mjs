/**
 * Unités à deux types (Infanterie légère + Arbalétriers) : Puissance additionnée, moins bon modificateur
 * de Discipline, type le moins nombreux pour les hommes, 3 compétences clés choisies parmi celles des
 * deux types. Le premier type est le type principal : il donne le symbole.
 */
import { ABILITIES } from "./config.mjs";
import { COMPANY_UNIT_TYPES, HOUSE_UNIT_TYPES } from "./catalog-data.mjs";
import { BOOK_ABILITY_PRIORITY } from "./battle/book-config.mjs";

const loc = key => game.i18n.localize(key);
const typeData = key => COMPANY_UNIT_TYPES[key] ?? HOUSE_UNIT_TYPES[key];

/** Compétences clés des deux types, les plus utiles au combat d'abord. */
export function unionKeys(a, b) {
  const keys = new Set([...(a?.abilities ?? []), ...(b?.abilities ?? [])]);
  return BOOK_ABILITY_PRIORITY.filter(k => keys.has(k));
}

/** Compétences clés d'une unité : celles de son type, ou les 3 premières des deux types. */
export function defaultSkillKeys(unitType, unitType2) {
  const a = typeData(unitType), b = unitType2 && unitType2 !== unitType ? typeData(unitType2) : null;
  if (b) return unionKeys(a, b).slice(0, 3);
  if (unitType === "support") return [];
  return a?.abilities?.length ? a.abilities : ["fighting", "endurance", "athletics"];
}

/** Coût, Discipline, hommes et classes du type, ou des deux types réunis. */
export function combineTypes(a, b) {
  if (!b) return { cost: a.cost, discipline: a.discipline, men: a.men ?? 100, classes: a.classes, mounted: !!a.mounted };
  return {
    cost: a.cost + b.cost,
    discipline: Math.max(a.discipline, b.discipline),
    men: Math.min(a.men ?? 100, b.men ?? 100),
    classes: [...new Set(`${a.classes} ${b.classes}`.split(/\s+/))].join(" "),
    mounted: !!(a.mounted || b.mounted)
  };
}

/** Cases à cocher du catalogue : 3 compétences clés au plus, proposées seulement pour une unité à deux types. */
export function bindSkillChoice(root, types) {
  const box = root.querySelector("[data-unit-skills]");
  let pair = null;
  const update = () => {
    const a = root.querySelector('[name="unitType"]').value, b = root.querySelector('[name="unitType2"]').value;
    if (`${a}|${b}` === pair) return;
    pair = `${a}|${b}`;
    const keys = b && b !== a ? unionKeys(types[a], types[b]) : [];
    box.innerHTML = keys.length ? `<span>${loc("AFC.Unit.ChooseSkills")}</span>${keys.map((k, i) =>
      `<label class="checkbox"><input type="checkbox" value="${k}" ${i < 3 ? "checked" : ""}> ${loc(ABILITIES[k].label)}</label>`).join("")}` : "";
  };
  box.addEventListener("change", event => {
    if (box.querySelectorAll("input:checked").length > 3) event.target.checked = false;
  });
  return { update, read: () => [...box.querySelectorAll("input:checked")].map(i => i.value) };
}
