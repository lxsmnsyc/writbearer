// The game's storage in the browser's IndexedDB: the suspended run and the
// compendium, nothing else. Where IndexedDB is missing, as in tests, or
// fails, the game runs on without it.

const DB = 'writbearer';
// Each store keeps its records by key.
export const enum Store {
  Run = 'run',
  Compendium = 'compendium',
}
const STORES = [Store.Run, Store.Compendium];
// Bumped when a store is added
const DB_VERSION = 2;

async function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return null;
  }
  return new Promise((resolve) => {
    const request = indexedDB.open(DB, DB_VERSION);
    request.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!request.result.objectStoreNames.contains(name)) {
          request.result.createObjectStore(name);
        }
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      resolve(null);
    };
  });
}

async function run(
  name: Store,
  mode: IDBTransactionMode,
  act: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  const db = await open();
  if (!db) {
    return null;
  }
  return new Promise((resolve) => {
    let request: IDBRequest;
    try {
      request = act(db.transaction(name, mode).objectStore(name));
    } catch {
      resolve(null);
      db.close();
      return;
    }
    request.onsuccess = () => {
      resolve(request.result as unknown);
      db.close();
    };
    request.onerror = () => {
      resolve(null);
      db.close();
    };
  });
}

/** Reads a record, or null. What it holds is checked by the caller. */
export const readRecord = async (name: Store, key: string): Promise<unknown> =>
  run(name, 'readonly', (store) => store.get(key)).catch(() => null);

/** Writes a record over any before it, in the background. */
export function writeRecord(name: Store, key: string, value: unknown): void {
  run(name, 'readwrite', (store) => store.put(value, key)).catch(() => null);
}

/** Deletes a record, in the background. */
export function deleteRecord(name: Store, key: string): void {
  run(name, 'readwrite', (store) => store.delete(key)).catch(() => null);
}
