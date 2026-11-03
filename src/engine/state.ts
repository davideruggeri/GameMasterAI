import { z } from "zod";

// ---------------------------------------------------------------------------
// Caratteristiche
// ---------------------------------------------------------------------------

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const AbilitySchema = z.enum(ABILITIES);
export type Ability = z.infer<typeof AbilitySchema>;

export const ABILITY_LABELS: Record<Ability, string> = {
  str: "Forza",
  dex: "Destrezza",
  con: "Costituzione",
  int: "Intelligenza",
  wis: "Saggezza",
  cha: "Carisma",
};

const score = z.number().int().min(1).max(30);
export const AbilityScoresSchema = z.object({
  str: score,
  dex: score,
  con: score,
  int: score,
  wis: score,
  cha: score,
});
export type AbilityScores = z.infer<typeof AbilityScoresSchema>;

// ---------------------------------------------------------------------------
// Dadi e attacchi
// ---------------------------------------------------------------------------

/** Espressione di dadi: "d20", "1d8", "2d6+3", "1d4-1". */
export const DiceSchema = z
  .string()
  .regex(/^\d*d(4|6|8|10|12|20|100)([+-]\d+)?$/, "Espressione di dadi non valida");

export const AttackSchema = z.object({
  name: z.string(),
  kind: z.enum(["melee", "ranged", "spell"]),
  /** Bonus al tiro per colpire (d20 + toHit). Ignorato se l'attacco usa un tiro salvezza. */
  toHit: z.number().int(),
  /** Danno, bonus incluso: "1d8+3". */
  damage: DiceSchema,
  damageType: z.string(),
  /** Se presente, il bersaglio fa un tiro salvezza invece di subire un tiro per colpire. */
  save: AbilitySchema.optional(),
  saveDc: z.number().int().optional(),
  /** Oggetto consumato a ogni attacco (frecce, quadrelli, dardi...). */
  ammoItemId: z.string().optional(),
});
export type Attack = z.infer<typeof AttackSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  qty: z.number().int().min(0),
  /** Munizione: se usata in combattimento viene conteggiata per il recupero a fine scontro. */
  ammo: z.boolean().optional(),
});
export type Item = z.infer<typeof ItemSchema>;

// ---------------------------------------------------------------------------
// Personaggi e nemici
// ---------------------------------------------------------------------------

export const CharacterStatusSchema = z.enum(["ok", "down", "dead"]);

export const CharacterSchema = z.object({
  id: z.string(),
  /** Nome reale del giocatore: serve all'interfaccia, il DM non lo usa in narrazione. */
  player: z.string(),
  name: z.string(),
  sex: z.string(),
  race: z.string(),
  class: z.string(),
  level: z.number().int().min(1).max(20),
  abilities: AbilityScoresSchema,
  proficiencyBonus: z.number().int(),
  savingThrows: z.array(AbilitySchema),
  maxHp: z.number().int().min(1),
  hp: z.number().int().min(0),
  tempHp: z.number().int().min(0),
  ac: z.number().int(),
  speed: z.number().int(),
  initiativeBonus: z.number().int(),
  attacks: z.array(AttackSchema),
  inventory: z.array(ItemSchema),
  /** Due abilità speciali: una dalla razza, una dalla classe. */
  features: z.array(z.string()),
  strength: z.string(),
  weakness: z.string(),
  spellcasting: z
    .object({
      ability: AbilitySchema,
      attackBonus: z.number().int(),
      saveDc: z.number().int(),
      notes: z.string(),
    })
    .optional(),
  conditions: z.array(z.string()),
  status: CharacterStatusSchema,
});
export type Character = z.infer<typeof CharacterSchema>;

export const EnemySchema = z.object({
  id: z.string(),
  name: z.string(),
  maxHp: z.number().int().min(1),
  hp: z.number().int().min(0),
  ac: z.number().int(),
  initiativeBonus: z.number().int(),
  attacks: z.array(AttackSchema),
  /** Modificatori ai tiri salvezza; se manca una caratteristica vale 0. */
  saves: z
    .object({
      str: z.number().int().optional(),
      dex: z.number().int().optional(),
      con: z.number().int().optional(),
      int: z.number().int().optional(),
      wis: z.number().int().optional(),
      cha: z.number().int().optional(),
    })
    .optional(),
  tactics: z.string().optional(),
  status: z.enum(["ok", "defeated"]),
});
export type Enemy = z.infer<typeof EnemySchema>;

// ---------------------------------------------------------------------------
// Combattimento, tiri in attesa, stato complessivo
// ---------------------------------------------------------------------------

export const CombatantSchema = z.object({
  id: z.string(),
  side: z.enum(["pc", "enemy"]),
  /** null finché il giocatore non ha comunicato il tiro di iniziativa. */
  initiative: z.number().int().nullable(),
});
export type Combatant = z.infer<typeof CombatantSchema>;

export const CombatSchema = z.object({
  round: z.number().int(),
  turnIndex: z.number().int(),
  order: z.array(CombatantSchema),
  /** Munizioni scagliate: personaggio -> oggetto -> quantità. */
  ammoSpent: z.record(z.string(), z.record(z.string(), z.number().int())),
});
export type Combat = z.infer<typeof CombatSchema>;

export const RollKindSchema = z.enum([
  "check",
  "save",
  "attack",
  "damage",
  "initiative",
  "ammoRecovery",
]);
export type RollKind = z.infer<typeof RollKindSchema>;

/** Un tiro che un giocatore deve fare con i dadi fisici e comunicare all'app. */
export const PendingRollSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  kind: RollKindSchema,
  /** Solo dadi, senza bonus: "d20", "2d8". Il giocatore comunica la somma dei dadi. */
  dice: z.string(),
  modifier: z.number().int(),
  label: z.string(),
  dc: z.number().int().optional(),
  targetId: z.string().optional(),
  attackName: z.string().optional(),
  critical: z.boolean().optional(),
  ammoItemId: z.string().optional(),
  ammoSpent: z.number().int().optional(),
});
export type PendingRoll = z.infer<typeof PendingRollSchema>;

export const RollRecordSchema = z.object({
  rollId: z.string(),
  characterId: z.string(),
  kind: RollKindSchema,
  label: z.string(),
  raw: z.number().int(),
  total: z.number().int(),
  outcome: z.string(),
});
export type RollRecord = z.infer<typeof RollRecordSchema>;

export const GameStateSchema = z.object({
  characters: z.array(CharacterSchema),
  enemies: z.array(EnemySchema),
  combat: CombatSchema.nullable(),
  pendingRolls: z.array(PendingRollSchema),
  rollLog: z.array(RollRecordSchema),
  /** Contatore per generare id deterministici (utile nei test e nei salvataggi). */
  nextId: z.number().int(),
});
export type GameState = z.infer<typeof GameStateSchema>;

/** Risultato di ogni azione del motore: nuovo stato + messaggio leggibile per il DM. */
export interface ActionResult {
  state: GameState;
  message: string;
}
