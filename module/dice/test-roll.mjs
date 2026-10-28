import { ABILITIES, DIFFICULTIES, SYSTEM_ID } from "../config.mjs";

/**
 * Calcule le résultat d'un test à partir des dés lancés.
 * - on lance rang + dés bonus, on garde les `rang` meilleurs ;
 * - chaque dé de malus retire ensuite le plus faible des dés gardés ;
 * - le modificateur (lésions, frustration, assistance...) s'ajoute au total.
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

/** Libellé de l'issue (clé de traduction). */
function outcomeLabel(outcome) {
  if (!outcome) return null;
  if (outcome.success) return `AFC.Roll.Success.${outcome.degrees}`;
  return `AFC.Roll.Failure.${outcome.degrees}`;
}

/** Boîte de dialogue du test, puis lancer et carte de chat. */
export async function rollAbilityTest(actor, abilityKey) {
  const ability = actor.system.abilities[abilityKey];
  const label = game.i18n.localize(ABILITIES[abilityKey].label);
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/dialog/test-dialog.hbs`,
    {
      ability,
      difficulties: Object.entries(DIFFICULTIES).map(([value, label]) => ({ value, label, selected: value === "6" }))
    }
  );

  const options = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("AFC.Roll.DialogTitle", { ability: label }) },
    content,
    ok: {
      label: game.i18n.localize("AFC.Roll.Roll"),
      callback: (event, button) => {
        const f = button.form.elements;
        const idx = f.specialty?.value;
        const spec = idx ? ability.specialties[Number(idx)] : null;
        return {
          specialty: spec?.name ?? null,
          bonus: (spec?.bonus ?? 0) + (Number(f.bonus.value) || 0),
          penalty: Number(f.penalty.value) || 0,
          modifier: Number(f.modifier.value) || 0,
          difficulty: f.difficulty.value === "" ? null : Number(f.difficulty.value)
        };
      }
    },
    rejectClose: false
  });
  if (!options) return null;

  return rollTest(actor, { abilityKey, label, rank: ability.rank, ...options });
}

/** Lance le test et publie la carte de chat. */
export async function rollTest(actor, { abilityKey, label, rank, specialty = null, bonus = 0, penalty = 0, modifier = 0, difficulty = null }) {
  // Les dés bonus ne peuvent pas dépasser le nombre de dés de test.
  bonus = Math.min(bonus, rank);
  const roll = await new Roll(`${rank + bonus}d6`).evaluate();
  const results = roll.dice[0].results.map(r => r.result);
  const test = evaluateTest(results, { rank, penalty, modifier, difficulty });

  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/chat/test-card.hbs`,
    {
      label, specialty, rank, bonus, penalty, modifier, difficulty,
      difficultyLabel: difficulty !== null ? DIFFICULTIES[difficulty] : null,
      ...test,
      outcomeLabel: outcomeLabel(test.outcome)
    }
  );

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    flags: { [SYSTEM_ID]: { test: { abilityKey, ...test } } }
  });
}
