/* Aufgabendaten fuer "C-Variablentypen lernen".
 * Alles hier sind reine Daten. Neue Aufgaben einfach in ein tasks-Array einfuegen.
 *
 * Aufgabentypen (Feld "type"):
 *  choice      { q, code?, options:[..], answer:index, why?:[..pro Option], hint?, explain }
 *  yesno       { q, code?, answer:true|false, hint?, explain }
 *  number      { q, code?, answer:"Zahl als String", unit?, hint?, explain }
 *  bits        { q, bits:8|16, mode:"unsigned"|"signed", target:Zahl, explain }
 *  pickType    { q, code (mit ____), min:"..", max:"..", decimals?:bool, digits?:Zahl,
 *                sample?:"21.5", options:[Typnamen], notes?:{Typ:"Text"}, explain }
 *              -> richtig ist jeder passende Typ mit der kleinsten Byte-Anzahl.
 *  findBug     { q, code:[Zeilen], bugLines:[Indizes], lineHint?, fixes:[..], fix:index, explain }
 *  structOrder { q, name, fields:[{type,name}], explain } -> Ziel: kleinstes sizeof
 *
 * Info-Seite vor jedem Level (Feld "intro" im Level): Liste von Bausteinen, der Reihe nach angezeigt:
 *  { p: 'Absatz' }   { ul: ['Punkt', ..] }   { ol: ['Schritt', ..] }
 *  { table: { head: ['Spalte', ..], rows: [['Zelle', ..], ..] } }
 *  { code: 'C-Code mit \n' }   { tip: 'Merksatz' }
 *
 * Inline-Code in Texten mit `Backticks` markieren (wird sicher als <code> dargestellt).
 */

/* Referenzplattform: Windows/Linux x86-64 (ohne long, das ist plattformabhaengig). */
var TYPE_INFO = {
  'char':               { bytes: 1, kind: 'int', signed: true },
  'signed char':        { bytes: 1, kind: 'int', signed: true },
  'unsigned char':      { bytes: 1, kind: 'int', signed: false },
  'short':              { bytes: 2, kind: 'int', signed: true },
  'unsigned short':     { bytes: 2, kind: 'int', signed: false },
  'int':                { bytes: 4, kind: 'int', signed: true },
  'unsigned int':       { bytes: 4, kind: 'int', signed: false },
  'long long':          { bytes: 8, kind: 'int', signed: true },
  'unsigned long long': { bytes: 8, kind: 'int', signed: false },
  'float':              { bytes: 4, kind: 'float', digits: 6 },
  'double':             { bytes: 8, kind: 'float', digits: 15 },
  'bool':               { bytes: 1, kind: 'bool' },
  'int8_t':   { bytes: 1, kind: 'int', signed: true },
  'uint8_t':  { bytes: 1, kind: 'int', signed: false },
  'int16_t':  { bytes: 2, kind: 'int', signed: true },
  'uint16_t': { bytes: 2, kind: 'int', signed: false },
  'int32_t':  { bytes: 4, kind: 'int', signed: true },
  'uint32_t': { bytes: 4, kind: 'int', signed: false },
  'int64_t':  { bytes: 8, kind: 'int', signed: true },
  'uint64_t': { bytes: 8, kind: 'int', signed: false }
};

/* Zeilen des Spickzettels. range wird fuer Ganzzahltypen automatisch berechnet. */
var CHEAT_ROWS = [
  { type: 'char', fmt: '%c (Zeichen) / %hhd', note: 'Vorzeichen ist plattformabhängig (meist signed)' },
  { type: 'unsigned char', fmt: '%hhu' },
  { type: 'short', fmt: '%hd' },
  { type: 'unsigned short', fmt: '%hu' },
  { type: 'int', fmt: '%d' },
  { type: 'unsigned int', fmt: '%u' },
  { type: 'long', bytesText: '4 (Windows) / 8 (64-bit Linux)', rangeText: 'plattformabhängig!', fmt: '%ld' },
  { type: 'long long', fmt: '%lld' },
  { type: 'unsigned long long', fmt: '%llu' },
  { type: 'float', rangeText: 'ca. ±3.4·10³⁸, ca. 6–7 signifikante Stellen', fmt: '%f' },
  { type: 'double', rangeText: 'ca. ±1.7·10³⁰⁸, ca. 15–16 signifikante Stellen', fmt: '%f (oder %lf)' },
  { type: 'bool', rangeText: 'false (0) / true (1) – braucht <stdbool.h>', fmt: '%d' },
  { type: 'int8_t', fmt: '%" PRId8 " (≈ %hhd)' },
  { type: 'uint8_t', fmt: '%" PRIu8 " (≈ %hhu)' },
  { type: 'int16_t', fmt: '%" PRId16 " (≈ %hd)' },
  { type: 'uint16_t', fmt: '%" PRIu16 " (≈ %hu)' },
  { type: 'int32_t', fmt: '%" PRId32 " (≈ %d)' },
  { type: 'uint32_t', fmt: '%" PRIu32 " (≈ %u)' },
  { type: 'int64_t', fmt: '%" PRId64 " (≈ %lld)' },
  { type: 'uint64_t', fmt: '%" PRIu64 " (≈ %llu)' }
];

