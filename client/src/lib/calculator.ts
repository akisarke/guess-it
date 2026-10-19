type Token = { type: 'number'; value: number } | { type: 'op'; value: string } | { type: 'percent' };

const isDigit = (c: string) => /[0-9.]/.test(c);
const isOp = (c: string) => ['+', '-', '−', '×', '÷', '(', ')', '^'].includes(c);

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    if (expr[i] === ' ') {
      i++;
      continue;
    }

    if (isDigit(expr[i])) {
      let num = '';
      while (i < expr.length && isDigit(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
    } else if (expr[i] === '%') {

      tokens.push({ type: 'percent' });
      i++;
    } else if (isOp(expr[i])) {
      tokens.push({ type: 'op', value: expr[i] });
      i++;
    } else {
      i++;
    }
  }

  return tokens;
}

function precedence(op: string): number {
  if (op === '^') return 3;
  if (op === '×' || op === '÷') return 2;
  if (op === '+' || op === '-' || op === '−') return 1;
  return 0;
}

function applyOp(a: number, op: string, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
    case '−':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return a / b;
    case '^':
      return a ** b;
    default:
      return 0;
  }
}

export function evaluate(expr: string): number {
  const tokens = tokenize(expr);
  const values: number[] = [];
  const ops: string[] = [];

  for (const token of tokens) {
    if (token.type === 'number') {
      values.push(token.value);
    } else if (token.type === 'percent') {
      if (values.length) values[values.length - 1] /= 100;
    } else if (token.value === '(') {
      ops.push(token.value);
    } else if (token.value === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') {
        const b = values.pop()!;
        const a = values.pop()!;
        const op = ops.pop()!;
        values.push(applyOp(a, op, b));
      }

      if (!ops.length) return NaN;
      ops.pop();
    } else {

      const rightAssoc = token.value === '^';
      while (
        ops.length &&
        ops[ops.length - 1] !== '(' &&
        (rightAssoc
          ? precedence(ops[ops.length - 1]) > precedence(token.value)
          : precedence(ops[ops.length - 1]) >= precedence(token.value))
      ) {
        const b = values.pop()!;
        const a = values.pop()!;
        const op = ops.pop()!;
        values.push(applyOp(a, op, b));
      }
      ops.push(token.value);
    }
  }

  while (ops.length) {
    const op = ops.pop()!;

    if (op === '(' || values.length < 2) return NaN;
    const b = values.pop()!;
    const a = values.pop()!;
    values.push(applyOp(a, op, b));
  }

  const out = values[0];
  return typeof out === 'number' && Number.isFinite(out) ? out : NaN;
}
