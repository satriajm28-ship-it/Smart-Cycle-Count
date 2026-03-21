
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
  Unsubscribe,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { AuditRecord, MasterItem, MasterLocation, LocationState, LocationStatusType, ActivityLog } from '../types';
import { v4 as uuidv4 } from 'uuid';

const COLLECTIONS = {
  MASTER_DATA: 'master_data',
  AUDIT_LOGS: 'audit_logs',
  MASTER_LOCATIONS: 'master_locations',
  LOCATION_STATES: 'location_states',
  ACTIVITY_LOGS: 'activity_logs'
};

const BACKUP_COLLECTIONS = {
  AUDIT_LOGS: 'backup_audit_logs_latest',
  LOCATION_STATES: 'backup_location_states_latest'
};

const LOCAL_KEYS = {
  MASTER_DATA: 'local_master_data',
  AUDIT_LOGS: 'local_audit_logs',
  LOCATIONS: 'local_locations',
  STATES: 'local_states',
  ACTIVITY_LOGS: 'local_activity_logs'
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

export const subscribeToActivityLogs = (onUpdate: (data: ActivityLog[]) => void, onError?: (error: FirestoreError) => void) => {
  const q = query(collection(db, COLLECTIONS.ACTIVITY_LOGS), orderBy("timestamp", "desc"));
  return onSnapshot(q, 
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ActivityLog));
      setLocal(LOCAL_KEYS.ACTIVITY_LOGS, data);
      onUpdate(data);
    }, 
    (error) => {
      if (error.code === 'permission-denied') {
          onPermissionError?.(error);
          onUpdate(getLocal<ActivityLog[]>(LOCAL_KEYS.ACTIVITY_LOGS, []));
      } else if (onError) onError(error);
    }
  );
};

export const saveActivityLog = async (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
  try {
    const id = uuidv4();
    const fullLog: ActivityLog = {
      ...log,
      id,
      timestamp: Date.now()
    };
    await setDoc(doc(db, COLLECTIONS.ACTIVITY_LOGS, id), fullLog);
  } catch (e) {
    console.error("Failed to save activity log:", e);
  }
};

export const getMasterData = async (): Promise<MasterItem[]> => {
    const local = getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []);
    if (local.length > 0) return local;
    return fetchMasterData();
};

export const fetchMasterData = async (): Promise<MasterItem[]> => {
    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.MASTER_DATA));
        const data = snapshot.docs.map(doc => doc.data() as MasterItem);
        setLocal(LOCAL_KEYS.MASTER_DATA, data);
        return data;
    } catch (e) {
        console.error("Fetch master data failed:", e);
        return getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []);
    }
};

export const getMasterLocations = async (): Promise<MasterLocation[]> => getLocal<MasterLocation[]>(LOCAL_KEYS.LOCATIONS, []);

export const saveMasterData = async (items: MasterItem[], onProgress?: (progress: number) => void) => {
    const batchSize = 100;
    const total = items.length;
    for (let i = 0; i < total; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = items.slice(i, i + batchSize);
        chunk.forEach(item => {
            // Use set with merge: true to update existing or create new
            batch.set(doc(db, COLLECTIONS.MASTER_DATA, item.sku), item, { merge: true });
        });
        await batch.commit();
        if (onProgress) onProgress(Math.round(((i + chunk.length) / total) * 100));
    }
    // Refresh local storage after all batches are committed
    await fetchMasterData();
    
    // Log activity
    await saveActivityLog({
        type: 'update',
        title: 'Master Data Updated',
        description: `Successfully imported ${total} items to master database.`,
        user: 'System/Admin'
    });
};

export const deleteAllMasterData = async (onStatus?: (msg: string) => void) => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.MASTER_DATA));
    const total = snapshot.docs.length;
    if (total === 0) {
        setLocal(LOCAL_KEYS.MASTER_DATA, []);
        return;
    }
    const batchSize = 100;
    for (let i = 0; i < total; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = snapshot.docs.slice(i, i + batchSize);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        if (onStatus) onStatus(`Cleaning: ${Math.round(((i + chunk.length) / total) * 100)}%`);
    }
    setLocal(LOCAL_KEYS.MASTER_DATA, []);
    
    // Log activity
    await saveActivityLog({
        type: 'delete',
        title: 'Master Data Cleared',
        description: 'All items in the master database have been deleted.',
        user: 'Admin'
    });
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
      
      // Log activity
      await saveActivityLog({
          type: 'scan',
          title: 'Scan Verified',
          description: `Operator: ${record.teamMember} scanned ${record.physicalQty} units of SKU: ${record.sku}`,
          user: record.teamMember,
          details: `Location: ${record.location}`,
          photos: record.evidencePhotos
      });
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
        
        // Log activity
        await saveActivityLog({
            type: 'update',
            title: 'Audit Record Updated',
            description: `Audit record ${id} was updated.`,
            user: 'User/Admin'
        });
    } catch (e) {
        console.error("Update failed:", e);
        throw e;
    }
};

export const deleteAuditLog = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTIONS.AUDIT_LOGS, id));
        window.dispatchEvent(new Event('auditDataChanged'));
        
        // Log activity
        await saveActivityLog({
            type: 'delete',
            title: 'Audit Record Deleted',
            description: `Audit record ${id} was deleted.`,
            user: 'Admin'
        });
    } catch (e) {
        console.error("Cloud delete failed:", e);
        throw e;
    }
};

