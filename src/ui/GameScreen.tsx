import { type FormEvent, useEffect, useRef, useState } from "react";
import type { LanguageModel } from "ai";
import { submitRoll } from "../engine";
import type { GameState } from "../engine";
import { runDmTurn, type DmSession } from "../dm/turn";
import { maybeSummarize } from "../dm/summarizer";
import type { GameStore } from "../dm/tools";
import PendingRolls from "./PendingRolls";
import CharacterSheet from "./CharacterSheet";

interface Props {
  model: LanguageModel;
  initialGameState: GameState;
  initialSession: DmSession;
  onUpdate: (gameState: GameState, session: DmSession) => void;
}

export default function GameScreen({ model, initialGameState, initialSession, onUpdate }: Props) {
  const [gameState, setGameState] = useState(initialGameState);
  const [session, setSession] = useState(initialSession);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<"personaggi" | "dadi">("personaggi");

  const stateRef = useRef(initialGameState);
  const sessionRef = useRef(initialSession);
  const chatRef = useRef<HTMLDivElement>(null);

  const store: GameStore = {
    get: () => stateRef.current,
    set: (s) => {
      stateRef.current = s;
      setGameState(s);
    },
  };

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [session.turns.length]);

  useEffect(() => {
    setSideTab(gameState.pendingRolls.length > 0 ? "dadi" : "personaggi");
  }, [gameState.pendingRolls.length]);

  async function sendTurn(text: string) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await runDmTurn({ model, store, session: sessionRef.current, input: text });
      const updated = await maybeSummarize(model, result.session);
      sessionRef.current = updated;
      setSession(updated);
      onUpdate(stateRef.current, updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante il turno del DM.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || gameState.pendingRolls.length > 0) return;
    setInput("");
    await sendTurn(text);
  }

  async function handleRollSubmit(rollId: string, raw: number) {
    const result = submitRoll(stateRef.current, rollId, raw);
    store.set(result.state);
    if (result.state.pendingRolls.length === 0) {
      await sendTurn(`Tiri completati. ${result.message}`);
    }
  }

  const hasPending = gameState.pendingRolls.length > 0;

  return (
    <div className="game-screen">
      <div className="chat-panel">
        <div className="chat" ref={chatRef}>
          {session.turns.map((turn, i) => (
            <div key={i} className={`chat-msg chat-msg--${turn.role}`}>
              <span className="chat-role">{turn.role === "assistant" ? "DM" : "Giocatori"}</span>
              <p>{turn.content}</p>
            </div>
          ))}
          {loading && (
            <div className="chat-msg chat-msg--loading">
              <span className="chat-role">DM</span>
              <p className="typing">…</p>
            </div>
          )}
          {error && (
            <p className="chat-error">
              {error} —{" "}
              <button className="link-btn" onClick={() => setError(null)}>
                Riprova
              </button>
            </p>
          )}
        </div>

        <form className="game-input" onSubmit={handleSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasPending ? "Completa prima i tiri dei dadi…" : "Descrivi cosa fate…"}
            disabled={loading || hasPending}
          />
          <button type="submit" disabled={loading || hasPending || !input.trim()}>
            Invia
          </button>
        </form>
      </div>

      <div className="side-panel">
        <div className="side-tabs">
          <button
            className={sideTab === "personaggi" ? "active" : ""}
            onClick={() => setSideTab("personaggi")}
          >
            Personaggi
          </button>
          <button
            className={sideTab === "dadi" ? "active" : ""}
            onClick={() => setSideTab("dadi")}
            disabled={!hasPending}
          >
            {hasPending ? `Dadi (${gameState.pendingRolls.length})` : "Dadi"}
          </button>
        </div>

        <div className="side-content">
          {sideTab === "personaggi" &&
            gameState.characters.map((c) => <CharacterSheet key={c.id} character={c} />)}

          {sideTab === "dadi" && hasPending && (
            <PendingRolls
              rolls={gameState.pendingRolls}
              characters={gameState.characters}
              disabled={loading}
              onSubmit={handleRollSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
}
