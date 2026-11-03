# GameMaster AI

Web-app per giocare avventure fantasy compatibili con la 5ª edizione, con un Dungeon Master artificiale. I giocatori usano i propri dadi fisici e comunicano i risultati all'app.

## Avvio

Serve Node.js 20 o superiore.

```bash
npm install
npm run dev        # app su http://localhost:5173
npm test           # test del motore di gioco (Vitest, in watch)
npm run test:run   # test una volta sola
npm run build      # typecheck + build di produzione
```

Per il DM serve una chiave gratuita di Google AI Studio (https://aistudio.google.com/apikey), da incollare nell'app. La chiave resta solo nel `localStorage` del browser (approccio "porta la tua chiave").

## Architettura

```
src/
  engine/   TypeScript puro: regole SRD, schede, PV, inventario, munizioni, combattimento.
            Nessuna dipendenza da UI o LLM, completamente testato.
  dm/       Orchestratore del DM: avventura nascosta, prompt, tool per il modello, turno, riassunti.
  llm/      Scelta del modello (Vercel AI SDK). Unico punto da cambiare per usare un altro provider.
  ui/       React.
```

Principi:

- **Il modello non scrive mai lo stato.** Propone azioni tramite tool (`requestAttack`, `applyDamage`, `startCombat`...); il motore le valida e le applica. Se un'azione non è valida (es. frecce finite) il tool risponde `ERRORE: ...` e il modello si corregge.
- **I tiri dei giocatori sono tiri "in attesa".** Il motore crea un `PendingRoll` (es. `d20 +5, Attacco con Arco lungo`), l'interfaccia lo mostra, il giocatore inserisce la somma dei dadi e il motore calcola l'esito. I tiri dei nemici li fa il motore.
- **L'avventura è generata una volta** (`dm/adventure.ts`, output strutturato validato con Zod), salvata e reinviata a ogni turno come parte stabile del prompt. Così misteri e soluzioni restano coerenti.
- **Il contesto resta piccolo:** istruzioni + avventura + stato compatto + riassunto + ultimi messaggi.

## Stato del progetto

- [x] Motore: creazione personaggi di 1° livello (9 razze, 12 classi), prove, tiri salvezza, attacchi, critici, danni, PV temporanei, munizioni con recupero a fine scontro, iniziativa e turni
- [x] Layer DM: schema dell'avventura, prompt, tool, turno, riassunti
- [x] UI: chiave API, creazione personaggi e schede
- [ ] UI: setup della partita, generazione dell'avventura, chat con il DM, pannello dei tiri in attesa
- [ ] Salvataggio della partita (IndexedDB, poi Firestore)
- [ ] Modalità vocale
- [ ] Multiplayer

## Licenza dei contenuti di gioco

Questo progetto include materiale tratto dal System Reference Document 5.1 ("SRD 5.1") di Wizards of the Coast LLC, disponibile su https://dnd.wizards.com/resources/systems-reference-document. L'SRD 5.1 è distribuito con licenza Creative Commons Attribution 4.0 International, disponibile su https://creativecommons.org/licenses/by/4.0/legalcode.

Il progetto non è affiliato né approvato da Wizards of the Coast. Non usare il marchio "Dungeons & Dragons" nel nome o nella grafica dell'app.
