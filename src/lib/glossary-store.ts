// IndexedDB-backed storage for user-managed quality-lab dictionaries.
// One record per dict type, all keyed inside a single object store.
//
// Built-in dictionaries (hamza-dict.ts, ta-marbutah-dict.ts, gaming-glossary.ts,
// proper-nouns.ts) ship with the app and are read-only. The custom dicts here
// are layered ON TOP of them at scan time — they extend, never replace.

const DB_NAME = "quality-lab";
const DB_VERSION = 1;
const STORE = "custom-dicts";

export type Pair = readonly [wrong: string, right: string];

export interface ProperNounEntry {
  en: string;
  ar: string[];
  category: "character" | "place" | "item" | "race" | "concept" | "other";
}

export interface CustomDicts {
  hamza: Pair[];
  taMarbutah: Pair[];
  gaming: Pair[];
  properNouns: ProperNounEntry[];
}

export const EMPTY_DICTS: CustomDicts = {
  hamza: [],
  taMarbutah: [],
  gaming: [],
  properNouns: [],
};

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readAll(db: IDBDatabase): Promise<Partial<CustomDicts>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const out: Partial<CustomDicts> = {};
    const keys: Array<keyof CustomDicts> = ["hamza", "taMarbutah", "gaming", "properNouns"];
    let pending = keys.length;
    for (const key of keys) {
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result !== undefined) {
          (out as Record<string, unknown>)[key] = req.result;
        }
        if (--pending === 0) resolve(out);
      };
      req.onerror = () => reject(req.error);
    }
  });
}

async function writeAll(db: IDBDatabase, dicts: CustomDicts): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put(dicts.hamza, "hamza");
    store.put(dicts.taMarbutah, "taMarbutah");
    store.put(dicts.gaming, "gaming");
    store.put(dicts.properNouns, "properNouns");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadCustomDicts(): Promise<CustomDicts> {
  if (!isIndexedDbAvailable()) return EMPTY_DICTS;
  try {
    const db = await openDb();
    const partial = await readAll(db);
    db.close();
    return {
      hamza: partial.hamza ?? [],
      taMarbutah: partial.taMarbutah ?? [],
      gaming: partial.gaming ?? [],
      properNouns: partial.properNouns ?? [],
    };
  } catch {
    return EMPTY_DICTS;
  }
}

export async function saveCustomDicts(dicts: CustomDicts): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  await writeAll(db, dicts);
  db.close();
}

export async function clearCustomDicts(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function dictsTotalCount(d: CustomDicts): number {
  return d.hamza.length + d.taMarbutah.length + d.gaming.length + d.properNouns.length;
}
