
import { supabase } from './supabaseClient';
import { AuditRecord, MasterItem, MasterLocation, LocationState, LocationStatusType, ActivityLog } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
    let currentData: AuditRecord[] = [];

    const fetchInitial = async () => {
        const { data, error } = await supabase.from(TABLES.AUDIT_LOGS).select('*').order('timestamp', { ascending: false });
        if (error) {
            if (onError) onError(error);
        } else {
            currentData = data as AuditRecord[];
            setLocal(LOCAL_KEYS.AUDIT_LOGS, currentData);
            onUpdate(currentData);
        }
    };

    fetchInitial();

    const channel = supabase.channel('audit_logs_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.AUDIT_LOGS }, async () => {
            await fetchInitial();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

export const subscribeToMasterData = (onUpdate: (data: MasterItem[]) => void, onError?: (error: any) => void) => {
    let currentData: MasterItem[] = [];

    const fetchInitial = async () => {
        const { data, error } = await supabase.from(TABLES.MASTER_DATA).select('*');
        if (error) {
            if (onError) onError(error);
        } else {
            currentData = data as MasterItem[];
            setLocal(LOCAL_KEYS.MASTER_DATA, currentData);
            onUpdate(currentData);
        }
    };

    fetchInitial();

    const channel = supabase.channel('master_data_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.MASTER_DATA }, async () => {
            await fetchInitial();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

export const subscribeToLocationStates = (onUpdate: (data: Record<string, LocationState>) => void, onError?: (error: any) => void) => {
    let currentData: Record<string, LocationState> = {};

    const fetchInitial = async () => {
        const { data, error } = await supabase.from(TABLES.LOCATION_STATES).select('*');
        if (error) {
            if (onError) onError(error);
        } else {
            const states: Record<string, LocationState> = {};
            (data as LocationState[]).forEach(doc => { states[doc.locationId] = doc; });
            currentData = states;
            setLocal(LOCAL_KEYS.STATES, currentData);
            onUpdate(currentData);
        }
    };

    fetchInitial();

    const channel = supabase.channel('location_states_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.LOCATION_STATES }, async () => {
            await fetchInitial();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

export const subscribeToActivityLogs = (onUpdate: (data: ActivityLog[]) => void, onError?: (error: any) => void) => {
    let currentData: ActivityLog[] = [];

    const fetchInitial = async () => {
        const { data, error } = await supabase.from(TABLES.ACTIVITY_LOGS).select('*').order('timestamp', { ascending: false });
        if (error) {
            if (onError) onError(error);
        } else {
            currentData = data as ActivityLog[];
            setLocal(LOCAL_KEYS.ACTIVITY_LOGS, currentData);
            onUpdate(currentData);
        }
    };

    fetchInitial();

    const channel = supabase.channel('activity_logs_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.ACTIVITY_LOGS }, async () => {
            await fetchInitial();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
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
    await supabase.from(TABLES.ACTIVITY_LOGS).insert(fullLog);
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
        const { data, error } = await supabase.from(TABLES.MASTER_DATA).select('*');
        if (error) throw error;
        setLocal(LOCAL_KEYS.MASTER_DATA, data);
        return data as MasterItem[];
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
        const chunk = items.slice(i, i + batchSize);
        await supabase.from(TABLES.MASTER_DATA).upsert(chunk, { onConflict: 'sku' });
        if (onProgress) onProgress(Math.round(((i + chunk.length) / total) * 100));
    }
    await fetchMasterData();
    
    await saveActivityLog({
        type: 'update',
        title: 'Master Data Updated',
        description: `Successfully imported ${total} items to master database.`,
        user: 'System/Admin'
    });
};

export const deleteAllMasterData = async (onStatus?: (msg: string) => void) => {
    if (onStatus) onStatus(`Cleaning master data...`);
    // Supabase requires a filter for delete. We delete where sku is not null.
    await supabase.from(TABLES.MASTER_DATA).delete().neq('sku', 'dummy_value_to_delete_all');
    setLocal(LOCAL_KEYS.MASTER_DATA, []);
    
    await saveActivityLog({
        type: 'delete',
        title: 'Master Data Cleared',
        description: 'All items in the master database have been deleted.',
        user: 'Admin'
    });
};

export const saveAuditLog = async (record: AuditRecord) => {
  try {
      const { error: logError } = await supabase.from(TABLES.AUDIT_LOGS).insert(record);
      if (logError) throw logError;

      const { error: stateError } = await supabase.from(TABLES.LOCATION_STATES).upsert({
          locationId: record.location,
          status: 'audited',
          timestamp: record.timestamp,
          photoUrl: record.evidencePhotos?.[0],
          description: record.notes,
          reportedBy: record.teamMember
      }, { onConflict: 'locationId' });
      if (stateError) throw stateError;
      
      window.dispatchEvent(new Event('auditDataChanged'));
      
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
      throw error;
  }
};

export const updateAuditLog = async (id: string, updates: Partial<AuditRecord>) => {
    try {
        const { error } = await supabase.from(TABLES.AUDIT_LOGS).update(updates).eq('id', id);
        if (error) throw error;
        window.dispatchEvent(new Event('auditDataChanged'));
        
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
        const { error } = await supabase.from(TABLES.AUDIT_LOGS).delete().eq('id', id);
        if (error) throw error;
        window.dispatchEvent(new Event('auditDataChanged'));
        
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
const moveTableData = async (
    sourceTable: string, 
    targetTable: string, 
    onStatus?: (msg: string) => void
) => {
    const { data, error } = await supabase.from(sourceTable).select('*');
    if (error || !data || data.length === 0) return;

    const total = data.length;
    const batchSize = 400;
    
    if (onStatus) onStatus(`Backing up ${sourceTable}...`);
    for (let i = 0; i < total; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        await supabase.from(targetTable).upsert(chunk);
    }

    if (onStatus) onStatus(`Clearing ${sourceTable}...`);
    // Delete all
    await supabase.from(sourceTable).delete().neq('id', 'dummy'); 
    // Note: for location_states the PK is locationId, so we might need a different condition if 'id' doesn't exist.
    // Let's use a condition that is always true for the table.
    // For audit_logs it's 'id', for location_states it's 'locationId'.
    const pkColumn = sourceTable.includes('location') ? 'locationId' : 'id';
    await supabase.from(sourceTable).delete().neq(pkColumn, 'dummy');
};

// --- HELPER: CLEAR TABLE ---
const clearTable = async (tableName: string) => {
    const pkColumn = tableName.includes('location') ? 'locationId' : 'id';
    await supabase.from(tableName).delete().neq(pkColumn, 'dummy');
};

// --- FEATURE: RESET ALL DATA (With Backup) ---
export const resetAllAuditData = async (onStatus?: (msg: string) => void) => {
    try {
        const { count: logsCount } = await supabase.from(TABLES.AUDIT_LOGS).select('*', { count: 'exact', head: true });
        const { count: statesCount } = await supabase.from(TABLES.LOCATION_STATES).select('*', { count: 'exact', head: true });

        if (!logsCount && !statesCount) {
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

        const { count: logsCount } = await supabase.from(BACKUP_TABLES.AUDIT_LOGS).select('*', { count: 'exact', head: true });
        const { count: statesCount } = await supabase.from(BACKUP_TABLES.LOCATION_STATES).select('*', { count: 'exact', head: true });

        if (!logsCount && !statesCount) {
            throw new Error("Tidak ada data backup yang ditemukan.");
        }

        await moveTableData(BACKUP_TABLES.AUDIT_LOGS, TABLES.AUDIT_LOGS, onStatus);
        await moveTableData(BACKUP_TABLES.LOCATION_STATES, TABLES.LOCATION_STATES, onStatus);

        window.dispatchEvent(new Event('auditDataChanged'));
        if (onStatus) onStatus("Data berhasil dikembalikan!");

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
        await supabase.from(TABLES.LOCATION_STATES).upsert(state, { onConflict: 'locationId' });
        
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

