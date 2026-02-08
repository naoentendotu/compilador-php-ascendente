// definições de palavras reservadas, smbolos, identificadores, números e comentarios
const mapaTokens = [
  { type: "COMECO", regex: /^<\?php\b/ },
  { type: "FIM", regex: /^\?>/ },
  { type: "COMENTARIO", regex: /^\/\/[^\n]*|^\/\*[\s\S]*?\*\// },
  {
    type: "PALAVRA_RESERVADA",
    regex: /^(function|if|else|while|echo|floatval|readline|PHP_EOL)\b/,
  },
  { type: "VAR", regex: /^\$[a-zA-Z_]\w*/ },
  { type: "IDENT", regex: /^[a-zA-Z_]\w*/ },
  { type: "NUM", regex: /^\d+(\.\d+)?\b/ },
  { type: "OPER_RELACIONAL", regex: /^(==|!=|>=|<=|>|<)/ },
  { type: "OPER_ARITMETICO", regex: /^(\+|-|\*|\/)/ },
  { type: "ATRIBUICAO", regex: /^=/ },
  { type: "DELIMITADOR", regex: /^(\(|\)|\{|\}|,|;|\.)/ },
  { type: "ESPACO", regex: /^\s+/ },
];

// analisador léxico que processa a entrada e retorna uma lista de tokens
function lexer(input) {
  let tokens = [];
  let position = 0;
  let line = 1;
  let col = 1;

  while (position < input.length) {
    let match = null;
    let remainingInput = input.slice(position);

    for (const { type, regex } of mapaTokens) {
      match = remainingInput.match(regex);

      if (match) {
        const value = match[0];

        // guarda posicao inicial do token
        const startLine = line;
        const startCol = col;

        // atualiza a linha e a coluna para rastrear os erros
        const lines = value.split("\n");

        if (lines.length > 1) {
          line += lines.length - 1;
          col = lines[lines.length - 1].length + 1;
        } else {
          col += value.length;
        }

        // aq identifica os espaços e comentários e ignora os espaços e comentários
        if (type !== "ESPACO" && type !== "COMENTARIO") {
          tokens.push({
            type,
            value,
            line: startLine,
            col: startCol,
          });
        }

        position += value.length;
        break;
      }
    }

    if (!match) {
      throw new Error(
        `Foi encontrado um erro léxico em ${line}:${col}: '${remainingInput[0]}'`,
      );
    }
  }

  tokens.push({ type: "EOF", value: "", line, col });

  return tokens;
}

const keywordMap = {
  function: "FUNCTION",
  if: "IF",
  else: "ELSE",
  while: "WHILE",
  echo: "ECHO",
  floatval: "FLOATVAL",
  readline: "READLINE",
  PHP_EOL: "PHP_EOL",
};

function normalizeToken(token) {
  if (token.type === "COMECO") return { ...token, type: "PHP_OPEN" };

  if (token.type === "FIM") return { ...token, type: "PHP_CLOSE" };

  if (token.type === "PALAVRA_RESERVADA") {
    return { ...token, type: keywordMap[token.value] || token.type };
  }

  if (token.type === "DELIMITADOR") {
    const m = {
      "(": "LPAREN",
      ")": "RPAREN",
      "{": "LBRACE",
      "}": "RBRACE",
      ",": "COMMA",
      ";": "SEMI",
      ".": "DOT",
    };
    return { ...token, type: m[token.value] || token.type };
  }

  if (token.type === "OPER_ARITMETICO") {
    const m = { "+": "PLUS", "-": "MINUS", "*": "STAR", "/": "SLASH" };
    return { ...token, type: m[token.value] || token.type };
  }

  if (token.type === "OPER_RELACIONAL") {
    const m = {
      "==": "EQ",
      "!=": "NE",
      ">=": "GE",
      "<=": "LE",
      ">": "GT",
      "<": "LT",
    };
    return { ...token, type: m[token.value] || token.type };
  }

  if (token.type === "ATRIBUICAO") return { ...token, type: "ASSIGN" };
  if (token.type === "NUM") return { ...token, type: "NUM_REAL" };
  if (token.type === "VAR") return { ...token, type: "DOLLAR_IDENT" };

  return token;
}

module.exports = { lexer, normalizeToken };
