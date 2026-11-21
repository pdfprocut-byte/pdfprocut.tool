import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const ProfileContext = createContext(null);
const archivePrefix = 'pdfpro.localArchive.v1:';
const documentDatabaseName = 'pdfpro.localArchiveFiles.v1';
const documentStoreName = 'files';
const maxSavedItems = 100;
const documentRetentionMs = 30 * 60 * 1000;
const documentExpiryCheckMs = 30 * 1000;
let documentDatabasePromise;
const seenOperationTokens = new Set();
const emptyArchive = () => ({ profile: null, history: [], documents: [] });
const archiveKey = (ownerId) => `${archivePrefix}${ownerId}`;
const newestFirst = (items, limit = maxSavedItems) => {
  const sorted = [...items].sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  return Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
};

function openDocumentDatabase() {
  if (!documentDatabasePromise) {
    documentDatabasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(documentDatabaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(documentStoreName, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open local document storage.'));
    }).catch((error) => { documentDatabasePromise = null; throw error; });
  }
  return documentDatabasePromise;
}

async function writeDocument(id, blob) {
  const database = await openDocumentDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(documentStoreName, 'readwrite');
    transaction.objectStore(documentStoreName).put({ id, blob });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not save this document in browser storage.'));
    transaction.onabort = () => reject(transaction.error || new Error('Could not save this document in browser storage.'));
  });
}

async function readDocument(id) {
  const database = await openDocumentDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(documentStoreName, 'readonly');
    const request = transaction.objectStore(documentStoreName).get(id);
    request.onsuccess = () => resolve(request.result?.blob || null);
    request.onerror = () => reject(request.error || new Error('Could not read this saved document.'));
  });
}

async function deleteDocumentFile(id) {
  const database = await openDocumentDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(documentStoreName, 'readwrite');
    transaction.objectStore(documentStoreName).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not remove this saved document.'));
    transaction.onabort = () => reject(transaction.error || new Error('Could not remove this saved document.'));
  });
}

async function deleteOwnerFiles(ownerId) {
  const database = await openDocumentDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(documentStoreName, 'readwrite');
    const store = transaction.objectStore(documentStoreName);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(`${ownerId}:`)) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not clear saved documents.'));
    transaction.onabort = () => reject(transaction.error || new Error('Could not clear saved documents.'));
  });
}

