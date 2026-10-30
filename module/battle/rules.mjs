/**
 * Quelles règles pour la bataille de cette scène : « house » (règles maison) ou « book » (livre).
 * Le choix est porté par la scène ; une scène sans choix prend le réglage du monde.
 * Les deux jeux de règles gardent leurs données à part sur la troupe : basculer ne perd rien.
 */
import { SYSTEM_ID } from "../config.mjs";

export const RULES = ["house", "book"];

export function battleRules(scene = canvas?.scene) {
  return scene?.getFlag(SYSTEM_ID, "battle")?.rules ?? game.settings.get(SYSTEM_ID, "battleRules");
}
export const isBook = (scene = canvas?.scene) => battleRules(scene) === "book";
