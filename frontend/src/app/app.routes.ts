import { Routes } from '@angular/router';
import { AccountComponent } from './routes/account/account.component';
import { HomeComponent } from './routes/home/home.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'account', component: AccountComponent }
];
