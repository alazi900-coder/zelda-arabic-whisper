// Translation Memory (TM) for the Quality Lab.
//
// Stores approved (original ⇆ translation) pairs in IndexedDB so that
// future scans can suggest exact / near matches and warn when a known
// source maps to an inconsistent translation.
//
// Storage: object store "tm" in DB "quality-lab". Each record:
//   { id: string (sha-1 of original), original, translation, ts, count }

const DB_NAME = "quality-lab";
const DB_VERSION = 2;
const TM_STORE = "tm";
const DICTS_STORE = "custom-dicts"; // existing PR7 store, we open the same DB

export interface TMEntry {
  id: string;
  original: string;
  translation: string;
  /** epoch ms when first added */
  createdAt: number;
  /** epoch ms when most recently confirmed */
  updatedAt: number;
  /** how many times this pair was confirmed */
  count: number;
}

function isIDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DICTS_STORE)) {
        db.createObjectStore(DICTS_STORE);
      }
      if (!db.objectStoreNames.contains(TM_STORE)) {
        const store = db.createObjectStore(TM_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(TM_STORE, mode);
    const store = tx.objectStore(TM_STORE);
    let result: T;
    Promise.resolve(fn(store))
      .then((r) => {
        result = r;
      })
      .catch(reject);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Stable hash of the original — used as the record key.
async function idOf(original: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(original));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  for (let i = 0; i < original.length; i++) h = (h * 31 + original.charCodeAt(i)) | 0;
  return `fb-${(h >>> 0).toString(16)}`;
}

const reqAsPromise = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export async function tmList(): Promise<TMEntry[]> {
  if (!isIDBAvailable()) return [];
  try {
    return await withStore("readonly", async (store) => {
      const all = await reqAsPromise(store.getAll());
      return (all as TMEntry[]).sort((a, b) => b.updatedAt - a.updatedAt);
    });
  } catch {
    return [];
  }
}

export async function tmGet(original: string): Promise<TMEntry | null> {
  if (!isIDBAvailable()) return null;
  const id = await idOf(original);
  try {
    return await withStore("readonly", async (store) => {
      const r = await reqAsPromise(store.get(id));
      return (r as TMEntry | undefined) ?? null;
    });
  } catch {
    return null;
  }
}

export async function tmUpsert(original: string, translation: string): Promise<TMEntry> {
  const id = await idOf(original);
  const now = Date.now();
  const entry: TMEntry = {
    id,
    original,
    translation,
    createdAt: now,
    updatedAt: now,
    count: 1,
  };
  if (!isIDBAvailable()) return entry;
  try {
    return await withStore("readwrite", async (store) => {
      const existing = (await reqAsPromise(store.get(id))) as TMEntry | undefined;
      const next: TMEntry = existing
        ? {
            ...existing,
            translation,
            updatedAt: now,
            count: existing.count + 1,
          }
        : entry;
      await reqAsPromise(store.put(next));
      return next;
    });
  } catch {
    return entry;
  }
}

export async function tmRemove(id: string): Promise<void> {
  if (!isIDBAvailable()) return;
  try {
    await withStore("readwrite", async (store) => {
      await reqAsPromise(store.delete(id));
    });
  } catch {
    // ignore
  }
}

export async function tmClear(): Promise<void> {
  if (!isIDBAvailable()) return;
  try {
    await withStore("readwrite", async (store) => {
      await reqAsPromise(store.clear());
    });
  } catch {
    // ignore
  }
}

export async function tmBulkUpsert(pairs: Array<{ original: string; translation: string }>): Promise<number> {
  let saved = 0;
  for (const p of pairs) {
    if (!p.original.trim() || !p.translation.trim()) continue;
    await tmUpsert(p.original, p.translation);
    saved++;
  }
  return saved;
}

export async function tmExportJSON(): Promise<string> {
  const list = await tmList();
  return JSON.stringify({ version: 1, entries: list }, null, 2);
}

export async function tmImportJSON(json: string): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return 0;
  }
  const root = parsed as { entries?: Array<{ original: string; translation: string }> };
  if (!root || !Array.isArray(root.entries)) return 0;
  return tmBulkUpsert(
    root.entries.map((e) => ({ original: e.original, translation: e.translation })),
  );
}
