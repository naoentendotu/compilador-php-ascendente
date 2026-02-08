# Compilador PHP (Ascendente / LR) + Máquina Virtual (Stack Machine)

Este projeto implementa:

1. **Compilador**: Léxico + sintático LR + semântico + geração de código objeto.
2. **Máquina Virtual**: Lê o arquivo de código objeto e executa as instruções.

## Requisitos

- **Node.js**: Recomendado v18 ou superior.

> [!NOTE]
> **Não é obrigatório ter Bison** para executar, pois o projeto já inclui `outputs/lr_table.json`. O Bison só é necessário caso queira regenerar a tabela LR.

## Estrutura

- `src/`: Código-fonte do compilador e da VM.
- `inputs/`: Exemplos de programas de entrada.
- `outputs/`: Saída do compilador (código objeto) e tabela LR.
- `grammar/`: Definição da gramática (opcional para execução).
- `tools/`: Script para converter `grammar.output` em `lr_table.json` (opcional).

---

## Geração da Tabela LR

A análise sintática do compilador é **LR (ascendente)**. A tabela LR é gerada automaticamente a partir da gramática (grammar/grammar.y) utilizando o Bison.

### Processo de Geração

Bison: O Bison gera o arquivo grammar/grammar.output, que contém os estados, ações SHIFT/REDUCE e GOTO:

```bash
bison -v --report-file=grammar/grammar.output grammar/grammar.y

```

Conversão: O arquivo gerado é convertido para JSON pelo script dedicado:

```bash
node tools/bison_output_to_json.js grammar/grammar.output outputs/lr_table.json

```

O arquivo outputs/lr_table.json resultante é consumido diretamente pelo parser (ParserLR.js) durante o processo de compilação.

> **Nota:** Alguns avisos de _shift/reduce_ podem aparecer durante a execução do Bison; eles são esperados e tratados corretamente pela lógica da gramática implementada.

---

# Parte 1 — Compilar (Gerar código objeto)

## 1) Compilar um programa de entrada

Na raiz do projeto, execute:

```bash
node src/MainCompile.js inputs/correto.php.txt

```

Isso gera o arquivo de saída:
`outputs/codigo.obj.txt`

---

# Parte 2 — Executar (VM)

## 2) Executar o código objeto

A VM lê números da entrada padrão (**stdin**). Exemplo de execução passando valores:

```bash
echo "10 8 6 4 2" | node src/VM.js outputs/codigo.obj.txt

```

A saída será impressa diretamente no console.

---
