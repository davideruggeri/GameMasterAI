import { GameError } from "./errors";
import {
  abilityModifier,
  diceOnly,
  diceRange,
  doubleDice,
  formatModifier,
  parseDice,
  resolveAttack,
  resolveCheck,
  rollDice,
  rollDie,
  type Rng,
} from "./rules";
import {
  ABILITY_LABELS,
  type Ability,
  type ActionResult,
  type Attack,
  type Character,
  type Enemy,
  type GameState,
  type PendingRoll,
  type RollRecord,
} from "./state";

// Tutte le azioni sono funzioni pure: ricevono uno stato e restituiscono un nuovo
// stato + un messaggio per il DM. Se l'azione non è valida lanciano GameError.

const ROLL_LOG_LIMIT = 50;

export function createGameState(characters: Character[] = []): GameState {
  return { characters, enemies: [], combat: null, pendingRolls: [], rollLog: [], nextId: 1 };
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function newId(state: GameState, prefix: string): string {
  const id = `${prefix}-${state.nextId}`;
  state.nextId += 1;
  return id;
}

export function getCharacter(state: GameState, id: string): Character {
  const c = state.characters.find((x) => x.id === id);
  if (!c) throw new GameError(`Personaggio inesistente: ${id}`);
  return c;
}

export function getEnemy(state: GameState, id: string): Enemy {
  const e = state.enemies.find((x) => x.id === id);
  if (!e) throw new GameError(`Nemico inesistente: ${id}`);
  return e;
}

function getCreature(state: GameState, id: string): { kind: "pc"; c: Character } | { kind: "enemy"; e: Enemy } {
  const c = state.characters.find((x) => x.id === id);
  if (c) return { kind: "pc", c };
  const e = state.enemies.find((x) => x.id === id);
  if (e) return { kind: "enemy", e };
  throw new GameError(`Bersaglio inesistente: ${id}`);
}

function nameOf(state: GameState, id: string): string {
  const t = getCreature(state, id);
  return t.kind === "pc" ? t.c.name : t.e.name;
}

function assertNonNegativeInt(n: number, what: string) {
  if (!Number.isInteger(n) || n < 0) throw new GameError(`${what} deve essere un intero >= 0 (ricevuto ${n})`);
}

// ---------------------------------------------------------------------------
// Punti vita
// ---------------------------------------------------------------------------

/** Muta lo stato passato (già clonato). */
function damageInPlace(state: GameState, targetId: string, amount: number): string {
  assertNonNegativeInt(amount, "Il danno");
  const t = getCreature(state, targetId);

  if (t.kind === "enemy") {
    const e = t.e;
    if (e.status === "defeated") return `${e.name} è già sconfitto.`;
    e.hp = Math.max(0, e.hp - amount);
    if (e.hp === 0) {
      e.status = "defeated";
      return `${e.name} subisce ${amount} danni ed è sconfitto.`;
    }
    return `${e.name} subisce ${amount} danni (PV ${e.hp}/${e.maxHp}).`;
  }

  const c = t.c;
  if (c.status === "dead") return `${c.name} è già morto.`;
  const absorbed = Math.min(c.tempHp, amount);
  c.tempHp -= absorbed;
  const rest = amount - absorbed;
  const overflow = rest - c.hp;
  c.hp = Math.max(0, c.hp - rest);

  if (c.hp === 0) {
    // SRD: se il danno in eccesso raggiunge i PV massimi, morte istantanea.
    if (overflow >= c.maxHp) {
      c.status = "dead";
      return `${c.name} subisce ${amount} danni: colpo devastante, ${c.name} muore sul colpo.`;
    }
    c.status = "down";
    return `${c.name} subisce ${amount} danni e cade a terra privo di sensi (0 PV).`;
  }
  return `${c.name} subisce ${amount} danni (PV ${c.hp}/${c.maxHp}).`;
}

export function applyDamage(state: GameState, targetId: string, amount: number): ActionResult {
  const s = clone(state);
  return { state: s, message: damageInPlace(s, targetId, amount) };
}

export function heal(state: GameState, targetId: string, amount: number): ActionResult {
  assertNonNegativeInt(amount, "La cura");
  const s = clone(state);
  const t = getCreature(s, targetId);
  if (t.kind === "enemy") {
    t.e.hp = Math.min(t.e.maxHp, t.e.hp + amount);
    if (t.e.hp > 0) t.e.status = "ok";
    return { state: s, message: `${t.e.name} recupera PV (PV ${t.e.hp}/${t.e.maxHp}).` };
  }
  const c = t.c;
  if (c.status === "dead") throw new GameError(`${c.name} è morto: le cure normali non bastano.`);
  c.hp = Math.min(c.maxHp, c.hp + amount);
  if (c.hp > 0) c.status = "ok";
  return { state: s, message: `${c.name} recupera ${amount} PV (PV ${c.hp}/${c.maxHp}).` };
}

export function setTempHp(state: GameState, characterId: string, amount: number): ActionResult {
  assertNonNegativeInt(amount, "I PV temporanei");
  const s = clone(state);
  const c = getCharacter(s, characterId);
  // SRD: i PV temporanei non si sommano, si tiene il valore più alto.
  c.tempHp = Math.max(c.tempHp, amount);
  return { state: s, message: `${c.name} ha ${c.tempHp} PV temporanei.` };
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addItemInPlace(c: Character, item: { id?: string; name: string; qty: number; ammo?: boolean }) {
  const id = item.id ?? slugify(item.name);
  const existing = c.inventory.find((i) => i.id === id);
  if (existing) existing.qty += item.qty;
  else c.inventory.push({ id, name: item.name, qty: item.qty, ...(item.ammo ? { ammo: true } : {}) });
}

export function giveItem(
  state: GameState,
  characterId: string,
  item: { id?: string; name: string; qty: number; ammo?: boolean },
): ActionResult {
  assertNonNegativeInt(item.qty, "La quantità");
  const s = clone(state);
  const c = getCharacter(s, characterId);
  addItemInPlace(c, item);
  return { state: s, message: `${c.name} ottiene ${item.qty} × ${item.name}.` };
}

function useItemInPlace(state: GameState, characterId: string, itemId: string, qty: number): string {
  const c = getCharacter(state, characterId);
  const item = c.inventory.find((i) => i.id === itemId);
  if (!item) throw new GameError(`${c.name} non possiede "${itemId}".`);
  if (item.qty < qty) throw new GameError(`${c.name} ha solo ${item.qty} × ${item.name}, ne servono ${qty}.`);
  item.qty -= qty;
  if (item.qty === 0 && !item.ammo) c.inventory = c.inventory.filter((i) => i !== item);

  if (item.ammo && state.combat) {
    const spent = (state.combat.ammoSpent[c.id] ??= {});
    spent[item.id] = (spent[item.id] ?? 0) + qty;
  }
  return `${c.name} usa ${qty} × ${item.name} (rimasti: ${item.qty}).`;
}

export function useItem(state: GameState, characterId: string, itemId: string, qty = 1): ActionResult {
  assertNonNegativeInt(qty, "La quantità");
  const s = clone(state);
  return { state: s, message: useItemInPlace(s, characterId, itemId, qty) };
}

// ---------------------------------------------------------------------------
// Tiri dei giocatori (dadi fisici)
// ---------------------------------------------------------------------------

function addPending(state: GameState, roll: Omit<PendingRoll, "id">): PendingRoll {
  const pending: PendingRoll = { id: newId(state, "roll"), ...roll };
  state.pendingRolls.push(pending);
  return pending;
}

function describePending(state: GameState, r: PendingRoll): string {
  const who = nameOf(state, r.characterId);
  const mod = r.modifier ? ` ${formatModifier(r.modifier)}` : "";
  const dc = r.dc !== undefined ? ` (CD ${r.dc})` : "";
  return `In attesa: ${who} tira ${r.dice}${mod} — ${r.label}${dc}.`;
}

export interface CheckRequest {
  characterId: string;
  kind: "check" | "save";
  ability: Ability;
  /** Per le prove: il personaggio è competente nell'abilità richiesta (es. Furtività per un ladro). */
  proficient?: boolean;
  dc?: number;
  /** Cosa sta tentando, es. "Prova di Destrezza (Furtività) per superare le guardie". */
  label?: string;
}

export function requestRoll(state: GameState, req: CheckRequest): ActionResult {
  const s = clone(state);
  const c = getCharacter(s, req.characterId);
  if (c.status !== "ok") throw new GameError(`${c.name} non è in grado di agire (${c.status}).`);
  const isProficient = req.kind === "save" ? c.savingThrows.includes(req.ability) : !!req.proficient;
  const modifier = abilityModifier(c.abilities[req.ability]) + (isProficient ? c.proficiencyBonus : 0);
  const base = `${req.kind === "save" ? "Tiro salvezza" : "Prova"} di ${ABILITY_LABELS[req.ability]}`;
  const pending = addPending(s, {
    characterId: c.id,
    kind: req.kind,
    dice: "d20",
    modifier,
    label: req.label ? `${base}: ${req.label}` : base,
    ...(req.dc !== undefined ? { dc: req.dc } : {}),
  });
  return { state: s, message: describePending(s, pending) };
}

function findAttack(c: Character, attackName: string): Attack {
  const a = c.attacks.find((x) => x.name.toLowerCase() === attackName.toLowerCase());
  if (!a) {
    throw new GameError(
      `${c.name} non ha l'attacco "${attackName}". Disponibili: ${c.attacks.map((x) => x.name).join(", ")}.`,
    );
  }
  return a;
}

/**
 * Un personaggio attacca. Con un attacco normale crea un tiro per colpire in attesa
 * (e consuma la munizione); con un trucchetto a tiro salvezza il TS del nemico lo tira il DM.
 */
export function requestAttack(
  state: GameState,
  req: { characterId: string; attackName: string; targetId: string },
  rng: Rng = Math.random,
): ActionResult {
  const s = clone(state);
  const c = getCharacter(s, req.characterId);
  if (c.status !== "ok") throw new GameError(`${c.name} non è in grado di agire (${c.status}).`);
  const attack = findAttack(c, req.attackName);
  const target = getCreature(s, req.targetId);
  const targetName = target.kind === "pc" ? target.c.name : target.e.name;

  const messages: string[] = [];
  if (attack.ammoItemId) messages.push(useItemInPlace(s, c.id, attack.ammoItemId, 1));

  if (attack.save && attack.saveDc !== undefined) {
    // Il bersaglio tira il TS: se è un nemico lo tira il DM (motore), se è un PG è un tiro in attesa.
    if (target.kind === "enemy") {
      const mod = target.e.saves?.[attack.save] ?? 0;
      const natural = rollDie(20, rng);
      const { total, success } = resolveCheck(natural, mod, attack.saveDc);
      if (success) {
        messages.push(`${targetName} supera il TS di ${ABILITY_LABELS[attack.save]} (${total} vs CD ${attack.saveDc}): ${attack.name} non ha effetto.`);
        return { state: s, message: messages.join(" ") };
      }
      messages.push(`${targetName} fallisce il TS di ${ABILITY_LABELS[attack.save]} (${total} vs CD ${attack.saveDc}).`);
      const dmg = parseDice(attack.damage);
      const pending = addPending(s, {
        characterId: c.id,
        kind: "damage",
        dice: diceOnly(attack.damage),
        modifier: dmg.bonus,
        label: `Danni di ${attack.name} contro ${targetName}`,
        targetId: req.targetId,
        attackName: attack.name,
      });
      messages.push(describePending(s, pending));
      return { state: s, message: messages.join(" ") };
    }
    throw new GameError("Trucchetti a tiro salvezza contro altri personaggi: gestiscili con requestRoll + applyDamage.");
  }

  const pending = addPending(s, {
    characterId: c.id,
    kind: "attack",
    dice: "d20",
    modifier: attack.toHit,
    label: `Attacco con ${attack.name} contro ${targetName}`,
    targetId: req.targetId,
    attackName: attack.name,
  });
  messages.push(describePending(s, pending));
  return { state: s, message: messages.join(" ") };
}

/** Il giocatore comunica la somma dei dadi tirati (senza bonus: li aggiunge il motore). */
export function submitRoll(state: GameState, rollId: string, raw: number): ActionResult {
  const s = clone(state);
  const pending = s.pendingRolls.find((r) => r.id === rollId);
  if (!pending) throw new GameError(`Nessun tiro in attesa con id ${rollId}.`);
  if (!Number.isInteger(raw)) throw new GameError(`Il risultato deve essere un numero intero.`);
  const [min, max] = diceRange(pending.dice);
  if (raw < min || raw > max) {
    throw new GameError(`Risultato impossibile per ${pending.dice}: deve essere tra ${min} e ${max}.`);
  }
  s.pendingRolls = s.pendingRolls.filter((r) => r.id !== rollId);

  const who = nameOf(s, pending.characterId);
  let total = raw + pending.modifier;
  let outcome: string;

  switch (pending.kind) {
    case "check":
    case "save": {
      const { success } = resolveCheck(raw, pending.modifier, pending.dc);
      const nat = raw === 20 ? " (20 naturale!)" : raw === 1 ? " (1 naturale!)" : "";
      outcome =
        success === undefined
          ? `${who}: ${pending.label} = ${total}${nat}.`
          : `${who}: ${pending.label} = ${total} contro CD ${pending.dc} → ${success ? "SUCCESSO" : "FALLIMENTO"}${nat}.`;
      break;
    }

    case "initiative": {
      const combat = s.combat;
      if (!combat) throw new GameError("Nessun combattimento in corso.");
      const entry = combat.order.find((o) => o.id === pending.characterId);
      if (entry) entry.initiative = total;
      outcome = `${who} ha iniziativa ${total}.`;
      if (combat.order.every((o) => o.initiative !== null)) {
        sortInitiative(s);
        outcome += ` Ordine di iniziativa: ${describeOrder(s)}. Tocca a ${nameOf(s, combat.order[0].id)}.`;
      }
      break;
    }

    case "attack": {
      const c = getCharacter(s, pending.characterId);
      const attack = findAttack(c, pending.attackName ?? "");
      const target = getCreature(s, pending.targetId ?? "");
      const ac = target.kind === "pc" ? target.c.ac : target.e.ac;
      const targetName = target.kind === "pc" ? target.c.name : target.e.name;
      const r = resolveAttack(raw, pending.modifier, ac);
      total = r.total;
      if (!r.hit) {
        outcome = `${who} attacca ${targetName} con ${attack.name}: ${r.total}${r.fumble ? " (1 naturale)" : ""} contro CA ${ac} → MANCATO.`;
        break;
      }
      const dmg = parseDice(attack.damage);
      const dice = r.critical ? diceOnly(doubleDice(attack.damage)) : diceOnly(attack.damage);
      const dmgRoll = addPending(s, {
        characterId: c.id,
        kind: "damage",
        dice,
        modifier: dmg.bonus,
        label: `Danni di ${attack.name} contro ${targetName}${r.critical ? " (CRITICO)" : ""}`,
        targetId: pending.targetId,
        attackName: attack.name,
        critical: r.critical,
      });
      outcome = `${who} attacca ${targetName} con ${attack.name}: ${r.total} contro CA ${ac} → ${r.critical ? "COLPO CRITICO" : "COLPITO"}. ${describePending(s, dmgRoll)}`;
      break;
    }

    case "damage": {
      total = Math.max(0, total);
      outcome = `${who}: ${pending.label} = ${total}. ` + damageInPlace(s, pending.targetId ?? "", total);
      break;
    }

    case "ammoRecovery": {
      const c = getCharacter(s, pending.characterId);
      const spent = pending.ammoSpent ?? 0;
      // Regola della casa: si recupera una parte proporzionale al d20 (20 = tutto).
      const recovered = Math.floor((spent * raw) / 20);
      const item = c.inventory.find((i) => i.id === pending.ammoItemId);
      if (item && recovered > 0) item.qty += recovered;
      outcome = `${who} recupera ${recovered} su ${spent} ${item?.name.toLowerCase() ?? "munizioni"} (d20 = ${raw}).`;
      break;
    }
  }

  const record: RollRecord = {
    rollId,
    characterId: pending.characterId,
    kind: pending.kind,
    label: pending.label,
    raw,
    total,
    outcome,
  };
  s.rollLog = [...s.rollLog, record].slice(-ROLL_LOG_LIMIT);
  return { state: s, message: outcome };
}

export function cancelRoll(state: GameState, rollId: string): ActionResult {
  const s = clone(state);
  const before = s.pendingRolls.length;
  s.pendingRolls = s.pendingRolls.filter((r) => r.id !== rollId);
  if (s.pendingRolls.length === before) throw new GameError(`Nessun tiro in attesa con id ${rollId}.`);
  return { state: s, message: `Tiro ${rollId} annullato.` };
}

// ---------------------------------------------------------------------------
// Combattimento
// ---------------------------------------------------------------------------

export interface EnemyInput {
  name: string;
  maxHp: number;
  ac: number;
  initiativeBonus?: number;
  attacks: Array<{
    name: string;
    toHit: number;
    damage: string;
    damageType: string;
    kind?: Attack["kind"];
    save?: Ability;
    saveDc?: number;
  }>;
  saves?: Enemy["saves"];
  tactics?: string;
}

function sortInitiative(state: GameState) {
  const combat = state.combat;
  if (!combat) return;
  const bonus = (id: string) => {
    const t = getCreature(state, id);
    return t.kind === "pc" ? t.c.initiativeBonus : t.e.initiativeBonus;
  };
  combat.order.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0) || bonus(b.id) - bonus(a.id));
  combat.turnIndex = 0;
  combat.round = 1;
}

