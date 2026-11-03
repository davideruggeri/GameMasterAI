import { z } from "zod";
import { CLASS_IDS, RACE_IDS, type ClassId, type RaceId } from "../engine/srd";

// Le "richieste iniziali" del prompt originale diventano un form: niente domande
// fatte dal modello, solo dati strutturati.

export const CharacterRequestSchema = z.object({
  player: z.string().min(1),
  /** Se vuoto, il nome lo inventa il DM in fase di generazione dell'avventura. */
  name: z.string().optional(),
  sex: z.string(),
  race: z.enum(RACE_IDS as [RaceId, ...RaceId[]]),
  class: z.enum(CLASS_IDS as [ClassId, ...ClassId[]]),
});
export type CharacterRequest = z.infer<typeof CharacterRequestSchema>;

export const SetupSchema = z.object({
  /** Es. "10-12 anni", "adulti". Serve a calibrare tono e contenuti. */
  ages: z.string(),
  theme: z.string(),
  experience: z.enum(["principianti", "misti", "esperti"]),
  /** Es. "2 ore", "una serata", "3 sessioni". */
  duration: z.string(),
  specialRequests: z.string(),
  characters: z.array(CharacterRequestSchema).min(1),
});
export type Setup = z.infer<typeof SetupSchema>;
