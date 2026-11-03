import { tool } from "ai";
import { z } from "zod";
import * as A from "../engine/actions";
import { GameError } from "../engine/errors";
import type { Rng } from "../engine/rules";
import { AbilitySchema, DiceSchema, type ActionResult, type GameState } from "../engine/state";
import { describeState } from "./context";

/** Dove vive lo stato: in memoria, in un hook React, su Firestore... il DM non lo sa. */
export interface GameStore {
  get(): GameState;
  set(state: GameState): void;
}

/** Esegue un'azione del motore; un GameError torna al modello come testo, così può correggersi. */
function run(store: GameStore, action: (s: GameState) => ActionResult): string {
  try {
    const result = action(store.get());
    store.set(result.state);
    return result.message;
  } catch (e) {
    if (e instanceof GameError) return `ERRORE: ${e.message}`;
    throw e;
  }
}

const EnemyInputSchema = z.object({
  name: z.string(),
  maxHp: z.number().int().min(1),
  ac: z.number().int(),
  initiativeBonus: z.number().int().optional(),
  attacks: z
    .array(
      z.object({
        name: z.string(),
        toHit: z.number().int(),
        damage: DiceSchema.describe('Dadi più bonus, es. "1d6+2"'),
        damageType: z.string(),
      }),
    )
    .min(1),
  tactics: z.string().optional(),
});

export function createDmTools(store: GameStore, rng: Rng = Math.random) {
  return {
    getState: tool({
      description: "Legge lo stato di gioco aggiornato (PV, inventari, combattimento, tiri in attesa).",
      inputSchema: z.object({}),
      execute: async () => describeState(store.get()),
    }),

    requestCheck: tool({
      description:
        "Chiede a un personaggio una prova di caratteristica con i dadi fisici. Dopo averla chiesta, fermati e attendi il risultato.",
      inputSchema: z.object({
        characterId: z.string(),
        ability: AbilitySchema,
        proficient: z.boolean().optional().describe("true se il personaggio è competente nell'abilità usata"),
        dc: z.number().int().optional(),
        reason: z.string().describe("Cosa sta tentando, es. 'Furtività per superare le guardie'"),
      }),
      execute: async (a) =>
        run(store, (s) =>
          A.requestRoll(s, { characterId: a.characterId, kind: "check", ability: a.ability, proficient: a.proficient, dc: a.dc, label: a.reason }),
        ),
    }),

    requestSave: tool({
      description: "Chiede a un personaggio un tiro salvezza con i dadi fisici. Dopo averlo chiesto, fermati.",
      inputSchema: z.object({
        characterId: z.string(),
        ability: AbilitySchema,
        dc: z.number().int(),
        reason: z.string(),
      }),
      execute: async (a) =>
        run(store, (s) => A.requestRoll(s, { characterId: a.characterId, kind: "save", ability: a.ability, dc: a.dc, label: a.reason })),
    }),

    requestAttack: tool({
      description:
        "Un personaggio attacca con una delle sue armi o trucchetti. Il motore consuma le munizioni e chiede il tiro per colpire; se colpisce, chiede i danni.",
      inputSchema: z.object({
        characterId: z.string(),
        attackName: z.string().describe("Nome esatto dell'attacco dalla scheda"),
        targetId: z.string(),
      }),
      execute: async (a) => run(store, (s) => A.requestAttack(s, a, rng)),
    }),

    applyDamage: tool({
      description: "Infligge danni a un personaggio o a un nemico (trappole, cadute, effetti).",
      inputSchema: z.object({ targetId: z.string(), amount: z.number().int().min(0) }),
      execute: async (a) => run(store, (s) => A.applyDamage(s, a.targetId, a.amount)),
    }),

    heal: tool({
      description: "Cura un personaggio o un nemico.",
      inputSchema: z.object({ targetId: z.string(), amount: z.number().int().min(0) }),
      execute: async (a) => run(store, (s) => A.heal(s, a.targetId, a.amount)),
    }),

    giveItem: tool({
      description: "Aggiunge un oggetto all'inventario di un personaggio (tesori, oggetti trovati).",
      inputSchema: z.object({
        characterId: z.string(),
        name: z.string(),
        qty: z.number().int().min(1),
        ammo: z.boolean().optional(),
      }),
      execute: async (a) => run(store, (s) => A.giveItem(s, a.characterId, a)),
    }),

    useItem: tool({
      description: "Consuma oggetti dall'inventario (torce, razioni, pozioni...). Le munizioni degli attacchi le gestisce già requestAttack.",
      inputSchema: z.object({ characterId: z.string(), itemId: z.string(), qty: z.number().int().min(1) }),
      execute: async (a) => run(store, (s) => A.useItem(s, a.characterId, a.itemId, a.qty)),
    }),

    startCombat: tool({
      description:
        "Inizia un combattimento con i nemici indicati (usa le statistiche dell'avventura). Il motore tira l'iniziativa dei nemici e la chiede ai giocatori.",
      inputSchema: z.object({ enemies: z.array(EnemyInputSchema).min(1) }),
      execute: async (a) => run(store, (s) => A.startCombat(s, a.enemies, rng)),
    }),

    enemyAttack: tool({
      description: "Nel turno di un nemico: attacca un personaggio. Il motore tira per colpire e i danni.",
      inputSchema: z.object({ enemyId: z.string(), targetId: z.string(), attackName: z.string().optional() }),
      execute: async (a) => run(store, (s) => A.enemyAttack(s, a, rng)),
    }),

    nextTurn: tool({
      description: "Passa al prossimo combattente nell'ordine di iniziativa.",
      inputSchema: z.object({}),
      execute: async () => run(store, (s) => A.nextTurn(s)),
    }),

    endCombat: tool({
      description: "Chiude il combattimento. Il motore chiede a chi ha usato munizioni di tirare per recuperarle.",
      inputSchema: z.object({}),
      execute: async () => run(store, (s) => A.endCombat(s)),
    }),
  };
}
