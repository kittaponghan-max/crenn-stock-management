import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ProdcalcIngredientPrice, SourcingOption } from '../../types/prodcalc';
import { 
  Search, 
  RefreshCw, 
  Star, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  DollarSign, 
  Percent, 
  Sparkles,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Package
} from 'lucide-react';

interface IngredientPricingProps {
  currentBranch: string;
  isReadOnly?: boolean;
}

export function IngredientPricing({ currentBranch, isReadOnly = false }: IngredientPricingProps) {
  const [items, setItems] = useState<ProdcalcIngredientPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showPricedOnly, setShowPricedOnly] = useState(false);

  // Expanded row ID for inline sourcing view
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edit Modal State for detailed editing
  const [editingItem, setEditingItem] = useState<ProdcalcIngredientPrice | null>(null);

  const storageKey = `prodcalc-ingredient-prices-${currentBranch}`;

  // Helper to automatically select the sourcing option with the highest unit price as default
  const autoSelectHighestPriceSourcing = (sourcingList: SourcingOption[]): SourcingOption[] => {
    if (!sourcingList || sourcingList.length === 0) return sourcingList;

    let highestIdx = -1;
    let maxUnitPrice = -1;

    sourcingList.forEach((source, idx) => {
      const qty = source.qty > 0 ? source.qty : 1;
      const unitPrice = source.price > 0 ? source.price / qty : 0;
      if (unitPrice > maxUnitPrice && unitPrice > 0) {
        maxUnitPrice = unitPrice;
        highestIdx = idx;
      }
    });

    if (highestIdx >= 0) {
      return sourcingList.map((s, idx) => ({
        ...s,
        is_default: idx === highestIdx
      }));
    }

    const hasDefault = sourcingList.some(s => s.is_default);
    if (!hasDefault && sourcingList.length > 0) {
      return sourcingList.map((s, idx) => ({
        ...s,
        is_default: idx === 0
      }));
    }

    return sourcingList;
  };

  // Helper to calculate effective cost
  const calculateEffectiveCost = (sourcing: SourcingOption[], yieldPct: number): number => {
    const autoSourcing = autoSelectHighestPriceSourcing(sourcing);
    const defaultSource = autoSourcing.find(s => s.is_default) || autoSourcing[0];
    if (!defaultSource || !defaultSource.price || !defaultSource.qty || defaultSource.qty <= 0) {
      return 0;
    }
    const safeYield = yieldPct > 0 ? yieldPct / 100 : 1;
    const rawCostPerQty = defaultSource.price / defaultSource.qty;
    return Number((rawCostPerQty / safeYield).toFixed(4));
  };

  // Load ingredients from Prodcalc table or initialize from CMS table
  // Helper to parse single or multiple suppliers from ingredient supplier string or brand
  const parseSuppliers = (supplierStr?: string, brandStr?: string): string[] => {
    const result: string[] = [];
    if (supplierStr && supplierStr.trim() !== '' && supplierStr.trim() !== '-') {
      const rawList = supplierStr.split(/[,/;\n|]+/).map(s => s.trim()).filter(Boolean);
      rawList.forEach(s => {
        if (!result.includes(s)) {
          result.push(s);
        }
      });
    }

    if (result.length === 0 && brandStr && brandStr.trim() !== '' && brandStr.trim() !== '-') {
      result.push(brandStr.trim());
    }

    if (result.length === 0) {
      result.push('Makro');
    }

    return result;
  };

  // Load ingredients from Prodcalc table or initialize from CMS table
  const loadData = async (forceSync = false) => {
    setIsLoading(true);
    let loadedItems: ProdcalcIngredientPrice[] = [];

    // 1. First, attempt to load existing ProdCalc prices from Supabase
    if (supabase) {
      try {
        const { data: prodData, error: prodErr } = await supabase
          .from('prodcalc_ingredient_prices')
          .select('*')
          .eq('branch', currentBranch);

        if (!prodErr && prodData && prodData.length > 0) {
          loadedItems = prodData.map((d: any) => {
            const rawSourcing = Array.isArray(d.sourcing) ? d.sourcing : [];
            const autoSourcing = autoSelectHighestPriceSourcing(rawSourcing);
            const yieldPct = Number(d.yield_pct) || 100;
            return {
              id: d.id,
              ingredient_id: d.ingredient_id,
              ingredient_name: d.ingredient_name,
              ingredient_brand: d.ingredient_brand || '-',
              ingredient_unit: d.ingredient_unit || 'หน่วย',
              size_per_unit: d.size_per_unit || d.ingredient_size_per_unit || '',
              yield_pct: yieldPct,
              sourcing: autoSourcing,
              effective_cost_per_unit: calculateEffectiveCost(autoSourcing, yieldPct),
              branch: d.branch || currentBranch,
              category: d.category || '',
              image: d.image || ''
            };
          });
        }
      } catch (err) {
        console.warn('prodcalc_ingredient_prices query notice:', err);
      }
    }

    // Fallback to localStorage if no items from Supabase
    if (loadedItems.length === 0) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          loadedItems = parsed.map((item: any) => {
            const autoSourcing = autoSelectHighestPriceSourcing(item.sourcing || []);
            return {
              ...item,
              sourcing: autoSourcing,
              effective_cost_per_unit: calculateEffectiveCost(autoSourcing, item.yield_pct || 100)
            };
          });
        } catch {}
      }
    }

    // 2. Fetch CMS ingredients to ensure all active ingredients exist
    if (forceSync || loadedItems.length === 0) {
      await syncWithCMS(loadedItems);
    } else {
      // Perform a silent sync to ensure size_per_unit and suppliers are updated from CMS database
      syncWithCMS(loadedItems);
    }
  };

  // Sync with CMS: READ-ONLY from 'ingredients' table
  const syncWithCMS = async (existingItems: ProdcalcIngredientPrice[]) => {
    setIsSyncing(true);
    let newCount = 0;

    try {
      let cmsList: Array<{
        id: string;
        name: string;
        brand?: string;
        size_per_unit?: string;
        sizePerUnit?: string;
        unit: string;
        supplier?: string;
        image?: string;
        category?: string;
      }> = [];

      if (supabase) {
        // Query CMS table: ONLY SELECT, NEVER WRITE
        try {
          const { data, error } = await supabase
            .from('ingredients')
            .select('id, name, brand, size_per_unit, unit, supplier, image, category')
            .eq('branch', currentBranch);

          if (!error && data) {
            cmsList = data;
          }
        } catch (cmsErr) {
          console.warn('CMS ingredients fetch fallback:', cmsErr);
        }
      }

      // If empty or offline, check localStorage CMS fallback
      if (cmsList.length === 0) {
        const localCMS = localStorage.getItem(`cafe-ingredients-v4-${currentBranch}`) || localStorage.getItem('cafe-ingredients-v4');
        if (localCMS) {
          try {
            cmsList = JSON.parse(localCMS);
          } catch {}
        }
      }

      // Merge: create new pricing entries or update existing entries with size_per_unit and suppliers
      const existingMap = new Map(existingItems.map(item => [item.ingredient_id, item]));
      const updatedList = [...existingItems];

      for (const ing of cmsList) {
        const fetchedSize = ing.size_per_unit || ing.sizePerUnit || ing.unit || 'หน่วย';
        const supplierList = parseSuppliers(ing.supplier, ing.brand);

        if (!existingMap.has(ing.id)) {
          newCount++;
          const sourcingOptions: SourcingOption[] = supplierList.map((supName, idx) => ({
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9) + idx,
            source_name: supName,
            price: 0,
            qty: 1,
            unit: ing.unit || 'หน่วย',
            is_default: idx === 0
          }));

          const newItem: ProdcalcIngredientPrice = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
            ingredient_id: ing.id,
            ingredient_name: ing.name,
            ingredient_brand: ing.brand || '-',
            ingredient_unit: ing.unit || 'หน่วย',
            size_per_unit: fetchedSize,
            yield_pct: 100,
            sourcing: sourcingOptions,
            effective_cost_per_unit: 0,
            branch: currentBranch,
            category: ing.category || 'ทั่วไป',
            image: ing.image || ''
          };
          updatedList.push(newItem);
        } else {
          // Update existing item size_per_unit and merge any suppliers from database
          const existingItem = existingMap.get(ing.id)!;
          if (fetchedSize && (!existingItem.size_per_unit || existingItem.size_per_unit === existingItem.ingredient_unit)) {
            existingItem.size_per_unit = fetchedSize;
          }
          const currentSourceNames = new Set(existingItem.sourcing.map(s => s.source_name.trim().toLowerCase()));
          supplierList.forEach((supName) => {
            if (!currentSourceNames.has(supName.toLowerCase())) {
              existingItem.sourcing.push({
                id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
                source_name: supName,
                price: 0,
                qty: 1,
                unit: existingItem.ingredient_unit || ing.unit || 'หน่วย',
                is_default: false
              });
            }
          });

          // Auto select highest price sourcing option as default
          existingItem.sourcing = autoSelectHighestPriceSourcing(existingItem.sourcing);
          existingItem.effective_cost_per_unit = calculateEffectiveCost(existingItem.sourcing, existingItem.yield_pct);
        }
      }

      setItems(updatedList);
      saveItems(updatedList);
      setSyncMessage(newCount > 0 ? `Sync สำเร็จ: เพิ่ม ${newCount} รายการใหม่จาก CMS` : 'Sync สำเร็จ: ข้อมูลวัตถุดิบและผู้จัดจำหน่ายเป็นปัจจุบันแล้ว');
      setTimeout(() => setSyncMessage(null), 3500);
    } catch (err) {
      console.error('Error syncing with CMS:', err);
      setSyncMessage('ไม่สามารถ Sync กับ CMS ได้ในขณะนี้');
      setTimeout(() => setSyncMessage(null), 3000);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  };

  // Save to ProdCalc table and LocalStorage (NEVER touching CMS table)
  const saveItems = async (updatedList: ProdcalcIngredientPrice[]) => {
    if (isReadOnly) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
      if (supabase) {
        const payload = updatedList.map(item => ({
          id: item.id,
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          ingredient_brand: item.ingredient_brand,
          ingredient_unit: item.ingredient_unit,
          size_per_unit: item.size_per_unit || item.ingredient_unit,
          yield_pct: item.yield_pct,
          sourcing: item.sourcing,
          effective_cost_per_unit: item.effective_cost_per_unit,
          branch: item.branch,
          updated_at: new Date().toISOString()
        }));

        await supabase
          .from('prodcalc_ingredient_prices')
          .upsert(payload, { onConflict: 'ingredient_id, branch' });
      }
    } catch (err) {
      console.warn('prodcalc_ingredient_prices save note:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch]);

  // Update a single item's yield or sourcing
  const handleUpdateItem = (updated: ProdcalcIngredientPrice) => {
    if (isReadOnly) return;
    const autoSourcing = autoSelectHighestPriceSourcing(updated.sourcing);
    const effectiveCost = calculateEffectiveCost(autoSourcing, updated.yield_pct);
    const finalItem = {
      ...updated,
      sourcing: autoSourcing,
      effective_cost_per_unit: effectiveCost
    };

    const nextList = items.map(item => item.id === finalItem.id ? finalItem : item);
    setItems(nextList);
    saveItems(nextList);
  };

  // Reset an item's pricing (does NOT affect CMS data)
  const handleResetPricing = (item: ProdcalcIngredientPrice) => {
    if (isReadOnly) return;
    if (window.confirm(`ต้องการล้างข้อมูลราคาของ "${item.ingredient_name}" ใน ProdCalc หรือไม่? (ข้อมูลสต็อกใน CMS จะไม่ได้รับผลกระทบ)`)) {
      const resetItem: ProdcalcIngredientPrice = {
        ...item,
        yield_pct: 100,
        sourcing: [{
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
          source_name: 'Makro',
          price: 0,
          qty: 1,
          unit: item.ingredient_unit,
          is_default: true
        }],
        effective_cost_per_unit: 0
      };
      const nextList = items.map(it => it.id === item.id ? resetItem : it);
      setItems(nextList);
      saveItems(nextList);
    }
  };

  // Filtered ingredients
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = 
        item.ingredient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.ingredient_brand && item.ingredient_brand.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchPriced = !showPricedOnly || item.effective_cost_per_unit > 0;

      return matchSearch && matchCategory && matchPriced;
    });
  }, [items, searchTerm, categoryFilter, showPricedOnly]);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  return (
    <div className="space-y-4">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* HEADER CARD */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div 
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #C8E3F0',
          borderRadius: '16px',
          padding: '14px 18px',
          boxShadow: '0 4px 20px rgba(90, 164, 200, 0.08)'
        }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12px]">🧪</span>
            <h1 style={{ color: '#1E3D52' }} className="text-[12px] font-bold tracking-tight">
              รายการวัตถุดิบ (Ingredient Pricing)
            </h1>
          </div>
          <p style={{ color: '#4A7592' }} className="text-[9.5px] mt-0.5 font-normal leading-relaxed">
            ดึงข้อมูลจาก Cafe Management System &nbsp;·&nbsp; อัปเดต Yield และราคาจากแหล่งจัดซื้อเพื่อคำนวณต้นทุน
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span 
            style={{ 
              background: '#EEF6FB', 
              color: '#1E5A7A',
              border: '1px solid #C8E3F0' 
            }}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
          >
            <span>📍 สาขา: {currentBranch}</span>
          </span>

          {!isReadOnly && (
            <button
              onClick={() => syncWithCMS(items)}
              disabled={isSyncing}
              style={{
                background: '#5BA4C8',
                color: '#FFFFFF'
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-semibold shadow-xs hover:bg-[#3D7FA3] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'กำลัง Sync...' : 'Sync จาก CMS'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Toast Notification */}
      {syncMessage && (
        <div 
          style={{ background: '#EEF6FB', border: '1px solid #5BA4C8', color: '#1E5A7A' }}
          className="p-2.5 rounded-xl text-[10.5px] font-medium flex items-center justify-between animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} color="#5BA4C8" />
            <span>{syncMessage}</span>
          </div>
          <button onClick={() => setSyncMessage(null)} className="text-[#4A7592] hover:text-[#1E3D52] cursor-pointer">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* FILTER & SEARCH BAR */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div 
        style={{
          background: '#FFFFFF',
          border: '1px solid #C8E3F0',
          borderRadius: '12px',
          padding: '10px 14px'
        }}
        className="flex flex-wrap items-center justify-between gap-2.5"
      >
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <Search size={13} color="#4A7592" className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาชื่อวัตถุดิบ หรือยี่ห้อ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: '#F8FCFE',
                border: '1px solid #C8E3F0',
                color: '#1E3D52'
              }}
              className="w-full pl-8 pr-2.5 py-1 rounded-lg text-[11px] outline-none focus:border-[#5BA4C8] transition-colors"
            />
          </div>

          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                background: '#F8FCFE',
                border: '1px solid #C8E3F0',
                color: '#1E3D52'
              }}
              className="px-2.5 py-1 rounded-lg text-[10.5px] outline-none cursor-pointer"
            >
              <option value="ALL">ทุกหมวดหมู่ ({items.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none text-[10.5px] text-[#1E3D52] font-medium">
          <input
            type="checkbox"
            checked={showPricedOnly}
            onChange={(e) => setShowPricedOnly(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-[#5BA4C8] border-[#C8E3F0] focus:ring-0 cursor-pointer"
          />
          <span>แสดงเฉพาะที่ตั้งราคาแล้ว ({items.filter(i => i.effective_cost_per_unit > 0).length})</span>
        </label>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TABLE */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div 
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #C8E3F0',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(90, 164, 200, 0.06)'
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10.5px] border-collapse">
            <thead>
              <tr style={{ background: '#1E5A7A', color: '#FFFFFF' }} className="font-semibold select-none text-[10px]">
                <th className="py-2.5 px-3 w-12 text-center">รูป</th>
                <th className="py-2.5 px-3 min-w-[150px]">ชื่อวัตถุดิบ (CMS)</th>
                <th className="py-2.5 px-3 min-w-[90px]">ยี่ห้อ</th>
                <th className="py-2.5 px-3 min-w-[120px]">ขนาดต่อหน่วย (CMS)</th>
                <th className="py-2.5 px-3 min-w-[240px]">Sourcing (แหล่งราคา)</th>
                <th className="py-2.5 px-3 min-w-[80px] text-center">Yield %</th>
                <th className="py-2.5 px-3 min-w-[120px] text-right">ต้นทุนจริง/หน่วย</th>
                {!isReadOnly && <th className="py-2.5 px-3 w-20 text-center">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4F1F8]">
              {isLoading ? (
                <tr>
                  <td colSpan={isReadOnly ? 7 : 8} className="py-10 text-center text-[#4A7592]">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-[#5BA4C8]" />
                      <span className="text-[11px]">กำลังโหลดข้อมูลวัตถุดิบ...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 7 : 8} className="py-10 text-center text-[#4A7592]">
                    <Package size={28} className="mx-auto mb-1.5 text-[#90C4DC]" />
                    <p className="font-medium text-[11px]">ไม่พบรายการวัตถุดิบ</p>
                    {!isReadOnly && (
                      <p className="text-[9.5px] text-[#90C4DC] mt-0.5">กดปุ่ม "Sync จาก CMS" เพื่อดึงข้อมูลจากระบบหลัก</p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const defaultSource = item.sourcing.find(s => s.is_default) || item.sourcing[0];
                  const hasPrice = item.effective_cost_per_unit > 0;
                  const isExpanded = expandedId === item.id;
                  const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F8FCFE';

                  return (
                    <React.Fragment key={item.id}>
                      <tr 
                        style={{ background: rowBg }}
                        className="hover:bg-[#EEF6FB]/60 transition-colors"
                      >
                        {/* Image */}
                        <td className="py-2 px-3 text-center">
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.ingredient_name}
                              className="w-7 h-7 rounded-lg object-cover mx-auto border border-[#C8E3F0]"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-[#EEF6FB] flex items-center justify-center mx-auto text-[10px] text-[#5BA4C8]">
                              🧪
                            </div>
                          )}
                        </td>

                        {/* Name */}
                        <td className="py-2 px-3">
                          <div className="font-semibold text-[#1E3D52] text-[11px]">{item.ingredient_name}</div>
                          {item.category && (
                            <span className="text-[9px] text-[#4A7592] bg-[#EEF6FB] px-1.5 py-0.2 rounded border border-[#C8E3F0]/60 inline-block mt-0.5">
                              {item.category}
                            </span>
                          )}
                        </td>

                        {/* Brand */}
                        <td className="py-2 px-3 text-[#4A7592] text-[10.5px]">
                          {item.ingredient_brand || '-'}
                        </td>

                        {/* Size Per Unit */}
                        <td className="py-2 px-3 text-[#1E3D52]">
                          <span className="font-mono text-[10.5px] font-medium">{item.size_per_unit || item.ingredient_unit}</span>
                        </td>

                        {/* Sourcing */}
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-between gap-2">
                            {defaultSource && defaultSource.price > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[#1E3D52] text-[10.5px]">{defaultSource.source_name}:</span>
                                <span className="font-bold text-[#1E5A7A] font-mono text-[11px]">฿{defaultSource.price.toLocaleString()}</span>
                                <span className="text-[10px] text-[#4A7592]">/{defaultSource.qty} {defaultSource.unit}</span>
                                {item.sourcing.length > 1 && (
                                  <span className="text-[9.5px] bg-[#EEF6FB] text-[#3D7FA3] px-1.5 py-0.5 rounded-full font-bold">
                                    +{item.sourcing.length - 1}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle size={9} />
                                ยังไม่ตั้งราคา
                              </span>
                            )}

                            <button
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              style={{ border: '1px solid #C8E3F0' }}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium text-[#4A7592] hover:bg-[#EEF6FB] hover:text-[#1E5A7A] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <span>{isExpanded ? 'ซ่อน' : (isReadOnly ? 'ดูแหล่งราคา' : 'จัดการแหล่ง')}</span>
                              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          </div>
                        </td>

                        {/* Yield % */}
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center justify-center gap-1">
                            <input
                              type="number"
                              disabled={isReadOnly}
                              min="1"
                              max="100"
                              value={item.yield_pct}
                              onChange={(e) => {
                                if (isReadOnly) return;
                                const val = Math.min(100, Math.max(1, Number(e.target.value) || 100));
                                handleUpdateItem({ ...item, yield_pct: val });
                              }}
                              style={{
                                border: '1px solid #C8E3F0',
                                color: item.yield_pct === 100 ? '#22C55E' : item.yield_pct >= 70 ? '#1E3D52' : '#F59E0B'
                              }}
                              className="w-12 text-center py-0.5 rounded-md text-[11px] font-bold font-mono outline-none focus:border-[#5BA4C8] disabled:bg-slate-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-[10px] text-[#4A7592] font-semibold">%</span>
                          </div>
                        </td>

                        {/* Effective Cost Per Unit */}
                        <td className="py-2 px-3 text-right">
                          {hasPrice ? (
                            <div 
                              style={{ 
                                background: '#EEF6FB', 
                                border: '1px solid #C8E3F0',
                                color: '#1E5A7A' 
                              }}
                              className="inline-block px-2 py-0.5 rounded-lg text-right"
                            >
                              <div className="font-black text-[12px] font-mono">
                                ฿ {item.effective_cost_per_unit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-[9px] text-[#4A7592]">
                                ต่อ {defaultSource?.unit || item.ingredient_unit}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#90C4DC] font-mono text-[10.5px]">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        {!isReadOnly && (
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setEditingItem(item)}
                                title="แก้ไขราคาและแหล่งซื้อ"
                                className="p-1 rounded-lg text-[#3D7FA3] hover:bg-[#EEF6FB] transition-colors cursor-pointer"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={() => handleResetPricing(item)}
                                title="ล้างข้อมูลราคาใน ProdCalc"
                                className="p-1 rounded-lg text-[#EF4444] hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                      {/* EXPANDED SOURCING PANEL */}
                      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                      {isExpanded && (
                        <tr style={{ background: '#F8FCFE' }}>
                          <td colSpan={isReadOnly ? 7 : 8} className="p-3 border-t border-b border-[#C8E3F0]">
                            <div className="bg-white p-3 rounded-xl border border-[#C8E3F0] space-y-2.5">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-[#1E3D52] text-[11px]">
                                    🛒 แหล่งจัดซื้อ (Sourcing Options) สำหรับ: {item.ingredient_name}
                                  </span>
                                  {!isReadOnly && (
                                    <span className="text-[9.5px] text-[#4A7592] bg-[#EEF6FB] px-2 py-0.5 rounded-full border border-[#C8E3F0]">
                                      คลิก ⭐ เพื่อเลือกเป็นราคาหลัก (ระบบจะเลือกรายการราคาสูงสุดให้อัตโนมัติ)
                                    </span>
                                  )}
                                </div>

                                {!isReadOnly && (
                                  <div className="flex items-center gap-2 self-end sm:self-center">
                                    {/* ปุ่ม บันทึก (Save button) */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateItem(item);
                                        setExpandedId(null);
                                      }}
                                      style={{ background: '#5A8A88', color: '#FFFFFF' }}
                                      className="px-3 py-1 rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 hover:bg-[#476E6C] active:scale-95 transition-all shadow-xs cursor-pointer"
                                      title="บันทึกข้อมูลแหล่งจัดซื้อ"
                                    >
                                      <Check size={12} />
                                      <span>บันทึก</span>
                                    </button>

                                    {/* ปุ่ม เพิ่มแหล่งซื้อ */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newSource: SourcingOption = {
                                          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
                                          source_name: '',
                                          price: 0,
                                          qty: 1,
                                          unit: item.ingredient_unit,
                                          is_default: false
                                        };
                                        handleUpdateItem({
                                          ...item,
                                          sourcing: [...item.sourcing, newSource]
                                        });
                                      }}
                                      style={{ background: '#EEF6FB', color: '#1E5A7A', border: '1px solid #5BA4C8' }}
                                      className="px-3 py-1 rounded-xl text-[10.5px] font-semibold flex items-center gap-1.5 hover:bg-[#5BA4C8] hover:text-white transition-all cursor-pointer"
                                    >
                                      <Plus size={12} />
                                      <span>เพิ่มแหล่งซื้อ</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-[10px]">
                                  <thead>
                                    <tr className="text-[#4A7592] border-b border-[#E4F1F8]">
                                      <th className="py-1 px-2 w-14 text-center">ราคาหลัก</th>
                                      <th className="py-1 px-2">ชื่อแหล่งซื้อ (Vendor/Store)</th>
                                      <th className="py-1 px-2 w-24">ราคา (บาท)</th>
                                      <th className="py-1 px-2 w-20">ปริมาณ</th>
                                      <th className="py-1 px-2 w-24">หน่วย</th>
                                      <th className="py-1 px-2 text-right">ต้นทุน/หน่วยดิบ</th>
                                      <th className="py-1 px-2 w-8 text-center"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#F1F7FA]">
                                    {item.sourcing.map((source, sIdx) => {
                                      const rawCost = source.qty > 0 ? source.price / source.qty : 0;
                                      return (
                                        <tr key={source.id} className={source.is_default ? 'bg-[#EEF6FB]/40' : ''}>
                                          {/* Default Radio */}
                                          <td className="py-1.5 px-2 text-center">
                                            <button
                                              type="button"
                                              disabled={isReadOnly}
                                              onClick={() => {
                                                if (isReadOnly) return;
                                                const updatedSourcing = item.sourcing.map((s, i) => ({
                                                  ...s,
                                                  is_default: i === sIdx
                                                }));
                                                handleUpdateItem({ ...item, sourcing: updatedSourcing });
                                              }}
                                              title={isReadOnly ? undefined : (source.is_default ? 'ราคานี้ถูกตั้งเป็นค่าเริ่มต้น' : 'คลิกเพื่อตั้งเป็นราคาเริ่มต้น')}
                                              className="p-0.5 text-amber-500 hover:scale-110 transition-transform cursor-pointer disabled:cursor-default disabled:hover:scale-100"
                                            >
                                              <Star 
                                                size={13} 
                                                className={source.is_default ? 'fill-amber-400 text-amber-500' : 'text-slate-300'} 
                                              />
                                            </button>
                                          </td>

                                          {/* Source Name */}
                                          <td className="py-1.5 px-2">
                                            <input
                                              type="text"
                                              disabled={isReadOnly}
                                              placeholder="เช่น Makro, Shopee, Tops"
                                              value={source.source_name}
                                              onChange={(e) => {
                                                if (isReadOnly) return;
                                                const updatedSourcing = [...item.sourcing];
                                                updatedSourcing[sIdx].source_name = e.target.value;
                                                handleUpdateItem({ ...item, sourcing: updatedSourcing });
                                              }}
                                              style={{ border: '1px solid #C8E3F0' }}
                                              className="w-full px-2 py-0.5 rounded text-[10px] outline-none focus:border-[#5BA4C8] bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
                                            />
                                          </td>

                                          {/* Price */}
                                          <td className="py-1.5 px-2">
                                            <div className="relative">
                                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">฿</span>
                                              <input
                                                type="number"
                                                disabled={isReadOnly}
                                                step="any"
                                                min="0"
                                                placeholder="0.00"
                                                value={source.price || ''}
                                                onChange={(e) => {
                                                  if (isReadOnly) return;
                                                  const updatedSourcing = [...item.sourcing];
                                                  updatedSourcing[sIdx].price = Number(e.target.value) || 0;
                                                  handleUpdateItem({ ...item, sourcing: updatedSourcing });
                                                }}
                                                style={{ border: '1px solid #C8E3F0' }}
                                                className="w-full pl-5 pr-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold outline-none focus:border-[#5BA4C8] bg-white text-right disabled:bg-slate-50 disabled:cursor-not-allowed"
                                              />
                                            </div>
                                          </td>

                                          {/* Qty */}
                                          <td className="py-1.5 px-2">
                                            <input
                                              type="number"
                                              disabled={isReadOnly}
                                              step="any"
                                              min="0.001"
                                              value={source.qty || 1}
                                              onChange={(e) => {
                                                if (isReadOnly) return;
                                                const updatedSourcing = [...item.sourcing];
                                                updatedSourcing[sIdx].qty = Number(e.target.value) || 1;
                                                handleUpdateItem({ ...item, sourcing: updatedSourcing });
                                              }}
                                              style={{ border: '1px solid #C8E3F0' }}
                                              className="w-full px-1.5 py-0.5 rounded text-[10px] font-mono outline-none focus:border-[#5BA4C8] bg-white text-center disabled:bg-slate-50 disabled:cursor-not-allowed"
                                            />
                                          </td>

                                          {/* Unit */}
                                          <td className="py-1.5 px-2">
                                            <input
                                              type="text"
                                              disabled={isReadOnly}
                                              value={source.unit}
                                              onChange={(e) => {
                                                if (isReadOnly) return;
                                                const updatedSourcing = [...item.sourcing];
                                                updatedSourcing[sIdx].unit = e.target.value;
                                                handleUpdateItem({ ...item, sourcing: updatedSourcing });
                                              }}
                                              style={{ border: '1px solid #C8E3F0' }}
                                              className="w-full px-1.5 py-0.5 rounded text-[10px] outline-none focus:border-[#5BA4C8] bg-white text-center disabled:bg-slate-50 disabled:cursor-not-allowed"
                                            />
                                          </td>

                                          {/* Raw Cost */}
                                          <td className="py-1.5 px-2 text-right font-mono font-semibold text-[#1E3D52] text-[10.5px]">
                                            ฿{rawCost.toFixed(2)}
                                          </td>

                                          {/* Delete Source */}
                                          <td className="py-1.5 px-2 text-center">
                                            {!isReadOnly && item.sourcing.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updatedSourcing = item.sourcing.filter((_, i) => i !== sIdx);
                                                  if (source.is_default && updatedSourcing.length > 0) {
                                                    updatedSourcing[0].is_default = true;
                                                  }
                                                  handleUpdateItem({ ...item, sourcing: updatedSourcing });
                                                }}
                                                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                                              >
                                                <X size={12} />
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* EDIT MODAL */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {!isReadOnly && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div 
            style={{ border: '1.5px solid #C8E3F0' }}
            className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E4F1F8]">
              <div className="flex items-center gap-2">
                <span className="text-[12px]">✏️</span>
                <h3 className="font-bold text-[#1E3D52] text-[12px]">
                  แก้ไขราคาวัตถุดิบ: {editingItem.ingredient_name}
                </h3>
              </div>
              <button 
                onClick={() => setEditingItem(null)} 
                className="text-[#4A7592] hover:text-[#1E3D52] p-1 rounded-lg cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Yield Input */}
            <div className="space-y-1">
              <label className="block text-[10.5px] font-semibold text-[#1E3D52] flex items-center justify-between">
                <span>Yield % (เปอร์เซ็นต์ที่ใช้งานได้จริงหลังเตรียม)</span>
                <span className="text-[10px] font-normal text-[#4A7592]">
                  {editingItem.yield_pct}%
                </span>
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={editingItem.yield_pct}
                  onChange={(e) => setEditingItem({ ...editingItem, yield_pct: Number(e.target.value) })}
                  className="flex-1 accent-[#5BA4C8] cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editingItem.yield_pct}
                  onChange={(e) => setEditingItem({ ...editingItem, yield_pct: Math.min(100, Math.max(1, Number(e.target.value) || 100)) })}
                  style={{ border: '1px solid #C8E3F0' }}
                  className="w-14 text-center py-0.5 rounded text-[11px] font-bold font-mono outline-none"
                />
              </div>
              <p className="text-[9.5px] text-[#4A7592]">
                เช่น มะม่วง 1 กก. หลังปอกเหลือ 800 กรัม = Yield 80% (ระบบจะปรับต้นทุนขึ้นให้สอดคล้องกับส่วนที่สูญเสีย)
              </p>
            </div>

            {/* Calculation Preview */}
            <div 
              style={{ background: '#EEF6FB', border: '1px solid #5BA4C8' }}
              className="p-3 rounded-xl space-y-1"
            >
              <div className="text-[11px] font-bold text-[#1E5A7A] flex items-center gap-1.5">
                <Sparkles size={13} color="#5BA4C8" />
                <span>สรุปต้นทุนจริงหลังคำนวณ Yield</span>
              </div>
              <div className="text-[12px] font-black text-[#1E5A7A] font-mono">
                ฿ {calculateEffectiveCost(editingItem.sourcing, editingItem.yield_pct).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-[10px] font-normal text-[#4A7592] ml-1.5">
                  / {editingItem.sourcing.find(s => s.is_default)?.unit || editingItem.ingredient_unit}
                </span>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1.5">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{ border: '1px solid #C8E3F0', color: '#4A7592' }}
                className="px-3.5 py-1.5 rounded-xl text-[11px] font-semibold hover:bg-[#EEF6FB] transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUpdateItem(editingItem);
                  setEditingItem(null);
                }}
                style={{ background: '#5BA4C8', color: '#FFFFFF' }}
                className="px-4 py-1.5 rounded-xl text-[11px] font-bold shadow-xs hover:bg-[#3D7FA3] transition-all cursor-pointer"
              >
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
