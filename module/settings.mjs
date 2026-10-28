import { DIFFICULTIES, SYSTEM_ID } from "./config.mjs";

/** Réglages du monde. */
export function registerSettings() {
  game.settings.register(SYSTEM_ID, "defaultDifficulty", {
    name: "AFC.Settings.defaultDifficulty.name",
    hint: "AFC.Settings.defaultDifficulty.hint",
    scope: "world",
    config: true,
    type: String,
    choices: { none: "AFC.Roll.NoDifficulty", ...DIFFICULTIES },
    default: "6"
  });
}

/** Difficulté des tests rapides fixée par le MJ (null = sans difficulté). */
export function defaultDifficulty() {
  const value = game.settings.get(SYSTEM_ID, "defaultDifficulty");
  return value === "none" ? null : Number(value);
}
