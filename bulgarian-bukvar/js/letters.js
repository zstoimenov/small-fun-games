/* Буквар Quest - the alphabet: 30 letters, an English sound hint for each, and */
/* the letters that fool an English reader.                                     */
/*                                                                              */
/* There is no audio in this game (a speech engine reads a lone letter as its   */
/* name, "ем" for М, which is exactly what a reader must not learn). A grown-up */
/* supplies the sounds; these hints are for when nobody is around.             */
"use strict";
window.BQ = window.BQ || {};

BQ.Letters = (function () {
  // Capital, small, and the sound as an English word the child already knows.
  // `like` is the English letter a child is tempted to read it as, if any.
  const ALPHABET = [
    { up: "А", lo: "а", hint: "a as in father" },
    { up: "Б", lo: "б", hint: "b as in ball" },
    { up: "В", lo: "в", hint: "v as in van", like: "B" },
    { up: "Г", lo: "г", hint: "g as in go" },
    { up: "Д", lo: "д", hint: "d as in dog" },
    { up: "Е", lo: "е", hint: "e as in egg" },
    { up: "Ж", lo: "ж", hint: "s as in treasure" },
    { up: "З", lo: "з", hint: "z as in zoo" },
    { up: "И", lo: "и", hint: "ee as in see", like: "u" },
    { up: "Й", lo: "й", hint: "y as in boy" },
    { up: "К", lo: "к", hint: "k as in kite" },
    { up: "Л", lo: "л", hint: "l as in lion" },
    { up: "М", lo: "м", hint: "m as in mum" },
    { up: "Н", lo: "н", hint: "n as in net", like: "H" },
    { up: "О", lo: "о", hint: "o as in pot" },
    { up: "П", lo: "п", hint: "p as in pen", like: "n" },
    { up: "Р", lo: "р", hint: "r as in rabbit, rolled", like: "P" },
    { up: "С", lo: "с", hint: "s as in sun", like: "C" },
    { up: "Т", lo: "т", hint: "t as in top" },
    { up: "У", lo: "у", hint: "oo as in moon", like: "Y" },
    { up: "Ф", lo: "ф", hint: "f as in fish" },
    { up: "Х", lo: "х", hint: "h as in hat, but breathier", like: "X" },
    { up: "Ц", lo: "ц", hint: "ts as in cats" },
    { up: "Ч", lo: "ч", hint: "ch as in chip" },
    { up: "Ш", lo: "ш", hint: "sh as in ship" },
    { up: "Щ", lo: "щ", hint: "sht as in ashtray" },
    { up: "Ъ", lo: "ъ", hint: "u as in butter" },
    { up: "Ь", lo: "ь", hint: "no sound of its own: ьо says yo as in yo-yo" },
    { up: "Ю", lo: "ю", hint: "you" },
    { up: "Я", lo: "я", hint: "ya as in yard" }
  ];

  const BY = {};
  ALPHABET.forEach((l, i) => { l.i = i; BY[l.up] = l; BY[l.lo] = l; });

  // The look-alike drill. Each trap letter, the English sound it gets misread
  // as, and the real one, both written the way a child would say them.
  // Small п and и are here too: they look like English n and u.
  const TRAPS = [
    { ch: "Р", key: "Р", wrong: "p as in pen", right: "r as in rabbit" },
    { ch: "В", key: "В", wrong: "b as in ball", right: "v as in van" },
    { ch: "Н", key: "Н", wrong: "h as in hat", right: "n as in net" },
    { ch: "С", key: "С", wrong: "k as in cat", right: "s as in sun" },
    { ch: "Х", key: "Х", wrong: "ks as in box", right: "h as in hat" },
    { ch: "У", key: "У", wrong: "y as in yes", right: "oo as in moon" },
    { ch: "п", key: "П", wrong: "n as in net", right: "p as in pen" },
    { ch: "и", key: "И", wrong: "u as in up", right: "ee as in see" }
  ];

  // Letters that look alike *to each other*, used as wrong answers when the
  // drill asks "which one says v?". Close shapes make the question honest.
  const SHAPES = {
    "Р": ["Р", "В", "Б", "Ф"], "В": ["В", "Б", "Р", "З"], "Н": ["Н", "И", "П", "Й"],
    "С": ["С", "О", "Е", "З"], "Х": ["Х", "Ж", "К", "Н"], "У": ["У", "Ч", "Ц", "Ъ"],
    "П": ["П", "Н", "Л", "Д"], "И": ["И", "Й", "Н", "П"]
  };

  return { ALPHABET, BY, TRAPS, SHAPES };
})();
