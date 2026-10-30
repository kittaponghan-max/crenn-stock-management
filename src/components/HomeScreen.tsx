import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Bell, 
  Calendar, 
  MapPin, 
  AlertTriangle, 
  AlertCircle, 
  Database, 
  X, 
  ChevronRight, 
  ChevronDown, 
  Coffee, 
  Cake, 
  Package, 
  CheckCircle2, 
  Loader2,
  Building,
  ShoppingCart,
  Check,
  Truck,
  Wrench,
  Clock,
  RefreshCw,
  Phone,
  CalendarCheck,
  ShieldCheck,
  ArrowUpRight
} from 'lucide-react';
import { Ingredient, StockRecord, Branch, AppPermissions } from '../types';
import { UserRole } from './LoginForm';
import { TopNavCenterIcons } from './TopNavCenterIcons';
import { SupabaseStatusBar } from './SupabaseStatusBar';
import { supabase } from '../lib/supabase';
import { useObsoleteIngredients, isIngredientActive } from '../utils/obsoleteIngredients';

export interface HomeScreenProps {
  user: {
    name: string;
    role: UserRole;
    permissions?: AppPermissions;
    branch?: Branch;
  };
  ingredients: Ingredient[];
  stockRecord: StockRecord;
  onNavigate: (tab: any) => void;
  onLogout: () => void;
  dbStatus: 'connected' | 'checking' | 'offline';
  onChangeBranch?: (branch: Branch) => void;
  hasPermission?: (funcId: keyof AppPermissions) => boolean;
}

