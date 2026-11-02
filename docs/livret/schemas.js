// Schémas en hexagones du livret : cases en pointe vers le haut, lignes impaires décalées d'une demi-case vers la droite
// (comme la grille de Foundry). Les couleurs viennent de la feuille de style (classes hex-*, unit-*, fleche, feu).
// Case (i, j) = ligne i, colonne j. Voisines d'une case de ligne paire : (i, j±1), (i±1, j-1), (i±1, j) ;
// de ligne impaire : (i, j±1), (i±1, j), (i±1, j+1).
(() => {
  const R = 21, W = Math.sqrt(3) * R, H = 1.5 * R, PAD = 14;
  const center = (i, j, ox = 0, oy = 0) => [ox + PAD + W / 2 + W * (j + (i % 2) * 0.5), oy + PAD + R + H * i];
  const hex = (i, j, ox, oy) => {
    const [x, y] = center(i, j, ox, oy);
    return Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 180 * (60 * k - 30); return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`; }).join(" ");
  };
  const flame = (x, y) => `<path class="feu" d="M${x},${y} c-4,-3 -4,-8 0,-13 c1,4 3,4 3,1 c3,4 3,9 -3,12 z"/>`;

  /** Une carte : rows × cols, terrains { "i,j": type }, voiles (cases non vues), feux, troupes, flèches, étiquettes. */
  function map(id, { rows, cols, terrain = {}, marks = [], veil = [], fires = [], units = [], arrows = [], tags = [], ox = 0, oy = 0 }) {
    let out = "";
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) out += `<polygon class="hex hex-${terrain[`${i},${j}`] ?? "plaine"}" points="${hex(i, j, ox, oy)}"/>`;
    for (const m of marks) {
      const [x, y] = center(m.i, m.j, ox, oy);
      out += `<polygon class="hex hex-${m.kind}" points="${hex(m.i, m.j, ox, oy)}"/>`;
      if (m.text) out += `<text class="note-case" x="${x}" y="${y + R + 9}" text-anchor="middle">${m.text}</text>`;
    }
    for (const [i, j] of fires) { const [x, y] = center(i, j, ox, oy); out += flame(x - 9, y + 13); }
    for (const [i, j] of veil) out += `<polygon class="hex-voile" points="${hex(i, j, ox, oy)}"/>`;
    for (const a of arrows) {
      const [x1, y1] = center(a.from[0], a.from[1], ox, oy), [x2, y2] = center(a.to[0], a.to[1], ox, oy);
      const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const start = a.start ?? R * 0.7, stop = a.stop ?? R * 0.85;
      out += `<line class="fleche ${a.kind ?? ""}" x1="${(x1 + ux * start).toFixed(1)}" y1="${(y1 + uy * start).toFixed(1)}" x2="${(x2 - ux * stop).toFixed(1)}" y2="${(y2 - uy * stop).toFixed(1)}" marker-end="url(#${id}-pointe)"/>`;
      if (a.label) {
        const mx = (x1 + x2) / 2 + (a.dx ?? 0), my = (y1 + y2) / 2 + (a.dy ?? -6);
        out += `<text class="etiquette" x="${mx.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="${a.anchor ?? "middle"}">${a.label}</text>`;
      }
      if (a.blocked) {
        const [bx, by] = center(a.blocked[0], a.blocked[1], ox, oy);
        out += `<path class="bloque" d="M${bx - 6},${by - 6} L${bx + 6},${by + 6} M${bx + 6},${by - 6} L${bx - 6},${by + 6}"/>`;
      }
    }
    for (const u of units) {
      const [x, y] = center(u.i, u.j, ox, oy);
      const op = u.hidden ? ` opacity=".45"` : "";
      out += `<g${op}><circle class="unit unit-${u.side}" cx="${x}" cy="${y}" r="${R * 0.62}"/><text class="unit-lettre unit-lettre-${u.side}" x="${x}" y="${y + 4.5}" text-anchor="middle">${u.label}</text></g>`;
    }
    for (const g of tags) {
      const [x, y] = center(g.i, g.j, ox, oy);
      out += `<text class="etiquette ${g.kind ?? ""}" x="${x + (g.dx ?? 0)}" y="${y + (g.dy ?? 0)}" text-anchor="${g.anchor ?? "middle"}">${g.text}</text>`;
    }
    return out;
  }

  /** Dessine une ou plusieurs cartes dans le SVG id, plus des notes en coordonnées absolues. */
  function draw(id, opts) {
    const svg = document.getElementById(id);
    if (!svg) return;
    let out = `<defs><marker id="${id}-pointe" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="pointe"/></marker></defs>`;
    for (const p of opts.panels ?? [opts]) out += map(id, p);
    for (const n of opts.notes ?? []) out += `<text class="note ${n.kind ?? ""}" x="${n.x}" y="${n.y}" text-anchor="${n.anchor ?? "start"}">${n.text}</text>`;
    svg.innerHTML = out;
  }

  const t = (cells, type) => Object.fromEntries(cells.map(c => [c, type]));
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
  const row = (i, js) => js.map(j => [i, j]);

  // Couverture : un petit champ de bataille.
  draw("couverture-hex", {
    rows: 4, cols: 9,
    terrain: { ...t(["0,1", "0,2", "1,1"], "colline"), ...t(["0,6", "0,7", "1,7", "0,8"], "bois"), ...t(["2,4", "3,4"], "village"), ...t(["3,0", "3,1", "3,2"], "eau") },
    units: [{ i: 1, j: 2, side: "compagnie", label: "" }, { i: 2, j: 3, side: "compagnie", label: "" }, { i: 2, j: 5, side: "ennemi", label: "" }, { i: 1, j: 6, side: "ennemi", label: "" }],
    arrows: [{ from: [1, 2], to: [2, 5], kind: "coupee" }, { from: [1, 6], to: [2, 3], stop: R * 2.4 }]
  });


  // Lettres : Compagnie A, B, C… (bleu) ; ennemis X, Y, Z, W (rouge).

  // 2.4 La vue : colline.
  draw("schema-colline", {
    rows: 5, cols: 9,
    terrain: t(["1,4", "2,4", "2,5", "3,4"], "colline"),
    units: [{ i: 2, j: 1, side: "compagnie", label: "A" }, { i: 1, j: 4, side: "compagnie", label: "B" }, { i: 2, j: 7, side: "ennemi", label: "X" }],
    arrows: [
      { from: [2, 1], to: [2, 7], kind: "coupee", blocked: [2, 4], stop: R * 0.9 },
      { from: [1, 4], to: [2, 1], start: R * 0.75 },
      { from: [1, 4], to: [2, 7], start: R * 0.75 }
    ],
    notes: [{ x: 194, y: 12, text: "colline", anchor: "middle" }]
  });

  // 2.4 La vue : bois, trois positions.
  const wood = t(range(3, 8).map(j => `0,${j}`), "bois");
  draw("schema-bois", {
    panels: [
      { rows: 1, cols: 10, oy: 12, terrain: wood, units: [{ i: 0, j: 0, side: "compagnie", label: "A" }], veil: row(0, range(4, 9)) },
      { rows: 1, cols: 10, oy: 96, terrain: wood, units: [{ i: 0, j: 3, side: "compagnie", label: "B" }], veil: row(0, range(6, 9)) },
      { rows: 1, cols: 10, oy: 180, terrain: wood, units: [{ i: 0, j: 6, side: "compagnie", label: "C" }], veil: row(0, range(0, 3)) }
    ],
    notes: [
      { x: 14, y: 20, text: "A, dehors : seule la lisière.", kind: "titre" },
      { x: 14, y: 104, text: "B, en lisière : 2 cases dedans, dehors sans limite.", kind: "titre" },
      { x: 14, y: 188, text: "C, au fond : 2 cases dedans, 1 case dehors.", kind: "titre" }
    ]
  });

  // 2.4 La nuit : un camp éclairé.
  const nightSeen = new Set(["3,2", "3,1", "3,3", "2,2", "2,3", "4,2", "4,3", "1,6", "1,7", "2,6", "2,7", "3,5"]);
  const nightVeil = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) if (!nightSeen.has(`${i},${j}`)) nightVeil.push([i, j]);
  draw("schema-nuit", {
    rows: 6, cols: 10,
    terrain: t(["1,6", "1,7", "2,6", "2,7"], "village"),
    fires: [[1, 6], [1, 7], [2, 6], [2, 7]],
    veil: nightVeil,
    units: [
      { i: 3, j: 2, side: "compagnie", label: "A" },
      { i: 3, j: 3, side: "ennemi", label: "X" },
      { i: 2, j: 7, side: "ennemi", label: "Y" },
      { i: 3, j: 5, side: "ennemi", label: "Z" },
      { i: 4, j: 7, side: "ennemi", label: "W", hidden: true }
    ],
    tags: [
      { i: 3, j: 5, text: "a tiré ce tour", dy: 32 },
      { i: 1, j: 7, text: "camp éclairé", dy: -26 }
    ]
  });

  // 2.5 L'embuscade en lisière.
  draw("schema-lisiere", {
    rows: 6, cols: 10,
    terrain: { ...t([...range(2, 8).map(j => `0,${j}`), ...range(2, 8).map(j => `1,${j}`)], "bois"), ...t(range(0, 9).map(j => `4,${j}`), "route") },
    units: [
      { i: 1, j: 5, side: "ennemi", label: "X" },
      { i: 1, j: 7, side: "ennemi", label: "Y" },
      { i: 4, j: 3, side: "compagnie", label: "A" },
      { i: 4, j: 5, side: "compagnie", label: "B" },
      { i: 4, j: 7, side: "compagnie", label: "C" }
    ],
    arrows: [{ from: [1, 5], to: [4, 5], label: "Charge : +1B", dx: 34, dy: 0, anchor: "start" }]
  });

  // 2.6 Le contact : repli et relève.
  draw("schema-releve", {
    rows: 5, cols: 8,
    units: [
      { i: 2, j: 4, side: "ennemi", label: "X" },
      { i: 2, j: 3, side: "compagnie", label: "A" },
      { i: 1, j: 2, side: "compagnie", label: "R" }
    ],
    arrows: [
      { from: [2, 3], to: [2, 2], kind: "fin", start: R * 0.65, stop: R * 0.55 },
      { from: [1, 2], to: [2, 3], kind: "fin", start: R * 0.65, stop: R * 0.7 }
    ],
    tags: [{ i: 2, j: 2, text: "repli", dy: 32 }, { i: 1, j: 2, text: "relève", dy: -25 }],
  });

  // 2.7 Le tir depuis la crête (bataille d'Herberouge).
  draw("schema-tir", {
    rows: 6, cols: 10,
    terrain: { ...t(["0,1", "0,2", "1,1", "1,2", "2,1"], "colline"), ...t(["0,6", "1,5", "1,6"], "colline"), ...t(["4,8", "4,9", "5,8"], "bois") },
    units: [{ i: 1, j: 2, side: "compagnie", label: "A" }, { i: 3, j: 4, side: "ennemi", label: "X" }, { i: 1, j: 7, side: "ennemi", label: "Y" }],
    arrows: [
      { from: [1, 2], to: [3, 4], label: "+1B, colline", dx: 30, dy: -2 },
      { from: [1, 2], to: [1, 7], kind: "coupee", blocked: [1, 6], stop: R * 0.9 }
    ],
    marks: [{ i: 1, j: 7, kind: "angle-mort", text: "angle mort" }],
    notes: [{ x: 60, y: 12, text: "Crête-en-Pleurs", anchor: "middle" }, { x: 300, y: 12, text: "autre colline", anchor: "middle" }]
  });

  // 2.7 La mêlée et le flanc : le Trident. X tient la rive à la sortie du gué ; A s'y engage, B a passé la rivière.
  draw("schema-melee", {
    rows: 5, cols: 7,
    terrain: { ...t(range(0, 6).map(j => `3,${j}`), "eau"), "3,2": "gue" },
    units: [
      { i: 2, j: 3, side: "ennemi", label: "X" },
      { i: 3, j: 2, side: "compagnie", label: "A" },
      { i: 2, j: 4, side: "compagnie", label: "B" }
    ],
    tags: [
      { i: 3, j: 2, text: "+1B, −1D", dx: -20, dy: 4, anchor: "end" },
      { i: 2, j: 4, text: "+1B", dx: 20, dy: 4, anchor: "start" },
      { i: 2, j: 3, text: "+1B", dx: 0, dy: -24 },
      { i: 3, j: 2, text: "gué des Rubis", dy: 34 },
      { i: 3, j: 5, text: "Trident", dy: 4, kind: "note-case" }
    ]
  });

  // 2.11 Un tour commenté : les ordres du tour 1.
  draw("schema-tour", {
    rows: 6, cols: 10,
    terrain: { ...t(["0,4", "1,4"], "village"), ...t(["4,2", "4,3", "5,2", "5,3"], "colline"), ...t(["0,9", "1,9"], "bois") },
    units: [
      { i: 1, j: 4, side: "compagnie", label: "A" },
      { i: 4, j: 3, side: "compagnie", label: "B" },
      { i: 2, j: 1, side: "compagnie", label: "C" },
      { i: 1, j: 6, side: "ennemi", label: "X" },
      { i: 4, j: 7, side: "ennemi", label: "Y" }
    ],
    arrows: [
      { from: [1, 6], to: [1, 5], label: "Charger A", dx: 0, dy: -26 },
      { from: [4, 3], to: [1, 6], kind: "coupee", label: "Tirer X", dx: 30, dy: 14 },
      { from: [4, 7], to: [4, 3], kind: "coupee", label: "Tirer B", dy: -8 },
      { from: [2, 1], to: [2, 6], label: "Manœuvrer", dy: -7, stop: R * 0.4 }
    ],
    tags: [{ i: 1, j: 4, text: "Tenir", dy: -25 }]
  });
})();
