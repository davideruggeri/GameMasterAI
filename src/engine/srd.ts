import type { Ability } from "./state";

// Dati di gioco ridotti presi dall'SRD 5.1 (CC-BY-4.0), vedi README.
// Volutamente essenziali: bastano per creare personaggi di 1° livello giocabili.

// ---------------------------------------------------------------------------
// Razze
// ---------------------------------------------------------------------------

export interface RaceData {
  label: string;
  bonuses: Partial<Record<Ability, number>>;
  /** Mezzelfo: +1 a due caratteristiche a scelta (scelte in base alla classe). */
  flexibleBonuses?: number;
  speed: number;
  feature: string;
}

export const RACES = {
  human: {
    label: "Umano",
    bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 30,
    feature: "Versatilità umana: +1 a tutte le caratteristiche e una lingua extra",
  },
  elf: {
    label: "Elfo",
    bonuses: { dex: 2 },
    speed: 30,
    feature: "Scurovisione (18 m) e Ascendenza fatata: vantaggio ai TS contro charme, immune al sonno magico",
  },
  dwarf: {
    label: "Nano",
    bonuses: { con: 2 },
    speed: 25,
    feature: "Resilienza nanica: vantaggio ai TS contro il veleno e resistenza ai danni da veleno",
  },
  halfling: {
    label: "Halfling",
    bonuses: { dex: 2 },
    speed: 25,
    feature: "Fortunato: quando ottiene 1 naturale su attacco, prova o TS può ritirare il dado",
  },
  gnome: {
    label: "Gnomo",
    bonuses: { int: 2 },
    speed: 25,
    feature: "Astuzia gnomesca: vantaggio ai TS di Intelligenza, Saggezza e Carisma contro la magia",
  },
  "half-elf": {
    label: "Mezzelfo",
    bonuses: { cha: 2 },
    flexibleBonuses: 2,
    speed: 30,
    feature: "Scurovisione (18 m) e Ascendenza fatata: vantaggio ai TS contro charme",
  },
  "half-orc": {
    label: "Mezzorco",
    bonuses: { str: 2, con: 1 },
    speed: 30,
    feature: "Tenacia implacabile: una volta per riposo lungo, se scende a 0 PV resta invece a 1 PV",
  },
  tiefling: {
    label: "Tiefling",
    bonuses: { cha: 2, int: 1 },
    speed: 30,
    feature: "Resistenza infernale: resistenza ai danni da fuoco; scurovisione (18 m)",
  },
  dragonborn: {
    label: "Dragonide",
    bonuses: { str: 2, cha: 1 },
    speed: 30,
    feature: "Arma a soffio: 2d6 danni in area (TS CD 8 + Cos + competenza), una volta per riposo",
  },
} satisfies Record<string, RaceData>;

export type RaceId = keyof typeof RACES;
export const RACE_IDS = Object.keys(RACES) as RaceId[];

// ---------------------------------------------------------------------------
// Armi e trucchetti
// ---------------------------------------------------------------------------

export interface WeaponData {
  label: string;
  damage: string;
  damageType: string;
  kind: "melee" | "ranged";
  /** Può usare Forza o Destrezza (la migliore). */
  finesse?: boolean;
  /** Oggetto dell'inventario consumato a ogni attacco. */
  ammoItemId?: string;
}

