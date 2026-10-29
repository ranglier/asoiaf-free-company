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
 * Blason structuré (modèle modifiable) tiré d'un jet, selon que le champ est d'émail ou de métal.
 * Champ divisé : la fourrure, s'il y en a une, remplace la seconde couleur (le livre le permet).
 * Champ plain : la fourrure n'est pas utilisée.
 * Rebattements : le nom garde « X » et le nombre de pièces va dans count.
 */
function fromRoll(g, fieldIs) {
  const field = fieldIs === "metal" ? g.metal : g.tincture;
  const second = g.plain ? null : (g.fur || (fieldIs === "metal" ? g.secondMetal.name : g.secondTincture.name));
  const charge = g.chargeSpec ? { count: 1, attitude: null, line: null, ...g.chargeSpec, color: fieldIs === "metal" ? g.tincture : g.metal } : null;
  if (charge?.type === "subordinary") {
    const x = charge.name.match(/\d+/)?.[0];
    charge.count = x ? Number(x) : 1;
    charge.name = SUBORDINARIES.find(([, n]) => n.replace("X", x) === charge.name)?.[1] ?? charge.name;
  }
  return { partition: g.partition, line: g.partitionLine ?? null, colors: [field, second], charge };
}

/** Description à dessiner : le « X » des rebattements est remplacé par le nombre. */
function renderSpec(m) {
  if (m.charge?.type !== "subordinary") return m;
  return { ...m, charge: { ...m.charge, name: m.charge.name.replace("X", String(m.charge.count ?? 6)) } };
}

/** Texte de la charge : « 3 × tour », « lion rampant », « bande (ondé) ». */
function chargeText(c) {
  const n = c.count > 1 ? `${c.count} × ` : "";
  switch (c.type) {
    case "subordinary": return c.name.replace("X", String(c.count ?? 6));
    case "ordinary": return c.line ? `${c.name} (${c.line.toLowerCase()})` : c.name;
    case "animal": return `${n}${c.name}${c.attitude ? ` ${c.attitude}` : ""}`;
    default: return `${n}${c.name}`;
  }
}

/** Texte du blason, tiré du modèle. */
function blazon(m) {
  const [field, second] = m.colors;
  let text = m.partition === PLAIN || !second ? de(field).replace(/^./, c => c.toUpperCase())
    : `${m.partition}${m.line ? ` ${m.line.toLowerCase()}` : ""} ${de(field)} et ${de(second)}`;
  if (m.charge) text += `, ${chargeText(m.charge).toLowerCase()} ${de(m.charge.color)}`;
  return text;
}

/** Tableau des jets : toujours 8 lignes d'une ligne de texte, pour que sa taille ne bouge pas entre deux tirages. */
const STEP_ROWS = 8;
function stepsHTML(g) {
  const rows = (g?.steps ?? []).map(s => {
    const result = s.note ? `${s.result} (${s.note})` : s.result;
    return `<tr><td class="role">${esc(s.label)}</td><td class="center">${esc(s.formula)} = ${esc(s.value)}</td>
      <td title="${esc(result)}"><strong>${esc(s.result)}</strong>${s.note ? ` <small>${esc(s.note)}</small>` : ""}</td></tr>`;
  });
  if (!g) rows.push(`<tr><td colspan="3" class="hint">${esc(loc("AFC.Heraldry.NoRoll"))}</td></tr>`);
  while (rows.length < STEP_ROWS) rows.push(`<tr class="empty"><td></td><td></td><td></td></tr>`);
  return `<table class="afc-table"><tbody>${rows.join("")}</tbody></table>`;
}

/** Choix du champ, avec les couleurs tirées : « Champ de sinople, charge d'or » ou l'inverse. */
function fieldOptions(g) {
  if (!g) return `<option value="">—</option>`;
  const opt = (value, field, charge) => `<option value="${value}">${esc(game.i18n.format("AFC.Heraldry.FieldOption", { field: de(field), charge: de(charge) }))}</option>`;
  return opt("tincture", g.tincture, g.metal) + opt("metal", g.metal, g.tincture);
}

/* ---------- Ajustement à la main ---------- */

