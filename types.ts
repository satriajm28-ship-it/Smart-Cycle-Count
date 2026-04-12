
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
  evidencePhotos?: string[];
}

export enum AppView {
  FORM = 'FORM',
  DASHBOARD = 'DASHBOARD',
  MASTER_DATA = 'MASTER_DATA',
  DAMAGED_REPORT = 'DAMAGED_REPORT',
  ACTIVITIES = 'ACTIVITIES',
  USER_MANAGEMENT = 'USER_MANAGEMENT'
}

export interface ActivityLog {
  id: string;
  type: 'create' | 'update' | 'delete' | 'scan' | 'adjustment' | 'alert' | 'start';
  title: string;
  description: string;
  timestamp: number;
  user: string;
  details?: string;
  photos?: string[];
}

export interface InventoryStats {
  totalItemsScanned: number;
  totalVariance: number;
  accuracyRate: number;
  flaggedItems: number;
}

// --- AUTH TYPES ---
export type UserRole = 'admin' | 'user';

export interface AppUser {
  username: string;
  role: UserRole;
  name: string;
}
