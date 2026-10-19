import { ProjectData } from '../../types';

/**
 * C-DATA-02: Local Draft Storage via IndexedDB
 * Persists unsaved situational maps to survive accidental page refreshes.
 */
export class DraftStorage {
  private static readonly DB_NAME = 'visualmap_tactical_db';
  private static readonly STORE_NAME = 'drafts';
  private static readonly DRAFT_KEY = 'active_project_draft';

  private static openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public static async saveDraft(project: ProjectData): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.put(project, this.DRAFT_KEY);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('DraftStorage: IndexedDB not available, fallback to localStorage', e);
      try {
        localStorage.setItem(this.DRAFT_KEY, JSON.stringify(project));
      } catch {}
    }
  }

  public static async loadDraft(): Promise<ProjectData | null> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.get(this.DRAFT_KEY);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('DraftStorage: fallback reading localStorage', e);
      try {
        const s = localStorage.getItem(this.DRAFT_KEY);
        return s ? JSON.parse(s) : null;
      } catch {
        return null;
      }
    }
  }

  public static async clearDraft(): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      tx.objectStore(this.STORE_NAME).delete(this.DRAFT_KEY);
      localStorage.removeItem(this.DRAFT_KEY);
    } catch {}
  }
}
