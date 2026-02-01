
import { db } from './firebaseConfig';
import { 
  collection, 
  getDocs, 
  addDoc, 
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
  OFFLINE_QUEUE: 'offline_audit_queue' // New Key for pending uploads
};

// Global callback for UI to react to permission issues
let onPermissionError: ((error: FirestoreError) => void) | null = null;
export const setPermissionErrorHandler = (handler: (error: FirestoreError) => void) => {
    onPermissionError = handler;
};

// Helper to get local data
const getLocal = <T>(key: string, defaultVal: T): T => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved) return defaultVal;
        return JSON.parse(saved) as T;
    } catch (e) {
        return defaultVal;
    }
};

// Helper to set local data
const setLocal = (key: string, data: any) => {
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

// Function to process pending offline data
export const syncOfflineQueue = async (onProgress?: (remaining: number) => void): Promise<void> => {
    const queue = getLocal<AuditRecord[]>(LOCAL_KEYS.OFFLINE_QUEUE, []);
    
    if (queue.length === 0) return;

    console.log(`Attempting to sync ${queue.length} offline records...`);
    const remainingQueue: AuditRecord[] = [];

    for (const record of queue) {
        try {
            // 1. Try to save Audit Log to Firestore
            // Use setDoc with specific ID to prevent duplicates if retried
            await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, record.id), record);

            // 2. Update Location Status
            const updateData = { 
                teamMember: record.teamMember,
                description: record.notes || undefined,
                photoUrl: (record.evidencePhotos && record.evidencePhotos.length > 0) ? record.evidencePhotos[0] : undefined
            };
            
            // Explicitly call setDoc for location status to ensure cloud update
            // We construct the state object manually to ensure it matches what updateLocationStatus does
            const state: LocationState = {
                locationId: record.location,
                status: 'audited',
                timestamp: record.timestamp, // Use record timestamp
                photoUrl: updateData.photoUrl,
                description: updateData.description,
                reportedBy: updateData.teamMember
            };
            await setDoc(doc(db, COLLECTIONS.LOCATION_STATES, record.location), state, { merge: true });

            // If success, don't add to remainingQueue (effectively removing it)
        } catch (error) {
            console.error(`Failed to sync record ${record.id}:`, error);
            remainingQueue.push(record); // Keep in queue to retry later
        }
    }

    // Update the queue in local storage
    setLocal(LOCAL_KEYS.OFFLINE_QUEUE, remainingQueue);
    
    if (onProgress) onProgress(remainingQueue.length);
    console.log(`Sync complete. Remaining: ${remainingQueue.length}`);
};

// --- REAL-TIME SUBSCRIPTIONS ---

export const subscribeToMasterData = (onUpdate: (data: MasterItem[]) => void, onError?: (error: FirestoreError) => void) => {
  let unsubscribe: Unsubscribe;
  unsubscribe = onSnapshot(collection(db, COLLECTIONS.MASTER_DATA), 
    (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as MasterItem);
      setLocal(LOCAL_KEYS.MASTER_DATA, data);
      onUpdate(data);
    }, 
    (error) => {
      if (error.code === 'permission-denied') {
          onPermissionError?.(error);
          const localData = getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []);
          onUpdate(localData);
          if (unsubscribe) unsubscribe();
      } else {
          if (onError) onError(error);
      }
    }
  );
  return unsubscribe;
};

export const subscribeToAuditLogs = (onUpdate: (data: AuditRecord[]) => void, onError?: (error: FirestoreError) => void) => {
  let unsubscribe: Unsubscribe;
  const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy("timestamp", "desc"));
  unsubscribe = onSnapshot(q, 
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditRecord));
      setLocal(LOCAL_KEYS.AUDIT_LOGS, data);
      onUpdate(data);
    }, 
    (error) => {
      if (error.code === 'permission-denied') {
          onPermissionError?.(error);
          const localData = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
          onUpdate(localData);
          if (unsubscribe) unsubscribe();
      } else {
          if (onError) onError(error);
      }
    }
  );
  return unsubscribe;
};

