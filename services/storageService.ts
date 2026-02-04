
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
  STATES: 'local_states'
};

let onPermissionError: ((error: FirestoreError) => void) | null = null;
export const setPermissionErrorHandler = (handler: (error: FirestoreError) => void) => {
    onPermissionError = handler;
};

export const getLocal = <T>(key: string, defaultVal: T): T => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved) return defaultVal;
        return JSON.parse(saved) as T;
    } catch (e) {
        return defaultVal;
    }
};

export const setLocal = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn("LocalStorage full or disabled");
    }
};

export const subscribeToAuditLogs = (onUpdate: (data: AuditRecord[]) => void, onError?: (error: FirestoreError) => void) => {
  const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy("timestamp", "desc"));
  return onSnapshot(q, 
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
};

export const subscribeToMasterData = (onUpdate: (data: MasterItem[]) => void, onError?: (error: FirestoreError) => void) => {
  return onSnapshot(collection(db, COLLECTIONS.MASTER_DATA), 
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
};

export const subscribeToLocationStates = (onUpdate: (data: Record<string, LocationState>) => void, onError?: (error: FirestoreError) => void) => {
  return onSnapshot(collection(db, COLLECTIONS.LOCATION_STATES), 
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
};

export const getMasterData = async (): Promise<MasterItem[]> => getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []);
export const getMasterLocations = async (): Promise<MasterLocation[]> => getLocal<MasterLocation[]>(LOCAL_KEYS.LOCATIONS, []);

export const saveMasterData = async (items: MasterItem[], onProgress?: (progress: number) => void) => {
    const batchSize = 100;
    const total = items.length;
    for (let i = 0; i < total; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = items.slice(i, i + batchSize);
        chunk.forEach(item => {
            batch.set(doc(db, COLLECTIONS.MASTER_DATA, item.sku), item, { merge: true });
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
    for (let i = 0; i < total; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = snapshot.docs.slice(i, i + batchSize);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        if (onStatus) onStatus(`Cleaning: ${Math.round(((i + chunk.length) / total) * 100)}%`);
    }
    setLocal(LOCAL_KEYS.MASTER_DATA, []);
};

export const saveAuditLog = async (record: AuditRecord) => {
  // Save directly to Firestore
  try {
      await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, record.id), record);
      await setDoc(doc(db, COLLECTIONS.LOCATION_STATES, record.location), {
          locationId: record.location,
          status: 'audited',
          timestamp: record.timestamp,
          photoUrl: record.evidencePhotos?.[0],
          description: record.notes,
          reportedBy: record.teamMember
      }, { merge: true });
      
      window.dispatchEvent(new Event('auditDataChanged'));
  } catch (error: any) {
      console.error("Cloud save failed:", error);
      if (error.code === 'out-of-range' || error.message?.includes('too large')) {
          throw new Error("Data terlalu besar (Foto terlalu banyak/besar). Mohon kurangi jumlah foto.");
      }
      throw error;
  }
};

export const updateAuditLog = async (id: string, updates: Partial<AuditRecord>) => {
    try {
        await updateDoc(doc(db, COLLECTIONS.AUDIT_LOGS, id), updates);
        window.dispatchEvent(new Event('auditDataChanged'));
    } catch (e) {
        console.error("Update failed:", e);
        throw e;
    }
};

export const deleteAuditLog = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTIONS.AUDIT_LOGS, id));
        window.dispatchEvent(new Event('auditDataChanged'));
    } catch (e) {
        console.error("Cloud delete failed:", e);
        throw e;
    }
};

export const updateLocationStatus = async (
    locationName: string, 
    status: LocationStatusType,
    data?: { photoUrl?: string, description?: string, teamMember?: string }
) => {
    const state: LocationState = {
        locationId: locationName, status, timestamp: Date.now(),
        photoUrl: data?.photoUrl, description: data?.description, reportedBy: data?.teamMember
    };
    try {
        await setDoc(doc(db, COLLECTIONS.LOCATION_STATES, locationName), state, { merge: true });
    } catch (e) {
        console.error("Location status update failed:", e);
    }
};

export const getAuditLogs = async (): Promise<AuditRecord[]> => getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
export const getLocationStates = async (): Promise<Record<string, LocationState>> => getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
