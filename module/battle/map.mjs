/**
 * Bataille sur la carte : menu d'ordres dans le HUD des jetons de troupe (clic droit) et ordre
 * affiché au-dessus du jeton (le sien tout de suite, celui des autres après la révélation).
 */
import { ORDERS } from "./battle-config.mjs";
import { rallyTroop } from "./engagement.mjs";
import { canOrder, getBattle, groupOfToken, planOf, setPlan, setTokenOrder } from "./state.mjs";

const loc = key => game.i18n.localize(key);
const fmt = (key, data) => game.i18n.format(key, data);
/** Ordres qui visent une troupe adverse. */
const TARGETED_ORDERS = ["charge", "attack", "shoot"];

/** Troupe ciblée par l'utilisateur (touche T), autre que le jeton lui-même. */
function targetedTroop(tokenDoc) {
  const t = [...game.user.targets].map(t => t.document).find(t => t.actor?.type === "troop" && t.id !== tokenDoc.id);
  return t ?? null;
}
const ORDER_ICONS = {
  charge: "fa-horse-head", attack: "fa-hand-fist", hold: "fa-shield-halved",
  shoot: "fa-bullseye", maneuver: "fa-arrows-up-down-left-right", withdraw: "fa-person-walking-arrow-loop-left"
};

/** Peut-on donner un ordre à ce jeton (groupe à soi, ou troupe à soi sans groupe) ? */
function canOrderToken(tokenDoc, battle) {
  const group = groupOfToken(battle, tokenDoc.id);
  return group ? canOrder(group) : tokenDoc.actor?.isOwner;
}

/** Boutons du HUD des troupes : ordres, ralliement, fenêtre Bataille. */
export function onRenderTokenHUD(hud, html) {
  const tokenDoc = hud.document;
  if (tokenDoc.actor?.type !== "troop") return;
  const battle = getBattle();
  const group = groupOfToken(battle, tokenDoc.id);
  const col = html.querySelector(".col.left");
  if (!col) return;
  const button = (icon, tooltip, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "control-icon afc-hud";
    b.dataset.tooltip = tooltip;
    b.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    b.addEventListener("click", onClick);
    col.append(b);
    return b;
  };

  if (canOrderToken(tokenDoc, battle) && !(battle.revealed && group?.countered)) {
    const palette = document.createElement("div");
    palette.className = "afc-order-palette";
    for (const order of ORDERS) {
      const o = document.createElement("button");
      o.type = "button";
      o.className = `control-icon${group?.order === order ? " active" : ""}`;
      o.dataset.tooltip = loc(`AFC.Battle.Order.${order}`);
      o.innerHTML = `<i class="fa-solid ${ORDER_ICONS[order]}"></i>`;
      o.addEventListener("click", async () => {
        await setTokenOrder(tokenDoc.id, order);
        // Ordre offensif : la troupe ciblée (touche T), s'il y en a une, devient la cible désignée.
        const target = targetedTroop(tokenDoc);
        if (TARGETED_ORDERS.includes(order) && target && !battle.revealed) await setPlan(tokenDoc.id, target.id);
        ui.notifications.info(`${tokenDoc.name} : ${loc(`AFC.Battle.Order.${order}`)}${target && TARGETED_ORDERS.includes(order) ? ` → ${target.name}` : ""}`);
        hud.close();
      });
      palette.append(o);
    }
    const b = button("fa-flag", battle.revealed ? loc("AFC.Battle.Counter") : loc("AFC.Battle.GiveOrder"), () => palette.classList.toggle("open"));
    b.append(palette);
  }
  // Cible désignée : la troupe actuellement ciblée (touche T) ; sans cible, efface la désignation.
  if ((canOrderToken(tokenDoc, battle) && !battle.revealed) || game.user.isGM) {
    const current = planOf(battle, tokenDoc.id);
    button("fa-crosshairs", current ? loc("AFC.Battle.PlanChange") : loc("AFC.Battle.PlanSet"), async () => {
      const target = targetedTroop(tokenDoc);
      await setPlan(tokenDoc.id, target?.id ?? null);
      ui.notifications.info(target ? fmt("AFC.Battle.PlanSetDone", { a: tokenDoc.name, d: target.name }) : fmt("AFC.Battle.PlanCleared", { a: tokenDoc.name }));
      hud.close();
    });
  }
  if (tokenDoc.actor.isOwner && tokenDoc.actor.system.state !== "fresh") button("fa-flag-checkered", loc("AFC.Battle.Rally"), () => rallyTroop(tokenDoc.id));
  button("fa-chess-rook", loc("AFC.Battle.Title"), () => game.afc.openBattle());
}

/* ---------- Ordre affiché au-dessus du jeton ---------- */

