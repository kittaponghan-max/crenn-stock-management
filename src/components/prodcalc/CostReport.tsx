import React, { useState, useMemo, useRef } from 'react';
import { Recipe } from '../../types/prodcalc';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Search,
  ArrowUpDown,
  Package,
  Award
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  PageHeaderBanner,
  ExportButton,
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

interface CostReportProps {
  recipes: Recipe[];
  currentBranch: string;
}

type SortField = 'profit_pct' | 'cost_per_piece' | 'selling_price' | 'profit_per_piece';

export function CostReport({ recipes, currentBranch }: CostReportProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('profit_pct');
  const [sortAsc, setSortAsc] = useState(false);
  const exportAreaRef = useRef<HTMLDivElement>(null);

  const sortOptions = useMemo(() => [
    { value: 'profit_pct' as SortField, label: 'อัตรากำไร %' },
    { value: 'profit_per_piece' as SortField, label: 'กำไรบาท/ชิ้น' },
    { value: 'cost_per_piece' as SortField, label: 'ต้นทุนต่อชิ้น' },
    { value: 'selling_price' as SortField, label: 'ราคาขาย' },
  ], []);

  // Summary Metrics
  const summary = useMemo(() => {
    if (recipes.length === 0) {
      return {
        totalRecipes: 0,
        avgProfitPct: 0,
        avgCostPerPiece: 0,
        avgSellingPrice: 0,
        topProfitRecipe: null as Recipe | null
      };
    }

    const totalCost = recipes.reduce((sum, r) => sum + r.cost_per_piece, 0);
    const totalSelling = recipes.reduce((sum, r) => sum + r.selling_price, 0);
    const totalProfitPct = recipes.reduce((sum, r) => sum + r.profit_pct, 0);

    const sortedByProfit = [...recipes].sort((a, b) => b.profit_pct - a.profit_pct);

    return {
      totalRecipes: recipes.length,
      avgProfitPct: Number((totalProfitPct / recipes.length).toFixed(1)),
      avgCostPerPiece: Number((totalCost / recipes.length).toFixed(2)),
      avgSellingPrice: Number((totalSelling / recipes.length).toFixed(2)),
      topProfitRecipe: sortedByProfit[0] || null
    };
  }, [recipes]);

  // Sorted and filtered recipes
  const sortedRecipes = useMemo(() => {
    return recipes
      .filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.code.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [recipes, searchTerm, sortField, sortAsc]);

  // Excel Export
  const handleExportExcel = () => {
    const exportRows = recipes.map((r, i) => ({
      'ลำดับ': i + 1,
      'รหัสสูตร': r.code,
      'ชื่อสูตร/สินค้า': r.name,
      'หมวดหมู่': r.category,
      'จำนวนผลิตต่อสูตร': r.yield_qty,
      'ต้นทุนวัตถุดิบ (฿)': r.ingredients_cost,
      'ต้นทุนค่าแรง (฿)': r.labor_cost,
      'ต้นทุนอื่นๆ (฿)': r.other_cost,
      'ต้นทุนรวมต่อสูตร (฿)': r.total_batch_cost,
      'ต้นทุนต่อชิ้น (฿)': r.cost_per_piece,
      'ราคาขาย (฿)': r.selling_price,
      'กำไรต่อชิ้น (฿)': r.profit_per_piece,
      'อัตรากำไร (%)': `${r.profit_pct.toFixed(1)}%`,
      'สาขา': r.branch || currentBranch
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายงานต้นทุน');
    XLSX.writeFile(wb, `ProdCalc_Cost_Report_${currentBranch}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div ref={exportAreaRef} className="space-y-4">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* HEADER BANNER */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <PageHeaderBanner
        variant="sub"
        icon={<BarChart3 size={18} />}
        title="รายงานวิเคราะห์ต้นทุนและผลกำไร (Cost & Profit Reports)"
        branchLabel={`สาขา: ${currentBranch}`}
        subtitle="ภาพรวมการจัดอันดับสินค้าตามความคุ้มค่า สัดส่วนต้นทุนวัตถุดิบ และประมาณการกำไร"
        actions={
          <ExportButton
            onExportExcel={handleExportExcel}
            pngConfig={{
              targetRef: exportAreaRef,
              fileName: `ProdCalc_Cost_Report_${currentBranch}_${new Date().toISOString().split('T')[0]}`,
              backgroundColor: '#F0F5F4',
            }}
            onExportPrint={handlePrint}
            disabled={recipes.length === 0}
          />
        }
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SUMMARY METRICS CARDS */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1 */}
        <div className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 shadow-[0_2px_8px_rgba(90,138,136,0.06)]">
          <div className="flex items-center justify-between text-[10.5px] text-[#6B8F8E]">
            <span>จำนวนสูตรทั้งหมด</span>
            <span className="p-1.5 rounded-lg bg-[#E8F3F2] text-[#5A8A88]">
              <Package size={13} />
            </span>
          </div>
          <div className="text-[15px] font-bold text-[#2D4A49] tabular-nums mt-1.5">
            {summary.totalRecipes} <span className="text-[10px] font-normal text-[#6B8F8E]">รายการ</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 shadow-[0_2px_8px_rgba(90,138,136,0.06)]">
          <div className="flex items-center justify-between text-[10.5px] text-[#6B8F8E]">
            <span>กำไรเฉลี่ยภาพรวม</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp size={13} />
            </span>
          </div>
          <div className="text-[15px] font-bold text-emerald-600 tabular-nums mt-1.5">
            {summary.avgProfitPct}%
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 shadow-[0_2px_8px_rgba(90,138,136,0.06)]">
          <div className="flex items-center justify-between text-[10.5px] text-[#6B8F8E]">
            <span>ต้นทุนเฉลี่ย/ชิ้น</span>
            <span className="p-1.5 rounded-lg bg-[#E8F3F2] text-[#2D4A49]">
              <DollarSign size={13} />
            </span>
          </div>
          <div className="text-[15px] font-bold text-[#2D4A49] tabular-nums mt-1.5">
            ฿{summary.avgCostPerPiece.toFixed(2)}
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 shadow-[0_2px_8px_rgba(90,138,136,0.06)]">
          <div className="flex items-center justify-between text-[10.5px] text-[#6B8F8E]">
            <span>กำไรสูงสุดในร้าน</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-500">
              <Award size={13} />
            </span>
          </div>
          <div className="text-[12px] font-bold text-[#2D4A49] truncate mt-1.5">
            {summary.topProfitRecipe?.name || '-'}
          </div>
          {summary.topProfitRecipe && (
            <span className="text-[10px] font-bold text-emerald-600 tabular-nums block mt-0.5">
              กำไร {summary.topProfitRecipe.profit_pct.toFixed(1)}% (฿{summary.topProfitRecipe.profit_per_piece.toFixed(2)})
            </span>
          )}
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* COMPARATIVE BAR CHART VISUAL */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white border border-[#D4E4E3] rounded-2xl p-4 shadow-[0_2px_8px_rgba(90,138,136,0.06)] space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <BarChart3 size={15} className="text-[#5A8A88]" />
            <h3 className="font-bold text-[13px] text-[#2D4A49]">
              เปรียบเทียบ ต้นทุน (Cost) vs ราคาขาย (Price)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]" />
              <span className="text-[#6B8F8E]">ต้นทุน/ชิ้น</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5A8A88]" />
              <span className="text-[#6B8F8E]">กำไร / ราคาขาย</span>
            </span>
          </div>
        </div>

        {recipes.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-[#6B8F8E]">
            ยังไม่มีข้อมูลสูตรสำหรับแสดงกราฟเปรียบเทียบ
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            {recipes.slice(0, 8).map(recipe => {
              const maxVal = Math.max(recipe.selling_price, recipe.cost_per_piece, 1);
              const costWidth = Math.min(100, (recipe.cost_per_piece / maxVal) * 100);
              const sellWidth = Math.min(100, (recipe.selling_price / maxVal) * 100);

              return (
                <div key={recipe.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#2D4A49] truncate max-w-[220px]">
                      {recipe.name}
                    </span>
                    <span className="text-[10px] tabular-nums text-[#6B8F8E]">
                      กำไร ฿{recipe.profit_per_piece.toFixed(2)} ({recipe.profit_pct.toFixed(1)}%)
                    </span>
                  </div>

                  <div className="w-full h-3 bg-[#F0F5F4] rounded-md overflow-hidden flex relative">
                    <div
                      style={{ width: `${costWidth}%` }}
                      className="h-full bg-[#F87171] rounded-l transition-all"
                      title={`ต้นทุน: ฿${recipe.cost_per_piece.toFixed(2)}`}
                    />
                    <div
                      style={{ width: `${Math.max(0, sellWidth - costWidth)}%` }}
                      className="h-full bg-[#5A8A88] rounded-r transition-all"
                      title={`กำไร: ฿${recipe.profit_per_piece.toFixed(2)}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* RANKING TABLE */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <StandardTableCard>
        <div className="p-3 border-b border-[#D4E4E3] flex flex-wrap items-center justify-between gap-2.5 bg-white">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B8F8E] pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหารายการสูตร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-[32px] pl-8 pr-2.5 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-[11px] outline-none focus:border-[#5A8A88]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <StandardDropdown<SortField>
              label="จัดเรียงตาม:"
              options={sortOptions}
              value={sortField}
              onChange={setSortField}
              align="right"
              ariaLabel="จัดเรียงตาม"
            />
            <button
              type="button"
              onClick={() => setSortAsc(!sortAsc)}
              className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] border border-[#D4E4E3] bg-white text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors cursor-pointer shrink-0"
              title="สลับลำดับ มาก/น้อย"
            >
              <ArrowUpDown size={13} />
            </button>
          </div>
        </div>

        <StandardTable fixedLayout minWidthClassName="min-w-[760px]">
          <colgroup>
            <col className="w-[46px]" />
            <col className="w-auto" />
            <col className="w-[124px]" />
            <col className="w-[58px]" />
            <col className="w-[82px]" />
            <col className="w-[76px]" />
            <col className="w-[74px]" />
            <col className="w-[82px]" />
            <col className="w-[78px]" />
          </colgroup>
            <StandardThead sticky={false}>
              <StandardHeaderRow>
                <StandardTh compact align="center">อันดับ</StandardTh>
                <StandardTh compact>ชื่อสินค้า / สูตร</StandardTh>
                <StandardTh compact>หมวดหมู่</StandardTh>
                <StandardTh compact align="center" wrap>ผลิตได้<br/>(ชิ้น)</StandardTh>
                <StandardTh compact align="right">ต้นทุนรวม</StandardTh>
                <StandardTh compact align="right">ต้นทุน/ชิ้น</StandardTh>
                <StandardTh compact align="right">ราคาขาย</StandardTh>
                <StandardTh compact align="right">กำไร/ชิ้น</StandardTh>
                <StandardTh compact align="center">อัตรากำไร</StandardTh>
              </StandardHeaderRow>
            </StandardThead>
            <StandardTbody>
              {sortedRecipes.length === 0 ? (
                <StandardTableEmpty
                  colSpan={9}
                  title="ไม่พบรายการสูตร"
                  description="ลองเปลี่ยนคำค้นหาหรือสร้างสูตรใหม่ในแท็บสูตรอาหาร"
                />
              ) : (
                sortedRecipes.map((r, idx) => {
                  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FCFC]';
                  return (
                    <StandardTr key={r.id} className={rowBg}>
                      <StandardTd compact align="center" numeric className="font-mono font-bold text-[#6B8F8E]">
                        {idx + 1}
                      </StandardTd>
                      <StandardTd compact>
                        <div className="font-semibold text-[#2D4A49] text-[11.5px] sm:text-[12px] leading-[1.35] break-words">
                          {r.name}
                        </div>
                        <span className="block text-[10px] text-[#6B8F8E] font-mono mt-0.5">{r.code}</span>
                      </StandardTd>
                      <StandardTd compact className="text-[#6B8F8E] text-[10.5px] leading-[1.35] break-words">
                        {r.category}
                      </StandardTd>
                      <StandardTd compact align="center" numeric nowrap className="font-mono font-medium text-[#2D4A49]">
                        {r.yield_qty}
                      </StandardTd>
                      <StandardTd compact align="right" numeric nowrap className="font-mono text-[#6B8F8E]">
                        ฿{r.total_batch_cost.toFixed(2)}
                      </StandardTd>
                      <StandardTd compact align="right" numeric nowrap className="font-mono font-semibold text-[#2D4A49]">
                        ฿{r.cost_per_piece.toFixed(2)}
                      </StandardTd>
                      <StandardTd compact align="right" numeric nowrap className="font-mono font-bold text-[#2D4A49]">
                        ฿{r.selling_price.toFixed(2)}
                      </StandardTd>
                      <StandardTd compact align="right" numeric nowrap className="font-mono font-bold text-emerald-600">
                        +฿{r.profit_per_piece.toFixed(2)}
                      </StandardTd>
                      <StandardTd compact align="center" nowrap>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[6px] font-mono font-bold text-[10.5px] tabular-nums whitespace-nowrap shrink-0 border ${
                            r.profit_pct >= 50
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : r.profit_pct >= 30
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-600 border-rose-200'
                          }`}
                        >
                          {r.profit_pct.toFixed(1)}%
                        </span>
                      </StandardTd>
                    </StandardTr>
                  );
                })
              )}
            </StandardTbody>
          </StandardTable>
      </StandardTableCard>
    </div>
  );
}
