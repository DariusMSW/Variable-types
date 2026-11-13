/* Aufgabendaten fuer "C-Variablentypen lernen" – Plattform: ATmega2560 (Arduino Mega 2560, avr-gcc).
 * Alles hier sind reine Daten. Neue Aufgaben einfach in ein tasks-Array einfuegen.
 *
 * Gelehrt werden nur die Ganzzahltypen mit fester Groesse aus <stdint.h>:
 *   uint8_t, int8_t, uint16_t, int16_t, uint32_t, int32_t, uint64_t, int64_t
 * Kommazahlen werden als Festkomma gespeichert: Wert x Skalierungsfaktor (10, 100, 1000 ...) als Ganzzahl.
 *
 * Hardware-Belegung (ueberall gleich): PORTA + PORTB = LEDs (Ausgaenge), PORTL = Taster, PORTC = Schalter (Eingaenge,
 * gelesen ueber PINL / PINC). Annahme: aktiv-high, 1 = gedrueckt bzw. eingeschaltet.
 *
 * Aufgabentypen (Feld "type"):
 *  choice    { q, code?, options:[..], answer:index, why?:[..pro Option], hint?, explain }
 *  yesno     { q, code?, answer:true|false, hint?, explain }
 *  number    { q, code?, answer:"Zahl als String", unit?, hint?, explain }
 *  bits      { q, bits:8|16, mode:"ohneVZ"|"mitVZ", target:Zahl, leds?:true, explain }
 *              leds: 8 Bit = LEDs an PORTA, 16 Bit = PORTA (High-Byte) + PORTB (Low-Byte)
 *  pickType  { q, code (mit ____), min:"..", max:"..", options:[Typnamen], notes?:{Typ:"Text"}, explain,
 *              scale?:10|100|1000.., real?:{min:"..",max:".."}, unit?:"..", sample?:"3.84" }
 *              -> min/max sind die GESPEICHERTEN (bei Festkomma: skalierten) Ganzzahlen.
 *              -> richtig ist jeder passende Typ mit der kleinsten Byte-Anzahl.
 *  findBug   { q, code:[Zeilen], bugLines:[Indizes], lineHint?, fixes:[..], fix:index, why?, explain }
 *  structFit { q, name, count, budget, fields:[{name, min, max, desc, start}], explain }
 *              -> Feldtypen per Auswahl verkleinern; richtig, wenn jedes Feld den kleinsten passenden Typ hat.
 *              sizeof(struct) = Summe der Felder (avr-gcc: kein Padding).
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
  { type: 'uint8_t',  use: 'Port-Register (`PORTA`, `PINL`), Taster-Bits, kleine Zähler' },
  { type: 'int8_t',   use: 'Temperatur in ganzen °C, kleine Differenzen' },
  { type: 'uint16_t', use: 'ADC-Wert (0 … 1023), Timer1 (`TCNT1`), Spannung in mV' },
  { type: 'int16_t',  use: 'Temperatur in Zehntelgrad, `int` bei avr-gcc' },
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
    desc: 'Der ATmega2560, Ports, Typen und das Namensschema.',
    intro: [
      { p: 'Alle Beispiele laufen auf dem ATmega2560, dem Mikrocontroller auf dem Arduino Mega 2560. Er ist ein 8-Bit-AVR mit 16 MHz, 256 KB Flash (Programm), 8 KB SRAM (Variablen) und 4 KB EEPROM. Eine Gleitkomma-Einheit (FPU) hat er nicht.' },
      { p: 'Jede Variable hat einen Datentyp. Er legt fest, wie viele Bytes sie belegt und wie die Bits darin gelesen werden. Hier lernst du nur Ganzzahltypen mit fester Grösse. Ihr Name verrät alles:' },
      { table: { head: ['Teil des Namens', 'Bedeutung', 'Beispiel'], rows: [
        ['`u` am Anfang', 'ohne Vorzeichen (nur 0 und positiv)', '`uint8_t`: 0 … 255'],
        ['ohne `u`', 'mit Vorzeichen (auch negativ)', '`int8_t`: −128 … 127'],
        ['Zahl', 'Anzahl Bits (8, 16, 32 oder 64)', '`uint16_t` = 16 Bit'],
        ['`_t`', '„type“ – zeigt, dass es ein Typname ist', '']
      ] } },
      { p: 'So ist unser Board belegt. Jeder dieser Ports hat drei Register mit je 8 Bit – ein Bit pro Pin:' },
      { table: { head: ['Port', 'Angeschlossen', 'Richtung'], rows: [
        ['A und B', '8 + 8 LEDs', 'Ausgang: `DDRA = 0xFF;`, dann z.B. `PORTA = 255;`'],
        ['L', '8 Taster', 'Eingang: `DDRL = 0x00;`, lesen mit `PINL`'],
        ['C', '8 Schalter', 'Eingang: `DDRC = 0x00;`, lesen mit `PINC`']
      ] } },
      { ul: [
        '`DDRx` legt die Richtung fest: Bit = 1 → Ausgang, Bit = 0 → Eingang.',
        '`PORTx` setzt die Ausgänge (LED an/aus). Bei einem Eingang schaltet `PORTx` nur den internen Pull-up-Widerstand.',
        '`PINx` liest die Eingänge. Die Taster hängen an Port L – gelesen wird aber `PINL`, nicht `PORTL`.',
        'Annahme auf dieser Seite: Taster und Schalter sind aktiv-high. Gedrückt bzw. eingeschaltet = 1, sonst 0.'
      ] },
      { code: ['#include <avr/io.h>     // Register: DDRA, PORTA, PINL, ...',
               '#include <stdint.h>     // Typen: uint8_t, int16_t, ...',
               '',
               'int main(void) {',
               '    DDRA = 0xFF;            // Port A: 8 Ausgänge (LEDs)',
               '    DDRL = 0x00;            // Port L: 8 Eingänge (Taster)',
               '    uint8_t zaehler = 0;    // 0 … 255',
               '    while (1) {',
               '        uint8_t taster = PINL;  // alle 8 Taster auf einmal lesen',
               '        if (taster & 0x01) {    // Taster 0 gedrückt?',
               '            zaehler++;          // (ohne Entprellen, vereinfacht)',
               '        }',
               '        PORTA = zaehler;        // LEDs zeigen den Zähler binär',
               '    }',
               '}'] },
      { ul: [
        'Ja/Nein-Werte (LED an, Schalter ein) speicherst du als `uint8_t` mit 0 und 1.',
        'Weist du einer Ganzzahl eine Kommazahl zu, werden die Nachkommastellen abgeschnitten – nicht gerundet. Wie man Kommazahlen trotzdem speichert, lernst du in Level 5.'
      ] },
      { p: 'Warum nicht einfach `int`? Die klassischen C-Typen haben keine feste Grösse. Bei avr-gcc auf dem ATmega2560 ist ein `int` nur 16 Bit (2 Byte) gross, auf einem PC 32 Bit. Code, der am PC funktioniert, kann auf dem Mega plötzlich überlaufen. Mit `uint16_t` & Co. weisst du immer genau, was du bekommst.' },
      { tip: '`#include <avr/io.h>` für die Register, `#include <stdint.h>` für die Typen. Ports sind 8 Bit breit → `uint8_t`. Einzige Ausnahme: `int main(void)` – so schreibt es der C-Standard vor.' }
    ],
    fact: {
      title: 'Der Mega hat mehr Beine als du denkst',
      text: 'Der ATmega2560 hat 100 Pins und 86 davon sind frei programmierbare Ein-/Ausgänge, verteilt auf die Ports A bis L (einen Port I gibt es nicht). Zehn davon sind 8 Bit breit – passend zu einem `uint8_t` –, nur Port G hat 6 Pins: 10 × 8 + 6 = 86.'
    },
    tasks: [
      { type: 'choice',
        q: 'Was legt der Datentyp einer Variablen in C fest?',
        options: ['Wie viel Speicher sie belegt und wie die Bits darin gedeutet werden',
                  'Nur den Namen der Variablen',
                  'An welchem Port die Variable angeschlossen ist',
                  'Die Farbe im Code-Editor'],
        answer: 0,
        explain: 'Der Typ sagt dem Compiler zwei Dinge: wie viele Bytes reserviert werden und wie die Bits zu lesen sind. Dieselben 8 Bits `11111111` sind z.B. 255 als `uint8_t`, aber −1 als `int8_t`.' },
      { type: 'choice',
        q: 'Was bedeuten das „u“ und die „16“ in `uint16_t`?',
        options: ['ohne Vorzeichen, 16 Bit', 'universal, 16 Byte', 'ohne Vorzeichen, 16 Byte', 'user-defined, Version 16'],
        answer: 0,
        why: [null, 'Das „u“ steht nicht für universal – und die Zahl zählt Bits, nicht Bytes.', 'Fast: Die Zahl im Namen zählt Bits, nicht Bytes.', 'Nein, mit Versionen hat das nichts zu tun.'],
        explain: '`uint16_t` = „unsigned integer“, englisch für Ganzzahl ohne Vorzeichen, 16 Bit, `_t` für type. Also 0 … 65\'535 in 2 Byte.' },
      { type: 'choice',
        q: 'Wie breit ist ein Port-Register wie `PORTA` beim ATmega2560?',
        options: ['8 Bit – ein Bit pro Pin, also 8 LEDs', '16 Bit', '32 Bit', '1 Bit'],
        answer: 0,
        why: [null, '16 Bit hat z.B. der Timer1 (`TCNT1`), aber kein Port.', 'Der ATmega2560 ist ein 8-Bit-Controller – Ports sind 8 Bit breit.', 'Ein Bit wäre nur ein einzelner Pin.'],
        explain: 'Port A hat 8 Pins, darum sind `DDRx`, `PORTx` und `PINx` je 8 Bit breit. Der passende Typ dazu ist `uint8_t` (0 … 255).' },
      { type: 'choice',
        q: 'Die 8 Taster hängen an Port L. Mit welchem Register liest du, welche gedrückt sind?',
        options: ['`PINL`', '`PORTL`', '`DDRL`', '`TCNT1`'],
        answer: 0,
        why: [null, '`PORTL` schaltet bei Eingängen nur die Pull-up-Widerstände. Lesen liefert, was du hineingeschrieben hast – nicht den Taster.', '`DDRL` legt nur die Richtung fest (Eingang/Ausgang).', 'Das ist der Zähler von Timer1.'],
        explain: 'Eingänge liest man über das PIN-Register: `DDRL = 0x00;` (alle Eingang), dann `uint8_t taster = PINL;`.' },
      { type: 'yesno',
        q: 'Auf dieser Seite gilt die Annahme „aktiv-high“. Ist Taster 3 gedrückt, ist dann Bit 3 von `PINL` gleich 1?',
        answer: true,
        explain: 'Aktiv-high heisst: gedrückt = 1, losgelassen = 0. (Viele echte Schaltungen sind aktiv-low mit Pull-up – dann wäre es umgekehrt. Hier legen wir aktiv-high fest.)' },
      { type: 'choice',
        q: 'Welcher Typ passt am besten für den Wert, den du aus `PINC` (8 Schalter) liest?',
        options: ['`uint8_t`', '`int8_t`', '`uint32_t`', '`int64_t`'],
        answer: 0,
        why: [null, 'Mit Vorzeichen würde Schalter 7 (Bit 7) als negativ gedeutet.', 'Funktioniert, verschwendet aber 3 Bytes – das Register hat nur 8 Bit.', 'Viel zu gross: 8 Bytes für 8 Bits.'],
        explain: '8 Bits ohne Vorzeichen = `uint8_t` (0 … 255). Genau so breit ist das Register `PINC`.' },
      { type: 'choice',
        q: 'Was zeigen die LEDs an Port A nach diesen Zeilen?',
        code: ['DDRA = 0xFF;', 'uint8_t n = 7.9;', 'PORTA = n;'],
        options: ['7 (binär 00000111)', '8 (binär 00001000)', 'Die LEDs zeigen 7.9', 'Der Compiler verweigert das Programm immer'],
        answer: 0,
        why: [null, 'Es wird nicht gerundet!', 'LEDs können nur Bits zeigen – und ein `uint8_t` speichert keine Nachkommastellen.', 'Die meisten Compiler warnen höchstens – das Programm läuft.'],
        explain: 'Bei der Umwandlung einer Kommazahl in einen Ganzzahltyp werden die Nachkommastellen abgeschnitten (Richtung 0), nicht gerundet. Aus 7.9 wird 7, die LEDs 0, 1 und 2 leuchten.' },
      { type: 'choice',
        q: 'Wie gross ist ein `int` bei avr-gcc auf dem ATmega2560?',
        options: ['2 Byte (16 Bit)', '4 Byte (32 Bit)', '1 Byte (8 Bit)', '8 Byte (64 Bit)'],
        answer: 0,
        why: [null, 'So gross ist `int` auf einem PC – auf dem AVR nicht.', 'Nein, der C-Standard verlangt für `int` mindestens 16 Bit.', 'Nein, viel zu gross.'],
        explain: 'Auf dem AVR ist `int` nur 16 Bit (−32\'768 … 32\'767). Genau darum verwendet man Typen wie `int16_t` oder `int32_t`: Da steht die Grösse im Namen.' },
      { type: 'choice',
        q: 'Welche Zeile macht die Register `DDRA`, `PORTA` und `PINL` bekannt?',
        options: ['`#include <avr/io.h>`', '`#include <stdint.h>`', '`#include <math.h>`', '`#include <ports.h>`'],
        answer: 0,
        why: [null, '`<stdint.h>` bringt die Typen wie `uint8_t`, aber keine Register.', '`<math.h>` hat mathematische Funktionen.', 'Diese Datei gibt es nicht.'],
        explain: '`<avr/io.h>` definiert alle Register des Controllers (und bindet die Typen aus `<stdint.h>` schon mit ein). In den Beispielen steht `#include <stdint.h>` trotzdem dabei, damit klar ist, woher die Typen kommen.' }
    ]
  },
  /* ------------------------------------------------------------ 2 */
  {
    id: 'speicher',
    title: 'Speicherbedarf',
    desc: 'Bytes aus dem Namen ablesen, sizeof, Arrays und 8 KB SRAM.',
    intro: [
      { p: 'Speicher wird in Bytes gemessen. 1 Byte besteht aus 8 Bits, jedes Bit ist 0 oder 1. Die Zahl im Typnamen sind Bits – die Bytes rechnest du so aus: Bytes = Bits ÷ 8.' },
      { table: { head: ['Bits im Namen', 'Bytes', 'Typen'], rows: [
        ['8', '1', '`uint8_t`, `int8_t`'],
        ['16', '2', '`uint16_t`, `int16_t`'],
        ['32', '4', '`uint32_t`, `int32_t`'],
        ['64', '8', '`uint64_t`, `int64_t`']
      ] } },
      { p: 'Der ATmega2560 hat drei Speicher:' },
      { table: { head: ['Speicher', 'Grösse', 'Wofür'], rows: [
        ['Flash', '256 KB', 'dein Programm'],
        ['SRAM', '8 KB = 8192 Bytes', 'alle Variablen und der Stack'],
        ['EEPROM', '4 KB', 'Daten, die beim Ausschalten erhalten bleiben']
      ] } },
      { p: 'Alle Variablen müssen in die 8 KB SRAM passen – das ist schnell voll. Mit `sizeof` fragst du den Compiler nach der Grösse in Bytes. Bei einem Array erhältst du die Grösse des ganzen Arrays: Anzahl Elemente × Grösse eines Elements.' },
      { code: ['#include <avr/io.h>',
               '#include <stdint.h>',
               '',
               'uint16_t werte[10];             // 10 ADC-Werte',
               '',
               'int main(void) {',
               '    DDRA = 0xFF;',
               '    PORTA = sizeof(uint16_t);   // LEDs zeigen 2',
               '    PORTA = sizeof(werte);      // LEDs zeigen 10 * 2 = 20',
               '    while (1) { }',
               '}'] },
      { tip: 'Diese Grössen gelten auf jeder Plattform – genau das ist der Vorteil der Typen mit fester Grösse.' }
    ],
    fact: {
      title: 'Zum Mond mit 4 KB',
      text: 'Der Apollo Guidance Computer, der 1969 Menschen zum Mond brachte, hatte nur 2048 Speicherwörter Arbeitsspeicher (rund 4 KB) – halb so viel wie der SRAM deines ATmega2560. Jedes Byte war kostbar.'
    },
    tasks: [
      { type: 'number',
        q: 'Wie viele Bits hat ein Byte?',
        answer: '8', unit: 'Bits',
        explain: '1 Byte = 8 Bits – genau so viele, wie ein Port LEDs hat.' },
      { type: 'number',
        q: 'Wie viele Bytes belegt ein `int32_t`?',
        answer: '4', unit: 'Bytes',
        hint: 'Die Zahl im Namen sind Bits. Teile durch 8.',
        explain: '32 Bit ÷ 8 = 4 Byte – auf jeder Plattform, auch auf dem ATmega2560.' },
      { type: 'number',
        q: 'Wie viele Bytes belegt ein `uint64_t`?',
        answer: '8', unit: 'Bytes',
        explain: '64 Bit ÷ 8 = 8 Byte.' },
      { type: 'choice',
        q: 'Welche Zahl zeigen die LEDs an Port A?',
        code: ['uint16_t adc_wert = 1023;', 'DDRA = 0xFF;', 'PORTA = sizeof(adc_wert);'],
        options: ['2', '16', '1023', '1'],
        answer: 0,
        why: [null, '16 sind die Bits – `sizeof` zählt aber Bytes.', '`sizeof` liefert die Grösse, nicht den Inhalt.', '1 Byte hätte ein `uint8_t`.'],
        explain: '`sizeof` liefert die Grösse in Bytes: `uint16_t` = 2 Byte. Die LEDs zeigen `00000010`.' },
      { type: 'number',
        q: 'Wie viele Bytes SRAM hat der ATmega2560? (8 KB, 1 KB = 1024 Bytes)',
        answer: '8192', unit: 'Bytes',
        explain: '8 × 1024 = 8192 Bytes. Darin müssen alle Variablen, Arrays und der Stack Platz finden.' },
      { type: 'number',
        q: 'Wie viele `int32_t`-Werte passen rein rechnerisch in die 8192 Bytes SRAM?',
        answer: '2048', unit: 'Werte',
        explain: '8192 ÷ 4 = 2048. In der Praxis sind es weniger, weil auch Stack und andere Variablen Platz brauchen. Mit `uint8_t` wären es viermal so viele.' },
      { type: 'number',
        q: 'Du speicherst 100 ADC-Werte. Wie viele Bytes belegt dieses Array?',
        code: ['#include <stdint.h>', 'uint16_t messwerte[100];'],
        answer: '200', unit: 'Bytes',
        hint: 'Anzahl Elemente × Grösse eines uint16_t.',
        explain: '100 Elemente × 2 Byte = 200 Byte. `sizeof(messwerte)` würde 200 liefern.' },
      { type: 'number',
        q: 'Wie viele Bytes belegen diese drei Variablen zusammen?',
        code: ['#include <stdint.h>', '', 'uint8_t  taster;     // Kopie von PINL', 'uint16_t adc_wert;   // 0 … 1023', 'uint32_t zeit_ms;    // Millisekunden seit Start'],
        answer: '7', unit: 'Bytes',
        explain: '1 + 2 + 4 = 7 Byte.' },
      { type: 'yesno',
        q: 'Du willst 3000 Messwerte als `uint32_t` im SRAM speichern. Passt das Array in die 8 KB?',
        answer: false,
        explain: '3000 × 4 = 12\'000 Bytes – mehr als die 8192 Bytes SRAM. Mit `uint16_t` wären es 6000 Bytes, das könnte knapp passen.' }
    ]
  },
  /* ------------------------------------------------------------ 3 */
  {
    id: 'wertebereich',
    title: 'Wertebereich',
    desc: 'Min und Max, mit und ohne Vorzeichen, die Formel 2ⁿ.',
    intro: [
      { p: 'Jedes zusätzliche Bit verdoppelt die Anzahl möglicher Werte. Mit n Bits gibt es 2ⁿ verschiedene Werte. Wie diese verteilt werden, hängt davon ab, ob der Typ ein Vorzeichen hat:' },
      { table: { head: ['', 'kleinster Wert', 'grösster Wert'], rows: [
        ['ohne Vorzeichen (`uintN_t`)', '0', '2ⁿ − 1'],
        ['mit Vorzeichen (`intN_t`)', '−2ⁿ⁻¹', '2ⁿ⁻¹ − 1']
      ] } },
      { p: 'Beispiel mit 4 Bits: 2⁴ = 16 Werte. Ohne Vorzeichen: 0 bis 15. Mit Vorzeichen: −8 bis 7.' },
      { ul: [
        'Das „− 1“ beim Maximum kommt daher, dass die 0 auch einen Platz braucht.',
        'Mit Vorzeichen gibt es darum einen negativen Wert mehr als positive.',
        'Ohne Vorzeichen ist der positive Bereich etwa doppelt so gross.',
        'Die Zahl n liest du direkt aus dem Namen ab: `int16_t` → n = 16.',
        'Typische Werte am ATmega2560: der ADC misst mit 10 Bit (0 … 1023), Timer1 zählt mit 16 Bit (`TCNT1`).'
      ] },
      { tip: 'Bits aus dem Namen ablesen, dann Formel anwenden. Für grosse Typen hilft der Spickzettel.' }
    ],
    fact: {
      title: 'millis() und die 49.7 Tage',
      text: 'Die Arduino-Funktion `millis()` zählt die Millisekunden seit dem Start in einem 32-Bit-Wert ohne Vorzeichen. Nach 2³² ms – rund 49.7 Tagen – springt sie wieder auf 0. Wer Zeiten mit `if (millis() > ende)` vergleicht, erlebt dann eine Überraschung.'
    },
    tasks: [
      { type: 'choice',
        q: 'Wie viele verschiedene Werte kann man mit n Bits darstellen?',
        options: ['n', '2 · n', '2ⁿ', 'n²'],
        answer: 2,
        explain: 'Jedes Bit verdoppelt die Möglichkeiten: 1 Bit → 2, 2 Bits → 4, 8 Bits → 2⁸ = 256 Werte – so viele LED-Muster kann ein Port zeigen.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `uint8_t` – also das, was `PORTA` maximal zeigen kann?',
        answer: '255',
        hint: 'Formel: 2⁸ − 1',
        explain: '2⁸ − 1 = 255 = `0xFF`: alle 8 LEDs leuchten.' },
      { type: 'number',
        q: 'Was ist der kleinste Wert eines `int8_t`?',
        answer: '-128',
        hint: 'Formel: −2⁷',
        explain: '`int8_t`: −2⁷ = −128 bis 2⁷ − 1 = 127. Es gibt einen negativen Wert mehr als positive, weil die 0 bei den „positiven“ mitgezählt wird.' },
      { type: 'number',
        q: 'Timer1 zählt in `TCNT1` mit 16 Bit ohne Vorzeichen. Bis zu welchem Wert kommt er, bevor er wieder bei 0 beginnt?',
        answer: '65535',
        explain: '2¹⁶ − 1 = 65\'535. Danach läuft der Timer über und beginnt bei 0. Eine Kopie von `TCNT1` speicherst du in einem `uint16_t`.' },
      { type: 'yesno',
        q: 'Der ADC liefert Werte von 0 bis 1023. Passt das in einen `uint8_t`?',
        answer: false,
        explain: '`uint8_t` geht nur bis 255. Der 10-Bit-ADC braucht mindestens 10 Bit – der nächste passende Typ ist `uint16_t`.' },
      { type: 'yesno',
        q: 'Passt der Wert 40000 in einen `int16_t` (= `int` auf dem ATmega2560)?',
        answer: false,
        explain: 'Ein `int16_t` reicht von −32\'768 bis 32\'767. 40\'000 ist zu gross. In einen `uint16_t` (bis 65\'535) würde es passen.' },
      { type: 'choice',
        q: 'Was ist der Wertebereich von `int32_t`?',
        options: ['0 bis 4\'294\'967\'295', '−2\'147\'483\'648 bis 2\'147\'483\'647', '−32\'768 bis 32\'767', '−2\'147\'483\'647 bis 2\'147\'483\'648'],
        answer: 1,
        why: ['Das ist `uint32_t` (ohne Vorzeichen).', null, 'Das ist `int16_t`.', 'Fast! Aber der negative Bereich ist um eins grösser, nicht der positive.'],
        explain: '−2³¹ bis 2³¹ − 1. Merkhilfe: `int32_t` geht bis ca. ±2.1 Mrd., `uint32_t` bis ca. 4.29 Mrd.' },
      { type: 'yesno',
        q: 'Ein Tag hat 86\'400\'000 Millisekunden. Passt ein Millisekunden-Zähler für einen ganzen Tag in einen `uint32_t`?',
        answer: true,
        explain: '`uint32_t` geht bis 4\'294\'967\'295 – das reicht für rund 49.7 Tage. Ein `uint16_t` wäre schon nach gut einer Minute (65\'535 ms) übergelaufen.' },
      { type: 'number',
        q: 'Profi-Frage: Was ist der grösste Wert eines `uint64_t`? (Ohne Trennzeichen oder mit \' eingeben.)',
        answer: '18446744073709551615',
        hint: '2⁶⁴ − 1. Die Zahl hat 20 Stellen und beginnt mit 18446…',
        explain: '2⁶⁴ − 1 = 18\'446\'744\'073\'709\'551\'615 (gut 18 Trillionen).' }
    ]
  },
  /* ------------------------------------------------------------ 4 */
  {
    id: 'bits',
    title: 'Bits & LEDs',
    desc: 'Bits umschalten, LEDs an PORTA sehen, Hex und Zweierkomplement.',
    intro: [
      { p: 'Jedes Bit hat eine Wertigkeit. Ganz rechts steht 1, nach links verdoppelt sich der Wert. Der Zahlenwert ist die Summe aller Bits, die auf 1 stehen. An Port A ist jedes Bit eine LED: Bit 7 links, Bit 0 rechts, 1 = LED leuchtet.' },
      { table: { head: ['Bit / LED', '7', '6', '5', '4', '3', '2', '1', '0'], rows: [
        ['Wert', '128', '64', '32', '16', '8', '4', '2', '1'],
        ['`PORTA = 6;`', '0', '0', '0', '0', '0', '1', '1', '0']
      ] } },
      { p: 'Hex-Schreibweise: Eine Hex-Ziffer (0 … 9, A … F) steht für genau 4 Bits. `0xFF` = `1111 1111` (alle LEDs an), `0x0F` = `0000 1111` (die rechten vier). Darum schreibt man Register-Werte meistens in Hex.' },
      { p: 'Einzelne Bits prüfst du mit einer Maske: `1 << 3` ist eine 1 an Bit 3 (= 8). `PINL & (1 << 3)` ist nur dann nicht 0, wenn Taster 3 gedrückt ist.' },
      { p: 'Ein 16-Bit-Wert passt nicht auf 8 LEDs. Verteile ihn: das obere Byte auf Port A, das untere auf Port B.' },
      { code: ['uint16_t wert = 1000;',
               'DDRA = 0xFF; DDRB = 0xFF;',
               'PORTA = wert >> 8;     // High-Byte: Bits 15 … 8',
               'PORTB = wert & 0xFF;   // Low-Byte:  Bits 7 … 0'] },
      { p: 'Typen mit Vorzeichen (`int8_t`, `int16_t` …) verwenden das Zweierkomplement: Das oberste Bit zählt negativ (bei 8 Bit −128 statt +128). Ist es 1, ist die Zahl negativ.' },
      { ul: [
        'Negative Zahl einstellen: Bits der positiven Zahl umkehren (0 ↔ 1), dann 1 addieren.',
        'Beispiel −6 mit 8 Bit: 6 = `00000110` → umkehren `11111001` → +1 = `11111010`.'
      ] },
      { tip: 'Zerlege die Zahl in Zweierpotenzen: Nimm immer die grösste Wertigkeit, die noch hineinpasst.' }
    ],
    fact: {
      title: 'Pac-Man und Level 256',
      text: 'Im Arcade-Klassiker Pac-Man wird der Level-Zähler in 8 Bit gespeichert. Beim Erreichen von Level 256 läuft eine Berechnung über und die rechte Bildschirmhälfte wird zu Zeichensalat – der berühmte „Kill Screen“. Das Level ist nicht lösbar.'
    },
    tasks: [
      { type: 'bits', bits: 8, mode: 'ohneVZ', target: 13, leds: true,
        q: 'Warm-up: Stelle die LEDs so ein, dass `PORTA = 13` ist. Klicke dazu die Bits an.',
        explain: '13 = 8 + 4 + 1 → `00001101`: LED 3, 2 und 0 leuchten.' },
      { type: 'bits', bits: 8, mode: 'ohneVZ', target: 200, leds: true,
        q: 'Stelle die LEDs so ein, dass `PORTA = 200` ist.',
        explain: '200 = 128 + 64 + 8 → `11001000` = `0xC8`: LED 7, 6 und 3 leuchten.' },
      { type: 'choice',
        q: 'Welche LEDs leuchten nach `PORTA = 0xA5;`?',
        options: ['LED 7, 5, 2 und 0', 'LED 7, 6, 5 und 0', 'LED 3, 1 und 0', 'Alle 8 LEDs'],
        answer: 0,
        why: [null, 'Prüfe die erste Hex-Ziffer: A = `1010`, nicht `1110`.', 'Das wäre `0x0B`.', 'Das wäre `0xFF`.'],
        explain: 'A = `1010` (Bits 7 und 5), 5 = `0101` (Bits 2 und 0). Zusammen `10100101` = 165.' },
      { type: 'number',
        q: 'Nach `PORTA = 0x3C;` leuchten einige LEDs. Welche Dezimalzahl zeigen sie?',
        answer: '60',
        hint: '3 = 0011 (obere vier Bits), C = 1100 (untere vier Bits).',
        explain: '`0x3C` = `00111100` = 32 + 16 + 8 + 4 = 60. Es leuchten LED 5, 4, 3 und 2.' },
      { type: 'choice',
        q: 'Was prüft diese Bedingung?',
        code: ['DDRL = 0x00;', 'uint8_t taster = PINL;', 'if (taster & (1 << 3)) {', '    PORTA = 0xFF;', '}'],
        options: ['Ob Taster 3 gedrückt ist', 'Ob genau 3 Taster gedrückt sind', 'Ob Taster 0, 1 und 2 gedrückt sind', 'Ob `taster` grösser als 3 ist'],
        answer: 0,
        why: [null, 'Die Maske zählt nicht, sie prüft ein einzelnes Bit.', '`1 << 3` ist nur Bit 3 (= 8), nicht drei Bits.', '`&` ist ein Bit-UND, kein Vergleich.'],
        explain: '`1 << 3` = `00001000`. Das UND lässt nur Bit 3 übrig: Ist Taster 3 gedrückt (1), ist das Ergebnis 8 → wahr.' },
      { type: 'bits', bits: 8, mode: 'mitVZ', target: -1, leds: true,
        q: 'Nach `int8_t x = -1; PORTA = x;` – welche Bits sind gesetzt? Stelle −1 als `int8_t` ein.',
        explain: 'Im Zweierkomplement ist −1 = `11111111` – alle 8 LEDs leuchten. Als `uint8_t` gelesen sind dieselben Bits 255.' },
      { type: 'bits', bits: 8, mode: 'mitVZ', target: 127, leds: true,
        q: 'Stelle den grössten möglichen `int8_t`-Wert ein.',
        explain: '`01111111` = 127. Das oberste Bit (Vorzeichen-Bit) muss 0 bleiben – sobald es 1 ist, wird die Zahl negativ.' },
      { type: 'bits', bits: 8, mode: 'mitVZ', target: -128, leds: true,
        q: 'Und jetzt den kleinsten `int8_t`-Wert.',
        explain: '`10000000` = −128. Nur das Vorzeichen-Bit ist gesetzt – nur LED 7 leuchtet.' },
      { type: 'bits', bits: 16, mode: 'ohneVZ', target: 1000, leds: true,
        q: 'Der ADC misst 1000. Stelle 1000 als `uint16_t` ein – Port A zeigt das High-Byte, Port B das Low-Byte.',
        explain: '1000 = 512 + 256 + 128 + 64 + 32 + 8 → `00000011 11101000`. `PORTA = wert >> 8` zeigt 3, `PORTB = wert & 0xFF` zeigt 232.' }
    ]
  },
  /* ------------------------------------------------------------ 5 */
  {
    id: 'festkomma',
    title: 'Kommazahlen als Festkomma',
    desc: 'Werte skalieren, mit Ganzzahlen rechnen, auf LEDs ausgeben.',
    intro: [
      { p: 'Der ATmega2560 hat keine Gleitkomma-Einheit (FPU). Gleitkomma-Rechnungen müsste der Compiler in Software nachbauen – das ist langsam und braucht viel Flash. Darum speicherst du Kommazahlen als Festkomma: Wert × Skalierungsfaktor, als Ganzzahl.' },
      { table: { head: ['Wert', 'Faktor', 'gespeichert', 'Bedeutung'], rows: [
        ['3.84 km', '× 1000', '3840', 'Meter'],
        ['21.5 °C', '× 10', '215', 'Zehntelgrad'],
        ['12.50 CHF', '× 100', '1250', 'Rappen'],
        ['4.8 V', '× 1000', '4800', 'Millivolt']
      ] } },
      { ol: [
        'Genauigkeit bestimmen → Faktor wählen: 1 Nachkommastelle → × 10, 2 → × 100, 3 → × 1000.',
        'Skalierten Bereich berechnen: Minimum × Faktor und Maximum × Faktor.',
        'Negativ? Dann einen Typ mit Vorzeichen (`intN_t`).',
        'Kleinsten Typ wählen, in den der skalierte Bereich passt.'
      ] },
      { tip: 'Typischer Denkfehler: „3.84 ist klein, das passt in einen `uint8_t`.“ Gespeichert wird aber 3840 – und `uint8_t` geht nur bis 255.' },
      { p: 'Rechnen mit Festkomma:' },
      { ul: [
        'Addieren und Subtrahieren: direkt, wenn beide Werte denselben Faktor haben.',
        'Multiplizieren: Das Ergebnis hat den Faktor doppelt (z.B. mV × mA = µW). Danach durch einen Faktor teilen. Das Zwischenergebnis wird gross – rechne es in einem grösseren Typ: `(uint32_t)a * b / 1000`.',
        'Achtung, ATmega: `int` hat nur 16 Bit. `uint16_t * uint16_t` wird darum in 16 Bit gerechnet und kann überlaufen, auch wenn das Ziel ein `uint32_t` ist.',
        'Teilen: zuerst multiplizieren, dann teilen – sonst gehen die Nachkommastellen verloren.',
        'Ausgabe: ganzer Teil mit `/`, Nachkommastellen mit `%` (Rest).'
      ] },
      { code: ['#include <avr/io.h>',
               '#include <stdint.h>',
               '',
               'int main(void) {',
               '    DDRA = 0xFF; DDRB = 0xFF;',
               '    uint16_t strecke_m = 3840;          // 3.840 km, Faktor 1000',
               '    strecke_m = strecke_m + 1250;       // + 1.250 km = 5.090 km',
               '    uint16_t spannung_mv = 4800;        // 4.800 V',
               '    uint16_t strom_ma = 250;            // 0.250 A',
               '    uint32_t leistung_mw = (uint32_t)spannung_mv * strom_ma / 1000;  // 1200 mW',
               '    int16_t temp_zehntel = 215;         // 21.5 °C, Faktor 10',
               '    while (1) {',
               '        PORTA = temp_zehntel / 10;      // ganzer Teil: 21',
               '        PORTB = temp_zehntel % 10;      // Nachkommastelle: 5',
               '    }',
               '}'] }
    ],
    fact: {
      title: 'Patriot-Rakete: 0.1 ist nicht 0.1',
      text: '1991 verfehlte eine Patriot-Abwehrrakete in Dhahran ihr Ziel; 28 Soldaten starben. Das System zählte die Zeit in Zehntelsekunden und multiplizierte mit 0.1 – gespeichert in einem 24-Bit-Festkommaregister. 0.1 ist binär aber ein unendlicher Bruch und wurde abgeschnitten. Nach 100 Stunden war die Uhr um etwa 0.34 Sekunden daneben. Mit einem dezimalen Faktor (Zeit als ganze Zehntelsekunden) wäre der Wert exakt geblieben.'
    },
    tasks: [
      { type: 'choice',
        q: 'Warum speichert man Kommazahlen auf dem ATmega2560 als Festkomma (Ganzzahl × Faktor)?',
        options: ['Er hat keine Gleitkomma-Einheit (FPU): Gleitkomma wäre langsam und bräuchte viel Flash',
                  'Weil C auf dem AVR keine Kommazahlen kennt',
                  'Weil Ganzzahlen weniger Bits haben als Kommazahlen',
                  'Weil die LEDs sonst flackern'],
        answer: 0,
        why: [null, 'Doch, der Compiler könnte sie in Software nachbauen – nur eben langsam und gross.', 'Nein, das hängt vom Typ ab, nicht von „Komma“.', 'Mit den LEDs hat das nichts zu tun.'],
        explain: 'Ohne FPU wird jede Gleitkomma-Operation in viele Ganzzahl-Befehle zerlegt. Festkomma rechnet mit normalen Ganzzahlen: schnell, klein und exakt.' },
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
      { type: 'choice',
        q: 'Ein Preis soll auf 2 Nachkommastellen genau gespeichert werden (z.B. 12.95 CHF). Welchen Faktor wählst du?',
        options: ['× 10', '× 100', '× 1000', '× 2'],
        answer: 1,
        why: ['Dann bliebe nur eine Nachkommastelle: aus 12.95 würde 129 (= 12.9).', null, 'Geht, ist aber genauer als nötig und braucht grössere Zahlen.', 'Der Faktor ist eine Zehnerpotenz – eine pro Nachkommastelle.'],
        explain: '2 Nachkommastellen → × 100: 12.95 CHF = 1295 Rappen.' },
      { type: 'number',
        q: 'Die Temperatur wird in Zehntelgrad als `int16_t` gespeichert (215 = 21.5 °C). Welcher Wert steht für −3.7 °C?',
        answer: '-37',
        explain: '−3.7 × 10 = −37. Negative Werte → Typ mit Vorzeichen.' },
      { type: 'number',
        q: '2.5 V (2500 mV) mal 0.2 A (200 mA). Welcher Wert steht danach in `leistung_mw`?',
        code: ['uint16_t spannung_mv = 2500;', 'uint16_t strom_ma = 200;', 'uint32_t leistung_mw = (uint32_t)spannung_mv * strom_ma / 1000;'],
        answer: '500', unit: 'mW',
        hint: 'Zuerst 2500 × 200 rechnen (Ergebnis in µW), dann durch 1000 teilen.',
        explain: '2500 × 200 = 500\'000 µW, ÷ 1000 = 500 mW = 0.5 W. Das Zwischenergebnis 500\'000 braucht 32 Bit – darum `(uint32_t)` vor der Multiplikation.' },
      { type: 'choice',
        q: 'Was zeigen die LEDs an Port A und Port B?',
        code: ['int16_t temp_zehntel = 215;   // 21.5 °C', 'DDRA = 0xFF; DDRB = 0xFF;', 'PORTA = temp_zehntel / 10;', 'PORTB = temp_zehntel % 10;'],
        options: ['PORTA = 21, PORTB = 5', 'PORTA = 21.5, PORTB = 0', 'PORTA = 2, PORTB = 15', 'PORTA = 215, PORTB = 10'],
        answer: 0,
        why: [null, 'Ganzzahl durch Ganzzahl bleibt ganzzahlig.', '`/ 10` teilt durch 10, nicht durch 100.', '`%` liefert den Rest der Division, nicht den Divisor.'],
        explain: '215 / 10 = 21 (ganzer Teil), 215 % 10 = 5 (Rest = Nachkommastelle). So zeigst du Festkomma auf LEDs an.' },
      { type: 'choice',
        q: 'Welchen Wert hat `prozent` nach dieser Zeile? (30 von 120)',
        code: ['uint16_t teil = 30;', 'uint16_t gesamt = 120;', 'uint16_t prozent = teil / gesamt * 100;'],
        options: ['0', '25', '100', '2500'],
        answer: 0,
        why: [null, '25 wäre richtig – aber hier wird zuerst geteilt.', 'Nein: 30 / 120 ist ganzzahlig 0.', 'Nein.'],
        explain: '30 / 120 = 0 (ganzzahlig, Rest fällt weg), 0 × 100 = 0. Richtig ist erst multiplizieren, dann teilen: `teil * 100 / gesamt` = 3000 / 120 = 25.' },
      { type: 'yesno',
        q: 'Auf dem ATmega2560 wird `uint16_t * uint16_t` in 16 Bit gerechnet – auch wenn das Ergebnis in einem `uint32_t` landet.',
        answer: true,
        explain: 'Weil `int` dort nur 16 Bit hat, werden zwei `uint16_t` nicht auf 32 Bit erweitert. 4800 × 250 = 1\'200\'000 läuft über. Abhilfe: einen Operanden vorher umwandeln, `(uint32_t)a * b`.' }
    ]
  },
  /* ------------------------------------------------------------ 6 */
  {
    id: 'effizient',
    title: 'Effizientesten Typ wählen',
    desc: 'Der kleinste Typ, der sicher passt – auch für Festkomma-Werte.',
    intro: [
      { p: 'Hier wählst du für eine Variable den sparsamsten Typ, der trotzdem sicher passt. Bei 8 KB SRAM zählt jedes Byte. Gehe in diesen Schritten vor:' },
      { ol: [
        'Komma? Dann zuerst skalieren: Die Aufgabe nennt den Faktor oder die Genauigkeit. Minimum und Maximum × Faktor.',
        'Bereich bestimmen: kleinster und grösster Wert, der gespeichert wird.',
        'Negativ? Wenn ja, brauchst du einen Typ mit Vorzeichen (`intN_t`), sonst reicht einer ohne (`uintN_t`).',
        'Kleinsten Typ nehmen, bei dem Minimum und Maximum beide in den Wertebereich passen.'
      ] },
      { table: { head: ['Typ', 'Bereich'], rows: [
        ['`uint8_t` / `int8_t`', '0 … 255 / −128 … 127'],
        ['`uint16_t` / `int16_t`', '0 … 65\'535 / −32\'768 … 32\'767'],
        ['`uint32_t` / `int32_t`', '0 … ca. 4.29 Mrd. / ca. ±2.1 Mrd.'],
        ['`uint64_t` / `int64_t`', 'riesig (ca. 1.8·10¹⁹ / ±9.2·10¹⁸)']
      ] } },
      { tip: 'Bei Festkomma zählt der gespeicherte Wert, nicht der angezeigte: 2.5 V mit Faktor 1000 sind 2500.' }
    ],
    fact: {
      title: 'Ariane 5: 370 Millionen Dollar Überlauf',
      text: 'Am 4. Juni 1996 zerstörte sich die Rakete Ariane 5 rund 37 Sekunden nach dem Start. Ursache: Eine 64-Bit-Kommazahl (horizontale Geschwindigkeit) wurde in eine 16-Bit-Ganzzahl mit Vorzeichen umgewandelt. Der Wert war grösser als 32\'767 – der Überlauf brachte das Steuersystem zum Absturz.'
    },
    tasks: [
      { type: 'pickType',
        q: 'Ein Zähler für Tastendrücke an Taster 0 – höchstens 200, nie negativ.',
        code: '____ druecke = 0;',
        min: '0', max: '200',
        options: ['int8_t', 'uint8_t', 'uint16_t', 'int32_t'],
        explain: '`uint8_t` deckt 0 … 255 ab und braucht nur 1 Byte. `int8_t` reicht nur bis 127 – 200 würde überlaufen.' },
      { type: 'pickType',
        q: 'Ein Temperatursensor am Mega liefert ganze Grad Celsius von −40 bis +85 °C.',
        code: '____ temperatur = -12;',
        min: '-40', max: '85',
        options: ['uint8_t', 'int8_t', 'int16_t', 'int32_t'],
        explain: '`int8_t` (−128 … 127) deckt −40 … 85 ab, mit nur 1 Byte. Ein Typ ohne Vorzeichen kann keine negativen Werte speichern.' },
      { type: 'pickType',
        q: 'Ein Messwert vom 10-Bit-ADC: 0 bis 1023.',
        code: '____ adc_wert = ADC;',
        min: '0', max: '1023',
        options: ['uint8_t', 'int8_t', 'uint16_t', 'uint32_t'],
        explain: '1023 braucht 10 Bit, 8 Bit reichen nicht. `uint16_t` (bis 65\'535) passt mit 2 Byte.' },
      { type: 'pickType',
        q: 'Eine gefahrene Strecke von 0 bis 9.999 km, auf 3 Nachkommastellen genau (Faktor 1000, also in Metern). Beispiel: 3.84 km.',
        code: '____ strecke_m = 3840;   // 3.840 km',
        min: '0', max: '9999', scale: 1000, real: { min: '0', max: '9.999' }, unit: 'km', sample: '3.84',
        options: ['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t'],
        explain: 'Skaliert: 0 … 9999. Das passt nicht in `uint8_t` (bis 255), aber in `uint16_t` (bis 65\'535).' },
      { type: 'pickType',
        q: 'Raumtemperatur von −40.0 bis 85.0 °C mit einer Nachkommastelle (Faktor 10, Zehntelgrad). Beispiel: 21.5 °C.',
        code: '____ temp_zehntel = 215;   // 21.5 °C',
        min: '-400', max: '850', scale: 10, real: { min: '-40.0', max: '85.0' }, unit: '°C', sample: '21.5',
        options: ['uint8_t', 'int8_t', 'uint16_t', 'int16_t'],
        explain: 'Skaliert: −400 … 850. Negativ → mit Vorzeichen; 850 sprengt 8 Bit → `int16_t`.' },
      { type: 'pickType',
        q: 'Die Akkuspannung von 0.00 bis 2.50 V, auf 2 Nachkommastellen genau (Faktor 100). Beispiel: 2.47 V.',
        code: '____ akku_cv = 247;   // 2.47 V',
        min: '0', max: '250', scale: 100, real: { min: '0.00', max: '2.50' }, unit: 'V', sample: '2.47',
        options: ['uint8_t', 'int8_t', 'uint16_t', 'int16_t'],
        explain: 'Skaliert: 0 … 250 – das passt gerade noch in `uint8_t` (bis 255). `int8_t` geht nur bis 127.' },
      { type: 'pickType',
        q: 'Millisekunden seit dem Einschalten. Das Gerät soll bis zu 30 Tage durchlaufen (30 × 86\'400\'000 ms).',
        code: '____ zeit_ms = 0;\nzeit_ms++;',
        min: '0', max: '2592000000',
        options: ['uint16_t', 'int32_t', 'uint32_t', 'uint64_t'],
        explain: '30 Tage = 2\'592\'000\'000 ms. `int32_t` geht nur bis ca. 2.15 Mrd., `uint32_t` bis 4.29 Mrd. – passt.' },
      { type: 'pickType',
        q: 'Das Guthaben einer Kantinenkarte von −500.00 bis 500.00 CHF, auf Rappen genau (Faktor 100).',
        code: '____ guthaben_rp = -1250;   // -12.50 CHF',
        min: '-50000', max: '50000', scale: 100, real: { min: '-500.00', max: '500.00' }, unit: 'CHF', sample: '500.00',
        options: ['int16_t', 'uint16_t', 'int32_t', 'int64_t'],
        explain: 'Skaliert: −50\'000 … 50\'000. `int16_t` geht nur bis 32\'767, also braucht es `int32_t`.' },
      { type: 'pickType',
        q: 'Eine Waage am Mega misst 0.000 bis 150.000 kg, auf Gramm genau (Faktor 1000).',
        code: '____ gewicht_g = 72350;   // 72.350 kg',
        min: '0', max: '150000', scale: 1000, real: { min: '0.000', max: '150.000' }, unit: 'kg', sample: '150.000',
        options: ['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t'],
        explain: 'Skaliert: 0 … 150\'000. Das ist mehr als 65\'535 → `uint32_t`.' }
    ]
  },
  /* ------------------------------------------------------------ 7 */
  {
    id: 'fehler',
    title: 'Fehler im Code finden',
    desc: 'Typ-Fehler in ATmega-Programmen aufspüren: Klick die fehlerhafte Zeile an.',
    intro: [
      { p: 'Jede Aufgabe hat zwei Schritte: Zuerst klickst du die fehlerhafte Zeile an, dann wählst du die passende Korrektur. Diese Fehler kommen auf dem ATmega2560 häufig vor:' },
      { ul: [
        'Überlauf: Ein Wert (z.B. ein Zähler) wird grösser als sein Typ erlaubt. Bei `uintN_t` springt er wieder auf 0; bei `intN_t` ist ein Überlauf undefiniertes Verhalten.',
        'Port zu schmal: `PORTA` hat nur 8 Bit. Gespeichert wird nur das Low-Byte, also Wert mod 256.',
        'Unterlauf: Ein `uintN_t` kann nicht negativ werden – 0 − 1 ergibt den Maximalwert.',
        'Ohne Vorzeichen für negative Werte: Ein negativer Wert wird zu einer grossen positiven Zahl.',
        '`int` ist nur 16 Bit: Zwischenergebnisse wie `a * b` oder `60 * 1000` werden in 16 Bit gerechnet, nicht im Typ der Zielvariable.',
        'Festkomma: Faktor vergessen, Zwischenergebnis zu klein, oder zuerst geteilt statt zuerst multipliziert.',
        'Bonus (kein Typfehler): Eingänge liest man über `PINx`, nicht über `PORTx`.'
      ] },
      { code: ['#define F_CPU 16000000UL    // 16 MHz, für _delay_ms()',
               '#include <avr/io.h>',
               '#include <util/delay.h>',
               '#include <stdint.h>'] },
      { tip: 'Frag dich bei jeder Zeile: Welcher Typ ist das wirklich – in welchem Typ wird gerechnet – und passt der Wert hinein?' }
    ],
    fact: {
      title: 'Das Jahr-2038-Problem',
      text: 'Viele Systeme zählen die Zeit in Sekunden seit dem 1.1.1970 in einem 32-Bit-Wert mit Vorzeichen. Am 19. Januar 2038 um 03:14:07 UTC ist 2\'147\'483\'647 erreicht – eine Sekunde später springt der Wert ins Negative und die Uhr zeigt plötzlich 1901. Moderne Systeme verwenden deshalb 64-Bit-Zeit.'
    },
    tasks: [
      { type: 'findBug',
        q: 'Die LEDs sollen den Punktestand 300 anzeigen – sie zeigen aber 44. Welche Zeile ist schuld?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF; DDRB = 0xFF;', '    uint16_t punkte = 300;', '    while (1) {', '        PORTA = punkte;', '    }', '}'],
        bugLines: [7],
        lineHint: 'Der Wert 300 ist korrekt gespeichert. Wie viele Bits hat das Ziel?',
        fixes: ['Auf zwei Ports verteilen: `PORTA = punkte >> 8; PORTB = punkte & 0xFF;`', '`uint32_t punkte = 300;`', '`PORTA = (uint16_t)punkte;`', '`int16_t punkte = 300;`'],
        fix: 0,
        why: [null, 'Der Typ von `punkte` ist nicht das Problem – `PORTA` bleibt 8 Bit breit.', 'Der Cast ändert nichts: `PORTA` kann trotzdem nur 8 Bit aufnehmen.', 'Auch mit Vorzeichen bleibt `PORTA` 8 Bit breit.'],
        explain: '`PORTA` hat nur 8 Bit. Gespeichert wird 300 mod 256 = 44. Ein 16-Bit-Wert braucht 16 LEDs: High-Byte auf Port A (1), Low-Byte auf Port B (44) – zusammen 1 × 256 + 44 = 300.' },
      { type: 'findBug',
        q: 'LED 0 soll jede Sekunde umschalten – sie schaltet aber nie. Welche Zeile ist schuld?',
        code: ['#define F_CPU 16000000UL', '#include <avr/io.h>', '#include <util/delay.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF;', '    uint8_t ms = 0;', '    while (1) {', '        _delay_ms(1);', '        ms++;', '        if (ms == 1000) {', '            PORTA ^= 0x01;', '            ms = 0;', '        }', '    }', '}'],
        bugLines: [7],
        lineHint: 'Der Vergleich ist an sich richtig – aber kann `ms` überhaupt 1000 werden?',
        fixes: ['`uint16_t ms = 0;`', '`int8_t ms = 0;`', '`if (ms >= 1000)`', '`uint8_t ms = 1;`'],
        fix: 0,
        why: [null, '`int8_t` geht sogar nur bis 127.', 'Auch `>=` wird nie wahr, solange `ms` höchstens 255 ist.', 'Der Startwert ändert nichts am Bereich.'],
        explain: 'Ein `uint8_t` geht nur bis 255, danach springt er auf 0. `ms == 1000` ist nie wahr. Mit `uint16_t` (bis 65\'535) klappt es.' },
      { type: 'findBug',
        q: 'Das Poti steht auf Maximum (ADC = 1023). Port A bleibt aber dunkel und Port B zeigt nur 255. Wo liegt der Fehler?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF; DDRB = 0xFF;', '    ADMUX = (1 << REFS0);                  // Referenz AVCC, Kanal 0', '    ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);', '    while (1) {', '        ADCSRA |= (1 << ADSC);             // Messung starten', '        while (ADCSRA & (1 << ADSC)) { }   // warten', '        uint8_t wert = ADC;                // 0 … 1023', '        PORTA = wert >> 8;', '        PORTB = wert & 0xFF;', '    }', '}'],
        bugLines: [10],
        lineHint: 'Der ADC hat 10 Bit. Wie viele Bits hat die Variable, die den Wert aufnimmt?',
        fixes: ['`uint16_t wert = ADC;`', '`int8_t wert = ADC;`', '`PORTA = wert >> 2;`', '`uint8_t wert = ADCH;`'],
        fix: 0,
        why: [null, 'Noch kleiner: nur bis 127.', 'Dann fehlen die oberen Bits trotzdem – sie sind schon beim Speichern verloren.', '`ADCH` allein liefert nur die oberen Bits des Ergebnisses, nicht den ganzen Wert.'],
        explain: '`ADC` liefert 0 … 1023 (10 Bit). Ein `uint8_t` behält nur das Low-Byte: 1023 mod 256 = 255, das High-Byte ist 0. Mit `uint16_t` zeigt Port A 3 und Port B 255.' },
      { type: 'findBug',
        q: 'Bonus (kein Typfehler): Die LEDs sollen zeigen, welche Taster gedrückt sind – sie reagieren aber gar nicht. Welche Zeile?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF;            // LEDs', '    DDRL = 0x00;            // Taster', '    while (1) {', '        uint8_t taster = PORTL;', '        PORTA = taster;', '    }', '}'],
        bugLines: [7],
        lineHint: 'Welches Register liefert den Zustand der Eingangs-Pins?',
        fixes: ['`uint8_t taster = PINL;`', '`uint8_t taster = DDRL;`', '`uint16_t taster = PORTL;`', '`DDRL = 0xFF;`'],
        fix: 0,
        why: [null, '`DDRL` enthält nur die Richtung (hier 0x00).', 'Der Typ ist nicht das Problem – das Register ist das falsche.', 'Dann wären die Taster-Pins Ausgänge.'],
        explain: 'Das ist kein Typfehler, sondern ein Register-Fehler: `PORTL` enthält, was du hineingeschrieben hast (bei Eingängen die Pull-up-Einstellung). Den Zustand der Pins liefert `PINL`.' },
      { type: 'findBug',
        q: 'Ein Lauflicht soll von LED 7 nach LED 0 laufen und dann von vorne beginnen. Es hängt aber nach LED 0. Welche Zeile?',
        code: ['#define F_CPU 16000000UL', '#include <avr/io.h>', '#include <util/delay.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF;', '    while (1) {', '        for (uint8_t i = 7; i >= 0; i--) {', '            PORTA = 1 << i;', '            _delay_ms(100);', '        }', '    }', '}'],
        bugLines: [8],
        lineHint: 'Kann `i >= 0` bei diesem Typ jemals falsch werden?',
        fixes: ['`for (int8_t i = 7; i >= 0; i--)`', '`for (uint16_t i = 7; i >= 0; i--)`', '`for (uint8_t i = 7; i >= 1; i--)`', '`for (uint8_t i = 7; i > 0; i++)`'],
        fix: 0,
        why: [null, 'Auch ein `uint16_t` ist nie negativ – gleiches Problem.', 'Dann endet die Schleife zwar, aber LED 0 leuchtet nie.', 'Jetzt zählt die Schleife aufwärts.'],
        explain: 'Ein `uint8_t` ist immer ≥ 0, die Bedingung ist immer wahr. Nach 0 macht `i--` daraus 255 (Unterlauf) – und `1 << 255` ist zudem undefiniert. Mit `int8_t` wird `i` nach 0 zu −1 und die Schleife beginnt neu.' },
      { type: 'findBug',
        q: 'Bei Frost sollen alle LEDs leuchten. Der Sensor meldet −5 °C, die LEDs bleiben aber dunkel. Welche Zeile?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int8_t sensor_lesen(void);   // liefert -20 … 50 °C', '', 'int main(void) {', '    DDRA = 0xFF;', '    while (1) {', '        uint8_t temp = sensor_lesen();', '        if (temp < 0) {', '            PORTA = 0xFF;', '        } else {', '            PORTA = 0x00;', '        }', '    }', '}'],
        bugLines: [8],
        lineHint: 'Die Bedingung ist an sich richtig – aber kann die Variable überhaupt negativ werden?',
        fixes: ['`int8_t temp = sensor_lesen();`', '`uint16_t temp = sensor_lesen();`', '`if (temp <= 0)`', '`uint8_t temp = -sensor_lesen();`'],
        fix: 0,
        why: [null, 'Auch ohne Vorzeichen – aus −5 wird 65\'531.', 'Ein `uint8_t` ist nur bei genau 0 „≤ 0“ – bei −5 °C nicht.', 'Dann wären positive Temperaturen falsch.'],
        explain: 'Ein `uint8_t` kann nicht negativ sein: −5 wird zu 251. `temp < 0` ist immer falsch. Für Werte, die negativ werden können, braucht es einen Typ mit Vorzeichen: `int8_t` (−128 … 127).' },
      { type: 'findBug',
        q: 'Die Leistung soll 1200 mW sein. Die LEDs zeigen aber 20. Welche Zeile ist schuld?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF; DDRB = 0xFF;', '    uint16_t spannung_mv = 4800;                      // 4.800 V', '    uint16_t strom_ma = 250;                          // 0.250 A', '    uint32_t leistung_uw = spannung_mv * strom_ma;    // µW', '    uint16_t leistung_mw = leistung_uw / 1000;', '    PORTA = leistung_mw >> 8;', '    PORTB = leistung_mw & 0xFF;', '    while (1) { }', '}'],
        bugLines: [7],
        lineHint: 'Das Ziel ist ein `uint32_t` – aber in welchem Typ wird die Multiplikation auf dem ATmega gerechnet?',
        fixes: ['`uint32_t leistung_uw = (uint32_t)spannung_mv * strom_ma;`', '`uint32_t leistung_uw = (uint32_t)(spannung_mv * strom_ma);`', '`uint16_t leistung_uw = spannung_mv * strom_ma;`', '`uint64_t leistung_uw = spannung_mv * strom_ma;`'],
        fix: 0,
        why: [null, 'Die Klammer rechnet zuerst in 16 Bit – der Überlauf passiert vor der Umwandlung.', 'Dann ist auch das Ziel zu klein.', 'Die Multiplikation passiert trotzdem in 16 Bit.'],
        explain: 'Auf dem ATmega ist `int` 16 Bit, also wird `uint16_t * uint16_t` in 16 Bit gerechnet: 1\'200\'000 mod 65\'536 = 20\'352, ÷ 1000 = 20. Wird ein Operand vorher zu `uint32_t`, rechnet C in 32 Bit.' },
      { type: 'findBug',
        q: 'Der Lüfter (LED 0) soll ab 25.0 °C laufen. Er läuft aber schon bei 2.6 °C. Welche Zeile?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int16_t temp_lesen(void);   // Zehntelgrad, 215 = 21.5 °C', '', 'int main(void) {', '    DDRA = 0xFF;', '    int16_t grenze = 25;       // 25.0 °C', '    while (1) {', '        int16_t temp_zehntel = temp_lesen();', '        if (temp_zehntel > grenze) {', '            PORTA = 0x01;', '        } else {', '            PORTA = 0x00;', '        }', '    }', '}'],
        bugLines: [7],
        lineHint: 'Beide Werte im Vergleich müssen denselben Faktor haben.',
        fixes: ['`int16_t grenze = 250;`', '`int8_t grenze = 25;`', '`uint16_t grenze = 25;`', '`int16_t grenze = 2;`'],
        fix: 0,
        why: [null, 'Der Typ ist nicht das Problem, sondern der Faktor.', 'Der Typ ist nicht das Problem, sondern der Faktor.', 'Das macht es noch schlimmer.'],
        explain: 'Die Temperatur ist in Zehntelgrad gespeichert (Faktor 10), die Grenze aber nicht. 25 bedeutet 2.5 °C. Richtig: 25.0 × 10 = 250.' },
      { type: 'findBug',
        q: 'Die Spannung am ADC soll in mV (0 … 5000) angezeigt werden. Sie ist aber fast immer 0 – nur bei ADC = 1023 genau 5000. Welche Zeile?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF; DDRB = 0xFF;', '    while (1) {', '        uint16_t adc = ADC;                // 0 … 1023', '        uint16_t mv = adc / 1023 * 5000;', '        PORTA = mv >> 8;', '        PORTB = mv & 0xFF;', '    }', '}'],
        bugLines: [7],
        lineHint: 'Was ergibt `adc / 1023` als Ganzzahldivision, wenn adc kleiner als 1023 ist?',
        fixes: ['`uint16_t mv = (uint32_t)adc * 5000 / 1023;`', '`uint16_t mv = adc * 5000 / 1023;`', '`uint32_t mv = adc / 1023 * 5000;`', '`uint16_t mv = adc / (1023 * 5000);`'],
        fix: 0,
        why: [null, 'Reihenfolge richtig, aber `adc * 5000` wird auf dem ATmega in 16 Bit gerechnet und läuft über.', 'Das Ziel ist nicht das Problem – geteilt wird immer noch zuerst.', 'Dann ist das Ergebnis immer 0.'],
        explain: 'Ganzzahldivision zuerst: `adc / 1023` ist 0 für alle Werte unter 1023. Zuerst multiplizieren, dann teilen – und weil 1023 × 5000 = 5\'115\'000 nicht in 16 Bit passt, in 32 Bit rechnen.' }
    ]
  },
  /* ------------------------------------------------------------ 8 */
  {
    id: 'structs',
    title: 'Structs & RAM-Budget',
    desc: 'sizeof von structs, Arrays im 8-KB-SRAM und Felder verkleinern.',
    intro: [
      { p: 'Ein struct fasst mehrere Felder zu einem Datensatz zusammen, z.B. eine Messung mit ADC-Wert, Temperatur und Zeit.' },
      { p: 'Auf dem ATmega2560 (avr-gcc) gibt es keine Füllbytes: Der 8-Bit-Prozessor liest jedes Byte einzeln, darum dürfen alle Felder an jeder Adresse liegen. Die Grösse eines structs ist einfach die Summe seiner Felder.' },
      { code: ['struct Messung {',
               '    uint16_t adc;            // 2 Byte',
               '    int16_t  temp_zehntel;   // 2 Byte',
               '    uint8_t  kanal;          // 1 Byte',
               '    uint32_t zeit_ms;        // 4 Byte',
               '};                           // sizeof = 2 + 2 + 1 + 4 = 9',
               '',
               'struct Messung log[200];     // 200 × 9 = 1800 Bytes SRAM'] },
      { ul: [
        'Ein Array aus structs braucht Anzahl × `sizeof(struct)`.',
        'Alles muss in die 8192 Bytes SRAM passen – zusammen mit allen anderen Variablen und dem Stack. Plane darum mit weniger, z.B. ein paar tausend Bytes.',
        'RAM sparen: Jedes Feld so klein wählen, wie sein Wertebereich erlaubt. Ein Byte weniger pro Datensatz sind bei 1000 Datensätzen schon 1000 Bytes.',
        'Am PC oder auf ARM-Controllern wäre das anders: Dort fügt der Compiler Füllbytes (Padding) ein, damit z.B. ein `uint32_t` an einer durch 4 teilbaren Adresse liegt. Für den ATmega2560 brauchst du das nicht.'
      ] },
      { tip: 'Für jedes Feld: Bereich → kleinster passender Typ. Dann Summe × Anzahl und mit dem freien RAM vergleichen.' }
    ],
    fact: {
      title: 'Konstanten in den Flash',
      text: 'Der ATmega2560 hat 32-mal mehr Flash (256 KB) als SRAM (8 KB). Grosse konstante Tabellen – etwa Lauflicht-Muster oder Texte – legt man darum mit `PROGMEM` in den Flash und liest sie mit `pgm_read_byte()`. So bleibt der knappe SRAM für Variablen frei.'
    },
    tasks: [
      { type: 'number',
        q: 'Wie gross ist diese struct auf dem ATmega2560?',
        code: ['struct A {', '    uint8_t  c;', '    uint16_t s;', '    uint8_t  d;', '};', 'PORTA = sizeof(struct A);'],
        answer: '4', unit: 'Bytes',
        hint: 'Auf dem ATmega2560 gibt es keine Füllbytes. Einfach zusammenzählen.',
        explain: '1 + 2 + 1 = 4 Byte. avr-gcc fügt keine Füllbytes ein, die LEDs zeigen 4.' },
      { type: 'number',
        q: 'Wie gross ist diese struct für ein Taster-Ereignis?',
        code: ['struct Ereignis {', '    uint8_t  taster;    // Nummer 0 … 7', '    uint32_t zeit_ms;   // wann gedrückt', '    uint8_t  dauer;     // in 10-ms-Schritten', '};'],
        answer: '6', unit: 'Bytes',
        explain: '1 + 4 + 1 = 6 Byte. Die Reihenfolge der Felder spielt auf dem ATmega2560 für die Grösse keine Rolle.' },
      { type: 'choice',
        q: 'Warum ist `sizeof` eines structs auf dem ATmega2560 genau die Summe seiner Felder?',
        options: ['Der 8-Bit-Prozessor liest jedes Byte einzeln – avr-gcc braucht darum keine Füllbytes (Ausrichtung 1)',
                  'Weil der Compiler die Felder automatisch nach Grösse sortiert',
                  'Weil structs auf dem AVR verboten sind',
                  'Weil `sizeof` auf dem AVR die Füllbytes nicht mitzählt'],
        answer: 0,
        why: [null, 'Nein, C behält die Reihenfolge der Felder immer bei.', 'Nein, structs sind ganz normal erlaubt.', 'Doch, `sizeof` zählt immer alles – es gibt hier einfach keine Füllbytes.'],
        explain: 'Auf Prozessoren mit 16-, 32- oder 64-Bit-Zugriffen richtet der Compiler Felder aus und füllt auf. Der ATmega2560 greift byteweise zu – jedes Feld darf an jeder Adresse liegen.' },
      { type: 'number',
        q: 'Ein Datenlogger speichert 500 Messungen. Wie viele Bytes SRAM braucht das Array?',
        code: ['struct Messung {', '    uint16_t adc;', '    int16_t  temp_zehntel;', '    uint8_t  kanal;', '    uint32_t zeit_ms;', '};', 'struct Messung log[500];'],
        answer: '4500', unit: 'Bytes',
        hint: 'Erst sizeof(struct Messung) bestimmen (Summe), dann × 500.',
        explain: '2 + 2 + 1 + 4 = 9 Byte, × 500 = 4500 Byte – mehr als die Hälfte der 8192 Bytes SRAM.' },
      { type: 'yesno',
        q: 'Passt `struct Messung log[1000];` (9 Byte pro Messung) in die 8 KB SRAM des ATmega2560?',
        answer: false,
        explain: '1000 × 9 = 9000 Bytes > 8192 Bytes. Das Array allein wäre grösser als der ganze SRAM – der Linker meldet einen Fehler bzw. das Programm stürzt ab.' },
      { type: 'structFit',
        q: 'Der Datenlogger soll 600 Messungen speichern, frei sind 6000 Bytes. Wähle für jedes Feld den kleinsten passenden Typ.',
        name: 'Messung', count: 600, budget: 6000,
        fields: [
          { name: 'adc', min: '0', max: '1023', desc: 'ADC-Wert, 0 … 1023', start: 'uint32_t' },
          { name: 'temp_zehntel', min: '-400', max: '850', desc: '−40.0 … 85.0 °C, Faktor 10', start: 'int32_t' },
          { name: 'kanal', min: '0', max: '15', desc: 'ADC-Kanal 0 … 15', start: 'uint32_t' },
          { name: 'zeit_s', min: '0', max: '86399', desc: 'Sekunden seit Mitternacht, 0 … 86\'399', start: 'uint64_t' }
        ],
        explain: '`uint16_t` (2) + `int16_t` (2) + `uint8_t` (1) + `uint32_t` (4) = 9 Byte. 600 × 9 = 5400 Bytes – passt. Vorher: 20 Byte × 600 = 12\'000 Bytes.' },
      { type: 'structFit',
        q: 'Ein Entprell-Protokoll merkt sich 500 Taster-Ereignisse in 3000 freien Bytes. Mach die Felder so klein wie möglich.',
        name: 'Druck', count: 500, budget: 3000,
        fields: [
          { name: 'taster', min: '0', max: '7', desc: 'Taster-Nummer an Port L, 0 … 7', start: 'uint16_t' },
          { name: 'dauer_ms', min: '0', max: '5000', desc: 'Dauer in ms, 0 … 5000', start: 'uint32_t' },
          { name: 'zeit_s', min: '0', max: '3599', desc: 'Sekunde innerhalb der Stunde, 0 … 3599', start: 'uint32_t' }
        ],
        explain: '`uint8_t` (1) + `uint16_t` (2) + `uint16_t` (2) = 5 Byte. 500 × 5 = 2500 Bytes – passt in 3000. Vorher: 10 Byte × 500 = 5000 Bytes.' },
      { type: 'structFit',
        q: 'Eine Wetterstation am Mega speichert 400 Datensätze in 3000 freien Bytes. Die Kommawerte sind Festkomma mit Faktor 10.',
        name: 'Wetter', count: 400, budget: 3000,
        fields: [
          { name: 'temp_zehntel', min: '-400', max: '600', desc: '−40.0 … 60.0 °C, Faktor 10', start: 'int32_t' },
          { name: 'feuchte_zehntel', min: '0', max: '1000', desc: '0.0 … 100.0 %, Faktor 10', start: 'uint32_t' },
          { name: 'druck_zehntel', min: '3000', max: '11000', desc: '300.0 … 1100.0 hPa, Faktor 10', start: 'uint32_t' },
          { name: 'wind', min: '0', max: '50', desc: 'Wind in ganzen m/s, 0 … 50', start: 'int16_t' }
        ],
        explain: '`int16_t` (2) + `uint16_t` (2) + `uint16_t` (2) + `uint8_t` (1) = 7 Byte. 400 × 7 = 2800 Bytes – passt knapp. Vorher: 14 Byte × 400 = 5600 Bytes.' }
    ]
  },
  /* ------------------------------------------------------------ 9 */
  {
    id: 'pruefung',
    title: 'Abschlussprüfung',
    desc: 'Gemischte Aufgaben aus allen Levels – ohne Spickzettel.',
    cheat: false,
    exam: true,
    intro: [
      { p: 'Die Abschlussprüfung mischt Aufgaben aus allen Levels. Der Spickzettel ist hier gesperrt – diese Info kannst du aber während der Prüfung jederzeit wieder öffnen. Das Wichtigste in Kürze:' },
      { ul: [
        'Namensschema: `u` = ohne Vorzeichen, Zahl = Bits, z.B. `int16_t` = mit Vorzeichen, 16 Bit = 2 Byte.',
        'Wertebereich mit n Bits: ohne Vorzeichen 0 … 2ⁿ − 1, mit Vorzeichen −2ⁿ⁻¹ … 2ⁿ⁻¹ − 1.',
        'ATmega2560: 8 KB SRAM, Ports 8 Bit (`DDRx`, `PORTx`, `PINx`), ADC 10 Bit, Timer1 16 Bit, `int` = 16 Bit.',
        'LEDs: `PORTA` übernimmt nur 8 Bit (Wert mod 256). 16 Bit: `PORTA = wert >> 8; PORTB = wert & 0xFF;`',
        'Zweierkomplement: Das oberste Bit zählt negativ (bei 8 Bit −128).',
        'Festkomma: Wert × Faktor als Ganzzahl. Typ nach dem skalierten Bereich wählen. Multiplikation in grösserem Typ, zuerst multiplizieren, dann teilen.',
        'Zwischenergebnisse: werden mindestens in `int` (16 Bit) gerechnet – nicht im Typ der Zielvariable.',
        'Structs: `sizeof` = Summe der Felder (kein Padding auf dem AVR), Array = Anzahl × sizeof.'
      ] },
      { tip: 'Lies jede Aufgabe genau: Welcher Typ, wie viele Bits, mit oder ohne Vorzeichen, welcher Faktor? Viel Erfolg!' }
    ],
    tasks: [
      { type: 'yesno',
        q: 'Passt der Wert 300 in einen `uint8_t`?',
        answer: false,
        explain: '`uint8_t` geht nur bis 255. Gespeichert würde 300 − 256 = 44 – genau das würden die LEDs bei `PORTA = 300;` zeigen.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `int16_t`?',
        answer: '32767',
        explain: '2¹⁵ − 1 = 32\'767 – so weit geht auch ein `int` auf dem ATmega2560.' },
      { type: 'choice',
        q: 'Welche LEDs leuchten nach `PORTA = 0x81;`?',
        options: ['LED 7 und LED 0', 'LED 8 und LED 1', 'LED 0 bis LED 7', 'Nur LED 1'],
        answer: 0,
        why: [null, 'Die LEDs heissen wie die Bits: 0 bis 7.', 'Das wäre `0xFF`.', 'Das wäre `0x02`.'],
        explain: '8 = `1000` (Bit 7), 1 = `0001` (Bit 0) → `10000001` = 129.' },
      { type: 'bits', bits: 8, mode: 'mitVZ', target: -100, leds: true,
        q: 'Stelle −100 als `int8_t` ein.',
        explain: '−100 = −128 + 28 = −128 + 16 + 8 + 4 → `10011100`. Als `uint8_t` gelesen wären dieselben Bits 156 (= 256 − 100).' },
      { type: 'pickType',
        q: 'Der Füllstand eines Tanks: 0.0 bis 999.9 Liter, auf eine Nachkommastelle genau (Faktor 10). Beispiel: 120.5 Liter.',
        code: '____ fuellstand_dl = 1205;   // 120.5 l',
        min: '0', max: '9999', scale: 10, real: { min: '0.0', max: '999.9' }, unit: 'l', sample: '120.5',
        options: ['uint8_t', 'uint16_t', 'int32_t', 'uint64_t'],
        explain: 'Skaliert: 0 … 9999 → `uint16_t` (2 Byte). `uint8_t` geht nur bis 255.' },
      { type: 'choice',
        q: 'Was zeigen die LEDs an Port A und Port B?',
        code: ['uint16_t temp = 1234;   // 12.34 °C, Faktor 100', 'PORTA = temp / 100;', 'PORTB = temp % 100;'],
        options: ['PORTA = 12, PORTB = 34', 'PORTA = 12.34, PORTB = 0', 'PORTA = 123, PORTB = 4', 'PORTA = 1234, PORTB = 100'],
        answer: 0,
        why: [null, 'Ganzzahl durch Ganzzahl bleibt ganzzahlig – und LEDs zeigen nur ganze Zahlen.', 'Das wäre mit Faktor 10.', '1234 passt gar nicht auf 8 LEDs.'],
        explain: '1234 / 100 = 12 (ganzer Teil), 1234 % 100 = 34 (die zwei Nachkommastellen).' },
      { type: 'findBug',
        q: 'Die LEDs sollen 60 (Sekunden pro Minute) zeigen, zeigen aber Unsinn. Der Compiler warnt „integer overflow in expression“. Welche Zeile?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF;', '    uint32_t ms_pro_minute = 60 * 1000;', '    uint16_t sekunden = ms_pro_minute / 1000;', '    PORTA = sekunden;', '    while (1) { }', '}'],
        bugLines: [5],
        lineHint: '60 und 1000 sind `int`-Konstanten. Wie gross ist `int` auf dem ATmega?',
        fixes: ['`uint32_t ms_pro_minute = 60UL * 1000;`', '`uint64_t ms_pro_minute = 60 * 1000;`', '`uint32_t ms_pro_minute = (uint32_t)(60 * 1000);`', '`uint16_t sekunden = ms_pro_minute / 100;`'],
        fix: 0,
        why: [null, 'Das Ziel ist nicht das Problem – `60 * 1000` wird vorher in 16 Bit gerechnet.', 'Die Klammer rechnet zuerst in `int` – der Überlauf passiert vor der Umwandlung.', 'Die Division ist richtig.'],
        explain: '`60 * 1000` sind zwei `int`-Werte, also rechnet C in 16 Bit: 60\'000 > 32\'767 → Überlauf. Mit `60UL` (unsigned long, 32 Bit) rechnet C in 32 Bit.' },
      { type: 'number',
        q: 'Wie viele Bytes SRAM belegt dieses Array auf dem ATmega2560?',
        code: ['struct Ereignis {', '    uint8_t  taster;', '    uint16_t dauer_ms;', '    uint32_t zeit_ms;', '};', 'struct Ereignis protokoll[100];'],
        answer: '700', unit: 'Bytes',
        explain: '1 + 2 + 4 = 7 Byte pro Ereignis (keine Füllbytes), × 100 = 700 Byte.' },
      { type: 'number',
        q: 'Wie viele Bytes belegt dieses Array?',
        code: ['#include <stdint.h>', 'uint16_t adc_log[256];'],
        answer: '512', unit: 'Bytes',
        explain: '256 × 2 Byte = 512 Byte – ein Sechzehntel der 8 KB SRAM.' }
    ]
  }
];

