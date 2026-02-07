import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private API_URL = 'http://localhost:3000';

  register(data: { name: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/register`, data);
  }

  login(data: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/login`, data);
  }

    sendRegisterCode(data: { name: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/register/send-code`, data);
  }

  verifyRegisterCode(email: string, code: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/register/verify-code`, { email, code });
  }

  // ===== RECOVERY =====
  sendRecoveryCode(email: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/recovery/send-code`, { email });
  }

  verifyRecoveryCode(email: string, code: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/recovery/verify-code`, { email, code });
  }

  resetPassword(email: string, resetToken: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/recovery/reset-password`, {
      email,
      resetToken,
      newPassword,
    });
  }
}
