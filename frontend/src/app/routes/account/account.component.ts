import { Component, inject, PLATFORM_ID } from '@angular/core';
import { Header } from '../../components/header/header';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

type Step = 'details' | 'code';

@Component({
  standalone: true,
  selector: 'app-account',
  imports: [Header, CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './account.component.html',
})
export class AccountComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  step: Step = 'details';

  loading = false;
  errorMsg = '';
  infoMsg = '';

  pendingEmail = '';

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  private saveUserName(name: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('user_name', (name || '').trim());
    }
  }

  // 1) envia código
  onSubmit() {
    this.errorMsg = '';
    this.infoMsg = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    const { name, email, password } = this.form.getRawValue();

    this.api.sendRegisterCode({ name, email, password }).subscribe({
      next: () => {
        this.loading = false;
        this.pendingEmail = email;
        this.step = 'code';
        this.infoMsg = `Enviamos um código para ${email}.`;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Falha ao enviar o código.';
      },
    });
  }

  // 2) valida código e cria o user
  onVerifyCode() {
    this.errorMsg = '';
    this.infoMsg = '';

    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const { code } = this.codeForm.getRawValue();

    this.api.verifyRegisterCode(this.pendingEmail, code).subscribe({
      next: () => {
        this.loading = false;

        // ✅ aqui o cadastro foi confirmado -> salva o nome digitado
        const { name } = this.form.getRawValue();
        this.saveUserName(name);

        // volta pro login com email preenchido
        this.router.navigate(['/'], { queryParams: { email: this.pendingEmail } });
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Código incorreto.';
      },
    });
  }

  backToDetails() {
    this.errorMsg = '';
    this.infoMsg = '';
    this.step = 'details';
    this.codeForm.reset();
  }

  resendCode() {
    this.errorMsg = '';
    this.infoMsg = '';

    const { name, email, password } = this.form.getRawValue();

    this.loading = true;
    this.api.sendRegisterCode({ name, email, password }).subscribe({
      next: () => {
        this.loading = false;
        this.infoMsg = `Enviamos um novo código para ${email}.`;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Falha ao reenviar o código.';
      },
    });
  }

  cancel() {
    this.router.navigateByUrl('/');
  }
}
