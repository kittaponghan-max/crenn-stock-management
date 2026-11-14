import React, { useState, useEffect } from 'react';
import { Ingredient, BAR_CATEGORIES, BAKERY_CATEGORIES } from '../types';
import { 
  X, 
  Package, 
  Tag, 
  Scale, 
  Layers, 
  AlertTriangle, 
  ShoppingCart, 
  Truck, 
  Box, 
  Plus, 
  Star,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  Settings,
  Calculator
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// หน่วยพื้นฐานตามรูปภาพแนบ + หน่วยบรรจุและนับสต็อกมาตรฐานของคาเฟ่
export const DEFAULT_UNITS: string[] = [
  // 21 หน่วยตามที่ระบุในรูปภาพ:
  'ml',
  'g',
  'แก้ว',
  'หลอด',
  'ชิ้น',
  'อัน',
  'ฟอง',
  'กล่อง',
  'ลูก',
  'สำรับ',
  'ผืน',
  'แท่ง',
  'กิโลกรัม',
  'ลิตร',
  'เสิร์ฟ',
  'ใบ',
  'ก้อน',
  'เส้น',
  'มิลลิลิตร',
  'กรัม',
  'ไม้',
  // หน่วยบรรจุภัณฑ์และนับสต็อกเพิ่มเติมของร้าน:
  'kg',
  'ถุง',
  'ขวด',
  'ลัง',
  'แพ็ค',
  'กระปุก',
  'กระป๋อง',
  'แกลลอน',
  'ถัง',
  'ม้วน',
  'คู่',
  'ซอง',
  'แผง',
  'มัด',
  'units'
];

// ฟังก์ชันแยกขนาดบรรจุเดิมเป็น: จำนวน 1, หน่วย 1, จำนวน 2, หน่วย 2 (เช่น 1 kg / 1 ถุง)
function parseSizePerUnit(rawSize?: string, defaultUnit?: string) {
  if (!rawSize || !rawSize.trim()) {
    return {
      qty1: '1',
      unit1: 'kg',
      qty2: '1',
      unit2: defaultUnit && defaultUnit !== 'units' ? defaultUnit : 'ถุง'
    };
  }

  const s = rawSize.trim();

  // Pattern 1: e.g. "1 kg / 1 ถุง" or "100 g / 2 ซอง"
  const matchTwo = s.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Zก-๙]+)?\s*[\/ต่อ]\s*(\d+(?:\.\d+)?)\s*([a-zA-Zก-๙]+)?$/i);
  if (matchTwo) {
    return {
      qty1: matchTwo[1] || '1',
      unit1: matchTwo[2]?.trim() || 'kg',
      qty2: matchTwo[3] || '1',
      unit2: matchTwo[4]?.trim() || defaultUnit || 'ถุง'
    };
  }

  // Pattern 2: e.g. "1 kg / ถุง"
  const matchOne = s.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Zก-๙]+)?\s*[\/ต่อ]\s*([a-zA-Zก-๙]+)$/i);
  if (matchOne) {
    return {
      qty1: matchOne[1] || '1',
      unit1: matchOne[2]?.trim() || 'kg',
      qty2: '1',
      unit2: matchOne[3]?.trim() || defaultUnit || 'ถุง'
    };
  }

  // Pattern 3: e.g. "1kg x 1 ถุง"
  const matchX = s.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Zก-๙]+)?\s*[xX*]\s*(\d+(?:\.\d+)?)\s*([a-zA-Zก-๙]+)?$/i);
  if (matchX) {
    return {
      qty1: matchX[1] || '1',
      unit1: matchX[2]?.trim() || 'kg',
      qty2: matchX[3] || '1',
      unit2: matchX[4]?.trim() || defaultUnit || 'ถุง'
    };
  }

  // Pattern 4: single quantity + unit e.g. "1 แพ็ค"
  const matchSingle = s.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Zก-๙]+)$/i);
  if (matchSingle) {
    return {
      qty1: matchSingle[1] || '1',
      unit1: matchSingle[2]?.trim() || 'แพ็ค',
      qty2: '1',
      unit2: defaultUnit && defaultUnit !== 'units' ? defaultUnit : matchSingle[2]?.trim() || 'แพ็ค'
    };
  }

  return {
    qty1: '1',
    unit1: s,
    qty2: '1',
    unit2: defaultUnit || 'ถุง'
  };
}

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

  // Read locally cached purchase specs for backward compatibility if DB columns are absent
  const cachedSpec = (() => {
    if (!initialData?.id || typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('cafe-ingredient-purchase-specs');
      if (!raw) return null;
      const map = JSON.parse(raw);
      return map?.[initialData.id] || null;
    } catch {
      return null;
    }
  })();

  // Parse existing sizePerUnit into separate fields
  const parsedSize = parseSizePerUnit(initialData?.sizePerUnit, initialData?.unit);
  const [packQty1, setPackQty1] = useState<string>(
    initialData?.pack_qty_1 !== undefined && initialData.pack_qty_1 !== null
      ? String(initialData.pack_qty_1)
      : parsedSize.qty1
  );
  const [packUnit1, setPackUnit1] = useState<string>(
    initialData?.pack_unit_1 || parsedSize.unit1
  );
  const [packQty2, setPackQty2] = useState<string>(
    initialData?.pack_qty_2 !== undefined && initialData.pack_qty_2 !== null
      ? String(initialData.pack_qty_2)
      : parsedSize.qty2
  );
  const [packUnit2, setPackUnit2] = useState<string>(
    initialData?.pack_unit_2 || parsedSize.unit2
  );

  // Purchase Mode (ปลีก / เหมา), Purchase Unit & Bulk Quantity
  const [purchaseMode, setPurchaseMode] = useState<'retail' | 'bulk'>(
    initialData?.purchase_mode || cachedSpec?.purchase_mode || 'retail'
  );
  const [purchaseUnit, setPurchaseUnit] = useState<string>(
    initialData?.purchase_unit ||
      cachedSpec?.purchase_unit ||
      initialData?.pack_unit_2 ||
      parsedSize.unit2 ||
      initialData?.unit ||
      'ถุง'
  );
  const [bulkPackQty, setBulkPackQty] = useState<string>(
    initialData?.bulk_pack_qty !== undefined && initialData.bulk_pack_qty !== null
      ? String(initialData.bulk_pack_qty)
      : cachedSpec?.bulk_pack_qty !== undefined && cachedSpec?.bulk_pack_qty !== null
      ? String(cachedSpec.bulk_pack_qty)
      : '1'
  );

  // Stock Control Units (หน่วยนับสำหรับ จำนวนคงเหลือขั้นต่ำ และ จำนวนสั่งซื้อขั้นต่ำ)
  const initialMinStockUnit =
    initialData?.min_stock_unit ||
    cachedSpec?.min_stock_unit ||
    initialData?.unit ||
    parsedSize.unit2 ||
    'ถุง';
  const initialMinOrderUnit =
    initialData?.min_order_unit ||
    cachedSpec?.min_order_unit ||
    initialData?.purchase_unit ||
    cachedSpec?.purchase_unit ||
    initialData?.unit ||
    parsedSize.unit2 ||
    'ถุง';
  const [minStockUnit, setMinStockUnit] = useState<string>(initialMinStockUnit);
  const [minOrderUnit, setMinOrderUnit] = useState<string>(initialMinOrderUnit);
  const [minStockUnitCustom, setMinStockUnitCustom] = useState<boolean>(
    Boolean(initialData?.min_stock_unit || cachedSpec?.min_stock_unit)
  );
  const [minOrderUnitCustom, setMinOrderUnitCustom] = useState<boolean>(
    Boolean(initialData?.min_order_unit || cachedSpec?.min_order_unit)
  );

  // Units list state with localStorage & Supabase persistence
  const [availableUnits, setAvailableUnits] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cafe-ingredient-units');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...DEFAULT_UNITS, ...parsed]));
        }
      }
    } catch {}
    return DEFAULT_UNITS;
  });

  // Load custom units & purchase specs from Supabase if available
  useEffect(() => {
    if (!supabase) return;
    const fetchUnits = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'ingredient_units')
          .limit(1)
          .maybeSingle();
        if (data?.setting_value && Array.isArray(data.setting_value)) {
          setAvailableUnits(prev => Array.from(new Set([...DEFAULT_UNITS, ...data.setting_value, ...prev])));
        }
      } catch {}
    };
    const fetchPurchaseSpec = async () => {
      if (!initialData?.id || initialData.purchase_mode) return;
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'ingredient_purchase_specs')
          .limit(1)
          .maybeSingle();
        const spec = data?.setting_value?.[initialData.id];
        if (spec) {
          if (spec.purchase_mode === 'retail' || spec.purchase_mode === 'bulk') {
            setPurchaseMode(spec.purchase_mode);
          }
          if (spec.purchase_unit) setPurchaseUnit(spec.purchase_unit);
          if (spec.bulk_pack_qty !== undefined && spec.bulk_pack_qty !== null) {
            setBulkPackQty(String(spec.bulk_pack_qty));
          }
          if (spec.min_stock_unit) {
            setMinStockUnit(spec.min_stock_unit);
            setMinStockUnitCustom(true);
          }
          if (spec.min_order_unit) {
            setMinOrderUnit(spec.min_order_unit);
            setMinOrderUnitCustom(true);
          }
        }
      } catch {}
    };
    fetchUnits();
    fetchPurchaseSpec();
  }, [initialData?.id, initialData?.purchase_mode]);

  // Unit Manager Modal state
  const [showUnitManager, setShowUnitManager] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState('');
  const [editingUnitIndex, setEditingUnitIndex] = useState<number | null>(null);
  const [editingUnitName, setEditingUnitName] = useState('');
  const [unitSearch, setUnitSearch] = useState('');

  const saveUnitsList = (updated: string[]) => {
    setAvailableUnits(updated);
    try {
      localStorage.setItem('cafe-ingredient-units', JSON.stringify(updated));
      if (supabase) {
        supabase.from('app_settings').upsert({
          setting_key: 'ingredient_units',
          setting_value: updated,
          branch: 'Rayong'
        }, { onConflict: 'branch,setting_key' }).then(() => {}, () => {});
      }
    } catch {}
  };

  const handleAddUnit = () => {
    const trimmed = newUnitInput.trim();
    if (!trimmed) return;
    if (availableUnits.includes(trimmed)) {
      alert(`หน่วย "${trimmed}" มีอยู่ในระบบแล้ว`);
      return;
    }
    const updated = [...availableUnits, trimmed];
    saveUnitsList(updated);
    setNewUnitInput('');
    // Auto select in form
    setPackUnit2(trimmed);
    setFormData(prev => ({ ...prev, unit: trimmed }));
  };

  const handleSaveEditUnit = (index: number) => {
    const trimmed = editingUnitName.trim();
    if (!trimmed) return;
    const oldName = availableUnits[index];
    const updated = [...availableUnits];
    updated[index] = trimmed;
    saveUnitsList(updated);
    setEditingUnitIndex(null);
    setEditingUnitName('');

    // Update form selections if matched
    if (packUnit1 === oldName) setPackUnit1(trimmed);
    if (packUnit2 === oldName) setPackUnit2(trimmed);
    if (purchaseUnit === oldName) setPurchaseUnit(trimmed);
    if (minStockUnit === oldName) setMinStockUnit(trimmed);
    if (minOrderUnit === oldName) setMinOrderUnit(trimmed);
    if (formData.unit === oldName) setFormData(prev => ({ ...prev, unit: trimmed }));
  };

  const handleDeleteUnit = (index: number) => {
    const unitToRemove = availableUnits[index];
    if (window.confirm(`ต้องการลบหน่วย "${unitToRemove}" ออกจากระบบหรือไม่?`)) {
      const updated = availableUnits.filter((_, i) => i !== index);
      saveUnitsList(updated);
    }
  };

  const handleResetUnits = () => {
    if (window.confirm('ต้องการคืนค่ารายการหน่วยนับเริ่มต้นตามระบบหรือไม่?')) {
      saveUnitsList(DEFAULT_UNITS);
    }
  };

  const [formData, setFormData] = useState<Omit<Ingredient, 'id'>>(initialData ? {
    name: initialData.name,
    brand: initialData.brand || '',
    sizePerUnit: initialData.sizePerUnit || '',
    category: initialData.category as any,
    minStock: initialData.minStock,
    minOrder: initialData.minOrder,
    supplier: initialData.supplier,
    unit: initialData.unit || parsedSize.unit2 || 'units',
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
    unit: parsedSize.unit2 || 'ถุง',
    image: '',
    department: defaultDepartment,
  });

  // Live Pack Conversion Calculation for ProdCalc
  const q1Numeric = Number(packQty1) > 0 ? Number(packQty1) : 1;
  const q2Numeric = Number(packQty2) > 0 ? Number(packQty2) : 1;
  const innerPackUnitLabel = packUnit2.trim() || formData.unit.trim() || 'ถุง';
  const packContentUnitLabel = packUnit1.trim() || 'kg';
  const contentPerInnerPack = q1Numeric / q2Numeric;
  const effectiveBulkPackCount = purchaseMode === 'bulk'
    ? (Number(bulkPackQty) > 0 ? Number(bulkPackQty) : 1)
    : 1;
  const calculatedTotalPackQty = Number((effectiveBulkPackCount * contentPerInnerPack).toFixed(4));

  const formatCleanNumber = (val: number) =>
    Number.isFinite(val) ? val.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '0';

  const baseUnitEquivalent = (() => {
    const uLower = packContentUnitLabel.toLowerCase();
    if (uLower === 'kg' || packContentUnitLabel === 'กิโลกรัม') {
      return { qty: Number((calculatedTotalPackQty * 1000).toFixed(4)), unit: 'g' };
    }
    if (packContentUnitLabel === 'ลิตร' || uLower === 'l') {
      return { qty: Number((calculatedTotalPackQty * 1000).toFixed(4)), unit: 'ml' };
    }
    return null;
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedSuppliers = suppliers.map((s, i) => {
      const trimmed = s.trim();
      if (!trimmed) return null;
      return i === primaryIndex ? `${trimmed} (หลัก)` : trimmed;
    }).filter(Boolean);

    // ประกอบข้อมูลขนาดบรรจุมาตรฐาน: "จำนวน หน่วย / จำนวน หน่วย" เช่น "1 kg / 1 ถุง"
    const q1 = packQty1.trim() || '1';
    const u1 = packUnit1.trim();
    const q2 = packQty2.trim() || '1';
    const u2 = packUnit2.trim();

    let finalSizePerUnit = '';
    if (u1 && u2) {
      finalSizePerUnit = `${q1} ${u1} / ${q2} ${u2}`;
    } else if (u1) {
      finalSizePerUnit = `${q1} ${u1}`;
    } else if (formData.sizePerUnit) {
      finalSizePerUnit = formData.sizePerUnit;
    }

    const finalUnit = formData.unit.trim() || u2 || u1 || 'units';
    const finalPurchaseUnit = purchaseUnit.trim() || u2 || finalUnit || 'ถุง';
    const finalMinStockUnit = minStockUnit.trim() || finalUnit;
    const finalMinOrderUnit = minOrderUnit.trim() || finalPurchaseUnit;
    const targetId =
      initialData?.id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15));

    const purchaseSpecPayload = {
      purchase_mode: purchaseMode,
      purchase_unit: finalPurchaseUnit,
      bulk_pack_qty: effectiveBulkPackCount,
      total_pack_qty: calculatedTotalPackQty,
      total_pack_unit: packContentUnitLabel,
      min_stock_unit: finalMinStockUnit,
      min_order_unit: finalMinOrderUnit,
    };

    // Save purchase spec to LocalStorage & Supabase app_settings as resilient cloud mirror
    try {
      const rawSpecs = localStorage.getItem('cafe-ingredient-purchase-specs');
      const existingSpecs = rawSpecs ? JSON.parse(rawSpecs) : {};
      const nextSpecs = {
        ...(existingSpecs && typeof existingSpecs === 'object' ? existingSpecs : {}),
        [targetId]: purchaseSpecPayload,
      };
      localStorage.setItem('cafe-ingredient-purchase-specs', JSON.stringify(nextSpecs));
      if (supabase) {
        supabase
          .from('app_settings')
          .upsert(
            {
              branch: 'GLOBAL',
              setting_key: 'ingredient_purchase_specs',
              setting_value: nextSpecs,
            },
            { onConflict: 'branch,setting_key' }
          )
          .then(() => {}, () => {});
      }
    } catch {}

    onSubmit({
      ...formData,
      sizePerUnit: finalSizePerUnit,
      unit: finalUnit,
      pack_qty_1: Number(q1) || 1,
      pack_unit_1: u1 || 'kg',
      pack_qty_2: Number(q2) || 1,
      pack_unit_2: u2 || 'ถุง',
      ...purchaseSpecPayload,
      supplier: formattedSuppliers.join(', '),
      id: targetId,
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

            {/* Section 2: Unit & Size (ขนาดและหน่วยนับ) */}
            <div className="bg-white p-3 rounded-lg border border-[#D4E4E3] shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-[#2D4A49] flex items-center gap-1.5">
                  <Scale className="text-[#EA580C]" size={14} />
                  ขนาดและหน่วยนับ
                </h3>
                <button
                  type="button"
                  onClick={() => setShowUnitManager(true)}
                  className="text-[10px] text-[#5A8A88] hover:text-[#2D4A49] hover:bg-[#E8F3F2] px-2 py-0.5 rounded transition-colors flex items-center gap-1 font-semibold cursor-pointer border border-[#D4E4E3]"
                  title="จัดการ เพิ่ม/แก้ไข รายชื่อหน่วยนับในระบบ"
                >
                  <Plus size={11} />
                  <span>เพิ่ม/แก้ไขหน่วยนับ</span>
                </button>
              </div>

              {/* ข้อ 1: ขนาดบรรจุ (Size/Unit) แยกเป็น: จำนวน, หน่วย / จำนวน, หน่วย เช่น 1 kg / 1 ถุง */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-medium text-[#4A6B6A]">
                    ขนาดบรรจุ (Size/Unit) <span className="text-[9.5px] text-[#6B8F8E] font-normal">(จำนวน, หน่วย / จำนวน, หน่วย)</span>
                  </label>
                  <span className="text-[9.5px] font-mono text-[#5A8A88] bg-[#E8F3F2] px-1.5 py-0.5 rounded border border-[#D4E4E3]">
                    ตัวอย่าง: 1 kg / 1 ถุง
                  </span>
                </div>

                <div className="bg-[#F8FAF9] p-2 rounded-lg border border-[#D4E4E3] flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                  {/* จำนวน 1 */}
                  <div className="w-16 sm:w-20 shrink-0">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="w-full border border-[#D4E4E3] rounded-md px-2 py-1 text-center font-mono text-[11px] text-[#2D4A49] bg-white h-[32px] focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none"
                      placeholder="จำนวน (1)"
                      value={packQty1}
                      onChange={(e) => setPackQty1(e.target.value)}
                    />
                  </div>

                  {/* หน่วย 1 (Dropdown) */}
                  <div className="flex-1 min-w-[100px]">
                    <select
                      className="w-full border border-[#D4E4E3] rounded-md px-2 py-1 text-[11px] text-[#2D4A49] bg-white h-[32px] focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none cursor-pointer"
                      value={packUnit1}
                      onChange={(e) => {
                        if (e.target.value === '__manage__') {
                          setShowUnitManager(true);
                        } else {
                          setPackUnit1(e.target.value);
                        }
                      }}
                    >
                      <option value="">-- เลือกหน่วย --</option>
                      {availableUnits.map((u) => (
                        <option key={`pack-u1-${u}`} value={u}>{u}</option>
                      ))}
                      <option value="__manage__" className="text-[#5A8A88] font-bold">+ เพิ่ม/แก้ไขหน่วย...</option>
                    </select>
                  </div>

                  {/* เครื่องหมายคั่น / */}
                  <span className="text-slate-400 font-bold text-sm px-0.5 select-none">/</span>

                  {/* จำนวน 2 */}
                  <div className="w-14 sm:w-16 shrink-0">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="w-full border border-[#D4E4E3] rounded-md px-2 py-1 text-center font-mono text-[11px] text-[#2D4A49] bg-white h-[32px] focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none"
                      placeholder="1"
                      value={packQty2}
                      onChange={(e) => setPackQty2(e.target.value)}
                    />
                  </div>

                  {/* หน่วย 2 (Dropdown) */}
                  <div className="flex-1 min-w-[100px]">
                    <select
                      className="w-full border border-[#D4E4E3] rounded-md px-2 py-1 text-[11px] text-[#2D4A49] bg-white h-[32px] focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none cursor-pointer"
                      value={packUnit2}
                      onChange={(e) => {
                        if (e.target.value === '__manage__') {
                          setShowUnitManager(true);
                        } else {
                          const val = e.target.value;
                          setPackUnit2(val);
                          // ซิงค์หน่วยนับให้อัตโนมัติหากยังไม่ได้ระบุ
                          if (!formData.unit || formData.unit === 'units' || formData.unit === packUnit2) {
                            setFormData(prev => ({ ...prev, unit: val }));
                            if (!minStockUnitCustom && val) {
                              setMinStockUnit(val);
                            }
                          }
                        }
                      }}
                    >
                      <option value="">-- เลือกหน่วยบรรจุ --</option>
                      {availableUnits.map((u) => (
                        <option key={`pack-u2-${u}`} value={u}>{u}</option>
                      ))}
                      <option value="__manage__" className="text-[#5A8A88] font-bold">+ เพิ่ม/แก้ไขหน่วย...</option>
                    </select>
                  </div>
                </div>

                {/* Live Preview Display */}
                <div className="flex items-center justify-between text-[10px] text-[#6B8F8E] pt-0.5 px-0.5">
                  <span>
                    ข้อมูลที่จะบันทึก:{' '}
                    <strong className="text-[#2D4A49] font-mono font-bold bg-[#E8F3F2] px-1.5 py-0.5 rounded border border-[#D4E4E3]">
                      {packQty1 || '1'} {packUnit1 || 'kg'} / {packQty2 || '1'} {packUnit2 || 'ถุง'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* ข้อ 2: หน่วยนับ (Unit) สำหรับการนับสต็อก เป็น Dropdown List */}
              <div>
                <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">
                  หน่วยนับ (Unit) ในการนับสต็อก *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Box className="text-[#5A8A88]" size={13} />
                  </div>
                  <select
                    required
                    className="w-full border border-[#D4E4E3] rounded-md pl-7 pr-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all text-[11px] text-[#2D4A49] bg-white h-[32px] cursor-pointer"
                    value={formData.unit}
                    onChange={(e) => {
                      if (e.target.value === '__manage__') {
                        setShowUnitManager(true);
                      } else {
                        const val = e.target.value;
                        setFormData({ ...formData, unit: val });
                        if (!minStockUnitCustom && val) {
                          setMinStockUnit(val);
                        }
                      }
                    }}
                  >
                    <option value="">-- เลือกหน่วยนับสต็อก --</option>
                    {availableUnits.map((u) => (
                      <option key={`stock-u-${u}`} value={u}>{u}</option>
                    ))}
                    <option value="__manage__" className="text-[#5A8A88] font-bold">+ เพิ่ม/แก้ไขหน่วย...</option>
                  </select>
                </div>
              </div>

              {/* ข้อ 3: รูปแบบการซื้อ (ปลีก / เหมา) และหน่วยนับการซื้อ */}
              <div className="pt-2 border-t border-[#D4E4E3]/70 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10.5px] font-medium text-[#4A6B6A] flex items-center gap-1">
                    <ShoppingCart size={12} className="text-[#5A8A88]" />
                    <span>รูปแบบการซื้อและหน่วยการซื้อ (Purchase Unit) *</span>
                  </label>
                  <span className="text-[9.5px] text-[#6B8F8E]">ปลีก หรือ เหมา</span>
                </div>

                {/* Purchase Mode Toggle: ปลีก vs เหมา */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPurchaseMode('retail');
                      setBulkPackQty('1');
                      const nextUnit = !purchaseUnit || purchaseUnit === 'ลัง' ? innerPackUnitLabel : purchaseUnit;
                      setPurchaseUnit(nextUnit);
                      if (!minOrderUnitCustom && nextUnit) {
                        setMinOrderUnit(nextUnit);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                      purchaseMode === 'retail'
                        ? 'bg-[#2D4A49] text-white border-[#2D4A49] shadow-2xs'
                        : 'bg-[#F8FAF9] text-[#2D4A49] border-[#D4E4E3] hover:bg-[#E8F3F2]'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-bold">ซื้อแบบปลีก (Retail)</div>
                      <div className={`text-[9px] ${purchaseMode === 'retail' ? 'text-[#D4E4E3]' : 'text-[#6B8F8E]'}`}>
                        ซื้อรายชิ้น / รายหน่วย
                      </div>
                    </div>
                    {purchaseMode === 'retail' && <Check size={13} className="shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPurchaseMode('bulk');
                      const nextUnit = !purchaseUnit || purchaseUnit === innerPackUnitLabel ? 'ลัง' : purchaseUnit;
                      setPurchaseUnit(nextUnit);
                      if (!minOrderUnitCustom && nextUnit) {
                        setMinOrderUnit(nextUnit);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                      purchaseMode === 'bulk'
                        ? 'bg-[#2D4A49] text-white border-[#2D4A49] shadow-2xs'
                        : 'bg-[#F8FAF9] text-[#2D4A49] border-[#D4E4E3] hover:bg-[#E8F3F2]'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-bold">ซื้อแบบเหมา (Bulk)</div>
                      <div className={`text-[9px] ${purchaseMode === 'bulk' ? 'text-[#D4E4E3]' : 'text-[#6B8F8E]'}`}>
                        ซื้อยกแพ็ค / ยกลัง / ยกกล่อง
                      </div>
                    </div>
                    {purchaseMode === 'bulk' && <Check size={13} className="shrink-0" />}
                  </button>
                </div>

                {/* Purchase Unit + Bulk Quantity Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-medium text-[#4A6B6A] mb-1">
                      หน่วยนับการซื้อ ({purchaseMode === 'bulk' ? 'แบบเหมา' : 'แบบปลีก'}) *
                    </label>
                    <select
                      required
                      className="w-full border border-[#D4E4E3] rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all text-[11px] text-[#2D4A49] bg-white h-[32px] cursor-pointer"
                      value={purchaseUnit}
                      onChange={(e) => {
                        if (e.target.value === '__manage__') {
                          setShowUnitManager(true);
                        } else {
                          const val = e.target.value;
                          setPurchaseUnit(val);
                          if (!minOrderUnitCustom && val) {
                            setMinOrderUnit(val);
                          }
                        }
                      }}
                    >
                      <option value="">-- เลือกหน่วยการซื้อ --</option>
                      {availableUnits.map((u) => (
                        <option key={`purchase-u-${u}`} value={u}>{u}</option>
                      ))}
                      <option value="__manage__" className="text-[#5A8A88] font-bold">+ เพิ่ม/แก้ไขหน่วย...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-[#4A6B6A] mb-1">
                      {purchaseMode === 'bulk'
                        ? `ซื้อแบบเหมา 1 ${purchaseUnit || 'หน่วย'} ได้จำนวน *`
                        : `จำนวนต่อ 1 ${purchaseUnit || 'หน่วย'} (แบบปลีก)`}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        disabled={purchaseMode === 'retail'}
                        className={`w-full border border-[#D4E4E3] rounded-md px-2.5 py-1.5 font-mono text-[11px] text-[#2D4A49] h-[32px] focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none ${
                          purchaseMode === 'retail' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                        }`}
                        placeholder="เช่น 12"
                        value={purchaseMode === 'retail' ? '1' : bulkPackQty}
                        onChange={(e) => setBulkPackQty(e.target.value)}
                      />
                      <span className="px-2 h-[32px] flex items-center rounded-md bg-[#E8F3F2] border border-[#D4E4E3] text-[10.5px] font-bold text-[#2D4A49] shrink-0 whitespace-nowrap">
                        {innerPackUnitLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ข้อ 4: สรุปการคำนวณเป็นหน่วยบรรจุ (สำหรับใช้ต่อยอดใน ProdCalc) */}
                <div className="bg-[#F0F7F6] border border-[#BFD8D6] rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-bold text-[#2D4A49] flex items-center gap-1.5">
                      <Calculator size={13} className="text-[#5A8A88]" />
                      <span>คำนวณเป็นหน่วยบรรจุ (สำหรับต่อยอด ProdCalc)</span>
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-[#5A8A88] border border-[#D4E4E3]">
                      {purchaseMode === 'bulk' ? 'แบบเหมา (Bulk)' : 'แบบปลีก (Retail)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div className="bg-white rounded-md px-2.5 py-1.5 border border-[#D4E4E3]">
                      <div className="text-[9.5px] text-[#6B8F8E]">
                        จำนวนหน่วยย่อย / 1 {purchaseUnit || 'หน่วยซื้อ'}
                      </div>
                      <div className="text-[12px] font-bold text-[#2D4A49] font-mono">
                        {formatCleanNumber(effectiveBulkPackCount)} {innerPackUnitLabel}
                      </div>
                    </div>

                    <div className="bg-white rounded-md px-2.5 py-1.5 border border-[#D4E4E3]">
                      <div className="text-[9.5px] text-[#6B8F8E]">
                        รวมทั้งหมดในหน่วยบรรจุ
                      </div>
                      <div className="text-[12px] font-bold text-emerald-700 font-mono">
                        {formatCleanNumber(calculatedTotalPackQty)} {packContentUnitLabel}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-[#4A6B6A] bg-white/75 rounded px-2 py-1 border border-[#D4E4E3]/80 flex flex-wrap items-center justify-between gap-1">
                    <span>
                      สูตรต่อยอดต้นทุน:{' '}
                      <strong className="text-[#2D4A49]">
                        1 {purchaseUnit || 'หน่วยซื้อ'} = {formatCleanNumber(effectiveBulkPackCount)} {innerPackUnitLabel} = {formatCleanNumber(calculatedTotalPackQty)} {packContentUnitLabel}
                      </strong>
                    </span>
                    {baseUnitEquivalent && (
                      <span className="text-[9.5px] font-mono font-bold text-[#5A8A88]">
                        (≈ {formatCleanNumber(baseUnitEquivalent.qty)} {baseUnitEquivalent.unit})
                      </span>
                    )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">จำนวนคงเหลือขั้นต่ำ (หน่วยนับ)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      required
                      type="number"
                      step="any"
                      min="0"
                      className="flex-1 min-w-0 border border-[#D4E4E3] rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all font-mono text-[11px] text-[#2D4A49] bg-white h-[32px]"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                    />
                    <select
                      required
                      className="w-24 shrink-0 border border-[#D4E4E3] rounded-md px-2 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all text-[11px] font-semibold text-[#2D4A49] bg-[#F8FAF9] h-[32px] cursor-pointer"
                      value={minStockUnit}
                      onChange={(e) => {
                        if (e.target.value === '__manage__') {
                          setShowUnitManager(true);
                        } else {
                          setMinStockUnit(e.target.value);
                          setMinStockUnitCustom(true);
                        }
                      }}
                    >
                      <option value="">-- หน่วย --</option>
                      {availableUnits.map((u) => (
                        <option key={`minstock-u-${u}`} value={u}>{u}</option>
                      ))}
                      <option value="__manage__" className="text-[#5A8A88] font-bold">+ เพิ่ม/แก้ไขหน่วย...</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10.5px] font-medium text-[#4A6B6A] mb-1">จำนวนสั่งซื้อขั้นต่ำ (หน่วยนับ)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      required
                      type="number"
                      step="any"
                      min="0"
                      className="flex-1 min-w-0 border border-[#D4E4E3] rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all font-mono text-[11px] text-[#2D4A49] bg-white h-[32px]"
                      value={formData.minOrder}
                      onChange={(e) => setFormData({ ...formData, minOrder: Number(e.target.value) })}
                    />
                    <select
                      required
                      className="w-24 shrink-0 border border-[#D4E4E3] rounded-md px-2 py-1.5 focus:ring-1 focus:ring-[#2D4A49] focus:border-[#2D4A49] outline-none transition-all text-[11px] font-semibold text-[#2D4A49] bg-[#F8FAF9] h-[32px] cursor-pointer"
                      value={minOrderUnit}
                      onChange={(e) => {
                        if (e.target.value === '__manage__') {
                          setShowUnitManager(true);
                        } else {
                          setMinOrderUnit(e.target.value);
                          setMinOrderUnitCustom(true);
                        }
                      }}
                    >
                      <option value="">-- หน่วย --</option>
                      {availableUnits.map((u) => (
                        <option key={`minorder-u-${u}`} value={u}>{u}</option>
                      ))}
                      <option value="__manage__" className="text-[#5A8A88] font-bold">+ เพิ่ม/แก้ไขหน่วย...</option>
                    </select>
                  </div>
                </div>
              </div>
              {purchaseMode === 'bulk' && formData.minOrder > 0 && minOrderUnit === purchaseUnit && (
                <p className="text-[10px] text-[#5A8A88] bg-[#F0F7F6] px-2.5 py-1 rounded border border-[#D4E4E3]">
                  💡 สั่งซื้อขั้นต่ำ <strong>{formatCleanNumber(formData.minOrder)} {minOrderUnit}</strong> (คิดเป็น {formatCleanNumber(formData.minOrder * effectiveBulkPackCount)} {innerPackUnitLabel} / {formatCleanNumber(formData.minOrder * calculatedTotalPackQty)} {packContentUnitLabel})
                </p>
              )}
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

      {/* ── UNIT MANAGER MODAL (เพิ่ม/แก้ไข รายการหน่วยนับในระบบ) ── */}
      {showUnitManager && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D4E4E3] w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-[#2D4A49] px-4 py-3 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <Scale size={16} className="text-[#8FB3B1]" />
                <div>
                  <h3 className="font-bold text-[12px]">จัดการรายชื่อหน่วยนับ (Unit Master)</h3>
                  <p className="text-[9.5px] text-[#D4E4E3]">เพิ่ม แก้ไข หรือลบ หน่วยนับสำหรับขนาดบรรจุและสต็อก</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUnitManager(false);
                  setEditingUnitIndex(null);
                  setEditingUnitName('');
                }}
                className="p-1 text-white/80 hover:text-white rounded-lg cursor-pointer"
                title="ปิด"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 bg-[#F8FAFA]">
              {/* Add New Unit Form */}
              <div className="bg-white p-3 rounded-xl border border-[#D4E4E3] shadow-2xs space-y-2">
                <label className="block text-[10.5px] font-bold text-[#2D4A49]">
                  + เพิ่มหน่วยนับใหม่
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="เช่น ถุง, แกลลอน, ซอง, กก., มัด..."
                    value={newUnitInput}
                    onChange={(e) => setNewUnitInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddUnit();
                      }
                    }}
                    className="flex-1 border border-[#D4E4E3] rounded-lg px-2.5 py-1.5 text-[11px] text-[#2D4A49] placeholder:text-[#9BB5B4] bg-white h-[32px] focus:outline-none focus:border-[#5A8A88]"
                  />
                  <button
                    type="button"
                    onClick={handleAddUnit}
                    disabled={!newUnitInput.trim()}
                    className="px-3 py-1.5 bg-[#5A8A88] hover:bg-[#476E6C] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40 shadow-2xs shrink-0 flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>เพิ่มหน่วย</span>
                  </button>
                </div>
              </div>

              {/* Units List Header & Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#2D4A49]">
                    หน่วยนับที่มีในระบบ ({availableUnits.length} หน่วย)
                  </span>
                  <button
                    type="button"
                    onClick={handleResetUnits}
                    className="text-[9.5px] text-[#5A8A88] hover:text-[#2D4A49] hover:underline flex items-center gap-1 cursor-pointer"
                    title="คืนค่าเป็น 21 หน่วยมาตรฐานเริ่มต้น"
                  >
                    <RotateCcw size={10} />
                    <span>คืนค่าเริ่มต้น</span>
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="ค้นหาชื่อหน่วย..."
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  className="w-full border border-[#D4E4E3] rounded-lg px-2.5 py-1 text-[10.5px] text-[#2D4A49] placeholder:text-[#9BB5B4] bg-white h-[28px] focus:outline-none focus:border-[#5A8A88]"
                />

                {/* Unit List Container */}
                <div className="bg-white rounded-xl border border-[#D4E4E3] p-2 max-h-[220px] overflow-y-auto space-y-1 divide-y divide-slate-100">
                  {availableUnits
                    .map((unit, originalIdx) => ({ unit, originalIdx }))
                    .filter(item => !unitSearch.trim() || item.unit.toLowerCase().includes(unitSearch.toLowerCase()))
                    .map(({ unit, originalIdx }) => {
                      const isEditing = editingUnitIndex === originalIdx;

                      return (
                        <div key={originalIdx} className="pt-1 first:pt-0 flex items-center justify-between gap-2 py-1 px-1 hover:bg-[#F0F5F4]/60 rounded-md transition-colors">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                autoFocus
                                value={editingUnitName}
                                onChange={(e) => setEditingUnitName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditUnit(originalIdx);
                                  if (e.key === 'Escape') setEditingUnitIndex(null);
                                }}
                                className="flex-1 border border-[#5A8A88] rounded px-2 py-0.5 text-[11px] text-[#2D4A49] bg-white h-[26px] outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditUnit(originalIdx)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                บันทึก
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingUnitIndex(null)}
                                className="px-1.5 py-0.5 text-slate-500 hover:text-slate-700 text-[10px] cursor-pointer"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-medium text-[#2D4A49] bg-[#E8F3F2] px-2 py-0.5 rounded border border-[#D4E4E3]">
                                  {unit}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUnitIndex(originalIdx);
                                    setEditingUnitName(unit);
                                  }}
                                  className="p-1 text-[#5A8A88] hover:text-[#2D4A49] hover:bg-[#E8F3F2] rounded cursor-pointer transition-colors"
                                  title="แก้ไขชื่อหน่วยนี้"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUnit(originalIdx)}
                                  className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                                  title="ลบหน่วยนี้"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 border-t border-[#D4E4E3] bg-white flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowUnitManager(false);
                  setEditingUnitIndex(null);
                  setEditingUnitName('');
                }}
                className="px-4 py-1.5 bg-[#2D4A49] hover:bg-[#1E3635] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
