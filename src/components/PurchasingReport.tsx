import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, Calendar, FileDown, Printer, ShoppingCart, Coffee, ChefHat, LayoutGrid, Building2, PackageCheck } from 'lucide-react';
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
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

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

  const purchasesToMake = useMemo(() => {
    if (selectedSuppliers.length === 0) return allPurchasesToMake;
    return allPurchasesToMake.filter(item => item.supplier && selectedSuppliers.includes(item.supplier));
  }, [allPurchasesToMake, selectedSuppliers]);

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

  return (
    <div className="flex flex-col h-full bg-[#F0F5F4] space-y-5 animate-in fade-in duration-300">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] p-5 sm:p-6 overflow-hidden">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          {/* Left info */}
          <div className="flex items-center gap-3.5">
            <button 
              onClick={onBack}
              title="ย้อนกลับ"
              className="p-2.5 hover:bg-[#E8F3F2] text-[#2D4A49] rounded-xl transition-all shadow-xs bg-white border border-[#D4E4E3] cursor-pointer"
            >
              <ChevronLeft size={20} className="text-[#5A8A88]" />
            </button>
            <div className="w-10 h-10 bg-[#E8F3F2] rounded-xl shrink-0 flex items-center justify-center text-[#5A8A88]">
              <ShoppingCart size={22} className="text-[#5A8A88]" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#2D4A49] flex items-center gap-2 leading-tight">
                สรุปยอดสั่งซื้อวัตถุดิบ (Purchasing)
              </h2>
              <p className="text-[11px] text-[#6B8F8E] font-medium mt-0.5">
                อ้างอิงจากรายการตรวจนับสต็อกประจำวัน
              </p>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
            {/* Dept filter buttons */}
            <div className="flex bg-[#F0F5F4] p-1 rounded-xl border border-[#D4E4E3] shadow-xs gap-1">
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
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer",
                        isActive 
                          ? "bg-[#5A8A88] text-white shadow-xs" 
                          : "text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-white/60"
                      )}
                    >
                      <Icon size={14} />
                      <span>{dept === 'All' ? 'ทั้งหมด' : dept === 'Bar' ? 'บาร์' : 'ครัว'}</span>
                    </button>
                  );
                })}
            </div>

            {/* Date picker */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#D4E4E3] shadow-xs h-[38px]">
              <Calendar size={16} className="text-[#5A8A88]" />
              <input 
                type="date" 
                className="bg-transparent border-none focus:outline-none text-[12px] font-bold text-[#2D4A49] w-[125px] cursor-pointer"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            
            {/* Excel export */}
            <button
              onClick={exportExcel}
              disabled={purchasesToMake.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 h-[38px] bg-[#E8F3F2] text-[#5A8A88] font-bold text-[12px] rounded-xl hover:bg-[#d5ebe9] transition-colors border border-[#B8D4D2] disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <FileDown size={15} />
              <span>Excel</span>
            </button>

            {/* PDF export */}
            <button
              onClick={printReport}
              disabled={purchasesToMake.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 h-[38px] bg-white text-[#2D4A49] font-bold text-[12px] rounded-xl hover:bg-[#F0F5F4] transition-colors border border-[#D4E4E3] disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Printer size={15} className="text-[#5A8A88]" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Supplier Filter Pills */}
        {suppliers.length > 0 && (
          <div className="flex items-center gap-2 w-full overflow-x-auto pt-4 border-t border-[#E2EAE9] mt-4 custom-scrollbar">
            <span className="text-[12px] font-bold text-[#6B8F8E] min-w-max mr-1">ผู้จัดจำหน่าย:</span>
            <div className="flex items-center gap-1.5 flex-nowrap">
              <button
                type="button"
                onClick={() => setSelectedSuppliers([])}
                className={cn(
                  "px-3 py-1 rounded-full text-[12px] font-bold transition-all shrink-0 cursor-pointer",
                  selectedSuppliers.length === 0
                    ? "bg-[#5A8A88] text-white shadow-xs"
                    : "bg-[#F0F5F4] text-[#6B8F8E] border border-[#D4E4E3] hover:text-[#2D4A49]"
                )}
              >
                ทั้งหมด ({allPurchasesToMake.length})
              </button>
              {suppliers.map(sup => {
                const isSelected = selectedSuppliers.includes(sup);
                const count = allPurchasesToMake.filter(i => i.supplier === sup).length;
                return (
                  <button
                    key={sup}
                    type="button"
                    onClick={() => {
                      setSelectedSuppliers(prev => 
                        prev.includes(sup) ? prev.filter(s => s !== sup) : [...prev, sup]
                      );
                    }}
                    className={cn(
                      "px-3 py-1 rounded-full text-[12px] font-medium transition-all shrink-0 cursor-pointer",
                      isSelected
                        ? "bg-[#5A8A88] text-white font-bold shadow-xs"
                        : "bg-[#F0F5F4] text-[#6B8F8E] border border-[#D4E4E3] hover:text-[#2D4A49]"
                    )}
                  >
                    {sup} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto custom-scrollbar" id="purchasing-report-content">
        <div className="space-y-6">
          {/* Status Alert for Tablet */}
          {purchasesToMake.length > 0 && (
            <div className="text-[12px] font-semibold text-[#2D4A49] bg-[#E8F3F2] px-4 py-2.5 rounded-xl border border-[#B8D4D2] flex items-center justify-between gap-2 shadow-xs print:hidden">
              <span className="flex items-center gap-2 leading-tight">
                📱 แนะนำสำหรับ Tablet: เลื่อนตารางไปทางซ้าย-ขวาเพื่อดูข้อมูลยอดคงเหลือ และจำนวนแนะนำสั่งซื้อได้ครบถ้วน
              </span>
              <span className="text-[11px] text-[#5A8A88] font-bold bg-white px-2.5 py-0.5 rounded-md border border-[#D4E4E3] shrink-0 hidden sm:inline">
                ↔️ เลื่อนตาราง ซ้าย-ขวา
              </span>
            </div>
          )}

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
                  className="bg-white rounded-2xl shadow-[0_2px_6px_rgba(90,138,136,0.06)] border border-[#D4E4E3] overflow-hidden"
                >
                  {/* Supplier Card Header */}
                  <div className="bg-[#E8F3F2] px-5 py-3.5 border-b border-[#D4E4E3] flex items-center justify-between">
                    <h4 className="font-bold text-[14px] text-[#2D4A49] flex items-center gap-2">
                      <Building2 size={16} className="text-[#5A8A88]" />
                      <span>ผู้จัดจำหน่าย: {supplier}</span>
                    </h4>
                    <span className="bg-white text-[#5A8A88] text-[11px] font-bold px-3 py-1 rounded-full border border-[#D4E4E3] shadow-xs">
                      {totalItems} รายการ
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[650px]">
                      <thead>
                        <tr className="bg-[#F8FAF9] text-[#6B8F8E] text-[11px] font-bold border-b border-[#E2EAE9]">
                          <th className="py-2.5 px-3 text-center w-[8%] border-r border-[#E2EAE9]">รูป</th>
                          <th className="py-2.5 px-3 text-left w-[30%] border-r border-[#E2EAE9]">รายการสินค้า</th>
                          <th className="py-2.5 px-3 text-left w-[14%] border-r border-[#E2EAE9]">หมวดหมู่</th>
                          <th className="py-2.5 px-3 text-left w-[14%] border-r border-[#E2EAE9]">ขนาด/หน่วย</th>
                          <th className="py-2.5 px-3 text-center w-[11%] border-r border-[#E2EAE9]">คงเหลือขั้นต่ำ</th>
                          <th className="py-2.5 px-3 text-center w-[11%] border-r border-[#E2EAE9]">ยอดตรวจนับ</th>
                          <th className="py-2.5 px-3 text-center w-[12%] bg-[#E8F3F2] text-[#5A8A88]">ยอดสั่งแนะนำ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(categories).map(([category, items]) => (
                          <React.Fragment key={category}>
                            {/* Category divider row */}
                            <tr className="bg-[#F0F5F4]/60 border-y border-[#E2EAE9]">
                              <td colSpan={7} className="px-4 py-1.5">
                                <div className="flex items-center gap-2 text-[11px] font-bold text-[#2D4A49]">
                                  <span className="w-2 h-2 rounded-full bg-[#5A8A88]"></span>
                                  <span>{category}</span>
                                </div>
                              </td>
                            </tr>
                            {/* Items */}
                            {items.map((item, index) => (
                              <tr 
                                key={item.id} 
                                className={cn(
                                  "hover:bg-[#F8FAF9] transition-colors",
                                  index !== items.length - 1 ? 'border-b border-[#E2EAE9]' : ''
                                )}
                              >
                                <td className="p-2 border-r border-[#E2EAE9] text-center w-[8%]">
                                  {item.image ? (
                                    <img 
                                      src={item.image} 
                                      alt={item.name} 
                                      className="w-8 h-8 object-cover rounded-lg border border-[#D4E4E3] mx-auto shadow-xs"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg border border-[#D4E4E3] bg-[#F8FAF9] flex items-center justify-center mx-auto text-[#6B8F8E]">
                                      <ShoppingCart size={14} />
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 border-r border-[#E2EAE9] w-[30%]">
                                  <div className="font-bold text-[#2D4A49] text-[13px] leading-tight" title={item.name}>
                                    {item.name}
                                  </div>
                                  {item.brand && (
                                    <div className="text-[11px] text-[#6B8F8E] mt-0.5">
                                      ยี่ห้อ: {item.brand}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 border-r border-[#E2EAE9] w-[14%]">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8F3F2] text-[#5A8A88]">
                                    {item.category}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 border-r border-[#E2EAE9] text-[12px] text-[#6B8F8E] w-[14%]">
                                  {item.sizePerUnit || '-'}
                                </td>
                                <td className="px-3 py-2.5 border-r border-[#E2EAE9] font-mono text-[12px] text-center text-[#6B8F8E] w-[11%]">
                                  {item.minStock} {item.unit}
                                </td>
                                <td className="px-3 py-2.5 border-r border-[#E2EAE9] font-mono text-[12px] text-center font-bold text-[#EF4444] bg-[#FEF2F2]/50 w-[11%]">
                                  {item.currentStock} {item.unit}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-[12px] text-center w-[12%] bg-[#E8F3F2]/50">
                                  <span className="inline-block px-2.5 py-0.5 rounded-lg bg-[#E8F3F2] text-[#5A8A88] font-bold border border-[#B8D4D2]">
                                    {item.suggestedOrder} {item.unit}
                                  </span>
                                </td>
                              </tr>
                            ))}
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
