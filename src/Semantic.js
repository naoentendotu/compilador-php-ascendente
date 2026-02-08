class SemanticAnalyzer {
  constructor() {
    this.errors = [];
    this.funcs = new Map(); // funcName -> { paramsCount }
    this.scopeStack = []; // stack de Map
  }

  error(msg) {
    this.errors.push(msg);
  }

  pushScope() {
    this.scopeStack.push(new Map());
  }

  popScope() {
    this.scopeStack.pop();
  }

  currentScope() {
    if (this.scopeStack.length === 0) {
      this.pushScope();
    }
    return this.scopeStack[this.scopeStack.length - 1];
  }

  isVarDeclared(name) {
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      if (this.scopeStack[i].has(name)) return true;
    }
    return false;
  }

  declareVar(name, context) {
    const scope = this.currentScope();

    if (scope.has(name)) return;

    scope.set(name, true);
  }

  declareFunc(name, paramsCount) {
    if (this.funcs.has(name)) {
      this.error(`Funcao '${name}' ja declarada.`);
      return;
    }
    this.funcs.set(name, { paramsCount });
  }

  checkFuncCall(name, argsCount) {
    const f = this.funcs.get(name);
    if (!f) {
      this.error(`Funcao '${name}' nao declarada.`);
      return;
    }
    if (argsCount !== f.paramsCount) {
      this.error(
        `Chamada de '${name}' com ${argsCount} argumento(s), mas espera ${f.paramsCount}.`,
      );
    }
  }

  analyze(ast) {
    this.visitProgram(ast);
    return this.errors;
  }

  visitProgram(ast) {
    if (!ast || ast.kind !== "Program") {
      this.error("AST invalida: esperado nodo Program.");
      return;
    }

    const body = ast.body;
    if (!body || body.kind !== "Body") {
      this.error("AST invalida: Program.body deve ser Body.");
      return;
    }

    // escopo global
    this.pushScope();

    // declara variaveis globais
    for (const d of body.decls || []) {
      if (d && d.kind === "VarDecl") {
        this.visitVarDecl(d, "global");
      } else if (d) {
        this.error(`Declaracao global inesperada: ${d.kind}.`);
      }
    }

    // registra funcoes (permite chamadas adiantadas)
    for (const f of body.funcs || []) {
      if (f && f.kind === "FuncDecl") {
        const paramsCount = (f.params || []).length;
        this.declareFunc(f.name, paramsCount);
      } else if (f) {
        this.error(`Declaracao de funcao invalida: ${f.kind}.`);
      }
    }

    //  analisa corpos das funcoes
    for (const f of body.funcs || []) {
      if (f && f.kind === "FuncDecl") {
        this.visitFuncDecl(f);
      }
    }

    //  analisa corpo principal
    this.visitBlock(body.main);

    this.popScope();
  }

  visitFuncDecl(fn) {
    // novo escopo para params + locais
    this.pushScope();

    // params
    for (const p of fn.params || []) {
      this.declareVar(p, `parametro de '${fn.name}'`);
    }

    // corpo
    this.visitBlock(fn.body);

    this.popScope();
  }

  visitBlock(block) {
    if (!block) return;
    if (block.kind === "Seq") {
      for (const it of block.items || []) this.visitStmt(it);
    } else {
      this.visitStmt(block);
    }
  }

  visitStmt(s) {
    if (!s || !s.kind) return;
    switch (s.kind) {
      case "VarDecl":
        this.visitVarDecl(s, "local");
        return;
      case "Assign":
        if (!this.isVarDeclared(s.name)) {
          this.error(`Variavel '${s.name}' nao declarada (atribuicao).`);
        }
        this.visitExpr(s.expr);
        return;
      case "EchoVar":
        if (!this.isVarDeclared(s.name)) {
          this.error(`Variavel '${s.name}' nao declarada (echo).`);
        }
        return;
      case "If":
        this.visitExpr(s.cond);
        this.visitBlock(s.thenBlk);
        if (s.elseBlk) this.visitBlock(s.elseBlk);
        return;
      case "While":
        this.visitExpr(s.cond);
        this.visitBlock(s.body);
        return;
      case "Call": {
        const args = s.args || [];
        this.checkFuncCall(s.name, args.length);
        for (const a of args) {
          if (!a || a.kind !== "Var") {
            this.error(
              `Chamada de '${s.name}' exige argumentos variaveis (use $var).`,
            );
          } else if (!this.isVarDeclared(a.name)) {
            this.error(
              `Variavel '${a.name}' nao declarada (argumento de '${s.name}').`,
            );
          }
          this.visitExpr(a);
        }
        return;
      }
      case "FuncDecl":
        this.error("Funcao declarada em local invalido.");
        return;
      default:
        this.error(`Stmt nao suportado: ${s.kind}.`);
        return;
    }
  }

  visitVarDecl(d, scopeLabel) {
    if (!d || d.kind !== "VarDecl") return;
    this.declareVar(d.name, scopeLabel);
    if (d.initExpr) this.visitExpr(d.initExpr);
  }

  visitExpr(e) {
    if (!e || !e.kind) return;
    switch (e.kind) {
      case "Num":
      case "ReadFloat":
        return;
      case "Var":
        if (!this.isVarDeclared(e.name)) {
          this.error(`Variavel '${e.name}' nao declarada (uso em expressao).`);
        }
        return;
      case "Un":
        this.visitExpr(e.expr);
        return;
      case "Bin":
        this.visitExpr(e.left);
        this.visitExpr(e.right);
        return;
      case "Rel":
        this.visitExpr(e.left);
        this.visitExpr(e.right);
        return;
      default:
        this.error(`Expr nao suportada: ${e.kind}.`);
        return;
    }
  }
}

function analyze(ast, options = {}) {
  const sem = new SemanticAnalyzer();
  const errors = sem.analyze(ast);
  if (errors.length && options.throwOnError !== false) {
    const msg = errors.map((e) => `- ${e}`).join("\n");
    const err = new Error(`Erros semanticos:\n${msg}`);
    err.errors = errors;
    throw err;
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { SemanticAnalyzer, analyze };
