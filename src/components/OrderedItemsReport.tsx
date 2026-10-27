import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  ChevronLeft, 
  Calendar, 
  Download, 
  Printer, 
  PackageCheck, 
  Coffee, 
  ChefHat, 
  LayoutGrid, 
  Building2, 
  ChevronDown, 
  Check, 
  X, 
  Eye, 
  ShoppingCart,
  Loader2,
  Search,
  Pencil,
  Trash2
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
  ingredients?: any;
}

export interface OrderedItemsReportProps {
  user?: { name: string; role?: string; branch?: string } | null;
  branch?: string;
  onNavigate?: (tab: string) => void;
  onBack?: () => void;
  ingredients?: Ingredient[];
  stockRecord?: Record<string, Record<string, number | { in?: number; out?: number; remaining?: number; waste?: number; usageInfo?: string }>>;
  allowedDepartments?: ('Bar' | 'Bakery')[];
}

type DepartmentFilter = 'All' | 'Bar' | 'Bakery';
export type DateRangeMode = '7days' | '30days' | 'custom';

export const OrderedItemsReport: React.FC<OrderedItemsReportProps> = ({
  user,
  branch,
  onNavigate,
  onBack,
  ingredients = [],
  stockRecord = {},
  allowedDepartments = ['Bar', 'Bakery'],
}) => {
  const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('7days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const initialDept = allowedDepartments.length === 2 ? 'All' : allowedDepartments[0] || 'All';
  const [activeDepartment, setActiveDepartment] = useState<DepartmentFilter>(initialDept);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Action states: Edit and Delete
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [editForm, setEditForm] = useState({
    order_date: "",
    order_qty: 0,
    order_unit: "",
  });
  const [deletingOrder, setDeletingOrder] = useState<OrderRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const openEditModal = (order: OrderRecord, item?: any) => {
    setEditingOrder({
      ...order,
      order_unit: order.order_unit || item?.unit || "",
      ingredients: order.ingredients || { name: item?.name, brand: item?.brand, unit: item?.unit }
    });
    setEditForm({
      order_date: order.order_date || "",
      order_qty: order.order_qty || 0,
      order_unit: order.order_unit || item?.unit || "",
    });
  };

  const openDeleteConfirm = (order: OrderRecord, item?: any) => {
    setDeletingOrder({
      ...order,
      ingredients: order.ingredients || { name: item?.name, brand: item?.brand, unit: item?.unit }
    });
  };

  const handleEditSave = async () => {
    if (!editingOrder) return;
    setIsSaving(true);
    try {
      const currentBranch = branch || editingOrder.branch || "Rayong";
      const nowIso = new Date().toISOString();

      if (supabase && editingOrder.id) {
        const { error } = await supabase
          .from("purchasing_orders")
          .update({
            order_date: editForm.order_date,
            order_qty: editForm.order_qty,
            ordered_at: nowIso,
          })
          .eq("id", editingOrder.id);

        if (error) throw error;
      }

      // Sync to localStorage
      try {
        const raw = localStorage.getItem("cafe_purchasing_orders");
        if (raw) {
          const list: OrderRecord[] = JSON.parse(raw);
          const updated = list.map(o => {
            if (
              (editingOrder.id && o.id === editingOrder.id) ||
              (o.ingredient_id === editingOrder.ingredient_id && (!o.branch || o.branch === currentBranch))
            ) {
              return {
                ...o,
                order_date: editForm.order_date,
                order_qty: editForm.order_qty,
                ordered_at: nowIso,
              };
            }
            return o;
          });
          localStorage.setItem("cafe_purchasing_orders", JSON.stringify(updated));
        }
      } catch (localErr) {
        console.warn("Error updating local storage order:", localErr);
      }

      await fetchOrderedItems();
      setEditingOrder(null);
      showToast("✅ แก้ไขคำสั่งซื้อสำเร็จ");

    } catch (err: any) {
      showToast(`❌ เกิดข้อผิดพลาด: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingOrder) return;
    setIsSaving(true);
    try {
      const currentBranch = branch || deletingOrder.branch || "Rayong";

      if (supabase) {
        let query = supabase.from("purchasing_orders").delete();
        if (deletingOrder.id) {
          query = query.eq("id", deletingOrder.id);
        } else {
          query = query
            .eq("ingredient_id", deletingOrder.ingredient_id)
            .eq("branch", currentBranch)
            .is("delivered_at", null);
        }
        const { error } = await query;
        if (error) throw error;
      }

      // Sync to localStorage
      try {
        const raw = localStorage.getItem("cafe_purchasing_orders");
        if (raw) {
          const list: OrderRecord[] = JSON.parse(raw);
          const filtered = list.filter(o => {
            if (deletingOrder.id && o.id === deletingOrder.id) return false;
            if (o.ingredient_id === deletingOrder.ingredient_id && (!o.branch || o.branch === currentBranch)) return false;
            return true;
          });
          localStorage.setItem("cafe_purchasing_orders", JSON.stringify(filtered));
        }
      } catch (localErr) {
        console.warn("Error deleting local storage order:", localErr);
      }

      await fetchOrderedItems();
      setDeletingOrder(null);
      showToast("🗑️ ลบคำสั่งซื้อสำเร็จ");

    } catch (err: any) {
      showToast(`❌ เกิดข้อผิดพลาด: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };
  const [ordersMap, setOrdersMap] = useState<Record<string, OrderRecord>>({});

  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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

  // Format datetime: DD/MM HH:MM น.
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

  // Format Thai date for Date object: e.g. "21 ต.ค. 2026"
  const formatDateThai = (d: Date) => {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Format Thai date for read-only order date: e.g. "21 ต.ค. 2026"
  const formatThaiDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const monthName = months[monthNum - 1] || parts[1];
        return `${day} ${monthName} ${year}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  // Function to calculate start and end of date range
  const getDateRange = useCallback(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (dateRangeMode === '7days') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6); // includes today = 7 days
      start.setHours(0, 0, 0, 0);
      return { start, end: today };
    }

    if (dateRangeMode === '30days') {
      const start = new Date(today);
      start.setDate(today.getDate() - 29); // includes today = 30 days
      start.setHours(0, 0, 0, 0);
      return { start, end: today };
    }

    if (dateRangeMode === 'custom') {
      const start = customStartDate 
        ? new Date(customStartDate + 'T00:00:00') 
        : new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      const end = customEndDate 
        ? new Date(customEndDate + 'T23:59:59') 
        : today;
      return { start, end };
    }

    return { start: today, end: today };
  }, [dateRangeMode, customStartDate, customEndDate]);

  const { start: rangeStart, end: rangeEnd } = getDateRange();
  const startDateTH = formatDateThai(rangeStart);
  const endDateTH = formatDateThai(rangeEnd);

  // Dynamic description for subtitle
  const rangeDescription = useMemo(() => {
    if (dateRangeMode === '7days') return '7 วันย้อนหลัง';
    if (dateRangeMode === '30days') return '30 วันย้อนหลัง';
    return `${formatDateThai(rangeStart)} – ${formatDateThai(rangeEnd)}`;
  }, [dateRangeMode, rangeStart, rangeEnd]);

// Helper function to deduplicate orders by ingredient_id, keeping the latest record
const deduplicateOrders = (orders: OrderRecord[]): OrderRecord[] => {
  const seen = new Map<string, OrderRecord>();
  orders.forEach(order => {
    const key = order.ingredient_id;
    if (!key) return;
    const existing = seen.get(key);
    const orderTime = new Date(order.ordered_at || order.order_date || order.created_at || 0).getTime();
    const existingTime = existing ? new Date(existing.ordered_at || existing.order_date || existing.created_at || 0).getTime() : 0;
    if (!existing || orderTime > existingTime) {
      seen.set(key, order);
    }
  });
  return Array.from(seen.values());
};

  // Load ordered items from localStorage and Supabase within the date range
  const fetchOrderedItems = useCallback(async () => {
    const currentBranch = branch || 'Rayong';
    setIsLoading(true);

    const { start, end } = getDateRange();
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const isDateInRange = (dateVal?: string) => {
      if (!dateVal) return false;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        return dateVal >= startStr && dateVal <= endStr;
      }
      try {
        const t = new Date(dateVal).getTime();
        return !isNaN(t) && t >= start.getTime() && t <= end.getTime();
      } catch {
        return false;
      }
    };

    const localList: OrderRecord[] = [];

    // 1. Read from localStorage for immediate responsiveness and offline support
    try {
      const raw = localStorage.getItem('cafe_purchasing_orders');
      if (raw) {
        const list: OrderRecord[] = JSON.parse(raw);
        list
          .filter(item => 
            (!item.branch || item.branch === currentBranch) &&
            Boolean(item.order_date) &&
            Number(item.order_qty) > 0 &&
            (isDateInRange(item.order_date) || isDateInRange(item.ordered_at) || isDateInRange(item.stock_date))
          )
          .forEach(item => {
            localList.push(item);
          });
      }
    } catch (e) {
      console.warn('Error reading local purchasing orders:', e);
    }

    const dedupedLocal = deduplicateOrders(localList);
    const localMap: Record<string, OrderRecord> = {};
    dedupedLocal.forEach(item => {
      localMap[item.ingredient_id] = item;
    });
    setOrdersMap(localMap);

    // 2. Fetch from Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('purchasing_orders')
          .select('*')
          .eq('branch', currentBranch)
          .not('order_date', 'is', null)
          .gt('order_qty', 0)
          .gte('order_date', startStr)
          .lte('order_date', endStr);

        if (!error && data) {
          const dedupedItems = deduplicateOrders(data);
          console.log('Raw ordered items:', data?.length);
          console.log('After dedup:', dedupedItems.length);
          console.log('Duplicates found:', (data?.length || 0) - dedupedItems.length);

          const finalMap: Record<string, OrderRecord> = {};
          dedupedItems.forEach((item: OrderRecord) => {
            finalMap[item.ingredient_id] = item;
          });
          setOrdersMap(finalMap);
        } else if (error) {
          console.warn('Supabase order_date query error, fallback to ordered_at range:', error);
          const { data: altData } = await supabase
            .from('purchasing_orders')
            .select('*')
            .eq('branch', currentBranch)
            .not('order_date', 'is', null)
            .gt('order_qty', 0)
            .gte('ordered_at', startISO)
            .lte('ordered_at', endISO);

          if (altData) {
            const dedupedItems = deduplicateOrders(altData);
            console.log('Raw ordered items:', altData?.length);
            console.log('After dedup:', dedupedItems.length);
            console.log('Duplicates found:', (altData?.length || 0) - dedupedItems.length);

            const finalMap: Record<string, OrderRecord> = {};
            dedupedItems.forEach((item: OrderRecord) => {
              finalMap[item.ingredient_id] = item;
            });
            setOrdersMap(finalMap);
          }
        }
      } catch (supErr) {
        console.warn('Supabase fetch error:', supErr);
      }
    }

    setIsLoading(false);
  }, [branch, getDateRange]);

  // Auto-fetch on branch change or dateRangeMode change (for 7days and 30days)
  useEffect(() => {
    if (dateRangeMode !== 'custom') {
      fetchOrderedItems();
    }
  }, [branch, dateRangeMode, fetchOrderedItems]);

  // Build ordered items list with merged ingredient details
  const orderedItemList = useMemo(() => {
    const currentBranch = branch || 'Rayong';
    const branchIngredients = currentBranch 
      ? ingredients.filter(ing => !ing.branch || ing.branch === currentBranch)
      : ingredients;

    const allowedIngs = branchIngredients.filter(ing => allowedDepartments.includes(ing.department as any));
    const departmentIngredients = activeDepartment === 'All' 
      ? allowedIngs 
      : allowedIngs.filter(ing => ing.department === activeDepartment);

    // Calculate current stock from stockRecord up to rangeEnd date
    const endStr = format(rangeEnd, 'yyyy-MM-dd');
    const sortedDatesAsc = Object.keys(stockRecord).sort();
    const currentRemaining: Record<string, number> = {};
    sortedDatesAsc.forEach(dateKey => {
      if (dateKey > endStr) return;
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

    // Match order records to ingredients
    const list: (Ingredient & { currentStock: number; suggestedOrder: number; order: OrderRecord })[] = [];
    const seenIngredients = new Set<string>();

    // Loop over orderMap entries that have order_date and order_qty > 0
    (Object.values(ordersMap) as OrderRecord[]).forEach((order: OrderRecord) => {
      if (!order.order_date || !(Number(order.order_qty) > 0)) return;
      if (seenIngredients.has(order.ingredient_id)) return;
      seenIngredients.add(order.ingredient_id);

      const matchedIng = departmentIngredients.find(i => i.id === order.ingredient_id) 
        || (order.ingredients ? {
            id: order.ingredient_id,
            name: order.ingredients.name || 'วัตถุดิบ',
            brand: order.ingredients.brand || '-',
            department: order.ingredients.department || 'Bar',
            category: order.ingredients.category || 'Others',
            unit: order.ingredients.unit || order.order_unit || 'หน่วย',
            sizePerUnit: order.ingredients.sizePerUnit || '-',
            minStock: order.ingredients.min_stock ?? order.ingredients.minStock ?? 0,
            supplier: order.ingredients.supplier || 'ไม่ระบุผู้จัดจำหน่าย',
            image: order.ingredients.image || '',
            branch: currentBranch
          } as Ingredient : undefined);

      if (matchedIng) {
        const currentStock = currentRemaining[matchedIng.id] !== undefined ? currentRemaining[matchedIng.id] : 0;
        const suggestedOrder = matchedIng.minOrder || (matchedIng.minStock - currentStock > 0 ? matchedIng.minStock - currentStock : matchedIng.minStock || 1);

        list.push({
          ...matchedIng,
          currentStock,
          suggestedOrder,
          order
        });
      }
    });

    return list.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.supplier !== b.supplier) return (a.supplier || '').localeCompare(b.supplier || '');
      return a.name.localeCompare(b.name);
    });
  }, [ingredients, ordersMap, stockRecord, rangeEnd, activeDepartment, allowedDepartments, branch]);

  // Suppliers list derived from ordered items
  const suppliers = useMemo(() => {
    const supplierSet = new Set<string>();
    orderedItemList.forEach(item => {
      if (item.supplier) supplierSet.add(item.supplier);
    });
    return Array.from(supplierSet).sort();
  }, [orderedItemList]);

  // Reset selectedSupplier if not in available suppliers
  useEffect(() => {
    if (selectedSupplier && !suppliers.includes(selectedSupplier)) {
      setSelectedSupplier(null);
    }
  }, [suppliers, selectedSupplier]);

  // Filtered items by selected supplier
  const filteredOrderedItems = useMemo(() => {
    if (!selectedSupplier) return orderedItemList;
    return orderedItemList.filter(item => item.supplier === selectedSupplier);
  }, [orderedItemList, selectedSupplier]);

  // Grouped items by supplier then category
  const groupedOrderedItems = useMemo(() => {
    const groups: Record<string, Record<string, typeof filteredOrderedItems>> = {};
    filteredOrderedItems.forEach(item => {
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
  }, [filteredOrderedItems]);

  const selectedSupplierCount = useMemo(() => {
    if (!selectedSupplier) return orderedItemList.length;
    return orderedItemList.filter(i => i.supplier === selectedSupplier).length;
  }, [orderedItemList, selectedSupplier]);

  const handleBackClick = () => {
    if (onNavigate) {
      onNavigate('barPurchasing');
    } else if (onBack) {
      onBack();
    }
  };

  // Export to Excel (.xlsx)
  const exportExcel = () => {
    const { start, end } = getDateRange();
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    const data = filteredOrderedItems.map(item => {
      const order = item.order;
      return {
        'หมวดหมู่': item.category,
        'รายการสินค้า': item.name,
        'ยี่ห้อ': item.brand || '-',
        'ผู้จัดจำหน่าย': item.supplier || '-',
        'ขนาด/หน่วย': item.sizePerUnit,
        'คงเหลือขั้นต่ำ': `${item.minStock} ${item.unit}`,
        'ยอดคงเหลือตรวจนับ': `${item.currentStock} ${item.unit}`,
        'ยอดสั่งซื้อแนะนำ': `${item.suggestedOrder} ${item.unit}`,
        'วันที่สั่งซื้อ': formatThaiDate(order.order_date),
        'จำนวนที่สั่ง': `${order.order_qty} ${item.unit}`,
        'ผู้สั่งซื้อ': order.ordered_by ? `${order.ordered_by} (${formatOrderDateTime(order.ordered_at)})` : '-',
        'สถานะการสั่งซื้อ': 'สั่งซื้อแล้ว',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ordered Items');
    XLSX.writeFile(wb, `Ordered_Items_${startStr}_to_${endStr}.xlsx`);
  };

  // Export to PDF / Print
  const printReport = async () => {
    const element = document.getElementById('ordered-items-report-content');
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

      const { start, end } = getDateRange();
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      pdf.save(`Ordered_Items_${startStr}_to_${endStr}.pdf`);
    } catch (error) {
      console.warn('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF โปรดลองอีกครั้ง');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F5F4] space-y-4 animate-in fade-in duration-300">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PAGE HEADER CARD
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-4 sm:p-5 shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
        
        {/* ROW 1: Title block (left) + Date Range Selector (right) */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 w-full">
          
          {/* LEFT: Back Button + Title + Subtitle */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button 
              onClick={handleBackClick}
              title="ย้อนกลับ"
              className="w-[32px] h-[32px] rounded-[8px] bg-white border border-[#D4E4E3] flex items-center justify-center text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <div className="w-10 h-10 rounded-[10px] bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] border border-[#D4E4E3]/50 shadow-xs shrink-0 p-2">
              <PackageCheck size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[16px] font-[700] text-[#2D4A49] tracking-tight leading-tight">
                  รายการวัตถุดิบที่สั่งซื้อแล้ว
                </h1>
                {branch && (
                  <span className="text-[10px] font-[600] text-[#5A8A88] bg-[#E8F3F2] px-[7px] py-[2px] rounded-[5px] border border-[#D4E4E3] whitespace-nowrap">
                    สาขา {branch}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5 truncate">
                รายการวัตถุดิบที่มีการบันทึกการสั่งซื้อแล้ว · {rangeDescription}
              </p>
            </div>
          </div>

          {/* RIGHT: Date Range Selector Group */}
          <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
            {/* Quick Select Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setDateRangeMode('7days')}
                className={cn(
                  "text-[12px] rounded-[8px] px-3.5 py-[7px] cursor-pointer transition-all",
                  dateRangeMode === '7days'
                    ? "bg-[#5A8A88] text-white font-[600] shadow-xs border-none"
                    : "bg-white border border-[#D4E4E3] text-[#6B8F8E] hover:bg-[#E8F3F2]"
                )}
              >
                7 วัน
              </button>
              <button
                type="button"
                onClick={() => setDateRangeMode('30days')}
                className={cn(
                  "text-[12px] rounded-[8px] px-3.5 py-[7px] cursor-pointer transition-all",
                  dateRangeMode === '30days'
                    ? "bg-[#5A8A88] text-white font-[600] shadow-xs border-none"
                    : "bg-white border border-[#D4E4E3] text-[#6B8F8E] hover:bg-[#E8F3F2]"
                )}
              >
                1 เดือน
              </button>
              <button
                type="button"
                onClick={() => setDateRangeMode('custom')}
                className={cn(
                  "text-[12px] rounded-[8px] px-3.5 py-[7px] cursor-pointer transition-all",
                  dateRangeMode === 'custom'
                    ? "bg-[#5A8A88] text-white font-[600] shadow-xs border-none"
                    : "bg-white border border-[#D4E4E3] text-[#6B8F8E] hover:bg-[#E8F3F2]"
                )}
              >
                กำหนดเอง
              </button>
            </div>

            {/* Active Range Display */}
            <div className="text-[11px] text-[#6B8F8E] mt-0.5 md:text-right">
              แสดงผล: {startDateTH} – {endDateTH} (พบ {filteredOrderedItems.length} รายการ)
            </div>
          </div>

        </div>

        {/* Custom Date Inputs (show only when dateRangeMode === 'custom') */}
        {dateRangeMode === 'custom' && (
          <div className="flex items-center justify-end gap-2 flex-wrap pt-2.5 mt-2 border-t border-[#F0F5F4]">
            <span className="text-[12px] text-[#6B8F8E]">ตั้งแต่:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-white border border-[#D4E4E3] rounded-[8px] px-2.5 py-1.5 text-[12px] text-[#2D4A49] focus:outline-none focus:border-[#5A8A88]"
            />
            <span className="text-[12px] text-[#6B8F8E]">ถึง:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-white border border-[#D4E4E3] rounded-[8px] px-2.5 py-1.5 text-[12px] text-[#2D4A49] focus:outline-none focus:border-[#5A8A88]"
            />
            <button
              type="button"
              onClick={() => fetchOrderedItems()}
              disabled={!customStartDate || !customEndDate}
              className={cn(
                "flex items-center gap-1.5 text-[12px] font-[600] rounded-[8px] px-3.5 py-1.5 transition-colors cursor-pointer",
                customStartDate && customEndDate
                  ? "bg-[#5A8A88] text-white hover:bg-[#4a7270] shadow-xs"
                  : "bg-[#D4E4E3] text-gray-400 cursor-not-allowed"
              )}
            >
              <Search size={13} />
              <span>ดูข้อมูล</span>
            </button>
          </div>
        )}

        {/* DIVIDER BETWEEN ROW 1 AND ROW 2 */}
        <div className="h-[1px] bg-[#F0F5F4] my-3 w-full" />

        {/* ROW 2: Department Tabs + Supplier Filter + Export Dropdown */}
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
                            ({orderedItemList.length})
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
                        const count = orderedItemList.filter(i => i.supplier === sup).length;
                        
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

          {/* RIGHT: Export Dropdown */}
          <div className="relative ml-auto shrink-0" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportOpen(!isExportOpen)}
              disabled={filteredOrderedItems.length === 0}
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
      <div className="flex-1 overflow-auto custom-scrollbar" id="ordered-items-report-content">
        <div className="space-y-4 sm:space-y-5">
          {/* Printable Header */}
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-xl font-black text-[#2D4A49]">รายการวัตถุดิบที่สั่งซื้อแล้ว (Ordered Items Report)</h1>
            <p className="text-[#6B8F8E] text-xs mt-1">ช่วงวันที่ {startDateTH} – {endDateTH}</p>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] p-12 text-center">
              <Loader2 size={32} className="animate-spin text-[#5A8A88] mx-auto mb-3" />
              <p className="text-[13px] font-semibold text-[#2D4A49]">กำลังโหลดข้อมูลรายการที่สั่งซื้อ...</p>
            </div>
          ) : filteredOrderedItems.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] p-10 text-center">
              <div className="w-16 h-16 bg-[#F0F5F4] rounded-full flex items-center justify-center mx-auto mb-3 text-[#C5D5D3]">
                <PackageCheck size={48} />
              </div>
              <p className="text-[14px] font-bold text-[#6B8F8E]">ยังไม่มีรายการที่สั่งซื้อ</p>
              <p className="text-[11px] text-[#A8BCBB] mt-1 max-w-sm mx-auto">
                รายการที่บันทึกการสั่งซื้อแล้วจะแสดงที่นี่
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => onNavigate ? onNavigate('barPurchasing') : onBack ? onBack() : undefined}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#E8F3F2] hover:bg-[#D8ECEB] text-[#5A8A88] text-[11px] font-semibold rounded-[8px] border border-[#D4E4E3] transition-colors cursor-pointer shadow-2xs"
                >
                  <ShoppingCart size={13} />
                  <span>ไปยังรายการที่ต้องสั่งซื้อ</span>
                </button>
              </div>
            </div>
          ) : (
            // Grouped Ordered Tables by Supplier
            Object.entries(groupedOrderedItems).map(([supplier, categories]) => {
              const allSupplierItems = Object.values(categories).flat();
              const totalItems = allSupplierItems.length;
              
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
                      <span className="bg-[#E8F3F2] text-[#5A8A88] text-[10px] font-semibold px-2 py-0.5 rounded-[5px] border border-[#D4E4E3]">
                        {totalItems} รายการ
                      </span>
                    </div>
                  </div>

                  {/* Table with Horizontal Scroll */}
                  <div className="overflow-x-auto overflow-y-visible w-full custom-scrollbar">
                    <table className="w-full text-left border-collapse table-fixed min-w-[774px]" style={{ tableLayout: 'fixed', width: '100%', minWidth: '774px' }}>
                      <colgroup>
                        <col style={{ width: '36px' }} />
                        <col style={{ width: '146px' }} />
                        <col style={{ width: '68px' }} />
                        <col style={{ width: '66px' }} />
                        <col style={{ width: '64px' }} />
                        <col style={{ width: '66px' }} />
                        <col style={{ width: '92px' }} />
                        <col style={{ width: '68px' }} />
                        <col style={{ width: '96px' }} />
                        <col style={{ width: '72px' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-[#2D4A49] text-white text-[9.5px] font-semibold border-b border-[#2D4A49] leading-tight">
                          <th className="p-1 text-center w-[36px] border-r border-[#3d605f] whitespace-nowrap">รูป</th>
                          <th className="py-2 px-2 text-left w-[146px] border-r border-[#3d605f] whitespace-nowrap">รายการสินค้า</th>
                          <th className="py-2 px-1 text-left w-[68px] border-r border-[#3d605f] whitespace-nowrap">ขนาด/หน่วย</th>
                          <th className="py-2 px-1 text-center w-[66px] border-r border-[#3d605f] whitespace-nowrap">คงเหลือขั้นต่ำ</th>
                          <th className="py-2 px-1 text-center w-[64px] border-r border-[#3d605f] whitespace-nowrap">ยอดตรวจนับ</th>
                          <th className="py-2 px-1 text-center w-[66px] border-r border-[#3d605f] whitespace-nowrap">ยอดสั่งแนะนำ</th>
                          <th className="py-2 px-1 text-center w-[92px] border-r border-[#3d605f] whitespace-nowrap">วันที่สั่งซื้อ</th>
                          <th className="py-2 px-1 text-center w-[68px] border-r border-[#3d605f] whitespace-nowrap">จำนวนที่สั่ง</th>
                          <th className="py-2 px-1.5 text-left w-[96px] border-r border-[#3d605f] whitespace-nowrap">ผู้สั่งซื้อ</th>
                          <th 
                            className="py-2 px-1 text-center w-[72px] whitespace-nowrap"
                            style={{
                              width: "72px",
                              textAlign: "center",
                              backgroundColor: "#1E5A7A",
                              color: "#FFFFFF",
                              fontSize: "10px",
                              fontWeight: 600,
                            }}
                          >
                            จัดการ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(categories).map(([category, items]) => (
                          <React.Fragment key={category}>
                            {/* Category Row */}
                            <tr className="bg-[#F8FAFA] border-y border-[#F0F5F4]">
                              <td colSpan={10} className="px-2.5 py-1">
                                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-[#5A8A88]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88] shrink-0"></span>
                                  <span>{category}</span>
                                </div>
                              </td>
                            </tr>
                            {/* Items */}
                            {items.map((item, index) => {
                              const isLow = item.currentStock < item.minStock;
                              const order = item.order;
                              const orderDate = order.order_date;
                              const orderQty = order.order_qty;

                              return (
                                <tr 
                                  key={item.order?.id || `${item.id}-${index}`} 
                                  className="relative transition-colors border-b border-[#F0F5F4] text-[9.5px] font-normal bg-[#E8F3F2]/60 border-l-[3px] border-l-[#5A8A88] hover:bg-[#DDF0EE]"
                                >
                                  {/* Item Image */}
                                  <td className="relative p-1 border-r border-[#F0F5F4] text-center w-[36px]" style={{ width: '36px' }}>
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
                                        <PackageCheck size={11} />
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
                                    <span className="inline-block px-1.5 py-0.5 rounded-[3px] text-[9.5px] leading-tight whitespace-nowrap bg-white text-[#5A8A88] font-[700] border border-[#5A8A88]/30 shadow-2xs">
                                      {item.suggestedOrder} {item.unit}
                                    </span>
                                  </td>

                                  {/* COLUMN 1 — วันที่สั่งซื้อ (READ-ONLY) */}
                                  <td className="px-1 py-1 text-center w-[100px] max-w-[100px] border-r border-[#F0F5F4]" style={{ width: '100px', maxWidth: '100px' }}>
                                    <span 
                                      className="inline-block bg-[#E8F3F2] text-[#5A8A88] text-[11px] font-[600] rounded-[6px] px-2 py-[3px] whitespace-nowrap border border-[#D4E4E3]/60 shadow-2xs"
                                      title={orderDate}
                                    >
                                      {formatThaiDate(orderDate)}
                                    </span>
                                  </td>

                                  {/* COLUMN 2 — จำนวนที่สั่ง (READ-ONLY) */}
                                  <td className="px-1 py-1 text-center w-[68px] max-w-[68px] border-r border-[#F0F5F4]" style={{ width: '68px', maxWidth: '68px' }}>
                                    <span 
                                      className="inline-block bg-[#E8F3F2] text-[#5A8A88] text-[11px] font-[600] rounded-[6px] px-2 py-[3px] whitespace-nowrap border border-[#D4E4E3]/60 shadow-2xs"
                                    >
                                      {orderQty} {item.unit}
                                    </span>
                                  </td>

                                  {/* COLUMN 3 — ผู้สั่งซื้อ (READ-ONLY) */}
                                  <td className="px-1.5 py-1 text-left w-[96px] max-w-[96px] border-r border-[#F0F5F4]" style={{ width: '96px', maxWidth: '96px' }}>
                                    {order?.ordered_by ? (
                                      <div className="flex flex-col items-start justify-center gap-0.5 w-full overflow-hidden">
                                        <span className="text-[10px] font-bold text-[#2D4A49] leading-tight truncate w-full" title={order.ordered_by}>
                                          {order.ordered_by}
                                        </span>
                                        {order.ordered_at && (
                                          <span className="text-[9px] text-[#6B8F8E] leading-tight truncate w-full" title={formatOrderDateTime(order.ordered_at)}>
                                            {formatOrderDateTime(order.ordered_at)}
                                          </span>
                                        )}
                                        <span className="mt-0.5 inline-block bg-[#22C55E] text-white text-[9px] font-semibold rounded-[4px] px-1.5 py-0.5 leading-none shadow-2xs whitespace-nowrap">
                                          ✅ สั่งซื้อแล้ว
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="mt-0.5 inline-block bg-[#22C55E] text-white text-[9px] font-semibold rounded-[4px] px-1.5 py-0.5 leading-none shadow-2xs whitespace-nowrap">
                                        ✅ สั่งซื้อแล้ว
                                      </span>
                                    )}
                                  </td>
                                  {/* COLUMN 4 — จัดการ (Edit & Delete) */}
                                  <td className="px-1 py-1 text-center w-[72px]" style={{ width: "72px" }}>
                                    <div 
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "4px",
                                        padding: "6px 4px",
                                      }}
                                    >
                                      {/* Edit button */}
                                      <button
                                        type="button"
                                        onClick={() => openEditModal(order, item)}
                                        title="แก้ไขคำสั่งซื้อ"
                                        style={{
                                          background: "transparent",
                                          borderRadius: "6px",
                                          padding: "5px",
                                          cursor: "pointer",
                                          border: "none",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          transition: "background-color 0.15s ease",
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#EEF6FB")}
                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                                      >
                                        <Pencil size={13} color="#5BA4C8" />
                                      </button>

                                      {/* Delete button */}
                                      <button
                                        type="button"
                                        onClick={() => openDeleteConfirm(order, item)}
                                        title="ลบคำสั่งซื้อ"
                                        style={{
                                          background: "transparent",
                                          borderRadius: "6px",
                                          padding: "5px",
                                          cursor: "pointer",
                                          border: "none",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          transition: "background-color 0.15s ease",
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#FEE2E2")}
                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                                      >
                                        <Trash2 size={13} color="#EF4444" />
                                      </button>
                                    </div>
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
          {filteredOrderedItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] p-4 sm:p-5 print:hidden">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-[13px] font-bold text-[#2D4A49]">สรุปรายการที่สั่งซื้อแล้ว</h4>
                  <p className="text-[11px] text-[#6B8F8E] mt-0.5">ช่วงวันที่ {startDateTH} – {endDateTH}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center sm:text-right">
                    <div className="text-[10px] font-bold text-[#6B8F8E] uppercase">จำนวนรายการ</div>
                    <div className="text-[18px] font-black text-[#5A8A88]">{filteredOrderedItems.length} รายการ</div>
                  </div>
                  <div className="w-[1px] h-7 bg-[#D4E4E3]" />
                  <div className="text-center sm:text-right">
                    <div className="text-[10px] font-bold text-[#6B8F8E] uppercase">ผู้จัดจำหน่าย</div>
                    <div className="text-[18px] font-black text-[#2D4A49]">{Object.keys(groupedOrderedItems).length} ราย</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
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

      {/* Edit Modal */}
      {editingOrder && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          zIndex: 250,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: "20px",
            padding: "28px 24px",
            maxWidth: "400px", width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}>
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "20px",
            }}>
              <div style={{
                width: "40px", height: "40px",
                borderRadius: "50%",
                background: "#EEF6FB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Pencil size={18} color="#5BA4C8" />
              </div>
              <div>
                <h3 style={{
                  fontSize: "15px", fontWeight: 700,
                  color: "#1E3D52", margin: 0,
                }}>
                  แก้ไขคำสั่งซื้อ
                </h3>
                <p style={{
                  fontSize: "11px", color: "#4A7592",
                  margin: "2px 0 0",
                }}>
                  {editingOrder.ingredients?.name || "รายการวัตถุดิบ"}
                </p>
              </div>
            </div>

            {/* Form fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* วันที่สั่งซื้อ */}
              <div>
                <label style={{
                  fontSize: "11px", fontWeight: 500,
                  color: "#4A7592",
                  display: "block", marginBottom: "5px",
                }}>
                  วันที่สั่งซื้อ
                </label>
                <input
                  type="date"
                  value={editForm.order_date}
                  onChange={e => setEditForm(prev =>
                    ({ ...prev, order_date: e.target.value })
                  )}
                  style={{
                    width: "100%", height: "38px",
                    border: "1px solid #C8E3F0",
                    borderRadius: "8px",
                    padding: "0 12px",
                    fontSize: "12px",
                    color: "#1E3D52",
                    outline: "none",
                  }}
                />
              </div>

              {/* จำนวนที่สั่ง */}
              <div>
                <label style={{
                  fontSize: "11px", fontWeight: 500,
                  color: "#4A7592",
                  display: "block", marginBottom: "5px",
                }}>
                  จำนวนที่สั่ง
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="number"
                    min="1"
                    value={editForm.order_qty}
                    onChange={e => setEditForm(prev =>
                      ({ ...prev,
                         order_qty: parseInt(e.target.value) || 0
                      })
                    )}
                    style={{
                      flex: 1, height: "38px",
                      border: "1px solid #C8E3F0",
                      borderRadius: "8px",
                      padding: "0 12px",
                      fontSize: "13px",
                      color: "#1E3D52",
                      textAlign: "center",
                      outline: "none",
                    }}
                  />
                  <span style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: "12px",
                    color: "#4A7592",
                    paddingRight: "4px",
                  }}>
                    {editForm.order_unit}
                  </span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{
              display: "flex", gap: "8px",
              marginTop: "24px",
            }}>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                disabled={isSaving}
                style={{
                  flex: 1, padding: "11px",
                  borderRadius: "10px",
                  border: "1px solid #C8E3F0",
                  background: "#EEF6FB",
                  color: "#4A7592",
                  fontSize: "13px", fontWeight: 500,
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleEditSave()}
                disabled={isSaving}
                style={{
                  flex: 1, padding: "11px",
                  borderRadius: "10px",
                  border: "none",
                  background: isSaving ? "#82BBD8" : "#5BA4C8",
                  color: "white",
                  fontSize: "13px", fontWeight: 600,
                  cursor: isSaving ? "wait" : "pointer",
                }}
              >
                {isSaving ? "กำลังบันทึก..." : "💾 บันทึกการแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingOrder && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          zIndex: 250,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: "20px",
            padding: "28px 24px",
            maxWidth: "360px", width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            textAlign: "center",
          }}>
            {/* Icon */}
            <div style={{
              width: "60px", height: "60px",
              borderRadius: "50%",
              background: "#FEE2E2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <Trash2 size={26} color="#EF4444" />
            </div>

            <h3 style={{
              fontSize: "16px", fontWeight: 700,
              color: "#1E3D52", margin: "0 0 8px",
            }}>
              ลบคำสั่งซื้อ
            </h3>

            <p style={{
              fontSize: "12px", color: "#4A7592",
              margin: "0 0 6px",
            }}>
              ต้องการลบคำสั่งซื้อของ
            </p>
            <p style={{
              fontSize: "14px", fontWeight: 700,
              color: "#1E3D52", margin: "0 0 16px",
            }}>
              "{deletingOrder.ingredients?.name || "รายการนี้"}"
            </p>

            <div style={{
              background: "#FEF3C7",
              border: "1px solid #FDE68A",
              borderRadius: "8px",
              padding: "10px 14px",
              marginBottom: "20px",
              fontSize: "11px",
              color: "#92400E",
              textAlign: "left",
              lineHeight: 1.5,
            }}>
              ⚠️ รายการนี้จะถูกลบออกจากรายการรอส่งมอบ และจะกลับไปเป็นรายการ "ต้องสั่งซื้อ" อีกครั้ง
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setDeletingOrder(null)}
                disabled={isSaving}
                style={{
                  flex: 1, padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #C8E3F0",
                  background: "#EEF6FB",
                  color: "#4A7592",
                  fontSize: "13px", fontWeight: 500,
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleDelete()}
                disabled={isSaving}
                style={{
                  flex: 1, padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: isSaving ? "#F87171" : "#EF4444",
                  color: "white",
                  fontSize: "13px", fontWeight: 700,
                  cursor: isSaving ? "wait" : "pointer",
                }}
              >
                {isSaving ? "กำลังลบ..." : "🗑️ ลบคำสั่งซื้อ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 9999,
            backgroundColor: toast.type === "error" ? "#EF4444" : "#10B981",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
};
