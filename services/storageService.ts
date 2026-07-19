import { db, handleFirestoreError, OperationType } from './firebaseClient';
import { 
  collection, 
  doc, 
  query, 
  orderBy, 
  getDoc,
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  onSnapshot, 
  writeBatch
} from 'firebase/firestore';
import { AuditRecord, MasterItem, MasterLocation, LocationState, LocationStatusType, ActivityLog } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { appendAuditLogToSheets } from './googleSheets';

const TABLES = {
  MASTER_DATA: 'master_data',
  AUDIT_LOGS: 'audit_logs',
  MASTER_LOCATIONS: 'master_locations',
  LOCATION_STATES: 'location_states',
  ACTIVITY_LOGS: 'activity_logs'
};

const BACKUP_TABLES = {
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

let onPermissionError: ((error: any) => void) | null = null;
export const setPermissionErrorHandler = (handler: (error: any) => void) => {
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

// --- SUBSCRIPTIONS ---

export const subscribeToAuditLogs = (onUpdate: (data: AuditRecord[]) => void, onError?: (error: any) => void) => {
    const q = query(collection(db, TABLES.AUDIT_LOGS), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const auditLogs: AuditRecord[] = [];
        snapshot.forEach((doc) => {
            auditLogs.push(doc.data() as AuditRecord);
        });
        setLocal(LOCAL_KEYS.AUDIT_LOGS, auditLogs);
        onUpdate(auditLogs);
    }, (error) => {
        console.error("Audit logs subscription error:", error);
        if (onError) onError(error);
        else handleFirestoreError(error, OperationType.LIST, TABLES.AUDIT_LOGS);
    });

    return unsubscribe;
};

export const subscribeToMasterData = (onUpdate: (data: MasterItem[]) => void, onError?: (error: any) => void) => {
    const q = collection(db, TABLES.MASTER_DATA);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: MasterItem[] = [];
        snapshot.forEach((doc) => {
            list.push(doc.data() as MasterItem);
        });
        setLocal(LOCAL_KEYS.MASTER_DATA, list);
        onUpdate(list);
    }, (error) => {
        console.error("Master data subscription error:", error);
        if (onError) onError(error);
        else handleFirestoreError(error, OperationType.LIST, TABLES.MASTER_DATA);
    });

    return unsubscribe;
};

export const subscribeToLocationStates = (onUpdate: (data: Record<string, LocationState>) => void, onError?: (error: any) => void) => {
    const q = collection(db, TABLES.LOCATION_STATES);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const states: Record<string, LocationState> = {};
        snapshot.forEach((doc) => {
            const item = doc.data() as LocationState;
            states[item.locationId] = item;
        });
        setLocal(LOCAL_KEYS.STATES, states);
        onUpdate(states);
    }, (error) => {
        console.error("Location states subscription error:", error);
        if (onError) onError(error);
        else handleFirestoreError(error, OperationType.LIST, TABLES.LOCATION_STATES);
    });

    return unsubscribe;
};

export const subscribeToActivityLogs = (onUpdate: (data: ActivityLog[]) => void, onError?: (error: any) => void) => {
    const q = query(collection(db, TABLES.ACTIVITY_LOGS), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: ActivityLog[] = [];
        snapshot.forEach((doc) => {
            list.push(doc.data() as ActivityLog);
        });
        setLocal(LOCAL_KEYS.ACTIVITY_LOGS, list);
        onUpdate(list);
    }, (error) => {
        console.error("Activity logs subscription error:", error);
        if (onError) onError(error);
        else handleFirestoreError(error, OperationType.LIST, TABLES.ACTIVITY_LOGS);
    });

    return unsubscribe;
};

// --- OPERATIONS ---

export const saveActivityLog = async (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
  try {
    const id = uuidv4();
    const fullLog: ActivityLog = {
      ...log,
      id,
      timestamp: Date.now()
    };
    try {
        await setDoc(doc(db, TABLES.ACTIVITY_LOGS, id), fullLog);
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `${TABLES.ACTIVITY_LOGS}/${id}`);
    }
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
        let snapshot;
        try {
            snapshot = await getDocs(collection(db, TABLES.MASTER_DATA));
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, TABLES.MASTER_DATA);
        }

        const data: MasterItem[] = [];
        snapshot.forEach((doc) => {
            data.push(doc.data() as MasterItem);
        });
        setLocal(LOCAL_KEYS.MASTER_DATA, data);
        return data;
    } catch (e) {
        console.error("Fetch master data failed:", e);
        return getLocal<MasterItem[]>(LOCAL_KEYS.MASTER_DATA, []);
    }
};

