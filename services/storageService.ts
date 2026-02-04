
import { db } from './firebaseConfig';
import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  query, 
  orderBy, 
  writeBatch,
  onSnapshot,
  deleteDoc,
  updateDoc,
  FirestoreError,
  Unsubscribe
} from 'firebase/firestore';
import { AuditRecord, MasterItem, MasterLocation, LocationState, LocationStatusType } from '../types';

const COLLECTIONS = {
  MASTER_DATA: 'master_data',
  AUDIT_LOGS: 'audit_logs',
  MASTER_LOCATIONS: 'master_locations',
  LOCATION_STATES: 'location_states'
};

const LOCAL_KEYS = {
  MASTER_DATA: 'local_master_data',
  AUDIT_LOGS: 'local_audit_logs',
  LOCATIONS: 'local_locations',
  STATES: 'local_states',
  OFFLINE_QUEUE: 'offline_audit_queue'
};

// Global callback for UI to react to permission issues
let onPermissionError: ((error: FirestoreError) => void) | null = null;
export const setPermissionErrorHandler = (handler: (error: FirestoreError) => void) => {
    onPermissionError = handler;
};

// Helper to get local data
export const getLocal = <T>(key: string, defaultVal: T): T => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved) return defaultVal;
        return JSON.parse(saved) as T;
    } catch (e) {
        return defaultVal;
    }
};

// Helper to set local data
export const setLocal = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn("LocalStorage full or disabled");
    }
};

// --- SYNC ENGINE ---

export const getOfflineQueueCount = (): number => {
    const queue = getLocal<AuditRecord[]>(LOCAL_KEYS.OFFLINE_QUEUE, []);
    return queue.length;
};

export const getOfflineRecords = (): AuditRecord[] => {
    return getLocal<AuditRecord[]>(LOCAL_KEYS.OFFLINE_QUEUE, []);
};

export const syncOfflineQueue = async (onProgress?: (remaining: number) => void): Promise<void> => {
    const queue = getLocal<AuditRecord[]>(LOCAL_KEYS.OFFLINE_QUEUE, []);
    if (queue.length === 0) return;

    const remainingQueue: AuditRecord[] = [];
    for (const record of queue) {
        try {
            await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, record.id), record);
            const state: LocationState = {
                locationId: record.location,
                status: 'audited',
                timestamp: record.timestamp,
                photoUrl: record.evidencePhotos?.[0],
                description: record.notes || undefined,
                reportedBy: record.teamMember
            };
            await setDoc(doc(db, COLLECTIONS.LOCATION_STATES, record.location), state, { merge: true });
        } catch (error) {
            remainingQueue.push(record);
        }
    }

    setLocal(LOCAL_KEYS.OFFLINE_QUEUE, remainingQueue);
    window.dispatchEvent(new Event('auditDataChanged'));
    if (onProgress) onProgress(remainingQueue.length);
};

// --- REAL-TIME SUBSCRIPTIONS ---

export const subscribeToAuditLogs = (onUpdate: (data: AuditRecord[]) => void, onError?: (error: FirestoreError) => void) => {
  const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy("timestamp", "desc"));
  const unsubscribe = onSnapshot(q, 
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditRecord));
      setLocal(LOCAL_KEYS.AUDIT_LOGS, data);
      onUpdate(data);
    }, 
    (error) => {
      if (error.code === 'permission-denied') {
          onPermissionError?.(error);
          onUpdate(getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []));
      } else if (onError) onError(error);
    }
  );
  return unsubscribe;
};

export const subscribeToMasterData = (onUpdate: (data: MasterItem[]) => void, onError?: (error: FirestoreError) => void) => {
  const unsubscribe = onSnapshot(collection(db, COLLECTIONS.MASTER_DATA), 
    (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as MasterItem);
      setLocal(LOCAL_KEYS.MASTER_DATA, data);
      onUpdate(data);
    }, 
    (error) => {
      if (error.code === 'permission-denied') {
          onPermissionError?.(error);
          onUpdate(getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []));
      } else if (onError) onError(error);
    }
  );
  return unsubscribe;
};

export const subscribeToLocationStates = (onUpdate: (data: Record<string, LocationState>) => void, onError?: (error: FirestoreError) => void) => {
  const unsubscribe = onSnapshot(collection(db, COLLECTIONS.LOCATION_STATES), 
    (snapshot) => {
      const states: Record<string, LocationState> = {};
      snapshot.docs.forEach(doc => { states[doc.id] = doc.data() as LocationState; });
      setLocal(LOCAL_KEYS.STATES, states);
      onUpdate(states);
    }, 
    (error) => {
      if (error.code === 'permission-denied') {
          onPermissionError?.(error);
          onUpdate(getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {}));
      } else if (onError) onError(error);
    }
  );
  return unsubscribe;
};

// --- FETCHERS & SAVERS ---

