const AST = require("./AST");

function varNameFromToken(tok) {
  if (!tok || !tok.value) return null;
  return tok.value.startsWith("$") ? tok.value.slice(1) : tok.value;
}
function identFromToken(tok) {
  return tok?.value ?? null;
}
function toArray(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  return [x];
}
function makeSeq(items) {
  const flat = [];
  for (const it of items) {
    if (!it) continue;
    if (it.kind === "Seq") flat.push(...it.items);
    else flat.push(it);
  }
  return AST.Seq(flat);
}
function relOpFromToken(tok) {
  switch (tok.type) {
    case "EQ":
      return "==";
    case "NE":
      return "!=";
    case "GE":
      return ">=";
    case "LE":
      return "<=";
    case "GT":
      return ">";
    case "LT":
      return "<";
    default:
      return tok.value ?? tok.type;
  }
}
function opFromToken(tok) {
  if (!tok) return null;
  if (tok.type === "PLUS") return "+";
  if (tok.type === "MINUS") return "-";
  if (tok.type === "STAR") return "*";
  if (tok.type === "SLASH") return "/";
  return tok.value;
}

class ASTBuilder {
  constructor() {
    this.ast = null;
  }

  onReduce(ruleId, rule, rhs) {
    const lhs = rule.lhs;
    const rhsSig = rule.rhs.join(" ");

    // programa
    if (lhs === "programa" && rhsSig === "PHP_OPEN corpo PHP_CLOSE") {
      return AST.Program(rhs[1]);
    }

    // corpo -> lista_dc lista_comandos
    if (lhs === "corpo" && rhsSig === "lista_dc lista_comandos") {
      const decls = toArray(rhs[0]);
      const funcs = decls.filter((d) => d?.kind === "FuncDecl");
      const vars = decls.filter((d) => d?.kind === "VarDecl");
      return { kind: "Body", decls: vars, funcs, main: rhs[1] || AST.Seq([]) };
    }

    // lista_dc
    if (lhs === "lista_dc" && rhsSig === "") return [];
    if (lhs === "lista_dc" && rhsSig === "lista_dc declaracao") {
      const arr = toArray(rhs[0]);
      arr.push(rhs[1]);
      return arr;
    }

    if (lhs === "declaracao" && rhsSig === "dc_v") return rhs[0];
    if (lhs === "declaracao" && rhsSig === "dc_f") return rhs[0];

    // dc_v (declaracao)  -> $x = expressao; | $x;
    if (lhs === "dc_v" && rhsSig === "DOLLAR_IDENT ASSIGN expressao SEMI") {
      const name = varNameFromToken(rhs[0]);
      const initExpr = rhs[2]; // expressao
      return AST.VarDecl(name, initExpr);
    }
    if (lhs === "dc_v" && rhsSig === "DOLLAR_IDENT SEMI") {
      const name = varNameFromToken(rhs[0]);
      return AST.VarDecl(name, null);
    }

    // parametros
    if (lhs === "parametros" && rhsSig === "LPAREN RPAREN") return [];
    if (lhs === "parametros" && rhsSig === "LPAREN lista_par RPAREN")
      return rhs[1];

    if (lhs === "lista_par" && rhsSig === "DOLLAR_IDENT mais_par") {
      const first = varNameFromToken(rhs[0]);
      return [first, ...toArray(rhs[1])];
    }
    if (lhs === "mais_par" && rhsSig === "COMMA DOLLAR_IDENT mais_par") {
      const v = varNameFromToken(rhs[1]);
      return [v, ...toArray(rhs[2])];
    }
    if (lhs === "mais_par" && rhsSig === "") return [];

    // lista_dcloc
    if (lhs === "lista_dcloc" && rhsSig === "") return [];
    if (lhs === "lista_dcloc" && rhsSig === "lista_dcloc dc_v") {
      const arr = toArray(rhs[0]);
      arr.push(rhs[1]); // VarDecl
      return arr;
    }

    // corpo_f -> lista_dcloc lista_comandos
    if (lhs === "corpo_f" && rhsSig === "lista_dcloc lista_comandos") {
      const locals = toArray(rhs[0]);
      const cmds = rhs[1] || AST.Seq([]);
      return makeSeq([...locals, cmds]);
    }

    // dc_f -> function IDENT parametros { corpo_f }
    if (
      lhs === "dc_f" &&
      rhsSig === "FUNCTION IDENT parametros LBRACE corpo_f RBRACE"
    ) {
      const fname = identFromToken(rhs[1]);
      const params = toArray(rhs[2]);
      const body = rhs[4] || AST.Seq([]);
      return AST.FuncDecl(fname, params, body);
    }

    // lista_comandos
    if (lhs === "lista_comandos" && rhsSig === "") return AST.Seq([]);
    if (lhs === "lista_comandos" && rhsSig === "lista_comandos comando") {
      return makeSeq([rhs[0], rhs[1]]);
    }

    // pfalsa
    if (lhs === "pfalsa" && rhsSig === "") return null;
    if (lhs === "pfalsa" && rhsSig === "ELSE LBRACE lista_comandos RBRACE") {
      return rhs[2] || AST.Seq([]);
    }

    // comandos
    if (lhs === "comando" && rhsSig === "DOLLAR_IDENT ASSIGN expressao SEMI") {
      const name = varNameFromToken(rhs[0]);
      return AST.Assign(name, rhs[2]);
    }
    if (lhs === "comando" && rhsSig === "ECHO DOLLAR_IDENT DOT PHP_EOL SEMI") {
      const v = varNameFromToken(rhs[1]);
      return AST.EchoVar(v);
    }
    if (
      lhs === "comando" &&
      rhsSig === "IF LPAREN condicao RPAREN LBRACE lista_comandos RBRACE pfalsa"
    ) {
      return AST.If(rhs[2], rhs[5] || AST.Seq([]), rhs[7] || null);
    }
    if (
      lhs === "comando" &&
      rhsSig === "WHILE LPAREN condicao RPAREN LBRACE lista_comandos RBRACE"
    ) {
      return AST.While(rhs[2], rhs[5] || AST.Seq([]));
    }

    // chamada no main: IDENT lista_arg SEMI
    if (lhs === "comando" && rhsSig === "IDENT lista_arg SEMI") {
      const fnName = identFromToken(rhs[0]);
      const args = toArray(rhs[1]);
      return AST.Call(fnName, args);
    }

    // lista_arg / argumentos
    if (lhs === "lista_arg" && rhsSig === "LPAREN RPAREN") return [];
    if (lhs === "lista_arg" && rhsSig === "LPAREN argumentos RPAREN")
      return rhs[1];
    if (lhs === "argumentos" && rhsSig === "expressao mais_ident") {
      return [rhs[0], ...toArray(rhs[1])];
    }
    if (lhs === "mais_ident" && rhsSig === "") return [];
    if (lhs === "mais_ident" && rhsSig === "COMMA expressao mais_ident") {
      return [rhs[1], ...toArray(rhs[2])];
    }

    // condicao / relacao
    if (lhs === "relacao" && rule.rhs.length === 1)
      return relOpFromToken(rhs[0]);
    if (lhs === "condicao" && rhsSig === "expressao relacao expressao") {
      return AST.Rel(rhs[1], rhs[0], rhs[2]);
    }

    // expressões
    if (lhs === "op_un" && rhsSig === "") return null;
    if (lhs === "op_un" && rhsSig === "MINUS") return "-";

    if (lhs === "fator" && rhsSig === "DOLLAR_IDENT")
      return AST.Var(varNameFromToken(rhs[0]));
    if (lhs === "fator" && rhsSig === "NUM_REAL") return AST.Num(rhs[0].value);
    if (lhs === "fator" && rhsSig === "LPAREN expressao RPAREN") return rhs[1];
    if (
      lhs === "fator" &&
      rhsSig === "FLOATVAL LPAREN READLINE LPAREN RPAREN RPAREN"
    )
      return AST.ReadFloat();

    if (lhs === "op_mul" && rule.rhs.length === 1) return opFromToken(rhs[0]);
    if (lhs === "mais_fatores" && rhsSig === "") return [];
    if (lhs === "mais_fatores" && rhsSig === "op_mul fator mais_fatores") {
      return [{ op: rhs[0], right: rhs[1] }, ...toArray(rhs[2])];
    }

    if (lhs === "op_ad" && rule.rhs.length === 1) return opFromToken(rhs[0]);
    if (lhs === "outros_termos" && rhsSig === "") return [];
    if (lhs === "outros_termos" && rhsSig === "op_ad termo outros_termos") {
      return [{ op: rhs[0], right: rhs[1] }, ...toArray(rhs[2])];
    }

    if (lhs === "termo" && rhsSig === "op_un fator mais_fatores") {
      let node = rhs[1];
      for (const m of toArray(rhs[2])) node = AST.Bin(m.op, node, m.right);
      if (rhs[0] === "-") node = AST.Un("-", node);
      return node;
    }

    if (lhs === "expressao" && rhsSig === "termo outros_termos") {
      let node = rhs[0];
      for (const a of toArray(rhs[1])) node = AST.Bin(a.op, node, a.right);
      return node;
    }

    return { kind: lhs, rhs };
  }

  onAccept(finalSymbol) {
    this.ast = finalSymbol;
  }
}

function createASTHooks() {
  const b = new ASTBuilder();
  return {
    hooks: {
      onReduce: (ruleId, rule, rhs) => b.onReduce(ruleId, rule, rhs),
      onAccept: (finalSymbol) => b.onAccept(finalSymbol),
    },
    getAST: () => b.ast,
  };
}

module.exports = { createASTHooks };
