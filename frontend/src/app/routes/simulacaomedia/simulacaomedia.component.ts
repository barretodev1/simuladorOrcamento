// simulacaomedia.component.ts (MERGE do media + lógica de Média)
//
// ✅ Traz do simulacaomedia:
// - parseCsv + normalize + guess columns + sanitize
// - scroll horizontal com botões + wheel horizontal
// - minWidth dinâmico
// - resize de colunas + drag reorder
// - focusListMode + focusUiMode
// - salvar/carregar com cache local + API + link por URL
//
// ✅ Mantém do simulacaomedia:
// - simulações por área/cargo (ADMISSAO/DEMISSAO) com média salarial e impacto
// - KPIs (HC, mensal, média, anual)

import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MenuOptionsComponent } from '@/components/menu-options/menu-options.component';
import { KpiCardComponent } from '@/components/kpi-card/kpi-card.component';
import { AuthService } from '@/auth/auth.service';

import { ScenarioStoreService } from '../simulacaomedia/scenario-store.service.component';
import { ScenarioApiService } from '../simulacaomedia/scenario-api.service.component';

import {
  ActiveView,
  ColumnDef,
  CsvRow,
  SavedScenario,
  SavedScenarioSummary
} from './simulacaomedia.types.component';

import {
  guessIdColumn,
  guessNameColumn,
  guessSalaryColumn,
  normalize,
  parseCsv,
  parseMoneyToNumber,
  sanitizeColumnsArray,
  sanitizeRowsArray,
  suggestWidth
} from '../simulacaomedia/csv-helpers.component';

type MenuItem = {
  key: string;
  title: string;
  route?: string;
  imagePath: string;
};

type SimulationRow = {
  area: string;
  role: string;
  type: 'ADMISSAO' | 'DEMISSAO';
  qty: number;

  avg: number;
  total: number;

  avgFormatted: string;
  totalFormatted: string;

  availableRoles: string[];
};

// payload estendido p/ salvar o "MEDIA"
type SavedScenarioMedia = SavedScenario & {
  scenarioType?: 'media';
  areaColumnKey?: string;
  roleColumnKey?: string;
  simulations?: Array<{
    area: string;
    role: string;
    type: 'ADMISSAO' | 'DEMISSAO';
    qty: number;
  }>;
};

