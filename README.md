# Kristins drivhus

Dashboard og Cloudflare Worker for drivhuset. Repoet inneholder både frontend og backend, og deployes til samme Worker:

`https://drivhus.dan-aksel.workers.dev`

Homey sender sensorverdier til Worker-endepunktet `/ingest`. Frontenden henter siste verdier, historikk, 24-timers min/maks, visningskonfigurasjon, plantebibliotek og AI-analyse fra samme Worker.

## Hva systemet viser

- Temperatur og luftfuktighet akkurat nå
- Faktisk min/maks for temperatur og luftfuktighet siste 24 timer
- Status for dør, vifte/varme og takvinduer
- Lokale værdata fra Yr/Open-Meteo
- Kollapsbare grafer for siste 12 eller 24 timer
- Admin-styrt designsystem for web og rund AMOLED-skjerm
- R2-basert mediebibliotek for headerbilder, logo, displaybilder og plantebilder
- Årsbasert plantebibliotek med sesongdata, historikk og aktiv/inaktiv sesongstatus
- AI-generert "Analyse og tips" for plantene, basert på siste døgn, vær og sesong
- API for Waveshare ESP32-S3 Touch AMOLED 1.43" med rund skjerm

## Arkitektur

```text
Homey Flow
  POST /ingest
    |
    v
Cloudflare Worker
  - validerer Bearer-token
  - normaliserer sensorverdier
  - skriver latest:* til KV
  - skriver temperatur/fukt-historikk til R2
  - lagrer site-config, plantebibliotek og siste AI-analyse i KV
  - lagrer bilder og display-binærfiler i R2
    |
    v
Frontend på samme Worker
  - /api/latest først for rask respons
  - /api/history og /api/stats24h i bakgrunnen
  - /api/site-config for adminstyrte farger, bilder og visning
  - /api/plant-analysis for siste lagrede planteanalyse
    |
    v
ESP32-S3 rund AMOLED
  - /api/display-config for farger og aktive displaybilder
  - /api/display-stats og /api/latest for verdier/grafer/status
```

## Viktige filer

- `src/app/App.tsx` - hoved-UI for dashboardet
- `src/app/AdminPage.tsx` - adminside for design, bilder, visning og plantedata
- `src/app/utils/api.ts` - frontendens API-kall
- `src/worker/index.js` - Cloudflare Worker, ingest, API og statiske assets
- `src/shared/display-theme.js` / `.ts` - delte standardfarger for web og display
- `ESP32-S3-1.43-skjerm/` - firmware for Waveshare ESP32-S3 Touch AMOLED 1.43"
- `backups/ESP32-S3-1.43-skjerm-stable-20260708-221012/` - backup av stabil firmware før større endringer
- `wrangler.jsonc` - Worker-navn, assets, KV og R2-bindinger
- `dist/` - bygget frontend som Worker-assets

## Cloudflare-oppsett

Worker:

- Navn: `drivhus`
- Produksjon: `https://drivhus.dan-aksel.workers.dev`
- Worker entrypoint: `src/worker/index.js`
- Assets: `./dist`
- SPA fallback: aktivert med `not_found_handling: "single-page-application"`

Bindings:

- `GREENHOUSE_DATA` - Cloudflare KV for siste sensorverdier
- `GREENHOUSE_HISTORY` - Cloudflare R2 bucket for 15-minutters historikk
- `GREENHOUSE_ASSETS` - Cloudflare R2 bucket for bilder, display-PNG og RGB565-binærfiler
- `ASSETS` - statiske frontend-assets fra `dist`
- `R2_PUBLIC_BASE_URL` - offentlig base-URL for R2-media, nå `https://media.danaksel.no`

Secrets/variabler som må finnes i Cloudflare:

- `INGEST_TOKEN` - Bearer-token for Homey-ingest
- `OPENAI_API_KEY` - brukes av admin/cron for planteanalyse
- `fan_on` og `fan_off` - gamle Homey-webhooks for viftekontroll. Endepunktene finnes fortsatt i Worker, men funksjonen brukes ikke i frontenden nå.

## API

### `POST /ingest`

Brukes av Homey.

Headers:

```http
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json
```

Body:

```json
{
  "sensor": "temperature",
  "value": 21.4
}
```

Støttede sensorer:

- `temperature`
- `humidity`
- `rain_today`
- `door`
- `fan`
- `heating`
- `window`

