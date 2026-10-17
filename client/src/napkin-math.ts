export interface NapkinMath {
  rows: { label: string; value: string }[];
  equation: string | null;
  fallback: string;
}

export function parseNapkinMath(text: string): NapkinMath | null {
  const rows: NapkinMath['rows'] = [];
  const fallback: string[] = [];
  let equation: string | null = null;

  for (const line of text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    if (line.includes('≈')) {
      equation = line;
    } else {
      const match = line.match(/^(.+?):\s*(.+)$/);
      if (match) rows.push({ label: match[1].trim(), value: match[2].trim() });
      else fallback.push(line);
    }
  }

  if (rows.length < 2 && equation === null) return null;
  return { rows, equation, fallback: fallback.join('\n') };
}
