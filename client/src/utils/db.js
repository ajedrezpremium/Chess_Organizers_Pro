import { openDB } from 'idb';

const DB_NAME = 'chessorg-offline';
const DB_VERSION = 1;

let _db;

async function getDB() {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'url' });
        }
        if (!db.objectStoreNames.contains('queue')) {
          const store = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
          store.createIndex('status', 'status');
          store.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return _db;
}

export const offlineDB = {
  // Cache API responses
  async cachePut(url, data) {
    const db = await getDB();
    await db.put('cache', { url, data, timestamp: Date.now() });
  },
  async cacheGet(url) {
    const db = await getDB();
    return db.get('cache', url);
  },
  async cacheDelete(url) {
    const db = await getDB();
    await db.delete('cache', url);
  },
  async cacheClear() {
    const db = await getDB();
    await db.clear('cache');
  },
  async cacheKeys() {
    const db = await getDB();
    return db.getAllKeys('cache');
  },

  // Offline mutation queue
  async queueAdd(method, path, body) {
    const db = await getDB();
    return db.add('queue', {
      method,
      path,
      body: body || null,
      status: 'pending',
      createdAt: Date.now(),
      retries: 0,
    });
  },
  async queueGetAll(status) {
    const db = await getDB();
    if (status) {
      const index = db.transaction('queue').store.index('status');
      return index.getAll(status);
    }
    return db.getAll('queue');
  },
  async queueRemove(id) {
    const db = await getDB();
    await db.delete('queue', id);
  },
  async queueMarkFailed(id) {
    const db = await getDB();
    const item = await db.get('queue', id);
    if (item) {
      item.status = 'failed';
      item.retries += 1;
      await db.put('queue', item);
    }
  },
  async queueClear() {
    const db = await getDB();
    await db.clear('queue');
  },
  async queueCount(status) {
    const db = await getDB();
    const all = await db.getAll('queue');
    if (status) return all.filter((q) => q.status === status).length;
    return all.length;
  },

  // Meta
  async metaGet(key) {
    const db = await getDB();
    const item = await db.get('meta', key);
    return item ? item.value : null;
  },
  async metaSet(key, value) {
    const db = await getDB();
    await db.put('meta', { key, value });
  },
};
