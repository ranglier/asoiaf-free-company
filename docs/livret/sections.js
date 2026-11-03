// Mise en page des sections : chaque section (d'un en-tête .chapitre au suivant) est regroupée dans un bloc.
// Une section qui tient sur une page est insécable : elle suit la précédente s'il reste la place, sinon elle
// passe entière à la page suivante. Une section plus longue qu'une page ouvre toujours une page, comme le
// chapitre. La hauteur se mesure à l'écran, à la largeur de la page imprimée (livret.css, @media screen).
// Un schéma et l'encadré d'exemple qui le suit (dans un sens ou dans l'autre) forment un bloc insécable : ils restent
// sur la même page, quitte à passer ensemble à la suivante.
// Un en-tête marqué .page (sommaire, fiche, aides-mémoire, index) ouvre toujours une page.
(() => {
  const mm = px => px * 25.4 / 96;
  const PAGE = 297 - 17 - 18; // hauteur utile d'une page (marges de @page), en mm
  for (const fig of document.querySelectorAll("figure.schema")) {
    const ex = [fig.nextElementSibling, fig.previousElementSibling].find(e => e?.matches("aside.exemple") && !e.closest(".paire"));
    if (!ex) continue;
    const pair = document.createElement("div");
    pair.className = "paire";
    fig.before(pair);
    pair.append(...(ex === fig.nextElementSibling ? [fig, ex] : [ex, fig]));
  }
  const groups = [];
  for (const el of [...document.body.children]) {
    if (el.tagName === "SCRIPT") continue;
    const opensSection = el.matches("header.chapitre") && !el.previousElementSibling?.matches(".ouverture-chap");
    if (opensSection || !groups.length) groups.push([]);
    groups.at(-1).push(el);
  }
  for (const els of groups) {
    if (!els[0].matches("header.chapitre")) continue; // la couverture
    const box = document.createElement("div");
    box.className = "section";
    els[0].before(box);
    box.append(...els);
    const height = mm(box.getBoundingClientRect().height);
    box.dataset.mm = Math.round(height);
    const long = height > PAGE * 0.96;
    box.classList.add(long || els[0].matches(".ouverture-chap, .page") ? "nouvelle-page" : "courte");
  }
})();
