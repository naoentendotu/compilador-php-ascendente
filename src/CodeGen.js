class CodeGen {
  constructor() {
    this.code = [];
    this.labels = new Map(); // label -> addr
    this.fixups = []; // { at, label }
    this.funcAddrs = new Map(); // funcName -> addr
    this.funcFixups = []; // { at, name }

    // Globais
    this.global = new Map(); // var -> addr
    this.globalNext = 0;

    // Estado de função
    this.local = null;
    this.localNext = 0;
    this.funcAllocCountStack = []; // conta quantos ALME dentro da função (params+locals)
  }

  emit(op, arg = null, comment = null) {
    const line = arg === null ? op : `${op} ${arg}`;
    this.code.push(comment ? `${line} #${comment}` : line);
    return this.code.length - 1;
  }

  markLabel(name) {
    this.labels.set(name, this.code.length);
  }

  emitJump(op, label, comment = null) {
    const at = this.emit(op, 0, comment);
    this.fixups.push({ at, label });
  }

  patchLabels() {
    for (const f of this.fixups) {
      const addr = this.labels.get(f.label);
      if (addr === undefined) throw new Error(`Label não definida: ${f.label}`);
      this.code[f.at] = this.code[f.at].replace(/\b0\b/, String(addr));
    }
  }

  patchCalls() {
    for (const f of this.funcFixups) {
      const addr = this.funcAddrs.get(f.name);
      if (addr === undefined) throw new Error(`Função não definida: ${f.name}`);
      this.code[f.at] = this.code[f.at].replace(/\b0\b/, String(addr));
    }
  }

  // ALOCAÇÃO
  allocGlobal(name) {
    if (this.global.has(name)) return this.global.get(name);
    const addr = this.globalNext++;
    this.global.set(name, addr);
    this.emit("ALME", 1);
    return addr;
  }

  allocLocal(name) {
    if (!this.local) throw new Error("allocLocal fora de função");
    if (this.local.has(name)) return this.local.get(name);

    const addr = this.localNext++;
    this.local.set(name, addr);

    this.emit("ALME", 1);
    this.funcAllocCountStack[this.funcAllocCountStack.length - 1] += 1;

    return addr;
  }

  addr(name) {
    if (this.local && this.local.has(name)) return this.local.get(name);
    if (this.global.has(name)) return this.global.get(name);
    throw new Error(`Variável não declarada: ${name}`);
  }

  // EXPRESSÕES
  genExpr(e) {
    switch (e.kind) {
      case "Num":
        this.emit("CRCT", String(e.value));
        return;

      case "Var":
        this.emit("CRVL", this.addr(e.name));
        return;

      case "ReadFloat":
        this.emit("LEIT");
        return;

      case "Un":
        if (e.op === "-") {
          this.emit("CRCT", "0");
          this.genExpr(e.expr);
          this.emit("SUBT");
          return;
        }
        throw new Error(`Unário não suportado: ${e.op}`);

      case "Bin":
        this.genExpr(e.left);
        this.genExpr(e.right);
        if (e.op === "+") this.emit("SOMA");
        else if (e.op === "-") this.emit("SUBT");
        else if (e.op === "*") this.emit("MULT");
        else if (e.op === "/") this.emit("DIVI");
        else throw new Error(`Operador aritmético desconhecido: ${e.op}`);
        return;

      case "Rel":
        this.genExpr(e.left);
        this.genExpr(e.right);
        if (e.op === "<=") this.emit("CPMI");
        else if (e.op === ">=") this.emit("CMAI");
        else if (e.op === "==") this.emit("CPIG");
        else if (e.op === "!=") this.emit("CDES");
        else if (e.op === ">") this.emit("CMMA");
        else if (e.op === "<") this.emit("CMME");
        else throw new Error(`Relacional não suportado: ${e.op}`);
        return;

      default:
        throw new Error(`Expr não suportada: ${e.kind}`);
    }
  }

  // STATEMENTS
  genStmt(s) {
    switch (s.kind) {
      case "VarDecl": {
        const inFunc = !!this.local;

        if (!inFunc) {
          this.allocGlobal(s.name);
          return;
        }

        // LOCAL: se já existe no escopo local => vira atribuição
        const exists = this.local.has(s.name);
        const a = exists ? this.local.get(s.name) : this.allocLocal(s.name);

        if (s.initExpr) {
          const isZeroNum =
            s.initExpr.kind === "Num" && Number(s.initExpr.value) === 0;

          if (!isZeroNum) {
            this.genExpr(s.initExpr);
            this.emit("ARMZ", a);
          }
        }
        return;
      }

      case "Assign": {
        const a = this.addr(s.name);
        this.genExpr(s.expr);
        this.emit("ARMZ", a);
        return;
      }

      case "EchoVar":
        this.emit("CRVL", this.addr(s.name));
        this.emit("IMPR");
        return;

      case "If": {
        this.genExpr(s.cond);
        const elseLbl = `L_else_${this.code.length}`;
        const endLbl = `L_end_${this.code.length}`;
        this.emitJump("DSVF", elseLbl);
        this.genBlock(s.thenBlk);
        this.emitJump("DSVI", endLbl);
        this.markLabel(elseLbl);
        if (s.elseBlk) this.genBlock(s.elseBlk);
        this.markLabel(endLbl);
        return;
      }

      case "While": {
        const startLbl = `L_w_${this.code.length}`;
        const endLbl = `L_wend_${this.code.length}`;
        this.markLabel(startLbl);
        this.genExpr(s.cond);
        this.emitJump("DSVF", endLbl);
        this.genBlock(s.body);
        this.emitJump("DSVI", startLbl);
        this.markLabel(endLbl);
        return;
      }

      case "Call": {
        const retLabel = `L_ret_${this.code.length}`;
        this.emitJump("PUSHER", retLabel);

        for (const a of s.args || []) {
          if (a.kind !== "Var") throw new Error("PARAM exige variável");
          this.emit("PARAM", this.addr(a.name));
        }

        const fnAddr = this.funcAddrs.get(s.name);
        if (fnAddr === undefined) {
          const at = this.emit("CHPR", 0);
          this.funcFixups.push({ at, name: s.name });
        } else {
          this.emit("CHPR", fnAddr);
        }

        this.markLabel(retLabel);
        return;
      }

      case "FuncDecl": {
        // endereço da função
        this.funcAddrs.set(s.name, this.code.length);

        // ativa “escopo local” da função:
        // endereços locais começam depois dos globais => reuso de endereços globais para locais
        this.local = new Map();
        this.localNext = this.globalNext;

        // conta ALMEs dentro da função (params + locals)
        this.funcAllocCountStack.push(0);

        // parâmetros primeiro (ALME)
        for (const p of s.params || []) this.allocLocal(p);

        // corpo
        this.genBlock(s.body);

        // desaloca tudo que foi ALME dentro da função
        const n = this.funcAllocCountStack.pop();
        if (n > 0) this.emit("DESM", n);

        this.emit("RTPR");

        // encerra função
        this.local = null;
        return;
      }

      default:
        throw new Error(`Stmt não suportado: ${s.kind}`);
    }
  }

  genBlock(block) {
    if (!block) return;
    if (block.kind === "Seq") {
      for (const it of block.items || []) this.genStmt(it);
    } else {
      this.genStmt(block);
    }
  }

  // PROGRAMA
  genProgram(ast) {
    if (!ast || ast.kind !== "Program") throw new Error("Esperado Program");
    const body = ast.body;
    if (!body || body.kind !== "Body") throw new Error("Esperado Body");

    this.emit("INPP");

    // globais
    for (const d of body.decls || []) this.genStmt(d);

    // 2) pula direto pro main
    const lblMain = "L_main";
    if ((body.funcs || []).length > 0) {
      this.emitJump("DSVI", lblMain, `funcao ${body.funcs[0].name}`);
    } else {
      this.emitJump("DSVI", lblMain, "pula funcoes");
    }

    // funções (e entre elas coloca um DSVI pro main com comentário do “próximo”)
    const funcs = body.funcs || [];
    for (let i = 0; i < funcs.length; i++) {
      this.genStmt(funcs[i]);
      if (i + 1 < funcs.length) {
        this.emitJump("DSVI", lblMain, `funcao ${funcs[i + 1].name}`);
      }
    }

    // main
    this.markLabel(lblMain);
    this.genBlock(body.main);

    this.emit("PARA");
  }

  finalize() {
    this.patchCalls();
    this.patchLabels();
    return this.code.join("\n") + "\n";
  }
}

module.exports = { CodeGen };
