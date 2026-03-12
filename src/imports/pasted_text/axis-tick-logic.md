Ja. Problemet er ikke at tickene tegnes ujevnt, men at de representerer ujevne sprang i verdi, fordi algoritmen prøver å presse inn maks fire labels mellom avrundet min og max.

Aksen skal alltid bygges fra:
	•	nærmeste nedre heltall som bunnverdi
	•	nærmeste øvre heltall som toppverdi
	•	maks fire tick-verdier totalt

Utfordringen oppstår når man lar biblioteket auto-generere ticks, eller når man velger “omtrent fire” ticks uten å kontrollere intervallene. Da kan man få labels som ser slik ut:
	•	Temperatur: -2, 0, 2, 6
	•	Fukt: 70, 72, 74, 78

Det gir visuelt jevn avstand mellom gridlinjene, men ulike numeriske sprang, som er misvisende.

Riktig logikk

Hvis aksen skal ha maks fire ticks, må alle ticks være del av en lineær sekvens med fast step. Man kan altså ikke bare velge fire “fine” tall. Man må først regne ut:
	1.	minTick = floor(minValue)
	2.	maxTick = ceil(maxValue)
	3.	range = maxTick - minTick

Deretter må man finne et step som gjør at:
	•	tickene blir jevnt fordelt
	•	antall ticks ikke overstiger 4
	•	siste tick dekker toppverdien

Formelen er i praksis:

tickCount = floor((maxTick - minTick) / step) + 1

Velg minste step som gir tickCount <= 4.

Eksempel 1: temperatur

Data omtrent fra 0 til 5
	•	minTick = 0
	•	maxTick = 5

Mulige steps:
	•	step 1 → ticks: 0,1,2,3,4,5 = 6 ticks, for mange
	•	step 2 → ticks: 0,2,4 = dekker ikke 5
	•	derfor må topp rundes videre opp til neste verdi som matcher stepet

Riktig løsning:
	•	step = 2
	•	axis max = 6
	•	ticks = 0, 2, 4, 6

Eksempel 2: luftfuktighet

Data omtrent fra 70.5 til 78.0
	•	minTick = 70
	•	maxTick = 78

Mulige steps:
	•	step 1 → 9 ticks, for mange
	•	step 2 → ticks 70,72,74,76,78 = 5 ticks, fortsatt for mange
	•	step 3 → ticks 70,73,76 = dekker ikke 78
	•	step 4 → ticks 70,74,78 = 3 ticks, gyldig

Altså: hvis maks er fire ticks, er 70,74,78 bedre enn 70,72,74,78, fordi den siste varianten later som om steget er jevnt når det ikke er det.

Viktig poeng

Hvis kravet er maks fire ticks, så må man akseptere at:
	•	noen akser får bare 3 ticks
	•	toppverdien noen ganger må rundes opp til neste verdi som passer med valgt step

Det er bedre enn å vise fire labels med ulik numerisk avstand.

Forslag til spesifikasjon til utvikler

Du kan formulere det slik:

Y-aksen skal alltid ha lineært fordelte ticks. Nederste tick settes til floor(minValue), og øverste utgangspunkt settes til ceil(maxValue). Deretter skal det velges en fast tick-step som gir høyst fire ticks totalt. Hvis øverste avrundede verdi ikke passer inn i en lineær sekvens med denne step-størrelsen, skal aksemaksimum rundes videre opp til nærmeste verdi som gjør sekvensen jevn. Det er ikke tillatt å vise ticks med ulike numeriske sprang bare for å treffe nøyaktig toppverdi.

Enkel pseudologikk

const rawMin = Math.min(...values)
const rawMax = Math.max(...values)

const minTick = Math.floor(rawMin)
const baseMaxTick = Math.ceil(rawMax)

const candidateSteps = [1, 2, 5, 10] // evt. utvides

let chosen = null

for (const step of candidateSteps) {
  const axisMax = Math.ceil((baseMaxTick - minTick) / step) * step + minTick
  const tickCount = Math.floor((axisMax - minTick) / step) + 1

  if (tickCount <= 4) {
    chosen = { step, axisMax, tickCount }
    break
  }
}

Så genereres ticks som:

ticks = []
for (let v = minTick; v <= axisMax; v += step) {
  ticks.push(v)
}

Hva dette ville gitt i dine grafer
	•	Temperatur: 0, 2, 4, 6
	•	Luftfuktighet: 70, 74, 78

Det er den ryddige løsningen.