@Component({
  selector: 'app-simulacaomedia',
  standalone: true,
  imports: [MenuOptionsComponent, KpiCardComponent, CommonModule, FormsModule],
  templateUrl: './simulacaomedia.component.html'
})
export class SimulacaomediaComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);
  private store = inject(ScenarioStoreService);
  private api = inject(ScenarioApiService);

  @ViewChild('csvInput') csvInput?: ElementRef<HTMLInputElement>;
  @ViewChild('tableWrap') tableWrap?: ElementRef<HTMLDivElement>;

  // ===== tabela horizontal (do media) =====
  tableMinWidth = 1800;
  canScrollLeft = false;
  canScrollRight = false;

  private wheelHandler?: (ev: WheelEvent) => void;
  private wheelTarget?: HTMLElement;

  // ===== UI =====
  user = { name: 'Usuário' };
  searchTerm = '';

  focusListMode = false; // some blocos superiores
  focusUiMode = false;   // some sidebar/menu
  // compat: se seu HTML usa focusMode
  focusMode = false;

  menu: MenuItem[] = [
    { key: 'home', title: 'Menu Principal', route: '/simulador_de_gastos', imagePath: '/inicio.svg' },
    { key: 'results', title: 'Resultados', route: '/simulador_de_gastos/resultados', imagePath: '/badge-dollar-sign.svg' },
    { key: 'history', title: 'Históricos', route: '/simulador_de_gastos/historicos', imagePath: '/history.svg' },
    { key: 'settings', title: 'Configurações', route: '/simulador_de_gastos/configuracoes', imagePath: '/settings.svg' }
  ];
  orderedMenu: MenuItem[] = [...this.menu];

  // ===== CSV / dados =====
  activeView: ActiveView = 'area';
  csvLoaded = false;
  csvFileName = '';
  csvError = '';

  dataColumns: ColumnDef[] = [];
  headers: string[] = [];
  rows: CsvRow[] = [];
  filteredRows: CsvRow[] = [];

  salaryColumnKey = '';
  idColumnKey = '';
  nameColumnKey = '';

  peopleSearchTerm = '';
  peopleSearchError = '';

  // ===== Media: colunas de área/cargo =====
  areaColumnKey = '';
  roleColumnKey = '';

  // compat: se seu HTML usa "areaColumn" / "roleColumn"
  get areaColumn() { return this.areaColumnKey; }
  set areaColumn(v: string) { this.areaColumnKey = v || ''; this.extractUniques(); this.recalculate(); }

  get roleColumn() { return this.roleColumnKey; }
  set roleColumn(v: string) { this.roleColumnKey = v || ''; this.extractUniques(); this.recalculate(); }

  // compat: se teu código/HTML usa "salaryColumn"
  get salaryColumn() { return this.salaryColumnKey; }
  set salaryColumn(v: string) { this.salaryColumnKey = v || ''; this.recalculate(); }

  uniqueAreas: string[] = [];
  areaRoleMap: Record<string, string[]> = {};

  simulations: SimulationRow[] = [];
  copiedSimulation: SimulationRow | null = null;

  private brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // (fica aqui p/ compat, mesmo que o MEDIA não use igual ao media)
  monthsRemaining = this.getMonthsRemainingInYear(new Date());

  // ===== KPI =====
  kpiHc = '0';
  kpiMonthly = this.brl.format(0);
  kpiAvg = this.brl.format(0);
  kpiAnnual = this.brl.format(0);

  // ===== salvar cenários =====
  saveName = '';
  showSaveInput = false;

  savedScenarios: SavedScenarioSummary[] = [];
  private scenarioFullCache = new Map<string, SavedScenarioMedia>();

  // ===== resize (do media) =====
  private resizingKey: string | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private boundMove?: (e: PointerEvent) => void;
  private boundUp?: () => void;

  // drag reorder (do media)
  private dragColIndex: number = -1;

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = this.auth.getUserName() || 'Usuário';
      this.savedScenarios = this.store.loadSummaries() || [];

      // se logado, tenta sincronizar lista
      if (this.auth.isLoggedIn()) {
        await this.refreshFromApi();
      }

      // se tiver ?saved= na URL, abre (API -> local)
      const idFromUrl = this.store.getScenarioParamFromUrl();
      if (idFromUrl) {
        await this.loadScenario(idFromUrl);
      }
    }

    this.onSearch();
    this.monthsRemaining = this.getMonthsRemainingInYear(new Date());
    this.computeKpis();
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.syncTableUiAfterRender();
  }

  ngOnDestroy() {
    this.detachWheel();
    if (this.boundMove) window.removeEventListener('pointermove', this.boundMove);
    if (this.boundUp) window.removeEventListener('pointerup', this.boundUp);
  }

  // ===== API sync =====
  private async refreshFromApi() {
    try {
      const list = await this.api.list();
      this.savedScenarios = list;
      this.store.saveSummaries(list);
    } catch (e) {
      console.warn('Falha ao listar na API. Mantendo cache local.', e);
    }
  }

  // ===== UI sync do wrap =====
  private syncTableUiAfterRender(tryCount: number = 0) {
    if (!isPlatformBrowser(this.platformId)) return;
    requestAnimationFrame(() => {
      const wrap = this.tableWrap?.nativeElement;
      if (!wrap) {
        if (tryCount < 12) this.syncTableUiAfterRender(tryCount + 1);
        return;
      }
      this.recalcTableMinWidth();
      this.attachWheelToHorizontal();
      this.updateHorizontalButtons();
    });
  }

  // ===== Menu search =====
  onSearch() {
    const term = normalize(this.searchTerm);
    if (!term) { this.orderedMenu = [...this.menu]; return; }

    const matches: MenuItem[] = [];
    const rest: MenuItem[] = [];
    for (const item of this.menu) (normalize(item.title).includes(term) ? matches : rest).push(item);
    this.orderedMenu = [...matches, ...rest];
  }
  trackByKey(_i: number, item: MenuItem) { return item.key; }

  // ===== Focus modes =====
  toggleFocusUiMode() {
    this.focusUiMode = !this.focusUiMode;
    this.focusMode = this.focusUiMode;

    if (this.focusUiMode) {
      this.focusListMode = true;
      this.showSaveInput = false;
    } else {
      this.focusListMode = false;
    }

    if (!isPlatformBrowser(this.platformId)) return;

    requestAnimationFrame(() => {
      const wrap = this.tableWrap?.nativeElement;
      if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    window.setTimeout(() => {
      this.updateHorizontalButtons();
      this.recalcTableMinWidth();
    }, 320);
  }

  toggleFocusListMode() {
    this.focusListMode = !this.focusListMode;
    if (this.focusListMode) this.showSaveInput = false;

    if (this.focusListMode && isPlatformBrowser(this.platformId)) {
      requestAnimationFrame(() => {
        const wrap = this.tableWrap?.nativeElement;
        if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  // compat: se teu HTML chama toggleFocusMode()
  toggleFocusMode() { this.toggleFocusUiMode(); }

  // ===== CSV =====
  openCsvPicker() { this.csvInput?.nativeElement.click(); }

  clearCsv() {
    this.csvLoaded = false;
    this.csvFileName = '';
    this.headers = [];
    this.csvError = '';

    this.dataColumns = [];
    this.rows = [];
    this.filteredRows = [];

    this.salaryColumnKey = '';
    this.idColumnKey = '';
    this.nameColumnKey = '';

    this.areaColumnKey = '';
    this.roleColumnKey = '';
    this.uniqueAreas = [];
    this.areaRoleMap = {};

    this.simulations = [];
    this.copiedSimulation = null;

    this.peopleSearchTerm = '';
    this.peopleSearchError = '';

    this.showSaveInput = false;
    this.saveName = '';

    this.focusListMode = false;
    this.focusUiMode = false;
    this.focusMode = false;

    const input = this.csvInput?.nativeElement;
    if (input) input.value = '';

    this.store.clearScenarioParamFromUrl();
    this.computeKpis();

    this.tableMinWidth = 1800;
    this.canScrollLeft = false;
    this.canScrollRight = false;

    this.detachWheel();
  }

  onCsvSelected(event: Event) {
    this.csvError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.csvFileName = file.name;
    const reader = new FileReader();

    reader.onload = () => this.loadCsvText(String(reader.result ?? ''));
    reader.onerror = () => { this.csvError = 'Erro ao ler o arquivo CSV.'; this.computeKpis(); };

    reader.readAsText(file);
  }

  private loadCsvText(rawText: string) {
    try {
      const text = rawText.replace(/^\uFEFF/, '');
      const parsed = parseCsv(text);

      if (!parsed.headers.length) {
        this.csvError = 'CSV sem cabeçalho.';
        this.csvLoaded = false;
        this.computeKpis();
        return;
      }

      this.dataColumns = parsed.headers.map(h => ({ key: h, label: h, width: suggestWidth(h) }));
      this.headers = parsed.headers.slice();

      // ✅ mantém compat com o CsvRow (mesmo que o MEDIA não use os campos)
      this.rows = parsed.rows.map(obj => ({
        ...obj,
        // campos “do media” (não atrapalham o Media e evitam erro de tipagem)
        __simType: (obj as any).__simType ?? '',
        __percent: (obj as any).__percent ?? null,
        __incMonthly: (obj as any).__incMonthly ?? null,
        __incMonthlyFormatted: (obj as any).__incMonthlyFormatted ?? '',
        __incAnnual: (obj as any).__incAnnual ?? null,
        __incAnnualFormatted: (obj as any).__incAnnualFormatted ?? '',
        __error: (obj as any).__error ?? ''
      })) as any;

      this.rows = sanitizeRowsArray(this.rows);

      this.salaryColumnKey = guessSalaryColumn(parsed.headers) || '';
      this.idColumnKey = guessIdColumn(parsed.headers) || '';
      this.nameColumnKey = guessNameColumn(parsed.headers) || '';

      this.csvLoaded = true;
      this.showSaveInput = false;
      this.saveName = '';

      this.focusListMode = false;
      this.focusUiMode = false;
      this.focusMode = false;

      this.peopleSearchTerm = '';
      this.peopleSearchError = '';
      this.filteredRows = [...this.rows];

      // se já tiver colunas setadas, atualiza mapa
      this.extractUniques();

      // se já existem sims, revalida roles
      this.recalculateAllRowsSimulations();
      this.computeKpis();

      this.syncTableUiAfterRender();
    } catch {
      this.csvError = 'Não consegui interpretar o CSV. Verifique se o arquivo está correto.';
      this.csvLoaded = false;
      this.computeKpis();
    }
  }

  onSalaryColumnChange() {
    this.recalculate();
  }

  // ===== Busca pessoa (do media) =====
  applyPeopleSearch() {
    this.peopleSearchError = '';
    if (!this.csvLoaded || !this.rows.length) { this.filteredRows = []; return; }

    const raw = (this.peopleSearchTerm || '').trim();
    if (!raw) { this.filteredRows = [...this.rows]; return; }

    if (!this.idColumnKey && !this.nameColumnKey) {
      this.peopleSearchError = 'Selecione pelo menos uma coluna (ID ou Nome) para buscar.';
      this.filteredRows = [...this.rows];
      return;
    }

    const termNorm = normalize(raw);
    const looksNumeric = /^[0-9.\-_\s]+$/.test(raw);

    this.filteredRows = this.rows.filter(r => {
      let matchId = false;
      let matchName = false;

      if (this.idColumnKey) {
        const idStr = (r[this.idColumnKey] ?? '').toString().trim();
        matchId = looksNumeric ? (normalize(idStr) === termNorm) : normalize(idStr).includes(termNorm);
      }

      if (this.nameColumnKey) {
        const nameStr = (r[this.nameColumnKey] ?? '').toString();
        matchName = normalize(nameStr).includes(termNorm);
      }

      return matchId || matchName;
    });

    if (this.filteredRows.length === 0) this.peopleSearchError = 'Nenhuma pessoa encontrada com esse termo.';
  }

  clearPeopleSearch() {
    this.peopleSearchTerm = '';
    this.peopleSearchError = '';
    this.filteredRows = [...this.rows];
  }

  trackByRowIndex(index: number) { return index; }
  trackByColKey(_i: number, col: ColumnDef) { return col.key; }

  // ===== Media: extrair únicos área/cargo =====
  extractUniques() {
    if (!this.areaColumnKey || !this.roleColumnKey) return;
    if (!this.rows?.length) { this.uniqueAreas = []; this.areaRoleMap = {}; return; }

    const map: Record<string, Set<string>> = {};
    const areas = new Set<string>();

    for (const row of this.rows as any[]) {
      const area = (row as any)[this.areaColumnKey];
      const role = (row as any)[this.roleColumnKey];
      if (!area || !role) continue;

      const a = String(area).trim();
      const r = String(role).trim();
      if (!a || !r) continue;

      areas.add(a);
      if (!map[a]) map[a] = new Set();
      map[a].add(r);
    }

    this.uniqueAreas = Array.from(areas);
    this.areaRoleMap = {};
    Object.keys(map).forEach(a => {
      this.areaRoleMap[a] = Array.from(map[a]);
    });

    // atualiza availableRoles das sims existentes
    this.simulations.forEach(sim => {
      sim.availableRoles = this.areaRoleMap[sim.area] || [];
      if (sim.role && !sim.availableRoles.includes(sim.role)) sim.role = '';
    });
  }

  // ===== Media: sims =====
  addSimulation() {
    this.simulations.push({
      area: '',
      role: '',
      type: 'ADMISSAO',
      qty: 1,
      avg: 0,
      total: 0,
      avgFormatted: this.brl.format(0),
      totalFormatted: this.brl.format(0),
      availableRoles: []
    });
  }

  removeSimulation(index: number) {
    this.simulations.splice(index, 1);
    this.recalculate();
  }

  copySimulation(sim: SimulationRow) {
    this.copiedSimulation = { ...sim, availableRoles: [...sim.availableRoles] };
  }

  pasteSimulation(target: SimulationRow) {
    if (!this.copiedSimulation) return;

    target.area = this.copiedSimulation.area;
    target.type = this.copiedSimulation.type;
    target.qty = this.copiedSimulation.qty;

    target.availableRoles = this.areaRoleMap[target.area] || [];
    target.role = target.availableRoles.includes(this.copiedSimulation.role)
      ? this.copiedSimulation.role
      : '';

    this.recalculate();
  }

  onAreaChange(sim: SimulationRow) {
    sim.availableRoles = this.areaRoleMap[sim.area] || [];
    sim.role = '';
    this.recalculate();
  }

  // wrapper p/ compat com applyScenario()
  private recalculateAllRowsSimulations() {
    // no MEDIA, “simulação” é a lista simulations (não é por-row)
    this.extractUniques();
    this.simulations.forEach(sim => {
      sim.availableRoles = this.areaRoleMap[sim.area] || [];
      if (sim.role && !sim.availableRoles.includes(sim.role)) sim.role = '';
    });
    this.recalculate();
  }

  recalculate() {
    // se ainda não tem CSV/colunas escolhidas, zera sims e kpis
    if (!this.csvLoaded || !this.salaryColumnKey) {
      this.simulations.forEach(sim => {
        sim.avg = 0;
        sim.total = 0;
        sim.avgFormatted = this.brl.format(0);
        sim.totalFormatted = this.brl.format(0);
      });
      this.computeKpis();
      return;
    }

    this.simulations.forEach(sim => {
      if (!sim.area || !sim.role || !this.areaColumnKey || !this.roleColumnKey) {
        sim.avg = 0;
        sim.total = 0;
        sim.avgFormatted = this.brl.format(0);
        sim.totalFormatted = this.brl.format(0);
        return;
      }

      const filtered = (this.rows as any[]).filter(r =>
        (r as any)[this.areaColumnKey] === sim.area &&
        (r as any)[this.roleColumnKey] === sim.role
      );

      const salaries = filtered.map(r => parseMoneyToNumber((r as any)[this.salaryColumnKey]));
      const valid = salaries.filter(v => typeof v === 'number' && isFinite(v) && v > 0) as number[];

      const avg = valid.length ? (valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
      const total = avg * (Number(sim.qty) || 0) * (sim.type === 'ADMISSAO' ? 1 : -1);

      sim.avg = avg;
      sim.total = total;
      sim.avgFormatted = this.brl.format(avg);
      sim.totalFormatted = this.brl.format(total);
    });

    this.computeKpis();
  }

  computeKpis() {
    // base HC = linhas do CSV
    const baseHc = (this.rows?.length || 0);

    const impactHc = this.simulations.reduce((acc, s) => {
      const qty = Number(s.qty) || 0;
      return acc + (s.type === 'ADMISSAO' ? qty : -qty);
    }, 0);

    const finalHc = baseHc + impactHc;

    if (!this.csvLoaded || !this.salaryColumnKey || !baseHc) {
      this.kpiHc = String(finalHc > 0 ? finalHc : 0);
      this.kpiMonthly = this.brl.format(0);
      this.kpiAvg = this.brl.format(0);
      this.kpiAnnual = this.brl.format(0);
      return;
    }

    const baseMonthly = (this.rows as any[]).reduce((acc, r) => {
      const v = parseMoneyToNumber((r as any)[this.salaryColumnKey]);
      return acc + ((typeof v === 'number' && isFinite(v) && v > 0) ? v : 0);
    }, 0);

    const impactMonthly = this.simulations.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

    const finalMonthly = baseMonthly + impactMonthly;

    this.kpiHc = String(finalHc);
    this.kpiMonthly = this.brl.format(finalMonthly);
    this.kpiAvg = this.brl.format(finalHc > 0 ? (finalMonthly / finalHc) : 0);
    this.kpiAnnual = this.brl.format(finalMonthly * 12);
  }

  // ===== meses restante (compat) =====
  private getMonthsRemainingInYear(date: Date) {
    const month = date.getMonth() + 1;
    return 12 - month + 1;
  }

  // ===== salvar / carregar =====
  toggleSaveInput() {
    if (!this.csvLoaded) return;

    if (!this.showSaveInput && this.focusListMode) this.focusListMode = false;

    this.showSaveInput = !this.showSaveInput;
    if (this.showSaveInput && !this.saveName) {
      this.saveName = this.csvFileName || 'Nova simulação';
    }
  }

  async saveScenario() {
    if (!this.csvLoaded) return;

    const name = (this.saveName || '').trim();
    if (!name) { this.csvError = 'Dê um nome para salvar a simulação.'; return; }

    const scenarioFull: SavedScenarioMedia & any = {
      id: this.store.makeId(),
      name,
      createdAt: Date.now(),
      fileName: this.csvFileName || 'base.csv',
      activeView: this.activeView,
      salaryColumnKey: this.salaryColumnKey,
      idColumnKey: this.idColumnKey || '',
      nameColumnKey: this.nameColumnKey || '',
      dataColumns: this.dataColumns.map(c => ({ ...c })),
      rows: (this.rows as any[]).map(r => ({ ...r })) as any,
      scenarioType: 'media',
      areaColumnKey: this.areaColumnKey || '',
      roleColumnKey: this.roleColumnKey || '',
      simulations: this.simulations.map(s => ({
        area: s.area,
        role: s.role,
        type: s.type,
        qty: Number(s.qty) || 0
      }))
    };

    this.scenarioFullCache.set(scenarioFull.id, scenarioFull);
    this.store.cacheFullScenario(scenarioFull as any);

    try {
      const summary = await this.api.upsert(scenarioFull as any);

      this.savedScenarios = [summary, ...this.savedScenarios]
        .filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i)
        .slice(0, 50);

      this.store.saveSummaries(this.savedScenarios);
      this.store.setScenarioParamOnUrl(summary.id);

      this.showSaveInput = false;
    } catch {
      // fallback local summary
      this.savedScenarios = [{
        id: scenarioFull.id,
        name: scenarioFull.name,
        createdAt: scenarioFull.createdAt,
        fileName: scenarioFull.fileName,
        activeView: scenarioFull.activeView,
        salaryColumnKey: scenarioFull.salaryColumnKey,
        idColumnKey: scenarioFull.idColumnKey,
        nameColumnKey: scenarioFull.nameColumnKey
      }, ...this.savedScenarios].slice(0, 50);

      this.store.saveSummaries(this.savedScenarios);
      this.store.setScenarioParamOnUrl(scenarioFull.id);
      this.showSaveInput = false;
    }
  }

  async loadScenario(id: string) {
    const mem = this.scenarioFullCache.get(id);
    if (mem) { this.applyScenario(mem); return; }

    const local = this.store.loadFullScenario(id) as SavedScenarioMedia | null;
    if (local) {
      this.scenarioFullCache.set(id, local);
      this.applyScenario(local);
      return;
    }

    try {
      const scenario = await this.api.get(id) as any as SavedScenarioMedia;
      this.scenarioFullCache.set(id, scenario);
      this.store.cacheFullScenario(scenario as any);
      this.applyScenario(scenario);
    } catch {
      const current = this.store.getScenarioParamFromUrl();
      if (current === id) this.store.clearScenarioParamFromUrl();
    }
  }

  private applyScenario(found: SavedScenarioMedia) {
    this.csvLoaded = true;
    this.csvError = '';

    this.csvFileName = found.fileName;
    this.activeView = found.activeView;

    this.salaryColumnKey = found.salaryColumnKey || '';
    this.idColumnKey = (found as any).idColumnKey || '';
    this.nameColumnKey = (found as any).nameColumnKey || '';

    this.dataColumns = sanitizeColumnsArray(found.dataColumns || []);
    this.headers = this.dataColumns.map(c => c.key);
    this.rows = sanitizeRowsArray((found.rows || []) as any);

    // media extra
    this.areaColumnKey = (found as any).areaColumnKey || '';
    this.roleColumnKey = (found as any).roleColumnKey || '';

    const sims = (found as any).simulations as SavedScenarioMedia['simulations'] | undefined;
    this.simulations = Array.isArray(sims)
      ? sims.map(s => ({
          area: s.area || '',
          role: s.role || '',
          type: s.type === 'DEMISSAO' ? 'DEMISSAO' : 'ADMISSAO',
          qty: Number(s.qty) || 0,
          avg: 0,
          total: 0,
          avgFormatted: this.brl.format(0),
          totalFormatted: this.brl.format(0),
          availableRoles: []
        }))
      : [];

    this.monthsRemaining = this.getMonthsRemainingInYear(new Date());

    // volta UI normal
    this.focusListMode = false;
    this.focusUiMode = false;
    this.focusMode = false;

    this.showSaveInput = false;
    this.saveName = found.name;

    this.store.setScenarioParamOnUrl(found.id);

    this.peopleSearchTerm = '';
    this.peopleSearchError = '';
    this.filteredRows = [...this.rows];

    this.extractUniques();
    this.recalculateAllRowsSimulations();
    this.computeKpis();

    this.syncTableUiAfterRender();
  }

  async deleteScenario(id: string) {
    this.savedScenarios = this.savedScenarios.filter(s => s.id !== id);
    this.store.saveSummaries(this.savedScenarios);
    this.store.removeFromCache(id);
    this.scenarioFullCache.delete(id);

    try { await this.api.remove(id); } catch {}

    const current = this.store.getScenarioParamFromUrl();
    if (current === id) this.store.clearScenarioParamFromUrl();
  }

  async copyScenarioLink(id: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    const link = this.store.buildScenarioLink(id);
    if (!link) return;

    try {
      await window.navigator.clipboard.writeText(link);
    } catch {
      const el = document.createElement('textarea');
      el.value = link;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  }

  // ===== botões scroll horizontal =====
  private updateHorizontalButtons() {
    const wrap = this.tableWrap?.nativeElement;
    if (!wrap) { this.canScrollLeft = false; this.canScrollRight = false; return; }

    const maxLeft = wrap.scrollWidth - wrap.clientWidth;
    const left = wrap.scrollLeft;

    this.canScrollLeft = left > 1;
    this.canScrollRight = maxLeft > 1 && left < maxLeft - 1;
  }

  onTableScroll() { this.updateHorizontalButtons(); }

  scrollTable(direction: 'left' | 'right') {
    const wrap = this.tableWrap?.nativeElement;
    if (!wrap) return;

    const step = Math.max(260, Math.floor(wrap.clientWidth * 0.8));
    wrap.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
    requestAnimationFrame(() => this.updateHorizontalButtons());
  }

  scrollTableTo(edge: 'start' | 'end') {
    const wrap = this.tableWrap?.nativeElement;
    if (!wrap) return;

    const left = edge === 'start' ? 0 : (wrap.scrollWidth - wrap.clientWidth);
    wrap.scrollTo({ left, behavior: 'smooth' });
    requestAnimationFrame(() => this.updateHorizontalButtons());
  }

  private detachWheel() {
    if (this.wheelTarget && this.wheelHandler) this.wheelTarget.removeEventListener('wheel', this.wheelHandler as any);
    this.wheelTarget = undefined;
    this.wheelHandler = undefined;
  }

  private attachWheelToHorizontal() {
    const wrap = this.tableWrap?.nativeElement;
    if (!wrap) return;

    if (this.wheelTarget && this.wheelHandler) this.wheelTarget.removeEventListener('wheel', this.wheelHandler as any);

    this.wheelTarget = wrap;
    this.wheelHandler = (ev: WheelEvent) => {
      const mostlyVertical = Math.abs(ev.deltaY) > Math.abs(ev.deltaX);
      if (mostlyVertical && !ev.shiftKey) {
        wrap.scrollLeft += ev.deltaY;
        ev.preventDefault();
      }
      this.updateHorizontalButtons();
    };

    wrap.addEventListener('wheel', this.wheelHandler as any, { passive: false });
  }

  // ===== largura dinâmica =====
  private recalcTableMinWidth() {
    const cols = this.dataColumns.reduce((acc, c) => acc + (Number(c.width) || 160), 0);

    // como o MEDIA pode ter colunas extras na UI (ações, etc.), deixei uma folga parecida com o media
    const paddingPerCol = 24;
    const paddingTotal = paddingPerCol * (this.dataColumns.length + 6);

    const min = 1800;
    this.tableMinWidth = Math.max(min, cols + paddingTotal);
  }

  // ===== resize colunas =====
  startResize(colKey: string, ev: PointerEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!isPlatformBrowser(this.platformId)) return;

    const col = this.dataColumns.find(c => c.key === colKey);
    if (!col) return;

    this.resizingKey = colKey;
    this.resizeStartX = ev.clientX;
    this.resizeStartWidth = col.width;

    this.boundMove = (e: PointerEvent) => this.onResizeMove(e);
    this.boundUp = () => this.stopResize();

    window.addEventListener('pointermove', this.boundMove);
    window.addEventListener('pointerup', this.boundUp);
  }

  private onResizeMove(ev: PointerEvent) {
    if (!this.resizingKey) return;
    const col = this.dataColumns.find(c => c.key === this.resizingKey);
    if (!col) return;

    const next = this.resizeStartWidth + (ev.clientX - this.resizeStartX);
    col.width = Math.max(90, Math.min(700, next));

    this.recalcTableMinWidth();
    this.updateHorizontalButtons();
  }

  private stopResize() {
    this.resizingKey = null;
    if (this.boundMove) window.removeEventListener('pointermove', this.boundMove);
    if (this.boundUp) window.removeEventListener('pointerup', this.boundUp);
    this.boundMove = undefined;
    this.boundUp = undefined;

    queueMicrotask(() => {
      this.recalcTableMinWidth();
      this.updateHorizontalButtons();
    });
  }

  getColWidth(key: string) {
    const col = this.dataColumns.find(c => c.key === key);
    return col?.width ?? 160;
  }

  // ===== drag reorder colunas =====
  onColDragStart(index: number, ev: DragEvent) {
    if (this.resizingKey) { ev.preventDefault(); return; }
    this.dragColIndex = index;
    ev.dataTransfer?.setData('text/plain', String(index));
    ev.dataTransfer?.setDragImage(new Image(), 0, 0);
  }

  onColDragOver(_index: number, ev: DragEvent) { ev.preventDefault(); }

  onColDrop(dropIndex: number, ev: DragEvent) {
    ev.preventDefault();
    const fromIndex = this.dragColIndex;
    if (fromIndex < 0 || fromIndex === dropIndex) return;

    const cols = [...this.dataColumns];
    const [moved] = cols.splice(fromIndex, 1);
    cols.splice(dropIndex, 0, moved);

    this.dataColumns = cols;
    this.dragColIndex = -1;

    queueMicrotask(() => {
      this.recalcTableMinWidth();
      this.updateHorizontalButtons();
    });
  }
}
