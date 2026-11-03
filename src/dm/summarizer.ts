import { generateText, type LanguageModel } from "ai";
import type { DmSession } from "./turn";

/** Oltre questa soglia i turni più vecchi vengono condensati nel riassunto. */
const SUMMARIZE_AFTER = 40;
const KEEP_RECENT = 16;

/**
 * Tiene il contesto piccolo (meno costi, meno rischio di sforare i limiti gratuiti):
 * i turni vecchi diventano un riassunto, lo stato preciso resta nel motore.
 */
export async function maybeSummarize(model: LanguageModel, session: DmSession): Promise<DmSession> {
  if (session.turns.length <= SUMMARIZE_AFTER) return session;

  const old = session.turns.slice(0, -KEEP_RECENT);
  const transcript = old.map((t) => `${t.role === "user" ? "GIOCATORI" : "DM"}: ${t.content}`).join("\n");

  const { text } = await generateText({
    model,
    system:
      "Riassumi la partita per il Dungeon Master in italiano, in modo compatto: luoghi visitati, scoperte, indizi trovati, " +
      "enigmi risolti, PNG incontrati e cosa sanno, decisioni importanti, nemici sconfitti, minacce ancora attive. " +
      "Niente PV o inventari: quelli sono nello stato di gioco.",
    prompt: `Riassunto precedente:\n${session.summary || "(nessuno)"}\n\nNuovi eventi:\n${transcript}`,
  });

  return { ...session, summary: text, turns: session.turns.slice(-KEEP_RECENT) };
}
