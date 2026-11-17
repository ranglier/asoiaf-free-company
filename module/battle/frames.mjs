/**
 * Cadres de jeton pris dans Tokenizer 2 (décision du 2026-11-17, à l'essai) : les cadres livrés avec le module et ceux
 * que le MJ fabrique avec son générateur d'anneaux. Le système ne fait que les lister et les poser autour du disque ;
 * sans Tokenizer, nos propres anneaux servent.
 */
const ROOTS = ["modules/tokenizer-2/img", "tokenizer/frames"];
const SKIP = /\/(textures|masks|conditions|ornaments)\/|mask|texture|inner-shadow|shadow\.png$/i;
const loc = key => game.i18n.localize(key);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

/** Tokenizer 2 est-il actif ? */
export const framesAvailable = () => !!game.modules.get("tokenizer-2")?.active;

let cache = null;
/** Tous les cadres, rangés par dossier ({ group, files }). Il faut le droit de parcourir les fichiers. */
export async function listFrames() {
  if (cache) return cache;
  const FP = foundry.applications.apps.FilePicker.implementation;
  const groups = new Map();
  const walk = async dir => {
    let r;
    try { r = await FP.browse("data", dir); } catch (err) { return; }
    const files = r.files.filter(f => /\.(png|webp)$/i.test(f) && !SKIP.test(f));
    if (files.length) groups.set(dir, files);
    for (const d of r.dirs) await walk(d);
  };
  for (const root of ROOTS) await walk(root);
  cache = [...groups].map(([dir, files]) => ({ group: groupLabel(dir), files }));
  return cache;
}

/** Nom lisible d'un dossier de cadres. */
function groupLabel(dir) {
  if (dir.startsWith("tokenizer/frames")) return loc("AFC.Battle.Ring.FramesWorld");
  const rest = dir.replace("modules/tokenizer-2/img", "").replace(/^\//, "");
  return rest ? `Tokenizer 2 · ${rest.replace(/\//g, " · ")}` : "Tokenizer 2";
}

/** Galerie : un clic choisit le cadre. Renvoie son chemin, ou null. */
export async function pickFrame(current = "", pictogram = "") {
  if (!game.user.can("FILES_BROWSE")) { ui.notifications.warn(loc("AFC.Battle.NoBrowse")); return null; }
  const groups = await listFrames();
  if (!groups.length) { ui.notifications.info(loc("AFC.Battle.Ring.NoFrames")); return null; }
  const cell = f => `<button type="button" class="frame-cell ${f === current ? "active" : ""}" data-frame="${esc(f)}" aria-label="${esc(f.split("/").pop())}">
      ${pictogram ? `<img class="picto" src="${esc(pictogram)}" alt="">` : ""}<img class="frame" src="${esc(f)}" alt="" loading="lazy"></button>`;
  const content = `<div class="afc-frame-gallery">${groups.map(g => `<h3>${esc(g.group)} <small>(${g.files.length})</small></h3><div class="frame-grid">${g.files.map(cell).join("")}</div>`).join("")}</div>`;
  return new Promise(resolve => {
    let picked = null;
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: loc("AFC.Battle.Ring.PickFrame"), resizable: true },
      classes: ["afc", "afc-dialog"],
      position: { width: 760, height: 640 },
      content,
      buttons: [{ action: "cancel", label: loc("Cancel"), default: true }],
      submit: () => resolve(picked)
    });
    dialog.addEventListener("close", () => resolve(picked));
    dialog.render({ force: true }).then(() => {
      dialog.element.querySelector(".afc-frame-gallery")?.addEventListener("click", event => {
        const b = event.target.closest("[data-frame]");
        if (!b) return;
        picked = b.dataset.frame;
        dialog.close();
      });
    });
  });
}
