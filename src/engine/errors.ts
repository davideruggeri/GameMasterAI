/**
 * Errore "di gioco": un'azione non valida secondo le regole (es. frecce finite,
 * bersaglio inesistente). I tool del DM lo intercettano e lo restituiscono al
 * modello come testo, così il modello può correggersi invece di far crashare l'app.
 */
export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}
