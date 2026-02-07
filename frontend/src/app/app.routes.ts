import { Routes } from '@angular/router';
import { AccountComponent } from './routes/account/account.component';
import { HomeComponent } from './routes/home/home.component';
import { SimuladorPageComponent } from './routes/simulador-page/simulador-page.component';
import { PasswordComponent } from './routes/password/password.component';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'account', component: AccountComponent },
    {
        path: 'simulador_de_gastos',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./routes/simulador-page/simulador-page.component').then(m => m.SimuladorPageComponent),
    },
    { path: 'account/password', component: PasswordComponent },
];
