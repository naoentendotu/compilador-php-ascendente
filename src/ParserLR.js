const fs = require("fs");

/**
 * Monta uma string amigável para mensagens de erro
 */
function tokenLabel(tok) {
  return `${tok.type}${tok.value ? `('${tok.value}')` : ""} @${tok.line}:${tok.col}`;
}

/**
 * Carrega a tabela LR (rules, action, goto) gerada a partir do grammar.output
 */
function loadLRTable(pathToJson) {
  const table = JSON.parse(fs.readFileSync(pathToJson, "utf8"));
  if (!table.rules || !table.action || !table.goto) {
    throw new Error(
      "lr_table.json inválido: precisa conter { rules, action, goto }",
    );
  }
  return table;
}

/**
 * Parser LR genérico (ascendente)
 *
 * tokens: lista de tokens NORMALIZADOS (PHP_OPEN, DOLLAR_IDENT, etc.)
 * table:  tabela LR { rules, action, goto }
 * hooks:  callbacks opcionais para integrar semântico e geração de código
 *   - onShift(token, fromState, toState)
 *   - onReduce(ruleId, rule, rhsSymbols)
 *   - onAccept(finalSymbol)
 */
function parseLR(tokens, table, hooks = {}) {
  // hooks (caso não sejam passados, usam funções vazias)
  const onReduce = hooks.onReduce || (() => null);
  const onShift = hooks.onShift || (() => {});
  const onAccept = hooks.onAccept || (() => {});

  const { rules, action, goto } = table;

  // Pilha de estados (LR)
  const stateStack = [0];

  // Pilha de símbolos (tokens e não-terminais reduzidos)
  const symStack = [];

  // índice do token atual (lookahead)
  let i = 0;

  while (true) {
    // estado atual é o topo da pilha
    const state = stateStack[stateStack.length - 1];

    // token atual (lookahead)
    const lookahead = tokens[i] || {
      type: "EOF",
      value: "",
      line: -1,
      col: -1,
    };

    // linha da tabela ACTION para o estado atual
    const actRow = action[String(state)] || action[state];

    // ação correspondente ao token de entrada
    let act = actRow ? actRow[lookahead.type] : null;

    // se não tiver ação para o token, tenta $default (do Bison)
    if (!act && actRow && actRow["$default"]) {
      act = actRow["$default"];
    }

    // Caso não exista ação definida → erro sintático
    if (!act) {
      const expected = actRow ? Object.keys(actRow) : [];
      const expectedMsg = expected.length
        ? expected.slice(0, 20).join(", ")
        : "(nenhum)";

      throw new Error(
        `Erro sintático no estado ${state} com token ${tokenLabel(lookahead)}.\n` +
          `Esperava um de: ${expectedMsg}`,
      );
    }

    /**
     * AÇÃO: SHIFT
     * - Empilha o token
     * - Empilha o novo estado
     * - Avança o lookahead
     */
    if (act.type === "shift") {
      symStack.push(lookahead);
      stateStack.push(act.to);

      // hook opcional (útil para debug ou geração incremental)
      onShift(lookahead, state, act.to);

      i++;
      continue;
    }

    /**
     * AÇÃO: REDUCE
     * - Remove |RHS| símbolos/estados
     * - Consulta GOTO
     * - Empilha o LHS
     */
    if (act.type === "reduce") {
      const rule = rules[act.rule];
      if (!rule) {
        throw new Error(`Reduce com regra inexistente: ${act.rule}`);
      }

      const popN = rule.rhsLen;
      const popped = [];

      // remove símbolos do RHS (em ordem correta)
      for (let k = 0; k < popN; k++) {
        popped.unshift(symStack.pop());
        stateStack.pop();
      }

      // estado após o pop
      const state2 = stateStack[stateStack.length - 1];

      // consulta GOTO
      const gotoRow = goto[String(state2)] || goto[state2];
      const nextState = gotoRow ? gotoRow[rule.lhs] : undefined;

      if (nextState === undefined) {
        throw new Error(
          `Erro interno: goto indefinido.\n` +
            `Depois de reduzir pela regra ${act.rule}: ${rule.lhs} -> ${rule.rhs.join(" ") || "ε"}\n` +
            `No estado ${state2} não existe goto para '${rule.lhs}'.`,
        );
      }

      /**
       * Hook de REDUCE
       *  - análise semântica
       *  - geração de código
       *  - construção de AST
       */
      const produced = onReduce(act.rule, rule, popped) || {
        type: rule.lhs,
        value: null,
      };

      // empilha o símbolo reduzido
      symStack.push(produced);
      stateStack.push(nextState);
      continue;
    }

    /**
     * AÇÃO: ACCEPT
     * Programa reconhecido com sucesso
     */
    if (act.type === "accept") {
      const top = symStack[symStack.length - 1];
      const finalSymbol =
        top && top.type === "EOF" ? symStack[symStack.length - 2] : top;

      onAccept(finalSymbol);
      return { ok: true };
    }

    throw new Error(`Ação desconhecida na tabela: ${JSON.stringify(act)}`);
  }
}

module.exports = { loadLRTable, parseLR };
