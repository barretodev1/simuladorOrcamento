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

import { ScenarioStoreService } from './scenario-store.service.component';
import { ScenarioApiService } from './scenario-api.service.component';

import {
  ActiveView,
  ColumnDef,
  CsvRow,
  MenuItem,
  SavedScenario,
  SavedScenarioSummary,
  SimType
} from './simulacaorecorrente.types.component';

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
} from './csv-helpers.component';

@Component({
  selector: 'app-simulacaorecorrente',
  standalone: true,
  imports: [MenuOptionsComponent, KpiCardComponent, CommonModule, FormsModule],
  templateUrl: './simulacaorecorrente.component.html'
})
export class SimulacaorecorrenteComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);
  private store = inject(ScenarioStoreService);
  private api = inject(ScenarioApiService);

  @ViewChild('csvInput') csvInput?: ElementRef<HTMLInputElement>;
  @ViewChild('tableWrap') tableWrap?: ElementRef<HTMLDivElement>;

  tableMinWidth = 1800;
  canScrollLeft = false;
  canScrollRight = false;

  private wheelHandler?: (ev: WheelEvent) => void;
  private wheelTarget?: HTMLElement;

  user = { name: 'Usuário' };
  searchTerm = '';

  menu: MenuItem[] = [
    { key: 'home', title: 'Menu Principal', route: '/simulador_de_gastos', imagePath: '/inicio.svg' },
    { key: 'results', title: 'Resultados', route: '/simulador_de_gastos/resultados', imagePath: '/badge-dollar-sign.svg' },
    { key: 'history', title: 'Históricos', route: '/simulador_de_gastos/historicos', imagePath: '/history.svg' },
    { key: 'settings', title: 'Configurações', route: '/simulador_de_gastos/configuracoes', imagePath: '/settings.svg' },
  ];
  orderedMenu: MenuItem[] = [...this.menu];

  activeView: ActiveView = 'area';
  csvLoaded = false;
  csvFileName = '';
  csvError = '';

  dataColumns: ColumnDef[] = [];
  rows: CsvRow[] = [];
  salaryColumnKey = '';

  peopleSearchTerm = '';
  peopleSearchError = '';
  idColumnKey = '';
  nameColumnKey = '';
  filteredRows: CsvRow[] = [];

  private brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  monthsRemaining = this.getMonthsRemainingInYear(new Date());

  kpiHcValue = '0';
  kpiTotalMonthlyValue = this.brl.format(0);
  kpiAvgSalaryValue = this.brl.format(0);
  kpiAnnualForecastValue = this.brl.format(0);

  // resize
  private resizingKey: string | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private boundMove?: (e: PointerEvent) => void;
  private boundUp?: () => void;

  // drag reorder
  private dragColIndex: number = -1;

  // salvar cenários
  saveName = '';
  showSaveInput = false;

  // lista (sidebar) vem do backend (summary)
  savedScenarios: SavedScenarioSummary[] = [];

  // cache em memória do cenário completo quando abrir
  private scenarioFullCache = new Map<string, SavedScenario>();

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = this.auth.getUserName() || 'Usuário';

      // carrega cache rápido (UX)
      this.savedScenarios = this.store.loadSummaries() || [];

      // tenta sincronizar do DB (source of truth)
      if (this.auth.isLoggedIn()) {
        await this.refreshFromApi();
        await this.loadScenarioFromUrlIfAny(); // se tiver ?saved=...
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

  private async refreshFromApi() {
    try {
      const list = await this.api.list();
      this.savedScenarios = list;
      this.store.saveSummaries(list);
    } catch {
      // se falhar, fica com o cache local
    }
  }

  private async loadScenarioFromUrlIfAny() {
    const id = this.store.getScenarioParamFromUrl();
    if (!id) return;

    // tenta abrir direto (vai buscar no backend se precisar)
    await this.loadScenario(id);
  }

  // ========== UI sync do wrap ==========
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

  // ========== Tabs ==========
  setView(view: ActiveView) {
    this.activeView = view;
    this.computeKpis();
    this.syncTableUiAfterRender();
  }

  // ========== Menu search ==========
  onSearch() {
    const term = normalize(this.searchTerm);
    if (!term) { this.orderedMenu = [...this.menu]; return; }

    const matches: MenuItem[] = [];
    const rest: MenuItem[] = [];
    for (const item of this.menu) (normalize(item.title).includes(term) ? matches : rest).push(item);
    this.orderedMenu = [...matches, ...rest];
  }
  trackByKey(_i: number, item: MenuItem) { return item.key; }

  // ========== CSV ==========
  openCsvPicker() { this.csvInput?.nativeElement.click(); }

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

    this.store.clearScenarioParamFromUrl();
    this.computeKpis();

    this.tableMinWidth = 1800;

    this.peopleSearchTerm = '';
    this.peopleSearchError = '';
    this.idColumnKey = '';
    this.nameColumnKey = '';
    this.filteredRows = [];

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

      this.rows = parsed.rows.map(obj => ({
        ...obj,
        __simType: '' as SimType,
        __percent: null,
        __incMonthly: null,
        __incMonthlyFormatted: '',
        __incAnnual: null,
        __incAnnualFormatted: '',
        __error: ''
      }));
      this.rows = sanitizeRowsArray(this.rows);

      this.salaryColumnKey = guessSalaryColumn(parsed.headers) || '';
      this.monthsRemaining = this.getMonthsRemainingInYear(new Date());

      this.csvLoaded = true;
      this.showSaveInput = false;
      this.saveName = '';

      this.idColumnKey = guessIdColumn(parsed.headers) || '';
      this.nameColumnKey = guessNameColumn(parsed.headers) || '';
      this.peopleSearchTerm = '';
      this.peopleSearchError = '';
      this.filteredRows = [...this.rows];

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
    this.recalculateAllRowsSimulations();
    this.computeKpis();
  }

  onPeopleSearchConfigChange() { this.applyPeopleSearch(); }

  // ========== Simulação ==========
  onRowSimChange(row: CsvRow) {
    this.applySimulationToRow(row, { requireComplete: false });
    this.computeKpis();
  }

  private applySimulationToRow(row: CsvRow, opts: { requireComplete: boolean }) {
    row.__error = '';

    if (!this.salaryColumnKey) { this.clearRowSimulationNumbers(row); return; }

    const pct = Number(row.__percent);
    const hasType = !!row.__simType;
    const hasPct = isFinite(pct);

    if (!hasType || !hasPct) {
      this.clearRowSimulationNumbers(row);
      if (opts.requireComplete) row.__error = !hasType ? 'Selecione MÉRITO ou PROMOÇÃO.' : 'Percentual inválido.';
      return;
    }

    if (pct < 0) { this.clearRowSimulationNumbers(row); row.__error = 'Percentual inválido.'; return; }

    const baseSalary = parseMoneyToNumber(row[this.salaryColumnKey]);
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
    for (const r of this.rows) this.applySimulationToRow(r, { requireComplete: false });
  }

  private getMonthsRemainingInYear(date: Date) {
    const month = date.getMonth() + 1;
    return 12 - month + 1;
  }

  // ========== KPIs ==========
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
      const baseSalary = parseMoneyToNumber(row[this.salaryColumnKey]);
      if (isFinite(baseSalary) && baseSalary > 0) {
        totalMonthly += baseSalary;
        validCount++;

        const pct = Number(row.__percent);
        if (row.__simType && isFinite(pct) && pct >= 0) incMonthlyTotal += baseSalary * (pct / 100);
      }
    }

    const avgSalary = validCount ? (totalMonthly / validCount) : 0;
    this.monthsRemaining = this.getMonthsRemainingInYear(new Date());
    const annualForecast = (totalMonthly + incMonthlyTotal) * this.monthsRemaining;

    this.kpiTotalMonthlyValue = this.brl.format(totalMonthly);
    this.kpiAvgSalaryValue = this.brl.format(avgSalary);
    this.kpiAnnualForecastValue = this.brl.format(annualForecast);
  }

  // ========== Busca pessoa ==========
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

  // ========== Botões scroll horizontal ==========
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

  // ========== Largura dinâmica ==========
  private recalcTableMinWidth() {
    const cols = this.dataColumns.reduce((acc, c) => acc + (Number(c.width) || 160), 0);

    const extraSimulacao = 176;
    const extraPct = 160;
    const extraMensal = 192;
    const extraAnual = 192;
    const extraAcao = 128;

    const paddingPerCol = 24;
    const paddingTotal = paddingPerCol * (this.dataColumns.length + 5);

    const min = 1800;

    this.tableMinWidth = Math.max(
      min,
      cols + extraSimulacao + extraPct + extraMensal + extraAnual + extraAcao + paddingTotal
    );
  }

  // ========== Resize colunas ==========
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

  // ========== Drag reorder ==========
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

  // ========== Salvar / carregar cenários ==========
  toggleSaveInput() {
    if (!this.csvLoaded) return;
    this.showSaveInput = !this.showSaveInput;
    if (this.showSaveInput && !this.saveName) this.saveName = `Simulação ${new Date().toLocaleDateString('pt-BR')}`;
  }

  async saveScenario() {
    if (!this.csvLoaded) return;

    const name = (this.saveName || '').trim();
    if (!name) { this.csvError = 'Dê um nome para salvar a simulação.'; return; }

    const scenarioFull: SavedScenario = {
      id: this.store.makeId(),
      name,
      createdAt: Date.now(),
      fileName: this.csvFileName || 'base.csv',
      activeView: this.activeView,
      salaryColumnKey: this.salaryColumnKey,
      idColumnKey: this.idColumnKey || '',
      nameColumnKey: this.nameColumnKey || '',
      dataColumns: this.dataColumns.map(c => ({ ...c })),
      rows: this.rows.map(r => ({ ...r })),
    };

    // cache em memória + local
    this.scenarioFullCache.set(scenarioFull.id, scenarioFull);
    this.store.cacheFullScenario(scenarioFull);

    try {
      // salva no DB
      const summary = await this.api.upsert(scenarioFull);

      // atualiza sidebar (summary)
      this.savedScenarios = [summary, ...this.savedScenarios].filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i).slice(0, 50);
      this.store.saveSummaries(this.savedScenarios);

      this.store.setScenarioParamOnUrl(summary.id);
      this.showSaveInput = false;
    } catch {
      // fallback: mantém pelo menos no cache local, mas o objetivo é salvar no DB
      this.savedScenarios = [{
        id: scenarioFull.id,
        name: scenarioFull.name,
        createdAt: scenarioFull.createdAt,
        fileName: scenarioFull.fileName,
        activeView: scenarioFull.activeView,
        salaryColumnKey: scenarioFull.salaryColumnKey,
        idColumnKey: scenarioFull.idColumnKey,
        nameColumnKey: scenarioFull.nameColumnKey,
      }, ...this.savedScenarios].slice(0, 50);

      this.store.saveSummaries(this.savedScenarios);
      this.store.setScenarioParamOnUrl(scenarioFull.id);
      this.showSaveInput = false;
    }
  }

  async loadScenario(id: string) {
    // 1) tenta cache em memória
    const mem = this.scenarioFullCache.get(id);
    if (mem) { this.applyScenario(mem); return; }

    // 2) tenta cache local (recentFull)
    const local = this.store.loadFullScenario(id);
    if (local) {
      this.scenarioFullCache.set(id, local);
      this.applyScenario(local);
      return;
    }

    // 3) busca do DB
    try {
      const scenario = await this.api.get(id);
      this.scenarioFullCache.set(id, scenario);
      this.store.cacheFullScenario(scenario);
      this.applyScenario(scenario);
    } catch {
      // se não achou, limpa param
      const current = this.store.getScenarioParamFromUrl();
      if (current === id) this.store.clearScenarioParamFromUrl();
    }
  }

  private applyScenario(found: SavedScenario) {
    this.csvLoaded = true;
    this.csvError = '';

    this.csvFileName = found.fileName;
    this.activeView = found.activeView;
    this.salaryColumnKey = found.salaryColumnKey;

    this.idColumnKey = found.idColumnKey || '';
    this.nameColumnKey = found.nameColumnKey || '';

    this.dataColumns = sanitizeColumnsArray(found.dataColumns);
    this.rows = sanitizeRowsArray(found.rows);

    this.monthsRemaining = this.getMonthsRemainingInYear(new Date());

    this.recalculateAllRowsSimulations();
    this.computeKpis();

    this.showSaveInput = false;
    this.saveName = found.name;

    this.store.setScenarioParamOnUrl(found.id);

    this.peopleSearchTerm = '';
    this.peopleSearchError = '';
    this.filteredRows = [...this.rows];

    this.syncTableUiAfterRender();
  }

  async deleteScenario(id: string) {
    // remove local UI primeiro (snappy)
    this.savedScenarios = this.savedScenarios.filter(s => s.id !== id);
    this.store.saveSummaries(this.savedScenarios);
    this.store.removeFromCache(id);
    this.scenarioFullCache.delete(id);

    try {
      await this.api.remove(id);
    } catch {
      // se falhar, a próxima sincronização vai corrigir
    }

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
}
