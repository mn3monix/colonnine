# Tesla Model Y AWD 2026 — Route Planner

App HTML statica per pianificare viaggi con **Tesla Model Y AWD 2026**.
Calcola percorsi **più veloci** (3 alternative) e **veloci panoramici** (3 alternative),
inserisce solo ricariche HPC dei network scelti, stima SoC / tempi / costi
e in modalità **SMART** suggerisce la velocità da tenere da colonnina a colonnina.

## Reti considerate (solo HPC)

Tesla Supercharger · IONITY · Electra · EVDC · EnBW · GreenWay

## Funzioni

- SoC attuale, SoC minimo di arrivo, SoC massimo di ricarica
- SoC stimato all’arrivo in ogni colonnina
- Tempo di percorrenza e tempo di ricarica
- Costo €/kWh per rete (modificabile) e costo sessione
- **SMART**: ottimizza i consumi e propone la velocità di crociera per ogni tratta
- **BACKUP**: colonnina di riserva vicina se quella principale è piena o guasta
- Chiave **Google Maps solo in locale** (Mac): non viene pubblicata sulla pagina GitHub

## Come tenere la API sul Mac (non su GitHub)

L’app **non contiene** la chiave. Due modi, entrambi locali:

### 1. Campo in app (più semplice)

1. Apri `index.html` nel browser
2. Clicca ⚙ Impostazioni
3. Incolla la chiave Google Maps JS API
4. Salva — resta in `localStorage` di quel browser, su quel Mac

### 2. File locale (consigliato)

```bash
cp config.local.example.js config.local.js
```

Apri `config.local.js` e inserisci la chiave. Il file è nel `.gitignore`.

Attiva nel progetto Google Cloud:

- Maps JavaScript API
- Directions API
- Places API
- Geocoding API (consigliata)

Restringi la chiave per HTTP referrer `http://localhost/*` e `http://127.0.0.1/*`
oppure al dominio GitHub Pages **senza** committare la chiave:
chi la usa sulla Pages la inserisce solo nel proprio browser.

OpenChargeMap è opzionale (chiave gratuita) e migliora la copertura colonnine.

Senza OCM l’app usa un dataset HPC europeo di riserva + Places di Google se la chiave Maps è presente.

## Uso su GitHub Pages

1. Crea un repo, carica questi file (**senza** `config.local.js`)
2. Settings → Pages → Deploy from branch `main` / root
3. Ogni visitatore inserisce la propria chiave nelle Impostazioni

## Modello energetico (Model Y AWD 2026)

Valori di riferimento usati dal calcolatore (non ufficiali Tesla, aggregati 2025–2026):

| Voce | Valore |
|---|---|
| Batteria utilizzabile | 79 kWh |
| Picco DC | 250 kW |
| 10→80 % tipico | ~28–32 min |
| Consumo 110 km/h | ~18,0 kWh/100 km |
| Consumo 130 km/h | ~22,2 kWh/100 km |

Il consumo varia con la velocità. SMART sceglie la velocità che arriva sopra il SoC minimo con il minor kWh, senza allungare troppo il viaggio.

Prezzi €/kWh di default (modificabili): stime ad-hoc Europa 2026, non tariffari live.

## Licenza

Uso personale / pubblicazione su GitHub a tua discrezione.
Dati mappa © Google / © OpenStreetMap. Colonnine: dataset interno + Open Charge Map.
