/* Aufgabendaten fuer "C-Variablentypen lernen" – Plattform: ATmega2560 (Arduino Mega 2560, avr-gcc).
 * Alles hier sind reine Daten. Neue Aufgaben einfach in ein tasks-Array einfuegen.
 *
 * Gelehrt werden nur die Ganzzahltypen mit fester Groesse aus <stdint.h>:
 *   uint8_t, int8_t, uint16_t, int16_t, uint32_t, int32_t, uint64_t, int64_t
 * Kommazahlen werden als Festkomma gespeichert: Wert x Skalierungsfaktor (10, 100, 1000 ...) als Ganzzahl.
 *
 * Es geht nur um Variablentypen. In Codebeispielen zeigen LEDs an PORTA (und PORTB) nur den Wert einer Variablen an
 * (reine Kulisse, wird nicht erklaert oder abgefragt).
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
    desc: 'Der ATmega2560, Datentypen und das Namensschema.',
    intro: [
      { p: 'Alle Beispiele laufen auf dem ATmega2560, dem Mikrocontroller auf dem Arduino Mega 2560. Er ist ein 8-Bit-AVR mit 16 MHz: Er rechnet am liebsten mit 8 Bit auf einmal. Eine Gleitkomma-Einheit (FPU) hat er nicht.' },
      { p: 'Jede Variable hat einen Datentyp. Er legt fest, wie viele Bits sie hat und wie diese Bits gelesen werden. Hier lernst du nur Ganzzahltypen mit fester Grösse. Ihr Name verrät alles:' },
      { table: { head: ['Teil des Namens', 'Bedeutung', 'Beispiel'], rows: [
        ['`u` am Anfang', 'ohne Vorzeichen (nur 0 und positiv)', '`uint8_t`: 0 … 255'],
        ['ohne `u`', 'mit Vorzeichen (auch negativ)', '`int8_t`: −128 … 127'],
        ['Zahl', 'Anzahl Bits (8, 16, 32 oder 64)', '`uint16_t` = 16 Bit'],
        ['`_t`', '„type“ – zeigt, dass es ein Typname ist', '']
      ] } },
      { p: 'In den Beispielen zeigen 8 LEDs an PORTA (und PORTB) den Wert einer Variablen an.' },
      { code: ['#include <avr/io.h>',
               '#include <stdint.h>     // Typen: uint8_t, int16_t, ...',
               '',
               'int main(void) {',
               '    DDRA = 0xFF;',
               '    uint8_t zaehler = 0;     // 8 Bit ohne Vorzeichen: 0 … 255',
               '    int8_t  differenz = -5;  // 8 Bit mit Vorzeichen: −128 … 127',
               '    uint16_t messwert = 1023; // 16 Bit: 0 … 65\'535 (10-Bit-Sensor)',
               '    while (1) {',
               '        zaehler++;            // nach 255 kommt wieder 0',
               '        PORTA = zaehler;      // die LEDs zeigen den Wert binär',
               '    }',
               '}'] },
      { ul: [
        'Ja/Nein-Werte (z.B. „LED an“) speicherst du als `uint8_t` mit 0 und 1.',
        'Weist du einer Ganzzahl eine Kommazahl zu, werden die Nachkommastellen abgeschnitten – nicht gerundet. Wie man Kommazahlen trotzdem speichert, lernst du in Level 5.'
      ] },
      { p: 'Warum nicht einfach `int`? Die klassischen C-Typen haben keine feste Grösse. Bei avr-gcc auf dem ATmega2560 ist ein `int` nur 16 Bit (2 Byte) gross, auf einem PC 32 Bit. Code, der am PC funktioniert, kann auf dem Mega plötzlich überlaufen. Mit `uint16_t` & Co. weisst du immer genau, was du bekommst.' },
      { tip: '`#include <stdint.h>` bringt die Typen. Nimm immer `uint8_t`, `int16_t` & Co. Einzige Ausnahme: `int main(void)` – so schreibt es der C-Standard vor.' }
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
        explain: 'Der Typ sagt dem Compiler zwei Dinge: wie viele Bits (bzw. Bytes) die Variable hat und wie die Bits zu lesen sind. Dieselben 8 Bits `11111111` sind z.B. 255 als `uint8_t`, aber −1 als `int8_t`.' },
      { type: 'choice',
        q: 'Was bedeuten das „u“ und die „16“ in `uint16_t`?',
        options: ['ohne Vorzeichen, 16 Bit', 'universal, 16 Byte', 'ohne Vorzeichen, 16 Byte', 'user-defined, Version 16'],
        answer: 0,
        why: [null, 'Das „u“ steht nicht für universal – und die Zahl zählt Bits, nicht Bytes.', 'Fast: Die Zahl im Namen zählt Bits, nicht Bytes.', 'Nein, mit Versionen hat das nichts zu tun.'],
        explain: '`uint16_t` = „unsigned integer“, englisch für Ganzzahl ohne Vorzeichen, 16 Bit, `_t` für type. Also 0 … 65\'535 in 2 Byte.' },
      { type: 'choice',
        q: 'Welcher dieser Typen kann negative Zahlen speichern?',
        options: ['`int16_t`', '`uint16_t`', '`uint8_t`', '`uint32_t`'],
        answer: 0,
        why: [null, 'Das `u` am Anfang heisst: ohne Vorzeichen – nur 0 und positiv.', 'Das `u` am Anfang heisst: ohne Vorzeichen.', 'Das `u` am Anfang heisst: ohne Vorzeichen.'],
        explain: 'Nur Typen ohne `u` haben ein Vorzeichen. `int16_t` reicht von −32\'768 bis 32\'767.' },
      { type: 'choice',
        q: 'Welche Deklaration ist in C richtig geschrieben?',
        options: ['`uint8_t zaehler = 0;`', '`zaehler uint8_t = 0;`', '`uint8_t = zaehler 0;`', '`uint8 zaehler = 0;`'],
        answer: 0,
        why: [null, 'Zuerst kommt der Typ, dann der Name.', 'Erst Typ, dann Name, dann `=` und der Startwert.', 'Der Typ heisst `uint8_t` – mit `_t` am Ende.'],
        explain: 'Schema: Typ Name = Startwert; – also `uint8_t zaehler = 0;`.' },
      { type: 'yesno',
        q: 'Hat der Typ `uint8_t` ein Vorzeichen?',
        answer: false,
        explain: 'Nein. Das `u` steht für „unsigned“ (ohne Vorzeichen): `uint8_t` speichert nur 0 … 255. Mit Vorzeichen wäre es `int8_t` (−128 … 127).' },
      { type: 'choice',
        q: 'Welcher Typ passt am besten für einen Ja/Nein-Wert (0 oder 1), z.B. ob eine LED an sein soll?',
        options: ['`uint8_t`', '`int8_t`', '`uint32_t`', '`int64_t`'],
        answer: 0,
        why: [null, 'Geht auch, aber ein Vorzeichen braucht ein Ja/Nein-Wert nicht.', 'Funktioniert, ist aber 4 Byte gross – für 0 oder 1 viel zu viel.', 'Viel zu gross: 8 Byte für 0 oder 1.'],
        explain: 'Der kleinste Typ ohne Vorzeichen ist `uint8_t` (1 Byte). Für 0 und 1 reicht das locker.' },
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
        q: 'Welche Zeile macht die Typen `uint8_t`, `int16_t` & Co. bekannt?',
        options: ['`#include <stdint.h>`', '`#include <math.h>`', '`#include <types8.h>`', '`#include <int.h>`'],
        answer: 0,
        why: [null, '`<math.h>` hat mathematische Funktionen, keine Typen.', 'Diese Datei gibt es nicht.', 'Diese Datei gibt es nicht.'],
        explain: '`<stdint.h>` („standard integer“) definiert die Ganzzahltypen mit fester Grösse: `uint8_t` bis `int64_t`.' }
    ]
  },
  /* ------------------------------------------------------------ 2 */
  {
    id: 'bitsbytes',
    title: 'Bits & Bytes',
    desc: 'Bitzahl aus dem Typnamen ablesen und in Bytes umrechnen.',
    intro: [
      { p: 'Ein Bit ist 0 oder 1. 8 Bits sind 1 Byte. Die Zahl im Typnamen sind Bits – die Bytes rechnest du so aus: Bytes = Bits ÷ 8. Umgekehrt: Bits = Bytes × 8.' },
      { table: { head: ['Bits im Namen', 'Bytes', 'Typen'], rows: [
        ['8', '1', '`uint8_t`, `int8_t`'],
        ['16', '2', '`uint16_t`, `int16_t`'],
        ['32', '4', '`uint32_t`, `int32_t`'],
        ['64', '8', '`uint64_t`, `int64_t`']
      ] } },
      { ul: [
        'Das `u` ändert die Grösse nicht: `uint16_t` und `int16_t` haben beide 16 Bit = 2 Byte. Nur die Deutung der Bits ist anders.',
        'Eine Hex-Ziffer steht für 4 Bit. Ein `uint8_t` hat darum 2 Hex-Ziffern (`0xFF`), ein `uint16_t` 4 (`0xFFFF`).',
        'Ein `uint16_t` besteht aus 2 Byte: dem High-Byte (Bits 15 … 8) und dem Low-Byte (Bits 7 … 0). Auf 8 LEDs passt nur eines davon – darum zeigen PORTA das High-Byte und PORTB das Low-Byte.',
        'Auf dem ATmega2560 hat `int` 16 Bit = 2 Byte, auf einem PC meist 32 Bit. Bei `int16_t` steht die Grösse im Namen.'
      ] },
      { code: ['uint16_t wert = 0x03E8;    // 16 Bit = 2 Byte = 4 Hex-Ziffern (1000)',
               'DDRA = 0xFF; DDRB = 0xFF;',
               'PORTA = wert >> 8;         // High-Byte 0x03',
               'PORTB = wert & 0xFF;       // Low-Byte  0xE8'] },
      { tip: 'Diese Grössen gelten auf jeder Plattform – genau das ist der Vorteil der Typen mit fester Grösse.' }
    ],
    fact: {
      title: 'Warum hat ein Byte 8 Bit?',
      text: 'Früher war das nicht klar: Manche Computer arbeiteten mit 6-Bit-Zeichen. Erst der IBM System/360 von 1964 machte das 8-Bit-Byte zum Standard. Seitdem sind Typen fast immer 8, 16, 32 oder 64 Bit breit.'
    },
    tasks: [
      { type: 'number',
        q: 'Wie viele Bits hat ein Byte?',
        answer: '8', unit: 'Bits',
        explain: '1 Byte = 8 Bits – genau so viele hat ein `uint8_t`.' },
      { type: 'number',
        q: 'Wie viele Bytes hat ein `int32_t`?',
        answer: '4', unit: 'Bytes',
        hint: 'Die Zahl im Namen sind Bits. Teile durch 8.',
        explain: '32 Bit ÷ 8 = 4 Byte – auf jeder Plattform, auch auf dem ATmega2560.' },
      { type: 'number',
        q: 'Wie viele Bytes hat ein `uint64_t`?',
        answer: '8', unit: 'Bytes',
        explain: '64 Bit ÷ 8 = 8 Byte.' },
      { type: 'choice',
        q: 'Welcher Typ hat 16 Bit und kein Vorzeichen?',
        options: ['`uint16_t`', '`int16_t`', '`uint8_t`', '`uint32_t`'],
        answer: 0,
        why: [null, 'Richtige Grösse, aber ohne `u` hat der Typ ein Vorzeichen.', 'Das sind nur 8 Bit.', 'Das sind 32 Bit.'],
        explain: '`u` = ohne Vorzeichen, `16` = 16 Bit. Also `uint16_t`: 2 Byte, 0 … 65\'535.' },
      { type: 'number',
        q: 'Ein Typ hat 4 Byte. Wie viele Bits hat er?',
        answer: '32', unit: 'Bits',
        hint: 'Bits = Bytes × 8.',
        explain: '4 × 8 = 32 Bit – das sind `uint32_t` und `int32_t`.' },
      { type: 'yesno',
        q: 'Hat ein `int16_t` gleich viele Bits wie ein `uint16_t`?',
        answer: true,
        explain: 'Ja, beide haben 16 Bit = 2 Byte. Der Unterschied ist nur die Deutung: `int16_t` −32\'768 … 32\'767, `uint16_t` 0 … 65\'535.' },
      { type: 'choice',
        q: 'Ein `uint16_t wert` wird in zwei Bytes zerlegt: `uint8_t hi = wert >> 8;`. Welche Bits von `wert` landen in `hi`?',
        options: ['Bits 15 … 8 (das High-Byte)', 'Bits 7 … 0 (das Low-Byte)', 'Nur Bit 8', 'Alle 16 Bits'],
        answer: 0,
        why: [null, 'Das Low-Byte bekommst du mit `wert & 0xFF`.', '`>> 8` schiebt alle Bits um 8 Stellen nach rechts, nicht nur eines.', 'Ein `uint8_t` hat nur 8 Bit – mehr passt nicht hinein.'],
        explain: '`>> 8` schiebt die oberen 8 Bits nach unten. `hi` enthält dann das High-Byte (Bits 15 … 8), `wert & 0xFF` liefert das Low-Byte (Bits 7 … 0). 16 Bit = 2 Byte.' },
      { type: 'number',
        q: 'Wie viele Hex-Ziffern brauchst du, um jeden Wert eines `uint16_t` zu schreiben?',
        answer: '4', unit: 'Ziffern',
        hint: 'Eine Hex-Ziffer steht für 4 Bit.',
        explain: '16 Bit ÷ 4 = 4 Hex-Ziffern. Der grösste Wert ist `0xFFFF` = 65\'535.' },
      { type: 'number',
        q: 'Wie viele `uint8_t`-Variablen brauchst du, um alle Bits eines `uint32_t` zu speichern?',
        answer: '4', unit: 'Variablen',
        explain: '32 Bit ÷ 8 Bit pro `uint8_t` = 4. Für einen `uint16_t` reichen zwei (High- und Low-Byte).' }
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
        'Typische Werte: Ein 10-Bit-Sensorwert reicht von 0 bis 1023, ein 16-Bit-Zähler ohne Vorzeichen bis 65\'535.'
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
        explain: 'Jedes Bit verdoppelt die Möglichkeiten: 1 Bit → 2, 2 Bits → 4, 8 Bits → 2⁸ = 256 Werte – so viele verschiedene Werte hat ein `uint8_t`.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `uint8_t`?',
        answer: '255',
        hint: 'Formel: 2⁸ − 1',
        explain: '2⁸ − 1 = 255 = `0xFF`: alle 8 Bits sind 1.' },
      { type: 'number',
        q: 'Was ist der kleinste Wert eines `int8_t`?',
        answer: '-128',
        hint: 'Formel: −2⁷',
        explain: '`int8_t`: −2⁷ = −128 bis 2⁷ − 1 = 127. Es gibt einen negativen Wert mehr als positive, weil die 0 bei den „positiven“ mitgezählt wird.' },
      { type: 'number',
        q: 'Ein Zähler vom Typ `uint16_t` wird immer wieder um 1 erhöht. Bis zu welchem Wert kommt er, bevor er wieder bei 0 beginnt?',
        answer: '65535',
        explain: '2¹⁶ − 1 = 65\'535. Danach läuft der `uint16_t` über und beginnt wieder bei 0.' },
      { type: 'yesno',
        q: 'Ein 10-Bit-Sensor liefert Messwerte von 0 bis 1023. Passt das in einen `uint8_t`?',
        answer: false,
        explain: '`uint8_t` geht nur bis 255. 1023 braucht mindestens 10 Bit – der nächste passende Typ ist `uint16_t`.' },
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
    desc: 'Die Bits einer Variable umschalten, auf LEDs sehen, Hex und Zweierkomplement.',
    intro: [
      { p: 'Jedes Bit hat eine Wertigkeit. Ganz rechts steht 1, nach links verdoppelt sich der Wert. Der Zahlenwert ist die Summe aller Bits, die auf 1 stehen. Die LEDs zeigen die Bits einer Variable: Bit 7 links, Bit 0 rechts, 1 = LED leuchtet.' },
      { table: { head: ['Bit / LED', '7', '6', '5', '4', '3', '2', '1', '0'], rows: [
        ['Wert', '128', '64', '32', '16', '8', '4', '2', '1'],
        ['`uint8_t x = 6;`', '0', '0', '0', '0', '0', '1', '1', '0']
      ] } },
      { p: 'Hex-Schreibweise: Eine Hex-Ziffer (0 … 9, A … F) steht für genau 4 Bits. `0xFF` = `1111 1111` (alle Bits 1), `0x0F` = `0000 1111` (die rechten vier). Darum schreibt man Bitmuster meistens in Hex.' },
      { p: 'Einzelne Bits prüfst du mit einer Maske: `1 << 3` ist eine 1 an Bit 3 (= 8). `x & (1 << 3)` ist nur dann nicht 0, wenn Bit 3 von `x` gesetzt ist.' },
      { p: 'Ein 16-Bit-Wert passt nicht auf 8 LEDs. Verteile ihn: das obere Byte auf PORTA, das untere auf PORTB.' },
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
        q: 'Warm-up: Stelle die Bits von `uint8_t x = 13;` ein. Klicke dazu die Bits an – die LEDs zeigen sie.',
        explain: '13 = 8 + 4 + 1 → `00001101`: Bit 3, 2 und 0 sind 1.' },
      { type: 'bits', bits: 8, mode: 'ohneVZ', target: 200, leds: true,
        q: 'Stelle die Bits von `uint8_t x = 200;` ein.',
        explain: '200 = 128 + 64 + 8 → `11001000` = `0xC8`: Bit 7, 6 und 3 sind 1.' },
      { type: 'choice',
        q: 'Welche Bits von `uint8_t x = 0xA5;` sind 1?',
        options: ['Bit 7, 5, 2 und 0', 'Bit 7, 6, 5 und 0', 'Bit 3, 1 und 0', 'Alle 8 Bits'],
        answer: 0,
        why: [null, 'Prüfe die erste Hex-Ziffer: A = `1010`, nicht `1110`.', 'Das wäre `0x0B`.', 'Das wäre `0xFF`.'],
        explain: 'A = `1010` (Bits 7 und 5), 5 = `0101` (Bits 2 und 0). Zusammen `10100101` = 165.' },
      { type: 'number',
        q: 'Welchen Dezimalwert hat `uint8_t x = 0x3C;`?',
        answer: '60',
        hint: '3 = 0011 (obere vier Bits), C = 1100 (untere vier Bits).',
        explain: '`0x3C` = `00111100` = 32 + 16 + 8 + 4 = 60. Gesetzt sind Bit 5, 4, 3 und 2.' },
      { type: 'choice',
        q: 'Was prüft diese Bedingung?',
        code: ['uint8_t flags = 0x2C;', 'if (flags & (1 << 3)) {', '    PORTA = 0xFF;', '}'],
        options: ['Ob Bit 3 von `flags` gesetzt ist', 'Ob `flags` gleich 3 ist', 'Ob die Bits 0, 1 und 2 gesetzt sind', 'Ob `flags` grösser als 3 ist'],
        answer: 0,
        why: [null, 'Die Maske vergleicht nicht, sie prüft ein einzelnes Bit.', '`1 << 3` ist nur Bit 3 (= 8), nicht drei Bits.', '`&` ist ein Bit-UND, kein Vergleich.'],
        explain: '`1 << 3` = `00001000`. Das UND lässt nur Bit 3 übrig: `0x2C` = `00101100` hat Bit 3 gesetzt, das Ergebnis ist 8 → wahr.' },
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
        q: 'Ein Sensor misst 1000. Stelle `uint16_t messwert = 1000;` ein – PORTA zeigt das High-Byte, PORTB das Low-Byte.',
        explain: '1000 = 512 + 256 + 128 + 64 + 32 + 8 → `00000011 11101000`. `PORTA = wert >> 8` zeigt 3, `PORTB = wert & 0xFF` zeigt 232.' }
    ]
  },
  /* ------------------------------------------------------------ 5 */
  {
    id: 'festkomma',
    title: 'Kommazahlen als Festkomma',
    desc: 'Werte skalieren, mit Ganzzahlen rechnen, auf LEDs ausgeben.',
    intro: [
      { p: 'Der ATmega2560 hat keine Gleitkomma-Einheit (FPU). Gleitkomma-Rechnungen müsste der Compiler in Software nachbauen – das ist langsam und aufwendig. Darum speicherst du Kommazahlen als Festkomma: Wert × Skalierungsfaktor, als Ganzzahl.' },
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
      text: '1991 verfehlte eine Patriot-Abwehrrakete in Dhahran ihr Ziel; 28 Soldaten starben. Das System zählte die Zeit in Zehntelsekunden und multiplizierte mit 0.1 – gespeichert in einem 24-Bit-Festkommawert. 0.1 ist binär aber ein unendlicher Bruch und wurde abgeschnitten. Nach 100 Stunden war die Uhr um etwa 0.34 Sekunden daneben. Mit einem dezimalen Faktor (Zeit als ganze Zehntelsekunden) wäre der Wert exakt geblieben.'
    },
    tasks: [
      { type: 'choice',
        q: 'Warum speichert man Kommazahlen auf dem ATmega2560 als Festkomma (Ganzzahl × Faktor)?',
        options: ['Er hat keine Gleitkomma-Einheit (FPU): Gleitkomma wäre langsam und aufwendig',
                  'Weil C auf dem AVR keine Kommazahlen kennt',
                  'Weil Ganzzahlen weniger Bits haben als Kommazahlen',
                  'Weil die LEDs sonst flackern'],
        answer: 0,
        why: [null, 'Doch, der Compiler könnte sie in Software nachbauen – nur eben langsam.', 'Nein, das hängt vom Typ ab, nicht von „Komma“.', 'Mit den LEDs hat das nichts zu tun.'],
        explain: 'Ohne FPU wird jede Gleitkomma-Operation in viele Ganzzahl-Befehle zerlegt. Festkomma rechnet mit normalen Ganzzahlen: schnell und exakt.' },
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
      { p: 'Hier wählst du für eine Variable den kleinsten Typ, der trotzdem sicher passt. Ein 8-Bit-Controller rechnet mit `uint8_t` in einem Schritt, mit `uint32_t` braucht er für jede Rechnung mehrere Befehle. Gehe in diesen Schritten vor:' },
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
        q: 'Ein Rundenzähler für ein Spiel – höchstens 200, nie negativ.',
        code: '____ runden = 0;',
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
        q: 'Ein Messwert von einem 10-Bit-Sensor: 0 bis 1023.',
        code: '____ messwert = 1023;   // 10-Bit-Sensor',
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
        'Ziel zu schmal: Ein 16-Bit-Wert wird in einen `uint8_t` kopiert. Übrig bleibt nur das Low-Byte, also Wert mod 256.',
        'Unterlauf: Ein `uintN_t` kann nicht negativ werden – 0 − 1 ergibt den Maximalwert.',
        'Ohne Vorzeichen für negative Werte: Ein negativer Wert wird zu einer grossen positiven Zahl.',
        '`int` ist nur 16 Bit: Zwischenergebnisse wie `a * b` oder `60 * 1000` werden in 16 Bit gerechnet, nicht im Typ der Zielvariable.',
        'Festkomma: Faktor vergessen, Zwischenergebnis zu klein, oder zuerst geteilt statt zuerst multipliziert.'
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
        q: 'Die Kopie `kopie` soll den Punktestand 300 enthalten – die LEDs zeigen aber 0 (High-Byte) und 44 (Low-Byte). Welche Zeile ist schuld?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int main(void) {', '    DDRA = 0xFF; DDRB = 0xFF;', '    uint16_t punkte = 300;', '    uint8_t kopie = punkte;', '    PORTA = kopie >> 8;', '    PORTB = kopie & 0xFF;', '    while (1) { }', '}'],
        bugLines: [6],
        lineHint: 'Der Wert 300 ist in `punkte` korrekt gespeichert. Wie viele Bits hat die Kopie?',
        fixes: ['`uint16_t kopie = punkte;`', '`uint8_t kopie = (uint16_t)punkte;`', '`int8_t kopie = punkte;`', '`uint8_t kopie = punkte + 0;`'],
        fix: 0,
        why: [null, 'Der Cast ändert nichts: Das Ziel `kopie` bleibt 8 Bit breit.', 'Auch mit Vorzeichen hat `kopie` nur 8 Bit.', 'Gerechnet wird zwar in `int`, gespeichert aber trotzdem in 8 Bit.'],
        explain: 'Ein `uint8_t` hat nur 8 Bit. Gespeichert wird 300 mod 256 = 44, das High-Byte geht verloren. Mit `uint16_t` zeigen die LEDs 1 und 44 – zusammen 1 × 256 + 44 = 300.' },
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
        q: 'Der Sensor liefert seinen Maximalwert 1023. PORTA (High-Byte) bleibt aber dunkel und PORTB zeigt nur 255. Wo liegt der Fehler?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'uint16_t sensor_lesen(void);   // liefert 0 … 1023', '', 'int main(void) {', '    DDRA = 0xFF; DDRB = 0xFF;', '    while (1) {', '        uint8_t wert = sensor_lesen();', '        PORTA = wert >> 8;', '        PORTB = wert & 0xFF;', '    }', '}'],
        bugLines: [8],
        lineHint: 'Der Sensorwert braucht 10 Bit. Wie viele Bits hat die Variable, die ihn aufnimmt?',
        fixes: ['`uint16_t wert = sensor_lesen();`', '`int8_t wert = sensor_lesen();`', '`PORTA = wert >> 2;`', '`uint8_t wert = sensor_lesen() >> 8;`'],
        fix: 0,
        why: [null, 'Noch kleiner: nur bis 127.', 'Dann fehlen die oberen Bits trotzdem – sie sind schon beim Speichern verloren.', 'Dann bleiben nur die oberen 2 Bits übrig (0 … 3), der Rest geht verloren.'],
        explain: 'Der Sensor liefert 0 … 1023 (10 Bit). Ein `uint8_t` behält nur das Low-Byte: 1023 mod 256 = 255, das High-Byte ist 0. Mit `uint16_t` zeigt PORTA 3 und PORTB 255.' },
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
        q: 'Ein Sensorwert (0 … 1023) soll in mV (0 … 5000) umgerechnet werden. Das Ergebnis ist aber fast immer 0 – nur bei 1023 genau 5000. Welche Zeile?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'uint16_t sensor_lesen(void);   // liefert 0 … 1023', '', 'int main(void) {', '    DDRA = 0xFF; DDRB = 0xFF;', '    while (1) {', '        uint16_t roh = sensor_lesen();', '        uint16_t mv = roh / 1023 * 5000;', '        PORTA = mv >> 8;', '        PORTB = mv & 0xFF;', '    }', '}'],
        bugLines: [9],
        lineHint: 'Was ergibt `roh / 1023` als Ganzzahldivision, wenn `roh` kleiner als 1023 ist?',
        fixes: ['`uint16_t mv = (uint32_t)roh * 5000 / 1023;`', '`uint16_t mv = roh * 5000 / 1023;`', '`uint32_t mv = roh / 1023 * 5000;`', '`uint16_t mv = roh / (1023 * 5000);`'],
        fix: 0,
        why: [null, 'Reihenfolge richtig, aber `roh * 5000` wird auf dem ATmega in 16 Bit gerechnet und läuft über.', 'Das Ziel ist nicht das Problem – geteilt wird immer noch zuerst.', 'Dann ist das Ergebnis immer 0.'],
        explain: 'Ganzzahldivision zuerst: `roh / 1023` ist 0 für alle Werte unter 1023. Zuerst multiplizieren, dann teilen – und weil 1023 × 5000 = 5\'115\'000 nicht in 16 Bit passt, in 32 Bit rechnen.' }
    ]
  },
  /* ------------------------------------------------------------ 8 */
  {
    id: 'umwandlung',
    title: 'Typumwandlung',
    desc: 'Abschneiden, signed ↔ unsigned, Casts, Integer-Promotion und Bytes zusammensetzen.',
    intro: [
      { p: 'C wandelt Werte oft automatisch in einen anderen Typ um – beim Zuweisen, beim Rechnen und beim Vergleichen. Wer die Regeln kennt, findet viele Fehler sofort.' },
      { table: { head: ['Situation', 'Was passiert', 'Beispiel'], rows: [
        ['in kleineren Typ ohne Vorzeichen zuweisen', 'nur die unteren Bits bleiben (Wert mod 2ⁿ)', '`uint8_t y = 300;` → 44'],
        ['signed → unsigned (gleiche Bits)', 'die Bits bleiben, die Deutung ändert sich', '`int8_t` −1 → `uint8_t` 255'],
        ['unsigned → signed, zu gross', 'avr-gcc behält die Bits (laut C implementierungsabhängig)', '`uint8_t` 200 → `int8_t` −56'],
        ['Cast `(typ)wert`', 'du wandelst selbst um, bevor gerechnet wird', '`(uint32_t)a * b`']
      ] } },
      { p: 'Integer-Promotion: Bevor C rechnet, werden kleine Typen wie `uint8_t` und `int8_t` zu `int` erweitert. Auf dem ATmega2560 hat `int` nur 16 Bit.' },
      { code: ['uint8_t a = 200, b = 100;',
               'uint16_t summe = a + b;      // 300: gerechnet wird in int (16 Bit)',
               'uint8_t  klein = a + b;      // 44: erst beim Speichern abgeschnitten',
               'uint8_t  x = 200, y = 200;',
               'uint32_t p = (uint32_t)x * y; // 40000: Cast VOR der Multiplikation'] },
      { ul: [
        'Ein Ergebnis über 32\'767 passt nicht in `int` (16 Bit). Darum: einen Operanden vorher casten, z.B. `(uint32_t)x * y` oder `(uint16_t)x * y`.',
        'Vergleich: Sind beide Seiten nach der Promotion `int`, wird normal mit Vorzeichen verglichen. Ist eine Seite `uint16_t` (gleich breit wie `int`), wird die andere zu unsigned – aus −5 wird 65\'531.',
        'High- und Low-Byte: `hi = wert >> 8; lo = wert & 0xFF;` – und zurück: `wert = (uint16_t)hi << 8 | lo;`.'
      ] },
      { tip: 'Frag dich bei jeder Rechnung: Welchen Typ haben die Operanden nach der Promotion – und passt das Ergebnis hinein?' }
    ],
    fact: {
      title: 'Gangnam Style knackt den Zähler',
      text: 'YouTube zählte Aufrufe in einer 32-Bit-Ganzzahl mit Vorzeichen. Ende 2014 näherte sich das Video „Gangnam Style“ der Grenze von 2\'147\'483\'647 Aufrufen – YouTube stellte den Zähler darum auf 64 Bit um.'
    },
    tasks: [
      { type: 'number',
        q: 'Welchen Wert hat `y`?',
        code: ['uint16_t x = 300;   // 0x012C', 'uint8_t  y = x;'],
        answer: '44',
        hint: 'Nur das Low-Byte passt in den `uint8_t`.',
        explain: '300 = `0x012C`. Ein `uint8_t` behält nur das Low-Byte `0x2C` = 44 (= 300 − 256).' },
      { type: 'number',
        q: 'Welchen Wert hat `u`?',
        code: ['int8_t  s = -1;', 'uint8_t u = s;'],
        answer: '255',
        explain: '−1 ist im Zweierkomplement `11111111`. Als `uint8_t` gelesen sind das 255 (= 256 − 1).' },
      { type: 'bits', bits: 8, mode: 'ohneVZ', target: 156, leds: true,
        q: 'Nach `int8_t s = -100; uint8_t u = s; PORTA = u;` – stelle die Bits von `u` ein.',
        explain: '−100 als `int8_t` ist `10011100`. Dieselben Bits als `uint8_t` sind 128 + 16 + 8 + 4 = 156 (= 256 − 100).' },
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
      { type: 'yesno',
        q: 'Leuchten die LEDs?',
        code: ['uint8_t a = 200, b = 100;', 'DDRA = 0xFF;', 'if (a + b > 255) {', '    PORTA = 0xFF;', '}'],
        answer: true,
        explain: 'Ja. `a + b` wird in `int` gerechnet und ist 300 – nicht 44. Abgeschnitten wird erst, wenn du das Ergebnis in einem `uint8_t` speicherst.' },
      { type: 'choice',
        q: 'Was zeigen die LEDs? (avr-gcc, `int` = 16 Bit)',
        code: ['int16_t  temp = -5;', 'uint16_t grenze = 10;', 'DDRA = 0xFF;', 'if (temp < grenze) {', '    PORTA = 0xFF;', '} else {', '    PORTA = 0x00;', '}'],
        options: ['Alle aus – `temp` wird zu 65\'531 umgewandelt', 'Alle an – −5 ist kleiner als 10', 'Der Compiler verweigert den Vergleich', 'Nur LED 0 leuchtet'],
        answer: 0,
        why: [null, 'Mathematisch ja – aber C vergleicht hier ohne Vorzeichen.', 'Der Compiler warnt höchstens – übersetzt wird es.', 'Im Code wird nur `0xFF` oder `0x00` ausgegeben.'],
        explain: '`uint16_t` ist so breit wie `int`, darum wird `temp` zu unsigned: −5 → 65\'531. 65\'531 < 10 ist falsch, die LEDs bleiben aus. Mit `int8_t` und `uint8_t` wären beide `int` und −5 < 10 wäre wahr.' },
      { type: 'number',
        q: 'Welchen Wert hat `wert`?',
        code: ['uint8_t hi = 0x03;', 'uint8_t lo = 0xE8;', 'uint16_t wert = (uint16_t)hi << 8 | lo;'],
        answer: '1000',
        hint: 'hi × 256 + lo.',
        explain: '`0x03` << 8 = `0x0300` = 768, ODER `0xE8` (232) ergibt `0x03E8` = 768 + 232 = 1000.' },
      { type: 'bits', bits: 16, mode: 'ohneVZ', target: 65534, leds: true,
        q: 'Nach `int16_t x = -2; uint16_t u = x;` – stelle die 16 Bits von `u` ein (Port A = High-Byte, Port B = Low-Byte).',
        explain: '−2 als `int16_t` ist `11111111 11111110`. Als `uint16_t` gelesen: 65\'536 − 2 = 65\'534.' },
      { type: 'findBug',
        q: '`flaeche` soll 40\'000 sein. Im Debugger steht aber 4\'294\'941\'760. Welche Zeile ist schuld?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int main(void) {', '    uint8_t breite_cm = 200;', '    uint8_t hoehe_cm = 200;', '    uint32_t flaeche = breite_cm * hoehe_cm;   // cm²', '    while (1) { }', '}'],
        bugLines: [6],
        lineHint: 'Das Ziel ist ein `uint32_t` – aber in welchem Typ wird `uint8_t * uint8_t` gerechnet?',
        fixes: ['`uint32_t flaeche = (uint32_t)breite_cm * hoehe_cm;`', '`uint32_t flaeche = (uint32_t)(breite_cm * hoehe_cm);`', '`int32_t flaeche = breite_cm * hoehe_cm;`', '`int8_t breite_cm = 200;`'],
        fix: 0,
        why: [null, 'Die Klammer rechnet zuerst in `int` – der Überlauf passiert vor dem Cast.', 'Auch hier wird zuerst in 16-Bit-`int` gerechnet.', '200 passt nicht einmal in `int8_t`.'],
        explain: 'Beide `uint8_t` werden zu `int` (16 Bit, max. 32\'767). 200 × 200 = 40\'000 läuft über (undefiniert, avr-gcc liefert −25\'536). Als `uint32_t` gespeichert wird daraus 4\'294\'941\'760. Mit dem Cast vor der Multiplikation rechnet C in 32 Bit.' },
      { type: 'findBug',
        q: 'Drei Bytes sollen zu 100\'000 (`0x0186A0`) zusammengesetzt werden. Das Ergebnis stimmt aber nicht. Welche Zeile?',
        code: ['#include <avr/io.h>', '#include <stdint.h>', '', 'int main(void) {', '    uint8_t b2 = 0x01;   // oberstes Byte', '    uint8_t b1 = 0x86;', '    uint8_t b0 = 0xA0;   // unterstes Byte', '    uint32_t wert = (b2 << 16) | (b1 << 8) | b0;', '    while (1) { }', '}'],
        bugLines: [7],
        lineHint: 'In welchem Typ wird `b2 << 16` auf dem ATmega gerechnet – und wie viele Bits hat er?',
        fixes: ['`uint32_t wert = ((uint32_t)b2 << 16) | ((uint32_t)b1 << 8) | b0;`', '`uint32_t wert = (uint32_t)((b2 << 16) | (b1 << 8) | b0);`', '`uint64_t wert = (b2 << 16) | (b1 << 8) | b0;`', '`uint32_t wert = (b2 << 8) | (b1 << 16) | b0;`'],
        fix: 0,
        why: [null, 'Der Cast kommt zu spät – geschoben wird vorher in 16-Bit-`int`.', 'Ein grösseres Ziel ändert nichts: Geschoben wird trotzdem in `int`.', 'Jetzt sind die Bytes vertauscht – und das Problem bleibt.'],
        explain: '`b2` und `b1` werden zu `int` (16 Bit). `b2 << 16` schiebt um die ganze Breite (undefiniert), und `0x86 << 8` = 34\'304 passt nicht in `int` (max. 32\'767). Erst auf `uint32_t` casten, dann schieben: 65\'536 + 34\'304 + 160 = 100\'000.' }
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
        'ATmega2560: 8-Bit-Controller ohne FPU, `int` = 16 Bit.',
        'High- und Low-Byte: `hi = wert >> 8; lo = wert & 0xFF;` – ein `uint8_t` behält nur 8 Bit (Wert mod 256).',
        'Zweierkomplement: Das oberste Bit zählt negativ (bei 8 Bit −128).',
        'Festkomma: Wert × Faktor als Ganzzahl. Typ nach dem skalierten Bereich wählen. Multiplikation in grösserem Typ, zuerst multiplizieren, dann teilen.',
        'Zwischenergebnisse: werden mindestens in `int` (16 Bit) gerechnet – nicht im Typ der Zielvariable.',
        'Typumwandlung: kleinerer Typ behält nur die unteren Bits, signed ↔ unsigned behält die Bits. Kleine Typen werden zum Rechnen zu `int`. Bytes zusammensetzen: `(uint16_t)hi << 8 | lo`.'
      ] },
      { tip: 'Lies jede Aufgabe genau: Welcher Typ, wie viele Bits, mit oder ohne Vorzeichen, welcher Faktor? Viel Erfolg!' }
    ],
    tasks: [
      { type: 'yesno',
        q: 'Passt der Wert 300 in einen `uint8_t`?',
        answer: false,
        explain: '`uint8_t` geht nur bis 255. Gespeichert würde 300 − 256 = 44.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `int16_t`?',
        answer: '32767',
        explain: '2¹⁵ − 1 = 32\'767 – so weit geht auch ein `int` auf dem ATmega2560.' },
      { type: 'choice',
        q: 'Welche Bits von `uint8_t x = 0x81;` sind 1?',
        options: ['Bit 7 und Bit 0', 'Bit 8 und Bit 1', 'Bit 0 bis Bit 7', 'Nur Bit 1'],
        answer: 0,
        why: [null, 'Die Bits eines `uint8_t` sind von 0 bis 7 nummeriert.', 'Das wäre `0xFF`.', 'Das wäre `0x02`.'],
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
        q: 'Welche Zahl zeigen die LEDs an Port A?',
        code: ['uint16_t x = 0x1234;', 'uint8_t lo = x;', 'DDRA = 0xFF;', 'PORTA = lo;'],
        answer: '52',
        explain: 'Ein `uint8_t` behält nur das Low-Byte: `0x34` = 3 × 16 + 4 = 52.' },
      { type: 'choice',
        q: 'Welchen Wert hat `u`?',
        code: ['int8_t  s = -56;', 'uint8_t u = s;'],
        options: ['200', '56', '-56', '0'],
        answer: 0,
        why: [null, 'Das Vorzeichen fällt nicht einfach weg – die Bits bleiben gleich.', 'Ein `uint8_t` kann nicht negativ sein.', 'Nein.'],
        explain: 'Die Bits `11001000` bleiben gleich, nur die Deutung ändert sich: 256 − 56 = 200.' }
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
  { min: 0.55, name: 'Festkomma-Profi' },
  { min: 0.8,  name: 'Typ-Meister' },
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
    5: '5 in Folge! Langsam wird es unheimlich.',
    8: '8 in Folge! Alle 8 LEDs leuchten für dich.'
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
  'Ich habe keine FPU. Kommazahlen rechne ich lieber in Millivolt und Zehntelgrad.',
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
    title: 'Typumwandlung 16 → 8 Bit',
    text: '`gross` ist ein `uint16_t`, `klein` ein `uint8_t`. Bei jeder Zuweisung `klein = gross;` bleiben nur die unteren 8 Bit übrig. PORTA zeigt das High-Byte von `gross`, PORTB zeigt `klein` – vergleiche mit der Variablen-Tabelle.',
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
      '        PORTA = gross >> 8;',
      '        PORTB = klein;',
      '        gross = gross + 50;',
      '        _delay_ms(500);',
      '    }',
      '}'
    ].join('\n')
  },
  {
    title: 'Festkomma: Sensorwert → Millivolt',
    text: 'Ein 10-Bit-Sensorwert (0 … 1023) wird ohne Kommazahlen in Millivolt umgerechnet. Wichtig: `1023 * 5000` passt nicht in 16 Bit – darum der Cast auf `uint32_t`. PORTA zeigt die ganzen Volt, PORTB die Zehntel.',
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
      '        uint16_t mv = (uint32_t)roh * 5000 / 1023;   // Festkomma: Millivolt',
      '        uint8_t volt = mv / 1000;                    // ganze Volt',
      '        uint8_t zehntel = (mv % 1000) / 100;         // erste Nachkommastelle',
      '        PORTA = volt;',
      '        PORTB = zehntel;',
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
      '    PORTA = leistung_mw >> 8;',
      '    PORTB = leistung_mw & 0xFF;',
      '',
      '    while (1)',
      '    {',
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
    text: 'Speichere 1000 in einem passenden Typ. Zeig das High-Byte auf PORTA und das Low-Byte auf PORTB.',
    check: { phases: [{ ms: 300, expect: { A: 0x03, B: 0xE8 } }] }
  },
  {
    id: 'sim-fix', title: 'Festkomma: 23.7 °C',
    text: 'Speichere 23.7 °C als Festkomma in Zehntelgrad (`int16_t`). Zeig auf PORTA die ganzen Grad (23) und auf PORTB die Nachkommastelle (7) – nur mit `/` und `%`.',
    check: { phases: [{ ms: 300, expect: { A: 23, B: 7 } }] }
  },
  {
    id: 'sim-pingpong', title: 'Lauflicht hin und zurück',
    text: 'Ein einzelnes gesetztes Bit in einem `uint8_t` wandert auf PORTA von Bit 0 bis Bit 7 und dann wieder zurück zu Bit 0 – immer weiter (mit `_delay_ms`).',
    check: { phases: [{ ms: 12000 }], seq: { port: 'A', contains: [1, 2, 4, 8, 16, 32, 64, 128, 64, 32, 16, 8, 4, 2, 1] } }
  },
  {
    id: 'sim-free-type', title: 'Frei: Der kleinste passende Typ',
    text: 'Für Profis: Zähle in einer Variable von 0 bis 1000 in Zehnerschritten und zeig sie auf PORTA (High-Byte) und PORTB (Low-Byte). Welcher ist der kleinste Typ, der passt? Probier zuerst `uint8_t` und schau, was die Meldungen sagen.'
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
