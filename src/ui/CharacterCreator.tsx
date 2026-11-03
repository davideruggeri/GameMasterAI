import { useState, type FormEvent } from "react";
import { CLASSES, CLASS_IDS, RACES, RACE_IDS, type ClassId, type RaceId } from "../engine";

export interface CreatorValues {
  player: string;
  name: string;
  sex: string;
  race: RaceId;
  class: ClassId;
}

const EMPTY: CreatorValues = { player: "", name: "", sex: "M", race: "human", class: "fighter" };

export default function CharacterCreator({ onCreate }: { onCreate: (v: CreatorValues) => void }) {
  const [values, setValues] = useState<CreatorValues>(EMPTY);

  function update<K extends keyof CreatorValues>(key: K, value: CreatorValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!values.player.trim()) return;
    onCreate({ ...values, name: values.name.trim() || `${RACES[values.race].label} ${CLASSES[values.class].label}` });
    setValues({ ...EMPTY, race: values.race, class: values.class });
  }

  return (
    <form className="creator" onSubmit={submit}>
      <label>
        Giocatore
        <input value={values.player} onChange={(e) => update("player", e.target.value)} placeholder="Matteo" />
      </label>
      <label>
        Nome del personaggio
        <input value={values.name} onChange={(e) => update("name", e.target.value)} placeholder="Thorin (facoltativo)" />
      </label>
      <label>
        Sesso
        <select value={values.sex} onChange={(e) => update("sex", e.target.value)}>
          <option value="M">Maschio</option>
          <option value="F">Femmina</option>
          <option value="Altro">Altro</option>
        </select>
      </label>
      <label>
        Razza
        <select value={values.race} onChange={(e) => update("race", e.target.value as RaceId)}>
          {RACE_IDS.map((id) => (
            <option key={id} value={id}>
              {RACES[id].label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Classe
        <select value={values.class} onChange={(e) => update("class", e.target.value as ClassId)}>
          {CLASS_IDS.map((id) => (
            <option key={id} value={id}>
              {CLASSES[id].label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={!values.player.trim()}>
        Crea personaggio
      </button>
    </form>
  );
}
