
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
import { AuditRecord, MasterItem, MasterLocation, LocationState } from '../types';

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

// Helper to get local data
const getLocal = <T>(key: string, defaultVal: T): T => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultVal;
};

// Helper to set local data
const setLocal = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
};

export const getMasterData = async (): Promise<MasterItem[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.MASTER_DATA));
    if (querySnapshot.empty) {
      // Check local storage first before using hardcoded defaults
      const localData = getLocal(LOCAL_KEYS.MASTER_DATA, null);
      if (localData) return localData;

      // Seed default
      try {
          const batch = writeBatch(db);
          // Initial seed is small, so no chunking needed here usually, but good practice to keep it safe
          DEFAULT_MASTER_DATA.forEach(item => {
              const docRef = doc(collection(db, COLLECTIONS.MASTER_DATA));
              batch.set(docRef, item);
          });
          await batch.commit();
      } catch (e) { 
          // If seeding fails, save defaults to local storage so we have something
          setLocal(LOCAL_KEYS.MASTER_DATA, DEFAULT_MASTER_DATA);
      }
      return DEFAULT_MASTER_DATA;
    }
    const data = querySnapshot.docs.map(doc => doc.data() as MasterItem);
    // Sync to local
    setLocal(LOCAL_KEYS.MASTER_DATA, data);
    return data;
  } catch (error) {
    console.warn("Firestore read failed, using Local Storage:", error);
    return getLocal(LOCAL_KEYS.MASTER_DATA, DEFAULT_MASTER_DATA);
  }
};

export const saveMasterData = async (data: MasterItem[]) => {
  // Always update local storage first to ensure UI updates immediately
  setLocal(LOCAL_KEYS.MASTER_DATA, data);
  
  try {
    // Firestore Batch Limit is 500 operations. We chunk data to respect this.
    const CHUNK_SIZE = 450; 
    const chunks = [];
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        chunks.push(data.slice(i, i + CHUNK_SIZE));
    }

    // Process chunks sequentially
    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(item => {
            // Using SKU as Document ID ensures no duplicates
            const docRef = doc(db, COLLECTIONS.MASTER_DATA, item.sku);
            batch.set(docRef, item);
        });
        await batch.commit();
    }
    console.log(`Successfully synced ${data.length} items to Firestore in ${chunks.length} batches.`);
  } catch (error) {
    console.error("Error saving to Firestore (Data saved locally only):", error);
    alert("Warning: Data saved locally but failed to sync to server. Please check internet connection.");
  }
};

export const getMasterLocations = async (): Promise<MasterLocation[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.MASTER_LOCATIONS));
        if (querySnapshot.empty) {
             const local = getLocal(LOCAL_KEYS.LOCATIONS, null);
             if (local) return local;
             return DEFAULT_LOCATIONS;
        }
        const data = querySnapshot.docs.map(doc => doc.data() as MasterLocation);
        setLocal(LOCAL_KEYS.LOCATIONS, data);
        return data;
    } catch (e) {
        return getLocal(LOCAL_KEYS.LOCATIONS, DEFAULT_LOCATIONS);
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
      return getLocal(LOCAL_KEYS.AUDIT_LOGS, []);
  }
};

export const saveAuditLog = async (record: AuditRecord) => {
  // Save locally
  const currentLogs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
  setLocal(LOCAL_KEYS.AUDIT_LOGS, [record, ...currentLogs]);
  
  // Update local state as well
  updateLocationStatusLocal(record.location, 'audited', { teamMember: record.teamMember });

  try {
      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), record);
      await updateLocationStatus(record.location, 'audited', { teamMember: record.teamMember });
  } catch (e) {
      console.error("Error saving log to Firestore (Saved Locally)", e);
  }
};

// Helper for local state update
const updateLocationStatusLocal = (locationId: string, status: string, data?: any) => {
    const currentStates = getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
    currentStates[locationId] = {
        locationId,
        status: status as any,
        timestamp: Date.now(),
        photoUrl: data?.photoUrl,
        description: data?.description,
        reportedBy: data?.teamMember
    };
    setLocal(LOCAL_KEYS.STATES, currentStates);
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
        return getLocal(LOCAL_KEYS.STATES, {});
    } catch (e) {
        return getLocal(LOCAL_KEYS.STATES, {});
    }
};

export const updateLocationStatus = async (
    locationName: string, 
    status: 'audited' | 'empty' | 'damaged',
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
