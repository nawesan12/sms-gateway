/**
 * CSV parser sin dependencias. Soporta:
 * - Header row obligatorio.
 * - Comillas dobles para valores con comas o saltos de línea.
 * - Escapar comillas duplicando ("").
 * - LF y CRLF como separadores de fila.
 *
 * Uso:
 *   const rows = parseCsv('phone,name\n+5491,Pepe\n');
 *   // [{ phone: '+5491', name: 'Pepe' }]
 */
export interface ParsedCsvRow {
  [column: string]: string;
}

export interface ParseCsvOptions {
  maxRows?: number;
}

export function parseCsv(input: string, opts: ParseCsvOptions = {}): ParsedCsvRow[] {
  const maxRows = opts.maxRows ?? 100_000;
  const records = tokenize(input);
  if (records.length === 0) return [];
  const header = records[0]!.map((c) => c.trim());
  if (header.length === 0 || header.some((h) => h.length === 0)) {
    throw new Error('CSV header invalid: empty column name');
  }
  const rows: ParsedCsvRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const cols = records[i]!;
    if (cols.length === 1 && cols[0] === '') continue; // empty line
    const row: ParsedCsvRow = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]!] = (cols[c] ?? '').trim();
    }
    rows.push(row);
    if (rows.length >= maxRows) {
      throw new Error(`CSV too large: max ${maxRows} rows`);
    }
  }
  return rows;
}

function tokenize(input: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      row.push(field);
      records.push(row);
      row = [];
      field = '';
      if (ch === '\r' && input[i + 1] === '\n') i += 2;
      else i++;
      continue;
    }
    field += ch;
    i++;
  }
  // last field if file doesn't end with newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}
