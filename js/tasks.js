/* Aufgabendaten fuer "C-Variablentypen lernen" – Plattform: ATmega2560 (Arduino Mega 2560, avr-gcc).
 * Alles hier sind reine Daten. Neue Aufgaben einfach in ein tasks-Array einfuegen.
 *
 * Gelehrt werden nur die Ganzzahltypen mit fester Groesse aus <stdint.h>:
 *   uint8_t, int8_t, uint16_t, int16_t, uint32_t, int32_t, uint64_t, int64_t
 * Kommazahlen werden als Festkomma gespeichert: in einer kleineren, echten Einheit als Ganzzahl
 *   (m -> cm/mm, V -> mV, kg -> g, CHF -> Rappen), also Wert x Faktor (100, 1000 ...).
 *
 * Es geht nur um Variablentypen. In Codebeispielen zeigen LEDs an PORTA (und PORTB) nur den Wert einer Variablen an
 * (reine Kulisse, wird nicht erklaert oder abgefragt).
 *
 * Aufgabentypen (Feld "type"):
 *  choice    { q, code?, options:[..], answer:index, why?:[..pro Option], hint?, explain }
 *  yesno     { q, code?, answer:true|false, hint?, explain }
 *  number    { q, code?, answer:"Zahl als String", unit?, hint?, explain }
 *  bits      { q, bits:8|16, mode:"ohneVZ"|"mitVZ", target:Zahl, leds?:true, explain }
 *              leds: 8 Bit = LEDs an PORTA, 16 Bit = PORTB (High-Byte) + PORTA (Low-Byte)
 *  pickType  { q, code (mit ____), min:"..", max:"..", options:[Typnamen], notes?:{Typ:"Text"}, explain,
 *              scale?:10|100|1000.., real?:{min:"..",max:".."}, unit?:"..", sample?:"3.84" }
 *              -> min/max sind die GESPEICHERTEN (bei Festkomma: skalierten) Ganzzahlen.
 *              -> richtig ist jeder passende Typ mit der kleinsten Byte-Anzahl.
 *  findBug   { q, code:[Zeilen], bugLines:[Indizes], lineHint?, fixes:[..], fix:index, why?, explain }
 *
 * Info-Seite vor jedem Level (Feld "intro" im Level): Liste von Bausteinen, der Reihe nach angezeigt:
 *  { p: 'Absatz' }   { ul: ['Punkt', ..] }   { ol: ['Schritt', ..] }
 *  { table: { head: ['Spalte', ..], rows: [['Zelle', ..], ..] } }
 *  { code: 'C-Code mit \n' oder ['Zeile', ..] }   { tip: 'Merksatz' }
 *
 * Inline-Code in Texten mit `Backticks` markieren (wird sicher als <code> dargestellt).
 */

/* vz = mit Vorzeichen */
var TYPE_INFO = {
  'int8_t':   { bytes: 1, vz: true },
  'uint8_t':  { bytes: 1, vz: false },
  'int16_t':  { bytes: 2, vz: true },
  'uint16_t': { bytes: 2, vz: false },
  'int32_t':  { bytes: 4, vz: true },
  'uint32_t': { bytes: 4, vz: false },
  'int64_t':  { bytes: 8, vz: true },
  'uint64_t': { bytes: 8, vz: false }
};

/* Zeilen des Spickzettels. Wertebereich wird automatisch berechnet. */
var CHEAT_ROWS = [
  { type: 'uint8_t',  use: 'kleine Zähler (bis 255), Ja/Nein-Werte, LED-Muster' },
  { type: 'int8_t',   use: 'Temperatur in ganzen °C, kleine Differenzen' },
  { type: 'uint16_t', use: 'Sensorwert (0 … 1023), Spannung in mV, Strecke in m' },
  { type: 'int16_t',  use: 'Höhe in cm mit Vorzeichen, `int` bei avr-gcc' },
  { type: 'uint32_t', use: 'Millisekunden-Zähler, Festkomma-Zwischenergebnisse' },
  { type: 'int32_t',  use: 'Geldbeträge in Rappen, Positionen mit Vorzeichen' },
  { type: 'uint64_t', use: 'selten – auf 8 Bit langsam und gross' },
  { type: 'int64_t',  use: 'selten – auf 8 Bit langsam und gross' }
];

