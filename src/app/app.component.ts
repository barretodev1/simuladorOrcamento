import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './components/header/header';
import { CardAccountt } from './components/card-accountt/card-account';
// import { Cards } from './components/cards/cards';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, CardAccountt],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class App {
  protected readonly title = signal('simulador_gastos_2026');
  
}
