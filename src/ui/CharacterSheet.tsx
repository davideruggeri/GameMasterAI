import { ABILITIES, ABILITY_LABELS, abilityModifier, formatModifier, type Character } from "../engine";

export default function CharacterSheet({ character: c, onRemove }: { character: Character; onRemove?: () => void }) {
  return (
    <article className="card sheet">
      <div className="sheet-head">
        <div>
          <h3>{c.name}</h3>
          <p className="muted">
            {c.race} {c.class} · liv. {c.level} · giocato da {c.player}
          </p>
        </div>
        {onRemove && (
          <button className="ghost" onClick={onRemove} aria-label={`Rimuovi ${c.name}`}>
            ✕
          </button>
        )}
      </div>

      <div className="stats">
        <Stat label="PV" value={`${c.hp}/${c.maxHp}`} />
        <Stat label="CA" value={c.ac} />
        <Stat label="Iniziativa" value={formatModifier(c.initiativeBonus)} />
        <Stat label="Velocità" value={`${(c.speed / 10) * 3} m`} />
      </div>

      <div className="abilities">
        {ABILITIES.map((a) => (
          <div key={a} className="ability">
            <span className="muted">{ABILITY_LABELS[a].slice(0, 3).toUpperCase()}</span>
            <strong>{c.abilities[a]}</strong>
            <span>{formatModifier(abilityModifier(c.abilities[a]))}</span>
          </div>
        ))}
      </div>

      <h4>Attacchi</h4>
      <ul>
        {c.attacks.map((a) => (
          <li key={a.name}>
            <strong>{a.name}</strong>:{" "}
            {a.save ? `TS ${ABILITY_LABELS[a.save]} CD ${a.saveDc}` : `d20 ${formatModifier(a.toHit)}`}, danni {a.damage}{" "}
            {a.damageType}
          </li>
        ))}
      </ul>

      <h4>Abilità speciali</h4>
      <ul>
        {c.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p>
        <strong>Punto di forza:</strong> {c.strength}
        <br />
        <strong>Debolezza:</strong> {c.weakness}
      </p>
      {c.spellcasting && (
        <p>
          <strong>Incantesimi</strong> (TS CD {c.spellcasting.saveDc}, attacco {formatModifier(c.spellcasting.attackBonus)}):{" "}
          {c.spellcasting.notes}
        </p>
      )}

      <h4>Inventario</h4>
      <ul className="inventory">
        {c.inventory.map((i) => (
          <li key={i.id}>
            {i.name} × {i.qty}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