// --- HELPER: MOVE DATA (Copy then Delete) ---
const moveCollectionData = async (
    sourceCol: string, 
    targetCol: string, 
    onStatus?: (msg: string) => void
) => {
    const snapshot = await getDocs(collection(db, sourceCol));
    if (snapshot.empty) return;

    const total = snapshot.docs.length;
    const batchSize = 400; // Batch limit
    
    // Step 1: Write to Target
    if (onStatus) onStatus(`Backing up ${sourceCol}...`);
    for (let i = 0; i < total; i += batchSize) {
        const batch = writeBatch(db);
        snapshot.docs.slice(i, i + batchSize).forEach(d => {
            batch.set(doc(db, targetCol, d.id), d.data());
        });
        await batch.commit();
    }

    // Step 2: Delete from Source
    if (onStatus) onStatus(`Clearing ${sourceCol}...`);
    for (let i = 0; i < total; i += batchSize) {
        const batch = writeBatch(db);
        snapshot.docs.slice(i, i + batchSize).forEach(d => {
            batch.delete(doc(db, sourceCol, d.id));
        });
        await batch.commit();
    }
};

// --- HELPER: CLEAR COLLECTION ---
const clearCollection = async (colName: string) => {
    const snapshot = await getDocs(collection(db, colName));
    if (snapshot.empty) return;
    const batchSize = 400;
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        snapshot.docs.slice(i, i + batchSize).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
};

// --- FEATURE: RESET ALL DATA (With Backup) ---
export const resetAllAuditData = async (onStatus?: (msg: string) => void) => {
    try {
        // 1. Check if there is data to reset. If empty, DO NOT overwrite backup with nothing.
        const logsSnap = await getDocs(collection(db, COLLECTIONS.AUDIT_LOGS));
        const statesSnap = await getDocs(collection(db, COLLECTIONS.LOCATION_STATES));

        if (logsSnap.empty && statesSnap.empty) {
            throw new Error("Tidak ada data untuk di-reset.");
        }

        if (onStatus) onStatus("Menyiapkan backup...");

        // 2. Clear OLD Backup first (to ensure we store the latest state)
        await clearCollection(BACKUP_COLLECTIONS.AUDIT_LOGS);
        await clearCollection(BACKUP_COLLECTIONS.LOCATION_STATES);

        // 3. Move Active Data -> Backup Collection
        await moveCollectionData(COLLECTIONS.AUDIT_LOGS, BACKUP_COLLECTIONS.AUDIT_LOGS, onStatus);
        await moveCollectionData(COLLECTIONS.LOCATION_STATES, BACKUP_COLLECTIONS.LOCATION_STATES, onStatus);

        // 4. Clear Local Storage
        localStorage.removeItem(LOCAL_KEYS.AUDIT_LOGS);
        localStorage.removeItem(LOCAL_KEYS.STATES);

        window.dispatchEvent(new Event('auditDataChanged'));
        if (onStatus) onStatus("Selesai! Data lama tersimpan di backup.");
        
        // Log activity
        await saveActivityLog({
            type: 'adjustment',
            title: 'System Reset',
            description: 'All audit data has been reset and moved to backup.',
            user: 'Admin'
        });
    } catch (e: any) {
        console.error("Reset failed:", e);
        throw new Error(e.message || "Gagal mereset data.");
    }
};

// --- FEATURE: RESTORE DATA ---
export const restoreAuditData = async (onStatus?: (msg: string) => void) => {
    try {
        if (onStatus) onStatus("Mengecek backup...");

        const logsBackupSnap = await getDocs(collection(db, BACKUP_COLLECTIONS.AUDIT_LOGS));
        const statesBackupSnap = await getDocs(collection(db, BACKUP_COLLECTIONS.LOCATION_STATES));

        if (logsBackupSnap.empty && statesBackupSnap.empty) {
            throw new Error("Tidak ada data backup yang ditemukan.");
        }

        // Move Backup -> Active Collection
        await moveCollectionData(BACKUP_COLLECTIONS.AUDIT_LOGS, COLLECTIONS.AUDIT_LOGS, onStatus);
        await moveCollectionData(BACKUP_COLLECTIONS.LOCATION_STATES, COLLECTIONS.LOCATION_STATES, onStatus);

        window.dispatchEvent(new Event('auditDataChanged'));
        if (onStatus) onStatus("Data berhasil dikembalikan!");

        // Log activity
        await saveActivityLog({
            type: 'adjustment',
            title: 'Data Restored',
            description: 'Audit data has been restored from backup.',
            user: 'Admin'
        });
    } catch (e: any) {
        console.error("Restore failed:", e);
        throw new Error(e.message || "Gagal mengembalikan data.");
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
        
        // Log activity
        await saveActivityLog({
            type: status === 'damaged' ? 'alert' : 'update',
            title: status === 'damaged' ? 'Discrepancy Alert' : 'Location Status Updated',
            description: status === 'damaged' 
                ? `Critical mismatch detected in ${locationName}. Manual review required.`
                : `Location ${locationName} status changed to ${status}.`,
            user: data?.teamMember || 'System',
            details: data?.description,
            photos: data?.photoUrl ? [data.photoUrl] : undefined
        });
    } catch (e) {
        console.error("Location status update failed:", e);
    }
};

export const getAuditLogs = async (): Promise<AuditRecord[]> => getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
export const getLocationStates = async (): Promise<Record<string, LocationState>> => getLocal<Record<string, LocationState>>(LOCAL_KEYS.STATES, {});
