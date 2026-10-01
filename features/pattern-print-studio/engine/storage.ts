import type { DocFile } from "./Editor";
import type { PageSize } from "./types";
import type { DisplayUnit } from "./units";

// --- Autosave draft (IndexedDB: large enough for embedded original images) ---

const DB_NAME = "pattern-print-studio";
const STORE = "drafts";
const DRAFT_KEY = "current";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface Draft {
  savedAt: number;
  doc: DocFile;
}

export async function saveDraft(doc: DocFile): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ savedAt: Date.now(), doc } satisfies Draft, DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDraft(): Promise<Draft | null> {
  try {
    const db = await openDb();
    const draft = await new Promise<Draft | null>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(DRAFT_KEY);
      req.onsuccess = () => resolve((req.result as Draft) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return draft;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* ignore */
  }
}

// --- Page presets (editable, per browser) ---

export interface PagePreset {
  name: string;
  page: PageSize;
  units: DisplayUnit;
}

const PRESETS_KEY = "pps.pagePresets";

export const DEFAULT_PRESETS: PagePreset[] = [
  { name: "Leggings program", page: { width: 163.75, height: 37.694 }, units: "in" },
  { name: "Letter", page: { width: 8.5, height: 11 }, units: "in" },
  { name: "A4", page: { width: 210 / 25.4, height: 297 / 25.4 }, units: "mm" },
];

export function loadPresets(): PagePreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PagePreset[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PRESETS;
}

export function savePresets(presets: PagePreset[]) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /* ignore */
  }
}

// --- File save/open ---

export const DOC_EXTENSION = ".pps.json";

export function downloadText(text: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(name: string) {
  return name.trim().replace(/[^a-z0-9._ -]+/gi, "-").replace(/\s+/g, "-") || "untitled";
}