Worker støtter også noen norske/alternative sensornavn, for eksempel `temperatur`, `luftfuktighet`, `dør`, `vifte`, `varme` og `vindu`.

Verdier:

- `temperature`, `humidity`, `rain_today`: tall
- `door`: `open`/`closed`, `Ja`/`Nei`, boolean eller `1`/`0`
- `fan`, `heating`: `on`/`off`, `Yes`/`No`, `Ja`/`Nei`, boolean eller `1`/`0`
- `window`: heltall fra `0` til `3`

### `GET /api/latest`

Raskt endepunkt for nåverdier. Frontenden bruker dette først slik at temperatur, luftfuktighet og statuskort vises raskt.

### `GET /api/history`

Returnerer historikk for siste 24 timer. Temperatur og luftfuktighet hentes fra R2, aggregert til timespunkter for grafene.

### `GET /api/stats24h`

Returnerer faktisk min/maks for temperatur og luftfuktighet siste 24 timer. Dette brukes på temperatur- og luftfuktighetskortene.

### `GET /api/widget`

Kompakt tekstbasert respons for ekstern skjerm/widget.

### `GET /api/site-config`

Returnerer publisert konfigurasjon for frontend og display:

- headerbilder per modus
- light/dark/display-farger
- synlighet for seksjoner
- plantebibliotek og sesongdata
- planteanalyse-tema

### `GET /api/display-config`

Returnerer kompakt konfigurasjon for den runde ESP32-S3-skjermen. Denne inkluderer valgt modus, displayfarger og pekere til ferdiggenererte `164 x 466` displaybilder/RGB565-binærfiler.

### `GET /api/display-stats`

Returnerer statistikk til displayet, blant annet historikk for grafside.

### `GET /api/display-log` og `POST /api/display-log`

Brukes av firmware for drifts-/feillogg, slik at langvarige skjermfeil kan undersøkes uten å være koblet til serial monitor hele tiden.

### `GET /api/plant-analysis`

Returnerer siste lagrede AI-analyse fra KV. Frontenden viser denne i seksjonen "Analyse og tips".

### `POST /admin/api/plant-analysis`

Kjører ny OpenAI-analyse for aktiv sesong og lagrer resultatet i KV. Planter som er markert ferdig for sesongen tas ikke med i analysen.

### `GET`, `PUT` `/admin/api/config`

Admin-endepunkter for å lese og lagre site-config.

### `GET`, `POST`, `PATCH`, `DELETE` `/admin/api/images`

Admin-endepunkter for R2-bilder og display-assets. Brukes til headerbilder, logo/favicon, plantebilder og egne bilder til rund skjerm.

### `POST /api/fan/on` og `POST /api/fan/off`

Trigger gamle Homey-webhooks hvis `fan_on`/`fan_off` er satt. Frontenden bruker ikke dette nå.

### `POST /admin/cleanup-kv-history`

Admin-endepunkt for å rydde gammel KV-basert historikk. Krever samme Bearer-token som ingest.

## Historikkmodell

`latest:*` lagres i KV for alle sensorer.

Temperatur og luftfuktighet lagres i tillegg i R2 som 15-minutters buckets:

```text
history_15m/<sensor>/<bucket-start-iso>.json
```

Hver bucket kan inneholde:

- siste verdi i bucket
- faktisk `min`
- faktisk `max`
- `count`
- `timestamp`
- `bucketStart`

Grafene bruker normaliserte timespunkter, men min/maks-kortene bruker faktisk min/maks fra historikken.

## Frontend-dataflyt

Frontend laster data i prioritert rekkefølge:

1. `/api/latest` hentes først og avslutter hoved-loading.
2. `/api/history` og `/api/stats24h` hentes i bakgrunnen.
3. `/api/site-config` styrer farger, bilder, synlighet og plantedata.
4. `/api/plant-analysis` henter siste lagrede AI-analyse.
5. Værdata hentes separat fra Yr/Open-Meteo.

Dette gjør at kritiske verdier vises raskt, mens grafene kan laste litt senere. Grafkomponenten prelastes når historikken er klar, slik at den kollapsbare grafseksjonen åpner smidig.

## Admin og designsystem

Adminsidene ligger under `/admin` og brukes til:

- å endre headerbilder, logo og favicon
- å laste opp og slette media i R2
- å styre hvilke seksjoner som vises på forsiden
- å redigere light/dark/display-farger per modus
- å forhåndsvise mobilvisning før lagring
- å konfigurere rund skjerm med faktisk utsnitt
- å generere `164 x 466` PNG og RGB565-binærfil til ESP32
- å vedlikeholde plantebibliotek, sesonger og AI-notater

