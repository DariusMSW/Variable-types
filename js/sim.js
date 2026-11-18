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
    double: 'Kommazahlen (`double`) unterstützt der Simulator nicht – und der ATmega2560 hat keine FPU. Tipp: Festkomma, z.B. Zehntelgrad in `int16_t`.',
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

  /* ---------- LED-Ausgaben des simulierten Boards (nur Anzeige von Variablenwerten) ---------- */
  var REGS = {};
  ['A', 'B'].forEach(function (p) {
    ['DDR', 'PORT'].forEach(function (r) { REGS[r + p] = { ty: 'uint8_t' }; });
  });
  /* 8 Schalter an PORTC: lesen mit PINC (Bit = 1, wenn Schalter an) */
  REGS.DDRC = { ty: 'uint8_t' }; REGS.PORTC = { ty: 'uint8_t' }; REGS.PINC = { ty: 'uint8_t', ro: true };
  /* Hardware-Namen, die der Simulator bewusst nicht kennt: Es geht nur um Variablentypen. */
  var HW_UNSUP = /^(?:(?:DDR|PORT|PIN)[A-L]|P[A-L][0-7]|TCNT\d[HL]?|TCCR\d[A-C]?|OCR\d[A-C]?[HL]?|TIMSK\d|TIFR\d|ICR\d[HL]?|ADC[HLW]?|ADMUX|ADCSR[AB]|CS\d\d|WGM\d\d|ADPS\d|ADEN|ADSC|ADIE|ADIF|ADATE|ADLAR|REFS\d|MUX\d)$/;
  var HW_MSG = ' wird im Simulator nicht unterstützt – hier geht es um Variablentypen. Gib Werte direkt als Variable vor und zeig sie mit `PORTA = wert;` an.';

  /* Bitnamen aus <avr/io.h> (nur Port A und B) */
  var PREDEF = Object.create(null);
  for (var bb = 0; bb < 8; bb++) {
    ['A', 'B'].forEach(function (p) {
      PREDEF['P' + p + bb] = bb; PREDEF['PORT' + p + bb] = bb; PREDEF['DD' + p + bb] = bb;
    });
    PREDEF['PC' + bb] = bb; PREDEF['PORTC' + bb] = bb; PREDEF['DDC' + bb] = bb; PREDEF['PINC' + bb] = bb;
  }

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
  M.readReg = function (name) { return name === 'PINC' ? (this.pinc | 0) & 0xFF : this.peek(name); };
  /* Die LEDs zeigen PORTA/PORTB immer an – auch ohne gesetztes DDRA/DDRB (keine Hardware-Stolperfallen). */
  M.vis = function () { var r = this.r; return (r.PORTA << 8) | r.PORTB; };
  M.setPort = function (name, v) { var b = this.vis(); this.r[name] = v; if (this.vis() !== b) this.ledChanges++; };
  M.writeReg = function (name, v, at) {
    if (REGS[name].ro) throw new SimError('`' + name + '` kannst du nur lesen – es zeigt die Schalter an PORTC.', at && at.line, at && at.col);
    this.setPort(name, v);
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
    T: T, REGS: REGS, F_CPU: F_CPU, MAX_ARR: MAX_ARR, CYC_PER_STEP: CYC_PER_STEP,
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
  var REG_SHOW = ['PORTA', 'PORTB', 'PINC'];

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
      wrap: 'off', 'aria-label': 'C-Code', 'aria-describedby': 'sim-ed-help' });
    ta.value = saved != null && saved.trim() ? saved : (EX[0] ? EX[0].code : 'int main(void)\n{\n    while (1)\n    {\n    }\n}\n');
    var hlInner = el('div', { class: 'sim-hl-inner' });
    var hl = el('pre', { class: 'sim-hl', 'aria-hidden': 'true' }, hlInner);
    var gutInner = el('div', { class: 'sim-gut-inner' });
    var gutter = el('div', { class: 'sim-gutter', 'aria-hidden': 'true' }, gutInner);
    var editor = el('div', { class: 'sim-editor' }, [
      el('div', { class: 'code-bar', 'aria-hidden': 'true' }, [el('span'), el('span'), el('span'), el('em', null, 'main.c')]),
      el('div', { class: 'sim-ed-body' }, [gutter, el('div', { class: 'sim-codewrap' }, [hl, ta])])
    ]);
    var lineEls = [], gutEls = [], curLine = 0, errLine = 0;
    function paint() {
      var lines = ta.value.split('\n');
      clear(hlInner); clear(gutInner); lineEls = []; gutEls = [];
      lines.forEach(function (l, i) {
        var d = el('div', { class: 'sim-line' }, l.length ? H.highlightLine(l) : ' ');
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
    var escArmed = false;
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { escArmed = true; return; }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (escArmed) { escArmed = false; return; }
        e.preventDefault(); indent(e.shiftKey); return;
      }
      escArmed = false;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); start(); return; }
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing) {
        var v = ta.value, s = ta.selectionStart, ls = v.lastIndexOf('\n', s - 1) + 1, cur = v.slice(ls, s);
        var ind = /^[ \t]*/.exec(cur)[0];
        if (/\{\s*$/.test(cur)) ind += '    ';
        e.preventDefault(); insertText('\n' + ind);
      }
    });
    ta.addEventListener('scroll', syncScroll);
    function onInput() {
      lsSet(LS_CODE, ta.value);
      errLine = 0;
      var had = !!m;
      if (mode !== 'idle') stopSim();
      if (had) log({ kind: 'info', line: 0, text: 'Code geändert – die Simulation wurde zurückgesetzt.' });
      paint();
    }
    ta.addEventListener('input', onInput);

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

    var board = el('div', { class: 'sim-board', role: 'group', 'aria-label': 'Board: LEDs an PORTA und PORTB, Schalter an PORTC' }, [
      el('div', { class: 'sim-chip', 'aria-hidden': 'true' }, [el('strong', null, 'ATmega2560'), el('span', null, '16 MHz')]),
      ledA.node, ledB.node, swNode
    ]);

    /* --- Variablen (Hauptteil) & LED-Werte --- */
    var regCells = {};
    var regBody = el('tbody');
    REG_SHOW.forEach(function (r) {
      var c = { bin: el('td', { class: 'mono' }), hex: el('td', { class: 'mono' }), dec: el('td', { class: 'mono' }) };
      regCells[r] = c;
      regBody.appendChild(el('tr', null, [el('th', { scope: 'row' }, el('code', null, r)), c.bin, c.hex, c.dec]));
    });
    var regTable = el('div', { class: 'table-wrap sim-table' }, el('table', null, [
      el('caption', null, 'LED-Anzeige'),
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
      m.pinc = swState;
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
      var get = function (n) { return n === 'PINC' ? swState : m ? m.peek(n) : 0; };
      ledA.set(r ? r.PORTA : 0);
      ledB.set(r ? r.PORTB : 0);
      REG_SHOW.forEach(function (n) {
        var v = get(n), ty = REGS[n].ty, c = regCells[n];
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
          el('p', { class: 'lead' }, 'Schreib ein kleines C-Programm mit Variablen und lass es laufen. Die Variablen-Tabelle zeigt Name, Typ, Wert und Bits live – und was beim Überlauf passiert. 8 + 8 LEDs an PORTA und PORTB zeigen Werte zusätzlich binär an, und 8 Schalter an PORTC liest du mit PINC ein.')
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
          el('p', { id: 'sim-ed-help', class: 'small sim-help' }, rich('Tab rückt ein (Shift+Tab aus). Zum Verlassen des Editors: Esc, dann Tab. Strg+Enter startet. Der Code wird in deinem Browser gespeichert.')),
          el('h2', { class: 'sim-h' }, 'Meldungen'),
          cons
        ]),
        el('section', { class: 'task-card sim-right', 'aria-label': 'Variablen und LEDs' }, [
          varTable,
          board,
          regTable
        ])
      ]),
      el('section', { class: 'task-card sim-challenges', 'aria-labelledby': 'sim-ch-title' }, [
        el('h2', { id: 'sim-ch-title' }, 'Challenges'),
        el('p', null, 'Schreib den Code im Editor oben und klick auf „Prüfen“. Der Simulator lässt dein Programm im Hintergrund laufen und schaut dann, welche Werte PORTA und PORTB zeigen.'),
        chList
      ]),
      el('aside', { class: 'tip sim-diff' }, [
        el('div', { class: 'fact-label' }, 'Gut zu wissen'),
        el('p', null, rich('Der Simulator rechnet wie avr-gcc: `int` hat 16 Bit, kleinere Typen werden vor dem Rechnen zu `int` erweitert, und beim Speichern wird auf den Zieltyp gekürzt. Vereinfachungen: Eine Anweisung dauert hier immer ca. 1 µs, die LEDs zeigen `PORTA`/`PORTB` auch ohne `DDRA = 0xFF;`, und vorzeichenbehafteter Überlauf wird als Wraparound gezeigt, obwohl er in echtem C undefiniert ist.'))
      ])
    ]);
    main.appendChild(rootEl);
    paint();
    setMode('idle');
    render(true);
  }

  root.CSimUI = { show: showSim };
})(typeof window !== 'undefined' ? window : globalThis);
