import { useEffect, useRef, useState } from "react";
import { createCharacter, type Character } from "../engine";
import { loadApiKey, saveApiKey } from "../llm/provider";
import { loadGame, saveGame } from "../storage/db";
import CharacterCreator, { type CreatorValues } from "./CharacterCreator";
import CharacterSheet from "./CharacterSheet";

export default function App() {
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadGame().then((saved) => {
      if (saved?.gameState.characters.length) {
        setCharacters(saved.gameState.characters);
      }
    });
  }, []);

  function scheduleSave(chars: Character[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await saveGame(
          { characters: chars, enemies: [], combat: null, pendingRolls: [], rollLog: [], nextId: 0 },
          null,
        );
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
      scheduleSave(next);
      return next;
    });
  }

  function removeCharacter(id: string) {
    setCharacters((list) => {
      const next = list.filter((x) => x.id !== id);
      scheduleSave(next);
      return next;
    });
  }

  return (
    <main>
      <header>
        <h1>GameMaster AI</h1>
        <p className="muted">Avventure fantasy compatibili con la 5ª edizione, con un DM artificiale e i vostri dadi.</p>
      </header>

      <section className="card">
        <h2>Chiave API</h2>
        <p className="muted">
          Chiave gratuita di Google AI Studio. Resta salvata solo in questo browser.
        </p>
        <input
          type="password"
          value={apiKey}
          placeholder="Incolla qui la chiave"
          onChange={(e) => {
            setApiKey(e.target.value);
            saveApiKey(e.target.value.trim());
          }}
        />
      </section>

      <section className="card">
        <h2>Personaggi</h2>
        <CharacterCreator onCreate={addCharacter} />
      </section>

      <section className="sheets">
        {characters.map((c) => (
          <CharacterSheet
            key={c.id}
            character={c}
            onRemove={() => removeCharacter(c.id)}
          />
        ))}
      </section>

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
