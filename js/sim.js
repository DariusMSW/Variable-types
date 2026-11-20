/* C-Simulator fuer den ATmega2560.
   Tokenizer -> Parser (AST) -> Pruefung (Typen, Namen) -> Interpreter (Generatoren, schrittweise).
   SICHERHEIT: Nutzercode wird nie mit eval/Function ausgefuehrt, sondern nur als Daten interpretiert.
   Der Kern (CSim) hat keine DOM-Abhaengigkeit und ist in Node testbar; die Oberflaeche (CSimUI) folgt unten. */
(function (root) {
  'use strict';

  var F_CPU = 16000000;
  var CYC_PER_STEP = 16;      // grobe Annahme: eine Anweisung ~ 1 µs
  var MAX_ARR = 1024;   // groesste Arraylaenge im Simulator
  var MAX_DEPTH = 32;

  /* ---------- Typen (avr-gcc: int = 16 Bit) ---------- */
  var T = {
    uint8_t: { bits: 8, s: false }, int8_t: { bits: 8, s: true },
    uint16_t: { bits: 16, s: false }, int16_t: { bits: 16, s: true },
    uint32_t: { bits: 32, s: false }, int32_t: { bits: 32, s: true },
    uint64_t: { bits: 64, s: false }, int64_t: { bits: 64, s: true }
  };
  Object.keys(T).forEach(function (k) {
    var i = T[k], b = BigInt(i.bits);
    i.bytes = i.bits / 8;
    i.min = i.s ? -(1n << (b - 1n)) : 0n;
    i.max = i.s ? (1n << (b - 1n)) - 1n : (1n << b) - 1n;
  });
  function wrapT(v, t) { var i = T[t]; return i.s ? BigInt.asIntN(i.bits, v) : BigInt.asUintN(i.bits, v); }
  function promote(t) { return T[t].bits < 16 ? 'int16_t' : t; }
  function common(a, b) {
    a = promote(a); b = promote(b);
    var x = T[a].bits, y = T[b].bits;
    if (x !== y) return x > y ? a : b;
    return !T[a].s ? a : b;
  }

  var BAD_TYPES = {
    int: 'Auf dem ATmega2560 ist `int` nur 16 Bit gross. Diese Seite arbeitet mit Typen fester Grösse: nimm z.B. `int16_t` oder `uint8_t`.',
    unsigned: 'Statt `unsigned …` nimm einen Typ fester Grösse wie `uint8_t`, `uint16_t` oder `uint32_t`.',
    signed: 'Statt `signed …` nimm `int8_t`, `int16_t` oder `int32_t`.',
    char: '`char` ist für Zeichen gedacht. Für kleine Zahlen nimm `uint8_t` oder `int8_t`.',
    short: '`short` ist auf dem AVR 16 Bit – schreib lieber gleich `int16_t`.',
    long: '`long` ist auf dem AVR 32 Bit – schreib lieber `int32_t` (bzw. `int64_t` statt `long long`).',
    float: 'Kommazahlen (`float`) unterstützt der Simulator nicht – und der ATmega2560 hat keine FPU. Tipp: Festkomma, z.B. Millivolt in `uint16_t` statt Volt.',
    double: 'Kommazahlen (`double`) unterstützt der Simulator nicht – und der ATmega2560 hat keine FPU. Tipp: Festkomma, z.B. Millimeter in `int16_t` statt Meter.',
    bool: '`bool` gibt es nur mit <stdbool.h>. Nimm hier `uint8_t` mit den Werten 0 und 1.',
    _Bool: 'Nimm hier `uint8_t` mit den Werten 0 und 1.',
    size_t: '`size_t` ist auf dem AVR 16 Bit – nimm `uint16_t`.'
  };
  var QUAL = { 'const': 1, 'volatile': 1, 'static': 1, 'register': 1, 'extern': 1, 'inline': 1 };
  var UNSUP = {
    struct: '`struct` wird im Simulator nicht unterstützt.',
    union: '`union` wird im Simulator nicht unterstützt.',
    enum: '`enum` wird im Simulator nicht unterstützt – nimm `#define`-Konstanten.',
    typedef: '`typedef` wird im Simulator nicht unterstützt.'
  };
  var KEYWORDS = {};
  'if else while do for break continue return sizeof const volatile static void switch case default goto struct union enum typedef extern register auto inline'
    .split(' ').forEach(function (w) { KEYWORDS[w] = 1; });

  /* ---------- Register des simulierten Boards (wie auf dem echten Schul-Board) ---------- */
  var REGS = {};
  function reg(name, ty, extra) { REGS[name] = Object.assign({ ty: ty || 'uint8_t' }, extra || {}); }
  var PORT_INFO = {
    A: 'LEDs 0–7', B: 'LEDs 8–15', C: 'Schalter PC0–PC7', E: 'Joystick-Taste PE2, Servos PE3/PE4',
    G: 'LCD: PG0 SID, PG1 SCLK, PG5 Strom', H: 'RGB-LED PH3–PH5', J: 'LED-Matrix PJ0–PJ6', L: 'Taster PL0/PL1/PL6/PL7'
  };
  Object.keys(PORT_INFO).forEach(function (p) {
    reg('DDR' + p, 'uint8_t', { info: 'Richtung Port ' + p });
    reg('PORT' + p, 'uint8_t', { info: PORT_INFO[p] });
    reg('PIN' + p, 'uint8_t', { info: 'Port ' + p + ' lesen' });
  });
  /* 4 Taster an PORTL (PL7, PL6, PL1, PL0): Pull-up + invertierender Schmitt-Trigger -> Bit = 1, solange gedrueckt */
  var PL_BITS = [7, 6, 1, 0], PL_MASK = 0xC3;
  /* Eingaenge je Port (Bitmaske): Schalter an C, Taster an L, Joystick-Taste an PE2 */
  var IN_MASK = { C: 0xFF, L: PL_MASK, E: 0x04 };
  /* RGB-LED an PORTH (ueber MOSFETs, Bit = 1: Farbe leuchtet) */
  var RGB_BITS = [{ b: 3, k: 'r', n: 'Rot' }, { b: 4, k: 'g', n: 'Grün' }, { b: 5, k: 'b', n: 'Blau' }], RGB_MASK = 0x38;
  /* A/D-Wandler */
  reg('ADMUX', 'uint8_t', { info: 'ADC: Referenz, Kanal' });
  reg('ADCSRA', 'uint8_t', { info: 'ADC: Ein, Start, Takt' });
  reg('ADCSRB', 'uint8_t', { info: 'ADC: MUX5 (Kanal 8–15)' });
  reg('ADCL', 'uint8_t', { ro: true, what: 'das Ergebnis des A/D-Wandlers', info: 'ADC-Ergebnis Low' });
  reg('ADCH', 'uint8_t', { ro: true, what: 'das Ergebnis des A/D-Wandlers', info: 'ADC-Ergebnis High' });
  reg('ADC', 'uint16_t', { ro: true, what: 'das Ergebnis des A/D-Wandlers', info: 'ADC-Ergebnis 0–1023' });
  reg('ADCW', 'uint16_t', { ro: true, what: 'das Ergebnis des A/D-Wandlers', info: 'ADC-Ergebnis 0–1023' });
  reg('DIDR0', 'uint8_t', { info: 'Digitaleingang aus (ADC0–7)' });
  reg('DIDR2', 'uint8_t', { info: 'Digitaleingang aus (ADC8–15)' });
  /* Timer 3 fuer die Servos (OC3A = PE3, OC3B = PE4) */
  reg('TCCR3A', 'uint8_t', { info: 'Timer 3: COM, WGM' });
  reg('TCCR3B', 'uint8_t', { info: 'Timer 3: WGM, Takt' });
  reg('TCCR3C', 'uint8_t', { info: 'Timer 3' });
  reg('TCNT3', 'uint16_t', { info: 'Timer 3: Zählerstand' });
  reg('OCR3A', 'uint16_t', { info: 'Servo 1 (PE3)' });
  reg('OCR3B', 'uint16_t', { info: 'Servo 2 (PE4)' });
  reg('OCR3C', 'uint16_t', { info: 'Timer 3: Vergleich C' });
  reg('ICR3', 'uint16_t', { info: 'Timer 3: TOP (Periode)' });
  reg('TIMSK3', 'uint8_t', { info: 'Timer 3: Interrupts' });
  reg('TIFR3', 'uint8_t', { info: 'Timer 3: Flags' });

  /* Analoge Eingaenge des Boards: Kanal -> Bauteil */
  var ADC_PARTS = { 8: 'Potentiometer 1', 9: 'Potentiometer 2', 10: 'Joystick X', 11: 'Joystick Y', 12: 'Lichtsensor', 13: 'Temperatur (LM35)', 14: 'Hallsensor 1', 15: 'Hallsensor 2' };
  var DEFAULT_VOLT = [0, 0, 0, 0, 0, 0, 0, 0, 2.5, 2.5, 2.5, 2.5, 2.5, 0.22, 2.5, 2.5];

  /* Hardware-Namen, die das simulierte Board nicht hat */
  var HW_UNSUP = /^(?:(?:DDR|PORT|PIN)[A-L]|P[A-L][0-7]|TCNT\d[HL]?|TCCR\d[A-C]?|OCR\d[A-C]?[HL]?|TIMSK\d|TIFR\d|ICR\d[HL]?|CS\d\d|WGM\d\d|COM\d[A-C]\d|UDR\d|UCSR\d[A-C]|UBRR\d[HL]?|SPCR|SPDR|SPSR|EICR[AB]|EIMSK|PCICR|PCMSK\d|TWCR|TWDR|TWBR)$/;
  var HW_MSG = ' gibt es im Simulator nicht. Das simulierte Board kennt: LEDs (`PORTA`/`PORTB`), RGB-LED (`PORTH`), Schalter (`PINC`), Taster (`PINL`), Joystick-Taste (`PINE`), A/D-Wandler (`ADMUX`, `ADCSRA`, `ADCSRB`, `ADC`), Timer 3 für die Servos (`TCCR3A`, `TCCR3B`, `ICR3`, `OCR3A`, `OCR3B`), LCD (`PORTG`) und LED-Matrix (`PORTJ`).';

  /* Bitnamen aus <avr/io.h> */
  var PREDEF = Object.create(null);
  function bits(names) { names.forEach(function (n, i) { if (n) PREDEF[n] = 7 - i; }); }
  for (var bb = 0; bb < 8; bb++) {
    Object.keys(PORT_INFO).forEach(function (p) {
      PREDEF['P' + p + bb] = bb; PREDEF['PORT' + p + bb] = bb; PREDEF['DD' + p + bb] = bb; PREDEF['PIN' + p + bb] = bb;
    });
  }
  bits(['REFS1', 'REFS0', 'ADLAR', 'MUX4', 'MUX3', 'MUX2', 'MUX1', 'MUX0']);
  bits(['ADEN', 'ADSC', 'ADATE', 'ADIF', 'ADIE', 'ADPS2', 'ADPS1', 'ADPS0']);
  bits([null, 'ACME', null, null, 'MUX5', 'ADTS2', 'ADTS1', 'ADTS0']);
  bits(['COM3A1', 'COM3A0', 'COM3B1', 'COM3B0', 'COM3C1', 'COM3C0', 'WGM31', 'WGM30']);
  bits(['ICNC3', 'ICES3', null, 'WGM33', 'WGM32', 'CS32', 'CS31', 'CS30']);
  bits(['FOC3A', 'FOC3B', 'FOC3C', null, null, null, null, null]);
  bits([null, null, 'ICIE3', null, 'OCIE3C', 'OCIE3B', 'OCIE3A', 'TOIE3']);
  for (bb = 0; bb < 8; bb++) { PREDEF['ADC' + bb + 'D'] = bb; PREDEF['ADC' + (bb + 8) + 'D'] = bb; }

  var BUILTINS = { _delay_ms: { n: 1, ret: 'void' }, _delay_us: { n: 1, ret: 'void' }, _BV: { n: 1, ret: 'int16_t' } };
  var FN_TIPS = {
    printf: 'Das Board hat keinen Bildschirm – zeig Werte auf den LEDs an, z.B. `PORTA = wert;`.',
    puts: 'Das Board hat keinen Bildschirm – zeig Werte auf den LEDs an.',
    putchar: 'Das Board hat keinen Bildschirm – zeig Werte auf den LEDs an.',
    scanf: 'Eingaben gibt es im Simulator nicht – gib den Wert direkt im Code vor, z.B. `uint16_t messwert = 1023;`.',
    delay: 'Das ist Arduino. In C heisst das `_delay_ms(…)` aus <util/delay.h>.',
    delayMicroseconds: 'Das ist Arduino. In C heisst das `_delay_us(…)`.',
    digitalWrite: 'Arduino-Funktionen gibt es hier nicht. Zeig einen Wert direkt auf den LEDs an: `PORTA = wert;`.',
    pinMode: 'Arduino-Funktionen gibt es hier nicht. Zeig einen Wert direkt auf den LEDs an: `PORTA = wert;`.',
    digitalRead: 'Arduino-Funktionen gibt es hier nicht. Gib den Wert als Variable vor, z.B. `uint8_t an = 1;`.',
    analogRead: 'Arduino-Funktionen gibt es hier nicht. Gib den Messwert als Variable vor, z.B. `uint16_t messwert = 512;`.',
    millis: 'Arduino-Funktionen gibt es hier nicht. Zähl die Zeit selbst in einer Variable, z.B. `uint32_t zeit_ms`.',
    malloc: 'Dynamischer Speicher (`malloc`) wird im Simulator nicht unterstützt.',
    sleep: 'Nimm `_delay_ms(…)`.'
  };
  var OK_INCLUDES = { 'avr/io.h': 1, 'stdint.h': 1, 'util/delay.h': 1 };

  /* ---------- Fehler ---------- */
  function SimError(msg, line, col) { this.msg = msg; this.line = line || 0; this.col = col || 0; }
  SimError.prototype.toString = function () { return 'Zeile ' + this.line + ': ' + this.msg; };
  function err(msg, at) { throw new SimError(msg, at && at.line, at && at.col); }

  /* ---------- Tokenizer + Präprozessor ---------- */
  var OPS3 = { '<<=': 1, '>>=': 1, '...': 1 };
  var OPS2 = {};
  '-> ++ -- << >> <= >= == != && || += -= *= /= %= &= |= ^='.split(' ').forEach(function (o) { OPS2[o] = 1; });
  var OPS1 = '+-*/%<>=!~&|^?:;,(){}[].#';

  function stripComments(src) {
    var out = [], i = 0, n = src.length, line = 1;
    while (i < n) {
      var c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { out.push(' '); i++; } continue; }
      if (c === '/' && d === '*') {
        var sl = line, sc = i;
        out.push('  '); i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') { out.push('\n'); line++; } else out.push(' ');
          i++;
        }
        if (i >= n) err('Der Kommentar `/*` wird nie mit `*/` geschlossen.', { line: sl, col: sc + 1 });
        out.push('  '); i += 2; continue;
      }
      if (c === '"' || c === '\'') {
        out.push(c); i++;
        while (i < n && src[i] !== c && src[i] !== '\n') {
          if (src[i] === '\\' && i + 1 < n && src[i + 1] !== '\n') { out.push(src[i]); i++; }
          out.push(src[i]); i++;
        }
        if (i < n && src[i] === c) { out.push(c); i++; }
        continue;
      }
      if (c === '\n') line++;
      out.push(c); i++;
    }
    return out.join('');
  }

  var ESC = { n: 10, t: 9, r: 13, '0': 0, '\\': 92, '\'': 39, '"': 34, a: 7, b: 8, f: 12, v: 11 };
  function numLit(s, at, diag) {
    if (/^\./.test(s) || /\./.test(s) || (/^[0-9]+[eE]/.test(s)) || /^[0-9]+[fF]$/.test(s)) {
      err('Kommazahl `' + s + '`: `float` wird im Simulator nicht unterstützt (der ATmega2560 hat keine FPU). Tipp: Festkomma – z.B. 3.84 V als 3840 mV.', at);
    }
    var m = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|[0-9]+)((?:[uU](?:ll|LL|l|L)?)|(?:(?:ll|LL|l|L)[uU]?))?$/.exec(s);
    if (!m) {
      if (/^0[bB]/.test(s)) err('Ungültige Binärzahl `' + s + '` – nach `0b` dürfen nur 0 und 1 stehen.', at);
      if (/^0[xX]/.test(s)) err('Ungültige Hexzahl `' + s + '` – nach `0x` dürfen nur 0–9 und A–F stehen.', at);
      err('Ungültige Zahl `' + s + '`.', at);
    }
    var digits = m[1], suf = m[2] || '', v, dec = true;
    if (/^0[xX]/.test(digits)) { v = BigInt(digits); dec = false; }
    else if (/^0[bB]/.test(digits)) { v = BigInt('0b' + digits.slice(2)); dec = false; }
    else if (digits.length > 1 && digits[0] === '0') {
      if (/[89]/.test(digits)) err('`' + digits + '`: Eine führende 0 bedeutet in C Oktal (Basis 8) – darin gibt es keine 8 und 9.', at);
      v = BigInt('0o' + digits.slice(1)); dec = false;
      diag.push({ kind: 'warn', line: at.line, col: at.col, text: 'Achtung: `' + digits + '` beginnt mit 0 und ist darum eine Oktalzahl (= ' + v + ' dezimal)!' });
    } else v = BigInt(digits);
    var u = /u/i.test(suf), L = (suf.match(/l/gi) || []).length, cand;
    if (L >= 2) cand = u ? ['uint64_t'] : (dec ? ['int64_t'] : ['int64_t', 'uint64_t']);
    else if (L === 1) cand = u ? ['uint32_t', 'uint64_t'] : (dec ? ['int32_t', 'int64_t'] : ['int32_t', 'uint32_t', 'int64_t', 'uint64_t']);
    else cand = u ? ['uint16_t', 'uint32_t', 'uint64_t'] : (dec ? ['int16_t', 'int32_t', 'int64_t'] : ['int16_t', 'uint16_t', 'int32_t', 'uint32_t', 'int64_t', 'uint64_t']);
    for (var i = 0; i < cand.length; i++) if (v <= T[cand[i]].max) return { v: v, ty: cand[i] };
    err('Die Zahl `' + s + '` ist zu gross – selbst für 64 Bit.', at);
  }

  function lexLine(text, lineNo, toks, diag) {
    var i = 0, n = text.length, m;
    while (i < n) {
      var c = text[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') { i++; continue; }
      var at = { line: lineNo, col: i + 1 }, rest = text.slice(i);
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(text[i + 1] || ''))) {
        m = /^[0-9.][0-9A-Za-z_]*(?:\.[0-9A-Za-z_]*)?/.exec(rest);
        var nl = numLit(m[0], at, diag);
        toks.push({ t: 'num', v: nl.v, ty: nl.ty, text: m[0], line: at.line, col: at.col });
        i += m[0].length; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
        if (/^[^\x00-\x7f]/.test(text.slice(i + m[0].length))) err('Umlaute (ä, ö, ü) und Sonderzeichen sind in Namen nicht erlaubt. Schreib z.B. `zaehler` statt `zähler`.', { line: lineNo, col: i + m[0].length + 1 });
        toks.push({ t: 'id', v: m[0], text: m[0], line: at.line, col: at.col });
        i += m[0].length; continue;
      }
      if (c === '\'') {
        m = /^'((?:\\.|[^'\\])*)'/.exec(rest);
        if (!m) err('Das Zeichen-Literal wird nicht mit `\'` geschlossen.', at);
        var body = m[1], val;
        if (body.length === 1) val = body.charCodeAt(0);
        else if (body[0] === '\\' && body.length === 2 && ESC[body[1]] !== undefined) val = ESC[body[1]];
        else if (/^\\x[0-9a-fA-F]{1,2}$/.test(body)) val = parseInt(body.slice(2), 16);
        else err(body.length ? 'In `\'…\'` gehört genau ein Zeichen.' : 'Leeres Zeichen-Literal `\'\'`.', at);
        if (val > 127) err('Im Zeichen-Literal sind nur ASCII-Zeichen erlaubt (keine Umlaute).', at);
        toks.push({ t: 'num', v: BigInt(val), ty: 'int16_t', text: m[0], line: at.line, col: at.col });
        i += m[0].length; continue;
      }
      if (c === '"') {
        m = /^"((?:\\.|[^"\\])*)"/.exec(rest);
        if (!m) err('Die Zeichenkette wird nicht mit `"` geschlossen.', at);
        toks.push({ t: 'str', v: m[1], text: m[0], line: at.line, col: at.col });
        i += m[0].length; continue;
      }
      var op = OPS3[text.substr(i, 3)] ? text.substr(i, 3) : OPS2[text.substr(i, 2)] ? text.substr(i, 2) : (OPS1.indexOf(c) >= 0 ? c : null);
      if (!op) {
        if (/[^\x00-\x7f]/.test(c)) err('Unerwartetes Zeichen `' + c + '` – Umlaute und Sonderzeichen gehören nur in Kommentare.', at);
        err('Unerwartetes Zeichen `' + c + '`.', at);
      }
      toks.push({ t: 'op', v: op, text: op, line: at.line, col: at.col });
      i += op.length;
    }
  }

  function tokenize(src, diag) {
    var text = stripComments(src.replace(/\r\n?/g, '\n'));
    var lines = text.split('\n');
    var macros = Object.create(null);
    var info = { includes: {} };
    var cond = [], out = [];
    function on() { for (var k = 0; k < cond.length; k++) if (!cond[k].on) return false; return true; }
    function expand(tok, hide, depth) {
      if (tok.t === 'id' && macros[tok.v] && !hide[tok.v]) {
        if (depth > 30) err('`#define` ist zu tief verschachtelt.', tok);
        var h = Object.create(hide); h[tok.v] = 1;
        macros[tok.v].toks.forEach(function (mt) {
          expand({ t: mt.t, v: mt.v, ty: mt.ty, text: mt.text, line: tok.line, col: tok.col }, h, depth + 1);
        });
        return;
      }
      if (tok.t === 'id' && PREDEF[tok.v] !== undefined) {
        out.push({ t: 'num', v: BigInt(PREDEF[tok.v]), ty: 'int16_t', text: tok.v, line: tok.line, col: tok.col });
        return;
      }
      out.push(tok);
    }
    function directive(name, rest, ln, col) {
      var at = { line: ln, col: col };
      if (name === 'ifdef' || name === 'ifndef') {
        var id = rest.split(/\s+/)[0];
        var def = !!macros[id] || PREDEF[id] !== undefined;
        cond.push({ on: name === 'ifdef' ? def : !def, line: ln });
        return;
      }
      if (name === 'if') {
        if (/^[01]$/.test(rest)) { cond.push({ on: rest === '1', line: ln }); return; }
        err('`#if` mit Ausdrücken wird im Simulator nicht unterstützt – nur `#if 0`, `#if 1`, `#ifdef` und `#ifndef`.', at);
      }
      if (name === 'else') { if (!cond.length) err('`#else` ohne passendes `#if`.', at); cond[cond.length - 1].on = !cond[cond.length - 1].on; return; }
      if (name === 'endif') { if (!cond.length) err('`#endif` ohne passendes `#if`.', at); cond.pop(); return; }
      if (name === 'elif') err('`#elif` wird im Simulator nicht unterstützt.', at);
      if (!on()) return;
      if (name === 'include') {
        var inc = /^[<"]([^>"]+)[>"]$/.exec(rest);
        if (!inc) err('`#include` erwartet eine Datei, z.B. `#include <avr/io.h>`.', at);
        var f = inc[1];
        info.includes[f] = true;
        if (f === 'util/delay.h' && !macros.F_CPU) diag.push({ kind: 'warn', line: ln, col: col, text: '`F_CPU` ist noch nicht definiert – `<util/delay.h>` nimmt dann 1 MHz an und die Wartezeiten stimmen nicht. Schreib `#define F_CPU 16000000UL` vor diese Zeile.' });
        if (!OK_INCLUDES[f]) diag.push({ kind: 'info', line: ln, col: col, text: '`#include <' + f + '>` wird im Simulator ignoriert.' });
        return;
      }
      if (name === 'define') {
        var dm = /^([A-Za-z_]\w*)(\(?)(.*)$/.exec(rest);
        if (!dm) err('Nach `#define` muss ein Name stehen, z.B. `#define ANZAHL 8`.', at);
        if (dm[2]) err('Makros mit Parametern (`#define ' + dm[1] + '(…)`) werden im Simulator nicht unterstützt. Schreib stattdessen eine Funktion.', at);
        if (REGS[dm[1]]) err('`' + dm[1] + '` ist schon vergeben (LED-Ausgabe) – nimm einen anderen Namen.', at);
        var body = [];
        lexLine(dm[3], ln, body, diag);
        if (dm[1] === 'F_CPU' && body.length === 1 && body[0].t === 'num' && body[0].v !== BigInt(F_CPU)) {
          diag.push({ kind: 'warn', line: ln, col: col, text: 'Der ATmega2560 auf dem Arduino Mega läuft mit 16 MHz: `#define F_CPU 16000000UL`. Der Simulator rechnet immer mit 16 MHz.' });
        }
        macros[dm[1]] = { toks: body, line: ln };
        return;
      }
      if (name === 'undef') { delete macros[rest.split(/\s+/)[0]]; return; }
      if (name === 'pragma' || name === 'warning') { diag.push({ kind: 'info', line: ln, col: col, text: '`#' + name + '` wird im Simulator ignoriert.' }); return; }
      if (name === 'error') err('#error: ' + rest, at);
      if (name === '') return;
      err('Die Direktive `#' + name + '` wird im Simulator nicht unterstützt.', at);
    }
    for (var li = 0; li < lines.length; li++) {
      var L = lines[li], ln = li + 1;
      while (/\\\s*$/.test(L) && li + 1 < lines.length) L = L.replace(/\\\s*$/, ' ') + lines[++li];
      var mm = /^\s*#\s*(\w*)\s*(.*?)\s*$/.exec(L);
      if (mm) { directive(mm[1], mm[2], ln, L.indexOf('#') + 1); continue; }
      if (!on()) continue;
      var lt = [];
      lexLine(L, ln, lt, diag);
      for (var k = 0; k < lt.length; k++) expand(lt[k], {}, 0);
    }
    if (cond.length) err('`#if…` ohne passendes `#endif`.', { line: cond[cond.length - 1].line, col: 1 });
    var last = out.length ? out[out.length - 1] : { line: 1, col: 1 };
    out.push({ t: 'eof', text: 'Dateiende', line: last.line, col: last.col + 1, eof: true });
    return { toks: out, info: info };
  }

  /* ---------- Parser ---------- */
  function show(t) { return t.t === 'eof' ? 'das Dateiende' : '`' + t.text + '`'; }
  function Parser(toks, diag) { this.t = toks; this.i = 0; this.diag = diag; }
  var P = Parser.prototype;
  P.peek = function (o) { return this.t[Math.min(this.i + (o || 0), this.t.length - 1)]; };
  P.next = function () { var t = this.t[this.i]; if (this.i < this.t.length - 1) this.i++; return t; };
  P.is = function (v, o) { var t = this.peek(o); return (t.t === 'op' || t.t === 'id') && t.v === v; };
  P.accept = function (v) { return this.is(v) ? this.next() : null; };
  P.expect = function (v, what) {
    if (this.is(v)) return this.next();
    var cur = this.peek(), prev = this.t[this.i - 1];
    if (v === ';') {
      if (prev && cur.line > prev.line) err('Semikolon `;` fehlt am Zeilenende?', { line: prev.line, col: prev.col + String(prev.text).length });
      err('Hier fehlt ein Semikolon `;` vor ' + show(cur) + '.', cur);
    }
    if (v === ')' || v === ']' || v === '}') {
      var at = (prev && cur.line > prev.line) ? { line: prev.line, col: prev.col + String(prev.text).length } : cur;
      err('Schliessende Klammer `' + v + '` fehlt' + (what ? ' ' + what : '') + '? Gefunden: ' + show(cur) + '.', at);
    }
    err('`' + v + '` erwartet' + (what ? ' ' + what : '') + ', gefunden: ' + show(cur) + '.', cur);
  };
  P.warn = function (at, text) { this.diag.push({ kind: 'warn', line: at.line, col: at.col, text: text }); };
  P.typeStart = function (o) {
    var t = this.peek(o);
    return t.t === 'id' && !!(T[t.v] || BAD_TYPES[t.v] || QUAL[t.v] || UNSUP[t.v] || t.v === 'void');
  };
  P.typeSpec = function (allowVoid) {
    var isConst = false;
    while (this.peek().t === 'id' && QUAL[this.peek().v]) if (this.next().v === 'const') isConst = true;
    var t = this.peek();
    if (t.t !== 'id') err('Hier wird ein Typ erwartet (z.B. `uint8_t`).', t);
    if (UNSUP[t.v]) err(UNSUP[t.v], t);
    var ty;
    if (t.v === 'void') {
      if (!allowVoid) err('`void` ist hier kein gültiger Typ – eine Variable braucht einen Typ wie `uint8_t`.', t);
      this.next(); ty = 'void';
    } else if (T[t.v]) { this.next(); ty = t.v; }
    else if (BAD_TYPES[t.v]) {
      if (t.v === 'int' && this.is('main', 1)) { this.next(); return { ty: 'int16_t', isConst: isConst, intMain: true, tok: t }; }
      err('Den Typ `' + t.v + '` bietet der Simulator nicht an. ' + BAD_TYPES[t.v], t);
    } else err('Unbekannter Typ `' + t.v + '`.', t);
    while (this.peek().t === 'id' && QUAL[this.peek().v]) if (this.next().v === 'const') isConst = true;
    if (this.is('*')) err('Zeiger (`*`) werden im Simulator nicht unterstützt.', this.peek());
    return { ty: ty, isConst: isConst, tok: t };
  };
  P.name = function () {
    var t = this.peek();
    if (t.t !== 'id') err('Hier wird ein Name erwartet, gefunden: ' + show(t) + '.', t);
    if (KEYWORDS[t.v] || T[t.v] || BAD_TYPES[t.v]) err('`' + t.v + '` ist ein reserviertes Wort und kann kein Name sein.', t);
    return this.next();
  };
  P.program = function () {
    var prog = { items: [], funcList: [] };
    while (this.peek().t !== 'eof') {
      if (this.accept(';')) continue;
      var t = this.peek();
      if (!this.typeStart()) {
        if (t.t === 'id' && this.is('(', 1)) err('`' + t.v + '(…)`: Hier fehlt der Rückgabetyp – oder die Anweisung gehört in eine Funktion wie `int main(void) { … }`.', t);
        if (t.t === 'op' && t.v === '}') err('Eine `}` zu viel?', t);
        err('Ausserhalb von Funktionen sind nur Deklarationen erlaubt – fehlt `int main(void) {`?', t);
      }
      var spec = this.typeSpec(true);
      var nameTok = this.name();
      if (this.is('(')) {
        var f = this.funcDef(spec, nameTok);
        prog.funcList.push(f); prog.items.push({ fn: f });
      } else {
        if (spec.ty === 'void') err('Eine Variable kann nicht vom Typ `void` sein.', spec.tok);
        var d = this.declRest(spec, nameTok, true);
        d.line = spec.tok.line; d.col = spec.tok.col;
        prog.items.push({ decl: d });
      }
    }
    return prog;
  };
  P.funcDef = function (spec, nameTok) {
    this.expect('(');
    var params = [];
    if (this.is('void') && this.is(')', 1)) this.next();
    else if (!this.is(')')) {
      do {
        var ps = this.typeSpec(false), pn = this.name();
        if (this.is('[')) err('Arrays als Parameter werden im Simulator nicht unterstützt.', this.peek());
        params.push({ name: pn.v, ty: ps.ty, isConst: ps.isConst, line: pn.line, col: pn.col });
      } while (this.accept(','));
    }
    this.expect(')', 'nach den Parametern');
    var f = { name: nameTok.v, ret: spec.ty, params: params, line: nameTok.line, col: nameTok.col, body: null };
    if (this.accept(';')) return f;
    if (!this.is('{')) err('Nach `' + f.name + '(…)` erwartet: `{` mit dem Funktionsrumpf.', this.peek());
    f.body = this.block();
    return f;
  };
  P.declRest = function (spec, firstName, isGlobal) {
    var s = { k: 'decl', items: [], global: isGlobal, line: firstName.line, col: firstName.col };
    var nt = firstName;
    for (;;) {
      var d = { name: nt.v, ty: spec.ty, isConst: spec.isConst, line: nt.line, col: nt.col, arr: false, sizeExpr: null, init: null, list: null };
      if (this.accept('[')) {
        d.arr = true;
        if (!this.is(']')) d.sizeExpr = this.assign();
        this.expect(']', 'hinter der Arraygrösse');
        if (this.is('[')) err('Mehrdimensionale Arrays werden im Simulator nicht unterstützt.', this.peek());
      }
      if (this.accept('=')) {
        if (this.is('{')) {
          this.next(); d.list = [];
          while (!this.is('}')) {
            d.list.push(this.assign());
            if (!this.accept(',')) break;
          }
          this.expect('}', 'am Ende der Liste `{…}`');
        } else d.init = this.assign();
      }
      s.items.push(d);
      if (!this.accept(',')) break;
      nt = this.name();
    }
    this.expect(';');
    return s;
  };
  P.block = function () {
    var o = this.expect('{'), body = [];
    while (!this.is('}')) {
      if (this.peek().t === 'eof') err('Die Klammer `{` aus Zeile ' + o.line + ' wird nie geschlossen – fehlt ein `}`?', { line: o.line, col: o.col });
      body.push(this.statement());
    }
    var c = this.next();
    return { k: 'block', body: body, line: o.line, col: o.col, endLine: c.line };
  };
  P.condParen = function (kw) {
    this.expect('(', 'nach `' + kw + '`');
    var c = this.expr();
    this.expect(')', 'nach der Bedingung');
    return c;
  };
  P.emptyBody = function (kwTok, body, closeLine) {
    if (body.k === 'empty' && body.line === closeLine) this.warn(body, 'Semikolon direkt nach `' + kwTok.v + '(…)`: Damit ist die ' + (kwTok.v === 'if' ? 'Bedingung' : 'Schleife') + ' hier schon zu Ende – der Block danach gehört nicht mehr dazu.');
  };
  P.statement = function () {
    var t = this.peek(), c, body, close;
    if (t.t === 'op' && t.v === '{') return this.block();
    if (t.t === 'op' && t.v === ';') { this.next(); return { k: 'empty', line: t.line, col: t.col }; }
    if (t.t === 'id') {
      switch (t.v) {
        case 'if': {
          this.next(); c = this.condParen('if'); close = this.t[this.i - 1].line;
          var th = this.statement(); this.emptyBody(t, th, close);
          var els = this.accept('else') ? this.statement() : null;
          return { k: 'if', cond: c, then: th, els: els, line: t.line, col: t.col };
        }
        case 'while': {
          this.next(); c = this.condParen('while'); close = this.t[this.i - 1].line;
          body = this.statement(); this.emptyBody(t, body, close);
          return { k: 'while', cond: c, body: body, line: t.line, col: t.col };
        }
        case 'do': {
          this.next(); body = this.statement();
          var w = this.peek();
          if (!this.accept('while')) err('Nach `do { … }` fehlt `while (…);`.', w);
          c = this.condParen('while');
          this.expect(';');
          return { k: 'do', cond: c, body: body, w: { line: w.line, col: w.col }, line: t.line, col: t.col };
        }
        case 'for': {
          this.next(); this.expect('(', 'nach `for`');
          var init = null, cnd = null, step = null;
          if (this.typeStart()) {
            var sp = this.typeSpec(false);
            init = this.declRest(sp, this.name(), false);
          } else if (!this.accept(';')) {
            init = { k: 'expr', e: this.expr(), line: t.line, col: t.col };
            this.expect(';');
          }
          if (!this.is(';')) cnd = this.expr();
          this.expect(';');
          if (!this.is(')')) step = this.expr();
          this.expect(')', 'nach `for (…`');
          close = this.t[this.i - 1].line;
          body = this.statement(); this.emptyBody(t, body, close);
          return { k: 'for', init: init, cond: cnd, step: step, body: body, line: t.line, col: t.col };
        }
        case 'break': case 'continue':
          this.next(); this.expect(';');
          return { k: t.v, line: t.line, col: t.col };
        case 'return': {
          this.next();
          var e = this.is(';') ? null : this.expr();
          this.expect(';');
          return { k: 'return', e: e, line: t.line, col: t.col };
        }
        case 'switch': case 'case': case 'default':
          err('`switch`/`case` wird im Simulator nicht unterstützt – nimm `if … else if …`.', t);
          break;
        case 'goto': err('`goto` wird im Simulator nicht unterstützt.', t); break;
        case 'else': err('`else` ohne passendes `if` – steht vielleicht ein `;` direkt nach `if (…)` oder fehlt eine `{`?', t); break;
      }
    }
    if (this.typeStart()) {
      var spec = this.typeSpec(false);
      var d = this.declRest(spec, this.name(), false);
      d.line = t.line; d.col = t.col;
      return d;
    }
    var ex = this.expr();
    this.expect(';');
    return { k: 'expr', e: ex, line: t.line, col: t.col };
  };
  var ASSIGN = { '=': 1, '+=': 1, '-=': 1, '*=': 1, '/=': 1, '%=': 1, '&=': 1, '|=': 1, '^=': 1, '<<=': 1, '>>=': 1 };
  var BIN_LEVELS = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
  var CMP = { '==': 1, '!=': 1, '<': 1, '>': 1, '<=': 1, '>=': 1 };
  P.expr = function () {
    var e = this.assign();
    while (this.is(',')) { var t = this.next(); e = { k: 'comma', l: e, r: this.assign(), line: t.line, col: t.col }; }
    return e;
  };
  P.assign = function () {
    var l = this.cond(), t = this.peek();
    if (t.t === 'op' && ASSIGN[t.v]) {
      this.next();
      return { k: 'assign', op: t.v, t: l, e: this.assign(), line: t.line, col: t.col };
    }
    return l;
  };
  P.cond = function () {
    var c = this.binary(0);
    if (this.is('?')) {
      var q = this.next(), a = this.expr();
      this.expect(':', 'im `?:`-Operator');
      return { k: 'cond', c: c, a: a, b: this.cond(), line: q.line, col: q.col };
    }
    return c;
  };
  P.binary = function (lv) {
    if (lv >= BIN_LEVELS.length) return this.unary();
    var l = this.binary(lv + 1);
    for (;;) {
      var t = this.peek();
      if (t.t !== 'op' || BIN_LEVELS[lv].indexOf(t.v) < 0) return l;
      this.next();
      var r = this.binary(lv + 1);
      l = { k: t.v === '&&' ? 'and' : (t.v === '||' ? 'or' : 'bin'), op: t.v, l: l, r: r, line: t.line, col: t.col };
    }
  };
  P.castAhead = function () {
    var t = this.peek(1);
    return this.is('(') && t.t === 'id' && !!(T[t.v] || BAD_TYPES[t.v] || QUAL[t.v] || UNSUP[t.v]);
  };
  P.unary = function () {
    var t = this.peek();
    if (t.t === 'op') {
      if (t.v === '++' || t.v === '--') { this.next(); return { k: 'inc', op: t.v, pre: true, t: this.unary(), line: t.line, col: t.col }; }
      if (t.v === '+' || t.v === '-' || t.v === '!' || t.v === '~') { this.next(); return { k: 'un', op: t.v, e: this.unary(), line: t.line, col: t.col }; }
      if (t.v === '&') err('Adressen (`&variable`) und Zeiger werden im Simulator nicht unterstützt.', t);
      if (t.v === '*') err('Zeiger (`*p`) werden im Simulator nicht unterstützt.', t);
      if (this.castAhead()) {
        this.next();
        var sp = this.typeSpec(false);
        this.expect(')', 'nach dem Typ im Cast');
        return { k: 'cast', ty: sp.ty, e: this.unary(), line: t.line, col: t.col };
      }
    }
    if (t.t === 'id' && t.v === 'sizeof') {
      this.next();
      if (this.castAhead()) {
        this.next();
        var s2 = this.typeSpec(false);
        this.expect(')', 'nach dem Typ in `sizeof(…)`');
        return { k: 'sizeof', sty: s2.ty, line: t.line, col: t.col };
      }
      return { k: 'sizeof', e: this.unary(), line: t.line, col: t.col };
    }
    return this.postfix();
  };
  P.postfix = function () {
    var e = this.primary();
    for (;;) {
      var t = this.peek();
      if (t.t !== 'op') return e;
      if (t.v === '[') {
        this.next();
        var ix = this.expr();
        this.expect(']', 'nach dem Index');
        e = { k: 'idx', a: e, i: ix, line: t.line, col: t.col };
      } else if (t.v === '(') {
        if (e.k !== 'id') err('Nur Funktionen kann man mit `(…)` aufrufen.', t);
        this.next();
        var args = [];
        if (!this.is(')')) { do args.push(this.assign()); while (this.accept(',')); }
        this.expect(')', 'nach den Argumenten');
        e = { k: 'call', name: e.name, args: args, line: e.line, col: e.col };
      } else if (t.v === '++' || t.v === '--') {
        this.next();
        e = { k: 'inc', op: t.v, pre: false, t: e, line: t.line, col: t.col };
      } else if (t.v === '.' || t.v === '->') err('Structs und Zeiger (`' + t.v + '`) werden im Simulator nicht unterstützt.', t);
      else return e;
    }
  };
  P.primary = function () {
    var t = this.next();
    if (t.t === 'num') return { k: 'num', v: t.v, ty: t.ty, line: t.line, col: t.col };
    if (t.t === 'str') err('Zeichenketten ("…") werden im Simulator nicht unterstützt – das Board hat ja keinen Bildschirm. Zeig Werte auf den LEDs an.', t);
    if (t.t === 'id') {
      if (T[t.v] || BAD_TYPES[t.v]) err('Der Typ `' + t.v + '` darf hier nicht stehen. Eine Deklaration gehört an den Anfang einer Anweisung.', t);
      if (KEYWORDS[t.v]) err('`' + t.v + '` darf hier nicht stehen.', t);
      return { k: 'id', name: t.v, line: t.line, col: t.col };
    }
    if (t.t === 'op' && t.v === '(') {
      var e = this.expr();
      this.expect(')');
      e.paren = true;
      return e;
    }
    if (t.t === 'eof') err('Unerwartetes Dateiende – fehlt noch etwas (z.B. `}` oder `;`)?', t);
    err('Hier wird ein Wert oder eine Variable erwartet, gefunden: ' + show(t) + '.', t);
  };

  /* ---------- Rechnen (gemeinsam fuer Pruefung und Laufzeit) ---------- */
  var FLAG = 0, EXACT = 0n;   // 1 = vorzeichenbehafteter Ueberlauf, 2 = Schiebeweite, 4 = Division durch 0
  function calc(op, l, r, ct) {
    FLAG = 0;
    var i = T[ct], x;
    if (op === '<<' || op === '>>') {
      var lv = wrapT(l, ct);
      if (r < 0n || r >= BigInt(i.bits)) { FLAG = 2; return op === '<<' ? 0n : (lv < 0n ? -1n : 0n); }
      return wrapT(op === '<<' ? lv << r : lv >> r, ct);
    }
    l = wrapT(l, ct); r = wrapT(r, ct);
    switch (op) {
      case '+': x = l + r; break;
      case '-': x = l - r; break;
      case '*': x = l * r; break;
      case '/': if (r === 0n) { FLAG = 4; return 0n; } x = l / r; break;
      case '%': if (r === 0n) { FLAG = 4; return 0n; } x = l % r; break;
      case '&': return l & r;
      case '|': return l | r;
      case '^': return l ^ r;
      case '==': return l === r ? 1n : 0n;
      case '!=': return l !== r ? 1n : 0n;
      case '<': return l < r ? 1n : 0n;
      case '>': return l > r ? 1n : 0n;
      case '<=': return l <= r ? 1n : 0n;
      case '>=': return l >= r ? 1n : 0n;
    }
    var w = wrapT(x, ct);
    if (w !== x && i.s) { FLAG = 1; EXACT = x; }
    return w;
  }
  function unop(op, v, ty) {
    FLAG = 0;
    if (op === '!') return v === 0n ? 1n : 0n;
    v = wrapT(v, ty);
    if (op === '+') return v;
    if (op === '~') return wrapT(~v, ty);
    var w = wrapT(-v, ty);
    if (w !== -v && T[ty].s) { FLAG = 1; EXACT = -v; }
    return w;
  }
  function constEval(n) {
    var a, b;
    switch (n.k) {
      case 'num': case 'sizeof': return n.v;
      case 'un': a = constEval(n.e); return a === null ? null : unop(n.op, a, n.ty);
      case 'bin': a = constEval(n.l); b = constEval(n.r); if (a === null || b === null) return null; a = calc(n.op, a, b, n.ct); return FLAG === 4 ? null : a;
      case 'cast': a = constEval(n.e); return a === null ? null : wrapT(a, n.ty);
      case 'cond': a = constEval(n.c); if (a === null) return null; b = constEval(a !== 0n ? n.a : n.b); return b === null ? null : wrapT(b, n.ty);
      default: return null;
    }
  }

  /* ---------- Pruefung: Namen, Typen, Grenzen ---------- */
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[a.length][b.length];
  }

  function check(prog, info, diag) {
    var funcs = Object.create(null), warned = {};
    function warn(at, text, kind) {
      var key = (kind || 'warn') + at.line + text;
      if (warned[key]) return;
      warned[key] = 1;
      diag.push({ kind: kind || 'warn', line: at.line, col: at.col, text: text });
    }
    prog.funcList.forEach(function (f) {
      if (BUILTINS[f.name] || REGS[f.name]) err('Der Name `' + f.name + '` ist schon vergeben.', f);
      var ex = funcs[f.name];
      if (ex) {
        if (ex.body && f.body) err('Die Funktion `' + f.name + '` gibt es schon (Zeile ' + ex.line + ').', f);
        if (ex.params.length !== f.params.length || ex.ret !== f.ret) err('Die Funktion `' + f.name + '` passt nicht zu ihrer Deklaration in Zeile ' + ex.line + '.', f);
        if (f.body) funcs[f.name] = f;
      } else funcs[f.name] = f;
    });
    var main = funcs.main;
    if (!main || !main.body) {
      var tip = (funcs.setup || funcs.loop) ? ' `setup()` und `loop()` gibt es nur bei Arduino – in C startet alles in `main`.' : '';
      err('Es fehlt die Funktion `int main(void) { … }` – dort startet das Programm.' + tip, { line: 1, col: 1 });
    }
    if (main.ret === 'void') warn(main, '`main` sollte `int` zurückgeben: `int main(void)`.');
    if (main.params.length) err('`main` hat auf dem Mikrocontroller keine Parameter: `int main(void)`.', main);

    var scopes = [new Map()];
    function lookup(name) {
      for (var i = scopes.length - 1; i >= 0; i--) { var s = scopes[i].get(name); if (s) return s; }
      return null;
    }
    function undecl(name, at) {
      if (HW_UNSUP.test(name)) err('`' + name + '`' + HW_MSG, at);
      if (name === 'true' || name === 'false') err('`' + name + '` gibt es nur mit <stdbool.h> – nimm hier `' + (name === 'true' ? 1 : 0) + '`.', at);
      if (name === 'NULL') err('`NULL` (Zeiger) wird im Simulator nicht unterstützt.', at);
      if (name === 'F_CPU') err('`F_CPU` ist nicht definiert – schreib oben `#define F_CPU 16000000UL`.', at);
      var best = null, bd = 3;
      scopes.forEach(function (sc) { sc.forEach(function (v, k) { var d = k.toLowerCase() === name.toLowerCase() ? 0 : lev(k, name); if (d < bd) { bd = d; best = k; } }); });
      Object.keys(REGS).forEach(function (k) { var d = k.toLowerCase() === name.toLowerCase() ? 0 : lev(k, name); if (d < bd && d < 2) { bd = d; best = k; } });
      err('Die Variable `' + name + '` wurde nicht deklariert.' + (best ? ' Meintest du `' + best + '`?' : ' Deklariere sie zuerst, z.B. `uint8_t ' + name + ' = 0;`.'), at);
    }
    function declare(d, isGlobal) {
      if (REGS[d.name]) err('`' + d.name + '` ist schon vergeben (LED-Ausgabe) – nimm einen anderen Namen.', d);
      if (isGlobal && funcs[d.name]) err('`' + d.name + '` ist schon eine Funktion.', d);
      var sc = scopes[scopes.length - 1];
      if (sc.has(d.name)) err('Die Variable `' + d.name + '` wurde in diesem Block schon deklariert (Zeile ' + sc.get(d.name).line + ').', d);
      if (d.arr) {
        if (d.sizeExpr) {
          ex(d.sizeExpr);
          var n = constEval(d.sizeExpr);
          if (n === null) err('Die Arraygrösse muss eine feste Zahl sein (z.B. `8` oder ein `#define`).', d.sizeExpr);
          if (n < 1n) err('Ein Array braucht mindestens 1 Element.', d.sizeExpr);
          if (n > 100000n) n = 100000n;
          d.len = Number(n);
        } else if (d.list) d.len = d.list.length;
        else err('Bei `' + d.name + '[]` ohne Grösse braucht es eine Liste, z.B. `= {1, 2, 4}`.', d);
        if (d.list && d.list.length > d.len) err('Zu viele Werte für `' + d.name + '[' + d.len + ']`: ' + d.list.length + ' Stück.', d);
        if (d.init) err('Ein Array füllt man mit einer Liste `{…}`, z.B. `= {1, 2, 4}`.', d);
        if (d.list) d.list.forEach(function (e) { ex(e); });
      } else {
        if (d.list) err('Geschweifte Klammern `{…}` gibt es nur bei Arrays.', d);
        if (d.init) ex(d.init);
      }
      if (d.isConst && !d.init && !d.list) err('Die `const`-Variable `' + d.name + '` braucht gleich einen Startwert.', d);
      d.bytes = T[d.ty].bytes * (d.arr ? d.len : 1);
      if (d.arr && d.len > MAX_ARR) err('Das Array `' + d.name + '` ist mit ' + d.len + ' Elementen zu gross für den Simulator (höchstens ' + MAX_ARR + ').', d);
      sc.set(d.name, d);
    }
    function lvalue(t, op) {
      if (t.k === 'id') {
        if (t.ref === 'reg') return;
        if (t.sym.isConst) err('`' + t.name + '` ist `const` und darf nicht verändert werden.', t);
        return;
      }
      if (t.k === 'idx') { if (t.sym.isConst) err('`' + t.sym.name + '` ist `const` und darf nicht verändert werden.', t); return; }
      err('Links von `' + op + '` muss eine Variable stehen.', t);
    }
    function call(n) {
      var b = BUILTINS[n.name];
      if (b) {
        if (n.args.length !== b.n) err('`' + n.name + '` erwartet genau ' + b.n + ' Argument.', n);
        n.args.forEach(function (a) { ex(a); });
        n.builtin = n.name;
        if (n.name !== '_BV' && !info.includes['util/delay.h']) warn(n, 'Für `' + n.name + '` braucht es `#include <util/delay.h>` (und davor `#define F_CPU 16000000UL`).');
        return b.ret;
      }
      var f = funcs[n.name];
      if (!f) {
        if (lookup(n.name)) err('`' + n.name + '` ist eine Variable, keine Funktion.', n);
        if (REGS[n.name]) err('`' + n.name + '` ist die LED-Ausgabe, keine Funktion.', n);
        err(FN_TIPS[n.name] ? 'Die Funktion `' + n.name + '` gibt es hier nicht. ' + FN_TIPS[n.name] : 'Die Funktion `' + n.name + '` ist unbekannt.', n);
      }
      if (!f.body) err('Die Funktion `' + n.name + '` ist nur deklariert – der Rumpf `{ … }` fehlt.', n);
      if (f.name === 'main') err('`main` ruft man nicht selbst auf.', n);
      if (n.args.length !== f.params.length) err('`' + n.name + '` erwartet ' + f.params.length + ' Argument' + (f.params.length === 1 ? '' : 'e') + ', hier sind es ' + n.args.length + '.', n);
      n.args.forEach(function (a) { ex(a); });
      n.fn = f;
      return f.ret;
    }
    function ex(n, voidOk) {
      var ty, s;
      switch (n.k) {
        case 'num': ty = n.ty; break;
        case 'id':
          s = lookup(n.name);
          if (s) {
            if (s.arr && !n.arrOk) err('`' + n.name + '` ist ein Array – nimm ein Element mit Index, z.B. `' + n.name + '[0]`.', n);
            n.ref = 'var'; n.sym = s; ty = s.ty; break;
          }
          if (REGS[n.name]) { n.ref = 'reg'; ty = REGS[n.name].ty; break; }
          if (funcs[n.name] || BUILTINS[n.name]) err('`' + n.name + '` ist eine Funktion – zum Aufrufen braucht es Klammern: `' + n.name + '(…)`.', n);
          undecl(n.name, n);
          break;
        case 'idx':
          if (n.a.k !== 'id') err('Nur Arrays kann man mit `[ ]` indizieren.', n);
          s = lookup(n.a.name);
          if (!s) {
            if (REGS[n.a.name]) err('`' + n.a.name + '` ist kein Array. Ein einzelnes Bit liest du z.B. mit `(' + n.a.name + ' >> 3) & 1`.', n);
            undecl(n.a.name, n.a);
          }
          if (!s.arr) err('`' + n.a.name + '` ist kein Array.', n);
          n.sym = s;
          ex(n.i);
          if (n.i.k === 'num' && (n.i.v < 0n || n.i.v >= BigInt(s.len))) err('Index ' + n.i.v + ' liegt ausserhalb von `' + s.name + '[' + s.len + ']` (erlaubt: 0 bis ' + (s.len - 1) + ').', n.i);
          ty = s.ty; break;
        case 'un': ty = promote(ex(n.e)); if (n.op === '!') ty = 'int16_t'; break;
        case 'bin': {
          var lt = ex(n.l), rt = ex(n.r);
          if (n.op === '<<' || n.op === '>>') { ty = promote(lt); n.ct = ty; }
          else {
            n.ct = common(lt, rt);
            ty = CMP[n.op] ? 'int16_t' : n.ct;
            if (CMP[n.op] && !T[n.ct].s && (T[promote(lt)].s || T[promote(rt)].s)) {
              var sig = T[promote(lt)].s ? n.l : n.r;
              if (!(sig.k === 'num' && sig.v >= 0n)) warn(n, 'Vergleich zwischen Typen mit und ohne Vorzeichen: Negative Werte werden dabei zu riesigen positiven Zahlen. Beide Seiten gleich wählen!');
            }
          }
          if ((n.op === '/' || n.op === '%') && n.r.k === 'num' && n.r.v === 0n) err('Division durch 0!', n.r);
          break;
        }
        case 'and': case 'or': ex(n.l); ex(n.r); ty = 'int16_t'; break;
        case 'cond': ex(n.c); ty = common(ex(n.a), ex(n.b)); break;
        case 'cast': ex(n.e); ty = n.ty; break;
        case 'sizeof': {
          var sz;
          if (n.sty) sz = T[n.sty].bytes;
          else if (n.e.k === 'id' && !n.e.paren) {
            n.e.arrOk = true;
            ex(n.e);
            sz = n.e.ref === 'reg' ? T[n.e.ty].bytes : n.e.sym.bytes || T[n.e.sym.ty].bytes * (n.e.sym.arr ? n.e.sym.len : 1);
          } else {
            if (n.e.k === 'id') n.e.arrOk = true;
            ex(n.e);
            sz = n.e.k === 'id' && n.e.sym && n.e.sym.arr ? n.e.sym.bytes : T[n.e.ty].bytes;
          }
          n.v = BigInt(sz); ty = 'uint16_t'; break;
        }
        case 'assign': {
          ty = ex(n.t);
          lvalue(n.t, n.op);
          var vt = ex(n.e);
          if (n.op !== '=') {
            n.bop = n.op.slice(0, -1);
            n.ct = (n.bop === '<<' || n.bop === '>>') ? promote(ty) : common(ty, vt);
            if ((n.bop === '/' || n.bop === '%') && n.e.k === 'num' && n.e.v === 0n) err('Division durch 0!', n.e);
          }
          break;
        }
        case 'inc': ty = ex(n.t); lvalue(n.t, n.op); n.ct = common(ty, 'int16_t'); break;
        case 'call': ty = call(n); break;
        case 'comma': ex(n.l, true); ty = ex(n.r, voidOk); break;
      }
      if (ty === 'void' && !voidOk) err('`' + n.name + '(…)` gibt keinen Wert zurück (`void`) und kann darum nicht in einer Rechnung stehen.', n);
      n.ty = ty;
      return ty;
    }
    function condCheck(c, kw) {
      if (c.k === 'assign' && c.op === '=' && !c.paren) warn(c, 'In der Bedingung von `' + kw + '` steht eine Zuweisung `=`. Meintest du den Vergleich `==`?');
      ex(c);
    }
    function st(s, ctx) {
      switch (s.k) {
        case 'block': scopes.push(new Map()); s.body.forEach(function (x) { st(x, ctx); }); scopes.pop(); break;
        case 'decl': s.items.forEach(function (d) { declare(d, false); }); break;
        case 'expr':
          ex(s.e, true);
          if (s.e.k === 'bin' && CMP[s.e.op]) warn(s, 'Der Vergleich `' + s.e.op + '` hat hier keine Wirkung. Meintest du die Zuweisung `=`?');
          break;
        case 'if': condCheck(s.cond, 'if'); st(s.then, ctx); if (s.els) st(s.els, ctx); break;
        case 'while': case 'do': condCheck(s.cond, 'while'); st(s.body, { fn: ctx.fn, loop: true }); break;
        case 'for':
          scopes.push(new Map());
          if (s.init) st(s.init, ctx);
          if (s.cond) condCheck(s.cond, 'for');
          if (s.step) ex(s.step, true);
          st(s.body, { fn: ctx.fn, loop: true });
          scopes.pop();
          break;
        case 'break': case 'continue':
          if (!ctx.loop) err('`' + s.k + '` geht nur innerhalb einer Schleife.', s);
          break;
        case 'return':
          if (s.e) {
            ex(s.e, ctx.fn.ret === 'void');
            if (ctx.fn.ret === 'void') err('Die Funktion `' + ctx.fn.name + '` ist `void` und gibt nichts zurück – lass den Wert nach `return` weg.', s);
          } else if (ctx.fn.ret !== 'void' && ctx.fn.name !== 'main') warn(s, '`return` ohne Wert in einer Funktion, die `' + ctx.fn.ret + '` zurückgeben soll.');
          break;
      }
    }
    prog.items.forEach(function (it) {
      if (it.decl) { it.decl.items.forEach(function (d) { declare(d, true); }); return; }
      var f = it.fn;
      if (!f.body) return;
      var ps = new Map();
      f.params.forEach(function (p) {
        if (ps.has(p.name)) err('Der Parameter `' + p.name + '` kommt doppelt vor.', p);
        p.bytes = T[p.ty].bytes;
        ps.set(p.name, p);
      });
      scopes.push(ps);
      st(f.body, { fn: f, loop: false });
      scopes.pop();
    });
    return { funcs: funcs };
  }

  function compile(src) {
    var diag = [];
    try {
      var lx = tokenize(String(src == null ? '' : src), diag);
      var prog = new Parser(lx.toks, diag).program();
      var c = check(prog, lx.info, diag);
      diag.sort(function (a, b) { return a.line - b.line; });
      return { ok: true, prog: prog, funcs: c.funcs, diag: diag, info: lx.info };
    } catch (e) {
      if (e instanceof SimError) {
        diag.push({ kind: 'error', line: e.line, col: e.col, text: e.msg });
        return { ok: false, diag: diag, error: e };
      }
      if (e instanceof RangeError) {
        diag.push({ kind: 'error', line: 0, col: 0, text: 'Der Code ist zu tief verschachtelt.' });
        return { ok: false, diag: diag, error: e };
      }
      throw e;
    }
  }

  /* ---------- Interpreter ---------- */
  var BRK = { k: 'break' }, CNT = { k: 'continue' };
  function Machine(compiled) {
    this.c = compiled;
    this.reset();
  }
  var M = Machine.prototype;
  M.reset = function () {
    var r = this.r = {};
    Object.keys(REGS).forEach(function (k) { r[k] = 0; });
    this.cycles = 0; this.steps = 0; this.delays = 0;
    this.globals = new Map(); this.frames = [];
    this.msgs = []; this.once = Object.create(null);
    this.state = 'ready'; this.cur = null; this.gen = null;
    this.ledChanges = 0; this.retval = null; this.errLine = 0;
    this.hwReset();
  };
  M.say = function (kind, at, text, key) {
    var k = kind + ':' + (at ? at.line : 0) + ':' + (key || text);
    if (this.once[k]) return;
    this.once[k] = 1;
    this.msgs.push({ kind: kind, line: at ? at.line : 0, col: at ? at.col : 0, text: text });
  };
  M.drain = function () { var m = this.msgs; this.msgs = []; return m; };
  M.top = function () { return this.frames[this.frames.length - 1]; };
  M.step = function () {
    if (this.state === 'done' || this.state === 'error') return { type: this.state };
    if (!this.gen) { this.gen = this.runMain(); this.state = 'run'; }
    try {
      var r = this.gen.next();
      if (r.done) { this.state = 'done'; this.cur = null; return { type: 'done' }; }
      var v = r.value;
      if (v.delay !== undefined) return { type: 'delay', ms: v.delay };
      this.cur = v; this.cycles += CYC_PER_STEP; this.steps++;
      return { type: 'stmt', node: v };
    } catch (e) {
      var se = e instanceof SimError ? e
        : new SimError(e instanceof RangeError ? 'Zu tiefe Verschachtelung – der Simulator musste abbrechen.' : 'Interner Fehler im Simulator: ' + (e && e.message), this.cur ? this.cur.line : 0, 0);
      this.state = 'error'; this.errLine = se.line;
      this.msgs.push({ kind: 'error', line: se.line, col: se.col, text: se.msg });
      return { type: 'error', error: se };
    }
  };
  M.runMain = function* () {
    var items = this.c.prog.items;
    for (var i = 0; i < items.length; i++) if (items[i].decl) yield* this.declare(items[i].decl, true);
    var main = this.c.funcs.main;
    var rv = yield* this.callFn(main, [], main);
    this.retval = rv;
    this.say('ok', null, 'Programm beendet: `main` ist zu Ende (Rückgabewert ' + rv + '). Auf dem echten Mikrocontroller sollte `main` nie enden – dafür gibt es `while (1) { … }`.');
  };
  M.newScope = function () { var sc = new Map(); this.top().scopes.push(sc); return sc; };
  M.endScope = function () { this.top().scopes.pop(); };
  M.conv = function (v, ty, at, label, isReg) {
    var w = wrapT(v, ty);
    if (w !== v) {
      var i = T[ty];
      if (isReg) this.say('info', at, '`' + label + '` hat nur ' + i.bits + ' Bit: ' + v + ' passt nicht hinein – gespeichert wird ' + w + ' (nur die unteren ' + i.bits + ' Bit).', 'conv');
      else if (i.s) this.say('warn', at, '`' + label + '`: Der Wert ' + v + ' passt nicht in `' + ty + '` (' + i.min + ' bis ' + i.max + ') – gespeichert wird ' + w + '. Bei Typen mit Vorzeichen ist das in C nicht garantiert (implementierungsabhängig); avr-gcc schneidet die oberen Bits ab.', 'conv');
      else this.say('info', at, 'Überlauf: `' + label + '` = ' + v + ' passt nicht in `' + ty + '` (0 bis ' + i.max + ') – gespeichert wird ' + w + '. Bei Typen ohne Vorzeichen ist das genau festgelegt (Rechnung modulo 2^' + i.bits + ').', 'conv');
    }
    return w;
  };
  M.declare = function* (s, isGlobal) {
    yield s;
    for (var k = 0; k < s.items.length; k++) {
      var d = s.items[k];
      var v = { name: d.name, ty: d.ty, arr: d.arr, len: d.len, isConst: d.isConst, bytes: d.bytes, global: isGlobal, line: d.line,
        init: isGlobal || !!d.init || d.arr, v: 0n, data: null };
      if (d.arr) {
        v.data = [];
        for (var j = 0; j < d.len; j++) v.data.push(0n);
        if (d.list) for (j = 0; j < d.list.length; j++) v.data[j] = this.conv(yield* this.ev(d.list[j]), d.ty, d.list[j], d.name + '[' + j + ']');
      } else if (d.init) v.v = this.conv(yield* this.ev(d.init), d.ty, d, d.name);
      if (isGlobal) this.globals.set(d.name, v);
      else { var f = this.top(); f.scopes[f.scopes.length - 1].set(d.name, v); }
    }
  };
  M.lookup = function (name) {
    var f = this.top();
    if (f) for (var i = f.scopes.length - 1; i >= 0; i--) { var v = f.scopes[i].get(name); if (v) return v; }
    return this.globals.get(name);
  };
  M.get = function (name) { var v = this.lookup(name); return v ? (v.arr ? v.data.slice() : v.v) : undefined; };
  M.chkIdx = function (a, i, at) {
    if (i < 0n || i >= BigInt(a.len)) throw new SimError('Index ' + i + ' liegt ausserhalb von `' + a.name + '[' + a.len + ']` (erlaubt: 0 bis ' + (a.len - 1) + '). In echtem C würdest du hier fremden Speicher lesen oder überschreiben!', at.line, at.col);
  };
  M.binop = function (n, op, l, r, ct) {
    var v = calc(op, l, r, ct);
    if (FLAG) {
      if (FLAG === 4) throw new SimError('Division durch 0! Das Programm stoppt hier.', n.line, n.col);
      var i = T[ct];
      if (FLAG === 1) {
        this.say('warn', n, 'Vorzeichenbehafteter Überlauf: ' + EXACT + ' passt nicht in `' + ct + '` (' + i.min + ' bis ' + i.max + '). In echtem C undefiniertes Verhalten – der Simulator rechnet mit Wraparound weiter (' + v + ').' +
          (ct === 'int16_t' ? ' Tipp: Hier wird in `int` (16 Bit) gerechnet. Caste einen Operanden, z.B. `(int32_t)a * b`.' : ''), 'ovf');
      }
      if (FLAG === 2) this.say('warn', n, 'Schiebeweite ' + r + ' passt nicht zu `' + ct + '` (' + i.bits + ' Bit): undefiniertes Verhalten. Tipp: Für 32 Bit `1UL << n` schreiben.', 'shift');
    }
    return v;
  };
  M.peek = function (name) { return this.r[name]; };
  /* ---------- Board-Hardware ---------- */
  M.hwReset = function () {
    this.volt = DEFAULT_VOLT.slice(); this.pine = 0;
    this.adc = { busy: false, done: 0, first: true };
    this.lcd = lcdNew(false);
    this.mx = { sr: 0, latch: 0, pat: [0, 0, 0, 0, 0, 0, 0, 0], seen: [-1e18, -1e18, -1e18, -1e18, -1e18, -1e18, -1e18, -1e18], active: -1 };
    this.touched = Object.create(null);
  };
  M.hint = function (key, text, at, kind) { this.say(kind || 'info', at || this.cur, text, key); };
  M.readReg = function (name, at) {
    var r = this.r, m;
    this.touched[name] = 1;
    if ((m = /^PIN([A-L])$/.exec(name))) {
      var p = m[1], inm = IN_MASK[p] || 0, inp = 0;
      if (p === 'C') return (this.pinc | 0) & 0xFF;
      if (p === 'L') inp = this.pinl | 0;
      if (p === 'E') inp = this.pine | 0;
      return ((inp & inm) | (r['PORT' + p] & r['DDR' + p] & ~inm)) & 0xFF;
    }
    if (name === 'ADCSRA') { this.adcPoll(); return r.ADCSRA; }
    if (name === 'ADC' || name === 'ADCW' || name === 'ADCL' || name === 'ADCH') {
      this.adcPoll();
      if (!(r.ADCSRA & 0x80) && !this.adc.any) this.hint('adcoff', 'Der A/D-Wandler ist noch aus: Setz zuerst `ADEN` in `ADCSRA` und starte eine Messung mit `ADSC`.', at, 'warn');
      var full = (r.ADMUX & 0x20) ? (this.adc.res << 6) & 0xFFFF : this.adc.res | 0;
      if (name === 'ADCL') return full & 0xFF;
      if (name === 'ADCH') return full >> 8;
      return full;
    }
    if (name === 'TCNT3') { var t = this.timer3(); if (t.ps && t.top > 0) return Math.floor(this.cycles / t.ps) % (t.top + 1); }
    return r[name];
  };
  /* Die LEDs zeigen PORTA/PORTB immer an – auch ohne gesetztes DDRA/DDRB (keine Hardware-Stolperfallen). */
  M.vis = function () { var r = this.r; return (r.PORTH & RGB_MASK) * 65536 + (r.PORTB << 8) + r.PORTA; };
  M.setPort = function (name, v) { var b = this.vis(); this.r[name] = v; if (this.vis() !== b) this.ledChanges++; };
  M.writeReg = function (name, v, at) {
    var R = REGS[name], r = this.r, m;
    if (R.ro) throw new SimError('`' + name + '` kannst du nur lesen – es enthält ' + R.what + '.', at && at.line, at && at.col);
    this.touched[name] = 1;
    if ((m = /^PIN([A-L])$/.exec(name))) {
      this.hint('pintoggle', 'Schreiben auf `' + name + '` schaltet die Bits von `PORT' + m[1] + '` um (Toggle) – genau wie auf dem echten ATmega.', at);
      name = 'PORT' + m[1]; v = r[name] ^ v;
    }
    if (name === 'ADCSRA') v = this.adcWrite(r.ADCSRA, v, at);
    var effG = r.PORTG & r.DDRG, effJ = r.PORTJ & r.DDRJ;
    this.setPort(name, v);
    if (name === 'PORTG' || name === 'DDRG') {
      if (name === 'PORTG' && (v & 0x23 & ~r.DDRG)) this.hint('ddrg', 'Für das LCD müssen PG0, PG1 und PG5 Ausgänge sein: `DDRG |= (1 << PG0) | (1 << PG1) | (1 << PG5);` – sonst schaltet `PORTG` nur die Pull-ups ein und das LCD bekommt kein Signal.', at, 'warn');
      this.lcdPins(effG, r.PORTG & r.DDRG, at);
    } else if (name === 'PORTJ' || name === 'DDRJ') {
      if (name === 'PORTJ' && (v & 0x7F & ~r.DDRJ)) this.hint('ddrj', 'Für die LED-Matrix müssen PJ0–PJ6 Ausgänge sein: `DDRJ = 0x7F;`.', at, 'warn');
      this.mxPins(effJ, r.PORTJ & r.DDRJ);
    } else if (name === 'ADMUX' && (v >> 6) === 0) {
      this.hint('aref', '`REFS1:0 = 00` nimmt die Spannung am AREF-Pin als Referenz – auf dem Board hängt dort nur ein Kondensator. Nimm AVCC (5 V): `ADMUX = (1 << REFS0) | …`. Der Simulator rechnet trotzdem mit 5 V.', at, 'warn');
    }
  };

  /* --- A/D-Wandler --- */
  var ADPS = [2, 2, 4, 8, 16, 32, 64, 128];
  M.adcChannel = function () {
    var r = this.r, mux = (r.ADMUX & 0x1F) | ((r.ADCSRB & 0x08) ? 0x20 : 0);
    if (mux <= 7) return mux;
    if (mux >= 0x20 && mux <= 0x27) return mux - 0x20 + 8;
    return -mux - 1;
  };
  M.adcWrite = function (old, v, at) {
    var A = this.adc, keepIF = (old & 0x10) && !(v & 0x10);
    var out = (v & ~0x50) | (keepIF ? 0x10 : 0) | (A.busy ? 0x40 : 0);
    if ((v & 0x40) && !A.busy) {
      if (!(v & 0x80)) { this.hint('adsc', '`ADSC` startet nur eine Messung, wenn der Wandler mit `ADEN` eingeschaltet ist.', at, 'warn'); return out; }
      var ps = ADPS[v & 7];
      if (ps < 64) this.hint('adps', 'ADC-Takt = 16 MHz / ' + ps + ' = ' + (16000 / ps) + ' kHz. Für volle Genauigkeit braucht der ATmega 50–200 kHz – nimm den Teiler 128 (`ADPS2`, `ADPS1`, `ADPS0`).', at);
      A.busy = true; A.ch = this.adcChannel();
      A.done = this.cycles + (A.first ? 25 : 13) * ps; A.first = false;
      out |= 0x40;
    }
    return out;
  };
  M.adcPoll = function () {
    var A = this.adc, r = this.r;
    if (!A.busy || this.cycles < A.done) return;
    A.busy = false; A.any = true;
    var ch = A.ch, refs = r.ADMUX >> 6, vref = refs === 2 ? 1.1 : refs === 3 ? 2.56 : 5.0, res = 0;
    if (ch < 0) this.hint('adcmux', 'Differenz- und Spezialkanäle (`MUX` = ' + (-ch - 1) + ') unterstützt der Simulator nicht – Ergebnis 0. Für ADC8–ADC15: Kanal 0–7 in `ADMUX` und dazu `MUX5` in `ADCSRB`.', null, 'warn');
    else {
      if (ch < 8) this.hint('adc0', 'ADC' + ch + ' (PF' + ch + ') ist auf dem Board nur an einer Stiftleiste – dort hängt nichts, Ergebnis 0. Die Sensoren sind an ADC8–ADC15 (Kanal 8–15, mit `MUX5`).', null);
      res = Math.max(0, Math.min(1023, Math.floor((this.volt[ch] || 0) / vref * 1024)));
    }
    A.res = res;
    r.ADCSRA = (r.ADCSRA & ~0x40) | 0x10;
    if (r.ADCSRA & 0x20) { A.busy = true; A.ch = this.adcChannel(); A.done = this.cycles + 13 * ADPS[r.ADCSRA & 7]; r.ADCSRA |= 0x40; }
  };

  /* --- LCD 4x20 (EA DIP203-4, Controller KS0073/SSD1803) seriell: PG0 = SID, PG1 = SCLK, PG5 = Strom --- */
  function lcdNew(pow) {
    var d = []; for (var i = 0; i < 128; i++) d.push(0x20);
    var c = []; for (i = 0; i < 64; i++) c.push(0);
    return { pow: pow, dd: d, cg: c, ac: 0, cga: 0, inCg: false, id: 1, d: false, c: false, b: false, re: false, nw: false,
      bits: [], sync: true, rw: 0, rs: 0, half: -1, ver: 0, writes: 0 };
  }
  function isStart(b) { return b[0] && b[1] && b[2] && b[3] && b[4] && !b[7]; }
  M.lcdPins = function (o, v, at) {
    var L = this.lcd, pwr = !!(v & 0x20);
    if (pwr !== L.pow) { this.lcd = L = lcdNew(pwr); L.ver = Math.random(); }
    if ((v & 2) && !(o & 2)) {
      if (!pwr) { this.hint('lcdpow', 'Das LCD hat noch keinen Strom – setz zuerst PG5: `PORTG |= (1 << PG5);`.', at, 'warn'); return; }
      this.lcdBit(v & 1, at);
    }
  };
  M.lcdBit = function (bit, at) {
    var L = this.lcd, b;
    L.bits.push(bit);
    if (L.sync) {
      if (L.bits.length > 8) L.bits.shift();
      if (L.bits.length === 8 && isStart(L.bits)) { b = L.bits; L.rw = b[5]; L.rs = b[6]; L.sync = false; L.bits = []; L.half = -1; this.lcdRw(at); }
      return;
    }
    if (L.bits.length < 8) return;
    b = L.bits; L.bits = [];
    if (isStart(b)) { L.rw = b[5]; L.rs = b[6]; L.half = -1; this.lcdRw(at); return; }
    if (b[4] || b[5] || b[6] || b[7]) {
      this.hint('lcdframe', 'Das LCD hat ein ungültiges Paket bekommen: Nach dem Startbyte kommen je Byte zwei Pakete aus 4 Datenbits (LSB zuerst) und 4 Nullen. Es wartet jetzt auf ein neues Startbyte `11111`.', at, 'warn');
      L.sync = true; return;
    }
    var nib = b[0] | b[1] << 1 | b[2] << 2 | b[3] << 3;
    if (L.half < 0) { L.half = nib; return; }
    var x = L.half | nib << 4; L.half = -1;
    if (!L.rw) this.lcdExec(L.rs, x, at);
  };
  M.lcdRw = function (at) { if (this.lcd.rw) this.hint('lcdread', 'Lesen vom LCD (R/W = 1) unterstützt der Simulator nicht – warte stattdessen mit `_delay_us(…)`.', at); };
  M.lcdExec = function (rs, x, at) {
    var L = this.lcd;
    L.ver++; L.writes++;
    if (rs) {
      if (L.inCg) { L.cg[L.cga] = x & 0x1F; L.cga = (L.cga + (L.id ? 1 : 63)) & 63; return; }
      L.dd[L.ac] = x; L.ac = (L.ac + (L.id ? 1 : 127)) & 127;
      if (!L.d) this.hint('lcdoff', 'Das LCD bekommt Zeichen, ist aber noch ausgeschaltet. Nach dem Einschalten ist das Display aus – sende den Befehl `0x0C` (Display an).', at);
      return;
    }
    if (x & 0x80) { if (!L.re) { L.ac = x & 0x7F; L.inCg = false; } return; }
    if (x & 0x40) { if (!L.re) { L.cga = x & 0x3F; L.inCg = true; } return; }
    if (x & 0x20) { L.re = !!(x & 4); return; }
    if (x & 0x10) { if (!L.re && !(x & 8)) { L.ac = (L.ac + (x & 4 ? 1 : 127)) & 127; L.inCg = false; } return; }
    if (x & 0x08) { if (L.re) L.nw = !!(x & 1); else { L.d = !!(x & 4); L.c = !!(x & 2); L.b = !!(x & 1); } return; }
    if (x & 0x04) { if (!L.re) L.id = (x & 2) ? 1 : 0; return; }
    if (x & 0x02) { L.ac = 0; L.inCg = false; return; }
    if (x === 1) { for (var i = 0; i < 128; i++) L.dd[i] = 0x20; L.ac = 0; L.id = 1; L.inCg = false; }
  };
  /* DDRAM-Adresse einer Zeile: 4-Zeilen-Modus 0x00/0x20/0x40/0x60, sonst wie HD44780 0x00/0x40/0x14/0x54 */
  function lcdAddr(L, row, col) { return L.nw ? row * 0x20 + col : [0x00, 0x40, 0x14, 0x54][row] + col; }

  /* --- Timer 3 / Servos --- */
  var T3_PS = [0, 1, 8, 64, 256, 1024, 0, 0];
  M.timer3 = function () {
    var r = this.r, cs = r.TCCR3B & 7, wgm = ((r.TCCR3B >> 3) & 3) << 2 | (r.TCCR3A & 3), top = -1, dual = false;
    switch (wgm) {
      case 1: top = 255; dual = true; break;
      case 2: top = 511; dual = true; break;
      case 3: top = 1023; dual = true; break;
      case 5: top = 255; break;
      case 6: top = 511; break;
      case 7: top = 1023; break;
      case 8: case 10: top = r.ICR3; dual = true; break;
      case 9: case 11: top = r.OCR3A; dual = true; break;
      case 14: top = r.ICR3; break;
      case 15: top = r.OCR3A; break;
    }
    return { cs: cs, ps: T3_PS[cs], wgm: wgm, top: top, dual: dual };
  };
  M.servo = function (ch) {
    var r = this.r, t = this.timer3(), A = ch === 'A', pin = A ? 3 : 4;
    var com = A ? (r.TCCR3A >> 6) & 3 : (r.TCCR3A >> 4) & 3, ocr = A ? r.OCR3A : r.OCR3B;
    if (!(r.DDRE & (1 << pin))) return { on: false, why: 'PE' + pin + ' ist kein Ausgang (DDRE)' };
    if (!t.ps) return { on: false, why: t.cs >= 6 ? 'externer Takt – gibt es hier nicht' : 'Timer 3 läuft nicht (CS32:0 = 0)' };
    if (t.top < 0) return { on: false, why: 'kein PWM-Modus (WGM3 = ' + t.wgm + ')' };
    if (com < 2) return { on: false, why: 'PWM-Ausgang aus (COM3' + ch + '1 = 0)' };
    if (A && (t.wgm === 15 || t.wgm === 11)) return { on: false, why: 'OCR3A ist hier TOP – nimm Modus 14 mit ICR3' };
    if (t.top < 1) return { on: false, why: 'TOP ist 0' };
    var tick = t.ps / F_CPU, period = (t.dual ? 2 * t.top : t.top + 1) * tick;
    var high = (t.dual ? 2 * Math.min(ocr, t.top) : Math.min(ocr + 1, t.top + 1)) * tick;
    if (com === 3) high = period - high;
    var ms = high * 1000;
    return { on: true, period: period, high: high, angle: Math.max(0, Math.min(180, (ms - 1) * 180)) };
  };

  /* --- LED-Matrix: 74AC138 (PJ0–PJ2 = A, B, C; PJ3 = G1) waehlt die Zeile, Schieberegister (PJ4 = CLK, PJ5 = DATA, PJ6 = STROBE) die Spalten --- */
  var MX_KEEP = 25 * F_CPU / 1000;   /* so lange (Simulationszeit) leuchtet eine Zeile nach */
  M.mxPins = function (o, v) {
    var X = this.mx;
    if ((v & 0x10) && !(o & 0x10)) { X.sr = ((X.sr << 1) | (v >> 5 & 1)) & 0xFF; if (v & 0x40) X.latch = X.sr; }
    if ((v & 0x40) && !(o & 0x40)) X.latch = X.sr;
    this.mxRow((v & 0x08) ? (v & 7) : -1);
  };
  M.mxRow = function (row) {
    var X = this.mx;
    if (X.active >= 0) { X.pat[X.active] = X.latch; X.seen[X.active] = this.cycles; }
    X.active = row;
    if (row >= 0) { X.pat[row] = X.latch; X.seen[row] = this.cycles; }
  };
  M.matrix = function () {
    var X = this.mx, out = [];
    this.mxRow(X.active);
    for (var i = 0; i < 8; i++) out.push(this.cycles - X.seen[i] <= MX_KEEP ? X.pat[i] : 0);
    return out;
  };
  M.loc = function* (t) {
    if (t.k === 'id') return t.ref === 'reg' ? { reg: t.name } : { v: this.lookup(t.name) };
    var a = this.lookup(t.a.name), i = yield* this.ev(t.i);
    this.chkIdx(a, i, t);
    return { v: a, i: Number(i) };
  };
  M.getLoc = function (L, t) {
    if (L.reg) return BigInt(this.readReg(L.reg, t));
    if (L.i !== undefined) return L.v.data[L.i];
    if (!L.v.init) this.uninit(L.v, t);
    return L.v.v;
  };
  M.setLoc = function (L, val, at) {
    if (L.reg) { var w = this.conv(val, REGS[L.reg].ty, at, L.reg, true); this.writeReg(L.reg, Number(w), at); return w; }
    var idx = L.i !== undefined;
    var w2 = this.conv(val, L.v.ty, at, idx ? L.v.name + '[' + L.i + ']' : L.v.name);
    if (idx) L.v.data[L.i] = w2; else { L.v.v = w2; L.v.init = true; }
    return w2;
  };
  M.uninit = function (v, at) {
    this.say('warn', at, 'Die Variable `' + v.name + '` wird gelesen, bevor sie einen Wert bekommen hat. In echtem C steht dann ein zufälliger Wert drin – der Simulator nimmt 0.', 'uninit');
  };
  M.ev = function* (n) {
    var a, b, v;
    switch (n.k) {
      case 'num': case 'sizeof': return n.v;
      case 'id':
        if (n.ref === 'reg') return BigInt(this.readReg(n.name, n));
        v = this.lookup(n.name);
        if (!v.init) this.uninit(v, n);
        return v.v;
      case 'idx':
        v = this.lookup(n.a.name); a = yield* this.ev(n.i);
        this.chkIdx(v, a, n);
        return v.data[Number(a)];
      case 'un':
        a = unop(n.op, yield* this.ev(n.e), n.ty);
        if (FLAG === 1) this.say('warn', n, 'Vorzeichenbehafteter Überlauf: ' + EXACT + ' passt nicht in `' + n.ty + '`. In echtem C undefiniertes Verhalten – der Simulator rechnet mit Wraparound weiter (' + a + ').', 'ovf');
        return a;
      case 'bin':
        a = yield* this.ev(n.l); b = yield* this.ev(n.r);
        return this.binop(n, n.op, a, b, n.ct);
      case 'and':
        if ((yield* this.ev(n.l)) === 0n) return 0n;
        return (yield* this.ev(n.r)) !== 0n ? 1n : 0n;
      case 'or':
        if ((yield* this.ev(n.l)) !== 0n) return 1n;
        return (yield* this.ev(n.r)) !== 0n ? 1n : 0n;
      case 'cond':
        if ((yield* this.ev(n.c)) !== 0n) a = yield* this.ev(n.a); else a = yield* this.ev(n.b);
        return wrapT(a, n.ty);
      case 'cast': return wrapT(yield* this.ev(n.e), n.ty);
      case 'assign': {
        var L = yield* this.loc(n.t), rhs = yield* this.ev(n.e);
        var nv = n.op === '=' ? rhs : this.binop(n, n.bop, this.getLoc(L, n.t), rhs, n.ct);
        return this.setLoc(L, nv, n);
      }
      case 'inc': {
        var L2 = yield* this.loc(n.t), old = this.getLoc(L2, n.t);
        var st = this.setLoc(L2, this.binop(n, n.op === '++' ? '+' : '-', old, 1n, n.ct), n);
        return n.pre ? st : old;
      }
      case 'call': return yield* this.call(n);
      case 'comma': yield* this.ev(n.l); return yield* this.ev(n.r);
    }
    throw new SimError('Unbekannter Ausdruck.', n.line, n.col);
  };
  M.call = function* (n) {
    var i, args = [];
    if (n.builtin) {
      var a = yield* this.ev(n.args[0]);
      if (n.builtin === '_BV') return this.binop(n, '<<', 1n, a, 'int16_t');
      var ms = a < 0n ? 0 : Number(a);
      if (n.builtin === '_delay_us') ms /= 1000;
      if (ms > 60000) { this.say('info', n, 'Sehr lange Wartezeit: ' + ms + ' ms.', 'longdelay'); }
      this.cycles += Math.round(ms * (F_CPU / 1000));
      this.delays++;
      yield { delay: ms };
      return 0n;
    }
    for (i = 0; i < n.args.length; i++) args.push(yield* this.ev(n.args[i]));
    return yield* this.callFn(n.fn, args, n);
  };
  M.callFn = function* (f, args, at) {
    if (this.frames.length >= MAX_DEPTH) throw new SimError('Zu tiefe Verschachtelung bzw. Rekursion (' + MAX_DEPTH + ' Aufrufe). Der Simulator bricht hier ab.', at.line, at.col);
    var sc = new Map();
    this.frames.push({ fn: f, scopes: [sc] });
    for (var i = 0; i < f.params.length; i++) {
      var p = f.params[i];
      var v = { name: p.name, ty: p.ty, arr: false, isConst: p.isConst, bytes: p.bytes, init: true, v: this.conv(args[i], p.ty, at, p.name), line: p.line };
      sc.set(p.name, v);
    }
    var c = yield* this.ex(f.body);
    this.frames.pop();
    if (c && c.k === 'return' && c.v !== null) return f.ret === 'void' ? 0n : this.conv(c.v, f.ret, c.node, 'Rückgabewert von ' + f.name);
    if (f.ret !== 'void' && f.name !== 'main') this.say('warn', at, 'Die Funktion `' + f.name + '` endet ohne `return` – der Rückgabewert ist dann zufällig (Simulator: 0).', 'noret');
    return 0n;
  };
  M.ex = function* (s) {
    var c, i;
    switch (s.k) {
      case 'block':
        this.newScope();
        c = null;
        for (i = 0; i < s.body.length; i++) { c = yield* this.ex(s.body[i]); if (c) break; }
        this.endScope();
        return c;
      case 'decl': yield* this.declare(s, false); return null;
      case 'expr': yield s; yield* this.ev(s.e); return null;
      case 'if':
        yield s;
        if ((yield* this.ev(s.cond)) !== 0n) return yield* this.ex(s.then);
        return s.els ? yield* this.ex(s.els) : null;
      case 'while':
        for (;;) {
          yield s;
          if ((yield* this.ev(s.cond)) === 0n) return null;
          c = yield* this.ex(s.body);
          if (c) { if (c === BRK) return null; if (c !== CNT) return c; }
        }
      case 'do':
        for (;;) {
          c = yield* this.ex(s.body);
          if (c) { if (c === BRK) return null; if (c !== CNT) return c; }
          yield s.w;
          if ((yield* this.ev(s.cond)) === 0n) return null;
        }
      case 'for': {
        this.newScope();
        var res = null;
        if (s.init) {
          if (s.init.k === 'decl') yield* this.declare(s.init, false);
          else { yield s; yield* this.ev(s.init.e); }
        }
        for (;;) {
          yield s;
          if (s.cond && (yield* this.ev(s.cond)) === 0n) break;
          c = yield* this.ex(s.body);
          if (c) { if (c === BRK) break; if (c !== CNT) { res = c; break; } }
          if (s.step) yield* this.ev(s.step);
        }
        this.endScope();
        return res;
      }
      case 'break': yield s; return BRK;
      case 'continue': yield s; return CNT;
      case 'return': {
        yield s;
        var rv = s.e ? yield* this.ev(s.e) : null;
        return { k: 'return', v: rv, node: s };
      }
      case 'empty': return null;
    }
    throw new SimError('Unbekannte Anweisung.', s.line, s.col);
  };
  function toBin(v, ty) {
    var b = T[ty].bits, s = BigInt.asUintN(b, v).toString(2);
    while (s.length < b) s = '0' + s;
    return s.replace(/(\d{4})(?=\d)/g, '$1 ');
  }
  function toHex(v, ty) {
    var b = T[ty].bits, s = BigInt.asUintN(b, v).toString(16).toUpperCase();
    while (s.length < b / 4) s = '0' + s;
    return '0x' + s;
  }
  M.listVars = function () {
    var out = [];
    function fmtv(v, scope) {
      var val, bin;
      if (v.arr) {
        val = '{' + v.data.slice(0, 8).map(String).join(', ') + (v.len > 8 ? ', …' : '') + '}';
        bin = v.len + ' × ' + T[v.ty].bytes + ' B';
      } else {
        val = v.init ? v.v.toString() : '?';
        bin = T[v.ty].bits <= 16 ? toBin(v.v, v.ty) : toHex(v.v, v.ty);
      }
      return { name: v.arr ? v.name + '[' + v.len + ']' : v.name, ty: v.ty, value: val, bin: bin, scope: scope, init: v.init };
    }
    var names = {};
    var f = this.top();
    var locals = [];
    if (f) {
      for (var i = f.scopes.length - 1; i >= 0; i--) {
        f.scopes[i].forEach(function (v, k) { if (!names[k]) { names[k] = 1; locals.unshift(fmtv(v, f.fn.name)); } });
      }
    }
    this.globals.forEach(function (v, k) { out.push(fmtv(v, names[k] ? 'global (verdeckt)' : 'global')); });
    return out.concat(locals);
  };

  /* Headless: Programm laufen lassen (Tests, Challenges) */
  function runSteps(m, maxSteps) {
    for (var i = 0; i < maxSteps; i++) {
      var r = m.step();
      if (r.type === 'done' || r.type === 'error') return r.type;
    }
    return 'limit';
  }
  function run(src, opts) {
    opts = opts || {};
    var c = compile(src);
    if (!c.ok) return { c: c, ok: false };
    var m = new Machine(c);
    var end = runSteps(m, opts.maxSteps || 200000);
    return { c: c, m: m, ok: true, end: end };
  }
  function hex2(v) { var s = (v & 0xFF).toString(2); while (s.length < 8) s = '0' + s; return '0b' + s; }
  function runCheck(src, chk) {
    var c = compile(src);
    if (!c.ok) return { ok: false, msg: 'Erst den Fehler beheben: Zeile ' + c.error.line + ': ' + c.error.msg };
    var m = new Machine(c), steps = 0, LIMIT = 3000000, seq = [], last = -1, ended = false;
    var phases = chk.phases || [];
    for (var p = 0; p < phases.length; p++) {
      var ph = phases[p];
      var end = m.cycles + ph.ms * (F_CPU / 1000);
      while (!ended && m.cycles < end) {
        var r = m.step();
        steps++;
        if (r.type === 'error') return { ok: false, msg: 'Laufzeitfehler in Zeile ' + r.error.line + ': ' + r.error.msg };
        if (r.type === 'done') ended = true;
        if (chk.seq) {
          var pv = m.r['PORT' + chk.seq.port];
          if (pv !== last) { seq.push(pv); last = pv; if (seq.length > 5000) seq.shift(); }
        }
        if (steps > LIMIT) return { ok: false, msg: 'Die Prüfung hat abgebrochen: zu viele Anweisungen ohne Pause. Fehlt ein `_delay_ms(…)`?' };
      }
      if (ph.expect) {
        var bad = [];
        Object.keys(ph.expect).forEach(function (port) {
          var want = ph.expect[port], got = m.r['PORT' + port];
          if (got !== want) bad.push('PORT' + port + ' zeigt ' + hex2(got) + ' (' + got + '), erwartet ' + hex2(want) + ' (' + want + ')');
        });
        if (bad.length) return { ok: false, msg: (ph.say ? ph.say + ': ' : '') + bad.join('; ') + '.' };
      }
    }
    if (chk.seq) {
      var want = chk.seq.contains, s = seq.join(','), w = want.join(',');
      if ((',' + s + ',').indexOf(',' + w + ',') < 0) return { ok: false, msg: 'Die Reihenfolge der LEDs an PORT' + chk.seq.port + ' stimmt noch nicht. Gesehen: ' + seq.slice(0, 20).join(', ') + (seq.length > 20 ? ', …' : '') + '.' };
    }
    return { ok: true, msg: 'Geprüft – passt!' };
  }

  var CSim = {
    T: T, REGS: REGS, PL_BITS: PL_BITS, RGB_BITS: RGB_BITS, ADC_PARTS: ADC_PARTS, DEFAULT_VOLT: DEFAULT_VOLT, lcdAddr: lcdAddr, F_CPU: F_CPU, MAX_ARR: MAX_ARR, CYC_PER_STEP: CYC_PER_STEP,
    compile: compile, Machine: Machine, run: run, runSteps: runSteps, runCheck: runCheck,
    wrapT: wrapT, promote: promote, common: common, toBin: toBin, toHex: toHex, SimError: SimError
  };
  root.CSim = CSim;
  if (typeof module !== 'undefined' && module.exports) module.exports = CSim;
  if (typeof document === 'undefined') return;

  /* =====================================================================
     Oberflaeche (nur im Browser). Bekommt DOM-Helfer von app.js (kein innerHTML).
     ===================================================================== */
  var LS_CODE = 'c-variablentypen-sim-code-v1';
  var LS_MINE = 'c-variablentypen-sim-eigener-code-v1';
  var LS_DONE = 'c-variablentypen-sim-challenges-v1';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignorieren */ } }
  var SPEEDS = [0.25, 0.5, 1, 2, 4, 0];
  var SPEED_LABEL = ['0.25×', '0.5×', '1×', '2×', '4×', 'Turbo'];
  var greeted = false;
  var REG_SHOW = ['PORTA', 'PORTB', 'PORTH', 'PINC', 'PINL'];

  function showSim(main, H) {
    var el = H.el, clear = H.clear, rich = H.rich;
    var EX = typeof SIM_EXAMPLES !== 'undefined' ? SIM_EXAMPLES : [];
    var CH = typeof SIM_CHALLENGES !== 'undefined' ? SIM_CHALLENGES : [];
    var SAYS = typeof SIM_SAYS !== 'undefined' ? SIM_SAYS : {};
    var saved = lsGet(LS_CODE);
    var m = null, mode = 'idle', sleepUntil = 0, raf = 0, runStart = 0, lastDelayT = 0, flickerSaid = false;
    var lastChanges = 0, lastVarPaint = 0, rootEl;

    /* --- Bit --- */
    var bitBox = el('div', { class: 'sim-bit-box' });
    function say(mood, text) { clear(bitBox); bitBox.appendChild(H.mascot(mood, text, 'hero-bit')); }
    say('neutral', SAYS.hello || 'Schreib C-Code und drück auf Start – ich führe ihn auf meinem virtuellen Board aus.');

    /* --- Editor --- */
    var ta = el('textarea', { id: 'sim-code', class: 'sim-ta', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off',
      wrap: 'off', 'aria-label': 'C-Code', 'aria-describedby': 'sim-ed-help', 'aria-autocomplete': 'list', 'aria-controls': 'sim-ac', 'aria-expanded': 'false' });
    ta.value = saved != null && saved.trim() ? saved : (EX[0] ? EX[0].code : 'int main(void)\n{\n    while (1)\n    {\n    }\n}\n');
    var hlInner = el('div', { class: 'sim-hl-inner' });
    var hl = el('pre', { class: 'sim-hl', 'aria-hidden': 'true' }, hlInner);
    var gutInner = el('div', { class: 'sim-gut-inner' });
    var gutter = el('div', { class: 'sim-gutter', 'aria-hidden': 'true' }, gutInner);
    /* --- Editor-Komfort: Vorschläge, Umbenennen, Werkzeuge --- */
    var acBox = el('ul', { class: 'sim-ac', id: 'sim-ac', role: 'listbox', 'aria-label': 'Vorschläge', hidden: true });
    var rnBar = el('div', { class: 'sim-rename', role: 'group', 'aria-label': 'Umbenennen', hidden: true });
    function keepFocus(e) { e.preventDefault(); }
    var codewrap = el('div', { class: 'sim-codewrap' }, [hl, ta, acBox]);
    var editor = el('div', { class: 'sim-editor' }, [
      el('div', { class: 'code-bar' }, [
        el('span', { 'aria-hidden': 'true' }), el('span', { 'aria-hidden': 'true' }), el('span', { 'aria-hidden': 'true' }), el('em', { 'aria-hidden': 'true' }, 'main.c'),
        el('div', { class: 'sim-ed-tools' }, [
          el('button', { type: 'button', class: 'sim-ed-btn', title: 'Zeilen aus- bzw. einkommentieren (Strg+#)', onmousedown: keepFocus, onclick: function () { ta.focus(); toggleComment(); } }, '// Kommentar'),
          el('button', { type: 'button', class: 'sim-ed-btn', title: 'Den Namen unter dem Cursor überall umbenennen (F2)', onmousedown: keepFocus, onclick: function () { openRename(); } }, 'Umbenennen (F2)')
        ])
      ]),
      rnBar,
      el('div', { class: 'sim-ed-body' }, [gutter, codewrap])
    ]);
    var lineEls = [], gutEls = [], curLine = 0, errLine = 0, markWord = '';
    function paint() {
      var lines = ta.value.split('\n');
      clear(hlInner); clear(gutInner); lineEls = []; gutEls = [];
      lines.forEach(function (l, i) {
        var d = el('div', { class: 'sim-line' }, l.length ? H.highlightLine(l, markWord) : ' ');
        hlInner.appendChild(d); lineEls.push(d);
        var g = el('div', null, String(i + 1));
        gutInner.appendChild(g); gutEls.push(g);
      });
      marks();
      syncScroll();
    }
    function marks() {
      lineEls.forEach(function (d, i) {
        d.classList.toggle('cur', i + 1 === curLine);
        d.classList.toggle('err', i + 1 === errLine);
        gutEls[i].classList.toggle('cur', i + 1 === curLine);
        gutEls[i].classList.toggle('err', i + 1 === errLine);
      });
    }
    function setCur(n, scroll) {
      if (n === curLine && !scroll) return;
      curLine = n; marks();
      if (scroll && n) scrollToLine(n);
    }
    function lineH() { return parseFloat(getComputedStyle(ta).lineHeight) || 20; }
    function scrollToLine(n) {
      var lh = lineH(), y = (n - 1) * lh;
      if (y < ta.scrollTop || y + lh > ta.scrollTop + ta.clientHeight - lh) ta.scrollTop = Math.max(0, y - ta.clientHeight / 3);
      syncScroll();
    }
    function syncScroll() {
      hlInner.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (-ta.scrollTop) + 'px)';
      gutInner.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
    }
    function gotoLine(n) {
      var lines = ta.value.split('\n'), pos = 0;
      for (var i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
      ta.focus();
      ta.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
      scrollToLine(n);
    }
    function insertText(str) {
      var ok = false;
      try { ok = document.execCommand('insertText', false, str); } catch (x) { ok = false; }
      if (!ok) { ta.setRangeText(str, ta.selectionStart, ta.selectionEnd, 'end'); onInput(); }
    }
    function indent(out) {
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
      if (s === e && !out) { insertText('    '); return; }
      var ls = v.lastIndexOf('\n', s - 1) + 1, le = e;
      if (e > s && v[e - 1] === '\n') le = e - 1;
      var lend = v.indexOf('\n', le); if (lend < 0) lend = v.length;
      var block = v.slice(ls, lend);
      var nb = block.split('\n').map(function (l) { return out ? l.replace(/^( {1,4}|\t)/, '') : '    ' + l; }).join('\n');
      if (nb === block) return;
      ta.setSelectionRange(ls, lend);
      insertText(nb);
      if (s !== e) ta.setSelectionRange(ls, ls + nb.length);
    }
    function deleteRange(a, b) {
      ta.setSelectionRange(a, b);
      var ok = false;
      try { ok = document.execCommand('delete', false); } catch (x) { ok = false; }
      if (!ok) { ta.setRangeText('', a, b, 'end'); onInput(); }
    }
    var busy = 0;   /* > 0 waehrend eigener Aenderungen: dann keine Vorschlaege ausloesen */
    function internal(fn) { busy++; try { fn(); } finally { busy--; } }

    /* Kommentare, Zeichenketten und #include-Zeilen durch MASK ersetzen (gleiche Laenge, Zeilenumbrueche bleiben) */
    var MASK = '\u0001';
    function maskCode(src) {
      var out = src.split(''), i = 0, n = src.length, j;
      function blank(a, b) { for (var k = a; k < b; k++) if (out[k] !== '\n') out[k] = MASK; }
      while (i < n) {
        var c = src[i], d = src[i + 1];
        if (c === '/' && d === '/') { j = src.indexOf('\n', i); if (j < 0) j = n; blank(i, j); i = j; continue; }
        if (c === '/' && d === '*') { j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; blank(i, j); i = j; continue; }
        if (c === '"' || c === '\'') {
          j = i + 1;
          while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
          if (j < n && src[j] === c) j++;
          j = Math.min(j, n);
          blank(i, j); i = j; continue;
        }
        if (c === '#') {
          var ls = src.lastIndexOf('\n', i - 1) + 1;
          if (/^\s*$/.test(src.slice(ls, i)) && /^#\s*include\b/.test(src.slice(i, i + 24))) { j = src.indexOf('\n', i); if (j < 0) j = n; blank(i, j); i = j; continue; }
        }
        i++;
      }
      return out.join('');
    }
    function inCode(pos) { return pos === 0 || maskCode(ta.value)[pos - 1] !== MASK; }
    var IDC = /[A-Za-z0-9_]/;
    function wordAt(pos, src) {
      var v = src == null ? ta.value : src, s = pos, e = pos;
      while (s > 0 && IDC.test(v[s - 1])) s--;
      while (e < v.length && IDC.test(v[e])) e++;
      if (s === e || /[0-9]/.test(v[s])) return null;
      return { s: s, e: e, t: v.slice(s, e) };
    }
    function occurrences(src, name) {
      var mk = maskCode(src), re = /[A-Za-z_]\w*/g, m, out = [];
      while ((m = re.exec(mk)) !== null) {
        if (m.index > 0 && /[0-9]/.test(mk[m.index - 1])) continue;
        if (m[0] === name) out.push({ s: m.index, e: m.index + m[0].length });
      }
      return out;
    }

    /* Feste Namen (nicht umbenennbar, keine eigenen Vorschlaege) */
    var RESERVED = Object.create(null);
    [KEYWORDS, T, BAD_TYPES, REGS, BUILTINS, PREDEF, QUAL].forEach(function (o) { Object.keys(o).forEach(function (k) { RESERVED[k] = 1; }); });
    ['main', 'F_CPU', 'int', 'true', 'false', 'NULL', 'define', 'include'].forEach(function (k) { RESERVED[k] = 1; });

    /* Deklarierte Namen im Code (fuer Vorschlaege) */
    var TYPE_RE = /\b(u?int(?:8|16|32|64)_t|void|int)\s+(?:const\s+)?([A-Za-z_]\w*)\s*(\(|\[)?/g;
    function symbols(src) {
      var mk = maskCode(src), out = Object.create(null), m;
      function put(name, kind, detail) { if (!RESERVED[name] && !out[name]) out[name] = { name: name, kind: kind, detail: detail }; }
      TYPE_RE.lastIndex = 0;
      while ((m = TYPE_RE.exec(mk)) !== null) {
        if (m[3] === '(') { put(m[2], 'Funktion', m[1]); continue; }
        put(m[2], m[3] === '[' ? 'Array' : 'Variable', m[1]);
        /* weitere Namen derselben Deklaration: uint8_t a = 1, b, c[4]; */
        var depth = 0;
        for (var k = TYPE_RE.lastIndex; k < mk.length; k++) {
          var ch = mk[k];
          if (ch === '(' || ch === '[' || ch === '{') depth++;
          else if (ch === ')' || ch === ']' || ch === '}') { if (--depth < 0) break; }
          else if (ch === ';' && depth === 0) break;
          else if (ch === ',' && depth === 0) {
            var nm = /^\s*([A-Za-z_]\w*)\s*(\[)?/.exec(mk.slice(k + 1, k + 80));
            if (nm) put(nm[1], nm[2] ? 'Array' : 'Variable', m[1]);
          }
        }
      }
      var dre = /^[ \t]*#[ \t]*define[ \t]+([A-Za-z_]\w*)/gm;
      while ((m = dre.exec(src)) !== null) put(m[1], 'Konstante', '#define');
      return out;
    }
    var STATIC_AC = [];
    Object.keys(T).forEach(function (k) { STATIC_AC.push({ name: k, kind: 'Typ', detail: T[k].bits + ' Bit, ' + (T[k].s ? 'mit' : 'ohne') + ' VZ' }); });
    'if else while for do return break continue sizeof const void'.split(' ').forEach(function (k) { STATIC_AC.push({ name: k, kind: 'Schlüsselwort', detail: '' }); });
    var REG_DETAIL = { PORTA: 'LEDs', PORTB: 'LEDs', DDRA: 'Richtung A', DDRB: 'Richtung B', PINC: 'Schalter lesen', PORTC: 'Port C', DDRC: 'Richtung C', PINL: 'Taster lesen', PORTL: 'Port L', DDRL: 'Richtung L', PORTH: 'RGB-LED', DDRH: 'Richtung H' };
    Object.keys(REGS).forEach(function (k) { STATIC_AC.push({ name: k, kind: 'Register', detail: REGS[k].info || REG_DETAIL[k] || '' }); });
    ('REFS0 REFS1 ADLAR MUX5 ADEN ADSC ADATE ADIF ADPS0 ADPS1 ADPS2 COM3A1 COM3B1 WGM30 WGM31 WGM32 WGM33 CS30 CS31 CS32 ' +
      'PG0 PG1 PG5 PE2 PE3 PE4 PJ0 PJ1 PJ2 PJ3 PJ4 PJ5 PJ6').split(' ').forEach(function (k) { STATIC_AC.push({ name: k, kind: 'Bit', detail: 'Bit ' + PREDEF[k] }); });
    PL_BITS.forEach(function (b) { STATIC_AC.push({ name: 'PL' + b, kind: 'Bit', detail: 'Taster ' + b }); });
    RGB_BITS.forEach(function (c) { STATIC_AC.push({ name: 'PH' + c.b, kind: 'Bit', detail: 'RGB ' + c.n }); });
    STATIC_AC.push({ name: '_delay_ms', kind: 'Funktion', detail: 'warten (ms)', call: true });
    STATIC_AC.push({ name: '_delay_us', kind: 'Funktion', detail: 'warten (µs)', call: true });
    STATIC_AC.push({ name: '_BV', kind: 'Funktion', detail: '1 << n', call: true });
    STATIC_AC.push({ name: 'F_CPU', kind: 'Konstante', detail: '16 MHz' });
    var KIND_RANK = { Variable: 0, Array: 0, Funktion: 1, Konstante: 2, Register: 3, Bit: 4, Typ: 5, 'Schlüsselwort': 6 };

    var acItems = [], acSel = 0, cw = 0;
    function acOpen() { return !acBox.hidden; }
    function acClose() {
      if (acBox.hidden) return;
      acBox.hidden = true; clear(acBox); acItems = [];
      ta.removeAttribute('aria-activedescendant'); ta.setAttribute('aria-expanded', 'false');
    }
    function charW() {
      if (cw) return cw;
      var cs = getComputedStyle(ta), cv = document.createElement('canvas').getContext('2d');
      cv.font = cs.fontSize + ' ' + cs.fontFamily;
      cw = cv.measureText('MMMMMMMMMM').width / 10 || 8;
      return cw;
    }
    function caretXY(pos) {
      var v = ta.value, ls = v.lastIndexOf('\n', pos - 1) + 1, line = 0, col = 0, i;
      for (i = 0; i < ls; i++) if (v[i] === '\n') line++;
      for (i = ls; i < pos; i++) col += v[i] === '\t' ? 4 - col % 4 : 1;
      var cs = getComputedStyle(ta);
      return { x: parseFloat(cs.paddingLeft) + col * charW() - ta.scrollLeft, y: parseFloat(cs.paddingTop) + line * lineH() - ta.scrollTop };
    }
    function acUpdate(force) {
      var s = ta.selectionStart;
      if (s !== ta.selectionEnd || !inCode(s)) return acClose();
      var v = ta.value, w = wordAt(s), pre = w ? v.slice(w.s, s) : '';
      if (!pre && !force) return acClose();
      var from = w ? w.s : s;
      /* direkt nach einem Typ wird ein neuer Name erfunden – da passt kein Vorschlag */
      if (!force && /\b(?:u?int(?:8|16|32|64)_t|void)\s+(?:const\s+)?$/.test(v.slice(Math.max(0, from - 30), from))) return acClose();
      var syms = symbols(w ? v.slice(0, w.s) + v.slice(w.e) : v), list = [], seen = Object.create(null), lp = pre.toLowerCase();
      Object.keys(syms).map(function (k) { return syms[k]; }).concat(STATIC_AC).forEach(function (it) {
        if (seen[it.name] || it.name.toLowerCase().indexOf(lp) !== 0) return;
        if (w && it.name === w.t) return;
        seen[it.name] = 1; list.push(it);
      });
      list.sort(function (a, b) {
        var ca = a.name.indexOf(pre) === 0 ? 0 : 1, cb = b.name.indexOf(pre) === 0 ? 0 : 1;
        return ca - cb || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.name.length - b.name.length || (a.name < b.name ? -1 : 1);
      });
      list = list.slice(0, 8);
      if (!list.length) return acClose();
      acItems = list; acSel = 0;
      clear(acBox);
      list.forEach(function (it, i) {
        acBox.appendChild(el('li', { id: 'sim-ac-' + i, role: 'option', class: 'sim-ac-item', 'aria-selected': i === 0 ? 'true' : 'false',
          onmousedown: function (e) { e.preventDefault(); acAccept(i); } }, [
          el('code', null, it.name + (it.call ? '()' : '')),
          el('small', null, it.kind + (it.detail ? ' · ' + it.detail : ''))
        ]));
      });
      acBox.hidden = false;
      ta.setAttribute('aria-expanded', 'true');
      ta.setAttribute('aria-activedescendant', 'sim-ac-0');
      var p = caretXY(from), lh = lineH(), bw = acBox.offsetWidth, bh = acBox.offsetHeight;
      var x = Math.max(4, Math.min(p.x, codewrap.clientWidth - bw - 4));
      var y = p.y + lh + 2;
      if (y + bh > codewrap.clientHeight && p.y - bh - 2 >= 0) y = p.y - bh - 2;
      acBox.style.left = x + 'px'; acBox.style.top = y + 'px';
    }
    function acMove(d) {
      if (!acItems.length) return;
      acSel = (acSel + d + acItems.length) % acItems.length;
      Array.prototype.forEach.call(acBox.children, function (li, i) { li.setAttribute('aria-selected', i === acSel ? 'true' : 'false'); });
      ta.setAttribute('aria-activedescendant', 'sim-ac-' + acSel);
      var li = acBox.children[acSel];
      if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
    }
    function acAccept(i) {
      var it = acItems[i];
      if (!it) return acClose();
      var s = ta.selectionStart, w = wordAt(s), from = w ? w.s : s, to = w ? w.e : s;
      var text = it.name, inside = false;
      if (it.call && ta.value[to] !== '(') { text += '()'; inside = true; }
      ta.setSelectionRange(from, to);
      internal(function () { insertText(text); });
      if (inside) { var p = from + text.length - 1; ta.setSelectionRange(p, p); }
      acClose();
      queueMark();
    }

    /* Alle Stellen des Namens unter dem Cursor markieren */
    var markRaf = 0;
    function updateMark() {
      markRaf = 0;
      var nw = '';
      if (document.activeElement === ta && ta.selectionStart === ta.selectionEnd) {
        var w = wordAt(ta.selectionStart);
        if (w && !KEYWORDS[w.t] && !T[w.t] && !QUAL[w.t] && inCode(w.e) && occurrences(ta.value, w.t).length > 1) nw = w.t;
      }
      if (nw !== markWord) { markWord = nw; paint(); }
    }
    function queueMark() { if (!markRaf) markRaf = requestAnimationFrame(updateMark); }
    ['keyup', 'mouseup', 'focus', 'blur'].forEach(function (ev) { ta.addEventListener(ev, queueMark); });
    function onSelChange() {
      if (rootEl && !rootEl.isConnected) { document.removeEventListener('selectionchange', onSelChange); return; }
      if (document.activeElement === ta && !busy) { queueMark(); if (ta.value === pre.v) snap(); }
    }
    document.addEventListener('selectionchange', onSelChange);

    /* Umbenennen: Leiste ueber dem Editor – als Dialog (F2) oder als Vorschlag nach dem Aendern eines Namens */
    var rnMode = '', sugg = null, rnSess = null;
    function barShow(mode, kids) { rnMode = mode; clear(rnBar); kids.forEach(function (k) { if (k) rnBar.appendChild(k); }); rnBar.hidden = false; }
    function barHide() { rnBar.hidden = true; clear(rnBar); rnMode = ''; sugg = null; }
    function validName(n, old) {
      if (!n) return 'Gib einen neuen Namen ein.';
      if (/[^\x00-\x7f]/.test(n)) return 'Umlaute (ä, ö, ü) und Sonderzeichen sind in Namen nicht erlaubt. Schreib z.B. `ae` statt `ä`.';
      if (!/^[A-Za-z_]\w*$/.test(n)) return 'Ein Name besteht aus Buchstaben, Ziffern und `_` und beginnt nicht mit einer Ziffer.';
      if (RESERVED[n]) return '`' + n + '` ist ein reserviertes Wort und kann kein Name sein.';
      if (n !== old && occurrences(ta.value, n).length) return 'Den Namen `' + n + '` gibt es schon im Code.';
      return '';
    }
    function applyRename(old, neu) {
      var src = ta.value, occ = occurrences(src, old);
      if (!occ.length) return 0;
      var caret = ta.selectionStart, out = '', last = 0, shift = 0, nc = -1, diff = neu.length - old.length;
      occ.forEach(function (o) {
        out += src.slice(last, o.s) + neu; last = o.e;
        if (o.e <= caret) shift += diff;
        else if (o.s < caret && nc < 0) nc = o.s + shift + neu.length;
      });
      out += src.slice(last);
      var st = ta.scrollTop, sl = ta.scrollLeft;
      ta.focus();
      internal(function () { ta.setSelectionRange(0, src.length); insertText(out); });
      if (nc < 0) nc = caret + shift;
      ta.setSelectionRange(nc, nc);
      ta.scrollTop = st; ta.scrollLeft = sl; syncScroll();
      queueMark();
      return occ.length;
    }
    function stellen(n) { return n + (n === 1 ? ' Stelle' : ' Stellen'); }
    function openRename() {
      acClose();
      var w = wordAt(ta.selectionStart);
      if (!w || !inCode(w.e)) { log({ kind: 'info', line: 0, text: 'Zum Umbenennen setz den Cursor in den Namen einer Variable und drück F2.' }); ta.focus(); return; }
      if (RESERVED[w.t]) { log({ kind: 'info', line: 0, text: '`' + w.t + '` ist ein fester Name von C bzw. vom Board und kann nicht umbenannt werden.' }); ta.focus(); return; }
      var old = w.t, n = occurrences(ta.value, old).length;
      var inp = el('input', { type: 'text', class: 'sim-rn-in', value: old, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Neuer Name für ' + old });
      var msg = el('span', { class: 'sim-rn-msg', 'aria-live': 'polite' });
      function close() { barHide(); ta.focus(); }
      function go() {
        var nn = inp.value.trim();
        if (nn === old) { close(); return; }
        var bad = validName(nn, old);
        clear(msg);
        if (bad) { msg.appendChild(rich(bad)); inp.focus(); return; }
        barHide();
        var c = applyRename(old, nn);
        log({ kind: 'ok', line: 0, text: '`' + old + '` heisst jetzt `' + nn + '` (' + stellen(c) + ' geändert). Rückgängig mit Strg+Z.' });
      }
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); go(); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
      });
      inp.addEventListener('input', function () {
        clear(msg);
        var nn = inp.value.trim(), bad = nn === old ? '' : validName(nn, old);
        if (bad) msg.appendChild(rich(bad));
      });
      barShow('dialog', [
        el('span', { class: 'sim-rn-label' }, rich('`' + old + '` umbenennen (' + stellen(n) + ') in:')),
        inp,
        el('button', { type: 'button', class: 'btn sim-rn-btn', onclick: go }, 'Umbenennen'),
        el('button', { type: 'button', class: 'btn ghost sim-rn-btn', onclick: close }, 'Abbrechen'),
        msg
      ]);
      inp.focus(); inp.select();
    }
    function acceptSuggest() {
      if (!sugg) return;
      var s0 = sugg;
      barHide(); rnSess = null;
      var c = applyRename(s0.old, s0.neu);
      log({ kind: 'ok', line: 0, text: '`' + s0.old + '` heisst jetzt überall `' + s0.neu + '` (' + stellen(c) + ' zusätzlich geändert). Rückgängig mit Strg+Z.' });
    }
    function showSuggest(old, neu, n) {
      if (rnMode === 'dialog') return;
      if (sugg && sugg.old === old && sugg.neu === neu && sugg.n === n) return;
      barShow('suggest', [
        el('span', { class: 'sim-rn-label' }, rich('Du hast `' + old + '` in `' + neu + '` geändert. Auch ' + (n === 1 ? 'die andere Stelle' : 'die anderen ' + n + ' Stellen') + ' umbenennen?')),
        el('button', { type: 'button', class: 'btn sim-rn-btn', title: 'Alt+Enter', onmousedown: keepFocus, onclick: acceptSuggest }, 'Ja, alle umbenennen'),
        el('button', { type: 'button', class: 'btn ghost sim-rn-btn', onmousedown: keepFocus, onclick: function () { barHide(); rnSess = null; ta.focus(); } }, 'Nein')
      ]);
      sugg = { old: old, neu: neu, n: n };
    }
    /* Zustand vor der letzten Aenderung (fuer den Umbenennen-Vorschlag) */
    var pre = { v: ta.value, s: 0, e: 0 };
    function snap() { pre = { v: ta.value, s: ta.selectionStart, e: ta.selectionEnd }; }
    function sessionFromPre() {
      var w = wordAt(pre.s, pre.v);
      if (pre.s !== pre.e) { var w2 = wordAt(pre.e, pre.v); if (!w || !w2 || w.s !== w2.s) w = null; }
      if (!w || maskCode(pre.v)[w.s] === MASK) { rnSess = null; return; }
      if (rnSess && rnSess.s === w.s && rnSess.cur === w.t) return;
      rnSess = RESERVED[w.t] ? null : { s: w.s, old: w.t, cur: w.t };
    }
    ['keydown', 'keyup', 'mouseup', 'focus'].forEach(function (ev) { ta.addEventListener(ev, snap); });
    function suggestStale() {
      return !sugg || !occurrences(ta.value, sugg.old).length || occurrences(ta.value, sugg.neu).length !== 1;
    }
    function renameWatch() {
      if (rnMode === 'dialog') return;
      var w = rnSess ? wordAt(rnSess.s) : null, c = ta.selectionStart;
      if (rnSess && (!w || w.s !== rnSess.s || c < w.s || c > w.e)) rnSess = null;
      if (!rnSess) { if (rnMode === 'suggest' && suggestStale()) barHide(); return; }
      rnSess.cur = w.t;
      var n = w.t === rnSess.old ? 0 : occurrences(ta.value, rnSess.old).length;
      /* nur vorschlagen, wenn der neue Name gueltig ist und noch nirgends sonst vorkommt */
      if (!n || RESERVED[w.t] || occurrences(ta.value, w.t).length !== 1) { if (rnMode === 'suggest') barHide(); return; }
      showSuggest(rnSess.old, w.t, n);
    }

    function toggleComment() {
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
      var ls = v.lastIndexOf('\n', s - 1) + 1, le = (e > s && v[e - 1] === '\n') ? e - 1 : e;
      var lend = v.indexOf('\n', le); if (lend < 0) lend = v.length;
      var lines = v.slice(ls, lend).split('\n');
      var used = lines.filter(function (l) { return l.trim(); });
      if (!used.length) return;
      var all = used.every(function (l) { return /^\s*\/\//.test(l); });
      var ind = Math.min.apply(null, used.map(function (l) { return /^ */.exec(l)[0].length; }));
      var nb = lines.map(function (l) {
        if (!l.trim()) return l;
        return all ? l.replace(/^(\s*)\/\/ ?/, '$1') : l.slice(0, ind) + '// ' + l.slice(ind);
      }).join('\n');
      ta.setSelectionRange(ls, lend);
      internal(function () { insertText(nb); });
      if (s !== e) ta.setSelectionRange(ls, ls + nb.length);
      else { var p = Math.max(ls, s + (nb.length - (lend - ls))); ta.setSelectionRange(p, p); }
    }

    var PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', '\'': '\'' };
    var CLOSERS = { ')': 1, ']': 1, '}': 1, '"': 1, '\'': 1 };
    var escArmed = false;
    ta.addEventListener('keydown', function (e) {
      if (acOpen()) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); acMove(e.key === 'ArrowDown' ? 1 : -1); return; }
        if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); acAccept(acSel); return; }
        if (e.key === 'Escape') { e.preventDefault(); acClose(); return; }
        if (/^(ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/.test(e.key)) acClose();
      }
      if (e.key === 'Escape') { escArmed = true; if (rnMode === 'suggest') { barHide(); rnSess = null; } return; }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (escArmed) { escArmed = false; return; }
        e.preventDefault(); indent(e.shiftKey); return;
      }
      escArmed = false;
      if (e.key === 'F2') { e.preventDefault(); openRename(); return; }
      if (e.key === 'Enter' && e.altKey && !e.ctrlKey && sugg) { e.preventDefault(); acceptSuggest(); return; }
      var ctrl = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (ctrl && e.key === 'Enter') { e.preventDefault(); start(); return; }
      if (ctrl && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); acUpdate(true); return; }
      if (ctrl && (e.key === '#' || e.key === '/')) { e.preventDefault(); toggleComment(); return; }
      if (ctrl || e.isComposing) return;
      var v = ta.value, s = ta.selectionStart, en = ta.selectionEnd, prev = v[s - 1] || '', next = v[en] || '';
      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
        var ls = v.lastIndexOf('\n', s - 1) + 1, cur = v.slice(ls, s), ind = /^[ \t]*/.exec(cur)[0];
        e.preventDefault();
        if (/\{\s*$/.test(cur) && s === en && next === '}') {
          internal(function () { insertText('\n' + ind + '    \n' + ind); });
          var p = s + 1 + ind.length + 4; ta.setSelectionRange(p, p);
          return;
        }
        if (/\{\s*$/.test(cur)) ind += '    ';
        internal(function () { insertText('\n' + ind); });
        return;
      }
      if (e.key === 'Backspace' && s === en && s > 0 && !e.shiftKey && !e.altKey) {
        if (PAIRS[prev] && PAIRS[prev] === next) { e.preventDefault(); internal(function () { deleteRange(s - 1, s + 1); }); return; }
        var lsb = v.lastIndexOf('\n', s - 1) + 1, bef = v.slice(lsb, s);
        if (bef.length >= 4 && /^ +$/.test(bef)) { e.preventDefault(); internal(function () { deleteRange(s - (bef.length % 4 || 4), s); }); }
        return;
      }
      var k = e.key;
      if (k.length !== 1) return;
      if (!IDC.test(k)) acClose();
      var code = inCode(s);
      /* schliessendes Zeichen ueberspringen, wenn es schon dasteht */
      if (CLOSERS[k] && s === en && next === k) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
      if (PAIRS[k] && code) {
        if (s !== en) {
          var sel = v.slice(s, en);
          e.preventDefault();
          internal(function () { insertText(k + sel + PAIRS[k]); });
          ta.setSelectionRange(s + 1, s + 1 + sel.length);
          return;
        }
        if ((k === '"' || k === '\'') && IDC.test(prev)) return;
        if (!next || /[\s)\]};,]/.test(next)) {
          e.preventDefault();
          internal(function () { insertText(k + PAIRS[k]); });
          ta.setSelectionRange(s + 1, s + 1);
          return;
        }
      }
      /* `}` allein auf einer Zeile: eine Stufe ausruecken */
      if (k === '}' && s === en) {
        var ls2 = v.lastIndexOf('\n', s - 1) + 1, before = v.slice(ls2, s);
        if (before.length >= 4 && /^ +$/.test(before)) { e.preventDefault(); ta.setSelectionRange(s - 4, s); internal(function () { insertText('}'); }); }
      }
    });
    ta.addEventListener('scroll', function () { syncScroll(); acClose(); });
    ta.addEventListener('blur', function () { acClose(); });
    function onInput() {
      lsSet(LS_CODE, ta.value);
      errLine = 0;
      var had = !!m;
      if (mode !== 'idle') stopSim();
      if (had) log({ kind: 'info', line: 0, text: 'Code geändert – die Simulation wurde zurückgesetzt.' });
      paint();
    }
    ta.addEventListener('input', function (e) {
      onInput();
      if (busy) { snap(); return; }
      sessionFromPre();
      snap();
      var t = e.inputType || '';
      if (t === 'insertText' && e.data && /^[A-Za-z0-9_]$/.test(e.data)) acUpdate(false);
      else if (acOpen() && /^delete/.test(t)) acUpdate(false);
      else acClose();
      renameWatch();
      queueMark();
    });

    /* --- Beispiele --- */
    var exSel = el('select', { id: 'sim-ex', class: 'sim-select' });
    var exDesc = el('p', { class: 'small sim-ex-desc', 'aria-live': 'polite' });
    function fillEx() {
      clear(exSel);
      exSel.appendChild(el('option', { value: '' }, 'Beispiel wählen …'));
      EX.forEach(function (x, i) { exSel.appendChild(el('option', { value: String(i) }, (i + 1) + '. ' + x.title)); });
      if (lsGet(LS_MINE)) exSel.appendChild(el('option', { value: 'mine' }, 'Mein letzter eigener Code'));
    }
    fillEx();
    exSel.addEventListener('change', function () {
      clear(exDesc);
      var x = EX[+exSel.value];
      if (exSel.value === 'mine') exDesc.appendChild(rich('Dein Code von vor dem letzten Laden eines Beispiels.'));
      else if (x) exDesc.appendChild(rich(x.text));
    });
    function loadEx() {
      var v = exSel.value, code;
      if (v === '') { exSel.focus(); return; }
      if (v === 'mine') code = lsGet(LS_MINE) || '';
      else code = EX[+v].code;
      var isExample = EX.some(function (x) { return x.code === ta.value; });
      if (!isExample && ta.value.trim() && v !== 'mine') lsSet(LS_MINE, ta.value);
      ta.value = code; ta.scrollTop = 0; ta.scrollLeft = 0;
      barHide(); acClose(); rnSess = null;
      fillEx(); exSel.value = v;
      stopSim(); clearConsole();
      onInput();
      log({ kind: 'info', line: 0, text: v === 'mine' ? 'Dein eigener Code ist wieder da.' : 'Beispiel „' + EX[+v].title + '“ geladen. Drück auf Start!' });
    }

    /* --- Konsole --- */
    var cons = el('div', { class: 'sim-console', role: 'log', 'aria-live': 'polite', 'aria-label': 'Meldungen', tabindex: '0' });
    var KIND = { error: 'Fehler', warn: 'Warnung', info: 'Hinweis', ok: 'Fertig' };
    function log(msg) {
      var head = el('span', { class: 'sim-msg-kind' }, (KIND[msg.kind] || 'Hinweis') + (msg.line ? ' · Zeile ' + msg.line : '') + ': ');
      var kids = [head, rich(msg.text)];
      var row = msg.line
        ? el('button', { type: 'button', class: 'sim-msg msg-' + msg.kind, title: 'Zu Zeile ' + msg.line + ' springen', onclick: function () { gotoLine(msg.line); } }, kids)
        : el('div', { class: 'sim-msg msg-' + msg.kind }, kids);
      cons.appendChild(row);
      while (cons.childNodes.length > 200) cons.removeChild(cons.firstChild);
      cons.scrollTop = cons.scrollHeight;
    }
    function clearConsole() { clear(cons); }
    function flush() { if (m) m.drain().forEach(log); }

    /* --- Board --- */
    function ledRow(port) {
      var leds = [], row = el('div', { class: 'sim-leds' });
      for (var b = 7; b >= 0; b--) {
        var l = el('span', { class: 'led' });
        leds[b] = l;
        row.appendChild(el('span', { class: 'led-cell' }, [l, el('span', { class: 'led-no' }, String(b))]));
      }
      var node = el('div', { class: 'sim-port', role: 'img' }, [el('span', { class: 'sim-port-label' }, 'PORT' + port), row]);
      var last = -1;
      return {
        node: node,
        set: function (pv) {
          if (pv === last) return;
          last = pv;
          var on = [];
          for (var b = 0; b < 8; b++) {
            var p = (pv >> b) & 1;
            leds[b].classList.toggle('on', !!p);
            if (p) on.push(b);
          }
          node.setAttribute('aria-label', 'LEDs an PORT' + port + ': ' + (on.length ? 'LED ' + on.reverse().join(', ') + ' leuchten' : 'alle aus'));
        }
      };
    }
    var ledA = ledRow('A'), ledB = ledRow('B');

    /* 8 Schalter an PORTC (gelesen über PINC) */
    var swState = 0, swBtns = [], swRow = el('div', { class: 'sim-leds' });
    for (var sb = 7; sb >= 0; sb--) (function (b) {
      var k = el('button', { type: 'button', class: 'sw', 'aria-pressed': 'false', 'aria-label': 'Schalter PC' + b, title: 'Schalter PC' + b + ' umschalten' });
      k.addEventListener('click', function () {
        swState ^= 1 << b;
        var on = !!(swState >> b & 1);
        k.classList.toggle('on', on); k.setAttribute('aria-pressed', String(on));
        if (m) m.pinc = swState;
        render(true);
      });
      swBtns[b] = k;
      swRow.appendChild(el('span', { class: 'led-cell' }, [k, el('span', { class: 'led-no' }, String(b))]));
    })(sb);
    var swNode = el('div', { class: 'sim-port', role: 'group', 'aria-label': 'Schalter an PORTC, lesen mit PINC' }, [el('span', { class: 'sim-port-label' }, 'PINC'), swRow]);

    /* 4 Taster an PORTL (PL7, PL6, PL1, PL0), gelesen über PINL. Bit = 1, solange gedrückt. */
    var plState = 0, plBtns = {}, plRow = el('div', { class: 'sim-leds' });
    function plSet(b, down) {
      var nv = down ? plState | (1 << b) : plState & ~(1 << b);
      if (nv === plState) return;
      plState = nv;
      var on = !!(plState >> b & 1);
      plBtns[b].classList.toggle('on', on); plBtns[b].setAttribute('aria-pressed', String(on));
      if (m) m.pinl = plState;
      render(true);
    }
    PL_BITS.forEach(function (b) {
      var k = el('button', { type: 'button', class: 'push', 'aria-pressed': 'false', 'aria-label': 'Taster PL' + b, title: 'Taster PL' + b + ' (gedrückt halten)' });
      k.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        try { k.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
        plSet(b, true);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { k.addEventListener(ev, function () { plSet(b, false); }); });
      k.addEventListener('keydown', function (e) {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        plSet(b, true);
      });
      k.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') plSet(b, false); });
      k.addEventListener('blur', function () { plSet(b, false); });
      k.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      plBtns[b] = k;
      plRow.appendChild(el('span', { class: 'led-cell' }, [k, el('span', { class: 'led-no' }, String(b))]));
    });
    var plNode = el('div', { class: 'sim-port', role: 'group', 'aria-label': 'Taster an PORTL (PL7, PL6, PL1, PL0), lesen mit PINL' }, [
      el('span', { class: 'sim-port-label' }, 'PINL'), plRow
    ]);

    /* RGB-LED an PORTH: PH3 = Rot, PH4 = Grün, PH5 = Blau (Bit = 1: Farbe leuchtet) */
    var rgbLed = el('span', { class: 'rgb-led' });
    var rgbParts = RGB_BITS.map(function (c) { return el('span', { class: 'rgb-ch rgb-' + c.k }, 'PH' + c.b + ' ' + c.n); });
    var rgbNode = el('div', { class: 'sim-port', role: 'img', 'aria-label': 'RGB-LED an PORTH: aus' }, [
      el('span', { class: 'sim-port-label' }, 'PORTH'), rgbLed, el('span', { class: 'rgb-chs' }, rgbParts)
    ]);
    var rgbLast = -1;
    function rgbSet(pv) {
      var v = pv & RGB_MASK;
      if (v === rgbLast) return;
      rgbLast = v;
      var on = RGB_BITS.map(function (c) { return !!(v >> c.b & 1); });
      rgbLed.style.background = v ? 'rgb(' + (on[0] ? 255 : 25) + ',' + (on[1] ? 255 : 25) + ',' + (on[2] ? 255 : 25) + ')' : '';
      rgbLed.classList.toggle('on', !!v);
      rgbParts.forEach(function (p, i) { p.classList.toggle('on', on[i]); });
      var names = RGB_BITS.filter(function (c, i) { return on[i]; }).map(function (c) { return c.n; });
      rgbNode.setAttribute('aria-label', 'RGB-LED an PORTH: ' + (names.length ? names.join(' + ') : 'aus'));
    }

    /* --- LCD 4x20 (auf dem Board) --- */
    var LCD_MAP = { 0x7E: '→', 0x7F: '←', 0xDF: '°', 0xE4: 'µ', 0xF4: 'Ω' };
    function lcdChar(code) {
      if (code >= 0x20 && code <= 0x7D) return String.fromCharCode(code);
      return LCD_MAP[code] || '▯';
    }
    var lcdCells = [], lcdGrid = el('div', { class: 'lcd-grid', 'aria-hidden': 'true' });
    for (var lr = 0; lr < 4; lr++) for (var lc = 0; lc < 20; lc++) {
      var cell = el('span', { class: 'lcd-c' }, ' ');
      lcdCells.push(cell); lcdGrid.appendChild(cell);
    }
    var lcdScreen = el('div', { class: 'sim-lcd off', role: 'img', 'aria-label': 'LCD: aus' }, lcdGrid);
    var lcdNode = el('div', { class: 'sim-lcd-wrap' }, [
      el('span', { class: 'sim-port-label' }, 'LCD'),
      lcdScreen,
      el('span', { class: 'sim-lcd-pins' }, 'PG0 SID · PG1 SCLK · PG5 Strom')
    ]);
    var lcdKey = '';
    function glyph(rows) {
      var cv = el('canvas', { width: '5', height: '8', class: 'lcd-glyph' }), g = cv.getContext && cv.getContext('2d');
      if (g) {
        g.fillStyle = getComputedStyle(lcdScreen).color || '#1B2A0E';
        for (var y = 0; y < 8; y++) for (var x = 0; x < 5; x++) if (rows[y] >> (4 - x) & 1) g.fillRect(x, y, 1, 1);
      }
      return cv;
    }
    function lcdPaint() {
      var L = m ? m.lcd : null;
      var key = L ? [L.ver, L.pow, L.d, L.c, L.b, L.ac, L.nw, L.inCg].join(',') : 'none';
      if (key === lcdKey) return;
      lcdKey = key;
      var on = !!(L && L.pow), show = on && L.d;
      lcdScreen.classList.toggle('off', !on);
      lcdScreen.classList.toggle('blank', on && !L.d);
      var lines = [];
      for (var r = 0; r < 4; r++) {
        var txt = '';
        for (var c = 0; c < 20; c++) {
          var cellEl = lcdCells[r * 20 + c], a = L ? CSim.lcdAddr(L, r, c) : 0, code = show ? L.dd[a] : 0x20;
          clear(cellEl);
          if (show && code < 16) cellEl.appendChild(glyph(L.cg.slice((code & 7) * 8, (code & 7) * 8 + 8)));
          else cellEl.textContent = lcdChar(code);
          txt += code < 16 ? '■' : lcdChar(code);
          var cur = show && !L.inCg && a === L.ac;
          cellEl.classList.toggle('lcd-cur', cur && L.c);
          cellEl.classList.toggle('lcd-blink', cur && L.b);
        }
        lines.push(txt.replace(/\s+$/, ''));
      }
      lcdScreen.setAttribute('aria-label', !on ? 'LCD: kein Strom' : !L.d ? 'LCD: Display aus' : 'LCD: ' + lines.map(function (t, i) { return 'Zeile ' + (i + 1) + ': ' + (t || 'leer'); }).join('; '));
    }

    /* --- Analoge Eingänge (Spannungen in Volt, Index = ADC-Kanal) --- */
    var volts = DEFAULT_VOLT.slice();
    function adcOf(v) { return Math.max(0, Math.min(1023, Math.floor(v / 5 * 1024))); }

    /* Joystick: X = ADC10, Y = ADC11, Taste = PE2 */
    var joy = { x: 0.5, y: 0.5 }, joyBtn = false;
    var knob = el('span', { class: 'joy-knob' });
    var pad = el('div', { class: 'joy-pad', tabindex: '0', role: 'group', 'aria-label': 'Joystick: mit der Maus ziehen oder mit den Pfeiltasten bewegen' }, knob);
    var joyOut = el('output', { class: 'sens-out' });
    function joyApply() {
      volts[10] = Math.round(joy.x * 500) / 100;
      volts[11] = Math.round(joy.y * 500) / 100;
      knob.style.left = (joy.x * 100) + '%';
      knob.style.top = ((1 - joy.y) * 100) + '%';
      joyOut.textContent = 'X ' + volts[10].toFixed(2) + ' V (ADC10 ≈ ' + adcOf(volts[10]) + ') · Y ' + volts[11].toFixed(2) + ' V (ADC11 ≈ ' + adcOf(volts[11]) + ')';
    }
    function joyFrom(e) {
      var b = pad.getBoundingClientRect();
      joy.x = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
      joy.y = Math.max(0, Math.min(1, 1 - (e.clientY - b.top) / b.height));
      joyApply();
    }
    var joyDrag = false;
    pad.addEventListener('pointerdown', function (e) { if (e.button !== 0) return; e.preventDefault(); joyDrag = true; try { pad.setPointerCapture(e.pointerId); } catch (x) { /* egal */ } pad.focus(); joyFrom(e); });
    pad.addEventListener('pointermove', function (e) { if (joyDrag) joyFrom(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { pad.addEventListener(ev, function () { if (!joyDrag) return; joyDrag = false; joy.x = 0.5; joy.y = 0.5; joyApply(); }); });
    var JOY_KEYS = { ArrowLeft: ['x', 0], ArrowRight: ['x', 1], ArrowDown: ['y', 0], ArrowUp: ['y', 1] };
    pad.addEventListener('keydown', function (e) { var k = JOY_KEYS[e.key]; if (!k) return; e.preventDefault(); joy[k[0]] = k[1]; joyApply(); });
    pad.addEventListener('keyup', function (e) { var k = JOY_KEYS[e.key]; if (!k) return; joy[k[0]] = 0.5; joyApply(); });
    joyApply();
    var joyKey = el('button', { type: 'button', class: 'push', 'aria-pressed': 'false', 'aria-label': 'Joystick-Taste PE2', title: 'Joystick-Taste (PE2) – gedrückt halten' });
    function joySet(down) {
      if (down === joyBtn) return;
      joyBtn = down;
      joyKey.classList.toggle('on', down); joyKey.setAttribute('aria-pressed', String(down));
      if (m) m.pine = down ? 4 : 0;
      render(true);
    }
    joyKey.addEventListener('pointerdown', function (e) { if (e.button !== 0) return; e.preventDefault(); try { joyKey.setPointerCapture(e.pointerId); } catch (x) { /* egal */ } joySet(true); });
    ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(function (ev) { joyKey.addEventListener(ev, function () { joySet(false); }); });
    joyKey.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); joySet(true); } });
    joyKey.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') joySet(false); });
    var joyBox = el('div', { class: 'board-part' }, [
      el('span', { class: 'part-label' }, 'Joystick · ADC10 / ADC11'),
      el('div', { class: 'joy-row' }, [pad, el('span', { class: 'led-cell' }, [joyKey, el('span', { class: 'led-no' }, 'PE2')])]),
      joyOut
    ]);

    /* Potentiometer 1 (ADC8) und 2 (ADC9): Drehknopf auf dem Board */
    function potKnob(ch, name) {
      var val = 250, mark = el('span', { class: 'pot-mark' });
      var knobEl = el('div', { class: 'pot', tabindex: '0', role: 'slider', 'aria-label': name + ' (ADC' + ch + ')', 'aria-valuemin': '0', 'aria-valuemax': '500',
        title: name + ': ziehen, Mausrad oder Pfeiltasten' }, mark);
      var out = el('output', { class: 'sens-out' });
      function set(v) {
        val = Math.max(0, Math.min(500, Math.round(v)));
        var u = val / 100;
        volts[ch] = u;
        mark.style.transform = 'rotate(' + (-135 + val / 500 * 270) + 'deg)';
        var t = u.toFixed(2) + ' V → ADC' + ch + ' ≈ ' + adcOf(u);
        out.textContent = t;
        knobEl.setAttribute('aria-valuenow', String(val));
        knobEl.setAttribute('aria-valuetext', t);
      }
      var drag = null;
      knobEl.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault(); knobEl.focus();
        try { knobEl.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
        drag = { x: e.clientX, y: e.clientY, v: val };
      });
      knobEl.addEventListener('pointermove', function (e) { if (drag) set(drag.v + ((e.clientX - drag.x) - (e.clientY - drag.y)) * 2.5); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { knobEl.addEventListener(ev, function () { drag = null; }); });
      knobEl.addEventListener('wheel', function (e) { e.preventDefault(); set(val + (e.deltaY < 0 ? 10 : -10)); }, { passive: false });
      knobEl.addEventListener('keydown', function (e) {
        var d = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 50, PageDown: -50 }[e.key];
        if (e.key === 'Home') { e.preventDefault(); set(0); return; }
        if (e.key === 'End') { e.preventDefault(); set(500); return; }
        if (d) { e.preventDefault(); set(val + d); }
      });
      set(val);
      return el('div', { class: 'board-part pot-part' }, [el('span', { class: 'part-label' }, name + ' · ADC' + ch), knobEl, out]);
    }
    var analogNode = el('div', { class: 'sim-analog', role: 'group', 'aria-label': 'Joystick und Potentiometer' }, [joyBox, potKnob(8, 'Poti 1'), potKnob(9, 'Poti 2')]);

    /* Schieberegler für Potis und Sensoren */
    var SENS = [
      { ch: 12, name: 'Lichtsensor', min: 0, max: 100, val: 50, fmt: function (v) { return v + ' % hell'; }, volt: function (v) { return v * 0.05; } },
      { ch: 13, name: 'Temperatur (LM35, 10 mV/°C)', min: 0, max: 100, val: 22, fmt: function (v) { return v + ' °C'; }, volt: function (v) { return v * 0.01; } },
      { ch: 14, name: 'Hallsensor 1 (Magnet)', min: -100, max: 100, val: 0, fmt: function (v) { return (v > 0 ? '+' : '') + v + ' % Feld'; }, volt: function (v) { return 2.5 + v * 0.02; } },
      { ch: 15, name: 'Hallsensor 2 (Magnet)', min: -100, max: 100, val: 0, fmt: function (v) { return (v > 0 ? '+' : '') + v + ' % Feld'; }, volt: function (v) { return 2.5 + v * 0.02; } }
    ];
    var sensRows = SENS.map(function (S) {
      var id = 'sim-sens-' + S.ch;
      var inp = el('input', { type: 'range', id: id, min: S.min, max: S.max, step: 1, value: S.val, class: 'sens-range' });
      var out = el('output', { for: id, class: 'sens-out' });
      function apply() {
        var v = +inp.value, u = Math.round(S.volt(v) * 1000) / 1000;
        volts[S.ch] = u;
        var t = (S.fmt ? S.fmt(v) + ' → ' : '') + u.toFixed(2) + ' V → ADC' + S.ch + ' ≈ ' + adcOf(u);
        out.textContent = t; inp.setAttribute('aria-valuetext', t);
      }
      inp.addEventListener('input', apply);
      apply();
      return el('div', { class: 'sens-row' }, [el('label', { for: id }, S.name), inp, out]);
    });
    var sensCard = el('div', { class: 'periph-card periph-wide' }, [el('h3', null, 'Sensoren (A/D-Wandler)'), el('div', { class: 'sens-list' }, sensRows)]);

    /* Servos an PE3 (OC3A) und PE4 (OC3B) */
    function servoView(name, pin) {
      var arm = el('span', { class: 'servo-arm' }), out = el('output', { class: 'sens-out' });
      var dial = el('div', { class: 'servo-dial', role: 'img', 'aria-label': name + ': aus' }, [arm, el('span', { class: 'servo-hub' })]);
      var last = '';
      return {
        node: el('div', { class: 'servo' }, [dial, el('strong', null, name + ' (' + pin + ')'), out]),
        set: function (s) {
          var t = !s ? 'aus' : s.on ? (s.high * 1000).toFixed(2) + ' ms alle ' + (s.period * 1000).toFixed(1) + ' ms → ' + Math.round(s.angle) + '°' : 'aus: ' + s.why;
          if (t === last) return;
          last = t;
          out.textContent = t;
          dial.setAttribute('aria-label', name + ': ' + t);
          dial.classList.toggle('on', !!(s && s.on));
          arm.style.transform = 'rotate(' + ((s && s.on ? s.angle : 90) - 90) + 'deg)';
          var odd = s && s.on && (s.period < 0.01 || s.period > 0.03);
          dial.classList.toggle('odd', !!odd);
          if (odd) out.textContent = t + ' (Servos erwarten etwa 20 ms Periode)';
        }
      };
    }
    var servo1 = servoView('Servo 1', 'PE3'), servo2 = servoView('Servo 2', 'PE4');
    var servoCard = el('div', { class: 'periph-card' }, [el('h3', null, 'Servos (Timer 3)'), el('div', { class: 'servo-row' }, [servo1.node, servo2.node])]);

    /* LED-Matrix 8x8 */
    var mxDots = [], mxGrid = el('div', { class: 'mx-grid', role: 'img', 'aria-label': 'LED-Matrix: alle aus' });
    for (var mr = 0; mr < 8; mr++) for (var mc = 0; mc < 8; mc++) { var d = el('span', { class: 'mx-dot' }); mxDots.push(d); mxGrid.appendChild(d); }
    var mxLast = '';
    function mxPaint() {
      var rows = m ? m.matrix() : [0, 0, 0, 0, 0, 0, 0, 0], key = rows.join(',');
      if (key === mxLast) return;
      mxLast = key;
      rows.forEach(function (pat, r) { for (var c = 0; c < 8; c++) mxDots[r * 8 + c].classList.toggle('on', !!(pat >> (7 - c) & 1)); });
      mxGrid.setAttribute('aria-label', 'LED-Matrix: ' + rows.map(function (p, i) { return 'Zeile ' + (i + 1) + ' ' + toBin(BigInt(p), 'uint8_t').replace(' ', ''); }).join(', '));
    }
    var mxCard = el('div', { class: 'periph-card' }, [
      el('h3', null, 'LED-Matrix'), mxGrid,
      el('p', { class: 'small' }, rich('PJ0–PJ2 = Zeile (74AC138), PJ3 = Zeilen ein, PJ4 = CLK, PJ5 = Daten, PJ6 = STROBE. Bit 7 = linke Spalte.'))
    ]);

    var periph = el('section', { class: 'task-card sim-periph', 'aria-labelledby': 'sim-periph-title' }, [
      el('h2', { id: 'sim-periph-title' }, 'Board-Peripherie'),
      el('p', { class: 'small' }, rich('Wie auf dem echten Board: Die Sensoren liest du über den A/D-Wandler (`ADMUX`, `ADCSRA`, `ADCSRB`, `ADC`, Kanal 8–15 mit `MUX5`), die Servos steuerst du mit Timer 3, das LCD über `PORTG` und die Matrix über `PORTJ`. Joystick und Potis sitzen oben auf dem Board. Fertige Beispiele findest du oben in der Liste.')),
      el('div', { class: 'periph-grid' }, [servoCard, mxCard, sensCard])
    ]);
    function periphPaint() {
      lcdPaint();
      servo1.set(m ? m.servo('A') : null);
      servo2.set(m ? m.servo('B') : null);
      mxPaint();
    }

    var board = el('div', { class: 'sim-board', role: 'group', 'aria-label': 'Board: LCD, LEDs an PORTA und PORTB, RGB-LED an PORTH, Schalter an PORTC, Taster an PORTL' }, [
      el('div', { class: 'sim-chip', 'aria-hidden': 'true' }, [el('strong', null, 'ATmega2560'), el('span', null, '16 MHz')]),
      lcdNode, ledA.node, ledB.node, rgbNode, swNode, plNode, analogNode
    ]);

    /* --- Variablen (Hauptteil) & LED-Werte --- */
    var regCells = {}, regKey = '', REG_ORDER = Object.keys(REGS);
    var regBody = el('tbody');
    function regRows() {
      var t = m ? m.touched : {}, list = REG_ORDER.filter(function (n) { return REG_SHOW.indexOf(n) >= 0 || t[n]; }), key = list.join(',');
      if (key === regKey) return;
      regKey = key; regCells = {}; clear(regBody);
      list.forEach(function (r) {
        var c = { bin: el('td', { class: 'mono' }), hex: el('td', { class: 'mono' }), dec: el('td', { class: 'mono' }) };
        regCells[r] = c;
        regBody.appendChild(el('tr', null, [el('th', { scope: 'row' }, [el('code', null, r), REGS[r].info ? el('small', null, REGS[r].info) : null]), c.bin, c.hex, c.dec]));
      });
    }
    function regView(n) {
      if (!m) return n === 'PINC' ? swState : n === 'PINL' ? plState & 0xC3 : n === 'PINE' ? (joyBtn ? 4 : 0) : 0;
      if (/^PIN/.test(n) || n === 'TCNT3') return m.readReg(n);
      if (n === 'ADC' || n === 'ADCW' || n === 'ADCL' || n === 'ADCH') {
        var full = (m.r.ADMUX & 0x20) ? (m.adc.res << 6) & 0xFFFF : m.adc.res | 0;
        return n === 'ADCL' ? full & 0xFF : n === 'ADCH' ? full >> 8 : full;
      }
      return m.r[n];
    }
    var regTable = el('div', { class: 'table-wrap sim-table' }, el('table', null, [
      el('caption', null, 'Register'),
      el('thead', null, el('tr', null, [el('th', { scope: 'col' }, 'Name'), el('th', { scope: 'col' }, 'Binär'), el('th', { scope: 'col' }, 'Hex'), el('th', { scope: 'col' }, 'Dez')])), regBody]));
    var varBody = el('tbody');
    var varTable = el('div', { class: 'table-wrap sim-table' }, el('table', null, [
      el('caption', null, 'Variablen'),
      el('thead', null, el('tr', null, [el('th', { scope: 'col' }, 'Name'), el('th', { scope: 'col' }, 'Typ'), el('th', { scope: 'col' }, 'Wert'), el('th', { scope: 'col' }, 'Binär')])), varBody]));
    var lastVarKey = '';
    function paintVars() {
      var rows = m ? m.listVars() : [];
      var key = rows.map(function (r) { return r.name + r.value + r.scope; }).join('|');
      if (key === lastVarKey) return;
      lastVarKey = key;
      clear(varBody);
      if (!rows.length) varBody.appendChild(el('tr', null, el('td', { colspan: '4', class: 'small' }, m ? 'Noch keine Variablen.' : 'Start oder Schritt drücken.')));
      rows.forEach(function (r) {
        varBody.appendChild(el('tr', { class: r.scope.indexOf('global') === 0 ? 'is-global' : '' }, [
          el('th', { scope: 'row' }, [el('code', null, r.name), el('small', null, r.scope)]),
          el('td', null, el('code', null, r.ty)),
          el('td', { class: 'mono' }, r.value),
          el('td', { class: 'mono' }, r.bin)
        ]));
      });
    }

    /* --- Steuerung --- */
    function btn(label, fn, cls, extra) { return el('button', Object.assign({ type: 'button', class: 'btn' + (cls ? ' ' + cls : ''), onclick: fn }, extra || {}), label); }
    var bStart = btn('▶ Start', start, '', { title: 'Start (Strg+Enter im Editor)' });
    var bPause = btn('❚❚ Pause', pause, 'ghost');
    var bStep = btn('Schritt', stepOnce, 'ghost', { title: 'Eine Anweisung ausführen' });
    var bReset = btn('Reset', function () { stopSim(); clearConsole(); log({ kind: 'info', line: 0, text: 'Reset: Board und Variablen sind zurückgesetzt.' }); }, 'ghost');
    var speed = el('input', { type: 'range', min: 0, max: 5, step: 1, value: 2, id: 'sim-speed', class: 'sim-speed', 'aria-valuetext': '1×' });
    var speedOut = el('output', { for: 'sim-speed', class: 'sim-speed-out' }, '1×');
    speed.addEventListener('input', function () { speedOut.textContent = SPEED_LABEL[+speed.value]; speed.setAttribute('aria-valuetext', SPEED_LABEL[+speed.value]); sleepUntil = Math.min(sleepUntil, performance.now()); });
    var timeOut = el('output', { class: 'sim-time' }, '0.000 s');
    var statusOut = el('span', { class: 'sim-status', 'aria-live': 'polite' }, 'Bereit');

    function setMode(nm) {
      mode = nm;
      var txt = { idle: 'Bereit', running: 'Läuft', paused: 'Pause', done: 'Beendet', error: 'Fehler' }[nm];
      statusOut.textContent = txt;
      statusOut.className = 'sim-status st-' + nm;
      bStart.disabled = nm === 'running';
      bPause.disabled = nm !== 'running';
      bStart.textContent = nm === 'paused' ? '▶ Weiter' : '▶ Start';
      rootEl && rootEl.classList.toggle('is-running', nm === 'running');
    }
    function compileNew() {
      clearConsole();
      var c = compile(ta.value);
      c.diag.forEach(log);
      if (!c.ok) {
        errLine = c.error.line; curLine = 0; marks();
        if (errLine) scrollToLine(errLine);
        say('oops', SAYS.error || 'Hoppla – da stimmt etwas nicht. Die rote Zeile im Editor zeigt, wo.');
        m = null; setMode('error');
        return false;
      }
      errLine = 0;
      m = new Machine(c);
      m.pinc = swState; m.pinl = plState; m.pine = joyBtn ? 4 : 0; m.volt = volts;
      runStart = performance.now(); lastDelayT = runStart; flickerSaid = false; lastChanges = 0;
      return true;
    }
    function start() {
      if (!m || mode === 'done' || mode === 'error' || mode === 'idle') { if (!compileNew()) return; }
      if (!greeted) { greeted = true; say('happy', SAYS.start || 'Läuft! Ich führe deinen Code Anweisung für Anweisung aus.'); }
      sleepUntil = 0;
      setMode('running');
      schedule();
    }
    function pause() {
      if (mode !== 'running') return;
      setMode('paused');
      render(true);
    }
    function stepOnce() {
      if (!m || mode === 'idle' || mode === 'done' || mode === 'error') { if (!compileNew()) return; }
      setMode('paused');
      var r;
      do { r = m.step(); } while (r.type === 'delay');
      after(r);
      render(true);
    }
    function after(r) {
      flush();
      if (r.type === 'done') { setMode('done'); setCur(0); say('neutral', SAYS.done || 'Fertig! `main` ist zu Ende.'); }
      else if (r.type === 'error') { setMode('error'); errLine = r.error.line; setCur(0); if (errLine) scrollToLine(errLine); say('oops', SAYS.runtime || 'Autsch, ein Laufzeitfehler! Schau in die Meldungen.'); }
    }
    function stopSim() {
      m = null; errLine = 0; curLine = 0; sleepUntil = 0;
      setMode('idle'); marks(); render(true);
    }
    function schedule() { if (!raf) raf = setTimeout(tick, 15); }
    function tick() {
      raf = 0;
      if (!rootEl.isConnected) { m = null; mode = 'idle'; return; }
      if (mode !== 'running' || !m) return;
      var now = performance.now();
      if (now >= sleepUntil) {
        var sp = SPEEDS[+speed.value], turbo = sp === 0;
        var budget = turbo ? 1e9 : Math.max(20, Math.round(400 * sp));
        var deadline = now + (turbo ? 14 : 8), n = 0;
        while (n < budget) {
          var r = m.step();
          if (r.type === 'stmt') { n++; if ((n & 127) === 0 && performance.now() > deadline) break; continue; }
          if (r.type === 'delay') {
            lastDelayT = now;
            if (turbo) { if (performance.now() > deadline) break; continue; }
            var base = sleepUntil > now - 250 ? sleepUntil : now;
            sleepUntil = base + r.ms / sp;
            if (sleepUntil > performance.now()) break;
            continue;
          }
          after(r); break;
        }
        flush();
        var ch = m ? m.ledChanges - lastChanges : 0;
        if (m) lastChanges = m.ledChanges;
        if (!flickerSaid && ch >= 3 && now - lastDelayT > 1000 && now - runStart > 600) {
          flickerSaid = true;
          log({ kind: 'info', line: 0, text: 'Ohne `_delay_ms(…)` ändern sich die LEDs viele tausend Mal pro Sekunde – auf dem echten Board flackert das zu schnell zum Sehen. Bau eine Pause ein, z.B. `_delay_ms(200);`.' });
        }
      }
      render(false);
      if (mode === 'running') schedule();
    }
    function render(full) {
      var r = m ? m.r : null;
      ledA.set(r ? r.PORTA : 0);
      ledB.set(r ? r.PORTB : 0);
      rgbSet(r ? r.PORTH : 0);
      regRows();
      periphPaint();
      Object.keys(regCells).forEach(function (n) {
        var v = regView(n) | 0, ty = REGS[n].ty, c = regCells[n];
        var bin = toBin(BigInt(v), ty), hx = toHex(BigInt(v), ty), dc = String(v);
        if (c.dec.textContent !== dc) { c.bin.textContent = bin; c.hex.textContent = hx; c.dec.textContent = dc; }
      });
      timeOut.textContent = (m ? m.cycles / F_CPU : 0).toFixed(3) + ' s';
      var now = performance.now();
      if (full || mode !== 'running' || now - lastVarPaint > 150) { lastVarPaint = now; paintVars(); }
      if (mode === 'running') { if (m && m.cur) setCur(m.cur.line, false); }
      else if (mode === 'paused' && m && m.cur) setCur(m.cur.line, full);
    }

    /* --- Challenges --- */
    var solved = {};
    try { solved = JSON.parse(lsGet(LS_DONE) || '{}') || {}; } catch (e) { solved = {}; }
    var chList = el('div', { class: 'sim-ch-list' });
    CH.forEach(function (c) {
      var res = el('div', { class: 'sim-ch-res', 'aria-live': 'polite' });
      var card = el('article', { class: 'sim-ch' + (solved[c.id] ? ' solved' : '') }, [
        el('div', { class: 'sim-ch-top' }, [el('h3', null, c.title), solved[c.id] ? el('span', { class: 'badge sim-ch-ok' }, 'Geschafft') : null]),
        el('p', null, rich(c.text)),
        c.check
          ? btn('Prüfen', function () {
            clear(res);
            var r = runCheck(ta.value, c.check);
            res.className = 'sim-ch-res ' + (r.ok ? 'good' : 'bad');
            res.appendChild(rich(r.ok ? (c.done || 'Geschafft! Die LEDs zeigen genau das Richtige.') : r.msg));
            if (r.ok) {
              solved[c.id] = true; lsSet(LS_DONE, JSON.stringify(solved));
              card.classList.add('solved');
              say('party', SAYS.challenge || 'Challenge geschafft! Du programmierst wie ein echter Embedded-Profi.');
            } else say('oops', SAYS.challengeFail || 'Noch nicht ganz – schau dir die Meldung bei der Challenge an.');
          }, 'ghost')
          : el('span', { class: 'badge' }, 'Freie Aufgabe – ohne automatische Prüfung'),
        res
      ]);
      chList.appendChild(card);
    });

    /* --- Seite zusammensetzen --- */
    rootEl = el('div', { class: 'sim-page' }, [
      el('section', { class: 'hero hero-home' }, [
        el('div', { class: 'hero-text' }, [
          el('div', { class: 'eyebrow sticker' }, 'Simulator'),
          el('h1', null, ['C-Code auf dem ', el('span', { class: 'mark' }, 'ATmega2560')]),
          el('p', { class: 'lead' }, 'Schreib ein kleines C-Programm mit Variablen und lass es laufen. Die Variablen-Tabelle zeigt Name, Typ, Wert und Bits live – und was beim Überlauf passiert. 8 + 8 LEDs an PORTA und PORTB zeigen Werte zusätzlich binär an. Die RGB-LED an PORTH (PH3 Rot, PH4 Grün, PH5 Blau) mischt Farben. 8 Schalter an PORTC liest du mit PINC ein, 4 Taster an PORTL (PL7, PL6, PL1, PL0) mit PINL. Dazu kommen wie auf dem echten Board das LCD 4×20, Joystick, Potis, Sensoren, zwei Servos und die LED-Matrix – angesteuert über die echten Register.')
        ]),
        bitBox
      ]),
      el('div', { class: 'sim-grid' }, [
        el('section', { class: 'task-card sim-left', 'aria-label': 'Code' }, [
          el('div', { class: 'sim-ex-row' }, [el('label', { for: 'sim-ex' }, 'Beispiele:'), exSel, btn('Laden', loadEx, 'ghost')]),
          exDesc,
          el('div', { class: 'sim-controls sim-top' }, [bStart, bPause, bStep, bReset]),
          el('div', { class: 'sim-controls sim-meta sim-top' }, [
            el('label', { for: 'sim-speed' }, 'Tempo:'), speed, speedOut,
            el('span', { class: 'sim-sep' }, 'Zeit:'), timeOut,
            el('span', { class: 'sim-sep' }, 'Status:'), statusOut
          ]),
          editor,
          el('p', { id: 'sim-ed-help', class: 'small sim-help' }, rich('Klammern und Anführungszeichen schliessen sich von selbst. Beim Tippen erscheinen Vorschläge (↑/↓ wählen, Enter oder Tab übernimmt, Strg+Leertaste öffnet sie). F2 benennt den Namen unter dem Cursor überall um – änderst du einen Namen von Hand, schlägt der Editor das auch vor. Strg+# kommentiert Zeilen aus. Tab rückt ein (Shift+Tab aus), zum Verlassen des Editors: Esc, dann Tab. Strg+Enter startet. Der Code wird in deinem Browser gespeichert.')),
          el('h2', { class: 'sim-h' }, 'Meldungen'),
          cons
        ]),
        el('section', { class: 'task-card sim-right', 'aria-label': 'Variablen und LEDs' }, [
          varTable,
          board,
          regTable
        ])
      ]),
      periph,
      el('section', { class: 'task-card sim-challenges', 'aria-labelledby': 'sim-ch-title' }, [
        el('h2', { id: 'sim-ch-title' }, 'Challenges'),
        el('p', null, 'Schreib den Code im Editor oben und klick auf „Prüfen“. Der Simulator lässt dein Programm im Hintergrund laufen und schaut dann, welche Werte PORTA und PORTB zeigen.'),
        chList
      ]),
      el('aside', { class: 'tip sim-diff' }, [
        el('div', { class: 'fact-label' }, 'Gut zu wissen'),
        el('p', null, rich('Der Simulator rechnet wie avr-gcc: `int` hat 16 Bit, kleinere Typen werden vor dem Rechnen zu `int` erweitert, und beim Speichern wird auf den Zieltyp gekürzt. Vereinfachungen: Eine Anweisung dauert hier immer ca. 1 µs, die LEDs zeigen `PORTA`/`PORTB` auch ohne `DDRA = 0xFF;` (LCD, Matrix und Servos brauchen das passende `DDRx` aber wie in echt), das LCD antwortet nie mit dem Busy-Flag, Interrupts gibt es nicht, ein Taster an PORTL liefert in `PINL` eine 1, solange er gedrückt ist (wie auf dem Board, wo ein Schmitt-Trigger das Signal invertiert), und vorzeichenbehafteter Überlauf wird als Wraparound gezeigt, obwohl er in echtem C undefiniert ist.'))
      ])
    ]);
    main.appendChild(rootEl);
    paint();
    setMode('idle');
    render(true);
  }

  root.CSimUI = { show: showSim };
})(typeof window !== 'undefined' ? window : globalThis);
