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
  Check
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
}

interface PurchasingReportProps {
  ingredients: Ingredient[];
  stockRecord: Record<string, Record<string, number | { in?: number; out?: number; remaining?: number; waste?: number; usageInfo?: string }>>;
  onBack: () => void;
  allowedDepartments?: ('Bar' | 'Bakery')[];
  branch?: string;
  user?: { name: string; role?: string };
}

type DepartmentFilter = 'All' | 'Bar' | 'Bakery';

export const PurchasingReport: React.FC<PurchasingReportProps> = ({
  ingredients,
  stockRecord,
  onBack,
  allowedDepartments = ['Bar', 'Bakery'],
  branch,
  user,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const initialDept = allowedDepartments.length === 2 ? 'All' : allowedDepartments[0] || 'All';
  const [activeDepartment, setActiveDepartment] = useState<DepartmentFilter>(initialDept);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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

            // Sync into localStorage
            try {
              const rawAll = localStorage.getItem('cafe_purchasing_orders');
              let allList: OrderRecord[] = rawAll ? JSON.parse(rawAll) : [];
              allList = allList.filter(o => !(o.branch === currentBranch && o.stock_date === selectedDate));
              allList.push(...data);
              localStorage.setItem('cafe_purchasing_orders', JSON.stringify(allList));
            } catch {}
          }
        } catch (err) {
          console.warn('Error fetching purchasing_orders from Supabase:', err);
        }
      }
    };

    loadOrders();

    return () => {
      isMounted = false;
    };
  }, [branch, selectedDate]);

  // Handle immediate field change in inputs
  const handleOrderFieldChange = (
    ingredientId: string,
    field: 'order_date' | 'order_qty',
    val: string | number,
    unit: string
  ) => {
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

  // Auto-save on blur (when leaving input field)
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

    // Update state to guarantee ordered_by and ordered_at
    setOrders(prev => ({
      ...prev,
      [ingredientId]: recordToSave
    }));

    // 1. Save to localStorage
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

    // 2. Upsert to Supabase
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
          console.warn('Supabase purchasing_orders upsert error:', error.message);
        }
      } catch (err) {
        console.warn('Error upserting purchasing_orders:', err);
      }
    }
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
              onClick={onBack}
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
                onChange={(e) => setSelectedDate(e.target.value)}
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
              const totalItems = Object.values(categories).reduce((acc, items) => acc + items.length, 0);
              
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
                    <span className="bg-[#E8F3F2] text-[#5A8A88] text-[10px] font-semibold px-2 py-0.5 rounded-[5px] border border-[#D4E4E3]">
                      {totalItems} รายการ
                    </span>
                  </div>

                  {/* Table with Horizontal Scroll */}
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[980px]">
                      <thead>
                        <tr className="bg-[#2D4A49] text-white text-[10px] sm:text-[11px] font-semibold border-b border-[#2D4A49]">
                          <th className="py-2 px-2.5 text-center w-[50px] border-r border-[#3d605f]">รูป</th>
                          <th className="py-2 px-3 text-left min-w-[170px] border-r border-[#3d605f]">รายการสินค้า</th>
                          <th className="py-2 px-2.5 text-left w-[100px] border-r border-[#3d605f]">หมวดหมู่</th>
                          <th className="py-2 px-2.5 text-left w-[95px] border-r border-[#3d605f]">ขนาด/หน่วย</th>
                          <th className="py-2 px-2 text-center w-[85px] border-r border-[#3d605f]">คงเหลือขั้นต่ำ</th>
                          <th className="py-2 px-2 text-center w-[85px] border-r border-[#3d605f]">ยอดตรวจนับ</th>
                          <th className="py-2 px-2.5 text-center w-[95px] border-r border-[#3d605f]">ยอดสั่งแนะนำ</th>
                          <th className="py-2 px-2 text-center w-[110px] border-r border-[#3d605f]">วันที่สั่งซื้อ</th>
                          <th className="py-2 px-2 text-center w-[90px] border-r border-[#3d605f]">จำนวนที่สั่ง</th>
                          <th className="py-2 px-2.5 text-center w-[130px]">ผู้สั่งซื้อ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(categories).map(([category, items]) => (
                          <React.Fragment key={category}>
                            {/* Category Row */}
                            <tr className="bg-[#F8FAFA] border-y border-[#F0F5F4]">
                              <td colSpan={10} className="px-3 py-1.5">
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#5A8A88]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88] shrink-0"></span>
                                  <span>{category}</span>
                                </div>
                              </td>
                            </tr>
                            {/* Items */}
                            {items.map((item, index) => {
                              const isLow = item.currentStock < item.minStock;
                              const isEven = index % 2 === 1;
                              const order = orders[item.id];
                              const orderDate = order?.order_date || '';
                              const orderQty = order?.order_qty !== undefined ? order.order_qty : '';
                              const isOrdered = Boolean(orderDate) && Number(orderQty) > 0;

                              return (
                                <tr 
                                  key={item.id} 
                                  className={cn(
                                    "transition-colors border-b border-[#F0F5F4]",
                                    isOrdered 
                                      ? "bg-[#E8F3F2] border-l-[3px] border-l-[#5A8A88] hover:bg-[#DDF0EE]"
                                      : isEven 
                                        ? "bg-[#F8FAFA] hover:bg-[#E8F3F2]/60" 
                                        : "bg-[#FFFFFF] hover:bg-[#E8F3F2]/60"
                                  )}
                                >
                                  {/* Item Image */}
                                  <td className="p-1.5 border-r border-[#F0F5F4] text-center w-[50px]">
                                    {item.image ? (
                                      <img 
                                        src={item.image} 
                                        alt={item.name} 
                                        className="w-8 h-8 object-cover rounded-md border border-[#D4E4E3] mx-auto shadow-2xs" 
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-md border border-[#D4E4E3] bg-[#F8FAFA] flex items-center justify-center mx-auto text-[#6B8F8E]">
                                        <ShoppingCart size={13} />
                                      </div>
                                    )}
                                  </td>

                                  {/* Item Name & Subtitle */}
                                  <td className="px-3 py-2 border-r border-[#F0F5F4] min-w-[170px]">
                                    <div className="font-medium text-[#2D4A49] text-[11px] leading-tight" title={item.name}>
                                      {item.name}
                                    </div>
                                    {item.brand && (
                                      <div className="text-[10px] text-[#6B8F8E] mt-0.5">
                                        ยี่ห้อ: {item.brand}
                                      </div>
                                    )}
                                  </td>

                                  {/* Category Badge */}
                                  <td className="px-2.5 py-2 border-r border-[#F0F5F4] w-[100px]">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] text-[10px] font-semibold bg-[#E8F3F2] text-[#5A8A88]">
                                      {item.category}
                                    </span>
                                  </td>

                                  {/* Size / Unit */}
                                  <td className="px-2.5 py-2 border-r border-[#F0F5F4] text-[10px] text-[#6B8F8E] w-[95px]">
                                    {item.sizePerUnit || '-'}
                                  </td>

                                  {/* Min Stock (คงเหลือขั้นต่ำ) */}
                                  <td className="px-2 py-2 border-r border-[#F0F5F4] text-center w-[85px]">
                                    {isLow ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#FEE2E2] text-[#EF4444] font-semibold text-[10px] font-mono">
                                        {item.minStock} {item.unit}
                                      </span>
                                    ) : (
                                      <span className="text-[#2D4A49] font-mono text-[10px]">
                                        {item.minStock} {item.unit}
                                      </span>
                                    )}
                                  </td>

                                  {/* Current Stock (ยอดตรวจนับ) */}
                                  <td className="px-2 py-2 border-r border-[#F0F5F4] font-mono text-[10px] text-center text-[#6B8F8E] w-[85px]">
                                    {item.currentStock} {item.unit}
                                  </td>

                                  {/* Suggested Order (ยอดสั่งแนะนำ) */}
                                  <td className="px-2.5 py-2 font-mono text-[10px] text-center w-[95px] border-r border-[#F0F5F4]">
                                    <span className={cn(
                                      "inline-block px-1.5 py-0.5 rounded-md text-[10px]",
                                      isOrdered 
                                        ? "bg-white text-[#5A8A88] font-[700] border border-[#5A8A88]/30 shadow-2xs" 
                                        : "bg-[#E8F3F2] text-[#5A8A88] font-bold"
                                    )}>
                                      {item.suggestedOrder} {item.unit}
                                    </span>
                                  </td>

                                  {/* COLUMN 1 — วันที่สั่งซื้อ */}
                                  <td className="px-2 py-1.5 text-center w-[110px] border-r border-[#F0F5F4]">
                                    <input 
                                      type="date"
                                      value={orderDate}
                                      placeholder="เลือกวันที่"
                                      onChange={(e) => handleOrderFieldChange(item.id, 'order_date', e.target.value, item.unit)}
                                      onBlur={() => handleOrderSave(item.id, item.unit)}
                                      className="bg-[#FFFFFF] border border-[#D4E4E3] rounded-[6px] px-2 py-1 text-[11px] text-[#2D4A49] w-full focus:outline-none focus:border-[#5A8A88] transition-colors"
                                    />
                                  </td>

                                  {/* COLUMN 2 — จำนวนที่สั่ง */}
                                  <td className="px-2 py-1.5 text-center w-[90px] border-r border-[#F0F5F4]">
                                    <div className="flex items-center gap-1">
                                      <input 
                                        type="number"
                                        min={0}
                                        value={orderQty === 0 && !orderDate ? '' : orderQty}
                                        placeholder="0"
                                        onChange={(e) => handleOrderFieldChange(item.id, 'order_qty', e.target.value === '' ? '' : Number(e.target.value), item.unit)}
                                        onBlur={() => handleOrderSave(item.id, item.unit)}
                                        className="bg-[#FFFFFF] border border-[#D4E4E3] rounded-[6px] px-1.5 py-1 text-[11px] text-[#2D4A49] w-full text-center focus:outline-none focus:border-[#5A8A88] transition-colors"
                                      />
                                      <span className="text-[11px] text-[#6B8F8E] whitespace-nowrap shrink-0">
                                        {item.unit}
                                      </span>
                                    </div>
                                  </td>

                                  {/* COLUMN 3 — ผู้สั่งซื้อ */}
                                  <td className="px-2 py-1.5 text-center w-[130px]">
                                    {order?.ordered_by ? (
                                      <div className="flex flex-col items-center justify-center gap-0.5">
                                        <span className="text-[11px] font-bold text-[#2D4A49] leading-tight">
                                          {order.ordered_by}
                                        </span>
                                        {order.ordered_at && (
                                          <span className="text-[10px] text-[#6B8F8E] leading-tight">
                                            {formatOrderDateTime(order.ordered_at)}
                                          </span>
                                        )}
                                        {isOrdered && (
                                          <span className="mt-0.5 inline-block bg-[#22C55E] text-white text-[9px] font-[600] rounded-[4px] px-1.5 py-[1px] leading-tight shadow-2xs">
                                            ✓ สั่งซื้อแล้ว
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[#94A3B8] text-[12px] font-medium">—</span>
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
        </div>
      </div>
    </div>
  );
};

export default PurchasingReport;
