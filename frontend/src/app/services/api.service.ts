import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

type MeResponse = { user: { id: string; name: string; email: string } };
type UpdateMeResponse = { user: { id: string; name: string; email: string }; token?: string };

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private API_URL = 'https://simuladororcamento.onrender.com';

  // ===== helpers =====
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return (
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token')
    )
  }

  private authOptions() {
    const token = this.getToken();
    if (!token) return {};
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`,
      }),
    };
  }

  // ===== AUTH (já existentes) =====
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

  // ===== RECOVERY (já existentes) =====
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

  // ===== SETTINGS / ACCOUNT (NOVO) =====
  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.API_URL}/auth/me`, this.authOptions());
  }

  updateMe(data: { name?: string; email?: string }): Observable<UpdateMeResponse> {
    return this.http.patch<UpdateMeResponse>(`${this.API_URL}/auth/me`, data, this.authOptions());
  }

  changePassword(data: { currentPassword: string; newPassword: string }): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/change-password`, data, this.authOptions());
  }
}