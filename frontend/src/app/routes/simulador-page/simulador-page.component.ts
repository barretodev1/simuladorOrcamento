import { MenuOptionsComponent } from '@/components/menu-options/menu-options.component';
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { KpiCardComponent } from '@/components/kpi-card/kpi-card.component';

@Component({
  standalone: true,
  selector: 'app-simulador-page',
  imports: [MenuOptionsComponent, KpiCardComponent],
  templateUrl: './simulador-page.component.html',
})
export class SimuladorPageComponent {
  private platformId = inject(PLATFORM_ID);

  user = { name: 'Usuário' };

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = localStorage.getItem('user_name') || 'Usuário';
    }
  }
}
