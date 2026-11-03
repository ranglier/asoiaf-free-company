// Éditions du livret (build.sh) : livret entier, un chapitre seul ou une aide de jeu. Dans une édition partielle,
// le sommaire perd les entrées dont la cible est absente (et le chapitre « à venir »), les renvois vers une partie
// absente deviennent du texte simple, la couverture porte le nom du chapitre et les aides de jeu changent de surtitre.
(() => {
  const { edition = "global", label = "" } = document.body.dataset;
  if (edition === "global") return;
  const present = a => !!document.getElementById(a.getAttribute("href").slice(1));
  for (const li of document.querySelectorAll(".sommaire li")) {
    const a = li.querySelector("a[href^='#']");
    if (a ? !present(a) : li.classList.contains("plus-tard")) li.remove();
  }
  for (const a of document.querySelectorAll("a[href^='#']")) if (!present(a)) a.replaceWith(...a.childNodes);
  const titre = document.querySelector(".couverture .titre-couv");
  if (titre && label) {
    const p = document.createElement("p");
    p.className = "edition";
    p.textContent = label;
    titre.after(p);
  }
  if (!titre) for (const p of document.querySelectorAll("header.chapitre .surtitre")) p.textContent = "ASOIAF Free Company : aide de jeu";
})();
