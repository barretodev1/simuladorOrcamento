import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SavedScenario, SavedScenarioSummary } from '../simulacaomedia/simulacaomedia.types.component';

type Cache = {
  summaries: SavedScenarioSummary[];
  recentFull: SavedScenario[]; // só UX (últimos abertos)
};

@Injectable({ providedIn: 'root' })
export class ScenarioStoreService {
  private platformId = inject(PLATFORM_ID);

  // ✅ cache “leve” (lista + recentes)
  private STORAGE_KEY = 'simulador_media_saved_scenarios_cache_v3';

  // ✅ persistência do cenário completo por id (não depende de “recentes”)
  private FULL_PREFIX = 'sg_media_scenario:'; // mantém igual ao que você usou no media

  private get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  // =========================
  // SUMMARIES (lista sidebar)
  // =========================
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

  // =========================
  // FULL SCENARIO (persistente)
  // =========================
  saveFullScenario(s: SavedScenario & any) {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(this.FULL_PREFIX + s.id, JSON.stringify(s));
    } catch {}
  }

  loadFullScenarioPersisted(id: string): (SavedScenario & any) | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(this.FULL_PREFIX + id);
      return raw ? (JSON.parse(raw) as any) : null;
    } catch {
      return null;
    }
  }

  removeFullScenarioPersisted(id: string) {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(this.FULL_PREFIX + id);
    } catch {}
  }

  // =========================
  // RECENT FULL (UX)
  // =========================
  cacheFullScenario(s: SavedScenario & any) {
    if (!this.isBrowser) return;

    // ✅ persistente por id (pra sobreviver a refresh/logout)
    this.saveFullScenario(s);

    // ✅ recente (só UX)
    const cache = this.readCache();
    const next = [s, ...(cache.recentFull || [])]
      .filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i)
      .slice(0, 5);
    cache.recentFull = next;
    this.writeCache(cache);
  }

  loadFullScenario(id: string): (SavedScenario & any) | null {
    if (!this.isBrowser) return null;

    // 1) tenta o persistente (correto)
    const persisted = this.loadFullScenarioPersisted(id);
    if (persisted) return persisted;

    // 2) fallback: recentes (UX)
    const cache = this.readCache();
    const found = (cache.recentFull || []).find(s => s.id === id);
    return found || null;
  }

  removeFromCache(id: string) {
    if (!this.isBrowser) return;

    // remove summaries + recentFull
    const cache = this.readCache();
    cache.summaries = (cache.summaries || []).filter(s => s.id !== id);
    cache.recentFull = (cache.recentFull || []).filter(s => s.id !== id);
    this.writeCache(cache);

    // remove persistente
    this.removeFullScenarioPersisted(id);
  }

  // =========================
  // CACHE IO
  // =========================
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
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cache));
    } catch {}
  }

  // =========================
  // ID + URL PARAM
  // =========================
  makeId() {
    return 'sc_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ✅ padroniza param como "saved"
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