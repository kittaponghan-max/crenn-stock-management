export type Branch = 'Bangkok' | 'Rayong';

export interface Ingredient {
  id: string;
  name: string;
  brand?: string;
  sizePerUnit?: string;
  minStock: number;
  minOrder: number;
  supplier: string;
  unit: string;
  category: string;
  image?: string;
  department?: 'Bar' | 'Bakery' | 'Kitchen';
  branch?: Branch;
}

export interface DailyStock {
  in?: number;
  out?: number;
  remaining?: number;
}

export interface StockRecord {
  [date: string]: {
    [ingredientId: string]: number | DailyStock;
  };
}

export interface ReceivingRecord {
  id: string;
  date: string;
  ingredientId: string;
  supplier: string;
  quantity: number;
  expiryDate: string;
  userName?: string;
  branch?: Branch;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  userRole: string;
  action: string;
  details: string;
  branch?: Branch;
}

export interface WasteLogEntry {
  id: string;
  timestamp: string;
  date: string;
  department: 'Bar' | 'Bakery' | 'Kitchen';
  ingredientId: string;
  ingredientName: string; // snapshot in case it's deleted
  quantity: number;
  unit: string;
  cause: string;
  solution: string;
  imageUrl?: string;
  recorderName: string;
  branch?: Branch;
}

export interface RnDReportEntry {
  id: string;
  timestamp: string;
  date: string;
  menuNameTH: string;
  menuNameEN: string;
  productLooks: string;
  component: string;
  taste: string | string[];
  flavor: string | string[];
  tasteResult: string | string[];
  improvements: string | string[];
  commenterName?: string;
  imageUrl?: string;
  imageUrls?: string[];
  recorderName: string;
  branch?: Branch;
}

export type PermissionLevel = 'Hidden' | 'Review' | 'Edit';

export interface AppPermissions {
  dashboardBar: PermissionLevel;
  dashboardBakery: PermissionLevel;
  // Stock Table
  stockTableBar: PermissionLevel;
  stockTableBakery: PermissionLevel;
  bakeryPlan: PermissionLevel;
  // Receiving
  barReceiving: PermissionLevel;
  bakeryReceiving: PermissionLevel;
  // Daily Count
  dailyStockCountBar: PermissionLevel;
  dailyStockCountBakery: PermissionLevel;
  // Checklists
  checklistsBar: PermissionLevel;
  checklistsBakery: PermissionLevel;
  // Reports & History
  purchasingReport: PermissionLevel;
  rndReport: PermissionLevel;
  historyLogs: PermissionLevel;
  historyChecklist: PermissionLevel;
  historyWaste: PermissionLevel;
  historyReceiving: PermissionLevel;
  
  manageIngredients: PermissionLevel;
  adminTools: PermissionLevel;
}

export interface AppUser {
  id: string;
  name: string;
  role: string;
  password?: string;
  permissions?: AppPermissions;
  branch?: Branch;
}

export const BAR_CATEGORIES = [
  'Coffee',
  'Milk & Dairy',
  'Syrups',
  'Powders',
  'Packaging',
  'Supplies',
  'Others',
];

export const BAKERY_CATEGORIES = [
  'แป้ง (Flours)',
  'ผลไม้ (Fruits)',
  'ผลิตภัณฑ์นม (Dairy)',
  'ช็อกโกแลตและชา (Chocolate & Tea)',
  'ถั่วและธัญพืช (Nuts & Seeds)',
  'เนื้อสัตว์และไข่ (Meats & Eggs)',
  'น้ำตาลและไซรัป (Sugar & Syrups)',
  'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)',
  'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)',
  'ผลิตภัณฑ์ทำความสะอาด (Cleaning Supplies)',
  'อื่นๆ (Others)'
];

export const CATEGORIES = [...BAR_CATEGORIES, ...BAKERY_CATEGORIES];
