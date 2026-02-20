import { Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MenuOptionsComponent } from '@/components/menu-options/menu-options.component';
import { KpiCardComponent } from '@/components/kpi-card/kpi-card.component';
import { AuthService } from '@/auth/auth.service';

import {
  HistoricoApiService,
  HistoryScenarioSummary,
  HistoryScenarioFull
} from './historico-api.service.component';

type MenuItem = {
  key: string;
  title: string;
  route?: string;
  imagePath: string;
};

@Component({
  selector: 'app-historico',
  standalone: true,
  imports: [MenuOptionsComponent, KpiCardComponent, CommonModule, FormsModule],
  templateUrl: './historico.component.html'
})
export class HistoricoComponent {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);
  private historyApi = inject(HistoricoApiService);

  private brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  user = { name: 'Usuário' };

  // ===== sidebar menu search
  searchTerm = '';

  menu: MenuItem[] = [
    { key: 'home', title: 'Menu Principal', route: '/simulador_de_gastos', imagePath: '/inicio.svg' },
    { key: 'history', title: 'Históricos', route: '/simulador_de_gastos/historicos', imagePath: '/history.svg' },
    { key: 'simulacao_recorrente', title: 'Recorrente', route: '/simulador_de_gastos/simulacao_recorrente', imagePath: '/calculator.svg' },
    { key: 'simulacao_medio', title: 'Cálculo Médio', route: '/simulador_de_gastos/simulacao_medio', imagePath: '/hand-coins.svg' },
    { key: 'settings', title: 'Configurações', route: '/simulador_de_gastos/configuracoes', imagePath: '/settings.svg' },
  ];

  orderedMenu: MenuItem[] = [...this.menu];

  // ===== históricos
  activeTab: 'saved' | 'deleted' = 'saved';
  typeFilter: 'all' | 'recorrente' | 'media' = 'all';

  historySearchTerm = '';
  private historySearchNorm = '';

  historyLoading = false;
  historyError = '';

  savedScenarios: HistoryScenarioSummary[] = [];
  deletedScenarios: HistoryScenarioSummary[] = [];

  // para render
  visibleScenarios: HistoryScenarioSummary[] = [];

  // ===== seleção
  selectedScenarioId: string | null = null;
  selectedScenarioLabel = '';

  // ===== KPIs (só mudam ao clicar em salvo)
  kpiHc = '—';
  kpiMonthly = '—';
  kpiAvg = '—';
  kpiAnnual = '—';

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = this.auth.getUserName() || 'Usuário';
    }

    this.onSearch();

    // se não tiver login, não tenta bater na API (rota usa requireAuth)
    if (!this.auth.isLoggedIn()) {
      this.historyError = 'Faça login para ver seus históricos.';
      this.rebuildVisibleList();
      return;
    }

    await this.refreshHistory();
  }

  // ===== menu search (sidebar)
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

  // ===== tabs / filters
  setTab(tab: 'saved' | 'deleted') {
    this.activeTab = tab;
    this.rebuildVisibleList();
  }

  setTypeFilter(filter: 'all' | 'recorrente' | 'media') {
    this.typeFilter = filter;
    this.rebuildVisibleList();
  }

  applyHistoryFilter() {
    this.historySearchNorm = this.normalize(this.historySearchTerm);
    this.rebuildVisibleList();
  }

  // ===== carregar listas
  async refreshHistory() {
    if (!this.auth.isLoggedIn()) {
      this.historyError = 'Faça login para ver seus históricos.';
      return;
    }

    this.historyLoading = true;
    this.historyError = '';

    try {
      const [active, deleted] = await Promise.all([
        this.historyApi.list('active'),
        this.historyApi.list('deleted')
      ]);

      this.savedScenarios = active || [];
      this.deletedScenarios = deleted || [];
      this.rebuildVisibleList();
    } catch (e: any) {
      this.historyError = 'Não consegui carregar os históricos. Verifique o backend.';
    } finally {
      this.historyLoading = false;
    }
  }

  private rebuildVisibleList() {
    const base = this.activeTab === 'saved' ? this.savedScenarios : this.deletedScenarios;

    const filteredByType =
      this.typeFilter === 'all'
        ? base
        : base.filter(s => s.scenarioType === this.typeFilter);

    const term = this.historySearchNorm;
    this.visibleScenarios = !term
      ? filteredByType
      : filteredByType.filter(s => this.normalize(s.name).includes(term));
  }

  // ===== clique no cenário salvo => atualiza KPIs
  async selectScenario(s: HistoryScenarioSummary) {
    this.historyError = '';
    this.selectedScenarioId = s.id;
    this.selectedScenarioLabel = `${s.name} • ${s.scenarioType === 'recorrente' ? 'Recorrente' : 'Média'}`;

    try {
      const full = await this.historyApi.get(s.id);
      this.applyScenarioToKpis(full);
    } catch {
      this.historyError = 'Não consegui carregar o cenário selecionado.';
    }
  }

  // ===== ações em deletados
  async restoreScenario(s: HistoryScenarioSummary) {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const restored = await this.historyApi.restore(s.id);

      // move da lista deletados -> salvos
      this.deletedScenarios = this.deletedScenarios.filter(x => x.id !== s.id);

      // evita duplicar
      const nextSaved = [restored, ...this.savedScenarios]
        .filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i);

      this.savedScenarios = nextSaved;
      this.rebuildVisibleList();
    } catch {
      this.historyError = 'Falha ao restaurar.';
    }
  }

  async permanentDeleteScenario(s: HistoryScenarioSummary) {
    if (!isPlatformBrowser(this.platformId)) return;

    const ok = window.confirm(`Apagar definitivamente "${s.name}"? Isso não tem volta.`);
    if (!ok) return;

    try {
      await this.historyApi.removePermanent(s.id);
      this.deletedScenarios = this.deletedScenarios.filter(x => x.id !== s.id);

      // se estava selecionado, limpa
      if (this.selectedScenarioId === s.id) this.clearSelection();

      this.rebuildVisibleList();
    } catch {
      this.historyError = 'Falha ao apagar definitivamente.';
    }
  }

  private clearSelection() {
    this.selectedScenarioId = null;
    this.selectedScenarioLabel = '';
    this.kpiHc = '—';
    this.kpiMonthly = '—';
    this.kpiAvg = '—';
    this.kpiAnnual = '—';
  }

  // ===== KPIs (espelhando lógica das suas telas)
  private applyScenarioToKpis(s: HistoryScenarioFull) {
    if (!s || !Array.isArray(s.rows)) {
      this.kpiHc = '0';
      this.kpiMonthly = this.brl.format(0);
      this.kpiAvg = this.brl.format(0);
      this.kpiAnnual = this.brl.format(0);
      return;
    }

    if (s.scenarioType === 'recorrente') {
      this.computeKpisRecorrente(s);
      return;
    }

    this.computeKpisMedia(s);
  }

  private computeKpisRecorrente(s: HistoryScenarioFull) {
    const rows = (s.rows || []) as any[];
    const hc = rows.length || 0;

    const salaryKey = String(s.salaryColumnKey || '');
    const monthsRemaining = this.getMonthsRemainingInYear(new Date());

    let baseMonthlyTotal = 0;
    let incMonthlyTotal = 0;

    for (const row of rows) {
      const baseSalary = this.parseMoneyToNumber(row?.[salaryKey]);
      if (isFinite(baseSalary) && baseSalary > 0) baseMonthlyTotal += baseSalary;

      // replica a sua lógica atual: __incMonthly = baseSalary*(1+pct/100) quando completo
      const simType = String(row?.__simType || '').trim();
      const pct = Number(row?.__percent);

      if (simType && isFinite(pct) && pct >= 0 && isFinite(baseSalary) && baseSalary > 0) {
        incMonthlyTotal += baseSalary * (1 + pct / 100);
      }
    }

    const monthlyWithSim = baseMonthlyTotal + incMonthlyTotal;

    this.kpiHc = String(hc);
    this.kpiMonthly = this.brl.format(monthlyWithSim);
    this.kpiAvg = this.brl.format(hc ? (monthlyWithSim / hc) : 0);
    this.kpiAnnual = this.brl.format(monthlyWithSim * monthsRemaining);
  }

  private computeKpisMedia(s: HistoryScenarioFull) {
    const rows = (s.rows || []) as any[];
    const baseHc = rows.length || 0;

    const salaryKey = String(s.salaryColumnKey || '');
    const areaKey = String((s as any).areaColumnKey || '');
    const roleKey = String((s as any).roleColumnKey || '');

    // base mensal
    let baseMonthly = 0;
    for (const r of rows) {
      const v = this.parseMoneyToNumber(r?.[salaryKey]);
      if (isFinite(v) && v > 0) baseMonthly += v;
    }

    // impacto HC
    const sims = Array.isArray((s as any).simulations) ? (s as any).simulations : [];
    const impactHc = sims.reduce((acc: number, sim: any) => {
      const qty = Number(sim?.qty) || 0;
      const sign = String(sim?.type) === 'DEMISSAO' ? -1 : 1;
      return acc + (qty * sign);
    }, 0);

    const finalHc = baseHc + impactHc;

    // pré-agrupa média por (area||role)
    const group: Record<string, { sum: number; count: number }> = {};

    if (areaKey && roleKey && salaryKey) {
      for (const r of rows) {
        const a = String(r?.[areaKey] ?? '').trim();
        const ro = String(r?.[roleKey] ?? '').trim();
        if (!a || !ro) continue;

        const sal = this.parseMoneyToNumber(r?.[salaryKey]);
        if (!isFinite(sal) || sal <= 0) continue;

        const k = `${a}||${ro}`;
        if (!group[k]) group[k] = { sum: 0, count: 0 };
        group[k].sum += sal;
        group[k].count += 1;
      }
    }

    // impacto mensal
    let impactMonthly = 0;

    for (const sim of sims) {
      const a = String(sim?.area ?? '').trim();
      const ro = String(sim?.role ?? '').trim();
      const qty = Number(sim?.qty) || 0;
      const sign = String(sim?.type) === 'DEMISSAO' ? -1 : 1;

      if (!a || !ro || !qty) continue;

      const k = `${a}||${ro}`;
      const g = group[k];
      const avg = g && g.count > 0 ? (g.sum / g.count) : 0;

      impactMonthly += avg * qty * sign;
    }

    const finalMonthly = baseMonthly + impactMonthly;

    this.kpiHc = String(finalHc > 0 ? finalHc : 0);
    this.kpiMonthly = this.brl.format(finalMonthly);
    this.kpiAvg = this.brl.format(finalHc > 0 ? (finalMonthly / finalHc) : 0);
    this.kpiAnnual = this.brl.format(finalMonthly * 12);
  }

  private getMonthsRemainingInYear(date: Date) {
    const month = date.getMonth() + 1;
    return 12 - month + 1;
  }

  // parser simples (pt-BR / R$ / etc.)
  private parseMoneyToNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (value == null) return NaN;

    const s = String(value).trim();
    if (!s) return NaN;

    // remove R$, espaços e separadores
    const cleaned = s
      .replace(/\s/g, '')
      .replace(/R\$/gi, '')
      .replace(/\./g, '')     // tira milhar
      .replace(/,/g, '.');    // decimal pt-br -> en

    const n = Number(cleaned);
    return isFinite(n) ? n : NaN;
  }

  private normalize(value: string) {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}