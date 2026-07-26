import React, { useState } from 'react';
import { Ingredient, BAR_CATEGORIES, BAKERY_CATEGORIES } from '../types';
import { X, Package, Tag, Scale, Layers, AlertTriangle, ShoppingCart, Truck, Box, Plus, Star } from 'lucide-react';

interface IngredientFormProps {
  initialData?: Ingredient;
  defaultDepartment?: 'Bar' | 'Bakery';
  onSubmit: (ingredient: Ingredient) => void;
  onClose: () => void;
}

export function IngredientForm({ initialData, defaultDepartment = 'Bar', onSubmit, onClose }: IngredientFormProps) {
  const initialSuppliers = initialData?.supplier ? initialData.supplier.split(',').map(s => s.trim()) : [''];
  let initialPrimary = 0;
  const cleanedSuppliers = initialSuppliers.map((s, i) => {
    if (s.endsWith(' (หลัก)')) {
      initialPrimary = i;
      return s.replace(' (หลัก)', '');
    }
    return s;
  });

  const [suppliers, setSuppliers] = useState<string[]>(cleanedSuppliers);
  const [primaryIndex, setPrimaryIndex] = useState<number>(initialPrimary);

  const [formData, setFormData] = useState<Omit<Ingredient, 'id'>>(initialData ? {
    name: initialData.name,
    brand: initialData.brand || '',
    sizePerUnit: initialData.sizePerUnit || '',
    category: initialData.category as any,
    minStock: initialData.minStock,
    minOrder: initialData.minOrder,
    supplier: initialData.supplier,
    unit: initialData.unit,
    image: initialData.image || '',
    department: initialData.department || defaultDepartment,
  } : {
    name: '',
    brand: '',
    sizePerUnit: '',
    category: defaultDepartment === 'Bar' ? BAR_CATEGORIES[0] : BAKERY_CATEGORIES[0],
    minStock: 0,
    minOrder: 0,
    supplier: '',
    unit: 'units',
    image: '',
    department: defaultDepartment,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedSuppliers = suppliers.map((s, i) => {
      const trimmed = s.trim();
      if (!trimmed) return null;
      return i === primaryIndex ? `${trimmed} (หลัก)` : trimmed;
    }).filter(Boolean);
    
    onSubmit({
      ...formData,
      supplier: formattedSuppliers.join(', '),
      id: initialData?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-800 p-6 flex justify-between items-center shrink-0">
          <div className="text-white">
            <h2 className="text-[14px] font-bold">{initialData ? 'แก้ไขรายการวัตถุดิบ' : 'เพิ่มรายการวัตถุดิบใหม่'}</h2>
            <p className="text-slate-300 text-[14px] mt-1">กรอกข้อมูลรายละเอียดสินค้าให้ครบถ้วน</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50">
          <form id="ingredient-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section 1: Basic Info */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-[14px] font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Package className="text-blue-500" size={20} />
                ข้อมูลพื้นฐาน
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[14px] font-medium text-slate-700 mb-1">รูปภาพสินค้า (Image URL)</label>
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <input
                        type="url"
                        className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-[14px] text-slate-800"
                        placeholder="ระบุ URL ของรูปภาพ (เช่น https://...)"
                        value={formData.image || ''}
                        onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      />
                    </div>
                    {formData.image && (
                      <div className="w-10 h-10 rounded-md overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                        <img 
                          src={formData.image} 
                          alt="Preview" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                          onError={(e) => e.currentTarget.style.display = 'none'} 
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[14px] font-medium text-slate-700 mb-1">ชื่อสินค้า (Item Name)</label>
                  <input
                    required
                    type="text"
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-[14px] text-slate-800"
                    placeholder="เช่น เมล็ดกาแฟ House Blend"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-slate-700 mb-1">ยี่ห้อ (Brand)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Tag className="text-slate-400" size={18} />
                    </div>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg pl-10 p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800"
                      placeholder="ระบุยี่ห้อ"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-slate-700 mb-1">แผนก (Department)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Layers className="text-slate-400" size={18} />
                    </div>
                    <select
                      className="w-full border border-slate-300 rounded-lg pl-10 p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white appearance-none text-slate-800"
                      value={formData.department}
                      onChange={(e) => {
                        const newDept = e.target.value as 'Bar' | 'Bakery';
                        const newCategory = newDept === 'Bar' ? BAR_CATEGORIES[0] : BAKERY_CATEGORIES[0];
                        setFormData({ ...formData, department: newDept, category: newCategory });
                      }}
                    >
                      <option value="Bar">Bar</option>
                      <option value="Bakery">Bakery</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-slate-700 mb-1">หมวดหมู่ (Category)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Layers className="text-slate-400" size={18} />
                    </div>
                    <select
                      className="w-full border border-slate-300 rounded-lg pl-10 p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white appearance-none text-slate-800"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    >
                      {(formData.department === 'Bar' ? BAR_CATEGORIES : BAKERY_CATEGORIES).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Unit & Size */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-[14px] font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Scale className="text-orange-500" size={20} />
                ขนาดและหน่วยนับ
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-medium text-slate-700 mb-1">ขนาดบรรจุ (Size/Unit)</label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-800"
                    placeholder="เช่น 1kg x 1 ถุง"
                    value={formData.sizePerUnit}
                    onChange={(e) => setFormData({ ...formData, sizePerUnit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-slate-700 mb-1">หน่วยนับ (Unit)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Box className="text-slate-400" size={18} />
                    </div>
                    <input
                      required
                      type="text"
                      className="w-full border border-slate-300 rounded-lg pl-10 p-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-800"
                      placeholder="เช่น ถุง, ขวด, ลัง"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Stock Control */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-[14px] font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="text-green-600" size={20} />
                การควบคุมสต็อก
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-medium text-slate-700 mb-1">จำนวนคงเหลือขั้นต่ำ</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all font-mono text-[14px] text-slate-800"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-slate-700 mb-1">จำนวนสั่งซื้อขั้นต่ำ</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all font-mono text-[14px] text-slate-800"
                    value={formData.minOrder}
                    onChange={(e) => setFormData({ ...formData, minOrder: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Supplier */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-[14px] font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Truck className="text-purple-500" size={20} />
                ผู้จัดจำหน่าย
              </h3>
              <div className="space-y-3">
                <label className="block text-[14px] font-medium text-slate-700 mb-1">ชื่อผู้จัดจำหน่าย (Supplier)</label>
                {suppliers.map((sup, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      required={index === 0}
                      type="text"
                      className="flex-1 w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-slate-800"
                      placeholder="ระบุชื่อร้านค้า หรือ บริษัทคู่ค้า"
                      value={sup}
                      onChange={(e) => {
                        const newSuppliers = [...suppliers];
                        newSuppliers[index] = e.target.value;
                        setSuppliers(newSuppliers);
                      }}
                    />
                    <button
                      type="button"
                      title="ตั้งเป็นผู้จัดจำหน่ายหลัก (Primary)"
                      onClick={() => setPrimaryIndex(index)}
                      className={`p-3 rounded-lg transition-colors border shrink-0 ${
                        primaryIndex === index
                          ? 'bg-amber-50 text-amber-500 border-amber-200'
                          : 'text-slate-400 hover:bg-slate-50 border-transparent hover:text-amber-500'
                      }`}
                    >
                      <Star size={20} fill={primaryIndex === index ? 'currentColor' : 'none'} />
                    </button>
                    {suppliers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newSuppliers = suppliers.filter((_, i) => i !== index);
                          setSuppliers(newSuppliers);
                          if (primaryIndex === index) setPrimaryIndex(0);
                          else if (primaryIndex > index) setPrimaryIndex(primaryIndex - 1);
                        }}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 shrink-0"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSuppliers([...suppliers, ''])}
                  className="flex items-center gap-2 text-[13px] font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition-colors"
                >
                  <Plus size={16} />
                  เพิ่มช่องทางผู้จัดจำหน่าย
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 font-medium transition-colors text-[14px] shadow-sm"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form="ingredient-form"
            className="px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 font-medium transition-colors text-[14px] shadow-md flex items-center gap-2"
          >
            {initialData ? 'บันทึกการแก้ไข' : 'เพิ่มรายการใหม่'}
          </button>
        </div>
      </div>
    </div>
  );
}
