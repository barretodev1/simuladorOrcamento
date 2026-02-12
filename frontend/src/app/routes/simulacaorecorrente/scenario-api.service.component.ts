import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@/auth/auth.service';
import { SavedScenario, SavedScenarioSummary } from './simulacaorecorrente.types.component';

const API_BASE = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class ScenarioApiService {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);

  private get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  private headers() {
    const token = this.auth.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } as Record<string, string>;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.isBrowser) throw new Error('Not in browser');

    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers as any) },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} - ${txt}`);
    }

    return (await res.json()) as T;
  }

  async list(): Promise<SavedScenarioSummary[]> {
    const data = await this.request<{ scenarios: SavedScenarioSummary[] }>('/scenarios', { method: 'GET' });
    // backend manda createdAt como ISO ou número dependendo; normaliza:
    return (data.scenarios || []).map(s => ({
      ...s,
      createdAt: typeof (s as any).createdAt === 'string'
        ? new Date((s as any).createdAt).getTime()
        : Number((s as any).createdAt),
    }));
  }

  async get(id: string): Promise<SavedScenario> {
    const data = await this.request<{ scenario: any }>(`/scenarios/${encodeURIComponent(id)}`, { method: 'GET' });
    const s = data.scenario;

    return {
      id: String(s.id),
      name: String(s.name),
      createdAt: Number(s.createdAt) || Date.now(),
      fileName: String(s.fileName),
      activeView: s.activeView,
      salaryColumnKey: String(s.salaryColumnKey || ''),
      idColumnKey: String(s.idColumnKey || ''),
      nameColumnKey: String(s.nameColumnKey || ''),
      dataColumns: Array.isArray(s.dataColumns) ? s.dataColumns : [],
      rows: Array.isArray(s.rows) ? s.rows : [],
    } as SavedScenario;
  }

  async upsert(scenario: SavedScenario): Promise<SavedScenarioSummary> {
    const data = await this.request<{ ok: boolean; scenario: SavedScenarioSummary }>(
      '/scenarios',
      { method: 'POST', body: JSON.stringify({ scenario }) }
    );

    const s = data.scenario as any;
    return {
      ...s,
      createdAt: typeof s.createdAt === 'string' ? new Date(s.createdAt).getTime() : Number(s.createdAt),
    };
  }

  async remove(id: string): Promise<void> {
    await this.request(`/scenarios/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
