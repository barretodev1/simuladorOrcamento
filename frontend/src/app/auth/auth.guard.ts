import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  // manda de volta pro login/home e guarda pra onde ele queria ir
  return router.createUrlTree(['/'], { queryParams: { returnUrl: state.url } });
};
