# Variable-types
Von Darius & Tobias

Interaktive Lernwebsite (Deutsch) zu den Ganzzahltypen mit fester Grösse in C – `uint8_t` bis `int64_t` aus `stdint.h` – am Beispiel des **ATmega2560** (Arduino Mega 2560, avr-gcc): 8-Bit-AVR, 16 MHz, 256 KB Flash, 8 KB SRAM, 4 KB EEPROM, keine FPU.

Alle Codebeispiele sind typische ATmega2560-Programme: LEDs an PORTA/PORTB, Taster an Port L (gelesen über `PINL`), Schalter an Port C (`PINC`), ADC (10 Bit), Timer1 (16 Bit). Kommazahlen werden als Festkomma gespeichert (Wert × Faktor als Ganzzahl, z.B. 3.84 km → 3840 m in `uint16_t`).

9 Levels: Grundlagen, Speicherbedarf, Wertebereich, Bits & LEDs, Kommazahlen als Festkomma, effizientesten Typ wählen, Fehler finden, Structs & RAM-Budget, Abschlussprüfung. Dazu eine Spielwiese (Overflow-Simulator mit LED-Anzeige).

## Starten
[Website](https://htmlpreview.github.io/?https://github.com/DariusMSW/Variable-types/blob/main/index.html) Der Fortschritt wird lokal im Browser (localStorage) gespeichert und kann auf der Startseite zurückgesetzt werden.

Neue Aufgaben werden in `js/tasks.js` als Daten ergänzt (Aufgabentypen sind oben in der Datei beschrieben).