var LEVELS = [
  /* ------------------------------------------------------------ 1 */
  {
    id: 'grundlagen',
    title: 'Grundlagen',
    desc: 'Was ein Datentyp ist und wie das Namensschema funktioniert.',
    intro: [
      { p: 'Jede Variable hat einen Datentyp. Er legt fest, wie viele Bits sie hat und wie diese Bits gelesen werden. Hier lernst du die Ganzzahltypen mit fester Grösse. Ihr Name verrät alles:' },
      { table: { head: ['Teil des Namens', 'Bedeutung', 'Beispiel'], rows: [
        ['`u` am Anfang', 'ohne Vorzeichen (nur 0 und positiv)', '`uint8_t`'],
        ['ohne `u`', 'mit Vorzeichen (auch negativ)', '`int8_t`'],
        ['Zahl', 'Anzahl Bits (8, 16, 32 oder 64)', '`uint16_t` = 16 Bit'],
        ['`_t`', '„type“ – zeigt, dass es ein Typname ist', '']
      ] } },
      { code: ['#include <stdint.h>     // bringt uint8_t, int16_t, ...',
               'uint8_t zaehler = 0;    // Typ, Name, Startwert'] },
      { p: 'Warum nicht einfach `int`? Die klassischen C-Typen haben keine feste Grösse. Bei avr-gcc auf dem ATmega2560 hat `int` nur 16 Bit, auf einem PC meist 32 Bit. Bei `int16_t` & Co. steht die Grösse im Namen.' },
      { tip: 'Nimm immer `uint8_t`, `int16_t` & Co. aus `<stdint.h>`.' }
    ],
    fact: {
      title: '`int` ist nicht überall gleich gross',
      text: 'Auf dem ATmega2560 hat `int` nur 16 Bit, auf deinem PC meist 32 Bit. Derselbe Code kann also auf dem PC funktionieren und auf dem Mikrocontroller überlaufen. Genau deshalb gibt es `<stdint.h>`: `int32_t` hat überall 32 Bit.'
    },
    tasks: [
      { type: 'choice',
        q: 'Was legt der Datentyp einer Variablen in C fest?',
        options: ['Wie viele Bits sie hat und wie diese Bits gedeutet werden',
                  'Nur den Namen der Variablen',
                  'In welcher Datei die Variable stehen muss',
                  'Die Farbe im Code-Editor'],
        answer: 0,
        explain: 'Der Typ sagt dem Compiler zwei Dinge: wie viele Bits die Variable hat und wie die Bits zu lesen sind. Dieselben 8 Bits `11111111` sind z.B. 255 als `uint8_t`, aber −1 als `int8_t`.' },
      { type: 'choice',
        q: 'Was bedeuten das „u“ und die „16“ in `uint16_t`?',
        options: ['ohne Vorzeichen, 16 Bit', 'universal, 16 Byte', 'ohne Vorzeichen, 16 Byte', 'user-defined, Version 16'],
        answer: 0,
        why: [null, 'Das „u“ steht nicht für universal – und die Zahl zählt Bits, nicht Bytes.', 'Fast: Die Zahl im Namen zählt Bits, nicht Bytes.', 'Nein, mit Versionen hat das nichts zu tun.'],
        explain: '`uint16_t` = „unsigned integer“, englisch für Ganzzahl ohne Vorzeichen, mit 16 Bit; `_t` steht für type.' },
      { type: 'yesno',
        q: 'Kann eine Variable vom Typ `uint8_t` negative Zahlen speichern?',
        answer: false,
        explain: 'Nein. Das `u` steht für „unsigned“ (ohne Vorzeichen): `uint8_t` speichert nur 0 und positive Zahlen. Mit Vorzeichen wäre es `int8_t`.' },
      { type: 'choice',
        q: 'Welche Zeile macht die Typen `uint8_t`, `int16_t` & Co. bekannt?',
        options: ['`#include <stdint.h>`', '`#include <math.h>`', '`#include <types8.h>`', '`#include <int.h>`'],
        answer: 0,
        why: [null, '`<math.h>` hat mathematische Funktionen, keine Typen.', 'Diese Datei gibt es nicht.', 'Diese Datei gibt es nicht.'],
        explain: '`<stdint.h>` („standard integer“) definiert die Ganzzahltypen mit fester Grösse: `uint8_t` bis `int64_t`.' },
      { type: 'number',
        q: 'Wie viele Bits hat ein `int` bei avr-gcc auf dem ATmega2560?',
        answer: '16', unit: 'Bits',
        hint: 'Auf dem PC sind es meist 32 – auf dem ATmega weniger.',
        explain: 'Auf dem AVR hat `int` nur 16 Bit (wie `int16_t`). Darum schreibt man besser gleich `int16_t` oder `int32_t`: Da steht die Grösse im Namen.' }
    ]
  },
  /* ------------------------------------------------------------ 2 */
  {
    id: 'wertebereich',
    title: 'Bits & Wertebereich',
    desc: 'Bits und Bytes eines Typs, die Formel 2ⁿ, Min und Max.',
    intro: [
      { p: 'Die Zahl im Typnamen sind Bits. 8 Bits sind 1 Byte, also: Bytes = Bits ÷ 8. Das `u` ändert die Grösse nicht: `uint16_t` und `int16_t` haben beide 16 Bit.' },
      { p: 'Jedes Bit verdoppelt die Anzahl möglicher Werte: Mit n Bits gibt es 2ⁿ Werte. Wie sie verteilt werden, hängt vom Vorzeichen ab:' },
      { table: { head: ['', 'kleinster Wert', 'grösster Wert'], rows: [
        ['ohne Vorzeichen (`uintN_t`)', '0', '2ⁿ − 1'],
        ['mit Vorzeichen (`intN_t`)', '−2ⁿ⁻¹', '2ⁿ⁻¹ − 1']
      ] } },
      { p: 'Beispiel mit 4 Bits: 2⁴ = 16 Werte. Ohne Vorzeichen 0 … 15, mit Vorzeichen −8 … 7. Das „− 1“ beim Maximum kommt von der 0, die auch einen Platz braucht.' },
      { tip: 'Passt ein Wert? Bits aus dem Namen ablesen, Min und Max ausrechnen, vergleichen.' }
    ],
    fact: {
      title: 'millis() und die 49.7 Tage',
      text: 'Die Arduino-Funktion `millis()` zählt die Millisekunden seit dem Start in einem 32-Bit-Wert ohne Vorzeichen. Nach 2³² ms – rund 49.7 Tagen – springt sie wieder auf 0. Wer Zeiten mit `if (millis() > ende)` vergleicht, erlebt dann eine Überraschung.'
    },
    tasks: [
      { type: 'number',
        q: 'Wie viele Bytes hat ein `int32_t`?',
        answer: '4', unit: 'Bytes',
        hint: 'Die Zahl im Namen sind Bits. Teile durch 8.',
        explain: '32 Bit ÷ 8 = 4 Byte – auf jeder Plattform, auch auf dem ATmega2560.' },
      { type: 'choice',
        q: 'Wie viele verschiedene Werte kann man mit n Bits darstellen?',
        options: ['n', '2 · n', '2ⁿ', 'n²'],
        answer: 2,
        why: ['Schon 1 Bit hat 2 Werte (0 und 1).', 'Das wächst zu langsam: 8 Bits haben 256 Werte, nicht 16.', null, '8 Bits haben 256 Werte, nicht 64.'],
        explain: 'Jedes Bit verdoppelt die Möglichkeiten: 1 Bit → 2, 2 Bits → 4, 8 Bits → 2⁸ = 256 Werte.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `uint8_t`?',
        answer: '255',
        hint: 'Formel: 2⁸ − 1',
        explain: '2⁸ − 1 = 255: alle 8 Bits sind 1.' },
      { type: 'number',
        q: 'Was ist der kleinste Wert eines `int8_t`?',
        answer: '-128',
        hint: 'Formel: −2⁷',
        explain: '`int8_t`: −2⁷ = −128 bis 2⁷ − 1 = 127. Es gibt einen negativen Wert mehr als positive, weil die 0 bei den „positiven“ mitgezählt wird.' },
      { type: 'yesno',
        q: 'Passt der Wert 40000 in einen `int16_t` (= `int` auf dem ATmega2560)?',
        answer: false,
        explain: 'Ein `int16_t` reicht von −32\'768 bis 32\'767. 40\'000 ist zu gross. In einen `uint16_t` (bis 65\'535) würde es passen.' }
    ]
  },
  /* ------------------------------------------------------------ 3 */
  {
    id: 'vorzeichen',
    title: 'Vorzeichen & Bits',
    desc: 'Die Bits einer Variable einstellen, auf LEDs sehen, das Zweierkomplement.',
    intro: [
      { p: 'Jedes Bit hat eine Wertigkeit: ganz rechts 1, nach links verdoppelt sie sich. Der Wert ist die Summe aller Bits, die 1 sind. Die LEDs zeigen die Bits: Bit 7 links, Bit 0 rechts.' },
      { table: { head: ['Bit / LED', '7', '6', '5', '4', '3', '2', '1', '0'], rows: [
        ['Wert ohne Vorzeichen', '128', '64', '32', '16', '8', '4', '2', '1'],
        ['Wert mit Vorzeichen', '−128', '64', '32', '16', '8', '4', '2', '1']
      ] } },
      { p: 'Typen mit Vorzeichen (`int8_t` …) verwenden das Zweierkomplement: Das oberste Bit zählt negativ. Negative Zahl einstellen: Bits der positiven Zahl umkehren, dann 1 addieren. Beispiel −6: `00000110` → `11111001` → `11111010`.' },
      { tip: 'Die Bits allein sagen nicht, welche Zahl gemeint ist – erst der Typ entscheidet, wie sie gelesen werden.' }
    ],
    fact: {
      title: 'Pac-Man und Level 256',
      text: 'Im Arcade-Klassiker Pac-Man wird der Level-Zähler in 8 Bit gespeichert. Beim Erreichen von Level 256 läuft eine Berechnung über und die rechte Bildschirmhälfte wird zu Zeichensalat – der berühmte „Kill Screen“. Das Level ist nicht lösbar.'
    },
    tasks: [
      { type: 'bits', bits: 8, mode: 'ohneVZ', target: 200, leds: true,
        q: 'Warm-up: Stelle die Bits von `uint8_t x = 200;` ein. Klicke die Bits an – die LEDs zeigen sie.',
        explain: '200 = 128 + 64 + 8 → `11001000`: Bit 7, 6 und 3 sind 1.' },
      { type: 'bits', bits: 8, mode: 'mitVZ', target: -1, leds: true,
        q: 'Stelle −1 als `int8_t` ein.',
        explain: 'Im Zweierkomplement ist −1 = `11111111` – alle 8 LEDs leuchten: −128 + 127 = −1.' },
      { type: 'choice',
        q: 'Eine 8-Bit-Variable enthält die Bits `11111111`. Welchen Wert hat sie als `uint8_t` und welchen als `int8_t`?',
        options: ['`uint8_t`: 255, `int8_t`: −1', 'beide 255', '`uint8_t`: 255, `int8_t`: −127', '`uint8_t`: −1, `int8_t`: 255'],
        answer: 0,
        why: [null, 'Ein `int8_t` geht nur bis 127 – 255 kann er gar nicht speichern.', 'Bit 7 zählt −128, die anderen 7 Bits zusammen 127: −128 + 127 = −1.', 'Vertauscht: `uint8_t` kann nicht negativ sein.'],
        explain: 'Dieselben Bits, zwei Deutungen: Ohne Vorzeichen zählt Bit 7 +128 (Summe 255), mit Vorzeichen −128 (Summe −1).' },
      { type: 'bits', bits: 8, mode: 'mitVZ', target: 127, leds: true,
        q: 'Stelle den grössten möglichen `int8_t`-Wert ein.',
        explain: '`01111111` = 127. Das oberste Bit (Vorzeichen-Bit) muss 0 bleiben – sobald es 1 ist, wird die Zahl negativ.' },
      { type: 'yesno',
        q: 'Bei einem `int8_t` ist Bit 7 gesetzt. Ist der Wert dann immer negativ?',
        answer: true,
        explain: 'Ja. Bit 7 zählt −128, alle anderen Bits zusammen höchstens +127. Die Summe ist also immer kleiner als 0. Bei `uint8_t` wäre derselbe Wert 128 oder mehr.' }
    ]
  },
  /* ------------------------------------------------------------ 4 */
  {
    id: 'festkomma',
    title: 'Kommazahlen als Festkomma',
    desc: 'Kommazahlen skaliert als Ganzzahl speichern und den Typ dafür wählen.',
    intro: [
      { p: 'Ganzzahltypen speichern keine Nachkommastellen. Darum speicherst du Kommazahlen als Festkomma: Wert × Faktor, als Ganzzahl. Der ATmega2560 hat keine Gleitkomma-Einheit – so rechnet er schnell und exakt.' },
      { table: { head: ['Wert', 'Faktor', 'gespeichert', 'Bedeutung'], rows: [
        ['1.75 m', '× 100', '175', 'Zentimeter (cm)'],
        ['12.50 CHF', '× 100', '1250', 'Rappen'],
        ['4.8 V', '× 1000', '4800', 'Millivolt (mV)'],
        ['72.35 kg', '× 1000', '72350', 'Gramm (g)']
      ] } },
      { ol: [
        'Eine kleinere Einheit wählen, die keine Kommastellen mehr braucht: m → cm (× 100) oder mm (× 1000), V → mV (× 1000), kg → g (× 1000), CHF → Rappen (× 100).',
        'Wert × Faktor rechnen – das ist die gespeicherte Ganzzahl in der neuen Einheit. Schreib die Einheit in den Namen, z.B. `laenge_cm`.',
        'Negativ? Dann einen Typ mit Vorzeichen.',
        'Typ nach dem gespeicherten (skalierten) Wert wählen, nicht nach dem angezeigten.'
      ] },
      { tip: 'Ein kleiner Kommawert kann eine grosse Ganzzahl werden.' }
    ],
    fact: {
      title: 'Patriot-Rakete: 0.1 ist nicht 0.1',
      text: '1991 verfehlte eine Patriot-Abwehrrakete in Dhahran ihr Ziel; 28 Soldaten starben. Das System zählte die Zeit in Zehntelsekunden und multiplizierte mit 0.1 – gespeichert in einem 24-Bit-Festkommawert. 0.1 ist binär aber ein unendlicher Bruch und wurde abgeschnitten. Nach 100 Stunden war die Uhr um etwa 0.34 Sekunden daneben. Hätte das System die Zeit als ganze Millisekunden in einer Ganzzahl gezählt, wäre der Wert exakt geblieben.'
    },
    tasks: [
      { type: 'choice',
        q: 'Ein Preis soll auf 2 Nachkommastellen genau gespeichert werden (z.B. 12.95 CHF). Welchen Faktor wählst du?',
        options: ['× 10', '× 100', '× 1000', '× 2'],
        answer: 1,
        why: ['Dann bliebe nur eine Nachkommastelle: aus 12.95 würde 129 (= 12.9).', null, 'Geht, ist aber genauer als nötig und braucht grössere Zahlen.', 'Der Faktor ist eine Zehnerpotenz – eine pro Nachkommastelle.'],
        explain: '2 Nachkommastellen → × 100: 12.95 CHF = 1295 Rappen.' },
      { type: 'number',
        q: 'Eine Strecke von 3.84 km wird mit dem Faktor 1000 gespeichert (also in Metern). Welche Ganzzahl steht in der Variablen?',
        answer: '3840', unit: 'm',
        explain: '3.84 × 1000 = 3840. Die Variable enthält 3840 – die Bedeutung „km“ steckt nur im Faktor.' },
      { type: 'choice',
        q: 'Welcher ist der kleinste Typ, der den gespeicherten Wert 3840 (= 3.84 km) aufnehmen kann?',
        options: ['`uint8_t`', '`uint16_t`', '`uint32_t`', '`int8_t`'],
        answer: 1,
        why: ['Denkfehler: 3.84 sieht klein aus, aber gespeichert wird 3840 – und `uint8_t` geht nur bis 255.', null, 'Passt, ist aber doppelt so gross wie nötig.', 'Geht nur bis 127 – viel zu klein für 3840.'],
        explain: '3840 passt nicht in 8 Bit (max. 255), aber in `uint16_t` (max. 65\'535). Entscheidend ist immer der skalierte Wert.' },
      { type: 'number',
        q: 'Ein Tiefenmesser speichert die Höhe zur Wasseroberfläche in Zentimetern als `int16_t` (175 = 1.75 m). Welcher Wert steht für −3.75 m?',
        answer: '-375', unit: 'cm',
        explain: '−3.75 m × 100 = −375 cm. Weil der Wert negativ sein kann, braucht es einen Typ mit Vorzeichen.' },
      { type: 'yesno',
        q: 'Eine Kabellänge von 0.00 bis 2.50 m wird in Zentimetern gespeichert (Faktor 100). Passt sie in einen `uint8_t`?',
        answer: true,
        explain: 'Ja, knapp: 2.50 m = 250 cm, und `uint8_t` geht bis 255. In Millimetern (2500 mm) würde es nicht mehr passen.' }
    ]
  },
  /* ------------------------------------------------------------ 5 */
  {
    id: 'typwahl',
    title: 'Den richtigen Typ wählen',
    desc: 'Der kleinste Typ, der sicher passt – auch für Festkomma und negative Werte.',
    intro: [
      { p: 'Wähle für eine Variable den kleinsten Typ, der sicher passt. Ein 8-Bit-Controller rechnet mit `uint8_t` in einem Schritt, mit `uint32_t` braucht er mehrere Befehle. So gehst du vor:' },
      { ol: [
        'Komma? Dann zuerst Minimum und Maximum mit dem Faktor multiplizieren.',
        'Negativ? Dann einen Typ mit Vorzeichen (`intN_t`), sonst `uintN_t`.',
        'Kleinsten Typ nehmen, in den Minimum und Maximum beide passen.'
      ] },
      { table: { head: ['Typ', 'Bereich'], rows: [
        ['`uint8_t` / `int8_t`', '0 … 255 / −128 … 127'],
        ['`uint16_t` / `int16_t`', '0 … 65\'535 / −32\'768 … 32\'767'],
        ['`uint32_t` / `int32_t`', '0 … ca. 4.29 Mrd. / ca. ±2.1 Mrd.']
      ] } }
    ],
    fact: {
      title: 'Gangnam Style knackt den Zähler',
      text: 'YouTube zählte Aufrufe in einer 32-Bit-Ganzzahl mit Vorzeichen. Ende 2014 näherte sich das Video „Gangnam Style“ der Grenze von 2\'147\'483\'647 Aufrufen – YouTube stellte den Zähler darum auf 64 Bit um.'
    },
    tasks: [
      { type: 'pickType',
        q: 'Ein Rundenzähler für ein Spiel – höchstens 200, nie negativ.',
        code: '____ runden = 0;',
        min: '0', max: '200',
        options: ['int8_t', 'uint8_t', 'uint16_t', 'int32_t'],
        explain: '`uint8_t` deckt 0 … 255 ab und braucht nur 1 Byte. `int8_t` reicht nur bis 127 – 200 würde überlaufen.' },
      { type: 'pickType',
        q: 'Ein Temperatursensor liefert ganze Grad Celsius von −40 bis +85 °C.',
        code: '____ temperatur = -12;',
        min: '-40', max: '85',
        options: ['uint8_t', 'int8_t', 'int16_t', 'int32_t'],
        explain: '`int8_t` (−128 … 127) deckt −40 … 85 ab, mit nur 1 Byte. Ein Typ ohne Vorzeichen kann keine negativen Werte speichern.' },
      { type: 'pickType',
        q: 'Ein Tauchcomputer misst die Höhe von −50.00 bis 200.00 m, auf Zentimeter genau (Faktor 100, in cm). Beispiel: −12.50 m.',
        code: '____ hoehe_cm = -1250;   // -12.50 m',
        min: '-5000', max: '20000', scale: 100, real: { min: '-50.00', max: '200.00' }, unit: 'm', sample: '200.00',
        options: ['uint8_t', 'int8_t', 'uint16_t', 'int16_t'],
        explain: 'In cm: −5\'000 … 20\'000. Negativ → mit Vorzeichen; 20\'000 sprengt 8 Bit, passt aber in `int16_t` (bis 32\'767).' },
      { type: 'pickType',
        q: 'Das Guthaben einer Kantinenkarte von −500.00 bis 500.00 CHF, auf Rappen genau (Faktor 100).',
        code: '____ guthaben_rp = -1250;   // -12.50 CHF',
        min: '-50000', max: '50000', scale: 100, real: { min: '-500.00', max: '500.00' }, unit: 'CHF', sample: '500.00',
        options: ['int16_t', 'uint16_t', 'int32_t', 'int64_t'],
        explain: 'Skaliert: −50\'000 … 50\'000. `int16_t` geht nur bis 32\'767, `uint16_t` kann nicht negativ sein – also braucht es `int32_t`.' },
      { type: 'yesno',
        q: 'Ein Zähler soll die Millisekunden von 30 Tagen speichern: bis 2\'592\'000\'000. Reicht dafür ein `int32_t`?',
        answer: false,
        explain: 'Nein. `int32_t` geht nur bis 2\'147\'483\'647 (ca. 2.1 Mrd.). Weil der Zähler nie negativ ist, passt `uint32_t` (bis ca. 4.29 Mrd.) – gleich gross, aber ohne Vorzeichen.' }
    ]
  },
  /* ------------------------------------------------------------ 6 */
  {
    id: 'umwandlung',
    title: 'Überlauf & Umwandlung',
    desc: 'Überlauf, Abschneiden, signed ↔ unsigned, Integer-Promotion und Casts.',
    intro: [
      { p: 'Passt ein Wert nicht in seinen Typ, geht etwas verloren. C wandelt Werte ausserdem oft automatisch um:' },
      { ul: [
        'Überlauf: Ein `uintN_t` springt nach dem Maximum wieder auf 0 (255 + 1 → 0). Bei `intN_t` ist das undefiniert, avr-gcc springt meist ins Negative.',
        'Zuweisen an einen kleineren Typ ohne Vorzeichen: Nur die unteren Bits bleiben (Wert mod 2ⁿ).',
        'signed ↔ unsigned: Die Bits bleiben gleich, nur ihre Deutung ändert sich.',
        'Integer-Promotion: Vor dem Rechnen werden `uint8_t` und `int8_t` zu `int` erweitert – auf dem ATmega 16 Bit. Gerechnet wird nicht im Typ der Zielvariable.',
        'Ein Cast `(uint32_t)a * b` vor der Multiplikation lässt in 32 Bit rechnen.'
      ] },
      { tip: 'Frag dich: In welchem Typ wird gerechnet – und passt das Ergebnis in den Typ, in dem es landet?' }
    ],
    fact: {
      title: 'Ariane 5: 370 Millionen Dollar Überlauf',
      text: 'Am 4. Juni 1996 zerstörte sich die Rakete Ariane 5 rund 37 Sekunden nach dem Start. Ursache: Eine 64-Bit-Kommazahl (horizontale Geschwindigkeit) wurde in eine 16-Bit-Ganzzahl mit Vorzeichen umgewandelt. Der Wert war grösser als 32\'767 – der Überlauf brachte das Steuersystem zum Absturz.'
    },
    tasks: [
      { type: 'number',
        q: 'Welchen Wert hat `y`?',
        code: ['uint16_t x = 300;', 'uint8_t  y = x;'],
        answer: '44',
        hint: 'Ein `uint8_t` behält nur die unteren 8 Bit: Wert mod 256.',
        explain: '300 passt nicht in 8 Bit. Übrig bleibt 300 mod 256 = 44 (= 300 − 256).' },
      { type: 'number',
        q: 'Welchen Wert hat `s` bei avr-gcc?',
        code: ['uint8_t u = 200;', 'int8_t  s = u;'],
        answer: '-56',
        hint: '200 passt nicht in `int8_t` (max. 127). Die Bits bleiben gleich – Bit 7 zählt jetzt −128.',
        explain: '200 = `11001000`. Als `int8_t` gelesen: −128 + 64 + 8 = −56 (= 200 − 256). Laut C-Standard ist das implementierungsabhängig, avr-gcc behält einfach die Bits.' },
      { type: 'choice',
        q: 'Welchen Wert hat `summe`?',
        code: ['uint8_t a = 200;', 'uint8_t b = 100;', 'uint16_t summe = a + b;'],
        options: ['300', '44', '255', '0'],
        answer: 0,
        why: [null, '44 käme heraus, wenn das Ziel ein `uint8_t` wäre – hier ist es ein `uint16_t`.', 'C begrenzt nicht auf den Maximalwert.', 'Nein.'],
        explain: 'Integer-Promotion: `a` und `b` werden vor dem Rechnen zu `int` (16 Bit) erweitert. 200 + 100 = 300 passt in 16 Bit und in den `uint16_t`.' },
      { type: 'findBug',
        q: 'Ein Besucherzähler soll bis 200 zählen und dann wieder bei 0 beginnen. Im Debugger springt `besucher` aber nach 127 auf −128, und 200 wird nie erreicht. Welche Zeile?',
        code: ['#define F_CPU 16000000UL', '#include <avr/io.h>', '#include <util/delay.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF;', '    int8_t besucher = 0;      // 0 … 200', '    while (1) {', '        besucher++;', '        PORTA = besucher;', '        _delay_ms(500);', '        if (besucher == 200) {', '            besucher = 0;', '        }', '    }', '}'],
        bugLines: [7],
        lineHint: 'Welchen Wertebereich hat der Typ von `besucher`?',
        fixes: ['`uint8_t besucher = 0;`', '`int8_t besucher = 1;`', '`if (besucher >= 200) {`', '`int8_t besucher = -128;`'],
        fix: 0,
        why: [null, 'Der Startwert ändert nichts am Bereich: Ein `int8_t` geht nur bis 127.', 'Auch `>=` wird nie wahr – ein `int8_t` ist nie grösser als 127.', 'Dann zählt er zwar länger, erreicht 200 aber trotzdem nie.'],
        explain: 'Ein `int8_t` reicht nur von −128 bis 127. 127 + 1 = 128 passt nicht hinein, avr-gcc speichert −128. `besucher == 200` ist darum nie wahr. Mit `uint8_t` (0 … 255) passt 200.' },
      { type: 'findBug',
        q: 'Die Leistung soll 1200 mW sein. Die LEDs zeigen aber 20. Welche Zeile ist schuld?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF; DDRB = 0xFF;', '    uint16_t spannung_mv = 4800;                      // 4.800 V', '    uint16_t strom_ma = 250;                          // 0.250 A', '    uint32_t leistung_uw = spannung_mv * strom_ma;    // µW', '    uint16_t leistung_mw = leistung_uw / 1000;', '    PORTB = leistung_mw >> 8;', '    PORTA = leistung_mw & 0xFF;', '    while (1) { }', '}'],
        bugLines: [7],
        lineHint: 'Das Ziel ist ein `uint32_t` – aber in welchem Typ wird die Multiplikation auf dem ATmega gerechnet?',
        fixes: ['`uint32_t leistung_uw = (uint32_t)spannung_mv * strom_ma;`', '`uint32_t leistung_uw = (uint32_t)(spannung_mv * strom_ma);`', '`uint16_t leistung_uw = spannung_mv * strom_ma;`', '`uint64_t leistung_uw = spannung_mv * strom_ma;`'],
        fix: 0,
        why: [null, 'Die Klammer rechnet zuerst in 16 Bit – der Überlauf passiert vor der Umwandlung.', 'Dann ist auch das Ziel zu klein.', 'Die Multiplikation passiert trotzdem in 16 Bit.'],
        explain: 'Auf dem ATmega ist `int` 16 Bit, also wird `uint16_t * uint16_t` in 16 Bit gerechnet: 1\'200\'000 mod 65\'536 = 20\'352, ÷ 1000 = 20. Wird ein Operand vorher zu `uint32_t`, rechnet C in 32 Bit.' }
    ]
  },
  /* ------------------------------------------------------------ 7 */
  {
    id: 'pruefung',
    title: 'Abschlussprüfung',
    desc: 'Fünf anspruchsvolle Aufgaben aus allen Levels – ohne Spickzettel.',
    cheat: false,
    exam: true,
    intro: [
      { p: 'Die Abschlussprüfung mischt Aufgaben aus allen Levels. Der Spickzettel ist gesperrt – diese Info kannst du aber jederzeit wieder öffnen.' },
      { ul: [
        'Namensschema: `u` = ohne Vorzeichen, Zahl = Bits. Auf dem ATmega hat `int` 16 Bit.',
        'Wertebereich mit n Bits: ohne Vorzeichen 0 … 2ⁿ − 1, mit Vorzeichen −2ⁿ⁻¹ … 2ⁿ⁻¹ − 1.',
        'Zweierkomplement: Das oberste Bit zählt negativ.',
        'Festkomma: Wert × Faktor; Typ nach dem skalierten Bereich wählen.',
        'Umwandlung: Ein kleinerer Typ behält nur die unteren Bits, signed ↔ unsigned behält die Bits. Gerechnet wird mindestens in `int`.'
      ] },
      { tip: 'Lies jede Aufgabe genau: Welcher Typ, wie viele Bits, mit oder ohne Vorzeichen, welcher Faktor? Viel Erfolg!' }
    ],
    tasks: [
      { type: 'pickType',
        q: 'Eine Waage misst 0.000 bis 150.000 kg, auf Gramm genau (Faktor 1000).',
        code: '____ gewicht_g = 72350;   // 72.350 kg',
        min: '0', max: '150000', scale: 1000, real: { min: '0.000', max: '150.000' }, unit: 'kg', sample: '150.000',
        options: ['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t'],
        explain: 'Skaliert: 0 … 150\'000. Das ist mehr als 65\'535 → `uint32_t`.' },
      { type: 'bits', bits: 16, mode: 'ohneVZ', target: 65534, leds: true,
        q: 'Nach `int16_t x = -2; uint16_t u = x;` – stelle die 16 Bits von `u` ein (PORTB = obere 8 Bit, PORTA = untere 8 Bit).',
        explain: '−2 als `int16_t` ist `11111111 11111110`. Die Bits bleiben gleich, als `uint16_t` gelesen: 65\'536 − 2 = 65\'534.' },
      { type: 'yesno',
        q: 'Leuchten die LEDs?',
        code: ['uint8_t a = 200, b = 100;', 'DDRA = 0xFF;', 'if (a + b > 255) {', '    PORTA = 0xFF;', '}'],
        answer: true,
        explain: 'Ja. `a + b` wird nach der Integer-Promotion in `int` gerechnet und ist 300 – nicht 44. Abgeschnitten wird erst, wenn du das Ergebnis in einem `uint8_t` speicherst.' },
      { type: 'choice',
        q: 'Was zeigen die LEDs? (avr-gcc, `int` = 16 Bit)',
        code: ['int16_t  temp = -5;', 'uint16_t grenze = 10;', 'DDRA = 0xFF;', 'if (temp < grenze) {', '    PORTA = 0xFF;', '} else {', '    PORTA = 0x00;', '}'],
        options: ['Alle aus – `temp` wird zu 65\'531 umgewandelt', 'Alle an – −5 ist kleiner als 10', 'Der Compiler verweigert den Vergleich', 'Nur LED 0 leuchtet'],
        answer: 0,
        why: [null, 'Mathematisch ja – aber C vergleicht hier ohne Vorzeichen.', 'Der Compiler warnt höchstens – übersetzt wird es.', 'Im Code wird nur `0xFF` oder `0x00` ausgegeben.'],
        explain: '`uint16_t` ist so breit wie `int`, darum wird `temp` zu unsigned: −5 → 65\'531. 65\'531 < 10 ist falsch, die LEDs bleiben aus. Mit `int8_t` und `uint8_t` wären beide `int` und −5 < 10 wäre wahr.' },
      { type: 'findBug',
        q: 'Bei Frost sollen alle LEDs leuchten. Der Sensor meldet −5 °C, die LEDs bleiben aber dunkel. Welche Zeile?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int8_t temp_lesen(void);   // liefert -20 … 50 °C', '', 'int main(void) {', '    DDRA = 0xFF;', '    while (1) {', '        uint8_t temp = temp_lesen();', '        if (temp < 0) {', '            PORTA = 0xFF;', '        } else {', '            PORTA = 0x00;', '        }', '    }', '}'],
        bugLines: [8],
        lineHint: 'Die Bedingung ist an sich richtig – aber kann die Variable überhaupt negativ werden?',
        fixes: ['`int8_t temp = temp_lesen();`', '`uint16_t temp = temp_lesen();`', '`if (temp <= 0)`', '`uint8_t temp = -temp_lesen();`'],
        fix: 0,
        why: [null, 'Auch ohne Vorzeichen – aus −5 wird 65\'531.', 'Ein `uint8_t` ist nur bei genau 0 „≤ 0“ – bei −5 °C nicht.', 'Dann wären positive Temperaturen falsch.'],
        explain: 'Ein `uint8_t` kann nicht negativ sein: −5 wird zu 251. `temp < 0` ist immer falsch. Für Werte, die negativ werden können, braucht es einen Typ mit Vorzeichen: `int8_t` (−128 … 127).' }
    ]
  }
];

