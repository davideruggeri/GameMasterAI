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
  "Sii coerente con il tema e i parametri della partita.";

export async function generateAdventureCore(model: LanguageModel, setup: Setup): Promise<AdventureCore> {
  const { object } = await generateObject({
    model,
    schema: AdventureCoreSchema,
    system: ADVENTURE_DESIGN_PROMPT + "\n\n" + CORE_PROMPT,
    prompt: `Parametri della partita:\n${JSON.stringify(setup, null, 2)}`,
  });
  return object;
}

export async function generateAdventureWorld(model: LanguageModel, setup: Setup): Promise<AdventureWorld> {
  const { object } = await generateObject({
    model,
    schema: AdventureWorldSchema,
    system: ADVENTURE_DESIGN_PROMPT + "\n\n" + WORLD_PROMPT,
    prompt: `Parametri della partita:\n${JSON.stringify(setup, null, 2)}`,
  });
  return object;
}

export async function generateAdventure(model: LanguageModel, setup: Setup): Promise<Adventure> {
  const [core, world] = await Promise.all([
    generateAdventureCore(model, setup),
    generateAdventureWorld(model, setup),
  ]);
  return { ...core, world };
}

// ---------------------------------------------------------------------------
// Schema completo per importazione da AI esterna
// ---------------------------------------------------------------------------

export const AdventureSchema = AdventureCoreSchema.extend({ world: AdventureWorldSchema });

// ---------------------------------------------------------------------------
// Prompt da dare a Claude / ChatGPT / Gemini per generare l'avventura
// ---------------------------------------------------------------------------

export function buildAdventurePrompt(setup: Setup, characters: { name: string; player: string; race: string; class: string; level: number; abilities: Record<string, number>; hp: number; maxHp: number; ac: number }[]): string {
  const charLines = characters
    .map((c) => {
      const ab = `FOR ${c.abilities.str} DES ${c.abilities.dex} COS ${c.abilities.con} INT ${c.abilities.int} SAG ${c.abilities.wis} CAR ${c.abilities.cha}`;
      return `- ${c.name} (giocato da ${c.player}): ${c.race} ${c.class} lv.${c.level} — ${ab}, PV ${c.hp}/${c.maxHp}, CA ${c.ac}`;
    })
    .join("\n");

  const namesExample = characters.map((c) => `{ "player": "${c.player}", "name": "${c.name}" }`).join(", ");

  const schema = `{
  "title": "Titolo evocativo",
  "premise": "Situazione generale: cosa sta succedendo e perché i personaggi sono coinvolti",
  "openingScene": "Scena d'apertura vivida: un evento misterioso o pericoloso che catapulta subito nell'azione",
  "mainGoal": "Obiettivo principale chiaro e raggiungibile nella durata indicata",
  "antagonist": {
    "name": "Nome antagonista",
    "motivation": "Perché fa quello che fa",
    "powers": "Capacità principali",
    "plan": ["Prima fase del piano", "Seconda fase", "Cosa succede se i PG non intervengono"]
  },
  "characterNames": [${namesExample}],
  "world": {
    "locations": [
      {
        "id": "loc_1",
        "name": "Nome luogo",
        "description": "Descrizione sensoriale: cosa si vede, sente, odora. 2-3 frasi.",
        "connectedTo": ["loc_2"],
        "secrets": ["Segreto nascosto qui, scopribile con esplorazione o prove"]
      },
      { "id": "loc_2", "name": "Secondo luogo", "description": "...", "connectedTo": ["loc_1", "loc_3"], "secrets": [] },
      { "id": "loc_3", "name": "Terzo luogo", "description": "...", "connectedTo": ["loc_2"], "secrets": ["..."] }
    ],
    "puzzles": [
      {
        "locationId": "loc_1",
        "description": "Cosa vedono i giocatori (es. 'quattro statue tengono oggetti diversi')",
        "solution": "Soluzione corretta",
        "alternativeSolutions": ["Modo creativo alternativo per risolverlo"],
        "clues": ["Indizio visibile nell'ambiente", "Indizio in un'iscrizione vicina"]
      }
    ],
    "traps": [
      {
        "locationId": "loc_2",
        "trigger": "Cosa attiva la trappola (es. calpestare la pietra centrale)",
        "detectDc": 15,
        "disarmDc": 13,
        "effect": "Cosa succede quando scatta",
        "damage": "2d6"
      }
    ],
    "encounters": [
      {
        "id": "enc_1",
        "locationId": "loc_2",
        "creatures": [
          {
            "name": "Nome creatura (SRD 5.1)",
            "count": 2,
            "maxHp": 13,
            "ac": 13,
            "initiativeBonus": 2,
            "attacks": [
              { "name": "Nome attacco", "toHit": 4, "damage": "1d6+2", "damageType": "perforante" }
            ],
            "tactics": "Come combatte: aggira, carica, usa il terreno"
          }
        ],
        "avoidable": "Come evitare lo scontro (distrazione, furtività, dialogo)"
      },
      {
        "id": "enc_2",
        "locationId": "loc_3",
        "creatures": [
          { "name": "...", "count": 1, "maxHp": 26, "ac": 15, "initiativeBonus": 1, "attacks": [{ "name": "...", "toHit": 5, "damage": "2d6+3", "damageType": "tagliente" }], "tactics": "..." }
        ],
        "avoidable": "..."
      }
    ],
    "npcs": [
      {
        "name": "Nome PNG",
        "personality": "Tratto caratteristico e comportamento in una frase",
        "knows": ["Informazione che rivela subito", "Segreto che rivela solo se convinto o ricompensato"],
        "reward": "Cosa offre se aiutato (oggetto, informazione, favore)"
      }
    ],
    "treasures": [
      { "name": "Nome oggetto (SRD 5.1)", "locationId": "loc_3", "effect": "Effetto meccanico o narrativo" }
    ],
    "twist": {
      "description": "Il colpo di scena principale della storia",
      "clues": ["Indizio seminato prima che venga rivelato", "Secondo indizio"]
    },
    "endings": [
      { "condition": "Se i PG sconfissero l'antagonista", "outcome": "Come finisce la storia" },
      { "condition": "Se i PG fallirono o fuggirono", "outcome": "Conseguenze del fallimento" }
    ]
  }
}`;

  return `Sei un game designer esperto di D&D 5ª edizione (SRD 5.1). Progetta un'avventura fantasy completa in italiano.

## PARAMETRI DELLA PARTITA
Età dei giocatori: ${setup.ages}
Esperienza con i GdR: ${setup.experience}
Tema/ambientazione: ${setup.theme}
Durata prevista: ${setup.duration}${setup.specialRequests ? `\nRichieste particolari: ${setup.specialRequests}` : ""}

## PERSONAGGI
${charLines}

## ISTRUZIONI CRITICHE
- Rispondi ESCLUSIVAMENTE con l'oggetto JSON. Zero testo prima o dopo — solo JSON grezzo.
- Calibra la quantità di contenuto sulla durata: one-shot = 3 location, 2 incontri; campagna breve = 5+ location, 4+ incontri.
- Usa SOLO creature e oggetti dell'SRD 5.1 (niente nomi Wizards of the Coast).
- Il campo "damage" negli attacchi segue il formato "XdY" o "XdY+Z" (es. "1d6", "2d8+3").
- I DC (difficoltà) seguono 5e: facile 10, medio 15, difficile 20.
- Minimo assoluto: 3 location, 2 incontri, 1 enigma, 1 trappola, 2 finali.
- Semina indizi del colpo di scena fin dall'inizio — non renderlo casuale.

## SCHEMA JSON (da rispettare esattamente)
${schema}`;
}
