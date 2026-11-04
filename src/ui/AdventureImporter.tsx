import { useState } from "react";
import { AdventureSchema, buildAdventurePrompt, type Adventure } from "../dm/adventure";
import type { Character } from "../engine";
import type { Setup } from "../dm/setup";

interface Props {
  setup: Setup;
  characters: Character[];
  onImport: (adventure: Adventure) => void;
  onCancel: () => void;
}

export default function AdventureImporter({ setup, characters, onImport, onCancel }: Props) {
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const prompt = buildAdventurePrompt(setup, characters);

  function copyPrompt() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function validate() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json.trim());
    } catch {
      setError("Il testo incollato non è un JSON valido. Assicurati di copiare solo il blocco JSON, senza testo prima o dopo.");
      return;
    }
    const result = AdventureSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(" · ");
      setError(`Struttura non valida: ${issues}`);
      return;
    }
    onImport(result.data);
  }

  return (
    <div className="card adventure-importer">
      <div className="adventure-importer__head">
        <h2>Avventura da AI esterna</h2>
        <button className="ghost" onClick={onCancel}>✕</button>
      </div>
      <p className="muted">
        Copia il prompt qui sotto, incollalo in <strong>Claude</strong>, <strong>ChatGPT</strong> o <strong>Gemini</strong> (più potenti per la costruzione del mondo), poi incolla qui il JSON che ti restituiscono.
      </p>

      <div className="importer-step">
        <div className="importer-step__label">1. Copia il prompt</div>
        <div className="importer-step__actions">
          <button onClick={copyPrompt} className={copied ? "btn-copied" : ""}>
            {copied ? "Copiato ✓" : "Copia prompt"}
          </button>
          <button className="ghost" onClick={() => setShowPrompt((v) => !v)}>
            {showPrompt ? "Nascondi" : "Anteprima"}
          </button>
        </div>
        {showPrompt && (
          <textarea
            className="prompt-preview"
            readOnly
            value={prompt}
            rows={14}
          />
        )}
      </div>

      <div className="importer-step">
        <div className="importer-step__label">2. Incolla il JSON ricevuto</div>
        <textarea
          value={json}
          onChange={(e) => { setJson(e.target.value); setError(null); }}
          rows={10}
          placeholder={'{\n  "title": "...",\n  "premise": "...",\n  ...\n}'}
          spellCheck={false}
        />
        {error && <p className="gen-error">{error}</p>}
        <button
          className="btn-primary"
          onClick={validate}
          disabled={!json.trim()}
        >
          Valida e usa questa avventura
        </button>
      </div>
    </div>
  );
}
