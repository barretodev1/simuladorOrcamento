import { Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuOptionsComponent } from '@/components/menu-options/menu-options.component';
import { AuthService } from '@/auth/auth.service';
import { ApiService } from '@/services/api.service';

type MenuItem = {
  key: string;
  title: string;
  route?: string;
  imagePath: string;
};

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [MenuOptionsComponent, CommonModule, FormsModule],
  templateUrl: './configuracoes.component.html',
})
export class ConfiguracoesComponent {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  // sidebar
  searchTerm = '';

  menu: MenuItem[] = [
    { key: 'home', title: 'Menu Principal', route: '/simulador_de_gastos', imagePath: '/inicio.svg' },
    { key: 'history', title: 'Históricos', route: '/simulador_de_gastos/historicos', imagePath: '/history.svg' },
    { key: 'simulacao_recorrente', title: 'Recorrente', route: '/simulador_de_gastos/simulacao_recorrente', imagePath: '/calculator.svg' },
    { key: 'simulacao_medio', title: 'Cálculo Médio', route: '/simulador_de_gastos/simulacao_medio', imagePath: '/hand-coins.svg' },
    { key: 'settings', title: 'Configurações', route: '/simulador_de_gastos/configuracoes', imagePath: '/settings.svg' },
  ];

  orderedMenu: MenuItem[] = [...this.menu];

  // user
  user = { id: '', name: 'Usuário', email: '' };

  // form perfil
  formName = '';
  formEmail = '';

  // form senha
  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';

  // ui state
  loadingMe = false;
  savingProfile = false;
  savingPassword = false;

  successMsg = '';
  errorMsg = '';

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user.name = this.auth.getUserName() || 'Usuário';
    }

    this.onSearch();
    this.loadMe();
  }

  // ===== Sidebar search =====
  onSearch() {
    const term = this.normalize(this.searchTerm);

    if (!term) {
      this.orderedMenu = [...this.menu];
      return;
    }

    const matches: MenuItem[] = [];
    const rest: MenuItem[] = [];

    for (const item of this.menu) {
      const titleNorm = this.normalize(item.title);
      if (titleNorm.includes(term)) matches.push(item);
      else rest.push(item);
    }

    this.orderedMenu = [...matches, ...rest];
  }

  trackByKey(_index: number, item: MenuItem) {
    return item.key;
  }

  private normalize(value: string) {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // ===== Settings actions =====
  private setMsg(success: string, error = '') {
    this.successMsg = success;
    this.errorMsg = error;
    if (success || error) {
      setTimeout(() => {
        this.successMsg = '';
        this.errorMsg = '';
      }, 3500);
    }
  }

  loadMe() {
    this.loadingMe = true;
    this.api.me().subscribe({
      next: (res) => {
        this.user = {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
        };
        this.formName = this.user.name;
        this.formEmail = this.user.email;

        // opcional: manter sidebar / footer atualizado
        this.user.name = res.user.name;
        this.loadingMe = false;
      },
      error: (err) => {
        this.loadingMe = false;
        // fallback: deixa o nome do AuthService mesmo
        this.setMsg('', err?.error?.message || 'Não foi possível carregar seus dados.');
      },
    });
  }

  saveProfile() {
    this.successMsg = '';
    this.errorMsg = '';

    const name = (this.formName || '').trim();
    const email = (this.formEmail || '').trim();

    if (!name) {
      this.setMsg('', 'Nome não pode ficar vazio.');
      return;
    }
    if (!email || !email.includes('@')) {
      this.setMsg('', 'Email inválido.');
      return;
    }

    this.savingProfile = true;
    this.api.updateMe({ name, email }).subscribe({
      next: (res) => {
        this.user.name = res.user.name;
        this.user.email = res.user.email;
        this.formName = res.user.name;
        this.formEmail = res.user.email;

        // se backend devolver token novo (ex: mudou email), salva
        if (typeof window !== 'undefined' && res.token) {
          localStorage.setItem('token', res.token);
        }

        // se o seu AuthService usa outro storage, ajuste aqui.
        // aqui eu tento manter o getUserName() coerente.
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('user_name', res.user.name);
          } catch {}
        }

        this.savingProfile = false;
        this.setMsg('Perfil atualizado com sucesso!');
      },
      error: (err) => {
        this.savingProfile = false;
        this.setMsg('', err?.error?.message || 'Erro ao salvar perfil.');
      },
    });
  }

  savePassword() {
    this.successMsg = '';
    this.errorMsg = '';

    if (!this.currentPassword || !this.newPassword) {
      this.setMsg('', 'Preencha senha atual e a nova senha.');
      return;
    }
    if (this.newPassword.length < 6) {
      this.setMsg('', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (this.newPassword !== this.confirmNewPassword) {
      this.setMsg('', 'A confirmação da senha não confere.');
      return;
    }

    this.savingPassword = true;
    this.api.changePassword({ currentPassword: this.currentPassword, newPassword: this.newPassword }).subscribe({
      next: () => {
        this.savingPassword = false;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmNewPassword = '';
        this.setMsg('Senha atualizada com sucesso!');
      },
      error: (err) => {
        this.savingPassword = false;
        this.setMsg('', err?.error?.message || 'Erro ao trocar senha.');
      },
    });
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auh_token');
      localStorage.removeItem('token');
      
      localStorage.removeItem('user');
      localStorage.removeItem('user_name');
    }

    // ajuste a rota do seu login se for diferente
    this.router.navigate(['/login']);
  }
}