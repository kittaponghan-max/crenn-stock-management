import React, { useState } from 'react';
import { Recipe } from '../../types/prodcalc';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  Layers, 
  DollarSign, 
  Percent, 
  Search, 
  FileText, 
  X, 
  ChevronRight,
  TrendingUp,
  Package,
  Clock,
  Zap,
  ShoppingBag
} from 'lucide-react';

interface RecipeListProps {
  recipes: Recipe[];
  onNewRecipe: () => void;
  onEditRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  currentBranch: string;
}

export function RecipeList({ recipes, onNewRecipe, onEditRecipe, onDeleteRecipe, currentBranch }: RecipeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);

  const filteredRecipes = recipes.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        r.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoryFilter === 'ALL' || r.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const categories = Array.from(new Set(recipes.map(r => r.category).filter(Boolean)));

  const getProfitBadgeColor = (pct: number) => {
    if (pct >= 50) return { bg: '#ECFDF5', border: '#A7F3D0', text: '#22C55E' };
    if (pct >= 30) return { bg: '#FFFBEB', border: '#FDE68A', text: '#F59E0B' };
    return { bg: '#FEF2F2', border: '#FECACA', text: '#EF4444' };
  };

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
          padding: '14px 20px',
          boxShadow: '0 4px 20px rgba(90, 164, 200, 0.08)'
        }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12px]">📖</span>
            <h1 style={{ color: '#1E3D52' }} className="text-[12px] font-bold tracking-tight">
              สูตรอาหาร / สินค้า (Recipe List)
            </h1>
          </div>
          <p style={{ color: '#4A7592' }} className="text-[10px] mt-0.5 font-normal leading-relaxed">
            จัดการสูตรการผลิต คำนวณต้นทุนต่อชิ้น และกำหนดราคาขายเพื่อผลกำไรที่แม่นยำ
          </p>
        </div>

        <button
          onClick={onNewRecipe}
          style={{
            background: '#5BA4C8',
            color: '#FFFFFF'
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-sm hover:bg-[#3D7FA3] active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Plus size={14} />
          <span>สร้างสูตรใหม่</span>
        </button>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* FILTER BAR */}
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
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} color="#4A7592" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสูตร หรือรหัสสูตร..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: '#F8FCFE',
              border: '1px solid #C8E3F0',
              color: '#1E3D52'
            }}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[10.5px] outline-none focus:border-[#5BA4C8] transition-colors"
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
            className="px-2.5 py-1.5 rounded-lg text-[10.5px] outline-none cursor-pointer"
          >
            <option value="ALL">ทุกหมวดหมู่ ({recipes.length})</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* CARD GRID (2 cols desktop, 1 col mobile) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {filteredRecipes.length === 0 ? (
        <div 
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #C8E3F0',
            borderRadius: '16px',
            padding: '40px 20px'
          }}
          className="text-center space-y-2.5"
        >
          <div className="text-[12px]">🍰</div>
          <div className="font-bold text-[#1E3D52] text-[12px]">ยังไม่มีสูตรอาหารในระบบ</div>
          <p className="text-[10px] text-[#4A7592] max-w-sm mx-auto">
            กดปุ่ม "สร้างสูตรใหม่" เพื่อเริ่มรวมต้นทุนจากวัตถุดิบ ค่าแรง และค่าใช้จ่ายอื่นๆ
          </p>
          <button
            onClick={onNewRecipe}
            style={{ background: '#5BA4C8', color: '#FFFFFF' }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-xs hover:bg-[#3D7FA3] transition-all cursor-pointer"
          >
            <Plus size={13} />
            <span>สร้างสูตรแรกของคุณ</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredRecipes.map((recipe) => {
            const badge = getProfitBadgeColor(recipe.profit_pct);

            return (
              <div
                key={recipe.id}
                style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #C8E3F0',
                  borderRadius: '16px',
                  boxShadow: '0 4px 16px rgba(90, 164, 200, 0.06)'
                }}
                className="p-3.5 sm:p-4 flex flex-col justify-between hover:border-[#5BA4C8] transition-all"
              >
                {/* Top section: image, code, name, category */}
                <div className="flex gap-3 items-start">
                  {recipe.image ? (
                    <img 
                      src={recipe.image} 
                      alt={recipe.name} 
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-[#C8E3F0] shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#EEF6FB] flex items-center justify-center text-[12px] border border-[#C8E3F0] shrink-0">
                      🧁
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[9.5px] font-mono font-bold text-[#5BA4C8] bg-[#EEF6FB] px-1.5 py-0.5 rounded border border-[#C8E3F0]">
                        {recipe.code || 'RECIPE'}
                      </span>
                      <span 
                        style={{ 
                          background: badge.bg, 
                          borderColor: badge.border, 
                          color: badge.text 
                        }}
                        className="text-[10px] font-black px-2 py-0.5 rounded-full border font-mono"
                      >
                        กำไร {recipe.profit_pct.toFixed(1)}%
                      </span>
                    </div>

                    <h3 className="font-bold text-[#1E3D52] text-[12px] truncate">
                      {recipe.name}
                    </h3>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9.5px] text-[#4A7592] bg-[#F8FCFE] px-1.5 py-0.2 rounded border border-[#C8E3F0]/60">
                        {recipe.category}
                      </span>
                      <span className="text-[9.5px] text-[#4A7592]">
                        · ผลิต {recipe.yield_qty} ชิ้น/สูตร
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle section: Cost & Pricing Metrics */}
                <div 
                  style={{ background: '#F8FCFE', border: '1px solid #E4F1F8' }}
                  className="grid grid-cols-3 gap-1.5 p-2 rounded-xl my-2.5 text-center"
                >
                  <div>
                    <span className="block text-[9.5px] text-[#4A7592]">ต้นทุน/ชิ้น</span>
                    <span className="font-bold text-[#1E3D52] text-[12px] font-mono">
                      ฿{recipe.cost_per_piece.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-x border-[#E4F1F8]">
                    <span className="block text-[9.5px] text-[#4A7592]">ราคาขาย</span>
                    <span className="font-black text-[#1E5A7A] text-[12px] font-mono">
                      ฿{recipe.selling_price.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9.5px] text-[#4A7592]">กำไร/ชิ้น</span>
                    <span 
                      style={{ color: badge.text }}
                      className="font-bold text-[12px] font-mono"
                    >
                      +฿{recipe.profit_per_piece.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex items-center justify-between pt-1 border-t border-[#F1F7FA]">
                  <div className="text-[10px] text-[#90C4DC] font-mono">
                    วัตถุดิบ {recipe.ingredients?.length || 0} รายการ
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewingRecipe(recipe)}
                      style={{ border: '1px solid #C8E3F0', color: '#1E5A7A', background: '#FFFFFF' }}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-semibold hover:bg-[#EEF6FB] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>ดูสรุป</span>
                    </button>
                    <button
                      onClick={() => onEditRecipe(recipe)}
                      style={{ background: '#EEF6FB', color: '#1E5A7A', border: '1px solid #5BA4C8' }}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-semibold hover:bg-[#5BA4C8] hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 size={12} />
                      <span>แก้ไข</span>
                    </button>
                    <button
                      onClick={() => onDeleteRecipe(recipe.id)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="ลบสูตร"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SUMMARY MODAL */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {viewingRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs">
          <div 
            style={{ border: '1.5px solid #C8E3F0' }}
            className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E4F1F8]">
              <div>
                <span className="text-[9.5px] font-mono font-bold text-[#5BA4C8] bg-[#EEF6FB] px-1.5 py-0.5 rounded">
                  {viewingRecipe.code}
                </span>
                <h3 className="font-bold text-[#1E3D52] text-[12px] mt-0.5">
                  สรุปโครงสร้างต้นทุน: {viewingRecipe.name}
                </h3>
              </div>
              <button 
                onClick={() => setViewingRecipe(null)} 
                className="text-[#4A7592] hover:text-[#1E3D52] p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            {/* Total cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#F8FCFE] border border-[#C8E3F0]">
                <span className="text-[9.5px] text-[#4A7592]">ต้นทุนรวมทั้งสูตร</span>
                <div className="font-bold text-[#1E3D52] font-mono text-[12px] mt-0.5">
                  ฿{viewingRecipe.total_batch_cost.toFixed(2)}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#EEF6FB] border border-[#5BA4C8]">
                <span className="text-[9.5px] text-[#1E5A7A] font-semibold">ต้นทุนต่อชิ้น</span>
                <div className="font-black text-[#1E5A7A] font-mono text-[12px] mt-0.5">
                  ฿{viewingRecipe.cost_per_piece.toFixed(2)}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-300">
                <span className="text-[9.5px] text-emerald-800 font-semibold">กำไรสุทธิ</span>
                <div className="font-black text-emerald-700 font-mono text-[12px] mt-0.5">
                  ฿{viewingRecipe.profit_per_piece.toFixed(2)} ({viewingRecipe.profit_pct.toFixed(1)}%)
                </div>
              </div>
            </div>

            {/* Detailed Ingredients Table */}
            <div>
              <h4 className="text-[11px] font-bold text-[#1E3D52] mb-1.5 flex items-center gap-1.5">
                <Package size={13} color="#5BA4C8" />
                <span>วัตถุดิบในสูตร ({viewingRecipe.ingredients.length} รายการ)</span>
              </h4>
              <div className="border border-[#C8E3F0] rounded-xl overflow-hidden">
                <table className="w-full text-[10.5px]">
                  <thead style={{ background: '#1E5A7A', color: '#FFFFFF' }}>
                    <tr>
                      <th className="py-1.5 px-2.5">รายการ</th>
                      <th className="py-1.5 px-2 text-center">ปริมาณ</th>
                      <th className="py-1.5 px-2 text-right">ต้นทุน/หน่วย</th>
                      <th className="py-1.5 px-2.5 text-right">รวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4F1F8]">
                    {viewingRecipe.ingredients.map(ing => (
                      <tr key={ing.id} className="hover:bg-[#F8FCFE]">
                        <td className="py-1.5 px-2.5 font-medium text-[#1E3D52]">{ing.ingredient_name}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-[#4A7592]">{ing.qty} {ing.unit}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-[#4A7592]">฿{ing.unit_cost.toFixed(2)}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-[#1E5A7A]">฿{ing.total_cost.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#EEF6FB] font-bold text-[#1E5A7A]">
                      <td colSpan={3} className="py-1.5 px-2.5 text-right">รวมต้นทุนวัตถุดิบ:</td>
                      <td className="py-1.5 px-2.5 text-right font-mono">฿{viewingRecipe.ingredients_cost.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Labor & Other Costs Summary */}
            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="p-2.5 rounded-xl border border-[#C8E3F0] bg-white">
                <span className="text-[#4A7592] font-semibold flex items-center gap-1">
                  <Clock size={12} /> ค่าแรงรวม:
                </span>
                <span className="text-[12px] font-mono font-bold text-[#1E3D52] block mt-0.5">
                  ฿{viewingRecipe.labor_cost.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-[#C8E3F0] bg-white">
                <span className="text-[#4A7592] font-semibold flex items-center gap-1">
                  <Zap size={12} /> ค่าใช้จ่ายอื่นๆ รวม:
                </span>
                <span className="text-[12px] font-mono font-bold text-[#1E3D52] block mt-0.5">
                  ฿{viewingRecipe.other_cost.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setViewingRecipe(null)}
                style={{ background: '#5BA4C8', color: '#FFFFFF' }}
                className="px-3.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
