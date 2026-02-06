import { Component, ViewChild, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { Header } from '../../components/header/header';
import { CardAccountt } from '../../components/card-accountt/card-account';
import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [CommonModule, RouterModule, Header, CardAccountt],
  templateUrl: './home.component.html',
})
export class HomeComponent implements AfterViewInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @ViewChild(CardAccountt) card!: CardAccountt;

  loading = false; // ✅ novo

  ngAfterViewInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');

    if (email && this.card) {
      this.card.setEmail(email);
    }
  }

  onLogin(payload: { email: string; password: string }): void {
    if (this.loading) return; // evita duplo clique

    this.loading = true;

    this.api.login(payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => this.router.navigate(['/simulador_de_gastos']),
        error: () => {
          this.card?.setInvalidCredentials();
        },
      });
  }
}