var LEVELS = [
  /* ------------------------------------------------------------ 1 */
  {
    id: 'grundlagen',
    title: 'Grundlagen',
    desc: 'Was ist ein Typ? Ganzzahl, Kommazahl, Zeichen.',
    intro: [
      { p: 'Jede Variable in C hat einen Datentyp. Er legt fest, wie viele Bytes die Variable im Speicher belegt und wie die Bits darin gelesen werden: als Ganzzahl, Kommazahl oder Zeichen.' },
      { table: { head: ['Typ', 'Wofür?', 'Beispiel'], rows: [
        ['`int`', 'ganze Zahlen ohne Komma', '`42`, `-7`'],
        ['`float` / `double`', 'Kommazahlen (Punkt statt Komma!)', '`21.5`'],
        ['`char`', 'ein einzelnes Zeichen', '`\'A\'`'],
        ['`bool`', 'wahr oder falsch, braucht `<stdbool.h>`', '`true`, `false`']
      ] } },
      { ul: [
        'Ein `char` ist intern eine kleine Ganzzahl: der Zeichencode (ASCII).',
        'Einfache Anführungszeichen wie `\'A\'` = ein Zeichen. Doppelte wie `"A"` = ein String (Zeichenkette); der hat hinten noch ein unsichtbares Endzeichen `\'\\0\'`.',
        'Speicherst du eine Kommazahl in einem Ganzzahltyp, werden die Nachkommastellen abgeschnitten – nicht gerundet.'
      ] },
      { tip: 'Ganze Werte → Ganzzahltyp. Werte mit Komma → `float`/`double`. Ein Zeichen → `char`. Ja/Nein → `bool`.' }
    ],
    fact: {
      title: 'Ein Zeichen ist eigentlich eine Zahl',
      text: 'Für den Computer ist `\'A\'` einfach die Zahl 65 (ASCII-Code). Darum ergibt `\'A\' + 1` das Zeichen `\'B\'` und `\'a\' - \'A\'` ist 32 – mit diesem Trick wandeln viele Programme Gross- in Kleinbuchstaben um.'
    },
    tasks: [
      { type: 'choice',
        q: 'Was legt der Datentyp einer Variablen in C fest?',
        options: ['Wie viel Speicher sie belegt und wie die Bits darin gedeutet werden',
                  'Nur den Namen der Variablen',
                  'In welcher Zeile die Variable stehen muss',
                  'Die Farbe im Code-Editor'],
        answer: 0,
        explain: 'Der Typ sagt dem Compiler zwei Dinge: wie viele Bytes reserviert werden und ob die Bits als Ganzzahl, Kommazahl oder Zeichen zu lesen sind. Dieselben 8 Bits `11111111` sind z.B. 255 als `unsigned char`, aber -1 als `signed char`.' },
      { type: 'choice',
        q: 'Ein Spiel speichert die Lebenspunkte einer Spielfigur, z.B. 100. Lebenspunkte haben nie Nachkommastellen. Welche Art von Typ passt?',
        options: ['Ganzzahl (`int`)', 'Kommazahl (`double`)', 'Zeichen (`char`)'],
        answer: 0,
        why: [null, 'Eine Kommazahl geht zwar, ist aber unnötig: Lebenspunkte haben keine Nachkommastellen.', 'Ein `char` ist für einzelne Zeichen gedacht wie \'A\'.'],
        explain: 'Ganze Werte ohne Komma speichert man in Ganzzahltypen wie `int`. Die sind exakt, schnell und brauchen keine Rundung.' },
      { type: 'choice',
        q: 'Ein Temperatursensor misst 21.5 °C. Welcher Typ kann diesen Wert inklusive Nachkommastelle speichern?',
        options: ['`int`', '`double`', '`char`'],
        answer: 1,
        why: ['Ein `int` würde die .5 einfach abschneiden – es bliebe 21.', null, 'Ein `char` speichert ein Zeichen bzw. eine kleine Ganzzahl.'],
        explain: 'Kommazahlen (Gleitkommazahlen) speichert man in `float` oder `double`. In C schreibt man das Komma als Punkt: `21.5`.' },
      { type: 'choice',
        q: 'Welcher Typ ist für ein einzelnes Zeichen wie den Buchstaben `\'A\'` gedacht?',
        options: ['`double`', '`int`', '`char`', '`bool`'],
        answer: 2,
        explain: '`char` (von engl. character = Zeichen) belegt genau 1 Byte und speichert ein Zeichen. Einzelne Zeichen schreibt man in einfachen Anführungszeichen: `\'A\'`.' },
      { type: 'choice',
        q: 'Was steht nach dieser Zeile in `n`?',
        code: 'int n = 7.9;',
        options: ['7.9', '8', '7', 'Der Compiler verweigert das Programm immer'],
        answer: 2,
        why: ['Ein `int` kann keine Nachkommastellen speichern.', 'Es wird nicht gerundet!', null, 'Die meisten Compiler warnen höchstens – das Programm läuft.'],
        explain: 'Bei der Umwandlung einer Kommazahl in einen Ganzzahltyp werden die Nachkommastellen abgeschnitten (Richtung 0), nicht gerundet. Aus 7.9 wird 7, aus -7.9 wird -7.' },
      { type: 'yesno',
        q: '`\'A\'` und `"A"` sind in C dasselbe.',
        answer: false,
        explain: '`\'A\'` ist ein einzelnes Zeichen (1 Byte, Wert 65). `"A"` ist ein String: eine Zeichenkette aus `\'A\'` und dem Endzeichen `\'\\0\'` – also 2 Bytes.' },
      { type: 'choice',
        q: 'Was ist ein `char` intern im Speicher?',
        options: ['Ein kleines Bild des Buchstabens', 'Eine kleine Ganzzahl (der Zeichencode, z.B. ASCII)', 'Ein Text beliebiger Länge', 'Eine Kommazahl'],
        answer: 1,
        explain: 'Ein `char` ist eine 1-Byte-Ganzzahl. `\'A\'` hat den ASCII-Code 65, `\'0\'` den Code 48. Mit `printf("%d", \'A\')` siehst du die Zahl, mit `%c` das Zeichen.' },
      { type: 'choice',
        q: 'Ein Lichtschalter ist entweder an oder aus. Welcher Typ beschreibt das am klarsten?',
        options: ['`double`', '`bool` (aus `<stdbool.h>`)', '`char`'],
        answer: 1,
        explain: '`bool` kennt nur `true` (1) und `false` (0). Er braucht `#include <stdbool.h>` (bis C17) und belegt auf der Referenzplattform 1 Byte.' }
    ]
  },
  /* ------------------------------------------------------------ 2 */
  {
    id: 'speicher',
    title: 'Speicherbedarf',
    desc: 'Wie viele Bytes und Bits braucht welcher Typ? sizeof verstehen.',
    intro: [
      { p: 'Speicher wird in Bytes gemessen. 1 Byte besteht aus 8 Bits, jedes Bit ist 0 oder 1. Also gilt: Bits = Bytes × 8.' },
      { table: { head: ['Typ', 'Bytes (Referenzplattform)'], rows: [
        ['`char`', '1'], ['`short`', '2'], ['`int`', '4'], ['`long long`', '8'],
        ['`float`', '4'], ['`double`', '8'],
        ['`long`', '4 unter Windows, 8 unter 64-bit Linux/macOS']
      ] } },
      { p: 'Mit `sizeof` fragst du den Compiler nach der Grösse in Bytes. Bei einem Array erhältst du die Grösse des ganzen Arrays: Anzahl Elemente × Grösse eines Elements. Ausgegeben wird `sizeof` mit `%zu`.' },
      { code: 'int zahlen[10];\nprintf("%zu\\n", sizeof(int));     // 4\nprintf("%zu\\n", sizeof(zahlen));  // 10 * 4 = 40' },
      { tip: 'Der C-Standard garantiert nur Mindestgrössen (z.B. `int` mind. 16 Bit, `long` mind. 32 Bit) und die Reihenfolge char ≤ short ≤ int ≤ long ≤ long long. Die Zahlen oben gelten für normale PCs.' }
    ],
    fact: {
      title: 'Zum Mond mit 4 KB',
      text: 'Der Apollo Guidance Computer, der 1969 Menschen zum Mond brachte, hatte nur 2048 Speicherwörter Arbeitsspeicher (rund 4 KB). Jedes Byte war kostbar – genau deshalb lohnt es sich, den passenden Typ zu wählen.'
    },
    tasks: [
      { type: 'number',
        q: 'Wie viele Bytes belegt ein `int` auf der Referenzplattform?',
        answer: '4', unit: 'Bytes',
        hint: 'Schau im Spickzettel nach.',
        explain: 'Ein `int` hat auf heutigen PCs (Windows und Linux) 4 Byte = 32 Bit. Der C-Standard garantiert aber nur mindestens 16 Bit – auf kleinen Mikrocontrollern (z.B. AVR/Arduino Uno) ist ein `int` tatsächlich nur 2 Byte gross.' },
      { type: 'number',
        q: 'Wie viele Bits hat ein Byte?',
        answer: '8', unit: 'Bits',
        explain: '1 Byte = 8 Bits. Jedes Bit ist 0 oder 1. Rechne also immer: Bits = Bytes × 8.' },
      { type: 'number',
        q: 'Wie viele Bits hat ein `short`?',
        answer: '16', unit: 'Bits',
        hint: 'Ein short hat 2 Bytes. Wie viele Bits sind das?',
        explain: '`short` = 2 Byte = 2 × 8 = 16 Bit.' },
      { type: 'choice',
        q: 'Was liefert `sizeof(double)` auf der Referenzplattform?',
        code: 'printf("%zu\\n", sizeof(double));',
        options: ['4', '8', '16', '2'],
        answer: 1,
        why: ['4 Byte hat ein `float`.', null, '16 wäre ein `long double` auf manchen Systemen.', '2 Byte hat ein `short`.'],
        explain: '`double` (doppelte Genauigkeit) belegt 8 Byte, `float` nur 4. `sizeof` liefert die Grösse in Bytes; das Ergebnis hat den Typ `size_t`, den man mit `%zu` ausgibt.' },
      { type: 'number',
        q: 'Ein Mikrocontroller hat 2 KB RAM (= 2048 Bytes). Wie viele `int`-Werte (4 Byte) passen rein rechnerisch hinein?',
        answer: '512', unit: 'Werte',
        explain: '2048 Bytes ÷ 4 Bytes = 512. In der Praxis sind es weniger, weil auch Stack und andere Variablen Platz brauchen. Mit `uint8_t` (1 Byte) wären es viermal so viele Werte.' },
      { type: 'number',
        q: 'Wie viele Bytes belegt dieses Array?',
        code: 'double messwerte[100];\nprintf("%zu\\n", sizeof(messwerte));',
        answer: '800', unit: 'Bytes',
        hint: 'Anzahl Elemente × Grösse eines double.',
        explain: '100 Elemente × 8 Byte = 800 Byte. `sizeof` auf ein Array liefert die Grösse des ganzen Arrays.' },
      { type: 'choice',
        q: 'Welche Aussage über den Typ `long` stimmt?',
        options: ['`long` hat immer 8 Byte',
                  '`long` hat immer 4 Byte',
                  'Plattformabhängig: 4 Byte unter Windows, 8 Byte unter 64-bit Linux/macOS',
                  '`long` ist eine Kommazahl'],
        answer: 2,
        explain: 'Genau deshalb ist `long` heikel: derselbe Code verhält sich unter Windows (4 Byte) und Linux (8 Byte) unterschiedlich. Wer eine bestimmte Grösse braucht, nimmt `int32_t` oder `int64_t` aus `<stdint.h>`.' },
      { type: 'choice',
        q: 'Was garantiert der C-Standard über die Grössen der Ganzzahltypen?',
        options: ['Exakte Grössen: int hat überall genau 4 Byte',
                  'Nur Mindestgrössen (z.B. int mind. 16 Bit, long mind. 32 Bit) und die Reihenfolge char ≤ short ≤ int ≤ long ≤ long long',
                  'Gar nichts',
                  'Dass alle Typen gleich gross sind'],
        answer: 1,
        explain: 'Der Standard legt nur Mindestwerte fest: char ≥ 8 Bit, short und int ≥ 16 Bit, long ≥ 32 Bit, long long ≥ 64 Bit. Exakte Grössen bekommst du mit `<stdint.h>` – dazu später ein ganzes Level.' }
    ]
  },
  /* ------------------------------------------------------------ 3 */
  {
    id: 'wertebereich',
    title: 'Wertebereich',
    desc: 'Min und Max, signed vs. unsigned, die Formel 2ⁿ.',
    intro: [
      { p: 'Jedes zusätzliche Bit verdoppelt die Anzahl möglicher Werte. Mit n Bits gibt es 2ⁿ verschiedene Werte. Wie diese verteilt werden, hängt davon ab, ob der Typ ein Vorzeichen hat:' },
      { table: { head: ['', 'kleinster Wert', 'grösster Wert'], rows: [
        ['unsigned (ohne Vorzeichen)', '0', '2ⁿ − 1'],
        ['signed (mit Vorzeichen)', '−2ⁿ⁻¹', '2ⁿ⁻¹ − 1']
      ] } },
      { p: 'Beispiel mit 4 Bits: 2⁴ = 16 Werte. Unsigned: 0 bis 15. Signed: −8 bis 7.' },
      { ul: [
        'Das „− 1“ beim Maximum kommt daher, dass die 0 auch einen Platz braucht.',
        'Signed hat darum einen negativen Wert mehr als positive.',
        'Ohne Vorzeichen ist der positive Bereich etwa doppelt so gross.',
        'Typen ohne Zusatz (`short`, `int`, `long long`) sind signed; mit `unsigned` davor gibt es keine negativen Werte.'
      ] },
      { tip: 'Bits des Typs bestimmen (Bytes × 8), dann Formel anwenden. Für grosse Typen hilft der Spickzettel.' }
    ],
    fact: {
      title: 'Gangnam Style sprengte den Zähler',
      text: 'Im Dezember 2014 näherte sich das Video „Gangnam Style“ 2\'147\'483\'647 Aufrufen – dem grössten Wert eines 32-bit `int`. YouTube stellte den Zähler darauf auf eine 64-bit-Zahl um (max. 9\'223\'372\'036\'854\'775\'807).'
    },
    tasks: [
      { type: 'choice',
        q: 'Wie viele verschiedene Werte kann man mit n Bits darstellen?',
        options: ['n', '2 · n', '2ⁿ', 'n²'],
        answer: 2,
        explain: 'Jedes Bit verdoppelt die Möglichkeiten: 1 Bit → 2, 2 Bits → 4, 8 Bits → 2⁸ = 256 Werte. Unsigned: 0 bis 2ⁿ − 1. Signed (Zweierkomplement): −2ⁿ⁻¹ bis 2ⁿ⁻¹ − 1.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `unsigned char` (8 Bit)?',
        answer: '255',
        hint: 'Formel: 2⁸ − 1',
        explain: '2⁸ − 1 = 256 − 1 = 255. Die −1 kommt daher, dass die 0 auch einen der 256 Werte belegt.' },
      { type: 'number',
        q: 'Was ist der kleinste Wert eines `signed char` (8 Bit)?',
        answer: '-128',
        hint: 'Formel: −2⁷',
        explain: 'Signed 8 Bit: −2⁷ = −128 bis 2⁷ − 1 = 127. Es gibt einen negativen Wert mehr als positive, weil die 0 bei den „positiven“ mitgezählt wird.' },
      { type: 'yesno',
        q: 'Passt der Wert 40000 in einen `short` (signed, 16 Bit)?',
        answer: false,
        explain: 'Ein `short` reicht von −32\'768 bis 32\'767. 40\'000 ist zu gross. Weil man das Vorzeichen-Bit „opfert“, ist der positive Bereich nur halb so gross wie bei unsigned.' },
      { type: 'yesno',
        q: 'Passt der Wert 40000 in einen `unsigned short` (16 Bit)?',
        answer: true,
        explain: '`unsigned short` reicht von 0 bis 65\'535 (2¹⁶ − 1). Ohne Vorzeichen steht der ganze Bereich für positive Zahlen zur Verfügung.' },
      { type: 'choice',
        q: 'Welches ist der grösste Wert eines `int` (32 Bit, signed)?',
        options: ['32\'767', '2\'147\'483\'647', '4\'294\'967\'295', '9\'223\'372\'036\'854\'775\'807'],
        answer: 1,
        why: ['Das ist das Maximum eines 16-bit `short`.', null, 'Das ist das Maximum eines `unsigned int`.', 'Das ist das Maximum eines 64-bit `long long`.'],
        explain: '2³¹ − 1 = 2\'147\'483\'647 (gut 2 Milliarden). Merkhilfe: signed int geht bis ca. ±2.1 Mrd., unsigned int bis ca. 4.29 Mrd.' },
      { type: 'yesno',
        q: 'Die Weltbevölkerung (über 8 Milliarden) passt in einen `unsigned int` (32 Bit).',
        answer: false,
        explain: '`unsigned int` geht nur bis 4\'294\'967\'295 (ca. 4.3 Mrd.). Für 8 Milliarden braucht man 64 Bit, z.B. `uint64_t` oder `long long`.' },
      { type: 'yesno',
        q: 'Ein Akkustand in Prozent (0 bis 100) passt in einen `unsigned char`.',
        answer: true,
        explain: '`unsigned char` deckt 0 bis 255 ab – 0..100 passt bequem. Sogar ein `signed char` (bis 127) würde reichen.' }
    ]
  },
  /* ------------------------------------------------------------ 4 */
  {
    id: 'bits',
    title: 'Speicher-Visualisierung',
    desc: 'Bits selbst umschalten: unsigned und Zweierkomplement live sehen.',
    intro: [
      { p: 'Jedes Bit hat eine Wertigkeit (Stellenwert). Ganz rechts steht 1, nach links verdoppelt sich der Wert. Der Zahlenwert ist die Summe aller Bits, die auf 1 stehen.' },
      { table: { head: ['Bit', '7', '6', '5', '4', '3', '2', '1', '0'], rows: [
        ['Wert', '128', '64', '32', '16', '8', '4', '2', '1'],
        ['Beispiel 6', '0', '0', '0', '0', '0', '1', '1', '0']
      ] } },
      { p: 'Bei 16 Bit geht es links weiter: 256, 512, 1024 … bis 2¹⁵ = 32768.' },
      { p: 'Signed Typen verwenden das Zweierkomplement: Das oberste Bit zählt negativ (bei 8 Bit −128 statt +128). Ist es 0, ist die Zahl positiv; ist es 1, ist sie negativ.' },
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
      { type: 'bits', bits: 8, mode: 'unsigned', target: 13,
        q: 'Warm-up: Stelle die Zahl 13 als `uint8_t` ein. Klicke dazu die Bits an.',
        explain: '13 = 8 + 4 + 1 → `00001101`. Jedes Bit hat eine Wertigkeit (128, 64, 32, 16, 8, 4, 2, 1); man addiert die eingeschalteten.' },
      { type: 'bits', bits: 8, mode: 'unsigned', target: 200,
        q: 'Ein Pixel hat den Rot-Wert 200. Stelle 200 als `uint8_t` ein.',
        explain: '200 = 128 + 64 + 8 → `11001000`. Farbwerte von 0..255 sind ein klassischer Fall für 8 Bit unsigned.' },
      { type: 'number',
        q: 'Was ist der grösste Wert, den man mit 8 Bits (unsigned) darstellen kann? Tipp: Probiere es auf der Spielwiese aus.',
        answer: '255',
        explain: 'Alle 8 Bits auf 1: 128+64+32+16+8+4+2+1 = 255 = 2⁸ − 1.' },
      { type: 'bits', bits: 8, mode: 'signed', target: -1,
        q: 'Stelle die Zahl −1 als `int8_t` (Zweierkomplement) ein.',
        explain: 'Im Zweierkomplement ist −1 = `11111111` – dieselben Bits, die unsigned 255 bedeuten. Das oberste Bit zählt bei signed −128: −128 + 127 = −1.' },
      { type: 'bits', bits: 8, mode: 'signed', target: 127,
        q: 'Stelle den grössten möglichen `int8_t`-Wert ein.',
        explain: '`01111111` = 127. Das oberste Bit (Vorzeichen-Bit) muss 0 bleiben – sobald es 1 ist, wird die Zahl negativ.' },
      { type: 'bits', bits: 8, mode: 'signed', target: -128,
        q: 'Und jetzt den kleinsten `int8_t`-Wert.',
        explain: '`10000000` = −128. Nur das Vorzeichen-Bit (Wert −128) ist gesetzt. Rechnet man 127 + 1 mit 8 Bit, landet man genau hier – das ist der typische Überlauf.' },
      { type: 'bits', bits: 16, mode: 'unsigned', target: 1000,
        q: 'Ein Schrittzähler zeigt 1000 Schritte. Stelle 1000 als `uint16_t` ein.',
        explain: '1000 = 512 + 256 + 128 + 64 + 32 + 8 → `00000011 11101000`. Mit 8 Bit (max. 255) ginge das nicht, darum braucht man hier 16 Bit.' },
      { type: 'bits', bits: 16, mode: 'signed', target: -2,
        q: 'Stelle −2 als `int16_t` ein.',
        explain: '−2 = `11111111 11111110`. Trick fürs Zweierkomplement: Bits von +2 (`…0010`) umkehren (`…1101`) und 1 addieren (`…1110`).' }
    ]
  },
  /* ------------------------------------------------------------ 5 */
  {
    id: 'stdint',
    title: 'stdint.h',
    desc: 'Typen mit exakter Grösse: uint8_t bis int64_t.',
    intro: [
      { p: 'Weil `int` oder `long` nicht überall gleich gross sind, gibt es in `<stdint.h>` Typen mit exakter Grösse. Sie sind auf jeder Plattform gleich – wichtig für Firmware, Dateiformate und Netzwerkprotokolle.' },
      { p: 'Der Name verrät alles: `u` am Anfang = unsigned (ohne Vorzeichen), die Zahl = Anzahl Bits, `_t` = „type“.' },
      { table: { head: ['signed', 'unsigned', 'Bits', 'Bytes', 'entspricht etwa'], rows: [
        ['`int8_t`', '`uint8_t`', '8', '1', '`signed char`'],
        ['`int16_t`', '`uint16_t`', '16', '2', '`short`'],
        ['`int32_t`', '`uint32_t`', '32', '4', '`int`'],
        ['`int64_t`', '`uint64_t`', '64', '8', '`long long`']
      ] } },
      { code: '#include <stdint.h>\n#include <inttypes.h>   // für PRIu16 usw.\n\nuint16_t port = 8080;\nprintf("%" PRIu16 "\\n", port);' },
      { tip: 'Bytes = Bits ÷ 8. Den Wertebereich berechnest du mit derselben Formel wie in Level 3. Achtung: Auch diese Typen können überlaufen.' }
    ],
    fact: {
      title: 'Das Jahr-2038-Problem',
      text: 'Viele Systeme zählen die Zeit in Sekunden seit dem 1.1.1970 in einem signed 32-bit-Wert. Am 19. Januar 2038 um 03:14:07 UTC ist 2\'147\'483\'647 erreicht – eine Sekunde später springt der Wert ins Negative und die Uhr zeigt plötzlich 1901. Moderne Systeme verwenden deshalb 64-bit-Zeit.'
    },
    tasks: [
      { type: 'choice',
        q: 'Was bedeuten das „u“ und die „8“ in `uint8_t`?',
        options: ['unsigned (ohne Vorzeichen), 8 Bit', 'universal, 8 Byte', 'unsigned, 8 Byte', 'user-defined, Version 8'],
        answer: 0,
        explain: '`uint8_t` = unsigned integer, 8 Bit, „_t“ für type. Also 0..255. `int8_t` (ohne u) ist signed: −128..127.' },
      { type: 'choice',
        q: 'Welche Zeile brauchst du, um `uint16_t` usw. zu verwenden?',
        options: ['`#include <stdio.h>`', '`#include <stdint.h>`', '`#include <math.h>`', '`#include <types>`'],
        answer: 1,
        explain: '`<stdint.h>` definiert die Typen mit fester Breite. Für die passenden printf-Makros wie `PRIu16` gibt es zusätzlich `<inttypes.h>` (die bindet stdint.h automatisch ein).' },
      { type: 'number',
        q: 'Wie viele Bytes belegt ein `int64_t`?',
        answer: '8', unit: 'Bytes',
        explain: 'Die Zahl im Namen sind Bits: 64 Bit ÷ 8 = 8 Byte – und zwar auf jeder Plattform.' },
      { type: 'choice',
        q: 'Welchem klassischen Typ entspricht `int16_t` auf der Referenzplattform?',
        options: ['`char`', '`short`', '`int`', '`long long`'],
        answer: 1,
        explain: '`short` hat auf der Referenzplattform 16 Bit, daher ist `int16_t` dort ein anderer Name für `short`. Entsprechend: `int8_t` ≈ `signed char`, `int32_t` ≈ `int`, `int64_t` ≈ `long long` (bzw. `long` unter Linux).' },
      { type: 'choice',
        q: 'Was ist der Wertebereich von `int32_t`?',
        options: ['0 bis 4\'294\'967\'295', '−2\'147\'483\'648 bis 2\'147\'483\'647', '−32\'768 bis 32\'767', '−2\'147\'483\'647 bis 2\'147\'483\'648'],
        answer: 1,
        why: ['Das ist `uint32_t` (unsigned).', null, 'Das ist `int16_t`.', 'Fast! Aber der negative Bereich ist um eins grösser, nicht der positive.'],
        explain: '−2³¹ bis 2³¹ − 1. Bei `int32_t` schreibt der Standard sogar Zweierkomplement vor, darum ist dieser Bereich exakt garantiert.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `uint16_t`?',
        answer: '65535',
        explain: '2¹⁶ − 1 = 65\'535. Typisch z.B. für Port-Nummern im Netzwerk (0..65535).' },
      { type: 'number',
        q: 'Profi-Frage: Was ist der grösste Wert eines `uint64_t`? (Ohne Trennzeichen oder mit \' eingeben.)',
        answer: '18446744073709551615',
        hint: '2⁶⁴ − 1. Die Zahl hat 20 Stellen und beginnt mit 18446…',
        explain: '2⁶⁴ − 1 = 18\'446\'744\'073\'709\'551\'615 (gut 18 Trillionen). Ausgabe mit `printf("%" PRIu64, x)`.' },
      { type: 'choice',
        q: 'Warum verwendet man `<stdint.h>`-Typen, z.B. in Firmware, Dateiformaten oder Netzwerkprotokollen?',
        options: ['Weil sie schneller tippen lassen',
                  'Weil sie auf jeder Plattform exakt gleich gross sind – im Gegensatz zu int oder long',
                  'Weil klassische Typen verboten sind',
                  'Weil sie automatisch Überläufe verhindern'],
        answer: 1,
        why: [null, null, 'Klassische Typen sind völlig erlaubt.', 'Nein, auch ein uint8_t läuft bei 255 + 1 über.'],
        explain: 'Wenn ein Dateiformat sagt „4 Byte Länge“, muss das Programm unter Windows, Linux und auf dem Mikrocontroller dieselben 4 Byte lesen. `uint32_t` garantiert das, `int` oder `long` nicht.' }
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
        'Negativ? Wenn ja, brauchst du einen signed Typ (`int…_t`), sonst reicht unsigned (`uint…_t`).',
        'Komma? Mit Nachkommastellen brauchst du `float` (4 Byte, ca. 6–7 signifikante Stellen) oder `double` (8 Byte, ca. 15–16 Stellen).',
        'Kleinsten Typ nehmen, bei dem Minimum und Maximum beide in den Wertebereich passen.'
      ] },
      { table: { head: ['Typ', 'Bereich'], rows: [
        ['`uint8_t` / `int8_t`', '0 … 255 / −128 … 127'],
        ['`uint16_t` / `int16_t`', '0 … 65\'535 / −32\'768 … 32\'767'],
        ['`uint32_t` / `int32_t`', '0 … ca. 4.29 Mrd. / ca. ±2.1 Mrd.'],
        ['`uint64_t` / `int64_t`', 'riesig (ca. 1.8·10¹⁹ / ±9.2·10¹⁸)']
      ] } },
      { tip: 'Signifikante Stellen = alle Ziffern ohne führende Nullen, vor und nach dem Komma. Geld speichert man als Ganzzahl in Rappen, nicht als Kommazahl.' }
    ],
    fact: {
      title: 'Ariane 5: 370 Millionen Dollar Überlauf',
      text: 'Am 4. Juni 1996 zerstörte sich die Rakete Ariane 5 rund 37 Sekunden nach dem Start. Ursache: Eine 64-bit-Kommazahl (horizontale Geschwindigkeit) wurde in eine 16-bit-signed-Ganzzahl umgewandelt. Der Wert war grösser als 32\'767 – der Überlauf brachte das Steuersystem zum Absturz.'
    },
    tasks: [
      { type: 'pickType',
        q: 'Das Alter einer Person in ganzen Jahren. Werte von 0 bis 150, nie negativ.',
        code: '____ alter = 42;',
        min: '0', max: '150',
        options: ['int8_t', 'uint8_t', 'uint16_t', 'int32_t'],
        explain: '`uint8_t` deckt 0..255 ab und braucht nur 1 Byte. `int8_t` reicht nur bis 127 – 150 würde überlaufen.' },
      { type: 'pickType',
        q: 'Ein Temperatursensor liefert ganze Grad Celsius von −40 bis +85 °C.',
        code: '____ temperatur = -12;',
        min: '-40', max: '85',
        options: ['uint8_t', 'int8_t', 'int16_t', 'int32_t'],
        explain: '`int8_t` (−128..127) deckt −40..85 ab, mit nur 1 Byte. Ein unsigned Typ kann keine negativen Werte speichern.' },
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
        options: ['int32_t', 'uint32_t', 'uint64_t', 'int64_t'],
        explain: 'Negative Werte → signed. 5 Mrd. sprengt 32 Bit → `int64_t`. Geld in der kleinsten Einheit als Ganzzahl zu speichern ist die übliche Lösung gegen Rundungsfehler.' },
      { type: 'pickType',
        q: 'Raumtemperatur mit einer Nachkommastelle, z.B. 21.5 °C, von −40.0 bis 85.0. Es reichen 4 signifikante Stellen.',
        code: '____ raumtemp = 21.5;',
        min: '-40', max: '85', decimals: true, digits: 4, sample: '21.5',
        options: ['int16_t', 'float', 'double', 'int32_t'],
        explain: 'Für Kommazahlen braucht man `float` oder `double`. 4 Stellen schafft `float` (ca. 6–7 Stellen) problemlos – mit halbem Speicher von `double`.' },
      { type: 'pickType',
        q: 'Eine GPS-Koordinate mit 8 Nachkommastellen, z.B. 47.37691234 (10 signifikante Stellen), Bereich −180 bis 180.',
        code: '____ laengengrad = 8.54169812;',
        min: '-180', max: '180', decimals: true, digits: 10, sample: '47.37691234',
        options: ['float', 'double', 'int32_t'],
        notes: { 'float': '`float` hat nur ca. 6–7 signifikante Stellen: aus 47.37691234 würde ungefähr 47.37691 – die Position wäre um bis zu ca. 1 m daneben.' },
        explain: '10 signifikante Stellen sind zu viel für `float`. `double` schafft ca. 15–16 Stellen.' }
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
        'Überlauf: Ein Wert (z.B. ein Schleifenzähler) wird grösser als sein Typ erlaubt und springt wieder nach vorne.',
        'Unsigned kann nicht negativ sein: Ein negativer Wert wird zu einer riesigen positiven Zahl.',
        'Ganzzahldivision: `int / int` schneidet den Rest ab – auch wenn das Ergebnis danach in einem `double` landet. Lösung: vorher einen Operanden umwandeln, z.B. `(double)a / b`.',
        'Kommazahlen sind ungenau: 0.1 ist binär nicht exakt. Für Geld nimmt man Ganzzahlen.',
        'Signed und unsigned mischen: Beim Vergleich wird der signed Wert zu unsigned umgewandelt.',
        'Zwischenergebnisse: `a * b` wird im Typ von `a` und `b` gerechnet, nicht im Typ der Zielvariable.'
      ] },
      { table: { head: ['Typ', 'printf-Format'], rows: [
        ['`int`', '`%d`'], ['`unsigned int`', '`%u`'], ['`long long` / `unsigned long long`', '`%lld` / `%llu`'],
        ['`float` / `double`', '`%f` (z.B. `%.2f` für 2 Nachkommastellen)'], ['`char`', '`%c`'], ['`sizeof`', '`%zu`']
      ] } },
      { tip: 'Ein falsches printf-Format ist undefiniertes Verhalten. Frag dich bei jeder Zeile: Welcher Typ ist das wirklich – und passt der Wert hinein?' }
    ],
    fact: {
      title: 'Patriot-Rakete: 0.1 ist nicht 0.1',
      text: '1991 verfehlte eine Patriot-Abwehrrakete in Dhahran ihr Ziel; 28 Soldaten starben. Das System zählte die Zeit in Zehntelsekunden, doch 0.1 lässt sich binär nicht exakt darstellen. Nach 100 Stunden Laufzeit war die Uhr um etwa 0.34 Sekunden daneben – genug, um das Ziel um über 500 m falsch zu berechnen.'
    },
    tasks: [
      { type: 'findBug',
        q: 'Das Programm soll 300 Datenpakete nummerieren – es hört aber nie auf. Welche Zeile ist schuld?',
        code: ['#include <stdio.h>', '#include <stdint.h>', '', 'int main(void) {', '    for (uint8_t i = 0; i < 300; i++) {', '        printf("Paket %d\\n", i);', '    }', '    return 0;', '}'],
        bugLines: [4],
        lineHint: 'Schau dir an, welchen Typ der Schleifenzähler hat und wie weit er zählen muss.',
        fixes: ['`for (uint16_t i = 0; i < 300; i++)`', '`for (uint8_t i = 0; i <= 300; i++)`', '`for (int8_t i = 0; i < 300; i++)`', '`for (uint8_t i = 1; i < 300; i++)`'],
        fix: 0,
        explain: 'Ein `uint8_t` geht nur bis 255. Nach 255 kommt wieder 0 – die Bedingung `i < 300` ist immer wahr, die Schleife endet nie. Mit `uint16_t` (oder einfach `int`) klappt es.' },
      { type: 'findBug',
        q: 'Die Frostwarnung erscheint nie, obwohl es draussen −15 °C sind. Wo liegt der Fehler?',
        code: ['#include <stdio.h>', '', 'int main(void) {', '    unsigned int temperatur;', '    temperatur = sensor_lesen(); // liefert -30 bis 50', '    if (temperatur < 0) {', '        printf("Frost!\\n");', '    }', '    return 0;', '}'],
        bugLines: [3],
        lineHint: 'Die Bedingung ist an sich richtig – aber kann die Variable überhaupt negativ werden?',
        fixes: ['`int temperatur;`', '`unsigned long temperatur;`', '`if (temperatur <= 0)`', '`unsigned char temperatur;`'],
        fix: 0,
        explain: 'Ein `unsigned int` kann nicht negativ sein: −15 wird zu 4\'294\'967\'281. Damit ist `temperatur < 0` immer falsch. Für Werte, die negativ werden können, braucht es einen signed Typ.' },
      { type: 'findBug',
        q: 'Der Durchschnitt soll 4.25 sein, ausgegeben wird aber 4.00. Welche Zeile ist fehlerhaft?',
        code: ['int summe = 17;', 'int anzahl = 4;', 'double schnitt = summe / anzahl;', 'printf("%.2f\\n", schnitt);'],
        bugLines: [2],
        lineHint: 'Mit welchem Typ wird die Division gerechnet – bevor das Ergebnis in schnitt landet?',
        fixes: ['`double schnitt = (double)summe / anzahl;`', '`float schnitt = summe / anzahl;`', '`double schnitt = (double)(summe / anzahl);`', '`int schnitt = summe / anzahl;`'],
        fix: 0,
        why: [null, 'Auch hier wird zuerst ganzzahlig geteilt.', 'Die Klammer rechnet zuerst 17 / 4 = 4 ganzzahlig – erst danach wird umgewandelt.', 'Ein int kann gar keine 4.25 speichern.'],
        explain: '`int / int` ist eine Ganzzahldivision: 17 / 4 = 4, der Rest fällt weg. Erst danach wird 4 in 4.0 umgewandelt. Wandelt man vorher einen Operanden in `double` um, rechnet C mit Kommazahlen: 4.25.' },
      { type: 'findBug',
        q: 'Eine Bank addiert 1 Million Mal 10 Rappen. Erwartet: 100000.00 – heraus kommt etwas wie 100958.34. Was ist das Problem?',
        code: ['float kontostand = 0.0f;', 'for (int i = 0; i < 1000000; i++) {', '    kontostand += 0.10f; // 10 Rappen', '}', 'printf("%.2f\\n", kontostand);'],
        bugLines: [0, 2],
        lineHint: 'Die Schleife und die Ausgabe sind korrekt. Welche Zeile legt fest, wie genau der Betrag gespeichert wird?',
        fixes: ['Betrag in Rappen als Ganzzahl speichern: `int64_t kontostand_rappen = 0;` und `+= 10`',
                '`double kontostand = 0.0f;` – dann ist es exakt',
                '`printf("%.1f\\n", kontostand);`',
                '`unsigned int i` als Schleifenzähler'],
        fix: 0,
        why: [null, '`double` ist genauer, aber 0.1 ist auch dort nicht exakt darstellbar – für Geld bleibt es riskant.', 'Die Ausgabe ändert nichts am falschen gespeicherten Wert.', 'Der Zähler ist nicht das Problem.'],
        explain: '0.1 ist binär ein unendlicher Bruch und wird gerundet. `float` hat nur ca. 7 Stellen – die Fehler summieren sich. Geldbeträge speichert man als Ganzzahl in der kleinsten Einheit (Rappen/Cent).' },
      { type: 'findBug',
        q: 'Die Ausgabe zeigt einen unsinnigen Preis. Welche Zeile enthält den Fehler?',
        code: ['double preis = 4.95;', 'int stueck = 3;', 'printf("Stueck: %d, Preis: %d\\n", stueck, preis);'],
        bugLines: [2],
        fixes: ['`printf("Stueck: %d, Preis: %.2f\\n", stueck, preis);`', '`printf("Stueck: %f, Preis: %d\\n", stueck, preis);`', '`int preis = 4.95;`', '`printf("Stueck: %c, Preis: %d\\n", stueck, preis);`'],
        fix: 0,
        explain: 'Die Formatangabe muss zum Typ passen: `%d` für `int`, `%f` (hier `%.2f` für 2 Nachkommastellen) für `double`. Ein falscher Platzhalter ist undefiniertes Verhalten – es erscheint Datenmüll.' },
      { type: 'findBug',
        q: 'Bei −5 °C wird nicht „Kalt“ ausgegeben. Warum?',
        code: ['int temperatur = -5;', 'unsigned int grenze = 10;', 'if (temperatur < grenze) {', '    printf("Kalt\\n");', '}'],
        bugLines: [1, 2],
        lineHint: 'Hier werden zwei Variablen mit unterschiedlichen Typen verglichen.',
        fixes: ['`int grenze = 10;`', '`unsigned int temperatur = -5;`', '`if (temperatur <= grenze)`', '`if (grenze < temperatur)`'],
        fix: 0,
        explain: 'Beim Vergleich von `int` mit `unsigned int` wird der `int` in unsigned umgewandelt: −5 wird zu 4\'294\'967\'291 – und das ist nicht kleiner als 10. Lösung: beide Werte signed. Compiler warnen mit `-Wall -Wextra` (`-Wsign-compare`).' },
      { type: 'findBug',
        q: 'Ein Bild hat 50\'000 × 50\'000 Pixel. Die Fläche wird negativ ausgegeben, obwohl das Ergebnis in `int64_t` gespeichert wird. Welche Zeile?',
        code: ['#include <stdint.h>', 'int32_t breite = 50000;', 'int32_t hoehe = 50000;', 'int64_t flaeche = breite * hoehe;', 'printf("%lld\\n", (long long)flaeche);'],
        bugLines: [3],
        lineHint: 'Das Ziel ist gross genug – aber in welchem Typ wird die Multiplikation gerechnet?',
        fixes: ['`int64_t flaeche = (int64_t)breite * hoehe;`', '`int64_t flaeche = (int64_t)(breite * hoehe);`', '`int32_t flaeche = breite * hoehe;`', '`uint32_t flaeche = breite * hoehe;`'],
        fix: 0,
        why: [null, 'Die Klammer rechnet zuerst in 32 Bit – der Überlauf passiert vor der Umwandlung.', null, null],
        explain: '50\'000 × 50\'000 = 2\'500\'000\'000 > 2\'147\'483\'647. Die Multiplikation passiert in `int32_t` und läuft über (signed: undefiniertes Verhalten), erst dann wird das Ergebnis zu int64 umgewandelt. Wird ein Operand vorher zu `int64_t`, rechnet C in 64 Bit.' }
    ]
  },
  /* ------------------------------------------------------------ 8 */
  {
    id: 'structs',
    title: 'Structs & Padding',
    desc: 'Felder geschickt anordnen – Füllbytes vermeiden.',
    intro: [
      { p: 'Ein struct fasst mehrere Felder zusammen. Der Prozessor liest Werte am schnellsten, wenn sie „ausgerichtet“ sind (Alignment). Darum gelten auf der Referenzplattform zwei Regeln:' },
      { ol: [
        'Jedes Feld beginnt an einem Offset, der ein Vielfaches seiner Grösse ist (`char`/`bool`/`uint8_t`: 1, `short`/`uint16_t`: 2, `int`/`float`/`uint32_t`: 4, `double`/`int64_t`: 8). Passt das nicht, fügt der Compiler Füllbytes (Padding) ein.',
        'Die Gesamtgrösse wird auf ein Vielfaches des grössten Feldes aufgerundet – damit auch Arrays aus diesem struct korrekt ausgerichtet sind.'
      ] },
      { code: 'struct Bsp {\n    char c;    // Offset 0, danach 3 Füllbytes\n    int  i;    // Offset 4\n};             // sizeof = 8 statt 5' },
      { ul: [
        'Faustregel: Felder nach Grösse sortieren, die grössten zuerst. So entsteht am wenigsten Padding.',
        'Ein Array aus structs braucht Anzahl × `sizeof(struct)` – inklusive Füllbytes.'
      ] },
      { tip: 'Offset für Offset durchgehen: Passt das nächste Feld hier hin? Wenn nicht, auffüllen. Am Ende aufrunden.' }
    ],
    fact: {
      title: 'Boeing 787: Neustart alle 248 Tage',
      text: '2015 warnte die US-Luftfahrtbehörde FAA: Die Generator-Steuerung der Boeing 787 zählte Hundertstelsekunden in einem signed 32-bit-Zähler. Nach 2³¹ Hundertstelsekunden – ziemlich genau 248 Tage – wäre er übergelaufen und die Stromversorgung hätte abschalten können. Bis zum Update mussten die Flugzeuge regelmässig neu gestartet werden.'
    },
    tasks: [
      { type: 'choice',
        q: 'Warum fügt der Compiler in structs Füllbytes (Padding) ein?',
        options: ['Damit jedes Feld an einer passend ausgerichteten Adresse liegt und der Prozessor schnell (oder überhaupt) darauf zugreifen kann',
                  'Als Platz für spätere Felder',
                  'Zur Verschlüsselung',
                  'Das ist ein Compilerfehler'],
        answer: 0,
        explain: 'Viele Prozessoren lesen z.B. einen 4-Byte-`int` am schnellsten (manche nur) von einer durch 4 teilbaren Adresse. Darum richtet der Compiler jedes Feld auf seine Grösse aus.' },
      { type: 'number',
        q: 'Wie gross ist diese struct auf der Referenzplattform?',
        code: 'struct A {\n    char  c;\n    short s;\n    char  d;\n};\nprintf("%zu\\n", sizeof(struct A));',
        answer: '6', unit: 'Bytes',
        hint: 'c an 0, dann muss s an eine gerade Adresse. Am Ende auf ein Vielfaches von 2 aufrunden.',
        explain: 'c: Byte 0, 1 Füllbyte, s: Bytes 2–3, d: Byte 4, dann 1 Füllbyte am Ende (Grösse muss Vielfaches von 2 sein) = 6 Byte. Nutzdaten sind nur 4 Byte.' },
      { type: 'structOrder',
        q: 'Ordne die Felder so an, dass `sizeof(struct Spieler)` möglichst klein wird.',
        name: 'Spieler',
        fields: [{ type: 'char', name: 'team' }, { type: 'int', name: 'punkte' }, { type: 'char', name: 'level' }],
        explain: 'Faustregel: grosse Felder zuerst, kleine zuletzt. `int` an Offset 0, die beiden `char` an 4 und 5, dann 2 Byte Padding bis 8. Vorher waren es 12 Byte.' },
      { type: 'structOrder',
        q: 'Ein Messwert-Datensatz eines Sensors. Mach die struct so klein wie möglich.',
        name: 'Messung',
        fields: [{ type: 'char', name: 'kanal' }, { type: 'double', name: 'wert' }, { type: 'char', name: 'einheit' }, { type: 'int', name: 'zeit' }],
        explain: 'double (8) + int (4) + char + char (2) = 14, aufgerundet auf ein Vielfaches von 8 → 16 Byte statt 24.' },
      { type: 'structOrder',
        q: 'Ein Datenpaket aus einem Mikrocontroller mit 2 KB RAM – hier zählt jedes Byte!',
        name: 'Paket',
        fields: [{ type: 'uint8_t', name: 'id' }, { type: 'double', name: 'wert' }, { type: 'uint16_t', name: 'status' }, { type: 'uint32_t', name: 'zeitstempel' }, { type: 'uint8_t', name: 'flags' }],
        explain: 'Sortiert nach Grösse: 8 + 4 + 2 + 1 + 1 = 16 Byte, kein einziges Füllbyte. Die ursprüngliche Reihenfolge brauchte 32 Byte – doppelt so viel.' },
      { type: 'number',
        q: 'Wie viel Speicher braucht ein Array von 1000 dieser structs?',
        code: 'struct Punkt {\n    double x;\n    int    farbe;\n    char   sichtbar;\n};\nstruct Punkt punkte[1000];',
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
        'Grössen: `char` 1, `short` 2, `int` 4, `long long` 8, `float` 4, `double` 8 Bytes (`long` plattformabhängig). Bits = Bytes × 8.',
        'Wertebereich mit n Bits: unsigned 0 … 2ⁿ − 1, signed −2ⁿ⁻¹ … 2ⁿ⁻¹ − 1.',
        'Zweierkomplement: Das oberste Bit zählt negativ (bei 8 Bit −128).',
        '`<stdint.h>`: `u` = unsigned, Zahl = Bits, z.B. `int16_t` = signed, 16 Bit.',
        'Typ wählen: Bereich bestimmen → negativ? → Komma? → kleinster passender Typ.',
        'printf: `%d` int, `%u` unsigned, `%ld`/`%lu` long, `%lld`/`%llu` long long, `%f` double, `%zu` sizeof.',
        'Überlauf: Auch Zwischenergebnisse und Konstanten-Rechnungen müssen in den Typ passen.',
        'Structs: Felder auf ihre Grösse ausrichten, grösste zuerst, Gesamtgrösse auf Vielfaches des grössten Feldes aufrunden.'
      ] },
      { tip: 'Lies jede Aufgabe genau: Welcher Typ, wie viele Bits, signed oder unsigned? Viel Erfolg!' }
    ],
    tasks: [
      { type: 'yesno',
        q: 'Passt der Wert 300 in einen `uint8_t`?',
        answer: false,
        explain: '`uint8_t` geht nur bis 255. 300 würde zu 300 − 256 = 44.' },
      { type: 'number',
        q: 'Was ist der grösste Wert eines `int16_t`?',
        answer: '32767',
        explain: '2¹⁵ − 1 = 32\'767.' },
      { type: 'choice',
        q: 'Mit welcher Formatangabe gibt man einen `unsigned long long` mit printf aus?',
        options: ['`%d`', '`%lu`', '`%llu`', '`%f`'],
        answer: 2,
        explain: '`ll` = long long, `u` = unsigned. `%lu` wäre für `unsigned long` – und der ist plattformabhängig gross.' },
      { type: 'bits', bits: 8, mode: 'signed', target: -100,
        q: 'Stelle −100 als `int8_t` ein.',
        explain: '−100 = −128 + 28 = −128 + 16 + 8 + 4 → `10011100`. Unsigned gelesen wären dieselben Bits 156 (= 256 − 100).' },
      { type: 'pickType',
        q: 'Anzahl belegter Sitzplätze in einem Stadion: 0 bis 60\'000.',
        code: '____ zuschauer = 0;',
        min: '0', max: '60000',
        options: ['int16_t', 'uint16_t', 'int32_t', 'uint64_t'],
        explain: '60\'000 passt nicht in `int16_t` (max. 32\'767), aber in `uint16_t` (max. 65\'535) – 2 Byte.' },
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
        fields: [{ type: 'bool', name: 'aktiv' }, { type: 'int64_t', name: 'id' }, { type: 'uint16_t', name: 'level' }, { type: 'bool', name: 'sichtbar' }],
        explain: 'int64_t (8) + uint16_t (2) + bool + bool (2) = 12 → aufgerundet auf 16 Byte. Ursprünglich: 24 Byte.' },
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
    'Ich bin ein Mikrochip, aber ich mag Menschen, die Typen richtig wählen.'
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