function describeOrder(state: GameState): string {
  return (state.combat?.order ?? []).map((o) => `${nameOf(state, o.id)} (${o.initiative})`).join(", ");
}

/**
 * Inizia uno scontro: crea i nemici, tira la loro iniziativa (lato DM) e chiede
 * ai giocatori il tiro di iniziativa con i dadi fisici.
 */
export function startCombat(state: GameState, enemies: EnemyInput[], rng: Rng = Math.random): ActionResult {
  if (state.combat) throw new GameError("C'è già un combattimento in corso.");
  if (enemies.length === 0) throw new GameError("Servono almeno un nemico.");
  const s = clone(state);

  const created: Enemy[] = enemies.map((e) => {
    for (const a of e.attacks) parseDice(a.damage); // validazione
    return {
      id: newId(s, "enemy"),
      name: e.name,
      maxHp: e.maxHp,
      hp: e.maxHp,
      ac: e.ac,
      initiativeBonus: e.initiativeBonus ?? 0,
      attacks: e.attacks.map((a) => ({
        name: a.name,
        kind: a.kind ?? "melee",
        toHit: a.toHit,
        damage: a.damage,
        damageType: a.damageType,
        ...(a.save ? { save: a.save, saveDc: a.saveDc ?? 10 } : {}),
      })),
      ...(e.saves ? { saves: e.saves } : {}),
      ...(e.tactics ? { tactics: e.tactics } : {}),
      status: "ok" as const,
    };
  });
  s.enemies = created;

  const pcs = s.characters.filter((c) => c.status !== "dead");
  s.combat = {
    round: 0,
    turnIndex: 0,
    ammoSpent: {},
    order: [
      ...pcs.map((c) => ({ id: c.id, side: "pc" as const, initiative: null })),
      ...created.map((e) => ({ id: e.id, side: "enemy" as const, initiative: rollDie(20, rng) + e.initiativeBonus })),
    ],
  };

  const waiting = pcs.map((c) =>
    addPending(s, {
      characterId: c.id,
      kind: "initiative",
      dice: "d20",
      modifier: c.initiativeBonus,
      label: "Iniziativa",
    }),
  );

  const enemyList = created.map((e) => `${e.name} [${e.id}]`).join(", ");
  const msg = `Combattimento iniziato contro: ${enemyList}. ` + waiting.map((r) => describePending(s, r)).join(" ");
  if (waiting.length === 0) sortInitiative(s);
  return { state: s, message: msg };
}

