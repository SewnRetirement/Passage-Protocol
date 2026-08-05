# Passage Protocol — waar het over gaat

*Geschreven om te delen. Augustus 2026.*

---

## Het probleem in één alinea

Er staat inmiddels tientallen miljarden aan echte activa op de blockchain —
getokeniseerde staatsobligaties, geldmarktfondsen, aandelen, krediet. BlackRock,
Franklin Templeton en Ondo zitten er allemaal in. Maar het overgrote deel van dat
geld ligt stil. De reden is niet gebrek aan vraag: die tokens zijn *permissioned*.
Er zit een allowlist omheen, want het blijven effecten en de uitgever moet weten
wie ze vasthoudt. Zodra zo'n token een gewone DeFi-pool in wil, breekt het. Een
pool is anoniem, dus de overdracht faalt.

Het gevolg is een absurditeit: het meest gereguleerde, meest "echte" geld op de
chain is tegelijk het minst bruikbare. Je kunt er niet mee lenen, niet mee
handelen, het niet als onderpand gebruiken. Het is een bankrekening op een
blockchain.

## Wat Passage doet

De gangbare oplossing is dat elk platform zelf een allowlist bouwt. Dat schaalt
niet: elke uitgever moet met elk platform apart afspraken maken, en de token blijft
opgesloten in de plekken waar dat gelukt is.

Passage zet de controle **in de token zelf**. Je stort een permissioned RWA in een
vault en krijgt er één-op-één een pToken voor terug. Die pToken is een Token-2022
mint met een *transfer hook*: een programma dat bij élke overdracht meedraait en
controleert of de ontvanger een credential heeft in een on-chain register. Geen
credential, geen overdracht — ongeacht wie het probeert of via welk protocol.

Het gevolg is dat de regel meereist met het bezit in plaats van te leven op het
platform. Een DEX, een lening, een vault: die hoeven niks te weten van compliance.
Ze doen gewoon een transfer, en de token bewaakt zichzelf. Wrap once, compose
everywhere.

## Waarom dit op Solana moet

Dit is geen "we hadden ook Ethereum kunnen kiezen". Transfer hooks zijn een
Token-2022-functie die je op andere ketens simpelweg niet hebt. De Ethereum-aanpak
(ERC-3643, ERC-1400) legt de handhaving in het tokencontract, wat betekent dat elk
platform de standaard expliciet moet integreren voordat het jouw asset kan
aanraken. Dat is precies waarom permissioned assets daar in ommuurde tuintjes
blijven zitten.

Op Solana geldt de regel ook voor programma's die geschreven zijn vóórdat jouw
token bestond. Daar komt de kostenkant bij: een controle bij élke overdracht is
alleen betaalbaar als een transactie een fractie van een cent kost.

En de assets komen deze kant op. Getokeniseerde aandelen en obligaties landen in
rap tempo op Solana. Het gat tussen "uitgegeven op Solana" en "bruikbaar in Solana
DeFi" is precies het gat dat dit dicht.

## Wat er nu staat

Alles hieronder is te controleren, vandaag, zonder mij op mijn woord te geloven.

**Vijf programma's draaien op devnet.** Het identity-register (één PDA per
geverifieerde wallet), de transfer hook, de wrapper-vault, een gated AMM, en een
faucet zodat bezoekers het kunnen proberen. Eenentwintig integratietests groen,
inclusief de negatieve gevallen: een ongeverifieerde wallet kan geen pTokens
ontvangen, en een ongeverifieerde pool kan er niet in handelen.

**De demo is speelbaar.** Wallet verbinden, testtokens ophalen, wrappen, swappen in
de gated AMM, unwrappen. Geen aanmelding, geen wachtlijst. Dat is bewust: bij een
compliance-verhaal is "kijk zelf maar" honderd keer sterker dan een screenshot.

**Er ligt een SDK op npm.** `@passage_protocol/hook-kit`, MIT. Transfer hooks zijn
het slechtst gedocumenteerde deel van Token-2022, en het moeilijke zit niet in de
hook maar in alles daarna: als jouw programma een gehookte token wil verplaatsen,
moet je een lijst extra accounts uitlezen en in de goede volgorde meesturen, anders
faalt de CPI met een foutmelding waar je niks aan hebt. De officiële library dekt
alleen het simpele geval. Wij hebben het andere geval opgelost en weggegeven.

**Het zakelijke deel ligt er ook.** Launch-document, verdienmodel, tokenomics,
begroting, risico's, en een uitgewerkte aanvraag bij de Solana Foundation.

Alles is open source onder MIT.

## Hoe hier geld verdiend wordt

De eerlijke versie: een fee alleen bij wrappen is te dun. Wie een getokeniseerde
obligatie twee jaar vasthoudt betaalt 0,10% erin en 0,10% eruit — tien basispunten
over twee jaar. Dat bouwt geen bedrijf.

Dus zit de kern in een terugkerende fee op het gewrapte vermogen. Ter ijking: Ondo
rekent 15 bps per jaar voor tokenisatie en compliance, bovenop de 20 bps die
BlackRock voor het onderliggende fonds vraagt. Wij vragen daar een fractie van, en
leveren iets wat zij geen van beiden verkopen: de token wordt bruikbaar in DeFi.
Bij $2 miljard gewrapt is 8 bps ongeveer $1,6M per jaar, terugkerend. Daarnaast
wrap/unwrap-flow en een integratiefee per venue.

