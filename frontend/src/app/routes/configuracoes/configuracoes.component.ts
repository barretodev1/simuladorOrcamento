import { KpiCardComponent } from '@/components/kpi-card/kpi-card.component';
import { MenuOptionsComponent } from '@/components/menu-options/menu-options.component';
import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-configuracoes',
  imports: [MenuOptionsComponent, KpiCardComponent],
  templateUrl: './configuracoes.component.html'
})

export class ConfiguracoesComponent {
  private platformId = inject(PLATFORM_ID);

  user = { name: 'Usuário' };

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = localStorage.getItem('user_name') || 'Usuário';
    }
  }
}