export const subscribeToLocationStates = (onUpdate: (data: Record<string, LocationState>) => void, onError?: (error: FirestoreError) => void) => {
  let unsubscribe: Unsubscribe;
  unsubscribe = onSnapshot(collection(db, COLLECTIONS.LOCATION_STATES), 
    (snapshot) => {
      const states: Record<string, LocationState> = {};
      snapshot.docs.forEach(doc => {
        states[doc.id] = doc.data() as LocationState;
      });
      setLocal(LOCAL_KEYS.STATES, states);
      onUpdate(states);
    }, 
    (error) => {
      if (error.code === 'permission-denied') {
          onPermissionError?.(error);
          const localStates = getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
          onUpdate(localStates);
          if (unsubscribe) unsubscribe();
      } else {
          if (onError) onError(error);
      }
    }
  );
  return unsubscribe;
};

// --- TRADITIONAL FETCHERS ---

export const getMasterData = async (): Promise<MasterItem[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.MASTER_DATA));
    const data = querySnapshot.docs.map(doc => doc.data() as MasterItem);
    setLocal(LOCAL_KEYS.MASTER_DATA, data);
    return data;
  } catch (error) {
    if ((error as FirestoreError).code === 'permission-denied') onPermissionError?.(error as FirestoreError);
    return getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []);
  }
};

const getMasterKey = (i: MasterItem) => `${(i.sku||'UNKNOWN').replace(/[^a-zA-Z0-9-_]/g, '')}_${i.batchNumber}_${i.expiryDate}`;

export const deleteAllMasterData = async (onProgress?: (msg: string) => void) => {
    try {
        if (onProgress) onProgress("Fetching existing data...");
        const snapshot = await getDocs(collection(db, COLLECTIONS.MASTER_DATA));
        const total = snapshot.size;
        
        if (total === 0) return;

        const BATCH_SIZE = 400;
        const docs = snapshot.docs;
        const chunks = [];
        for (let i = 0; i < total; i += BATCH_SIZE) {
            chunks.push(docs.slice(i, i + BATCH_SIZE));
        }

        let deletedCount = 0;
        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            deletedCount += chunk.length;
            if (onProgress) onProgress(`Deleted ${deletedCount} of ${total} records...`);
        }
        
        setLocal(LOCAL_KEYS.MASTER_DATA, []);
    } catch (e) {
        console.error("Error deleting master data:", e);
        throw e;
    }
};

export const saveMasterData = async (data: MasterItem[], onProgress?: (progress: number) => void) => {
  const BATCH_SIZE = 400; 
  const chunks = [];
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
      chunks.push(data.slice(i, i + BATCH_SIZE));
  }

  let processed = 0;
  try {
    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(item => {
            const docId = getMasterKey(item);
            const docRef = doc(db, COLLECTIONS.MASTER_DATA, docId);
            batch.set(docRef, item);
        });
        await batch.commit();
        processed += chunk.length;
        if (onProgress) onProgress(Math.min(100, Math.round((processed / data.length) * 100)));
    }
    
    const current = getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []);
    const map = new Map<string, MasterItem>();
    current.forEach(i => map.set(getMasterKey(i), i));
    data.forEach(i => map.set(getMasterKey(i), i));
    setLocal(LOCAL_KEYS.MASTER_DATA, Array.from(map.values()));

  } catch (error) {
      if ((error as FirestoreError).code === 'permission-denied') onPermissionError?.(error as FirestoreError);
      console.error("Error saving to Firestore:", error);
      throw error;
  }
};

export const getMasterLocations = async (): Promise<MasterLocation[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.MASTER_LOCATIONS));
        const data = querySnapshot.docs.map(doc => doc.data() as MasterLocation);
        setLocal(LOCAL_KEYS.LOCATIONS, data);
        return data;
    } catch (e) {
        return getLocal<MasterLocation[]>(LOCAL_KEYS.LOCATIONS, []);
    }
};

