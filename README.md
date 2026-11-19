# Variable-types
Von Darius & Tobias

Interaktive Lernwebsite (Deutsch) zu den Ganzzahltypen mit fester Grösse in C – `uint8_t` bis `int64_t` aus `stdint.h` – am Beispiel des **ATmega2560** (Arduino Mega 2560, avr-gcc): 8-Bit-AVR, 16 MHz, keine FPU, `int` = 16 Bit.

Es geht nur um Variablentypen: Wertebereich, Überlauf, Vorzeichen, Typwahl, Typumwandlung und Festkomma. In den Codebeispielen zeigen LEDs an PORTA/PORTB lediglich den Wert einer Variable an. Kommazahlen werden als Festkomma gespeichert (Wert × Faktor als Ganzzahl, z.B. 3.84 km → 3840 m in `uint16_t`).

7 Levels mit je 5 Aufgaben (35 insgesamt): Grundlagen, Bits & Wertebereich, Vorzeichen & Bits, Kommazahlen als Festkomma, den richtigen Typ wählen, Überlauf & Umwandlung, Abschlussprüfung. Dazu eine Spielwiese (Overflow-Simulator mit LED-Anzeige) und ein Simulator, der kleine C-Programme ausführt und die Variablen (Name, Typ, Wert, Bits) live zeigt.

## Starten
![qrcode]()
[Website](https://htmlpreview.github.io/?https://github.com/DariusMSW/Variable-types/blob/main/index.html) Der Fortschritt wird lokal im Browser (localStorage) gespeichert und kann auf der Startseite zurückgesetzt werden.

Neue Aufgaben werden in `js/tasks.js` als Daten ergänzt (Aufgabentypen sind oben in der Datei beschrieben).
