import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const TOKEN_KEY = 'auth_token';
const USER_NAME_KEY = 'user_name';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  setToken(token: string) {
    if (!this.isBrowser) return;
    localStorage.setItem(TOKEN_KEY, token);
  }

  setUserName(name: string) {
    if (!this.isBrowser) return;
    localStorage.setItem(USER_NAME_KEY, name);
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  getUserName(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(USER_NAME_KEY);
  }

  logout() {
    if (!this.isBrowser) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_NAME_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
