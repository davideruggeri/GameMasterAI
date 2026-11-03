import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { DiceSchema } from "../engine/state";
import { ADVENTURE_DESIGN_PROMPT } from "./prompt";
import type { Setup } from "./setup";

// L'avventura è generata in due fasi per ridurre i tempi di attesa:
//   Fase 1 (Core) — premessa, antagonista, scena d'apertura: il gioco parte subito.
//   Fase 2 (World) — location, incontri, trappole, enigmi, PNG: carica in background.

// ---------------------------------------------------------------------------
// Fase 1 — Core (veloce)
// ---------------------------------------------------------------------------

export const AdventureCoreSchema = z.object({
  title: z.string(),
  premise: z.string(),
  openingScene: z.string().describe("Scena d'apertura forte: un evento misterioso o pericoloso"),
  mainGoal: z.string(),
  antagonist: z.object({
    name: z.string(),
    motivation: z.string(),
    powers: z.string(),
    plan: z.array(z.string()).describe("Come si sviluppa il piano nel tempo"),
  }),
  characterNames: z
    .array(z.object({ player: z.string(), name: z.string() }))
    .describe("Nomi inventati per i personaggi senza nome"),
});
export type AdventureCore = z.infer<typeof AdventureCoreSchema>;

// ---------------------------------------------------------------------------
// Fase 2 — World (in background)
// ---------------------------------------------------------------------------

const CreatureSchema = z.object({
  name: z.string(),
  count: z.number().int().min(1),
  maxHp: z.number().int().min(1),
  ac: z.number().int(),
  initiativeBonus: z.number().int(),
  attacks: z.array(
    z.object({
      name: z.string(),
      toHit: z.number().int(),
      damage: DiceSchema.describe('Dadi più bonus, es. "1d6+2"'),
      damageType: z.string(),
    }),
  ),
  tactics: z.string(),
});

export const AdventureWorldSchema = z.object({
  locations: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        connectedTo: z.array(z.string()),
        secrets: z.array(z.string()),
      }),
    )
    .min(3),
  puzzles: z
    .array(
      z.object({
        locationId: z.string(),
        description: z.string(),
        solution: z.string(),
        alternativeSolutions: z.array(z.string()),
        clues: z.array(z.string()),
      }),
    )
    .min(1),
  traps: z
    .array(
      z.object({
        locationId: z.string(),
        trigger: z.string(),
        detectDc: z.number().int(),
        disarmDc: z.number().int(),
        effect: z.string(),
        damage: z.string(),
      }),
    )
    .min(1),
  encounters: z
    .array(
      z.object({
        id: z.string(),
        locationId: z.string(),
        creatures: z.array(CreatureSchema).min(1),
        avoidable: z.string(),
      }),
    )
    .min(2),
  npcs: z.array(
    z.object({
      name: z.string(),
      personality: z.string(),
      knows: z.array(z.string()),
      reward: z.string(),
    }),
  ),
  treasures: z.array(z.object({ name: z.string(), locationId: z.string(), effect: z.string() })),
  twist: z.object({ description: z.string(), clues: z.array(z.string()) }),
  endings: z.array(z.object({ condition: z.string(), outcome: z.string() })).min(2),
});
export type AdventureWorld = z.infer<typeof AdventureWorldSchema>;

// ---------------------------------------------------------------------------
// Tipo completo (Core + World opzionale finché non è pronto)
// ---------------------------------------------------------------------------

export type Adventure = AdventureCore & { world?: AdventureWorld };

// ---------------------------------------------------------------------------
// Funzioni di generazione
// ---------------------------------------------------------------------------

const CORE_PROMPT =
  "Genera SOLO il nucleo dell'avventura: titolo, premessa, antagonista, scena d'apertura e nomi dei personaggi. " +
  "Sii conciso ma evocativo. Il resto (location, incontri, trappole) verrà generato separatamente.";

const WORLD_PROMPT =
  "Genera il mondo dell'avventura: location, incontri, trappole, enigmi, PNG, tesori, colpo di scena e finali. " +
  "Mantieni coerenza con il nucleo già definito.";

export async function generateAdventureCore(model: LanguageModel, setup: Setup): Promise<AdventureCore> {
  const { object } = await generateObject({
    model,
    schema: AdventureCoreSchema,
    system: ADVENTURE_DESIGN_PROMPT + "\n\n" + CORE_PROMPT,
    prompt: `Parametri della partita:\n${JSON.stringify(setup, null, 2)}`,
  });
  return object;
}

export async function generateAdventureWorld(
  model: LanguageModel,
  setup: Setup,
  core: AdventureCore,
): Promise<AdventureWorld> {
  const { object } = await generateObject({
    model,
    schema: AdventureWorldSchema,
    system: ADVENTURE_DESIGN_PROMPT + "\n\n" + WORLD_PROMPT,
    prompt: `Parametri della partita:\n${JSON.stringify(setup, null, 2)}\n\nNucleo già generato:\n${JSON.stringify(core, null, 2)}`,
  });
  return object;
}
