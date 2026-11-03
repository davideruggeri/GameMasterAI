import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { DiceSchema } from "../engine/state";
import { ADVENTURE_DESIGN_PROMPT } from "./prompt";
import type { Setup } from "./setup";

// L'avventura "nascosta": generata una volta all'inizio, salvata, reinviata al
// modello a ogni turno e MAI mostrata ai giocatori. È ciò che rende coerenti
// misteri, trappole e soluzioni (il modello non ha una memoria privata).

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

export const AdventureSchema = z.object({
  title: z.string(),
  premise: z.string(),
  openingScene: z.string().describe("Scena d'apertura forte: un evento misterioso o pericoloso"),
  mainGoal: z.string(),
  antagonist: z.object({
    name: z.string(),
    motivation: z.string(),
    powers: z.string(),
    plan: z.array(z.string()).describe("Come si sviluppa il piano nel tempo se i giocatori non intervengono"),
  }),
  locations: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        connectedTo: z.array(z.string()).describe("id dei luoghi collegati"),
        secrets: z.array(z.string()),
      }),
    )
    .min(5),
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
    .min(2),
  traps: z
    .array(
      z.object({
        locationId: z.string(),
        trigger: z.string(),
        detectDc: z.number().int(),
        disarmDc: z.number().int(),
        effect: z.string(),
        damage: z.string().describe('Es. "2d6 perforanti" oppure "nessuno"'),
      }),
    )
    .min(2),
  encounters: z
    .array(
      z.object({
        id: z.string(),
        locationId: z.string(),
        creatures: z.array(CreatureSchema).min(1),
        avoidable: z.string().describe("Come si può evitare o risolvere senza combattere, se possibile"),
      }),
    )
    .min(3),
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
  characterNames: z
    .array(z.object({ player: z.string(), name: z.string() }))
    .describe("Nomi inventati per i personaggi che non ne hanno uno"),
});
export type Adventure = z.infer<typeof AdventureSchema>;

export async function generateAdventure(model: LanguageModel, setup: Setup): Promise<Adventure> {
  const { object } = await generateObject({
    model,
    schema: AdventureSchema,
    system: ADVENTURE_DESIGN_PROMPT,
    prompt: `Parametri della partita:\n${JSON.stringify(setup, null, 2)}`,
  });
  return object;
}
