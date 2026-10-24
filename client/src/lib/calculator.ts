type Token = { type: 'number'; value: number } | { type: 'op'; value: string } | { type: 'percent' };

// Accepted operators: +, -, − (minus), ×, ÷, ^ (power), (, )
const isDigit = (c: string) => /[0-9.]/.test(c);
const isOp = (c: string) => ['+', '-', '−', '×', '÷', '(', ')', '^'].includes(c);

// Tokenize a mathematical expression into numbers, operators, and a percent token.
// Uses standard operator precedence: ^ > ×,÷ > +,−. Right-associative power.
// % divides the previous number by 100 (e.g., 200×10% → 20).
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
      // Skip unrecognized characters
      i++;
    }
  }

  return tokens;
}

function precedence(op: string): number {
  // ^ has highest precedence (3), ×,÷ next (2), +,− lowest (1)
  // Return 0 for unknown operators (should not occur with valid input)
  if (op === '^') return 3;
  if (op === '×' || op === '÷') return 2;
  if (op === '+' || op === '-' || op === '−') return 1;
  return 0;
}

function applyOp(a: number, op: string, b: number): number {
  // Apply a binary operator to two operands
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
      // Should not reach here with valid token stream
      return 0;
  }
}

export function evaluate(expr: string): number {
  // Evaluate a mathematical expression using the Shunting-yard algorithm.
  // Supports: +, -, ×, ÷, ^ (right-associative), parentheses, and % (percent).
  // Returns NaN for empty expressions, division by zero, or unparseable input.
  const tokens = tokenize(expr);
  const values: number[] = [];
  const ops: string[] = [];

  for (const token of tokens) {
    if (token.type === 'number') {
      values.push(token.value);
    } else if (token.type === 'percent') {
      // Percent divides the previous value by 100 (e.g., 50% → 0.5)
      if (values.length) values[values.length - 1] /= 100;
    } else if (token.value === '(') {
      ops.push(token.value);
    } else if (token.value === ')') {
      // Pop operators until '(' is found, applying each one
      while (ops.length && ops[ops.length - 1] !== '(') {
        const b = values.pop()!;
        const a = values.pop()!;
        const op = ops.pop()!;
        values.push(applyOp(a, op, b));
      }
      if (!ops.length) return NaN; // Mismatched parentheses
      ops.pop(); // Discard the '('
    } else {
      // Operator: pop higher-precedence (or left-associative same-precedence) operators first
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

  // Apply any remaining operators
  while (ops.length) {
    if (ops.length === 0 || ops[ops.length - 1] === '(' || values.length < 2) return NaN;
    const op = ops.pop()!;
    const b = values.pop()!;
    const a = values.pop()!;
    values.push(applyOp(a, op, b));
  }

  const out = values[0];
  return typeof out === 'number' && Number.isFinite(out) ? out : NaN;
}
