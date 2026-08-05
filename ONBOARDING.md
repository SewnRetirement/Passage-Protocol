# Instapdocument — Passage Protocol

*Voor iedereen die meedoet. Lees dit eerst, daarna weet je waar alles staat.*

---

## In één minuut

Getokeniseerde staatsobligaties en aandelen op de blockchain zijn *permissioned*:
er zit een allowlist omheen, want het blijven effecten. Daardoor kun je er niks
mee in DeFi — een pool is anoniem, dus de overdracht faalt.

Passage zet die controle in de token zelf. Je stort de RWA in een vault en krijgt
een pToken terug: een Token-2022 mint met een transfer hook die bij élke
overdracht checkt of de ontvanger een credential heeft. De regel reist mee met het
bezit in plaats van te leven op het platform.

Alles draait op devnet en de demo is speelbaar zonder aanmelding. Begin daar:
**https://sewnretirement.github.io/Passage-Protocol/** — testtokens ophalen,
wrappen, swappen, unwrappen. Twee minuten, en dan snap je het product.

## Waar alles staat

Alles ligt in de repo — **github.com/SewnRetirement/passage-protocol**. Dat is de
enige bron. Documentatie die ergens anders rondzwerft (chat, Notion, Drive) loopt
binnen twee weken uit de pas, dus doen we dat niet.

**`PASSAGE-NL.md`** — het hele verhaal in het Nederlands: probleem, oplossing,
verdienmodel, stand van zaken. Begin hier als je nog niets weet.

**`LAUNCH.md`** — het launch-document voor MetaDAO. Verdienmodel, waarom je $PASS
zou houden, de raise, beloning, maandbegroting, risico's, team. Dit is het meest
complete document dat er is.

**`GRANT.md`** en **`GRANT-FORM.md`** — de aanvraag bij de Solana Foundation en de
invulklare versie daarvan.

**`assets/passage-status.pdf`** — één pagina: wat af is versus wat nog moet.
Handig als je snel de stand wilt zien.

**`README.md`** — technisch overzicht van de vier programma's en de tests.

**`sdk/hook-kit/README.md`** — de SDK, en de twee valkuilen van transfer hooks die
nergens anders gedocumenteerd staan.

## Technisch opstarten

Je hebt Rust, Solana CLI (agave 2.1.x), Anchor 0.31.1 en Node 22 nodig.

```bash
git clone https://github.com/SewnRetirement/passage-protocol
cd passage-protocol
npm install
anchor build
anchor test        # start een lokale validator en draait alle 21 tests
```

De vier kernprogramma's:

**`passage_identity`** — het credential-register. Eén PDA per geverifieerde wallet,
seeds `["credential", wallet]`. De autoriteit die credentials uitgeeft is nu op
devnet de faucet; op mainnet wordt dat een KYC-provider.

**`passage_hook`** — de transfer hook. Leest de eigenaar van het ontvangende
token-account en eist dat diens credential-PDA bestaat. Faalt met
`ReceiverNotVerified` (0x1770).

**`passage_wrapper`** — de vault. Wrap/unwrap 1:1, fee in bps, opgebouwde fees
inbaar door de autoriteit.

**`passage_pool`** — een constant-product AMM die gehookte pTokens correct
verhandelt. Dit is het interessantste programma: de pool-PDA moet zélf een
credential hebben, anders blokkeert de hook de inkomende transfer.

Twee dingen die je een middag kosten als niemand het zegt: het **doel-account moet
bestaan** voordat je de hook-accounts kunt resolven (de hook leest data uit dat
account), en een **ontvangende pool is zelf een ontvanger** en heeft dus ook een
credential nodig. Beide staan uitgelegd in de SDK-README.

## Wat we wel en niet beweren

Dit is geen stijlvoorkeur maar een harde regel, en ze geldt op X, in Discord, in
gesprekken en in documenten. De hele positionering van dit project is dat je kunt
controleren wat we zeggen.

**Wel:** vijf programma's live op devnet, 21 tests, speelbare demo, SDK op npm,
open source onder MIT.

**Niet:** mainnet is niet live. Er is geen token en geen presale. Er zijn geen
partners of partnerships — ook niet "aligned partners", ook niet als iemand anders
dat over ons zegt (dat is al een keer gebeurd en dan corrigeren we het). Geen
uitspraken over koers of rendement. Geen audit afgerond.

Twijfel je of iets mag? Dan mag het niet. Vraag het even.

## Toon

Nuchter en inhoudelijk. Geen moon, geen pump, geen emoji-regens, hooguit één
hashtag. We bouwen een compliance-protocol; het publiek dat we willen — uitgevers,
bouwers, het MetaDAO-ecosysteem — prikt door hype heen en haakt erop af.

De stelregel: voeg iets toe aan het gesprek, of zeg niks. Bij replies op X noemen
we Passage hooguit in één op de drie, en alleen als het natuurlijk valt. Het
product verkoopt zichzelf als het door de juiste mensen gezien wordt.

Verzoeken om "collab", DM's, follow-backs en soortgelijke farming negeren we
altijd, hoe groot het account ook is.

## Community — waar het nu staat

Er is een X-account (@passageRWA) met een klein maar echt publiek. Er is bewust
**geen eigen Discord of Telegram**: een leeg kanaal doet meer kwaad dan geen
kanaal. Dat komt er als er vraag naar is, niet ervoor.

De prioriteit is de **MetaDAO Discord** — daar zit precies het publiek dat ons moet
kennen vóórdat we ons aanmelden voor de launch. Meedoen als deelnemer: meelezen,
goede vragen stellen over het launch-proces, bijdragen waar je iets weet. Niet
binnenkomen met een pitch. De demo delen kan, maar als antwoord op iets, niet als
opening.

Wat we van X hebben geleerd: X heeft het account kort een spam-label gegeven na een
reeks inhoudelijke replies vanaf een jong account. Bezwaar toegewezen, label eraf,
dus onterecht. Toch houden we het tempo op een paar replies per dag met ruimte
ertussen — een paar replies extra leveren weinig op, en het account kwijtraken vlak
voor een launch kost alles.

## Hoe we werken

Overleg gaat via de groepschat. Documentatie gaat naar de repo, zodat er één versie
is. Verandert er iets aan de feiten — een programma erbij, een cijfer dat wijzigt —
dan gaat het meteen in de stukken, want die worden extern gelezen.

Wat er nog niet is: geld. In `LAUNCH.md` staat budget voor een tweede developer en
twee adviseurs met een omschreven mandaat, betaald uit de raise. Die raise is er
nog niet, en niemand heeft nu een toezegging. Wat er wel is: een werkend protocol,
een grant-aanvraag die klaarligt, en de ruimte om dit goed op te zetten.

## Wat er als eerste moet gebeuren

Voor mainnet: een security audit met openbaar rapport, de juridische structuur
(MiCA voor de token, effectenrecht voor de gewrapte assets, een entiteit), en
integratie met een echte KYC-provider.

Voor de ICO: de grant indienen, gesprekken met uitgevers, aanwezigheid in het
MetaDAO-ecosysteem, en een publiek dat groot genoeg is om een launch te dragen.

De volledige lijst staat in `assets/passage-status.pdf`, gegroepeerd naar wat wat
blokkeert.

## Links

- Demo: https://sewnretirement.github.io/Passage-Protocol/
- Code: https://github.com/SewnRetirement/passage-protocol
- SDK: `npm i @passage_protocol/hook-kit`
- X: https://x.com/passageRWA
- MetaDAO Discord: https://discord.com/invite/metadao
