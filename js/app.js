/* Logik fuer "C-Variablentypen lernen". Kein Framework, laeuft auch per file://. */
(function () {
  'use strict';

  var LS_KEY = 'c-variablentypen-fortschritt-v5';
  var state = { solved: {} };     // taskId -> true (im 1. Versuch) / false
  var main, cheatPanel, cheatBtn;

  /* ---------- Speicher ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o.solved === 'object' && o.solved) state.solved = o.solved;
      }
    } catch (e) { /* kein localStorage verfuegbar */ }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignorieren */ }
  }

  /* ---------- DOM-Helfer (kein innerHTML) ---------- */
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : String(v));
      });
    }
    add(n, kids);
    return n;
  }
  function add(n, kids) {
    if (kids == null) return n;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  /* Text mit `Inline-Code` -> Fragment mit <code>-Elementen */
  function rich(text) {
    var frag = document.createDocumentFragment();
    String(text || '').split('`').forEach(function (part, i) {
      if (!part) return;
      frag.appendChild(i % 2 ? el('code', { class: 'inline' }, part) : document.createTextNode(part));
    });
    return frag;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  var lastPick = {};
  function pickNew(key, arr) {
    var v, n = 0;
    do { v = pick(arr); n++; } while (arr.length > 1 && v === lastPick[key] && n < 10);
    lastPick[key] = v;
    return v;
  }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function lvColor(li) { return (typeof LEVEL_COLORS !== 'undefined' && LEVEL_COLORS[li % LEVEL_COLORS.length]) || '#FFD23F'; }

  /* ---------- Maskottchen "Bit" (Pixel-SVG aus Rechtecken) ---------- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, String(attrs[k])); });
    return n;
  }
  var MOOD_PIXELS = {
    neutral: { eyes: [[5, 6, 2, 2], [9, 6, 2, 2]], mouth: [[6, 10, 4, 1]] },
    happy:   { eyes: [[5, 7, 1, 1], [6, 6, 1, 1], [7, 7, 1, 1], [9, 7, 1, 1], [10, 6, 1, 1], [11, 7, 1, 1]],
               mouth: [[5, 10, 1, 1], [6, 11, 4, 1], [10, 10, 1, 1]], cheeks: true },
    oops:    { eyes: [[5, 6, 2, 1], [6, 7, 1, 1], [9, 6, 2, 1], [9, 7, 1, 1]],
               mouth: [[5, 11, 1, 1], [6, 10, 2, 1], [8, 11, 2, 1], [10, 10, 1, 1]], sweat: true },
    party:   { eyes: [[5, 7, 1, 1], [6, 6, 1, 1], [7, 7, 1, 1], [9, 7, 1, 1], [10, 6, 1, 1], [11, 7, 1, 1]],
               mouth: [[6, 10, 4, 2]], tongue: true, cheeks: true, sparkles: true, arms: true }
  };
  function px(p, x, y, w, h, cls) { p.appendChild(svgEl('rect', { x: x, y: y, width: w, height: h, class: cls })); }
  function grp(p, cls) { var n = svgEl('g', { class: cls }); p.appendChild(n); return n; }
  // Gesicht (Augen, Mund, Wangen, Schweiss) neu zeichnen – auch fuer Stimmungswechsel
  function drawFace(face, mood) {
    var m = MOOD_PIXELS[mood] || MOOD_PIXELS.neutral;
    while (face.firstChild) face.removeChild(face.firstChild);
    var eyes = grp(face, 'bit-eyes'), mouth = grp(face, 'bit-mouth');
    m.eyes.forEach(function (e) { px(eyes, e[0], e[1], e[2], e[3], 'px-ink'); });
    m.mouth.forEach(function (e) { px(mouth, e[0], e[1], e[2], e[3], 'px-ink'); });
    if (m.tongue) px(mouth, 7, 11, 2, 1, 'px-red');
    if (m.cheeks) { px(face, 4, 9, 1, 1, 'px-red'); px(face, 11, 9, 1, 1, 'px-red'); }
    if (m.sweat) { var sw = grp(face, 'bit-sweat'); px(sw, 12, 4, 1, 1, 'px-blue'); px(sw, 12, 5, 1, 2, 'px-blue'); }
    var lids = grp(face, 'bit-lids');
    px(lids, 5, 7, 2, 1, 'px-ink'); px(lids, 9, 7, 2, 1, 'px-ink');
  }
  function setBitMood(svg, mood) {
    var face = svg && svg.querySelector('.bit-face');
    if (face) drawFace(face, mood);
  }
  // Zufaelliges Blinzeln alle 3–6 s; stoppt, sobald Bit nicht mehr im DOM ist
  function startBlink(svg) {
    if (reducedMotion()) return;
    function next() { setTimeout(tick, 3000 + Math.random() * 3000); }
    function tick() {
      if (!svg.isConnected) return;
      svg.classList.add('blink');
      setTimeout(function () { svg.classList.remove('blink'); }, 130);
      next();
    }
    next();
  }
  // Reaktions-Klasse kurz setzen (neu startbar)
  function bitPlay(svg, cls, ms) {
    var g = svg && svg.querySelector('.bit-react');
    if (!g) return;
    g.classList.remove(cls); void svg.getBoundingClientRect(); g.classList.add(cls);
    setTimeout(function () { g.classList.remove(cls); }, ms);
  }
  function bitSvg(mood, opts) {
    opts = opts || {};
    var m = MOOD_PIXELS[mood] || MOOD_PIXELS.neutral;
    var s = svgEl('svg', { viewBox: '-3 -3 22 22', class: 'bit-svg', 'aria-hidden': 'true', focusable: 'false', 'shape-rendering': 'crispEdges',
      style: '--bd:-' + (Math.random() * 3).toFixed(2) + 's' });
    var fx = grp(s, 'bit-fx');
    var react = grp(s, 'bit-react'), breathe = grp(react, 'bit-breathe');
    // Pins (Beinchen) als eigene Gruppen
    var pl = grp(breathe, 'bit-pins bit-pins-l'), pr = grp(breathe, 'bit-pins bit-pins-r'), pv = grp(breathe, 'bit-pins bit-pins-v');
    [4, 7, 10].forEach(function (y) { px(pl, 0, y, 2, 1, 'px-ink'); px(pr, 14, y, 2, 1, 'px-ink'); });
    [5, 10].forEach(function (x) { px(pv, x, 0, 1, 2, 'px-ink'); px(pv, x, 14, 1, 2, 'px-ink'); });
    if (m.arms) {
      var al = grp(breathe, 'bit-arm bit-arm-l'), ar = grp(breathe, 'bit-arm bit-arm-r');
      px(al, -2, 1, 1, 3, 'px-ink'); px(al, -1, 4, 1, 1, 'px-ink'); px(ar, 17, 1, 1, 3, 'px-ink'); px(ar, 16, 4, 1, 1, 'px-ink');
    }
    // Koerper mit Kontur
    px(breathe, 2, 2, 12, 12, 'px-ink');
    px(breathe, 3, 3, 10, 10, 'px-body');
    px(breathe, 3, 3, 10, 1, 'px-light');
    px(breathe, 11, 11, 1, 1, 'px-dot bit-led');
    drawFace(grp(breathe, 'bit-face'), mood);
    // Effekte ausserhalb des Koerpers
    if (m.sparkles) {
      var sp = grp(fx, 'bit-sparkles');
      [[-2, -2], [17, -2], [-3, 12], [18, 13]].forEach(function (p, i) {
        var one = grp(sp, 'bit-spark s' + i);
        px(one, p[0], p[1] + 1, 3, 1, 'px-yellow'); px(one, p[0] + 1, p[1], 1, 3, 'px-yellow');
      });
    }
    if (mood === 'oops') { var ex = grp(fx, 'bit-alert'); px(ex, 15, -3, 1, 3, 'px-red'); px(ex, 15, 1, 1, 1, 'px-red'); }
    var st = opts.streak || 0;
    if (st >= 3) {
      s.classList.add('streak-' + (st >= 8 ? 8 : st >= 5 ? 5 : 3));
      var plus = grp(fx, 'bit-plus');
      px(plus, 14, -2, 3, 1, 'px-yellow'); px(plus, 15, -3, 1, 3, 'px-yellow'); px(plus, 18, -3, 1, 3, 'px-yellow');
    }
    if (st >= 8) {
      var heat = grp(fx, 'bit-heat');
      [[4, 'px-red'], [8, 'px-yellow'], [12, 'px-red']].forEach(function (h, i) { px(grp(heat, 'h' + i), h[0], -1, 1, 1, h[1]); });
    }
    if (!opts.still) startBlink(s);
    return s;
  }
  // Klick/Tap auf Bit: Hüpfer + Spruch; ≥5 schnelle Klicks = Stack Overflow
  function bitPokeable(fig, svg, mood, bubble) {
    var hits = [];
    fig.addEventListener('click', function () {
      var now = Date.now();
      hits = hits.filter(function (t) { return now - t < 2500; });
      hits.push(now);
      var msg;
      if (hits.length >= 5) {
        hits = [];
        bitPlay(svg, 'bit-tumble', 900);
        setBitMood(svg, 'oops');
        setTimeout(function () { if (svg.isConnected) setBitMood(svg, mood); }, 900);
        msg = 'Stack Overflow! Zu viele Aufrufe auf einmal – ich brauch kurz einen frischen Stack.';
      } else {
        bitPlay(svg, 'bit-poke', 450);
        msg = typeof BIT_POKE !== 'undefined' ? pickNew('poke', BIT_POKE) : 'Hallo!';
      }
      if (bubble) { clear(bubble); bubble.appendChild(rich(msg)); }
    });
  }
  function mascot(mood, text, extraClass) {
    var svg = bitSvg(mood);
    var bubble = text ? el('div', { class: 'bubble', 'aria-live': 'polite' }, typeof text === 'string' ? rich(text) : text) : null;
    var fig = el('button', { type: 'button', class: 'bit-figure bit-btn', 'aria-label': 'Bit anstupsen' }, svg);
    bitPokeable(fig, svg, mood, bubble);
    return el('div', { class: 'bit-say mood-' + mood + (extraClass ? ' ' + extraClass : '') }, [fig, bubble]);
  }

  /* ---------- Konfetti (eckige DOM-Schnipsel) ---------- */
  function confetti() {
    if (reducedMotion()) return;
    var box = el('div', { class: 'confetti', 'aria-hidden': 'true' });
    var cols = ['#FFD23F', '#3DD6AE', '#FF5A4E', '#5AA9FF', '#B79CFF', '#161512'];
    for (var i = 0; i < 70; i++) {
      var w = 6 + Math.floor(Math.random() * 8), h = 6 + Math.floor(Math.random() * 12);
      box.appendChild(el('span', { style:
        'left:' + (Math.random() * 100).toFixed(1) + '%;width:' + w + 'px;height:' + h + 'px;background:' + pick(cols) +
        ';animation-delay:' + (Math.random() * 0.35).toFixed(2) + 's;animation-duration:' + (0.9 + Math.random() * 0.8).toFixed(2) + 's;' +
        '--dx:' + Math.round(Math.random() * 160 - 80) + 'px;--rot:' + Math.round(Math.random() * 720 - 360) + 'deg' }));
    }
    document.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 2400);
  }

  /* Einfache Icons als Pixel-SVG */
  function lockIcon() {
    var s = svgEl('svg', { viewBox: '0 0 10 12', class: 'icon-lock', 'aria-hidden': 'true', focusable: 'false', 'shape-rendering': 'crispEdges' });
    [[2, 0, 6, 1], [1, 1, 1, 4], [8, 1, 1, 4], [0, 5, 10, 7]].forEach(function (p) { s.appendChild(svgEl('rect', { x: p[0], y: p[1], width: p[2], height: p[3], class: 'px-ink' })); });
    s.appendChild(svgEl('rect', { x: 4, y: 7, width: 2, height: 3, class: 'px-hole' }));
    return s;
  }

  /* ---------- Zahlen / Typen ---------- */
  function fmt(v) {
    var s = v.toString(), neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    return (neg ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, '\'');
  }
  function range(name) {
    var t = TYPE_INFO[name];
    if (!t) return null;
    var bits = BigInt(t.bytes * 8);
    if (t.vz) return { min: -(1n << (bits - 1n)), max: (1n << (bits - 1n)) - 1n };
    return { min: 0n, max: (1n << bits) - 1n };
  }
  function wrap(v, bits, vz) {
    var m = 1n << BigInt(bits);
    var r = ((v % m) + m) % m;
    if (vz && r >= m / 2n) r -= m;
    return r;
  }
  function parseInt64(str) {
    var s = String(str).replace(/[\s'’_]/g, '').replace(/^\u2212/, '-');
    if (!/^[-+]?\d+$/.test(s)) return null;
    try { return BigInt(s); } catch (e) { return null; }
  }

  /* ---------- Syntax-Highlighting ---------- */
  var KW = {}, TY = {};
  'if else for while do return const static void break continue switch case default typedef'.split(' ').forEach(function (w) { KW[w] = 1; });
  /* 'int' nur fuer `int main(void)` */
  'int size_t int8_t uint8_t int16_t uint16_t int32_t uint32_t int64_t uint64_t'.split(' ').forEach(function (w) { TY[w] = 1; });
  /* LED-Ausgaben PORTA/PORTB (nur Kulisse) und F_CPU */
  var REG = /^(?:DDR|PORT)[AB]$/;
  var REG_BIT = /^F_CPU$/;
  var TOKEN = /(\/\/.*$)|(\/\*.*?\*\/)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(____)|(\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFuUlL]*)|([A-Za-z_]\w*)/g;

  function highlightLine(line) {
    var frag = document.createDocumentFragment();
    if (/^\s*#/.test(line)) { frag.appendChild(el('span', { class: 'tok-pre' }, line)); return frag; }
    var last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(line)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(line.slice(last, m.index)));
      var cls = null, txt = m[0];
      if (m[1] || m[2]) cls = 'tok-com';
      else if (m[3] || m[4]) cls = 'tok-str';
      else if (m[5]) cls = 'tok-blank';
      else if (m[6]) cls = /^0[xX]/.test(txt) ? 'tok-hex' : 'tok-num';
      else if (m[7]) cls = TY[txt] ? 'tok-type' : REG.test(txt) ? 'tok-reg' : REG_BIT.test(txt) ? 'tok-pre' : (KW[txt] ? 'tok-kw' : (line.charAt(TOKEN.lastIndex) === '(' ? 'tok-fn' : null));
      frag.appendChild(cls ? el('span', { class: cls }, txt) : document.createTextNode(txt));
      last = TOKEN.lastIndex;
    }
    if (last < line.length) frag.appendChild(document.createTextNode(line.slice(last)));
    return frag;
  }
  function codeBlock(code, opts) {
    opts = opts || {};
    var lines = Array.isArray(code) ? code : String(code).split('\n');
    var box = el('div', { class: 'code' }, [
      el('div', { class: 'code-bar', 'aria-hidden': 'true' }, [el('span'), el('span'), el('span'), el('em', null, opts.title || 'main.c')])
    ]);
    var body = el('div', { class: 'code-body' });
    var lineEls = lines.map(function (l, i) {
      var inner = [el('span', { class: 'ln', 'aria-hidden': 'true' }, String(i + 1)), el('span', { class: 'lc' }, highlightLine(l))];
      var row = opts.clickable
        ? el('button', { type: 'button', class: 'code-line clickable', 'aria-label': 'Zeile ' + (i + 1) + ': ' + (l.trim() || '(leer)') }, inner)
        : el('div', { class: 'code-line' }, inner);
      body.appendChild(row);
      return row;
    });
    box.appendChild(body);
    box.lines = lineEls;
    return box;
  }

  /* ---------- Fortschritt ---------- */
  function tid(li, ti) { var t = LEVELS[li].tasks[ti]; return t.id || (LEVELS[li].id + '-' + ti); }
  function levelSolved(li) {
    var n = 0;
    LEVELS[li].tasks.forEach(function (t, ti) { if (tid(li, ti) in state.solved) n++; });
    return n;
  }
  function levelDone(li) { return levelSolved(li) === LEVELS[li].tasks.length; }
  function unlocked(li) { return li === 0 || levelDone(li - 1); }
  function totals() {
    var all = 0, done = 0;
    LEVELS.forEach(function (l, li) { all += l.tasks.length; done += levelSolved(li); });
    return { all: all, done: done };
  }
  /* Segmentierter Balken wie eine Akku-/Lebensanzeige */
  function bar(done, all, label, maxSeg) {
    var n = Math.max(1, Math.min(all, maxSeg || all));
    var filled = all ? Math.round(done / all * n) : 0;
    if (done > 0 && filled === 0) filled = 1;
    if (done < all && filled === n && n > 1) filled = n - 1;
    var b = el('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': all, 'aria-valuenow': done, 'aria-label': label,
      'aria-valuetext': done + ' von ' + all });
    for (var i = 0; i < n; i++) b.appendChild(el('span', { class: 'seg' + (i < filled ? ' on' : '') }));
    return b;
  }
  function rankIndex() {
    var t = totals(), f = t.all ? t.done / t.all : 0, idx = 0;
    RANKS.forEach(function (r, i) { if (f >= r.min) idx = i; });
    return idx;
  }
  var shownRank = -1;
  function updateTop() {
    var t = totals();
    var box = document.getElementById('top-progress');
    clear(box);
    add(box, [bar(t.done, t.all, 'Gesamtfortschritt', 24), el('span', { class: 'bar-text' }, t.done + ' / ' + t.all)]);
    var ri = rankIndex(), rk = document.getElementById('rank');
    if (rk && ri !== shownRank) {
      var up = shownRank >= 0 && ri > shownRank;
      clear(rk);
      add(rk, [el('span', { class: 'rank-label' }, 'Rang'), el('span', { class: 'rank-name' }, RANKS[ri].name)]);
      rk.setAttribute('title', 'Rang ' + (ri + 1) + ' von ' + RANKS.length);
      if (up) {
        rk.classList.remove('rank-up'); void rk.offsetWidth; rk.classList.add('rank-up');
        rk.appendChild(el('span', { class: 'rank-flash' }, BIT_SAYS.rankUp));
      }
      shownRank = ri;
    }
  }

  /* ---------- Spickzettel ---------- */
  function buildCheat() {
    var tbody = el('tbody');
    CHEAT_ROWS.forEach(function (r) {
      var info = TYPE_INFO[r.type], rg = range(r.type);
      tbody.appendChild(el('tr', null, [
        el('th', { scope: 'row' }, el('code', null, r.type)),
        el('td', null, String(info.bytes)),
        el('td', null, String(info.bytes * 8)),
        el('td', null, fmt(rg.min) + ' bis ' + fmt(rg.max)),
        el('td', null, rich(r.use))
      ]));
    });
    add(cheatPanel, [
      el('div', { class: 'cheat-head' }, [
        el('h2', { id: 'cheat-title' }, 'Spickzettel'),
        el('button', { type: 'button', class: 'btn ghost', onclick: function () { toggleCheat(false); } }, 'Schliessen')
      ]),
      el('p', null, rich('Plattform: ATmega2560 (Arduino Mega 2560, avr-gcc), 8-Bit-AVR, keine FPU. Typen: `#include <stdint.h>`. Achtung: `int` ist hier nur 16 Bit.')),
      el('div', { class: 'table-wrap' }, el('table', null, [
        el('thead', null, el('tr', null, [el('th', null, 'Typ'), el('th', null, 'Bytes'), el('th', null, 'Bits'), el('th', null, 'Wertebereich'), el('th', null, 'Typisch am ATmega')])),
        tbody
      ])),
      el('p', { class: 'small' }, rich('Formeln: ohne Vorzeichen (`uintN_t`): 0 … 2ⁿ − 1, mit Vorzeichen (`intN_t`): −2ⁿ⁻¹ … 2ⁿ⁻¹ − 1.')),
      el('p', { class: 'small' }, rich('Ausgabe in den Beispielen: 8 LEDs an `PORTA` (und `PORTB`) zeigen die Bits einer Variable. 16 Bit auf LEDs: `PORTA = wert >> 8; PORTB = wert & 0xFF;`')),
      el('p', { class: 'small' }, rich('Festkomma: Wert × Faktor (10, 100, 1000) als Ganzzahl, z.B. 3.84 km → 3840 m → `uint16_t`. Typ nach dem skalierten Bereich wählen.')),
      el('p', { class: 'small' }, rich('Umwandlung: Zuweisung an einen kleineren Typ behält nur die unteren Bits (`(uint8_t)300` = 44). Kleine Typen werden zum Rechnen zu `int` (16 Bit). Bytes zusammensetzen: `(uint16_t)hi << 8 | lo`.'))
    ]);
  }
  function toggleCheat(show) {
    if (show && cheatBtn.disabled) return;
    if (show === undefined) show = cheatPanel.hidden;
    cheatPanel.hidden = !show;
    cheatBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show) cheatPanel.focus();
  }
  function setCheatAllowed(ok) {
    cheatBtn.disabled = !ok;
    cheatBtn.title = ok ? 'Spickzettel ein-/ausblenden' : 'In der Abschlussprüfung gesperrt';
    cheatBtn.textContent = ok ? 'Spickzettel' : 'Spickzettel (gesperrt)';
    if (!ok) toggleCheat(false);
  }

  /* ---------- Ansicht: Uebersicht ---------- */
  function showOverview() {
    setCheatAllowed(true);
    setNav('levels');
    clear(main);
    main.style.removeProperty('--lv');
    var t = totals();
    var current = -1;
    for (var ci = 0; ci < LEVELS.length; ci++) if (unlocked(ci) && !levelDone(ci)) { current = ci; break; }
    main.appendChild(el('section', { class: 'hero hero-home' }, [
      el('div', { class: 'hero-text' }, [
        el('div', { class: 'eyebrow sticker' }, 'C-Typen auf dem ATmega2560 · 9 Levels'),
        el('h1', null, ['Welcher Typ ', el('span', { class: 'mark' }, 'passt'), '?']),
        el('p', { class: 'lead' }, t.done === 0
          ? 'Lerne Schritt für Schritt am Arduino Mega 2560, wie viele Bits jeder Typ hat, welche Werte hineinpassen, wie Kommazahlen als Festkomma funktionieren – und wie man den passenden Typ wählt. Starte mit Level 1!'
          : (t.done === t.all ? 'Alles geschafft! Du kannst jedes Level beliebig wiederholen.' : 'Mach dort weiter, wo du aufgehört hast – die markierte Station wartet.'))
      ]),
      mascot(t.done === t.all ? 'party' : 'neutral', t.done === 0 ? pickNew('home', BIT_SAYS.home) : (t.done === t.all ? BIT_SAYS.allDone : pickNew('back', BIT_SAYS.back)), 'hero-bit')
    ]));
    var map = el('ol', { class: 'map', 'aria-label': 'Levels' });
    LEVELS.forEach(function (lvl, li) {
      var solved = levelSolved(li), all = lvl.tasks.length, open = unlocked(li), done = solved === all;
      var isCur = li === current;
      var status = done ? 'Erledigt' : (open ? (solved ? 'Läuft' : 'Offen') : 'Gesperrt');
      var label = done ? 'Wiederholen' : (solved ? 'Weitermachen' : 'Starten');
      map.appendChild(el('li', {
        class: 'station' + (open ? '' : ' s-locked') + (done ? ' s-done' : '') + (isCur ? ' s-current' : ''),
        style: '--lv:' + lvColor(li), 'aria-current': isCur ? 'step' : null
      }, [
        el('div', { class: 'node', 'aria-hidden': 'true' }, open ? String(li + 1) : lockIcon()),
        el('article', { class: 'station-card' }, [
          done ? el('div', { class: 'stamp' }, 'Geschafft') : null,
          isCur ? el('div', { class: 'station-bit', 'aria-hidden': 'true' }, bitSvg(solved ? 'happy' : 'neutral')) : null,
          el('div', { class: 'station-top' }, [el('span', { class: 'level-tag' }, 'Level ' + (li + 1)), el('span', { class: 'badge' }, status)]),
          el('h2', null, lvl.title),
          el('p', null, lvl.desc),
          el('div', { class: 'level-meta' }, [bar(solved, all, 'Fortschritt Level ' + (li + 1)), el('span', { class: 'count' }, solved + '/' + all)]),
          el('button', {
            type: 'button', class: 'btn' + (done ? ' ghost' : ''), disabled: !open,
            'aria-label': open ? label + ': Level ' + (li + 1) + ', ' + lvl.title : null,
            onclick: function () { startLevel(li); }
          }, open ? label + ' →' : 'Erst Level ' + li + ' abschliessen')
        ])
      ]));
    });
    main.appendChild(map);

    var facts = LEVELS.filter(function (l, li) { return l.fact && levelDone(li); });
    if (facts.length) {
      main.appendChild(el('h2', { class: 'section-title' }, 'Deine freigeschalteten „Wusstest du?“-Fakten'));
      var fg = el('div', { class: 'facts' });
      facts.forEach(function (l) { fg.appendChild(factBox(l.fact)); });
      main.appendChild(fg);
    }
    main.appendChild(el('div', { class: 'reset-row' },
      el('button', { type: 'button', class: 'btn danger', onclick: resetProgress }, 'Fortschritt zurücksetzen')));
    updateTop();
    focusMain();
  }
  function factBox(f) {
    return el('aside', { class: 'fact' }, [el('div', { class: 'fact-label' }, 'Wusstest du?'), el('h3', null, f.title), el('p', null, rich(f.text))]);
  }
  function resetProgress() {
    if (!window.confirm('Wirklich den gesamten Fortschritt löschen? Das kann nicht rückgängig gemacht werden.')) return;
    state.solved = {};
    save();
    showOverview();
  }

  /* ---------- Ansicht: Level / Aufgabe ---------- */
  function startLevel(li) {
    var tasks = LEVELS[li].tasks, ti = 0;
    run = { li: li, n: 0 };
    if (!levelDone(li)) { for (ti = 0; ti < tasks.length; ti++) if (!(tid(li, ti) in state.solved)) break; }
    if (LEVELS[li].intro) showIntro(li, ti); else showTask(li, ti);
  }

  /* ---------- Info-Seite vor dem Level ---------- */
  function introContent(blocks) {
    var box = el('div', { class: 'intro-body' });
    (blocks || []).forEach(function (b) {
      if (b.p) box.appendChild(el('p', null, rich(b.p)));
      else if (b.ul || b.ol) {
        var list = el(b.ul ? 'ul' : 'ol');
        (b.ul || b.ol).forEach(function (t) { list.appendChild(el('li', null, rich(t))); });
        box.appendChild(list);
      } else if (b.table) {
        var head = el('tr');
        b.table.head.forEach(function (h) { head.appendChild(el('th', { scope: 'col' }, rich(h))); });
        var body = el('tbody');
        b.table.rows.forEach(function (r) {
          body.appendChild(el('tr', null, r.map(function (c, i) { return el(i ? 'td' : 'th', i ? null : { scope: 'row' }, rich(c)); })));
        });
        box.appendChild(el('div', { class: 'table-wrap' }, el('table', { class: 'intro-table' }, [el('thead', null, head), body])));
      } else if (b.code) box.appendChild(codeBlock(b.code, { title: 'beispiel.c' }));
      else if (b.tip) box.appendChild(el('aside', { class: 'tip' }, [el('div', { class: 'fact-label' }, 'Merke'), el('p', null, rich(b.tip))]));
    });
    return box;
  }
  function showIntro(li, ti) {
    var lvl = LEVELS[li];
    setCheatAllowed(lvl.cheat !== false);
    setNav('levels');
    clear(main);
    main.style.setProperty('--lv', lvColor(li));
    var go = el('button', { type: 'button', class: 'btn', onclick: function () { showTask(li, ti); } }, 'Los geht\'s →');
    add(main, [
      el('div', { class: 'level-head' }, [
        el('button', { type: 'button', class: 'btn ghost', onclick: showOverview }, '← Übersicht'),
        el('div', { class: 'lv-num', 'aria-hidden': 'true' }, String(li + 1)),
        el('div', null, [el('div', { class: 'eyebrow' }, 'Level ' + (li + 1) + ' · Bevor es losgeht'), el('h1', null, lvl.title)])
      ]),
      el('section', { class: 'task-card intro-card', 'aria-label': 'Info zum Level' }, [
        mascot('neutral', pickNew('intro', BIT_SAYS.intro), 'intro-bit'),
        introContent(lvl.intro),
        el('div', { class: 'actions' }, go)
      ])
    ]);
    updateTop();
    window.scrollTo(0, 0);
    go.focus({ preventScroll: true });
  }
  var run = { li: -1, n: 0 };   // Serie: richtig im 1. Versuch, in Folge, im aktuellen Level
  var introDlg = null;
  function openIntroDialog(li) {
    if (introDlg && introDlg.parentNode) introDlg.parentNode.removeChild(introDlg);
    var opener = document.activeElement;
    var close = el('button', { type: 'button', class: 'btn ghost' }, 'Schliessen');
    introDlg = el('dialog', { class: 'intro-dialog', 'aria-labelledby': 'intro-dlg-title' }, [
      el('div', { class: 'cheat-head' }, [el('h2', { id: 'intro-dlg-title' }, 'Info: ' + LEVELS[li].title), close]),
      introContent(LEVELS[li].intro)
    ]);
    var dlg = introDlg;
    close.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () {
      if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    });
    document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    close.focus();
  }
  function firstOpen(li) {
    for (var i = 0; i < LEVELS[li].tasks.length; i++) if (!(tid(li, i) in state.solved)) return i;
    return LEVELS[li].tasks.length;
  }

  function showTask(li, ti) {
    var lvl = LEVELS[li], task = lvl.tasks[ti], id = tid(li, ti);
    setCheatAllowed(lvl.cheat !== false);
    setNav('levels');
    clear(main);
    main.style.setProperty('--lv', lvColor(li));
    if (run.li !== li) run = { li: li, n: 0 };

    var steps = el('nav', { class: 'steps', 'aria-label': 'Aufgaben in diesem Level' });
    var reach = firstOpen(li);
    lvl.tasks.forEach(function (t, i) {
      var sid = tid(li, i), solvedHere = sid in state.solved;
      steps.appendChild(el('button', {
        type: 'button', class: 'step' + (solvedHere ? ' ok' : '') + (i === ti ? ' current' : ''),
        'aria-current': i === ti ? 'step' : null,
        'aria-label': 'Aufgabe ' + (i + 1) + (solvedHere ? ' (gelöst)' : ''),
        disabled: !(solvedHere || i <= reach),
        onclick: function () { showTask(li, i); }
      }, String(i + 1)));
    });

    main.appendChild(el('div', { class: 'level-head' }, [
      el('button', { type: 'button', class: 'btn ghost', onclick: showOverview }, '← Übersicht'),
      el('div', { class: 'lv-num', 'aria-hidden': 'true' }, String(li + 1)),
      el('div', null, [el('div', { class: 'eyebrow' }, 'Level ' + (li + 1) + (lvl.exam ? ' · ohne Spickzettel' : '')), el('h1', null, lvl.title)]),
      el('div', { class: 'level-bar' }, [bar(levelSolved(li), lvl.tasks.length, 'Fortschritt in diesem Level'), el('span', { class: 'bar-text' }, levelSolved(li) + ' / ' + lvl.tasks.length)])
    ]));
    var streakEl = el('div', { class: 'streak' + (run.n ? ' on' : ''), 'aria-live': 'polite' });
    function drawStreak(bump) {
      clear(streakEl);
      add(streakEl, [el('span', { class: 'streak-num' }, String(run.n)), el('span', { class: 'streak-label' }, 'in Folge richtig')]);
      streakEl.classList.toggle('on', run.n > 0);
      if (bump) { streakEl.classList.remove('bump'); void streakEl.offsetWidth; streakEl.classList.add('bump'); }
    }
    drawStreak(false);
    var stepsRow = el('div', { class: 'steps-row' }, [steps, el('div', { class: 'steps-side' }, [streakEl,
      lvl.intro ? el('button', { type: 'button', class: 'btn ghost info-btn', 'aria-haspopup': 'dialog', onclick: function () { openIntroDialog(li); } }, [el('span', { class: 'i-box', 'aria-hidden': 'true' }, 'i'), ' Info zum Level']) : null])]);
    main.appendChild(stepsRow);

    var card = el('section', { class: 'task-card', 'aria-labelledby': 'task-q' });
    var feedback = el('div', { class: 'feedback', 'aria-live': 'polite', hidden: true });
    var nextBtn = el('button', { type: 'button', class: 'btn', hidden: true }, ti + 1 < lvl.tasks.length ? 'Nächste Aufgabe →' : 'Level abschliessen →');
    nextBtn.addEventListener('click', function () {
      if (ti + 1 < lvl.tasks.length) showTask(li, ti + 1); else showLevelDone(li);
    });

    add(card, [
      el('div', { class: 'eyebrow' }, 'Aufgabe ' + (ti + 1) + ' von ' + lvl.tasks.length),
      el('h2', { id: 'task-q', class: 'question' }, rich(task.q))
    ]);
    var widget = el('div', { class: 'widget' });
    card.appendChild(widget);
    add(card, [feedback, el('div', { class: 'actions' }, nextBtn)]);
    main.appendChild(card);

    var wrongs = 0, finished = false;
    var ctx = {
      right: function (extra) {
        if (finished) return;
        finished = true;
        if (!(id in state.solved)) { state.solved[id] = wrongs === 0; save(); }
        var streakMsg = null;
        if (wrongs === 0) {
          run.n++;
          drawStreak(true);
          streakMsg = BIT_SAYS.streak[run.n] || null;
        }
        showFeedback(feedback, 'good', pickNew('right', BIT_SAYS.right) + (wrongs === 0 ? '' : BIT_SAYS.retryRight), [extra, task.explain],
          streakMsg ? 'party' : 'happy', streakMsg, streakMsg ? run.n : 0);
        card.classList.remove('shake'); card.classList.add('pop');
        nextBtn.hidden = false;
        updateTop();
        var lb = main.querySelector('.level-bar');
        if (lb) { clear(lb); add(lb, [bar(levelSolved(li), lvl.tasks.length, 'Fortschritt in diesem Level'), el('span', { class: 'bar-text' }, levelSolved(li) + ' / ' + lvl.tasks.length)]); }
        var st = steps.children[ti]; if (st) st.classList.add('ok');
        if (steps.children[ti + 1]) steps.children[ti + 1].disabled = false;
        nextBtn.focus();
      },
      wrong: function (msg, title) {
        if (finished) return;
        wrongs++;
        if (run.n) { run.n = 0; drawStreak(false); }
        showFeedback(feedback, 'bad', title || pickNew('wrong', BIT_SAYS.wrong), [msg || task.hint || 'Lies die Aufgabe nochmal in Ruhe durch.'], 'oops');
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      },
      info: function (title, msg) { showFeedback(feedback, 'info', title, [msg], 'neutral'); },
      isFinished: function () { return finished; }
    };
    if (task.code && task.type !== 'findBug' && task.type !== 'pickType') widget.appendChild(codeBlock(task.code));
    (RENDER[task.type] || renderUnknown)(task, ctx, widget);
    updateTop();
    focusMain();
  }

  function showFeedback(box, kind, title, texts, mood, special, streak) {
    clear(box);
    box.hidden = false;
    box.className = 'feedback ' + kind + (mood ? ' with-bit' : '');
    var body = el('div', { class: 'fb-body' });
    if (special) body.appendChild(el('div', { class: 'fb-special' }, special));
    body.appendChild(el('strong', null, title));
    texts.forEach(function (t) { if (t) body.appendChild(el('p', null, typeof t === 'string' ? rich(t) : t)); });
    if (mood) {
      var fsvg = bitSvg(mood, { streak: streak });
      box.appendChild(el('div', { class: 'bit-figure fb-bit mood-' + mood }, fsvg));
      // nach dem Wackeln wieder ruhig schauen
      if (mood === 'oops') setTimeout(function () { if (fsvg.isConnected) setBitMood(fsvg, 'neutral'); }, 1100);
    }
    box.appendChild(body);
  }

  function showLevelDone(li) {
    var lvl = LEVELS[li];
    if (lvl.exam) { showFinal(); return; }
    clear(main);
    var first = 0;
    lvl.tasks.forEach(function (t, ti) { if (state.solved[tid(li, ti)] === true) first++; });
    var hasNext = li + 1 < LEVELS.length;
    main.style.setProperty('--lv', lvColor(li));
    add(main, [
      el('section', { class: 'done-card celebrate pop' }, [
        el('div', { class: 'big-stamp', 'aria-hidden': 'true' }, 'Geschafft'),
        mascot('party', pickNew('done', BIT_SAYS.done), 'done-bit'),
        el('div', { class: 'eyebrow' }, 'Level ' + (li + 1) + ' abgeschlossen'),
        el('h1', null, lvl.title + ' – geschafft!'),
        el('p', null, first + ' von ' + lvl.tasks.length + ' Aufgaben hast du im ersten Versuch gelöst. ' +
          (first === lvl.tasks.length ? 'Makellos!' : 'Jeder Fehler ist ein Lernschritt – weiter so!')),
        lvl.fact ? factBox(lvl.fact) : null,
        el('div', { class: 'actions' }, [
          hasNext ? el('button', { type: 'button', class: 'btn', onclick: function () { startLevel(li + 1); } }, 'Weiter zu Level ' + (li + 2) + ': ' + LEVELS[li + 1].title) : null,
          el('button', { type: 'button', class: 'btn ghost', onclick: showOverview }, 'Zur Übersicht')
        ])
      ])
    ]);
    updateTop();
    focusMain();
    confetti();
  }

  function showFinal() {
    setCheatAllowed(true);
    clear(main);
    var exam = LEVELS.length - 1, ef = 0, all = 0, allFirst = 0;
    LEVELS.forEach(function (l, li) {
      l.tasks.forEach(function (t, ti) {
        var v = state.solved[tid(li, ti)];
        if (v !== undefined) all++;
        if (v === true) { allFirst++; if (li === exam) ef++; }
      });
    });
    var list = el('ul', { class: 'summary' });
    LEVELS.forEach(function (l, li) {
      var f = 0;
      l.tasks.forEach(function (t, ti) { if (state.solved[tid(li, ti)] === true) f++; });
      list.appendChild(el('li', null, [el('span', null, (li + 1) + '. ' + l.title), el('span', null, f + ' / ' + l.tasks.length + ' im 1. Versuch')]));
    });
    main.style.setProperty('--lv', lvColor(exam));
    setTimeout(confetti, 0);
    add(main, el('section', { class: 'done-card celebrate final pop' }, [
      el('div', { class: 'big-stamp', 'aria-hidden': 'true' }, 'Bestanden'),
      mascot('party', BIT_SAYS.allDone, 'done-bit'),
      el('div', { class: 'eyebrow' }, 'Abschlussprüfung bestanden'),
      el('h1', null, 'Herzlichen Glückwunsch!'),
      el('p', { class: 'big' }, 'Du hast ' + ef + ' von ' + LEVELS[exam].tasks.length + ' Prüfungsaufgaben im ersten Versuch richtig gelöst – insgesamt ' + allFirst + ' von ' + all + ' Aufgaben.'),
      el('p', null, 'Du weisst jetzt, warum man Typen mit fester Grösse verwendet, wie gross sie sind, welche Werte hineinpassen, wie Bits, LEDs und Zweierkomplement zusammenhängen, wie du Kommazahlen als Festkomma speicherst, wie man sparsam Typen wählt, typische Typ-Fehler auf dem ATmega2560 erkennt und was bei Typumwandlungen passiert. Das ist eine richtig solide Grundlage!'),
      list,
      el('div', { class: 'actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: showPlayground }, 'Zur Spielwiese'),
        el('button', { type: 'button', class: 'btn ghost', onclick: showOverview }, 'Zur Übersicht')
      ])
    ]));
    updateTop();
    focusMain();
  }

  /* ---------- Aufgabentypen ---------- */
  function renderUnknown(task, ctx, box) { box.appendChild(el('p', null, 'Unbekannter Aufgabentyp: ' + task.type)); }

  function choiceButtons(options, isRight, ctx, box, whyFor) {
    var wrapEl = el('div', { class: 'options' });
    var btns = options.map(function (o, i) {
      var b = el('button', { type: 'button', class: 'opt' }, rich(o));
      b.addEventListener('click', function () {
        if (ctx.isFinished()) return;
        if (isRight(i)) {
          b.classList.add('ok');
          btns.forEach(function (x) { x.disabled = true; });
          ctx.right();
        } else {
          b.classList.add('no');
          b.disabled = true;
          ctx.wrong(whyFor ? whyFor(i) : null);
        }
      });
      wrapEl.appendChild(b);
      return b;
    });
    box.appendChild(wrapEl);
    return btns;
  }

  var RENDER = {
    choice: function (t, ctx, box) {
      choiceButtons(t.options, function (i) { return i === t.answer; }, ctx, box, function (i) { return t.why && t.why[i]; });
    },
    yesno: function (t, ctx, box) {
      choiceButtons(['Ja', 'Nein'], function (i) { return (i === 0) === t.answer; }, ctx, box);
    },
    number: function (t, ctx, box) {
      var input = el('input', { type: 'text', inputmode: 'text', autocomplete: 'off', id: 'num-in', class: 'num', 'aria-label': 'Deine Antwort' });
      var form = el('form', { class: 'num-form' }, [
        input, t.unit ? el('span', { class: 'unit' }, t.unit) : null,
        el('button', { type: 'submit', class: 'btn' }, 'Prüfen')
      ]);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (ctx.isFinished()) return;
        var v = parseInt64(input.value);
        if (v === null) { ctx.info('Bitte eine ganze Zahl eingeben', 'Zum Beispiel 42 oder -128. Tausendertrennzeichen \' sind erlaubt.'); return; }
        if (v === BigInt(t.answer)) { input.classList.add('ok'); input.readOnly = true; ctx.right(); }
        else {
          var hint = t.hint || null;
          var ans = BigInt(t.answer);
          var dir = v < ans ? 'Deine Zahl ist zu klein.' : 'Deine Zahl ist zu gross.';
          ctx.wrong(dir + (hint ? ' Tipp: ' + hint : ''));
          input.select();
        }
      });
      box.appendChild(form);
      setTimeout(function () { input.focus(); }, 0);
    },
    bits: function (t, ctx, box) {
      var w = bitWidget(t.bits, t.mode === 'mitVZ' ? 'mitVZ' : 'ohneVZ', { leds: !!t.leds });
      box.appendChild(w.node);
      box.appendChild(el('div', { class: 'actions left' }, [
        el('button', { type: 'button', class: 'btn', onclick: function () {
          if (ctx.isFinished()) return;
          var v = t.mode === 'mitVZ' ? w.signedValue() : w.unsignedValue();
          if (v === BigInt(t.target)) { w.lock(); ctx.right(); }
          else ctx.wrong('Eingestellt ist ' + (t.mode === 'mitVZ' ? 'mit Vorzeichen ' : '') + fmt(v) + ', gesucht ist ' + fmt(BigInt(t.target)) + '. ' +
            (t.mode === 'mitVZ' && t.target < 0 ? 'Denk daran: das oberste Bit zählt negativ.' : 'Addiere die Wertigkeiten der eingeschalteten Bits.'));
        } }, 'Prüfen'),
        el('button', { type: 'button', class: 'btn ghost', onclick: function () { if (!ctx.isFinished()) w.set(0n); } }, 'Alle auf 0')
      ]));
    },
    pickType: renderPickType,
    findBug: renderFindBug
  };

  /* 8 LEDs eines Ports (links LED 7, rechts LED 0) */
  function ledStrip(label) {
    var leds = [], row = el('div', { class: 'leds', 'aria-hidden': 'true' });
    for (var i = 7; i >= 0; i--) {
      var l = el('span', { class: 'led' });
      leds.push(l);
      row.appendChild(el('span', { class: 'led-cell' }, [l, el('span', { class: 'led-no' }, String(i))]));
    }
    var out = el('output', { class: 'led-val' });
    var node = el('div', { class: 'led-strip' }, [el('span', { class: 'led-label' }, label), row, out]);
    return {
      node: node,
      set: function (v) {
        var b = Number(wrap(BigInt(v), 8, false));
        leds.forEach(function (l, k) { l.classList.toggle('on', !!(b & (1 << (7 - k)))); });
        var on = [];
        for (var i = 7; i >= 0; i--) if (b & (1 << i)) on.push(i);
        var h = b.toString(16).toUpperCase();
        out.textContent = '= ' + b + ' (0x' + (h.length < 2 ? '0' : '') + h + ')';
        node.setAttribute('aria-label', label + ' = ' + b + ': ' + (on.length ? 'LED ' + on.join(', ') + ' leuchten' : 'alle LEDs aus'));
      }
    };
  }

  /* Bit-Buttons */
  function bitWidget(n, emphasis, opts) {
    opts = opts || {};
    var bits = [], locked = false;
    var strips = [];
    if (opts.leds) {
      if (n === 8) strips.push({ s: ledStrip('LEDs an PORTA'), shift: 0n });
      else { strips.push({ s: ledStrip('PORTA (High-Byte)'), shift: 8n }); strips.push({ s: ledStrip('PORTB (Low-Byte)'), shift: 0n }); }
      strips.forEach(function (x) { x.s.node.setAttribute('role', 'img'); });
    }
    for (var i = 0; i < n; i++) bits.push(0);
    var row = el('div', { class: 'bits', role: 'group', 'aria-label': n + ' Bits, links das höchstwertige' });
    var outU = el('output'), outS = el('output'), outH = el('output');
    var btns = [];
    function val() { var v = 0n; for (var i = 0; i < n; i++) v = (v << 1n) | BigInt(bits[i]); return v; }
    function sval() { return wrap(val(), n, true); }
    function refresh() {
      btns.forEach(function (b, i) {
        b.textContent = String(bits[i]);
        b.setAttribute('aria-pressed', bits[i] ? 'true' : 'false');
        b.classList.toggle('on', !!bits[i]);
      });
      outU.textContent = fmt(val());
      outS.textContent = fmt(sval());
      var h = val().toString(16).toUpperCase();
      while (h.length < n / 4) h = '0' + h;
      outH.textContent = '0x' + h;
      var u = val();
      strips.forEach(function (x) { x.s.set((u >> x.shift) & 0xFFn); });
    }
    for (var k = 0; k < n; k++) {
      (function (idx) {
        var weight = n - 1 - idx;
        var label = idx === 0 ? (emphasis === 'mitVZ' ? '−2' + sup(weight) : '2' + sup(weight)) : '2' + sup(weight);
        var b = el('button', { type: 'button', class: 'bit', 'aria-label': 'Bit ' + weight + ' (Wert ' + (idx === 0 && emphasis === 'mitVZ' ? '-' : '') + (1n << BigInt(weight)).toString() + ')' });
        b.addEventListener('click', function () { if (locked) return; bits[idx] ^= 1; refresh(); });
        btns.push(b);
        var cell = el('div', { class: 'bit-cell' + (idx % 8 === 0 && idx ? ' byte-start' : '') }, [b, el('span', { class: 'weight', 'aria-hidden': 'true' }, label)]);
        row.appendChild(cell);
      })(k);
    }
    var node = el('div', { class: 'bit-widget' }, [
      row,
      strips.length ? el('div', { class: 'led-box' }, strips.map(function (x) { return x.s.node; })) : null,
      el('div', { class: 'bit-values' }, [
        el('div', { class: emphasis === 'ohneVZ' ? 'em' : '' }, [el('span', null, 'ohne Vorzeichen (uint' + n + '_t): '), outU]),
        el('div', { class: emphasis === 'mitVZ' ? 'em' : '' }, [el('span', null, 'mit Vorzeichen (int' + n + '_t): '), outS]),
        el('div', null, [el('span', null, 'hex: '), outH])
      ])
    ]);
    refresh();
    return {
      node: node,
      unsignedValue: val, signedValue: sval,
      set: function (v) { var u = wrap(v, n, false); for (var i = n - 1; i >= 0; i--) { bits[i] = Number(u & 1n); u >>= 1n; } refresh(); },
      lock: function () { locked = true; btns.forEach(function (b) { b.disabled = true; }); }
    };
  }
  function sup(num) {
    var map = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    return String(num).split('').map(function (c) { return map[c]; }).join('');
  }

  /* Typ waehlen */
  function evalType(t, name) {
    if (t.notes && t.notes[name] && !fitsBasic(t, name).ok) return { ok: false, msg: t.notes[name] };
    return fitsBasic(t, name);
  }
  /* Dezimaltext exakt skalieren: scaleDec('3.84', 1000) -> 3840n (Faktor = Zehnerpotenz) */
  function scaleDec(s, factor) {
    s = String(s).replace(/^−/, '-');
    var neg = s.charAt(0) === '-';
    if (neg || s.charAt(0) === '+') s = s.slice(1);
    var p = s.split('.'), digits = String(factor).length - 1, frac = p[1] || '';
    while (frac.length < digits) frac += '0';
    var v = BigInt((p[0] || '0') + frac.slice(0, digits));
    return neg ? -v : v;
  }
  /* Passt der (gespeicherte, ggf. skalierte) Bereich t.min..t.max in den Typ? */
  function fitsBasic(t, name) {
    var info = TYPE_INFO[name];
    var min = BigInt(t.min), max = BigInt(t.max);
    var r = range(name);
    if (min < r.min) {
      if (r.min === 0n) return { ok: false, msg: '`' + name + '` hat kein Vorzeichen und kann keine negativen Werte speichern. Aus ' + fmt(min) + ' würde ' + fmt(wrap(min, info.bytes * 8, false)) + '.' };
    }
    if (min < r.min || max > r.max) {
      var bad = min < r.min ? min : max;
      var became = wrap(bad, info.bytes * 8, info.vz);
      var msg = '`' + name + '` reicht nur von ' + fmt(r.min) + ' bis ' + fmt(r.max) + '. Der Wert ' + fmt(bad) + ' passt nicht hinein – gespeichert würde ' + fmt(became) + '.';
      if (t.scale) {
        var realBad = t.real ? (bad === max ? t.real.max : t.real.min) : null;
        var realInt = realBad != null ? scaleDec(realBad, 1) : null;
        if (realInt !== null && realInt >= r.min && realInt <= r.max) {
          var smp = t.sample || realBad;
          msg += ' Denkfehler: ' + smp + ' sieht klein aus, aber gespeichert wird ' + fmt(scaleDec(smp, t.scale)) + ' (× ' + t.scale + ').';
        } else {
          msg += ' Denk dran: Entscheidend ist der skalierte Wert (× ' + t.scale + ').';
        }
      }
      return { ok: false, msg: msg };
    }
    return { ok: true };
  }
  function renderPickType(t, ctx, box) {
    var parts = String(t.code).split('____');
    var code = codeBlock(t.code);
    box.appendChild(code);
    var blank = code.querySelector('.tok-blank');
    box.appendChild(el('p', { class: 'range-note' }, t.scale && t.real
      ? 'Bereich: ' + t.real.min + ' bis ' + t.real.max + (t.unit ? ' ' + t.unit : '') + ' → × ' + t.scale + ' → gespeichert wird ' + fmt(BigInt(t.min)) + ' bis ' + fmt(BigInt(t.max)) + ' (Ganzzahl)'
      : 'Benötigter Bereich: ' + fmt(BigInt(t.min)) + ' bis ' + fmt(BigInt(t.max)) + ', nur ganze Zahlen'));
    var fitting = t.options.filter(function (o) { return evalType(t, o).ok; });
    var best = Math.min.apply(null, fitting.map(function (o) { return TYPE_INFO[o].bytes; }));
    var chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Typ auswählen' });
    var btns = t.options.map(function (o) {
      var b = el('button', { type: 'button', class: 'chip' }, [el('code', null, o), el('small', null, TYPE_INFO[o].bytes + ' B')]);
      b.addEventListener('click', function () {
        if (ctx.isFinished()) return;
        var r = evalType(t, o), bytes = TYPE_INFO[o].bytes;
        if (blank) { blank.textContent = o; blank.className = 'tok-type filled'; }
        if (r.ok && bytes === best) {
          b.classList.add('ok');
          btns.forEach(function (x) { x.disabled = true; });
          ctx.right('`' + o + '` passt und braucht nur ' + bytes + (bytes === 1 ? ' Byte.' : ' Bytes.'));
        } else if (r.ok) {
          b.classList.add('meh');
          var waste = bytes - best;
          ctx.wrong('`' + o + '` funktioniert, verschwendet aber ' + waste + (waste === 1 ? ' Byte' : ' Bytes') + ' – geht es sparsamer?', 'Funktioniert – aber nicht optimal.');
        } else {
          b.classList.add('no');
          b.disabled = true;
          ctx.wrong(r.msg, 'Zu klein bzw. unpassend!');
        }
      });
      chips.appendChild(b);
      return b;
    });
    void parts;
    box.appendChild(chips);
  }

  /* Fehler finden */
  function renderFindBug(t, ctx, box) {
    var code = codeBlock(t.code, { clickable: true });
    box.appendChild(el('p', { class: 'step-note' }, 'Schritt 1: Klicke auf die fehlerhafte Zeile.'));
    box.appendChild(code);
    var fixBox = el('div', { class: 'fixes', hidden: true });
    box.appendChild(fixBox);
    var found = false;
    code.lines.forEach(function (ln, i) {
      ln.addEventListener('click', function () {
        if (found || ctx.isFinished()) return;
        if (t.bugLines.indexOf(i) >= 0) {
          found = true;
          ln.classList.add('bug');
          code.lines.forEach(function (x) { x.disabled = true; });
          ctx.info('Gefunden! Zeile ' + (i + 1) + ' ist die Ursache.', 'Schritt 2: Wähle die richtige Korrektur.');
          fixBox.hidden = false;
          fixBox.appendChild(el('p', { class: 'step-note' }, 'Schritt 2: Welche Korrektur behebt den Fehler?'));
          var btns = choiceButtons(t.fixes, function (k) { return k === t.fix; }, ctx, fixBox, function (k) { return t.why && t.why[k]; });
          if (btns[0]) btns[0].focus();
        } else {
          ln.classList.add('nobug');
          ctx.wrong('Zeile ' + (i + 1) + ' ist in Ordnung. ' + (t.lineHint || ''));
        }
      });
    });
  }

  /* ---------- Spielwiese: Overflow-Simulator ---------- */
  var PLAY_TYPES = ['uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t', 'uint64_t', 'int64_t'];
  function showPlayground() {
    setCheatAllowed(true);
    setNav('play');
    clear(main);
    main.style.removeProperty('--lv');
    var cur = { type: 'uint8_t', v: 250n };
    var sel = el('select', { id: 'pg-type' });
    PLAY_TYPES.forEach(function (n) { sel.appendChild(el('option', { value: n }, n)); });
    var input = el('input', { type: 'text', id: 'pg-val', autocomplete: 'off', class: 'num' });
    var widgetBox = el('div');
    var info = el('p', { class: 'range-note' });
    var log = el('div', { class: 'feedback info', 'aria-live': 'polite' });
    var pgLeds = ledStrip('PORTA = Low-Byte');
    pgLeds.node.setAttribute('role', 'img');
    var w;
    function showLeds() { pgLeds.set(wrap(cur.v, 8, false)); }

    function bitsOf() { return TYPE_INFO[cur.type].bytes * 8; }
    function rebuild() {
      clear(widgetBox);
      w = bitWidget(bitsOf(), TYPE_INFO[cur.type].vz ? 'mitVZ' : 'ohneVZ');
      widgetBox.appendChild(w.node);
      // Bit-Klicks aktualisieren den Wert
      w.node.addEventListener('click', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('bit')) {
          cur.v = TYPE_INFO[cur.type].vz ? w.signedValue() : w.unsignedValue();
          input.value = cur.v.toString();
          showLeds();
        }
      });
      var r = range(cur.type);
      info.textContent = cur.type + ': ' + TYPE_INFO[cur.type].bytes + ' Byte, Bereich ' + fmt(r.min) + ' bis ' + fmt(r.max);
      setValue(cur.v, null);
    }
    function setValue(raw, opText) {
      var t = TYPE_INFO[cur.type], r = range(cur.type);
      var nv = wrap(raw, bitsOf(), t.vz);
      clear(log);
      if (raw !== nv) {
        log.className = 'feedback bad';
        log.appendChild(el('strong', null, 'Überlauf! '));
        log.appendChild(document.createTextNode((opText ? opText + ' ergibt ' + fmt(raw) : 'Der Wert ' + fmt(raw)) + ', das passt nicht in ' + cur.type + ' (' + fmt(r.min) + ' … ' + fmt(r.max) + '). Gespeichert wird ' + fmt(nv) + '.'));
        log.appendChild(el('p', null, t.vz
          ? (opText ? 'Achtung: Ein Überlauf bei Typen mit Vorzeichen (intN_t) ist in C undefiniertes Verhalten! Hier wird das typische Wraparound (Zweierkomplement) gezeigt – verlass dich im echten Code nie darauf.'
                    : 'Hinweis: Die Umwandlung eines zu grossen Werts in einen Typ mit Vorzeichen ist implementierungsabhängig; gezeigt wird das übliche Wraparound.')
          : 'Bei Typen ohne Vorzeichen (uintN_t) ist das Wraparound in C genau festgelegt: Es wird modulo 2^' + bitsOf() + ' gerechnet.'));
      } else {
        log.className = 'feedback info';
        log.appendChild(el('strong', null, 'Wert: ' + fmt(nv)));
        log.appendChild(document.createTextNode(nv === r.max ? ' – das ist das Maximum. Probiere +1!' : (nv === r.min ? ' – das ist das Minimum. Probiere −1!' : '')));
      }
      cur.v = nv;
      input.value = nv.toString();
      w.set(nv);
      showLeds();
    }
    function op(d) { setValue(cur.v + d, fmt(cur.v) + (d < 0n ? ' − ' + fmt(-d) : ' + ' + fmt(d))); }

    sel.addEventListener('change', function () { cur.type = sel.value; cur.v = wrap(cur.v, bitsOf(), TYPE_INFO[cur.type].vz); rebuild(); });
    var form = el('form', { class: 'num-form' }, [el('label', { for: 'pg-val' }, 'Wert:'), input, el('button', { type: 'submit', class: 'btn' }, 'Setzen')]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = parseInt64(input.value);
      if (v === null) { clear(log); log.className = 'feedback info'; log.appendChild(el('strong', null, 'Bitte eine ganze Zahl eingeben.')); return; }
      setValue(v, null);
    });
    function b(label, fn) { return el('button', { type: 'button', class: 'btn ghost', onclick: fn }, label); }

    add(main, [
      el('section', { class: 'hero hero-home' }, [
        el('div', { class: 'hero-text' }, [
          el('div', { class: 'eyebrow sticker' }, 'Spielwiese'),
          el('h1', null, ['Overflow-', el('span', { class: 'mark' }, 'Simulator')]),
          el('p', { class: 'lead' }, 'Wähle einen Typ, gib einen Wert ein und schau, was bei +1 über dem Maximum oder −1 unter dem Minimum passiert. Du kannst auch direkt die Bits anklicken. Darunter siehst du, was 8 LEDs an PORTA zeigen würden.')
        ]),
        mascot('happy', BIT_SAYS.play, 'hero-bit')
      ]),
      el('section', { class: 'task-card' }, [
        el('div', { class: 'pg-controls' }, [el('label', { for: 'pg-type' }, 'Typ:'), sel, form]),
        info,
        el('div', { class: 'pg-buttons' }, [
          b('−10', function () { op(-10n); }), b('−1', function () { op(-1n); }),
          b('+1', function () { op(1n); }), b('+10', function () { op(10n); }),
          b('Min', function () { setValue(range(cur.type).min, null); }),
          b('Max', function () { setValue(range(cur.type).max, null); }),
          b('0', function () { setValue(0n, null); })
        ]),
        widgetBox,
        el('div', { class: 'led-box' }, [pgLeds.node, el('p', { class: 'small' }, rich('So sähe `PORTA = wert;` aus: Der Port übernimmt nur die unteren 8 Bit (Wert mod 256).'))]),
        log
      ])
    ]);
    rebuild();
    updateTop();
    focusMain();
  }

  /* ---------- Simulator (Kern + Oberflaeche in js/sim.js) ---------- */
  function showSimulator() {
    setCheatAllowed(true);
    setNav('sim');
    clear(main);
    main.style.removeProperty('--lv');
    if (typeof CSimUI === 'undefined') {
      main.appendChild(el('p', null, 'Der Simulator (js/sim.js) konnte nicht geladen werden.'));
    } else {
      CSimUI.show(main, { el: el, add: add, clear: clear, rich: rich, mascot: mascot, highlightLine: highlightLine });
    }
    updateTop();
    focusMain();
  }

  /* ---------- Navigation ---------- */
  function setNav(which) {
    document.getElementById('nav-levels').setAttribute('aria-current', which === 'levels' ? 'page' : 'false');
    document.getElementById('nav-play').setAttribute('aria-current', which === 'play' ? 'page' : 'false');
    document.getElementById('nav-sim').setAttribute('aria-current', which === 'sim' ? 'page' : 'false');
  }
  function focusMain() {
    window.scrollTo(0, 0);
    var h = main.querySelector('h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  function init() {
    main = document.getElementById('main');
    cheatPanel = document.getElementById('cheat');
    cheatBtn = document.getElementById('cheat-btn');
    load();
    buildCheat();
    cheatBtn.addEventListener('click', function () { toggleCheat(); });
    document.getElementById('nav-levels').addEventListener('click', showOverview);
    document.getElementById('nav-play').addEventListener('click', showPlayground);
    document.getElementById('nav-sim').addEventListener('click', showSimulator);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !cheatPanel.hidden) { toggleCheat(false); cheatBtn.focus(); }
    });
    showOverview();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