/** Un nemico attacca un personaggio: il DM (motore) tira per colpire e i danni. */
export function enemyAttack(
  state: GameState,
  req: { enemyId: string; targetId: string; attackName?: string },
  rng: Rng = Math.random,
): ActionResult {
  const s = clone(state);
  const e = getEnemy(s, req.enemyId);
  if (e.status !== "ok") throw new GameError(`${e.name} è sconfitto e non può attaccare.`);
  const target = getCharacter(s, req.targetId);
  const attack = req.attackName
    ? e.attacks.find((a) => a.name.toLowerCase() === req.attackName!.toLowerCase())
    : e.attacks[0];
  if (!attack) throw new GameError(`${e.name} non ha l'attacco "${req.attackName}".`);

  if (attack.save && attack.saveDc !== undefined) {
    const pending = addPending(s, {
      characterId: target.id,
      kind: "save",
      dice: "d20",
      modifier:
        abilityModifier(target.abilities[attack.save]) +
        (target.savingThrows.includes(attack.save) ? target.proficiencyBonus : 0),
      dc: attack.saveDc,
      label: `Tiro salvezza di ${ABILITY_LABELS[attack.save]} contro ${attack.name} di ${e.name}`,
    });
    return {
      state: s,
      message: `${e.name} usa ${attack.name} su ${target.name}. ${describePending(s, pending)} Se fallisce, usa applyDamage (${attack.damage} ${attack.damageType}).`,
    };
  }

  const natural = rollDie(20, rng);
  const r = resolveAttack(natural, attack.toHit, target.ac);
  if (!r.hit) {
    return {
      state: s,
      message: `${e.name} attacca ${target.name} con ${attack.name}: ${r.total} contro CA ${target.ac} → MANCATO.`,
    };
  }
  const dmg = rollDice(r.critical ? doubleDice(attack.damage) : attack.damage, rng);
  const amount = Math.max(0, dmg.total);
  const hitMsg = `${e.name} attacca ${target.name} con ${attack.name}: ${r.total} contro CA ${target.ac} → ${r.critical ? "COLPO CRITICO" : "COLPITO"}, ${amount} danni ${attack.damageType}.`;
  return { state: s, message: `${hitMsg} ${damageInPlace(s, target.id, amount)}` };
}