export const getAuditLogs = async (): Promise<AuditRecord[]> => {
  try {
      const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditRecord));
  } catch (e) {
      return getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
  }
};

export const saveAuditLog = async (record: AuditRecord) => {
  const updateData = { 
      teamMember: record.teamMember,
      description: record.notes || undefined,
      photoUrl: (record.evidencePhotos && record.evidencePhotos.length > 0) ? record.evidencePhotos[0] : undefined
  };

  // Optimistic update for UI responsiveness (Update view immediately)
  const currentLogs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
  setLocal(LOCAL_KEYS.AUDIT_LOGS, [record, ...currentLogs]);

  try {
      // Use setDoc with the record.id to ensure idempotency (safe to retry)
      await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, record.id), record);
      
      // Update location status in cloud
      await updateLocationStatus(record.location, 'audited', updateData);
  } catch (e) {
      if ((e as FirestoreError).code === 'permission-denied') onPermissionError?.(e as FirestoreError);
      
      console.warn("Offline or Error saving to cloud. Adding to offline queue.");
      
      // Add to Offline Queue for later Sync
      const queue = getLocal<AuditRecord[]>(LOCAL_KEYS.OFFLINE_QUEUE, []);
      // Check if already in queue to avoid dupes
      if (!queue.find(q => q.id === record.id)) {
          queue.push(record);
          setLocal(LOCAL_KEYS.OFFLINE_QUEUE, queue);
      }
      
      // We also update local location state so the UI reflects it immediately even if offline
      const currentStates = getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
      currentStates[record.location] = {
          locationId: record.location,
          status: 'audited',
          timestamp: record.timestamp,
          photoUrl: updateData.photoUrl,
          description: updateData.description,
          reportedBy: updateData.teamMember
      };
      setLocal(LOCAL_KEYS.STATES, currentStates);
  }
};

export const updateAuditLog = async (id: string, updates: Partial<AuditRecord>) => {
    // Optimistic Update
    const currentLogs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
    const updatedLogs = currentLogs.map(log => 
        log.id === id ? { ...log, ...updates } : log
    );
    setLocal(LOCAL_KEYS.AUDIT_LOGS, updatedLogs);

    try {
        const docRef = doc(db, COLLECTIONS.AUDIT_LOGS, id);
        await updateDoc(docRef, updates);
    } catch (e) {
        if ((e as FirestoreError).code === 'permission-denied') onPermissionError?.(e as FirestoreError);
        // Note: We don't currently queue updates/deletes in this basic implementation, 
        // but the optimistic update makes it usable locally.
        console.warn("Update failed, change is local-only for now.");
        throw e;
    }
};

export const deleteAuditLog = async (id: string) => {
    // Optimistic Update
    const currentLogs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
    const updatedLogs = currentLogs.filter(log => log.id !== id);
    setLocal(LOCAL_KEYS.AUDIT_LOGS, updatedLogs);

    try {
        await deleteDoc(doc(db, COLLECTIONS.AUDIT_LOGS, id));
    } catch (e) {
        if ((e as FirestoreError).code === 'permission-denied') onPermissionError?.(e as FirestoreError);
        console.warn("Delete failed, change is local-only for now.");
        throw e;
    }
};

export const getLocationStates = async (): Promise<Record<string, LocationState>> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.LOCATION_STATES));
        const states: Record<string, LocationState> = {};
        querySnapshot.docs.forEach(doc => { states[doc.id] = doc.data() as LocationState; });
        return states;
    } catch (e) {
        return getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
    }
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

    // Optimistic Update
    const currentStates = getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
    currentStates[locationName] = state;
    setLocal(LOCAL_KEYS.STATES, currentStates);

    try {
        await setDoc(doc(db, COLLECTIONS.LOCATION_STATES, locationName), state, { merge: true });
    } catch (e) {
        if ((e as FirestoreError).code === 'permission-denied') onPermissionError?.(e as FirestoreError);
        // Fail silently as we updated local state. 
        // Note: For 'audited' status, the syncOfflineQueue handles the retry.
    }
};
