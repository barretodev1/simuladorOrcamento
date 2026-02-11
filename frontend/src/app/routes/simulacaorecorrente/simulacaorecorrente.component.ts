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

type MenuItem = {
  key: string;
  title: string;
  route?: string;
  imagePath: string;
};

type ActiveView = 'area' | 'empresa';
type SimType = '' | 'MERITO' | 'PROMOCAO';

type CsvRow = {
  [key: string]: string | number | null;

  __simType: SimType;
  __percent: number | null;

  __incMonthly: number | null;
  __incMonthlyFormatted: string;

  __incAnnual: number | null;
  __incAnnualFormatted: string;

  __error: string;
};

type ColumnDef = {
  key: string;
  label: string;
  width: number;
};

type SavedScenario = {
  id: string;
  name: string;
  createdAt: number;

  fileName: string;
  activeView: ActiveView;
  salaryColumnKey: string;

  dataColumns: ColumnDef[];
  rows: CsvRow[];
};

@Component({
  selector: 'app-simulacaorecorrente',
  standalone: true,
  imports: [MenuOptionsComponent, KpiCardComponent, CommonModule, FormsModule],
  templateUrl: './simulacaorecorrente.component.html'
})
export class SimulacaorecorrenteComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);

  @ViewChild('csvInput') csvInput?: ElementRef<HTMLInputElement>;

  // ✅ único wrapper horizontal da tabela
  @ViewChild('tableWrap') tableWrap?: ElementRef<HTMLDivElement>;

  // ✅ largura dinâmica da tabela (acompanha resize/reorder)
  tableMinWidth = 1800;

  // ✅ botões (estado)
  canScrollLeft = false;
  canScrollRight = false;

  private wheelHandler?: (ev: WheelEvent) => void;

  user = { name: 'Usuário' };
  searchTerm = '';

  menu: MenuItem[] = [
    { key: 'home', title: 'Menu Principal', route: '/simulador_de_gastos', imagePath: '/inicio.svg' },
    { key: 'results', title: 'Resultados', route: '/simulador_de_gastos/resultados', imagePath: '/badge-dollar-sign.svg' },
    { key: 'history', title: 'Históricos', route: '/simulador_de_gastos/historicos', imagePath: '/history.svg' },
    { key: 'settings', title: 'Configurações', route: '/simulador_de_gastos/configuracoes', imagePath: '/settings.svg' },
  ];

  orderedMenu: MenuItem[] = [...this.menu];

  // ====== SIMULAÇÃO CSV / TABELA ======
  activeView: ActiveView = 'area';

  csvLoaded = false;
  csvFileName = '';
  csvError = '';

  dataColumns: ColumnDef[] = [];
  rows: CsvRow[] = [];
  salaryColumnKey = '';

  // ====== ✅ BUSCA POR PESSOA (ID / NOME) ======
  peopleSearchTerm = '';
  peopleSearchError = '';
  idColumnKey = '';
  nameColumnKey = '';
  filteredRows: CsvRow[] = [];

  private brl = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  monthsRemaining = this.getMonthsRemainingInYear(new Date());

  // ====== KPIs (valores já formatados) ======
  kpiHcValue = '0';
  kpiTotalMonthlyValue = this.brl.format(0);
  kpiAvgSalaryValue = this.brl.format(0);
  kpiAnnualForecastValue = this.brl.format(0);

  // resize state
  private resizingKey: string | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private boundMove?: (e: PointerEvent) => void;
  private boundUp?: () => void;

  // drag reorder state
  private dragColIndex: number = -1;

  // ====== SALVAR CENÁRIOS ======
  saveName = '';
  showSaveInput = false;
  savedScenarios: SavedScenario[] = [];
  private STORAGE_KEY = 'simulador_saved_scenarios_v1';

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = this.auth.getUserName() || 'Usuário';
      this.loadSavedScenarios();
      this.applyScenarioFromUrlIfAny();
    }

    this.onSearch();
    this.monthsRemaining = this.getMonthsRemainingInYear(new Date());
    this.computeKpis();
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    queueMicrotask(() => {
      this.recalcTableMinWidth();
      this.updateHorizontalButtons();
      this.attachWheelToHorizontal();
    });
  }

  ngOnDestroy() {
    const wrap = this.tableWrap?.nativeElement;
    if (wrap && this.wheelHandler) {
      wrap.removeEventListener('wheel', this.wheelHandler as any);
    }
  }

  // ====== Tabs ======
  setView(view: ActiveView) {
    this.activeView = view;
    this.computeKpis();

    queueMicrotask(() => {
      this.recalcTableMinWidth();
      this.updateHorizontalButtons();
    });
  }

  // ====== Busca menu ======
  onSearch() {
    const term = this.normalize(this.searchTerm);

    if (!term) {
      this.orderedMenu = [...this.menu];
      return;
    }

    const matches: MenuItem[] = [];
    const rest: MenuItem[] = [];

    for (const item of this.menu) {
      const titleNorm = this.normalize(item.title);
      if (titleNorm.includes(term)) matches.push(item);
      else rest.push(item);
    }

    this.orderedMenu = [...matches, ...rest];
  }

  trackByKey(_index: number, item: MenuItem) {
    return item.key;
  }

  // ====== CSV Import ======
  openCsvPicker() {
    this.csvInput?.nativeElement.click();
  }

  clearCsv() {
    this.csvLoaded = false;
    this.csvFileName = '';
    this.csvError = '';
    this.dataColumns = [];
    this.rows = [];
    this.salaryColumnKey = '';
    this.showSaveInput = false;
    this.saveName = '';

    const input = this.csvInput?.nativeElement;
    if (input) input.value = '';

    this.clearScenarioParamFromUrl();
    this.computeKpis();

    // reset largura
    this.tableMinWidth = 1800;

    // ✅ reset busca por pessoa
    this.peopleSearchTerm = '';
    this.peopleSearchError = '';
    this.idColumnKey = '';
    this.nameColumnKey = '';
    this.filteredRows = [];

    queueMicrotask(() => {
      this.updateHorizontalButtons();
    });
  }

  onCsvSelected(event: Event) {
    this.csvError = '';

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.csvFileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      this.loadCsvText(text);
    };
    reader.onerror = () => {
      this.csvError = 'Erro ao ler o arquivo CSV.';
      this.computeKpis();
    };

    reader.readAsText(file);
  }

  private loadCsvText(rawText: string) {
    try {
      const text = rawText.replace(/^\uFEFF/, '');
      const parsed = this.parseCsv(text);

      if (!parsed.headers.length) {
        this.csvError = 'CSV sem cabeçalho.';
        this.csvLoaded = false;
        this.computeKpis();
        return;
      }

      this.dataColumns = parsed.headers.map((h) => ({
        key: h,
        label: h,
        width: this.suggestWidth(h)
      }));

      this.rows = parsed.rows.map((obj) => ({
        ...obj,
        __simType: '',
        __percent: null,
        __incMonthly: null,
        __incMonthlyFormatted: '',
        __incAnnual: null,
        __incAnnualFormatted: '',
        __error: ''
      }));

      this.rows = this.sanitizeRowsArray(this.rows);

      const autoSalary = this.guessSalaryColumn(parsed.headers);
      this.salaryColumnKey = autoSalary || '';

      this.monthsRemaining = this.getMonthsRemainingInYear(new Date());

      this.csvLoaded = true;
      this.showSaveInput = false;
      this.saveName = '';

      // ✅ init busca por pessoa (auto-detect leve)
      this.idColumnKey = this.guessIdColumn(parsed.headers) || '';
      this.nameColumnKey = this.guessNameColumn(parsed.headers) || '';
      this.peopleSearchTerm = '';
      this.peopleSearchError = '';
      this.filteredRows = [...this.rows];

      this.recalculateAllRowsSimulations();
      this.computeKpis();

      queueMicrotask(() => {
        this.recalcTableMinWidth();
        this.updateHorizontalButtons();
      });
    } catch {
      this.csvError = 'Não consegui interpretar o CSV. Verifique se o arquivo está correto.';
      this.csvLoaded = false;
      this.computeKpis();
    }
  }

  onSalaryColumnChange() {
    this.recalculateAllRowsSimulations();
    this.computeKpis();
  }

  // ====== Simulação por linha (botão) ======
  simulateRow(row: CsvRow) {
    this.applySimulationToRow(row, { requireComplete: true });
    this.computeKpis();
  }

  // ====== Simulação por linha (auto ao mudar select/% ) ======
  onRowSimChange(row: CsvRow) {
    this.applySimulationToRow(row, { requireComplete: false });
    this.computeKpis();
  }

  private applySimulationToRow(row: CsvRow, opts: { requireComplete: boolean }) {
    row.__error = '';

    if (!this.salaryColumnKey) {
      this.clearRowSimulationNumbers(row);
      return;
    }

    const pct = Number(row.__percent);
    const hasType = !!row.__simType;
    const hasPct = isFinite(pct);

    if (!hasType || !hasPct) {
      this.clearRowSimulationNumbers(row);
      if (opts.requireComplete) {
        if (!hasType) row.__error = 'Selecione MÉRITO ou PROMOÇÃO.';
        else row.__error = 'Percentual inválido.';
      }
      return;
    }

    if (pct < 0) {
      this.clearRowSimulationNumbers(row);
      row.__error = 'Percentual inválido.';
      return;
    }

    const salaryRaw = row[this.salaryColumnKey];
    const baseSalary = this.parseMoneyToNumber(salaryRaw);

    if (!isFinite(baseSalary) || baseSalary <= 0) {
      this.clearRowSimulationNumbers(row);
      row.__error = `Salário inválido na coluna "${this.salaryColumnKey}".`;
      return;
    }

    const incMonthly = baseSalary * (pct / 100);
    const incAnnual = incMonthly * this.monthsRemaining;

    row.__incMonthly = incMonthly;
    row.__incMonthlyFormatted = this.brl.format(incMonthly);

    row.__incAnnual = incAnnual;
    row.__incAnnualFormatted = this.brl.format(incAnnual);
  }

  private clearRowSimulationNumbers(row: CsvRow) {
    row.__incMonthly = null;
    row.__incMonthlyFormatted = '';
    row.__incAnnual = null;
    row.__incAnnualFormatted = '';
  }

  private recalculateAllRowsSimulations() {
    this.monthsRemaining = this.getMonthsRemainingInYear(new Date());
    for (const r of this.rows) {
      this.applySimulationToRow(r, { requireComplete: false });
    }
  }

  private getMonthsRemainingInYear(date: Date) {
    const month = date.getMonth() + 1;
    return 12 - month + 1;
  }

  // ====== KPIs ======
  private computeKpis() {
    this.kpiHcValue = String(this.rows.length || 0);

    if (!this.csvLoaded || !this.salaryColumnKey || !this.rows.length) {
      this.kpiTotalMonthlyValue = this.brl.format(0);
      this.kpiAvgSalaryValue = this.brl.format(0);
      this.kpiAnnualForecastValue = this.brl.format(0);
      return;
    }

    let totalMonthly = 0;
    let validCount = 0;
    let incMonthlyTotal = 0;

    for (const row of this.rows) {
      const baseSalary = this.parseMoneyToNumber(row[this.salaryColumnKey]);
      if (isFinite(baseSalary) && baseSalary > 0) {
        totalMonthly += baseSalary;
        validCount++;

        const pct = Number(row.__percent);
        if (row.__simType && isFinite(pct) && pct >= 0) {
          incMonthlyTotal += baseSalary * (pct / 100);
        }
      }
    }

    const avgSalary = validCount ? (totalMonthly / validCount) : 0;

    this.monthsRemaining = this.getMonthsRemainingInYear(new Date());
    const annualForecast = (totalMonthly + incMonthlyTotal) * this.monthsRemaining;

    this.kpiTotalMonthlyValue = this.brl.format(totalMonthly);
    this.kpiAvgSalaryValue = this.brl.format(avgSalary);
    this.kpiAnnualForecastValue = this.brl.format(annualForecast);
  }

  // ====== ✅ BUSCA POR PESSOA (ID / NOME) ======
  onPeopleSearchConfigChange() {
    this.applyPeopleSearch();
  }

  applyPeopleSearch() {
    this.peopleSearchError = '';

    if (!this.csvLoaded || !this.rows.length) {
      this.filteredRows = [];
      return;
    }

    const raw = (this.peopleSearchTerm || '').trim();

    if (!raw) {
      this.filteredRows = [...this.rows];
      return;
    }

    if (!this.idColumnKey && !this.nameColumnKey) {
      this.peopleSearchError = 'Selecione pelo menos uma coluna (ID ou Nome) para buscar.';
      this.filteredRows = [...this.rows];
      return;
    }

    const termNorm = this.normalize(raw);
    const looksNumeric = /^[0-9.\-_\s]+$/.test(raw);

    this.filteredRows = this.rows.filter((r) => {
      let matchId = false;
      let matchName = false;

      if (this.idColumnKey) {
        const idVal = r[this.idColumnKey];
        const idStr = (idVal ?? '').toString().trim();

        if (looksNumeric) {
          matchId = this.normalize(idStr) === termNorm;
        } else {
          matchId = this.normalize(idStr).includes(termNorm);
        }
      }

      if (this.nameColumnKey) {
        const nameVal = r[this.nameColumnKey];
        const nameStr = (nameVal ?? '').toString();
        matchName = this.normalize(nameStr).includes(termNorm);
      }

      return matchId || matchName;
    });

    if (this.filteredRows.length === 0) {
      this.peopleSearchError = 'Nenhuma pessoa encontrada com esse termo.';
    }
  }

  clearPeopleSearch() {
    this.peopleSearchTerm = '';
    this.peopleSearchError = '';
    this.filteredRows = [...this.rows];
  }

  private guessIdColumn(headers: string[]) {
    const candidates = [
      'id', 'matricula', 'matrícula', 'codigo', 'código', 'chapa', 'employee_id', 'empid'
    ];
    for (const h of headers) {
      const n = this.normalize(h);
      if (candidates.some(c => n === this.normalize(c) || n.includes(this.normalize(c)))) return h;
    }
    return '';
  }

  private guessNameColumn(headers: string[]) {
    const candidates = [
      'nome', 'name', 'colaborador', 'funcionario', 'funcionário', 'employee', 'pessoa'
    ];
    for (const h of headers) {
      const n = this.normalize(h);
      if (candidates.some(c => n === this.normalize(c) || n.includes(this.normalize(c)))) return h;
    }
    return '';
  }

  // ====== ✅ Botões de navegação horizontal ======
  private updateHorizontalButtons() {
    const wrap = this.tableWrap?.nativeElement;
    if (!wrap) {
      this.canScrollLeft = false;
      this.canScrollRight = false;
      return;
    }

    const maxLeft = wrap.scrollWidth - wrap.clientWidth;
    const left = wrap.scrollLeft;

    this.canScrollLeft = left > 1;
    this.canScrollRight = left < maxLeft - 1;
  }

  onTableScroll() {
    this.updateHorizontalButtons();
  }

  scrollTable(direction: 'left' | 'right') {
    const wrap = this.tableWrap?.nativeElement;
    if (!wrap) return;

    const step = Math.max(260, Math.floor(wrap.clientWidth * 0.8));
    const delta = direction === 'left' ? -step : step;

    wrap.scrollBy({ left: delta, behavior: 'smooth' });

    requestAnimationFrame(() => this.updateHorizontalButtons());
  }

  scrollTableTo(edge: 'start' | 'end') {
    const wrap = this.tableWrap?.nativeElement;
    if (!wrap) return;

    const left = edge === 'start' ? 0 : (wrap.scrollWidth - wrap.clientWidth);
    wrap.scrollTo({ left, behavior: 'smooth' });

    requestAnimationFrame(() => this.updateHorizontalButtons());
  }

  // ✅ transforma wheel vertical em horizontal (sem descer a página)
  private attachWheelToHorizontal() {
    const wrap = this.tableWrap?.nativeElement;
    if (!wrap) return;

    if (this.wheelHandler) {
      wrap.removeEventListener('wheel', this.wheelHandler as any);
    }

    this.wheelHandler = (ev: WheelEvent) => {
      const mostlyVertical = Math.abs(ev.deltaY) > Math.abs(ev.deltaX);

      if (mostlyVertical && !ev.shiftKey) {
        wrap.scrollLeft += ev.deltaY;
        ev.preventDefault();
        this.updateHorizontalButtons();
      } else {
        this.updateHorizontalButtons();
      }
    };

    wrap.addEventListener('wheel', this.wheelHandler as any, { passive: false });
  }

  // ✅ calcula largura total real (colunas + extras)
  private recalcTableMinWidth() {
    const cols = this.dataColumns.reduce((acc, c) => acc + (Number(c.width) || 160), 0);

    const extraSimulacao = 176;  // w-44
    const extraPct = 160;        // w-40
    const extraMensal = 192;     // w-48
    const extraAnual = 192;      // w-48
    const extraAcao = 128;       // w-32

    const paddingPerCol = 24; // px-3
    const paddingTotal = paddingPerCol * (this.dataColumns.length + 5);

    const min = 1800;

    this.tableMinWidth = Math.max(
      min,
      cols + extraSimulacao + extraPct + extraMensal + extraAnual + extraAcao + paddingTotal
    );
  }

  // ====== Resize colunas ======
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

    const dx = ev.clientX - this.resizeStartX;
    const next = this.resizeStartWidth + dx;

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

  // ====== Drag reorder colunas ======
  onColDragStart(index: number, ev: DragEvent) {
    if (this.resizingKey) {
      ev.preventDefault();
      return;
    }

    this.dragColIndex = index;
    ev.dataTransfer?.setData('text/plain', String(index));
    ev.dataTransfer?.setDragImage(new Image(), 0, 0);
  }

  onColDragOver(_index: number, ev: DragEvent) {
    ev.preventDefault();
  }

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

  // ====== SALVAR / CARREGAR CENÁRIOS ======
  toggleSaveInput() {
    if (!this.csvLoaded) return;
    this.showSaveInput = !this.showSaveInput;
    if (this.showSaveInput && !this.saveName) {
      this.saveName = `Simulação ${new Date().toLocaleDateString('pt-BR')}`;
    }
  }

  saveScenario() {
    if (!this.csvLoaded) return;

    const name = (this.saveName || '').trim();
    if (!name) {
      this.csvError = 'Dê um nome para salvar a simulação.';
      return;
    }

    const scenario: SavedScenario = {
      id: this.makeId(),
      name,
      createdAt: Date.now(),

      fileName: this.csvFileName || 'base.csv',
      activeView: this.activeView,
      salaryColumnKey: this.salaryColumnKey,

      dataColumns: this.dataColumns.map(c => ({ ...c })),
      rows: this.rows.map(r => ({ ...r })),
    };

    this.savedScenarios = [scenario, ...this.savedScenarios].slice(0, 50);
    this.persistSavedScenarios();

    this.setScenarioParamOnUrl(scenario.id);

    this.showSaveInput = false;
  }

  loadScenario(id: string) {
    const found = this.savedScenarios.find(s => s.id === id);
    if (!found) return;

    this.csvLoaded = true;
    this.csvError = '';

    this.csvFileName = found.fileName;
    this.activeView = found.activeView;
    this.salaryColumnKey = found.salaryColumnKey;

    this.dataColumns = this.sanitizeColumnsArray(found.dataColumns);
    this.rows = this.sanitizeRowsArray(found.rows);

    this.monthsRemaining = this.getMonthsRemainingInYear(new Date());

    this.recalculateAllRowsSimulations();
    this.computeKpis();

    this.showSaveInput = false;
    this.saveName = found.name;

    this.setScenarioParamOnUrl(found.id);

    // ✅ reset/atualiza filtro
    this.peopleSearchTerm = '';
    this.peopleSearchError = '';
    this.filteredRows = [...this.rows];

    queueMicrotask(() => {
      this.recalcTableMinWidth();
      this.updateHorizontalButtons();
    });
  }

  deleteScenario(id: string) {
    this.savedScenarios = this.savedScenarios.filter(s => s.id !== id);
    this.persistSavedScenarios();

    const current = this.getScenarioParamFromUrl();
    if (current === id) {
      this.clearScenarioParamFromUrl();
    }
  }

  getScenarioLink(id: string) {
    if (!isPlatformBrowser(this.platformId)) return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?saved=${encodeURIComponent(id)}`;
  }

  async copyScenarioLink(id: string) {
    if (!isPlatformBrowser(this.platformId)) return;

    const link = this.getScenarioLink(id);
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

  private persistSavedScenarios() {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.savedScenarios));
  }

  private loadSavedScenarios() {
    try {
      if (!isPlatformBrowser(this.platformId)) return;

      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        this.savedScenarios = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.savedScenarios = parsed;
      else this.savedScenarios = [];
    } catch {
      this.savedScenarios = [];
    }
  }

  private applyScenarioFromUrlIfAny() {
    const id = this.getScenarioParamFromUrl();
    if (!id) return;
    const found = this.savedScenarios.find(s => s.id === id);
    if (found) this.loadScenario(id);
  }

  private getScenarioParamFromUrl() {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('saved');
    } catch {
      return null;
    }
  }

  private setScenarioParamOnUrl(id: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('saved', id);
      window.history.replaceState({}, '', url.toString());
    } catch { }
  }

  private clearScenarioParamFromUrl() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('saved');
      window.history.replaceState({}, '', url.toString());
    } catch { }
  }

  private makeId() {
    return 'sc_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ====== Helpers CSV ======
  private parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(l => l.trim().length > 0);

    if (!lines.length) return { headers: [], rows: [] };

    const delimiter = this.detectDelimiter(lines[0]);

    const headers = this.splitCsvLine(lines[0], delimiter).map(h => h.trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = this.splitCsvLine(lines[i], delimiter);
      const obj: Record<string, string> = {};

      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = (parts[c] ?? '').trim();
      }

      rows.push(obj);
    }

    return { headers, rows };
  }

  private detectDelimiter(headerLine: string): string {
    const comma = (headerLine.match(/,/g) || []).length;
    const semi = (headerLine.match(/;/g) || []).length;
    return semi > comma ? ';' : ',';
  }

  private splitCsvLine(line: string, delimiter: string): string[] {
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

  private suggestWidth(header: string) {
    const base = Math.max(140, header.length * 10 + 80);
    return Math.min(320, base);
  }

  private guessSalaryColumn(headers: string[]) {
    const candidates = [
      'salario', 'salário', 'salary', 'remuneracao', 'remuneração',
      'base', 'vencimento', 'pay', 'comp', 'compensation', 'salario_base'
    ];

    for (const h of headers) {
      const n = this.normalize(h);
      if (candidates.some(c => n.includes(this.normalize(c)))) {
        return h;
      }
    }
    return '';
  }

  private parseMoneyToNumber(value: string | number | null): number {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return value;

    let v = String(value).trim();
    v = v.replace(/[^\d.,-]/g, '');

    const hasComma = v.includes(',');
    const hasDot = v.includes('.');

    if (hasComma && hasDot) {
      v = v.replace(/\./g, '').replace(',', '.');
      return Number(v);
    }

    if (hasComma && !hasDot) {
      v = v.replace(',', '.');
      return Number(v);
    }

    if (hasDot && !hasComma) {
      const dots = (v.match(/\./g) || []).length;
      if (dots > 1) v = v.replace(/\./g, '');
      return Number(v);
    }

    return Number(v);
  }

  trackByRowIndex(index: number) {
    return index;
  }

  trackByColKey(_index: number, col: ColumnDef) {
    return col.key;
  }

  private normalize(value: string) {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private sanitizeRow(raw: any): CsvRow | null {
    if (!raw || typeof raw !== 'object') return null;

    const r: any = raw;

    return {
      ...r,
      __simType: (r.__simType ?? '') as SimType,
      __percent: (r.__percent === '' || r.__percent === undefined || r.__percent === null)
        ? null
        : Number(r.__percent),

      __incMonthly: (typeof r.__incMonthly === 'number') ? r.__incMonthly : null,
      __incMonthlyFormatted: (typeof r.__incMonthlyFormatted === 'string') ? r.__incMonthlyFormatted : '',

      __incAnnual: (typeof r.__incAnnual === 'number') ? r.__incAnnual : null,
      __incAnnualFormatted: (typeof r.__incAnnualFormatted === 'string') ? r.__incAnnualFormatted : '',

      __error: (typeof r.__error === 'string') ? r.__error : '',
    } as CsvRow;
  }

  private sanitizeRowsArray(arr: any): CsvRow[] {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(x => this.sanitizeRow(x))
      .filter((x): x is CsvRow => !!x);
  }

  private sanitizeColumnsArray(arr: any): ColumnDef[] {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(c => c && typeof c === 'object' && typeof c.key === 'string')
      .map(c => ({
        key: String(c.key),
        label: String(c.label ?? c.key),
        width: Number(c.width ?? 160)
      }));
  }
}
