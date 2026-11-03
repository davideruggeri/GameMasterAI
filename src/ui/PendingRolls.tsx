import { useState } from "react";
import { formatModifier } from "../engine";
import type { Character, PendingRoll } from "../engine";

interface Props {
  rolls: PendingRoll[];
  characters: Character[];
  disabled: boolean;
  onSubmit: (rollId: string, raw: number) => void;
}

function RollCard({
  roll,
  character,
  disabled,
  onSubmit,
}: {
  roll: PendingRoll;
  character: Character | undefined;
  disabled: boolean;
  onSubmit: (raw: number) => void;
}) {
  const [raw, setRaw] = useState("");

  const mod = roll.modifier !== 0 ? ` ${formatModifier(roll.modifier)}` : "";
  const dc = roll.dc !== undefined ? ` — CD ${roll.dc}` : "";

  function submit() {
    const n = parseInt(raw, 10);
    if (isNaN(n)) return;
    onSubmit(n);
    setRaw("");
  }

  return (
    <div className="roll-card">
      <div className="roll-card__who">{character?.name ?? roll.characterId}</div>
      <div className="roll-card__label">{roll.label}</div>
      <div className="roll-card__dice">
        Tira <strong>{roll.dice}</strong>{mod}{dc}
      </div>
      <div className="roll-card__input">
        <input
          type="number"
          min={1}
          max={20}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="risultato dadi"
          disabled={disabled}
        />
        <button onClick={submit} disabled={disabled || !raw}>
          Invia
        </button>
      </div>
    </div>
  );
}

export default function PendingRolls({ rolls, characters, disabled, onSubmit }: Props) {
  return (
    <aside className="pending-rolls">
      <h3>Tiri dei giocatori</h3>
      {rolls.map((roll) => (
        <RollCard
          key={roll.id}
          roll={roll}
          character={characters.find((c) => c.id === roll.characterId)}
          disabled={disabled}
          onSubmit={(raw) => onSubmit(roll.id, raw)}
        />
      ))}
    </aside>
  );
}
