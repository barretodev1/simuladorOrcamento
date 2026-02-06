import { Routes } from '@angular/router';
import { AccountComponent } from './routes/account/account.component';
import { HomeComponent } from './routes/home/home.component';
import { SimuladorPageComponent } from './routes/simulador-page/simulador-page.component';
import { PasswordComponent } from './routes/password/password.component';


export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'account', component: AccountComponent },
    { path: 'simulador_de_gastos', component: SimuladorPageComponent },
    { path: 'account/password', component: PasswordComponent },
];