const names = table => [...new Set(table.map(r => r[1]).filter(Boolean))];
const family = color => (TINCTURES.some(r => r[1] === color) ? "tincture" : METALS.some(r => r[1] === color) ? "metal" : "fur");
const CHARGE_LISTS = () => ({
  ordinary: names(ORDINARIES), subordinary: names(SUBORDINARIES), plant: names(PLANTS), animal: names(ANIMALS), object: names(OBJECTS)
});
const options = (list, blank = false) => (blank ? `<option value="">—</option>` : "") + list.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
function colorOptions() {
  const group = (label, list) => `<optgroup label="${esc(loc(label))}">${options(list)}</optgroup>`;
  return group("AFC.Heraldry.Tinctures", names(TINCTURES)) + group("AFC.Heraldry.Metals", names(METALS)) + group("AFC.Heraldry.Furs", names(FURS));
}

function editHTML() {
  const sel = (name, label, inner) => `<label>${esc(loc(label))}<select name="${name}">${inner}</select></label>`;
  return `<fieldset class="heraldry-edit"><legend>${esc(loc("AFC.Heraldry.Adjust"))}</legend>
    ${sel("partition", "AFC.Heraldry.Partition", options(names(PARTITIONS)))}
    ${sel("line", "AFC.Heraldry.Line", options(names(LINES), true))}
    ${sel("color1", "AFC.Heraldry.Field", colorOptions())}
    ${sel("color2", "AFC.Heraldry.SecondColor", `<option value="">—</option>${colorOptions()}`)}
    ${sel("ctype", "AFC.Heraldry.ChargeType", `<option value="">${esc(loc("AFC.Heraldry.None"))}</option>`
      + Object.keys(CHARGE_LISTS()).map(t => `<option value="${t}">${esc(loc(`AFC.Heraldry.Type.${t}`))}</option>`).join(""))}
    ${sel("cname", "AFC.Heraldry.Charge", "")}
    ${sel("ccolor", "AFC.Heraldry.ChargeColor", colorOptions())}
    <label>${esc(loc("AFC.Heraldry.Count"))}<input type="number" name="ccount" min="1" max="7" value="1"></label>
    ${sel("cattitude", "AFC.Heraldry.Attitude", options(ATTITUDES, true))}
    ${sel("cline", "AFC.Heraldry.ChargeLine", options(names(LINES), true))}
  </fieldset>`;
}

/** Remplit le formulaire d'ajustement avec le modèle. */
function writeForm(root, m) {
  const f = name => root.querySelector(`[name="${name}"]`);
  f("partition").value = m.partition;
  f("line").value = m.line ?? "";
  f("color1").value = m.colors[0];
  f("color2").value = m.colors[1] ?? "";
  const c = m.charge;
  f("ctype").value = c?.type ?? "";
  fillChargeNames(root, c?.type);
  if (c) {
    f("cname").value = c.name;
    f("ccolor").value = c.color;
    f("ccount").value = c.count ?? 1;
    f("cattitude").value = c.attitude ?? "";
    f("cline").value = c.line ?? "";
  }
  syncEnabled(root);
}

/** Liste des charges du type choisi. */
function fillChargeNames(root, type) {
  root.querySelector('[name="cname"]').innerHTML = type ? options(CHARGE_LISTS()[type] ?? []) : "";
}

/** N'active que les champs utiles au type de charge et à la partition. */
function syncEnabled(root) {
  const f = name => root.querySelector(`[name="${name}"]`);
  const type = f("ctype").value, plain = f("partition").value === PLAIN;
  f("line").disabled = plain;
  f("color2").disabled = plain;
  for (const n of ["cname", "ccolor"]) f(n).disabled = !type;
  f("ccount").disabled = !["plant", "animal", "object", "subordinary"].includes(type);
  f("cattitude").disabled = type !== "animal";
  f("cline").disabled = type !== "ordinary";
}

/** Lit le formulaire d'ajustement. */
function readForm(root) {
  const v = name => root.querySelector(`[name="${name}"]`).value;
  const plain = v("partition") === PLAIN, type = v("ctype");
  const m = { partition: v("partition"), line: plain ? null : (v("line") || null), colors: [v("color1"), plain ? null : (v("color2") || null)], charge: null };
  // Champ divisé sans seconde couleur : on reprend la première pour garder un dessin cohérent.
  if (!plain && !m.colors[1]) m.colors[1] = m.colors[0];
  if (type) {
    // Clés toujours présentes (null si vides) : l'enregistrement fusionne, une valeur absente resterait.
    m.charge = {
      type, name: v("cname"), color: v("ccolor"), count: Math.min(7, Math.max(1, Number(v("ccount")) || 1)),
      attitude: type === "animal" ? (v("cattitude") || null) : null,
      line: type === "ordinary" ? (v("cline") || null) : null
    };
  }
  return m;
}