export const WEAPONS = {
  greataxe: { label: "Ascia bipenne", damage: "1d12", damageType: "tagliente", kind: "melee" },
  handaxe: { label: "Ascia", damage: "1d6", damageType: "tagliente", kind: "melee" },
  rapier: { label: "Stocco", damage: "1d8", damageType: "perforante", kind: "melee", finesse: true },
  dagger: { label: "Pugnale", damage: "1d4", damageType: "perforante", kind: "melee", finesse: true },
  mace: { label: "Mazza", damage: "1d6", damageType: "contundente", kind: "melee" },
  scimitar: { label: "Scimitarra", damage: "1d6", damageType: "tagliente", kind: "melee", finesse: true },
  longsword: { label: "Spada lunga", damage: "1d8", damageType: "tagliente", kind: "melee" },
  shortsword: { label: "Spada corta", damage: "1d6", damageType: "perforante", kind: "melee", finesse: true },
  quarterstaff: { label: "Bastone ferrato", damage: "1d6", damageType: "contundente", kind: "melee" },
  martialArts: { label: "Colpo senz'armi (Arti marziali)", damage: "1d4", damageType: "contundente", kind: "melee", finesse: true },
  javelin: { label: "Giavellotto", damage: "1d6", damageType: "perforante", kind: "ranged", ammoItemId: "giavellotti" },
  dart: { label: "Dardo", damage: "1d4", damageType: "perforante", kind: "ranged", finesse: true, ammoItemId: "dardi" },
  shortbow: { label: "Arco corto", damage: "1d6", damageType: "perforante", kind: "ranged", ammoItemId: "frecce" },
  longbow: { label: "Arco lungo", damage: "1d8", damageType: "perforante", kind: "ranged", ammoItemId: "frecce" },
  lightCrossbow: { label: "Balestra leggera", damage: "1d8", damageType: "perforante", kind: "ranged", ammoItemId: "quadrelli" },
} satisfies Record<string, WeaponData>;

export type WeaponId = keyof typeof WEAPONS;

export interface CantripData {
  label: string;
  damage: string;
  damageType: string;
  /** Se presente, il bersaglio fa un TS invece di un tiro per colpire. */
  save?: Ability;
}

export const CANTRIPS = {
  fireBolt: { label: "Dardo di fuoco", damage: "1d10", damageType: "fuoco" },
  eldritchBlast: { label: "Deflagrazione occulta", damage: "1d10", damageType: "forza" },
  produceFlame: { label: "Produrre fiamma", damage: "1d8", damageType: "fuoco" },
  sacredFlame: { label: "Fiamma sacra", damage: "1d8", damageType: "radioso", save: "dex" },
  viciousMockery: { label: "Scherno crudele", damage: "1d4", damageType: "psichico", save: "wis" },
} satisfies Record<string, CantripData>;

export type CantripId = keyof typeof CANTRIPS;

// ---------------------------------------------------------------------------
// Classi
// ---------------------------------------------------------------------------

export type ArmorId = "none" | "leather" | "scale" | "chain";

export interface StartingItem {
  id: string;
  name: string;
  qty: number;
  ammo?: boolean;
}

export interface ClassData {
  label: string;
  hitDie: number;
  /** Ordine in cui assegnare la serie standard 15, 14, 13, 12, 10, 8. */
  priority: Ability[];
  savingThrows: Ability[];
  armor: ArmorId;
  shield: boolean;
  /** Difesa senza armatura: 10 + Des + questa caratteristica (Barbaro, Monaco). */
  unarmoredAbility?: Ability;
  weapons: WeaponId[];
  cantrip?: CantripId;
  spellcastingAbility?: Ability;
  spellNotes?: string;
  items: StartingItem[];
  feature: string;
  strength: string;
  weakness: string;
}