Belangrijk: **onze klant is de uitgever, niet de handelaar.** Dat is geen
semantiek — het bepaalt de hele juridische opzet. Passage is een
technologieleverancier; de uitgever houdt de vergunning en blijft de gereguleerde
partij. Zouden wij zelf bewaren en zelf een handelsplaats draaien, dan hadden we
een beleggingsondernemingsvergunning nodig, en dat is met een raise van een paar
miljoen niet te dragen.

De launch loopt via **MetaDAO**, een futarchy-launchpad op Solana. Het opgehaalde
geld blijft on-chain, het team krijgt een vooraf goedgekeurd maandbudget, en elke
grotere uitgave wordt door een markt beoordeeld in plaats van door ons. Zakt het
vertrouwen, dan kunnen houders de treasury terugstemmen. Dat is bewust gekozen: het
is de minst comfortabele en meest geloofwaardige manier om dit te doen.

## Wat er nog moet — techniek

Voordat er ook maar één echte euro doorheen gaat: een **security audit** van de
vier kernprogramma's, met het rapport volledig openbaar. Een hook zit in het pad
van élke overdracht, dus een bug daar is een bug in elke token die het patroon
overneemt.

Daarnaast de **juridische structuur** (MiCA voor de token, effectenrecht voor de
gewrapte assets, en een entiteit), **integratie met een echte KYC-provider** zodat
credentials uit verificatie komen in plaats van uit een devnet-faucet, en daarna
pas **mainnet**.

Verder op de lijst: de SDK testen tegen hooks van anderen, een geschreven
referentiegids over transfer hooks, integratievoorbeelden met bestaande Solana-
venues, en later lending-integratie zodat pTokens als onderpand werken.

## Wat er nog moet — community

Hier ben ik het zwakst, en ik zeg dat liever hardop.

Er staat een X-account met een handvol volgers. De inhoud is goed — de thread werd
uitgelezen tot de laatste post, en er komen echte reacties van serieuze accounts.
Maar ik heb een fout gemaakt: te veel replies per dag vanaf een jong account, en X
gaf een spam-label. Bezwaar toegewezen, label weg, maar de les staat: dit moet
langzaam en menselijk, niet als campagne.

Verder is er nog geen Discord of Telegram, bewust — een leeg kanaal doet meer kwaad
dan geen kanaal. En er is nog geen aanwezigheid in de MetaDAO-community, terwijl
dat wél moet gebeuren vóór de aanmelding, niet tijdens.

Wat hier nodig is, is iemand die snapt dat je bij een compliance-protocol geen
hype-publiek wilt maar een geloofwaardig publiek: bouwers, RWA-mensen, het
MetaDAO-ecosysteem. Kwaliteit boven bereik. Het product verkoopt zichzelf zodra het
gezien wordt door de juiste mensen — dat is de hele strategie, en die staat of valt
met uitvoering.

## Waar jullie zouden passen

Ik verkoop niks, ik laat zien wat er ligt. Twee plekken springen eruit.

**De technische kant.** Op dit moment ben ik een single point of failure, en dat is
het eerlijkste risico in het hele project. Er is werk dat losstaat en direct nut
heeft: de SDK hardmaken tegen hooks van anderen, meedenken over de audit-
voorbereiding, de architectuur tegen het licht houden (met name of de vault en de
pool bij de uitgever horen te draaien in plaats van bij ons — dat is een juridische
keuze met technische gevolgen), en de integratievoorbeelden met bestaande venues
bouwen. Iemand die dit soort code al eens in productie heeft zien breken, is hier
meer waard dan mijn eigen tweede paar ogen.

**De community-kant.** Niet "wij gaan groeien", maar: de MetaDAO Discord in als
serieuze deelnemer, de juiste twintig mensen op X vinden en écht gesprek voeren, en
op het goede moment beslissen of er een eigen kanaal komt en hoe dat er dan uitziet.
Plus de aanloop naar de launch, waar het verschil tussen een ICO die vol loopt en
een die het niet haalt vrijwel volledig in de maanden ervoor wordt gemaakt.

In het launch-document staat budget voor een tweede developer en twee adviseurs,
betaald uit de raise, met een omschreven mandaat in plaats van tokens tegen vage
beloftes. Dat is er nu nog niet — er is nog geen geld. Wat er wel is: een werkend
protocol, een aanvraag die klaarligt, en de vrijheid om dit goed op te zetten in
plaats van te repareren.

## Eerlijk over de risico's

De code is open source en ongeveer 1500 regels Rust. Een goede developer bouwt dat
na. De voorsprong zit niet in het bouwsel maar in het netwerkeffect van het
register, in de relaties met uitgevers, en in de juridische positie — en die drie
kosten tijd en geld, geen ctrl-C.

Het grootste risico is niet technisch maar juridisch: als de conclusie is dat we
tóch de gereguleerde partij zijn, valt het model om. Daarom is de jurist de eerste
aanname en gaat er niks naar mainnet voordat dat vaststaat.

Verder: geen uitgever getekend, geen audit, geen mainnet, geen token, één
ontwikkelaar. Dat is precies waar de raise en de grant voor zijn.

Nog iets wat jullie sowieso zien als je in de repo kijkt: dit is gebouwd met
AI-assistentie, in korte tijd. De code is getest en publiek, maar ik zeg het liever
zelf dan dat het een ontdekking wordt.

## Links

- Demo (devnet, speelbaar): https://sewnretirement.github.io/Passage-Protocol/
- Code: https://github.com/SewnRetirement/passage-protocol
- SDK: `npm i @passage_protocol/hook-kit`
- X: https://x.com/passageRWA
