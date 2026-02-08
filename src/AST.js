function Program(body) {
  return { kind: "Program", body };
}
function Seq(items) {
  return { kind: "Seq", items };
}

function VarDecl(name, initExpr) {
  return { kind: "VarDecl", name, initExpr };
}
function Assign(name, expr) {
  return { kind: "Assign", name, expr };
}
function EchoVar(name) {
  return { kind: "EchoVar", name };
}

function If(cond, thenBlk, elseBlk) {
  return { kind: "If", cond, thenBlk, elseBlk };
}
function While(cond, body) {
  return { kind: "While", cond, body };
}

function FuncDecl(name, params, body) {
  return { kind: "FuncDecl", name, params, body };
}
function Call(name, args) {
  return { kind: "Call", name, args };
}

function Bin(op, left, right) {
  return { kind: "Bin", op, left, right };
}
function Un(op, expr) {
  return { kind: "Un", op, expr };
}
function Num(value) {
  return { kind: "Num", value: Number(value) };
}
function Var(name) {
  return { kind: "Var", name };
}
function ReadFloat() {
  return { kind: "ReadFloat" };
}
function Rel(op, left, right) {
  return { kind: "Rel", op, left, right };
}

module.exports = {
  Program,
  Seq,
  VarDecl,
  Assign,
  EchoVar,
  If,
  While,
  FuncDecl,
  Call,
  Bin,
  Un,
  Num,
  Var,
  ReadFloat,
  Rel,
};
