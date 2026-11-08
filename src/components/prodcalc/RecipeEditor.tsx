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
  X, 
  DollarSign, 
  Clock, 
  Zap, 
  Package, 
  Calculator, 
  ArrowLeft, 
  Percent, 
  Sparkles,
  PieChart,
  HelpCircle,
  Upload
} from 'lucide-react';

interface RecipeEditorProps {
  initialRecipe?: Recipe | null;
  availableIngredients: ProdcalcIngredientPrice[];
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
  currentBranch: string;
}

export function RecipeEditor({ initialRecipe, availableIngredients, onSave, onCancel, currentBranch }: RecipeEditorProps) {
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
    const updated = [...ingredients];
    const item = { ...updated[idx], ...patch };
    item.total_cost = Number(((item.qty || 0) * (item.unit_cost || 0)).toFixed(2));
    updated[idx] = item;
    setIngredients(updated);
  };

  const handleSelectIngredientOption = (idx: number, priceId: string) => {
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
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  // Labor Handlers
  const handleAddLabor = () => {
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
    const updated = [...labor];
    const item = { ...updated[idx], ...patch };
    item.total_cost = Number(((item.hours || 0) * (item.rate_per_hour || 0)).toFixed(2));
    updated[idx] = item;
    setLabor(updated);
  };

  // Other Handlers
  const handleAddOther = () => {
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
    const updated = [...other];
    const item = { ...updated[idx], ...patch };
    item.total_cost = Number(((item.qty || 0) * (item.unit_cost || 0)).toFixed(2));
    updated[idx] = item;
    setOther(updated);
  };

  // Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      {/* TOP HEADER BAR */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div 
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #C8E3F0',
          borderRadius: '16px',
          padding: '12px 18px',
          boxShadow: '0 4px 16px rgba(90, 164, 200, 0.08)'
        }}
        className="flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-xl border border-[#C8E3F0] text-[#4A7592] hover:bg-[#EEF6FB] hover:text-[#1E3D52] transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="font-bold text-[#1E3D52] text-[12px]">
              {initialRecipe ? 'แก้ไขสูตรอาหาร' : 'สร้างสูตรอาหารและคำนวณต้นทุนใหม่'}
            </h1>
            <span className="text-[9.5px] text-[#4A7592]">
              คำนวณต้นทุนวัตถุดิบ ค่าแรง และค่าใช้จ่ายอื่นๆ แบบเรียลไทม์
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            style={{ border: '1px solid #C8E3F0', color: '#4A7592' }}
            className="px-3 py-1 rounded-xl text-[11px] font-semibold hover:bg-[#EEF6FB] transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            style={{ background: '#5BA4C8', color: '#FFFFFF' }}
            className="px-3.5 py-1 rounded-xl text-[11px] font-bold shadow-xs hover:bg-[#3D7FA3] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save size={13} />
            <span>บันทึกสูตร</span>
          </button>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MAIN TWO-COLUMN LAYOUT */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* LEFT COLUMN: FORM & TABS (60% / 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Card 1: Recipe Basic Info */}
          <div 
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #C8E3F0',
              borderRadius: '16px',
              padding: '14px',
              boxShadow: '0 4px 16px rgba(90, 164, 200, 0.05)'
            }}
            className="space-y-2.5"
          >
            <h3 className="font-bold text-[11px] text-[#1E3D52] flex items-center gap-1.5">
              <Package size={13} color="#5BA4C8" />
              <span>ข้อมูลทั่วไปของสินค้า/สูตร</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[10.5px]">
              <div>
                <label className="block text-[10px] font-semibold text-[#4A7592] mb-0.5">
                  ชื่อสูตรอาหาร/สินค้า *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ข้าวเหนียวมะม่วง, ชิฟฟ่อนมะพร้าว"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ border: '1px solid #C8E3F0', background: '#F8FCFE' }}
                  className="w-full px-2.5 py-1 rounded-lg text-[10.5px] outline-none focus:border-[#5BA4C8]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#4A7592] mb-0.5">
                  รหัสสูตร (Code)
                </label>
                <input
                  type="text"
                  placeholder="REC-001"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={{ border: '1px solid #C8E3F0', background: '#F8FCFE' }}
                  className="w-full px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold text-[#1E5A7A] outline-none focus:border-[#5BA4C8]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#4A7592] mb-0.5">
                  หมวดหมู่สินค้า
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ border: '1px solid #C8E3F0', background: '#F8FCFE' }}
                  className="w-full px-2.5 py-1 rounded-lg text-[10.5px] outline-none cursor-pointer"
                >
                  {PRODCALC_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#4A7592] mb-0.5">
                  รูปภาพสินค้า (Image URL)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  style={{ border: '1px solid #C8E3F0', background: '#F8FCFE' }}
                  className="w-full px-2.5 py-1 rounded-lg text-[10.5px] outline-none focus:border-[#5BA4C8]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#4A7592] mb-0.5">
                  ผลิตได้กี่ชิ้นต่อสูตร (Batch Yield) *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={yieldQty}
                  onChange={(e) => setYieldQty(Math.max(0.01, Number(e.target.value) || 1))}
                  style={{ border: '1px solid #C8E3F0', background: '#F8FCFE' }}
                  className="w-full px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold text-[#1E3D52] outline-none text-center"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#4A7592] mb-0.5">
                  ขายครั้งละกี่ชิ้น (Serving Qty)
                </label>
                <input
                  type="number"
                  min="1"
                  value={servingQty}
                  onChange={(e) => setServingQty(Math.max(1, Number(e.target.value) || 1))}
                  style={{ border: '1px solid #C8E3F0', background: '#F8FCFE' }}
                  className="w-full px-2.5 py-1 rounded-lg text-[10.5px] font-mono outline-none text-center"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Cost Breakdown Tabs */}
          <div 
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #C8E3F0',
              borderRadius: '16px',
              padding: '14px',
              boxShadow: '0 4px 16px rgba(90, 164, 200, 0.05)'
            }}
            className="space-y-3"
          >
            {/* Tabs Header */}
            <div className="flex items-center gap-1.5 p-1 bg-[#EEF6FB] rounded-xl border border-[#C8E3F0]">
              <button
                type="button"
                onClick={() => setActiveTab('ingredients')}
                style={{
                  background: activeTab === 'ingredients' ? '#5BA4C8' : 'transparent',
                  color: activeTab === 'ingredients' ? '#FFFFFF' : '#4A7592'
                }}
                className="flex-1 py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Package size={12} />
                <span>📦 วัตถุดิบ ({ingredients.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('labor')}
                style={{
                  background: activeTab === 'labor' ? '#5BA4C8' : 'transparent',
                  color: activeTab === 'labor' ? '#FFFFFF' : '#4A7592'
                }}
                className="flex-1 py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Clock size={12} />
                <span>👷 ค่าแรง ({labor.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('other')}
                style={{
                  background: activeTab === 'other' ? '#5BA4C8' : 'transparent',
                  color: activeTab === 'other' ? '#FFFFFF' : '#4A7592'
                }}
                className="flex-1 py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Zap size={12} />
                <span>⚡ อื่นๆ ({other.length})</span>
              </button>
            </div>

            {/* TAB CONTENT: INGREDIENTS */}
            {activeTab === 'ingredients' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#1E3D52]">
                    รายการวัตถุดิบและส่วนผสม
                  </span>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    style={{ background: '#EEF6FB', color: '#1E5A7A', border: '1px solid #5BA4C8' }}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-[#5BA4C8] hover:text-white transition-all cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>เพิ่มวัตถุดิบ</span>
                  </button>
                </div>

                {ingredients.length === 0 ? (
                  <div className="p-5 text-center text-[10.5px] text-[#4A7592] border border-dashed border-[#C8E3F0] rounded-xl bg-[#F8FCFE]">
                    ยังไม่มีวัตถุดิบในสูตรนี้ กดปุ่ม "+ เพิ่มวัตถุดิบ" เพื่อเลือกจากคลังวัตถุดิบ
                  </div>
                ) : (
                  <div className="border border-[#C8E3F0] rounded-xl overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead style={{ background: '#1E5A7A', color: '#FFFFFF' }}>
                        <tr>
                          <th className="py-1.5 px-2.5 text-left">ชื่อวัตถุดิบ</th>
                          <th className="py-1.5 px-2 w-16 text-center">จำนวน</th>
                          <th className="py-1.5 px-2 w-14 text-center">หน่วย</th>
                          <th className="py-1.5 px-2 w-20 text-right">ต้นทุน/หน่วย</th>
                          <th className="py-1.5 px-2.5 w-20 text-right">รวม (บาท)</th>
                          <th className="py-1.5 px-1 w-7 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4F1F8]">
                        {ingredients.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-[#F8FCFE]">
                            <td className="py-1 px-2.5">
                              <select
                                value={item.ingredient_price_id}
                                onChange={(e) => handleSelectIngredientOption(idx, e.target.value)}
                                style={{ border: '1px solid #C8E3F0' }}
                                className="w-full px-2 py-0.5 rounded text-[10px] outline-none bg-white cursor-pointer"
                              >
                                <option value="" disabled>-- เลือกวัตถุดิบ --</option>
                                {availableIngredients.map(ing => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.ingredient_name} ({ing.ingredient_brand}) - ฿{ing.effective_cost_per_unit.toFixed(2)}/{ing.ingredient_unit}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="py-1 px-2 text-center">
                              <input
                                type="number"
                                step="any"
                                min="0.0001"
                                value={item.qty || ''}
                                onChange={(e) => handleUpdateIngredient(idx, { qty: Number(e.target.value) || 0 })}
                                style={{ border: '1px solid #C8E3F0' }}
                                className="w-full text-center px-1 py-0.5 rounded text-[10px] font-mono outline-none bg-white"
                              />
                            </td>

                            <td className="py-1 px-2 text-center text-[#4A7592] font-mono text-[10px]">
                              {item.unit}
                            </td>

                            <td className="py-1 px-2 text-right font-mono text-[#4A7592] text-[10px]">
                              ฿{item.unit_cost.toFixed(2)}
                            </td>

                            <td className="py-1 px-2.5 text-right font-mono font-bold text-[#1E5A7A] text-[10.5px]">
                              ฿{item.total_cost.toFixed(2)}
                            </td>

                            <td className="py-1 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteIngredient(idx)}
                                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-[#EEF6FB] font-bold text-[#1E5A7A] text-[10.5px]">
                          <td colSpan={4} className="py-1.5 px-2.5 text-right">รวมต้นทุนวัตถุดิบ:</td>
                          <td className="py-1.5 px-2.5 text-right font-mono">฿{calculations.ingredientsCost.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: LABOR */}
            {activeTab === 'labor' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#1E3D52]">
                    รายการค่าแรงในการผลิต
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLabor}
                    style={{ background: '#EEF6FB', color: '#1E5A7A', border: '1px solid #5BA4C8' }}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-[#5BA4C8] hover:text-white transition-all cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>เพิ่มค่าแรง</span>
                  </button>
                </div>

                {labor.length === 0 ? (
                  <div className="p-5 text-center text-[10.5px] text-[#4A7592] border border-dashed border-[#C8E3F0] rounded-xl bg-[#F8FCFE]">
                    ยังไม่มีรายการค่าแรง กดปุ่ม "+ เพิ่มค่าแรง" เพื่อบันทึกค่าแรงต่อชั่วโมง
                  </div>
                ) : (
                  <div className="border border-[#C8E3F0] rounded-xl overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead style={{ background: '#1E5A7A', color: '#FFFFFF' }}>
                        <tr>
                          <th className="py-1.5 px-2.5 text-left">รายละเอียดค่าแรง</th>
                          <th className="py-1.5 px-2 w-20 text-center">ชั่วโมง</th>
                          <th className="py-1.5 px-2 w-24 text-right">ค่าแรง/ชม. (฿)</th>
                          <th className="py-1.5 px-2.5 w-24 text-right">รวม (บาท)</th>
                          <th className="py-1.5 px-1 w-7 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4F1F8]">
                        {labor.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-[#F8FCFE]">
                            <td className="py-1 px-2.5">
                              <input
                                type="text"
                                placeholder="เช่น ผสมแป้ง, อบขนม, แต่งหน้าเค้ก"
                                value={item.description}
                                onChange={(e) => handleUpdateLabor(idx, { description: e.target.value })}
                                style={{ border: '1px solid #C8E3F0' }}
                                className="w-full px-2 py-0.5 rounded text-[10px] outline-none bg-white"
                              />
                            </td>
                            <td className="py-1 px-2 text-center">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.hours || ''}
                                onChange={(e) => handleUpdateLabor(idx, { hours: Number(e.target.value) || 0 })}
                                style={{ border: '1px solid #C8E3F0' }}
                                className="w-full text-center px-1 py-0.5 rounded text-[10px] font-mono outline-none bg-white"
                              />
                            </td>
                            <td className="py-1 px-2 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.rate_per_hour || ''}
                                onChange={(e) => handleUpdateLabor(idx, { rate_per_hour: Number(e.target.value) || 0 })}
                                style={{ border: '1px solid #C8E3F0' }}
                                className="w-full text-right px-1 py-0.5 rounded text-[10px] font-mono outline-none bg-white"
                              />
                            </td>
                            <td className="py-1 px-2.5 text-right font-mono font-bold text-[#1E5A7A] text-[10.5px]">
                              ฿{item.total_cost.toFixed(2)}
                            </td>
                            <td className="py-1 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => setLabor(labor.filter((_, i) => i !== idx))}
                                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-[#EEF6FB] font-bold text-[#1E5A7A] text-[10.5px]">
                          <td colSpan={3} className="py-1.5 px-2.5 text-right">รวมค่าแรง:</td>
                          <td className="py-1.5 px-2.5 text-right font-mono">฿{calculations.laborCost.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: OTHER */}
            {activeTab === 'other' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#1E3D52]">
                    รายการค่าใช้จ่ายอื่นๆ (ค่าแก๊ส, ค่าไฟ, บรรจุภัณฑ์)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddOther}
                    style={{ background: '#EEF6FB', color: '#1E5A7A', border: '1px solid #5BA4C8' }}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-[#5BA4C8] hover:text-white transition-all cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>เพิ่มรายการ</span>
                  </button>
                </div>

                {other.length === 0 ? (
                  <div className="p-5 text-center text-[10.5px] text-[#4A7592] border border-dashed border-[#C8E3F0] rounded-xl bg-[#F8FCFE]">
                    ยังไม่มีค่าใช้จ่ายอื่นๆ กดปุ่ม "+ เพิ่มรายการ" เพื่อเพิ่มค่าแก๊ส/ไฟ หรือกล่องบรรจุภัณฑ์
                  </div>
                ) : (
                  <div className="border border-[#C8E3F0] rounded-xl overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead style={{ background: '#1E5A7A', color: '#FFFFFF' }}>
                        <tr>
                          <th className="py-1.5 px-2.5 text-left">รายละเอียด</th>
                          <th className="py-1.5 px-2 w-20 text-center">จำนวน</th>
                          <th className="py-1.5 px-2 w-24 text-right">ต้นทุน/หน่วย (฿)</th>
                          <th className="py-1.5 px-2.5 w-24 text-right">รวม (บาท)</th>
                          <th className="py-1.5 px-1 w-7 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4F1F8]">
                        {other.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-[#F8FCFE]">
                            <td className="py-1 px-2.5">
                              <input
                                type="text"
                                placeholder="เช่น กล่องเบเกอรี่, แก๊ส, ค่าสติกเกอร์"
                                value={item.description}
                                onChange={(e) => handleUpdateOther(idx, { description: e.target.value })}
                                style={{ border: '1px solid #C8E3F0' }}
                                className="w-full px-2 py-0.5 rounded text-[10px] outline-none bg-white"
                              />
                            </td>
                            <td className="py-1 px-2 text-center">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.qty || ''}
                                onChange={(e) => handleUpdateOther(idx, { qty: Number(e.target.value) || 0 })}
                                style={{ border: '1px solid #C8E3F0' }}
                                className="w-full text-center px-1 py-0.5 rounded text-[10px] font-mono outline-none bg-white"
                              />
                            </td>
                            <td className="py-1 px-2 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.unit_cost || ''}
                                onChange={(e) => handleUpdateOther(idx, { unit_cost: Number(e.target.value) || 0 })}
                                style={{ border: '1px solid #C8E3F0' }}
                                className="w-full text-right px-1 py-0.5 rounded text-[10px] font-mono outline-none bg-white"
                              />
                            </td>
                            <td className="py-1 px-2.5 text-right font-mono font-bold text-[#1E5A7A] text-[10.5px]">
                              ฿{item.total_cost.toFixed(2)}
                            </td>
                            <td className="py-1 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => setOther(other.filter((_, i) => i !== idx))}
                                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-[#EEF6FB] font-bold text-[#1E5A7A] text-[10.5px]">
                          <td colSpan={3} className="py-1.5 px-2.5 text-right">รวมค่าใช้จ่ายอื่นๆ:</td>
                          <td className="py-1.5 px-2.5 text-right font-mono">฿{calculations.otherCost.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* RIGHT COLUMN: STICKY COST SUMMARY (40% / 5 cols) */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
          
          {/* Main Calculation Card */}
          <div 
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #C8E3F0',
              borderRadius: '16px',
              padding: '14px',
              boxShadow: '0 8px 24px rgba(90, 164, 200, 0.1)'
            }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#E4F1F8]">
              <div className="flex items-center gap-1.5">
                <Calculator size={14} color="#5BA4C8" />
                <h3 className="font-bold text-[12px] text-[#1E3D52]">สรุปต้นทุนและการตั้งราคา</h3>
              </div>
              <span className="text-[9.5px] text-[#4A7592] font-mono bg-[#EEF6FB] px-2 py-0.5 rounded-full border border-[#C8E3F0]">
                Real-time
              </span>
            </div>

            {/* Cost Rows */}
            <div className="space-y-1.5 text-[10.5px]">
              <div className="flex items-center justify-between text-[#4A7592]">
                <span>📦 วัตถุดิบ รวม:</span>
                <span className="font-mono font-semibold text-[#1E3D52]">฿{calculations.ingredientsCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[#4A7592]">
                <span>👷 ค่าแรง รวม:</span>
                <span className="font-mono font-semibold text-[#1E3D52]">฿{calculations.laborCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[#4A7592]">
                <span>⚡ อื่นๆ รวม:</span>
                <span className="font-mono font-semibold text-[#1E3D52]">฿{calculations.otherCost.toFixed(2)}</span>
              </div>

              <div className="pt-1.5 border-t border-[#E4F1F8] flex items-center justify-between text-[#1E5A7A] font-bold">
                <span>รวมต้นทุนทั้งสูตร:</span>
                <span className="font-mono text-[12px]">฿{calculations.totalBatchCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[#4A7592] text-[10px]">
                <span>ผลิตได้:</span>
                <span className="font-mono font-semibold">{yieldQty} ชิ้น/สูตร</span>
              </div>

              {/* Cost per piece highlight */}
              <div 
                style={{ background: '#F8FCFE', border: '1px solid #C8E3F0' }}
                className="p-2 rounded-xl flex items-center justify-between my-1.5"
              >
                <span className="font-bold text-[11px] text-[#1E3D52]">ต้นทุนต่อชิ้น:</span>
                <span className="font-black text-[12px] text-[#1E5A7A] font-mono">
                  ฿{calculations.costPerPiece.toFixed(2)}
                </span>
              </div>
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {/* PRICING METHOD SELECTOR */}
            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="space-y-1.5 pt-1.5 border-t border-[#E4F1F8]">
              <label className="block text-[11px] font-bold text-[#1E3D52]">
                วิธีการกำหนดราคาขาย (Pricing Method)
              </label>

              <select
                value={pricingMethod}
                onChange={(e) => setPricingMethod(e.target.value as PricingMethod)}
                style={{ border: '1px solid #C8E3F0', background: '#F8FCFE', color: '#1E3D52' }}
                className="w-full px-2.5 py-1.5 rounded-xl text-[10.5px] font-semibold outline-none cursor-pointer focus:border-[#5BA4C8]"
              >
                <option value="margin_pct">วิธีที่ 1: กำไร % ขั้นต้น (Target Margin %)</option>
                <option value="profit_thb">วิธีที่ 2: กำไรบาทต่อชิ้น (Target Profit THB)</option>
                <option value="fixed_price">วิธีที่ 3: กำหนดราคาขายเอง (Fixed Price)</option>
                <option value="discount_price">วิธีที่ 4: ราคาหลังหักส่วนลด (Discount Price)</option>
                <option value="net_price">วิธีที่ 5: ราคาขายสุทธิรวม VAT (Net Price incl. VAT)</option>
              </select>

              {/* Dynamic Inputs Based on Method */}
              {pricingMethod === 'margin_pct' && (
                <div className="p-2.5 rounded-xl bg-[#F8FCFE] border border-[#C8E3F0] space-y-1.5 text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#4A7592] font-semibold">เป้าหมายกำไร (%):</span>
                    <span className="font-mono font-bold text-[#1E5A7A]">{targetMarginPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="90"
                    value={targetMarginPct}
                    onChange={(e) => setTargetMarginPct(Number(e.target.value))}
                    className="w-full accent-[#5BA4C8] cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-[#90C4DC]">
                    <span>10%</span>
                    <span>30%</span>
                    <span>50% (แนะนำ)</span>
                    <span>70%</span>
                  </div>
                </div>
              )}

              {pricingMethod === 'profit_thb' && (
                <div className="p-2.5 rounded-xl bg-[#F8FCFE] border border-[#C8E3F0] space-y-1 text-[10.5px]">
                  <label className="block text-[#4A7592] font-semibold">
                    ต้องการกำไรต่อชิ้น (บาท):
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">฿</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={targetProfitThb}
                      onChange={(e) => setTargetProfitThb(Number(e.target.value) || 0)}
                      style={{ border: '1px solid #C8E3F0' }}
                      className="w-full pl-6 pr-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-white outline-none"
                    />
                  </div>
                </div>
              )}

              {pricingMethod === 'fixed_price' && (
                <div className="p-2.5 rounded-xl bg-[#F8FCFE] border border-[#C8E3F0] space-y-1 text-[10.5px]">
                  <label className="block text-[#4A7592] font-semibold">
                    ระบุราคาขายที่ต้องการ (บาท):
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">฿</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={fixedPriceInput}
                      onChange={(e) => setFixedPriceInput(Number(e.target.value) || 0)}
                      style={{ border: '1px solid #C8E3F0' }}
                      className="w-full pl-6 pr-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-white outline-none"
                    />
                  </div>
                </div>
              )}

              {pricingMethod === 'discount_price' && (
                <div className="p-2.5 rounded-xl bg-[#F8FCFE] border border-[#C8E3F0] space-y-1.5 text-[10.5px]">
                  <div>
                    <label className="block text-[#4A7592] font-semibold mb-0.5">ราคาป้ายปกติ (บาท):</label>
                    <input
                      type="number"
                      step="any"
                      value={fixedPriceInput}
                      onChange={(e) => setFixedPriceInput(Number(e.target.value) || 0)}
                      style={{ border: '1px solid #C8E3F0' }}
                      className="w-full px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#4A7592] font-semibold mb-0.5">ส่วนลดโปรโมชั่น (%):</label>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={discountPct}
                      onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
                      style={{ border: '1px solid #C8E3F0' }}
                      className="w-full px-2.5 py-1 rounded-lg text-[10.5px] font-mono bg-white outline-none"
                    />
                  </div>
                </div>
              )}

              {pricingMethod === 'net_price' && (
                <div className="p-2.5 rounded-xl bg-[#F8FCFE] border border-[#C8E3F0] space-y-1.5 text-[10.5px]">
                  <div>
                    <label className="block text-[#4A7592] font-semibold mb-0.5">ราคาฐานก่อนภาษี (บาท):</label>
                    <input
                      type="number"
                      step="any"
                      value={fixedPriceInput}
                      onChange={(e) => setFixedPriceInput(Number(e.target.value) || 0)}
                      style={{ border: '1px solid #C8E3F0' }}
                      className="w-full px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#4A7592] font-semibold mb-0.5">อัตราภาษีมูลค่าเพิ่ม VAT (%):</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={vatPct}
                      onChange={(e) => setVatPct(Number(e.target.value) || 0)}
                      style={{ border: '1px solid #C8E3F0' }}
                      className="w-full px-2.5 py-1 rounded-lg text-[10.5px] font-mono bg-white outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {/* BLUE RESULT BOX */}
            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div 
              style={{
                background: '#EEF6FB',
                border: '1.5px solid #5BA4C8',
                borderRadius: '16px',
                padding: '12px 14px'
              }}
              className="space-y-2"
            >
              <div className="text-[10.5px] font-bold text-[#1E5A7A] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} color="#5BA4C8" />
                  <span>ผลลัพธ์ราคาขายและกำไร</span>
                </span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-[#C8E3F0] text-[9.5px]">
                  {calculations.profitPct >= 50 ? 'กำไรดีเยี่ยม' : calculations.profitPct >= 30 ? 'กำไรปานกลาง' : 'กำไรต่ำ'}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-[#4A7592] font-semibold">ราคาขายที่แนะนำ:</span>
                <span className="text-[12px] font-black text-[#1E5A7A] font-mono">
                  ฿{calculations.finalSellingPrice.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10.5px] pt-1.5 border-t border-[#C8E3F0]">
                <span className="text-[#4A7592]">กำไรสุทธิต่อชิ้น:</span>
                <span className="font-bold text-[#22C55E] font-mono text-[11px]">
                  +฿{calculations.profitPerPiece.toFixed(2)} ({calculations.profitPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Cost Structure Bar Chart */}
            <div className="space-y-1 pt-0.5 text-[10px]">
              <div className="flex items-center justify-between text-[9.5px] text-[#4A7592]">
                <span>สัดส่วนต้นทุน:</span>
                <span className="font-mono">
                  📦 {calculations.matPct}% &nbsp;|&nbsp; 👷 {calculations.labPct}% &nbsp;|&nbsp; ⚡ {calculations.othPct}%
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-100">
                <div 
                  style={{ width: `${calculations.matPct}%`, background: '#5BA4C8' }} 
                  title={`วัตถุดิบ: ${calculations.matPct}%`}
                />
                <div 
                  style={{ width: `${calculations.labPct}%`, background: '#3D7FA3' }} 
                  title={`ค่าแรง: ${calculations.labPct}%`}
                />
                <div 
                  style={{ width: `${calculations.othPct}%`, background: '#D4A853' }} 
                  title={`อื่นๆ: ${calculations.othPct}%`}
                />
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              style={{ background: '#5BA4C8', color: '#FFFFFF' }}
              className="w-full py-2 rounded-xl font-bold text-[11.5px] shadow-sm hover:bg-[#3D7FA3] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
            >
              <Save size={14} />
              <span>บันทึกสูตรและราคาขาย</span>
            </button>
          </div>
        </div>

      </div>
    </form>
  );
}
