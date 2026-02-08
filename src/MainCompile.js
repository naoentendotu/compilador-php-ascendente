const fs = require("fs");
const path = require("path");

const { lexer, normalizeToken } = require("./Lexer");
const { loadLRTable, parseLR } = require("./ParserLR");
const { createASTHooks } = require("./ASTBuilder");
const { analyze } = require("./Semantic");
const { CodeGen } = require("./CodeGen");

const inputPath = process.argv[2];
if (!inputPath) {
  console.log("Uso: node src/MainCompile.js inputs/correto.php.txt");
  process.exit(1);
}

const code = fs.readFileSync(inputPath, "utf8");

// LÉXICO
const rawTokens = lexer(code);
const tokens = rawTokens.map(normalizeToken);

// TABELA LR
const table = loadLRTable(
  path.join(__dirname, "..", "outputs", "lr_table.json"),
);

// HOOKS AST
const { hooks, getAST } = createASTHooks();

// SINTÁTICO + AST
parseLR(tokens, table, hooks);

// PEGA AST
const ast = getAST();
if (!ast) {
  throw new Error("AST não foi gerada (astRoot está null).");
}

// SEMANTICO
try {
  analyze(ast);
} catch (err) {
  console.error(String(err.message || err));
  process.exit(1);
}

// GERA CÓDIGO OBJ
const gen = new CodeGen();
console.dir(ast, { depth: null });
console.log("AST.kind =", ast?.kind);

gen.genProgram(ast);
const obj = gen.finalize();

// SALVA EM outputs/codigo.obj.txt
const outPath = path.join(__dirname, "..", "outputs", "codigo.obj.txt");
fs.writeFileSync(outPath, obj, "utf8");

console.log("OK: gerado", outPath);
