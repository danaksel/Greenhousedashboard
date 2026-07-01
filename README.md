# Kristins drivhus

Dashboard og Cloudflare Worker for drivhuset. Repoet inneholder både frontend og backend, og deployes til samme Worker:

`https://drivhus.dan-aksel.workers.dev`

Homey sender sensorverdier til Worker-endepunktet `/ingest`. Frontenden henter siste verdier, historikk og 24-timers min/maks fra samme Worker.

## Hva systemet viser

- Temperatur og luftfuktighet akkurat nå
- Faktisk min/maks for temperatur og luftfuktighet siste 24 timer
- Status for dør, vifte/varme og takvinduer
- Lokale værdata fra Yr/Open-Meteo
- Kollapsbare grafer for siste 12 eller 24 timer
- En enkel widget-API for ekstern skjerm/ESP32

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
    |
    v
Frontend på samme Worker
  - /api/latest først for rask respons
  - /api/history og /api/stats24h i bakgrunnen
```

## Viktige filer

- `src/app/App.tsx` - hoved-UI for dashboardet
- `src/app/utils/api.ts` - frontendens API-kall
- `src/worker/index.js` - Cloudflare Worker, ingest, API og statiske assets
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
- `ASSETS` - statiske frontend-assets fra `dist`

Secrets/variabler som må finnes i Cloudflare:

- `INGEST_TOKEN` - Bearer-token for Homey-ingest
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
3. Værdata hentes separat fra Yr/Open-Meteo.

Dette gjør at kritiske verdier vises raskt, mens grafene kan laste litt senere. Grafkomponenten prelastes når historikken er klar, slik at den kollapsbare grafseksjonen åpner smidig.

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
