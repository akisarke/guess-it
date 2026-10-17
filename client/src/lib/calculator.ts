type Token = { type: 'number'; value: number } | { type: 'op'; value: string };

const isDigit = (c: string) => /[0-9.]/.test(c);
const isOp = (c: string) => ['+', '-', '−', '×', '÷', '(', ')', '%'].includes(c);

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
  if (op === '+' || op === '-' || op === '−') return 1;
  if (op === '×' || op === '÷' || op === '%') return 2;
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
      return b === 0 ? Infinity : a / b;
    case '%':
      return b === 0 ? Infinity : a % b;
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
    } else if (token.value === '(') {
      ops.push(token.value);
    } else if (token.value === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') {
        const b = values.pop()!;
        const a = values.pop()!;
        const op = ops.pop()!;
        values.push(applyOp(a, op, b));
      }
      ops.pop();
    } else {
      while (
        ops.length &&
        ops[ops.length - 1] !== '(' &&
        precedence(ops[ops.length - 1]) >= precedence(token.value)
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
    const b = values.pop()!;
    const a = values.pop()!;
    const op = ops.pop()!;
    values.push(applyOp(a, op, b));
  }

  return values[0] || 0;
}
