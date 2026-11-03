import { GameError } from "./errors";

// Regole base della 5ª edizione (SRD 5.1). Funzioni pure, senza stato.

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

export function formatModifier(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// ---------------------------------------------------------------------------
// Dadi
// ---------------------------------------------------------------------------

export const VALID_DICE = [4, 6, 8, 10, 12, 20, 100] as const;

export interface DiceExpr {
  count: number;
  sides: number;
  bonus: number;
}

export function parseDice(expr: string): DiceExpr {
  const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(expr.replace(/\s+/g, ""));
  if (!m) throw new GameError(`Espressione di dadi non valida: "${expr}"`);
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const bonus = m[3] ? parseInt(m[3], 10) : 0;
  if (count < 1 || count > 100 || !(VALID_DICE as readonly number[]).includes(sides)) {
    throw new GameError(`Espressione di dadi non valida: "${expr}"`);
  }
  return { count, sides, bonus };
}

export function formatDice({ count, sides, bonus }: DiceExpr): string {
  const b = bonus === 0 ? "" : formatModifier(bonus);
  return `${count === 1 && sides === 20 ? "" : count}d${sides}${b}`;
}

/** Solo la parte di dadi, senza bonus: "2d6+3" -> "2d6". */
export function diceOnly(expr: string): string {
  const d = parseDice(expr);
  return formatDice({ ...d, bonus: 0 });
}

/** Colpo critico: si raddoppiano i dadi, non il bonus. "1d8+3" -> "2d8+3". */
export function doubleDice(expr: string): string {
  const d = parseDice(expr);
  return formatDice({ ...d, count: d.count * 2 });
}

/** Valori possibili della somma dei dadi (bonus escluso). */
export function diceRange(expr: string): [number, number] {
  const d = parseDice(expr);
  return [d.count, d.count * d.sides];
}

/** Generatore di numeri casuali in [0, 1). Iniettabile per avere test deterministici. */
export type Rng = () => number;

export function rollDie(sides: number, rng: Rng): number {
  return Math.floor(rng() * sides) + 1;
}

/** Tiro "lato DM" (nemici, PNG). I tiri dei giocatori NON passano da qui: li fanno con i dadi fisici. */
export function rollDice(expr: string, rng: Rng): { rolls: number[]; total: number } {
  const d = parseDice(expr);
  const rolls = Array.from({ length: d.count }, () => rollDie(d.sides, rng));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + d.bonus };
}

// ---------------------------------------------------------------------------
// Risoluzione dei tiri
// ---------------------------------------------------------------------------

export function resolveCheck(natural: number, modifier: number, dc?: number) {
  const total = natural + modifier;
  return { total, success: dc === undefined ? undefined : total >= dc };
}

/** Tiro per colpire: 20 naturale colpisce sempre (critico), 1 naturale manca sempre. */
export function resolveAttack(natural: number, toHit: number, ac: number) {
  const total = natural + toHit;
  const critical = natural === 20;
  const fumble = natural === 1;
  const hit = critical || (!fumble && total >= ac);
  return { total, hit, critical, fumble };
}
