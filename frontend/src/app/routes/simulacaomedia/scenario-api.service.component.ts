import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@/auth/auth.service';
import { SavedScenario, SavedScenarioSummary } from '../simulacaomedia/simulacaomedia.types.component';

const API_BASE = 'http://localhost:3000';
const ROUTE_BASE = '/simulacao_media';

export class ApiHttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: any,
    public url: string
  ) {
    super(`HTTP ${status} ${statusText}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ScenarioApiService {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);

  private get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  private baseHeaders(): Record<string, string> {
    const token = (this.auth.getToken() || '').trim();
    const hasToken = token && token !== 'null' && token !== 'undefined';

    return {
      'Content-Type': 'application/json',
      ...(hasToken ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private mergeHeaders(extra?: HeadersInit): Record<string, string> {
    const out: Record<string, string> = { ...this.baseHeaders() };
    if (!extra) return out;

    if (extra instanceof Headers) {
      extra.forEach((v, k) => (out[k] = v));
      return out;
    }

    if (Array.isArray(extra)) {
      extra.forEach(([k, v]) => (out[k] = v));
      return out;
    }

    Object.assign(out, extra);
    return out;
  }

  private async readBody(res: Response): Promise<any> {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        return await res.json();
      } catch {
        return null;
      }
    }

    try {
      return await res.text();
    } catch {
      return null;
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.isBrowser) throw new Error('Not in browser');

    const url = `${API_BASE}${path}`;

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: this.mergeHeaders(init?.headers),
      });
    } catch (e: any) {
      throw new ApiHttpError(0, 'NETWORK_ERROR', String(e?.message || e), url);
    }

    if (!res.ok) {
      const body = await this.readBody(res);
      throw new ApiHttpError(res.status, res.statusText, body, url);
    }

    return (await res.json()) as T;
  }

  async list(): Promise<SavedScenarioSummary[]> {
    const data = await this.request<any>(`${ROUTE_BASE}`, { method: 'GET' });

    const arr: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.scenarios)
        ? data.scenarios
        : [];

    return arr.map((s: any) => ({
      ...s,
      createdAt:
        typeof s.createdAt === 'string'
          ? new Date(s.createdAt).getTime()
          : Number(s.createdAt),
    }));
  }

  async get(id: string): Promise<SavedScenario & any> {
    const data = await this.request<any>(`${ROUTE_BASE}/${encodeURIComponent(id)}`, { method: 'GET' });
    const s = data?.scenario ?? data;

    const base: SavedScenario = {
      id: String(s.id),
      name: String(s.name),
      createdAt:
        typeof s.createdAt === 'string'
          ? new Date(s.createdAt).getTime()
          : Number(s.createdAt) || Date.now(),
      fileName: String(s.fileName || ''),
      activeView: s.activeView,
      salaryColumnKey: String(s.salaryColumnKey || ''),
      idColumnKey: String(s.idColumnKey || ''),
      nameColumnKey: String(s.nameColumnKey || ''),
      dataColumns: Array.isArray(s.dataColumns) ? s.dataColumns : [],
      rows: Array.isArray(s.rows) ? s.rows : [],
    };

    return { ...s, ...base } as any;
  }

  async upsert(scenario: SavedScenario & any): Promise<SavedScenarioSummary> {
    const body = {
      scenario: {
        ...scenario,
        scenarioType: scenario.scenarioType || 'media', // backend força, mas ok mandar
      },
    };

    const data = await this.request<any>(`${ROUTE_BASE}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const s = (data?.scenario ?? data) as any;

    return {
      ...s,
      createdAt:
        typeof s.createdAt === 'string'
          ? new Date(s.createdAt).getTime()
          : Number(s.createdAt),
    };
  }

  async remove(id: string): Promise<void> {
    await this.request(`${ROUTE_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
