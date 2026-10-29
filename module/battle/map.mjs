/**
 * Bataille sur la carte : menu d'ordres dans le HUD des jetons de troupe (clic droit) et ordre
 * affiché au-dessus du jeton (le sien tout de suite, celui des autres après la révélation).
 */
import { ORDERS } from "./battle-config.mjs";
import { rallyTroop } from "./engagement.mjs";
import { canOrder, getBattle, groupOfToken, setTokenOrder } from "./state.mjs";

const loc = key => game.i18n.localize(key);
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
        ui.notifications.info(`${tokenDoc.name} : ${loc(`AFC.Battle.Order.${order}`)}`);
        hud.close();
      });
      palette.append(o);
    }
    const b = button("fa-flag", battle.revealed ? loc("AFC.Battle.Counter") : loc("AFC.Battle.GiveOrder"), () => palette.classList.toggle("open"));
    b.append(palette);
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
