
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
  onSnapshot
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

// --- REAL-TIME SUBSCRIPTIONS (The "Automatic Update" part) ---

export const subscribeToMasterData = (onUpdate: (data: MasterItem[]) => void) => {
  return onSnapshot(collection(db, COLLECTIONS.MASTER_DATA), (snapshot) => {
    const data = snapshot.docs.map(doc => doc.data() as MasterItem);
    setLocal(LOCAL_KEYS.MASTER_DATA, data);
    onUpdate(data);
  });
};

export const subscribeToAuditLogs = (onUpdate: (data: AuditRecord[]) => void) => {
  const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy("timestamp", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditRecord));
    setLocal(LOCAL_KEYS.AUDIT_LOGS, data);
    onUpdate(data);
  });
};

export const subscribeToLocationStates = (onUpdate: (data: Record<string, LocationState>) => void) => {
  return onSnapshot(collection(db, COLLECTIONS.LOCATION_STATES), (snapshot) => {
    const states: Record<string, LocationState> = {};
    snapshot.docs.forEach(doc => {
      states[doc.id] = doc.data() as LocationState;
    });
    setLocal(LOCAL_KEYS.STATES, states);
    onUpdate(states);
  });
};

// --- TRADITIONAL FETCHERS ---

export const getMasterData = async (): Promise<MasterItem[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.MASTER_DATA));
    const data = querySnapshot.docs.map(doc => doc.data() as MasterItem);
    setLocal(LOCAL_KEYS.MASTER_DATA, data);
    return data;
  } catch (error) {
    return getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []);
  }
};

export const saveMasterData = async (data: MasterItem[]) => {
  setLocal(LOCAL_KEYS.MASTER_DATA, data);
  try {
    const batch = writeBatch(db);
    data.forEach(item => {
        const safeSku = (item.sku || 'UNKNOWN').replace(/[^a-zA-Z0-9-_]/g, '');
        const docId = `${safeSku}_${item.batchNumber}_${item.expiryDate}`;
        const docRef = doc(db, COLLECTIONS.MASTER_DATA, docId);
        batch.set(docRef, item);
    });
    await batch.commit();
  } catch (error) {
    console.error("Error saving to Firestore:", error);
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
      console.error("Error saving log", e);
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
    try {
        const state: LocationState = {
            locationId: locationName,
            status,
            timestamp: Date.now(),
            photoUrl: data?.photoUrl,
            description: data?.description,
            reportedBy: data?.teamMember
        };
        await setDoc(doc(db, COLLECTIONS.LOCATION_STATES, locationName), state, { merge: true });
    } catch (e) {
        console.error("Error updating location", e);
    }
};
