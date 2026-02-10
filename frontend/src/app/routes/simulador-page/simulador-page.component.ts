import { MenuOptionsComponent } from '@/components/menu-options/menu-options.component';
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { KpiCardComponent } from '@/components/kpi-card/kpi-card.component';
import { CardSimulatorComponent } from '@/components/card-simulator/card-simulator.component';
import { AuthService } from '@/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-simulador-page',
  imports: [MenuOptionsComponent, KpiCardComponent, CardSimulatorComponent],
  templateUrl: './simulador-page.component.html',
})

export class SimuladorPageComponent {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);

  user = { name: 'Usuário' };

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = this.auth.getUserName() || 'Usuário';
    }
  }
}
