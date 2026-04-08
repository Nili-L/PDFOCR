// db.js — IndexedDB storage for page-level text extraction results

const DB_NAME = 'pdfocr';
const DB_VERSION = 1;
const PAGES_STORE = 'pages';
const META_STORE = 'extraction';

let dbInstance = null;

export async function openDB() {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(PAGES_STORE)) {
                db.createObjectStore(PAGES_STORE, { keyPath: 'pageNumber' });
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            reject(new Error(`IndexedDB error: ${event.target.error}`));
        };
    });
}

export async function writePage(pageNumber, text, method, error = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PAGES_STORE, 'readwrite');
        tx.objectStore(PAGES_STORE).put({ pageNumber, text, method, error });
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(new Error(`Write failed: ${event.target.error}`));
    });
}

export async function readPages(startPage = 1, count = Infinity) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PAGES_STORE, 'readonly');
        const store = tx.objectStore(PAGES_STORE);
        const results = [];

        const request = store.openCursor(IDBKeyRange.lowerBound(startPage));
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && results.length < count) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = (event) => reject(new Error(`Read failed: ${event.target.error}`));
    });
}

export async function readAllPages() {
    return readPages(1, Infinity);
}

export async function writeMeta(meta) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, 'readwrite');
        tx.objectStore(META_STORE).put({ id: 'current', ...meta });
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(new Error(`Meta write failed: ${event.target.error}`));
    });
}

export async function readMeta() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, 'readonly');
        const request = tx.objectStore(META_STORE).get('current');
        request.onsuccess = (event) => resolve(event.target.result || null);
        request.onerror = (event) => reject(new Error(`Meta read failed: ${event.target.error}`));
    });
}

export async function clearAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([PAGES_STORE, META_STORE], 'readwrite');
        tx.objectStore(PAGES_STORE).clear();
        tx.objectStore(META_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(new Error(`Clear failed: ${event.target.error}`));
    });
}
