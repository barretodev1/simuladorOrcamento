import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SavedScenario, SavedScenarioSummary } from './simulacaorecorrente.types.component';

type Cache = {
  summaries: SavedScenarioSummary[];
  recentFull: SavedScenario[]; // guarda os últimos abertos (pra UX)
};

@Injectable({ providedIn: 'root' })
export class ScenarioStoreService {
  private platformId = inject(PLATFORM_ID);

  private STORAGE_KEY = 'simulador_saved_scenarios_cache_v2';

  private get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  // ===== cache (opcional) =====
  loadSummaries(): SavedScenarioSummary[] {
    if (!this.isBrowser) return [];
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Cache;
      return Array.isArray(parsed?.summaries) ? parsed.summaries : [];
    } catch {
      return [];
    }
  }

  saveSummaries(list: SavedScenarioSummary[]) {
    if (!this.isBrowser) return;
    const cache = this.readCache();
    cache.summaries = Array.isArray(list) ? list : [];
    this.writeCache(cache);
  }

  cacheFullScenario(s: SavedScenario) {
    if (!this.isBrowser) return;
    const cache = this.readCache();
    const next = [s, ...(cache.recentFull || [])]
      .filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i)
      .slice(0, 5);
    cache.recentFull = next;
    this.writeCache(cache);
  }

  loadFullScenario(id: string): SavedScenario | null {
    if (!this.isBrowser) return null;
    const cache = this.readCache();
    const found = (cache.recentFull || []).find(s => s.id === id);
    return found || null;
  }

  removeFromCache(id: string) {
    if (!this.isBrowser) return;
    const cache = this.readCache();
    cache.summaries = (cache.summaries || []).filter(s => s.id !== id);
    cache.recentFull = (cache.recentFull || []).filter(s => s.id !== id);
    this.writeCache(cache);
  }

  private readCache(): Cache {
    if (!this.isBrowser) return { summaries: [], recentFull: [] };
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return { summaries: [], recentFull: [] };
      const parsed = JSON.parse(raw);
      return {
        summaries: Array.isArray(parsed?.summaries) ? parsed.summaries : [],
        recentFull: Array.isArray(parsed?.recentFull) ? parsed.recentFull : [],
      };
    } catch {
      return { summaries: [], recentFull: [] };
    }
  }

  private writeCache(cache: Cache) {
    if (!this.isBrowser) return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cache));
  }

  // ===== id + url param =====
  makeId() {
    return 'sc_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  getScenarioParamFromUrl(): string | null {
    if (!this.isBrowser) return null;
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('saved');
    } catch {
      return null;
    }
  }

  setScenarioParamOnUrl(id: string) {
    if (!this.isBrowser) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('saved', id);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }

  clearScenarioParamFromUrl() {
    if (!this.isBrowser) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('saved');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }

  buildScenarioLink(id: string) {
    if (!this.isBrowser) return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?saved=${encodeURIComponent(id)}`;
  }
}
