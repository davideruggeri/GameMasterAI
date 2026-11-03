import { generateText, stepCountIs, type LanguageModel, type ModelMessage } from "ai";
import type { Rng } from "../engine/rules";
import type { Adventure } from "./adventure";
import { buildSystemPrompt } from "./context";
import type { Setup } from "./setup";
import { createDmTools, type GameStore } from "./tools";

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface DmSession {
  setup: Setup;
  adventure: Adventure;
  /** Riassunto dei turni più vecchi (vedi summarizer.ts). */
  summary: string;
  turns: Turn[];
}

/** Quanti messaggi recenti mandare al modello. Il resto vive nel riassunto e nello stato. */
const RECENT_MESSAGES = 16;
const MAX_STEPS = 8;

function recentMessages(turns: Turn[]): ModelMessage[] {
  const recent = turns.slice(-RECENT_MESSAGES);
  // Alcuni provider (es. Gemini) vogliono che la conversazione inizi con l'utente.
  while (recent.length && recent[0].role === "assistant") recent.shift();
  return recent.map((t) => ({ role: t.role, content: t.content }));
}

export interface DmTurnResult {
  text: string;
  session: DmSession;
  /** Messaggi restituiti dal motore durante il turno: utili per il log di debug. */
  engineMessages: string[];
}

/**
 * Un turno del DM: il giocatore dice cosa fa (o comunica il risultato di un tiro),
 * il modello narra e usa i tool. Si ferma appena c'è un tiro dei giocatori da aspettare.
 */
export async function runDmTurn(opts: {
  model: LanguageModel;
  store: GameStore;
  session: DmSession;
  input: string;
  rng?: Rng;
}): Promise<DmTurnResult> {
  const { model, store, session, input, rng } = opts;
  const pendingBefore = new Set(store.get().pendingRolls.map((r) => r.id));
  const waitingForDice = () => store.get().pendingRolls.some((r) => !pendingBefore.has(r.id));

  const result = await generateText({
    model,
    system: buildSystemPrompt({ ...session, state: store.get() }),
    messages: [...recentMessages(session.turns), { role: "user", content: input }],
    tools: createDmTools(store, rng),
    stopWhen: [stepCountIs(MAX_STEPS), waitingForDice],
  });

  const engineMessages = result.steps.flatMap((step) =>
    step.toolResults.map((r) => (typeof r.output === "string" ? r.output : JSON.stringify(r.output))),
  );

  return {
    text: result.text,
    engineMessages,
    session: {
      ...session,
      turns: [...session.turns, { role: "user", content: input }, { role: "assistant", content: result.text }],
    },
  };
}
