import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Ingredient, ReceivingRecord } from '../types';
import { format } from 'date-fns';
import { Calendar, Package, Save, Trash2, RotateCcw, Plus, Search, ChevronDown, AlertCircle, ClipboardList, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface BarReceivingProps {
  ingredients: Ingredient[];
  receivingRecords: ReceivingRecord[];
  onAddRecord: (record: Omit<ReceivingRecord, 'id'>) => void;
  onDeleteRecord: (id: string) => void;
  isReadOnly?: boolean;
  department?: 'Bar' | 'Bakery';
}

type RowData = {
  id: string;
  ingredientId: string;
  supplier: string;
  quantity: string;
  expiryDate: string;
};

function SearchableIngredientSelect({ 
  value, 
  onChange, 
  ingredients, 
  disabled 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  ingredients: Ingredient[]; 
  disabled?: boolean 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIngredient = ingredients.find(ing => ing.id === value);
  const displayValue = selectedIngredient ? `${selectedIngredient.name} ${selectedIngredient.brand ? `(${selectedIngredient.brand})` : ''}` : '-- เลือกรายการ --';

  const filtered = ingredients.filter(ing => 
    ing.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (ing.brand && ing.brand.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className={cn(
          "w-full px-3 py-2 border border-[#D4E4E3] rounded-lg outline-none text-[12px] bg-white flex justify-between items-center cursor-pointer transition-colors shadow-xs",
          disabled ? "opacity-50 bg-[#F0F5F4] cursor-not-allowed" : "focus-within:border-[#5A8A88] focus-within:ring-2 focus-within:ring-[#5A8A88]/15 hover:border-[#5A8A88] hover:bg-[#F8FAF9]"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={cn("truncate mr-2", value ? "text-[#2D4A49] font-medium" : "text-[#7A9E9C]")}>
          {displayValue}
        </span>
        <ChevronDown size={14} className="text-[#7A9E9C] shrink-0" />
      </div>
      
      {isOpen && (
        <div className="absolute z-[60] w-full min-w-[260px] mt-1 bg-white border border-[#D4E4E3] rounded-xl shadow-xl max-h-[300px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-[#D4E4E3] bg-[#F8FAF9] sticky top-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[#5A8A88]" />
              <input
                type="text"
                className="w-full pl-8 pr-3 py-1.5 border border-[#D4E4E3] rounded-lg text-[12px] text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:ring-1 focus:ring-[#5A8A88] bg-white shadow-xs"
                placeholder="พิมพ์เพื่อค้นหารายการ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-y-auto w-full custom-scrollbar">
            <div
              className={cn(
                "px-3 py-2 text-[12px] cursor-pointer hover:bg-[#F0F5F4] transition-colors border-b border-[#D4E4E3]",
                !value ? "bg-[#E8F3F2] text-[#5A8A88] font-semibold" : "text-[#6B8F8E]"
              )}
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchTerm('');
              }}
            >
              -- ยกเลิกการเลือก --
            </div>
            {filtered.length > 0 ? filtered.map(ing => (
              <div
                key={ing.id}
                className={cn(
                  "px-3 py-2 text-[12px] cursor-pointer hover:bg-[#F0F5F4] transition-colors flex flex-col gap-0.5 border-b border-[#F0F5F4] last:border-b-0",
                  value === ing.id ? "bg-[#E8F3F2] text-[#5A8A88] font-semibold" : "text-[#2D4A49]"
                )}
                onClick={() => {
                  onChange(ing.id);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
              >
                <span className="font-medium">{ing.name}</span>
                {ing.brand && <span className={cn("text-[10px]", value === ing.id ? "text-[#5A8A88]" : "text-[#6B8F8E]")}>แบรนด์: {ing.brand}</span>}
              </div>
            )) : (
              <div className="px-3 py-6 text-center text-[#6B8F8E] text-[12px] flex flex-col items-center gap-2 bg-[#F8FAF9]">
                <Search size={18} className="text-[#7A9E9C]" />
                <span>ไม่พบรายการ "{searchTerm}"</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BarReceiving({ ingredients, receivingRecords, onAddRecord, onDeleteRecord, isReadOnly = false, department = 'Bar' }: BarReceivingProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const createEmptyRow = (): RowData => ({
    id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
    ingredientId: '',
    supplier: '',
    quantity: '',
    expiryDate: ''
  });

  const [rows, setRows] = useState<RowData[]>(Array.from({ length: 10 }, createEmptyRow));
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Filter ingredients for department
  const filteredIngredients = ingredients.filter(ing => ing.department === department || (!ing.department && department === 'Bar'));
  
  // Get unique suppliers from filtered ingredients
  const suppliers = Array.from(new Set(filteredIngredients.map(ing => ing.supplier).filter(Boolean))).sort();

  // Filter receiving records for department
  const departmentRecords = useMemo(() => {
    return (receivingRecords || [])
      .filter(record => {
        const ing = ingredients.find(i => i.id === record.ingredientId);
        if (!ing) return false;
        return department === 'Bar' ? (ing.department === 'Bar' || !ing.department) : ing.department === 'Bakery';
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [receivingRecords, ingredients, department]);

  const handleRowChange = (id: string, field: keyof RowData, value: string) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        const updatedRow = { ...row, [field]: value };
        // Auto-select supplier if ingredient is selected
        if (field === 'ingredientId' && value) {
          const ing = filteredIngredients.find(i => i.id === value);
          if (ing && ing.supplier) {
            updatedRow.supplier = ing.supplier;
          }
        }
        return updatedRow;
      }
      return row;
    }));
  };

  const addMoreRows = () => {
    setRows(prev => [...prev, ...Array.from({ length: 5 }, createEmptyRow)]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(row => row.id !== id));
    }
  };

  const clearForm = () => {
    setRows(Array.from({ length: 10 }, createEmptyRow));
  };

  const isValidRow = (row: RowData) => {
    return row.ingredientId && row.supplier && row.quantity && parseInt(row.quantity) > 0;
  };

  const validRows = rows.filter(isValidRow);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || validRows.length === 0) {
      alert('กรุณากรอกข้อมูลให้ครบอย่างน้อย 1 รายการ');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    // Only process valid rows
    validRows.forEach(row => {
      onAddRecord({
        date,
        ingredientId: row.ingredientId,
        supplier: row.supplier,
        quantity: Number(row.quantity),
        expiryDate: row.expiryDate
      });
    });

    clearForm();
    setShowConfirmModal(false);
  };

  const getIngredientUnit = (id: string) => {
    const ing = ingredients.find(i => i.id === id);
    return ing ? ing.unit : '';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── PAGE HEADER & ENTRY FORM ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-5 sm:p-6 shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
        <div className="flex items-center gap-3.5 mb-5">
          <div className="bg-[#E8F3F2] rounded-xl p-2.5 text-[#5A8A88] flex items-center justify-center shrink-0">
            <Package size={20} className="text-[#5A8A88]" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-[#2D4A49] leading-tight">
              บันทึกรับวัตถุดิบประจำวัน ({department === 'Bar' ? 'บาร์' : 'ครัว'})
            </h2>
            <p className="text-[11px] text-[#6B8F8E] mt-0.5">
              บันทึกการตรวจรับวัตถุดิบเข้าสต็อกร้านประจำวันเพื่อความถูกต้องของยอดคงเหลือ
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── DATE PICKER ───────────────────────── */}
          <div>
            <label className="block text-[12px] font-medium text-[#6B8F8E] mb-1.5">
              วันที่รับวัตถุดิบ
            </label>
            <div className="relative w-fit min-w-[200px]">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Calendar size={14} className="text-[#5A8A88]" />
              </div>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#D4E4E3] rounded-lg text-[13px] text-[#2D4A49] font-mono focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/15 shadow-xs transition-all"
              />
            </div>
          </div>

          {/* ── DATA ENTRY TABLE ──────────────────── */}
          <div className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-[0_2px_8px_rgba(90,138,136,0.06)]">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full min-w-[680px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#2D4A49] text-white text-[11px] font-semibold py-2.5 px-3">
                    <th className="py-2.5 px-2 text-center w-[40px]">#</th>
                    <th className="py-2.5 px-3 flex-1 min-w-[220px]">รายการวัตถุดิบ</th>
                    <th className="py-2.5 px-3 w-[160px] min-w-[160px]">ผู้จัดจำหน่าย</th>
                    <th className="py-2.5 px-3 text-center w-[100px] min-w-[100px]">จำนวนที่รับ</th>
                    <th className="py-2.5 px-3 text-center w-[140px] min-w-[140px]">วันหมดอายุ</th>
                    <th className="py-2.5 px-2 text-center w-[48px]">ลบ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr 
                      key={row.id} 
                      className="odd:bg-white even:bg-[#F8FAF9] hover:bg-[#E8F3F2]/60 transition-colors border-b border-[#F0F5F4]"
                    >
                      {/* Row number badge */}
                      <td className="py-2.5 px-2 text-center">
                        <span className="w-6 h-6 rounded-md bg-[#E8F3F2] text-[#5A8A88] text-[11px] font-semibold flex items-center justify-center mx-auto">
                          {index + 1}
                        </span>
                      </td>

                      {/* Dropdown -- เลือกรายการ -- */}
                      <td className="py-2 px-3 relative">
                        <SearchableIngredientSelect
                          value={row.ingredientId}
                          onChange={(val) => handleRowChange(row.id, 'ingredientId', val)}
                          ingredients={filteredIngredients}
                          disabled={isReadOnly}
                        />
                      </td>

                      {/* Dropdown -- ผู้จัดจำหน่าย -- */}
                      <td className="py-2 px-3">
                        <div className="relative">
                          <select
                            value={row.supplier}
                            onChange={(e) => handleRowChange(row.id, 'supplier', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D4E4E3] rounded-lg text-[12px] text-[#2D4A49] bg-white focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/15 disabled:opacity-50 disabled:bg-[#F0F5F4] transition-all shadow-xs"
                            disabled={isReadOnly}
                          >
                            <option value="" className="text-[#7A9E9C]">-- ผู้จัดจำหน่าย --</option>
                            {suppliers.map(sup => (
                              <option key={sup} value={sup}>{sup}</option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Number input จำน. */}
                      <td className="py-2 px-3">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(row.id, 'quantity', e.target.value)}
                            className="w-20 px-2.5 py-2 border border-[#D4E4E3] rounded-lg text-center text-[12px] text-[#2D4A49] bg-white focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/15 disabled:opacity-50 disabled:bg-[#F0F5F4] transition-all shadow-xs"
                            placeholder="จำน."
                            disabled={isReadOnly}
                          />
                          {row.ingredientId && (
                            <span className="text-[10px] text-[#6B8F8E] ml-1.5 font-medium shrink-0">
                              {getIngredientUnit(row.ingredientId)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date input dd-mmm-yyyy */}
                      <td className="py-2 px-3">
                        <div className="relative group/date">
                          <div className={cn(
                            "w-[130px] mx-auto px-2.5 py-2 border border-[#D4E4E3] rounded-lg flex items-center justify-between text-[12px] bg-white transition-colors overflow-hidden shadow-xs",
                            isReadOnly ? 'opacity-50 bg-[#F0F5F4] cursor-not-allowed' : 'cursor-pointer group-hover/date:border-[#5A8A88] group-hover/date:bg-[#E8F3F2]/40'
                          )}>
                            <span className={row.expiryDate ? "text-[#2D4A49] font-medium" : "text-[#7A9E9C]"}>
                              {row.expiryDate ? format(new Date(row.expiryDate), 'dd-MMM-yyyy') : 'dd-mmm-yyyy'}
                            </span>
                            <Calendar size={14} className={row.expiryDate ? "text-[#5A8A88] shrink-0" : "text-[#7A9E9C] shrink-0"} />
                          </div>
                          {!isReadOnly && (
                            <input
                              type="date"
                              value={row.expiryDate}
                              onChange={(e) => handleRowChange(row.id, 'expiryDate', e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          )}
                        </div>
                      </td>

                      {/* Delete button (🗑️) */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="p-1.5 text-[#EF4444] hover:bg-[#FEE2E2] rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          disabled={rows.length <= 1 || isReadOnly}
                          title="ลบแถวนี้"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── BOTTOM ACTION AREA ────────────────── */}
          {!isReadOnly && (
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2">
              {/* + เพิ่มรายการ button */}
              <button
                type="button"
                onClick={addMoreRows}
                className="flex items-center justify-center gap-1.5 bg-[#E8F3F2] border border-[#D4E4E3] text-[#5A8A88] text-[12px] font-medium rounded-lg px-4 py-2 hover:bg-[#B8D4D2] transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                <Plus size={14} className="text-[#5A8A88]" />
                <span>+ เพิ่มรายการอีก 5 แถว</span>
              </button>

              <div className="flex gap-2.5 sm:gap-3 w-full sm:w-auto">
                {/* ล้างทั้งหมด button */}
                <button
                  type="button"
                  onClick={clearForm}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#F0F5F4] border border-[#D4E4E3] text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2] px-4 py-2.5 rounded-lg text-[12px] font-medium transition-colors shadow-xs cursor-pointer active:scale-95"
                >
                  <RotateCcw size={15} className="text-[#5A8A88]" />
                  <span>ล้างทั้งหมด</span>
                </button>

                {/* บันทึกข้อมูล / Submit button */}
                <button
                  type="submit"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#2D4A49] hover:bg-[#1D3A39] text-white px-6 py-2.5 rounded-lg text-[13px] font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Save size={15} className="text-white" />
                  <span>บันทึกการรับ</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* ── RECENT RECEIVING HISTORY ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-5 sm:p-6 shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#E8F3F2] rounded-xl p-2.5 text-[#5A8A88] flex items-center justify-center shrink-0">
              <ClipboardList size={20} className="text-[#5A8A88]" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#2D4A49]">
                ประวัติการตรวจรับวัตถุดิบล่าสุด ({department === 'Bar' ? 'บาร์' : 'ครัว'})
              </h3>
              <p className="text-[11px] text-[#6B8F8E]">
                รายการรับเข้าสต็อกที่บันทึกแล้วในระบบ ({departmentRecords.length} รายการ)
              </p>
            </div>
          </div>
        </div>

        {departmentRecords.length === 0 ? (
          <div className="py-8 text-center text-[#6B8F8E] text-[13px] bg-[#F8FAF9] rounded-xl border border-[#D4E4E3]">
            ยังไม่มีรายการบันทึกรับวัตถุดิบสำหรับแผนกนี้
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#D4E4E3]">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#E8F3F2] text-[#2D4A49] text-[11px] font-bold border-b border-[#D4E4E3]">
                  <th className="py-2.5 px-3">วันที่รับ</th>
                  <th className="py-2.5 px-3">รายการวัตถุดิบ</th>
                  <th className="py-2.5 px-3">ผู้จัดจำหน่าย</th>
                  <th className="py-2.5 px-3 text-center">จำนวนที่รับ</th>
                  <th className="py-2.5 px-3 text-center">วันหมดอายุ</th>
                  {!isReadOnly && <th className="py-2.5 px-3 text-center w-[50px]">ลบ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F5F4] text-[12px]">
                {departmentRecords.slice(0, 50).map((record) => {
                  const ing = ingredients.find(i => i.id === record.ingredientId);
                  return (
                    <tr key={record.id} className="hover:bg-[#F8FAF9] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[#6B8F8E]">
                        {format(new Date(record.date), 'dd/MM/yyyy')}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#2D4A49]">
                        {ing?.name || record.ingredientId}
                        {ing?.brand && <span className="text-[10px] text-[#6B8F8E] block font-normal">แบรนด์: {ing.brand}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-[#6B8F8E]">{record.supplier}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#5A8A88]">
                        {record.quantity} {ing?.unit || ''}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[#6B8F8E] font-mono">
                        {record.expiryDate ? format(new Date(record.expiryDate), 'dd-MMM-yyyy') : '-'}
                      </td>
                      {!isReadOnly && (
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setItemToDelete(record.id)}
                            className="p-1 text-[#EF4444] hover:bg-[#FEE2E2] rounded-md transition-colors cursor-pointer"
                            title="ลบรายการนี้"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" onClick={() => setShowConfirmModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center border border-[#D4E4E3] transform transition-all animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-[#E8F3F2] text-[#5A8A88] rounded-full flex items-center justify-center mx-auto mb-3.5">
              <Package size={28} />
            </div>
            <h3 className="text-[16px] font-bold text-[#2D4A49] mb-1.5">ยืนยันการบันทึกรับวัตถุดิบ</h3>
            <p className="text-[#6B8F8E] text-[13px] mb-5">
              คุณกำลังจะบันทึกการรับวัตถุดิบจำนวน <span className="font-bold text-[#5A8A88]">{validRows.length}</span> รายการ
            </p>
            <div className="flex gap-2.5 justify-center">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-[#6B8F8E] hover:text-[#2D4A49] bg-[#F0F5F4] hover:bg-[#E2EAE9] transition-colors border border-[#D4E4E3] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-white bg-[#2D4A49] hover:bg-[#1D3A39] transition-colors shadow-xs cursor-pointer"
              >
                ยืนยันบันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" onClick={() => setItemToDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center border border-[#D4E4E3] transform transition-all animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-[#FEE2E2] text-[#EF4444] rounded-full flex items-center justify-center mx-auto mb-3.5">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-[16px] font-bold text-[#2D4A49] mb-1.5">ยืนยันการลบรายการ</h3>
            <p className="text-[#6B8F8E] text-[13px] mb-5">
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการรับวัตถุดิบนี้? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-2.5 justify-center">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-[#6B8F8E] hover:text-[#2D4A49] bg-[#F0F5F4] hover:bg-[#E2EAE9] transition-colors border border-[#D4E4E3] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRecord(itemToDelete);
                  setItemToDelete(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] transition-colors shadow-xs cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
