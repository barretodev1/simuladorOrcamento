import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);

  private API_URL = 'http://localhost:3000'; // backend

  register(data: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.API_URL}/register`, data);
  }

  login(data: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.API_URL}/login`, data);
  }
}
