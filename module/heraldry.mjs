/**
 * Générateur de blason (livre de base, chapitre 6, étape « Armoiries »).
 * 1. Couleurs : un émail (2d6), un métal (1d6) et une fourrure (3d6, souvent aucune).
 * 2. Champ : partition (7d6). Champ plain : une seule couleur ; champ divisé : une seconde couleur
 *    de la même famille (deux émaux ou deux métaux côte à côte sont permis).
 * 3. Charge : type (3d6) puis table correspondante. La charge est d'un métal sur un champ d'émail,
 *    d'un émail sur un champ de métal.
 */
import {
  ANIMALS, ATTITUDES, BIRDS, CHARGE_TYPES, FURS, LINES, METALS, OBJECTS, ORDINARIES, PARTITIONS, PLAIN, PLANTS,
  SUBORDINARIES, TINCTURES
} from "./heraldry-data.mjs";
import { canDraw, canDrawLine, renderArms } from "./heraldry-render.mjs";

const { DialogV2 } = foundry.applications.api;
const loc = key => game.i18n.localize(key);
const esc = s => foundry.utils.escapeHTML(String(s));

const roll = async formula => (await new Roll(formula).evaluate()).total;
const pick = (table, value) => table.find(([max]) => value <= max) ?? table.at(-1);
/** « de sinople », « d'argent ». */
const de = color => (/^[aeiouéâo]/i.test(color) ? `d'${color}` : `de ${color}`).toLowerCase();

/** Seconde couleur d'un champ divisé : relancée tant qu'elle est identique à la première. */
async function secondColor(table, formula, first) {
  for (let i = 0; i < 20; i++) {
    const r = await roll(formula);
    const row = pick(table, r);
    if (row[1] !== first) return { roll: r, name: row[1] };
  }
  return { roll: null, name: table.find(row => row[1] !== first)[1] };
}

/** Tire un blason complet ; chaque étape garde son jet pour l'affichage. */
async function generate() {
  const g = { steps: [] };
  const step = (label, formula, value, result, note = "") => g.steps.push({ label, formula, value, result, note });

  let r = await roll("2d6");
  const tincture = pick(TINCTURES, r);
  step(loc("AFC.Heraldry.Tincture"), "2d6", r, tincture[1], tincture[2]);
  r = await roll("1d6");
  const metal = pick(METALS, r);
  step(loc("AFC.Heraldry.Metal"), "1d6", r, metal[1], metal[2]);
  r = await roll("3d6");
  g.fur = pick(FURS, r)[1];
  step(loc("AFC.Heraldry.Fur"), "3d6", r, g.fur || loc("AFC.Heraldry.None"));
  g.tincture = tincture[1];
  g.metal = metal[1];

  r = await roll("7d6");
  g.partition = pick(PARTITIONS, r)[1];
  g.plain = g.partition === PLAIN;
  step(loc("AFC.Heraldry.Partition"), "7d6", r, g.partition);
  if (!g.plain) {
    g.secondTincture = await secondColor(TINCTURES, "2d6", g.tincture);
    g.secondMetal = await secondColor(METALS, "1d6", g.metal);
    step(loc("AFC.Heraldry.SecondColor"), "2d6 / 1d6", `${g.secondTincture.roll ?? "—"} / ${g.secondMetal.roll ?? "—"}`,
      `${g.secondTincture.name} / ${g.secondMetal.name}`, loc("AFC.Heraldry.SecondHint"));
  }

  r = await roll("3d6");
  const type = pick(CHARGE_TYPES, r)[1];
  step(loc("AFC.Heraldry.ChargeType"), "3d6", r, loc(`AFC.Heraldry.Type.${type}`));
  g.charge = await rollCharge(type, g, step);
  return g;
}

