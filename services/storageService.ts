
import { AuditRecord, MasterItem, MasterLocation, LocationState } from '../types';

const STORAGE_KEYS = {
  MASTER_DATA: 'stock_opname_master_v1',
  AUDIT_LOGS: 'stock_opname_logs_v1',
  MASTER_LOCATIONS: 'stock_opname_locations_v1',
  LOCATION_STATES: 'stock_opname_location_states_v1'
};

// Seed data for Items
const DEFAULT_MASTER_DATA: MasterItem[] = [
  { sku: 'BRG-882910', name: 'Indomie Goreng Special 85g', systemStock: 50, batchNumber: 'BATCH-2023-X', expiryDate: '2024-12-12', category: 'Food', unit: 'Pcs' },
  { sku: '123BX', name: 'Example Test Item', systemStock: 200, batchNumber: 'DEFAULT-BATCH', expiryDate: '2025-01-01', category: 'General', unit: 'Pcs' },
  { sku: '89999090901', name: 'Paracetamol 500mg', systemStock: 100, batchNumber: 'B202301', expiryDate: '2025-12-31', category: 'Medicine', unit: 'Box' },
  { sku: '89999090902', name: 'Amoxicillin Syrup', systemStock: 50, batchNumber: 'B202305', expiryDate: '2024-06-30', category: 'Medicine', unit: 'Bottle' },
  { sku: '89999090903', name: 'Vitamin C 1000mg', systemStock: 200, batchNumber: 'B202401', expiryDate: '2026-01-15', category: 'Supplement', unit: 'Tube' },
  { sku: '89999090904', name: 'Surgical Mask 3-Ply', systemStock: 500, batchNumber: 'M202399', expiryDate: '2028-05-20', category: 'Equipment', unit: 'Box' },
  { sku: '89999090905', name: 'Hand Sanitizer 500ml', systemStock: 75, batchNumber: 'H202311', expiryDate: '2025-08-10', category: 'Equipment', unit: 'Bottle' },
];

// Seed data for Locations
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

export const getMasterData = (): MasterItem[] => {
  const data = localStorage.getItem(STORAGE_KEYS.MASTER_DATA);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.MASTER_DATA, JSON.stringify(DEFAULT_MASTER_DATA));
    return DEFAULT_MASTER_DATA;
  }
  return JSON.parse(data);
};

export const saveMasterData = (data: MasterItem[]) => {
  localStorage.setItem(STORAGE_KEYS.MASTER_DATA, JSON.stringify(data));
};

export const getMasterLocations = (): MasterLocation[] => {
    const data = localStorage.getItem(STORAGE_KEYS.MASTER_LOCATIONS);
    if (!data) {
        localStorage.setItem(STORAGE_KEYS.MASTER_LOCATIONS, JSON.stringify(DEFAULT_LOCATIONS));
        return DEFAULT_LOCATIONS;
    }
    return JSON.parse(data);
};

export const getAuditLogs = (): AuditRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
  return data ? JSON.parse(data) : [];
};

export const saveAuditLog = (record: AuditRecord) => {
  const logs = getAuditLogs();
  logs.unshift(record); 
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
  
  // Implicitly mark location as Audited
  updateLocationStatus(record.location, 'audited');
};

export const clearAuditLogs = () => {
  localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
  localStorage.removeItem(STORAGE_KEYS.LOCATION_STATES);
};

export const findItemBySku = (sku: string): MasterItem | undefined => {
  const items = getMasterData();
  return items.find(i => i.sku === sku);
};

// --- LOCATION STATUS LOGIC ---

export const getLocationStates = (): Record<string, LocationState> => {
    const data = localStorage.getItem(STORAGE_KEYS.LOCATION_STATES);
    return data ? JSON.parse(data) : {};
};

export const updateLocationStatus = (
    locationName: string, 
    status: 'audited' | 'empty' | 'damaged',
    data?: { photoUrl?: string, description?: string, teamMember?: string }
) => {
    const states = getLocationStates();
    
    states[locationName] = {
        locationId: locationName,
        status,
        timestamp: Date.now(),
        photoUrl: data?.photoUrl,
        description: data?.description,
        reportedBy: data?.teamMember
    };
    
    localStorage.setItem(STORAGE_KEYS.LOCATION_STATES, JSON.stringify(states));
};
