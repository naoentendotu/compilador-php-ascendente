const fs = require("fs");
const path = require("path");

const { lexer, normalizeToken } = require("./Lexer");
const { loadLRTable, parseLR } = require("./ParserLR");
const { createASTHooks } = require("./ASTBuilder");

const inputPath = process.argv[2];
if (!inputPath) {
  console.log("Uso: node src/MainCompile.js inputs/correto.php.txt");
  process.exit(1);
}

const code = fs.readFileSync(inputPath, "utf8");

// LEXÍCO
const rawTokens = lexer(code);
const tokens = rawTokens.map(normalizeToken);

console.log(tokens.slice(0, 15));

// CARREGA TABELA LR
const table = loadLRTable(
  path.join(__dirname, "..", "outputs", "lr_table.json"),
);

// HOOKS AST
const { hooks, getAST } = createASTHooks();

// SINTÁTICO + AST
parseLR(tokens, table, hooks);

// IMPRIME AST
const ast = getAST();
console.dir(ast, { depth: null });
console.log("\n AST foi gerada com sucesso!");
