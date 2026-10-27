import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  ChevronLeft, 
  Calendar, 
  Download, 
  Printer, 
  ShoppingCart, 
  Coffee, 
  ChefHat, 
  LayoutGrid, 
  Building2, 
  PackageCheck,
  ChevronDown,
  Check,
  X,
  Eye,
  Save,
  Loader2,
  AlertTriangle,
  Truck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Ingredient } from '../types';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export interface OrderRecord {
  id?: string;
  ingredient_id: string;
  order_date: string;
  order_qty: number;
  order_unit?: string;
  ordered_by?: string;
  ordered_at?: string;
  branch: string;
  stock_date: string;
  created_at?: string;
  delivered_at?: string | null;
  status?: string;
}

interface PurchasingReportProps {
  ingredients: Ingredient[];
  stockRecord: Record<string, Record<string, number | { in?: number; out?: number; remaining?: number; waste?: number; usageInfo?: string }>>;
  onBack: () => void;
  onNavigate?: (tab: string) => void;
  allowedDepartments?: ('Bar' | 'Bakery')[];
  branch?: string;
  user?: { name: string; role?: string };
}

type DepartmentFilter = 'All' | 'Bar' | 'Bakery';

export const PurchasingReport: React.FC<PurchasingReportProps> = ({
  ingredients,
  stockRecord,
  onBack,
  onNavigate,
  allowedDepartments = ['Bar', 'Bakery'],
  branch,
  user,
}) => {
  const currentBranch = branch || 'Rayong';
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const initialDept = allowedDepartments.length === 2 ? 'All' : allowedDepartments[0] || 'All';
  const [activeDepartment, setActiveDepartment] = useState<DepartmentFilter>(initialDept);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // ─── PENDING DELIVERY STATE & HELPERS (STEP 1) ───
  const [pendingOrderMap, setPendingOrderMap] = useState<Record<string, {
    order_date: string;
    order_qty: number;
    order_unit: string;
    ordered_by: string;
    ordered_at: string;
    delivered_at?: string;
  }>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchPendingOrders = async () => {
      // 1. Instant fallback from localStorage
      try {
        const raw = localStorage.getItem('cafe_purchasing_orders');
        if (raw) {
          const list = JSON.parse(raw);
          const localMap: Record<string, any> = {};
          list.forEach((item: any) => {
            if ((!item.branch || item.branch === currentBranch) && item.order_date && Number(item.order_qty) > 0 && !item.delivered_at) {
              localMap[item.ingredient_id] = item;
            }
          });
          if (isMounted && Object.keys(localMap).length > 0) {
            setPendingOrderMap(localMap);
          }
        }
      } catch {}

      // 2. Fetch from Supabase purchasing_orders table
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('purchasing_orders')
            .select('*')
            .eq('branch', currentBranch)
            .not('order_date', 'is', null)
            .gt('order_qty', 0)
            .is('delivered_at', null);

          if (!error && data && isMounted) {
            const map: Record<string, any> = {};
            data.forEach((item: any) => {
              map[item.ingredient_id] = item;
            });
            setPendingOrderMap(map);
          }
        } catch (e) {
          console.warn('Error fetching pending orders from Supabase:', e);
        }
      }
    };

    fetchPendingOrders();
    return () => {
      isMounted = false;
    };
  }, [currentBranch]);

  const isPendingDelivery = (ingredientId: string): boolean => {
    return !!pendingOrderMap[ingredientId];
  };

  const formatDisplayDate = (dStr?: string) => {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) {
        return format(d, 'dd/MM/yyyy');
      }
    } catch {}
    return dStr;
  };

  // ─── ORDER TRACKING STATE & CURRENT USER ───
  const currentUser = useMemo(() => {
    if (user?.name) return user.name;
    try {
      const raw = localStorage.getItem('cafe-user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) return parsed.name;
      }
    } catch {}
    return 'Admin';
  }, [user]);

  const [orders, setOrders] = useState<Record<string, OrderRecord>>({});
  const [savedOrders, setSavedOrders] = useState<Record<string, OrderRecord>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [changedItems, setChangedItems] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
    // Reorder warning modal state
  const [reorderWarning, setReorderWarning] = useState<{
    show: boolean;
    supplierId: string;
    supplierItems: any[];
    items: Array<{
      ingredientId: string;
      name: string;
      brand: string;
      unit: string;
      existingDate: string;
      existingQty: number;
      newQty: number;
      newDate: string;
    }>;
  }>({
    show: false,
    supplierId: "",
    supplierItems: [],
    items: []
  });

  const [supplierSaveState, setSupplierSaveState] = useState<Record<string, 'idle' | 'dirty' | 'saving' | 'saved'>>({});
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const hasDirtySuppliers = useMemo(() => {
    return Object.values(supplierSaveState)
      .some(state => state === 'dirty');
  }, [supplierSaveState]);

  const dirtySupplierNames = useMemo(() => {
    return Object.entries(supplierSaveState)
      .filter(([_, state]) => state === 'dirty')
      .map(([name, _]) => name);
  }, [supplierSaveState]);

  useEffect(() => {
    const handleBeforeUnload =
      (e: BeforeUnloadEvent) => {
        if (hasDirtySuppliers) {
          e.preventDefault();
          e.returnValue =
            'มีข้อมูลที่ยังไม่ได้บันทึก' +
            ' ต้องการออกจากหน้านี้หรือไม่?';
          return e.returnValue;
        }
      };

    window.addEventListener(
      'beforeunload', handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        'beforeunload', handleBeforeUnload
      );
    };
  }, [hasDirtySuppliers]);

  const handleNavigate = (tab: string) => {
    if (hasDirtySuppliers) {
      setPendingNavigation(tab);
      setShowLeaveWarning(true);
    } else {
      if (onNavigate) {
        onNavigate(tab);
      } else {
        onBack();
      }
    }
  };

  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    brand?: string;
    category?: string;
    unit?: string;
  } | null>(null);

  // Close image preview on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
      }
    };
    if (previewImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);


  // Format datetime for display: DD/MM HH:MM น.
  const formatOrderDateTime = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${day}/${month} ${hours}:${mins} น.`;
    } catch {
      return isoStr;
    }
  };

  // Load existing orders when page opens or date/branch changes
  useEffect(() => {
    const currentBranch = branch || 'Rayong';
    let isMounted = true;

    const loadOrders = async () => {
      // 1. Load from localStorage first for instant display
      const localMap: Record<string, OrderRecord> = {};
      try {
        const raw = localStorage.getItem('cafe_purchasing_orders');
        if (raw) {
          const list: OrderRecord[] = JSON.parse(raw);
          list
            .filter(item => (!item.branch || item.branch === currentBranch) && item.stock_date === selectedDate)
            .forEach(item => {
              localMap[item.ingredient_id] = item;
            });
        }
      } catch (e) {
        console.warn('Error reading local orders:', e);
      }

      if (isMounted) {
        setOrders(localMap);
        setSavedOrders(localMap);
        setHasUnsavedChanges(false);
        setChangedItems(new Set());
      }

      // 2. Fetch from Supabase purchasing_orders table
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('purchasing_orders')
            .select('*')
            .eq('branch', currentBranch)
            .eq('stock_date', selectedDate);

          if (!error && data && isMounted) {
            const remoteMap: Record<string, OrderRecord> = { ...localMap };
            data.forEach((item: OrderRecord) => {
              remoteMap[item.ingredient_id] = item;
            });
            setOrders(remoteMap);
            setSavedOrders(remoteMap);
            setHasUnsavedChanges(false);
            setChangedItems(new Set());

            // Sync into localStorage
            try {
              const rawAll = localStorage.getItem('cafe_purchasing_orders');
              let allList: OrderRecord[] = rawAll ? JSON.parse(rawAll) : [];
              allList = allList.filter(o => !(o.branch === currentBranch && o.stock_date === selectedDate));
              allList.push(...data);
              localStorage.setItem('cafe_purchasing_orders', JSON.stringify(allList));
            } catch {}
          } else if (error && (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist'))) {
            // Table doesn't exist yet in Supabase schema cache; check app_settings backup
            try {
              const { data: sData } = await supabase
                .from('app_settings')
                .select('setting_value')
                .eq('setting_key', `purchasing_orders_${currentBranch}_${selectedDate}`)
                .maybeSingle();

              if (sData?.setting_value && Array.isArray(sData.setting_value) && isMounted) {
                const remoteMap: Record<string, OrderRecord> = { ...localMap };
                sData.setting_value.forEach((item: OrderRecord) => {
                  remoteMap[item.ingredient_id] = item;
                });
                setOrders(remoteMap);
                setSavedOrders(remoteMap);
                setHasUnsavedChanges(false);
                setChangedItems(new Set());
              }
            } catch {}
          }
        } catch (err) {
          console.warn('Error fetching purchasing_orders from Supabase:', err);
        }
      }
    };

    loadOrders();
    setSupplierSaveState({});

    return () => {
      isMounted = false;
    };
  }, [branch, selectedDate]);

  // Handle immediate field change in inputs
  const handleOrderFieldChange = (
    ingredientId: string,
    field: 'order_date' | 'order_qty',
    val: string | number,
    unit: string,
    supplierName?: string
  ) => {
    setHasUnsavedChanges(true);
    setChangedItems(prev => new Set(prev).add(ingredientId));

    if (supplierName) {
      setSupplierSaveState(prev => ({
        ...prev,
        [supplierName]: 'dirty'
      }));
    }

    setOrders(prev => {
      const existing = prev[ingredientId] || {
        ingredient_id: ingredientId,
        order_date: '',
        order_qty: 0,
        order_unit: unit,
        ordered_by: '',
        ordered_at: '',
        branch: branch || 'Rayong',
        stock_date: selectedDate
      };

      const nextDate = field === 'order_date' ? (val as string) : existing.order_date;
      const nextQty = field === 'order_qty' ? (val === '' ? 0 : Number(val)) : existing.order_qty;

      // Auto-populate when order_date OR order_qty is filled in
      const isFilled = Boolean(nextDate) || nextQty > 0;
      const ordered_by = isFilled ? (existing.ordered_by || currentUser) : existing.ordered_by;
      const ordered_at = isFilled ? (existing.ordered_at || new Date().toISOString()) : existing.ordered_at;

      return {
        ...prev,
        [ingredientId]: {
          ...existing,
          [field]: field === 'order_qty' ? nextQty : val,
          order_unit: unit,
          ordered_by,
          ordered_at
        }
      };
    });
  };

  // Revert all unsaved changes back to saved state
  const handleRevertChanges = () => {
    setOrders(savedOrders);
    setHasUnsavedChanges(false);
    setChangedItems(new Set());
    setSupplierSaveState({});
  };

  // Save order items for a specific supplier
  
  // Cancel reorder: revert pending items in warning back to saved state
  const handleCancelReorder = () => {
    if (!reorderWarning.items || reorderWarning.items.length === 0) {
      setReorderWarning(prev => ({ ...prev, show: false }));
      return;
    }
    const revertedOrders = { ...orders };
    const nextChanged = new Set(changedItems);
    
    reorderWarning.items.forEach(warnItem => {
      const ingId = warnItem.ingredientId;
      nextChanged.delete(ingId);
      if (savedOrders[ingId]) {
        revertedOrders[ingId] = { ...savedOrders[ingId] };
      } else {
        delete revertedOrders[ingId];
      }
    });

    setOrders(revertedOrders);
    setChangedItems(nextChanged);
    if (nextChanged.size === 0) {
      setHasUnsavedChanges(false);
    }
    // Check if supplier has any other changed items
    const supHasRemainingChanges = reorderWarning.supplierItems.some(
      it => nextChanged.has(it.id)
    );
    if (!supHasRemainingChanges && reorderWarning.supplierId) {
      setSupplierSaveState(prev => ({
        ...prev,
        [reorderWarning.supplierId]: "idle"
      }));
    }
    setReorderWarning(prev => ({ ...prev, show: false, items: [] }));
  };

  // Guard before saving: check if any items are already pending delivery
  const handleSaveWithCheck = (
    supplierId: string,
    supplierItems: (typeof purchasesToMake)
  ) => {
    const pendingConflicts: Array<{
      ingredientId: string;
      name: string;
      brand: string;
      unit: string;
      existingDate: string;
      existingQty: number;
      newQty: number;
      newDate: string;
    }> = [];

    supplierItems.forEach(item => {
      const pending = pendingOrderMap[item.id];
      const order = orders[item.id];
      const isPending = Boolean(pending && pending.order_qty > 0);
      const isOrdering = order && (Boolean(order.order_date) || Number(order.order_qty) > 0);

      if (isPending && isOrdering) {
        pendingConflicts.push({
          ingredientId: item.id,
          name: item.name,
          brand: item.brand || "",
          unit: item.unit,
          existingDate: pending.order_date,
          existingQty: pending.order_qty,
          newQty: Number(order?.order_qty) || 0,
          newDate: order?.order_date || selectedDate
        });
      }
    });

    if (pendingConflicts.length > 0) {
      setReorderWarning({
        show: true,
        supplierId,
        supplierItems,
        items: pendingConflicts
      });
    } else {
      handleSaveSupplier(supplierId, supplierItems);
    }
  };

  const handleSaveSupplier = async (
    supplierId: string,
    supplierItems: (typeof purchasesToMake)
  ) => {
    try {
      // Set saving state
      setSupplierSaveState(prev => ({
        ...prev,
        [supplierId]: 'saving'
      }));

      const currentBranch = branch || 'Rayong';
      const nowIso = new Date().toISOString();

      const itemsToSave: OrderRecord[] = [];
      const updatedOrdersMap: Record<string, OrderRecord> = { ...orders };

      supplierItems.forEach(item => {
        const itemOrder = updatedOrdersMap[item.id];
        const isChanged = changedItems.has(item.id);
        if (itemOrder && (Boolean(itemOrder.order_date) || Number(itemOrder.order_qty) > 0 || isChanged)) {
          const isFilled = Boolean(itemOrder.order_date) || Number(itemOrder.order_qty) > 0;
          const record: OrderRecord = {
            ...itemOrder,
            ingredient_id: item.id,
            order_date: itemOrder.order_date || '',
            order_qty: Number(itemOrder.order_qty) || 0,
            order_unit: item.unit,
            ordered_by: isFilled ? (itemOrder.ordered_by || currentUser) : '',
            ordered_at: isFilled ? (itemOrder.ordered_at || nowIso) : '',
            branch: currentBranch,
            stock_date: selectedDate,
          };
          updatedOrdersMap[item.id] = record;
          itemsToSave.push(record);
        }
      });

      if (itemsToSave.length === 0) {
        setSupplierSaveState(prev => ({
          ...prev,
          [supplierId]: 'idle'
        }));
        return;
      }

      setOrders(updatedOrdersMap);
      setSavedOrders(prev => {
        const next = { ...prev };
        itemsToSave.forEach(it => {
          next[it.ingredient_id] = it;
        });
        return next;
      });

      // Remove saved items for this supplier from changedItems set
      setChangedItems(prev => {
        const next = new Set(prev);
        itemsToSave.forEach(it => next.delete(it.ingredient_id));
        if (next.size === 0) {
          setHasUnsavedChanges(false);
        }
        return next;
      });

      // 1. Save to localStorage
      try {
        const rawAll = localStorage.getItem('cafe_purchasing_orders');
        let allList: OrderRecord[] = rawAll ? JSON.parse(rawAll) : [];
        itemsToSave.forEach(item => {
          const isPending = Boolean(item.order_date) && Number(item.order_qty) > 0;
          if (isPending) {
            allList = allList.filter(o => !(o.ingredient_id === item.ingredient_id && o.branch === currentBranch && !o.delivered_at && o.status !== 'delivered'));
            allList.push(item);
          } else {
            const idx = allList.findIndex(o => 
              o.ingredient_id === item.ingredient_id && 
              o.branch === currentBranch && 
              o.stock_date === selectedDate
            );
            if (idx >= 0) {
              allList[idx] = { ...allList[idx], ...item };
            } else {
              allList.push(item);
            }
          }
        });
        localStorage.setItem('cafe_purchasing_orders', JSON.stringify(allList));
      } catch (e) {
        console.warn('Error saving local orders:', e);
      }

      // 2. Prevent duplicate pending orders & upsert to Supabase
      if (supabase && itemsToSave.length > 0) {
        try {
          // Identify ingredients that have a pending order (has date and qty > 0)
          const pendingIngIds = itemsToSave
            .filter(item => Boolean(item.order_date) && Number(item.order_qty) > 0)
            .map(item => item.ingredient_id);

          // Delete existing pending orders (delivered_at IS NULL) for these ingredients to avoid duplicate rows
          if (pendingIngIds.length > 0) {
            try {
              await supabase
                .from('purchasing_orders')
                .delete()
                .eq('branch', currentBranch)
                .in('ingredient_id', pendingIngIds)
                .is('delivered_at', null);
            } catch (delErr) {
              console.warn('Error deleting prior pending orders before insert:', delErr);
            }
          }

          // If any item was cleared (order_qty === 0 or empty order_date), also delete existing pending order
          const clearedIngIds = itemsToSave
            .filter(item => !item.order_date || Number(item.order_qty) <= 0)
            .map(item => item.ingredient_id);

          if (clearedIngIds.length > 0) {
            try {
              await supabase
                .from('purchasing_orders')
                .delete()
                .eq('branch', currentBranch)
                .in('ingredient_id', clearedIngIds)
                .is('delivered_at', null);
            } catch (delErr) {
              console.warn('Error deleting cleared orders:', delErr);
            }
          }

          const dbPayload = itemsToSave
            .filter(item => Boolean(item.order_date) || Number(item.order_qty) > 0)
            .map(item => ({
              ingredient_id: item.ingredient_id,
              order_date: item.order_date || null,
              order_qty: item.order_qty || 0,
              order_unit: item.order_unit || '',
              ordered_by: item.ordered_by || currentUser || null,
              ordered_at: item.ordered_at || nowIso,
              branch: item.branch,
              stock_date: item.stock_date,
              status: 'pending',
              delivered_at: null,
            }));

          if (dbPayload.length > 0) {
            const { error } = await supabase
              .from('purchasing_orders')
              .insert(dbPayload);

            // Update pendingOrderMap locally so the UI badges refresh immediately
            setPendingOrderMap(prev => {
              const next = { ...prev };
              itemsToSave.forEach(it => {
                if (Boolean(it.order_date) && Number(it.order_qty) > 0) {
                  next[it.ingredient_id] = {
                    order_date: it.order_date || '',
                    order_qty: Number(it.order_qty) || 0,
                    order_unit: it.order_unit || '',
                    ordered_by: it.ordered_by || currentUser || '',
                    ordered_at: it.ordered_at || nowIso,
                  };
                } else {
                  delete next[it.ingredient_id];
                }
              });
              return next;
            });

            if (error) {
              if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
                // purchasing_orders table does not exist in schema cache; save backup to app_settings
                console.warn('purchasing_orders table not found in Supabase (PGRST205). Saving backup to app_settings and localStorage.');
                try {
                  const rawAll = localStorage.getItem('cafe_purchasing_orders');
                  const allList: OrderRecord[] = rawAll ? JSON.parse(rawAll) : [];
                  const currentDayOrders = allList.filter(o => o.branch === currentBranch && o.stock_date === selectedDate);
                  await supabase.from('app_settings').upsert({
                    setting_key: `purchasing_orders_${currentBranch}_${selectedDate}`,
                    setting_value: currentDayOrders
                  });
                } catch (backupErr) {
                  console.warn('app_settings backup error:', backupErr);
                }
              } else {
                console.warn('Supabase purchasing_orders upsert warning:', error.message);
              }
            }
          }
        } catch (supErr: any) {
          console.warn('Supabase save warning (saved to localStorage):', supErr?.message || supErr);
        }
      }

      // Update pendingOrderMap locally so the amber "รอส่งมอบ" badge updates immediately
      setPendingOrderMap(prev => {
        const next = { ...prev };
        itemsToSave.forEach(it => {
          if (it.order_date && Number(it.order_qty) > 0) {
            next[it.ingredient_id] = it;
          } else {
            delete next[it.ingredient_id];
          }
        });
        return next;
      });

      // Success state → reset after 2 sec
      setSupplierSaveState(prev => ({
        ...prev,
        [supplierId]: 'saved'
      }));

      setTimeout(() => {
        setSupplierSaveState(prev => ({
          ...prev,
          [supplierId]: 'idle'
        }));
      }, 2000);

    } catch (err: any) {
      console.warn('Save error:', err);
      // Reset to dirty so user can retry
      setSupplierSaveState(prev => ({
        ...prev,
        [supplierId]: 'dirty'
      }));
      alert(`บันทึกไม่สำเร็จ: ${err.message || 'โปรดลองอีกครั้ง'}`);
    }
  };

  // Save all changed order items to localStorage & Supabase
  const handleSaveAllChanges = async () => {
    setIsSaving(true);
    const currentBranch = branch || 'Rayong';
    const nowIso = new Date().toISOString();

    const updatedOrdersMap: Record<string, OrderRecord> = { ...orders };
    const itemsToPersist: OrderRecord[] = [];

    changedItems.forEach(ingredientId => {
      const itemOrder = updatedOrdersMap[ingredientId];
      if (itemOrder) {
        const isFilled = Boolean(itemOrder.order_date) || Number(itemOrder.order_qty) > 0;
        const record: OrderRecord = {
          ...itemOrder,
          ingredient_id: ingredientId,
          branch: currentBranch,
          stock_date: selectedDate,
          ordered_by: isFilled ? (itemOrder.ordered_by || currentUser) : '',
          ordered_at: isFilled ? (itemOrder.ordered_at || nowIso) : '',
        };
        updatedOrdersMap[ingredientId] = record;
        itemsToPersist.push(record);
      }
    });

    setOrders(updatedOrdersMap);

    // 1. Save to localStorage
    try {
      const rawAll = localStorage.getItem('cafe_purchasing_orders');
      let allList: OrderRecord[] = rawAll ? JSON.parse(rawAll) : [];
      itemsToPersist.forEach(item => {
        const isPending = Boolean(item.order_date) && Number(item.order_qty) > 0;
        if (isPending) {
          allList = allList.filter(o => !(o.ingredient_id === item.ingredient_id && o.branch === currentBranch && !o.delivered_at && o.status !== 'delivered'));
          allList.push(item);
        } else {
          const idx = allList.findIndex(o => 
            o.ingredient_id === item.ingredient_id && 
            o.branch === currentBranch && 
            o.stock_date === selectedDate
          );
          if (idx >= 0) {
            allList[idx] = { ...allList[idx], ...item };
          } else {
            allList.push(item);
          }
        }
      });
      localStorage.setItem('cafe_purchasing_orders', JSON.stringify(allList));
    } catch (e) {
      console.warn('Error saving local orders:', e);
    }

    // 2. Prevent duplicate pending orders & upsert to Supabase
    if (supabase && itemsToPersist.length > 0) {
      try {
        const pendingIngIds = itemsToPersist
          .filter(item => Boolean(item.order_date) && Number(item.order_qty) > 0)
          .map(item => item.ingredient_id);

        if (pendingIngIds.length > 0) {
          try {
            await supabase
              .from('purchasing_orders')
              .delete()
              .eq('branch', currentBranch)
              .in('ingredient_id', pendingIngIds)
              .is('delivered_at', null);
          } catch (delErr) {
            console.warn('Error deleting prior pending orders before insert:', delErr);
          }
        }

        const clearedIngIds = itemsToPersist
          .filter(item => !item.order_date || Number(item.order_qty) <= 0)
          .map(item => item.ingredient_id);

        if (clearedIngIds.length > 0) {
          try {
            await supabase
              .from('purchasing_orders')
              .delete()
              .eq('branch', currentBranch)
              .in('ingredient_id', clearedIngIds)
              .is('delivered_at', null);
          } catch (delErr) {
            console.warn('Error deleting cleared orders:', delErr);
          }
        }

        const payloads = itemsToPersist
          .filter(r => Boolean(r.order_date) || Number(r.order_qty) > 0)
          .map(r => ({
            ingredient_id: r.ingredient_id,
            order_date: r.order_date || null,
            order_qty: r.order_qty || 0,
            order_unit: r.order_unit || '',
            ordered_by: r.ordered_by || null,
            ordered_at: r.ordered_at || null,
            branch: currentBranch,
            stock_date: selectedDate,
          }));

        if (payloads.length > 0) {
          const { error } = await supabase
            .from('purchasing_orders')
            .upsert(payloads, { onConflict: 'ingredient_id,stock_date,branch' });

          if (error) {
            if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
              try {
                await supabase.from('app_settings').upsert({
                  setting_key: `purchasing_orders_${currentBranch}_${selectedDate}`,
                  setting_value: itemsToPersist
                });
              } catch {}
            } else {
              console.warn('Supabase purchasing_orders upsert error:', error.message);
            }
          }
        }
      } catch (err) {
        console.warn('Error saving to Supabase:', err);
      }
    }

    // Update pendingOrderMap locally
    setPendingOrderMap(prev => {
      const next = { ...prev };
      itemsToPersist.forEach(it => {
        if (it.order_date && Number(it.order_qty) > 0) {
          next[it.ingredient_id] = it;
        } else {
          delete next[it.ingredient_id];
        }
      });
      return next;
    });

    setSavedOrders(updatedOrdersMap);
    setHasUnsavedChanges(false);
    setChangedItems(new Set());
    setSupplierSaveState(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (next[k] === 'dirty' || next[k] === 'saving') {
          next[k] = 'saved';
        }
      });
      return next;
    });
    setTimeout(() => {
      setSupplierSaveState({});
    }, 2000);
    setIsSaving(false);
    setSaveSuccessMsg(`บันทึกข้อมูลเรียบร้อยแล้ว (${itemsToPersist.length} รายการ)`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Retain existing function to satisfy "❌ FORBIDDEN: Remove any existing function"
  const handleOrderSave = async (ingredientId: string, unit: string) => {
    const currentBranch = branch || 'Rayong';
    const itemOrder = orders[ingredientId];
    if (!itemOrder) return;

    const nowIso = new Date().toISOString();
    const isFilled = Boolean(itemOrder.order_date) || itemOrder.order_qty > 0;

    const recordToSave: OrderRecord = {
      ...itemOrder,
      ingredient_id: ingredientId,
      order_unit: unit || itemOrder.order_unit || '',
      branch: currentBranch,
      stock_date: selectedDate,
      ordered_by: isFilled ? (itemOrder.ordered_by || currentUser) : '',
      ordered_at: isFilled ? (itemOrder.ordered_at || nowIso) : '',
    };

    setOrders(prev => ({
      ...prev,
      [ingredientId]: recordToSave
    }));

    try {
      const rawAll = localStorage.getItem('cafe_purchasing_orders');
      let allList: OrderRecord[] = rawAll ? JSON.parse(rawAll) : [];
      const idx = allList.findIndex(o => 
        o.ingredient_id === ingredientId && 
        o.branch === currentBranch && 
        o.stock_date === selectedDate
      );
      if (idx >= 0) {
        allList[idx] = { ...allList[idx], ...recordToSave };
      } else {
        allList.push(recordToSave);
      }
      localStorage.setItem('cafe_purchasing_orders', JSON.stringify(allList));
    } catch (e) {
      console.warn('Error saving local orders:', e);
    }

    if (supabase) {
      try {
        const payload: any = {
          ingredient_id: ingredientId,
          order_date: recordToSave.order_date || null,
          order_qty: recordToSave.order_qty || 0,
          order_unit: recordToSave.order_unit || '',
          ordered_by: recordToSave.ordered_by || null,
          ordered_at: recordToSave.ordered_at || null,
          branch: currentBranch,
          stock_date: selectedDate,
        };

        const { error } = await supabase
          .from('purchasing_orders')
          .upsert(payload, { onConflict: 'ingredient_id,stock_date,branch' });

        if (error) {
          if (error.code !== 'PGRST205' && error.code !== '42P01' && !error.message?.includes('does not exist')) {
            console.warn('Supabase purchasing_orders upsert warning:', error.message);
          }
        }
      } catch (err) {
        console.warn('Error upserting purchasing_orders:', err);
      }
    }
  };

  const handleBackClick = () => {
    handleNavigate('home');
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSupplierDropdownOpen(false);
        setIsExportOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const allPurchasesToMake = useMemo(() => {
    // 1. Strict branch isolation: ensure ingredients belong to the active branch
    const branchIngredients = branch 
      ? ingredients.filter(ing => !ing.branch || ing.branch === branch)
      : ingredients;

    // 2. Filter ingredients by department
    const allowedIngs = branchIngredients.filter(ing => allowedDepartments.includes(ing.department as any));
    const departmentIngredients = activeDepartment === 'All' 
      ? allowedIngs 
      : allowedIngs.filter(ing => ing.department === activeDepartment);

    const sortedDatesAsc = Object.keys(stockRecord).sort();
    const currentRemaining: Record<string, number> = {};
    sortedDatesAsc.forEach(dateKey => {
      if (dateKey > selectedDate) return;
      departmentIngredients.forEach(ing => {
        const id = ing.id;
        const val = stockRecord[dateKey]?.[id];
        
        if (typeof val === 'number') {
          currentRemaining[id] = val;
        } else if (val) {
          const inVal = (val as any).in === null || (val as any).in === undefined ? undefined : (val as any).in;
          const outVal = (val as any).out === null || (val as any).out === undefined ? undefined : (val as any).out;
          const explicitRemaining = (val as any).remaining === null || (val as any).remaining === undefined ? undefined : (val as any).remaining;
          if (explicitRemaining !== undefined) {
             currentRemaining[id] = explicitRemaining;
          } else {
             if (currentRemaining[id] !== undefined || inVal !== undefined || outVal !== undefined) {
               const prevRemaining = currentRemaining[id] || 0;
               const added = inVal || 0;
               const removed = outVal || 0;
               currentRemaining[id] = prevRemaining + added - removed;
             }
          }
        }
      });
    });

    const toBuy: (Ingredient & { currentStock: number; suggestedOrder: number })[] = [];
    departmentIngredients.forEach(item => {
      const currentStock = currentRemaining[item.id] !== undefined ? currentRemaining[item.id] : 0;
      // Must match home/dashboard and stock summary condition: remaining <= minStock
      if (currentStock <= item.minStock) {
        toBuy.push({
          ...item,
          currentStock,
          suggestedOrder: item.minOrder || (item.minStock - currentStock > 0 ? item.minStock - currentStock : item.minStock || 1),
        });
      }
    });

    return toBuy.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.supplier !== b.supplier) return (a.supplier || '').localeCompare(b.supplier || '');
      return a.name.localeCompare(b.name);
    });
  }, [ingredients, stockRecord, selectedDate, activeDepartment, allowedDepartments, branch]);

  const suppliers = useMemo(() => {
    const supplierSet = new Set<string>();
    allPurchasesToMake.forEach(item => {
      if (item.supplier) supplierSet.add(item.supplier);
    });
    return Array.from(supplierSet).sort();
  }, [allPurchasesToMake]);

  // Reset selectedSupplier if not in available suppliers
  useEffect(() => {
    if (selectedSupplier && !suppliers.includes(selectedSupplier)) {
      setSelectedSupplier(null);
    }
  }, [suppliers, selectedSupplier]);

  const purchasesToMake = useMemo(() => {
    if (!selectedSupplier) return allPurchasesToMake;
    return allPurchasesToMake.filter(item => item.supplier === selectedSupplier);
  }, [allPurchasesToMake, selectedSupplier]);

  const exportExcel = () => {
    const data = purchasesToMake.map(item => {
      const order = orders[item.id];
      const isOrdered = Boolean(order?.order_date) && Number(order?.order_qty) > 0;
      return {
        'หมวดหมู่': item.category,
        'รายการสินค้า': item.name,
        'ยี่ห้อ': item.brand || '-',
        'ผู้จัดจำหน่าย': item.supplier || '-',
        'ขนาด/หน่วย': item.sizePerUnit,
        'คงเหลือขั้นต่ำ': `${item.minStock} ${item.unit}`,
        'ยอดคงเหลือตรวจนับ': `${item.currentStock} ${item.unit}`,
        'ยอดสั่งซื้อแนะนำ': `${item.suggestedOrder} ${item.unit}`,
        'วันที่สั่งซื้อ': order?.order_date || '-',
        'จำนวนที่สั่ง': order?.order_qty ? `${order.order_qty} ${item.unit}` : '-',
        'ผู้สั่งซื้อ': order?.ordered_by ? `${order.ordered_by} (${formatOrderDateTime(order.ordered_at)})` : '-',
        'สถานะการสั่งซื้อ': isOrdered ? 'สั่งซื้อแล้ว' : 'ยังไม่สั่ง',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchasing List');
    XLSX.writeFile(wb, `Purchasing_${selectedDate}.xlsx`);
  };

  const printReport = async () => {
    const element = document.getElementById('purchasing-report-content');
    if (!element) return;

    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      const imgData = await toPng(element, {
        backgroundColor: '#FFFFFF',
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList?.contains('print:hidden')) {
            return false;
          }
          return true;
        }
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Purchasing_${selectedDate}.pdf`);
    } catch (error) {
      console.warn('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF โปรดลองอีกครั้ง');
    }
  };

  const groupedPurchases = useMemo(() => {
    const groups: Record<string, Record<string, typeof purchasesToMake>> = {};
    purchasesToMake.forEach(item => {
      const supKey = item.supplier || 'ไม่ระบุผู้จัดจำหน่าย';
      if (!groups[supKey]) {
        groups[supKey] = {};
      }
      if (!groups[supKey][item.category]) {
        groups[supKey][item.category] = [];
      }
      groups[supKey][item.category].push(item);
    });
    return groups;
  }, [purchasesToMake]);

  const selectedSupplierCount = useMemo(() => {
    if (!selectedSupplier) return allPurchasesToMake.length;
    return allPurchasesToMake.filter(i => i.supplier === selectedSupplier).length;
  }, [allPurchasesToMake, selectedSupplier]);

  return (
    <div className="flex flex-col h-full bg-[#F0F5F4] space-y-4 animate-in fade-in duration-300">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PAGE HEADER CARD (Matches DailyBakeryRecord Layout & Style)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-4 sm:p-5 shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
        
        {/* ROW 1: Title block (left) + Date Selector (right) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          
          {/* LEFT: Back Button + Title + Subtitle */}
          <div className="flex items-center gap-2.5">
            <button 
              onClick={handleBackClick}
              title="ย้อนกลับ"
              className="w-[30px] h-[30px] rounded-[8px] bg-white border border-[#D4E4E3] flex items-center justify-center text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <ChevronLeft size={15} strokeWidth={2} />
            </button>
            <div className="w-9 h-9 rounded-[10px] bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] border border-[#D4E4E3]/50 shadow-xs shrink-0 p-2">
              <ShoppingCart size={18} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center">
                <h1 className="text-[15px] font-[700] text-[#2D4A49] tracking-tight leading-tight">
                  สรุปยอดสั่งซื้อวัตถุดิบ (Purchasing)
                </h1>
                {branch && (
                  <span className="text-[10px] font-[600] text-[#5A8A88] bg-[#E8F3F2] px-[7px] py-[2px] rounded-[5px] border border-[#D4E4E3] ml-1.5 whitespace-nowrap">
                    สาขา {branch}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                อ้างอิงจากรายการตรวจนับสต็อกประจำวัน
              </p>
            </div>
          </div>

          {/* RIGHT: Date Selector */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
            <div className="flex items-center gap-1.5 bg-white px-2.5 h-[32px] rounded-[8px] border border-[#D4E4E3] shadow-2xs hover:bg-[#F0F5F4] transition-colors">
              <Calendar size={13} className="text-[#5A8A88] shrink-0" />
              <input 
                type="date" 
                className="bg-transparent border-none focus:outline-none text-[11px] font-medium text-[#2D4A49] cursor-pointer"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>
          </div>

        </div>

        {/* DIVIDER BETWEEN ROW 1 AND ROW 2 */}
        <div className="h-[1px] bg-[#F0F5F4] my-3 w-full" />

        {/* ROW 2: Department Tabs + Supplier Filter + Export Dropdown (ALL IN ONE ROW) */}
        <div className="flex items-center justify-between gap-2 w-full pt-0.5 flex-wrap">
          
          {/* LEFT: Department Tabs + Supplier Selector */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            
            {/* Department tabs */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-[#6B8F8E] whitespace-nowrap">แผนก:</span>
              <div className="flex items-center gap-0.5 sm:gap-1 bg-[#F0F5F4] p-0.5 rounded-[8px] border border-[#D4E4E3]">
                {(['All', 'Bar', 'Bakery'] as DepartmentFilter[])
                  .filter(dept => dept === 'All' ? allowedDepartments.length === 2 : allowedDepartments.includes(dept as any))
                  .map((dept) => {
                    const isActive = activeDepartment === dept;
                    const Icon = dept === 'All' ? LayoutGrid : dept === 'Bar' ? Coffee : ChefHat;
                    
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => setActiveDepartment(dept)}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[10px] sm:text-[11px] font-[600] transition-colors cursor-pointer",
                          isActive 
                            ? "bg-[#5A8A88] text-white shadow-xs" 
                            : "text-[#2D4A49] hover:bg-white"
                        )}
                      >
                        <Icon size={12} />
                        <span>{dept === 'All' ? 'ทั้งหมด' : dept === 'Bar' ? 'บาร์' : 'ครัว'}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Supplier dropdown */}
            {suppliers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#6B8F8E] whitespace-nowrap">ผู้จัดจำหน่าย:</span>
                <div className="relative" ref={supplierDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsSupplierDropdownOpen(prev => !prev)}
                    className={cn(
                      "flex items-center justify-between gap-1.5 bg-white border border-[#D4E4E3] rounded-[8px] px-2.5 py-[6px] h-[32px] text-[11px] text-[#2D4A49] min-w-[140px] max-w-[220px] cursor-pointer transition-colors shadow-2xs",
                      isSupplierDropdownOpen ? "border-[#5A8A88] bg-[#E8F3F2]" : "hover:bg-[#F0F5F4]"
                    )}
                    aria-haspopup="listbox"
                    aria-expanded={isSupplierDropdownOpen}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 size={12} className="text-[#5A8A88] shrink-0" />
                      <span className="truncate font-medium">
                        {selectedSupplier ? selectedSupplier : 'ทั้งหมด'} ({selectedSupplierCount})
                      </span>
                    </div>
                    <ChevronDown size={11} className={cn("text-[#5A8A88] transition-transform duration-150 shrink-0", isSupplierDropdownOpen && "rotate-180")} />
                  </button>

                  {/* Dropdown list */}
                  {isSupplierDropdownOpen && (
                    <div className="absolute left-0 top-[calc(100%+4px)] w-[240px] sm:w-[260px] bg-white border border-[#D4E4E3] rounded-xl shadow-lg max-h-[280px] overflow-y-auto z-50 p-1 animate-in fade-in zoom-in-95 duration-100 custom-scrollbar">
                      {/* Option: ทั้งหมด */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplier(null);
                          setIsSupplierDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[11px] transition-colors cursor-pointer text-left",
                          selectedSupplier === null
                            ? "bg-[#E8F3F2] text-[#5A8A88] font-semibold"
                            : "text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88]"
                        )}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <LayoutGrid size={12} className="text-[#5A8A88] shrink-0" />
                          <span className="truncate">ทั้งหมด</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="bg-[#E8F3F2] text-[#5A8A88] text-[9px] font-semibold rounded px-1.5 py-0.5">
                            ({allPurchasesToMake.length})
                          </span>
                          {selectedSupplier === null && (
                            <Check size={12} className="text-[#5A8A88]" />
                          )}
                        </div>
                      </button>

                      <div className="h-[1px] bg-[#F0F5F4] my-1" />

                      {/* Options: Suppliers */}
                      {suppliers.map(sup => {
                        const isSelected = selectedSupplier === sup;
                        const count = allPurchasesToMake.filter(i => i.supplier === sup).length;
                        
                        return (
                          <button
                            key={sup}
                            type="button"
                            onClick={() => {
                              setSelectedSupplier(sup);
                              setIsSupplierDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[11px] transition-colors cursor-pointer text-left",
                              isSelected
                                ? "bg-[#E8F3F2] text-[#5A8A88] font-semibold"
                                : "text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88]"
                            )}
                          >
                            <span className="truncate pr-2">{sup}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="bg-[#F0F5F4] text-[#6B8F8E] text-[9px] rounded px-1.5 py-0.5">
                                {count}
                              </span>
                              {isSelected && (
                                <Check size={12} className="text-[#5A8A88]" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT: Export Dropdown (Matches DailyBakeryRecord design and function) */}
          <div className="relative ml-auto shrink-0" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportOpen(!isExportOpen)}
              disabled={purchasesToMake.length === 0}
              className="flex items-center gap-1 bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] text-[#2D4A49] text-[11px] font-[500] rounded-[8px] px-2.5 py-[6px] h-[32px] transition-colors shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              title="ส่งออกข้อมูล (Excel, PDF)"
            >
              <Download size={13} className="text-[#5A8A88]" />
              <span>ส่งออก</span>
              <ChevronDown size={11} className={cn("text-[#5A8A88] transition-transform duration-150", isExportOpen && "rotate-180")} />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 mt-1.5 w-36 bg-white rounded-xl shadow-lg border border-[#D4E4E3] py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsExportOpen(false);
                    exportExcel();
                  }}
                  className="w-full px-3 py-2 text-left text-[11px] font-medium text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Download size={13} className="text-[#5A8A88]" />
                  <span>Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportOpen(false);
                    printReport();
                  }}
                  className="w-full px-3 py-2 text-left text-[11px] font-medium text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Printer size={13} className="text-[#5A8A88]" />
                  <span>PDF / พิมพ์</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          MAIN CONTENT AREA (Table & Groups)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex-1 overflow-auto custom-scrollbar" id="purchasing-report-content">
        <div className="space-y-4 sm:space-y-5">
          {/* Printable Header */}
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-xl font-black text-[#2D4A49]">สรุปยอดสั่งซื้อวัตถุดิบ (Purchasing Report)</h1>
            <p className="text-[#6B8F8E] text-xs mt-1">ประจำวันที่ {format(new Date(selectedDate), 'dd/MM/yyyy')}</p>
          </div>


          {/* Empty State */}
          {purchasesToMake.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] p-10 text-center">
              <div className="w-14 h-14 bg-[#E8F3F2] rounded-full flex items-center justify-center mx-auto mb-3 text-[#5A8A88]">
                <PackageCheck size={28} />
              </div>
              <p className="text-[14px] font-bold text-[#2D4A49]">ไม่มีรายการที่ต้องสั่งซื้อ</p>
              <p className="text-[11px] text-[#6B8F8E] mt-1 max-w-sm mx-auto">
                ยอดคงเหลือของทุกรายการอยู่ในเกณฑ์ปกติ หรือยังไม่มีการบันทึกตรวจนับสต็อกในวันที่เลือก
              </p>
            </div>
          ) : (
            // Grouped Purchase Tables by Supplier
            Object.entries(groupedPurchases).map(([supplier, categories]) => {
              const allSupplierItems = Object.values(categories).flat();
              const totalItems = allSupplierItems.length;
              const supState = supplierSaveState[supplier] || 'idle';
              
              return (
                <div 
                  key={supplier} 
                  className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] overflow-hidden"
                >
                  {/* Supplier Group Header */}
                  <div className="bg-[#F0F5F4] border-l-[3px] border-l-[#5A8A88] pl-3 pr-4 py-2.5 border-b border-[#D4E4E3] flex items-center justify-between">
                    <h4 className="font-bold text-[12px] sm:text-[13px] text-[#2D4A49] flex items-center gap-2">
                      <Building2 size={14} className="text-[#5A8A88]" />
                      <span>ผู้จัดจำหน่าย: {supplier}</span>
                    </h4>
                    
                    <div className="flex items-center gap-2">
                      {/* Save button per supplier (matches DailyBakeryRecord behavior) */}
                      <button
                        type="button"
                        onClick={() => handleSaveWithCheck(supplier, allSupplierItems)}
                        disabled={supState === 'idle' || supState === 'saving' || supState === 'saved'}
                        title={supState === 'dirty' ? "คลิกเพื่อบันทึกรายการของผู้จัดจำหน่ายนี้" : undefined}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1 rounded-[7px] text-[11px] transition-all duration-200 select-none",
                          supState === 'idle' && "bg-[#F0F5F4] border border-[#D4E4E3] text-[#A8BCBB] cursor-not-allowed opacity-80",
                          supState === 'dirty' && "bg-[#5A8A88] hover:bg-[#4A7A78] text-white font-[600] border-none shadow-xs cursor-pointer animate-pulse hover:animate-none hover:scale-[1.03] active:scale-[0.98]",
                          supState === 'saving' && "bg-[#5A8A88] text-white font-[600] opacity-80 cursor-wait border-none",
                          supState === 'saved' && "bg-[#22C55E] text-white font-[600] border-none shadow-xs"
                        )}
                        style={
                          supState === 'idle'
                            ? { backgroundColor: '#F0F5F4', border: '1px solid #D4E4E3', color: '#A8BCBB', borderRadius: '7px', padding: '5px 12px', fontSize: '11px', cursor: 'not-allowed' }
                            : supState === 'dirty'
                            ? { backgroundColor: '#5A8A88', color: '#FFFFFF', borderRadius: '7px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none' }
                            : supState === 'saving'
                            ? { backgroundColor: '#5A8A88', color: '#FFFFFF', borderRadius: '7px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, opacity: 0.8, cursor: 'wait', border: 'none' }
                            : { backgroundColor: '#22C55E', color: '#FFFFFF', borderRadius: '7px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, border: 'none' }
                        }
                      >
                        {supState === 'saving' ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-white" />
                            <span>กำลังบันทึก...</span>
                          </>
                        ) : supState === 'saved' ? (
                          <>
                            <Check size={12} className="text-white" />
                            <span>บันทึกแล้ว!</span>
                          </>
                        ) : (
                          <>
                            <Save size={12} className={supState === 'dirty' ? "text-white" : "text-[#A8BCBB]"} />
                            <span>บันทึก</span>
                          </>
                        )}
                      </button>

                      {allSupplierItems.filter(item => isPendingDelivery(item.id)).length > 0 && (
                        <span 
                          style={{
                            background: '#FEF3C7',
                            color: '#92400E',
                            border: '1px solid #FDE68A',
                            fontSize: '10px',
                            fontWeight: 600,
                            borderRadius: '5px',
                            padding: '3px 8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Truck size={10} style={{ color: '#D97706' }} />
                          {allSupplierItems.filter(item => isPendingDelivery(item.id)).length} รอส่งมอบ
                        </span>
                      )}

                      <span className="bg-[#E8F3F2] text-[#5A8A88] text-[10px] font-semibold px-2 py-0.5 rounded-[5px] border border-[#D4E4E3]">
                        {totalItems} รายการ
                      </span>
                    </div>
                  </div>

                  {/* Table without Horizontal Scroll */}
                  <div className="overflow-x-hidden overflow-y-visible w-full">
                    <table className="w-full text-left border-collapse table-fixed" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <colgroup>
                        <col style={{ width: '36px' }} />
                        <col style={{ width: '154px' }} />
                        <col style={{ width: '68px' }} />
                        <col style={{ width: '74px' }} />
                        <col style={{ width: '66px' }} />
                        <col style={{ width: '70px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '68px' }} />
                        <col style={{ width: '96px' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-[#2D4A49] text-white text-[9.5px] font-semibold border-b border-[#2D4A49] leading-tight">
                          <th className="p-1 text-center w-[36px] border-r border-[#3d605f] whitespace-nowrap">รูป</th>
                          <th className="py-2 px-2 text-left w-[154px] border-r border-[#3d605f] whitespace-nowrap">รายการสินค้า</th>
                          <th className="py-2 px-1 text-left w-[68px] border-r border-[#3d605f] whitespace-nowrap">ขนาด/หน่วย</th>
                          <th className="py-2 px-1 text-center w-[74px] border-r border-[#3d605f] whitespace-nowrap">คงเหลือขั้นต่ำ</th>
                          <th className="py-2 px-1 text-center w-[66px] border-r border-[#3d605f] whitespace-nowrap">ยอดตรวจนับ</th>
                          <th className="py-2 px-1 text-center w-[70px] border-r border-[#3d605f] whitespace-nowrap">ยอดสั่งแนะนำ</th>
                          <th className="py-2 px-1 text-center w-[100px] border-r border-[#3d605f] whitespace-nowrap">วันที่สั่งซื้อ</th>
                          <th className="py-2 px-1 text-center w-[68px] border-r border-[#3d605f] whitespace-nowrap">จำนวนที่สั่ง</th>
                          <th className="py-2 px-1.5 text-left w-[96px] whitespace-nowrap">ผู้สั่งซื้อ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(categories).map(([category, items]) => (
                          <React.Fragment key={category}>
                            {/* Category Row */}
                            <tr className="bg-[#F8FAFA] border-y border-[#F0F5F4]">
                              <td colSpan={9} className="px-2.5 py-1">
                                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-[#5A8A88]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88] shrink-0"></span>
                                  <span>{category}</span>
                                </div>
                              </td>
                            </tr>
                            {/* Items */}
                            {items.map((item, index) => {
                              const isLow = item.currentStock < item.minStock;
                              const isEven = index % 2 === 1;
                              const isPending = isPendingDelivery(item.id);
                              const pendingInfo = pendingOrderMap[item.id];
                              const order = orders[item.id];
                              const orderDate = isPending ? (pendingInfo?.order_date || '') : (order?.order_date || '');
                              const orderQty = isPending ? (pendingInfo?.order_qty ?? '') : (order?.order_qty !== undefined ? order.order_qty : '');
                              const isOrdered = Boolean(orderDate) && Number(orderQty) > 0;
                              const isChanged = changedItems.has(item.id);

                              const pendingTooltip = isPending
                                ? `รายการนี้สั่งซื้อแล้ว เมื่อ ${formatDisplayDate(pendingInfo?.order_date) || pendingInfo?.order_date}\nจำนวน ${pendingInfo?.order_qty} ${pendingInfo?.order_unit || item.unit}\nอยู่ระหว่างรอรับสินค้า ไม่สามารถสั่งซ้ำได้`
                                : undefined;

                              return (
                                <tr 
                                  key={item.id} 
                                  className={cn(
                                    "relative transition-colors border-b border-[#F0F5F4] text-[9.5px] font-normal",
                                    isPending
                                      ? "bg-[#FFF7ED] border-l-[3px] border-l-[#F59E0B] hover:bg-[#FEF3C7]"
                                      : isChanged
                                        ? "bg-[#FFFBEB]/80 border-l-[3px] border-l-[#F59E0B] hover:bg-[#FFFBEB]"
                                        : isOrdered 
                                          ? "bg-[#E8F3F2] border-l-[3px] border-l-[#5A8A88] hover:bg-[#DDF0EE]"
                                          : isEven 
                                            ? "bg-[#F8FAFA] hover:bg-[#E8F3F2]/60" 
                                            : "bg-[#FFFFFF] hover:bg-[#E8F3F2]/60"
                                  )}
                                >
                                  {/* Item Image */}
                                  <td className="relative p-1 border-r border-[#F0F5F4] text-center w-[36px]" style={{ width: '36px' }}>
                                    {isChanged && (
                                      <span 
                                        className="absolute top-[3px] right-[2px] w-[6px] h-[6px] bg-[#F59E0B] rounded-full border-[1px] border-white z-10 pointer-events-none" 
                                        title="มีการแก้ไข"
                                      />
                                    )}
                                    {item.image ? (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewImage({ 
                                          url: item.image!, 
                                          title: item.name, 
                                          brand: item.brand,
                                          category: item.category,
                                          unit: item.unit
                                        })}
                                        className="group relative inline-flex items-center justify-center rounded border border-[#D4E4E3] overflow-hidden hover:border-[#5A8A88] transition-all cursor-pointer shadow-2xs hover:shadow-xs hover:scale-105 bg-white p-0.5"
                                        title="คลิกเพื่อดูรูปภาพขนาดใหญ่"
                                      >
                                        <img 
                                          src={item.image} 
                                          alt={item.name} 
                                          className="w-6 h-6 object-cover rounded-[2px] mx-auto" 
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center rounded-[2px]">
                                          <Eye size={10} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-xs" />
                                        </div>
                                      </button>
                                    ) : (
                                      <div className="w-6 h-6 rounded border border-[#D4E4E3] bg-[#F8FAFA] flex items-center justify-center mx-auto text-[#6B8F8E]">
                                        <ShoppingCart size={11} />
                                      </div>
                                    )}
                                  </td>

                                  {/* Item Name & Subtitle */}
                                  <td className="px-2 py-1.5 border-r border-[#F0F5F4] w-[154px] max-w-[154px]" style={{ width: '154px', maxWidth: '154px' }}>
                                    <div 
                                      className="font-[600] text-[#2D4A49] text-[10px] leading-tight truncate overflow-hidden whitespace-nowrap" 
                                      title={item.name}
                                    >
                                      {item.name}
                                    </div>
                                    {item.brand && (
                                      <div 
                                        className="text-[9px] font-normal text-[#6B8F8E] mt-0.5 truncate overflow-hidden whitespace-nowrap"
                                        title={`ยี่ห้อ: ${item.brand}`}
                                      >
                                        ยี่ห้อ: {item.brand}
                                      </div>
                                    )}
                                    {isPending && (
                                      <div>
                                        <span style={{
                                          display       : 'inline-flex',
                                          alignItems    : 'center',
                                          gap           : '4px',
                                          background    : '#FEF3C7',
                                          color         : '#92400E',
                                          border        : '1px solid #FDE68A',
                                          fontSize      : '9px',
                                          fontWeight    : 600,
                                          borderRadius  : '4px',
                                          padding       : '2px 6px',
                                          marginTop     : '3px',
                                          whiteSpace    : 'nowrap',
                                        }}>
                                          <Truck size={9} style={{ color: '#D97706' }} />
                                          รอส่งมอบ
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Size / Unit */}
                                  <td 
                                    className="px-1.5 py-1.5 border-r border-[#F0F5F4] text-[9.5px] font-normal text-[#6B8F8E] w-[68px] max-w-[68px] truncate overflow-hidden whitespace-nowrap"
                                    title={item.sizePerUnit || '-'}
                                    style={{ width: '68px', maxWidth: '68px' }}
                                  >
                                    {item.sizePerUnit || '-'}
                                  </td>

                                  {/* Min Stock (คงเหลือขั้นต่ำ) */}
                                  <td className="px-1 py-1.5 border-r border-[#F0F5F4] text-center w-[74px] max-w-[74px]" style={{ width: '74px', maxWidth: '74px' }}>
                                    {isLow ? (
                                      <span className="inline-block px-1 py-0.5 rounded bg-[#FEE2E2] text-[#EF4444] font-semibold text-[9.5px] font-mono leading-tight whitespace-nowrap">
                                        {item.minStock} {item.unit}
                                      </span>
                                    ) : (
                                      <span className="text-[#2D4A49] font-mono text-[9.5px] font-normal leading-tight whitespace-nowrap">
                                        {item.minStock} {item.unit}
                                      </span>
                                    )}
                                  </td>

                                  {/* Current Stock (ยอดตรวจนับ) */}
                                  <td className="px-1 py-1.5 border-r border-[#F0F5F4] font-mono text-[9.5px] font-normal text-center text-[#6B8F8E] w-[66px] max-w-[66px] whitespace-nowrap" style={{ width: '66px', maxWidth: '66px' }}>
                                    {item.currentStock} {item.unit}
                                  </td>

                                  {/* Suggested Order (ยอดสั่งแนะนำ) */}
                                  <td className="px-1 py-1.5 font-mono text-[9.5px] text-center w-[70px] max-w-[70px] border-r border-[#F0F5F4]" style={{ width: '70px', maxWidth: '70px' }}>
                                    <span className={cn(
                                      "inline-block px-1.5 py-0.5 rounded-[3px] text-[9.5px] leading-tight whitespace-nowrap",
                                      isOrdered 
                                        ? "bg-white text-[#5A8A88] font-[700] border border-[#5A8A88]/30 shadow-2xs" 
                                        : "bg-[#E8F3F2] text-[#5A8A88] font-bold"
                                    )}>
                                      {item.suggestedOrder} {item.unit}
                                    </span>
                                  </td>

                                  {/* COLUMN 1 — วันที่สั่งซื้อ */}
                                  <td className="px-0.5 py-1 text-center w-[100px] max-w-[100px] border-r border-[#F0F5F4]" style={{ width: '100px', maxWidth: '100px' }}>
                                    {isPending ? (
                                      <div className="flex items-center justify-center mx-auto" title={pendingTooltip}>
                                        <span 
                                          style={{
                                            background: '#FEF3C7',
                                            color: '#92400E',
                                            border: '1px solid #FDE68A',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            borderRadius: '5px',
                                            padding: '3px 7px',
                                            display: 'inline-block',
                                            whiteSpace: 'nowrap',
                                            cursor: 'not-allowed',
                                          }}
                                        >
                                          {formatDisplayDate(pendingInfo?.order_date) || pendingInfo?.order_date || 'รอส่งมอบ'}
                                        </span>
                                      </div>
                                    ) : (
                                      <input 
                                        type="date"
                                        value={orderDate}
                                        placeholder="เลือกวันที่"
                                        onChange={(e) => handleOrderFieldChange(item.id, 'order_date', e.target.value, item.unit, supplier)}
                                        className="bg-[#FFFFFF] border border-[#D4E4E3] rounded-[4px] px-1 py-0.5 h-[26px] w-full max-w-[94px] text-[9.5px] placeholder:text-[9px] text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] transition-colors cursor-pointer text-center mx-auto block"
                                      />
                                    )}
                                  </td>

                                  {/* COLUMN 2 — จำนวนที่สั่ง */}
                                  <td className="px-0.5 py-1 text-center w-[68px] max-w-[68px] border-r border-[#F0F5F4]" style={{ width: '68px', maxWidth: '68px' }}>
                                    {isPending ? (
                                      <div className="flex items-center justify-center gap-0.5 w-full" title={pendingTooltip}>
                                        <span
                                          style={{
                                            background: '#FEF3C7',
                                            color: '#92400E',
                                            border: '1px solid #FDE68A',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            borderRadius: '5px',
                                            padding: '3px 6px',
                                            display: 'inline-block',
                                            whiteSpace: 'nowrap',
                                            cursor: 'not-allowed',
                                          }}
                                        >
                                          {pendingInfo?.order_qty} {pendingInfo?.order_unit || item.unit}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center gap-0.5 w-full">
                                        <input 
                                          type="number"
                                          min={0}
                                          value={orderQty === 0 && !orderDate ? '' : orderQty}
                                          placeholder="0"
                                          onChange={(e) => handleOrderFieldChange(item.id, 'order_qty', e.target.value === '' ? '' : Number(e.target.value), item.unit, supplier)}
                                          className="bg-[#FFFFFF] border border-[#D4E4E3] rounded-[4px] px-1 py-0.5 h-[26px] w-[40px] text-[9.5px] placeholder:text-[9px] text-[#2D4A49] text-center focus:outline-none focus:border-[#5A8A88] transition-colors"
                                        />
                                        <span className="text-[9px] text-[#6B8F8E] whitespace-nowrap truncate max-w-[22px]" title={item.unit}>
                                          {item.unit}
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* COLUMN 3 — ผู้สั่งซื้อ */}
                                  <td className="px-1.5 py-1 text-left w-[96px] max-w-[96px]" style={{ width: '96px', maxWidth: '96px' }}>
                                    {isPending ? (
                                      <div className="flex flex-col items-start justify-center gap-0.5 w-full overflow-hidden" title={pendingTooltip}>
                                        <span className="text-[10px] font-bold text-[#92400E] leading-tight truncate w-full" title={pendingInfo?.ordered_by}>
                                          {pendingInfo?.ordered_by || '—'}
                                        </span>
                                        {pendingInfo?.ordered_at && (
                                          <span className="text-[9px] text-[#D97706] leading-tight truncate w-full" title={formatOrderDateTime(pendingInfo.ordered_at)}>
                                            {formatOrderDateTime(pendingInfo.ordered_at)}
                                          </span>
                                        )}
                                        <span 
                                          style={{
                                            background: '#FEF3C7',
                                            color: '#92400E',
                                            border: '1px solid #FDE68A',
                                            fontSize: '9px',
                                            fontWeight: 600,
                                            borderRadius: '3px',
                                            padding: '2px 5px',
                                            marginTop: '2px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          <Truck size={8} style={{ color: '#D97706' }} />
                                          รอรับสินค้า
                                        </span>
                                      </div>
                                    ) : order?.ordered_by ? (
                                      <div className="flex flex-col items-start justify-center gap-0.5 w-full overflow-hidden">
                                        <span className="text-[10px] font-bold text-[#2D4A49] leading-tight truncate w-full" title={order.ordered_by}>
                                          {order.ordered_by}
                                        </span>
                                        {order.ordered_at && (
                                          <span className="text-[9px] text-[#6B8F8E] leading-tight truncate w-full" title={formatOrderDateTime(order.ordered_at)}>
                                            {formatOrderDateTime(order.ordered_at)}
                                          </span>
                                        )}
                                        {isOrdered && (
                                          <span className="mt-0.5 inline-block bg-[#22C55E] text-white text-[9px] font-semibold rounded-[3px] px-1 py-0.5 leading-none shadow-2xs whitespace-nowrap">
                                            ✓ สั่งซื้อแล้ว
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[#94A3B8] text-[9.5px] font-medium">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}

          {/* Summary Footer Card */}
          {purchasesToMake.length > 0 && (
            <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] p-4 sm:p-5 print:hidden">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-[13px] font-bold text-[#2D4A49]">สรุปภาพรวมการสั่งซื้อ</h4>
                  <p className="text-[11px] text-[#6B8F8E] mt-0.5">ประจำวันที่ {format(new Date(selectedDate), 'dd/MM/yyyy')}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center sm:text-right">
                    <div className="text-[10px] font-bold text-[#6B8F8E] uppercase">จำนวนรายการทั้งหมด</div>
                    <div className="text-[18px] font-black text-[#5A8A88]">{purchasesToMake.length} รายการ</div>
                  </div>
                  <div className="w-[1px] h-7 bg-[#D4E4E3]" />
                  <div className="text-center sm:text-right">
                    <div className="text-[10px] font-bold text-[#6B8F8E] uppercase">ผู้จัดจำหน่าย</div>
                    <div className="text-[18px] font-black text-[#2D4A49]">{Object.keys(groupedPurchases).length} ราย</div>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Success Toast (Always Centered) */}
          {saveSuccessMsg && (
            <div 
              className="fixed bottom-[72px] sm:bottom-[76px] left-1/2 -translate-x-1/2 z-50 bg-[#ECFDF5] border border-[#A7F3D0] rounded-[12px] px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.15)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 print:hidden w-[calc(100%-32px)] sm:w-auto max-w-md"
              style={{
                position: 'fixed',
                bottom: '76px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 90,
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
              }}
            >
              <div className="flex items-center gap-2 text-[#065F46] text-[11px] sm:text-[12px] font-semibold whitespace-nowrap">
                <Check size={15} className="text-[#059669] shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            </div>
          )}
        </div>
      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#D4E4E3] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFA] border-b border-[#D4E4E3]">
              <div className="min-w-0 pr-3">
                <h3 className="text-[13px] font-bold text-[#2D4A49] truncate" title={previewImage.title}>
                  {previewImage.title}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#6B8F8E] flex-wrap">
                  {previewImage.brand && <span>ยี่ห้อ: {previewImage.brand}</span>}
                  {previewImage.brand && previewImage.category && <span>•</span>}
                  {previewImage.category && <span>หมวด: {previewImage.category}</span>}
                  {previewImage.unit && <span>• หน่วย: {previewImage.unit}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-7 h-7 rounded-full bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] transition-colors shrink-0 shadow-2xs cursor-pointer"
                title="ปิด"
              >
                <X size={15} />
              </button>
            </div>

            {/* Image Body */}
            <div className="p-4 bg-white flex items-center justify-center max-h-[70vh] min-h-[220px] overflow-hidden">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-w-full max-h-[65vh] object-contain rounded-lg border border-[#F0F5F4]"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-[#F8FAFA] border-t border-[#F0F5F4] flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="px-3.5 py-1.5 text-[11px] font-medium text-[#2D4A49] hover:bg-[#E8F3F2] rounded-lg border border-[#D4E4E3] transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Leave Warning Modal */}
      {showLeaveWarning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 250,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '28px 24px',
            maxWidth: '380px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>

            {/* Icon */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#FEF3C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <AlertTriangle
                size={26}
                style={{ color: '#F59E0B' }}
              />
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#2D4A49',
              textAlign: 'center',
              margin: '0 0 8px',
            }}>
              มีข้อมูลที่ยังไม่ได้บันทึก
            </h3>

            {/* Body */}
            <p style={{
              fontSize: '12px',
              color: '#6B8F8E',
              textAlign: 'center',
              lineHeight: 1.5,
              margin: '0 0 12px',
            }}>
              ผู้จัดจำหน่ายต่อไปนี้มีข้อมูลที่
              ยังไม่ได้บันทึก:
            </p>

            {/* Dirty supplier list */}
            <div style={{
              background: '#FEF3C7',
              border: '1px solid #FDE68A',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '20px',
            }}>
              {dirtySupplierNames.map(name => (
                <div key={name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#92400E',
                  padding: '2px 0',
                }}>
                  <span style={{ color: '#F59E0B' }}>
                    ●
                  </span>
                  {name}
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div style={{
              display: 'flex',
              gap: '8px',
            }}>

              {/* Leave without saving */}
              <button
                onClick={() => {
                  setShowLeaveWarning(false);
                  if (pendingNavigation) {
                    if (onNavigate) {
                      onNavigate(pendingNavigation);
                    } else {
                      onBack();
                    }
                    setPendingNavigation(null);
                  } else {
                    onBack();
                  }
                }}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '10px',
                  border: '1px solid #FCA5A5',
                  background: '#FEE2E2',
                  color: '#EF4444',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                ออกโดยไม่บันทึก
              </button>

              {/* Stay on page */}
              <button
                onClick={() => {
                  setShowLeaveWarning(false);
                  setPendingNavigation(null);
                }}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '10px',
                  border: '1px solid #D4E4E3',
                  background: '#F0F5F4',
                  color: '#6B8F8E',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                ยังอยู่หน้านี้
              </button>

            </div>

          </div>
        </div>
      )}

      {/* Reorder Warning Confirmation Modal */}
      {reorderWarning.show && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              padding: "24px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              border: "1px solid #FED7AA",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "#FEF3C7",
                  border: "1px solid #FCD34D",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} style={{ color: "#D97706" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#92400E", margin: 0 }}>
                  แจ้งเตือน: มีรายการรอส่งมอบอยู่แล้ว
                </h3>
                <p style={{ fontSize: "11px", color: "#B45309", margin: 0, marginTop: "2px" }}>
                  พบรายการที่เคยสั่งซื้อไปแล้วและยังไม่ได้รับสินค้า
                </p>
              </div>
            </div>

            {/* List of conflicting items */}
            <div
              style={{
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "18px",
                maxHeight: "200px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {reorderWarning.items.map((item, idx) => (
                <div
                  key={item.ingredientId || idx}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #FCD34D",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#1F2937", marginBottom: "4px" }}>
                    {item.name} {item.brand ? `(${item.brand})` : ""}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6B7280", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div>
                      📅 สั่งซื้อเมื่อ: <span style={{ fontWeight: 600, color: "#B45309" }}>{item.existingDate}</span>
                    </div>
                    <div>
                      📦 จำนวนรอส่งเดิม: <span style={{ fontWeight: 600, color: "#B45309" }}>{item.existingQty} {item.unit}</span>
                      {item.newQty > 0 && (
                        <span> → ยอดสั่งใหม่: <span style={{ fontWeight: 600, color: "#059669" }}>{item.newQty} {item.unit}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: "12px", color: "#4B5563", marginBottom: "18px", lineHeight: 1.5 }}>
              ต้องการสั่งซ้ำเพื่อแทนที่คำสั่งซื้อเดิม หรือยกเลิกเพื่อไม่ให้เกิดการสั่งซื้อซ้ำซ้อน?
            </p>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={handleCancelReorder}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #D1D5DB",
                  background: "#F3F4F6",
                  color: "#374151",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ยกเลิก (ไม่สั่งซ้ำ)
              </button>
              <button
                type="button"
                onClick={() => {
                  const { supplierId, supplierItems } = reorderWarning;
                  setReorderWarning(prev => ({ ...prev, show: false, items: [] }));
                  handleSaveSupplier(supplierId, supplierItems);
                }}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#D97706",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(217, 119, 6, 0.25)",
                }}
              >
                ยืนยัน (อัปเดตคำสั่งซื้อ)
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

export default PurchasingReport;