export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const ownerId = String(user?.id || user?._id || 'guest');
  const [profileData, setProfileData] = useState(emptyArchive);
  const [loadedOwnerId, setLoadedOwnerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState('');
  const [pendingToolFile, setPendingToolFileState] = useState(null);
  const keyRef = useRef(ownerId);
  const dataByOwner = useRef(new Map());
  const writesByOwner = useRef(new Map());

  useEffect(() => {
    let active = true;
    keyRef.current = ownerId;
    setLoading(true);
    setStorageError('');
    try {
      const stored = localStorage.getItem(archiveKey(ownerId));
      const parsed = stored ? JSON.parse(stored) : emptyArchive();
      const nextData = {
        profile: parsed?.profile || null,
        history: Array.isArray(parsed?.history) ? parsed.history : [],
        documents: Array.isArray(parsed?.documents) ? parsed.documents : []
      };
      dataByOwner.current.set(ownerId, nextData);
      if (active) {
        setProfileData(nextData);
        setLoadedOwnerId(ownerId);
      }
    } catch {
      const nextData = emptyArchive();
      dataByOwner.current.set(ownerId, nextData);
      if (active) {
        setProfileData(nextData);
        setLoadedOwnerId(ownerId);
        setStorageError('Browser storage is unavailable. Saved files may not persist in this browser.');
      }
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [ownerId]);

  const saveArchive = useCallback(async (nextData, accountId = ownerId) => {
    dataByOwner.current.set(accountId, nextData);
    if (keyRef.current === accountId) setProfileData(nextData);
    try {
      localStorage.setItem(archiveKey(accountId), JSON.stringify(nextData));
      if (keyRef.current === accountId) setStorageError('');
    } catch {
      if (keyRef.current === accountId) setStorageError('Browser storage is full or unavailable. Download important files to keep a separate copy.');
      throw new Error('Could not save archive details in browser storage.');
    }
  }, [ownerId]);

  const updateProfile = useCallback(async (updates) => {
    const current = dataByOwner.current.get(ownerId) || emptyArchive();
    await saveArchive({ ...current, profile: { ...(current.profile || {}), ...updates } }, ownerId);
  }, [ownerId, saveArchive]);

  const createProfile = useCallback(async ({ name, email, phone, photo }) => {
    const current = dataByOwner.current.get(ownerId) || emptyArchive();
    await saveArchive({ ...current, profile: { name: String(name || ''), email: String(email || ''), phone: String(phone || ''), photo: photo || '' } }, ownerId);
  }, [ownerId, saveArchive]);

  const recordOperation = useCallback((operation) => {
    if (operation.token && seenOperationTokens.has(operation.token)) return Promise.resolve();
    if (operation.token) {
      seenOperationTokens.add(operation.token);
      if (seenOperationTokens.size > 500) seenOperationTokens.delete(seenOperationTokens.values().next().value);
    }
    const accountId = ownerId;
    const entry = {
      id: globalThis.crypto.randomUUID(),
      tool: String(operation.tool || 'File tool'),
      outputName: String(operation.outputName || 'Completed file'),
      createdAt: new Date().toISOString(),
      documentId: null
    };
    const previousWrite = writesByOwner.current.get(accountId) || Promise.resolve();
    const nextWrite = previousWrite.catch(() => {}).then(async () => {
      const current = dataByOwner.current.get(accountId) || emptyArchive();
      let savedDocument = null;
      let operationError = '';
      if (operation.blob) {
        const id = `${accountId}:${globalThis.crypto.randomUUID()}`;
        try {
          await writeDocument(id, operation.blob);
          entry.documentId = id;
          savedDocument = { id, name: entry.outputName, type: operation.blob.type || 'application/octet-stream', size: operation.blob.size, tool: entry.tool, createdAt: entry.createdAt };
        } catch {
          operationError = 'Could not save this output in browser storage. Download it now to keep a copy.';
        }
      }
      const documents = savedDocument ? newestFirst([savedDocument, ...(current.documents || [])], Infinity) : (current.documents || []);
      const retainedIds = new Set(documents.map((document) => document.id));
      const history = newestFirst([{ ...entry }, ...(current.history || []).map((item) => item.documentId && !retainedIds.has(item.documentId) ? { ...item, documentId: null } : item)]);
      const nextData = { ...current, history, documents };
      await saveArchive(nextData, accountId);
      const evicted = (current.documents || []).filter((document) => !retainedIds.has(document.id));
      await Promise.all(evicted.map((document) => deleteDocumentFile(document.id).catch(() => {})));
      if (operationError && keyRef.current === accountId) setStorageError(operationError);
    });
    writesByOwner.current.set(accountId, nextWrite);
    return nextWrite.catch((error) => {
      if (keyRef.current === accountId) setStorageError(error.message || 'Could not save this work in browser storage.');
    });
  }, [ownerId, saveArchive]);

  const expireDocuments = useCallback(() => {
    const accountId = ownerId;
    const previousWrite = writesByOwner.current.get(accountId) || Promise.resolve();
    const nextWrite = previousWrite.catch(() => {}).then(async () => {
      const current = dataByOwner.current.get(accountId) || emptyArchive();
      const expiryTime = Date.now() - documentRetentionMs;
      const expired = (current.documents || []).filter((document) => {
        const createdAt = Date.parse(document.createdAt || '');
        return Number.isFinite(createdAt) && createdAt <= expiryTime;
      });
      if (!expired.length) return;

      const deleted = await Promise.allSettled(expired.map((document) => deleteDocumentFile(document.id)));
      const deletedIds = new Set(expired.filter((_, index) => deleted[index].status === 'fulfilled').map((document) => document.id));
      if (!deletedIds.size) {
        if (keyRef.current === accountId) setStorageError('Expired files could not be removed from browser storage.');
        return;
      }

      const nextData = {
        ...current,
        documents: current.documents.filter((document) => !deletedIds.has(document.id)),
        history: current.history.map((item) => deletedIds.has(item.documentId) ? { ...item, documentId: null } : item)
      };
      await saveArchive(nextData, accountId);
      if (deletedIds.size < expired.length && keyRef.current === accountId) {
        setStorageError('Some expired files could not be removed from browser storage.');
      }
    });
    writesByOwner.current.set(accountId, nextWrite);
    return nextWrite.catch((error) => {
      if (keyRef.current === accountId) setStorageError(error.message || 'Could not remove expired files from browser storage.');
    });
  }, [ownerId, saveArchive]);

  const downloadDocument = useCallback(async (id) => {
    const current = dataByOwner.current.get(ownerId) || emptyArchive();
    const metadata = current.documents.find((document) => document.id === id);
    if (!metadata) throw new Error('This document is no longer in the local archive.');
    const blob = await readDocument(id);
    if (!blob) throw new Error('The saved document file could not be found in browser storage.');
    return blob;
  }, [ownerId]);

  const renameDocument = useCallback(async (id, requestedName) => {
    const name = String(requestedName || '').trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 160);
    if (!name) throw new Error('Enter a document name.');
    const current = dataByOwner.current.get(ownerId) || emptyArchive();
    if (!current.documents.some((document) => document.id === id)) throw new Error('This document is no longer in the local archive.');
    const documents = current.documents.map((document) => document.id === id ? { ...document, name } : document);
    const history = current.history.map((item) => item.documentId === id ? { ...item, outputName: name } : item);
    await saveArchive({ ...current, documents, history }, ownerId);
  }, [ownerId, saveArchive]);

  const removeDocument = useCallback(async (id) => {
    const current = dataByOwner.current.get(ownerId) || emptyArchive();
    const documents = current.documents.filter((document) => document.id !== id);
    const history = current.history.map((item) => item.documentId === id ? { ...item, documentId: null } : item);
    await saveArchive({ ...current, documents, history }, ownerId);
    await deleteDocumentFile(id);
  }, [ownerId, saveArchive]);

  const clearHistory = useCallback(async () => {
    const current = dataByOwner.current.get(ownerId) || emptyArchive();
    await saveArchive({ ...current, history: [] }, ownerId);
  }, [ownerId, saveArchive]);

  const removeHistoryItem = useCallback(async (id) => {
    const current = dataByOwner.current.get(ownerId) || emptyArchive();
    await saveArchive({ ...current, history: current.history.filter((item) => item.id !== id) }, ownerId);
  }, [ownerId, saveArchive]);

  const deleteProfile = useCallback(async () => {
    await (writesByOwner.current.get(ownerId) || Promise.resolve()).catch(() => {});
    await deleteOwnerFiles(ownerId);
    localStorage.removeItem(archiveKey(ownerId));
    const nextData = emptyArchive();
    dataByOwner.current.set(ownerId, nextData);
    if (keyRef.current === ownerId) setProfileData(nextData);
    setPendingToolFileState(null);
    setStorageError('');
  }, [ownerId]);

  const lockProfile = useCallback(() => {}, []);
  const unlockProfile = useCallback(async () => {}, []);
  const dismissAccessPrompt = useCallback(() => {}, []);
  const setPendingToolFile = useCallback((file) => setPendingToolFileState(file), []);
  const clearPendingToolFile = useCallback(() => setPendingToolFileState(null), []);

  const archiveReady = loadedOwnerId === ownerId && !loading;
  const currentArchive = archiveReady ? profileData : emptyArchive();

  useEffect(() => {
    if (!archiveReady) return undefined;
    expireDocuments();
    const timer = window.setInterval(expireDocuments, documentExpiryCheckMs);
    return () => window.clearInterval(timer);
  }, [archiveReady, expireDocuments]);

  const value = useMemo(() => ({
    profile: currentArchive.profile,
    history: currentArchive.history,
    documents: currentArchive.documents,
    hasProfile: true,
    loading: !archiveReady,
    unlocked: true,
    accessPrompt: false,
    storageError,
    createProfile,
    unlockProfile,
    updateProfile,
    recordOperation,
    dismissAccessPrompt,
    lockProfile,
    deleteProfile,
    clearHistory,
    removeHistoryItem,
    downloadDocument,
    renameDocument,
    removeDocument,
    pendingToolFile,
    setPendingToolFile,
    clearPendingToolFile
  }), [currentArchive, archiveReady, storageError, createProfile, unlockProfile, updateProfile, recordOperation, dismissAccessPrompt, lockProfile, deleteProfile, clearHistory, removeHistoryItem, downloadDocument, renameDocument, removeDocument, pendingToolFile, setPendingToolFile, clearPendingToolFile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used inside ProfileProvider');
  return context;
}
