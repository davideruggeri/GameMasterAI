import { useCallback, useEffect, useRef, useState } from "react";
import { createCharacter, createGameState, type Character, type GameState } from "../engine";
import { generateAdventure, type Adventure } from "../dm/adventure";
import { runDmTurn, type DmSession } from "../dm/turn";
import { maybeSummarize } from "../dm/summarizer";
import type { Setup } from "../dm/setup";
import { createModel, loadApiKey, saveApiKey } from "../llm/provider";
import { loadGame, saveGame } from "../storage/db";
import CharacterCreator, { type CreatorValues } from "./CharacterCreator";
import CharacterSheet from "./CharacterSheet";
import SetupForm from "./SetupForm";
import AdventureImporter from "./AdventureImporter";
import GameScreen from "./GameScreen";

type Phase = "lobby" | "generating" | "playing";

export default function App() {
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [dmSession, setDmSession] = useState<DmSession | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [externalSetup, setExternalSetup] = useState<Setup | null>(null);
  const [importedAdventure, setImportedAdventure] = useState<Adventure | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadGame().then((saved) => {
      if (!saved) return;
      if (saved.gameState.characters.length) setCharacters(saved.gameState.characters);
      if (saved.dmSession) {
        setGameState(saved.gameState);
        setDmSession(saved.dmSession);
        setPhase("playing");
      }
    });
  }, []);

  function scheduleSave(gs: GameState, session: DmSession | null) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await saveGame(gs, session);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 1500);
  }

  function addCharacter(v: CreatorValues) {
    const c = createCharacter({ ...v, id: `pc-${Date.now().toString(36)}` });
    setCharacters((list) => {
      const next = [...list, c];
      scheduleSave(createGameState(next), null);
      return next;
    });
  }

  function removeCharacter(id: string) {
    setCharacters((list) => {
      const next = list.filter((x) => x.id !== id);
      scheduleSave(createGameState(next), null);
      return next;
    });
  }

  async function startGame(setup: Setup, adventure?: Adventure) {
    if (!apiKey && !adventure) {
      setGenError("Inserisci prima la chiave API.");
      return;
    }
    setGenError(null);
    setPhase("generating");
    try {
      const model = createModel(apiKey || "unused");
      const resolvedAdventure = adventure ?? await generateAdventure(model, setup);
      const gs = createGameState(characters);

      let session: DmSession = { setup, adventure: resolvedAdventure, summary: "", turns: [] };
      const stateRef = { current: gs };
      const store = { get: () => stateRef.current, set: (s: GameState) => { stateRef.current = s; } };

      const result = await runDmTurn({ model, store, session, input: "Inizia l'avventura." });
      session = await maybeSummarize(model, result.session);

      setGameState(stateRef.current);
      setDmSession(session);
      setPhase("playing");
      scheduleSave(stateRef.current, session);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Errore durante l'avvio.");
      setPhase("lobby");
    }
  }

  const handleUpdate = useCallback((gs: GameState, session: DmSession) => {
    setGameState(gs);
    setDmSession(session);
    scheduleSave(gs, session);
  }, []);

  return (
    <main className={phase === "playing" ? "main--playing" : undefined}>
      {phase !== "playing" && (
        <>
          <header>
            <h1>GameMaster AI</h1>
            <p className="muted">Avventure fantasy compatibili con la 5ª edizione, con un DM artificiale e i vostri dadi.</p>
          </header>

          <section className="card">
            <h2>Chiave API</h2>
            <p className="muted">Chiave gratuita di <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>. Resta salvata solo in questo browser.</p>
            <input
              type="password"
              value={apiKey}
              placeholder="Incolla qui la chiave"
              onChange={(e) => { setApiKey(e.target.value); saveApiKey(e.target.value.trim()); }}
            />
          </section>

          <section className="card">
            <h2>Personaggi</h2>
            <CharacterCreator onCreate={addCharacter} />
          </section>

          {characters.length > 0 && (
            <>
              <section className="sheets">
                {characters.map((c) => (
                  <CharacterSheet key={c.id} character={c} onRemove={() => removeCharacter(c.id)} />
                ))}
              </section>

              {importedAdventure ? (
                <div className="card adventure-ready">
                  <div className="adventure-ready__info">
                    <span className="adventure-ready__label">Avventura pronta</span>
                    <strong>{importedAdventure.title}</strong>
                    <span className="muted">{importedAdventure.premise.slice(0, 120)}…</span>
                  </div>
                  <div className="adventure-ready__actions">
                    <button
                      className="btn-primary"
                      disabled={phase === "generating" || !apiKey}
                      onClick={() => externalSetup && startGame(externalSetup, importedAdventure)}
                    >
                      {phase === "generating" ? "Avvio in corso…" : "Inizia l'avventura"}
                    </button>
                    <button className="ghost" onClick={() => { setImportedAdventure(null); setExternalSetup(null); }}>
                      Cambia avventura
                    </button>
                  </div>
                  {!apiKey && <p className="gen-error" style={{ marginTop: "0.5rem" }}>Inserisci la chiave API per avviare la partita.</p>}
                </div>
              ) : externalSetup ? (
                <AdventureImporter
                  setup={externalSetup}
                  characters={characters}
                  onImport={(adv) => setImportedAdventure(adv)}
                  onCancel={() => setExternalSetup(null)}
                />
              ) : (
                <SetupForm
                  characters={characters}
                  disabled={phase === "generating"}
                  onStart={startGame}
                  onExternal={(setup) => setExternalSetup(setup)}
                />
              )}
            </>
          )}

          {genError && <p className="gen-error">{genError}</p>}

          {phase === "generating" && (
            <div className="generating">
              <p>{importedAdventure ? "Il DM sta aprendo la sessione…" : "Il DM sta preparando l'avventura…"}</p>
              <div className="spinner" />
            </div>
          )}
        </>
      )}

      {phase === "playing" && gameState && dmSession && (
        <GameScreen
          model={createModel(apiKey)}
          initialGameState={gameState}
          initialSession={dmSession}
          onUpdate={handleUpdate}
        />
      )}

      {saveStatus !== "idle" && (
        <div className={`save-status save-status--${saveStatus}`}>
          {saveStatus === "saving" && "Salvataggio…"}
          {saveStatus === "saved" && "Salvato ✓"}
          {saveStatus === "error" && "Errore di salvataggio"}
        </div>
      )}
    </main>
  );
}
