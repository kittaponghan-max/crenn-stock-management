import React, { useState, useMemo } from 'react';
import { 
  Recipe, 
  RecipeIngredientItem, 
  RecipeLaborItem, 
  RecipeOtherItem, 
  ProdcalcIngredientPrice, 
  PricingMethod,
  PRODCALC_CATEGORIES 
} from '../../types/prodcalc';
import {
  Plus,
  Trash2,
  Save,
  Clock,
  Zap,
  Package,
  Calculator,
  Sparkles
} from 'lucide-react';
import {
  PageHeaderBanner,
  StandardTableCard,
  StandardTable,
  StandardThead,
  StandardHeaderRow,
  StandardTh,
  StandardTbody,
  StandardTr,
  StandardTd,
  STANDARD_NATIVE_SELECT_CLASS
} from '../ui';

interface RecipeEditorProps {
  initialRecipe?: Recipe | null;
  availableIngredients: ProdcalcIngredientPrice[];
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
  currentBranch: string;
  isReadOnly?: boolean;
}

export function RecipeEditor({ initialRecipe, availableIngredients, onSave, onCancel, currentBranch, isReadOnly = false }: RecipeEditorProps) {
  // Generate random default code
  const defaultCode = useMemo(() => {
    return `REC-${Math.floor(100 + Math.random() * 900)}`;
  }, []);

  // Form State
  const [code, setCode] = useState(initialRecipe?.code || defaultCode);
  const [name, setName] = useState(initialRecipe?.name || '');
  const [category, setCategory] = useState(initialRecipe?.category || PRODCALC_CATEGORIES[0]);
  const [image, setImage] = useState(initialRecipe?.image || '');
  const [yieldQty, setYieldQty] = useState<number>(initialRecipe?.yield_qty || 1);
  const [servingQty, setServingQty] = useState<number>(initialRecipe?.serving_qty || 1);

  // Active Tab: 'ingredients' | 'labor' | 'other'
  const [activeTab, setActiveTab] = useState<'ingredients' | 'labor' | 'other'>('ingredients');

  // Items State
  const [ingredients, setIngredients] = useState<RecipeIngredientItem[]>(initialRecipe?.ingredients || []);
  const [labor, setLabor] = useState<RecipeLaborItem[]>(initialRecipe?.labor || []);
  const [other, setOther] = useState<RecipeOtherItem[]>(initialRecipe?.other || []);

  // Pricing Strategy State
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>(initialRecipe?.pricing_method || 'margin_pct');
  const [targetMarginPct, setTargetMarginPct] = useState<number>(initialRecipe?.target_margin_pct ?? 50);
  const [targetProfitThb, setTargetProfitThb] = useState<number>(initialRecipe?.target_profit_thb ?? 20);
  const [fixedPriceInput, setFixedPriceInput] = useState<number>(initialRecipe?.selling_price ?? 50);
  const [discountPct, setDiscountPct] = useState<number>(initialRecipe?.discount_pct ?? 0);
  const [vatPct, setVatPct] = useState<number>(initialRecipe?.vat_pct ?? 0);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CALCULATIONS (ENGINE)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const calculations = useMemo(() => {
    // 1. Ingredients Cost
    const ingredientsCost = ingredients.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);

    // 2. Labor Cost
    const laborCost = labor.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);

    // 3. Other Cost
    const otherCost = other.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);

    // 4. Batch Totals
    const totalBatchCost = ingredientsCost + laborCost + otherCost;
    const safeYield = yieldQty > 0 ? yieldQty : 1;
    const costPerPiece = Number((totalBatchCost / safeYield).toFixed(4));

    // 5. Pricing Method Calculations
    let baseSellingPrice = 0;

    switch (pricingMethod) {
      case 'margin_pct': {
        // Price = Cost / (1 - Margin%)
        const marginDecimal = Math.min(0.99, Math.max(0.01, (targetMarginPct || 50) / 100));
        baseSellingPrice = costPerPiece / (1 - marginDecimal);
        break;
      }
      case 'profit_thb': {
        // Price = Cost + Profit THB
        baseSellingPrice = costPerPiece + (targetProfitThb || 0);
        break;
      }
      case 'fixed_price': {
        baseSellingPrice = Number(fixedPriceInput) || costPerPiece;
        break;
      }
      case 'discount_price': {
        // Discount price: price before discount
        const rawP = Number(fixedPriceInput) || (costPerPiece * 1.5);
        const disc = (discountPct || 0) / 100;
        baseSellingPrice = rawP * (1 - disc);
        break;
      }
      case 'net_price': {
        // Net Price including VAT
        const rawP = Number(fixedPriceInput) || (costPerPiece * 1.5);
        const vat = (vatPct || 7) / 100;
        baseSellingPrice = rawP * (1 + vat);
        break;
      }
      default:
        baseSellingPrice = costPerPiece * 2;
    }

    const finalSellingPrice = Number(baseSellingPrice.toFixed(2));
    const profitPerPiece = Number((finalSellingPrice - costPerPiece).toFixed(2));
    const profitPct = finalSellingPrice > 0 ? Number(((profitPerPiece / finalSellingPrice) * 100).toFixed(1)) : 0;

    // Cost Breakdown %
    const matPct = totalBatchCost > 0 ? Math.round((ingredientsCost / totalBatchCost) * 100) : 0;
    const labPct = totalBatchCost > 0 ? Math.round((laborCost / totalBatchCost) * 100) : 0;
    const othPct = totalBatchCost > 0 ? Math.max(0, 100 - matPct - labPct) : 0;

    return {
      ingredientsCost: Number(ingredientsCost.toFixed(2)),
      laborCost: Number(laborCost.toFixed(2)),
      otherCost: Number(otherCost.toFixed(2)),
      totalBatchCost: Number(totalBatchCost.toFixed(2)),
      costPerPiece: Number(costPerPiece.toFixed(2)),
      finalSellingPrice,
      profitPerPiece,
      profitPct,
      matPct,
      labPct,
      othPct
    };
  }, [
    ingredients, 
    labor, 
    other, 
    yieldQty, 
    pricingMethod, 
    targetMarginPct, 
    targetProfitThb, 
    fixedPriceInput, 
    discountPct, 
    vatPct
  ]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ITEM HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleAddIngredient = () => {
    if (isReadOnly) return;
    // Pick first available ingredient with price or first available
    const firstOption = availableIngredients.find(i => i.effective_cost_per_unit > 0) || availableIngredients[0];
    const newItem: RecipeIngredientItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      ingredient_price_id: firstOption ? firstOption.id : '',
      ingredient_name: firstOption ? firstOption.ingredient_name : 'เลือกวัตถุดิบ',
      qty: 1,
      unit: firstOption ? firstOption.ingredient_unit : 'หน่วย',
      unit_cost: firstOption ? firstOption.effective_cost_per_unit : 0,
      total_cost: firstOption ? firstOption.effective_cost_per_unit : 0
    };
    setIngredients([...ingredients, newItem]);
  };

  const handleUpdateIngredient = (idx: number, patch: Partial<RecipeIngredientItem>) => {
    if (isReadOnly) return;
    const updated = [...ingredients];
    const item = { ...updated[idx], ...patch };
    item.total_cost = Number(((item.qty || 0) * (item.unit_cost || 0)).toFixed(2));
    updated[idx] = item;
    setIngredients(updated);
  };

  const handleSelectIngredientOption = (idx: number, priceId: string) => {
    if (isReadOnly) return;
    const selected = availableIngredients.find(i => i.id === priceId);
    if (!selected) return;
    const updated = [...ingredients];
    const current = updated[idx];
    const unitCost = selected.effective_cost_per_unit || 0;
    updated[idx] = {
      ...current,
      ingredient_price_id: selected.id,
      ingredient_name: selected.ingredient_name,
      unit: selected.ingredient_unit,
      unit_cost: unitCost,
      total_cost: Number(((current.qty || 1) * unitCost).toFixed(2))
    };
    setIngredients(updated);
  };

  const handleDeleteIngredient = (idx: number) => {
    if (isReadOnly) return;
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  // Labor Handlers
  const handleAddLabor = () => {
    if (isReadOnly) return;
    const newItem: RecipeLaborItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      description: 'ค่าแรงเตรียม/อบ/ผสม',
      hours: 1,
      rate_per_hour: 50,
      total_cost: 50
    };
    setLabor([...labor, newItem]);
  };

  const handleUpdateLabor = (idx: number, patch: Partial<RecipeLaborItem>) => {
    if (isReadOnly) return;
    const updated = [...labor];
    const item = { ...updated[idx], ...patch };
    item.total_cost = Number(((item.hours || 0) * (item.rate_per_hour || 0)).toFixed(2));
    updated[idx] = item;
    setLabor(updated);
  };

  // Other Handlers
  const handleAddOther = () => {
    if (isReadOnly) return;
    const newItem: RecipeOtherItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      description: 'ค่าแก๊ส/ไฟฟ้า/บรรจุภัณฑ์',
      qty: 1,
      unit_cost: 15,
      total_cost: 15
    };
    setOther([...other, newItem]);
  };

  const handleUpdateOther = (idx: number, patch: Partial<RecipeOtherItem>) => {
    if (isReadOnly) return;
    const updated = [...other];
    const item = { ...updated[idx], ...patch };
    item.total_cost = Number(((item.qty || 0) * (item.unit_cost || 0)).toFixed(2));
    updated[idx] = item;
    setOther(updated);
  };

  // Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!name.trim()) {
      alert('กรุณาระบุชื่อสูตรอาหาร');
      return;
    }

    const recipeToSave: Recipe = {
      id: initialRecipe?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
      code: code.trim() || defaultCode,
      name: name.trim(),
      category,
      image,
      yield_qty: yieldQty > 0 ? yieldQty : 1,
      serving_qty: servingQty > 0 ? servingQty : 1,
      ingredients_cost: calculations.ingredientsCost,
      labor_cost: calculations.laborCost,
      other_cost: calculations.otherCost,
      total_batch_cost: calculations.totalBatchCost,
      cost_per_piece: calculations.costPerPiece,
      pricing_method: pricingMethod,
      target_margin_pct: targetMarginPct,
      target_profit_thb: targetProfitThb,
      selling_price: calculations.finalSellingPrice,
      discount_pct: discountPct,
      vat_pct: vatPct,
      profit_per_piece: calculations.profitPerPiece,
      profit_pct: calculations.profitPct,
      branch: currentBranch,
      ingredients,
      labor,
      other,
      updated_at: new Date().toISOString(),
      created_at: initialRecipe?.created_at || new Date().toISOString()
    };

    onSave(recipeToSave);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TOP HEADER BANNER */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <PageHeaderBanner
        variant="sub"
        onBack={onCancel}
        icon={<Calculator size={18} />}
        title={initialRecipe ? 'แก้ไขสูตรอาหาร' : 'สร้างสูตรอาหารและคำนวณต้นทุนใหม่'}
        branchLabel={`สาขา: ${currentBranch}`}
        subtitle="คำนวณต้นทุนวัตถุดิบ ค่าแรง และค่าใช้จ่ายอื่นๆ แบบเรียลไทม์"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-[32px] px-3.5 rounded-[8px] border border-[#D4E4E3] bg-white text-[#2D4A49] text-[11px] font-medium hover:bg-[#F0F5F4] transition-colors cursor-pointer"
            >
              {isReadOnly ? 'ย้อนกลับ' : 'ยกเลิก'}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                className="h-[32px] px-3.5 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] sm:text-[12px] font-[600] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={13} />
                <span>บันทึกสูตร</span>
              </button>
            )}
          </div>
        }
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MAIN TWO-COLUMN LAYOUT */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* LEFT COLUMN: FORM & TABS (60% / 7 cols) */}
        <div className="lg:col-span-7 space-y-4">

          {/* Card 1: Recipe Basic Info */}
          <div className="bg-white border border-[#D4E4E3] rounded-2xl p-4 shadow-[0_2px_8px_rgba(90,138,136,0.06)] space-y-3">
            <h3 className="font-bold text-[12px] text-[#2D4A49] flex items-center gap-1.5">
              <Package size={14} className="text-[#5A8A88]" />
              <span>ข้อมูลทั่วไปของสินค้า/สูตร</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div>
                <label className="block text-[10.5px] font-semibold text-[#6B8F8E] mb-1">
                  ชื่อสูตรอาหาร/สินค้า *
                </label>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  placeholder="เช่น ข้าวเหนียวมะม่วง, ชิฟฟ่อนมะพร้าว"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-[32px] px-2.5 rounded-[8px] border border-[#D4E4E3] bg-[#F8FCFC] text-[#2D4A49] text-[11px] outline-none focus:border-[#5A8A88] disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-[#6B8F8E] mb-1">
                  รหัสสูตร (Code)
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  placeholder="REC-001"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-[32px] px-2.5 rounded-[8px] border border-[#D4E4E3] bg-[#F8FCFC] text-[11px] font-mono font-bold text-[#2D4A49] outline-none focus:border-[#5A8A88] disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-[#6B8F8E] mb-1">
                  หมวดหมู่สินค้า
                </label>
                <select
                  disabled={isReadOnly}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`w-full ${STANDARD_NATIVE_SELECT_CLASS} disabled:opacity-75 disabled:cursor-not-allowed`}
                >
                  {PRODCALC_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-[#6B8F8E] mb-1">
                  รูปภาพสินค้า (Image URL)
                </label>
                <input
                  type="url"
                  disabled={isReadOnly}
                  placeholder="https://images.unsplash.com/..."
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="w-full h-[32px] px-2.5 rounded-[8px] border border-[#D4E4E3] bg-[#F8FCFC] text-[#2D4A49] text-[11px] outline-none focus:border-[#5A8A88] disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-[#6B8F8E] mb-1">
                  ผลิตได้กี่ชิ้นต่อสูตร (Batch Yield) *
                </label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  min="0.1"
                  step="any"
                  required
                  value={yieldQty}
                  onChange={(e) => setYieldQty(Math.max(0.01, Number(e.target.value) || 1))}
                  className="w-full h-[32px] px-2.5 rounded-[8px] border border-[#D4E4E3] bg-[#F8FCFC] text-[11px] tabular-nums font-bold text-[#2D4A49] outline-none focus:border-[#5A8A88] text-center disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-[#6B8F8E] mb-1">
                  ขายครั้งละกี่ชิ้น (Serving Qty)
                </label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  min="1"
                  value={servingQty}
                  onChange={(e) => setServingQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full h-[32px] px-2.5 rounded-[8px] border border-[#D4E4E3] bg-[#F8FCFC] text-[11px] tabular-nums text-[#2D4A49] outline-none focus:border-[#5A8A88] text-center disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Cost Breakdown Tabs */}
          <div className="bg-white border border-[#D4E4E3] rounded-2xl p-4 shadow-[0_2px_8px_rgba(90,138,136,0.06)] space-y-3">
            {/* Segmented Tabs Header */}
            <div className="flex items-center gap-0.5 p-0.5 bg-[#F0F5F4] rounded-[8px] border border-[#D4E4E3]">
              <button
                type="button"
                onClick={() => setActiveTab('ingredients')}
                className={`flex-1 py-1.5 rounded-[6px] text-[11px] font-[600] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'ingredients' ? 'bg-[#5A8A88] text-white shadow-xs' : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                <Package size={12} />
                <span className="tabular-nums">วัตถุดิบ ({ingredients.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('labor')}
                className={`flex-1 py-1.5 rounded-[6px] text-[11px] font-[600] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'labor' ? 'bg-[#5A8A88] text-white shadow-xs' : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                <Clock size={12} />
                <span className="tabular-nums">ค่าแรง ({labor.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('other')}
                className={`flex-1 py-1.5 rounded-[6px] text-[11px] font-[600] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'other' ? 'bg-[#5A8A88] text-white shadow-xs' : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                <Zap size={12} />
                <span className="tabular-nums">อื่นๆ ({other.length})</span>
              </button>
            </div>

            {/* TAB CONTENT: INGREDIENTS */}
            {activeTab === 'ingredients' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#2D4A49]">
                    รายการวัตถุดิบและส่วนผสม
                  </span>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={handleAddIngredient}
                      className="h-[28px] px-2.5 rounded-[8px] bg-[#E8F3F2] text-[#2D4A49] border border-[#5A8A88]/50 text-[10.5px] font-semibold flex items-center gap-1 hover:bg-[#5A8A88] hover:text-white transition-all cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>เพิ่มวัตถุดิบ</span>
                    </button>
                  )}
                </div>

                {ingredients.length === 0 ? (
                  <div className="p-6 text-center text-[11px] text-[#6B8F8E] border border-dashed border-[#D4E4E3] rounded-xl bg-[#F8FCFC]">
                    ยังไม่มีวัตถุดิบในสูตรนี้ กดปุ่ม &quot;+ เพิ่มวัตถุดิบ&quot; เพื่อเลือกจากคลังวัตถุดิบ
                  </div>
                ) : (
                  <StandardTableCard>
                    <StandardTable>
                      <StandardThead sticky={false}>
                        <StandardHeaderRow>
                          <StandardTh>ชื่อวัตถุดิบ</StandardTh>
                          <StandardTh align="center" className="w-20">จำนวน</StandardTh>
                          <StandardTh align="center" className="w-16">หน่วย</StandardTh>
                          <StandardTh align="right" className="w-24">ต้นทุน/หน่วย</StandardTh>
                          <StandardTh align="right" className="w-24">รวม (บาท)</StandardTh>
                          {!isReadOnly && <StandardTh align="center" className="w-8"></StandardTh>}
                        </StandardHeaderRow>
                      </StandardThead>
                      <StandardTbody>
                        {ingredients.map((item, idx) => (
                          <StandardTr key={item.id}>
                            <StandardTd>
                              <select
                                disabled={isReadOnly}
                                value={item.ingredient_price_id}
                                onChange={(e) => handleSelectIngredientOption(idx, e.target.value)}
                                className="w-full h-[28px] px-2 rounded-[6px] border border-[#D4E4E3] text-[10.5px] text-[#2D4A49] outline-none bg-white focus:border-[#5A8A88] cursor-pointer disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                              >
                                <option value="" disabled>-- เลือกวัตถุดิบ --</option>
                                {availableIngredients.map(ing => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.ingredient_name} ({ing.ingredient_brand}) - ฿{ing.effective_cost_per_unit.toFixed(2)}/{ing.ingredient_unit}
                                  </option>
                                ))}
                              </select>
                            </StandardTd>

                            <StandardTd align="center">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                step="any"
                                min="0.0001"
                                value={item.qty || ''}
                                onChange={(e) => handleUpdateIngredient(idx, { qty: Number(e.target.value) || 0 })}
                                className="w-full h-[28px] text-center px-1 rounded-[6px] border border-[#D4E4E3] text-[10.5px] text-[#2D4A49] tabular-nums outline-none focus:border-[#5A8A88] bg-white disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                              />
                            </StandardTd>

                            <StandardTd align="center" className="text-[#6B8F8E] text-[10.5px]">
                              {item.unit}
                            </StandardTd>

                            <StandardTd align="right" numeric className="text-[#6B8F8E] text-[10.5px]">
                              ฿{item.unit_cost.toFixed(2)}
                            </StandardTd>

                            <StandardTd align="right" numeric className="font-bold text-[#2D4A49] text-[11px]">
                              ฿{item.total_cost.toFixed(2)}
                            </StandardTd>

                            {!isReadOnly && (
                              <StandardTd align="center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteIngredient(idx)}
                                  className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </StandardTd>
                            )}
                          </StandardTr>
                        ))}
                        <tr className="bg-[#E8F3F2] font-bold text-[#2D4A49] text-[11px]">
                          <td colSpan={4} className="py-2 px-3 text-right">รวมต้นทุนวัตถุดิบ:</td>
                          <td className="py-2 px-3 text-right tabular-nums">฿{calculations.ingredientsCost.toFixed(2)}</td>
                          {!isReadOnly && <td></td>}
                        </tr>
                      </StandardTbody>
                    </StandardTable>
                  </StandardTableCard>
                )}
              </div>
            )}

            {/* TAB CONTENT: LABOR */}
            {activeTab === 'labor' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#2D4A49]">
                    รายการค่าแรงในการผลิต
                  </span>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={handleAddLabor}
                      className="h-[28px] px-2.5 rounded-[8px] bg-[#E8F3F2] text-[#2D4A49] border border-[#5A8A88]/50 text-[10.5px] font-semibold flex items-center gap-1 hover:bg-[#5A8A88] hover:text-white transition-all cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>เพิ่มค่าแรง</span>
                    </button>
                  )}
                </div>

                {labor.length === 0 ? (
                  <div className="p-6 text-center text-[11px] text-[#6B8F8E] border border-dashed border-[#D4E4E3] rounded-xl bg-[#F8FCFC]">
                    ยังไม่มีรายการค่าแรง กดปุ่ม &quot;+ เพิ่มค่าแรง&quot; เพื่อบันทึกค่าแรงต่อชั่วโมง
                  </div>
                ) : (
                  <StandardTableCard>
                    <StandardTable>
                      <StandardThead sticky={false}>
                        <StandardHeaderRow>
                          <StandardTh>รายละเอียดค่าแรง</StandardTh>
                          <StandardTh align="center" className="w-20">ชั่วโมง</StandardTh>
                          <StandardTh align="right" className="w-24">ค่าแรง/ชม. (฿)</StandardTh>
                          <StandardTh align="right" className="w-24">รวม (บาท)</StandardTh>
                          {!isReadOnly && <StandardTh align="center" className="w-8"></StandardTh>}
                        </StandardHeaderRow>
                      </StandardThead>
                      <StandardTbody>
                        {labor.map((item, idx) => (
                          <StandardTr key={item.id}>
                            <StandardTd>
                              <input
                                type="text"
                                disabled={isReadOnly}
                                placeholder="เช่น ผสมแป้ง, อบขนม, แต่งหน้าเค้ก"
                                value={item.description}
                                onChange={(e) => handleUpdateLabor(idx, { description: e.target.value })}
                                className="w-full h-[28px] px-2 rounded-[6px] border border-[#D4E4E3] text-[10.5px] text-[#2D4A49] outline-none focus:border-[#5A8A88] bg-white disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                              />
                            </StandardTd>
                            <StandardTd align="center">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                step="any"
                                min="0"
                                value={item.hours || ''}
                                onChange={(e) => handleUpdateLabor(idx, { hours: Number(e.target.value) || 0 })}
                                className="w-full h-[28px] text-center px-1 rounded-[6px] border border-[#D4E4E3] text-[10.5px] text-[#2D4A49] tabular-nums outline-none focus:border-[#5A8A88] bg-white disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                              />
                            </StandardTd>
                            <StandardTd align="right">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                step="any"
                                min="0"
                                value={item.rate_per_hour || ''}
                                onChange={(e) => handleUpdateLabor(idx, { rate_per_hour: Number(e.target.value) || 0 })}
                                className="w-full h-[28px] text-right px-1.5 rounded-[6px] border border-[#D4E4E3] text-[10.5px] text-[#2D4A49] tabular-nums outline-none focus:border-[#5A8A88] bg-white disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                              />
                            </StandardTd>
                            <StandardTd align="right" numeric className="font-bold text-[#2D4A49] text-[11px]">
                              ฿{item.total_cost.toFixed(2)}
                            </StandardTd>
                            {!isReadOnly && (
                              <StandardTd align="center">
                                <button
                                  type="button"
                                  onClick={() => setLabor(labor.filter((_, i) => i !== idx))}
                                  className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </StandardTd>
                            )}
                          </StandardTr>
                        ))}
                        <tr className="bg-[#E8F3F2] font-bold text-[#2D4A49] text-[11px]">
                          <td colSpan={3} className="py-2 px-3 text-right">รวมค่าแรง:</td>
                          <td className="py-2 px-3 text-right tabular-nums">฿{calculations.laborCost.toFixed(2)}</td>
                          {!isReadOnly && <td></td>}
                        </tr>
                      </StandardTbody>
                    </StandardTable>
                  </StandardTableCard>
                )}
              </div>
            )}

            {/* TAB CONTENT: OTHER */}
            {activeTab === 'other' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#2D4A49]">
                    รายการค่าใช้จ่ายอื่นๆ (ค่าแก๊ส, ค่าไฟ, บรรจุภัณฑ์)
                  </span>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={handleAddOther}
                      className="h-[28px] px-2.5 rounded-[8px] bg-[#E8F3F2] text-[#2D4A49] border border-[#5A8A88]/50 text-[10.5px] font-semibold flex items-center gap-1 hover:bg-[#5A8A88] hover:text-white transition-all cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>เพิ่มรายการ</span>
                    </button>
                  )}
                </div>

                {other.length === 0 ? (
                  <div className="p-6 text-center text-[11px] text-[#6B8F8E] border border-dashed border-[#D4E4E3] rounded-xl bg-[#F8FCFC]">
                    ยังไม่มีค่าใช้จ่ายอื่นๆ กดปุ่ม &quot;+ เพิ่มรายการ&quot; เพื่อเพิ่มค่าแก๊ส/ไฟ หรือกล่องบรรจุภัณฑ์
                  </div>
                ) : (
                  <StandardTableCard>
                    <StandardTable>
                      <StandardThead sticky={false}>
                        <StandardHeaderRow>
                          <StandardTh>รายละเอียด</StandardTh>
                          <StandardTh align="center" className="w-20">จำนวน</StandardTh>
                          <StandardTh align="right" className="w-24">ต้นทุน/หน่วย (฿)</StandardTh>
                          <StandardTh align="right" className="w-24">รวม (บาท)</StandardTh>
                          {!isReadOnly && <StandardTh align="center" className="w-8"></StandardTh>}
                        </StandardHeaderRow>
                      </StandardThead>
                      <StandardTbody>
                        {other.map((item, idx) => (
                          <StandardTr key={item.id}>
                            <StandardTd>
                              <input
                                type="text"
                                disabled={isReadOnly}
                                placeholder="เช่น กล่องเบเกอรี่, แก๊ส, ค่าสติกเกอร์"
                                value={item.description}
                                onChange={(e) => handleUpdateOther(idx, { description: e.target.value })}
                                className="w-full h-[28px] px-2 rounded-[6px] border border-[#D4E4E3] text-[10.5px] text-[#2D4A49] outline-none focus:border-[#5A8A88] bg-white disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                              />
                            </StandardTd>
                            <StandardTd align="center">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                step="any"
                                min="0"
                                value={item.qty || ''}
                                onChange={(e) => handleUpdateOther(idx, { qty: Number(e.target.value) || 0 })}
                                className="w-full h-[28px] text-center px-1 rounded-[6px] border border-[#D4E4E3] text-[10.5px] text-[#2D4A49] tabular-nums outline-none focus:border-[#5A8A88] bg-white disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                              />
                            </StandardTd>
                            <StandardTd align="right">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                step="any"
                                min="0"
                                value={item.unit_cost || ''}
                                onChange={(e) => handleUpdateOther(idx, { unit_cost: Number(e.target.value) || 0 })}
                                className="w-full h-[28px] text-right px-1.5 rounded-[6px] border border-[#D4E4E3] text-[10.5px] text-[#2D4A49] tabular-nums outline-none focus:border-[#5A8A88] bg-white disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                              />
                            </StandardTd>
                            <StandardTd align="right" numeric className="font-bold text-[#2D4A49] text-[11px]">
                              ฿{item.total_cost.toFixed(2)}
                            </StandardTd>
                            {!isReadOnly && (
                              <StandardTd align="center">
                                <button
                                  type="button"
                                  onClick={() => setOther(other.filter((_, i) => i !== idx))}
                                  className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </StandardTd>
                            )}
                          </StandardTr>
                        ))}
                        <tr className="bg-[#E8F3F2] font-bold text-[#2D4A49] text-[11px]">
                          <td colSpan={3} className="py-2 px-3 text-right">รวมค่าใช้จ่ายอื่นๆ:</td>
                          <td className="py-2 px-3 text-right tabular-nums">฿{calculations.otherCost.toFixed(2)}</td>
                          {!isReadOnly && <td></td>}
                        </tr>
                      </StandardTbody>
                    </StandardTable>
                  </StandardTableCard>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* RIGHT COLUMN: STICKY COST SUMMARY (40% / 5 cols) */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">

          {/* Main Calculation Card */}
          <div className="bg-white border border-[#D4E4E3] rounded-2xl p-4 shadow-[0_2px_10px_rgba(90,138,136,0.08)] space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#F0F5F4]">
              <div className="flex items-center gap-1.5">
                <Calculator size={15} className="text-[#5A8A88]" />
                <h3 className="font-bold text-[12.5px] text-[#2D4A49]">สรุปต้นทุนและการตั้งราคา</h3>
              </div>
              <span className="text-[10px] text-[#5A8A88] font-[600] bg-[#E8F3F2] px-2 py-0.5 rounded-[5px] border border-[#D4E4E3]">
                Real-time
              </span>
            </div>

            {/* Cost Rows */}
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-[#6B8F8E]">
                <span>วัตถุดิบ รวม:</span>
                <span className="tabular-nums font-semibold text-[#2D4A49]">฿{calculations.ingredientsCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[#6B8F8E]">
                <span>ค่าแรง รวม:</span>
                <span className="tabular-nums font-semibold text-[#2D4A49]">฿{calculations.laborCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[#6B8F8E]">
                <span>อื่นๆ รวม:</span>
                <span className="tabular-nums font-semibold text-[#2D4A49]">฿{calculations.otherCost.toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t border-[#F0F5F4] flex items-center justify-between text-[#2D4A49] font-bold">
                <span>รวมต้นทุนทั้งสูตร:</span>
                <span className="tabular-nums text-[12.5px]">฿{calculations.totalBatchCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[#6B8F8E] text-[10.5px]">
                <span>ผลิตได้:</span>
                <span className="tabular-nums font-semibold">{yieldQty} ชิ้น/สูตร</span>
              </div>

              {/* Cost per piece highlight */}
              <div className="bg-[#F8FCFC] border border-[#D4E4E3] p-2.5 rounded-xl flex items-center justify-between my-1.5">
                <span className="font-bold text-[11px] text-[#2D4A49]">ต้นทุนต่อชิ้น:</span>
                <span className="font-black text-[13px] text-[#2D4A49] tabular-nums">
                  ฿{calculations.costPerPiece.toFixed(2)}
                </span>
              </div>
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {/* PRICING METHOD SELECTOR */}
            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="space-y-2 pt-2 border-t border-[#F0F5F4]">
              <label className="block text-[11px] font-bold text-[#2D4A49]">
                วิธีการกำหนดราคาขาย (Pricing Method)
              </label>

              <select
                disabled={isReadOnly}
                value={pricingMethod}
                onChange={(e) => setPricingMethod(e.target.value as PricingMethod)}
                className={`w-full ${STANDARD_NATIVE_SELECT_CLASS} disabled:opacity-75 disabled:cursor-not-allowed`}
              >
                <option value="margin_pct">วิธีที่ 1: กำไร % ขั้นต้น (Target Margin %)</option>
                <option value="profit_thb">วิธีที่ 2: กำไรบาทต่อชิ้น (Target Profit THB)</option>
                <option value="fixed_price">วิธีที่ 3: กำหนดราคาขายเอง (Fixed Price)</option>
                <option value="discount_price">วิธีที่ 4: ราคาหลังหักส่วนลด (Discount Price)</option>
                <option value="net_price">วิธีที่ 5: ราคาขายสุทธิรวม VAT (Net Price incl. VAT)</option>
              </select>

              {/* Dynamic Inputs Based on Method */}
              {pricingMethod === 'margin_pct' && (
                <div className="p-2.5 rounded-xl bg-[#F8FCFC] border border-[#D4E4E3] space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#6B8F8E] font-semibold">เป้าหมายกำไร (%):</span>
                    <span className="tabular-nums font-bold text-[#2D4A49]">{targetMarginPct}%</span>
                  </div>
                  <input
                    type="range"
                    disabled={isReadOnly}
                    min="1"
                    max="90"
                    value={targetMarginPct}
                    onChange={(e) => setTargetMarginPct(Number(e.target.value))}
                    className="w-full accent-[#5A8A88] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[9.5px] text-[#6B8F8E] tabular-nums">
                    <span>10%</span>
                    <span>30%</span>
                    <span>50% (แนะนำ)</span>
                    <span>70%</span>
                  </div>
                </div>
              )}

              {pricingMethod === 'profit_thb' && (
                <div className="p-2.5 rounded-xl bg-[#F8FCFC] border border-[#D4E4E3] space-y-1 text-[11px]">
                  <label className="block text-[#6B8F8E] font-semibold">
                    ต้องการกำไรต่อชิ้น (บาท):
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B8F8E] text-[10px]">฿</span>
                    <input
                      type="number"
                      disabled={isReadOnly}
                      step="any"
                      min="0"
                      value={targetProfitThb}
                      onChange={(e) => setTargetProfitThb(Number(e.target.value) || 0)}
                      className="w-full h-[32px] pl-6 pr-2.5 rounded-[8px] border border-[#D4E4E3] text-[#2D4A49] text-[11px] tabular-nums font-bold bg-white outline-none focus:border-[#5A8A88] disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {pricingMethod === 'fixed_price' && (
                <div className="p-2.5 rounded-xl bg-[#F8FCFC] border border-[#D4E4E3] space-y-1 text-[11px]">
                  <label className="block text-[#6B8F8E] font-semibold">
                    ระบุราคาขายที่ต้องการ (บาท):
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B8F8E] text-[10px]">฿</span>
                    <input
                      type="number"
                      disabled={isReadOnly}
                      step="any"
                      min="0"
                      value={fixedPriceInput}
                      onChange={(e) => setFixedPriceInput(Number(e.target.value) || 0)}
                      className="w-full h-[32px] pl-6 pr-2.5 rounded-[8px] border border-[#D4E4E3] text-[#2D4A49] text-[11px] tabular-nums font-bold bg-white outline-none focus:border-[#5A8A88] disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {pricingMethod === 'discount_price' && (
                <div className="p-2.5 rounded-xl bg-[#F8FCFC] border border-[#D4E4E3] space-y-2 text-[11px]">
                  <div>
                    <label className="block text-[#6B8F8E] font-semibold mb-1">ราคาป้ายปกติ (บาท):</label>
                    <input
                      type="number"
                      disabled={isReadOnly}
                      step="any"
                      value={fixedPriceInput}
                      onChange={(e) => setFixedPriceInput(Number(e.target.value) || 0)}
                      className="w-full h-[32px] px-2.5 rounded-[8px] border border-[#D4E4E3] text-[#2D4A49] text-[11px] tabular-nums font-bold bg-white outline-none focus:border-[#5A8A88] disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[#6B8F8E] font-semibold mb-1">ส่วนลดโปรโมชั่น (%):</label>
                    <input
                      type="number"
                      disabled={isReadOnly}
                      min="0"
                      max="90"
                      value={discountPct}
                      onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
                      className="w-full h-[32px] px-2.5 rounded-[8px] border border-[#D4E4E3] text-[#2D4A49] text-[11px] tabular-nums bg-white outline-none focus:border-[#5A8A88] disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {pricingMethod === 'net_price' && (
                <div className="p-2.5 rounded-xl bg-[#F8FCFC] border border-[#D4E4E3] space-y-2 text-[11px]">
                  <div>
                    <label className="block text-[#6B8F8E] font-semibold mb-1">ราคาฐานก่อนภาษี (บาท):</label>
                    <input
                      type="number"
                      disabled={isReadOnly}
                      step="any"
                      value={fixedPriceInput}
                      onChange={(e) => setFixedPriceInput(Number(e.target.value) || 0)}
                      className="w-full h-[32px] px-2.5 rounded-[8px] border border-[#D4E4E3] text-[#2D4A49] text-[11px] tabular-nums font-bold bg-white outline-none focus:border-[#5A8A88] disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[#6B8F8E] font-semibold mb-1">อัตราภาษีมูลค่าเพิ่ม VAT (%):</label>
                    <input
                      type="number"
                      disabled={isReadOnly}
                      min="0"
                      max="30"
                      value={vatPct}
                      onChange={(e) => setVatPct(Number(e.target.value) || 0)}
                      className="w-full h-[32px] px-2.5 rounded-[8px] border border-[#D4E4E3] text-[#2D4A49] text-[11px] tabular-nums bg-white outline-none focus:border-[#5A8A88] disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {/* RESULT HIGHLIGHT BOX */}
            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="bg-[#E8F3F2] border border-[#5A8A88] rounded-2xl p-3.5 space-y-2">
              <div className="text-[11px] font-bold text-[#2D4A49] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#5A8A88]" />
                  <span>ผลลัพธ์ราคาขายและกำไร</span>
                </span>
                <span className="bg-white px-2 py-0.5 rounded-[5px] border border-[#D4E4E3] text-[10px] font-[600] text-[#5A8A88]">
                  {calculations.profitPct >= 50 ? 'กำไรดีเยี่ยม' : calculations.profitPct >= 30 ? 'กำไรปานกลาง' : 'กำไรต่ำ'}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-[#6B8F8E] font-semibold">ราคาขายที่แนะนำ:</span>
                <span className="text-[15px] font-black text-[#2D4A49] tabular-nums">
                  ฿{calculations.finalSellingPrice.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#D4E4E3]">
                <span className="text-[#6B8F8E]">กำไรสุทธิต่อชิ้น:</span>
                <span className="font-bold text-emerald-600 tabular-nums text-[11.5px]">
                  +฿{calculations.profitPerPiece.toFixed(2)} ({calculations.profitPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Cost Structure Bar Chart */}
            <div className="space-y-1.5 pt-0.5 text-[10.5px]">
              <div className="flex items-center justify-between text-[10px] text-[#6B8F8E]">
                <span>สัดส่วนต้นทุน:</span>
                <span className="tabular-nums">
                  วัตถุดิบ {calculations.matPct}% · ค่าแรง {calculations.labPct}% · อื่นๆ {calculations.othPct}%
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-[#F0F5F4]">
                <div
                  style={{ width: `${calculations.matPct}%` }}
                  className="bg-[#5A8A88]"
                  title={`วัตถุดิบ: ${calculations.matPct}%`}
                />
                <div
                  style={{ width: `${calculations.labPct}%` }}
                  className="bg-[#2D4A49]"
                  title={`ค่าแรง: ${calculations.labPct}%`}
                />
                <div
                  style={{ width: `${calculations.othPct}%` }}
                  className="bg-[#D4A853]"
                  title={`อื่นๆ: ${calculations.othPct}%`}
                />
              </div>
            </div>

            {/* Save Button */}
            {!isReadOnly && (
              <button
                type="submit"
                className="w-full h-[36px] rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white font-[600] text-[12px] shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
              >
                <Save size={14} />
                <span>บันทึกสูตรและราคาขาย</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </form>
  );
}
