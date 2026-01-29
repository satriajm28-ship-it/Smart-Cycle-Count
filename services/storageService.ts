
import { db } from './firebaseConfig';
import { 
  collection, 
  getDocs, 
  addDoc, 
  setDoc, 
  doc, 
  query, 
  orderBy, 
  writeBatch
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

// Seed data
const DEFAULT_MASTER_DATA: MasterItem[] = [
  { sku: 'BRG-882910', name: 'Indomie Goreng Special 85g', systemStock: 50, batchNumber: 'BATCH-2023-X', expiryDate: '2024-12-12', category: 'Food', unit: 'Pcs' },
  { sku: '123BX', name: 'Example Test Item', systemStock: 200, batchNumber: 'DEFAULT-BATCH', expiryDate: '2025-01-01', category: 'General', unit: 'Carton' },
  { sku: '89999090901', name: 'Paracetamol 500mg', systemStock: 100, batchNumber: 'B202301', expiryDate: '2025-12-31', category: 'Medicine', unit: 'Box' },
  { sku: '89999090902', name: 'Amoxicillin Syrup', systemStock: 50, batchNumber: 'B202305', expiryDate: '2024-06-30', category: 'Medicine', unit: 'Bottle' },
  { sku: 'CABLE-001', name: 'USB-C Cable 1M', systemStock: 25, batchNumber: 'LOT-99', expiryDate: '2030-01-01', category: 'Electronics', unit: 'Pcs' },
];

const DEFAULT_LOCATIONS: MasterLocation[] = [
    { id: '1', name: 'RACK-A-01-A', zone: 'Zone A' },
    { id: '2', name: 'RACK-A-01-B', zone: 'Zone A' },
    { id: '3', name: 'RACK-A-02-A', zone: 'Zone A' },
    { id: '4', name: 'RACK-A-02-B', zone: 'Zone A' },
];

// Helper to get local data with safer typing
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

export const getMasterData = async (): Promise<MasterItem[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.MASTER_DATA));
    if (querySnapshot.empty) {
      // Check local storage first
      const localData = getLocal<MasterItem[] | null>(LOCAL_KEYS.MASTER_DATA, null);
      if (localData && localData.length > 0) return localData;

      // Seed default if absolutely nothing exists
      try {
          const batch = writeBatch(db);
          DEFAULT_MASTER_DATA.forEach(item => {
              const docRef = doc(collection(db, COLLECTIONS.MASTER_DATA));
              batch.set(docRef, item);
          });
          await batch.commit();
      } catch (e) { 
          setLocal(LOCAL_KEYS.MASTER_DATA, DEFAULT_MASTER_DATA);
      }
      return DEFAULT_MASTER_DATA;
    }
    const data = querySnapshot.docs.map(doc => doc.data() as MasterItem);
    setLocal(LOCAL_KEYS.MASTER_DATA, data);
    return data;
  } catch (error) {
    console.warn("Firestore read failed, using Local Storage:", error);
    return getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, DEFAULT_MASTER_DATA);
  }
};

export const saveMasterData = async (data: MasterItem[]) => {
  setLocal(LOCAL_KEYS.MASTER_DATA, data);
  
  try {
    const CHUNK_SIZE = 450; 
    const chunks = [];
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        chunks.push(data.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(item => {
            const docRef = doc(db, COLLECTIONS.MASTER_DATA, item.sku);
            batch.set(docRef, item);
        });
        await batch.commit();
    }
  } catch (error) {
    console.error("Error saving to Firestore:", error);
  }
};

export const getMasterLocations = async (): Promise<MasterLocation[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.MASTER_LOCATIONS));
        if (querySnapshot.empty) {
             const local = getLocal<MasterLocation[] | null>(LOCAL_KEYS.LOCATIONS, null);
             if (local && local.length > 0) return local;
             return DEFAULT_LOCATIONS;
        }
        const data = querySnapshot.docs.map(doc => doc.data() as MasterLocation);
        setLocal(LOCAL_KEYS.LOCATIONS, data);
        return data;
    } catch (e) {
        return getLocal<MasterLocation[]>(LOCAL_KEYS.LOCATIONS, DEFAULT_LOCATIONS);
    }
};

export const getAuditLogs = async (): Promise<AuditRecord[]> => {
  try {
      const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditRecord));
      setLocal(LOCAL_KEYS.AUDIT_LOGS, data);
      return data;
  } catch (e) {
      return getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
  }
};

// Helper for local state update
const updateLocationStatusLocal = (locationId: string, status: LocationStatusType, data?: any) => {
    const currentStates = getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
    currentStates[locationId] = {
        locationId,
        status,
        timestamp: Date.now(),
        photoUrl: data?.photoUrl,
        description: data?.description,
        reportedBy: data?.teamMember
    };
    setLocal(LOCAL_KEYS.STATES, currentStates);
};

export const saveAuditLog = async (record: AuditRecord) => {
  const currentLogs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
  setLocal(LOCAL_KEYS.AUDIT_LOGS, [record, ...currentLogs]);
  
  updateLocationStatusLocal(record.location, 'audited', { teamMember: record.teamMember });

  try {
      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), record);
      await updateLocationStatus(record.location, 'audited', { teamMember: record.teamMember });
  } catch (e) {
      console.error("Error saving log to Firestore", e);
  }
};

export const getLocationStates = async (): Promise<Record<string, LocationState>> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.LOCATION_STATES));
        const states: Record<string, LocationState> = {};
        querySnapshot.docs.forEach(doc => {
            states[doc.id] = doc.data() as LocationState;
        });
        if (Object.keys(states).length > 0) {
            setLocal(LOCAL_KEYS.STATES, states);
            return states;
        }
        return getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
    } catch (e) {
        return getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
    }
};

export const updateLocationStatus = async (
    locationName: string, 
    status: LocationStatusType,
    data?: { photoUrl?: string, description?: string, teamMember?: string }
) => {
    updateLocationStatusLocal(locationName, status, data);
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
        console.error("Error updating location in Firestore", e);
    }
};
