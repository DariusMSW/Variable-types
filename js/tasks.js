/* Aufgabendaten fuer "C-Variablentypen lernen".
 * Alles hier sind reine Daten. Neue Aufgaben einfach in ein tasks-Array einfuegen.
 *
 * Gelehrt werden nur Typen mit fester Groesse:
 *  - Ganzzahlen aus <stdint.h>: uint8_t, int8_t, uint16_t, int16_t, uint32_t, int32_t, uint64_t, int64_t
 *  - Kommazahlen float32_t / float64_t (per typedef in einer Projekt-Header-Datei "types.h", siehe Level 5)
 *
 * Aufgabentypen (Feld "type"):
 *  choice      { q, code?, options:[..], answer:index, why?:[..pro Option], hint?, explain }
 *  yesno       { q, code?, answer:true|false, hint?, explain }
 *  number      { q, code?, answer:"Zahl als String", unit?, hint?, explain }
 *  bits        { q, bits:8|16, mode:"ohneVZ"|"mitVZ", target:Zahl, explain }
 *  pickType    { q, code (mit ____), min:"..", max:"..", decimals?:Wahrheitswert, digits?:Zahl,
 *                sample?:"21.5", options:[Typnamen], notes?:{Typ:"Text"}, explain }
 *              -> richtig ist jeder passende Typ mit der kleinsten Byte-Anzahl.
 *  findBug     { q, code:[Zeilen], bugLines:[Indizes], lineHint?, fixes:[..], fix:index, why?, explain }
 *  structOrder { q, name, fields:[{type,name}], explain } -> Ziel: kleinstes sizeof
 *
 * Info-Seite vor jedem Level (Feld "intro" im Level): Liste von Bausteinen, der Reihe nach angezeigt:
 *  { p: 'Absatz' }   { ul: ['Punkt', ..] }   { ol: ['Schritt', ..] }
 *  { table: { head: ['Spalte', ..], rows: [['Zelle', ..], ..] } }
 *  { code: 'C-Code mit \n' }   { tip: 'Merksatz' }
 *
 * Inline-Code in Texten mit `Backticks` markieren (wird sicher als <code> dargestellt).
 */

/* kind: 'ganz' = Ganzzahl, 'komma' = Gleitkomma. vz = mit Vorzeichen. digits = sicher garantierte signifikante Stellen. */
var TYPE_INFO = {
  'int8_t':    { bytes: 1, kind: 'ganz', vz: true },
  'uint8_t':   { bytes: 1, kind: 'ganz', vz: false },
  'int16_t':   { bytes: 2, kind: 'ganz', vz: true },
  'uint16_t':  { bytes: 2, kind: 'ganz', vz: false },
  'int32_t':   { bytes: 4, kind: 'ganz', vz: true },
  'uint32_t':  { bytes: 4, kind: 'ganz', vz: false },
  'int64_t':   { bytes: 8, kind: 'ganz', vz: true },
  'uint64_t':  { bytes: 8, kind: 'ganz', vz: false },
  'float32_t': { bytes: 4, kind: 'komma', digits: 6 },
  'float64_t': { bytes: 8, kind: 'komma', digits: 15 }
};

/* Zeilen des Spickzettels. Wertebereich wird fuer Ganzzahltypen automatisch berechnet. star = Fussnote. */
var CHEAT_ROWS = [
  { type: 'uint8_t',  fmt: '"%" PRIu8' },
  { type: 'int8_t',   fmt: '"%" PRId8' },
  { type: 'uint16_t', fmt: '"%" PRIu16' },
  { type: 'int16_t',  fmt: '"%" PRId16' },
  { type: 'uint32_t', fmt: '"%" PRIu32' },
  { type: 'int32_t',  fmt: '"%" PRId32' },
  { type: 'uint64_t', fmt: '"%" PRIu64' },
  { type: 'int64_t',  fmt: '"%" PRId64' },
  { type: 'float32_t', star: true, rangeText: 'ca. ±3.4·10³⁸, ca. 6–7 signifikante Stellen (sicher 6)', fmt: '%f' },
  { type: 'float64_t', star: true, rangeText: 'ca. ±1.8·10³⁰⁸, ca. 15–16 signifikante Stellen (sicher 15)', fmt: '%f' }
];

