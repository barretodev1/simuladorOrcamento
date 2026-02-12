export type MenuItem = {
  key: string;
  title: string;
  route?: string;
  imagePath: string;
};

export type ActiveView = 'area' | 'empresa';
export type SimType = '' | 'MERITO' | 'PROMOCAO';

export type CsvRow = {
  [key: string]: string | number | null;

  __simType: SimType;
  __percent: number | null;

  __incMonthly: number | null;
  __incMonthlyFormatted: string;

  __incAnnual: number | null;
  __incAnnualFormatted: string;

  __error: string;
};

export type ColumnDef = {
  key: string;
  label: string;
  width: number;
};

// Resumo p/ sidebar
export type SavedScenarioSummary = {
  id: string;
  name: string;
  createdAt: number;

  fileName: string;
  activeView: ActiveView;
  salaryColumnKey: string;

  idColumnKey: string;
  nameColumnKey: string;
};

// Completo (quando abre)
export type SavedScenario = SavedScenarioSummary & {
  dataColumns: ColumnDef[];
  rows: CsvRow[];
};
