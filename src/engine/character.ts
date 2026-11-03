import { GameError } from "./errors";
import { abilityModifier, parseDice, proficiencyBonus, formatDice } from "./rules";
import {
  CANTRIPS,
  CLASSES,
  COMMON_ITEMS,
  RACES,
  STANDARD_ARRAY,
  WEAPONS,
  type CantripData,
  type ClassData,
  type ClassId,
  type RaceData,
  type RaceId,
  type WeaponData,
} from "./srd";
import { ABILITIES, type Ability, type AbilityScores, type Attack, type Character, type Item } from "./state";

export interface NewCharacterInput {
  id: string;
  player: string;
  name: string;
  sex: string;
  race: RaceId;
  class: ClassId;
}

/** Serie standard assegnata secondo le priorità della classe, poi bonus razziali. */
export function rollAbilities(race: RaceId, cls: ClassId): AbilityScores {
  const raceData: RaceData = RACES[race];
  const classData: ClassData = CLASSES[cls];
  const scores = {} as AbilityScores;
  classData.priority.forEach((ability, i) => {
    scores[ability] = STANDARD_ARRAY[i];
  });
  for (const a of ABILITIES) scores[a] += raceData.bonuses[a] ?? 0;

  if (raceData.flexibleBonuses) {
    // Mezzelfo: +1 alle caratteristiche più importanti per la classe che non hanno già un bonus.
    const picks = classData.priority.filter((a) => !raceData.bonuses[a]).slice(0, raceData.flexibleBonuses);
    for (const a of picks) scores[a] += 1;
  }
  return scores;
}

function computeAc(classData: ClassData, mods: Record<Ability, number>): number {
  let ac: number;
  switch (classData.armor) {
    case "leather":
      ac = 11 + mods.dex;
      break;
    case "scale":
      ac = 14 + Math.min(mods.dex, 2);
      break;
    case "chain":
      ac = 16;
      break;
    case "none":
      ac = 10 + mods.dex + (classData.unarmoredAbility ? mods[classData.unarmoredAbility] : 0);
      break;
  }
  return ac + (classData.shield ? 2 : 0);
}

function withBonus(dice: string, bonus: number): string {
  return formatDice({ ...parseDice(dice), bonus });
}

function weaponAttack(w: WeaponData, mods: Record<Ability, number>, prof: number): Attack {
  const ability: Ability =
    w.kind === "ranged" && !w.finesse ? "dex" : w.finesse ? (mods.dex >= mods.str ? "dex" : "str") : "str";
  const mod = mods[ability];
  return {
    name: w.label,
    kind: w.kind,
    toHit: prof + mod,
    damage: withBonus(w.damage, mod),
    damageType: w.damageType,
    ...(w.ammoItemId ? { ammoItemId: w.ammoItemId } : {}),
  };
}

function cantripAttack(c: CantripData, ability: Ability, mods: Record<Ability, number>, prof: number): Attack {
  return {
    name: c.label,
    kind: "spell",
    toHit: prof + mods[ability],
    // I trucchetti di 1° livello non aggiungono il modificatore ai danni.
    damage: c.damage,
    damageType: c.damageType,
    ...(c.save ? { save: c.save, saveDc: 8 + prof + mods[ability] } : {}),
  };
}

function mergeItems(items: Item[]): Item[] {
  const byId = new Map<string, Item>();
  for (const it of items) {
    const existing = byId.get(it.id);
    if (existing) existing.qty += it.qty;
    else byId.set(it.id, { ...it });
  }
  return [...byId.values()];
}

/** Crea un personaggio di 1° livello coerente con l'SRD 5.1. */
export function createCharacter(input: NewCharacterInput): Character {
  if (!(input.race in RACES)) throw new GameError(`Razza sconosciuta: ${input.race}`);
  if (!(input.class in CLASSES)) throw new GameError(`Classe sconosciuta: ${input.class}`);

  const raceData: RaceData = RACES[input.race];
  const classData: ClassData = CLASSES[input.class];
  const level = 1;
  const prof = proficiencyBonus(level);
  const abilities = rollAbilities(input.race, input.class);
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, abilityModifier(abilities[a])])) as Record<Ability, number>;

  const attacks: Attack[] = classData.weapons.map((id) => weaponAttack(WEAPONS[id], mods, prof));
  let spellcasting: Character["spellcasting"];
  if (classData.cantrip && classData.spellcastingAbility) {
    const ability = classData.spellcastingAbility;
    attacks.push(cantripAttack(CANTRIPS[classData.cantrip], ability, mods, prof));
    spellcasting = {
      ability,
      attackBonus: prof + mods[ability],
      saveDc: 8 + prof + mods[ability],
      notes: classData.spellNotes ?? "",
    };
  }

  const maxHp = Math.max(1, classData.hitDie + mods.con);

  return {
    id: input.id,
    player: input.player,
    name: input.name,
    sex: input.sex,
    race: raceData.label,
    class: classData.label,
    level,
    abilities,
    proficiencyBonus: prof,
    savingThrows: [...classData.savingThrows],
    maxHp,
    hp: maxHp,
    tempHp: 0,
    ac: computeAc(classData, mods),
    speed: raceData.speed,
    initiativeBonus: mods.dex,
    attacks,
    inventory: mergeItems([...classData.items, ...COMMON_ITEMS]),
    features: [raceData.feature, classData.feature],
    strength: classData.strength,
    weakness: classData.weakness,
    ...(spellcasting ? { spellcasting } : {}),
    conditions: [],
    status: "ok",
  };
}
