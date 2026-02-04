import { Component } from '@angular/core';
import { Header } from '../../components/header/header';
import { CardAccountt } from '../../components/card-accountt/card-account';

@Component({
  standalone: true,
  selector: 'app-account',
  imports: [Header, CardAccountt],
  templateUrl: './account.component.html'
})
export class AccountComponent {

}
