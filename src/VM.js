const fs = require("fs");

function parseProgram(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter((l) => l.length > 0);

  // 0-based: program[0] é a primeira instrução
  return lines.map((l) => {
    const parts = l.split(/\s+/);
    const op = parts[0];
    const arg = parts.length > 1 ? parts[1] : null;
    return { op, arg };
  });
}

function run(program, inputValues = []) {
  // pilha de avaliação (operand stack)
  const stack = [];

  // memória (endereçamento por índice numérico)
  const mem = [];

  // pilha de retorno (endereços via PUSHER)
  const retStack = [];

  // pilha de parâmetros (endereços via PARAM)
  const paramStack = [];

  // pilha de frames de chamada
  // cada frame guarda:
  //  - retAddr: pra onde volta no RTPR
  //  - params: lista de endereços (da memória) passados via PARAM
  //  - fillRemaining: quantos ALME iniciais ainda devem copiar args->params locais
  const callStack = [];

  // PC (program counter) 0-based
  let pc = 0;

  // cursor do input
  let inPtr = 0;

  function num(x) {
    const v = Number(x);
    if (Number.isNaN(v)) throw new Error(`Número inválido: ${x}`);
    return v;
  }

  function pop() {
    if (stack.length === 0) throw new Error("Stack underflow");
    return stack.pop();
  }

  function peek() {
    if (stack.length === 0) throw new Error("Stack empty");
    return stack[stack.length - 1];
  }

  function ensureMem(addr) {
    while (mem.length <= addr) mem.push(0);
  }

  while (pc >= 0 && pc < program.length) {
    const instr = program[pc];
    const op = instr.op;
    const arg = instr.arg;

    switch (op) {
      case "INPP":
        pc++;
        break;

      case "PARA":
        return; // fim do programa

      case "ALME": {
        const n = num(arg);

        for (let i = 0; i < n; i++) {
          const addr = mem.length;
          mem.push(0); // aloca no topo

          // Se está dentro de uma função e ainda faltam parâmetros para preencher,
          // então esta ALME corresponde a um parâmetro local recém-alocado:
          if (callStack.length > 0) {
            const frame = callStack[callStack.length - 1];

            if (frame.fillRemaining > 0) {
              const idx = frame.params.length - frame.fillRemaining; // 0..(n-1)
              const argAddr = frame.params[idx];

              ensureMem(argAddr);
              mem[addr] = mem[argAddr]; // copia valor do argumento para o parâmetro local

              frame.fillRemaining--;
            }
          }
        }

        pc++;
        break;
      }

      case "DESM": {
        const n = num(arg);
        // desaloca n células do topo da memória
        mem.splice(Math.max(0, mem.length - n), n);
        pc++;
        break;
      }

      case "CRCT":
        stack.push(num(arg));
        pc++;
        break;

      case "CRVL": {
        const addr = num(arg);
        ensureMem(addr);
        stack.push(mem[addr]);
        pc++;
        break;
      }

      case "ARMZ": {
        const addr = num(arg);
        ensureMem(addr);
        mem[addr] = pop();
        pc++;
        break;
      }

      case "SOMA": {
        const b = pop();
        const a = pop();
        stack.push(a + b);
        pc++;
        break;
      }

      case "SUBT": {
        const b = pop();
        const a = pop();
        stack.push(a - b);
        pc++;
        break;
      }

      case "MULT": {
        const b = pop();
        const a = pop();
        stack.push(a * b);
        pc++;
        break;
      }

      case "DIVI": {
        const b = pop();
        const a = pop();
        stack.push(a / b);
        pc++;
        break;
      }

      // Comparações: empilha 1 (true) ou 0 (false)
      case "CMAI": {
        // a >= b
        const b = pop();
        const a = pop();
        stack.push(a >= b ? 1 : 0);
        pc++;
        break;
      }

      case "CPMI": {
        // a <= b
        const b = pop();
        const a = pop();
        stack.push(a <= b ? 1 : 0);
        pc++;
        break;
      }

      case "CPIG": {
        // a == b
        const b = pop();
        const a = pop();
        stack.push(a === b ? 1 : 0);
        pc++;
        break;
      }

      case "CDES": {
        // a != b
        const b = pop();
        const a = pop();
        stack.push(a !== b ? 1 : 0);
        pc++;
        break;
      }

      case "CMMA": {
        // a > b
        const b = pop();
        const a = pop();
        stack.push(a > b ? 1 : 0);
        pc++;
        break;
      }

      case "CMME": {
        // a < b
        const b = pop();
        const a = pop();
        stack.push(a < b ? 1 : 0);
        pc++;
        break;
      }

      case "DSVF": {
        // desvia se falso (0)
        const addr = num(arg);
        const cond = pop();
        pc = cond === 0 ? addr : pc + 1;
        break;
      }

      case "DSVI": {
        // desvio incondicional
        pc = num(arg);
        break;
      }

      case "LEIT": {
        // lê um número do "inputValues"
        if (inPtr >= inputValues.length) {
          throw new Error("Faltou entrada para LEIT (inputValues acabou).");
        }
        stack.push(num(inputValues[inPtr++]));
        pc++;
        break;
      }

      case "IMPR": {
        console.log(peek());
        // normalmente IMPR consome ou não; no seu exemplo funciona bem consumindo
        pop();
        pc++;
        break;
      }

      // Chamadas de função/procedimento
      case "PUSHER": {
        // empilha endereço de retorno
        retStack.push(num(arg));
        pc++;
        break;
      }

      case "PARAM": {
        const addr = num(arg);
        paramStack.push(addr);
        pc++;
        break;
      }

      case "CHPR": {
        const funcAddr = num(arg);

        if (retStack.length === 0) throw new Error("CHPR sem PUSHER antes");
        const retAddr = retStack.pop();

        // captura os PARAMs desta chamada e limpa a fila global
        const params = paramStack.splice(0, paramStack.length);

        // cria frame da chamada
        callStack.push({
          retAddr,
          params,
          fillRemaining: params.length,
        });

        // desvia para o início da função
        pc = funcAddr;
        break;
      }

      case "RTPR": {
        if (callStack.length === 0)
          throw new Error("RTPR sem endereço de retorno.");

        const frame = callStack.pop();
        pc = frame.retAddr;
        break;
      }

      default:
        throw new Error(`Instrução desconhecida: ${op} (pc=${pc})`);
    }
  }
}

if (require.main === module) {
  const objPath = process.argv[2];
  if (!objPath) {
    console.log("Uso: node src/VM.js outputs/codigo.obj");
    process.exit(1);
  }

  const objText = fs.readFileSync(objPath, "utf8");

  // entrada: números separados por espaço/linha via stdin
  const stdin = fs.readFileSync(0, "utf8").trim();
  const inputs = stdin ? stdin.split(/\s+/) : [];

  const program = parseProgram(objText);
  run(program, inputs);
}

module.exports = { parseProgram, run };
