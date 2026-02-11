import { Component, inject, PLATFORM_ID } from '@angular/core';
import { MenuOptionsComponent } from '@/components/menu-options/menu-options.component';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { KpiCardComponent } from '@/components/kpi-card/kpi-card.component';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@/auth/auth.service';

type MenuItem = {
  key: string;
  title: string;
  route?: string;
  imagePath: string;
};

@Component({
  selector: 'app-historico',
  imports: [MenuOptionsComponent, KpiCardComponent, CommonModule, FormsModule],
  templateUrl: './historico.component.html'
})
export class HistoricoComponent {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);

  user = { name: 'Usuário' };

  searchTerm = '';

  // lista fixa (sem o user)
  menu: MenuItem[] = [
    { key: 'home', title: 'Menu Principal', route: '/simulador_de_gastos', imagePath: '/inicio.svg' },
    { key: 'results', title: 'Resultados', route: '/simulador_de_gastos/resultados', imagePath: '/badge-dollar-sign.svg' },
    { key: 'history', title: 'Históricos', route: '/simulador_de_gastos/historicos', imagePath: '/history.svg' },
    { key: 'settings', title: 'Configurações', route: '/simulador_de_gastos/configuracoes', imagePath: '/settings.svg' },
  ];

  // o que vai ser renderizado (reordenado)
  orderedMenu: MenuItem[] = [...this.menu];

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = this.auth.getUserName() || 'Usuário';
    }
    this.onSearch();
  }

  onSearch() {
    const term = this.normalize(this.searchTerm);

    // sem busca: menu normal
    if (!term) {
      this.orderedMenu = [...this.menu];
      return;
    }

    // com busca: matches sobem pro topo, resto fica abaixo
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

  private normalize(value: string) {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
