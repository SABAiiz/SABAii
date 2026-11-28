// ที่เก็บข้อมูลในเครื่อง — IndexedDB เป็นหลัก ถ้าเบราว์เซอร์ไม่ให้ใช้ (โหมดส่วนตัวบางตัว) ตกไปใช้หน่วยความจำ
// แล้วแจ้งผู้ใช้ตรง ๆ ว่าปิดแอปแล้วข้อมูลจะหาย
export const DB_NAME = 'sabaii';
export const DB_VERSION = 3; // 2 = สมุดจด (books · pages) · 3 = ซิงก์ (outbox · meta)
export const STORES = ['tasks', 'subjects', 'attachments', 'prefs', 'books', 'pages'];
// ของระบบซิงก์ (ไม่ใช่ข้อมูลผู้ใช้): outbox = รายการที่ยังไม่ขึ้นคลาวด์ · meta = ตำแหน่งที่ดึงล่าสุด เจ้าของเครื่อง
export const SYNC_STORES = ['outbox', 'meta'];

function req(r) {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

export async function openIDB(idb = globalThis.indexedDB) {
  if (!idb) throw new Error('no-indexeddb');
  const r = idb.open(DB_NAME, DB_VERSION);
  r.onupgradeneeded = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('tasks')) {
      const s = db.createObjectStore('tasks', { keyPath: 'id' });
      s.createIndex('due_date', 'due_date');
      s.createIndex('subject_id', 'subject_id');
    }
    if (!db.objectStoreNames.contains('subjects')) db.createObjectStore('subjects', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('attachments')) {
      const s = db.createObjectStore('attachments', { keyPath: 'id' });
      s.createIndex('task_id', 'task_id');
    }
    if (!db.objectStoreNames.contains('prefs')) db.createObjectStore('prefs', { keyPath: 'key' });
    if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('pages')) {
      const s = db.createObjectStore('pages', { keyPath: 'id' });
      s.createIndex('book_id', 'book_id');
    }
    for (const n of SYNC_STORES) if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'key' });
  };
  const db = await req(r);
  return {
    kind: 'indexeddb',
    async all(store) { return req(db.transaction(store).objectStore(store).getAll()); },
    async put(store, value) {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      return new Promise((res, rej) => { tx.oncomplete = () => res(value); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
    },
    async del(store, key) {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    },
  };
}

/** ที่เก็บในหน่วยความจำ — ใช้ในเทสต์ และเป็นทางสำรองเมื่อ IndexedDB ใช้ไม่ได้ */
export function memoryDB() {
  const data = Object.fromEntries([...STORES, ...SYNC_STORES].map(s => [s, new Map()]));
  const key = (store, v) => store === 'prefs' || SYNC_STORES.includes(store) ? v.key : v.id;
  return {
    kind: 'memory',
    async all(store) { return [...data[store].values()].map(v => structuredClone(v)); },
    async put(store, value) { data[store].set(key(store, value), structuredClone(value)); return value; },
    async del(store, k) { data[store].delete(k); },
  };
}

export async function openBestDB() {
  try { return await openIDB(); } catch { return memoryDB(); }
}
