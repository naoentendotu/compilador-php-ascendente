%{
/* vazio por enquanto */
%}

/* Terminais */
%token PHP_OPEN PHP_CLOSE
%token FUNCTION IF ELSE WHILE ECHO FLOATVAL READLINE PHP_EOL
%token DOLLAR_IDENT IDENT NUM_REAL
%token LPAREN RPAREN LBRACE RBRACE COMMA SEMI DOT
%token ASSIGN
%token EQ NE GE LE GT LT
%token PLUS MINUS STAR SLASH

/* Precedência */
%left EQ NE GE LE GT LT
%left PLUS MINUS
%left STAR SLASH
%right UMINUS

%expect 2
%start programa

%%

programa
  : PHP_OPEN corpo PHP_CLOSE
  ;

corpo
  : lista_dc lista_comandos
  ;

/* --------- Declarações (globais) --------- */
lista_dc
  : /* vazio */
  | lista_dc declaracao
  ;

declaracao
  : dc_v
  | dc_f
  ;

dc_v
  : DOLLAR_IDENT ASSIGN expressao SEMI
  | DOLLAR_IDENT SEMI
  ;

/* --------- Funções --------- */
dc_f
  : FUNCTION IDENT parametros LBRACE corpo_f RBRACE
  ;

parametros
  : LPAREN lista_par RPAREN
  | LPAREN RPAREN
  ;

lista_par
  : DOLLAR_IDENT mais_par
  ;

mais_par
  : COMMA DOLLAR_IDENT mais_par
  | /* vazio */
  ;

corpo_f
  : lista_dcloc lista_comandos
  ;

/* declarações locais: zero ou mais dc_v */
lista_dcloc
  : /* vazio */
  | lista_dcloc dc_v
  ;

/* --------- Comandos: zero ou mais --------- */
lista_comandos
  : /* vazio */
  | lista_comandos comando
  ;

comando
  : DOLLAR_IDENT ASSIGN expressao SEMI
  | ECHO DOLLAR_IDENT DOT PHP_EOL SEMI
  | IF LPAREN condicao RPAREN LBRACE lista_comandos RBRACE pfalsa
  | WHILE LPAREN condicao RPAREN LBRACE lista_comandos RBRACE
  | IDENT lista_arg SEMI
  ;


pfalsa
  : ELSE LBRACE lista_comandos RBRACE
  | /* vazio */
  ;

lista_arg
  : LPAREN argumentos RPAREN
  | LPAREN RPAREN
  ;

argumentos
  : expressao mais_ident
  ;

mais_ident
  : COMMA expressao mais_ident
  | /* vazio */
  ;

/* --------- Condição --------- */
condicao
  : expressao relacao expressao
  ;

relacao
  : EQ
  | NE
  | GE
  | LE
  | GT
  | LT
  ;

/* --------- Expressões --------- */
expressao
  : termo outros_termos
  ;

termo
  : op_un fator mais_fatores
  ;

op_un
  : MINUS %prec UMINUS
  | /* vazio */
  ;

fator
  : DOLLAR_IDENT
  | NUM_REAL
  | LPAREN expressao RPAREN
  | FLOATVAL LPAREN READLINE LPAREN RPAREN RPAREN
  ;

outros_termos
  : op_ad termo outros_termos
  | /* vazio */
  ;

op_ad
  : PLUS
  | MINUS
  ;

mais_fatores
  : op_mul fator mais_fatores
  | /* vazio */
  ;

op_mul
  : STAR
  | SLASH
  ;

%%
