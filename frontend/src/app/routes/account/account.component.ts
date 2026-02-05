import { Component } from '@angular/core';
import { Header } from '../../components/header/header';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-account',
  imports: [Header, CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './account.component.html'
})


export class AccountComponent {
  submitted = false;
  email = new FormControl('', [Validators.required, Validators.email]);
  onSubmit() {
    this.submitted = true;

    // força a validação aparecer ao clicar no botão
    this.email.markAsTouched();

    if (this.email.invalid) return;

  }
}