/* Akzentfarbe pro Level (gleiche Reihenfolge wie LEVELS). Alle hell genug fuer dunkle Schrift. */
var LEVEL_COLORS = ['#FFD23F', '#3DD6AE', '#5AA9FF', '#FF8A5B', '#B79CFF', '#B5E655', '#FF7FB6', '#4FD8E8', '#FF5A4E'];

/* Raenge, abgeleitet aus dem Gesamtfortschritt (Anteil geloester Aufgaben). */
var RANKS = [
  { min: 0,    name: 'Bit-Neuling' },
  { min: 0.1,  name: 'Byte-Sammler' },
  { min: 0.3,  name: 'Overflow-Jäger' },
  { min: 0.55, name: 'Register-Profi' },
  { min: 0.8,  name: 'RAM-Meister' },
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
    'Bingo. Dein SRAM ist gut organisiert.'
  ],
  wrong: [
    'Ups, nicht ganz. Nochmal?',
    'Knapp daneben. Das passiert den Besten.',
    'Noch nicht. Schau nochmal genau hin.',
    'Fast. Ein Bit fehlt noch zum Glück.',
    'Nope – aber jetzt weisst du schon, was es nicht ist.',
    'Daneben. Kein Problem, neuer Versuch.',
    'Hm, das passt nicht ganz. Der Tipp hilft.',
    'Nicht ganz. Fehler sind hier gratis – kein Flash wird verbraucht.',
    'Leider nein. Atme kurz durch, dann nochmal.'
  ],
  meh: 'Funktioniert – aber nicht optimal.',
  retryRight: ' Drangeblieben lohnt sich.',
  streak: {
    3: '3 in Folge! Du bist warmgelaufen.',
    5: '5 in Folge! Langsam wird es unheimlich.',
    8: '8 in Folge! Alle 8 LEDs leuchten für dich.'
  },
  home: [
    'Hoi! Ich bin Bit. Ich wohne auf einem ATmega2560 und kenne jedes seiner 8192 Bytes SRAM.',
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
    'Erledigt! Das kommt ins EEPROM – das vergesse ich nie.',
    'Abgehakt. Du wirst gerade richtig gut.'
  ],
  play: 'Hier kannst du nichts kaputt machen. Ausser den Wertebereich.',
  rankUp: 'Neuer Rang!'
};