export const getMasterData = async (): Promise<MasterItem[]> => {
    return getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []);
};

export const getMasterLocations = async (): Promise<MasterLocation[]> => {
    return getLocal<MasterLocation[]>(LOCAL_KEYS.LOCATIONS, []);
};

export const saveMasterData = async (items: MasterItem[], onProgress?: (progress: number) => void) => {
    const batchSize = 100;
    const total = items.length;
    
    for (let i = 0; i < total; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = items.slice(i, i + batchSize);
        
        chunk.forEach(item => {
            const docRef = doc(db, COLLECTIONS.MASTER_DATA, item.sku);
            batch.set(docRef, item, { merge: true });
        });
        
        await batch.commit();
        if (onProgress) onProgress(Math.round(((i + chunk.length) / total) * 100));
    }
    
    setLocal(LOCAL_KEYS.MASTER_DATA, items);
};

export const deleteAllMasterData = async (onStatus?: (msg: string) => void) => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.MASTER_DATA));
    const total = snapshot.docs.length;
    
    if (total === 0) return;
    
    const batchSize = 100;
    const docs = snapshot.docs;
    
    for (let i = 0; i < total; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + batchSize);
        
        chunk.forEach(d => {
            batch.delete(d.ref);
        });
        
        await batch.commit();
        if (onStatus) onStatus(`Cleaning: ${Math.round(((i + chunk.length) / total) * 100)}%`);
    }
    
    setLocal(LOCAL_KEYS.MASTER_DATA, []);
};

export const saveAuditLog = async (record: AuditRecord) => {
  // 1. UPDATE LOCAL LOGS CACHE (INSTANT)
  const currentLogs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
  const updatedLogs = [record, ...currentLogs.filter(l => l.id !== record.id)];
  setLocal(LOCAL_KEYS.AUDIT_LOGS, updatedLogs);

  // 2. ADD TO OFFLINE QUEUE
  const queue = getOfflineRecords();
  setLocal(LOCAL_KEYS.OFFLINE_QUEUE, [record, ...queue]);

  // 3. UPDATE LOCAL LOCATION STATE
  const currentStates = getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
  currentStates[record.location] = {
      locationId: record.location,
      status: 'audited',
      timestamp: record.timestamp,
      photoUrl: record.evidencePhotos?.[0],
      description: record.notes,
      reportedBy: record.teamMember
  };
  setLocal(LOCAL_KEYS.STATES, currentStates);

  // 4. TRIGGER INSTANT UI REFRESH
  window.dispatchEvent(new Event('auditDataChanged'));

  // 5. TRY CLOUD SYNC
  try {
      await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, record.id), record);
      await updateLocationStatus(record.location, 'audited', {
          photoUrl: record.evidencePhotos?.[0],
          description: record.notes,
          teamMember: record.teamMember
      });
      // Success: Remove from queue (FIXED TYPO HERE: OFFIE_QUEUE -> OFFLINE_QUEUE)
      const updatedQueue = getOfflineRecords().filter(q => q.id !== record.id);
      setLocal(LOCAL_KEYS.OFFLINE_QUEUE, updatedQueue);
  } catch (e) {
      console.warn("Cloud update deferred. Using local state.");
  }
};

export const updateAuditLog = async (id: string, updates: Partial<AuditRecord>) => {
    const logs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
    const updated = logs.map(l => l.id === id ? { ...l, ...updates } : l);
    setLocal(LOCAL_KEYS.AUDIT_LOGS, updated);
    window.dispatchEvent(new Event('auditDataChanged'));
    
    try {
        const docRef = doc(db, COLLECTIONS.AUDIT_LOGS, id);
        await updateDoc(docRef, updates);
    } catch (e) {}
};

export const deleteAuditLog = async (id: string) => {
    const logs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
    setLocal(LOCAL_KEYS.AUDIT_LOGS, logs.filter(l => l.id !== id));
    window.dispatchEvent(new Event('auditDataChanged'));

    try {
        await deleteDoc(doc(db, COLLECTIONS.AUDIT_LOGS, id));
    } catch (e) {}
};

export const updateLocationStatus = async (
    locationName: string, 
    status: LocationStatusType,
    data?: { photoUrl?: string, description?: string, teamMember?: string }
) => {
    const state: LocationState = {
        locationId: locationName,
        status,
        timestamp: Date.now(),
        photoUrl: data?.photoUrl,
        description: data?.description,
        reportedBy: data?.teamMember
    };

    const currentStates = getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
    currentStates[locationName] = state;
    setLocal(LOCAL_KEYS.STATES, currentStates);

    try {
        await setDoc(doc(db, COLLECTIONS.LOCATION_STATES, locationName), state, { merge: true });
    } catch (e) {}
};

export const getAuditLogs = async (): Promise<AuditRecord[]> => {
    return getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
};

export const getLocationStates = async (): Promise<Record<string, LocationState>> => {
    return getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
};
