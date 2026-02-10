import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-menu-options',
  standalone: true,
  imports: [],
  templateUrl: './menu-options.component.html',
})
export class MenuOptionsComponent {
  @Input() imagePath!: string;
  @Input() title!: string;

  // rota destino (ex: '/simulador_de_gastos' ou '/simulador_de_gastos/resultados')
  @Input() route!: string;

  constructor(private router: Router) {}

  go() {
    if (!this.route) return;
    this.router.navigateByUrl(this.route);
  }
}
