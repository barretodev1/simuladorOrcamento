import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@/auth/auth.service';

const API_BASE = 'https://simuladororcamento.onrender.com';
const ROUTE_BASE = '/simulador_de_gastos/historicos';

export type ScenarioType = 'recorrente' | 'media';

export type HistoryScenarioSummary = {
  id: string;
  name: string;
  createdAt: number;
  deletedAt?: number | null;

  fileName: string;
  activeView: 'area' | 'empresa';
  salaryColumnKey: string;

  idColumnKey?: string;
  nameColumnKey?: string;

  scenarioType: ScenarioType;
};

export type HistoryScenarioFull = HistoryScenarioSummary & {
  dataColumns?: any[];
  rows?: any[];

  areaColumnKey?: string;
  roleColumnKey?: string;

  simulations?: Array<{
    area: string;
    role: string;
    type: 'ADMISSAO' | 'DEMISSAO';
    qty: number;
  }>;
};

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
export class HistoricoApiService {
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
      try { return await res.json(); } catch { return null; }
    }
    try { return await res.text(); } catch { return null; }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.isBrowser) throw new Error('Not in browser');

    const url = `${API_BASE}${path}`;
    let res: Response;

    try {
      res = await fetch(url, { ...init, headers: this.mergeHeaders(init?.headers) });
    } catch (e: any) {
      throw new ApiHttpError(0, 'NETWORK_ERROR', String(e?.message || e), url);
    }

    if (!res.ok) {
      const body = await this.readBody(res);
      throw new ApiHttpError(res.status, res.statusText, body, url);
    }

    return (await res.json()) as T;
  }

  async list(status: 'active' | 'deleted'): Promise<HistoryScenarioSummary[]> {
    const data = await this.request<any>(`${ROUTE_BASE}?status=${encodeURIComponent(status)}`, { method: 'GET' });

    const arr: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.scenarios)
        ? data.scenarios
        : [];

    return arr.map((s: any) => ({
      ...s,
      createdAt: typeof s.createdAt === 'string' ? new Date(s.createdAt).getTime() : Number(s.createdAt),
      deletedAt: s.deletedAt ? (typeof s.deletedAt === 'string' ? new Date(s.deletedAt).getTime() : Number(s.deletedAt)) : null,
    }));
  }

  async get(id: string): Promise<HistoryScenarioFull> {
    const data = await this.request<any>(`${ROUTE_BASE}/${encodeURIComponent(id)}`, { method: 'GET' });
    const s = data?.scenario ?? data;

    return {
      ...s,
      createdAt: typeof s.createdAt === 'string' ? new Date(s.createdAt).getTime() : Number(s.createdAt),
      deletedAt: s.deletedAt ? (typeof s.deletedAt === 'string' ? new Date(s.deletedAt).getTime() : Number(s.deletedAt)) : null,
    } as HistoryScenarioFull;
  }

  async restore(id: string): Promise<HistoryScenarioSummary> {
    const data = await this.request<any>(`${ROUTE_BASE}/${encodeURIComponent(id)}/restore`, { method: 'PATCH' });
    const s = data?.scenario ?? data;

    return {
      ...s,
      createdAt: typeof s.createdAt === 'string' ? new Date(s.createdAt).getTime() : Number(s.createdAt),
    } as HistoryScenarioSummary;
  }

  async removePermanent(id: string): Promise<void> {
    await this.request<any>(`${ROUTE_BASE}/${encodeURIComponent(id)}/permanent`, { method: 'DELETE' });
  }
}