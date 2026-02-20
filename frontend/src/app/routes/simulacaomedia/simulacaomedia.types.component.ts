export type MenuItem = {
  key: string;
  title: string;
  route?: string;
  imagePath: string;
};

export type ActiveView = 'area' | 'empresa';

export type CsvRow = {
  [key: string]: string | number | null;

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

// ✅ Linhas das simulações (o que você “fez” na tela)
export type SimulationRow = {
  area: string;                     // área escolhida/derivada
  role: string;                     // cargo (role = cargo)
  type: 'ADMISSAO' | 'DEMISSAO';    // tipo
  qty: number;                      // quantidade
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

  // ✅ colunas que o usuário “marcou” como Área e Cargo
  areaColumnKey: string;
  roleColumnKey: string;

  // ✅ simulações feitas
  simulations: SimulationRow[];
};