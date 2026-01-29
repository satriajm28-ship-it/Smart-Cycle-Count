
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
  getDoc
} from 'firebase/firestore';
import { AuditRecord, MasterItem, MasterLocation, LocationState } from '../types';

const COLLECTIONS = {
  MASTER_DATA: 'master_data',
  AUDIT_LOGS: 'audit_logs',
  MASTER_LOCATIONS: 'master_locations',
  LOCATION_STATES: 'location_states'
};

// Seed data remains the same
const DEFAULT_MASTER_DATA: MasterItem[] = [
  { sku: 'BRG-882910', name: 'Indomie Goreng Special 85g', systemStock: 50, batchNumber: 'BATCH-2023-X', expiryDate: '2024-12-12', category: 'Food', unit: 'Pcs' },
  { sku: '123BX', name: 'Example Test Item', systemStock: 200, batchNumber: 'DEFAULT-BATCH', expiryDate: '2025-01-01', category: 'General', unit: 'Pcs' },
  { sku: '89999090901', name: 'Paracetamol 500mg', systemStock: 100, batchNumber: 'B202301', expiryDate: '2025-12-31', category: 'Medicine', unit: 'Box' },
  { sku: '89999090902', name: 'Amoxicillin Syrup', systemStock: 50, batchNumber: 'B202305', expiryDate: '2024-06-30', category: 'Medicine', unit: 'Bottle' },
  { sku: '89999090903', name: 'Vitamin C 1000mg', systemStock: 200, batchNumber: 'B202401', expiryDate: '2026-01-15', category: 'Supplement', unit: 'Tube' },
  { sku: '89999090904', name: 'Surgical Mask 3-Ply', systemStock: 500, batchNumber: 'M202399', expiryDate: '2028-05-20', category: 'Equipment', unit: 'Box' },
  { sku: '89999090905', name: 'Hand Sanitizer 500ml', systemStock: 75, batchNumber: 'H202311', expiryDate: '2025-08-10', category: 'Equipment', unit: 'Bottle' },
];

const DEFAULT_LOCATIONS: MasterLocation[] = [
    { id: '1', name: 'RACK-A-01-A', zone: 'Zone A' },
    { id: '2', name: 'RACK-A-01-B', zone: 'Zone A' },
    { id: '3', name: 'RACK-A-02-A', zone: 'Zone A' },
    { id: '4', name: 'RACK-A-02-B', zone: 'Zone A' },
    { id: '5', name: 'RACK-B-01-A', zone: 'Zone B' },
    { id: '6', name: 'RACK-B-01-B', zone: 'Zone B' },
    { id: '7', name: 'RACK-C-01-A', zone: 'Zone C' },
    { id: '8', name: 'RACK-C-02-B', zone: 'Zone C' },
];

export const getMasterData = async (): Promise<MasterItem[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.MASTER_DATA));
    if (querySnapshot.empty) {
      // Seed data if empty (only attempts if read permissions allow)
      try {
        const batch = writeBatch(db);
        DEFAULT_MASTER_DATA.forEach(item => {
            const docRef = doc(collection(db, COLLECTIONS.MASTER_DATA));
            batch.set(docRef, item);
        });
        await batch.commit();
      } catch (writeError) {
        console.warn("Could not seed data (write permission denied), returning default local data.");
      }
      return DEFAULT_MASTER_DATA;
    }
    return querySnapshot.docs.map(doc => doc.data() as MasterItem);
  } catch (error) {
    console.warn("Firestore read failed (using local data):", error);
    // Fallback to local data so app works
    return DEFAULT_MASTER_DATA;
  }
};

export const saveMasterData = async (data: MasterItem[]) => {
  try {
    const batch = writeBatch(db);
    data.forEach(item => {
       const docRef = doc(db, COLLECTIONS.MASTER_DATA, item.sku);
       batch.set(docRef, item);
    });
    await batch.commit();
  } catch (error) {
    console.error("Error saving master data:", error);
    // Silent fail or alert
  }
};

export const getMasterLocations = async (): Promise<MasterLocation[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.MASTER_LOCATIONS));
        if (querySnapshot.empty) {
            try {
                const batch = writeBatch(db);
                DEFAULT_LOCATIONS.forEach(loc => {
                    const docRef = doc(collection(db, COLLECTIONS.MASTER_LOCATIONS));
                    batch.set(docRef, loc);
                });
                await batch.commit();
            } catch(e) {}
            return DEFAULT_LOCATIONS;
        }
        return querySnapshot.docs.map(doc => doc.data() as MasterLocation);
    } catch (e) {
        console.warn("Firestore read locations failed (using local data)");
        return DEFAULT_LOCATIONS;
    }
};

export const getAuditLogs = async (): Promise<AuditRecord[]> => {
  try {
      const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditRecord));
  } catch (e) {
      console.warn("Error fetching logs, returning empty list", e);
      return [];
  }
};

export const saveAuditLog = async (record: AuditRecord) => {
  try {
      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), record);
      await updateLocationStatus(record.location, 'audited', { teamMember: record.teamMember });
  } catch (e) {
      console.error("Error saving log (Demo Mode)", e);
  }
};

export const getLocationStates = async (): Promise<Record<string, LocationState>> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.LOCATION_STATES));
        const states: Record<string, LocationState> = {};
        querySnapshot.docs.forEach(doc => {
            states[doc.id] = doc.data() as LocationState;
        });
        return states;
    } catch (e) {
        return {};
    }
};

export const updateLocationStatus = async (
    locationName: string, 
    status: 'audited' | 'empty' | 'damaged',
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
