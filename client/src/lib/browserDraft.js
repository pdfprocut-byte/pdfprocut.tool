import { useEffect, useRef, useState } from 'react';

const DATABASE_NAME = 'pdfprocut-browser-drafts';
const STORE_NAME = 'drafts';
const DRAFT_TTL_MS = 3 * 60 * 1000;
let databasePromise;

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Browser storage is unavailable'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open browser storage'));
    });
  }
  return databasePromise;
}

function readValue(database, key) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not read saved work'));
  });
}

function writeValues(database, values, deletions = []) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    Object.entries(values).forEach(([key, value]) => store.put(value, key));
    deletions.forEach((key) => store.delete(key));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not save work'));
    transaction.onabort = () => reject(transaction.error || new Error('Could not save work'));
  });
}

function fileIdentity(file) {
  return file ? `${file.name}:${file.size}:${file.lastModified}:${file.type}` : '';
}

export function browserDraftAssetIdentity(files = [], signature = null) {
  return `${files.map(fileIdentity).join('|')}::${fileIdentity(signature)}`;
}

export async function readBrowserDraft(key) {
  const database = await openDatabase();
  const [state, assets, savedAt] = await Promise.all([
    readValue(database, `${key}:state`),
    readValue(database, `${key}:assets`),
    readValue(database, `${key}:savedAt`)
  ]);
  if (state && Number.isFinite(savedAt) && Date.now() - savedAt > DRAFT_TTL_MS) {
    await writeValues(database, {}, [`${key}:state`, `${key}:assets`, `${key}:savedAt`]);
    return { state: null, files: [], signature: null };
  }
  if (state && !Number.isFinite(savedAt)) {
    await writeValues(database, { [`${key}:savedAt`]: Date.now() });
  }
  return { state: state || null, files: assets?.files || [], signature: assets?.signature || null };
}

export async function writeBrowserDraft(key, { state, files = [], signature = null }, saveAssets = true) {
  const database = await openDatabase();
  const values = { [`${key}:state`]: state, [`${key}:savedAt`]: Date.now() };
  if (saveAssets) values[`${key}:assets`] = { files, signature };
  await writeValues(database, values);
}

export function useBrowserDraft(key, draft, onRestore, enabled = true) {
  const [ready, setReady] = useState(!enabled);
  const [status, setStatus] = useState('');
  const currentRef = useRef(draft);
  const restoreRef = useRef(onRestore);
  const savedAssetsRef = useRef(null);
  const stateIdentity = JSON.stringify(draft.state ?? {});
  const assetsIdentity = browserDraftAssetIdentity(draft.files, draft.signature);
  currentRef.current = draft;
  restoreRef.current = onRestore;

  useEffect(() => {
    if (!enabled || !key) { setReady(true); return undefined; }
    let active = true;
    setReady(false);
    readBrowserDraft(key).then((saved) => {
      if (!active) return;
      savedAssetsRef.current = browserDraftAssetIdentity(saved.files, saved.signature);
      if (saved.state) restoreRef.current?.(saved);
      setStatus(saved.state ? 'Saved on this device for 3 minutes' : '');
    }).catch(() => {
      if (active) setStatus('Autosave unavailable');
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || !key || !ready) return undefined;
    const timer = window.setTimeout(async () => {
      const snapshot = currentRef.current;
      const assetIdentity = browserDraftAssetIdentity(snapshot.files, snapshot.signature);
      setStatus('Saving…');
      try {
        const shouldSaveAssets = savedAssetsRef.current !== assetIdentity;
        await writeBrowserDraft(key, snapshot, shouldSaveAssets);
        if (shouldSaveAssets) savedAssetsRef.current = assetIdentity;
        setStatus('Saved on this device for 3 minutes');
      } catch {
        setStatus('Autosave unavailable');
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [key, enabled, ready, stateIdentity, assetsIdentity]);

  useEffect(() => {
    if (!enabled || !key) return undefined;
    const flush = () => {
      if (!ready) return;
      const snapshot = currentRef.current;
      const assetIdentity = browserDraftAssetIdentity(snapshot.files, snapshot.signature);
      writeBrowserDraft(key, snapshot, savedAssetsRef.current !== assetIdentity).catch(() => {});
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [key, enabled, ready]);

  return { ready, status };
}
