# CLAUDE.md

Web-app React + Vite + TypeScript: un DM artificiale per avventure fantasy compatibili con la 5ª edizione. Leggi README.md per l'architettura.

## Comandi

- `npm run dev` — app in sviluppo
- `npm run test:run` — test (Vitest). Lanciali dopo ogni modifica a `src/engine`.
- `npm run typecheck` — TypeScript strict

## Regole del progetto

- `src/engine` è puro: niente React, niente `ai`, niente I/O. Ogni azione riceve uno stato e restituisce `{ state, message }` senza mutare l'input; le azioni non valide lanciano `GameError`. Ogni nuova azione ha i suoi test in `engine.test.ts`.
- Il casuale si inietta (`Rng`), così i test sono deterministici.
- Il modello modifica lo stato SOLO tramite i tool in `src/dm/tools.ts`, che chiamano il motore. Non aggiungere tool che accettano lo stato intero o PV "liberi" senza validazione.
- I tiri dei giocatori non si inventano: sono `PendingRoll` che l'interfaccia mostra e il giocatore compila. I tiri dei nemici li fa il motore.
- Il prompt di sistema ha una parte stabile (istruzioni, parametri, avventura) e una variabile (riassunto, stato) in fondo: non mescolarle, serve al caching.
- Il modello si sceglie solo in `src/llm/provider.ts`.
- Testi dell'interfaccia e del DM in italiano; identificatori nel codice in inglese.
- Contenuti di gioco solo dall'SRD 5.1 (CC-BY-4.0). Non usare il marchio "Dungeons & Dragons" né creature/ambientazioni fuori dall'SRD.
