import { Component, ViewChild, inject, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { Header } from '../../components/header/header';
import { CardAccountt } from '../../components/card-accountt/card-account';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../auth/auth.service';

type LoginResponse = {
  token?: string;
  accessToken?: string;
  access_token?: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
};

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [CommonModule, RouterModule, Header, CardAccountt],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  @ViewChild(CardAccountt) card!: CardAccountt;

  loading = false;

  // ✅ true quando chegou aqui pelo "voltar/avançar" do navegador
  private cameFromBackButton = false;

  constructor() {
    const nav = this.router.getCurrentNavigation();
    this.cameFromBackButton = nav?.trigger === 'popstate';
  }

  ngOnInit(): void {
    // ✅ Auto-ir pro simulador APENAS quando for um load "normal"
    // (abrir app / refresh / entrar pela URL), e NÃO quando for back
    if (this.auth.isLoggedIn() && !this.cameFromBackButton) {
      const returnUrl =
        this.route.snapshot.queryParamMap.get('returnUrl') || '/simulador_de_gastos';

      this.router.navigateByUrl(returnUrl);
    }
  }

  ngAfterViewInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email && this.card) {
      this.card.setEmail(email);
    }
  }

  onLogin(payload: { email: string; password: string }): void {
    if (this.loading) return;

    this.loading = true;

    this.api
      .login(payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: LoginResponse) => {
          const token = res?.token ?? res?.accessToken ?? res?.access_token;

          if (token) this.auth.setToken(token);

          // ✅ seu backend retorna res.user.name
          const userName = res?.user?.name;
          if (userName) this.auth.setUserName(userName);

          const returnUrl =
            this.route.snapshot.queryParamMap.get('returnUrl') || '/simulador_de_gastos';

          this.router.navigateByUrl(returnUrl);
        },
        error: () => {
          this.card?.setInvalidCredentials();
        },
      });
  }
}