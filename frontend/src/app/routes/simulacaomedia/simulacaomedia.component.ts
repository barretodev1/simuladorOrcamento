import { Component, inject, PLATFORM_ID } from '@angular/core';
import { MenuOptionsComponent } from '@/components/menu-options/menu-options.component';
import { isPlatformBrowser } from '@angular/common';
import { KpiCardComponent } from '@/components/kpi-card/kpi-card.component';

@Component({
  selector: 'app-simulacaomedia',
  imports: [MenuOptionsComponent, KpiCardComponent],
  templateUrl: './simulacaomedia.component.html'
})

export class SimulacaomediaComponent {
  private platformId = inject(PLATFORM_ID);

  user = { name: 'Usuário' };

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = localStorage.getItem('user_name') || 'Usuário';
    }
  }
}
