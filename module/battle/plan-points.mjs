/**
 * Points de plan (règles maison, décision de Jules du 2026-11-02) : une seule réserve pour la Compagnie,
 * gagnée avant la bataille (test de Stratégie, 1 point par degré, sans plafond) et dépensée avant ou
 * pendant la bataille. Le MJ ajuste la réserve ; le MJ et les joueurs la dépensent, et chaque dépense
 * laisse une ligne dans le chat. Nouvelle bataille la remet à zéro. L'ennemi n'a pas de points.
 */
import { getBattle, gmHandlers, requestGM, saveBattle, sceneOf, tellUser } from "./state.mjs";

const fmt = (key, data) => game.i18n.format(key, data);
const loc = key => game.i18n.localize(key);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

/** Usages d'un point de plan (section 4 des règles de bataille). */
export const PLAN_USES = ["asPlanned", "signal", "reserve", "terrain", "ambush", "field"];

/** Points de plan de la bataille. */
export const planPoints = battle => Math.max(0, Number(battle.planPoints) || 0);

/** Ajoute (delta > 0, MJ) ou retire un point ; avec un usage, c'est une dépense annoncée dans le chat. */
export function changePlan(delta, use = null, scene = canvas.scene) {
  const data = { scene: scene?.id, delta, use };
  // Un MJ écrit lui-même ; un joueur passe par le MJ actif.
  return game.user.isGM ? gmHandlers.planPoints({ ...data, user: game.user.id }) : requestGM("planPoints", data);
}

gmHandlers.planPoints = async data => {
  const scene = sceneOf(data);
  const user = game.users.get(data.user);
  if (!scene || !user || (data.delta > 0 && !user.isGM)) return;
  const battle = getBattle(scene);
  const before = planPoints(battle);
  if (data.delta < 0 && !before) return tellUser(data.user, "AFC.Battle.Plan.Empty");
  battle.planPoints = Math.max(0, before + data.delta);
  await saveBattle(battle, scene);
  if (data.delta < 0 && PLAN_USES.includes(data.use)) {
    const text = fmt("AFC.Battle.Plan.Spent", { user: user.name, use: loc(`AFC.Battle.Plan.Use.${data.use}`), n: battle.planPoints });
    await ChatMessage.create({ speaker: { alias: user.name }, content: `<div class="afc-card battle"><p><i class="fa-solid fa-scroll"></i> ${esc(text)}</p></div>` });
  }
};
