import { describe, expect, it } from "vitest";
import {
  applyDamage,
  createCharacter,
  createGameState,
  endCombat,
  enemyAttack,
  getCharacter,
  getEnemy,
  GameError,
  heal,
  nextTurn,
  requestAttack,
  requestRoll,
  startCombat,
  submitRoll,
  useItem,
  type EnemyInput,
  type GameState,
  type Rng,
} from "./index";
import { abilityModifier, diceRange, doubleDice, parseDice, proficiencyBonus, resolveAttack } from "./rules";

/** Rng che produce esattamente i risultati di d20 (o di altri dadi) indicati. */
function dice(...faces: Array<[number, number]>): Rng {
  const queue = faces.map(([face, sides]) => (face - 1) / sides + 0.001);
  return () => {
    const v = queue.shift();
    if (v === undefined) throw new Error("Rng esaurito");
    return v;
  };
}

const goblin: EnemyInput = {
  name: "Goblin",
  maxHp: 7,
  ac: 15,
  initiativeBonus: 2,
  attacks: [{ name: "Scimitarra", toHit: 4, damage: "1d6+2", damageType: "tagliente" }],
};

function party(): GameState {
  return createGameState([
    createCharacter({ id: "pc-thorin", player: "Matteo", name: "Thorin", sex: "M", race: "dwarf", class: "fighter" }),
    createCharacter({ id: "pc-lyra", player: "Giulia", name: "Lyra", sex: "F", race: "elf", class: "ranger" }),
  ]);
}

describe("regole", () => {
  it("modificatori e competenza", () => {
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(15)).toBe(2);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(1)).toBe(-5);
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(17)).toBe(6);
  });

  it("dadi", () => {
    expect(parseDice("2d6+3")).toEqual({ count: 2, sides: 6, bonus: 3 });
    expect(parseDice("d20")).toEqual({ count: 1, sides: 20, bonus: 0 });
    expect(doubleDice("1d8+3")).toBe("2d8+3");
    expect(diceRange("2d6")).toEqual([2, 12]);
    expect(() => parseDice("3d7")).toThrow(GameError);
  });

  it("20 naturale colpisce sempre, 1 naturale manca sempre", () => {
    expect(resolveAttack(20, -5, 30).hit).toBe(true);
    expect(resolveAttack(20, 0, 10).critical).toBe(true);
    expect(resolveAttack(1, 20, 5).hit).toBe(false);
  });
});

describe("creazione personaggi", () => {
  it("guerriero nano", () => {
    const c = createCharacter({ id: "a", player: "Matteo", name: "Thorin", sex: "M", race: "dwarf", class: "fighter" });
    expect(c.abilities.str).toBe(15);
    expect(c.abilities.con).toBe(16); // 14 + 2 razziale
    expect(c.maxHp).toBe(13); // d10 + 3
    expect(c.ac).toBe(18); // cotta di maglia 16 + scudo 2
    expect(c.speed).toBe(25);
    const sword = c.attacks.find((a) => a.name === "Spada lunga")!;
    expect(sword.toHit).toBe(4);
    expect(sword.damage).toBe("1d8+2");
    expect(c.inventory.find((i) => i.id === "quadrelli")?.qty).toBe(20);
    expect(c.features).toHaveLength(2);
  });

  it("ranger elfo usa la Destrezza con l'arco", () => {
    const c = createCharacter({ id: "b", player: "Giulia", name: "Lyra", sex: "F", race: "elf", class: "ranger" });
    expect(c.abilities.dex).toBe(17);
    expect(c.ac).toBe(14); // cuoio 11 + 3
    const bow = c.attacks.find((a) => a.name === "Arco lungo")!;
    expect(bow.toHit).toBe(5);
    expect(bow.damage).toBe("1d8+3");
    expect(bow.ammoItemId).toBe("frecce");
    expect(c.initiativeBonus).toBe(3);
  });

  it("mago umano ha il trucchetto senza bonus ai danni", () => {
    const c = createCharacter({ id: "c", player: "Luca", name: "Elrond", sex: "M", race: "human", class: "wizard" });
    expect(c.abilities.int).toBe(16);
    const bolt = c.attacks.find((a) => a.kind === "spell")!;
    expect(bolt.toHit).toBe(5);
    expect(bolt.damage).toBe("1d10");
    expect(c.spellcasting?.saveDc).toBe(13);
  });

  it("mezzelfo: +1 alle due caratteristiche principali della classe", () => {
    const c = createCharacter({ id: "d", player: "Sara", name: "Aria", sex: "F", race: "half-elf", class: "rogue" });
    expect(c.abilities.dex).toBe(16); // 15 + 1
    expect(c.abilities.con).toBe(15); // 14 + 1
    expect(c.abilities.cha).toBe(12); // 10 + 2
  });

  it("chierico: trucchetto a tiro salvezza", () => {
    const c = createCharacter({ id: "e", player: "Anna", name: "Mira", sex: "F", race: "human", class: "cleric" });
    const flame = c.attacks.find((a) => a.kind === "spell")!;
    expect(flame.save).toBe("dex");
    expect(flame.saveDc).toBe(13);
  });
});

