// server/utils/spell.js
const SymSpell = require("symspell");
const { Verbosity } = SymSpell;

const fs = require("fs");
const path = require("path");

let _sym = null;
let _loaded = false;

function loadSymSpell() {
  if (_loaded) return _sym;

  _sym = new SymSpell(100000, 2); // max words, edit distance
  const dictPath = path.join(__dirname, "skills-dictionary.txt");

  if (!fs.existsSync(dictPath)) {
    console.warn("[spell] skills-dictionary.txt not found. Spell correction disabled.");
    _loaded = true;
    return _sym;
  }

  const lines = fs.readFileSync(dictPath, "utf8").split(/\r?\n/);
  let freq = 10000;

  for (const line of lines) {
    const w = String(line || "").trim().toLowerCase();
    if (!w) continue;

    // SymSpell expects word + frequency
    _sym.createDictionaryEntry(w, freq--);
    if (freq < 1) freq = 1;
  }

  _loaded = true;
  return _sym;
}

function correctWord(word) {
  const sym = loadSymSpell();
  if (!sym) return word;

  const res = sym.lookup(word, Verbosity.TOP, 2);
  if (res && res.length > 0 && res[0]?.term) return res[0].term;
  return word;
}

module.exports = { correctWord };
