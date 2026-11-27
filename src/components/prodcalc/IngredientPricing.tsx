import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { sendDiscordNotification } from '../../lib/discordNotify';
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
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Package,
  FlaskConical,
  Filter,
  Save
} from 'lucide-react';
import {
  PageHeaderBanner,
  StandardDropdown,
  StandardTableCard,
  StandardTable,
  StandardThead,
  StandardHeaderRow,
  StandardTh,
  StandardTbody,
  StandardTr,
  StandardTd,
  StandardTableEmpty
} from '../ui';

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
          .upsert(payload, { onConflict: 'ingredient_id,branch' });
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

  const categoryOptions = useMemo(() => [
    { value: 'ALL', label: 'ทุกหมวดหมู่', count: items.length },
    ...categories.map(cat => ({
      value: cat,
      label: cat,
      count: items.filter(i => i.category === cat).length
    }))
  ], [categories, items]);

  return (
    <div className="space-y-4">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* HEADER BANNER & FILTER TOOLBAR */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <PageHeaderBanner
        variant="sub"
        icon={<FlaskConical size={18} />}
        title="รายการวัตถุดิบ (Ingredient Pricing)"
        branchLabel={`สาขา: ${currentBranch}`}
        subtitle="ดึงข้อมูลจาก Cafe Management System · อัปเดต Yield และราคาจากแหล่งจัดซื้อเพื่อคำนวณต้นทุน"
        actions={
          !isReadOnly ? (
            <button
              type="button"
              onClick={() => syncWithCMS(items)}
              disabled={isSyncing}
              className="flex items-center gap-1.5 h-[32px] px-3.5 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] sm:text-[12px] font-[600] shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'กำลัง Sync...' : 'Sync จาก CMS'}</span>
            </button>
          ) : undefined
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
            <div className="flex items-center gap-2 flex-1 min-w-[220px] flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B8F8E] pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อวัตถุดิบ หรือยี่ห้อ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-[32px] pl-8 pr-2.5 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-[11px] outline-none focus:border-[#5A8A88] transition-colors"
                />
              </div>

              {categories.length > 0 && (
                <StandardDropdown
                  options={categoryOptions}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  leadingIcon={<Filter size={12} />}
                  ariaLabel="กรองตามหมวดหมู่"
                />
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-[#2D4A49] font-medium">
              <input
                type="checkbox"
                checked={showPricedOnly}
                onChange={(e) => setShowPricedOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#5A8A88] border-[#D4E4E3] focus:ring-0 cursor-pointer"
              />
              <span className="tabular-nums">แสดงเฉพาะที่ตั้งราคาแล้ว ({items.filter(i => i.effective_cost_per_unit > 0).length})</span>
            </label>
          </div>
        }
      />

      {/* Sync Toast Notification */}
      {syncMessage && (
        <div className="bg-[#E8F3F2] border border-[#5A8A88]/60 text-[#2D4A49] p-2.5 rounded-xl text-[11px] font-medium flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-[#5A8A88] shrink-0" />
            <span>{syncMessage}</span>
          </div>
          <button type="button" onClick={() => setSyncMessage(null)} className="text-[#6B8F8E] hover:text-[#2D4A49] cursor-pointer">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TABLE */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <StandardTableCard>
        <StandardTable fixedLayout minWidthClassName="min-w-[780px]">
          <colgroup>
            <col className="w-[44px]" />
            <col className="w-auto" />
            <col className="w-[82px]" />
            <col className="w-[108px]" />
            <col className="w-[208px]" />
            <col className="w-[74px]" />
            <col className="w-[98px]" />
            {!isReadOnly && <col className="w-[66px]" />}
          </colgroup>
          <StandardThead sticky={false}>
            <StandardHeaderRow>
              <StandardTh compact align="center">รูป</StandardTh>
              <StandardTh compact>ชื่อวัตถุดิบ (CMS)</StandardTh>
              <StandardTh compact>ยี่ห้อ</StandardTh>
              <StandardTh compact>ขนาด/หน่วย</StandardTh>
              <StandardTh compact>Sourcing (แหล่งราคา)</StandardTh>
              <StandardTh compact align="center">Yield %</StandardTh>
              <StandardTh compact align="right">ต้นทุน/หน่วย</StandardTh>
              {!isReadOnly && <StandardTh compact align="right">จัดการ</StandardTh>}
            </StandardHeaderRow>
          </StandardThead>
          <StandardTbody>
            {isLoading ? (
              <tr>
                <td colSpan={isReadOnly ? 7 : 8} className="py-10 text-center text-[#6B8F8E]">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw size={20} className="animate-spin text-[#5A8A88]" />
                    <span className="text-[11px]">กำลังโหลดข้อมูลวัตถุดิบ...</span>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <StandardTableEmpty
                colSpan={isReadOnly ? 7 : 8}
                icon={<Package size={22} />}
                title="ไม่พบรายการวัตถุดิบ"
                description={!isReadOnly ? 'กดปุ่ม "Sync จาก CMS" เพื่อดึงข้อมูลจากระบบหลัก' : undefined}
              />
            ) : (
              filteredItems.map((item, index) => {
                const defaultSource = item.sourcing.find(s => s.is_default) || item.sourcing[0];
                const hasPrice = item.effective_cost_per_unit > 0;
                const isExpanded = expandedId === item.id;
                const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-[#F8FCFC]';

                return (
                  <React.Fragment key={item.id}>
                    <StandardTr className={rowBg}>
                      {/* Image */}
                      <StandardTd compact align="center">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.ingredient_name}
                            className="w-7 h-7 rounded-lg object-cover mx-auto border border-[#D4E4E3]"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-[#E8F3F2] border border-[#D4E4E3]/60 flex items-center justify-center mx-auto text-[#5A8A88]">
                            <FlaskConical size={13} />
                          </div>
                        )}
                      </StandardTd>

                      {/* Name */}
                      <StandardTd compact>
                        <div className="font-semibold text-[#2D4A49] text-[11.5px] sm:text-[12px] leading-[1.35] break-words">
                          {item.ingredient_name}
                        </div>
                        {item.category && (
                          <span className="inline-block mt-0.5 text-[10px] font-medium text-[#6B8F8E] bg-[#F0F5F4] px-1.5 py-0.5 rounded-[5px] border border-[#D4E4E3] whitespace-nowrap">
                            {item.category}
                          </span>
                        )}
                      </StandardTd>

                      {/* Brand */}
                      <StandardTd compact className="text-[#6B8F8E] text-[11px] break-words">
                        {item.ingredient_brand || '-'}
                      </StandardTd>

                      {/* Size Per Unit */}
                      <StandardTd compact numeric className="text-[#2D4A49] font-medium text-[11px] leading-[1.35] break-words">
                        {item.size_per_unit || item.ingredient_unit}
                      </StandardTd>

                      {/* Sourcing */}
                      <StandardTd compact>
                        <div className="flex items-center justify-between gap-1.5">
                          {defaultSource && defaultSource.price > 0 ? (
                            <div className="min-w-0 leading-tight">
                              <div className="text-[10.5px] font-semibold text-[#2D4A49] truncate">
                                {defaultSource.source_name}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                <span className="font-bold text-[#2D4A49] tabular-nums text-[11px]">
                                  ฿{defaultSource.price.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-[#6B8F8E] tabular-nums">
                                  /{defaultSource.qty} {defaultSource.unit}
                                </span>
                                {item.sourcing.length > 1 && (
                                  <span className="text-[9.5px] bg-[#E8F3F2] text-[#5A8A88] border border-[#D4E4E3] px-1 py-0.2 rounded-[5px] font-bold tabular-nums shrink-0">
                                    +{item.sourcing.length - 1}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shrink-0">
                              <AlertTriangle size={10} className="shrink-0" />
                              ยังไม่ตั้งราคา
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="h-[28px] px-2 rounded-[6px] border border-[#D4E4E3] bg-white text-[10.5px] font-semibold text-[#2D4A49] hover:bg-[#E8F3F2] hover:border-[#5A8A88] transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <span>{isExpanded ? 'ซ่อน' : (isReadOnly ? 'ดูแหล่ง' : 'จัดการแหล่ง')}</span>
                            {isExpanded ? <ChevronUp size={11} className="text-[#5A8A88]" /> : <ChevronDown size={11} className="text-[#5A8A88]" />}
                          </button>
                        </div>
                      </StandardTd>

                      {/* Yield % */}
                      <StandardTd compact align="center" nowrap>
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
                            className={`w-11 h-[28px] text-center rounded-[6px] border border-[#D4E4E3] text-[11px] font-bold tabular-nums outline-none focus:border-[#5A8A88] bg-white disabled:bg-[#F0F5F4] disabled:cursor-not-allowed ${
                              item.yield_pct === 100 ? 'text-emerald-600' : item.yield_pct >= 70 ? 'text-[#2D4A49]' : 'text-amber-600'
                            }`}
                          />
                          <span className="text-[10px] text-[#6B8F8E] font-semibold">%</span>
                        </div>
                      </StandardTd>

                      {/* Effective Cost Per Unit */}
                      <StandardTd compact align="right" numeric nowrap>
                        {hasPrice ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="px-2 py-0.5 rounded-[6px] bg-[#E8F3F2] border border-[#D4E4E3] font-bold text-[11.5px] text-[#2D4A49] tabular-nums whitespace-nowrap">
                              ฿{item.effective_cost_per_unit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-[#6B8F8E] mt-0.5 whitespace-nowrap">
                              ต่อ {defaultSource?.unit || item.ingredient_unit}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#A8BCBB] tabular-nums text-[11px]">—</span>
                        )}
                      </StandardTd>

                      {/* Actions */}
                      {!isReadOnly && (
                        <StandardTd compact align="right" nowrap>
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingItem(item)}
                              title="แก้ไขราคาและแหล่งซื้อ"
                              className="w-[28px] h-[28px] inline-flex items-center justify-center rounded-[6px] border border-transparent text-[#5A8A88] hover:bg-[#E8F3F2] hover:border-[#D4E4E3] transition-colors cursor-pointer shrink-0"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetPricing(item)}
                              title="ล้างข้อมูลราคาใน ProdCalc"
                              className="w-[28px] h-[28px] inline-flex items-center justify-center rounded-[6px] border border-transparent text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </StandardTd>
                      )}
                    </StandardTr>

                      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                      {/* EXPANDED SOURCING PANEL */}
                      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                      {isExpanded && (
                        <tr className="bg-[#F8FCFC]">
                          <td colSpan={isReadOnly ? 7 : 8} className="p-3 border-t border-b border-[#D4E4E3]">
                            <div className="bg-white p-3.5 rounded-xl border border-[#D4E4E3] space-y-2.5">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-[#2D4A49] text-[11.5px]">
                                    แหล่งจัดซื้อ (Sourcing Options) สำหรับ: {item.ingredient_name}
                                  </span>
                                  {!isReadOnly && (
                                    <span className="text-[10px] text-[#6B8F8E] bg-[#E8F3F2] px-2 py-0.5 rounded-[5px] border border-[#D4E4E3]">
                                      คลิก ⭐ เพื่อเลือกเป็นราคาหลัก (ระบบจะเลือกรายการราคาสูงสุดให้อัตโนมัติ)
                                    </span>
                                  )}
                                </div>

                                {!isReadOnly && (
                                  <div className="flex items-center gap-2 self-end sm:self-center">
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
                                      className="h-[32px] px-3 rounded-[8px] bg-[#E8F3F2] text-[#2D4A49] border border-[#5A8A88]/50 text-[11px] font-[600] flex items-center gap-1.5 hover:bg-[#5A8A88] hover:text-white transition-all cursor-pointer"
                                    >
                                      <Plus size={12} />
                                      <span>เพิ่มแหล่งซื้อ</span>
                                    </button>

                                    {/* ปุ่ม บันทึก (Save button) */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateItem(item);
                                        const effectiveCost = calculateEffectiveCost(item.sourcing, item.yield_pct);
                                        const unitLabel = item.sourcing.find(s => s.is_default)?.unit || item.ingredient_unit;
                                        sendDiscordNotification(
                                          `🧮 **[อัปเดตราคาวัตถุดิบ ProdCalc - สาขา ${currentBranch}]**\n` +
                                          `📦 วัตถุดิบ: ${item.ingredient_name}\n` +
                                          `🧪 Yield: ${item.yield_pct}%\n` +
                                          `💰 ต้นทุนสุทธิ: ฿${effectiveCost.toFixed(2)} / ${unitLabel}`,
                                          'notifyOnProdCalcIngredients'
                                        );
                                        setExpandedId(null);
                                      }}
                                      className="h-[32px] px-3.5 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] sm:text-[12px] font-[600] flex items-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
                                      title="บันทึกข้อมูลแหล่งจัดซื้อ"
                                    >
                                      <Save size={13} />
                                      <span>บันทึก</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              <StandardTableCard>
                                <StandardTable minWidthClassName="min-w-[620px]">
                                  <StandardThead sticky={false}>
                                    <StandardHeaderRow level="secondary">
                                      <StandardTh compact align="center" className="w-16">ราคาหลัก</StandardTh>
                                      <StandardTh compact>ชื่อแหล่งซื้อ (Vendor/Store)</StandardTh>
                                      <StandardTh compact className="w-28">ราคา (บาท)</StandardTh>
                                      <StandardTh compact className="w-24">ปริมาณ</StandardTh>
                                      <StandardTh compact className="w-24">หน่วย</StandardTh>
                                      <StandardTh compact align="right">ต้นทุน/หน่วยดิบ</StandardTh>
                                      <StandardTh compact align="center" className="w-9"></StandardTh>
                                    </StandardHeaderRow>
                                  </StandardThead>
                                  <StandardTbody>
                                    {item.sourcing.map((source, sIdx) => {
                                      const rawCost = source.qty > 0 ? source.price / source.qty : 0;
                                      return (
                                        <StandardTr key={source.id} className={source.is_default ? 'bg-[#E8F3F2]/50' : ''}>
                                          {/* Default Radio */}
                                          <StandardTd compact align="center">
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
                                          </StandardTd>

                                          {/* Source Name */}
                                          <StandardTd compact>
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
                                              className="w-full h-[28px] px-2 rounded-[6px] border border-[#D4E4E3] text-[11px] text-[#2D4A49] outline-none focus:border-[#5A8A88] bg-white disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                                            />
                                          </StandardTd>

                                          {/* Price */}
                                          <StandardTd compact>
                                            <div className="relative">
                                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6B8F8E] text-[10px]">฿</span>
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
                                                className="w-full h-[28px] pl-5 pr-2 rounded-[6px] border border-[#D4E4E3] text-[11px] text-[#2D4A49] tabular-nums font-bold outline-none focus:border-[#5A8A88] bg-white text-right disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                                              />
                                            </div>
                                          </StandardTd>

                                          {/* Qty */}
                                          <StandardTd compact>
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
                                              className="w-full h-[28px] px-1.5 rounded-[6px] border border-[#D4E4E3] text-[11px] text-[#2D4A49] tabular-nums outline-none focus:border-[#5A8A88] bg-white text-center disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                                            />
                                          </StandardTd>

                                          {/* Unit */}
                                          <StandardTd compact>
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
                                              className="w-full h-[28px] px-1.5 rounded-[6px] border border-[#D4E4E3] text-[11px] text-[#2D4A49] outline-none focus:border-[#5A8A88] bg-white text-center disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                                            />
                                          </StandardTd>

                                          {/* Raw Cost */}
                                          <StandardTd compact align="right" numeric nowrap className="font-semibold text-[#2D4A49]">
                                            ฿{rawCost.toFixed(2)}
                                          </StandardTd>

                                          {/* Delete Source */}
                                          <StandardTd compact align="center">
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
                                          </StandardTd>
                                        </StandardTr>
                                      );
                                    })}
                                  </StandardTbody>
                                </StandardTable>
                              </StandardTableCard>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </StandardTbody>
          </StandardTable>
      </StandardTableCard>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* EDIT MODAL */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {!isReadOnly && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#D4E4E3] rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#D4E4E3]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[8px] bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center">
                  <Edit3 size={14} />
                </div>
                <h3 className="font-bold text-[#2D4A49] text-[13px]">
                  แก้ไขราคาวัตถุดิบ: {editingItem.ingredient_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-[28px] h-[28px] flex items-center justify-center text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#F0F5F4] rounded-[8px] cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Yield Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#2D4A49] flex items-center justify-between">
                <span>Yield % (เปอร์เซ็นต์ที่ใช้งานได้จริงหลังเตรียม)</span>
                <span className="text-[11px] font-bold tabular-nums text-[#5A8A88]">
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
                  className="flex-1 accent-[#5A8A88] cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editingItem.yield_pct}
                  onChange={(e) => setEditingItem({ ...editingItem, yield_pct: Math.min(100, Math.max(1, Number(e.target.value) || 100)) })}
                  className="w-14 h-[30px] text-center rounded-[8px] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-bold tabular-nums outline-none focus:border-[#5A8A88]"
                />
              </div>
              <p className="text-[10px] text-[#6B8F8E]">
                เช่น มะม่วง 1 กก. หลังปอกเหลือ 800 กรัม = Yield 80% (ระบบจะปรับต้นทุนขึ้นให้สอดคล้องกับส่วนที่สูญเสีย)
              </p>
            </div>

            {/* Calculation Preview */}
            <div className="bg-[#E8F3F2] border border-[#5A8A88]/60 p-3 rounded-xl space-y-1">
              <div className="text-[11px] font-bold text-[#2D4A49] flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#5A8A88]" />
                <span>สรุปต้นทุนจริงหลังคำนวณ Yield</span>
              </div>
              <div className="text-[14px] font-black text-[#2D4A49] tabular-nums">
                ฿ {calculateEffectiveCost(editingItem.sourcing, editingItem.yield_pct).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-[10.5px] font-normal text-[#6B8F8E] ml-1.5">
                  / {editingItem.sourcing.find(s => s.is_default)?.unit || editingItem.ingredient_unit}
                </span>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1.5">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="h-[32px] px-3.5 rounded-[8px] border border-[#D4E4E3] bg-white text-[#2D4A49] text-[11px] font-medium hover:bg-[#F0F5F4] transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUpdateItem(editingItem);
                  const effectiveCost = calculateEffectiveCost(editingItem.sourcing, editingItem.yield_pct);
                  const unitLabel = editingItem.sourcing.find(s => s.is_default)?.unit || editingItem.ingredient_unit;
                  sendDiscordNotification(
                    `🧮 **[อัปเดต Yield & ต้นทุน ProdCalc - สาขา ${currentBranch}]**\n` +
                    `📦 วัตถุดิบ: ${editingItem.ingredient_name}\n` +
                    `🧪 Yield: ${editingItem.yield_pct}%\n` +
                    `💰 ต้นทุนสุทธิ: ฿${effectiveCost.toFixed(2)} / ${unitLabel}`,
                    'notifyOnProdCalcIngredients'
                  );
                  setEditingItem(null);
                }}
                className="h-[32px] px-4 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] sm:text-[12px] font-[600] shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save size={13} />
                <span>บันทึกการเปลี่ยนแปลง</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