describe("punti vita", () => {
  it("i PV temporanei assorbono prima il danno", () => {
    let s = party();
    s.characters[0].tempHp = 5;
    s = applyDamage(s, "pc-thorin", 8).state;
    const t = getCharacter(s, "pc-thorin");
    expect(t.tempHp).toBe(0);
    expect(t.hp).toBe(10);
  });

  it("a 0 PV cade privo di sensi; danno massiccio uccide", () => {
    let s = party();
    s = applyDamage(s, "pc-thorin", 13).state;
    expect(getCharacter(s, "pc-thorin").status).toBe("down");
    s = heal(s, "pc-thorin", 4).state;
    expect(getCharacter(s, "pc-thorin").status).toBe("ok");
    s = applyDamage(s, "pc-thorin", 4 + 13).state;
    expect(getCharacter(s, "pc-thorin").status).toBe("dead");
  });

  it("le azioni non modificano lo stato originale", () => {
    const s = party();
    applyDamage(s, "pc-thorin", 5);
    expect(getCharacter(s, "pc-thorin").hp).toBe(13);
  });
});

describe("inventario", () => {
  it("non si possono usare oggetti che non si hanno", () => {
    const s = party();
    expect(() => useItem(s, "pc-lyra", "frecce", 21)).toThrow(GameError);
    expect(() => useItem(s, "pc-lyra", "pozione", 1)).toThrow(GameError);
    expect(useItem(s, "pc-lyra", "torce", 1).state.characters[1].inventory.find((i) => i.id === "torce")?.qty).toBe(2);
  });
});

describe("prove", () => {
  it("prova con CD e competenza", () => {
    let s = party();
    const r = requestRoll(s, { characterId: "pc-lyra", kind: "check", ability: "dex", proficient: true, dc: 15, label: "Furtività" });
    s = r.state;
    const pending = s.pendingRolls[0];
    expect(pending.modifier).toBe(5);
    expect(() => submitRoll(s, pending.id, 21)).toThrow(GameError);
    const res = submitRoll(s, pending.id, 10);
    expect(res.message).toContain("SUCCESSO");
    expect(res.state.pendingRolls).toHaveLength(0);
    expect(res.state.rollLog).toHaveLength(1);
  });

  it("i tiri salvezza usano la competenza della classe", () => {
    const s = requestRoll(party(), { characterId: "pc-thorin", kind: "save", ability: "con", dc: 12 }).state;
    expect(s.pendingRolls[0].modifier).toBe(5); // +3 Cos +2 competenza
  });
});