/** Charge selon son type (tables 6-12 à 6-17). */
async function rollCharge(type, g, step) {
  let r;
  switch (type) {
    case "line": {
      r = await roll("2d6");
      const line = pick(LINES, r)[1];
      step(loc("AFC.Heraldry.Type.line"), "2d6", r, line);
      // Ligne appliquée à la partition, ou à une pièce ordinaire sur un champ plain.
      if (!g.plain) { g.partitionLine = line; return null; }
      r = await roll("5d6");
      const ordinary = pick(ORDINARIES, r)[1];
      step(loc("AFC.Heraldry.Type.ordinary"), "5d6", r, ordinary);
      g.chargeSpec = { type: "ordinary", name: ordinary, line };
      return `${ordinary} (${line.toLowerCase()})`;
    }
    case "plant":
      r = await roll("2d6");
      step(loc("AFC.Heraldry.Type.plant"), "2d6", r, pick(PLANTS, r)[1]);
      g.chargeSpec = { type: "plant", name: pick(PLANTS, r)[1], count: 1 };
      return pick(PLANTS, r)[1];
    case "animal": {
      r = await roll("13d6");
      const animal = pick(ANIMALS, r)[1];
      // Attitude au choix : proposée au hasard (« éployé » réservé aux oiseaux).
      const attitudes = BIRDS.includes(animal) ? ATTITUDES : ATTITUDES.filter(a => a !== "éployé");
      const attitude = attitudes[(await roll(`1d${attitudes.length}`)) - 1];
      step(loc("AFC.Heraldry.Type.animal"), "13d6", r, `${animal} ${attitude}`, loc("AFC.Heraldry.AttitudeHint"));
      g.chargeSpec = { type: "animal", name: animal, attitude, count: 1 };
      return `${animal} ${attitude}`;
    }
    case "ordinary":
      r = await roll("5d6");
      step(loc("AFC.Heraldry.Type.ordinary"), "5d6", r, pick(ORDINARIES, r)[1]);
      g.chargeSpec = { type: "ordinary", name: pick(ORDINARIES, r)[1] };
      return pick(ORDINARIES, r)[1];
    case "subordinary": {
      r = await roll("2d6");
      let name = pick(SUBORDINARIES, r)[1];
      if (name.includes("X")) name = name.replace("X", String(await roll("1d6+1")));
      step(loc("AFC.Heraldry.Type.subordinary"), "2d6", r, name);
      g.chargeSpec = { type: "subordinary", name };
      return name;
    }
    case "object": {
      r = await roll("15d6");
      const object = pick(OBJECTS, r)[1];
      const count = Math.max(1, (await roll("1d6")) - 2);
      step(loc("AFC.Heraldry.Type.object"), "15d6", r, count > 1 ? `${object} ×${count}` : object, loc("AFC.Heraldry.CountHint"));
      g.chargeSpec = { type: "object", name: object, count };
      return count > 1 ? `${count} × ${object}` : object;
    }
  }
  return null;
}

/**
 * Description structurée du blason (pour le dessin), selon que le champ est d'émail ou de métal.
 * Champ divisé : la fourrure, s'il y en a une, remplace la seconde couleur (le livre le permet).
 * Champ plain : la fourrure n'est pas utilisée.
 */
function armsSpec(g, fieldIs) {
  const field = fieldIs === "metal" ? g.metal : g.tincture;
  const second = g.plain ? null : (g.fur || (fieldIs === "metal" ? g.secondMetal.name : g.secondTincture.name));
  const chargeColor = fieldIs === "metal" ? g.tincture : g.metal;
  return {
    partition: g.partition, line: g.partitionLine ?? null, colors: [field, second],
    charge: g.chargeSpec ? { ...g.chargeSpec, color: chargeColor } : null
  };
}

/** Texte du blason, tiré de la description structurée. */
function blazon(g, fieldIs) {
  const spec = armsSpec(g, fieldIs);
  const [field, second] = spec.colors;
  let text = g.plain ? de(field).replace(/^./, c => c.toUpperCase())
    : `${g.partition}${g.partitionLine ? ` ${g.partitionLine.toLowerCase()}` : ""} ${de(field)} et ${de(second)}`;
  if (g.charge) text += `, ${g.charge.toLowerCase()} ${de(spec.charge.color)}`;
  return text;
}

/** Tableau des jets : toujours 8 lignes d'une ligne de texte, pour que sa taille ne bouge pas entre deux tirages. */
const STEP_ROWS = 8;
function stepsHTML(g) {
  const rows = g.steps.map(s => {
    const result = s.note ? `${s.result} (${s.note})` : s.result;
    return `<tr><td class="role">${esc(s.label)}</td><td class="center">${esc(s.formula)} = ${esc(s.value)}</td>
      <td title="${esc(result)}"><strong>${esc(s.result)}</strong>${s.note ? ` <small>${esc(s.note)}</small>` : ""}</td></tr>`;
  });
  while (rows.length < STEP_ROWS) rows.push(`<tr class="empty"><td></td><td></td><td></td></tr>`);
  return `<table class="afc-table"><tbody>${rows.join("")}</tbody></table>`;
}

