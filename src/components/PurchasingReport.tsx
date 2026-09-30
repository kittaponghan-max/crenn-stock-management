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

interface PurchasingReportProps {
  ingredients: Ingredient[];
  stockRecord: Record<string, Record<string, number | { remaining: number; waste: number; usageInfo: string }>>;
  onBack: () => void;
  allowedDepartments?: ('Bar' | 'Bakery')[];
}

type DepartmentFilter = 'All' | 'Bar' | 'Bakery';

export const PurchasingReport: React.FC<PurchasingReportProps> = ({
  ingredients,
  stockRecord,
  onBack,
  allowedDepartments = ['Bar', 'Bakery'],
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const initialDept = allowedDepartments.length === 2 ? 'All' : allowedDepartments[0] || 'All';
  const [activeDepartment, setActiveDepartment] = useState<DepartmentFilter>(initialDept);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState<boolean>(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  // Close supplier dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSupplierDropdownOpen(false);
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
    // Filter ingredients by department first
    const allowedIngs = ingredients.filter(ing => allowedDepartments.includes(ing.department as any));
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
      const currentStock = currentRemaining[item.id] || 0;
      if (currentStock < item.minStock) {
        toBuy.push({
          ...item,
          currentStock,
          suggestedOrder: item.minOrder || (item.minStock - currentStock > 0 ? item.minStock - currentStock : 1),
        });
      }
    });

    return toBuy.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.supplier !== b.supplier) return (a.supplier || '').localeCompare(b.supplier || '');
      return a.name.localeCompare(b.name);
    });
  }, [ingredients, stockRecord, selectedDate, activeDepartment, allowedDepartments]);

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
    const data = purchasesToMake.map(item => ({
      'หมวดหมู่': item.category,
      'รายการสินค้า': item.name,
      'ยี่ห้อ': item.brand || '-',
      'ผู้จัดจำหน่าย': item.supplier || '-',
      'ขนาด/หน่วย': item.sizePerUnit,
      'คงเหลือขั้นต่ำ': `${item.minStock} ${item.unit}`,
      'ยอดคงเหลือตรวจนับ': `${item.currentStock} ${item.unit}`,
      'ยอดสั่งซื้อแนะนำ': `${item.suggestedOrder} ${item.unit}`,
    }));

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
    <div className="flex flex-col h-full bg-[#F0F5F4] space-y-5 animate-in fade-in duration-300">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HEADER CARD (Main card at top)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] p-5 overflow-visible">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          {/* Left info */}
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              title="ย้อนกลับ"
              className="w-8 h-8 rounded-lg bg-white border border-[#D4E4E3] flex items-center justify-center text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <div className="w-9 h-9 rounded-[10px] bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] shrink-0">
              <ShoppingCart size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#2D4A49] leading-tight">
                สรุปยอดสั่งซื้อวัตถุดิบ (Purchasing)
              </h2>
              <p className="text-[11px] text-[#6B8F8E] font-normal mt-0.5">
                อ้างอิงจากรายการตรวจนับสต็อกประจำวัน
              </p>
            </div>
          </div>

          {/* FILTER ROW 1 (Location Tabs + Date + Excel + PDF) */}
          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
            {/* Location tabs [ทั้งหมด] [บาร์] [ครัว] */}
            <div className="flex bg-[#F0F5F4] p-1 rounded-xl border border-[#D4E4E3] gap-1">
              {(['All', 'Bar', 'Bakery'] as DepartmentFilter[])
                .filter(dept => dept === 'All' ? allowedDepartments.length === 2 : allowedDepartments.includes(dept as any))
                .map((dept) => {
                  const isActive = activeDepartment === dept;
                  const Icon = dept === 'All' ? LayoutGrid : dept === 'Bar' ? Coffee : ChefHat;
                  
                  return (
                    <button
                      key={dept}
                      onClick={() => setActiveDepartment(dept)}
                      className={cn(
                        "flex items-center gap-1.5 px-4 h-[36px] rounded-lg text-[12px] transition-all cursor-pointer",
                        isActive 
                          ? "bg-[#5A8A88] text-white font-semibold shadow-xs" 
                          : "bg-white border border-[#D4E4E3] text-[#6B8F8E] font-medium hover:bg-[#E8F3F2]"
                      )}
                    >
                      <Icon size={14} />
                      <span>{dept === 'All' ? 'ทั้งหมด' : dept === 'Bar' ? 'บาร์' : 'ครัว'}</span>
                    </button>
                  );
                })}
            </div>

            {/* Date input */}
            <div className="flex items-center gap-2 bg-white px-3 h-[36px] rounded-lg border border-[#D4E4E3] shadow-xs">
              <Calendar size={13} className="text-[#5A8A88] shrink-0" />
              <input 
                type="date" 
                className="bg-transparent border-none focus:outline-none text-[12px] font-medium text-[#2D4A49] w-[120px] cursor-pointer"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            
            {/* Excel export button */}
            <button
              onClick={exportExcel}
              disabled={purchasesToMake.length === 0}
              className="flex items-center gap-1.5 px-3.5 h-[36px] bg-[#5A8A88] hover:bg-[#4d7775] text-white font-medium text-[12px] rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Download size={13} className="text-white" />
              <span>Excel</span>
            </button>

            {/* PDF export button */}
            <button
              onClick={printReport}
              disabled={purchasesToMake.length === 0}
              className="flex items-center gap-1.5 px-3.5 h-[36px] bg-white text-[#2D4A49] font-medium text-[12px] rounded-lg hover:bg-[#E8F3F2] transition-colors border border-[#D4E4E3] disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Printer size={13} className="text-[#5A8A88]" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            FILTER ROW 2 (ผู้จัดจำหน่าย Dropdown Selector)
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {suppliers.length > 0 && (
          <div className="flex items-center gap-3 pt-4 border-t border-[#D4E4E3] mt-4">
            <span className="text-[12px] font-medium text-[#6B8F8E] whitespace-nowrap flex items-center gap-1.5">
              <Building2 size={14} className="text-[#5A8A88]" />
              <span>ผู้จัดจำหน่าย:</span>
            </span>

            {/* Dropdown container */}
            <div className="relative" ref={supplierDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSupplierDropdownOpen(prev => !prev)}
                className={cn(
                  "flex items-center justify-between gap-2 bg-white border border-[#D4E4E3] rounded-lg px-3.5 h-[36px] text-[12px] text-[#2D4A49] min-w-[200px] cursor-pointer transition-colors shadow-xs",
                  isSupplierDropdownOpen ? "border-[#5A8A88] bg-[#E8F3F2]" : "hover:bg-[#F0F5F4]"
                )}
                aria-haspopup="listbox"
                aria-expanded={isSupplierDropdownOpen}
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 size={14} className="text-[#5A8A88] shrink-0" />
                  <span className="truncate font-medium">
                    {selectedSupplier ? selectedSupplier : 'ทั้งหมด'} ({selectedSupplierCount})
                  </span>
                </div>
                <ChevronDown size={12} className={cn("text-[#A8BCBB] transition-transform duration-150 shrink-0", isSupplierDropdownOpen && "rotate-180 text-[#5A8A88]")} />
              </button>

              {/* Dropdown list (opens downward) */}
              {isSupplierDropdownOpen && (
                <div className="absolute left-0 top-[calc(100%+4px)] w-[260px] sm:w-[280px] bg-white border border-[#D4E4E3] rounded-[10px] shadow-[0_8px_24px_rgba(45,74,73,0.12)] max-h-[300px] overflow-y-auto z-50 p-1 animate-in fade-in zoom-in-95 duration-150 custom-scrollbar">
                  {/* Option: ทั้งหมด */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplier(null);
                      setIsSupplierDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-[9px] rounded-[7px] text-[12px] transition-colors cursor-pointer text-left group",
                      selectedSupplier === null
                        ? "bg-[#E8F3F2] text-[#5A8A88] font-semibold"
                        : "text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88]"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <LayoutGrid size={14} className="text-[#5A8A88] shrink-0" />
                      <span className="truncate">ทั้งหมด</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="bg-[#E8F3F2] text-[#5A8A88] text-[10px] font-semibold rounded px-1.5 py-0.5">
                        ({allPurchasesToMake.length})
                      </span>
                      {selectedSupplier === null && (
                        <Check size={14} className="text-[#5A8A88]" />
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
                          "w-full flex items-center justify-between px-3 py-[9px] rounded-[7px] text-[12px] transition-colors cursor-pointer text-left group",
                          isSelected
                            ? "bg-[#E8F3F2] text-[#5A8A88] font-semibold"
                            : "text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88]"
                        )}
                      >
                        <span className="truncate pr-2">{sup}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="bg-[#F0F5F4] text-[#6B8F8E] text-[10px] rounded px-1.5 py-0.5">
                            {count}
                          </span>
                          {isSelected && (
                            <Check size={14} className="text-[#5A8A88]" />
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

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          MAIN CONTENT AREA (Table & Groups)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex-1 overflow-auto custom-scrollbar" id="purchasing-report-content">
        <div className="space-y-6">
          {/* Printable Header */}
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-xl font-black text-[#2D4A49]">สรุปยอดสั่งซื้อวัตถุดิบ (Purchasing Report)</h1>
            <p className="text-[#6B8F8E] text-xs mt-1">ประจำวันที่ {format(new Date(selectedDate), 'dd/MM/yyyy')}</p>
          </div>

          {/* Empty State */}
          {purchasesToMake.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-[#D4E4E3] p-12 text-center">
              <div className="w-16 h-16 bg-[#E8F3F2] rounded-full flex items-center justify-center mx-auto mb-3 text-[#5A8A88]">
                <PackageCheck size={32} />
              </div>
              <p className="text-[16px] font-bold text-[#2D4A49]">ไม่มีรายการที่ต้องสั่งซื้อ</p>
              <p className="text-[12px] text-[#6B8F8E] mt-1 max-w-sm mx-auto">
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
                  className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.06)] border border-[#D4E4E3] overflow-hidden"
                >
                  {/* Supplier Group Header */}
                  <div className="bg-[#F0F5F4] border-l-[3px] border-l-[#5A8A88] pl-3 pr-4 py-3 border-b border-[#D4E4E3] flex items-center justify-between">
                    <h4 className="font-bold text-[13px] text-[#2D4A49] flex items-center gap-2">
                      <Building2 size={15} className="text-[#5A8A88]" />
                      <span>ผู้จัดจำหน่าย: {supplier}</span>
                    </h4>
                    <span className="bg-[#E8F3F2] text-[#5A8A88] text-[11px] font-semibold px-2.5 py-0.5 rounded-md border border-[#D4E4E3]">
                      {totalItems} รายการ
                    </span>
                  </div>

                  {/* Table with Horizontal Scroll */}
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[650px]">
                      <thead>
                        <tr className="bg-[#2D4A49] text-white text-[11px] font-semibold border-b border-[#2D4A49]">
                          <th className="py-2.5 px-3 text-center w-[8%] border-r border-[#3d605f]">รูป</th>
                          <th className="py-2.5 px-3 text-left w-[30%] border-r border-[#3d605f]">รายการสินค้า</th>
                          <th className="py-2.5 px-3 text-left w-[14%] border-r border-[#3d605f]">หมวดหมู่</th>
                          <th className="py-2.5 px-3 text-left w-[14%] border-r border-[#3d605f]">ขนาด/หน่วย</th>
                          <th className="py-2.5 px-3 text-center w-[11%] border-r border-[#3d605f]">คงเหลือขั้นต่ำ</th>
                          <th className="py-2.5 px-3 text-center w-[11%] border-r border-[#3d605f]">ยอดตรวจนับ</th>
                          <th className="py-2.5 px-3 text-center w-[12%]">ยอดสั่งแนะนำ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(categories).map(([category, items]) => (
                          <React.Fragment key={category}>
                            {/* Category Row */}
                            <tr className="bg-[#F8FAFA] border-y border-[#F0F5F4]">
                              <td colSpan={7} className="px-3 py-1.5">
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A8A88]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88] shrink-0"></span>
                                  <span>{category}</span>
                                </div>
                              </td>
                            </tr>
                            {/* Items */}
                            {items.map((item, index) => {
                              const isLow = item.currentStock < item.minStock;
                              const isEven = index % 2 === 1;

                              return (
                                <tr 
                                  key={item.id} 
                                  className={cn(
                                    "transition-colors hover:bg-[#E8F3F2]/60 border-b border-[#F0F5F4]",
                                    isEven ? "bg-[#F8FAFA]" : "bg-[#FFFFFF]"
                                  )}
                                >
                                  {/* Item Image */}
                                  <td className="p-2 border-r border-[#F0F5F4] text-center w-[8%]">
                                    {item.image ? (
                                      <img 
                                        src={item.image} 
                                        alt={item.name} 
                                        className="w-9 h-9 object-cover rounded-md border border-[#D4E4E3] mx-auto shadow-xs"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-md border border-[#D4E4E3] bg-[#F8FAFA] flex items-center justify-center mx-auto text-[#6B8F8E]">
                                        <ShoppingCart size={14} />
                                      </div>
                                    )}
                                  </td>

                                  {/* Item Name & Subtitle */}
                                  <td className="px-3 py-2.5 border-r border-[#F0F5F4] w-[30%]">
                                    <div className="font-medium text-[#2D4A49] text-[12px] leading-tight" title={item.name}>
                                      {item.name}
                                    </div>
                                    {item.brand && (
                                      <div className="text-[10px] text-[#6B8F8E] mt-0.5">
                                        ยี่ห้อ: {item.brand}
                                      </div>
                                    )}
                                  </td>

                                  {/* Category Badge */}
                                  <td className="px-3 py-2.5 border-r border-[#F0F5F4] w-[14%]">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8F3F2] text-[#5A8A88]">
                                      {item.category}
                                    </span>
                                  </td>

                                  {/* Size / Unit */}
                                  <td className="px-3 py-2.5 border-r border-[#F0F5F4] text-[11px] text-[#6B8F8E] w-[14%]">
                                    {item.sizePerUnit || '-'}
                                  </td>

                                  {/* Min Stock (คงเหลือขั้นต่ำ) */}
                                  <td className="px-3 py-2.5 border-r border-[#F0F5F4] text-center w-[11%]">
                                    {isLow ? (
                                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#FEE2E2] text-[#EF4444] font-bold text-[12px] font-mono">
                                        {item.minStock} {item.unit}
                                      </span>
                                    ) : (
                                      <span className="text-[#2D4A49] font-mono text-[12px]">
                                        {item.minStock} {item.unit}
                                      </span>
                                    )}
                                  </td>

                                  {/* Current Stock (ยอดตรวจนับ) */}
                                  <td className="px-3 py-2.5 border-r border-[#F0F5F4] font-mono text-[12px] text-center text-[#6B8F8E] w-[11%]">
                                    {item.currentStock} {item.unit}
                                  </td>

                                  {/* Suggested Order (ยอดสั่งแนะนำ) */}
                                  <td className="px-3 py-2.5 font-mono text-[12px] text-center w-[12%]">
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-[#E8F3F2] text-[#5A8A88] font-bold text-[12px]">
                                      {item.suggestedOrder} {item.unit}
                                    </span>
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
            <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] p-5 sm:p-6 print:hidden">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-[14px] font-bold text-[#2D4A49]">สรุปภาพรวมการสั่งซื้อ</h4>
                  <p className="text-[11px] text-[#6B8F8E] mt-0.5">ประจำวันที่ {format(new Date(selectedDate), 'dd/MM/yyyy')}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center sm:text-right">
                    <div className="text-[10px] font-bold text-[#6B8F8E] uppercase">จำนวนรายการทั้งหมด</div>
                    <div className="text-[20px] font-black text-[#5A8A88]">{purchasesToMake.length} รายการ</div>
                  </div>
                  <div className="w-[1px] h-8 bg-[#D4E4E3]" />
                  <div className="text-center sm:text-right">
                    <div className="text-[10px] font-bold text-[#6B8F8E] uppercase">ผู้จัดจำหน่าย</div>
                    <div className="text-[20px] font-black text-[#2D4A49]">{Object.keys(groupedPurchases).length} ราย</div>
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