var LEVELS = [
  /* ------------------------------------------------------------ 1 */
  {
    id: 'grundlagen',
    title: 'Grundlagen',
    desc: 'Was ist ein Typ? Ganzzahl, Kommazahl, Zeichen – und das Namensschema.',
    intro: [
      { p: 'Jede Variable in C hat einen Datentyp. Er legt fest, wie viele Bytes die Variable im Speicher belegt und wie die Bits darin gelesen werden: als Ganzzahl oder als Kommazahl.' },
      { p: 'Hier lernst du nur Typen mit fester Grösse. Ihr Name verrät alles:' },
      { table: { head: ['Teil des Namens', 'Bedeutung', 'Beispiel'], rows: [
        ['`u` am Anfang', 'ohne Vorzeichen (nur 0 und positiv)', '`uint8_t`: 0 … 255'],
        ['ohne `u`', 'mit Vorzeichen (auch negativ)', '`int8_t`: −128 … 127'],
        ['Zahl', 'Anzahl Bits (8, 16, 32 oder 64)', '`uint16_t` = 16 Bit'],
        ['`floatN_t`', 'Kommazahl (Gleitkomma)', '`float32_t`, `float64_t`'],
        ['`_t`', '„type“ – zeigt, dass es ein Typname ist', '']
      ] } },
      { code: '#include <stdint.h>   // uint8_t, int16_t, ...\n#include "types.h"    // float32_t, float64_t (Level 5)\n\nuint8_t   akku = 87;          // Ganzzahl ohne Vorzeichen\nint16_t   hoehe = -120;       // Ganzzahl mit Vorzeichen\nfloat32_t temp = 21.5f;       // Kommazahl (Punkt statt Komma!)\nuint8_t   zeichen = \'A\';      // Zeichen = ASCII-Code 65\nuint8_t   licht_an = 1;       // Ja/Nein: 1 = ja, 0 = nein' },
      { ul: [
        'Ein Zeichen wie `\'A\'` ist für C einfach eine kleine Zahl: der ASCII-Code. Darum speicherst du es in einem `uint8_t`.',
        'Ja/Nein-Werte speicherst du als `uint8_t` mit 0 (nein) und 1 (ja).',
        'Speicherst du eine Kommazahl in einem Ganzzahltyp, werden die Nachkommastellen abgeschnitten – nicht gerundet.'
      ] },
      { p: 'Warum nicht einfach `int`? Die klassischen C-Typen (`char`, `short`, `int`, `long`, `long long`, `float`, `double`) haben keine feste Grösse – sie hängt von Prozessor und Compiler ab. Ein `int` hat auf einem PC 4 Byte, auf einem 8-Bit-Mikrocontroller (AVR, z.B. Arduino Uno) aber nur 2 Byte. Derselbe Code kann dort plötzlich überlaufen. Mit `uint16_t` & Co. weisst du immer genau, was du bekommst.' },
      { tip: 'Ganze Werte → `uintN_t` oder `intN_t`. Werte mit Komma → `float32_t`/`float64_t`. Zeichen und Ja/Nein → `uint8_t`. Einzige Ausnahme in den Codebeispielen: `int main(void)` – so schreibt es der C-Standard vor.' }
    ],
    fact: {
      title: 'Ein Zeichen ist eigentlich eine Zahl',
      text: 'Für den Computer ist `\'A\'` einfach die Zahl 65 (ASCII-Code). Darum ergibt `\'A\' + 1` den Code von `\'B\'` und `\'a\' - \'A\'` ist 32 – mit diesem Trick wandeln viele Programme Gross- in Kleinbuchstaben um.'
    },
    tasks: [
      { type: 'choice',
        q: 'Was legt der Datentyp einer Variablen in C fest?',
        options: ['Wie viel Speicher sie belegt und wie die Bits darin gedeutet werden',
                  'Nur den Namen der Variablen',
                  'In welcher Zeile die Variable stehen muss',
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
        q: 'Ein Spiel speichert die Lebenspunkte einer Spielfigur, z.B. 100. Lebenspunkte haben nie Nachkommastellen. Welche Art von Typ passt?',
        options: ['Ganzzahl, z.B. `uint8_t`', 'Kommazahl, z.B. `float64_t`'],
        answer: 0,
        why: [null, 'Eine Kommazahl geht zwar, ist aber unnötig und ungenauer: Lebenspunkte haben keine Nachkommastellen.'],
        explain: 'Ganze Werte ohne Komma speichert man in Ganzzahltypen. Die sind exakt, schnell und brauchen keine Rundung.' },
      { type: 'choice',
        q: 'Ein Temperatursensor misst 21.5 °C. Welcher Typ kann diesen Wert inklusive Nachkommastelle speichern?',
        options: ['`uint8_t`', '`float32_t`', '`int16_t`'],
        answer: 1,
        why: ['Ein `uint8_t` würde die .5 einfach abschneiden – es bliebe 21.', null, 'Auch ein `int16_t` speichert nur ganze Zahlen – aus 21.5 würde 21.'],
        explain: 'Kommazahlen (Gleitkommazahlen) speichert man in `float32_t` oder `float64_t`. In C schreibt man das Komma als Punkt: `21.5`.' },
      { type: 'choice',
        q: 'Was steht nach dieser Zeile in `zeichen`?',
        code: 'uint8_t zeichen = \'A\';',
        options: ['Die Zahl 65 (der ASCII-Code von A)', 'Ein kleines Bild des Buchstabens', 'Der Text "A" mit Endzeichen', 'Nichts – ein Zeichen passt nicht in einen uint8_t'],
        answer: 0,
        why: [null, 'Im Speicher gibt es nur Bits – also Zahlen.', '`\'A\'` mit einfachen Anführungszeichen ist ein einzelnes Zeichen, kein Text.', 'Doch: Jedes ASCII-Zeichen hat einen Code von 0 bis 127 und passt bequem hinein.'],
        explain: 'Ein Zeichen ist für C eine kleine Ganzzahl. `\'A\'` hat den ASCII-Code 65, `\'0\'` den Code 48. Ein Text (z.B. `"Hallo"`) ist eine Reihe solcher Codes – ein Array aus `uint8_t` mit einem Endzeichen 0.' },
      { type: 'choice',
        q: 'Was steht nach dieser Zeile in `n`?',
        code: 'uint8_t n = 7.9;',
        options: ['7.9', '8', '7', 'Der Compiler verweigert das Programm immer'],
        answer: 2,
        why: ['Ein `uint8_t` kann keine Nachkommastellen speichern.', 'Es wird nicht gerundet!', null, 'Die meisten Compiler warnen höchstens – das Programm läuft.'],
        explain: 'Bei der Umwandlung einer Kommazahl in einen Ganzzahltyp werden die Nachkommastellen abgeschnitten (Richtung 0), nicht gerundet. Aus 7.9 wird 7.' },
      { type: 'choice',
        q: 'Welche Zeile brauchst du, damit `uint16_t`, `int32_t` & Co. bekannt sind?',
        options: ['`#include <stdio.h>`', '`#include <stdint.h>`', '`#include <math.h>`', '`#include <types>`'],
        answer: 1,
        explain: '`<stdint.h>` definiert die Ganzzahltypen mit fester Grösse. Für die passenden printf-Makros wie `PRIu16` gibt es zusätzlich `<inttypes.h>` (die bindet stdint.h automatisch mit ein).' },
      { type: 'choice',
        q: 'Ein Lichtschalter ist entweder an oder aus. Wie speicherst du das am sparsamsten?',
        options: ['`float64_t` mit 0.0 und 1.0', '`uint8_t` mit 0 (aus) und 1 (an)', '`int64_t` mit 0 und 1'],
        answer: 1,
        why: ['Eine Kommazahl mit 8 Byte für zwei Zustände – viel zu aufwendig.', null, 'Funktioniert, verschwendet aber 7 Bytes.'],
        explain: 'Für Ja/Nein-Werte reicht der kleinste Typ: `uint8_t` mit 0 = nein/aus und 1 = ja/an. In einer Bedingung wie `if (licht_an)` gilt jeder Wert ausser 0 als wahr.' },
      { type: 'choice',
        q: 'Warum verwendet man Typen wie `uint16_t` statt der klassischen Typen wie `int`?',
        options: ['Weil sie auf jeder Plattform genau gleich gross sind – die Grösse von `int` hängt dagegen von Prozessor und Compiler ab',
                  'Weil sie automatisch Überläufe verhindern',
                  'Weil sie mehr Nachkommastellen haben',
                  'Weil `int` in C verboten ist'],
        answer: 0,
        why: [null, 'Nein, auch ein `uint8_t` läuft bei 255 + 1 über.', 'Ganzzahltypen haben gar keine Nachkommastellen.', '`int` ist erlaubt – nur eben nicht überall gleich gross.'],
        explain: 'Ein `int` hat auf dem PC 4 Byte, auf einem 8-Bit-AVR-Mikrocontroller nur 2 Byte. `uint16_t` ist überall genau 16 Bit – wichtig für Firmware, Dateiformate und Netzwerkprotokolle.' }
    ]
  },
  /* ------------------------------------------------------------ 2 */
  {
    id: 'speicher',
    title: 'Speicherbedarf',
    desc: 'Bytes und Bits aus dem Namen ablesen, sizeof und Arrays.',
    intro: [
      { p: 'Speicher wird in Bytes gemessen. 1 Byte besteht aus 8 Bits, jedes Bit ist 0 oder 1. Die Zahl im Typnamen sind Bits – die Bytes rechnest du so aus: Bytes = Bits ÷ 8.' },
      { table: { head: ['Bits im Namen', 'Bytes', 'Typen'], rows: [
        ['8', '1', '`uint8_t`, `int8_t`'],
        ['16', '2', '`uint16_t`, `int16_t`'],
        ['32', '4', '`uint32_t`, `int32_t`, `float32_t`'],
        ['64', '8', '`uint64_t`, `int64_t`, `float64_t`']
      ] } },
      { p: 'Mit `sizeof` fragst du den Compiler nach der Grösse in Bytes. Bei einem Array erhältst du die Grösse des ganzen Arrays: Anzahl Elemente × Grösse eines Elements. Das Ergebnis von `sizeof` gibst du mit `%zu` aus.' },
      { code: '#include <stdint.h>\n\nuint16_t werte[10];\nprintf("%zu\\n", sizeof(uint16_t));  // 2\nprintf("%zu\\n", sizeof(werte));     // 10 * 2 = 20' },
      { tip: 'Diese Grössen gelten auf jeder Plattform – genau das ist der Vorteil der Typen mit fester Grösse.' }
    ],
    fact: {
      title: 'Zum Mond mit 4 KB',
      text: 'Der Apollo Guidance Computer, der 1969 Menschen zum Mond brachte, hatte nur 2048 Speicherwörter Arbeitsspeicher (rund 4 KB). Jedes Byte war kostbar – genau deshalb lohnt es sich, den passenden Typ zu wählen.'
    },
    tasks: [
      { type: 'number',
        q: 'Wie viele Bits hat ein Byte?',
        answer: '8', unit: 'Bits',
        explain: '1 Byte = 8 Bits. Jedes Bit ist 0 oder 1.' },
      { type: 'number',
        q: 'Wie viele Bytes belegt ein `int32_t`?',
        answer: '4', unit: 'Bytes',
        hint: 'Die Zahl im Namen sind Bits. Teile durch 8.',
        explain: '32 Bit ÷ 8 = 4 Byte – auf jeder Plattform.' },
      { type: 'number',
        q: 'Wie viele Bytes belegt ein `uint64_t`?',
        answer: '8', unit: 'Bytes',
        explain: '64 Bit ÷ 8 = 8 Byte.' },
      { type: 'choice',
        q: 'Was gibt diese Zeile aus?',
        code: '#include "types.h"\nprintf("%zu\\n", sizeof(float64_t));',
        options: ['4', '8', '16', '64'],
        answer: 1,
        why: ['4 Byte hat ein `float32_t`.', null, 'Nein, die 64 im Namen bedeutet 64 Bit = 8 Byte.', '64 sind die Bits – `sizeof` zählt aber Bytes.'],
        explain: '`float64_t` hat 64 Bit = 8 Byte. `sizeof` liefert immer Bytes; das Ergebnis hat den Typ `size_t`, den man mit `%zu` ausgibt.' },
      { type: 'choice',
        q: 'Mit welcher Formatangabe gibt man das Ergebnis von `sizeof` mit printf aus?',
        options: ['`%zu`', '`%f`', '`"%" PRIu8`', '`%c`'],
        answer: 0,
        why: [null, '`%f` ist für Kommazahlen.', '`sizeof` liefert keinen `uint8_t`, sondern ein `size_t`.', '`%c` gibt ein Zeichen aus.'],
        explain: '`sizeof` liefert einen Wert vom Typ `size_t` (vorzeichenlos, Grösse plattformabhängig). Dafür gibt es das Format `%zu`.' },
      { type: 'number',
        q: 'Ein Mikrocontroller hat 2 KB RAM (= 2048 Bytes). Wie viele `int32_t`-Werte passen rein rechnerisch hinein?',
        answer: '512', unit: 'Werte',
        explain: '2048 Bytes ÷ 4 Bytes = 512. In der Praxis sind es weniger, weil auch Stack und andere Variablen Platz brauchen. Mit `uint8_t` (1 Byte) wären es viermal so viele Werte.' },
      { type: 'number',
        q: 'Wie viele Bytes belegt dieses Array?',
        code: '#include "types.h"\nfloat64_t messwerte[100];\nprintf("%zu\\n", sizeof(messwerte));',
        answer: '800', unit: 'Bytes',
        hint: 'Anzahl Elemente × Grösse eines float64_t.',
        explain: '100 Elemente × 8 Byte = 800 Byte. `sizeof` auf ein Array liefert die Grösse des ganzen Arrays.' },
      { type: 'number',
        q: 'Wie viele Bytes belegt dieser Puffer?',
        code: '#include <stdint.h>\nuint16_t puffer[50];',
        answer: '100', unit: 'Bytes',
        explain: '50 Elemente × 2 Byte = 100 Byte.' },
      { type: 'number',
        q: 'Wie viele Bytes belegen diese drei Variablen zusammen?',
        code: '#include <stdint.h>\n#include "types.h"\n\nuint8_t   kanal;\nuint32_t  zeit;\nfloat32_t wert;',
        answer: '9', unit: 'Bytes',
        explain: '1 + 4 + 4 = 9 Byte. (Packt man die drei in eine struct, kommen noch Füllbytes dazu – das lernst du in Level 8.)' }
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
        'Die Zahl n liest du direkt aus dem Namen ab: `int16_t` → n = 16.'
      ] },
      { tip: 'Bits aus dem Namen ablesen, dann Formel anwenden. Für grosse Typen hilft der Spickzettel.' }
    ],
    fact: {
      title: 'Gangnam Style sprengte den Zähler',
      text: 'Im Dezember 2014 näherte sich das Video „Gangnam Style“ 2\'147\'483\'647 Aufrufen – dem grössten Wert eines 32-Bit-Zählers mit Vorzeichen (wie `int32_t`). YouTube stellte den Zähler darauf auf 64 Bit um (max. 9\'223\'372\'036\'854\'775\'807).'
    },
    tasks: [
      { type: 'choice',
        q: 'Wie viele verschiedene Werte kann man mit n Bits darstellen?',
        options: ['n', '2 · n', '2ⁿ', 'n²'],
        answer: 2,
        explain: 'Jedes Bit verdoppelt die Möglichkeiten: 1 Bit → 2, 2 Bits → 4, 8 Bits → 2⁸ = 256 Werte.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `uint8_t`?',
        answer: '255',
        hint: 'Formel: 2⁸ − 1',
        explain: '2⁸ − 1 = 256 − 1 = 255. Die −1 kommt daher, dass die 0 auch einen der 256 Werte belegt.' },
      { type: 'number',
        q: 'Was ist der kleinste Wert eines `int8_t`?',
        answer: '-128',
        hint: 'Formel: −2⁷',
        explain: '`int8_t`: −2⁷ = −128 bis 2⁷ − 1 = 127. Es gibt einen negativen Wert mehr als positive, weil die 0 bei den „positiven“ mitgezählt wird.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `uint16_t`?',
        answer: '65535',
        explain: '2¹⁶ − 1 = 65\'535. Typisch z.B. für Port-Nummern im Netzwerk (0 … 65\'535).' },
      { type: 'yesno',
        q: 'Passt der Wert 40000 in einen `int16_t`?',
        answer: false,
        explain: 'Ein `int16_t` reicht von −32\'768 bis 32\'767. 40\'000 ist zu gross. Weil ein Bit für das Vorzeichen draufgeht, ist der positive Bereich nur halb so gross wie bei `uint16_t`.' },
      { type: 'yesno',
        q: 'Passt der Wert 40000 in einen `uint16_t`?',
        answer: true,
        explain: '`uint16_t` reicht von 0 bis 65\'535 (2¹⁶ − 1). Ohne Vorzeichen steht der ganze Bereich für positive Zahlen zur Verfügung.' },
      { type: 'choice',
        q: 'Was ist der Wertebereich von `int32_t`?',
        options: ['0 bis 4\'294\'967\'295', '−2\'147\'483\'648 bis 2\'147\'483\'647', '−32\'768 bis 32\'767', '−2\'147\'483\'647 bis 2\'147\'483\'648'],
        answer: 1,
        why: ['Das ist `uint32_t` (ohne Vorzeichen).', null, 'Das ist `int16_t`.', 'Fast! Aber der negative Bereich ist um eins grösser, nicht der positive.'],
        explain: '−2³¹ bis 2³¹ − 1. Merkhilfe: `int32_t` geht bis ca. ±2.1 Mrd., `uint32_t` bis ca. 4.29 Mrd.' },
      { type: 'yesno',
        q: 'Die Weltbevölkerung (über 8 Milliarden) passt in einen `uint32_t`.',
        answer: false,
        explain: '`uint32_t` geht nur bis 4\'294\'967\'295 (ca. 4.3 Mrd.). Für 8 Milliarden braucht man 64 Bit, z.B. `uint64_t`.' },
      { type: 'yesno',
        q: 'Ein Akkustand in Prozent (0 bis 100) passt in einen `uint8_t`.',
        answer: true,
        explain: '`uint8_t` deckt 0 bis 255 ab – 0 … 100 passt bequem. Sogar ein `int8_t` (bis 127) würde reichen.' },
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
    title: 'Speicher-Visualisierung',
    desc: 'Bits selbst umschalten: ohne Vorzeichen und Zweierkomplement live sehen.',
    intro: [
      { p: 'Jedes Bit hat eine Wertigkeit (Stellenwert). Ganz rechts steht 1, nach links verdoppelt sich der Wert. Der Zahlenwert ist die Summe aller Bits, die auf 1 stehen.' },
      { table: { head: ['Bit', '7', '6', '5', '4', '3', '2', '1', '0'], rows: [
        ['Wert', '128', '64', '32', '16', '8', '4', '2', '1'],
        ['Beispiel 6', '0', '0', '0', '0', '0', '1', '1', '0']
      ] } },
      { p: 'Bei 16 Bit geht es links weiter: 256, 512, 1024 … bis 2¹⁵ = 32768.' },
      { p: 'Typen mit Vorzeichen (`int8_t`, `int16_t` …) verwenden das Zweierkomplement: Das oberste Bit zählt negativ (bei 8 Bit −128 statt +128). Ist es 0, ist die Zahl positiv; ist es 1, ist sie negativ.' },
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
      { type: 'bits', bits: 8, mode: 'ohneVZ', target: 13,
        q: 'Warm-up: Stelle die Zahl 13 als `uint8_t` ein. Klicke dazu die Bits an.',
        explain: '13 = 8 + 4 + 1 → `00001101`. Jedes Bit hat eine Wertigkeit (128, 64, 32, 16, 8, 4, 2, 1); man addiert die eingeschalteten.' },
      { type: 'bits', bits: 8, mode: 'ohneVZ', target: 200,
        q: 'Ein Pixel hat den Rot-Wert 200. Stelle 200 als `uint8_t` ein.',
        explain: '200 = 128 + 64 + 8 → `11001000`. Farbwerte von 0 … 255 sind ein klassischer Fall für `uint8_t`.' },
      { type: 'number',
        q: 'Was ist der grösste Wert, den man mit 8 Bits ohne Vorzeichen darstellen kann? Tipp: Probiere es auf der Spielwiese aus.',
        answer: '255',
        explain: 'Alle 8 Bits auf 1: 128+64+32+16+8+4+2+1 = 255 = 2⁸ − 1.' },
      { type: 'bits', bits: 8, mode: 'mitVZ', target: -1,
        q: 'Stelle die Zahl −1 als `int8_t` (Zweierkomplement) ein.',
        explain: 'Im Zweierkomplement ist −1 = `11111111` – dieselben Bits, die als `uint8_t` 255 bedeuten. Das oberste Bit zählt bei `int8_t` −128: −128 + 127 = −1.' },
      { type: 'bits', bits: 8, mode: 'mitVZ', target: 127,
        q: 'Stelle den grössten möglichen `int8_t`-Wert ein.',
        explain: '`01111111` = 127. Das oberste Bit (Vorzeichen-Bit) muss 0 bleiben – sobald es 1 ist, wird die Zahl negativ.' },
      { type: 'bits', bits: 8, mode: 'mitVZ', target: -128,
        q: 'Und jetzt den kleinsten `int8_t`-Wert.',
        explain: '`10000000` = −128. Nur das Vorzeichen-Bit (Wert −128) ist gesetzt. Zählt man einen `int8_t` von 127 um eins hoch, landet man typischerweise genau hier – das ist der klassische Überlauf.' },
      { type: 'bits', bits: 16, mode: 'ohneVZ', target: 1000,
        q: 'Ein Schrittzähler zeigt 1000 Schritte. Stelle 1000 als `uint16_t` ein.',
        explain: '1000 = 512 + 256 + 128 + 64 + 32 + 8 → `00000011 11101000`. Mit 8 Bit (max. 255) ginge das nicht, darum braucht man hier 16 Bit.' },
      { type: 'bits', bits: 16, mode: 'mitVZ', target: -2,
        q: 'Stelle −2 als `int16_t` ein.',
        explain: '−2 = `11111111 11111110`. Trick fürs Zweierkomplement: Bits von +2 (`…0010`) umkehren (`…1101`) und 1 addieren (`…1110`).' }
    ]
  },
  /* ------------------------------------------------------------ 5 */
  {
    id: 'komma',
    title: 'Kommazahlen',
    desc: 'float32_t vs. float64_t, Genauigkeit, Rundungsfehler – und wann Ganzzahlen besser sind.',
    intro: [
      { p: 'Für Kommazahlen gibt es zwei Typen. Sie speichern eine Zahl als Gleitkommazahl: Ziffern plus Exponent. Darum ist nicht die Anzahl Nachkommastellen begrenzt, sondern die Anzahl signifikanter Stellen (alle Ziffern ohne führende Nullen, vor und nach dem Komma).' },
      { table: { head: ['Typ', 'Bytes', 'Genauigkeit', 'printf'], rows: [
        ['`float32_t`', '4', 'ca. 6–7 signifikante Stellen (sicher 6)', '`%f`'],
        ['`float64_t`', '8', 'ca. 15–16 signifikante Stellen (sicher 15)', '`%f`']
      ] } },
      { p: 'Ehrlich gesagt: `float32_t` und `float64_t` stehen nicht in `<stdint.h>`. Viele Embedded-Projekte und Coding-Standards (z.B. MISRA, ARM CMSIS) definieren sie selbst per typedef in einer eigenen Header-Datei. In dieser Lernseite heisst sie `types.h` und sieht so aus:' },
      { code: '/* types.h */\n#include <stdint.h>\ntypedef float  float32_t;\ntypedef double float64_t;' },
      { ul: [
        'Rundungsfehler: Viele Kommazahlen wie 0.1 sind im Binärsystem nicht exakt darstellbar. Darum ist `0.1 + 0.2` nicht genau `0.3`. Vergleiche Kommazahlen nie mit `==`.',
        'Ganzzahldivision: Sind beide Operanden Ganzzahlen, wird ganzzahlig geteilt – der Rest fällt weg, auch wenn das Ergebnis danach in einer Kommazahl landet. Lösung: vorher umwandeln, z.B. `(float64_t)summe / anzahl`.',
        'Festkomma: Oft ist es besser, mit Ganzzahlen in einer kleinen Einheit zu rechnen: Geld in Rappen, Temperatur in Zehntelgrad (215 = 21.5 °C). Das ist exakt.',
        'Kleine Mikrocontroller ohne Gleitkomma-Einheit (FPU) rechnen Kommazahlen per Software – das geht, ist aber viel langsamer und braucht mehr Programmspeicher.'
      ] },
      { code: '#include <stdint.h>\n#include "types.h"\n\nint32_t   summe = 17, anzahl = 4;\nfloat64_t falsch  = summe / anzahl;             // 4.0\nfloat64_t richtig = (float64_t)summe / anzahl;  // 4.25\nprintf("%f\\n", richtig);' },
      { tip: 'Nur so viel Genauigkeit wie nötig: `float32_t` reicht für bis zu 6 signifikante Stellen, sonst `float64_t`. Für Geld: Ganzzahl in Rappen.' }
    ],
    fact: {
      title: 'Patriot-Rakete: 0.1 ist nicht 0.1',
      text: '1991 verfehlte eine Patriot-Abwehrrakete in Dhahran ihr Ziel; 28 Soldaten starben. Das System zählte die Zeit in Zehntelsekunden, doch 0.1 lässt sich binär nicht exakt darstellen. Nach 100 Stunden Laufzeit war die Uhr um etwa 0.34 Sekunden daneben – genug, um das Ziel um über 500 m falsch zu berechnen.'
    },
    tasks: [
      { type: 'choice',
        q: 'Woher kommen `float32_t` und `float64_t`?',
        options: ['Aus `<stdint.h>`, wie `uint8_t`',
                  'Aus einer eigenen Header-Datei des Projekts, die sie per typedef definiert (hier `types.h`)',
                  'Aus `<stdio.h>`',
                  'Sie sind Schlüsselwörter von C'],
        answer: 1,
        why: ['Nein – `<stdint.h>` enthält nur Ganzzahltypen.', null, '`<stdio.h>` ist für Ein- und Ausgabe wie printf.', 'Nein, es sind selbst definierte Typnamen.'],
        explain: 'Embedded-Projekte und Coding-Standards wie MISRA oder ARM CMSIS definieren sie per typedef, damit auch bei Kommazahlen die Grösse im Namen steht.' },
      { type: 'number',
        q: 'Wie viele Bytes belegt ein `float32_t`?',
        answer: '4', unit: 'Bytes',
        explain: '32 Bit ÷ 8 = 4 Byte. Ein `float64_t` hat 8 Byte.' },
      { type: 'choice',
        q: 'Wie viele signifikante Stellen schafft ein `float32_t` ungefähr?',
        options: ['2–3', '6–7', '15–16', 'beliebig viele'],
        answer: 1,
        why: ['Deutlich mehr.', null, 'Das schafft `float64_t`.', 'Kein Typ ist unendlich genau – 4 Byte haben nur 32 Bits.'],
        explain: '`float32_t` hat ca. 6–7 signifikante Stellen (sicher 6), `float64_t` ca. 15–16 (sicher 15).' },
      { type: 'yesno',
        q: 'In C ist `0.1 + 0.2 == 0.3` wahr.',
        answer: false,
        explain: '0.1 und 0.2 sind binär nicht exakt darstellbar. Die Summe ist ungefähr 0.30000000000000004 – knapp neben 0.3. Kommazahlen vergleicht man darum mit einer kleinen Toleranz statt mit `==`.' },
      { type: 'choice',
        q: 'Welchen Wert hat `schnitt` nach diesen Zeilen?',
        code: '#include <stdint.h>\n#include "types.h"\n\nint32_t   summe = 17;\nint32_t   anzahl = 4;\nfloat64_t schnitt = summe / anzahl;',
        options: ['4.25', '4.0', '5.0', 'Der Compiler meldet einen Fehler'],
        answer: 1,
        why: ['Leider nicht: Beide Operanden sind Ganzzahlen.', null, 'Es wird nicht gerundet, der Rest fällt einfach weg.', 'Das ist gültiger C-Code.'],
        explain: '`int32_t / int32_t` ist eine Ganzzahldivision: 17 / 4 = 4, der Rest fällt weg. Erst danach wird 4 in 4.0 umgewandelt. Richtig wäre `(float64_t)summe / anzahl`.' },
      { type: 'number',
        q: 'Ein Sensor speichert die Temperatur in Zehntelgrad als `int16_t` (215 bedeutet 21.5 °C). Welcher Wert steht für −3.7 °C?',
        answer: '-37',
        explain: '−3.7 × 10 = −37. Festkomma mit Ganzzahlen ist exakt und auf Mikrocontrollern ohne FPU viel schneller als Gleitkomma.' },
      { type: 'choice',
        q: 'Wie speichert man Kontostände am sichersten?',
        options: ['Als `float32_t` in Franken', 'Als `float64_t` in Franken', 'Als Ganzzahl in Rappen, z.B. `int64_t`', 'Als Text'],
        answer: 2,
        why: ['Nur ca. 7 Stellen und Rundungsfehler – für Geld ungeeignet.', 'Genauer, aber 0.10 Franken ist auch hier nicht exakt darstellbar.', null, 'Damit kann man nicht rechnen.'],
        explain: 'Geld rechnet man in der kleinsten Einheit als Ganzzahl: 12.50 CHF = 1250 Rappen. Ganzzahlen sind exakt, Rundungsfehler können nicht entstehen.' },
      { type: 'choice',
        q: 'Ein kleiner 8-Bit-Mikrocontroller hat keine Gleitkomma-Einheit (FPU). Was passiert, wenn du dort mit `float32_t` rechnest?',
        options: ['Der Compiler verweigert den Code',
                  'Es funktioniert, aber der Compiler ersetzt jede Rechnung durch Software-Routinen – viel langsamer und mehr Programmspeicher',
                  'Die Werte werden automatisch zu Ganzzahlen',
                  'Es ist genauso schnell wie mit Ganzzahlen'],
        answer: 1,
        why: ['Doch, das geht – C verlangt keine FPU.', null, 'Nein, die Kommazahlen bleiben erhalten.', 'Leider nein: Jede Gleitkomma-Operation braucht dort viele Befehle.'],
        explain: 'Ohne FPU wird jede Gleitkomma-Rechnung in viele Ganzzahl-Befehle zerlegt. Darum rechnet man auf solchen Chips oft mit Festkomma (z.B. Zehntelgrad in `int16_t`).' },
      { type: 'yesno',
        q: 'Profi-Frage: Die Ganzzahl 16\'777\'217 (= 2²⁴ + 1) lässt sich in einem `float32_t` exakt speichern.',
        answer: false,
        explain: 'Ein `float32_t` hat nur 24 Bit für die Ziffern (Mantisse). Bis 2²⁴ = 16\'777\'216 ist jede Ganzzahl exakt, danach nur noch jede zweite. Aus 16\'777\'217 wird 16\'777\'216. Ein `float64_t` (53 Bit Mantisse) schafft das problemlos.' }
    ]
  },
  /* ------------------------------------------------------------ 6 */
  {
    id: 'effizient',
    title: 'Effizientesten Typ wählen',
    desc: 'Der kleinste Typ, der sicher passt – ohne Bytes zu verschwenden.',
    intro: [
      { p: 'Hier wählst du für eine Variable den sparsamsten Typ, der trotzdem sicher passt. Gehe immer in diesen vier Schritten vor:' },
      { ol: [
        'Bereich bestimmen: Was ist der kleinste und der grösste Wert, der vorkommen kann?',
        'Negativ? Wenn ja, brauchst du einen Typ mit Vorzeichen (`intN_t`), sonst reicht einer ohne (`uintN_t`).',
        'Komma? Mit Nachkommastellen brauchst du `float32_t` (4 Byte, sicher 6 signifikante Stellen) oder `float64_t` (8 Byte, sicher 15 Stellen). Die Aufgabe sagt dir, wie viele Stellen nötig sind.',
        'Kleinsten Typ nehmen, bei dem Minimum und Maximum beide in den Wertebereich passen.'
      ] },
      { table: { head: ['Typ', 'Bereich'], rows: [
        ['`uint8_t` / `int8_t`', '0 … 255 / −128 … 127'],
        ['`uint16_t` / `int16_t`', '0 … 65\'535 / −32\'768 … 32\'767'],
        ['`uint32_t` / `int32_t`', '0 … ca. 4.29 Mrd. / ca. ±2.1 Mrd.'],
        ['`uint64_t` / `int64_t`', 'riesig (ca. 1.8·10¹⁹ / ±9.2·10¹⁸)'],
        ['`float32_t` / `float64_t`', 'Kommazahlen, sicher 6 / 15 signifikante Stellen']
      ] } },
      { tip: 'Signifikante Stellen = alle Ziffern ohne führende Nullen, vor und nach dem Komma. 21.5 hat 3, 47.37691234 hat 10.' }
    ],
    fact: {
      title: 'Ariane 5: 370 Millionen Dollar Überlauf',
      text: 'Am 4. Juni 1996 zerstörte sich die Rakete Ariane 5 rund 37 Sekunden nach dem Start. Ursache: Eine 64-Bit-Kommazahl (horizontale Geschwindigkeit) wurde in eine 16-Bit-Ganzzahl mit Vorzeichen umgewandelt. Der Wert war grösser als 32\'767 – der Überlauf brachte das Steuersystem zum Absturz.'
    },
    tasks: [
      { type: 'pickType',
        q: 'Das Alter einer Person in ganzen Jahren. Werte von 0 bis 150, nie negativ.',
        code: '____ alter = 42;',
        min: '0', max: '150',
        options: ['int8_t', 'uint8_t', 'uint16_t', 'int32_t'],
        explain: '`uint8_t` deckt 0 … 255 ab und braucht nur 1 Byte. `int8_t` reicht nur bis 127 – 150 würde überlaufen.' },
      { type: 'pickType',
        q: 'Ein Temperatursensor liefert ganze Grad Celsius von −40 bis +85 °C.',
        code: '____ temperatur = -12;',
        min: '-40', max: '85',
        options: ['uint8_t', 'int8_t', 'int16_t', 'float32_t'],
        explain: '`int8_t` (−128 … 127) deckt −40 … 85 ab, mit nur 1 Byte. Ein Typ ohne Vorzeichen kann keine negativen Werte speichern.' },
      { type: 'pickType',
        q: 'Lebenspunkte im Spiel: 0 bis 1000, nie negativ.',
        code: '____ lebenspunkte = 1000;',
        min: '0', max: '1000',
        options: ['uint8_t', 'int8_t', 'uint16_t', 'int32_t'],
        explain: '1000 braucht mehr als 8 Bit (max. 255), aber 16 Bit reichen locker: `uint16_t` geht bis 65\'535.' },
      { type: 'pickType',
        q: 'Ein Schrittzähler zählt die Schritte eines Tages: 0 bis 100\'000.',
        code: '____ schritte = 0;\nschritte++;',
        min: '0', max: '100000',
        options: ['uint16_t', 'int16_t', 'uint32_t', 'uint64_t'],
        explain: '100\'000 ist grösser als 65\'535, also reichen 16 Bit nicht. `uint32_t` geht bis über 4 Milliarden.' },
      { type: 'pickType',
        q: 'Der Rotkanal eines Pixels: ganze Werte von 0 bis 255.',
        code: '____ rot = 255;',
        min: '0', max: '255',
        options: ['int8_t', 'uint8_t', 'int16_t', 'int32_t'],
        explain: 'Genau der Bereich von `uint8_t`. Ein Full-HD-Bild hat über 2 Mio. Pixel × 3 Farbkanäle – mit `int32_t` statt `uint8_t` bräuchte es 4× so viel Speicher.' },
      { type: 'pickType',
        q: 'Die Weltbevölkerung als Zähler: heute ca. 8.1 Milliarden, soll bis 12 Milliarden reichen. Nie negativ.',
        code: '____ weltbevoelkerung = 8100000000;',
        min: '0', max: '12000000000',
        options: ['int32_t', 'uint32_t', 'int64_t', 'uint64_t'],
        explain: '32 Bit reichen höchstens bis 4.29 Mrd. Für 12 Mrd. braucht es 64 Bit. `uint64_t` und `int64_t` sind beide 8 Byte und gleich effizient – beide sind richtig.' },
      { type: 'pickType',
        q: 'Ein Bankkonto in Rappen (Ganzzahl, keine Rundungsfehler!). Kontostände von −50 Mio. CHF bis +50 Mio. CHF, also −5\'000\'000\'000 bis 5\'000\'000\'000 Rappen.',
        code: '____ kontostand_rappen = -12550;',
        min: '-5000000000', max: '5000000000',
        options: ['int32_t', 'uint32_t', 'uint64_t', 'int64_t', 'float64_t'],
        explain: 'Negative Werte → mit Vorzeichen. 5 Mrd. sprengt 32 Bit → `int64_t`. Geld in der kleinsten Einheit als Ganzzahl zu speichern ist die übliche Lösung gegen Rundungsfehler.' },
      { type: 'pickType',
        q: 'Raumtemperatur mit einer Nachkommastelle, z.B. 21.5 °C, von −40.0 bis 85.0. Es sind höchstens 4 signifikante Stellen nötig.',
        code: '____ raumtemp = 21.5;',
        min: '-40', max: '85', decimals: true, digits: 4, sample: '21.5',
        options: ['int16_t', 'float32_t', 'float64_t', 'int32_t'],
        explain: 'Für Kommazahlen braucht man `float32_t` oder `float64_t`. 4 Stellen schafft `float32_t` (sicher 6) problemlos – mit halbem Speicher von `float64_t`.' },
      { type: 'pickType',
        q: 'Eine GPS-Koordinate mit 8 Nachkommastellen, z.B. 47.37691234 – das sind 10 signifikante Stellen. Bereich −180 bis 180.',
        code: '____ laengengrad = 8.54169812;',
        min: '-180', max: '180', decimals: true, digits: 10, sample: '47.37691234',
        options: ['float32_t', 'float64_t', 'int32_t'],
        notes: { 'float32_t': '`float32_t` hat nur ca. 6–7 signifikante Stellen: aus 47.37691234 würde ungefähr 47.37691 – die Position wäre um bis zu ca. 1 m daneben.' },
        explain: '10 signifikante Stellen sind zu viel für `float32_t`. `float64_t` schafft sicher 15 Stellen.' }
    ]
  },
  /* ------------------------------------------------------------ 7 */
  {
    id: 'fehler',
    title: 'Fehler im Code finden',
    desc: 'Typ-Fehler aufspüren: Klick die fehlerhafte Zeile an.',
    intro: [
      { p: 'Jede Aufgabe hat zwei Schritte: Zuerst klickst du die fehlerhafte Zeile an, dann wählst du die passende Korrektur. Diese Typ-Fehler kommen häufig vor:' },
      { ul: [
        'Überlauf: Ein Wert (z.B. ein Schleifenzähler) wird grösser als sein Typ erlaubt. Bei `uintN_t` springt er wieder auf 0 (genau festgelegt); bei `intN_t` ist ein Überlauf undefiniertes Verhalten.',
        'Unterlauf: Ein `uintN_t` kann nicht negativ werden – 0 − 1 ergibt den Maximalwert.',
        'Ohne Vorzeichen für negative Werte: Ein negativer Wert wird zu einer riesigen positiven Zahl.',
        'Ganzzahldivision: Zwei Ganzzahlen werden ganzzahlig geteilt, auch wenn das Ergebnis in einer Kommazahl landet.',
        'Kommazahlen sind ungenau: Für Geld nimmt man Ganzzahlen in Rappen.',
        'Mit und ohne Vorzeichen mischen: Beim Vergleich von `int32_t` mit `uint32_t` wird der Wert mit Vorzeichen in einen ohne umgewandelt.',
        'Zwischenergebnisse: `a * b` wird im Typ von `a` und `b` gerechnet, nicht im Typ der Zielvariable.'
      ] },
      { p: 'printf braucht für jeden Typ das passende Format. Für die Ganzzahltypen gibt es in `<inttypes.h>` fertige Makros: `PRIu…` für ohne Vorzeichen, `PRId…` für mit Vorzeichen, dahinter die Bits. Das Makro ist ein Stück Text, das C mit dem `"%"` davor zusammenklebt:' },
      { code: '#include <inttypes.h>\n\nuint8_t i = 7;\nint16_t t = -5;\nprintf("%" PRIu8 " / %" PRId16 "\\n", i, t);' },
      { table: { head: ['Typ', 'printf-Format'], rows: [
        ['`uint8_t` … `uint64_t`', '`"%" PRIu8` … `"%" PRIu64`'],
        ['`int8_t` … `int64_t`', '`"%" PRId8` … `"%" PRId64`'],
        ['`float32_t` / `float64_t`', '`%f` (z.B. `%.2f` für 2 Nachkommastellen)'],
        ['`sizeof`', '`%zu`']
      ] } },
      { tip: 'Ein falsches printf-Format ist undefiniertes Verhalten. Frag dich bei jeder Zeile: Welcher Typ ist das wirklich – und passt der Wert hinein?' }
    ],
    fact: {
      title: 'Das Jahr-2038-Problem',
      text: 'Viele Systeme zählen die Zeit in Sekunden seit dem 1.1.1970 in einem 32-Bit-Wert mit Vorzeichen. Am 19. Januar 2038 um 03:14:07 UTC ist 2\'147\'483\'647 erreicht – eine Sekunde später springt der Wert ins Negative und die Uhr zeigt plötzlich 1901. Moderne Systeme verwenden deshalb 64-Bit-Zeit.'
    },
    tasks: [
      { type: 'findBug',
        q: 'Das Programm soll 300 Datenpakete nummerieren – es hört aber nie auf. Welche Zeile ist schuld?',
        code: ['#include <stdio.h>', '#include <inttypes.h>', '', 'int main(void) {', '    for (uint8_t i = 0; i < 300; i++) {', '        printf("Paket %" PRIu8 "\\n", i);', '    }', '    return 0;', '}'],
        bugLines: [4],
        lineHint: 'Schau dir an, welchen Typ der Schleifenzähler hat und wie weit er zählen muss.',
        fixes: ['`for (uint16_t i = 0; i < 300; i++)` (und `PRIu16`)', '`for (uint8_t i = 0; i <= 300; i++)`', '`for (int8_t i = 0; i < 300; i++)`', '`for (uint8_t i = 1; i < 300; i++)`'],
        fix: 0,
        explain: 'Ein `uint8_t` geht nur bis 255. `i++` speichert 256 wieder in den `uint8_t` – heraus kommt 0. Die Bedingung `i < 300` ist immer wahr, die Schleife endet nie. Mit `uint16_t` klappt es.' },
      { type: 'findBug',
        q: 'Die Frostwarnung erscheint nie, obwohl es draussen −15 °C sind. Wo liegt der Fehler?',
        code: ['#include <stdio.h>', '#include <stdint.h>', '', 'int main(void) {', '    uint32_t temperatur;', '    temperatur = sensor_lesen(); // liefert -30 bis 50', '    if (temperatur < 0) {', '        printf("Frost!\\n");', '    }', '    return 0;', '}'],
        bugLines: [4],
        lineHint: 'Die Bedingung ist an sich richtig – aber kann die Variable überhaupt negativ werden?',
        fixes: ['`int16_t temperatur;`', '`uint64_t temperatur;`', '`if (temperatur <= 0)`', '`uint8_t temperatur;`'],
        fix: 0,
        explain: 'Ein `uint32_t` kann nicht negativ sein: −15 wird zu 4\'294\'967\'281. Damit ist `temperatur < 0` immer falsch. Für Werte, die negativ werden können, braucht es einen Typ mit Vorzeichen.' },
      { type: 'findBug',
        q: 'Der Durchschnitt soll 4.25 sein, ausgegeben wird aber 4.00. Welche Zeile ist fehlerhaft?',
        code: ['int32_t summe = 17;', 'int32_t anzahl = 4;', 'float64_t schnitt = summe / anzahl;', 'printf("%.2f\\n", schnitt);'],
        bugLines: [2],
        lineHint: 'Mit welchem Typ wird die Division gerechnet – bevor das Ergebnis in schnitt landet?',
        fixes: ['`float64_t schnitt = (float64_t)summe / anzahl;`', '`float32_t schnitt = summe / anzahl;`', '`float64_t schnitt = (float64_t)(summe / anzahl);`', '`int32_t schnitt = summe / anzahl;`'],
        fix: 0,
        why: [null, 'Auch hier wird zuerst ganzzahlig geteilt.', 'Die Klammer rechnet zuerst 17 / 4 = 4 ganzzahlig – erst danach wird umgewandelt.', 'Ein `int32_t` kann gar keine 4.25 speichern.'],
        explain: 'Zwei Ganzzahlen ergeben eine Ganzzahldivision: 17 / 4 = 4, der Rest fällt weg. Erst danach wird 4 in 4.0 umgewandelt. Wandelt man vorher einen Operanden in `float64_t` um, rechnet C mit Kommazahlen: 4.25.' },
      { type: 'findBug',
        q: 'Eine Bank addiert 1 Million Mal 10 Rappen. Erwartet: 100000.00 – heraus kommt etwas wie 100958.34. Was ist das Problem?',
        code: ['float32_t kontostand = 0.0f;', 'for (uint32_t i = 0; i < 1000000; i++) {', '    kontostand += 0.10f; // 10 Rappen', '}', 'printf("%.2f\\n", kontostand);'],
        bugLines: [0, 2],
        lineHint: 'Die Schleife und die Ausgabe sind korrekt. Welche Zeile legt fest, wie genau der Betrag gespeichert wird?',
        fixes: ['Betrag in Rappen als Ganzzahl speichern: `int64_t kontostand_rappen = 0;` und `+= 10`',
                '`float64_t kontostand = 0.0;` – dann ist es exakt',
                '`printf("%.1f\\n", kontostand);`',
                '`int32_t i` als Schleifenzähler'],
        fix: 0,
        why: [null, '`float64_t` ist genauer, aber 0.1 ist auch dort nicht exakt darstellbar – für Geld bleibt es riskant.', 'Die Ausgabe ändert nichts am falsch gespeicherten Wert.', 'Der Zähler ist nicht das Problem.'],
        explain: '0.1 ist binär ein unendlicher Bruch und wird gerundet. `float32_t` hat nur ca. 7 Stellen – die Fehler summieren sich. Geldbeträge speichert man als Ganzzahl in der kleinsten Einheit (Rappen).' },
      { type: 'findBug',
        q: 'Statt −5 erscheint eine riesige positive Zahl. Welche Zeile enthält den Fehler?',
        code: ['#include <inttypes.h>', '', 'int16_t temperatur = -5;', 'printf("Temperatur: %" PRIu16 "\\n", temperatur);'],
        bugLines: [3],
        lineHint: 'Der Wert ist richtig gespeichert. Passt das Format zum Typ?',
        fixes: ['`printf("Temperatur: %" PRId16 "\\n", temperatur);`', '`printf("Temperatur: %" PRIu32 "\\n", temperatur);`', '`uint16_t temperatur = -5;`', '`printf("Temperatur: %f\\n", temperatur);`'],
        fix: 0,
        why: [null, 'Immer noch „u“ = ohne Vorzeichen.', 'Dann ist der Wert selbst falsch: 65\'531.', '`%f` ist für Kommazahlen.'],
        explain: '`PRIu16` gibt den Wert ohne Vorzeichen aus – aus −5 wird eine grosse positive Zahl. Für `int16_t` ist `PRId16` richtig: `d` = mit Vorzeichen, `u` = ohne.' },
      { type: 'findBug',
        q: 'Bei −5 °C wird nicht „Kalt“ ausgegeben. Warum?',
        code: ['int32_t temperatur = -5;', 'uint32_t grenze = 10;', 'if (temperatur < grenze) {', '    printf("Kalt\\n");', '}'],
        bugLines: [1, 2],
        lineHint: 'Hier werden zwei Variablen mit unterschiedlichen Typen verglichen.',
        fixes: ['`int32_t grenze = 10;`', '`uint32_t temperatur = -5;`', '`if (temperatur <= grenze)`', '`if (grenze < temperatur)`'],
        fix: 0,
        explain: 'Beim Vergleich von `int32_t` mit `uint32_t` wird der Wert mit Vorzeichen (auf üblichen Plattformen) in einen ohne umgewandelt: −5 wird zu 4\'294\'967\'291 – und das ist nicht kleiner als 10. Lösung: beide mit Vorzeichen. Compiler warnen mit `-Wall -Wextra` (`-Wsign-compare`).' },
      { type: 'findBug',
        q: 'Ein Bild hat 50\'000 × 50\'000 Pixel. Die Fläche wird falsch ausgegeben, obwohl das Ergebnis in `int64_t` gespeichert wird. Welche Zeile?',
        code: ['#include <inttypes.h>', 'int32_t breite = 50000;', 'int32_t hoehe = 50000;', 'int64_t flaeche = breite * hoehe;', 'printf("%" PRId64 "\\n", flaeche);'],
        bugLines: [3],
        lineHint: 'Das Ziel ist gross genug – aber in welchem Typ wird die Multiplikation gerechnet?',
        fixes: ['`int64_t flaeche = (int64_t)breite * hoehe;`', '`int64_t flaeche = (int64_t)(breite * hoehe);`', '`int32_t flaeche = breite * hoehe;`', '`uint32_t flaeche = breite * hoehe;`'],
        fix: 0,
        why: [null, 'Die Klammer rechnet zuerst in 32 Bit – der Überlauf passiert vor der Umwandlung.', 'Dann ist das Ziel zu klein.', 'Die Multiplikation passiert trotzdem in `int32_t`.'],
        explain: '50\'000 × 50\'000 = 2\'500\'000\'000 > 2\'147\'483\'647. Die Multiplikation passiert in `int32_t` und läuft über (mit Vorzeichen: undefiniertes Verhalten), erst danach wird umgewandelt. Wird ein Operand vorher zu `int64_t`, rechnet C in 64 Bit.' },
      { type: 'findBug',
        q: 'Ein Countdown soll von 10 bis 0 zählen – er hört aber nie auf. Welche Zeile ist schuld?',
        code: ['#include <inttypes.h>', '', 'for (uint8_t i = 10; i >= 0; i--) {', '    printf("%" PRIu8 "\\n", i);', '}'],
        bugLines: [2],
        lineHint: 'Kann `i >= 0` bei diesem Typ jemals falsch werden?',
        fixes: ['`for (int8_t i = 10; i >= 0; i--)` (und `PRId8`)', '`for (uint16_t i = 10; i >= 0; i--)`', '`for (uint8_t i = 10; i >= 1; i--)`', '`for (uint8_t i = 10; i > 0; i++)`'],
        fix: 0,
        why: [null, 'Auch ein `uint16_t` ist nie negativ – gleiches Problem, nur mit 65\'535.', 'Dann endet die Schleife zwar, aber die 0 wird nicht mehr ausgegeben.', 'Jetzt zählt die Schleife aufwärts.'],
        explain: 'Ein `uint8_t` ist immer ≥ 0, die Bedingung ist also immer wahr. Nach 0 speichert `i--` den Wert −1 zurück in den `uint8_t` – heraus kommt 255 (Unterlauf). Mit `int8_t` wird `i` nach 0 zu −1 und die Schleife endet.' }
    ]
  },
  /* ------------------------------------------------------------ 8 */
  {
    id: 'structs',
    title: 'Structs & Padding',
    desc: 'Felder geschickt anordnen – Füllbytes vermeiden.',
    intro: [
      { p: 'Ein struct fasst mehrere Felder zusammen. Der Prozessor liest Werte am schnellsten, wenn sie „ausgerichtet“ sind (Alignment). Auf üblichen Plattformen gilt: Die Ausrichtung eines Typs ist gleich seiner Grösse. Daraus folgen zwei Regeln:' },
      { ol: [
        'Jedes Feld beginnt an einem Offset, der ein Vielfaches seiner Grösse ist (`uint8_t`: 1, `uint16_t`: 2, `uint32_t`/`float32_t`: 4, `uint64_t`/`float64_t`: 8). Passt das nicht, fügt der Compiler Füllbytes (Padding) ein.',
        'Die Gesamtgrösse wird auf ein Vielfaches des grössten Feldes aufgerundet – damit auch Arrays aus diesem struct korrekt ausgerichtet sind.'
      ] },
      { code: 'struct Bsp {\n    uint8_t  a;   // Offset 0, danach 3 Füllbytes\n    uint32_t b;   // Offset 4\n};                // sizeof = 8 statt 5' },
      { ul: [
        'Faustregel: Felder nach Grösse sortieren, die grössten zuerst. So entsteht am wenigsten Padding.',
        'Ein Array aus structs braucht Anzahl × `sizeof(struct)` – inklusive Füllbytes.'
      ] },
      { tip: 'Offset für Offset durchgehen: Passt das nächste Feld hier hin? Wenn nicht, auffüllen. Am Ende aufrunden.' }
    ],
    fact: {
      title: 'Boeing 787: Neustart alle 248 Tage',
      text: '2015 warnte die US-Luftfahrtbehörde FAA: Die Generator-Steuerung der Boeing 787 zählte Hundertstelsekunden in einem 32-Bit-Zähler mit Vorzeichen. Nach 2³¹ Hundertstelsekunden – ziemlich genau 248 Tage – wäre er übergelaufen und die Stromversorgung hätte abschalten können. Bis zum Update mussten die Flugzeuge regelmässig neu gestartet werden.'
    },
    tasks: [
      { type: 'choice',
        q: 'Warum fügt der Compiler in structs Füllbytes (Padding) ein?',
        options: ['Damit jedes Feld an einer passend ausgerichteten Adresse liegt und der Prozessor schnell (oder überhaupt) darauf zugreifen kann',
                  'Als Platz für spätere Felder',
                  'Zur Verschlüsselung',
                  'Das ist ein Compilerfehler'],
        answer: 0,
        explain: 'Viele Prozessoren lesen z.B. einen `uint32_t` am schnellsten (manche nur) von einer durch 4 teilbaren Adresse. Darum richtet der Compiler jedes Feld auf seine Grösse aus.' },
      { type: 'number',
        q: 'Wie gross ist diese struct?',
        code: 'struct A {\n    uint8_t  c;\n    uint16_t s;\n    uint8_t  d;\n};\nprintf("%zu\\n", sizeof(struct A));',
        answer: '6', unit: 'Bytes',
        hint: 'c an 0, dann muss s an eine gerade Adresse. Am Ende auf ein Vielfaches von 2 aufrunden.',
        explain: 'c: Byte 0, 1 Füllbyte, s: Bytes 2–3, d: Byte 4, dann 1 Füllbyte am Ende (Grösse muss Vielfaches von 2 sein) = 6 Byte. Nutzdaten sind nur 4 Byte.' },
      { type: 'number',
        q: 'Wie gross ist diese struct?',
        code: 'struct B {\n    uint8_t   a;\n    float32_t b;\n    uint8_t   c;\n};\nprintf("%zu\\n", sizeof(struct B));',
        answer: '12', unit: 'Bytes',
        hint: 'b muss an einem Vielfachen von 4 beginnen. Am Ende auf ein Vielfaches von 4 aufrunden.',
        explain: 'a: Byte 0, 3 Füllbytes, b: Bytes 4–7, c: Byte 8, dann 3 Füllbytes bis 12. Sortiert (b, a, c) wären es nur 8 Byte.' },
      { type: 'structOrder',
        q: 'Ordne die Felder so an, dass `sizeof(struct Spieler)` möglichst klein wird.',
        name: 'Spieler',
        fields: [{ type: 'uint8_t', name: 'team' }, { type: 'int32_t', name: 'punkte' }, { type: 'uint8_t', name: 'level' }],
        explain: 'Faustregel: grosse Felder zuerst, kleine zuletzt. `int32_t` an Offset 0, die beiden `uint8_t` an 4 und 5, dann 2 Byte Padding bis 8. Vorher waren es 12 Byte.' },
      { type: 'structOrder',
        q: 'Ein Messwert-Datensatz eines Sensors. Mach die struct so klein wie möglich.',
        name: 'Messung',
        fields: [{ type: 'uint8_t', name: 'kanal' }, { type: 'float64_t', name: 'wert' }, { type: 'uint8_t', name: 'einheit' }, { type: 'uint32_t', name: 'zeit' }],
        explain: '`float64_t` (8) + `uint32_t` (4) + 2 × `uint8_t` (2) = 14, aufgerundet auf ein Vielfaches von 8 → 16 Byte statt 24.' },
      { type: 'structOrder',
        q: 'Ein Datenpaket aus einem Mikrocontroller mit 2 KB RAM – hier zählt jedes Byte!',
        name: 'Paket',
        fields: [{ type: 'uint8_t', name: 'id' }, { type: 'float64_t', name: 'wert' }, { type: 'uint16_t', name: 'status' }, { type: 'uint32_t', name: 'zeitstempel' }, { type: 'uint8_t', name: 'flags' }],
        explain: 'Sortiert nach Grösse: 8 + 4 + 2 + 1 + 1 = 16 Byte, kein einziges Füllbyte. Die ursprüngliche Reihenfolge brauchte 32 Byte – doppelt so viel.' },
      { type: 'number',
        q: 'Wie viel Speicher braucht ein Array von 1000 dieser structs?',
        code: 'struct Punkt {\n    float64_t x;\n    int32_t   farbe;\n    uint8_t   sichtbar;\n};\nstruct Punkt punkte[1000];',
        answer: '16000', unit: 'Bytes',
        hint: 'Erst sizeof(struct Punkt) bestimmen (aufrunden auf Vielfaches von 8!), dann × 1000.',
        explain: '8 + 4 + 1 = 13 Byte Nutzdaten, aufgerundet auf ein Vielfaches von 8 → 16 Byte. 1000 × 16 = 16\'000 Byte. Die 3 Byte Padding pro Element kosten insgesamt 3000 Byte.' },
      { type: 'number',
        q: 'Ein Mikrocontroller hat 2048 Bytes frei. Wie viele Elemente dieser struct passen in ein Array?',
        code: 'struct Messpunkt {\n    uint16_t wert;\n    uint8_t  kanal;\n};',
        answer: '512', unit: 'Elemente',
        hint: 'sizeof: 2 + 1 = 3, aber aufgerundet auf ein Vielfaches von 2.',
        explain: 'sizeof = 4 (2 + 1 + 1 Füllbyte). 2048 ÷ 4 = 512. Ohne Padding wären es 682 – Padding kann richtig ins Gewicht fallen.' }
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
        'Zweierkomplement: Das oberste Bit zählt negativ (bei 8 Bit −128).',
        'Kommazahlen: `float32_t` (4 Byte, sicher 6 Stellen), `float64_t` (8 Byte, sicher 15 Stellen). Ganzzahl / Ganzzahl bleibt ganzzahlig. Geld in Rappen.',
        'Typ wählen: Bereich bestimmen → negativ? → Komma? → kleinster passender Typ.',
        'printf: `"%" PRIuN` ohne Vorzeichen, `"%" PRIdN` mit Vorzeichen, `%f` Kommazahlen, `%zu` sizeof.',
        'Überlauf: Auch Zwischenergebnisse müssen in den Typ passen.',
        'Structs: Felder auf ihre Grösse ausrichten, grösste zuerst, Gesamtgrösse auf Vielfaches des grössten Feldes aufrunden.'
      ] },
      { tip: 'Lies jede Aufgabe genau: Welcher Typ, wie viele Bits, mit oder ohne Vorzeichen? Viel Erfolg!' }
    ],
    tasks: [
      { type: 'yesno',
        q: 'Passt der Wert 300 in einen `uint8_t`?',
        answer: false,
        explain: '`uint8_t` geht nur bis 255. Gespeichert würde 300 − 256 = 44.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `int16_t`?',
        answer: '32767',
        explain: '2¹⁵ − 1 = 32\'767.' },
      { type: 'choice',
        q: 'Mit welcher Formatangabe gibt man einen `uint64_t` mit printf aus?',
        options: ['`"%" PRId64`', '`"%" PRIu32`', '`"%" PRIu64`', '`%f`'],
        answer: 2,
        why: ['`d` steht für mit Vorzeichen – `uint64_t` hat keins.', 'Falsche Bitzahl: Das wäre für `uint32_t`.', null, '`%f` ist für Kommazahlen.'],
        explain: '`u` = ohne Vorzeichen, `64` = Bits. Also `printf("%" PRIu64 "\\n", x);` mit `#include <inttypes.h>`.' },
      { type: 'bits', bits: 8, mode: 'mitVZ', target: -100,
        q: 'Stelle −100 als `int8_t` ein.',
        explain: '−100 = −128 + 28 = −128 + 16 + 8 + 4 → `10011100`. Als `uint8_t` gelesen wären dieselben Bits 156 (= 256 − 100).' },
      { type: 'pickType',
        q: 'Anzahl belegter Sitzplätze in einem Stadion: 0 bis 60\'000.',
        code: '____ zuschauer = 0;',
        min: '0', max: '60000',
        options: ['int16_t', 'uint16_t', 'int32_t', 'uint64_t'],
        explain: '60\'000 passt nicht in `int16_t` (max. 32\'767), aber in `uint16_t` (max. 65\'535) – 2 Byte.' },
      { type: 'choice',
        q: 'Welchen Wert hat `x` nach dieser Zeile?',
        code: '#include "types.h"\nfloat32_t x = 7 / 2;',
        options: ['3.5', '3.0', '4.0', '7.2'],
        answer: 1,
        why: ['Leider nicht: 7 und 2 sind beide Ganzzahlen.', null, 'Es wird nicht gerundet.', 'Nein, `/` ist eine Division.'],
        explain: '`7 / 2` ist eine Ganzzahldivision und ergibt 3. Erst dann wird 3 in 3.0 umgewandelt. Für 3.5 schreibt man `7.0f / 2`.' },
      { type: 'findBug',
        q: 'Die Sekunden pro Woche werden falsch berechnet. Welche Zeile ist der Ursprung?',
        code: ['#include <stdint.h>', 'uint16_t sekunden_pro_tag = 24 * 60 * 60;', 'uint16_t tage = 7;', 'uint32_t sekunden_pro_woche = sekunden_pro_tag * tage;'],
        bugLines: [1],
        lineHint: 'Rechne 24 × 60 × 60 aus und vergleiche mit dem Wertebereich.',
        fixes: ['`uint32_t sekunden_pro_tag = 24 * 60 * 60;`', '`uint8_t sekunden_pro_tag = 24 * 60 * 60;`', '`int16_t sekunden_pro_tag = 24 * 60 * 60;`', '`uint16_t sekunden_pro_tag = 86400;`'],
        fix: 0,
        explain: '24 × 60 × 60 = 86\'400 > 65\'535. In `uint16_t` wird daraus 86\'400 − 65\'536 = 20\'864. Mit `uint32_t` passt es.' },
      { type: 'structOrder',
        q: 'Spielfigur-Datensatz: Mach die struct so klein wie möglich.',
        name: 'Figur',
        fields: [{ type: 'uint8_t', name: 'aktiv' }, { type: 'int64_t', name: 'id' }, { type: 'uint16_t', name: 'level' }, { type: 'uint8_t', name: 'sichtbar' }],
        explain: '`int64_t` (8) + `uint16_t` (2) + 2 × `uint8_t` (2) = 12 → aufgerundet auf 16 Byte. Ursprünglich: 24 Byte.' },
      { type: 'number',
        q: 'Wie viele Bytes belegt dieses Array?',
        code: '#include <stdint.h>\nuint32_t tabelle[256];',
        answer: '1024', unit: 'Bytes',
        explain: '256 × 4 Byte = 1024 Byte = 1 KiB.' }
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
  { min: 0.55, name: 'Speicher-Profi' },
  { min: 0.8,  name: 'Padding-Meister' },
  { min: 1,    name: 'C-Legende' }
];

