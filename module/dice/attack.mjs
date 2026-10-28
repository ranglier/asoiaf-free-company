import { ABILITIES, ATTACK_OPTIONS, COVER, SPECIALTY_NAMES, SYSTEM_ID, VISIBILITY } from "../config.mjs";
import { specialtyBonus } from "../data/actor-character.mjs";
import { autoPenalties, rollDice, verdict } from "./test-roll.mjs";

const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);

/**
 * Profil d'attaque d'une arme pour un acteur : dés, dés bonus, malus et dégâts de base.
 * - spécialité de l'arme = dés bonus, moins la Formation (le manque devient des dés de malus) ;
 * - arme à deux mains tenue à une main : -2D ;
 * - dégâts de base = rang de la compétence de dégâts + modificateur (minimum 1),
 *   +1 si Polyvalente à deux mains, +1 par dé bonus en Force si Puissante.
 */
export function weaponProfile(actor, weapon) {
  const w = weapon.system;
  const a = actor.system.abilities;
  const ability = a[w.ability];
  const twoHands = w.grip === "two" || w.twoHanded;
  const specBonus = w.specialty ? specialtyBonus(ability, w.specialty) : 0;
  let bonus = specBonus - w.training;
  let penalty = bonus < 0 ? -bonus : 0;
  bonus = Math.max(0, bonus);
  if (w.twoHanded && w.grip !== "two") penalty += 2;

  let damage = Math.max(1, (a[w.damageAbility]?.rank ?? 0) + w.damageMod);
  if (w.versatile && twoHands) damage += 1;
  if (w.powerful) damage += specialtyBonus(a.athletics, SPECIALTY_NAMES.strength);

  return {
    abilityKey: w.ability,
    abilityLabel: game.i18n.localize(ABILITIES[w.ability].label),
    rank: ability.rank, bonus, penalty, damage,
    // Détail pour l'affichage : dés de la spécialité, dés retirés par la Formation, malus à une main.
    specialty: w.specialty, specBonus, training: w.training,
    oneHandPenalty: w.twoHanded && w.grip !== "two" ? 2 : 0
  };
}

/** Qualités d'une arme en une ligne : qualités calculées puis texte libre. */
export function weaponQualities(weapon) {
  const w = weapon.system;
  const list = [];
  if (w.piercing) list.push(`${game.i18n.localize("AFC.Weapon.Short.piercing")} ${w.piercing}`);
  if (w.powerful) list.push(game.i18n.localize("AFC.Weapon.Short.powerful"));
  if (w.versatile) list.push(game.i18n.localize("AFC.Weapon.Short.versatile"));
  if (w.twoHanded) list.push(game.i18n.localize("AFC.Weapon.Short.twoHanded"));
  if (w.defenseBonus) list.push(`${game.i18n.localize("AFC.Weapon.Short.defensive")} +${w.defenseBonus}`);
  // Texte libre, sans répéter les qualités déjà listées.
  const known = new Set(list.map(q => q.split(" ")[0].toLowerCase()));
  for (const q of (w.qualities ?? "").split(",").map(q => q.trim()).filter(Boolean)) {
    if (!known.has(q.split(" ")[0].toLowerCase())) list.push(q);
  }
  return list.join(", ");
}

/** Premier jeton ciblé par l'utilisateur, s'il y en a un. */
function currentTarget() {
  const token = game.user.targets.first();
  return token?.actor ? { token, actor: token.actor } : null;
}

