import { Routes } from '@angular/router';
import { AccountComponent } from './routes/account/account.component';
import { HomeComponent } from './routes/home/home.component';
import { SimuladorPageComponent } from './routes/simulador-page/simulador-page.component';
import { PasswordComponent } from './routes/password/password.component';
import { authGuard } from './auth/auth.guard';
import { ResultadosComponent } from './routes/resultados/resultados.component';
import { HistoricoComponent } from './routes/historico/historico.component';
import { ConfiguracoesComponent } from './routes/configuracoes/configuracoes.component';
import { SimulacaorecorrenteComponent } from './routes/simulacaorecorrente/simulacaorecorrente.component';

export const routes: Routes = [
    { path: 'account/password', component: PasswordComponent },
    { path: '', component: HomeComponent },
    { path: 'account', component: AccountComponent },
    {
        path: 'simulador_de_gastos',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./routes/simulador-page/simulador-page.component').then(m => m.SimuladorPageComponent),
    },
    {
        path: 'simulador_de_gastos/resultados',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./routes/resultados/resultados.component').then(m => m.ResultadosComponent),
    },
    {
        path: 'simulador_de_gastos/historicos',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./routes/historico/historico.component').then(m => m.HistoricoComponent),
    },
    {
        path: 'simulador_de_gastos/configuracoes',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./routes/configuracoes/configuracoes.component').then(m => m.ConfiguracoesComponent),
    },
    {
        path: 'simulador_de_gastos/simulacao_recorrente',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./routes/simulacaorecorrente/simulacaorecorrente.component').then(m => m.SimulacaorecorrenteComponent)
    },
    {
        path: 'simulador_de_gastos/simulacao_medio',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./routes/simulacaomedia/simulacaomedia.component').then(m => m.SimulacaomediaComponent)
    }
];
