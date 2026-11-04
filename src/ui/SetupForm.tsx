import { useState, type FormEvent } from "react";
import type { Character } from "../engine";
import type { Setup } from "../dm/setup";

interface Props {
  characters: Character[];
  disabled: boolean;
  onStart: (setup: Setup) => void;
  onExternal: (setup: Setup) => void;
}

export default function SetupForm({ characters, disabled, onStart, onExternal }: Props) {
  const [ages, setAges] = useState("adulti");
  const [theme, setTheme] = useState("");
  const [experience, setExperience] = useState<Setup["experience"]>("misti");
  const [duration, setDuration] = useState("una serata");
  const [specialRequests, setSpecialRequests] = useState("");

  function buildSetup(): Setup {
    return {
      ages: ages.trim() || "adulti",
      theme: theme.trim(),
      experience,
      duration: duration.trim() || "una serata",
      specialRequests: specialRequests.trim(),
      characters: characters.map((c) => ({
        player: c.player,
        name: c.name || undefined,
        sex: c.sex,
        race: c.race as Setup["characters"][0]["race"],
        class: c.class as Setup["characters"][0]["class"],
      })),
    };
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!theme.trim()) return;
    onStart(buildSetup());
  }

  return (
    <form className="card setup-form" onSubmit={submit}>
      <h2>Configura la partita</h2>

      <div className="setup-grid">
        <label>
          Età dei giocatori
          <input value={ages} onChange={(e) => setAges(e.target.value)} placeholder="adulti" />
        </label>
        <label>
          Esperienza con i GdR
          <select value={experience} onChange={(e) => setExperience(e.target.value as Setup["experience"])}>
            <option value="principianti">Principianti</option>
            <option value="misti">Misti</option>
            <option value="esperti">Esperti</option>
          </select>
        </label>
        <label>
          Durata prevista
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="una serata" />
        </label>
        <label className="setup-grid--full">
          Tema dell'avventura <span className="req">*</span>
          <input
            required
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="es. dungeon oscuro, foresta fatata, intrighi di corte…"
          />
        </label>
        <label className="setup-grid--full">
          Richieste particolari
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="es. niente morti di PG, umorismo, puzzle…"
            rows={2}
          />
        </label>
      </div>

      <div className="setup-actions">
        <button className="btn-primary" type="submit" disabled={disabled || !theme.trim()}>
          {disabled ? "Generazione in corso…" : "Genera avventura"}
        </button>
        <button
          type="button"
          className="btn-external"
          disabled={disabled || !theme.trim()}
          onClick={() => { if (theme.trim()) onExternal(buildSetup()); }}
        >
          Crea con AI esterna ↗
        </button>
      </div>
    </form>
  );
}
