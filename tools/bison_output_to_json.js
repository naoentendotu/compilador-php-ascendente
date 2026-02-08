const fs = require("fs");
const path = require("path");

function mapTokenName(tok) {
  if (tok === "$end") return "EOF";
  return tok;
}

function isTerminalName(s) {
  // no grammar.y são MAIÚSCULOS (PHP_OPEN, IF, PLUS...)
  // Nonterminals são minúsculos (programa, corpo...)
  if (!s) return false;
  if (s === "$end") return true;
  return /^[A-Z_][A-Z0-9_]*$/.test(s);
}

function parseRules(text) {
  // Captura o bloco entre "Grammar" e "Terminals,"
  const mBlock = text.match(
    /(?:^|\r?\n)Grammar\r?\n([\s\S]*?)(?:\r?\n)Terminals,/,
  );

  if (!mBlock) {
    const head = text.slice(0, 400);
    throw new Error(
      "Não consegui localizar o bloco entre 'Grammar' e 'Terminals,' no grammar.output.\n" +
        "Começo do arquivo:\n" +
        head,
    );
  }

  const grammarBlock = mBlock[1];
  const lines = grammarBlock.split(/\r?\n/);

  const rulesById = {};
  let currentLhs = null;
  let maxId = -1;

  for (let line of lines) {
    line = line.replace(/\t/g, " ");
    const t = line.trim();
    if (!t) continue;

    // Regra principal: "0 $accept: programa $end"
    //                 "1 programa: PHP_OPEN corpo PHP_CLOSE"
    // aceita lhs com '$'
    let m = t.match(/^(\d+)\s+([$\w][\w$]*)\s*:\s*(.*)$/);
    if (m) {
      const ruleId = Number(m[1]);
      currentLhs = m[2];
      maxId = Math.max(maxId, ruleId);

      const rhsRaw = m[3].trim();
      const rhsSyms =
        rhsRaw === "ε" || rhsRaw === "" ? [] : rhsRaw.split(/\s+/);

      rulesById[ruleId] = {
        lhs: currentLhs,
        rhs: rhsSyms,
        rhsLen: rhsSyms.length,
      };
      continue;
    }

    m = t.match(/^(\d+)\s+\|\s*(.*)$/);
    if (m && currentLhs) {
      const ruleId = Number(m[1]);
      maxId = Math.max(maxId, ruleId);

      const rhsRaw = m[2].trim();
      const rhsSyms =
        rhsRaw === "ε" || rhsRaw === "" ? [] : rhsRaw.split(/\s+/);

      rulesById[ruleId] = {
        lhs: currentLhs,
        rhs: rhsSyms,
        rhsLen: rhsSyms.length,
      };
      continue;
    }
  }

  if (maxId < 0) {
    throw new Error(
      "Não consegui extrair nenhuma regra do grammar.output (maxId < 0).\n" +
        "Causa mais comum: regex não casou por causa de espaços/CRLF.\n" +
        "Verifique se as linhas das regras parecem com '    0 ...' (com espaços antes).",
    );
  }

  // Array no mesmo índice do Bison
  const rules = new Array(maxId + 1);
  for (let i = 0; i <= maxId; i++) {
    const r = rulesById[i];
    if (!r) throw new Error(`Regra ${i} não foi encontrada no bloco Grammar.`);
    rules[i] = r;
  }

  return rules;
}

function parseStates(text) {
  // varrer "State N" e capturar:
  // - shifts: "TOKEN shift, and go to state X"
  // - reduces: "TOKEN reduce using rule Y (lhs)"
  // - accept: "$end accept"
  // - gotos (nonterm): "corpo go to state X" (ou "corpo  go to state X")
  const lines = text.split(/\r?\n/);

  const action = {};
  const goTo = {};

  let state = null;

  function ensureState(obj, s) {
    if (!obj[s]) obj[s] = {};
  }

  for (let rawLine of lines) {
    const line = rawLine.replace(/\t/g, " ");

    // State header
    let m = line.match(/^State\s+(\d+)/);
    if (m) {
      state = m[1];
      ensureState(action, state);
      ensureState(goTo, state);
      continue;
    }
    if (state === null) continue;

    // Accept
    // Ex: "$end accept"
    m = line.match(/^\s*\$end\s+accept\b/);
    if (m) {
      action[state][mapTokenName("$end")] = { type: "accept" };
      continue;
    }

    // $default reduce
    // Ex: "    $default  reduce using rule 3 (lista_dc)"
    m = line.match(/^\s*\$default\s+reduce\s+using\s+rule\s+(\d+)\b/);
    if (m) {
      const rule = Number(m[1]);
      action[state]["$default"] = { type: "reduce", rule };
      continue;
    }

    // $default accept
    m = line.match(/^\s*\$default\s+accept\b/);
    if (m) {
      action[state]["$default"] = { type: "accept" };
      continue;
    }

    // Shift
    // Ex: "PHP_OPEN  shift, and go to state 1"
    m = line.match(
      /^\s*([A-Z_][A-Z0-9_]*|\$end)\s+shift,\s+and\s+go\s+to\s+state\s+(\d+)\b/,
    );
    if (m) {
      const tok = mapTokenName(m[1]);
      const to = Number(m[2]);
      action[state][tok] = { type: "shift", to };
      continue;
    }

    // Reduce
    // Ex: "SEMI  reduce using rule 9 (atribuicao_opcional)"
    m = line.match(
      /^\s*([A-Z_][A-Z0-9_]*|\$end)\s+reduce\s+using\s+rule\s+(\d+)\b/,
    );
    if (m) {
      const tok = mapTokenName(m[1]);
      const rule = Number(m[2]);
      action[state][tok] = { type: "reduce", rule };
      continue;
    }

    // GOTO para não-terminal
    // Ex: "corpo  go to state 2"
    m = line.match(/^\s*([$\w][\w$]*)\s+go\s+to\s+state\s+(\d+)\b/);
    if (m) {
      const sym = m[1];
      const to = Number(m[2]);

      // Só trata como goto se for não-terminal
      if (!isTerminalName(sym)) {
        goTo[state][sym] = to;
      }
      continue;
    }
  }

  return { action, goTo };
}

function main() {
  const inFile = process.argv[2];
  const outFile = process.argv[3] || "lr_table.json";

  if (!inFile) {
    console.error(
      "Uso: node tools/bison_output_to_json.js grammar/grammar.output outputs/lr_table.json",
    );
    process.exit(1);
  }

  const outText = fs.readFileSync(inFile, "utf8"); // grammar.output

  // regras vêm do próprio grammar.output
  const rules = parseRules(outText);

  // ACTION/GOTO vêm dos "State N" do grammar.output
  const { action, goTo } = parseStates(outText);

  const out = { rules, action, goto: goTo };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");
  console.log(`OK: gerado ${outFile}`);
}

main();