/** Attaque avec une arme : dialogue (sauf attaque rapide avec cible), jet, carte de chat. */
export async function rollAttack(actor, weapon, { quick = false } = {}) {
  const profile = weaponProfile(actor, weapon);
  const target = currentTarget();
  const auto = autoPenalties(actor, profile.abilityKey);

  let opts = { options: [], cover: 0, visibility: 0, bonus: 0, penalty: 0, modifier: 0, useAuto: true,
    defense: target?.actor.system.defense?.combat ?? null };

  if (!quick || !target) {
    const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/attack-dialog.hbs`, {
      weapon, profile, auto, target: target?.actor, defense: opts.defense,
      options: ATTACK_OPTIONS, cover: COVER, visibility: VISIBILITY
    });
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.format("AFC.Attack.DialogTitle", { weapon: weapon.name }) },
      classes: ["afc", "afc-dialog"],
      content,
      ok: {
        label: game.i18n.localize("AFC.Attack.Attack"),
        callback: (event, button) => {
          const f = button.form.elements;
          return {
            options: Object.keys(ATTACK_OPTIONS).filter(k => f[`opt-${k}`]?.checked),
            cover: Number(f.cover.value) || 0,
            visibility: Number(f.visibility.value) || 0,
            bonus: Number(f.bonus.value) || 0,
            penalty: Number(f.penalty.value) || 0,
            modifier: Number(f.modifier.value) || 0,
            useAuto: f.auto?.checked ?? true,
            defense: f.defense.value === "" ? null : Number(f.defense.value)
          };
        }
      },
      rejectClose: false
    });
    if (!result) return null;
    opts = result;
  }

  // Dés de test, dés bonus et malus.
  let rank = profile.rank;
  let bonus = profile.bonus + opts.bonus;
  let penalty = profile.penalty + opts.penalty + opts.visibility;
  let modifier = opts.modifier;
  let damageBase = profile.damage;
  const notes = [];
  if (profile.specialty) notes.push(`${profile.specialty} +${profile.specBonus}B`);
  if (profile.training) notes.push(`${game.i18n.localize("AFC.Weapon.trainingShort")} −${profile.training}B`);
  if (profile.oneHandPenalty) notes.push(`${game.i18n.localize("AFC.Weapon.oneHand")} −${profile.oneHandPenalty}D`);
  for (const key of opts.options) {
    const o = ATTACK_OPTIONS[key];
    if (o.dice > 0) rank += o.dice;
    if (o.dice < 0) penalty -= o.dice;
    bonus += o.bonus ?? 0;
    damageBase += o.damage ?? 0;
    notes.push(game.i18n.localize(o.label));
  }
  if (opts.useAuto) {
    penalty += auto.dice;
    modifier += auto.modifier;
    notes.push(...auto.notes);
  }
  if (opts.visibility) notes.push(game.i18n.localize(VISIBILITY[opts.visibility]));

  // Défense de la cible : couverture, cible impuissante (perd son Agilité).
  let defense = opts.defense;
  if (defense !== null) {
    defense += opts.cover;
    if (opts.options.includes("helpless") && target) defense -= target.actor.system.abilities.agility.rank;
  }

  const test = await rollDice({ rank, bonus, penalty, modifier, difficulty: defense });

  // Dégâts : base x degrés, moins la Valeur d'armure (réduite par Perforante).
  let damage = null;
  if (test.outcome?.success) {
    const raw = damageBase * test.outcome.degrees;
    const armor = Math.max(0, (target?.actor.system.armor?.rating ?? 0) - weapon.system.piercing);
    damage = { base: damageBase, degrees: test.outcome.degrees, raw, armor, final: Math.max(0, raw - armor) };
  }

  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/chat/attack-card.hbs`, {
    weapon, profile, rank, bonus: test.bonus, penalty, modifier, notes,
    target: target?.actor, defense, dice: test.dice, total: test.total,
    outcome: test.outcome, verdict: verdict(test.outcome), damage, qualities: weaponQualities(weapon),
    selfDefense: opts.options.includes("cautious") ? 3 : opts.options.includes("reckless") ? -5 : 0
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [test.roll],
    flags: { [SYSTEM_ID]: { attack: { weapon: weapon.name, targetUuid: target?.actor.uuid ?? null, damage } } }
  });
}

/** Boîte de dialogue de la cible : encaisser, prendre des lésions ou une blessure. */
export async function resolveDamage(message) {
  const data = message.getFlag(SYSTEM_ID, "attack");
  const actor = data?.targetUuid ? await fromUuid(data.targetUuid) : null;
  if (!actor || !data.damage) return;
  if (!actor.isOwner) return ui.notifications.warn(game.i18n.localize("AFC.Damage.NotOwner"));

  const s = actor.system;
  const endurance = s.abilities.endurance.rank;
  const injuriesLeft = Math.max(0, s.injuries.max - s.injuries.value);
  const woundsLeft = Math.max(0, s.wounds.max - s.wounds.value);
  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/damage-dialog.hbs`, {
    actor, damage: data.damage.final, endurance, injuriesLeft, woundsLeft,
    maxInjuries: Math.min(injuriesLeft, Math.ceil(data.damage.final / endurance))
  });
  const choice = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("AFC.Damage.DialogTitle", { name: actor.name }) },
    classes: ["afc", "afc-dialog"],
    content,
    ok: {
      label: game.i18n.localize("AFC.Damage.Apply"),
      callback: (event, button) => ({
        injuries: Math.min(injuriesLeft, Number(button.form.elements.injuries?.value) || 0),
        wound: !!button.form.elements.wound?.checked && woundsLeft > 0
      })
    },
    rejectClose: false
  });
  if (!choice) return;

  const taken = choice.wound ? 0 : Math.max(0, data.damage.final - choice.injuries * endurance);
  const health = Math.max(0, s.health.value - taken);
  const injuries = s.injuries.value + (choice.wound ? 0 : choice.injuries);
  const wounds = s.wounds.value + (choice.wound ? 1 : 0);
  await actor.update({ "system.health.value": health, "system.injuries.value": injuries, "system.wounds.value": wounds });

  const lines = [game.i18n.format("AFC.Damage.Taken", { name: actor.name, n: taken, health, max: s.health.max })];
  if (!choice.wound && choice.injuries) lines.push(game.i18n.format("AFC.Damage.InjuriesTaken", { n: choice.injuries }));
  if (choice.wound) lines.push(game.i18n.localize("AFC.Damage.WoundTaken"));
  if (wounds >= endurance) lines.push(`<strong>${game.i18n.localize("AFC.Damage.Dead")}</strong>`);
  else if (health === 0) lines.push(`<strong>${game.i18n.localize("AFC.Damage.Defeated")}</strong>`);
  // Message visible seulement du MJ et des propriétaires de la cible.
  const whisper = game.users.filter(u => u.isGM || actor.testUserPermission(u, "OWNER")).map(u => u.id);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="afc-card damage">${lines.map(l => `<p>${l}</p>`).join("")}</div>`,
    whisper
  });
}

/** Branche le bouton « Résoudre les dégâts » des cartes d'attaque. */
export function onRenderChatMessage(message, html) {
  const button = html.querySelector("[data-afc-action='resolve-damage']");
  if (!button) return;
  const uuid = message.getFlag(SYSTEM_ID, "attack")?.targetUuid;
  const actor = uuid ? fromUuidSync(uuid) : null;
  if (!actor?.isOwner) return button.remove();
  button.addEventListener("click", () => resolveDamage(message));
}
