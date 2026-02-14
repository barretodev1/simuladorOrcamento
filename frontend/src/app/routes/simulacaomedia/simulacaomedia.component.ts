import { Component, inject, PLATFORM_ID } from '@angular/core';
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

type SimulationRow = {
  area: string;
  role: string;
  type: 'ADMISSAO' | 'DEMISSAO';
  qty: number;
  avg: number;
  total: number;
  avgFormatted: string;
  totalFormatted: string;
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

  focusMode = false;

  user = { name: 'Usuário' };
  searchTerm = '';

  menu: MenuItem[] = [
    { key: 'home', title: 'Menu Principal', route: '/simulador_de_gastos', imagePath: '/inicio.svg' },
    { key: 'results', title: 'Resultados', route: '/simulador_de_gastos/resultados', imagePath: '/badge-dollar-sign.svg' },
    { key: 'history', title: 'Históricos', route: '/simulador_de_gastos/historicos', imagePath: '/history.svg' },
    { key: 'settings', title: 'Configurações', route: '/simulador_de_gastos/configuracoes', imagePath: '/settings.svg' },
  ];

  orderedMenu: MenuItem[] = [...this.menu];

  csvLoaded = false;
  headers: string[] = [];
  rows: any[] = [];

  areaColumn = '';
  roleColumn = '';
  salaryColumn = '';

  uniqueAreas: string[] = [];
  uniqueRoles: string[] = [];

  simulations: SimulationRow[] = [];

  private brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  kpiHc = '0';
  kpiMonthly = this.brl.format(0);
  kpiAvg = this.brl.format(0);
  kpiAnnual = this.brl.format(0);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = this.auth.getUserName() || 'Usuário';
    }
    this.onSearch();
  }

  toggleFocusMode() {
    this.focusMode = !this.focusMode;
  }

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

  trackByKey(_i: number, item: MenuItem) {
    return item.key;
  }

  private normalize(value: string) {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  onCsvSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

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
    };
    reader.readAsText(file);
  }

  extractUniques() {
    if (!this.areaColumn || !this.roleColumn) return;

    this.uniqueAreas = [...new Set(this.rows.map(r => r[this.areaColumn]))];
    this.uniqueRoles = [...new Set(this.rows.map(r => r[this.roleColumn]))];
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
      totalFormatted: this.brl.format(0)
    });
  }

  removeSimulation(index: number) {
    this.simulations.splice(index, 1);
    this.recalculate();
  }

  recalculate() {
    this.simulations.forEach(sim => {
      const filtered = this.rows.filter(r =>
        r[this.areaColumn] === sim.area &&
        r[this.roleColumn] === sim.role
      );

      const salaries = filtered.map(r => Number(r[this.salaryColumn]) || 0);
      const avg = salaries.length
        ? salaries.reduce((a, b) => a + b, 0) / salaries.length
        : 0;

      const total = avg * sim.qty * (sim.type === 'ADMISSAO' ? 1 : -1);

      sim.avg = avg;
      sim.total = total;
      sim.avgFormatted = this.brl.format(avg);
      sim.totalFormatted = this.brl.format(total);
    });

    this.computeKpis();
  }

  computeKpis() {
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
}
