import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, Calendar, FileDown, Printer, ShoppingCart, Coffee, ChefHat, LayoutGrid } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Ingredient, StockRecord } from '../types';
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

  const purchasesToMake = useMemo(() => {
    // Filter ingredients by department first
    const allowedIngs = ingredients.filter(ing => allowedDepartments.includes(ing.department as any));
    const departmentIngredients = activeDepartment === 'All' 
      ? allowedIngs 
      : allowedIngs.filter(ing => ing.department === activeDepartment);

    // Calculate the most up-to-date stock up to the selectedDate
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
          const inVal = val.in === null || val.in === undefined ? undefined : val.in;
          const outVal = val.out === null || val.out === undefined ? undefined : val.out;
          const explicitRemaining = val.remaining === null || val.remaining === undefined ? undefined : val.remaining;

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
          suggestedOrder: item.minOrder || 1,
        });
      }
    });

    // Sort by category then supplier
    return toBuy.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.supplier !== b.supplier) return a.supplier.localeCompare(b.supplier);
      return a.name.localeCompare(b.name);
    });
  }, [ingredients, stockRecord, selectedDate, activeDepartment, allowedDepartments]);

  const exportExcel = () => {
    const data = purchasesToMake.map(item => ({
      'หมวดหมู่': item.category,
      'รายการสินค้า': item.name,
      'ผู้จัดจำหน่าย': item.supplier,
      'ขนาด/หน่วย': item.sizePerUnit,
      'คงเหลือขั้นต่ำ': item.minStock,
      'ยอดที่ตรวจนับได้': item.currentStock,
      'จำนวนที่ต้องสั่งซื้อ': item.suggestedOrder,
      'หน่วย': item.unit,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchasing");
    XLSX.writeFile(wb, `Purchasing_${selectedDate}.xlsx`);
  };

  const printReport = async () => {
    const element = document.getElementById('purchasing-report-content');
    if (!element) return;
    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      const imgData = await toPng(element, {
        backgroundColor: '#ffffff',
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
      console.error('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF โปรดลองอีกครั้ง');
    }
  };

  const groupedPurchases = useMemo(() => {
    const groups: Record<string, Record<string, typeof purchasesToMake>> = {};
    purchasesToMake.forEach(item => {
      if (!groups[item.supplier]) {
        groups[item.supplier] = {};
      }
      if (!groups[item.supplier][item.category]) {
        groups[item.supplier][item.category] = [];
      }
      groups[item.supplier][item.category].push(item);
    });
    return groups;
  }, [purchasesToMake]);

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 sm:p-3 hover:bg-slate-200 text-slate-500 rounded-xl transition-all shadow-sm hover:shadow bg-white border border-slate-200"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
              <ShoppingCart className="text-orange-500" size={24} />
              สรุปยอดสั่งซื้อวัตถุดิบ (Purchasing)
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              อ้างอิงจากรายการตรวจนับสต็อกประจำวัน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
          <div className="flex bg-slate-200/50 p-1.5 rounded-xl border border-slate-200 shadow-sm gap-1 min-w-max">
            {(['All', 'Bar', 'Bakery'] as DepartmentFilter[])
            .filter(dept => dept === 'All' ? allowedDepartments.length === 2 : allowedDepartments.includes(dept as any))
            .map((dept) => {
              const isActive = activeDepartment === dept;
              const Icon = dept === 'All' ? LayoutGrid : dept === 'Bar' ? Coffee : ChefHat;
              const bgActive = dept === 'All' ? 'bg-blue-600' : dept === 'Bar' ? 'bg-rose-500' : 'bg-amber-500';
              const textActive = 'text-white';
              
              return (
                <button
                  key={dept}
                  onClick={() => setActiveDepartment(dept)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all",
                    isActive 
                      ? `${bgActive} ${textActive} shadow cursor-default`
                      : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                  )}
                >
                  <Icon size={16} />
                  <span>{dept === 'All' ? 'ทั้งหมด' : dept === 'Bar' ? 'บาร์' : 'ครัว'}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm min-w-max h-[42px]">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="date" 
              className="bg-transparent border-none focus:outline-none text-sm font-bold text-slate-700 w-[130px]"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          
          <button
            onClick={exportExcel}
            disabled={purchasesToMake.length === 0}
            className="flex items-center gap-2 px-4 py-2 h-[42px] bg-emerald-50 text-emerald-600 font-bold rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-200 disabled:opacity-50 min-w-max"
          >
            <FileDown size={18} />
            Excel
          </button>

          <button
            onClick={printReport}
            disabled={purchasesToMake.length === 0}
            className="flex items-center gap-2 px-4 py-2 h-[42px] bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors border border-blue-200 disabled:opacity-50 min-w-max"
          >
            <Printer size={18} />
            PDF
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/30 custom-scrollbar" id="purchasing-report-content">
        <div className="max-w-[1000px] mx-auto space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center print:hidden">
            <div>
              <h3 className="text-lg font-bold text-slate-800">รายการที่ต้องสั่งซื้อ</h3>
              <p className="text-sm text-slate-500 mt-1">ประจำวันที่ {format(new Date(selectedDate), 'dd/MM/yyyy')}</p>
            </div>
            <div className="bg-orange-50 text-orange-600 px-4 py-2 rounded-xl border border-orange-100 font-bold">
              ทั้งหมด {purchasesToMake.length} รายการ
            </div>
          </div>

          {purchasesToMake.length > 0 && (
            <div className="text-[12.5px] font-bold text-blue-700 bg-blue-50/80 px-3.5 py-2.5 rounded-xl border border-blue-100/75 flex items-center justify-between gap-2 shadow-sm animate-pulse-slow print:hidden">
              <span className="flex items-center gap-1.5 leading-tight">
                📱 สำหรับระบบแท็บเล็ต (Tablet): เลื่อนหรือปัดนิ้วไปทางซ้าย-ขวาบนตารางสั่งซื้อ เพื่อดูข้อมูล ยอดตรวจนับ และจำนวนแนะนำได้ครบถ้วน
              </span>
              <span className="text-[11px] text-blue-600 font-bold bg-white px-2 py-0.5 rounded-md border border-blue-200 shrink-0 hidden sm:inline">
                Swipe Left/Right ↔️
              </span>
            </div>
          )}

          <div className="hidden print:block text-center mb-8">
            <h1 className="text-2xl font-black text-slate-800">สรุปยอดสั่งซื้อวัตถุดิบ (Purchasing)</h1>
            <p className="text-slate-500 mt-2">ประจำวันที่ {format(new Date(selectedDate), 'dd/MM/yyyy')}</p>
          </div>

          {purchasesToMake.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
              <ShoppingCart size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-bold text-slate-500">ไม่มีรายการที่ต้องสั่งซื้อ</p>
              <p className="text-sm mt-2">ยอดคงเหลือของทุกรายการอยู่ในเกณฑ์ปกติ หรือยังไม่มีการบันทึกตรวจนับ</p>
            </div>
          ) : (
            Object.entries(groupedPurchases).map(([supplier, categories]) => {
              const totalItems = Object.values(categories).reduce((acc, items) => acc + items.length, 0);
              
              return (
              <div key={supplier} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="bg-slate-800 p-4 text-white">
                  <h4 className="font-bold text-lg flex items-center gap-2">
                    ผู้จัดจำหน่าย: {supplier}
                    <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full ml-auto">
                      {totalItems} รายการ
                    </span>
                  </h4>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-50 px-4 py-3 text-center font-medium tracking-wide w-[70px] min-w-[70px] max-w-[70px] bg-slate-100 border-r border-b border-slate-200 text-[12px] text-slate-600">รูป</th>
                        <th className="sticky left-[70px] z-50 px-4 py-3 text-left font-medium tracking-wide w-[200px] min-w-[200px] max-w-[200px] bg-slate-100 border-r border-b border-slate-200 text-[12px] text-slate-600">รายการสินค้า</th>
                        <th className="px-4 py-3 text-left font-medium tracking-wide w-[100px] min-w-[100px] max-w-[100px] bg-slate-100 border-r border-b border-slate-200 text-[12px] text-slate-600">ยี่ห้อ</th>
                        <th className="px-4 py-3 text-left font-medium tracking-wide w-[120px] min-w-[120px] max-w-[120px] bg-slate-100 border-r border-b border-slate-200 text-[12px] text-slate-600">ขนาด/หน่วย</th>
                        <th className="px-2 py-3 text-center font-medium tracking-wide w-[90px] min-w-[90px] max-w-[90px] bg-slate-100 border-r border-b border-slate-200 text-[12px] text-slate-600 leading-tight">คงเหลือ<br/>ขั้นต่ำ</th>
                        <th className="px-2 py-3 text-center font-medium tracking-wide w-[90px] min-w-[90px] max-w-[90px] bg-slate-100 border-r border-b border-slate-200 text-[12px] text-slate-600 leading-tight">ยอดตรวจนับ</th>
                        <th className="px-2 py-3 text-center font-bold tracking-wide w-[120px] min-w-[120px] max-w-[120px] bg-orange-50 text-orange-600 border-b border-slate-200 text-[13px]">จำนวนสั่งซื้อ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(categories).map(([category, items]) => (
                        <React.Fragment key={category}>
                          <tr className="bg-slate-50 border-y border-slate-200">
                            <td colSpan={7} className="p-0">
                              <div className="sticky left-0 w-fit p-3 pl-4 font-bold text-[13px] text-slate-700 flex items-center gap-2 bg-slate-50 z-20">
                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                {category}
                              </div>
                            </td>
                          </tr>
                          {items.map((item, index) => (
                            <tr key={item.id} className={cn(
                              "hover:bg-slate-50/80 transition-colors group",
                              index !== items.length - 1 ? 'border-b border-slate-100' : ''
                            )}>
                              <td className="sticky left-0 z-40 p-2 border-r border-slate-100 bg-white group-hover:bg-slate-50/80 transition-colors w-[70px] min-w-[70px] max-w-[70px] text-center">
                                {item.image ? (
                                  <img 
                                    src={item.image} 
                                    alt={item.name} 
                                    className="w-10 h-10 object-cover rounded-md border border-slate-200 mx-auto shadow-sm"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center mx-auto">
                                    <ShoppingCart className="w-4 h-4 text-slate-300" />
                                  </div>
                                )}
                              </td>
                              <td className="sticky left-[70px] z-40 px-4 py-2 border-r border-slate-100 bg-white group-hover:bg-slate-50/80 transition-colors w-[200px] min-w-[200px] max-w-[200px]">
                                <div className="font-bold text-slate-800 text-[13px] leading-tight line-clamp-2" title={item.name}>
                                  {item.name}
                                </div>
                              </td>
                              <td className="px-4 py-2 w-[100px] min-w-[100px] max-w-[100px] border-r border-slate-100">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 truncate max-w-full" title={item.brand}>
                                  {item.brand}
                                </span>
                              </td>
                              <td className="px-4 py-2 w-[120px] min-w-[120px] max-w-[120px] border-r border-slate-100 text-[12px] text-slate-600">
                                <span className="line-clamp-2" title={item.sizePerUnit}>
                                  {item.sizePerUnit}
                                </span>
                              </td>
                              <td className="px-2 py-2 w-[90px] min-w-[90px] max-w-[90px] border-r border-slate-100 font-mono text-[12px] text-center text-slate-600">
                                {item.minStock} {item.unit}
                              </td>
                              <td className="px-2 py-2 w-[90px] min-w-[90px] max-w-[90px] border-r border-slate-100 font-mono text-[12px] text-center text-red-500 font-bold bg-red-50/30">
                                {item.currentStock} {item.unit}
                              </td>
                              <td className="px-2 py-2 w-[120px] min-w-[120px] max-w-[120px] font-mono text-[13px] text-center text-orange-600 font-bold bg-orange-50/50">
                                {item.suggestedOrder} {item.unit}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )})
          )}
        </div>
      </div>
    </div>
  );
};
