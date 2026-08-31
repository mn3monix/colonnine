# VoltVia

Versione **0.8.0**

App HTML per percorsi in auto elettrica: itinerario, colonnine lungo il tragitto e cosa vedere vicino alle soste.

Pensata per GitHub Pages. **La chiave Google non va nel repository.**

## Come resta “solo tua”

Qualsiasi chiave messa in un file HTML/JS pubblico è copiabile. Per questo VoltVia:

1. **Non salva la chiave su GitHub** (`config.js` resta vuoto)
2. Te la chiede al primo avvio e la tiene in `localStorage` **solo su quel browser**
3. Un visitatore del sito vede l’app, ma senza *la sua* chiave Google Maps non parte e **non spende i tuoi crediti**

Su Google Cloud, in più:

- Quota giornaliera bassa
- Alert di fatturazione a 1 €
- Restrizione API: solo Maps JS, Directions, Places, Elevation, Geocoding
- Se usi l’app solo in locale: restrizione **IP** (il tuo IP di casa). Su Pages l’IP non basta perché ogni utente ha un IP diverso; in quel caso la protezione vera è “niente chiave nel codice”

Non esiste un modo, su un sito statico, di usare *la tua* chiave per tutti i visitatori senza esporla.

## API da attivare

[Google Cloud Console](https://console.cloud.google.com/):

- Maps JavaScript API
- Directions API
- Places API
- Elevation API
- Geocoding API

## Pubblicare

1. Carica `index.html`, `config.js` (vuoto), `README.md` su GitHub
2. Settings → Pages
3. Apri il sito, incolla la chiave una volta sul tuo PC/telefono

Pulsante **Rimuovi la mia chiave da questo browser** per cancellarla dal telefono o dal PC condiviso.

## Uso

- Partenza e arrivo (testo o click sulla mappa)
- Profilo: Veloce, Panoramico, Poche salite
- Distanza massima delle colonnine dal percorso
- Click su una colonnina per le attrazioni vicine
