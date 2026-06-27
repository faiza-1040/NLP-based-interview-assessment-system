//server/utils/queryPreprocess.js
const { correctWord } = require("./spell");

// ----------------- alias + expansions -----------------
const ALIAS_MAP = {
  js: "javascript",
  wp: "wordpress",
  reactjs: "react",
  nodejs: "node",
  nextjs: "next",
  ts: "typescript",
  ux: "user experience",
  ui: "user interface",
  db: "database",
  py: "python",          // ✅ IMPORTANT
};

// tokens we should never spell-correct
const PROTECTED_TOKENS = new Set([
  "js", "wp", "ui", "ux", "db", "ts", "qa", "ui/ux", "py",
  "c++", "c#", "aws", "gcp", "api", "sql", "nosql",
  "reactjs", "nodejs", "nextjs", "vuejs"
]);

// expansions (optional)
const EXPANSION_MAP = {
  python: ["py", "django", "flask", "fastapi"],
  javascript: ["js", "node", "react"],
  wordpress: ["wp", "woocommerce", "elementor"],
  react: ["reactjs", "frontend"],
  node: ["nodejs", "backend"],
  database: ["db", "sql", "mysql", "postgres", "mongodb"],
};

function tokenize(input = "") {
  return String(input)
    .toLowerCase()
    .replace(/[^\w+#/]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function detokenize(tokens) {
  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

function normalizeAlias(token) {
  return ALIAS_MAP[token] || token;
}

function expandTokens(tokens) {
  const out = [];
  const seen = new Set();

  for (const t of tokens) {
    if (!seen.has(t)) {
      out.push(t);
      seen.add(t);
    }
    const extra = EXPANSION_MAP[t];
    if (Array.isArray(extra)) {
      for (const e of extra) {
        const et = String(e).toLowerCase();
        if (!seen.has(et)) {
          out.push(et);
          seen.add(et);
        }
      }
    }
  }
  return out;
}

// spell check rules:
// - only tokens length >= 4
// - skip protected tokens
function spellCorrectTokens(tokens) {
  return tokens.map((t) => {
    if (!t) return t;
    if (t.length < 4) return t;
    if (PROTECTED_TOKENS.has(t)) return t;

    return correctWord(t);
  });
}

async function preprocessQuery(rawQuery = "", opts = {}) {
  const { enableExpansion = true } = opts;

  let tokens = tokenize(rawQuery);

  // ✅ alias first (py -> python)
  tokens = tokens.map(normalizeAlias);

  // ✅ spell check (no async, no ESM problems)
  //tokens = spellCorrectTokens(tokens);

  if (enableExpansion) tokens = expandTokens(tokens);

  return detokenize(tokens);
}

module.exports = { preprocessQuery, tokenize };
