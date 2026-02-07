import { Component, ViewChild, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { Header } from '../../components/header/header';
import { CardAccountt } from '../../components/card-accountt/card-account';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../auth/auth.service';

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
  private auth = inject(AuthService);

  @ViewChild(CardAccountt) card!: CardAccountt;

  loading = false; // ✅ novo

  ngAfterViewInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');

    if (email && this.card) {
      this.card.setEmail(email);
    }
  }

  onLogin(payload: { email: string; password: string }) {
    this.api.login(payload).subscribe({
      next: (res: any) => {
        this.auth.setToken(res.token);

        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') || '/simulador_de_gastos';

        this.router.navigateByUrl(returnUrl);
      },
      error: () => {
        // tratar erro
      }
    });
  }
}