/** Dessine (ou retire) la pastille d'ordre d'un jeton de troupe. */
export function drawOrderBadge(token) {
  token.children.filter(c => c.name === "afcOrder").forEach(c => c.destroy());
  const doc = token.document;
  if (doc.actor?.type !== "troop" || !doc.parent) return;
  const battle = getBattle(doc.parent);
  const group = groupOfToken(battle, doc.id);
  if (!group?.order) return;
  // Le sien : tout de suite ; celui des autres : seulement après la révélation.
  if (!battle.revealed && !canOrder(group)) return;
  const text = new foundry.canvas.containers.PreciseText(loc(`AFC.Battle.Order.${group.order}`), Object.assign(CONFIG.canvasTextStyle.clone(), {
    fontSize: 13, fill: "#f3ead6", stroke: "#2b2118", strokeThickness: 3
  }));
  text.anchor.set(0.5, 1);
  const badge = new PIXI.Container();
  badge.name = "afcOrder";
  const bg = new PIXI.Graphics();
  const w = text.width + 14, h = text.height + 4;
  bg.beginFill(battle.revealed ? 0x8e1b1b : 0x2b2118, 0.85).drawRoundedRect(-w / 2, -h, w, h, 6).endFill();
  badge.addChild(bg, text);
  // Dans la bande vide du bas du jeton (le symbole occupe le milieu) : pas de chevauchement entre voisins.
  badge.position.set(token.w / 2, token.h - 2);
  token.addChild(badge);
}

/** Redessine les pastilles de toutes les troupes de la scène. */
export function refreshOrderBadges() {
  if (!canvas.ready) return;
  for (const token of canvas.tokens.placeables) if (token.document.actor?.type === "troop") drawOrderBadge(token);
}

/* ---------- Flèches des cibles désignées ---------- */

/** Centre d'un jeton d'après son document (juste, même pendant une animation de déplacement). */
const docCenter = doc => ({ x: doc.x + (doc.width * canvas.grid.sizeX) / 2, y: doc.y + (doc.height * canvas.grid.sizeY) / 2 });
/** Style des flèches selon l'ordre : charge épaisse, attaque pleine, tir en pointillés. */
const ARROWS = { charge: { width: 7 }, attack: { width: 4 }, shoot: { width: 3, dash: [14, 10] } };

/**
 * Dessine les flèches « troupe → cible ». Visibles par qui peut donner l'ordre (et le MJ) avant la
 * révélation, par tous après ; jamais vers ou depuis un jeton caché pour un joueur.
 */
export function drawPlanArrows() {
  if (!canvas.ready) return;
  canvas.tokens.children.filter(c => c.name === "afcPlans").forEach(c => c.destroy({ children: true }));
  const battle = getBattle();
  if (!battle.plans.length) return;
  const layer = new PIXI.Container();
  layer.name = "afcPlans";
  for (const plan of battle.plans) {
    const from = canvas.scene.tokens.get(plan.from), to = canvas.scene.tokens.get(plan.to);
    if (!from?.actor || !to) continue;
    const group = groupOfToken(battle, plan.from);
    const mine = group ? canOrder(group) : from.actor.isOwner;
    if (!battle.revealed && !mine) continue;
    if (!game.user.isGM && (from.hidden || to.hidden)) continue;
    const style = ARROWS[group?.order] ?? { width: 3, dash: [6, 8] };
    const color = from.actor.system.side === "company" ? 0x4f8fc8 : 0xd04a3f;
    const a = docCenter(from), b = docCenter(to);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    // On part près du centre du jeton et on s'arrête au bord de la cible : visible même entre voisins.
    const r0 = canvas.grid.sizeX * 0.15, r1 = canvas.grid.sizeX * 0.38;
    const start = { x: a.x + ux * r0, y: a.y + uy * r0 };
    const end = { x: b.x - ux * r1, y: b.y - uy * r1 };
    const g = new PIXI.Graphics();
    g.lineStyle({ width: style.width + 4, color: 0x1b140d, alpha: 0.55 });
    segment(g, start, end, style.dash);
    g.lineStyle({ width: style.width, color, alpha: 0.95 });
    segment(g, start, end, style.dash);
    // Pointe de flèche.
    const head = 12 + style.width * 2, nx = -uy, ny = ux;
    g.lineStyle(0);
    g.beginFill(color, 0.95).drawPolygon([
      end.x + ux * 4, end.y + uy * 4,
      end.x - ux * head + nx * head * 0.6, end.y - uy * head + ny * head * 0.6,
      end.x - ux * head - nx * head * 0.6, end.y - uy * head - ny * head * 0.6
    ]).endFill();
    layer.addChild(g);
  }
  // Au-dessus des jetons (semi-transparentes) pour rester lisibles entre cases voisines.
  layer.alpha = 0.85;
  canvas.tokens.addChild(layer);
}

/** Trait plein ou en pointillés. */
function segment(g, a, b, dash) {
  if (!dash) return g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  const len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  for (let d = 0, on = true, i = 0; d < len; i++, on = !on) {
    const step = Math.min(dash[i % 2], len - d);
    if (on) g.moveTo(a.x + ux * d, a.y + uy * d).lineTo(a.x + ux * (d + step), a.y + uy * (d + step));
    d += step;
  }
}
