import { Component, EventEmitter, Output, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-card-accountt',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './card-account.html',
})
export class CardAccountt {
  @Input() loading = false; // ✅ novo
  private fb = inject(FormBuilder);
  @Output() loginSubmit = new EventEmitter<{ email: string; password: string }>();

  submitted = false;
  error = false;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  // ✅ usado pelo HomeComponent para preencher o email vindo de /account
  setEmail(email: string): void {
    this.form.controls.email.setValue(email);
    this.form.controls.email.markAsTouched();
    this.error = false; // limpa erro visual se existir
  }

  submit(): void {
    this.submitted = true;
    this.error = false;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loginSubmit.emit(this.form.getRawValue());
  }

  reset(): void {
    this.submitted = false;
    this.error = false;
    this.form.reset();
  }

  setInvalidCredentials(): void {
    this.error = true;
  }
}
