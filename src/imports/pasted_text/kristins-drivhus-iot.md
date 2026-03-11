Kristins drivhus – IoT-overvåking

Dette prosjektet er en liten edge-drevet IoT-løsning for å overvåke klimaet i et drivhus i sanntid. Systemet samler inn temperatur- og luftfuktighetsdata, styrer oppvarming ved behov, og publiserer dataene til en nettside via en lett skyarkitektur.

Stacken består av Homey, Cloudflare Workers, Cloudflare KV, GitHub og Figma Make, kombinert med en enkel IoT-sensor i drivhuset.

⸻

Hardware og nettverk

I drivhuset står en Mill Smartplugg koblet til internett via en UniFi Mobile Router Ultra.

Smartpluggen:
	•	måler temperatur
	•	måler luftfuktighet
	•	kan styre en tilkoblet vifteovn
	•	rapporterer energiforbruket til ovnen

En Homey smarthub fungerer som IoT-hub og mottar alle målinger.

Smartpluggen og Homey befinner seg på ulike geografiske lokasjoner og separate nettverk, og kommuniserer via internett.

Det er ikke nødvendig med VPN mellom nettverkene. Smartpluggen kommuniserer direkte med Mill sine skytjenester, og Homeys Mill-integrasjon kobler seg til samme tjeneste for å hente data.

⸻

Datainnsamling

Når målinger i smartpluggen endrer seg, trigges en Homey Flow.

Denne:
	1.	leser de oppdaterte verdiene
	2.	sender data til Cloudflare KV

Cloudflare KV fungerer som en enkel nøkkel-verdi database for siste målinger.

⸻

Backend

En Cloudflare Worker fungerer som backend og eksponerer dataene via et enkelt API.

API-et leverer blant annet:
	•	temperatur
	•	luftfuktighet
	•	energiforbruk
	•	tidspunkt for siste oppdatering

Siden API-et kjører på Cloudflare Edge, kan dataene hentes raskt fra hvor som helst.

⸻

Frontend

Nettsiden er laget med Figma Make.

Den:
	•	henter data fra Worker-API-et
	•	viser målingene i sanntid
	•	oppdaterer visningen fortløpende

Koden:
	•	versjoneres i GitHub
	•	publiseres globalt via Cloudflare Workers

Dette gir en svært lett og rask edge-basert hostingmodell.

⸻

Værintegrasjon

For å gi kontekst til drivhusdataene hentes også værdata fra Yr.no sitt API.

Dette gjør det mulig å sammenligne:
	•	temperatur i drivhuset
	•	temperatur utendørs
	•	luftfuktighet
	•	lokale værforhold

⸻

Varmestyring

Tidlig i sesongen kan nettene være kalde i Norge.

I denne perioden er en vifteovn koblet til smartpluggen.

Homey kan automatisk:
	•	slå ovnen på når temperaturen blir for lav
	•	slå den av når ønsket temperatur er nådd

⸻

Varsling

Systemet fungerer også som en enkel IoT-monitor.

Dersom temperatur eller luftfuktighet passerer definerte grenser:
	•	trigges en Homey Flow
	•	brukeren får pushvarsel på telefon

Dette gjør det mulig å reagere raskt dersom forholdene i drivhuset endrer seg.

⸻

Resultat

Prosjektet er en liten, men effektiv IoT-stack bygget med:
	•	edge-infrastruktur
	•	sky-API-er
	•	automatisering via Homey
	•	og en god dose vibe-coding

Resultatet er en løsning som gjør det mulig å følge klimaet i drivhuset i sanntid – fra hvor som helst.