/* Akzentfarbe pro Level (gleiche Reihenfolge wie LEVELS). Alle hell genug fuer dunkle Schrift. */
var LEVEL_COLORS = ['#FFD23F', '#3DD6AE', '#5AA9FF', '#B79CFF', '#B5E655', '#FF7FB6', '#FF5A4E'];

/* Raenge, abgeleitet aus dem Gesamtfortschritt (Anteil geloester Aufgaben).
 * Bei 7 x 5 = 35 Aufgaben: neuer Rang nach Level 1 (5), 2 (10), 4 (20), 6 (30) und 7 (35). */
var RANKS = [
  { min: 0,    name: 'Bit-Neuling' },
  { min: 0.14, name: 'Byte-Sammler' },
  { min: 0.28, name: 'Overflow-Jäger' },
  { min: 0.57, name: 'Festkomma-Profi' },
  { min: 0.85, name: 'Typ-Meister' },
  { min: 1,    name: 'AVR-Legende' }
];

/* Sprueche von Bit, dem Maskottchen. Du-Form, Schweizer Schreibweise. */
var BIT_SAYS = {
  right: [
    'Richtig. Sauber gelöst.',
    'Genau so. avr-gcc wäre stolz.',
    'Treffer. Kein einziges Bit verschwendet.',
    'Passt. Weiter im Takt – 16 MHz, versteht sich.',
    'Korrekt – das sitzt.',
    'Ja! Das hättest du auch in Assembler gewusst.',
    'Stimmt. Alle LEDs auf Grün.',
    'Richtig. Notier dir das ruhig als Erfolg.',
    'Volltreffer. Null Fehler, null Drama.',
    'Bingo. Deine Bits sind gut sortiert.'
  ],
  wrong: [
    'Ups, nicht ganz. Nochmal?',
    'Knapp daneben. Das passiert den Besten.',
    'Noch nicht. Schau nochmal genau hin.',
    'Fast. Ein Bit fehlt noch zum Glück.',
    'Nope – aber jetzt weisst du schon, was es nicht ist.',
    'Daneben. Kein Problem, neuer Versuch.',
    'Hm, das passt nicht ganz. Der Tipp hilft.',
    'Nicht ganz. Fehler sind hier gratis – kein Bit wird verletzt.',
    'Leider nein. Atme kurz durch, dann nochmal.'
  ],
  meh: 'Funktioniert – aber nicht optimal.',
  retryRight: ' Drangeblieben lohnt sich.',
  streak: {
    3: '3 in Folge! Du bist warmgelaufen.',
    5: '5 in Folge! Das ganze Level ohne einen Fehler.'
  },
  home: [
    'Hoi! Ich bin Bit. Ich wohne auf einem ATmega2560 und kenne jeden seiner Typen – von `uint8_t` bis `int64_t`.',
    'Bereit? Ein Level nach dem anderen, ohne Stress.',
    'Ich bin ein Mikrochip, aber ich mag Menschen, die Typen mit fester Grösse wählen.'
  ],
  back: [
    'Da bist du ja wieder. Weiter geht\'s!',
    'Schön, dich zu sehen. Dein Fortschritt hat auf dich gewartet.',
    'Willkommen zurück. Ich hab deine Bits gut aufbewahrt.'
  ],
  allDone: 'Alles geschafft. Ab jetzt bist du offiziell gefährlich gut in C-Typen auf dem AVR.',
  intro: [
    'Kurz lesen, dann loslegen. Du kannst das Info später jederzeit wieder öffnen.',
    'Erst die Theorie, dann die Praxis. Kurz und schmerzlos.',
    'Lies das in Ruhe – die Aufgaben laufen dir nicht davon.'
  ],
  done: [
    'Level geschafft! Ich mach einen kleinen Freudensprung.',
    'Erledigt! Das merke ich mir – Bit für Bit.',
    'Abgehakt. Du wirst gerade richtig gut.'
  ],
  play: 'Hier kannst du nichts kaputt machen. Ausser den Wertebereich.',
  rankUp: 'Neuer Rang!'
};

