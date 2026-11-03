// Éditions du livret (build.sh) : livret entier, un chapitre seul ou une aide de jeu. Dans une édition partielle,
// le sommaire perd les entrées dont la cible est absente (et le chapitre « à venir »), les renvois vers une partie
// absente deviennent du texte simple, les sections qui suivent une section retirée sont renumérotées, la couverture
// porte le nom du chapitre et les aides de jeu changent de surtitre.
(() => {
  const { edition = "global", label = "" } = document.body.dataset;
  if (edition === "global") return;
  const present = a => !!document.getElementById(a.getAttribute("href").slice(1));
  for (const li of document.querySelectorAll(".sommaire li")) {
    const a = li.querySelector("a[href^='#']");
    if (a ? !present(a) : li.classList.contains("plus-tard")) li.remove();
  }
  for (const a of document.querySelectorAll("a[href^='#']")) if (!present(a)) a.replaceWith(...a.childNodes);
  // Une section retirée (2.10 Mener une bataille, dans le chapitre Batailles) : les suivantes sont renumérotées,
  // dans les titres, le sommaire et les renvois.
  const renum = new Map(), count = {};
  for (const span of document.querySelectorAll("header.chapitre h1 .num")) {
    const m = span.textContent.trim().match(/^(\d+)\.(\d+)$/);
    if (!m) continue;
    count[m[1]] = (count[m[1]] ?? 0) + 1;
    const now = `${m[1]}.${count[m[1]]}`;
    if (now !== m[0]) { renum.set(m[0], now); span.textContent = now; }
  }
  if (renum.size) for (const el of document.querySelectorAll(".sommaire li > a > span:first-child, a[href^='#s']")) {
    const now = renum.get(el.textContent.trim());
    if (now) el.textContent = now;
  }
  const titre = document.querySelector(".couverture .titre-couv");
  if (titre && label) {
    const p = document.createElement("p");
    p.className = "edition";
    p.textContent = label;
    titre.after(p);
  }
  if (!titre) for (const p of document.querySelectorAll("header.chapitre .surtitre")) p.textContent = "ASOIAF Free Company : aide de jeu";
})();
