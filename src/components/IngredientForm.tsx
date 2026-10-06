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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh] border border-[#D4E4E3]">
        {/* Header */}
        <div className="bg-[#2D4A49] px-4 py-3 flex justify-between items-center shrink-0">
          <div className="text-white">
            <h2 className="text-[12px] font-bold tracking-tight">{initialData ? 'แก้ไขรายการวัตถุดิบ' : 'เพิ่มรายการวัตถุดิบใหม่'}</h2>
            <p className="text-[#D4E4E3] text-[10px] mt-0.5">กรอกข้อมูลรายละเอียดสินค้าให้ครบถ้วน</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="ปิด"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3.5 sm:p-4 overflow-y-auto bg-[#F8FAFA] scrollbar-thin">
          <form id="ingredient-form" onSubmit={handleSubmit} className="space-y-3">
            
            {/* Section 1: Basic Info */}
            <div className="bg-white p-3 rounded-lg border border-[#D4E4E3] shadow-2xs space-y-2.5">
              <h3 className="text-[11px] font-semibold text-[#2D4A49] flex items-center gap-1.5">
                <Package className="text-[#3B82F6]" size={14} />
                ข้อมูลพื้นฐาน
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">รูปภาพสินค้า (Image URL)</label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <input
                        type="url"
                        className="w-full border border-[#D4E4E3] rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all text-[11px] text-[#2D4A49] placeholder:text-[#9BB5B4] bg-white h-[32px]"
                        placeholder="ระบุ URL ของรูปภาพ (เช่น https://...)"
                        value={formData.image || ''}
                        onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      />
                    </div>
                    {formData.image && (
                      <div className="w-8 h-8 rounded-md overflow-hidden border border-[#D4E4E3] bg-[#F0F5F4] shrink-0">
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
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">ชื่อสินค้า (Item Name)</label>
                  <input
                    required
                    type="text"
                    className="w-full border border-[#D4E4E3] rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all text-[11px] text-[#2D4A49] placeholder:text-[#9BB5B4] bg-white h-[32px]"
                    placeholder="เช่น เมล็ดกาแฟ House Blend"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">ยี่ห้อ (Brand)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <Tag className="text-[#5A8A88]" size={13} />
                    </div>
                    <input
                      type="text"
                      className="w-full border border-[#D4E4E3] rounded-md pl-7 pr-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all text-[11px] text-[#2D4A49] placeholder:text-[#9BB5B4] bg-white h-[32px]"
                      placeholder="ระบุยี่ห้อ"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">แผนก (Department)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <Layers className="text-[#5A8A88]" size={13} />
                    </div>
                    <select
                      className="w-full border border-[#D4E4E3] rounded-md pl-7 pr-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all bg-white appearance-none text-[11px] text-[#2D4A49] h-[32px]"
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
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">หมวดหมู่ (Category)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <Layers className="text-[#5A8A88]" size={13} />
                    </div>
                    <select
                      className="w-full border border-[#D4E4E3] rounded-md pl-7 pr-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all bg-white appearance-none text-[11px] text-[#2D4A49] h-[32px]"
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
            <div className="bg-white p-3 rounded-lg border border-[#D4E4E3] shadow-2xs space-y-2.5">
              <h3 className="text-[11px] font-semibold text-[#2D4A49] flex items-center gap-1.5">
                <Scale className="text-[#EA580C]" size={14} />
                ขนาดและหน่วยนับ
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">ขนาดบรรจุ (Size/Unit)</label>
                  <input
                    type="text"
                    className="w-full border border-[#D4E4E3] rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all text-[11px] text-[#2D4A49] placeholder:text-[#9BB5B4] bg-white h-[32px]"
                    placeholder="เช่น 1kg x 1 ถุง"
                    value={formData.sizePerUnit}
                    onChange={(e) => setFormData({ ...formData, sizePerUnit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">หน่วยนับ (Unit)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <Box className="text-[#5A8A88]" size={13} />
                    </div>
                    <input
                      required
                      type="text"
                      className="w-full border border-[#D4E4E3] rounded-md pl-7 pr-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all text-[11px] text-[#2D4A49] placeholder:text-[#9BB5B4] bg-white h-[32px]"
                      placeholder="เช่น ถุง, ขวด, ลัง"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Stock Control */}
            <div className="bg-white p-3 rounded-lg border border-[#D4E4E3] shadow-2xs space-y-2.5">
              <h3 className="text-[11px] font-semibold text-[#2D4A49] flex items-center gap-1.5">
                <AlertTriangle className="text-[#16A34A]" size={14} />
                การควบคุมสต็อก
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">จำนวนคงเหลือขั้นต่ำ</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full border border-[#D4E4E3] rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all font-mono text-[11px] text-[#2D4A49] bg-white h-[32px]"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">จำนวนสั่งซื้อขั้นต่ำ</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full border border-[#D4E4E3] rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all font-mono text-[11px] text-[#2D4A49] bg-white h-[32px]"
                    value={formData.minOrder}
                    onChange={(e) => setFormData({ ...formData, minOrder: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Supplier */}
            <div className="bg-white p-3 rounded-lg border border-[#D4E4E3] shadow-2xs space-y-2.5">
              <h3 className="text-[11px] font-semibold text-[#2D4A49] flex items-center gap-1.5">
                <Truck className="text-[#9333EA]" size={14} />
                ผู้จัดจำหน่าย
              </h3>
              <div className="space-y-2">
                <label className="block text-[10.5px] font-medium text-[#4A6B6A]">ชื่อผู้จัดจำหน่าย (Supplier)</label>
                {suppliers.map((sup, index) => (
                  <div key={index} className="flex gap-1.5 items-center">
                    <input
                      required={index === 0}
                      type="text"
                      className="flex-1 w-full border border-[#D4E4E3] rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all text-[11px] text-[#2D4A49] placeholder:text-[#9BB5B4] bg-white h-[32px]"
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
                      className={`h-[32px] w-[32px] flex items-center justify-center rounded-md transition-colors border shrink-0 cursor-pointer ${
                        primaryIndex === index
                          ? 'bg-amber-50 text-amber-500 border-amber-200 shadow-2xs'
                          : 'text-[#9BB5B4] hover:bg-[#F0F5F4] border-[#D4E4E3] hover:text-amber-500'
                      }`}
                    >
                      <Star size={14} fill={primaryIndex === index ? 'currentColor' : 'none'} />
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
                        className="h-[32px] w-[32px] flex items-center justify-center text-red-500 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-200 shrink-0 cursor-pointer"
                        title="ลบผู้จัดจำหน่าย"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSuppliers([...suppliers, ''])}
                  className="flex items-center gap-1.5 text-[10.5px] font-medium text-[#2D4A49] hover:text-[#162D2C] hover:bg-[#E8F3F2] px-2 py-1 rounded-md transition-colors cursor-pointer w-fit"
                >
                  <Plus size={13} />
                  เพิ่มช่องทางผู้จัดจำหน่าย
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-2.5 border-t border-[#D4E4E3] bg-white flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-[#5A8A88] bg-white border border-[#D4E4E3] rounded-lg hover:bg-[#F0F5F4] font-medium transition-colors text-[11px] h-[32px] cursor-pointer shadow-2xs"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form="ingredient-form"
            className="px-4 py-1.5 bg-[#2D4A49] text-white rounded-lg hover:bg-[#1E3635] font-semibold transition-colors text-[11px] shadow-xs flex items-center gap-1.5 h-[32px] cursor-pointer"
          >
            {initialData ? 'บันทึกการแก้ไข' : 'เพิ่มรายการใหม่'}
          </button>
        </div>
      </div>
    </div>
  );
}