export const CLASSES = {
  barbarian: {
    label: "Barbaro",
    hitDie: 12,
    priority: ["str", "con", "dex", "wis", "cha", "int"],
    savingThrows: ["str", "con"],
    armor: "none",
    shield: false,
    unarmoredAbility: "con",
    weapons: ["greataxe", "javelin"],
    items: [{ id: "giavellotti", name: "Giavellotti", qty: 4, ammo: true }],
    feature: "Ira (2 volte per riposo lungo): +2 ai danni in mischia e resistenza ai danni contundenti, perforanti e taglienti",
    strength: "Il più resistente del gruppo: tanti PV e Ira",
    weakness: "Nessuna armatura e poca attitudine per prove mentali",
  },
  bard: {
    label: "Bardo",
    hitDie: 8,
    priority: ["cha", "dex", "con", "wis", "int", "str"],
    savingThrows: ["dex", "cha"],
    armor: "leather",
    shield: false,
    weapons: ["rapier", "dagger"],
    cantrip: "viciousMockery",
    spellcastingAbility: "cha",
    spellNotes: "Slot di 1° livello: 2. Incantesimi: Parola guaritrice, Sonno",
    items: [{ id: "liuto", name: "Liuto", qty: 1 }],
    feature: "Ispirazione bardica: concede un d6 bonus a un alleato (Carisma volte per riposo lungo)",
    strength: "Versatile e carismatico, ottimo nei dialoghi",
    weakness: "Fragile in mischia",
  },
  cleric: {
    label: "Chierico",
    hitDie: 8,
    priority: ["wis", "con", "str", "dex", "cha", "int"],
    savingThrows: ["wis", "cha"],
    armor: "scale",
    shield: true,
    weapons: ["mace"],
    cantrip: "sacredFlame",
    spellcastingAbility: "wis",
    spellNotes: "Slot di 1° livello: 2. Incantesimi: Cura ferite (1d8 + Sag), Benedizione",
    items: [{ id: "simbolo-sacro", name: "Simbolo sacro", qty: 1 }],
    feature: "Magia divina: Cura ferite e Benedizione",
    strength: "Cura e protegge il gruppo",
    weakness: "Pochi danni a distanza oltre agli incantesimi",
  },
  druid: {
    label: "Druido",
    hitDie: 8,
    priority: ["wis", "con", "dex", "int", "cha", "str"],
    savingThrows: ["int", "wis"],
    armor: "leather",
    shield: true,
    weapons: ["scimitar"],
    cantrip: "produceFlame",
    spellcastingAbility: "wis",
    spellNotes: "Slot di 1° livello: 2. Incantesimi: Intralciare, Buona bacca",
    items: [{ id: "focus-druidico", name: "Focus druidico", qty: 1 }],
    feature: "Magia della natura: Intralciare e Buona bacca; parla il Druidico",
    strength: "Controlla il terreno e cura",
    weakness: "Pochi PV e niente armature di metallo",
  },
  fighter: {
    label: "Guerriero",
    hitDie: 10,
    priority: ["str", "con", "dex", "wis", "int", "cha"],
    savingThrows: ["str", "con"],
    armor: "chain",
    shield: true,
    weapons: ["longsword", "lightCrossbow"],
    items: [{ id: "quadrelli", name: "Quadrelli", qty: 20, ammo: true }],
    feature: "Recuperare energie: una volta per riposo recupera 1d10 + livello PV",
    strength: "L'armatura migliore del gruppo",
    weakness: "Nessuna magia",
  },
  monk: {
    label: "Monaco",
    hitDie: 8,
    priority: ["dex", "wis", "con", "str", "int", "cha"],
    savingThrows: ["str", "dex"],
    armor: "none",
    shield: false,
    unarmoredAbility: "wis",
    weapons: ["shortsword", "martialArts", "dart"],
    items: [{ id: "dardi", name: "Dardi", qty: 10, ammo: true }],
    feature: "Arti marziali: dopo un attacco può sferrare un colpo senz'armi bonus (1d4)",
    strength: "Veloce e agile",
    weakness: "PV nella media senza armatura",
  },
  paladin: {
    label: "Paladino",
    hitDie: 10,
    priority: ["str", "cha", "con", "wis", "dex", "int"],
    savingThrows: ["wis", "cha"],
    armor: "chain",
    shield: true,
    weapons: ["longsword", "javelin"],
    items: [
      { id: "giavellotti", name: "Giavellotti", qty: 5, ammo: true },
      { id: "simbolo-sacro", name: "Simbolo sacro", qty: 1 },
    ],
    feature: "Imposizione delle mani: riserva di 5 PV da curare al tocco; Senso divino",
    strength: "Resistente e in grado di curare",
    weakness: "Pochi attacchi a distanza",
  },
  ranger: {
    label: "Ranger",
    hitDie: 10,
    priority: ["dex", "wis", "con", "str", "int", "cha"],
    savingThrows: ["str", "dex"],
    armor: "leather",
    shield: false,
    weapons: ["longbow", "shortsword"],
    items: [{ id: "frecce", name: "Frecce", qty: 20, ammo: true }],
    feature: "Esploratore nato: vantaggio a seguire tracce e orientarsi nel terreno prescelto",
    strength: "Ottimo combattente a distanza",
    weakness: "Dipende dalle frecce",
  },
  rogue: {
    label: "Ladro",
    hitDie: 8,
    priority: ["dex", "con", "int", "wis", "cha", "str"],
    savingThrows: ["dex", "int"],
    armor: "leather",
    shield: false,
    weapons: ["shortsword", "shortbow"],
    items: [
      { id: "frecce", name: "Frecce", qty: 20, ammo: true },
      { id: "arnesi-da-scasso", name: "Arnesi da scasso", qty: 1 },
    ],
    feature: "Attacco furtivo: +1d6 danni una volta per turno se ha vantaggio o un alleato vicino al bersaglio",
    strength: "Furtività, serrature e trappole",
    weakness: "Pochi PV, soffre la mischia prolungata",
  },
  sorcerer: {
    label: "Stregone",
    hitDie: 6,
    priority: ["cha", "con", "dex", "wis", "int", "str"],
    savingThrows: ["con", "cha"],
    armor: "none",
    shield: false,
    weapons: ["dagger"],
    cantrip: "fireBolt",
    spellcastingAbility: "cha",
    spellNotes: "Slot di 1° livello: 2. Incantesimi: Dardo incantato, Scudo",
    items: [],
    feature: "Magia innata: lancia incantesimi senza libro, con il Carisma",
    strength: "Grande potenza magica",
    weakness: "Pochissimi PV e niente armatura",
  },
  warlock: {
    label: "Warlock",
    hitDie: 8,
    priority: ["cha", "con", "dex", "wis", "int", "str"],
    savingThrows: ["wis", "cha"],
    armor: "leather",
    shield: false,
    weapons: ["dagger"],
    cantrip: "eldritchBlast",
    spellcastingAbility: "cha",
    spellNotes: "Slot di 1° livello: 1 (si recupera con riposo breve). Incantesimi: Maleficio, Armatura di Agathys",
    items: [],
    feature: "Patto ultraterreno: gli slot incantesimo tornano con un riposo breve",
    strength: "Deflagrazione occulta, attacco a distanza affidabile",
    weakness: "Pochi incantesimi per scontro",
  },
  wizard: {
    label: "Mago",
    hitDie: 6,
    priority: ["int", "con", "dex", "wis", "cha", "str"],
    savingThrows: ["int", "wis"],
    armor: "none",
    shield: false,
    weapons: ["quarterstaff"],
    cantrip: "fireBolt",
    spellcastingAbility: "int",
    spellNotes: "Slot di 1° livello: 2. Libro: Dardo incantato, Scudo, Sonno, Individuazione del magico",
    items: [{ id: "libro-incantesimi", name: "Libro degli incantesimi", qty: 1 }],
    feature: "Recupero arcano e libro degli incantesimi: conosce più incantesimi di tutti",
    strength: "Il repertorio magico più ampio",
    weakness: "Pochissimi PV e niente armatura",
  },
} satisfies Record<string, ClassData>;

export type ClassId = keyof typeof CLASSES;
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

/** Oggetti comuni dati a tutti: corde e torce premiano le idee creative. */
export const COMMON_ITEMS: StartingItem[] = [
  { id: "razioni", name: "Razioni (1 giorno)", qty: 5 },
  { id: "corda", name: "Corda di canapa (15 m)", qty: 1 },
  { id: "torce", name: "Torce", qty: 3 },
];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
