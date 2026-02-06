import { Component, inject } from '@angular/core';
import { Header } from '../../components/header/header';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

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

  submitted = false;
  loading = false;
  errorMsg = '';

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit() {
    this.submitted = true;
    this.errorMsg = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    const { name, email, password } = this.form.getRawValue();

    this.api.register({ name, email, password }).subscribe({
      next: () => {
        this.loading = false;

        // ⬇️ AQUI É O LUGAR CERTO
        this.router.navigate(['/'], {
          queryParams: { email },
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Falha ao criar conta.';
      },
    });
  }

  cancel() {
    this.router.navigateByUrl('/');
  }
}