Fargene for web og skjerm er samlet i site-config. Dark-modeverdiene brukes også av display-konfigurasjonen til ESP32-skjermen.

## Rund AMOLED-skjerm

Repoet inneholder firmware for Waveshare ESP32-S3 Touch AMOLED 1.43" i `ESP32-S3-1.43-skjerm/`.

Skjermen viser:

- hovedside med temperatur, luftfuktighet og dør/vifte/vindu-status
- modusbasert høyresidebilde fra R2
- farger hentet fra admin-konfigurasjonen
- grafer/statistikk for siste 12 timer
- ikoner og statusfarger som følger samme tema som web

Displaybildene lages i admin som en `164 x 466` stripe som firmware tegner på høyre side av den runde skjermen. Admin-previewen viser faktisk rundt utsnitt, ikke et fullskjermbilde.

Firmware henter jevnlig `/api/display-config`, `/api/latest` og `/api/display-stats`. Bilder kan caches i PSRAM, og firmware sender logg til `/api/display-log` for å gjøre langvarige feil enklere å feilsøke.

Stabil firmware fra før større endringer er lagret i `backups/ESP32-S3-1.43-skjerm-stable-20260708-221012/`.

## Plantebibliotek og sesonger

Plantesystemet skiller mellom global planteinformasjon og sesongdata.

Globalt plantebibliotek:

- bilde
- plantenavn
- plantetype (`Blomst`, `Urte`, `Frukt`, `Grønnsak`)
- redaksjonell plantebeskrivelse

Sesongdata per år:

- valgt plante fra bibliotek
- anskaffelse (`Sådd fra frø` eller `Anskaffet som plante`)
- sådato og såsted
- dato plassert i drivhus
- hvor planten/frøene ble kjøpt
- utplanting/høsting
- plantested og notat til analysen
- sortering og aktiv status

Når en plante har fått utplanting-/høstedato, behandles den som ferdig for sesongen. Den vises bakerst i avatarlisten, merkes som "Sesong over" og sendes ikke til OpenAI-analyse.

På frontend vises planteanalysen som en horisontal avatarrekke. På mobil åpnes plantekortet som Vaul bottom sheet; på desktop vises det som modal.

## OpenAI-analyse

Planteanalysen kjøres manuelt fra admin eller automatisk via Worker-cron. Resultatet lagres i KV og vises på forsiden uten at brukere kan starte nye analyser.

Analysen får:

- siste døgns temperatur-/luftfuktighetsoppsummering
- værprognose for resten av dagen
- måned og årstid
- aktiv sesong
- relevante plantedata og historikk
- generell driftstekst fra admin

Responsen lagres som JSON med:

- kort totalvurdering
- status per plante
- kort oppsummering
- hva man bør følge med på
- ekstra råd
- valgfri prognose, for eksempel forventet modning/blomstring/høsting
- tokenbruk når API-et returnerer usage-data

## Lokal utvikling

Installer avhengigheter:

```bash
npm install
```

Start Vite:

```bash
npm run dev
```

Når appen kjøres på `127.0.0.1`, bruker frontend produksjons-Worker som API-base:

```text
https://drivhus.dan-aksel.workers.dev
```

Det gjør at lokal UI-utvikling kan bruke ekte drivhusdata uten å starte Worker lokalt.

## Bygg og deploy

Bygg frontend:

```bash
npm run build
```

Deploy manuelt med Wrangler:

```bash
npm run deploy
```

I praksis er prosjektet koblet til GitHub/Cloudflare, så push til `main` deployer Worker og frontend via Cloudflare.

## Homey-oppsett

Homey Flows sender POST til:

```text
https://drivhus.dan-aksel.workers.dev/ingest
```

Eksempel for temperatur:

```json
{
  "sensor": "temperature",
  "value": 21.4
}
```

Eksempel for vifte-status:

```json
{
  "sensor": "fan",
  "value": "Yes"
}
```

Vifte regnes som på når Homey sender `fan: Yes`. I dagens Homey-logikk skjer dette når strømforbruket går over terskelen som er satt i Homey-flowen.

## Notater

- Ikke legg tokens eller webhook-URL-er i repoet.
- `dist/` er sporet i repoet fordi Worker-assets deployes derfra.
- Den gamle Worker-riggen er samlet inn i dette repoet, slik at frontend og Worker nå bor samme sted.
