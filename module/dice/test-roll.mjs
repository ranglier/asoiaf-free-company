import { ABILITIES, DIFFICULTIES, SYSTEM_ID } from "../config.mjs";
import { defaultDifficulty } from "../settings.mjs";

const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);

/**
 * Calcule le résultat d'un test à partir des dés lancés.
 * - on lance rang + dés bonus, on garde les `rang` meilleurs ;
 * - chaque dé de malus retire ensuite le plus faible des dés gardés ;
 * - le modificateur (lésions, armure, assistance...) s'ajoute au total.
 * Fonction pure, sans dépendance à Foundry, pour pouvoir la tester.
 */
export function evaluateTest(results, { rank, penalty = 0, modifier = 0, difficulty = null }) {
  const sorted = results.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
  const kept = sorted.slice(0, Math.max(0, rank - penalty));
  const keptIdx = new Set(kept.map(d => d.index));
  const dice = results.map((value, index) => ({ value, kept: keptIdx.has(index) }));
  const total = kept.reduce((s, d) => s + d.value, 0) + modifier;

  let outcome = null;
  if (difficulty !== null) {
    const margin = total - difficulty;
    if (margin >= 0) outcome = { success: true, degrees: Math.min(4, Math.floor(margin / 5) + 1) };
    else outcome = { success: false, degrees: margin <= -5 ? 2 : 1 };
  }
  return { dice, total, outcome };
}

/** Issue d'un test pour la carte : titre court (Réussite, Échec critique...) et nombre de degrés. */
export function verdict(outcome) {
  if (!outcome) return null;
  if (!outcome.success) return { title: game.i18n.localize(`AFC.Roll.Failure.${outcome.degrees}`), detail: null };
  return {
    title: game.i18n.localize(`AFC.Roll.Success.${outcome.degrees}`),
    detail: game.i18n.format(outcome.degrees > 1 ? "AFC.Roll.DegreesPlural" : "AFC.Roll.DegreesSingular", { n: outcome.degrees })
  };
}

/**
 * Malus automatiques d'un acteur pour un test : blessures (-1D chacune), lésions (-1 chacune),
 * malus d'armure sur l'Agilité. Retourne { dice, modifier, notes } (notes = libellés pour la carte).
 */
export function autoPenalties(actor, abilityKey) {
  const s = actor.system;
  const notes = [];
  let dice = 0, modifier = 0;
  if (s.wounds?.value) {
    dice += s.wounds.value;
    notes.push(game.i18n.format("AFC.Roll.Auto.wounds", { n: s.wounds.value }));
  }
  if (s.injuries?.value) {
    modifier -= s.injuries.value;
    notes.push(game.i18n.format("AFC.Roll.Auto.injuries", { n: s.injuries.value }));
  }
  if (abilityKey === "agility" && s.armor?.penalty) {
    modifier -= s.armor.penalty;
    notes.push(game.i18n.format("AFC.Roll.Auto.armor", { n: s.armor.penalty }));
  }
  return { dice, modifier, notes };
}

/** Liste des difficultés pour un <select>, avec celle par défaut sélectionnée. */
export function difficultyOptions(selected) {
  return Object.entries(DIFFICULTIES).map(([value, label]) => ({ value, label, selected: Number(value) === selected }));
}

/**
 * Test d'une compétence.
 * - quick : pas de dialogue, difficulté fixée par le MJ ;
 * - specialty : index de la spécialité à appliquer.
 */
export async function rollAbilityTest(actor, abilityKey, { quick = false, specialty = null } = {}) {
  const ability = actor.system.abilities[abilityKey];
  const label = game.i18n.localize(ABILITIES[abilityKey].label);
  const auto = autoPenalties(actor, abilityKey);
  const spec = specialty !== null ? ability.specialties[specialty] : null;

  if (quick) {
    return rollTest(actor, {
      abilityKey, label, rank: ability.rank,
      specialty: spec?.name ?? null, bonus: spec?.bonus ?? 0,
      penalty: auto.dice, modifier: auto.modifier, notes: auto.notes,
      difficulty: defaultDifficulty()
    });
  }

  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/test-dialog.hbs`, {
    ability, auto, selectedSpecialty: specialty, difficulties: difficultyOptions(defaultDifficulty())
  });
  const options = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("AFC.Roll.DialogTitle", { ability: label }) },
    classes: ["afc", "afc-dialog"],
    content,
    ok: {
      label: game.i18n.localize("AFC.Roll.Roll"),
      callback: (event, button) => {
        const f = button.form.elements;
        const idx = f.specialty?.value;
        const chosen = idx ? ability.specialties[Number(idx)] : null;
        const useAuto = f.auto?.checked ?? true;
        return {
          specialty: chosen?.name ?? null,
          bonus: (chosen?.bonus ?? 0) + (Number(f.bonus.value) || 0),
          penalty: (Number(f.penalty.value) || 0) + (useAuto ? auto.dice : 0),
          modifier: (Number(f.modifier.value) || 0) + (useAuto ? auto.modifier : 0),
          notes: useAuto ? auto.notes : [],
          difficulty: f.difficulty.value === "" ? null : Number(f.difficulty.value)
        };
      }
    },
    rejectClose: false
  });
  if (!options) return null;
  return rollTest(actor, { abilityKey, label, rank: ability.rank, ...options });
}

/** Lance les dés d'un test et renvoie le résultat (sans message). */
export async function rollDice({ rank, bonus = 0, penalty = 0, modifier = 0, difficulty = null }) {
  // Les dés bonus ne peuvent pas dépasser le nombre de dés de test.
  bonus = Math.max(0, Math.min(bonus, rank));
  const roll = await new Roll(`${rank + bonus}d6`).evaluate();
  const results = roll.dice[0].results.map(r => r.result);
  return { roll, bonus, ...evaluateTest(results, { rank, penalty, modifier, difficulty }) };
}

/** Lance le test et publie la carte de chat. */
export async function rollTest(actor, { abilityKey, label, rank, specialty = null, bonus = 0, penalty = 0, modifier = 0, notes = [], difficulty = null }) {
  const test = await rollDice({ rank, bonus, penalty, modifier, difficulty });
  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/chat/test-card.hbs`, {
    label, specialty, rank, bonus: test.bonus, penalty, modifier, notes, difficulty,
    difficultyLabel: difficulty !== null ? DIFFICULTIES[difficulty] : null,
    dice: test.dice, total: test.total, outcome: test.outcome, verdict: verdict(test.outcome)
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [test.roll],
    flags: { [SYSTEM_ID]: { test: { abilityKey, dice: test.dice, total: test.total, outcome: test.outcome } } }
  });
}