/** Aperçu dessiné et avertissements (charge sans dessin, ligne non représentée, règle des couleurs). */
function previewHTML(m, g) {
  const spec = renderSpec(m);
  const notes = [];
  if (!canDraw(spec.charge)) notes.push(game.i18n.format("AFC.Heraldry.NotDrawn", { name: spec.charge.name }));
  if (!canDrawLine(spec)) notes.push(game.i18n.format("AFC.Heraldry.LineNotDrawn", { line: (spec.line ?? spec.charge.line).toLowerCase() }));
  if (m.charge && family(m.charge.color) !== "fur" && family(m.charge.color) === family(m.colors[0])) notes.push(loc("AFC.Heraldry.RuleWarning"));
  if (g?.fur && g.plain && m.partition === PLAIN) notes.push(loc("AFC.Heraldry.FurUnused"));
  return renderArms(spec, { id: "afc-arms-preview" }) + notes.map(n => `<p class="hint">${esc(n)}</p>`).join("");
}

/**
 * Ouvre le générateur. Avec un blason existant (initial), il s'ouvre sur ce blason sans tirage.
 * Renvoie { arms, spec, svg, portrait } : le texte, le blason structuré, l'image SVG et le choix
 * de l'utiliser comme portrait ; rien si la fenêtre est fermée.
 */
export async function runHeraldry({ initial = null } = {}) {
  let g = initial?.partition ? null : await generate();
  let model = g ? fromRoll(g, "tincture") : foundry.utils.deepClone(initial);
  const content = `<div class="afc-test-dialog afc-heraldry">
    <div class="heraldry-top">
      <div data-steps>${stepsHTML(g)}</div>
      <div class="heraldry-preview" data-preview></div>
    </div>
    <label>${loc("AFC.Heraldry.FieldIs")}<select name="fieldIs">${fieldOptions(g)}</select></label>
    ${editHTML()}
    <label>${loc("AFC.House.arms")}<textarea name="arms" rows="2"></textarea></label>
    <label class="checkbox"><input type="checkbox" name="portrait" checked> ${loc("AFC.Heraldry.UseAsPortrait")}</label>
    <p class="hint">${loc("AFC.Heraldry.Hint")}</p>
    <button type="button" class="afc-create" data-reroll><i class="fa-solid fa-dice"></i> ${loc("AFC.Heraldry.Reroll")}</button>
  </div>`;
  return DialogV2.prompt({
    window: { title: loc("AFC.Heraldry.Title") },
    classes: ["afc", "afc-dialog"],
    position: { width: 860 },
    content,
    ok: {
      label: loc("AFC.Heraldry.Apply"),
      callback: (event, button) => {
        const f = button.form.elements;
        return { arms: f.arms.value.trim(), spec: model, svg: renderArms(renderSpec(model)), portrait: f.portrait.checked };
      }
    },
    render: (event, dialog) => {
      const root = dialog.element ?? dialog;
      const fieldIs = root.querySelector('[name="fieldIs"]');
      const arms = root.querySelector('[name="arms"]');
      fieldIs.disabled = !g;
      // Le texte suit le blason ; il reste modifiable juste avant d'appliquer.
      const refresh = () => {
        arms.value = blazon(model);
        root.querySelector("[data-preview]").innerHTML = previewHTML(model, g);
      };
      // Aperçu posé après le rendu (le contenu initial du dialogue est nettoyé du SVG).
      writeForm(root, model);
      refresh();
      fieldIs.addEventListener("change", () => {
        if (!g) return;
        model = fromRoll(g, fieldIs.value);
        writeForm(root, model);
        refresh();
      });
      root.querySelector(".heraldry-edit").addEventListener("change", event => {
        if (event.target.name === "ctype") {
          fillChargeNames(root, event.target.value);
          // Nouveau type : nombre par défaut (6 pièces pour un rebattement, sinon 1).
          root.querySelector('[name="ccount"]').value = event.target.value === "subordinary" ? 6 : 1;
          if (event.target.value && !root.querySelector('[name="ccolor"]').value) root.querySelector('[name="ccolor"]').value = "Or";
        }
        syncEnabled(root);
        model = readForm(root);
        refresh();
      });
      root.querySelector("[data-reroll]").addEventListener("click", async () => {
        g = await generate();
        root.querySelector("[data-steps]").innerHTML = stepsHTML(g);
        const keep = fieldIs.value || "tincture";
        fieldIs.innerHTML = fieldOptions(g);
        fieldIs.value = keep;
        fieldIs.disabled = false;
        model = fromRoll(g, keep);
        writeForm(root, model);
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
