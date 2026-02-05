import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CardAccountt } from './components/card-accountt/card-account';
// import { Cards } from './components/cards/cards';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, CardAccountt],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class App {
  protected readonly title = signal('simulador_gastos_2026');
  
}
