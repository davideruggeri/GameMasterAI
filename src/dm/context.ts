import { ABILITIES, ABILITY_LABELS, type GameState } from "../engine/state";
import { formatModifier } from "../engine/rules";
import type { Adventure } from "./adventure";
import { DM_INSTRUCTIONS } from "./prompt";
import type { Setup } from "./setup";

/** Stato di gioco in forma compatta e leggibile per il modello. */
export function describeState(state: GameState): string {
  const lines: string[] = [];

  lines.push("Personaggi:");
  for (const c of state.characters) {
    const abil = ABILITIES.map((a) => `${ABILITY_LABELS[a].slice(0, 3)} ${c.abilities[a]}`).join(", ");
    const attacks = c.attacks
      .map((a) => (a.save ? `${a.name} (TS ${ABILITY_LABELS[a.save]} CD ${a.saveDc}, ${a.damage})` : `${a.name} (${formatModifier(a.toHit)}, ${a.damage})`))
      .join("; ");
    const inv = c.inventory.map((i) => `${i.name} ×${i.qty}`).join(", ");
    lines.push(
      `- [${c.id}] ${c.name}, ${c.race} ${c.class} liv. ${c.level} — PV ${c.hp}/${c.maxHp}` +
        `${c.tempHp ? ` (+${c.tempHp} temp)` : ""}, CA ${c.ac}, stato: ${c.status}` +
        `${c.conditions.length ? `, condizioni: ${c.conditions.join(", ")}` : ""}\n` +
        `  ${abil}. Attacchi: ${attacks}. Inventario: ${inv}.\n` +
        `  Abilità: ${c.features.join(" | ")}. Forza: ${c.strength}. Debolezza: ${c.weakness}.` +
        `${c.spellcasting ? `\n  Incantesimi: ${c.spellcasting.notes}` : ""}`,
    );
  }

  if (state.combat) {
    const current = state.combat.order[state.combat.turnIndex];
    lines.push(
      state.combat.round === 0
        ? "\nCombattimento — in attesa dei tiri di iniziativa"
        : `\nCombattimento — round ${state.combat.round}, tocca a: ${current?.id ?? "?"}`,
    );
    for (const e of state.enemies) {
      lines.push(
        `- [${e.id}] ${e.name}: PV ${e.hp}/${e.maxHp}, CA ${e.ac}, ${e.status}. Attacchi: ` +
          e.attacks.map((a) => `${a.name} (${formatModifier(a.toHit)}, ${a.damage})`).join("; ") +
          `${e.tactics ? `. Tattica: ${e.tactics}` : ""}`,
      );
    }
    lines.push(`Ordine: ${state.combat.order.map((o) => `${o.id} (${o.initiative ?? "?"})`).join(", ")}`);
  }

  if (state.pendingRolls.length) {
    lines.push("\nTiri in attesa dei giocatori:");
    for (const r of state.pendingRolls) lines.push(`- ${r.id}: [${r.characterId}] ${r.dice} — ${r.label}`);
  }

  const recent = state.rollLog.slice(-5);
  if (recent.length) {
    lines.push("\nUltimi tiri:");
    for (const r of recent) lines.push(`- ${r.outcome}`);
  }
  return lines.join("\n");
}

/**
 * Prompt di sistema. La parte stabile (istruzioni, parametri, avventura) sta all'inizio
 * e non cambia tra un turno e l'altro: così il provider può metterla in cache.
 * La parte variabile (riassunto, stato) sta in fondo.
 */
export function buildSystemPrompt(opts: {
  setup: Setup;
  adventure: Adventure;
  summary: string;
  state: GameState;
}): string {
  const { setup, adventure, summary, state } = opts;
  return [
    DM_INSTRUCTIONS,
    `## PARAMETRI DELLA PARTITA\nEtà: ${setup.ages}. Esperienza: ${setup.experience}. Tema: ${setup.theme}. Durata: ${setup.duration}. Richieste particolari: ${setup.specialRequests || "nessuna"}.`,
    `## AVVENTURA SEGRETA (non rivelarla)\n${JSON.stringify(adventure)}`,
    `## RIASSUNTO DELLA STORIA FINORA\n${summary || "La partita sta per iniziare."}`,
    `## STATO DI GIOCO ATTUALE\n${describeState(state)}`,
  ].join("\n\n");
}
