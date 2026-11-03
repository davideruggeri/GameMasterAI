import { useState } from "react";
import { createCharacter, type Character } from "../engine";
import { loadApiKey, saveApiKey } from "../llm/provider";
import CharacterCreator, { type CreatorValues } from "./CharacterCreator";
import CharacterSheet from "./CharacterSheet";

// Prima schermata: chiave API e creazione dei personaggi (tutto calcolato dal motore,
// nessuna chiamata al modello). Il loop di gioco con il DM è il prossimo passo.

export default function App() {
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [characters, setCharacters] = useState<Character[]>([]);

  function addCharacter(v: CreatorValues) {
    const c = createCharacter({ ...v, id: `pc-${Date.now().toString(36)}` });
    setCharacters((list) => [...list, c]);
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
            onRemove={() => setCharacters((list) => list.filter((x) => x.id !== c.id))}
          />
        ))}
      </section>
    </main>
  );
}
