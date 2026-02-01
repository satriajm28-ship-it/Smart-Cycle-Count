
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
  STATES: 'local_states'
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

// --- REAL-TIME SUBSCRIPTIONS ---

export const subscribeToMasterData = (onUpdate: (data: MasterItem[]) => void, onError?: (error: FirestoreError) => void) => {
  let unsubscribe: Unsubscribe;
  unsubscribe = onSnapshot(collection(db, COLLECTIONS.MASTER_DATA), 
    (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as MasterItem);
      // Sync to local for offline backup, but Cloud is truth
      setLocal(LOCAL_KEYS.MASTER_DATA, data);
      onUpdate(data);
    }, 
    (error) => {
      if (error.code === 'permission-denied') {
          console.info("MasterData: Firebase permissions restricted. Using local cache.");
          onPermissionError?.(error);
          const localData = getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []);
          onUpdate(localData);
          if (unsubscribe) unsubscribe();
      } else {
          console.error("MasterData listener error:", error.message);
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
          console.info("AuditLogs: Firebase permissions restricted. Using local cache.");
          onPermissionError?.(error);
          const localData = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
          onUpdate(localData);
          if (unsubscribe) unsubscribe();
      } else {
          console.error("AuditLogs listener error:", error.message);
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
          console.info("LocationStates: Firebase permissions restricted. Using local cache.");
          onPermissionError?.(error);
          const localStates = getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
          onUpdate(localStates);
          if (unsubscribe) unsubscribe();
      } else {
          console.error("LocationStates listener error:", error.message);
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

// Utility to generate consistent ID
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
        
        // Clear local cache immediately
        setLocal(LOCAL_KEYS.MASTER_DATA, []);
    } catch (e) {
        console.error("Error deleting master data:", e);
        throw e;
    }
};

export const saveMasterData = async (data: MasterItem[], onProgress?: (progress: number) => void) => {
  // We prioritize Firestore. If Firestore write succeeds, the 'subscribeToMasterData' 
  // will automatically update the UI for ALL users.
  
  // Firestore Batches (Limit 500 ops per batch)
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
    
    // Also update local storage for immediate offline backup availability
    // Note: The listener will likely overwrite this moments later, which is fine.
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

  try {
      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), record);
      await updateLocationStatus(record.location, 'audited', updateData);
  } catch (e) {
      if ((e as FirestoreError).code === 'permission-denied') onPermissionError?.(e as FirestoreError);
      // Ensure local logs stay updated
      const currentLogs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
      setLocal(LOCAL_KEYS.AUDIT_LOGS, [record, ...currentLogs]);
  }
};

// --- CRUD OPERATIONS ---

export const updateAuditLog = async (id: string, updates: Partial<AuditRecord>) => {
    try {
        const docRef = doc(db, COLLECTIONS.AUDIT_LOGS, id);
        await updateDoc(docRef, updates);
        
        // Optimistic update for local cache
        const currentLogs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
        const updatedLogs = currentLogs.map(log => 
            log.id === id ? { ...log, ...updates } : log
        );
        setLocal(LOCAL_KEYS.AUDIT_LOGS, updatedLogs);
    } catch (e) {
        if ((e as FirestoreError).code === 'permission-denied') onPermissionError?.(e as FirestoreError);
        throw e;
    }
};

export const deleteAuditLog = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTIONS.AUDIT_LOGS, id));
        
        // Optimistic update for local cache
        const currentLogs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
        const updatedLogs = currentLogs.filter(log => log.id !== id);
        setLocal(LOCAL_KEYS.AUDIT_LOGS, updatedLogs);
    } catch (e) {
        if ((e as FirestoreError).code === 'permission-denied') onPermissionError?.(e as FirestoreError);
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

    try {
        await setDoc(doc(db, COLLECTIONS.LOCATION_STATES, locationName), state, { merge: true });
    } catch (e) {
        if ((e as FirestoreError).code === 'permission-denied') onPermissionError?.(e as FirestoreError);
        const currentStates = getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
        currentStates[locationName] = state;
        setLocal(LOCAL_KEYS.STATES, currentStates);
    }
};