/* Sprueche, wenn man Bit anstupst. Du-Form, Schweizer Schreibweise. */
var BIT_POKE = [
  'Hey, das kitzelt! Zum Glück bin ich gegen Bitflips versiegelt.',
  'Wusstest du? Ein Byte hat 8 Bit – genau so viele hat ein `uint8_t`.',
  '`uint8_t` geht von 0 bis 255. Mehr passt nicht in 8 Bit.',
  'Ich ticke mit 16 MHz. Das sind 16 Millionen Takte pro Sekunde – und ich langweile mich trotzdem nie.',
  'Ich habe keine FPU. Kommazahlen rechne ich lieber in Millivolt und Millimetern.',
  'Ein Nibble sind 4 Bit. Klingt nach Znüni, ist aber eine Hex-Ziffer.',
  'Wenn ein `uint8_t` bei 255 noch eins drauflegt, fängt er wieder bei 0 an. Kreislauf des Lebens.',
  'Bei mir ist `int` nur 16 Bit. Darum schreibe ich lieber gleich `int16_t`.',
  'Psst: `int16_t` und `uint16_t` sind gleich gross. Nur die Deutung der Bits ist anders. Mein Lieblingsfakt.',
  '`int8_t` −1 und `uint8_t` 255 sind dieselben 8 Bits. Nur der Typ entscheidet, was sie bedeuten.'
];

