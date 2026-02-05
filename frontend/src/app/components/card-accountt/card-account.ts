import { Component, EventEmitter, Output, inject } from '@angular/core';
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
  private fb = inject(FormBuilder);

  @Output() loginSubmit = new EventEmitter<{ email: string; password: string }>();

  submitted = false;
  error = false; // você pode controlar do pai também, mas deixei aqui pra não quebrar nada

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    this.submitted = true;
    this.error = false;

    if (this.form.invalid) return;

    this.loginSubmit.emit(this.form.getRawValue());
  }

  reset(): void {
    this.submitted = false;
    this.error = false;
    this.form.reset();
  }

  // opcional: se o pai quiser setar erro
  setInvalidCredentials(): void {
    this.error = true;
  }
}
