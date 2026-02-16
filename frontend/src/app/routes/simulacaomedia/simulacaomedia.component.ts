// ... seus imports
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuOptionsComponent } from '@/components/menu-options/menu-options.component';
import { KpiCardComponent } from '@/components/kpi-card/kpi-card.component';
import { AuthService } from '@/auth/auth.service';

import { ScenarioStoreService } from '../simulacaorecorrente/scenario-store.service.component';
import { ScenarioApiService } from '../simulacaorecorrente/scenario-api.service.component';
import {
  SavedScenario,
  SavedScenarioSummary
} from '../simulacaorecorrente/simulacaorecorrente.types.component';

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

// ✅ payload completo para o "Media"
type SavedScenarioMedia = SavedScenario & {
  scenarioType: 'MEDIA';
  areaColumnKey: string;
  roleColumnKey: string;
  salaryColumnKey: string; // já existe em SavedScenario, mas aqui garantimos
  simulations: Array<{
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
export class SimulacaomediaComponent {

  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);
  private store = inject(ScenarioStoreService);
  private api = inject(ScenarioApiService);

  user = { name: 'Usuário' };

  focusMode = false;

  searchTerm = '';

  saveName = '';
  showSaveInput = false;

  savedScenarios: SavedScenarioSummary[] = [];

  menu: MenuItem[] = [
    { key: 'home', title: 'Menu Principal', route: '/simulador_de_gastos', imagePath: '/inicio.svg' },
    { key: 'results', title: 'Resultados', route: '/simulador_de_gastos/resultados', imagePath: '/badge-dollar-sign.svg' },
    { key: 'history', title: 'Históricos', route: '/simulador_de_gastos/historicos', imagePath: '/history.svg' },
    { key: 'settings', title: 'Configurações', route: '/simulador_de_gastos/configuracoes', imagePath: '/settings.svg' },
  ];

  orderedMenu: MenuItem[] = [...this.menu];

  csvLoaded = false;
  csvFileName = '';

  headers: string[] = [];
  rows: any[] = [];

  areaColumn = '';
  roleColumn = '';
  salaryColumn = '';

  uniqueAreas: string[] = [];
  areaRoleMap: Record<string, string[]> = {};

  simulations: SimulationRow[] = [];

  copiedSimulation: SimulationRow | null = null;

  private brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  kpiHc = '0';
  kpiMonthly = this.brl.format(0);
  kpiAvg = this.brl.format(0);
  kpiAnnual = this.brl.format(0);

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = this.auth.getUserName() || 'Usuário';
      this.savedScenarios = this.store.loadSummaries() || [];

      // ✅ se tiver ?saved= na URL, tenta abrir (API -> local)
      const idFromUrl = this.store.getScenarioParamFromUrl();
      if (idFromUrl) {
        await this.loadScenario(idFromUrl);
      } else if (this.auth.isLoggedIn()) {
        await this.refreshFromApi();
      }
    }

    this.onSearch();
  }

  private async refreshFromApi() {
    try {
      const list = await this.api.list();
      this.savedScenarios = list;
      this.store.saveSummaries(list);
    } catch (e) {
      // sem drama aqui; lista local já existe
      console.warn('Falha ao listar na API. Mantendo cache local.', e);
    }
  }

  toggleFocusMode() {
    this.focusMode = !this.focusMode;
  }

  onSearch() {
    const term = (this.searchTerm || '').toLowerCase();
    if (!term) {
      this.orderedMenu = [...this.menu];
      return;
    }

    this.orderedMenu = [
      ...this.menu.filter(m => m.title.toLowerCase().includes(term)),
      ...this.menu.filter(m => !m.title.toLowerCase().includes(term))
    ];
  }

  trackByKey(_i: number, item: MenuItem) {
    return item.key;
  }

  onCsvSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    this.csvFileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const lines = text.split('\n').filter(l => l.trim().length > 0);

      this.headers = lines[0].split(',').map(h => h.trim());
      this.rows = lines.slice(1).map(line => {
        const parts = line.split(',');
        const obj: any = {};
        this.headers.forEach((h, i) => obj[h] = parts[i]);
        return obj;
      });

      this.csvLoaded = true;

      // se o usuário ainda não escolheu colunas, deixa vazio; ele seleciona
      this.computeKpis();
    };

    reader.readAsText(file);
  }

  extractUniques() {
    if (!this.areaColumn || !this.roleColumn) return;

    const map: Record<string, Set<string>> = {};
    const areas = new Set<string>();

    for (const row of this.rows) {
      const area = row[this.areaColumn];
      const role = row[this.roleColumn];
      if (!area || !role) continue;

      areas.add(area);
      if (!map[area]) map[area] = new Set();
      map[area].add(role);
    }

    this.uniqueAreas = Array.from(areas);
    this.areaRoleMap = {};
    Object.keys(map).forEach(a => {
      this.areaRoleMap[a] = Array.from(map[a]);
    });

    // ✅ atualiza availableRoles das sims existentes se necessário
    this.simulations.forEach(sim => {
      sim.availableRoles = this.areaRoleMap[sim.area] || [];
      if (sim.role && !sim.availableRoles.includes(sim.role)) {
        sim.role = '';
      }
    });
  }

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

  recalculate() {
    this.simulations.forEach(sim => {
      if (!sim.area || !sim.role || !this.salaryColumn) {
        sim.avg = 0;
        sim.total = 0;
        sim.avgFormatted = this.brl.format(0);
        sim.totalFormatted = this.brl.format(0);
        return;
      }

      const filtered = this.rows.filter(r =>
        r[this.areaColumn] === sim.area &&
        r[this.roleColumn] === sim.role
      );

      const salaries = filtered.map(r => Number(r[this.salaryColumn]) || 0);
      const avg = salaries.length ? salaries.reduce((a, b) => a + b, 0) / salaries.length : 0;

      const total = avg * sim.qty * (sim.type === 'ADMISSAO' ? 1 : -1);

      sim.avg = avg;
      sim.total = total;
      sim.avgFormatted = this.brl.format(avg);
      sim.totalFormatted = this.brl.format(total);
    });

    this.computeKpis();
  }

  computeKpis() {
    if (!this.salaryColumn) return;

    const baseHc = this.rows.length;

    const impactHc = this.simulations.reduce((acc, s) =>
      acc + (s.type === 'ADMISSAO' ? s.qty : -s.qty), 0);

    const baseMonthly = this.rows.reduce((acc, r) =>
      acc + (Number(r[this.salaryColumn]) || 0), 0);

    const impactMonthly = this.simulations.reduce((acc, s) => acc + s.total, 0);

    const finalHc = baseHc + impactHc;
    const finalMonthly = baseMonthly + impactMonthly;

    this.kpiHc = String(finalHc);
    this.kpiMonthly = this.brl.format(finalMonthly);
    this.kpiAvg = this.brl.format(finalHc ? finalMonthly / finalHc : 0);
    this.kpiAnnual = this.brl.format(finalMonthly * 12);
  }

  toggleSaveInput() {
    if (!this.csvLoaded) return;
    this.showSaveInput = !this.showSaveInput;
    if (this.showSaveInput && !this.saveName) {
      this.saveName = this.csvFileName || 'Nova simulação';
    }
  }

  // ✅ SALVAR CENÁRIO COMPLETO (CSV + CONFIG + SIMULATIONS)
  async saveScenario() {
    const name = (this.saveName || '').trim();
    if (!name) return;

    // validações mínimas
    if (!this.areaColumn || !this.roleColumn || !this.salaryColumn) {
      console.warn('Selecione Área, Cargo e Salário antes de salvar.');
      return;
    }

    const scenario: SavedScenarioMedia = {
      id: this.store.makeId(),
      name,
      createdAt: Date.now(),
      fileName: this.csvFileName,
      activeView: 'area',
      salaryColumnKey: this.salaryColumn,
      idColumnKey: '',
      nameColumnKey: '',
      dataColumns: this.headers.map(h => ({ key: h, label: h, width: 160 })),
      rows: this.rows,

      // ✅ extras do MEDIA
      scenarioType: 'MEDIA',
      areaColumnKey: this.areaColumn,
      roleColumnKey: this.roleColumn,
      simulations: this.simulations.map(s => ({
        area: s.area,
        role: s.role,
        type: s.type,
        qty: Number(s.qty) || 0
      }))
    };

    // 1) sempre salva local (persistência real)
    this.store.cacheFullScenario(scenario as any);

    // 2) atualiza summaries na sidebar
    const summary: SavedScenarioSummary = {
      id: scenario.id,
      name: scenario.name,
      createdAt: scenario.createdAt,
      fileName: scenario.fileName,
      salaryColumnKey: scenario.salaryColumnKey
    } as any;

    this.savedScenarios = [summary, ...this.savedScenarios].filter(
      (x, i, arr) => arr.findIndex(y => y.id === x.id) === i
    );
    this.store.saveSummaries(this.savedScenarios);
    this.store.setScenarioParamOnUrl(scenario.id);

    this.showSaveInput = false;

    // 3) tenta API (se 401/offline, não perde nada)
    try {
      const apiSummary = await this.api.upsert(scenario as any);
      this.savedScenarios = [apiSummary, ...this.savedScenarios.filter(x => x.id !== apiSummary.id)];
      this.store.saveSummaries(this.savedScenarios);
    } catch (e) {
      console.warn('Não consegui salvar na API. Ficou salvo local.', e);
    }
  }

  // ✅ CARREGAR CENÁRIO COMPLETO (API -> local)
  async loadScenario(id: string) {
    // 1) tenta API
    try {
      const scenario = await this.api.get(id) as any;

      // cache local (pra sobreviver API cair / relogar)
      this.store.cacheFullScenario(scenario);

      this.applyLoadedScenario(scenario);
      this.store.setScenarioParamOnUrl(id);
      return;

    } catch (e) {
      console.warn('Falha API, tentando local...', e);
    }

    // 2) fallback local
    const local = this.store.loadFullScenario(id) as any;
    if (!local) return;

    this.applyLoadedScenario(local);
    this.store.setScenarioParamOnUrl(id);
  }

  private applyLoadedScenario(s: any) {
    this.csvLoaded = true;
    this.csvFileName = s.fileName || '';

    this.salaryColumn = String(s.salaryColumnKey || '');
    this.headers = Array.isArray(s.dataColumns) ? s.dataColumns.map((c: any) => c.key) : [];
    this.rows = Array.isArray(s.rows) ? s.rows : [];

    // ✅ aplica colunas do MEDIA
    this.areaColumn = String(s.areaColumnKey || '');
    this.roleColumn = String(s.roleColumnKey || '');

    // precisa reconstruir mapa área->cargos antes de montar sims
    this.extractUniques();

    // ✅ restaura simulations
    const sims = Array.isArray(s.simulations) ? s.simulations : [];
    this.simulations = sims.map((x: any) => {
      const area = String(x.area || '');
      const availableRoles = this.areaRoleMap[area] || [];
      return {
        area,
        role: String(x.role || ''),
        type: (x.type === 'DEMISSAO' ? 'DEMISSAO' : 'ADMISSAO'),
        qty: Number(x.qty) || 0,
        avg: 0,
        total: 0,
        avgFormatted: this.brl.format(0),
        totalFormatted: this.brl.format(0),
        availableRoles
      } as SimulationRow;
    });

    // recalcula tudo
    this.recalculate();
    this.computeKpis();
  }

  copyScenarioLink(id: string) {
    if (!id) return;
    const url = this.store.buildScenarioLink(id);

    if (isPlatformBrowser(this.platformId) && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      return;
    }

    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  async deleteScenario(id: string) {
    this.savedScenarios = this.savedScenarios.filter(s => s.id !== id);
    this.store.saveSummaries(this.savedScenarios);
    this.store.removeFromCache(id);

    try {
      await this.api.remove(id);
    } catch (e) {
      console.warn('API falhou. Removi local.', e);
    }
  }
}