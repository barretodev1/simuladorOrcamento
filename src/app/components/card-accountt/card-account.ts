import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-card-accountt',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './card-account.html'
})

// ng serve --no-ssr


export class CardAccountt {
  submitted = false;
  email = new FormControl('', [Validators.required, Validators.email]);
  onSubmit() {
    this.submitted = true;

    // força a validação aparecer ao clicar no botão
    this.email.markAsTouched();

    if (this.email.invalid) return;

  }
}