/* ---------- Simulator: Beispielprogramme (Daten fuer js/sim.js) ---------- */
/* Es geht um Variablentypen. Die LEDs an PORTA/PORTB zeigen nur den Wert einer Variable an. */
var SIM_EXAMPLES = [
  {
    title: 'Eine Variable auf den LEDs',
    text: 'Eine `uint8_t`-Variable hat 8 Bit – die LEDs an PORTA zeigen sie an. Probier andere Werte, z.B. `200`, `0xF0` oder `255`, und schau in die Variablen-Tabelle. Was passiert bei `256`?',
    code: [
      '#include <avr/io.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    uint8_t wert = 0b10101010;   // 170',
      '    PORTA = wert;                // die LEDs zeigen die 8 Bits',
      '',
      '    while (1)',
      '    {',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Binärzähler: uint8_t zählt hoch',
    text: 'Ein `uint8_t` zählt hoch und wird binär auf den LEDs angezeigt. Nach 255 kommt wieder 0 – der Überlauf ist bei Typen ohne Vorzeichen genau festgelegt.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    uint8_t zaehler = 0;',
      '',
      '    while (1)',
      '    {',
      '        PORTA = zaehler;   // Zählerstand binär auf den LEDs',
      '        zaehler++;         // nach 255 kommt wieder 0',
      '        _delay_ms(200);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Overflow-Demo: uint8_t läuft über',
    text: 'Der Wert startet bei 250. Schau in die Variablen-Tabelle und die Meldungen: Bei 255 + 1 = 256 passt das Ergebnis nicht mehr in 8 Bit, gespeichert wird 0. Ändere den Typ auf `int8_t` und den Start auf 120 – was passiert dann?',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    uint8_t wert = 250;',
      '',
      '    while (1)',
      '    {',
      '        PORTA = wert;',
      '        _delay_ms(400);',
      '        wert = wert + 1;   // 255 + 1 = 256 passt nicht -> 0',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'int8_t und uint8_t: gleiche Bits',
    text: 'Dieselben 8 Bits, zwei Typen: PORTA zeigt `s` (`int8_t`), PORTB zeigt `u` (`uint8_t`). Die LEDs sind gleich – in der Variablen-Tabelle steht aber −100 und 156. Probier andere negative Werte.',
    code: [
      '#include <avr/io.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    DDRB = 0xFF;',
      '    int8_t  s = -100;   // mit Vorzeichen',
      '    uint8_t u = s;      // dieselben Bits, ohne Vorzeichen: 156',
      '    PORTA = s;',
      '    PORTB = u;',
      '',
      '    while (1)',
      '    {',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: '16-Bit-Zähler auf zwei Ports',
    text: 'Ein `uint16_t` ist zu gross für 8 LEDs. Darum kommt das High-Byte (`>> 8`) auf PORTB und das Low-Byte (`& 0xFF`) auf PORTA.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    DDRB = 0xFF;',
      '    uint16_t zaehler = 0;',
      '',
      '    while (1)',
      '    {',
      '        PORTB = zaehler >> 8;     // High-Byte',
      '        PORTA = zaehler & 0xFF;   // Low-Byte',
      '        zaehler += 37;',
      '        _delay_ms(50);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Typumwandlung 16 → 8 Bit',
    text: '`gross` ist ein `uint16_t`, `klein` ein `uint8_t`. Bei jeder Zuweisung `klein = gross;` bleiben nur die unteren 8 Bit übrig. PORTB zeigt das High-Byte von `gross`, PORTA zeigt `klein` – vergleiche mit der Variablen-Tabelle.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    DDRB = 0xFF;',
      '    uint16_t gross = 200;',
      '    uint8_t klein;',
      '',
      '    while (1)',
      '    {',
      '        klein = gross;          // nur das Low-Byte passt hinein',
      '        PORTB = gross >> 8;',
      '        PORTA = klein;',
      '        gross = gross + 50;',
      '        _delay_ms(500);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Festkomma: Sensorwert → Millivolt',
    text: 'Ein 10-Bit-Sensorwert (0 … 1023) wird ohne Kommazahlen in Millivolt umgerechnet (0 … 5000 mV). Wichtig: `1023 * 5000` passt nicht in 16 Bit – darum der Cast auf `uint32_t`. Die 16 LEDs zeigen `spannung_mv`: PORTB das High-Byte, PORTA das Low-Byte.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    DDRB = 0xFF;',
      '    uint16_t roh = 0;                                // 10-Bit-Sensorwert: 0 … 1023',
      '',
      '    while (1)',
      '    {',
      '        uint16_t spannung_mv = (uint32_t)roh * 5000 / 1023;   // Festkomma: Millivolt',
      '        PORTB = spannung_mv >> 8;     // High-Byte',
      '        PORTA = spannung_mv & 0xFF;   // Low-Byte',
      '        roh = roh + 93;',
      '        if (roh > 1023)',
      '        {',
      '            roh = 0;',
      '        }',
      '        _delay_ms(300);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Falscher Typ: Multiplikation in 16 Bit',
    text: '4800 mV × 250 mA = 1\'200\'000 µW. `falsch` wird in 16 Bit gerechnet (auf dem ATmega ist `int` nur 16 Bit) und läuft über, `richtig` castet vorher auf `uint32_t`. Schau in die Meldungen und die Variablen-Tabelle.',
    code: [
      '#include <avr/io.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    DDRB = 0xFF;',
      '    uint16_t spannung_mv = 4800;',
      '    uint16_t strom_ma = 250;',
      '    uint32_t falsch = spannung_mv * strom_ma;             // 16 Bit: Überlauf',
      '    uint32_t richtig = (uint32_t)spannung_mv * strom_ma;  // 32 Bit: 1200000',
      '    uint16_t leistung_mw = richtig / 1000;                // 1200 mW',
      '    PORTB = leistung_mw >> 8;',
      '    PORTA = leistung_mw & 0xFF;',
      '',
      '    while (1)',
      '    {',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Taster an PORTL einlesen',
    text: 'Die 4 Taster an PORTL (PL7, PL6, PL1, PL0) liest du mit `PINL`. Ein Bit ist 1, solange der Taster gedrückt ist. PORTB zeigt `PINL` direkt an, PORTA zählt, wie oft PL0 gedrückt wurde – ein `uint8_t`, das nach 255 wieder bei 0 beginnt.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    DDRB = 0xFF;',
      '    DDRL = 0x00;                            // Port L: Eingänge (Taster)',
      '    uint8_t zaehler = 0;',
      '    uint8_t vorher = 0;',
      '',
      '    while (1)',
      '    {',
      '        uint8_t taster = PINL;              // Bit = 1, solange gedrückt',
      '        uint8_t jetzt = (taster >> PL0) & 1;',
      '        if (jetzt == 1 && vorher == 0)',
      '        {',
      '            zaehler++;                      // nur beim Drücken zählen',
      '        }',
      '        vorher = jetzt;',
      '        PORTA = zaehler;',
      '        PORTB = taster;',
      '        _delay_ms(10);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'RGB-LED an PORTH: Farben mischen',
    text: 'Die RGB-LED hängt an PH3 (Rot), PH4 (Grün) und PH5 (Blau). Ein `uint8_t` zählt von 0 bis 7 – seine 3 Bits werden um 3 nach links geschoben und schalten so die drei Farben. 3 Bits ergeben 2³ = 8 Farben (inkl. aus).',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRH = (1 << PH3) | (1 << PH4) | (1 << PH5);   // RGB-LED: Ausgänge',
      '    uint8_t farbe = 0;                             // 0 … 7 (3 Bit)',
      '',
      '    while (1)',
      '    {',
      '        PORTH = farbe << PH3;   // Bit 0 -> Rot, Bit 1 -> Grün, Bit 2 -> Blau',
      '        _delay_ms(700);',
      '        farbe++;',
      '        if (farbe > 7)',
      '        {',
      '            farbe = 0;',
      '        }',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'A/D-Wandler: Potentiometer 1 einlesen',
    text: 'Der A/D-Wandler misst die Spannung an Potentiometer 1 (ADC8) und liefert 0 … 1023 – das sind 10 Bit, also braucht es einen `uint16_t`. Die 16 LEDs zeigen den Messwert (PORTB = High-Byte, PORTA = Low-Byte). Dreh unten bei den Sensoren am Poti und schau `wert` und `spannung_mv` in der Variablen-Tabelle an.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'void adc_init(void)',
      '{',
      '    ADMUX = (1 << REFS0);                                  // Referenz: AVCC = 5 V',
      '    ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);   // ein, Takt 16 MHz / 128',
      '}',
      '',
      'uint16_t adc_lesen(uint8_t kanal)    // Kanal 0 … 15',
      '{',
      '    ADMUX = (ADMUX & 0xE0) | (kanal & 0x07);',
      '    if (kanal >= 8)',
      '    {',
      '        ADCSRB |= (1 << MUX5);       // ADC8 … ADC15',
      '    }',
      '    else',
      '    {',
      '        ADCSRB &= ~(1 << MUX5);',
      '    }',
      '    ADCSRA |= (1 << ADSC);           // Messung starten',
      '    while (ADCSRA & (1 << ADSC))     // warten, bis sie fertig ist',
      '    {',
      '    }',
      '    return ADC;                      // 0 … 1023',
      '}',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    DDRB = 0xFF;',
      '    adc_init();',
      '',
      '    while (1)',
      '    {',
      '        uint16_t wert = adc_lesen(8);                          // Potentiometer 1',
      '        uint16_t spannung_mv = (uint32_t)wert * 5000 / 1024;   // Festkomma: Millivolt',
      '        PORTB = wert >> 8;',
      '        PORTA = wert & 0xFF;',
      '        _delay_ms(50);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Temperatur mit dem LM35',
    text: 'Der LM35 an ADC13 liefert 10 mV pro °C. Gerechnet wird ganz ohne Kommazahlen: Messwert → Millivolt (`uint32_t` für die Zwischenrechnung) → ganze °C. PORTA zeigt die Temperatur binär an. Stell unten die Temperatur ein.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'uint16_t adc_lesen(uint8_t kanal)',
      '{',
      '    ADMUX = (1 << REFS0) | (kanal & 0x07);   // AVCC als Referenz',
      '    if (kanal >= 8)',
      '    {',
      '        ADCSRB |= (1 << MUX5);',
      '    }',
      '    else',
      '    {',
      '        ADCSRB &= ~(1 << MUX5);',
      '    }',
      '    ADCSRA |= (1 << ADSC);',
      '    while (ADCSRA & (1 << ADSC))',
      '    {',
      '    }',
      '    return ADC;',
      '}',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);',
      '',
      '    while (1)',
      '    {',
      '        uint16_t wert = adc_lesen(13);                         // LM35',
      '        uint16_t spannung_mv = (uint32_t)wert * 5000 / 1024;',
      '        uint8_t temperatur_c = spannung_mv / 10;               // 10 mV pro °C',
      '        PORTA = temperatur_c;',
      '        _delay_ms(200);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'LCD 4×20: Zähler anzeigen',
    text: 'Das LCD (EA DIP203-4) wird seriell angesteuert: PG0 = Daten (SID), PG1 = Takt (SCLK), PG5 schaltet den Strom ein. Jedes Byte geht als Startbyte `11111 RW RS 0` und zwei Pakete mit je 4 Datenbits (LSB zuerst). Unten zählt ein `uint8_t` und ein `uint16_t` – schau, wann der `uint8_t` überläuft.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      '// LCD 4x20 seriell: PG0 = SID (Daten), PG1 = SCLK (Takt), PG5 = Strom',
      'void lcd_bit(uint8_t bit)',
      '{',
      '    if (bit)',
      '    {',
      '        PORTG |= (1 << PG0);',
      '    }',
      '    else',
      '    {',
      '        PORTG &= ~(1 << PG0);',
      '    }',
      '    PORTG &= ~(1 << PG1);',
      '    PORTG |= (1 << PG1);           // steigende Flanke: LCD liest das Bit',
      '}',
      '',
      'void lcd_8bit(uint8_t wert)        // LSB zuerst',
      '{',
      '    for (uint8_t i = 0; i < 8; i++)',
      '    {',
      '        lcd_bit((wert >> i) & 1);',
      '    }',
      '}',
      '',
      'void lcd_senden(uint8_t rs, uint8_t wert)',
      '{',
      '    lcd_8bit(0x1F | (rs << 6));    // Startbyte: 1 1 1 1 1, RW = 0, RS, 0',
      '    lcd_8bit(wert & 0x0F);         // untere 4 Bit',
      '    lcd_8bit(wert >> 4);           // obere 4 Bit',
      '    _delay_us(50);',
      '}',
      '',
      'void lcd_init(void)',
      '{',
      '    DDRG |= (1 << PG0) | (1 << PG1) | (1 << PG5);',
      '    PORTG |= (1 << PG5);           // Strom fürs LCD',
      '    _delay_ms(50);',
      '    lcd_senden(0, 0x34);           // 8 Bit, RE = 1 (erweiterte Befehle)',
      '    lcd_senden(0, 0x09);           // 4-Zeilen-Modus',
      '    lcd_senden(0, 0x30);           // RE = 0',
      '    lcd_senden(0, 0x0C);           // Display an, Cursor aus',
      '    lcd_senden(0, 0x01);           // löschen',
      '    _delay_ms(2);',
      '    lcd_senden(0, 0x06);           // Cursor wandert nach rechts',
      '}',
      '',
      'void lcd_pos(uint8_t zeile, uint8_t spalte)    // Zeile 0 … 3, Spalte 0 … 19',
      '{',
      '    lcd_senden(0, 0x80 | (zeile * 0x20 + spalte));',
      '}',
      '',
      'void lcd_zahl(uint16_t zahl)       // immer 5 Stellen',
      '{',
      '    uint16_t teiler = 10000;',
      '    while (teiler > 0)',
      '    {',
      '        lcd_senden(1, \'0\' + (zahl / teiler) % 10);',
      '        teiler = teiler / 10;',
      '    }',
      '}',
      '',
      'uint8_t titel[] = {\'V\', \'a\', \'r\', \'i\', \'a\', \'b\', \'l\', \'e\', \'n\', \'t\', \'y\', \'p\', \'e\', \'n\'};',
      'uint8_t text8[] = {\'u\', \'i\', \'n\', \'t\', \'8\', \'_\', \'t\', \':\'};',
      'uint8_t text16[] = {\'u\', \'i\', \'n\', \'t\', \'1\', \'6\', \'_\', \'t\', \':\'};',
      '',
      'int main(void)',
      '{',
      '    lcd_init();',
      '    lcd_pos(0, 3);',
      '    for (uint16_t i = 0; i < sizeof(titel); i++)',
      '    {',
      '        lcd_senden(1, titel[i]);',
      '    }',
      '    lcd_pos(2, 0);',
      '    for (uint16_t i = 0; i < sizeof(text8); i++)',
      '    {',
      '        lcd_senden(1, text8[i]);',
      '    }',
      '    lcd_pos(3, 0);',
      '    for (uint16_t i = 0; i < sizeof(text16); i++)',
      '    {',
      '        lcd_senden(1, text16[i]);',
      '    }',
      '',
      '    uint8_t  klein = 250;',
      '    uint16_t gross = 250;',
      '    while (1)',
      '    {',
      '        lcd_pos(2, 10);',
      '        lcd_zahl(klein);',
      '        lcd_pos(3, 10);',
      '        lcd_zahl(gross);',
      '        klein++;                   // nach 255 kommt 0',
      '        gross++;',
      '        _delay_ms(400);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Joystick steuert die Servos',
    text: 'Timer 3 erzeugt für die Servos an PE3 und PE4 ein PWM-Signal: alle 20 ms ein Puls von 1 … 2 ms. Mit Takt / 8 zählt der Timer in 0.5 µs – `ICR3 = 39999` ergibt 20 ms, `OCR3A = 2000 … 4000` den Puls. Der Joystick (X = ADC10, Y = ADC11) wird auf diesen Bereich umgerechnet; die Joystick-Taste (PE2) schaltet die LEDs an PORTA.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'uint16_t adc_lesen(uint8_t kanal)',
      '{',
      '    ADMUX = (1 << REFS0) | (kanal & 0x07);',
      '    ADCSRB |= (1 << MUX5);           // Kanal 8 … 15',
      '    ADCSRA |= (1 << ADSC);',
      '    while (ADCSRA & (1 << ADSC))',
      '    {',
      '    }',
      '    return ADC;',
      '}',
      '',
      'void servo_init(void)',
      '{',
      '    DDRE |= (1 << PE3) | (1 << PE4);                       // OC3A, OC3B',
      '    TCCR3A = (1 << COM3A1) | (1 << COM3B1) | (1 << WGM31);  // Fast PWM, nicht invertiert',
      '    TCCR3B = (1 << WGM33) | (1 << WGM32) | (1 << CS31);    // Modus 14 (TOP = ICR3), Takt / 8',
      '    ICR3 = 39999;                                          // 40000 × 0.5 µs = 20 ms',
      '    OCR3A = 3000;                                          // 1.5 ms = Mitte',
      '    OCR3B = 3000;',
      '}',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);',
      '    servo_init();',
      '',
      '    while (1)',
      '    {',
      '        uint16_t x = adc_lesen(10);                         // 0 … 1023',
      '        uint16_t y = adc_lesen(11);',
      '        OCR3A = 2000 + (uint32_t)x * 2000 / 1023;          // 2000 … 4000 = 1 … 2 ms',
      '        OCR3B = 2000 + (uint32_t)y * 2000 / 1023;',
      '        if (PINE & (1 << PE2))                             // Joystick-Taste gedrückt?',
      '        {',
      '            PORTA = 0xFF;',
      '        }',
      '        else',
      '        {',
      '            PORTA = 0x00;',
      '        }',
      '        _delay_ms(20);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'LED-Matrix: ein Herz',
    text: 'Die Matrix zeigt immer nur eine Zeile gleichzeitig: Erst werden die 8 Spalten-Bits über PJ5 (Daten) und PJ4 (Takt) ins Schieberegister geschoben und mit PJ6 (STROBE) übernommen, dann wählt der 74AC138 mit PJ0–PJ2 die Zeile und PJ3 schaltet sie ein. Schnell genug nacheinander sieht man das ganze Bild. Jede Zeile ist ein `uint8_t` – ein Bit pro LED.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'uint8_t herz[8] = {0x00, 0x66, 0xFF, 0xFF, 0x7E, 0x3C, 0x18, 0x00};',
      '',
      'void matrix_zeile(uint8_t zeile, uint8_t muster)',
      '{',
      '    PORTJ &= ~(1 << PJ3);                  // alle Zeilen aus (G1 = 0)',
      '    for (uint8_t i = 0; i < 8; i++)        // 8 Spalten, MSB zuerst',
      '    {',
      '        if ((muster >> (7 - i)) & 1)',
      '        {',
      '            PORTJ |= (1 << PJ5);',
      '        }',
      '        else',
      '        {',
      '            PORTJ &= ~(1 << PJ5);',
      '        }',
      '        PORTJ |= (1 << PJ4);               // CLK: ein Bit weiterschieben',
      '        PORTJ &= ~(1 << PJ4);',
      '    }',
      '    PORTJ |= (1 << PJ6);                   // STROBE: Spalten übernehmen',
      '    PORTJ &= ~(1 << PJ6);',
      '    PORTJ = (PORTJ & 0xF8) | zeile;        // Zeile wählen (A, B, C)',
      '    PORTJ |= (1 << PJ3);                   // Zeile ein',
      '}',
      '',
      'int main(void)',
      '{',
      '    DDRJ = 0x7F;                           // PJ0 … PJ6 sind Ausgänge',
      '    while (1)',
      '    {',
      '        for (uint8_t z = 0; z < 8; z++)',
      '        {',
      '            matrix_zeile(z, herz[z]);',
      '            _delay_ms(2);',
      '        }',
      '    }',
      '}'
    ].join('\n')
  }
];

