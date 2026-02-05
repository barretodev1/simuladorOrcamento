import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Header } from '../../components/header/header';
import { CardAccountt } from '../../components/card-accountt/card-account';
import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [CommonModule, RouterModule, Header, CardAccountt],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  private api = inject(ApiService);
  private router = inject(Router);

  @ViewChild(CardAccountt) card!: CardAccountt;

  onLogin(payload: { email: string; password: string }): void {
    this.api.login(payload).subscribe({
      next: () => this.router.navigate(['/simulador_de_gastos']),
      error: () => {
        // mostra erro no card
        this.card?.setInvalidCredentials();
      },
    });
  }
}
