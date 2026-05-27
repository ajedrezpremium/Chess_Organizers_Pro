import { offlineDB } from './db';

let syncing = false;

export async function addToQueue(method, path, body) {
  await offlineDB.queueAdd(method, path, body);
  // Try to sync immediately if online
  if (navigator.onLine) {
    syncQueue();
  }
  // Also try BackgroundSync if available
  if ('sync' in navigator.serviceWorker) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sync-queue');
    } catch {
      // BackgroundSync not supported, will sync on next online event
    }
  }
}

export async function syncQueue() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const items = await offlineDB.queueGetAll('pending');
    if (items.length === 0) { syncing = false; return; }

    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    for (const item of items) {
      try {
        const res = await fetch(item.path, {
          method: item.method,
          headers,
          body: item.body ? JSON.stringify(item.body) : undefined,
        });
        if (res.ok) {
          await offlineDB.queueRemove(item.id);
        } else if (item.retries >= 5 || res.status === 401 || res.status === 404) {
          await offlineDB.queueMarkFailed(item.id);
        } else {
          // Will retry on next sync
          await offlineDB.queueMarkFailed(item.id);
        }
      } catch {
        // Network error, will retry on next sync
        await offlineDB.queueMarkFailed(item.id);
      }
    }
    // Notify UI of sync completion
    window.dispatchEvent(new CustomEvent('sync-complete'));
  } finally {
    syncing = false;
  }
}

// Register online/offline listeners for auto-sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Small delay to ensure network is really back
    setTimeout(() => syncQueue(), 1000);
  });
}