export function HomeScreen({
  user,
  ingredients,
  stockRecord,
  onNavigate,
  onLogout,
  dbStatus,
  onChangeBranch,
  hasPermission = () => true
}: HomeScreenProps) {
  // Filters
  const [timeFilter, setTimeFilter] = useState<'thisMonth' | 'thisWeek' | 'all'>('thisMonth');
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  
  // Location Filter State: "all" (ทั้งหมด) | "bar" (บาร์) | "kitchen" (ครัว)
  const [locationFilter, setLocationFilter] = useState<'all' | 'bar' | 'kitchen'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('crenn_location_filter');
        if (saved === 'bar' || saved === 'kitchen' || saved === 'all') {
          return saved;
        }
      } catch {
        // ignore
      }
    }
    return 'all';
  });
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Active KPI Card Filter State: "out_of_stock" | "low_stock" | "normal" | "purchasing" | "pending_delivery" | null
  const [activeKPI, setActiveKPI] = useState<
    'out_of_stock' | 'low_stock' | 'normal' | 'purchasing' | 'pending_delivery' | null
  >(null);

  // ─── PENDING ORDERS (รอส่งมอบ) DATA & AUTO-CLEAR LOGIC ───
  const [pendingOrders, setPendingOrders] = useState<{
    id?: string;
    ingredient_id: string;
    order_date: string;
    order_qty: number;
    order_unit?: string;
    ordered_by?: string;
    ordered_at?: string;
    branch: string;
    stock_date?: string;
    delivered_at?: string | null;
    status?: string;
    ingredient?: Ingredient | null;
  }[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('cafe_purchasing_orders');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            return list.filter(o => Boolean(o.order_date) && Number(o.order_qty) > 0 && !o.delivered_at && o.status !== 'delivered');
          }
        }
      } catch {}
    }
    return [];
  });
  const [dbIngredientsMap, setDbIngredientsMap] = useState<Record<string, Ingredient>>({});
  const [schemaNotice, setSchemaNotice] = useState<string | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [isProcessingClear, setIsProcessingClear] = useState<boolean>(false);

  // ─── 7. MAINTENANCE SCHEDULE & COUNTDOWN MONITOR STATE ───
  const [maintenanceList, setMaintenanceList] = useState<any[]>([]);
  const [loadingMaintenance, setLoadingMaintenance] = useState<boolean>(true);
  const [isRefreshingMaintenance, setIsRefreshingMaintenance] = useState<boolean>(false);
  const [maintenanceFilter, setMaintenanceFilter] = useState<'all' | 'overdue' | 'today' | 'week' | 'month' | 'future'>('all');
  const [maintenanceDeptFilter, setMaintenanceDeptFilter] = useState<'all' | 'Bar' | 'Bakery' | 'General'>('all');

  // Fetch maintenance records that have next_service_date
  const fetchMaintenanceSchedules = useCallback(async () => {
    setIsRefreshingMaintenance(true);
    let records: any[] = [];
    const currentBranch = user?.branch || 'Rayong';

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('maintenance_records')
          .select('*')
          .order('date', { ascending: false });

        if (!error && Array.isArray(data)) {
          records = data;
        }
      } catch (err) {
        console.warn('Supabase fetch maintenance failed, using fallback:', err);
      }
    }

    if (records.length === 0) {
      try {
        const branchKey = `cafe-maintenance-records-${currentBranch}`;
        const saved = localStorage.getItem(branchKey) || localStorage.getItem('cafe-maintenance-records-all');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            records = parsed;
          }
        }
      } catch (e) {
        console.warn('LocalStorage load maintenance error:', e);
      }
    }

    // Filter by branch
    const branchFiltered = records.filter((r: any) => {
      const b = r.branch || 'Rayong';
      return b === currentBranch || !r.branch;
    });

    // Normalize and filter records that have next_service_date / nextServiceDate
    const normalized = branchFiltered
      .map((r: any) => {
        const nextDate = String(r.next_service_date || r.nextServiceDate || '').trim();
        const rawDept = String(r.department || '').toLowerCase().trim();
        let dept: 'Bar' | 'Bakery' | 'General' = 'General';
        if (rawDept === 'bar' || rawDept === 'บาร์') {
          dept = 'Bar';
        } else if (rawDept === 'bakery' || rawDept === 'kitchen' || rawDept === 'เบเกอรี่' || rawDept === 'ครัว') {
          dept = 'Bakery';
        } else {
          dept = 'General';
        }

        return {
          id: r.id || String(Math.random()),
          equipmentName: r.equipment_name || r.equipmentName || 'ไม่ระบุชื่ออุปกรณ์',
          equipmentCode: r.equipment_code || r.equipmentCode || '',
          department: dept,
          category: r.category || 'General',
          maintenanceType: r.maintenance_type || r.maintenanceType || 'Preventive',
          status: r.status || 'Completed',
          details: r.details || '',
          partsReplaced: r.parts_replaced || r.partsReplaced || '',
          cost: typeof r.cost === 'number' ? r.cost : parseFloat(r.cost) || 0,
          performedBy: r.performed_by || r.performedBy || 'Internal',
          technicianName: r.technician_name || r.technicianName || '',
          contactNumber: r.contact_number || r.contactNumber || '',
          nextServiceDate: nextDate,
          date: r.date || '',
          recorderName: r.recorder_name || r.recorderName || ''
        };
      })
      .filter((r: any) => Boolean(r.nextServiceDate && r.nextServiceDate.length >= 8));

    // Sort by nextServiceDate ascending (closest / overdue first)
    normalized.sort((a: any, b: any) => {
      return new Date(a.nextServiceDate).getTime() - new Date(b.nextServiceDate).getTime();
    });

    setMaintenanceList(normalized);
    setLoadingMaintenance(false);
    setIsRefreshingMaintenance(false);
  }, [user?.branch]);

  useEffect(() => {
    fetchMaintenanceSchedules();
  }, [fetchMaintenanceSchedules]);

  // Calculate remaining days until next service date
  const calculateDaysRemaining = useCallback((targetDateStr: string): number => {
    if (!targetDateStr) return 999;
    try {
      const cleanStr = targetDateStr.split('T')[0].trim();
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const targetDate = new Date(year, month, day);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffMs = targetDate.getTime() - today.getTime();
        return Math.round(diffMs / (1000 * 60 * 60 * 24));
      }
      const d = new Date(cleanStr);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  }, []);

  // Format date in Thai readable format (e.g., 5 พ.ย. 2569)
  const formatThaiDisplayDate = useCallback((dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
      if (isNaN(d.getTime())) return dateStr;
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
    } catch {
      return dateStr;
    }
  }, []);

  // Department-filtered base list (Independent of stock location filter)
  const departmentFilteredMaintenanceList = useMemo(() => {
    if (maintenanceDeptFilter === 'all') return maintenanceList;
    return maintenanceList.filter(item => item.department === maintenanceDeptFilter);
  }, [maintenanceList, maintenanceDeptFilter]);

  // Maintenance statistics calculated from active department selection
  const maintenanceStats = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let due7Days = 0;
    let due30Days = 0;
    let future = 0;

    departmentFilteredMaintenanceList.forEach(item => {
      const days = calculateDaysRemaining(item.nextServiceDate);
      if (days < 0) {
        overdue++;
      } else if (days === 0) {
        dueToday++;
      } else if (days > 0 && days <= 7) {
        due7Days++;
      } else if (days > 7 && days <= 30) {
        due30Days++;
      } else {
        future++;
      }
    });

    return {
      total: departmentFilteredMaintenanceList.length,
      overdue,
      dueToday,
      due7Days,
      due30Days,
      future,
      urgentTotal: overdue + dueToday + due7Days
    };
  }, [departmentFilteredMaintenanceList, calculateDaysRemaining]);

  // Filtered maintenance records for display
  const displayedMaintenanceList = useMemo(() => {
    return departmentFilteredMaintenanceList.filter(item => {
      const days = calculateDaysRemaining(item.nextServiceDate);
      if (maintenanceFilter === 'overdue') {
        return days < 0;
      }
      if (maintenanceFilter === 'today') {
        return days === 0;
      }
      if (maintenanceFilter === 'week') {
        return days >= 0 && days <= 7;
      }
      if (maintenanceFilter === 'month') {
        return days >= 0 && days <= 30;
      }
      if (maintenanceFilter === 'future') {
        return days > 30;
      }
      return true; // 'all'
    });
  }, [departmentFilteredMaintenanceList, maintenanceFilter, calculateDaysRemaining]);

  // Combined ingredients map: props.ingredients + dbIngredientsMap
  const allIngredientsMap = useMemo(() => {
    const map = new Map<string, Ingredient>();
    ingredients.forEach(i => map.set(String(i.id), i));
    Object.values(dbIngredientsMap).forEach((dbIng: Ingredient) => {
      const existing = map.get(String(dbIng.id));
      if (!existing || (!existing.name && dbIng.name)) {
        map.set(String(dbIng.id), { ...existing, ...dbIng });
      } else {
        map.set(String(dbIng.id), { ...dbIng, ...existing, name: existing.name || dbIng.name });
      }
    });
    return map;
  }, [ingredients, dbIngredientsMap]);

  // Robust ingredient resolution helper: checks all sources so name and details are NEVER missing
  const resolveIngredientInfo = useCallback((order?: any, ing?: Ingredient | null) => {
    const ingId = String(order?.ingredient_id || ing?.id || '');
    
    // Check all potential sources
    const candidateFromDb = ingId ? dbIngredientsMap[ingId] : null;
    const candidateFromAll = ingId ? allIngredientsMap.get(ingId) : null;
    const candidateFromProps = ingId ? ingredients.find(i => String(i.id) === ingId) : null;
    const candidateFromOrder = order?.ingredient;

    // Prioritize candidate with a valid non-empty name
    const bestIng: Ingredient | null = [candidateFromDb, candidateFromAll, candidateFromProps, candidateFromOrder, ing]
      .find(c => c && typeof c.name === 'string' && c.name.trim().length > 0) 
      || candidateFromDb 
      || candidateFromAll 
      || candidateFromProps 
      || candidateFromOrder 
      || ing 
      || null;

    const rawName = bestIng?.name || 
      (bestIng as any)?.ingredient_name || 
      (bestIng as any)?.item_name || 
      order?.ingredient_name || 
      order?.name || 
      order?.item_name || 
      '';

    const cleanName = typeof rawName === 'string' ? rawName.trim() : '';
    const displayName = cleanName.length > 0 
      ? cleanName 
      : (ingId ? `วัตถุดิบ #${ingId}` : 'ไม่ระบุชื่อวัตถุดิบ');

    const rawBrand = (bestIng?.brand || (bestIng as any)?.ingredient_brand || order?.brand || '').trim();
    const displayBrand = (rawBrand && rawBrand !== '-') ? rawBrand : '';

    const minStock = bestIng?.minStock ?? (bestIng as any)?.min_stock ?? 0;
    const unit = bestIng?.unit || order?.order_unit || (bestIng as any)?.unit || 'หน่วย';
    const department = bestIng?.department || (bestIng as any)?.department || 'Bar';

    return {
      bestIng,
      displayName,
      displayBrand,
      minStock,
      unit,
      department
    };
  }, [dbIngredientsMap, allIngredientsMap, ingredients]);

  // Helper: Deduplicate pending delivery orders by ingredient_id
  // Sums order_qty across duplicate records and keeps the newest order information
  const deduplicatePendingOrders = useCallback((orders: any[]): any[] => {
    if (!orders || orders.length === 0) return [];

    const parseTime = (item: any) => {
      if (item.ordered_at) {
        const t = new Date(item.ordered_at).getTime();
        if (!isNaN(t)) return t;
      }
      if (item.order_date) {
        const t = new Date(item.order_date + "T00:00:00").getTime();
        if (!isNaN(t)) return t;
      }
      if (item.created_at) {
        const t = new Date(item.created_at).getTime();
        if (!isNaN(t)) return t;
      }
      return 0;
    };

    // Sort latest first
    const sorted = [...orders].sort((a, b) => parseTime(b) - parseTime(a));

    // Keep only latest per ingredient (do not sum quantities, prevent duplicate display)
    const seen = new Map<string, any>();
    sorted.forEach(order => {
      const ingId = String(order.ingredient_id || order.id || "");
      if (!ingId) return;

      if (!seen.has(ingId)) {
        seen.set(ingId, order);
      }
    });

    return Array.from(seen.values());
  }, []);

  // Format order datetime: 21/10/2026 14:58 น.
  const formatOrderDateTime = useCallback((isoOrDateStr?: string) => {
    if (!isoOrDateStr) return '';
    try {
      const d = new Date(isoOrDateStr);
      if (isNaN(d.getTime())) return isoOrDateStr;
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      if (isoOrDateStr.includes('T') || isoOrDateStr.includes(':')) {
        return `${day}/${month}/${year} ${hours}:${mins} น.`;
      }
      return `${day}/${month}/${year}`;
    } catch {
      return isoOrDateStr;
    }
  }, []);

  // Helper: calculate current stock level for an ingredient from stockRecord
  const calculateCurrentRemaining = useCallback((ingId: string): number => {
    const sortedDatesAsc = Object.keys(stockRecord).sort();
    let remaining = 0;
    sortedDatesAsc.forEach(dateKey => {
      const val = stockRecord[dateKey]?.[ingId];
      if (typeof val === 'number') {
        remaining = val;
      } else if (val) {
        if (val.remaining !== undefined && val.remaining !== null) {
          remaining = val.remaining;
        } else {
          const added = val.in || 0;
          const removed = val.out || 0;
          remaining = remaining + added - removed;
        }
      }
    });
    return remaining;
  }, [stockRecord]);

  // Helper: get latest stock update timestamp from stock_records or stockRecord
  const getLatestStockTimestamp = useCallback(async (ingId: string, currentBranch: string): Promise<Date | null> => {
    if (supabase) {
      try {
        const { data: stockRow } = await supabase
          .from('stock_records')
          .select('updated_at, created_at, record_date, remaining')
          .eq('ingredient_id', ingId)
          .eq('branch', currentBranch)
          .order('record_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (stockRow) {
          if (stockRow.updated_at) return new Date(stockRow.updated_at);
          if (stockRow.created_at) return new Date(stockRow.created_at);
          if (stockRow.record_date) return new Date(stockRow.record_date + 'T23:59:59');
        }
      } catch (e) {
        console.warn('Error querying stock_records timestamp:', e);
      }
    }

    // Fallback: check dates in stockRecord object
    const dates = Object.keys(stockRecord)
      .filter(d => stockRecord[d]?.[ingId] !== undefined)
      .sort();
    const latestDate = dates.pop();
    if (latestDate) {
      return new Date(latestDate + 'T23:59:59');
    }

    return null;
  }, [stockRecord]);

  // Helper: check if conditions 1, 2, 3 are met for delivery
  const checkDelivered = useCallback(async (order: any, currentBranch: string): Promise<boolean> => {
    const resolved = resolveIngredientInfo(order, order.ingredient);
    const minStock = resolved.minStock;
    const currentStock = calculateCurrentRemaining(order.ingredient_id);

    // CONDITION 1: current_stock >= min_stock
    const isStockSufficient = currentStock >= minStock;
    if (!isStockSufficient) return false;

    // CONDITION 3: Item exists in purchasing_orders
    if (!order.ingredient_id) return false;

    // CONDITION 2: Stock was updated AFTER order date
    const stockUpdatedAt = await getLatestStockTimestamp(order.ingredient_id, currentBranch);
    const orderedAt = new Date(order.ordered_at || (order.order_date + 'T00:00:00'));

    if (!stockUpdatedAt || isNaN(stockUpdatedAt.getTime()) || isNaN(orderedAt.getTime())) {
      return false;
    }

    const isUpdatedAfterOrder = stockUpdatedAt.getTime() > orderedAt.getTime();

    return isStockSufficient && isUpdatedAfterOrder;
  }, [resolveIngredientInfo, calculateCurrentRemaining, getLatestStockTimestamp]);

  // Main process: fetch and auto-clear pending delivery items
  const processPendingDelivery = useCallback(async () => {
    const currentBranch = user?.branch || 'Rayong';
    let orderedList: any[] = [];

    // 1. Read from localStorage for immediate display
    try {
      const raw = localStorage.getItem('cafe_purchasing_orders');
      if (raw) {
        const all: any[] = JSON.parse(raw);
        orderedList = all
          .filter(o => 
            (!o.branch || o.branch === currentBranch) &&
            Boolean(o.order_date) &&
            Number(o.order_qty) > 0 &&
            !o.delivered_at &&
            o.status !== 'delivered'
          )
          .map(o => {
            const resolved = resolveIngredientInfo(o, o.ingredient);
            return {
              ...o,
              ingredient: resolved.bestIng
            };
          });
      }
    } catch (e) {
      console.warn('Error reading local purchasing orders:', e);
    }

    // 2. Fetch from Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('purchasing_orders')
          .select('*')
          .eq('branch', currentBranch)
          .not('order_date', 'is', null)
          .gt('order_qty', 0);

        if (!error && data) {
          const rawPending = data.filter((o: any) => !o.delivered_at && o.status !== 'delivered');

          // Query ingredients separately for matching unique ingredientIds
          const uniqueIngIds = Array.from(new Set(rawPending.map((o: any) => o.ingredient_id).filter(Boolean)));
          const ingredientMap: Record<string, Ingredient> = {};

          if (uniqueIngIds.length > 0) {
            try {
              const { data: ingData, error: ingError } = await supabase
                .from('ingredients')
                .select('id, name, brand, image, unit, min_stock, department')
                .in('id', uniqueIngIds);

              if (!ingError && ingData) {
                ingData.forEach((ing: any) => {
                  ingredientMap[String(ing.id)] = {
                    id: String(ing.id),
                    name: ing.name || '',
                    brand: ing.brand || '',
                    image: ing.image || '',
                    unit: ing.unit || '',
                    minStock: ing.min_stock ?? ing.minStock ?? 0,
                    department: ing.department || 'Bar',
                    category: ing.category || '',
                    sizePerUnit: ing.size_per_unit || '',
                    supplier: ing.supplier || '',
                    minOrder: ing.min_order ?? ing.minOrder ?? 0
                  };
                });
                setDbIngredientsMap(prev => ({ ...prev, ...ingredientMap }));
              }
            } catch (ingErr) {
              console.warn('Error fetching ingredients for pending orders:', ingErr);
            }
          }

          // Merge: ingredient: ingredientMap[order.ingredient_id] || null
          orderedList = rawPending.map((order: any) => {
            const ingId = String(order.ingredient_id);
            const ing = ingredientMap[ingId] ||
              allIngredientsMap.get(ingId) ||
              ingredients.find(i => String(i.id) === ingId) ||
              order.ingredient ||
              null;
            const resolved = resolveIngredientInfo(order, ing);
            return {
              ...order,
              ingredient: resolved.bestIng
            };
          });
        } else if (error && (error.code === '42703' || error.message?.includes('column'))) {
          setSchemaNotice('กรุณาเพิ่มคอลัมน์ delivered_at (timestamp) และ status (text) ในตาราง purchasing_orders');
        }
      } catch (err) {
        console.warn('Supabase fetch orders error:', err);
      }
    }

    // 3. Evaluate each order for auto-clear
    const stillPending: any[] = [];
    const deliveredOrders: any[] = [];

    for (const order of orderedList) {
      const isDelivered = await checkDelivered(order, currentBranch);

      if (isDelivered) {
        deliveredOrders.push(order);
        const nowIso = new Date().toISOString();

        // Auto-update purchasing_orders record in Supabase
        if (supabase && order.id) {
          try {
            const { error: updateErr } = await supabase
              .from('purchasing_orders')
              .update({
                delivered_at: nowIso,
                status: 'delivered'
              })
              .eq('id', order.id);

            if (updateErr && (updateErr.code === '42703' || updateErr.message?.includes('column'))) {
              setSchemaNotice('กรุณาเพิ่มคอลัมน์ delivered_at (timestamp) และ status (text) ในตาราง purchasing_orders');
            }
          } catch (supErr) {
            console.warn('Auto-mark delivered Supabase error:', supErr);
          }
        }

        // Auto-update in localStorage
        try {
          const rawAll = localStorage.getItem('cafe_purchasing_orders');
          if (rawAll) {
            const all: any[] = JSON.parse(rawAll);
            const updated = all.map(o => {
              if (o.id === order.id || (o.ingredient_id === order.ingredient_id && o.branch === currentBranch && o.order_date === order.order_date)) {
                return { ...o, delivered_at: nowIso, status: 'delivered' };
              }
              return o;
            });
            localStorage.setItem('cafe_purchasing_orders', JSON.stringify(updated));
          }
        } catch {}
      } else {
        stillPending.push(order);
      }
    }

    setPendingOrders(deduplicatePendingOrders(stillPending));
  }, [user?.branch, ingredients, allIngredientsMap, resolveIngredientInfo, checkDelivered, deduplicatePendingOrders]);

  // Initial fetch and Real-Time listener on mount
  useEffect(() => {
    processPendingDelivery();

    if (!supabase) return;

    const channel = supabase
      .channel('home_delivery_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_records' },
        () => {
          processPendingDelivery();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_records' },
        () => {
          processPendingDelivery();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchasing_orders' },
        () => {
          processPendingDelivery();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [processPendingDelivery]);

  // Manual Clear handler: clears items where stock >= min_stock regardless of date
  const handleManualClear = async () => {
    setIsProcessingClear(true);
    const currentBranch = user?.branch || 'Rayong';
    const nowIso = new Date().toISOString();

    // Find all items where current_stock >= min_stock
    const toClear = pendingDeliveryList.filter(order => {
      const resolved = resolveIngredientInfo(order, order.ingredient);
      const minStock = resolved.minStock;
      const currentStock = calculateCurrentRemaining(order.ingredient_id);
      return Boolean(currentStock >= minStock);
    });

    for (const order of toClear) {
      if (supabase && order.id) {
        try {
          const { error } = await supabase
            .from('purchasing_orders')
            .update({
              delivered_at: nowIso,
              status: 'delivered'
            })
            .eq('id', order.id);

          if (error && (error.code === '42703' || error.message?.includes('column'))) {
            setSchemaNotice('กรุณาเพิ่มคอลัมน์ delivered_at (timestamp) และ status (text) ในตาราง purchasing_orders');
          }
        } catch (err) {
          console.warn('Manual clear error:', err);
        }
      }

      try {
        const raw = localStorage.getItem('cafe_purchasing_orders');
        if (raw) {
          const all: any[] = JSON.parse(raw);
          const updated = all.map(o => {
            if (o.id === order.id || (o.ingredient_id === order.ingredient_id && o.branch === currentBranch && o.order_date === order.order_date)) {
              return { ...o, delivered_at: nowIso, status: 'delivered' };
            }
            return o;
          });
          localStorage.setItem('cafe_purchasing_orders', JSON.stringify(updated));
        }
      } catch {}
    }

    setPendingOrders(prev => prev.filter(o => !toClear.some(tc => tc.id === o.id || (tc.ingredient_id === o.ingredient_id && tc.order_date === o.order_date))));
    setIsProcessingClear(false);
    setShowClearConfirmModal(false);
  };

  // Check if current user has Admin / Manager privileges
  const isAdmin = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    return role === 'admin' || role === 'owner' || role === 'co-founder' || role === 'branch manager';
  }, [user?.role]);

  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState<boolean>(false);

  // Admin Cleanup Tool: Detects and merges duplicate pending delivery records in purchasing_orders
  const cleanupDuplicateOrders = async () => {
    if (!supabase) {
      alert('ไม่พบการเชื่อมต่อฐานข้อมูล Supabase');
      return;
    }

    const currentBranch = user?.branch || 'Rayong';
    setIsCleaningDuplicates(true);

    try {
      const { data: orders, error } = await supabase
        .from('purchasing_orders')
        .select('*')
        .eq('branch', currentBranch)
        .not('order_date', 'is', null)
        .gt('order_qty', 0)
        .is('delivered_at', null);

      if (error) {
        throw error;
      }

      if (!orders || orders.length === 0) {
        alert('ไม่พบรายการรอส่งมอบในระบบ');
        return;
      }

      // Group by ingredient_id to find duplicates
      const groups: Record<string, any[]> = {};
      orders.forEach(o => {
        const ingId = String(o.ingredient_id || '');
        if (!ingId) return;
        if (!groups[ingId]) groups[ingId] = [];
        groups[ingId].push(o);
      });

      const duplicateIngredientIds = Object.keys(groups).filter(id => groups[id].length > 1);

      if (duplicateIngredientIds.length === 0) {
        alert('ไม่พบรายการซ้ำในระบบ ข้อมูลในฐานข้อมูลถูกต้องแล้ว');
        return;
      }

      const idsToDelete: string[] = [];
      const updatesToMake: { id: string; order_qty: number }[] = [];

      duplicateIngredientIds.forEach(id => {
        const group = groups[id];

        // Sort descending: newest ordered_at / order_date / id first
        group.sort((a, b) => {
          const timeA = new Date(a.ordered_at || (a.order_date ? a.order_date + 'T00:00:00' : 0)).getTime();
          const timeB = new Date(b.ordered_at || (b.order_date ? b.order_date + 'T00:00:00' : 0)).getTime();
          return timeB - timeA;
        });

        const keep = group[0];
        const older = group.slice(1);

        // Sum order quantities across all duplicates
        const totalQty = group.reduce((sum, item) => sum + (Number(item.order_qty) || 0), 0);
        if (keep.id && totalQty !== Number(keep.order_qty)) {
          updatesToMake.push({ id: keep.id, order_qty: totalQty });
        }

        older.forEach(item => {
          if (item.id) idsToDelete.push(item.id);
        });
      });

      // Update total qty on kept orders
      for (const update of updatesToMake) {
        await supabase
          .from('purchasing_orders')
          .update({ order_qty: update.order_qty })
          .eq('id', update.id);
      }

      // Delete older duplicate records
      if (idsToDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('purchasing_orders')
          .delete()
          .in('id', idsToDelete);

        if (delErr) throw delErr;

        // Clean up localStorage
        try {
          const raw = localStorage.getItem('cafe_purchasing_orders');
          if (raw) {
            const all: any[] = JSON.parse(raw);
            const filtered = all.filter(o => !idsToDelete.includes(o.id));
            localStorage.setItem('cafe_purchasing_orders', JSON.stringify(filtered));
          }
        } catch {}
      }

      // Refresh pending delivery data
      await processPendingDelivery();

      alert(`ล้างข้อมูลซ้ำสำเร็จ!\nลบรายการซ้ำทั้งหมด ${idsToDelete.length} รายการ สำหรับ ${duplicateIngredientIds.length} วัตถุดิบ`);
    } catch (err: any) {
      console.error('Error cleaning duplicate orders:', err);
      alert(`เกิดข้อผิดพลาดในการล้างข้อมูลซ้ำ: ${err.message || 'โปรดลองอีกครั้ง'}`);
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  // Sync locationFilter with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('crenn_location_filter', locationFilter);
    } catch {
      // ignore
    }
  }, [locationFilter]);

  // Click outside listener for filter bar
  const filterBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(event.target as Node)) {
        setShowTimeDropdown(false);
        setShowBranchDropdown(false);
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Modals & Popups
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);

  // ─── Live timestamp state ───
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    // Update immediately on mount
    setCurrentTime(new Date());

    // Update every 30 seconds
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30 * 1000); // 30,000ms = 30 seconds

    // Cleanup on unmount (prevents memory leak)
    return () => clearInterval(timer);
  }, []); // empty deps = run once on mount

  // Also update when data updates/refreshes
  useEffect(() => {
    setCurrentTime(new Date());
  }, [ingredients, stockRecord]);

  // ─── Format: Thai time HH:MM น. ───
  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} น.`;
  };

  // Correct Filter Function: uses "department" field from Supabase
  const getFilteredIngredients = useCallback(
    (
      allIngredients: Ingredient[],
      filter: "all" | "bar" | "kitchen"
    ): Ingredient[] => {
      if (filter === "all") return allIngredients;

      return allIngredients.filter((item) => {
        // Use "department" field from Supabase
        const dept = (item.department || "")
          .toLowerCase()
          .trim();

        if (filter === "bar") {
          // Match only Bar department
          return dept === "bar";
        }

        if (filter === "kitchen") {
          // Match Bakery + Kitchen departments
          return (
            dept === "bakery" ||
            dept === "kitchen" ||
            dept === "ครัว"
          );
        }

        return true;
      });
    },
    []
  );

  // Obsolete map synchronization
  const obsoleteMap = useObsoleteIngredients();

  // Active (non-obsolete) ingredients
  const activeIngredients = useMemo(() => {
    return ingredients.filter(item => isIngredientActive(item, obsoleteMap));
  }, [ingredients, obsoleteMap]);

  // Compute filtered list reactively (excluding obsolete items)
  const filteredIngredients = useMemo(
    () => getFilteredIngredients(
      activeIngredients,
      locationFilter  // "all" | "bar" | "kitchen"
    ),
    [activeIngredients, locationFilter, getFilteredIngredients]
  );

  // Labels for current location selection
  const locationLabel = useMemo(() => {
    switch (locationFilter) {
      case "bar":     return "วัตถุดิบบาร์";
      case "kitchen": return "วัตถุดิบครัว";
      default:        return "วัตถุดิบทั้งหมด";
    }
  }, [locationFilter]);

  const locationSubtitle = useMemo(() => {
    if (locationFilter === 'bar') return 'สรุปสถานะสต็อกบาร์';
    if (locationFilter === 'kitchen') return 'สรุปสถานะสต็อกครัว';
    return 'สรุปสถานะสต็อกทั้งหมด';
  }, [locationFilter]);

  // Dashboard Donut Chart Title
  const chartTitle = useMemo(() => {
    switch (locationFilter) {
      case "bar":
        return "สถานะสต็อกสินค้า (วัตถุดิบบาร์)";
      case "kitchen":
        return "สถานะสต็อกสินค้า (วัตถุดิบครัว)";
      default:
        return "สถานะสต็อกสินค้า (วัตถุดิบทั้งหมด)";
    }
  }, [locationFilter]);

  // Filter pending delivery orders by locationFilter (excluding obsolete items) and deduplicate
  const pendingDeliveryList = useMemo(() => {
    const valid = pendingOrders.filter(order => {
      if (!order.order_date || !order.order_qty || Number(order.order_qty) <= 0) return false;
      const resolved = resolveIngredientInfo(order, order.ingredient);
      const ing = resolved.bestIng;
      
      if (ing) {
        // Exclude obsolete ingredients from pending delivery
        if (!isIngredientActive(ing, obsoleteMap)) return false;
        
        if (locationFilter !== 'all') {
          const dept = (resolved.department || '').toLowerCase().trim();
          if (locationFilter === 'bar' && dept !== 'bar') return false;
          if (locationFilter === 'kitchen' && dept !== 'bakery' && dept !== 'kitchen') return false;
        }
      }
      return true;
    });

    return deduplicatePendingOrders(valid);
  }, [pendingOrders, resolveIngredientInfo, locationFilter, obsoleteMap, deduplicatePendingOrders]);

  const pendingDelivery = pendingDeliveryList.length;

  // Map of active pending orders by ingredient_id for alert badges (รอส่งมอบ)
  const pendingOrderMap = useMemo(() => {
    const map: Record<string, {
      order_qty: number;
      order_date: string;
      order_unit: string;
      ordered_at: string;
    }> = {};

    pendingOrders.forEach(order => {
      const ingId = String(order.ingredient_id || '');
      if (!ingId) return;
      if (!order.order_qty || Number(order.order_qty) <= 0) return;
      if (order.delivered_at || order.status === 'delivered') return;

      const existing = map[ingId];
      const orderTime = new Date(order.ordered_at || order.order_date || 0).getTime();
      const existingTime = existing ? new Date(existing.ordered_at || existing.order_date || 0).getTime() : 0;

      if (!existing || orderTime >= existingTime) {
        const orderInfo = {
          order_qty: Number(order.order_qty),
          order_date: order.order_date || '',
          order_unit: order.order_unit || (order.ingredient as any)?.unit || '',
          ordered_at: order.ordered_at || order.order_date || ''
        };
        map[ingId] = orderInfo;
        if (order.ingredient_id) {
          map[String(order.ingredient_id)] = orderInfo;
        }
      }
    });

    return map;
  }, [pendingOrders]);

  // Calculate current stock levels for filtered ingredients
  const stockData = useMemo(() => {
    const stockMap: Record<string, number> = {};
    const sortedDatesAsc = Object.keys(stockRecord).sort();

    sortedDatesAsc.forEach(dateKey => {
      filteredIngredients.forEach(ing => {
        const val = stockRecord[dateKey]?.[ing.id];
        if (typeof val === 'number') {
          stockMap[ing.id] = val;
        } else if (val) {
          const explicitRemaining = val.remaining;
          if (explicitRemaining !== undefined && explicitRemaining !== null) {
            stockMap[ing.id] = explicitRemaining;
          } else {
            const prev = stockMap[ing.id] || 0;
            const added = val.in || 0;
            const removed = val.out || 0;
            stockMap[ing.id] = prev + added - removed;
          }
        }
      });
    });

    const outOfStockList: Array<{ ing: Ingredient; remaining: number }> = [];
    const lowStockList: Array<{ ing: Ingredient; remaining: number }> = [];
    const goodStockList: Array<{ ing: Ingredient; remaining: number }> = [];

    filteredIngredients.forEach(ing => {
      const remaining = stockMap[ing.id] ?? 0;
      const minStock = ing.minStock ?? 0;

      // Business Rules:
      // หมดสต็อก (Out of Stock): current_stock === 0 (or <= 0)
      // ใกล้หมด (Low Stock): current_stock > 0 AND current_stock < min_stock (strictly LESS THAN)
      // สต็อกปกติ (Normal Stock): current_stock >= min_stock
      if (remaining <= 0) {
        outOfStockList.push({ ing, remaining });
      } else if (remaining < minStock) {
        lowStockList.push({ ing, remaining });
      } else {
        goodStockList.push({ ing, remaining });
      }
    });

    const total = filteredIngredients.length;
    const outCount = outOfStockList.length;
    const lowCount = lowStockList.length;
    const goodCount = goodStockList.length;
    const purchasingCount = outCount + lowCount;

    // Critical items (Out of stock first, then lowest remaining/minStock ratio)
    const criticalList = [...outOfStockList, ...lowStockList].slice(0, 10);

    return {
      total,
      outCount,
      lowCount,
      goodCount,
      purchasingCount,
      outOfStockList,
      lowStockList,
      goodStockList,
      criticalList,
      stockMap
    };
  }, [filteredIngredients, stockRecord]);

  // Donut chart calculations
  const chartValues = useMemo(() => {
    const total = stockData.total || 1;
    const goodPct = Math.round((stockData.goodCount / total) * 100);
    const lowPct = Math.round((stockData.lowCount / total) * 100);
    const outPct = 100 - goodPct - lowPct;

    const r = 40;
    const circumference = 2 * Math.PI * r;

    const goodLen = (stockData.goodCount / total) * circumference;
    const lowLen = (stockData.lowCount / total) * circumference;
    const outLen = (stockData.outCount / total) * circumference;

    const goodOffset = 0;
    const lowOffset = -goodLen;
    const outOffset = -(goodLen + lowLen);

    return {
      circumference,
      goodLen,
      lowLen,
      outLen,
      goodOffset,
      lowOffset,
      outOffset,
      goodPct,
      lowPct,
      outPct: Math.max(0, outPct)
    };
  }, [stockData]);

  // Dynamic Right Panel List based on activeKPI selection
  const { panelTitle, displayItems } = useMemo(() => {
    if (activeKPI === 'out_of_stock') {
      const sorted = [...stockData.outOfStockList].sort((a, b) => a.ing.name.localeCompare(b.ing.name, 'th'));
      return {
        panelTitle: 'รายการหมดสต็อก',
        displayItems: sorted.map(item => ({
          ...item,
          status: 'out_of_stock' as const,
          badgeLabel: 'หมดแล้ว',
          badgeClass: 'bg-[#FEE2E2] text-[#EF4444]'
        }))
      };
    }
    if (activeKPI === 'low_stock') {
      const sorted = [...stockData.lowStockList].sort((a, b) => {
        const ratioA = a.remaining / (a.ing.minStock || 1);
        const ratioB = b.remaining / (b.ing.minStock || 1);
        return ratioA - ratioB || a.remaining - b.remaining;
      });
      return {
        panelTitle: 'รายการใกล้หมด',
        displayItems: sorted.map(item => ({
          ...item,
          status: 'low_stock' as const,
          badgeLabel: 'ใกล้หมด',
          badgeClass: 'bg-[#FEF3C7] text-[#F59E0B]'
        }))
      };
    }
    if (activeKPI === 'normal') {
      const sorted = [...stockData.goodStockList].sort((a, b) => a.ing.name.localeCompare(b.ing.name, 'th'));
      return {
        panelTitle: 'รายการสต็อกปกติ',
        displayItems: sorted.map(item => ({
          ...item,
          status: 'normal' as const,
          badgeLabel: 'ปกติ',
          badgeClass: 'bg-[#E8F3F2] text-[#5A8A88]'
        }))
      };
    }
    if (activeKPI === 'purchasing') {
      const list = [...stockData.outOfStockList, ...stockData.lowStockList];
      return {
        panelTitle: 'รายการที่ต้องสั่งซื้อ',
        displayItems: list.map(item => {
          const isOut = item.remaining <= 0;
          const needed = Math.max(1, (item.ing.minStock || 1) * 2 - item.remaining);
          return {
            ...item,
            status: isOut ? ('out_of_stock' as const) : ('low_stock' as const),
            badgeLabel: isOut ? 'หมดแล้ว' : `ต้องสั่ง +${needed} ${item.ing.unit}`,
            badgeClass: isOut ? 'bg-[#FEE2E2] text-[#EF4444]' : 'bg-[#F1F5F9] text-[#2D4A49]'
          };
        })
      };
    }
    if (activeKPI === 'pending_delivery') {
      const items = pendingDeliveryList
        .map(order => {
          const resolved = resolveIngredientInfo(order, order.ingredient);
          const ing = resolved.bestIng;
          const currentRemaining = ing && stockData.stockMap[ing.id] !== undefined
            ? stockData.stockMap[ing.id]
            : (order.ingredient_id && stockData.stockMap[order.ingredient_id] !== undefined ? stockData.stockMap[order.ingredient_id] : 0);
          const minStock = resolved.minStock;
          const isPendingConfirm = Boolean(currentRemaining >= minStock);

          return {
            ing,
            resolved,
            remaining: currentRemaining,
            order,
            isPendingConfirm,
            status: 'pending_delivery' as any,
            badgeLabel: `สั่งแล้ว ${order.order_qty} ${order.order_unit || resolved.unit || 'หน่วย'}`,
            badgeClass: 'bg-[#E8F3F2] text-[#5A8A88] font-bold border border-[#D4E4E3]'
          };
        }) as { 
          ing: Ingredient | null;
          resolved?: any;
          remaining: number; 
          status: any; 
          badgeLabel: string; 
          badgeClass: string;
          order?: any;
          isPendingConfirm?: boolean;
        }[];

      return {
        panelTitle: 'รายการรอส่งมอบ (สั่งซื้อแล้ว)',
        displayItems: items
      };
    }
    // Default (null)
    return {
      panelTitle: 'รายการวิกฤตที่ต้องสั่งซื้อ',
      displayItems: stockData.criticalList.map(item => {
        const isOut = item.remaining <= 0;
        return {
          ...item,
          status: isOut ? ('out_of_stock' as const) : ('low_stock' as const),
          badgeLabel: isOut ? 'หมดแล้ว' : 'ใกล้หมด',
          badgeClass: isOut ? 'bg-[#FEE2E2] text-[#EF4444]' : 'bg-[#FEF3C7] text-[#F59E0B]'
        };
      })
    };
  }, [activeKPI, stockData]);

  // Donut segment opacities based on activeKPI
  const hasActiveKPI = activeKPI !== null;
  const isGoodActive = activeKPI === 'normal';
  const isLowActive = activeKPI === 'low_stock' || activeKPI === 'purchasing';
  const isOutActive = activeKPI === 'out_of_stock' || activeKPI === 'purchasing';

  const goodOpacity = !hasActiveKPI ? 1 : isGoodActive ? 1 : 0.4;
  const lowOpacity = !hasActiveKPI ? 1 : isLowActive ? 1 : 0.4;
  const outOpacity = !hasActiveKPI ? 1 : isOutActive ? 1 : 0.4;

  return (
    <div className="w-full bg-[#F4F8F7] text-slate-800 pb-6 font-sans">
      
      {/* 1. TOP BAR: CRENN + 🔔 + avatar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#D4E4E3] shadow-xs px-4 py-3">
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex items-center justify-between">
          
          {/* Brand Name CRENN */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => onNavigate('home')}
              className="text-left group focus:outline-none"
            >
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-[0.22em] uppercase leading-none font-sans">
                CRENN
              </h1>
              <p className="text-[9px] text-[#5A8A88] font-bold tracking-widest uppercase mt-0.5">
                Cafe Management
              </p>
            </button>
          </div>

          {/* Center Navigation Icons (Visible on tablet/PC) */}
          <TopNavCenterIcons
            activeTab="home"
            onNavigate={onNavigate}
            outOfStockCount={stockData.outCount}
            needPurchasingCount={stockData.outCount + stockData.lowCount}
          />

          {/* Right Action Icons: Notification Bell + User Avatar */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-9 h-9 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] text-[#5A8A88] flex items-center justify-center transition-colors relative focus:outline-none shadow-xs"
                title="การแจ้งเตือน"
              >
                <Bell size={18} />
                {stockData.outCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-pulse"></span>
                )}
              </button>

              {/* Notification Popup */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#D4E4E3] p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">การแจ้งเตือนสต็อก (Alerts)</span>
                    <button 
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto text-xs">
                    {stockData.outCount > 0 ? (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                        <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">สินค้าหมดสต็อก {stockData.outCount} รายการ</p>
                          <p className="text-[11px] text-rose-600 mt-0.5">กรุณาตรวจสอบและสั่งซื้อด่วน</p>
                        </div>
                      </div>
                    ) : null}

                    {stockData.lowCount > 0 ? (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">สินค้าใกล้หมด {stockData.lowCount} รายการ</p>
                          <p className="text-[11px] text-amber-600 mt-0.5">ต่ำกว่าเกณฑ์ขั้นต่ำที่กำหนด</p>
                        </div>
                      </div>
                    ) : null}

                    <div className="p-2.5 rounded-xl bg-[#E8F3F2] border border-[#D4E4E3] text-[#476E6C] flex items-start gap-2">
                      <Database size={15} className="text-[#5A8A88] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">ระบบออนไลน์ (Supabase)</p>
                        <p className="text-[11px] text-[#5A8A88] mt-0.5">เชื่อมต่อฐานข้อมูลเรียบร้อยแล้ว</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Avatar Circle */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 p-1 pr-2.5 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#D4E4E3] transition-colors focus:outline-none"
              title="โปรไฟล์ผู้ใช้"
            >
              <div className="w-7 h-7 rounded-full bg-[#5A8A88] text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {user.name.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-[#476E6C] max-w-[70px] truncate hidden sm:inline-block">
                {user.name}
              </span>
            </button>
          </div>

        </div>
      </header>

      {/* Supabase status bar */}
      <SupabaseStatusBar dbStatus={dbStatus} />

      {/* Main Container */}
      <main className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 space-y-4 md:space-y-6">
        
        {/* 2. GREETING + "Inventory Dashboard" TITLE */}
        <section className="bg-gradient-to-r from-white to-[#EAF2F1] rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#5A8A88] font-medium flex items-center gap-1.5">
                <span>👋 สวัสดี,</span>
                <span className="font-bold text-slate-800">{user.name}</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-[#5A8A88]/15 text-[#5A8A88]">
                  {user.role}
                </span>
              </p>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight mt-1">
                Inventory Dashboard
              </h2>
              {/* Filter context subtitle */}
              <p className="text-xs md:text-sm text-[#6B8F8E] font-medium mt-1 flex items-center flex-wrap gap-1.5">
                <span>สรุปสถานะสต็อก</span>
                <span className="text-slate-300">·</span>
                <span>{user.branch === 'Rayong' ? 'สาขาระยอง' : 'สาขากรุงเทพฯ'}</span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Real-time
                </span>
              </p>
            </div>
            <div className="w-11 h-11 md:w-13 md:h-13 rounded-2xl bg-white border border-[#D4E4E3] flex items-center justify-center text-[#5A8A88] shadow-xs">
              <Package size={24} />
            </div>
          </div>
        </section>

        {/* 3. FILTER BAR: [📅 ● อัปเดต: {HH:MM} น.]  [📍 สาขากรุงเทพฯ]  [🏪 ทั้งหมด ▼] */}
        <section ref={filterBarRef} className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          {/* Pill 1: Update Time (Text, non-clickable) */}
          <div className="flex-1 min-w-[130px] flex items-center justify-center sm:justify-start px-3.5 sm:px-4 py-2 rounded-full bg-white border border-[#D4E4E3] text-[13px] sm:text-sm font-semibold text-[#2D4A49] shadow-xs select-none">
            <div className="flex items-center gap-1.5 truncate">
              <Calendar size={14} className="text-[#5A8A88] shrink-0" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse shrink-0" />
              <span className="truncate">อัปเดต: {formatTime(currentTime)}</span>
            </div>
          </div>

          {/* Pill 2: Branch Badge (Badge, non-clickable) */}
          <div className="flex-1 min-w-[120px] flex items-center justify-center sm:justify-start px-3.5 sm:px-4 py-2 rounded-full bg-white border border-[#D4E4E3] text-[13px] sm:text-sm font-semibold text-[#2D4A49] shadow-xs select-none">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin size={14} className="text-[#5A8A88] shrink-0" />
              <span className="truncate">
                {user.branch === 'Rayong' ? 'สาขาระยอง' : 'สาขากรุงเทพฯ'}
              </span>
            </div>
          </div>

          {/* Pill 3: Inventory Location Filter [🏪 ทั้งหมด ▼ / 🍹 บาร์ ▼ / 🍳 ครัว ▼] */}
          <div className="relative flex-1 min-w-[120px]">
            <button
              type="button"
              onClick={() => {
                setShowLocationDropdown(!showLocationDropdown);
                setShowTimeDropdown(false);
                setShowBranchDropdown(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 sm:px-4 py-2 rounded-full border text-[13px] sm:text-sm font-semibold transition-all duration-200 shadow-xs cursor-pointer ${
                locationFilter !== 'all'
                  ? 'bg-[#E8F3F2] border-[#5A8A88] text-[#5A8A88]'
                  : 'bg-white border-[#D4E4E3] text-[#2D4A49] hover:bg-[#F0F5F4]'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="shrink-0 text-sm">
                  {locationFilter === 'bar' ? '🍹' : locationFilter === 'kitchen' ? '🍳' : '🏪'}
                </span>
                <span className="truncate">
                  {locationFilter === 'bar' ? 'บาร์' : locationFilter === 'kitchen' ? 'ครัว / เบเกอรี่' : 'ทั้งหมด'}
                </span>
              </div>
              <ChevronDown 
                size={14} 
                className={`shrink-0 ml-1 transition-transform duration-200 ${
                  showLocationDropdown ? 'rotate-180 text-[#5A8A88]' : 'text-[#6B8F8E]'
                }`} 
              />
            </button>

            {showLocationDropdown && (
              <div className="absolute top-full right-0 sm:left-0 sm:right-auto sm:w-48 mt-1 bg-white rounded-2xl shadow-xl border border-[#D4E4E3] py-1.5 z-30 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-1 text-[10px] font-bold text-[#6B8F8E] uppercase tracking-wider border-b border-slate-100 mb-1">
                  เลือกพื้นที่จัดเก็บสต็อก
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('all');
                    setShowLocationDropdown(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-[#F0F5F4] flex items-center justify-between font-medium transition-colors cursor-pointer ${
                    locationFilter === 'all' ? 'bg-[#E8F3F2] text-[#5A8A88] font-bold' : 'text-[#2D4A49]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🏪</span>
                    <span>ทั้งหมด</span>
                  </span>
                  {locationFilter === 'all' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('bar');
                    setShowLocationDropdown(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-[#F0F5F4] flex items-center justify-between font-medium transition-colors cursor-pointer ${
                    locationFilter === 'bar' ? 'bg-[#E8F3F2] text-[#5A8A88] font-bold' : 'text-[#2D4A49]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🍹</span>
                    <span>บาร์</span>
                  </span>
                  {locationFilter === 'bar' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('kitchen');
                    setShowLocationDropdown(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-[#F0F5F4] flex items-center justify-between font-medium transition-colors cursor-pointer ${
                    locationFilter === 'kitchen' ? 'bg-[#E8F3F2] text-[#5A8A88] font-bold' : 'text-[#2D4A49]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🍳</span>
                    <span>ครัว / เบเกอรี่</span>
                  </span>
                  {locationFilter === 'kitchen' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 4. KPI ROW: 5 CARDS IN A SINGLE ROW */}
        <section className="w-full overflow-x-auto custom-scrollbar pb-0.5">
          <div className="grid grid-cols-5 gap-2 sm:gap-2.5 md:gap-3 min-w-[560px] sm:min-w-0">
            {/* Card 1: หมดสต็อก */}
            <div 
              onClick={() => setActiveKPI(prev => prev === 'out_of_stock' ? null : 'out_of_stock')}
              className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-3.5 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-200 ease-in-out cursor-pointer group select-none ${
                activeKPI === 'out_of_stock'
                  ? 'border-2 border-[#EF4444] bg-rose-50/70 shadow-md scale-[1.01]'
                  : 'bg-white border border-rose-200/80 hover:bg-[#F0F5F4] hover:shadow-xs'
              }`}
            >
              <div className="absolute top-0 right-0 w-9 h-9 sm:w-10 sm:h-10 bg-rose-50 rounded-bl-full -z-0 pointer-events-none"></div>
              <div className="z-10 flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-[11.5px] lg:text-[12px] font-bold text-rose-700 block truncate">หมดสต็อก</span>
                  <span className="text-[9px] sm:text-[9.5px] lg:text-[10px] text-[#6B8F8E] font-medium block truncate mt-0.5">ต้องสั่งซื้อด่วน</span>
                </div>
                <span className={`w-6 h-6 sm:w-6.5 sm:h-6.5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${
                  activeKPI === 'out_of_stock' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500'
                }`}>
                  <AlertCircle size={13} className="sm:w-3.5 sm:h-3.5" />
                </span>
              </div>
              <div className="mt-1.5 sm:mt-2 z-10 flex items-baseline">
                <span className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-rose-600 leading-none">
                  {stockData.outCount}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium ml-1">รายการ</span>
              </div>
              <div className="mt-1 sm:mt-1.5 text-[8.5px] sm:text-[9.5px] text-rose-500 font-medium truncate z-10 flex items-center justify-between">
                <span className="truncate">{locationLabel}</span>
                {activeKPI === 'out_of_stock' && <span className="font-bold text-rose-600 underline shrink-0 ml-1">เลือก</span>}
              </div>
            </div>

            {/* Card 2: ใกล้หมด */}
            <div 
              onClick={() => setActiveKPI(prev => prev === 'low_stock' ? null : 'low_stock')}
              className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-3.5 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-200 ease-in-out cursor-pointer group select-none ${
                activeKPI === 'low_stock'
                  ? 'border-2 border-[#F59E0B] bg-amber-50/70 shadow-md scale-[1.01]'
                  : 'bg-white border border-amber-200/80 hover:bg-[#F0F5F4] hover:shadow-xs'
              }`}
            >
              <div className="absolute top-0 right-0 w-9 h-9 sm:w-10 sm:h-10 bg-amber-50 rounded-bl-full -z-0 pointer-events-none"></div>
              <div className="z-10 flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-[11.5px] lg:text-[12px] font-bold text-amber-700 block truncate">ใกล้หมด</span>
                  <span className="text-[9px] sm:text-[9.5px] lg:text-[10px] text-[#6B8F8E] font-medium block truncate mt-0.5">ต่ำกว่าขั้นต่ำ</span>
                </div>
                <span className={`w-6 h-6 sm:w-6.5 sm:h-6.5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${
                  activeKPI === 'low_stock' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-500'
                }`}>
                  <AlertTriangle size={13} className="sm:w-3.5 sm:h-3.5" />
                </span>
              </div>
              <div className="mt-1.5 sm:mt-2 z-10 flex items-baseline">
                <span className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-amber-600 leading-none">
                  {stockData.lowCount}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium ml-1">รายการ</span>
              </div>
              <div className="mt-1 sm:mt-1.5 text-[8.5px] sm:text-[9.5px] text-amber-600 font-medium truncate z-10 flex items-center justify-between">
                <span className="truncate">{locationLabel}</span>
                {activeKPI === 'low_stock' && <span className="font-bold text-amber-600 underline shrink-0 ml-1">เลือก</span>}
              </div>
            </div>

            {/* Card 3: สต็อกปกติ */}
            <div 
              onClick={() => setActiveKPI(prev => prev === 'normal' ? null : 'normal')}
              className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-3.5 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-200 ease-in-out cursor-pointer group select-none ${
                activeKPI === 'normal'
                  ? 'border-2 border-[#5A8A88] bg-[#E8F3F2]/80 shadow-md scale-[1.01]'
                  : 'bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] hover:shadow-xs'
              }`}
            >
              <div className="absolute top-0 right-0 w-9 h-9 sm:w-10 sm:h-10 bg-[#E8F3F2] rounded-bl-full -z-0 pointer-events-none"></div>
              <div className="z-10 flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-[11.5px] lg:text-[12px] font-bold text-[#2D4A49] block truncate">สต็อกปกติ</span>
                  <span className="text-[9px] sm:text-[9.5px] lg:text-[10px] text-[#6B8F8E] font-medium block truncate mt-0.5">วัตถุดิบพร้อมใช้งาน</span>
                </div>
                <span className={`w-6 h-6 sm:w-6.5 sm:h-6.5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${
                  activeKPI === 'normal' ? 'bg-[#5A8A88] text-white' : 'bg-[#E8F3F2] text-[#5A8A88]'
                }`}>
                  <CheckCircle2 size={13} className="sm:w-3.5 sm:h-3.5" />
                </span>
              </div>
              <div className="mt-1.5 sm:mt-2 z-10 flex items-baseline">
                <span className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-[#5A8A88] leading-none">
                  {stockData.goodCount}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium ml-1">รายการ</span>
              </div>
              <div className="mt-1 sm:mt-1.5 text-[8.5px] sm:text-[9.5px] text-[#5A8A88] font-medium truncate z-10 flex items-center justify-between">
                <span className="truncate">{locationLabel}</span>
                {activeKPI === 'normal' && <span className="font-bold text-[#5A8A88] underline shrink-0 ml-1">เลือก</span>}
              </div>
            </div>

            {/* Card 4: สั่งซื้อ */}
            <div 
              onClick={() => setActiveKPI(prev => prev === 'purchasing' ? null : 'purchasing')}
              className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-3.5 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-200 ease-in-out cursor-pointer group select-none ${
                activeKPI === 'purchasing'
                  ? 'border-2 border-[#7A9E9C] bg-[#EAF2F1] shadow-md scale-[1.01]'
                  : 'bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] hover:shadow-xs'
              }`}
            >
              <div className="absolute top-0 right-0 w-9 h-9 sm:w-10 sm:h-10 bg-[#EAF2F1] rounded-bl-full -z-0 pointer-events-none"></div>
              <div className="z-10 flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-[11.5px] lg:text-[12px] font-bold text-[#2D4A49] block truncate">สั่งซื้อ</span>
                  <span className="text-[9px] sm:text-[9.5px] lg:text-[10px] text-[#6B8F8E] font-medium block truncate mt-0.5">รายการที่ต้องสั่ง</span>
                </div>
                <span className={`w-6 h-6 sm:w-6.5 sm:h-6.5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${
                  activeKPI === 'purchasing' ? 'bg-[#7A9E9C] text-white' : 'bg-[#E8F3F2] text-[#7A9E9C]'
                }`}>
                  <ShoppingCart size={13} className="sm:w-3.5 sm:h-3.5" />
                </span>
              </div>
              <div className="mt-1.5 sm:mt-2 z-10 flex items-baseline">
                <span className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-[#7A9E9C] leading-none">
                  {stockData.purchasingCount}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium ml-1">รายการ</span>
              </div>
              <div className="mt-1 sm:mt-1.5 text-[8.5px] sm:text-[9.5px] text-[#7A9E9C] font-medium truncate z-10 flex items-center justify-between">
                <span className="truncate">{locationLabel}</span>
                {activeKPI === 'purchasing' && <span className="font-bold text-[#7A9E9C] underline shrink-0 ml-1">เลือก</span>}
              </div>
            </div>

            {/* Card 5: รอส่งมอบ */}
            <div 
              onClick={() => setActiveKPI(prev => prev === 'pending_delivery' ? null : 'pending_delivery')}
              className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-3.5 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-200 ease-in-out cursor-pointer group select-none border-t-[3px] border-t-[#3B82F6] ${
                activeKPI === 'pending_delivery'
                  ? 'border-2 border-[#3B82F6] bg-blue-50/70 shadow-md scale-[1.01]'
                  : 'bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] hover:shadow-xs'
              }`}
            >
              <div className="absolute top-0 right-0 w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-bl-full -z-0 pointer-events-none"></div>
              <div className="z-10 flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-[11.5px] lg:text-[12px] font-bold text-blue-700 block truncate">รอส่งมอบ</span>
                  <span className="text-[9px] sm:text-[9.5px] lg:text-[10px] text-[#6B8F8E] font-medium block truncate mt-0.5">สั่งซื้อแล้ว รอรับสินค้า</span>
                </div>
                <span className={`w-6 h-6 sm:w-6.5 sm:h-6.5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${
                  activeKPI === 'pending_delivery' ? 'bg-[#3B82F6] text-white' : 'bg-blue-50 text-[#3B82F6]'
                }`}>
                  <Truck size={13} className="sm:w-3.5 sm:h-3.5" />
                </span>
              </div>
              <div className="mt-1.5 sm:mt-2 z-10 flex items-baseline">
                <span className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-[#3B82F6] leading-none">
                  {pendingDelivery}
                </span>
                <span className="text-[9px] sm:text-[10px] text-[#6B8F8E] font-medium ml-1">รายการ</span>
              </div>
              <div className="mt-1 sm:mt-1.5 text-[8.5px] sm:text-[9.5px] text-[#3B82F6] font-medium truncate z-10 flex items-center justify-between">
                <span className="truncate">{locationLabel}</span>
                {activeKPI === 'pending_delivery' && <span className="font-bold text-[#3B82F6] underline shrink-0 ml-1">เลือก</span>}
              </div>
            </div>
          </div>
        </section>

        {/* 5 & 6. STOCK STATUS CARD + STOCK ALERT CARD (Responsive 2-column on md+) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          {/* 5. STOCK STATUS CARD: Donut chart + legend (CHANGE 4: Highlights active segment) */}
          <section className="md:col-span-7 bg-white rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#5A8A88]"></div>
                <h3 className="text-xs md:text-sm font-bold text-slate-800 uppercase tracking-wider">
                  {chartTitle}
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                ทั้งหมด {stockData.total} รายการ
              </span>
            </div>

            <div className="flex items-center justify-around gap-4 py-2 my-auto">
              {/* Donut Chart SVG */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  {/* Background ring */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#F1F5F4"
                    strokeWidth="12"
                  />
                  {/* Good stock ring segment */}
                  {stockData.goodCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#5A8A88"
                      strokeWidth={isGoodActive ? "14" : "12"}
                      strokeOpacity={goodOpacity}
                      className="transition-all duration-300"
                      strokeDasharray={`${chartValues.goodLen} ${chartValues.circumference}`}
                      strokeDashoffset={chartValues.goodOffset}
                      strokeLinecap="round"
                    />
                  )}
                  {/* Low stock ring segment */}
                  {stockData.lowCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#F59E0B"
                      strokeWidth={isLowActive ? "14" : "12"}
                      strokeOpacity={lowOpacity}
                      className="transition-all duration-300"
                      strokeDasharray={`${chartValues.lowLen} ${chartValues.circumference}`}
                      strokeDashoffset={chartValues.lowOffset}
                      strokeLinecap="round"
                    />
                  )}
                  {/* Out of stock ring segment */}
                  {stockData.outCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#EF4444"
                      strokeWidth={isOutActive ? "14" : "12"}
                      strokeOpacity={outOpacity}
                      className="transition-all duration-300"
                      strokeDasharray={`${chartValues.outLen} ${chartValues.circumference}`}
                      strokeDashoffset={chartValues.outOffset}
                      strokeLinecap="round"
                    />
                  )}
                </svg>

                {/* Center text (CHANGE 4: Updates with KPI Selection) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center select-none transition-all duration-200">
                  {activeKPI === 'out_of_stock' ? (
                    <>
                      <span className="text-base sm:text-lg font-black text-rose-600 leading-none">
                        {stockData.outCount}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-rose-500 mt-0.5">
                        หมดสต็อก
                      </span>
                    </>
                  ) : activeKPI === 'low_stock' ? (
                    <>
                      <span className="text-base sm:text-lg font-black text-amber-600 leading-none">
                        {stockData.lowCount}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-amber-600 mt-0.5">
                        ใกล้หมด
                      </span>
                    </>
                  ) : activeKPI === 'normal' ? (
                    <>
                      <span className="text-base sm:text-lg font-black text-[#5A8A88] leading-none">
                        {stockData.goodCount}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#5A8A88] mt-0.5">
                        สต็อกปกติ
                      </span>
                    </>
                  ) : activeKPI === 'purchasing' ? (
                    <>
                      <span className="text-base sm:text-lg font-black text-[#2D4A49] leading-none">
                        {stockData.purchasingCount}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#7A9E9C] mt-0.5">
                        ต้องสั่งซื้อ
                      </span>
                    </>
                  ) : activeKPI === 'pending_delivery' ? (
                    <>
                      <span className="text-base sm:text-lg font-black text-[#3B82F6] leading-none">
                        {pendingDelivery}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#3B82F6] mt-0.5">
                        รอส่งมอบ
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-base sm:text-lg font-black text-slate-800 leading-none">
                        {chartValues.goodPct}%
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 mt-0.5">
                        ความพร้อม
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend (CHANGE 4: Active status row highlight) */}
              <div className="space-y-2 flex-1 text-xs">
                {/* 1. สต็อกปกติ */}
                <div 
                  onClick={() => setActiveKPI(prev => prev === 'normal' ? null : 'normal')}
                  className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
                    activeKPI === 'normal'
                      ? 'bg-[#E8F3F2] border-l-4 border-[#5A8A88] shadow-xs'
                      : hasActiveKPI
                        ? 'opacity-50 bg-slate-50 border border-slate-100 hover:opacity-80'
                        : 'bg-slate-50 border border-slate-100 hover:bg-[#F0F5F4]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5A8A88]"></span>
                    <span className="text-slate-700 font-medium">สต็อกปกติ</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-slate-800">{stockData.goodCount}</span>
                    <span className="text-[10px] text-slate-400">({chartValues.goodPct}%)</span>
                  </div>
                </div>

                {/* 2. ใกล้หมด */}
                <div 
                  onClick={() => setActiveKPI(prev => prev === 'low_stock' ? null : 'low_stock')}
                  className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
                    activeKPI === 'low_stock' || activeKPI === 'purchasing'
                      ? 'bg-amber-50 border-l-4 border-amber-500 shadow-xs'
                      : hasActiveKPI
                        ? 'opacity-50 bg-amber-50/60 border border-amber-100 hover:opacity-80'
                        : 'bg-amber-50/60 border border-amber-100 hover:bg-amber-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-amber-900 font-medium">ใกล้หมด</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-amber-700">{stockData.lowCount}</span>
                    <span className="text-[10px] text-amber-500">({chartValues.lowPct}%)</span>
                  </div>
                </div>

                {/* 3. หมดสต็อก */}
                <div 
                  onClick={() => setActiveKPI(prev => prev === 'out_of_stock' ? null : 'out_of_stock')}
                  className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
                    activeKPI === 'out_of_stock' || activeKPI === 'purchasing'
                      ? 'bg-rose-50 border-l-4 border-rose-500 shadow-xs'
                      : hasActiveKPI
                        ? 'opacity-50 bg-rose-50/60 border border-rose-100 hover:opacity-80'
                        : 'bg-rose-50/60 border border-rose-100 hover:bg-rose-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span className="text-rose-900 font-medium">หมดสต็อก</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-rose-700">{stockData.outCount}</span>
                    <span className="text-[10px] text-rose-500">({chartValues.outPct}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 6. RIGHT PANEL: DYNAMIC LIST (Filtered by KPI or Default) */}
          <section className="md:col-span-5 bg-white rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                  <h3 className="text-xs md:text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {panelTitle}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Admin Cleanup Button for Duplicates */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={cleanupDuplicateOrders}
                      disabled={isCleaningDuplicates}
                      className="text-[10px] font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                      title="ลบรายการสั่งซื้อซ้ำซ้อนในระบบฐานข้อมูล"
                    >
                      {isCleaningDuplicates ? <Loader2 size={11} className="animate-spin text-amber-700" /> : <span>🧹</span>}
                      <span>{isCleaningDuplicates ? 'กำลังล้าง...' : 'ล้างข้อมูลซ้ำ'}</span>
                    </button>
                  )}

                  {/* Manual Clear Button for Pending Delivery */}
                  {activeKPI === 'pending_delivery' && pendingDeliveryList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowClearConfirmModal(true)}
                      className="text-[10px] font-bold text-[#5A8A88] hover:text-[#2D4A49] bg-[#E8F3F2] hover:bg-[#D4E4E3] border border-[#D4E4E3] px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="ล้างรายการที่สต็อกเพียงพอแล้ว"
                    >
                      <CheckCircle2 size={11} className="text-[#5A8A88]" />
                      <span>ล้างตัวเอง</span>
                    </button>
                  )}
                  {activeKPI && (
                    <button
                      onClick={() => setActiveKPI(null)}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    >
                      ล้างตัวกรอง
                    </button>
                  )}
                  <button
                    onClick={() => onNavigate(locationFilter === 'kitchen' ? 'bakeryPlan' : 'barPurchasing')}
                    className="text-[11px] font-bold text-[#5A8A88] hover:text-[#476E6C] flex items-center gap-0.5 cursor-pointer"
                  >
                    สั่งซื้อ
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              {/* Schema Notice if columns needed in Supabase */}
              {schemaNotice && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2.5 rounded-xl mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <span className="truncate">{schemaNotice}</span>
                  </div>
                  <button 
                    onClick={() => setSchemaNotice(null)}
                    className="text-amber-600 hover:text-amber-800 cursor-pointer shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {displayItems.length === 0 ? (
                <div className="py-8 text-center text-[#6B8F8E]">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs md:text-sm font-semibold text-slate-700">ไม่มีรายการในหมวดนี้</p>
                  <p className="text-[11px] text-[#6B8F8E] mt-0.5">{locationLabel} ในหมวดนี้ไม่มีรายการที่ต้องแสดง</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                  {displayItems.map(({ ing, remaining, badgeLabel, badgeClass, order, isPendingConfirm, resolved }: any, index) => {
                    const isPendingKpi = activeKPI === 'pending_delivery';
                    const orderDateStr = order?.ordered_at || order?.order_date;
                    const info = resolved || resolveIngredientInfo(order, ing);
                    const ingId = String(ing?.id || info?.bestIng?.id || order?.ingredient_id || '');
                    const pendingInfo = !isPendingKpi && ingId ? (pendingOrderMap[ingId] || (ing?.id ? pendingOrderMap[ing.id] : undefined)) : undefined;

                    return (
                      <div 
                        key={`${ing?.id || order?.id || order?.ingredient_id || index}-${index}`} 
                        className={`py-2.5 flex items-start justify-between gap-2.5 transition-colors ${
                          pendingInfo 
                            ? 'bg-[#FFF7ED] border-l-2 border-[#F59E0B] px-2 rounded-r-lg' 
                            : 'hover:bg-[#F0F5F4]/50 px-1 rounded-lg'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            remaining <= 0 
                              ? 'bg-rose-50 text-rose-500' 
                              : remaining < (info.minStock ?? 0) 
                                ? 'bg-amber-50 text-amber-500' 
                                : 'bg-[#E8F3F2] text-[#5A8A88]'
                          }`}>
                            {info.department === 'Bar' ? <Coffee size={16} /> : info.department === 'Bakery' ? <Cake size={16} /> : <Package size={16} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#2D4A49] truncate leading-snug" title={info.displayName}>
                              {info.displayName}
                            </p>
                            <p className="text-[10px] text-[#6B8F8E] truncate">
                              {info.displayBrand ? `${info.displayBrand} • ` : ''}ขั้นต่ำ: {info.minStock} {info.unit}
                            </p>
                            {isPendingKpi && orderDateStr && (
                              <p className="text-[10px] text-[#A8BCBB] truncate mt-0.5">
                                สั่งเมื่อ: {formatOrderDateTime(orderDateStr)}
                              </p>
                            )}
                            {pendingInfo && (
                              <div
                                className="inline-flex items-center gap-1 px-[7px] py-[2px] rounded-[5px] border border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C] text-[10px] font-semibold mt-[3px] w-fit whitespace-nowrap shadow-2xs"
                                title={`สั่งซื้อเมื่อ: ${formatOrderDateTime(pendingInfo.ordered_at || pendingInfo.order_date)} จำนวน: ${pendingInfo.order_qty} ${pendingInfo.order_unit || info.unit || 'หน่วย'} วันที่สั่ง: ${pendingInfo.order_date}`}
                              >
                                <span>🚚 สั่งซื้อแล้ว {pendingInfo.order_qty} {pendingInfo.order_unit || info.unit || 'หน่วย'} · รอส่งมอบ</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end max-w-[48%] pl-2 self-start">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold truncate max-w-full ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                          <span className={`text-[10px] font-medium mt-0.5 truncate max-w-full ${
                            isPendingKpi
                              ? remaining < (info.minStock ?? 0)
                                ? 'text-red-500 font-semibold'
                                : isPendingConfirm
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-slate-500'
                              : 'text-slate-500'
                          }`}>
                            คงเหลือ {remaining} / {info.minStock} {info.unit}
                          </span>
                          {isPendingKpi && isPendingConfirm && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap">
                              (รอยืนยันการส่งมอบ)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── 7. EQUIPMENT MAINTENANCE MONITOR CARD (มอนิเตอร์รอบซ่อมบำรุงและนับถอยหลัง) ── */}
        <section className="bg-white rounded-2xl p-3.5 md:p-5 border border-[#D4E4E3] shadow-xs transition-all duration-200">
          {/* Card Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] border border-[#D4E4E3] shadow-2xs shrink-0">
                <Wrench size={16} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-[11px] font-bold text-[#2D4A49]">
                    ติดตามรอบซ่อมบำรุงและตรวจเช็คอุปกรณ์ (Maintenance Schedule)
                  </h3>
                  <span className="text-[9px] font-semibold text-[#5A8A88] bg-[#E8F3F2] px-1.5 py-0.5 rounded border border-[#D4E4E3]">
                    สาขา {user.branch === 'Bangkok' ? 'กรุงเทพฯ' : 'ระยอง'}
                  </span>
                  {maintenanceStats.urgentTotal > 0 && (
                    <span className="text-[9px] font-bold text-white bg-rose-500 px-1.5 py-0.5 rounded-full shadow-2xs animate-pulse">
                      แจ้งเตือน {maintenanceStats.urgentTotal} รายการ
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#6B8F8E] mt-0.5">
                  มอนิเตอร์กำหนดรอบตรวจเช็ค / PM เครื่องมือและอุปกรณ์ล่วงหน้า พร้อมนับถอยหลังจำนวนวัน
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={fetchMaintenanceSchedules}
                disabled={isRefreshingMaintenance}
                className="px-2 py-1 rounded-lg border border-[#D4E4E3] bg-[#F7FAFA] hover:bg-[#E8F3F2] text-[#2D4A49] text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="รีเฟรชข้อมูลล่าสุด"
              >
                <RefreshCw size={11} className={isRefreshingMaintenance ? 'animate-spin text-[#5A8A88]' : ''} />
                <span className="hidden sm:inline">รีเฟรช</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('maintenanceReport')}
                className="px-2.5 py-1 rounded-lg bg-[#5A8A88] hover:bg-[#476E6C] text-white text-[10px] font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span>เปิดรายงานซ่อมบำรุง</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Quick Metrics (4 Mini KPI Cards - Clicking selects status) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
            {/* 1. ทั้งหมด */}
            <div 
              onClick={() => setMaintenanceFilter('all')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                maintenanceFilter === 'all' 
                  ? 'bg-[#E8F3F2] border-[#5A8A88] shadow-xs' 
                  : 'bg-[#F9FBFA] border-[#D4E4E3] hover:bg-[#E8F3F2]/60'
              }`}
            >
              <div className="flex items-center justify-between text-[#6B8F8E]">
                <span className="text-[10px] font-semibold">มีกำหนดรอบทั้งหมด</span>
                <CalendarCheck size={13} className="text-[#5A8A88]" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-[11px] font-black text-[#2D4A49]">
                  {maintenanceStats.total}
                </span>
                <span className="text-[9px] text-[#6B8F8E]">รายการ</span>
              </div>
            </div>

            {/* 2. เกินกำหนด (Overdue) */}
            <div 
              onClick={() => setMaintenanceFilter(prev => prev === 'overdue' ? 'all' : 'overdue')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                maintenanceFilter === 'overdue' 
                  ? 'bg-rose-50 border-rose-400 shadow-xs' 
                  : 'bg-rose-50/50 border-rose-200 hover:bg-rose-50'
              }`}
            >
              <div className="flex items-center justify-between text-rose-700">
                <span className="text-[10px] font-bold">เกินกำหนดแล้ว</span>
                <AlertTriangle size={13} className="text-rose-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-[11px] font-black ${maintenanceStats.overdue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {maintenanceStats.overdue}
                </span>
                <span className="text-[9px] text-rose-600">รายการ</span>
              </div>
            </div>

            {/* 3. ครบกำหนดวันนี้ (Today) */}
            <div 
              onClick={() => setMaintenanceFilter(prev => prev === 'today' ? 'all' : 'today')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                maintenanceFilter === 'today'
                  ? 'bg-amber-100/70 border-amber-400 shadow-xs'
                  : 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between text-amber-800">
                <span className="text-[10px] font-bold">ครบกำหนดวันนี้</span>
                <Clock size={13} className="text-amber-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-[11px] font-black ${maintenanceStats.dueToday > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {maintenanceStats.dueToday}
                </span>
                <span className="text-[9px] text-amber-700">รายการ</span>
              </div>
            </div>

            {/* 4. ภายใน 7 วัน (Next 7 Days) */}
            <div 
              onClick={() => setMaintenanceFilter(prev => prev === 'week' ? 'all' : 'week')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                maintenanceFilter === 'week' 
                  ? 'bg-amber-50 border-amber-400 shadow-xs' 
                  : 'bg-[#F9FBFA] border-[#D4E4E3] hover:bg-amber-50/50'
              }`}
            >
              <div className="flex items-center justify-between text-[#6B8F8E]">
                <span className="text-[10px] font-semibold">ภายใน 7 วัน</span>
                <Clock size={13} className="text-amber-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-[11px] font-black ${maintenanceStats.due7Days > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                  {maintenanceStats.due7Days}
                </span>
                <span className="text-[9px] text-[#6B8F8E]">รายการ</span>
              </div>
            </div>
          </div>

          {/* Filter Bar (Tabs & Department Pills) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pt-0.5">
            {/* Countdown Status Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-[10px]">
              <button
                type="button"
                onClick={() => setMaintenanceFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  maintenanceFilter === 'all'
                    ? 'bg-[#5A8A88] text-white font-bold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ทั้งหมด ({maintenanceStats.total})
              </button>
              <button
                type="button"
                onClick={() => setMaintenanceFilter(prev => prev === 'overdue' ? 'all' : 'overdue')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  maintenanceFilter === 'overdue'
                    ? 'bg-rose-600 text-white font-bold shadow-2xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                🚨 เกินกำหนด ({maintenanceStats.overdue})
              </button>
              <button
                type="button"
                onClick={() => setMaintenanceFilter(prev => prev === 'today' ? 'all' : 'today')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  maintenanceFilter === 'today'
                    ? 'bg-amber-600 text-white font-bold shadow-2xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                🔔 วันนี้ ({maintenanceStats.dueToday})
              </button>
              <button
                type="button"
                onClick={() => setMaintenanceFilter(prev => prev === 'week' ? 'all' : 'week')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  maintenanceFilter === 'week'
                    ? 'bg-amber-500 text-white font-bold shadow-2xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                ⏳ ภายใน 7 วัน ({maintenanceStats.due7Days})
              </button>
              <button
                type="button"
                onClick={() => setMaintenanceFilter(prev => prev === 'month' ? 'all' : 'month')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  maintenanceFilter === 'month'
                    ? 'bg-[#2D4A49] text-white font-bold shadow-2xs'
                    : 'bg-[#E8F3F2] text-[#2D4A49] hover:bg-[#D4E4E3]'
                }`}
              >
                🗓️ ภายใน 30 วัน ({maintenanceStats.due30Days})
              </button>
              {maintenanceStats.future > 0 && (
                <button
                  type="button"
                  onClick={() => setMaintenanceFilter(prev => prev === 'future' ? 'all' : 'future')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    maintenanceFilter === 'future'
                      ? 'bg-teal-700 text-white font-bold shadow-2xs'
                      : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                  }`}
                >
                  ✨ มากกว่า 30 วัน ({maintenanceStats.future})
                </button>
              )}
            </div>

            {/* Department Filter Pills */}
            <div className="flex items-center gap-1 text-[10px] self-end sm:self-auto shrink-0">
              <span className="text-[#6B8F8E] text-[9px] mr-0.5 hidden md:inline">แผนก:</span>
              <button
                type="button"
                onClick={() => setMaintenanceDeptFilter('all')}
                className={`px-2 py-0.5 rounded text-[9px] transition-colors cursor-pointer font-medium ${
                  maintenanceDeptFilter === 'all'
                    ? 'bg-[#2D4A49] text-white font-bold'
                    : 'bg-[#F0F5F4] text-[#6B8F8E] hover:bg-[#E8F3F2]'
                }`}
              >
                ทุกแผนก ({maintenanceList.length})
              </button>
              <button
                type="button"
                onClick={() => setMaintenanceDeptFilter('Bar')}
                className={`px-2 py-0.5 rounded text-[9px] transition-colors cursor-pointer font-medium ${
                  maintenanceDeptFilter === 'Bar'
                    ? 'bg-[#2D4A49] text-white font-bold'
                    : 'bg-[#F0F5F4] text-[#6B8F8E] hover:bg-[#E8F3F2]'
                }`}
              >
                บาร์ ({maintenanceList.filter(i => i.department === 'Bar').length})
              </button>
              <button
                type="button"
                onClick={() => setMaintenanceDeptFilter('Bakery')}
                className={`px-2 py-0.5 rounded text-[9px] transition-colors cursor-pointer font-medium ${
                  maintenanceDeptFilter === 'Bakery'
                    ? 'bg-[#2D4A49] text-white font-bold'
                    : 'bg-[#F0F5F4] text-[#6B8F8E] hover:bg-[#E8F3F2]'
                }`}
              >
                เบเกอรี่ ({maintenanceList.filter(i => i.department === 'Bakery').length})
              </button>
              <button
                type="button"
                onClick={() => setMaintenanceDeptFilter('General')}
                className={`px-2 py-0.5 rounded text-[9px] transition-colors cursor-pointer font-medium ${
                  maintenanceDeptFilter === 'General'
                    ? 'bg-[#2D4A49] text-white font-bold'
                    : 'bg-[#F0F5F4] text-[#6B8F8E] hover:bg-[#E8F3F2]'
                }`}
              >
                ส่วนกลาง ({maintenanceList.filter(i => i.department === 'General').length})
              </button>
            </div>
          </div>

          {/* Cards Grid or Empty State */}
          {loadingMaintenance ? (
            <div className="py-8 text-center text-[#6B8F8E]">
              <Loader2 size={20} className="animate-spin mx-auto text-[#5A8A88] mb-1.5" />
              <p className="text-[10px]">กำลังโหลดกำหนดการซ่อมบำรุง...</p>
            </div>
          ) : displayedMaintenanceList.length === 0 ? (
            <div className="py-7 px-3 text-center bg-[#F9FBFA] rounded-xl border border-dashed border-[#D4E4E3]">
              <div className="w-10 h-10 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center mx-auto mb-2">
                <ShieldCheck size={20} />
              </div>
              <h4 className="text-[11px] font-bold text-[#2D4A49]">
                {maintenanceFilter === 'overdue' 
                  ? `ไม่มีรายการที่เกินกำหนด (${maintenanceDeptFilter === 'all' ? 'ทุกแผนก' : maintenanceDeptFilter})` 
                  : maintenanceFilter === 'today'
                    ? `ไม่มีรายการที่ครบกำหนดวันนี้ (${maintenanceDeptFilter === 'all' ? 'ทุกแผนก' : maintenanceDeptFilter})`
                    : maintenanceFilter === 'week' 
                      ? `ไม่มีรายการที่ต้องตรวจเช็คภายใน 7 วันนี้ (${maintenanceDeptFilter === 'all' ? 'ทุกแผนก' : maintenanceDeptFilter})` 
                      : `ไม่มีอุปกรณ์ที่มีกำหนดรอบซ่อมบำรุงในเงื่อนไขนี้ (${maintenanceDeptFilter === 'all' ? 'ทุกแผนก' : maintenanceDeptFilter})`}
              </h4>
              <p className="text-[10px] text-[#6B8F8E] mt-1 max-w-sm mx-auto leading-relaxed">
                {maintenanceList.length > 0 
                  ? `มีข้อมูลซ่อมบำรุงในระบบ ${maintenanceList.length} รายการ แต่ไม่ตรงกับตัวกรองที่เลือก` 
                  : 'อุปกรณ์ทั้งหมดทำงานได้ตามปกติ หรือยังไม่ได้ระบุวันกำหนดรอบถัดไป'}
              </p>
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                {(maintenanceFilter !== 'all' || maintenanceDeptFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setMaintenanceFilter('all');
                      setMaintenanceDeptFilter('all');
                    }}
                    className="px-3 py-1 rounded-lg border border-[#D4E4E3] bg-white hover:bg-slate-50 text-[#2D4A49] text-[10px] font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    แสดงทั้งหมด ({maintenanceList.length} รายการ)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('maintenanceReport')}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#5A8A88] hover:bg-[#476E6C] text-white text-[10px] font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Wrench size={12} />
                  <span>บันทึกการซ่อมบำรุง / กำหนดรอบ</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedMaintenanceList.map((item: any, idx: number) => {
                const days = calculateDaysRemaining(item.nextServiceDate);
                const isOverdue = days < 0;
                const isToday = days === 0;
                const isUrgent = days > 0 && days <= 7;

                return (
                  <div
                    key={item.id || idx}
                    className={`p-3 rounded-xl border transition-all relative flex flex-col justify-between hover:shadow-xs ${
                      isOverdue 
                        ? 'bg-rose-50/40 border-rose-200' 
                        : isToday 
                          ? 'bg-amber-50/40 border-amber-300' 
                          : isUrgent 
                            ? 'bg-amber-50/20 border-amber-200' 
                            : 'bg-white border-[#D4E4E3]'
                    }`}
                  >
                    <div>
                      {/* Top Row: Department & Countdown Pill */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                            item.department === 'Bar' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : item.department === 'Bakery' 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {item.department === 'Bar' ? 'บาร์' : item.department === 'Bakery' ? 'เบเกอรี่' : 'ส่วนกลาง'}
                          </span>

                          {item.equipmentCode && (
                            <span className="text-[9px] font-mono font-medium text-slate-500 bg-slate-50 px-1 py-0.5 rounded border border-slate-200">
                              {item.equipmentCode}
                            </span>
                          )}
                        </div>

                        {/* COUNTDOWN BADGE */}
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shadow-2xs flex items-center gap-1 shrink-0 ${
                          isOverdue 
                            ? 'bg-rose-600 text-white animate-pulse' 
                            : isToday 
                              ? 'bg-amber-500 text-white font-black' 
                              : isUrgent 
                                ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                : days <= 30 
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold' 
                                  : 'bg-[#E8F3F2] text-[#2D4A49] border border-[#D4E4E3] font-medium'
                        }`}>
                          {isOverdue ? (
                            <>
                              <span>🚨</span>
                              <span>เกินกำหนด {Math.abs(days)} วัน</span>
                            </>
                          ) : isToday ? (
                            <>
                              <span>🔔</span>
                              <span>ครบกำหนดวันนี้!</span>
                            </>
                          ) : isUrgent ? (
                            <>
                              <span>⏳</span>
                              <span>อีก {days} วัน</span>
                            </>
                          ) : (
                            <>
                              <span>🗓️</span>
                              <span>อีก {days} วัน</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Equipment Name */}
                      <h4 className="text-[11px] font-bold text-[#2D4A49] leading-snug line-clamp-1" title={item.equipmentName}>
                        {item.equipmentName}
                      </h4>

                      {/* Maintenance Type & Category */}
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-[#6B8F8E] truncate">
                        <span className="truncate">{item.category}</span>
                        <span>•</span>
                        <span className="font-medium text-slate-700 truncate">
                          {item.maintenanceType === 'Preventive' ? 'PM บำรุงรักษาเชิงป้องกัน' :
                           item.maintenanceType === 'Repair' ? 'ซ่อมแซมแก้ไข' :
                           item.maintenanceType === 'Inspection' ? 'ตรวจเช็คสภาพ' :
                           item.maintenanceType === 'Calibration' ? 'ปรับเทียบมาตรฐาน' :
                           item.maintenanceType === 'PartReplacement' ? 'เปลี่ยนอะไหล่' : item.maintenanceType}
                        </span>
                      </div>

                      {/* Details & Technician */}
                      <div className="mt-2 pt-1.5 border-t border-slate-100/80 space-y-1 text-[10px]">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-[9px] text-[#6B8F8E]">กำหนดรอบถัดไป:</span>
                          <span className="font-bold text-[#2D4A49]">
                            {formatThaiDisplayDate(item.nextServiceDate)}
                          </span>
                        </div>

                        {item.technicianName && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-[9px] text-[#6B8F8E]">ผู้ดูแล / ช่าง:</span>
                            <span className="font-medium text-slate-700 truncate max-w-[140px]">
                              {item.technicianName}
                            </span>
                          </div>
                        )}

                        {item.contactNumber && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-[9px] text-[#6B8F8E]">เบอร์ติดต่อ:</span>
                            <a 
                              href={`tel:${item.contactNumber}`}
                              className="font-mono text-[9px] text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              <Phone size={9} />
                              <span>{item.contactNumber}</span>
                            </a>
                          </div>
                        )}

                        {item.details && (
                          <p className="text-[9px] text-[#6B8F8E] line-clamp-1 mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100" title={item.details}>
                            {item.details}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[9px] text-slate-400">
                        {item.date ? `ทำล่าสุด: ${formatThaiDisplayDate(item.date)}` : 'รอบกำหนดใหม่'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('maintenanceReport')}
                        className="text-[10px] font-bold text-[#5A8A88] hover:text-[#476E6C] flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>เปิดประวัติ</span>
                        <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>

      {/* Clear Delivery Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-[#D4E4E3] space-y-3.5 animate-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Truck size={22} />
            </div>
            <div className="text-center">
              <h4 className="text-[14px] font-bold text-[#2D4A49]">ยืนยันการล้างรายการ</h4>
              <p className="text-[12px] text-[#6B8F8E] mt-1.5 leading-relaxed">
                ต้องการล้างรายการที่สต็อกเพียงพอแล้วหรือไม่?
              </p>
              <p className="text-[11px] text-[#A8BCBB] mt-1">
                (รายการที่สต็อกคงเหลือ &ge; ขั้นต่ำ จะถูกเปลี่ยนสถานะเป็นส่งมอบแล้ว)
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                disabled={isProcessingClear}
                className="flex-1 py-2 rounded-xl border border-[#D4E4E3] text-[#2D4A49] font-semibold text-[11px] hover:bg-[#F0F5F4] transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleManualClear}
                disabled={isProcessingClear}
                className="flex-1 py-2 rounded-xl bg-[#5A8A88] text-white font-semibold text-[11px] hover:bg-[#4A7A78] transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                {isProcessingClear ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>กำลังล้าง...</span>
                  </>
                ) : (
                  <span>ล้างรายการ</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center font-bold text-2xl mx-auto shadow-xs border-2 border-[#D4E4E3]">
              {user.name.charAt(0)}
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">{user.name}</h3>
              <p className="text-xs font-semibold text-[#5A8A88] mt-0.5">{user.role}</p>
              <p className="text-[11px] text-slate-400 mt-1">สาขา: {user.branch === 'Rayong' ? 'ระยอง' : 'กรุงเทพฯ'}</p>
            </div>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => { setShowProfileModal(false); onNavigate('userSettings'); }}
                className="w-full py-2.5 rounded-full bg-[#E8F3F2] text-[#476E6C] font-semibold text-xs hover:bg-[#D8EAE8] transition-colors"
              >
                จัดการบัญชีและความปลอดภัย
              </button>
              <button
                onClick={() => { setShowProfileModal(false); onLogout(); }}
                className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-xs hover:bg-rose-100 transition-colors"
              >
                ออกจากระบบ
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full py-2 rounded-full text-slate-400 font-medium text-xs hover:text-slate-600 transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Info Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center mx-auto">
              <Building size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-800">ข้อมูลสาขา (Branch Info)</h3>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                📍 สาขาปัจจุบัน: <span className="font-bold text-[#5A8A88]">{user.branch === 'Rayong' ? 'สาขาระยอง (Rayong)' : 'สาขากรุงเทพฯ (Bangkok)'}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                ระบบจัดเก็บข้อมูลและประวัติสต็อกแยกตามสาขาเพื่อความถูกต้องของการดำเนินงาน
              </p>
            </div>
            <button
              onClick={() => setShowBranchModal(false)}
              className="w-full py-2.5 rounded-full bg-[#5A8A88] text-white font-semibold text-xs hover:bg-[#476E6C] transition-colors"
            >
              ตกลง (OK)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