function isActive(state: GameState, id: string): boolean {
  const t = getCreature(state, id);
  return t.kind === "pc" ? t.c.status !== "dead" : t.e.status === "ok";
}

export function nextTurn(state: GameState): ActionResult {
  const s = clone(state);
  const combat = s.combat;
  if (!combat) throw new GameError("Nessun combattimento in corso.");
  if (combat.order.some((o) => o.initiative === null)) {
    throw new GameError("Mancano ancora dei tiri di iniziativa.");
  }
  if (!s.enemies.some((e) => e.status === "ok")) {
    return { state: s, message: "Tutti i nemici sono sconfitti: chiudi lo scontro con endCombat." };
  }
  if (!combat.order.some((o) => isActive(s, o.id))) throw new GameError("Nessun combattente attivo.");

  do {
    combat.turnIndex += 1;
    if (combat.turnIndex >= combat.order.length) {
      combat.turnIndex = 0;
      combat.round += 1;
    }
  } while (!isActive(s, combat.order[combat.turnIndex].id));

  const current = combat.order[combat.turnIndex];
  return { state: s, message: `Round ${combat.round}: tocca a ${nameOf(s, current.id)} [${current.id}].` };
}

/** Chiude lo scontro e chiede a chi ha scagliato munizioni un d20 per recuperarle. */
export function endCombat(state: GameState): ActionResult {
  const s = clone(state);
  const combat = s.combat;
  if (!combat) throw new GameError("Nessun combattimento in corso.");

  // I tiri legati allo scontro non hanno più senso.
  s.pendingRolls = s.pendingRolls.filter((r) => !["initiative", "attack", "damage"].includes(r.kind));
  s.enemies = []; // se qualcuno è fuggito, il DM lo ricrea in un nuovo startCombat
  s.combat = null;

  const recovery: PendingRoll[] = [];
  for (const [characterId, items] of Object.entries(combat.ammoSpent)) {
    for (const [itemId, spent] of Object.entries(items)) {
      if (spent <= 0) continue;
      const c = getCharacter(s, characterId);
      const item = c.inventory.find((i) => i.id === itemId);
      recovery.push(
        addPending(s, {
          characterId,
          kind: "ammoRecovery",
          dice: "d20",
          modifier: 0,
          label: `Recupero ${item?.name.toLowerCase() ?? itemId} (${spent} scagliate)`,
          ammoItemId: itemId,
          ammoSpent: spent,
        }),
      );
    }
  }

  const msg = recovery.length
    ? `Scontro terminato. ${recovery.map((r) => describePending(s, r)).join(" ")}`
    : "Scontro terminato.";
  return { state: s, message: msg };
}
