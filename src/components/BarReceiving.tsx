import React, { useState, useRef, useEffect } from 'react';
import { Ingredient, ReceivingRecord } from '../types';
import { format } from 'date-fns';
import { Calendar, Package, Truck, Scale, Save, Trash2, RotateCcw, Plus, Search, ChevronDown } from 'lucide-react';
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
          "w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-[13px] bg-white flex justify-between items-center cursor-pointer",
          disabled ? "opacity-50 bg-slate-100 cursor-not-allowed" : "focus-within:ring-2 focus-within:ring-blue-500 hover:border-blue-400 hover:bg-slate-50 transition-colors"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={cn("truncate mr-2", value ? "text-slate-800" : "text-slate-500")}>
          {displayValue}
        </span>
        <ChevronDown size={14} className="text-slate-500 shrink-0" />
      </div>
      
      {isOpen && (
        <div className="absolute z-[50] w-full min-w-[250px] mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[300px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white shadow-sm"
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
                "px-3 py-2 text-[13px] cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50",
                !value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600"
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
                  "px-3 py-2.5 text-[13px] cursor-pointer hover:bg-slate-50 transition-colors flex flex-col gap-0.5",
                  value === ing.id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"
                )}
                onClick={() => {
                  onChange(ing.id);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
              >
                <span>{ing.name}</span>
                {ing.brand && <span className={cn("text-[11px]", value === ing.id ? "text-blue-500" : "text-slate-400")}>แบรนด์: {ing.brand}</span>}
              </div>
            )) : (
              <div className="px-3 py-6 text-center text-slate-500 text-[13px] flex flex-col items-center gap-2 bg-slate-50/50">
                <Search size={20} className="text-slate-300" />
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

  const getIngredientName = (id: string) => {
    const ing = ingredients.find(i => i.id === id);
    return ing ? ing.name : 'Unknown';
  };

  const getIngredientUnit = (id: string) => {
    const ing = ingredients.find(i => i.id === id);
    return ing ? ing.unit : '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
        <h2 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Package className="text-blue-600" size={24} />
          บันทึกรับวัตถุดิบประจำวัน ({department === 'Bar' ? 'บาร์' : 'ครัว'})
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-w-xs mb-6">
            <label className="block text-[13px] font-medium text-slate-700 mb-1">วันที่รับวัตถุดิบ</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={16} className="text-slate-400" />
              </div>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-[13px]"
              />
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-t border-slate-200 text-[12px] text-slate-600">
                  <th className="p-2 font-semibold text-center w-[40px]">#</th>
                  <th className="p-2 font-semibold min-w-[200px]">รายการวัตถุดิบ</th>
                  <th className="p-2 font-semibold min-w-[150px] w-1/4">ผู้จัดจำหน่าย</th>
                  <th className="p-2 font-semibold min-w-[100px] w-[15%]">จำนวนที่รับ</th>
                  <th className="p-2 font-semibold min-w-[130px] w-[20%]">วันหมดอายุ</th>
                  <th className="p-2 font-semibold text-center w-[40px]">ลบ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-2 text-center text-slate-400 text-[12px]">{index + 1}</td>
                    <td className="p-2 relative">
                      <SearchableIngredientSelect
                        value={row.ingredientId}
                        onChange={(val) => handleRowChange(row.id, 'ingredientId', val)}
                        ingredients={filteredIngredients}
                        disabled={isReadOnly}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={row.supplier}
                        onChange={(e) => handleRowChange(row.id, 'supplier', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-[13px] bg-white disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        disabled={isReadOnly}
                      >
                        <option value="">-- ผู้จัดจำหน่าย --</option>
                        {suppliers.map(sup => (
                          <option key={sup} value={sup}>{sup}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={row.quantity}
                          onChange={(e) => handleRowChange(row.id, 'quantity', e.target.value)}
                          className="w-full pr-10 pl-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-[13px] disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                          placeholder="จำนวน"
                          disabled={isReadOnly}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-slate-500 text-[11px] font-mono">{row.ingredientId ? getIngredientUnit(row.ingredientId) : ''}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="relative group/date">
                        <div className={`w-full px-2 py-2 border border-slate-300 rounded-lg flex items-center justify-between text-[13px] bg-white transition-colors overflow-hidden ${isReadOnly ? 'opacity-50 bg-slate-100 cursor-not-allowed' : 'cursor-pointer group-hover/date:border-blue-400 group-hover/date:bg-blue-50/30'}`}>
                          <span className={row.expiryDate ? "text-slate-800" : "text-slate-400"}>
                            {row.expiryDate ? format(new Date(row.expiryDate), 'dd-MMM-yyyy') : 'dd-mmm-yyyy'}
                          </span>
                          <Calendar size={14} className={row.expiryDate ? "text-blue-500 shrink-0" : "text-slate-400 shrink-0"} />
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
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={rows.length <= 1 || isReadOnly}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isReadOnly && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={addMoreRows}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg text-[13px] font-bold transition-colors"
              >
                <Plus size={16} />
                เพิ่มรายการอีก 5 แถว
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={clearForm}
                  className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-200 transition-colors shadow-sm border border-slate-300"
                >
                  <RotateCcw size={18} />
                  ล้างทั้งหมด
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-[13px] font-bold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Save size={18} />
                  บันทึกการรับ
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowConfirmModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center transform transition-all animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">ยืนยันการบันทึกรับวัตถุดิบ</h3>
            <p className="text-slate-600 text-[14px] mb-6">
              คุณกำลังจะบันทึกการรับวัตถุดิบจำนวน <span className="font-bold text-blue-600">{validRows.length}</span> รายการ
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
              >
                ยืนยันบันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setItemToDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center transform transition-all animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">ยืนยันการลบรายการ</h3>
            <p className="text-slate-600 text-[14px] mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการรับวัตถุดิบนี้? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  onDeleteRecord(itemToDelete);
                  setItemToDelete(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
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

