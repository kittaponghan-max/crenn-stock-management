import React, { useState, useMemo } from 'react';
import { Recipe } from '../../types/prodcalc';
import {
  Plus,
  Edit3,
  Trash2,
  Eye,
  BookOpen,
  Search,
  X,
  Package,
  Clock,
  Zap,
  Filter
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
  StandardTd
} from '../ui';

interface RecipeListProps {
  recipes: Recipe[];
  onNewRecipe: () => void;
  onEditRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  currentBranch: string;
  isReadOnly?: boolean;
}

export function RecipeList({ recipes, onNewRecipe, onEditRecipe, onDeleteRecipe, currentBranch, isReadOnly = false }: RecipeListProps) {
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

  const categoryOptions = useMemo(() => [
    { value: 'ALL', label: 'ทุกหมวดหมู่', count: recipes.length },
    ...categories.map(cat => ({
      value: cat,
      label: cat,
      count: recipes.filter(r => r.category === cat).length
    }))
  ], [categories, recipes]);

  const getProfitBadgeClass = (pct: number) => {
    if (pct >= 50) return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    if (pct >= 30) return 'bg-amber-50 border-amber-200 text-amber-700';
    return 'bg-rose-50 border-rose-200 text-rose-600';
  };

  const getProfitTextColor = (pct: number) => {
    if (pct >= 50) return 'text-emerald-600';
    if (pct >= 30) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <div className="space-y-4">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* HEADER BANNER & TOOLBAR */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <PageHeaderBanner
        variant="sub"
        icon={<BookOpen size={18} />}
        title="สูตรอาหาร / สินค้า (Recipe List)"
        branchLabel={`สาขา: ${currentBranch}`}
        subtitle="จัดการสูตรการผลิต คำนวณต้นทุนต่อชิ้น และกำหนดราคาขายเพื่อผลกำไรที่แม่นยำ"
        actions={
          !isReadOnly ? (
            <button
              type="button"
              onClick={onNewRecipe}
              className="flex items-center gap-1.5 h-[32px] px-3.5 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] sm:text-[12px] font-[600] shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Plus size={14} />
              <span>สร้างสูตรใหม่</span>
            </button>
          ) : undefined
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B8F8E] pointer-events-none" />
              <input
                type="text"
                placeholder="ค้นหาชื่อสูตร หรือรหัสสูตร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-[32px] pl-8 pr-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-[11px] outline-none focus:border-[#5A8A88] transition-colors"
              />
            </div>

            {categories.length > 0 && (
              <StandardDropdown
                options={categoryOptions}
                value={categoryFilter}
                onChange={setCategoryFilter}
                leadingIcon={<Filter size={12} />}
                align="right"
                ariaLabel="กรองตามหมวดหมู่"
              />
            )}
          </div>
        }
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* CARD GRID (2 cols desktop, 1 col mobile) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {filteredRecipes.length === 0 ? (
        <div className="bg-white border border-[#D4E4E3] rounded-2xl p-10 text-center space-y-2.5 shadow-[0_2px_8px_rgba(90,138,136,0.06)]">
          <div className="w-12 h-12 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center mx-auto">
            <BookOpen size={22} />
          </div>
          <div className="font-bold text-[#2D4A49] text-[13px]">ยังไม่มีสูตรอาหารในระบบ</div>
          {!isReadOnly && (
            <>
              <p className="text-[11px] text-[#6B8F8E] max-w-sm mx-auto">
                กดปุ่ม &quot;สร้างสูตรใหม่&quot; เพื่อเริ่มรวมต้นทุนจากวัตถุดิบ ค่าแรง และค่าใช้จ่ายอื่นๆ
              </p>
              <button
                type="button"
                onClick={onNewRecipe}
                className="inline-flex items-center gap-1.5 h-[32px] px-3.5 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] sm:text-[12px] font-[600] shadow-xs transition-all cursor-pointer mt-1"
              >
                <Plus size={13} />
                <span>สร้างสูตรแรกของคุณ</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredRecipes.map((recipe) => {
            return (
              <div
                key={recipe.id}
                className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between hover:border-[#5A8A88] shadow-[0_2px_8px_rgba(90,138,136,0.06)] transition-all"
              >
                {/* Top section: image, code, name, category */}
                <div className="flex gap-3 items-start">
                  {recipe.image ? (
                    <img
                      src={recipe.image}
                      alt={recipe.name}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-[#D4E4E3] shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] border border-[#D4E4E3] shrink-0">
                      <Package size={22} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono font-[600] text-[#5A8A88] bg-[#E8F3F2] px-[7px] py-[2px] rounded-[5px] border border-[#D4E4E3]">
                        {recipe.code || 'RECIPE'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums ${getProfitBadgeClass(recipe.profit_pct)}`}
                      >
                        กำไร {recipe.profit_pct.toFixed(1)}%
                      </span>
                    </div>

                    <h3 className="font-bold text-[#2D4A49] text-[12px] sm:text-[13px] truncate">
                      {recipe.name}
                    </h3>

                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[9.5px] text-[#6B8F8E] bg-[#F0F5F4] px-1.5 py-0.5 rounded border border-[#D4E4E3]/70">
                        {recipe.category}
                      </span>
                      <span className="text-[9.5px] text-[#6B8F8E] tabular-nums">
                        · ผลิต {recipe.yield_qty} ชิ้น/สูตร
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle section: Cost & Pricing Metrics */}
                <div className="bg-[#F8FCFC] border border-[#D4E4E3]/80 grid grid-cols-3 gap-1.5 p-2 rounded-xl my-2.5 text-center">
                  <div>
                    <span className="block text-[9.5px] text-[#6B8F8E]">ต้นทุน/ชิ้น</span>
                    <span className="font-bold text-[#2D4A49] text-[12px] tabular-nums">
                      ฿{recipe.cost_per_piece.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-x border-[#D4E4E3]/80">
                    <span className="block text-[9.5px] text-[#6B8F8E]">ราคาขาย</span>
                    <span className="font-black text-[#2D4A49] text-[12px] tabular-nums">
                      ฿{recipe.selling_price.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9.5px] text-[#6B8F8E]">กำไร/ชิ้น</span>
                    <span className={`font-bold text-[12px] tabular-nums ${getProfitTextColor(recipe.profit_pct)}`}>
                      +฿{recipe.profit_per_piece.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-[#F0F5F4]">
                  <div className="text-[10px] text-[#6B8F8E] tabular-nums">
                    วัตถุดิบ {recipe.ingredients?.length || 0} รายการ
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingRecipe(recipe)}
                      className="h-[30px] px-2.5 rounded-[8px] border border-[#D4E4E3] bg-white text-[#2D4A49] text-[11px] font-medium hover:bg-[#E8F3F2] hover:border-[#5A8A88] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={12} className="text-[#5A8A88]" />
                      <span>ดูสรุป</span>
                    </button>
                    {!isReadOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditRecipe(recipe)}
                          className="h-[30px] px-2.5 rounded-[8px] bg-[#E8F3F2] text-[#2D4A49] border border-[#5A8A88]/50 text-[11px] font-semibold hover:bg-[#5A8A88] hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 size={12} />
                          <span>แก้ไข</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecipe(recipe.id)}
                          className="w-[30px] h-[30px] flex items-center justify-center rounded-[8px] text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ลบสูตร"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
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
          <div className="bg-white border border-[#D4E4E3] rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#D4E4E3]">
              <div>
                <span className="text-[10px] font-mono font-[600] text-[#5A8A88] bg-[#E8F3F2] px-[7px] py-[2px] rounded-[5px] border border-[#D4E4E3]">
                  {viewingRecipe.code}
                </span>
                <h3 className="font-bold text-[#2D4A49] text-[13px] mt-1">
                  สรุปโครงสร้างต้นทุน: {viewingRecipe.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingRecipe(null)}
                className="w-[30px] h-[30px] flex items-center justify-center text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#F0F5F4] rounded-[8px] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Total cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-[#F8FCFC] border border-[#D4E4E3]">
                <span className="text-[10px] text-[#6B8F8E]">ต้นทุนรวมทั้งสูตร</span>
                <div className="font-bold text-[#2D4A49] tabular-nums text-[12px] mt-0.5">
                  ฿{viewingRecipe.total_batch_cost.toFixed(2)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#E8F3F2] border border-[#5A8A88]/60">
                <span className="text-[10px] text-[#2D4A49] font-semibold">ต้นทุนต่อชิ้น</span>
                <div className="font-black text-[#2D4A49] tabular-nums text-[12px] mt-0.5">
                  ฿{viewingRecipe.cost_per_piece.toFixed(2)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] text-emerald-800 font-semibold">กำไรสุทธิ</span>
                <div className="font-black text-emerald-700 tabular-nums text-[12px] mt-0.5">
                  ฿{viewingRecipe.profit_per_piece.toFixed(2)} ({viewingRecipe.profit_pct.toFixed(1)}%)
                </div>
              </div>
            </div>

            {/* Detailed Ingredients Table */}
            <div>
              <h4 className="text-[11px] font-bold text-[#2D4A49] mb-1.5 flex items-center gap-1.5">
                <Package size={13} className="text-[#5A8A88]" />
                <span>วัตถุดิบในสูตร ({viewingRecipe.ingredients.length} รายการ)</span>
              </h4>
              <StandardTableCard>
                <StandardTable minWidthClassName="min-w-[400px]">
                  <StandardThead sticky={false}>
                    <StandardHeaderRow>
                      <StandardTh compact>รายการ</StandardTh>
                      <StandardTh compact align="center">ปริมาณ</StandardTh>
                      <StandardTh compact align="right">ต้นทุน/หน่วย</StandardTh>
                      <StandardTh compact align="right">รวม (บาท)</StandardTh>
                    </StandardHeaderRow>
                  </StandardThead>
                  <StandardTbody>
                    {viewingRecipe.ingredients.map(ing => (
                      <StandardTr key={ing.id}>
                        <StandardTd compact className="font-medium text-[#2D4A49]">{ing.ingredient_name}</StandardTd>
                        <StandardTd compact align="center" numeric nowrap className="font-mono text-[#6B8F8E]">{ing.qty} {ing.unit}</StandardTd>
                        <StandardTd compact align="right" numeric nowrap className="font-mono text-[#6B8F8E]">฿{ing.unit_cost.toFixed(2)}</StandardTd>
                        <StandardTd compact align="right" numeric nowrap className="font-mono font-bold text-[#2D4A49]">฿{ing.total_cost.toFixed(2)}</StandardTd>
                      </StandardTr>
                    ))}
                    <tr className="bg-[#E8F3F2] font-bold text-[#2D4A49]">
                      <td colSpan={3} className="py-2 px-2 text-right text-[11px]">รวมต้นทุนวัตถุดิบ:</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap text-[11.5px]">฿{viewingRecipe.ingredients_cost.toFixed(2)}</td>
                    </tr>
                  </StandardTbody>
                </StandardTable>
              </StandardTableCard>
            </div>

            {/* Labor & Other Costs Summary */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl border border-[#D4E4E3] bg-[#F8FCFC]">
                <span className="text-[#6B8F8E] font-semibold flex items-center gap-1 text-[10px]">
                  <Clock size={12} className="text-[#5A8A88]" /> ค่าแรงรวม:
                </span>
                <span className="text-[12px] tabular-nums font-bold text-[#2D4A49] block mt-0.5">
                  ฿{viewingRecipe.labor_cost.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-[#D4E4E3] bg-[#F8FCFC]">
                <span className="text-[#6B8F8E] font-semibold flex items-center gap-1 text-[10px]">
                  <Zap size={12} className="text-[#5A8A88]" /> ค่าใช้จ่ายอื่นๆ รวม:
                </span>
                <span className="text-[12px] tabular-nums font-bold text-[#2D4A49] block mt-0.5">
                  ฿{viewingRecipe.other_cost.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setViewingRecipe(null)}
                className="h-[32px] px-4 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] font-[600] cursor-pointer transition-colors"
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