/* Simulator-Challenges: phases = ms Millisekunden laufen lassen, danach optional expect (Wert von PORTA/PORTB) */
var SIM_CHALLENGES = [
  {
    id: 'sim-led07', title: 'Nur Bit 0 und Bit 7',
    text: 'Speichere in einer `uint8_t`-Variable den Wert, bei dem nur Bit 0 und Bit 7 gesetzt sind, und gib sie auf PORTA aus. Tipp: Binär- oder Hex-Literal.',
    check: { phases: [{ ms: 300, expect: { A: 0x81 } }] }
  },
  {
    id: 'sim-minus1', title: '−1 als int8_t',
    text: 'Speichere −1 in einem `int8_t` und gib die Variable auf PORTA aus. Wie viele LEDs leuchten – und warum?',
    check: { phases: [{ ms: 300, expect: { A: 0xFF } }] }
  },
  {
    id: 'sim-split', title: '1000 auf zwei Ports',
    text: 'Speichere 1000 in einem passenden Typ. Zeig das High-Byte auf PORTB und das Low-Byte auf PORTA.',
    check: { phases: [{ ms: 300, expect: { B: 0x03, A: 0xE8 } }] }
  },
  {
    id: 'sim-fix', title: 'Festkomma: 1.75 m',
    text: 'Speichere 1.75 m als Festkomma in Zentimetern (175 cm) im kleinsten passenden Typ. Zeig auf PORTA die ganzen Meter (1) und auf PORTB die restlichen Zentimeter (75) – nur mit `/` und `%`.',
    check: { phases: [{ ms: 300, expect: { A: 1, B: 75 } }] }
  },
  {
    id: 'sim-pingpong', title: 'Lauflicht hin und zurück',
    text: 'Ein einzelnes gesetztes Bit in einem `uint8_t` wandert auf PORTA von Bit 0 bis Bit 7 und dann wieder zurück zu Bit 0 – immer weiter (mit `_delay_ms`).',
    check: { phases: [{ ms: 12000 }], seq: { port: 'A', contains: [1, 2, 4, 8, 16, 32, 64, 128, 64, 32, 16, 8, 4, 2, 1] } }
  },
  {
    id: 'sim-free-type', title: 'Frei: Der kleinste passende Typ',
    text: 'Für Profis: Zähle in einer Variable von 0 bis 1000 in Zehnerschritten und zeig sie auf PORTB (High-Byte) und PORTA (Low-Byte). Welcher ist der kleinste Typ, der passt? Probier zuerst `uint8_t` und schau, was die Meldungen sagen.'
  }
];

var SIM_SAYS = {
  hello: 'Schreib C-Code und drück auf Start – ich führe ihn auf meinem virtuellen Board aus. Fang mit einem Beispiel an!',
  start: 'Läuft! Ich führe deinen Code Anweisung für Anweisung aus. Mit „Schritt“ kannst du mir dabei zuschauen.',
  error: 'Hoppla – das kann ich so nicht übersetzen. Die rote Zeile im Editor zeigt, wo es klemmt.',
  runtime: 'Autsch, ein Laufzeitfehler! Schau in die Meldungen unten.',
  done: 'Fertig! `main` ist zu Ende. Auf dem echten Board wäre das ungewöhnlich – dort läuft `while (1)` für immer.',
  challenge: 'Challenge geschafft! Du programmierst wie ein echter Embedded-Profi.',
  challengeFail: 'Noch nicht ganz – lies die Meldung bei der Challenge und probier es nochmal.'
};
