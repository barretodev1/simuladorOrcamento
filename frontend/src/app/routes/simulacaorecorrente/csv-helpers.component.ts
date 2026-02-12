import { ColumnDef, CsvRow, SimType } from './simulacaorecorrente.types.component';

export function normalize(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function detectDelimiter(headerLine: string): string {
  const comma = (headerLine.match(/,/g) || []).length;
  const semi = (headerLine.match(/;/g) || []).length;
  return semi > comma ? ';' : ',';
}

export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim().length > 0);

  if (!lines.length) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map(h => h.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i], delimiter);
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = (parts[c] ?? '').trim();
    rows.push(obj);
  }

  return { headers, rows };
}

export function suggestWidth(header: string) {
  const base = Math.max(140, header.length * 10 + 80);
  return Math.min(320, base);
}

export function guessSalaryColumn(headers: string[]) {
  const candidates = [
    'salario', 'salário', 'salary', 'remuneracao', 'remuneração',
    'base', 'vencimento', 'pay', 'comp', 'compensation', 'salario_base'
  ];
  for (const h of headers) {
    const n = normalize(h);
    if (candidates.some(c => n.includes(normalize(c)))) return h;
  }
  return '';
}

export function guessIdColumn(headers: string[]) {
  const candidates = ['id', 'matricula', 'matrícula', 'codigo', 'código', 'chapa', 'employee_id', 'empid'];
  for (const h of headers) {
    const n = normalize(h);
    if (candidates.some(c => n === normalize(c) || n.includes(normalize(c)))) return h;
  }
  return '';
}

export function guessNameColumn(headers: string[]) {
  const candidates = ['nome', 'name', 'colaborador', 'funcionario', 'funcionário', 'employee', 'pessoa'];
  for (const h of headers) {
    const n = normalize(h);
    if (candidates.some(c => n === normalize(c) || n.includes(normalize(c)))) return h;
  }
  return '';
}

export function parseMoneyToNumber(value: string | number | null): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return value;

  let v = String(value).trim();
  v = v.replace(/[^\d.,-]/g, '');

  const hasComma = v.includes(',');
  const hasDot = v.includes('.');

  if (hasComma && hasDot) return Number(v.replace(/\./g, '').replace(',', '.'));
  if (hasComma && !hasDot) return Number(v.replace(',', '.'));

  if (hasDot && !hasComma) {
    const dots = (v.match(/\./g) || []).length;
    if (dots > 1) v = v.replace(/\./g, '');
    return Number(v);
  }

  return Number(v);
}

// ===== sanitize (pra cenários salvos / storage) =====
export function sanitizeRow(raw: any): CsvRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r: any = raw;

  return {
    ...r,
    __simType: (r.__simType ?? '') as SimType,
    __percent: (r.__percent === '' || r.__percent === undefined || r.__percent === null) ? null : Number(r.__percent),
    __incMonthly: (typeof r.__incMonthly === 'number') ? r.__incMonthly : null,
    __incMonthlyFormatted: (typeof r.__incMonthlyFormatted === 'string') ? r.__incMonthlyFormatted : '',
    __incAnnual: (typeof r.__incAnnual === 'number') ? r.__incAnnual : null,
    __incAnnualFormatted: (typeof r.__incAnnualFormatted === 'string') ? r.__incAnnualFormatted : '',
    __error: (typeof r.__error === 'string') ? r.__error : '',
  } as CsvRow;
}

export function sanitizeRowsArray(arr: any): CsvRow[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(sanitizeRow).filter((x): x is CsvRow => !!x);
}

export function sanitizeColumnsArray(arr: any): ColumnDef[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(c => c && typeof c === 'object' && typeof c.key === 'string')
    .map(c => ({
      key: String(c.key),
      label: String(c.label ?? c.key),
      width: Number(c.width ?? 160)
    }));
}
