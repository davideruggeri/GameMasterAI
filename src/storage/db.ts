import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { GameStateSchema, type GameState } from "../engine/state";
import type { DmSession } from "../dm/turn";
import { db } from "./firebase";

const LOCAL_KEY = "gamemaster-session-id";

export function getSessionId(): string {
  let id = localStorage.getItem(LOCAL_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LOCAL_KEY, id);
  }
  return id;
}

export interface SavedGame {
  sessionId: string;
  gameState: GameState;
  dmSession: DmSession | null;
  updatedAt: Date | null;
}

export async function saveGame(gameState: GameState, dmSession: DmSession | null): Promise<void> {
  const sessionId = getSessionId();
  await setDoc(
    doc(db, "sessions", sessionId),
    {
      gameState: JSON.stringify(gameState),
      dmSession: dmSession ? JSON.stringify(dmSession) : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function loadGame(): Promise<SavedGame | null> {
  const sessionId = getSessionId();
  const snap = await getDoc(doc(db, "sessions", sessionId));
  if (!snap.exists()) return null;
  const data = snap.data();
  const gameState = GameStateSchema.parse(JSON.parse(data.gameState as string));
  const dmSession: DmSession | null = data.dmSession
    ? (JSON.parse(data.dmSession as string) as DmSession)
    : null;
  return {
    sessionId,
    gameState,
    dmSession,
    updatedAt: data.updatedAt?.toDate() ?? null,
  };
}

/** Elenca tutte le sessioni (per un futuro selettore di partite). */
export async function listSavedGames(): Promise<{ sessionId: string; updatedAt: Date | null }[]> {
  const q = query(collection(db, "sessions"), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    sessionId: d.id,
    updatedAt: d.data().updatedAt?.toDate() ?? null,
  }));
}