export const getMasterLocations = async (): Promise<MasterLocation[]> => getLocal<MasterLocation[]>(LOCAL_KEYS.LOCATIONS, []);

export const saveMasterData = async (items: MasterItem[], onProgress?: (progress: number) => void) => {
    const batchSize = 400;
    const total = items.length;
    for (let i = 0; i < total; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach(item => {
            const docRef = doc(db, TABLES.MASTER_DATA, item.sku);
            batch.set(docRef, item);
        });
        try {
            await batch.commit();
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, TABLES.MASTER_DATA);
        }
        if (onProgress) onProgress(Math.round(((i + chunk.length) / total) * 100));
    }
    await fetchMasterData();
    
    await saveActivityLog({
        type: 'update',
        title: 'Master Data Updated',
        description: `Berhasil mengimpor ${total} item ke database master.`,
        user: 'System/Admin'
    });
};

export const deleteAllMasterData = async (onStatus?: (msg: string) => void) => {
    if (onStatus) onStatus(`Cleaning master data...`);
    try {
        await clearTable(TABLES.MASTER_DATA);
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, TABLES.MASTER_DATA);
    }
    setLocal(LOCAL_KEYS.MASTER_DATA, []);
    
    await saveActivityLog({
        type: 'delete',
        title: 'Master Data Cleared',
        description: 'Semua item di database master telah dihapus.',
        user: 'Admin'
    });
};

export const saveAuditLog = async (record: AuditRecord) => {
  try {
      // 1. Save to Google Sheets first
      await appendAuditLogToSheets(record);

      // 2. Save only minimal data to Firebase as requested
      try {
          const minimalRecord = {
              id: record.id,
              teamMember: record.teamMember,
              evidencePhotos: record.evidencePhotos || [],
              itemName: record.itemName, // Needed for photo view
              sku: record.sku, // Needed for photo view
              location: record.location, // Needed for photo view
              timestamp: record.timestamp
          };
          await setDoc(doc(db, TABLES.AUDIT_LOGS, record.id), minimalRecord);
      } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `${TABLES.AUDIT_LOGS}/${record.id}`);
      }

      const state: LocationState = {
          locationId: record.location,
          status: 'audited',
          timestamp: record.timestamp,
          photoUrl: record.evidencePhotos?.[0],
          description: record.notes,
          reportedBy: record.teamMember
      };

      try {
          await setDoc(doc(db, TABLES.LOCATION_STATES, record.location), state);
      } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `${TABLES.LOCATION_STATES}/${record.location}`);
      }
      
      // Update local storage so dashboard still shows it temporarily if needed
      const currentLogs = getLocal<AuditRecord[]>(LOCAL_KEYS.AUDIT_LOGS, []);
      setLocal(LOCAL_KEYS.AUDIT_LOGS, [record, ...currentLogs]);
      
      window.dispatchEvent(new Event('auditDataChanged'));
      
      await saveActivityLog({
          type: 'scan',
          title: 'Scan Terverifikasi (Tersimpan ke Sheets)',
          description: `Operator: ${record.teamMember} memindai ${record.physicalQty} unit SKU: ${record.sku}`,
          user: record.teamMember,
          details: `Lokasi: ${record.location}`,
          photos: record.evidencePhotos
      });
  } catch (error: any) {
      console.error("Save failed:", error);
      throw error;
  }
};

export const updateAuditLog = async (id: string, updates: Partial<AuditRecord>) => {
    try {
        try {
            await updateDoc(doc(db, TABLES.AUDIT_LOGS, id), updates);
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `${TABLES.AUDIT_LOGS}/${id}`);
        }
        window.dispatchEvent(new Event('auditDataChanged'));
        
        await saveActivityLog({
            type: 'update',
            title: 'Audit Record Updated',
            description: `Catatan audit ${id} telah diperbarui.`,
            user: 'User/Admin'
        });
    } catch (e) {
        console.error("Update failed:", e);
        throw e;
    }
};

export const deleteAuditLog = async (id: string) => {
    try {
        try {
            await deleteDoc(doc(db, TABLES.AUDIT_LOGS, id));
        } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `${TABLES.AUDIT_LOGS}/${id}`);
        }
        window.dispatchEvent(new Event('auditDataChanged'));
        
        await saveActivityLog({
            type: 'delete',
            title: 'Audit Record Deleted',
            description: `Catatan audit ${id} telah dihapus.`,
            user: 'Admin'
        });
    } catch (e) {
        console.error("Cloud delete failed:", e);
        throw e;
    }
};

