
export interface MasterItem {
  sku: string;
  name: string;
  systemStock: number;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  category: string;
  unit: string;
}

export interface MasterLocation {
  id: string;
  name: string;
  zone: string;
}

export type LocationStatusType = 'pending' | 'audited' | 'empty' | 'damaged';

export interface LocationState {
  locationId: string; // matches MasterLocation.name or id
  status: LocationStatusType;
  timestamp: number;
  photoUrl?: string; // Base64 string for evidence
  description?: string; // Description of damage
  reportedBy?: string;
}

export interface AuditRecord {
  id: string;
  sku: string;
  itemName: string;
  location: string;
  batchNumber: string;
  expiryDate: string;
  systemQty: number;
  physicalQty: number;
  variance: number;
  timestamp: number; // Unix timestamp
  teamMember: string;
  notes?: string;
}

export enum AppView {
  FORM = 'FORM',
  DASHBOARD = 'DASHBOARD',
  MASTER_DATA = 'MASTER_DATA',
  LOCATION_CHECKLIST = 'LOCATION_CHECKLIST',
  DAMAGED_REPORT = 'DAMAGED_REPORT'
}

export interface InventoryStats {
  totalItemsScanned: number;
  totalVariance: number;
  accuracyRate: number;
  flaggedItems: number;
}
