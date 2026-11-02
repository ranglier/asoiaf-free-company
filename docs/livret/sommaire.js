// Numéros de page du sommaire et de l'index des tables : pages.js (écrit par pages.ps1 depuis les signets du PDF)
// associe le titre de chaque section (h1) ou table (h5) à sa page ; on retrouve le titre par l'identifiant visé par le
// lien. Edge peut coller les mots
// d'un titre coupé en fin de ligne : on compare sans espaces ni casse.
(() => {
  const norm = s => s.replace(/\s+/g, "").toLowerCase();
  const pages = Object.entries(window.PAGES ?? {}).map(([title, page]) => [norm(title), page]);
  for (const span of document.querySelectorAll(".sommaire .p[data-for]")) {
    const heading = document.getElementById(span.dataset.for)?.querySelector("h1, h5");
    if (!heading) continue;
    const key = norm(heading.textContent);
    const hit = pages.find(([t]) => t === key) ?? pages.find(([t]) => t.includes(key));
    span.textContent = hit?.[1] ?? "";
  }
})();