// --- HELPER: MOVE DATA (Copy then Delete) ---
const moveTableData = async (
    sourceCollection: string, 
    targetCollection: string, 
    onStatus?: (msg: string) => void
) => {
    let snapshot;
    try {
        snapshot = await getDocs(collection(db, sourceCollection));
    } catch (e) {
        handleFirestoreError(e, OperationType.LIST, sourceCollection);
    }
    
    if (snapshot.empty) return;

    const docs = snapshot.docs;
    const total = docs.length;
    const batchSize = 400;
    
    if (onStatus) onStatus(`Backing up ${sourceCollection}...`);
    for (let i = 0; i < total; i += batchSize) {
        const chunk = docs.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach(docSnap => {
            const targetDocRef = doc(db, targetCollection, docSnap.id);
            batch.set(targetDocRef, docSnap.data());
        });
        await batch.commit();
    }

    if (onStatus) onStatus(`Clearing ${sourceCollection}...`);
    const deleteBatch = writeBatch(db);
    docs.forEach(docSnap => {
        deleteBatch.delete(docSnap.ref);
    });
    await deleteBatch.commit();
};

// --- HELPER: CLEAR TABLE ---
const clearTable = async (collectionName: string) => {
    const snapshot = await getDocs(collection(db, collectionName));
    if (snapshot.empty) return;
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
    });
    await batch.commit();
};

// --- FEATURE: RESET ALL DATA (With Backup) ---
export const resetAllAuditData = async (onStatus?: (msg: string) => void) => {
    try {
        let logsSnap, statesSnap;
        try {
            logsSnap = await getDocs(collection(db, TABLES.AUDIT_LOGS));
            statesSnap = await getDocs(collection(db, TABLES.LOCATION_STATES));
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'All');
        }

        if (logsSnap.empty && statesSnap.empty) {
            throw new Error("Tidak ada data untuk di-reset.");
        }

        if (onStatus) onStatus("Menyiapkan backup...");

        await clearTable(BACKUP_TABLES.AUDIT_LOGS);
        await clearTable(BACKUP_TABLES.LOCATION_STATES);

        await moveTableData(TABLES.AUDIT_LOGS, BACKUP_TABLES.AUDIT_LOGS, onStatus);
        await moveTableData(TABLES.LOCATION_STATES, BACKUP_TABLES.LOCATION_STATES, onStatus);

        localStorage.removeItem(LOCAL_KEYS.AUDIT_LOGS);
        localStorage.removeItem(LOCAL_KEYS.STATES);

        window.dispatchEvent(new Event('auditDataChanged'));
        if (onStatus) onStatus("Selesai! Data lama tersimpan di backup.");
        
        await saveActivityLog({
            type: 'adjustment',
            title: 'System Reset',
            description: 'Semua data audit telah di-reset dan dipindah ke backup.',
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

        let logsSnap, statesSnap;
        try {
            logsSnap = await getDocs(collection(db, BACKUP_TABLES.AUDIT_LOGS));
            statesSnap = await getDocs(collection(db, BACKUP_TABLES.LOCATION_STATES));
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'Backup');
        }

        if (logsSnap.empty && statesSnap.empty) {
            throw new Error("Tidak ada data backup yang ditemukan.");
        }

        await moveTableData(BACKUP_TABLES.AUDIT_LOGS, TABLES.AUDIT_LOGS, onStatus);
        await moveTableData(BACKUP_TABLES.LOCATION_STATES, TABLES.LOCATION_STATES, onStatus);

        window.dispatchEvent(new Event('auditDataChanged'));
        if (onStatus) onStatus("Data berhasil dikembalikan!");

        await saveActivityLog({
            type: 'adjustment',
            title: 'Data Restored',
            description: 'Data audit telah dipulihkan dari data cadangan (backup).',
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
        try {
            await setDoc(doc(db, TABLES.LOCATION_STATES, locationName), state);
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `${TABLES.LOCATION_STATES}/${locationName}`);
        }
        
        await saveActivityLog({
            type: status === 'damaged' ? 'alert' : 'update',
            title: status === 'damaged' ? 'Discrepancy Alert' : 'Location Status Updated',
            description: status === 'damaged' 
                ? `Ketidaksesuaian kritis terdeteksi di lokasi ${locationName}. Diperlukan review manual.`
                : `Status lokasi ${locationName} berubah menjadi ${status}.`,
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