/* Sprueche, wenn man Bit anstupst. Du-Form, Schweizer Schreibweise. */
var BIT_POKE = [
  'Hey, das kitzelt! Zum Glück bin ich gegen Bitflips versiegelt.',
  'Wusstest du? Ein Byte hat 8 Bit – genau so viele LEDs hat Port A.',
  '`uint8_t` geht von 0 bis 255. Mehr passt nicht in ein Port-Register.',
  'Ich ticke mit 16 MHz. Das sind 16 Millionen Takte pro Sekunde – und ich langweile mich trotzdem nie.',
  'Ich habe keine FPU. Kommazahlen rechne ich lieber in Millivolt und Zehntelgrad.',
  'Ein Nibble sind 4 Bit. Klingt nach Znüni, ist aber eine Hex-Ziffer.',
  'Wenn ein `uint8_t` bei 255 noch eins drauflegt, fängt er wieder bei 0 an. Kreislauf des Lebens.',
  'Bei mir ist `int` nur 16 Bit. Darum schreibe ich lieber gleich `int16_t`.',
  'Psst: Taster liest man über `PINL`, nicht über `PORTL`. Mein Lieblingsfakt.',
  '8 KB SRAM – klingt wenig, reicht aber, wenn man die Typen klug wählt.'
];

/* ---------- Simulator: Beispielprogramme (Daten fuer js/sim.js) ---------- */
var SIM_EXAMPLES = [
  {
    title: 'LEDs einschalten',
    text: 'Das kleinste Programm: `DDRA = 0xFF;` macht alle 8 Pins von Port A zu Ausgängen, dann legt `PORTA` fest, welche LEDs leuchten. Probier andere Muster, z.B. `0b11110000` – oder lösch die DDRA-Zeile und schau, was passiert.',
    code: [
      '#include <avr/io.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;          // alle 8 Pins von Port A als Ausgang',
      '    PORTA = 0b10101010;   // jede zweite LED an',
      '',
      '    while (1)',
      '    {',
      '        // nichts mehr zu tun – die LEDs bleiben an',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Binärzähler auf PORTA',
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
    title: 'Lauflicht',
    text: 'Ein einzelnes Bit wird mit `<< 1` nach links geschoben. Wenn es aus dem `uint8_t` herausfällt, ist das Muster 0 – dann geht es wieder bei LED 0 los.',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;',
      '    uint8_t muster = 0x01;',
      '',
      '    while (1)',
      '    {',
      '        PORTA = muster;',
      '        _delay_ms(150);',
      '        muster = muster << 1;   // eine Stelle nach links',
      '        if (muster == 0)',
      '        {',
      '            muster = 0x01;      // wieder bei LED 0 anfangen',
      '        }',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Taster schaltet LEDs',
    text: 'Halte Taster L0 gedrückt: Solange `PINL` Bit 0 = 1 ist, leuchten alle LEDs an PORTA. Eingänge liest man über `PINL`, nicht über `PORTL`.',
    code: [
      '#include <avr/io.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRA = 0xFF;   // LEDs: Ausgang',
      '    DDRL = 0x00;   // Taster: Eingang',
      '',
      '    while (1)',
      '    {',
      '        if (PINL & (1 << PL0))   // Taster L0 gedrückt?',
      '        {',
      '            PORTA = 0xFF;',
      '        }',
      '        else',
      '        {',
      '            PORTA = 0x00;',
      '        }',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Schalter → LEDs spiegeln',
    text: 'Die 8 Schalter an Port C werden gelesen und 1:1 auf PORTB ausgegeben. Leg ein paar Schalter um!',
    code: [
      '#define F_CPU 16000000UL',
      '#include <avr/io.h>',
      '#include <util/delay.h>',
      '#include <stdint.h>',
      '',
      'int main(void)',
      '{',
      '    DDRB = 0xFF;   // LEDs an Port B: Ausgang',
      '    DDRC = 0x00;   // Schalter an Port C: Eingang',
      '',
      '    while (1)',
      '    {',
      '        uint8_t schalter = PINC;',
      '        PORTB = schalter;',
      '        _delay_ms(10);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: '16-Bit-Zähler auf zwei Ports',
    text: 'Ein `uint16_t` ist zu gross für 8 LEDs. Darum kommt das High-Byte (`>> 8`) auf PORTA und das Low-Byte (`& 0xFF`) auf PORTB.',
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
      '        PORTA = zaehler >> 8;     // High-Byte',
      '        PORTB = zaehler & 0xFF;   // Low-Byte',
      '        zaehler += 37;',
      '        _delay_ms(50);',
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
    title: 'Festkomma: ADC → Millivolt',
    text: 'Schieb den ADC-Regler. Der Rohwert 0–1023 wird ohne Kommazahlen in Millivolt umgerechnet. Wichtig: `1023 * 5000` passt nicht in 16 Bit – darum der Cast auf `uint32_t`. PORTA zeigt die ganzen Volt, PORTB die Zehntel.',
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
      '',
      '    while (1)',
      '    {',
      '        uint16_t roh = ADC;                          // 0 … 1023 (Schieberegler)',
      '        uint16_t mv = (uint32_t)roh * 5000 / 1023;   // Festkomma: Millivolt',
      '        uint8_t volt = mv / 1000;                    // ganze Volt',
      '        uint8_t zehntel = (mv % 1000) / 100;         // erste Nachkommastelle',
      '        PORTA = volt;',
      '        PORTB = zehntel;',
      '        _delay_ms(100);',
      '    }',
      '}'
    ].join('\n')
  }
];

/* Simulator-Challenges: phases = Eingaben fuer ms Millisekunden, danach optional expect (sichtbare LEDs = PORTx & DDRx) */
var SIM_CHALLENGES = [
  {
    id: 'sim-led07', title: 'Nur LED 0 und 7',
    text: 'Lass an PORTA nur die LEDs 0 und 7 leuchten – alle anderen bleiben aus. Tipp: Binär- oder Hex-Literal.',
    check: { phases: [{ ms: 300, expect: { A: 0x81 } }] }
  },
  {
    id: 'sim-invert', title: 'Schalter umgekehrt',
    text: 'Zeig auf PORTB das Gegenteil der Schalter an Port C: Schalter an → LED aus und umgekehrt. Tipp: Der Operator `~` dreht alle Bits um.',
    check: { phases: [
      { C: 0x00, ms: 80, expect: { B: 0xFF }, say: 'Alle Schalter aus' },
      { C: 0x0F, ms: 80, expect: { B: 0xF0 }, say: 'Schalter 0–3 an' },
      { C: 0xA5, ms: 80, expect: { B: 0x5A }, say: 'Schalter 0b10100101' }
    ] }
  },
  {
    id: 'sim-count', title: 'Zähle mit Taster L0',
    text: 'Jeder Druck auf Taster L0 erhöht einen `uint8_t`-Zähler um 1, angezeigt auf PORTA. Gedrückt halten darf nur einmal zählen! Tipp: den alten Tasterzustand merken und nur beim Wechsel von 0 auf 1 zählen.',
    check: { phases: [
      { L: 0, ms: 60 },
      { L: 1, ms: 120 }, { L: 0, ms: 120 },
      { L: 1, ms: 120 }, { L: 0, ms: 120 },
      { L: 1, ms: 120 }, { L: 0, ms: 120, expect: { A: 3 }, say: 'Nach 3 Tastendrücken' }
    ] }
  },
  {
    id: 'sim-pingpong', title: 'Lauflicht hin und zurück',
    text: 'Ein einzelnes Licht wandert auf PORTA von LED 0 bis LED 7 und dann wieder zurück zu LED 0 – immer weiter (mit `_delay_ms`).',
    check: { phases: [{ ms: 12000 }], seq: { port: 'A', contains: [1, 2, 4, 8, 16, 32, 64, 128, 64, 32, 16, 8, 4, 2, 1] } }
  },
  {
    id: 'sim-free-timer', title: 'Frei: Sekunden mit TCNT1',
    text: 'Für Profis: Starte Timer 1 mit `TCCR1B = (1 << CS12) | (1 << CS10);` (Vorteiler 1024 → 15625 Takte pro Sekunde) und lass einen Sekundenzähler auf PORTA laufen, ohne `_delay_ms`. Welchen Typ braucht der Vergleichswert?'
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
