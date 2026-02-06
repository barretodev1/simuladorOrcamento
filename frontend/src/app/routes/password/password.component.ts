import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Header } from '../../components/header/header';
import { ApiService } from '../../services/api.service';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type Step = 'email' | 'code' | 'reset';

@Component({
  standalone: true,
  selector: 'app-password',
  imports: [CommonModule, ReactiveFormsModule, Header],
  templateUrl: './password.component.html',
})
export class PasswordComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private api = inject(ApiService);

  step: Step = 'email';
  loading = false;

  errorMsg = '';
  successMsg = '';

  resetToken: string | null = null;

  form = this.fb.group(
    {
      user: [''],
      email: ['', [Validators.required, Validators.email]],
      code: [''],

      newPassword: [''],
      confirmNewPassword: [''],
    },
    { validators: [this.passwordsMatchValidator] }
  );

  get emailCtrl() { return this.form.controls['email']; }
  get codeCtrl() { return this.form.controls['code']; }
  get newPasswordCtrl() { return this.form.controls['newPassword']; }
  get confirmNewPasswordCtrl() { return this.form.controls['confirmNewPassword']; }

  private passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const np = group.get('newPassword')?.value ?? '';
    const cp = group.get('confirmNewPassword')?.value ?? '';

    // se ainda não preencheu os dois, não acusa mismatch
    if (!np || !cp) return null;

    return np === cp ? null : { passwordsMismatch: true };
  }

  async onSubmit(): Promise<void> {
    // sempre limpa feedback quando o usuário tenta avançar
    this.clearMessages();

    if (this.step === 'email') {
      this.emailCtrl.markAsTouched();
      if (this.emailCtrl.invalid) return;
      await this.sendRecoveryCode();
      return;
    }

    if (this.step === 'code') {
      this.codeCtrl.markAsTouched();
      if (this.codeCtrl.invalid) return;
      await this.verifyCode();
      return;
    }

    // step === 'reset'
    this.newPasswordCtrl.markAsTouched();
    this.confirmNewPasswordCtrl.markAsTouched();

    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: true });

    if (this.newPasswordCtrl.invalid || this.confirmNewPasswordCtrl.invalid) return;
    if (this.form.hasError('passwordsMismatch')) return;

    await this.saveNewPasswordAndGoToLogin();
  }

  onCancel(): void {
    const email = this.emailCtrl.value ?? '';
    this.resetAll();

    // "Cancelar" normalmente significa voltar
    this.router.navigate(['/'], { queryParams: email ? { email } : {} });
  }

  canSubmit(): boolean {
    if (this.loading) return false;

    if (this.step === 'email') return this.emailCtrl.valid;
    if (this.step === 'code') return this.codeCtrl.valid;

    // reset
    if (!this.newPasswordCtrl.value || !this.confirmNewPasswordCtrl.value) return false;
    if (this.newPasswordCtrl.invalid || this.confirmNewPasswordCtrl.invalid) return false;
    if (this.form.hasError('passwordsMismatch')) return false;

    return true;
  }

  private clearMessages(): void {
    this.errorMsg = '';
    this.successMsg = '';
  }

  private setStep(next: Step): void {
    this.step = next;
    this.clearMessages();

    // limpa validators dos outros steps
    this.codeCtrl.clearValidators();
    this.newPasswordCtrl.clearValidators();
    this.confirmNewPasswordCtrl.clearValidators();

    // aplica validators do step atual
    if (next === 'code') {
      this.codeCtrl.setValidators([Validators.required, Validators.minLength(4)]);
      this.codeCtrl.setValue(this.codeCtrl.value ?? ''); // mantém o valor se quiser
    }

    if (next === 'reset') {
      this.newPasswordCtrl.setValidators([Validators.required, Validators.minLength(6)]);
      this.confirmNewPasswordCtrl.setValidators([Validators.required, Validators.minLength(6)]);
    }

    // atualiza validade
    this.codeCtrl.updateValueAndValidity();
    this.newPasswordCtrl.updateValueAndValidity();
    this.confirmNewPasswordCtrl.updateValueAndValidity();
    this.form.updateValueAndValidity();
  }

  private async sendRecoveryCode(): Promise<void> {
    this.loading = true;
    try {
      const email = (this.emailCtrl.value ?? '').trim();

      await firstValueFrom(this.api.sendRecoveryCode(email));

      this.setStep('code');
      this.successMsg = 'Código enviado! Verifique seu email e digite o código abaixo.';
    } catch (err: any) {
      this.handleHttpError(err, 'send-code');
    } finally {
      this.loading = false;
    }
  }

  private async verifyCode(): Promise<void> {
    this.loading = true;
    try {
      const email = (this.emailCtrl.value ?? '').trim();
      const code = (this.codeCtrl.value ?? '').trim();

      const resp: any = await firstValueFrom(this.api.verifyRecoveryCode(email, code));

      if (!resp?.resetToken) {
        this.errorMsg = 'Não foi possível validar o código. Solicite um novo.';
        return;
      }

      this.resetToken = resp.resetToken;

      this.setStep('reset');
      this.successMsg = 'Código confirmado! Agora defina sua nova senha.';
    } catch (err: any) {
      this.handleHttpError(err, 'verify-code');
    } finally {
      this.loading = false;
    }
  }

  private async saveNewPasswordAndGoToLogin(): Promise<void> {
    this.loading = true;
    try {
      const email = (this.emailCtrl.value ?? '').trim();
      const newPassword = this.newPasswordCtrl.value ?? '';

      if (!this.resetToken) {
        this.errorMsg = 'Token de recuperação ausente. Refaça o processo.';
        this.setStep('email');
        return;
      }

      await firstValueFrom(this.api.resetPassword(email, this.resetToken, newPassword));

      // sucesso -> vai pro login com email preenchido
      await this.router.navigate(['/'], { queryParams: { email } });
    } catch (err: any) {
      this.handleHttpError(err, 'reset-password');
    } finally {
      this.loading = false;
    }
  }

  private handleHttpError(err: unknown, stage: 'send-code' | 'verify-code' | 'reset-password'): void {
    const e = err as HttpErrorResponse;
    const status = e?.status;
    const msgFromApi = (e as any)?.error?.message;

    // Mensagem do backend (se existir)
    if (msgFromApi) {
      this.errorMsg = msgFromApi;
      return;
    }

    // Fallback por status
    if (stage === 'send-code') {
      if (status === 404) {
        this.errorMsg = 'Esse email não possui conta. Crie uma conta para continuar.';
        return;
      }
      if (status === 429) {
        this.errorMsg = 'Aguarde um pouco antes de solicitar outro código.';
        return;
      }
      this.errorMsg = 'Não foi possível enviar o código. Tente novamente.';
      return;
    }

    if (stage === 'verify-code') {
      if (status === 401) {
        this.errorMsg = 'Código incorreto. Confira e tente novamente.';
        return;
      }
      if (status === 410) {
        this.errorMsg = 'Código expirado. Solicite um novo.';
        return;
      }
      if (status === 404) {
        this.errorMsg = 'Nenhum código ativo encontrado. Solicite um novo.';
        return;
      }
      if (status === 429) {
        this.errorMsg = 'Muitas tentativas. Solicite um novo código.';
        return;
      }
      this.errorMsg = 'Erro ao validar o código. Tente novamente.';
      return;
    }

    // reset-password
    if (stage === 'reset-password') {
      if (status === 401) {
        this.errorMsg = 'Token inválido/expirado. Solicite um novo código.';
        this.setStep('email');
        return;
      }
      if (status === 410) {
        this.errorMsg = 'Recuperação expirada. Solicite um novo código.';
        this.setStep('email');
        return;
      }
      this.errorMsg = 'Não foi possível alterar a senha. Tente novamente.';
      return;
    }
  }

  private resetAll(): void {
    this.step = 'email';
    this.loading = false;
    this.errorMsg = '';
    this.successMsg = '';
    this.resetToken = null;

    this.form.reset({
      user: '',
      email: '',
      code: '',
      newPassword: '',
      confirmNewPassword: '',
    });

    this.codeCtrl.clearValidators();
    this.newPasswordCtrl.clearValidators();
    this.confirmNewPasswordCtrl.clearValidators();

    this.codeCtrl.updateValueAndValidity();
    this.newPasswordCtrl.updateValueAndValidity();
    this.confirmNewPasswordCtrl.updateValueAndValidity();
    this.form.updateValueAndValidity();
  }
}
