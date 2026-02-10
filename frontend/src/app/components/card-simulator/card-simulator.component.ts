import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-card-simulator',
  standalone: true,
  templateUrl: './card-simulator.component.html'
})
export class CardSimulatorComponent {

  constructor(private router: Router) {}

  goToRecorrente() {
    this.router.navigate(['/simulador_de_gastos/simulacao_recorrente']);
  }

  goToMedio() {
    this.router.navigate(['/simulador_de_gastos/simulacao_medio']);
  }
}
