import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SavedScenario } from './simulacaorecorrente.types.component';

@Injectable({ providedIn: 'root' })
export class ScenarioStoreService {
  private platformId = inject(PLATFORM_ID);
  private STORAGE_KEY = 'simulador_saved_scenarios_v1';

  private get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  load(): SavedScenario[] {
    if (!this.isBrowser) return [];
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  save(list: SavedScenario[]) {
    if (!this.isBrowser) return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }

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