/* Sprueche von Bit, dem Maskottchen. Du-Form, Schweizer Schreibweise. */
var BIT_SAYS = {
  right: [
    'Richtig. Sauber gelöst.',
    'Genau so. Der Compiler wäre stolz.',
    'Treffer. Kein einziges Bit verschwendet.',
    'Passt. Weiter im Takt.',
    'Korrekt – das sitzt.',
    'Ja! Das hättest du auch in Assembler gewusst.',
    'Stimmt. Ich hab nichts anderes erwartet.',
    'Richtig. Notier dir das ruhig als Erfolg.',
    'Volltreffer. Null Fehler, null Drama.',
    'Bingo. Dein Speicher ist gut organisiert.'
  ],
  wrong: [
    'Ups, nicht ganz. Nochmal?',
    'Knapp daneben. Das passiert den Besten.',
    'Noch nicht. Schau nochmal genau hin.',
    'Fast. Ein Bit fehlt noch zum Glück.',
    'Nope – aber jetzt weisst du schon, was es nicht ist.',
    'Daneben. Kein Problem, neuer Versuch.',
    'Hm, das passt nicht ganz. Der Tipp hilft.',
    'Nicht ganz. Fehler sind hier gratis.',
    'Leider nein. Atme kurz durch, dann nochmal.'
  ],
  meh: 'Funktioniert – aber nicht optimal.',
  retryRight: ' Drangeblieben lohnt sich.',
  streak: {
    3: '3 in Folge! Du bist warmgelaufen.',
    5: '5 in Folge! Langsam wird es unheimlich.',
    8: '8 in Folge! Das ist kein Glück mehr, das ist Können.'
  },
  home: [
    'Hoi! Ich bin Bit. Ich bestehe aus genau einem Bit Geduld – und die reicht für dich.',
    'Bereit? Ein Level nach dem anderen, ohne Stress.',
    'Ich bin ein Mikrochip, aber ich mag Menschen, die Typen mit fester Grösse wählen.'
  ],
  back: [
    'Da bist du ja wieder. Weiter geht\'s!',
    'Schön, dich zu sehen. Dein Fortschritt hat auf dich gewartet.',
    'Willkommen zurück. Ich hab deine Bits gut aufbewahrt.'
  ],
  allDone: 'Alles geschafft. Ab jetzt bist du offiziell gefährlich gut in C-Typen.',
  intro: [
    'Kurz lesen, dann loslegen. Du kannst das Info später jederzeit wieder öffnen.',
    'Erst die Theorie, dann die Praxis. Kurz und schmerzlos.',
    'Lies das in Ruhe – die Aufgaben laufen dir nicht davon.'
  ],
  done: [
    'Level geschafft! Ich mach einen kleinen Freudensprung.',
    'Erledigt! Das kommt in die Chronik.',
    'Abgehakt. Du wirst gerade richtig gut.'
  ],
  play: 'Hier kannst du nichts kaputt machen. Ausser den Wertebereich.',
  rankUp: 'Neuer Rang!'
};

/* Sprueche, wenn man Bit anstupst. Du-Form, Schweizer Schreibweise. */
var BIT_POKE = [
  'Hey, das kitzelt! Zum Glück bin ich gegen Bitflips versiegelt.',
  'Wusstest du? Ein Byte hat 8 Bit – ich bin also nur ein Achtel davon.',
  '`uint8_t` geht von 0 bis 255. Mehr Finger hab ich leider nicht.',
  '`int32_t` schafft gut 2 Milliarden. Ich zähle trotzdem lieber bis 1.',
  'Mit `int64_t` könntest du jede Sekunde seit dem Urknall zählen. Und noch viel mehr.',
  'Ein Nibble sind 4 Bit. Klingt nach Znüni, ist aber ein halbes Byte.',
  'Wenn ein `uint8_t` bei 255 noch eins drauflegt, fängt er wieder bei 0 an. Kreislauf des Lebens.',
  'Signed oder unsigned? Ich bin heute eher positiv eingestellt.',
  'Psst: `sizeof(char)` ist immer 1. Das ist mein Lieblingsfakt.',
  'Ich bin ganz Ohr. Also, ganz Pin.'
];