/** Choix du champ, avec les couleurs tirées : « Champ de sinople, charge d'or » ou l'inverse. */
function fieldOptions(g) {
  const opt = (value, field, charge) => `<option value="${value}">${esc(game.i18n.format("AFC.Heraldry.FieldOption", { field: de(field), charge: de(charge) }))}</option>`;
  return opt("tincture", g.tincture, g.metal) + opt("metal", g.metal, g.tincture);
}

/** Aperçu dessiné et avertissements (charge pas encore dessinée, ligne non représentée). */
function previewHTML(g, fieldIs) {
  const spec = armsSpec(g, fieldIs);
  const notes = [];
  if (!canDraw(spec.charge)) notes.push(game.i18n.format("AFC.Heraldry.NotDrawn", { name: spec.charge.name }));
  if (!canDrawLine(spec)) notes.push(game.i18n.format("AFC.Heraldry.LineNotDrawn", { line: (spec.line ?? spec.charge.line).toLowerCase() }));
  if (g.fur && g.plain) notes.push(loc("AFC.Heraldry.FurUnused"));
  return renderArms(spec, { id: "afc-arms-preview" }) + notes.map(n => `<p class="hint">${esc(n)}</p>`).join("");
}

/**
 * Ouvre le générateur. Renvoie { arms, spec, svg, portrait } : le texte, la description structurée,
 * l'image SVG et le choix de l'utiliser comme portrait ; rien si la fenêtre est fermée.
 */
export async function runHeraldry() {
  let g = await generate();
  const content = `<div class="afc-test-dialog afc-heraldry">
    <div class="heraldry-top">
      <div data-steps>${stepsHTML(g)}</div>
      <div class="heraldry-preview" data-preview></div>
    </div>
    <label>${loc("AFC.Heraldry.FieldIs")}<select name="fieldIs">${fieldOptions(g)}</select></label>
    <label>${loc("AFC.House.arms")}<textarea name="arms" rows="2">${esc(blazon(g, "tincture"))}</textarea></label>
    <label class="checkbox"><input type="checkbox" name="portrait" checked> ${loc("AFC.Heraldry.UseAsPortrait")}</label>
    <p class="hint">${loc("AFC.Heraldry.Hint")}</p>
    <button type="button" class="afc-create" data-reroll><i class="fa-solid fa-dice"></i> ${loc("AFC.Heraldry.Reroll")}</button>
  </div>`;
  return DialogV2.prompt({
    window: { title: loc("AFC.Heraldry.Title") },
    classes: ["afc", "afc-dialog"],
    position: { width: 820 },
    content,
    ok: {
      label: loc("AFC.Heraldry.Apply"),
      callback: (event, button) => {
        const f = button.form.elements;
        const spec = armsSpec(g, f.fieldIs.value);
        return { arms: f.arms.value.trim(), spec, svg: renderArms(spec), portrait: f.portrait.checked };
      }
    },
    render: (event, dialog) => {
      const root = dialog.element ?? dialog;
      const fieldIs = root.querySelector('[name="fieldIs"]');
      const arms = root.querySelector('[name="arms"]');
      const refresh = () => {
        arms.value = blazon(g, fieldIs.value);
        root.querySelector("[data-preview]").innerHTML = previewHTML(g, fieldIs.value);
      };
      // Aperçu posé après le rendu (le contenu initial du dialogue est nettoyé du SVG).
      refresh();
      fieldIs.addEventListener("change", refresh);
      root.querySelector("[data-reroll]").addEventListener("click", async () => {
        g = await generate();
        root.querySelector("[data-steps]").innerHTML = stepsHTML(g);
        const keep = fieldIs.value;
        fieldIs.innerHTML = fieldOptions(g);
        fieldIs.value = keep;
        refresh();
      });
    },
    rejectClose: false
  });
}

/** Enregistre l'image du blason dans les données du monde ; renvoie son chemin (ou null sans droit d'envoi). */
export async function saveArmsImage(actor, svg) {
  if (!game.user.can("FILES_UPLOAD")) {
    ui.notifications.warn(loc("AFC.Heraldry.NoUpload"));
    return null;
  }
  const FP = foundry.applications.apps.FilePicker.implementation;
  const dir = `worlds/${game.world.id}/heraldry`;
  try { await FP.createDirectory("data", dir); } catch (err) { /* dossier déjà présent */ }
  const file = new File([svg], `${actor.id}-${Date.now()}.svg`, { type: "image/svg+xml" });
  const result = await FP.upload("data", dir, file, {}, { notify: false });
  return result?.path ?? null;
}