describe("combattimento", () => {
  function inCombat(): GameState {
    // Goblin: iniziativa 10 + 2 = 12
    let s = startCombat(party(), [goblin], dice([10, 20])).state;
    const [thorinInit, lyraInit] = s.pendingRolls;
    s = submitRoll(s, thorinInit.id, 5).state; // 5 + 1 = 6
    s = submitRoll(s, lyraInit.id, 15).state; // 15 + 3 = 18
    return s;
  }

  it("ordine di iniziativa dopo i tiri dei giocatori", () => {
    const s = inCombat();
    expect(s.combat?.order.map((o) => o.id)).toEqual(["pc-lyra", "enemy-1", "pc-thorin"]);
    expect(s.combat?.round).toBe(1);
  });

  it("attacco con arco: consuma una freccia, colpisce, poi i danni", () => {
    let s = inCombat();
    s = requestAttack(s, { characterId: "pc-lyra", attackName: "Arco lungo", targetId: "enemy-1" }).state;
    expect(getCharacter(s, "pc-lyra").inventory.find((i) => i.id === "frecce")?.qty).toBe(19);

    const attackRoll = s.pendingRolls[0];
    s = submitRoll(s, attackRoll.id, 12).state; // 12 + 5 = 17 >= CA 15
    const dmgRoll = s.pendingRolls[0];
    expect(dmgRoll.kind).toBe("damage");
    expect(dmgRoll.dice).toBe("1d8");
    expect(dmgRoll.modifier).toBe(3);

    s = submitRoll(s, dmgRoll.id, 4).state; // 4 + 3 = 7: goblin a 0
    expect(getEnemy(s, "enemy-1").status).toBe("defeated");
  });

  it("il critico raddoppia i dadi", () => {
    let s = inCombat();
    s = requestAttack(s, { characterId: "pc-thorin", attackName: "spada lunga", targetId: "enemy-1" }).state;
    s = submitRoll(s, s.pendingRolls[0].id, 20).state;
    expect(s.pendingRolls[0].dice).toBe("2d8");
    expect(s.pendingRolls[0].critical).toBe(true);
  });

  it("1 naturale manca", () => {
    let s = inCombat();
    s = requestAttack(s, { characterId: "pc-thorin", attackName: "Spada lunga", targetId: "enemy-1" }).state;
    const res = submitRoll(s, s.pendingRolls[0].id, 1);
    expect(res.message).toContain("MANCATO");
    expect(res.state.pendingRolls).toHaveLength(0);
  });

  it("i nemici contrattaccano (tiri lato DM)", () => {
    const s = inCombat();
    // d20 = 15 -> 19 contro CA 14: colpito; d6 = 3 -> 5 danni
    const res = enemyAttack(s, { enemyId: "enemy-1", targetId: "pc-lyra" }, dice([15, 20], [3, 6]));
    expect(res.message).toContain("COLPITO");
    expect(getCharacter(res.state, "pc-lyra").hp).toBe(getCharacter(s, "pc-lyra").hp - 5);
  });

  it("turni e round", () => {
    let s = inCombat();
    s = nextTurn(s).state;
    expect(s.combat?.turnIndex).toBe(1);
    s = nextTurn(s).state;
    s = nextTurn(s).state;
    expect(s.combat?.round).toBe(2);
    expect(s.combat?.turnIndex).toBe(0);
  });

  it("a fine scontro si recuperano le frecce con un d20", () => {
    let s = inCombat();
    for (let i = 0; i < 4; i++) {
      s = requestAttack(s, { characterId: "pc-lyra", attackName: "Arco lungo", targetId: "enemy-1" }).state;
      s = submitRoll(s, s.pendingRolls[0].id, 2).state; // manca sempre
    }
    expect(getCharacter(s, "pc-lyra").inventory.find((i) => i.id === "frecce")?.qty).toBe(16);

    s = endCombat(s).state;
    expect(s.combat).toBeNull();
    const recovery = s.pendingRolls[0];
    expect(recovery.kind).toBe("ammoRecovery");
    expect(recovery.ammoSpent).toBe(4);

    s = submitRoll(s, recovery.id, 10).state; // 4 * 10 / 20 = 2
    expect(getCharacter(s, "pc-lyra").inventory.find((i) => i.id === "frecce")?.qty).toBe(18);
  });

  it("non si scaglia senza munizioni", () => {
    let s = inCombat();
    s.characters[1].inventory.find((i) => i.id === "frecce")!.qty = 0;
    expect(() => requestAttack(s, { characterId: "pc-lyra", attackName: "Arco lungo", targetId: "enemy-1" })).toThrow(
      GameError,
    );
  });
});
