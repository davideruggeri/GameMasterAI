import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// Unico punto in cui si sceglie il modello. Per provare Claude o altri provider
// basta aggiungere qui un ramo (es. @ai-sdk/anthropic, @openrouter/ai-sdk-provider):
// il resto dell'app usa solo l'interfaccia LanguageModel dell'AI SDK.

/** Modello Gemini del free tier di Google AI Studio. Controlla gli id attuali su ai.google.dev. */
export const DEFAULT_MODEL_ID = "gemini-3.5-flash-lite";

export function createModel(apiKey: string, modelId: string = DEFAULT_MODEL_ID): LanguageModel {
  return createGoogleGenerativeAI({ apiKey })(modelId);
}

// "Porta la tua chiave": la chiave resta solo nel browser di chi gioca.
// Va bene per giocare tra amici; per un'app pubblica serve un proxy lato server.
const KEY_STORAGE = "gamemaster-ai.apiKey";

export function loadApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // storage non disponibile: la chiave resta solo in memoria per questa sessione
  }
}
