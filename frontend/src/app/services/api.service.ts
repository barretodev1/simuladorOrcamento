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
}
