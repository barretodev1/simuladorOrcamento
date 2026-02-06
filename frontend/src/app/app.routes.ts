import { Routes } from '@angular/router';
import { AccountComponent } from './routes/account/account.component';
import { HomeComponent } from './routes/home/home.component';
import { SimuladorPageComponent } from './routes/simulador-page/simulador-page.component';


export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'account', component: AccountComponent },
    { path: 'simulador_de_gastos', component: SimuladorPageComponent }
];
