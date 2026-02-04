import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { Header } from '../../components/header/header';
import { CardAccountt } from '../../components/card-accountt/card-account';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [
    CommonModule,          // *ngIf
    ReactiveFormsModule,   // formControl, ngSubmit
    RouterModule,          // routerLink
    Header,
    CardAccountt
  ],
  templateUrl: './home.component.html'
})
export class HomeComponent {}
